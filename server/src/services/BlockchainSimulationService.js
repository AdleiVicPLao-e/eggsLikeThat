// server/services/BlockchainSimulationService.js
export class BlockchainSimulationService {
  constructor() {
    this.transactions = new Map();
    this.nftOwnership = new Map(); // tokenId -> ownerAddress
    this.listings = new Map(); // listingId -> listing data
    this.nextTokenId = 1;
    this.nextListingId = 1;
  }

  /** --- 🎭 Simulated Blockchain Operations --- */

  // Generate fake wallet address
  generateWalletAddress() {
    return `0x${Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;
  }

  // Simulate NFT minting
  async mintNFT(userWallet, itemType, itemData) {
    const tokenId = this.nextTokenId++;
    const txHash = this.generateTxHash();

    // Store ownership
    this.nftOwnership.set(tokenId.toString(), {
      owner: userWallet,
      itemType,
      itemData,
      tokenId: tokenId.toString(),
      mintedAt: new Date(),
    });

    const transaction = {
      type: "MINT",
      tokenId: tokenId.toString(),
      txHash,
      from: "0x0000000000000000000000000000000000000000", // Null address
      to: userWallet,
      itemType,
      timestamp: new Date(),
      status: "confirmed",
    };

    this.transactions.set(txHash, transaction);

    return {
      success: true,
      tokenId: tokenId.toString(),
      txHash,
      transaction,
    };
  }

  // Simulate transferring NFT
  async transferNFT(fromWallet, toWallet, tokenId) {
    const ownership = this.nftOwnership.get(tokenId);
    if (!ownership || ownership.owner !== fromWallet) {
      return { success: false, error: "Not owner or NFT does not exist" };
    }

    const txHash = this.generateTxHash();

    // Update ownership
    ownership.owner = toWallet;
    ownership.transferredAt = new Date();

    const transaction = {
      type: "TRANSFER",
      tokenId,
      txHash,
      from: fromWallet,
      to: toWallet,
      timestamp: new Date(),
      status: "confirmed",
    };

    this.transactions.set(txHash, transaction);

    return {
      success: true,
      txHash,
      transaction,
    };
  }

  // Simulate marketplace listing
  async listItem(userWallet, itemType, tokenId, price) {
    const ownership = this.nftOwnership.get(tokenId);
    if (!ownership || ownership.owner !== userWallet) {
      return { success: false, error: "Not owner or NFT does not exist" };
    }

    const listingId = this.nextListingId++;
    const txHash = this.generateTxHash();

    const listing = {
      listingId: listingId.toString(),
      seller: userWallet,
      itemType,
      tokenId,
      price,
      active: true,
      createdAt: new Date(),
    };

    this.listings.set(listingId.toString(), listing);

    const transaction = {
      type: "LIST",
      tokenId,
      txHash,
      listingId: listingId.toString(),
      price,
      timestamp: new Date(),
      status: "confirmed",
    };

    this.transactions.set(txHash, transaction);

    return {
      success: true,
      listingId: listingId.toString(),
      txHash,
      listing,
      transaction,
    };
  }

  // Simulate buying from marketplace
  async buyItem(buyerWallet, listingId, price) {
    const listing = this.listings.get(listingId);
    if (!listing || !listing.active) {
      return { success: false, error: "Listing not found or inactive" };
    }

    if (price < listing.price) {
      return { success: false, error: "Insufficient payment" };
    }

    const ownership = this.nftOwnership.get(listing.tokenId);
    if (!ownership) {
      return { success: false, error: "NFT not found" };
    }

    const txHash = this.generateTxHash();

    // Transfer ownership
    ownership.owner = buyerWallet;
    ownership.transferredAt = new Date();

    // Update listing
    listing.active = false;
    listing.soldAt = new Date();
    listing.buyer = buyerWallet;

    const transaction = {
      type: "BUY",
      tokenId: listing.tokenId,
      txHash,
      from: listing.seller,
      to: buyerWallet,
      price: listing.price,
      listingId,
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
  }

  /** --- 🔍 Query Operations --- */
  async getNFTowner(tokenId) {
    const ownership = this.nftOwnership.get(tokenId);
    return ownership ? ownership.owner : null;
  }

  async getNFTmetadata(tokenId) {
    return this.nftOwnership.get(tokenId) || null;
  }

  async getActiveListings() {
    return Array.from(this.listings.values()).filter(
      (listing) => listing.active
    );
  }

  async getUserNFTs(userWallet) {
    return Array.from(this.nftOwnership.values()).filter(
      (ownership) => ownership.owner === userWallet
    );
  }

  async getTransaction(txHash) {
    return this.transactions.get(txHash) || null;
  }

  /** --- 🔧 Utilities --- */
  generateTxHash() {
    return `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;
  }

  // Simulate blockchain confirmation delay
  async simulateBlockConfirmation() {
    return new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 1000 + 500)
    );
  }
}
