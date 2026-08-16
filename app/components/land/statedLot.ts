/* THE LOT SOMEBODY ALREADY HAS — the arithmetic behind /land's lot panel.
 *
 * WHY THIS EXISTS. `plotSite.ts` turns a demonstration record into a site, and
 * `landData.ts` turns a zoning district into seven questions. Neither can reach
 * the one situation most people are actually in: they know where their land is,
 * and nothing on /land would take it. The district refuses to guess a parcel —
 * correctly, `districtConstraintFacts` records the buildable width and depth as
 * unknown on all 156 of them — so the only honest way past that refusal is for
 * the person to state the parcel themselves.
 *
 * THE THREE RULES THIS FILE ENFORCES.
 *
 *   1. A STATED LOT IS THE WHOLE LOT. A demonstration record publishes the
 *      rectangle that is LEFT once setbacks are off it, which is why
 *      `siteFromListing` records its setbacks as zero. A person describing
 *      their own land describes the whole thing, so their setbacks are real
 *      setbacks and `buildableEnvelope` takes them off. Reusing the listing
 *      convention here would mean nobody's setbacks were ever applied; reusing
 *      this one there would apply them twice. The provenance on the stored site
 *      is what keeps the two apart afterwards.
 *
 *   2. A DERIVED DEPTH IS ARITHMETIC, NOT A MEASUREMENT. A property register
 *      publishes a lot AREA. `BuilderSite` needs a rectangle. Dividing the area
 *      by a stated frontage produces a depth that is only true if the lot is a
 *      rectangle, and a great many are not. So the division is a separate,
 *      named, optional path, `DERIVED_DEPTH_NOTE` travels with its result, and
 *      typing the depth directly stays the default.
 *
 *   3. A STATED LOT CAN REFUSE AND CAN NEVER PASS. The envelope facts it feeds
 *      the fit engine carry status `declared`, never `verified`, because they
 *      inherit numbers a person typed. `evaluateLandFacts` already turns that
 *      into severity "check" when the design fits and "block" when it does not,
 *      so nothing here needs a new verdict word and nothing is weakened.
 *      `evaluateEdmontonDistrict` keeps its two verdicts and never sees these
 *      facts — that is why this is a separate function rather than a flag.
 *
 * Pure on purpose: no React, no network, no clock. The sentence on screen and
 * the arithmetic behind it are read from the same place, so they cannot drift.
 */

import { parcelErrors, parseParcel, type ParcelForm } from "@/components/design/ParcelPanel";
import type { BuilderSite, BuilderSiteProvenance } from "@/lib/builder/site";
import { buildableEnvelope, type ParcelFacts } from "@/lib/design/parcel";
import {
  evaluateLandFacts,
  type EvidenceFact,
  type LandDesignRequirements,
  type LandDiscoveryListing,
  type LandFitFinding,
} from "@/lib/marketplace/discovery";
import {
  districtConstraintFacts,
  type EdmontonZoningDistrict,
} from "@/lib/marketplace/landData";

/* ------------------------------------------------------------- the sentences */

/** The boundary that has to survive every rewrite of this surface. A register
 *  is an ownership record; it has no column that could say otherwise. */
export const PROPERTY_REGISTER_BOUNDARY =
  "A property register records who owns what. It never records what is being sold.";

/** Why the setbacks below are the reader's numbers and stay the reader's
 *  numbers. Zoning Bylaw 20001 writes setbacks in its own text rather than in
 *  an open dataset, which is why all 156 districts record them as unknown. */
export const STATED_LOT_SETBACK_NOTE =
  "These setbacks are your numbers, not the bylaw's. Aura has not read this district's setback table — Zoning Bylaw 20001 writes setbacks in its own text rather than in an open dataset — so it takes the rectangle you state and does not correct it. Zero is a number you may type, and it is not a number Aura will fill in for you.";

/** The difference between this panel and the "use this plot" button on the
 *  demonstration cards, said where somebody could get it backwards. */
export const STATED_LOT_WHOLE_LOT_NOTE =
  "State the whole lot here. The setbacks you give are taken off it to get the buildable rectangle. A plot carried over from one of the demonstration records on this page is the opposite case — its width and depth are already what is left after setbacks, so those are stored as zero. Reading one as the other would take the same land off twice, or take none of it off at all.";

/**
 * Why the form opens with nothing in it.
 *
 * A prefilled rectangle on a panel that stores "the owner stated this lot" is a
 * claim about a person made out of numbers they never saw. This sentence is the
 * reader-facing half of `INITIAL_STATED_LOT`: it says the emptiness is
 * deliberate, that Aura has no lot of theirs to open on, and that the control
 * at the bottom is unavailable until the lot exists.
 */
export const EMPTY_UNTIL_STATED_NOTE =
  "Every measured field below starts empty, on purpose. Aura holds no lot of yours to open on, and a rectangle it filled in for you would end up saved as something you stated. Until a frontage, a depth and three setbacks are here, there is nothing to check and nothing for the button to write.";

/**
 * The one control that opens on a value, said plainly rather than left to be
 * discovered. Slope changes the pile schedule, not the envelope arithmetic, so
 * it cannot make a rectangle read as measured — but it is still an answer sitting
 * there before anybody gave one.
 */
export const SLOPE_DEFAULT_NOTE =
  "The slope control opens on Flat and the facing control opens on Not sure yet. Flat is where the control starts rather than something Aura knows about your ground; if it falls, say so, because that is a foundation cost on screw piles.";

/**
 * The derivation disclosure, printed beside the derived number and nowhere
 * else. It has to name all three things: that Aura did the division, whose
 * numbers went into it, and that the result is only true for a rectangle.
 */
export const DERIVED_DEPTH_NOTE =
  "Aura divided the lot area by the frontage you stated to get this depth. It measured nothing: the area comes from the source beside it and the frontage is your number, so this depth is arithmetic rather than a survey. It is only true if the lot is a rectangle — corner, pie and ravine-backing lots are not, and on those the real depth is different. Type the depth in yourself if you have it.";

/**
 * What a property-register lookup owes a reader when it finds no row.
 *
 * NOT RENDERED BY THIS BUILD, deliberately. The live lookup against the City's
 * property register is `lib/land/propertyLookup.ts`, which belongs to another
 * node and does not exist in this checkout yet; this panel therefore has no
 * address box, and printing a "we found nothing" sentence when nothing was
 * looked up would be theatre. The string lives here so the wiring, when it
 * lands, has the copy already written and already carrying the quadrant fact
 * that makes a miss the reader's to fix. `tests/land-stated-lot.spec.ts`
 * asserts it stays off screen until then.
 */
export const REGISTER_NO_ROW_NOTE =
  "The City's property register has no row for that address. That is not a statement about whether the property exists: 285 Edmonton street names occur in more than one quadrant, so NW, SW, NE and SE change which property you mean, and the register spells every street name out in full. Check the quadrant, or read the lot area off your title or your Real Property Report and type it in below.";

/* ------------------------------------------------------------------ the form */

/** Where the depth in the form came from. `stated` is the default because a
 *  number somebody read off a document beats a number Aura calculated. */
export type DepthSource = "stated" | "derived";

/**
 * The parcel form plus the two fields a register-shaped answer needs.
 *
 * It EXTENDS `ParcelForm` rather than restating it, so the 10–5,280 ft bounds,
 * the 0–1,000 ft setback bounds and the exact error sentences stay one
 * definition shared with /design and the builder's Site step.
 */
export interface StatedLotForm extends ParcelForm {
  /** Square feet, as typed. Empty means nobody has stated an area. */
  lotAreaSqFt: string;
  depthSource: DepthSource;
}

/**
 * NOTHING. Every measured field opens empty.
 *
 * WHAT THIS REPLACES, and why. This used to be `{ ...INITIAL_PARCEL }` — the
 * 150 × 290 ft lot with 25/10/25 setbacks that `ParcelPanel` puts on /design as
 * a shape to type over. On /design that is fair: the panel prints "the numbers
 * above are placeholders to type over, never a recommendation" directly under
 * them, and nothing there records who said them. Here it was not: this panel
 * tells the reader "every number below is one you type", prints "checked
 * against your numbers" over the arithmetic, and its button stores the result
 * under a label saying the project owner stated this lot. One press on an
 * untouched form saved Aura's rectangle as the reader's statement.
 *
 * Of the two honest repairs, this is the one that needs no disclaimer to be
 * true: with nothing prefilled there is no figure to mislabel, `statedLotErrors`
 * already refuses an empty field with the sentence that names it, and the panel
 * cannot offer the button until a frontage, a depth and three setbacks exist.
 * The alternative — keep the example and label it — leaves a pressable path to
 * committing numbers nobody chose, and asks a disclaimer to do the work an
 * empty field does by construction.
 *
 * `frontFaces` and `slope` are not measurements and are not prefilled figures:
 * they are closed lists whose opening entries say "Not sure yet" and "Flat", so
 * neither states a dimension and neither reaches the buildable-envelope
 * arithmetic. Slope reaches the FOUNDATION, which is why the panel says out
 * loud that flat is where the control starts.
 */
export const INITIAL_STATED_LOT: StatedLotForm = {
  lotWidth: "",
  lotDepth: "",
  front: "",
  side: "",
  rear: "",
  frontFaces: "unknown",
  slope: "flat",
  lotAreaSqFt: "",
  depthSource: "stated",
};

/* Generous, like ParcelPanel's own bounds: they catch a typo, they do not have
   an opinion about how big somebody's land is. The ceiling is the square of
   ParcelPanel's 5,280 ft, so an area that could never describe a lot inside
   those bounds is refused before it reaches the division. */
const AREA_MIN_SQFT = 100;
const AREA_MAX_SQFT = 5280 * 5280;

const num = (s: string): number => Number(s.trim());

/* -------------------------------------------------------------- the division */

export interface DerivedDepth {
  depthFt: number;
  frontageFt: number;
  fromAreaSqFt: number;
}

/**
 * Depth from an area and a frontage, or nothing.
 *
 * Null rather than NaN or Infinity on every bad input, so a caller cannot
 * render a derived depth it never actually got.
 */
export function depthFromAreaAndFrontage(
  areaSqFt: number,
  frontageFt: number,
): DerivedDepth | null {
  if (!Number.isFinite(areaSqFt) || areaSqFt <= 0) return null;
  if (!Number.isFinite(frontageFt) || frontageFt <= 0) return null;
  const depthFt = areaSqFt / frontageFt;
  if (!Number.isFinite(depthFt) || depthFt <= 0) return null;
  return { depthFt, frontageFt, fromAreaSqFt: areaSqFt };
}

const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * The form as the rest of this module reads it, with the derived depth already
 * substituted when that is where the depth comes from.
 *
 * Returning the derivation alongside the form is what lets the panel print
 * `DERIVED_DEPTH_NOTE` only when there is a derivation to explain — a
 * disclosure that renders unconditionally stops being read.
 */
export function resolveStatedLot(form: StatedLotForm): {
  form: StatedLotForm;
  derived: DerivedDepth | null;
} {
  if (form.depthSource !== "derived") return { form, derived: null };
  const derived = depthFromAreaAndFrontage(num(form.lotAreaSqFt), num(form.lotWidth));
  if (!derived) return { form: { ...form, lotDepth: "" }, derived: null };
  return { form: { ...form, lotDepth: String(round2(derived.depthFt)) }, derived };
}

/**
 * True while not one measured field has been filled in.
 *
 * The difference between "you have not started" and "you started and left a
 * field out" is worth drawing: an untouched form listing five failures reads as
 * five things the reader did wrong before they have done anything at all. The
 * two selects are not consulted — they carry no figure, so they cannot make a
 * form look stated.
 */
export function statedNothingYet(form: StatedLotForm): boolean {
  return [form.lotWidth, form.lotDepth, form.front, form.side, form.rear, form.lotAreaSqFt].every(
    (value) => value.trim() === "",
  );
}

/**
 * Every reason this lot cannot be committed, in the same sentence shape the
 * questionnaire already uses. `parcelErrors` first, so the shared bounds and
 * their wording keep answering for the five fields they own.
 */
export function statedLotErrors(form: StatedLotForm): string[] {
  const out = [...parcelErrors(form)];
  const typed = form.lotAreaSqFt.trim() !== "";
  const area = num(form.lotAreaSqFt);
  const badArea = !Number.isFinite(area) || area < AREA_MIN_SQFT || area > AREA_MAX_SQFT;

  if (form.depthSource === "derived" && (!typed || badArea)) {
    out.push(
      `Lot area must be a number of square feet from ${AREA_MIN_SQFT.toLocaleString("en-CA")} to ${AREA_MAX_SQFT.toLocaleString("en-CA")} before it can be divided by the frontage.`,
    );
  } else if (typed && badArea) {
    out.push(
      `Lot area must be a number of square feet from ${AREA_MIN_SQFT.toLocaleString("en-CA")} to ${AREA_MAX_SQFT.toLocaleString("en-CA")}, or left empty.`,
    );
  }
  return out;
}

/* ------------------------------------------------------------ the stored site */

/**
 * The provenance a hand-stated lot is stored under.
 *
 * WAS `manual`, WHICH WAS NOT ENOUGH. `manual` is also what the builder's own
 * Site step writes, so a lot stated here and a lot typed three steps into the
 * builder came out of the document indistinguishable — and only one of them is
 * carrying a stored source label saying the project owner stated their own lot.
 * `owner-stated` is that distinction, and `lib/builder/site.ts` documents what
 * each of the four values means. Old documents are untouched: `manual` is still
 * a legal value with its old meaning, so nothing saved before this needs
 * migrating and nothing is re-labelled behind a reader's back.
 *
 * STILL NOT `register-derived`. The case where the lot AREA arrived from the
 * City's property register and only the frontage was stated needs the live
 * lookup to exist, and it does not. Writing it now would put a claim in the
 * saved document that the document cannot support.
 */
export const STATED_LOT_PROVENANCE: BuilderSiteProvenance = "owner-stated";

/** Slope decides how the ground is drawn and how the piles are scheduled.
 *  Same rule as the builder's Site step, which keeps it module-private. */
export function gradeForStatedSlope(slope: ParcelForm["slope"]): BuilderSite["grade"] {
  return slope === "flat" ? "flat" : "plane";
}

/**
 * The site a valid stated lot becomes. Only meaningful once `statedLotErrors`
 * is empty — this does no checking of its own, exactly as `parseParcel` does
 * none, so there is one place where a half-typed field is judged.
 */
export function statedLotSite(form: StatedLotForm): BuilderSite {
  return {
    parcel: parseParcel(form),
    provenance: STATED_LOT_PROVENANCE,
    grade: gradeForStatedSlope(form.slope),
  };
}

/* --------------------------------------------------------------- the refusal */

export type StatedLotRefusalKind = "setbacks-consume-lot" | "envelope-too-small";

export interface StatedLotRefusal {
  kind: StatedLotRefusalKind;
  /** Names the dimension that failed and by how much, in feet a reader can
   *  check against the numbers they just typed. */
  sentence: string;
}

const ft1 = (v: number): string =>
  (Math.round(v * 10) / 10).toLocaleString("en-CA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
const sqft = (v: number): string => Math.round(v).toLocaleString("en-CA");

/**
 * Why this lot cannot take this design, or null.
 *
 * The fit engine's own refusal states an AREA shortfall, which is true and
 * unusable: a person cannot act on "428 sq ft short" without knowing which way
 * the rectangle is wrong. So this states the failing dimension and the number
 * of feet, in both directions, and leaves the choice to the reader.
 */
export function statedLotRefusal(
  parcel: ParcelFacts,
  requirements: LandDesignRequirements,
): StatedLotRefusal | null {
  const env = buildableEnvelope(parcel);

  if (!env.usable) {
    const parts: string[] = [];
    if (!(env.widthFt > 0)) {
      parts.push(
        `two side setbacks of ${ft1(parcel.sideSetbackFt)} ft take ${ft1(parcel.sideSetbackFt * 2)} ft off a frontage of ${ft1(parcel.lotWidthFt)} ft, leaving ${ft1(env.widthFt)} ft across`,
      );
    }
    if (!(env.depthFt > 0)) {
      parts.push(
        `a front setback of ${ft1(parcel.frontSetbackFt)} ft and a rear setback of ${ft1(parcel.rearSetbackFt)} ft take ${ft1(parcel.frontSetbackFt + parcel.rearSetbackFt)} ft off a depth of ${ft1(parcel.lotDepthFt)} ft, leaving ${ft1(env.depthFt)} ft front to back`,
      );
    }
    return {
      kind: "setbacks-consume-lot",
      sentence: `Those setbacks use up the lot: ${parts.join("; and ")}. There is no rectangle left to put a home in, so nothing further can be checked against this lot until the setbacks or the lot dimensions change.`,
    };
  }

  if (env.areaSqFt + 0.01 >= requirements.footprintSqft) return null;

  const shortSqFt = requirements.footprintSqft - env.areaSqFt;
  const needDepthFt = requirements.footprintSqft / env.widthFt;
  const needWidthFt = requirements.footprintSqft / env.depthFt;
  return {
    kind: "envelope-too-small",
    sentence: `The setbacks leave ${ft1(env.widthFt)} ft across the frontage by ${ft1(env.depthFt)} ft front to back — ${sqft(env.areaSqFt)} sq ft — and the design's footprint is ${sqft(requirements.footprintSqft)} sq ft, so this lot is ${sqft(shortSqFt)} sq ft short. At this frontage the buildable rectangle would need ${ft1(needDepthFt)} ft front to back, which is ${ft1(needDepthFt - env.depthFt)} ft more depth than the setbacks leave. At this depth it would need ${ft1(needWidthFt)} ft across, which is ${ft1(needWidthFt - env.widthFt)} ft more frontage. Change the setbacks, the lot, or the footprint.`,
  };
}

/* ----------------------------------------------------------------- the check */

/**
 * A district's seven questions, re-answered against a rectangle somebody
 * stated.
 *
 * DELIBERATELY CARRIES NO VERDICT FIELD. `EdmontonDistrictVerdict` has two
 * values and gains no third: a stated lot is checked, never summarised, and a
 * summary is exactly the sentence a person would read as approval to buy.
 */
export interface StatedLotCheck {
  district: EdmontonZoningDistrict;
  findings: LandFitFinding[];
  evidenced: number;
  outstanding: number;
  statedAtISO: string;
  /** The POST-SETBACK rectangle the check was run against — what
   *  `buildableEnvelope` left, not the lot the reader typed. Named for the
   *  interface contract; the distinction matters and is stated here because a
   *  field name cannot carry it. */
  lotWidthFt: number;
  lotDepthFt: number;
}

/**
 * The one merge point. `districtConstraintFacts` is spread untouched and
 * exactly two of its eight facts are overridden, so the district module keeps
 * emitting only `verified` and `unknown` and this module owns every `declared`
 * fact in the system.
 *
 * Status is `declared` regardless of where the area came from, including a City
 * register: the rectangle inherits a frontage the person typed, so the whole
 * rectangle is theirs. `evaluateLandFacts` reads that and can return "check" or
 * "block" for this finding, never "pass".
 */
export function evaluateDistrictAgainstStatedLot(
  district: EdmontonZoningDistrict,
  requirements: LandDesignRequirements,
  lot: { widthFt: number; depthFt: number; statedAtISO: string; sourceLabel: string },
): StatedLotCheck {
  const declared = (value: number): EvidenceFact<number> => ({
    value,
    status: "declared",
    sourceLabel: lot.sourceLabel,
    sourceUrl: null,
    checkedAtISO: lot.statedAtISO,
  });

  const facts: LandDiscoveryListing["facts"] = {
    ...districtConstraintFacts(district),
    buildableWidthFt: declared(lot.widthFt),
    buildableDepthFt: declared(lot.depthFt),
  };

  const findings = evaluateLandFacts(facts, requirements);
  const evidenced = findings.filter((finding) => finding.severity !== "check").length;
  return {
    district,
    findings,
    evidenced,
    outstanding: findings.length - evidenced,
    statedAtISO: lot.statedAtISO,
    lotWidthFt: lot.widthFt,
    lotDepthFt: lot.depthFt,
  };
}

/** The buildable-envelope finding, which is the only one a stated lot changes.
 *  Null would mean the engine stopped emitting it, which the spec catches. */
export function envelopeFinding(check: StatedLotCheck): LandFitFinding | null {
  return check.findings.find((finding) => finding.id === "buildable-envelope") ?? null;
}
