// src/models/User.js
import { Wallet } from "ethers";
import { Pet } from "./Pet.js";
import { Egg } from "./Egg.js";
import bcrypt from "bcryptjs";
import {
  User as MongooseUser,
  Pet as MongoosePet,
  Egg as MongooseEgg,
  Technique as MongooseTechnique,
  Skin as MongooseSkin,
} from "./dbSchema.js";

export class User {
  constructor({
    id = null, // Will be set by MongoDB _id
    username,
    email = null,
    passwordHash = null,
    walletAddress = null,
    encryptedPrivateKey = null, // Changed from privateKey for security

    // Inventory (will be populated from database references)
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
    this._id = id; // MongoDB ID
    this.id = id; // Alias for compatibility
    this.username = username;
    this.email = email;
    this.passwordHash = passwordHash;

    // For guest users, generate placeholder values if not provided
    if (isGuest) {
      if (!this.email) {
        this.email = `guest_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}@petverse.guest`;
      }
      if (!this.passwordHash) {
        // Generate a random password hash for guest users
        const tempPassword =
          Math.random().toString(36).substring(2) + Date.now().toString(36);
        this.passwordHash = tempPassword; // This will be hashed in save() method
      }
    }

    // Blockchain identity
    this.walletAddress = walletAddress;
    this.encryptedPrivateKey = encryptedPrivateKey;

    // Game assets (will be populated from database)
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

  /** --- 🔐 Database Integration Methods --- **/

  // Static method to find user by wallet address
  static async findByWallet(walletAddress) {
    try {
      const userDoc = await MongooseUser.findOne({
        walletAddress: walletAddress.toLowerCase(),
      })
        .populate("petIds")
        .populate("eggIds")
        .populate("techniqueIds")
        .populate("skinIds");

      if (!userDoc) return null;

      return User.fromDatabaseObject(userDoc.toObject());
    } catch (error) {
      console.error("User.findByWallet error:", error);
      throw error;
    }
  }

  // Static method to find user by email
  static async findByEmail(email) {
    try {
      const userDoc = await MongooseUser.findOne({
        email: email.toLowerCase(),
      })
        .populate("petIds")
        .populate("eggIds")
        .populate("techniqueIds")
        .populate("skinIds");

      if (!userDoc) return null;

      return User.fromDatabaseObject(userDoc.toObject());
    } catch (error) {
      console.error("User.findByEmail error:", error);
      throw error;
    }
  }

  // Static method to find user by username
  static async findByUsername(username) {
    try {
      const userDoc = await MongooseUser.findOne({ username })
        .populate("petIds")
        .populate("eggIds")
        .populate("techniqueIds")
        .populate("skinIds");

      if (!userDoc) return null;

      return User.fromDatabaseObject(userDoc.toObject());
    } catch (error) {
      console.error("User.findByUsername error:", error);
      throw error;
    }
  }

  // Static method to find user by ID
  static async findById(id) {
    try {
      const userDoc = await MongooseUser.findById(id)
        .populate("petIds")
        .populate("eggIds")
        .populate("techniqueIds")
        .populate("skinIds");

      if (!userDoc) return null;

      return User.fromDatabaseObject(userDoc.toObject());
    } catch (error) {
      console.error("User.findById error:", error);
      throw error;
    }
  }

  // Static method to find one user with any query
  static async findOne(query) {
    try {
      const userDoc = await MongooseUser.findOne(query)
        .populate("petIds")
        .populate("eggIds")
        .populate("techniqueIds")
        .populate("skinIds");

      if (!userDoc) return null;

      return User.fromDatabaseObject(userDoc.toObject());
    } catch (error) {
      console.error("User.findOne error:", error);
      throw error;
    }
  }

  // Save user to database
  async save() {
    try {
      this.updatedAt = new Date();

      // Hash password if it's plain text (for guest users)
      if (
        this.passwordHash &&
        !this.passwordHash.startsWith("$2a$") &&
        !this.passwordHash.startsWith("$2b$")
      ) {
        this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
      }

      const userData = this.toDatabaseObject();

      if (this._id) {
        // Update existing user
        const updatedUser = await MongooseUser.findByIdAndUpdate(
          this._id,
          userData,
          { new: true, runValidators: true }
        )
          .populate("petIds")
          .populate("eggIds")
          .populate("techniqueIds")
          .populate("skinIds");

        return User.fromDatabaseObject(updatedUser.toObject());
      } else {
        // Create new user
        const newUser = new MongooseUser(userData);
        const savedUser = await newUser.save();

        // Update this instance with the saved data
        const populatedUser = await MongooseUser.findById(savedUser._id)
          .populate("petIds")
          .populate("eggIds")
          .populate("techniqueIds")
          .populate("skinIds");

        return User.fromDatabaseObject(populatedUser.toObject());
      }
    } catch (error) {
      console.error("User.save error:", error);
      throw error;
    }
  }

  /** --- 🔐 User Management --- **/

  static async createWithWallet(username, email, password) {
    const wallet = Wallet.createRandom();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = new User({
      username,
      email,
      passwordHash,
      walletAddress: wallet.address,
      encryptedPrivateKey: wallet.privateKey, // Note: In production, encrypt this!
      balance: 1000,
      freeRolls: 3,
    });

    return await user.save();
  }

  // Static method to create guest user
  static async createGuest(username) {
    const tempWallet = `guest_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const tempEmail = `guest_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}@petverse.guest`;
    const tempPassword =
      Math.random().toString(36).substring(2) + Date.now().toString(36);

    const user = new User({
      username: username.trim(),
      email: tempEmail,
      passwordHash: tempPassword, // Will be hashed in save()
      walletAddress: tempWallet,
      isGuest: true,
      balance: 500,
      freeRolls: 1,
    });

    return await user.save();
  }

  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password) {
    // For guest users with random passwords, we don't need to verify
    if (this.isGuest) {
      return true;
    }
    return await bcrypt.compare(password, this.passwordHash);
  }

  // Update last login timestamp
  async updateLastLogin() {
    this.lastLogin = new Date();
    return await this.save();
  }

  // Connect wallet to existing user
  async connectWallet(walletAddress, encryptedPrivateKey = null) {
    this.walletAddress = walletAddress.toLowerCase();
    if (encryptedPrivateKey) {
      this.encryptedPrivateKey = encryptedPrivateKey;
    }
    this.updatedAt = new Date();
    return await this.save();
  }

  // Convert to database-friendly object (for saving)
  toDatabaseObject() {
    return {
      username: this.username,
      email: this.email,
      passwordHash: this.passwordHash,
      walletAddress: this.walletAddress,
      encryptedPrivateKey: this.encryptedPrivateKey,
      isGuest: this.isGuest,
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
  // In User model - Ensure fromDatabaseObject handles populated data correctly
  static fromDatabaseObject(data) {
    // Convert populated references to our class instances
    const pets = (data.petIds || []).map((petData) => {
      // Handle both Mongoose documents and plain objects
      const petObj = petData.toObject ? petData.toObject() : petData;
      return new Pet(petObj);
    });

    const eggs = (data.eggIds || []).map((eggData) => {
      const eggObj = eggData.toObject ? eggData.toObject() : eggData;
      return new Egg(eggObj);
    });

    const techniques = data.techniqueIds || [];
    const skins = data.skinIds || [];

    return new User({
      id: data._id || data.id,
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      walletAddress: data.walletAddress,
      encryptedPrivateKey: data.encryptedPrivateKey,
      pets,
      eggs,
      techniques,
      skins,
      balance: data.balance,
      freeRolls: data.freeRolls,
      level: data.level,
      experience: data.experience,
      rank: data.rank,
      battlesWon: data.battlesWon,
      battlesLost: data.battlesLost,
      completedQuests: data.completedQuests,
      consecutiveDays: data.consecutiveDays,
      lastDailyClaim: data.lastDailyClaim,
      lastFreeHatch: data.lastFreeHatch,
      isGuest: data.isGuest,
      nftTokens: data.nftTokens,
      transactions: data.transactions,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastLogin: data.lastLogin,
    });
  }

  /** --- 🎮 Game Functions --- **/

  async addPet(pet) {
    if (!(pet instanceof Pet)) {
      throw new Error("Must be a Pet instance");
    }

    pet.ownerId = this._id;

    // Save pet to database
    const mongoosePet = new MongoosePet(pet.toDatabaseObject());
    const savedPet = await mongoosePet.save();

    // Add reference to user
    await MongooseUser.findByIdAndUpdate(this._id, {
      $push: { petIds: savedPet._id },
    });

    // Update local instance
    this.pets.push(new Pet(savedPet.toObject()));
    this.updatedAt = new Date();

    return savedPet;
  }

  async removePet(petId) {
    // Remove from database
    await MongoosePet.findByIdAndDelete(petId);
    await MongooseUser.findByIdAndUpdate(this._id, {
      $pull: { petIds: petId },
    });

    // Update local instance
    this.pets = this.pets.filter((pet) => pet.id !== petId);
    this.updatedAt = new Date();
  }

  async addEgg(egg) {
    if (!(egg instanceof Egg)) {
      throw new Error("Must be an Egg instance");
    }

    egg.ownerId = this._id;

    // Save egg to database
    const mongooseEgg = new MongooseEgg(egg.toDatabaseObject());
    const savedEgg = await mongooseEgg.save();

    // Add reference to user
    await MongooseUser.findByIdAndUpdate(this._id, {
      $push: { eggIds: savedEgg._id },
    });

    // Update local instance
    this.eggs.push(new Egg(savedEgg.toObject()));
    this.updatedAt = new Date();

    return savedEgg;
  }

  async hatchEgg(eggId) {
    const eggIndex = this.eggs.findIndex((egg) => egg.id === eggId);
    if (eggIndex === -1) {
      throw new Error("Egg not found");
    }

    const egg = this.eggs[eggIndex];
    if (egg.isHatched) {
      throw new Error("Egg already hatched");
    }

    const result = egg.hatch();

    if (result instanceof Pet) {
      await this.addPet(result);
    } else if (result.type === "Technique") {
      const technique = new MongooseTechnique({
        ...result,
        ownerId: this._id,
      });
      const savedTechnique = await technique.save();
      await MongooseUser.findByIdAndUpdate(this._id, {
        $push: { techniqueIds: savedTechnique._id },
      });
      this.techniques.push(savedTechnique.toObject());
    } else if (result.type === "Cosmetic") {
      const skin = new MongooseSkin({
        ...result,
        ownerId: this._id,
      });
      const savedSkin = await skin.save();
      await MongooseUser.findByIdAndUpdate(this._id, {
        $push: { skinIds: savedSkin._id },
      });
      this.skins.push(savedSkin.toObject());
    }

    // Remove the hatched egg from database and local instance
    await MongooseEgg.findByIdAndDelete(eggId);
    await MongooseUser.findByIdAndUpdate(this._id, {
      $pull: { eggIds: eggId },
    });

    this.eggs.splice(eggIndex, 1);
    this.updatedAt = new Date();

    return result;
  }

  /** --- 💰 Economy --- **/

  async addBalance(amount) {
    this.balance += amount;
    this.updatedAt = new Date();
    return await this.save();
  }

  async deductBalance(amount) {
    if (this.balance < amount) {
      throw new Error("Insufficient balance");
    }
    this.balance -= amount;
    this.updatedAt = new Date();
    return await this.save();
  }

  async addFreeRolls(amount) {
    this.freeRolls += amount;
    this.updatedAt = new Date();
    return await this.save();
  }

  async useFreeRoll() {
    if (this.freeRolls <= 0) {
      throw new Error("No free rolls available");
    }
    this.freeRolls--;
    this.updatedAt = new Date();
    return await this.save();
  }

  /** --- 🔗 Blockchain Integration --- **/

  async addTransaction(transaction) {
    this.transactions.push({
      ...transaction,
      timestamp: new Date(),
    });
    this.updatedAt = new Date();
    return await this.save();
  }

  async addNFTToken(tokenId) {
    if (!this.nftTokens.includes(tokenId)) {
      this.nftTokens.push(tokenId);
      this.updatedAt = new Date();
      return await this.save();
    }
  }

  async removeNFTToken(tokenId) {
    this.nftTokens = this.nftTokens.filter((id) => id !== tokenId);
    this.updatedAt = new Date();
    return await this.save();
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
      id: this._id || this.id,
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
