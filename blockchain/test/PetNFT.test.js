const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PetNFT", function () {
  let PetNFT;
  let petNFT;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    PetNFT = await ethers.getContractFactory("PetNFT");
    petNFT = await PetNFT.deploy();
    await petNFT.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await petNFT.name()).to.equal("PetVerse Pets");
      expect(await petNFT.symbol()).to.equal("PET");
    });

    it("Should set the right owner", async function () {
      expect(await petNFT.owner()).to.equal(owner.address);
    });
  });

  describe("Minting", function () {
    it("Should mint a new pet", async function () {
      const tokenURI = "https://api.petverse.game/pets/1.json";

      await expect(
        petNFT.mintPet(
          user1.address,
          tokenURI,
          0, // Common
          0, // Fire
          50, // attack
          30, // defense
          40, // speed
          100 // health
        )
      )
        .to.emit(petNFT, "PetMinted")
        .withArgs(0, user1.address, 0, 0, 50, 30, 40, 100);

      expect(await petNFT.ownerOf(0)).to.equal(user1.address);
      expect(await petNFT.tokenURI(0)).to.equal(tokenURI);
    });

    it("Should not allow non-owner to mint", async function () {
      await expect(
        petNFT
          .connect(user1)
          .mintPet(
            user1.address,
            "https://api.petverse.game/pets/1.json",
            0,
            0,
            50,
            30,
            40,
            100
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should batch mint multiple pets", async function () {
      const recipients = [user1.address, user2.address];
      const tokenURIs = [
        "https://api.petverse.game/pets/1.json",
        "https://api.petverse.game/pets/2.json",
      ];
      const tiers = [0, 1];
      const petTypes = [0, 1];

      await petNFT.batchMintPets(
        recipients,
        tokenURIs,
        tiers,
        petTypes,
        [50, 70], // attacks
        [30, 50], // defenses
        [40, 60], // speeds
        [100, 120] // healths
      );

      expect(await petNFT.ownerOf(0)).to.equal(user1.address);
      expect(await petNFT.ownerOf(1)).to.equal(user2.address);
    });
  });

  describe("Pet Metadata", function () {
    beforeEach(async function () {
      await petNFT.mintPet(
        owner.address,
        "https://api.petverse.game/pets/1.json",
        0,
        0,
        50,
        30,
        40,
        100
      );
    });

    it("Should return correct pet metadata", async function () {
      const metadata = await petNFT.getPetMetadata(0);

      expect(metadata.tier).to.equal(0);
      expect(metadata.petType).to.equal(0);
      expect(metadata.level).to.equal(1);
      expect(metadata.attack).to.equal(50);
      expect(metadata.defense).to.equal(30);
      expect(metadata.speed).to.equal(40);
      expect(metadata.health).to.equal(100);
    });

    it("Should calculate pet power", async function () {
      const power = await petNFT.calculatePower(0);
      expect(power).to.be.gt(0);
    });

    it("Should toggle favorite status", async function () {
      await petNFT.toggleFavorite(0);
      let metadata = await petNFT.getPetMetadata(0);
      expect(metadata.isFavorite).to.be.true;

      await petNFT.toggleFavorite(0);
      metadata = await petNFT.getPetMetadata(0);
      expect(metadata.isFavorite).to.be.false;
    });
  });

  describe("Leveling", function () {
    beforeEach(async function () {
      await petNFT.mintPet(
        owner.address,
        "https://api.petverse.game/pets/1.json",
        0,
        0,
        50,
        30,
        40,
        100
      );
    });

    it("Should add experience", async function () {
      await expect(petNFT.addExperience(0, 100))
        .to.emit(petNFT, "PetExperienceGained")
        .withArgs(0, 100, 100);

      const metadata = await petNFT.getPetMetadata(0);
      expect(metadata.experience).to.equal(100);
    });

    it("Should not allow non-owner to add experience", async function () {
      await expect(
        petNFT.connect(user1).addExperience(0, 100)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
