/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      nexustwin: path.resolve(__dirname, "./"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3003,
    host: true,
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three") || id.includes("node_modules/@react-three")) {
            return "vendor-three";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/zustand")) {
            return "vendor-react";
          }
        },
      },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
