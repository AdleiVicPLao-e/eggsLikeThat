import express from "express";
import { GameController } from "../controllers/GameController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Egg hatching
router.post("/hatch", gameActionLimiter, GameController.hatchEgg);

// Battles
router.post("/battle/start", gameActionLimiter, GameController.startBattle);

// Quests
router.post(
  "/quests/complete",
  gameActionLimiter,
  GameController.completeQuest
);

// Daily rewards
router.post(
  "/daily-reward",
  gameActionLimiter,
  GameController.claimDailyReward
);

export default router;
