// src/models/User.js
import { Wallet } from "ethers";
import { Pet } from "./Pet.js";
import { Egg } from "./Egg.js";

export class User {
  constructor({
    id = crypto.randomUUID(),
    username,
    email,
    passwordHash, // In real app, use proper hashing like bcrypt
    walletAddress = null,
    privateKey = null, // In production, never store plain private keys!

    // Inventory
    pets = [],
    eggs = [],
    techniques = [],
    skins = [],
    balance = 0, // In-game currency

    // Blockchain assets
    nftTokens = [], // Track NFT token IDs owned
    transactions = [], // Transaction history

    // Game progression
    level = 1,
    experience = 0,
    rank = "Beginner",

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
    this.privateKey = privateKey; // ⚠️ Remove in production!

    // Game assets
    this.pets = pets.map((pet) => (pet instanceof Pet ? pet : new Pet(pet)));
    this.eggs = eggs.map((egg) =>
      egg instanceof Egg ? egg : new Egg(egg.type, egg.ownerId)
    );
    this.techniques = techniques;
    this.skins = skins;
    this.balance = balance;

    // Blockchain tracking
    this.nftTokens = nftTokens;
    this.transactions = transactions;

    // Progression
    this.level = level;
    this.experience = experience;
    this.rank = rank;

    // Timestamps
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.lastLogin = lastLogin;
  }

  /** --- 🔐 User Management --- **/

  static async createWithWallet(username, email, password) {
    // Generate new blockchain wallet
    const wallet = Wallet.createRandom();

    return new User({
      username,
      email,
      passwordHash: await this.hashPassword(password), // Implement proper hashing
      walletAddress: wallet.address,
      privateKey: wallet.privateKey, // ⚠️ Only for demo - use secure key management
    });
  }

  static hashPassword(password) {
    // Implement proper password hashing (bcrypt, etc.)
    return Promise.resolve(`hashed_${password}`); // Placeholder
  }

  verifyPassword(password) {
    return this.passwordHash === `hashed_${password}`; // Placeholder
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

  /** --- 🔍 Utility --- **/

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      walletAddress: this.walletAddress,
      // Don't expose private key in JSON output!
      pets: this.pets.map((pet) => pet.toJSON()),
      eggs: this.eggs.map((egg) => ({
        type: egg.type,
        ownerId: egg.ownerId,
        isHatched: egg.isHatched,
        contents: egg.contents,
      })),
      techniques: this.techniques,
      skins: this.skins,
      balance: this.balance,
      nftTokens: this.nftTokens,
      transactions: this.transactions,
      level: this.level,
      experience: this.experience,
      rank: this.rank,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastLogin: this.lastLogin,
    };
  }
}
