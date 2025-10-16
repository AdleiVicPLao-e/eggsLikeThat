import { useState, useCallback } from "react";
import { gameAPI } from "../services/api.jsx";

/**
 * useGameAPI Hook
 *
 * A standalone API utility that does not depend on GameContext.
 * You can inject updater functions from GameContext (optional).
 */
export const useGameAPI = ({
  updateUser,
  updatePets,
  updateEggs,
  updateInventory,
} = {}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generic request handler
  const handleRequest = useCallback(async (apiCall, ...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(...args);
      return response.data;
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || err.message || "An error occurred";
      setError(errorMessage);
      console.error("GameAPI Error:", errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 🥚 Eggs
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
      if (updateInventory && data?.data?.inventory)
        updateInventory(data.data.inventory);
      return data;
    },
    [handleRequest, updateUser, updatePets, updateInventory]
  );

  // 🐾 Pets
  const getUserPets = useCallback(
    async (filters = {}) => {
      const data = await handleRequest(gameAPI.pets.getUserPets, filters);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      return data;
    },
    [handleRequest, updatePets]
  );

  const feedPet = useCallback(
    async (petId, foodItem) => {
      const data = await handleRequest(gameAPI.pets.feedPet, petId, foodItem);
      if (updatePets && data?.data?.pets) updatePets(data.data.pets);
      if (updateInventory && data?.data?.inventory)
        updateInventory(data.data.inventory);
      return data;
    },
    [handleRequest, updatePets, updateInventory]
  );

  // 🎮 Game Actions
  const claimDailyReward = useCallback(async () => {
    const data = await handleRequest(gameAPI.game.claimDailyReward);
    if (updateUser && data?.data?.user) updateUser(data.data.user);
    if (updateInventory && data?.data?.inventory)
      updateInventory(data.data.inventory);
    return data;
  }, [handleRequest, updateUser, updateInventory]);

  return {
    loading,
    error,
    clearError: () => setError(null),
    getUserEggs,
    hatchEgg,
    getUserPets,
    feedPet,
    claimDailyReward,
  };
};
