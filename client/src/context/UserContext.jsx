// client/src/context/UserContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { gameAPI } from "../services/api.js";

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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login");

  // Check for existing session on app load
  useEffect(() => {
    const checkExistingSession = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("petverse_token");
        const savedUser = localStorage.getItem("petverse_user");

        if (token && savedUser) {
          // Verify session by getting profile
          const response = await gameAPI.auth.getProfile();
          if (response.data.success) {
            setUser(response.data.data.user);
          } else {
            // Invalid session, clear storage
            localStorage.removeItem("petverse_token");
            localStorage.removeItem("petverse_user");
          }
        }
      } catch (error) {
        console.error("Session check failed:", error);
        localStorage.removeItem("petverse_token");
        localStorage.removeItem("petverse_user");
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  // Register new user
  const register = async (userData) => {
    try {
      setIsLoading(true);
      const response = await gameAPI.auth.register(userData);

      if (response.data.success) {
        const { user: newUser, token } = response.data.data;
        
        // Store user data and token
        localStorage.setItem("petverse_user", JSON.stringify(newUser));
        localStorage.setItem("petverse_token", token);

        setUser(newUser);
        setShowAuthModal(false);

        return { success: true, user: newUser };
      } else {
        throw new Error(response.data.message || "Registration failed");
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Login existing user
  const login = async (credentials) => {
    try {
      setIsLoading(true);
      const response = await gameAPI.auth.login(credentials);

      if (response.data.success) {
        const { user: userData, token } = response.data.data;

        // Store user data and token
        localStorage.setItem("petverse_user", JSON.stringify(userData));
        localStorage.setItem("petverse_token", token);

        setUser(userData);
        setShowAuthModal(false);

        return { success: true, user: userData };
      } else {
        throw new Error(response.data.message || "Login failed");
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Guest login
  const guestLogin = async (username) => {
    try {
      setIsLoading(true);
      const response = await gameAPI.auth.guestLogin(username);

      if (response.data.success) {
        const { user: userData, token } = response.data.data;

        localStorage.setItem("petverse_user", JSON.stringify(userData));
        localStorage.setItem("petverse_token", token);

        setUser(userData);
        setShowAuthModal(false);

        return { success: true, user: userData };
      } else {
        throw new Error(response.data.message || "Guest login failed");
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem("petverse_user");
    localStorage.removeItem("petverse_token");
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      const response = await gameAPI.auth.updateProfile(profileData);
      
      if (response.data.success) {
        const updatedUser = response.data.data.user;
        setUser(updatedUser);
        localStorage.setItem("petverse_user", JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
      } else {
        throw new Error(response.data.message || "Profile update failed");
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  };

  const value = {
    // User state
    user,
    isLoading,

    // Authentication state
    isAuthenticated: !!user,
    isGuest: user?.isGuest || false,
    hasWallet: !!user?.walletAddress,

    // Auth modal
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,

    // Actions
    register,
    login,
    guestLogin,
    logout,
    updateProfile,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};