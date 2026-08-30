import { defineConfig } from "playwright/test";

export default defineConfig({
  // Repair loop 1 also proves durable read-back precedes every hosted call.
  testDir: "./tests-or02",
  testMatch: "openrouter-execution-controls.contract.ts",
  workers: 1,
  reporter: "list",
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
