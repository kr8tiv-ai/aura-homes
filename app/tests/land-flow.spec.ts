/* THE LOT SOMEBODY STATES, PRESSED IN A REAL BROWSER — the gate on the FLOW.
 *
 * WHY THIS FILE EXISTS, stated as the failure it was written against rather
 * than as a feature it covers.
 *
 * `tests/land-stated-lot.spec.ts` proves the arithmetic of a stated lot very
 * well: the round trip through `withProjectSite`, the two setback conventions,
 * the refusals, the vocabulary. It proves none of it THROUGH THE CONTROL. It
 * renders the panel with `renderToStaticMarkup` — no React, no event handlers,
 * no store — and then calls `withProjectSite` itself. So two independent
 * verifiers each broke the feature and watched the suite stay green:
 *
 *   · The commit call in `StatedLotPanel` was replaced with `void site;`. The
 *     panel rendered, the button stayed enabled, the panel still reported
 *     "Saved onto this project's design.", nothing was written, 46/46 passed.
 *   · `<StatedLotPanel />` was replaced with `null` in `ZoningLookup`. The
 *     whole surface vanished from /land, 46/46 passed.
 *
 * That is the exact shape of defect that left /land broken for months under a
 * green suite, so the rule this file is built on is narrow and absolute: FOR
 * ANYTHING A PERSON CLICKS, A PURE-FUNCTION TEST IS NOT EVIDENCE. Every
 * assertion below is reached by driving the page — navigate, select, type,
 * press — and the one that matters reads the result out of IndexedDB, which is
 * the only witness that cannot be faked by a component telling itself it
 * succeeded.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED HERE. None of the copy, none of the
 * vocabulary rules, none of the envelope arithmetic as arithmetic. Those have a
 * home in `land-stated-lot.spec.ts` and duplicating them here would make this
 * file fail for reasons that have nothing to do with the flow being wired.
 *
 * THIS FILE BELONGS IN `playwright.ui.config.ts` AND NOWHERE ELSE. Every case
 * skips without a `baseURL`, and only the UI config supplies one. In the unit
 * gate it would be listed, counted, green, and would execute nothing — which is
 * the same silent nothing it was written to catch. `tests/gate-coverage.spec.ts`
 * enforces that placement.
 */

import { expect, test, type Page } from "playwright/test";

import { INITIAL_PARCEL } from "@/components/design/ParcelPanel";
import { NO_PROJECT_NOTE, commitState } from "@/components/land/StatedLotPanel";

/* ------------------------------------------------------------ the fixture */

/** The lot a person states. Every number is deliberately UNLIKE `INITIAL_PARCEL`
 *  (see the guard in the first test). That rectangle is what the builder's own
 *  Site form falls back to when no site reached the document, and it is what
 *  /design's parcel panel opens on, so a fixture sharing a number with it would
 *  let "nothing was written" read as "the right thing was written". */
const LOT = {
  frontageFt: 60,
  depthFt: 130,
  frontSetbackFt: 22,
  sideSetbackFt: 7,
  rearSetbackFt: 18,
} as const;

/** What the setbacks leave, computed here from the fixture rather than copied
 *  from any module the app also uses — otherwise a sign error shared by both
 *  sides would agree with itself. 60 − 2×7 = 46 across; 130 − 22 − 18 = 90
 *  front to back. */
const ENVELOPE = {
  widthFt: LOT.frontageFt - 2 * LOT.sideSetbackFt,
  depthFt: LOT.depthFt - LOT.frontSetbackFt - LOT.rearSetbackFt,
} as const;

/** That fallback rectangle, in the same units as a stored parcel. */
const PLACEHOLDER = {
  lotWidthFt: Number(INITIAL_PARCEL.lotWidth),
  lotDepthFt: Number(INITIAL_PARCEL.lotDepth),
  frontSetbackFt: Number(INITIAL_PARCEL.front),
  sideSetbackFt: Number(INITIAL_PARCEL.side),
  rearSetbackFt: Number(INITIAL_PARCEL.rear),
} as const;

/** The five numbers a stored parcel has to come back with. */
const STATED = {
  lotWidthFt: LOT.frontageFt,
  lotDepthFt: LOT.depthFt,
  frontSetbackFt: LOT.frontSetbackFt,
  sideSetbackFt: LOT.sideSetbackFt,
  rearSetbackFt: LOT.rearSetbackFt,
} as const;

/** The district this flow is stated against. It is chosen through the search
 *  box and the result list rather than accepted as the panel's default, because
 *  "the surface renders" and "the surface responds" are different claims. */
const DISTRICT_CODE = "RS";

/* ------------------------------------------------------------ the witness */

type StoredProjectRow = {
  name?: unknown;
  design?: { document?: { site?: unknown } };
};

interface StoredSite {
  provenance?: unknown;
  grade?: unknown;
  parcel?: {
    lotWidthFt?: unknown;
    lotDepthFt?: unknown;
    frontSetbackFt?: unknown;
    sideSetbackFt?: unknown;
    rearSetbackFt?: unknown;
  } | null;
}

/**
 * Every project this browser has stored, and the site on each.
 *
 * READ FROM THE DATABASE, NOT FROM THE PAGE. The panel's own status line says
 * "Saved onto this project's design." from a state variable it sets itself, so
 * it says exactly that when the write has been deleted. `aura-projects` is
 * where `saveAuraProject` actually puts the record, so it is the only thing on
 * this page qualified to say whether anything was saved.
 *
 * Opening at version 1 matches `lib/project/store.ts`. If the app has never
 * touched the database the store will not exist yet, which is reported as "no
 * projects" rather than as an exception — the no-project case below needs that
 * answer to be a value.
 */
async function storedSites(page: Page): Promise<Array<{ name: string; site: StoredSite | null }>> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, no) => {
      const open = indexedDB.open("aura-projects", 1);
      open.onsuccess = () => ok(open.result);
      open.onerror = () => no(open.error);
    });
    try {
      if (!db.objectStoreNames.contains("projects")) return [];
      const rows = await new Promise<StoredProjectRow[]>((ok, no) => {
        const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
        request.onsuccess = () => ok(request.result as StoredProjectRow[]);
        request.onerror = () => no(request.error);
      });
      return rows.map((row) => ({
        name: typeof row?.name === "string" ? row.name : "",
        site: (row?.design?.document?.site ?? null) as StoredSite | null,
      }));
    } finally {
      db.close();
    }
  });
}

/** The five numbers of the stored parcel, or null when nothing was stored.
 *  Only the five: `frontFaces` and `slope` are left to the panel's own
 *  defaults by this flow, and pinning a default is how a spec starts failing
 *  for a reason that is not a defect. */
async function storedParcel(page: Page): Promise<Record<string, unknown> | null> {
  const rows = await storedSites(page);
  const parcel = rows[0]?.site?.parcel;
  if (!parcel) return null;
  return {
    lotWidthFt: parcel.lotWidthFt,
    lotDepthFt: parcel.lotDepthFt,
    frontSetbackFt: parcel.frontSetbackFt,
    sideSetbackFt: parcel.sideSetbackFt,
    rearSetbackFt: parcel.rearSetbackFt,
  };
}

/* ------------------------------------------------------------- the driving */

/** A project for the lot to land on, made the way a person makes one. */
async function startProject(page: Page, name: string): Promise<void> {
  await page.goto("/start");
  await page.getByRole("button", { name: "Find land + build" }).click();
  await page.getByLabel("Project purpose").selectOption("primary-home");
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Create my project" }).click();

  /* Waited on in STORAGE rather than on a redirect. Where /start sends somebody
     next is its own decision and has moved before; what this helper owes the
     rest of the file is a project that exists to be written onto. */
  await expect
    .poll(async () => (await storedSites(page)).map((row) => row.name), {
      message: "creating a project through /start stored nothing",
      timeout: 20_000,
    })
    .toEqual([name]);
}

/** /land, with a district chosen out of the result list. Returns the panel. */
async function openStatedLotPanel(page: Page) {
  await page.goto("/land");

  const search = page.getByLabel("Zone code or district name");
  await expect(search).toBeVisible({ timeout: 60_000 });
  await search.fill(DISTRICT_CODE);

  const chosen = page
    .locator("ul.zoning-results li button")
    .filter({ has: page.locator("span.zoning-result-code", { hasText: new RegExp(`^${DISTRICT_CODE}$`) }) })
    .first();
  await expect(
    chosen,
    `the district result list offers no ${DISTRICT_CODE} button, so no district can be selected on /land`,
  ).toBeVisible();
  await chosen.click();

  /* The district panel is what mounts the lot panel, so prove the selection
     landed before blaming the lot panel for being absent. */
  await expect(chosen).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("p.zoning-code")).toHaveText(DISTRICT_CODE);

  const panel = page.locator('[data-slot="stated-lot"]');
  await expect(
    panel,
    'no [data-slot="stated-lot"] on /land under a selected district. The lot panel is not mounted, so nobody can state a lot at all — every other assertion in this file is about a surface that is not there.',
  ).toBeVisible();
  return panel;
}

/** Type the fixture into the panel. `fill` replaces whatever the field opened
 *  on, so this states the lot whether the form arrives blank or prefilled. */
async function stateTheLot(panel: ReturnType<Page["locator"]>): Promise<void> {
  await panel.getByLabel(/Frontage along the front lot line/).fill(String(LOT.frontageFt));
  await panel.getByLabel(/Lot depth \(ft\)/).fill(String(LOT.depthFt));
  await panel.getByLabel(/Front setback \(ft\)/).fill(String(LOT.frontSetbackFt));
  await panel.getByLabel(/Side setback \(ft\)/).fill(String(LOT.sideSetbackFt));
  await panel.getByLabel(/Rear setback \(ft\)/).fill(String(LOT.rearSetbackFt));
}

/* =========================================================================== */

test.describe("in a served build", () => {
  /* SKIPPED without a baseURL. Only playwright.ui.config.ts supplies one; in
     any other gate this file would declare four assertions and run none. */
  test.skip(({ baseURL }) => !baseURL, "needs a served build (playwright.ui.config.ts)");

  test("stating a lot on /land writes it onto the open project, and the builder measures the same rectangle", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    /* THE FIXTURE HAS TO BE ABLE TO DISAGREE WITH THE PLACEHOLDER. If any
       stated number equalled the number the form opens on, a commit that stored
       the placeholder rectangle would satisfy the read-back below and this whole
       test would be measuring nothing. */
    for (const key of Object.keys(STATED) as Array<keyof typeof STATED>) {
      expect(
        STATED[key],
        `the fixture's ${key} equals the panel's placeholder, so storing the placeholder would pass this test`,
      ).not.toBe(PLACEHOLDER[key]);
    }

    await startProject(page, "Stated lot flow");

    const panel = await openStatedLotPanel(page);

    /* Nothing is on the design yet: the project was made two steps ago and no
       lot has been pressed. Establishing this is what makes the read-back after
       the press a CHANGE rather than a coincidence. */
    expect(await storedParcel(page), "the project already carried a parcel before any lot was stated").toBeNull();

    await stateTheLot(panel);

    const commit = panel.getByRole("button", { name: /Use this lot in my design/ });
    await expect(
      commit,
      "the commit control is not offered on a complete lot, so there is no way to state one",
    ).toBeEnabled();
    await commit.click();

    /* THE ASSERTION THIS FILE EXISTS FOR.
       Not the panel's status line — that is a state variable the component sets
       for itself, and it reads "Saved onto this project's design." just as
       happily when the write has been deleted. This is the stored record. */
    await expect
      .poll(() => storedParcel(page), {
        message:
          "the project in IndexedDB carries no stated parcel after the commit control was pressed. The button is a no-op: it rendered, it enabled, it reported success, and nothing reached the document.",
        timeout: 20_000,
      })
      .toEqual(STATED);

    /* And it is recorded as the reader's own statement rather than as something
       carried over from a demonstration record. The exact provenance word is
       another node's decision, so what is pinned is the one value it must never
       be. */
    const site = (await storedSites(page))[0]?.site;
    expect(site?.provenance, "a hand-stated lot was stored as if it came from a listing").not.toBe(
      "listing-derived",
    );
    expect(typeof site?.provenance, "the stored site records no provenance at all").toBe("string");

    /* Only now is the on-screen message worth reading — as copy, on top of a
       write that has already been proved, never as evidence of one. */
    await expect(panel.getByRole("status")).toContainText("Saved onto this project");

    /* ---------------------------------------------------------------------
       THE PAYOFF, in the place a person would go looking for it. The builder
       hydrates its document from the stored project, and its Site step states
       the buildable envelope. That envelope must be the stated lot MINUS the
       stated setbacks — 46 × 90 — and it must not be the lot itself. */
    await page.goto("/build");

    const steps = page.getByRole("navigation", { name: "Guided design steps" });
    await expect(steps, "the guided step nav never appeared, so the builder did not load").toBeVisible({
      timeout: 120_000,
    });
    await steps.getByRole("button", { name: "Site", exact: true }).click();

    const siteStep = page.locator(".builder-site-step");
    await expect(siteStep).toBeVisible({ timeout: 60_000 });
    await expect(
      siteStep.getByLabel(/Lot width along the front/),
      "the builder's Site step did not open on the stated frontage, so the site did not reach the document",
    ).toHaveValue(String(LOT.frontageFt));

    const fit = page.locator(".builder-site-step__fit");
    await expect(
      fit,
      "the builder's Site step shows no fit answer, so it derived no envelope from the stated lot",
    ).toBeVisible();

    /* Non-breaking spaces sit either side of the multiplication sign in the
       markup; a reader sees one space, so the comparison is made on one. */
    const said = (await fit.innerText()).replace(/\u00a0/g, " ");
    expect(
      said,
      `the builder's Site step does not state a ${ENVELOPE.widthFt} × ${ENVELOPE.depthFt} ft envelope for a ${LOT.frontageFt} × ${LOT.depthFt} ft lot with ${LOT.frontSetbackFt}/${LOT.sideSetbackFt}/${LOT.rearSetbackFt} ft setbacks`,
    ).toContain(`${ENVELOPE.widthFt} × ${ENVELOPE.depthFt} ft`);

    /* THE DISCRIMINATOR. An implementation that stored the lot and forgot the
       setbacks would print the lot's own dimensions here and would satisfy
       every other line above. */
    expect(
      said,
      "the builder is reporting the whole lot as the buildable envelope — the stated setbacks were not taken off it",
    ).not.toContain(`${LOT.frontageFt} × ${LOT.depthFt} ft`);
  });

  test("with no project open the lot control refuses in words, and writes nothing", async ({ page }) => {
    test.setTimeout(240_000);

    /* THE TWO SENTENCES HAVE TO BE DIFFERENT. The panel already names the
       missing project before anything is pressed, so "the note is on screen" is
       not a fact about the press. The refusal the press produces carries a
       prefix the idle note does not, and that difference is what the before /
       after comparison below actually measures. */
    const refusal = commitState({ kind: "problem", message: NO_PROJECT_NOTE }, true, false)[0];
    expect(
      refusal,
      "the pressed refusal is word-for-word the idle note, so this test cannot tell a press from a page load",
    ).not.toBe(NO_PROJECT_NOTE);

    const panel = await openStatedLotPanel(page);
    await stateTheLot(panel);

    const status = panel.getByRole("status");
    await expect(status, "the panel refused before it was asked").not.toContainText(refusal);

    const commit = panel.getByRole("button", { name: /Use this lot in my design/ });
    await expect(
      commit,
      "the commit control is disabled with no project open, so the refusal is a greyed button rather than a sentence",
    ).toBeEnabled();
    await commit.click();

    /* It says so, in full, naming the way out. */
    await expect(status, "pressing with no project open produced no refusal on screen").toContainText(refusal);
    await expect(status).toContainText("Start or open a project");

    /* And it did what it said: nothing. A refusal that quietly created a
       project to write onto would be worse than a dead control. */
    expect(
      await storedSites(page),
      "a project was written to storage even though the panel said there was none to write onto",
    ).toEqual([]);
  });
});
