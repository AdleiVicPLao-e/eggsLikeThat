import Egg from "../models/Egg.js";
import User from "../models/User.js";
import { rngService } from "../services/RNGService.js";
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
        .populate("owner", "username")
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
      const user = req.user;

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
          message: `Not enough coins. Cost: ${cost}`,
        });
      }

      // For real currency purchases, you'd integrate with a payment processor
      if (currency !== "coins") {
        // This is where you'd integrate with Stripe, PayPal, or blockchain payments
        // For now, we'll simulate the purchase
        logger.info(
          `Processing ${currency} purchase for ${eggType} egg by user ${user.username}`
        );
      }

      // Create the egg
      const eggData = this.generateEggData(eggType);
      const egg = new Egg({
        ...eggData,
        owner: user._id,
        purchased: true,
        purchasePrice: cost,
        currency,
      });

      await egg.save();

      // Update user
      if (currency === "coins") {
        user.coins -= cost;
      }
      user.ownedEggs.push(egg._id);
      await user.save();

      logger.info(
        `User ${user.username} purchased a ${eggType} egg for ${cost} ${currency}`
      );

      res.status(201).json({
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
          },
        },
      });
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
      const user = req.user;

      // Check if user can claim free egg
      const lastFreeEgg = user.lastFreeEgg || new Date(0);
      const now = new Date();
      const hoursSinceLastFreeEgg = (now - lastFreeEgg) / (1000 * 60 * 60);

      if (hoursSinceLastFreeEgg < 24) {
        const hoursRemaining = Math.ceil(24 - hoursSinceLastFreeEgg);
        return res.status(400).json({
          success: false,
          message: `Please wait ${hoursRemaining} more hours to claim your next free egg`,
        });
      }

      // Create free basic egg
      const egg = await Egg.createBasicEgg(user._id);

      // Update user
      user.lastFreeEgg = now;
      user.ownedEggs.push(egg._id);
      await user.save();

      logger.info(`User ${user.username} claimed free daily egg`);

      res.json({
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
            lastFreeEgg: user.lastFreeEgg,
          },
        },
      });
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

      // Generate preview of potential pets (without saving)
      const previewPets = egg.potentialPets.map((pet) => ({
        tier: pet.tier,
        type: this.getRandomType(),
        probability:
          (
            (pet.weight /
              egg.potentialPets.reduce((sum, p) => sum + p.weight, 0)) *
            100
          ).toFixed(1) + "%",
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

  // Get available egg types and their costs
  async getEggCatalog(req, res) {
    try {
      const catalog = {
        basic: {
          name: "Basic Egg",
          description: "A standard egg with common to rare pets",
          costs: {
            coins: 100,
            ETH: "0.001",
            MATIC: "0.1",
          },
          dropRates: {
            common: "50%",
            uncommon: "30%",
            rare: "15%",
            epic: "4%",
            legendary: "1%",
          },
          canPurchase: true,
        },
        premium: {
          name: "Premium Egg",
          description: "Higher chance for rare and epic pets",
          costs: {
            coins: 250,
            ETH: "0.005",
            MATIC: "0.5",
          },
          dropRates: {
            common: "30%",
            uncommon: "40%",
            rare: "20%",
            epic: "8%",
            legendary: "2%",
          },
          canPurchase: true,
        },
        cosmetic: {
          name: "Cosmetic Egg",
          description: "Special skins and animations for your eggs",
          costs: {
            coins: 150,
            ETH: "0.003",
            MATIC: "0.3",
          },
          dropRates: {
            common_skin: "60%",
            rare_skin: "30%",
            epic_animation: "8%",
            legendary_effect: "2%",
          },
          canPurchase: true,
        },
        mystery: {
          name: "Mystery Egg",
          description: "Surprise egg with random contents",
          costs: {
            coins: 200,
            ETH: "0.004",
            MATIC: "0.4",
          },
          dropRates: {
            random: "100%",
          },
          canPurchase: true,
        },
      };

      res.json({
        success: true,
        data: { catalog },
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

  generateEggData(eggType) {
    const baseData = {
      eggType,
      rarity: "common",
      potentialPets: [
        { tier: "common", type: "Fire", weight: 50 },
        { tier: "common", type: "Water", weight: 50 },
        { tier: "uncommon", type: "Earth", weight: 30 },
        { tier: "rare", type: "Air", weight: 15 },
        { tier: "epic", type: "Light", weight: 4 },
        { tier: "legendary", type: "Dark", weight: 1 },
      ],
    };

    // Enhance based on egg type
    switch (eggType) {
      case "premium":
        baseData.rarity = "uncommon";
        baseData.potentialPets.forEach((pet) => {
          if (pet.tier === "rare") pet.weight = 25;
          if (pet.tier === "epic") pet.weight = 8;
          if (pet.tier === "legendary") pet.weight = 2;
        });
        break;

      case "cosmetic":
        baseData.rarity = "rare";
        baseData.skin = "premium";
        baseData.animation = "sparkle";
        break;

      case "mystery":
        baseData.rarity = Math.random() < 0.1 ? "epic" : "rare";
        break;
    }

    return baseData;
  },

  calculateHatchCost(egg) {
    // Different eggs might have different hatch costs
    const baseCost = 100;
    const multipliers = {
      basic: 1,
      premium: 1.5,
      cosmetic: 2,
      mystery: 1.8,
    };

    return Math.floor(baseCost * (multipliers[egg.eggType] || 1));
  },

  getHatchRequirements(egg) {
    return {
      cost: this.calculateHatchCost(egg),
      time: "Instant", // Could be timed hatches in the future
      level: "Any level",
    };
  },

  getPotentialPetsInfo(potentialPets) {
    const totalWeight = potentialPets.reduce((sum, pet) => sum + pet.weight, 0);
    return potentialPets.map((pet) => ({
      tier: pet.tier,
      probability: ((pet.weight / totalWeight) * 100).toFixed(1) + "%",
      description: `Chance to get a ${pet.tier} pet`,
    }));
  },

  calculateHatchTime(createdAt) {
    // For future timed hatches
    const hatchDuration = 24 * 60 * 60 * 1000; // 24 hours
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

  getRandomType() {
    const types = ["Fire", "Water", "Earth", "Air", "Light", "Dark"];
    return types[Math.floor(Math.random() * types.length)];
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
