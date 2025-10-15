import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    // User involved
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Transaction details
    type: {
      type: String,
      required: true,
      enum: [
        "egg_purchase",
        "pet_purchase",
        "pet_sale",
        "cosmetic_purchase",
        "roll_purchase",
        "reward",
      ],
    },

    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["coins", "ETH", "MATIC", "USDC"],
      required: true,
    },

    // Item reference
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      sparse: true,
    },
    itemType: {
      type: String,
      enum: ["egg", "pet", "cosmetic", null],
      default: null,
    },

    // Blockchain data
    transactionHash: {
      type: String,
      sparse: true,
    },
    blockchainNetwork: {
      type: String,
      enum: ["ethereum", "polygon", null],
      default: null,
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
    },

    // Metadata
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ transactionHash: 1 }, { sparse: true });

// Static method to get user transaction history
transactionSchema.statics.getUserHistory = function (userId, limit = 50) {
  return this.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
};

// Static method to calculate user spending
transactionSchema.statics.getUserSpending = function (
  userId,
  currency = "coins"
) {
  return this.aggregate([
    {
      $match: {
        user: mongoose.Types.ObjectId(userId),
        currency: currency,
        type: {
          $in: [
            "egg_purchase",
            "pet_purchase",
            "cosmetic_purchase",
            "roll_purchase",
          ],
        },
        status: "completed",
      },
    },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: "$amount" },
        transactionCount: { $sum: 1 },
      },
    },
  ]);
};

export default mongoose.model("Transaction", transactionSchema);
