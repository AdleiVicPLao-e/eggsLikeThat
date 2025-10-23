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
    ethers.formatEther(await deployer.provider.getBalance(deployer.address)), // Fixed for ethers v6
    "ETH"
  );

  // Use environment variable or default to deployer address
  const platformWallet =
    process.env.PLATFORM_WALLET_ADDRESS || deployer.address;
  console.log("Platform wallet:", platformWallet);

  console.log("\n🚀 Starting deployment...");

  // Base URIs for metadata
  const baseURIs = {
    pets: "https://api.petverse.game/pets/",
    eggs: "https://api.petverse.game/eggs/",
    skins: "https://api.petverse.game/skins/",
    techniques: "https://api.petverse.game/techniques/",
  };

  // Deploy PetNFT Contract
  console.log("\n📦 Deploying PetNFT...");
  const PetNFT = await ethers.getContractFactory("PetNFT");
  const petNFT = await PetNFT.deploy(baseURIs.pets);
  await petNFT.waitForDeployment(); // Changed from deployed() in ethers v6
  const petNFTAddress = await petNFT.getAddress();
  console.log("✅ PetNFT deployed to:", petNFTAddress);

  // Deploy EggNFT Contract
  console.log("\n🥚 Deploying EggNFT...");
  const EggNFT = await ethers.getContractFactory("EggNFT");
  const eggNFT = await EggNFT.deploy(baseURIs.eggs);
  await eggNFT.waitForDeployment();
  const eggNFTAddress = await eggNFT.getAddress();
  console.log("✅ EggNFT deployed to:", eggNFTAddress);

  // Deploy SkinNFT Contract
  console.log("\n🎨 Deploying SkinNFT...");
  const SkinNFT = await ethers.getContractFactory("SkinNFT");
  const skinNFT = await SkinNFT.deploy(baseURIs.skins);
  await skinNFT.waitForDeployment();
  const skinNFTAddress = await skinNFT.getAddress();
  console.log("✅ SkinNFT deployed to:", skinNFTAddress);

  // Deploy TechniqueNFT Contract
  console.log("\n🔮 Deploying TechniqueNFT...");
  const TechniqueNFT = await ethers.getContractFactory("TechniqueNFT");
  const techniqueNFT = await TechniqueNFT.deploy(baseURIs.techniques);
  await techniqueNFT.waitForDeployment();
  const techniqueNFTAddress = await techniqueNFT.getAddress();
  console.log("✅ TechniqueNFT deployed to:", techniqueNFTAddress);

  // Deploy Marketplace Contract
  console.log("\n🏪 Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const platformFee = 250; // 2.5% platform fee (basis points)
  const marketplace = await Marketplace.deploy(platformWallet);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log("✅ Marketplace deployed to:", marketplaceAddress);

  // Save contract addresses to JSON file
  const contracts = {
    petNFT: petNFTAddress,
    eggNFT: eggNFTAddress,
    skinNFT: skinNFTAddress,
    techniqueNFT: techniqueNFTAddress,
    marketplace: marketplaceAddress,
    network: {
      name: network.name,
      chainId: Number(network.chainId), // Convert BigInt to Number
    },
    platform: {
      wallet: platformWallet,
      fee: platformFee,
    },
    baseURIs: baseURIs,
    deployment: {
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      blockNumber: await ethers.provider.getBlockNumber(),
    },
    // Add contractpath for test configuration
    contractpath: "./artifacts/contracts",
  };

  // Create artifacts directory if it doesn't exist
  const artifactsDir = path.join(__dirname, "../artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // Save to multiple locations for different uses
  const deploymentFiles = [
    "./contract-addresses.json",
    "./artifacts/contract-addresses.json",
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
VITE_PET_NFT_CONTRACT=${petNFTAddress}
VITE_EGG_NFT_CONTRACT=${eggNFTAddress}
VITE_SKIN_NFT_CONTRACT=${skinNFTAddress}
VITE_TECHNIQUE_NFT_CONTRACT=${techniqueNFTAddress}
VITE_MARKETPLACE_CONTRACT=${marketplaceAddress}
VITE_NETWORK_CHAIN_ID=${Number(network.chainId)}
VITE_PLATFORM_WALLET=${platformWallet}

# Base URIs for metadata
VITE_PETS_BASE_URI=${baseURIs.pets}
VITE_EGGS_BASE_URI=${baseURIs.eggs}
VITE_SKINS_BASE_URI=${baseURIs.skins}
VITE_TECHNIQUES_BASE_URI=${baseURIs.techniques}

# Blockchain RPC URLs
VITE_ETH_SEPOLIA_RPC_URL=${process.env.ETH_SEPOLIA_RPC_URL || ""}
VITE_POLYGON_AMOY_RPC_URL=${process.env.POLYGON_AMOY_TESTNET_RPC_URL || ""}
`;

  const clientEnvPath = path.join(__dirname, "../../../../client/.env.local");
  const clientDir = path.dirname(clientEnvPath);

  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }

  fs.writeFileSync(clientEnvPath, envTemplate);
  console.log("📄 Frontend environment file saved to: client/.env.local");

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📊 Deployment Summary:");
  console.log("   🐾 PetNFT:", petNFTAddress);
  console.log("   🥚 EggNFT:", eggNFTAddress);
  console.log("   🎨 SkinNFT:", skinNFTAddress);
  console.log("   🔮 TechniqueNFT:", techniqueNFTAddress);
  console.log("   🏪 Marketplace:", marketplaceAddress);
  console.log("   💼 Platform Wallet:", platformWallet);
  console.log("   🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("   📁 Contract Path: ./artifacts/contracts");

  console.log("\n⚠️  IMPORTANT: Make sure your Hardhat node is running!");
  console.log("   Run: npm run node");
  console.log("   Then run this deployment script again");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
