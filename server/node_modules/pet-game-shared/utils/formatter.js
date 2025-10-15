const tiers = require("../constants/tiers.json");
const types = require("../constants/types.json");

class Formatters {
  // Format wallet address for display
  static formatWalletAddress(address, startLength = 6, endLength = 4) {
    if (!address) return "Unknown";
    if (address.length <= startLength + endLength) return address;

    return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
  }

  // Format number with commas
  static formatNumber(num) {
    return new Intl.NumberFormat().format(num);
  }

  // Format currency amount
  static formatCurrency(amount, currency = "ETH", decimals = 4) {
    const formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: decimals,
    });

    let symbol = "";
    switch (currency) {
      case "ETH":
        symbol = "Ξ";
        break;
      case "MATIC":
        symbol = "MATIC";
        break;
      case "USDC":
        symbol = "$";
        break;
      case "coins":
        symbol = "🪙";
        break;
      default:
        symbol = currency;
    }

    return `${symbol}${formatter.format(amount)}`;
  }

  // Format percentage
  static formatPercentage(decimal, decimals = 1) {
    return `${(decimal * 100).toFixed(decimals)}%`;
  }

  // Format time ago
  static formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return time.toLocaleDateString();
  }

  // Format battle time
  static formatBattleTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Format pet stats for display
  static formatPetStats(stats) {
    return {
      attack: this.formatNumber(stats.attack),
      defense: this.formatNumber(stats.defense),
      speed: this.formatNumber(stats.speed),
      health: this.formatNumber(stats.health),
    };
  }

  // Format tier with color and emoji
  static formatTier(tier) {
    const tierData = tiers[tier] || tiers.COMMON;
    return {
      name: tierData.name,
      color: tierData.color,
      emoji: tierData.emoji,
      description: tierData.description,
    };
  }

  // Format type with color and emoji
  static formatType(petType) {
    const typeData = types[petType] || types.FIRE;
    return {
      name: typeData.name,
      color: typeData.color,
      emoji: typeData.emoji,
      description: typeData.description,
    };
  }

  // Format ability for display
  static formatAbility(ability) {
    return {
      ...ability,
      formattedPower:
        ability.power > 0 ? this.formatNumber(ability.power) : "-",
      formattedCooldown: `${ability.cooldown} turn${
        ability.cooldown !== 1 ? "s" : ""
      }`,
      formattedManaCost:
        ability.manaCost > 0 ? `${ability.manaCost} MP` : "No cost",
    };
  }

  // Format experience for level progress
  static formatExperience(experience, level) {
    const expNeeded = Math.pow(level, 2) * 100;
    const progress = (experience / expNeeded) * 100;

    return {
      current: this.formatNumber(experience),
      needed: this.formatNumber(expNeeded),
      progress: Math.min(progress, 100),
      formattedProgress: `${Math.round(progress)}%`,
    };
  }

  // Format fusion materials
  static formatFusionMaterials(materialPets, targetTier) {
    const totalValue = materialPets.reduce((sum, pet) => {
      const tierValue = tiers[pet.tier].id;
      return sum + tierValue;
    }, 0);

    const requiredValue = tiers[targetTier].id * 2; // Simple requirement

    return {
      totalValue,
      requiredValue,
      isValid: totalValue >= requiredValue,
      efficiency: Math.round((totalValue / requiredValue) * 100),
    };
  }

  // Format marketplace listing
  static formatListing(listing, petDetails) {
    return {
      ...listing,
      formattedPrice: this.formatCurrency(listing.price, listing.currency),
      timeListed: this.formatTimeAgo(listing.listedAt),
      petDetails: petDetails ? this.formatPetForListing(petDetails) : null,
      netAmount:
        listing.price * (1 - (listing.marketplaceFee + listing.royaltyFee)),
      formattedNetAmount: this.formatCurrency(
        listing.price * (1 - (listing.marketplaceFee + listing.royaltyFee)),
        listing.currency
      ),
    };
  }

  // Format pet for marketplace display
  static formatPetForListing(pet) {
    return {
      ...pet,
      formattedTier: this.formatTier(pet.tier),
      formattedType: this.formatType(pet.type),
      formattedStats: this.formatPetStats(pet.stats),
      formattedLevel: `Lvl ${pet.level}`,
      formattedExperience: this.formatExperience(pet.experience, pet.level),
      power: Math.round(
        (pet.stats.attack +
          pet.stats.defense +
          pet.stats.speed +
          pet.stats.health / 10) *
          tiers[pet.tier].statMultiplier *
          (1 + (pet.level - 1) * 0.1)
      ),
    };
  }

  // Format battle result
  static formatBattleResult(result, rewards) {
    return {
      ...result,
      formattedWinner: result.winner === "player" ? "Victory!" : "Defeat",
      formattedMargin: this.formatPercentage(result.margin),
      rewards: rewards ? this.formatRewards(rewards) : null,
      criticalText: result.critical ? "Critical!" : "",
    };
  }

  // Format rewards
  static formatRewards(rewards) {
    return {
      ...rewards,
      formattedCoins: this.formatNumber(rewards.coins),
      formattedExperience: this.formatNumber(rewards.experience),
      items: rewards.items.map((item) => this.formatItem(item)),
    };
  }

  // Format item
  static formatItem(item) {
    const itemTypes = {
      healing_potion: { name: "Healing Potion", emoji: "🧪" },
      stat_boost: { name: "Stat Boost", emoji: "⚡" },
      cosmetic_shard: { name: "Cosmetic Shard", emoji: "💎" },
      egg_fragment: { name: "Egg Fragment", emoji: "🥚" },
      premium_currency: { name: "Premium Currency", emoji: "💎" },
      evolve_stone: { name: "Evolve Stone", emoji: "✨" },
    };

    const itemData = itemTypes[item.type] || { name: item.type, emoji: "📦" };

    return {
      ...item,
      formattedName: itemData.name,
      emoji: itemData.emoji,
      formattedQuantity: `x${item.quantity}`,
      formattedRarity: this.formatTier(item.rarity),
    };
  }

  // Format egg for display
  static formatEgg(egg) {
    const eggTypes = {
      BASIC: { name: "Basic Egg", emoji: "🥚", color: "#6B7280" },
      PREMIUM: { name: "Premium Egg", emoji: "💎", color: "#10B981" },
      COSMETIC: { name: "Cosmetic Egg", emoji: "🎨", color: "#8B5CF6" },
      MYSTERY: { name: "Mystery Egg", emoji: "❓", color: "#F59E0B" },
    };

    const eggData = eggTypes[egg.eggType] || eggTypes.BASIC;

    return {
      ...egg,
      formattedName: eggData.name,
      emoji: eggData.emoji,
      color: eggData.color,
      formattedRarity: this.formatTier(egg.rarity),
      canHatch: !egg.isHatched,
      hatchCost: this.formatCurrency(100, "coins"),
      timeUntilHatch: egg.isHatched ? "Hatched" : "Ready to hatch!",
    };
  }
}

module.exports = Formatters;
