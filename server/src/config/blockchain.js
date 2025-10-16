import { ethers } from "ethers";
import { config } from "./env.js";
import logger from "../utils/logger.js";

// --- Contract ABIs ---
export const PET_NFT_ABI = [
  "function mint(address to, string memory tokenURI) external returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export const MARKETPLACE_ABI = [
  "function listItem(uint256 tokenId, uint256 price) external",
  "function cancelListing(uint256 tokenId) external",
  "function buyItem(uint256 tokenId) external payable",
  "function getListing(uint256 tokenId) external view returns (address seller, uint256 price, bool active)",
  "event ItemListed(address indexed seller, uint256 indexed tokenId, uint256 price)",
  "event ItemSold(address indexed buyer, uint256 indexed tokenId, uint256 price)",
];

class BlockchainService {
  constructor() {
    // detect mock mode
    this.isMockMode = config.NODE_ENV === "development";

    // RPC providers
    this.providers = {
      ethereum: this.createProvider(config.ETHEREUM_RPC_URL),
      polygon: this.createProvider(config.POLYGON_RPC_URL),
    };

    this.contracts = {};
    this.initContracts();
  }

  createProvider(rpcUrl) {
    try {
      return rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : null;
    } catch (err) {
      logger.warn(`⚠️ Invalid RPC URL: ${rpcUrl}`);
      return null;
    }
  }

  validateAddress(address, name) {
    if (!address || !ethers.isAddress(address)) {
      logger.warn(`⚠️ Invalid or missing address for ${name}: ${address}`);
      return null;
    }
    return address;
  }

  initContracts() {
    try {
      if (this.isMockMode) {
        logger.info("🧩 Mock blockchain mode enabled (no real transactions)");
        return;
      }

      const petNFTAddr = this.validateAddress(
        config.CONTRACT_PET_NFT,
        "PetNFT"
      );
      const marketAddr = this.validateAddress(
        config.CONTRACT_MARKETPLACE,
        "Marketplace"
      );

      if (petNFTAddr) {
        this.contracts.petNFT = {
          ethereum: new ethers.Contract(
            petNFTAddr,
            PET_NFT_ABI,
            this.providers.ethereum
          ),
          polygon: new ethers.Contract(
            petNFTAddr,
            PET_NFT_ABI,
            this.providers.polygon
          ),
        };
      }

      if (marketAddr) {
        this.contracts.marketplace = {
          ethereum: new ethers.Contract(
            marketAddr,
            MARKETPLACE_ABI,
            this.providers.ethereum
          ),
          polygon: new ethers.Contract(
            marketAddr,
            MARKETPLACE_ABI,
            this.providers.polygon
          ),
        };
      }

      logger.info("✅ Blockchain contracts initialized");
    } catch (error) {
      logger.error("❌ Failed to initialize blockchain contracts:", error);
    }
  }

  // --- MOCK HELPERS ---
  async mockDelay(ms = 300) {
    return new Promise((res) => setTimeout(res, ms));
  }

  // --- METHODS ---
  async verifyPetOwnership(walletAddress, tokenId, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return true; // Always true in demo
    }

    try {
      const contract = this.contracts.petNFT?.[network];
      if (!contract)
        throw new Error(`Pet NFT contract not configured for ${network}`);

      const owner = await contract.ownerOf(tokenId);
      return owner.toLowerCase() === walletAddress.toLowerCase();
    } catch (error) {
      logger.error("Error verifying pet ownership:", error);
      return false;
    }
  }

  async getOwnedPets(walletAddress, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return [
        {
          tokenId: "1",
          tokenURI: "https://demo-pets.com/api/pet1.json",
          network,
        },
        {
          tokenId: "2",
          tokenURI: "https://demo-pets.com/api/pet2.json",
          network,
        },
      ];
    }

    try {
      const contract = this.contracts.petNFT?.[network];
      if (!contract)
        throw new Error(`Pet NFT contract not configured for ${network}`);

      const balance = await contract.balanceOf(walletAddress);
      const pets = [];

      for (let i = 0; i < balance; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i);
        const tokenURI = await contract.tokenURI(tokenId);
        pets.push({ tokenId: tokenId.toString(), tokenURI, network });
      }

      return pets;
    } catch (error) {
      logger.error("Error getting owned pets:", error);
      return [];
    }
  }

  async getListing(tokenId, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return {
        seller: "0x000000000000000000000000000000000000dEaD",
        price: "0.05",
        active: true,
      };
    }

    try {
      const contract = this.contracts.marketplace?.[network];
      if (!contract)
        throw new Error(`Marketplace contract not configured for ${network}`);

      const listing = await contract.getListing(tokenId);
      return {
        seller: listing.seller,
        price: ethers.formatEther(listing.price),
        active: listing.active,
      };
    } catch (error) {
      logger.error("Error getting listing:", error);
      return null;
    }
  }
}

export const blockchainService = new BlockchainService();
export default blockchainService;
