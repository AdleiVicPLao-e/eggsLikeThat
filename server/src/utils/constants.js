// utils/constants.js
import abilitiesData from "../constants/abilities.json" assert { type: "json" };
import typesData from "../constants/types.json" assert { type: "json" };

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

// 🧠 Techniques
export const TECHNIQUES = [
  {
    name: "Scoped",
    levels: [
      { level: 1, chance: 12, effect: "Range +5%" },
      { level: 2, chance: 9, effect: "Range +8%" },
      { level: 3, chance: 5, effect: "Range +10%" },
    ],
  },
  {
    name: "Accelerate",
    levels: [
      { level: 1, chance: 10, effect: "SPA -3%" },
      { level: 2, chance: 7, effect: "SPA -5%" },
      { level: 3, chance: 4, effect: "SPA -8%" },
    ],
  },
  {
    name: "Sturdy",
    levels: [
      { level: 1, chance: 10, effect: "Damage +5%" },
      { level: 2, chance: 7, effect: "Damage +8%" },
      { level: 3, chance: 4, effect: "Damage +10%" },
    ],
  },
  { name: "Shining", chance: 9, effect: "Money +10%" },
  { name: "Eagle Eye", chance: 4, effect: "Range +15%" },
  { name: "Golden", chance: 3.5, effect: "Money +12.5%" },
  { name: "Hyper Speed", chance: 3, effect: "SPA -12.5%" },
  { name: "Juggernaut", chance: 3, effect: "Damage +12.5%, SPA -2.5%" },
  {
    name: "Elemental Master",
    chance: 2,
    effect: "DOT Duration x2.5, Damage +5%",
  },
  {
    name: "Vulture",
    chance: 2.25,
    effect: "Range +25%, Crit +5%, Damage +15%",
  },
  { name: "Diamond", chance: 1.75, effect: "Damage +5%, Money +20%" },
  { name: "Cosmic", chance: 1, effect: "Damage +15%, Range +10%, SPA -15%" },
  { name: "Demi God", chance: 1, effect: "Damage +25%, SPA -5%" },
  {
    name: "All Seeing",
    chance: 0.35,
    effect: "Range +50%, Crit +25%, Damage +25%",
  },
  { name: "Entrepreneur", chance: 0.3, effect: "Money +45%, Damage +25%" },
  {
    name: "Shinigami",
    chance: 0.2,
    effect: "Damage +75%, Crit +10%, Range +30%",
  },
  { name: "Overlord", chance: 0.2, effect: "Damage +425%, ONE PLACEMENT" },
  { name: "Avatar", chance: 0.1, effect: "Damage +550%, ONE PLACEMENT" },
  { name: "Glitched", chance: 0.03, effect: "Damage +750%, ONE PLACEMENT" },
];

// 🌋 Pet elemental types and abilities
export const PET_TYPES = typesData;
export const TYPE_KEYS = Object.keys(typesData);

// Flatten ability sets into one lookup
export const ALL_ABILITIES = Object.values(abilitiesData).reduce((acc, set) => {
  Object.values(set).forEach((a) => (acc[a.id] = a));
  return acc;
}, {});

// Helper to get abilities of a type dynamically
export const getAbilitiesByType = (typeName) => {
  const type = TYPES[typeName.toUpperCase()];
  if (!type || !type.abilities) return [];
  return type.abilities
    .map((name) =>
      Object.values(ALL_ABILITIES).find(
        (a) => a.name.toLowerCase() === name.toLowerCase()
      )
    )
    .filter(Boolean);
};
