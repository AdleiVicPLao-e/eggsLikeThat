import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    // Offer participants
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Pet being offered on
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pet",
      required: true,
    },

    // Offer details
    offerPrice: {
      type: Number,
      required: true,
      min: 0.001,
    },
    currency: {
      type: String,
      enum: ["coins", "ETH", "MATIC", "USDC"],
      default: "coins",
    },

    // Offer status and lifecycle
    status: {
      type: String,
      enum: [
        "pending", // Offer sent, waiting for response
        "accepted", // Offer accepted by pet owner
        "rejected", // Offer rejected by pet owner
        "countered", // Counter-offer made
        "expired", // Offer expired without response
        "cancelled", // Offer cancelled by sender
        "withdrawn", // Offer withdrawn by sender after counter
        "completed", // Trade successfully completed
      ],
      default: "pending",
    },

    // Negotiation history
    previousOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
      sparse: true, // Only populated for counter-offers
    },
    counterOffers: [
      {
        offer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Offer",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Communication
    message: {
      type: String,
      maxlength: 500,
      default: "",
    },
    responseMessage: {
      type: String,
      maxlength: 500,
      default: "",
    },

    // Timelines
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index for automatic expiration handling
    },
    respondedAt: {
      type: Date,
      sparse: true,
    },
    completedAt: {
      type: Date,
      sparse: true,
    },

    // Blockchain integration (for crypto offers)
    blockchainOfferId: {
      type: String,
      sparse: true,
    },
    transactionHash: {
      type: String,
      sparse: true,
    },

    // Fees (calculated when offer is accepted)
    marketplaceFee: {
      type: Number,
      default: 0.025, // 2.5%
    },
    royaltyFee: {
      type: Number,
      default: 0.01, // 1%
    },

    // Metadata
    isCounterOffer: {
      type: Boolean,
      default: false,
    },
    negotiationRound: {
      type: Number,
      default: 1, // 1 = initial offer, 2+ = counter offers
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
offerSchema.index({ fromUser: 1, status: 1 });
offerSchema.index({ toUser: 1, status: 1 });
offerSchema.index({ pet: 1, status: 1 });
offerSchema.index({ status: 1, expiresAt: 1 });
offerSchema.index({ createdAt: -1 });
offerSchema.index({ fromUser: 1, toUser: 1, pet: 1, status: 1 });

// Virtual for net amount seller receives
offerSchema.virtual("netAmount").get(function () {
  const totalFee = this.marketplaceFee + this.royaltyFee;
  return this.offerPrice * (1 - totalFee);
});

// Virtual for time until expiration
offerSchema.virtual("timeUntilExpiration").get(function () {
  const now = new Date();
  const expires = new Date(this.expiresAt);
  return expires - now;
});

// Virtual for isExpired (for querying)
offerSchema.virtual("isExpired").get(function () {
  return new Date() > new Date(this.expiresAt);
});

// Method to accept offer
offerSchema.methods.acceptOffer = function (responseMessage = "") {
  this.status = "accepted";
  this.responseMessage = responseMessage;
  this.respondedAt = new Date();
};

// Method to reject offer
offerSchema.methods.rejectOffer = function (responseMessage = "") {
  this.status = "rejected";
  this.responseMessage = responseMessage;
  this.respondedAt = new Date();
};

// Method to create counter offer
offerSchema.methods.createCounterOffer = function (counterPrice, message = "") {
  // This would be handled by the service, but we define the structure here
  return {
    fromUser: this.toUser, // Role reversal
    toUser: this.fromUser,
    pet: this.pet,
    offerPrice: counterPrice,
    currency: this.currency,
    message,
    previousOffer: this._id,
    isCounterOffer: true,
    negotiationRound: this.negotiationRound + 1,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };
};

// Method to complete offer (after trade execution)
offerSchema.methods.completeOffer = function (transactionHash = null) {
  this.status = "completed";
  this.completedAt = new Date();
  if (transactionHash) {
    this.transactionHash = transactionHash;
  }
};

// Method to check if offer can be acted upon
offerSchema.methods.canBeActedUpon = function () {
  return this.status === "pending" && !this.isExpired;
};

// Static method to find active offers for a user
offerSchema.statics.findActiveOffersForUser = function (userId) {
  return this.find({
    $or: [{ fromUser: userId }, { toUser: userId }],
    status: { $in: ["pending", "countered"] },
    expiresAt: { $gt: new Date() },
  })
    .populate("fromUser", "username level")
    .populate("toUser", "username level")
    .populate("pet")
    .populate("previousOffer")
    .sort({ createdAt: -1 });
};

// Static method to find offers by pet
offerSchema.statics.findOffersByPet = function (petId, status = "pending") {
  return this.find({ pet: petId, status })
    .populate("fromUser", "username level")
    .populate("toUser", "username level")
    .sort({ createdAt: -1 });
};

// Static method to find negotiation history
offerSchema.statics.findNegotiationHistory = function (originalOfferId) {
  return this.find({
    $or: [{ _id: originalOfferId }, { previousOffer: originalOfferId }],
  })
    .populate("fromUser", "username level")
    .populate("toUser", "username level")
    .populate("pet")
    .sort({ negotiationRound: 1, createdAt: 1 });
};

// Static method to expire old offers (should be run as a cron job)
offerSchema.statics.expireOldOffers = function () {
  return this.updateMany(
    {
      status: "pending",
      expiresAt: { $lt: new Date() },
    },
    {
      status: "expired",
      respondedAt: new Date(),
    }
  );
};

// Static method to get user offer statistics
offerSchema.statics.getUserOfferStats = function (userId) {
  return this.aggregate([
    {
      $match: {
        $or: [{ fromUser: userId }, { toUser: userId }],
      },
    },
    {
      $group: {
        _id: {
          userRole: {
            $cond: [{ $eq: ["$fromUser", userId] }, "sender", "receiver"],
          },
          status: "$status",
        },
        count: { $sum: 1 },
        totalValue: { $sum: "$offerPrice" },
        averageValue: { $avg: "$offerPrice" },
      },
    },
    {
      $group: {
        _id: "$_id.userRole",
        byStatus: {
          $push: {
            status: "$_id.status",
            count: "$count",
            totalValue: "$totalValue",
            averageValue: "$averageValue",
          },
        },
        totalOffers: { $sum: "$count" },
        totalValue: { $sum: "$totalValue" },
      },
    },
  ]);
};

// Pre-save middleware to set expiration if not provided
offerSchema.pre("save", function (next) {
  if (!this.expiresAt) {
    // Default to 48 hours for initial offers, 24 hours for counters
    const hours = this.isCounterOffer ? 24 : 48;
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  // Set negotiation round for counter offers
  if (this.isCounterOffer && this.previousOffer) {
    this.negotiationRound = this.negotiationRound || 2;
  }

  next();
});

// Pre-find middleware to automatically filter out expired offers in some queries
offerSchema.pre(/^find/, function (next) {
  // Only apply to queries that look for pending offers
  if (this.getFilter().status === "pending") {
    this.where({ expiresAt: { $gt: new Date() } });
  }
  next();
});

export default mongoose.model("Offer", offerSchema);
