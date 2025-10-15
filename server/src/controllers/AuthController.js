import User from "../models/User.js";
import {
  generateToken,
  verifyWalletSignature,
  generateNonce,
} from "../utils/cryptoUtils.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";

export const AuthController = {
  // Register new user (wallet-based)
  async register(req, res) {
    try {
      const { walletAddress, username, email } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ walletAddress: walletAddress.toLowerCase() }, { username }],
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message:
            existingUser.walletAddress === walletAddress.toLowerCase()
              ? "Wallet already registered"
              : "Username already taken",
        });
      }

      // Create new user
      const user = new User({
        walletAddress: walletAddress.toLowerCase(),
        username,
        email,
        // Free starting resources
        coins: 1000,
        freeRolls: 3,
      });

      await user.save();

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        walletAddress: user.walletAddress,
      });

      // Send welcome email if provided
      if (email) {
        await mailService.sendWelcomeEmail(user);
      }

      logger.info(`New user registered: ${username} (${walletAddress})`);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user._id,
            username: user.username,
            walletAddress: user.walletAddress,
            level: user.level,
            coins: user.coins,
            freeRolls: user.freeRolls,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during registration",
      });
    }
  },

  // Wallet login
  async walletLogin(req, res) {
    try {
      const { walletAddress, signature } = req.body;

      // Find user by wallet address
      const user = await User.findByWallet(walletAddress);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Wallet not registered. Please sign up first.",
        });
      }

      // In a real implementation, verify the signature against a nonce
      // For now, we'll trust the wallet connection
      if (signature) {
        const message = `Login to PetVerse - Nonce: ${generateNonce()}`;
        const isValid = verifyWalletSignature(
          walletAddress,
          message,
          signature
        );

        if (!isValid) {
          return res.status(401).json({
            success: false,
            message: "Invalid signature",
          });
        }
      }

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        walletAddress: user.walletAddress,
      });

      // Update last login (you might want to add this field to User model)
      user.lastLogin = new Date();
      await user.save();

      logger.info(`User logged in: ${user.username} (${walletAddress})`);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            username: user.username,
            walletAddress: user.walletAddress,
            level: user.level,
            coins: user.coins,
            freeRolls: user.freeRolls,
            experience: user.experience,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during login",
      });
    }
  },

  // Guest login (no wallet required)
  async guestLogin(req, res) {
    try {
      const { username } = req.body;

      // Generate a temporary wallet address for guest users
      const tempWallet = `guest_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Check if username is available
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }

      // Create guest user
      const user = new User({
        walletAddress: tempWallet,
        username,
        isGuest: true,
        coins: 500, // Less coins for guest users
        freeRolls: 1,
      });

      await user.save();

      // Generate JWT token (shorter expiry for guest users)
      const token = generateToken(
        {
          userId: user._id,
          walletAddress: user.walletAddress,
          isGuest: true,
        },
        "24h"
      ); // 24 hour expiry for guests

      logger.info(`Guest user created: ${username}`);

      res.status(201).json({
        success: true,
        message: "Guest session started",
        data: {
          user: {
            id: user._id,
            username: user.username,
            isGuest: true,
            level: user.level,
            coins: user.coins,
            freeRolls: user.freeRolls,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Guest login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during guest login",
      });
    }
  },

  // Get user profile
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select("-__v")
        .populate("ownedPets", "name tier type level stats")
        .populate("ownedEggs", "eggType rarity isHatched");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            walletAddress: user.walletAddress,
            email: user.email,
            level: user.level,
            experience: user.experience,
            coins: user.coins,
            freeRolls: user.freeRolls,
            battlesWon: user.battlesWon,
            battlesLost: user.battlesLost,
            petsHatched: user.petsHatched,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
            ownedPets: user.ownedPets,
            ownedEggs: user.ownedEggs,
            preferences: user.preferences,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      logger.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { username, email, preferences } = req.body;
      const user = req.user;

      // Check if username is available (if changing)
      if (username && username !== user.username) {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Username already taken",
          });
        }
        user.username = username;
      }

      // Update email if provided
      if (email !== undefined) {
        user.email = email;
      }

      // Update preferences if provided
      if (preferences) {
        user.preferences = { ...user.preferences, ...preferences };
      }

      await user.save();

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            preferences: user.preferences,
          },
        },
      });
    } catch (error) {
      logger.error("Update profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Refresh token
  async refreshToken(req, res) {
    try {
      const user = req.user;

      // Generate new token
      const token = generateToken(
        {
          userId: user._id,
          walletAddress: user.walletAddress,
          isGuest: user.isGuest,
        },
        user.isGuest ? "24h" : undefined
      );

      res.json({
        success: true,
        data: { token },
      });
    } catch (error) {
      logger.error("Refresh token error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};
