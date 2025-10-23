// routes/game.route.js
import express from "express";
import { GameController } from "../controllers/GameController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ===== EGG MANAGEMENT =====
router.post("/eggs/hatch", gameActionLimiter, GameController.hatchEgg);

// ===== BATTLE SYSTEM =====
router.post("/battles/start", gameActionLimiter, GameController.startBattle);
router.get("/battles/history", GameController.getBattleHistory);
router.get("/battles/available-pets", GameController.getAvailableBattlePets);

// ===== QUEST SYSTEM =====
router.get("/quests/available", GameController.getAvailableQuests);
router.post(
  "/quests/complete",
  gameActionLimiter,
  GameController.completeQuest
);
router.get("/quests/progress", GameController.getQuestProgress);

// ===== DAILY REWARDS =====
router.get("/rewards/daily/status", GameController.getDailyRewardStatus);
router.post(
  "/rewards/daily/claim",
  gameActionLimiter,
  GameController.claimDailyReward
);

// ===== USER PROGRESSION =====
router.get("/user/stats", GameController.getUserStats);
router.get("/leaderboard", GameController.getLeaderboard);

// ===== PET MANAGEMENT =====
router.post("/pets/level-up", gameActionLimiter, GameController.levelUpPet);
router.post("/pets/evolve", gameActionLimiter, GameController.evolvePet);
router.post("/pets/equip-item", gameActionLimiter, GameController.equipPetItem);

export default router;
