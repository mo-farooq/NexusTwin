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
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
