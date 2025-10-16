import Joi from "joi";

// User validation schemas
export const userRegistrationSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().optional(),
  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required(),
});

export const userLoginSchema = Joi.object({
  walletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required(),
  signature: Joi.string().optional(), // For web3 login
});

// Pet validation schemas
export const petCreationSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  tier: Joi.string()
    .valid("common", "uncommon", "rare", "epic", "legendary")
    .required(),
  type: Joi.string()
    .valid("Fire", "Water", "Earth", "Air", "Light", "Dark")
    .required(),
  abilities: Joi.array().items(Joi.string()).min(1).max(3).required(),
  stats: Joi.object({
    attack: Joi.number().min(1).max(500).required(),
    defense: Joi.number().min(1).max(500).required(),
    speed: Joi.number().min(1).max(500).required(),
    health: Joi.number().min(1).max(1000).required(),
  }).required(),
});

export const petUpgradeSchema = Joi.object({
  petId: Joi.string().required(),
  materialPets: Joi.array().items(Joi.string()).min(1).max(5).required(),
});

// Trade validation schemas
export const tradeCreationSchema = Joi.object({
  petId: Joi.string().required(),
  price: Joi.number().min(0.001).max(1000).required(),
  currency: Joi.string().valid("ETH", "MATIC", "USDC").default("ETH"),
});

export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        error: error.details[0].message,
      });
    }
    next();
  };
};

export const offerCreationSchema = Joi.object({
  petId: Joi.string().required(),
  offerPrice: Joi.number().min(0.001).max(10000).required(),
  currency: Joi.string()
    .valid("coins", "ETH", "MATIC", "USDC")
    .default("coins"),
  message: Joi.string().max(500).allow(""),
  expiresInHours: Joi.number().min(1).max(168).default(48),
});

export const counterOfferSchema = Joi.object({
  counterPrice: Joi.number().min(0.001).max(10000).required(),
  message: Joi.string().max(500).allow(""),
  expiresInHours: Joi.number().min(1).max(168).default(24),
});

export const offerResponseSchema = Joi.object({
  responseMessage: Joi.string().max(500).allow(""),
});
