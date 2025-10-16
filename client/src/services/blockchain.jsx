import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, RPC_URLS } from "../utils/constants.jsx";

// Contract ABIs (simplified - in real implementation, import from artifacts)
const PET_NFT_ABI = [
  "function mint(address to, string memory tokenURI, uint8 tier, uint8 petType, uint16 attack, uint16 defense, uint16 speed, uint16 health) external returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId) external",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "function getPetMetadata(uint256 tokenId) external view returns (tuple(uint8 tier, uint8 petType, uint8 level, uint16 experience, uint16 attack, uint16 defense, uint16 speed, uint16 health, uint32 hatchDate, bool isFavorite))",
  "function calculatePower(uint256 tokenId) external view returns (uint256)",
  "event PetMinted(uint256 indexed tokenId, address indexed owner, uint8 tier, uint8 petType, uint16 attack, uint16 defense, uint16 speed, uint16 health)",
];

const EGG_ITEM_ABI = [
  "function mintEgg(address to, uint256 eggType, uint256 amount) external",
  "function purchaseEgg(uint256 eggType, uint256 amount) external payable",
  "function hatchEgg(uint256 eggType) external",
  "function balanceOf(address account, uint256 id) external view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external",
  "event EggMinted(address indexed to, uint256 eggType, uint256 amount)",
  "event EggHatched(address indexed owner, uint256 eggType, uint256 petTokenId)",
];

const MARKETPLACE_ABI = [
  "function listItem(uint256 tokenId, uint256 price, bool isERC1155, uint256 amount) external",
  "function purchaseItem(uint256 tokenId) external payable",
  "function cancelListing(uint256 tokenId) external",
  "function getListing(uint256 tokenId) external view returns (tuple(address seller, uint256 tokenId, uint256 price, bool isActive, uint256 listingTime, bool isERC1155, uint256 amount))",
  "event ItemListed(address indexed seller, uint256 indexed tokenId, uint256 price, bool isERC1155, uint256 amount, uint256 listingTime)",
  "event ItemSold(address indexed seller, address indexed buyer, uint256 indexed tokenId, uint256 price, uint256 saleTime)",
];

const FUSION_SYSTEM_ABI = [
  "function startFusion(uint256[] memory inputTokenIds, uint8 targetTier) external payable returns (uint256)",
  "function calculateSuccessChance(uint256[] memory inputTokenIds, uint8 targetTier) external view returns (uint256)",
  "function fusionCosts(uint8 tier) external view returns (uint256)",
  "event FusionStarted(address indexed user, uint256[] inputTokenIds, uint8 targetTier, uint256 fusionId)",
];

const GAME_TOKEN_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
];

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.isConnected = false;
  }

  // Initialize with network
  async init(networkId = 80001) {
    // Default to Mumbai
    try {
      if (window.ethereum) {
        this.provider = new ethers.BrowserProvider(window.ethereum);
        this.networkId = networkId;
      } else {
        this.provider = new ethers.JsonRpcProvider(RPC_URLS[networkId]);
        this.networkId = networkId;
      }

      await this.initContracts();
      return true;
    } catch (error) {
      console.error("Failed to initialize blockchain service:", error);
      return false;
    }
  }

  // Connect wallet
  async connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error("No Ethereum wallet found. Please install MetaMask.");
      }

      await window.ethereum.request({ method: "eth_requestAccounts" });
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.isConnected = true;

      await this.initContracts();

      const address = await this.signer.getAddress();
      const network = await this.provider.getNetwork();

      return {
        success: true,
        address,
        network: network.name,
        chainId: network.chainId,
      };
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      return { success: false, error: error.message };
    }
  }

  // Initialize contract instances
  async initContracts() {
    if (!this.provider) return;

    const signerOrProvider = this.signer || this.provider;

    this.contracts.petNFT = new ethers.Contract(
      CONTRACT_ADDRESSES.PET_NFT,
      PET_NFT_ABI,
      signerOrProvider
    );

    this.contracts.eggItem = new ethers.Contract(
      CONTRACT_ADDRESSES.EGG_ITEM,
      EGG_ITEM_ABI,
      signerOrProvider
    );

    this.contracts.marketplace = new ethers.Contract(
      CONTRACT_ADDRESSES.MARKETPLACE,
      MARKETPLACE_ABI,
      signerOrProvider
    );

    this.contracts.fusionSystem = new ethers.Contract(
      CONTRACT_ADDRESSES.FUSION_SYSTEM,
      FUSION_SYSTEM_ABI,
      signerOrProvider
    );

    this.contracts.gameToken = new ethers.Contract(
      CONTRACT_ADDRESSES.GAME_TOKEN,
      GAME_TOKEN_ABI,
      signerOrProvider
    );
  }

  // Pet NFT methods
  async mintPet(petData) {
    try {
      const { to, tokenURI, tier, petType, stats } = petData;

      const tx = await this.contracts.petNFT.mint(
        to,
        tokenURI,
        tier,
        petType,
        stats.attack,
        stats.defense,
        stats.speed,
        stats.health
      );

      const receipt = await tx.wait();
      return { success: true, receipt, transactionHash: receipt.hash };
    } catch (error) {
      console.error("Mint pet failed:", error);
      return { success: false, error: error.message };
    }
  }

  async getPetMetadata(tokenId) {
    try {
      const metadata = await this.contracts.petNFT.getPetMetadata(tokenId);
      return { success: true, metadata };
    } catch (error) {
      console.error("Get pet metadata failed:", error);
      return { success: false, error: error.message };
    }
  }

  async getOwnedPets(ownerAddress) {
    try {
      // This would need tokenOfOwnerByIndex which we don't have in our ABI
      // For now, return empty and handle via backend
      return { success: true, pets: [] };
    } catch (error) {
      console.error("Get owned pets failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Egg methods
  async purchaseEgg(eggType, amount) {
    try {
      const eggInfo = await this.contracts.eggItem.getEggInfo(eggType);
      const totalCost = eggInfo.price * BigInt(amount);

      const tx = await this.contracts.eggItem.purchaseEgg(eggType, amount, {
        value: totalCost,
      });

      const receipt = await tx.wait();
      return { success: true, receipt };
    } catch (error) {
      console.error("Purchase egg failed:", error);
      return { success: false, error: error.message };
    }
  }

  async hatchEgg(eggType) {
    try {
      const tx = await this.contracts.eggItem.hatchEgg(eggType);
      const receipt = await tx.wait();
      return { success: true, receipt };
    } catch (error) {
      console.error("Hatch egg failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Marketplace methods
  async listPet(tokenId, price, isERC1155 = false, amount = 1) {
    try {
      // First approve the marketplace to transfer the token
      if (isERC1155) {
        await this.contracts.eggItem.setApprovalForAll(
          this.contracts.marketplace.address,
          true
        );
      } else {
        await this.contracts.petNFT.setApprovalForAll(
          this.contracts.marketplace.address,
          true
        );
      }

      const tx = await this.contracts.marketplace.listItem(
        tokenId,
        price,
        isERC1155,
        amount
      );
      const receipt = await tx.wait();
      return { success: true, receipt };
    } catch (error) {
      console.error("List pet failed:", error);
      return { success: false, error: error.message };
    }
  }

  async purchaseListing(tokenId, price) {
    try {
      const tx = await this.contracts.marketplace.purchaseItem(tokenId, {
        value: price,
      });
      const receipt = await tx.wait();
      return { success: true, receipt };
    } catch (error) {
      console.error("Purchase listing failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Fusion methods
  async startFusion(inputTokenIds, targetTier) {
    try {
      // Approve fusion system to transfer pets
      await this.contracts.petNFT.setApprovalForAll(
        this.contracts.fusionSystem.address,
        true
      );

      const cost = await this.contracts.fusionSystem.fusionCosts(targetTier);

      const tx = await this.contracts.fusionSystem.startFusion(
        inputTokenIds,
        targetTier,
        {
          value: cost,
        }
      );

      const receipt = await tx.wait();
      return {
        success: true,
        receipt,
        fusionId: receipt.logs[0]?.args?.fusionId,
      };
    } catch (error) {
      console.error("Start fusion failed:", error);
      return { success: false, error: error.message };
    }
  }

  async calculateFusionSuccess(inputTokenIds, targetTier) {
    try {
      const successChance =
        await this.contracts.fusionSystem.calculateSuccessChance(
          inputTokenIds,
          targetTier
        );
      return { success: true, successChance: Number(successChance) / 100 };
    } catch (error) {
      console.error("Calculate fusion success failed:", error);
      return { success: false, error: error.message };
    }
  }

  // Utility methods
  async getBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("Get balance failed:", error);
      return "0";
    }
  }

  async getTokenBalance(address, tokenAddress = CONTRACT_ADDRESSES.GAME_TOKEN) {
    try {
      const balance = await this.contracts.gameToken.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("Get token balance failed:", error);
      return "0";
    }
  }

  async getNetwork() {
    try {
      if (!this.provider) return null;
      return await this.provider.getNetwork();
    } catch (error) {
      console.error("Get network failed:", error);
      return null;
    }
  }

  // Event listeners
  onPetMinted(callback) {
    this.contracts.petNFT.on("PetMinted", callback);
  }

  onEggHatched(callback) {
    this.contracts.eggItem.on("EggHatched", callback);
  }

  onItemListed(callback) {
    this.contracts.marketplace.on("ItemListed", callback);
  }

  onItemSold(callback) {
    this.contracts.marketplace.on("ItemSold", callback);
  }

  // Remove event listeners
  removeAllListeners() {
    this.contracts.petNFT.removeAllListeners();
    this.contracts.eggItem.removeAllListeners();
    this.contracts.marketplace.removeAllListeners();
    this.contracts.fusionSystem.removeAllListeners();
  }
}

// Create singleton instance
export const blockchainService = new BlockchainService();
export default blockchainService;
