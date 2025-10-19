import { User } from "../models/User.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

// Helper functions
const generateToken = (payload, expiresIn = "7d") => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn });
};

const generateNonce = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const verifyWalletSignature = (walletAddress, message, signature) => {
  // In a real implementation, you would verify the signature
  // using ethers.js or web3.js
  // For now, we'll return true for demo purposes
  return true;
};

export const AuthController = {
  // Traditional email/password login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Verify password
      const isPasswordValid = await user.verifyPassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        email: user.email,
      });

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      logger.info(`User logged in via email: ${user.email}`);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            walletAddress: user.walletAddress,
            level: user.level,
            coins: user.balance,
            freeRolls: user.freeRolls || 0,
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

  // Traditional email/password registration
  async walletRegister(req, res) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Username, email, and password are required",
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() },
        ],
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message:
            existingUser.email === email.toLowerCase()
              ? "Email already registered"
              : "Username already taken",
        });
      }

      // Create new user with wallet
      const user = await User.createWithWallet(username, email, password);
      await user.save();

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        email: user.email,
      });

      // Send welcome email
      if (email) {
        await mailService.sendWelcomeEmail(user);
      }

      logger.info(`New user registered with wallet: ${username} (${email})`);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            walletAddress: user.walletAddress,
            level: user.level,
            coins: user.balance,
            freeRolls: user.freeRolls || 0,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Wallet registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during registration",
      });
    }
  },

  // Connect existing wallet to user account
  async connectWallet(req, res) {
    try {
      const { walletAddress, signature } = req.body;
      const user = req.user;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Wallet address is required",
        });
      }

      // Check if wallet is already connected to another account
      const existingUser = await User.findOne({
        walletAddress: walletAddress.toLowerCase(),
      });

      if (existingUser && existingUser._id.toString() !== user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "Wallet address already connected to another account",
        });
      }

      // Verify signature if provided
      if (signature) {
        const message = `Connect wallet to PetVerse - Nonce: ${generateNonce()}`;
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

      // Update user's wallet address
      user.walletAddress = walletAddress.toLowerCase();
      await user.save();

      logger.info(
        `Wallet connected for user: ${user.username} (${walletAddress})`
      );

      res.json({
        success: true,
        message: "Wallet connected successfully",
        data: {
          user: {
            id: user._id,
            username: user.username,
            walletAddress: user.walletAddress,
          },
        },
      });
    } catch (error) {
      logger.error("Connect wallet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during wallet connection",
      });
    }
  },

  // Register new user (wallet-based) - existing method
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
        balance: 1000,
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
            coins: user.balance,
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

  // Wallet login - existing method
  async walletLogin(req, res) {
    try {
      const { walletAddress, signature } = req.body;

      // Find user by wallet address
      const user = await User.findOne({
        walletAddress: walletAddress.toLowerCase(),
      });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Wallet not registered. Please sign up first.",
        });
      }

      // In a real implementation, verify the signature against a nonce
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

      // Update last login
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
            coins: user.balance,
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

  // Guest login - existing method (updated for consistency)
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
        balance: 500, // Less coins for guest users
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
            coins: user.balance,
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

  // Get user profile - existing method (updated for consistency)
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id)
        .select("-__v -passwordHash")
        .populate("pets", "name tier type level stats")
        .populate("eggs", "eggType rarity isHatched");

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
            coins: user.balance,
            freeRolls: user.freeRolls,
            battlesWon: user.battlesWon,
            battlesLost: user.battlesLost,
            petsHatched: user.petsHatched,
            totalBattles: user.totalBattles,
            winRate: user.winRate,
            pets: user.pets,
            eggs: user.eggs,
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

  // Update user profile - existing method
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

  // Refresh token - existing method
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
