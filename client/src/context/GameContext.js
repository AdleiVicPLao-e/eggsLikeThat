import React, { createContext, useContext, useState, useCallback } from "react";
import { useGameAPI } from "../hooks/useGameAPI.js";
import { useBlockchain } from "../hooks/useBlockchain.js";
import { useUser } from "./UserContext.js";

const GameContext = createContext();

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

export const GameProvider = ({ children }) => {
  const { user, updateUser } = useUser();
  const { getUserPets, getUserEggs } = useGameAPI();
  const { getOwnedPets } = useBlockchain();

  const [pets, setPets] = useState([]);
  const [eggs, setEggs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Load game data when user changes
  React.useEffect(() => {
    if (user?.id) {
      loadGameData();
    } else {
      // Clear game data when user logs out
      setPets([]);
      setEggs([]);
    }
  }, [user?.id]);

  const loadGameData = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const [petsData, eggsData] = await Promise.all([
        getUserPets(),
        getUserEggs(),
      ]);

      if (petsData?.data?.pets) {
        setPets(petsData.data.pets);
      }

      if (eggsData?.data?.eggs) {
        setEggs(eggsData.data.eggs);
      }

      setLastSync(new Date().toISOString());
    } catch (error) {
      console.error("Error loading game data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncBlockchainData = useCallback(async () => {
    if (!user?.walletAddress) return;

    try {
      // Sync blockchain-owned pets
      const blockchainPets = await getOwnedPets(user.walletAddress);
      if (blockchainPets.success) {
        // Merge blockchain pets with server pets
        // This would need more sophisticated merging logic
        console.log("Synced blockchain pets:", blockchainPets.pets);
      }

      setLastSync(new Date().toISOString());
    } catch (error) {
      console.error("Error syncing blockchain data:", error);
    }
  }, [user?.walletAddress, getOwnedPets]);

  // Pet management
  const addPet = useCallback((newPet) => {
    setPets((prev) => {
      const existingIndex = prev.findIndex((pet) => pet.id === newPet.id);
      if (existingIndex >= 0) {
        // Update existing pet
        const updated = [...prev];
        updated[existingIndex] = newPet;
        return updated;
      } else {
        // Add new pet
        return [...prev, newPet];
      }
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
    (petId) => {
      return pets.find((pet) => pet.id === petId);
    },
    [pets]
  );

  const getPetsByTier = useCallback(
    (tier) => {
      return pets.filter((pet) => pet.tier === tier);
    },
    [pets]
  );

  const getPetsByType = useCallback(
    (type) => {
      return pets.filter((pet) => pet.type === type);
    },
    [pets]
  );

  // Egg management
  const addEgg = useCallback((newEgg) => {
    setEggs((prev) => {
      const existingIndex = prev.findIndex((egg) => egg.id === newEgg.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newEgg;
        return updated;
      } else {
        return [...prev, newEgg];
      }
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
    (eggId) => {
      return eggs.find((egg) => egg.id === eggId);
    },
    [eggs]
  );

  // Game state management
  const updateCoins = useCallback(
    (amount) => {
      if (!user) return;

      const newCoins = Math.max(0, (user.coins || 0) + amount);
      updateUser({ coins: newCoins });
    },
    [user, updateUser]
  );

  const updateExperience = useCallback(
    (amount) => {
      if (!user) return;

      const newExperience = (user.experience || 0) + amount;
      updateUser({ experience: newExperience });

      // Check for level up
      const expNeeded = Math.pow(user.level || 1, 2) * 100;
      if (newExperience >= expNeeded) {
        const newLevel = (user.level || 1) + 1;
        updateUser({
          level: newLevel,
          experience: newExperience - expNeeded,
        });
        return { leveledUp: true, newLevel };
      }

      return { leveledUp: false };
    },
    [user, updateUser]
  );

  const updateFreeRolls = useCallback(
    (amount) => {
      if (!user) return;

      const newFreeRolls = Math.max(0, (user.freeRolls || 0) + amount);
      updateUser({ freeRolls: newFreeRolls });
    },
    [user, updateUser]
  );

  // Battle team management
  const [battleTeam, setBattleTeam] = useState([]);

  const addToBattleTeam = useCallback(
    (petId) => {
      const pet = getPet(petId);
      if (!pet || battleTeam.length >= 3) return;

      setBattleTeam((prev) => [...prev, pet]);
    },
    [getPet, battleTeam.length]
  );

  const removeFromBattleTeam = useCallback((petId) => {
    setBattleTeam((prev) => prev.filter((pet) => pet.id !== petId));
  }, []);

  const clearBattleTeam = useCallback(() => {
    setBattleTeam([]);
  }, []);

  const value = {
    // State
    pets,
    eggs,
    battleTeam,
    isLoading,
    lastSync,

    // Pet management
    addPet,
    updatePet,
    removePet,
    getPet,
    getPetsByTier,
    getPetsByType,

    // Egg management
    addEgg,
    updateEgg,
    removeEgg,
    getEgg,

    // Game progression
    updateCoins,
    updateExperience,
    updateFreeRolls,

    // Battle team
    addToBattleTeam,
    removeFromBattleTeam,
    clearBattleTeam,

    // Data synchronization
    loadGameData,
    syncBlockchainData,

    // User proxy (for convenience)
    user,
    updateUser,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
