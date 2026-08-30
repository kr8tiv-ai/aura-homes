import { defineConfig } from "playwright/test";

export default defineConfig({
  // Repair loop 1 also proves unsupported compiler outcomes fail closed.
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
