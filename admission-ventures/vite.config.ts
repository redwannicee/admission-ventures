/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { sourcemap: false, chunkSizeWarningLimit: 600 },
  test: { globals: true, environment: "jsdom", setupFiles: ["tests/setup.ts"], include: ["tests/**/*.test.{ts,tsx}"] },
});
