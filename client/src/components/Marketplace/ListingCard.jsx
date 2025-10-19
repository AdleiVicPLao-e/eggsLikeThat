import React, { useState } from "react";
import { useGame } from "../../context/GameContext";
import { useUser } from "../../context/UserContext";
import { useWallet } from "../../hooks/useWallet";
import Button from "../UI/Button";

const ListingCard = ({
  listing,
  onPurchaseSuccess,
  canPurchase = true,
  isOwnListing = false,
}) => {
  const { gameAPI } = useGame();
  const { user } = useUser();
  const { isConnected, connect } = useWallet();
  const [loading, setLoading] = useState(false);

  // Helper functions that work with data from backend
  const formatTier = (tier) => {
    // These styles will work with any tier names sent from backend
    const tierStyles = {
      Common: { bgColor: "bg-gray-500", textColor: "text-gray-300" },
      Uncommon: { bgColor: "bg-green-500", textColor: "text-green-300" },
      Rare: { bgColor: "bg-blue-500", textColor: "text-blue-300" },
      Epic: { bgColor: "bg-purple-500", textColor: "text-purple-300" },
      Legendary: { bgColor: "bg-yellow-500", textColor: "text-yellow-300" },
      Mythic: { bgColor: "bg-red-500", textColor: "text-red-300" },
      Celestial: { bgColor: "bg-indigo-500", textColor: "text-indigo-300" },
      Exotic: { bgColor: "bg-pink-500", textColor: "text-pink-300" },
      Ultimate: { bgColor: "bg-orange-500", textColor: "text-orange-300" },
      Godly: { bgColor: "bg-cyan-500", textColor: "text-cyan-300" },
    };
    return tierStyles[tier] || tierStyles["Common"];
  };

  const formatType = (type) => {
    // Default type handling that works with any type names from backend
    const typeEmojis = {
      FIRE: "🔥",
      WATER: "💧",
      EARTH: "🌿",
      AIR: "💨",
      ELECTRIC: "⚡",
      LIGHT: "✨",
      DARK: "🌑",
      DRAGON: "🐉",
      PHOENIX: "🔥",
      UNICORN: "🦄",
      GRIFFIN: "🦅",
    };

    return {
      name:
        type?.charAt(0).toUpperCase() + type?.slice(1).toLowerCase() ||
        "Unknown",
      emoji: typeEmojis[type] || "🐾",
    };
  };

  const handleBuy = async () => {
    // Check if wallet is connected
    if (!isConnected) {
      const result = await connect();
      if (!result.success) {
        alert("Please connect your wallet to purchase pets");
        return;
      }
    }

    if (!canPurchase) {
      alert("You need to connect your wallet to purchase pets");
      return;
    }

    setLoading(true);
    try {
      const result = await gameAPI.purchasePet(listing.id);

      if (result.success) {
        alert("Pet purchased successfully!");
        onPurchaseSuccess?.();
      } else {
        throw new Error(result.error || "Failed to purchase pet");
      }
    } catch (error) {
      console.error("Failed to buy pet:", error);
      alert(`Failed to purchase pet: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Safe data access with fallbacks
  const pet = listing.pet || {};
  const tierData = formatTier(pet.tier);
  const typeData = formatType(pet.type);

  const isUserListing =
    listing.seller?.walletAddress?.toLowerCase() ===
      user?.walletAddress?.toLowerCase() || isOwnListing;

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-500 transition-all">
      {/* Pet Image/Icon */}
      <div className="relative mb-4">
        <div
          className={`w-full h-40 rounded-lg ${tierData.bgColor} flex items-center justify-center`}
        >
          <span className="text-4xl">{typeData.emoji}</span>
        </div>

        {/* Rarity Badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${tierData.bgColor} text-white`}
        >
          {pet.tier ? pet.tier.toUpperCase() : "UNKNOWN"}
        </div>

        {/* Price Tag */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-white text-sm">
          {listing.price} {listing.currency}
        </div>

        {/* Seller Info */}
        {listing.seller && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 px-2 py-1 rounded text-white text-xs">
            {listing.seller.username ||
              `${listing.seller.walletAddress?.slice(
                0,
                6
              )}...${listing.seller.walletAddress?.slice(-4)}`}
          </div>
        )}
      </div>

      {/* Pet Info */}
      <div className="space-y-2">
        <h3 className={`font-bold text-lg ${tierData.textColor}`}>
          {pet.name || "Unknown Pet"}
        </h3>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="text-white capitalize">{typeData.name}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">Level:</span>
            <span className="text-white">{pet.level || 1}</span>
          </div>

          {listing.listedAt && (
            <div className="flex justify-between">
              <span className="text-gray-400">Listed:</span>
              <span className="text-gray-300 text-xs">
                {new Date(listing.listedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        {pet.stats && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-center bg-gray-700 rounded p-1">
              <div className="text-red-400">ATK</div>
              <div className="text-white">{pet.stats.attack || 0}</div>
            </div>
            <div className="text-center bg-gray-700 rounded p-1">
              <div className="text-blue-400">DEF</div>
              <div className="text-white">{pet.stats.defense || 0}</div>
            </div>
            {pet.stats.speed && (
              <div className="text-center bg-gray-700 rounded p-1">
                <div className="text-green-400">SPD</div>
                <div className="text-white">{pet.stats.speed}</div>
              </div>
            )}
            {pet.stats.health && (
              <div className="text-center bg-gray-700 rounded p-1">
                <div className="text-yellow-400">HP</div>
                <div className="text-white">{pet.stats.health}</div>
              </div>
            )}
          </div>
        )}

        {/* Abilities - will work with any ability names from backend */}
        {pet.abilities?.[0] && (
          <div className="text-center">
            <span className="text-purple-400 text-xs bg-purple-500 bg-opacity-20 px-2 py-1 rounded">
              {pet.abilities[0]}
            </span>
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          {isUserListing ? (
            <Button variant="outline" size="sm" className="w-full" disabled>
              Your Listing
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              loading={loading}
              onClick={handleBuy}
              disabled={!canPurchase}
            >
              {!canPurchase ? "Connect Wallet" : "Buy Now"}
            </Button>
          )}
        </div>

        {/* Status Badge */}
        {listing.status && listing.status !== "listed" && (
          <div className="text-center mt-2">
            <span
              className={`text-xs px-2 py-1 rounded ${
                listing.status === "sold"
                  ? "bg-green-500 bg-opacity-20 text-green-400"
                  : listing.status === "cancelled"
                  ? "bg-red-500 bg-opacity-20 text-red-400"
                  : "bg-gray-500 bg-opacity-20 text-gray-400"
              }`}
            >
              {listing.status.toUpperCase()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ListingCard;
