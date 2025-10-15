// Game constants that match backend
const TIERS = {
  COMMON: 0,
  UNCOMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
};

const PET_TYPES = {
  FIRE: 0,
  WATER: 1,
  EARTH: 2,
  AIR: 3,
  LIGHT: 4,
  DARK: 5,
};

const EGG_TYPES = {
  BASIC: 0,
  PREMIUM: 1,
  COSMETIC: 2,
  MYSTERY: 3,
};

// Marketplace fees (basis points: 100 = 1%)
const MARKETPLACE_FEE = 250; // 2.5%
const ROYALTY_FEE = 100; // 1.0%

// Fusion costs
const FUSION_COSTS = {
  [TIERS.UNCOMMON]: 100,
  [TIERS.RARE]: 250,
  [TIERS.EPIC]: 500,
  [TIERS.LEGENDARY]: 1000,
};

module.exports = {
  TIERS,
  PET_TYPES,
  EGG_TYPES,
  MARKETPLACE_FEE,
  ROYALTY_FEE,
  FUSION_COSTS,
};
