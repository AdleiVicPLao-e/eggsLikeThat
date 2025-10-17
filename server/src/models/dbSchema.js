// src/models/dbSchemas.js
import mongoose from "mongoose";

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },

  // Blockchain identity
  walletAddress: { type: String, unique: true, sparse: true },
  encryptedPrivateKey: { type: String }, // Encrypted in production

  // Game assets (references to other collections)
  petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Pet" }],
  eggIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Egg" }],
  techniqueIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Technique" }],
  skinIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Skin" }],

  // Game progression
  balance: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  rank: { type: String, default: "Beginner" },

  // Blockchain tracking
  nftTokens: [
    {
      tokenId: String,
      contractAddress: String,
      tokenType: String, // 'pet' or 'egg'
      petId: { type: mongoose.Schema.Types.ObjectId, ref: "Pet" }, // Reference if it's a pet
      metadata: Object,
    },
  ],

  transactions: [
    {
      type: { type: String, required: true }, // MINT_PET, TRANSFER, LIST, BUY
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
  contents: { type: Object, default: null }, // Pet, Technique, or Skin data
  nftTokenId: { type: String, default: null },
  isListed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

// Marketplace Listing Schema
const listingSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  itemType: { type: String, required: true }, // 'pet' or 'egg'
  itemId: { type: mongoose.Schema.Types.ObjectId, required: true }, // Pet._id or Egg._id
  nftContract: { type: String, required: true },
  tokenId: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: "IN_GAME" }, // IN_GAME or CRYPTO
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  soldAt: { type: Date, default: null },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
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

// Create models
export const User = mongoose.model("User", userSchema);
export const Pet = mongoose.model("Pet", petSchema);
export const Egg = mongoose.model("Egg", eggSchema);
export const Listing = mongoose.model("Listing", listingSchema);
export const Technique = mongoose.model("Technique", techniqueSchema);
export const Skin = mongoose.model("Skin", skinSchema);
