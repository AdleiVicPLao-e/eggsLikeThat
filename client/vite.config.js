import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ✅ allows JSX in both .jsx and .js files
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.[jt]sx?$/,
    exclude: [],
  },
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
