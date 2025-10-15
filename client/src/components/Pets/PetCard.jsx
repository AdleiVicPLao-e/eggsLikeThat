import React from "react";

const rarityColors = {
  common: "bg-gray-500",
  uncommon: "bg-green-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-yellow-500",
};

const rarityTextColors = {
  common: "text-gray-300",
  uncommon: "text-green-300",
  rare: "text-blue-300",
  epic: "text-purple-300",
  legendary: "text-yellow-300",
};

const PetCard = ({ pet, onSelect, isSelected = false }) => {
  return (
    <div
      onClick={() => onSelect?.(pet)}
      className={`bg-gray-800 rounded-xl p-4 border-2 cursor-pointer transition-all hover:scale-105 ${
        isSelected ? "border-blue-500" : "border-gray-700"
      }`}
    >
      {/* Pet Image/Icon */}
      <div className="relative">
        <div
          className={`w-full h-32 rounded-lg ${
            rarityColors[pet.tier]
          } flex items-center justify-center mb-3`}
        >
          <span className="text-4xl">🐾</span>
        </div>

        {/* Rarity Badge */}
        <div
          className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold ${
            rarityColors[pet.tier]
          } text-white`}
        >
          {pet.tier.toUpperCase()}
        </div>
      </div>

      {/* Pet Info */}
      <div className="space-y-2">
        <h3 className={`font-bold text-lg ${rarityTextColors[pet.tier]}`}>
          {pet.name}
        </h3>

        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Type:</span>
            <span className="text-white capitalize">{pet.type}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Level:</span>
            <span className="text-white">{pet.level || 1}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center bg-gray-700 rounded p-1">
            <div className="text-red-400">ATK</div>
            <div className="text-white">{pet.stats.attack}</div>
          </div>
          <div className="text-center bg-gray-700 rounded p-1">
            <div className="text-blue-400">DEF</div>
            <div className="text-white">{pet.stats.defense}</div>
          </div>
        </div>

        {/* Ability */}
        {pet.ability && (
          <div className="mt-2 p-2 bg-gray-700 rounded text-xs">
            <div className="text-gray-400">Ability:</div>
            <div className="text-white font-medium">{pet.ability}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PetCard;
