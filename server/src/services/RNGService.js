import {
  EGG_TYPES,
  SKIN_RARITIES,
  TECHNIQUES,
  PET_TYPES,
  RARITIES,
} from "../utils/constants.js";
import { weightedRandom, generateRandomPet } from "../utils/rng.js";
import { Pet } from "./Pet.js";
import { Egg } from "./Egg.js";

export class RNGService {
  constructor() {
    this.pityCounters = new Map(); // Track pity counters per user
  }

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
      experience: 0,
      level: 1,
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

  // Get egg drop rates for catalog display
  getEggDropRates(eggType) {
    const dropRates = {
      BASIC: {
        common: "50%",
        uncommon: "30%",
        rare: "15%",
        epic: "4%",
        legendary: "1%",
      },
      PREMIUM: {
        common: "30%",
        uncommon: "40%",
        rare: "20%",
        epic: "8%",
        legendary: "2%",
      },
      COSMETIC: {
        common_skin: "60%",
        rare_skin: "30%",
        epic_animation: "8%",
        legendary_effect: "2%",
      },
      MYSTERY: {
        random: "100%",
      },
    };

    return dropRates[eggType] || dropRates.BASIC;
  }

  // Get random pet type for preview
  getRandomPetType() {
    const petTypes = Object.values(PET_TYPES);
    return petTypes[Math.floor(Math.random() * petTypes.length)];
  }

  // Generate a pet with pity system
  generatePet(pityCounter = 0) {
    // Increase rare drop chance based on pity counter
    const pityBonus = Math.min(pityCounter * 0.01, 0.1); // Max 10% bonus
    const rarity = this.calculateRarityWithPity(pityBonus);

    const petType = this.getRandomPetType();
    const isShiny = Math.random() < 0.01; // 1% shiny chance

    return {
      id: crypto.randomUUID(),
      name: this.generatePetName(petType, rarity),
      type: petType,
      rarity: rarity,
      ability: this.generateRandomAbility(),
      technique: null,
      skin: null,
      stats: this.generateBaseStats(rarity, petType),
      isShiny: isShiny,
      title: isShiny ? "Shiny" : null,
    };
  }

  // Generate egg data
  generateEggData(eggType = EGG_TYPES.BASIC) {
    return {
      id: crypto.randomUUID(),
      type: eggType,
      rarity: this.getEggRarity(eggType),
      hatchDuration: this.getHatchDuration(eggType),
      cost: this.getEggCost(eggType),
      description: this.getEggDescription(eggType),
    };
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

  // Helper methods for pet generation
  calculateRarityWithPity(pityBonus = 0) {
    const baseRates = {
      common: 50,
      uncommon: 30,
      rare: 15,
      epic: 4,
      legendary: 1,
    };

    // Adjust rates with pity bonus
    const adjustedRates = { ...baseRates };
    adjustedRates.legendary += pityBonus * 100;
    adjustedRates.epic += pityBonus * 50;

    // Normalize rates
    const total = Object.values(adjustedRates).reduce(
      (sum, rate) => sum + rate,
      0
    );
    const normalizedRates = Object.keys(adjustedRates).map((rarity) => ({
      name: rarity,
      chance: (adjustedRates[rarity] / total) * 100,
    }));

    return weightedRandom(normalizedRates).name;
  }

  generatePetName(petType, rarity) {
    const prefixes = {
      common: ["Happy", "Friendly", "Playful"],
      uncommon: ["Brave", "Swift", "Clever"],
      rare: ["Mystic", "Royal", "Ancient"],
      epic: ["Divine", "Celestial", "Eternal"],
      legendary: ["Omega", "Alpha", "Ultimate"],
    };

    const names = {
      DRAGON: ["Scale", "Flame", "Wing"],
      PHOENIX: ["Blaze", "Ash", "Ember"],
      UNICORN: ["Sparkle", "Dream", "Magic"],
      GRIFFIN: ["Sky", "Claw", "Feather"],
      KRAKEN: ["Deep", "Wave", "Tide"],
    };

    const prefixPool = prefixes[rarity] || prefixes.common;
    const namePool = names[petType] || ["Friend", "Companion", "Buddy"];

    const prefix = prefixPool[Math.floor(Math.random() * prefixPool.length)];
    const name = namePool[Math.floor(Math.random() * namePool.length)];

    return `${prefix} ${name}`;
  }

  generateRandomAbility() {
    const abilities = [
      { name: "Fire Breath", type: "offensive", power: 15 },
      { name: "Healing Aura", type: "support", power: 10 },
      { name: "Electric Shock", type: "offensive", power: 12 },
      { name: "Protective Shield", type: "defensive", power: 8 },
      { name: "Speed Boost", type: "utility", power: 5 },
    ];

    return abilities[Math.floor(Math.random() * abilities.length)];
  }

  generateBaseStats(rarity, petType) {
    const rarityMultipliers = {
      common: 1.0,
      uncommon: 1.2,
      rare: 1.5,
      epic: 2.0,
      legendary: 3.0,
    };

    const typeBonuses = {
      DRAGON: { dmg: 5, hp: 3 },
      PHOENIX: { dmg: 4, hp: 4 },
      UNICORN: { dmg: 3, hp: 5 },
      GRIFFIN: { dmg: 4, hp: 4 },
      KRAKEN: { dmg: 5, hp: 3 },
    };

    const multiplier = rarityMultipliers[rarity] || 1.0;
    const bonus = typeBonuses[petType] || { dmg: 0, hp: 0 };

    return {
      dmg: Math.round((10 + bonus.dmg) * multiplier),
      hp: Math.round((50 + bonus.hp) * multiplier),
      range: 1,
      spa: +(1.0 * (1 - (multiplier - 1) * 0.1)).toFixed(2), // SPA decreases with rarity
      critChance: Math.min(0.1 * multiplier, 0.3),
      critDamage: Math.min(0.5 * multiplier, 2.0),
      moneyBonus: Math.min(0.05 * multiplier, 0.15),
    };
  }

  getEggRarity(eggType) {
    const eggRarities = {
      [EGG_TYPES.BASIC]: "common",
      [EGG_TYPES.PREMIUM]: "rare",
      [EGG_TYPES.COSMETIC]: "uncommon",
      [EGG_TYPES.ATTRIBUTE]: "epic",
      [EGG_TYPES.MYSTERY]: "special",
    };

    return eggRarities[eggType] || "common";
  }

  getHatchDuration(eggType) {
    const durations = {
      [EGG_TYPES.BASIC]: 60, // 1 minute
      [EGG_TYPES.PREMIUM]: 300, // 5 minutes
      [EGG_TYPES.COSMETIC]: 180, // 3 minutes
      [EGG_TYPES.ATTRIBUTE]: 600, // 10 minutes
      [EGG_TYPES.MYSTERY]: 240, // 4 minutes
    };

    return durations[eggType] || 60;
  }

  getEggCost(eggType) {
    const costs = {
      [EGG_TYPES.BASIC]: 100,
      [EGG_TYPES.PREMIUM]: 500,
      [EGG_TYPES.COSMETIC]: 250,
      [EGG_TYPES.ATTRIBUTE]: 750,
      [EGG_TYPES.MYSTERY]: 350,
    };

    return costs[eggType] || 100;
  }

  getEggDescription(eggType) {
    const descriptions = {
      [EGG_TYPES.BASIC]: "A basic egg containing common pets",
      [EGG_TYPES.PREMIUM]: "A premium egg with better rarity chances",
      [EGG_TYPES.COSMETIC]: "Contains cosmetic items and skins",
      [EGG_TYPES.ATTRIBUTE]: "Grants powerful techniques and abilities",
      [EGG_TYPES.MYSTERY]: "A mysterious egg with random contents",
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

  generateEggForDB(ownerId, eggType = "BASIC") {
    const eggData = super.generateEggForDB(ownerId, eggType);

    // Add server-specific fields
    return {
      ...eggData,
      serverId: process.env.SERVER_ID || "default",
      createdAt: new Date(),
      expiresAt: this.calculateExpirationDate(eggType),
    };
  }

  calculateExpirationDate(eggType) {
    const expirationDays = {
      [EGG_TYPES.BASIC]: 30,
      [EGG_TYPES.PREMIUM]: 60,
      [EGG_TYPES.COSMETIC]: 90,
      [EGG_TYPES.ATTRIBUTE]: 45,
      [EGG_TYPES.MYSTERY]: 30,
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
