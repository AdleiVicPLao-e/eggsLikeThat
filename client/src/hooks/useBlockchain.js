import { useState, useCallback } from "react";
import { blockchainService } from "../services/blockchain.js";
import { useGame } from "../context/GameContext.js";

export const useBlockchain = () => {
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState(null);
  const [transactionSuccess, setTransactionSuccess] = useState(null);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const { updateUser, syncBlockchainData } = useGame();

  const executeTransaction = useCallback(
    async (transactionCall, ...args) => {
      setTransactionLoading(true);
      setTransactionError(null);
      setTransactionSuccess(null);

      const transactionId = Date.now().toString();
      setPendingTransactions((prev) => [...prev, transactionId]);

      try {
        const result = await transactionCall(...args);

        if (result.success) {
          setTransactionSuccess("Transaction completed successfully!");

          // Sync data after successful transaction
          await syncBlockchainData();

          return result;
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        const errorMessage = error.message || "Transaction failed";
        setTransactionError(errorMessage);
        throw error;
      } finally {
        setTransactionLoading(false);
        setPendingTransactions((prev) =>
          prev.filter((id) => id !== transactionId)
        );
      }
    },
    [syncBlockchainData]
  );

  // Pet NFT methods
  const mintPet = useCallback(
    (petData) =>
      executeTransaction(
        blockchainService.mintPet.bind(blockchainService),
        petData
      ),
    [executeTransaction]
  );

  const getPetMetadata = useCallback(
    (tokenId) =>
      executeTransaction(
        blockchainService.getPetMetadata.bind(blockchainService),
        tokenId
      ),
    [executeTransaction]
  );

  const getOwnedPets = useCallback(
    (ownerAddress) =>
      executeTransaction(
        blockchainService.getOwnedPets.bind(blockchainService),
        ownerAddress
      ),
    [executeTransaction]
  );

  // Egg methods
  const purchaseEgg = useCallback(
    (eggType, amount) =>
      executeTransaction(
        blockchainService.purchaseEgg.bind(blockchainService),
        eggType,
        amount
      ),
    [executeTransaction]
  );

  const hatchEgg = useCallback(
    (eggType) =>
      executeTransaction(
        blockchainService.hatchEgg.bind(blockchainService),
        eggType
      ),
    [executeTransaction]
  );

  // Marketplace methods
  const listPet = useCallback(
    (tokenId, price, isERC1155 = false, amount = 1) =>
      executeTransaction(
        blockchainService.listPet.bind(blockchainService),
        tokenId,
        price,
        isERC1155,
        amount
      ),
    [executeTransaction]
  );

  const purchaseListing = useCallback(
    (tokenId, price) =>
      executeTransaction(
        blockchainService.purchaseListing.bind(blockchainService),
        tokenId,
        price
      ),
    [executeTransaction]
  );

  // Fusion methods
  const startFusion = useCallback(
    (inputTokenIds, targetTier) =>
      executeTransaction(
        blockchainService.startFusion.bind(blockchainService),
        inputTokenIds,
        targetTier
      ),
    [executeTransaction]
  );

  const calculateFusionSuccess = useCallback(
    (inputTokenIds, targetTier) =>
      executeTransaction(
        blockchainService.calculateFusionSuccess.bind(blockchainService),
        inputTokenIds,
        targetTier
      ),
    [executeTransaction]
  );

  // Utility methods
  const getBalance = useCallback(async (address) => {
    try {
      const balance = await blockchainService.getBalance(address);
      return { success: true, balance };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  const getTokenBalance = useCallback(async (tokenAddress) => {
    try {
      const balance = await blockchainService.getTokenBalance(tokenAddress);
      return { success: true, balance };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Event listeners setup
  const setupEventListeners = useCallback(() => {
    blockchainService.onPetMinted(
      (tokenId, owner, tier, petType, attack, defense, speed, health) => {
        console.log("Pet minted:", { tokenId, owner, tier, petType });
        // Update local state or trigger refresh
        syncBlockchainData();
      }
    );

    blockchainService.onEggHatched((owner, eggType, petTokenId) => {
      console.log("Egg hatched:", { owner, eggType, petTokenId });
      syncBlockchainData();
    });

    blockchainService.onItemListed(
      (seller, tokenId, price, isERC1155, amount) => {
        console.log("Item listed:", { seller, tokenId, price });
        syncBlockchainData();
      }
    );

    blockchainService.onItemSold((seller, buyer, tokenId, price) => {
      console.log("Item sold:", { seller, buyer, tokenId, price });
      syncBlockchainData();
    });
  }, [syncBlockchainData]);

  const removeEventListeners = useCallback(() => {
    blockchainService.removeAllListeners();
  }, []);

  const clearMessages = useCallback(() => {
    setTransactionError(null);
    setTransactionSuccess(null);
  }, []);

  const getTransactionStatus = useCallback(() => {
    return {
      loading: transactionLoading,
      error: transactionError,
      success: transactionSuccess,
      pending: pendingTransactions.length > 0,
    };
  }, [
    transactionLoading,
    transactionError,
    transactionSuccess,
    pendingTransactions,
  ]);

  return {
    // Transaction state
    transactionLoading,
    transactionError,
    transactionSuccess,
    pendingTransactions,
    getTransactionStatus,

    // Actions
    clearMessages,
    setupEventListeners,
    removeEventListeners,

    // Pet NFT methods
    mintPet,
    getPetMetadata,
    getOwnedPets,

    // Egg methods
    purchaseEgg,
    hatchEgg,

    // Marketplace methods
    listPet,
    purchaseListing,

    // Fusion methods
    startFusion,
    calculateFusionSuccess,

    // Utility methods
    getBalance,
    getTokenBalance,

    // Direct service access
    service: blockchainService,
  };
};
