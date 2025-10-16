import express from "express";
import { AuthController } from "../controllers/AuthController.js";
import { validate } from "../utils/validators.js";
import {
  userRegistrationSchema,
  userLoginSchema,
} from "../utils/validators.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { authenticate, optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post(
  "/register",
  authLimiter,
  validate(userRegistrationSchema),
  AuthController.register
);

router.post(
  "/login",
  authLimiter,
  validate(userLoginSchema),
  AuthController.walletLogin
);

router.post("/guest", authLimiter, AuthController.guestLogin);

// Protected routes
router.get("/profile", authenticate, AuthController.getProfile);

router.put("/profile", authenticate, AuthController.updateProfile);

router.post("/refresh", optionalAuth, AuthController.refreshToken);

export default router;
