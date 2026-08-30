import { defineConfig } from "playwright/test";

export default defineConfig({
  // Repair loop 1 keeps the fresh verifier regressions inside the same bounded contract.
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
