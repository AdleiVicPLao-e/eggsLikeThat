import { EGG_TYPES, SKIN_RARITIES, TECHNIQUES } from "../utils/constants.js";
import { weightedRandom, generateRandomPet } from "../utils/rng.js";
import { Pet } from "./Pet.js";

export class Egg {
  constructor(type, ownerId = null) {
    this.type = type;
    this.ownerId = ownerId;
    this.isHatched = false;
    this.contents = null;
  }

  hatch() {
    if (this.isHatched) throw new Error("This egg has already been hatched.");

    let result;
    switch (this.type) {
      case EGG_TYPES.BASIC:
        result = this.hatchPet();
        break;
      case EGG_TYPES.COSMETIC:
        result = this.hatchSkin();
        break;
      case EGG_TYPES.ATTRIBUTE:
        result = this.hatchTechnique();
        break;
      default:
        throw new Error(`Unknown egg type: ${this.type}`);
    }

    this.isHatched = true;
    this.contents = result;
    return result;
  }

  /** 🐣 Hatch a pet using RNG logic */
  hatchPet() {
    // Generate fully randomized pet data (rarity, stats, abilities, etc.)
    const petData = generateRandomPet(this.ownerId);

    // Create a Pet instance
    const pet = new Pet(petData);

    return pet;
  }

  /** 🎨 Hatch a skin cosmetic */
  hatchSkin() {
    const rarity = weightedRandom(SKIN_RARITIES);
    return {
      id: crypto.randomUUID(),
      name: `${rarity.name} Skin`,
      rarity: rarity.name,
      type: "Cosmetic",
      ownerId: this.ownerId,
      obtainedAt: new Date(),
    };
  }

  /** 🧠 Hatch a random technique */
  hatchTechnique() {
    // Flatten TECHNIQUES with level weights
    const allTechs = TECHNIQUES.flatMap((t) =>
      t.levels
        ? t.levels.map((l) => ({
            name: `${t.name} Lv.${l.level}`,
            chance: l.chance,
            effect: l.effect,
          }))
        : [t]
    );

    const tech = weightedRandom(allTechs);
    return {
      id: crypto.randomUUID(),
      name: tech.name,
      rarity: this.getTechniqueRarity(tech.chance),
      effect: tech.effect,
      type: "Technique",
      ownerId: this.ownerId,
      obtainedAt: new Date(),
    };
  }

  /** 🧮 Technique rarity tier mapping */
  getTechniqueRarity(chance) {
    if (chance <= 0.1) return "Godly";
    if (chance <= 1) return "Legendary";
    if (chance <= 3) return "Epic";
    if (chance <= 10) return "Rare";
    return "Common";
  }
}
