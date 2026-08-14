/**
 * X article header, built on the same card background and type system as
 * build-social-card.mjs so the article reads as the same publication rather
 * than a lookalike: the v2 backcountry plate, the paper panel on the left, the
 * emerald kicker, Space Grotesk display, Manrope body, the ink pill.
 *
 * Two sizes, because X uses two: 1600x900 for the article header itself and
 * 1200x630 for the link card that shows up in the timeline. Same composition,
 * re-laid rather than scaled, so the headline stays on its own lines in both.
 *
 * Run from app/:  node scripts/build-x-article-header.mjs
 */
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const repoRoot = join(appRoot, "..");

const backgroundPath = join(appRoot, "assets", "social", "aura-homes-social-bg-v2.png");
const outDir = join(repoRoot, "assets", "brand-kit");
const displayFontPath = join(appRoot, "node_modules", "@fontsource-variable", "space-grotesk", "files", "space-grotesk-latin-wght-normal.woff2");
const bodyFontPath = join(appRoot, "node_modules", "@fontsource-variable", "manrope", "files", "manrope-latin-wght-normal.woff2");

const [background, displayFont, bodyFont] = await Promise.all([
  readFile(backgroundPath),
  readFile(displayFontPath),
  readFile(bodyFontPath),
]);

const dataUrl = (mime, value) => `data:${mime};base64,${value.toString("base64")}`;

/* One composition, two scales. Every measurement is expressed as a multiple of
   `u` so the 1200-wide card is a genuine re-lay rather than a squashed 1600. */
const card = ({ width, height, u }) => `<!doctype html>
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
      html, body { width: ${width}px; height: ${height}px; margin: 0; overflow: hidden; }
      body {
        color: #1a1d1b;
        background: #d8e2dc url("${dataUrl("image/png", background)}") center / cover no-repeat;
        font-family: "Aura Body", sans-serif;
      }
      /* Lifts the left third just enough to seat the panel without washing the
         treeline the plate is chosen for. */
      body::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(245,245,239,.22), transparent 58%);
        pointer-events: none;
      }
      .brand {
        position: absolute; z-index: 2;
        top: ${u * 26}px; left: ${u * 40}px;
        font: 640 ${u * 12}px/1 "Aura Display", sans-serif;
        letter-spacing: .34em; text-transform: uppercase;
      }
      .brand em { color: #008d67; font-style: normal; }
      .route {
        position: absolute; z-index: 2;
        top: ${u * 27}px; right: ${u * 39}px;
        color: rgba(26,29,27,.72);
        font: 560 ${u * 9}px/1 "Aura Body", sans-serif;
        letter-spacing: .28em; text-transform: uppercase;
      }
      .panel {
        position: absolute; z-index: 2;
        left: ${u * 39}px; top: ${u * 84}px;
        width: ${u * 566}px;
        padding: ${u * 32}px ${u * 38}px ${u * 30}px;
        background: rgba(248,248,243,.94);
        border: 1px solid rgba(26,29,27,.09);
        box-shadow: 0 ${u * 30}px ${u * 80}px rgba(33,48,40,.16);
      }
      .kicker { display: flex; align-items: center; gap: ${u * 13}px; }
      .kicker span {
        color: #008d67;
        font: 620 ${u * 10}px/1 "Aura Body", sans-serif;
        letter-spacing: .2em; text-transform: uppercase;
      }
      .kicker i { display: block; width: ${u * 60}px; height: 1px; background: rgba(26,29,27,.18); }
      h1 {
        max-width: ${u * 490}px;
        margin: ${u * 24}px 0 ${u * 16}px;
        font: 540 ${u * 47}px/1.0 "Aura Display", sans-serif;
        letter-spacing: -.047em;
      }
      /* The turn of the sentence is the whole idea, so it gets the colour and
         nothing else on the card competes for it. */
      h1 em { color: #008d67; font-style: normal; }
      .lede {
        max-width: ${u * 470}px; margin: 0;
        color: rgba(26,29,27,.67);
        font: 430 ${u * 16}px/1.55 "Aura Body", sans-serif;
        letter-spacing: -.012em;
      }
      .rule { width: 100%; height: 1px; margin: ${u * 24}px 0 ${u * 18}px; background: rgba(26,29,27,.13); }
      .action-row { display: flex; align-items: center; justify-content: space-between; gap: ${u * 20}px; }
      .action {
        display: inline-flex; align-items: center;
        height: ${u * 37}px; padding: 0 ${u * 18}px;
        border-radius: 99px;
        color: #f8f8f3; background: #1a1d1b;
        font: 650 ${u * 9}px/1 "Aura Body", sans-serif;
        letter-spacing: .18em; text-transform: uppercase;
      }
      .token { text-align: right; }
      .token strong {
        display: block; color: #008d67;
        font: 650 ${u * 9}px/1.2 "Aura Body", sans-serif;
        letter-spacing: .17em; text-transform: uppercase;
      }
      .token small {
        display: block; margin-top: ${u * 5}px;
        color: rgba(26,29,27,.55);
        font: 500 ${u * 9}px/1.2 "Aura Body", sans-serif;
      }
      .status {
        position: absolute; z-index: 2;
        right: ${u * 32}px; bottom: ${u * 25}px;
        padding: ${u * 10}px ${u * 13}px;
        color: rgba(248,248,243,.92);
        background: rgba(19,25,22,.76);
        backdrop-filter: blur(${u * 12}px);
        font: 560 ${u * 8}px/1 "Aura Body", sans-serif;
        letter-spacing: .2em; text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <div class="brand">Aura <em>Homes</em></div>
    <div class="route">Design · land · team · build</div>
    <main class="panel">
      <div class="kicker"><span>Open source · BuildX AI Season</span><i></i></div>
      <h1>Most home design tools hand you a brochure.<br /><em>We hand you the file.</em></h1>
      <p class="lede">Describe the home you want. Get an editable 3D model, a cost range that shows its sources, and a package your builder can actually price.</p>
      <div class="rule"></div>
      <div class="action-row">
        <span class="action">Aurahomes.fun&nbsp;&nbsp;→</span>
        <span class="token"><strong>$HOMES · live on X Layer</strong><small>Token live · trust structure planned</small></span>
      </div>
    </main>
    <div class="status">MIT open source · local-first · account-free</div>
  </body>
</html>`;

const SIZES = [
  { name: "x-article-header-1600x900.png", width: 1600, height: 900, u: 1.32 },
  { name: "x-article-card-1200x630.png", width: 1200, height: 630, u: 1.0 },
];

const browser = await chromium.launch({ headless: true });
try {
  await mkdir(outDir, { recursive: true });
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    await page.setContent(card(size));
    /* The face is inlined, but setContent resolves before it is decoded, and a
       screenshot taken in that gap silently ships the fallback. */
    await page.evaluate(() => document.fonts.ready);
    const path = join(outDir, size.name);
    await page.screenshot({ path, type: "png" });
    await page.close();
    console.log(`Built ${path}`);
  }
} finally {
  await browser.close();
}
