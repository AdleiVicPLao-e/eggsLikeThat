import React, { useState } from "react";
import { useUser } from "../../context/UserContext";
import { X, Mail, User, Key, GamepadIcon, Wallet } from "lucide-react";

const AuthModal = () => {
  const {
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,
    login,
    register,
    guestLogin,
    isLoading,
  } = useUser();

  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      let result;

      if (authMode === "login") {
        if (!formData.email || !formData.password) {
          setError("Please fill in all fields");
          return;
        }
        result = await login({
          email: formData.email,
          password: formData.password,
        });
      } else if (authMode === "register") {
        if (!formData.email || !formData.username || !formData.password) {
          setError("Please fill in all fields");
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match");
          return;
        }
        result = await register({
          email: formData.email,
          username: formData.username,
          password: formData.password,
        });
      } else if (authMode === "guest") {
        result = await guestLogin(`Guest_${Date.now()}`);
      }

      if (result.success) {
        setShowAuthModal(false);
        setFormData({
          email: "",
          username: "",
          password: "",
          confirmPassword: "",
        });
      } else {
        setError(result.error || "Authentication failed");
      }
    } catch (error) {
      setError("An unexpected error occurred");
    }
  };

  const handleGuestPlay = async () => {
    const result = await guestLogin(`Guest_${Date.now()}`);
    if (result.success) {
      setShowAuthModal(false);
    } else {
      setError(result.error || "Guest login failed");
    }
  };

  if (!showAuthModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {authMode === "login" && "Sign In"}
            {authMode === "register" && "Create Account"}
            {authMode === "guest" && "Play as Guest"}
          </h2>
          <button
            onClick={() => setShowAuthModal(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <button
            onClick={() => setAuthMode("login")}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              authMode === "login"
                ? "bg-blue-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setAuthMode("register")}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              authMode === "register"
                ? "bg-green-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            Register
          </button>
          <button
            onClick={() => setAuthMode("guest")}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              authMode === "guest"
                ? "bg-purple-500 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            Guest
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Forms */}
        {(authMode === "login" || authMode === "register") && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === "register" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <div className="relative">
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Key className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {authMode === "register" && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Key className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 py-3 rounded-lg text-white font-bold transition-all flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : authMode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        )}

        {/* Guest Play */}
        {authMode === "guest" && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <GamepadIcon className="w-16 h-16 text-purple-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Play as Guest
              </h3>
              <p className="text-gray-400">
                Start playing immediately! Your progress will be saved for 24
                hours. Create a permanent account anytime to save forever.
              </p>
            </div>

            <button
              onClick={handleGuestPlay}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 py-3 rounded-lg text-white font-bold transition-all flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <GamepadIcon className="w-5 h-5 mr-2" />
                  Start Playing as Guest
                </>
              )}
            </button>

            <div className="text-center">
              <button
                onClick={() => setAuthMode("register")}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Or create permanent account
              </button>
            </div>
          </div>
        )}

        {/* Footer Links */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="text-center text-sm text-gray-400">
            {authMode === "login" && (
              <p>
                Don't have an account?{" "}
                <button
                  onClick={() => setAuthMode("register")}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Sign up
                </button>
              </p>
            )}
            {authMode === "register" && (
              <p>
                Already have an account?{" "}
                <button
                  onClick={() => setAuthMode("login")}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
