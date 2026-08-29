import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests-hm02",
  testMatch: "community-dashboard.contract.ts",
  workers: 1,
  reporter: "list",
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
