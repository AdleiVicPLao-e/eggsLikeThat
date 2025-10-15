/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Rarity colors for pets
        rarity: {
          common: "#6B7280",
          uncommon: "#10B981",
          rare: "#3B82F6",
          epic: "#8B5CF6",
          legendary: "#F59E0B",
        },
      },
      animation: {
        "hatch-spin": "hatchSpin 1s ease-in-out",
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
