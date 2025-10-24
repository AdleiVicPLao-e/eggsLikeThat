import express from "express";
import { AuthController } from "../controllers/AuthController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/wallet/register", AuthController.walletRegister);
router.post("/wallet/login", AuthController.walletLogin);
router.post("/guest", AuthController.guestLogin);
router.post("/nonce", AuthController.getNonce); // New nonce endpoint

// Protected routes
router.get("/profile", authMiddleware, AuthController.getProfile);
router.put("/profile", authMiddleware, AuthController.updateProfile);
router.post("/wallet/connect", authMiddleware, AuthController.connectWallet);
router.post("/refresh", authMiddleware, AuthController.refreshToken);

export default router;
