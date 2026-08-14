/* ===========================================================================
   GUIDED-MODE GUIDANCE — the reason beside the decision, and never a reason
   Aura cannot stand behind.

   GQ01 asks for defaults that already respect the constraints that actually
   apply in Alberta. GQ02 asks for one sourced sentence at the control that
   the decision belongs to. Both of those are content problems, not interface
   problems, so both live here, in a module with no React in it — because a
   sentence that can be tested is a sentence that can be trusted, and a
   sentence rendered inline in a component cannot be either.

   THE ONE RULE THIS FILE EXISTS TO KEEP.

   A constraint is never reported as satisfied unless this module actually
   compared the design against it. That is not a style preference; it is the
   difference between a tool and a liability. `LiveReadout.tsx` already holds
   the line for the read-out strip — it prints "Not modelled" for the glazing
   ratio after a graph conversion, and its footnote says out loud that
   municipal minimum dwelling size is not checked anywhere in this product.
   This module makes the same refusals, in the same words, for the guided
   walk. Where nothing can be checked, the honest output is that nothing was
   checked, and the structure below makes the difference machine-readable
   rather than a matter of how the sentence was phrased:

     · `standing: "checked"`      — the constraint was evaluated here, now,
                                    against the document that was handed in.
     · `standing: "not-modelled"` — the constraint is real and Aura does not
                                    model it. The sentence says so.
     · `measurement.withinTarget` — non-null ONLY when a target exists AND
                                    the value was compared with it.

   The spec pins the invariant that ties those together, so a future sentence
   cannot claim compliance by wording alone.

   ONE ANCHORED SOURCE PER FACT. Nothing here computes a quantity that some
   other module already owns. The glazing ratio is `modelledGlazingRatio`; the
   FDWR ceiling is `FDWR_MAX`; the room program is `deriveProgram`; the storey
   count is `storeysOf`; the wall assembly R is `WALL_R_VALUE`; the envelope
   proportion is `envelopeFor`. A second, faster, "good enough for a tooltip"
   version of any of them would agree on the day it was written and disagree
   by the time anybody noticed — this repo has paid for that three times.
   The only things this file computes for itself are the strings.

   PURE AND TOTAL. No React, no clock, no storage, no network, no randomness,
   no locale-dependent formatting. The same inputs always produce a deeply
   equal result and the inputs are never mutated.
   =========================================================================== */

import type { ClimateZone, EcoMaterial } from "@/lib/designApi";
import { envelopeFor } from "@/lib/design/layout";
import { FDWR_MAX, WALL_R_VALUE, isColdZone } from "@/lib/design/materials";
import { formatFeetInchesWords } from "@/lib/units";
import type { AuraProject } from "@/lib/project/document";

import type { BuilderDocument } from "./document";
import { parcelCheckApplies } from "./readiness";
import {
  SPEC_VERSION,
  totalFloorAreaSqFt,
  type HomeSpec,
} from "./spec";
import {
  deriveProgram,
  modelledGlazingRatio,
  modelledWallAreaSqFt,
  storeysOf,
} from "./toPlan";

// ---------------------------------------------------------------------------
// what a sourced sentence is made of
// ---------------------------------------------------------------------------

/**
 * Where a sentence gets its authority.
 *
 * Four kinds, and the distinction is the point. `code` and `data` are facts
 * the product can be held to. `document` is researched material with a date on
 * it. `assumption` is Aura's own judgement, named so a person can disagree
 * with it — the honest label for a rule nobody legislated.
 */
export type GuidanceSourceKind = "code" | "data" | "document" | "assumption";

export interface GuidanceSource {
  kind: GuidanceSourceKind;
  /** The module, data file or document that owns the fact. Never empty — a
   *  source that cannot be named is not a source. */
  module: string;
  /** What that owner itself cites, in one clause. */
  authority: string;
}

export type GuidanceUnit = "ratio" | "sqft" | "storeys" | "r-value" | "count";

/**
 * The number in the sentence, in structured form.
 *
 * Prose can imply compliance by accident; this cannot. `withinTarget` is
 * non-null only where `target` is non-null, which happens only where this
 * module actually ran the comparison.
 */
export interface GuidanceMeasurement {
  /** What was measured, naming the function that measured it. */
  label: string;
  value: number;
  unit: GuidanceUnit;
  /** The modelled ceiling or floor, or `null` when Aura models none. */
  target: number | null;
  /** What that target is, when there is one. */
  targetLabel: string | null;
  /** `true`/`false` only when the comparison was performed. */
  withinTarget: boolean | null;
}

/** Whether the CONSTRAINT behind this topic was evaluated — not whether a
 *  number was printed. A measured floor area with no bylaw to check it
 *  against is still `not-modelled`. */
export type GuidanceStanding = "checked" | "not-modelled";

export interface GuidanceExplanation {
  topic: GuidanceTopic;
  /** The short name of the decision, for the label above the sentence. */
  title: string;
  /** ONE sentence. Plain, and it never claims more than `standing` allows. */
  sentence: string;
  source: GuidanceSource;
  standing: GuidanceStanding;
  measurement: GuidanceMeasurement | null;
}

/**
 * The decisions the guided walk actually asks a person to make, and no more.
 *
 * Deliberately short. A note beside every control is noise; a note beside the
 * five or six decisions a beginner cannot reason about unaided is help.
 */
export type GuidanceTopic =
  | "glazing-ratio"
  | "room-layout"
  | "storey-count"
  | "minimum-dwelling-size"
  | "wall-r-value"
  | "roof-r-value";

export const GUIDANCE_TOPICS: readonly GuidanceTopic[] = [
  "glazing-ratio",
  "room-layout",
  "storey-count",
  "minimum-dwelling-size",
  "wall-r-value",
  "roof-r-value",
];

// ---------------------------------------------------------------------------
// formatting — presentation, never a second calculation
// ---------------------------------------------------------------------------

/* Mirrors `LiveReadout.tsx`'s own `pct` exactly, on purpose: the note beside a
   control and the strip below it print the same ratio, and two roundings of
   one number is the smallest possible way to look wrong. */
const pct = (ratio: number): string => `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`;

/* `toLocaleString` is environment-dependent (ICU build, default locale), and
   this module's whole value is that a spec can pin its output. Grouping four
   digits by hand costs nothing and is deterministic forever. */
function grouped(value: number): string {
  const whole = Math.round(value);
  const sign = whole < 0 ? "-" : "";
  const digits = String(Math.abs(whole));
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return sign + out;
}

const sqFtText = (value: number): string => `${grouped(value)} sq ft`;

/** Bathrooms come out of `deriveProgram` as halves; 1.5 must not print as 2. */
const countText = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const plural = (n: number, word: string): string => `${countText(n)} ${word}${n === 1 ? "" : "s"}`;

/** Display names for the four structural materials a `HomeSpec` can carry.
 *  A LABEL, not a fact: `lib/builder/exportPro.ts` keeps an identical private
 *  table for DXF and IFC metadata, and exporting a presentation table out of
 *  an exporter would be a worse coupling than four repeated strings. */
const MATERIAL_LABEL: Readonly<Record<EcoMaterial, string>> = {
  sip: "structural insulated panel",
  clt: "cross-laminated timber",
  timber_frame: "timber frame",
  rammed_earth: "rammed earth",
};

/* Float noise only — the same convention `lib/builder/toPlan.ts` keeps beside
   its own FDWR comparison. It is not a tolerance on the code ceiling. */
const RATIO_EPS = 1e-9;

// ---------------------------------------------------------------------------
// the refusal every spec-derived reading shares
// ---------------------------------------------------------------------------

/**
 * `document.spec` stops describing the home on screen the moment a project is
 * converted to planar-graph geometry: it becomes a frozen recovery copy and
 * graph edits never touch it. `parcelCheckApplies` is the predicate the
 * readiness reading and the live read-out already share for exactly this, and
 * `LiveReadout.tsx` already uses it to withhold the glazing ratio — reusing it
 * here is what stops the note and the strip from disagreeing on screen.
 */
const specDescribesTheDesign = (document: BuilderDocument): boolean =>
  parcelCheckApplies(document);

const GRAPH_SOURCE: GuidanceSource = {
  kind: "code",
  module: "lib/builder/readiness.ts · parcelCheckApplies",
  authority:
    "the predicate the live read-out and the readiness reading share to refuse a spec-derived verdict after a graph conversion",
};

const graphRefusal = (
  topic: GuidanceTopic,
  title: string,
  what: string,
): GuidanceExplanation => ({
  topic,
  title,
  sentence: `This project uses planar graph geometry, so ${what} is not run here — it would read the frozen recovery spec, which is no longer the home on screen.`,
  source: GRAPH_SOURCE,
  standing: "not-modelled",
  measurement: null,
});

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

/**
 * One sourced sentence about one decision, or `null`.
 *
 * `null` is a real answer and the UI is expected to render nothing for it. It
 * happens when the fact the sentence would state cannot be traced to a source
 * for this document — an unknown topic, or a material with no entry in
 * `WALL_R_VALUE`. Neither is reachable through the type system, and both are
 * reachable through a hand-edited or future document, which is why they are
 * guarded rather than asserted. No source, no sentence.
 */
export function explain(
  topic: GuidanceTopic,
  document: BuilderDocument,
): GuidanceExplanation | null {
  switch (topic) {
    case "glazing-ratio":
      return glazingRatio(document);
    case "room-layout":
      return roomLayout(document);
    case "storey-count":
      return storeyCount(document);
    case "minimum-dwelling-size":
      return minimumDwellingSize(document);
    case "wall-r-value":
      return wallRValue(document);
    case "roof-r-value":
      return roofRValue(document);
    default:
      /* Unreachable for a `GuidanceTopic`, reached the moment a topic string
         arrives from a registry, a saved layout, or a newer build. Saying
         nothing is the only honest answer to a question this build does not
         know how to source. */
      return null;
  }
}

function glazingRatio(document: BuilderDocument): GuidanceExplanation {
  const title = "Glazing";
  if (!specDescribesTheDesign(document)) {
    return graphRefusal("glazing-ratio", title, "the glazing ratio");
  }

  const spec = document.spec;
  const wallSqFt = modelledWallAreaSqFt(spec);
  const source: GuidanceSource = {
    kind: "code",
    module: "lib/design/materials.ts · FDWR_MAX",
    authority:
      "the NBC 9.36 prescriptive fenestration-and-door-to-wall ceiling; docs/ALBERTA-PLAYBOOK.md records that passing it moves a home onto the paid energy-model path",
  };

  if (wallSqFt <= 0) {
    return {
      topic: "glazing-ratio",
      title,
      sentence: `This home has no modelled wall area yet, so there is no glazing ratio to compare with the ${pct(FDWR_MAX)} ceiling.`,
      source,
      standing: "not-modelled",
      measurement: null,
    };
  }

  const ratio = modelledGlazingRatio(spec);
  const within = ratio <= FDWR_MAX + RATIO_EPS;
  return {
    topic: "glazing-ratio",
    title,
    sentence: within
      ? `Your glass is ${pct(ratio)} of this home's modelled wall area, under the ${pct(FDWR_MAX)} NBC 9.36 prescriptive ceiling — a comparison against your own walls, not a code check.`
      : `Your glass is ${pct(ratio)} of this home's modelled wall area, over the ${pct(FDWR_MAX)} NBC 9.36 prescriptive ceiling, which is where a home leaves the prescriptive path and needs a paid energy model to keep the glass.`,
    source,
    standing: "checked",
    measurement: {
      label: "modelledGlazingRatio · lib/builder/toPlan.ts",
      value: ratio,
      unit: "ratio",
      target: FDWR_MAX,
      targetLabel: "FDWR_MAX · NBC 9.36 prescriptive ceiling",
      withinTarget: within,
    },
  };
}

function roomLayout(document: BuilderDocument): GuidanceExplanation {
  const title = "Rooms";
  if (!specDescribesTheDesign(document)) {
    return graphRefusal("room-layout", title, "the room program");
  }

  const spec = document.spec;
  const program = deriveProgram(spec);
  const area = totalFloorAreaSqFt(spec);
  return {
    topic: "room-layout",
    title,
    sentence: `Aura reads ${plural(program.bedrooms, "bedroom")} and ${plural(program.bathrooms, "bathroom")} out of this home's ${sqFtText(area)} rather than asking you, and the plan engine then packs its own rooms from that — so the room list on the drawing is inferred, and it is the first thing to change if it is not the home you meant.`,
    source: {
      kind: "assumption",
      module: "lib/builder/toPlan.ts · deriveProgram (PROGRAM_RULE)",
      authority:
        "Aura's own inference rule, printed in full beside the drawing; no building code sets a bedroom count",
    },
    standing: "checked",
    measurement: {
      label: "deriveProgram.bedrooms · lib/builder/toPlan.ts",
      value: program.bedrooms,
      unit: "count",
      target: null,
      targetLabel: null,
      withinTarget: null,
    },
  };
}

function storeyCount(document: BuilderDocument): GuidanceExplanation {
  const title = "Storeys";
  if (!specDescribesTheDesign(document)) {
    return graphRefusal("storey-count", title, "the storey count");
  }

  const storeys = storeysOf(document.spec);
  return {
    topic: "storey-count",
    title,
    sentence: `This home reads as ${plural(storeys, "storey")} because the count is the highest among your volumes, and a third is not expressible here at all — Aura does not check NBC Part 9's own scope limits, so a home that outgrows Part 9 will not be told so on this screen.`,
    source: {
      kind: "code",
      module: "lib/builder/toPlan.ts · storeysOf",
      authority:
        "HomeSpec.Volume.storeys is typed 1 | 2, so the model cannot express a third storey; nothing in this repo stores Part 9's scope limits",
    },
    standing: "checked",
    measurement: {
      label: "storeysOf · lib/builder/toPlan.ts",
      value: storeys,
      unit: "storeys",
      target: null,
      targetLabel: null,
      withinTarget: null,
    },
  };
}

function minimumDwellingSize(document: BuilderDocument): GuidanceExplanation {
  const title = "Minimum dwelling size";
  /* The refusal below is the SAME refusal `LiveReadout.tsx` prints in its
     footnote, and it is the most important sentence in this file: printing a
     plausible minimum would be the most convincing wrong answer this tool
     could give. */
  const source: GuidanceSource = {
    kind: "document",
    module: "docs/ALBERTA-PLAYBOOK.md · Minimum home size",
    authority:
      "district minimums researched Aug 2026 against the bylaw consolidations; there is no structured twin in data/, so nothing in code checks one",
  };

  if (!specDescribesTheDesign(document)) {
    return {
      topic: "minimum-dwelling-size",
      title,
      sentence:
        "Aura does not check any minimum dwelling size, and on a planar-graph project it cannot even state this home's floor area from the frozen recovery spec — the minimum is set district by district, so read your parcel's own land use bylaw.",
      source,
      standing: "not-modelled",
      measurement: null,
    };
  }

  const area = totalFloorAreaSqFt(document.spec);
  return {
    topic: "minimum-dwelling-size",
    title,
    /* The district names are deliberately spelled out rather than abbreviated:
       the guided walk's sentences carry no full stop but their last, so a
       spec can hold them to one sentence each, and "Ste." would read as a
       sentence boundary to any grep. */
    sentence: `This home is ${sqFtText(area)}, and Aura does not check that against a minimum dwelling size: the minimum is a district figure rather than a county one — Sturgeon County keeps 1,076 sq ft in its country-estate district and none at all in the rest — so read your parcel's own land use bylaw.`,
    source,
    standing: "not-modelled",
    measurement: {
      label: "totalFloorAreaSqFt · lib/builder/spec.ts",
      value: area,
      unit: "sqft",
      target: null,
      targetLabel: null,
      withinTarget: null,
    },
  };
}

function wallRValue(document: BuilderDocument): GuidanceExplanation | null {
  const spec = document.spec;
  /* Widened on purpose. `WALL_R_VALUE` is keyed by `EcoMaterialKey`, which is
     broader than `HomeSpec["material"]`, and a document that reached this
     build from a newer one may carry a material this table has never heard
     of. There is then no sourced R-value, so there is no sentence. */
  const rValue: number | undefined = WALL_R_VALUE[spec.material];
  const label: string | undefined = MATERIAL_LABEL[spec.material];
  if (typeof rValue !== "number" || typeof label !== "string") return null;

  const zone = spec.climateZone;
  const cold = isColdZone(zone);
  return {
    topic: "wall-r-value",
    title: "Wall assembly",
    sentence: `Your ${label} wall is modelled at effective R-${rValue} and zone ${zone} is ${cold ? "a climate where winter is the design case" : "not one of the winter-design zones"}, but Aura stores no NBC 9.36 minimum for any zone, so this figure is an energy note and nothing here has been checked against a code.`,
    source: {
      kind: "code",
      module: "lib/design/materials.ts · WALL_R_VALUE",
      authority:
        "effective assembly R-values kept for the sheet's energy note; the zone reading is isColdZone, and no prescriptive minimum is stored anywhere in this repo",
    },
    standing: "not-modelled",
    measurement: {
      label: "WALL_R_VALUE · lib/design/materials.ts",
      value: rValue,
      unit: "r-value",
      target: null,
      targetLabel: null,
      withinTarget: null,
    },
  };
}

function roofRValue(document: BuilderDocument): GuidanceExplanation {
  return {
    topic: "roof-r-value",
    title: "Roof assembly",
    sentence: `Aura models no roof or floor assembly R-value at all — the table covers walls only — so there is nothing here to set against a zone ${document.spec.climateZone} target, and the honest reading is a blank rather than a plausible number.`,
    source: {
      kind: "code",
      module: "lib/design/materials.ts · WALL_R_VALUE",
      authority: "the table is walls only; no roof or floor assembly R exists in this repo",
    },
    standing: "not-modelled",
    measurement: null,
  };
}

// ---------------------------------------------------------------------------
// defaults from the intake answers
// ---------------------------------------------------------------------------

/** The project brief, exactly as `AuraProject` stores it. Aliased rather than
 *  redeclared so a new intake question cannot silently bypass this module. */
export type GuidanceIntake = AuraProject["requirements"];

export type GuidanceSuggestionId =
  | "climate-zone"
  | "wall-material"
  | "single-storey"
  | "footprint";

/** A suggestion in the spec's own vocabulary, so GQ03 can apply it through the
 *  same document APIs the buttons use instead of parsing a sentence. */
export type GuidanceSuggestionValue =
  | { field: "spec.climateZone"; zone: ClimateZone }
  | { field: "spec.material"; material: EcoMaterial }
  | { field: "spec.volumes[].storeys"; storeys: 1 | 2 }
  | {
      field: "spec.volumes[0]";
      widthFt: number;
      depthFt: number;
      floorAreaSqFt: number;
    };

export interface GuidanceSuggestion {
  id: GuidanceSuggestionId;
  /** What the suggestion changes, in the words the guided walk uses. */
  title: string;
  value: GuidanceSuggestionValue;
  /** How the value reads to a person. Presentation only. */
  display: string;
  /** ONE sentence: why this value, given these answers. */
  reason: string;
  source: GuidanceSource;
}

export interface GuidanceDefaults {
  suggestions: GuidanceSuggestion[];
  /**
   * Intake answers that were present and changed nothing here, each with the
   * reason. An answer a person took the trouble to give and that silently
   * vanishes is how a tool teaches people it is not listening; naming the
   * unused ones costs one line each.
   */
  unused: string[];
}

/**
 * Aura's own assumption about occupancy, named so it can be argued with.
 * No bylaw and no code says two people to a bedroom — it is the ordinary
 * reading of a household, and `defaultsFor` labels it as an assumption every
 * time it uses it.
 */
const PEOPLE_PER_BEDROOM = 2;

/** The area ladder the footprint search walks, in feet². The bounds are the
 *  hosted design service's own `total_sq_ft` limits as recorded in
 *  `lib/builder/toPlan.ts`; the step is half a room's worth of area, fine
 *  enough that the answer is not visibly quantised. */
const AREA_LADDER_MIN_SQ_FT = 400;
const AREA_LADDER_MAX_SQ_FT = 3200;
const AREA_LADDER_STEP_SQ_FT = 50;

/**
 * A throwaway single-volume home at a target area, used only to ask
 * `deriveProgram` how many bedrooms that area buys.
 *
 * It exists so this module never restates the area-to-bedroom brackets. The
 * proportion comes from `envelopeFor`, the one aspect-ratio rule in the repo,
 * so the probe is shaped like a home the plan engine would actually solve.
 */
function probeSpec(targetSqFt: number): HomeSpec {
  const [widthFt, depthFt] = envelopeFor(targetSqFt, 1);
  return {
    version: SPEC_VERSION,
    name: "probe",
    material: "sip",
    climateZone: "7A",
    volumes: [
      {
        id: "probe",
        name: "Probe",
        widthFt,
        depthFt,
        x: 0,
        z: 0,
        rotationDeg: 0,
        storeys: 1,
        wallHeightFt: 9.5,
        roof: { form: "gable", pitchDeg: 35, overhangFt: 1.5 },
        openings: [],
      },
    ],
    deck: null,
    siting: { frontFacesDeg: 180, slope: "flat" },
    notes: "",
  };
}

/** The smallest rung of the ladder whose derived program reaches `bedrooms`,
 *  or `null` when no rung does. Returns the probe's ACTUAL dimensions, not the
 *  nominal target — `envelopeFor` rounds to buildable 6" numbers. */
function footprintForBedrooms(
  bedrooms: number,
): { widthFt: number; depthFt: number; floorAreaSqFt: number } | null {
  for (
    let target = AREA_LADDER_MIN_SQ_FT;
    target <= AREA_LADDER_MAX_SQ_FT;
    target += AREA_LADDER_STEP_SQ_FT
  ) {
    const probe = probeSpec(target);
    if (deriveProgram(probe).bedrooms < bedrooms) continue;
    const volume = probe.volumes[0];
    return {
      widthFt: volume.widthFt,
      depthFt: volume.depthFt,
      floorAreaSqFt: totalFloorAreaSqFt(probe),
    };
  }
  return null;
}

const ALBERTA = "alberta";

/**
 * Partial spec suggestions derived from the intake answers, each with the
 * reason it was chosen.
 *
 * This function SUGGESTS. It writes nothing, applies nothing, and returns no
 * document — GQ03 owns the apply path and requires an explicit human
 * confirmation through the same APIs the buttons use. A guided default that
 * quietly rewrote the home would be the autonomous behaviour this product
 * refuses everywhere else.
 */
export function defaultsFor(intake: GuidanceIntake): GuidanceDefaults {
  const suggestions: GuidanceSuggestion[] = [];
  const unused: string[] = [];

  // --- climate zone ------------------------------------------------------
  const region = intake.location.region.trim().toLowerCase();
  if (region === ALBERTA) {
    suggestions.push({
      id: "climate-zone",
      title: "Climate zone",
      value: { field: "spec.climateZone", zone: "7A" },
      display: "Zone 7A",
      reason:
        "Aura's reference home and its whole material spine are written for zone 7A, so an Alberta project starts there — but Alberta also holds 7B and 8, Aura does not look your parcel's zone up, and this is the one default worth checking against your own address.",
      source: {
        kind: "assumption",
        module: "lib/builder/spec.ts · defaultSpec",
        authority:
          "the Aura reference build is set to 7A and lib/design/materials.ts writes its eco spine for it; no zone lookup exists in this product",
      },
    });
  } else if (intake.location.region.trim().length > 0) {
    unused.push(
      `Your region is ${intake.location.region.trim()}. Aura's defaults are researched for Alberta only, so no climate zone is suggested here.`,
    );
  }

  if (intake.location.municipality.trim().length > 0) {
    unused.push(
      `Your municipality is ${intake.location.municipality.trim()}. It reaches the cost model, but no bylaw, setback or minimum dwelling size is looked up from it anywhere in this product.`,
    );
  }

  // --- wall material -----------------------------------------------------
  if (intake.deliveryPreference === "manufactured") {
    suggestions.push({
      id: "wall-material",
      title: "Wall material",
      value: { field: "spec.material", material: "sip" },
      display: "Structural insulated panel",
      reason:
        "You asked for a manufactured home, and the panelised route Alberta actually has suppliers and a painless permit listing for is SIP — the honest lead time is 12 to 20 weeks from approved drawings and no software shortens a panel plant's queue.",
      source: {
        kind: "document",
        module: "docs/ALBERTA-PLAYBOOK.md · The build system",
        authority:
          "Insulspan CCMC 13016-R and two other Alberta SIP suppliers, with lead times recorded Aug 2026",
      },
    });
  }

  // --- storeys -----------------------------------------------------------
  if (intake.accessibility.length > 0) {
    suggestions.push({
      id: "single-storey",
      title: "Storeys",
      value: { field: "spec.volumes[].storeys", storeys: 1 },
      display: "One storey",
      reason:
        "You named an accessibility requirement, and one storey removes the stair rather than detailing around it — Aura's assumption, not a code requirement, and nothing here checks a design against a barrier-free standard.",
      source: {
        kind: "assumption",
        module: "lib/builder/guidance.ts · defaultsFor",
        authority:
          "Aura's own judgement; lib/design/layout.ts calls its 3'-6\" hall barrier-free-ready without claiming compliance, and no accessibility standard is modelled in this repo",
      },
    });
  }

  // --- footprint ---------------------------------------------------------
  const household = intake.householdSize;
  if (household === null || household <= 0) {
    unused.push(
      "Household size is not answered, so no footprint is suggested — the size of a home is the one thing worth getting from you rather than guessing.",
    );
  } else {
    const bedroomsWanted = Math.max(1, Math.ceil(household / PEOPLE_PER_BEDROOM));
    const footprint = footprintForBedrooms(bedroomsWanted);
    if (footprint === null) {
      unused.push(
        `A household of ${household} wants ${plural(bedroomsWanted, "bedroom")} on Aura's ${PEOPLE_PER_BEDROOM}-people-to-a-bedroom assumption, and no single-volume home up to ${sqFtText(AREA_LADDER_MAX_SQ_FT)} reaches that in the program rule — so no footprint is suggested and a second volume is the conversation to have.`,
      );
    } else {
      suggestions.push({
        id: "footprint",
        title: "Main volume",
        value: {
          field: "spec.volumes[0]",
          widthFt: footprint.widthFt,
          depthFt: footprint.depthFt,
          floorAreaSqFt: footprint.floorAreaSqFt,
        },
        display: `${formatFeetInchesWords(footprint.widthFt)} × ${formatFeetInchesWords(footprint.depthFt)} · ${sqFtText(footprint.floorAreaSqFt)}`,
        reason: `A household of ${household} wants about ${plural(bedroomsWanted, "bedroom")} on Aura's assumption of ${PEOPLE_PER_BEDROOM} people to a bedroom, and this is the smallest home Aura's own program rule reads that many bedrooms out of — the proportion is the plan engine's envelope rule, not a shape chosen here.`,
        source: {
          kind: "assumption",
          module: "lib/builder/toPlan.ts · deriveProgram, with lib/design/layout.ts · envelopeFor",
          authority:
            "the area-to-bedroom brackets and the 1.45 aspect ratio the plan engine already uses; the people-per-bedroom step is Aura's assumption and nothing more",
        },
      });
    }
  }

  // --- answers that reach other parts of the product, not this one -------
  if (intake.budgetCad.max !== null || intake.budgetCad.min !== null) {
    unused.push(
      "Your budget is not turned into a size here. createProjectBudget is the only place a dollar figure is derived in this product, and it prices a finished design rather than proposing one.",
    );
  }
  if (intake.landStatus === "searching") {
    unused.push(
      "You are still looking for land, so there is no parcel to fit this home to — the setback and buildable-envelope check has nothing to run against until there is.",
    );
  }
  if (intake.timeline.trim().length > 0) {
    unused.push(
      "Your timeline changes no default here. It belongs to scheduling and supplier lead times, not to the shape of the home.",
    );
  }
  if (intake.utilityGoals.length > 0) {
    unused.push(
      `You named ${plural(intake.utilityGoals.length, "utility goal")}. Aura's systems spine is fixed off-grid doctrine rather than a per-project choice, so none of them changes a default here.`,
    );
  }
  if (intake.cryptoComfort !== "avoid") {
    unused.push(
      "Your comfort with crypto changes nothing about the home. It belongs to the payment and proof moments only.",
    );
  }

  return { suggestions, unused };
}
