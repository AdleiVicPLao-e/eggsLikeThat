import { rngService } from "../src/services/RNGService.js";
import { rewardService } from "../src/services/RewardService.js";

describe("Game Logic Tests", () => {
  describe("RNG Service", () => {
    test("should generate pet with valid properties", () => {
      const pet = rngService.generatePet();

      expect(pet).toHaveProperty("name");
      expect(pet).toHaveProperty("tier");
      expect(pet).toHaveProperty("type");
      expect(pet).toHaveProperty("abilities");
      expect(pet).toHaveProperty("stats");
      expect(pet.stats).toHaveProperty("attack");
      expect(pet.stats).toHaveProperty("defense");
      expect(pet.stats).toHaveProperty("speed");
      expect(pet.stats).toHaveProperty("health");
    });

    test("should calculate battle outcome", () => {
      const playerPet = {
        tier: "rare",
        level: 5,
        stats: { attack: 100, defense: 80, speed: 90, health: 200 },
      };

      const opponentPet = {
        tier: "uncommon",
        level: 4,
        stats: { attack: 80, defense: 70, speed: 85, health: 180 },
      };

      const outcome = rngService.calculateBattleOutcome(playerPet, opponentPet);

      expect(outcome).toHaveProperty("winner");
      expect(outcome).toHaveProperty("margin");
      expect(["player", "opponent"]).toContain(outcome.winner);
    });

    test("should calculate pet power correctly", () => {
      const pet = {
        tier: "epic",
        level: 10,
        stats: { attack: 150, defense: 120, speed: 130, health: 300 },
      };

      const power = rngService.calculatePetPower(pet);
      expect(typeof power).toBe("number");
      expect(power).toBeGreaterThan(0);
    });
  });

  describe("Reward Service", () => {
    test("should calculate battle rewards", () => {
      const battleResult = { winner: "player" };
      const rewards = rewardService.calculateBattleRewards(battleResult, 5, 5);

      expect(rewards).toHaveProperty("coins");
      expect(rewards).toHaveProperty("experience");
      expect(rewards).toHaveProperty("items");
      expect(rewards.coins).toBeGreaterThan(0);
      expect(rewards.experience).toBeGreaterThan(0);
    });

    test("should calculate quest rewards", () => {
      const rewards = rewardService.calculateQuestRewards("medium", 5);

      expect(rewards).toHaveProperty("coins");
      expect(rewards).toHaveProperty("experience");
      expect(rewards).toHaveProperty("items");
      expect(rewards.coins).toBeGreaterThan(0);
      expect(rewards.experience).toBeGreaterThan(0);
    });

    test("should calculate daily rewards", () => {
      const rewards = rewardService.getDailyReward(7);

      expect(rewards).toHaveProperty("coins");
      expect(rewards).toHaveProperty("experience");
      expect(rewards.coins).toBeGreaterThan(0);
      expect(rewards.experience).toBeGreaterThan(0);
    });

    test("should calculate fusion rewards", () => {
      const materialPets = [
        { tier: "common" },
        { tier: "common" },
        { tier: "uncommon" },
      ];

      const fusionData = rewardService.calculateFusionRewards(
        materialPets,
        "rare"
      );

      expect(fusionData).toHaveProperty("cost");
      expect(fusionData).toHaveProperty("successChance");
      expect(fusionData).toHaveProperty("materialValue");
      expect(fusionData).toHaveProperty("canFuse");
    });
  });
});
