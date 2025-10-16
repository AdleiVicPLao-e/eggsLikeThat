import User from "../models/User.js";
import {
  generateToken,
  verifyWalletSignature,
  generateNonce,
} from "../utils/cryptoUtils.js";
import { mailService } from "../services/MailService.js";
import logger from "../utils/logger.js";

export const AuthController = {
  // Register new user with email/password
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email: email.toLowerCase() }, { username }],
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

      // Create new user
      const user = new User({
        authMethod: "email",
        email: email.toLowerCase(),
        username,
        password,
        // Free starting resources
        coins: 1000,
        freeRolls: 3,
      });

      await user.save();

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        email: user.email,
        authMethod: user.authMethod,
      });

      // Send welcome email
      if (email) {
        await mailService.sendWelcomeEmail(user);
      }

      logger.info(`New user registered: ${username} (${email})`);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            authMethod: user.authMethod,
            level: user.level,
            coins: user.coins,
            freeRolls: user.freeRolls,
            hasWallet: !!user.walletAddress,
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

  // Email/password login
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "No account found with this email",
        });
      }

      // Check password
      if (
        !user.password ||
        !(await user.correctPassword(password, user.password))
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid password",
        });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        email: user.email,
        authMethod: user.authMethod,
      });

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      logger.info(`User logged in: ${user.username} (${email})`);

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            authMethod: user.authMethod,
            level: user.level,
            coins: user.coins,
            freeRolls: user.freeRolls,
            experience: user.experience,
            hasWallet: !!user.walletAddress,
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

  // Connect wallet to existing account
  async connectWallet(req, res) {
    try {
      const { walletAddress, signature } = req.body;
      const user = req.user;

      // Check if wallet is already connected to another account
      const existingWalletUser = await User.findByWallet(walletAddress);
      if (existingWalletUser) {
        return res.status(400).json({
          success: false,
          message: "Wallet already connected to another account",
        });
      }

      // Verify signature (in real implementation)
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

      // Update user with wallet
      user.walletAddress = walletAddress.toLowerCase();
      if (user.authMethod === "email") {
        user.authMethod = "both"; // Can use both email and wallet
      }

      await user.save();

      logger.info(
        `Wallet connected: ${walletAddress} to user ${user.username}`
      );

      res.json({
        success: true,
        message: "Wallet connected successfully",
        data: {
          user: {
            id: user._id,
            username: user.username,
            walletAddress: user.walletAddress,
            hasWallet: true,
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

  // Wallet-only registration (for users who prefer wallet-first)
  async walletRegister(req, res) {
    try {
      const { walletAddress, username, signature } = req.body;

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

      // Verify signature (in real implementation)
      if (signature) {
        const message = `Register to PetVerse - Nonce: ${generateNonce()}`;
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

      // Create new user
      const user = new User({
        authMethod: "wallet",
        walletAddress: walletAddress.toLowerCase(),
        username,
        // Free starting resources
        coins: 1000,
        freeRolls: 3,
      });

      await user.save();

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        walletAddress: user.walletAddress,
        authMethod: user.authMethod,
      });

      logger.info(`New wallet user registered: ${username} (${walletAddress})`);

      res.status(201).json({
        success: true,
        message: "User registered successfully with wallet",
        data: {
          user: {
            id: user._id,
            username: user.username,
            walletAddress: user.walletAddress,
            authMethod: user.authMethod,
            level: user.level,
            coins: user.coins,
            freeRolls: user.freeRolls,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Wallet registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during wallet registration",
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

      // Verify signature (in real implementation)
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
        authMethod: user.authMethod,
      });

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      logger.info(
        `User logged in via wallet: ${user.username} (${walletAddress})`
      );

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            username: user.username,
            walletAddress: user.walletAddress,
            authMethod: user.authMethod,
            level: user.level,
            coins: user.coins,
            freeRolls: user.freeRolls,
            experience: user.experience,
            email: user.email,
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Wallet login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during wallet login",
      });
    }
  },

  // Guest login (no authentication required)
  async guestLogin(req, res) {
    try {
      const { username } = req.body;

      // Generate a temporary identifier for guest users
      const guestId = `guest_${Date.now()}_${Math.random()
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
        authMethod: "guest",
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
          authMethod: user.authMethod,
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
            authMethod: user.authMethod,
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
        .select("-password -__v")
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
            email: user.email,
            walletAddress: user.walletAddress,
            authMethod: user.authMethod,
            isGuest: user.isGuest,
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
            lastLogin: user.lastLogin,
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
          email: user.email,
          walletAddress: user.walletAddress,
          authMethod: user.authMethod,
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
};
