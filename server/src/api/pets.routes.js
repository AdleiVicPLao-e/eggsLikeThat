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

// Get user's pets
router.get("/", PetController.getUserPets);

// Get specific pet
router.get("/:petId", PetController.getPetDetails);

// Upgrade pet
router.post("/:petId/upgrade", gameActionLimiter, PetController.upgradePet);

// // Train pet
// router.post(
//   "/:petId/train",
//   gameActionLimiter,
//   validate(petTrainSchema),
//   PetController.trainPet
// );

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

// Get fusion calculator
router.get("/fusion/calculator", PetController.getFusionCalculator);

// // Get pet statistics
// router.get("/stats/overview", PetController.getPetStats);

export default router;
