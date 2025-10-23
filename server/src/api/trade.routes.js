// routes/trade.route.js
import express from "express";
import { TradeController } from "../controllers/TradeController.js";
import { validate } from "../utils/validators.js";
import {
  tradeCreationSchema,
  offerCreationSchema,
  counterOfferSchema,
} from "../utils/validators.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { gameActionLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Public routes (viewing marketplace)
router.get("/listings", TradeController.getListings);
router.get("/stats", TradeController.getMarketplaceStats);

// Protected routes
router.use(authMiddleware);

// User's listings, history, and transactions
router.get("/my-listings", TradeController.getUserListings);
router.get("/history", TradeController.getTradeHistory);
router.get("/transactions", TradeController.getTransactionHistory);

// Offer management
router.get("/offers", TradeController.getUserOffers);

// Trading actions (require wallet)
router.post(
  "/list",
  authMiddleware,
  gameActionLimiter,
  validate(tradeCreationSchema),
  TradeController.listPet
);

router.delete(
  "/list/:tradeId",
  authMiddleware,
  gameActionLimiter,
  TradeController.cancelListing
);

router.post(
  "/purchase/:tradeId",
  authMiddleware,
  gameActionLimiter,
  TradeController.purchasePet
);

// Offer actions (require wallet)
router.post(
  "/offer",
  authMiddleware,
  gameActionLimiter,
  validate(offerCreationSchema),
  TradeController.makeOffer
);

router.post(
  "/offer/:offerId/accept",
  authMiddleware,
  gameActionLimiter,
  TradeController.acceptOffer
);

router.post(
  "/offer/:offerId/reject",
  authMiddleware,
  gameActionLimiter,
  TradeController.rejectOffer
);

router.post(
  "/offer/:offerId/counter",
  authMiddleware,
  gameActionLimiter,
  validate(counterOfferSchema),
  TradeController.counterOffer
);

router.delete(
  "/offer/:offerId",
  authMiddleware,
  gameActionLimiter,
  TradeController.cancelOffer
);

export default router;
