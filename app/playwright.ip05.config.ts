import { defineConfig } from "playwright/test";

export default defineConfig({
  // Repair loop 1 proves every canonical compiler refusal fails closed.
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
