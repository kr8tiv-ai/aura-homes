import { defineConfig } from "playwright/test";

export default defineConfig({
  // The still-open repair loop also proves operation-witness readback under concurrent state advancement.
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
