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
  await expect(gate.getByText("Start with a curated plan study or shape your own. See likely costs, land constraints, and next steps before you commit.", { exact: true })).toBeVisible();
  /* Both doors visible together — no hidden selection. Copy verbatim. */
  await expect(gate.getByRole("button", { name: /Build an eco home/ })).toBeVisible();
  await expect(gate.getByRole("button", { name: /Explore the X Layer ecosystem/ })).toBeVisible();
  await expect(gate.getByText("Design a home, find land, and plan the build.", { exact: true })).toBeVisible();
  await expect(gate.getByText("Launch an eco stay, follow HOMES, and see the future launchpad.", { exact: true })).toBeVisible();
  await expect(gate.getByRole("button", { name: "Forest sound on" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("video.story-gate-video")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Story controls" })).toHaveCount(0);

  await gate.getByRole("button", { name: /Explore the X Layer ecosystem/ }).click();
  await expect(page.locator('[data-story-audience="crypto"]')).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Story controls" })).toBeVisible();
  await expect(page.getByText("Start with a real project.", { exact: true })).toBeAttached();
  await expect(page.getByText("Pay in USDC where it is supported.", { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Switch to the eco-home journey" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to the eco-home journey" }).click();
  await expect(page.locator('[data-story-audience="project"]')).toBeVisible();
  await expect(page.getByText("Start with a home that fits your life.", { exact: true })).toBeAttached();
  await expect(page.getByText("Choose how to pay when a real quote exists.", { exact: true })).toBeAttached();
  /* HOMES stays out of the eco beats — it appears once, on the end sheet. */
  await expect(page.getByText("Long term: a future owner-participating stay network", { exact: false })).toBeAttached();
  await expect(page.getByRole("button", { name: "Switch to the X Layer ecosystem" })).toBeVisible();
  await expect(page.getByRole("button", { name: "04 Team" })).toBeAttached();
  await expect(page.getByRole("button", { name: "06 Payments" })).toBeAttached();
  await expect(page.getByRole("button", { name: /Escrow/ })).toHaveCount(0);
});

test("the entrance gate owns focus until a journey is chosen, then restores it to the story", async ({ page }) => {
  await page.goto("/");

  const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
  const projectJourney = gate.getByRole("button", { name: /Build an eco home/ });
  const lastGateLink = gate.getByRole("link", { name: "X Layer testnet" });
  const storyHeader = page.locator(".story-chrome");

  await expect(projectJourney).toBeFocused();
  await expect(storyHeader).toHaveAttribute("inert", "");

  await lastGateLink.focus();
  await page.keyboard.press("Tab");
  await expect(projectJourney).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(lastGateLink).toBeFocused();

  await projectJourney.click();
  await expect(gate).toHaveCount(0);
  await expect(storyHeader).not.toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "Switch to the X Layer ecosystem" })).toBeFocused();
});

test("the 3D loading readout is prominent, centred, staged, and alive through the whole handoff", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const state = window as typeof window & {
      __auraLoaderTimes?: string[];
      __auraReadyWasVisible?: boolean;
    };
    state.__auraLoaderTimes = [];
    state.__auraReadyWasVisible = false;
    const observer = new MutationObserver(() => {
      const loader = document.querySelector<HTMLElement>(".aura-loader");
      const label = loader?.querySelector<HTMLElement>(".aura-loader-label");
      const time = loader?.querySelector<HTMLElement>(".aura-loader-time")?.textContent?.trim();
      if (time && !state.__auraLoaderTimes?.includes(time)) state.__auraLoaderTimes?.push(time);
      if (!loader || label?.textContent?.trim() !== "Ready") return;
      const style = window.getComputedStyle(loader);
      if (loader.classList.contains("is-on") && style.display !== "none" && style.visibility !== "hidden") {
        state.__auraReadyWasVisible = true;
      }
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true, attributes: true });
  });
  await page.route("**/*.glb", async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
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
  await expect(loader.locator(".aura-loader-label")).toHaveText(/^(Preparing scene|Canvas|Core|Landscape|Meadow|Ready)$/);
  await expect(loader.locator(".aura-loader-pct")).toHaveText(/^Stage [1-5] of 5$/);
  await expect(loader.locator(".aura-loader-time")).toHaveText(/^\d+\.\ds$/);
  await expect.poll(
    () => page.evaluate(() => new Set(
      (window as typeof window & { __auraLoaderTimes?: string[] }).__auraLoaderTimes ?? [],
    ).size),
    { timeout: 2_000 },
  ).toBeGreaterThan(1);
  await page.screenshot({ path: testInfo.outputPath("centred-scene-loader.png") });
  await expect(page.locator(".story-static-scene")).toHaveClass(/is-hidden/, { timeout: 15_000 });
  /* The founder's regression: the widget used to vanish the moment the core
     painted, exactly when the progressive stages began to stagger. It now
     holds through them and only leaves after the meadow's first real frame. */
  await expect(loader).toBeVisible();
  const scene = page.locator(".story-scene-root");
  await expect(scene).toHaveAttribute("data-scene-quality", "balanced");
  await expect(scene).toHaveAttribute("data-scene-phase", "meadow", { timeout: 60_000 });
  /* Full-density meadow construction is intentionally much heavier than the
     opening tier. The status card must finish its honest Ready hold and fade
     before that promotion is even authorized, otherwise the construction
     task can starve the fade timer and strand the card over a ready scene. */
  await expect.poll(
    () => page.evaluate(() => Boolean(
      (window as typeof window & { __auraReadyWasVisible?: boolean }).__auraReadyWasVisible,
    )),
    { timeout: 60_000 },
  ).toBe(true);
  await expect(loader).toHaveCount(0, { timeout: 3_000 });
  await expect(scene).toHaveAttribute("data-scene-quality", "balanced");
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

test("a failed scene asset returns to the composed still instead of stranding the loader", async ({ page }) => {
  test.setTimeout(90_000);
  await page.route("**/*.glb", (route) => route.abort("failed"));
  await page.goto("/");
  await page.getByRole("dialog", { name: "Choose an Aura Homes journey" })
    .getByRole("button", { name: /Build an eco home/ })
    .click();

  await expect(page.locator(".story-static-scene")).not.toHaveClass(/is-hidden/, { timeout: 60_000 });
  await expect(page.locator(".aura-loader")).toHaveCount(0, { timeout: 60_000 });
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
  /* `exact: true` because getByRole's `name` is a case-insensitive SUBSTRING
     match, and this test means one specific control: the 3D-model / 2D-plan
     switch. It passed for months by accident — until the walkthrough panel
     shipped a group labelled "Step between viewpoints", whose name contains
     "view", and two elements matched. The fix is to say which one, not to
     rename the other: a loose locator that happens to be unambiguous today is
     a test that will break on an unrelated word tomorrow. */
  await expect(page.getByRole("group", { name: "View", exact: true })).toBeVisible();
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
  const tools = page.getByRole("navigation", { name: "Aura tools", exact: true });
  await expect(tools.getByRole("link", { name: "Land fit pilot", exact: true })).toBeVisible();
  await expect(tools.getByRole("link", { name: "Check a contractor", exact: true })).toBeVisible();

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBe(widths.client);
});

test("the landing film keeps its poster first and selects the measured desktop fallback at an ordinary viewport", async ({ page }) => {
  const desktopFilm = resolve(process.cwd(), "public/video/enter-desktop.mp4");
  expect(statSync(desktopFilm).size).toBeLessThanOrEqual(3_750_000);

  await page.goto("/");
  const poster = page.locator("img.story-gate-poster");
  await expect(poster).toBeVisible();
  await expect(poster).toHaveAttribute("src", /enter-poster\.avif$/);
  await expect(poster).toHaveAttribute("fetchpriority", "high");

  const video = page.locator("video.story-gate-video");
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video.locator("source")).toHaveCount(2);
  await expect(video.locator("source").first()).toHaveAttribute("src", /enter-desktop\.mp4$/);
  await expect(video.locator("source").first()).toHaveAttribute("type", "video/mp4");
  await expect(video.locator("source").nth(1)).toHaveAttribute("src", /enter\.mp4$/);
  await expect(video).toHaveAttribute("poster", /enter-poster\.avif$/);
});
