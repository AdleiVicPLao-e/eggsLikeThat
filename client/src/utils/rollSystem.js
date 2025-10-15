import { RNGService } from "pet-game-shared/utils/rng.js";
import { TIERS, TYPES, ABILITIES } from "./constants.js";

// Create RNG instance with optional seed for deterministic results
export const rng = new RNGService();

// Client-specific preview functions
export const previewHatch = (eggType = "BASIC") => {
  const previewPets = rng.generateEggPreview(eggType);

  return previewPets.map((pet) => ({
    ...pet,
    formattedTier: TIERS[pet.tier]?.name || "Unknown",
    formattedType: TYPES[pet.type]?.name || "Unknown",
    emoji: TYPES[pet.type]?.emoji || "❓",
    color: TYPES[pet.type]?.color || "#6B7280",
  }));
};

export const simulateBattle = (playerPets, opponentPets) => {
  const battleLog = [];
  let turn = 0;

  // Simple battle simulation for preview
  const playerPower = playerPets.reduce(
    (sum, pet) => sum + calculatePetPower(pet),
    0
  );
  const opponentPower = opponentPets.reduce(
    (sum, pet) => sum + calculatePetPower(pet),
    0
  );

  const result = rng.calculateBattleOutcome(
    { stats: { attack: playerPower }, type: playerPets[0]?.type },
    { stats: { attack: opponentPower }, type: opponentPets[0]?.type }
  );

  // Generate battle log entries
  for (let i = 0; i < 3; i++) {
    const attacker = i % 2 === 0 ? "player" : "opponent";
    const pet = attacker === "player" ? playerPets[0] : opponentPets[0];
    const ability = getRandomAbility(pet.type);

    battleLog.push({
      turn: i + 1,
      attacker,
      petName: pet.name,
      ability: ability.name,
      damage: Math.floor(ability.power * (0.8 + Math.random() * 0.4)),
      critical: Math.random() < 0.1,
    });
  }

  return {
    result,
    battleLog,
    rewards: calculateBattleRewards(
      result.winner === "player",
      playerPets[0]?.level || 1
    ),
  };
};

export const previewFusion = (materialPets, targetTier) => {
  const successChance = rng.calculateFusionSuccess(materialPets, targetTier);
  const cost = calculateFusionCost(materialPets, targetTier);

  const possibleOutcomes = [];
  for (let i = 0; i < 3; i++) {
    const tier = rng.rollTier();
    const type = rng.rollType();
    const stats = rng.generateStats(tier);

    possibleOutcomes.push({
      tier,
      type,
      stats,
      probability: Math.round((1 / 3) * 100) + "%",
      emoji: TYPES[type]?.emoji || "❓",
    });
  }

  return {
    successChance,
    cost,
    materialValue: calculateMaterialValue(materialPets),
    possibleOutcomes,
    requirements: getFusionRequirements(targetTier),
  };
};

// Helper functions
const calculatePetPower = (pet) => {
  const { attack, defense, speed, health } = pet.stats;
  const tierMultiplier = TIERS[pet.tier]?.statMultiplier || 1;
  const levelMultiplier = 1 + (pet.level - 1) * 0.1;

  return (
    attack + defense + speed + (health / 10) * tierMultiplier * levelMultiplier
  );
};

const getRandomAbility = (petType) => {
  const abilityPool = ABILITIES[`${petType}_ABILITIES`];
  if (!abilityPool) return { name: "Basic Attack", power: 10 };

  const abilities = Object.values(abilityPool);
  return abilities[Math.floor(Math.random() * abilities.length)];
};

const calculateBattleRewards = (isVictory, playerLevel) => {
  const baseReward = isVictory ? 50 : 10;
  const levelBonus = playerLevel * 5;

  return {
    coins: baseReward + levelBonus,
    experience: Math.floor((baseReward + levelBonus) * 0.5),
    items: isVictory ? [{ type: "healing_potion", quantity: 1 }] : [],
  };
};

const calculateFusionCost = (materialPets, targetTier) => {
  const baseCost = {
    UNCOMMON: 100,
    RARE: 250,
    EPIC: 500,
    LEGENDARY: 1000,
  };

  return baseCost[targetTier] || 100;
};

const calculateMaterialValue = (materialPets) => {
  const tierValues = {
    COMMON: 10,
    UNCOMMON: 25,
    RARE: 50,
    EPIC: 100,
    LEGENDARY: 250,
  };

  return materialPets.reduce(
    (sum, pet) => sum + (tierValues[pet.tier] || 0),
    0
  );
};

const getFusionRequirements = (targetTier) => {
  const requirements = {
    UNCOMMON: { minPets: 2, minTier: "COMMON" },
    RARE: { minPets: 3, minTier: "UNCOMMON" },
    EPIC: { minPets: 3, minTier: "RARE" },
    LEGENDARY: { minPets: 4, minTier: "EPIC" },
  };

  return requirements[targetTier] || { minPets: 2, minTier: "COMMON" };
};

export default rng;
