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
} from "lucide-react";
import { formatCurrency, formatNumber } from "../utils/rarity";
import { TIERS, TYPES } from "../utils/constants";

const Marketplace = () => {
  const { user, isWalletConnected } = useUser();
  const { pets, loadGameData } = useGame();
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
    currency: "ETH",
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

  // Load marketplace data
  useEffect(() => {
    loadMarketplaceData();
  }, []);

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
    setLoading(true);
    try {
      const [listingsResponse, statsResponse, userListingsResponse] =
        await Promise.all([
          getListings({ status: "listed", limit: 50 }),
          getMarketplaceStats(),
          isWalletConnected
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
          username: "Trader1",
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
          username: "Trader2",
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
          username: "Trader3",
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
          username: "Trader4",
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
    if (!isWalletConnected) {
      alert("Please connect your wallet to list pets for sale");
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
    },
    {
      icon: Users,
      label: "Active Sellers",
      value: formatNumber(stats.activeSellers),
    },
    {
      icon: TrendingUp,
      label: "Volume (24h)",
      value: stats.volume24h,
    },
    {
      icon: Coins,
      label: "Avg Price",
      value: stats.averagePrice,
    },
  ];

  const canListPet = (pet) => {
    return (
      isWalletConnected &&
      pet.tokenId &&
      !userListings.some(
        (listing) => listing.pet?.id === pet.id && listing.status === "listed"
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Marketplace</h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Buy, sell, and trade pets with other players. Connect your wallet to
            start trading!
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-blue-400" />
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Filters & Your Pets */}
          <div className="space-y-6">
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
                  {Object.values(TIERS).map((tier) => (
                    <option key={tier.id} value={tier.name.toUpperCase()}>
                      {tier.name}
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
                  {Object.values(TYPES).map((type) => (
                    <option key={type.id} value={type.name.toUpperCase()}>
                      {type.name} {type.emoji}
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

            {/* Your Pets for Listing */}
            {pets.length > 0 && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">Your Pets</h3>
                  <span className="text-gray-400 text-sm">
                    {pets.length} owned
                  </span>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
                  {pets.slice(0, 5).map((pet) => {
                    const canList = canListPet(pet);
                    const isListed = userListings.some(
                      (listing) =>
                        listing.pet?.id === pet.id &&
                        listing.status === "listed"
                    );

                    return (
                      <div
                        key={pet.id}
                        className="flex items-center justify-between bg-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-sm">🐾</span>
                          </div>
                          <div>
                            <div className="text-white font-medium text-sm">
                              {pet.name}
                            </div>
                            <div className="text-gray-400 text-xs capitalize">
                              {pet.tier?.toLowerCase()} • Lvl {pet.level}
                            </div>
                            {!pet.tokenId && (
                              <div className="text-yellow-400 text-xs">
                                Not minted
                              </div>
                            )}
                            {isListed && (
                              <div className="text-green-400 text-xs">
                                Listed
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isListed ? "outline" : "primary"}
                          onClick={() => handleListPet(pet)}
                          disabled={!canList}
                          title={
                            !isWalletConnected
                              ? "Connect wallet"
                              : !pet.tokenId
                              ? "Pet not minted"
                              : isListed
                              ? "Already listed"
                              : "List for sale"
                          }
                        >
                          {isListed ? "Listed" : "Sell"}
                        </Button>
                      </div>
                    );
                  })}

                  {pets.length > 5 && (
                    <div className="text-center pt-2">
                      <span className="text-gray-400 text-sm">
                        +{pets.length - 5} more pets
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Listings */}
          <div className="lg:col-span-3">
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
                  <div className="text-6xl mb-4">🏪</div>
                  <h3 className="text-xl font-bold text-white mb-2">
                    No Listings Found
                  </h3>
                  <p className="text-gray-400">
                    {searchTerm ||
                    filters.tier !== "all" ||
                    filters.type !== "all" ||
                    filters.currency !== "all"
                      ? "Try adjusting your filters"
                      : "No pets are currently listed for sale"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onPurchaseSuccess={loadMarketplaceData}
                    />
                  ))}
                </div>
              )}
            </div>
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
