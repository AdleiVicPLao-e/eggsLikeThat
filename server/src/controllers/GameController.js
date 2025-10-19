// src/controllers/GameController.js
import { DatabaseService } from "../services/DatabaseService.js";
import { serverRNGService } from "../services/RNGService.js";
import { rewardService } from "../services/RewardService.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";

const dbService = new DatabaseService();

export const GameController = {
  // Hatch an egg
  async hatchEgg(req, res) {
    try {
      const userId = req.user.id;
      const { eggId, useFreeRoll = false } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if using free roll or has enough balance
      const hatchCost = 100;
      if (useFreeRoll) {
        const lastFreeHatch = user.lastFreeHatch || new Date(0);
        const hoursSinceLastFree =
          (new Date() - lastFreeHatch) / (1000 * 60 * 60);

        if (hoursSinceLastFree < 24) {
          return res.status(400).json({
            success: false,
            message: "Free hatch available once every 24 hours",
          });
        }
      } else {
        if (user.balance < hatchCost) {
          return res.status(400).json({
            success: false,
            message: `Not enough balance to hatch egg. Cost: ${hatchCost}, You have: ${user.balance}`,
          });
        }
      }

      let eggToHatch;
      if (eggId) {
        // Hatch specific egg
        const eggs = await dbService.getUserEggs(userId);
        eggToHatch = eggs.find((egg) => egg._id.toString() === eggId);
        if (!eggToHatch) {
          return res.status(404).json({
            success: false,
            message: "Egg not found in your collection",
          });
        }
        if (eggToHatch.isHatched) {
          return res.status(400).json({
            success: false,
            message: "Egg has already been hatched",
          });
        }
      } else {
        // Create and hatch a basic egg
        const eggData = serverRNGService.generateEggForDB(userId);
        eggToHatch = await dbService.createEgg(eggData);
      }

      // Hatch the egg
      const hatchResult = await dbService.hatchEgg(eggToHatch._id);

      // Update user balance and track free hatch
      if (useFreeRoll) {
        await dbService.updateUser(userId, { lastFreeHatch: new Date() });
      } else {
        await dbService.updateUserBalance(userId, -hatchCost);
      }

      // Add experience for hatching
      await dbService.updateUserExperience(userId, 25);

      // Get updated user
      const updatedUser = await dbService.findUserById(userId);

      logger.info(`User ${user.username} hatched an egg`);

      const responseData = {
        success: true,
        message: "Egg hatched successfully!",
        data: {
          result: this.formatHatchResult(hatchResult),
          user: {
            balance: updatedUser.balance,
            eggs: updatedUser.eggIds?.length || 0,
            pets: updatedUser.petIds?.length || 0,
            techniques: updatedUser.techniqueIds?.length || 0,
            skins: updatedUser.skinIds?.length || 0,
            level: updatedUser.level,
            experience: updatedUser.experience,
          },
        },
      };

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
      const userId = req.user.id;
      const {
        petIds,
        battleMode = "pve",
        opponentDifficulty = "medium",
      } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Validate user's pets
      const userPets = user.petIds.filter((pet) =>
        petIds.includes(pet._id.toString())
      );
      if (userPets.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid pets selected for battle",
        });
      }

      // Generate opponent
      const opponentPets = await this.generateOpponentPets(
        opponentDifficulty,
        userPets
      );
      const battleResult = this.simulateBattle(userPets, opponentPets);

      // Apply rewards
      const opponentLevel = this.getOpponentLevel(
        opponentDifficulty,
        user.level
      );
      const rewardResult = await rewardService.applyBattleRewards(
        userId,
        battleResult,
        user.level,
        opponentLevel
      );

      if (!rewardResult.success) {
        throw new Error(
          `Failed to apply battle rewards: ${rewardResult.error}`
        );
      }

      // Update user battle stats
      const updateData = { updatedAt: new Date() };
      if (battleResult.winner === "player") {
        updateData.battlesWon = (user.battlesWon || 0) + 1;
      } else {
        updateData.battlesLost = (user.battlesLost || 0) + 1;
      }
      await dbService.updateUser(userId, updateData);

      // Update pet battle stats
      for (const pet of userPets) {
        const petUpdate = {};
        if (battleResult.winner === "player") {
          petUpdate.battlesWon = (pet.battlesWon || 0) + 1;
        } else {
          petUpdate.battlesLost = (pet.battlesLost || 0) + 1;
        }
        await dbService.updatePet(pet._id, petUpdate);
      }

      // Save battle history
      await dbService.addBattleHistory({
        userId,
        result: battleResult.winner === "player" ? "victory" : "defeat",
        opponent: `${opponentDifficulty} Opponent`,
        userPets: userPets.map((pet) => pet._id),
        rewards: rewardResult.rewards,
        battleData: battleResult,
      });

      // Send email notification
      if (user.email) {
        try {
          await mailService.sendBattleResults(
            user,
            battleResult,
            rewardResult.rewards
          );
        } catch (emailError) {
          logger.warn("Failed to send battle results email:", emailError);
        }
      }

      const responseData = {
        success: true,
        data: {
          battle: {
            result: battleResult,
            userPets: userPets.map((pet) => ({
              id: pet._id,
              name: pet.name,
              type: pet.type,
              rarity: pet.rarity,
              stats: pet.stats,
              level: pet.level,
              battlesWon: pet.battlesWon || 0,
              battlesLost: pet.battlesLost || 0,
            })),
            opponentPets,
          },
          rewards: rewardResult.rewards,
          user: {
            balance: user.balance + (rewardResult.rewards?.coins || 0),
            experience:
              user.experience + (rewardResult.rewards?.experience || 0),
            level: user.level,
            battlesWon: updateData.battlesWon || user.battlesWon,
            battlesLost: updateData.battlesLost || user.battlesLost,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Battle error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during battle",
      });
    }
  },

  // Get battle history
  async getBattleHistory(req, res) {
    try {
      const userId = req.user.id;
      const battleHistory = await dbService.getUserBattleHistory(userId);

      const summary = {
        totalBattles: battleHistory.length,
        victories: battleHistory.filter((b) => b.result === "victory").length,
        defeats: battleHistory.filter((b) => b.result === "defeat").length,
      };
      summary.winRate =
        summary.totalBattles > 0
          ? ((summary.victories / summary.totalBattles) * 100).toFixed(1)
          : 0;

      res.json({
        success: true,
        data: {
          battles: battleHistory,
          summary,
        },
      });
    } catch (error) {
      logger.error("Get battle history error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get available quests
  async getAvailableQuests(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const availableQuests = [
        {
          id: "beginner_battle",
          name: "First Battle",
          difficulty: "easy",
          description: "Complete your first battle",
          reward: { coins: 100, experience: 50 },
          completed:
            user.completedQuests?.some(
              (q) => q.questId === "beginner_battle"
            ) || false,
        },
        {
          id: "hatch_3_pets",
          name: "Pet Collector",
          difficulty: "easy",
          description: "Hatch 3 pets",
          reward: { coins: 150, experience: 75 },
          progress: user.petIds?.length || 0,
          target: 3,
          completed: (user.petIds?.length || 0) >= 3,
        },
        {
          id: "win_5_battles",
          name: "Battle Veteran",
          difficulty: "medium",
          description: "Win 5 battles",
          reward: { coins: 250, experience: 125 },
          progress: user.battlesWon || 0,
          target: 5,
          completed: (user.battlesWon || 0) >= 5,
        },
        {
          id: "reach_level_10",
          name: "Experienced Trainer",
          difficulty: "medium",
          description: "Reach level 10",
          reward: { coins: 500, experience: 250 },
          progress: user.level || 1,
          target: 10,
          completed: (user.level || 1) >= 10,
        },
      ];

      res.json({
        success: true,
        data: {
          quests: availableQuests,
        },
      });
    } catch (error) {
      logger.error("Get available quests error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Complete a quest
  async completeQuest(req, res) {
    try {
      const userId = req.user.id;
      const { questId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const quest = this.getQuestById(questId);
      if (!quest) {
        return res.status(404).json({
          success: false,
          message: "Quest not found",
        });
      }

      if (user.completedQuests?.some((q) => q.questId === questId)) {
        return res.status(400).json({
          success: false,
          message: "Quest already completed",
        });
      }

      if (!this.checkQuestRequirements(user, questId)) {
        return res.status(400).json({
          success: false,
          message: "Quest requirements not met",
        });
      }

      const rewardResult = await rewardService.applyQuestRewards(
        userId,
        quest.difficulty,
        user.level,
        questId
      );

      if (!rewardResult.success) {
        throw new Error(`Failed to apply quest rewards: ${rewardResult.error}`);
      }

      const completedQuest = {
        questId,
        completedAt: new Date(),
        rewards: rewardResult.rewards,
      };

      await dbService.updateUser(userId, {
        $push: { completedQuests: completedQuest },
        updatedAt: new Date(),
      });

      const responseData = {
        success: true,
        message: `Quest "${quest.name}" completed successfully!`,
        data: {
          quest,
          rewards: rewardResult.rewards,
          user: {
            completedQuests: (user.completedQuests?.length || 0) + 1,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Quest completion error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during quest completion",
      });
    }
  },

  // Get quest progress
  async getQuestProgress(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const questProgress = {
        completed: user.completedQuests?.length || 0,
        inProgress: 4 - (user.completedQuests?.length || 0),
        totalAvailable: 4,
      };

      res.json({
        success: true,
        data: { progress: questProgress },
      });
    } catch (error) {
      logger.error("Get quest progress error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get daily reward status
  async getDailyRewardStatus(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const lastClaim = user.lastDailyClaim || new Date(0);
      const now = new Date();
      const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);
      const canClaim = hoursSinceLastClaim >= 20;
      const hoursRemaining = canClaim ? 0 : Math.ceil(20 - hoursSinceLastClaim);

      const status = {
        canClaim,
        hoursRemaining,
        consecutiveDays: user.consecutiveDays || 1,
        lastClaim: user.lastDailyClaim,
        nextReward: this.getNextDailyReward((user.consecutiveDays || 1) + 1),
      };

      res.json({
        success: true,
        data: { status },
      });
    } catch (error) {
      logger.error("Get daily reward status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Claim daily reward
  async claimDailyReward(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

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

      const consecutiveDays = user.consecutiveDays || 1;
      const isNewDay = hoursSinceLastClaim >= 24;
      const currentConsecutiveDays = isNewDay
        ? consecutiveDays + 1
        : consecutiveDays;

      const rewardResult = await rewardService.applyDailyRewards(
        userId,
        currentConsecutiveDays,
        user.level
      );

      if (!rewardResult.success) {
        throw new Error(`Failed to apply daily rewards: ${rewardResult.error}`);
      }

      const updateData = {
        lastDailyClaim: now,
        consecutiveDays: isNewDay ? currentConsecutiveDays : consecutiveDays,
        updatedAt: new Date(),
      };

      await dbService.updateUser(userId, updateData);

      const responseData = {
        success: true,
        message: `Daily reward claimed! Day ${updateData.consecutiveDays} streak!`,
        data: {
          rewards: rewardResult.rewards,
          streak: {
            current: updateData.consecutiveDays,
            nextReward: this.getNextDailyReward(updateData.consecutiveDays + 1),
          },
          user: {
            consecutiveDays: updateData.consecutiveDays,
            lastDailyClaim: updateData.lastDailyClaim,
          },
        },
      };

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
      const userId = req.user.id;
      const stats = await dbService.getUserStats(userId);

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

  // Get leaderboard
  async getLeaderboard(req, res) {
    try {
      const { type = "level", limit = 10 } = req.query;
      const leaderboard = await dbService.getLeaderboard(type, parseInt(limit));

      const formattedLeaderboard = leaderboard.map((user, index) => ({
        rank: index + 1,
        username: user.username,
        level: user.level,
        score: type === "level" ? user.level : user.experience,
        battlesWon: user.battlesWon,
      }));

      res.json({
        success: true,
        data: {
          leaderboard: formattedLeaderboard,
          type,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Get leaderboard error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Level up pet
  async levelUpPet(req, res) {
    try {
      const userId = req.user.id;
      const { petId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const pet = user.petIds.find((p) => p._id.toString() === petId);
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      const levelUpResult = await this.checkPetLevelUp(pet);
      if (!levelUpResult.leveledUp) {
        return res.status(400).json({
          success: false,
          message: "Pet doesn't have enough experience to level up",
        });
      }

      await dbService.updatePet(petId, {
        level: levelUpResult.newLevel,
        experience: pet.experience - levelUpResult.expNeeded,
        stats: levelUpResult.newStats,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: `${pet.name} leveled up to level ${levelUpResult.newLevel}!`,
        data: {
          pet: {
            id: pet._id,
            name: pet.name,
            level: levelUpResult.newLevel,
            stats: levelUpResult.newStats,
          },
          levelUp: levelUpResult,
        },
      });
    } catch (error) {
      logger.error("Level up pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Evolve pet
  async evolvePet(req, res) {
    try {
      const userId = req.user.id;
      const { petId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const pet = user.petIds.find((p) => p._id.toString() === petId);
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      if (pet.level < 10) {
        return res.status(400).json({
          success: false,
          message: "Pet must be at least level 10 to evolve",
        });
      }

      const evolutionResult = this.calculateEvolution(pet);
      await dbService.updatePet(petId, evolutionResult);

      res.json({
        success: true,
        message: `${pet.name} evolved into ${evolutionResult.name}!`,
        data: {
          pet: {
            id: pet._id,
            name: evolutionResult.name,
            evolutionStage: evolutionResult.evolutionStage,
            stats: evolutionResult.stats,
          },
        },
      });
    } catch (error) {
      logger.error("Evolve pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Equip pet item
  async equipPetItem(req, res) {
    try {
      // Implementation for equipping items would go here
      res.json({
        success: true,
        message: "Item equipped successfully",
        data: req.body,
      });
    } catch (error) {
      logger.error("Equip pet item error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Helper methods (keep the same as before)
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
    const expNeeded = Math.pow(pet.level, 2) * 50;

    if (pet.experience >= expNeeded) {
      const newLevel = pet.level + 1;
      const statIncrease = Math.floor(newLevel * 1.5);

      const newStats = {
        ...pet.stats,
        dmg: pet.stats.dmg + statIncrease,
        hp: pet.stats.hp + statIncrease * 2,
      };

      return {
        leveledUp: true,
        newLevel,
        oldLevel: pet.level,
        expNeeded,
        newStats,
        statIncrease,
      };
    }

    return { leveledUp: false };
  },

  calculateEvolution(pet) {
    const evolutionStage = (pet.evolutionStage || 1) + 1;
    const newName = `Mega ${pet.name}`;

    const newStats = {
      ...pet.stats,
      dmg: Math.round(pet.stats.dmg * 1.5),
      hp: Math.round(pet.stats.hp * 1.5),
    };

    return {
      name: newName,
      evolutionStage,
      stats: newStats,
      evolutions: [...(pet.evolutions || []), newName],
      updatedAt: new Date(),
    };
  },

  async generateOpponentPets(difficulty, userPets) {
    const difficulties = {
      easy: { levelMultiplier: 0.8 },
      medium: { levelMultiplier: 1.0 },
      hard: { levelMultiplier: 1.2 },
    };

    const config = difficulties[difficulty] || difficulties.medium;
    const opponentPets = [];
    const petCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < petCount; i++) {
      const petData = serverRNGService.generatePet();
      const avgUserLevel =
        userPets.reduce((sum, pet) => sum + (pet.level || 1), 0) /
        userPets.length;

      opponentPets.push({
        name: petData.name,
        rarity: petData.rarity,
        type: petData.type,
        ability: petData.ability,
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
      playerPower += this.calculatePetPower(pet);
    });

    opponentPets.forEach((pet) => {
      opponentPower += this.calculatePetPower(pet);
    });

    playerPower *= 0.8 + Math.random() * 0.4;
    opponentPower *= 0.8 + Math.random() * 0.4;

    const winner = playerPower > opponentPower ? "player" : "opponent";

    return {
      winner,
      playerPower: Math.round(playerPower),
      opponentPower: Math.round(opponentPower),
      margin:
        Math.abs(playerPower - opponentPower) /
        Math.max(playerPower, opponentPower),
      victory: winner === "player",
    };
  },

  calculatePetPower(pet) {
    const basePower = (pet.stats.dmg + pet.stats.hp) * 0.5;
    const levelBonus = (pet.level || 1) * 10;
    const rarityMultiplier =
      {
        common: 1.0,
        uncommon: 1.2,
        rare: 1.5,
        epic: 2.0,
        legendary: 3.0,
      }[pet.rarity] || 1.0;

    return basePower * rarityMultiplier + levelBonus;
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
      reach_level_10: {
        name: "Experienced Trainer",
        difficulty: "medium",
        description: "Reach level 10",
      },
    };
    return quests[questId];
  },

  checkQuestRequirements(user, questId) {
    switch (questId) {
      case "beginner_battle":
        return (user.battlesWon || 0) + (user.battlesLost || 0) > 0;
      case "hatch_3_pets":
        return (user.petIds?.length || 0) >= 3;
      case "win_5_battles":
        return (user.battlesWon || 0) >= 5;
      case "reach_level_10":
        return (user.level || 1) >= 10;
      default:
        return false;
    }
  },

  getNextDailyReward(nextDay) {
    return {
      coins: Math.floor((50 + nextDay * 2) * (1 + nextDay * 0.1)),
      experience: Math.floor((25 + nextDay * 2) * (1 + nextDay * 0.1)),
      freeRolls: nextDay >= 7 ? 1 : 0,
    };
  },

  formatHatchResult(result) {
    if (result.type === "Pet") {
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
    } else if (result.type === "Technique") {
      return {
        type: "Technique",
        data: {
          id: result._id,
          name: result.name,
          rarity: result.rarity,
          effect: result.effect,
        },
      };
    } else if (result.type === "Cosmetic") {
      return {
        type: "Cosmetic",
        data: {
          id: result._id,
          name: result.name,
          rarity: result.rarity,
        },
      };
    }
    return result;
  },
};

export default GameController;
