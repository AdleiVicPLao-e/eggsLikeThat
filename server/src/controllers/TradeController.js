import Trade from "../models/Trade.js";
import { Pet } from "../models/Pet.js";
import { Egg } from "../models/Egg.js";
import { User } from "../models/User.js";
import Transaction from "../models/Transaction.js";
import Offer from "../models/Offer.js";
import { tradeService, marketplaceService } from "../services/TradeService.js";
import { blockchainService } from "../config/blockchain.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";

export const TradeController = {
  // List a pet for sale with blockchain integration
  async listPet(req, res) {
    try {
      const { petId, price, currency = "ETH" } = req.body;
      const user = await User.findById(req.user._id);

      if (!petId || !price || price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Missing or invalid required fields",
        });
      }

      // Check pet ownership
      const pet = await Pet.findOne({ _id: petId, ownerId: user._id });
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found or not owned by you",
        });
      }

      // Handle blockchain listing
      if (currency === "ETH" || currency === "MATIC") {
        if (!user.walletAddress) {
          return res.status(400).json({
            success: false,
            message: "Wallet address required for blockchain listings",
          });
        }

        if (!pet.blockchain?.tokenId) {
          return res.status(400).json({
            success: false,
            message: "Only blockchain pets can be listed for crypto",
          });
        }

        // List on blockchain marketplace
        const result = await blockchainService.listItem(
          blockchainService.contracts.petNFT?.polygon?.address,
          blockchainService.ITEM_TYPES.PET,
          pet.blockchain.tokenId,
          1, // amount
          price,
          "polygon"
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: `Blockchain listing failed: ${result.error}`,
          });
        }

        // Create local trade record
        const trade = new Trade({
          seller: user._id,
          pet: petId,
          price,
          currency,
          status: "listed",
          listedAt: new Date(),
          blockchain: {
            listingId: result.listingId,
            contractAddress:
              blockchainService.contracts.marketplace?.polygon?.address,
            network: "polygon",
            transactionHash: result.transactionHash,
          },
        });

        await trade.save();

        logger.info(
          `User ${user.username} listed blockchain pet ${pet.name} for ${price} ${currency}`
        );

        return res.status(201).json({
          success: true,
          message: "Pet listed on blockchain marketplace!",
          data: {
            trade: trade.toJSON(),
            blockchain: result,
            user: {
              coins: user.coins,
              level: user.level,
              totalBattles: user.totalBattles,
              winRate: user.winRate,
            },
          },
        });
      }

      // Original coin-based listing logic
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

      const listingFee = price * result.trade.marketplaceFee;
      const transaction = new Transaction({
        user: user._id,
        type: "pet_sale",
        amount: -listingFee,
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
          blockchain: result.blockchain,
          fees: {
            marketplace: result.trade.marketplaceFee * 100 + "%",
            listingFee: listingFee,
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

  // Purchase a specific pet listing with blockchain integration
  async purchasePet(req, res) {
    try {
      const { tradeId } = req.params;
      const user = await User.findById(req.user._id);

      const trade = await Trade.findById(tradeId)
        .populate("seller")
        .populate("pet");

      if (!trade || !trade.pet) {
        return res.status(404).json({
          success: false,
          message: "Trade or pet not found",
        });
      }

      // Handle blockchain purchase
      if (trade.currency === "ETH" || trade.currency === "MATIC") {
        if (!user.walletAddress) {
          return res.status(400).json({
            success: false,
            message: "Wallet address required for blockchain purchases",
          });
        }

        if (!trade.blockchain?.listingId) {
          return res.status(400).json({
            success: false,
            message: "This listing is not on the blockchain",
          });
        }

        // Purchase from blockchain marketplace
        const result = await blockchainService.buyItem(
          trade.blockchain.listingId,
          trade.price,
          trade.blockchain.network || "polygon"
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: `Blockchain purchase failed: ${result.error}`,
          });
        }

        // Update local records
        trade.buyer = user._id;
        trade.status = "sold";
        trade.soldAt = new Date();
        trade.blockchain.purchaseTransactionHash = result.transactionHash;
        await trade.save();

        // Transfer pet ownership
        const pet = trade.pet;
        pet.ownerId = user._id;
        if (pet.blockchain) {
          // Verify blockchain ownership
          const isOwner = await blockchainService.verifyPetOwnership(
            user.walletAddress,
            pet.blockchain.tokenId,
            pet.blockchain.network
          );

          if (!isOwner) {
            logger.warn(
              `Blockchain ownership verification failed for pet ${pet._id}`
            );
          }
        }
        await pet.save();

        const seller = await User.findById(trade.seller._id);

        // Add experience for both users
        const buyerExpResult = user.addExperience(25);
        const sellerExpResult = seller.addExperience(15);
        await user.save();
        await seller.save();

        logger.info(
          `User ${user.username} purchased blockchain pet ${pet.name} from ${seller.username}`
        );

        const responseData = {
          success: true,
          message: "Blockchain pet purchased successfully!",
          data: {
            trade: trade.toJSON(),
            blockchain: result,
            pet: {
              ...pet.toObject(),
              power: this.calculatePetPower(pet),
              totalBattles: pet.battlesWon + pet.battlesLost,
              winRate:
                pet.battlesWon + pet.battlesLost > 0
                  ? (
                      (pet.battlesWon / (pet.battlesWon + pet.battlesLost)) *
                      100
                    ).toFixed(1)
                  : 0,
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

        return res.json(responseData);
      }

      // Original coin-based purchase logic
      const result = await tradeService.purchaseItem(user._id, tradeId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      const seller = await User.findById(trade.seller._id);

      // Create transaction records
      const purchaseTransaction = new Transaction({
        user: user._id,
        type: "pet_purchase",
        amount: -trade.price,
        currency: trade.currency,
        itemId: trade.pet._id,
        itemType: "pet",
        description: `Purchased ${trade.pet.name} from ${seller.username}`,
        status: "completed",
      });

      const saleTransaction = new Transaction({
        user: seller._id,
        type: "pet_sale",
        amount: trade.netAmount || trade.price * (1 - trade.marketplaceFee),
        currency: trade.currency,
        itemId: trade.pet._id,
        itemType: "pet",
        description: `Sold ${trade.pet.name} to ${user.username}`,
        status: "completed",
      });

      await purchaseTransaction.save();
      await saleTransaction.save();

      // Update seller's coins if currency is coins
      if (trade.currency === "coins") {
        seller.coins +=
          trade.netAmount || trade.price * (1 - trade.marketplaceFee);
        await seller.save();
      }

      // Add experience for both users
      const buyerExpResult = user.addExperience(25);
      const sellerExpResult = seller.addExperience(15);

      await user.save();
      await seller.save();

      // Send notifications
      if (seller.email && seller.preferences?.notifications) {
        try {
          await mailService.sendTradeNotification(seller, trade, "sold");
        } catch (emailError) {
          logger.warn("Failed to send sale notification email:", emailError);
        }
      }

      if (user.email && user.preferences?.notifications) {
        try {
          await mailService.sendTradeNotification(user, trade, "purchased");
        } catch (emailError) {
          logger.warn(
            "Failed to send purchase notification email:",
            emailError
          );
        }
      }

      logger.info(
        `User ${user.username} purchased pet ${trade.pet.name} from ${seller.username}`
      );

      const responseData = {
        success: true,
        message: "Pet purchased successfully!",
        data: {
          trade: result.trade,
          blockchain: result.blockchain,
          pet: {
            ...trade.pet.toObject(),
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
          fees: {
            marketplace: trade.marketplaceFee * 100 + "%",
            ...(trade.royaltyFee && { royalty: trade.royaltyFee * 100 + "%" }),
            total: (trade.marketplaceFee + (trade.royaltyFee || 0)) * 100 + "%",
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

  // Get user's offers
  async getUserOffers(req, res) {
    try {
      const { page = 1, limit = 20, status = "pending" } = req.query;
      const user = await User.findById(req.user._id);

      const query = {
        $or: [{ fromUser: user._id }, { toUser: user._id }],
      };

      if (status !== "all") {
        query.status = status;
      }

      const offers = await Offer.find(query)
        .populate("fromUser", "username level")
        .populate("toUser", "username level")
        .populate("pet")
        .populate("itemId")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await Offer.countDocuments(query);

      // Calculate offer statistics
      const sentStats = await Offer.countDocuments({
        fromUser: user._id,
        status: "pending",
      });
      const receivedStats = await Offer.countDocuments({
        toUser: user._id,
        status: "pending",
      });

      res.json({
        success: true,
        data: {
          offers,
          stats: {
            sent: sentStats,
            received: receivedStats,
            total: total,
          },
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
      const user = await User.findById(req.user._id);

      // Find the offer
      const offer = await Offer.findById(offerId)
        .populate("fromUser")
        .populate("toUser")
        .populate("pet")
        .populate("itemId");

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Offer not found",
        });
      }

      // Check if user is the recipient of the offer
      if (offer.toUser._id.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only accept offers sent to you",
        });
      }

      // Check if offer is still pending
      if (offer.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Offer is no longer pending",
        });
      }

      // Check if offer has expired
      if (offer.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Offer has expired",
        });
      }

      let item, itemType, itemName;

      if (offer.pet) {
        item = offer.pet;
        itemType = "pet";
        itemName = item.name;

        // Check if user still owns the pet
        if (item.ownerId.toString() !== user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: "You no longer own this pet",
          });
        }
      } else if (offer.itemId) {
        item = offer.itemId;
        itemType = offer.itemType;
        itemName = item.name || `${itemType} item`;

        // Check if user still owns the item
        if (item.ownerId.toString() !== user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: `You no longer own this ${itemType}`,
          });
        }
      }

      // Process the offer acceptance
      const result = await tradeService.acceptOffer(offerId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      // Update item ownership
      if (itemType === "pet") {
        await Pet.findByIdAndUpdate(item._id, { ownerId: offer.fromUser._id });
      } else {
        const Model =
          itemType === "egg"
            ? Egg
            : itemType === "technique"
            ? mongoose.models.Technique
            : mongoose.models.Skin;
        await Model.findByIdAndUpdate(item._id, {
          ownerId: offer.fromUser._id,
        });
      }

      // Handle currency transfer
      if (offer.currency === "coins") {
        // Add coins to seller (current user)
        user.coins += offer.offerPrice;
        await user.save();

        // Update buyer's pending transaction to completed
        await Transaction.findOneAndUpdate(
          {
            user: offer.fromUser._id,
            itemId: item._id,
            itemType,
            status: "pending",
          },
          {
            status: "completed",
            description: `Purchased ${itemName} from ${user.username} via offer`,
          }
        );
      }

      // Create transaction records
      const saleTransaction = new Transaction({
        user: user._id,
        type: `${itemType}_sale`,
        amount: offer.offerPrice,
        currency: offer.currency,
        itemId: item._id,
        itemType,
        description: `Sold ${itemName} to ${offer.fromUser.username} via offer`,
        status: "completed",
      });

      await saleTransaction.save();

      // Add experience
      const sellerExpResult = user.addExperience(20);
      const buyerExpResult = offer.fromUser.addExperience(15);

      await user.save();
      await offer.fromUser.save();

      logger.info(
        `User ${user.username} accepted offer for ${itemType} ${itemName} from ${offer.fromUser.username}`
      );

      const responseData = {
        success: true,
        message: "Offer accepted successfully!",
        data: {
          offer: result.offer,
          item: {
            id: item._id,
            name: itemName,
            type: itemType,
          },
          seller: {
            id: user._id,
            username: user.username,
            level: user.level,
          },
          buyer: {
            id: offer.fromUser._id,
            username: offer.fromUser.username,
            level: offer.fromUser.level,
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
      const user = await User.findById(req.user._id);

      // Find the offer
      const offer = await Offer.findById(offerId)
        .populate("fromUser")
        .populate("pet")
        .populate("itemId");

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Offer not found",
        });
      }

      // Check if user is the recipient of the offer
      if (offer.toUser.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only reject offers sent to you",
        });
      }

      // Check if offer is still pending
      if (offer.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Offer is no longer pending",
        });
      }

      // Reject the offer
      offer.status = "rejected";
      offer.respondedAt = new Date();
      await offer.save();

      // Refund coins if currency was coins
      if (offer.currency === "coins") {
        await Transaction.findOneAndUpdate(
          {
            user: offer.fromUser._id,
            itemId: offer.pet || offer.itemId,
            itemType: offer.pet ? "pet" : offer.itemType,
            status: "pending",
          },
          {
            status: "cancelled",
            description: `Offer rejected for ${
              offer.pet?.name || offer.itemId
            }`,
          }
        );
      }

      // Add experience for trade activity
      const expResult = user.addExperience(5);
      await user.save();

      logger.info(
        `User ${user.username} rejected offer from ${offer.fromUser.username}`
      );

      const responseData = {
        success: true,
        message: "Offer rejected successfully",
        data: {
          offer: {
            id: offer._id,
            status: offer.status,
            respondedAt: offer.respondedAt,
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
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
      }

      res.json(responseData);
    } catch (error) {
      logger.error("Reject offer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during offer rejection",
      });
    }
  },

  // Counter an offer
  async counterOffer(req, res) {
    try {
      const { offerId } = req.params;
      const { counterPrice, message } = req.body;
      const user = await User.findById(req.user._id);

      if (!counterPrice || counterPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid counter offer price",
        });
      }

      // Find the original offer
      const originalOffer = await Offer.findById(offerId)
        .populate("fromUser")
        .populate("toUser")
        .populate("pet")
        .populate("itemId");

      if (!originalOffer) {
        return res.status(404).json({
          success: false,
          message: "Original offer not found",
        });
      }

      // Check if user is the recipient of the offer
      if (originalOffer.toUser._id.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only counter offers sent to you",
        });
      }

      // Check if offer is still pending
      if (originalOffer.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Offer is no longer pending",
        });
      }

      // Create counter offer
      const counterOffer = new Offer({
        fromUser: user._id,
        toUser: originalOffer.fromUser._id,
        pet: originalOffer.pet,
        itemId: originalOffer.itemId,
        itemType: originalOffer.itemType,
        offerPrice: counterPrice,
        currency: originalOffer.currency,
        message: message || "Counter offer",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
        isCounterOffer: true,
        originalOffer: offerId,
      });

      await counterOffer.save();

      // Update original offer to show it has a counter
      originalOffer.hasCounterOffer = true;
      await originalOffer.save();

      // Add experience for trade activity
      const expResult = user.addExperience(8);
      await user.save();

      logger.info(
        `User ${user.username} made counter offer of ${counterPrice} ${originalOffer.currency} to ${originalOffer.fromUser.username}`
      );

      const responseData = {
        success: true,
        message: "Counter offer sent successfully!",
        data: {
          counterOffer: {
            id: counterOffer._id,
            item: {
              id: originalOffer.pet?._id || originalOffer.itemId?._id,
              name: originalOffer.pet?.name || `${originalOffer.itemType} item`,
              type: originalOffer.pet ? "pet" : originalOffer.itemType,
            },
            seller: {
              id: user._id,
              username: user.username,
              level: user.level,
            },
            buyer: {
              id: originalOffer.fromUser._id,
              username: originalOffer.fromUser.username,
              level: originalOffer.fromUser.level,
            },
            offerPrice: counterPrice,
            currency: originalOffer.currency,
            message: counterOffer.message,
            status: counterOffer.status,
            expiresAt: counterOffer.expiresAt,
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
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
      }

      res.status(201).json(responseData);
    } catch (error) {
      logger.error("Counter offer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during counter offer",
      });
    }
  },

  // Cancel an offer
  async cancelOffer(req, res) {
    try {
      const { offerId } = req.params;
      const user = await User.findById(req.user._id);

      // Find the offer
      const offer = await Offer.findById(offerId);

      if (!offer) {
        return res.status(404).json({
          success: false,
          message: "Offer not found",
        });
      }

      // Check if user is the sender of the offer
      if (offer.fromUser.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only cancel your own offers",
        });
      }

      // Check if offer is still pending
      if (offer.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Offer is no longer pending",
        });
      }

      // Cancel the offer
      offer.status = "cancelled";
      offer.cancelledAt = new Date();
      await offer.save();

      // Refund coins if currency was coins
      if (offer.currency === "coins") {
        await Transaction.findOneAndUpdate(
          {
            user: user._id,
            itemId: offer.pet || offer.itemId,
            itemType: offer.pet ? "pet" : offer.itemType,
            status: "pending",
          },
          {
            status: "cancelled",
            description: `Offer cancelled for ${
              offer.pet?.name || offer.itemId
            }`,
          }
        );
      }

      // Add experience for trade activity
      const expResult = user.addExperience(3);
      await user.save();

      logger.info(`User ${user.username} cancelled offer ${offerId}`);

      const responseData = {
        success: true,
        message: "Offer cancelled successfully",
        data: {
          offer: {
            id: offer._id,
            status: offer.status,
            cancelledAt: offer.cancelledAt,
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
        responseData.data.user.leveledUp = true;
        responseData.data.user.newLevel = expResult.newLevel;
      }

      res.json(responseData);
    } catch (error) {
      logger.error("Cancel offer error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during offer cancellation",
      });
    }
  },

  // List an item for sale (pet, egg, technique, skin)
  async listItem(req, res) {
    try {
      const { itemId, itemType, price, currency = "ETH" } = req.body;
      const user = await User.findById(req.user._id);

      // Validate input
      if (!itemId || !itemType || !price || price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Missing or invalid required fields",
        });
      }

      // Validate item type
      const validItemTypes = ["pet", "egg", "technique", "skin"];
      if (!validItemTypes.includes(itemType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid item type. Must be pet, egg, technique, or skin",
        });
      }

      let item;
      let itemName;

      // Check item ownership based on type
      switch (itemType) {
        case "pet":
          item = await Pet.findOne({ _id: itemId, ownerId: user._id });
          itemName = item?.name;
          break;
        case "egg":
          item = await Egg.findOne({ _id: itemId, ownerId: user._id });
          itemName = "Egg";
          break;
        case "technique":
          const Technique = mongoose.models.Technique;
          item = await Technique.findOne({ _id: itemId, ownerId: user._id });
          itemName = item?.name;
          break;
        case "skin":
          const Skin = mongoose.models.Skin;
          item = await Skin.findOne({ _id: itemId, ownerId: user._id });
          itemName = item?.name;
          break;
      }

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${itemType} not found or not owned by you`,
        });
      }

      // Check if item is already listed
      const existingTrade = await Trade.findOne({
        $or: [
          { pet: itemId, status: "listed" },
          { itemId: itemId, itemType, status: "listed" },
        ],
      });

      if (existingTrade) {
        return res.status(400).json({
          success: false,
          message: `${itemType} is already listed for sale`,
        });
      }

      // Check for pending offers
      const pendingOffers = await Offer.find({
        pet: itemType === "pet" ? itemId : null,
        itemId: itemType !== "pet" ? itemId : null,
        itemType: itemType !== "pet" ? itemType : null,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (pendingOffers.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot list ${itemType} while there are pending offers`,
        });
      }

      // Handle blockchain listing for supported item types
      if ((currency === "ETH" || currency === "MATIC") && itemType === "pet") {
        if (!user.walletAddress) {
          return res.status(400).json({
            success: false,
            message: "Wallet address required for blockchain listings",
          });
        }

        if (!item.blockchain?.tokenId) {
          return res.status(400).json({
            success: false,
            message: "Only blockchain pets can be listed for crypto",
          });
        }

        // List on blockchain marketplace
        const result = await blockchainService.listItem(
          blockchainService.contracts.petNFT?.polygon?.address,
          blockchainService.ITEM_TYPES.PET,
          item.blockchain.tokenId,
          1, // amount
          price,
          "polygon"
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: `Blockchain listing failed: ${result.error}`,
          });
        }

        // Create local trade record
        const trade = new Trade({
          seller: user._id,
          pet: itemId,
          price,
          currency,
          status: "listed",
          listedAt: new Date(),
          blockchain: {
            listingId: result.listingId,
            contractAddress:
              blockchainService.contracts.marketplace?.polygon?.address,
            network: "polygon",
            transactionHash: result.transactionHash,
          },
        });

        await trade.save();

        logger.info(
          `User ${user.username} listed blockchain ${itemType} ${itemName} for ${price} ${currency}`
        );

        return res.status(201).json({
          success: true,
          message: `${itemType} listed on blockchain marketplace!`,
          data: {
            trade: trade.toJSON(),
            blockchain: result,
            user: {
              coins: user.coins,
              level: user.level,
              totalBattles: user.totalBattles,
              winRate: user.winRate,
            },
          },
        });
      }

      // Use trade service to list item for non-blockchain or coin-based listings
      let result;
      switch (itemType) {
        case "pet":
          result = await tradeService.listPet(
            user._id,
            itemId,
            price,
            currency
          );
          break;
        case "egg":
          result = await tradeService.listEgg(
            user._id,
            itemId,
            price,
            currency
          );
          break;
        case "technique":
          result = await tradeService.listTechnique(
            user._id,
            itemId,
            price,
            currency
          );
          break;
        case "skin":
          result = await tradeService.listSkin(
            user._id,
            itemId,
            price,
            currency
          );
          break;
      }

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
        type: `${itemType}_sale`,
        amount: -listingFee,
        currency,
        itemId: itemId,
        itemType,
        description: `Listing fee for ${itemName}`,
        status: "completed",
      });
      await transaction.save();

      logger.info(
        `User ${user.username} listed ${itemType} ${itemName} for ${price} ${currency}`
      );

      res.status(201).json({
        success: true,
        message: `${itemType} listed for sale successfully!`,
        data: {
          trade: result.trade,
          blockchain: result.blockchain,
          fees: {
            marketplace: result.trade.marketplaceFee * 100 + "%",
            listingFee: listingFee,
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
      logger.error("List item error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during item listing",
      });
    }
  },

  // Cancel a listing
  async cancelListing(req, res) {
    try {
      const { tradeId } = req.params;
      const user = await User.findById(req.user._id);

      const trade = await Trade.findById(tradeId);
      if (!trade) {
        return res.status(404).json({
          success: false,
          message: "Listing not found",
        });
      }

      // Check if user owns the listing
      if (trade.seller.toString() !== user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: "You can only cancel your own listings",
        });
      }

      // Handle blockchain listing cancellation
      if (trade.blockchain?.listingId) {
        const result = await blockchainService.cancelListing(
          trade.blockchain.listingId,
          trade.blockchain.network || "polygon"
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: `Blockchain cancellation failed: ${result.error}`,
          });
        }
      }

      // Cancel local listing
      trade.status = "cancelled";
      trade.cancelledAt = new Date();
      await trade.save();

      // Add experience for trade activity
      const expResult = user.addExperience(10);
      await user.save();

      logger.info(`User ${user.username} cancelled trade ${tradeId}`);

      const responseData = {
        success: true,
        message: "Listing cancelled successfully",
        data: {
          trade: trade.toJSON(),
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

  // Purchase a listed item
  async purchaseItem(req, res) {
    try {
      const { tradeId } = req.params;
      const user = await User.findById(req.user._id);

      const trade = await Trade.findById(tradeId)
        .populate("seller")
        .populate("pet")
        .populate("itemId");

      if (!trade) {
        return res.status(404).json({
          success: false,
          message: "Listing not found",
        });
      }

      // Handle blockchain purchase
      if (trade.currency === "ETH" || trade.currency === "MATIC") {
        if (!user.walletAddress) {
          return res.status(400).json({
            success: false,
            message: "Wallet address required for blockchain purchases",
          });
        }

        if (!trade.blockchain?.listingId) {
          return res.status(400).json({
            success: false,
            message: "This listing is not on the blockchain",
          });
        }

        // Purchase from blockchain marketplace
        const result = await blockchainService.buyItem(
          trade.blockchain.listingId,
          trade.price,
          trade.blockchain.network || "polygon"
        );

        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: `Blockchain purchase failed: ${result.error}`,
          });
        }

        // Update local records
        trade.buyer = user._id;
        trade.status = "sold";
        trade.soldAt = new Date();
        trade.blockchain.purchaseTransactionHash = result.transactionHash;
        await trade.save();

        // Transfer item ownership
        if (trade.pet) {
          const pet = trade.pet;
          pet.ownerId = user._id;
          if (pet.blockchain) {
            // Verify blockchain ownership
            const isOwner = await blockchainService.verifyPetOwnership(
              user.walletAddress,
              pet.blockchain.tokenId,
              pet.blockchain.network
            );

            if (!isOwner) {
              logger.warn(
                `Blockchain ownership verification failed for pet ${pet._id}`
              );
            }
          }
          await pet.save();
        } else if (trade.itemId) {
          // Handle other item types (eggs, techniques, skins)
          const Model =
            trade.itemType === "egg"
              ? Egg
              : trade.itemType === "technique"
              ? mongoose.models.Technique
              : mongoose.models.Skin;
          await Model.findByIdAndUpdate(trade.itemId, {
            ownerId: user._id,
          });
        }

        const seller = await User.findById(trade.seller._id);

        // Add experience for both users
        const buyerExpResult = user.addExperience(25);
        const sellerExpResult = seller.addExperience(15);
        await user.save();
        await seller.save();

        logger.info(
          `User ${user.username} purchased blockchain ${
            trade.itemType || "pet"
          } from ${seller.username}`
        );

        const responseData = {
          success: true,
          message: "Blockchain item purchased successfully!",
          data: {
            trade: trade.toJSON(),
            blockchain: result,
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

        return res.json(responseData);
      }

      // Original coin-based purchase logic
      const result = await tradeService.purchaseItem(user._id, tradeId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }

      // Get item details based on type
      let item, itemName, itemType;
      if (trade.itemType === "pet") {
        item = trade.pet;
        itemName = item.name;
        itemType = "pet";
      } else {
        item = trade.itemId;
        itemName = item.name || `${trade.itemType} item`;
        itemType = trade.itemType;
      }

      const seller = await User.findById(trade.seller._id);

      // Create transaction records
      const purchaseTransaction = new Transaction({
        user: user._id,
        type: `${itemType}_purchase`,
        amount: -trade.price,
        currency: trade.currency,
        itemId: item._id,
        itemType,
        description: `Purchased ${itemName} from ${seller.username}`,
        status: "completed",
      });

      const saleTransaction = new Transaction({
        user: seller._id,
        type: `${itemType}_sale`,
        amount: trade.netAmount || trade.price * (1 - trade.marketplaceFee),
        currency: trade.currency,
        itemId: item._id,
        itemType,
        description: `Sold ${itemName} to ${user.username}`,
        status: "completed",
      });

      await purchaseTransaction.save();
      await saleTransaction.save();

      // Update seller's coins if currency is coins
      if (trade.currency === "coins") {
        seller.coins +=
          trade.netAmount || trade.price * (1 - trade.marketplaceFee);
        await seller.save();
      }

      // Add experience for both users
      const buyerExpResult = user.addExperience(25);
      const sellerExpResult = seller.addExperience(15);

      await user.save();
      await seller.save();

      // Send notifications
      if (seller.email && seller.preferences?.notifications) {
        try {
          await mailService.sendTradeNotification(seller, trade, "sold");
        } catch (emailError) {
          logger.warn("Failed to send sale notification email:", emailError);
        }
      }

      if (user.email && user.preferences?.notifications) {
        try {
          await mailService.sendTradeNotification(user, trade, "purchased");
        } catch (emailError) {
          logger.warn(
            "Failed to send purchase notification email:",
            emailError
          );
        }
      }

      logger.info(
        `User ${user.username} purchased ${itemType} ${itemName} from ${seller.username}`
      );

      const responseData = {
        success: true,
        message: `${itemType} purchased successfully!`,
        data: {
          trade: result.trade,
          blockchain: result.blockchain,
          item: {
            ...item.toObject(),
            type: itemType,
            ...(itemType === "pet"
              ? {
                  power: this.calculatePetPower(item),
                  totalBattles: item.battlesWon + item.battlesLost,
                  winRate:
                    item.battlesWon + item.battlesLost > 0
                      ? (
                          (item.battlesWon /
                            (item.battlesWon + item.battlesLost)) *
                          100
                        ).toFixed(1)
                      : 0,
                }
              : {}),
          },
          fees: {
            marketplace: trade.marketplaceFee * 100 + "%",
            ...(trade.royaltyFee && { royalty: trade.royaltyFee * 100 + "%" }),
            total: (trade.marketplaceFee + (trade.royaltyFee || 0)) * 100 + "%",
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
      logger.error("Purchase item error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during item purchase",
      });
    }
  },

  // Get marketplace listings with blockchain integration
  async getListings(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        itemType,
        minPrice,
        maxPrice,
        currency = "ETH",
        sortBy = "newest",
        includeBlockchain = "true",
      } = req.query;

      const filters = { currency, status: "listed" };

      // Apply filters
      if (itemType) filters.itemType = itemType;
      if (minPrice)
        filters.price = { ...filters.price, $gte: parseFloat(minPrice) };
      if (maxPrice)
        filters.price = { ...filters.price, $lte: parseFloat(maxPrice) };

      // Get local listings with pagination
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

      // Get blockchain listings if requested
      let blockchainListings = [];
      if (includeBlockchain === "true") {
        try {
          const blockchainResult = await blockchainService.getActiveListings();
          blockchainListings = blockchainResult.map((listing) => ({
            ...listing,
            isBlockchain: true,
            timeListed: this.formatTimeListed(new Date()), // Approximate
          }));
        } catch (error) {
          logger.warn("Failed to fetch blockchain listings:", error);
        }
      }

      // Enhance local listings with additional data
      const enhancedTrades = await Promise.all(
        result.trades.map(async (trade) => {
          let item, itemDetails;

          if (trade.itemType === "pet") {
            item = await Pet.findById(trade.pet).lean();
            itemDetails = item
              ? {
                  ...item,
                  power: this.calculatePetPower(item),
                  totalBattles: item.battlesWon + item.battlesLost,
                  winRate:
                    item.battlesWon + item.battlesLost > 0
                      ? (
                          (item.battlesWon /
                            (item.battlesWon + item.battlesLost)) *
                          100
                        ).toFixed(1)
                      : 0,
                }
              : null;
          } else {
            const model =
              trade.itemType === "egg"
                ? Egg
                : trade.itemType === "technique"
                ? mongoose.models.Technique
                : mongoose.models.Skin;
            item = await model.findById(trade.itemId).lean();
            itemDetails = item;
          }

          return {
            ...trade,
            item: itemDetails,
            timeListed: this.formatTimeListed(trade.listedAt),
            isOwnListing:
              trade.seller._id.toString() === req.user?._id?.toString(),
            sellerStats: {
              level: trade.seller.level,
              totalBattles: trade.seller.totalBattles,
              winRate: trade.seller.winRate,
            },
          };
        })
      );

      res.json({
        success: true,
        data: {
          listings: enhancedTrades,
          blockchainListings,
          pagination: result.pagination,
          filters: {
            itemType,
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
      const user = await User.findById(req.user._id);

      const query = { seller: user._id };
      if (status !== "all") {
        query.status = status;
      }

      const trades = await Trade.find(query)
        .populate("pet")
        .populate("itemId")
        .populate("buyer", "username level")
        .sort({ listedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const total = await Trade.countDocuments(query);

      // Calculate statistics
      const stats = await this.getUserTradeStats(user._id);

      // Get user's NFTs from blockchain
      const nftsResult = await tradeService.getUserNFTs(user._id);
      const userNFTs = nftsResult.success ? nftsResult.nfts : [];

      res.json({
        success: true,
        data: {
          listings: trades,
          userNFTs,
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
      const user = await User.findById(req.user._id);

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

      // Get transaction history
      const transactions = await Transaction.getUserHistory(user._id, limit);

      res.json({
        success: true,
        data: {
          trades: result.trades,
          transactions,
          pagination: result.pagination,
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

  // Get marketplace statistics with blockchain data
  async getMarketplaceStats(req, res) {
    try {
      const user = req.user ? await User.findById(req.user._id) : null;

      // Get marketplace stats from service
      const statsResult = await marketplaceService.getMarketplaceStats();

      if (!statsResult.success) {
        return res.status(400).json({
          success: false,
          message: statsResult.error,
        });
      }

      const stats = statsResult.stats;

      // Get additional stats from database
      const recentStats = await Trade.aggregate([
        {
          $match: {
            status: "sold",
            soldAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: "$price" },
            averagePrice: { $avg: "$price" },
            totalSales: { $sum: 1 },
          },
        },
      ]);

      const recentListings = await Trade.countDocuments({
        status: "listed",
        listedAt: { $gte: new Date(Date.now() - 1 * 60 * 60 * 1000) },
      });

      const recentStatsData = recentStats[0] || {
        totalVolume: 0,
        averagePrice: 0,
        totalSales: 0,
      };

      // Get user's personal trade stats if logged in
      let userTradeStats = null;
      if (user) {
        userTradeStats = await this.getUserTradeStats(user._id);
      }

      res.json({
        success: true,
        data: {
          marketplace: stats,
          volume24h: {
            total: recentStatsData.totalVolume,
            average: recentStatsData.averagePrice,
            sales: recentStatsData.totalSales,
          },
          activity: {
            newListings: recentListings,
            activeTraders: stats.activeUsers,
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

  // Sync blockchain marketplace listings
  async syncBlockchainListings(req, res) {
    try {
      const result = await blockchainService.getActiveListings();
      let syncedCount = 0;

      for (const blockchainListing of result) {
        // Check if we already have this listing in database
        const existingTrade = await Trade.findOne({
          "blockchain.listingId": blockchainListing.listingId,
        });

        if (!existingTrade) {
          // Find the corresponding pet in our database
          const pet = await Pet.findOne({
            "blockchain.tokenId": blockchainListing.tokenId,
          });

          if (pet) {
            const trade = new Trade({
              seller: pet.ownerId,
              pet: pet._id,
              price: parseFloat(blockchainListing.price),
              currency: "ETH", // Default for blockchain listings
              status: "listed",
              listedAt: new Date(),
              blockchain: {
                listingId: blockchainListing.listingId,
                contractAddress: blockchainListing.nftContract,
                network: "polygon",
              },
            });

            await trade.save();
            syncedCount++;
          }
        }
      }

      res.json({
        success: true,
        message: `Synced ${syncedCount} blockchain marketplace listings`,
        data: {
          synced: syncedCount,
          totalBlockchain: result.length,
        },
      });
    } catch (error) {
      logger.error("Sync blockchain listings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to sync blockchain listings",
      });
    }
  },

  // Get user's NFTs from blockchain
  async getUserNFTs(req, res) {
    try {
      const user = await User.findById(req.user._id);

      if (!user || !user.walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Wallet address not found",
        });
      }

      const pets = await blockchainService.getOwnedPets(user.walletAddress);
      const eggs = await blockchainService.getOwnedEggs(user.walletAddress);
      const skins = await blockchainService.getOwnedSkins(user.walletAddress);
      const techniques = await blockchainService.getOwnedTechniques(
        user.walletAddress
      );

      res.json({
        success: true,
        data: {
          nfts: {
            pets,
            eggs,
            skins,
            techniques,
          },
          user: {
            walletAddress: user.walletAddress,
            coins: user.coins,
            level: user.level,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
          },
        },
      });
    } catch (error) {
      logger.error("Get user NFTs error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Verify NFT ownership
  async verifyOwnership(req, res) {
    try {
      const { tokenId, nftContract } = req.params;
      const user = await User.findById(req.user._id);

      if (!user || !user.walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Wallet address not found",
        });
      }

      const isOwner = await blockchainService.verifyPetOwnership(
        user.walletAddress,
        tokenId,
        "polygon"
      );

      res.json({
        success: true,
        data: {
          isOwner,
          tokenId,
          nftContract,
          user: {
            walletAddress: user.walletAddress,
          },
        },
      });
    } catch (error) {
      logger.error("Verify ownership error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Make an offer on an item (not listed for sale)
  async makeOffer(req, res) {
    try {
      const {
        itemId,
        itemType,
        offerPrice,
        currency = "coins",
        message,
        expiresInHours = 48,
      } = req.body;
      const user = await User.findById(req.user._id);

      // Validate item type
      const validItemTypes = ["pet", "egg", "technique", "skin"];
      if (!validItemTypes.includes(itemType)) {
        return res.status(400).json({
          success: false,
          message: "Invalid item type",
        });
      }

      // Check if item exists and is not owned by the user
      let item, owner;
      switch (itemType) {
        case "pet":
          item = await Pet.findById(itemId).populate("ownerId");
          owner = item?.ownerId;
          break;
        case "egg":
          item = await Egg.findById(itemId).populate("ownerId");
          owner = item?.ownerId;
          break;
        case "technique":
          const Technique = mongoose.models.Technique;
          item = await Technique.findById(itemId).populate("ownerId");
          owner = item?.ownerId;
          break;
        case "skin":
          const Skin = mongoose.models.Skin;
          item = await Skin.findById(itemId).populate("ownerId");
          owner = item?.ownerId;
          break;
      }

      if (!item) {
        return res.status(404).json({
          success: false,
          message: `${itemType} not found`,
        });
      }

      if (owner._id.toString() === user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `Cannot make an offer on your own ${itemType}`,
        });
      }

      // Check if item is already listed
      const existingListing = await Trade.findOne({
        $or: [
          { pet: itemType === "pet" ? itemId : null, status: "listed" },
          {
            itemId: itemType !== "pet" ? itemId : null,
            itemType,
            status: "listed",
          },
        ],
      });

      if (existingListing) {
        return res.status(400).json({
          success: false,
          message: `${itemType} is already listed for sale`,
        });
      }

      // Check if user has enough coins for the offer (if using coins)
      if (currency === "coins" && user.coins < offerPrice) {
        return res.status(400).json({
          success: false,
          message: `Not enough coins for this offer. Need: ${offerPrice}, Have: ${user.coins}`,
        });
      }

      // Check if there's already a pending offer from this user for this item
      const existingOffer = await Offer.findOne({
        fromUser: user._id,
        $or: [
          { pet: itemType === "pet" ? itemId : null },
          { itemId: itemType !== "pet" ? itemId : null, itemType },
        ],
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (existingOffer) {
        return res.status(400).json({
          success: false,
          message: "You already have a pending offer for this item",
        });
      }

      // Create the offer
      const offer = new Offer({
        fromUser: user._id,
        toUser: owner._id,
        pet: itemType === "pet" ? itemId : null,
        itemId: itemType !== "pet" ? itemId : null,
        itemType: itemType !== "pet" ? itemType : null,
        offerPrice,
        currency,
        message,
        expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      });

      await offer.save();
      await offer.populate("fromUser", "username level");
      await offer.populate("toUser", "username level");
      if (itemType === "pet") {
        await offer.populate("pet");
      } else {
        await offer.populate("itemId");
      }

      // Create pending transaction for the offer (reserved funds)
      if (currency === "coins") {
        const transaction = new Transaction({
          user: user._id,
          type: `${itemType}_purchase`,
          amount: -offerPrice,
          currency,
          itemId: itemId,
          itemType,
          description: `Offer for ${item.name || itemType} - Pending`,
          status: "pending",
        });
        await transaction.save();
      }

      // Add experience for making an offer
      const expResult = user.addExperience(5);
      await user.save();

      logger.info(
        `User ${
          user.username
        } made offer of ${offerPrice} ${currency} for ${itemType} ${
          item.name || itemId
        }`
      );

      const responseData = {
        success: true,
        message: "Offer sent successfully!",
        data: {
          offer: {
            id: offer._id,
            item: {
              id: item._id,
              name: item.name || `${itemType} item`,
              type: itemType,
              ...(itemType === "pet"
                ? {
                    tier: item.tier,
                    level: item.level,
                  }
                : {}),
            },
            seller: {
              id: owner._id,
              username: owner.username,
              level: owner.level,
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

  // Get user's transaction history
  async getTransactionHistory(req, res) {
    try {
      const { page = 1, limit = 20, type, currency } = req.query;
      const user = await User.findById(req.user._id);

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
      const spendingStats = await Transaction.aggregate([
        {
          $match: {
            user: user._id,
            currency: "coins",
            status: "completed",
            amount: { $lt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: { $abs: "$amount" } },
            transactionCount: { $sum: 1 },
          },
        },
      ]);

      const ethSpendingStats = await Transaction.aggregate([
        {
          $match: {
            user: user._id,
            currency: "ETH",
            status: "completed",
            amount: { $lt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: { $abs: "$amount" } },
            transactionCount: { $sum: 1 },
          },
        },
      ]);

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
    const { dmg, hp, range, spa } = pet.stats || {};
    const tierMultiplier = {
      common: 1,
      uncommon: 1.2,
      rare: 1.5,
      epic: 2,
      legendary: 3,
    };

    const basePower =
      (dmg || 0) + (hp || 0) / 10 + (range || 0) * 10 + (1 / (spa || 1)) * 20;
    return Math.round(
      basePower *
        (tierMultiplier[pet.rarity] || 1) *
        (1 + ((pet.level || 1) - 1) * 0.1)
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
            rarity: "$petData.rarity",
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
      rarity: item._id.rarity,
      type: item._id.type,
      sales: item.count,
      averagePrice: item.averagePrice,
      totalVolume: item.totalVolume,
    }));
  },
};

export default TradeController;
