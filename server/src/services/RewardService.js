import { serverRNGService } from "./RNGService.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import logger from "../utils/logger.js";

class RewardService {
  constructor() {
    this.rewardTypes = {
      BATTLE: "battle",
      QUEST: "quest",
      ACHIEVEMENT: "achievement",
      DAILY: "daily",
      REFERRAL: "referral",
      LEVEL_UP: "level_up",
      SPECIAL_EVENT: "special_event",
    };
  }

  // Use shared RNG for consistency
  calculateBattleRewards(battleResult, playerLevel, opponentLevel) {
    return serverRNGService.calculateBattleRewardsForDB(
      battleResult,
      playerLevel,
      opponentLevel
    );
  }

  calculateQuestRewards(questDifficulty, userLevel) {
    const baseRewards = this.calculateBaseQuestRewards(
      questDifficulty,
      userLevel
    );

    // Add server-specific bonuses
    return {
      ...baseRewards,
      serverBonus: this.calculateServerBonus(userLevel, questDifficulty),
      achievementProgress:
        this.calculateQuestAchievementProgress(questDifficulty),
    };
  }

  calculateAchievementRewards(achievementTier, userLevel) {
    const baseRewards = {
      coins: achievementTier * 100,
      experience: achievementTier * 50,
      items: this.generateAchievementItems(achievementTier),
    };

    return {
      ...baseRewards,
      title: this.getAchievementTitle(achievementTier),
      badge: `achievement_badge_${achievementTier}`,
    };
  }

  calculateDailyRewards(consecutiveDays, userLevel) {
    const baseMultiplier = 1 + consecutiveDays * 0.1;
    const levelBonus = userLevel * 2;

    return {
      coins: Math.floor((50 + levelBonus) * baseMultiplier),
      experience: Math.floor((25 + levelBonus) * baseMultiplier),
      freeRolls: consecutiveDays >= 7 ? 1 : 0,
      items: this.generateDailyItems(consecutiveDays),
      streakBonus: consecutiveDays,
    };
  }

  async applyRewards(userId, rewards, rewardType = "reward", metadata = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const updates = {};
      const transactions = [];
      const appliedItems = [];

      // Coins
      if (rewards.coins && rewards.coins > 0) {
        user.addBalance(rewards.coins);
        transactions.push({
          user: userId,
          type: rewardType,
          amount: rewards.coins,
          currency: "coins",
          status: "completed",
          description: this.getRewardDescription(rewardType, rewards.coins),
          metadata: {
            ...metadata,
            rewardSource: rewardType,
            originalAmount: rewards.coins,
          },
        });
      }

      // Experience
      if (rewards.experience && rewards.experience > 0) {
        const oldLevel = user.level;
        user.experience += rewards.experience;

        // Check for level up
        while (this.shouldLevelUp(user.experience, user.level)) {
          user.level += 1;
          updates.leveledUp = true;
          updates.newLevel = user.level;

          // Apply level up rewards
          const levelUpRewards = this.calculateLevelUpRewards(user.level);
          await this.applyLevelUpRewards(user, levelUpRewards, transactions);
        }

        if (user.level > oldLevel) {
          updates.leveledUp = true;
          updates.newLevel = user.level;
        }
      }

      // Free rolls (if applicable in your system)
      if (rewards.freeRolls && rewards.freeRolls > 0) {
        // Assuming freeRolls is tracked separately in user model
        user.freeRolls = (user.freeRolls || 0) + rewards.freeRolls;
      }

      // Items
      if (rewards.items && rewards.items.length > 0) {
        const itemResults = await this.applyItems(user, rewards.items);
        appliedItems.push(...itemResults);
      }

      // Special rewards
      if (rewards.special) {
        await this.applySpecialRewards(user, rewards.special, transactions);
      }

      // Server bonus
      if (rewards.serverBonus && rewards.serverBonus > 0) {
        user.addBalance(rewards.serverBonus);
        transactions.push({
          user: userId,
          type: "server_bonus",
          amount: rewards.serverBonus,
          currency: "coins",
          status: "completed",
          description: `Server bonus: ${rewards.serverBonus} coins`,
          metadata: {
            ...metadata,
            bonusType: "server",
          },
        });
      }

      // Update user timestamps
      user.updatedAt = new Date();

      // Save user changes
      await user.save();

      // Save transactions
      if (transactions.length > 0) {
        await Transaction.insertMany(transactions);
      }

      logger.debug(`Applied ${rewardType} rewards to user ${userId}:`, rewards);

      return {
        success: true,
        rewards: rewards,
        user: {
          balance: user.balance,
          experience: user.experience,
          level: user.level,
          freeRolls: user.freeRolls,
        },
        appliedItems,
        ...updates,
      };
    } catch (error) {
      logger.error("Error applying rewards:", error);
      return { success: false, error: error.message };
    }
  }

  async applyBattleRewards(userId, battleResult, playerLevel, opponentLevel) {
    const rewards = this.calculateBattleRewards(
      battleResult,
      playerLevel,
      opponentLevel
    );
    const metadata = {
      battleResult: battleResult.winner,
      playerLevel,
      opponentLevel,
      victory: battleResult.winner === "player",
      totalDamage: battleResult.totalDamage || 0,
    };

    return await this.applyRewards(userId, rewards, "battle_reward", metadata);
  }

  async applyQuestRewards(userId, questDifficulty, userLevel, questId) {
    const rewards = this.calculateQuestRewards(questDifficulty, userLevel);
    const metadata = {
      questDifficulty,
      questId,
      userLevel,
    };

    return await this.applyRewards(userId, rewards, "quest_reward", metadata);
  }

  async applyAchievementRewards(
    userId,
    achievementTier,
    userLevel,
    achievementId
  ) {
    const rewards = this.calculateAchievementRewards(
      achievementTier,
      userLevel
    );
    const metadata = {
      achievementTier,
      achievementId,
      userLevel,
    };

    return await this.applyRewards(
      userId,
      rewards,
      "achievement_reward",
      metadata
    );
  }

  async applyDailyRewards(userId, consecutiveDays, userLevel) {
    const rewards = this.calculateDailyRewards(consecutiveDays, userLevel);
    const metadata = {
      consecutiveDays,
      userLevel,
      streakBonus: consecutiveDays,
    };

    return await this.applyRewards(userId, rewards, "daily_reward", metadata);
  }

  // Helper methods
  calculateBaseQuestRewards(questDifficulty, userLevel) {
    const baseRewards = {
      easy: { coins: 50, experience: 25 },
      medium: { coins: 100, experience: 50 },
      hard: { coins: 200, experience: 100 },
      epic: { coins: 500, experience: 250 },
    };

    const base = baseRewards[questDifficulty] || baseRewards.easy;
    const levelMultiplier = 1 + userLevel * 0.05;

    return {
      coins: Math.floor(base.coins * levelMultiplier),
      experience: Math.floor(base.experience * levelMultiplier),
      items: this.generateQuestItems(questDifficulty),
    };
  }

  calculateServerBonus(userLevel, questDifficulty) {
    const bonuses = {
      easy: userLevel * 5,
      medium: userLevel * 10,
      hard: userLevel * 20,
      epic: userLevel * 50,
    };

    return bonuses[questDifficulty] || 0;
  }

  calculateQuestAchievementProgress(questDifficulty) {
    return {
      questsCompleted: 1,
      difficulty: questDifficulty,
      timestamp: new Date(),
    };
  }

  shouldLevelUp(experience, currentLevel) {
    const threshold = currentLevel * 100;
    return experience >= threshold;
  }

  calculateLevelUpRewards(newLevel) {
    return {
      coins: newLevel * 50,
      freeRolls: newLevel % 5 === 0 ? 1 : 0, // Free roll every 5 levels
      items: this.generateLevelUpItems(newLevel),
      title: `Level ${newLevel} Champion`,
    };
  }

  async applyLevelUpRewards(user, levelUpRewards, transactions) {
    if (levelUpRewards.coins > 0) {
      user.addBalance(levelUpRewards.coins);
      transactions.push({
        user: user.id,
        type: "level_up_reward",
        amount: levelUpRewards.coins,
        currency: "coins",
        status: "completed",
        description: `Level up reward: ${levelUpRewards.coins} coins`,
        metadata: {
          newLevel: user.level,
          rewardType: "level_up",
        },
      });
    }

    if (levelUpRewards.freeRolls > 0) {
      user.freeRolls = (user.freeRolls || 0) + levelUpRewards.freeRolls;
    }

    if (levelUpRewards.items && levelUpRewards.items.length > 0) {
      await this.applyItems(user, levelUpRewards.items);
    }
  }

  async applyItems(user, items) {
    const appliedItems = [];

    for (const item of items) {
      try {
        // Handle different item types
        switch (item.type) {
          case "premium_currency":
            // Convert to coins or handle premium currency
            const coinValue = this.convertPremiumToCoins(
              item.quantity,
              item.rarity
            );
            user.addBalance(coinValue);
            appliedItems.push({
              type: item.type,
              quantity: item.quantity,
              convertedValue: coinValue,
              status: "applied",
            });
            break;

          case "healing_potion":
          case "egg_fragment":
            // Add to user's inventory (simplified)
            user.addTransaction({
              type: "item_reward",
              amount: item.quantity,
              currency: "item",
              description: `Received ${item.quantity}x ${item.type}`,
            });
            appliedItems.push({
              type: item.type,
              quantity: item.quantity,
              rarity: item.rarity,
              status: "added_to_inventory",
            });
            break;

          case "cosmetic":
            // Add cosmetic to user's collection
            if (!user.skins) user.skins = [];
            user.skins.push({
              id: crypto.randomUUID(),
              name: item.name || `${item.rarity} ${item.type}`,
              type: item.type,
              rarity: item.rarity,
              obtainedAt: new Date(),
            });
            appliedItems.push({
              type: item.type,
              name: item.name,
              rarity: item.rarity,
              status: "added_to_collection",
            });
            break;

          default:
            logger.warn(`Unknown item type: ${item.type}`);
            appliedItems.push({
              type: item.type,
              quantity: item.quantity,
              status: "unknown_type",
            });
        }
      } catch (error) {
        logger.error(`Error applying item ${item.type}:`, error);
        appliedItems.push({
          type: item.type,
          quantity: item.quantity,
          status: "failed",
          error: error.message,
        });
      }
    }

    return appliedItems;
  }

  async applySpecialRewards(user, specialRewards, transactions) {
    // Handle special rewards like NFTs, exclusive items, etc.
    if (specialRewards.nftToken) {
      user.addNFTToken(specialRewards.nftToken);
      transactions.push({
        user: user.id,
        type: "nft_reward",
        amount: 1,
        currency: "nft",
        status: "completed",
        description: "Received exclusive NFT",
        metadata: {
          tokenId: specialRewards.nftToken,
          rewardType: "special",
        },
      });
    }

    if (specialRewards.exclusivePet) {
      // Generate and add exclusive pet
      const petData = serverRNGService.generatePetForDB(user.id);
      const Pet = (await import("../models/Pet.js")).default;
      const exclusivePet = new Pet({
        ...petData,
        ...specialRewards.exclusivePet,
        isExclusive: true,
      });
      user.addPet(exclusivePet);
    }
  }

  // Item generation methods
  generateQuestItems(questDifficulty) {
    const itemChances = {
      easy: 0.1,
      medium: 0.2,
      hard: 0.4,
      epic: 0.6,
    };

    const items = [];
    const chance = itemChances[questDifficulty] || 0.1;

    if (Math.random() < chance) {
      items.push({
        type: "healing_potion",
        quantity: 1,
        rarity: "common",
      });
    }

    return items;
  }

  generateAchievementItems(achievementTier) {
    const items = [];

    // Always give an egg for achievements
    items.push({
      type: "egg",
      quantity: 1,
      eggType: achievementTier >= 3 ? "PREMIUM" : "BASIC",
      rarity: achievementTier >= 5 ? "rare" : "common",
    });

    // Chance for additional items based on tier
    if (achievementTier >= 2 && Math.random() < 0.3) {
      items.push({
        type: "cosmetic",
        name: `Achievement Tier ${achievementTier} Skin`,
        rarity: achievementTier >= 4 ? "epic" : "rare",
      });
    }

    return items;
  }

  generateDailyItems(consecutiveDays) {
    const items = [];

    // Egg fragment for consecutive days
    if (consecutiveDays >= 3) {
      items.push({
        type: "egg_fragment",
        quantity: Math.min(consecutiveDays, 10),
        rarity: "common",
      });
    }

    // Special reward for 7-day streak
    if (consecutiveDays >= 7) {
      items.push({
        type: "premium_currency",
        quantity: 1,
        rarity: "rare",
      });
    }

    return items;
  }

  generateLevelUpItems(level) {
    const items = [];

    // Basic egg for every level
    items.push({
      type: "egg",
      quantity: 1,
      eggType: "BASIC",
      rarity: "common",
    });

    // Premium egg every 10 levels
    if (level % 10 === 0) {
      items.push({
        type: "egg",
        quantity: 1,
        eggType: "PREMIUM",
        rarity: "rare",
      });
    }

    // Special cosmetic every 25 levels
    if (level % 25 === 0) {
      items.push({
        type: "cosmetic",
        name: `Level ${level} Master`,
        rarity: "epic",
      });
    }

    return items;
  }

  convertPremiumToCoins(quantity, rarity) {
    const multipliers = {
      common: 10,
      uncommon: 25,
      rare: 50,
      epic: 100,
      legendary: 250,
    };

    return quantity * (multipliers[rarity] || 10);
  }

  getRewardDescription(rewardType, amount) {
    const descriptions = {
      battle_reward: `Battle victory reward: ${amount} coins`,
      quest_reward: `Quest completion: ${amount} coins`,
      achievement_reward: `Achievement unlocked: ${amount} coins`,
      daily_reward: `Daily login: ${amount} coins`,
      level_up_reward: `Level up bonus: ${amount} coins`,
      server_bonus: `Server bonus: ${amount} coins`,
      reward: `Game reward: ${amount} coins`,
    };

    return descriptions[rewardType] || `Reward: ${amount} coins`;
  }

  getAchievementTitle(tier) {
    const titles = {
      1: "Novice",
      2: "Apprentice",
      3: "Adept",
      4: "Expert",
      5: "Master",
      6: "Grand Master",
      7: "Legend",
    };

    return titles[tier] || "Achiever";
  }

  // Analytics methods
  async getUserRewardHistory(userId, options = {}) {
    return await Transaction.getUserHistory(userId, {
      ...options,
      type: {
        $in: [
          "battle_reward",
          "quest_reward",
          "achievement_reward",
          "daily_reward",
          "level_up_reward",
          "server_bonus",
          "reward",
        ],
      },
    });
  }

  async getUserRewardStats(userId, period = "all") {
    const earnings = await Transaction.getUserEarnings(userId, "coins", period);
    return earnings.length > 0
      ? earnings[0]
      : { totalEarned: 0, transactionCount: 0, averageTransaction: 0 };
  }
}

export const rewardService = new RewardService();
export default rewardService;
