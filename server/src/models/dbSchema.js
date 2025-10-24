import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Wallet } from "ethers";

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },

  // Blockchain identity
  walletAddress: { type: String, unique: true, sparse: true },
  encryptedPrivateKey: { type: String },

  // Game assets (references to other collections)
  petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pet" }],
  eggIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Egg" }],
  techniqueIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Technique" }],
  skinIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skin" }],

  // Game progression
  balance: { type: Number, default: 0 },
  freeRolls: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  rank: { type: String, default: "Beginner" },
  battlesWon: { type: Number, default: 0 },
  battlesLost: { type: Number, default: 0 },
  completedQuests: [
    {
      questId: String,
      completedAt: { type: Date, default: Date.now },
      rewards: Object,
    },
  ],
  consecutiveDays: { type: Number, default: 1 },
  lastDailyClaim: { type: Date, default: null },
  lastFreeHatch: { type: Date, default: null },

  // Authentication
  isGuest: { type: Boolean, default: false },

  // Blockchain tracking
  nftTokens: [
    {
      tokenId: String,
      contractAddress: String,
      tokenType: String,
      petId: { type: mongoose.Schema.Types.ObjectId, ref: "Pet" },
      metadata: Object,
    },
  ],

  transactions: [
    {
      type: { type: String, required: true },
      tokenId: String,
      txHash: String,
      from: String,
      to: String,
      price: Number,
      status: { type: String, default: "pending" },
      timestamp: { type: Date, default: Date.now },
    },
  ],

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
});

// Add methods to userSchema
userSchema.methods.verifyPassword = async function (password) {
  return await bcrypt.compare(password, this.passwordHash);
};

userSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  return await this.save();
};

userSchema.methods.connectWallet = async function (
  walletAddress,
  encryptedPrivateKey = null
) {
  this.walletAddress = walletAddress.toLowerCase();
  if (encryptedPrivateKey) {
    this.encryptedPrivateKey = encryptedPrivateKey;
  }
  this.updatedAt = new Date();
  return await this.save();
};

userSchema.methods.addBalance = async function (amount) {
  this.balance += amount;
  this.updatedAt = new Date();
  return await this.save();
};

userSchema.methods.deductBalance = async function (amount) {
  if (this.balance < amount) {
    throw new Error("Insufficient balance");
  }
  this.balance -= amount;
  this.updatedAt = new Date();
  return await this.save();
};

userSchema.methods.addFreeRolls = async function (amount) {
  this.freeRolls += amount;
  this.updatedAt = new Date();
  return await this.save();
};

userSchema.methods.useFreeRoll = async function () {
  if (this.freeRolls <= 0) {
    throw new Error("No free rolls available");
  }
  this.freeRolls--;
  this.updatedAt = new Date();
  return await this.save();
};

// Add virtual properties
userSchema.virtual("petsHatched").get(function () {
  return this.petIds ? this.petIds.length : 0;
});

userSchema.virtual("totalBattles").get(function () {
  return (this.battlesWon || 0) + (this.battlesLost || 0);
});

userSchema.virtual("winRate").get(function () {
  const total = this.totalBattles;
  return total > 0 ? ((this.battlesWon || 0) / total) * 100 : 0;
});

// Add static methods
userSchema.statics.createWithWallet = async function (
  username,
  email,
  password
) {
  const wallet = Wallet.createRandom();
  const passwordHash = await bcrypt.hash(password, 12);

  return this.create({
    username,
    email,
    passwordHash,
    walletAddress: wallet.address,
    encryptedPrivateKey: wallet.privateKey,
    balance: 1000,
    freeRolls: 3,
  });
};

userSchema.statics.hashPassword = async function (password) {
  return await bcrypt.hash(password, 12);
};

// Ensure virtuals are included in JSON output
userSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.passwordHash;
    delete ret.encryptedPrivateKey;
    delete ret.__v;
    return ret;
  },
});

// Pet Schema
const petSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  type: { type: String, required: true },
  rarity: { type: String, required: true },
  ability: { type: String, required: true },
  technique: { type: String, default: null },
  skin: { type: String, default: null },

  // Core stats
  stats: {
    dmg: { type: Number, default: 10 },
    hp: { type: Number, default: 50 },
    range: { type: Number, default: 1 },
    spa: { type: Number, default: 1.0 },
    critChance: { type: Number, default: 0 },
    critDamage: { type: Number, default: 0 },
    moneyBonus: { type: Number, default: 0 },
  },

  // Battle state
  currentHP: { type: Number, default: 50 },
  statusEffects: [
    {
      name: String,
      duration: Number,
      effect: Object,
    },
  ],
  isAlive: { type: Boolean, default: true },

  // Progression
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  evolutionStage: { type: Number, default: 1 },
  evolutions: [{ type: String }],
  battlesWon: { type: Number, default: 0 },
  battlesLost: { type: Number, default: 0 },

  // Cosmetics
  title: { type: String, default: null },
  isShiny: { type: Boolean, default: false },

  // Blockchain
  nftTokenId: { type: String, default: null },
  isListed: { type: Boolean, default: false },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Egg Schema
const eggSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: { type: String, required: true },
  isHatched: { type: Boolean, default: false },
  contents: { type: Object, default: null },
  hatchDuration: { type: Number, default: 60 },
  cost: { type: Number, default: 100 },
  description: { type: String, default: "A mysterious egg" },
  nftTokenId: { type: String, default: null },
  isListed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Technique Schema
const techniqueSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  rarity: { type: String, required: true },
  effect: { type: Object, required: true },
  type: { type: String, default: "Technique" },
  obtainedAt: { type: Date, default: Date.now },
});

// Skin Schema
const skinSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: { type: String, required: true },
  rarity: { type: String, required: true },
  type: { type: String, default: "Cosmetic" },
  obtainedAt: { type: Date, default: Date.now },
});

// Battle History Schema
const battleHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  result: { type: String, required: true }, // victory or defeat
  opponent: { type: String, required: true },
  userPets: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pet" }],
  rewards: { type: Object, default: {} },
  battleData: { type: Object, default: {} },
  date: { type: Date, default: Date.now },
});

// Create models
export const User = mongoose.model("User", userSchema);
export const Pet = mongoose.model("Pet", petSchema);
export const Egg = mongoose.model("Egg", eggSchema);
export const Technique = mongoose.model("Technique", techniqueSchema);
export const Skin = mongoose.model("Skin", skinSchema);
export const BattleHistory = mongoose.model(
  "BattleHistory",
  battleHistorySchema
);
