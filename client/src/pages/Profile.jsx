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
  Mail,
  Shield,
  GamepadIcon,
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
  const { user, isAuthenticated, hasWallet, connectWallet } = useUser();
  const { pets, eggs, battleTeam, lastSync } = useGame();
  const { getBalance, getTokenBalance } = useBlockchain();

  const [walletBalance, setWalletBalance] = React.useState("0");
  const [tokenBalance, setTokenBalance] = React.useState("0");
  const [profileStats, setProfileStats] = React.useState({});

  // Load blockchain data when user is connected
  React.useEffect(() => {
    if (user?.walletAddress && hasWallet) {
      loadBlockchainData();
    }
  }, [user?.walletAddress, hasWallet]);

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

  // Not authenticated view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">👤</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Create Your Profile
          </h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Create an account or sign in to view your player profile, track your
            progress, and manage your pet collection
          </p>
          <div className="space-y-3">
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-6 py-3 rounded-lg text-white font-bold transition-all"
            >
              Create Free Account
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className="w-full bg-transparent border-2 border-gray-600 text-gray-300 hover:border-gray-500 hover:text-white px-6 py-3 rounded-lg font-bold transition-all"
            >
              Learn More
            </button>
          </div>
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
      color: "text-blue-400",
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
        ? formatTier(profileStats.rarestPet.tier).textColor
        : "text-gray-400",
    },
    {
      icon: Coins,
      label: "Game Coins",
      value: formatCurrency(user?.coins || 0, "coins"),
      description: `${user?.freeRolls || 0} free rolls available`,
      color: "text-yellow-400",
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
      color: "text-purple-400",
    },
    {
      icon: Users,
      label: "Battle Team",
      value: `${profileStats.battleTeamSize || 0}/3`,
      description: battleTeam.length === 3 ? "Team Complete" : "Add more pets",
      color: "text-green-400",
    },
    {
      icon: Sparkles,
      label: "Egg Inventory",
      value: profileStats.totalEggs || 0,
      description: `${profileStats.unhatchedEggs || 0} ready to hatch`,
      color: "text-pink-400",
    },
  ];

  // Add wallet stats if connected
  if (hasWallet) {
    stats.splice(2, 0, {
      icon: Shield,
      label: "Wallet Balance",
      value: formatCurrency(walletBalance, "ETH", 4),
      description: `${formatCurrency(tokenBalance, "coins")} tokens`,
      color: "text-green-400",
    });
  }

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

  const getAccountTypeInfo = () => {
    if (user.isGuest) {
      return {
        type: "Guest Account",
        description: "Temporary account - progress saved for 24 hours",
        icon: GamepadIcon,
        color: "from-gray-500 to-gray-700",
        action: "Create permanent account to save progress forever",
      };
    } else if (user.authMethod === "email") {
      return {
        type: "Email Account",
        description: "Permanent account with email authentication",
        icon: Mail,
        color: "from-blue-500 to-purple-600",
        action: hasWallet ? "Wallet connected" : "Connect wallet for trading",
      };
    } else if (user.authMethod === "wallet") {
      return {
        type: "Wallet Account",
        description: "Blockchain-native account",
        icon: Shield,
        color: "from-green-500 to-emerald-600",
        action: "Full blockchain features enabled",
      };
    } else {
      return {
        type: "Verified Account",
        description: "Full-featured account",
        icon: User,
        color: "from-purple-500 to-pink-600",
        action: "All features available",
      };
    }
  };

  const accountInfo = getAccountTypeInfo();
  const AccountIcon = accountInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 mb-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div className="flex items-center space-x-6 mb-4 lg:mb-0">
              <div className="relative">
                <div
                  className={`w-20 h-20 bg-gradient-to-r ${accountInfo.color} rounded-full flex items-center justify-center text-2xl text-white`}
                >
                  <AccountIcon className="w-8 h-8" />
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
                  <span
                    className={`bg-gradient-to-r ${accountInfo.color} text-white text-xs px-3 py-1 rounded-full`}
                  >
                    {accountInfo.type}
                  </span>
                </div>
                <p className="text-gray-400 mb-2">{accountInfo.description}</p>
                {user.walletAddress ? (
                  <p className="text-gray-400 font-mono text-sm">
                    {`${user.walletAddress.slice(
                      0,
                      8
                    )}...${user.walletAddress.slice(-6)}`}
                  </p>
                ) : user.email ? (
                  <p className="text-gray-400 text-sm">{user.email}</p>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No email or wallet connected
                  </p>
                )}

                {/* Experience Bar */}
                {user.experience !== undefined && (
                  <div className="mt-3 max-w-md">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Level {user.level || 1} Progress</span>
                      <span>
                        {formatNumber(user.experience)} /{" "}
                        {formatNumber(Math.pow(user.level || 1, 2) * 100)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-500"
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

            <div className="flex flex-col space-y-3">
              {/* Account Action */}
              <div className="text-center lg:text-right">
                <p className="text-gray-400 text-sm mb-2">
                  {accountInfo.action}
                </p>
                {user.isGuest && (
                  <button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all">
                    Upgrade to Permanent Account
                  </button>
                )}
                {!hasWallet && !user.isGuest && (
                  <button
                    onClick={connectWallet}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all flex items-center space-x-2"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Connect Wallet</span>
                  </button>
                )}
              </div>

              {/* Quick Stats */}
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
                      {user.freeRolls} Free
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-lg font-bold truncate ${stat.color}`}>
                      {stat.value}
                    </div>
                    <div className="text-gray-400 text-sm truncate">
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
              <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                <Award className="w-5 h-5 mr-2 text-yellow-400" />
                Collection Rarity
              </h3>
              <div className="space-y-4">
                {getTierDistribution().map(
                  ({ tier, count, percentage, color, emoji, name }) => (
                    <div
                      key={tier}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-xl">{emoji}</span>
                        <div>
                          <div className="text-white font-medium">{name}</div>
                          <div className="text-gray-400 text-xs">
                            {percentage}% of collection
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                            }}
                          ></div>
                        </div>
                        <span className="text-white font-bold w-6 text-right">
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
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                Battle Team
              </h3>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 text-sm">
                  {battleTeam.length}/3 pets selected
                </span>
                {battleTeam.length > 0 && (
                  <button
                    onClick={() => (window.location.href = "/battle")}
                    className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 px-3 py-1 rounded text-white text-sm transition-all"
                  >
                    Go Battle
                  </button>
                )}
              </div>
            </div>

            {battleTeam.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-2">No Battle Team</p>
                <p className="text-gray-500 text-sm mb-4">
                  Build your team to start battling other players
                </p>
                <button
                  onClick={() => (window.location.href = "/battle")}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-6 py-2 rounded-lg text-white font-medium transition-all"
                >
                  Build Battle Team
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {battleTeam.map((pet, index) => (
                  <div
                    key={pet.id}
                    className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div
                        className={`w-12 h-12 rounded-lg ${
                          formatTier(pet.tier).bgColor
                        } flex items-center justify-center`}
                      >
                        <span className="text-xl">
                          {formatType(pet.type).emoji}
                        </span>
                      </div>
                      <div>
                        <div className="text-white font-bold">{pet.name}</div>
                        <div className="text-gray-400 text-sm capitalize">
                          Lvl {pet.level} • {formatType(pet.type).name}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-center bg-gray-600 rounded p-2">
                        <div className="text-red-400 font-bold">
                          {pet.stats.attack}
                        </div>
                        <div className="text-gray-400 text-xs">ATK</div>
                      </div>
                      <div className="text-center bg-gray-600 rounded p-2">
                        <div className="text-blue-400 font-bold">
                          {pet.stats.defense}
                        </div>
                        <div className="text-gray-400 text-xs">DEF</div>
                      </div>
                    </div>
                    {pet.abilities?.[0] && (
                      <div className="mt-2 text-center">
                        <span className="text-purple-400 text-xs bg-purple-500 bg-opacity-20 px-2 py-1 rounded">
                          {pet.abilities[0]}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pet Collection */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Sparkles className="w-6 h-6 mr-2 text-yellow-400" />
              Your Pet Collection
            </h2>
            <div className="flex items-center space-x-4">
              <span className="text-gray-400 text-sm">
                {pets.length} pets total
              </span>
              {lastSync && (
                <span className="text-gray-500 text-sm">
                  Last sync: {new Date(lastSync).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {pets.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🐾</div>
              <h3 className="text-xl font-bold text-white mb-2">No Pets Yet</h3>
              <p className="text-gray-400 mb-6">
                Start your adventure by hatching some eggs!
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => (window.location.href = "/hatchery")}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-8 py-3 rounded-lg text-white font-bold transition-all flex items-center space-x-2 mx-auto"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>Visit Hatchery</span>
                </button>
                {user.isGuest && (
                  <p className="text-gray-500 text-sm">
                    🕒 Guest accounts save progress for 24 hours
                  </p>
                )}
              </div>
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
