/* Deterministic R03 proof from the BUILT export. It measures botanical
   texture inside fixed meadow-only camera regions, separately asserts that
   projected flower heads are present, and captures causal promotion telemetry
   before screenshot/scroll work can contaminate it. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const PORT = 4336;
const OUT = path.resolve("shots/r03-meadow");
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const BASELINE = process.env.AURA_MEADOW_BASELINE
  ? path.resolve(process.env.AURA_MEADOW_BASELINE)
  : path.resolve("..", "..", "aura-r03-baseline-20260813");
const screenshotPaths = {
  open: path.join(OUT, "meadow-proof-open.png"),
  close: path.join(OUT, "meadow-proof-close.png"),
  report: path.join(OUT, "meadow-proof.json"),
};

const APPROVED_BASELINE_SHA256 = {
  open: "506e6511fe9ffb41896f4db52e200775d5ed80866ad5d5355a4be5ba99e50702",
  close: "e891e91e5be3f820857c39213d9aed52357fb10d8db6c510b9b15a66501b3243",
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const FIXED_CAMERAS = {
  open: {
    scrollY: 0,
    roi: { x: 0.41, y: 0.54, width: 0.55, height: 0.33 },
    baseline: "meadow-proof-open.png",
  },
  close: {
    scrollY: 700,
    roi: { x: 0.02, y: 0.55, width: 0.96, height: 0.32 },
    baseline: "meadow-proof.png",
  },
};

function vegetationPixel(png, index) {
  const red = png.data[index];
  const green = png.data[index + 1];
  const blue = png.data[index + 2];
  return green > 45 && green >= red * 0.95 && green >= blue * 1.05 && Math.max(red, green, blue) - Math.min(red, green, blue) > 10;
}

/** Detail density only inside green botanical pixels. Unlike the old generic
 * edge counter this rejects typography, navigation, rocks, clouds, and most
 * architecture, so an unrelated sharp UI cannot make the meadow pass. */
function vegetationTextureCoverage(buffer, roi) {
  const png = PNG.sync.read(buffer);
  const x0 = Math.max(1, Math.floor(roi.x * png.width));
  const y0 = Math.max(1, Math.floor(roi.y * png.height));
  const x1 = Math.min(png.width - 1, Math.ceil((roi.x + roi.width) * png.width));
  const y1 = Math.min(png.height - 1, Math.ceil((roi.y + roi.height) * png.height));
  let textured = 0;
  let botanical = 0;
  let pixels = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * png.width + x) * 4;
      pixels += 1;
      if (!vegetationPixel(png, index)) continue;
      botanical += 1;
      const left = index - 4;
      const up = index - png.width * 4;
      if (!vegetationPixel(png, left) && !vegetationPixel(png, up)) continue;
      const delta =
        Math.abs(png.data[index] - png.data[left]) +
        Math.abs(png.data[index + 1] - png.data[left + 1]) +
        Math.abs(png.data[index + 2] - png.data[left + 2]) +
        Math.abs(png.data[index] - png.data[up]) +
        Math.abs(png.data[index + 1] - png.data[up + 1]) +
        Math.abs(png.data[index + 2] - png.data[up + 2]);
      if (delta >= 30) textured += 1;
    }
  }
  return {
    botanical: pixels > 0 ? botanical / pixels : 0,
    texture: pixels > 0 ? textured / pixels : 0,
  };
}

function flowerPixel(png, index) {
  const red = png.data[index];
  const green = png.data[index + 1];
  const blue = png.data[index + 2];
  const palePetal = red > 205 && green > 195 && blue > 155 && Math.max(red, green, blue) - Math.min(red, green, blue) < 75;
  const lilacPetal = red > 150 && blue > 140 && red >= green * 0.98 && blue >= green * 0.92;
  const goldCentre = red > 150 && green > 125 && green <= red * 1.08 && blue < 135;
  return palePetal || lilacPetal || goldCentre;
}

/** Pixel evidence complements projected-head telemetry: connected petal and
 * centre clusters must actually survive the renderer inside each meadow ROI. */
function flowerPixelClusters(buffer, roi) {
  const png = PNG.sync.read(buffer);
  const x0 = Math.max(1, Math.floor(roi.x * png.width));
  const y0 = Math.max(1, Math.floor(roi.y * png.height));
  const x1 = Math.min(png.width - 1, Math.ceil((roi.x + roi.width) * png.width));
  const y1 = Math.min(png.height - 1, Math.ceil((roi.y + roi.height) * png.height));
  const candidates = new Uint8Array((x1 - x0) * (y1 - y0));
  let pixels = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * png.width + x) * 4;
      if (!flowerPixel(png, index)) continue;
      let touchesBotanical = false;
      for (let oy = -3; oy <= 3 && !touchesBotanical; oy += 1) {
        for (let ox = -3; ox <= 3; ox += 1) {
          const neighbour = ((y + oy) * png.width + x + ox) * 4;
          if (vegetationPixel(png, neighbour)) {
            touchesBotanical = true;
            break;
          }
        }
      }
      if (!touchesBotanical) continue;
      candidates[(y - y0) * (x1 - x0) + x - x0] = 1;
      pixels += 1;
    }
  }
  const visited = new Uint8Array(candidates.length);
  let clusters = 0;
  let acceptedPixels = 0;
  for (let seed = 0; seed < candidates.length; seed += 1) {
    if (!candidates[seed] || visited[seed]) continue;
    const stack = [seed];
    visited[seed] = 1;
    let size = 0;
    while (stack.length) {
      const current = stack.pop();
      size += 1;
      const cx = current % (x1 - x0);
      const cy = Math.floor(current / (x1 - x0));
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = cx + ox;
          const ny = cy + oy;
          if (nx < 0 || ny < 0 || nx >= x1 - x0 || ny >= y1 - y0) continue;
          const next = ny * (x1 - x0) + nx;
          if (!candidates[next] || visited[next]) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
    }
    if (size >= 2 && size <= 200) {
      clusters += 1;
      acceptedPixels += size;
    }
  }
  return { candidatePixels: pixels, pixels: acceptedPixels, clusters, passes: acceptedPixels >= 20 && clusters >= 5 };
}

function percentile95(values) {
  if (!values.length) return Number.POSITIVE_INFINITY;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)];
}

async function compareVegetation(currentPath, baselinePath, roi) {
  const [currentBuffer, baselineBuffer] = await Promise.all([readFile(currentPath), readFile(baselinePath)]);
  const currentMetric = vegetationTextureCoverage(currentBuffer, roi);
  const baselineMetric = vegetationTextureCoverage(baselineBuffer, roi);
  const current = currentMetric.texture;
  const baseline = baselineMetric.texture;
  return {
    current,
    baseline,
    ratio: baseline > 0 ? current / baseline : 1,
    botanicalCurrent: currentMetric.botanical,
    botanicalBaseline: baselineMetric.botanical,
    passes: current >= baseline * 0.98,
  };
}

async function waitForCameraSettled(page, scrollY) {
  await page.evaluate((target) => {
    globalThis.__AURA_CAMERA_PROOF__ = [];
    window.scrollTo(0, target);
    window.dispatchEvent(new Event("scroll"));
  }, scrollY);
  await page.waitForFunction(() => {
    const latest = (globalThis.__AURA_CAMERA_PROOF__ ?? []).at(-1);
    return Boolean(latest?.settled) && Math.abs(latest.current - latest.target) <= 0.0015;
  }, undefined, { timeout: 15_000 });
  return page.evaluate(() => (globalThis.__AURA_CAMERA_PROOF__ ?? []).at(-1) ?? null);
}

async function installProofObservers(page) {
  await page.addInitScript(() => {
    globalThis.__AURA_MEADOW_PROOF__ = [];
    globalThis.__AURA_FLOWER_PROOF__ = [];
    globalThis.__AURA_RENDER_PROOF__ = [];
    globalThis.__AURA_CAMERA_PROOF__ = [];
    globalThis.__AURA_CAMERA_PROOF_ACTIVE__ = true;
    globalThis.__AURA_INTERACTION_PROOF__ = [];
    globalThis.__AURA_LONG_TASK_PROOF__ = [];
    globalThis.__AURA_LOAF_PROOF__ = [];
    window.addEventListener("aura:meadow-progress", (event) => {
      globalThis.__AURA_MEADOW_PROOF__.push(event.detail);
    });
    window.addEventListener("aura:flower-visibility", (event) => {
      globalThis.__AURA_FLOWER_PROOF__.push(event.detail);
    });
    window.addEventListener("aura:render-duration", (event) => {
      globalThis.__AURA_RENDER_PROOF__.push(event.detail);
    });
    window.addEventListener("aura:camera-progress", (event) => {
      globalThis.__AURA_CAMERA_PROOF__.push(event.detail);
    });
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.interactionId > 0) globalThis.__AURA_INTERACTION_PROOF__.push(entry.duration);
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    } catch {
      globalThis.__AURA_INTERACTION_PROOF__.push(Number.POSITIVE_INFINITY);
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          globalThis.__AURA_LONG_TASK_PROOF__.push({ startTime: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {
      globalThis.__AURA_LONG_TASK_PROOF__.push({ startTime: 0, duration: Number.POSITIVE_INFINITY });
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          globalThis.__AURA_LOAF_PROOF__.push({
            startTime: entry.startTime,
            duration: entry.duration,
            blockingDuration: entry.blockingDuration,
            renderStart: entry.renderStart,
            styleAndLayoutStart: entry.styleAndLayoutStart,
            scripts: (entry.scripts ?? []).map((script) => ({
              sourceURL: script.sourceURL,
              functionName: script.functionName,
              invokerType: script.invokerType,
              duration: script.duration,
              executionStart: script.executionStart,
              forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
              pauseDuration: script.pauseDuration,
            })),
          });
        }
      }).observe({ type: "long-animation-frame", buffered: true });
    } catch {
      // Older Chrome builds still retain the standard long-task ledger.
    }
  });
}

async function waitForMeadowHandoff(page) {
  await page.locator('.story-scene-root[data-scene-phase="meadow"][data-meadow-ready="true"]').waitFor({ timeout: 120_000 });
  /* The product intentionally holds page 10 while the DOM loader completes
     its Ready hold/fade. Only its dismissal releases pages 11–44. */
  await page.locator(".aura-loader").waitFor({ state: "detached", timeout: 30_000 });
  await page.waitForFunction(() => {
    const events = globalThis.__AURA_MEADOW_PROOF__ ?? [];
    return events.some((event) => event.state === "settled" || event.state === "frozen");
  }, undefined, { timeout: 180_000 });
}

async function runMobileProof(browser) {
  const page = await browser.newPage({ viewport: MOBILE_VIEWPORT });
  await installProofObservers(page);
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.locator(".story-gate-paths button").first().click();
  await waitForMeadowHandoff(page);
  await page.waitForFunction(() => (globalThis.__AURA_FLOWER_PROOF__ ?? []).some((entry) => entry.visible > 0), undefined, { timeout: 30_000 });
  const mobileCamera = await waitForCameraSettled(page, FIXED_CAMERAS.open.scrollY);
  await page.waitForTimeout(500);
  const idleRenderStart = await page.evaluate(() => (globalThis.__AURA_RENDER_PROOF__ ?? []).length);
  await page.waitForTimeout(1_500);
  const idleRenderEnd = await page.evaluate(() => (globalThis.__AURA_RENDER_PROOF__ ?? []).length);
  const ledger = await page.evaluate(() => {
    const canvas = document.querySelector(".story-scene-root canvas");
    const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? String(gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? "") : "unreported";
    const events = [...(globalThis.__AURA_MEADOW_PROOF__ ?? [])];
    return {
      renderer,
      rendererIsSoftware: /swiftshader|software|llvmpipe/i.test(renderer),
      qualityTier: document.querySelector(".story-scene-root")?.getAttribute("data-scene-quality") ?? null,
      final: events.at(-1) ?? null,
      renderDurations: (globalThis.__AURA_RENDER_PROOF__ ?? []).map((entry) => entry.duration),
      flowerVisibility: (globalThis.__AURA_FLOWER_PROOF__ ?? []).at(-1) ?? null,
    };
  });
  await page.close();
  const mobile = {
    viewport: MOBILE_VIEWPORT,
    renderer: ledger.renderer,
    rendererIsSoftware: ledger.rendererIsSoftware,
    qualityTier: ledger.qualityTier,
    state: ledger.final?.state ?? null,
    pages: ledger.final?.pages ?? 0,
    instances: ledger.final?.instances ?? 0,
    activeFrameP95Ms: ledger.final?.governor.p95FrameMs ?? null,
    causalLongTaskMaxMs: ledger.final?.governor.maxLongTaskMs ?? null,
    fullRunRenderP95Ms: percentile95(ledger.renderDurations),
    settledDemand: { start: idleRenderStart, end: idleRenderEnd, passes: idleRenderEnd === idleRenderStart },
    camera: mobileCamera,
    flowerVisibility: ledger.flowerVisibility,
  };
  mobile.passes =
    !mobile.rendererIsSoftware &&
    mobile.state === "settled" &&
    mobile.instances > 0 &&
    mobile.activeFrameP95Ms <= 33.3 &&
    mobile.fullRunRenderP95Ms <= 33.3 &&
    mobile.causalLongTaskMaxMs <= 50 &&
    mobile.settledDemand.passes &&
    mobile.camera?.settled === true &&
    mobile.flowerVisibility?.planted === 380 &&
    mobile.flowerVisibility?.visible > 0 &&
    mobile.flowerVisibility?.source === "instanced-flower-field";
  return mobile;
}

await mkdir(OUT, { recursive: true });
const approvedBaselineBuffers = {
  open: await readFile(path.join(BASELINE, FIXED_CAMERAS.open.baseline)),
  close: await readFile(path.join(BASELINE, FIXED_CAMERAS.close.baseline)),
};
const approvedBaselineHashes = {
  open: sha256(approvedBaselineBuffers.open),
  close: sha256(approvedBaselineBuffers.close),
};
if (approvedBaselineHashes.open !== APPROVED_BASELINE_SHA256.open || approvedBaselineHashes.close !== APPROVED_BASELINE_SHA256.close) {
  throw new Error(`Approved meadow baseline hash mismatch: ${JSON.stringify(approvedBaselineHashes)}`);
}
const server = spawn("node", ["scripts/serve-export.mjs", "out", String(PORT)], { stdio: "ignore" });
await new Promise((resolve) => setTimeout(resolve, 1_500));

try {
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-angle=d3d11", "--enable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await installProofObservers(page);
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "networkidle" });
  await page.locator(".story-gate-paths button").first().click();
  await waitForMeadowHandoff(page);
  await page.waitForFunction(() => (globalThis.__AURA_FLOWER_PROOF__ ?? []).some((entry) => entry.visible > 0), undefined, { timeout: 30_000 });
  const openingCamera = await waitForCameraSettled(page, FIXED_CAMERAS.open.scrollY);

  /* Demand rendering is a product constraint, not a source-code claim. Once
     promotion is terminal, an untouched scene must stop submitting frames. */
  await page.waitForTimeout(500);
  const idleRenderStart = await page.evaluate(() => (globalThis.__AURA_RENDER_PROOF__ ?? []).length);
  await page.waitForTimeout(1_500);
  const idleRenderEnd = await page.evaluate(() => (globalThis.__AURA_RENDER_PROOF__ ?? []).length);
  const settledDemand = { start: idleRenderStart, end: idleRenderEnd, passes: idleRenderEnd === idleRenderStart };

  /* Meadow promotion evidence is captured before proof-driven camera motion,
     while the full render ledger below intentionally includes that motion. */
  const promotionEvents = await page.evaluate(() => [...(globalThis.__AURA_MEADOW_PROOF__ ?? [])]);

  const flowerVisibility = {
    open: await page.evaluate(() => (globalThis.__AURA_FLOWER_PROOF__ ?? []).at(-1) ?? null),
    close: null,
  };
  await page.screenshot({ path: screenshotPaths.open, timeout: 90_000, animations: "disabled" });

  const closeCamera = await waitForCameraSettled(page, FIXED_CAMERAS.close.scrollY);
  flowerVisibility.close = await page.evaluate(() => (globalThis.__AURA_FLOWER_PROOF__ ?? []).at(-1) ?? null);
  await page.screenshot({ path: screenshotPaths.close, timeout: 90_000, animations: "disabled" });

  /* Measure a real settled-scene interaction, independent of the entrance
     LCP/INP proof owned by R05. Restore the visual state before idling. */
  await page.evaluate(() => { globalThis.__AURA_INTERACTION_PROOF__ = []; });
  await page.getByRole("button", { name: "Switch to night" }).click();
  await page.waitForFunction(() => (globalThis.__AURA_INTERACTION_PROOF__ ?? []).length > 0, undefined, { timeout: 5_000 });
  await page.getByRole("button", { name: "Switch to day" }).click();
  await page.waitForTimeout(2_500);
  const closeIdleStart = await page.evaluate(() => (globalThis.__AURA_RENDER_PROOF__ ?? []).length);
  await page.waitForTimeout(1_500);
  const closeIdleEnd = await page.evaluate(() => (globalThis.__AURA_RENDER_PROOF__ ?? []).length);
  const cameraSettledDemand = { start: closeIdleStart, end: closeIdleEnd, passes: closeIdleStart === closeIdleEnd };

  const runtime = await page.evaluate(() => {
    const canvas = document.querySelector(".story-scene-root canvas");
    const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    const debug = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? String(gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? "") : "unreported";
    return {
      renderer,
      rendererIsSoftware: /swiftshader|software|llvmpipe/i.test(renderer),
      renderDurations: (globalThis.__AURA_RENDER_PROOF__ ?? []).map((entry) => entry.duration),
      interactionDurations: [...(globalThis.__AURA_INTERACTION_PROOF__ ?? [])],
      longTasks: [...(globalThis.__AURA_LONG_TASK_PROOF__ ?? [])],
      longAnimationFrames: [...(globalThis.__AURA_LOAF_PROOF__ ?? [])],
    };
  });
  const final = promotionEvents.at(-1) ?? null;
  const fullRunRenderP95Ms = percentile95(runtime.renderDurations);
  const interactionMs = runtime.interactionDurations.length ? Math.max(...runtime.interactionDurations) : Number.POSITIVE_INFINITY;
  const fullRunMaxLongTaskMs = runtime.longTasks.length ? Math.max(...runtime.longTasks.map((entry) => entry.duration)) : 0;
  const coverage = {
    open: await compareVegetation(
      screenshotPaths.open,
      path.join(BASELINE, FIXED_CAMERAS.open.baseline),
      FIXED_CAMERAS.open.roi,
    ),
    close: await compareVegetation(
      screenshotPaths.close,
      path.join(BASELINE, FIXED_CAMERAS.close.baseline),
      FIXED_CAMERAS.close.roi,
    ),
  };
  const flowerPixels = {
    open: flowerPixelClusters(await readFile(screenshotPaths.open), FIXED_CAMERAS.open.roi),
    close: flowerPixelClusters(await readFile(screenshotPaths.close), FIXED_CAMERAS.close.roi),
  };
  const mobile = await runMobileProof(browser);
  const report = {
    schema: "MeadowHardwareProofV2",
    createdAt: new Date().toISOString(),
    screenshotPaths,
    approvedBaselineHashes,
    renderer: runtime.renderer,
    rendererIsSoftware: runtime.rendererIsSoftware,
    progress: final,
    promotionEvents,
    activeFrameP95Ms: final?.governor.p95FrameMs ?? null,
    fullRunRenderP95Ms,
    fullRunMaxLongTaskMs,
    fullRunLongTasks: runtime.longTasks,
    fullRunLongAnimationFrames: runtime.longAnimationFrames,
    interactionMs,
    settledDemand,
    cameraSettledDemand,
    camera: { open: openingCamera, close: closeCamera },
    coverage,
    flowerVisibility,
    flowerPixelClusters: flowerPixels,
    mobile,
    passes:
      Boolean(final) &&
      !runtime.rendererIsSoftware &&
      final.state === "settled" &&
      final.instances > 0 &&
      fullRunRenderP95Ms <= 16.7 &&
      final.governor.maxLongTaskMs <= 50 &&
      interactionMs <= 160 &&
      settledDemand.passes &&
      cameraSettledDemand.passes &&
      openingCamera?.settled === true &&
      closeCamera?.settled === true &&
      coverage.open.passes &&
      coverage.close.passes &&
      flowerVisibility.open?.source === "instanced-flower-field" &&
      flowerVisibility.close?.source === "instanced-flower-field" &&
      flowerVisibility.open?.visible > 0 &&
      flowerVisibility.close?.visible > 0 &&
      flowerPixels.open.passes &&
      flowerPixels.close.passes &&
      mobile.passes,
  };
  await writeFile(screenshotPaths.report, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.passes) process.exitCode = 1;
} finally {
  server.kill();
}
