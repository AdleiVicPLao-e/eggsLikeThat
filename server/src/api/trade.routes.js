// routes/trade.route.js
import express from "express";
import { TradeController } from "../controllers/TradeController.js";
import { validate } from "../utils/validators.js";
import {
  tradeCreationSchema,
  offerCreationSchema,
  counterOfferSchema,
  itemListingSchema,
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

// Trading actions
router.post(
  "/list",
  gameActionLimiter,
  validate(tradeCreationSchema),
  TradeController.listPet
);

router.post(
  "/list-item",
  gameActionLimiter,
  validate(itemListingSchema),
  TradeController.listItem
);

router.delete(
  "/list/:tradeId",
  gameActionLimiter,
  TradeController.cancelListing
);

router.post(
  "/purchase/:tradeId",
  gameActionLimiter,
  TradeController.purchasePet
);

router.post(
  "/purchase-item/:tradeId",
  gameActionLimiter,
  TradeController.purchaseItem
);

// Offer actions
router.post(
  "/offer",
  gameActionLimiter,
  validate(offerCreationSchema),
  TradeController.makeOffer
);

router.post(
  "/offer/:offerId/accept",
  gameActionLimiter,
  TradeController.acceptOffer
);

router.post(
  "/offer/:offerId/reject",
  gameActionLimiter,
  TradeController.rejectOffer
);

router.post(
  "/offer/:offerId/counter",
  gameActionLimiter,
  validate(counterOfferSchema),
  TradeController.counterOffer
);

router.delete(
  "/offer/:offerId",
  gameActionLimiter,
  TradeController.cancelOffer
);

// Blockchain integration routes
router.get("/nfts", TradeController.getUserNFTs);
router.post("/sync-blockchain", TradeController.syncBlockchainListings);
router.get(
  "/verify-ownership/:tokenId/:nftContract",
  TradeController.verifyOwnership
);

export default router;
