// src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { config } from "../config/env.js";
import logger from "../utils/logger.js";

export const authMiddleware = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);

    // Get user from database using the custom User class
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if guest token expired (guest tokens have 24h expiry)
    if (user.isGuest) {
      const tokenExpiry = decoded.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();

      if (tokenExpiry < currentTime) {
        return res.status(401).json({
          success: false,
          message:
            "Guest session expired. Please create a new guest account or register.",
        });
      }
    }

    // Add user to request object
    req.user = user;
    req.isGuest = user.isGuest || false;

    next();
  } catch (error) {
    logger.error("Auth middleware error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please log in again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token format.",
      });
    }

    if (error.name === "NotBeforeError") {
      return res.status(401).json({
        success: false,
        message: "Token not yet active.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication server error",
    });
  }
};

// Enhanced middleware for non-guest routes only
export const requireFullAccount = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (req.user.isGuest) {
      return res.status(403).json({
        success: false,
        message:
          "Full account required for this action. Please register or connect a wallet.",
        actionRequired: "upgrade_account",
      });
    }

    next();
  } catch (error) {
    logger.error("Require full account middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during account verification",
    });
  }
};

// Enhanced middleware for wallet-connected accounts only
export const requireWallet = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!req.user.walletAddress) {
      return res.status(403).json({
        success: false,
        message: "Wallet connection required for this action",
        actionRequired: "connect_wallet",
      });
    }

    // Additional check to ensure wallet is properly connected
    if (req.user.walletAddress.startsWith("guest_")) {
      return res.status(403).json({
        success: false,
        message:
          "Real wallet connection required. Guest wallets cannot perform this action.",
        actionRequired: "connect_real_wallet",
      });
    }

    next();
  } catch (error) {
    logger.error("Require wallet middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during wallet verification",
    });
  }
};

// Middleware for admin users only
export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check if user has admin role (you might want to add this to your User model)
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin privileges required",
      });
    }

    next();
  } catch (error) {
    logger.error("Require admin middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during admin verification",
    });
  }
};

// Optional: Middleware to check if user owns a specific resource
export const requireResourceOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      const resourceId = req.params.id || req.body.id;

      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: "Resource ID required",
        });
      }

      // This is a simplified example - you'd implement specific ownership checks
      // based on your resource types (pets, eggs, etc.)
      let isOwner = false;

      switch (resourceType) {
        case "pet":
          // Check if user owns this pet
          const userPets = req.user.pets || [];
          isOwner = userPets.some(
            (pet) => (pet._id || pet.id).toString() === resourceId
          );
          break;

        case "egg":
          // Check if user owns this egg
          const userEggs = req.user.eggs || [];
          isOwner = userEggs.some(
            (egg) => (egg._id || egg.id).toString() === resourceId
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid resource type",
          });
      }

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: `You do not own this ${resourceType}`,
        });
      }

      next();
    } catch (error) {
      logger.error("Resource ownership middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error during ownership verification",
      });
    }
  };
};
