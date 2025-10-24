import { Pet } from "../models/Pet.js";
import { User } from "../models/User.js";
import { serverRNGService } from "../services/RNGService.js";
import { blockchainService } from "../config/blockchain.js";
import logger from "../utils/logger.js";

export const PetController = {
  // Get user's pets with blockchain integration
  async getUserPets(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        rarity,
        type,
        sortBy = "level",
        includeBlockchain = "true",
      } = req.query;
      const userId = req.user._id || req.user.id;
      const walletAddress = req.user.walletAddress;

      const query = { ownerId: userId };

      // Apply filters
      if (rarity) query.rarity = rarity;
      if (type) query.type = type;

      // Sort options
      const sortOptions = {
        level: { level: -1, "stats.dmg": -1 },
        attack: { "stats.dmg": -1, level: -1 },
        defense: { "stats.hp": -1, level: -1 },
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
      };

      const pets = await Pet.find(query, {
        sort: sortOptions[sortBy] || sortOptions.level,
        skip: (page - 1) * limit,
        limit: parseInt(limit),
      });

      const total = await Pet.countDocuments(query);

      // Get blockchain pets if requested and user has wallet
      let blockchainPets = [];
      if (includeBlockchain === "true" && walletAddress) {
        try {
          blockchainPets = await blockchainService.getOwnedPets(walletAddress);
        } catch (error) {
          logger.warn("Failed to fetch blockchain pets:", error);
        }
      }

      // Calculate additional stats using RNG service for power calculation
      const petsWithStats = pets.map((pet) => ({
        ...pet.toJSON(),
        power:
          serverRNGService.calculatePetPower?.(pet) ||
          PetController.calculatePetPower(pet),
        totalBattles: pet.battlesWon + pet.battlesLost,
        winRate:
          pet.battlesWon + pet.battlesLost > 0
            ? (
                (pet.battlesWon / (pet.battlesWon + pet.battlesLost)) *
                100
              ).toFixed(1)
            : 0,
      }));

      // Get user for stats
      const user = await User.findById(userId);

      // Get statistics using helper methods
      const byRarity = await PetController.getPetsByRarity(userId);
      const byType = await PetController.getPetsByType(userId);

      res.json({
        success: true,
        data: {
          pets: petsWithStats,
          blockchainPets,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          stats: {
            totalPets: total,
            byRarity,
            byType,
            userStats: {
              totalPets: user.pets.length,
              level: user.level,
              experience: user.experience,
              coins: user.balance,
              totalBattles: user.totalBattles,
              winRate: user.winRate,
            },
          },
        },
      });
    } catch (error) {
      logger.error("Get user pets error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get specific pet details
  async getPetDetails(req, res) {
    try {
      const { petId } = req.params;
      const userId = req.user._id || req.user.id;

      const pet = await Pet.findOne({ _id: petId, ownerId: userId });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      // Get user for additional info
      const user = await User.findById(userId);

      // Calculate additional stats with RNG service
      const totalBattles = pet.battlesWon + pet.battlesLost;
      const enhancedPet = {
        ...pet.toJSON(),
        power:
          serverRNGService.calculatePetPower?.(pet) ||
          PetController.calculatePetPower(pet),
        totalBattles,
        winRate:
          totalBattles > 0
            ? ((pet.battlesWon / totalBattles) * 100).toFixed(1)
            : 0,
        nextLevelExp: Math.pow(pet.level, 2) * 100,
        expProgress: (
          (pet.experience / Math.pow(pet.level, 2)) *
          100 *
          100
        ).toFixed(1),
        upgradeCost: PetController.calculateUpgradeCost(pet.level),
      };

      res.json({
        success: true,
        data: {
          pet: enhancedPet,
          user: {
            coins: user.balance,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Get pet details error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Upgrade pet level with blockchain integration
  async upgradePet(req, res) {
    try {
      const { petId } = req.params;
      const userId = req.user._id || req.user.id;

      const pet = await Pet.findOne({ _id: petId, ownerId: userId });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      // Calculate upgrade cost
      const upgradeCost = PetController.calculateUpgradeCost(pet.level);

      // Get user
      const user = await User.findById(userId);
      if (user.balance < upgradeCost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Upgrade cost: ${upgradeCost}, You have: ${user.balance}`,
        });
      }

      // Check if pet has enough experience
      const expNeeded = Math.pow(pet.level, 2) * 100;
      if (pet.experience < expNeeded) {
        return res.status(400).json({
          success: false,
          message: `Not enough experience. Need ${
            expNeeded - pet.experience
          } more EXP`,
        });
      }

      // Handle blockchain pet level up
      if (pet.blockchain?.tokenId) {
        const result = await blockchainService.levelUpPet(
          pet.blockchain.tokenId,
          pet.blockchain.network || "polygon"
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: `Blockchain level up failed: ${result.error}`,
          });
        }
      }

      // Perform upgrade
      const oldLevel = pet.level;
      pet.level += 1;
      pet.experience -= expNeeded;

      // Improve stats on level up using RNG service if available
      const statIncrease =
        serverRNGService.calculateStatIncrease?.(pet.rarity, oldLevel) ||
        PetController.calculateStatIncrease(pet.rarity, oldLevel);

      pet.stats.dmg = Math.floor(pet.stats.dmg * (1 + statIncrease));
      pet.stats.hp = Math.floor(pet.stats.hp * (1 + statIncrease));
      pet.stats.range = +(pet.stats.range * (1 + statIncrease * 0.8)).toFixed(
        2
      );
      pet.stats.spa = +(pet.stats.spa * (1 - statIncrease * 0.1)).toFixed(2); // Lower SPA is better

      // Update user balance
      user.balance -= upgradeCost;

      // Add user experience
      user.experience += 15;
      const leveledUp = PetController.checkLevelUp(user);

      await pet.save();
      await user.save();

      logger.info(
        `User ${user.username} upgraded pet ${pet.name} to level ${pet.level}`
      );

      const responseData = {
        success: true,
        message: `Pet upgraded to level ${pet.level}!`,
        data: {
          pet: {
            id: pet._id,
            name: pet.name,
            level: pet.level,
            experience: pet.experience,
            stats: pet.stats,
            nextLevelExp: Math.pow(pet.level, 2) * 100,
            power:
              serverRNGService.calculatePetPower?.(pet) ||
              PetController.calculatePetPower(pet),
          },
          user: {
            coins: user.balance,
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
      logger.error("Upgrade pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during pet upgrade",
      });
    }
  },

  // Train pet (gain experience)
  async trainPet(req, res) {
    try {
      const { petId } = req.params;
      const { trainingType = "basic" } = req.body;
      const userId = req.user._id || req.user.id;

      const pet = await Pet.findOne({ _id: petId, ownerId: userId });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      // Calculate training cost and experience using RNG service if available
      const trainingData =
        serverRNGService.calculateTrainingData?.(trainingType) ||
        PetController.calculateTrainingData(trainingType);

      // Get user
      const user = await User.findById(userId);
      if (user.balance < trainingData.cost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Training cost: ${trainingData.cost}, You have: ${user.balance}`,
        });
      }

      // Perform training
      pet.experience += trainingData.experience;
      user.balance -= trainingData.cost;
      user.experience += trainingData.userExperience;

      const leveledUp = PetController.checkLevelUp(user);

      await pet.save();
      await user.save();

      logger.info(
        `User ${user.username} trained pet ${pet.name} with ${trainingType} training`
      );

      const responseData = {
        success: true,
        message: `Training completed! ${pet.name} gained ${trainingData.experience} EXP`,
        data: {
          training: {
            type: trainingType,
            cost: trainingData.cost,
            experience: trainingData.experience,
          },
          pet: {
            id: pet._id,
            name: pet.name,
            level: pet.level,
            experience: pet.experience,
            nextLevelExp: Math.pow(pet.level, 2) * 100,
            expProgress: (
              (pet.experience / Math.pow(pet.level, 2)) *
              100 *
              100
            ).toFixed(1),
          },
          user: {
            coins: user.balance,
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
      logger.error("Train pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during pet training",
      });
    }
  },

  // Fuse multiple pets to create a new one
  async fusePets(req, res) {
    try {
      const { petIds, targetRarity } = req.body;
      const userId = req.user._id || req.user.id;

      // Validate input
      if (!petIds || petIds.length < 2 || petIds.length > 5) {
        return res.status(400).json({
          success: false,
          message: "Please select 2-5 pets for fusion",
        });
      }

      // Get the pets to fuse
      const materialPets = await Pet.find({
        _id: { $in: petIds },
        ownerId: userId,
      });

      if (materialPets.length !== petIds.length) {
        return res.status(400).json({
          success: false,
          message: "Some pets not found or not owned by you",
        });
      }

      // Calculate fusion requirements using RNG service
      const fusionData =
        serverRNGService.calculateFusionData?.(materialPets, targetRarity) ||
        PetController.calculateFusionData(materialPets, targetRarity);

      if (!fusionData.canFuse) {
        return res.status(400).json({
          success: false,
          message: fusionData.message || "Selected pets cannot be fused",
        });
      }

      // Get user
      const user = await User.findById(userId);
      if (user.balance < fusionData.cost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Fusion cost: ${fusionData.cost}, You have: ${user.balance}`,
        });
      }

      // Determine fusion success using RNG service
      const isSuccessful = Math.random() < fusionData.successChance;

      if (!isSuccessful) {
        // Failed fusion - lose material pets but get some consolation
        await Pet.deleteMany({ _id: { $in: petIds } });
        user.balance -= fusionData.cost;
        user.experience += fusionData.consolationExp;

        const leveledUp = PetController.checkLevelUp(user);
        await user.save();

        const responseData = {
          success: true,
          message: "Fusion failed! The pets were consumed in the process.",
          data: {
            fusion: {
              successful: false,
              cost: fusionData.cost,
              successChance: fusionData.successChance,
              consolationExp: fusionData.consolationExp,
            },
            user: {
              coins: user.balance,
              level: user.level,
              experience: user.experience,
            },
          },
        };

        if (leveledUp) {
          responseData.data.user.leveledUp = true;
          responseData.data.user.newLevel = user.level;
        }

        return res.json(responseData);
      }

      // SUCCESSFUL FUSION - Use RNG service to generate the new pet
      const pityCounter = serverRNGService.getUserPityCounter?.(userId) || 0;

      // Generate new pet using RNG service
      const newPetData =
        serverRNGService.generatePetForDB?.(userId, pityCounter) ||
        PetController.generateFusionPet(userId, materialPets, targetRarity);

      // Create new pet instance
      const newPet = new Pet(newPetData);
      await newPet.save();

      // Remove material pets and update user
      await Pet.deleteMany({ _id: { $in: petIds } });
      user.balance -= fusionData.cost;
      user.experience += fusionData.successExp;

      // Reset pity counter on successful fusion
      if (serverRNGService.resetUserPityCounter) {
        serverRNGService.resetUserPityCounter(userId);
      }

      const leveledUp = PetController.checkLevelUp(user);
      await user.save();

      logger.info(
        `User ${user.username} successfully fused ${petIds.length} pets into a ${targetRarity} pet`
      );

      const responseData = {
        success: true,
        message: "Fusion successful! A new powerful pet has been created!",
        data: {
          fusion: {
            successful: true,
            cost: fusionData.cost,
            successChance: fusionData.successChance,
            successExp: fusionData.successExp,
          },
          newPet: newPet.toJSON(),
          user: {
            coins: user.balance,
            level: user.level,
            experience: user.experience,
          },
        },
      };

      if (leveledUp) {
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = user.level;
      }

      res.json(responseData);
    } catch (error) {
      logger.error("Fuse pets error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during pet fusion",
      });
    }
  },

  // Update pet favorite status
  async toggleFavorite(req, res) {
    try {
      const { petId } = req.params;
      const userId = req.user._id || req.user.id;

      const pet = await Pet.findOne({ _id: petId, ownerId: userId });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      // Toggle favorite status
      pet.isFavorite = !pet.isFavorite;
      await pet.save();

      res.json({
        success: true,
        message: `Pet favorite status updated`,
        data: {
          pet: {
            id: pet._id,
            name: pet.name,
            isFavorite: pet.isFavorite,
          },
        },
      });
    } catch (error) {
      logger.error("Toggle favorite error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get pet fusion calculator
  async getFusionCalculator(req, res) {
    try {
      const userId = req.user._id || req.user.id;
      const user = await User.findById(userId);

      // Get drop rates from RNG service if available
      const eggDropRates = serverRNGService.getEggDropRates?.("BASIC") || {};

      const calculator = {
        requirements: {
          uncommon: { minPets: 3, minLevel: 5, cost: 500 },
          rare: { minPets: 3, minLevel: 10, cost: 1000 },
          epic: { minPets: 4, minLevel: 15, cost: 2000 },
          legendary: { minPets: 5, minLevel: 20, cost: 5000 },
        },
        successRates: {
          uncommon: 0.6,
          rare: 0.3,
          epic: 0.15,
          legendary: 0.05,
        },
        dropRates: eggDropRates,
        userStats: {
          coins: user.balance,
          totalPets: await Pet.countDocuments({ ownerId: userId }),
          maxPetLevel: await PetController.getMaxPetLevel(userId),
          pityCounter: serverRNGService.getUserPityCounter?.(userId) || 0,
        },
      };

      res.json({
        success: true,
        data: { calculator },
      });
    } catch (error) {
      logger.error("Get fusion calculator error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Sync blockchain pets with local database
  async syncBlockchainPets(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user || !user.walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Wallet address required for blockchain sync",
        });
      }

      const blockchainPets = await blockchainService.getOwnedPets(
        user.walletAddress
      );
      let syncedCount = 0;

      for (const blockchainPet of blockchainPets) {
        // Check if we already have this pet in database
        const existingPet = await Pet.findOne({
          "blockchain.tokenId": blockchainPet.tokenId,
          ownerId: user._id,
        });

        if (!existingPet) {
          // Create local record for blockchain pet
          const pet = new Pet({
            ownerId: user._id,
            name: blockchainPet.metadata.name,
            type: blockchainPet.metadata.petType,
            rarity: blockchainPet.metadata.rarity,
            level: blockchainPet.metadata.level,
            isShiny: blockchainPet.metadata.isShiny,
            blockchain: {
              tokenId: blockchainPet.tokenId,
              contractAddress:
                blockchainService.contracts.petNFT?.polygon?.address,
              network: "polygon",
            },
            stats: {
              dmg: 10 + (blockchainPet.metadata.level - 1) * 2,
              hp: 50 + (blockchainPet.metadata.level - 1) * 5,
              range: 1,
              spa: 1.0,
            },
            experience: 0,
          });

          await pet.save();
          syncedCount++;
        }
      }

      res.json({
        success: true,
        message: `Synced ${syncedCount} blockchain pets`,
        data: {
          synced: syncedCount,
          totalBlockchain: blockchainPets.length,
        },
      });
    } catch (error) {
      logger.error("Sync blockchain pets error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync blockchain pets",
      });
    }
  },

  // Get pet blockchain metadata
  async getPetBlockchainInfo(req, res) {
    try {
      const { petId } = req.params;
      const userId = req.user._id || req.user.id;

      const pet = await Pet.findOne({ _id: petId, ownerId: userId });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      if (!pet.blockchain?.tokenId) {
        return res.status(400).json({
          success: false,
          message: "This pet is not on the blockchain",
        });
      }

      const metadata = await blockchainService.getPetMetadata(
        pet.blockchain.tokenId,
        pet.blockchain.network || "polygon"
      );

      if (!metadata) {
        return res.status(404).json({
          success: false,
          message: "Blockchain metadata not found",
        });
      }

      res.json({
        success: true,
        data: {
          pet: {
            id: pet._id,
            name: pet.name,
            blockchain: pet.blockchain,
          },
          blockchainMetadata: metadata,
        },
      });
    } catch (error) {
      logger.error("Get pet blockchain info error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Helper methods
  async getPetsByRarity(userId) {
    try {
      const result = await Pet.aggregate([
        { $match: { ownerId: userId } },
        { $group: { _id: "$rarity", count: { $sum: 1 } } },
      ]);

      const rarities = {};
      result.forEach((item) => {
        rarities[item._id] = item.count;
      });
      return rarities;
    } catch (error) {
      console.error("getPetsByRarity error:", error);
      return {};
    }
  },

  async getPetsByType(userId) {
    try {
      const result = await Pet.aggregate([
        { $match: { ownerId: userId } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]);

      const types = {};
      result.forEach((item) => {
        types[item._id] = item.count;
      });
      return types;
    } catch (error) {
      console.error("getPetsByType error:", error);
      return {};
    }
  },

  calculatePetPower(pet) {
    const { dmg, hp, range, spa } = pet.stats;
    return Math.round(
      (dmg * 2 + hp * 0.5 + range * 10 + (1 / spa) * 20) * (pet.level * 0.1)
    );
  },

  calculateUpgradeCost(level) {
    return level * 75; // 75 coins per level
  },

  calculateStatIncrease(rarity, level) {
    const baseIncrease = 0.08; // 8% base
    const rarityMultipliers = {
      common: 1.0,
      uncommon: 1.15,
      rare: 1.3,
      epic: 1.6,
      legendary: 2.0,
    };
    const levelBonus = Math.min(level * 0.005, 0.1); // Up to 10% bonus from level

    return baseIncrease * (rarityMultipliers[rarity] || 1) + levelBonus;
  },

  calculateTrainingData(trainingType) {
    const trainingTypes = {
      basic: { cost: 50, experience: 25, userExperience: 5 },
      advanced: { cost: 100, experience: 60, userExperience: 10 },
      elite: { cost: 200, experience: 150, userExperience: 20 },
    };
    return trainingTypes[trainingType] || trainingTypes.basic;
  },

  calculateFusionData(materialPets, targetRarity) {
    const rarityRequirements = {
      uncommon: { minPets: 3, minLevel: 5, baseCost: 500 },
      rare: { minPets: 3, minLevel: 10, baseCost: 1000 },
      epic: { minPets: 4, minLevel: 15, baseCost: 2000 },
      legendary: { minPets: 5, minLevel: 20, baseCost: 5000 },
    };

    const requirement = rarityRequirements[targetRarity];
    if (!requirement) {
      return { canFuse: false, message: "Invalid target rarity" };
    }

    // Check basic requirements
    if (materialPets.length < requirement.minPets) {
      return {
        canFuse: false,
        message: `Need at least ${requirement.minPets} pets for ${targetRarity} fusion`,
      };
    }

    const avgLevel =
      materialPets.reduce((sum, pet) => sum + pet.level, 0) /
      materialPets.length;
    if (avgLevel < requirement.minLevel) {
      return {
        canFuse: false,
        message: `Average pet level must be at least ${requirement.minLevel} for ${targetRarity} fusion`,
      };
    }

    // Calculate success chance based on pet quality
    const totalValue = materialPets.reduce((sum, pet) => {
      const rarityValues = {
        common: 1.0,
        uncommon: 1.15,
        rare: 1.3,
        epic: 1.6,
        legendary: 2.0,
      };
      return sum + (rarityValues[pet.rarity] || 1) * pet.level;
    }, 0);

    const baseSuccessRate =
      {
        uncommon: 0.6,
        rare: 0.3,
        epic: 0.15,
        legendary: 0.05,
      }[targetRarity] || 0.5;

    const successChance = Math.min(baseSuccessRate + totalValue * 0.01, 0.95);
    const cost = requirement.baseCost * materialPets.length;

    return {
      canFuse: true,
      cost,
      successChance: Math.round(successChance * 100) / 100,
      consolationExp: Math.floor(totalValue * 2),
      successExp: Math.floor(totalValue * 5),
    };
  },

  generateFusionPet(userId, materialPets, targetRarity) {
    const basePetData = {
      ownerId: userId,
      name: `Fused ${targetRarity} Pet`,
      type: materialPets[0].type,
      rarity: targetRarity,
      level: 1,
      experience: 0,
      stats: {
        dmg: 15,
        hp: 60,
        range: 1,
        spa: 1.0,
        critChance: 0,
        critDamage: 0,
        moneyBonus: 0,
      },
    };

    // Enhance stats based on material pets
    const avgLevel =
      materialPets.reduce((sum, pet) => sum + pet.level, 0) /
      materialPets.length;
    basePetData.level = Math.max(1, Math.floor(avgLevel * 0.8));

    // Boost stats based on material pet quality
    const qualityMultiplier =
      PetController.calculateQualityMultiplier(materialPets);
    Object.keys(basePetData.stats).forEach((stat) => {
      basePetData.stats[stat] = Math.floor(
        basePetData.stats[stat] * qualityMultiplier
      );
    });

    return basePetData;
  },

  calculateQualityMultiplier(materialPets) {
    const totalValue = materialPets.reduce((sum, pet) => {
      const rarityValues = {
        common: 1.0,
        uncommon: 1.15,
        rare: 1.3,
        epic: 1.6,
        legendary: 2.0,
      };
      return sum + (rarityValues[pet.rarity] || 1);
    }, 0);

    return 1 + (totalValue / materialPets.length - 1) * 0.3;
  },

  async getMaxPetLevel(userId) {
    try {
      const maxLevelPet = await Pet.findOne(
        { ownerId: userId },
        {},
        { sort: { level: -1 } }
      );
      return maxLevelPet ? maxLevelPet.level : 0;
    } catch (error) {
      console.error("getMaxPetLevel error:", error);
      return 0;
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
};

export default PetController;
