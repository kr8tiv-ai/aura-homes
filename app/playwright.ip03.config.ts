import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests-ip03",
  testMatch: "design-intent-adapter.contract.ts",
  workers: 1,
  reporter: "list",
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
