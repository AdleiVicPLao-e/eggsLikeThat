import { TIERS, TYPES } from "./constants.jsx";
import { Formatters } from "pet-game-shared";

// Re-export shared formatters
export const {
  formatTier,
  formatType,
  formatCurrency,
  formatNumber,
  formatPercentage,
} = Formatters;

// Client-specific rarity utilities
export const getTierColor = (tier) => {
  return TIERS[tier]?.color || "#6B7280";
};

export const getTierBgColor = (tier) => {
  return TIERS[tier]?.bgColor || "bg-gray-500";
};

export const getTierTextColor = (tier) => {
  return TIERS[tier]?.textColor || "text-gray-400";
};

export const getTypeColor = (type) => {
  return TYPES[type]?.color || "#6B7280";
};

export const getTypeBgColor = (type) => {
  return TYPES[type]?.bgColor || "bg-gray-500";
};

export const getTypeEmoji = (type) => {
  return TYPES[type]?.emoji || "❓";
};

export const getTierEmoji = (tier) => {
  return TIERS[tier]?.emoji || "⚪";
};

export const calculatePowerLevel = (pet) => {
  const { attack, defense, speed, health } = pet.stats;
  const tierMultiplier = TIERS[pet.tier]?.statMultiplier || 1;
  const levelMultiplier = 1 + (pet.level - 1) * 0.1;

  const basePower = attack + defense + speed + health / 10;
  return Math.round(basePower * tierMultiplier * levelMultiplier);
};

export const getTypeAdvantage = (attackerType, defenderType) => {
  const typeData = TYPES[attackerType];
  if (!typeData) return "neutral";

  if (typeData.strengths.includes(defenderType)) {
    return "strong";
  } else if (typeData.weaknesses.includes(defenderType)) {
    return "weak";
  }

  return "neutral";
};

export const getTypeAdvantageMultiplier = (attackerType, defenderType) => {
  const advantage = getTypeAdvantage(attackerType, defenderType);

  switch (advantage) {
    case "strong":
      return 1.5;
    case "weak":
      return 0.5;
    default:
      return 1;
  }
};

export const getEvolutionRequirements = (currentTier, targetTier) => {
  const tierOrder = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);

  if (currentIndex >= targetIndex) return null;

  const cost = (targetIndex - currentIndex) * 100;
  const materialPets = targetIndex - currentIndex + 1;

  return {
    cost,
    materialPets,
    successChance: Math.max(70 - targetIndex * 10, 30),
  };
};

export const getHatchProbability = (eggType, tier) => {
  const probabilities = {
    BASIC: { COMMON: 50, UNCOMMON: 30, RARE: 15, EPIC: 4, LEGENDARY: 1 },
    PREMIUM: { COMMON: 30, UNCOMMON: 40, RARE: 20, EPIC: 8, LEGENDARY: 2 },
    COSMETIC: { COMMON: 20, UNCOMMON: 35, RARE: 30, EPIC: 12, LEGENDARY: 3 },
    MYSTERY: { COMMON: 25, UNCOMMON: 30, RARE: 25, EPIC: 15, LEGENDARY: 5 },
  };

  return probabilities[eggType]?.[tier] || 0;
};
