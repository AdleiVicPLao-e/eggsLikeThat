import express from "express";
import { TradeController } from "../controllers/TradeController.js";
import { validate } from "../utils/validators.js";
import { tradeCreationSchema } from "../utils/validators.js";
import { authenticate, requireWallet } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public routes (viewing marketplace)
router.get("/listings", TradeController.getListings);
router.get("/stats", TradeController.getMarketplaceStats);

// Protected routes
router.use(authenticate);

// User's listings and history
router.get("/my-listings", TradeController.getUserListings);
router.get("/history", TradeController.getTradeHistory);
router.get("/offers", TradeController.getUserOffers);

// Trading actions (require wallet)
router.post(
  "/list",
  requireWallet,
  gameActionLimiter,
  validate(tradeCreationSchema),
  TradeController.listPet
);

router.delete(
  "/list/:tradeId",
  requireWallet,
  gameActionLimiter,
  TradeController.cancelListing
);

router.post(
  "/purchase/:tradeId",
  requireWallet,
  gameActionLimiter,
  TradeController.purchasePet
);

router.post(
  "/offer",
  requireWallet,
  gameActionLimiter,
  TradeController.makeOffer
);

export default router;
