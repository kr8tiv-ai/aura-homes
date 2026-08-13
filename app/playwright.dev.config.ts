import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["plan-catalog-ui.spec.ts"],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4334",
  },
  webServer: {
    command: "npm run dev -- -p 4334",
    url: "http://127.0.0.1:4334/build",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
