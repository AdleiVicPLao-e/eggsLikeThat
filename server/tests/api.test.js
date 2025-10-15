import request from "supertest";
import app from "../src/index.js";
import { connectDB, disconnectDB } from "../src/config/db.js";
import User from "../src/models/User.js";

describe("PetVerse API Tests", () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    await connectDB();

    // Create test user
    testUser = new User({
      walletAddress: "0xTestWallet1234567890",
      username: "testuser",
      coins: 1000,
      freeRolls: 3,
    });
    await testUser.save();
  });

  afterAll(async () => {
    await User.deleteMany({});
    await disconnectDB();
  });

  describe("Authentication", () => {
    test("POST /api/auth/register - should register new user", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          walletAddress: "0xNewUser1234567890",
          username: "newuser",
          email: "newuser@test.com",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe("newuser");
      expect(response.body.data.token).toBeDefined();
    });

    test("POST /api/auth/login - should login user", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          walletAddress: "0xTestWallet1234567890",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      authToken = response.body.data.token;
    });

    test("GET /api/auth/profile - should get user profile", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe("testuser");
    });
  });

  describe("Game Actions", () => {
    test("POST /api/game/hatch - should hatch egg", async () => {
      const response = await request(app)
        .post("/api/game/hatch")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ useFreeRoll: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pet).toBeDefined();
    });

    test("POST /api/game/daily-reward - should claim daily reward", async () => {
      const response = await request(app)
        .post("/api/game/daily-reward")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rewards).toBeDefined();
    });
  });

  describe("Pets Management", () => {
    test("GET /api/pets - should get user pets", async () => {
      const response = await request(app)
        .get("/api/pets")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.pets)).toBe(true);
    });
  });

  describe("Marketplace", () => {
    test("GET /api/trade/listings - should get marketplace listings", async () => {
      const response = await request(app)
        .get("/api/trade/listings")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.listings)).toBe(true);
    });

    test("GET /api/trade/stats - should get marketplace stats", async () => {
      const response = await request(app).get("/api/trade/stats").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.volume24h).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    test("Invalid route should return 404", async () => {
      const response = await request(app).get("/api/invalid-route").expect(404);

      expect(response.body.success).toBe(false);
    });

    test("Unauthorized access should return 401", async () => {
      const response = await request(app).get("/api/auth/profile").expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
