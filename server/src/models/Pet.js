// src/models/Pet.js
import { Pet as MongoosePet } from "./dbSchema.js";

export class Pet {
  constructor({
    id = null, // Will be set by MongoDB _id
    ownerId = null,
    name,
    type,
    rarity,
    ability,
    technique = null,
    skin = null,

    // Core stats
    stats = {
      dmg: 10,
      hp: 50,
      range: 1,
      spa: 1.0, // seconds per attack
      critChance: 0,
      critDamage: 0,
      moneyBonus: 0,
    },

    // Battle state
    currentHP = stats.hp,
    statusEffects = [],
    isAlive = true,

    // Progression
    level = 1,
    experience = 0,
    evolutionStage = 1,
    evolutions = [],

    // Cosmetics
    title = null,
    isShiny = false,

    // Blockchain
    nftTokenId = null,
    isListed = false,

    // Metadata
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    this._id = id; // MongoDB ID
    this.id = id; // Alias for compatibility
    this.ownerId = ownerId;
    this.name = name;
    this.type = type;
    this.rarity = rarity;
    this.ability = ability;
    this.technique = technique;
    this.skin = skin;

    this.stats = stats;
    this.currentHP = currentHP;
    this.statusEffects = statusEffects;
    this.isAlive = isAlive;

    this.level = level;
    this.experience = experience;
    this.evolutionStage = evolutionStage;
    this.evolutions = evolutions;

    this.title = title;
    this.isShiny = isShiny;

    this.nftTokenId = nftTokenId;
    this.isListed = isListed;

    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /** --- 🔐 Database Integration Methods --- **/

  // Static method to find pet by ID
  static async findById(id) {
    try {
      const petDoc = await MongoosePet.findById(id);
      if (!petDoc) return null;

      return Pet.fromDatabaseObject(petDoc.toObject());
    } catch (error) {
      console.error("Pet.findById error:", error);
      throw error;
    }
  }

  // Static method to find pets by owner
  static async findByOwner(ownerId) {
    try {
      const petDocs = await MongoosePet.find({ ownerId });
      return petDocs.map((doc) => Pet.fromDatabaseObject(doc.toObject()));
    } catch (error) {
      console.error("Pet.findByOwner error:", error);
      throw error;
    }
  }

  // Save pet to database
  async save() {
    try {
      this.updatedAt = new Date();

      const petData = this.toDatabaseObject();

      if (this._id) {
        // Update existing pet
        const updatedPet = await MongoosePet.findByIdAndUpdate(
          this._id,
          petData,
          { new: true, runValidators: true }
        );
        return Pet.fromDatabaseObject(updatedPet.toObject());
      } else {
        // Create new pet
        const newPet = new MongoosePet(petData);
        const savedPet = await newPet.save();
        return Pet.fromDatabaseObject(savedPet.toObject());
      }
    } catch (error) {
      console.error("Pet.save error:", error);
      throw error;
    }
  }

  // Delete pet from database
  async delete() {
    try {
      if (!this._id) return false;
      await MongoosePet.findByIdAndDelete(this._id);
      return true;
    } catch (error) {
      console.error("Pet.delete error:", error);
      throw error;
    }
  }

  // Convert to database-friendly object
  toDatabaseObject() {
    return {
      ownerId: this.ownerId,
      name: this.name,
      type: this.type,
      rarity: this.rarity,
      ability: this.ability,
      technique: this.technique,
      skin: this.skin,
      stats: this.stats,
      currentHP: this.currentHP,
      statusEffects: this.statusEffects,
      isAlive: this.isAlive,
      level: this.level,
      experience: this.experience,
      evolutionStage: this.evolutionStage,
      evolutions: this.evolutions,
      title: this.title,
      isShiny: this.isShiny,
      nftTokenId: this.nftTokenId,
      isListed: this.isListed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // Create Pet instance from database object
  static fromDatabaseObject(data) {
    return new Pet({
      id: data._id || data.id,
      ownerId: data.ownerId,
      name: data.name,
      type: data.type,
      rarity: data.rarity,
      ability: data.ability,
      technique: data.technique,
      skin: data.skin,
      stats: data.stats,
      currentHP: data.currentHP,
      statusEffects: data.statusEffects,
      isAlive: data.isAlive,
      level: data.level,
      experience: data.experience,
      evolutionStage: data.evolutionStage,
      evolutions: data.evolutions,
      title: data.title,
      isShiny: data.isShiny,
      nftTokenId: data.nftTokenId,
      isListed: data.isListed,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  /** --- 🧠 Core Functions --- **/

  async gainExperience(amount) {
    if (!amount || amount <= 0) return this;

    this.experience += amount;
    this.updatedAt = new Date();

    const threshold = this.level * 100;
    if (this.experience >= threshold) {
      this.experience -= threshold;
      await this.levelUp();
    } else {
      await this.save();
    }

    return this;
  }

  async levelUp() {
    this.level++;
    this.stats.dmg = Math.round(this.stats.dmg * 1.1);
    this.stats.hp = Math.round(this.stats.hp * 1.1);
    this.stats.range = +(this.stats.range * 1.02).toFixed(2);
    this.stats.spa = +(this.stats.spa * 0.97).toFixed(2);
    this.currentHP = this.stats.hp;
    this.updatedAt = new Date();

    return await this.save();
  }

  async takeDamage(amount) {
    this.currentHP -= amount;
    this.updatedAt = new Date();

    if (this.currentHP <= 0) {
      this.currentHP = 0;
      this.isAlive = false;
    }

    return await this.save();
  }

  async heal(amount) {
    if (!this.isAlive) return this;

    this.currentHP = Math.min(this.stats.hp, this.currentHP + amount);
    this.updatedAt = new Date();

    return await this.save();
  }

  async applyStatus(status) {
    if (!this.statusEffects.find((s) => s.name === status.name)) {
      this.statusEffects.push(status);
      this.updatedAt = new Date();
      await this.save();
    }
    return this;
  }

  async removeStatus(name) {
    this.statusEffects = this.statusEffects.filter((s) => s.name !== name);
    this.updatedAt = new Date();
    return await this.save();
  }

  /** --- 🧩 Utility --- **/

  async resetBattleState() {
    this.currentHP = this.stats.hp;
    this.statusEffects = [];
    this.isAlive = true;
    this.updatedAt = new Date();

    return await this.save();
  }

  async evolve(newForm) {
    if (!newForm) return this;

    this.evolutionStage++;
    this.name = newForm.name || this.name;
    this.stats = {
      ...this.stats,
      dmg: Math.round(this.stats.dmg * 1.25),
      hp: Math.round(this.stats.hp * 1.25),
    };
    this.rarity = newForm.rarity || this.rarity;
    this.evolutions.push(newForm.name);
    this.updatedAt = new Date();

    return await this.save();
  }

  /** --- 🔗 Blockchain Integration --- **/

  async listForSale(price, nftTokenId = null) {
    this.isListed = true;
    this.nftTokenId = nftTokenId || this.nftTokenId;
    this.updatedAt = new Date();

    return await this.save();
  }

  async unlistFromSale() {
    this.isListed = false;
    this.updatedAt = new Date();

    return await this.save();
  }

  async transferOwnership(newOwnerId) {
    this.ownerId = newOwnerId;
    this.isListed = false; // Remove from marketplace when transferred
    this.updatedAt = new Date();

    return await this.save();
  }
  // src/models/Pet.js - Add these methods to your Pet class

  /** --- 🔐 Database Integration Methods --- **/

  // Static method to find pets with query
  static async find(query = {}, options = {}) {
    try {
      const { sort, limit, skip, populate } = options;
      let queryBuilder = MongoosePet.find(query);

      if (sort) queryBuilder = queryBuilder.sort(sort);
      if (skip) queryBuilder = queryBuilder.skip(skip);
      if (limit) queryBuilder = queryBuilder.limit(limit);
      if (populate) queryBuilder = queryBuilder.populate(populate);

      const petDocs = await queryBuilder;
      return petDocs.map((doc) => Pet.fromDatabaseObject(doc.toObject()));
    } catch (error) {
      console.error("Pet.find error:", error);
      throw error;
    }
  }

  // Static method to find one pet
  static async findOne(query) {
    try {
      const petDoc = await MongoosePet.findOne(query);
      if (!petDoc) return null;
      return Pet.fromDatabaseObject(petDoc.toObject());
    } catch (error) {
      console.error("Pet.findOne error:", error);
      throw error;
    }
  }

  // Static method to count documents
  static async countDocuments(query = {}) {
    try {
      return await MongoosePet.countDocuments(query);
    } catch (error) {
      console.error("Pet.countDocuments error:", error);
      throw error;
    }
  }

  // Static method for aggregation
  static async aggregate(pipeline) {
    try {
      return await MongoosePet.aggregate(pipeline);
    } catch (error) {
      console.error("Pet.aggregate error:", error);
      throw error;
    }
  }

  // Find pets by owner (already exists but ensure it's correct)
  static async findByOwner(ownerId, options = {}) {
    try {
      const query = { ownerId: ownerId };
      return await Pet.find(query, options);
    } catch (error) {
      console.error("Pet.findByOwner error:", error);
      throw error;
    }
  }
  /** --- 🔍 Output --- **/

  toJSON() {
    return {
      id: this._id || this.id,
      ownerId: this.ownerId,
      name: this.name,
      type: this.type,
      rarity: this.rarity,
      ability: this.ability,
      technique: this.technique,
      skin: this.skin,
      stats: this.stats,
      currentHP: this.currentHP,
      statusEffects: this.statusEffects,
      isAlive: this.isAlive,
      level: this.level,
      experience: this.experience,
      evolutionStage: this.evolutionStage,
      evolutions: this.evolutions,
      title: this.title,
      isShiny: this.isShiny,
      nftTokenId: this.nftTokenId,
      isListed: this.isListed,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
