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

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/pets", petsRoutes);
app.use("/api/eggs", eggsRoutes);
app.use("/api/trade", tradeRoutes);
app.use("/api/admin", adminRoutes);

// Welcome route
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to PetVerse API!",
    endpoints: {
      auth: "/api/auth",
      game: "/api/game",
      pets: "/api/pets",
      eggs: "/api/eggs",
      trade: "/api/trade",
      admin: "/api/admin",
    },
    documentation: "https://docs.petverse.game",
  });
});

// 404 handler
app.use("/api", notFound);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = config.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info(`🚀 PetVerse Server running on port ${PORT}`);
  logger.info(`🌍 Environment: ${config.NODE_ENV}`);
  logger.info(`🔗 Client URL: ${config.CLIENT_URL}`);
  logger.info(`📊 API available at: http://localhost:${PORT}/api`);
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
