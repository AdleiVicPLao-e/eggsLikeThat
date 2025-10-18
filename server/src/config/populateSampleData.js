// server/config/populateSampleData.js
import { DatabaseService } from "../services/DatabaseService.js";
import { BlockchainSimulationService } from "../services/BlockchainSimulationService.js";
import { Pet } from "../models/Pet.js";
import { Egg } from "../models/Egg.js";
import { User } from "../models/User.js";
import {
  PET_RARITIES,
  SKIN_RARITIES,
  EGG_TYPES,
  TECHNIQUES,
  TYPES,
  ALL_ABILITIES,
} from "../utils/constants.js";
import mongoose from "mongoose";

export class SampleDataPopulator {
  constructor() {
    this.dbService = new DatabaseService();
    this.blockchainService = new BlockchainSimulationService();
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

  // Sample pets data matching your Pet model structure
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
    },
    {
      name: "Lucario",
      type: "FIGHTING",
      rarity: "Legendary",
      ability: "Steadfast",
      technique: "Cosmic",
      skin: "Mega Evolution",
      stats: {
        dmg: 110,
        hp: 70,
        range: 1,
        spa: 0.8,
        critChance: 0.2,
        critDamage: 2.0,
        moneyBonus: 0.1,
      },
      level: 42,
      experience: 18500,
      evolutionStage: 2,
      evolutions: ["Riolu"],
      isShiny: true,
    },
    {
      name: "Greninja",
      type: "WATER",
      rarity: "Legendary",
      ability: "Torrent",
      technique: "Shinigami",
      skin: "Ash-Greninja",
      stats: {
        dmg: 95,
        hp: 72,
        range: 1,
        spa: 0.7,
        critChance: 0.18,
        critDamage: 1.9,
        moneyBonus: 0.09,
      },
      level: 40,
      experience: 16500,
      evolutionStage: 3,
      evolutions: ["Froakie", "Frogadier"],
      isShiny: false,
    },
    {
      name: "Eevee",
      type: "NORMAL",
      rarity: "Uncommon",
      ability: "Adaptability",
      technique: "Shining",
      skin: null,
      stats: {
        dmg: 55,
        hp: 55,
        range: 1,
        spa: 1.0,
        critChance: 0.05,
        critDamage: 1.3,
        moneyBonus: 0.03,
      },
      level: 15,
      experience: 2500,
      evolutionStage: 1,
      evolutions: [
        "Vaporeon",
        "Jolteon",
        "Flareon",
        "Espeon",
        "Umbreon",
        "Leafeon",
        "Glaceon",
        "Sylveon",
      ],
      isShiny: false,
    },
    {
      name: "Dragonite",
      type: "DRAGON",
      rarity: "Mythic",
      ability: "Inner Focus",
      technique: "Demi God",
      skin: null,
      stats: {
        dmg: 134,
        hp: 91,
        range: 2,
        spa: 1.4,
        critChance: 0.25,
        critDamage: 2.2,
        moneyBonus: 0.12,
      },
      level: 55,
      experience: 28500,
      evolutionStage: 3,
      evolutions: ["Dratini", "Dragonair"],
      isShiny: false,
    },
    {
      name: "Mewtwo",
      type: "PSYCHIC",
      rarity: "Godly",
      ability: "Pressure",
      technique: "Overlord",
      skin: "Armored Form",
      stats: {
        dmg: 110,
        hp: 106,
        range: 3,
        spa: 0.6,
        critChance: 0.3,
        critDamage: 2.5,
        moneyBonus: 0.15,
      },
      level: 70,
      experience: 45000,
      evolutionStage: 1,
      evolutions: [],
      isShiny: false,
    },
  ];

  // Sample techniques data
  sampleTechniques = [
    {
      name: "Thunderbolt Lv.2",
      rarity: "Rare",
      effect: "Electric damage +15%, chance to paralyze",
      type: "Technique",
    },
    {
      name: "Flamethrower Lv.3",
      rarity: "Epic",
      effect: "Fire damage +25%, chance to burn",
      type: "Technique",
    },
    {
      name: "Hydro Pump Lv.1",
      rarity: "Uncommon",
      effect: "Water damage +20%, lower accuracy",
      type: "Technique",
    },
    {
      name: "Solar Beam Lv.2",
      rarity: "Rare",
      effect: "Grass damage +30%, requires charge turn",
      type: "Technique",
    },
    {
      name: "Dragon Claw Lv.1",
      rarity: "Uncommon",
      effect: "Dragon damage +25%, high critical chance",
      type: "Technique",
    },
  ];

  // Sample skins data
  sampleSkins = [
    {
      name: "Shiny Variant",
      type: "Cosmetic",
      rarity: "Rare",
      effect: "Changes appearance to shiny version",
      applicableTo: ["All Pets"],
    },
    {
      name: "Mega Evolution",
      type: "Evolution",
      rarity: "Epic",
      effect: "Temporarily evolves pet during battle",
      applicableTo: ["Charizard", "Lucario", "Mewtwo"],
    },
    {
      name: "Armored Form",
      type: "Defense",
      rarity: "Legendary",
      effect: "Increases defense stats and changes appearance",
      applicableTo: ["Mewtwo"],
    },
    {
      name: "Ash-Greninja",
      type: "Battle",
      rarity: "Mythic",
      effect: "Transforms Greninja into special battle form",
      applicableTo: ["Greninja"],
    },
  ];

  async populateDatabase() {
    try {
      console.log("🚀 Starting database population with Pet/Egg models...");

      // Clear existing data
      await this.clearExistingData();

      // Create users using your User model
      const createdUsers = await this.createUsers();
      console.log(`✅ Created ${createdUsers.length} users`);

      // Create pets using your Pet model
      const createdPets = await this.createPets(createdUsers);
      console.log(`✅ Created ${createdPets.length} pets`);

      // Create eggs using your Egg model
      const createdEggs = await this.createEggs(createdUsers);
      console.log(`✅ Created ${createdEggs.length} eggs`);

      // Create techniques
      const createdTechniques = await this.createTechniques(createdUsers);
      console.log(`✅ Created ${createdTechniques.length} techniques`);

      // Create skins
      const createdSkins = await this.createSkins(createdUsers);
      console.log(`✅ Created ${createdSkins.length} skins`);

      // Create marketplace listings
      const createdListings = await this.createListings(
        createdUsers,
        createdPets
      );
      console.log(`✅ Created ${createdListings.length} marketplace listings`);

      // Simulate blockchain NFTs
      await this.createBlockchainNFTs(createdUsers, createdPets);
      console.log("✅ Created blockchain NFT records");

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
        // Create pet using your Pet model
        const pet = new Pet({
          ...petData,
          ownerId: user._id || user.id,
          currentHP: petData.stats.hp,
          isAlive: true,
          statusEffects: [],
          title: null,
        });

        // Convert to plain object for database storage
        const petObject = pet.toJSON();
        const savedPet = await this.dbService.createPet(petObject);
        createdPets.push(savedPet);
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
        };

        const savedEgg = await this.dbService.createEgg(eggData);
        createdEggs.push(savedEgg);
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
        };

        // Save technique using mongoose model
        const TechniqueModel = mongoose.models.Technique;
        const savedTechnique = await new TechniqueModel(technique).save();

        // Add to user's techniques
        await this.dbService.updateUser(user._id || user.id, {
          $push: { techniqueIds: savedTechnique._id },
        });

        createdTechniques.push(savedTechnique);
      }
    }

    return createdTechniques;
  }

  async createSkins(users) {
    const createdSkins = [];

    for (const user of users) {
      // Each user gets 1 skin
      const skinData =
        this.sampleSkins[Math.floor(Math.random() * this.sampleSkins.length)];
      const skin = {
        ...skinData,
        ownerId: user._id || user.id,
        obtainedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save skin using mongoose model
      const SkinModel = mongoose.models.Skin;
      const savedSkin = await new SkinModel(skin).save();

      // Add to user's skins
      await this.dbService.updateUser(user._id || user.id, {
        $push: { skinIds: savedSkin._id },
      });

      createdSkins.push(savedSkin);
    }

    return createdSkins;
  }

  async createListings(users, pets) {
    const createdListings = [];

    // Create 3-5 marketplace listings from different users
    const listingCount = Math.floor(Math.random() * 3) + 3;

    for (let i = 0; i < listingCount; i++) {
      const seller = users[Math.floor(Math.random() * users.length)];
      const availablePets = pets.filter(
        (p) =>
          p.ownerId.toString() === (seller._id || seller.id).toString() &&
          !p.isListed
      );

      if (availablePets.length > 0) {
        const pet =
          availablePets[Math.floor(Math.random() * availablePets.length)];

        const listing = await this.dbService.createListing({
          sellerId: seller._id || seller.id,
          itemId: pet._id || pet.id,
          itemType: "Pet",
          price: Math.floor(Math.random() * 500) + 100,
          currency: "GEM",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Mark pet as listed
        await this.dbService.updatePet(pet._id || pet.id, { isListed: true });

        createdListings.push(listing);
      }
    }

    return createdListings;
  }

  async createBlockchainNFTs(users, pets) {
    // Create blockchain NFT records for some pets
    for (const pet of pets.slice(0, 5)) {
      // First 5 pets get blockchain NFTs
      const owner = users.find(
        (u) => (u._id || u.id).toString() === pet.ownerId.toString()
      );
      if (owner) {
        await this.blockchainService.mintNFT(owner.walletAddress, "Pet", {
          name: pet.name,
          species: pet.type,
          rarity: pet.rarity,
          level: pet.level,
          tokenId: pet._id || pet.id,
        });
      }
    }
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

          // Remove hatched egg
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
    console.log(`   🌈 Types: ${Object.keys(TYPES).length} elemental types`);
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
