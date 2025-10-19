// src/models/User.js
import { Wallet } from "ethers";
import { Pet } from "./Pet.js";
import { Egg } from "./Egg.js";
import bcrypt from "bcryptjs";

export class User {
  constructor({
    id = crypto.randomUUID(),
    username,
    email,
    passwordHash,
    walletAddress = null,
    privateKey = null,

    // Inventory
    pets = [],
    eggs = [],
    techniques = [],
    skins = [],
    balance = 0,
    freeRolls = 0,

    // Game progression
    level = 1,
    experience = 0,
    rank = "Beginner",
    battlesWon = 0,
    battlesLost = 0,
    completedQuests = [],
    consecutiveDays = 1,
    lastDailyClaim = null,
    lastFreeHatch = null,

    // Authentication
    isGuest = false,

    // Blockchain assets
    nftTokens = [],
    transactions = [],

    // Metadata
    createdAt = new Date(),
    updatedAt = new Date(),
    lastLogin = new Date(),
  }) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.passwordHash = passwordHash;

    // Blockchain identity
    this.walletAddress = walletAddress;
    this.privateKey = privateKey;

    // Game assets
    this.pets = pets.map((pet) => (pet instanceof Pet ? pet : new Pet(pet)));
    this.eggs = eggs.map((egg) =>
      egg instanceof Egg ? egg : new Egg(egg.type, egg.ownerId)
    );
    this.techniques = techniques;
    this.skins = skins;
    this.balance = balance;
    this.freeRolls = freeRolls;

    // Game progression
    this.level = level;
    this.experience = experience;
    this.rank = rank;
    this.battlesWon = battlesWon;
    this.battlesLost = battlesLost;
    this.completedQuests = completedQuests;
    this.consecutiveDays = consecutiveDays;
    this.lastDailyClaim = lastDailyClaim;
    this.lastFreeHatch = lastFreeHatch;

    // Authentication
    this.isGuest = isGuest;

    // Blockchain tracking
    this.nftTokens = nftTokens;
    this.transactions = transactions;

    // Timestamps
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.lastLogin = lastLogin;
  }

  /** --- 🔐 User Management --- **/

  static async createWithWallet(username, email, password) {
    const wallet = Wallet.createRandom();
    const passwordHash = await this.hashPassword(password);

    return new User({
      username,
      email,
      passwordHash,
      walletAddress: wallet.address,
      privateKey: wallet.privateKey,
      balance: 1000,
      freeRolls: 3,
    });
  }

  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password) {
    return await bcrypt.compare(password, this.passwordHash);
  }

  // Static method to find user by wallet address
  static async findByWallet(walletAddress) {
    // This would typically query your database
    // For now, we'll return a mock implementation
    // You'll need to implement the actual database query
    return null; // Replace with actual database lookup
  }

  // Static method to find user by email
  static async findByEmail(email) {
    // This would typically query your database
    // For now, we'll return a mock implementation
    // You'll need to implement the actual database query
    return null; // Replace with actual database lookup
  }

  // Static method to find user by username
  static async findByUsername(username) {
    // This would typically query your database
    // For now, we'll return a mock implementation
    // You'll need to implement the actual database query
    return null; // Replace with actual database lookup
  }

  // Save user to database
  async save() {
    // This would typically save to your database
    // For now, we'll update the updatedAt timestamp
    this.updatedAt = new Date();
    // Implement your database save logic here
    return this;
  }

  // Update last login timestamp
  async updateLastLogin() {
    this.lastLogin = new Date();
    await this.save();
  }

  // Connect wallet to existing user
  async connectWallet(walletAddress, privateKey = null) {
    this.walletAddress = walletAddress.toLowerCase();
    if (privateKey) {
      this.privateKey = privateKey;
    }
    this.updatedAt = new Date();
    await this.save();
  }

  // Convert to database-friendly object (for saving)
  toDatabaseObject() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      passwordHash: this.passwordHash,
      walletAddress: this.walletAddress,
      privateKey: this.privateKey,
      isGuest: this.isGuest,
      pets: this.pets.map((pet) => (pet.toJSON ? pet.toJSON() : pet)),
      eggs: this.eggs.map((egg) => (egg.toJSON ? egg.toJSON() : egg)),
      techniques: this.techniques,
      skins: this.skins,
      balance: this.balance,
      freeRolls: this.freeRolls,
      level: this.level,
      experience: this.experience,
      rank: this.rank,
      battlesWon: this.battlesWon,
      battlesLost: this.battlesLost,
      completedQuests: this.completedQuests,
      consecutiveDays: this.consecutiveDays,
      lastDailyClaim: this.lastDailyClaim,
      lastFreeHatch: this.lastFreeHatch,
      nftTokens: this.nftTokens,
      transactions: this.transactions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin,
    };
  }

  // Create User instance from database object
  static fromDatabaseObject(data) {
    return new User({
      id: data.id,
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      walletAddress: data.walletAddress,
      privateKey: data.privateKey,
      isGuest: data.isGuest,
      pets: data.pets || [],
      eggs: data.eggs || [],
      techniques: data.techniques || [],
      skins: data.skins || [],
      balance: data.balance || 0,
      freeRolls: data.freeRolls || 0,
      level: data.level || 1,
      experience: data.experience || 0,
      rank: data.rank || "Beginner",
      battlesWon: data.battlesWon || 0,
      battlesLost: data.battlesLost || 0,
      completedQuests: data.completedQuests || [],
      consecutiveDays: data.consecutiveDays || 1,
      lastDailyClaim: data.lastDailyClaim,
      lastFreeHatch: data.lastFreeHatch,
      nftTokens: data.nftTokens || [],
      transactions: data.transactions || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastLogin: data.lastLogin,
    });
  }

  /** --- 🎮 Game Functions --- **/

  addPet(pet) {
    if (!(pet instanceof Pet)) {
      throw new Error("Must be a Pet instance");
    }
    pet.ownerId = this.id;
    this.pets.push(pet);
    this.updatedAt = new Date();
  }

  removePet(petId) {
    this.pets = this.pets.filter((pet) => pet.id !== petId);
    this.updatedAt = new Date();
  }

  addEgg(egg) {
    if (!(egg instanceof Egg)) {
      throw new Error("Must be an Egg instance");
    }
    egg.ownerId = this.id;
    this.eggs.push(egg);
    this.updatedAt = new Date();
  }

  hatchEgg(eggIndex) {
    if (eggIndex >= this.eggs.length) {
      throw new Error("Invalid egg index");
    }

    const egg = this.eggs[eggIndex];
    if (egg.isHatched) {
      throw new Error("Egg already hatched");
    }

    const result = egg.hatch();

    if (result instanceof Pet) {
      this.addPet(result);
    } else if (result.type === "Technique") {
      this.techniques.push(result);
    } else if (result.type === "Cosmetic") {
      this.skins.push(result);
    }

    // Remove the hatched egg
    this.eggs.splice(eggIndex, 1);
    this.updatedAt = new Date();

    return result;
  }

  /** --- 💰 Economy --- **/

  addBalance(amount) {
    this.balance += amount;
    this.updatedAt = new Date();
  }

  deductBalance(amount) {
    if (this.balance < amount) {
      throw new Error("Insufficient balance");
    }
    this.balance -= amount;
    this.updatedAt = new Date();
  }

  addFreeRolls(amount) {
    this.freeRolls += amount;
    this.updatedAt = new Date();
  }

  useFreeRoll() {
    if (this.freeRolls <= 0) {
      throw new Error("No free rolls available");
    }
    this.freeRolls--;
    this.updatedAt = new Date();
  }

  /** --- 🔗 Blockchain Integration --- **/

  addTransaction(transaction) {
    this.transactions.push({
      ...transaction,
      timestamp: new Date(),
    });
    this.updatedAt = new Date();
  }

  addNFTToken(tokenId) {
    if (!this.nftTokens.includes(tokenId)) {
      this.nftTokens.push(tokenId);
      this.updatedAt = new Date();
    }
  }

  removeNFTToken(tokenId) {
    this.nftTokens = this.nftTokens.filter((id) => id !== tokenId);
    this.updatedAt = new Date();
  }

  /** --- 📊 Statistics --- **/

  get totalBattles() {
    return this.battlesWon + this.battlesLost;
  }

  get winRate() {
    const total = this.totalBattles;
    return total > 0 ? (this.battlesWon / total) * 100 : 0;
  }

  get petsHatched() {
    return this.pets.length;
  }

  /** --- 🔍 Utility --- **/

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      walletAddress: this.walletAddress,
      isGuest: this.isGuest,
      pets: this.pets.map((pet) => pet.toJSON()),
      eggs: this.eggs.map((egg) => ({
        id: egg.id,
        type: egg.type,
        ownerId: egg.ownerId,
        isHatched: egg.isHatched,
        contents: egg.contents,
      })),
      techniques: this.techniques,
      skins: this.skins,
      balance: this.balance,
      freeRolls: this.freeRolls,
      level: this.level,
      experience: this.experience,
      rank: this.rank,
      battlesWon: this.battlesWon,
      battlesLost: this.battlesLost,
      completedQuests: this.completedQuests,
      consecutiveDays: this.consecutiveDays,
      lastDailyClaim: this.lastDailyClaim,
      lastFreeHatch: this.lastFreeHatch,
      nftTokens: this.nftTokens,
      transactions: this.transactions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin,
      // Virtual properties
      totalBattles: this.totalBattles,
      winRate: this.winRate,
      petsHatched: this.petsHatched,
    };
  }
}
