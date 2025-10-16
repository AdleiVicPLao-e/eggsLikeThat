import Egg from "../models/Egg.js";
import User from "../models/User.js";
import { serverRNGService } from "../services/RNGService.js";
import logger from "../utils/logger.js";

export const EggController = {
  // Get user's eggs
  async getUserEggs(req, res) {
    try {
      const { page = 1, limit = 20, eggType, isHatched } = req.query;
      const user = req.user;

      const query = { owner: user._id };

      // Apply filters
      if (eggType) query.eggType = eggType;
      if (isHatched !== undefined) query.isHatched = isHatched === "true";

      const eggs = await Egg.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select("-__v")
        .lean();

      const total = await Egg.countDocuments(query);

      // Calculate egg statistics
      const stats = await this.getEggStats(user._id);

      res.json({
        success: true,
        data: {
          eggs: eggs.map((egg) => ({
            ...egg,
            canHatch: !egg.isHatched,
            timeUntilHatch: this.calculateHatchTime(egg.createdAt),
          })),
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
      const user = req.user;

      const egg = await Egg.findOne({ _id: eggId, owner: user._id })
        .populate("owner", "username level")
        .lean();

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
        potentialPetsInfo: this.getPotentialPetsInfo(egg.potentialPets),
        timeUntilHatch: this.calculateHatchTime(egg.createdAt),
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
      const user = await User.findById(req.user._id); // Get fresh user instance

      // Validate egg type
      const validEggTypes = ["basic", "premium", "cosmetic", "mystery"];
      if (!validEggTypes.includes(eggType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid egg type",
        });
      }

      // Calculate cost based on egg type and currency
      const cost = this.calculateEggCost(eggType, currency);

      // Check if user can afford the egg
      if (currency === "coins" && user.coins < cost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Cost: ${cost}, You have: ${user.coins}`,
        });
      }

      // For real currency purchases, you'd integrate with a payment processor
      if (currency !== "coins") {
        logger.info(
          `Processing ${currency} purchase for ${eggType} egg by user ${user.username}`
        );
      }

      // Generate egg data using RNG service
      const eggData = serverRNGService.generateEggForDB(
        user._id,
        eggType.toUpperCase()
      );

      const egg = new Egg({
        ...eggData,
        purchased: true,
        purchasePrice: cost,
        currency,
      });

      await egg.save();

      // Update user using User model methods
      if (currency === "coins") {
        user.coins -= cost;
      }
      user.ownedEggs.push(egg._id);

      // Add experience for purchasing
      const expResult = user.addExperience(10); // 10 XP per egg purchase

      await user.save();

      logger.info(
        `User ${user.username} purchased a ${eggType} egg for ${cost} ${currency}`
      );

      const responseData = {
        success: true,
        message: "Egg purchased successfully!",
        data: {
          egg: {
            id: egg._id,
            eggType: egg.eggType,
            rarity: egg.rarity,
            skin: egg.skin,
            canHatch: true,
            purchasePrice: egg.purchasePrice,
            currency: egg.currency,
          },
          user: {
            coins: user.coins,
            ownedEggs: user.ownedEggs.length,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles, // Using virtual
            winRate: user.winRate, // Using virtual
          },
        },
      };

      // Add level up notification if applicable
      if (expResult.leveledUp) {
        responseData.message += ` You leveled up to level ${expResult.newLevel}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
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
      const user = await User.findById(req.user._id); // Get fresh user instance

      // Check if user can claim free egg using User model method
      const canClaimFreeEgg = user.canGetFreeRoll();
      if (!canClaimFreeEgg) {
        const lastFreeEgg = new Date(user.lastFreeRoll);
        const now = new Date();
        const hoursRemaining = Math.ceil(
          24 - (now - lastFreeEgg) / (1000 * 60 * 60)
        );

        return res.status(400).json({
          success: false,
          message: `Please wait ${hoursRemaining} more hours to claim your next free egg`,
        });
      }

      // Generate free basic egg using RNG service
      const eggData = serverRNGService.generateEggForDB(user._id, "BASIC");
      const egg = new Egg(eggData);
      await egg.save();

      // Update user
      user.lastFreeRoll = new Date();
      user.freeRolls = Math.max(0, user.freeRolls - 1);
      user.ownedEggs.push(egg._id);

      // Add experience for claiming free egg
      const expResult = user.addExperience(5); // 5 XP for free egg

      await user.save();

      logger.info(`User ${user.username} claimed free daily egg`);

      const responseData = {
        success: true,
        message: "Free egg claimed successfully!",
        data: {
          egg: {
            id: egg._id,
            eggType: egg.eggType,
            rarity: egg.rarity,
            canHatch: true,
          },
          user: {
            ownedEggs: user.ownedEggs.length,
            lastFreeRoll: user.lastFreeRoll,
            freeRolls: user.freeRolls,
            level: user.level,
            experience: user.experience,
          },
        },
      };

      // Add level up notification if applicable
      if (expResult.leveledUp) {
        responseData.message += ` You leveled up to level ${expResult.newLevel}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
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
      const user = req.user;

      const egg = await Egg.findOne({ _id: eggId, owner: user._id });
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

      // Generate preview of potential pets using RNG service weights
      const totalWeight = egg.potentialPets.reduce(
        (sum, pet) => sum + pet.weight,
        0
      );
      const previewPets = egg.potentialPets.map((pet) => ({
        tier: pet.tier,
        type: serverRNGService.getRandomPetType(),
        probability: ((pet.weight / totalWeight) * 100).toFixed(1) + "%",
        description: `Chance to get a ${pet.tier} ${pet.type || "random"} pet`,
      }));

      res.json({
        success: true,
        data: {
          egg: {
            id: egg._id,
            eggType: egg.eggType,
            rarity: egg.rarity,
            previewPets,
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
      const user = req.user;

      const egg = await Egg.findOne({ _id: eggId, owner: user._id });
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

      await egg.save();

      logger.info(`User ${user.username} applied cosmetic to egg ${eggId}`);

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

  // Hatch an egg
  async hatchEgg(req, res) {
    try {
      const { eggId } = req.params;
      const user = await User.findById(req.user._id); // Get fresh user instance

      const egg = await Egg.findOne({ _id: eggId, owner: user._id });
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

      // Check hatch cost (if any)
      const hatchCost = this.calculateHatchCost(egg);
      if (user.coins < hatchCost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins to hatch. Cost: ${hatchCost}, You have: ${user.coins}`,
        });
      }

      // Use RNG service to generate pet from egg
      const pityCounter = user.petsHatched || 0;
      const petData = serverRNGService.generatePetForDB(user._id, pityCounter);

      // Create pet in database
      const Pet = (await import("../models/Pet.js")).default;
      const pet = new Pet(petData);
      await pet.save();

      // Update egg as hatched
      egg.isHatched = true;
      egg.hatchDate = new Date();
      await egg.save();

      // Update user using User model methods
      user.coins -= hatchCost;
      user.petsHatched += 1;
      user.ownedPets.push(pet._id);

      // Remove egg from user's owned eggs
      user.ownedEggs = user.ownedEggs.filter(
        (ownedEggId) => !ownedEggId.equals(egg._id)
      );

      // Add experience for hatching
      const expResult = user.addExperience(25); // 25 XP per hatch

      await user.save();

      logger.info(
        `User ${user.username} hatched egg ${eggId} into pet ${pet._id}`
      );

      const responseData = {
        success: true,
        message: "Egg hatched successfully!",
        data: {
          pet: {
            id: pet._id,
            name: pet.name,
            tier: pet.tier,
            type: pet.type,
            abilities: pet.abilities,
            stats: pet.stats,
            level: pet.level,
          },
          egg: {
            id: egg._id,
            isHatched: true,
            hatchDate: egg.hatchDate,
          },
          user: {
            coins: user.coins,
            petsHatched: user.petsHatched,
            ownedPets: user.ownedPets.length,
            ownedEggs: user.ownedEggs.length,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      };

      // Add level up notification if applicable
      if (expResult.leveledUp) {
        responseData.message += ` You leveled up to level ${expResult.newLevel}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
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
      const user = req.user;

      const catalog = {
        basic: {
          name: "Basic Egg",
          description: "A standard egg with common to rare pets",
          costs: {
            coins: 100,
            ETH: "0.001",
            MATIC: "0.1",
          },
          dropRates: serverRNGService.getEggDropRates("BASIC"),
          canPurchase: true,
          canAfford: user.coins >= 100,
        },
        premium: {
          name: "Premium Egg",
          description: "Higher chance for rare and epic pets",
          costs: {
            coins: 250,
            ETH: "0.005",
            MATIC: "0.5",
          },
          dropRates: serverRNGService.getEggDropRates("PREMIUM"),
          canPurchase: true,
          canAfford: user.coins >= 250,
        },
        cosmetic: {
          name: "Cosmetic Egg",
          description: "Special skins and animations for your eggs",
          costs: {
            coins: 150,
            ETH: "0.003",
            MATIC: "0.3",
          },
          dropRates: serverRNGService.getEggDropRates("COSMETIC"),
          canPurchase: true,
          canAfford: user.coins >= 150,
        },
        mystery: {
          name: "Mystery Egg",
          description: "Surprise egg with random contents",
          costs: {
            coins: 200,
            ETH: "0.004",
            MATIC: "0.4",
          },
          dropRates: serverRNGService.getEggDropRates("MYSTERY"),
          canPurchase: true,
          canAfford: user.coins >= 200,
        },
      };

      res.json({
        success: true,
        data: {
          catalog,
          user: {
            coins: user.coins,
            level: user.level,
            freeRolls: user.freeRolls,
            canClaimFreeEgg: user.canGetFreeRoll(),
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
      basic: { coins: 100, ETH: 0.001, MATIC: 0.1 },
      premium: { coins: 250, ETH: 0.005, MATIC: 0.5 },
      cosmetic: { coins: 150, ETH: 0.003, MATIC: 0.3 },
      mystery: { coins: 200, ETH: 0.004, MATIC: 0.4 },
    };

    return costs[eggType]?.[currency] || costs.basic.coins;
  },

  calculateHatchCost(egg) {
    const baseCost = 50;
    const multipliers = {
      basic: 1,
      premium: 1.2,
      cosmetic: 1.5,
      mystery: 1.3,
    };

    return Math.floor(baseCost * (multipliers[egg.eggType] || 1));
  },

  getHatchRequirements(egg) {
    return {
      cost: this.calculateHatchCost(egg),
      time: "Instant",
      level: "Any level",
    };
  },

  getPotentialPetsInfo(potentialPets) {
    const totalWeight = potentialPets.reduce((sum, pet) => sum + pet.weight, 0);
    return potentialPets.map((pet) => ({
      tier: pet.tier,
      type: pet.type || "Random",
      probability: ((pet.weight / totalWeight) * 100).toFixed(1) + "%",
      description: `Chance to get a ${pet.tier} ${pet.type || "random"} pet`,
    }));
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

  async getEggStats(userId) {
    const stats = await Egg.aggregate([
      { $match: { owner: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          hatched: { $sum: { $cond: ["$isHatched", 1, 0] } },
          byType: {
            $push: {
              type: "$eggType",
              hatched: { $cond: ["$isHatched", 1, 0] },
            },
          },
        },
      },
    ]);

    if (stats.length === 0) {
      return {
        total: 0,
        hatched: 0,
        unhatched: 0,
        byType: {},
      };
    }

    const stat = stats[0];
    const byType = {};

    stat.byType.forEach((item) => {
      if (!byType[item.type]) {
        byType[item.type] = { total: 0, hatched: 0 };
      }
      byType[item.type].total += 1;
      byType[item.type].hatched += item.hatched;
    });

    return {
      total: stat.total,
      hatched: stat.hatched,
      unhatched: stat.total - stat.hatched,
      byType,
    };
  },
};

export default EggController;
