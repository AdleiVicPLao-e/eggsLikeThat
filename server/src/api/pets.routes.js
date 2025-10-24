// routes/pet.route.js
import express from "express";
import { PetController } from "../controllers/PetController.js";
import { validate } from "../utils/validators.js";
import { petUpgradeSchema } from "../utils/validators.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ===== PET COLLECTION MANAGEMENT =====
router.get("/", PetController.getUserPets);
router.get("/:petId", PetController.getPetDetails);

// ===== PET UPGRADES & TRAINING =====
router.post("/:petId/upgrade", gameActionLimiter, PetController.upgradePet);
router.post("/:petId/train", gameActionLimiter, PetController.trainPet);

// ===== PET FUSION SYSTEM =====
router.post("/fuse", gameActionLimiter, PetController.fusePets);
router.get("/fusion/calculator", PetController.getFusionCalculator);

// ===== FAVORITES MANAGEMENT =====
router.patch(
  "/:petId/favorite",
  gameActionLimiter,
  PetController.toggleFavorite
);

// ===== BLOCKCHAIN INTEGRATION =====
router.post(
  "/blockchain/sync",
  gameActionLimiter,
  PetController.syncBlockchainPets
);
router.get("/:petId/blockchain", PetController.getPetBlockchainInfo);

export default router;
