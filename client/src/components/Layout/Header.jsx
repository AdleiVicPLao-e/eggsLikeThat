import React from "react";
import { useUser } from "../../context/UserContext";
import { Coins, User, LogOut, Play } from "lucide-react";

const Header = () => {
  const {
    user,
    connectWallet,
    disconnectWallet,
    playAsGuest,
    isConnecting,
    isGuest,
  } = useUser();

  return (
    <header className="bg-gray-900 border-b border-gray-700">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg"></div>
            <h1 className="text-xl font-bold text-white">PetVerse</h1>
          </div>

          {/* User Info */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                {!isGuest && (
                  <div className="flex items-center space-x-2 bg-gray-800 px-3 py-2 rounded-lg">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="text-white font-medium">1,000</span>
                  </div>
                )}

                <div className="flex items-center space-x-2 bg-gray-800 px-3 py-2 rounded-lg">
                  <User className="w-4 h-4 text-blue-400" />
                  <span className="text-white text-sm">
                    {user.username}
                    {isGuest && (
                      <span className="text-gray-400 ml-1">(Guest)</span>
                    )}
                  </span>
                </div>

                <button
                  onClick={disconnectWallet}
                  className="flex items-center space-x-1 bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4 text-white" />
                  <span className="text-white text-sm">
                    {isGuest ? "Exit" : "Disconnect"}
                  </span>
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <span className="text-gray-400 text-sm hidden md:block">
                  Play for free!
                </span>
                <button
                  onClick={playAsGuest}
                  className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4 text-white" />
                  <span className="text-white text-sm">Play as Guest</span>
                </button>
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
