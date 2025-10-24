import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useGame } from "../context/GameContext";
import { useWallet } from "../hooks/useWallet";
import { gameAPI as directAPI } from "../services/api";
import PetCard from "../components/Pets/PetCard";
import HatchAnimation from "../components/Game/HatchAnimation";
import { Coins, Zap, Gift, Sparkles, ShoppingCart, Wallet } from "lucide-react";
import { EGG_TYPES, PET_RARITIES, CURRENCIES } from "../utils/constants";

const Hatchery = () => {
  const { user, isAuthenticated } = useUser();
  const {
    pets,
    eggs,
    addPet,
    addEgg,
    updateCoins,
    updateFreeRolls,
    gameAPI,
    loadGameData,
  } = useGame();
  const {
    account,
    isConnected,
    connect,
    registerWithWallet,
    loginWithWallet,
    getUserNFTs,
    networkConfig,
    switchNetwork,
    isLoading: walletLoading,
  } = useWallet();

  const [newlyHatchedPet, setNewlyHatchedPet] = useState(null);
  const [showHatchAnimation, setShowHatchAnimation] = useState(false);
  const [selectedEggType, setSelectedEggType] = useState(EGG_TYPES.BASIC);
  const [eggCatalog, setEggCatalog] = useState(null);
  const [useBlockchainHatch, setUseBlockchainHatch] = useState(false);
  const [isHatching, setIsHatching] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [blockchainPets, setBlockchainPets] = useState([]);
  const [blockchainEggs, setBlockchainEggs] = useState([]);

  // Load egg catalog when component mounts
  useEffect(() => {
    if (isAuthenticated) {
      loadEggCatalog();
    }
  }, [isAuthenticated]);

  // Load blockchain NFTs when wallet connects
  useEffect(() => {
    if (isConnected && account) {
      loadBlockchainNFTs();
    }
  }, [isConnected, account]);

  const loadEggCatalog = async () => {
    try {
      // Use direct API import for missing methods
      const result = await directAPI.eggs.getEggCatalog();
      if (result.data.success) {
        setEggCatalog(result.data.data.catalog);
      }
    } catch (error) {
      console.error("Failed to load egg catalog:", error);
    }
  };

  const loadBlockchainNFTs = async () => {
    try {
      const result = await getUserNFTs();
      if (result.success) {
        setBlockchainPets(result.pets || []);
        setBlockchainEggs(result.eggs || []);
      }
    } catch (error) {
      console.error("Failed to load blockchain NFTs:", error);
    }
  };

  // Handle wallet connection
  const handleConnectWallet = async () => {
    const result = await connect();
    if (result.success) {
      const loginResult = await loginWithWallet();
      if (!loginResult.success) {
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

      if (result.data.success) {
        // Use addEgg from GameContext to add the new egg
        const newEgg = result.data.data.egg;
        addEgg(newEgg);

        updateCoins(-newEgg.purchasePrice);
        alert(`Purchased ${eggType} egg successfully!`);
      } else {
        alert(result.data.error || "Purchase failed");
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
      if (result.data.success) {
        // Use addEgg from GameContext to add the free egg
        const newEgg = result.data.data.egg;
        addEgg(newEgg);

        updateFreeRolls(-1);
        alert("Free egg claimed successfully!");
      } else {
        alert(result.data.error || "Failed to claim free egg");
      }
    } catch (error) {
      console.error("Failed to claim free egg:", error);
      alert(`Failed to claim free egg: ${error.message}`);
    }
  };

  // Hatch a specific egg - FIXED VERSION
  // Hatch a specific egg - FIXED VERSION
  const hatchEgg = async (eggId) => {
    if (!isAuthenticated) return;

    setIsHatching(true);
    setShowHatchAnimation(true);

    try {
      console.log("Attempting to hatch egg:", eggId);

      // FIX: Use direct API call instead of going through the hook
      const result = await gameAPI.eggs.hatchEgg(eggId);
      console.log("Raw API response:", result);

      // The response structure from axios is different
      if (result.data && result.data.success) {
        const responseData = result.data;

        if (responseData.data && responseData.data.result) {
          const hatchResult = responseData.data.result;

          if (hatchResult.type === "Pet") {
            addPet(hatchResult.data);
            setNewlyHatchedPet(hatchResult.data);
            console.log("New pet hatched:", hatchResult.data);
          }

          // Update user stats
          if (responseData.data.user) {
            console.log("Updated user data:", responseData.data.user);
            // Update the user context with new data
            updateProfile(responseData.data.user);
          }

          // Reload game data to refresh eggs and pets
          await loadGameData();

          setTimeout(() => {
            setShowHatchAnimation(false);
            setIsHatching(false);
          }, 3000);
        } else {
          throw new Error(
            responseData.message || "Hatching failed - no result data"
          );
        }
      } else {
        throw new Error(result.data?.message || "Hatching failed");
      }
    } catch (error) {
      console.error("Hatching failed:", error);
      console.error("Full error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      alert(`Hatching failed: ${error.message}`);
      setShowHatchAnimation(false);
      setIsHatching(false);
    }
  };

  // Add this to your Hatchery component
  const forceRefreshUserData = async () => {
    try {
      const response = await gameAPI.auth.getProfile();
      if (response.data.success) {
        console.log("User data refreshed:", response.data.data.user);
        // This should update your user context
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  // Call this when component mounts and after important actions
  useEffect(() => {
    if (isAuthenticated) {
      forceRefreshUserData();
    }
  }, [isAuthenticated]);

  // Quick hatch (purchase and hatch immediately)
  const quickHatch = async () => {
    if (!isAuthenticated) return;

    // First purchase the egg
    setIsPurchasing(true);
    try {
      const purchaseResult = await gameAPI.purchaseEgg({
        eggType: selectedEggType,
        currency: CURRENCIES.COINS,
      });

      if (purchaseResult.data.success) {
        const newEgg = purchaseResult.data.data.egg;
        // Use addEgg from GameContext to add the new egg
        addEgg(newEgg);
        updateCoins(-newEgg.purchasePrice);

        // Then immediately hatch it
        await hatchEgg(newEgg.id);
      } else {
        alert(purchaseResult.data.error || "Purchase failed");
      }
    } catch (error) {
      console.error("Quick hatch failed:", error);
      alert(`Quick hatch failed: ${error.message}`);
    } finally {
      setIsPurchasing(false);
    }
  };

  // Get unhatched eggs for display
  const getUnhatchedEggs = () => {
    return eggs.filter((egg) => !egg.isHatched);
  };

  // Get egg cost from catalog
  const getEggCost = (eggType) => {
    if (!eggCatalog || !eggCatalog[eggType]) return 100;
    return eggCatalog[eggType].costs.coins || 100;
  };

  // Get egg description from catalog
  const getEggDescription = (eggType) => {
    if (!eggCatalog || !eggCatalog[eggType]) return "A mysterious egg";
    return eggCatalog[eggType].description;
  };

  // Format currency for display - FIXED
  const formatCurrency = (amount, currency = CURRENCIES.COINS) => {
    if (!amount && amount !== 0) return "0"; // Handle undefined/null
    if (currency === CURRENCIES.ETH) {
      return `${amount} ETH`;
    }
    return amount.toLocaleString();
  };
  // Format tier for display
  // Format tier for display
  const formatTier = (tier) => {
    if (!tier) {
      return {
        emoji: "❓",
        bgColor: "bg-gray-500",
        textColor: "text-gray-300",
      };
    }

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

  // Check if we're on the correct network for blockchain features
  const isCorrectNetwork = networkConfig?.name === "localhost";

  // In your Hatchery component, add this debug useEffect
  useEffect(() => {
    console.log("User data:", user);
    console.log("Wallet coins:", user?.coins);
    console.log("Wallet balance:", user?.balance);
    console.log("Is authenticated:", isAuthenticated);
  }, [user, isAuthenticated]);

  // Get connection status message
  const getConnectionStatus = () => {
    if (!isConnected) {
      return (
        <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-3">
          <p className="text-yellow-400 text-sm">
            🔗 Connect your wallet for blockchain features
          </p>
        </div>
      );
    }

    if (!isCorrectNetwork) {
      return (
        <div className="bg-yellow-500 bg-opacity-20 border border-yellow-500 rounded-lg p-3">
          <p className="text-yellow-400 text-sm">
            🌐 Switch to localhost for blockchain hatching
          </p>
          <button
            onClick={() => switchNetwork(31337)}
            className="mt-2 px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
            disabled={walletLoading}
          >
            {walletLoading ? "Switching..." : "Switch to Localhost"}
          </button>
        </div>
      );
    }

    return (
      <div className="bg-green-500 bg-opacity-20 border border-green-500 rounded-lg p-3">
        <p className="text-green-400 text-sm">
          ✅ Connected to {account?.slice(0, 8)}... on {networkConfig.name}
        </p>
        <div className="mt-1 text-xs text-green-300">
          Blockchain pets: {blockchainPets.length} • Blockchain eggs:{" "}
          {blockchainEggs.length}
        </div>
      </div>
    );
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

  const eggTypes = [EGG_TYPES.BASIC, EGG_TYPES.COSMETIC, EGG_TYPES.ATTRIBUTE];
  const unhatchedEggs = getUnhatchedEggs();

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
            {/* Wallet Connection Status */}
            {getConnectionStatus()}

            {/* Egg Type Selection */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">
                Select Egg Type
              </h3>

              <div className="space-y-3">
                {eggTypes.map((eggType) => (
                  <button
                    key={`egg-type-${eggType}`}
                    onClick={() => setSelectedEggType(eggType)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedEggType === eggType
                        ? "border-blue-500 bg-blue-500 bg-opacity-10"
                        : "border-gray-600 hover:border-gray-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white capitalize">
                          {eggType} Egg
                        </h4>
                        <p className="text-gray-400 text-sm">
                          {getEggDescription(eggType)}
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

                {!isConnected && (
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

            {/* Egg Drop Rates from Catalog */}
            {eggCatalog &&
              eggCatalog[selectedEggType] &&
              eggCatalog[selectedEggType].dropRates && (
                <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                  <h3 className="text-xl font-bold text-white mb-4">
                    Drop Rates
                  </h3>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {Object.entries(eggCatalog[selectedEggType].dropRates).map(
                      ([rarity, rateData]) => {
                        // Handle both object format {name, chance} and simple number format
                        const rate =
                          typeof rateData === "object" && rateData !== null
                            ? rateData.chance
                            : rateData;
                        const displayName =
                          (typeof rateData === "object" && rateData !== null
                            ? rateData.name
                            : rarity) || "Unknown";

                        return (
                          <div
                            key={`drop-rate-${rarity}`}
                            className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                          >
                            <div className="flex items-center space-x-3">
                              <div
                                className={`w-8 h-8 rounded-full ${
                                  formatTier(rarity).bgColor
                                } flex items-center justify-center text-white text-sm`}
                              >
                                {formatTier(rarity).emoji}
                              </div>
                              <div>
                                <div className="text-white font-medium capitalize">
                                  {displayName?.toLowerCase() || "unknown"}
                                </div>
                              </div>
                            </div>
                            <div className="text-blue-400 text-sm font-medium">
                              {rate}%
                            </div>
                          </div>
                        );
                      }
                    )}
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

                    <h3 className="text-2xl font-bold text-white mb-2 capitalize">
                      {selectedEggType} Egg
                    </h3>
                    <p className="text-gray-400 mb-6">
                      {getEggDescription(selectedEggType)}
                    </p>

                    {/* Blockchain Hatch Option */}
                    {isConnected && (
                      <div className="mb-4 flex items-center justify-center space-x-2 p-3 bg-gray-700 rounded-lg">
                        <input
                          type="checkbox"
                          id="blockchainHatch"
                          checked={useBlockchainHatch}
                          onChange={(e) =>
                            setUseBlockchainHatch(e.target.checked)
                          }
                          disabled={isHatching || !isCorrectNetwork}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <label
                          htmlFor="blockchainHatch"
                          className="text-gray-300 text-sm flex items-center"
                        >
                          Hatch as NFT on Blockchain
                          <Sparkles className="w-4 h-4 text-purple-400 ml-1" />
                        </label>
                      </div>
                    )}

                    {/* Hatch Options */}
                    <div className="space-y-4">
                      <button
                        onClick={quickHatch}
                        disabled={
                          isHatching ||
                          isPurchasing ||
                          user.coins < getEggCost(selectedEggType) ||
                          (useBlockchainHatch && !isCorrectNetwork)
                        }
                        className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-lg text-white font-bold text-lg transition-all transform hover:scale-105"
                      >
                        {isHatching || isPurchasing ? (
                          <span className="flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            {isPurchasing ? "Purchasing..." : "Hatching..."}
                          </span>
                        ) : (
                          `Quick Hatch (${formatCurrency(
                            getEggCost(selectedEggType)
                          )})`
                        )}
                      </button>

                      {useBlockchainHatch && isCorrectNetwork && (
                        <div className="text-xs text-blue-400 text-center">
                          🚀 This pet will be minted as an NFT on the blockchain
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
                  {useBlockchainHatch ? "NFT Pet Minted!" : "New Pet Hatched!"}
                  <Sparkles className="w-5 h-5 ml-2 text-yellow-400" />
                </h3>
                <div className="flex justify-center">
                  <div className="w-64">
                    <PetCard pet={newlyHatchedPet} />
                  </div>
                </div>
                {useBlockchainHatch && (
                  <div className="mt-3 text-center">
                    <p className="text-green-400 text-sm">
                      ✅ Successfully minted on the blockchain!
                    </p>
                  </div>
                )}
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
                    {user?.coins !== undefined
                      ? user.coins.toLocaleString()
                      : "0"}
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
                  <div className="text-gray-400">Game Pets</div>
                </div>
                <div className="text-center p-2 bg-gray-700 rounded">
                  <div className="text-white font-bold">
                    {blockchainPets.length}
                  </div>
                  <div className="text-gray-400">NFT Pets</div>
                </div>
                <div className="text-center p-2 bg-gray-700 rounded">
                  <div className="text-white font-bold">{eggs.length}</div>
                  <div className="text-gray-400">Total Eggs</div>
                </div>
                <div className="text-center p-2 bg-gray-700 rounded">
                  <div className="text-white font-bold">
                    {unhatchedEggs.length}
                  </div>
                  <div className="text-gray-400">Ready to Hatch</div>
                </div>
              </div>
            </div>

            {/* Egg Inventory */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Your Eggs</h3>
                <span className="text-gray-400 text-sm">
                  {unhatchedEggs.length} ready • {blockchainEggs.length} NFT
                </span>
              </div>

              {unhatchedEggs.length === 0 && blockchainEggs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🥚</div>
                  <p className="text-gray-400">No eggs yet</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Purchase some eggs to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {/* Game Eggs */}
                  {unhatchedEggs.slice(0, 5).map((egg) => (
                    <div
                      key={`game-egg-${egg.id}`}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                          🥚
                        </div>
                        <div>
                          <div className="text-white font-medium capitalize">
                            {egg.type} Egg
                          </div>
                          <div className="text-gray-400 text-sm">
                            Ready to hatch
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => hatchEgg(egg.id)}
                        disabled={isHatching}
                        className="px-3 py-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded text-white text-sm transition-colors"
                      >
                        Hatch
                      </button>
                    </div>
                  ))}

                  {/* Blockchain Eggs */}
                  {blockchainEggs.slice(0, 2).map((egg, index) => (
                    <div
                      key={`blockchain-egg-${
                        egg.tokenId || egg.id || `index-${index}`
                      }`}
                      className="flex items-center justify-between p-3 bg-purple-700 rounded-lg border border-purple-500"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                          🥚
                        </div>
                        <div>
                          <div className="text-white font-medium flex items-center">
                            {egg.name}
                            <Sparkles className="w-3 h-3 text-purple-300 ml-1" />
                          </div>
                          <div className="text-purple-300 text-sm">
                            NFT • Balance: {egg.balance}
                          </div>
                        </div>
                      </div>
                      <div className="text-purple-300 text-xs">On Chain</div>
                    </div>
                  ))}

                  {(unhatchedEggs.length > 5 || blockchainEggs.length > 2) && (
                    <div className="text-center pt-2">
                      <span className="text-gray-400 text-sm">
                        +
                        {Math.max(unhatchedEggs.length - 5, 0) +
                          Math.max(blockchainEggs.length - 2, 0)}{" "}
                        more eggs
                      </span>
                    </div>
                  )}
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
