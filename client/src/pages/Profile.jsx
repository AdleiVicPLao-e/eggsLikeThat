import React from "react";
import { useUser } from "../context/UserContext";
import { useGame } from "../context/GameContext";
import { useBlockchain } from "../hooks/useBlockchain";
import {
  User,
  Coins,
  Award,
  Clock,
  Sparkles,
  Trophy,
  Zap,
  Users,
} from "lucide-react";
import PetCard from "../components/Pets/PetCard";
import {
  formatCurrency,
  formatNumber,
  formatTier,
  formatType,
} from "../utils/rarity";
import { TIERS } from "../utils/constants";

const Profile = () => {
  const { user, isWalletConnected } = useUser();
  const { pets, eggs, battleTeam, lastSync } = useGame();
  const { getBalance, getTokenBalance } = useBlockchain();

  const [walletBalance, setWalletBalance] = React.useState("0");
  const [tokenBalance, setTokenBalance] = React.useState("0");
  const [profileStats, setProfileStats] = React.useState({});

  // Load blockchain data when user is connected
  React.useEffect(() => {
    if (user?.walletAddress && isWalletConnected) {
      loadBlockchainData();
    }
  }, [user?.walletAddress, isWalletConnected]);

  // Calculate profile stats
  React.useEffect(() => {
    calculateStats();
  }, [pets, eggs]);

  const loadBlockchainData = async () => {
    try {
      const [balanceResult, tokenResult] = await Promise.all([
        getBalance(user.walletAddress),
        getTokenBalance(),
      ]);

      if (balanceResult.success) setWalletBalance(balanceResult.balance);
      if (tokenResult.success) setTokenBalance(tokenResult.balance);
    } catch (error) {
      console.error("Error loading blockchain data:", error);
    }
  };

  const calculateStats = () => {
    if (!pets.length) return;

    // Calculate rarity distribution
    const tierCounts = {};
    const typeCounts = {};
    let totalPower = 0;
    let highestPower = 0;
    let rarestPet = pets[0];

    pets.forEach((pet) => {
      // Tier counts
      tierCounts[pet.tier] = (tierCounts[pet.tier] || 0) + 1;

      // Type counts
      typeCounts[pet.type] = (typeCounts[pet.type] || 0) + 1;

      // Calculate power (simplified)
      const power =
        (pet.stats.attack +
          pet.stats.defense +
          pet.stats.speed +
          pet.stats.health) *
        (TIERS[pet.tier]?.statMultiplier || 1) *
        (1 + (pet.level - 1) * 0.1);
      totalPower += power;

      if (power > highestPower) {
        highestPower = power;
      }

      // Find rarest pet
      const currentRarity = TIERS[pet.tier]?.id || 0;
      const rarestRarity = TIERS[rarestPet.tier]?.id || 0;
      if (currentRarity > rarestRarity) {
        rarestPet = pet;
      }
    });

    const averagePower = totalPower / pets.length;
    const mostCommonType = Object.keys(typeCounts).reduce((a, b) =>
      typeCounts[a] > typeCounts[b] ? a : b
    );

    setProfileStats({
      totalPets: pets.length,
      totalEggs: eggs.length,
      averagePower: Math.round(averagePower),
      highestPower: Math.round(highestPower),
      rarestPet,
      tierCounts,
      typeCounts,
      mostCommonType,
      battleTeamSize: battleTeam.length,
      hatchedEggs: eggs.filter((egg) => egg.isHatched).length,
      unhatchedEggs: eggs.filter((egg) => !egg.isHatched).length,
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-gray-400">
            Please connect your wallet to view your profile
          </p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      icon: User,
      label: "Total Pets",
      value: profileStats.totalPets || 0,
      description: `${profileStats.hatchedEggs || 0} hatched`,
    },
    {
      icon: Award,
      label: "Rarest Pet",
      value: profileStats.rarestPet
        ? formatTier(profileStats.rarestPet.tier).name
        : "None",
      description: profileStats.rarestPet
        ? profileStats.rarestPet.name
        : "Hatch some eggs!",
      color: profileStats.rarestPet
        ? `text-${formatTier(profileStats.rarestPet.tier).color}`
        : "text-gray-400",
    },
    {
      icon: Coins,
      label: "Wallet Balance",
      value: isWalletConnected
        ? formatCurrency(walletBalance, "ETH", 4)
        : "Connect Wallet",
      description: isWalletConnected
        ? `${formatCurrency(tokenBalance, "coins")} tokens`
        : "Connect to view",
    },
    {
      icon: Zap,
      label: "Collection Power",
      value: profileStats.highestPower
        ? `${formatNumber(profileStats.highestPower)}`
        : "0",
      description: `Avg: ${
        profileStats.averagePower ? formatNumber(profileStats.averagePower) : 0
      }`,
    },
    {
      icon: Users,
      label: "Battle Team",
      value: `${profileStats.battleTeamSize || 0}/3`,
      description: battleTeam.length === 3 ? "Team Complete" : "Add more pets",
    },
    {
      icon: Sparkles,
      label: "Egg Inventory",
      value: profileStats.totalEggs || 0,
      description: `${profileStats.unhatchedEggs || 0} ready to hatch`,
    },
  ];

  const getTierDistribution = () => {
    if (!profileStats.tierCounts) return [];

    return Object.entries(profileStats.tierCounts)
      .sort(([a], [b]) => (TIERS[a]?.id || 0) - (TIERS[b]?.id || 0))
      .map(([tier, count]) => ({
        tier,
        count,
        percentage: ((count / pets.length) * 100).toFixed(1),
        ...formatTier(tier),
      }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 mb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div className="flex items-center space-x-6 mb-4 lg:mb-0">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-2xl text-white">
                  {user.username?.charAt(0).toUpperCase() || "P"}
                </div>
                {user.level && (
                  <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                    Lvl {user.level}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-white">
                    {user.username || "Anonymous Player"}
                  </h1>
                  {user.isGuest && (
                    <span className="bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded-full">
                      Guest
                    </span>
                  )}
                </div>
                <p className="text-gray-400 font-mono text-sm">
                  {user.walletAddress
                    ? `${user.walletAddress.slice(
                        0,
                        8
                      )}...${user.walletAddress.slice(-6)}`
                    : "No wallet connected"}
                </p>
                {user.experience !== undefined && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Experience</span>
                      <span>
                        {formatNumber(user.experience)} /{" "}
                        {formatNumber(Math.pow(user.level || 1, 2) * 100)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(
                            (user.experience /
                              (Math.pow(user.level || 1, 2) * 100)) *
                              100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {user.coins !== undefined && (
                <div className="flex items-center space-x-2 bg-yellow-500 bg-opacity-20 px-4 py-2 rounded-lg">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  <span className="text-white font-bold">
                    {formatNumber(user.coins)}
                  </span>
                </div>
              )}

              {user.freeRolls !== undefined && (
                <div className="flex items-center space-x-2 bg-green-500 bg-opacity-20 px-4 py-2 rounded-lg">
                  <Sparkles className="w-5 h-5 text-green-400" />
                  <span className="text-white font-bold">
                    {user.freeRolls} Free Rolls
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-lg font-bold text-white truncate ${
                        stat.color || ""
                      }`}
                    >
                      {stat.value}
                    </div>
                    <div className="text-gray-400 text-xs truncate">
                      {stat.label}
                    </div>
                    {stat.description && (
                      <div className="text-gray-500 text-xs truncate">
                        {stat.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Tier Distribution */}
          {getTierDistribution().length > 0 && (
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 lg:col-span-1">
              <h3 className="text-xl font-bold text-white mb-4">
                Collection Rarity
              </h3>
              <div className="space-y-3">
                {getTierDistribution().map(
                  ({ tier, count, percentage, color, emoji, name }) => (
                    <div
                      key={tier}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{emoji}</span>
                        <span className="text-white text-sm">{name}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-20 bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                            }}
                          ></div>
                        </div>
                        <span className="text-gray-400 text-sm w-8 text-right">
                          {count}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Battle Team */}
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Battle Team</h3>
              <span className="text-gray-400 text-sm">
                {battleTeam.length}/3 pets selected
              </span>
            </div>

            {battleTeam.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No pets in battle team</p>
                <p className="text-gray-500 text-sm mt-1">
                  Select pets from your collection to build your team
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {battleTeam.map((pet, index) => (
                  <div key={pet.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <span className="text-sm">🐾</span>
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">
                          {pet.name}
                        </div>
                        <div className="text-gray-400 text-xs capitalize">
                          Lvl {pet.level} • {formatType(pet.type).name}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div className="text-center bg-gray-600 rounded p-1">
                        <div className="text-red-400">ATK</div>
                        <div className="text-white">{pet.stats.attack}</div>
                      </div>
                      <div className="text-center bg-gray-600 rounded p-1">
                        <div className="text-blue-400">DEF</div>
                        <div className="text-white">{pet.stats.defense}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pet Collection */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              Your Pet Collection
            </h2>
            <div className="flex items-center space-x-4">
              <span className="text-gray-400 text-sm">
                {pets.length} pets • Last sync:{" "}
                {lastSync ? new Date(lastSync).toLocaleTimeString() : "Never"}
              </span>
            </div>
          </div>

          {pets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🐾</div>
              <h3 className="text-xl font-bold text-white mb-2">No Pets Yet</h3>
              <p className="text-gray-400 mb-4">
                Start hatching eggs to build your collection!
              </p>
              <a
                href="/hatchery"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-6 py-3 rounded-lg text-white font-medium transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Visit Hatchery</span>
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {pets.map((pet) => (
                <PetCard key={pet.id} pet={pet} showActions={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
