// scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("🔧 Deployment Configuration:");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log("Deployer address:", deployer.address);
  console.log(
    "Deployer balance:",
    ethers.utils.formatEther(await deployer.getBalance()),
    "ETH"
  );

  // Use environment variable or default to deployer address
  const platformWallet =
    process.env.PLATFORM_WALLET_ADDRESS || deployer.address;
  console.log("Platform wallet:", platformWallet);

  console.log("\n🚀 Starting deployment...");

  // Deploy PetNFT Contract
  console.log("\n📦 Deploying PetNFT...");
  const PetNFT = await ethers.getContractFactory("PetNFT");
  const petNFT = await PetNFT.deploy();
  await petNFT.deployed();
  console.log("✅ PetNFT deployed to:", petNFT.address);

  // Deploy EggNFT Contract
  console.log("\n🥚 Deploying EggNFT...");
  const EggNFT = await ethers.getContractFactory("EggNFT");
  const eggNFT = await EggNFT.deploy();
  await eggNFT.deployed();
  console.log("✅ EggNFT deployed to:", eggNFT.address);

  // Deploy Marketplace Contract
  console.log("\n🏪 Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const platformFee = 250; // 2.5% platform fee (basis points)
  const marketplace = await Marketplace.deploy(platformWallet, platformFee);
  await marketplace.deployed();
  console.log("✅ Marketplace deployed to:", marketplace.address);

  // Set up marketplace permissions
  console.log("\n🔗 Setting up marketplace permissions...");
  const setPetTx = await petNFT.setMarketplace(marketplace.address);
  await setPetTx.wait();

  const setEggTx = await eggNFT.setMarketplace(marketplace.address);
  await setEggTx.wait();

  console.log("✅ Marketplace permissions set");

  // Save contract addresses to JSON file
  const contracts = {
    petNFT: petNFT.address,
    eggNFT: eggNFT.address,
    marketplace: marketplace.address,
    network: {
      name: network.name,
      chainId: network.chainId,
    },
    platform: {
      wallet: platformWallet,
      fee: platformFee,
    },
    deployment: {
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      blockNumber: await ethers.provider.getBlockNumber(),
    },
  };

  // Create artifacts directory if it doesn't exist
  const artifactsDir = path.join(__dirname, "../artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Save to multiple locations for different uses
  const deploymentFiles = [
    "artifacts/contract-addresses.json",
    "client/src/contracts/contract-addresses.json",
  ];

  for (const filePath of deploymentFiles) {
    const fullPath = path.join(__dirname, "..", filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, JSON.stringify(contracts, null, 2));
    console.log(`💾 Contract addresses saved to: ${filePath}`);
  }

  // Generate frontend environment file
  const envTemplate = `# Contract Addresses for ${network.name.toUpperCase()}
REACT_APP_PET_NFT_CONTRACT=${petNFT.address}
REACT_APP_EGG_NFT_CONTRACT=${eggNFT.address}
REACT_APP_MARKETPLACE_CONTRACT=${marketplace.address}
REACT_APP_NETWORK_CHAIN_ID=${network.chainId}
REACT_APP_PLATFORM_WALLET=${platformWallet}

# Blockchain RPC URLs
REACT_APP_ETH_SEPOLIA_RPC_URL=${process.env.ETH_SEPOLIA_RPC_URL}
REACT_APP_POLYGON_AMOY_RPC_URL=${process.env.POLYGON_AMOY_TESTNET_RPC_URL}
`;

  fs.writeFileSync(path.join(__dirname, "../client/.env.local"), envTemplate);
  console.log("📄 Frontend environment file saved to: client/.env.local");

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📊 Deployment Summary:");
  console.log("   🐾 PetNFT:", petNFT.address);
  console.log("   🥚 EggNFT:", eggNFT.address);
  console.log("   🏪 Marketplace:", marketplace.address);
  console.log("   💼 Platform Wallet:", platformWallet);
  console.log("   🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);

  console.log("\n📝 Next steps:");
  console.log("   1. Update your frontend with the new contract addresses");
  console.log(
    "   2. Test the contracts manually since we can't verify without API keys"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
