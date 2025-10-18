import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useGame } from "../context/GameContext";
import Button from "../components/UI/Button";
import PetCard from "../components/Pets/PetCard";
import BattleInterface from "../components/Game/BattleInterface";
import {
  Shield,
  Users,
  Trophy,
  Coins,
  Sparkles,
  AlertCircle,
  Target,
  Zap,
} from "lucide-react";

// Frontend-only constants based on backend data
const GAME_CONFIG = {
  BATTLE_MAX_PETS: 3,
};

// Pet tiers based on backend structure
const PET_TIERS = {
  COMMON: { name: "Common", color: "text-gray-400" },
  UNCOMMON: { name: "Uncommon", color: "text-green-400" },
  RARE: { name: "Rare", color: "text-blue-400" },
  EPIC: { name: "Epic", color: "text-purple-400" },
  LEGENDARY: { name: "Legendary", color: "text-yellow-400" },
  MYTHIC: { name: "Mythic", color: "text-red-400" },
  CELESTIAL: { name: "Celestial", color: "text-indigo-400" },
  EXOTIC: { name: "Exotic", color: "text-pink-400" },
  ULTIMATE: { name: "Ultimate", color: "text-orange-400" },
  GODLY: { name: "Godly", color: "text-amber-400" },
};

// Pet types based on backend structure
const PET_TYPES = {
  FIRE: {
    name: "Fire",
    bgColor: "bg-red-500",
    textColor: "text-red-400",
    emoji: "🔥",
    description: "Fire-type pets excel in attack power",
    strengths: ["AIR", "LIGHT"],
    weaknesses: ["WATER", "DARK"],
  },
  WATER: {
    name: "Water",
    bgColor: "bg-blue-500",
    textColor: "text-blue-400",
    emoji: "💧",
    description: "Water-type pets have balanced stats and healing",
    strengths: ["FIRE", "EARTH"],
    weaknesses: ["AIR", "LIGHT"],
  },
  EARTH: {
    name: "Earth",
    bgColor: "bg-green-500",
    textColor: "text-green-400",
    emoji: "🌍",
    description: "Earth-type pets have high defense and HP",
    strengths: ["WATER", "AIR"],
    weaknesses: ["FIRE", "DARK"],
  },
  AIR: {
    name: "Air",
    bgColor: "bg-cyan-500",
    textColor: "text-cyan-400",
    emoji: "💨",
    description: "Air-type pets are fast with high evasion",
    strengths: ["WATER", "EARTH"],
    weaknesses: ["FIRE", "LIGHT"],
  },
  LIGHT: {
    name: "Light",
    bgColor: "bg-yellow-500",
    textColor: "text-yellow-400",
    emoji: "✨",
    description: "Light-type pets have healing and support abilities",
    strengths: ["DARK", "EARTH"],
    weaknesses: ["FIRE", "AIR"],
  },
  DARK: {
    name: "Dark",
    bgColor: "bg-purple-500",
    textColor: "text-purple-400",
    emoji: "🌑",
    description: "Dark-type pets have debuffs and high critical chance",
    strengths: ["LIGHT", "AIR"],
    weaknesses: ["WATER", "EARTH"],
  },
};

const Game = () => {
  const { user, isAuthenticated } = useUser();
  const {
    pets,
    battleTeam,
    addToBattleTeam,
    removeFromBattleTeam,
    clearBattleTeam,
    gameAPI,
    isLoading: gameLoading,
  } = useGame();

  const [selectedPets, setSelectedPets] = useState([]);
  const [battleMode, setBattleMode] = useState(null);
  const [battleInProgress, setBattleInProgress] = useState(false);
  const [battleResult, setBattleResult] = useState(null);
  const [battleLog, setBattleLog] = useState([]);
  const [showBattleTips, setShowBattleTips] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Battle types configuration - purely UI
  const battleTypes = [
    {
      mode: "pve",
      title: "Adventure Mode",
      description: "Battle against AI opponents to earn coins and experience",
      icon: Shield,
      difficulty: "Beginner",
      requirements: "1+ pets",
      minPets: 1,
      maxPets: 3,
      unlockLevel: 1,
      color: "from-green-500 to-emerald-600",
    },
    {
      mode: "pvp",
      title: "Player vs Player",
      description: "Challenge other players in competitive battles",
      icon: Users,
      difficulty: "Intermediate",
      requirements: "3 pets, Level 5+",
      minPets: 3,
      maxPets: 3,
      unlockLevel: 5,
      color: "from-blue-500 to-purple-600",
    },
    {
      mode: "tournament",
      title: "Champions Arena",
      description: "Join weekly tournaments for exclusive rewards",
      icon: Trophy,
      difficulty: "Expert",
      requirements: "3 pets, Level 10+",
      minPets: 3,
      maxPets: 3,
      unlockLevel: 10,
      color: "from-yellow-500 to-red-600",
    },
  ];

  // Load battle team from context
  useEffect(() => {
    if (battleTeam.length > 0) {
      setSelectedPets(battleTeam);
    }
  }, [battleTeam]);

  const handlePetSelect = (pet) => {
    if (selectedPets.find((p) => p.id === pet.id)) {
      const newSelection = selectedPets.filter((p) => p.id !== pet.id);
      setSelectedPets(newSelection);
      removeFromBattleTeam(pet.id);
    } else if (selectedPets.length < GAME_CONFIG.BATTLE_MAX_PETS) {
      const newSelection = [...selectedPets, pet];
      setSelectedPets(newSelection);
      addToBattleTeam(pet.id);
    } else {
      alert(
        `Maximum ${GAME_CONFIG.BATTLE_MAX_PETS} pets allowed in battle team`
      );
    }
  };

  const canStartBattle = (mode) => {
    const battleConfig = battleTypes.find((b) => b.mode === mode);
    if (!battleConfig) return false;

    if (selectedPets.length < battleConfig.minPets) {
      alert(
        `Need at least ${battleConfig.minPets} pets for ${battleConfig.title}`
      );
      return false;
    }
    if (selectedPets.length > battleConfig.maxPets) {
      alert(
        `Maximum ${battleConfig.maxPets} pets allowed for ${battleConfig.title}`
      );
      return false;
    }
    if ((user?.level || 1) < battleConfig.unlockLevel) {
      alert(
        `Level ${battleConfig.unlockLevel} required for ${battleConfig.title}`
      );
      return false;
    }

    return true;
  };

  const startBattle = async (mode) => {
    if (!canStartBattle(mode)) return;

    setLoading(true);
    setError(null);
    setBattleMode(mode);
    setBattleInProgress(true);
    setBattleResult(null);
    setBattleLog([]);

    try {
      // Log battle start
      setBattleLog((prev) => [
        ...prev,
        {
          type: "info",
          message: `🏁 Starting ${mode.toUpperCase()} battle...`,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Call backend through GameContext API
      const battleData = {
        petIds: selectedPets.map((pet) => pet.id),
        battleMode: mode,
      };

      const result = await gameAPI.startBattle(battleData);

      if (result?.success) {
        // Use backend battle result
        handleBattleComplete(result.data);
      } else {
        throw new Error(result?.error || "Battle failed");
      }
    } catch (error) {
      console.error("Battle error:", error);
      setError(error.message || "Failed to start battle");
      setBattleInProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBattleComplete = (battleData) => {
    setBattleInProgress(false);

    // Use the battle result from backend
    const result = battleData.battle;
    const rewards = battleData.rewards || { coins: 0, experience: 0 };

    setBattleResult({
      victory: result.victory,
      message: result.victory ? "Victory!" : "Defeat!",
      rewards: rewards,
      battleData: result,
    });

    // Log battle completion
    setBattleLog((prev) => [
      ...prev,
      {
        type: result.victory ? "victory" : "defeat",
        message: `🏁 Battle ${result.victory ? "won" : "lost"}!`,
        timestamp: new Date().toISOString(),
      },
      {
        type: "info",
        message: `💰 Earned ${rewards.coins} coins and ${rewards.experience} EXP`,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const resetBattle = () => {
    setBattleMode(null);
    setBattleInProgress(false);
    setBattleResult(null);
    setBattleLog([]);
    setError(null);
  };

  const getBattleRequirementStatus = (battle) => {
    const userLevel = user?.level || 1;
    const hasEnoughPets =
      selectedPets.length >= battle.minPets &&
      selectedPets.length <= battle.maxPets;
    const hasRequiredLevel = userLevel >= battle.unlockLevel;

    return {
      canPlay: hasEnoughPets && hasRequiredLevel,
      missingPets: selectedPets.length < battle.minPets,
      tooManyPets: selectedPets.length > battle.maxPets,
      levelTooLow: userLevel < battle.unlockLevel,
    };
  };

  // Helper function to format numbers
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  // Helper function to get type info
  const getTypeInfo = (type) => {
    return (
      PET_TYPES[type] || {
        name: "Unknown",
        bgColor: "bg-gray-500",
        textColor: "text-gray-400",
        emoji: "❓",
      }
    );
  };

  // Helper function to get tier info
  const getTierInfo = (tier) => {
    return PET_TIERS[tier] || { name: "Unknown", color: "text-gray-400" };
  };

  // Get type advantages for battle tips
  const getTypeAdvantageTips = () => {
    const tips = [];

    // Add type advantage explanations
    Object.entries(PET_TYPES).forEach(([type, data]) => {
      if (data.strengths && data.strengths.length > 0) {
        const strongAgainst = data.strengths
          .map((strength) => PET_TYPES[strength]?.name)
          .join(", ");
        tips.push(`${data.name} beats ${strongAgainst}`);
      }
    });

    return tips;
  };

  // Battle in progress view
  if (battleInProgress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">Battle Arena</h1>
            <div className="flex items-center justify-center space-x-4 text-gray-300">
              <span className="capitalize">{battleMode}</span>
              <span>•</span>
              <span>
                {battleTypes.find((b) => b.mode === battleMode)?.difficulty}
              </span>
              <span>•</span>
              <span>{selectedPets.length} pets</span>
            </div>
            {loading && (
              <div className="text-blue-400 mt-2">Battle in progress...</div>
            )}
          </div>

          <BattleInterface
            playerPets={selectedPets}
            battleLog={battleLog}
            onBattleComplete={handleBattleComplete}
            mode={battleMode}
          />
        </div>
      </div>
    );
  }

  // Battle result view
  if (battleResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <div
          className={`bg-gray-800 rounded-2xl p-8 border-2 max-w-md w-full text-center ${
            battleResult.victory ? "border-yellow-500" : "border-red-500"
          }`}
        >
          <div
            className={`text-6xl mb-4 ${
              battleResult.victory
                ? "text-yellow-400 animate-bounce"
                : "text-red-400"
            }`}
          >
            {battleResult.victory ? "🏆" : "💀"}
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">
            {battleResult.message}
          </h2>

          {/* Rewards */}
          <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-lg p-4 mb-6">
            <div className="space-y-2 text-white">
              <div className="flex items-center justify-center space-x-2">
                <Coins className="w-5 h-5" />
                <span className="text-lg font-bold">
                  +{formatNumber(battleResult.rewards.coins)} Coins
                </span>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <Zap className="w-5 h-5" />
                <span className="text-lg font-bold">
                  +{formatNumber(battleResult.rewards.experience)} EXP
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button onClick={resetBattle} variant="primary" className="w-full">
              {battleResult.victory ? "Continue Battling" : "Try Again"}
            </Button>
            <Button
              onClick={() => (window.location.href = "/hatchery")}
              variant="outline"
              className="w-full"
            >
              Hatch More Pets
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚔️</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Join the Battle Arena!
          </h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Create an account or sign in to test your pets in epic battles and
            earn amazing rewards
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => (window.location.href = "/")}
              variant="primary"
              className="w-full"
            >
              Create Free Account
            </Button>
            <Button
              onClick={() => (window.location.href = "/")}
              variant="outline"
              className="w-full"
            >
              Learn More
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const typeAdvantageTips = getTypeAdvantageTips();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl flex items-center justify-center text-2xl">
              ⚔️
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Battle Arena</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Test your pets in strategic battles. Earn coins and experience to
            level up!
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pet Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pet Selection */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Select Your Battle Team
                </h2>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-yellow-400">
                    <Coins className="w-5 h-5" />
                    <span className="font-bold">
                      {formatNumber(user?.coins || 0)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-400">
                    <Zap className="w-5 h-5" />
                    <span className="font-bold">Lvl {user?.level || 1}</span>
                  </div>
                </div>
              </div>

              {pets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🐾</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    No Pets Available
                  </h3>
                  <p className="text-gray-400 mb-6">
                    You need pets to enter the battle arena!
                  </p>
                  <div className="space-y-3">
                    <Button
                      onClick={() => (window.location.href = "/hatchery")}
                      variant="primary"
                      className="w-full"
                    >
                      🥚 Hatch Some Eggs
                    </Button>
                    <Button
                      onClick={() => (window.location.href = "/marketplace")}
                      variant="outline"
                      className="w-full"
                    >
                      🛒 Browse Marketplace
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Selection Progress */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {[...Array(GAME_CONFIG.BATTLE_MAX_PETS)].map(
                        (_, index) => (
                          <div
                            key={index}
                            className={`w-4 h-4 rounded-full border-2 transition-all ${
                              selectedPets.length > index
                                ? "bg-green-500 border-green-500"
                                : "bg-transparent border-gray-600"
                            }`}
                          ></div>
                        )
                      )}
                    </div>
                    <span className="text-gray-400 text-sm">
                      {selectedPets.length}/{GAME_CONFIG.BATTLE_MAX_PETS} pets
                      selected
                    </span>
                  </div>

                  {/* Pet Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto custom-scrollbar">
                    {pets.map((pet) => (
                      <PetCard
                        key={pet.id}
                        pet={pet}
                        onSelect={handlePetSelect}
                        isSelected={selectedPets.some((p) => p.id === pet.id)}
                        showBattleStats={true}
                        compact={true}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Selected Team Preview */}
            {selectedPets.length > 0 && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">
                    Your Battle Team
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={clearBattleTeam}
                      variant="outline"
                      size="sm"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedPets.map((pet) => {
                    const typeInfo = getTypeInfo(pet.type);
                    const tierInfo = getTierInfo(pet.tier);
                    return (
                      <div key={pet.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <div
                            className={`w-12 h-12 rounded-lg ${typeInfo.bgColor} flex items-center justify-center`}
                          >
                            <span className="text-xl">{typeInfo.emoji}</span>
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-bold">
                              {pet.name}
                            </div>
                            <div className="text-gray-400 text-sm">
                              Lvl {pet.level || 1} •{" "}
                              <span className={tierInfo.color}>
                                {tierInfo.name}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="text-center p-2 bg-gray-600 rounded">
                            <div className="text-red-400 font-bold">
                              {pet.stats?.attack || 0}
                            </div>
                            <div className="text-gray-400">ATK</div>
                          </div>
                          <div className="text-center p-2 bg-gray-600 rounded">
                            <div className="text-blue-400 font-bold">
                              {pet.stats?.defense || 0}
                            </div>
                            <div className="text-gray-400">DEF</div>
                          </div>
                        </div>

                        {pet.abilities?.[0] && (
                          <div className="mt-2 text-xs text-center">
                            <span className="text-purple-400">
                              {pet.abilities[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Team Type Analysis */}
                <div className="pt-4 border-t border-gray-600">
                  <div className="text-sm text-gray-400">
                    <strong>Team Composition:</strong>{" "}
                    {[
                      ...new Set(
                        selectedPets.map((pet) => getTypeInfo(pet.type).name)
                      ),
                    ].join(", ")}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Battle Modes */}
          <div className="space-y-6">
            {/* Battle Modes */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Battle Modes</h3>
                <Target className="w-5 h-5 text-blue-400" />
              </div>

              <div className="space-y-4">
                {battleTypes.map((battle) => {
                  const Icon = battle.icon;
                  const requirements = getBattleRequirementStatus(battle);
                  const canPlay = requirements.canPlay;

                  return (
                    <div
                      key={battle.mode}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer transform hover:scale-105 ${
                        canPlay
                          ? `bg-gradient-to-r ${battle.color} bg-opacity-10 border-opacity-30 hover:border-opacity-100`
                          : "bg-gray-700 border-gray-600 opacity-60 cursor-not-allowed"
                      }`}
                      onClick={() => canPlay && startBattle(battle.mode)}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-12 h-12 rounded-lg bg-gradient-to-r ${battle.color} flex items-center justify-center`}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-white">
                              {battle.title}
                            </h4>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                battle.difficulty === "Beginner"
                                  ? "bg-green-500"
                                  : battle.difficulty === "Intermediate"
                                  ? "bg-blue-500"
                                  : "bg-red-500"
                              } text-white`}
                            >
                              {battle.difficulty}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mb-3">
                            {battle.description}
                          </p>

                          {/* Requirements */}
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">Team Size</span>
                              <span
                                className={
                                  requirements.missingPets
                                    ? "text-red-400"
                                    : "text-green-400"
                                }
                              >
                                {selectedPets.length}/{battle.maxPets}
                                {requirements.missingPets && " ❌"}
                                {!requirements.missingPets && " ✅"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-400">
                                Level Required
                              </span>
                              <span
                                className={
                                  requirements.levelTooLow
                                    ? "text-red-400"
                                    : "text-green-400"
                                }
                              >
                                Lvl {user?.level || 1}/{battle.unlockLevel}
                                {requirements.levelTooLow && " 🔒"}
                                {!requirements.levelTooLow && " ✅"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Battle Tips */}
            {showBattleTips && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-blue-500">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-white flex items-center">
                    <Sparkles className="w-5 h-5 mr-2 text-blue-400" />
                    Pro Battle Tips
                  </h3>
                  <button
                    onClick={() => setShowBattleTips(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>
                      <strong>Type Advantages:</strong> Use them to deal extra
                      damage!
                    </span>
                  </div>
                  {typeAdvantageTips.slice(0, 3).map((tip, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <span>{tip}</span>
                    </div>
                  ))}
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>
                      <strong>Higher Tiers:</strong>{" "}
                      {Object.keys(PET_TIERS)
                        .slice(-3)
                        .reverse()
                        .map((tier) => PET_TIERS[tier].name)
                        .join(", ")}{" "}
                      pets have superior stats
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">
                Battle Stats
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center p-3 bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-green-400">
                    {pets.length}
                  </div>
                  <div className="text-gray-400">Total Pets</div>
                </div>
                <div className="text-center p-3 bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-blue-400">
                    {user?.level || 1}
                  </div>
                  <div className="text-gray-400">Your Level</div>
                </div>
                <div className="text-center p-3 bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-400">
                    {Math.max(...pets.map((p) => p.level || 1), 1)}
                  </div>
                  <div className="text-gray-400">Highest Level</div>
                </div>
                <div className="text-center p-3 bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">
                    {
                      pets.filter((p) =>
                        [
                          "LEGENDARY",
                          "MYTHIC",
                          "CELESTIAL",
                          "EXOTIC",
                          "ULTIMATE",
                          "GODLY",
                        ].includes(p.tier)
                      ).length
                    }
                  </div>
                  <div className="text-gray-400">Rare+ Pets</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
