import { statSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

test("social previews and share actions use the new branded Aura card", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Design the home. Find the land. Build it for real." }).first()).toBeVisible();
  await expect(page.getByText("All-in-one unique stays", { exact: true }).first()).toBeVisible();
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

test("the landing offers linked building and crypto-native story journeys over one scene", async ({ page }) => {
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
  await expect(gate.getByRole("button", { name: /Plan a unique stay/ })).toBeVisible();
  await expect(gate.getByRole("button", { name: /Explore HOMES \+ X Layer/ })).toBeVisible();
  await expect(gate.getByRole("button", { name: "Forest sound on" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("video.story-gate-video")).toBeVisible();

  await gate.getByRole("button", { name: /Explore HOMES \+ X Layer/ }).click();
  await expect(page.locator('[data-story-audience="crypto"]')).toBeVisible();
  await expect(page.getByText("Start with what the chain can prove.", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Switch to the building journey" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to the building journey" }).click();
  await expect(page.locator('[data-story-audience="project"]')).toBeVisible();
  await expect(page.getByText("Match the home to the land.", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Switch to the HOMES and X Layer journey" })).toBeVisible();
});

test("the 3D loading readout is prominent and centred during the scene handoff", async ({ page }, testInfo) => {
  await page.route("**/*.glb", async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_800));
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("dialog", { name: "Choose an Aura Homes journey" })
    .getByRole("button", { name: /Plan a unique stay/ })
    .click();

  const loader = page.locator(".aura-loader");
  await expect(loader).toBeVisible({ timeout: 8_000 });
  const box = await loader.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (box && viewport) {
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(4);
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(4);
  }
  await page.screenshot({ path: testInfo.outputPath("centred-scene-loader.png") });
});

test("the app header keeps the customer journey concise and moves tools into More", async ({ page }) => {
  await page.goto("/build");

  const journey = page.getByRole("navigation", { name: "Primary" });
  await expect(journey.getByRole("link")).toHaveCount(3);
  await expect(journey.getByRole("link", { name: "Start a project" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Project record" })).toHaveCount(0);

  await page.getByText("More", { exact: true }).click();
  await expect(page.getByRole("navigation", { name: "More Aura tools" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Project record" })).toBeVisible();
});

test("the builder opens canvas-first with a persistent model and plan switch", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/build");
  await expect(page.getByRole("heading", { name: "Shape the home. Keep every decision." })).toBeVisible();
  await expect(page.locator(".builder-viewport canvas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("group", { name: "View" })).toBeVisible();
  await expect(page.getByText("Design intent only—not structural", { exact: false })).toBeVisible();
});

test("mobile uses the safe scene tier and a complete menu without horizontal overflow", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-scene-quality=still]")).toBeAttached();
  await expect(page.locator(".story-scene-root canvas")).toHaveCount(0);
  const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
  await expect(gate.getByRole("button", { name: /Plan a unique stay/ })).toBeVisible();
  await expect(gate.getByRole("button", { name: /Explore HOMES \+ X Layer/ })).toBeVisible();
  await gate.getByRole("button", { name: /Explore HOMES \+ X Layer/ }).click();
  await expect(page.locator('[data-story-audience="crypto"]')).toBeVisible();
  const landingWidths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(landingWidths.scroll).toBe(landingWidths.client);
  await page.goto("/overview");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("link", { name: "Find land" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Project record" })).toBeVisible();

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
