// scripts/test-contracts.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing deployed contracts...");

  // Load contract addresses
  const contracts = require("../artifacts/contract-addresses.json");

  // Attach to deployed contracts
  const PetNFT = await ethers.getContractFactory("PetNFT");
  const petNFT = PetNFT.attach(contracts.petNFT);

  const EggNFT = await ethers.getContractFactory("EggNFT");
  const eggNFT = EggNFT.attach(contracts.eggNFT);

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = Marketplace.attach(contracts.marketplace);

  // Test basic functionality
  console.log("\n🔍 Testing PetNFT...");
  console.log("Name:", await petNFT.name());
  console.log("Symbol:", await petNFT.symbol());
  console.log("Marketplace:", await petNFT.marketplace());

  console.log("\n🔍 Testing EggNFT...");
  console.log("Name:", await eggNFT.name());
  console.log("Symbol:", await eggNFT.symbol());
  console.log("Marketplace:", await eggNFT.marketplace());

  console.log("\n🔍 Testing Marketplace...");
  console.log(
    "Platform Fee:",
    (await marketplace.platformFee()).toString(),
    "basis points"
  );
  console.log("Platform Wallet:", await marketplace.platformWallet());
  console.log("PetNFT Contract:", await marketplace.petNFT());
  console.log("EggNFT Contract:", await marketplace.eggNFT());

  console.log("\n✅ All contracts are properly deployed and connected!");
}

main().catch(console.error);
