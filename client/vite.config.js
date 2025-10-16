import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic", // enables JSX automatically in .js files
      include: "**/*.{js,jsx,ts,tsx}", // ensure plugin applies to all
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
