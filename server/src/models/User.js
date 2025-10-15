import mongoose from "mongoose";
import { config } from "../config/env.js";

const userSchema = new mongoose.Schema(
  {
    // Authentication
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      match: [/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address format"],
    },

    // Optional email for notifications
    email: {
      type: String,
      sparse: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Invalid email format",
      ],
    },

    // Profile
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 30,
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores",
      ],
    },

    // Game progression
    level: {
      type: Number,
      default: 1,
    },
    experience: {
      type: Number,
      default: 0,
    },
    coins: {
      type: Number,
      default: 1000,
    },

    // Free roll system
    freeRolls: {
      type: Number,
      default: config.DAILY_FREE_ROLLS,
    },
    lastFreeRoll: {
      type: Date,
      default: Date.now,
    },

    // Inventory
    ownedPets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Pet",
      },
    ],
    ownedEggs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Egg",
      },
    ],

    // Stats
    battlesWon: {
      type: Number,
      default: 0,
    },
    battlesLost: {
      type: Number,
      default: 0,
    },
    petsHatched: {
      type: Number,
      default: 0,
    },

    // Settings
    preferences: {
      notifications: {
        type: Boolean,
        default: true,
      },
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "auto",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for common queries
userSchema.index({ walletAddress: 1 });
userSchema.index({ username: 1 });
userSchema.index({ level: -1, experience: -1 });

// Virtual for total battles
userSchema.virtual("totalBattles").get(function () {
  return this.battlesWon + this.battlesLost;
});

// Virtual for win rate
userSchema.virtual("winRate").get(function () {
  const total = this.totalBattles;
  return total > 0 ? ((this.battlesWon / total) * 100).toFixed(1) : 0;
});

// Method to check if user can get free roll
userSchema.methods.canGetFreeRoll = function () {
  const now = new Date();
  const lastRoll = new Date(this.lastFreeRoll);
  const hoursDiff = (now - lastRoll) / (1000 * 60 * 60);

  return hoursDiff >= config.FREE_ROLL_COOLDOWN_HOURS || this.freeRolls > 0;
};

// Method to add experience and level up
userSchema.methods.addExperience = function (exp) {
  this.experience += exp;

  // Simple level up formula: level^2 * 100
  const expNeeded = Math.pow(this.level, 2) * 100;
  if (this.experience >= expNeeded) {
    this.level += 1;
    this.experience -= expNeeded;
    return { leveledUp: true, newLevel: this.level };
  }

  return { leveledUp: false };
};

// Static method to find by wallet address
userSchema.statics.findByWallet = function (walletAddress) {
  return this.findOne({ walletAddress: walletAddress.toLowerCase() });
};

export default mongoose.model("User", userSchema);
