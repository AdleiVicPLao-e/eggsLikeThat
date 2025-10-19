import logger from "../utils/logger.js";
import Trade from "../models/Trade.js";
import { Pet } from "../models/Pet.js";
import { Egg } from "../models/Egg.js";
import { User } from "../models/User.js";
import Transaction from "../models/Transaction.js";
import { blockchainService, ITEM_TYPES } from "../config/blockchain.js";

class TradeService {
  constructor() {
    this.blockchainService = blockchainService;
    this.marketplaceFee = 0.025; // 2.5% marketplace fee
    this.royaltyFee = 0.01; // 1% royalty fee
  }

  // List a pet for sale
  async listPet(sellerId, petId, price, currency = "ETH") {
    try {
      // Verify pet ownership
      const pet = await Pet.findOne({ _id: petId, ownerId: sellerId });
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

      // Use existing tokenId or get from blockchain
      let tokenId = pet.tokenId;
      if (!tokenId) {
        // If pet doesn't have a tokenId, check blockchain for owned pets
        const ownedPets = await this.blockchainService.getOwnedPets(
          seller.walletAddress
        );
        const blockchainPet = ownedPets.find(
          (p) => p.metadata.name === pet.name && p.metadata.petType === pet.type
        );

        if (blockchainPet) {
          tokenId = blockchainPet.tokenId;
          // Update pet with tokenId
          pet.tokenId = tokenId;
          await pet.save();
        } else {
          throw new Error(
            "Pet NFT not found on blockchain. Please mint NFT first."
          );
        }
      }

      // List on blockchain marketplace
      const listResult = await this.blockchainService.listItem(
        "PetNFT", // nftContract
        ITEM_TYPES.PET, // itemType
        tokenId,
        1, // amount
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
        marketplaceFee: this.marketplaceFee,
        royaltyFee: this.royaltyFee,
        itemType: "pet",
        nftContract: "PetNFT",
      });

      await trade.save();

      // Update pet listing status
      pet.isListed = true;
      await pet.save();

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
          tokenId: tokenId,
        },
      };
    } catch (error) {
      logger.error("Error listing pet:", error);
      return { success: false, error: error.message };
    }
  }

  // List an egg for sale
  async listEgg(sellerId, eggId, price, currency = "ETH") {
    try {
      // Verify egg ownership
      const egg = await Egg.findOne({ _id: eggId, ownerId: sellerId });
      if (!egg) {
        throw new Error("Egg not found or not owned by seller");
      }

      // Check if egg is already listed
      const existingTrade = await Trade.findOne({
        itemId: eggId,
        itemType: "egg",
        status: "listed",
      });

      if (existingTrade) {
        throw new Error("Egg is already listed for sale");
      }

      // Get seller's wallet address
      const seller = await User.findById(sellerId);
      if (!seller?.walletAddress) {
        throw new Error("Seller wallet address not found");
      }

      // Use existing tokenId or get from blockchain
      let tokenId = egg.tokenId;
      if (!tokenId) {
        // Check blockchain for owned eggs
        const ownedEggs = await this.blockchainService.getOwnedEggs(
          seller.walletAddress
        );
        const blockchainEgg = ownedEggs.find(
          (e) => e.eggType === this.mapEggTypeToBlockchain(egg.type)
        );

        if (blockchainEgg && blockchainEgg.amount > 0) {
          tokenId = blockchainEgg.eggType;
          egg.tokenId = tokenId;
          await egg.save();
        } else {
          throw new Error(
            "Egg NFT not found on blockchain. Please mint NFT first."
          );
        }
      }

      // List on blockchain marketplace
      const listResult = await this.blockchainService.listItem(
        "EggNFT", // nftContract
        ITEM_TYPES.EGG, // itemType
        tokenId,
        1, // amount
        price
      );

      if (!listResult.success) {
        throw new Error(`Listing failed: ${listResult.error}`);
      }

      // Create trade record
      const trade = new Trade({
        seller: sellerId,
        itemId: eggId,
        itemType: "egg",
        price,
        currency,
        nftTokenId: tokenId,
        blockchainListingId: listResult.listingId,
        marketplaceFee: this.marketplaceFee,
        nftContract: "EggNFT",
      });

      await trade.save();

      // Update egg listing status
      egg.isListed = true;
      await egg.save();

      await trade.populate("seller", "username walletAddress");
      await trade.populate("itemId");

      logger.info(
        `Egg ${eggId} listed for sale by user ${sellerId} for ${price} ${currency}. Listing ID: ${listResult.listingId}`
      );

      return {
        success: true,
        trade: trade.toObject(),
        blockchain: {
          listingId: listResult.listingId,
          tokenId: tokenId,
        },
      };
    } catch (error) {
      logger.error("Error listing egg:", error);
      return { success: false, error: error.message };
    }
  }

  // List a technique for sale
  async listTechnique(sellerId, techniqueId, price, currency = "ETH") {
    try {
      const Technique = mongoose.models.Technique;
      const technique = await Technique.findOne({
        _id: techniqueId,
        ownerId: sellerId,
      });
      if (!technique) {
        throw new Error("Technique not found or not owned by seller");
      }

      const existingTrade = await Trade.findOne({
        itemId: techniqueId,
        itemType: "technique",
        status: "listed",
      });

      if (existingTrade) {
        throw new Error("Technique is already listed for sale");
      }

      const seller = await User.findById(sellerId);
      if (!seller?.walletAddress) {
        throw new Error("Seller wallet address not found");
      }

      let tokenId = technique.tokenId;
      if (!tokenId) {
        throw new Error(
          "Technique NFT not found on blockchain. Please mint NFT first."
        );
      }

      const listResult = await this.blockchainService.listItem(
        "TechniqueNFT",
        ITEM_TYPES.TECHNIQUE,
        tokenId,
        1,
        price
      );

      if (!listResult.success) {
        throw new Error(`Listing failed: ${listResult.error}`);
      }

      const trade = new Trade({
        seller: sellerId,
        itemId: techniqueId,
        itemType: "technique",
        price,
        currency,
        nftTokenId: tokenId,
        blockchainListingId: listResult.listingId,
        marketplaceFee: this.marketplaceFee,
        nftContract: "TechniqueNFT",
      });

      await trade.save();
      technique.isListed = true;
      await technique.save();

      await trade.populate("seller", "username walletAddress");
      await trade.populate("itemId");

      logger.info(
        `Technique ${techniqueId} listed for sale by user ${sellerId} for ${price} ${currency}`
      );

      return {
        success: true,
        trade: trade.toObject(),
        blockchain: {
          listingId: listResult.listingId,
          tokenId: tokenId,
        },
      };
    } catch (error) {
      logger.error("Error listing technique:", error);
      return { success: false, error: error.message };
    }
  }

  // List a skin for sale
  async listSkin(sellerId, skinId, price, currency = "ETH") {
    try {
      const Skin = mongoose.models.Skin;
      const skin = await Skin.findOne({ _id: skinId, ownerId: sellerId });
      if (!skin) {
        throw new Error("Skin not found or not owned by seller");
      }

      const existingTrade = await Trade.findOne({
        itemId: skinId,
        itemType: "skin",
        status: "listed",
      });

      if (existingTrade) {
        throw new Error("Skin is already listed for sale");
      }

      const seller = await User.findById(sellerId);
      if (!seller?.walletAddress) {
        throw new Error("Seller wallet address not found");
      }

      let tokenId = skin.tokenId;
      if (!tokenId) {
        throw new Error(
          "Skin NFT not found on blockchain. Please mint NFT first."
        );
      }

      const listResult = await this.blockchainService.listItem(
        "SkinNFT",
        ITEM_TYPES.SKIN,
        tokenId,
        1,
        price
      );

      if (!listResult.success) {
        throw new Error(`Listing failed: ${listResult.error}`);
      }

      const trade = new Trade({
        seller: sellerId,
        itemId: skinId,
        itemType: "skin",
        price,
        currency,
        nftTokenId: tokenId,
        blockchainListingId: listResult.listingId,
        marketplaceFee: this.marketplaceFee,
        nftContract: "SkinNFT",
      });

      await trade.save();
      skin.isListed = true;
      await skin.save();

      await trade.populate("seller", "username walletAddress");
      await trade.populate("itemId");

      logger.info(
        `Skin ${skinId} listed for sale by user ${sellerId} for ${price} ${currency}`
      );

      return {
        success: true,
        trade: trade.toObject(),
        blockchain: {
          listingId: listResult.listingId,
          tokenId: tokenId,
        },
      };
    } catch (error) {
      logger.error("Error listing skin:", error);
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

      // Cancel on blockchain
      const cancelResult = await this.blockchainService.cancelListing(
        trade.blockchainListingId
      );

      if (!cancelResult?.success) {
        logger.warn(
          `Blockchain cancellation failed for trade ${tradeId}, proceeding with database cancellation`
        );
      }

      trade.status = "cancelled";
      trade.cancelledAt = new Date();
      await trade.save();

      // Update item listing status
      await this.updateItemListingStatus(trade, false);

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

  // Purchase a listed item
  async purchaseItem(buyerId, tradeId) {
    const session = await Trade.startSession();
    session.startTransaction();

    try {
      const trade = await Trade.findOne({
        _id: tradeId,
        status: "listed",
      })
        .populate("seller")
        .session(session);

      if (!trade) {
        throw new Error("Trade not found or not available");
      }

      // Check if buyer is the seller
      if (trade.seller._id.toString() === buyerId) {
        throw new Error("Cannot purchase your own item");
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
        trade.blockchainListingId,
        trade.price
      );

      if (!purchaseResult.success) {
        throw new Error(`Blockchain purchase failed: ${purchaseResult.error}`);
      }

      // Update item ownership based on type
      await this.transferItemOwnership(trade, buyerId, session);

      // Update trade status
      trade.buyer = buyerId;
      trade.status = "sold";
      trade.soldAt = new Date();
      await trade.save({ session });

      // Handle payment based on currency
      if (trade.currency === "coins") {
        await this.handleCoinPayment(trade, buyer, session);
      }

      await session.commitTransaction();
      session.endSession();

      logger.info(
        `Item purchased by user ${buyerId} from user ${trade.seller._id}. Trade ID: ${tradeId}`
      );

      return {
        success: true,
        trade: trade.toObject(),
        blockchain: {
          transaction: purchaseResult,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();

      logger.error("Error purchasing item:", error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to transfer item ownership
  async transferItemOwnership(trade, buyerId, session) {
    switch (trade.itemType) {
      case "pet":
        const pet = await Pet.findById(trade.pet).session(session);
        if (pet) {
          pet.ownerId = buyerId;
          pet.isListed = false;
          await pet.save({ session });
        }
        break;

      case "egg":
        const egg = await Egg.findById(trade.itemId).session(session);
        if (egg) {
          egg.ownerId = buyerId;
          egg.isListed = false;
          await egg.save({ session });
        }
        break;

      case "technique":
        const Technique = mongoose.models.Technique;
        const technique = await Technique.findById(trade.itemId).session(
          session
        );
        if (technique) {
          technique.ownerId = buyerId;
          technique.isListed = false;
          await technique.save({ session });
        }
        break;

      case "skin":
        const Skin = mongoose.models.Skin;
        const skin = await Skin.findById(trade.itemId).session(session);
        if (skin) {
          skin.ownerId = buyerId;
          skin.isListed = false;
          await skin.save({ session });
        }
        break;
    }
  }

  // Helper method to handle coin payments
  async handleCoinPayment(trade, buyer, session) {
    // Deduct from buyer
    buyer.coins -= trade.price;
    await buyer.save({ session });

    // Calculate net amount for seller (minus fees)
    const totalFees = trade.marketplaceFee + (trade.royaltyFee || 0);
    const netAmount = trade.price * (1 - totalFees);

    // Add to seller
    const seller = await User.findById(trade.seller._id).session(session);
    seller.coins += netAmount;
    await seller.save({ session });

    // Record transactions
    const transactionData = [
      {
        user: buyer._id,
        type: "purchase",
        amount: -trade.price,
        currency: "coins",
        status: "completed",
        itemId: trade.itemId || trade.pet,
        itemType: trade.itemType || "pet",
        description: `Purchased ${trade.itemType || "pet"}`,
      },
      {
        user: trade.seller._id,
        type: "sale",
        amount: netAmount,
        currency: "coins",
        status: "completed",
        itemId: trade.itemId || trade.pet,
        itemType: trade.itemType || "pet",
        description: `Sold ${trade.itemType || "pet"}`,
      },
    ];

    // Add marketplace fee transaction
    if (trade.marketplaceFee > 0) {
      transactionData.push({
        user: "system", // Marketplace fee
        type: "marketplace_fee",
        amount: trade.price * trade.marketplaceFee,
        currency: "coins",
        status: "completed",
        itemId: trade._id,
        itemType: "fee",
        description: `Marketplace fee for ${trade.itemType || "pet"} sale`,
      });
    }

    await Transaction.create(transactionData, { session });
  }

  // Helper method to update item listing status
  async updateItemListingStatus(trade, isListed) {
    switch (trade.itemType) {
      case "pet":
        await Pet.findByIdAndUpdate(trade.pet, { isListed });
        break;
      case "egg":
        await Egg.findByIdAndUpdate(trade.itemId, { isListed });
        break;
      case "technique":
        const Technique = mongoose.models.Technique;
        await Technique.findByIdAndUpdate(trade.itemId, { isListed });
        break;
      case "skin":
        const Skin = mongoose.models.Skin;
        await Skin.findByIdAndUpdate(trade.itemId, { isListed });
        break;
    }
  }

  // Get active listings with filters
  async getListings(filters = {}, page = 1, limit = 20) {
    try {
      const query = { status: "listed", ...filters };

      const trades = await Trade.find(query)
        .populate("seller", "username walletAddress")
        .populate("pet")
        .populate("itemId")
        .sort({ listedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Enhance with blockchain data
      const enhancedTrades = await Promise.all(
        trades.map(async (trade) => {
          try {
            const blockchainListing = await this.blockchainService.getListing(
              trade.blockchainListingId
            );

            return {
              ...trade,
              blockchain: {
                tokenId: trade.nftTokenId,
                listingId: trade.blockchainListingId,
                active: blockchainListing?.active || false,
                price: blockchainListing?.price,
                seller: blockchainListing?.seller,
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

  // Get active listings from blockchain
  async getBlockchainListings() {
    try {
      const blockchainListings =
        await this.blockchainService.getActiveListings();

      // Enhance with database data
      const enhancedListings = await Promise.all(
        blockchainListings.map(async (listing) => {
          try {
            // Find corresponding trade in database
            const trade = await Trade.findOne({
              blockchainListingId: listing.listingId,
            })
              .populate("seller", "username")
              .populate("pet")
              .populate("itemId");

            return {
              ...listing,
              database: trade
                ? {
                    tradeId: trade._id,
                    seller: trade.seller,
                    item: trade.pet || trade.itemId,
                  }
                : null,
            };
          } catch (error) {
            return listing;
          }
        })
      );

      return {
        success: true,
        listings: enhancedListings,
      };
    } catch (error) {
      logger.error("Error getting blockchain listings:", error);
      return { success: false, error: error.message };
    }
  }

  // Sync with blockchain (for real NFT trades)
  async syncBlockchainListings() {
    try {
      // Get active blockchain listings
      const blockchainListings =
        await this.blockchainService.getActiveListings();
      const blockchainListingIds = blockchainListings.map((l) => l.listingId);

      // Update database to match blockchain state
      const dbListings = await Trade.find({ status: "listed" });

      let synced = 0;
      for (const dbListing of dbListings) {
        const isOnBlockchain = blockchainListingIds.includes(
          dbListing.blockchainListingId
        );

        if (!isOnBlockchain) {
          // Listing no longer active on blockchain, mark as cancelled
          dbListing.status = "cancelled";
          dbListing.cancelledAt = new Date();
          await dbListing.save();

          // Update item listing status
          await this.updateItemListingStatus(dbListing, false);
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
        .populate("itemId")
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

  // Get user's NFTs from blockchain
  async getUserNFTs(userId) {
    try {
      const user = await User.findById(userId);
      if (!user?.walletAddress) {
        return { success: true, nfts: [] };
      }

      const [pets, eggs, skins, techniques] = await Promise.all([
        this.blockchainService.getOwnedPets(user.walletAddress),
        this.blockchainService.getOwnedEggs(user.walletAddress),
        this.blockchainService.getOwnedSkins(user.walletAddress),
        this.blockchainService.getOwnedTechniques(user.walletAddress),
      ]);

      const nfts = [
        ...pets.map((pet) => ({ ...pet, type: "pet" })),
        ...eggs.map((egg) => ({ ...egg, type: "egg" })),
        ...skins.map((skin) => ({ ...skin, type: "skin" })),
        ...techniques.map((tech) => ({ ...tech, type: "technique" })),
      ];

      return { success: true, nfts };
    } catch (error) {
      logger.error("Error getting user NFTs:", error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to map egg types
  mapEggTypeToBlockchain(appEggType) {
    const mapping = {
      basic: 1, // BASIC_EGG
      cosmetic: 2, // COSMETIC_EGG
      attribute: 3, // ATTRIBUTE_EGG
    };
    return mapping[appEggType] || 1;
  }
}

// Enhanced MarketplaceService using the new blockchain service
export class MarketplaceService {
  constructor() {
    this.blockchainService = blockchainService;
    this.marketplaceFee = 0.025; // 2.5%
  }

  /** --- 🛒 Listing Management --- **/

  async listPet(userId, petId, price, currency = "ETH") {
    return await tradeService.listPet(userId, petId, price, currency);
  }

  async listEgg(userId, eggId, price, currency = "ETH") {
    return await tradeService.listEgg(userId, eggId, price, currency);
  }

  async listTechnique(userId, techniqueId, price, currency = "ETH") {
    return await tradeService.listTechnique(
      userId,
      techniqueId,
      price,
      currency
    );
  }

  async listSkin(userId, skinId, price, currency = "ETH") {
    return await tradeService.listSkin(userId, skinId, price, currency);
  }

  /** --- 🛍️ Purchase Functions --- **/

  async buyPet(buyerId, listingId) {
    return await tradeService.purchaseItem(buyerId, listingId);
  }

  async buyEgg(buyerId, listingId) {
    return await tradeService.purchaseItem(buyerId, listingId);
  }

  async buyTechnique(buyerId, listingId) {
    return await tradeService.purchaseItem(buyerId, listingId);
  }

  async buySkin(buyerId, listingId) {
    return await tradeService.purchaseItem(buyerId, listingId);
  }

  /** --- 🔍 Query Functions --- **/

  async getActiveListings(filters = {}) {
    const result = await tradeService.getListings(filters);
    return result.success ? result.trades : [];
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
    return await tradeService.cancelListing(userId, listingId);
  }

  // Get blockchain listing details
  async getBlockchainListing(listingId) {
    return await this.blockchainService.getListing(listingId);
  }

  // Verify NFT ownership
  async verifyOwnership(userId, tokenId, nftContract) {
    try {
      const user = await User.findById(userId);
      if (!user?.walletAddress) return false;

      // For simplicity, we'll check if the user owns any NFT with this tokenId
      // In a real implementation, you'd check the specific contract
      const ownedPets = await this.blockchainService.getOwnedPets(
        user.walletAddress
      );
      const ownedEggs = await this.blockchainService.getOwnedEggs(
        user.walletAddress
      );
      const ownedSkins = await this.blockchainService.getOwnedSkins(
        user.walletAddress
      );
      const ownedTechniques = await this.blockchainService.getOwnedTechniques(
        user.walletAddress
      );

      const allOwned = [
        ...ownedPets.map((p) => p.tokenId),
        ...ownedEggs.map((e) => e.eggType?.toString()),
        ...ownedSkins.map((s) => s.skinType?.toString()),
        ...ownedTechniques.map((t) => t.tokenId),
      ];

      return allOwned.includes(tokenId.toString());
    } catch (error) {
      logger.error("Error verifying ownership:", error);
      return false;
    }
  }

  // Get marketplace stats
  async getMarketplaceStats() {
    try {
      const [totalListings, totalSales, totalVolume, activeUsers] =
        await Promise.all([
          Trade.countDocuments({ status: "listed" }),
          Trade.countDocuments({ status: "sold" }),
          Trade.aggregate([
            { $match: { status: "sold" } },
            { $group: { _id: null, total: { $sum: "$price" } } },
          ]),
          Trade.distinct("seller", { status: "listed" }),
        ]);

      const blockchainListings =
        await this.blockchainService.getActiveListings();

      return {
        success: true,
        stats: {
          totalListings,
          totalSales,
          totalVolume: totalVolume[0]?.total || 0,
          activeUsers: activeUsers.length,
          blockchainListings: blockchainListings.length,
        },
      };
    } catch (error) {
      logger.error("Error getting marketplace stats:", error);
      return { success: false, error: error.message };
    }
  }
}

export const tradeService = new TradeService();
export const marketplaceService = new MarketplaceService();
export default tradeService;
