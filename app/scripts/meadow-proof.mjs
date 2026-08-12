/* One screenshot of the settled meadow from the BUILT export — the visual
   proof beside tests/story-quality.spec.ts's DOM assertion. Serves out/ on
   4336, walks the gate, waits for the full-quality promotion plus a settle
   beat, scrolls into the meadow framing, captures, exits. */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const server = spawn("node", ["scripts/serve-export.mjs", "out", "4336"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:4336/", { waitUntil: "networkidle" });

  await page.locator(".story-gate-paths button").first().click();
  await page.locator(".story-scene-root").waitFor({ timeout: 60_000 });
  await page
    .locator('.story-scene-root[data-scene-quality="full"][data-scene-phase="meadow"]')
    .waitFor({ timeout: 120_000 });
  // Let the promoted grass/flower instancing actually build and paint.
  await page.waitForTimeout(9_000);

  // The opening beat frames the house in its meadow — capture there, then a
  // nudge deeper for the close-ups the founder judges density by.
  await page.screenshot({ path: "shots/meadow-proof-open.png", timeout: 90_000, animations: "disabled" });
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: "shots/meadow-proof.png", timeout: 90_000, animations: "disabled" });
  await browser.close();
  console.log("shots/meadow-proof.png");
} finally {
  server.kill();
}
