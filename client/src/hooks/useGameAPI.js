import { useState, useCallback } from "react";
import { gameAPI, validateData } from "../services/api.js";
import { useGame } from "../context/GameContext.js";

export const useGameAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { updateUser, updatePets, updateEggs, updateInventory } = useGame();

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
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // User methods
  const getUserProfile = useCallback(
    () => handleRequest(gameAPI.auth.getProfile),
    [handleRequest]
  );

  const updateUserProfile = useCallback(
    (profileData) => handleRequest(gameAPI.auth.updateProfile, profileData),
    [handleRequest]
  );

  // Pet methods
  const getUserPets = useCallback(
    (filters = {}) => {
      return handleRequest(gameAPI.pets.getUserPets, filters).then((data) => {
        updatePets(data.data.pets);
        return data;
      });
    },
    [handleRequest, updatePets]
  );

  const getPetDetails = useCallback(
    (petId) => handleRequest(gameAPI.pets.getPetDetails, petId),
    [handleRequest]
  );

  const upgradePet = useCallback(
    (petId, upgradeData) => {
      return handleRequest(gameAPI.pets.upgradePet, petId, upgradeData).then(
        (data) => {
          // Update local state
          updateUser(data.data.user);
          return data;
        }
      );
    },
    [handleRequest, updateUser]
  );

  const fusePets = useCallback(
    (fusionData) => {
      return handleRequest(gameAPI.pets.fusePets, fusionData).then((data) => {
        updatePets(data.data.newPet ? [data.data.newPet] : []);
        updateUser(data.data.user);
        return data;
      });
    },
    [handleRequest, updatePets, updateUser]
  );

  const toggleFavorite = useCallback(
    (petId) => {
      return handleRequest(gameAPI.pets.toggleFavorite, petId).then((data) => {
        // Update local pet state
        return data;
      });
    },
    [handleRequest]
  );

  // Egg methods
  const getUserEggs = useCallback(
    (filters = {}) => {
      return handleRequest(gameAPI.eggs.getUserEggs, filters).then((data) => {
        updateEggs(data.data.eggs);
        return data;
      });
    },
    [handleRequest, updateEggs]
  );

  const getEggDetails = useCallback(
    (eggId) => handleRequest(gameAPI.eggs.getEggDetails, eggId),
    [handleRequest]
  );

  const purchaseEgg = useCallback(
    (purchaseData) => {
      return handleRequest(gameAPI.eggs.purchaseEgg, purchaseData).then(
        (data) => {
          updateEggs(data.data.egg ? [data.data.egg] : []);
          updateUser(data.data.user);
          return data;
        }
      );
    },
    [handleRequest, updateEggs, updateUser]
  );

  const getFreeEgg = useCallback(() => {
    return handleRequest(gameAPI.eggs.getFreeEgg).then((data) => {
      updateEggs(data.data.egg ? [data.data.egg] : []);
      updateUser(data.data.user);
      return data;
    });
  }, [handleRequest, updateEggs, updateUser]);

  const previewEgg = useCallback(
    (eggId) => handleRequest(gameAPI.eggs.previewEgg, eggId),
    [handleRequest]
  );

  const applyCosmetic = useCallback(
    (eggId, cosmeticData) => {
      return handleRequest(
        gameAPI.eggs.applyCosmetic,
        eggId,
        cosmeticData
      ).then((data) => {
        // Update local egg state
        return data;
      });
    },
    [handleRequest]
  );

  const getEggCatalog = useCallback(
    () => handleRequest(gameAPI.eggs.getEggCatalog),
    [handleRequest]
  );

  // Game methods
  const hatchEgg = useCallback(
    (hatchData) => {
      return handleRequest(gameAPI.game.hatchEgg, hatchData).then((data) => {
        updatePets(data.data.pet ? [data.data.pet] : []);
        updateUser(data.data.user);
        return data;
      });
    },
    [handleRequest, updatePets, updateUser]
  );

  const startBattle = useCallback(
    (battleData) => {
      return handleRequest(gameAPI.game.startBattle, battleData).then(
        (data) => {
          updateUser(data.data.user);
          return data;
        }
      );
    },
    [handleRequest, updateUser]
  );

  const completeQuest = useCallback(
    (questData) => {
      return handleRequest(gameAPI.game.completeQuest, questData).then(
        (data) => {
          updateUser(data.data.user);
          return data;
        }
      );
    },
    [handleRequest, updateUser]
  );

  const claimDailyReward = useCallback(() => {
    return handleRequest(gameAPI.game.claimDailyReward).then((data) => {
      updateUser(data.data.user);
      return data;
    });
  }, [handleRequest, updateUser]);

  // Trade methods
  const getListings = useCallback(
    (filters = {}) => handleRequest(gameAPI.trade.getListings, filters),
    [handleRequest]
  );

  const getMarketplaceStats = useCallback(
    () => handleRequest(gameAPI.trade.getMarketplaceStats),
    [handleRequest]
  );

  const getUserListings = useCallback(
    (filters = {}) => handleRequest(gameAPI.trade.getUserListings, filters),
    [handleRequest]
  );

  const getTradeHistory = useCallback(
    (filters = {}) => handleRequest(gameAPI.trade.getTradeHistory, filters),
    [handleRequest]
  );

  const listPet = useCallback(
    (listingData) => {
      return handleRequest(gameAPI.trade.listPet, listingData).then((data) => {
        // Could update local listings state if needed
        return data;
      });
    },
    [handleRequest]
  );

  const cancelListing = useCallback(
    (tradeId) => {
      return handleRequest(gameAPI.trade.cancelListing, tradeId).then(
        (data) => {
          // Update local listings state
          return data;
        }
      );
    },
    [handleRequest]
  );

  const purchasePet = useCallback(
    (tradeId) => {
      return handleRequest(gameAPI.trade.purchasePet, tradeId).then((data) => {
        updatePets(data.data.pet ? [data.data.pet] : []);
        updateUser(data.data.user);
        return data;
      });
    },
    [handleRequest, updatePets, updateUser]
  );

  const makeOffer = useCallback(
    (offerData) => handleRequest(gameAPI.trade.makeOffer, offerData),
    [handleRequest]
  );

  return {
    loading,
    error,
    clearError: () => setError(null),

    // User API
    getUserProfile,
    updateUserProfile,

    // Pet API
    getUserPets,
    getPetDetails,
    upgradePet,
    fusePets,
    toggleFavorite,

    // Egg API
    getUserEggs,
    getEggDetails,
    purchaseEgg,
    getFreeEgg,
    previewEgg,
    applyCosmetic,
    getEggCatalog,

    // Game API
    hatchEgg,
    startBattle,
    completeQuest,
    claimDailyReward,

    // Trade API
    getListings,
    getMarketplaceStats,
    getUserListings,
    getTradeHistory,
    listPet,
    cancelListing,
    purchasePet,
    makeOffer,

    // Validation
    validateData,
  };
};
