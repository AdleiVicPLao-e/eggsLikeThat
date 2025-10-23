// utils/constants.js
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load JSON files using ES6 imports
const abilitiesData = JSON.parse(
  readFileSync(join(__dirname, "../constants/abilities.json"), "utf8")
);
const typesData = JSON.parse(
  readFileSync(join(__dirname, "../constants/types.json"), "utf8")
);

// 🎯 Rarities
export const PET_RARITIES = [
  { name: "Godly", chance: 0.05 },
  { name: "Ultimate", chance: 0.1 },
  { name: "Exotic", chance: 0.3 },
  { name: "Celestial", chance: 0.55 },
  { name: "Mythic", chance: 1 },
  { name: "Legendary", chance: 2 },
  { name: "Epic", chance: 4 },
  { name: "Rare", chance: 7 },
  { name: "Uncommon", chance: 12 },
  { name: "Common", chance: 73 },
];

export const SKIN_RARITIES = [
  { name: "Mythic", chance: 1 },
  { name: "Legendary", chance: 4 },
  { name: "Epic", chance: 15 },
  { name: "Classic", chance: 80 },
];

// 🥚 Egg Types
export const EGG_TYPES = {
  BASIC: "basic",
  COSMETIC: "cosmetic",
  ATTRIBUTE: "attribute",
};

// 🧠 Techniques with proper multipliers
export const TECHNIQUES = {
  Scoped: {
    levels: [
      { level: 1, chance: 12, cooldown: 1.05 },
      { level: 2, chance: 9, cooldown: 1.08 },
      { level: 3, chance: 5, cooldown: 1.1 },
    ],
  },
  Accelerate: {
    levels: [
      { level: 1, chance: 10, spa: 0.97 },
      { level: 2, chance: 7, spa: 0.95 },
      { level: 3, chance: 4, spa: 0.92 },
    ],
  },
  Sturdy: {
    levels: [
      { level: 1, chance: 10, dmg: 1.05 },
      { level: 2, chance: 7, dmg: 1.08 },
      { level: 3, chance: 4, dmg: 1.1 },
    ],
  },
  Shining: { chance: 9, moneyBonus: 1.1 },
  "Eagle Eye": { chance: 4, cooldown: 1.15 },
  Golden: { chance: 3.5, moneyBonus: 1.125 },
  "Hyper Speed": { chance: 3, spa: 0.875 },
  Juggernaut: { chance: 3, dmg: 1.125, spa: 0.975 },
  "Elemental Master": {
    chance: 2,
    dmg: 1.05,
    dotDuration: 2.5,
    dotDamage: 0.75,
  },
  Vulture: { chance: 2.25, cooldown: 1.25, critChance: 1.05, critDamage: 1.15 },
  Diamond: { chance: 1.75, dmg: 1.05, moneyBonus: 1.2 },
  Cosmic: { chance: 1, dmg: 1.15, cooldown: 1.1, spa: 0.85 },
  "Demi God": { chance: 1, dmg: 1.25, spa: 0.95 },
  "All Seeing": {
    chance: 0.35,
    dmg: 1.25,
    cooldown: 1.5,
    critChance: 1.25,
    critDamage: 2.0,
  },
  Entrepreneur: {
    chance: 0.3,
    dmg: 1.25,
    cooldown: 1.05,
    spa: 0.9,
    moneyBonus: 1.45,
  },
  Shinigami: {
    chance: 0.2,
    dmg: 1.75,
    cooldown: 1.3,
    spa: 0.85,
    critChance: 1.1,
    critDamage: 1.25,
    onePlacement: true,
  },
  Overlord: {
    chance: 0.2,
    dmg: 5.25,
    cooldown: 1.2,
    spa: 0.85,
    critChance: 1.15,
    critDamage: 1.25,
    onePlacement: true,
  },
  Avatar: {
    chance: 0.1,
    dmg: 6.5,
    cooldown: 1.3,
    spa: 0.85,
    critChance: 1.15,
    critDamage: 1.25,
    onePlacement: true,
  },
  Glitched: {
    chance: 0.03,
    dmg: 8.5,
    cooldown: 1.35,
    spa: 0.85,
    moneyBonus: 1.6,
    critChance: 1.15,
    critDamage: 1.75,
    onePlacement: true,
  },
};

// ONE PLACEMENT techniques
export const ONE_PLACEMENT_TECHNIQUES = [
  "Shinigami",
  "Overlord",
  "Avatar",
  "Glitched",
];

// 🌋 Pet elemental types and abilities
export const PET_TYPES = typesData;
export const TYPE_KEYS = Object.keys(typesData);

// Flatten ability sets into one lookup
export const ALL_ABILITIES = Object.values(abilitiesData).reduce((acc, set) => {
  Object.values(set).forEach((a) => (acc[a.id] = a));
  return acc;
}, {});

// Helper to get technique multipliers
export const getTechniqueMultipliers = (techniqueName, level = 1) => {
  const technique = TECHNIQUES[techniqueName];
  if (!technique) return {};

  if (technique.levels && level) {
    const levelData =
      technique.levels.find((l) => l.level === level) ||
      technique.levels[technique.levels.length - 1];
    return { ...levelData };
  }

  return { ...technique };
};

// Check if technique requires one placement
export const isOnePlacementTechnique = (techniqueName) => {
  return ONE_PLACEMENT_TECHNIQUES.includes(techniqueName);
};

// Get abilities by type
export const getAbilitiesByType = (typeName) => {
  if (!typeName || !abilitiesData[typeName]) return [];
  return Object.values(abilitiesData[typeName]);
};
