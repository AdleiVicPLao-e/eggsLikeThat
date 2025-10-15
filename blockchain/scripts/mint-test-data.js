const { ethers } = require("hardhat");
const { readFileSync } = require("fs");
const path = require("path");
const { waitForTx, generateTokenURI } = require("../utils/helpers");

async function main() {
  const [deployer, user1, user2] = await ethers.getSigners();
  console.log("Minting test data with account:", deployer.address);

  // Load deployed addresses
  const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
  const addresses = JSON.parse(readFileSync(addressesPath, "utf8"));

  // Get contract instances
  const PetNFT = await ethers.getContractFactory("PetNFT");
  const EggItem = await ethers.getContractFactory("EggItem");
  const GameToken = await ethers.getContractFactory("GameToken");

  const petNFT = PetNFT.attach(addresses.PetNFT);
  const eggItem = EggItem.attach(addresses.EggItem);
  const gameToken = GameToken.attach(addresses.GameToken);

  console.log("\n1. Minting test pets...");

  // Mint some test pets for deployer
  const testPets = [
    {
      tier: 0, // Common
      petType: 0, // Fire
      attack: 50,
      defense: 30,
      speed: 40,
      health: 100,
    },
    {
      tier: 1, // Uncommon
      petType: 1, // Water
      attack: 70,
      defense: 50,
      speed: 60,
      health: 120,
    },
    {
      tier: 2, // Rare
      petType: 2, // Earth
      attack: 90,
      defense: 80,
      speed: 70,
      health: 150,
    },
  ];

  for (let i = 0; i < testPets.length; i++) {
    const pet = testPets[i];
    const tokenURI = generateTokenURI(i, pet.tier, pet.petType);

    console.log(`Minting pet ${i + 1}...`);
    const mintTx = await petNFT.mintPet(
      deployer.address,
      tokenURI,
      pet.tier,
      pet.petType,
      pet.attack,
      pet.defense,
      pet.speed,
      pet.health
    );
    await waitForTx(mintTx);
  }

  console.log("\n2. Minting test eggs...");

  // Mint some test eggs
  const eggTypes = [0, 1, 2, 3]; // Basic, Premium, Cosmetic, Mystery

  for (const eggType of eggTypes) {
    console.log(`Minting ${getEggTypeName(eggType)} eggs...`);
    const mintTx = await eggItem.mintEgg(deployer.address, eggType, 10);
    await waitForTx(mintTx);
  }

  // Also mint some eggs for user1
  for (const eggType of [0, 1]) {
    // Basic and Premium only
    const mintTx = await eggItem.mintEgg(user1.address, eggType, 5);
    await waitForTx(mintTx);
  }

  console.log("\n3. Distributing test tokens...");

  // Distribute some GameToken to test users
  const tokenAmount = ethers.utils.parseEther("1000");

  const transfer1 = await gameToken.transfer(user1.address, tokenAmount);
  await waitForTx(transfer1);

  const transfer2 = await gameToken.transfer(user2.address, tokenAmount);
  await waitForTx(transfer2);

  console.log("\n4. Creating test marketplace listings...");

  // Create some test listings
  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = Marketplace.attach(addresses.Marketplace);

  // Approve marketplace to transfer pets
  const approveTx = await petNFT.setApprovalForAll(marketplace.address, true);
  await waitForTx(approveTx);

  // List a pet for sale
  const listingPrice = ethers.utils.parseEther("0.01");
  const listTx = await marketplace.listItem(0, listingPrice, false, 1);
  await waitForTx(listTx);

  console.log("\n5. Test data summary:");

  // Display summary
  const deployerPets = await petNFT.balanceOf(deployer.address);
  const user1Pets = await petNFT.balanceOf(user1.address);
  const user2Pets = await petNFT.balanceOf(user2.address);

  const deployerEggs = [];
  const user1Eggs = [];

  for (const eggType of eggTypes) {
    deployerEggs.push(await eggItem.balanceOf(deployer.address, eggType));
    user1Eggs.push(await eggItem.balanceOf(user1.address, eggType));
  }

  const deployerTokens = await gameToken.balanceOf(deployer.address);
  const user1Tokens = await gameToken.balanceOf(user1.address);
  const user2Tokens = await gameToken.balanceOf(user2.address);

  console.log("📊 Test Data Summary:");
  console.log(`👤 Deployer (${deployer.address}):`);
  console.log(`   Pets: ${deployerPets}`);
  console.log(
    `   Eggs: Basic(${deployerEggs[0]}), Premium(${deployerEggs[1]}), Cosmetic(${deployerEggs[2]}), Mystery(${deployerEggs[3]})`
  );
  console.log(`   PETV Tokens: ${ethers.utils.formatEther(deployerTokens)}`);

  console.log(`👤 User1 (${user1.address}):`);
  console.log(`   Pets: ${user1Pets}`);
  console.log(`   Eggs: Basic(${user1Eggs[0]}), Premium(${user1Eggs[1]})`);
  console.log(`   PETV Tokens: ${ethers.utils.formatEther(user1Tokens)}`);

  console.log(`👤 User2 (${user2.address}):`);
  console.log(`   Pets: ${user2Pets}`);
  console.log(`   PETV Tokens: ${ethers.utils.formatEther(user2Tokens)}`);

  console.log(
    `🏪 Marketplace: 1 active listing at ${ethers.utils.formatEther(
      listingPrice
    )} ETH`
  );

  console.log("\n🎉 Test data minting completed!");
}

function getEggTypeName(eggType) {
  const names = ["Basic", "Premium", "Cosmetic", "Mystery"];
  return names[eggType] || "Unknown";
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Test data minting failed:", error);
    process.exit(1);
  });
