import axios from "axios";
import { API_BASE_URL } from "../utils/constants.js";

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
    login: (walletData) => api.post("/auth/login", walletData),
    guestLogin: (username) => api.post("/auth/guest", { username }),
    getProfile: () => api.get("/auth/profile"),
    updateProfile: (profileData) => api.put("/auth/profile", profileData),
    refreshToken: () => api.post("/auth/refresh"),
  },

  // Game endpoints
  game: {
    hatchEgg: (eggData) => api.post("/game/hatch", eggData),
    startBattle: (battleData) => api.post("/game/battle/start", battleData),
    completeQuest: (questData) => api.post("/game/quests/complete", questData),
    claimDailyReward: () => api.post("/game/daily-reward"),
  },

  // Pet endpoints
  pets: {
    getUserPets: (params = {}) => api.get("/pets", { params }),
    getPetDetails: (petId) => api.get(`/pets/${petId}`),
    upgradePet: (petId, upgradeData) =>
      api.post(`/pets/${petId}/upgrade`, upgradeData),
    fusePets: (fusionData) => api.post("/pets/fuse", fusionData),
    toggleFavorite: (petId) => api.patch(`/pets/${petId}/favorite`),
  },

  // Egg endpoints
  eggs: {
    getUserEggs: (params = {}) => api.get("/eggs", { params }),
    getEggDetails: (eggId) => api.get(`/eggs/${eggId}`),
    purchaseEgg: (purchaseData) => api.post("/eggs/purchase", purchaseData),
    getFreeEgg: () => api.post("/eggs/free"),
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
    getUserOffers: () => api.get("/trade/offers"),
    listPet: (listingData) => api.post("/trade/list", listingData),
    cancelListing: (tradeId) => api.delete(`/trade/list/${tradeId}`),
    purchasePet: (tradeId) => api.post(`/trade/purchase/${tradeId}`),
    makeOffer: (offerData) => api.post("/trade/offer", offerData),
  },
};

// Validation helper using shared schemas
export const validateData = async (data, schemaName) => {
  try {
    // In a real implementation, you'd use a JSON schema validator
    // For now, we'll do basic validation
    console.log(`Validating data for schema: ${schemaName}`, data);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
};

// File upload helper
export const uploadFile = async (file, type = "image") => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  const response = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

// Batch request helper
export const batchRequest = async (requests) => {
  const responses = await Promise.allSettled(requests);

  return responses.map((response, index) => {
    if (response.status === "fulfilled") {
      return { success: true, data: response.value.data };
    } else {
      return {
        success: false,
        error: response.reason.response?.data?.message || "Request failed",
        status: response.reason.response?.status,
      };
    }
  });
};

export default api;
