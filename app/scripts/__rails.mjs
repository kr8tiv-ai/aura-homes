import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

/* Close-crop of the entry stair so railing joints can actually be judged.
   The full-viewport harness shot is too small to see whether a cap dies into
   a newel or stops 3cm short, which is exactly the defect being chased. */
const OUT = "scripts/shots/rails-zoom";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=gl", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:4321/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /enter/i.test(x.textContent || ""));
  if (b) b.click();
});
await page.waitForTimeout(3000);

const shots = [
  { p: 0.55, clip: { x: 60, y: 430, width: 700, height: 460 }, name: "left-stair" },
  { p: 0.55, clip: { x: 400, y: 430, width: 760, height: 460 }, name: "right-stair" },
  { p: 0.32, clip: { x: 250, y: 560, width: 800, height: 340 }, name: "deck-edge" },
  { p: 0.42, clip: { x: 300, y: 380, width: 850, height: 500 }, name: "approach" },
];

for (const s of shots) {
  await page.evaluate((f) => window.scrollTo(0, document.body.scrollHeight * f), s.p);
  await page.waitForTimeout(4200);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, clip: s.clip });
  console.log("wrote", s.name);
}

const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
console.log("page errors:", errs.length);
await browser.close();
