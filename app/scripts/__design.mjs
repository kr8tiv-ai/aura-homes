import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "scripts/shots/design-local";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=gl", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));

await page.goto("http://localhost:4321/design", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.click('button[type="submit"]');
await page.waitForTimeout(6000);

// How is the drawing carried? inline svg, <img data:>, or object?
const how = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")].map((i) => (i.src || "").slice(0, 60));
  const objs = [...document.querySelectorAll("object,iframe")].map((o) => o.tagName);
  const svgs = [...document.querySelectorAll("svg")].map((s) => s.querySelectorAll("*").length);
  return { imgs, objs, svgCounts: svgs };
});
console.log("CARRIER:", JSON.stringify(how));

// scroll the drawing into view by finding the NOT FOR CONSTRUCTION text
const found = await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && /NOT FOR CONSTRUCTION/i.test(e.textContent || ""),
  );
  if (el) el.scrollIntoView({ block: "center" });
  return !!el;
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/stamp.png` });

// and the drawing itself
await page.evaluate(() => {
  const img = document.querySelector('img[src^="data:image/svg"]');
  const svg = [...document.querySelectorAll("svg")].sort(
    (a, b) => b.querySelectorAll("*").length - a.querySelectorAll("*").length,
  )[0];
  const target = img || svg;
  if (target) target.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/drawing.png` });

const src = await page.evaluate(() => {
  const img = document.querySelector('img[src^="data:image/svg"]');
  if (img) return decodeURIComponent(img.src.replace(/^data:image\/svg\+xml[;,]?(utf8,)?/, "")).slice(0, 1500);
  const svg = [...document.querySelectorAll("svg")].sort(
    (a, b) => b.querySelectorAll("*").length - a.querySelectorAll("*").length,
  )[0];
  return svg ? svg.outerHTML.slice(0, 1500) : "NO DRAWING FOUND";
});
writeFileSync(`${OUT}/svg-head.txt`, src);
console.log("SVG HEAD:", src.slice(0, 300));
console.log("stampFound:", found, "errors:", errs.length);
await browser.close();
