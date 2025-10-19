// server/config/populateSampleData.js
import { DatabaseService } from "../services/DatabaseService.js";
import { blockchainService } from "./blockchain.js";
import { Pet } from "../models/Pet.js";
import { Egg } from "../models/Egg.js";
import { User } from "../models/User.js";
import {
  PET_RARITIES,
  SKIN_RARITIES,
  EGG_TYPES,
  TECHNIQUES,
  PET_TYPES,
  ALL_ABILITIES,
} from "../utils/constants.js";
import mongoose from "mongoose";

// Import blockchain constants
import {
  ITEM_TYPES,
  EGG_TYPES as BLOCKCHAIN_EGG_TYPES,
  SKIN_TYPES as BLOCKCHAIN_SKIN_TYPES,
} from "./blockchain.js";

export class SampleDataPopulator {
  constructor() {
    this.dbService = new DatabaseService();
    this.blockchainService = blockchainService;
  }

  // Sample users data matching your User model
  sampleUsers = [
    {
      username: "ash_ketchum",
      email: "ash@pokemon.com",
      passwordHash: "hashed_password123",
      walletAddress: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1",
      balance: 1000,
      level: 25,
      experience: 12500,
      rank: "Advanced",
    },
    {
      username: "misty_water",
      email: "misty@cerulean.com",
      passwordHash: "hashed_password123",
      walletAddress: "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
      balance: 850,
      level: 22,
      experience: 9800,
      rank: "Intermediate",
    },
    {
      username: "brock_rock",
      email: "brock@pewter.com",
      passwordHash: "hashed_password123",
      walletAddress: "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
      balance: 720,
      level: 20,
      experience: 8200,
      rank: "Intermediate",
    },
    {
      username: "gary_oak",
      email: "gary@research.com",
      passwordHash: "hashed_password123",
      walletAddress: "0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
      balance: 1500,
      level: 28,
      experience: 16500,
      rank: "Expert",
    },
    {
      username: "serena_kalos",
      email: "serena@kalos.com",
      passwordHash: "hashed_password123",
      walletAddress: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5",
      balance: 920,
      level: 23,
      experience: 10500,
      rank: "Advanced",
    },
  ];

  // Sample pets data matching your Pet model structure AND blockchain metadata
  samplePets = [
    {
      name: "Pikachu",
      type: "ELECTRIC",
      rarity: "Rare",
      ability: "Static",
      technique: "Accelerate Lv.2",
      skin: "Shiny Variant",
      stats: {
        dmg: 55,
        hp: 35,
        range: 1,
        spa: 0.9,
        critChance: 0.1,
        critDamage: 1.5,
        moneyBonus: 0.05,
      },
      level: 5,
      experience: 250,
      evolutionStage: 1,
      evolutions: ["Raichu"],
      isShiny: true,
      // Blockchain metadata
      blockchainMetadata: {
        petType: "Electric",
        rarity: "Rare",
        level: 5,
        isShiny: true,
      },
    },
    {
      name: "Charizard",
      type: "FIRE",
      rarity: "Epic",
      ability: "Blaze",
      technique: "Sturdy Lv.3",
      skin: "Mega Evolution",
      stats: {
        dmg: 84,
        hp: 78,
        range: 2,
        spa: 1.2,
        critChance: 0.15,
        critDamage: 1.8,
        moneyBonus: 0.08,
      },
      level: 36,
      experience: 12500,
      evolutionStage: 3,
      evolutions: ["Charmander", "Charmeleon"],
      isShiny: false,
      blockchainMetadata: {
        petType: "Fire",
        rarity: "Epic",
        level: 36,
        isShiny: false,
      },
    },
    {
      name: "Blastoise",
      type: "WATER",
      rarity: "Epic",
      ability: "Torrent",
      technique: "Juggernaut",
      skin: null,
      stats: {
        dmg: 83,
        hp: 79,
        range: 1,
        spa: 1.1,
        critChance: 0.1,
        critDamage: 1.6,
        moneyBonus: 0.06,
      },
      level: 36,
      experience: 12000,
      evolutionStage: 3,
      evolutions: ["Squirtle", "Wartortle"],
      isShiny: false,
      blockchainMetadata: {
        petType: "Water",
        rarity: "Epic",
        level: 36,
        isShiny: false,
      },
    },
    {
      name: "Venusaur",
      type: "GRASS",
      rarity: "Epic",
      ability: "Overgrow",
      technique: "Elemental Master",
      skin: null,
      stats: {
        dmg: 82,
        hp: 80,
        range: 1,
        spa: 1.3,
        critChance: 0.12,
        critDamage: 1.7,
        moneyBonus: 0.07,
      },
      level: 36,
      experience: 11800,
      evolutionStage: 3,
      evolutions: ["Bulbasaur", "Ivysaur"],
      isShiny: false,
      blockchainMetadata: {
        petType: "Grass",
        rarity: "Epic",
        level: 36,
        isShiny: false,
      },
    },
    {
      name: "Gyarados",
      type: "WATER",
      rarity: "Rare",
      ability: "Intimidate",
      technique: "Hyper Speed",
      skin: "Red Variant",
      stats: {
        dmg: 125,
        hp: 95,
        range: 1,
        spa: 1.0,
        critChance: 0.08,
        critDamage: 1.4,
        moneyBonus: 0.04,
      },
      level: 30,
      experience: 8500,
      evolutionStage: 2,
      evolutions: ["Magikarp"],
      isShiny: false,
      blockchainMetadata: {
        petType: "Water",
        rarity: "Rare",
        level: 30,
        isShiny: false,
      },
    },
  ];

  // Sample techniques data matching blockchain structure
  sampleTechniques = [
    {
      name: "Thunderbolt Lv.2",
      rarity: "Rare",
      effect: "Electric damage +15%, chance to paralyze",
      type: "Technique",
      level: 2,
      // Blockchain metadata
      blockchainMetadata: {
        name: "Thunderbolt Lv.2",
        effect: "Electric damage +15%, chance to paralyze",
        level: 2,
        rarity: "Rare",
      },
    },
    {
      name: "Flamethrower Lv.3",
      rarity: "Epic",
      effect: "Fire damage +25%, chance to burn",
      type: "Technique",
      level: 3,
      blockchainMetadata: {
        name: "Flamethrower Lv.3",
        effect: "Fire damage +25%, chance to burn",
        level: 3,
        rarity: "Epic",
      },
    },
    {
      name: "Hydro Pump Lv.1",
      rarity: "Uncommon",
      effect: "Water damage +20%, lower accuracy",
      type: "Technique",
      level: 1,
      blockchainMetadata: {
        name: "Hydro Pump Lv.1",
        effect: "Water damage +20%, lower accuracy",
        level: 1,
        rarity: "Uncommon",
      },
    },
  ];

  // Sample skins data matching blockchain structure
  sampleSkins = [
    {
      name: "Shiny Variant",
      type: "Cosmetic",
      rarity: "Rare",
      effect: "Changes appearance to shiny version",
      applicableTo: ["All Pets"],
      // Blockchain metadata
      blockchainMetadata: {
        skinType: BLOCKCHAIN_SKIN_TYPES.CLASSIC_SKIN,
        name: "Shiny Variant",
        rarity: "Rare",
      },
    },
    {
      name: "Mega Evolution",
      type: "Evolution",
      rarity: "Epic",
      effect: "Temporarily evolves pet during battle",
      applicableTo: ["Charizard", "Lucario", "Mewtwo"],
      blockchainMetadata: {
        skinType: BLOCKCHAIN_SKIN_TYPES.EPIC_SKIN,
        name: "Mega Evolution",
        rarity: "Epic",
      },
    },
    {
      name: "Armored Form",
      type: "Defense",
      rarity: "Legendary",
      effect: "Increases defense stats and changes appearance",
      applicableTo: ["Mewtwo"],
      blockchainMetadata: {
        skinType: BLOCKCHAIN_SKIN_TYPES.LEGENDARY_SKIN,
        name: "Armored Form",
        rarity: "Legendary",
      },
    },
  ];

  async populateDatabase() {
    try {
      console.log(
        "🚀 Starting database population with Pet/Egg models and Blockchain integration..."
      );

      // Clear existing data
      await this.clearExistingData();

      // Create users using your User model
      const createdUsers = await this.createUsers();
      console.log(`✅ Created ${createdUsers.length} users`);

      // Create pets using your Pet model and mint blockchain NFTs
      const createdPets = await this.createPets(createdUsers);
      console.log(`✅ Created ${createdPets.length} pets`);

      // Create eggs using your Egg model and mint blockchain NFTs
      const createdEggs = await this.createEggs(createdUsers);
      console.log(`✅ Created ${createdEggs.length} eggs`);

      // Create techniques and mint blockchain NFTs
      const createdTechniques = await this.createTechniques(createdUsers);
      console.log(`✅ Created ${createdTechniques.length} techniques`);

      // Create skins and mint blockchain NFTs
      const createdSkins = await this.createSkins(createdUsers);
      console.log(`✅ Created ${createdSkins.length} skins`);

      // Create marketplace listings
      const createdListings = await this.createListings(
        createdUsers,
        createdPets,
        createdTechniques,
        createdSkins
      );
      console.log(`✅ Created ${createdListings.length} marketplace listings`);

      console.log("🎉 Database population completed successfully!");
      console.log("\n📊 Sample Data Summary:");
      console.log(`   👥 Users: ${createdUsers.length}`);
      console.log(`   🐾 Pets: ${createdPets.length}`);
      console.log(`   🥚 Eggs: ${createdEggs.length}`);
      console.log(`   🔮 Techniques: ${createdTechniques.length}`);
      console.log(`   🎨 Skins: ${createdSkins.length}`);
      console.log(`   🏪 Listings: ${createdListings.length}`);

      return {
        users: createdUsers,
        pets: createdPets,
        eggs: createdEggs,
        techniques: createdTechniques,
        skins: createdSkins,
        listings: createdListings,
      };
    } catch (error) {
      console.error("❌ Error populating database:", error);
      throw error;
    }
  }

  async clearExistingData() {
    const models = mongoose.models;
    await models.User.deleteMany({});
    await models.Pet.deleteMany({});
    await models.Egg.deleteMany({});
    await models.Technique.deleteMany({});
    await models.Skin.deleteMany({});
    await models.Listing.deleteMany({});
    console.log("🧹 Cleared existing data");
  }

  async createUsers() {
    const createdUsers = [];
    for (const userData of this.sampleUsers) {
      // Create user using your User model
      const user = new User(userData);
      const savedUser = await this.dbService.createUser(user.toJSON());
      createdUsers.push(savedUser);
    }
    return createdUsers;
  }

  async createPets(users) {
    const createdPets = [];

    // Distribute pets among users
    const petsPerUser = Math.floor(this.samplePets.length / users.length);

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const startIdx = i * petsPerUser;
      const endIdx =
        i === users.length - 1
          ? this.samplePets.length
          : startIdx + petsPerUser;

      const userPets = this.samplePets.slice(startIdx, endIdx);

      for (const petData of userPets) {
        try {
          // Create pet using your Pet model
          const pet = new Pet({
            ...petData,
            ownerId: user._id || user.id,
            currentHP: petData.stats.hp,
            isAlive: true,
            statusEffects: [],
            title: null,
            // Blockchain integration
            tokenId: null, // Will be set after minting
            nftContract: "PetNFT", // Reference to the contract
            blockchainMetadata: petData.blockchainMetadata,
          });

          // Convert to plain object for database storage
          const petObject = pet.toJSON();
          const savedPet = await this.dbService.createPet(petObject);

          // Mint blockchain NFT for the pet
          if (user.walletAddress) {
            const mintResult = await this.blockchainService.mintPetNFT(
              user.walletAddress,
              petData.blockchainMetadata
            );

            if (mintResult.success) {
              // Update pet with blockchain token ID
              await this.dbService.updatePet(savedPet._id || savedPet.id, {
                tokenId: mintResult.tokenId,
                nftContract: "PetNFT",
              });
              savedPet.tokenId = mintResult.tokenId;
            }
          }

          createdPets.push(savedPet);
        } catch (error) {
          console.error(`Error creating pet ${petData.name}:`, error);
        }
      }
    }

    return createdPets;
  }

  async createEggs(users) {
    const createdEggs = [];
    const eggTypes = [EGG_TYPES.BASIC, EGG_TYPES.COSMETIC, EGG_TYPES.ATTRIBUTE];

    for (const user of users) {
      // Each user gets 2-3 eggs of different types
      const eggCount = Math.floor(Math.random() * 2) + 2;

      for (let i = 0; i < eggCount; i++) {
        const eggType = eggTypes[Math.floor(Math.random() * eggTypes.length)];

        try {
          // Create egg using your Egg model
          const egg = new Egg(eggType, user._id || user.id);

          // Convert to database format
          const eggData = {
            type: egg.type,
            ownerId: egg.ownerId,
            isHatched: egg.isHatched,
            contents: egg.contents,
            createdAt: new Date(),
            updatedAt: new Date(),
            // Blockchain integration
            tokenId: null,
            nftContract: "EggNFT",
            blockchainMetadata: {
              eggType: this.mapEggTypeToBlockchain(eggType),
              amount: 1,
            },
          };

          const savedEgg = await this.dbService.createEgg(eggData);

          // Mint blockchain NFT for the egg
          if (user.walletAddress) {
            const blockchainEggType = this.mapEggTypeToBlockchain(eggType);
            const mintResult = await this.blockchainService.mintEggNFT(
              user.walletAddress,
              blockchainEggType,
              1
            );

            if (mintResult.success) {
              await this.dbService.updateEgg(savedEgg._id || savedEgg.id, {
                tokenId: blockchainEggType, // For ERC1155, tokenId is the egg type
                nftContract: "EggNFT",
              });
              savedEgg.tokenId = blockchainEggType;
            }
          }

          createdEggs.push(savedEgg);
        } catch (error) {
          console.error(`Error creating egg for user ${user.username}:`, error);
        }
      }
    }

    return createdEggs;
  }

  async createTechniques(users) {
    const createdTechniques = [];

    for (const user of users) {
      // Each user gets 1-2 techniques
      const techCount = Math.floor(Math.random() * 2) + 1;

      for (let i = 0; i < techCount; i++) {
        try {
          const techniqueData =
            this.sampleTechniques[
              Math.floor(Math.random() * this.sampleTechniques.length)
            ];

          const technique = {
            ...techniqueData,
            ownerId: user._id || user.id,
            obtainedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            // Blockchain integration
            tokenId: null,
            nftContract: "TechniqueNFT",
            blockchainMetadata: techniqueData.blockchainMetadata,
          };

          // Save technique using mongoose model
          const TechniqueModel = mongoose.models.Technique;
          const savedTechnique = await new TechniqueModel(technique).save();

          // Mint blockchain NFT for the technique
          if (user.walletAddress) {
            const mintResult = await this.blockchainService.mintTechniqueNFT(
              user.walletAddress,
              techniqueData.blockchainMetadata
            );

            if (mintResult.success) {
              await TechniqueModel.findByIdAndUpdate(savedTechnique._id, {
                tokenId: mintResult.tokenId,
                nftContract: "TechniqueNFT",
              });
              savedTechnique.tokenId = mintResult.tokenId;
            }
          }

          // Add to user's techniques
          await this.dbService.updateUser(user._id || user.id, {
            $push: { techniqueIds: savedTechnique._id },
          });

          createdTechniques.push(savedTechnique);
        } catch (error) {
          console.error(
            `Error creating technique for user ${user.username}:`,
            error
          );
        }
      }
    }

    return createdTechniques;
  }

  async createSkins(users) {
    const createdSkins = [];

    for (const user of users) {
      // Each user gets 1 skin
      try {
        const skinData =
          this.sampleSkins[Math.floor(Math.random() * this.sampleSkins.length)];

        const skin = {
          ...skinData,
          ownerId: user._id || user.id,
          obtainedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          // Blockchain integration
          tokenId: null,
          nftContract: "SkinNFT",
          blockchainMetadata: skinData.blockchainMetadata,
        };

        // Save skin using mongoose model
        const SkinModel = mongoose.models.Skin;
        const savedSkin = await new SkinModel(skin).save();

        // Mint blockchain NFT for the skin
        if (user.walletAddress) {
          const mintResult = await this.blockchainService.mintSkinNFT(
            user.walletAddress,
            skinData.blockchainMetadata.skinType,
            1,
            skinData.blockchainMetadata.name
          );

          if (mintResult.success) {
            await SkinModel.findByIdAndUpdate(savedSkin._id, {
              tokenId: skinData.blockchainMetadata.skinType, // For ERC1155, tokenId is the skin type
              nftContract: "SkinNFT",
            });
            savedSkin.tokenId = skinData.blockchainMetadata.skinType;
          }
        }

        // Add to user's skins
        await this.dbService.updateUser(user._id || user.id, {
          $push: { skinIds: savedSkin._id },
        });

        createdSkins.push(savedSkin);
      } catch (error) {
        console.error(`Error creating skin for user ${user.username}:`, error);
      }
    }

    return createdSkins;
  }

  async createListings(users, pets, techniques, skins) {
    const createdListings = [];

    // Create marketplace listings for different item types
    const listingCount = Math.floor(Math.random() * 5) + 3;

    for (let i = 0; i < listingCount; i++) {
      const seller = users[Math.floor(Math.random() * users.length)];

      try {
        let listingData;
        const itemTypeChoice = Math.floor(Math.random() * 4); // 0-3 for different item types

        switch (itemTypeChoice) {
          case 0: // Pet listing
            const availablePets = pets.filter(
              (p) =>
                p.ownerId.toString() === (seller._id || seller.id).toString() &&
                !p.isListed &&
                p.tokenId
            );

            if (availablePets.length > 0) {
              const pet =
                availablePets[Math.floor(Math.random() * availablePets.length)];

              listingData = {
                sellerId: seller._id || seller.id,
                itemId: pet._id || pet.id,
                itemType: "Pet",
                price: Math.floor(Math.random() * 500) + 100,
                currency: "GEM",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                // Blockchain listing
                blockchainListingId: null,
                nftContract: "PetNFT",
                tokenId: pet.tokenId,
                amount: 1,
              };

              // Create blockchain listing
              const blockchainResult = await this.blockchainService.listItem(
                "PetNFT", // nftContract
                ITEM_TYPES.PET, // itemType
                pet.tokenId,
                1, // amount
                (listingData.price * 0.001).toFixed(4) // Convert gems to ETH equivalent
              );

              if (blockchainResult.success) {
                listingData.blockchainListingId = blockchainResult.listingId;
              }
            }
            break;

          case 1: // Technique listing
            const userTechniques = techniques.filter(
              (t) =>
                t.ownerId.toString() === (seller._id || seller.id).toString() &&
                t.tokenId
            );

            if (userTechniques.length > 0) {
              const technique =
                userTechniques[
                  Math.floor(Math.random() * userTechniques.length)
                ];

              listingData = {
                sellerId: seller._id || seller.id,
                itemId: technique._id || technique.id,
                itemType: "Technique",
                price: Math.floor(Math.random() * 200) + 50,
                currency: "GEM",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                // Blockchain listing
                blockchainListingId: null,
                nftContract: "TechniqueNFT",
                tokenId: technique.tokenId,
                amount: 1,
              };

              const blockchainResult = await this.blockchainService.listItem(
                "TechniqueNFT",
                ITEM_TYPES.TECHNIQUE,
                technique.tokenId,
                1,
                (listingData.price * 0.001).toFixed(4)
              );

              if (blockchainResult.success) {
                listingData.blockchainListingId = blockchainResult.listingId;
              }
            }
            break;

          case 2: // Skin listing
            const userSkins = skins.filter(
              (s) =>
                s.ownerId.toString() === (seller._id || seller.id).toString() &&
                s.tokenId
            );

            if (userSkins.length > 0) {
              const skin =
                userSkins[Math.floor(Math.random() * userSkins.length)];

              listingData = {
                sellerId: seller._id || seller.id,
                itemId: skin._id || skin.id,
                itemType: "Skin",
                price: Math.floor(Math.random() * 300) + 75,
                currency: "GEM",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date(),
                // Blockchain listing
                blockchainListingId: null,
                nftContract: "SkinNFT",
                tokenId: skin.tokenId,
                amount: 1,
              };

              const blockchainResult = await this.blockchainService.listItem(
                "SkinNFT",
                ITEM_TYPES.SKIN,
                skin.tokenId,
                1,
                (listingData.price * 0.001).toFixed(4)
              );

              if (blockchainResult.success) {
                listingData.blockchainListingId = blockchainResult.listingId;
              }
            }
            break;
        }

        if (listingData) {
          const listing = await this.dbService.createListing(listingData);

          // Mark item as listed
          if (listingData.itemType === "Pet") {
            await this.dbService.updatePet(listingData.itemId, {
              isListed: true,
            });
          }

          createdListings.push(listing);
        }
      } catch (error) {
        console.error(
          `Error creating listing for user ${seller.username}:`,
          error
        );
      }
    }

    return createdListings;
  }

  // Helper method to map app egg types to blockchain egg types
  mapEggTypeToBlockchain(appEggType) {
    const mapping = {
      [EGG_TYPES.BASIC]: BLOCKCHAIN_EGG_TYPES.BASIC_EGG,
      [EGG_TYPES.COSMETIC]: BLOCKCHAIN_EGG_TYPES.COSMETIC_EGG,
      [EGG_TYPES.ATTRIBUTE]: BLOCKCHAIN_EGG_TYPES.ATTRIBUTE_EGG,
    };
    return mapping[appEggType] || BLOCKCHAIN_EGG_TYPES.BASIC_EGG;
  }

  // Utility to hatch some eggs for demo
  async hatchSomeEggs(users) {
    console.log("🐣 Hatching some eggs for demo...");

    for (const user of users) {
      const userEggs = await this.dbService.getUserEggs(user._id || user.id);
      const eggsToHatch = userEggs.slice(0, 1); // Hatch first egg for each user

      for (const egg of eggsToHatch) {
        try {
          const eggInstance = new Egg(egg.type, egg.ownerId);
          const result = eggInstance.hatch();

          // Process hatch result based on your Egg class logic
          if (result instanceof Pet) {
            await this.dbService.createPet({
              ...result.toJSON(),
              ownerId: user._id || user.id,
            });
          } else if (result.type === "Technique") {
            const TechniqueModel = mongoose.models.Technique;
            const technique = await new TechniqueModel({
              ...result,
              ownerId: user._id || user.id,
            }).save();

            await this.dbService.updateUser(user._id || user.id, {
              $push: { techniqueIds: technique._id },
            });
          } else if (result.type === "Cosmetic") {
            const SkinModel = mongoose.models.Skin;
            const skin = await new SkinModel({
              ...result,
              ownerId: user._id || user.id,
            }).save();

            await this.dbService.updateUser(user._id || user.id, {
              $push: { skinIds: skin._id },
            });
          }

          // Remove hatched egg and burn blockchain NFT
          if (egg.tokenId) {
            await this.blockchainService.burnEggNFT(
              user.walletAddress,
              egg.tokenId,
              1
            );
          }

          await mongoose.models.Egg.findByIdAndDelete(egg._id);
        } catch (error) {
          console.log(
            `Couldn't hatch egg for user ${user.username}:`,
            error.message
          );
        }
      }
    }
  }

  // Display sample data info
  displaySampleDataInfo() {
    console.log("\n📋 Available Sample Data:");
    console.log(`   👤 Users: ${this.sampleUsers.length} sample users`);
    console.log(`   🐾 Pets: ${this.samplePets.length} sample pets`);
    console.log(`   🥚 Egg Types: ${Object.values(EGG_TYPES).length} types`);
    console.log(
      `   🔮 Techniques: ${this.sampleTechniques.length} sample techniques`
    );
    console.log(`   🎨 Skins: ${this.sampleSkins.length} cosmetic skins`);
    console.log(`   🎯 Rarities: ${PET_RARITIES.length} pet rarities`);
    console.log(
      `   🌈 Types: ${Object.keys(PET_TYPES).length} elemental types`
    );
    console.log(
      `   ⛓️  Blockchain Integration: Full NFT minting & marketplace`
    );
  }
}

// Standalone function to run the population
export async function populateSampleData() {
  const populator = new SampleDataPopulator();

  try {
    populator.displaySampleDataInfo();
    const result = await populator.populateDatabase();

    // Optional: Hatch some eggs to demonstrate the hatching system
    await populator.hatchSomeEggs(result.users);
    console.log("🥚 Demo egg hatching completed!");

    return result;
  } catch (error) {
    console.error("Failed to populate sample data:", error);
    throw error;
  }
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  import("../config/database.js").then(async (dbConfig) => {
    await dbConfig.connectToDatabase();
    await populateSampleData();
    process.exit(0);
  });
}
