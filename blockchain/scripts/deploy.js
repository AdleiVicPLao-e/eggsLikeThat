const { ethers } = require("hardhat");
const { writeFileSync, readFileSync } = require("fs");
const path = require("path");
const { waitForTx, verifyContract } = require("../utils/helpers");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying to network: ${network.name} (${network.chainId})`);

  // Deploy GameToken first (if needed)
  console.log("\n1. Deploying GameToken...");
  const GameToken = await ethers.getContractFactory("GameToken");
  const gameToken = await GameToken.deploy();
  await gameToken.deployed();
  console.log("GameToken deployed to:", gameToken.address);
  await waitForTx(gameToken.deployTransaction);

  // Deploy PetNFT
  console.log("\n2. Deploying PetNFT...");
  const PetNFT = await ethers.getContractFactory("PetNFT");
  const petNFT = await PetNFT.deploy();
  await petNFT.deployed();
  console.log("PetNFT deployed to:", petNFT.address);
  await waitForTx(petNFT.deployTransaction);

  // Deploy EggItem
  console.log("\n3. Deploying EggItem...");
  const baseURI = "https://api.petverse.game/api/metadata/";
  const EggItem = await ethers.getContractFactory("EggItem");
  const eggItem = await EggItem.deploy(baseURI);
  await eggItem.deployed();
  console.log("EggItem deployed to:", eggItem.address);
  await waitForTx(eggItem.deployTransaction);

  // Deploy Marketplace
  console.log("\n4. Deploying Marketplace...");
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(petNFT.address, eggItem.address);
  await marketplace.deployed();
  console.log("Marketplace deployed to:", marketplace.address);
  await waitForTx(marketplace.deployTransaction);

  // Deploy FusionSystem
  console.log("\n5. Deploying FusionSystem...");
  const FusionSystem = await ethers.getContractFactory("FusionSystem");
  const fusionSystem = await FusionSystem.deploy(petNFT.address);
  await fusionSystem.deployed();
  console.log("FusionSystem deployed to:", fusionSystem.address);
  await waitForTx(fusionSystem.deployTransaction);

  // Configure contracts
  console.log("\n6. Configuring contracts...");

  // Add marketplace as minter to GameToken
  console.log("Adding Marketplace as minter to GameToken...");
  const addMinterTx = await gameToken.addMinter(marketplace.address);
  await waitForTx(addMinterTx);

  // Save deployment addresses
  const addresses = {
    GameToken: gameToken.address,
    PetNFT: petNFT.address,
    EggItem: eggItem.address,
    Marketplace: marketplace.address,
    FusionSystem: fusionSystem.address,
    Deployer: deployer.address,
    Network: network.name,
    ChainId: network.chainId,
  };

  const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
  writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("\nDeployment addresses saved to:", addressesPath);

  // Display deployment summary
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("GameToken:", gameToken.address);
  console.log("PetNFT:", petNFT.address);
  console.log("EggItem:", eggItem.address);
  console.log("Marketplace:", marketplace.address);
  console.log("FusionSystem:", fusionSystem.address);
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);

  // Prepare verification info
  const verificationInfo = {
    contracts: [
      {
        name: "GameToken",
        address: gameToken.address,
        constructorArguments: [],
      },
      {
        name: "PetNFT",
        address: petNFT.address,
        constructorArguments: [],
      },
      {
        name: "EggItem",
        address: eggItem.address,
        constructorArguments: [baseURI],
      },
      {
        name: "Marketplace",
        address: marketplace.address,
        constructorArguments: [petNFT.address, eggItem.address],
      },
      {
        name: "FusionSystem",
        address: fusionSystem.address,
        constructorArguments: [petNFT.address],
      },
    ],
  };

  const verificationPath = path.join(__dirname, "..", "verification-info.json");
  writeFileSync(verificationPath, JSON.stringify(verificationInfo, null, 2));
  console.log("\nVerification info saved to:", verificationPath);

  return addresses;
}

// Verify contracts on block explorer
async function verify() {
  console.log("\n7. Verifying contracts on block explorer...");

  try {
    const verificationInfo = JSON.parse(
      readFileSync(path.join(__dirname, "..", "verification-info.json"), "utf8")
    );

    for (const contract of verificationInfo.contracts) {
      console.log(`Verifying ${contract.name} at ${contract.address}...`);
      await verifyContract(contract.address, contract.constructorArguments);
      // Add delay between verifications to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log("All contracts verified successfully!");
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

// Deploy and verify
main()
  .then(async (addresses) => {
    console.log("\nDeployment completed successfully!");

    // Only verify on testnets/mainnets, not localhost
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 31337) {
      // Not localhost
      await verify();
    }

    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
