import React, { createContext, useContext, useState, useCallback } from "react";
import { useGameAPI } from "../hooks/useGameAPI.jsx";
import { useBlockchain } from "../hooks/useBlockchain.jsx";
import { useUser } from "./UserContext.jsx";

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

  // Local state
  const [pets, setPets] = useState([]);
  const [eggs, setEggs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [battleTeam, setBattleTeam] = useState([]);

  // Define syncBlockchainData first so we can inject it into useBlockchain
  const syncBlockchainData = useCallback(async () => {
    if (!user?.walletAddress) return;
    try {
      const blockchainPets = await blockchain.getOwnedPets(user.walletAddress);
      if (blockchainPets.success) {
        console.log("Synced blockchain pets:", blockchainPets.pets);
      }
      setLastSync(new Date().toISOString());
    } catch (error) {
      console.error("Error syncing blockchain data:", error);
    }
  }, [user?.walletAddress]);

  // Initialize blockchain hook AFTER defining syncBlockchainData
  const blockchain = useBlockchain({
    syncBlockchainData,
    updateUser,
  });

  const { getOwnedPets } = blockchain;

  // Attach API handlers
  const { getUserPets, getUserEggs, hatchEgg, feedPet, claimDailyReward } =
    useGameAPI({
      updateUser,
      updatePets: setPets,
      updateEggs: setEggs,
      updateInventory: setInventory,
    });

  React.useEffect(() => {
    if (user?.id) {
      loadGameData();
    } else {
      setPets([]);
      setEggs([]);
      setInventory([]);
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
      if (petsData?.data?.pets) setPets(petsData.data.pets);
      if (eggsData?.data?.eggs) setEggs(eggsData.data.eggs);
      setLastSync(new Date().toISOString());
    } catch (error) {
      console.error("Error loading game data:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
  // 💰 User Progression
  // ---------------------------
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
  // 💾 Context Value
  // ---------------------------
  const value = {
    pets,
    eggs,
    inventory,
    battleTeam,
    isLoading,
    lastSync,

    // Actions
    addPet,
    updatePet,
    removePet,
    getPet,
    getPetsByTier,
    getPetsByType,
    addEgg,
    updateEgg,
    removeEgg,
    getEgg,
    updateCoins,
    updateExperience,
    updateFreeRolls,
    addToBattleTeam,
    removeFromBattleTeam,
    clearBattleTeam,
    loadGameData,
    syncBlockchainData,
    hatchEgg,
    feedPet,
    claimDailyReward,

    user,
    updateUser,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
