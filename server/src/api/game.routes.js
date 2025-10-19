// routes/game.route.js
import express from "express";
import { GameController } from "../controllers/GameController.js";
import { authMiddleware } from "../middleware/authMiddleware.js"; // Changed from 'authenticate' to 'authMiddleware'
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware); // Changed from 'authenticate' to 'authMiddleware'

// Egg hatching
router.post("/hatch", gameActionLimiter, GameController.hatchEgg);

// Battles
router.post("/battle/start", gameActionLimiter, GameController.startBattle);
router.get("/battle/history", GameController.getBattleHistory);

// Quests
router.get("/quests", GameController.getAvailableQuests);
router.post(
  "/quests/complete",
  gameActionLimiter,
  GameController.completeQuest
);
router.get("/quests/progress", GameController.getQuestProgress);

// Daily rewards
router.get("/daily-reward/status", GameController.getDailyRewardStatus);
router.post(
  "/daily-reward",
  gameActionLimiter,
  GameController.claimDailyReward
);

// User stats and progression
router.get("/stats", GameController.getUserStats);
router.get("/leaderboard", GameController.getLeaderboard);

// Pet management
router.post("/pets/level-up", gameActionLimiter, GameController.levelUpPet);
router.post("/pets/evolve", gameActionLimiter, GameController.evolvePet);
router.post("/pets/equip", gameActionLimiter, GameController.equipPetItem);

export default router;
