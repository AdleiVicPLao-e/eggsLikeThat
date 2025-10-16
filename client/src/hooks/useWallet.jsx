import { useState, useEffect, useCallback } from "react";
import { blockchainService } from "../services/blockchain.jsx";
import { useGame } from "../context/GameContext.jsx";

export const useWallet = () => {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [network, setNetwork] = useState(null);

  const { updateUser } = useGame();

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
      blockchainService.removeAllListeners();
    };
  }, []);

  const checkConnection = async () => {
    try {
      if (window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_accounts",
        });

        if (accounts.length > 0) {
          const address = accounts[0];
          setAccount(address);
          await updateBalance(address);
          await updateNetwork();

          // Initialize blockchain service
          await blockchainService.init();
          const signer = await blockchainService.provider.getSigner();
          blockchainService.signer = signer;
          blockchainService.isConnected = true;

          // Update user context
          updateUser({ walletAddress: address, isGuest: false });
        }
      }
    } catch (error) {
      console.error("Error checking wallet connection:", error);
    }
  };

  const connect = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await blockchainService.connectWallet();

      if (result.success) {
        setAccount(result.address);
        await updateBalance(result.address);
        await updateNetwork();

        // Update user context
        updateUser({
          walletAddress: result.address,
          isGuest: false,
          network: result.network,
        });

        // Store connection in localStorage
        localStorage.setItem("petverse_wallet_connected", "true");
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAccount(null);
    setBalance("0");
    setNetwork(null);
    setError(null);

    blockchainService.isConnected = false;
    blockchainService.signer = null;

    // Update user context
    updateUser({ walletAddress: null, isGuest: true });

    // Remove from localStorage
    localStorage.removeItem("petverse_wallet_connected");
  };

  const updateBalance = async (address) => {
    try {
      const bal = await blockchainService.getBalance(address);
      setBalance(bal);
    } catch (error) {
      console.error("Error updating balance:", error);
    }
  };

  const updateNetwork = async () => {
    try {
      const net = await blockchainService.getNetwork();
      setNetwork(net);
    } catch (error) {
      console.error("Error updating network:", error);
    }
  };

  const switchNetwork = async (chainId) => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error) {
      console.error("Error switching network:", error);

      // If network not added, try to add it
      if (error.code === 4902) {
        try {
          await addNetwork(chainId);
        } catch (addError) {
          throw new Error(`Failed to add network: ${addError.message}`);
        }
      }

      throw error;
    }
  };

  const addNetwork = async (chainId) => {
    const networkConfigs = {
      137: {
        chainId: "0x89",
        chainName: "Polygon Mainnet",
        nativeCurrency: {
          name: "MATIC",
          symbol: "MATIC",
          decimals: 18,
        },
        rpcUrls: ["https://polygon-rpc.com/"],
        blockExplorerUrls: ["https://polygonscan.com/"],
      },
      80001: {
        chainId: "0x13881",
        chainName: "Polygon Mumbai Testnet",
        nativeCurrency: {
          name: "MATIC",
          symbol: "MATIC",
          decimals: 18,
        },
        rpcUrls: ["https://rpc-mumbai.maticvigil.com/"],
        blockExplorerUrls: ["https://mumbai.polygonscan.com/"],
      },
    };

    const config = networkConfigs[chainId];
    if (!config) {
      throw new Error(`Unsupported network: ${chainId}`);
    }

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [config],
    });
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // User disconnected wallet
      disconnect();
    } else {
      setAccount(accounts[0]);
      updateBalance(accounts[0]);
      updateUser({ walletAddress: accounts[0] });
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

  return {
    account,
    balance,
    network,
    isConnecting,
    error,
    connect,
    disconnect,
    switchNetwork,
    updateBalance,
    signMessage,
    isConnected: !!account,
    blockchainService,
  };
};
