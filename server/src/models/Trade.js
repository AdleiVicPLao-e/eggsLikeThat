import mongoose from "mongoose";

const tradeSchema = new mongoose.Schema(
  {
    // Trade participants
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    // Item being traded - supports both pets and eggs
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      sparse: true,
    },
    itemType: {
      type: String,
      enum: ["pet", "egg", "cosmetic", "technique"],
      default: "pet",
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Dynamic reference based on itemType
    },

    // Trade details
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["ETH", "MATIC", "USDC", "coins"],
      default: "coins",
    },

    // Trade status
    status: {
      type: String,
      enum: ["listed", "sold", "cancelled", "expired", "pending"],
      default: "listed",
    },

    // Blockchain integration
    nftTokenId: {
      type: String,
      sparse: true,
    },
    blockchainListingId: {
      type: String,
      sparse: true,
    },
    blockchainTxHash: {
      type: String,
      sparse: true,
    },
    blockchainNetwork: {
      type: String,
      enum: ["ethereum", "polygon", "simulation", null],
      default: null,
    },

    // Fees
    marketplaceFee: {
      type: Number,
      default: 0.025, // 2.5%
    },
    royaltyFee: {
      type: Number,
      default: 0.01, // 1%
    },

    // Timestamps
    listedAt: {
      type: Date,
      default: Date.now,
    },
    soldAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      default: function () {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30); // 30 days expiry
        return expiry;
      },
    },

    // Additional metadata
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    tags: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
tradeSchema.index({ seller: 1, status: 1 });
tradeSchema.index({ buyer: 1, status: 1 });
tradeSchema.index({ status: 1, listedAt: -1 });
tradeSchema.index({ itemType: 1, itemId: 1 });
tradeSchema.index({ pet: 1 }, { sparse: true });
tradeSchema.index({ price: 1, currency: 1 });
tradeSchema.index({ nftTokenId: 1 }, { sparse: true });
tradeSchema.index({ blockchainListingId: 1 }, { sparse: true });
tradeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for expired trades
tradeSchema.index({ tags: 1 });

// Virtual for net amount seller receives
tradeSchema.virtual("netAmount").get(function () {
  const totalFee = this.marketplaceFee + this.royaltyFee;
  return this.price * (1 - totalFee);
});

// Virtual for item reference
tradeSchema.virtual("item", {
  ref: function () {
    return this.itemType === "pet"
      ? "Pet"
      : this.itemType === "egg"
      ? "Egg"
      : this.itemType === "cosmetic"
      ? "Cosmetic"
      : "Technique";
  },
  localField: "itemId",
  foreignField: "_id",
  justOne: true,
});

// Method to complete trade
tradeSchema.methods.completeTrade = function (buyerId, transactionHash) {
  this.buyer = buyerId;
  this.status = "sold";
  this.soldAt = new Date();
  this.blockchainTxHash = transactionHash;
  return this.save();
};

// Method to cancel trade
tradeSchema.methods.cancelTrade = function () {
  this.status = "cancelled";
  this.cancelledAt = new Date();
  return this.save();
};

// Method to check if trade is active
tradeSchema.methods.isActive = function () {
  return this.status === "listed" && new Date() < this.expiresAt;
};

// Static method to find active listings
tradeSchema.statics.findActiveListings = function (filters = {}) {
  const query = {
    status: "listed",
    expiresAt: { $gt: new Date() },
    ...filters,
  };
  return this.find(query)
    .populate("seller", "username walletAddress avatar")
    .populate("buyer", "username avatar")
    .populate("pet")
    .populate("itemId")
    .sort({ listedAt: -1 });
};

// Static method to find by seller
tradeSchema.statics.findBySeller = function (sellerId, options = {}) {
  const { status, limit = 50, page = 1 } = options;
  const query = { seller: sellerId };
  if (status) query.status = status;

  return this.find(query)
    .populate("buyer", "username avatar")
    .populate("pet")
    .populate("itemId")
    .sort({ listedAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Static method to find by buyer
tradeSchema.statics.findByBuyer = function (buyerId, options = {}) {
  const { limit = 50, page = 1 } = options;
  return this.find({
    buyer: buyerId,
    status: "sold",
  })
    .populate("seller", "username avatar")
    .populate("pet")
    .populate("itemId")
    .sort({ soldAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Static method to find expired listings
tradeSchema.statics.findExpiredListings = function () {
  return this.find({
    status: "listed",
    expiresAt: { $lte: new Date() },
  });
};

// Static method to auto-expire old listings
tradeSchema.statics.expireOldListings = async function () {
  const expired = await this.findExpiredListings();
  const updatePromises = expired.map((trade) => {
    trade.status = "expired";
    return trade.save();
  });

  await Promise.all(updatePromises);
  return expired.length;
};

// Static method to get marketplace stats
tradeSchema.statics.getMarketplaceStats = function () {
  return this.aggregate([
    {
      $facet: {
        totalListings: [{ $match: { status: "listed" } }, { $count: "count" }],
        totalSales: [{ $match: { status: "sold" } }, { $count: "count" }],
        totalVolume: [
          { $match: { status: "sold" } },
          { $group: { _id: null, total: { $sum: "$price" } } },
        ],
        averagePrice: [
          { $match: { status: "sold" } },
          { $group: { _id: null, average: { $avg: "$price" } } },
        ],
        byCurrency: [
          { $match: { status: "sold" } },
          {
            $group: {
              _id: "$currency",
              total: { $sum: "$price" },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);
};

// Pre-save middleware to handle item type consistency
tradeSchema.pre("save", function (next) {
  // If pet is provided, set itemType and itemId accordingly
  if (this.pet && !this.itemId) {
    this.itemType = "pet";
    this.itemId = this.pet;
  }

  // Set title if not provided
  if (!this.title && this.isModified("price")) {
    this.title = `${this.currency === "coins" ? "🪙" : "⚡"} ${this.price} ${
      this.currency
    }`;
  }

  next();
});

// Pre-find middleware to populate item based on itemType
tradeSchema.pre(/^find/, function (next) {
  if (this.options.populateItem !== false) {
    this.populate("itemId");
  }
  next();
});

export default mongoose.model("Trade", tradeSchema);
