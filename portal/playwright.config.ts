import { defineConfig, devices } from "@playwright/test";

// Normally Playwright uses its own browser (`npx playwright install chromium`). Where a different
// Chromium is already installed (for example a Claude Code cloud container, /opt/pw-browsers/chromium),
// point PW_CHROMIUM_PATH at it instead.
const launchOptions = process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3000", trace: "off" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions }, grepInvert: /@phone/ },
    { name: "phone", use: { ...devices["Pixel 7"], launchOptions }, grep: /@phone/ },
  ],
});
