// client/src/services/api.js
import axios from "axios";
import { API_BASE_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("petverse_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("petverse_token");
      localStorage.removeItem("petverse_user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

export const gameAPI = {
  // Auth endpoints
  auth: {
    register: (userData) => api.post("/auth/register", userData),
    login: (credentials) => api.post("/auth/login", credentials),
    walletRegister: (walletData) =>
      api.post("/auth/wallet/register", walletData),
    walletLogin: (walletData) => api.post("/auth/wallet/login", walletData),
    guestLogin: (username) => api.post("/auth/guest", { username }),
    getProfile: () => api.get("/auth/profile"),
    updateProfile: (profileData) => api.put("/auth/profile", profileData),
    connectWallet: (walletData) => api.post("/auth/wallet/connect", walletData),
    refreshToken: () => api.post("/auth/refresh"),
  },

  // Game endpoints
  game: {
    // Egg Management
    hatchEgg: (eggData) => api.post("/game/eggs/hatch", eggData),

    // Battle System
    startBattle: (battleData) => api.post("/game/battles/start", battleData),
    getBattleHistory: (params = {}) =>
      api.get("/game/battles/history", { params }),
    getAvailableBattlePets: () => api.get("/game/battles/available-pets"),

    // Quest System
    getAvailableQuests: () => api.get("/game/quests/available"),
    completeQuest: (questData) => api.post("/game/quests/complete", questData),
    getQuestProgress: () => api.get("/game/quests/progress"),

    // Daily Rewards
    getDailyRewardStatus: () => api.get("/game/rewards/daily/status"),
    claimDailyReward: () => api.post("/game/rewards/daily/claim"),

    // User Progression
    getUserStats: () => api.get("/game/user/stats"),
    getLeaderboard: (params = {}) => api.get("/game/leaderboard", { params }),

    // Pet Management
    levelUpPet: (levelUpData) => api.post("/game/pets/level-up", levelUpData),
    evolvePet: (evolveData) => api.post("/game/pets/evolve", evolveData),
    equipPetItem: (equipData) => api.post("/game/pets/equip-item", equipData),
  },

  // Pet endpoints
  pets: {
    getUserPets: (params = {}) => api.get("/pets", { params }),
    getPetDetails: (petId) => api.get(`/pets/${petId}`),
    upgradePet: (petId, upgradeData) =>
      api.post(`/pets/${petId}/upgrade`, upgradeData),
    fusePets: (fusionData) => api.post("/pets/fuse", fusionData),
    toggleFavorite: (petId) => api.patch(`/pets/${petId}/favorite`),
    getFusionCalculator: () => api.get("/pets/fusion/calculator"),
  },

  // Egg endpoints
  eggs: {
    getUserEggs: (params = {}) => api.get("/eggs", { params }),
    getEggDetails: (eggId) => api.get(`/eggs/${eggId}`),
    purchaseEgg: (purchaseData) => api.post("/eggs/purchase", purchaseData),
    getFreeEgg: () => api.post("/eggs/free"),
    hatchEgg: (eggId) => api.post(`/eggs/${eggId}/hatch`),
    previewEgg: (eggId) => api.get(`/eggs/${eggId}/preview`),
    applyCosmetic: (eggId, cosmeticData) =>
      api.patch(`/eggs/${eggId}/cosmetic`, cosmeticData),
    getEggCatalog: () => api.get("/eggs/catalog/catalog"),
  },

  // Trade endpoints
  trade: {
    getListings: (params = {}) => api.get("/trade/listings", { params }),
    getMarketplaceStats: () => api.get("/trade/stats"),
    getUserListings: (params = {}) => api.get("/trade/my-listings", { params }),
    getTradeHistory: (params = {}) => api.get("/trade/history", { params }),
    getTransactionHistory: (params = {}) =>
      api.get("/trade/transactions", { params }),
    getUserOffers: (params = {}) => api.get("/trade/offers", { params }),
    listPet: (listingData) => api.post("/trade/list", listingData),
    cancelListing: (tradeId) => api.delete(`/trade/list/${tradeId}`),
    purchasePet: (tradeId) => api.post(`/trade/purchase/${tradeId}`),
    makeOffer: (offerData) => api.post("/trade/offer", offerData),
    acceptOffer: (offerId, responseData = {}) =>
      api.post(`/trade/offer/${offerId}/accept`, responseData),
    rejectOffer: (offerId, responseData = {}) =>
      api.post(`/trade/offer/${offerId}/reject`, responseData),
    counterOffer: (offerId, counterData) =>
      api.post(`/trade/offer/${offerId}/counter`, counterData),
    cancelOffer: (offerId) => api.delete(`/trade/offer/${offerId}`),
  },

  // Admin endpoints
  admin: {
    getStats: () => api.get("/admin/stats"),
    updateSettings: (settingsData) =>
      api.patch("/admin/settings", settingsData),
    getUsers: (params = {}) => api.get("/admin/users", { params }),
  },

  // Utility endpoints
  upload: {
    file: (file, type = "image") => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      return api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
  },
};

// Simple client-side validation helper (only for UI feedback)
export const validateData = (data, schemaName) => {
  const validations = {
    battleStart: (data) => {
      const errors = [];
      if (!data.petIds || data.petIds.length === 0) {
        errors.push("At least one pet must be selected for battle");
      }
      if (data.petIds && data.petIds.length > 3) {
        errors.push("Maximum 3 pets allowed in a battle team");
      }
      return errors;
    },
    questCompletion: (data) => {
      const errors = [];
      if (!data.questId) errors.push("Quest ID is required");
      return errors;
    },
  };

  const validator = validations[schemaName];
  if (!validator) {
    return { valid: true, errors: [] };
  }

  const errors = validator(data);
  return {
    valid: errors.length === 0,
    errors,
  };
};

// Simple error handler for user-friendly messages
export const handleApiError = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.code === "NETWORK_ERROR") {
    return "Network error. Please check your connection.";
  }
  if (error.code === "TIMEOUT") {
    return "Request timed out. Please try again.";
  }
  return "An unexpected error occurred. Please try again.";
};

export default api;
