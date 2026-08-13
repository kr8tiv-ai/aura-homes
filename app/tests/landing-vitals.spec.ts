import { expect, test, type Page } from "playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const RUN_COUNT = 5;
const LCP_SETTLE_MS = 750;
const baseURL = process.env.AURA_TEST_BASE_URL;
const VITAL_THRESHOLDS = {
  lcpMs: 2_000,
  inpMs: 160,
  cls: 0.08,
} as const;

if (baseURL) test.use({ baseURL });

type VitalSnapshot = {
  lcp: number;
  lcpElement: string;
  cls: number;
  longestInteraction: number;
  interactionCount: number;
  observerSupport: {
    lcp: boolean;
    cls: boolean;
    event: boolean;
  };
  observerErrors: string[];
};

type VitalRun = {
  run: number;
  lcpMs: number;
  lcpElement: string;
  inpMs: number;
  cls: number;
  interactionCount: number;
  observerSupport: VitalSnapshot["observerSupport"];
  observerErrors: string[];
};

function percentile75(values: number[]) {
  if (values.length === 0) throw new Error("p75 requires at least one measurement");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * 0.75) - 1];
}

async function readVitals(page: Page) {
  return page.evaluate(() => {
    return (globalThis as typeof globalThis & { __AURA_VITALS__: VitalSnapshot }).__AURA_VITALS__;
  });
}

async function waitForSettledLcp(page: Page) {
  const deadline = Date.now() + 7_000;
  let lastLcp = -1;
  let stableSince = Date.now();

  while (Date.now() < deadline) {
    const { lcp } = await readVitals(page);
    if (lcp > 0 && lcp === lastLcp && Date.now() - stableSince >= LCP_SETTLE_MS) return;
    if (lcp !== lastLcp) {
      lastLcp = lcp;
      stableSince = Date.now();
    }
    await page.waitForTimeout(100);
  }

  throw new Error(`LCP did not settle for ${LCP_SETTLE_MS} ms before the interaction`);
}

test("the entrance paints and restores focus before starting its WebGL probe", async ({ page }) => {
  await page.addInitScript(() => {
    const trace = { clickStart: Number.POSITIVE_INFINITY, hudFocus: 0, contextStarts: [] as number[] };
    Object.defineProperty(globalThis, "__AURA_ENTRY_TRACE__", { value: trace });

    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (performance.now() >= trace.clickStart && String(type).startsWith("webgl")) {
        trace.contextStarts.push(performance.now());
      }
      return Reflect.apply(nativeGetContext, this, [type, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;

    document.addEventListener("focusin", (event) => {
      const element = event.target;
      if (element instanceof HTMLElement && element.getAttribute("aria-label") === "Switch to the X Layer ecosystem") {
        trace.hudFocus = performance.now();
      }
    });
  });

  await page.goto("/", { waitUntil: "load" });
  const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
  const enter = gate.getByRole("button", { name: /Build an eco home/ });
  await expect(enter).toBeFocused();
  await page.evaluate(() => {
    (globalThis as typeof globalThis & {
      __AURA_ENTRY_TRACE__: { clickStart: number };
    }).__AURA_ENTRY_TRACE__.clickStart = performance.now();
  });
  await enter.click();
  await expect(gate).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Switch to the X Layer ecosystem" })).toBeFocused();
  await expect.poll(async () => page.evaluate(() => {
    return (globalThis as typeof globalThis & {
      __AURA_ENTRY_TRACE__: { contextStarts: number[] };
    }).__AURA_ENTRY_TRACE__.contextStarts.length;
  })).toBeGreaterThan(0);

  const trace = await page.evaluate(() => {
    return (globalThis as typeof globalThis & {
      __AURA_ENTRY_TRACE__: { clickStart: number; hudFocus: number; contextStarts: number[] };
    }).__AURA_ENTRY_TRACE__;
  });
  expect(trace.hudFocus).toBeGreaterThan(trace.clickStart);
  expect(trace.contextStarts[0]).toBeGreaterThanOrEqual(trace.hudFocus);
});

test("the poster-first entrance meets p75 CWV budgets across five fresh cold contexts", async ({ browser }, testInfo) => {
  test.setTimeout(90_000);
  const runs: VitalRun[] = [];

  for (let run = 1; run <= RUN_COUNT; run += 1) {
    const context = await browser.newContext({
      viewport: { width: 1_440, height: 900 },
      reducedMotion: "no-preference",
      serviceWorkers: "block",
    });

    try {
      const page = await context.newPage();
      await page.addInitScript(() => {
        const supported = new Set(PerformanceObserver.supportedEntryTypes);
        const metrics: VitalSnapshot = {
          lcp: 0,
          lcpElement: "",
          cls: 0,
          longestInteraction: 0,
          interactionCount: 0,
          observerSupport: {
            lcp: supported.has("largest-contentful-paint"),
            cls: supported.has("layout-shift"),
            event: supported.has("event"),
          },
          observerErrors: [],
        };
        Object.defineProperty(globalThis, "__AURA_VITALS__", { value: metrics, writable: false });

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const lcp = entry as PerformanceEntry & { element?: Element };
              metrics.lcp = lcp.startTime;
              metrics.lcpElement = lcp.element instanceof Element
                ? `${lcp.element.tagName.toLowerCase()}.${Array.from(lcp.element.classList).join(".")}`
                : "";
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch (error) {
          metrics.observerErrors.push(`lcp: ${String(error)}`);
        }

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as PerformanceEntryList & ArrayLike<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
              if (!entry.hadRecentInput) metrics.cls += entry.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
        } catch (error) {
          metrics.observerErrors.push(`cls: ${String(error)}`);
        }

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as PerformanceEntryList & ArrayLike<PerformanceEntry & { duration: number; interactionId: number }>) {
              if (entry.interactionId > 0) {
                metrics.interactionCount += 1;
                metrics.longestInteraction = Math.max(metrics.longestInteraction, entry.duration);
              }
            }
          }).observe({
            type: "event",
            buffered: true,
            durationThreshold: 16,
          } as PerformanceObserverInit);
        } catch (error) {
          metrics.observerErrors.push(`event: ${String(error)}`);
        }
      });

      await page.goto("/", { waitUntil: "load" });
      const gate = page.getByRole("dialog", { name: "Choose an Aura Homes journey" });
      const enter = gate.getByRole("button", { name: /Build an eco home/ });
      await expect(page.locator("img.story-gate-poster")).toBeVisible();
      await expect(gate).toHaveAttribute("data-poster-ready", "true");

      // LCP reporting stops on the first interaction. Give the last candidate
      // a quiet window before clicking so the test cannot truncate the metric.
      await waitForSettledLcp(page);
      await enter.click();
      await expect(gate).toHaveCount(0);
      await expect.poll(async () => (await readVitals(page)).interactionCount, {
        message: `run ${run} did not capture an Event Timing interaction`,
        timeout: 5_000,
      }).toBeGreaterThan(0);

      const snapshot = await readVitals(page);
      runs.push({
        run,
        lcpMs: snapshot.lcp,
        lcpElement: snapshot.lcpElement,
        inpMs: snapshot.longestInteraction,
        cls: snapshot.cls,
        interactionCount: snapshot.interactionCount,
        observerSupport: snapshot.observerSupport,
        observerErrors: snapshot.observerErrors,
      });
    } finally {
      await context.close();
    }
  }

  const p75 = {
    lcpMs: percentile75(runs.map((run) => run.lcpMs)),
    inpMs: percentile75(runs.map((run) => run.inpMs)),
    cls: percentile75(runs.map((run) => run.cls)),
  };
  const evidence = {
    schema: "AuraLandingVitalsProofV1",
    measuredAt: new Date().toISOString(),
    method: {
      environment: "local static export, unthrottled Chromium",
      runs: RUN_COUNT,
      cache: "new isolated browser context and blocked service workers for every run",
      lcp: `${LCP_SETTLE_MS} ms quiet window before the first interaction`,
      percentile: "nearest-rank p75 across fresh contexts",
      limitation: "This repeatable lab gate complements, but does not replace, field Core Web Vitals.",
    },
    thresholds: VITAL_THRESHOLDS,
    browser: {
      name: browser.browserType().name(),
      version: browser.version(),
      viewport: { width: 1_440, height: 900 },
    },
    runs,
    p75,
  };

  await testInfo.attach("r05-cwv-measurements.json", {
    body: Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`),
    contentType: "application/json",
  });
  const evidencePath = resolve(process.cwd(), "shots/r05-film/cwv-proof.json");
  mkdirSync(dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`R05 CWV runs: ${JSON.stringify(runs)}`);
  console.log(`R05 CWV p75: ${JSON.stringify(p75)}; evidence: ${evidencePath}`);

  expect(runs).toHaveLength(RUN_COUNT);
  for (const run of runs) {
    expect(run.observerSupport, `observer support in run ${run.run}`).toEqual({ lcp: true, cls: true, event: true });
    expect(run.observerErrors, `observer errors in run ${run.run}`).toEqual([]);
    expect(run.lcpMs, `LCP capture in run ${run.run}`).toBeGreaterThan(0);
    expect(run.lcpElement, `LCP element in run ${run.run}`).toMatch(
      /(?:img\.story-gate-(?:poster|video)|h1\.story-display\.story-gate-title)/,
    );
    expect(run.interactionCount, `Event Timing capture in run ${run.run}`).toBeGreaterThan(0);
    expect(run.inpMs, `INP capture in run ${run.run}`).toBeGreaterThan(0);
  }
  expect(p75.lcpMs).toBeLessThanOrEqual(VITAL_THRESHOLDS.lcpMs);
  expect(p75.inpMs).toBeLessThanOrEqual(VITAL_THRESHOLDS.inpMs);
  expect(p75.cls).toBeLessThanOrEqual(VITAL_THRESHOLDS.cls);
});
