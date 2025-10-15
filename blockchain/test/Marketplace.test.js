const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace", function () {
  let Marketplace;
  let PetNFT;
  let EggItem;
  let marketplace;
  let petNFT;
  let eggItem;
  let owner;
  let seller;
  let buyer;

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    // Deploy PetNFT
    PetNFT = await ethers.getContractFactory("PetNFT");
    petNFT = await PetNFT.deploy();
    await petNFT.deployed();

    // Deploy EggItem
    EggItem = await ethers.getContractFactory("EggItem");
    eggItem = await EggItem.deploy("https://api.petverse.game/api/metadata/");
    await eggItem.deployed();

    // Deploy Marketplace
    Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(petNFT.address, eggItem.address);
    await marketplace.deployed();

    // Mint test pets and eggs
    await petNFT.mintPet(
      seller.address,
      "https://api.petverse.game/pets/1.json",
      0,
      0,
      50,
      30,
      40,
      100
    );

    await eggItem.mintEgg(seller.address, 0, 5); // Basic eggs
  });

  describe("Listing", function () {
    it("Should list an ERC721 pet for sale", async function () {
      // Approve marketplace
      await petNFT.connect(seller).setApprovalForAll(marketplace.address, true);

      const price = ethers.utils.parseEther("0.01");

      await expect(marketplace.connect(seller).listItem(0, price, false, 1))
        .to.emit(marketplace, "ItemListed")
        .withArgs(
          seller.address,
          0,
          price,
          false,
          1,
          await ethers.provider.getBlockNumber()
        );

      const listing = await marketplace.getListing(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.price).to.equal(price);
      expect(listing.isActive).to.be.true;
    });

    it("Should list an ERC1155 egg for sale", async function () {
      // Approve marketplace
      await eggItem
        .connect(seller)
        .setApprovalForAll(marketplace.address, true);

      const price = ethers.utils.parseEther("0.001");
      const amount = 3;

      await expect(marketplace.connect(seller).listItem(0, price, true, amount))
        .to.emit(marketplace, "ItemListed")
        .withArgs(
          seller.address,
          0,
          price,
          true,
          amount,
          await ethers.provider.getBlockNumber()
        );

      const listing = await marketplace.getListing(0);
      expect(listing.seller).to.equal(seller.address);
      expect(listing.isERC1155).to.be.true;
      expect(listing.amount).to.equal(amount);
    });

    it("Should not allow listing without approval", async function () {
      const price = ethers.utils.parseEther("0.01");

      await expect(
        marketplace.connect(seller).listItem(0, price, false, 1)
      ).to.be.revertedWith("Not token owner");
    });

    it("Should not allow listing with zero price", async function () {
      await petNFT.connect(seller).setApprovalForAll(marketplace.address, true);

      await expect(
        marketplace.connect(seller).listItem(0, 0, false, 1)
      ).to.be.revertedWith("Price must be greater than 0");
    });
  });

  describe("Purchasing", function () {
    beforeEach(async function () {
      // Setup listing
      await petNFT.connect(seller).setApprovalForAll(marketplace.address, true);
      await eggItem
        .connect(seller)
        .setApprovalForAll(marketplace.address, true);

      const petPrice = ethers.utils.parseEther("0.01");
      await marketplace.connect(seller).listItem(0, petPrice, false, 1);

      const eggPrice = ethers.utils.parseEther("0.001");
      await marketplace.connect(seller).listItem(0, eggPrice, true, 3);
    });

    it("Should purchase an ERC721 pet", async function () {
      const listing = await marketplace.getListing(0);
      const purchasePrice = listing.price;

      await expect(
        marketplace.connect(buyer).purchaseItem(0, { value: purchasePrice })
      )
        .to.emit(marketplace, "ItemSold")
        .withArgs(
          seller.address,
          buyer.address,
          0,
          purchasePrice,
          await ethers.provider.getBlockNumber()
        );

      // Check NFT transfer
      expect(await petNFT.ownerOf(0)).to.equal(buyer.address);

      // Check listing deactivated
      const updatedListing = await marketplace.getListing(0);
      expect(updatedListing.isActive).to.be.false;
    });

    it("Should purchase ERC1155 eggs", async function () {
      const eggListingId = 0; // Same tokenId but different type
      const listing = await marketplace.getListing(eggListingId);
      const purchasePrice = listing.price;

      await marketplace
        .connect(buyer)
        .purchaseItem(eggListingId, { value: purchasePrice });

      // Check egg transfer
      expect(await eggItem.balanceOf(buyer.address, 0)).to.equal(3);
      expect(await eggItem.balanceOf(seller.address, 0)).to.equal(2); // 5 originally, 3 sold
    });

    it("Should not allow purchase with insufficient payment", async function () {
      const listing = await marketplace.getListing(0);
      const insufficientPrice = listing.price.div(2);

      await expect(
        marketplace.connect(buyer).purchaseItem(0, { value: insufficientPrice })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should not allow seller to purchase own item", async function () {
      const listing = await marketplace.getListing(0);

      await expect(
        marketplace.connect(seller).purchaseItem(0, { value: listing.price })
      ).to.be.revertedWith("Cannot purchase your own item");
    });
  });

  describe("Cancellation", function () {
    beforeEach(async function () {
      await petNFT.connect(seller).setApprovalForAll(marketplace.address, true);

      const price = ethers.utils.parseEther("0.01");
      await marketplace.connect(seller).listItem(0, price, false, 1);
    });

    it("Should cancel a listing", async function () {
      await expect(marketplace.connect(seller).cancelListing(0))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(seller.address, 0, await ethers.provider.getBlockNumber());

      const listing = await marketplace.getListing(0);
      expect(listing.isActive).to.be.false;
    });

    it("Should not allow non-seller to cancel", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(0)
      ).to.be.revertedWith("Not the seller");
    });
  });
});
