import React, { createContext, useContext, useState, useEffect } from "react";

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
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'

  // Check for existing session on app load
  useEffect(() => {
    const checkExistingSession = async () => {
      setIsLoading(true);
      try {
        const savedUser = localStorage.getItem("gameUser");
        const sessionToken = localStorage.getItem("sessionToken");

        if (savedUser && sessionToken) {
          // Verify session with backend
          const response = await fetch("/api/auth/verify", {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          if (response.ok) {
            setUser(JSON.parse(savedUser));
          } else {
            // Invalid session, clear storage
            localStorage.removeItem("gameUser");
            localStorage.removeItem("sessionToken");
          }
        }
      } catch (error) {
        console.error("Session check failed:", error);
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      const { user: newUser, token } = await response.json();

      // Store user data and token
      localStorage.setItem("gameUser", JSON.stringify(newUser));
      localStorage.setItem("sessionToken", token);

      setUser(newUser);
      setShowAuthModal(false);

      return { success: true, user: newUser };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Login existing user
  const login = async (credentials) => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const { user: userData, token } = await response.json();

      // Store user data and token
      localStorage.setItem("gameUser", JSON.stringify(userData));
      localStorage.setItem("sessionToken", token);

      setUser(userData);
      setShowAuthModal(false);

      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    localStorage.removeItem("gameUser");
    localStorage.removeItem("sessionToken");
    // Optional: Call backend logout endpoint
  };

  // Connect wallet (optional)
  const connectWallet = async () => {
    try {
      // Mock wallet connection - replace with real implementation
      const mockWallet = {
        address: "0x" + Math.random().toString(16).slice(2, 42),
        balance: "0.5 ETH",
      };

      const updatedUser = { ...user, wallet: mockWallet };
      setUser(updatedUser);
      localStorage.setItem("gameUser", JSON.stringify(updatedUser));

      return { success: true, wallet: mockWallet };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    const updatedUser = { ...user, wallet: null };
    setUser(updatedUser);
    localStorage.setItem("gameUser", JSON.stringify(updatedUser));
  };

  const value = {
    // User state
    user,
    isLoading,

    // Authentication state
    isAuthenticated: !!user,
    isGuest: user?.isGuest || false,
    hasWallet: !!user?.wallet,

    // Auth modal
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,

    // Actions
    register,
    login,
    logout,
    connectWallet,
    disconnectWallet,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
