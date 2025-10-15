import React, { createContext, useContext, useState, useEffect } from "react";
import { useGameAPI } from "../hooks/useGameAPI.js";
import { LOCAL_STORAGE_KEYS } from "../utils/constants.js";

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getProfile } = useGameAPI();

  // Load user from localStorage on mount
  useEffect(() => {
    loadUserFromStorage();
  }, []);

  const loadUserFromStorage = async () => {
    try {
      const savedUser = localStorage.getItem(LOCAL_STORAGE_KEYS.USER_SESSION);
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        setUser(userData);

        // Verify user session is still valid
        if (userData.token) {
          await verifySession(userData.token);
        }
      }
    } catch (error) {
      console.error("Error loading user from storage:", error);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_SESSION);
    } finally {
      setIsLoading(false);
    }
  };

  const verifySession = async (token) => {
    try {
      // This would typically verify with backend
      // For now, we'll assume it's valid and refresh profile
      await getProfile();
    } catch (error) {
      console.error("Session verification failed:", error);
      logout();
    }
  };

  const login = (userData, token) => {
    const userWithToken = {
      ...userData,
      token,
      loginTime: new Date().toISOString(),
    };

    setUser(userWithToken);
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.USER_SESSION,
      JSON.stringify(userWithToken)
    );
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.USER_SESSION);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.WALLET_CONNECTION);
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      if (!prev) return null;

      const updatedUser = { ...prev, ...updates };
      localStorage.setItem(
        LOCAL_STORAGE_KEYS.USER_SESSION,
        JSON.stringify(updatedUser)
      );
      return updatedUser;
    });
  };

  const isGuest = user?.isGuest || false;
  const isWalletConnected = !!user?.walletAddress;

  const value = {
    // State
    user,
    isLoading,

    // Actions
    login,
    logout,
    updateUser,

    // Derived state
    isAuthenticated: !!user,
    isGuest,
    isWalletConnected,

    // User properties (convenience accessors)
    userId: user?.id,
    username: user?.username,
    walletAddress: user?.walletAddress,
    level: user?.level,
    coins: user?.coins,
    experience: user?.experience,
    freeRolls: user?.freeRolls,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
