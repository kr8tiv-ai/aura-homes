import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=gl", "--ignore-gpu-blocklist", "--mute-audio"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.route("**/api.github.com/repos/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ stargazers_count: 12 }) })
);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("http://localhost:3005/", { waitUntil: "load" });
await page.evaluate(() => document.querySelector(".story-gate-quiet")?.click());
await page.waitForSelector(".story-gate", { state: "detached", timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2200);
const clip = { x: 1440 - 470, y: 900 - 90, width: 460, height: 80 };
await writeFile("scripts/shots/stars/hud-count-day.png", await page.screenshot({ clip }));
await page.locator(".story-hud button[aria-label*='night' i]").click();
await page.waitForTimeout(1800);
await writeFile("scripts/shots/stars/hud-count-night.png", await page.screenshot({ clip }));
console.log("errors:", errors.length, errors.slice(0, 3).join(" | "));
await browser.close();
