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
     project record and does not need a miniature of itself.

   EXTENDED Aug 14, 2026 (NAV01). The founder — who commissioned both
   features — asked where the contractor directory was and why he could not
   search for land. Both were live, both were in the More menu, under the
   labels this file pins. Nothing below was renegotiated, weakened or
   removed: the five-entry contract, the exact labels, the "tools live in
   More" rule and the no-Buy rule all still read exactly as they did, because
   every one of them is a decision someone made on purpose and none of them
   is what failed. Three tests were ADDED at the end of this file for the
   thing that did fail — a label that does not say what the thing is — and
   they pin the fix in both directions: each tool now carries a plain
   sentence saying what it is, AND the link's accessible name is still
   exactly the locked label, so the exact-match assertions in
   visual-system-ui.spec.ts and project-ui.spec.ts cannot become collateral
   damage of adding words inside the link. The no-Buy-in-More rule, which
   until now was only implied by the count and the enumeration, is asserted
   in its own right there. */

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

/* ─────────────────────────────────────────────────────────────────────
   NAV01 — FINDABILITY, WITHOUT TOUCHING ANY OF THE PINS

   The two sentences under the tool labels are the whole change, and they
   are only worth anything if they are load-bearing in three ways at once:
   they must be SEEN (visible text), they must be HEARD (wired as the link's
   description, not merely drawn beside it), and they must not COST anything
   (the accessible name must still be exactly the locked label, because two
   specs this node does not own match it with exact:true).

   Each of the three tests below fails on a different mutation, which is the
   only reason to have three. Removing the sentence fails the first pair of
   assertions; removing aria-describedby fails the middle one; removing
   aria-label fails the last, because the sentence would then be swallowed
   into the link's name and "Land fit pilot" would no longer be exact.
   ───────────────────────────────────────────────────────────────────── */

/* The contractor sentence was "A directory of trades and suppliers" when these
   tests were written, and it was changed at integration because a fresh-context
   review showed it was half untrue. The SUPPLIER half is a directory — real
   Alberta records. The CONTRACTOR half is not: /contractors scores a contractor
   the person brings, or shows demonstration profiles labelled as such, which is
   why the page calls itself "Check a contractor".

   Renegotiated here rather than reverted there, because the page was right and
   the sentence was wrong. A nav gloss promising a directory of trades and
   delivering a scoring tool is exactly the small overstatement the rest of this
   suite exists to catch. */
const TOOL_SENTENCES = [
  { label: "Land fit pilot", what: "Does a parcel allow the home you drew?" },
  {
    label: "Check a contractor",
    what: "Alberta suppliers, and evidence checks on a trade you are considering",
  },
] as const;

test("the More menu says what each tool is, and still calls it what it is called", async ({ page }) => {
  await page.goto("/how-it-works");
  await page.getByText("More", { exact: true }).click();
  const more = page.getByRole("navigation", { name: "More Aura tools" });

  for (const tool of TOOL_SENTENCES) {
    // SEEN — the sentence is on screen, under the label.
    await expect(more.getByText(tool.what, { exact: true })).toBeVisible();

    // NOT PAID FOR — exact:true here is the point. visual-system-ui.spec.ts
    // and project-ui.spec.ts match these names, one of them exactly; adding
    // words inside the link must not leak into the name.
    const link = more.getByRole("link", { name: tool.label, exact: true });
    await expect(link).toBeVisible();

    // HEARD — the sentence is the link's description, so it reaches a screen
    // reader rather than only a pair of eyes.
    const describedBy = await link.getAttribute("aria-describedby");
    expect(describedBy, `${tool.label} must describe itself, not just sit next to a caption`).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveText(tool.what);
  }

  /* The pinned shape, restated where it can be broken. The count and the
     enumeration at the top of this file already made a sixth entry
     impossible; this says the founder decision out loud, by name and by
     route, so that a future edit that swaps an entry rather than adding one
     still trips. */
  await expect(more.getByRole("link")).toHaveCount(5);
  await expect(more.getByRole("link", { name: /buy/i })).toHaveCount(0);
  await expect(more.locator('a[href*="/buy"]')).toHaveCount(0);
});

test("the app menu sheet carries the same sentences on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/how-it-works");
  await page.getByRole("button", { name: "Menu" }).click();

  const tools = page.getByRole("navigation", { name: "Aura tools", exact: true });
  for (const tool of TOOL_SENTENCES) {
    await expect(tools.getByText(tool.what, { exact: true })).toBeVisible();
    const link = tools.getByRole("link", { name: tool.label, exact: true });
    await expect(link).toBeVisible();
    const describedBy = await link.getAttribute("aria-describedby");
    expect(describedBy, `${tool.label} must describe itself in the sheet too`).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveText(tool.what);
  }
});

/* The landing sheet is the front door's only menu, and it used to render one
   flat run of nine numbered entries — the tools were items 05–09 of a list
   with no heading, which is the shape a person scans past. It now carries
   the two bands the app sheet already used. The completeness the old flat
   ALL_NAV list existed to guarantee (four routes had once vanished silently
   below 640px) is asserted here as 4 + 5, so the split cannot quietly lose
   an entry the way the CSS once did. */
test("the landing menu separates the journey from the tools and names the band", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("dialog", { name: "Choose an Aura Homes journey" })
    .getByRole("button", { name: /Build an eco home/ })
    .click();
  await page.getByRole("button", { name: "Menu" }).click();

  const route = page.getByRole("navigation", { name: "Your route" });
  const tools = page.getByRole("navigation", { name: "Aura tools", exact: true });
  await expect(page.getByText("Tools and records", { exact: true })).toBeVisible();
  await expect(route.getByRole("link")).toHaveCount(4);
  await expect(tools.getByRole("link")).toHaveCount(5);

  for (const tool of TOOL_SENTENCES) {
    await expect(tools.getByText(tool.what, { exact: true })).toBeVisible();
    await expect(tools.getByRole("link", { name: tool.label, exact: true })).toBeVisible();
  }

  /* THE LIST MUST NOT PUSH THE SHEET'S OWN FLOOR OFF THE SCREEN.
     This sheet is fixed at inset:0 and globals.css gives it no overflow rule
     of its own, so on a 390×844 phone a list this tall simply grows past the
     bottom edge: measured, the nine rows plus the two band labels want 748px
     in a 726px content box, which shoves the theme control and the footer
     line off the viewport entirely and leaves the last entry sitting at
     y=766–835, underneath the story HUD. The scroll is contained on the
     wrapper in SiteShell.tsx because globals.css belongs to another node this
     wave; with the containment the wrapper scrolls (652 visible of 748) and
     the floor comes back. ratio:1 is deliberate — a 10px sliver of the theme
     control peeking above the bottom edge satisfies a bare toBeInViewport
     and is exactly the failure this is meant to catch. */
  await expect(page.locator(".story-sheet-tools")).toBeInViewport({ ratio: 1 });
  await expect(page.locator(".story-sheet-foot")).toBeInViewport({ ratio: 1 });
  const last = tools.getByRole("link").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
});
