import logger from "../utils/logger.js";
import Trade from "../models/Trade.js";
import Pet from "../models/Pet.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { blockchainService } from "../config/blockchain.js";

class TradeService {
  // List a pet for sale
  async listPet(sellerId, petId, price, currency = "ETH") {
    try {
      // Verify pet ownership
      const pet = await Pet.findOne({ _id: petId, owner: sellerId });
      if (!pet) {
        throw new Error("Pet not found or not owned by seller");
      }

      // Check if pet is already listed
      const existingTrade = await Trade.findOne({
        pet: petId,
        status: "listed",
      });

      if (existingTrade) {
        throw new Error("Pet is already listed for sale");
      }

      // Create trade record
      const trade = new Trade({
        seller: sellerId,
        pet: petId,
        price,
        currency,
      });

      await trade.save();
      await trade.populate("seller", "username walletAddress");
      await trade.populate("pet");

      logger.info(
        `Pet ${petId} listed for sale by user ${sellerId} for ${price} ${currency}`
      );

      return {
        success: true,
        trade: trade.toObject(),
      };
    } catch (error) {
      logger.error("Error listing pet:", error);
      return { success: false, error: error.message };
    }
  }

  // Cancel a listing
  async cancelListing(sellerId, tradeId) {
    try {
      const trade = await Trade.findOne({
        _id: tradeId,
        seller: sellerId,
        status: "listed",
      });

      if (!trade) {
        throw new Error("Trade not found or not cancellable");
      }

      trade.status = "cancelled";
      trade.cancelledAt = new Date();
      await trade.save();

      logger.info(`Trade ${tradeId} cancelled by user ${sellerId}`);

      return { success: true };
    } catch (error) {
      logger.error("Error cancelling trade:", error);
      return { success: false, error: error.message };
    }
  }

  // Purchase a listed pet
  async purchasePet(buyerId, tradeId) {
    try {
      const trade = await Trade.findOne({
        _id: tradeId,
        status: "listed",
      })
        .populate("seller")
        .populate("pet");

      if (!trade) {
        throw new Error("Trade not found or not available");
      }

      // Check if buyer is the seller
      if (trade.seller._id.toString() === buyerId) {
        throw new Error("Cannot purchase your own pet");
      }

      const buyer = await User.findById(buyerId);
      if (!buyer) {
        throw new Error("Buyer not found");
      }

      // Check buyer's balance (simplified - in reality, check blockchain)
      if (buyer.coins < trade.price && trade.currency === "coins") {
        throw new Error("Insufficient balance");
      }

      // Update pet ownership
      const pet = trade.pet;
      pet.owner = buyerId;
      await pet.save();

      // Update trade status
      trade.buyer = buyerId;
      trade.status = "sold";
      trade.soldAt = new Date();
      await trade.save();

      // Handle payment (simplified)
      if (trade.currency === "coins") {
        // Deduct from buyer, add to seller (minus fees)
        buyer.coins -= trade.price;
        await buyer.save();

        const seller = await User.findById(trade.seller);
        const netAmount =
          trade.price * (1 - (trade.marketplaceFee + trade.royaltyFee));
        seller.coins += netAmount;
        await seller.save();

        // Record transactions
        await Transaction.create([
          {
            user: buyerId,
            type: "pet_purchase",
            amount: -trade.price,
            currency: "coins",
            status: "completed",
            itemId: pet._id,
            itemType: "pet",
            description: `Purchased ${pet.name}`,
          },
          {
            user: trade.seller._id,
            type: "pet_sale",
            amount: netAmount,
            currency: "coins",
            status: "completed",
            itemId: pet._id,
            itemType: "pet",
            description: `Sold ${pet.name}`,
          },
        ]);
      }

      logger.info(
        `Pet ${pet._id} purchased by user ${buyerId} from user ${trade.seller._id}`
      );

      return {
        success: true,
        trade: trade.toObject(),
        pet: pet.toObject(),
      };
    } catch (error) {
      logger.error("Error purchasing pet:", error);
      return { success: false, error: error.message };
    }
  }

  // Get active listings with filters
  async getListings(filters = {}, page = 1, limit = 20) {
    try {
      const query = { status: "listed", ...filters };

      const trades = await Trade.find(query)
        .populate("seller", "username walletAddress")
        .populate("pet")
        .sort({ listedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Trade.countDocuments(query);

      return {
        success: true,
        trades,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting listings:", error);
      return { success: false, error: error.message };
    }
  }

  // Sync with blockchain (for real NFT trades)
  async syncBlockchainListings(network = "polygon") {
    try {
      // This would integrate with your blockchain service
      // to sync off-chain listings with on-chain state
      const contract = blockchainService.contracts.marketplace?.[network];
      if (!contract) {
        throw new Error(`Marketplace contract not configured for ${network}`);
      }

      // Implementation would depend on your blockchain events
      logger.info(`Syncing blockchain listings for ${network}`);

      return { success: true, synced: 0 }; // Placeholder
    } catch (error) {
      logger.error("Error syncing blockchain listings:", error);
      return { success: false, error: error.message };
    }
  }

  // Get user's trade history
  async getUserTradeHistory(userId, page = 1, limit = 20) {
    try {
      const query = {
        $or: [{ seller: userId }, { buyer: userId }],
        status: { $in: ["sold", "cancelled"] },
      };

      const trades = await Trade.find(query)
        .populate("seller", "username")
        .populate("buyer", "username")
        .populate("pet")
        .sort({ soldAt: -1, cancelledAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await Trade.countDocuments(query);

      return {
        success: true,
        trades,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Error getting trade history:", error);
      return { success: false, error: error.message };
    }
  }
}

export const tradeService = new TradeService();
export default tradeService;
