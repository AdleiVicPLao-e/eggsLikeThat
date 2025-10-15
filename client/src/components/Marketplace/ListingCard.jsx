import React from "react";
import { useBlockchain } from "../../hooks/useBlockchain";
import { useUser } from "../../context/UserContext";
import Button from "../UI/Button";
import { getRarityColor, getRarityBgColor } from "../../utils/rarity";

const ListingCard = ({ listing }) => {
  const { buyPet, transactionLoading } = useBlockchain();
  const { user } = useUser();

  const handleBuy = async () => {
    try {
      await buyPet(listing.tokenId, listing.price);
      // Refresh listings or show success message
    } catch (error) {
      console.error("Failed to buy pet:", error);
    }
  };

  const isOwnListing =
    listing.seller.toLowerCase() === user?.address?.toLowerCase();

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-500 transition-all">
      {/* Pet Image/Icon */}
      <div className="relative mb-4">
        <div
          className={`w-full h-40 rounded-lg ${getRarityBgColor(
            listing.pet.tier
          )} flex items-center justify-center`}
        >
          <span className="text-4xl">🐾</span>
        </div>

        {/* Rarity Badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${getRarityBgColor(
            listing.pet.tier
          )} text-white`}
        >
          {listing.pet.tier.toUpperCase()}
        </div>

        {/* Price Tag */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded text-white text-sm">
          {listing.price} ETH
        </div>
      </div>

      {/* Pet Info */}
      <div className="space-y-2">
        <h3 className={`font-bold text-lg ${getRarityColor(listing.pet.tier)}`}>
          {listing.pet.name}
        </h3>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="text-white capitalize">{listing.pet.type}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-400">Level:</span>
            <span className="text-white">{listing.pet.level}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center bg-gray-700 rounded p-1">
            <div className="text-red-400">ATK</div>
            <div className="text-white">{listing.pet.stats.attack}</div>
          </div>
          <div className="text-center bg-gray-700 rounded p-1">
            <div className="text-blue-400">DEF</div>
            <div className="text-white">{listing.pet.stats.defense}</div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {isOwnListing ? (
            <Button variant="outline" size="sm" className="w-full" disabled>
              Your Listing
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              loading={transactionLoading}
              onClick={handleBuy}
            >
              Buy Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingCard;
