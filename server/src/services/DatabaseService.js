// src/services/DatabaseService.js
import { User } from "../models/User.js";
import { Pet } from "../models/Pet.js";
import { Egg } from "../models/Egg.js";
import { Technique, Skin, BattleHistory } from "../models/dbSchema.js";

export class DatabaseService {
  /** --- 👤 User Operations --- **/

  async createUser(userData) {
    const user = new User(userData);
    return await user.save();
  }

  async findUserById(userId) {
    return await User.findById(userId);
  }

  async findUserByWallet(walletAddress) {
    return await User.findByWallet(walletAddress);
  }

  async findUserByUsername(username) {
    return await User.findByUsername(username);
  }

  async findUserByEmail(email) {
    return await User.findByEmail(email);
  }

  async updateUser(userId, updateData) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    // Update user properties
    Object.keys(updateData).forEach((key) => {
      if (key in user) {
        user[key] = updateData[key];
      }
    });

    user.updatedAt = new Date();
    return await user.save();
  }

  /** --- 🐾 Pet Operations --- **/

  async createPet(petData) {
    const pet = new Pet(petData);
    const savedPet = await pet.save();

    // Update user's pet references
    const user = await User.findById(petData.ownerId);
    if (user) {
      await user.addPet(savedPet);
    }

    return savedPet;
  }

  async findPetById(petId) {
    return await Pet.findById(petId);
  }

  async updatePet(petId, updateData) {
    const pet = await Pet.findById(petId);
    if (!pet) throw new Error("Pet not found");

    // Update pet properties
    Object.keys(updateData).forEach((key) => {
      if (key in pet && key !== "id" && key !== "_id") {
        pet[key] = updateData[key];
      }
    });

    pet.updatedAt = new Date();
    return await pet.save();
  }

  async getUserPets(userId) {
    return await Pet.findByOwner(userId);
  }

  async deletePet(petId) {
    const pet = await Pet.findById(petId);
    if (!pet) throw new Error("Pet not found");

    // Remove from user's references
    const user = await User.findById(pet.ownerId);
    if (user) {
      await user.removePet(petId);
    }

    return await pet.delete();
  }

  /** --- 🥚 Egg Operations --- **/

  async createEgg(eggData) {
    const egg = new Egg(eggData);
    const savedEgg = await egg.save();

    // Update user's egg references
    const user = await User.findById(eggData.ownerId);
    if (user) {
      await user.addEgg(savedEgg);
    }

    return savedEgg;
  }

  async getUserEggs(userId) {
    return await Egg.findByOwner(userId);
  }

  async findEggById(eggId) {
    return await Egg.findById(eggId);
  }

  async hatchEgg(eggId) {
    const egg = await Egg.findById(eggId);
    if (!egg) throw new Error("Egg not found");

    if (egg.isHatched) throw new Error("Egg already hatched");

    // Use the Egg class's hatch method
    const result = await egg.hatch();

    // Get the user to add the hatched item
    const user = await User.findById(egg.ownerId);
    if (!user) throw new Error("User not found");

    let savedResult;

    if (result instanceof Pet) {
      // Add the pet to user's collection
      savedResult = await user.addPet(result);
    } else if (result.type === "Technique") {
      // Create and save technique
      const technique = new Technique({
        ...result,
        ownerId: user._id,
      });
      savedResult = await technique.save();

      // Add to user's techniques
      user.techniques.push(savedResult.toObject());
      await user.save();
    } else if (result.type === "Cosmetic") {
      // Create and save skin
      const skin = new Skin({
        ...result,
        ownerId: user._id,
      });
      savedResult = await skin.save();

      // Add to user's skins
      user.skins.push(savedResult.toObject());
      await user.save();
    }

    // Remove the egg from user's collection
    await user.removePet(eggId);

    return savedResult;
  }

  async deleteEgg(eggId) {
    const egg = await Egg.findById(eggId);
    if (!egg) throw new Error("Egg not found");

    // Remove from user's references
    const user = await User.findById(egg.ownerId);
    if (user) {
      // Note: You might want to add a removeEgg method to User class
      // For now, we'll handle it directly
      user.eggs = user.eggs.filter((e) => e.id !== eggId);
      await user.save();
    }

    return await egg.delete();
  }

  /** --- ⚔️ Battle Operations --- **/

  async addBattleHistory(battleData) {
    const battle = new BattleHistory(battleData);
    return await battle.save();
  }

  async getUserBattleHistory(userId, limit = 10) {
    return await BattleHistory.find({ userId })
      .sort({ date: -1 })
      .limit(limit)
      .populate("userPets");
  }

  /** --- 💰 Balance & Progression --- **/

  async updateUserBalance(userId, amount) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    if (amount >= 0) {
      return await user.addBalance(amount);
    } else {
      return await user.deductBalance(Math.abs(amount));
    }
  }

  async updateUserExperience(userId, experience) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    user.experience += experience;
    user.updatedAt = new Date();

    return await user.save();
  }

  async updatePetExperience(petId, experience) {
    const pet = await Pet.findById(petId);
    if (!pet) throw new Error("Pet not found");

    return await pet.gainExperience(experience);
  }

  /** --- 🎯 Game Actions --- **/

  async useFreeRoll(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    return await user.useFreeRoll();
  }

  async addFreeRolls(userId, amount) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    return await user.addFreeRolls(amount);
  }

  async connectWallet(userId, walletAddress, encryptedPrivateKey = null) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    return await user.connectWallet(walletAddress, encryptedPrivateKey);
  }

  /** --- 🏆 Leaderboard --- **/

  async getLeaderboard(type = "level", limit = 10) {
    // Since we're using custom classes, we'll use Mongoose directly for complex queries
    const { User: MongooseUser } = await import("../models/dbSchema.js");

    const sortField = type === "level" ? "level" : "experience";

    const users = await MongooseUser.find({})
      .sort({ [sortField]: -1 })
      .limit(limit)
      .select("username level experience battlesWon rank balance freeRolls")
      .lean();

    // Convert to User instances
    return users.map((userData) => User.fromDatabaseObject(userData));
  }

  /** --- 📊 Analytics --- **/

  async getUserStats(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const pets = user.pets || [];
    const eggs = user.eggs || [];

    return {
      user: {
        level: user.level,
        experience: user.experience,
        balance: user.balance,
        freeRolls: user.freeRolls,
        totalBattles: user.totalBattles,
        battlesWon: user.battlesWon || 0,
        battlesLost: user.battlesLost || 0,
        winRate: user.winRate,
        consecutiveDays: user.consecutiveDays || 0,
        completedQuests: user.completedQuests?.length || 0,
        isGuest: user.isGuest,
      },
      pets: {
        total: pets.length,
        byRarity: this.countByRarity(pets),
        byType: this.countByType(pets),
        averageLevel: this.calculateAverageLevel(pets),
        totalExperience: this.calculateTotalExperience(pets),
      },
      eggs: {
        total: eggs.length,
        hatched: eggs.filter((egg) => egg.isHatched).length,
        unhatched: eggs.filter((egg) => !egg.isHatched).length,
      },
      collection: {
        techniques: user.techniques?.length || 0,
        skins: user.skins?.length || 0,
        nftTokens: user.nftTokens?.length || 0,
      },
      economy: {
        totalValue: this.calculateCollectionValue(pets),
        transactions: user.transactions?.length || 0,
      },
    };
  }

  // Helper methods for stats
  countByRarity(items) {
    const rarities = {};
    items.forEach((item) => {
      rarities[item.rarity] = (rarities[item.rarity] || 0) + 1;
    });
    return rarities;
  }

  countByType(items) {
    const types = {};
    items.forEach((item) => {
      types[item.type] = (types[item.type] || 0) + 1;
    });
    return types;
  }

  calculateAverageLevel(pets) {
    if (pets.length === 0) return 0;
    const total = pets.reduce((sum, pet) => sum + (pet.level || 1), 0);
    return (total / pets.length).toFixed(1);
  }

  calculateTotalExperience(pets) {
    return pets.reduce((sum, pet) => sum + (pet.experience || 0), 0);
  }

  calculateCollectionValue(pets) {
    // Simple value calculation based on rarity and level
    const rarityValues = {
      COMMON: 10,
      UNCOMMON: 25,
      RARE: 100,
      EPIC: 500,
      LEGENDARY: 2500,
      MYTHIC: 10000,
      CELESTIAL: 50000,
      EXOTIC: 100000,
      ULTIMATE: 500000,
      GODLY: 1000000,
    };

    return pets.reduce((total, pet) => {
      const baseValue = rarityValues[pet.rarity?.toUpperCase()] || 10;
      const levelMultiplier = 1 + (pet.level - 1) * 0.1;
      return total + baseValue * levelMultiplier;
    }, 0);
  }

  /** --- 🔧 Utility Methods --- **/

  async healthCheck() {
    try {
      // Test database connection by counting users
      const userCount = await (
        await import("../models/dbSchema.js")
      ).User.countDocuments();
      return {
        status: "healthy",
        database: "connected",
        userCount,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        database: "disconnected",
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  async cleanupOldData(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      // Clean up old battle history
      const { BattleHistory: MongooseBattleHistory } = await import(
        "../models/dbSchema.js"
      );

      const result = await MongooseBattleHistory.deleteMany({
        date: { $lt: cutoffDate },
      });

      return {
        deletedCount: result.deletedCount,
        message: `Cleaned up data older than ${daysOld} days`,
      };
    } catch (error) {
      console.error("Cleanup error:", error);
      throw error;
    }
  }

  /** --- 🔄 Migration Helpers --- **/

  async migrateUserToClass(userId) {
    // Helper method to migrate a Mongoose user to custom class
    const { User: MongooseUser } = await import("../models/dbSchema.js");

    const mongooseUser = await MongooseUser.findById(userId)
      .populate("petIds")
      .populate("eggIds")
      .populate("techniqueIds")
      .populate("skinIds");

    if (!mongooseUser) throw new Error("User not found");

    const userClass = User.fromDatabaseObject(mongooseUser.toObject());
    return await userClass.save();
  }
}
