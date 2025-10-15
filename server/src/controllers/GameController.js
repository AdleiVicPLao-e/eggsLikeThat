import User from "../models/User.js";
import Pet from "../models/Pet.js";
import Egg from "../models/Egg.js";
import { rngService } from "../services/RNGService.js";
import { rewardService } from "../services/RewardService.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";

export const GameController = {
  // Hatch an egg
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
        // Create and hatch a basic egg
        egg = await Egg.createBasicEgg(user._id);
      }

      // Generate pet using RNG service
      const pityCounter = user.petsHatched || 0;
      const petData = rngService.generatePet(pityCounter);

      // Create pet in database
      const pet = new Pet({
        ...petData,
        owner: user._id,
      });

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

  // Start a battle
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

      // Generate opponent based on battle mode and difficulty
      let opponentPets;
      if (battleMode === "pve") {
        opponentPets = await this.generateOpponentPets(
          opponentDifficulty,
          userPets
        );
      } else {
        // For PvP, you might match with another player's pets
        // This is a simplified version - in reality, you'd have a matchmaking system
        opponentPets = await this.generateOpponentPets("medium", userPets);
      }

      // Simulate battle
      const battleResult = this.simulateBattle(userPets, opponentPets);

      // Calculate rewards
      const rewards = rewardService.calculateBattleRewards(
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

      // Send battle results email
      if (user.email) {
        await mailService.sendBattleResults(user, battleResult, rewards);
      }

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

  // Complete a quest
  async completeQuest(req, res) {
    try {
      const user = req.user;
      const { questId } = req.body;

      // In a real implementation, you'd have a Quest model
      // For now, we'll simulate quest completion
      const quest = this.getQuestById(questId);
      if (!quest) {
        return res.status(404).json({
          success: false,
          message: "Quest not found",
        });
      }

      // Calculate rewards
      const rewards = rewardService.calculateQuestRewards(
        quest.difficulty,
        user.level
      );

      // Apply rewards
      const rewardResult = await rewardService.applyRewards(user._id, rewards);

      // Add quest completion to user record
      // You might want to add a completedQuests field to User model
      user.experience += rewards.experience;
      const levelUp = user.addExperience(rewards.experience);

      await user.save();

      logger.info(`User ${user.username} completed quest ${questId}`);

      res.json({
        success: true,
        data: {
          quest: {
            id: questId,
            name: quest.name,
            difficulty: quest.difficulty,
          },
          rewards,
          user: {
            coins: user.coins,
            experience: user.experience,
            level: user.level,
            leveledUp: levelUp.leveledUp,
            newLevel: levelUp.newLevel,
          },
        },
      });
    } catch (error) {
      logger.error("Quest completion error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during quest completion",
      });
    }
  },

  // Claim daily reward
  async claimDailyReward(req, res) {
    try {
      const user = req.user;

      // Check if user can claim daily reward
      const lastClaim = user.lastDailyClaim || new Date(0);
      const now = new Date();
      const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);

      if (hoursSinceLastClaim < 20) {
        // 20 hour cooldown
        const hoursRemaining = Math.ceil(20 - hoursSinceLastClaim);
        return res.status(400).json({
          success: false,
          message: `Please wait ${hoursRemaining} more hours to claim your next daily reward`,
        });
      }

      // Calculate consecutive days
      const consecutiveDays = user.consecutiveDays || 1;
      const rewards = rewardService.getDailyReward(consecutiveDays);

      // Apply rewards
      await rewardService.applyRewards(user._id, rewards);

      // Update user
      user.lastDailyClaim = now;
      user.consecutiveDays = hoursSinceLastClaim < 48 ? consecutiveDays + 1 : 1;
      user.freeRolls += rewards.freeRolls;

      await user.save();

      logger.info(
        `User ${user.username} claimed daily reward (day ${consecutiveDays})`
      );

      res.json({
        success: true,
        data: {
          rewards,
          consecutiveDays: user.consecutiveDays,
          user: {
            coins: user.coins,
            freeRolls: user.freeRolls,
            experience: user.experience,
            level: user.level,
          },
        },
      });
    } catch (error) {
      logger.error("Daily reward claim error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during daily reward claim",
      });
    }
  },

  // Helper methods
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
      const petData = rngService.generatePet();
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

  simulateBattle(userPets, opponentPets) {
    // Simple battle simulation - in reality, this would be more complex
    let playerPower = 0;
    let opponentPower = 0;

    userPets.forEach((pet) => {
      playerPower += rngService.calculatePetPower(pet);
    });

    opponentPets.forEach((pet) => {
      opponentPower += rngService.calculatePetPower(pet);
    });

    // Add some randomness
    playerPower *= 0.8 + Math.random() * 0.4;
    opponentPower *= 0.8 + Math.random() * 0.4;

    return {
      winner: playerPower > opponentPower ? "player" : "opponent",
      playerPower: Math.round(playerPower),
      opponentPower: Math.round(opponentPower),
      margin:
        Math.abs(playerPower - opponentPower) /
        Math.max(playerPower, opponentPower),
    };
  },

  getQuestById(questId) {
    // Mock quest data - in reality, this would come from a database
    const quests = {
      beginner_battle: { name: "First Battle", difficulty: "easy" },
      hatch_3_pets: { name: "Pet Collector", difficulty: "easy" },
      win_5_battles: { name: "Battle Veteran", difficulty: "medium" },
      fuse_pets: { name: "Fusion Master", difficulty: "hard" },
      legendary_hatch: { name: "Legendary Hunter", difficulty: "epic" },
    };

    return quests[questId];
  },
};
