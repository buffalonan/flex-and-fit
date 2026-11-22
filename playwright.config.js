// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const os = require("os");
const path = require("path");

// A fresh database for every run, so tests never see an old run's records.
const dataDir = path.join(os.tmpdir(), `flexfit-e2e-${process.pid}`);

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    // Optional: a Chromium already on the machine (PW_CHROMIUM=/path/to/chrome), instead of `npx playwright install`.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node server/server.js",
    // DIRECCIONES: the "other address" the app learns from /api/salud (the same server under another name).
    env: { PORT: "4173", DATA_DIR: dataDir, DIRECCIONES: "http://localhost:4173" },
    url: "http://127.0.0.1:4173/api/salud",
    reuseExistingServer: false,
  },
});
