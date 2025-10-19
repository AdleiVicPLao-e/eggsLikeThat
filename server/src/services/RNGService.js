import {
  EGG_TYPES,
  SKIN_RARITIES,
  TECHNIQUES,
  PET_TYPES,
  PET_RARITIES,
} from "../utils/constants.js";
import {
  weightedRandom,
  generateRandomPet,
  generateBaseStats,
} from "../utils/rng.js";
import { Pet } from "../models/Pet.js";
import { Egg } from "../models/Egg.js";

export class RNGService {
  constructor() {
    this.pityCounters = new Map(); // Track pity counters per user
  }

  // Generate pet with MongoDB-compatible data - FIXED to use Pet class
  generatePetForDB(ownerId, pityCounter = 0) {
    const pet = this.generatePet(ownerId, pityCounter);

    return {
      ...pet.toJSON(),
      hatchDate: new Date(),
      isFavorite: false,
      battlesWon: 0,
      battlesLost: 0,
    };
  }

  // Generate egg with MongoDB-compatible data - FIXED to use Egg class properly
  generateEggForDB(ownerId, eggType = EGG_TYPES.BASIC) {
    // Create an Egg instance
    const egg = new Egg(eggType, ownerId);

    return {
      id: crypto.randomUUID(),
      type: eggType,
      ownerId: ownerId,
      isHatched: false,
      hatchDuration: this.getHatchDuration(eggType),
      cost: this.getEggCost(eggType),
      description: this.getEggDescription(eggType),
      createdAt: new Date(),
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

  // Get egg drop rates for catalog display - FIXED to use actual constants
  getEggDropRates(eggType) {
    const dropRates = {
      [EGG_TYPES.BASIC]: {
        description: "Contains random pets of various rarities",
        rarities: PET_RARITIES,
      },
      [EGG_TYPES.COSMETIC]: {
        description: "Contains cosmetic skins",
        rarities: SKIN_RARITIES,
      },
      [EGG_TYPES.ATTRIBUTE]: {
        description: "Contains powerful techniques",
        techniques: TECHNIQUES,
      },
    };

    return dropRates[eggType] || dropRates[EGG_TYPES.BASIC];
  }

  // Get random pet type for preview - FIXED to use imported PET_TYPES
  getRandomPetType() {
    const petTypes = Object.keys(PET_TYPES);
    return petTypes[Math.floor(Math.random() * petTypes.length)];
  }

  // Generate a pet with pity system - FIXED to use Pet class constructor
  generatePet(ownerId = null, pityCounter = 0) {
    // Increase rare drop chance based on pity counter
    const pityBonus = Math.min(pityCounter * 0.01, 0.1); // Max 10% bonus
    const rarity = this.calculateRarityWithPity(pityBonus);

    const petType = this.getRandomPetType();
    const isShiny = Math.random() < 0.01; // 1% shiny chance

    // Use the imported generateRandomPet function for base data
    const basePetData = generateRandomPet(ownerId);

    // Create a proper Pet instance using the class constructor
    const pet = new Pet({
      ownerId: ownerId,
      name: this.generatePetName(petType, rarity),
      type: petType,
      rarity: rarity,
      ability: basePetData.ability,
      technique: null,
      skin: null,
      stats: generateBaseStats(rarity),
      isShiny: isShiny,
      title: isShiny ? "Shiny" : null,
    });

    return pet;
  }

  // Calculate battle rewards
  calculateBattleRewards(battleResult, playerLevel, opponentLevel) {
    const isVictory = battleResult.winner === "player";
    const levelDiff = opponentLevel - playerLevel;
    const baseExp = isVictory ? 50 : 20;
    const baseCoins = isVictory ? 25 : 10;

    // Scale rewards based on level difference
    const expMultiplier = 1 + levelDiff * 0.1;
    const coinMultiplier = 1 + levelDiff * 0.05;

    return {
      experience: Math.max(10, Math.floor(baseExp * expMultiplier)),
      coins: Math.max(5, Math.floor(baseCoins * coinMultiplier)),
      victory: isVictory,
      levelDifference: levelDiff,
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

    // Chance for additional items in victory
    if (isVictory && Math.random() < 0.1) {
      items.push({
        type: "egg_fragment",
        quantity: Math.floor(Math.random() * 3) + 1,
        rarity: "common",
      });
    }

    return items;
  }

  calculateAchievementProgress(battleResult) {
    return {
      battlesCompleted: 1,
      victories: battleResult.winner === "player" ? 1 : 0,
      totalDamage: Math.floor(Math.random() * 100) + 50,
      criticalHits: battleResult.criticalHits || 0,
      specialMovesUsed: battleResult.specialMovesUsed || 0,
    };
  }

  getItemRarity(difficulty) {
    const rarities = {
      easy: ["common", "common", "uncommon"],
      medium: ["common", "uncommon", "rare"],
      hard: ["uncommon", "rare", "epic"],
      boss: ["rare", "epic", "legendary"],
    };

    const pool = rarities[difficulty] || rarities.easy;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Helper methods for pet generation - FIXED to use imported PET_RARITIES
  calculateRarityWithPity(pityBonus = 0) {
    // Create adjusted rates with pity bonus
    const adjustedRarities = PET_RARITIES.map((rarity) => {
      let adjustedChance = rarity.chance;

      // Apply pity bonus to higher rarities
      if (rarity.name === "Godly" || rarity.name === "Ultimate") {
        adjustedChance += pityBonus * 100;
      } else if (rarity.name === "Exotic" || rarity.name === "Celestial") {
        adjustedChance += pityBonus * 50;
      }

      return {
        name: rarity.name,
        chance: Math.max(0.1, adjustedChance), // Ensure minimum chance
      };
    });

    return weightedRandom(adjustedRarities).name;
  }

  generatePetName(petType, rarity) {
    const prefixes = {
      common: ["Happy", "Friendly", "Playful"],
      uncommon: ["Brave", "Swift", "Clever"],
      rare: ["Mystic", "Royal", "Ancient"],
      epic: ["Divine", "Celestial", "Eternal"],
      legendary: ["Omega", "Alpha", "Ultimate"],
      mythic: ["Mythic", "Ancient", "Primeval"],
      celestial: ["Celestial", "Stellar", "Cosmic"],
      exotic: ["Exotic", "Unique", "Rare"],
      ultimate: ["Ultimate", "Supreme", "Perfect"],
      godly: ["Divine", "Godly", "Omnipotent"],
    };

    const names = {
      DRAGON: ["Scale", "Flame", "Wing"],
      PHOENIX: ["Blaze", "Ash", "Ember"],
      UNICORN: ["Sparkle", "Dream", "Magic"],
      GRIFFIN: ["Sky", "Claw", "Feather"],
      KRAKEN: ["Deep", "Wave", "Tide"],
    };

    const prefixPool = prefixes[rarity.toLowerCase()] || prefixes.common;
    const namePool = names[petType] || ["Friend", "Companion", "Buddy"];

    const prefix = prefixPool[Math.floor(Math.random() * prefixPool.length)];
    const name = namePool[Math.floor(Math.random() * namePool.length)];

    return `${prefix} ${name}`;
  }

  getHatchDuration(eggType) {
    const durations = {
      [EGG_TYPES.BASIC]: 60, // 1 minute
      [EGG_TYPES.COSMETIC]: 180, // 3 minutes
      [EGG_TYPES.ATTRIBUTE]: 600, // 10 minutes
    };

    return durations[eggType] || 60;
  }

  getEggCost(eggType) {
    const costs = {
      [EGG_TYPES.BASIC]: 100,
      [EGG_TYPES.COSMETIC]: 250,
      [EGG_TYPES.ATTRIBUTE]: 750,
    };

    return costs[eggType] || 100;
  }

  getEggDescription(eggType) {
    const descriptions = {
      [EGG_TYPES.BASIC]: "A basic egg containing common pets",
      [EGG_TYPES.COSMETIC]: "Contains cosmetic items and skins",
      [EGG_TYPES.ATTRIBUTE]: "Grants powerful techniques and abilities",
    };

    return descriptions[eggType] || "An unknown egg";
  }

  // Pity system management
  getUserPityCounter(userId) {
    return this.pityCounters.get(userId) || 0;
  }

  incrementUserPityCounter(userId) {
    const current = this.getUserPityCounter(userId);
    this.pityCounters.set(userId, current + 1);
    return current + 1;
  }

  resetUserPityCounter(userId) {
    this.pityCounters.set(userId, 0);
  }

  // Helper method to hatch an egg - FIXED to return proper Pet instance
  hatchEgg(egg) {
    if (!(egg instanceof Egg)) {
      throw new Error("Provided object is not an Egg instance");
    }

    const result = egg.hatch();

    // If the result is a pet, ensure it's a proper Pet instance
    if (result instanceof Pet) {
      return result;
    }

    // For cosmetic and technique eggs, return the result as-is
    return result;
  }
}

// Server-specific extensions
class ServerRNGService extends RNGService {
  // Override methods for server-specific logic
  generatePetForDB(ownerId, pityCounter = 0) {
    const petData = super.generatePetForDB(ownerId, pityCounter);

    // Add server-specific fields
    return {
      ...petData,
      serverId: process.env.SERVER_ID || "default",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  generateEggForDB(ownerId, eggType = EGG_TYPES.BASIC) {
    const eggData = super.generateEggForDB(ownerId, eggType);

    // Add server-specific fields
    return {
      ...eggData,
      serverId: process.env.SERVER_ID || "default",
      expiresAt: this.calculateExpirationDate(eggType),
    };
  }

  calculateExpirationDate(eggType) {
    const expirationDays = {
      [EGG_TYPES.BASIC]: 30,
      [EGG_TYPES.COSMETIC]: 90,
      [EGG_TYPES.ATTRIBUTE]: 45,
    };

    const days = expirationDays[eggType] || 30;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }
}

// Export enhanced service
export const serverRNGService = new ServerRNGService();
export default serverRNGService;
