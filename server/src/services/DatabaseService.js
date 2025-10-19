// src/services/DatabaseService.js
import {
  User,
  Pet,
  Egg,
  Technique,
  Skin,
  BattleHistory,
} from "../models/dbSchema.js";

export class DatabaseService {
  /** --- 👤 User Operations --- **/

  async createUser(userData) {
    const user = new User(userData);
    return await user.save();
  }

  async findUserById(userId) {
    return await User.findById(userId)
      .populate("petIds")
      .populate("eggIds")
      .populate("techniqueIds")
      .populate("skinIds");
  }

  async findUserByWallet(walletAddress) {
    return await User.findOne({ walletAddress })
      .populate("petIds")
      .populate("eggIds")
      .populate("techniqueIds")
      .populate("skinIds");
  }

  async updateUser(userId, updateData) {
    updateData.updatedAt = new Date();
    return await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("petIds")
      .populate("eggIds")
      .populate("techniqueIds")
      .populate("skinIds");
  }

  /** --- 🐾 Pet Operations --- **/

  async createPet(petData) {
    const pet = new Pet(petData);
    const savedPet = await pet.save();

    await User.findByIdAndUpdate(petData.ownerId, {
      $push: { petIds: savedPet._id },
    });

    return savedPet;
  }

  async findPetById(petId) {
    return await Pet.findById(petId);
  }

  async updatePet(petId, updateData) {
    updateData.updatedAt = new Date();
    return await Pet.findByIdAndUpdate(petId, updateData, {
      new: true,
      runValidators: true,
    });
  }

  async getUserPets(userId) {
    return await Pet.find({ ownerId: userId });
  }

  /** --- 🥚 Egg Operations --- **/

  async createEgg(eggData) {
    const egg = new Egg(eggData);
    const savedEgg = await egg.save();

    await User.findByIdAndUpdate(eggData.ownerId, {
      $push: { eggIds: savedEgg._id },
    });

    return savedEgg;
  }

  async getUserEggs(userId) {
    return await Egg.find({ ownerId: userId });
  }

  async hatchEgg(eggId) {
    const egg = await Egg.findById(eggId);
    if (!egg) throw new Error("Egg not found");
    if (egg.isHatched) throw new Error("Egg already hatched");

    // Import the Egg class for hatching logic
    const { Egg: EggClass } = await import("../models/Egg.js");
    const eggInstance = new EggClass(egg.type, egg.ownerId);
    const result = eggInstance.hatch();

    let savedResult;

    if (result instanceof (await import("../models/Pet.js")).Pet) {
      const petData = {
        ...result.toJSON(),
        ownerId: egg.ownerId,
      };
      savedResult = await this.createPet(petData);
    } else if (result.type === "Technique") {
      const technique = new Technique({
        ...result,
        ownerId: egg.ownerId,
      });
      savedResult = await technique.save();
      await User.findByIdAndUpdate(egg.ownerId, {
        $push: { techniqueIds: savedResult._id },
      });
    } else if (result.type === "Cosmetic") {
      const skin = new Skin({
        ...result,
        ownerId: egg.ownerId,
      });
      savedResult = await skin.save();
      await User.findByIdAndUpdate(egg.ownerId, {
        $push: { skinIds: savedResult._id },
      });
    }

    await Egg.findByIdAndUpdate(eggId, {
      isHatched: true,
      contents: result,
    });

    await User.findByIdAndUpdate(egg.ownerId, {
      $pull: { eggIds: eggId },
    });

    return savedResult;
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
    const newBalance = user.balance + amount;

    if (newBalance < 0) {
      throw new Error("Insufficient balance");
    }

    return await User.findByIdAndUpdate(
      userId,
      {
        balance: newBalance,
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  async updateUserExperience(userId, experience) {
    const user = await User.findById(userId);
    const newExperience = user.experience + experience;

    return await User.findByIdAndUpdate(
      userId,
      {
        experience: newExperience,
        updatedAt: new Date(),
      },
      { new: true }
    );
  }

  /** --- 🏆 Leaderboard --- **/

  async getLeaderboard(type = "level", limit = 10) {
    const sortField = type === "level" ? "level" : "experience";

    return await User.find({})
      .sort({ [sortField]: -1 })
      .limit(limit)
      .select("username level experience battlesWon rank");
  }

  /** --- 📊 Analytics --- **/

  async getUserStats(userId) {
    const user = await User.findById(userId)
      .populate("petIds")
      .populate("eggIds")
      .populate("techniqueIds")
      .populate("skinIds");

    if (!user) throw new Error("User not found");

    const pets = user.petIds || [];
    const eggs = user.eggIds || [];

    return {
      user: {
        level: user.level,
        experience: user.experience,
        balance: user.balance,
        totalBattles: (user.battlesWon || 0) + (user.battlesLost || 0),
        battlesWon: user.battlesWon || 0,
        battlesLost: user.battlesLost || 0,
        winRate: user.battlesWon
          ? (
              (user.battlesWon /
                ((user.battlesWon || 0) + (user.battlesLost || 0))) *
              100
            ).toFixed(1)
          : 0,
        consecutiveDays: user.consecutiveDays || 0,
        completedQuests: user.completedQuests?.length || 0,
      },
      pets: {
        total: pets.length,
        byRarity: this.countByRarity(pets),
        byType: this.countByType(pets),
        averageLevel: this.calculateAverageLevel(pets),
      },
      eggs: {
        total: eggs.length,
        hatched: eggs.filter((egg) => egg.isHatched).length,
        unhatched: eggs.filter((egg) => !egg.isHatched).length,
      },
      collection: {
        techniques: user.techniqueIds?.length || 0,
        skins: user.skinIds?.length || 0,
        nftTokens: user.nftTokens?.length || 0,
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
}
