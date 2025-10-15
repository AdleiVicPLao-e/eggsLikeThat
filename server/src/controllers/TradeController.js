import Trade from "../models/Trade.js";
import Pet from "../models/Pet.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { tradeService } from "../services/TradeService.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";

export const TradeController = {
  // List a pet for sale
  async listPet(req, res) {
    try {
      const { petId, price, currency = "ETH" } = req.body;
      const user = req.user;

      // Validate price
      if (!price || price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid price",
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

      logger.info(
        `User ${user.username} listed pet ${petId} for ${price} ${currency}`
      );

      res.status(201).json({
        success: true,
        message: "Pet listed for sale successfully!",
        data: {
          trade: result.trade,
          listingFee: result.trade.marketplaceFee * 100 + "%",
          estimatedEarnings: result.trade.netAmount,
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
      const user = req.user;

      const result = await tradeService.cancelListing(user._id, tradeId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      logger.info(`User ${user.username} cancelled trade ${tradeId}`);

      res.json({
        success: true,
        message: "Listing cancelled successfully",
      });
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
      const user = req.user;

      const result = await tradeService.purchasePet(user._id, tradeId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      // Send notifications
      if (result.trade.seller.email) {
        await mailService.sendTradeNotification(
          result.trade.seller,
          result.trade,
          "sold"
        );
      }

      if (user.email) {
        await mailService.sendTradeNotification(
          user,
          result.trade,
          "purchased"
        );
      }

      logger.info(`User ${user.username} purchased pet from trade ${tradeId}`);

      res.json({
        success: true,
        message: "Pet purchased successfully!",
        data: {
          trade: result.trade,
          pet: result.pet,
          fees: {
            marketplace: result.trade.marketplaceFee * 100 + "%",
            royalty: result.trade.royaltyFee * 100 + "%",
            total:
              (result.trade.marketplaceFee + result.trade.royaltyFee) * 100 +
              "%",
          },
        },
      });
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

      const filters = { currency };

      // Apply filters
      if (tier) filters["pet.tier"] = tier;
      if (type) filters["pet.type"] = type;
      if (minPrice)
        filters.price = { ...filters.price, $gte: parseFloat(minPrice) };
      if (maxPrice)
        filters.price = { ...filters.price, $lte: parseFloat(maxPrice) };

      // Use trade service to get listings
      const result = await tradeService.getListings(
        filters,
        parseInt(page),
        parseInt(limit)
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      // Enhance listings with additional data
      const enhancedTrades = result.trades.map((trade) => ({
        ...trade,
        timeListed: this.formatTimeListed(trade.listedAt),
        isOwnListing: trade.seller._id.toString() === req.user?._id?.toString(),
        petWithStats: {
          ...trade.pet,
          power: this.calculatePetPower(trade.pet),
          totalBattles: trade.pet.battlesWon + trade.pet.battlesLost,
          winRate:
            trade.pet.totalBattles > 0
              ? ((trade.pet.battlesWon / trade.pet.totalBattles) * 100).toFixed(
                  1
                )
              : 0,
        },
      }));

      res.json({
        success: true,
        data: {
          listings: enhancedTrades,
          pagination: result.pagination,
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
      const user = req.user;

      const query = { seller: user._id };

      if (status !== "all") {
        query.status = status;
      }

      const trades = await Trade.find(query)
        .populate("pet")
        .populate("buyer", "username")
        .sort({ listedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await Trade.countDocuments(query);

      // Calculate statistics
      const stats = await this.getUserTradeStats(user._id);

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
      const user = req.user;

      const result = await tradeService.getUserTradeHistory(
        user._id,
        parseInt(page),
        parseInt(limit)
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      res.json({
        success: true,
        data: {
          history: result.trades,
          pagination: result.pagination,
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
      const { petId, offerPrice, currency = "ETH", message } = req.body;
      const user = req.user;

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

      // Create offer (in a real implementation, you might have an Offer model)
      const offer = {
        fromUser: user._id,
        pet: petId,
        offerPrice,
        currency,
        message,
        status: "pending",
        createdAt: new Date(),
      };

      // In a real implementation, you'd save this to an Offer collection
      // and notify the pet owner

      logger.info(
        `User ${user.username} made offer of ${offerPrice} ${currency} for pet ${petId}`
      );

      res.json({
        success: true,
        message: "Offer sent successfully!",
        data: {
          offer: {
            id: `offer_${Date.now()}`,
            pet: {
              id: pet._id,
              name: pet.name,
              tier: pet.tier,
              type: pet.type,
            },
            seller: {
              username: pet.owner.username,
            },
            offerPrice,
            currency,
            message,
            status: "pending",
          },
        },
      });
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
      const user = req.user;

      // In a real implementation, you'd query an Offer model
      // For now, return mock data
      const mockOffers = {
        sent: [],
        received: [],
      };

      res.json({
        success: true,
        data: {
          offers: mockOffers,
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

  // Helper methods
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
    // Get most traded pet types and tiers
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
