import mongoose from "mongoose";

const eggSchema = new mongoose.Schema(
  {
    // Egg type and rarity
    eggType: {
      type: String,
      required: true,
      enum: ["basic", "premium", "cosmetic", "mystery"],
    },

    rarity: {
      type: String,
      required: true,
      enum: ["common", "uncommon", "rare", "epic", "legendary"],
    },

    // Contents (determined at hatch time)
    potentialPets: [
      {
        tier: String,
        type: String,
        weight: Number, // Probability weight
      },
    ],

    // Ownership
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Hatching status
    isHatched: {
      type: Boolean,
      default: false,
    },
    hatchDate: {
      type: Date,
    },

    // Cosmetic properties
    skin: {
      type: String,
      default: "default",
    },
    animation: {
      type: String,
      default: "default",
    },

    // Purchase info (for premium eggs)
    purchased: {
      type: Boolean,
      default: false,
    },
    purchasePrice: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      enum: ["coins", "ETH", "MATIC", "USDC"],
      default: "coins",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
eggSchema.index({ owner: 1, isHatched: 1 });
eggSchema.index({ rarity: 1, eggType: 1 });

// Method to check if egg can be hatched
eggSchema.methods.canHatch = function () {
  return !this.isHatched;
};

// Static method to create basic egg
eggSchema.statics.createBasicEgg = function (ownerId) {
  return this.create({
    eggType: "basic",
    rarity: "common",
    owner: ownerId,
    potentialPets: [
      { tier: "common", type: "Fire", weight: 50 },
      { tier: "common", type: "Water", weight: 50 },
      { tier: "uncommon", type: "Earth", weight: 30 },
      { tier: "rare", type: "Air", weight: 15 },
      { tier: "epic", type: "Light", weight: 4 },
      { tier: "legendary", type: "Dark", weight: 1 },
    ],
  });
};

export default mongoose.model("Egg", eggSchema);
