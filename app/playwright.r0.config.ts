import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4337",
  },
  webServer: {
    command: "node scripts/serve-export.mjs out 4337",
    url: "http://127.0.0.1:4337/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
