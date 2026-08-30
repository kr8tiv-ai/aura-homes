import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests-or01",
  testMatch: "openrouter-boundary.contract.ts",
  workers: 1,
  reporter: "list",
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
