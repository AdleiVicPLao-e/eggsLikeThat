import User from "../models/User.js";
import Pet from "../models/Pet.js";
import Egg from "../models/Egg.js";
import { serverRNGService } from "../services/RNGService.js";
import { rewardService } from "../services/RewardService.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";

export const GameController = {
  // Hatch an egg
  async hatchEgg(req, res) {
    try {
      const user = await User.findById(req.user._id); // Get fresh instance
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
            message: `Not enough coins to hatch egg. Cost: ${hatchCost}, You have: ${user.coins}`,
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

      // Generate pet using RNG service with pity counter
      const pityCounter = user.petsHatched || 0;
      const petData = serverRNGService.generatePetForDB(user._id, pityCounter);

      // Create pet in database
      const pet = new Pet(petData);
      await pet.save();

      // Update egg status
      egg.isHatched = true;
      egg.hatchDate = new Date();
      await egg.save();

      // Update user using User model methods
      if (useFreeRoll) {
        user.freeRolls = Math.max(0, user.freeRolls - 1);
        user.lastFreeRoll = new Date();
      } else {
        user.coins -= 100;
      }

      user.petsHatched += 1;
      user.ownedPets.push(pet._id);

      // Remove egg from user's inventory if it was a specific egg
      if (eggId) {
        user.ownedEggs = user.ownedEggs.filter(
          (ownedEggId) => !ownedEggId.equals(egg._id)
        );
      }

      // Add experience for hatching
      const expResult = user.addExperience(25); // 25 XP per hatch

      await user.save();

      logger.info(
        `User ${user.username} hatched a ${pet.tier} ${pet.type} pet`
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
          user: {
            coins: user.coins,
            freeRolls: user.freeRolls,
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

  // Start a battle
  async startBattle(req, res) {
    try {
      const user = await User.findById(req.user._id); // Get fresh instance
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
        opponentPets = await this.generateOpponentPets("medium", userPets);
      }

      // Simulate battle
      const battleResult = this.simulateBattle(userPets, opponentPets);

      // Calculate rewards
      const opponentLevel = this.getOpponentLevel(
        opponentDifficulty,
        user.level
      );
      const rewards = rewardService.calculateBattleRewards(
        battleResult,
        user.level,
        opponentLevel
      );

      // Apply rewards using User model methods
      let expResult;
      if (battleResult.winner === "player") {
        user.battlesWon += 1;
        expResult = user.addExperience(rewards.experience);

        // Update pet battle stats and experience
        userPets.forEach((pet) => {
          pet.battlesWon += 1;
          pet.experience += rewards.experience / userPets.length;
        });
      } else {
        user.battlesLost += 1;
        expResult = user.addExperience(rewards.experience * 0.5); // Half XP for loss

        userPets.forEach((pet) => {
          pet.battlesLost += 1;
          pet.experience += (rewards.experience / userPets.length) * 0.25; // Quarter XP for loss
        });
      }

      // Update coins
      user.coins += rewards.coins;

      await user.save();
      await Promise.all(userPets.map((pet) => pet.save()));

      // Check for pet level ups
      const petLevelUps = [];
      for (const pet of userPets) {
        const levelUpResult = await this.checkPetLevelUp(pet);
        if (levelUpResult.leveledUp) {
          petLevelUps.push({
            petId: pet._id,
            petName: pet.name,
            newLevel: levelUpResult.newLevel,
          });
        }
      }

      // Send battle results email if user has email
      if (user.email && user.preferences?.notifications) {
        try {
          await mailService.sendBattleResults(user, battleResult, rewards);
        } catch (emailError) {
          logger.warn("Failed to send battle results email:", emailError);
        }
      }

      logger.info(
        `Battle completed for user ${user.username}: ${battleResult.winner}`
      );

      const responseData = {
        success: true,
        data: {
          battle: {
            result: battleResult,
            userPets: userPets.map((pet) => ({
              id: pet._id,
              name: pet.name,
              tier: pet.tier,
              type: pet.type,
              stats: pet.stats,
              level: pet.level,
              battlesWon: pet.battlesWon,
              battlesLost: pet.battlesLost,
              winRate: pet.winRate,
            })),
            opponentPets: opponentPets.map((pet) => ({
              name: pet.name,
              tier: pet.tier,
              type: pet.type,
              stats: pet.stats,
              level: pet.level,
            })),
          },
          rewards: {
            ...rewards,
            petLevelUps,
          },
          user: {
            coins: user.coins,
            experience: user.experience,
            level: user.level,
            battlesWon: user.battlesWon,
            battlesLost: user.battlesLost,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      };

      // Add level up notification if applicable
      if (expResult.leveledUp) {
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
      }

      res.json(responseData);
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
      const user = await User.findById(req.user._id); // Get fresh instance
      const { questId } = req.body;

      // Get quest data
      const quest = this.getQuestById(questId);
      if (!quest) {
        return res.status(404).json({
          success: false,
          message: "Quest not found",
        });
      }

      // Calculate rewards based on quest difficulty and user level
      const rewards = rewardService.calculateQuestRewards(
        quest.difficulty,
        user.level
      );

      // Apply rewards using User model methods
      user.coins += rewards.coins;
      const expResult = user.addExperience(rewards.experience);

      if (rewards.freeRolls) {
        user.freeRolls += rewards.freeRolls;
      }

      // Track quest completion (you might want to add this field to User model)
      if (!user.completedQuests) {
        user.completedQuests = [];
      }
      user.completedQuests.push({
        questId,
        completedAt: new Date(),
        rewards,
      });

      await user.save();

      logger.info(`User ${user.username} completed quest ${questId}`);

      const responseData = {
        success: true,
        message: `Quest "${quest.name}" completed successfully!`,
        data: {
          quest: {
            id: questId,
            name: quest.name,
            difficulty: quest.difficulty,
            description: quest.description,
          },
          rewards,
          user: {
            coins: user.coins,
            experience: user.experience,
            level: user.level,
            freeRolls: user.freeRolls,
            completedQuests: user.completedQuests?.length || 0,
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
      const user = await User.findById(req.user._id); // Get fresh instance

      // Check if user can claim daily reward (20 hour cooldown)
      const lastClaim = user.lastDailyClaim || new Date(0);
      const now = new Date();
      const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);

      if (hoursSinceLastClaim < 20) {
        const hoursRemaining = Math.ceil(20 - hoursSinceLastClaim);
        return res.status(400).json({
          success: false,
          message: `Please wait ${hoursRemaining} more hours to claim your next daily reward`,
        });
      }

      // Calculate consecutive days
      const consecutiveDays = user.consecutiveDays || 1;
      const isNewDay = hoursSinceLastClaim >= 24;
      const currentConsecutiveDays = isNewDay
        ? consecutiveDays + 1
        : consecutiveDays;

      // Get daily rewards
      const rewards = rewardService.getDailyReward(currentConsecutiveDays);

      // Apply rewards using User model methods
      user.coins += rewards.coins;
      const expResult = user.addExperience(rewards.experience);
      user.freeRolls += rewards.freeRolls;
      user.lastDailyClaim = now;
      user.consecutiveDays = isNewDay
        ? currentConsecutiveDays
        : consecutiveDays;

      await user.save();

      logger.info(
        `User ${user.username} claimed daily reward (day ${user.consecutiveDays})`
      );

      const responseData = {
        success: true,
        message: `Daily reward claimed! Day ${user.consecutiveDays} streak!`,
        data: {
          rewards,
          streak: {
            current: user.consecutiveDays,
            nextReward: rewardService.getDailyReward(user.consecutiveDays + 1),
          },
          user: {
            coins: user.coins,
            freeRolls: user.freeRolls,
            experience: user.experience,
            level: user.level,
            consecutiveDays: user.consecutiveDays,
            lastDailyClaim: user.lastDailyClaim,
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
      logger.error("Daily reward claim error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during daily reward claim",
      });
    }
  },

  // Get user game stats
  async getUserStats(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .populate("ownedPets")
        .populate("ownedEggs");

      const stats = {
        user: {
          level: user.level,
          experience: user.experience,
          coins: user.coins,
          freeRolls: user.freeRolls,
          totalBattles: user.totalBattles,
          battlesWon: user.battlesWon,
          battlesLost: user.battlesLost,
          winRate: user.winRate,
          petsHatched: user.petsHatched,
          consecutiveDays: user.consecutiveDays || 0,
          completedQuests: user.completedQuests?.length || 0,
        },
        pets: {
          total: user.ownedPets.length,
          byTier: this.countPetsByTier(user.ownedPets),
          byType: this.countPetsByType(user.ownedPets),
          averageLevel: this.calculateAverageLevel(user.ownedPets),
        },
        eggs: {
          total: user.ownedEggs.length,
          hatched: user.ownedEggs.filter((egg) => egg.isHatched).length,
          unhatched: user.ownedEggs.filter((egg) => !egg.isHatched).length,
        },
      };

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Helper methods
  getOpponentLevel(difficulty, userLevel) {
    const multipliers = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.2,
      epic: 1.5,
    };
    return Math.max(1, Math.round(userLevel * (multipliers[difficulty] || 1)));
  },

  async checkPetLevelUp(pet) {
    const expNeeded = Math.pow(pet.level, 2) * 50; // Simple level up formula

    if (pet.experience >= expNeeded) {
      const oldLevel = pet.level;
      pet.level += 1;
      pet.experience -= expNeeded;

      // Improve stats on level up
      const statIncrease = Math.floor(pet.level * 1.5);
      pet.stats.attack += statIncrease;
      pet.stats.defense += statIncrease;
      pet.stats.speed += Math.floor(statIncrease * 0.8);
      pet.stats.health += statIncrease * 2;

      await pet.save();

      return {
        leveledUp: true,
        newLevel: pet.level,
        oldLevel,
        statIncrease,
      };
    }

    return { leveledUp: false };
  },

  countPetsByTier(pets) {
    const tiers = {};
    pets.forEach((pet) => {
      tiers[pet.tier] = (tiers[pet.tier] || 0) + 1;
    });
    return tiers;
  },

  countPetsByType(pets) {
    const types = {};
    pets.forEach((pet) => {
      types[pet.type] = (types[pet.type] || 0) + 1;
    });
    return types;
  },

  calculateAverageLevel(pets) {
    if (pets.length === 0) return 0;
    const total = pets.reduce((sum, pet) => sum + pet.level, 0);
    return (total / pets.length).toFixed(1);
  },

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

  simulateBattle(userPets, opponentPets) {
    let playerPower = 0;
    let opponentPower = 0;

    userPets.forEach((pet) => {
      playerPower += serverRNGService.calculatePetPower(pet);
    });

    opponentPets.forEach((pet) => {
      opponentPower += serverRNGService.calculatePetPower(pet);
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
    const quests = {
      beginner_battle: {
        name: "First Battle",
        difficulty: "easy",
        description: "Complete your first battle",
      },
      hatch_3_pets: {
        name: "Pet Collector",
        difficulty: "easy",
        description: "Hatch 3 pets",
      },
      win_5_battles: {
        name: "Battle Veteran",
        difficulty: "medium",
        description: "Win 5 battles",
      },
      fuse_pets: {
        name: "Fusion Master",
        difficulty: "hard",
        description: "Fuse pets to create a higher tier",
      },
      legendary_hatch: {
        name: "Legendary Hunter",
        difficulty: "epic",
        description: "Hatch a legendary pet",
      },
    };

    return quests[questId];
  },
};

export default GameController;
