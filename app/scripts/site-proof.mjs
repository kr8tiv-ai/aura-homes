/* Visual proof for B-P1 — the plot of land, end to end.
 *
 * Follows scripts/plan-proof.mjs: serve the built export on its own port and
 * drive Chromium against it. What it proves, in the order a person would do
 * it: a listing plot goes onto a real project from /land, the builder opens
 * standing on that lot, the ground tilts when the slope is answered, and the
 * A1 SITE PLAN sheet draws the actual lot lines instead of its honest blank.
 *
 * IT NEVER BUILDS. A build here would fight whatever else is running on the
 * machine, so an absent ./out is a clear message and a non-zero exit rather
 * than four silent minutes of next build.
 *
 * IT ASSERTS BEFORE IT SHOOTS. A screenshot of the wrong page is still a
 * screenshot; every capture below is preceded by a check that would fail if
 * the plot had not actually arrived.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const EXPORT_DIR = "out";
const PORT = 4338;
const SHOTS = "scripts/__site-proof";

if (!existsSync(EXPORT_DIR)) {
  console.error(
    `site-proof: no ./${EXPORT_DIR} to serve, and this script does not build one. ` +
      "Run the export build first, then run this again.",
  );
  process.exit(1);
}
mkdirSync(SHOTS, { recursive: true });

/** The evidenced envelope of the demonstration record this proof uses, read
 *  off lib/marketplace/discovery.ts rather than remembered. */
const ASPEN_LOT = { widthFt: "92", depthFt: "148" };

function must(condition, why) {
  if (!condition) throw new Error(`site-proof: ${why}`);
}

const server = spawn("node", ["scripts/serve-export.mjs", EXPORT_DIR, String(PORT)], {
  stdio: "ignore",
});
await new Promise((resolve) => setTimeout(resolve, 1500));
const base = `http://127.0.0.1:${PORT}`;

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // 1 — a real project, made the way a visitor makes one.
  await page.goto(`${base}/start/`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Project purpose").selectOption("primary-home");
  await page.getByLabel("Project name").fill("Site proof");
  await page.getByRole("button", { name: "Create my project" }).click();
  await page.waitForURL(/\/build/, { timeout: 60_000 });

  // 2 — the plot goes under the home from the listing card itself.
  await page.goto(`${base}/land/`, { waitUntil: "domcontentloaded" });
  const card = page.locator("article", { hasText: "37 Aspen Road" });
  await card.getByRole("button", { name: "Use this plot" }).click();
  await card.getByText(/Saved as this project.s site/).waitFor({ timeout: 60_000 });
  await card.screenshot({ path: `${SHOTS}/site-proof-use-plot.png`, timeout: 60_000, animations: "disabled" });

  // 3 — the builder opens standing on that lot, with the setbacks still zero.
  await page.goto(`${base}/build/`, { waitUntil: "domcontentloaded" });
  await page
    .locator('nav[aria-label="Guided design steps"]')
    .getByRole("button", { name: "Site", exact: true })
    .click();
  const sitePanel = page.locator(".builder-site-step");
  await sitePanel.waitFor({ timeout: 60_000 });

  const lotWidth = await sitePanel.getByLabel(/lot width along the front/i).inputValue();
  const lotDepth = await sitePanel.getByLabel(/lot depth/i).inputValue();
  const frontSetback = await sitePanel.getByLabel(/front setback/i).inputValue();
  must(
    lotWidth === ASPEN_LOT.widthFt && lotDepth === ASPEN_LOT.depthFt,
    `the plot did not reach the builder — the lot reads ${lotWidth} x ${lotDepth} ft`,
  );
  must(frontSetback === "0", `a listing-derived setback must be zero and reads ${frontSetback}`);

  const provenanceLine = await page.locator(".builder-site-step__state").innerText();
  must(
    /from a listing/i.test(provenanceLine),
    `the Site step does not say where this parcel came from: ${provenanceLine}`,
  );

  // 4 — answer the slope the listing could not, and the ground tilts.
  /* The slope control, not the choice-row prose that also says "slope":
     an anchored name on the combobox role picks exactly one element. */
  await sitePanel.getByRole("combobox", { name: /^Slope/ }).selectOption("gentle");
  await page.waitForTimeout(2500);
  await page
    .locator(".builder-viewport")
    .screenshot({ path: `${SHOTS}/site-proof-sloped-viewport.png`, timeout: 60_000, animations: "disabled" });

  // 5 — A1 draws the lot lines rather than printing its no-parcel blank.
  await page.getByRole("button", { name: "Pro", exact: true }).click();
  await page.getByRole("tab", { name: /^Drawings/ }).click();
  await page.getByRole("button", { name: "Generate the drawing" }).click();
  await page.getByRole("button", { name: "A1 SITE PLAN" }).click();
  const sheet = page.locator('img[alt^="Sheet A1"]');
  await sheet.waitFor({ timeout: 60_000 });

  const drawn = await page.locator("body").innerText();
  must(
    !/SITE INFORMATION NOT PROVIDED/.test(drawn),
    "A1 still prints its no-parcel blank, so the plot never reached the sheet",
  );
  must(
    /FRONT LOT LINE AT THE BOTTOM/.test(drawn),
    "A1 does not name the lot lines it is supposed to have drawn",
  );
  await sheet.screenshot({ path: `${SHOTS}/site-proof-a1-site-plan.png`, timeout: 60_000, animations: "disabled" });

  await browser.close();
  console.log(`site-proof: use-plot, sloped viewport and A1 site plan captured into ${SHOTS}`);
} finally {
  server.kill();
}
