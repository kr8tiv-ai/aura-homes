import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "playwright/test";

const baseURL = process.env.AURA_TEST_BASE_URL;
const filmAsset = /\/video\/enter(?:-1920\.av1|-desktop)?\.(?:webm|mp4)(?:\?|$)/;

if (baseURL) test.use({ baseURL });

function recordFilmRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request: { url: () => string }) => {
    if (filmAsset.test(request.url())) requests.push(request.url());
  });
  return requests;
}

async function advertiseEfficientAv1(page: Page, powerEfficient = true) {
  await page.addInitScript((efficient) => {
    Object.defineProperty(navigator, "mediaCapabilities", {
      configurable: true,
      value: {
        decodingInfo: async () => ({
          supported: true,
          smooth: true,
          powerEfficient: efficient,
        }),
      },
    });
  }, powerEfficient);
}

test("the poster paints before an efficient high-resolution AV1 film is requested", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await advertiseEfficientAv1(page);
  const requests = recordFilmRequests(page);

  await page.goto("/");

  const poster = page.locator("img.story-gate-poster");
  await expect(poster).toBeVisible();
  await expect(poster).toHaveAttribute("src", /enter-poster\.avif$/);
  await expect(poster).toHaveAttribute("fetchpriority", "high");
  await expect(poster).toHaveAttribute("width", "1920");
  await expect(poster).toHaveAttribute("height", "1294");

  const video = page.locator("video.story-gate-video");
  await expect(video).toHaveAttribute("preload", "none");
  const sources = video.locator("source");
  await expect(sources.first()).toHaveAttribute("src", /enter-1920\.av1\.webm$/);
  await expect(sources.first()).toHaveAttribute("type", /video\/webm; codecs="?av01/);
  await expect.poll(() => requests.some((url) => url.endsWith("/video/enter-1920.av1.webm"))).toBe(true);
  expect(requests.some((url) => url.endsWith("/video/enter-desktop.mp4"))).toBe(false);
  expect(requests.some((url) => url.endsWith("/video/enter.mp4"))).toBe(false);

  const timing = await page.evaluate(() => {
    const poster = performance.getEntriesByName(
      new URL("/video/enter-poster.avif", location.href).href,
      "resource",
    )[0] as PerformanceResourceTiming | undefined;
    const posterPainted = performance.getEntriesByName("aura:landing-poster-painted", "mark")[0];
    const filmDiscovered = performance.getEntriesByName("aura:landing-film-discovered", "mark")[0];
    return {
      posterResponseEnd: poster?.responseEnd ?? 0,
      posterPainted: posterPainted?.startTime ?? 0,
      filmDiscovered: filmDiscovered?.startTime ?? 0,
    };
  });
  expect(timing.posterResponseEnd).toBeGreaterThan(0);
  expect(timing.posterPainted).toBeGreaterThanOrEqual(timing.posterResponseEnd);
  expect(timing.filmDiscovered).toBeGreaterThanOrEqual(timing.posterPainted);
});

test("a small viewport requests only the compatibility film", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await advertiseEfficientAv1(page);
  const requests = recordFilmRequests(page);

  await page.goto("/");

  const video = page.locator("video.story-gate-video");
  await expect(video).toBeVisible();
  await expect(video.locator("source")).toHaveCount(1);
  await expect(video.locator("source")).toHaveAttribute("src", /enter\.mp4$/);
  await expect.poll(() => requests.some((url) => url.endsWith("/video/enter.mp4"))).toBe(true);
  expect(requests.some((url) => url.includes("enter-1920.av1.webm"))).toBe(false);
  expect(requests.some((url) => url.includes("enter-desktop.mp4"))).toBe(false);
});

test("save-data keeps the high-resolution source out of the delivery set", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
  });
  await advertiseEfficientAv1(page);
  const requests = recordFilmRequests(page);

  await page.goto("/");

  const video = page.locator("video.story-gate-video");
  await expect(video.locator('source[src*="enter-1920.av1.webm"]')).toHaveCount(0);
  await expect(video.locator('source[src*="enter-desktop.mp4"]')).toHaveCount(0);
  await expect.poll(() => requests.some((url) => url.endsWith("/video/enter.mp4"))).toBe(true);
});

test("reduced motion keeps the composed poster and requests no moving film", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests = recordFilmRequests(page);

  await page.goto("/");

  await expect(page.locator("img.story-gate-poster")).toBeVisible();
  await expect(page.locator("video.story-gate-video")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Choose an Aura Homes journey" })).toHaveAttribute(
    "data-film-fallback",
    "motion",
  );
  expect(requests).toEqual([]);
});

test("a failed film leaves the poster and immediate keyboard entry intact", async ({ page }) => {
  await page.route(filmAsset, (route) => route.abort("failed"));
  await page.goto("/");

  const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
  await expect(gate).toHaveAttribute("data-film-fallback", "error");
  await expect(page.locator("img.story-gate-poster")).toBeVisible();

  const enter = gate.getByRole("button", { name: /Build an eco home/ });
  await expect(enter).toBeFocused();
  await enter.press("Enter");
  await expect(gate).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Switch to the X Layer ecosystem" })).toBeFocused();
});

test("a stalled film times out to the composed poster without stranding the gate", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.load = () => undefined;
    HTMLMediaElement.prototype.play = () => new Promise(() => undefined);
  });
  await page.route(filmAsset, async (route) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    await route.abort("timedout");
  });

  await page.goto("/");

  const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
  await expect(gate).toHaveAttribute("data-film-state", "loading");
  await page.clock.fastForward(6_001);
  await expect(gate).toHaveAttribute("data-film-fallback", "timeout");
  await expect(page.locator("img.story-gate-poster")).toBeVisible();
  await expect(gate.getByRole("button", { name: /Build an eco home/ })).toBeEnabled();
});

test("the checked media proof publishes reproducible source and quality measurements", () => {
  const appRoot = resolve(process.cwd());
  const proof = JSON.parse(execFileSync(process.execPath, ["scripts/video-proof.mjs", "--json"], {
    cwd: appRoot,
    encoding: "utf8",
  })) as {
    ok: boolean;
    manifest: string;
    assets: Array<{ role: string; codec: string; width: number; height: number; bytes: number }>;
    comparisons: Array<{ distorted: string; reference: string; ssim: number }>;
  };

  expect(proof.ok).toBe(true);
  expect(proof.manifest).toBe("public/video/enter-media.json");
  expect(proof.assets.map((asset) => asset.role)).toEqual(["hero", "desktop", "compatibility", "poster"]);
  expect(proof.assets.find((asset) => asset.role === "hero")).toMatchObject({
    codec: "av1",
    width: 1920,
    height: 1294,
  });
  expect(proof.assets.find((asset) => asset.role === "compatibility")?.bytes).toBeLessThan(2_500_000);
  expect(proof.comparisons.every((comparison) => comparison.ssim >= 0.94)).toBe(true);

  const manifest = JSON.parse(readFileSync(resolve(appRoot, proof.manifest), "utf8")) as { schema: string };
  expect(manifest.schema).toBe("AuraLandingFilmProofV1");
});
