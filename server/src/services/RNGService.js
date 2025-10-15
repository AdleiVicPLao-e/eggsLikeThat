import { RNGService } from "pet-game-shared/utils/rng.js";
import { TIERS, TYPES, ABILITIES } from "pet-game-shared/constants/index.js";

// Create RNG instance for server use
export const rngService = new RNGService();

// Server-specific extensions
class ServerRNGService extends RNGService {
  // Generate pet with MongoDB-compatible data
  generatePetForDB(ownerId, pityCounter = 0) {
    const petData = this.generatePet(pityCounter);

    return {
      ...petData,
      owner: ownerId,
      hatchDate: new Date(),
      isFavorite: false,
      battlesWon: 0,
      battlesLost: 0,
    };
  }

  // Generate egg with MongoDB-compatible data
  generateEggForDB(ownerId, eggType = "BASIC") {
    const eggData = this.generateEggData(eggType);

    return {
      ...eggData,
      owner: ownerId,
      isHatched: false,
      purchased: false,
      purchasePrice: 0,
      currency: "coins",
    };
  }

  // Calculate battle rewards with server-specific logic
  calculateBattleRewardsForDB(battleResult, playerLevel, opponentLevel) {
    const baseRewards = this.calculateBattleRewards(
      battleResult,
      playerLevel,
      opponentLevel
    );

    // Add server-specific reward calculations
    return {
      ...baseRewards,
      items: this.generateBattleItems(battleResult.winner === "player"),
      achievementProgress: this.calculateAchievementProgress(battleResult),
    };
  }

  // Server-specific helper methods
  generateBattleItems(isVictory) {
    const items = [];
    const dropChance = isVictory ? 0.3 : 0.1;

    if (Math.random() < dropChance) {
      items.push({
        type: isVictory ? "premium_currency" : "healing_potion",
        quantity: 1,
        rarity: this.getItemRarity(isVictory ? "medium" : "easy"),
      });
    }

    return items;
  }

  calculateAchievementProgress(battleResult) {
    return {
      battlesCompleted: 1,
      victories: battleResult.winner === "player" ? 1 : 0,
      totalDamage: Math.floor(Math.random() * 100) + 50,
    };
  }

  getItemRarity(difficulty) {
    const rarities = {
      easy: ["common", "common", "uncommon"],
      medium: ["common", "uncommon", "rare"],
      hard: ["uncommon", "rare", "epic"],
      epic: ["rare", "epic", "legendary"],
    };

    const pool = rarities[difficulty] || rarities.easy;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

// Export enhanced service
export const serverRNGService = new ServerRNGService();
export default serverRNGService;
