const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FusionSystem", function () {
  let FusionSystem;
  let PetNFT;
  let fusionSystem;
  let petNFT;
  let owner;
  let user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy PetNFT
    PetNFT = await ethers.getContractFactory("PetNFT");
    petNFT = await PetNFT.deploy();
    await petNFT.deployed();

    // Deploy FusionSystem
    FusionSystem = await ethers.getContractFactory("FusionSystem");
    fusionSystem = await FusionSystem.deploy(petNFT.address);
    await fusionSystem.deployed();

    // Mint test pets for fusion
    for (let i = 0; i < 3; i++) {
      await petNFT.mintPet(
        user.address,
        `https://api.petverse.game/pets/${i}.json`,
        0, // Common
        0, // Fire
        50,
        30,
        40,
        100
      );
    }
  });

  describe("Fusion Process", function () {
    it("Should start a fusion process", async function () {
      // Approve fusion system to transfer pets
      await petNFT.connect(user).setApprovalForAll(fusionSystem.address, true);

      const inputTokenIds = [0, 1];
      const targetTier = 1; // Uncommon
      const fusionCost = await fusionSystem.fusionCosts(targetTier);

      await expect(
        fusionSystem.connect(user).startFusion(inputTokenIds, targetTier, {
          value: fusionCost,
        })
      )
        .to.emit(fusionSystem, "FusionStarted")
        .withArgs(user.address, inputTokenIds, targetTier, 0);

      // Check pets transferred to fusion system
      expect(await petNFT.ownerOf(0)).to.equal(fusionSystem.address);
      expect(await petNFT.ownerOf(1)).to.equal(fusionSystem.address);

      // Check fusion request created
      const request = await fusionSystem.getFusionRequest(0);
      expect(request.user).to.equal(user.address);
      expect(request.inputTokenIds.length).to.equal(2);
      expect(request.targetTier).to.equal(targetTier);
      expect(request.completed).to.be.false;
    });

    it("Should not allow fusion with insufficient payment", async function () {
      await petNFT.connect(user).setApprovalForAll(fusionSystem.address, true);

      const inputTokenIds = [0, 1];
      const targetTier = 1;
      const fusionCost = await fusionSystem.fusionCosts(targetTier);
      const insufficientPayment = fusionCost.div(2);

      await expect(
        fusionSystem.connect(user).startFusion(inputTokenIds, targetTier, {
          value: insufficientPayment,
        })
      ).to.be.revertedWith("Insufficient fusion cost");
    });

    it("Should not allow fusion with unowned pets", async function () {
      const inputTokenIds = [0, 1];
      const targetTier = 1;
      const fusionCost = await fusionSystem.fusionCosts(targetTier);

      await expect(
        fusionSystem.connect(user).startFusion(inputTokenIds, targetTier, {
          value: fusionCost,
        })
      ).to.be.revertedWith("Not pet owner");
    });
  });

  describe("Fusion Completion", function () {
    beforeEach(async function () {
      await petNFT.connect(user).setApprovalForAll(fusionSystem.address, true);

      const inputTokenIds = [0, 1];
      const targetTier = 1;
      const fusionCost = await fusionSystem.fusionCosts(targetTier);

      await fusionSystem.connect(user).startFusion(inputTokenIds, targetTier, {
        value: fusionCost,
      });
    });

    it("Should complete successful fusion", async function () {
      const newTokenId = 100; // Mock new token ID

      await expect(
        fusionSystem.connect(owner).completeFusion(0, true, newTokenId)
      )
        .to.emit(fusionSystem, "FusionCompleted")
        .withArgs(user.address, 0, newTokenId, true, 1);

      const request = await fusionSystem.getFusionRequest(0);
      expect(request.completed).to.be.true;
      expect(request.success).to.be.true;
      expect(request.newTokenId).to.equal(newTokenId);
    });

    it("Should handle failed fusion", async function () {
      await expect(fusionSystem.connect(owner).completeFusion(0, false, 0))
        .to.emit(fusionSystem, "FusionFailed")
        .withArgs(user.address, 0, [0, 1]);

      const request = await fusionSystem.getFusionRequest(0);
      expect(request.completed).to.be.true;
      expect(request.success).to.be.false;
    });

    it("Should not allow non-owner to complete fusion", async function () {
      await expect(
        fusionSystem.connect(user).completeFusion(0, true, 100)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Utility Functions", function () {
    it("Should calculate success chance", async function () {
      const inputTokenIds = [0, 1];
      const targetTier = 1;
      const successChance = await fusionSystem.calculateSuccessChance(
        inputTokenIds,
        targetTier
      );

      expect(successChance).to.be.gt(0);
    });

    it("Should update fusion costs", async function () {
      const targetTier = 1;
      const newCost = ethers.utils.parseEther("0.002");

      await fusionSystem.updateFusionCost(targetTier, newCost);
      const updatedCost = await fusionSystem.fusionCosts(targetTier);

      expect(updatedCost).to.equal(newCost);
    });

    it("Should update success rates", async function () {
      const targetTier = 1;
      const newRate = 7000; // 70%

      await fusionSystem.updateSuccessRate(targetTier, newRate);
      const updatedRate = await fusionSystem.fusionSuccessRates(targetTier);

      expect(updatedRate).to.equal(newRate);
    });
  });
});
