// Re-export shared constants
export { default as TIERS } from "pet-game-shared";
export { default as TYPES } from "pet-game-shared";
export { default as ABILITIES } from "pet-game-shared";

// Client-specific constants
export const CONTRACT_ADDRESSES = {
  PET_NFT: import.meta.env.VITE_PET_NFT_ADDRESS || "0x...",
  EGG_ITEM: import.meta.env.VITE_EGG_ITEM_ADDRESS || "0x...",
  MARKETPLACE: import.meta.env.VITE_MARKETPLACE_ADDRESS || "0x...",
  FUSION_SYSTEM: import.meta.env.VITE_FUSION_SYSTEM_ADDRESS || "0x...",
  GAME_TOKEN: import.meta.env.VITE_GAME_TOKEN_ADDRESS || "0x...",
};

export const RPC_URLS = {
  1: "https://mainnet.infura.io/v3/your-project-id",
  137: "https://polygon-rpc.com",
  80001: "https://rpc-mumbai.maticvigil.com",
  31337: "http://localhost:8545",
};

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export const GAME_CONFIG = {
  DAILY_FREE_ROLLS: 1,
  FREE_ROLL_COOLDOWN_HOURS: 24,
  HATCH_COST: 100,
  FUSION_MIN_PETS: 2,
  FUSION_MAX_PETS: 5,
  MAX_PET_LEVEL: 100,
  BATTLE_MAX_PETS: 3,
};

export const LOCAL_STORAGE_KEYS = {
  USER_SESSION: "petverse_user_session",
  WALLET_CONNECTION: "petverse_wallet_connected",
  GAME_SETTINGS: "petverse_game_settings",
};
