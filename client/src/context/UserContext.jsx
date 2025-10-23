// client/src/context/UserContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { gameAPI } from "../services/api";

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
  const [apiAvailable, setApiAvailable] = useState(true);
  const [connectionError, setConnectionError] = useState(null);

  // Simple health check that doesn't require auth
  const checkApiAvailability = async () => {
    try {
      // Try to access a public endpoint or the base URL
      const response = await fetch(
        `${
          import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api"
        }/health`
      );
      if (response.ok) {
        setApiAvailable(true);
        setConnectionError(null);
        return true;
      }
      throw new Error("Health check failed");
    } catch (error) {
      console.warn("Backend API not available:", error);
      setApiAvailable(false);
      setConnectionError(
        "Cannot connect to server. Please check if the backend is running."
      );
      return false;
    }
  };

  // Check for existing session on app load - optimized version
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 2;

    const checkExistingSession = async () => {
      if (!isMounted) return;

      setIsLoading(true);
      try {
        const token = localStorage.getItem("petverse_token");
        const savedUser = localStorage.getItem("petverse_user");

        // First, check if API is available
        const apiReady = await checkApiAvailability();

        if (!apiReady) {
          console.warn("API not available, cannot verify session");
          if (isMounted) {
            setIsLoading(false);
          }
          return;
        }

        if (token && savedUser) {
          try {
            console.log("Verifying session with backend...");
            const response = await gameAPI.auth.getProfile();

            if (response.data.success && isMounted) {
              setUser(response.data.data.user);
              setConnectionError(null);
              console.log("Session verified successfully");
            } else {
              throw new Error("Invalid session response");
            }
          } catch (error) {
            console.error("Session verification failed:", error);

            // If it's an auth error, clear the invalid token
            if (error.response?.status === 401) {
              console.log("Clearing invalid token");
              localStorage.removeItem("petverse_token");
              localStorage.removeItem("petverse_user");
              setConnectionError("Session expired. Please log in again.");
            } else if (retryCount < maxRetries) {
              // Retry on network errors
              retryCount++;
              console.log(
                `Retrying session check (${retryCount}/${maxRetries})...`
              );
              setTimeout(checkExistingSession, 1000);
              return;
            } else {
              setConnectionError(
                "Failed to verify session. Please try logging in again."
              );
            }
          }
        } else {
          // No existing session, just finish loading
          console.log("No existing session found");
        }
      } catch (error) {
        console.error("Session check failed:", error);
        if (isMounted) {
          setConnectionError("Failed to check session status.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkExistingSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Register new user
  const register = async (userData) => {
    try {
      setIsLoading(true);
      setConnectionError(null);

      const response = await gameAPI.auth.register(userData);

      if (response.data.success) {
        const { user: newUser, token } = response.data.data;

        // Store user data and token
        localStorage.setItem("petverse_user", JSON.stringify(newUser));
        localStorage.setItem("petverse_token", token);

        setUser(newUser);
        setShowAuthModal(false);
        setApiAvailable(true);

        return { success: true, user: newUser };
      } else {
        throw new Error(response.data.message || "Registration failed");
      }
    } catch (error) {
      console.error("Registration failed:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Registration failed";
      setConnectionError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Login existing user
  const login = async (credentials) => {
    try {
      setIsLoading(true);
      setConnectionError(null);

      const response = await gameAPI.auth.login(credentials);

      if (response.data.success) {
        const { user: userData, token } = response.data.data;

        // Store user data and token
        localStorage.setItem("petverse_user", JSON.stringify(userData));
        localStorage.setItem("petverse_token", token);

        setUser(userData);
        setShowAuthModal(false);
        setApiAvailable(true);

        return { success: true, user: userData };
      } else {
        throw new Error(response.data.message || "Login failed");
      }
    } catch (error) {
      console.error("Login failed:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Login failed";
      setConnectionError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Guest login
  const guestLogin = async (username) => {
    try {
      setIsLoading(true);
      setConnectionError(null);

      const response = await gameAPI.auth.guestLogin(username);

      if (response.data.success) {
        const { user: userData, token } = response.data.data;

        localStorage.setItem("petverse_user", JSON.stringify(userData));
        localStorage.setItem("petverse_token", token);

        setUser(userData);
        setShowAuthModal(false);
        setApiAvailable(true);

        return { success: true, user: userData };
      } else {
        throw new Error(response.data.message || "Guest login failed");
      }
    } catch (error) {
      console.error("Guest login failed:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Guest login failed";
      setConnectionError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Try to notify backend about logout if API is available
      if (apiAvailable) {
        await gameAPI.auth.logout().catch(console.warn);
      }
    } catch (error) {
      console.warn(
        "Logout API call failed, but clearing local session:",
        error
      );
    } finally {
      // Always clear local session
      setUser(null);
      localStorage.removeItem("petverse_user");
      localStorage.removeItem("petverse_token");
      setConnectionError(null);
    }
  };

  // Update user profile
  const updateProfile = async (profileData) => {
    try {
      setConnectionError(null);

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
      console.error("Profile update failed:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Profile update failed";
      setConnectionError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  // Retry connection
  const retryConnection = async () => {
    setIsLoading(true);
    setConnectionError(null);
    try {
      const success = await checkApiAvailability();
      if (success) {
        // If we have a token, try to reload user profile
        const token = localStorage.getItem("petverse_token");
        if (token) {
          const response = await gameAPI.auth.getProfile();
          if (response.data.success) {
            setUser(response.data.data.user);
          }
        }
      }
    } catch (error) {
      console.error("Retry connection failed:", error);
      setConnectionError("Still unable to connect to server.");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick auth actions
  const quickAuth = {
    createAccount: () => {
      setAuthMode("register");
      setShowAuthModal(true);
    },
    signIn: () => {
      setAuthMode("login");
      setShowAuthModal(true);
    },
    playAsGuest: () => {
      setAuthMode("guest");
      setShowAuthModal(true);
    },
    connectWallet: () => {
      setAuthMode("register");
      setShowAuthModal(true);
    },
  };

  const value = {
    // User state
    user,
    isLoading,
    apiAvailable,
    connectionError,

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
    retryConnection,
    quickAuth,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
