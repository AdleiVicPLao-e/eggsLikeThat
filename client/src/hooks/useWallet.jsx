// client/src/hooks/useWallet.jsx
import { useState, useEffect } from "react";
import { gameAPI } from "../services/api.js";

export const useWallet = () => {
  const [account, setAccount] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Check if wallet is connected on mount
  useEffect(() => {
    checkConnection();

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

  const checkConnection = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });

        if (accounts.length > 0) {
          setAccount(accounts[0]);
          // Check if user is already logged in with this wallet
          await checkExistingSession();
        }
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error);
    }
  };

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

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length === 0) {
        throw new Error("No accounts found");
      }

      const address = accounts[0];
      setAccount(address);

      // Sign message to verify ownership
      const message = `Welcome to PetVerse! Please sign this message to verify your wallet ownership. Address: ${address}`;
      const signature = await signMessage(message);

      return {
        success: true,
        address,
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
    setAccount(null);
    setError(null);
    setUserProfile(null);
    localStorage.removeItem("petverse_token");
    localStorage.removeItem("petverse_user");
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // User disconnected wallet
      disconnect();
    } else {
      setAccount(accounts[0]);
      // Check if the new account has an existing session
      checkExistingSession();
    }
  };

  const handleChainChanged = (chainId) => {
    // Reload the page when network changes
    window.location.reload();
  };

  const signMessage = async (message) => {
    if (!account) {
      throw new Error("No account connected");
    }

    try {
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, account],
      });
      return signature;
    } catch (error) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  };

  const switchNetwork = async (chainId = "0x1") => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainId }],
      });
      return { success: true };
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
      if (!account) {
        throw new Error("No account connected");
      }

      const balance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [account, "latest"],
      });

      return {
        success: true,
        balance: parseInt(balance, 16) / 1e18, // Convert from wei to ETH
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  return {
    // State
    account,
    isConnecting,
    error,
    userProfile,

    // Connection methods
    connect,
    disconnect,

    // Authentication methods
    registerWithWallet,
    loginWithWallet,
    connectWalletToAccount,

    // Utility methods
    signMessage,
    switchNetwork,
    getWalletBalance,

    // Status
    isConnected: !!account,
    isMetaMaskInstalled: !!window.ethereum,
    isLoggedIn: !!userProfile && !!localStorage.getItem("petverse_token"),
  };
};
