// src/services/DatabaseService.js
import {
  User,
  Pet,
  Egg,
  Listing,
  Technique,
  Skin,
} from "../models/dbSchemas.js";

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

    // Add pet to user's petIds array
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

  async transferPet(petId, newOwnerId) {
    const pet = await Pet.findById(petId);
    if (!pet) throw new Error("Pet not found");

    // Remove from old owner
    await User.findByIdAndUpdate(pet.ownerId, { $pull: { petIds: petId } });

    // Add to new owner and update pet owner
    await Promise.all([
      User.findByIdAndUpdate(newOwnerId, { $push: { petIds: petId } }),
      Pet.findByIdAndUpdate(petId, {
        ownerId: newOwnerId,
        isListed: false,
        updatedAt: new Date(),
      }),
    ]);

    return await Pet.findById(petId);
  }

  /** --- 🥚 Egg Operations --- **/

  async createEgg(eggData) {
    const egg = new Egg(eggData);
    const savedEgg = await egg.save();

    // Add egg to user's eggIds array
    await User.findByIdAndUpdate(eggData.ownerId, {
      $push: { eggIds: savedEgg._id },
    });

    return savedEgg;
  }

  async hatchEgg(eggId) {
    const egg = await Egg.findById(eggId);
    if (!egg) throw new Error("Egg not found");
    if (egg.isHatched) throw new Error("Egg already hatched");

    // Your existing hatching logic here
    const eggInstance = new Egg(egg.toObject());
    const result = eggInstance.hatch();

    let savedResult;

    if (result.type === "Pet") {
      // Create new pet
      const petData = {
        ...result,
        ownerId: egg.ownerId,
      };
      savedResult = await this.createPet(petData);
    } else if (result.type === "Technique") {
      const technique = new Technique({
        ...result,
        ownerId: egg.ownerId,
      });
      savedResult = await technique.save();

      // Add to user
      await User.findByIdAndUpdate(egg.ownerId, {
        $push: { techniqueIds: savedResult._id },
      });
    } else if (result.type === "Cosmetic") {
      const skin = new Skin({
        ...result,
        ownerId: egg.ownerId,
      });
      savedResult = await skin.save();

      // Add to user
      await User.findByIdAndUpdate(egg.ownerId, {
        $push: { skinIds: savedResult._id },
      });
    }

    // Update egg as hatched and remove from user's eggs
    await Promise.all([
      Egg.findByIdAndUpdate(eggId, {
        isHatched: true,
        contents: result,
      }),
      User.findByIdAndUpdate(egg.ownerId, { $pull: { eggIds: eggId } }),
    ]);

    return savedResult;
  }

  /** -- 🏪 Marketplace Operations -- **/

  async createListing(listingData) {
    const listing = new Listing(listingData);
    return await listing.save();
  }

  async getActiveListings() {
    return await Listing.find({ isActive: true })
      .populate("sellerId", "username walletAddress")
      .populate("itemId");
  }

  async getUserListings(userId) {
    return await Listing.find({
      sellerId: userId,
      isActive: true,
    }).populate("itemId");
  }

  async updateListing(listingId, updateData) {
    return await Listing.findByIdAndUpdate(listingId, updateData, {
      new: true,
    });
  }

  async completeListing(listingId, buyerId) {
    return await Listing.findByIdAndUpdate(
      listingId,
      {
        isActive: false,
        soldAt: new Date(),
        buyerId: buyerId,
      },
      { new: true }
    );
  }

  /** --- 💰 Balance Operations --- **/

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
}
