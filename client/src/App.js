import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { UserProvider } from "./context/UserContext.js";
import { GameProvider } from "./context/GameContext.js";
import Header from "./components/Layout/Header.jsx";
import Navigation from "./components/Layout/Navigation.jsx";
import Home from "./pages/Home.jsx";
import Hatchery from "./pages/Hatchery.jsx";
import Game from "./pages/Game.jsx";
import Marketplace from "./pages/Marketplace.jsx";
import Profile from "./pages/Profile.jsx";

function App() {
  return (
    <UserProvider>
      <GameProvider>
        <Router>
          <div className="min-h-screen bg-gray-900">
            <Header />
            <Navigation />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/hatchery" element={<Hatchery />} />
                <Route path="/battle" element={<Game />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/profile" element={<Profile />} />

                {/* 404 page */}
                <Route
                  path="*"
                  element={
                    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                      <div className="text-center">
                        <h1 className="text-6xl font-bold text-white mb-4">
                          404
                        </h1>
                        <p className="text-xl text-gray-300 mb-8">
                          Page not found
                        </p>
                        <a
                          href="/"
                          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-6 py-3 rounded-lg text-white font-medium transition-all"
                        >
                          Return Home
                        </a>
                      </div>
                    </div>
                  }
                />
              </Routes>
            </main>

            {/* Footer */}
            <footer className="bg-gray-800 border-t border-gray-700 py-8">
              <div className="container mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-center">
                  <div className="flex items-center space-x-2 mb-4 md:mb-0">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg"></div>
                    <span className="text-white font-bold text-lg">
                      PetVerse
                    </span>
                  </div>

                  <div className="text-gray-400 text-sm text-center md:text-left">
                    <p>© 2024 PetVerse. Free-to-play pet battling game.</p>
                    <p className="mt-1">Built with React, Node.js, and Web3</p>
                  </div>

                  <div className="flex space-x-4 mt-4 md:mt-0">
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      Terms
                    </a>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      Privacy
                    </a>
                    <a
                      href="#"
                      className="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      Support
                    </a>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </Router>
      </GameProvider>
    </UserProvider>
  );
}

export default App;
