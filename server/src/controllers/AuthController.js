// src/controllers/AuthController.js
import { DatabaseService } from "../services/DatabaseService.js";
import { blockchainService } from "../config/blockchain.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { ethers } from "ethers";

// Helper functions
const generateToken = (payload, expiresIn = "7d") => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn });
};

const generateNonce = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Real wallet signature verification using ethers.js
const verifyWalletSignature = async (walletAddress, message, signature) => {
  try {
    // Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    // Check if the recovered address matches the claimed wallet address
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    logger.error("Signature verification error:", error);
    return false;
  }
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

      const dbService = new DatabaseService();

      // Find user by email
      const user = await dbService.findUserByEmail(email.toLowerCase());
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
        userId: user._id || user.id,
        email: user.email,
      });

      // Update last login
      await user.updateLastLogin();

      logger.info(`User logged in via email: ${user.email}`);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id || user.id,
            username: user.username,
            email: user.email,
            walletAddress: user.walletAddress,
            level: user.level,
            coins: user.balance,
            freeRolls: user.freeRolls || 0,
            experience: user.experience,
            isGuest: user.isGuest,
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

      const dbService = new DatabaseService();

      // Check if user already exists
      const existingUserByEmail = await dbService.findUserByEmail(
        email.toLowerCase()
      );
      const existingUserByUsername = await dbService.findUserByUsername(
        username.toLowerCase()
      );

      if (existingUserByEmail) {
        return res.status(400).json({
          success: false,
          message: "Email already registered",
        });
      }

      if (existingUserByUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }

      // Create new user with wallet
      const user = await dbService.createUser({
        username,
        email: email.toLowerCase(),
        passwordHash: await dbService.hashPassword(password),
        balance: 1000,
        freeRolls: 3,
      });

      // Generate JWT token
      const token = generateToken({
        userId: user._id || user.id,
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
            id: user._id || user.id,
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
      const { walletAddress, signature, message } = req.body;
      const dbService = new DatabaseService();

      if (!walletAddress || !signature) {
        return res.status(400).json({
          success: false,
          message: "Wallet address and signature are required",
        });
      }

      // Get user from request (assuming middleware sets req.user)
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User authentication required",
        });
      }

      // Check if wallet is already connected to another account
      const existingUser = await dbService.findUserByWallet(
        walletAddress.toLowerCase()
      );
      if (
        existingUser &&
        (existingUser._id || existingUser.id).toString() !==
          (user._id || user.id).toString()
      ) {
        return res.status(400).json({
          success: false,
          message: "Wallet address already connected to another account",
        });
      }

      // Verify signature
      const verificationMessage =
        message ||
        `Connect wallet to PetVerse - User ID: ${
          user._id || user.id
        } - Nonce: ${generateNonce()}`;
      const isValid = await verifyWalletSignature(
        walletAddress,
        verificationMessage,
        signature
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid signature",
        });
      }

      // Update user's wallet address
      await dbService.connectWallet(user._id || user.id, walletAddress);

      // Sync blockchain assets
      await this.syncBlockchainAssets(walletAddress, user._id || user.id);

      logger.info(
        `Wallet connected for user: ${user.username} (${walletAddress})`
      );

      res.json({
        success: true,
        message: "Wallet connected successfully",
        data: {
          user: {
            id: user._id || user.id,
            username: user.username,
            walletAddress: walletAddress.toLowerCase(),
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

  // Register new user (wallet-based)
  async register(req, res) {
    try {
      const { walletAddress, username, email, signature, message } = req.body;

      if (!walletAddress || !username) {
        return res.status(400).json({
          success: false,
          message: "Wallet address and username are required",
        });
      }

      const dbService = new DatabaseService();

      // Check if user already exists
      const existingUserByWallet = await dbService.findUserByWallet(
        walletAddress.toLowerCase()
      );
      const existingUserByUsername = await dbService.findUserByUsername(
        username
      );

      if (existingUserByWallet) {
        return res.status(400).json({
          success: false,
          message: "Wallet already registered",
        });
      }

      if (existingUserByUsername) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }

      // Verify signature if provided
      if (signature) {
        const verificationMessage =
          message ||
          `Register to PetVerse - Username: ${username} - Nonce: ${generateNonce()}`;
        const isValid = await verifyWalletSignature(
          walletAddress,
          verificationMessage,
          signature
        );

        if (!isValid) {
          return res.status(401).json({
            success: false,
            message: "Invalid signature",
          });
        }
      }

      // Create new user
      const user = await dbService.createUser({
        walletAddress: walletAddress.toLowerCase(),
        username,
        email: email?.toLowerCase(),
        // Free starting resources
        balance: 1000,
        freeRolls: 3,
      });

      // Sync blockchain assets
      await this.syncBlockchainAssets(walletAddress, user._id || user.id);

      // Generate JWT token
      const token = generateToken({
        userId: user._id || user.id,
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
            id: user._id || user.id,
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

  // Wallet login
  async walletLogin(req, res) {
    try {
      const { walletAddress, signature, message } = req.body;

      if (!walletAddress || !signature) {
        return res.status(400).json({
          success: false,
          message: "Wallet address and signature are required",
        });
      }

      const dbService = new DatabaseService();

      // Find user by wallet address
      const user = await dbService.findUserByWallet(
        walletAddress.toLowerCase()
      );
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Wallet not registered. Please sign up first.",
        });
      }

      // Verify signature
      const verificationMessage =
        message || `Login to PetVerse - Nonce: ${generateNonce()}`;
      const isValid = await verifyWalletSignature(
        walletAddress,
        verificationMessage,
        signature
      );

      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid signature",
        });
      }

      // Sync blockchain assets
      await this.syncBlockchainAssets(walletAddress, user._id || user.id);

      // Generate JWT token
      const token = generateToken({
        userId: user._id || user.id,
        walletAddress: user.walletAddress,
      });

      // Update last login
      await user.updateLastLogin();

      logger.info(`User logged in: ${user.username} (${walletAddress})`);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id || user.id,
            username: user.username,
            walletAddress: user.walletAddress,
            level: user.level,
            coins: user.balance,
            freeRolls: user.freeRolls,
            experience: user.experience,
            isGuest: user.isGuest,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Wallet login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during login",
      });
    }
  },

  // Guest login
  async guestLogin(req, res) {
    try {
      const { username } = req.body;

      if (!username || username.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Username is required",
        });
      }

      const cleanUsername = username.trim();
      const dbService = new DatabaseService();

      // Check if username is available
      const existingUser = await dbService.findUserByUsername(cleanUsername);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Username already taken",
        });
      }

      // Generate a temporary wallet address for guest users
      const tempWallet = `guest_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Create guest user
      const user = await dbService.createUser({
        walletAddress: tempWallet,
        username: cleanUsername,
        isGuest: true,
        balance: 500, // Less coins for guest users
        freeRolls: 1,
      });

      // Generate JWT token (shorter expiry for guest users)
      const token = generateToken(
        {
          userId: user._id || user.id,
          walletAddress: user.walletAddress,
          isGuest: true,
        },
        "24h"
      ); // 24 hour expiry for guests

      logger.info(`Guest user created: ${cleanUsername}`);

      res.status(201).json({
        success: true,
        message: "Guest session started",
        data: {
          user: {
            id: user._id || user.id,
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

  // Get user profile
  async getProfile(req, res) {
    try {
      const dbService = new DatabaseService();
      const user = await dbService.findUserById(req.user._id || req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Get user stats
      const stats = await dbService.getUserStats(user._id || user.id);

      res.json({
        success: true,
        data: {
          user: {
            id: user._id || user.id,
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
            techniques: user.techniques,
            skins: user.skins,
            isGuest: user.isGuest,
            createdAt: user.createdAt,
          },
          stats,
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
      const { username, email } = req.body;
      const dbService = new DatabaseService();

      const user = await dbService.findUserById(req.user._id || req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if username is available (if changing)
      if (username && username !== user.username) {
        const existingUser = await dbService.findUserByUsername(username);
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "Username already taken",
          });
        }
      }

      // Update user
      const updateData = {};
      if (username) updateData.username = username;
      if (email !== undefined) updateData.email = email;

      const updatedUser = await dbService.updateUser(
        user._id || user.id,
        updateData
      );

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: {
          user: {
            id: updatedUser._id || updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
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
          userId: user._id || user.id,
          walletAddress: user.walletAddress,
          isGuest: user.isGuest,
        },
        user.isGuest ? "24h" : "7d"
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

  // Get nonce for wallet authentication
  async getNonce(req, res) {
    try {
      const { walletAddress } = req.body;

      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Wallet address is required",
        });
      }

      const nonce = generateNonce();
      const message = `Sign this message to authenticate with PetVerse. Nonce: ${nonce}`;

      // In a real implementation, you might want to store this nonce temporarily
      // to prevent replay attacks

      res.json({
        success: true,
        data: {
          nonce,
          message,
          walletAddress,
        },
      });
    } catch (error) {
      logger.error("Get nonce error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Helper method to sync blockchain assets with user account
  async syncBlockchainAssets(walletAddress, userId) {
    try {
      const dbService = new DatabaseService();

      // Sync pets from blockchain
      const blockchainPets = await blockchainService.getOwnedPets(
        walletAddress
      );

      // Sync eggs from blockchain
      const blockchainEggs = await blockchainService.getOwnedEggs(
        walletAddress
      );

      // Sync skins from blockchain
      const blockchainSkins = await blockchainService.getOwnedSkins(
        walletAddress
      );

      // Sync techniques from blockchain
      const blockchainTechniques = await blockchainService.getOwnedTechniques(
        walletAddress
      );

      // Here you would update the user's assets in the database
      // This is a simplified version - you'd need to implement the actual sync logic
      logger.info(
        `Synced blockchain assets for user ${userId}: ${blockchainPets.length} pets, ${blockchainEggs.length} eggs`
      );

      return {
        pets: blockchainPets.length,
        eggs: blockchainEggs.length,
        skins: blockchainSkins.length,
        techniques: blockchainTechniques.length,
      };
    } catch (error) {
      logger.error("Error syncing blockchain assets:", error);
      return { error: error.message };
    }
  },
};
