/* LAND03 (builder C) — what /land shows first, and what it does not show at all.
 *
 * The page had one honest surface and four invented ones, and the invented ones
 * came first. `tests/land-ui.spec.ts:317` already pins that the zoning lookup is
 * MOUNTED and that its source position precedes the demonstration counter's
 * label. That is an `indexOf` into a file, which is a proxy for document order
 * and not document order: a mount moved inside a conditional, or wrapped in a
 * container that renders later, keeps the same source index and loses the
 * property the assertion was written to protect.
 *
 * So this file renders the real page component into a real DOM and measures the
 * two facts the restructure exists to create:
 *
 *   1. DOCUMENT ORDER. The City of Edmonton zoning surface precedes the
 *      demonstration block, measured with `compareDocumentPosition` rather than
 *      with a string index.
 *   2. THE DEFAULT. A cold visit renders no demonstration record at all — zero
 *      fit cards, zero "not an active listing" badges, zero map. The records
 *      still exist and are still four; they sit behind a press.
 *
 * `renderToStaticMarkup` gives exactly the initial client state, which is the
 * state under test. The PRESSED half of the toggle is proved in
 * `tests/marketplace-ui.spec.ts` against the served export, because pressing a
 * button needs hydration and this gate has none.
 *
 * Every assertion is preceded by its own detector: a fabricated document that
 * the same query must report differently. A count of zero from a query that can
 * no longer find anything is indistinguishable from a page that is behaving.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "playwright/test";

/* ─────────────────────────────────────────────────────────────────────────────
   WHY THIS FILE REQUIRES INSTEAD OF IMPORTING, and why it rewires a runtime.

   Playwright transforms every .tsx it loads with `jsxImportSource` pointed at
   its own `playwright/jsx-runtime`, whose `jsx()` returns a plain
   `{ __pw_type: "jsx", type, props, key }` object rather than a React element.
   React refuses those as children — "Objects are not valid as a React child
   (found: object with keys {__pw_type, type, props, key})" — so any component
   that renders another component cannot be server-rendered under the runner.

   `components/land/ZoningLookup.tsx:3` already solves this for itself with a
   per-file `@jsxImportSource react` pragma, which works there because that
   component renders only host elements. /land renders `Reveal`, `LandMap`,
   `Link` and `ZoningLookup`, and those files belong to other modules; asking
   three of them to carry a pragma so that this gate can run would be a test
   reaching into source it does not own.

   So the substitution happens here instead, for this worker, before the page is
   loaded: the runner's jsx runtime is pointed at React's. It is the same change
   the pragma makes, applied once rather than file by file, and it can only make
   components MORE renderable — nothing in this repo consumes `__pw_type`.

   The `require`s follow the patch deliberately. ES imports hoist above every
   statement, so a static `import` of the page would resolve its whole component
   tree against the unpatched runtime and this file would fail exactly the way
   its first draft did.
   ──────────────────────────────────────────────────────────────────────────── */
const pwRuntime = require("playwright/jsx-runtime");
const reactRuntime = require("react/jsx-runtime");
pwRuntime.jsx = reactRuntime.jsx;
pwRuntime.jsxs = reactRuntime.jsxs;
pwRuntime.Fragment = reactRuntime.Fragment;

const { createElement } = require("react") as typeof import("react");
const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
const LandPage = require("@/app/land/page").default as () => JSX.Element;
const { AuraProjectProvider } = require("@/components/project/ProjectContext") as typeof import("@/components/project/ProjectContext");
const { DEMO_LAND_LISTINGS } = require("@/lib/marketplace/discovery") as typeof import("@/lib/marketplace/discovery");

/** The badge the served UI gate counts, character for character. If this string
 *  ever changes on the card, both gates change together. */
const DEMO_BADGE = "Demonstration only · not an active listing";

const source = () =>
  readFileSync(path.resolve(__dirname, "..", "app", "land", "page.tsx"), "utf8");

/* The page inside its provider, in the state a first visit produces: no project
   loaded, no effect run, nothing pressed. */
const coldMarkup = () =>
  renderToStaticMarkup(createElement(AuraProjectProvider, null, createElement(LandPage)));

async function load(page: import("playwright/test").Page, markup: string) {
  await page.setContent(`<!doctype html><html><body>${markup}</body></html>`);
}

/** Reads the ordering fact out of whatever document is loaded. */
const readOrder = (page: import("playwright/test").Page) =>
  page.evaluate(() => {
    const real = document.querySelector('[data-slot="land-real-surface"]');
    const fixture = document.querySelector('[data-slot="land-demonstration"]');
    return {
      realFound: real !== null,
      fixtureFound: fixture !== null,
      /* Length rather than presence: an empty wrapper would satisfy an ordering
         check while the surface it is standing in for renders nothing. */
      realTextLength: (real?.textContent ?? "").length,
      /* DOCUMENT_POSITION_FOLLOWING === 4 — the fixture comes after the real
         surface, computed by the DOM rather than inferred from source text. */
      realPrecedesFixture:
        real !== null && fixture !== null
          ? (real.compareDocumentPosition(fixture) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          : null,
    };
  });

const readFixturePresence = (page: import("playwright/test").Page, badge: string) =>
  page.evaluate((text) => {
    const body = document.body.textContent ?? "";
    let badges = 0;
    let from = body.indexOf(text);
    while (from !== -1) {
      badges += 1;
      from = body.indexOf(text, from + text.length);
    }
    return {
      badges,
      cards: document.querySelectorAll('article[id^="land-"]').length,
      maps: document.querySelectorAll('[aria-label="Map of demonstration parcel fit results"]').length,
      toggles: document.querySelectorAll('[data-slot="land-demo-toggle"]').length,
      togglePressed:
        document.querySelector('[data-slot="land-demo-toggle"]')?.getAttribute("aria-pressed") ?? null,
      toggleLabel: document.querySelector('[data-slot="land-demo-toggle"]')?.textContent ?? null,
    };
  }, badge);

test("the real surface comes before the demonstration one in document order", async ({ page }) => {
  /* THE DETECTOR. The same query, over a document where the two blocks are
     deliberately the wrong way round, must report the opposite — otherwise a
     rename of either data-slot turns this test into a pair of nulls nobody
     notices. */
  await load(
    page,
    '<section data-slot="land-demonstration">fixture</section>' +
      '<section data-slot="land-real-surface">a stand-in long enough to clear the length floor below, so that the detector is failing on ORDER and not on emptiness</section>',
  );
  const inverted = await readOrder(page);
  expect(inverted.realFound && inverted.fixtureFound, "the detector document lost one of its two markers").toBe(true);
  expect(inverted.realTextLength).toBeGreaterThan(100);
  expect(inverted.realPrecedesFixture, "the detector must fail the ordering it exists to detect").toBe(false);

  await load(page, coldMarkup());
  const cold = await readOrder(page);
  expect(cold.realFound, 'the zoning surface wrapper ([data-slot="land-real-surface"]) is not on the page at all').toBe(true);
  expect(cold.fixtureFound, 'the demonstration block ([data-slot="land-demonstration"]) is not on the page at all').toBe(true);
  /* The City's zoning panel is thousands of characters of districts, figures
     and refusals. A wrapper that has lost its contents cannot clear this. */
  expect(
    cold.realTextLength,
    "the real surface wrapper is on the page but nearly empty — the zoning lookup is not rendering inside it",
  ).toBeGreaterThan(1000);
  expect(
    cold.realPrecedesFixture,
    "published City of Edmonton data must reach a reader before the invented records do",
  ).toBe(true);
});

test("a cold visit renders no demonstration record, and the records still exist", async ({ page }) => {
  /* THE DETECTOR, again first: a fabricated document carrying one badge, one
     card and one map must be counted as such. */
  await load(
    page,
    `<article id="land-x">${DEMO_BADGE}</article><div aria-label="Map of demonstration parcel fit results"></div>` +
      '<button data-slot="land-demo-toggle" aria-pressed="true">Return to your own land</button>',
  );
  const seeded = await readFixturePresence(page, DEMO_BADGE);
  expect(seeded.badges, "the badge counter found nothing in a document that contains one").toBe(1);
  expect(seeded.cards, "the card counter found nothing in a document that contains one").toBe(1);
  expect(seeded.maps, "the map counter found nothing in a document that contains one").toBe(1);
  expect(seeded.togglePressed, "the toggle reader cannot see a pressed toggle").toBe("true");

  await load(page, coldMarkup());
  const cold = await readFixturePresence(page, DEMO_BADGE);
  expect(cold.badges, "a first visit to /land showed a fictionalized parcel").toBe(0);
  expect(cold.cards, "a first visit to /land showed a fit card for an invented record").toBe(0);
  expect(cold.maps, "a first visit to /land showed the demonstration map").toBe(0);

  /* The absence is a decision, not an empty fixture. If the demonstration set
     were itself empty this test would pass while proving nothing. */
  expect(DEMO_LAND_LISTINGS.length, "the demonstration set is empty, so hiding it demonstrates nothing").toBe(4);

  /* And the way back is on screen, unpressed, saying what it will do. A hidden
     fixture with no control to reach it is deletion, not a default. */
  expect(cold.toggles, "there is no control to reach the demonstration records").toBe(1);
  expect(cold.togglePressed).toBe("false");
  expect(cold.toggleLabel).toBe("Open demonstration parcels");
});

test("the page states the boundary before it states anything else", async ({ page }) => {
  await load(page, coldMarkup());
  const text = await page.evaluate(() => document.body.textContent ?? "");

  /* The refusal sentence the contract fixes for this page. Printed, not
     paraphrased, and printed above both surfaces. */
  const boundary =
    "It cannot tell you which land somebody is selling, it cannot confirm a lot is yours to buy, and nothing here is a survey, a permit, or a development approval.";
  expect(text, "the page no longer says what it does not promise").toContain(boundary);

  const register = "A property register records who owns what; it never records what is being sold.";
  expect(text, "the register boundary is missing from the cold state").toContain(register);

  /* Detector: the index comparison below is only meaningful if both markers are
     found, and `indexOf` returns -1 rather than throwing when they are not. */
  const boundaryAt = text.indexOf(boundary);
  const zoningAt = text.indexOf("City of Edmonton · authority data, not inventory");
  expect(boundaryAt, "the boundary sentence was not found, so the ordering below measures nothing").toBeGreaterThan(-1);
  expect(zoningAt, "the zoning surface was not found, so the ordering below measures nothing").toBeGreaterThan(-1);
  expect(boundaryAt, "what the page cannot do must be readable before the surface that does it").toBeLessThan(zoningAt);
});

test("the cold page never reads as inventory, and never claims a fit", async ({ page }) => {
  /* /land is the page whose own name — "find land" — sounds like a search for
     land somebody is selling. `land-ui.spec.ts:331` scans the zoning component;
     nothing scanned the page AROUND it, which is where the framing copy lives
     and where a market word would do the most damage.

     THE LIST IS NARROWER THAN `land-ui.spec.ts`'s MARKET_VOCABULARY, and the
     difference is the point. That scan runs over a component that must never
     name a market at all. This page's whole job in its cold state is to explain
     which market it is refusing and why, so it says "listing", "MLS" and
     "REALTOR.ca DDF®" out loud — the last one because it is the lawful path's
     actual name. Refusing to name the thing being refused is not honesty, it is
     evasion. What stays forbidden is any phrase that ASSERTS something is on
     the market. The presence of the named-refusal words is asserted below, so
     narrowing this list cannot quietly become permission to go quiet. */
  const MARKET_CLAIMS = ["for sale", "asking price", "list price", "make an offer", "now available"];
  const MATCH = ["suitable", "guaranteed", "is a match", "matches your"];
  const forbiddenIn = (haystack: string, words: string[]) =>
    words.find((word) => haystack.toLowerCase().includes(word)) ?? null;

  /* TWO WORDS ARE CONTEXTUAL RATHER THAN BANNED, and both are on the page for
     the same reason: they belong to the sentences that describe what Aura is
     NOT permitted to do.
       · "approv" — the lawful MLS path needs "an approved feed", and Aura's
         output is "not a development approval". A data licence and a permit.
       · "eligib" — that path also needs "an eligible broker relationship",
         which Aura does not have. A relationship, not a parcel.
     Dropping either word from the scan would leave the page free to say a lot
     IS approved or eligible. So instead each occurrence must sit next to its
     own subject, and a bare claim about land fails. */
  const CONTEXTUAL: ReadonlyArray<{ stem: string; allowed: RegExp; why: string }> = [
    { stem: "approv", allowed: /feed|development approval/, why: "a data licence or a permit" },
    { stem: "eligib", allowed: /broker/, why: "a broker relationship" },
  ];
  const claimsOutOfContext = (haystack: string): string[] => {
    const hay = haystack.toLowerCase();
    const stray: string[] = [];
    for (const { stem, allowed, why } of CONTEXTUAL) {
      for (let at = hay.indexOf(stem); at >= 0; at = hay.indexOf(stem, at + 1)) {
        const window = hay.slice(Math.max(0, at - 70), at + 70);
        if (!allowed.test(window)) stray.push(`"${stem}" outside ${why}: …${window}…`);
      }
    }
    return stray;
  };

  /* DETECTORS FIRST — every list and rule above must still discriminate. */
  expect(forbiddenIn("this parcel is for sale", MARKET_CLAIMS)).toBe("for sale");
  expect(forbiddenIn("the asking price is $120,000", MARKET_CLAIMS)).toBe("asking price");
  expect(forbiddenIn("the district publishes a ceiling", MARKET_CLAIMS)).toBe(null);
  expect(forbiddenIn("this land is suitable", MATCH)).toBe("suitable");
  expect(forbiddenIn("this land is checked, not judged", MATCH)).toBe(null);
  expect(claimsOutOfContext("this parcel is approved for your home"), "the contextual rule cannot see a bare approval claim").toHaveLength(1);
  expect(claimsOutOfContext("this parcel is eligible for your home"), "the contextual rule cannot see a bare eligibility claim").toHaveLength(1);
  expect(claimsOutOfContext("DDF permissions and an approved feed"), "the contextual rule rejects the licence sentence it is meant to allow").toHaveLength(0);
  expect(claimsOutOfContext("nothing here is a development approval"), "the contextual rule rejects the permit refusal it is meant to allow").toHaveLength(0);
  expect(claimsOutOfContext("requires an eligible broker relationship"), "the contextual rule rejects the broker sentence it is meant to allow").toHaveLength(0);

  await load(page, coldMarkup());
  const seen = await page.evaluate(() => ({
    text: document.body.textContent ?? "",
    /* Attribute text is read aloud and never appears in textContent, which is
       where a forbidden word could sit indefinitely. */
    attributes: Array.from(document.querySelectorAll("*")).flatMap((element) =>
      ["aria-label", "title", "alt", "placeholder"]
        .map((name) => element.getAttribute(name))
        .filter((value): value is string => Boolean(value)),
    ),
  }));

  expect(seen.text.length, "the cold page rendered almost nothing, so the scan below proves nothing").toBeGreaterThan(3000);
  expect(forbiddenIn(seen.text, MARKET_CLAIMS), "the cold /land page reads as inventory").toBe(null);
  expect(forbiddenIn(seen.text, MATCH), "the cold /land page claims a fit").toBe(null);
  expect(
    claimsOutOfContext(seen.text),
    "the cold /land page uses a permission word about something other than a licence, a permit, or a broker relationship",
  ).toEqual([]);
  expect(forbiddenIn(seen.attributes.join(" "), MARKET_CLAIMS), "a spoken attribute on cold /land reads as inventory").toBe(null);

  /* AND IT NAMES WHAT IT REFUSES. The narrowed list above is only defensible
     while these are on screen: a page that dropped both the word and the
     refusal would pass the scan by saying nothing at all. */
  for (const named of ["Live MLS not connected", "REALTOR.ca DDF®", "Aura holds no land inventory"]) {
    expect(seen.text, `the cold page stopped naming what it refuses: ${named}`).toContain(named);
  }

  /* "match" is a substring of the demonstration engine's own verdict labels
     ("Potential match"), which is precisely why they are behind the toggle: the
     word cannot reach a reader who has not asked for the fixture. */
  expect(seen.text.toLowerCase(), "a fit verdict reached the cold page").not.toContain("potential match");
});

test("the page keeps the elements the other gates name", () => {
  /* These are the strings other suites assert against, listed here so a rewrite
     of this page fails in this file — where the cause is obvious — rather than
     in a served UI run on another machine.

     `<ZoningLookup requirements={requirements} />` is byte-identical on purpose:
     `land-ui.spec.ts:323` matches that literal, single prop and all, and the
     surfaces underneath it reach the project through React context rather than
     through props on this element. */
  const page = source();
  for (const literal of [
    'import ZoningLookup from "@/components/land/ZoningLookup"',
    "<ZoningLookup requirements={requirements} />",
    '"Demonstration records"',
    "Find land for the home you actually designed",
    "Live MLS not connected",
    DEMO_BADGE,
    "Floor area · sqft",
    "Footprint · sqft",
    "Max height · ft",
    "Save demo comparison",
    /* The map's own aria-label lives in LandMap.tsx; what this page owes is the
       mount, which is what the served gate clicks through to. */
    "<LandMap results={results} onSelect={selectFromMap} />",
    "useThisPlot",
    "withProjectSite",
    "toggleShortlist",
    "LAND_LISTING_PROVIDERS",
  ]) {
    expect(page, `/land dropped ${literal}`).toContain(literal);
  }

  /* Detector: the loop above is a `toContain` over one file and would pass
     silently if `source()` ever started returning something else. */
  expect(page, "the page source was not read").not.toContain("this string is not in page.tsx");

  /* The default is the whole point of the toggle. `useState(false)` in the
     source is a weaker statement than the rendered absence above, and it is
     here because it names the line to look at when that test goes red. */
  expect(page, "demoMode must default to false").toContain("const [demoMode, setDemoMode] = useState(false)");
});
