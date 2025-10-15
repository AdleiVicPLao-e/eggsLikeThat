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

    // Item being traded
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },

    // Trade details
    price: {
      type: Number,
      required: true,
      min: 0.001,
    },
    currency: {
      type: String,
      enum: ["ETH", "MATIC", "USDC"],
      default: "ETH",
    },

    // Trade status
    status: {
      type: String,
      enum: ["listed", "sold", "cancelled", "expired"],
      default: "listed",
    },

    // Blockchain integration
    blockchainListingId: {
      type: String,
      sparse: true,
    },
    transactionHash: {
      type: String,
      sparse: true,
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

    // Fees
    marketplaceFee: {
      type: Number,
      default: 0.025, // 2.5%
    },
    royaltyFee: {
      type: Number,
      default: 0.01, // 1%
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
tradeSchema.index({ seller: 1, status: 1 });
tradeSchema.index({ status: 1, listedAt: -1 });
tradeSchema.index({ pet: 1 }, { sparse: true });
tradeSchema.index({ price: 1, currency: 1 });

// Virtual for net amount seller receives
tradeSchema.virtual("netAmount").get(function () {
  const totalFee = this.marketplaceFee + this.royaltyFee;
  return this.price * (1 - totalFee);
});

// Method to complete trade
tradeSchema.methods.completeTrade = function (buyerId, transactionHash) {
  this.buyer = buyerId;
  this.status = "sold";
  this.soldAt = new Date();
  this.transactionHash = transactionHash;
};

// Static method to find active listings
tradeSchema.statics.findActiveListings = function (filters = {}) {
  const query = { status: "listed", ...filters };
  return this.find(query)
    .populate("seller", "username walletAddress")
    .populate("pet")
    .sort({ listedAt: -1 });
};

// Static method to find by seller
tradeSchema.statics.findBySeller = function (sellerId) {
  return this.find({ seller: sellerId })
    .populate("buyer", "username")
    .populate("pet")
    .sort({ listedAt: -1 });
};

export default mongoose.model("Trade", tradeSchema);
