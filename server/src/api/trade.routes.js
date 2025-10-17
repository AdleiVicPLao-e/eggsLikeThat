// routes/trade.route.js
import express from "express";
import { TradeController } from "../controllers/TradeController.js";
import { validate } from "../utils/validators.js";
import {
  tradeCreationSchema,
  offerCreationSchema,
  counterOfferSchema,
} from "../utils/validators.js";
import { authenticate, requireWallet } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public routes (viewing marketplace)
router.get("/listings", TradeController.getListings);
router.get("/stats", TradeController.getMarketplaceStats);

// Protected routes
router.use(authenticate);

// User's listings, history, and transactions
router.get("/my-listings", TradeController.getUserListings);
router.get("/history", TradeController.getTradeHistory);
router.get("/transactions", TradeController.getTransactionHistory);

// Offer management
router.get("/offers", TradeController.getUserOffers);
router.get(
  "/offers/:offerId/negotiation",
  TradeController.getNegotiationHistory
);

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

// Offer actions (require wallet)
router.post(
  "/offer",
  requireWallet,
  gameActionLimiter,
  validate(offerCreationSchema),
  TradeController.makeOffer
);

router.post(
  "/offer/:offerId/accept",
  requireWallet,
  gameActionLimiter,
  TradeController.acceptOffer
);

router.post(
  "/offer/:offerId/reject",
  requireWallet,
  gameActionLimiter,
  TradeController.rejectOffer
);

router.post(
  "/offer/:offerId/counter",
  requireWallet,
  gameActionLimiter,
  validate(counterOfferSchema),
  TradeController.counterOffer
);

router.delete(
  "/offer/:offerId",
  requireWallet,
  gameActionLimiter,
  TradeController.cancelOffer
);

// Additional trade routes
router.get("/analytics/overview", TradeController.getTradeAnalytics);
router.get("/search", TradeController.searchListings);
router.get("/categories", TradeController.getTradeCategories);

export default router;
