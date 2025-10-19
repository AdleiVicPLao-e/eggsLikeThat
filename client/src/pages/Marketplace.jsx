import React, { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import { useGame } from "../context/GameContext";
import { useWallet } from "../hooks/useWallet";
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
  Sparkles,
} from "lucide-react";
import { PET_RARITIES, CURRENCIES } from "../utils/constants";

const Marketplace = () => {
  const { user, isAuthenticated } = useUser();
  const { pets, coins, gameAPI } = useGame();
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
    getMarketplaceListings,
    buyNFTFromMarketplace,
  } = useWallet();

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
  const [activeTab, setActiveTab] = useState("browse");
  const [blockchainPets, setBlockchainPets] = useState([]);
  const [blockchainListings, setBlockchainListings] = useState([]);

  // Load marketplace data
  useEffect(() => {
    if (isAuthenticated) {
      loadMarketplaceData();
    }
  }, [isAuthenticated]);

  // Load blockchain data when wallet connects
  useEffect(() => {
    if (isConnected) {
      loadBlockchainData();
    }
  }, [isConnected]);

  // Filter and search listings
  useEffect(() => {
    let result = [...listings, ...blockchainListings];

    // Search filter
    if (searchTerm) {
      result = result.filter(
        (listing) =>
          listing.pet?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          listing.pet?.petType
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          listing.pet?.rarity
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          listing.seller?.username
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          listing.seller?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Tier filter
    if (filters.tier !== "all") {
      result = result.filter(
        (listing) =>
          listing.pet?.tier === filters.tier ||
          listing.pet?.rarity === filters.tier
      );
    }

    // Type filter
    if (filters.type !== "all") {
      result = result.filter(
        (listing) =>
          listing.pet?.type === filters.tier ||
          listing.pet?.petType === filters.type
      );
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
          (a, b) =>
            new Date(b.listedAt || b.createdAt) -
            new Date(a.listedAt || a.createdAt)
        );
        break;
      case "oldest":
        result = [...result].sort(
          (a, b) =>
            new Date(a.listedAt || a.createdAt) -
            new Date(b.listedAt || b.createdAt)
        );
        break;
      default:
        break;
    }

    setFilteredListings(result);
  }, [listings, blockchainListings, searchTerm, filters]);

  const loadMarketplaceData = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const [listingsResponse, userListingsResponse] = await Promise.all([
        gameAPI.getListings({ status: "listed", limit: 50 }),
        isConnected ? gameAPI.getUserListings() : { data: { listings: [] } },
      ]);

      if (listingsResponse?.success && listingsResponse.data?.listings) {
        setListings(listingsResponse.data.listings);

        // Calculate stats from listings
        const totalListings = listingsResponse.data.listings.length;
        const activeSellers = new Set(
          listingsResponse.data.listings.map((l) => l.seller?.walletAddress)
        ).size;
        const totalVolume = listingsResponse.data.listings.reduce(
          (sum, listing) => sum + parseFloat(listing.price || 0),
          0
        );
        const averagePrice =
          totalListings > 0 ? totalVolume / totalListings : 0;

        setStats({
          totalListings,
          activeSellers,
          volume24h: formatCurrency(totalVolume, "ETH"),
          averagePrice: formatCurrency(averagePrice, "ETH"),
        });
      }

      if (
        userListingsResponse?.success &&
        userListingsResponse.data?.listings
      ) {
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

  const loadBlockchainData = async () => {
    try {
      // Load blockchain NFTs
      const nftsResult = await getUserNFTs();
      if (nftsResult.success) {
        setBlockchainPets(nftsResult.pets || []);
      }

      // Load blockchain marketplace listings
      const blockchainListingsResult = await getMarketplaceListings();
      if (blockchainListingsResult) {
        const formattedListings = blockchainListingsResult.map((listing) => ({
          id: `blockchain_${listing.listingId}`,
          listingId: listing.listingId,
          seller: listing.seller,
          price: listing.price,
          currency: "ETH", // Blockchain listings are always in ETH
          pet: {
            id: `blockchain_${listing.tokenId}`,
            tokenId: listing.tokenId,
            name: `Blockchain Pet #${listing.tokenId}`,
            tier: PET_RARITIES.RARE, // You'd need to fetch actual metadata
            type: "UNKNOWN",
            abilities: ["Blockchain Native"],
            stats: { attack: 100, defense: 100, speed: 100, health: 100 },
            level: 1,
            isBlockchain: true,
          },
          listedAt: new Date(), // You'd get this from events
          status: "listed",
          isBlockchain: true,
          nftContract: listing.nftContract,
          itemType: listing.itemType,
        }));
        setBlockchainListings(formattedListings);
      }
    } catch (error) {
      console.error("Error loading blockchain data:", error);
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
          tier: PET_RARITIES.LEGENDARY,
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
          tier: PET_RARITIES.EPIC,
          type: "WATER",
          abilities: ["Water Shield"],
          stats: { attack: 140, defense: 160, speed: 100, health: 180 },
          level: 8,
        },
        listedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
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

  // Handle wallet connection
  const handleConnectWallet = async () => {
    const result = await connect();
    if (result.success) {
      const loginResult = await loginWithWallet();
      if (!loginResult.success) {
        await registerWithWallet({ username: `user_${account.slice(2, 8)}` });
      }
      // Reload blockchain data after connection
      await loadBlockchainData();
    }
  };

  const handleListPet = (pet) => {
    if (!isConnected) {
      const connect = confirm("Connect your wallet to list pets for sale?");
      if (connect) {
        handleConnectWallet();
      }
      return;
    }

    // Check network for blockchain listing
    if (!isCorrectNetwork) {
      alert("Please switch to localhost network to list pets on blockchain");
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
    await Promise.all([
      loadMarketplaceData(),
      isConnected && loadBlockchainData(),
    ]);
    setRefreshing(false);
  };

  // Handle blockchain purchase
  const handleBlockchainPurchase = async (listing) => {
    if (!isConnected) {
      alert("Please connect your wallet to purchase");
      return;
    }

    if (!isCorrectNetwork) {
      const switchResult = await switchNetwork(31337);
      if (!switchResult.success) {
        alert("Please switch to localhost network to purchase");
        return;
      }
    }

    try {
      const result = await buyNFTFromMarketplace(
        listing.listingId,
        listing.price
      );
      if (result.success) {
        alert(
          "Purchase successful! The NFT has been transferred to your wallet."
        );
        // Reload data
        await loadBlockchainData();
        await loadMarketplaceData();
      } else {
        alert(`Purchase failed: ${result.error}`);
      }
    } catch (error) {
      console.error("Purchase error:", error);
      alert(`Purchase failed: ${error.message}`);
    }
  };

  // Format currency for display
  const formatCurrency = (amount, currency = CURRENCIES.COINS) => {
    if (currency === CURRENCIES.ETH || currency === CURRENCIES.MATIC) {
      return `${parseFloat(amount).toFixed(4)} ${currency}`;
    }
    return amount.toLocaleString();
  };

  // Format number for display
  const formatNumber = (num) => {
    return num.toLocaleString();
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
    };
    return tierStyles[tier] || tierStyles[PET_RARITIES.COMMON];
  };

  // Check if we're on the correct network for blockchain features
  const isCorrectNetwork = networkConfig?.name === "localhost";

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
            🌐 Switch to localhost for blockchain trading
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
          Blockchain pets: {blockchainPets.length} • Blockchain listings:{" "}
          {blockchainListings.length}
        </div>
      </div>
    );
  };

  const statCards = [
    {
      icon: Store,
      label: "Total Listings",
      value: formatNumber(stats.totalListings + blockchainListings.length),
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
      isConnected &&
      isCorrectNetwork &&
      pet.tokenId &&
      !userListings.some(
        (listing) => listing.pet?.id === pet.id && listing.status === "listed"
      ) &&
      !blockchainListings.some(
        (listing) => listing.pet?.tokenId === pet.tokenId
      )
    );
  };

  const getPetStatus = (pet) => {
    if (!isConnected) return { status: "no-wallet", message: "Connect wallet" };
    if (!isCorrectNetwork)
      return { status: "wrong-network", message: "Switch network" };
    if (!pet.tokenId) return { status: "not-minted", message: "Not minted" };
    if (
      userListings.some(
        (listing) => listing.pet?.id === pet.id && listing.status === "listed"
      ) ||
      blockchainListings.some((listing) => listing.pet?.tokenId === pet.tokenId)
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
            {!isConnected && "Connect your wallet to start trading!"}
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

        {/* Wallet Connection & Status */}
        {getConnectionStatus()}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-6">
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
                  {Object.values(PET_RARITIES).map((tier) => (
                    <option key={tier} value={tier}>
                      {formatTier(tier).emoji} {tier}
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
                  <option value="FIRE">🔥 Fire</option>
                  <option value="WATER">💧 Water</option>
                  <option value="EARTH">🌿 Earth</option>
                  <option value="AIR">💨 Air</option>
                  <option value="ELECTRIC">⚡ Electric</option>
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
                  <span className="text-gray-400">NFT Pets</span>
                  <span className="text-purple-400 font-bold flex items-center">
                    {blockchainPets.length}
                    <Sparkles className="w-3 h-3 ml-1" />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Active Listings</span>
                  <span className="text-white font-bold">
                    {userListings.filter((l) => l.status === "listed").length +
                      blockchainListings.filter((l) => l.seller === account)
                        .length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Your Balance</span>
                  <span className="text-yellow-400 font-bold">
                    {formatCurrency(coins, "coins")}
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
                    {!isConnected && (
                      <Button onClick={handleConnectWallet} variant="primary">
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
                        onPurchaseSuccess={handleRefresh}
                        onBlockchainPurchase={handleBlockchainPurchase}
                        canPurchase={isConnected && isCorrectNetwork}
                        isBlockchain={listing.isBlockchain}
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
                    My Pets ({pets.length + blockchainPets.length})
                  </h2>
                  {!isConnected && (
                    <Button
                      onClick={handleConnectWallet}
                      variant="primary"
                      size="sm"
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet to Sell
                    </Button>
                  )}
                </div>

                {pets.length === 0 && blockchainPets.length === 0 ? (
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
                    {/* Game Pets */}
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
                                formatTier(pet.tier).bgColor
                              } flex items-center justify-center`}
                            >
                              <span className="text-lg">
                                {pet.type === "FIRE"
                                  ? "🔥"
                                  : pet.type === "WATER"
                                  ? "💧"
                                  : pet.type === "EARTH"
                                  ? "🌿"
                                  : pet.type === "AIR"
                                  ? "💨"
                                  : pet.type === "ELECTRIC"
                                  ? "⚡"
                                  : "🐾"}
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
                            {petStatus.status === "wrong-network" &&
                              "🌐 Switch Network"}
                            {petStatus.status === "can-list" &&
                              "💰 List for Sale"}
                          </Button>
                        </div>
                      );
                    })}

                    {/* Blockchain Pets */}
                    {blockchainPets.map((pet) => (
                      <div
                        key={`blockchain-${pet.tokenId}`}
                        className="bg-purple-700 rounded-xl p-4 border border-purple-500"
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="text-white font-bold flex items-center">
                              {pet.name}
                              <Sparkles className="w-3 h-3 text-purple-300 ml-1" />
                            </div>
                            <div className="text-purple-300 text-sm capitalize">
                              {pet.rarity?.toLowerCase()} • Lvl {pet.level}
                            </div>
                            <div className="text-purple-200 text-xs">
                              Token #{pet.tokenId}
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleListPet(pet)}
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                          💰 List on Blockchain
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My Listings */}
            {activeTab === "my-listings" && (
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">
                    My Listings (
                    {userListings.length +
                      blockchainListings.filter((l) => l.seller === account)
                        .length}
                    )
                  </h2>
                  {!isConnected && (
                    <Button
                      onClick={handleConnectWallet}
                      variant="primary"
                      size="sm"
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet
                    </Button>
                  )}
                </div>

                {!isConnected ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🔗</div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Connect Your Wallet
                    </h3>
                    <p className="text-gray-400 mb-6">
                      Connect your wallet to view and manage your listings
                    </p>
                    <Button onClick={handleConnectWallet} variant="primary">
                      <Wallet className="w-4 h-4 mr-2" />
                      Connect Wallet
                    </Button>
                  </div>
                ) : userListings.length === 0 &&
                  blockchainListings.filter((l) => l.seller === account)
                    .length === 0 ? (
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
                        onPurchaseSuccess={handleRefresh}
                        isOwnListing={true}
                      />
                    ))}
                    {blockchainListings
                      .filter((listing) => listing.seller === account)
                      .map((listing) => (
                        <ListingCard
                          key={listing.id}
                          listing={listing}
                          onPurchaseSuccess={handleRefresh}
                          isOwnListing={true}
                          isBlockchain={true}
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
          handleRefresh();
        }}
      />
    </div>
  );
};

export default Marketplace;
