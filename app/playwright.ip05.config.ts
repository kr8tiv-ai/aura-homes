import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests-ip05",
  testMatch: "design-intent-project-validator.contract.ts",
  workers: 1,
  reporter: "list",
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
