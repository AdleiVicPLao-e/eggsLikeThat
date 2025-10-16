import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useGame } from "../context/GameContext";
import {
  Gem,
  Sword,
  Users,
  TrendingUp,
  Zap,
  Coins,
  Sparkles,
  GamepadIcon,
  Shield,
  Mail,
  UserPlus,
} from "lucide-react";
import PetCard from "../components/Pets/PetCard";
import { formatTier, formatType, formatCurrency } from "../utils/rarity";
import { TIERS, TYPES } from "../utils/constants";

const Home = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    showAuthModal,
    setShowAuthModal,
    setAuthMode,
    connectWallet,
  } = useUser();
  const { pets, eggs, lastSync } = useGame();
  const navigate = useNavigate();

  // Auto-show auth modal if not authenticated on certain actions
  const requireAuth = (action) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      setAuthMode("login");
      return false;
    }
    return true;
  };

  const handleQuickHatch = () => {
    if (requireAuth()) {
      navigate("/hatchery");
    }
  };

  const handleQuickBattle = () => {
    if (requireAuth()) {
      navigate("/battle");
    }
  };

  const handleConnectWallet = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      setAuthMode("register");
      return;
    }

    const result = await connectWallet();
    if (result.success) {
      alert("Wallet connected successfully!");
    }
  };

  const handleCreateAccount = () => {
    setShowAuthModal(true);
    setAuthMode("register");
  };

  const handleLogin = () => {
    setShowAuthModal(true);
    setAuthMode("login");
  };

  const handleGuestPlay = () => {
    setShowAuthModal(true);
    setAuthMode("guest");
  };

  const recentPets = pets.slice(-3).reverse();
  const stats = {
    totalPets: pets.length,
    totalEggs: eggs.length,
    highestTier: pets.reduce((highest, pet) => {
      const tierValue = TIERS[pet.tier]?.id || 0;
      const highestValue = TIERS[highest]?.id || 0;
      return tierValue > highestValue ? pet.tier : highest;
    }, "COMMON"),
    totalValue: pets.reduce((sum, pet) => {
      const tierValue = TIERS[pet.tier]?.id || 0;
      return sum + tierValue * 100;
    }, 0),
  };

  const features = [
    {
      icon: Gem,
      title: "Hatch Eggs",
      description:
        "Discover unique pets with different rarities and abilities. Free daily eggs available!",
      color: "from-purple-500 to-pink-500",
      path: "/hatchery",
      requiresAuth: true,
      status: isAuthenticated
        ? user?.freeRolls > 0
          ? `${user.freeRolls} free rolls available`
          : "Claim your daily egg"
        : "Sign up to start",
    },
    {
      icon: Sword,
      title: "Battle Arena",
      description:
        "Test your pets in strategic battles. Earn coins, experience, and rare items!",
      color: "from-red-500 to-orange-500",
      path: "/battle",
      requiresAuth: true,
      status: isAuthenticated
        ? `Level ${user?.level || 1} - ${user?.battlesWon || 0} wins`
        : "Create account to battle",
    },
    {
      icon: Users,
      title: "Marketplace",
      description:
        "Buy, sell, and trade pets with other players. Secure blockchain transactions.",
      color: "from-green-500 to-blue-500",
      path: "/marketplace",
      requiresAuth: true,
      status: isAuthenticated
        ? `${formatCurrency(user?.coins || 0, "coins")} available`
        : "Trade with other players",
    },
    {
      icon: TrendingUp,
      title: "Fusion Lab",
      description:
        "Combine pets to create powerful new companions with enhanced abilities.",
      color: "from-yellow-500 to-red-500",
      path: "/fusion",
      requiresAuth: true,
      status: isAuthenticated
        ? pets.length >= 2
          ? "Ready to fuse!"
          : "Need 2+ pets"
        : "Unlock advanced features",
    },
  ];

  const quickActions = [
    {
      icon: Zap,
      label: "Quick Hatch",
      description: "Hatch a new pet instantly",
      action: handleQuickHatch,
      color: "from-purple-500 to-pink-500",
      available: isAuthenticated && (user?.freeRolls > 0 || user?.coins >= 100),
      requiresAuth: true,
    },
    {
      icon: Sword,
      label: "Quick Battle",
      description: "Jump into instant PvE battle",
      action: handleQuickBattle,
      color: "from-red-500 to-orange-500",
      available: isAuthenticated && pets.length > 0,
      requiresAuth: true,
    },
    {
      icon: Coins,
      label: "Daily Reward",
      description: "Claim your daily coins and rewards",
      action: () => navigate("/profile"),
      color: "from-green-500 to-emerald-500",
      available: isAuthenticated,
      requiresAuth: true,
    },
  ];

  const authOptions = [
    {
      icon: UserPlus,
      title: "Create Account",
      description:
        "Sign up with email to save your progress and access all features",
      action: handleCreateAccount,
      color: "from-blue-500 to-purple-600",
      highlight: true,
    },
    {
      icon: Mail,
      title: "Sign In",
      description:
        "Already have an account? Sign in to continue your adventure",
      action: handleLogin,
      color: "from-green-500 to-blue-600",
    },
    {
      icon: GamepadIcon,
      title: "Play as Guest",
      description:
        "Start playing immediately without an account (progress saved for 24 hours)",
      action: handleGuestPlay,
      color: "from-gray-500 to-gray-700",
    },
    {
      icon: Shield,
      title: "Connect Wallet",
      description:
        "Use your crypto wallet to access blockchain features and trading",
      action: handleConnectWallet,
      color: "from-orange-500 to-red-600",
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading PetVerse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-2xl">
            🐾
          </div>
        </div>

        <h1 className="text-6xl font-bold text-white mb-6">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            PetVerse
          </span>
        </h1>

        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Collect, battle, and trade unique digital pets. Start playing
          instantly, connect your wallet later for advanced features!
        </p>

        {!isAuthenticated ? (
          <div className="space-y-8">
            {/* Authentication Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {authOptions.map((option, index) => {
                const Icon = option.icon;
                return (
                  <button
                    key={index}
                    onClick={option.action}
                    className={`bg-gray-800 rounded-xl p-6 border-2 ${
                      option.highlight
                        ? "border-blue-500 bg-blue-500 bg-opacity-10"
                        : "border-gray-700 hover:border-gray-500"
                    } transition-all hover:transform hover:scale-105 text-left group`}
                  >
                    <div
                      className={`w-12 h-12 rounded-lg bg-gradient-to-r ${option.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {option.title}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Benefits Section */}
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">🎮</div>
                  <div className="text-white font-semibold">Free to Play</div>
                  <div className="text-gray-400 text-sm">No cost to start</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">⚡</div>
                  <div className="text-white font-semibold">Instant Access</div>
                  <div className="text-gray-400 text-sm">Start in seconds</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">🔒</div>
                  <div className="text-white font-semibold">
                    Wallet Optional
                  </div>
                  <div className="text-gray-400 text-sm">Connect anytime</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
              <Link
                to="/hatchery"
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-8 py-4 rounded-lg text-white font-bold text-lg transition-all transform hover:scale-105 flex items-center space-x-2"
              >
                <Gem className="w-5 h-5" />
                <span>Start Hatching</span>
              </Link>
              <Link
                to="/battle"
                className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 px-8 py-4 rounded-lg text-white font-bold text-lg transition-all transform hover:scale-105 flex items-center space-x-2"
              >
                <Sword className="w-5 h-5" />
                <span>Enter Battle</span>
              </Link>
            </div>

            {/* User Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white">
                  {stats.totalPets}
                </div>
                <div className="text-gray-400 text-sm">Pets</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white">
                  {stats.totalEggs}
                </div>
                <div className="text-gray-400 text-sm">Eggs</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white">
                  {user?.level || 1}
                </div>
                <div className="text-gray-400 text-sm">Level</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {formatCurrency(user?.coins || 0, "coins")}
                </div>
                <div className="text-gray-400 text-sm">Coins</div>
              </div>
            </div>

            {/* Wallet Status */}
            {!user?.walletAddress && (
              <div className="max-w-md mx-auto">
                <button
                  onClick={handleConnectWallet}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-6 py-3 rounded-lg text-white font-bold transition-all flex items-center justify-center space-x-2"
                >
                  <Shield className="w-5 h-5" />
                  <span>Connect Wallet for Trading</span>
                </button>
                <p className="text-gray-400 text-sm mt-2 text-center">
                  Optional: Connect your wallet to unlock marketplace trading
                  and blockchain features
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Quick Actions for logged-in users */}
      {isAuthenticated && (
        <section className="container mx-auto px-4 py-8">
          <h3 className="text-2xl font-bold text-white text-center mb-6">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                disabled={!action.available}
                className={`bg-gradient-to-r ${action.color} rounded-xl p-4 text-white font-semibold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-left`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <action.icon className="w-6 h-6" />
                  <span className="text-lg">{action.label}</span>
                </div>
                <p className="text-sm opacity-90">{action.description}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-4xl font-bold text-white text-center mb-12">
          Game Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                onClick={() => {
                  if (feature.requiresAuth && !isAuthenticated) {
                    setShowAuthModal(true);
                    setAuthMode("register");
                    return;
                  }
                  navigate(feature.path);
                }}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-500 transition-all hover:transform hover:scale-105 group cursor-pointer card-hover"
              >
                <div
                  className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400 mb-3">{feature.description}</p>
                <div
                  className={`text-sm font-medium ${
                    feature.requiresAuth && !isAuthenticated
                      ? "text-orange-400"
                      : "text-blue-400"
                  }`}
                >
                  {feature.status}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Game Stats */}
      {isAuthenticated && (
        <section className="container mx-auto px-4 py-16">
          <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Your Collection
            </h2>

            {/* Tier Distribution */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white mb-4">
                Pet Rarity Distribution
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.entries(TIERS).map(([tier, data]) => {
                  const count = pets.filter((pet) => pet.tier === tier).length;
                  const percentage =
                    pets.length > 0 ? (count / pets.length) * 100 : 0;

                  return (
                    <div key={tier} className="text-center">
                      <div
                        className={`w-16 h-16 rounded-full ${data.bgColor} flex items-center justify-center mx-auto mb-2`}
                      >
                        <span className="text-2xl">{data.emoji}</span>
                      </div>
                      <div className="text-white font-bold">{count}</div>
                      <div className="text-gray-400 text-sm">{data.name}</div>
                      <div className="text-gray-500 text-xs">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Type Distribution */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">
                Pet Type Distribution
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(TYPES).map(([type, data]) => {
                  const count = pets.filter((pet) => pet.type === type).length;

                  return (
                    <div key={type} className="text-center">
                      <div
                        className={`w-12 h-12 rounded-full ${data.bgColor} flex items-center justify-center mx-auto mb-2`}
                      >
                        <span className="text-xl">{data.emoji}</span>
                      </div>
                      <div className="text-white font-bold">{count}</div>
                      <div className="text-gray-400 text-sm">{data.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent Pets */}
      {isAuthenticated && pets.length > 0 && (
        <section className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">Your Recent Pets</h2>
            <Link
              to="/profile"
              className="text-blue-400 hover:text-blue-300 transition-colors"
            >
              View All Pets →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentPets.map((pet) => (
              <PetCard key={pet.id} pet={pet} showActions={false} />
            ))}
          </div>
        </section>
      )}

      {/* Call to Action for non-users */}
      {!isAuthenticated && (
        <section className="container mx-auto px-4 py-16 text-center">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-12">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to Start Your Adventure?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of players collecting and battling with unique
              pets. Choose your preferred way to start playing!
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={handleCreateAccount}
                className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <UserPlus className="w-5 h-5" />
                <span>Create Free Account</span>
              </button>
              <button
                onClick={handleGuestPlay}
                className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 px-8 py-4 rounded-lg font-bold text-lg transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <GamepadIcon className="w-5 h-5" />
                <span>Play as Guest</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Last sync info */}
      {isAuthenticated && lastSync && (
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-gray-500 text-sm">
            Last updated: {new Date(lastSync).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
};

export default Home;
