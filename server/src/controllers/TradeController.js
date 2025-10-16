import Trade from "../models/Trade.js";
import Pet from "../models/Pet.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Offer from "../models/Offer.js";
import { tradeService } from "../services/TradeService.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";

export const TradeController = {
  // List a pet for sale
  async listPet(req, res) {
    try {
      const { petId, price, currency = "ETH" } = req.body;
      const user = await User.findById(req.user._id); // Get fresh instance

      // Validate price
      if (!price || price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid price",
        });
      }

      // Check if user owns the pet
      const pet = await Pet.findOne({ _id: petId, owner: user._id });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found or not owned by you",
        });
      }

      // Check if pet is already listed
      const existingTrade = await Trade.findOne({
        pet: petId,
        status: "listed",
      });
      if (existingTrade) {
        return res.status(400).json({
          success: false,
          message: "Pet is already listed for sale",
        });
      }

      // Check if there are any pending offers for this pet
      const pendingOffers = await Offer.find({
        pet: petId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (pendingOffers.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot list pet while there are pending offers",
        });
      }

      // Use trade service to list pet
      const result = await tradeService.listPet(
        user._id,
        petId,
        price,
        currency
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      // Create transaction record for listing fee
      const listingFee = price * result.trade.marketplaceFee;
      const transaction = new Transaction({
        user: user._id,
        type: "pet_sale",
        amount: -listingFee, // Negative for fees
        currency,
        itemId: petId,
        itemType: "pet",
        description: `Listing fee for ${pet.name}`,
        status: "completed",
      });
      await transaction.save();

      logger.info(
        `User ${user.username} listed pet ${pet.name} for ${price} ${currency}`
      );

      res.status(201).json({
        success: true,
        message: "Pet listed for sale successfully!",
        data: {
          trade: result.trade,
          fees: {
            marketplace: result.trade.marketplaceFee * 100 + "%",
            listingFee: listingFee,
            estimatedEarnings: result.trade.netAmount,
          },
          user: {
            coins: user.coins,
            level: user.level,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("List pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during pet listing",
      });
    }
  },

  // Cancel a listing
  async cancelListing(req, res) {
    try {
      const { tradeId } = req.params;
      const user = await User.findById(req.user._id); // Get fresh instance

      const result = await tradeService.cancelListing(user._id, tradeId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      // Add experience for trade activity
      const expResult = user.addExperience(10);

      await user.save();

      logger.info(`User ${user.username} cancelled trade ${tradeId}`);

      const responseData = {
        success: true,
        message: "Listing cancelled successfully",
        data: {
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      };

      if (expResult.leveledUp) {
        responseData.message += ` You leveled up to level ${expResult.newLevel}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
      }

      res.json(responseData);
    } catch (error) {
      logger.error("Cancel listing error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during listing cancellation",
      });
    }
  },

  // Purchase a listed pet
  async purchasePet(req, res) {
    try {
      const { tradeId } = req.params;
      const user = await User.findById(req.user._id); // Get fresh instance

      const result = await tradeService.purchasePet(user._id, tradeId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      // Get seller user instance
      const seller = await User.findById(result.trade.seller);

      // Create transaction records
      const purchaseTransaction = new Transaction({
        user: user._id,
        type: "pet_purchase",
        amount: -result.trade.price, // Negative for purchase
        currency: result.trade.currency,
        itemId: result.pet._id,
        itemType: "pet",
        description: `Purchased ${result.pet.name} from ${seller.username}`,
        status: "completed",
      });

      const saleTransaction = new Transaction({
        user: seller._id,
        type: "pet_sale",
        amount: result.trade.netAmount, // Positive for sale (after fees)
        currency: result.trade.currency,
        itemId: result.pet._id,
        itemType: "pet",
        description: `Sold ${result.pet.name} to ${user.username}`,
        status: "completed",
      });

      await purchaseTransaction.save();
      await saleTransaction.save();

      // Update seller's coins
      seller.coins += result.trade.netAmount;
      await seller.save();

      // Add experience for both users
      const buyerExpResult = user.addExperience(25);
      const sellerExpResult = seller.addExperience(15);

      await user.save();
      await seller.save();

      // Send notifications
      if (seller.email && seller.preferences?.notifications) {
        try {
          await mailService.sendTradeNotification(seller, result.trade, "sold");
        } catch (emailError) {
          logger.warn("Failed to send sale notification email:", emailError);
        }
      }

      if (user.email && user.preferences?.notifications) {
        try {
          await mailService.sendTradeNotification(
            user,
            result.trade,
            "purchased"
          );
        } catch (emailError) {
          logger.warn(
            "Failed to send purchase notification email:",
            emailError
          );
        }
      }

      logger.info(
        `User ${user.username} purchased pet ${result.pet.name} from ${seller.username}`
      );

      const responseData = {
        success: true,
        message: "Pet purchased successfully!",
        data: {
          trade: result.trade,
          pet: {
            ...result.pet.toObject(),
            power: this.calculatePetPower(result.pet),
            totalBattles: result.pet.battlesWon + result.pet.battlesLost,
            winRate:
              result.pet.battlesWon + result.pet.battlesLost > 0
                ? (
                    (result.pet.battlesWon /
                      (result.pet.battlesWon + result.pet.battlesLost)) *
                    100
                  ).toFixed(1)
                : 0,
          },
          fees: {
            marketplace: result.trade.marketplaceFee * 100 + "%",
            royalty: result.trade.royaltyFee * 100 + "%",
            total:
              (result.trade.marketplaceFee + result.trade.royaltyFee) * 100 +
              "%",
          },
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      };

      if (buyerExpResult.leveledUp) {
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = buyerExpResult.newLevel;
      }

      res.json(responseData);
    } catch (error) {
      logger.error("Purchase pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during pet purchase",
      });
    }
  },

  // Get marketplace listings
  async getListings(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        tier,
        type,
        minPrice,
        maxPrice,
        currency = "ETH",
        sortBy = "newest",
      } = req.query;

      const filters = { currency, status: "listed" };

      // Apply filters
      if (tier) filters["pet.tier"] = tier;
      if (type) filters["pet.type"] = type;
      if (minPrice)
        filters.price = { ...filters.price, $gte: parseFloat(minPrice) };
      if (maxPrice)
        filters.price = { ...filters.price, $lte: parseFloat(maxPrice) };

      // Get listings with pagination
      const trades = await Trade.find(filters)
        .populate("pet")
        .populate("seller", "username level")
        .sort(this.getSortOption(sortBy))
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await Trade.countDocuments(filters);

      // Enhance listings with additional data
      const enhancedTrades = trades.map((trade) => ({
        ...trade,
        timeListed: this.formatTimeListed(trade.listedAt),
        isOwnListing: trade.seller._id.toString() === req.user?._id?.toString(),
        petWithStats: {
          ...trade.pet,
          power: this.calculatePetPower(trade.pet),
          totalBattles: trade.pet.battlesWon + trade.pet.battlesLost,
          winRate:
            trade.pet.battlesWon + trade.pet.battlesLost > 0
              ? (
                  (trade.pet.battlesWon /
                    (trade.pet.battlesWon + trade.pet.battlesLost)) *
                  100
                ).toFixed(1)
              : 0,
        },
        sellerStats: {
          level: trade.seller.level,
          totalBattles: trade.seller.totalBattles,
          winRate: trade.seller.winRate,
        },
      }));

      res.json({
        success: true,
        data: {
          listings: enhancedTrades,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          filters: {
            tier,
            type,
            minPrice,
            maxPrice,
            currency,
            sortBy,
          },
        },
      });
    } catch (error) {
      logger.error("Get listings error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get user's active listings
  async getUserListings(req, res) {
    try {
      const { page = 1, limit = 20, status = "listed" } = req.query;
      const user = await User.findById(req.user._id); // Get fresh instance

      const query = { seller: user._id };

      if (status !== "all") {
        query.status = status;
      }

      const trades = await Trade.find(query)
        .populate("pet")
        .populate("buyer", "username level")
        .sort({ listedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await Trade.countDocuments(query);

      // Calculate statistics
      const stats = await this.getUserTradeStats(user._id);

      // Get transaction history for user
      const recentTransactions = await Transaction.getUserHistory(user._id, 10);

      res.json({
        success: true,
        data: {
          listings: trades,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          stats,
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
            recentTransactions,
          },
        },
      });
    } catch (error) {
      logger.error("Get user listings error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get user's trade history
  async getTradeHistory(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const user = await User.findById(req.user._id); // Get fresh instance

      // Get trades where user is either seller or buyer
      const trades = await Trade.find({
        $or: [{ seller: user._id }, { buyer: user._id }],
        status: { $in: ["sold", "cancelled"] },
      })
        .populate("pet")
        .populate("seller", "username")
        .populate("buyer", "username")
        .sort({ soldAt: -1, cancelledAt: -1, listedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await Trade.countDocuments({
        $or: [{ seller: user._id }, { buyer: user._id }],
        status: { $in: ["sold", "cancelled"] },
      });

      // Get transaction history
      const transactions = await Transaction.getUserHistory(user._id, limit);

      res.json({
        success: true,
        data: {
          trades,
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Get trade history error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get marketplace statistics
  async getMarketplaceStats(req, res) {
    try {
      const user = req.user ? await User.findById(req.user._id) : null;

      const stats = await Trade.aggregate([
        {
          $match: {
            status: "sold",
            soldAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
          },
        },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: "$price" },
            averagePrice: { $avg: "$price" },
            totalSales: { $sum: 1 },
            uniqueSellers: { $addToSet: "$seller" },
            uniqueBuyers: { $addToSet: "$buyer" },
          },
        },
      ]);

      const recentListings = await Trade.countDocuments({
        status: "listed",
        listedAt: { $gte: new Date(Date.now() - 1 * 60 * 60 * 1000) }, // Last hour
      });

      const defaultStats = {
        totalVolume: 0,
        averagePrice: 0,
        totalSales: 0,
        uniqueSellers: 0,
        uniqueBuyers: 0,
      };

      const statData = stats[0] || defaultStats;

      // Get user's personal trade stats if logged in
      let userTradeStats = null;
      if (user) {
        userTradeStats = await this.getUserTradeStats(user._id);
      }

      res.json({
        success: true,
        data: {
          volume24h: {
            total: statData.totalVolume,
            average: statData.averagePrice,
            sales: statData.totalSales,
          },
          participants: {
            sellers: statData.uniqueSellers?.length || 0,
            buyers: statData.uniqueBuyers?.length || 0,
            newListings: recentListings,
          },
          popularItems: await this.getPopularItems(),
          userStats: userTradeStats,
          user: user
            ? {
                coins: user.coins,
                level: user.level,
                totalBattles: user.totalBattles,
                winRate: user.winRate,
              }
            : null,
        },
      });
    } catch (error) {
      logger.error("Get marketplace stats error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Make an offer on a pet (not listed for sale)
  async makeOffer(req, res) {
    try {
      const {
        petId,
        offerPrice,
        currency = "coins",
        message,
        expiresInHours = 48,
      } = req.body;
      const user = await User.findById(req.user._id); // Get fresh instance

      // Check if pet exists and is not owned by the user
      const pet = await Pet.findById(petId).populate("owner");
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      if (pet.owner._id.toString() === user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "Cannot make an offer on your own pet",
        });
      }

      // Check if pet is already listed
      const existingListing = await Trade.findOne({
        pet: petId,
        status: "listed",
      });

      if (existingListing) {
        return res.status(400).json({
          success: false,
          message: "Pet is already listed for sale",
        });
      }

      // Check if user has enough coins for the offer (if using coins)
      if (currency === "coins" && user.coins < offerPrice) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins for this offer. Need: ${offerPrice}, Have: ${user.coins}`,
        });
      }

      // Check if there's already a pending offer from this user for this pet
      const existingOffer = await Offer.findOne({
        fromUser: user._id,
        pet: petId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (existingOffer) {
        return res.status(400).json({
          success: false,
          message: "You already have a pending offer for this pet",
        });
      }

      // Create the offer using Offer model
      const offer = new Offer({
        fromUser: user._id,
        toUser: pet.owner._id,
        pet: petId,
        offerPrice,
        currency,
        message,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      });

      await offer.save();
      await offer.populate("fromUser", "username level");
      await offer.populate("toUser", "username level");
      await offer.populate("pet");

      // Create pending transaction for the offer (reserved funds)
      if (currency === "coins") {
        const transaction = new Transaction({
          user: user._id,
          type: "pet_purchase",
          amount: -offerPrice,
          currency,
          itemId: petId,
          itemType: "pet",
          description: `Offer for ${pet.name} - Pending`,
          status: "pending",
        });
        await transaction.save();
      }

      // Add experience for making an offer
      const expResult = user.addExperience(5);
      await user.save();

      logger.info(
        `User ${user.username} made offer of ${offerPrice} ${currency} for pet ${pet.name}`
      );

      const responseData = {
        success: true,
        message: "Offer sent successfully!",
        data: {
          offer: {
            id: offer._id,
            pet: {
              id: pet._id,
              name: pet.name,
              tier: pet.tier,
              type: pet.type,
              level: pet.level,
            },
            seller: {
              id: pet.owner._id,
              username: pet.owner.username,
              level: pet.owner.level,
            },
            buyer: {
              id: user._id,
              username: user.username,
              level: user.level,
            },
            offerPrice,
            currency,
            message,
            status: offer.status,
            expiresAt: offer.expiresAt,
            timeUntilExpiration: offer.timeUntilExpiration,
          },
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      };

      if (expResult.leveledUp) {
        responseData.message += ` You leveled up to level ${expResult.newLevel}!`;
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
      }

      res.status(201).json(responseData);
    } catch (error) {
      logger.error("Make offer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during offer creation",
      });
    }
  },

  // Get user's offers (sent and received)
  async getUserOffers(req, res) {
    try {
      const { type = "all", page = 1, limit = 20 } = req.query;
      const user = await User.findById(req.user._id); // Get fresh instance

      let query = {};

      if (type === "sent") {
        query.fromUser = user._id;
      } else if (type === "received") {
        query.toUser = user._id;
      } else {
        query.$or = [{ fromUser: user._id }, { toUser: user._id }];
      }

      const offers = await Offer.find(query)
        .populate("fromUser", "username level")
        .populate("toUser", "username level")
        .populate("pet")
        .populate("previousOffer")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await Offer.countDocuments(query);

      // Get offer statistics
      const offerStats = await Offer.getUserOfferStats(user._id);

      res.json({
        success: true,
        data: {
          offers: offers.map((offer) => ({
            ...offer,
            isSender: offer.fromUser._id.toString() === user._id.toString(),
            timeUntilExpiration: new Date(offer.expiresAt) - new Date(),
            isExpired: new Date() > new Date(offer.expiresAt),
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          stats: offerStats,
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Get user offers error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Accept an offer
  async acceptOffer(req, res) {
    try {
      const { offerId } = req.params;
      const { responseMessage = "" } = req.body;
      const user = await User.findById(req.user._id); // Get fresh instance

      const offer = await Offer.findById(offerId)
        .populate("fromUser")
        .populate("toUser")
        .populate("pet");

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Offer not found",
        });
      }

      // Verify user owns the pet
      if (offer.toUser._id.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to accept this offer",
        });
      }

      // Check if offer can be accepted
      if (!offer.canBeActedUpon()) {
        return res.status(400).json({
          success: false,
          message:
            "This offer cannot be accepted (may be expired or already acted upon)",
        });
      }

      // Accept the offer
      offer.acceptOffer(responseMessage);
      await offer.save();

      // Transfer pet ownership
      const pet = offer.pet;
      const originalOwner = user;
      const buyer = offer.fromUser;

      pet.owner = buyer._id;
      await pet.save();

      // Handle payment
      if (offer.currency === "coins") {
        // Transfer coins from buyer to seller (minus fees)
        const netAmount = offer.netAmount;

        // Update buyer's coins (deduct offer price)
        buyer.coins -= offer.offerPrice;
        await buyer.save();

        // Update seller's coins (add net amount after fees)
        originalOwner.coins += netAmount;
        await originalOwner.save();

        // Update pending transaction to completed
        await Transaction.updateOne(
          {
            user: buyer._id,
            itemId: pet._id,
            status: "pending",
            type: "pet_purchase",
          },
          {
            status: "completed",
            description: `Purchased ${pet.name} from ${originalOwner.username} via offer`,
          }
        );

        // Create sale transaction for seller
        const saleTransaction = new Transaction({
          user: originalOwner._id,
          type: "pet_sale",
          amount: netAmount,
          currency: offer.currency,
          itemId: pet._id,
          itemType: "pet",
          description: `Sold ${pet.name} to ${buyer.username} via offer acceptance`,
          status: "completed",
        });
        await saleTransaction.save();
      }

      // Add experience for both users
      const sellerExpResult = originalOwner.addExperience(20);
      const buyerExpResult = buyer.addExperience(15);

      await originalOwner.save();
      await buyer.save();

      // Complete the offer
      offer.completeOffer();
      await offer.save();

      logger.info(
        `User ${user.username} accepted offer ${offerId} from ${buyer.username}`
      );

      const responseData = {
        success: true,
        message: "Offer accepted successfully! Pet has been transferred.",
        data: {
          offer: offer.toObject(),
          pet: {
            id: pet._id,
            name: pet.name,
            newOwner: buyer.username,
          },
          payment: {
            amount: offer.offerPrice,
            currency: offer.currency,
            fees: {
              marketplace: offer.marketplaceFee * 100 + "%",
              royalty: offer.royaltyFee * 100 + "%",
            },
            netAmount: offer.netAmount,
          },
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      };

      if (sellerExpResult.leveledUp) {
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = sellerExpResult.newLevel;
      }

      res.json(responseData);
    } catch (error) {
      logger.error("Accept offer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during offer acceptance",
      });
    }
  },

  // Reject an offer
  async rejectOffer(req, res) {
    try {
      const { offerId } = req.params;
      const { responseMessage = "" } = req.body;
      const user = await User.findById(req.user._id);

      const offer = await Offer.findById(offerId)
        .populate("fromUser")
        .populate("toUser");

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Offer not found",
        });
      }

      // Verify user owns the pet
      if (offer.toUser._id.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to reject this offer",
        });
      }

      // Check if offer can be rejected
      if (!offer.canBeActedUpon()) {
        return res.status(400).json({
          success: false,
          message: "This offer cannot be rejected",
        });
      }

      // Reject the offer
      offer.rejectOffer(responseMessage);
      await offer.save();

      // Refund any reserved funds
      if (offer.currency === "coins") {
        await Transaction.updateOne(
          {
            user: offer.fromUser._id,
            itemId: offer.pet,
            status: "pending",
            type: "pet_purchase",
          },
          {
            status: "cancelled",
            description: `Offer for ${offer.pet.name} was rejected`,
          }
        );
      }

      logger.info(
        `User ${user.username} rejected offer ${offerId} from ${offer.fromUser.username}`
      );

      res.json({
        success: true,
        message: "Offer rejected successfully",
        data: {
          offer: offer.toObject(),
          user: {
            coins: user.coins,
            level: user.level,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Reject offer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during offer rejection",
      });
    }
  },

  // Make a counter offer
  async counterOffer(req, res) {
    try {
      const { offerId } = req.params;
      const { counterPrice, message = "", expiresInHours = 24 } = req.body;
      const user = await User.findById(req.user._id);

      const originalOffer = await Offer.findById(offerId)
        .populate("fromUser")
        .populate("toUser")
        .populate("pet");

      if (!originalOffer) {
        return res.status(404).json({
          success: false,
          message: "Original offer not found",
        });
      }

      // Verify user owns the pet
      if (originalOffer.toUser._id.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to counter this offer",
        });
      }

      // Check if original offer can be countered
      if (!originalOffer.canBeActedUpon()) {
        return res.status(400).json({
          success: false,
          message: "This offer cannot be countered",
        });
      }

      // Create counter offer
      const counterOfferData = originalOffer.createCounterOffer(
        counterPrice,
        message
      );
      const counterOffer = new Offer({
        ...counterOfferData,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      });

      await counterOffer.save();
      await counterOffer.populate("fromUser", "username level");
      await counterOffer.populate("toUser", "username level");
      await counterOffer.populate("pet");

      // Update original offer status
      originalOffer.status = "countered";
      await originalOffer.save();

      // Add counter offer to original offer's history
      originalOffer.counterOffers.push({
        offer: counterOffer._id,
        createdAt: new Date(),
      });
      await originalOffer.save();

      logger.info(
        `User ${user.username} countered offer ${offerId} with ${counterPrice} ${counterOffer.currency}`
      );

      res.status(201).json({
        success: true,
        message: "Counter offer sent successfully!",
        data: {
          counterOffer: counterOffer.toObject(),
          originalOffer: originalOffer.toObject(),
          user: {
            coins: user.coins,
            level: user.level,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Counter offer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during counter offer creation",
      });
    }
  },

  // Cancel an offer (by the sender)
  async cancelOffer(req, res) {
    try {
      const { offerId } = req.params;
      const user = await User.findById(req.user._id);

      const offer = await Offer.findById(offerId)
        .populate("fromUser")
        .populate("toUser");

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Offer not found",
        });
      }

      // Verify user is the sender
      if (offer.fromUser._id.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only cancel your own offers",
        });
      }

      // Check if offer can be cancelled
      if (!offer.canBeActedUpon()) {
        return res.status(400).json({
          success: false,
          message: "This offer cannot be cancelled",
        });
      }

      // Cancel the offer
      offer.status = "cancelled";
      offer.respondedAt = new Date();
      await offer.save();

      // Refund any reserved funds
      if (offer.currency === "coins") {
        await Transaction.updateOne(
          {
            user: user._id,
            itemId: offer.pet,
            status: "pending",
            type: "pet_purchase",
          },
          {
            status: "cancelled",
            description: `Offer for ${offer.pet.name} was cancelled`,
          }
        );
      }

      logger.info(`User ${user.username} cancelled offer ${offerId}`);

      res.json({
        success: true,
        message: "Offer cancelled successfully",
        data: {
          offer: offer.toObject(),
          user: {
            coins: user.coins,
            level: user.level,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Cancel offer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during offer cancellation",
      });
    }
  },

  // Get negotiation history for an offer
  async getNegotiationHistory(req, res) {
    try {
      const { offerId } = req.params;
      const user = await User.findById(req.user._id);

      const negotiationHistory = await Offer.findNegotiationHistory(offerId);

      // Verify user is part of this negotiation
      const userInvolved = negotiationHistory.some(
        (offer) =>
          offer.fromUser._id.toString() === user._id.toString() ||
          offer.toUser._id.toString() === user._id.toString()
      );

      if (!userInvolved) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this negotiation history",
        });
      }

      res.json({
        success: true,
        data: {
          negotiationHistory: negotiationHistory.map((offer) => ({
            ...offer.toObject(),
            isSender: offer.fromUser._id.toString() === user._id.toString(),
          })),
          user: {
            coins: user.coins,
            level: user.level,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Get negotiation history error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  // Get user's transaction history
  async getTransactionHistory(req, res) {
    try {
      const { page = 1, limit = 20, type, currency } = req.query;
      const user = await User.findById(req.user._id); // Get fresh instance

      const query = { user: user._id };
      if (type) query.type = type;
      if (currency) query.currency = currency;

      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await Transaction.countDocuments(query);

      // Calculate spending statistics
      const spendingStats = await Transaction.getUserSpending(
        user._id,
        "coins"
      );
      const ethSpendingStats = await Transaction.getUserSpending(
        user._id,
        "ETH"
      );

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
          },
          stats: {
            coins: spendingStats[0] || { totalSpent: 0, transactionCount: 0 },
            eth: ethSpendingStats[0] || { totalSpent: 0, transactionCount: 0 },
          },
          user: {
            coins: user.coins,
            level: user.level,
            experience: user.experience,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Get transaction history error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Helper methods
  getSortOption(sortBy) {
    const sortOptions = {
      newest: { listedAt: -1 },
      oldest: { listedAt: 1 },
      price_low: { price: 1 },
      price_high: { price: -1 },
      level: { "pet.level": -1 },
      tier: { "pet.tier": -1 },
    };
    return sortOptions[sortBy] || sortOptions.newest;
  },

  formatTimeListed(listedAt) {
    const now = new Date();
    const listed = new Date(listedAt);
    const diffMs = now - listed;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const minutes = Math.floor(diffMs / (1000 * 60));
      return `${minutes}m ago`;
    } else if (diffHours < 24) {
      const hours = Math.floor(diffHours);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffHours / 24);
      return `${days}d ago`;
    }
  },

  calculatePetPower(pet) {
    const { attack, defense, speed, health } = pet.stats;
    const tierMultiplier = {
      common: 1,
      uncommon: 1.2,
      rare: 1.5,
      epic: 2,
      legendary: 3,
    };

    const basePower = attack + defense + speed + health / 10;
    return Math.round(
      basePower * tierMultiplier[pet.tier] * (1 + (pet.level - 1) * 0.1)
    );
  },

  async getUserTradeStats(userId) {
    const stats = await Trade.aggregate([
      {
        $match: {
          $or: [{ seller: userId }, { buyer: userId }],
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$price" },
        },
      },
    ]);

    const totalStats = await Trade.aggregate([
      {
        $match: {
          $or: [{ seller: userId }, { buyer: userId }],
          status: "sold",
        },
      },
      {
        $group: {
          _id: null,
          totalEarned: {
            $sum: {
              $cond: [{ $eq: ["$seller", userId] }, "$price", 0],
            },
          },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ["$buyer", userId] }, "$price", 0],
            },
          },
        },
      },
    ]);

    const statObject = {};
    stats.forEach((stat) => {
      statObject[stat._id] = {
        count: stat.count,
        totalValue: stat.totalValue,
      };
    });

    const totals = totalStats[0] || { totalEarned: 0, totalSpent: 0 };

    return {
      byStatus: statObject,
      totals: {
        earned: totals.totalEarned,
        spent: totals.totalSpent,
        net: totals.totalEarned - totals.totalSpent,
      },
    };
  },

  async getPopularItems() {
    const popular = await Trade.aggregate([
      {
        $match: { status: "sold" },
      },
      {
        $lookup: {
          from: "pets",
          localField: "pet",
          foreignField: "_id",
          as: "petData",
        },
      },
      {
        $unwind: "$petData",
      },
      {
        $group: {
          _id: {
            tier: "$petData.tier",
            type: "$petData.type",
          },
          count: { $sum: 1 },
          averagePrice: { $avg: "$price" },
          totalVolume: { $sum: "$price" },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    return popular.map((item) => ({
      tier: item._id.tier,
      type: item._id.type,
      sales: item.count,
      averagePrice: item.averagePrice,
      totalVolume: item.totalVolume,
    }));
  },
};

export default TradeController;
