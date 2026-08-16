/* THE LOT SOMEBODY ALREADY HAS — /land's third path, proved.
 *
 * /land could take a fictional plot and could read a real district, and it
 * could not take a real lot. The district refuses to guess one — all 156 record
 * the buildable width and depth as `unknown`, and `siteFromListing` refuses on
 * exactly that — so the only honest way past the refusal is for the person to
 * state the lot. This spec pins what that is allowed to mean.
 *
 * The load-bearing assertions, and why each one could go quiet:
 *
 *   · THE ROUND TRIP, as a pure function. Stated lot in, a `BuilderSite` the
 *     document layer actually stores out, the project hash moves, the design
 *     step reopens, and removing it restores the hash byte-for-byte. Same shape
 *     as land-ui.spec.ts:158, because it is the same write.
 *
 *   · DECLARED IS NOT VERIFIED, measured by points rather than asserted by
 *     name. A declared envelope that fits scores 10 of 20 and comes back
 *     "check"; the same envelope marked `verified` scores 20 and comes back
 *     "pass". The spec renders BOTH, so the 10 is proof of the status rather
 *     than a number copied out of the engine.
 *
 *   · THE TWO CONVENTIONS STAY APART. A listing publishes a POST-setback
 *     rectangle and stores zeroes; a stated lot is the WHOLE lot and its
 *     setbacks are taken off it. Each half is asserted against the other, so
 *     adopting one convention in the other's place fails here rather than
 *     silently taking the same land off twice.
 *
 *   · A REFUSAL NAMES THE DIMENSION AND THE FEET. The engine's own refusal
 *     states an area shortfall, which nobody can act on. This one is read for
 *     the specific numbers, in both directions.
 *
 * Every vocabulary and absence check proves its own detector first: a scan that
 * has stopped matching anything is indistinguishable from a clean page.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { expect, test } from "playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import StatedLotPanel, {
  INCOMPLETE_NOTE,
  NOTHING_STATED_NOTE,
  NOTHING_WRITTEN_NOTE,
  NO_PROJECT_NOTE,
  SAVED_NOTE,
  STATED_LOT_SCOPE_NOTE,
  commitRefusal,
  commitState,
} from "@/components/land/StatedLotPanel";
import { PLOT_SETBACK_NOTE, isPlotOnSite, siteFromListing } from "@/components/land/plotSite";
import {
  DERIVED_DEPTH_NOTE,
  EMPTY_UNTIL_STATED_NOTE,
  INITIAL_STATED_LOT,
  PROPERTY_REGISTER_BOUNDARY,
  REGISTER_NO_ROW_NOTE,
  SLOPE_DEFAULT_NOTE,
  STATED_LOT_PROVENANCE,
  STATED_LOT_SETBACK_NOTE,
  STATED_LOT_WHOLE_LOT_NOTE,
  depthFromAreaAndFrontage,
  envelopeFinding,
  evaluateDistrictAgainstStatedLot,
  resolveStatedLot,
  statedLotErrors,
  statedLotRefusal,
  statedLotSite,
  statedNothingYet,
  type StatedLotForm,
} from "@/components/land/statedLot";
import { INITIAL_PARCEL } from "@/components/design/ParcelPanel";
import { defaultBuilderDocument } from "@/lib/builder/document";
import {
  provenanceForBuilderEdit,
  siteProvenanceNote,
  validateBuilderSite,
  type BuilderSite,
} from "@/lib/builder/site";
import { buildableEnvelope } from "@/lib/design/parcel";
import {
  DEMO_LAND_LISTINGS,
  evaluateLandFacts,
  type EvidenceFact,
  type LandDesignRequirements,
  type LandDiscoveryListing,
} from "@/lib/marketplace/discovery";
import {
  EDMONTON_DISTRICTS,
  districtConstraintFacts,
  evaluateEdmontonDistrict,
  findEdmontonDistrict,
} from "@/lib/marketplace/landData";
import { createAuraProject, validateAuraProject, withProjectSite } from "@/lib/project/document";

const AT = new Date("2026-08-15T12:00:00.000Z");
const STATED_AT = AT.toISOString();

const DESIGN: LandDesignRequirements = {
  floorAreaSqft: 800,
  footprintSqft: 800,
  storeys: 1,
  maxHeightFt: 18,
  preferredWater: "cistern",
};

const DISTRICT_CODE = "RM h16";
const district = () => {
  const found = findEdmontonDistrict(DISTRICT_CODE);
  if (!found) throw new Error(`${DISTRICT_CODE} is gone from the baked set; this spec measures nothing.`);
  return found;
};

const aspen = () => {
  const found = DEMO_LAND_LISTINGS.find((record) => record.id === "lsa-aspen-road");
  if (!found) throw new Error("The demonstration record lsa-aspen-road is gone.");
  return found;
};

const project = () =>
  createAuraProject({
    id: "stated-lot-spec",
    name: "Stated lot spec",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now: AT,
  });

/* ------------------------------------------------------------- the fixtures */

/** A real Edmonton-shaped lot: 60 ft frontage, 120 ft deep, ordinary setbacks.
 *  Envelope 50 × 80 = 4,000 sq ft, which takes an 800 sq ft footprint. */
const GOOD: StatedLotForm = {
  ...INITIAL_STATED_LOT,
  lotWidth: "60",
  lotDepth: "120",
  front: "20",
  side: "5",
  rear: "20",
  frontFaces: "s",
  slope: "gentle",
};

/** The same lot stated as an AREA plus a frontage: 7,200 ÷ 60 = 120. */
const DERIVED: StatedLotForm = { ...GOOD, lotDepth: "", lotAreaSqFt: "7200", depthSource: "derived" };

/** Envelope 20 × 20 = 400 sq ft against an 800 sq ft footprint. */
const TIGHT: StatedLotForm = {
  ...INITIAL_STATED_LOT,
  lotWidth: "30",
  lotDepth: "40",
  front: "10",
  side: "5",
  rear: "10",
};

/** Setbacks larger than the lot: -10 ft in both directions. */
const EATEN: StatedLotForm = { ...TIGHT, front: "25", side: "20", rear: "25" };

/** Half-typed, which is a normal state in a form and must not be committable. */
const INCOMPLETE: StatedLotForm = { ...GOOD, lotWidth: "" };

const parcelOf = (form: StatedLotForm) => {
  const parcel = statedLotSite(resolveStatedLot(form).form).parcel;
  if (!parcel) throw new Error("statedLotSite returned no parcel.");
  return parcel;
};

/* --------------------------------------------------------------- rendering */

/** No `form` renders the panel EXACTLY as ZoningLookup mounts it — no
 *  `initialForm` prop at all — which is the only render that can answer what a
 *  reader meets before they have typed anything. */
const markup = (form?: StatedLotForm, requirements: LandDesignRequirements = DESIGN) =>
  renderToStaticMarkup(
    createElement(StatedLotPanel, {
      district: district(),
      requirements,
      ...(form ? { initialForm: form } : {}),
    }),
  );

async function readRendered(
  page: import("playwright/test").Page,
  form?: StatedLotForm,
  requirements: LandDesignRequirements = DESIGN,
) {
  await page.setContent(markup(form, requirements));
  return page.evaluate(() => {
    const spoken = ["aria-label", "title", "alt", "placeholder"];
    const button = Array.from(document.querySelectorAll("button")).find((element) =>
      (element.textContent ?? "").includes("Use this lot in my design"),
    );
    return {
      text: document.body.textContent ?? "",
      attributes: Array.from(document.querySelectorAll("*")).flatMap((element) =>
        spoken
          .map((name) => element.getAttribute(name))
          .filter((value): value is string => Boolean(value)),
      ),
      /* Every figure the form is carrying, read off the controls rather than
         out of the prose — a prefilled lot shows up here even if nothing on the
         page says it out loud. */
      numberValues: Array.from(document.querySelectorAll('input[type="number"]')).map(
        (element) => element.getAttribute("value") ?? "",
      ),
      hasButton: Boolean(button),
      buttonDisabled: button ? (button as HTMLButtonElement).disabled : null,
    };
  });
}

const MARKET_VOCABULARY = ["for sale", "listing", "listed", "available", "asking price", "realtor", "mls"];
const MATCH_VOCABULARY = ["match", "suitable", "approved", "eligible", "guaranteed"];

const forbiddenIn = (text: string, words: string[]): string | null => {
  const haystack = text.toLowerCase();
  return words.find((word) => haystack.includes(word)) ?? null;
};

/* ═══════════════════════════════════════════════════════════ the round trip */

test("a stated lot becomes a site the document layer stores, and removing it restores the document", () => {
  const site = statedLotSite(resolveStatedLot(GOOD).form);

  /* Exactly what was typed, in the seven fields ParcelFacts has. Nothing is
     rounded, defaulted, or filled in on the reader's behalf. */
  expect(site.parcel).toEqual({
    lotWidthFt: 60,
    lotDepthFt: 120,
    frontSetbackFt: 20,
    sideSetbackFt: 5,
    rearSetbackFt: 20,
    frontFaces: "s",
    slope: "gentle",
  });
  expect(site.grade).toBe("plane");

  const checked = validateBuilderSite(site);
  expect(checked.ok).toBe(true);
  expect(checked.ok && checked.site).toEqual(site);

  const started = project();
  const before = started.design.documentHash;
  const withLot = withProjectSite(started, site, AT);

  expect(withLot.design.document.site).toEqual(site);
  expect(withLot.design.documentHash).not.toBe(before);
  expect(validateAuraProject(withLot).ok).toBe(true);

  /* Attaching land is a design change, so the design step reopens exactly as
     any other edit would — which is why this panel commits on a button rather
     than on a keystroke. */
  expect(withLot.stepStates.design.status).toBe("in-progress");

  const cleared = withProjectSite(withLot, null, AT);
  expect(cleared.design.document.site).toBeUndefined();
  expect(cleared.design.documentHash).toBe(before);
});

test("a half-typed lot is refused, and every refusal names the field and its bounds", () => {
  const problems = statedLotErrors(resolveStatedLot(INCOMPLETE).form);
  expect(problems.length).toBeGreaterThan(0);
  expect(problems.join(" ")).toContain("Lot width along the front must be a number of feet from 10 to 5,280.");

  /* THE DETECTOR. A complete lot must produce none, or the check above is
     satisfied by a function that always complains. */
  expect(statedLotErrors(resolveStatedLot(GOOD).form)).toEqual([]);

  /* The bounds and their wording come from ParcelPanel, shared rather than
     retyped, so /design, the builder's Site step and /land cannot drift. */
  expect(statedLotErrors({ ...GOOD, side: "-1" }).join(" ")).toContain(
    "Side setback must be a number of feet from 0 to 1,000.",
  );
});

/* ══════════════════════════════════════════════ the two setback conventions */

test("a stated lot is the whole lot, and its setbacks come off it", () => {
  const parcel = parcelOf(GOOD);
  const envelope = buildableEnvelope(parcel);

  expect(envelope.widthFt).toBe(50); // 60 − 2 × 5
  expect(envelope.depthFt).toBe(80); // 120 − 20 − 20
  expect(envelope.usable).toBe(true);

  /* THE ASSERTION THAT COULD GO QUIET. If this path ever adopted the listing
     convention and stored zeroes, the envelope would come back equal to the
     lot and this comparison is what notices. */
  expect(envelope.widthFt).not.toBe(parcel.lotWidthFt);
  expect(envelope.depthFt).not.toBe(parcel.lotDepthFt);

  /* And the listing convention is untouched and still the opposite: its
     rectangle is already post-setback, so its setbacks stay zero and its
     envelope equals its lot. Both rules asserted in one place, because the
     failure mode is applying one of them in the other's situation. */
  const plot = siteFromListing(aspen());
  expect(plot).not.toBeNull();
  expect(plot!.parcel.frontSetbackFt).toBe(0);
  expect(buildableEnvelope(plot!.parcel).widthFt).toBe(plot!.parcel.lotWidthFt);
});

test("provenance keeps a stated lot and a picked plot apart in the stored document", () => {
  const site = statedLotSite(resolveStatedLot(GOOD).form);
  const plot = siteFromListing(aspen())!;

  /* THREE ORIGINS, THREE WORDS. A lot stated on /land, a plot carried over
     from a demonstration record, and a parcel typed into the builder's own Site
     step must not come out of the document under the same label — a record that
     cannot tell them apart cannot support the sentence /land stores beside this
     one, which says the project owner stated their own lot. */
  expect(STATED_LOT_PROVENANCE).toBe("owner-stated");
  expect(site.provenance).toBe("owner-stated");
  expect(plot.provenance).toBe("listing-derived");
  expect(site.provenance).not.toBe(plot.provenance);
  expect(site.provenance).not.toBe("manual");

  // A card must not light up because somebody typed the same two numbers.
  const twin = { ...site, parcel: { ...plot.parcel } };
  expect(isPlotOnSite(aspen(), twin)).toBe(false);
  expect(isPlotOnSite(aspen(), site)).toBe(false);
  // THE DETECTOR: the real plot still reports itself.
  expect(isPlotOnSite(aspen(), plot)).toBe(true);

  /* THE FOURTH ORIGIN, probed rather than assumed. `register-derived` — a lot
     whose AREA came from a municipal register with a stated frontage — needs
     `BuilderSiteProvenance` to gain the value and the live lookup to exist,
     neither of which is true in this checkout. This branch asserts the current
     refusal AND the behaviour required the moment it lands, so the spec stays
     green through that change instead of going red in a way somebody would
     switch off. */
  const probe = validateBuilderSite({ ...site, provenance: "register-derived" });
  if (probe.ok) {
    expect(probe.site?.provenance).toBe("register-derived");
    expect(isPlotOnSite(aspen(), { ...plot, provenance: probe.site!.provenance })).toBe(false);
  } else {
    expect(probe.problem).toContain("provenance");
  }
});

/* ═════════════════════════ an old document still loads, and still says manual */

/** A site exactly as it was written to disk before `owner-stated` existed.
 *  Spelled out as a literal rather than built from any current constant, so a
 *  rename or a default change cannot quietly take this fixture with it. */
const LEGACY_MANUAL_SITE = {
  parcel: {
    lotWidthFt: 150,
    lotDepthFt: 290,
    frontSetbackFt: 25,
    sideSetbackFt: 10,
    rearSetbackFt: 25,
    frontFaces: "unknown",
    slope: "flat",
  },
  provenance: "manual",
  grade: "flat",
};

test("a document saved before owner-stated existed still loads, still validates, and is not relabelled", () => {
  const checked = validateBuilderSite(LEGACY_MANUAL_SITE);
  expect(checked.ok, checked.ok ? "" : `an old document was refused: ${checked.problem}`).toBe(true);
  expect(checked.ok && checked.site?.provenance).toBe("manual");
  /* Nothing is migrated on read. The value it was saved under is the value it
     comes back as, because rewriting it would be Aura deciding after the fact
     what somebody said. */
  expect(checked.ok && checked.site).toEqual(LEGACY_MANUAL_SITE);

  const carried = withProjectSite(project(), checked.ok ? checked.site! : null, AT);
  expect(validateAuraProject(carried).ok).toBe(true);
  expect(carried.design.document.site?.provenance).toBe("manual");

  /* THE DETECTOR. The check still refuses a word that is not one of the four,
     so "manual passes" is a fact about manual rather than about a check that
     stopped looking. */
  const bogus = validateBuilderSite({ ...LEGACY_MANUAL_SITE, provenance: "scraped" });
  expect(bogus.ok).toBe(false);
  expect(!bogus.ok && bogus.problem).toContain("provenance");
});

test("an origin survives only as long as the numbers it describes", () => {
  const stated = statedLotSite(resolveStatedLot(GOOD).form);
  const parcel = stated.parcel!;
  const edited = { ...parcel, lotWidthFt: 61 };

  /* Opening the builder's Site step on a lot stated on /land must not, by
     itself, relabel it as a parcel typed in the builder. This is the assertion
     that would notice the old ternary, which rewrote everything that was not
     `listing-derived` to `manual` the moment the step rendered. */
  expect(provenanceForBuilderEdit(stated, parcel)).toBe("owner-stated");
  // Retyping one of its numbers does relabel it, because now it is typed here.
  expect(provenanceForBuilderEdit(stated, edited)).toBe("manual");

  // Nothing stored yet, and a parcel typed here, are both `manual`.
  expect(provenanceForBuilderEdit(undefined, parcel)).toBe("manual");
  expect(provenanceForBuilderEdit({ ...stated, provenance: "manual" }, parcel)).toBe("manual");

  /* UNCHANGED ON PURPOSE: `listing-derived` stays sticky through an edit. It is
     not only an origin, it is the post-setback convention its stored zeroes are
     read under, and dropping it would take the same setbacks off twice. */
  const plot = siteFromListing(aspen())!;
  expect(provenanceForBuilderEdit(plot, { ...plot.parcel, lotWidthFt: 99 })).toBe("listing-derived");

  // And an imported outline keeps its origin while its numbers are untouched.
  const imported: BuilderSite = { ...stated, provenance: "geojson" };
  expect(provenanceForBuilderEdit(imported, parcel)).toBe("geojson");
  expect(provenanceForBuilderEdit(imported, edited)).toBe("manual");
});

test("the builder's Site step says which of the origins it is looking at", () => {
  const stated = siteProvenanceNote("owner-stated");
  const typed = siteProvenanceNote("manual");
  const plot = siteProvenanceNote("listing-derived");

  /* Four origins, four sentences: a reader cannot be told the same thing about
     a lot they stated and a rectangle somebody typed three steps into the
     builder. */
  const all = [stated, typed, plot, siteProvenanceNote("geojson")];
  expect(new Set(all).size, "two origins share a sentence").toBe(4);
  for (const sentence of all) expect(sentence.length).toBeGreaterThan(40);

  // The one that carries a claim about the reader names where they made it.
  expect(stated).toContain("land page");
  expect(stated).not.toContain("Aura looked nothing up");
  expect(stated).toContain("Aura filled none of them in");
  expect(stated).toContain("confirmed none of them");
  expect(typed).not.toContain("land page");
});

/* ═══════════════════════════════════ the form opens on nothing of Aura's */

test("the panel opens on nothing, and the commit control is out of reach until a lot is stated", async ({
  page,
}) => {
  /* THE DEFECT THIS PINS. The panel used to open on ParcelPanel's placeholder
     rectangle — 150 ft frontage, 290 ft deep, 25/10/25 setbacks — while telling
     the reader "every number below is one you type", print "checked against
     your numbers" over arithmetic done on numbers nobody typed, and enable the
     commit. One press stored Aura's rectangle under a label saying the project
     owner stated it. Rendered here EXACTLY as /land mounts it: no initialForm. */
  const untouched = await readRendered(page);

  expect(untouched.hasButton).toBe(true);
  expect(
    untouched.buttonDisabled,
    "the commit control is enabled on an untouched form, so one press stores a lot nobody stated",
  ).toBe(true);

  /* Every number control is empty. Read off the controls, so a prefill shows up
     here whether or not the prose mentions it. */
  expect(untouched.numberValues.length).toBeGreaterThan(4);
  expect(
    untouched.numberValues.filter((value) => value !== ""),
    "these fields opened with a figure the reader never stated",
  ).toEqual([]);

  // Nothing is presented as the reader's numbers, because there are none yet.
  expect(untouched.text).not.toContain("Checked against your numbers");
  expect(untouched.text).not.toContain("sq ft to place a home in");
  expect(untouched.text).toContain(NOTHING_STATED_NOTE);
  expect(untouched.text).toContain(EMPTY_UNTIL_STATED_NOTE);

  /* THE DETECTORS. A stated lot does fill those controls, does get checked, and
     does become committable — so the four assertions above are measuring the
     untouched state rather than a panel that renders nothing. */
  const good = await readRendered(page, GOOD);
  expect(good.numberValues).toContain("60");
  expect(good.numberValues).toContain("120");
  expect(good.text).toContain("Checked against your numbers");
  expect(good.text).toContain("sq ft to place a home in");
  expect(good.text).not.toContain(NOTHING_STATED_NOTE);
  expect(good.buttonDisabled).toBe(false);
});

test("ParcelPanel's placeholder rectangle is not reused on a panel that records who said it", async ({
  page,
}) => {
  const measured = ["lotWidth", "lotDepth", "front", "side", "rear"] as const;

  /* THE DETECTOR FIRST: /design really does open on those figures, so the
     comparison below is measuring a reuse that was possible. */
  expect(INITIAL_PARCEL).toMatchObject({
    lotWidth: "150",
    lotDepth: "290",
    front: "25",
    side: "10",
    rear: "25",
  });

  const reused = measured.filter((key) => INITIAL_STATED_LOT[key] === INITIAL_PARCEL[key]);
  expect(
    reused,
    `these placeholder figures are reused on a panel whose button stores "the project owner stated this lot": ${reused.join(", ")}`,
  ).toEqual([]);
  for (const key of measured) expect(INITIAL_STATED_LOT[key], key).toBe("");
  expect(INITIAL_STATED_LOT.lotAreaSqFt).toBe("");
  expect(statedNothingYet(INITIAL_STATED_LOT)).toBe(true);
  expect(statedNothingYet(GOOD)).toBe(false); // the detector for the line above
  expect(statedLotErrors(INITIAL_STATED_LOT)).toHaveLength(5);

  /* AND THE RULE IF ANYBODY BRINGS THEM BACK. ParcelPanel prints one sentence
     directly under those numbers, and it is the sentence that makes them
     honest there. Reusing the constants without it is what this branch
     forbids. */
  const placeholderSentence =
    "the numbers above are placeholders to type over, never a recommendation";
  /* Read through a whitespace collapse, because the sentence is wrapped across
     source lines and across rendered text nodes; comparing raw would answer
     "absent" for a formatting change and quietly stop measuring. */
  const flat = (text: string): string => text.replace(/\s+/g, " ");
  const parcelSource = readFileSync(
    path.resolve(__dirname, "..", "components", "design", "ParcelPanel.tsx"),
    "utf8",
  );
  expect(flat(parcelSource), "ParcelPanel's placeholder sentence has been reworded").toContain(
    placeholderSentence,
  );
  if (reused.length > 0) {
    const rendered = await readRendered(page);
    expect(
      flat(rendered.text),
      "ParcelPanel's placeholder figures are reused here without the sentence that labels them",
    ).toContain(placeholderSentence);
  }
});

test("the commit refuses an untouched form in words, not only by going grey", () => {
  /* The `disabled` attribute is one gate and it is a presentation detail. This
     is the other one: the same refusal in the commit path itself, where it
     cannot be styled away or lost to a future rewrite of the control. */
  expect(commitRefusal(INITIAL_STATED_LOT)).toBe(NOTHING_STATED_NOTE);
  expect(commitRefusal(INCOMPLETE)).toBe(INCOMPLETE_NOTE);

  // THE DETECTORS: a lot somebody actually stated is not refused.
  expect(commitRefusal(GOOD)).toBeNull();
  expect(commitRefusal(DERIVED)).toBeNull();

  /* A lot whose only stated figure is a setback is still not a lot — the
     refusal moves from "nothing stated" to "incomplete", it does not clear. */
  expect(commitRefusal({ ...INITIAL_STATED_LOT, front: "25" })).toBe(INCOMPLETE_NOTE);
});

/* ═════════════════════════════════════════════════════════════ the division */

test("a depth worked out from an area is arithmetic, and refuses rather than guessing", () => {
  expect(depthFromAreaAndFrontage(7200, 60)).toEqual({
    depthFt: 120,
    frontageFt: 60,
    fromAreaSqFt: 7200,
  });

  // Nothing divides by nothing, and nothing comes back NaN or Infinity.
  expect(depthFromAreaAndFrontage(7200, 0)).toBeNull();
  expect(depthFromAreaAndFrontage(0, 60)).toBeNull();
  expect(depthFromAreaAndFrontage(-7200, 60)).toBeNull();
  expect(depthFromAreaAndFrontage(Number.NaN, 60)).toBeNull();
  expect(depthFromAreaAndFrontage(7200, Number.NaN)).toBeNull();

  const resolved = resolveStatedLot(DERIVED);
  expect(resolved.derived?.depthFt).toBe(120);
  expect(resolved.form.lotDepth).toBe("120");

  /* A derivation that cannot be made empties the depth rather than leaving a
     stale number that would read as measured. */
  const blank = resolveStatedLot({ ...DERIVED, lotAreaSqFt: "" });
  expect(blank.derived).toBeNull();
  expect(blank.form.lotDepth).toBe("");
  expect(statedLotErrors(blank.form).join(" ")).toContain("Lot area must be a number of square feet");

  // A stated depth is never overwritten by a derivation nobody asked for.
  const stated = resolveStatedLot({ ...GOOD, lotAreaSqFt: "1" });
  expect(stated.derived).toBeNull();
  expect(stated.form.lotDepth).toBe("120");
});

test("the derivation discloses itself on screen, and only where there is one", async ({ page }) => {
  const derived = await readRendered(page, DERIVED);
  expect(derived.text).toContain(DERIVED_DEPTH_NOTE);
  expect(derived.text).toContain("7,200 sq ft ÷ 60.0 ft frontage = 120.0 ft front to back");

  /* THE OTHER DIRECTION, which is what makes the assertion above mean
     something: a depth the reader typed carries no derivation sentence,
     because there was no derivation. */
  const stated = await readRendered(page, GOOD);
  expect(stated.text).not.toContain(DERIVED_DEPTH_NOTE);
  expect(stated.text).not.toContain("÷");

  /* And the sentence names all three things it owes a reader. */
  expect(DERIVED_DEPTH_NOTE).toContain("divided");
  expect(DERIVED_DEPTH_NOTE).toContain("frontage");
  expect(DERIVED_DEPTH_NOTE).toContain("rectangle");
});

/* ═════════════════════════════════════════════════ declared, never verified */

test("a stated envelope can refuse a design and can never pass one", () => {
  const lot = { statedAtISO: STATED_AT, sourceLabel: "Stated by the project owner." };

  const fits = evaluateDistrictAgainstStatedLot(district(), DESIGN, {
    ...lot,
    widthFt: 50,
    depthFt: 80,
  });
  const fitting = envelopeFinding(fits);
  expect(fitting, "the engine stopped emitting a buildable-envelope finding").not.toBeNull();
  expect(fitting!.severity).toBe("check");
  expect(fitting!.points).toBe(10);
  expect(fitting!.possiblePoints).toBe(20);

  /* THE PROOF THAT 10 MEANS `declared`. The identical rectangle marked
     `verified` scores the full 20 and comes back "pass". So the 10 above is a
     measurement of the status this module emits, not a number copied out of
     the engine — and if `evaluateDistrictAgainstStatedLot` ever promoted its
     facts to `verified`, the first assertion goes red. */
  const asVerified = (value: number): EvidenceFact<number> => ({
    value,
    status: "verified",
    sourceLabel: "A fabricated authority, used only to prove this spec can fail.",
    sourceUrl: "https://example.invalid/",
    checkedAtISO: STATED_AT,
  });
  const facts: LandDiscoveryListing["facts"] = {
    ...districtConstraintFacts(district()),
    buildableWidthFt: asVerified(50),
    buildableDepthFt: asVerified(80),
  };
  const verified = evaluateLandFacts(facts, DESIGN).find((f) => f.id === "buildable-envelope")!;
  expect(verified.severity).toBe("pass");
  expect(verified.points).toBe(20);

  // A stated rectangle that does not take the footprint is a real refusal.
  const small = envelopeFinding(
    evaluateDistrictAgainstStatedLot(district(), DESIGN, { ...lot, widthFt: 20, depthFt: 20 }),
  )!;
  expect(small.severity).toBe("block");
  expect(small.points).toBe(0);

  // And no rectangle, of any size, comes back as a pass.
  for (const widthFt of [10, 20, 50, 100, 400]) {
    for (const depthFt of [10, 20, 50, 100, 400]) {
      const severity = envelopeFinding(
        evaluateDistrictAgainstStatedLot(district(), DESIGN, { ...lot, widthFt, depthFt }),
      )!.severity;
      expect(["check", "block"], `${widthFt} × ${depthFt} came back ${severity}`).toContain(severity);
    }
  }

  // A stated lot is checked, never summarised: there is no verdict to read.
  expect(Object.keys(fits)).not.toContain("verdict");
});

test("the merge happens outside the district module, and the district path is unchanged", () => {
  /* `districtConstraintFacts` must keep emitting only `verified` and
     `unknown` — a `declared` fact escaping into it would put a reader's own
     number inside the City's evidence. */
  for (const fact of Object.values(districtConstraintFacts(district()))) {
    expect(["verified", "unknown"]).toContain(fact.status);
  }

  /* And the district check itself still sees an unknown envelope on every one
     of the 156 districts: two verdicts, seven findings, at most one evidenced.
     This is the assertion that would notice if the stated-lot path had been
     bolted onto `evaluateEdmontonDistrict` instead of standing beside it. */
  expect(EDMONTON_DISTRICTS.length).toBeGreaterThan(100);
  for (const candidate of EDMONTON_DISTRICTS) {
    const check = evaluateEdmontonDistrict(candidate, DESIGN);
    expect(check.findings.length, `${candidate.code} finding count`).toBe(7);
    expect(check.evidenced, `${candidate.code} evidenced`).toBeLessThanOrEqual(1);
    expect(["district-rule-blocks", "parcel-evidence-required"]).toContain(check.verdict);
    const envelope = check.findings.find((finding) => finding.id === "buildable-envelope")!;
    expect(envelope.severity, `${candidate.code} envelope`).toBe("check");
    expect(envelope.points, `${candidate.code} envelope points`).toBe(0);
  }
});

/* ═══════════════════════════════════════════════════════════ the refusals */

test("a lot that cannot take the design says which dimension failed and by how much", () => {
  const tight = statedLotRefusal(parcelOf(TIGHT), DESIGN);
  expect(tight, "a 400 sq ft envelope under an 800 sq ft footprint must refuse").not.toBeNull();
  expect(tight!.kind).toBe("envelope-too-small");
  expect(tight!.sentence).toContain("20.0 ft across the frontage by 20.0 ft front to back");
  expect(tight!.sentence).toContain("400 sq ft short");
  // Both ways out, each with its own number of feet.
  expect(tight!.sentence).toContain("40.0 ft front to back");
  expect(tight!.sentence).toContain("20.0 ft more depth");
  expect(tight!.sentence).toContain("40.0 ft across");
  expect(tight!.sentence).toContain("20.0 ft more frontage");

  const eaten = statedLotRefusal(parcelOf(EATEN), DESIGN);
  expect(eaten!.kind).toBe("setbacks-consume-lot");
  expect(eaten!.sentence).toContain("leaving -10.0 ft across");
  expect(eaten!.sentence).toContain("leaving -10.0 ft front to back");
  expect(eaten!.sentence).toContain("40.0 ft off a frontage of 30.0 ft");

  /* THE DETECTOR. A lot that does take the design must produce nothing, or
     the assertions above are satisfied by a function that always refuses. */
  expect(statedLotRefusal(parcelOf(GOOD), DESIGN)).toBeNull();
});

test("the refusal reaches the screen, and an incomplete lot cannot be committed", async ({ page }) => {
  const refused = await readRendered(page, TIGHT);
  expect(refused.text).toContain("Refuses this design");
  expect(refused.text).toContain("400 sq ft short");
  // A refusal is not a dead end: the control is still there and still pressable.
  expect(refused.hasButton).toBe(true);
  expect(refused.buttonDisabled).toBe(false);

  const eaten = await readRendered(page, EATEN);
  expect(eaten.text).toContain("There is no rectangle left to put a home in");

  /* An incomplete lot is the one state where the button is genuinely unusable,
     and it says so in full rather than sitting there greyed and silent. */
  const incomplete = await readRendered(page, INCOMPLETE);
  expect(incomplete.hasButton).toBe(true);
  expect(incomplete.buttonDisabled).toBe(true);
  expect(incomplete.text).toContain(INCOMPLETE_NOTE);
  expect(incomplete.text).toContain("Lot width along the front must be a number of feet from 10 to 5,280.");

  // And a good lot is committable, which is what makes the line above a fact.
  const good = await readRendered(page, GOOD);
  expect(good.buttonDisabled).toBe(false);
});

test("the state line gives every reason at once, not the first one", () => {
  // Two things standing in the way produce two sentences, in that order.
  expect(commitState({ kind: "idle" }, false, false)).toEqual([INCOMPLETE_NOTE, NO_PROJECT_NOTE]);
  // One each.
  expect(commitState({ kind: "idle" }, true, false)).toEqual([NO_PROJECT_NOTE]);
  expect(commitState({ kind: "idle" }, false, true)).toEqual([INCOMPLETE_NOTE]);
  // Nothing in the way, and it still says nothing has been written.
  expect(commitState({ kind: "idle" }, true, true)).toEqual([NOTHING_WRITTEN_NOTE]);
  expect(commitState({ kind: "saved" }, true, true)).toEqual([SAVED_NOTE]);
  // A failure carries the reason it failed rather than a generic apology.
  expect(commitState({ kind: "problem", message: "Cannot save this plot: x" }, true, true)).toEqual([
    "This lot was not written. Cannot save this plot: x",
  ]);
});

test("without a project the panel explains what is missing instead of failing to render", async ({ page }) => {
  /* The panel is mounted inside ZoningLookup, which /land renders with no
     project of its own and which specs render outside the provider entirely.
     Throwing there would take the whole zoning surface down with it. */
  const rendered = await readRendered(page, GOOD);
  expect(rendered.text).toContain(NO_PROJECT_NOTE);
  expect(rendered.text).toContain("Use this lot in my design");
  expect(NO_PROJECT_NOTE).toContain("Start or open a project");
});

/* ══════════════════════════════════════════════════════ nothing reads as sale */

test("nothing this surface states reads as inventory or as a fit", async ({ page }) => {
  /* THE DETECTORS FIRST, both of them. */
  expect(forbiddenIn("this parcel is listed for sale", MARKET_VOCABULARY)).toBe("for sale");
  expect(forbiddenIn("zoning district RM h16", MARKET_VOCABULARY)).toBe(null);
  expect(forbiddenIn("this lot is a match", MATCH_VOCABULARY)).toBe("match");
  expect(forbiddenIn("this lot is checked, not confirmed", MATCH_VOCABULARY)).toBe(null);

  // Every exported sentence, including the one that is not on screen yet.
  const constants: Array<[string, string]> = [
    ["PROPERTY_REGISTER_BOUNDARY", PROPERTY_REGISTER_BOUNDARY],
    ["STATED_LOT_SETBACK_NOTE", STATED_LOT_SETBACK_NOTE],
    ["STATED_LOT_WHOLE_LOT_NOTE", STATED_LOT_WHOLE_LOT_NOTE],
    ["DERIVED_DEPTH_NOTE", DERIVED_DEPTH_NOTE],
    ["REGISTER_NO_ROW_NOTE", REGISTER_NO_ROW_NOTE],
    ["NO_PROJECT_NOTE", NO_PROJECT_NOTE],
    ["INCOMPLETE_NOTE", INCOMPLETE_NOTE],
    ["NOTHING_WRITTEN_NOTE", NOTHING_WRITTEN_NOTE],
    ["NOTHING_STATED_NOTE", NOTHING_STATED_NOTE],
    ["EMPTY_UNTIL_STATED_NOTE", EMPTY_UNTIL_STATED_NOTE],
    ["SLOPE_DEFAULT_NOTE", SLOPE_DEFAULT_NOTE],
    ["SAVED_NOTE", SAVED_NOTE],
    ["STATED_LOT_SCOPE_NOTE", STATED_LOT_SCOPE_NOTE],
  ];
  for (const [name, sentence] of constants) {
    expect(sentence.length, `${name} is empty`).toBeGreaterThan(40);
    expect(forbiddenIn(sentence, MARKET_VOCABULARY), name).toBe(null);
    expect(forbiddenIn(sentence, MATCH_VOCABULARY), name).toBe(null);
  }

  // And the rendered surface, in the four states a reader can reach.
  for (const [label, form] of [
    ["a complete lot", GOOD],
    ["a derived depth", DERIVED],
    ["a lot that refuses", TIGHT],
    ["a half-typed lot", INCOMPLETE],
    ["an untouched form", INITIAL_STATED_LOT],
  ] as Array<[string, StatedLotForm]>) {
    const rendered = await readRendered(page, form);
    expect(rendered.text.length, `${label} rendered nothing`).toBeGreaterThan(1000);
    expect(forbiddenIn(rendered.text, MARKET_VOCABULARY), `${label} text`).toBe(null);
    expect(forbiddenIn(rendered.text, MATCH_VOCABULARY), `${label} text`).toBe(null);
    for (const attribute of rendered.attributes) {
      expect(forbiddenIn(attribute, MARKET_VOCABULARY), `${label} attribute "${attribute}"`).toBe(null);
    }
    // The boundary sentence is printed verbatim rather than paraphrased.
    expect(rendered.text, `${label} boundary`).toContain(PROPERTY_REGISTER_BOUNDARY);
  }
});

test("the register miss copy stays off screen until something actually looks a lot up", async ({ page }) => {
  /* A register miss belongs to the explicit lookup surface above this form,
     after its button is pressed. The form itself must not imply that a lookup
     already happened, so the assertion here is that the outcome is not shown
     merely because the form rendered. */
  expect(REGISTER_NO_ROW_NOTE).toContain("quadrant");
  expect(REGISTER_NO_ROW_NOTE).toContain("285");

  const rendered = await readRendered(page, GOOD);
  expect(rendered.text).not.toContain(REGISTER_NO_ROW_NOTE);

  /* THE DETECTOR. The same comparison, on a sentence that IS rendered, must
     find it — otherwise "not contained" is being satisfied by a text nobody
     read. */
  expect(rendered.text).toContain(STATED_LOT_WHOLE_LOT_NOTE);

  /* And the listing convention's sentence stays on the listing path: a stated
     lot's setbacks are real and are never recorded as zero. */
  expect(rendered.text).not.toContain(PLOT_SETBACK_NOTE);
  expect(PLOT_SETBACK_NOTE).toContain("setbacks as zero");
});

test("the stated-lot form describes the explicit register lookup without contradicting it", async ({ page }) => {
  const rendered = await readRendered(page, GOOD);

  expect(rendered.text).not.toContain("Aura does not look your address up");
  expect(rendered.text).not.toContain("this build makes no call to the City’s property register");
  expect(rendered.text).toContain("only when you press the lookup button above");
  expect(rendered.text).toContain("never fills or overwrites these fields");
  expect(rendered.text).toContain("every value saved from this form is one you type");
});

test("no surface under components/land calls the network directly", () => {
  /* An address typed into this section leaves the browser only through a
     reviewed lookup module, never through a `fetch` somebody added to a
     component. The explicit lookup delegates to lib/land/propertyLookup; this
     assertion keeps the network boundary deliberate. */
  const dir = path.resolve(__dirname, "..", "components", "land");
  const files = readdirSync(dir).filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"));
  expect(files.length, "components/land is empty; this test is measuring nothing").toBeGreaterThan(2);
  for (const file of files) {
    const source = readFileSync(path.join(dir, file), "utf8");
    expect(source.includes("fetch("), `${file} calls fetch directly`).toBe(false);
    expect(source.includes("XMLHttpRequest"), `${file} opens an XHR`).toBe(false);
  }
  // THE DETECTOR: the substring test does find a call when there is one.
  expect("const r = await fetch(url);".includes("fetch(")).toBe(true);
});
