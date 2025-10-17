// src/models/Pet.js

export class Pet {
  constructor({
    id = crypto.randomUUID(),
    ownerId = null,
    name,
    type,
    rarity,
    ability,
    technique = null,
    skin = null,

    // Core stats
    stats = {
      dmg: 10,
      hp: 50,
      range: 1,
      spa: 1.0, // seconds per attack
      critChance: 0,
      critDamage: 0,
      moneyBonus: 0,
    },

    // Battle state
    currentHP = stats.hp,
    statusEffects = [],
    isAlive = true,

    // Progression
    level = 1,
    experience = 0,
    evolutionStage = 1,
    evolutions = [],

    // Cosmetics
    title = null,
    isShiny = false,

    // Metadata
    createdAt = new Date(),
    updatedAt = new Date(),
  }) {
    this.id = id;
    this.ownerId = ownerId;
    this.name = name;
    this.type = type;
    this.rarity = rarity;
    this.ability = ability;
    this.technique = technique;
    this.skin = skin;

    this.stats = stats;
    this.currentHP = currentHP;
    this.statusEffects = statusEffects;
    this.isAlive = isAlive;

    this.level = level;
    this.experience = experience;
    this.evolutionStage = evolutionStage;
    this.evolutions = evolutions;

    this.title = title;
    this.isShiny = isShiny;

    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  /** --- 🧠 Core Functions --- **/

  gainExperience(amount) {
    if (!amount || amount <= 0) return;
    this.experience += amount;

    const threshold = this.level * 100;
    if (this.experience >= threshold) {
      this.experience -= threshold;
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.stats.dmg = Math.round(this.stats.dmg * 1.1);
    this.stats.hp = Math.round(this.stats.hp * 1.1);
    this.stats.range = +(this.stats.range * 1.02).toFixed(2);
    this.stats.spa = +(this.stats.spa * 0.97).toFixed(2);
    this.currentHP = this.stats.hp;
  }

  takeDamage(amount) {
    this.currentHP -= amount;
    if (this.currentHP <= 0) {
      this.currentHP = 0;
      this.isAlive = false;
    }
  }

  heal(amount) {
    if (!this.isAlive) return;
    this.currentHP = Math.min(this.stats.hp, this.currentHP + amount);
  }

  applyStatus(status) {
    if (!this.statusEffects.find((s) => s.name === status.name)) {
      this.statusEffects.push(status);
    }
  }

  removeStatus(name) {
    this.statusEffects = this.statusEffects.filter((s) => s.name !== name);
  }

  /** --- 🧩 Utility --- **/

  resetBattleState() {
    this.currentHP = this.stats.hp;
    this.statusEffects = [];
    this.isAlive = true;
  }

  evolve(newForm) {
    if (!newForm) return;
    this.evolutionStage++;
    this.name = newForm.name || this.name;
    this.stats = {
      ...this.stats,
      dmg: Math.round(this.stats.dmg * 1.25),
      hp: Math.round(this.stats.hp * 1.25),
    };
    this.rarity = newForm.rarity || this.rarity;
    this.evolutions.push(newForm.name);
  }

  /** --- 🔍 Output --- **/

  toJSON() {
    return {
      id: this.id,
      ownerId: this.ownerId,
      name: this.name,
      type: this.type,
      rarity: this.rarity,
      ability: this.ability,
      technique: this.technique,
      skin: this.skin,
      stats: this.stats,
      currentHP: this.currentHP,
      statusEffects: this.statusEffects,
      isAlive: this.isAlive,
      level: this.level,
      experience: this.experience,
      evolutionStage: this.evolutionStage,
      evolutions: this.evolutions,
      title: this.title,
      isShiny: this.isShiny,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
