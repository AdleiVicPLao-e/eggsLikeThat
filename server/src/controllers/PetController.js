import Pet from "../models/Pet.js";
import User from "../models/User.js";
import { rngService } from "../services/RNGService.js";
import logger from "../utils/logger.js";

export const PetController = {
  // Get user's pets
  async getUserPets(req, res) {
    try {
      const { page = 1, limit = 20, tier, type, sortBy = "level" } = req.query;
      const user = req.user;

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
        power: rngService.calculatePetPower(pet),
        totalBattles: pet.battlesWon + pet.battlesLost,
        winRate:
          pet.totalBattles > 0
            ? ((pet.battlesWon / pet.totalBattles) * 100).toFixed(1)
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
      const user = req.user;

      const pet = await Pet.findOne({ _id: petId, owner: user._id })
        .populate("owner", "username")
        .lean();

      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      // Calculate additional stats
      const enhancedPet = {
        ...pet,
        power: rngService.calculatePetPower(pet),
        totalBattles: pet.battlesWon + pet.battlesLost,
        winRate:
          pet.totalBattles > 0
            ? ((pet.battlesWon / pet.totalBattles) * 100).toFixed(1)
            : 0,
        nextLevelExp: Math.pow(pet.level, 2) * 100,
      };

      res.json({
        success: true,
        data: { pet: enhancedPet },
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
      const user = req.user;

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
          message: `Not enough coins. Upgrade cost: ${upgradeCost}`,
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
      pet.level += 1;
      pet.experience -= expNeeded;

      // Improve stats on level up
      const statIncrease = 0.1; // 10% increase
      pet.stats.attack = Math.floor(pet.stats.attack * (1 + statIncrease));
      pet.stats.defense = Math.floor(pet.stats.defense * (1 + statIncrease));
      pet.stats.speed = Math.floor(pet.stats.speed * (1 + statIncrease));
      pet.stats.health = Math.floor(pet.stats.health * (1 + statIncrease));

      // Deduct coins
      user.coins -= upgradeCost;

      await pet.save();
      await user.save();

      logger.info(
        `User ${user.username} upgraded pet ${pet.name} to level ${pet.level}`
      );

      res.json({
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
          },
          user: {
            coins: user.coins,
          },
        },
      });
    } catch (error) {
      logger.error("Upgrade pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during pet upgrade",
      });
    }
  },

  // Fuse multiple pets to create a new one
  async fusePets(req, res) {
    try {
      const { petIds, targetTier } = req.body;
      const user = req.user;

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
      const fusionData = rngService.calculateFusionRewards(
        materialPets,
        targetTier
      );

      if (!fusionData.canFuse) {
        return res.status(400).json({
          success: false,
          message: "Selected pets are not valuable enough for this fusion",
        });
      }

      // Check if user can afford fusion
      if (user.coins < fusionData.cost) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins. Fusion cost: ${fusionData.cost}`,
        });
      }

      // Determine fusion success
      const isSuccessful = Math.random() < fusionData.successChance;

      if (!isSuccessful) {
        // Failed fusion - lose material pets but get some consolation
        await Pet.deleteMany({ _id: { $in: petIds } });
        user.coins -= fusionData.cost;

        // Add material pets back to user's collection as consolation
        user.ownedPets = user.ownedPets.filter(
          (petId) => !petIds.includes(petId.toString())
        );

        await user.save();

        return res.json({
          success: true,
          message: "Fusion failed! The pets were consumed in the process.",
          data: {
            fusion: {
              successful: false,
              cost: fusionData.cost,
              successChance: fusionData.successChance,
            },
            user: {
              coins: user.coins,
            },
          },
        });
      }

      // Successful fusion - create new pet
      const newPetData = rngService.generatePet();
      newPetData.tier = targetTier;

      // Enhance stats based on material pets
      const avgLevel =
        materialPets.reduce((sum, pet) => sum + pet.level, 0) /
        materialPets.length;
      newPetData.level = Math.max(1, Math.floor(avgLevel * 0.8));

      // Create new pet
      const newPet = new Pet({
        ...newPetData,
        owner: user._id,
        name: `Fused ${newPetData.name}`,
      });

      await newPet.save();

      // Remove material pets and update user
      await Pet.deleteMany({ _id: { $in: petIds } });
      user.coins -= fusionData.cost;
      user.ownedPets = user.ownedPets.filter(
        (petId) => !petIds.includes(petId.toString())
      );
      user.ownedPets.push(newPet._id);

      await user.save();

      logger.info(
        `User ${user.username} successfully fused ${petIds.length} pets into a ${targetTier} pet`
      );

      res.json({
        success: true,
        message: "Fusion successful! A new powerful pet has been created!",
        data: {
          fusion: {
            successful: true,
            cost: fusionData.cost,
            successChance: fusionData.successChance,
          },
          newPet: {
            id: newPet._id,
            name: newPet.name,
            tier: newPet.tier,
            type: newPet.type,
            level: newPet.level,
            stats: newPet.stats,
            abilities: newPet.abilities,
          },
          user: {
            coins: user.coins,
          },
        },
      });
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
      const user = req.user;

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

  // Helper methods
  calculateUpgradeCost(level) {
    return level * 50; // 50 coins per level
  },

  async getPetsByTier(userId) {
    return Pet.aggregate([
      { $match: { owner: userId } },
      { $group: { _id: "$tier", count: { $sum: 1 } } },
    ]);
  },

  async getPetsByType(userId) {
    return Pet.aggregate([
      { $match: { owner: userId } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);
  },
};
