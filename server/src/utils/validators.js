import User from "../models/User.js";
import Pet from "../models/Pet.js";
import Egg from "../models/Egg.js";
import { serverRNGService } from "../services/RNGService.js";
import { rewardService } from "../services/RewardService.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";

export const GameController = {
  // Hatch an egg using shared RNG
  async hatchEgg(req, res) {
    try {
      const user = req.user;
      const { eggId, useFreeRoll = false } = req.body;

      // Check if using free roll or has enough coins
      if (useFreeRoll) {
        if (!user.canGetFreeRoll()) {
          return res.status(400).json({
            success: false,
            message: "No free rolls available. Please wait or use coins.",
          });
        }
      } else {
        const hatchCost = 100;
        if (user.coins < hatchCost) {
          return res.status(400).json({
            success: false,
            message: "Not enough coins to hatch egg",
          });
        }
      }

      let egg;
      if (eggId) {
        // Hatch specific egg
        egg = await Egg.findOne({
          _id: eggId,
          owner: user._id,
          isHatched: false,
        });
        if (!egg) {
          return res.status(404).json({
            success: false,
            message: "Egg not found or already hatched",
          });
        }
      } else {
        // Create and hatch a basic egg using shared RNG
        egg = await Egg.create(
          serverRNGService.generateEggForDB(user._id, "BASIC")
        );
      }

      // Generate pet using shared RNG service
      const pityCounter = user.petsHatched || 0;
      const petData = serverRNGService.generatePetForDB(user._id, pityCounter);

      // Create pet in database
      const pet = new Pet(petData);
      await pet.save();

      // Update egg status
      egg.isHatched = true;
      egg.hatchDate = new Date();
      await egg.save();

      // Update user
      if (useFreeRoll) {
        user.freeRolls -= 1;
        user.lastFreeRoll = new Date();
      } else {
        user.coins -= 100;
      }

      user.petsHatched += 1;
      user.ownedPets.push(pet._id);
      await user.save();

      logger.info(
        `User ${user.username} hatched a ${pet.tier} ${pet.type} pet`
      );

      res.json({
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
          user: {
            coins: user.coins,
            freeRolls: user.freeRolls,
            petsHatched: user.petsHatched,
          },
        },
      });
    } catch (error) {
      logger.error("Hatch egg error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during egg hatching",
      });
    }
  },

  // Start a battle using shared RNG
  async startBattle(req, res) {
    try {
      const user = req.user;
      const {
        petIds,
        battleMode = "pve",
        opponentDifficulty = "medium",
      } = req.body;

      // Validate user's pets
      const userPets = await Pet.find({
        _id: { $in: petIds },
        owner: user._id,
      });

      if (userPets.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid pets selected for battle",
        });
      }

      // Generate opponent using shared RNG
      let opponentPets;
      if (battleMode === "pve") {
        opponentPets = await this.generateOpponentPets(
          opponentDifficulty,
          userPets
        );
      } else {
        opponentPets = await this.generateOpponentPets("medium", userPets);
      }

      // Simulate battle using shared RNG
      const battleResult = serverRNGService.calculateBattleOutcome(
        userPets[0],
        opponentPets[0]
      );

      // Calculate rewards using shared service
      const rewards = serverRNGService.calculateBattleRewardsForDB(
        battleResult,
        user.level,
        opponentDifficulty === "easy"
          ? user.level - 1
          : opponentDifficulty === "medium"
          ? user.level
          : opponentDifficulty === "hard"
          ? user.level + 1
          : user.level + 2
      );

      // Apply rewards
      const rewardResult = await rewardService.applyRewards(user._id, rewards);

      // Update battle stats
      if (battleResult.winner === "player") {
        user.battlesWon += 1;
        userPets.forEach((pet) => {
          pet.battlesWon += 1;
          pet.experience += rewards.experience / userPets.length;
        });
      } else {
        user.battlesLost += 1;
        userPets.forEach((pet) => {
          pet.battlesLost += 1;
          pet.experience += (rewards.experience / userPets.length) * 0.5;
        });
      }

      await user.save();
      await Promise.all(userPets.map((pet) => pet.save()));

      logger.info(
        `Battle completed for user ${user.username}: ${battleResult.winner}`
      );

      res.json({
        success: true,
        data: {
          battle: {
            result: battleResult,
            userPets: userPets.map((pet) => ({
              id: pet._id,
              name: pet.name,
              stats: pet.stats,
              level: pet.level,
            })),
            opponentPets: opponentPets.map((pet) => ({
              name: pet.name,
              stats: pet.stats,
              level: pet.level,
            })),
          },
          rewards: {
            ...rewards,
            leveledUp: rewardResult.leveledUp,
            newLevel: rewardResult.newLevel,
          },
          user: {
            coins: user.coins,
            experience: user.experience,
            level: user.level,
            battlesWon: user.battlesWon,
            battlesLost: user.battlesLost,
          },
        },
      });
    } catch (error) {
      logger.error("Battle error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during battle",
      });
    }
  },

  // Helper methods using shared RNG
  async generateOpponentPets(difficulty, userPets) {
    const difficulties = {
      easy: {
        levelMultiplier: 0.8,
        tierWeights: { common: 60, uncommon: 30, rare: 10 },
      },
      medium: {
        levelMultiplier: 1.0,
        tierWeights: { common: 40, uncommon: 40, rare: 15, epic: 5 },
      },
      hard: {
        levelMultiplier: 1.2,
        tierWeights: {
          common: 20,
          uncommon: 40,
          rare: 25,
          epic: 10,
          legendary: 5,
        },
      },
    };

    const config = difficulties[difficulty] || difficulties.medium;
    const opponentPets = [];

    // Generate 1-3 opponent pets
    const petCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < petCount; i++) {
      const petData = serverRNGService.generatePet();
      const avgUserLevel =
        userPets.reduce((sum, pet) => sum + pet.level, 0) / userPets.length;

      opponentPets.push({
        name: petData.name,
        tier: petData.tier,
        type: petData.type,
        abilities: petData.abilities,
        stats: petData.stats,
        level: Math.max(1, Math.round(avgUserLevel * config.levelMultiplier)),
      });
    }

    return opponentPets;
  },
};
