/* Visual proof for the plan-catalog rework: distinguishable diagrams at the
   grid, the axon preview on selection, and the camera reframing per load.
   Serves the built export, captures three shots into shots/. */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const server = spawn("node", ["scripts/serve-export.mjs", "out", "4337"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1500));

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://127.0.0.1:4337/build/", { waitUntil: "networkidle" });

  // 1 — the catalog grid: twenty-five diagrams that must read as DIFFERENT.
  await page.getByRole("heading", { name: "Start from a plan, then make it yours." }).waitFor({ timeout: 60_000 });
  await page.screenshot({ path: "shots/plan-proof-grid.png", timeout: 60_000, animations: "disabled" });

  // 2 — select the Nordic cube: the aside shows a real axonometric.
  await page.getByRole("button", { name: /Fjell Cube/ }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "shots/plan-proof-selected.png", timeout: 60_000, animations: "disabled" });

  // 3 — use it: the 3D viewport must reframe to the cube (epoch 1).
  await page.getByRole("button", { name: "Use Fjell Cube" }).click();
  await page.locator('.builder-viewport[data-load-epoch="1"]').waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  await page.locator(".builder-viewport").screenshot({ path: "shots/plan-proof-reframed.png", timeout: 60_000, animations: "disabled" });

  await browser.close();
  console.log("plan-proof: grid, selected, reframed captured");
} finally {
  server.kill();
}
