import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { apiLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Basic admin check middleware
const requireAdmin = (req, res, next) => {
  // In a real implementation, you'd check user roles/permissions
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

// All admin routes require authentication and admin privileges
router.use(authMiddleware, requireAdmin, apiLimiter);

// Admin dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const User = (await import("../models/User.js")).default;
    const Pet = (await import("../models/Pet.js")).default;
    const Trade = (await import("../models/Trade.js")).default;

    const [totalUsers, totalPets, activeTrades, recentRegistrations] =
      await Promise.all([
        User.countDocuments(),
        Pet.countDocuments(),
        Trade.countDocuments({ status: "listed" }),
        User.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }),
      ]);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          newToday: recentRegistrations,
        },
        pets: {
          total: totalPets,
        },
        marketplace: {
          activeListings: activeTrades,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching admin stats",
    });
  }
});

// Adjust game settings
router.patch("/settings", async (req, res) => {
  try {
    const { setting, value } = req.body;

    // In a real implementation, you'd update settings in database
    // For now, just acknowledge the request
    res.json({
      success: true,
      message: `Setting ${setting} updated to ${value}`,
      data: { setting, value },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating settings",
    });
  }
});

// User management
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const User = (await import("../models/User.js")).default;

    const users = await User.find()
      .select("username walletAddress level coins createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await User.countDocuments();

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching users",
    });
  }
});

export default router;
