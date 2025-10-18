// client/src/utils/constants.jsx
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:3001/api";

// Game constants
export const EGG_TYPES = {
  BASIC: "basic",
  COSMETIC: "cosmetic",
  ATTRIBUTE: "attribute",
};

export const PET_RARITIES = {
  COMMON: "Common",
  UNCOMMON: "Uncommon",
  RARE: "Rare",
  EPIC: "Epic",
  LEGENDARY: "Legendary",
  MYTHIC: "Mythic",
  CELESTIAL: "Celestial",
  EXOTIC: "Exotic",
  ULTIMATE: "Ultimate",
  GODLY: "Godly",
};

export const BATTLE_MODES = {
  PVE: "pve",
  PVP: "pvp",
};

export const OPPONENT_DIFFICULTIES = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
  EPIC: "epic",
};

export const CURRENCIES = {
  COINS: "coins",
  ETH: "ETH",
  MATIC: "MATIC",
};

export const TRADE_STATUS = {
  LISTED: "listed",
  SOLD: "sold",
  CANCELLED: "cancelled",
};

export const OFFER_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  COUNTERED: "countered",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
};

// Local storage keys
export const STORAGE_KEYS = {
  TOKEN: "petverse_token",
  USER: "petverse_user",
  THEME: "petverse_theme",
  LANGUAGE: "petverse_language",
};

// Default pagination
export const DEFAULT_PAGINATION = {
  PAGE: 1,
  LIMIT: 20,
};

// API timeout in milliseconds
export const API_TIMEOUT = 30000;

// Cache TTL in milliseconds
export const CACHE_TTL = {
  USER: 60000,
  PETS: 120000,
  MARKETPLACE: 30000,
  EGGS: 180000,
};
