// src/controllers/GameController.js
import { DatabaseService } from "../services/DatabaseService.js";
import { serverRNGService } from "../services/RNGService.js";
import { rewardService } from "../services/RewardService.js";
import { mailService } from "../services/MailService.js";
import {
  scheduleRounds,
  evaluateTurn,
  generateSmartAttack,
  recoverPokemon,
  validateBattleTeam,
  calculateBattleRewards,
  getEffectiveStats,
  canUseAbility,
  useAbility,
  processCooldowns,
  processStatusEffects,
} from "../config/battleLogic.js";
import { ALL_ABILITIES, isOnePlacementTechnique } from "../utils/constants.js";
import logger from "../utils/logger.js";

const dbService = new DatabaseService();

export const GameController = {
  // Hatch an egg
  async hatchEgg(req, res) {
    try {
      const userId = req.user.id;
      const { eggId, useFreeRoll = false } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if using free roll or has enough balance
      const hatchCost = 100;
      if (useFreeRoll) {
        const lastFreeHatch = user.lastFreeHatch || new Date(0);
        const hoursSinceLastFree =
          (new Date() - lastFreeHatch) / (1000 * 60 * 60);

        if (hoursSinceLastFree < 24) {
          return res.status(400).json({
            success: false,
            message: "Free hatch available once every 24 hours",
          });
        }
      } else {
        if (user.balance < hatchCost) {
          return res.status(400).json({
            success: false,
            message: `Not enough balance to hatch egg. Cost: ${hatchCost}, You have: ${user.balance}`,
          });
        }
      }

      let eggToHatch;
      if (eggId) {
        // Hatch specific egg
        const eggs = await dbService.getUserEggs(userId);
        eggToHatch = eggs.find((egg) => egg._id.toString() === eggId);
        if (!eggToHatch) {
          return res.status(404).json({
            success: false,
            message: "Egg not found in your collection",
          });
        }
        if (eggToHatch.isHatched) {
          return res.status(400).json({
            success: false,
            message: "Egg has already been hatched",
          });
        }
      } else {
        // Create and hatch a basic egg
        const eggData = serverRNGService.generateEggForDB(userId);
        eggToHatch = await dbService.createEgg(eggData);
      }

      // Hatch the egg
      const hatchResult = await dbService.hatchEgg(eggToHatch._id);

      // Update user balance and track free hatch
      if (useFreeRoll) {
        await dbService.updateUser(userId, { lastFreeHatch: new Date() });
      } else {
        await dbService.updateUserBalance(userId, -hatchCost);
      }

      // Add experience for hatching
      await dbService.updateUserExperience(userId, 25);

      // Get updated user
      const updatedUser = await dbService.findUserById(userId);

      logger.info(`User ${user.username} hatched an egg`);

      const responseData = {
        success: true,
        message: "Egg hatched successfully!",
        data: {
          result: this.formatHatchResult(hatchResult),
          user: {
            balance: updatedUser.balance,
            eggs: updatedUser.eggIds?.length || 0,
            pets: updatedUser.petIds?.length || 0,
            techniques: updatedUser.techniqueIds?.length || 0,
            skins: updatedUser.skinIds?.length || 0,
            level: updatedUser.level,
            experience: updatedUser.experience,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Hatch egg error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during egg hatching",
      });
    }
  },

  // Start a battle with new round-robin system - UPDATED for ONE PLACEMENT
  async startBattle(req, res) {
    try {
      const userId = req.user.id;
      let {
        petIds,
        battleMode = "pve",
        opponentDifficulty = "medium",
        maxPets = 3,
      } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Validate user's pets
      const userPets = user.pets
        .filter((pet) => petIds.includes(pet.id))
        .slice(0, maxPets);

      if (userPets.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid pets selected for battle",
        });
      }

      // Check for ONE PLACEMENT technique - UPDATED LOGIC
      const onePlacementPets = userPets.filter(
        (pet) => pet.technique && isOnePlacementTechnique(pet.technique)
      );

      // If any pet has one placement technique, user can only use that ONE pet
      if (onePlacementPets.length > 0) {
        if (userPets.length > 1) {
          return res.status(400).json({
            success: false,
            message: `Pet "${onePlacementPets[0].name}" has ${onePlacementPets[0].technique} technique (ONE PLACEMENT) and must battle alone. Please send only this pet to battle.`,
          });
        }

        // If user sent only the one placement pet, adjust opponent team to 1 pet
        maxPets = 1;
      }

      // Use validateBattleTeam from battleLogic
      const teamValidation = validateBattleTeam(userPets);
      if (!teamValidation.valid) {
        return res.status(400).json({
          success: false,
          message: teamValidation.error,
        });
      }

      // Generate opponent team with abilities - UPDATED to respect one placement
      const opponentPets = await this.generateOpponentTeam(
        opponentDifficulty,
        userPets,
        maxPets // Now respects the one placement limit
      );

      // Convert pets to battle format
      const playerTeam = this.convertPetsToBattleFormat(
        userPets,
        user.username
      );
      const opponentTeam = this.convertPetsToBattleFormat(
        opponentPets,
        `${opponentDifficulty} Opponent`
      );

      // Simulate round-robin battle using scheduleRounds
      const battleResult = await this.simulateRoundRobinBattle(
        playerTeam,
        opponentTeam,
        battleMode
      );

      // Apply rewards using calculateBattleRewards
      const opponentLevel = this.getOpponentLevel(
        opponentDifficulty,
        user.level
      );

      // Calculate base rewards
      const baseReward = this.calculateBaseBattleRewards(
        opponentLevel,
        battleResult.winner === "player",
        battleMode,
        userPets.length // Pass team size for reward calculation
      );

      // Use calculateBattleRewards from battleLogic for technique bonuses
      const winningPets = battleResult.winner === "player" ? userPets : [];
      const enhancedRewards = calculateBattleRewards(baseReward, winningPets);

      // Update user stats
      if (enhancedRewards.coins > 0) {
        await dbService.updateUserBalance(userId, enhancedRewards.coins);
      }
      if (enhancedRewards.experience > 0) {
        await dbService.updateUserExperience(
          userId,
          enhancedRewards.experience
        );
      }

      // Update user battle stats
      const updateData = { updatedAt: new Date() };
      if (battleResult.winner === "player") {
        updateData.battlesWon = (user.battlesWon || 0) + 1;
      } else {
        updateData.battlesLost = (user.battlesLost || 0) + 1;
      }
      await dbService.updateUser(userId, updateData);

      // Update pet battle stats and experience
      for (const pet of userPets) {
        const petWins = battleResult.battleLog.filter(
          (match) =>
            match.playerPet === pet.id && match.result.winner === "player"
        ).length;

        const petUpdate = {
          battlesWon: (pet.battlesWon || 0) + petWins,
          battlesLost:
            (pet.battlesLost || 0) + (battleResult.totalRounds - petWins),
          experience:
            (pet.experience || 0) +
            Math.floor(enhancedRewards.experience / userPets.length),
          updatedAt: new Date(),
        };

        // Check for pet level up
        const levelUpResult = await this.checkPetLevelUp({
          ...pet,
          ...petUpdate,
        });
        if (levelUpResult.leveledUp) {
          petUpdate.level = levelUpResult.newLevel;
          petUpdate.stats = levelUpResult.newStats;
          petUpdate.experience = petUpdate.experience - levelUpResult.expNeeded;
        }

        await dbService.updatePet(pet.id, petUpdate);
      }

      // Save battle history
      await dbService.addBattleHistory({
        userId,
        result: battleResult.winner === "player" ? "victory" : "defeat",
        opponent: `${opponentDifficulty} Opponent`,
        userPets: userPets.map((pet) => pet.id),
        opponentPets: opponentPets.map((pet) => pet.id),
        rewards: enhancedRewards,
        battleData: battleResult,
        battleType: "round_robin",
        onePlacementUsed: onePlacementPets.length > 0,
      });

      // Send email notification
      if (user.email) {
        try {
          await mailService.sendBattleResults(
            user,
            battleResult,
            enhancedRewards
          );
        } catch (emailError) {
          logger.warn("Failed to send battle results email:", emailError);
        }
      }

      const updatedUser = await dbService.findUserById(userId);

      const responseData = {
        success: true,
        data: {
          battle: {
            result: battleResult,
            userPets: userPets.map((pet) => ({
              id: pet.id,
              name: pet.name,
              type: pet.type,
              rarity: pet.rarity,
              stats: getEffectiveStats(pet),
              level: pet.level,
              battlesWon: pet.battlesWon || 0,
              battlesLost: pet.battlesLost || 0,
              ability: pet.ability,
              technique: pet.technique,
              isOnePlacement: isOnePlacementTechnique(pet.technique),
            })),
            opponentPets: opponentPets.map((pet) => ({
              name: pet.name,
              type: pet.type,
              rarity: pet.rarity,
              level: pet.level,
              ability: pet.ability,
            })),
            onePlacementRule: onePlacementPets.length > 0,
          },
          rewards: enhancedRewards,
          user: {
            balance: updatedUser.balance,
            experience: updatedUser.experience,
            level: updatedUser.level,
            battlesWon: updatedUser.battlesWon,
            battlesLost: updatedUser.battlesLost,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Battle error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during battle",
      });
    }
  },

  // New round-robin battle simulation using scheduleRounds
  async simulateRoundRobinBattle(playerTeam, opponentTeam, battleMode) {
    const battleLog = [];
    let playerWins = 0;
    let opponentWins = 0;

    // Use scheduleRounds from battleLogic for proper scheduling
    const numPlayers = Math.max(playerTeam.length, opponentTeam.length);
    const schedule = scheduleRounds(numPlayers);

    for (const match of schedule) {
      const playerIndex = match.match[0] % playerTeam.length;
      const opponentIndex = match.match[1] % opponentTeam.length;

      const playerPet = playerTeam[playerIndex];
      const opponentPet = opponentTeam[opponentIndex];

      if (!playerPet || !opponentPet) continue;

      // Convert to battle format
      const playerTrainer = {
        id: `player_${playerPet.id}`,
        playerName: "Player",
        pet: this.convertPetToBattleFormat(playerPet),
      };

      const opponentTrainer = {
        id: `opponent_${opponentPet.id}`,
        playerName: "Opponent",
        pet: this.convertPetToBattleFormat(opponentPet),
      };

      let matchResult;

      if (battleMode === "pve") {
        // Simulate AI battle using evaluateTurn
        matchResult = await this.simulatePetBattle(
          playerTrainer,
          opponentTrainer
        );
      } else {
        // For PvP, we'd need player input - for now use AI
        matchResult = await this.simulatePetBattle(
          playerTrainer,
          opponentTrainer
        );
      }

      battleLog.push({
        round: match.round,
        playerPet: playerPet.id,
        opponentPet: opponentPet.id,
        result: matchResult,
      });

      if (matchResult.winner === "player") {
        playerWins++;
      } else if (matchResult.winner === "opponent") {
        opponentWins++;
      }

      // Heal pets for next match using recoverPokemon
      recoverPokemon(playerTrainer.pet, opponentTrainer.pet);
    }

    const overallWinner =
      playerWins > opponentWins
        ? "player"
        : opponentWins > playerWins
        ? "opponent"
        : "draw";

    return {
      winner: overallWinner,
      playerWins,
      opponentWins,
      totalRounds: schedule.length,
      battleLog,
      schedule,
    };
  },

  // Simulate individual pet battle using evaluateTurn - UPDATED to use useAbility
  async simulatePetBattle(playerTrainer, opponentTrainer) {
    const turns = [];
    let currentPlayer = playerTrainer;
    let currentOpponent = opponentTrainer;

    while (
      currentPlayer.pet.currentHP > 0 &&
      currentOpponent.pet.currentHP > 0
    ) {
      const playerAction = this.generatePetAction(
        currentPlayer.pet,
        currentOpponent.pet
      );
      const opponentAction = this.generatePetAction(
        currentOpponent.pet,
        currentPlayer.pet
      );

      // Use evaluateTurn from battleLogic
      const battleResult = evaluateTurn(currentPlayer, currentOpponent, {
        playerAction,
        opponentAction,
        result: this.determineBattleResult(playerAction, opponentAction),
      });

      turns.push({
        turn: turns.length + 1,
        playerAction,
        opponentAction,
        result: battleResult.result,
        playerHP: currentPlayer.pet.currentHP,
        opponentHP: currentOpponent.pet.currentHP,
        damage: battleResult.damage,
        abilityUsed: battleResult.abilityUsed,
        statusEffects: {
          player: [...currentPlayer.pet.statusEffects],
          opponent: [...currentOpponent.pet.statusEffects],
        },
      });

      // Update trainers with new health and status
      currentPlayer = battleResult.player;
      currentOpponent = battleResult.opponent;

      // Process cooldowns and status effects
      processCooldowns(currentPlayer.pet);
      processCooldowns(currentOpponent.pet);
      processStatusEffects(currentPlayer.pet);
      processStatusEffects(currentOpponent.pet);

      // Add small delay for realism
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const winner = currentPlayer.pet.currentHP > 0 ? "player" : "opponent";

    return {
      winner,
      turns,
      finalPlayerHP: currentPlayer.pet.currentHP,
      finalOpponentHP: currentOpponent.pet.currentHP,
      playerPet: currentPlayer.pet,
      opponentPet: currentOpponent.pet,
    };
  },

  // Determine battle result based on actions
  determineBattleResult(playerAction, opponentAction) {
    const actionMatrix = {
      attack: {
        attack: "both damaged",
        defend: "win",
        parry: "lose",
        ability: "win",
      },
      defend: {
        attack: "lose",
        defend: "tie",
        parry: "win",
        ability: "lose",
      },
      parry: {
        attack: "win",
        defend: "lose",
        parry: "both damaged",
        ability: "win",
      },
      ability: {
        attack: "lose",
        defend: "win",
        parry: "lose",
        ability: "both damaged",
      },
    };

    return actionMatrix[playerAction]?.[opponentAction] || "both damaged";
  },

  // Generate smart action for pets considering abilities using canUseAbility - FIXED
  generatePetAction(pet, opponentPet) {
    // If pet has ability and it's a good time to use it
    if (pet.ability && this.shouldUseAbility(pet, opponentPet)) {
      const ability = ALL_ABILITIES[pet.ability];
      // Use the ability immediately when decision is made
      useAbility(pet, ability);
      return "ability";
    }

    // Otherwise use smart AI decision
    return generateSmartAttack(pet, opponentPet);
  },

  // Determine if pet should use its ability using canUseAbility - FIXED
  shouldUseAbility(pet, opponentPet) {
    const ability = ALL_ABILITIES[pet.ability];
    if (!ability) return false;

    // Check cooldown using canUseAbility from battleLogic
    if (!canUseAbility(pet, ability)) {
      return false;
    }

    const useChance = Math.random();

    // Higher chance to use ability when:
    // - Opponent is weak
    // - Pet is low on health (for healing abilities)
    // - Based on ability type

    if (ability.type === "SUPPORT" && pet.currentHP < pet.stats.hp * 0.4) {
      return useChance < 0.7; // 70% chance to use healing when low
    }

    if (
      ability.type === "OFFENSIVE" &&
      opponentPet.currentHP < opponentPet.stats.hp * 0.3
    ) {
      return useChance < 0.6; // 60% chance to finish with ability
    }

    // Default chance to use ability
    return useChance < 0.3; // 30% chance normally
  },

  // Calculate base battle rewards - UPDATED to consider team size
  calculateBaseBattleRewards(
    opponentLevel,
    isVictory,
    battleMode,
    teamSize = 3
  ) {
    const baseCoins = opponentLevel * 10 * (teamSize / 3); // Scale rewards by team size
    const baseExp = opponentLevel * 5 * (teamSize / 3);

    if (!isVictory) {
      return {
        coins: Math.floor(baseCoins * 0.3), // 30% for loss
        experience: Math.floor(baseExp * 0.3),
      };
    }

    const multiplier = battleMode === "pvp" ? 1.5 : 1.0;

    return {
      coins: Math.floor(baseCoins * multiplier),
      experience: Math.floor(baseExp * multiplier),
    };
  },

  // Convert blockchain pet to battle format using getEffectiveStats
  convertPetToBattleFormat(pet) {
    return {
      id: pet.id,
      name: pet.name,
      type: pet.type,
      rarity: pet.rarity,
      ability: pet.ability,
      technique: pet.technique,
      techniqueLevel: pet.techniqueLevel || 1,
      level: pet.level || 1,
      stats: getEffectiveStats(pet), // Use effective stats with technique multipliers
      currentHP: pet.currentHP || pet.stats.hp,
      statusEffects: pet.statusEffects || [],
      isAlive: pet.isAlive !== false,
      abilityCooldowns: pet.abilityCooldowns || {},
    };
  },

  // Convert multiple pets to battle format
  convertPetsToBattleFormat(pets, trainerName) {
    return pets.map((pet, index) => ({
      id: pet.id,
      name: pet.name,
      type: pet.type,
      rarity: pet.rarity,
      ability: pet.ability,
      technique: pet.technique,
      techniqueLevel: pet.techniqueLevel || 1,
      level: pet.level || 1,
      stats: pet.stats || {},
      currentHP: pet.currentHP || pet.stats.hp,
      statusEffects: pet.statusEffects || [],
      isAlive: pet.isAlive !== false,
      trainerName,
      position: index + 1,
    }));
  },

  // Generate opponent team with abilities and techniques - UPDATED for one placement
  async generateOpponentTeam(difficulty, userPets, maxPets) {
    const difficulties = {
      easy: { levelMultiplier: 0.7, rarity: "common" },
      medium: { levelMultiplier: 1.0, rarity: "uncommon" },
      hard: { levelMultiplier: 1.3, rarity: "rare" },
      epic: { levelMultiplier: 1.6, rarity: "epic" },
    };

    const config = difficulties[difficulty] || difficulties.medium;
    const opponentPets = [];

    // If user has one placement pet, opponent also gets 1 pet
    const teamSize = Math.min(userPets.length, maxPets);

    const avgUserLevel =
      userPets.reduce((sum, pet) => sum + (pet.level || 1), 0) /
      userPets.length;

    for (let i = 0; i < teamSize; i++) {
      const opponentPet = serverRNGService.generatePet();

      // Scale opponent pet based on difficulty
      opponentPet.level = Math.max(
        1,
        Math.round(avgUserLevel * config.levelMultiplier)
      );
      opponentPet.rarity = config.rarity;

      // Enhance stats based on difficulty
      if (opponentPet.stats) {
        Object.keys(opponentPet.stats).forEach((stat) => {
          opponentPet.stats[stat] = Math.round(
            opponentPet.stats[stat] * config.levelMultiplier
          );
        });
      }

      // Add random ability based on type
      const typeAbilities = Object.values(ALL_ABILITIES).filter(
        (ability) => ability.element === opponentPet.type?.toUpperCase()
      );
      if (typeAbilities.length > 0) {
        const randomAbility =
          typeAbilities[Math.floor(Math.random() * typeAbilities.length)];
        opponentPet.ability = randomAbility.id;
      }

      opponentPets.push(opponentPet);
    }

    return opponentPets;
  },

  // NEW: Validate team composition before battle
  validateTeamComposition(userPets) {
    const onePlacementPets = userPets.filter(
      (pet) => pet.technique && isOnePlacementTechnique(pet.technique)
    );

    if (onePlacementPets.length > 0 && userPets.length > 1) {
      return {
        valid: false,
        error: `Cannot use multiple pets when "${onePlacementPets[0].name}" has ONE PLACEMENT technique ${onePlacementPets[0].technique}`,
        onePlacementPet: onePlacementPets[0],
      };
    }

    return { valid: true };
  },

  // NEW: Get available pets for battle (respecting one placement)
  async getAvailableBattlePets(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const availablePets = user.pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        rarity: pet.rarity,
        level: pet.level,
        ability: pet.ability,
        technique: pet.technique,
        isOnePlacement: pet.technique
          ? isOnePlacementTechnique(pet.technique)
          : false,
        stats: getEffectiveStats(pet),
      }));

      // Check if user has any one placement pets
      const onePlacementPets = availablePets.filter(
        (pet) => pet.isOnePlacement
      );

      res.json({
        success: true,
        data: {
          pets: availablePets,
          onePlacementPets: onePlacementPets,
          maxTeamSize: onePlacementPets.length > 0 ? 1 : 3,
          rules: {
            onePlacement:
              "Pets with ONE PLACEMENT techniques must battle alone",
          },
        },
      });
    } catch (error) {
      logger.error("Get available battle pets error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get battle history with enhanced details
  async getBattleHistory(req, res) {
    try {
      const userId = req.user.id;
      const battleHistory = await dbService.getUserBattleHistory(userId);

      // Enhance with round-robin details
      const enhancedHistory = battleHistory.map((battle) => {
        if (battle.battleType === "round_robin" && battle.battleData) {
          return {
            ...battle,
            detailedResults: {
              totalRounds: battle.battleData.totalRounds,
              playerWins: battle.battleData.playerWins,
              opponentWins: battle.battleData.opponentWins,
              individualMatches: battle.battleData.battleLog,
            },
          };
        }
        return battle;
      });

      const summary = {
        totalBattles: enhancedHistory.length,
        victories: enhancedHistory.filter((b) => b.result === "victory").length,
        defeats: enhancedHistory.filter((b) => b.result === "defeat").length,
        roundRobinBattles: enhancedHistory.filter(
          (b) => b.battleType === "round_robin"
        ).length,
      };

      summary.winRate =
        summary.totalBattles > 0
          ? ((summary.victories / summary.totalBattles) * 100).toFixed(1)
          : 0;

      res.json({
        success: true,
        data: {
          battles: enhancedHistory,
          summary,
        },
      });
    } catch (error) {
      logger.error("Get battle history error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get available quests
  async getAvailableQuests(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const availableQuests = [
        {
          id: "beginner_battle",
          name: "First Battle",
          difficulty: "easy",
          description: "Complete your first battle",
          reward: { coins: 100, experience: 50 },
          completed:
            user.completedQuests?.some(
              (q) => q.questId === "beginner_battle"
            ) || false,
        },
        {
          id: "hatch_3_pets",
          name: "Pet Collector",
          difficulty: "easy",
          description: "Hatch 3 pets",
          reward: { coins: 150, experience: 75 },
          progress: user.pets?.length || 0,
          target: 3,
          completed: (user.pets?.length || 0) >= 3,
        },
        {
          id: "win_5_battles",
          name: "Battle Veteran",
          difficulty: "medium",
          description: "Win 5 battles",
          reward: { coins: 250, experience: 125 },
          progress: user.battlesWon || 0,
          target: 5,
          completed: (user.battlesWon || 0) >= 5,
        },
        {
          id: "reach_level_10",
          name: "Experienced Trainer",
          difficulty: "medium",
          description: "Reach level 10",
          reward: { coins: 500, experience: 250 },
          progress: user.level || 1,
          target: 10,
          completed: (user.level || 1) >= 10,
        },
      ];

      res.json({
        success: true,
        data: {
          quests: availableQuests,
        },
      });
    } catch (error) {
      logger.error("Get available quests error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Complete a quest with proper RewardService integration
  async completeQuest(req, res) {
    try {
      const userId = req.user.id;
      const { questId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const quest = this.getQuestById(questId);
      if (!quest) {
        return res.status(404).json({
          success: false,
          message: "Quest not found",
        });
      }

      if (user.completedQuests?.some((q) => q.questId === questId)) {
        return res.status(400).json({
          success: false,
          message: "Quest already completed",
        });
      }

      if (!this.checkQuestRequirements(user, questId)) {
        return res.status(400).json({
          success: false,
          message: "Quest requirements not met",
        });
      }

      // Use RewardService for quest rewards
      const rewardResult = await rewardService.applyQuestRewards(
        userId,
        quest.difficulty,
        user.level,
        questId
      );

      if (!rewardResult.success) {
        throw new Error(`Failed to apply quest rewards: ${rewardResult.error}`);
      }

      const completedQuest = {
        questId,
        completedAt: new Date(),
        rewards: rewardResult.rewards,
      };

      await dbService.updateUser(userId, {
        $push: { completedQuests: completedQuest },
        updatedAt: new Date(),
      });

      const responseData = {
        success: true,
        message: `Quest "${quest.name}" completed successfully!`,
        data: {
          quest,
          rewards: rewardResult.rewards,
          user: {
            completedQuests: (user.completedQuests?.length || 0) + 1,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Quest completion error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during quest completion",
      });
    }
  },

  // Get quest progress
  async getQuestProgress(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const questProgress = {
        completed: user.completedQuests?.length || 0,
        inProgress: 4 - (user.completedQuests?.length || 0),
        totalAvailable: 4,
      };

      res.json({
        success: true,
        data: { progress: questProgress },
      });
    } catch (error) {
      logger.error("Get quest progress error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get daily reward status
  async getDailyRewardStatus(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const lastClaim = user.lastDailyClaim || new Date(0);
      const now = new Date();
      const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);
      const canClaim = hoursSinceLastClaim >= 20;
      const hoursRemaining = canClaim ? 0 : Math.ceil(20 - hoursSinceLastClaim);

      const status = {
        canClaim,
        hoursRemaining,
        consecutiveDays: user.consecutiveDays || 1,
        lastClaim: user.lastDailyClaim,
        nextReward: this.getNextDailyReward((user.consecutiveDays || 1) + 1),
      };

      res.json({
        success: true,
        data: { status },
      });
    } catch (error) {
      logger.error("Get daily reward status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Claim daily reward with proper RewardService integration
  async claimDailyReward(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const lastClaim = user.lastDailyClaim || new Date(0);
      const now = new Date();
      const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);

      if (hoursSinceLastClaim < 20) {
        const hoursRemaining = Math.ceil(20 - hoursSinceLastClaim);
        return res.status(400).json({
          success: false,
          message: `Please wait ${hoursRemaining} more hours to claim your next daily reward`,
        });
      }

      const consecutiveDays = user.consecutiveDays || 1;
      const isNewDay = hoursSinceLastClaim >= 24;
      const currentConsecutiveDays = isNewDay
        ? consecutiveDays + 1
        : consecutiveDays;

      // Use RewardService for daily rewards
      const rewardResult = await rewardService.applyDailyRewards(
        userId,
        currentConsecutiveDays,
        user.level
      );

      if (!rewardResult.success) {
        throw new Error(`Failed to apply daily rewards: ${rewardResult.error}`);
      }

      const updateData = {
        lastDailyClaim: now,
        consecutiveDays: isNewDay ? currentConsecutiveDays : consecutiveDays,
        updatedAt: new Date(),
      };

      await dbService.updateUser(userId, updateData);

      const responseData = {
        success: true,
        message: `Daily reward claimed! Day ${updateData.consecutiveDays} streak!`,
        data: {
          rewards: rewardResult.rewards,
          streak: {
            current: updateData.consecutiveDays,
            nextReward: this.getNextDailyReward(updateData.consecutiveDays + 1),
          },
          user: {
            consecutiveDays: updateData.consecutiveDays,
            lastDailyClaim: updateData.lastDailyClaim,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Daily reward claim error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during daily reward claim",
      });
    }
  },

  // Get user game stats
  async getUserStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await dbService.getUserStats(userId);

      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      logger.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get leaderboard
  async getLeaderboard(req, res) {
    try {
      const { type = "level", limit = 10 } = req.query;
      const leaderboard = await dbService.getLeaderboard(type, parseInt(limit));

      const formattedLeaderboard = leaderboard.map((user, index) => ({
        rank: index + 1,
        username: user.username,
        level: user.level,
        score: type === "level" ? user.level : user.experience,
        battlesWon: user.battlesWon,
      }));

      res.json({
        success: true,
        data: {
          leaderboard: formattedLeaderboard,
          type,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Get leaderboard error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Level up pet
  async levelUpPet(req, res) {
    try {
      const userId = req.user.id;
      const { petId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const pet = user.pets.find((p) => p.id.toString() === petId);
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      const levelUpResult = await this.checkPetLevelUp(pet);
      if (!levelUpResult.leveledUp) {
        return res.status(400).json({
          success: false,
          message: "Pet doesn't have enough experience to level up",
        });
      }

      await dbService.updatePet(petId, {
        level: levelUpResult.newLevel,
        experience: pet.experience - levelUpResult.expNeeded,
        stats: levelUpResult.newStats,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: `${pet.name} leveled up to level ${levelUpResult.newLevel}!`,
        data: {
          pet: {
            id: pet.id,
            name: pet.name,
            level: levelUpResult.newLevel,
            stats: levelUpResult.newStats,
          },
          levelUp: levelUpResult,
        },
      });
    } catch (error) {
      logger.error("Level up pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Evolve pet
  async evolvePet(req, res) {
    try {
      const userId = req.user.id;
      const { petId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const pet = user.pets.find((p) => p.id.toString() === petId);
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      if (pet.level < 10) {
        return res.status(400).json({
          success: false,
          message: "Pet must be at least level 10 to evolve",
        });
      }

      const evolutionResult = this.calculateEvolution(pet);
      await dbService.updatePet(petId, evolutionResult);

      res.json({
        success: true,
        message: `${pet.name} evolved into ${evolutionResult.name}!`,
        data: {
          pet: {
            id: pet.id,
            name: evolutionResult.name,
            evolutionStage: evolutionResult.evolutionStage,
            stats: evolutionResult.stats,
          },
        },
      });
    } catch (error) {
      logger.error("Evolve pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Equip pet item
  async equipPetItem(req, res) {
    try {
      // Implementation for equipping items would go here
      res.json({
        success: true,
        message: "Item equipped successfully",
        data: req.body,
      });
    } catch (error) {
      logger.error("Equip pet item error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Helper methods
  getOpponentLevel(difficulty, userLevel) {
    const multipliers = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.2,
      epic: 1.5,
    };
    return Math.max(1, Math.round(userLevel * (multipliers[difficulty] || 1)));
  },

  async checkPetLevelUp(pet) {
    const expNeeded = Math.pow(pet.level, 2) * 50;

    if (pet.experience >= expNeeded) {
      const newLevel = pet.level + 1;
      const statIncrease = Math.floor(newLevel * 1.5);

      const newStats = {
        ...pet.stats,
        dmg: pet.stats.dmg + statIncrease,
        hp: pet.stats.hp + statIncrease * 2,
      };

      return {
        leveledUp: true,
        newLevel,
        oldLevel: pet.level,
        expNeeded,
        newStats,
        statIncrease,
      };
    }

    return { leveledUp: false };
  },

  calculateEvolution(pet) {
    const evolutionStage = (pet.evolutionStage || 1) + 1;
    const newName = `Mega ${pet.name}`;

    const newStats = {
      ...pet.stats,
      dmg: Math.round(pet.stats.dmg * 1.5),
      hp: Math.round(pet.stats.hp * 1.5),
    };

    return {
      name: newName,
      evolutionStage,
      stats: newStats,
      evolutions: [...(pet.evolutions || []), newName],
      updatedAt: new Date(),
    };
  },

  getQuestById(questId) {
    const quests = {
      beginner_battle: {
        name: "First Battle",
        difficulty: "easy",
        description: "Complete your first battle",
      },
      hatch_3_pets: {
        name: "Pet Collector",
        difficulty: "easy",
        description: "Hatch 3 pets",
      },
      win_5_battles: {
        name: "Battle Veteran",
        difficulty: "medium",
        description: "Win 5 battles",
      },
      reach_level_10: {
        name: "Experienced Trainer",
        difficulty: "medium",
        description: "Reach level 10",
      },
    };
    return quests[questId];
  },

  checkQuestRequirements(user, questId) {
    switch (questId) {
      case "beginner_battle":
        return (user.battlesWon || 0) + (user.battlesLost || 0) > 0;
      case "hatch_3_pets":
        return (user.pets?.length || 0) >= 3;
      case "win_5_battles":
        return (user.battlesWon || 0) >= 5;
      case "reach_level_10":
        return (user.level || 1) >= 10;
      default:
        return false;
    }
  },

  getNextDailyReward(nextDay) {
    return {
      coins: Math.floor((50 + nextDay * 2) * (1 + nextDay * 0.1)),
      experience: Math.floor((25 + nextDay * 2) * (1 + nextDay * 0.1)),
      freeRolls: nextDay >= 7 ? 1 : 0,
    };
  },

  formatHatchResult(result) {
    if (result.type === "Pet") {
      return {
        type: "Pet",
        data: {
          id: result._id,
          name: result.name,
          type: result.type,
          rarity: result.rarity,
          stats: result.stats,
          level: result.level,
          isShiny: result.isShiny,
        },
      };
    } else if (result.type === "Technique") {
      return {
        type: "Technique",
        data: {
          id: result._id,
          name: result.name,
          rarity: result.rarity,
          effect: result.effect,
        },
      };
    } else if (result.type === "Cosmetic") {
      return {
        type: "Cosmetic",
        data: {
          id: result._id,
          name: result.name,
          rarity: result.rarity,
        },
      };
    }
    return result;
  },
};

export default GameController;
