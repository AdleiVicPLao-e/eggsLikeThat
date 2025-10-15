import { serverRNGService } from "./RNGService.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import logger from "../utils/logger.js";

class RewardService {
  // Use shared RNG for consistency
  calculateBattleRewards(battleResult, playerLevel, opponentLevel) {
    return serverRNGService.calculateBattleRewardsForDB(
      battleResult,
      playerLevel,
      opponentLevel
    );
  }

  calculateQuestRewards(questDifficulty, userLevel) {
    const baseRewards = serverRNGService.calculateQuestRewards(
      questDifficulty,
      userLevel
    );

    // Add server-specific bonuses
    return {
      ...baseRewards,
      serverBonus: this.calculateServerBonus(userLevel, questDifficulty),
    };
  }

  async applyRewards(userId, rewards) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const updates = {};
      const transactions = [];

      // Coins
      if (rewards.coins && rewards.coins > 0) {
        user.coins += rewards.coins;
        transactions.push({
          user: userId,
          type: "reward",
          amount: rewards.coins,
          currency: "coins",
          status: "completed",
          description: `Game reward: ${rewards.coins} coins`,
        });
      }

      // Experience
      if (rewards.experience && rewards.experience > 0) {
        const levelUp = user.addExperience(rewards.experience);
        if (levelUp.leveledUp) {
          updates.leveledUp = true;
          updates.newLevel = levelUp.newLevel;
        }
      }

      // Free rolls
      if (rewards.freeRolls && rewards.freeRolls > 0) {
        user.freeRolls += rewards.freeRolls;
      }

      // Items
      if (rewards.items && rewards.items.length > 0) {
        await this.applyItems(userId, rewards.items);
      }

      await user.save();

      // Save transactions
      if (transactions.length > 0) {
        await Transaction.insertMany(transactions);
      }

      logger.debug(`Applied rewards to user ${userId}:`, rewards);

      return {
        success: true,
        rewards: rewards,
        user: {
          coins: user.coins,
          experience: user.experience,
          level: user.level,
          freeRolls: user.freeRolls,
        },
        ...updates,
      };
    } catch (error) {
      logger.error("Error applying rewards:", error);
      return { success: false, error: error.message };
    }
  }

  async applyItems(userId, items) {
    // Implement item application logic
    // This would interact with the user's inventory
    logger.info(`Applying ${items.length} items to user ${userId}`);

    for (const item of items) {
      // Add item to user's inventory
      // This is a simplified implementation
      logger.debug(`Applied item: ${item.type} x${item.quantity}`);
    }
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
}

export const rewardService = new RewardService();
export default rewardService;
