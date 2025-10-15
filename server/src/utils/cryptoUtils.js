import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { ethers } from "ethers";

// JWT Token functions
export const generateToken = (payload, expiresIn = config.JWT_EXPIRES_IN) => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid token");
  }
};

// Wallet signature verification
export const verifyWalletSignature = (address, message, signature) => {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === address.toLowerCase();
  } catch (error) {
    return false;
  }
};

// Generate random nonce for wallet authentication
export const generateNonce = () => {
  return Math.floor(Math.random() * 1000000).toString();
};

// Password hashing (for optional email/password auth)
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};
