import logger from "../utils/logger.js";
import Trade from "../models/Trade.js";
import Pet from "../models/Pet.js";
import User from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { BlockchainSimulationService } from "./BlockchainSimulationService.js";

class TradeService {
  constructor() {
    this.blockchainService = new BlockchainSimulationService();
    this.marketplaceFee = 0.025; // 2.5% marketplace fee
    this.royaltyFee = 0.01; // 1% royalty fee
  }

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

      // Get seller's wallet address
      const seller = await User.findById(sellerId);
      if (!seller?.walletAddress) {
        throw new Error("Seller wallet address not found");
      }

      // Mint NFT if not already minted
      let tokenId = pet.nftTokenId;
      if (!tokenId) {
        const mintResult = await this.blockchainService.mintNFT(
          seller.walletAddress,
          "pet",
          {
            petId: pet._id.toString(),
            name: pet.name,
            type: pet.type,
            rarity: pet.rarity,
            level: pet.level,
            isShiny: pet.isShiny,
          }
        );

        if (!mintResult.success) {
          throw new Error(`NFT minting failed: ${mintResult.error}`);
        }

        tokenId = mintResult.tokenId;

        // Update pet with NFT token ID
        pet.nftTokenId = tokenId;
        await pet.save();
      }

      // List on blockchain marketplace
      const listResult = await this.blockchainService.listItem(
        seller.walletAddress,
        "pet",
        tokenId,
        price
      );

      if (!listResult.success) {
        throw new Error(`Listing failed: ${listResult.error}`);
      }

      // Create trade record
      const trade = new Trade({
        seller: sellerId,
        pet: petId,
        price,
        currency,
        nftTokenId: tokenId,
        blockchainListingId: listResult.listingId,
        blockchainTxHash: listResult.txHash,
        marketplaceFee: this.marketplaceFee,
        royaltyFee: this.royaltyFee,
      });

      await trade.save();
      await trade.populate("seller", "username walletAddress");
      await trade.populate("pet");

      logger.info(
        `Pet ${petId} listed for sale by user ${sellerId} for ${price} ${currency}. Listing ID: ${listResult.listingId}`
      );

      return {
        success: true,
        trade: trade.toObject(),
        blockchain: {
          listingId: listResult.listingId,
          txHash: listResult.txHash,
          tokenId: tokenId,
        },
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
      }).populate("seller", "walletAddress");

      if (!trade) {
        throw new Error("Trade not found or not cancellable");
      }

      // Cancel on blockchain (simulated)
      const cancelResult = await this.blockchainService.cancelListing(
        trade.seller.walletAddress,
        trade.blockchainListingId
      );

      if (!cancelResult?.success) {
        logger.warn(
          `Blockchain cancellation failed for trade ${tradeId}, proceeding with database cancellation`
        );
      }

      trade.status = "cancelled";
      trade.cancelledAt = new Date();
      trade.blockchainTxHash = cancelResult?.txHash || trade.blockchainTxHash;
      await trade.save();

      logger.info(`Trade ${tradeId} cancelled by user ${sellerId}`);

      return {
        success: true,
        blockchain: cancelResult,
      };
    } catch (error) {
      logger.error("Error cancelling trade:", error);
      return { success: false, error: error.message };
    }
  }

  // Purchase a listed pet
  async purchasePet(buyerId, tradeId) {
    const session = await Trade.startSession();
    session.startTransaction();

    try {
      const trade = await Trade.findOne({
        _id: tradeId,
        status: "listed",
      })
        .populate("seller")
        .populate("pet")
        .session(session);

      if (!trade) {
        throw new Error("Trade not found or not available");
      }

      // Check if buyer is the seller
      if (trade.seller._id.toString() === buyerId) {
        throw new Error("Cannot purchase your own pet");
      }

      const buyer = await User.findById(buyerId).session(session);
      if (!buyer || !buyer.walletAddress) {
        throw new Error("Buyer not found or no wallet address");
      }

      // Check buyer's balance based on currency
      if (trade.currency === "coins" && buyer.coins < trade.price) {
        throw new Error("Insufficient coin balance");
      }

      // Execute blockchain purchase
      const purchaseResult = await this.blockchainService.buyItem(
        buyer.walletAddress,
        trade.blockchainListingId,
        trade.price
      );

      if (!purchaseResult.success) {
        throw new Error(`Blockchain purchase failed: ${purchaseResult.error}`);
      }

      // Update pet ownership
      const pet = trade.pet;
      pet.owner = buyerId;
      pet.isListed = false;
      await pet.save({ session });

      // Update trade status
      trade.buyer = buyerId;
      trade.status = "sold";
      trade.soldAt = new Date();
      trade.blockchainTxHash = purchaseResult.txHash;
      await trade.save({ session });

      // Handle payment based on currency
      if (trade.currency === "coins") {
        // Deduct from buyer
        buyer.coins -= trade.price;
        await buyer.save({ session });

        // Calculate net amount for seller (minus fees)
        const totalFees = trade.marketplaceFee + trade.royaltyFee;
        const netAmount = trade.price * (1 - totalFees);

        // Add to seller
        const seller = await User.findById(trade.seller._id).session(session);
        seller.coins += netAmount;
        await seller.save({ session });

        // Record transactions
        await Transaction.create(
          [
            {
              user: buyerId,
              type: "pet_purchase",
              amount: -trade.price,
              currency: "coins",
              status: "completed",
              itemId: pet._id,
              itemType: "pet",
              description: `Purchased ${pet.name}`,
              blockchainTxHash: purchaseResult.txHash,
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
              blockchainTxHash: purchaseResult.txHash,
            },
            {
              user: "system", // Marketplace fee
              type: "marketplace_fee",
              amount: trade.price * trade.marketplaceFee,
              currency: "coins",
              status: "completed",
              itemId: trade._id,
              itemType: "fee",
              description: `Marketplace fee for ${pet.name} sale`,
            },
          ],
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      logger.info(
        `Pet ${pet._id} purchased by user ${buyerId} from user ${trade.seller._id}. TX: ${purchaseResult.txHash}`
      );

      return {
        success: true,
        trade: trade.toObject(),
        pet: pet.toObject(),
        blockchain: {
          txHash: purchaseResult.txHash,
          transaction: purchaseResult.transaction,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

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

      // Enhance with blockchain data
      const enhancedTrades = await Promise.all(
        trades.map(async (trade) => {
          try {
            const nftMetadata = await this.blockchainService.getNFTmetadata(
              trade.nftTokenId
            );
            return {
              ...trade,
              blockchain: {
                tokenId: trade.nftTokenId,
                listingId: trade.blockchainListingId,
                nftMetadata,
              },
            };
          } catch (error) {
            logger.warn(
              `Failed to fetch blockchain data for trade ${trade._id}:`,
              error
            );
            return trade;
          }
        })
      );

      const total = await Trade.countDocuments(query);

      return {
        success: true,
        trades: enhancedTrades,
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
  async syncBlockchainListings() {
    try {
      // Get active blockchain listings
      const blockchainListings =
        await this.blockchainService.getActiveListings();

      // Update database to match blockchain state
      const dbListings = await Trade.find({ status: "listed" });

      let synced = 0;
      for (const dbListing of dbListings) {
        const blockchainListing = blockchainListings.find(
          (bl) => bl.listingId === dbListing.blockchainListingId
        );

        if (!blockchainListing) {
          // Listing no longer active on blockchain, mark as cancelled
          dbListing.status = "cancelled";
          dbListing.cancelledAt = new Date();
          await dbListing.save();
          synced++;
        }
      }

      logger.info(`Synced ${synced} listings with blockchain`);

      return { success: true, synced };
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

  // Get user's NFTs
  async getUserNFTs(userId) {
    try {
      const user = await User.findById(userId);
      if (!user?.walletAddress) {
        return { success: true, nfts: [] };
      }

      const nfts = await this.blockchainService.getUserNFTs(user.walletAddress);
      return { success: true, nfts };
    } catch (error) {
      logger.error("Error getting user NFTs:", error);
      return { success: false, error: error.message };
    }
  }
}

// Enhanced MarketplaceService using BlockchainSimulationService
export class MarketplaceService {
  constructor() {
    this.blockchainService = new BlockchainSimulationService();
    this.marketplaceFee = 0.025; // 2.5%
  }

  /** --- 🛒 Listing Management --- **/

  async listPet(userId, petId, price, currency = "ETH") {
    try {
      const pet = await Pet.findOne({ _id: petId, owner: userId });
      if (!pet) throw new Error("Pet not found or not owned by user");
      if (pet.isListed) throw new Error("Pet already listed");

      const user = await User.findById(userId);
      if (!user?.walletAddress) throw new Error("User wallet not found");

      // Mint NFT if not already minted
      let tokenId = pet.nftTokenId;
      if (!tokenId) {
        const mintResult = await this.blockchainService.mintNFT(
          user.walletAddress,
          "pet",
          {
            petId: pet._id.toString(),
            name: pet.name,
            type: pet.type,
            rarity: pet.rarity,
            level: pet.level,
            isShiny: pet.isShiny,
            stats: pet.stats,
          }
        );

        if (!mintResult.success) {
          throw new Error(`NFT minting failed: ${mintResult.error}`);
        }

        tokenId = mintResult.tokenId;
        pet.nftTokenId = tokenId;
      }

      // List on blockchain
      const listResult = await this.blockchainService.listItem(
        user.walletAddress,
        "pet",
        tokenId,
        price
      );

      if (!listResult.success) {
        throw new Error(`Listing failed: ${listResult.error}`);
      }

      // Create trade record
      const trade = new Trade({
        seller: userId,
        pet: petId,
        price,
        currency,
        nftTokenId: tokenId,
        blockchainListingId: listResult.listingId,
        blockchainTxHash: listResult.txHash,
        marketplaceFee: this.marketplaceFee,
      });

      await trade.save();

      // Mark pet as listed
      pet.isListed = true;
      await pet.save();

      return {
        success: true,
        listingId: trade._id,
        blockchain: {
          tokenId,
          listingId: listResult.listingId,
          txHash: listResult.txHash,
        },
      };
    } catch (error) {
      logger.error("Error listing pet in marketplace:", error);
      return { success: false, error: error.message };
    }
  }

  async listEgg(userId, eggId, price, currency = "ETH") {
    try {
      const egg = await Egg.findOne({ _id: eggId, owner: userId });
      if (!egg) throw new Error("Egg not found or not owned by user");
      if (egg.isListed) throw new Error("Egg already listed");

      const user = await User.findById(userId);
      if (!user?.walletAddress) throw new Error("User wallet not found");

      // Mint NFT for egg
      const mintResult = await this.blockchainService.mintNFT(
        user.walletAddress,
        "egg",
        {
          eggId: egg._id.toString(),
          type: egg.type,
          rarity: egg.rarity,
          hatchDuration: egg.hatchDuration,
        }
      );

      if (!mintResult.success) {
        throw new Error(`NFT minting failed: ${mintResult.error}`);
      }

      const tokenId = mintResult.tokenId;

      // List on blockchain
      const listResult = await this.blockchainService.listItem(
        user.walletAddress,
        "egg",
        tokenId,
        price
      );

      if (!listResult.success) {
        throw new Error(`Listing failed: ${listResult.error}`);
      }

      // Create trade record
      const trade = new Trade({
        seller: userId,
        itemType: "egg",
        itemId: eggId,
        price,
        currency,
        nftTokenId: tokenId,
        blockchainListingId: listResult.listingId,
        blockchainTxHash: listResult.txHash,
        marketplaceFee: this.marketplaceFee,
      });

      await trade.save();

      // Mark egg as listed
      egg.isListed = true;
      egg.nftTokenId = tokenId;
      await egg.save();

      return {
        success: true,
        listingId: trade._id,
        blockchain: {
          tokenId,
          listingId: listResult.listingId,
          txHash: listResult.txHash,
        },
      };
    } catch (error) {
      logger.error("Error listing egg in marketplace:", error);
      return { success: false, error: error.message };
    }
  }

  /** --- 🛍️ Purchase Functions --- **/

  async buyPet(buyerId, listingId) {
    const session = await Trade.startSession();
    session.startTransaction();

    try {
      const trade = await Trade.findOne({
        _id: listingId,
        status: "listed",
        itemType: { $in: [null, "pet"] }, // Support both old and new schema
      })
        .populate("seller")
        .populate("pet")
        .session(session);

      if (!trade) {
        throw new Error("Listing not found or inactive");
      }

      const buyer = await User.findById(buyerId).session(session);
      if (!buyer?.walletAddress) {
        throw new Error("Buyer wallet not found");
      }

      // Check balance for in-game currency
      if (trade.currency === "coins" && buyer.coins < trade.price) {
        throw new Error("Insufficient balance");
      }

      // Execute blockchain purchase
      const purchaseResult = await this.blockchainService.buyItem(
        buyer.walletAddress,
        trade.blockchainListingId,
        trade.price
      );

      if (!purchaseResult.success) {
        throw new Error(`Blockchain purchase failed: ${purchaseResult.error}`);
      }

      // Transfer pet ownership
      const pet = trade.pet;
      pet.owner = buyerId;
      pet.isListed = false;
      await pet.save({ session });

      // Update trade
      trade.buyer = buyerId;
      trade.status = "sold";
      trade.soldAt = new Date();
      trade.blockchainTxHash = purchaseResult.txHash;
      await trade.save({ session });

      // Handle payment
      if (trade.currency === "coins") {
        // Deduct from buyer
        buyer.coins -= trade.price;
        await buyer.save({ session });

        // Pay seller (minus fees)
        const seller = await User.findById(trade.seller._id).session(session);
        const netAmount = trade.price * (1 - trade.marketplaceFee);
        seller.coins += netAmount;
        await seller.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        pet: pet.toObject(),
        blockchain: {
          txHash: purchaseResult.txHash,
          transaction: purchaseResult.transaction,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  async buyEgg(buyerId, listingId) {
    const session = await Trade.startSession();
    session.startTransaction();

    try {
      const trade = await Trade.findOne({
        _id: listingId,
        status: "listed",
        itemType: "egg",
      })
        .populate("seller")
        .populate("itemId")
        .session(session);

      if (!trade) {
        throw new Error("Listing not found or inactive");
      }

      const buyer = await User.findById(buyerId).session(session);
      if (!buyer?.walletAddress) {
        throw new Error("Buyer wallet not found");
      }

      if (trade.currency === "coins" && buyer.coins < trade.price) {
        throw new Error("Insufficient balance");
      }

      // Execute blockchain purchase
      const purchaseResult = await this.blockchainService.buyItem(
        buyer.walletAddress,
        trade.blockchainListingId,
        trade.price
      );

      if (!purchaseResult.success) {
        throw new Error(`Blockchain purchase failed: ${purchaseResult.error}`);
      }

      // Transfer egg ownership
      const egg = trade.itemId;
      egg.owner = buyerId;
      egg.isListed = false;
      await egg.save({ session });

      // Update trade
      trade.buyer = buyerId;
      trade.status = "sold";
      trade.soldAt = new Date();
      trade.blockchainTxHash = purchaseResult.txHash;
      await trade.save({ session });

      // Handle payment
      if (trade.currency === "coins") {
        buyer.coins -= trade.price;
        await buyer.save({ session });

        const seller = await User.findById(trade.seller._id).session(session);
        const netAmount = trade.price * (1 - trade.marketplaceFee);
        seller.coins += netAmount;
        await seller.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        egg: egg.toObject(),
        blockchain: {
          txHash: purchaseResult.txHash,
          transaction: purchaseResult.transaction,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  /** --- 🔍 Query Functions --- **/

  async getActiveListings(filters = {}) {
    const query = { status: "listed", ...filters };
    const trades = await Trade.find(query)
      .populate("seller", "username walletAddress")
      .populate("pet")
      .populate("itemId")
      .sort({ listedAt: -1 })
      .lean();

    return trades;
  }

  async getUserListings(userId) {
    return await Trade.find({
      seller: userId,
      status: "listed",
    })
      .populate("pet")
      .populate("itemId")
      .sort({ listedAt: -1 })
      .lean();
  }

  async cancelListing(userId, listingId) {
    const session = await Trade.startSession();
    session.startTransaction();

    try {
      const trade = await Trade.findOne({
        _id: listingId,
        seller: userId,
        status: "listed",
      }).session(session);

      if (!trade) {
        throw new Error("Listing not found or not owned by user");
      }

      const user = await User.findById(userId).session(session);
      if (!user?.walletAddress) {
        throw new Error("User wallet not found");
      }

      // Cancel on blockchain
      const cancelResult = await this.blockchainService.cancelListing(
        user.walletAddress,
        trade.blockchainListingId
      );

      // Update trade status
      trade.status = "cancelled";
      trade.cancelledAt = new Date();
      trade.blockchainTxHash = cancelResult?.txHash || trade.blockchainTxHash;
      await trade.save({ session });

      // Mark item as not listed
      if (trade.itemType === "egg") {
        const egg = await Egg.findById(trade.itemId).session(session);
        if (egg) {
          egg.isListed = false;
          await egg.save({ session });
        }
      } else {
        const pet = await Pet.findById(trade.pet || trade.itemId).session(
          session
        );
        if (pet) {
          pet.isListed = false;
          await pet.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        blockchain: cancelResult,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  // Get blockchain transaction details
  async getTransaction(txHash) {
    return await this.blockchainService.getTransaction(txHash);
  }

  // Verify NFT ownership
  async verifyOwnership(userId, tokenId) {
    try {
      const user = await User.findById(userId);
      if (!user?.walletAddress) return false;

      const owner = await this.blockchainService.getNFTowner(tokenId);
      return owner === user.walletAddress;
    } catch (error) {
      logger.error("Error verifying ownership:", error);
      return false;
    }
  }
}

// Add missing method to BlockchainSimulationService
BlockchainSimulationService.prototype.cancelListing = async function (
  userWallet,
  listingId
) {
  const listing = this.listings.get(listingId);
  if (!listing || !listing.active) {
    return { success: false, error: "Listing not found or inactive" };
  }

  if (listing.seller !== userWallet) {
    return { success: false, error: "Not listing owner" };
  }

  const txHash = this.generateTxHash();

  // Update listing
  listing.active = false;
  listing.cancelledAt = new Date();

  const transaction = {
    type: "CANCEL_LIST",
    listingId,
    txHash,
    seller: userWallet,
    timestamp: new Date(),
    status: "confirmed",
  };

  this.transactions.set(txHash, transaction);

  return {
    success: true,
    txHash,
    transaction,
    listing,
  };
};

export const tradeService = new TradeService();
export const marketplaceService = new MarketplaceService();
export default tradeService;
