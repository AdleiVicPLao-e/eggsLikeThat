const tiers = require("../constants/tiers.json");
const types = require("../constants/types.json");
const abilities = require("../constants/abilities.json");

class RNGService {
  constructor(seed = null) {
    this.seed = seed;
    if (seed) {
      this.rng = this.seededRandom(seed);
    } else {
      this.rng = Math.random;
    }
  }

  // Seeded random number generator for deterministic results
  seededRandom(seed) {
    return function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  // Weighted random selection
  weightedRandom(weights) {
    const totalWeight = Object.values(weights).reduce(
      (sum, weight) => sum + weight,
      0
    );
    let random = this.rng() * totalWeight;

    for (const [key, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return key;
      }
    }

    return Object.keys(weights)[0];
  }

  // Roll pet tier with pity system
  rollTier(pityCounter = 0) {
    // Pity system: every 50 rolls guarantees epic or legendary
    if (pityCounter >= 49) {
      return this.rng() < 0.2 ? "LEGENDARY" : "EPIC";
    }

    const tierWeights = {};
    Object.entries(tiers).forEach(([tier, data]) => {
      tierWeights[tier] = data.weight;
    });

    return this.weightedRandom(tierWeights);
  }

  // Roll pet type
  rollType() {
    const typeKeys = Object.keys(types);
    const randomIndex = Math.floor(this.rng() * typeKeys.length);
    return typeKeys[randomIndex];
  }

  // Roll abilities based on pet type and tier
  rollAbilities(petType, tier) {
    const abilityPool = abilities[`${petType}_ABILITIES`];
    if (!abilityPool) return [];

    const availableAbilities = Object.values(abilityPool).filter((ability) =>
      this.isAbilityAvailable(ability, tier)
    );

    // Determine number of abilities based on tier
    let abilityCount = 1;
    if (tier === "RARE") abilityCount = 2;
    if (tier === "EPIC") abilityCount = 2;
    if (tier === "LEGENDARY") abilityCount = 3;

    // Shuffle and select abilities
    const shuffled = [...availableAbilities].sort(() => this.rng() - 0.5);
    return shuffled.slice(0, Math.min(abilityCount, shuffled.length));
  }

  // Check if ability is available for given tier
  isAbilityAvailable(ability, tier) {
    const tierOrder = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
    const abilityTierIndex = tierOrder.indexOf(ability.tier);
    const petTierIndex = tierOrder.indexOf(tier);

    return abilityTierIndex <= petTierIndex;
  }

  // Generate stats based on tier
  generateStats(tier) {
    const tierData = tiers[tier];
    const multiplier = tierData.statMultiplier;
    const variance = 0.1; // 10% random variance

    const baseStats = {
      attack: 50,
      defense: 30,
      speed: 40,
      health: 100,
    };

    const stats = {};
    for (const [stat, baseValue] of Object.entries(baseStats)) {
      const variedMultiplier =
        multiplier * (1 + (this.rng() * variance - variance / 2));
      stats[stat] = Math.floor(baseValue * variedMultiplier);
    }

    return stats;
  }

  // Generate pet name based on tier and type
  generateName(tier, petType) {
    const prefixes = {
      COMMON: ["Young", "Small", "Tiny", "Little"],
      UNCOMMON: ["Brave", "Swift", "Clever", "Wise"],
      RARE: ["Mighty", "Noble", "Ancient", "Mystic"],
      EPIC: ["Royal", "Divine", "Celestial", "Eternal"],
      LEGENDARY: ["Legendary", "Mythic", "Primordial", "Omnipotent"],
    };

    const suffixes = {
      FIRE: ["Dragon", "Phoenix", "Salamander", "Imp"],
      WATER: ["Serpent", "Leviathan", "Kraken", "Nymph"],
      EARTH: ["Golem", "Titan", "Behemoth", "Guardian"],
      AIR: ["Griffin", "Roc", "Zephyr", "Sylph"],
      LIGHT: ["Unicorn", "Angel", "Pegasus", "Cherub"],
      DARK: ["Demon", "Shadow", "Voidling", "Wraith"],
    };

    const prefixList = prefixes[tier] || prefixes.COMMON;
    const suffixList = suffixes[petType] || suffixes.FIRE;

    const prefix = prefixList[Math.floor(this.rng() * prefixList.length)];
    const suffix = suffixList[Math.floor(this.rng() * suffixList.length)];

    return `${prefix} ${suffix}`;
  }

  // Calculate battle outcome
  calculateBattleOutcome(playerPet, opponentPet) {
    const playerPower = this.calculatePetPower(playerPet);
    const opponentPower = this.calculatePetPower(opponentPet);

    // Add type advantage
    const typeMultiplier = this.getTypeMultiplier(
      playerPet.type,
      opponentPet.type
    );
    const adjustedPlayerPower = playerPower * typeMultiplier;

    // Add randomness (10% variance)
    const playerRoll = adjustedPlayerPower * (0.9 + this.rng() * 0.2);
    const opponentRoll = opponentPower * (0.9 + this.rng() * 0.2);

    if (playerRoll > opponentRoll) {
      return {
        winner: "player",
        margin: (playerRoll - opponentRoll) / playerRoll,
        critical: this.rng() < 0.1, // 10% chance for critical win
      };
    } else {
      return {
        winner: "opponent",
        margin: (opponentRoll - playerRoll) / opponentRoll,
        critical: this.rng() < 0.1,
      };
    }
  }

  // Calculate pet power for battles
  calculatePetPower(pet) {
    const { attack, defense, speed, health } = pet.stats;
    const tierMultiplier = tiers[pet.tier].statMultiplier;
    const levelMultiplier = 1 + (pet.level - 1) * 0.1;

    const basePower = attack + defense + speed + health / 10;
    return basePower * tierMultiplier * levelMultiplier;
  }

  // Get type advantage multiplier
  getTypeMultiplier(attackerType, defenderType) {
    const typeData = types[attackerType];
    if (!typeData) return 1;

    if (typeData.strengths.includes(defenderType)) {
      return 1.5; // Super effective
    } else if (typeData.weaknesses.includes(defenderType)) {
      return 0.5; // Not very effective
    }

    return 1; // Normal effectiveness
  }

  // Calculate fusion success chance
  calculateFusionSuccess(materialPets, targetTier) {
    const baseChance = 70; // 70% base chance
    let tierBonus = 0;

    materialPets.forEach((pet) => {
      const tierValue = tiers[pet.tier].id;
      tierBonus += tierValue * 5; // 5% per tier level
    });

    return Math.min(baseChance + tierBonus, 95); // Max 95%
  }

  // Generate random egg contents preview
  generateEggPreview(eggType) {
    const previews = [];
    const eggTypes = {
      BASIC: { minTier: "COMMON", maxTier: "RARE" },
      PREMIUM: { minTier: "UNCOMMON", maxTier: "EPIC" },
      COSMETIC: { minTier: "RARE", maxTier: "LEGENDARY" },
      MYSTERY: { minTier: "COMMON", maxTier: "LEGENDARY" },
    };

    const config = eggTypes[eggType] || eggTypes.BASIC;
    const tierOrder = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
    const minIndex = tierOrder.indexOf(config.minTier);
    const maxIndex = tierOrder.indexOf(config.maxTier);

    for (let i = 0; i < 3; i++) {
      const tierIndex =
        Math.floor(this.rng() * (maxIndex - minIndex + 1)) + minIndex;
      const tier = tierOrder[tierIndex];
      const type = this.rollType();

      previews.push({
        tier,
        type,
        probability: this.calculateProbability(tier, config),
        stats: this.generateStats(tier),
      });
    }

    return previews;
  }

  calculateProbability(tier, config) {
    const tierOrder = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
    const minIndex = tierOrder.indexOf(config.minTier);
    const maxIndex = tierOrder.indexOf(config.maxTier);
    const tierIndex = tierOrder.indexOf(tier);

    // Higher tiers have lower probability
    const rank = tierIndex - minIndex + 1;
    const totalRanks = maxIndex - minIndex + 1;

    return Math.round((1 - (rank - 1) / totalRanks) * 100) + "%";
  }
}

// Create default instance
const defaultRNG = new RNGService();

// Export both class and default instance
module.exports = {
  RNGService,
  rng: defaultRNG,
};
