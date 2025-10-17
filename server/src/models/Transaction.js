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
        "marketplace_fee",
        "royalty_fee",
        "trade_listing",
        "trade_cancellation",
        "withdrawal",
        "deposit",
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
      enum: ["egg", "pet", "cosmetic", "trade", "fee", null],
      default: null,
    },

    // Trade reference for marketplace transactions
    trade: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trade",
      sparse: true,
    },

    // Blockchain data
    blockchainTxHash: {
      type: String,
      sparse: true,
    },
    blockchainNetwork: {
      type: String,
      enum: ["ethereum", "polygon", "simulation", null],
      default: null,
    },

    // Counterparty information
    counterparty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled", "refunded"],
      default: "pending",
    },

    // Metadata
    description: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed, // For additional data like fees, net amounts, etc.
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1 });
transactionSchema.index({ blockchainTxHash: 1 }, { sparse: true });
transactionSchema.index({ trade: 1 }, { sparse: true });
transactionSchema.index({ counterparty: 1 }, { sparse: true });
transactionSchema.index({ currency: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

// Static method to get user transaction history
transactionSchema.statics.getUserHistory = function (userId, options = {}) {
  const { limit = 50, page = 1, type, currency, status } = options;

  const query = { user: userId };
  if (type) query.type = type;
  if (currency) query.currency = currency;
  if (status) query.status = status;

  return this.find(query)
    .populate("counterparty", "username avatar")
    .populate("trade")
    .populate("itemId")
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

// Static method to calculate user spending
transactionSchema.statics.getUserSpending = function (
  userId,
  currency = "coins",
  period = "all" // all, day, week, month, year
) {
  const dateFilter = {};
  const now = new Date();

  switch (period) {
    case "day":
      dateFilter.$gte = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "week":
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
      break;
    case "month":
      dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case "year":
      dateFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
  }

  const matchStage = {
    user: mongoose.Types.ObjectId(userId),
    currency: currency,
    type: {
      $in: [
        "egg_purchase",
        "pet_purchase",
        "cosmetic_purchase",
        "roll_purchase",
        "marketplace_fee",
      ],
    },
    status: "completed",
  };

  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSpent: { $sum: "$amount" },
        transactionCount: { $sum: 1 },
        averageTransaction: { $avg: "$amount" },
      },
    },
  ]);
};

// Static method to get user earnings
transactionSchema.statics.getUserEarnings = function (
  userId,
  currency = "coins",
  period = "all"
) {
  const dateFilter = {};
  const now = new Date();

  switch (period) {
    case "day":
      dateFilter.$gte = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "week":
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
      break;
    case "month":
      dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case "year":
      dateFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
  }

  const matchStage = {
    user: mongoose.Types.ObjectId(userId),
    currency: currency,
    type: {
      $in: ["pet_sale", "reward"],
    },
    status: "completed",
  };

  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalEarned: { $sum: "$amount" },
        transactionCount: { $sum: 1 },
        averageTransaction: { $avg: "$amount" },
      },
    },
  ]);
};

// Static method to get marketplace revenue
transactionSchema.statics.getMarketplaceRevenue = function (period = "month") {
  const dateFilter = {};
  const now = new Date();

  switch (period) {
    case "day":
      dateFilter.$gte = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "week":
      dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
      break;
    case "month":
      dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case "year":
      dateFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
  }

  const matchStage = {
    type: {
      $in: ["marketplace_fee", "royalty_fee"],
    },
    status: "completed",
  };

  if (Object.keys(dateFilter).length > 0) {
    matchStage.createdAt = dateFilter;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$currency",
        totalFees: { $sum: "$amount" },
        transactionCount: { $sum: 1 },
      },
    },
  ]);
};

// Method to mark transaction as completed
transactionSchema.methods.markCompleted = function (txHash = null) {
  this.status = "completed";
  if (txHash) this.blockchainTxHash = txHash;
  return this.save();
};

// Method to mark transaction as failed
transactionSchema.methods.markFailed = function () {
  this.status = "failed";
  return this.save();
};

// Static method to create trade-related transactions
transactionSchema.statics.createTradeTransactions = async function (
  trade,
  buyerId
) {
  const transactions = [];

  // Buyer's purchase transaction
  transactions.push({
    user: buyerId,
    type: "pet_purchase",
    amount: -trade.price,
    currency: trade.currency,
    status: "completed",
    itemId: trade.itemId,
    itemType: trade.itemType,
    trade: trade._id,
    counterparty: trade.seller,
    description: `Purchased ${trade.itemType} from marketplace`,
    blockchainTxHash: trade.blockchainTxHash,
    blockchainNetwork: trade.blockchainNetwork,
    metadata: {
      originalPrice: trade.price,
      fees: trade.marketplaceFee + trade.royaltyFee,
    },
  });

  // Seller's sale transaction (net amount after fees)
  const netAmount = trade.netAmount;
  transactions.push({
    user: trade.seller,
    type: "pet_sale",
    amount: netAmount,
    currency: trade.currency,
    status: "completed",
    itemId: trade.itemId,
    itemType: trade.itemType,
    trade: trade._id,
    counterparty: buyerId,
    description: `Sold ${trade.itemType} on marketplace`,
    blockchainTxHash: trade.blockchainTxHash,
    blockchainNetwork: trade.blockchainNetwork,
    metadata: {
      originalPrice: trade.price,
      netAmount: netAmount,
      marketplaceFee: trade.marketplaceFee * trade.price,
      royaltyFee: trade.royaltyFee * trade.price,
    },
  });

  // Marketplace fee transaction
  const marketplaceFeeAmount = trade.price * trade.marketplaceFee;
  transactions.push({
    user: trade.seller, // Fee deducted from seller
    type: "marketplace_fee",
    amount: -marketplaceFeeAmount,
    currency: trade.currency,
    status: "completed",
    itemId: trade._id,
    itemType: "fee",
    trade: trade._id,
    description: `Marketplace fee for ${trade.itemType} sale`,
    blockchainTxHash: trade.blockchainTxHash,
    metadata: {
      feePercentage: trade.marketplaceFee,
      originalPrice: trade.price,
    },
  });

  return this.create(transactions);
};

export default mongoose.model("Transaction", transactionSchema);
