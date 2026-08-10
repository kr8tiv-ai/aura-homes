#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   AURA HOMES — INSPECTION HARNESS
   scripts/inspect.mjs

   What this is: the eyes the critics use. It drives a real Chromium against a
   running build, captures every console message and page error, drives the
   scroll story to exact fractions, waits for the DAMPED CAMERA TO SETTLE
   (measured in rendered frames, not wall-clock — SwiftShader advances per
   frame, so sleeping is a lie), and writes screenshots plus machine-readable
   JSON.

   It touches no app source. It only reads the served pages.

   ---- WHY FRAMES, NOT TIMERS -------------------------------------------------
   components/story/Scene.tsx damps the camera with
   THREE.MathUtils.damp(smooth, progress, 5, min(dt, 1/20)). Under software GL
   a frame can take 200ms while damping only advances 50ms of simulated time.
   A wall-clock sleep therefore screenshots a camera still in flight. This
   harness instead renders frames until the picture stops changing.

   ---- HOW "SETTLED" IS DECIDED (and how it can fail) -------------------------
   Every few frames it grabs a 64x40 thumbnail of the WebGL canvas and computes
   the mean absolute pixel delta against the previous thumbnail.
     * HARD SETTLE  — delta < --epsilon for --stable consecutive checks.
     * PLATEAU      — the scene has ambient drift (aurora, water, grass) that
                      never reaches zero, so a plateau above the noise floor
                      also counts: the last 5 deltas all sit within 1.4x of the
                      smallest delta seen, after at least 8 checks.
     * BUDGET       — neither happened before --frames-max: recorded as
                      settled:false. The shot is still written, and the report
                      says it never settled. This is the failure mode; it is
                      not silently swallowed.
   Every delta series is written into report.json, so the settle claim is
   auditable rather than asserted.

   Reading canvas pixels needs a retained drawing buffer, which the app does not
   request. An init script forces preserveDrawingBuffer:true on every WebGL
   context. That changes buffer retention only, never what is drawn.

   ---- WHY --use-angle=gl (MEASURED, NOT ASSUMED) -----------------------------
   Headless Chromium defaults to the SwiftShader software rasteriser, which on
   this scene renders 0.54 fps. At that rate Playwright's own click actionability
   check (which needs two consecutive stable animation frames) cannot even
   complete inside a 5s timeout, so the story's enter-gate never opens and every
   screenshot is the gate. Measured on the story page, 1440x900:
       --use-gl=swiftshader ....  0.54 fps   (SwiftShader Device, Subzero)
       (no flags, default) .....  0.53 fps   (falls back to SwiftShader)
       --use-angle=d3d11 ....... 30.95 fps   (AMD Radeon 740M, D3D11)
       --use-angle=gl .......... 60.02 fps   (AMD Radeon 740M, OpenGL 4.5)
   So the harness asks for the real GPU through ANGLE and records the actual
   renderer string in report.json. If it lands on SwiftShader anyway it says so
   and automatically widens the frame/time budgets rather than quietly
   screenshotting a camera still in flight.

   ---- BLANK DETECTION --------------------------------------------------------
   Three independent signals, all recorded per shot, so a broken page scores
   differently from a good one:
     1. bytes        — PNG file size (a flat page compresses to a few KB).
     2. canvasVar    — variance of the canvas thumbnail (a dead scene is ~0).
     3. domStats     — visible element count, rendered text length, body colour.
   --min-bytes (default 20480) and a zero-text DOM both fail the run.

   ---- EXIT CODES -------------------------------------------------------------
     0  clean
     1  a hard failure: page error, undersized/blank shot, missing text,
        failed request of a same-origin asset, or a shot that never settled
     2  bad usage / harness could not start
   Pass --no-fail to always exit 0 (capture-only mode).
--------------------------------------------------------------------------- */

import { chromium } from "playwright";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/* ----------------------------- usage --------------------------------- */

const USAGE = `
aura inspect — headless inspection harness

  node scripts/inspect.mjs --url <base> [options]

Options
  --url <base>          Base URL. Default http://localhost:4321
  --route <p[,p...]>    Route(s) to inspect. Repeatable. Default /
  --viewport <WxH[,..]> Viewport(s). Repeatable. Default 1440x900
  --out <dir>           Output directory. Default scripts/__inspect
  --scroll <f[,f...]>   Scroll fractions 0..1.
                        Default 0,0.15,0.3,0.45,0.6,0.75,0.9,1
  --gate <mode>         Story enter-gate: silent | sound | none. Default silent
  --click <selector>    Extra selector to click after load. Repeatable
  --night               Click the HUD night toggle before capturing
  --fullpage            Also write one full-page screenshot per route
  --frames-min <n>      Minimum frames rendered per position. Default 45
  --frames-max <n>      Frame budget per position before giving up. Default 900
  --min-time <ms>       Minimum real time per position (covers the intro
                        dolly, which is clock-driven). Default 2600
  --epsilon <f>         Hard-settle pixel delta threshold, 0..1. Default 0.0035
  --stable <n>          Consecutive sub-epsilon checks required. Default 3
  --check-every <n>     Frames between settle probes. Default 3
  --min-bytes <n>       Fail a shot smaller than this. Default 20480
  --timeout <ms>        Navigation timeout. Default 45000
  --scale <n>           deviceScaleFactor. Default 1
  --gl <mode>           GL backend: gl | d3d11 | swiftshader. Default gl
                        (real GPU via ANGLE — 60 fps vs 0.5 fps software)
  --reduced             Emulate prefers-reduced-motion: reduce
  --dark                Emulate prefers-color-scheme: dark
  --headed              Run with a visible browser
  --no-fail             Always exit 0
  --quiet               Less stdout
  -h, --help            This text

Writes
  <out>/report.json                              every measurement, all routes
  <out>/<route>/<viewport>/console.json          console + errors + failed reqs
  <out>/<route>/<viewport>/s00_p0.000.png        one shot per scroll fraction
  <out>/<route>/<viewport>/fullpage.png          with --fullpage
`;

/* --------------------------- arg parsing ------------------------------ */

function parseArgs(argv) {
  const o = {
    url: "http://localhost:4321",
    routes: [],
    viewports: [],
    out: null,
    scroll: null,
    gate: "silent",
    clicks: [],
    night: false,
    fullpage: false,
    framesMin: 45,
    framesMax: 900,
    minTime: 2600,
    epsilon: 0.0035,
    stable: 3,
    checkEvery: 3,
    minBytes: 20480,
    timeout: 45000,
    scale: 1,
    gl: "gl",
    reduced: false,
    dark: false,
    headed: false,
    fail: true,
    quiet: false,
  };
  const list = (v) => String(v).split(",").map((s) => s.trim()).filter(Boolean);

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) die(`missing value for ${a}`);
      return v;
    };
    switch (a) {
      case "-h": case "--help": console.log(USAGE); process.exit(0); break;
      case "--url": o.url = next(); break;
      case "--route": case "--routes": o.routes.push(...list(next())); break;
      case "--viewport": case "--viewports": o.viewports.push(...list(next())); break;
      case "--out": o.out = next(); break;
      case "--scroll": o.scroll = list(next()).map(Number); break;
      case "--gate": o.gate = next(); break;
      case "--click": o.clicks.push(next()); break;
      case "--night": o.night = true; break;
      case "--fullpage": o.fullpage = true; break;
      case "--frames-min": o.framesMin = +next(); break;
      case "--frames-max": o.framesMax = +next(); break;
      case "--min-time": o.minTime = +next(); break;
      case "--epsilon": o.epsilon = +next(); break;
      case "--stable": o.stable = +next(); break;
      case "--check-every": o.checkEvery = +next(); break;
      case "--min-bytes": o.minBytes = +next(); break;
      case "--timeout": o.timeout = +next(); break;
      case "--scale": o.scale = +next(); break;
      case "--gl": o.gl = next(); break;
      case "--reduced": o.reduced = true; break;
      case "--dark": o.dark = true; break;
      case "--headed": o.headed = true; break;
      case "--no-fail": o.fail = false; break;
      case "--quiet": o.quiet = true; break;
      default: die(`unknown option: ${a}`);
    }
  }

  if (!o.routes.length) o.routes = ["/"];
  if (!o.viewports.length) o.viewports = ["1440x900"];
  if (!o.scroll) o.scroll = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
  if (!o.out) o.out = path.join(process.cwd(), "scripts", "__inspect");
  o.out = path.resolve(o.out);
  o.url = o.url.replace(/\/+$/, "");
  if (!["silent", "sound", "none"].includes(o.gate)) die(`--gate must be silent|sound|none`);
  if (!["gl", "d3d11", "swiftshader"].includes(o.gl)) die(`--gl must be gl|d3d11|swiftshader`);
  if (o.scroll.some((f) => !(f >= 0 && f <= 1))) die(`--scroll fractions must be 0..1`);
  return o;
}

function die(msg) {
  console.error(`inspect: ${msg}\n${USAGE}`);
  process.exit(2);
}

const slug = (r) => {
  const s = r.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9._-]+/gi, "-");
  return s || "root";
};
const parseVp = (v) => {
  const m = /^(\d+)x(\d+)$/.exec(v);
  if (!m) die(`bad viewport "${v}", expected WxH e.g. 1440x900`);
  return { width: +m[1], height: +m[2] };
};

/* ------------------- page-side instrumentation ------------------------ */
/* Installed before any app script runs. Adds:
   - forced preserveDrawingBuffer so canvas pixels are readable
   - a free-running rAF frame counter
   - __auraSettle(): renders frames until the picture stops changing
   - __auraDom():    cheap structural stats for blank-page detection        */

const INIT_SCRIPT = `(() => {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
      attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
    }
    return origGetContext.call(this, type, attrs);
  };

  let frames = 0;
  const tick = () => { frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  Object.defineProperty(window, "__auraFrames", { get: () => frames });

  const TW = 64, TH = 40;
  let off = null, octx = null;
  function biggestCanvas() {
    // The CardFX tracer overlay (components/CardFX.tsx) is a transparent
    // pointer-events-none canvas present on EVERY page — it is chrome, not
    // the scene, and a mostly-empty overlay reads as variance 0. Excluding
    // it by class keeps the flat/dead-scene check falsifiable for the real
    // canvas: delete the story canvas and this check still fires.
    const cs = Array.from(document.querySelectorAll("canvas"))
      .filter((c) => c.width > 8 && c.height > 8 && !c.classList.contains("fx-tracer-canvas"));
    if (!cs.length) return null;
    return cs.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  }
  function sample() {
    const c = biggestCanvas();
    if (!c) return null;
    if (!off) { off = document.createElement("canvas"); off.width = TW; off.height = TH;
                octx = off.getContext("2d", { willReadFrequently: true }); }
    try {
      octx.clearRect(0, 0, TW, TH);
      octx.drawImage(c, 0, 0, TW, TH);
      return octx.getImageData(0, 0, TW, TH).data;
    } catch (e) { return null; }
  }
  function meanAbsDiff(a, b) {
    let s = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) { // RGB only, skip alpha
      s += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
      n += 3;
    }
    return s / n / 255;
  }
  function variance(a) {
    let sum = 0, sq = 0, n = 0;
    for (let i = 0; i < a.length; i += 4) {
      const l = (a[i] * 0.299 + a[i+1] * 0.587 + a[i+2] * 0.114);
      sum += l; sq += l * l; n++;
    }
    const m = sum / n;
    return sq / n - m * m;
  }

  window.__auraSettle = (opt) => new Promise((resolve) => {
    const t0 = performance.now();
    const f0 = frames;
    const diffs = [];
    let prev = null, stableCount = 0, lastVar = null, done = false;

    const finish = (how) => {
      if (done) return; done = true;
      const min = diffs.length ? Math.min(...diffs) : null;
      resolve({
        how,
        settled: how === "epsilon" || how === "plateau" || how === "no-canvas",
        frames: frames - f0,
        elapsedMs: Math.round(performance.now() - t0),
        checks: diffs.length,
        diffs: diffs.map((d) => +d.toFixed(6)),
        lastDiff: diffs.length ? +diffs[diffs.length - 1].toFixed(6) : null,
        minDiff: min === null ? null : +min.toFixed(6),
        canvasVar: lastVar === null ? null : +lastVar.toFixed(3),
        hasCanvas: !!biggestCanvas(),
      });
    };

    const hardStop = setTimeout(() => finish("timeout"), Math.max(5000, opt.hardStopMs || 45000));

    const step = () => {
      if (done) return;
      const f = frames - f0;
      const t = performance.now() - t0;

      if (f > 0 && f % opt.checkEvery === 0) {
        const s = sample();
        if (s) {
          lastVar = variance(s);
          if (prev) {
            const d = meanAbsDiff(prev, s);
            diffs.push(d);
            if (d < opt.epsilon) stableCount++; else stableCount = 0;
          }
          prev = s;
        }
      }

      const ready = f >= opt.framesMin && t >= opt.minTime;
      if (ready) {
        if (!biggestCanvas()) { clearTimeout(hardStop); return finish("no-canvas"); }
        if (stableCount >= opt.stable) { clearTimeout(hardStop); return finish("epsilon"); }
        if (diffs.length >= 8) {
          const min = Math.min(...diffs);
          const tail = diffs.slice(-5);
          if (min > 0 && Math.max(...tail) <= min * 1.4) { clearTimeout(hardStop); return finish("plateau"); }
        }
      }
      if (f >= opt.framesMax) { clearTimeout(hardStop); return finish("budget"); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  window.__auraDom = () => {
    const vis = Array.from(document.body ? document.body.querySelectorAll("*") : []).filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.01;
    });
    return {
      title: document.title,
      textLength: (document.body ? document.body.innerText : "").trim().length,
      visibleElements: vis.length,
      canvases: document.querySelectorAll("canvas").length,
      images: document.querySelectorAll("img").length,
      brokenImages: Array.from(document.querySelectorAll("img"))
        .filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
      bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null,
      htmlClass: document.documentElement.className,
      scrollHeight: document.documentElement.scrollHeight,
      innerHeight: window.innerHeight,
      docFonts: document.fonts ? document.fonts.status : "n/a",
    };
  };

  window.__auraScrollTo = (f) => {
    const el = document.documentElement;
    const prevBehavior = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    const max = Math.max(0, el.scrollHeight - window.innerHeight);
    const y = Math.round(max * f);
    window.scrollTo(0, y);
    el.style.scrollBehavior = prevBehavior;
    return { requested: f, y, scrollY: window.scrollY, max, locked: el.classList.contains("story-gated") };
  };
})();`;

/* ------------------------------ main ---------------------------------- */

const opt = parseArgs(process.argv);
const log = (...a) => { if (!opt.quiet) console.log(...a); };

const report = {
  tool: "aura inspect",
  version: "1.0.0",
  startedAt: new Date().toISOString(),
  base: opt.url,
  options: {
    scroll: opt.scroll, gate: opt.gate, framesMin: opt.framesMin, framesMax: opt.framesMax,
    minTime: opt.minTime, epsilon: opt.epsilon, stable: opt.stable, checkEvery: opt.checkEvery,
    minBytes: opt.minBytes, scale: opt.scale, reduced: opt.reduced, dark: opt.dark,
  },
  pages: [],
  failures: [],
  ok: true,
};

const GL_ARGS = {
  gl: ["--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
  d3d11: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"],
  swiftshader: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
};

let browser;
try {
  browser = await chromium.launch({
    headless: !opt.headed,
    args: [
      ...GL_ARGS[opt.gl],
      "--disable-dev-shm-usage",
      "--mute-audio",
      "--font-render-hinting=none",
    ],
  });
} catch (e) {
  console.error(`inspect: could not launch chromium — ${e.message}`);
  console.error(`inspect: run "npx playwright install chromium" inside app/`);
  process.exit(2);
}

await mkdir(opt.out, { recursive: true });

for (const route of opt.routes) {
  for (const vpStr of opt.viewports) {
    const vp = parseVp(vpStr);
    const dir = path.join(opt.out, slug(route), vpStr);
    await mkdir(dir, { recursive: true });

    const rec = {
      route, viewport: vpStr, dir,
      url: null, status: null,
      dom: null, shots: [], failures: [],
      counts: { consoleError: 0, consoleWarning: 0, pageError: 0, requestFailed: 0, httpError: 0 },
    };

    const messages = [];
    let phase = "boot";

    const context = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: opt.scale,
      reducedMotion: opt.reduced ? "reduce" : "no-preference",
      colorScheme: opt.dark ? "dark" : "light",
      ignoreHTTPSErrors: true,
    });
    await context.addInitScript(INIT_SCRIPT);
    const page = await context.newPage();

    page.on("console", (m) => {
      const t = m.type();
      const entry = {
        kind: "console", type: t, text: m.text(),
        location: m.location(), phase, at: new Date().toISOString(),
      };
      messages.push(entry);
      if (t === "error") rec.counts.consoleError++;
      else if (t === "warning") rec.counts.consoleWarning++;
    });
    page.on("pageerror", (err) => {
      messages.push({
        kind: "pageerror", type: "error", text: String(err && err.message ? err.message : err),
        stack: err && err.stack ? String(err.stack) : null, phase, at: new Date().toISOString(),
      });
      rec.counts.pageError++;
    });
    page.on("requestfailed", (req) => {
      messages.push({
        kind: "requestfailed", type: "error", url: req.url(), method: req.method(),
        resourceType: req.resourceType(),
        failure: req.failure() ? req.failure().errorText : null,
        phase, at: new Date().toISOString(),
      });
      rec.counts.requestFailed++;
    });
    page.on("response", (res) => {
      const s = res.status();
      if (s >= 400) {
        messages.push({
          kind: "httperror", type: "error", url: res.url(), status: s,
          method: res.request().method(), resourceType: res.request().resourceType(),
          phase, at: new Date().toISOString(),
        });
        rec.counts.httpError++;
      }
    });
    page.on("crash", () => {
      messages.push({ kind: "crash", type: "error", text: "page crashed", phase, at: new Date().toISOString() });
      rec.counts.pageError++;
    });

    /* ------------------------- navigate ------------------------- */
    let target = opt.url + (route.startsWith("/") ? route : "/" + route);
    log(`\n▸ ${route}  @ ${vpStr}`);
    try {
      let resp = await page.goto(target, { waitUntil: "load", timeout: opt.timeout });
      // static export uses trailingSlash:true — retry once with the slash
      if (resp && resp.status() === 404 && !target.endsWith("/")) {
        target += "/";
        resp = await page.goto(target, { waitUntil: "load", timeout: opt.timeout });
      }
      rec.url = target;
      rec.status = resp ? resp.status() : null;
      if (rec.status && rec.status >= 400) rec.failures.push(`navigation returned HTTP ${rec.status}`);
    } catch (e) {
      rec.failures.push(`navigation failed: ${e.message}`);
      rec.url = target;
      report.pages.push(rec);
      await writeFile(path.join(dir, "console.json"), JSON.stringify({ route, viewport: vpStr, url: target, counts: rec.counts, messages }, null, 2));
      await context.close();
      continue;
    }

    phase = "settle-boot";
    try { await page.waitForLoadState("networkidle", { timeout: opt.timeout }); }
    catch { messages.push({ kind: "harness", type: "warning", text: "networkidle not reached before timeout", phase, at: new Date().toISOString() }); }
    try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch {}

    /* ------------- what actually rendered this, and how fast ------------- */
    /* Recorded, never assumed: a SwiftShader fallback changes every timing
       decision below, so it is measured and reported. */
    rec.renderer = await page.evaluate(() => {
      try {
        const c = document.createElement("canvas");
        const gl = c.getContext("webgl2") || c.getContext("webgl");
        if (!gl) return "NO WEBGL";
        const d = gl.getExtension("WEBGL_debug_renderer_info");
        return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      } catch (e) { return `probe failed: ${e.message}`; }
    });
    const software = /swiftshader|software|llvmpipe/i.test(String(rec.renderer));
    rec.softwareRenderer = software;
    log(`   gpu: ${rec.renderer}${software ? "  ⚠ SOFTWARE RASTERISER — budgets widened" : ""}`);
    if (rec.renderer === "NO WEBGL") rec.failures.push("no WebGL context available — the 3D story cannot be judged from these shots");

    /* The frame budget is safe at any speed — that is the point of counting
       frames. Only the wall-clock guard rail has to stretch, and only when
       the renderer is genuinely software: under SwiftShader a 900-frame
       budget would run for half an hour, so it is cut to something a critic
       will actually wait for. This keys off the renderer string, NOT off a
       measured fps, because an fps sample taken while the scene is still
       booting under-reads badly and would silently shrink the budget on a
       perfectly fast machine. */
    const settleOpts = {
      framesMin: opt.framesMin,
      framesMax: software ? Math.min(opt.framesMax, 120) : opt.framesMax,
      minTime: opt.minTime,
      epsilon: opt.epsilon, stable: opt.stable, checkEvery: opt.checkEvery,
      hardStopMs: software ? 300000 : Math.max(20000, opt.timeout),
    };
    rec.settleOpts = settleOpts;

    /* --------------------- dismiss the story gate --------------------- */
    /* components/story/StoryChrome.tsx locks scrolling behind .story-gate
       until it is clicked. Without this the story never scrolls and every
       shot is the gate — which is exactly what happened on the first run of
       this harness, under SwiftShader: Playwright's click actionability check
       waits for two consecutive stable animation frames, and at 0.5 fps that
       is ~6s, past any sane click timeout. So: try the real click first
       (it exercises the real hit target), and fall back to dispatching the
       DOM click, which needs no frames at all. Either way, verify the lock
       is gone rather than trusting the click. */
    const clickHard = async (selector, label) => {
      const exists = await page.locator(selector).count();
      if (!exists) return `${label}: no such element (${selector})`;
      try {
        await page.locator(selector).first().click({ timeout: 6000 });
        return `${label}: clicked ${selector}`;
      } catch {
        const ok = await page.evaluate((s) => {
          const el = document.querySelector(s);
          if (!el) return false;
          el.click();
          return true;
        }, selector);
        return ok ? `${label}: DOM-dispatched ${selector} (actionability click timed out)`
                  : `${label}: click failed on ${selector}`;
      }
    };

    if (opt.gate !== "none") {
      const sel = opt.gate === "sound" ? ".story-gate-btn" : ".story-gate-quiet";
      rec.gate = await clickHard(sel, "gate");
      await page.waitForSelector(".story-gate", { state: "detached", timeout: 10000 }).catch(() => {});
      const stillLocked = await page.evaluate(() =>
        document.documentElement.classList.contains("story-gated") || !!document.querySelector(".story-gate")
      );
      if (stillLocked) {
        rec.gate += " — BUT the gate is still up and scroll is still locked";
        rec.failures.push(rec.gate);
      }
    } else rec.gate = "skipped (--gate none)";

    if (opt.night) rec.night = await clickHard(".story-hud button[aria-label*='night' i]", "night");
    for (const sel of opt.clicks) {
      const r = await clickHard(sel, "--click");
      rec.clicks = rec.clicks || [];
      rec.clicks.push(r);
      if (/click failed|no such element/.test(r)) rec.failures.push(r);
    }

    // let the scene take the stage after the gate before the first shot
    rec.bootSettle = await page.evaluate((o) => window.__auraSettle(o), settleOpts);

    /* fps measured now, with the real scene running — recorded as evidence of
       how the shots below were produced, not used to change any threshold. */
    rec.fps = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t0 = performance.now();
      const step = () => {
        n++;
        if (performance.now() - t0 < 1200) requestAnimationFrame(step);
        else res(+(n / ((performance.now() - t0) / 1000)).toFixed(2));
      };
      requestAnimationFrame(step);
    }));
    log(`   running at ${rec.fps} fps`);

    rec.dom = await page.evaluate(() => window.__auraDom());

    /* ------------------------ scroll + shoot ------------------------ */
    for (let i = 0; i < opt.scroll.length; i++) {
      const f = opt.scroll[i];
      phase = `scroll:${f}`;
      const pos = await page.evaluate((x) => window.__auraScrollTo(x), f);
      const settle = await page.evaluate((o) => window.__auraSettle(o), settleOpts);

      const name = `s${String(i).padStart(2, "0")}_p${f.toFixed(3)}.png`;
      const file = path.join(dir, name);
      await page.screenshot({ path: file, fullPage: false });
      const bytes = (await stat(file)).size;

      const shot = { index: i, fraction: f, file, name, bytes, scroll: pos, settle };
      const bad = [];
      if (bytes < opt.minBytes) bad.push(`shot ${name} is ${bytes} bytes (< ${opt.minBytes}) — likely blank`);
      if (!settle.settled) bad.push(`shot ${name} never settled (${settle.how}, ${settle.frames} frames, lastDiff ${settle.lastDiff})`);
      if (settle.hasCanvas && settle.canvasVar !== null && settle.canvasVar < 1) bad.push(`shot ${name} canvas variance ${settle.canvasVar} — scene appears flat/dead`);
      if (pos.locked) bad.push(`shot ${name} taken while scroll was locked (story gate still up)`);
      if (pos.max > 0 && Math.abs(pos.scrollY - pos.y) > 2) bad.push(`shot ${name} scroll did not take effect — asked for y=${pos.y}, page sat at y=${pos.scrollY}`);
      shot.failures = bad;
      rec.failures.push(...bad);
      rec.shots.push(shot);

      log(`   ${name}  ${(bytes / 1024).toFixed(0)}KB  y=${pos.scrollY}/${pos.max}  ` +
          `${settle.frames}f ${settle.elapsedMs}ms  settle=${settle.how}` +
          `${settle.lastDiff !== null ? ` d=${settle.lastDiff}` : ""}` +
          `${bad.length ? `  ✗ ${bad.length}` : ""}`);
    }

    if (opt.fullpage) {
      phase = "fullpage";
      await page.evaluate(() => window.__auraScrollTo(0));
      await page.evaluate((o) => window.__auraSettle(o), settleOpts);
      const file = path.join(dir, "fullpage.png");
      try {
        await page.screenshot({ path: file, fullPage: true });
        rec.fullpage = { file, bytes: (await stat(file)).size };
      } catch (e) { rec.failures.push(`fullpage screenshot failed: ${e.message}`); }
    }

    /* --------------------------- verdict --------------------------- */
    if (rec.counts.pageError > 0) rec.failures.push(`${rec.counts.pageError} uncaught page error(s)`);
    if (!rec.dom || rec.dom.textLength < 40) rec.failures.push(`page rendered ${rec.dom ? rec.dom.textLength : 0} characters of text — blank or crashed`);
    if (rec.dom && rec.dom.brokenImages.length) rec.failures.push(`${rec.dom.brokenImages.length} broken image(s): ${rec.dom.brokenImages.join(", ")}`);
    const sameOriginFails = messages.filter(
      (m) => (m.kind === "requestfailed" || m.kind === "httperror") && m.url && m.url.startsWith(opt.url)
    );
    if (sameOriginFails.length) rec.failures.push(`${sameOriginFails.length} same-origin request failure(s)`);

    await writeFile(
      path.join(dir, "console.json"),
      JSON.stringify({
        route, viewport: vpStr, url: rec.url, status: rec.status,
        capturedAt: new Date().toISOString(), counts: rec.counts,
        dom: rec.dom, messages,
      }, null, 2)
    );

    rec.consoleFile = path.join(dir, "console.json");
    report.pages.push(rec);
    if (rec.failures.length) {
      report.ok = false;
      report.failures.push(...rec.failures.map((f) => `[${route} @ ${vpStr}] ${f}`));
    }

    log(`   console: ${rec.counts.consoleError} error · ${rec.counts.consoleWarning} warn · ` +
        `${rec.counts.pageError} pageerror · ${rec.counts.requestFailed} reqfail · ${rec.counts.httpError} http4xx/5xx`);

    await context.close();
  }
}

await browser.close();

report.finishedAt = new Date().toISOString();
const reportPath = path.join(opt.out, "report.json");
await writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(`\n${report.ok ? "PASS" : "FAIL"} — report: ${reportPath}`);
if (!report.ok) for (const f of report.failures) console.log(`  ✗ ${f}`);

process.exit(report.ok || !opt.fail ? 0 : 1);
