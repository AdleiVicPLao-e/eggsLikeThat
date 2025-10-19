// scripts/debug-contracts.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debugging Contract Deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.utils.formatEther(await deployer.getBalance()),
    "ETH"
  );

  // Load contract addresses
  const contracts = require("../contract-addresses.json");

  console.log("\n📋 Loaded addresses:");
  Object.entries(contracts).forEach(([key, value]) => {
    if (typeof value === "string" && value.startsWith("0x")) {
      console.log(`   ${key}: ${value}`);
    }
  });

  // Check if contracts have code
  console.log("\n🔍 Checking contract code at addresses...");

  for (const [name, address] of Object.entries(contracts)) {
    if (typeof address === "string" && address.startsWith("0x")) {
      try {
        const code = await ethers.provider.getCode(address);
        console.log(
          `   ${name}: ${code === "0x" ? "❌ NO CODE" : "✅ HAS CODE"}`
        );

        if (code === "0x") {
          console.log(`      ⚠️  No contract found at ${address}`);
        } else {
          console.log(`      📏 Code size: ${(code.length - 2) / 2} bytes`);
        }
      } catch (error) {
        console.log(`   ${name}: ❌ ERROR - ${error.message}`);
      }
    }
  }
}

main().catch(console.error);
