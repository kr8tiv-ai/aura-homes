import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["budget-ui.spec.ts", "comfort-ui.spec.ts", "dashboard-project.spec.ts", "graph-ui.spec.ts", "homes-ui.spec.ts", "marketplace-ui.spec.ts", "navigation.spec.ts", "plan-catalog-ui.spec.ts", "project-ui.spec.ts", "story-quality.spec.ts", "visual-system-ui.spec.ts", "xlayer-ui.spec.ts"],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4331",
  },
  webServer: {
    command: "node scripts/build-and-serve-export.mjs out 4331",
    url: "http://127.0.0.1:4331/build",
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
