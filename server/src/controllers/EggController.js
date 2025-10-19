import { Egg } from "../models/Egg.js";
import { User } from "../models/User.js";
import { serverRNGService } from "../services/RNGService.js";
import logger from "../utils/logger.js";

export const EggController = {
  // Get user's eggs
  async getUserEggs(req, res) {
    try {
      const { page = 1, limit = 20, eggType, isHatched } = req.query;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Get eggs from user's egg array
      let eggs = user.eggs || [];

      // Apply filters
      if (eggType) {
        eggs = eggs.filter((egg) => egg.type === eggType);
      }
      if (isHatched !== undefined) {
        const hatchedFilter = isHatched === "true";
        eggs = eggs.filter((egg) => egg.isHatched === hatchedFilter);
      }

      // Paginate results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedEggs = eggs.slice(startIndex, endIndex);

      // Calculate egg statistics
      const stats = this.getEggStats(user.eggs);

      res.json({
        success: true,
        data: {
          eggs: paginatedEggs.map((egg) => ({
            id: egg.id,
            type: egg.type,
            isHatched: egg.isHatched,
            contents: egg.contents,
            rarity: egg.rarity,
            canHatch: !egg.isHatched,
            timeUntilHatch: this.calculateHatchTime(
              egg.obtainedAt || egg.createdAt
            ),
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: eggs.length,
            pages: Math.ceil(eggs.length / limit),
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
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const egg = user.eggs.find((e) => e.id === eggId);
      if (!egg) {
        return res.status(404).json({
          success: false,
          message: "Egg not found",
        });
      }

      // Enhance egg data with additional information
      const enhancedEgg = {
        ...egg,
        canHatch: !egg.isHatched,
        hatchRequirements: this.getHatchRequirements(egg),
        potentialContents: this.getPotentialContents(egg.type),
        timeUntilHatch: this.calculateHatchTime(
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

  // Purchase an egg
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
      const cost = this.calculateEggCost(eggType, currency);

      // Check if user can afford the egg
      if (currency === "coins" && user.balance < cost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Cost: ${cost}, You have: ${user.balance}`,
        });
      }

      // For real currency purchases, you'd integrate with a payment processor
      if (currency !== "coins") {
        logger.info(
          `Processing ${currency} purchase for ${eggType} egg by user ${user.username}`
        );
      }

      // Generate egg data using RNG service
      const eggData = serverRNGService.generateEggForDB(user.id, eggType);

      // Create new egg instance
      const egg = new Egg(eggType, user.id);

      // Add purchase metadata
      egg.purchased = true;
      egg.purchasePrice = cost;
      egg.currency = currency;
      egg.obtainedAt = new Date();

      // Add egg to user's collection
      user.addEgg(egg);

      // Update user balance
      if (currency === "coins") {
        user.deductBalance(cost);
      }

      // Add experience for purchasing
      user.experience += 10;
      const leveledUp = this.checkLevelUp(user);

      await user.save();

      logger.info(
        `User ${user.username} purchased a ${eggType} egg for ${cost} ${currency}`
      );

      const responseData = {
        success: true,
        message: "Egg purchased successfully!",
        data: {
          egg: {
            id: egg.id,
            type: egg.type,
            rarity: egg.rarity,
            canHatch: !egg.isHatched,
            purchasePrice: egg.purchasePrice,
            currency: egg.currency,
          },
          user: {
            balance: user.balance,
            eggs: user.eggs.length,
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

      // Check if user can claim free egg (simplified logic)
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
      const egg = new Egg(EGG_TYPES.BASIC, user.id);
      egg.obtainedAt = new Date();

      // Add egg to user's collection
      user.addEgg(egg);

      // Update user
      user.lastFreeRoll = new Date();
      user.experience += 5; // 5 XP for free egg
      const leveledUp = this.checkLevelUp(user);

      await user.save();

      logger.info(`User ${user.username} claimed free daily egg`);

      const responseData = {
        success: true,
        message: "Free egg claimed successfully!",
        data: {
          egg: {
            id: egg.id,
            type: egg.type,
            rarity: egg.rarity,
            canHatch: !egg.isHatched,
          },
          user: {
            eggs: user.eggs.length,
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
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const egg = user.eggs.find((e) => e.id === eggId);
      if (!egg) {
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
      const previewContents = this.getPotentialContents(egg.type);

      res.json({
        success: true,
        data: {
          egg: {
            id: egg.id,
            type: egg.type,
            rarity: egg.rarity,
            previewContents,
            hatchCost: this.calculateHatchCost(egg),
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
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const egg = user.eggs.find((e) => e.id === eggId);
      if (!egg) {
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

      user.updatedAt = new Date();
      await user.save();

      logger.info(`User ${user.username} applied cosmetic to egg ${eggId}`);

      res.json({
        success: true,
        message: "Cosmetic applied successfully!",
        data: {
          egg: {
            id: egg.id,
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

  // Hatch an egg
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

      const eggIndex = user.eggs.findIndex((e) => e.id === eggId);
      if (eggIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Egg not found",
        });
      }

      const egg = user.eggs[eggIndex];
      if (egg.isHatched) {
        return res.status(400).json({
          success: false,
          message: "Egg has already been hatched",
        });
      }

      // Check hatch cost (if any)
      const hatchCost = this.calculateHatchCost(egg);
      if (user.balance < hatchCost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins to hatch. Cost: ${hatchCost}, You have: ${user.balance}`,
        });
      }

      // Use User model's hatchEgg method
      const result = user.hatchEgg(eggIndex);

      // Update user balance
      user.deductBalance(hatchCost);

      // Add experience for hatching
      user.experience += 25;
      const leveledUp = this.checkLevelUp(user);

      await user.save();

      logger.info(`User ${user.username} hatched egg ${eggId}`);

      const responseData = {
        success: true,
        message: "Egg hatched successfully!",
        data: {
          result: this.formatHatchResult(result),
          user: {
            balance: user.balance,
            pets: user.pets.length,
            eggs: user.eggs.length,
            techniques: user.techniques.length,
            skins: user.skins.length,
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
      logger.error("Hatch egg error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during egg hatching",
      });
    }
  },

  // Get available egg types and their costs
  async getEggCatalog(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
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
          dropRates: serverRNGService.getEggDropRates("BASIC"),
          canPurchase: true,
          canAfford: user.balance >= 100,
        },
        [EGG_TYPES.PREMIUM]: {
          name: "Premium Egg",
          description: "Higher chance for rare and epic pets",
          costs: {
            coins: 250,
            ETH: "0.005",
            MATIC: "0.5",
          },
          dropRates: serverRNGService.getEggDropRates("PREMIUM"),
          canPurchase: true,
          canAfford: user.balance >= 250,
        },
        [EGG_TYPES.COSMETIC]: {
          name: "Cosmetic Egg",
          description: "Special skins and animations for your eggs and pets",
          costs: {
            coins: 150,
            ETH: "0.003",
            MATIC: "0.3",
          },
          dropRates: serverRNGService.getEggDropRates("COSMETIC"),
          canPurchase: true,
          canAfford: user.balance >= 150,
        },
        [EGG_TYPES.ATTRIBUTE]: {
          name: "Attribute Egg",
          description: "Grants powerful techniques and abilities",
          costs: {
            coins: 200,
            ETH: "0.004",
            MATIC: "0.4",
          },
          dropRates: serverRNGService.getEggDropRates("ATTRIBUTE"),
          canPurchase: true,
          canAfford: user.balance >= 200,
        },
      };

      res.json({
        success: true,
        data: {
          catalog,
          user: {
            balance: user.balance,
            level: user.level,
            canClaimFreeEgg: this.canClaimFreeEgg(user),
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

  // Helper methods
  calculateEggCost(eggType, currency) {
    const costs = {
      [EGG_TYPES.BASIC]: { coins: 100, ETH: 0.001, MATIC: 0.1 },
      [EGG_TYPES.PREMIUM]: { coins: 250, ETH: 0.005, MATIC: 0.5 },
      [EGG_TYPES.COSMETIC]: { coins: 150, ETH: 0.003, MATIC: 0.3 },
      [EGG_TYPES.ATTRIBUTE]: { coins: 200, ETH: 0.004, MATIC: 0.4 },
    };

    return costs[eggType]?.[currency] || costs[EGG_TYPES.BASIC].coins;
  },

  calculateHatchCost(egg) {
    const baseCost = 50;
    const multipliers = {
      [EGG_TYPES.BASIC]: 1,
      [EGG_TYPES.PREMIUM]: 1.2,
      [EGG_TYPES.COSMETIC]: 1.5,
      [EGG_TYPES.ATTRIBUTE]: 1.3,
    };

    return Math.floor(baseCost * (multipliers[egg.type] || 1));
  },

  getHatchRequirements(egg) {
    return {
      cost: this.calculateHatchCost(egg),
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
      [EGG_TYPES.PREMIUM]: [
        {
          type: "Pet",
          probability: "100%",
          description: "Higher chance for rare pets",
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

  getEggStats(eggs) {
    const stats = {
      total: eggs.length,
      hatched: eggs.filter((egg) => egg.isHatched).length,
      unhatched: eggs.filter((egg) => !egg.isHatched).length,
      byType: {},
    };

    eggs.forEach((egg) => {
      if (!stats.byType[egg.type]) {
        stats.byType[egg.type] = { total: 0, hatched: 0 };
      }
      stats.byType[egg.type].total += 1;
      if (egg.isHatched) {
        stats.byType[egg.type].hatched += 1;
      }
    });

    return stats;
  },

  checkLevelUp(user) {
    const oldLevel = user.level;
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
    if (result instanceof Pet) {
      return {
        type: "Pet",
        data: {
          id: result.id,
          name: result.name,
          type: result.type,
          rarity: result.rarity,
          stats: result.stats,
          level: result.level,
          isShiny: result.isShiny,
        },
      };
    } else if (result.type === "Technique") {
      return {
        type: "Technique",
        data: {
          id: result.id,
          name: result.name,
          rarity: result.rarity,
          effect: result.effect,
        },
      };
    } else if (result.type === "Cosmetic") {
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
