// src/utils/battleLogic.js

"use strict";

import {
  PET_TYPES,
  ALL_ABILITIES,
  TECHNIQUES,
  getTechniqueMultipliers,
  isOnePlacementTechnique,
} from "../utils/constants.js";

const actions = ["attack", "defend", "parry", "ability"];
const weightedActions = [
  "attack",
  "attack",
  "defend",
  "defend",
  "parry",
  "parry",
  "ability",
];

// Action matrix for determining battle outcomes
const actionMatrix = {
  attack: {
    attack: "both damaged",
    defend: "win",
    parry: "lose",
    ability: "win",
    recover: "win",
  },
  defend: {
    attack: "lose",
    defend: "tie",
    parry: "win",
    ability: "lose",
    recover: "tie",
  },
  parry: {
    attack: "win",
    defend: "lose",
    parry: "both damaged",
    ability: "win",
    recover: "win",
  },
  ability: {
    attack: "lose",
    defend: "win",
    parry: "lose",
    ability: "both damaged",
    recover: "win",
  },
  recover: {
    attack: "lose",
    defend: "tie",
    parry: "lose",
    ability: "lose",
    recover: "tie",
  },
};

export function computeDamage(
  basePower,
  attackerLevel,
  defenderLevel,
  typeMultiplier,
  critMultiplier = 1,
  techniqueMultiplier = 1
) {
  const levelFactor = 1 + (attackerLevel - defenderLevel) * 0.05;
  return Math.floor(
    basePower *
      levelFactor *
      typeMultiplier *
      critMultiplier *
      techniqueMultiplier
  );
}

export function getTypeEffectiveness(attackerType, defenderType) {
  const attackerTypeData = Object.values(PET_TYPES).find(
    (t) => t.name.toUpperCase() === attackerType.toUpperCase()
  );
  const defenderTypeData = Object.values(PET_TYPES).find(
    (t) => t.name.toUpperCase() === defenderType.toUpperCase()
  );

  if (!attackerTypeData || !defenderTypeData) return 1.0;

  // Check strengths
  if (
    attackerTypeData.strengths?.includes(defenderTypeData.name.toUpperCase())
  ) {
    return 1.5; // Super effective
  }

  // Check weaknesses
  if (
    attackerTypeData.weaknesses?.includes(defenderTypeData.name.toUpperCase())
  ) {
    return 0.5; // Not very effective
  }

  return 1.0; // Normal effectiveness
}

export function getEffectiveStats(pet) {
  const baseStats = { ...pet.stats };

  if (!pet.technique) return baseStats;

  const techniqueMultipliers = getTechniqueMultipliers(
    pet.technique,
    pet.techniqueLevel || 1
  );
  const effectiveStats = { ...baseStats };

  // Apply technique multipliers directly
  if (techniqueMultipliers.dmg)
    effectiveStats.dmg = Math.round(baseStats.dmg * techniqueMultipliers.dmg);
  if (techniqueMultipliers.spa)
    effectiveStats.spa = +(baseStats.spa * techniqueMultipliers.spa).toFixed(2);
  if (techniqueMultipliers.cooldown)
    effectiveStats.cooldown = techniqueMultipliers.cooldown;
  if (techniqueMultipliers.critChance)
    effectiveStats.critChance = +(
      baseStats.critChance * techniqueMultipliers.critChance
    ).toFixed(2);
  if (techniqueMultipliers.critDamage)
    effectiveStats.critDamage = +(
      baseStats.critDamage * techniqueMultipliers.critDamage
    ).toFixed(2);
  if (techniqueMultipliers.moneyBonus)
    effectiveStats.moneyBonus = +(
      baseStats.moneyBonus * techniqueMultipliers.moneyBonus
    ).toFixed(2);

  return effectiveStats;
}

export function evaluateTurn(player, opponent, playerActionResult) {
  const { playerAction, opponentAction, result } = playerActionResult;
  const playerPet = player.pet;
  const opponentPet = opponent.pet;

  let damage = 0;
  let abilityUsed = null;

  // Get effective stats with technique multipliers
  const playerStats = getEffectiveStats(playerPet);
  const opponentStats = getEffectiveStats(opponentPet);

  // Handle ability usage
  if (playerAction === "ability" && playerPet.ability) {
    abilityUsed = ALL_ABILITIES[playerPet.ability];
    if (abilityUsed && canUseAbility(playerPet, abilityUsed)) {
      damage = calculateAbilityDamage(
        abilityUsed,
        playerPet,
        opponentPet,
        playerStats
      );
      useAbility(playerPet, abilityUsed);
    } else {
      // Fallback to regular attack
      damage = calculateRegularDamage(
        playerStats,
        playerPet,
        opponentPet,
        playerAction,
        opponentAction
      );
    }
  } else if (opponentAction === "ability" && opponentPet.ability) {
    abilityUsed = ALL_ABILITIES[opponentPet.ability];
    if (abilityUsed && canUseAbility(opponentPet, abilityUsed)) {
      damage = calculateAbilityDamage(
        abilityUsed,
        opponentPet,
        playerPet,
        opponentStats
      );
      useAbility(opponentPet, abilityUsed);
    } else {
      damage = calculateRegularDamage(
        opponentStats,
        opponentPet,
        playerPet,
        opponentAction,
        playerAction
      );
    }
  } else {
    // Regular attack damage
    damage = calculateRegularDamage(
      playerStats,
      playerPet,
      opponentPet,
      playerAction,
      opponentAction
    );
  }

  // Apply damage based on result
  if (result === "win") {
    opponentPet.currentHP -= damage;
  } else if (result === "lose") {
    playerPet.currentHP -= damage;
  } else if (result === "both damaged") {
    opponentPet.currentHP -= damage;
    playerPet.currentHP -= damage;
  }

  playerPet.currentHP = Math.max(0, playerPet.currentHP);
  opponentPet.currentHP = Math.max(0, opponentPet.currentHP);

  // Apply ability effects
  if (abilityUsed && abilityUsed.effect) {
    applyAbilityEffect(
      abilityUsed,
      playerPet,
      opponentPet,
      { damage },
      playerStats
    );
  }

  // Process cooldowns and status effects
  processCooldowns(playerPet);
  processCooldowns(opponentPet);
  processStatusEffects(playerPet);
  processStatusEffects(opponentPet);

  return {
    player,
    opponent,
    damage,
    abilityUsed,
    playerAction,
    opponentAction,
    result,
  };
}

export function calculateRegularDamage(
  attackerStats,
  attacker,
  defender,
  attackerAction,
  defenderAction
) {
  const basePower = attackerStats.dmg || 10;
  const typeMultiplier = getTypeEffectiveness(attacker.type, defender.type);

  // Get technique damage multiplier
  const techniqueMultipliers = getTechniqueMultipliers(
    attacker.technique,
    attacker.techniqueLevel || 1
  );
  const techniqueMultiplier = techniqueMultipliers.dmg || 1.0;

  // Check for critical hit with technique bonuses
  const critChance = attackerStats.critChance || 0;
  const critMultiplier = attackerStats.critDamage || 1.5;
  const isCritical = Math.random() < critChance;
  const finalCritMultiplier = isCritical ? critMultiplier : 1.0;

  return Math.floor(
    computeDamage(
      basePower,
      attacker.level,
      defender.level,
      typeMultiplier,
      finalCritMultiplier,
      techniqueMultiplier
    )
  );
}

export function calculateAbilityDamage(
  ability,
  attacker,
  defender,
  attackerStats
) {
  const basePower = ability.power || 20;
  const typeMultiplier = getTypeEffectiveness(ability.element, defender.type);
  const levelMultiplier = 1 + (attacker.level - 1) * 0.05;

  // Get technique damage multiplier
  const techniqueMultipliers = getTechniqueMultipliers(
    attacker.technique,
    attacker.techniqueLevel || 1
  );
  const techniqueMultiplier = techniqueMultipliers.dmg || 1.0;

  let damage = Math.floor(
    basePower * typeMultiplier * levelMultiplier * techniqueMultiplier
  );

  // Apply special damage modifiers
  if (ability.effect === "EXECUTE") {
    const missingHPRatio =
      (defender.stats.hp - defender.currentHP) / defender.stats.hp;
    damage *= 1 + missingHPRatio;
  }

  if (ability.effect === "SCALING_DAMAGE") {
    const fallenAllies = attacker.team
      ? attacker.team.filter((pet) => pet.currentHP <= 0).length
      : 0;
    damage *= 1 + fallenAllies * 0.3;
  }

  // Apply critical hit chance for offensive abilities
  if (ability.type === "OFFENSIVE") {
    const critChance = attackerStats.critChance || 0;
    const critMultiplier = attackerStats.critDamage || 1.5;

    // Check for guaranteed critical
    const hasGuaranteedCritical = attacker.statusEffects?.some(
      (effect) =>
        effect.name === "critical_guarantee" || effect.guaranteedCritical
    );

    if (hasGuaranteedCritical || Math.random() < critChance) {
      damage = Math.floor(damage * critMultiplier);
    }
  }

  // Handle multi-hit abilities
  if (ability.effect === "MULTI_HIT") {
    const hitCount = 3; // Default for Archangel's Wrath
    let totalDamage = 0;
    for (let i = 0; i < hitCount; i++) {
      totalDamage += Math.floor(damage / hitCount);
    }
    damage = totalDamage;
  }

  // Handle instant kill
  if (
    ability.effect === "INSTANT_KILL" &&
    Math.random() < (ability.effectChance || 0.3)
  ) {
    damage = defender.currentHP; // Instantly kill
  }

  return Math.floor(damage);
}

export function applyAbilityEffect(
  ability,
  attacker,
  defender,
  result,
  attackerStats
) {
  const effectChance = ability.effectChance || 0.3;

  if (Math.random() > effectChance) return;

  // Get technique multipliers for DOT effects
  const techniqueMultipliers = getTechniqueMultipliers(
    attacker.technique,
    attacker.techniqueLevel || 1
  );
  const dotDurationMultiplier = techniqueMultipliers.dotDuration || 1.0;
  const dotDamageMultiplier = techniqueMultipliers.dotDamage || 1.0;

  switch (ability.effect) {
    case "BURN":
      const burnDuration = Math.floor(3 * dotDurationMultiplier);
      const burnDamage = Math.floor(
        attackerStats.dmg * 0.1 * dotDamageMultiplier
      );
      defender.statusEffects.push({
        name: "burn",
        duration: burnDuration,
        damagePerTurn: burnDamage,
        type: "damage",
      });
      break;

    case "PERMANENT_BURN":
      defender.statusEffects.push({
        name: "permanent_burn",
        duration: 999, // Permanent
        damagePerTurn: Math.floor(attackerStats.dmg * 0.2),
        type: "damage",
      });
      break;

    case "DOT":
      const dotDuration = Math.floor(2 * dotDurationMultiplier);
      const dotDamage = Math.floor(
        ((ability.power || 15) * dotDamageMultiplier) / dotDuration
      );
      defender.statusEffects.push({
        name: "damage_over_time",
        duration: dotDuration,
        damagePerTurn: dotDamage,
        type: "damage",
      });
      break;

    case "DAMAGE_OVER_TIME":
      const customDotDuration = Math.floor(3 * dotDurationMultiplier);
      const customDotDamage = Math.floor(
        ((ability.power || 20) * dotDamageMultiplier) / customDotDuration
      );
      defender.statusEffects.push({
        name: "damage_over_time",
        duration: customDotDuration,
        damagePerTurn: customDotDamage,
        type: "damage",
      });
      break;

    case "STUN":
      defender.statusEffects.push({
        name: "stun",
        duration: 1,
        type: "stun",
      });
      break;

    case "HEAL":
      const healAmount = ability.power || 20;
      attacker.currentHP = Math.min(
        attacker.stats.hp,
        attacker.currentHP + healAmount
      );
      break;

    case "FULL_HEAL":
      attacker.currentHP = attacker.stats.hp;
      // Also heal team members if applicable
      if (attacker.team) {
        attacker.team.forEach((pet) => {
          pet.currentHP = pet.stats.hp;
        });
      }
      break;

    case "HEAL_OVER_TIME":
      const hotDuration = Math.floor(3 * dotDurationMultiplier);
      attacker.statusEffects.push({
        name: "heal_over_time",
        duration: hotDuration,
        healPerTurn: Math.floor((ability.power || 15) / hotDuration),
        type: "heal",
      });
      break;

    case "DEFENSE_UP":
      attacker.statusEffects.push({
        name: "defense_up",
        duration: 3,
        defenseMultiplier: 1.3,
        type: "buff",
      });
      break;

    case "DEFENSE_DOWN":
      defender.statusEffects.push({
        name: "defense_down",
        duration: 3,
        defenseMultiplier: 0.7,
        type: "debuff",
      });
      break;

    case "PERMANENT_STAT_REDUCTION":
      defender.statusEffects.push({
        name: "permanent_stat_reduction",
        duration: 999,
        attackMultiplier: 0.7,
        defenseMultiplier: 0.7,
        speedMultiplier: 0.7,
        type: "debuff",
      });
      break;

    case "ATTACK_DOWN":
      defender.statusEffects.push({
        name: "attack_down",
        duration: 3,
        attackMultiplier: 0.6,
        type: "debuff",
      });
      break;

    case "SLOW":
      defender.statusEffects.push({
        name: "slow",
        duration: 2,
        speedReduction: 0.7,
        type: "debuff",
      });
      break;

    case "SPEED_UP":
      attacker.statusEffects.push({
        name: "speed_up",
        duration: 3,
        speedMultiplier: 1.4,
        type: "buff",
      });
      break;

    case "EVASION_UP":
      attacker.statusEffects.push({
        name: "evasion_up",
        duration: 3,
        evasionBonus: 0.5, // 50% evasion chance
        type: "buff",
      });
      break;

    case "ACCURACY_DOWN":
      defender.statusEffects.push({
        name: "accuracy_down",
        duration: 3,
        accuracyReduction: 0.6,
        type: "debuff",
      });
      break;

    case "LIFE_STEAL":
      const stealAmount = Math.floor(result.damage * 0.5); // 50% of damage dealt
      attacker.currentHP = Math.min(
        attacker.stats.hp,
        attacker.currentHP + stealAmount
      );
      break;

    case "CLEANSE":
      attacker.statusEffects = attacker.statusEffects.filter(
        (effect) =>
          ![
            "burn",
            "permanent_burn",
            "stun",
            "defense_down",
            "attack_down",
            "slow",
            "damage_over_time",
            "sleep",
            "confusion",
            "accuracy_down",
            "permanent_stat_reduction",
            "healing_reduction",
            "heal_reversal",
            "silence",
            "turn_delay",
          ].includes(effect.name)
      );
      break;

    case "SLEEP":
      const sleepDuration = Math.floor(1 + Math.random());
      defender.statusEffects.push({
        name: "sleep",
        duration: sleepDuration,
        type: "stun",
      });
      break;

    case "CONFUSION":
      defender.statusEffects.push({
        name: "confusion",
        duration: 2,
        selfDamageChance: 0.3,
        type: "debuff",
      });
      break;

    case "TURN_DELAY":
      defender.statusEffects.push({
        name: "turn_delay",
        duration: 1,
        turnsDelayed: 1,
        type: "debuff",
      });
      break;

    case "DAMAGE_REDUCTION":
      attacker.statusEffects.push({
        name: "damage_reduction",
        duration: 1,
        damageReduction: 0.5,
        type: "buff",
      });
      break;

    case "DAMAGE_IMMUNITY":
      attacker.statusEffects.push({
        name: "damage_immunity",
        duration: 1,
        type: "buff",
      });
      break;

    case "IMMORTALITY":
      attacker.statusEffects.push({
        name: "immortality",
        duration: 1,
        type: "buff",
      });
      break;

    case "BARRIER":
      attacker.statusEffects.push({
        name: "barrier",
        duration: 3,
        damageReduction: 0.8, // 80% damage reduction
        type: "buff",
      });
      break;

    case "SILENCE":
      defender.statusEffects.push({
        name: "silence",
        duration: 2,
        type: "debuff",
      });
      break;

    case "HEALING_REDUCTION":
      defender.statusEffects.push({
        name: "healing_reduction",
        duration: 4,
        healingReduction: 0.8, // 80% healing reduction
        type: "debuff",
      });
      break;

    case "HEAL_REVERSAL":
      defender.statusEffects.push({
        name: "heal_reversal",
        duration: 3,
        type: "debuff",
      });
      break;

    case "BUFF_REMOVAL":
      defender.statusEffects = defender.statusEffects.filter(
        (effect) => effect.type !== "buff"
      );
      break;

    case "RANDOM_DEBUFF":
      const randomDebuffs = [
        { effect: "DEFENSE_DOWN", duration: 2 },
        { effect: "ATTACK_DOWN", duration: 2 },
        { effect: "SLOW", duration: 2 },
        { effect: "ACCURACY_DOWN", duration: 2 },
        { effect: "CONFUSION", duration: 1 },
      ];
      const randomDebuff =
        randomDebuffs[Math.floor(Math.random() * randomDebuffs.length)];

      // Apply the random debuff
      const tempAbility = {
        effect: randomDebuff.effect,
        effectChance: 1.0,
        power: ability.power,
      };
      applyAbilityEffect(
        tempAbility,
        attacker,
        defender,
        result,
        attackerStats
      );
      break;

    case "TRANSFORMATION":
      attacker.statusEffects.push({
        name: "transformation",
        duration: 999, // Permanent until battle ends
        evasionBonus: 0.4,
        criticalChance: 0.3,
        type: "buff",
      });
      break;

    case "DAMAGE_AMPLIFICATION":
      defender.statusEffects.push({
        name: "damage_amplification",
        duration: 3,
        damageTakenMultiplier: 1.2,
        type: "debuff",
      });
      break;

    case "SCALING_DAMAGE":
      const fallenAllies = attacker.team
        ? attacker.team.filter((pet) => pet.currentHP <= 0).length
        : 0;
      result.scalingMultiplier = 1 + fallenAllies * 0.3; // 30% more damage per fallen ally
      break;

    case "RESURRECTION":
      // Resurrect fallen team members
      if (attacker.team) {
        attacker.team.forEach((pet) => {
          if (pet.currentHP <= 0) {
            pet.currentHP = Math.floor(pet.stats.hp * 0.5); // 50% HP on resurrection
          }
          // Also apply stat boost
          pet.statusEffects.push({
            name: "resurrection_boost",
            duration: 3,
            attackMultiplier: 1.2,
            defenseMultiplier: 1.2,
            speedMultiplier: 1.2,
            type: "buff",
          });
        });
      }
      break;

    case "BATTLE_RESET":
      // This effect is handled in the battle controller
      attacker.statusEffects.push({
        name: "battle_reset_ready",
        duration: 999,
        type: "buff",
      });
      break;

    case "MULTI_HIT":
      result.multiHit = true;
      result.hitCount = 3; // Number of hits
      break;

    case "EXECUTE":
      const missingHPRatio =
        (defender.stats.hp - defender.currentHP) / defender.stats.hp;
      result.executeMultiplier = 1 + missingHPRatio; // Up to 2x damage
      break;

    case "INSTANT_KILL":
      if (Math.random() < effectChance) {
        defender.currentHP = 0;
        result.instantKill = true;
      }
      break;

    case "TRUE_DAMAGE":
      result.trueDamage = true;
      break;

    case "DEFENSE_IGNORE":
      result.ignoreDefense = true;
      break;

    case "CRITICAL_GUARANTEE":
      attacker.statusEffects.push({
        name: "critical_guarantee",
        duration: 1,
        guaranteedCritical: true,
        type: "buff",
      });
      break;

    case "TYPE_ADVANTAGE":
      result.typeAdvantage = true;
      break;

    case "STAT_REDUCTION":
      defender.statusEffects.push({
        name: "stat_reduction",
        duration: 3,
        attackMultiplier: 0.8,
        defenseMultiplier: 0.8,
        speedMultiplier: 0.8,
        type: "debuff",
      });
      break;
  }
}

// ONE PLACEMENT validation for battle teams
export function validateBattleTeam(pets) {
  const onePlacementPets = pets.filter(
    (pet) => pet.technique && isOnePlacementTechnique(pet.technique)
  );

  if (onePlacementPets.length > 0 && pets.length > 1) {
    return {
      valid: false,
      error: `Pet "${onePlacementPets[0].name}" has ${onePlacementPets[0].technique} technique and must battle alone (ONE PLACEMENT)`,
    };
  }

  return { valid: true };
}

// Calculate battle rewards with money bonus
export function calculateBattleRewards(baseReward, winningPets) {
  let totalMoneyBonus = 1.0;

  // Sum money bonuses from all winning pets
  winningPets.forEach((pet) => {
    const effectiveStats = getEffectiveStats(pet);
    totalMoneyBonus += effectiveStats.moneyBonus || 0;
  });

  return {
    coins: Math.floor(baseReward.coins * totalMoneyBonus),
    experience: baseReward.experience,
    bonusMultiplier: totalMoneyBonus,
  };
}

export function canUseAbility(pet, ability) {
  if (!pet.abilityCooldowns) return true;
  return !(pet.abilityCooldowns[ability.id] > 0);
}

export function useAbility(pet, ability) {
  if (!pet.abilityCooldowns) {
    pet.abilityCooldowns = {};
  }
  pet.abilityCooldowns[ability.id] = ability.cooldown || 1;
}

export function processCooldowns(pet) {
  if (!pet.abilityCooldowns) return;
  Object.keys(pet.abilityCooldowns).forEach((abilityId) => {
    if (pet.abilityCooldowns[abilityId] > 0) {
      pet.abilityCooldowns[abilityId]--;
    }
  });
}

export function processStatusEffects(pet) {
  const newStatusEffects = [];

  for (const status of pet.statusEffects) {
    status.duration--;

    // Handle special status effects
    switch (status.name) {
      case "escalating_dot":
        status.currentTurn++;
        const dotDamage = status.baseDamage * status.currentTurn;
        pet.currentHP = Math.max(0, pet.currentHP - dotDamage);
        break;

      case "confusion":
        if (Math.random() < status.selfDamageChance) {
          // Pet hits itself
          pet.currentHP = Math.max(
            0,
            pet.currentHP - Math.floor(pet.stats.dmg * 0.3)
          );
        }
        break;

      case "heal_reversal":
        // This is handled when healing occurs
        break;

      default:
        // Handle standard damage/heal effects
        if (status.type === "damage" && status.damagePerTurn) {
          pet.currentHP -= status.damagePerTurn;
        } else if (status.type === "heal" && status.healPerTurn) {
          pet.currentHP = Math.min(
            pet.stats.hp,
            pet.currentHP + status.healPerTurn
          );
        }
        break;
    }

    // Keep the status if it still has duration
    if (status.duration > 0) {
      newStatusEffects.push(status);
    }
  }

  pet.currentHP = Math.max(0, pet.currentHP);
  pet.statusEffects = newStatusEffects;
}

export function recoverPokemon(playerPokemon, opponentPokemon) {
  playerPokemon.currentHP = playerPokemon.stats.hp;
  opponentPokemon.currentHP = opponentPokemon.stats.hp;
  playerPokemon.statusEffects = [];
  opponentPokemon.statusEffects = [];
}

// Schedule round-robin matches
export function scheduleRounds(numPlayers) {
  let schedule = [];
  let players = [...Array(numPlayers).keys()];

  for (let round = 0; round < numPlayers - 1; round++) {
    for (let i = 0; i < numPlayers / 2; i++) {
      let home = players[i];
      let away = players[numPlayers - 1 - i];
      schedule.push({ round: round + 1, match: [home, away] });
    }
    players.splice(1, 0, players.pop());
  }
  return schedule;
}

// Generate smart AI attack using weighted actions
export function generateSmartAttack(pet, opponentPet) {
  let weights = [0.6, 0.2, 0.2]; // Default weights for attack, defend, parry

  // Adjust weights based on situation
  if (pet.currentHP < pet.stats.hp * 0.3) {
    // Low health - prefer defending
    weights = [0.3, 0.5, 0.2];
  } else if (opponentPet.currentHP < opponentPet.stats.hp * 0.3) {
    // Opponent low health - prefer attacking
    weights = [0.8, 0.1, 0.1];
  }

  // Consider using ability if available and not on cooldown
  if (pet.ability && canUseAbility(pet, ALL_ABILITIES[pet.ability])) {
    // Add ability to possible actions with some weight
    const abilityWeight = 0.3;
    weights = weights.map((w) => w * (1 - abilityWeight));
    weights.push(abilityWeight);

    const actionsWithAbility = ["attack", "defend", "parry", "ability"];
    const random = Math.random();
    let cumulativeWeight = 0;

    for (let i = 0; i < actionsWithAbility.length; i++) {
      cumulativeWeight += weights[i];
      if (random <= cumulativeWeight) {
        return actionsWithAbility[i];
      }
    }
  }

  // Fallback to regular actions without ability
  const regularActions = ["attack", "defend", "parry"];
  const random = Math.random();
  let cumulativeWeight = 0;

  for (let i = 0; i < regularActions.length; i++) {
    cumulativeWeight += weights[i];
    if (random <= cumulativeWeight) {
      return regularActions[i];
    }
  }

  return "attack"; // Final fallback
}

// Evaluate player battle (compatibility function)
export function evaluatePlayerBattle(player, opponent, playerAction) {
  const opponentAction = generateSmartAttack(opponent.pet, player.pet);
  const result = determineBattleResult(playerAction, opponentAction);

  return evaluateTurn(player, opponent, {
    playerAction,
    opponentAction,
    result,
  });
}

// Determine battle result using the action matrix
export function determineBattleResult(playerAction, opponentAction) {
  return actionMatrix[playerAction]?.[opponentAction] || "both damaged";
}

// Get available actions for a pet
export function getAvailableActions(pet) {
  const availableActions = [...actions]; // Start with all basic actions

  // Check if ability is available
  if (pet.ability && canUseAbility(pet, ALL_ABILITIES[pet.ability])) {
    availableActions.push("ability");
  }

  return availableActions;
}

// Get weighted actions for random AI
export function getWeightedActions() {
  return [...weightedActions];
}

// Check if a technique exists
export function isValidTechnique(techniqueName) {
  return TECHNIQUES.hasOwnProperty(techniqueName);
}

// Get technique information
export function getTechniqueInfo(techniqueName) {
  return TECHNIQUES[techniqueName] || null;
}
