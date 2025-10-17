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
      const user = await User.findById(req.user.id); // Get fresh instance
      const { eggId, useFreeRoll = false } = req.body;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if using free roll or has enough balance
      const hatchCost = 100;
      if (useFreeRoll) {
        // Simplified free roll logic - you might want to implement proper free roll tracking
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

      let egg;
      let eggIndex = -1;

      if (eggId) {
        // Hatch specific egg from user's collection
        eggIndex = user.eggs.findIndex((egg) => egg.id === eggId);
        if (eggIndex === -1) {
          return res.status(404).json({
            success: false,
            message: "Egg not found in your collection",
          });
        }

        egg = user.eggs[eggIndex];
        if (egg.isHatched) {
          return res.status(400).json({
            success: false,
            message: "Egg has already been hatched",
          });
        }
      } else {
        // Create and hatch a basic egg
        egg = new Egg("BASIC", user.id);
      }

      // Hatch the egg using User model method
      let hatchResult;
      if (eggId) {
        hatchResult = user.hatchEgg(eggIndex);
      } else {
        // For new eggs, add then hatch
        user.addEgg(egg);
        hatchResult = user.hatchEgg(user.eggs.length - 1);
      }

      // Update user balance and track free hatch
      if (useFreeRoll) {
        user.lastFreeHatch = new Date();
      } else {
        user.deductBalance(hatchCost);
      }

      // Add experience for hatching
      user.experience += 25;

      // Check for level up
      const leveledUp = this.checkUserLevelUp(user);

      await user.save();

      logger.info(`User ${user.username} hatched an egg`);

      const responseData = {
        success: true,
        message: "Egg hatched successfully!",
        data: {
          result: this.formatHatchResult(hatchResult),
          user: {
            balance: user.balance,
            eggs: user.eggs.length,
            pets: user.pets.length,
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

  // Start a battle
  async startBattle(req, res) {
    try {
      const user = await User.findById(req.user.id); // Get fresh instance
      const {
        petIds,
        battleMode = "pve",
        opponentDifficulty = "medium",
      } = req.body;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Validate user's pets
      const userPets = user.pets.filter((pet) => petIds.includes(pet.id));
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

      // Calculate and apply rewards using RewardService
      const opponentLevel = this.getOpponentLevel(
        opponentDifficulty,
        user.level
      );

      const rewardResult = await rewardService.applyBattleRewards(
        user.id,
        battleResult,
        user.level,
        opponentLevel
      );

      if (!rewardResult.success) {
        throw new Error(
          `Failed to apply battle rewards: ${rewardResult.error}`
        );
      }

      // Update user battle statistics
      if (battleResult.winner === "player") {
        // Track wins in user model if you add this field
        user.battlesWon = (user.battlesWon || 0) + 1;
      } else {
        user.battlesLost = (user.battlesLost || 0) + 1;
      }

      // Update pet battle stats
      userPets.forEach((pet) => {
        if (battleResult.winner === "player") {
          pet.battlesWon = (pet.battlesWon || 0) + 1;
        } else {
          pet.battlesLost = (pet.battlesLost || 0) + 1;
        }
      });

      // Check for pet level ups
      const petLevelUps = [];
      for (const pet of userPets) {
        const levelUpResult = await this.checkPetLevelUp(pet);
        if (levelUpResult.leveledUp) {
          petLevelUps.push({
            petId: pet.id,
            petName: pet.name,
            newLevel: levelUpResult.newLevel,
          });
        }
      }

      // Update user
      user.updatedAt = new Date();
      await user.save();

      // Send battle results email if user has email
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

      logger.info(
        `Battle completed for user ${user.username}: ${battleResult.winner}`
      );

      const responseData = {
        success: true,
        data: {
          battle: {
            result: battleResult,
            userPets: userPets.map((pet) => ({
              id: pet.id,
              name: pet.name,
              type: pet.type,
              rarity: pet.rarity,
              stats: pet.stats,
              level: pet.level,
              battlesWon: pet.battlesWon || 0,
              battlesLost: pet.battlesLost || 0,
            })),
            opponentPets: opponentPets.map((pet) => ({
              name: pet.name,
              type: pet.type,
              rarity: pet.rarity,
              stats: pet.stats,
              level: pet.level,
            })),
          },
          rewards: {
            ...rewardResult.rewards,
            petLevelUps,
          },
          user: {
            balance: user.balance,
            experience: user.experience,
            level: user.level,
            battlesWon: user.battlesWon || 0,
            battlesLost: user.battlesLost || 0,
          },
        },
      };

      // Add level up notification if applicable
      if (rewardResult.leveledUp) {
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = rewardResult.newLevel;
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
      const user = await User.findById(req.user.id); // Get fresh instance
      const { questId } = req.body;

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Get quest data
      const quest = this.getQuestById(questId);
      if (!quest) {
        return res.status(404).json({
          success: false,
          message: "Quest not found",
        });
      }

      // Apply quest rewards using RewardService
      const rewardResult = await rewardService.applyQuestRewards(
        user.id,
        quest.difficulty,
        user.level,
        questId
      );

      if (!rewardResult.success) {
        throw new Error(`Failed to apply quest rewards: ${rewardResult.error}`);
      }

      // Track quest completion
      if (!user.completedQuests) {
        user.completedQuests = [];
      }
      user.completedQuests.push({
        questId,
        completedAt: new Date(),
        rewards: rewardResult.rewards,
      });

      user.updatedAt = new Date();
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
          rewards: rewardResult.rewards,
          user: {
            balance: user.balance,
            experience: user.experience,
            level: user.level,
            completedQuests: user.completedQuests.length,
          },
        },
      };

      // Add level up notification if applicable
      if (rewardResult.leveledUp) {
        responseData.message += ` You leveled up to level ${rewardResult.newLevel}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = rewardResult.newLevel;
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
      const user = await User.findById(req.user.id); // Get fresh instance

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

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

      // Apply daily rewards using RewardService
      const rewardResult = await rewardService.applyDailyRewards(
        user.id,
        currentConsecutiveDays,
        user.level
      );

      if (!rewardResult.success) {
        throw new Error(`Failed to apply daily rewards: ${rewardResult.error}`);
      }

      // Update user daily reward tracking
      user.lastDailyClaim = now;
      user.consecutiveDays = isNewDay
        ? currentConsecutiveDays
        : consecutiveDays;

      user.updatedAt = new Date();
      await user.save();

      logger.info(
        `User ${user.username} claimed daily reward (day ${user.consecutiveDays})`
      );

      const responseData = {
        success: true,
        message: `Daily reward claimed! Day ${user.consecutiveDays} streak!`,
        data: {
          rewards: rewardResult.rewards,
          streak: {
            current: user.consecutiveDays,
            nextReward: this.getNextDailyReward(user.consecutiveDays + 1),
          },
          user: {
            balance: user.balance,
            experience: user.experience,
            level: user.level,
            consecutiveDays: user.consecutiveDays,
            lastDailyClaim: user.lastDailyClaim,
          },
        },
      };

      // Add level up notification if applicable
      if (rewardResult.leveledUp) {
        responseData.message += ` You leveled up to level ${rewardResult.newLevel}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = rewardResult.newLevel;
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
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const stats = {
        user: {
          level: user.level,
          experience: user.experience,
          balance: user.balance,
          totalBattles: (user.battlesWon || 0) + (user.battlesLost || 0),
          battlesWon: user.battlesWon || 0,
          battlesLost: user.battlesLost || 0,
          winRate: user.battlesWon
            ? (
                (user.battlesWon /
                  ((user.battlesWon || 0) + (user.battlesLost || 0))) *
                100
              ).toFixed(1)
            : 0,
          consecutiveDays: user.consecutiveDays || 0,
          completedQuests: user.completedQuests?.length || 0,
        },
        pets: {
          total: user.pets.length,
          byRarity: this.countPetsByRarity(user.pets),
          byType: this.countPetsByType(user.pets),
          averageLevel: this.calculateAverageLevel(user.pets),
        },
        eggs: {
          total: user.eggs.length,
          hatched: user.eggs.filter((egg) => egg.isHatched).length,
          unhatched: user.eggs.filter((egg) => !egg.isHatched).length,
        },
        collection: {
          techniques: user.techniques.length,
          skins: user.skins.length,
          nftTokens: user.nftTokens.length,
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

  checkUserLevelUp(user) {
    const threshold = user.level * 100;
    if (user.experience >= threshold) {
      user.level += 1;
      user.experience -= threshold;
      return true;
    }
    return false;
  },

  async checkPetLevelUp(pet) {
    const expNeeded = Math.pow(pet.level, 2) * 50;

    if (pet.experience >= expNeeded) {
      const oldLevel = pet.level;
      pet.level += 1;
      pet.experience -= expNeeded;

      // Improve stats on level up
      const statIncrease = Math.floor(pet.level * 1.5);
      pet.stats.dmg += statIncrease;
      pet.stats.hp += statIncrease * 2;

      return {
        leveledUp: true,
        newLevel: pet.level,
        oldLevel,
        statIncrease,
      };
    }

    return { leveledUp: false };
  },

  countPetsByRarity(pets) {
    const rarities = {};
    pets.forEach((pet) => {
      rarities[pet.rarity] = (rarities[pet.rarity] || 0) + 1;
    });
    return rarities;
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
    const total = pets.reduce((sum, pet) => sum + (pet.level || 1), 0);
    return (total / pets.length).toFixed(1);
  },

  async generateOpponentPets(difficulty, userPets) {
    const difficulties = {
      easy: {
        levelMultiplier: 0.8,
        rarityWeights: { common: 60, uncommon: 30, rare: 10 },
      },
      medium: {
        levelMultiplier: 1.0,
        rarityWeights: { common: 40, uncommon: 40, rare: 15, epic: 5 },
      },
      hard: {
        levelMultiplier: 1.2,
        rarityWeights: {
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

    // Add some randomness
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
    // Simple power calculation based on stats and level
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
      legendary_hatch: {
        name: "Legendary Hunter",
        difficulty: "epic",
        description: "Hatch a legendary pet",
      },
    };

    return quests[questId];
  },

  getNextDailyReward(nextDay) {
    // Simplified next reward preview
    return {
      coins: Math.floor((50 + nextDay * 2) * (1 + nextDay * 0.1)),
      experience: Math.floor((25 + nextDay * 2) * (1 + nextDay * 0.1)),
      freeRolls: nextDay >= 7 ? 1 : 0,
    };
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

export default GameController;
