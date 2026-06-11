import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // matrix-js-sdk requires global
    global: "globalThis",
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2020",
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:9797",
    },
  },
});
