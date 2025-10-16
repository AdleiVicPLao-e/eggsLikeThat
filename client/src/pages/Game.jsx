import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useGame } from "../context/GameContext";
import { useGameAPI } from "../hooks/useGameAPI";
import Button from "../components/UI/Button";
import PetCard from "../components/Pets/PetCard";
import BattleInterface from "../components/Game/BattleInterface";
import {
  Sword,
  Shield,
  Zap,
  Users,
  Trophy,
  Coins,
  Sparkles,
  AlertCircle,
  Crown,
  Target,
} from "lucide-react";
import { TIERS, TYPES, GAME_CONFIG } from "../utils/constants";
import {
  formatTier,
  formatType,
  formatCurrency,
  formatNumber,
} from "../utils/rarity";
import { rng } from "../utils/rollSystem";

const Game = () => {
  const { user, isAuthenticated } = useUser();
  const {
    pets,
    coins,
    updateCoins,
    updateExperience,
    battleTeam,
    addToBattleTeam,
    removeFromBattleTeam,
    clearBattleTeam,
  } = useGame();
  const { startBattle: apiStartBattle, loading, error } = useGameAPI();

  const [selectedPets, setSelectedPets] = useState([]);
  const [battleMode, setBattleMode] = useState(null); // 'pve', 'pvp', 'tournament'
  const [battleInProgress, setBattleInProgress] = useState(false);
  const [battleResult, setBattleResult] = useState(null);
  const [opponentPets, setOpponentPets] = useState([]);
  const [battleLog, setBattleLog] = useState([]);
  const [showBattleTips, setShowBattleTips] = useState(true);

  // Battle types with shared constants integration
  const battleTypes = [
    {
      mode: "pve",
      title: "Adventure Mode",
      description: "Battle against AI opponents to earn coins and experience",
      icon: Shield,
      difficulty: "Beginner",
      reward: { coins: 50, experience: 25 },
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
      reward: { coins: 100, experience: 50 },
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
      reward: { coins: 500, experience: 250 },
      requirements: "3 pets, Level 10+",
      minPets: 3,
      maxPets: 3,
      unlockLevel: 10,
      color: "from-yellow-500 to-red-600",
    },
  ];

  // Generate opponent pets based on player's team
  const generateOpponentPets = (playerPets, difficulty = "medium") => {
    const avgLevel =
      playerPets.reduce((sum, pet) => sum + pet.level, 0) / playerPets.length;

    const difficultyMultipliers = {
      easy: { level: 0.8, tier: "UNCOMMON" },
      medium: { level: 1.0, tier: "RARE" },
      hard: { level: 1.2, tier: "EPIC" },
    };

    const config =
      difficultyMultipliers[difficulty] || difficultyMultipliers.medium;

    return Array.from(
      { length: Math.min(playerPets.length, 3) },
      (_, index) => {
        const tier = rng.rollTier();
        const type = rng.rollType();
        const stats = rng.generateStats(tier);
        const abilities = rng.rollAbilities(type, tier);

        return {
          id: `opponent_${Date.now()}_${index}`,
          name: `Wild ${formatType(type).name}`,
          tier,
          type,
          abilities,
          stats,
          level: Math.max(1, Math.round(avgLevel * config.level)),
          isOpponent: true,
        };
      }
    );
  };

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

    setBattleMode(mode);
    setBattleInProgress(true);
    setBattleResult(null);
    setBattleLog([]);

    // Generate opponent pets for PvE
    if (mode === "pve") {
      const opponents = generateOpponentPets(selectedPets, "medium");
      setOpponentPets(opponents);

      // Log battle start
      setBattleLog((prev) => [
        ...prev,
        {
          type: "info",
          message: `🏁 Battle started! Your team vs ${opponents.length} wild pets.`,
          timestamp: new Date().toISOString(),
        },
        {
          type: "info",
          message: "💡 Use type advantages to deal extra damage!",
          timestamp: new Date().toISOString(),
        },
      ]);
    } else {
      // For PvP and tournament, use AI opponents with better stats
      const opponents = generateOpponentPets(
        selectedPets,
        mode === "tournament" ? "hard" : "medium"
      );
      setOpponentPets(opponents);

      const modeName = mode === "tournament" ? "Champions Arena" : "PvP Arena";
      setBattleLog((prev) => [
        ...prev,
        {
          type: "info",
          message: `⚔️ ${modeName} battle starting!`,
          timestamp: new Date().toISOString(),
        },
        {
          type: "warning",
          message: "🎯 Opponents are strong! Use strategy to win!",
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    try {
      // Call backend to start battle
      const battleData = {
        petIds: selectedPets.map((pet) => pet.id),
        battleMode: mode,
        opponentDifficulty: mode === "tournament" ? "hard" : "medium",
      };

      const result = await apiStartBattle(battleData);

      if (result?.data?.battle) {
        // Use backend battle result if available
        handleBattleComplete(result.data.battle, result.data.rewards);
      } else {
        // Fallback to client-side simulation
        simulateBattleResult(mode);
      }
    } catch (error) {
      console.error("Battle error:", error);
      // Fallback to client-side simulation
      simulateBattleResult(mode);
    }
  };

  const simulateBattleResult = (mode) => {
    const battleConfig = battleTypes.find((b) => b.mode === mode);

    // More sophisticated battle simulation
    const playerPower = calculateTeamPower(selectedPets);
    const opponentPower = calculateTeamPower(opponentPets);

    // Add some randomness and type advantages
    const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    const adjustedPlayerPower = playerPower * randomFactor;
    const typeAdvantage = calculateTypeAdvantage(selectedPets, opponentPets);

    const totalPlayerPower = adjustedPlayerPower * (1 + typeAdvantage);
    const victory = totalPlayerPower > opponentPower;

    const result = {
      winner: victory ? "player" : "opponent",
      critical: randomFactor > 1.1,
      playerPower: Math.round(totalPlayerPower),
      opponentPower: Math.round(opponentPower),
      typeAdvantage:
        typeAdvantage > 0
          ? "advantage"
          : typeAdvantage < 0
          ? "disadvantage"
          : "neutral",
    };

    const rewards = battleConfig?.reward || { coins: 50, experience: 25 };

    // Simulate battle rounds
    simulateBattleRounds(result);

    setTimeout(() => {
      handleBattleComplete(result, rewards);
    }, 3000);
  };

  const simulateBattleRounds = (result) => {
    const rounds = 3 + Math.floor(Math.random() * 3); // 3-5 rounds

    for (let i = 1; i <= rounds; i++) {
      setTimeout(() => {
        const roundEvents = generateRoundEvents(i, result);
        setBattleLog((prev) => [...prev, ...roundEvents]);
      }, i * 600);
    }
  };

  const generateRoundEvents = (round, result) => {
    const events = [];

    events.push({
      type: "info",
      message: `🔄 Round ${round} begins...`,
      timestamp: new Date().toISOString(),
    });

    // Simulate some battle actions
    if (Math.random() > 0.3) {
      const playerPet =
        selectedPets[Math.floor(Math.random() * selectedPets.length)];
      const opponentPet =
        opponentPets[Math.floor(Math.random() * opponentPets.length)];

      events.push({
        type: "attack",
        message: `⚡ ${playerPet.name} uses ${
          playerPet.abilities?.[0] || "Attack"
        }!`,
        timestamp: new Date().toISOString(),
      });

      if (Math.random() > 0.7) {
        events.push({
          type: result.winner === "player" ? "victory" : "defeat",
          message: `🎯 Critical hit!`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return events;
  };

  const calculateTeamPower = (team) => {
    return team.reduce((power, pet) => {
      const basePower =
        pet.stats.attack + pet.stats.defense + pet.stats.speed * 0.5;
      const tierMultiplier = TIERS[pet.tier]?.statMultiplier || 1;
      const levelMultiplier = 1 + (pet.level - 1) * 0.15;
      return power + basePower * tierMultiplier * levelMultiplier;
    }, 0);
  };

  const calculateTypeAdvantage = (playerTeam, opponentTeam) => {
    let advantage = 0;

    playerTeam.forEach((playerPet) => {
      opponentTeam.forEach((opponentPet) => {
        const playerType = TYPES[playerPet.type];
        const opponentType = TYPES[opponentPet.type];

        if (playerType?.strongAgainst?.includes(opponentPet.type)) {
          advantage += 0.1;
        }
        if (opponentType?.strongAgainst?.includes(playerPet.type)) {
          advantage -= 0.1;
        }
      });
    });

    return advantage;
  };

  const handleBattleComplete = (result, rewards) => {
    setBattleInProgress(false);

    const victory = result.winner === "player";
    const rewardMultiplier = victory ? 1 : 0.3;

    const finalRewards = {
      coins: Math.floor(rewards.coins * rewardMultiplier),
      experience: Math.floor(rewards.experience * rewardMultiplier),
    };

    setBattleResult({
      victory,
      message: victory ? "Victory!" : "Defeat!",
      rewards: finalRewards,
      critical: result.critical,
      playerPower: result.playerPower,
      opponentPower: result.opponentPower,
      typeAdvantage: result.typeAdvantage,
    });

    // Update player rewards
    updateCoins(finalRewards.coins);
    updateExperience(finalRewards.experience);

    // Add battle conclusion to log
    setBattleLog((prev) => [
      ...prev,
      {
        type: victory ? "victory" : "defeat",
        message: `🏁 Battle ${victory ? "won" : "lost"}! ${
          result.critical ? "🎯 Critical hit!" : ""
        }`,
        timestamp: new Date().toISOString(),
      },
      {
        type: "info",
        message: `💰 Earned ${finalRewards.coins} coins and ${finalRewards.experience} EXP`,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const resetBattle = () => {
    setBattleMode(null);
    setBattleInProgress(false);
    setBattleResult(null);
    setOpponentPets([]);
    setBattleLog([]);
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
              <span>
                {selectedPets.length} vs {opponentPets.length}
              </span>
            </div>
          </div>

          <BattleInterface
            playerPets={selectedPets}
            opponentPets={opponentPets}
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
            {battleResult.critical && (
              <Sparkles className="w-8 h-8 text-yellow-300 inline-block ml-2 animate-pulse" />
            )}
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">
            {battleResult.message}
          </h2>

          {battleResult.critical && (
            <div className="text-yellow-300 text-lg mb-4 flex items-center justify-center">
              <Sparkles className="w-5 h-5 mr-2" />
              Critical Victory!
            </div>
          )}

          {/* Battle Stats */}
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
              <div>
                <div>Your Power</div>
                <div className="text-green-400 font-bold">
                  {battleResult.playerPower}
                </div>
              </div>
              <div>
                <div>Opponent Power</div>
                <div className="text-red-400 font-bold">
                  {battleResult.opponentPower}
                </div>
              </div>
            </div>
            {battleResult.typeAdvantage !== "neutral" && (
              <div className="mt-2 text-sm">
                Type{" "}
                {battleResult.typeAdvantage === "advantage"
                  ? "👍 Advantage"
                  : "👎 Disadvantage"}
              </div>
            )}
          </div>

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
            level up! Use type advantages and special abilities to dominate your
            opponents.
          </p>
        </div>

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
                    <span className="font-bold">{formatNumber(coins)}</span>
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
                  {selectedPets.map((pet, index) => (
                    <div key={pet.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center space-x-3 mb-3">
                        <div
                          className={`w-12 h-12 rounded-lg ${
                            formatType(pet.type).bgColor
                          } flex items-center justify-center`}
                        >
                          <span className="text-xl">
                            {formatType(pet.type).emoji}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="text-white font-bold">{pet.name}</div>
                          <div className="text-gray-400 text-sm">
                            Lvl {pet.level} • {formatTier(pet.tier).name}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-center p-2 bg-gray-600 rounded">
                          <div className="text-red-400 font-bold">
                            {pet.stats.attack}
                          </div>
                          <div className="text-gray-400">ATK</div>
                        </div>
                        <div className="text-center p-2 bg-gray-600 rounded">
                          <div className="text-blue-400 font-bold">
                            {pet.stats.defense}
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
                  ))}
                </div>

                {/* Team Power Summary */}
                <div className="pt-4 border-t border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Team Power:</span>
                    <span className="text-yellow-400 font-bold text-lg">
                      {calculateTeamPower(selectedPets).toLocaleString()}
                    </span>
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

                          {/* Rewards */}
                          <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-gray-600">
                            <span className="text-gray-400">
                              Victory Rewards
                            </span>
                            <span className="flex items-center text-yellow-400 font-bold">
                              <Coins className="w-3 h-3 mr-1" />+
                              {formatNumber(battle.reward.coins)}
                              <Zap className="w-3 h-3 ml-2 mr-1" />+
                              {formatNumber(battle.reward.experience)}
                            </span>
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
                      <strong>Type Advantages:</strong> Fire beats Nature,
                      Nature beats Water, Water beats Fire
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>
                      <strong>Team Balance:</strong> Mix different types to
                      counter various opponents
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>
                      <strong>Higher Tiers:</strong> Legendary pets have
                      significantly better stats
                    </span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <span>
                      <strong>Level Up:</strong> Each level increases pet stats
                      by 10%
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
                    {Math.max(...pets.map((p) => p.level), 1)}
                  </div>
                  <div className="text-gray-400">Highest Pet Level</div>
                </div>
                <div className="text-center p-3 bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-purple-400">
                    {pets.filter((p) => p.tier === "LEGENDARY").length}
                  </div>
                  <div className="text-gray-400">Legendary Pets</div>
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
