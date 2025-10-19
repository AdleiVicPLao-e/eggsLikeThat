// client/src/hooks/useWallet.jsx
import { useState, useEffect } from "react";
import { gameAPI } from "../services/api";
import { useBlockchain } from "./useBlockchain";

export const useWallet = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Use blockchain hook for wallet connection and contract interactions
  const {
    account,
    isConnected,
    isLoading: blockchainLoading,
    error: blockchainError,
    connectWallet,
    switchNetwork,
    getContract,
    provider,
    signer,
    clearError: clearBlockchainError,
  } = useBlockchain();

  // Sync errors between hooks
  useEffect(() => {
    if (blockchainError) {
      setError(blockchainError);
    }
  }, [blockchainError]);

  // Check if user is already logged in on mount
  useEffect(() => {
    checkExistingSession();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = localStorage.getItem("petverse_token");
      if (token) {
        const response = await gameAPI.auth.getProfile();
        setUserProfile(response.data);
      }
    } catch (error) {
      // Token might be expired, clear it
      localStorage.removeItem("petverse_token");
      localStorage.removeItem("petverse_user");
    }
  };

  const connect = async () => {
    setIsConnecting(true);
    setError(null);
    clearBlockchainError();

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      // Use blockchain hook's connect function
      const connected = await connectWallet();

      if (!connected) {
        throw new Error("Failed to connect wallet");
      }

      // Sign message to verify ownership
      const message = `Welcome to PetVerse! Please sign this message to verify your wallet ownership. Address: ${account}`;
      const signature = await signMessage(message);

      return {
        success: true,
        address: account,
        signature,
        message,
      };
    } catch (error) {
      setError(error.message);
      console.error("Wallet connection error:", error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setIsConnecting(false);
    }
  };

  const registerWithWallet = async (userData = {}) => {
    try {
      if (!account) {
        throw new Error("No wallet connected");
      }

      const connectionResult = await connect();
      if (!connectionResult.success) {
        throw new Error(connectionResult.error);
      }

      const { address, signature, message } = connectionResult;

      const registerData = {
        walletAddress: address,
        signature,
        message,
        ...userData,
      };

      const response = await gameAPI.auth.walletRegister(registerData);

      if (response.data.token) {
        localStorage.setItem("petverse_token", response.data.token);
        localStorage.setItem(
          "petverse_user",
          JSON.stringify(response.data.user)
        );
        setUserProfile(response.data.user);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const loginWithWallet = async () => {
    try {
      if (!account) {
        throw new Error("No wallet connected");
      }

      const connectionResult = await connect();
      if (!connectionResult.success) {
        throw new Error(connectionResult.error);
      }

      const { address, signature, message } = connectionResult;

      const loginData = {
        walletAddress: address,
        signature,
        message,
      };

      const response = await gameAPI.auth.walletLogin(loginData);

      if (response.data.token) {
        localStorage.setItem("petverse_token", response.data.token);
        localStorage.setItem(
          "petverse_user",
          JSON.stringify(response.data.user)
        );
        setUserProfile(response.data.user);
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const connectWalletToAccount = async () => {
    try {
      if (!account) {
        throw new Error("No wallet connected");
      }

      const connectionResult = await connect();
      if (!connectionResult.success) {
        throw new Error(connectionResult.error);
      }

      const { address, signature, message } = connectionResult;

      const connectData = {
        walletAddress: address,
        signature,
        message,
      };

      const response = await gameAPI.auth.connectWallet(connectData);

      if (response.data.user) {
        setUserProfile(response.data.user);
        localStorage.setItem(
          "petverse_user",
          JSON.stringify(response.data.user)
        );
      }

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const disconnect = () => {
    setError(null);
    setUserProfile(null);
    clearBlockchainError();
    localStorage.removeItem("petverse_token");
    localStorage.removeItem("petverse_user");
    // Note: We don't disconnect the wallet from blockchain here
    // as users might want to stay connected to the blockchain but logged out of the app
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // User disconnected wallet from MetaMask
      disconnect();
    } else {
      // Account changed - check if the new account has an existing session
      checkExistingSession();
    }
  };

  const handleChainChanged = (chainId) => {
    // Reload the page when network changes
    window.location.reload();
  };

  const signMessage = async (message) => {
    if (!account || !signer) {
      throw new Error("No account connected");
    }

    try {
      // Use the signer from useBlockchain hook
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  };

  const switchToNetwork = async (chainId = "0x1") => {
    try {
      const success = await switchNetwork(parseInt(chainId, 16));
      return { success };
    } catch (error) {
      setError(`Failed to switch network: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  };

  const getWalletBalance = async () => {
    try {
      if (!account || !provider) {
        throw new Error("No account connected");
      }

      const balance = await provider.getBalance(account);

      return {
        success: true,
        balance: ethers.utils.formatEther(balance), // Convert from wei to ETH
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // Enhanced methods using blockchain hook
  const getUserNFTs = async () => {
    try {
      if (!account) {
        throw new Error("No wallet connected");
      }

      // Use blockchain hook methods
      const pets = await getUserPets();
      const eggs = await getUserEggs();

      return {
        success: true,
        pets,
        eggs,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  const listNFTOnMarketplace = async (nftType, tokenId, amount, price) => {
    try {
      if (!account) {
        throw new Error("No wallet connected");
      }

      // Map nftType to contract address and item type
      const nftContracts = {
        pet: process.env.REACT_APP_PET_NFT_CONTRACT,
        egg: process.env.REACT_APP_EGG_NFT_CONTRACT,
        skin: process.env.REACT_APP_SKIN_NFT_CONTRACT,
        technique: process.env.REACT_APP_TECHNIQUE_NFT_CONTRACT,
      };

      const itemTypes = {
        pet: 0, // PET
        egg: 1, // EGG
        skin: 2, // SKIN
        technique: 3, // TECHNIQUE
      };

      const nftContract = nftContracts[nftType];
      const itemType = itemTypes[nftType];

      if (!nftContract || itemType === undefined) {
        throw new Error(`Invalid NFT type: ${nftType}`);
      }

      const receipt = await listItem(
        nftContract,
        itemType,
        tokenId,
        amount,
        price
      );

      return {
        success: true,
        receipt,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  const buyNFTFromMarketplace = async (listingId, price) => {
    try {
      if (!account) {
        throw new Error("No wallet connected");
      }

      const receipt = await buyItem(listingId, price);

      return {
        success: true,
        receipt,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  const levelUpUserPet = async (tokenId) => {
    try {
      if (!account) {
        throw new Error("No wallet connected");
      }

      const receipt = await levelUpPet(tokenId);

      return {
        success: true,
        receipt,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  const clearError = () => {
    setError(null);
    clearBlockchainError();
  };

  return {
    // State (from useBlockchain)
    account,
    isConnected,
    isLoading: isConnecting || blockchainLoading,
    error,
    userProfile,

    // Blockchain state (exposed for convenience)
    provider,
    signer,

    // Connection methods
    connect,
    disconnect,

    // Authentication methods
    registerWithWallet,
    loginWithWallet,
    connectWalletToAccount,

    // Utility methods
    signMessage,
    switchNetwork: switchToNetwork,
    getWalletBalance,

    // Enhanced NFT methods (using useBlockchain)
    getUserNFTs,
    listNFTOnMarketplace,
    buyNFTFromMarketplace,
    levelUpUserPet,

    // Status
    isMetaMaskInstalled: !!window.ethereum,
    isLoggedIn: !!userProfile && !!localStorage.getItem("petverse_token"),

    // Error handling
    clearError,
  };
};

// Re-export useBlockchain for components that need direct blockchain access
export { useBlockchain };
