#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   AURA HOMES — HOVER PROOF
   scripts/hover-proof.mjs

   Falsifiable verification of the founder's hover asks, per
   docs/research/ELEVATION-BRIEF.md §3 and MOTION-STACK-SPEC §8.4.

   What it asserts, in order — every assertion is one a broken build fails:

   1. PRECONDITION  matchMedia('(any-hover: hover)') matches in the test
                    browser. If false every later check is vacuous.
   2. TRANSITION    getComputedStyle(plate).transitionProperty contains
                    --fx-warm (the pre-fix build returns "opacity, transform").
   3. WARMTH        Screenshot the active plate's display heading at rest,
                    dispatch a REAL pointer hover (mouse.move), screenshot at
                    +700ms. Mean ΔE00 over the heading bbox must be >= 1.2
                    (else nobody sees it) and <= 3.5 (else it is neon and
                    BRAND.md §1 is broken). Both bounds — a one-sided check
                    passes on a blank page.
   4. STARS WAKE    Park the FX loop at a beat boundary (all plates hidden),
                    then scroll to a beat and confirm the fx-tracer canvas is
                    painting non-zero pixels again. The pre-fix build parks
                    the rAF permanently (ELEVATION-BRIEF §5.1).
   5. REDUCED       Under prefers-reduced-motion: reduce the fx canvas is
                    never created and the plate transition is none.

   Usage:  node scripts/hover-proof.mjs [--url http://localhost:4321]
   Exit 0 clean; 1 any assertion failed. Writes evidence PNGs + report to
   scripts/shots/hover-proof/.
--------------------------------------------------------------------------- */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";

const url = (() => {
  const i = process.argv.indexOf("--url");
  return (i > -1 ? process.argv[i + 1] : "http://localhost:4321").replace(/\/+$/, "");
})();
const OUT = path.resolve("scripts", "shots", "hover-proof");
await mkdir(OUT, { recursive: true });

/* ----------------------------- ΔE00 ---------------------------------- */
/* sRGB -> Lab (D65) and CIEDE2000. Reference: Sharma, Wu & Dalal (2005). */

function srgbToLab(r8, g8, b8) {
  const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = lin(r8), g = lin(g8), b = lin(b8);
  // sRGB D65 matrix
  let x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  let y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  let z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  x /= 0.95047; z /= 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE00([L1, a1, b1], [L2, a2, b2]) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp1 = Cp1 === 0 ? 0 : ((Math.atan2(b1, ap1) * deg) + 360) % 360;
  const hp2 = Cp2 === 0 ? 0 : ((Math.atan2(b2, ap2) * deg) + 360) % 360;
  const dLp = L2 - L1, dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (Cp1 + Cp2) / 2;
  let hbp = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbp += hbp < 360 ? 360 : -360;
    hbp /= 2;
  } else hbp = hp1 + hp2;
  const T =
    1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2));
  const Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) +
    Rt * (dCp / Sc) * (dHp / Sh)
  );
}

function meanDeltaE00(bufA, bufB) {
  const A = PNG.sync.read(bufA), B = PNG.sync.read(bufB);
  if (A.width !== B.width || A.height !== B.height) throw new Error("shot size mismatch");
  let sum = 0, n = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    sum += deltaE00(
      srgbToLab(A.data[i], A.data[i + 1], A.data[i + 2]),
      srgbToLab(B.data[i], B.data[i + 1], B.data[i + 2])
    );
    n++;
  }
  return sum / n;
}

/* NOTE on falsifiability: an element screenshot of the transparent fx canvas
   composites the page behind it, so every pixel reads opaque and an
   alpha-based check can never fail. The star checks therefore read the GL
   drawing buffer directly (preserveDrawingBuffer is forced by the init
   script) — a parked loop leaves a CLEARED buffer (0 lit texels), a live
   loop leaves sprites (>0). */

/* ------------------------------ run ----------------------------------- */

const failures = [];
const notes = [];
const ok = (cond, label) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${label}`);
  if (!cond) failures.push(label);
};

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--mute-audio"],
});

/* preserveDrawingBuffer so the fx canvas pixels are readable */
const INIT = `(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
      attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
    }
    return orig.call(this, type, attrs);
  };
})();`;

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e.message || e)));

await page.goto(url + "/", { waitUntil: "load", timeout: 45000 });
await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});

/* 1 — precondition */
const anyHover = await page.evaluate(() => matchMedia("(any-hover: hover)").matches);
ok(anyHover, `precondition: (any-hover: hover) matches in the test browser`);

/* enter the gate silently */
await page.locator(".story-gate-quiet").click({ timeout: 8000 }).catch(async () => {
  await page.evaluate(() => document.querySelector(".story-gate-quiet")?.click());
});
await page.waitForSelector(".story-gate", { state: "detached", timeout: 10000 }).catch(() => {});
const gated = await page.evaluate(() => document.documentElement.classList.contains("story-gated"));
ok(!gated, "gate dismissed, scroll unlocked");

/* helper: scroll so that beat k is fully active (progress == k). Anchors are
   section midpoints; replicate Story.tsx's math by scrolling the beat section
   to viewport center and letting the page settle. */
const scrollToBeat = async (selector) => {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.scrollIntoView({ behavior: "auto", block: "center" });
  }, selector);
  await page.waitForTimeout(900); // camera damp + plate fade-in
};

/* 2 — the transition list is real */
await scrollToBeat("#design-beat");
const plate = page.locator(".story-plate.story-accent-emerald").first();
const tprop = await plate.evaluate((el) => getComputedStyle(el).transitionProperty);
ok(/--fx-warm/.test(tprop), `plate transition-property contains --fx-warm (got: "${tprop}")`);

/* 3 — the warmth, measured over the display heading bbox */
const heading = page.locator(".story-plate.story-accent-emerald .story-display").first();
await heading.waitFor({ state: "visible", timeout: 8000 });
/* park the mouse far away first so rest truly is rest */
await page.mouse.move(1380, 60);
await page.waitForTimeout(800);
const bbox = await heading.boundingBox();
const clip = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
const restShot = await page.screenshot({ clip });
await writeFile(path.join(OUT, "heading-rest.png"), restShot);

/* real pointer hover on the plate, over the heading */
await page.mouse.move(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, { steps: 8 });
await page.waitForTimeout(700 + 80); // spec: +700ms after enter delay
const hotShot = await page.screenshot({ clip });
await writeFile(path.join(OUT, "heading-hover.png"), hotShot);

const dE = meanDeltaE00(restShot, hotShot);
notes.push(`mean deltaE00 over heading bbox at +700ms: ${dE.toFixed(3)}`);
ok(dE >= 1.2, `warmth visible: mean deltaE00 ${dE.toFixed(3)} >= 1.2`);
ok(dE <= 3.5, `warmth not neon: mean deltaE00 ${dE.toFixed(3)} <= 3.5`);

/* whole-plate evidence shots */
const plateBox = await plate.boundingBox();
await writeFile(path.join(OUT, "plate-hover.png"),
  await page.screenshot({ clip: plateBox }));
await page.mouse.move(1380, 60);
await page.waitForTimeout(700);
await writeFile(path.join(OUT, "plate-rest.png"),
  await page.screenshot({ clip: plateBox }));

/* 4 — the stars come back after a beat-boundary park */
const fxExists = await page.evaluate(() => !!document.querySelector(".fx-tracer-canvas"));
ok(fxExists, "fx tracer canvas exists on the story route");

const fxLit = () =>
  page.evaluate(() => {
    const c = document.querySelector(".fx-tracer-canvas");
    if (!c) return { frac: -1, lit: 0 };
    const gl = c.getContext("webgl");
    if (!gl) return { frac: -1, lit: 0 };
    const w = c.width, h = c.height;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let lit = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] > 4) lit++;
    return { frac: lit / (w * h), lit };
  });

/* park: scroll to the exact midpoint between beats 2 and 3 (progress 2.5 —
   every plate hidden), wait for the loop to park, confirm the canvas is
   clear */
await page.evaluate(() => {
  // reproduce Story.tsx anchors: midpoint between #design-beat and #budget-beat centers
  const vh = window.innerHeight;
  const mid = (el) => el.offsetTop + el.offsetHeight * 0.5 - vh * 0.5;
  const a = mid(document.querySelector("#design-beat"));
  const b = mid(document.querySelector("#budget-beat"));
  window.scrollTo(0, Math.round((a + b) / 2));
});
await page.waitForTimeout(1200);
const parked = await fxLit();
notes.push(`fx buffer lit texels parked at boundary: ${parked.lit}`);
ok(parked.lit === 0, `loop parks clean at a beat boundary (lit texels ${parked.lit} === 0)`);

/* wake: scroll onto beat 3 and expect sprites again — the pre-fix build
   never restarts the loop here and this stays 0 forever */
await scrollToBeat("#budget-beat");
await page.waitForTimeout(600);
const awake = await fxLit();
notes.push(`fx buffer lit texels on beat 3: ${awake.lit}`);
ok(awake.lit > 0, `stars resumed after beat-boundary park (lit texels ${awake.lit} > 0)`);
await writeFile(path.join(OUT, "fx-awake-beat3.png"), await page.locator(".fx-tracer-canvas").screenshot());

/* console noise */
ok(consoleErrors.length === 0, `0 console/page errors on the story route (got ${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

await ctx.close();

/* 5 — reduced motion */
const rctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
await rctx.addInitScript(INIT);
const rpage = await rctx.newPage();
await rpage.goto(url + "/", { waitUntil: "load", timeout: 45000 });
await rpage.evaluate(() => document.querySelector(".story-gate-quiet")?.click());
await rpage.waitForTimeout(900);
const noCanvas = await rpage.evaluate(() => !document.querySelector(".fx-tracer-canvas"));
ok(noCanvas, "reduced motion: fx tracer canvas never created");
const rTrans = await rpage.evaluate(() => {
  const el = document.querySelector(".story-plate");
  return el ? getComputedStyle(el).transitionProperty : "no plate";
});
ok(/^(none|all)$/.test(rTrans) || rTrans === "none", `reduced motion: plate transition is none (got "${rTrans}")`);
await rctx.close();
await browser.close();

const report = { url, at: new Date().toISOString(), notes, failures, ok: failures.length === 0 };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.ok ? "PASS" : "FAIL"} — ${notes.join(" · ")}`);
process.exit(report.ok ? 0 : 1);
