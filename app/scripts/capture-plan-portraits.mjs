/* ===========================================================================
   Portraits of real homes, for the X article cover.

   WHY CAPTURE RATHER THAN REUSE. The site's existing social art is one
   photographic still of the reference cabin, and it is on every card we have
   already published. A cover built from it says "the same project you saw last
   time". These frames are the PRODUCT'S OWN OUTPUT — drawn by the same engine
   that costs the buildings — so the cover shows the thing the article is about
   rather than a photograph standing in for it.

   WHY THE CARD VISUALS RATHER THAN THE VIEWER. An earlier version of this
   script opened each plan in the 3D viewer and shot the canvas. It was slow, it
   needed the plan-open click to land before the screenshot, and when that click
   missed it silently produced three frames of the DEFAULT home — three
   identical pictures presented as three designs, which is exactly the class of
   quiet wrongness this project spends its time hunting. The card visual is
   already a rendered portrait of that plan, it is addressable by the card's own
   title, and if the card is missing the shot simply does not happen.
   =========================================================================== */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "shots", "x-cover");
const BASE = process.env.AURA_BASE_URL ?? "https://aurahomes.fun";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1200 },
  deviceScaleFactor: 2,
});

/* Guided defaults to step 1 with the library open. Pro collapses it to zero
   height until PLANS is pressed, which is why this does not use Pro. */
await page.goto(`${BASE}/build/`, { waitUntil: "domcontentloaded" });
await page.locator("button.plan-card").first().waitFor({ timeout: 60_000 });
await page.waitForTimeout(2500);

const cards = page.locator("button.plan-card");
const total = await cards.count();
console.log(`plan cards on the page: ${total}`);

/* Chosen for silhouette, not for area: a long low pavilion, a stepped terrace,
   a two-storey mass. Three different shapes read as a library; three of the
   same shape read as one house. A title that is not on the page is skipped
   rather than substituted, so this never invents a match. */
const WANT = ["Horisont", "Trappelys", "Stabel", "Klarhet", "Langsikt", "Ramme"];
const captured = [];

for (const title of WANT) {
  const card = cards.filter({ hasText: title }).first();
  if ((await card.count()) === 0) {
    console.log(`  no card titled "${title}" - skipped`);
    continue;
  }
  await card.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(700);

  const visual = card.locator(".plan-card__visual").first();
  const target = (await visual.count()) > 0 ? visual : card;
  const file = join(outDir, `${title.toLowerCase()}.png`);
  await target.screenshot({ path: file });

  const caption = (await card.innerText()).split("\n").slice(0, 3).join(" - ");
  captured.push({ title, file, caption });
  console.log(`  captured ${title} - ${caption.slice(0, 70)}`);
}

/* And the wall itself: eighty-seven designs in one frame is a stronger image
   than any single house, and it is the screen the article is really about. */
const grid = page.locator(".plan-library").first();
if ((await grid.count()) > 0) {
  await grid.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(900);
  await grid.screenshot({ path: join(outDir, "library-wall.png") }).catch(() => undefined);
  console.log("  captured the library wall");
}

await browser.close();
console.log(JSON.stringify({ outDir, total, captured }, null, 2));
