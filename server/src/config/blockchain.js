import { ethers } from "ethers";
import { config } from "./env.js";
import logger from "../utils/logger.js";

// --- Contract ABIs ---
export const PET_NFT_ABI = [
  "function mint(address to, string memory name, string memory petType, string memory rarity, bool isShiny) external returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "function getPetMetadata(uint256 tokenId) external view returns ((string name, string petType, string rarity, uint256 level, bool isShiny))",
  "function levelUp(uint256 tokenId) external",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event PetMinted(address indexed to, uint256 tokenId, (string name, string petType, string rarity, uint256 level, bool isShiny) metadata)",
];

export const EGG_NFT_ABI = [
  "function mint(address to, uint256 eggType, uint256 amount) external",
  "function mintBatch(address to, uint256[] memory eggTypes, uint256[] memory amounts) external",
  "function burn(address from, uint256 eggType, uint256 amount) external",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function balanceOfBatch(address[] memory accounts, uint256[] memory ids) external view returns (uint256[] memory)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) external",
  "function uri(uint256 tokenId) external view returns (string memory)",
  "function getEggTypeName(uint256 eggType) external pure returns (string memory)",
  "event EggMinted(address indexed to, uint256 eggType, uint256 amount)",
  "event EggBurned(address indexed from, uint256 eggType, uint256 amount)",
];

export const SKIN_NFT_ABI = [
  "function mint(address to, uint256 skinType, uint256 amount, string memory skinName) external",
  "function mintBatch(address to, uint256[] memory skinTypes, uint256[] memory amounts, string[] memory skinNames) external",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) external",
  "function uri(uint256 tokenId) external view returns (string memory)",
  "function getSkinName(uint256 skinType) external view returns (string memory)",
  "function getSkinRarity(uint256 skinType) external pure returns (string memory)",
  "event SkinMinted(address indexed to, uint256 skinType, uint256 amount, string skinName)",
];

export const TECHNIQUE_NFT_ABI = [
  "function mint(address to, string memory name, string memory effect, uint256 level, string memory rarity) external returns (uint256)",
  "function mintBatch(address to, string[] memory names, string[] memory effects, uint256[] memory levels, string[] memory rarities) external returns (uint256[] memory)",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) external",
  "function uri(uint256 tokenId) external view returns (string memory)",
  "function getTechniqueInfo(uint256 tokenId) external view returns ((string name, string effect, uint256 level, string rarity))",
  "function getTechniqueRarity(uint256 tokenId) external view returns (string memory)",
  "event TechniqueMinted(address indexed to, uint256 tokenId, (string name, string effect, uint256 level, string rarity) info)",
];

export const MARKETPLACE_ABI = [
  "function listItem(address nftContract, uint8 itemType, uint256 tokenId, uint256 amount, uint256 price) external",
  "function cancelListing(uint256 listingId) external",
  "function buyItem(uint256 listingId) external payable",
  "function getListing(uint256 listingId) external view returns ((address seller, address nftContract, uint8 itemType, uint256 tokenId, uint256 amount, uint256 price, bool active))",
  "function getListingByToken(address nftContract, uint256 tokenId) external view returns ((address seller, address nftContract, uint8 itemType, uint256 tokenId, uint256 amount, uint256 price, bool active))",
  "function getActiveListings() external view returns ((address seller, address nftContract, uint8 itemType, uint256 tokenId, uint256 amount, uint256 price, bool active)[] memory)",
  "function getTotalListings() external view returns (uint256)",
  "function platformFee() external view returns (uint256)",
  "function platformWallet() external view returns (address)",
  "event ItemListed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint8 itemType, uint256 tokenId, uint256 amount, uint256 price)",
  "event ItemSold(uint256 indexed listingId, address indexed seller, address indexed buyer, address nftContract, uint8 itemType, uint256 tokenId, uint256 amount, uint256 price)",
  "event ListingCancelled(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId)",
];

// Marketplace Item Types
export const ITEM_TYPES = {
  PET: 0,
  EGG: 1,
  SKIN: 2,
  TECHNIQUE: 3,
};

// Egg Types
export const EGG_TYPES = {
  BASIC_EGG: 1,
  COSMETIC_EGG: 2,
  ATTRIBUTE_EGG: 3,
};

// Skin Types
export const SKIN_TYPES = {
  MYTHIC_SKIN: 1,
  LEGENDARY_SKIN: 2,
  EPIC_SKIN: 3,
  CLASSIC_SKIN: 4,
};

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

      // Initialize all contracts
      const contractsConfig = [
        {
          key: "petNFT",
          address: config.CONTRACT_PET_NFT,
          abi: PET_NFT_ABI,
          name: "PetNFT",
        },
        {
          key: "eggNFT",
          address: config.CONTRACT_EGG_NFT,
          abi: EGG_NFT_ABI,
          name: "EggNFT",
        },
        {
          key: "skinNFT",
          address: config.CONTRACT_SKIN_NFT,
          abi: SKIN_NFT_ABI,
          name: "SkinNFT",
        },
        {
          key: "techniqueNFT",
          address: config.CONTRACT_TECHNIQUE_NFT,
          abi: TECHNIQUE_NFT_ABI,
          name: "TechniqueNFT",
        },
        {
          key: "marketplace",
          address: config.CONTRACT_MARKETPLACE,
          abi: MARKETPLACE_ABI,
          name: "Marketplace",
        },
      ];

      for (const { key, address, abi, name } of contractsConfig) {
        const validatedAddr = this.validateAddress(address, name);
        if (validatedAddr) {
          this.contracts[key] = {
            ethereum: new ethers.Contract(
              validatedAddr,
              abi,
              this.providers.ethereum
            ),
            polygon: new ethers.Contract(
              validatedAddr,
              abi,
              this.providers.polygon
            ),
          };
        }
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

  // --- PET METHODS ---
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
          tokenURI: "https://api.petverse.game/pets/1",
          metadata: {
            name: "Mock Pet",
            petType: "Dragon",
            rarity: "Rare",
            level: 1,
            isShiny: false,
          },
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
        const metadata = await contract.getPetMetadata(tokenId);

        pets.push({
          tokenId: tokenId.toString(),
          tokenURI,
          metadata: {
            name: metadata.name,
            petType: metadata.petType,
            rarity: metadata.rarity,
            level: metadata.level,
            isShiny: metadata.isShiny,
          },
          network,
        });
      }

      return pets;
    } catch (error) {
      logger.error("Error getting owned pets:", error);
      return [];
    }
  }

  async getPetMetadata(tokenId, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return {
        name: "Mock Pet",
        petType: "Dragon",
        rarity: "Rare",
        level: 1,
        isShiny: false,
      };
    }

    try {
      const contract = this.contracts.petNFT?.[network];
      if (!contract)
        throw new Error(`Pet NFT contract not configured for ${network}`);

      const metadata = await contract.getPetMetadata(tokenId);
      return {
        name: metadata.name,
        petType: metadata.petType,
        rarity: metadata.rarity,
        level: metadata.level,
        isShiny: metadata.isShiny,
      };
    } catch (error) {
      logger.error("Error getting pet metadata:", error);
      return null;
    }
  }

  async levelUpPet(tokenId, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return { success: true, newLevel: 2 };
    }

    try {
      const contract = this.contracts.petNFT?.[network];
      if (!contract)
        throw new Error(`Pet NFT contract not configured for ${network}`);

      const tx = await contract.levelUp(tokenId);
      await tx.wait();

      const newMetadata = await contract.getPetMetadata(tokenId);
      return { success: true, newLevel: newMetadata.level };
    } catch (error) {
      logger.error("Error leveling up pet:", error);
      return { success: false, error: error.message };
    }
  }

  // --- EGG METHODS ---
  async getOwnedEggs(walletAddress, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return [
        { eggType: EGG_TYPES.BASIC_EGG, amount: 2, name: "Basic Egg" },
        { eggType: EGG_TYPES.COSMETIC_EGG, amount: 1, name: "Cosmetic Egg" },
      ];
    }

    try {
      const contract = this.contracts.eggNFT?.[network];
      if (!contract)
        throw new Error(`Egg NFT contract not configured for ${network}`);

      const eggTypes = [
        EGG_TYPES.BASIC_EGG,
        EGG_TYPES.COSMETIC_EGG,
        EGG_TYPES.ATTRIBUTE_EGG,
      ];
      const balances = await contract.balanceOfBatch(
        Array(eggTypes.length).fill(walletAddress),
        eggTypes
      );

      const eggs = [];
      for (let i = 0; i < eggTypes.length; i++) {
        if (balances[i] > 0) {
          const name = await contract.getEggTypeName(eggTypes[i]);
          eggs.push({
            eggType: eggTypes[i],
            amount: balances[i].toString(),
            name,
          });
        }
      }

      return eggs;
    } catch (error) {
      logger.error("Error getting owned eggs:", error);
      return [];
    }
  }

  // --- SKIN METHODS ---
  async getOwnedSkins(walletAddress, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return [
        { skinType: SKIN_TYPES.CLASSIC_SKIN, amount: 3, name: "Classic Skin" },
        { skinType: SKIN_TYPES.EPIC_SKIN, amount: 1, name: "Epic Skin" },
      ];
    }

    try {
      const contract = this.contracts.skinNFT?.[network];
      if (!contract)
        throw new Error(`Skin NFT contract not configured for ${network}`);

      const skinTypes = [
        SKIN_TYPES.MYTHIC_SKIN,
        SKIN_TYPES.LEGENDARY_SKIN,
        SKIN_TYPES.EPIC_SKIN,
        SKIN_TYPES.CLASSIC_SKIN,
      ];
      const balances = await contract.balanceOfBatch(
        Array(skinTypes.length).fill(walletAddress),
        skinTypes
      );

      const skins = [];
      for (let i = 0; i < skinTypes.length; i++) {
        if (balances[i] > 0) {
          const name = await contract.getSkinName(skinTypes[i]);
          const rarity = await contract.getSkinRarity(skinTypes[i]);
          skins.push({
            skinType: skinTypes[i],
            amount: balances[i].toString(),
            name,
            rarity,
          });
        }
      }

      return skins;
    } catch (error) {
      logger.error("Error getting owned skins:", error);
      return [];
    }
  }

  // --- TECHNIQUE METHODS ---
  async getOwnedTechniques(walletAddress, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return [
        {
          tokenId: "1",
          amount: 1,
          info: {
            name: "Fire Ball",
            effect: "Deals fire damage",
            level: 1,
            rarity: "Common",
          },
        },
      ];
    }

    try {
      const contract = this.contracts.techniqueNFT?.[network];
      if (!contract)
        throw new Error(`Technique NFT contract not configured for ${network}`);

      // Note: This is simplified - you might need to track owned token IDs differently
      // since ERC1155 doesn't have an easy way to enumerate owned tokens
      const balance = await contract.balanceOf(walletAddress, 1); // Example for tokenId 1
      if (balance > 0) {
        const info = await contract.getTechniqueInfo(1);
        return [
          {
            tokenId: "1",
            amount: balance.toString(),
            info: {
              name: info.name,
              effect: info.effect,
              level: info.level,
              rarity: info.rarity,
            },
          },
        ];
      }

      return [];
    } catch (error) {
      logger.error("Error getting owned techniques:", error);
      return [];
    }
  }

  // --- MARKETPLACE METHODS ---
  async getListing(listingId, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return {
        seller: "0x000000000000000000000000000000000000dEaD",
        nftContract: config.CONTRACT_PET_NFT,
        itemType: ITEM_TYPES.PET,
        tokenId: "1",
        amount: "1",
        price: "0.05",
        active: true,
      };
    }

    try {
      const contract = this.contracts.marketplace?.[network];
      if (!contract)
        throw new Error(`Marketplace contract not configured for ${network}`);

      const listing = await contract.getListing(listingId);
      return {
        seller: listing.seller,
        nftContract: listing.nftContract,
        itemType: listing.itemType,
        tokenId: listing.tokenId.toString(),
        amount: listing.amount.toString(),
        price: ethers.formatEther(listing.price),
        active: listing.active,
      };
    } catch (error) {
      logger.error("Error getting listing:", error);
      return null;
    }
  }

  async getActiveListings(network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return [
        {
          listingId: "1",
          seller: "0x000000000000000000000000000000000000dEaD",
          nftContract: config.CONTRACT_PET_NFT,
          itemType: ITEM_TYPES.PET,
          tokenId: "1",
          amount: "1",
          price: "0.05",
          active: true,
        },
      ];
    }

    try {
      const contract = this.contracts.marketplace?.[network];
      if (!contract)
        throw new Error(`Marketplace contract not configured for ${network}`);

      const listings = await contract.getActiveListings();
      return listings.map((listing, index) => ({
        listingId: (index + 1).toString(),
        seller: listing.seller,
        nftContract: listing.nftContract,
        itemType: listing.itemType,
        tokenId: listing.tokenId.toString(),
        amount: listing.amount.toString(),
        price: ethers.formatEther(listing.price),
        active: listing.active,
      }));
    } catch (error) {
      logger.error("Error getting active listings:", error);
      return [];
    }
  }

  async listItem(
    nftContract,
    itemType,
    tokenId,
    amount,
    price,
    network = "polygon"
  ) {
    if (this.isMockMode) {
      await this.mockDelay();
      return { success: true, listingId: "1" };
    }

    try {
      const contract = this.contracts.marketplace?.[network];
      if (!contract)
        throw new Error(`Marketplace contract not configured for ${network}`);

      const priceInWei = ethers.parseEther(price.toString());
      const tx = await contract.listItem(
        nftContract,
        itemType,
        tokenId,
        amount,
        priceInWei
      );
      const receipt = await tx.wait();

      // Extract listing ID from event
      const event = receipt.events?.find((e) => e.event === "ItemListed");
      const listingId = event?.args?.listingId?.toString();

      return { success: true, listingId };
    } catch (error) {
      logger.error("Error listing item:", error);
      return { success: false, error: error.message };
    }
  }

  async buyItem(listingId, price, network = "polygon") {
    if (this.isMockMode) {
      await this.mockDelay();
      return { success: true };
    }

    try {
      const contract = this.contracts.marketplace?.[network];
      if (!contract)
        throw new Error(`Marketplace contract not configured for ${network}`);

      const priceInWei = ethers.parseEther(price.toString());
      const tx = await contract.buyItem(listingId, { value: priceInWei });
      await tx.wait();

      return { success: true };
    } catch (error) {
      logger.error("Error buying item:", error);
      return { success: false, error: error.message };
    }
  }
}

export const blockchainService = new BlockchainService();
export default blockchainService;
