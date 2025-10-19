// client/src/hooks/useBlockchain.jsx
import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";

// Import ABIs
import PetNFTABI from "../abis/PetNFT.json";
import EggNFTABI from "../abis/EggNFT.json";
import SkinNFTABI from "../abis/SkinNFT.json";
import TechniqueNFTABI from "../abis/TechniqueNFT.json";
import MarketplaceABI from "../abis/Marketplace.json";

// Contract configuration
const CONTRACT_CONFIG = {
  PetNFT: {
    address: import.meta.env.REACT_APP_PET_NFT_CONTRACT,
    abi: PetNFTABI.abi,
  },
  EggNFT: {
    address: import.meta.env.REACT_APP_EGG_NFT_CONTRACT,
    abi: EggNFTABI.abi,
  },
  SkinNFT: {
    address: import.meta.env.REACT_APP_SKIN_NFT_CONTRACT,
    abi: SkinNFTABI.abi,
  },
  TechniqueNFT: {
    address: import.meta.env.REACT_APP_TECHNIQUE_NFT_CONTRACT,
    abi: TechniqueNFTABI.abi,
  },
  Marketplace: {
    address: import.meta.env.REACT_APP_MARKETPLACE_CONTRACT,
    abi: MarketplaceABI.abi,
  },
};

// Network configuration
const NETWORK_CONFIG = {
  31337: {
    // Localhost
    name: "localhost",
    rpcUrl: "http://localhost:8545",
  },
  11155111: {
    // Sepolia
    name: "sepolia",
    rpcUrl: import.meta.env.VITE_ETH_SEPOLIA_RPC_URL,
  },
  80002: {
    // Polygon Amoy
    name: "polygon-amoy",
    rpcUrl: import.meta.env.VITE_POLYGON_AMOY_RPC_URL,
  },
};

export const useBlockchain = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize provider
  useEffect(() => {
    const initProvider = async () => {
      if (window.ethereum) {
        try {
          const web3Provider = new ethers.providers.Web3Provider(
            window.ethereum
          );
          setProvider(web3Provider);

          // Get current network
          const network = await web3Provider.getNetwork();
          setChainId(network.chainId);

          // Check if connected
          const accounts = await web3Provider.listAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setSigner(web3Provider.getSigner());
            setIsConnected(true);
          }
        } catch (err) {
          console.error("Error initializing provider:", err);
          setError("Failed to connect to blockchain");
        }
      } else {
        setError("MetaMask not detected. Please install MetaMask.");
      }
    };

    initProvider();
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not detected");
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      await window.ethereum.request({ method: "eth_requestAccounts" });
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const accounts = await web3Provider.listAccounts();

      if (accounts.length > 0) {
        setProvider(web3Provider);
        setSigner(web3Provider.getSigner());
        setAccount(accounts[0]);
        setIsConnected(true);

        const network = await web3Provider.getNetwork();
        setChainId(network.chainId);

        return true;
      }
      return false;
    } catch (err) {
      console.error("Error connecting wallet:", err);
      setError("Failed to connect wallet");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Switch network
  const switchNetwork = useCallback(async (targetChainId) => {
    if (!window.ethereum) return false;

    try {
      setIsLoading(true);

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });

      // Refresh provider
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(web3Provider);
      setSigner(web3Provider.getSigner());

      const network = await web3Provider.getNetwork();
      setChainId(network.chainId);

      return true;
    } catch (err) {
      console.error("Error switching network:", err);
      setError("Failed to switch network");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get contract instance
  const getContract = useCallback(
    (contractName, withSigner = false) => {
      if (!provider) {
        throw new Error("Provider not initialized");
      }

      const contractConfig = CONTRACT_CONFIG[contractName];
      if (!contractConfig) {
        throw new Error(`Unknown contract: ${contractName}`);
      }

      const contractProvider = withSigner && signer ? signer : provider;
      return new ethers.Contract(
        contractConfig.address,
        contractConfig.abi,
        contractProvider
      );
    },
    [provider, signer]
  );

  // Get user's pets
  const getUserPets = useCallback(async () => {
    if (!account) return [];

    try {
      const petContract = getContract("PetNFT", true);
      const balance = await petContract.balanceOf(account);

      const pets = [];
      for (let i = 0; i < balance.toNumber(); i++) {
        const tokenId = await petContract.tokenOfOwnerByIndex(account, i);
        const metadata = await petContract.getPetMetadata(tokenId);
        const tokenURI = await petContract.tokenURI(tokenId);

        pets.push({
          tokenId: tokenId.toString(),
          ...metadata,
          tokenURI,
        });
      }

      return pets;
    } catch (err) {
      console.error("Error fetching pets:", err);
      setError("Failed to fetch pets");
      return [];
    }
  }, [account, getContract]);

  // Get user's eggs
  const getUserEggs = useCallback(async () => {
    if (!account) return [];

    try {
      const eggContract = getContract("EggNFT", true);

      const eggTypes = [1, 2, 3]; // BASIC, COSMETIC, ATTRIBUTE
      const eggs = [];

      for (const eggType of eggTypes) {
        const balance = await eggContract.balanceOf(account, eggType);
        if (balance.gt(0)) {
          const eggName = await eggContract.getEggTypeName(eggType);
          eggs.push({
            type: eggType,
            name: eggName,
            balance: balance.toString(),
            tokenURI: await eggContract.uri(eggType),
          });
        }
      }

      return eggs;
    } catch (err) {
      console.error("Error fetching eggs:", err);
      setError("Failed to fetch eggs");
      return [];
    }
  }, [account, getContract]);

  // List item on marketplace
  const listItem = useCallback(
    async (nftContract, itemType, tokenId, amount, price) => {
      if (!signer) {
        throw new Error("Wallet not connected");
      }

      try {
        setIsLoading(true);

        const marketplace = getContract("Marketplace", true);
        const tx = await marketplace.listItem(
          nftContract,
          itemType,
          tokenId,
          amount,
          ethers.utils.parseEther(price.toString())
        );

        const receipt = await tx.wait();
        return receipt;
      } catch (err) {
        console.error("Error listing item:", err);
        setError("Failed to list item");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [signer, getContract]
  );

  // Buy item from marketplace
  const buyItem = useCallback(
    async (listingId, price) => {
      if (!signer) {
        throw new Error("Wallet not connected");
      }

      try {
        setIsLoading(true);

        const marketplace = getContract("Marketplace", true);
        const tx = await marketplace.buyItem(listingId, {
          value: ethers.utils.parseEther(price.toString()),
        });

        const receipt = await tx.wait();
        return receipt;
      } catch (err) {
        console.error("Error buying item:", err);
        setError("Failed to buy item");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [signer, getContract]
  );

  // Get marketplace listings
  const getMarketplaceListings = useCallback(async () => {
    try {
      const marketplace = getContract("Marketplace");
      const listings = await marketplace.getActiveListings();

      return listings.map((listing) => ({
        listingId: listing.listingId.toString(),
        seller: listing.seller,
        nftContract: listing.nftContract,
        itemType: listing.itemType,
        tokenId: listing.tokenId.toString(),
        amount: listing.amount.toString(),
        price: ethers.utils.formatEther(listing.price),
        active: listing.active,
      }));
    } catch (err) {
      console.error("Error fetching listings:", err);
      setError("Failed to fetch marketplace listings");
      return [];
    }
  }, [getContract]);

  // Level up pet
  const levelUpPet = useCallback(
    async (tokenId) => {
      if (!signer) {
        throw new Error("Wallet not connected");
      }

      try {
        setIsLoading(true);

        const petContract = getContract("PetNFT", true);
        const tx = await petContract.levelUp(tokenId);

        const receipt = await tx.wait();
        return receipt;
      } catch (err) {
        console.error("Error leveling up pet:", err);
        setError("Failed to level up pet");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [signer, getContract]
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    provider,
    signer,
    account,
    chainId,
    isConnected,
    isLoading,
    error,

    // Network
    networkConfig: NETWORK_CONFIG[chainId] || { name: "unknown" },

    // Methods
    connectWallet,
    switchNetwork,
    getContract,
    getUserPets,
    getUserEggs,
    listItem,
    buyItem,
    getMarketplaceListings,
    levelUpPet,
    clearError,
  };
};

// Export contract addresses for direct use
export const CONTRACT_ADDRESSES = {
  PetNFT: import.meta.env.VITE_PET_NFT_CONTRACT,
  EggNFT: import.meta.env.VITE_EGG_NFT_CONTRACT,
  SkinNFT: import.meta.env.VITE_SKIN_NFT_CONTRACT,
  TechniqueNFT: import.meta.env.VITE_TECHNIQUE_NFT_CONTRACT,
  Marketplace: import.meta.env.VITE_MARKETPLACE_CONTRACT,
};

// Export base URIs for metadata
export const BASE_URIS = {
  pets: import.meta.env.VITE_PETS_BASE_URI,
  eggs: import.meta.env.VITE_EGGS_BASE_URI,
  skins: import.meta.env.VITE_SKINS_BASE_URI,
  techniques: import.meta.env.VITE_TECHNIQUES_BASE_URI,
};
