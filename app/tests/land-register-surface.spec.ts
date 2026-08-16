/* THE REGISTER SURFACE ON /land — the half of the page's own claim that was
 * not true.
 *
 * WHAT WENT WRONG, and why this file is a served-build spec rather than another
 * pure one.
 *
 * /land's boundary panel printed "Aura can tell you what the City of Edmonton's
 * rules and its property register say about a lot you already have." Both
 * register modules — lib/land/lotAreas.ts and lib/land/propertyLookup.ts — were
 * imported by nothing but their own spec. Every assertion about them passed. No
 * figure they produce had ever reached a reader, and the same rendered page
 * contradicted the claim four screens down.
 *
 * That is the shape of defect a pure spec cannot see. tests/land-lot-areas.spec.ts
 * proves `lookupProperty` handles a 429, a 500, a timeout and a garbled body,
 * offline, and it proves them by calling the function. A verifier deleted the
 * commit call out of the neighbouring panel and 46 of 46 tests stayed green,
 * because no test pressed anything. So the rules for this file are:
 *
 *   1. THE MOUNT IS AN ASSERTION. `[data-slot="land-register-surface"]` must be
 *      on the page a browser renders, inside the district panel, above the lot
 *      somebody states. Wrapping the mount in `{false ? … : null}` has to turn
 *      this file red, and that mutation was run.
 *
 *   2. THE BUTTON IS PRESSED. Not `lookupProperty` called from Node — the
 *      control, clicked, in a browser, with the City's endpoint intercepted so
 *      the outcome is chosen rather than hoped for. Replacing the lookup call
 *      with an inert statement has to turn this file red, and that mutation was
 *      run too.
 *
 *   3. THE NEGATIVE IS MEASURED, NOT PROMISED. "Nothing is sent until you press
 *      it" is a sentence printed on the page. Here it is a request counter that
 *      must read zero after a district is chosen and an address is typed, and
 *      then must read one after the press — because a counter that can only ever
 *      say zero says nothing.
 *
 * WHY IT NEEDS A SERVED BUILD. Hydration. `renderToStaticMarkup` gives the
 * initial state and no handlers, which is exactly the hole above. So this file
 * skips without a baseURL and belongs in playwright.ui.config.ts, which supplies
 * one — the rule tests/gate-coverage.spec.ts enforces.
 *
 * NOTHING HERE TOUCHES THE REAL PORTAL. Every request to data.edmonton.ca is
 * intercepted. A gate that depends on a municipal open-data portal being up is
 * not a gate.
 */
import { expect, test } from "playwright/test";

import {
  ADDRESS_UNREADABLE_NOTE,
  LOT_AREA_FIELD_LABEL,
  REGISTER_AREA_NOTE,
  REGISTER_AS_OF_NOTE,
  REGISTER_LANDING_NOTE,
  REGISTER_NETWORK_NOTE,
  REGISTER_NO_STAMP_NOTE,
  ZONING_DEFAULT_CODE,
  districtTypicalFigures,
  noRowNote,
  noTypicalNote,
  registerRowSentence,
} from "@/components/land/ZoningLookup";
import {
  EDMONTON_LOT_AREA_SET,
  LOT_AREA_BOUNDARY,
  LOT_AREA_COVERAGE_NOTE,
  lotAreaSummaryForBaseCode,
  lotAreaSummarySentence,
} from "@/lib/land/lotAreas";
import { PROPERTY_LOOKUP_SENDS_NOTE } from "@/lib/land/propertyLookup";
import { EDMONTON_DISTRICTS, findEdmontonDistrict } from "@/lib/marketplace/landData";

test.skip(({ baseURL }) => !baseURL, "needs a served build (playwright.ui.config.ts)");

/* ------------------------------------------------------------- fixtures */

const PORTAL = "**/data.edmonton.ca/**";

/** One real row, shaped the way the portal shapes them. The figures are the
 *  ones data.edmonton.ca actually returned for this address on 2026-08-15,
 *  written down rather than invented so the arithmetic below is checkable. */
const ONE_ROW = {
  house_number: "12110",
  street_name: "148 AVENUE NW",
  zoning: "RS",
  lot_size: "585.31",
  legal_description: "Plan: 8722208  Block: 16  Lot: 103",
  neighbourhood: "CAERNARVON",
};

const TYPED_ADDRESS = "12110 148 Ave NW";

const SURFACE = '[data-slot="land-register-surface"]';
const ADDRESS = '[data-slot="land-register-address"]';
const ASK = '[data-slot="land-register-button"]';
const ROW = '[data-slot="land-register-row"]';
const STATED = '[data-slot="stated-lot"]';

/** Counts every request that leaves for the City, preflights included. Returned
 *  as a live object so a test can read it before and after a press. */
function watchPortal(page: import("playwright/test").Page): { count: number } {
  const seen = { count: 0 };
  page.on("request", (request) => {
    if (request.url().includes("data.edmonton.ca")) seen.count += 1;
  });
  return seen;
}

/** Answers the City's endpoint with whatever this test wants it to say. The
 *  `access-control-expose-headers` line is deliberate: a browser can only read
 *  a response header the server exposes, which is why the real portal's
 *  `X-SODA2-Truth-Last-Modified` never reaches the page. */
async function answerPortal(
  page: import("playwright/test").Page,
  body: unknown,
  init?: { status?: number; raw?: string; stamp?: string },
) {
  await page.route(PORTAL, async (route) => {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (init?.stamp) {
      headers["X-SODA2-Truth-Last-Modified"] = init.stamp;
      headers["access-control-expose-headers"] = "X-SODA2-Truth-Last-Modified";
    }
    await route.fulfill({
      status: init?.status ?? 200,
      headers,
      body: init?.raw ?? JSON.stringify(body),
    });
  });
}

/** /land, loaded, with React actually running. The address input is a
 *  controlled field, so it only accepts a value once hydration has attached its
 *  handler — which makes "this typed" the honest hydration gate. */
async function openLand(page: import("playwright/test").Page) {
  await page.goto("/land");
  await expect(
    page.locator(SURFACE),
    'no [data-slot="land-register-surface"] on /land — the register block is not mounted, so every assertion after this one would be measuring a page nobody can see',
  ).toHaveCount(1);
  await page.locator(ADDRESS).fill("hydration probe");
  await expect(page.locator(ADDRESS)).toHaveValue("hydration probe");
  await page.locator(ADDRESS).fill("");
}

/** Types an address and presses the one button. Returns after the surface has
 *  stopped saying it is asking — there is no branch that leaves it saying so
 *  forever, and if one is ever added this hangs here rather than passing. */
async function askTheCity(page: import("playwright/test").Page, address: string) {
  await page.locator(ADDRESS).fill(address);
  await expect(page.locator(ASK)).toBeEnabled();
  await page.locator(ASK).click();
  await expect(page.locator(ASK)).toContainText("Ask the City for this lot's area", { timeout: 15_000 });
}

/* ══════════════════════════════════════════════════════ 1. it is on the page */

test("the register surface is mounted in the district panel, above the lot somebody states", async ({
  page,
}) => {
  /* B4's lesson, applied to this block before anything else is asserted about
     it. A verifier changed `{<StatedLotPanel …/>}` to `{false ? … : null}` and
     46 of 46 specs stayed green, because every one of them tested the module
     and none of them tested the page. */
  await openLand(page);

  const surface = page.locator(SURFACE);
  await expect(surface, "the register surface is not on /land at all").toHaveCount(1);

  /* Presence is not rendering. An empty wrapper satisfies a count and shows a
     reader nothing, which is the state this whole remediation is about. */
  const text = (await surface.textContent()) ?? "";
  expect(
    text.length,
    "the register surface is on the page but nearly empty, so it is a wrapper rather than a surface",
  ).toBeGreaterThan(900);

  /* AND WHERE IT IS. Inside the district panel — a block that answers a
     district question has to be under the district that raised it — and above
     the panel where a person states their own lot, because the area it can
     return is the number that panel takes. */
  const position = await page.evaluate(
    ({ surfaceSelector, statedSelector }) => {
      const found = document.querySelector(surfaceSelector);
      const stated = document.querySelector(statedSelector);
      const panel = document.querySelector(".zoning-panel");
      if (!found || !stated || !panel) {
        return { insidePanel: found !== null && panel !== null, precedesStated: null, statedFound: stated !== null };
      }
      return {
        insidePanel: panel.contains(found),
        /* DOCUMENT_POSITION_FOLLOWING === 4, computed by the DOM rather than
           inferred from where the JSX happens to sit in the file. */
        precedesStated:
          (found.compareDocumentPosition(stated) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        statedFound: true,
      };
    },
    { surfaceSelector: SURFACE, statedSelector: STATED },
  );

  expect(position.statedFound, "the stated-lot panel is gone, so the ordering below measures nothing").toBe(true);
  expect(position.insidePanel, "the register surface is outside the selected district's panel").toBe(true);
  expect(
    position.precedesStated,
    "what the City's register can say must be readable before the field a reader types their own lot into",
  ).toBe(true);

  /* THE BOUNDARY IS PRINTED, not paraphrased. A property register says who owns
     what and never what is being sold; the module exports that sentence as a
     constant for exactly this reason. */
  expect(text, "the register boundary sentence is missing from the surface").toContain(LOT_AREA_BOUNDARY);
});

/* ════════════════════════════════════════════════ 2. the aggregate is visible */

test("the district typical is printed from the baked aggregate, with its source", async ({ page }) => {
  /* THE PAYOFF OF THE SCOPE CALL. A per-zone aggregate shipped instead of
     282,034 parcel rows, on the argument that a person could then see what a lot
     in their district turns out to be. Until this block existed, nobody could:
     the figures were real, re-derivable, licensed, and unreachable. */
  const district = findEdmontonDistrict(ZONING_DEFAULT_CODE);
  expect(district, `${ZONING_DEFAULT_CODE} must still be in the baked set`).toBeTruthy();
  if (!district) return;

  const summary = lotAreaSummaryForBaseCode(district.baseCode);
  expect(summary, `${district.baseCode} must still be in the register aggregate`).toBeTruthy();
  if (!summary) return;

  const figures = districtTypicalFigures(district);
  expect(figures.map((figure) => figure.id)).toEqual(["p10", "p25", "median", "p75", "p90"]);
  for (const figure of figures) {
    // The rule the rest of this surface already follows: no unsourced number.
    expect(figure.sourceHref, `${figure.id} source`).toMatch(/^https:\/\//);
    expect(figure.value, `${figure.id} states both units`).toContain("m2");
    expect(figure.value, `${figure.id} states both units`).toContain("sq ft");
  }

  await openLand(page);
  const text = (await page.locator(SURFACE).textContent()) ?? "";

  /* The sentence the data module writes, rendered whole. It names the
     population it was computed over and says out loud that it is not the size
     of any one property. */
  expect(text, "the median sentence is not on screen").toContain(lotAreaSummarySentence(summary));
  for (const figure of figures) {
    expect(text, `the ${figure.id} figure is not on screen`).toContain(figure.value);
    expect(text, `the ${figure.id} label is not on screen`).toContain(figure.label);
  }

  /* An area read as a dimension is one word of carelessness away, so the
     sentence that separates them is required, as is the coverage window — the
     portal's four dates disagree with each other and the surface discloses
     rather than reconciles. */
  expect(text, "the surface does not say these figures are areas").toContain(REGISTER_AREA_NOTE);
  expect(text, "the coverage window is not disclosed").toContain(LOT_AREA_COVERAGE_NOTE);

  /* Every figure in this block carries a link a reader can open, checked in the
     DOM: a component handed a source and forgetting to print it passes every
     assertion above. */
  const links = await page
    .locator(`${SURFACE} .zoning-figure a`)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
  expect(links.length, "the typical figures rendered without their source links").toBe(figures.length);
  for (const href of links) expect(href).toBe(EDMONTON_LOT_AREA_SET.source.catalogueUrl);
});

test("a district the register files no lot under says so rather than showing a blank", async ({ page }) => {
  /* 19 of the 156 districts have no row in the aggregate — the bake's join
     dropped codes the register never carried. A blank there reads as a page
     still loading, so the state is written out. */
  const orphan = EDMONTON_DISTRICTS.find(
    (candidate) => lotAreaSummaryForBaseCode(candidate.baseCode) === null,
  );
  expect(
    orphan,
    "every district now has a register summary, so this branch is unreachable and the copy behind it should be deleted rather than left as decoration",
  ).toBeTruthy();
  if (!orphan) return;

  expect(districtTypicalFigures(orphan), `${orphan.code} must state no figures`).toEqual([]);

  await openLand(page);
  await page.locator("#zoning-code").fill(orphan.code);
  await page
    .locator(".zoning-result", { has: page.locator(".zoning-result-code", { hasText: new RegExp(`^${orphan.code}$`) }) })
    .first()
    .click();

  const text = (await page.locator(SURFACE).textContent()) ?? "";
  expect(text, `${orphan.code} did not say why it has no register figures`).toContain(noTypicalNote(orphan));
  /* And the block is still a block: the live call is offered on a district with
     no aggregate exactly as it is on one with an aggregate. */
  expect(await page.locator(ASK).count(), "the live call disappeared with the aggregate").toBe(1);
});

/* ════════════════════════════════════════════ 3. nothing leaves until a press */

test("nothing reaches the City until the button is pressed", async ({ page }) => {
  /* The page prints "nothing is sent until you press it". This is that sentence
     as a measurement rather than a promise. */
  const portal = watchPortal(page);
  await answerPortal(page, [ONE_ROW]);

  await openLand(page);
  expect(portal.count, "/land asked the City for something on load").toBe(0);

  /* Typing an address, character by character, sends nothing. */
  await page.locator(ADDRESS).pressSequentially(TYPED_ADDRESS, { delay: 5 });
  expect(portal.count, "a keystroke in the address field reached the City").toBe(0);

  /* Choosing a different district sends nothing either — the aggregate above is
     baked, and re-rendering this block must not turn into a request. */
  await page.locator("#zoning-code").fill("RS");
  await page
    .locator(".zoning-result", { has: page.locator(".zoning-result-code", { hasText: /^RS$/ }) })
    .first()
    .click();
  await expect(page.locator(SURFACE)).toContainText("RS properties");
  expect(portal.count, "choosing a district reached the City").toBe(0);

  /* THE DETECTOR. A counter that can only read zero is not a measurement, so
     the press has to move it — and the "nothing before" above is only worth
     something because "one after" is proved here. */
  await askTheCity(page, TYPED_ADDRESS);
  expect(portal.count, "pressing the button did not reach the City at all").toBeGreaterThan(0);
});

/* ══════════════════════════════════════════════════ 4. the button does a thing */

test("pressing the button prints the area the City returned, stated as an area", async ({ page }) => {
  /* B3'S LESSON, WHICH IS THE REASON THIS FILE EXISTS. The neighbouring panel's
     commit call was replaced with `void site;` and every spec stayed green,
     because the round trip was proved by calling the function rather than by
     pressing the control. So this presses the control. */
  await answerPortal(page, [ONE_ROW], { stamp: "Mon, 10 Aug 2026 08:59:37 GMT" });
  await openLand(page);

  await expect(page.locator(ROW), "a row was on screen before anything was asked").toHaveCount(0);
  await askTheCity(page, TYPED_ADDRESS);

  const rows = page.locator(ROW);
  await expect(rows, "the press produced no row").toHaveCount(1);

  /* The sentence is built by an exported pure function, so what is asserted
     here is that the component RENDERED it — the arithmetic itself is checked
     beside it. */
  const expected = registerRowSentence({
    houseNumber: ONE_ROW.house_number,
    streetName: ONE_ROW.street_name,
    zoneCode: ONE_ROW.zoning,
    lotAreaSqM: Number(ONE_ROW.lot_size),
    legalDescription: ONE_ROW.legal_description,
    neighbourhood: ONE_ROW.neighbourhood,
  });
  await expect(rows.first()).toContainText(expected);

  /* 585.31 m2 is 6,300 sq ft. Both units, and the conversion is the one the
     district register uses. If this ever reads 585 sq ft the units have flipped
     and every figure on the surface is wrong by a factor of ten. */
  expect(expected).toContain("585 m2");
  expect(expected).toContain("6,300 sq ft");

  /* AN AREA IS AN AREA. It is not a frontage and not a depth, and the sentence
     that says so has to be beside the number rather than in a footnote. */
  const surface = (await page.locator(SURFACE).textContent()) ?? "";
  expect(surface, "the returned area is not said to be an area").toContain(REGISTER_LANDING_NOTE);
  expect(REGISTER_LANDING_NOTE).toContain(LOT_AREA_FIELD_LABEL);

  /* And the field that sentence sends a reader to is really down there under
     that name. A rename in the panel below turns this red rather than leaving
     the direction pointing at nothing. */
  await expect(
    page.locator(STATED),
    `the register surface directs a reader to a field named "${LOT_AREA_FIELD_LABEL}" that the stated-lot panel no longer has`,
  ).toContainText(LOT_AREA_FIELD_LABEL);

  /* The register's zone code is a BASE code with the h and f modifiers
     stripped, so an address still leaves the ceiling unknown. Saying otherwise
     would be the one thing this whole data layer refuses. */
  expect(expected).toContain("no height ceiling");

  /* The change stamp, in the branch where the portal exposes it. */
  expect(surface, "the exposed change stamp was not printed").toContain(
    REGISTER_AS_OF_NOTE("2026-08-10T08:59:37.000Z"),
  );
});

test("without a readable change stamp the surface says so instead of implying one", async ({ page }) => {
  /* THE BRANCH A READER ACTUALLY GETS. Asked from a real page, data.edmonton.ca
     exposes `content-type` and `last-modified` and nothing else, so the
     freshness header `lookupProperty` reads is not readable across origins and
     comes back null every time. Printing nothing there would read as a stamp
     Aura had chosen not to show. */
  await answerPortal(page, [ONE_ROW]);
  await openLand(page);
  await askTheCity(page, TYPED_ADDRESS);

  const surface = (await page.locator(SURFACE).textContent()) ?? "";
  await expect(page.locator(ROW)).toHaveCount(1);
  expect(surface, "the missing change stamp is not accounted for").toContain(REGISTER_NO_STAMP_NOTE);
  expect(surface, "a stamp was claimed that this browser never received").not.toContain(
    "The register's own stamp says",
  );
});

/* ═══════════════════════════════════════════ 5. every refusal explains itself */

test("an address this dataset cannot be asked about is refused without sending it", async ({ page }) => {
  const portal = watchPortal(page);
  await answerPortal(page, [ONE_ROW]);
  await openLand(page);

  await page.locator(ADDRESS).fill("no number here");
  await expect(page.locator(ASK)).toBeEnabled();
  await page.locator(ASK).click();

  await expect(page.locator(SURFACE)).toContainText(ADDRESS_UNREADABLE_NOTE);
  expect(portal.count, "an address the dataset cannot answer was sent to the City anyway").toBe(0);
  /* Not a dead control: the field is still typable and the button still says
     what it does. */
  await expect(page.locator(ASK)).toBeEnabled();
  await expect(page.locator(ADDRESS)).toBeEditable();
});

test("every way the City can fail prints what failed and leaves the number typable", async ({ page }) => {
  /* All four failures a reader can hit, driven through the real control. The
     module's own spec proves `lookupProperty` returns these outcomes; what is
     unproved until here is that the surface renders them, keeps the button
     alive, and never leaves a spinner that does not resolve. */
  const cases: Array<{
    label: string;
    arrange: (page: import("playwright/test").Page) => Promise<void>;
    expects: string;
  }> = [
    {
      label: "unreachable",
      arrange: async (target) => {
        await target.route(PORTAL, (route) => route.abort("connectionfailed"));
      },
      expects: "could not reach the City",
    },
    {
      label: "throttled",
      arrange: async (target) => answerPortal(target, null, { status: 429, raw: "" }),
      expects: "limiting requests",
    },
    {
      label: "a portal error",
      arrange: async (target) => answerPortal(target, null, { status: 500, raw: "" }),
      expects: "HTTP 500",
    },
    {
      label: "no row",
      arrange: async (target) => answerPortal(target, []),
      expects: noRowNote({ houseNumber: "12110", streetName: "148 AVENUE NW" }),
    },
  ];

  for (const scenario of cases) {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await scenario.arrange(page);
    await openLand(page);
    await askTheCity(page, TYPED_ADDRESS);

    const surface = page.locator(SURFACE);
    await expect(surface, `${scenario.label} printed no sentence naming what failed`).toContainText(
      scenario.expects,
    );

    /* NO SPINNER THAT NEVER RESOLVES. `askTheCity` already waits for the idle
       label to come back, so reaching this line is the assertion; this states
       it as one so a future rewrite cannot lose it silently. */
    await expect(page.locator(ASK), `${scenario.label} left the button saying it was asking`).toContainText(
      "Ask the City for this lot's area",
    );
    await expect(page.locator(ASK), `${scenario.label} left a dead button`).toBeEnabled();

    /* AND THE PERSON CAN STILL TYPE THE NUMBER. That is the whole contract of a
       refusal here: the lookup is a convenience, and the lot area was always
       something a person could state. */
    const typable = page.locator(`${STATED} input[type="number"]:not([disabled])`);
    expect(
      await typable.count(),
      `${scenario.label} left no field a reader can type the lot area into`,
    ).toBeGreaterThan(0);
    await expect(page.locator(STATED)).toContainText(LOT_AREA_FIELD_LABEL);

    /* No row is invented out of a failure. */
    await expect(page.locator(ROW), `${scenario.label} rendered a row anyway`).toHaveCount(0);
  }
});

/* ══════════════════════════════════════════════ 6. offline is the normal mode */

test("the rest of /land works with the City unreachable", async ({ page }) => {
  /* THE DEFAULT, NOT A DEGRADED MODE. Everything on this page except one button
     is baked into Aura. So the portal is cut off for the whole of this test and
     the surfaces around it are exercised anyway. */
  await page.route(PORTAL, (route) => route.abort("connectionfailed"));
  await openLand(page);

  /* The district typical still renders — it is a baked artifact and was never a
     network call. */
  const district = findEdmontonDistrict(ZONING_DEFAULT_CODE);
  expect(district).toBeTruthy();
  if (!district) return;
  const summary = lotAreaSummaryForBaseCode(district.baseCode);
  expect(summary).toBeTruthy();
  if (!summary) return;
  await expect(page.locator(SURFACE)).toContainText(lotAreaSummarySentence(summary));

  /* The district search still answers. */
  await page.locator("#zoning-code").fill("RS");
  await page
    .locator(".zoning-result", { has: page.locator(".zoning-result-code", { hasText: /^RS$/ }) })
    .first()
    .click();
  await expect(page.locator(".zoning-panel")).toContainText("7 of 7 questions unanswered");

  /* The lot somebody states still checks against their own numbers. */
  await expect(page.locator(STATED)).toContainText(LOT_AREA_FIELD_LABEL);
  await expect(page.locator(STATED)).toBeVisible();

  /* And the one call that does need the network fails with a sentence rather
     than taking anything else down. */
  await askTheCity(page, TYPED_ADDRESS);
  await expect(page.locator(SURFACE)).toContainText("Everything else on this page still works");

  /* The page is still the page afterwards: the search, the district panel and
     the stated-lot panel all still respond after the failure. */
  await page.locator("#zoning-code").fill("RM h16");
  await page
    .locator(".zoning-result", { has: page.locator(".zoning-result-code", { hasText: /^RM h16$/ }) })
    .first()
    .click();
  await expect(page.locator(".zoning-panel")).toContainText("6 of 7 questions unanswered");
});

/* ═══════════════════════════════════ 7. the notice comes before the sending */

test("the reader is told what leaves the browser before the button is pressable", async ({ page }) => {
  const portal = watchPortal(page);
  await answerPortal(page, [ONE_ROW]);
  await openLand(page);

  const surface = (await page.locator(SURFACE).textContent()) ?? "";
  /* Printed on arrival, not after the fact. Both sentences: what goes, and that
     this is the only thing here that needs a network at all. */
  expect(surface, "the surface does not say what leaves the browser").toContain(PROPERTY_LOOKUP_SENDS_NOTE);
  expect(surface, "the surface does not say this is the one live call").toContain(REGISTER_NETWORK_NOTE);
  expect(PROPERTY_LOOKUP_SENDS_NOTE).toContain("data.edmonton.ca");

  /* The notice is ABOVE the control it describes, which is the difference
     between a disclosure and a receipt. */
  const order = await page.evaluate(
    ({ surfaceSelector, buttonSelector, notice }) => {
      const found = document.querySelector(surfaceSelector);
      const button = document.querySelector(buttonSelector);
      if (!found || !button) return null;
      const before = (found.textContent ?? "").indexOf(notice);
      const at = (found.textContent ?? "").indexOf("Ask the City for this lot");
      return { before, at };
    },
    { surfaceSelector: SURFACE, buttonSelector: ASK, notice: PROPERTY_LOOKUP_SENDS_NOTE },
  );
  expect(order, "the surface or the button is missing, so this ordering measures nothing").not.toBeNull();
  expect(order!.before, "the notice about what is sent is not on screen").toBeGreaterThan(-1);
  expect(order!.at, "the button label is not on screen").toBeGreaterThan(-1);
  expect(order!.before, "the button comes before the sentence saying what pressing it sends").toBeLessThan(
    order!.at,
  );

  /* Reading the notice sends nothing, which is the claim the notice makes. */
  expect(portal.count).toBe(0);
});
