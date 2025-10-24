// client/src/hooks/useGameAPI.jsx
import { useState, useCallback } from "react";
import { gameAPI, handleApiResponse, handleApiError } from "../services/api";

/**
 * useGameAPI Hook
 *
 * A standalone API utility that handles all game-related API calls.
 * Can be used with or without GameContext by passing update functions.
 */
export const useGameAPI = (options = {}) => {
  const { updateUser, updatePets, updateEggs, updateInventory, onError } =
    options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generic request handler
  const handleRequest = useCallback(
    async (apiCall, ...args) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiCall(...args);
        return handleApiResponse(response);
      } catch (err) {
        const errorMessage = handleApiError(err);
        setError(errorMessage);
        if (onError) onError(errorMessage);
        console.error("GameAPI Error:", errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [onError]
  );

  // ---------------------------
  // 🔐 Authentication
  // ---------------------------
  const walletRegister = useCallback(
    async (walletData) => {
      const data = await handleRequest(gameAPI.auth.walletRegister, walletData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (data?.data?.token) {
        localStorage.setItem("petverse_token", data.data.token);
      }
      return data;
    },
    [handleRequest, updateUser]
  );

  const walletLogin = useCallback(
    async (walletData) => {
      const data = await handleRequest(gameAPI.auth.walletLogin, walletData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (data?.data?.token) {
        localStorage.setItem("petverse_token", data.data.token);
      }
      return data;
    },
    [handleRequest, updateUser]
  );

  const connectWallet = useCallback(
    async (walletData) => {
      const data = await handleRequest(gameAPI.auth.connectWallet, walletData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      return data;
    },
    [handleRequest, updateUser]
  );

  const getProfile = useCallback(async () => {
    const data = await handleRequest(gameAPI.auth.getProfile);
    if (updateUser && data?.data?.user) updateUser(data.data.user);
    return data;
  }, [handleRequest, updateUser]);

  const getNonce = useCallback(async () => {
    return await handleRequest(gameAPI.auth.getNonce);
  }, [handleRequest]);

  // ---------------------------
  // 🥚 Eggs
  // ---------------------------
  const getUserEggs = useCallback(
    async (filters = {}) => {
      const data = await handleRequest(gameAPI.eggs.getUserEggs, filters);
      if (updateEggs && data?.data?.eggs) updateEggs(data.data.eggs);
      return data;
    },
    [handleRequest, updateEggs]
  );

  const getEggCatalog = useCallback(async () => {
    return await handleRequest(gameAPI.eggs.getEggCatalog);
  }, [handleRequest]);

  const purchaseEgg = useCallback(
    async (purchaseData) => {
      const data = await handleRequest(gameAPI.eggs.purchaseEgg, purchaseData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updateEggs && data?.data?.eggs) updateEggs(data.data.eggs);
      return data;
    },
    [handleRequest, updateUser, updateEggs]
  );

  const getFreeEgg = useCallback(async () => {
    const data = await handleRequest(gameAPI.eggs.getFreeEgg);
    if (updateUser && data?.data?.user) updateUser(data.data.user);
    if (updateEggs && data?.data?.eggs) updateEggs(data.data.eggs);
    return data;
  }, [handleRequest, updateUser, updateEggs]);

  const previewEgg = useCallback(
    async (eggId) => {
      return await handleRequest(gameAPI.eggs.previewEgg, eggId);
    },
    [handleRequest]
  );

  const hatchEgg = useCallback(
    async (eggId) => {
      const data = await handleRequest(gameAPI.eggs.hatchEgg, eggId);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      if (updateEggs && data?.data?.eggs) updateEggs(data.data.eggs);
      return data;
    },
    [handleRequest, updateUser, updatePets, updateEggs]
  );

  const syncBlockchainEggs = useCallback(async () => {
    const data = await handleRequest(gameAPI.eggs.syncBlockchainEggs);
    if (updateEggs && data?.data?.eggs) updateEggs(data.data.eggs);
    return data;
  }, [handleRequest, updateEggs]);

  // ---------------------------
  // 🐾 Pets
  // ---------------------------
  const getUserPets = useCallback(
    async (filters = {}) => {
      const data = await handleRequest(gameAPI.pets.getUserPets, filters);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updatePets]
  );

  const getPetDetails = useCallback(
    async (petId) => {
      return await handleRequest(gameAPI.pets.getPetDetails, petId);
    },
    [handleRequest]
  );

  const upgradePet = useCallback(
    async (petId, upgradeData) => {
      const data = await handleRequest(
        gameAPI.pets.upgradePet,
        petId,
        upgradeData
      );
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
  );

  const trainPet = useCallback(
    async (petId, trainData) => {
      const data = await handleRequest(gameAPI.pets.trainPet, petId, trainData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
  );

  const fusePets = useCallback(
    async (fusionData) => {
      const data = await handleRequest(gameAPI.pets.fusePets, fusionData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
  );

  const toggleFavorite = useCallback(
    async (petId) => {
      const data = await handleRequest(gameAPI.pets.toggleFavorite, petId);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updatePets]
  );

  const syncBlockchainPets = useCallback(async () => {
    const data = await handleRequest(gameAPI.pets.syncBlockchainPets);
    if (updatePets && data?.data?.pets) updatePets(data.data.pets);
    return data;
  }, [handleRequest, updatePets]);

  // ---------------------------
  // 🎮 Game Actions
  // ---------------------------
  const claimDailyReward = useCallback(async () => {
    const data = await handleRequest(gameAPI.game.claimDailyReward);
    if (updateUser && data?.data?.user) updateUser(data.data.user);
    if (updateInventory && data?.data?.inventory)
      updateInventory(data.data.inventory);
    return data;
  }, [handleRequest, updateUser, updateInventory]);

  const getDailyRewardStatus = useCallback(async () => {
    return await handleRequest(gameAPI.game.getDailyRewardStatus);
  }, [handleRequest]);

  const startBattle = useCallback(
    async (battleData) => {
      const data = await handleRequest(gameAPI.game.startBattle, battleData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
  );

  const getBattleHistory = useCallback(
    async (params = {}) => {
      return await handleRequest(gameAPI.game.getBattleHistory, params);
    },
    [handleRequest]
  );

  const getAvailableBattlePets = useCallback(async () => {
    return await handleRequest(gameAPI.game.getAvailableBattlePets);
  }, [handleRequest]);

  const completeQuest = useCallback(
    async (questData) => {
      const data = await handleRequest(gameAPI.game.completeQuest, questData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updateInventory && data?.data?.inventory)
        updateInventory(data.data.inventory);
      return data;
    },
    [handleRequest, updateUser, updateInventory]
  );

  const getAvailableQuests = useCallback(async () => {
    return await handleRequest(gameAPI.game.getAvailableQuests);
  }, [handleRequest]);

  const getQuestProgress = useCallback(async () => {
    return await handleRequest(gameAPI.game.getQuestProgress);
  }, [handleRequest]);

  const getUserStats = useCallback(async () => {
    return await handleRequest(gameAPI.game.getUserStats);
  }, [handleRequest]);

  const getLeaderboard = useCallback(
    async (params = {}) => {
      return await handleRequest(gameAPI.game.getLeaderboard, params);
    },
    [handleRequest]
  );

  // ---------------------------
  // 🔗 Blockchain Integration
  // ---------------------------
  const gameConnectWallet = useCallback(
    async (walletData) => {
      const data = await handleRequest(gameAPI.game.connectWallet, walletData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      return data;
    },
    [handleRequest, updateUser]
  );

  const disconnectWallet = useCallback(async () => {
    const data = await handleRequest(gameAPI.game.disconnectWallet);
    if (updateUser && data?.data?.user) updateUser(data.data.user);
    return data;
  }, [handleRequest, updateUser]);

  const getBlockchainAssets = useCallback(async () => {
    return await handleRequest(gameAPI.game.getBlockchainAssets);
  }, [handleRequest]);

  // ---------------------------
  // 💰 Trading & Marketplace
  // ---------------------------
  const getTradeListings = useCallback(
    async (params = {}) => {
      return await handleRequest(gameAPI.trade.getListings, params);
    },
    [handleRequest]
  );

  const getMarketplaceStats = useCallback(async () => {
    return await handleRequest(gameAPI.trade.getMarketplaceStats);
  }, [handleRequest]);

  const getUserListings = useCallback(
    async (params = {}) => {
      return await handleRequest(gameAPI.trade.getUserListings, params);
    },
    [handleRequest]
  );

  const getTradeHistory = useCallback(
    async (params = {}) => {
      return await handleRequest(gameAPI.trade.getTradeHistory, params);
    },
    [handleRequest]
  );

  const listPet = useCallback(
    async (listingData) => {
      const data = await handleRequest(gameAPI.trade.listPet, listingData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
  );

  const listItem = useCallback(
    async (itemData) => {
      const data = await handleRequest(gameAPI.trade.listItem, itemData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updateInventory && data?.data?.inventory)
        updateInventory(data.data.inventory);
      return data;
    },
    [handleRequest, updateUser, updateInventory]
  );

  const purchasePet = useCallback(
    async (tradeId) => {
      const data = await handleRequest(gameAPI.trade.purchasePet, tradeId);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
  );

  const purchaseItem = useCallback(
    async (tradeId) => {
      const data = await handleRequest(gameAPI.trade.purchaseItem, tradeId);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updateInventory && data?.data?.inventory)
        updateInventory(data.data.inventory);
      return data;
    },
    [handleRequest, updateUser, updateInventory]
  );

  const cancelListing = useCallback(
    async (tradeId) => {
      const data = await handleRequest(gameAPI.trade.cancelListing, tradeId);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
  );

  const makeOffer = useCallback(
    async (offerData) => {
      const data = await handleRequest(gameAPI.trade.makeOffer, offerData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      return data;
    },
    [handleRequest, updateUser]
  );

  const getUserOffers = useCallback(
    async (params = {}) => {
      return await handleRequest(gameAPI.trade.getUserOffers, params);
    },
    [handleRequest]
  );

  // ---------------------------
  // 🛠️ Utility Functions
  // ---------------------------
  const uploadFile = useCallback(
    async (file, type = "image") => {
      return await handleRequest(gameAPI.upload.file, file, type);
    },
    [handleRequest]
  );

  return {
    // State
    loading,
    error,
    clearError: () => setError(null),

    // Authentication
    walletRegister,
    walletLogin,
    connectWallet,
    getProfile,
    getNonce,

    // Eggs
    getUserEggs,
    getEggCatalog,
    hatchEgg,
    purchaseEgg,
    getFreeEgg,
    previewEgg,
    syncBlockchainEggs,

    // Pets
    getUserPets,
    getPetDetails,
    upgradePet,
    trainPet,
    fusePets,
    toggleFavorite,
    syncBlockchainPets,

    // Game Actions
    claimDailyReward,
    getDailyRewardStatus,
    startBattle,
    getBattleHistory,
    getAvailableBattlePets,
    completeQuest,
    getAvailableQuests,
    getQuestProgress,
    getUserStats,
    getLeaderboard,

    // Blockchain Integration
    gameConnectWallet,
    disconnectWallet,
    getBlockchainAssets,

    // Trading & Marketplace
    getTradeListings,
    getMarketplaceStats,
    getUserListings,
    getTradeHistory,
    listPet,
    listItem,
    purchasePet,
    purchaseItem,
    cancelListing,
    makeOffer,
    getUserOffers,

    // Utilities
    uploadFile,
  };
};

export default useGameAPI;
