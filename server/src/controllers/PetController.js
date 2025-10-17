import Pet from "../models/Pet.js";
import User from "../models/User.js";
import { serverRNGService } from "../services/RNGService.js";
import logger from "../utils/logger.js";

export const PetController = {
  // Get user's pets
  async getUserPets(req, res) {
    try {
      const { page = 1, limit = 20, tier, type, sortBy = "level" } = req.query;
      const user = await User.findById(req.user._id); // Get fresh instance

      const query = { owner: user._id };

      // Apply filters
      if (tier) query.tier = tier;
      if (type) query.type = type;

      // Sort options
      const sortOptions = {
        level: { level: -1, "stats.attack": -1 },
        attack: { "stats.attack": -1, level: -1 },
        defense: { "stats.defense": -1, level: -1 },
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        favorite: { isFavorite: -1, level: -1 },
      };

      const pets = await Pet.find(query)
        .sort(sortOptions[sortBy] || sortOptions.level)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select("-__v")
        .lean();

      const total = await Pet.countDocuments(query);

      // Calculate additional stats
      const petsWithStats = pets.map((pet) => ({
        ...pet,
        power: serverRNGService.calculatePetPower(pet),
        totalBattles: pet.battlesWon + pet.battlesLost,
        winRate:
          pet.battlesWon + pet.battlesLost > 0
            ? (
                (pet.battlesWon / (pet.battlesWon + pet.battlesLost)) *
                100
              ).toFixed(1)
            : 0,
      }));

      res.json({
        success: true,
        data: {
          pets: petsWithStats,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          stats: {
            totalPets: total,
            byTier: await this.getPetsByTier(user._id),
            byType: await this.getPetsByType(user._id),
            userStats: {
              totalPets: user.ownedPets.length,
              level: user.level,
              experience: user.experience,
              coins: user.coins,
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
      const user = await User.findById(req.user._id); // Get fresh instance

      const pet = await Pet.findOne({ _id: petId, owner: user._id })
        .populate("owner", "username level")
        .lean();

      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      // Calculate additional stats
      const totalBattles = pet.battlesWon + pet.battlesLost;
      const enhancedPet = {
        ...pet,
        power: serverRNGService.calculatePetPower(pet),
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
        upgradeCost: this.calculateUpgradeCost(pet.level),
      };

      res.json({
        success: true,
        data: {
          pet: enhancedPet,
          user: {
            coins: user.coins,
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

  // Upgrade pet level
  async upgradePet(req, res) {
    try {
      const { petId } = req.params;
      const user = await User.findById(req.user._id); // Get fresh instance

      const pet = await Pet.findOne({ _id: petId, owner: user._id });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      // Calculate upgrade cost
      const upgradeCost = this.calculateUpgradeCost(pet.level);
      if (user.coins < upgradeCost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Upgrade cost: ${upgradeCost}, You have: ${user.coins}`,
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

      // Perform upgrade
      const oldLevel = pet.level;
      pet.level += 1;
      pet.experience -= expNeeded;

      // Improve stats on level up
      const statIncrease = this.calculateStatIncrease(pet.tier, oldLevel);
      pet.stats.attack = Math.floor(pet.stats.attack * (1 + statIncrease));
      pet.stats.defense = Math.floor(pet.stats.defense * (1 + statIncrease));
      pet.stats.speed = Math.floor(pet.stats.speed * (1 + statIncrease * 0.8));
      pet.stats.health = Math.floor(
        pet.stats.health * (1 + statIncrease * 1.2)
      );

      // Update user using User model methods
      user.coins -= upgradeCost;
      const expResult = user.addExperience(15); // 15 XP for upgrading pet

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
            power: serverRNGService.calculatePetPower(pet),
          },
          user: {
            coins: user.coins,
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
      const user = await User.findById(req.user._id); // Get fresh instance

      const pet = await Pet.findOne({ _id: petId, owner: user._id });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      // Calculate training cost and experience
      const trainingData = this.calculateTrainingData(trainingType);
      if (user.coins < trainingData.cost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Training cost: ${trainingData.cost}, You have: ${user.coins}`,
        });
      }

      // Perform training
      pet.experience += trainingData.experience;
      user.coins -= trainingData.cost;

      // Add user experience for training
      const expResult = user.addExperience(trainingData.userExperience);

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
            coins: user.coins,
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
      const { petIds, targetTier } = req.body;
      const user = await User.findById(req.user._id); // Get fresh instance

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
        owner: user._id,
      });

      if (materialPets.length !== petIds.length) {
        return res.status(400).json({
          success: false,
          message: "Some pets not found or not owned by you",
        });
      }

      // Calculate fusion requirements
      const fusionData = this.calculateFusionData(materialPets, targetTier);

      if (!fusionData.canFuse) {
        return res.status(400).json({
          success: false,
          message: fusionData.message || "Selected pets cannot be fused",
        });
      }

      // Check if user can afford fusion
      if (user.coins < fusionData.cost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Fusion cost: ${fusionData.cost}, You have: ${user.coins}`,
        });
      }

      // Determine fusion success
      const isSuccessful = Math.random() < fusionData.successChance;

      if (!isSuccessful) {
        // Failed fusion - lose material pets but get some consolation
        await Pet.deleteMany({ _id: { $in: petIds } });
        user.coins -= fusionData.cost;

        // Remove pets from user's collection
        user.ownedPets = user.ownedPets.filter(
          (petId) => !petIds.includes(petId.toString())
        );

        // Add consolation experience
        const expResult = user.addExperience(fusionData.consolationExp);

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
              coins: user.coins,
              level: user.level,
              experience: user.experience,
            },
          },
        };

        if (expResult.leveledUp) {
          responseData.data.user.leveledUp = true;
          responseData.data.user.newLevel = expResult.newLevel;
        }

        return res.json(responseData);
      }

      // Successful fusion - create new pet
      const newPetData = serverRNGService.generatePetForDB(
        user._id,
        user.petsHatched
      );
      newPetData.tier = targetTier;

      // Enhance stats based on material pets
      const avgLevel =
        materialPets.reduce((sum, pet) => sum + pet.level, 0) /
        materialPets.length;
      newPetData.level = Math.max(1, Math.floor(avgLevel * 0.8));

      // Boost stats based on material pet quality
      const qualityMultiplier = this.calculateQualityMultiplier(materialPets);
      Object.keys(newPetData.stats).forEach((stat) => {
        newPetData.stats[stat] = Math.floor(
          newPetData.stats[stat] * qualityMultiplier
        );
      });

      // Create new pet
      const newPet = new Pet({
        ...newPetData,
        name: `Fused ${newPetData.type} ${newPetData.tier}`,
      });

      await newPet.save();

      // Remove material pets and update user
      await Pet.deleteMany({ _id: { $in: petIds } });
      user.coins -= fusionData.cost;
      user.ownedPets = user.ownedPets.filter(
        (petId) => !petIds.includes(petId.toString())
      );
      user.ownedPets.push(newPet._id);

      // Add fusion experience
      const expResult = user.addExperience(fusionData.successExp);

      await user.save();

      logger.info(
        `User ${user.username} successfully fused ${petIds.length} pets into a ${targetTier} pet`
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
          newPet: {
            id: newPet._id,
            name: newPet.name,
            tier: newPet.tier,
            type: newPet.type,
            level: newPet.level,
            stats: newPet.stats,
            abilities: newPet.abilities,
            power: serverRNGService.calculatePetPower(newPet),
          },
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            ownedPets: user.ownedPets.length,
          },
        },
      };

      if (expResult.leveledUp) {
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
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
      const user = await User.findById(req.user._id); // Get fresh instance

      const pet = await Pet.findOne({ _id: petId, owner: user._id });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      pet.isFavorite = !pet.isFavorite;
      await pet.save();

      res.json({
        success: true,
        message: `Pet ${
          pet.isFavorite ? "added to" : "removed from"
        } favorites`,
        data: {
          pet: {
            id: pet._id,
            name: pet.name,
            isFavorite: pet.isFavorite,
          },
          user: {
            favoritePets: await Pet.countDocuments({
              owner: user._id,
              isFavorite: true,
            }),
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
      const user = await User.findById(req.user._id);

      const calculator = {
        requirements: {
          common: { minPets: 3, minLevel: 5, cost: 500 },
          uncommon: { minPets: 3, minLevel: 10, cost: 1000 },
          rare: { minPets: 4, minLevel: 15, cost: 2000 },
          epic: { minPets: 4, minLevel: 20, cost: 5000 },
          legendary: { minPets: 5, minLevel: 25, cost: 10000 },
          Mythic: { minPets: 5, minLevel: 30, cost: 12000 },
          Celestial: { minPets: 6, minLevel: 35, cost: 15000 },
          Exotic: { minPets: 6, minLevel: 40, cost: 20000 },
          Ultimate: { minPets: 7, minLevel: 45, cost: 22000 },
          Godly: { minPets: 7, minLevel: 50, cost: 25000 },
        },
        successRates: {
          Common: 0.6,
          Uncommon: 0.2,
          Rare: 0.1,
          Epic: 0.04,
          Legendary: 0.02,
          Mythic: 0.01,
          Celestial: 0.005,
          Exotic: 0.0025,
          Ultimate: 0.0015,
          Godly: 0.001,
        },
        userStats: {
          coins: user.coins,
          totalPets: user.ownedPets.length,
          maxPetLevel: await this.getMaxPetLevel(user._id),
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

  // Helper methods
  calculateUpgradeCost(level) {
    return level * 75; // 75 coins per level
  },

  calculateStatIncrease(tier, level) {
    const baseIncrease = 0.08; // 8% base
    const tierMultipliers = {
      Common: 1.0,
      Uncommon: 1.15,
      Rare: 1.3,
      Epic: 1.6,
      Legendary: 2.0,
      Mythic: 2.4,
      Celestial: 2.8,
      Exotic: 3.2,
      Ultimate: 3.8,
      Godly: 4.5,
    };
    const levelBonus = Math.min(level * 0.005, 0.1); // Up to 10% bonus from level

    return baseIncrease * (tierMultipliers[tier] || 1) + levelBonus;
  },

  calculateTrainingData(trainingType) {
    const trainingTypes = {
      basic: { cost: 50, experience: 25, userExperience: 5 },
      advanced: { cost: 100, experience: 60, userExperience: 10 },
      elite: { cost: 200, experience: 150, userExperience: 20 },
    };
    return trainingTypes[trainingType] || trainingTypes.basic;
  },

  calculateFusionData(materialPets, targetTier) {
    const tierRequirements = {
      uncommon: { minPets: 3, minLevel: 5, baseCost: 500 },
      rare: { minPets: 3, minLevel: 10, baseCost: 1000 },
      epic: { minPets: 4, minLevel: 15, baseCost: 2000 },
      legendary: { minPets: 5, minLevel: 20, baseCost: 5000 },
    };

    const requirement = tierRequirements[targetTier];
    if (!requirement) {
      return { canFuse: false, message: "Invalid target tier" };
    }

    // Check basic requirements
    if (materialPets.length < requirement.minPets) {
      return {
        canFuse: false,
        message: `Need at least ${requirement.minPets} pets for ${targetTier} fusion`,
      };
    }

    const avgLevel =
      materialPets.reduce((sum, pet) => sum + pet.level, 0) /
      materialPets.length;
    if (avgLevel < requirement.minLevel) {
      return {
        canFuse: false,
        message: `Average pet level must be at least ${requirement.minLevel} for ${targetTier} fusion`,
      };
    }

    // Calculate success chance based on pet quality
    const totalValue = materialPets.reduce((sum, pet) => {
      const tierValues = {
        Common: 1.0,
        Uncommon: 1.15,
        Rare: 1.3,
        Epic: 1.6,
        Legendary: 2.0,
        Mythic: 2.4,
        Celestial: 2.8,
        Exotic: 3.2,
        Ultimate: 3.8,
        Godly: 4.5,
      };
      return sum + (tierValues[pet.tier] || 1) * pet.level;
    }, 0);

    const baseSuccessRate =
      {
        Common: 0.6,
        Uncommon: 0.2,
        Rare: 0.1,
        Epic: 0.04,
        Legendary: 0.02,
        Mythic: 0.01,
        Celestial: 0.005,
        Exotic: 0.0025,
        Ultimate: 0.0015,
        Godly: 0.001,
      }[targetTier] || 0.5;

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

  calculateQualityMultiplier(materialPets) {
    const totalValue = materialPets.reduce((sum, pet) => {
      const tierValues = {
        Common: 1.0,
        Uncommon: 1.15,
        Rare: 1.3,
        Epic: 1.6,
        Legendary: 2.0,
        Mythic: 2.4,
        Celestial: 2.8,
        Exotic: 3.2,
        Ultimate: 3.8,
        Godly: 4.5,
      };
      return sum + (tierValues[pet.tier] || 1);
    }, 0);

    return 1 + (totalValue / materialPets.length - 1) * 0.3;
  },

  async getMaxPetLevel(userId) {
    const maxLevelPet = await Pet.findOne({ owner: userId }).sort({
      level: -1,
    });
    return maxLevelPet ? maxLevelPet.level : 0;
  },

  async getPetsByTier(userId) {
    const result = await Pet.aggregate([
      { $match: { owner: userId } },
      { $group: { _id: "$tier", count: { $sum: 1 } } },
    ]);

    const tiers = {};
    result.forEach((item) => {
      tiers[item._id] = item.count;
    });
    return tiers;
  },

  async getPetsByType(userId) {
    const result = await Pet.aggregate([
      { $match: { owner: userId } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    const types = {};
    result.forEach((item) => {
      types[item._id] = item.count;
    });
    return types;
  },
};

export default PetController;
