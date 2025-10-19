import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useGameAPI } from "../hooks/useGameAPI";
import { useUser } from "./UserContext";

const GameContext = createContext();

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

export const GameProvider = ({ children }) => {
  const { user, updateProfile } = useUser();

  // Local state
  const [pets, setPets] = useState([]);
  const [eggs, setEggs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [battleTeam, setBattleTeam] = useState([]);

  // Initialize game API with state update callbacks
  const gameAPI = useGameAPI({
    updateUser: updateProfile,
    updatePets: setPets,
    updateEggs: setEggs,
    updateInventory: setInventory,
    onError: (error) => console.error("Game API Error:", error),
  });

  // Load game data when user changes
  useEffect(() => {
    if (user?.id) {
      loadGameData();
    } else {
      // Clear game data when user logs out
      setPets([]);
      setEggs([]);
      setInventory([]);
      setBattleTeam([]);
    }
  }, [user?.id]);

  const loadGameData = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // Load pets and eggs in parallel
      const [petsData, eggsData] = await Promise.all([
        gameAPI.getUserPets(),
        gameAPI.getUserEggs(),
      ]);

      // Update state with API responses
      if (petsData?.success && petsData.data?.pets) {
        setPets(petsData.data.pets);
      }
      if (eggsData?.success && eggsData.data?.eggs) {
        setEggs(eggsData.data.eggs);
      }

      setLastSync(new Date().toISOString());
    } catch (error) {
      console.error("Error loading game data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync function for blockchain data (if needed)
  const syncBlockchainData = useCallback(async () => {
    if (!user?.walletAddress) return;
    try {
      // This would be your blockchain integration
      // const blockchainPets = await blockchain.getOwnedPets(user.walletAddress);
      console.log("Syncing blockchain data for:", user.walletAddress);
      setLastSync(new Date().toISOString());
    } catch (error) {
      console.error("Error syncing blockchain data:", error);
    }
  }, [user?.walletAddress]);

  // ---------------------------
  // 🐾 Pet Management
  // ---------------------------
  const addPet = useCallback((newPet) => {
    setPets((prev) => {
      const existingIndex = prev.findIndex((p) => p.id === newPet.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newPet;
        return updated;
      }
      return [...prev, newPet];
    });
  }, []);

  const updatePet = useCallback((petId, updates) => {
    setPets((prev) =>
      prev.map((pet) => (pet.id === petId ? { ...pet, ...updates } : pet))
    );
  }, []);

  const removePet = useCallback((petId) => {
    setPets((prev) => prev.filter((pet) => pet.id !== petId));
  }, []);

  const getPet = useCallback(
    (petId) => pets.find((pet) => pet.id === petId),
    [pets]
  );

  const getPetsByTier = useCallback(
    (tier) => pets.filter((pet) => pet.tier === tier),
    [pets]
  );

  const getPetsByType = useCallback(
    (type) => pets.filter((pet) => pet.type === type),
    [pets]
  );

  // ---------------------------
  // 🥚 Egg Management
  // ---------------------------
  const addEgg = useCallback((newEgg) => {
    setEggs((prev) => {
      const existingIndex = prev.findIndex((e) => e.id === newEgg.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newEgg;
        return updated;
      }
      return [...prev, newEgg];
    });
  }, []);

  const updateEgg = useCallback((eggId, updates) => {
    setEggs((prev) =>
      prev.map((egg) => (egg.id === eggId ? { ...egg, ...updates } : egg))
    );
  }, []);

  const removeEgg = useCallback((eggId) => {
    setEggs((prev) => prev.filter((egg) => egg.id !== eggId));
  }, []);

  const getEgg = useCallback(
    (eggId) => eggs.find((egg) => egg.id === eggId),
    [eggs]
  );

  // ---------------------------
  // 💰 User Progression (Local state updates)
  // ---------------------------
  const updateCoins = useCallback(
    (amount) => {
      if (!user) return;
      const newCoins = Math.max(0, (user.coins || 0) + amount);
      updateProfile({ coins: newCoins });
    },
    [user, updateProfile]
  );

  const updateExperience = useCallback(
    (amount) => {
      if (!user) return;

      const newExperience = (user.experience || 0) + amount;
      updateProfile({ experience: newExperience });

      const expNeeded = Math.pow(user.level || 1, 2) * 100;
      if (newExperience >= expNeeded) {
        const newLevel = (user.level || 1) + 1;
        updateProfile({
          level: newLevel,
          experience: newExperience - expNeeded,
        });
        return { leveledUp: true, newLevel };
      }

      return { leveledUp: false };
    },
    [user, updateProfile]
  );

  const updateFreeRolls = useCallback(
    (amount) => {
      if (!user) return;
      const newFreeRolls = Math.max(0, (user.freeRolls || 0) + amount);
      updateProfile({ freeRolls: newFreeRolls });
    },
    [user, updateProfile]
  );

  // ---------------------------
  // ⚔️ Battle Team
  // ---------------------------
  const addToBattleTeam = useCallback(
    (petId) => {
      const pet = getPet(petId);
      if (!pet || battleTeam.length >= 3) return;
      setBattleTeam((prev) => [...prev, pet]);
    },
    [getPet, battleTeam]
  );

  const removeFromBattleTeam = useCallback((petId) => {
    setBattleTeam((prev) => prev.filter((pet) => pet.id !== petId));
  }, []);

  const clearBattleTeam = useCallback(() => setBattleTeam([]), []);

  // ---------------------------
  // 🎮 Game Actions (Using API)
  // ---------------------------
  const handleHatchEgg = useCallback(
    async (eggId) => {
      try {
        const result = await gameAPI.hatchEgg(eggId);
        if (result.success) {
          return result;
        }
        throw new Error(result.error || "Hatching failed");
      } catch (error) {
        console.error("Error hatching egg:", error);
        throw error;
      }
    },
    [gameAPI]
  );

  const handleFeedPet = useCallback(async (petId, foodItem) => {
    // This would be implemented based on your API
    try {
      // Example implementation
      console.log("Feeding pet:", petId, foodItem);
      // const result = await gameAPI.feedPet(petId, foodItem);
      // return result;
    } catch (error) {
      console.error("Error feeding pet:", error);
      throw error;
    }
  }, []);

  const handleClaimDailyReward = useCallback(async () => {
    try {
      const result = await gameAPI.claimDailyReward();
      if (result.success) {
        return result;
      }
      throw new Error(result.error || "Claiming daily reward failed");
    } catch (error) {
      console.error("Error claiming daily reward:", error);
      throw error;
    }
  }, [gameAPI]);

  // ---------------------------
  // 💾 Context Value
  // ---------------------------
  const value = {
    // State
    pets,
    eggs,
    inventory,
    battleTeam,
    isLoading,
    lastSync,

    // Pet Management
    addPet,
    updatePet,
    removePet,
    getPet,
    getPetsByTier,
    getPetsByType,

    // Egg Management
    addEgg,
    updateEgg,
    removeEgg,
    getEgg,

    // User Progression
    updateCoins,
    updateExperience,
    updateFreeRolls,

    // Battle Team
    addToBattleTeam,
    removeFromBattleTeam,
    clearBattleTeam,

    // Game Actions
    loadGameData,
    syncBlockchainData,
    hatchEgg: handleHatchEgg,
    feedPet: handleFeedPet,
    claimDailyReward: handleClaimDailyReward,

    // API Methods (exposed for direct use if needed)
    gameAPI: {
      // Pets
      getUserPets: gameAPI.getUserPets,
      upgradePet: gameAPI.upgradePet,
      trainPet: gameAPI.trainPet,
      fusePets: gameAPI.fusePets,

      // Eggs
      getUserEggs: gameAPI.getUserEggs,
      purchaseEgg: gameAPI.purchaseEgg,
      getFreeEgg: gameAPI.getFreeEgg,

      // Game
      startBattle: gameAPI.startBattle,
      completeQuest: gameAPI.completeQuest,

      // Trading
      listPet: gameAPI.listPet,
      purchasePet: gameAPI.purchasePet,
    },

    // User context (for convenience)
    user,
    updateUser: updateProfile,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
