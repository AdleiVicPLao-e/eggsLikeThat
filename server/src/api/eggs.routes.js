// routes/egg.route.js
import express from "express";
import { EggController } from "../controllers/EggController.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get user's eggs
router.get("/", EggController.getUserEggs);

// Get egg details
router.get("/:eggId", EggController.getEggDetails);

// Purchase egg
router.post("/purchase", gameActionLimiter, EggController.purchaseEgg);

// Get free daily egg
router.post("/free", gameActionLimiter, EggController.getFreeEgg);

// Hatch egg
router.post("/:eggId/hatch", gameActionLimiter, EggController.hatchEgg);

// Preview egg contents
router.get("/:eggId/preview", gameActionLimiter, EggController.previewEgg);

// Apply cosmetic
router.patch(
  "/:eggId/cosmetic",
  gameActionLimiter,
  EggController.applyCosmetic
);

// Get egg catalog
router.get("/catalog/catalog", EggController.getEggCatalog);

export default router;
