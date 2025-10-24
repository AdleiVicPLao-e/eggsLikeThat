import { Egg } from "../models/Egg.js";
import { User } from "../models/User.js";
import { Pet } from "../models/Pet.js";
import { serverRNGService } from "../services/RNGService.js";
import { blockchainService } from "../config/blockchain.js";
import logger from "../utils/logger.js";
import { EGG_TYPES } from "../utils/constants.js";

export const EggController = {
  // Get user's eggs with blockchain integration
  async getUserEggs(req, res) {
    try {
      const { page = 1, limit = 20, type, isHatched } = req.query;
      const userId = req.user._id || req.user.id;
      const walletAddress = req.user.walletAddress;

      const query = { ownerId: userId };

      // Apply filters
      if (type) query.type = type;
      if (isHatched !== undefined) {
        query.isHatched = isHatched === "true";
      }

      const eggs = await Egg.find(query, {
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        sort: { createdAt: -1 },
      });

      const total = await Egg.countDocuments(query);

      // Get blockchain eggs if user has wallet
      let blockchainEggs = [];
      if (walletAddress) {
        try {
          blockchainEggs = await blockchainService.getOwnedEggs(walletAddress);
        } catch (error) {
          logger.warn("Failed to fetch blockchain eggs:", error);
        }
      }

      // Get egg statistics using the static method
      const stats = await Egg.getEggStats(userId);

      res.json({
        success: true,
        data: {
          eggs: eggs.map((egg) => egg.toJSON()),
          blockchainEggs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          stats,
        },
      });
    } catch (error) {
      logger.error("Get user eggs error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get specific egg details
  async getEggDetails(req, res) {
    try {
      const { eggId } = req.params;
      const userId = req.user._id || req.user.id;

      const egg = await Egg.findById(eggId);
      if (!egg || egg.ownerId.toString() !== userId.toString()) {
        return res.status(404).json({
          success: false,
          message: "Egg not found",
        });
      }

      // Enhance egg data with additional information
      const enhancedEgg = {
        ...egg.toJSON(),
        canHatch: !egg.isHatched,
        hatchRequirements: EggController.getHatchRequirements(egg),
        potentialContents: EggController.getPotentialContents(egg.type),
        timeUntilHatch: EggController.calculateHatchTime(
          egg.obtainedAt || egg.createdAt
        ),
      };

      res.json({
        success: true,
        data: { egg: enhancedEgg },
      });
    } catch (error) {
      logger.error("Get egg details error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Purchase an egg with blockchain integration
  async purchaseEgg(req, res) {
    try {
      const { eggType, currency = "coins" } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Validate egg type
      const validEggTypes = Object.values(EGG_TYPES);
      if (!validEggTypes.includes(eggType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid egg type",
        });
      }

      // Calculate cost based on egg type and currency
      const cost = EggController.calculateEggCost(eggType, currency);

      // Check if user can afford the egg
      if (currency === "coins" && user.balance < cost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Cost: ${cost}, You have: ${user.balance}`,
        });
      }

      // Handle blockchain purchase
      if (currency === "ETH" || currency === "MATIC") {
        if (!user.walletAddress) {
          return res.status(400).json({
            success: false,
            message: "Wallet address required for blockchain purchases",
          });
        }

        // Convert egg type to blockchain format
        const blockchainEggType = EggController.mapToBlockchainEggType(eggType);

        // Mint blockchain egg
        const result = await blockchainService.mintEgg(
          user.walletAddress,
          blockchainEggType,
          1 // amount
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: `Blockchain purchase failed: ${result.error}`,
          });
        }

        // Create local egg record for blockchain egg
        const eggData = serverRNGService.generateEggForDB(user.id, eggType);
        const egg = new Egg({
          type: eggType,
          ownerId: user.id,
          rarity: eggData.rarity,
          purchased: true,
          purchasePrice: cost,
          currency: currency,
          obtainedAt: new Date(),
          blockchain: {
            tokenId: result.tokenId,
            contractAddress:
              blockchainService.contracts.eggNFT?.polygon?.address,
            network: "polygon",
            transactionHash: result.transactionHash,
          },
        });

        const savedEgg = await egg.save();

        logger.info(
          `User ${user.username} purchased blockchain ${eggType} egg for ${cost} ${currency}`
        );

        return res.status(201).json({
          success: true,
          message: "Blockchain egg purchased successfully!",
          data: {
            egg: {
              id: savedEgg._id,
              type: savedEgg.type,
              rarity: savedEgg.rarity,
              canHatch: !savedEgg.isHatched,
              purchasePrice: savedEgg.purchasePrice,
              currency: savedEgg.currency,
              blockchain: savedEgg.blockchain,
            },
            blockchain: result,
            user: {
              balance: user.balance,
              eggs: await Egg.countDocuments({ ownerId: user.id }),
              level: user.level,
              experience: user.experience,
            },
          },
        });
      }

      // Original coin purchase logic
      const eggData = serverRNGService.generateEggForDB(user.id, eggType);
      const egg = new Egg({
        type: eggType,
        ownerId: user.id,
        rarity: eggData.rarity,
        purchased: true,
        purchasePrice: cost,
        currency: currency,
        obtainedAt: new Date(),
      });

      const savedEgg = await egg.save();

      // Update user balance
      if (currency === "coins") {
        user.balance -= cost;
      }

      // Add experience for purchasing
      user.experience += 10;
      const leveledUp = EggController.checkLevelUp(user);

      await user.save();

      logger.info(
        `User ${user.username} purchased a ${eggType} egg for ${cost} ${currency}`
      );

      const responseData = {
        success: true,
        message: "Egg purchased successfully!",
        data: {
          egg: {
            id: savedEgg._id,
            type: savedEgg.type,
            rarity: savedEgg.rarity,
            canHatch: !savedEgg.isHatched,
            purchasePrice: savedEgg.purchasePrice,
            currency: savedEgg.currency,
          },
          user: {
            balance: user.balance,
            eggs: await Egg.countDocuments({ ownerId: user.id }),
            level: user.level,
            experience: user.experience,
          },
        },
      };

      // Add level up notification if applicable
      if (leveledUp) {
        responseData.message += ` You leveled up to level ${user.level}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = user.level;
      }

      res.status(201).json(responseData);
    } catch (error) {
      logger.error("Purchase egg error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during egg purchase",
      });
    }
  },

  // Get free daily egg (if available)
  async getFreeEgg(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user can claim free egg
      const lastFreeEgg = user.lastFreeRoll || new Date(0);
      const now = new Date();
      const hoursSinceLastFree = (now - lastFreeEgg) / (1000 * 60 * 60);

      if (hoursSinceLastFree < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceLastFree);
        return res.status(400).json({
          success: false,
          message: `Please wait ${hoursRemaining} more hours to claim your next free egg`,
        });
      }

      // Generate free basic egg using RNG service
      const eggData = serverRNGService.generateEggForDB(
        user.id,
        EGG_TYPES.BASIC
      );

      // Create new egg instance
      const egg = new Egg({
        type: EGG_TYPES.BASIC,
        ownerId: user.id,
        rarity: eggData.rarity,
        obtainedAt: new Date(),
      });

      // Save the egg to database
      const savedEgg = await egg.save();

      // Update user
      user.lastFreeRoll = new Date();
      user.experience += 5; // 5 XP for free egg
      const leveledUp = EggController.checkLevelUp(user);

      await user.save();

      logger.info(`User ${user.username} claimed free daily egg`);

      const responseData = {
        success: true,
        message: "Free egg claimed successfully!",
        data: {
          egg: {
            id: savedEgg._id,
            type: savedEgg.type,
            rarity: savedEgg.rarity,
            canHatch: !savedEgg.isHatched,
          },
          user: {
            eggs: await Egg.countDocuments({ ownerId: user.id }),
            lastFreeRoll: user.lastFreeRoll,
            level: user.level,
            experience: user.experience,
          },
        },
      };

      // Add level up notification if applicable
      if (leveledUp) {
        responseData.message += ` You leveled up to level ${user.level}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = user.level;
      }

      res.json(responseData);
    } catch (error) {
      logger.error("Free egg claim error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during free egg claim",
      });
    }
  },

  // Preview egg contents (without hatching)
  async previewEgg(req, res) {
    try {
      const { eggId } = req.params;
      const userId = req.user._id || req.user.id;

      const egg = await Egg.findById(eggId);
      if (!egg || egg.ownerId.toString() !== userId.toString()) {
        return res.status(404).json({
          success: false,
          message: "Egg not found",
        });
      }

      if (egg.isHatched) {
        return res.status(400).json({
          success: false,
          message: "Egg has already been hatched",
        });
      }

      // Generate preview of potential contents based on egg type
      const previewContents = EggController.getPotentialContents(egg.type);

      res.json({
        success: true,
        data: {
          egg: {
            id: egg._id,
            type: egg.type,
            rarity: egg.rarity,
            previewContents,
            hatchCost: EggController.calculateHatchCost(egg),
          },
        },
      });
    } catch (error) {
      logger.error("Preview egg error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during egg preview",
      });
    }
  },

  // Apply cosmetic to egg
  async applyCosmetic(req, res) {
    try {
      const { eggId } = req.params;
      const { skin, animation } = req.body;
      const userId = req.user._id || req.user.id;

      const egg = await Egg.findById(eggId);
      if (!egg || egg.ownerId.toString() !== userId.toString()) {
        return res.status(404).json({
          success: false,
          message: "Egg not found",
        });
      }

      if (egg.isHatched) {
        return res.status(400).json({
          success: false,
          message: "Cannot apply cosmetic to hatched egg",
        });
      }

      // Update cosmetic properties
      if (skin) egg.skin = skin;
      if (animation) egg.animation = animation;

      egg.updatedAt = new Date();
      await egg.save();

      logger.info(`User ${userId} applied cosmetic to egg ${eggId}`);

      res.json({
        success: true,
        message: "Cosmetic applied successfully!",
        data: {
          egg: {
            id: egg._id,
            skin: egg.skin,
            animation: egg.animation,
          },
        },
      });
    } catch (error) {
      logger.error("Apply cosmetic error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during cosmetic application",
      });
    }
  },

  // Hatch an egg with blockchain integration
  async hatchEgg(req, res) {
    try {
      const { eggId } = req.params;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const egg = await Egg.findById(eggId);
      if (!egg || egg.ownerId.toString() !== user.id.toString()) {
        return res.status(404).json({
          success: false,
          message: "Egg not found",
        });
      }

      if (egg.isHatched) {
        return res.status(400).json({
          success: false,
          message: "Egg has already been hatched",
        });
      }

      // Check hatch cost (if any)
      const hatchCost = EggController.calculateHatchCost(egg);
      if (user.balance < hatchCost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins to hatch. Cost: ${hatchCost}, You have: ${user.balance}`,
        });
      }

      // Handle blockchain egg hatching
      if (egg.blockchain?.tokenId) {
        const result = await blockchainService.hatchBlockchainEgg(
          user.walletAddress,
          egg.blockchain.tokenId
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: `Blockchain hatching failed: ${result.error}`,
          });
        }

        // Create pet from blockchain result
        const pet = new Pet({
          ownerId: user.id,
          name: result.petMetadata.name,
          type: result.petMetadata.petType,
          rarity: result.petMetadata.rarity,
          level: result.petMetadata.level,
          isShiny: result.petMetadata.isShiny,
          blockchain: {
            tokenId: result.tokenId,
            contractAddress:
              blockchainService.contracts.petNFT?.polygon?.address,
            network: "polygon",
          },
          stats: {
            dmg: 10,
            hp: 50,
            range: 1,
            spa: 1.0,
          },
        });

        await pet.save();
        egg.isHatched = true;
        egg.hatchedAt = new Date();
        await egg.save();

        // Update user balance and experience
        user.balance -= hatchCost;
        user.experience += 25;
        const leveledUp = EggController.checkLevelUp(user);
        await user.save();

        const responseData = {
          success: true,
          message: "Blockchain egg hatched successfully!",
          data: {
            result: {
              type: "Pet",
              data: {
                id: pet._id,
                name: pet.name,
                type: pet.type,
                rarity: pet.rarity,
                stats: pet.stats,
                level: pet.level,
                isShiny: pet.isShiny,
                blockchain: pet.blockchain,
              },
            },
            blockchain: result,
            user: {
              balance: user.balance,
              pets: await Pet.countDocuments({ ownerId: user.id }),
              eggs: await Egg.countDocuments({ ownerId: user.id }),
              level: user.level,
              experience: user.experience,
            },
          },
        };

        if (leveledUp) {
          responseData.message += ` You leveled up to level ${user.level}!`;
          responseData.data.user.leveledUp = true;
          responseData.data.user.newLevel = user.level;
        }

        return res.json(responseData);
      }

      // Original hatching logic for non-blockchain eggs
      const result = await egg.hatch();
      user.balance -= hatchCost;
      user.experience += 25;
      const leveledUp = EggController.checkLevelUp(user);
      await user.save();

      logger.info(`User ${user.username} hatched egg ${eggId}`);

      const responseData = {
        success: true,
        message: "Egg hatched successfully!",
        data: {
          result: EggController.formatHatchResult(result),
          user: {
            balance: user.balance,
            pets: await Pet.countDocuments({ ownerId: user.id }),
            eggs: await Egg.countDocuments({ ownerId: user.id }),
            level: user.level,
            experience: user.experience,
          },
        },
      };

      if (leveledUp) {
        responseData.message += ` You leveled up to level ${user.level}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = user.level;
      }

      res.json(responseData);
    } catch (error) {
      logger.error("Hatch egg error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during egg hatching",
      });
    }
  },

  // Get available egg types and their costs with blockchain integration
  async getEggCatalog(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Get blockchain gas estimates
      let gasEstimates = {};
      try {
        gasEstimates = await blockchainService.getGasEstimates();
      } catch (error) {
        logger.warn("Failed to get gas estimates:", error);
      }

      const catalog = {
        [EGG_TYPES.BASIC]: {
          name: "Basic Egg",
          description: "A standard egg with common to rare pets",
          costs: {
            coins: 100,
            ETH: "0.001",
            MATIC: "0.1",
          },
          gasEstimate: gasEstimates.eggMint,
          dropRates: serverRNGService.getEggDropRates
            ? serverRNGService.getEggDropRates("BASIC")
            : {},
          canPurchase: true,
          canAfford: user.balance >= 100,
          blockchainAvailable: !!user.walletAddress,
        },
        [EGG_TYPES.COSMETIC]: {
          name: "Cosmetic Egg",
          description: "Special skins and animations for your eggs and pets",
          costs: {
            coins: 150,
            ETH: "0.003",
            MATIC: "0.3",
          },
          gasEstimate: gasEstimates.eggMint,
          dropRates: serverRNGService.getEggDropRates
            ? serverRNGService.getEggDropRates("COSMETIC")
            : {},
          canPurchase: true,
          canAfford: user.balance >= 150,
          blockchainAvailable: !!user.walletAddress,
        },
        [EGG_TYPES.ATTRIBUTE]: {
          name: "Attribute Egg",
          description: "Grants powerful techniques and abilities",
          costs: {
            coins: 200,
            ETH: "0.004",
            MATIC: "0.4",
          },
          gasEstimate: gasEstimates.eggMint,
          dropRates: serverRNGService.getEggDropRates
            ? serverRNGService.getEggDropRates("ATTRIBUTE")
            : {},
          canPurchase: true,
          canAfford: user.balance >= 200,
          blockchainAvailable: !!user.walletAddress,
        },
      };

      res.json({
        success: true,
        data: {
          catalog,
          user: {
            balance: user.balance,
            level: user.level,
            canClaimFreeEgg: EggController.canClaimFreeEgg(user),
            walletConnected: !!user.walletAddress,
          },
          blockchain: {
            network: "polygon",
            contracts: {
              eggNFT: blockchainService.contracts.eggNFT?.polygon?.address,
            },
          },
        },
      });
    } catch (error) {
      logger.error("Get egg catalog error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Sync blockchain eggs with local database
  async syncBlockchainEggs(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user || !user.walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Wallet address required for blockchain sync",
        });
      }

      const blockchainEggs = await blockchainService.getOwnedEggs(
        user.walletAddress
      );
      let syncedCount = 0;

      for (const blockchainEgg of blockchainEggs) {
        // Check if we already have this egg in database
        const existingEgg = await Egg.findOne({
          "blockchain.tokenId": blockchainEgg.tokenId,
          ownerId: user._id,
        });

        if (!existingEgg) {
          // Create local record for blockchain egg
          const eggType = EggController.mapFromBlockchainEggType(
            blockchainEgg.eggType
          );
          const egg = new Egg({
            type: eggType,
            ownerId: user._id,
            rarity: "common", // Default rarity for blockchain eggs
            obtainedAt: new Date(),
            blockchain: {
              tokenId: blockchainEgg.tokenId,
              contractAddress:
                blockchainService.contracts.eggNFT?.polygon?.address,
              network: "polygon",
            },
          });

          await egg.save();
          syncedCount++;
        }
      }

      res.json({
        success: true,
        message: `Synced ${syncedCount} blockchain eggs`,
        data: {
          synced: syncedCount,
          totalBlockchain: blockchainEggs.length,
        },
      });
    } catch (error) {
      logger.error("Sync blockchain eggs error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync blockchain eggs",
      });
    }
  },

  // Helper methods
  mapToBlockchainEggType(localEggType) {
    const mapping = {
      [EGG_TYPES.BASIC]: 1, // BASIC_EGG
      [EGG_TYPES.COSMETIC]: 2, // COSMETIC_EGG
      [EGG_TYPES.ATTRIBUTE]: 3, // ATTRIBUTE_EGG
    };
    return mapping[localEggType] || 1;
  },

  mapFromBlockchainEggType(blockchainEggType) {
    const mapping = {
      1: EGG_TYPES.BASIC,
      2: EGG_TYPES.COSMETIC,
      3: EGG_TYPES.ATTRIBUTE,
    };
    return mapping[blockchainEggType] || EGG_TYPES.BASIC;
  },

  calculateEggCost(eggType, currency) {
    const costs = {
      [EGG_TYPES.BASIC]: { coins: 100, ETH: 0.001, MATIC: 0.1 },
      [EGG_TYPES.COSMETIC]: { coins: 150, ETH: 0.003, MATIC: 0.3 },
      [EGG_TYPES.ATTRIBUTE]: { coins: 200, ETH: 0.004, MATIC: 0.4 },
    };

    return costs[eggType]?.[currency] || costs[EGG_TYPES.BASIC].coins;
  },

  calculateHatchCost(egg) {
    const baseCost = 50;
    const multipliers = {
      [EGG_TYPES.BASIC]: 1,
      [EGG_TYPES.COSMETIC]: 1.5,
      [EGG_TYPES.ATTRIBUTE]: 1.3,
    };

    return Math.floor(baseCost * (multipliers[egg.type] || 1));
  },

  getHatchRequirements(egg) {
    return {
      cost: EggController.calculateHatchCost(egg),
      time: "Instant",
      level: "Any level",
    };
  },

  getPotentialContents(eggType) {
    const contents = {
      [EGG_TYPES.BASIC]: [
        {
          type: "Pet",
          probability: "100%",
          description: "Random pet of varying rarity",
        },
      ],
      [EGG_TYPES.COSMETIC]: [
        {
          type: "Skin",
          probability: "100%",
          description: "Cosmetic skins and animations",
        },
      ],
      [EGG_TYPES.ATTRIBUTE]: [
        {
          type: "Technique",
          probability: "100%",
          description: "Powerful battle techniques",
        },
      ],
    };

    return contents[eggType] || contents[EGG_TYPES.BASIC];
  },

  calculateHatchTime(createdAt) {
    const hatchDuration = 24 * 60 * 60 * 1000;
    const now = new Date();
    const created = new Date(createdAt);
    const timePassed = now - created;

    if (timePassed >= hatchDuration) {
      return "Ready to hatch!";
    } else {
      const remaining = hatchDuration - timePassed;
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m remaining`;
    }
  },

  checkLevelUp(user) {
    const threshold = user.level * 100;

    if (user.experience >= threshold) {
      user.level += 1;
      user.experience -= threshold;
      return true;
    }
    return false;
  },

  canClaimFreeEgg(user) {
    const lastFreeEgg = user.lastFreeRoll || new Date(0);
    const now = new Date();
    const hoursSinceLastFree = (now - lastFreeEgg) / (1000 * 60 * 60);
    return hoursSinceLastFree >= 24;
  },

  formatHatchResult(result) {
    if (result && result._model && result._model === "Pet") {
      return {
        type: "Pet",
        data: {
          id: result._id,
          name: result.name,
          type: result.type,
          rarity: result.rarity,
          stats: result.stats,
          level: result.level,
          isShiny: result.isShiny,
        },
      };
    } else if (result && result.type === "Technique") {
      return {
        type: "Technique",
        data: {
          id: result.id,
          name: result.name,
          rarity: result.rarity,
          effect: result.effect,
        },
      };
    } else if (result && result.type === "Cosmetic") {
      return {
        type: "Cosmetic",
        data: {
          id: result.id,
          name: result.name,
          rarity: result.rarity,
        },
      };
    }

    return result;
  },
};

export default EggController;
