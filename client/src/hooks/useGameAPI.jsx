// client/src/hooks/useGameAPI.jsx
import { useState, useCallback } from "react";
import { gameAPI } from "../services/api";

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
        return response.data;
      } catch (err) {
        const errorMessage =
          err.response?.data?.message || err.message || "An error occurred";
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

  const startBattle = useCallback(
    async (battleData) => {
      const data = await handleRequest(gameAPI.game.startBattle, battleData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
  );

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

  // ---------------------------
  // 💰 Trading
  // ---------------------------
  const listPet = useCallback(
    async (listingData) => {
      const data = await handleRequest(gameAPI.trade.listPet, listingData);
      if (updateUser && data?.data?.user) updateUser(data.data.user);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updateUser, updatePets]
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

    // Eggs
    getUserEggs,
    hatchEgg,
    purchaseEgg,
    getFreeEgg,

    // Pets
    getUserPets,
    upgradePet,
    trainPet,
    fusePets,

    // Game Actions
    claimDailyReward,
    startBattle,
    completeQuest,

    // Trading
    listPet,
    purchasePet,
  };
};
