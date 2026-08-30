import { defineConfig } from "playwright/test";

export default defineConfig({
  // IP06 includes deterministic history-coalescing proof; no browser, server, storage, or renderer is started.
  testDir: "./tests-ip06",
  testMatch: "design-intent-preview-commit.contract.ts",
  workers: 1,
  reporter: "list",
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
