#!/usr/bin/env node
/* Star evidence shots: crops of the traced edges with the fx canvas live.
   Usage: node scripts/star-shots.mjs [--url http://localhost:4321] */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = (() => {
  const i = process.argv.indexOf("--url");
  return (i > -1 ? process.argv[i + 1] : "http://localhost:4321").replace(/\/+$/, "");
})();
const OUT = path.resolve("scripts", "shots", "stars");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--mute-audio"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

/* story plate edge */
await page.goto(url + "/", { waitUntil: "load", timeout: 45000 });
await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
await page.evaluate(() => document.querySelector(".story-gate-quiet")?.click());
await page.waitForSelector(".story-gate", { state: "detached", timeout: 10000 }).catch(() => {});
await page.evaluate(() => {
  document.querySelector("#design-beat")?.scrollIntoView({ behavior: "auto", block: "center" });
});
await page.waitForTimeout(1600);
const plate = await page.locator(".story-plate.story-accent-emerald").first().boundingBox();
/* the design plate is a LEFT plate: traced edge is its right border */
await writeFile(
  path.join(OUT, "plate-edge.png"),
  await page.screenshot({
    clip: { x: plate.x + plate.width - 70, y: plate.y, width: 110, height: Math.min(700, plate.height) },
  })
);
await writeFile(path.join(OUT, "plate-full.png"), await page.screenshot({ clip: plate }));

/* hero ledger */
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1400);
const ledger = await page.locator(".fx-card .story-ledger").first().boundingBox();
await writeFile(
  path.join(OUT, "hero-ledger.png"),
  await page.screenshot({
    clip: { x: ledger.x - 30, y: ledger.y - 20, width: ledger.width + 60, height: ledger.height + 40 },
  })
);

/* overview panels: rest + hovered (warm coupling brightens the stars) */
await page.goto(url + "/overview/", { waitUntil: "load", timeout: 45000 });
await page.waitForTimeout(1200);
const panel = await page.locator(".aura-panel").first().boundingBox();
const clip = { x: panel.x - 20, y: panel.y - 16, width: panel.width + 40, height: panel.height + 32 };
await page.mouse.move(20, 20);
await page.waitForTimeout(900);
await writeFile(path.join(OUT, "panel-rest.png"), await page.screenshot({ clip }));
await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2, { steps: 6 });
await page.waitForTimeout(900);
await writeFile(path.join(OUT, "panel-hover.png"), await page.screenshot({ clip }));

/* WebGL context census after an 8-route walk (ELEVATION-BRIEF §5 acceptance) */
const routes = ["/", "/land/", "/design/", "/budget/", "/escrow/", "/faq/", "/dashboard/", "/"];
for (const r of routes) {
  await page.goto(url + r, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(400);
}
await page.evaluate(() => document.querySelector(".story-gate-quiet")?.click());
await page.waitForTimeout(1200);
const census = await page.evaluate(() => {
  const cs = Array.from(document.querySelectorAll("canvas"));
  return {
    canvases: cs.length,
    /* webgl2 FIRST: probing 'webgl' on the R3F webgl2 canvas fires
       webglcontextcreationerror and three.js's own listener console.errors
       it — the probe would induce the very noise it checks for. */
    live: cs.filter((c) => {
      const gl = c.getContext("webgl2") || c.getContext("webgl");
      return gl && !gl.isContextLost();
    }).length,
  };
});
console.log(`canvas census on / after 8-route walk: ${JSON.stringify(census)} (want live: 2)`);
console.log(`errors: ${errors.length}${errors.length ? " — " + errors.join(" | ") : ""}`);
await browser.close();
if (errors.length || census.live > 2) process.exit(1);
console.log("PASS");
