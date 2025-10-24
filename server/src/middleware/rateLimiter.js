import rateLimit from "express-rate-limit";
// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and certain endpoints
    return req.path === "/health" || req.path === "/api/health";
  },
});

// Stricter limits for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 authentication attempts per windowMs
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Allow more attempts for guest accounts
    return req.body && req.body.isGuest;
  },
});

// Game action rate limiting
export const gameActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 game actions per minute
  message: {
    success: false,
    message: "Too many game actions, please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Wallet operation rate limiting (more strict for security)
export const walletLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 wallet operations per 5 minutes
  message: {
    success: false,
    message: "Too many wallet operations, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload/asset creation rate limiting
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 uploads per minute
  message: {
    success: false,
    message: "Too many uploads, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Optional: Dynamic rate limiting based on user status
export const createUserTierLimiter = (user) => {
  const limits = {
    guest: { windowMs: 60 * 1000, max: 10 }, // 10 requests per minute for guests
    free: { windowMs: 60 * 1000, max: 30 }, // 30 requests per minute for free users
    premium: { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute for premium
  };

  const tier = user?.isPremium ? "premium" : user?.isGuest ? "guest" : "free";
  const limitConfig = limits[tier];

  return rateLimit({
    windowMs: limitConfig.windowMs,
    max: limitConfig.max,
    message: {
      success: false,
      message: `Rate limit exceeded for ${tier} tier. Please try again later.`,
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use user ID for authenticated users, IP for others
      return req.user ? req.user._id || req.user.id : req.ip;
    },
  });
};
