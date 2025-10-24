// src/controllers/GameController.js
import { ethers } from "ethers";
import { DatabaseService } from "../services/DatabaseService.js";
import { serverRNGService } from "../services/RNGService.js";
import { rewardService } from "../services/RewardService.js";
import { mailService } from "../services/MailService.js";
import { blockchainService } from "../config/blockchain.js";
import {
  scheduleRounds,
  evaluateTurn,
  generateSmartAttack,
  recoverPokemon,
  validateBattleTeam,
  calculateBattleRewards,
  getEffectiveStats,
  canUseAbility,
  useAbility,
  processCooldowns,
  processStatusEffects,
} from "../config/battleLogic.js";
import { ALL_ABILITIES, isOnePlacementTechnique } from "../utils/constants.js";
import logger from "../utils/logger.js";
import { config } from "../config/env.js";

const dbService = new DatabaseService();

export const GameController = {
  // Hatch an egg with blockchain integration
  async hatchEgg(req, res) {
    try {
      const userId = req.user.id;
      const { eggId, useFreeRoll = false } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if using free roll or has enough balance
      const hatchCost = 100;
      if (useFreeRoll) {
        const lastFreeHatch = user.lastFreeHatch || new Date(0);
        const hoursSinceLastFree =
          (new Date() - lastFreeHatch) / (1000 * 60 * 60);

        if (hoursSinceLastFree < 24) {
          return res.status(400).json({
            success: false,
            message: "Free hatch available once every 24 hours",
          });
        }
      } else {
        if (user.balance < hatchCost) {
          return res.status(400).json({
            success: false,
            message: `Not enough balance to hatch egg. Cost: ${hatchCost}, You have: ${user.balance}`,
          });
        }
      }

      let eggToHatch;
      if (eggId) {
        // Hatch specific egg - check blockchain ownership
        const eggs = await dbService.getUserEggs(userId);
        eggToHatch = eggs.find((egg) => egg._id.toString() === eggId);
        if (!eggToHatch) {
          return res.status(404).json({
            success: false,
            message: "Egg not found in your collection",
          });
        }
        if (eggToHatch.isHatched) {
          return res.status(400).json({
            success: false,
            message: "Egg has already been hatched",
          });
        }

        // Verify blockchain ownership for specific egg
        if (eggToHatch.blockchainId && user.walletAddress) {
          const isOwner = await blockchainService.verifyEggOwnership(
            user.walletAddress,
            eggToHatch.blockchainId
          );
          if (!isOwner) {
            return res.status(403).json({
              success: false,
              message: "You don't own this egg on the blockchain",
            });
          }
        }
      } else {
        // Create and hatch a basic egg
        const eggData = serverRNGService.generateEggForDB(userId);
        eggToHatch = await dbService.createEgg(eggData);
      }

      // Hatch the egg
      const hatchResult = await dbService.hatchEgg(eggToHatch._id);

      // Mint NFT for hatched pet if it's a pet and user has wallet
      if (hatchResult.type === "Pet" && user.walletAddress) {
        try {
          const mintResult = await blockchainService.mintPetNFT(
            user.walletAddress,
            hatchResult.name,
            hatchResult.type,
            hatchResult.rarity,
            hatchResult.isShiny || false
          );

          if (mintResult.success) {
            // Update pet with blockchain info
            await dbService.updatePet(hatchResult._id, {
              blockchainId: mintResult.tokenId,
              blockchainNetwork: "polygon",
              tokenURI: mintResult.tokenURI,
            });

            hatchResult.blockchainId = mintResult.tokenId;
            hatchResult.isOnChain = true;
          } else {
            logger.warn(
              `Failed to mint NFT for pet ${hatchResult._id}:`,
              mintResult.error
            );
            hatchResult.isOnChain = false;
          }
        } catch (blockchainError) {
          logger.error("Blockchain minting error:", blockchainError);
          hatchResult.isOnChain = false;
        }
      }

      // Update user balance and track free hatch
      if (useFreeRoll) {
        await dbService.updateUser(userId, { lastFreeHatch: new Date() });
      } else {
        await dbService.updateUserBalance(userId, -hatchCost);
      }

      // Add experience for hatching
      await dbService.updateUserExperience(userId, 25);

      // Get updated user
      const updatedUser = await dbService.findUserById(userId);

      logger.info(`User ${user.username} hatched an egg`);

      const responseData = {
        success: true,
        message: "Egg hatched successfully!",
        data: {
          result: this.formatHatchResult(hatchResult),
          user: {
            balance: updatedUser.balance,
            eggs: updatedUser.eggIds?.length || 0,
            pets: updatedUser.petIds?.length || 0,
            techniques: updatedUser.techniqueIds?.length || 0,
            skins: updatedUser.skinIds?.length || 0,
            level: updatedUser.level,
            experience: updatedUser.experience,
            walletConnected: !!updatedUser.walletAddress,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Hatch egg error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during egg hatching",
      });
    }
  },

  // Start a battle with blockchain verification
  async startBattle(req, res) {
    try {
      const userId = req.user.id;
      let {
        petIds,
        battleMode = "pve",
        opponentDifficulty = "medium",
        maxPets = 3,
      } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Validate user's pets
      const userPets = user.pets
        .filter((pet) => petIds.includes(pet.id))
        .slice(0, maxPets);

      if (userPets.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid pets selected for battle",
        });
      }

      // Verify blockchain ownership for all pets
      if (user.walletAddress) {
        for (const pet of userPets) {
          if (pet.blockchainId) {
            const isOwner = await blockchainService.verifyPetOwnership(
              user.walletAddress,
              pet.blockchainId,
              pet.blockchainNetwork || "polygon"
            );
            if (!isOwner) {
              return res.status(403).json({
                success: false,
                message: `You don't own pet "${pet.name}" on the blockchain`,
              });
            }
          }
        }
      }

      // Check for ONE PLACEMENT technique
      const onePlacementPets = userPets.filter(
        (pet) => pet.technique && isOnePlacementTechnique(pet.technique)
      );

      // If any pet has one placement technique, user can only use that ONE pet
      if (onePlacementPets.length > 0) {
        if (userPets.length > 1) {
          return res.status(400).json({
            success: false,
            message: `Pet "${onePlacementPets[0].name}" has ${onePlacementPets[0].technique} technique (ONE PLACEMENT) and must battle alone. Please send only this pet to battle.`,
          });
        }

        // If user sent only the one placement pet, adjust opponent team to 1 pet
        maxPets = 1;
      }

      // Use validateBattleTeam from battleLogic
      const teamValidation = validateBattleTeam(userPets);
      if (!teamValidation.valid) {
        return res.status(400).json({
          success: false,
          message: teamValidation.error,
        });
      }

      // Generate opponent team with abilities
      const opponentPets = await this.generateOpponentTeam(
        opponentDifficulty,
        userPets,
        maxPets
      );

      // Convert pets to battle format
      const playerTeam = this.convertPetsToBattleFormat(
        userPets,
        user.username
      );
      const opponentTeam = this.convertPetsToBattleFormat(
        opponentPets,
        `${opponentDifficulty} Opponent`
      );

      // Simulate round-robin battle using scheduleRounds
      const battleResult = await this.simulateRoundRobinBattle(
        playerTeam,
        opponentTeam,
        battleMode
      );

      // Apply rewards using calculateBattleRewards
      const opponentLevel = this.getOpponentLevel(
        opponentDifficulty,
        user.level
      );

      // Calculate base rewards
      const baseReward = this.calculateBaseBattleRewards(
        opponentLevel,
        battleResult.winner === "player",
        battleMode,
        userPets.length
      );

      // Use calculateBattleRewards from battleLogic for technique bonuses
      const winningPets = battleResult.winner === "player" ? userPets : [];
      const enhancedRewards = calculateBattleRewards(baseReward, winningPets);

      // Update user stats
      if (enhancedRewards.coins > 0) {
        await dbService.updateUserBalance(userId, enhancedRewards.coins);
      }
      if (enhancedRewards.experience > 0) {
        await dbService.updateUserExperience(
          userId,
          enhancedRewards.experience
        );
      }

      // Update user battle stats
      const updateData = { updatedAt: new Date() };
      if (battleResult.winner === "player") {
        updateData.battlesWon = (user.battlesWon || 0) + 1;
      } else {
        updateData.battlesLost = (user.battlesLost || 0) + 1;
      }
      await dbService.updateUser(userId, updateData);

      // Update pet battle stats and experience
      for (const pet of userPets) {
        const petWins = battleResult.battleLog.filter(
          (match) =>
            match.playerPet === pet.id && match.result.winner === "player"
        ).length;

        const petUpdate = {
          battlesWon: (pet.battlesWon || 0) + petWins,
          battlesLost:
            (pet.battlesLost || 0) + (battleResult.totalRounds - petWins),
          experience:
            (pet.experience || 0) +
            Math.floor(enhancedRewards.experience / userPets.length),
          updatedAt: new Date(),
        };

        // Check for pet level up
        const levelUpResult = await this.checkPetLevelUp({
          ...pet,
          ...petUpdate,
        });
        if (levelUpResult.leveledUp) {
          petUpdate.level = levelUpResult.newLevel;
          petUpdate.stats = levelUpResult.newStats;
          petUpdate.experience = petUpdate.experience - levelUpResult.expNeeded;

          // Update blockchain if pet leveled up
          if (pet.blockchainId && user.walletAddress) {
            try {
              await blockchainService.levelUpPet(
                pet.blockchainId,
                pet.blockchainNetwork || "polygon"
              );
            } catch (blockchainError) {
              logger.warn(
                `Failed to update blockchain level for pet ${pet.id}:`,
                blockchainError
              );
            }
          }
        }

        await dbService.updatePet(pet.id, petUpdate);
      }

      // Save battle history
      await dbService.addBattleHistory({
        userId,
        result: battleResult.winner === "player" ? "victory" : "defeat",
        opponent: `${opponentDifficulty} Opponent`,
        userPets: userPets.map((pet) => pet.id),
        opponentPets: opponentPets.map((pet) => pet.id),
        rewards: enhancedRewards,
        battleData: battleResult,
        battleType: "round_robin",
        onePlacementUsed: onePlacementPets.length > 0,
      });

      // Send email notification
      if (user.email) {
        try {
          await mailService.sendBattleResults(
            user,
            battleResult,
            enhancedRewards
          );
        } catch (emailError) {
          logger.warn("Failed to send battle results email:", emailError);
        }
      }

      const updatedUser = await dbService.findUserById(userId);

      const responseData = {
        success: true,
        data: {
          battle: {
            result: battleResult,
            userPets: userPets.map((pet) => ({
              id: pet.id,
              name: pet.name,
              type: pet.type,
              rarity: pet.rarity,
              stats: getEffectiveStats(pet),
              level: pet.level,
              battlesWon: pet.battlesWon || 0,
              battlesLost: pet.battlesLost || 0,
              ability: pet.ability,
              technique: pet.technique,
              isOnePlacement: isOnePlacementTechnique(pet.technique),
              blockchainId: pet.blockchainId,
              isOnChain: !!pet.blockchainId,
            })),
            opponentPets: opponentPets.map((pet) => ({
              name: pet.name,
              type: pet.type,
              rarity: pet.rarity,
              level: pet.level,
              ability: pet.ability,
            })),
            onePlacementRule: onePlacementPets.length > 0,
          },
          rewards: enhancedRewards,
          user: {
            balance: updatedUser.balance,
            experience: updatedUser.experience,
            level: updatedUser.level,
            battlesWon: updatedUser.battlesWon,
            battlesLost: updatedUser.battlesLost,
            walletAddress: updatedUser.walletAddress,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Battle error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during battle",
      });
    }
  },

  // Connect wallet to user account
  async connectWallet(req, res) {
    try {
      const userId = req.user.id;
      const { walletAddress } = req.body;

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        return res.status(400).json({
          success: false,
          message: "Invalid wallet address",
        });
      }

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Update user with wallet address
      await dbService.updateUser(userId, {
        walletAddress: walletAddress.toLowerCase(),
        updatedAt: new Date(),
      });

      // Sync blockchain assets
      const syncResult = await this.syncBlockchainAssets(userId, walletAddress);

      res.json({
        success: true,
        message: "Wallet connected successfully",
        data: {
          walletAddress: walletAddress.toLowerCase(),
          syncResult,
        },
      });
    } catch (error) {
      logger.error("Connect wallet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during wallet connection",
      });
    }
  },

  // Disconnect wallet from user account
  async disconnectWallet(req, res) {
    try {
      const userId = req.user.id;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Remove wallet address
      await dbService.updateUser(userId, {
        walletAddress: null,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: "Wallet disconnected successfully",
      });
    } catch (error) {
      logger.error("Disconnect wallet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during wallet disconnection",
      });
    }
  },

  // Sync blockchain assets with database
  async syncBlockchainAssets(userId, walletAddress) {
    try {
      const syncResult = {
        pets: 0,
        eggs: 0,
        skins: 0,
        techniques: 0,
      };

      // Sync pets from blockchain
      const blockchainPets = await blockchainService.getOwnedPets(
        walletAddress
      );
      for (const blockchainPet of blockchainPets) {
        const existingPet = await dbService.findPetByBlockchainId(
          blockchainPet.tokenId
        );

        if (!existingPet) {
          // Create new pet in database from blockchain
          const petData = {
            name: blockchainPet.metadata.name,
            type: blockchainPet.metadata.petType,
            rarity: blockchainPet.metadata.rarity,
            level: blockchainPet.metadata.level,
            isShiny: blockchainPet.metadata.isShiny,
            blockchainId: blockchainPet.tokenId,
            blockchainNetwork: "polygon",
            tokenURI: blockchainPet.tokenURI,
            ownerId: userId,
            stats: this.generateStatsFromRarity(blockchainPet.metadata.rarity),
          };

          await dbService.createPet(petData);
          syncResult.pets++;
        }
      }

      // Sync eggs from blockchain
      const blockchainEggs = await blockchainService.getOwnedEggs(
        walletAddress
      );
      for (const blockchainEgg of blockchainEggs) {
        // Create or update eggs in database
        for (let i = 0; i < blockchainEgg.amount; i++) {
          const eggData = {
            name: blockchainEgg.name,
            eggType: blockchainEgg.eggType,
            rarity: this.getRarityFromEggType(blockchainEgg.eggType),
            blockchainId: blockchainEgg.eggType.toString(),
            blockchainNetwork: "polygon",
            ownerId: userId,
            isHatched: false,
          };

          await dbService.createEgg(eggData);
          syncResult.eggs++;
        }
      }

      logger.info(`Blockchain sync completed for user ${userId}:`, syncResult);
      return syncResult;
    } catch (error) {
      logger.error("Blockchain sync error:", error);
      throw error;
    }
  },

  // Get user's blockchain assets
  async getBlockchainAssets(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!user.walletAddress) {
        return res.status(400).json({
          success: false,
          message: "Wallet not connected",
        });
      }

      // Get assets from blockchain
      const [pets, eggs, skins, techniques] = await Promise.all([
        blockchainService.getOwnedPets(user.walletAddress),
        blockchainService.getOwnedEggs(user.walletAddress),
        blockchainService.getOwnedSkins(user.walletAddress),
        blockchainService.getOwnedTechniques(user.walletAddress),
      ]);

      res.json({
        success: true,
        data: {
          walletAddress: user.walletAddress,
          assets: {
            pets,
            eggs,
            skins,
            techniques,
          },
        },
      });
    } catch (error) {
      logger.error("Get blockchain assets error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // List item on marketplace
  async listOnMarketplace(req, res) {
    try {
      const userId = req.user.id;
      const { itemType, itemId, price, amount = 1 } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user || !user.walletAddress) {
        return res.status(400).json({
          success: false,
          message: "User not found or wallet not connected",
        });
      }

      let nftContract, tokenId, itemDetails;

      // Get item details based on type
      switch (itemType) {
        case "pet":
          const pet = await dbService.findPetById(itemId);
          if (!pet || pet.ownerId.toString() !== userId) {
            return res.status(404).json({
              success: false,
              message: "Pet not found or not owned by user",
            });
          }
          if (!pet.blockchainId) {
            return res.status(400).json({
              success: false,
              message: "Pet is not on blockchain",
            });
          }
          nftContract = config.CONTRACT_PET_NFT;
          tokenId = pet.blockchainId;
          itemDetails = {
            name: pet.name,
            type: pet.type,
            rarity: pet.rarity,
            level: pet.level,
          };
          break;

        case "egg":
          const egg = await dbService.findEggById(itemId);
          if (!egg || egg.ownerId.toString() !== userId) {
            return res.status(404).json({
              success: false,
              message: "Egg not found or not owned by user",
            });
          }
          nftContract = config.CONTRACT_EGG_NFT;
          tokenId = egg.eggType || 1;
          itemDetails = {
            name: egg.name,
            eggType: egg.eggType,
            rarity: egg.rarity,
          };
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Unsupported item type",
          });
      }

      // List on blockchain marketplace
      const listResult = await blockchainService.listItem(
        nftContract,
        this.getItemTypeEnum(itemType),
        tokenId,
        amount,
        price
      );

      if (!listResult.success) {
        return res.status(500).json({
          success: false,
          message: `Failed to list item: ${listResult.error}`,
        });
      }

      // Save listing in database
      await dbService.createMarketplaceListing({
        listingId: listResult.listingId,
        userId,
        itemType,
        itemId,
        price,
        amount,
        nftContract,
        tokenId,
        itemDetails,
        status: "listed",
        listedAt: new Date(),
      });

      res.json({
        success: true,
        message: "Item listed on marketplace successfully",
        data: {
          listingId: listResult.listingId,
          itemType,
          itemDetails,
          price,
        },
      });
    } catch (error) {
      logger.error("List on marketplace error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Buy item from marketplace
  async buyFromMarketplace(req, res) {
    try {
      const userId = req.user.id;
      const { listingId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user || !user.walletAddress) {
        return res.status(400).json({
          success: false,
          message: "User not found or wallet not connected",
        });
      }

      // Get listing details
      const listing = await blockchainService.getListing(listingId);
      if (!listing || !listing.active) {
        return res.status(404).json({
          success: false,
          message: "Listing not found or not active",
        });
      }

      if (listing.seller.toLowerCase() === user.walletAddress.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: "Cannot buy your own listing",
        });
      }

      // Buy from blockchain
      const buyResult = await blockchainService.buyItem(
        listingId,
        listing.price
      );

      if (!buyResult.success) {
        return res.status(500).json({
          success: false,
          message: `Failed to buy item: ${buyResult.error}`,
        });
      }

      // Update database
      await dbService.updateMarketplaceListing(listingId, {
        status: "sold",
        buyerId: userId,
        soldAt: new Date(),
      });

      // Add item to buyer's collection
      await this.addMarketplaceItemToUser(userId, listing);

      res.json({
        success: true,
        message: "Item purchased successfully",
        data: {
          listingId,
          item: listing,
        },
      });
    } catch (error) {
      logger.error("Buy from marketplace error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get marketplace listings
  async getMarketplaceListings(req, res) {
    try {
      const { type, page = 1, limit = 20 } = req.query;

      const listings = await blockchainService.getActiveListings();

      // Filter by type if specified
      let filteredListings = listings;
      if (type) {
        filteredListings = listings.filter(
          (listing) => this.getItemTypeFromEnum(listing.itemType) === type
        );
      }

      // Paginate results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedListings = filteredListings.slice(startIndex, endIndex);

      // Enhance listings with additional data
      const enhancedListings = await Promise.all(
        paginatedListings.map(async (listing) => {
          let itemDetails = {};

          try {
            if (listing.itemType === 0) {
              // PET
              const metadata = await blockchainService.getPetMetadata(
                listing.tokenId
              );
              itemDetails = {
                name: metadata.name,
                type: metadata.petType,
                rarity: metadata.rarity,
                level: metadata.level,
                isShiny: metadata.isShiny,
              };
            } else if (listing.itemType === 1) {
              // EGG
              itemDetails = {
                name: `Egg Type ${listing.tokenId}`,
                eggType: parseInt(listing.tokenId),
              };
            }
          } catch (error) {
            logger.warn(
              `Failed to get metadata for listing ${listing.listingId}:`,
              error
            );
          }

          return {
            ...listing,
            itemDetails,
            itemTypeName: this.getItemTypeFromEnum(listing.itemType),
          };
        })
      );

      res.json({
        success: true,
        data: {
          listings: enhancedListings,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: filteredListings.length,
            totalPages: Math.ceil(filteredListings.length / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Get marketplace listings error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Cancel marketplace listing
  async cancelMarketplaceListing(req, res) {
    try {
      const userId = req.user.id;
      const { listingId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user || !user.walletAddress) {
        return res.status(400).json({
          success: false,
          message: "User not found or wallet not connected",
        });
      }

      // Get listing to verify ownership
      const listing = await dbService.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({
          success: false,
          message: "Listing not found",
        });
      }

      if (listing.userId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to cancel this listing",
        });
      }

      if (listing.status !== "listed") {
        return res.status(400).json({
          success: false,
          message: "Listing is not active",
        });
      }

      // Cancel on blockchain (this would require a cancel method in blockchain service)
      // For now, just update database status
      await dbService.updateMarketplaceListing(listingId, {
        status: "cancelled",
        cancelledAt: new Date(),
      });

      res.json({
        success: true,
        message: "Listing cancelled successfully",
      });
    } catch (error) {
      logger.error("Cancel marketplace listing error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Round-robin battle simulation
  async simulateRoundRobinBattle(playerTeam, opponentTeam, battleMode) {
    const battleLog = [];
    let playerWins = 0;
    let opponentWins = 0;

    // Use scheduleRounds from battleLogic for proper scheduling
    const numPlayers = Math.max(playerTeam.length, opponentTeam.length);
    const schedule = scheduleRounds(numPlayers);

    for (const match of schedule) {
      const playerIndex = match.match[0] % playerTeam.length;
      const opponentIndex = match.match[1] % opponentTeam.length;

      const playerPet = playerTeam[playerIndex];
      const opponentPet = opponentTeam[opponentIndex];

      if (!playerPet || !opponentPet) continue;

      // Convert to battle format
      const playerTrainer = {
        id: `player_${playerPet.id}`,
        playerName: "Player",
        pet: this.convertPetToBattleFormat(playerPet),
      };

      const opponentTrainer = {
        id: `opponent_${opponentPet.id}`,
        playerName: "Opponent",
        pet: this.convertPetToBattleFormat(opponentPet),
      };

      let matchResult;

      if (battleMode === "pve") {
        // Simulate AI battle using evaluateTurn
        matchResult = await this.simulatePetBattle(
          playerTrainer,
          opponentTrainer
        );
      } else {
        // For PvP, we'd need player input - for now use AI
        matchResult = await this.simulatePetBattle(
          playerTrainer,
          opponentTrainer
        );
      }

      battleLog.push({
        round: match.round,
        playerPet: playerPet.id,
        opponentPet: opponentPet.id,
        result: matchResult,
      });

      if (matchResult.winner === "player") {
        playerWins++;
      } else if (matchResult.winner === "opponent") {
        opponentWins++;
      }

      // Heal pets for next match using recoverPokemon
      recoverPokemon(playerTrainer.pet, opponentTrainer.pet);
    }

    const overallWinner =
      playerWins > opponentWins
        ? "player"
        : opponentWins > playerWins
        ? "opponent"
        : "draw";

    return {
      winner: overallWinner,
      playerWins,
      opponentWins,
      totalRounds: schedule.length,
      battleLog,
      schedule,
    };
  },

  // Simulate individual pet battle
  async simulatePetBattle(playerTrainer, opponentTrainer) {
    const turns = [];
    let currentPlayer = playerTrainer;
    let currentOpponent = opponentTrainer;

    while (
      currentPlayer.pet.currentHP > 0 &&
      currentOpponent.pet.currentHP > 0
    ) {
      const playerAction = this.generatePetAction(
        currentPlayer.pet,
        currentOpponent.pet
      );
      const opponentAction = this.generatePetAction(
        currentOpponent.pet,
        currentPlayer.pet
      );

      // Use evaluateTurn from battleLogic
      const battleResult = evaluateTurn(currentPlayer, currentOpponent, {
        playerAction,
        opponentAction,
        result: this.determineBattleResult(playerAction, opponentAction),
      });

      turns.push({
        turn: turns.length + 1,
        playerAction,
        opponentAction,
        result: battleResult.result,
        playerHP: currentPlayer.pet.currentHP,
        opponentHP: currentOpponent.pet.currentHP,
        damage: battleResult.damage,
        abilityUsed: battleResult.abilityUsed,
        statusEffects: {
          player: [...currentPlayer.pet.statusEffects],
          opponent: [...currentOpponent.pet.statusEffects],
        },
      });

      // Update trainers with new health and status
      currentPlayer = battleResult.player;
      currentOpponent = battleResult.opponent;

      // Process cooldowns and status effects
      processCooldowns(currentPlayer.pet);
      processCooldowns(currentOpponent.pet);
      processStatusEffects(currentPlayer.pet);
      processStatusEffects(currentOpponent.pet);

      // Add small delay for realism
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const winner = currentPlayer.pet.currentHP > 0 ? "player" : "opponent";

    return {
      winner,
      turns,
      finalPlayerHP: currentPlayer.pet.currentHP,
      finalOpponentHP: currentOpponent.pet.currentHP,
      playerPet: currentPlayer.pet,
      opponentPet: currentOpponent.pet,
    };
  },

  // Determine battle result based on actions
  determineBattleResult(playerAction, opponentAction) {
    const actionMatrix = {
      attack: {
        attack: "both damaged",
        defend: "win",
        parry: "lose",
        ability: "win",
      },
      defend: {
        attack: "lose",
        defend: "tie",
        parry: "win",
        ability: "lose",
      },
      parry: {
        attack: "win",
        defend: "lose",
        parry: "both damaged",
        ability: "win",
      },
      ability: {
        attack: "lose",
        defend: "win",
        parry: "lose",
        ability: "both damaged",
      },
    };

    return actionMatrix[playerAction]?.[opponentAction] || "both damaged";
  },

  // Generate smart action for pets considering abilities
  generatePetAction(pet, opponentPet) {
    // If pet has ability and it's a good time to use it
    if (pet.ability && this.shouldUseAbility(pet, opponentPet)) {
      const ability = ALL_ABILITIES[pet.ability];
      // Use the ability immediately when decision is made
      useAbility(pet, ability);
      return "ability";
    }

    // Otherwise use smart AI decision
    return generateSmartAttack(pet, opponentPet);
  },

  // Determine if pet should use its ability
  shouldUseAbility(pet, opponentPet) {
    const ability = ALL_ABILITIES[pet.ability];
    if (!ability) return false;

    // Check cooldown using canUseAbility from battleLogic
    if (!canUseAbility(pet, ability)) {
      return false;
    }

    const useChance = Math.random();

    // Higher chance to use ability when:
    // - Opponent is weak
    // - Pet is low on health (for healing abilities)
    // - Based on ability type

    if (ability.type === "SUPPORT" && pet.currentHP < pet.stats.hp * 0.4) {
      return useChance < 0.7; // 70% chance to use healing when low
    }

    if (
      ability.type === "OFFENSIVE" &&
      opponentPet.currentHP < opponentPet.stats.hp * 0.3
    ) {
      return useChance < 0.6; // 60% chance to finish with ability
    }

    // Default chance to use ability
    return useChance < 0.3; // 30% chance normally
  },

  // Calculate base battle rewards
  calculateBaseBattleRewards(
    opponentLevel,
    isVictory,
    battleMode,
    teamSize = 3
  ) {
    const baseCoins = opponentLevel * 10 * (teamSize / 3);
    const baseExp = opponentLevel * 5 * (teamSize / 3);

    if (!isVictory) {
      return {
        coins: Math.floor(baseCoins * 0.3),
        experience: Math.floor(baseExp * 0.3),
      };
    }

    const multiplier = battleMode === "pvp" ? 1.5 : 1.0;

    return {
      coins: Math.floor(baseCoins * multiplier),
      experience: Math.floor(baseExp * multiplier),
    };
  },

  // Convert blockchain pet to battle format
  convertPetToBattleFormat(pet) {
    return {
      id: pet.id,
      name: pet.name,
      type: pet.type,
      rarity: pet.rarity,
      ability: pet.ability,
      technique: pet.technique,
      techniqueLevel: pet.techniqueLevel || 1,
      level: pet.level || 1,
      stats: getEffectiveStats(pet),
      currentHP: pet.currentHP || pet.stats.hp,
      statusEffects: pet.statusEffects || [],
      isAlive: pet.isAlive !== false,
      abilityCooldowns: pet.abilityCooldowns || {},
      blockchainId: pet.blockchainId,
    };
  },

  // Convert multiple pets to battle format
  convertPetsToBattleFormat(pets, trainerName) {
    return pets.map((pet, index) => ({
      id: pet.id,
      name: pet.name,
      type: pet.type,
      rarity: pet.rarity,
      ability: pet.ability,
      technique: pet.technique,
      techniqueLevel: pet.techniqueLevel || 1,
      level: pet.level || 1,
      stats: pet.stats || {},
      currentHP: pet.currentHP || pet.stats.hp,
      statusEffects: pet.statusEffects || [],
      isAlive: pet.isAlive !== false,
      trainerName,
      position: index + 1,
      blockchainId: pet.blockchainId,
    }));
  },

  // Generate opponent team with abilities and techniques
  async generateOpponentTeam(difficulty, userPets, maxPets) {
    const difficulties = {
      easy: { levelMultiplier: 0.7, rarity: "common" },
      medium: { levelMultiplier: 1.0, rarity: "uncommon" },
      hard: { levelMultiplier: 1.3, rarity: "rare" },
      epic: { levelMultiplier: 1.6, rarity: "epic" },
    };

    const config = difficulties[difficulty] || difficulties.medium;
    const opponentPets = [];

    // If user has one placement pet, opponent also gets 1 pet
    const teamSize = Math.min(userPets.length, maxPets);

    const avgUserLevel =
      userPets.reduce((sum, pet) => sum + (pet.level || 1), 0) /
      userPets.length;

    for (let i = 0; i < teamSize; i++) {
      const opponentPet = serverRNGService.generatePet();

      // Scale opponent pet based on difficulty
      opponentPet.level = Math.max(
        1,
        Math.round(avgUserLevel * config.levelMultiplier)
      );
      opponentPet.rarity = config.rarity;

      // Enhance stats based on difficulty
      if (opponentPet.stats) {
        Object.keys(opponentPet.stats).forEach((stat) => {
          opponentPet.stats[stat] = Math.round(
            opponentPet.stats[stat] * config.levelMultiplier
          );
        });
      }

      // Add random ability based on type
      const typeAbilities = Object.values(ALL_ABILITIES).filter(
        (ability) => ability.element === opponentPet.type?.toUpperCase()
      );
      if (typeAbilities.length > 0) {
        const randomAbility =
          typeAbilities[Math.floor(Math.random() * typeAbilities.length)];
        opponentPet.ability = randomAbility.id;
      }

      opponentPets.push(opponentPet);
    }

    return opponentPets;
  },

  // Get available pets for battle (respecting one placement)
  async getAvailableBattlePets(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const availablePets = user.pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        rarity: pet.rarity,
        level: pet.level,
        ability: pet.ability,
        technique: pet.technique,
        isOnePlacement: pet.technique
          ? isOnePlacementTechnique(pet.technique)
          : false,
        stats: getEffectiveStats(pet),
        blockchainId: pet.blockchainId,
        isOnChain: !!pet.blockchainId,
      }));

      // Check if user has any one placement pets
      const onePlacementPets = availablePets.filter(
        (pet) => pet.isOnePlacement
      );

      res.json({
        success: true,
        data: {
          pets: availablePets,
          onePlacementPets: onePlacementPets,
          maxTeamSize: onePlacementPets.length > 0 ? 1 : 3,
          walletConnected: !!user.walletAddress,
          rules: {
            onePlacement:
              "Pets with ONE PLACEMENT techniques must battle alone",
          },
        },
      });
    } catch (error) {
      logger.error("Get available battle pets error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get battle history with enhanced details
  async getBattleHistory(req, res) {
    try {
      const userId = req.user.id;
      const battleHistory = await dbService.getUserBattleHistory(userId);

      // Enhance with round-robin details
      const enhancedHistory = battleHistory.map((battle) => {
        if (battle.battleType === "round_robin" && battle.battleData) {
          return {
            ...battle,
            detailedResults: {
              totalRounds: battle.battleData.totalRounds,
              playerWins: battle.battleData.playerWins,
              opponentWins: battle.battleData.opponentWins,
              individualMatches: battle.battleData.battleLog,
            },
          };
        }
        return battle;
      });

      const summary = {
        totalBattles: enhancedHistory.length,
        victories: enhancedHistory.filter((b) => b.result === "victory").length,
        defeats: enhancedHistory.filter((b) => b.result === "defeat").length,
        roundRobinBattles: enhancedHistory.filter(
          (b) => b.battleType === "round_robin"
        ).length,
      };

      summary.winRate =
        summary.totalBattles > 0
          ? ((summary.victories / summary.totalBattles) * 100).toFixed(1)
          : 0;

      res.json({
        success: true,
        data: {
          battles: enhancedHistory,
          summary,
        },
      });
    } catch (error) {
      logger.error("Get battle history error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get available quests
  async getAvailableQuests(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const availableQuests = [
        {
          id: "beginner_battle",
          name: "First Battle",
          difficulty: "easy",
          description: "Complete your first battle",
          reward: { coins: 100, experience: 50 },
          completed:
            user.completedQuests?.some(
              (q) => q.questId === "beginner_battle"
            ) || false,
        },
        {
          id: "hatch_3_pets",
          name: "Pet Collector",
          difficulty: "easy",
          description: "Hatch 3 pets",
          reward: { coins: 150, experience: 75 },
          progress: user.pets?.length || 0,
          target: 3,
          completed: (user.pets?.length || 0) >= 3,
        },
        {
          id: "win_5_battles",
          name: "Battle Veteran",
          difficulty: "medium",
          description: "Win 5 battles",
          reward: { coins: 250, experience: 125 },
          progress: user.battlesWon || 0,
          target: 5,
          completed: (user.battlesWon || 0) >= 5,
        },
        {
          id: "reach_level_10",
          name: "Experienced Trainer",
          difficulty: "medium",
          description: "Reach level 10",
          reward: { coins: 500, experience: 250 },
          progress: user.level || 1,
          target: 10,
          completed: (user.level || 1) >= 10,
        },
        {
          id: "connect_wallet",
          name: "Blockchain Explorer",
          difficulty: "easy",
          description: "Connect your wallet to the game",
          reward: { coins: 200, experience: 100 },
          completed: !!user.walletAddress,
        },
        {
          id: "mint_first_nft",
          name: "NFT Creator",
          difficulty: "medium",
          description: "Mint your first pet as NFT",
          reward: { coins: 300, experience: 150 },
          completed: user.pets?.some((pet) => !!pet.blockchainId) || false,
        },
      ];

      res.json({
        success: true,
        data: {
          quests: availableQuests,
        },
      });
    } catch (error) {
      logger.error("Get available quests error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Complete a quest
  async completeQuest(req, res) {
    try {
      const userId = req.user.id;
      const { questId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const quest = this.getQuestById(questId);
      if (!quest) {
        return res.status(404).json({
          success: false,
          message: "Quest not found",
        });
      }

      if (user.completedQuests?.some((q) => q.questId === questId)) {
        return res.status(400).json({
          success: false,
          message: "Quest already completed",
        });
      }

      if (!this.checkQuestRequirements(user, questId)) {
        return res.status(400).json({
          success: false,
          message: "Quest requirements not met",
        });
      }

      // Use RewardService for quest rewards
      const rewardResult = await rewardService.applyQuestRewards(
        userId,
        quest.difficulty,
        user.level,
        questId
      );

      if (!rewardResult.success) {
        throw new Error(`Failed to apply quest rewards: ${rewardResult.error}`);
      }

      const completedQuest = {
        questId,
        completedAt: new Date(),
        rewards: rewardResult.rewards,
      };

      await dbService.updateUser(userId, {
        $push: { completedQuests: completedQuest },
        updatedAt: new Date(),
      });

      const responseData = {
        success: true,
        message: `Quest "${quest.name}" completed successfully!`,
        data: {
          quest,
          rewards: rewardResult.rewards,
          user: {
            completedQuests: (user.completedQuests?.length || 0) + 1,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Quest completion error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during quest completion",
      });
    }
  },

  // Get quest progress
  async getQuestProgress(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const questProgress = {
        completed: user.completedQuests?.length || 0,
        inProgress: 6 - (user.completedQuests?.length || 0),
        totalAvailable: 6,
      };

      res.json({
        success: true,
        data: { progress: questProgress },
      });
    } catch (error) {
      logger.error("Get quest progress error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get daily reward status
  async getDailyRewardStatus(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const lastClaim = user.lastDailyClaim || new Date(0);
      const now = new Date();
      const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);
      const canClaim = hoursSinceLastClaim >= 20;
      const hoursRemaining = canClaim ? 0 : Math.ceil(20 - hoursSinceLastClaim);

      const status = {
        canClaim,
        hoursRemaining,
        consecutiveDays: user.consecutiveDays || 1,
        lastClaim: user.lastDailyClaim,
        nextReward: this.getNextDailyReward((user.consecutiveDays || 1) + 1),
      };

      res.json({
        success: true,
        data: { status },
      });
    } catch (error) {
      logger.error("Get daily reward status error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Claim daily reward
  async claimDailyReward(req, res) {
    try {
      const userId = req.user.id;
      const user = await dbService.findUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const lastClaim = user.lastDailyClaim || new Date(0);
      const now = new Date();
      const hoursSinceLastClaim = (now - lastClaim) / (1000 * 60 * 60);

      if (hoursSinceLastClaim < 20) {
        const hoursRemaining = Math.ceil(20 - hoursSinceLastClaim);
        return res.status(400).json({
          success: false,
          message: `Please wait ${hoursRemaining} more hours to claim your next daily reward`,
        });
      }

      const consecutiveDays = user.consecutiveDays || 1;
      const isNewDay = hoursSinceLastClaim >= 24;
      const currentConsecutiveDays = isNewDay
        ? consecutiveDays + 1
        : consecutiveDays;

      // Use RewardService for daily rewards
      const rewardResult = await rewardService.applyDailyRewards(
        userId,
        currentConsecutiveDays,
        user.level
      );

      if (!rewardResult.success) {
        throw new Error(`Failed to apply daily rewards: ${rewardResult.error}`);
      }

      const updateData = {
        lastDailyClaim: now,
        consecutiveDays: isNewDay ? currentConsecutiveDays : consecutiveDays,
        updatedAt: new Date(),
      };

      await dbService.updateUser(userId, updateData);

      const responseData = {
        success: true,
        message: `Daily reward claimed! Day ${updateData.consecutiveDays} streak!`,
        data: {
          rewards: rewardResult.rewards,
          streak: {
            current: updateData.consecutiveDays,
            nextReward: this.getNextDailyReward(updateData.consecutiveDays + 1),
          },
          user: {
            consecutiveDays: updateData.consecutiveDays,
            lastDailyClaim: updateData.lastDailyClaim,
          },
        },
      };

      res.json(responseData);
    } catch (error) {
      logger.error("Daily reward claim error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during daily reward claim",
      });
    }
  },

  // Get user game stats
  async getUserStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await dbService.getUserStats(userId);

      // Add blockchain stats
      const user = await dbService.findUserById(userId);
      const blockchainStats = {
        walletConnected: !!user.walletAddress,
        nftPets: user.pets?.filter((pet) => !!pet.blockchainId).length || 0,
        totalPets: user.pets?.length || 0,
        nftPercentage: user.pets?.length
          ? (
              (user.pets.filter((pet) => !!pet.blockchainId).length /
                user.pets.length) *
              100
            ).toFixed(1)
          : 0,
      };

      res.json({
        success: true,
        data: {
          ...stats,
          blockchain: blockchainStats,
        },
      });
    } catch (error) {
      logger.error("Get user stats error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Get leaderboard
  async getLeaderboard(req, res) {
    try {
      const { type = "level", limit = 10 } = req.query;
      const leaderboard = await dbService.getLeaderboard(type, parseInt(limit));

      const formattedLeaderboard = leaderboard.map((user, index) => ({
        rank: index + 1,
        username: user.username,
        level: user.level,
        score: type === "level" ? user.level : user.experience,
        battlesWon: user.battlesWon,
        walletConnected: !!user.walletAddress,
      }));

      res.json({
        success: true,
        data: {
          leaderboard: formattedLeaderboard,
          type,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error("Get leaderboard error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Level up pet
  async levelUpPet(req, res) {
    try {
      const userId = req.user.id;
      const { petId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const pet = user.pets.find((p) => p.id.toString() === petId);
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      const levelUpResult = await this.checkPetLevelUp(pet);
      if (!levelUpResult.leveledUp) {
        return res.status(400).json({
          success: false,
          message: "Pet doesn't have enough experience to level up",
        });
      }

      // Update blockchain if pet is on-chain
      if (pet.blockchainId && user.walletAddress) {
        try {
          await blockchainService.levelUpPet(
            pet.blockchainId,
            pet.blockchainNetwork || "polygon"
          );
        } catch (blockchainError) {
          logger.warn(
            `Failed to update blockchain level for pet ${pet.id}:`,
            blockchainError
          );
        }
      }

      await dbService.updatePet(petId, {
        level: levelUpResult.newLevel,
        experience: pet.experience - levelUpResult.expNeeded,
        stats: levelUpResult.newStats,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        message: `${pet.name} leveled up to level ${levelUpResult.newLevel}!`,
        data: {
          pet: {
            id: pet.id,
            name: pet.name,
            level: levelUpResult.newLevel,
            stats: levelUpResult.newStats,
            blockchainUpdated: !!pet.blockchainId,
          },
          levelUp: levelUpResult,
        },
      });
    } catch (error) {
      logger.error("Level up pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Evolve pet
  async evolvePet(req, res) {
    try {
      const userId = req.user.id;
      const { petId } = req.body;

      const user = await dbService.findUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const pet = user.pets.find((p) => p.id.toString() === petId);
      if (!pet) {
        return res.status(404).json({
          success: false,
          message: "Pet not found",
        });
      }

      if (pet.level < 10) {
        return res.status(400).json({
          success: false,
          message: "Pet must be at least level 10 to evolve",
        });
      }

      const evolutionResult = this.calculateEvolution(pet);
      await dbService.updatePet(petId, evolutionResult);

      res.json({
        success: true,
        message: `${pet.name} evolved into ${evolutionResult.name}!`,
        data: {
          pet: {
            id: pet.id,
            name: evolutionResult.name,
            evolutionStage: evolutionResult.evolutionStage,
            stats: evolutionResult.stats,
          },
        },
      });
    } catch (error) {
      logger.error("Evolve pet error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Equip pet item
  async equipPetItem(req, res) {
    try {
      // Implementation for equipping items would go here
      res.json({
        success: true,
        message: "Item equipped successfully",
        data: req.body,
      });
    } catch (error) {
      logger.error("Equip pet item error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Helper method to add marketplace item to user
  async addMarketplaceItemToUser(userId, listing) {
    switch (listing.itemType) {
      case 0: // PET
        const petMetadata = await blockchainService.getPetMetadata(
          listing.tokenId
        );
        const petData = {
          name: petMetadata.name,
          type: petMetadata.petType,
          rarity: petMetadata.rarity,
          level: petMetadata.level,
          isShiny: petMetadata.isShiny,
          blockchainId: listing.tokenId,
          blockchainNetwork: "polygon",
          ownerId: userId,
          stats: this.generateStatsFromRarity(petMetadata.rarity),
        };
        await dbService.createPet(petData);
        break;

      case 1: // EGG
        const eggData = {
          name: `Egg Type ${listing.tokenId}`,
          eggType: parseInt(listing.tokenId),
          rarity: "common",
          blockchainId: listing.tokenId,
          blockchainNetwork: "polygon",
          ownerId: userId,
          isHatched: false,
        };
        await dbService.createEgg(eggData);
        break;
    }
  },

  // Helper methods for blockchain integration
  generateStatsFromRarity(rarity) {
    const baseStats = { dmg: 50, hp: 100 };
    const multipliers = {
      common: 1,
      uncommon: 1.2,
      rare: 1.5,
      epic: 2,
      legendary: 3,
    };

    const multiplier = multipliers[rarity.toLowerCase()] || 1;
    return {
      dmg: Math.round(baseStats.dmg * multiplier),
      hp: Math.round(baseStats.hp * multiplier),
    };
  },

  getRarityFromEggType(eggType) {
    const rarities = {
      1: "common",
      2: "uncommon",
      3: "rare",
    };
    return rarities[eggType] || "common";
  },

  getItemTypeEnum(itemType) {
    const types = {
      pet: 0,
      egg: 1,
      skin: 2,
      technique: 3,
    };
    return types[itemType] || 0;
  },

  getItemTypeFromEnum(itemTypeEnum) {
    const types = {
      0: "pet",
      1: "egg",
      2: "skin",
      3: "technique",
    };
    return types[itemTypeEnum] || "unknown";
  },

  // Original helper methods
  getOpponentLevel(difficulty, userLevel) {
    const multipliers = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.2,
      epic: 1.5,
    };
    return Math.max(1, Math.round(userLevel * (multipliers[difficulty] || 1)));
  },

  async checkPetLevelUp(pet) {
    const expNeeded = Math.pow(pet.level, 2) * 50;

    if (pet.experience >= expNeeded) {
      const newLevel = pet.level + 1;
      const statIncrease = Math.floor(newLevel * 1.5);

      const newStats = {
        ...pet.stats,
        dmg: pet.stats.dmg + statIncrease,
        hp: pet.stats.hp + statIncrease * 2,
      };

      return {
        leveledUp: true,
        newLevel,
        oldLevel: pet.level,
        expNeeded,
        newStats,
        statIncrease,
      };
    }

    return { leveledUp: false };
  },

  calculateEvolution(pet) {
    const evolutionStage = (pet.evolutionStage || 1) + 1;
    const newName = `Mega ${pet.name}`;

    const newStats = {
      ...pet.stats,
      dmg: Math.round(pet.stats.dmg * 1.5),
      hp: Math.round(pet.stats.hp * 1.5),
    };

    return {
      name: newName,
      evolutionStage,
      stats: newStats,
      evolutions: [...(pet.evolutions || []), newName],
      updatedAt: new Date(),
    };
  },

  getQuestById(questId) {
    const quests = {
      beginner_battle: {
        name: "First Battle",
        difficulty: "easy",
        description: "Complete your first battle",
      },
      hatch_3_pets: {
        name: "Pet Collector",
        difficulty: "easy",
        description: "Hatch 3 pets",
      },
      win_5_battles: {
        name: "Battle Veteran",
        difficulty: "medium",
        description: "Win 5 battles",
      },
      reach_level_10: {
        name: "Experienced Trainer",
        difficulty: "medium",
        description: "Reach level 10",
      },
      connect_wallet: {
        name: "Blockchain Explorer",
        difficulty: "easy",
        description: "Connect your wallet to the game",
      },
      mint_first_nft: {
        name: "NFT Creator",
        difficulty: "medium",
        description: "Mint your first pet as NFT",
      },
    };
    return quests[questId];
  },

  checkQuestRequirements(user, questId) {
    switch (questId) {
      case "beginner_battle":
        return (user.battlesWon || 0) + (user.battlesLost || 0) > 0;
      case "hatch_3_pets":
        return (user.pets?.length || 0) >= 3;
      case "win_5_battles":
        return (user.battlesWon || 0) >= 5;
      case "reach_level_10":
        return (user.level || 1) >= 10;
      case "connect_wallet":
        return !!user.walletAddress;
      case "mint_first_nft":
        return user.pets?.some((pet) => !!pet.blockchainId) || false;
      default:
        return false;
    }
  },

  getNextDailyReward(nextDay) {
    return {
      coins: Math.floor((50 + nextDay * 2) * (1 + nextDay * 0.1)),
      experience: Math.floor((25 + nextDay * 2) * (1 + nextDay * 0.1)),
      freeRolls: nextDay >= 7 ? 1 : 0,
    };
  },

  formatHatchResult(result) {
    if (result.type === "Pet") {
      return {
        type: "Pet",
        data: {
          id: result._id,
          name: result.name,
          type: result.type,
          rarity: result.rarity,
          stats: result.stats,
          level: result.level,
          isShiny: result.isShiny,
          blockchainId: result.blockchainId,
          isOnChain: !!result.blockchainId,
        },
      };
    } else if (result.type === "Technique") {
      return {
        type: "Technique",
        data: {
          id: result._id,
          name: result.name,
          rarity: result.rarity,
          effect: result.effect,
        },
      };
    } else if (result.type === "Cosmetic") {
      return {
        type: "Cosmetic",
        data: {
          id: result._id,
          name: result.name,
          rarity: result.rarity,
        },
      };
    }
    return result;
  },
};

export default GameController;
