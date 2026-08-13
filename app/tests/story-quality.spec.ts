import { expect, test } from "playwright/test";

/* Automatic full-quality promotion is deliberately disabled. Coarse memory
   and core hints do not prove enough main-thread headroom for the million-
   instance meadow; the opening-safe tier remains composed after handoff. */

test("the automatic landing keeps its opening-safe quality budget after meadow", async ({ page }) => {
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

  // ...and the automatic journey must remain on its known-safe tier. Richer
  // density belongs behind a measured or explicit quality control.
  await expect(root).toHaveAttribute("data-scene-quality", "balanced", { timeout: 30_000 });
  await page.waitForTimeout(3_000);
  await expect(root).toHaveAttribute("data-scene-quality", "balanced");
});
