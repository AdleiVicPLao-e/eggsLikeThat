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
  const petNFT = await PetNFT.deploy(baseURIs.pets); // Add baseURI parameter
  await petNFT.deployed();
  console.log("✅ PetNFT deployed to:", petNFT.address);

  // Deploy EggNFT Contract
  console.log("\n🥚 Deploying EggNFT...");
  const EggNFT = await ethers.getContractFactory("EggNFT");
  const eggNFT = await EggNFT.deploy(baseURIs.eggs); // Add baseURI parameter
  await eggNFT.deployed();
  console.log("✅ EggNFT deployed to:", eggNFT.address);

  // Deploy SkinNFT Contract
  console.log("\n🎨 Deploying SkinNFT...");
  const SkinNFT = await ethers.getContractFactory("SkinNFT");
  const skinNFT = await SkinNFT.deploy(baseURIs.skins); // Add baseURI parameter
  await skinNFT.deployed();
  console.log("✅ SkinNFT deployed to:", skinNFT.address);

  // Deploy TechniqueNFT Contract
  console.log("\n🔮 Deploying TechniqueNFT...");
  const TechniqueNFT = await ethers.getContractFactory("TechniqueNFT");
  const techniqueNFT = await TechniqueNFT.deploy(baseURIs.techniques); // Add baseURI parameter
  await techniqueNFT.deployed();
  console.log("✅ TechniqueNFT deployed to:", techniqueNFT.address);

  // Deploy Marketplace Contract
  console.log("\n🏪 Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const platformFee = 250; // 2.5% platform fee (basis points)
  const marketplace = await Marketplace.deploy(platformWallet);
  await marketplace.deployed();
  console.log("✅ Marketplace deployed to:", marketplace.address);

  // Save contract addresses to JSON file
  const contracts = {
    petNFT: petNFT.address,
    eggNFT: eggNFT.address,
    skinNFT: skinNFT.address,
    techniqueNFT: techniqueNFT.address,
    marketplace: marketplace.address,
    network: {
      name: network.name,
      chainId: network.chainId,
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
VITE_PET_NFT_CONTRACT=${petNFT.address}
VITE_EGG_NFT_CONTRACT=${eggNFT.address}
VITE_SKIN_NFT_CONTRACT=${skinNFT.address}
VITE_TECHNIQUE_NFT_CONTRACT=${techniqueNFT.address}
VITE_MARKETPLACE_CONTRACT=${marketplace.address}
VITE_NETWORK_CHAIN_ID=${network.chainId}
VITE_PLATFORM_WALLET=${platformWallet}

# Base URIs for metadata
VITE_PETS_BASE_URI=${baseURIs.pets}
VITE_EGGS_BASE_URI=${baseURIs.eggs}
VITE_SKINS_BASE_URI=${baseURIs.skins}
VITE_TECHNIQUES_BASE_URI=${baseURIs.techniques}

# Blockchain RPC URLs
VITE_ETH_SEPOLIA_RPC_URL=${process.env.ETH_SEPOLIA_RPC_URL}
VITE_POLYGON_AMOY_RPC_URL=${process.env.POLYGON_AMOY_TESTNET_RPC_URL}
`;

  fs.writeFileSync(
    path.join(__dirname, "../../../../client/.env.local"),
    envTemplate
  );
  console.log("📄 Frontend environment file saved to: client/.env.local");

  console.log("\n🎉 Deployment completed successfully!");
  console.log("\n📊 Deployment Summary:");
  console.log("   🐾 PetNFT:", petNFT.address);
  console.log("   🥚 EggNFT:", eggNFT.address);
  console.log("   🎨 SkinNFT:", skinNFT.address);
  console.log("   🔮 TechniqueNFT:", techniqueNFT.address);
  console.log("   🏪 Marketplace:", marketplace.address);
  console.log("   💼 Platform Wallet:", platformWallet);
  console.log("   🌐 Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("   📁 Contract Path: ./artifacts/contracts");

  console.log("\n⚠️  IMPORTANT: Your deployer balance is 0 ETH");
  console.log(
    "   You need to fund your wallet with testnet MATIC to deploy contracts"
  );
  console.log("   Wallet address:", deployer.address);
  console.log(
    "\n📝 Get testnet MATIC from: https://faucet.polygon.technology/"
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
