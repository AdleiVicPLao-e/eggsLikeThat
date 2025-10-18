// server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import logger from "./utils/logger.js";

// Import routes
import authRoutes from "./api/auth.routes.js";
import gameRoutes from "./api/game.routes.js";
import petsRoutes from "./api/pets.routes.js";
import eggsRoutes from "./api/eggs.routes.js";
import tradeRoutes from "./api/trade.routes.js";
import adminRoutes from "./api/admin.routes.js";

// Import sample data populator
import {
  populateSampleData,
  SampleDataPopulator,
} from "./config/populateSampleData.js";

const app = express();

// Connect to database
connectDB();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// CORS configuration
app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
app.use("/api/", apiLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "PetVerse Server is running!",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: "1.0.0",
  });
});

// 🔧 DEVELOPMENT & DEMO ROUTES - Sample Data Management
if (config.NODE_ENV === "development" || config.NODE_ENV === "demo") {
  // Sample data management routes
  app.get("/api/dev/sample-data/info", (req, res) => {
    const populator = new SampleDataPopulator();
    res.json({
      success: true,
      message: "Sample Data Information",
      data: {
        availableUsers: populator.sampleUsers.length,
        availablePets: populator.samplePets.length,
        availableEggTypes: 3, // BASIC, COSMETIC, ATTRIBUTE
        availableTechniques: populator.sampleTechniques.length,
        availableSkins: populator.sampleSkins.length,
        environment: config.NODE_ENV,
      },
    });
  });

  // Populate sample data endpoint
  app.post("/api/dev/sample-data/populate", async (req, res) => {
    try {
      const { clearExisting = true } = req.body;

      logger.info("🔄 Starting sample data population via API...");

      const result = await populateSampleData();

      res.json({
        success: true,
        message: "Sample data populated successfully!",
        data: {
          users: result.users.length,
          pets: result.pets.length,
          eggs: result.eggs.length,
          techniques: result.techniques.length,
          skins: result.skins.length,
          listings: result.listings.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Sample data population failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to populate sample data",
        error: error.message,
      });
    }
  });

  // Clear all data endpoint
  app.delete("/api/dev/sample-data/clear", async (req, res) => {
    try {
      const populator = new SampleDataPopulator();
      await populator.clearExistingData();

      res.json({
        success: true,
        message: "All sample data cleared successfully!",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Data clearance failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to clear sample data",
        error: error.message,
      });
    }
  });

  // Get sample data statistics
  app.get("/api/dev/sample-data/stats", async (req, res) => {
    try {
      const models = mongoose.models;
      const stats = {
        users: await models.User.countDocuments(),
        pets: await models.Pet.countDocuments(),
        eggs: await models.Egg.countDocuments(),
        techniques: await models.Technique.countDocuments(),
        skins: await models.Skin.countDocuments(),
        listings: await models.Listing.countDocuments({ isActive: true }),
      };

      res.json({
        success: true,
        message: "Current database statistics",
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get statistics",
        error: error.message,
      });
    }
  });
}

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/pets", petsRoutes);
app.use("/api/eggs", eggsRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/admin", adminRoutes);

// Welcome route
app.get("/api", (req, res) => {
  const endpoints = {
    auth: "/api/auth",
    game: "/api/game",
    pets: "/api/pets",
    eggs: "/api/eggs",
    trade: "/api/trade",
    admin: "/api/admin",
    documentation: "https://docs.petverse.game",
  };

  // Add dev endpoints in development/demo mode
  if (config.NODE_ENV === "development" || config.NODE_ENV === "demo") {
    endpoints.dev = {
      sampleDataInfo: "/api/dev/sample-data/info",
      populateSampleData: "POST /api/dev/sample-data/populate",
      clearSampleData: "DELETE /api/dev/sample-data/clear",
      sampleDataStats: "/api/dev/sample-data/stats",
    };
  }

  res.json({
    success: true,
    message: "Welcome to PetVerse API!",
    endpoints,
    environment: config.NODE_ENV,
    version: "1.0.0",
  });
});

// 404 handler
app.use("/api", notFound);

// Error handling middleware
app.use(errorHandler);

// Auto-populate sample data in demo environment on startup
async function initializeSampleData() {
  if (
    config.AUTO_POPULATE_SAMPLE_DATA === "true" ||
    config.NODE_ENV === "demo"
  ) {
    try {
      logger.info("🎪 Auto-populating sample data on startup...");

      // Wait a bit for database to be fully connected
      setTimeout(async () => {
        try {
          const result = await populateSampleData();
          logger.info("✅ Sample data auto-population completed!");
          logger.info(
            `📊 Created: ${result.users.length} users, ${result.pets.length} pets, ${result.eggs.length} eggs`
          );
        } catch (error) {
          logger.error("❌ Sample data auto-population failed:", error);
        }
      }, 2000);
    } catch (error) {
      logger.error("Sample data initialization error:", error);
    }
  }
}

// Start server
const PORT = config.PORT || 3001;

const server = app.listen(PORT, async () => {
  logger.info(`🚀 PetVerse Server running on port ${PORT}`);
  logger.info(`🌍 Environment: ${config.NODE_ENV}`);
  logger.info(`🔗 Client URL: ${config.CLIENT_URL}`);
  logger.info(`📊 API available at: http://localhost:${PORT}/api`);

  // Initialize sample data after server starts
  await initializeSampleData();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

// Unhandled promise rejection handler
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Promise Rejection:", err);
  server.close(() => {
    process.exit(1);
  });
});

// Uncaught exception handler
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
  server.close(() => {
    process.exit(1);
  });
});

export default app;
