const { ethers } = require("hardhat");

// Helper function to convert string to bytes32
function stringToBytes32(str) {
  return ethers.utils.formatBytes32String(str);
}

// Helper function to convert bytes32 to string
function bytes32ToString(bytes32Str) {
  return ethers.utils.parseBytes32String(bytes32Str);
}

// Calculate fusion success chance
function calculateFusionSuccess(tier1, tier2, tier3 = 0) {
  const baseChance = 70; // 70% base chance
  const tierBonus = (tier1 + tier2 + tier3) * 5; // 5% per tier level
  return Math.min(baseChance + tierBonus, 95); // Max 95%
}

// Generate random token URI for testing
function generateTokenURI(petId, tier, petType) {
  const tiers = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
  const types = ["Fire", "Water", "Earth", "Air", "Light", "Dark"];

  return `https://api.petverse.game/pets/${petId}.json`;
}

// Wait for transaction confirmation
async function waitForTx(tx, confirmations = 1) {
  const receipt = await tx.wait(confirmations);
  console.log(`Transaction confirmed: ${receipt.transactionHash}`);
  return receipt;
}

// Verify contract deployment
async function verifyContract(address, constructorArguments = []) {
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments,
    });
    console.log(`Contract verified: ${address}`);
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log(`Contract already verified: ${address}`);
    } else {
      console.error(`Verification failed for ${address}:`, error.message);
    }
  }
}

module.exports = {
  stringToBytes32,
  bytes32ToString,
  calculateFusionSuccess,
  generateTokenURI,
  waitForTx,
  verifyContract,
};
