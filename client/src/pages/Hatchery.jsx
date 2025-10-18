import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useGame } from "../context/GameContext";
import { useWallet } from "../hooks/useWallet";
import PetCard from "../components/Pets/PetCard";
import HatchAnimation from "../components/Game/HatchAnimation";
import { Coins, Zap, Gift, Sparkles, ShoppingCart, Wallet } from "lucide-react";
import {
  EGG_TYPES,
  PET_RARITIES,
  CURRENCIES,
  GAME_CONFIG,
} from "../utils/constants";

const Hatchery = () => {
  const { user, isAuthenticated, updateProfile } = useUser();
  const { pets, eggs, addPet, addEgg, updateCoins, updateFreeRolls, gameAPI } =
    useGame();
  const { account, isConnected, connect, registerWithWallet, loginWithWallet } =
    useWallet();

  const [newlyHatchedPet, setNewlyHatchedPet] = useState(null);
  const [showHatchAnimation, setShowHatchAnimation] = useState(false);
  const [selectedEggType, setSelectedEggType] = useState(EGG_TYPES.BASIC);
  const [eggPreview, setEggPreview] = useState(null);
  const [useBlockchainHatch, setUseBlockchainHatch] = useState(false);
  const [isHatching, setIsHatching] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Load egg preview from API when egg type changes
  useEffect(() => {
    loadEggPreview();
  }, [selectedEggType]);

  const loadEggPreview = async () => {
    try {
      // This would call your API to get egg preview data
      // For now, we'll set a placeholder
      setEggPreview([
        { tier: PET_RARITIES.COMMON, type: "dragon", probability: "40%" },
        { tier: PET_RARITIES.UNCOMMON, type: "phoenix", probability: "25%" },
        { tier: PET_RARITIES.RARE, type: "unicorn", probability: "15%" },
        { tier: PET_RARITIES.EPIC, type: "griffin", probability: "10%" },
        { tier: PET_RARITIES.LEGENDARY, type: "dragon", probability: "7%" },
        { tier: PET_RARITIES.MYTHIC, type: "phoenix", probability: "3%" },
      ]);
    } catch (error) {
      console.error("Failed to load egg preview:", error);
    }
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    const result = await connect();
    if (result.success) {
      // Try to login with wallet first, if not registered, prompt for registration
      const loginResult = await loginWithWallet();
      if (!loginResult.success) {
        // If login fails, try registration with minimal data
        await registerWithWallet({ username: `user_${account.slice(2, 8)}` });
      }
    }
  };

  // Purchase egg with coins
  const purchaseEgg = async (eggType) => {
    if (!isAuthenticated) return;

    setIsPurchasing(true);
    try {
      const result = await gameAPI.purchaseEgg({
        eggType,
        currency: CURRENCIES.COINS,
      });
      if (result.success) {
        addEgg(result.data.egg);
        updateCoins(-result.data.egg.purchasePrice);
        alert(`Purchased ${eggType} egg successfully!`);
      } else {
        alert(result.error || "Purchase failed");
      }
    } catch (error) {
      console.error("Failed to purchase egg:", error);
      alert(`Purchase failed: ${error.message}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  // Claim free daily egg
  const claimFreeEgg = async () => {
    if (!isAuthenticated) return;

    try {
      const result = await gameAPI.getFreeEgg();
      if (result.success) {
        addEgg(result.data.egg);
        updateFreeRolls(-1);
        alert("Free egg claimed successfully!");
      } else {
        alert(result.error || "Failed to claim free egg");
      }
    } catch (error) {
      console.error("Failed to claim free egg:", error);
      alert(`Failed to claim free egg: ${error.message}`);
    }
  };

  // Hatch egg
  const hatchEgg = async (eggId = null) => {
    if (!isAuthenticated) return;

    setIsHatching(true);

    // Check if using free roll or has enough coins
    const canUseFreeRoll = user.freeRolls > 0;
    const hatchCost = GAME_CONFIG?.HATCH_COST || 50;

    if (!canUseFreeRoll && user.coins < hatchCost) {
      alert(`Not enough coins! Hatching costs ${hatchCost} coins.`);
      setIsHatching(false);
      return;
    }

    setShowHatchAnimation(true);

    try {
      const result = await gameAPI.hatchEgg({
        eggId,
        useFreeRoll: canUseFreeRoll,
        eggType: selectedEggType,
      });

      if (result.success && result.data.pet) {
        addPet(result.data.pet);
        setNewlyHatchedPet(result.data.pet);

        if (!canUseFreeRoll) {
          updateCoins(-hatchCost);
        } else {
          updateFreeRolls(-1);
        }

        // Auto-hide animation after delay
        setTimeout(() => {
          setShowHatchAnimation(false);
          setIsHatching(false);
        }, 3000);
      } else {
        throw new Error(result.error || "Hatching failed");
      }
    } catch (error) {
      console.error("Hatching failed:", error);
      alert(`Hatching failed: ${error.message}`);
      setShowHatchAnimation(false);
      setIsHatching(false);
    }
  };

  // Quick hatch (no specific egg)
  const quickHatch = () => {
    hatchEgg(null);
  };

  // Get egg cost
  const getEggCost = (eggType) => {
    const costs = {
      [EGG_TYPES.BASIC]: 100,
      [EGG_TYPES.PREMIUM]: 250,
      [EGG_TYPES.COSMETIC]: 150,
      [EGG_TYPES.MYSTERY]: 200,
    };
    return costs[eggType] || costs[EGG_TYPES.BASIC];
  };

  // Format currency for display
  const formatCurrency = (amount, currency = CURRENCIES.COINS) => {
    if (currency === CURRENCIES.ETH) {
      return `${amount} ETH`;
    }
    return amount.toLocaleString();
  };

  // Format tier for display
  const formatTier = (tier) => {
    const tierStyles = {
      [PET_RARITIES.COMMON]: {
        emoji: "⚪",
        bgColor: "bg-gray-500",
        textColor: "text-gray-300",
      },
      [PET_RARITIES.UNCOMMON]: {
        emoji: "🟢",
        bgColor: "bg-green-500",
        textColor: "text-green-300",
      },
      [PET_RARITIES.RARE]: {
        emoji: "🔵",
        bgColor: "bg-blue-500",
        textColor: "text-blue-300",
      },
      [PET_RARITIES.EPIC]: {
        emoji: "🟣",
        bgColor: "bg-purple-500",
        textColor: "text-purple-300",
      },
      [PET_RARITIES.LEGENDARY]: {
        emoji: "🟡",
        bgColor: "bg-yellow-500",
        textColor: "text-yellow-300",
      },
      [PET_RARITIES.MYTHIC]: {
        emoji: "🔴",
        bgColor: "bg-red-500",
        textColor: "text-red-300",
      },
      [PET_RARITIES.CELESTIAL]: {
        emoji: "⚡",
        bgColor: "bg-indigo-500",
        textColor: "text-indigo-300",
      },
      [PET_RARITIES.EXOTIC]: {
        emoji: "🌈",
        bgColor: "bg-pink-500",
        textColor: "text-pink-300",
      },
      [PET_RARITIES.ULTIMATE]: {
        emoji: "👑",
        bgColor: "bg-orange-500",
        textColor: "text-orange-300",
      },
      [PET_RARITIES.GODLY]: {
        emoji: "✨",
        bgColor: "bg-cyan-500",
        textColor: "text-cyan-300",
      },
    };
    return tierStyles[tier] || tierStyles[PET_RARITIES.COMMON];
  };

  // Format type for display
  const formatType = (type) => {
    const typeNames = {
      dragon: "Dragon",
      phoenix: "Phoenix",
      unicorn: "Unicorn",
      griffin: "Griffin",
      wolf: "Wolf",
      cat: "Cat",
      dog: "Dog",
      bird: "Bird",
    };
    return { name: typeNames[type] || type };
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-400 mb-6">
            Please sign in or create an account to access the hatchery
          </p>
          <div className="space-y-3">
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-6 py-3 rounded-lg text-white font-bold transition-all"
            >
              Go to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  const eggTypes = [
    EGG_TYPES.BASIC,
    EGG_TYPES.PREMIUM,
    EGG_TYPES.COSMETIC,
    "MYSTERY",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Hatchery</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Discover amazing pets by hatching eggs.{" "}
            {!isConnected && "Connect your wallet for blockchain features!"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Egg Selection & Purchase */}
          <div className="space-y-6">
            {/* Egg Type Selection */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">
                Select Egg Type
              </h3>

              <div className="space-y-3">
                {eggTypes.map((eggType) => (
                  <button
                    key={eggType}
                    onClick={() => setSelectedEggType(eggType)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedEggType === eggType
                        ? "border-blue-500 bg-blue-500 bg-opacity-10"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white">{eggType} Egg</h4>
                        <p className="text-gray-400 text-sm">
                          Chance for{" "}
                          {eggType === EGG_TYPES.PREMIUM
                            ? "Uncommon+"
                            : eggType === "MYSTERY"
                            ? "Rare+"
                            : eggType === EGG_TYPES.COSMETIC
                            ? "Special Skins"
                            : "Common+"}{" "}
                          pets
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-yellow-400 font-bold">
                          {formatCurrency(getEggCost(eggType))}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Purchase Options */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => purchaseEgg(selectedEggType)}
                  disabled={
                    isPurchasing || user.coins < getEggCost(selectedEggType)
                  }
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg text-white font-bold transition-all flex items-center justify-center"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {isPurchasing ? "Purchasing..." : "Buy with Coins"}
                </button>

                {isConnected ? (
                  <div className="p-3 bg-green-500 bg-opacity-20 rounded-lg border border-green-500 text-center">
                    <div className="text-green-400 text-sm font-medium flex items-center justify-center">
                      <Wallet className="w-4 h-4 mr-2" />
                      Wallet Connected
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectWallet}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 py-3 rounded-lg text-white font-bold transition-all flex items-center justify-center"
                  >
                    <Wallet className="w-5 h-5 mr-2" />
                    Connect Wallet
                  </button>
                )}

                {/* Free Egg Claim */}
                <button
                  onClick={claimFreeEgg}
                  disabled={user.freeRolls === 0}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg text-white font-bold transition-all flex items-center justify-center"
                >
                  <Gift className="w-5 h-5 mr-2" />
                  Free Daily Egg ({user.freeRolls || 0} left)
                </button>
              </div>
            </div>

            {/* Egg Preview */}
            {eggPreview && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">
                  Possible Outcomes
                </h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {eggPreview.map((pet, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-8 h-8 rounded-full ${
                            formatTier(pet.tier).bgColor
                          } flex items-center justify-center text-white text-sm`}
                        >
                          {formatTier(pet.tier).emoji}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {pet.tier}
                          </div>
                          <div className="text-gray-400 text-sm">
                            {formatType(pet.type).name}
                          </div>
                        </div>
                      </div>
                      <div className="text-blue-400 text-sm font-medium">
                        {pet.probability}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center Column - Hatching Area */}
          <div className="space-y-8">
            {/* Egg Display & Hatching */}
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <div className="text-center">
                {showHatchAnimation ? (
                  <HatchAnimation
                    isHatching={showHatchAnimation}
                    onComplete={() => setShowHatchAnimation(false)}
                    eggType={selectedEggType}
                  />
                ) : (
                  <>
                    <div className="w-48 h-48 mx-auto mb-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-6xl float-animation relative">
                      🥚
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">
                      {selectedEggType} Egg
                    </h3>
                    <p className="text-gray-400 mb-6">
                      Ready to hatch an amazing pet!
                    </p>

                    {/* Hatch Options */}
                    <div className="space-y-4">
                      <button
                        onClick={quickHatch}
                        disabled={
                          isHatching ||
                          (user.freeRolls === 0 &&
                            user.coins < (GAME_CONFIG?.HATCH_COST || 50))
                        }
                        className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-lg text-white font-bold text-lg transition-all transform hover:scale-105"
                      >
                        {isHatching ? (
                          <span className="flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Hatching...
                          </span>
                        ) : user.freeRolls > 0 ? (
                          `Hatch with Free Roll (${user.freeRolls} left)`
                        ) : (
                          `Hatch Egg (${GAME_CONFIG?.HATCH_COST || 50} Coins)`
                        )}
                      </button>

                      {isConnected && (
                        <div className="flex items-center justify-center space-x-2 p-3 bg-gray-700 rounded-lg">
                          <input
                            type="checkbox"
                            id="blockchainHatch"
                            checked={useBlockchainHatch}
                            onChange={(e) =>
                              setUseBlockchainHatch(e.target.checked)
                            }
                            disabled={isHatching}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label
                            htmlFor="blockchainHatch"
                            className="text-gray-300 text-sm"
                          >
                            Hatch on Blockchain
                          </label>
                          <Sparkles className="w-4 h-4 text-purple-400" />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Newly Hatched Pet */}
            {newlyHatchedPet && !showHatchAnimation && (
              <div className="bg-gray-800 rounded-2xl p-6 border-2 border-green-500 animate-pulse">
                <h3 className="text-xl font-bold text-white mb-4 text-center flex items-center justify-center">
                  <Sparkles className="w-5 h-5 mr-2 text-yellow-400" />
                  New Pet Hatched!
                  <Sparkles className="w-5 h-5 ml-2 text-yellow-400" />
                </h3>
                <div className="flex justify-center">
                  <div className="w-64">
                    <PetCard pet={newlyHatchedPet} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Stats & Inventory */}
          <div className="space-y-6">
            {/* Player Stats */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Your Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-yellow-400 mb-2">
                    <Coins className="w-5 h-5" />
                    <span className="font-bold">Coins</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatCurrency(user.coins || 0)}
                  </div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-400 mb-2">
                    <Gift className="w-5 h-5" />
                    <span className="font-bold">Free Rolls</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {user.freeRolls || 0}
                  </div>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="text-center p-2 bg-gray-700 rounded">
                  <div className="text-white font-bold">{pets.length}</div>
                  <div className="text-gray-400">Total Pets</div>
                </div>
                <div className="text-center p-2 bg-gray-700 rounded">
                  <div className="text-white font-bold">{eggs.length}</div>
                  <div className="text-gray-400">Total Eggs</div>
                </div>
              </div>
            </div>

            {/* Egg Inventory */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Your Eggs</h3>
                <span className="text-gray-400 text-sm">
                  {eggs.length} total
                </span>
              </div>

              {eggs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🥚</div>
                  <p className="text-gray-400">No eggs yet</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Purchase some eggs to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {eggs.slice(0, 5).map((egg, index) => (
                    <div
                      key={egg.id || index}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                          🥚
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {egg.eggType || EGG_TYPES.BASIC} Egg
                          </div>
                          <div className="text-gray-400 text-sm capitalize">
                            {egg.rarity?.toLowerCase() || "common"} •{" "}
                            {egg.isHatched ? "Hatched" : "Ready to hatch"}
                          </div>
                        </div>
                      </div>
                      {!egg.isHatched && (
                        <button
                          onClick={() => hatchEgg(egg.id)}
                          disabled={isHatching}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded text-white text-sm transition-colors"
                        >
                          Hatch
                        </button>
                      )}
                    </div>
                  ))}

                  {eggs.length > 5 && (
                    <div className="text-center pt-2">
                      <span className="text-gray-400 text-sm">
                        +{eggs.length - 5} more eggs
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pet Inventory Summary */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">
                Your Pets ({pets.length})
              </h3>
              {pets.length === 0 ? (
                <p className="text-gray-400 text-center py-4">
                  No pets yet. Hatch some eggs!
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Tier Summary */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.values(PET_RARITIES).map((tier) => {
                      const count = pets.filter(
                        (pet) => pet.tier === tier
                      ).length;
                      if (count === 0) return null;

                      return (
                        <div
                          key={tier}
                          className="flex items-center justify-between p-2 bg-gray-700 rounded"
                        >
                          <span
                            className={`${
                              formatTier(tier).textColor
                            } font-medium flex items-center space-x-1`}
                          >
                            <span>{formatTier(tier).emoji}</span>
                            <span>{tier}</span>
                          </span>
                          <span className="text-white font-bold">{count}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-gray-600 text-center">
                    <p className="text-gray-400 text-sm">
                      View all pets in your collection
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hatchery;
