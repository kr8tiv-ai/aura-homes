import { expect, test } from "playwright/test";

/* The opening's 0.14 grass cap exists to protect the first paint, never to
   hold the scene forever. Once the last opening stage has painted, capable
   hardware must be promoted to the full tier — post-processing, PCSS
   shadows, IBL, rich props and flowers all live behind it. Holding
   "balanced" indefinitely was the shipped regression that stripped the
   scene of every effect; this spec exists so that cannot return silently. */

test("the meadow's opening quality cap is lifted after the last stage paints", async ({ page }) => {
  test.setTimeout(180_000);

  /* The promotion target depends on real hardware hints: only environments
     that would earn the full tier can assert it. Chromium in this harness
     reports deviceMemory/hardwareConcurrency, so locally this runs; a
     constrained CI box skips with an honest reason instead of passing. */
  await page.goto("/");
  const capability = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
      webgl,
      earnsFull:
        window.innerWidth >= 1100 &&
        nav.deviceMemory !== undefined &&
        nav.deviceMemory >= 8 &&
        navigator.hardwareConcurrency !== undefined &&
        navigator.hardwareConcurrency >= 8,
    };
  });
  test.skip(!capability.webgl, "no WebGL in this environment — the scene cannot mount at all");
  test.skip(!capability.earnsFull, "this environment does not earn the full tier — promotion is unobservable");

  // The scene mounts only after a journey is chosen at the gate.
  const gatePaths = page.locator(".story-gate-paths");
  await expect(gatePaths).toBeVisible({ timeout: 30_000 });
  await gatePaths.locator("button").first().click();

  const root = page.locator(".story-scene-root");
  await expect(root).toBeVisible({ timeout: 60_000 });

  // The stage machine must walk to its final stage...
  await expect(root).toHaveAttribute("data-scene-phase", "meadow", { timeout: 120_000 });

  // ...and after the loader's Ready hold releases, the earned tier arrives.
  await expect(root).toHaveAttribute("data-scene-quality", "full", { timeout: 60_000 });
});
