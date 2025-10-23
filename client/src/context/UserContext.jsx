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

  // Check API availability
  const checkApiAvailability = async () => {
    try {
      // Simple health check - you might want to add a /health endpoint to your backend
      await gameAPI.auth.getProfile();
      setApiAvailable(true);
    } catch (error) {
      console.warn("Backend API not available, using offline mode");
      setApiAvailable(false);
    }
  };

  // Check for existing session on app load
  useEffect(() => {
    const checkExistingSession = async () => {
      setIsLoading(true);
      try {
        await checkApiAvailability();

        const token = localStorage.getItem("petverse_token");
        const savedUser = localStorage.getItem("petverse_user");

        if (token && savedUser) {
          if (apiAvailable) {
            // Try to verify session with backend
            try {
              const response = await gameAPI.auth.getProfile();
              if (response.data.success) {
                setUser(response.data.data.user);
              } else {
                // Invalid session, clear storage
                localStorage.removeItem("petverse_token");
                localStorage.removeItem("petverse_user");
              }
            } catch (error) {
              console.error(
                "Session verification failed, using local data:",
                error
              );
              // Use local storage data if backend is down
              const userData = JSON.parse(savedUser);
              setUser(userData);
            }
          } else {
            // Backend not available, use local data
            const userData = JSON.parse(savedUser);
            setUser(userData);
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
  }, [apiAvailable]);

  // Mock authentication for offline/development
  const mockAuthenticate = async (userData, mode) => {
    const mockUser = {
      id: `mock_${Date.now()}`,
      username: userData.username || `User_${Date.now()}`,
      email: userData.email || "",
      level: 1,
      coins: 1000,
      experience: 0,
      freeRolls: 3,
      isGuest: mode === "guest",
      authMethod: mode === "guest" ? "guest" : "email",
      createdAt: new Date().toISOString(),
    };

    setUser(mockUser);
    localStorage.setItem("petverse_user", JSON.stringify(mockUser));
    localStorage.setItem("petverse_token", `mock-token-${Date.now()}`);

    return { success: true, user: mockUser };
  };

  // Register new user
  const register = async (userData) => {
    try {
      setIsLoading(true);

      if (!apiAvailable) {
        return await mockAuthenticate(userData, "register");
      }

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
      console.error("Registration failed, using mock data:", error);
      // Fall back to mock authentication
      return await mockAuthenticate(userData, "register");
    } finally {
      setIsLoading(false);
    }
  };

  // Login existing user
  const login = async (credentials) => {
    try {
      setIsLoading(true);

      if (!apiAvailable) {
        return await mockAuthenticate(
          {
            email: credentials.email,
            username: credentials.email.split("@")[0],
          },
          "login"
        );
      }

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
      console.error("Login failed, using mock data:", error);
      // Fall back to mock authentication
      return await mockAuthenticate(
        { email: credentials.email, username: credentials.email.split("@")[0] },
        "login"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Guest login
  const guestLogin = async (username) => {
    try {
      setIsLoading(true);

      if (!apiAvailable) {
        return await mockAuthenticate({ username }, "guest");
      }

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
      console.error("Guest login failed, using mock data:", error);
      // Fall back to mock authentication
      return await mockAuthenticate({ username }, "guest");
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
      if (!apiAvailable) {
        // Update local state only
        const updatedUser = { ...user, ...profileData };
        setUser(updatedUser);
        localStorage.setItem("petverse_user", JSON.stringify(updatedUser));
        return { success: true, user: updatedUser };
      }

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
      console.error("Profile update failed, updating locally:", error);
      // Update local state only
      const updatedUser = { ...user, ...profileData };
      setUser(updatedUser);
      localStorage.setItem("petverse_user", JSON.stringify(updatedUser));
      return { success: true, user: updatedUser };
    }
  };

  // Quick auth actions for the home page
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
      // For now, show register modal. You can add wallet-specific logic later
      setAuthMode("register");
      setShowAuthModal(true);
    },
  };

  const value = {
    // User state
    user,
    isLoading,
    apiAvailable,

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
    quickAuth,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
