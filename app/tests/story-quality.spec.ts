import { expect, test } from "playwright/test";

/* The opening's 0.14 grass cap exists to protect the first paint — and a
   regression shipped it as the FOREVER state, a 14%-density meadow with
   dwarf flowers. This spec pins the promotion contract at the only level
   that can catch the missing wiring: the live DOM. The scene root carries
   data-scene-phase (the stage machine) and data-scene-quality (the tier);
   after the last stage paints, the tier must leave the opening's balanced
   cap on hardware that earns full. Chromium headless reports 8 GB device
   memory and the host's cores at 1280 px wide, which selects the full tier. */

test("the meadow's opening quality cap is lifted after the last stage paints", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");

  // Without WebGL the site deliberately shows its still fallback and the
  // promotion is unobservable — skipping is the honest verdict there, and
  // the environment check below keeps the pass falsifiable where it runs.
  const hasWebgl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  });
  test.skip(!hasWebgl, "no WebGL in this environment — the scene cannot mount at all");

  // The scene mounts only after a journey is chosen at the gate.
  const gatePaths = page.locator(".story-gate-paths");
  await expect(gatePaths).toBeVisible({ timeout: 30_000 });
  await gatePaths.locator("button").first().click();

  const root = page.locator(".story-scene-root");
  await expect(root).toBeVisible({ timeout: 60_000 });

  // The stage machine must walk to its final stage...
  await expect(root).toHaveAttribute("data-scene-phase", "meadow", { timeout: 120_000 });

  // ...and the tier must then be PROMOTED past the opening cap. Before the
  // fix this stayed "balanced" forever, which is exactly what this asserts
  // against. (If this run's hardware genuinely selects balanced at full
  // selection too, the assertion would be vacuous — so the inputs are also
  // checked to prove the environment earns full.)
  const earnsFull = await page.evaluate(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return window.innerWidth >= 1100
      && (nav.deviceMemory ?? 0) >= 8
      && (nav.hardwareConcurrency ?? 0) >= 8;
  });
  test.skip(!earnsFull, "this environment cannot select the full tier, so promotion is unobservable");
  await expect(root).toHaveAttribute("data-scene-quality", "full", { timeout: 30_000 });
});
