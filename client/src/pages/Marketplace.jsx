import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useGame } from "../context/GameContext";
import { useGameAPI } from "../hooks/useGameAPI";
import { useBlockchain } from "../hooks/useBlockchain";
import Button from "../components/UI/Button";
import ListingCard from "../components/Marketplace/ListingCard";
import ListPetModal from "../components/Marketplace/ListPetModal";
import {
  Search,
  Filter,
  Store,
  Coins,
  TrendingUp,
  Users,
  RefreshCw,
  Wallet,
  AlertCircle,
  Crown,
  Zap,
} from "lucide-react";
import { formatCurrency, formatNumber } from "../utils/rarity";
import { TIERS, TYPES } from "../utils/constants";

const Marketplace = () => {
  const { user, isAuthenticated, hasWallet, connectWallet } = useUser();
  const { pets, coins, loadGameData } = useGame();
  const { getListings, getMarketplaceStats, getUserListings } = useGameAPI();
  const { blockchainService } = useBlockchain();

  const [listings, setListings] = useState([]);
  const [userListings, setUserListings] = useState([]);
  const [filteredListings, setFilteredListings] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    tier: "all",
    type: "all",
    sortBy: "newest",
    currency: "all",
  });
  const [showListModal, setShowListModal] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [stats, setStats] = useState({
    totalListings: 0,
    activeSellers: 0,
    volume24h: "0 ETH",
    averagePrice: "0 ETH",
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("browse"); // 'browse', 'my-listings', 'my-pets'

  // Load marketplace data
  useEffect(() => {
    if (isAuthenticated) {
      loadMarketplaceData();
    }
  }, [isAuthenticated]);

  // Filter and search listings
  useEffect(() => {
    let result = listings;

    // Search filter
    if (searchTerm) {
      result = result.filter(
        (listing) =>
          listing.pet?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          listing.pet?.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          listing.pet?.tier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          listing.seller?.username
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Tier filter
    if (filters.tier !== "all") {
      result = result.filter((listing) => listing.pet?.tier === filters.tier);
    }

    // Type filter
    if (filters.type !== "all") {
      result = result.filter((listing) => listing.pet?.type === filters.type);
    }

    // Currency filter
    if (filters.currency !== "all") {
      result = result.filter(
        (listing) => listing.currency === filters.currency
      );
    }

    // Sort
    switch (filters.sortBy) {
      case "price-low":
        result = [...result].sort(
          (a, b) => parseFloat(a.price) - parseFloat(b.price)
        );
        break;
      case "price-high":
        result = [...result].sort(
          (a, b) => parseFloat(b.price) - parseFloat(a.price)
        );
        break;
      case "newest":
        result = [...result].sort(
          (a, b) => new Date(b.listedAt) - new Date(a.listedAt)
        );
        break;
      case "oldest":
        result = [...result].sort(
          (a, b) => new Date(a.listedAt) - new Date(b.listedAt)
        );
        break;
      default:
        break;
    }

    setFilteredListings(result);
  }, [listings, searchTerm, filters]);

  const loadMarketplaceData = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const [listingsResponse, statsResponse, userListingsResponse] =
        await Promise.all([
          getListings({ status: "listed", limit: 50 }),
          getMarketplaceStats(),
          hasWallet
            ? getUserListings()
            : Promise.resolve({ data: { listings: [] } }),
        ]);

      if (listingsResponse?.data?.listings) {
        setListings(listingsResponse.data.listings);
      }

      if (statsResponse?.data) {
        setStats({
          totalListings: statsResponse.data.volume24h?.sales || 0,
          activeSellers: statsResponse.data.participants?.sellers || 0,
          volume24h: formatCurrency(
            statsResponse.data.volume24h?.total || 0,
            "ETH"
          ),
          averagePrice: formatCurrency(
            statsResponse.data.volume24h?.average || 0,
            "ETH"
          ),
        });
      }

      if (userListingsResponse?.data?.listings) {
        setUserListings(userListingsResponse.data.listings);
      }
    } catch (error) {
      console.error("Error loading marketplace data:", error);
      // Fallback to mock data if API fails
      loadMockData();
    } finally {
      setLoading(false);
    }
  };

  const loadMockData = () => {
    const mockListings = [
      {
        id: "listing_1",
        seller: {
          username: "DragonTamer",
          walletAddress: "0x1234...5678",
        },
        price: 0.05,
        currency: "ETH",
        pet: {
          id: "market_1",
          name: "Golden Dragon",
          tier: "LEGENDARY",
          type: "FIRE",
          abilities: ["Flame Burst", "Fire Wall"],
          stats: { attack: 160, defense: 120, speed: 140, health: 200 },
          level: 10,
        },
        listedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        status: "listed",
      },
      {
        id: "listing_2",
        seller: {
          username: "OceanMaster",
          walletAddress: "0x8765...4321",
        },
        price: 0.02,
        currency: "ETH",
        pet: {
          id: "market_2",
          name: "Water Serpent",
          tier: "EPIC",
          type: "WATER",
          abilities: ["Water Shield"],
          stats: { attack: 140, defense: 160, speed: 100, health: 180 },
          level: 8,
        },
        listedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        status: "listed",
      },
      {
        id: "listing_3",
        seller: {
          username: "EarthGuardian",
          walletAddress: "0x9999...8888",
        },
        price: 0.008,
        currency: "MATIC",
        pet: {
          id: "market_3",
          name: "Earth Golem",
          tier: "RARE",
          type: "EARTH",
          abilities: ["Earth Slam"],
          stats: { attack: 120, defense: 180, speed: 80, health: 220 },
          level: 6,
        },
        listedAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
        status: "listed",
      },
      {
        id: "listing_4",
        seller: {
          username: "SkyHunter",
          walletAddress: "0x7777...6666",
        },
        price: 0.003,
        currency: "ETH",
        pet: {
          id: "market_4",
          name: "Air Falcon",
          tier: "UNCOMMON",
          type: "AIR",
          abilities: ["Air Slash"],
          stats: { attack: 100, defense: 80, speed: 160, health: 140 },
          level: 4,
        },
        listedAt: new Date(Date.now() - 1000 * 60 * 30),
        status: "listed",
      },
    ];

    setListings(mockListings);
    setStats({
      totalListings: mockListings.length,
      activeSellers: new Set(mockListings.map((l) => l.seller.walletAddress))
        .size,
      volume24h: "0.15 ETH",
      averagePrice: "0.02 ETH",
    });
  };

  const handleListPet = (pet) => {
    if (!hasWallet) {
      const connect = confirm("Connect your wallet to list pets for sale?");
      if (connect) {
        connectWallet();
      }
      return;
    }

    if (!pet.tokenId) {
      alert("This pet needs to be minted as an NFT before it can be listed");
      return;
    }

    setSelectedPet(pet);
    setShowListModal(true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMarketplaceData();
    setRefreshing(false);
  };

  const statCards = [
    {
      icon: Store,
      label: "Total Listings",
      value: formatNumber(stats.totalListings),
      color: "blue",
    },
    {
      icon: Users,
      label: "Active Sellers",
      value: formatNumber(stats.activeSellers),
      color: "green",
    },
    {
      icon: TrendingUp,
      label: "Volume (24h)",
      value: stats.volume24h,
      color: "purple",
    },
    {
      icon: Coins,
      label: "Avg Price",
      value: stats.averagePrice,
      color: "yellow",
    },
  ];

  const canListPet = (pet) => {
    return (
      hasWallet &&
      pet.tokenId &&
      !userListings.some(
        (listing) => listing.pet?.id === pet.id && listing.status === "listed"
      )
    );
  };

  const getPetStatus = (pet) => {
    if (!hasWallet) return { status: "no-wallet", message: "Connect wallet" };
    if (!pet.tokenId) return { status: "not-minted", message: "Not minted" };
    if (
      userListings.some(
        (listing) => listing.pet?.id === pet.id && listing.status === "listed"
      )
    ) {
      return { status: "listed", message: "Already listed" };
    }
    return { status: "can-list", message: "List for sale" };
  };

  // Not authenticated view
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Welcome to the Marketplace!
          </h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Create an account or sign in to buy, sell, and trade amazing pets
            with other players
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
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-blue-600 rounded-2xl flex items-center justify-center text-2xl">
              🏪
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Marketplace</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Buy, sell, and trade amazing pets with players worldwide.{" "}
            {!hasWallet && "Connect your wallet to start trading!"}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            const colorClasses = {
              blue: "bg-blue-500 bg-opacity-20 text-blue-400",
              green: "bg-green-500 bg-opacity-20 text-green-400",
              purple: "bg-purple-500 bg-opacity-20 text-purple-400",
              yellow: "bg-yellow-500 bg-opacity-20 text-yellow-400",
            };

            return (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      colorClasses[stat.color]
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {stat.value}
                    </div>
                    <div className="text-gray-400 text-sm">{stat.label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Wallet Connection Banner */}
        {!hasWallet && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Wallet className="w-8 h-8 text-white" />
                <div>
                  <h3 className="text-xl font-bold text-white">
                    Connect Your Wallet
                  </h3>
                  <p className="text-blue-100">
                    Connect your wallet to buy, sell, and trade pets on the
                    blockchain
                  </p>
                </div>
              </div>
              <Button
                onClick={connectWallet}
                variant="white"
                className="flex items-center space-x-2"
              >
                <Wallet className="w-4 h-4" />
                <span>Connect Wallet</span>
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Filters & Navigation */}
          <div className="space-y-6">
            {/* Navigation Tabs */}
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setActiveTab("browse")}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "browse"
                      ? "bg-blue-500 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  Browse
                </button>
                <button
                  onClick={() => setActiveTab("my-pets")}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "my-pets"
                      ? "bg-green-500 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  My Pets
                </button>
                <button
                  onClick={() => setActiveTab("my-listings")}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "my-listings"
                      ? "bg-purple-500 text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  My Listings
                </button>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Filters</h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  loading={refreshing}
                  className="flex items-center space-x-1"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </Button>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search pets or sellers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Tier Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tier
                </label>
                <select
                  value={filters.tier}
                  onChange={(e) =>
                    setFilters({ ...filters, tier: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Tiers</option>
                  {Object.entries(TIERS).map(([key, tier]) => (
                    <option key={key} value={key}>
                      {tier.emoji} {tier.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) =>
                    setFilters({ ...filters, type: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Types</option>
                  {Object.entries(TYPES).map(([key, type]) => (
                    <option key={key} value={key}>
                      {type.emoji} {type.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Currency Filter */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Currency
                </label>
                <select
                  value={filters.currency}
                  onChange={(e) =>
                    setFilters({ ...filters, currency: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Currencies</option>
                  <option value="ETH">ETH</option>
                  <option value="MATIC">MATIC</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) =>
                    setFilters({ ...filters, sortBy: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Your Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Owned Pets</span>
                  <span className="text-white font-bold">{pets.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Active Listings</span>
                  <span className="text-white font-bold">
                    {userListings.filter((l) => l.status === "listed").length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Your Balance</span>
                  <span className="text-yellow-400 font-bold">
                    {formatCurrency(coins, "coins")}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Player Level</span>
                  <span className="text-blue-400 font-bold">
                    Lvl {user?.level || 1}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Content */}
          <div className="lg:col-span-3">
            {/* Browse Listings */}
            {activeTab === "browse" && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    Available Pets ({filteredListings.length})
                  </h2>
                  <div className="flex items-center space-x-2 text-gray-400">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">Filtered</span>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-400 mt-4">Loading marketplace...</p>
                  </div>
                ) : filteredListings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔍</div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      No Listings Found
                    </h3>
                    <p className="text-gray-400 mb-4">
                      {searchTerm ||
                      filters.tier !== "all" ||
                      filters.type !== "all" ||
                      filters.currency !== "all"
                        ? "Try adjusting your filters or search terms"
                        : "No pets are currently listed for sale"}
                    </p>
                    {!hasWallet && (
                      <Button onClick={connectWallet} variant="primary">
                        <Wallet className="w-4 h-4 mr-2" />
                        Connect Wallet to Sell Pets
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredListings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        onPurchaseSuccess={loadMarketplaceData}
                        canPurchase={hasWallet}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My Pets */}
            {activeTab === "my-pets" && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    My Pets ({pets.length})
                  </h2>
                  {!hasWallet && (
                    <Button onClick={connectWallet} variant="primary" size="sm">
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet to Sell
                    </Button>
                  )}
                </div>

                {pets.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🐾</div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      No Pets Yet
                    </h3>
                    <p className="text-gray-400 mb-6">
                      Start by hatching some eggs to get pets you can trade!
                    </p>
                    <Button
                      onClick={() => (window.location.href = "/hatchery")}
                      variant="primary"
                    >
                      🥚 Hatch Some Eggs
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {pets.map((pet) => {
                      const petStatus = getPetStatus(pet);

                      return (
                        <div
                          key={pet.id}
                          className="bg-gray-700 rounded-xl p-4 border border-gray-600"
                        >
                          <div className="flex items-center space-x-3 mb-3">
                            <div
                              className={`w-12 h-12 rounded-lg ${
                                TIERS[pet.tier]?.bgColor || "bg-gray-600"
                              } flex items-center justify-center`}
                            >
                              <span className="text-lg">
                                {TYPES[pet.type]?.emoji || "🐾"}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="text-white font-bold">
                                {pet.name}
                              </div>
                              <div className="text-gray-400 text-sm capitalize">
                                {pet.tier?.toLowerCase()} • Lvl {pet.level}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
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

                          <Button
                            size="sm"
                            variant={
                              petStatus.status === "listed"
                                ? "outline"
                                : petStatus.status === "can-list"
                                ? "primary"
                                : "outline"
                            }
                            onClick={() => handleListPet(pet)}
                            disabled={petStatus.status !== "can-list"}
                            className="w-full"
                            title={petStatus.message}
                          >
                            {petStatus.status === "listed" && "✅ Listed"}
                            {petStatus.status === "not-minted" &&
                              "🔄 Mint First"}
                            {petStatus.status === "no-wallet" &&
                              "🔗 Connect Wallet"}
                            {petStatus.status === "can-list" &&
                              "💰 List for Sale"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* My Listings */}
            {activeTab === "my-listings" && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    My Listings ({userListings.length})
                  </h2>
                  {!hasWallet && (
                    <Button onClick={connectWallet} variant="primary" size="sm">
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet
                    </Button>
                  )}
                </div>

                {!hasWallet ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔗</div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Connect Your Wallet
                    </h3>
                    <p className="text-gray-400 mb-6">
                      Connect your wallet to view and manage your listings
                    </p>
                    <Button onClick={connectWallet} variant="primary">
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet
                    </Button>
                  </div>
                ) : userListings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      No Active Listings
                    </h3>
                    <p className="text-gray-400 mb-6">
                      List your pets for sale to see them here
                    </p>
                    <Button
                      onClick={() => setActiveTab("my-pets")}
                      variant="primary"
                    >
                      List a Pet for Sale
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {userListings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        onPurchaseSuccess={loadMarketplaceData}
                        isOwnListing={true}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List Pet Modal */}
      <ListPetModal
        isOpen={showListModal}
        onClose={() => {
          setShowListModal(false);
          setSelectedPet(null);
        }}
        pet={selectedPet}
        onListSuccess={() => {
          loadMarketplaceData();
          loadGameData();
        }}
      />
    </div>
  );
};

export default Marketplace;
