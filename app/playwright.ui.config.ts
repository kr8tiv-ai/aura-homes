import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests",
  /* builder-viewer-tools.spec.ts lives HERE rather than in the pure gate on
     purpose: fourteen of its fifteen cases are pure, but the fifteenth — the
     one asserting the canvas element, the load epoch and the design hash all
     survive every tool toggle — only runs against a served build. Under the
     pure runner it reports "1 skipped", and a permanently skipped assertion is
     the same silent nothing as an unwired spec file. */
  testMatch: ["budget-ui.spec.ts", "builder-mobile.spec.ts", "builder-viewer-tools.spec.ts", "builder-viewer.spec.ts", "comfort-ui.spec.ts", "dashboard-project.spec.ts", "graph-ui.spec.ts", "homes-ui.spec.ts", "landing-film.spec.ts", "marketplace-ui.spec.ts", "navigation.spec.ts", "plan-catalog-ui.spec.ts", "plan-selection-visual.spec.ts", "project-ui.spec.ts", "roadmap.spec.ts", "story-quality.spec.ts", "visual-system-ui.spec.ts", "walkthrough.spec.ts", "xlayer-ui.spec.ts"],
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4331",
  },
  webServer: {
    command: "node scripts/build-and-serve-export.mjs out 4331",
    url: "http://127.0.0.1:4331/build",
    reuseExistingServer: false,
    /* The export build precedes serving; at 72 plans + the roadmap page it
       runs ~4 minutes cold on the reference machine, so the old 240s ceiling
       was killing healthy builds mid-generation. */
    timeout: 480_000,
  },
});
