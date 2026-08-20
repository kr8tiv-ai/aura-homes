/* ===========================================================================
   The X article cover.

   THE IDEA. The article is about wanting to build a house, written by someone
   who built the drawing tool instead. So the cover is a DRAWING SHEET, not a
   photograph: warm paper, a faint drafting grid, three real plan diagrams
   pinned along the right like sheets on a board, and the title set large enough
   to survive a phone.

   WHY NOT THE USUAL STILL. The site's social art is one photograph of the
   reference cabin and it is on every card we have published. Re-using it says
   "the same project you saw last time". These plans came out of the product an
   hour ago, captions and all, which is the only imagery that is actually about
   this article.

   MOBILE AND DESKTOP. X renders an article cover at 16:9 on both, so the frame
   is 1600x900 and everything that must be read sits inside a 7% margin. The
   title is set at 104px on a 900px canvas — a hair over 11% of the height —
   because at a phone's ~380px width that is the smallest size that still reads
   as a headline rather than as a caption. Rendered at deviceScaleFactor 2 so
   the type stays crisp after X re-compresses it.
   =========================================================================== */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const repoRoot = join(appRoot, "..");
const shots = join(here, "shots", "x-cover");
const outDir = join(repoRoot, "assets", "brand-kit");

const displayFontPath = join(
  appRoot, "node_modules", "@fontsource-variable", "space-grotesk", "files",
  "space-grotesk-latin-wght-normal.woff2",
);
const bodyFontPath = join(
  appRoot, "node_modules", "@fontsource-variable", "manrope", "files",
  "manrope-latin-wght-normal.woff2",
);

const asDataUri = (buffer, mime) => `data:${mime};base64,${buffer.toString("base64")}`;

const [displayFont, bodyFont] = await Promise.all([
  readFile(displayFontPath),
  readFile(bodyFontPath),
]);

/* The three sheets, and their real captions as the product printed them. */
const SHEETS = [
  { file: "horisont.png", caption: "Horisont · 44×14 ft · flat" },
  { file: "trappelys.png", caption: "Trappelys · 24×39 ft · two storey" },
  { file: "klarhet.png", caption: "Klarhet · 32×26 ft · flat" },
];

const plates = await Promise.all(
  SHEETS.map(async (sheet) => ({
    ...sheet,
    uri: asDataUri(await readFile(join(shots, sheet.file)), "image/png"),
  })),
);

/* Brand values, quoted from assets/brand-kit/palette.json rather than picked. */
const INK = "#171a18";
const DIM = "#5f6663";
const PAPER = "#fafaf9";
const EMERALD = "#10b981";
const EMERALD_DEEP = "#047857";
const HAIRLINE = "rgba(23,26,24,0.14)";

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Space Grotesk"; src: url(${asDataUri(displayFont, "font/woff2")}) format("woff2"); font-weight: 300 700; }
  @font-face { font-family: "Manrope"; src: url(${asDataUri(bodyFont, "font/woff2")}) format("woff2"); font-weight: 300 800; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1600px; height: 900px; background: ${PAPER}; font-family: "Manrope", sans-serif; overflow: hidden; }

  .sheet {
    position: relative; width: 100%; height: 100%;
    /* The drafting grid: two scales, both barely there. It should register as
       paper texture, not as a chart. */
    background-image:
      linear-gradient(${HAIRLINE} 1px, transparent 1px),
      linear-gradient(90deg, ${HAIRLINE} 1px, transparent 1px),
      linear-gradient(rgba(23,26,24,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(23,26,24,0.045) 1px, transparent 1px);
    background-size: 200px 200px, 200px 200px, 40px 40px, 40px 40px;
    background-position: -1px -1px;
  }
  /* Warm the right side so the plates sit on something rather than floating. */
  .wash { position: absolute; inset: 0; background:
    radial-gradient(120% 90% at 88% 40%, rgba(16,185,129,0.10), transparent 60%),
    linear-gradient(90deg, ${PAPER} 42%, rgba(250,250,249,0) 78%); }

  .frame { position: absolute; inset: 46px; border: 1px solid ${HAIRLINE}; }

  .copy { position: absolute; left: 112px; top: 150px; width: 780px; }

  .eyebrow {
    font-size: 19px; letter-spacing: 0.30em; text-transform: uppercase;
    color: ${EMERALD_DEEP}; font-weight: 650;
  }
  .rule { width: 84px; height: 3px; background: ${EMERALD}; margin: 26px 0 30px; }

  h1 {
    font-family: "Space Grotesk", sans-serif;
    font-size: 104px; line-height: 0.94; letter-spacing: -0.045em;
    font-weight: 520; color: ${INK};
    text-wrap: balance;
  }
  .sub {
    margin-top: 30px; font-size: 25px; line-height: 1.45;
    color: ${DIM}; max-width: 640px; font-weight: 450;
  }

  .foot {
    position: absolute; left: 112px; bottom: 116px;
    display: flex; align-items: center; gap: 16px;
    font-size: 18px; letter-spacing: 0.16em; text-transform: uppercase;
    color: ${DIM}; font-weight: 600;
  }
  .dot { width: 5px; height: 5px; border-radius: 50%; background: ${EMERALD}; }

  /* The plates: pinned sheets, staggered, each with its own caption. */
  /* Sized so THREE plates and their captions fit inside the 900px frame. Each
     plate is image (~0.39 of its width) + caption + padding + gap, so the width
     is the lever: at 560 the third caption fell off the bottom edge, which on a
     cover reads as a mistake rather than as a crop. */
  .plates { position: absolute; right: 96px; top: 86px; width: 468px; }
  .plate {
    background: #fff; border: 1px solid ${HAIRLINE};
    box-shadow: 0 22px 46px rgba(23,26,24,0.09), 0 2px 6px rgba(23,26,24,0.05);
    padding: 12px 12px 0;
    margin-bottom: 18px;
  }
  .plate img { display: block; width: 100%; height: auto; }
  .plate figcaption {
    font-size: 14px; letter-spacing: 0.10em; text-transform: uppercase;
    color: ${DIM}; padding: 10px 2px 11px; font-weight: 600;
  }
  .plate:nth-child(1) { transform: rotate(-1.1deg) translateX(-26px); }
  .plate:nth-child(2) { transform: rotate(0.7deg) translateX(14px); }
  .plate:nth-child(3) { transform: rotate(-0.4deg) translateX(-8px); }
</style></head>
<body>
  <div class="sheet">
    <div class="wash"></div>
    <div class="frame"></div>

    <div class="plates">
      ${plates
        .map(
          (plate) => `<figure class="plate">
        <img src="${plate.uri}" alt="">
        <figcaption>${plate.caption}</figcaption>
      </figure>`,
        )
        .join("\n")}
    </div>

    <div class="copy">
      <p class="eyebrow">Aura Homes · Workshop notes</p>
      <div class="rule"></div>
      <h1>I just wanted to build a house.</h1>
      <p class="sub">So I built the tool instead — 87 eco-home designs that carry
        real Alberta numbers, and every mistake we made getting there.</p>
    </div>

    <div class="foot">
      <span>aurahomes.fun</span><span class="dot"></span>
      <span>Open source</span><span class="dot"></span>
      <span>OKX BuildX AI Season</span>
    </div>
  </div>
</body></html>`;

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const out = join(outDir, "x-article-cover-1600x900.png");
await page.screenshot({ path: out });

/* A 2:1 crop for the timeline card, composed rather than cropped so the title
   is not clipped by X's own framing. */
await page.setViewportSize({ width: 1600, height: 800 });
await page.waitForTimeout(200);
const wide = join(outDir, "x-article-cover-1600x800.png");
await page.screenshot({ path: wide, clip: { x: 0, y: 50, width: 1600, height: 800 } });

await browser.close();

await writeFile(
  join(outDir, "x-article-cover.README.txt"),
  [
    "x-article-cover-1600x900.png  — X article cover (16:9). Primary.",
    "x-article-cover-1600x800.png  — 2:1 timeline card.",
    "",
    "Built by app/scripts/build-x-cover.mjs from plan portraits captured by",
    "app/scripts/capture-plan-portraits.mjs against the live site. The three",
    "plates are real plan diagrams with the captions the product printed.",
    "Palette and type quoted from assets/brand-kit/palette.json.",
    "",
  ].join("\n"),
);

console.log(JSON.stringify({ out, wide, plates: plates.map((p) => p.caption) }, null, 2));
