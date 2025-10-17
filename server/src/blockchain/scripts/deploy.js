// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy PetNFT
  const PetNFT = await ethers.getContractFactory("PetNFT");
  const petNFT = await PetNFT.deploy();
  await petNFT.deployed();
  console.log("PetNFT deployed to:", petNFT.address);

  // Deploy EggNFT
  const EggNFT = await ethers.getContractFactory("EggNFT");
  const eggNFT = await EggNFT.deploy();
  await eggNFT.deployed();
  console.log("EggNFT deployed to:", eggNFT.address);

  // Deploy Marketplace
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy(deployer.address); // Platform wallet
  await marketplace.deployed();
  console.log("Marketplace deployed to:", marketplace.address);

  // Save contract addresses to a file for frontend use
  const contracts = {
    petNFT: petNFT.address,
    eggNFT: eggNFT.address,
    marketplace: marketplace.address,
    network: network.name,
  };

  require("fs").writeFileSync(
    "contract-addresses.json",
    JSON.stringify(contracts, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
