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

  // Battle types with shared constants integration
  const battleTypes = [
    {
      mode: "pve",
      title: "Player vs Environment",
      description: "Battle against AI opponents to earn coins and experience",
      icon: Shield,
      difficulty: "Easy",
      reward: { coins: 50, experience: 25 },
      requirements: "1+ pets",
      minPets: 1,
      maxPets: 3,
      unlockLevel: 1,
    },
    {
      mode: "pvp",
      title: "Player vs Player",
      description: "Challenge other players in competitive battles",
      icon: Users,
      difficulty: "Medium",
      reward: { coins: 100, experience: 50 },
      requirements: "3 pets, Level 5+",
      minPets: 3,
      maxPets: 3,
      unlockLevel: 5,
    },
    {
      mode: "tournament",
      title: "Tournament",
      description: "Join weekly tournaments for exclusive rewards",
      icon: Trophy,
      difficulty: "Hard",
      reward: { coins: 500, experience: 250 },
      requirements: "3 pets, Level 10+",
      minPets: 3,
      maxPets: 3,
      unlockLevel: 10,
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
          name: rng.generateName(tier, type),
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
    }
  };

  const canStartBattle = (mode) => {
    const battleConfig = battleTypes.find((b) => b.mode === mode);
    if (!battleConfig) return false;

    if (selectedPets.length < battleConfig.minPets) return false;
    if (selectedPets.length > battleConfig.maxPets) return false;
    if ((user?.level || 1) < battleConfig.unlockLevel) return false;

    return true;
  };

  const startBattle = async (mode) => {
    if (!canStartBattle(mode)) {
      alert(`Cannot start ${mode} battle. Check requirements!`);
      return;
    }

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
          message: `Battle started! Your ${selectedPets.length} pets vs ${opponents.length} opponents.`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } else {
      // For PvP and tournament, we'd match with real players
      // For now, use AI opponents with better stats
      const opponents = generateOpponentPets(
        selectedPets,
        mode === "tournament" ? "hard" : "medium"
      );
      setOpponentPets(opponents);

      setBattleLog((prev) => [
        ...prev,
        {
          type: "info",
          message: `${mode.toUpperCase()} battle starting!`,
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
    // Client-side battle simulation using shared RNG
    const battleConfig = battleTypes.find((b) => b.mode === mode);
    const result = rng.calculateBattleOutcome(
      {
        stats: {
          attack: selectedPets.reduce((sum, pet) => sum + pet.stats.attack, 0),
          defense: selectedPets.reduce(
            (sum, pet) => sum + pet.stats.defense,
            0
          ),
          speed: selectedPets.reduce((sum, pet) => sum + pet.stats.speed, 0),
          health: selectedPets.reduce((sum, pet) => sum + pet.stats.health, 0),
        },
        type: selectedPets[0]?.type,
      },
      {
        stats: {
          attack: opponentPets.reduce((sum, pet) => sum + pet.stats.attack, 0),
          defense: opponentPets.reduce(
            (sum, pet) => sum + pet.stats.defense,
            0
          ),
          speed: opponentPets.reduce((sum, pet) => sum + pet.stats.speed, 0),
          health: opponentPets.reduce((sum, pet) => sum + pet.stats.health, 0),
        },
        type: opponentPets[0]?.type,
      }
    );

    const rewards = battleConfig?.reward || { coins: 50, experience: 25 };

    setTimeout(() => {
      handleBattleComplete(result, rewards);
    }, 2000); // Simulate battle duration
  };

  const handleBattleComplete = (result, rewards) => {
    setBattleInProgress(false);

    if (result.winner === "player") {
      setBattleResult({
        victory: true,
        message: "Victory!",
        rewards,
        critical: result.critical,
      });

      // Update player rewards
      updateCoins(rewards.coins);
      updateExperience(rewards.experience);
    } else {
      setBattleResult({
        victory: false,
        message: "Defeat!",
        rewards: {
          coins: Math.floor(rewards.coins * 0.3),
          experience: Math.floor(rewards.experience * 0.3),
        },
        critical: result.critical,
      });

      // Consolation rewards
      updateCoins(Math.floor(rewards.coins * 0.3));
      updateExperience(Math.floor(rewards.experience * 0.3));
    }

    // Add battle conclusion to log
    setBattleLog((prev) => [
      ...prev,
      {
        type: result.winner === "player" ? "victory" : "defeat",
        message: `Battle ${result.winner === "player" ? "won" : "lost"}! ${
          result.critical ? "Critical hit!" : ""
        }`,
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
    clearBattleTeam();
    setSelectedPets([]);
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
            <p className="text-gray-300 capitalize">
              {battleMode} •{" "}
              {battleTypes.find((b) => b.mode === battleMode)?.difficulty}
            </p>
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
        <div className="bg-gray-800 rounded-2xl p-8 border-2 border-gray-700 max-w-md w-full text-center">
          <div
            className={`text-6xl mb-4 ${
              battleResult.victory
                ? "text-yellow-400 pulse-glow"
                : "text-red-400"
            }`}
          >
            {battleResult.victory ? "🏆" : "💀"}
            {battleResult.critical && (
              <Sparkles className="w-8 h-8 text-yellow-300 inline-block ml-2" />
            )}
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">
            {battleResult.message}
            {battleResult.critical && (
              <span className="text-yellow-300 text-lg block">
                Critical Victory!
              </span>
            )}
          </h2>

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
              Back to Battle Selection
            </Button>
            <Button
              onClick={() => setBattleResult(null)}
              variant="outline"
              className="w-full"
            >
              View Battle Details
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
            Join the Battle!
          </h2>
          <p className="text-gray-400 mb-8">
            Please log in to access the battle arena
          </p>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="primary"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Battle Arena</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Test your pets in strategic battles. Earn coins and experience to
            make your pets stronger! Use type advantages and abilities to win
            battles.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Pet Selection */}
          <div className="lg:col-span-2">
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
                  <p className="text-gray-400 mb-4">You need pets to battle!</p>
                  <Button
                    onClick={() => (window.location.href = "/hatchery")}
                    variant="primary"
                  >
                    Hatch Some Eggs
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-2 mb-4">
                    {[...Array(GAME_CONFIG.BATTLE_MAX_PETS)].map((_, index) => (
                      <div
                        key={index}
                        className={`w-3 h-3 rounded-full ${
                          selectedPets.length > index
                            ? "bg-green-500"
                            : "bg-gray-600"
                        }`}
                      ></div>
                    ))}
                    <span className="text-gray-400 text-sm ml-2">
                      {selectedPets.length}/{GAME_CONFIG.BATTLE_MAX_PETS} pets
                      selected
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto custom-scrollbar">
                    {pets.map((pet) => (
                      <PetCard
                        key={pet.id}
                        pet={pet}
                        onSelect={handlePetSelect}
                        isSelected={selectedPets.some((p) => p.id === pet.id)}
                        showBattleStats={true}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column - Battle Modes */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">
                Battle Modes
              </h3>
              <div className="space-y-4">
                {battleTypes.map((battle) => {
                  const Icon = battle.icon;
                  const requirements = getBattleRequirementStatus(battle);
                  const canPlay = requirements.canPlay;

                  return (
                    <div
                      key={battle.mode}
                      className={`p-4 rounded-lg border transition-all card-hover ${
                        canPlay
                          ? "bg-gray-700 border-gray-600 hover:border-blue-500 cursor-pointer"
                          : "bg-gray-800 border-gray-700 opacity-60 cursor-not-allowed"
                      }`}
                      onClick={() => canPlay && startBattle(battle.mode)}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            battle.difficulty === "Easy"
                              ? "bg-green-500 bg-opacity-20 text-green-400"
                              : battle.difficulty === "Medium"
                              ? "bg-yellow-500 bg-opacity-20 text-yellow-400"
                              : "bg-red-500 bg-opacity-20 text-red-400"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-white">
                              {battle.title}
                            </h4>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                battle.difficulty === "Easy"
                                  ? "bg-green-500 text-white"
                                  : battle.difficulty === "Medium"
                                  ? "bg-yellow-500 text-black"
                                  : "bg-red-500 text-white"
                              }`}
                            >
                              {battle.difficulty}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm mb-2">
                            {battle.description}
                          </p>

                          {/* Requirements Status */}
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">
                                Pets: {selectedPets.length}/{battle.maxPets}
                              </span>
                              <span
                                className={
                                  requirements.missingPets
                                    ? "text-red-400"
                                    : "text-green-400"
                                }
                              >
                                {requirements.missingPets
                                  ? "Need more pets"
                                  : "✓ Ready"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">
                                Level: {user?.level || 1}/{battle.unlockLevel}
                              </span>
                              <span
                                className={
                                  requirements.levelTooLow
                                    ? "text-red-400"
                                    : "text-green-400"
                                }
                              >
                                {requirements.levelTooLow
                                  ? "Level too low"
                                  : "✓ Unlocked"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs mt-2">
                            <span className="text-gray-500">
                              {battle.requirements}
                            </span>
                            <span className="flex items-center text-yellow-400">
                              <Coins className="w-3 h-3 mr-1" />+
                              {formatNumber(battle.reward.coins)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Team Preview */}
            {selectedPets.length > 0 && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Your Team</h3>
                  <Button onClick={clearBattleTeam} variant="outline" size="sm">
                    Clear
                  </Button>
                </div>
                <div className="space-y-3">
                  {selectedPets.map((pet, index) => (
                    <div
                      key={pet.id}
                      className="flex items-center space-x-3 bg-gray-700 rounded-lg p-3"
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center bg-type-${pet.type.toLowerCase()} bg-opacity-20`}
                      >
                        <span className="text-lg">
                          {formatType(pet.type).emoji}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-medium">{pet.name}</div>
                        <div className="text-gray-400 text-sm capitalize">
                          Lvl {pet.level} • {formatType(pet.type).name} •{" "}
                          {formatTier(pet.tier).name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-400 text-sm">
                          ATK {pet.stats.attack}
                        </div>
                        <div className="text-blue-400 text-sm">
                          DEF {pet.stats.defense}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Team Power Summary */}
                  <div className="pt-3 border-t border-gray-600">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Team Power:</span>
                      <span className="text-yellow-400 font-bold">
                        {selectedPets.reduce((power, pet) => {
                          const basePower =
                            pet.stats.attack +
                            pet.stats.defense +
                            pet.stats.speed +
                            pet.stats.health / 10;
                          const tierMultiplier =
                            TIERS[pet.tier]?.statMultiplier || 1;
                          const levelMultiplier = 1 + (pet.level - 1) * 0.1;
                          return (
                            power +
                            Math.round(
                              basePower * tierMultiplier * levelMultiplier
                            )
                          );
                        }, 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Battle Tips */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-3">Battle Tips</h3>
              <div className="space-y-2 text-sm text-gray-300">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Use type advantages for 50% more damage</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Balance your team with different types</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Higher tier pets have better stats</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Level up pets to increase their power</span>
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
