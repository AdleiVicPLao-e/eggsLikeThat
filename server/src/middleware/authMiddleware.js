import { verifyToken } from "../utils/cryptoUtils.js";
import User from "../models/User.js";
import logger from "../utils/logger.js";

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select("-__v");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select("-__v");
      req.user = user;
    }

    next();
  } catch (error) {
    // Continue without authentication for optional routes
    next();
  }
};

export const requireWallet = (req, res, next) => {
  if (!req.user?.walletAddress) {
    return res.status(403).json({
      success: false,
      message: "Wallet connection required for this action",
    });
  }
  next();
};
