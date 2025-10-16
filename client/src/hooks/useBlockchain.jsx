import { useState, useCallback } from "react";
import { blockchainService } from "../services/blockchain.jsx";

/**
 * useBlockchain hook
 *
 * Pass `syncBlockchainData` (and optionally `updateUser`)
 * from GameContext when using this hook inside GameProvider.
 */
export const useBlockchain = ({ syncBlockchainData, updateUser } = {}) => {
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [transactionError, setTransactionError] = useState(null);
  const [transactionSuccess, setTransactionSuccess] = useState(null);
  const [pendingTransactions, setPendingTransactions] = useState([]);

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
          // Sync data only if callback provided
          if (syncBlockchainData) await syncBlockchainData();
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

  // --- Blockchain actions below (unchanged) ---
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

  const setupEventListeners = useCallback(() => {
    blockchainService.onPetMinted(() => syncBlockchainData?.());
    blockchainService.onEggHatched(() => syncBlockchainData?.());
    blockchainService.onItemListed(() => syncBlockchainData?.());
    blockchainService.onItemSold(() => syncBlockchainData?.());
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
    transactionLoading,
    transactionError,
    transactionSuccess,
    pendingTransactions,
    getTransactionStatus,
    clearMessages,
    setupEventListeners,
    removeEventListeners,
    mintPet,
    getPetMetadata,
    getOwnedPets,
    purchaseEgg,
    hatchEgg,
    listPet,
    purchaseListing,
    startFusion,
    calculateFusionSuccess,
    getBalance,
    getTokenBalance,
    service: blockchainService,
  };
};
