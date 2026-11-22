import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
