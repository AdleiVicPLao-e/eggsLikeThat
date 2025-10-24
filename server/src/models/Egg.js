// src/models/Egg.js
import { EGG_TYPES, SKIN_RARITIES, TECHNIQUES } from "../utils/constants.js";
import { weightedRandom, generateRandomPet } from "../utils/rng.js";
import { Pet } from "./Pet.js";
import {
  Egg as MongooseEgg,
  Technique as MongooseTechnique,
  Skin as MongooseSkin,
} from "./dbSchema.js";

export class Egg {
  constructor({
    id = null, // Will be set by MongoDB _id
    ownerId = null,
    type,
    isHatched = false,
    contents = null,
    hatchDuration = 60,
    cost = 100,
    description = "A mysterious egg",
    nftTokenId = null,
    isListed = false,
    createdAt = new Date(),
  }) {
    this._id = id; // MongoDB ID
    this.id = id; // Alias for compatibility
    this.ownerId = ownerId;
    this.type = type;
    this.isHatched = isHatched;
    this.contents = contents;
    this.hatchDuration = hatchDuration;
    this.cost = cost;
    this.description = description;
    this.nftTokenId = nftTokenId;
    this.isListed = isListed;
    this.createdAt = createdAt;
  }

  /** --- 🔐 Database Integration Methods --- **/

  // Static method to find egg by ID
  static async findById(id) {
    try {
      const eggDoc = await MongooseEgg.findById(id);
      if (!eggDoc) return null;

      return Egg.fromDatabaseObject(eggDoc.toObject());
    } catch (error) {
      console.error("Egg.findById error:", error);
      throw error;
    }
  }

  // Static method to find eggs by owner
  static async findByOwner(ownerId) {
    try {
      const eggDocs = await MongooseEgg.find({ ownerId });
      return eggDocs.map((doc) => Egg.fromDatabaseObject(doc.toObject()));
    } catch (error) {
      console.error("Egg.findByOwner error:", error);
      throw error;
    }
  }

  // Save egg to database
  async save() {
    try {
      const eggData = this.toDatabaseObject();

      if (this._id) {
        // Update existing egg
        const updatedEgg = await MongooseEgg.findByIdAndUpdate(
          this._id,
          eggData,
          { new: true, runValidators: true }
        );
        return Egg.fromDatabaseObject(updatedEgg.toObject());
      } else {
        // Create new egg
        const newEgg = new MongooseEgg(eggData);
        const savedEgg = await newEgg.save();
        return Egg.fromDatabaseObject(savedEgg.toObject());
      }
    } catch (error) {
      console.error("Egg.save error:", error);
      throw error;
    }
  }

  // Delete egg from database
  async delete() {
    try {
      if (!this._id) return false;
      await MongooseEgg.findByIdAndDelete(this._id);
      return true;
    } catch (error) {
      console.error("Egg.delete error:", error);
      throw error;
    }
  }

  // Convert to database-friendly object
  toDatabaseObject() {
    return {
      ownerId: this.ownerId,
      type: this.type,
      isHatched: this.isHatched,
      contents: this.contents,
      hatchDuration: this.hatchDuration,
      cost: this.cost,
      description: this.description,
      nftTokenId: this.nftTokenId,
      isListed: this.isListed,
      createdAt: this.createdAt,
    };
  }

  // Create Egg instance from database object
  static fromDatabaseObject(data) {
    return new Egg({
      id: data._id || data.id,
      ownerId: data.ownerId,
      type: data.type,
      isHatched: data.isHatched,
      contents: data.contents,
      hatchDuration: data.hatchDuration,
      cost: data.cost,
      description: data.description,
      nftTokenId: data.nftTokenId,
      isListed: data.isListed,
      createdAt: data.createdAt,
    });
  }

  /** --- 🐣 Hatching Logic --- **/

  async hatch() {
    if (this.isHatched) throw new Error("This egg has already been hatched.");

    let result;
    switch (this.type) {
      case EGG_TYPES.BASIC:
        result = await this.hatchPet();
        break;
      case EGG_TYPES.COSMETIC:
        result = await this.hatchSkin();
        break;
      case EGG_TYPES.ATTRIBUTE:
        result = await this.hatchTechnique();
        break;
      default:
        throw new Error(`Unknown egg type: ${this.type}`);
    }

    this.isHatched = true;
    this.contents = result;

    // Save the updated egg state
    await this.save();

    return result;
  }

  /** 🐣 Hatch a pet using RNG logic */
  async hatchPet() {
    // Generate fully randomized pet data (rarity, stats, abilities, etc.)
    const petData = generateRandomPet(this.ownerId);

    // Create a Pet instance and save to database
    const pet = new Pet(petData);
    const savedPet = await pet.save();

    return savedPet;
  }

  /** 🎨 Hatch a skin cosmetic */
  async hatchSkin() {
    const rarity = weightedRandom(SKIN_RARITIES);
    const skinData = {
      name: `${rarity.name} Skin`,
      rarity: rarity.name,
      type: "Cosmetic",
      ownerId: this.ownerId,
      obtainedAt: new Date(),
    };

    // Save to database
    const skin = new MongooseSkin(skinData);
    const savedSkin = await skin.save();

    return savedSkin.toObject();
  }

  /** 🧠 Hatch a random technique */
  async hatchTechnique() {
    // Flatten TECHNIQUES with level weights
    const allTechs = TECHNIQUES.flatMap((t) =>
      t.levels
        ? t.levels.map((l) => ({
            name: `${t.name} Lv.${l.level}`,
            chance: l.chance,
            effect: l.effect,
          }))
        : [t]
    );

    const tech = weightedRandom(allTechs);
    const techniqueData = {
      name: tech.name,
      rarity: this.getTechniqueRarity(tech.chance),
      effect: tech.effect,
      type: "Technique",
      ownerId: this.ownerId,
      obtainedAt: new Date(),
    };

    // Save to database
    const technique = new MongooseTechnique(techniqueData);
    const savedTechnique = await technique.save();

    return savedTechnique.toObject();
  }

  /** 🧮 Technique rarity tier mapping */
  getTechniqueRarity(chance) {
    if (chance <= 0.1) return "Godly";
    if (chance <= 1) return "Legendary";
    if (chance <= 3) return "Epic";
    if (chance <= 10) return "Rare";
    return "Common";
  }

  // src/models/Egg.js - Add this method to your Egg class

  // Static method to get egg statistics for a user
  static async getEggStats(userId) {
    try {
      const eggs = await MongooseEgg.find({ ownerId: userId });

      const stats = {
        total: eggs.length,
        byType: {},
        hatchable: eggs.filter((egg) => !egg.isHatched).length,
        hatched: eggs.filter((egg) => egg.isHatched).length,
        byRarity: {
          common: 0,
          uncommon: 0,
          rare: 0,
          epic: 0,
          legendary: 0,
        },
      };

      eggs.forEach((egg) => {
        // Count by type
        stats.byType[egg.type] = (stats.byType[egg.type] || 0) + 1;

        // Count by rarity (if you have rarity field)
        if (
          egg.rarity &&
          stats.byRarity[egg.rarity.toLowerCase()] !== undefined
        ) {
          stats.byRarity[egg.rarity.toLowerCase()]++;
        }
      });

      return stats;
    } catch (error) {
      console.error("Egg.getEggStats error:", error);
      throw error;
    }
  }

  // Also add the find method for consistency
  static async find(query = {}, options = {}) {
    try {
      const { sort, limit, skip } = options;
      let queryBuilder = MongooseEgg.find(query);

      if (sort) queryBuilder = queryBuilder.sort(sort);
      if (skip) queryBuilder = queryBuilder.skip(skip);
      if (limit) queryBuilder = queryBuilder.limit(limit);

      const eggDocs = await queryBuilder;
      return eggDocs.map((doc) => Egg.fromDatabaseObject(doc.toObject()));
    } catch (error) {
      console.error("Egg.find error:", error);
      throw error;
    }
  }

  static async countDocuments(query = {}) {
    try {
      return await MongooseEgg.countDocuments(query);
    } catch (error) {
      console.error("Egg.countDocuments error:", error);
      throw error;
    }
  }

  /** --- 🔍 Output --- **/

  toJSON() {
    return {
      id: this._id || this.id,
      ownerId: this.ownerId,
      type: this.type,
      isHatched: this.isHatched,
      contents: this.contents,
      hatchDuration: this.hatchDuration,
      cost: this.cost,
      description: this.description,
      nftTokenId: this.nftTokenId,
      isListed: this.isListed,
      createdAt: this.createdAt,
    };
  }
}
