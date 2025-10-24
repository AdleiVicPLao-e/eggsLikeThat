// routes/egg.route.js
import express from "express";
import { EggController } from "../controllers/EggController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ===== EGG COLLECTION MANAGEMENT =====
router.get("/", EggController.getUserEggs);
router.get("/:eggId", EggController.getEggDetails);

// ===== EGG ACQUISITION =====
router.post("/purchase", gameActionLimiter, EggController.purchaseEgg);
router.post("/free", gameActionLimiter, EggController.getFreeEgg);

// ===== EGG HATCHING & INTERACTION =====
router.post("/:eggId/hatch", gameActionLimiter, EggController.hatchEgg);
router.get("/:eggId/preview", gameActionLimiter, EggController.previewEgg);
router.patch(
  "/:eggId/cosmetic",
  gameActionLimiter,
  EggController.applyCosmetic
);

// ===== EGG CATALOG & INFORMATION =====
router.get("/catalog/catalog", EggController.getEggCatalog);

// ===== BLOCKCHAIN INTEGRATION =====
router.post(
  "/blockchain/sync",
  gameActionLimiter,
  EggController.syncBlockchainEggs
);

export default router;
