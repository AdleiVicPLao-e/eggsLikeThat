import mongoose from "mongoose";

const statSchema = new mongoose.Schema({
  attack: { type: Number, required: true, min: 1, max: 500 },
  defense: { type: Number, required: true, min: 1, max: 500 },
  speed: { type: Number, required: true, min: 1, max: 500 },
  health: { type: Number, required: true, min: 1, max: 1000 },
});

const petSchema = new mongoose.Schema(
  {
    // Basic info
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    // Rarity and type
    tier: {
      type: String,
      required: true,
      enum: ["common", "uncommon", "rare", "epic", "legendary"],
    },
    type: {
      type: String,
      required: true,
      enum: ["Fire", "Water", "Earth", "Air", "Light", "Dark"],
    },

    // Game data
    abilities: [
      {
        name: String,
        description: String,
        power: Number,
        cooldown: Number,
      },
    ],

    stats: statSchema,

    // Progression
    level: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },
    experience: {
      type: Number,
      default: 0,
    },

    // Ownership
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Blockchain integration
    tokenId: {
      type: String,
      sparse: true,
    },
    network: {
      type: String,
      enum: ["ethereum", "polygon", null],
      default: null,
    },

    // Metadata
    hatchDate: {
      type: Date,
      default: Date.now,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },

    // Battle stats
    battlesWon: {
      type: Number,
      default: 0,
    },
    battlesLost: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
petSchema.index({ owner: 1, tier: 1 });
petSchema.index({ tier: 1, type: 1 });
petSchema.index({ "stats.attack": -1 });
petSchema.index({ createdAt: -1 });

// Virtual for total battles
petSchema.virtual("totalBattles").get(function () {
  return this.battlesWon + this.battlesLost;
});

// Virtual for win rate
petSchema.virtual("winRate").get(function () {
  const total = this.totalBattles;
  return total > 0 ? ((this.battlesWon / total) * 100).toFixed(1) : 0;
});

// Method to calculate power level
petSchema.methods.calculatePower = function () {
  const basePower =
    this.stats.attack +
    this.stats.defense +
    this.stats.speed +
    this.stats.health / 10;
  const tierMultiplier = {
    common: 1,
    uncommon: 1.2,
    rare: 1.5,
    epic: 2,
    legendary: 3,
  };

  return Math.round(
    basePower * tierMultiplier[this.tier] * (1 + (this.level - 1) * 0.1)
  );
};

// Static method to find by tier
petSchema.statics.findByTier = function (tier) {
  return this.find({ tier }).populate("owner", "username");
};

// Static method to get user's pets
petSchema.statics.findByOwner = function (ownerId) {
  return this.find({ owner: ownerId }).sort({ tier: -1, level: -1 });
};

export default mongoose.model("Pet", petSchema);
