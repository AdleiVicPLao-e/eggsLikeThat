import dotenv from "dotenv";

dotenv.config();

export const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3001,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  // Database
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/petgame",

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // Blockchain
  ETHEREUM_RPC_URL: process.env.ETHEREUM_RPC_URL,
  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL,
  CONTRACT_PET_NFT: process.env.CONTRACT_PET_NFT,
  CONTRACT_MARKETPLACE: process.env.CONTRACT_MARKETPLACE,

  // Game Settings
  DAILY_FREE_ROLLS: parseInt(process.env.DAILY_FREE_ROLLS) || 1,
  FREE_ROLL_COOLDOWN_HOURS:
    parseInt(process.env.FREE_ROLL_COOLDOWN_HOURS) || 24,
};

// Validate required environment variables
const required = ["JWT_SECRET", "MONGODB_URI"];
required.forEach((key) => {
  if (!config[key]) {
    throw new Error(`Environment variable ${key} is required`);
  }
});
