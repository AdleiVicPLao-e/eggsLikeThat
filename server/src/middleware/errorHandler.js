import logger from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error("Error occurred:", err);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((error) => error.message);
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
};

// Optional: Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log request details
  logger.info(
    `${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get(
      "User-Agent"
    )}`
  );

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(
      `${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`
    );
  });

  next();
};

// Optional: CORS middleware (if not already handled elsewhere)
export const corsMiddleware = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", config.ALLOWED_ORIGINS || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
};

// Optional: Security headers middleware
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.header("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.header("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  res.header("X-XSS-Protection", "1; mode=block");

  // Strict transport security (if using HTTPS)
  if (req.secure || config.NODE_ENV === "production") {
    res.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  next();
};
