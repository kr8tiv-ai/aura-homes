import { statSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

test("social previews and share actions use the new branded Aura card", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Design your eco home. Find land that fits. Plan every step to build it." }).first()).toBeVisible();
  await expect(page.getByText("Eco Homes, Tiny Homes, Unique Stays", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("OKX Build X · AI Season 2026", { exact: false })).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/social\/aura-homes-social-v2\.jpg$/,
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.getByRole("link", { name: "Share Aura Homes on X" })).toHaveAttribute(
    "href",
    /twitter\.com\/intent\/tweet/,
  );
  await expect(page.getByRole("link", { name: "Share Aura Homes on Facebook" })).toBeAttached();
  await expect(page.getByRole("link", { name: "Share Aura Homes on Telegram" })).toBeAttached();
});

test("the landing offers both journeys together over one scene, with the founder's entrance copy", async ({ page }) => {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
  await expect(gate.getByText("Start with a proven plan or shape your own. See likely costs, land constraints, and next steps before you commit.", { exact: true })).toBeVisible();
  /* Both doors visible together — no hidden selection. Copy verbatim. */
  await expect(gate.getByRole("button", { name: /Build an eco home/ })).toBeVisible();
  await expect(gate.getByRole("button", { name: /Explore the X Layer ecosystem/ })).toBeVisible();
  await expect(gate.getByText("Design a home, find land, and plan the build.", { exact: true })).toBeVisible();
  await expect(gate.getByText("Launch an eco stay, follow HOMES, and see the future launchpad.", { exact: true })).toBeVisible();
  await expect(gate.getByRole("button", { name: "Forest sound on" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("video.story-gate-video")).toBeVisible();

  await gate.getByRole("button", { name: /Explore the X Layer ecosystem/ }).click();
  await expect(page.locator('[data-story-audience="crypto"]')).toBeVisible();
  await expect(page.getByText("Start with a real project.", { exact: true })).toBeAttached();
  await expect(page.getByText("Pay in USDC where it is supported.", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Switch to the eco-home journey" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to the eco-home journey" }).click();
  await expect(page.locator('[data-story-audience="project"]')).toBeVisible();
  await expect(page.getByText("Start with a home that fits your life.", { exact: true })).toBeAttached();
  await expect(page.getByText("Choose how to pay when a real quote exists.", { exact: true })).toBeAttached();
  /* HOMES stays out of the eco beats — it appears once, on the end sheet. */
  await expect(page.getByText("Long term: a user-owned Airbnb for eco stays.", { exact: false })).toBeAttached();
  await expect(page.getByRole("button", { name: "Switch to the X Layer ecosystem" })).toBeVisible();
  await expect(page.getByRole("button", { name: "04 Team" })).toBeAttached();
  await expect(page.getByRole("button", { name: "06 Payments" })).toBeAttached();
  await expect(page.getByRole("button", { name: /Escrow/ })).toHaveCount(0);
});

test("the 3D loading readout is prominent, centred, staged, and alive through the whole handoff", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/*.glb", async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_800));
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("dialog", { name: "Choose an Aura Homes journey" })
    .getByRole("button", { name: /Build an eco home/ })
    .click();

  const loader = page.locator(".aura-loader");
  /* The handoff indicator must be in the first post-click commit. If it is
     mounted inside the Three.js chunk, shader compilation can block its
     reveal timer and leave the visitor staring at the authored still. */
  await expect(loader).toHaveClass(/is-on/, { timeout: 100 });
  await expect(loader).toBeVisible();
  const box = await loader.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(4);
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(4);
  }
  /* Real stage names and a ticking elapsed clock — the "visibly not dead"
     contract. The clock must advance even while a stage holds. */
  await expect(loader.locator(".aura-loader-label")).toHaveText(/^(Film|Canvas|Core|Landscape|Meadow|Ready)$/);
  await expect(loader.locator(".aura-loader-time")).toHaveText(/^\d+\.\ds$/);
  const t1 = await loader.locator(".aura-loader-time").textContent();
  await expect(loader.locator(".aura-loader-time")).not.toHaveText(t1 ?? "", { timeout: 2_000 });
  await page.screenshot({ path: testInfo.outputPath("centred-scene-loader.png") });
  await expect(page.locator(".story-static-scene")).toHaveClass(/is-hidden/, { timeout: 15_000 });
  /* The founder's regression: the widget used to vanish the moment the core
     painted, exactly when the progressive stages began to stagger. It now
     holds through them and only leaves after the meadow's first real frame. */
  await expect(loader).toBeVisible();
  await expect(page.locator(".story-scene-root")).toHaveAttribute("data-scene-quality", "balanced");
  await expect(page.locator(".story-scene-root")).toHaveAttribute("data-scene-phase", "meadow", { timeout: 60_000 });
  await expect(loader).toHaveCount(0, { timeout: 20_000 });
});

test("the landing returns to its composed still when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (String(type).startsWith("webgl")) return null;
      return Reflect.apply(nativeGetContext, this, [type, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await page.getByRole("dialog", { name: "Choose an Aura Homes journey" })
    .getByRole("button", { name: /Build an eco home/ })
    .click();

  await expect(page.locator(".aura-loader")).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator(".story-static-scene")).not.toHaveClass(/is-hidden/);
  await expect(page.locator(".story-scene-root canvas")).toHaveCount(0);
});

test("the app header keeps the customer journey concise and moves tools into More", async ({ page }) => {
  await page.goto("/build");

  const journey = page.getByRole("navigation", { name: "Primary" });
  await expect(journey.getByRole("link")).toHaveCount(4);
  await expect(journey.getByRole("link", { name: "Design a home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Check a contractor" })).toHaveCount(0);

  await page.getByText("More", { exact: true }).click();
  await expect(page.getByRole("navigation", { name: "More Aura tools" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Check a contractor" })).toBeVisible();
  await expect(page.getByRole("link", { name: /escrow/i })).toHaveCount(0);
  // HOMES and the project record left the ordinary utility menu on purpose —
  // the story's blockchain journey and the workspace spine reach them.
  await expect(page.getByRole("link", { name: "Project record" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /HOMES/ })).toHaveCount(0);
});

test("the builder opens canvas-first with a persistent model and plan switch", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");
  await expect(page.getByRole("heading", { name: "Shape the home. Keep every decision." })).toBeVisible();
  await expect(page.locator(".builder-viewport canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "View" })).toBeVisible();
  await expect(page.getByText("Design intent only—not structural", { exact: false }).first()).toBeVisible();
});

test("mobile uses the safe scene tier and a complete menu without horizontal overflow", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-scene-quality=still]")).toBeAttached();
  await expect(page.locator(".story-scene-root canvas")).toHaveCount(0);
  const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
  await expect(gate.getByRole("button", { name: /Build an eco home/ })).toBeVisible();
  await expect(gate.getByRole("button", { name: /Explore the X Layer ecosystem/ })).toBeVisible();
  await gate.getByRole("button", { name: /Explore the X Layer ecosystem/ }).click();
  await expect(page.locator('[data-story-audience="crypto"]')).toBeVisible();
  const landingWidths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(landingWidths.scroll).toBe(landingWidths.client);
  await page.goto("/how-it-works");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: "Land fit pilot" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Check a contractor" })).toBeVisible();

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBe(widths.client);
});

test("the landing film serves a sharp, hardware-decodable desktop source within its transfer budget", async ({ page }) => {
  const desktopFilm = resolve(process.cwd(), "public/video/enter-desktop.mp4");
  expect(statSync(desktopFilm).size).toBeLessThanOrEqual(3_750_000);

  await page.goto("/");
  const video = page.locator("video.story-gate-video");
  await expect(video).toBeVisible();
  await expect(video.locator('source[media="(min-width: 900px)"]')).toHaveAttribute(
    "src",
    /enter-desktop\.mp4$/,
  );
  await expect(video.locator('source[media="(min-width: 900px)"]')).toHaveAttribute("type", "video/mp4");
  await expect(video.locator('source[type="video\/mp4"]:not([media])')).toHaveAttribute(
    "src",
    /enter\.mp4$/,
  );
  await expect(video).toHaveAttribute("poster", /enter-poster\.avif$/);
});
