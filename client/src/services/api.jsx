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
    hatchEgg: (eggData) => api.post("/game/hatch", eggData),
    startBattle: (battleData) => api.post("/game/battle/start", battleData),
    getBattleHistory: (params = {}) =>
      api.get("/game/battle/history", { params }),
    getAvailableQuests: () => api.get("/game/quests"),
    completeQuest: (questData) => api.post("/game/quests/complete", questData),
    getQuestProgress: () => api.get("/game/quests/progress"),
    getDailyRewardStatus: () => api.get("/game/daily-reward/status"),
    claimDailyReward: () => api.post("/game/daily-reward"),
    getUserStats: () => api.get("/game/stats"),
    getLeaderboard: (params = {}) => api.get("/game/leaderboard", { params }),
    levelUpPet: (levelUpData) => api.post("/game/pets/level-up", levelUpData),
    evolvePet: (evolveData) => api.post("/game/pets/evolve", evolveData),
    equipPetItem: (equipData) => api.post("/game/pets/equip", equipData),
  },

  // Pet endpoints
  pets: {
    getUserPets: (params = {}) => api.get("/pets", { params }),
    getPetDetails: (petId) => api.get(`/pets/${petId}`),
    upgradePet: (petId, upgradeData) =>
      api.post(`/pets/${petId}/upgrade`, upgradeData),
    // trainPet: (petId, trainData) => api.post(`/pets/${petId}/train`, trainData),
    fusePets: (fusionData) => api.post("/pets/fuse", fusionData),
    toggleFavorite: (petId) => api.patch(`/pets/${petId}/favorite`),
    getFusionCalculator: () => api.get("/pets/fusion/calculator"),
    // getPetStats: () => api.get("/pets/stats/overview"),
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
    // getNegotiationHistory: (offerId) =>
    //   api.get(`/trade/offers/${offerId}/negotiation`),
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
    // getTradeAnalytics: () => api.get("/trade/analytics/overview"),
    // searchListings: (params = {}) => api.get("/trade/search", { params }),
    // getTradeCategories: () => api.get("/trade/categories"),
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

// Enhanced validation helper
export const validateData = async (data, schemaName) => {
  try {
    // Client-side validation using common validation patterns
    const validations = {
      petUpgrade: (data) => {
        const errors = [];
        if (!data.petId) errors.push("Pet ID is required");
        if (data.level && data.level < 1)
          errors.push("Level must be at least 1");
        return errors;
      },
      tradeCreation: (data) => {
        const errors = [];
        if (!data.petId) errors.push("Pet ID is required");
        if (!data.price || data.price <= 0)
          errors.push("Valid price is required");
        if (!data.currency) errors.push("Currency is required");
        return errors;
      },
      offerCreation: (data) => {
        const errors = [];
        if (!data.petId) errors.push("Pet ID is required");
        if (!data.offerPrice || data.offerPrice <= 0)
          errors.push("Valid offer price is required");
        return errors;
      },
      counterOffer: (data) => {
        const errors = [];
        if (!data.counterPrice || data.counterPrice <= 0)
          errors.push("Valid counter price is required");
        return errors;
      },
      petTrain: (data) => {
        const errors = [];
        if (!data.trainingType) errors.push("Training type is required");
        return errors;
      },
    };

    const validator = validations[schemaName];
    if (!validator) {
      console.warn(`No validator found for schema: ${schemaName}`);
      return { valid: true, errors: [] };
    }

    const errors = validator(data);
    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
};

// Enhanced batch request helper
export const batchRequest = async (requests) => {
  const responses = await Promise.allSettled(requests);

  return responses.map((response, index) => {
    if (response.status === "fulfilled") {
      return {
        success: true,
        data: response.value.data,
        status: response.value.status,
      };
    } else {
      const error = response.reason;
      return {
        success: false,
        error:
          error.response?.data?.message || error.message || "Request failed",
        status: error.response?.status,
        data: error.response?.data,
      };
    }
  });
};

// Cache helper for frequently accessed data
export const createCache = (defaultTTL = 300000) => {
  // 5 minutes default
  const cache = new Map();

  return {
    set: (key, data, ttl = defaultTTL) => {
      cache.set(key, {
        data,
        expiresAt: Date.now() + ttl,
      });
    },
    get: (key) => {
      const item = cache.get(key);
      if (!item) return null;

      if (Date.now() > item.expiresAt) {
        cache.delete(key);
        return null;
      }

      return item.data;
    },
    delete: (key) => cache.delete(key),
    clear: () => cache.clear(),
  };
};

// Create cache instances for different data types
export const cache = {
  user: createCache(60000), // 1 minute for user data
  pets: createCache(120000), // 2 minutes for pets
  marketplace: createCache(30000), // 30 seconds for marketplace
  eggs: createCache(180000), // 3 minutes for eggs
};

// API response transformer
export const transformResponse = (response, transformer) => {
  if (!response.success) return response;

  if (transformer && typeof transformer === "function") {
    return {
      ...response,
      data: transformer(response.data),
    };
  }

  return response;
};

// Error handler with user-friendly messages
export const handleApiError = (error) => {
  const defaultMessage = "An unexpected error occurred. Please try again.";

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === "NETWORK_ERROR") {
    return "Network error. Please check your connection.";
  }

  if (error.code === "TIMEOUT") {
    return "Request timed out. Please try again.";
  }

  return defaultMessage;
};

// Rate limiting helper
export const withRetry = async (apiCall, maxRetries = 3, delay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, delay * Math.pow(2, attempt - 1))
      );
    }
  }
};

export default api;
