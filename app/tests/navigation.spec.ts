import { expect, test } from "playwright/test";

/* The approved global navigation and its compatibility contract:
   · Five entries: Explore homes · Design a home · How it works ·
     My projects · More (Land fit pilot, Check a contractor, Roadmap, FAQ,
     About — Roadmap added Aug 12 with the /roadmap page).
   · Legacy routes redirect CLIENT-SIDE (static export — no server 301s).
   · The journey spine is workspace chrome: absent without a project, and
     its Funding step routes to /budget, never the legacy concierge.

   RENEGOTIATED Aug 14, 2026 (SP01). Workspace chrome is now TWO rows: the
   journey spine (.project-spine — project name and the eight step chips) and
   the project STATUS spine beneath it ([data-project-spine] — stage, design
   fingerprint in plain words, open blockers, and the one recommended next
   action). Nothing below was weakened:
   · the absence test kept every assertion it had and gained the same
     assertion for the new row, because "no project, no chrome" is the
     contract and it now has to hold for both rows, not just the one that
     existed when the test was written;
   · the /budget Funding assertion is untouched, still scoped to the
     "Project journey" nav so it can only ever describe the journey spine;
   · one test was ADDED for SP01's own gate — the same reading on all six
     worked pages, and no status spine on /dashboard, which is the full
     project record and does not need a miniature of itself. */

test("the primary navigation carries the five approved entries", async ({ page }) => {
  await page.goto("/how-it-works");
  const journey = page.getByRole("navigation", { name: "Primary" });
  await expect(journey.getByRole("link", { name: "Explore homes" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "Design a home" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "How it works" })).toBeVisible();
  await expect(journey.getByRole("link", { name: "My projects" })).toBeVisible();
  await expect(journey.getByRole("link")).toHaveCount(4);

  await page.getByText("More", { exact: true }).click();
  const more = page.getByRole("navigation", { name: "More Aura tools" });
  await expect(more.getByRole("link", { name: "Land fit pilot" })).toBeVisible();
  await expect(more.getByRole("link", { name: "Check a contractor" })).toBeVisible();
  await expect(more.getByRole("link", { name: "Roadmap" })).toBeVisible();
  await expect(more.getByRole("link", { name: "FAQ" })).toBeVisible();
  await expect(more.getByRole("link", { name: "About" })).toBeVisible();
  await expect(more.getByRole("link")).toHaveCount(5);

  // HOMES and onchain records left the ordinary utility menu on purpose.
  await expect(more.getByRole("link", { name: /HOMES/ })).toHaveCount(0);
  await expect(more.getByRole("link", { name: /escrow/i })).toHaveCount(0);
});

test("legacy routes land on their replacements client-side", async ({ page }) => {
  await page.goto("/overview");
  await page.waitForURL(/\/how-it-works\/?$/);
  await expect(page.getByRole("heading", { name: "One project, six honest stages." })).toBeVisible();

  await page.goto("/design");
  await page.waitForURL(/\/build\/?\?mode=guided$/);

  await page.goto("/escrow");
  await page.waitForURL(/\/labs\/xlayer-proof\/?$/);
  await expect(page.getByRole("heading", { name: "Proof of lifecycle" })).toBeVisible();
});

test("the X Layer lab keeps the testnet content reachable but unindexed", async ({ page }) => {
  await page.goto("/labs/xlayer-proof");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Aura Labs · X Layer testnet", { exact: true })).toBeVisible();
  await expect(page.getByText("not a product feature", { exact: false }).first()).toBeVisible();
});

test("the education pages explain the lifecycle and label every crypto plan", async ({ page }) => {
  await page.goto("/how-it-works");
  await expect(page.getByRole("heading", { name: "One project, six honest stages." })).toBeVisible();
  await expect(page.getByText("Aura facilitates. It is not a party to your project.")).toBeVisible();
  await expect(page.getByText("NOT FOR CONSTRUCTION", { exact: false }).first()).toBeVisible();

  await page.goto("/how-crypto-works");
  await expect(page.getByRole("heading", { name: "The crypto side, one plain idea at a time." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What hashes do not prove" })).toBeVisible();
  // Every plan carries an honest status chip: the HOMES token flipped to
  // Today when it launched on XLaunch (Aug 13, 2026); the trust stays Next,
  // the stay network + launchpad stay Future. Nothing unbuilt reads as live.
  await expect(page.getByText(/Next · planned, being designed/)).toHaveCount(1);
  await expect(page.getByText(/Future · a later idea that may change/)).toHaveCount(2);
});

test("the journey spine stays out of pages without an active project", async ({ page }) => {
  await page.goto("/build");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Project journey" })).toHaveCount(0);
  await expect(page.locator(".project-spine")).toHaveCount(0);
  await expect(page.locator(".project-empty-rail")).toHaveCount(0);
  // Same rule, second row (SP01): the status spine renders nothing at all
  // without an active project — no placeholder, no empty rail.
  await expect(page.locator("[data-project-spine]")).toHaveCount(0);

  // Education pages never carry workspace chrome, project or not.
  await page.goto("/how-it-works");
  await expect(page.locator(".project-spine")).toHaveCount(0);
  await expect(page.locator("[data-project-spine]")).toHaveCount(0);
});

test("with an active project the spine appears and Funding routes to /budget", async ({ page }) => {
  await page.goto("/start");
  await page.getByLabel("Project purpose").selectOption("primary-home");
  await page.getByLabel("Project name").fill("Navigation check home");
  await page.getByRole("button", { name: "Create my project" }).click();
  await expect(page).toHaveURL(/\/build/);

  const spine = page.getByRole("navigation", { name: "Project journey" });
  await expect(spine).toBeVisible();
  // trailingSlash export renders internal hrefs with a trailing slash.
  await expect(spine.getByRole("link", { name: /Funding/ })).toHaveAttribute("href", /^\/budget\/?$/);
});

/* SP01's own gate. The three values the document has always computed —
   stepStates, blockers, recommendedNextAction — are the same values on every
   page, so the row that shows them has to read the same on every page. A
   spine that recomputed per route, or that quietly disappeared on one of
   them, fails here. */
test("the project status spine reads the same on every page it appears on", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/start");
  await page.getByLabel("Project purpose").selectOption("primary-home");
  await page.getByLabel("Project name").fill("Spine walk home");
  await page.getByRole("button", { name: "Create my project" }).click();
  await expect(page).toHaveURL(/\/build/);

  const status = page.locator("[data-project-spine]");
  await expect(status).toBeVisible();

  /* The starting brief was never confirmed, so Requirements is genuinely the
     open stage and the recommended action genuinely goes back to /start.
     Nothing in this flow records a blocker, so the count is a declared zero
     rather than a blank. */
  await expect(status).toHaveAttribute("data-spine-step", "requirements");
  await expect(status).toHaveAttribute("data-spine-blockers", "0");
  await expect(status.locator("[data-spine-next]")).toHaveAttribute("href", /^\/start\/?$/);

  /* The design reading is captured rather than hard-coded: whether opening
     the builder has already moved the design off its created state is the
     builder's business, but every page must agree on the answer. */
  const designState = await status.getAttribute("data-spine-design");
  expect(designState).toMatch(/^(saved|changed|unsaved|never)$/);

  for (const route of ["/budget", "/land", "/contractors", "/projects", "/start"]) {
    await page.goto(route);
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute("data-spine-step", "requirements");
    await expect(status).toHaveAttribute("data-spine-design", designState ?? "");
    await expect(status).toHaveAttribute("data-spine-blockers", "0");
    await expect(status.locator("[data-spine-next]")).toHaveAttribute("href", /^\/start\/?$/);
  }

  /* Plain words are the headline; the fingerprint is present but truncated.
     A raw hex dump as the reading would fail the second assertion. */
  const reading = await status.innerText();
  expect(reading).toMatch(/Saved|Changed since last save|Unsaved changes|Not saved yet/);
  expect(reading).toMatch(/0x[0-9a-f]{8}…/i);
  expect(reading).not.toMatch(/0x[0-9a-f]{12}/i);

  // /dashboard is the full project record. It does not carry a miniature of
  // itself — the journey spine stays, the status row does not.
  await page.goto("/dashboard");
  await expect(page.getByRole("navigation", { name: "Project journey" })).toBeVisible();
  await expect(page.locator("[data-project-spine]")).toHaveCount(0);
});
