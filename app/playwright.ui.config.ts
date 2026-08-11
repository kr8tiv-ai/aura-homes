import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["comfort-ui.spec.ts", "graph-ui.spec.ts", "marketplace-ui.spec.ts"],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4331",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 4331",
    url: "http://127.0.0.1:4331/build",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
