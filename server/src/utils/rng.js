// utils/rng.js
import { PET_RARITIES, TYPE_KEYS, getAbilitiesByType } from "./constants.js";

/**
 * Weighted random selection helper
 * @param {Array<{chance:number}>} items
 */
export function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.chance, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.chance;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/** 🔀 Random element from array */
export function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/** 🌈 Random elemental type */
export function randomType() {
  return randomChoice(TYPE_KEYS);
}

/** 🪄 Generate random abilities from type */
export function randomAbilitiesForType(typeName, count = 2) {
  const list = getAbilitiesByType(typeName);
  if (!list?.length) return [];
  const chosen = [];
  while (chosen.length < count && list.length > 0) {
    const pick = randomChoice(list);
    if (!chosen.includes(pick)) chosen.push(pick);
  }
  return chosen;
}

/** 📈 Rarity multiplier for stat scaling */
export function getRarityMultiplier(rarityName) {
  const table = {
    Common: 1.0,
    Uncommon: 1.15,
    Rare: 1.3,
    Epic: 1.6,
    Legendary: 2.0,
    Mythic: 2.4,
    Celestial: 2.8,
    Exotic: 3.2,
    Ultimate: 3.8,
    Godly: 4.5,
  };
  return table[rarityName] || 1.0;
}

/**
 * 🧬 Generate balanced base stats influenced by rarity
 */
export function generateBaseStats(rarityName) {
  const mult = getRarityMultiplier(rarityName);

  const base = {
    dmg: randomRange(10, 20),
    hp: randomRange(50, 100),
    range: randomRange(1, 5),
    spa: +(randomRange(0.8, 1.5) / mult).toFixed(2), // faster with higher rarity
    critChance: +Math.min(0.05 * mult, 0.5).toFixed(2),
    critDamage: +(1.5 * mult).toFixed(2),
    moneyBonus: +Math.max(0, (mult - 1) * 0.1).toFixed(2),
  };

  // Apply rarity scaling to damage, HP, range
  base.dmg = Math.round(base.dmg * mult);
  base.hp = Math.round(base.hp * mult);
  base.range = +(base.range * (1 + mult / 10)).toFixed(2);

  return base;
}

/** 🧮 Helper for random number within range */
export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * 🐾 Full random pet generator — returns Pet-compatible data
 * You can pass this directly into `new Pet({...})`
 */
export function generateRandomPet(ownerId = null) {
  const rarity = weightedRandom(PET_RARITIES).name;
  const type = randomType();
  const abilityList = randomAbilitiesForType(type, 2);
  const stats = generateBaseStats(rarity);

  return {
    ownerId,
    name: `${type}ling`,
    type,
    rarity,
    ability: abilityList,
    stats,
  };
}
