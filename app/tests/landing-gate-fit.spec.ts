import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "playwright/test";

/* Short-laptop landing gate. At 1366x768 and 1280x720 the film still
   covers the frame (object-fit: cover). The copy column used to sit
   vertically centered inside overflow:hidden, so the two journey
   buttons and the "curated plan study" line clipped. These pins are
   the CSS that keeps that column on screen. They do not touch the
   film, the meadow, or any 3D path. */

const appRoot = path.resolve(__dirname, "..");
const css = readFileSync(path.join(appRoot, "app", "globals.css"), "utf8");

test("short-laptop gate rules pin the copy column to the lower-left and let it scroll", () => {
  expect(css).toMatch(/@media \(min-width: 821px\) and \(max-height: 880px\)/);
  const short = css.split("@media (min-width: 821px) and (max-height: 880px)")[1]?.split("@media")[0] ?? "";
  expect(short).toContain("place-items: end start");
  expect(short).toContain("overflow-y: auto");
  expect(short).toContain(".story-gate-sub");
  expect(short).toContain(".story-gate-path");
  expect(css).toMatch(/\.story-gate \{[\s\S]*?overflow-y: auto;/);
});

test("short-laptop hero column starts at the top and can scroll instead of clipping", () => {
  const short = css.split("@media (min-width: 768px) and (max-height: 840px)")[1]?.split("@media")[0] ?? "";
  expect(short).toContain(".story-hero-inner");
  expect(short).toContain("justify-content: flex-start");
  expect(short).toContain("overflow-y: auto");
  expect(short).toContain("max-height: 100svh");
});

test("at 1366x720 and 1280x720 the gate sub and both path buttons stay inside the window", async ({ page }) => {
  const href = pathToFileURL(path.join(appRoot, "app", "globals.css")).href;
  await page.setContent(`<!doctype html>
<html lang="en">
  <head>
    <link rel="stylesheet" href="${href}">
  </head>
  <body>
    <div class="story-gate" role="dialog" aria-label="Choose an Aura Homes journey">
      <div class="story-gate-inner">
        <div class="story-gate-brand"><span>Aura <em>Homes</em></span></div>
        <p class="story-gate-kicker"><span>00</span>Eco Homes, Tiny Homes, Unique Stays</p>
        <h1 class="story-display story-gate-title">
          Design your eco home.<br>Find land that fits.<br>Plan every step to build it.
        </h1>
        <p class="story-gate-sub">Start with a curated plan study or shape your own. See likely costs, land constraints, and next steps before you commit.</p>
        <div class="story-gate-paths">
          <button type="button" class="story-gate-path"><strong>Build an eco home</strong><small>Design a home, find land, and plan the build.</small></button>
          <button type="button" class="story-gate-path"><strong>Explore the X Layer ecosystem</strong><small>Launch an eco stay, follow HOMES, and see the future launchpad.</small></button>
        </div>
      </div>
    </div>
  </body>
</html>`);

  for (const viewport of [
    { width: 1366, height: 720 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    const inside = async (selector: string) => {
      const box = await page.locator(selector).boundingBox();
      expect(box, `${selector} @ ${viewport.width}x${viewport.height}`).not.toBeNull();
      if (!box) return;
      expect(box.y, `${selector} top`).toBeGreaterThanOrEqual(-1);
      expect(box.x, `${selector} left`).toBeGreaterThanOrEqual(-1);
      expect(box.y + box.height, `${selector} bottom`).toBeLessThanOrEqual(viewport.height + 1);
      expect(box.x + box.width, `${selector} right`).toBeLessThanOrEqual(viewport.width + 1);
    };
    await inside(".story-gate-sub");
    await inside(".story-gate-paths");
    await inside(".story-gate-path:first-child");
    await inside(".story-gate-path:last-child");
  }
});
