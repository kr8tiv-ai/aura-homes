/* B-P1 — "Use this plot" on /land.
 *
 * The action has two halves and this spec pins both: the arithmetic that
 * turns a listing into a site (components/land/plotSite.ts), and the write
 * that puts that site under the project's design (lib/project/document.ts).
 * Neither needs a browser, so this runs in the same server-free way the rest
 * of `npm test` does — the rendered flow is proved separately, by
 * scripts/site-proof.mjs, against the built export.
 *
 * The assertion that matters most is the one in the first test: the derived
 * parcel's BUILDABLE ENVELOPE must come back byte-for-byte equal to the
 * envelope the listing evidenced. Any invented setback — one foot, five,
 * a plausible-looking twenty-five — shrinks it and fails, which is exactly
 * the failure this rule exists to cause.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * LAND02 — the zoning lookup, added below the original five tests.
 *
 * LAND01 shipped 156 real City of Edmonton districts and guarded them at the
 * DATA layer: tests/land-data.spec.ts reads the baked artifact, the evidence
 * labels and the engine's findings. Its verifier found the gap — the
 * forbidden-vocabulary guard covered the artifact and not the rendered page,
 * and the rendered page is the only surface a person ever sees.
 *
 * So these tests render `components/land/ZoningLookup.tsx` — the real
 * component /land mounts, over the real baked data — into a real DOM and read
 * it back the way a browser would. `renderToStaticMarkup` plus `setContent`
 * rather than a served export, because this file lives in the deterministic
 * `npm test` gate and a component render is deterministic; the served page is
 * the UI gate's job.
 *
 * What is pinned, and why each one could go wrong quietly:
 *   - the market vocabulary, over rendered TEXT and over the attributes a
 *     screen reader speaks. Constraint data reading as inventory is the one
 *     failure this whole data layer exists to prevent;
 *   - the unanswered count, and that it comes BEFORE the one published figure
 *     in document order. Presence alone is satisfied by a footnote; the
 *     ordering is the actual honesty rule;
 *   - two verdicts, never a match;
 *   - every stated figure carrying the link it came from, checked over all
 *     156 districts in the pure path and again in the DOM, because a component
 *     that forgets to render the link it was handed passes the pure check;
 *   - a not-in-force overlay saying so in its own row.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PLOT_SETBACK_NOTE, isPlotOnSite, siteFromListing } from "@/components/land/plotSite";
import ZoningLookup, {
  ZONING_DEFAULT_CODE,
  ZONING_VERDICT_COPY,
  districtFigures,
  districtSection,
  overlayInForce,
  overlayStatusText,
  reasonForFinding,
} from "@/components/land/ZoningLookup";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { validateBuilderSite } from "@/lib/builder/site";
import { buildableEnvelope } from "@/lib/design/parcel";
import { DEMO_LAND_LISTINGS, type LandDesignRequirements } from "@/lib/marketplace/discovery";
import {
  CITY_ZONING_MAP_URL,
  EDMONTON_CONSTRAINT_SET,
  EDMONTON_DISTRICTS,
  EDMONTON_OVERLAYS,
  LAND_CONSTRAINT_BOUNDARY,
  evaluateEdmontonDistrict,
  findEdmontonDistrict,
} from "@/lib/marketplace/landData";
import {
  createAuraProject,
  validateAuraProject,
  withProjectSite,
} from "@/lib/project/document";

const AT = new Date("2026-08-14T12:00:00.000Z");

const listing = (id: string) => {
  const found = DEMO_LAND_LISTINGS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`The demonstration record ${id} is gone; this spec is measuring nothing.`);
  return found;
};

const aspen = () => listing("lsa-aspen-road");
const lakeside = () => listing("lsa-lakeside-estates");

const project = () =>
  createAuraProject({
    id: "plot-spec",
    name: "Plot spec",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now: AT,
  });

test("a listing's post-setback envelope becomes the lot, and the setbacks stay zero", () => {
  const record = aspen();
  const plot = siteFromListing(record);
  expect(plot).not.toBeNull();

  // Read from the record rather than retyped, so a fixture change moves both
  // sides of the comparison together instead of silently passing.
  const width = record.facts.buildableWidthFt.value;
  const depth = record.facts.buildableDepthFt.value;
  expect(plot!.parcel.lotWidthFt).toBe(width);
  expect(plot!.parcel.lotDepthFt).toBe(depth);

  expect(plot!.parcel.frontSetbackFt).toBe(0);
  expect(plot!.parcel.sideSetbackFt).toBe(0);
  expect(plot!.parcel.rearSetbackFt).toBe(0);

  /* The whole point of the zeroes: subtracting setbacks from this parcel
     leaves the evidenced envelope untouched. A listing states the land AFTER
     setbacks; taking them again would remove the same land twice. */
  const envelope = buildableEnvelope(plot!.parcel);
  expect(envelope.widthFt).toBe(width);
  expect(envelope.depthFt).toBe(depth);
  expect(envelope.usable).toBe(true);

  // Nothing the record does not carry is filled in with something plausible.
  expect(plot!.parcel.frontFaces).toBe("unknown");
  expect(plot!.parcel.slope).toBe("flat");
  expect(plot!.grade).toBe("flat");
  expect(plot!.provenance).toBe("listing-derived");

  // And the reader is told why, in the sentence the page prints verbatim.
  expect(PLOT_SETBACK_NOTE).toContain("setbacks as zero");
});

test("a record with no evidenced envelope produces no plot at all", () => {
  const blanks = DEMO_LAND_LISTINGS.filter(
    (record) =>
      record.facts.buildableWidthFt.value === null || record.facts.buildableDepthFt.value === null,
  );
  // If the demonstration set ever loses its unknown-evidence record, this
  // test is no longer exercising the refusal and should say so.
  expect(blanks.length).toBeGreaterThan(0);
  for (const record of blanks) expect(siteFromListing(record)).toBeNull();

  // Every record that DOES carry both dimensions produces a plot.
  const evidenced = DEMO_LAND_LISTINGS.filter((record) => !blanks.includes(record));
  for (const record of evidenced) expect(siteFromListing(record)).not.toBeNull();
});

test("the derived site is one the document layer will actually store", () => {
  const plot = siteFromListing(aspen());
  const checked = validateBuilderSite(plot);
  expect(checked.ok).toBe(true);
  expect(checked.ok && checked.site).toEqual(plot);
});

test("using a plot lands it on the project design, and dropping it restores the document", () => {
  const started = project();
  const before = started.design.documentHash;
  const plot = siteFromListing(lakeside())!;

  const withPlot = withProjectSite(started, plot, AT);
  expect(withPlot.design.document.site).toEqual(plot);
  expect(withPlot.design.documentHash).not.toBe(before);
  expect(validateAuraProject(withPlot).ok).toBe(true);

  /* A site is a design change, so the design step reopens exactly as any
     other edit would — the confirmation that came before it is stale. */
  expect(withPlot.stepStates.design.status).toBe("in-progress");

  // Removing the slot returns the document to what it was, hash included.
  const cleared = withProjectSite(withPlot, null, AT);
  expect(cleared.design.document.site).toBeUndefined();
  expect(cleared.design.documentHash).toBe(before);
});

test("the card knows whether the project is already standing on this plot", () => {
  const plot = siteFromListing(aspen())!;

  expect(isPlotOnSite(aspen(), null)).toBe(false);
  expect(isPlotOnSite(aspen(), plot)).toBe(true);
  // A different parcel is a different plot, even though both came from listings.
  expect(isPlotOnSite(lakeside(), plot)).toBe(false);

  /* Answering slope in the builder's Site step is the whole reason the Site
     step exists; it must not make the card forget which plot is underneath. */
  const answered = {
    ...plot,
    parcel: { ...plot.parcel, slope: "gentle" as const, frontFaces: "s" as const },
    grade: "plane" as const,
  };
  expect(isPlotOnSite(aspen(), answered)).toBe(true);

  // A hand-typed parcel that happens to match is not this listing's plot.
  expect(isPlotOnSite(aspen(), { ...plot, provenance: "manual" })).toBe(false);
});

/* ═════════════════════════════════════════════════════════════════════════
   LAND02 — the zoning lookup, as rendered
   ═════════════════════════════════════════════════════════════════════════ */

const DESIGN: LandDesignRequirements = {
  floorAreaSqft: 800,
  footprintSqft: 800,
  storeys: 1,
  maxHeightFt: 18,
  preferredWater: "cistern",
};

/** A design far taller than any Edmonton zone ceiling, so the published rule
 *  has something to refuse. 200 ft is above the tallest h modifier in the set. */
const TOO_TALL: LandDesignRequirements = { ...DESIGN, maxHeightFt: 200 };

/** A district that publishes NO height at all — the 0-of-7 state, which is
 *  the majority state and the one a demo would be tempted to hide. */
const SILENT_CODE = "RS";
/** A district whose rules the City writes per site, so there is no single
 *  bylaw section to link and the surface has to say why. */
const SITE_SPECIFIC_CODE = "DC2";

const markup = (requirements: LandDesignRequirements, initialCode?: string) =>
  renderToStaticMarkup(createElement(ZoningLookup, { requirements, initialCode }));

/** The rendered surface, read the way a browser presents it. `textContent`
 *  rather than `innerText` on purpose: it also catches text a stylesheet has
 *  hidden, which is exactly where a forbidden word would survive a review. */
async function readRendered(
  page: import("playwright/test").Page,
  requirements: LandDesignRequirements,
  initialCode?: string,
) {
  await page.setContent(markup(requirements, initialCode));
  return page.evaluate(() => {
    const spoken = ["aria-label", "title", "alt", "placeholder"];
    return {
      text: document.body.textContent ?? "",
      /* Attribute text is read aloud and never appears in textContent, so a
         market word could hide there indefinitely. */
      attributes: Array.from(document.querySelectorAll("*")).flatMap((element) =>
        spoken
          .map((name) => element.getAttribute(name))
          .filter((value): value is string => Boolean(value)),
      ),
      figures: Array.from(document.querySelectorAll(".zoning-figure")).map((element) => ({
        text: element.textContent ?? "",
        href: element.querySelector("a")?.getAttribute("href") ?? null,
      })),
      overlays: Array.from(document.querySelectorAll(".zoning-overlay")).map((element) => ({
        text: element.textContent ?? "",
        dead: element.classList.contains("zoning-overlay-dead"),
      })),
      links: Array.from(document.querySelectorAll("a")).map((element) => element.getAttribute("href") ?? ""),
    };
  });
}

/* The seven words LAND01 pinned over the baked artifact. They are repeated
   here rather than shared, because the two files guard different surfaces and
   this one must keep working if the other is ever narrowed. */
const MARKET_VOCABULARY = ["for sale", "listing", "listed", "available", "asking price", "realtor", "mls"];

/* A district answers one question out of seven. Any of these words on this
   surface would turn "we did not refuse you" into "this land works", which is
   the exact claim the two-verdict rule exists to forbid. "qualified" is NOT on
   the list and must not be: the engine's own unknown-evidence sentence tells a
   reader to confirm the fact with a qualified site professional, which is the
   opposite of a match claim. */
const MATCH_VOCABULARY = ["match", "suitable", "approved", "eligible", "guaranteed"];

const forbiddenIn = (text: string, words: string[]): string | null => {
  const haystack = text.toLowerCase();
  return words.find((word) => haystack.includes(word)) ?? null;
};

test("the unanswered count outranks the published figure at every width, measured", async ({ page }) => {
  /* THE HIERARCHY WAS A CLAIM IN A COMMENT AND NOTHING MEASURED IT, so it was
     wrong. This panel's whole honesty rests on the unanswered count leading:
     a district publishes one fact out of seven, and letting the one it does
     publish dominate would misrepresent the data.

     `.zoning-ratio-big` was clamp(1.1rem, 3vw, 1.4rem) and `.zoning-figure-value`
     a flat 1.15rem. On any phone 3vw falls under 12px, so the clamp resolved to
     its 1.1rem floor — 17.6px against the figure's 18.4px. The hierarchy was
     inverted on every handset while the CSS comment above it said otherwise.
     A fresh-context review measured it in a real engine and caught it.

     So this asserts the property in a real layout engine at real widths rather
     than asserting the stylesheet contains a particular string. */
  const css = readFileSync(path.join(path.resolve(__dirname, ".."), "app/globals.css"), "utf8");

  for (const width of [390, 480, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(markup(DESIGN));
    await page.addStyleTag({ content: css });

    const sizes = await page.evaluate(() => {
      const px = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? Number.parseFloat(getComputedStyle(element).fontSize) : null;
      };
      return { ratio: px(".zoning-ratio-big"), figure: px(".zoning-figure-value") };
    });

    /* Both must exist, or the comparison below is vacuously true — which is
       precisely how a hierarchy assertion goes quiet after a rename. */
    expect(sizes.ratio, `.zoning-ratio-big missing at ${width}px`).not.toBeNull();
    expect(sizes.figure, `.zoning-figure-value missing at ${width}px`).not.toBeNull();
    expect(
      `${width}px: count ${sizes.ratio}px vs figure ${sizes.figure}px`,
      "the unanswered count must be the larger type — a district that publishes one fact of seven must not lead with the one",
    ).toBe(`${width}px: count ${sizes.ratio}px vs figure ${sizes.figure}px`.replace(/$/, ""));
    expect(sizes.ratio! > sizes.figure!, `at ${width}px the published figure (${sizes.figure}px) is at least as large as the unanswered count (${sizes.ratio}px)`).toBe(true);
  }
});

test("the zoning lookup is mounted on /land, with the page's own design requirements", () => {
  /* Everything below renders the component directly. If /land ever stops
     rendering it, every one of those assertions still passes over a component
     nobody can see — so the wiring is checked as its own fact. */
  const page = readFileSync(path.resolve(__dirname, "..", "app", "land", "page.tsx"), "utf8");
  expect(page).toContain('import ZoningLookup from "@/components/land/ZoningLookup"');
  expect(page).toContain("<ZoningLookup requirements={requirements} />");

  /* And it sits ABOVE the four fictionalized cards. Real published data
     appearing after a demonstration fixture is a hierarchy that says the
     fixture is the main event. */
  expect(page.indexOf("<ZoningLookup")).toBeLessThan(page.indexOf('"Demonstration records"'));
});

test("the rendered zoning surface never reads as inventory", async ({ page }) => {
  /* THE DETECTOR FIRST. A vocabulary check that has stopped matching anything
     is indistinguishable from a clean page. */
  expect(forbiddenIn("this parcel is listed for sale", MARKET_VOCABULARY)).toBe("for sale");
  expect(forbiddenIn("zoning district RM h16", MARKET_VOCABULARY)).toBe(null);

  /* Four renders, because the branches say different things: the default
     district, the same district refusing a design, a district that publishes
     nothing, and a district with no single bylaw section. */
  for (const [label, requirements, code] of [
    ["default", DESIGN, undefined],
    ["refusing", TOO_TALL, undefined],
    ["publishes nothing", DESIGN, SILENT_CODE],
    ["site-specific", DESIGN, SITE_SPECIFIC_CODE],
  ] as Array<[string, LandDesignRequirements, string | undefined]>) {
    const rendered = await readRendered(page, requirements, code);
    expect(rendered.text.length, `${label} rendered nothing`).toBeGreaterThan(1000);
    expect(forbiddenIn(rendered.text, MARKET_VOCABULARY), `${label} rendered text`).toBe(null);
    expect(forbiddenIn(rendered.text, MATCH_VOCABULARY), `${label} rendered text`).toBe(null);
    for (const attribute of rendered.attributes) {
      expect(forbiddenIn(attribute, MARKET_VOCABULARY), `${label} attribute "${attribute}"`).toBe(null);
    }

    /* The boundary sentence is printed verbatim rather than paraphrased — the
       data module exports it as a constant for exactly this reason. */
    expect(rendered.text, `${label} boundary`).toContain(LAND_CONSTRAINT_BOUNDARY);
  }
});

test("a district shows what it cannot answer before what it can, and never as a match", async ({ page }) => {
  const district = findEdmontonDistrict(ZONING_DEFAULT_CODE);
  expect(district, `${ZONING_DEFAULT_CODE} must still be in the baked set`).toBeTruthy();
  if (!district) return;
  expect(district.maxHeightM, "the default district must publish a ceiling, or it demonstrates nothing").toBe(16);

  const check = evaluateEdmontonDistrict(district, DESIGN);
  expect(check.verdict).toBe("parcel-evidence-required");
  expect(check.evidenced).toBe(1);
  expect(check.outstanding).toBe(6);

  const rendered = await readRendered(page, DESIGN);
  const unanswered = `${check.outstanding} of ${check.findings.length} questions unanswered`;
  expect(rendered.text).toContain(unanswered);

  /* THE ORDERING IS THE RULE. Presence alone is satisfied by a footnote under
     a big green tick; this fails if the published ceiling is ever moved above
     the count of what is still open. */
  const published = "16.0 m · 52.5 ft";
  expect(rendered.text).toContain(published);
  expect(
    rendered.text.indexOf(unanswered),
    "the unanswered count must come before the one published figure",
  ).toBeLessThan(rendered.text.indexOf(published));

  /* Two verdicts exist and there is no third. A district can never come back
     as a match, so the copy for both is read for the words that would imply
     one. */
  expect(Object.keys(ZONING_VERDICT_COPY).sort()).toEqual([
    "district-rule-blocks",
    "parcel-evidence-required",
  ]);
  for (const [verdict, copy] of Object.entries(ZONING_VERDICT_COPY)) {
    expect(forbiddenIn(`${copy.title} ${copy.body}`, MATCH_VOCABULARY), `${verdict} copy`).toBe(null);
  }
  expect(rendered.text).toContain(ZONING_VERDICT_COPY["parcel-evidence-required"].title);

  /* A district that publishes nothing renders 7 of 7 and says so, rather than
     rendering an empty panel that reads as a page still loading. */
  const silent = findEdmontonDistrict(SILENT_CODE);
  expect(silent?.maxHeightM, `${SILENT_CODE} is the no-ceiling case`).toBe(null);
  const nothing = await readRendered(page, DESIGN, SILENT_CODE);
  expect(nothing.text).toContain("7 of 7 questions unanswered");
  expect(nothing.text).toContain("This district publishes none of them");
});

test("a published ceiling produces a citable refusal on screen", async ({ page }) => {
  const district = findEdmontonDistrict(ZONING_DEFAULT_CODE)!;
  const check = evaluateEdmontonDistrict(district, TOO_TALL);
  expect(check.verdict).toBe("district-rule-blocks");

  const rendered = await readRendered(page, TOO_TALL);
  expect(rendered.text).toContain(ZONING_VERDICT_COPY["district-rule-blocks"].title);
  // The refusal states both numbers, so a reader can check the arithmetic.
  expect(rendered.text).toContain("200.0 ft exceeds the evidenced 52.5 ft limit.");
  // And the section it came from is on the page, not implied.
  expect(rendered.links).toContain(district.bylawUrl);

  /* THE HONEST LIMIT OF THIS FEATURE. Height is the ONLY rule these 156
     districts can refuse on: minimum Site area lives in Bylaw 20001's text
     rather than in any open dataset, so it is `unknown` everywhere and can
     never block. If a future extract changes that, this assertion goes red and
     the copy claiming height is the only refusal has to be rewritten with it. */
  const everyBlock: string[] = [];
  for (const candidate of EDMONTON_DISTRICTS) {
    for (const finding of evaluateEdmontonDistrict(candidate, TOO_TALL).findings) {
      if (finding.severity === "block" && !everyBlock.includes(finding.id)) everyBlock.push(finding.id);
    }
  }
  expect(everyBlock).toEqual(["height"]);
});

test("every figure this surface states carries the authority link it came from", async ({ page }) => {
  /* The pure half, over all 156 districts. `sourceHref` is non-nullable by
     type, so this is checking that it is a real authority URL rather than an
     empty string standing in for one. */
  expect(EDMONTON_DISTRICTS.length).toBeGreaterThan(100);
  for (const district of EDMONTON_DISTRICTS) {
    const figures = districtFigures(district);
    expect(figures.length, `${district.code} states no figures at all`).toBeGreaterThan(0);
    for (const figure of figures) {
      expect(figure.value.length, `${district.code} ${figure.id} value`).toBeGreaterThan(0);
      expect(figure.sourceHref, `${district.code} ${figure.id} source`).toMatch(/^https:\/\//);
      expect(figure.sourceLabel.length, `${district.code} ${figure.id} source label`).toBeGreaterThan(8);
    }
    // A district with a ceiling always names its own section or the section
    // that publishes the modifier convention — never nothing.
    if (district.maxHeightM !== null) {
      expect(figures.some((figure) => figure.id === "height"), `${district.code} height figure`).toBe(true);
    }
    // Where there is no single section, the reader is told which situation
    // this is rather than handed a blank.
    const section = districtSection(district);
    expect(section.href, `${district.code} section href`).toMatch(/^https:\/\//);
    if (district.bylawUrl === null) {
      expect(section.href).toBe(CITY_ZONING_MAP_URL);
      expect(section.note?.length ?? 0, `${district.code} missing-section reason`).toBeGreaterThan(30);
    } else {
      expect(section.note, `${district.code} needs no excuse`).toBe(null);
    }
  }

  /* The rendered half. A component that is handed a source and forgets to
     print it passes every assertion above. */
  const rendered = await readRendered(page, DESIGN);
  expect(rendered.figures.length).toBeGreaterThan(4);
  for (const figure of rendered.figures) {
    expect(figure.href, `figure "${figure.text.slice(0, 40)}" has no source link`).toMatch(/^https:\/\//);
  }

  /* Geometry is the one thing this data cannot do, so the City's own map is
     linked and the reason is on screen in the artifact's own words. */
  expect(rendered.links).toContain(CITY_ZONING_MAP_URL);
  for (const line of EDMONTON_CONSTRAINT_SET.whatThisCannotAnswer) {
    expect(rendered.text, "the artifact's own limits must be printed, not summarised").toContain(line);
  }
});

test("every question a district leaves open carries the reason it is open", () => {
  /* A blank cell reads as an error state or a bug. The data module already
     wrote the reason for each unknown — "this is in bylaw text, not an open
     dataset" is a different fact from "this is a parcel fact" — and the
     surface has to carry it. The map from finding id to fact lives in the
     component, so a finding the engine adds and the component has never seen
     comes back null here rather than silently rendering nothing. */
  let openQuestions = 0;
  for (const district of EDMONTON_DISTRICTS) {
    for (const finding of evaluateEdmontonDistrict(district, DESIGN).findings) {
      if (finding.severity !== "check") continue;
      openQuestions += 1;
      const reason = reasonForFinding(district, finding);
      expect(reason, `${district.code} ${finding.id} has no stated reason`).toBeTruthy();
      expect((reason ?? "").length, `${district.code} ${finding.id} reason is too short`).toBeGreaterThan(20);
    }
  }
  // Six open questions on every one of 156 districts, at least.
  expect(openQuestions).toBeGreaterThanOrEqual(EDMONTON_DISTRICTS.length * 6);
});

test("a not-in-force overlay says so in its own row", async ({ page }) => {
  /* The artifact records `bylawInForce` on every overlay; the exported
     `EdmontonZoningOverlay` interface does not declare it, and that module is
     outside this node's write set. So the component reads it through a runtime
     guard, and this is the assertion that stops the guard from becoming a
     silent shrug: if the field disappears from the artifact, `overlayInForce`
     starts returning null everywhere and this goes red. */
  for (const overlay of EDMONTON_OVERLAYS) {
    expect(overlayInForce(overlay), `${overlay.code} in-force flag`).not.toBe(null);
    expect(overlayStatusText(overlay), `${overlay.code} status`).toContain("Bylaw");
  }

  const dead = EDMONTON_OVERLAYS.filter((overlay) => overlayInForce(overlay) === false);
  expect(dead.length, "the repealed-overlay case must still exist to be guarded").toBeGreaterThan(0);

  const rendered = await readRendered(page, DESIGN);
  expect(rendered.overlays.length).toBe(EDMONTON_OVERLAYS.length);
  expect(rendered.overlays.filter((overlay) => overlay.dead).length).toBe(dead.length);
  for (const overlay of rendered.overlays) {
    expect(overlay.text, "an overlay row without its status is an overstatement").toMatch(
      overlay.dead ? /Not in force · Bylaw \d+/ : /In force · Bylaw \d+/,
    );
  }
  // And the count is stated in prose, with the repealed bylaw named.
  expect(rendered.text).toContain(`${dead.length} of the ${EDMONTON_OVERLAYS.length} records are recorded as not in force`);
  expect(rendered.text).toContain("repealed Zoning Bylaw 12800");
});

test("the zoning surface does not overflow a 390 px phone", async ({ page }) => {
  /* marketplace-ui.spec.ts asserts the WHOLE of /land has no horizontal
     overflow at 390 px, and it runs in the UI gate against a served export —
     which means a section added here breaks it in a different suite, on a
     different machine, minutes later, with a failure that names the page and
     not the cause. So the new surface is measured on its own, in a real
     browser, against the real stylesheet, here where it was written.

     Every grid track in the .zoning-* block is minmax(min(…), 1fr) for exactly
     this reason; one fixed min-width would take the whole page with it. */
  const css = readFileSync(path.resolve(__dirname, "..", "app", "globals.css"), "utf8");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(markup(DESIGN));
  await page.addStyleTag({ content: css });

  const measure = () =>
    page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));

  const fits = await measure();
  expect(fits.client, "the viewport did not actually narrow").toBeLessThanOrEqual(390);
  expect(fits.scroll, "the zoning surface pushes /land sideways on a phone").toBe(fits.client);

  /* THE DETECTOR. A width comparison that cannot go red would pass on a page
     with no stylesheet attached at all, so one is forced wide and the
     measurement has to notice. */
  await page.addStyleTag({ content: ".zoning-title { min-width: 900px; }" });
  const forced = await measure();
  expect(forced.scroll, "the overflow check cannot fail and is therefore decoration").toBeGreaterThan(
    forced.client,
  );
});
