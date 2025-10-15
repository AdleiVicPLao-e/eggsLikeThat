import express from "express";
import { PetController } from "../controllers/PetController.js";
import { validate } from "../utils/validators.js";
import { petUpgradeSchema } from "../utils/validators.js";
import { authenticate } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get user's pets
router.get("/", PetController.getUserPets);

// Get specific pet
router.get("/:petId", PetController.getPetDetails);

// Upgrade pet
router.post("/:petId/upgrade", gameActionLimiter, PetController.upgradePet);

// Fuse pets
router.post(
  "/fuse",
  gameActionLimiter,
  validate(petUpgradeSchema),
  PetController.fusePets
);

// Toggle favorite
router.patch(
  "/:petId/favorite",
  gameActionLimiter,
  PetController.toggleFavorite
);

export default router;
