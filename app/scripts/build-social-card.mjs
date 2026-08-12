import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const publicRoot = join(appRoot, "public");
const backgroundPath = join(appRoot, "assets", "social", "aura-homes-social-bg-v2.png");
const outputPath = join(publicRoot, "social", "aura-homes-social-v2.jpg");
const landingStillPath = join(publicRoot, "story", "aura-landing-still-v2.jpg");
const displayFontPath = join(
  appRoot,
  "node_modules",
  "@fontsource-variable",
  "space-grotesk",
  "files",
  "space-grotesk-latin-wght-normal.woff2",
);
const bodyFontPath = join(
  appRoot,
  "node_modules",
  "@fontsource-variable",
  "manrope",
  "files",
  "manrope-latin-wght-normal.woff2",
);

const [background, displayFont, bodyFont] = await Promise.all([
  readFile(backgroundPath),
  readFile(displayFontPath),
  readFile(bodyFontPath),
]);

const dataUrl = (mime, value) => `data:${mime};base64,${value.toString("base64")}`;
const browser = await chromium.launch({ headless: true });

try {
  await Promise.all([
    mkdir(dirname(outputPath), { recursive: true }),
    mkdir(dirname(landingStillPath), { recursive: true }),
  ]);
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          @font-face {
            font-family: "Aura Display";
            src: url("${dataUrl("font/woff2", displayFont)}") format("woff2");
            font-weight: 300 700;
          }
          @font-face {
            font-family: "Aura Body";
            src: url("${dataUrl("font/woff2", bodyFont)}") format("woff2");
            font-weight: 300 700;
          }
          * { box-sizing: border-box; }
          html, body { width: 1200px; height: 630px; margin: 0; overflow: hidden; }
          body {
            color: #1a1d1b;
            background: #d8e2dc url("${dataUrl("image/png", background)}") center / cover no-repeat;
            font-family: "Aura Body", sans-serif;
          }
          body::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, rgba(245,245,239,.18), transparent 62%);
            pointer-events: none;
          }
          .brand {
            position: absolute;
            z-index: 2;
            top: 26px;
            left: 40px;
            font: 640 12px/1 "Aura Display", sans-serif;
            letter-spacing: .34em;
            text-transform: uppercase;
          }
          .brand em { color: #008d67; font-style: normal; }
          .route {
            position: absolute;
            z-index: 2;
            top: 27px;
            right: 39px;
            color: rgba(26,29,27,.72);
            font: 560 9px/1 "Aura Body", sans-serif;
            letter-spacing: .28em;
            text-transform: uppercase;
          }
          .panel {
            position: absolute;
            z-index: 2;
            left: 39px;
            top: 91px;
            width: 548px;
            min-height: 493px;
            padding: 31px 38px 29px;
            background: rgba(248,248,243,.94);
            border: 1px solid rgba(26,29,27,.09);
            box-shadow: 0 30px 80px rgba(33,48,40,.16);
          }
          .kicker { display: flex; align-items: center; gap: 13px; }
          .kicker span {
            color: #008d67;
            font: 620 10px/1 "Aura Body", sans-serif;
            letter-spacing: .2em;
            text-transform: uppercase;
          }
          .kicker i { display: block; width: 66px; height: 1px; background: rgba(26,29,27,.18); }
          h1 {
            max-width: 460px;
            margin: 23px 0 17px;
            font: 540 50px/.99 "Aura Display", sans-serif;
            letter-spacing: -.047em;
          }
          .lede {
            max-width: 440px;
            margin: 0;
            color: rgba(26,29,27,.67);
            font: 430 16px/1.55 "Aura Body", sans-serif;
            letter-spacing: -.012em;
          }
          .rule { width: 100%; height: 1px; margin: 23px 0 18px; background: rgba(26,29,27,.13); }
          .action-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
          .action {
            display: inline-flex;
            align-items: center;
            height: 37px;
            padding: 0 18px;
            border-radius: 99px;
            color: #f8f8f3;
            background: #1a1d1b;
            font: 650 9px/1 "Aura Body", sans-serif;
            letter-spacing: .18em;
            text-transform: uppercase;
          }
          .future { text-align: right; }
          .future strong {
            display: block;
            color: #008d67;
            font: 650 9px/1.2 "Aura Body", sans-serif;
            letter-spacing: .17em;
            text-transform: uppercase;
          }
          .future small {
            display: block;
            margin-top: 5px;
            color: rgba(26,29,27,.55);
            font: 500 9px/1.2 "Aura Body", sans-serif;
          }
          .status {
            position: absolute;
            z-index: 2;
            right: 32px;
            bottom: 25px;
            padding: 10px 13px;
            color: rgba(248,248,243,.92);
            background: rgba(19,25,22,.76);
            backdrop-filter: blur(12px);
            font: 560 8px/1 "Aura Body", sans-serif;
            letter-spacing: .2em;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="brand">Aura <em>Homes</em></div>
        <div class="route">Design · land · team · build</div>
        <main class="panel">
          <div class="kicker"><span>Eco Homes, Tiny Homes, Unique Stays</span><i></i></div>
          <h1>Design your eco home.<br />Find the land.<br />Manage the build.</h1>
          <p class="lede">Plan or choose an eco home, match it with the right property and keep your team, costs and next steps together.</p>
          <div class="rule"></div>
          <div class="action-row">
            <span class="action">Start a project&nbsp;&nbsp;→</span>
            <span class="future"><strong>HOMES · future layer</strong><small>Trust + owner launchpad planned on X Layer</small></span>
          </div>
        </main>
        <div class="status">Alberta pilot · local-first · account-free</div>
      </body>
    </html>`);
  await page.screenshot({ path: outputPath, type: "jpeg", quality: 88 });
  await page.setViewportSize({ width: 1600, height: 840 });
  await page.setContent(`<!doctype html>
    <html><head><style>
      * { box-sizing: border-box; }
      html, body { width: 1600px; height: 840px; margin: 0; overflow: hidden; }
      body { background: #d8e2dc url("${dataUrl("image/png", background)}") center / cover no-repeat; }
    </style></head><body></body></html>`);
  await page.screenshot({ path: landingStillPath, type: "jpeg", quality: 79 });
  console.log(`Built ${outputPath}`);
  console.log(`Built ${landingStillPath}`);
} finally {
  await browser.close();
}
