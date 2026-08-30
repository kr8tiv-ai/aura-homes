import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests-ip04",
  testMatch: "design-intent-compiler.contract.ts",
  workers: 1,
  reporter: "list",
  use: {
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
