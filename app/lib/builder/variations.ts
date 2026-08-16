/* ===========================================================================
   VARIATIONS — several versions of one design, explored at once.

   THE HONESTY LINE, FIRST, BECAUSE IT IS THE WHOLE PRODUCT DECISION.

   Chaos ships Veras, which asks a diffusion model for design iterations and
   hands back IMAGES. This module does something different and must never be
   described as doing that one. There is no model here, no inference, no
   sampling, no seed, no picture. Every variant below is produced by moving
   NUMBERS in a `HomeSpec` — glazing, roof form, footprint proportion,
   storeys, orientation — and then pushing the result through
   `validateBuilderDocument`, the same gate a saved file, a share link and an
   imported project go through. What comes out is a document that opens in the
   editor, hashes with `hashBuilderDocument` and prices with
   `createProjectBudget`.

   That is a smaller claim and a larger product: a picture you cannot build is
   worth less than a design you can price.

   THREE RULES THIS FILE KEEPS.

   1. DETERMINISM IS A FEATURE, NOT AN ACCIDENT. No `Math.random`, no
      `Date.now`, no counters that survive a call. `variationSet` on the same
      document returns the same variants with the same ids, the same words and
      the same hashes, forever. Two people exploring the same home see the
      same options, and a screenshot of this strip is reproducible.

   2. NO FACT IS COMPUTED TWICE. Cost is `createProjectBudget` — the same call
      `/budget` and the live read-out make. Glazing is `modelledGlazingRatio`
      against `FDWR_MAX` — the same two values the read-out prints. Floor area
      is `totalFloorAreaSqFt`. This module owns no arithmetic that any other
      module also owns, because a second definition of one fact agrees on the
      day it is written and disagrees by the time somebody notices.

   3. A VARIANT THAT CANNOT BE MADE LEGALLY IS NAMED, NOT DROPPED. Every axis
      that fails to produce a valid document comes back as a `refusals` entry
      with the reason in words. A strip that silently shows four cards when it
      tried eight is a strip that lies by omission.

   WHAT IS NOT MODELLED, SAID OUT LOUD. Solar gain, daylight autonomy, heating
   load and energy use intensity are NOT computed anywhere in this codebase.
   An orientation variant therefore reports what MOVED — which compass
   direction each glazed wall now faces — and explicitly declines to report
   what it saved. The cost model prices the shell from footprint, floor area,
   storeys, window count and glazed area (`buildBom`, lib/design/materials.ts,
   where roof area is `footprint * 1.18` for every roof form). So a roof-form
   variant genuinely does not move the band, and this module says that is the
   model's limit rather than a claim that a flat roof and a saltbox cost the
   same.
   =========================================================================== */

import { FDWR_MAX } from "../design/materials";
import {
  scaleGraphOpenings,
  type BuildingGraph,
} from "./buildingGraph";
import {
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "./document";
import { wallRunFt, wallThicknessFt } from "./geometry";
import { modelledGraphGlazingRatio, summarizeBuildingGraph } from "./graphGeometry";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type BudgetRange,
  type ProjectBudgetScenario,
} from "./projectBudget";
import {
  glazedAreaSqFt,
  totalFloorAreaSqFt,
  type HomeSpec,
  type Opening,
  type RoofForm,
  type Volume,
  type Wall,
} from "./spec";
import { modelledGlazingRatio } from "./toPlan";

/** What this engine is, in one machine-readable token. Rendered by the strip
 *  and asserted by the spec so the word can never quietly become "ai". */
export const VARIATION_ENGINE = "parametric-deterministic" as const;

export type VariationAxis =
  | "glazing"
  | "orientation"
  | "roof"
  | "proportion"
  | "storeys";

export const AXIS_LABELS: Readonly<Record<VariationAxis, string>> = {
  glazing: "Glazing",
  orientation: "Orientation",
  roof: "Roof form",
  proportion: "Footprint proportion",
  storeys: "Storeys",
};

export interface VariationDelta {
  /** what moved, in words, with both values in it */
  sentence: string;
}

export interface VariationCost {
  currency: "CAD";
  total: BudgetRange;
  /** midpoint minus the basis midpoint; 0 when the cost model cannot tell
   *  this variant apart from the design it came from. */
  midDeltaCad: number;
  budgetHash: `0x${string}`;
  /**
   * Limits of the cost model that apply to THIS variant.
   *
   * DERIVED FROM WHAT ACTUALLY MOVED, never hand-written per axis — a note
   * an author types beside a card is a claim nothing checks, and this repo
   * has shipped two of those already. Each entry below is emitted by a
   * condition measured against the basis budget and the two specs.
   */
  blindSpots: string[];
}

export interface DesignVariation {
  /** stable and derived only from the axis and the step — never a counter */
  id: string;
  title: string;
  axis: VariationAxis;
  /** the whole thing, already through `validateBuilderDocument` */
  document: BuilderDocument;
  designHash: `0x${string}`;
  areaSqFt: number;
  glazedAreaSqFt: number;
  glazingRatio: number;
  /** true when `glazingRatio` exceeds `FDWR_MAX`, by the same comparison the
   *  live read-out makes */
  overCeiling: boolean;
  /** the glazing sentence, in the shape the catalogue's over-ceiling plans
   *  use. Present on every variant — under the ceiling is also a fact. */
  glazingSentence: string;
  deltas: VariationDelta[];
  cost: VariationCost;
}

export interface VariationRefusal {
  axis: VariationAxis;
  /** why this axis produced nothing, in words a person can act on */
  reason: string;
}

export interface VariationBasis {
  designHash: `0x${string}`;
  areaSqFt: number;
  glazedAreaSqFt: number;
  glazingRatio: number;
  overCeiling: boolean;
  glazingSentence: string;
  total: BudgetRange;
}

export interface VariationSet {
  engine: typeof VARIATION_ENGINE;
  /** null when the design cannot be varied at all — the reason is in
   *  `unavailable`. */
  basis: VariationBasis | null;
  variations: DesignVariation[];
  refusals: VariationRefusal[];
  /** Set when the whole strip is unavailable rather than individual axes. */
  unavailable: string | null;
}

export interface VariationInput {
  document: BuilderDocument;
  scenario?: ProjectBudgetScenario;
  region?: string;
  municipality?: string;
  budgetCapCad?: number | null;
}

/* ------------------------------------------------------------------ limits
   Shared with `components/builder/edits.ts` in intent, restated here in the
   two dimensions this module can shrink. A variant may never produce an
   opening smaller than something a person could have drawn by hand. */
const MIN_OPENING_FT = 1;
/** A reveal kept at the head of a wall so glass never meets the eave line. */
const HEAD_CLEARANCE_FT = 0.25;

/** Quantise to 1e-4 ft — the same grain `edits.ts` and the share codec use, so
 *  a variant round-trips through a link without changing by a thousandth. */
const q = (value: number): number => Math.round(value * 1e4) / 1e4;

/* ---------------------------------------------------------------- percents

   The disclosure sentence prints a ratio and a ceiling in the same breath, so
   the two must be printed at a precision that cannot make a true statement
   read as a false one. At 0.2203 a one-decimal format prints "22.0% — above
   the 22.0% ceiling", which is arithmetic nonsense on the page even though
   the comparison behind it is correct.

   So both numbers are formatted at the SMALLEST precision that tells them
   apart, and the comparison itself stays exactly the one the live read-out
   makes (`ratio > FDWR_MAX`, raw). The formatter never decides the verdict. */
export function comparablePercents(
  ratio: number,
  ceiling: number,
): { ratioText: string; ceilingText: string } {
  for (let decimals = 0; decimals <= 3; decimals += 1) {
    const ratioText = `${(ratio * 100).toFixed(decimals)}%`;
    const ceilingText = `${(ceiling * 100).toFixed(decimals)}%`;
    if (ratioText !== ceilingText || ratio === ceiling) {
      return { ratioText, ceilingText };
    }
  }
  return { ratioText: `${(ratio * 100).toFixed(3)}%`, ceilingText: `${(ceiling * 100).toFixed(3)}%` };
}

/**
 * The glazing sentence, in the shape the catalogue's over-ceiling plans use:
 * name the ceiling, state the ratio, name the compliance path, say what the
 * glass costs in a zone 7A winter and what pays for it.
 */
export function glazingDisclosure(ratio: number): { sentence: string; over: boolean } {
  const over = ratio > FDWR_MAX;
  const { ratioText, ceilingText } = comparablePercents(ratio, FDWR_MAX);
  if (!over) {
    return {
      over,
      sentence:
        `Modelled glazing is ${ratioText} of the modelled wall area — under the ${ceilingText} ` +
        `NBC 9.36 prescriptive ceiling. A comparison, not a code check.`,
    };
  }
  return {
    over,
    sentence:
      `Modelled glazing is ${ratioText} of the modelled wall area — above the ${ceilingText} ` +
      `NBC 9.36 prescriptive ceiling. The compliance route is the trade-off path or a full ` +
      `performance model; the honest cost is winter heat loss through the extra glass in a ` +
      `zone 7A winter, and the honest payment is the solar gain the same glass collects between ` +
      `October and March. A comparison, not a code check.`,
  };
}

/* ------------------------------------------------------------- geometry aid */

/** The primary volume: biggest footprint, first wins a tie. Stable for a
 *  given spec, which is what makes every variant id stable. */
function primaryVolume(spec: HomeSpec): Volume | null {
  let best: Volume | null = null;
  for (const volume of spec.volumes) {
    if (best === null || volume.widthFt * volume.depthFt > best.widthFt * best.depthFt) {
      best = volume;
    }
  }
  return best;
}

const WALL_NAMES: Readonly<Record<Wall, string>> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
};

/** The compass direction a wall of a rotated volume actually faces. The wall
 *  letters are the volume's OWN frame (spec.ts), so a rotated home's "south"
 *  wall may look at the east. This is the only orientation fact this module
 *  reports, because it is the only one the codebase models. */
export function facingOf(wall: Wall, rotationDeg: number): string {
  const base: Record<Wall, number> = { n: 0, e: 90, s: 180, w: 270 };
  const bearing = ((base[wall] + rotationDeg) % 360 + 360) % 360;
  const points = [
    "north", "north-east", "east", "south-east",
    "south", "south-west", "west", "north-west",
  ];
  return points[Math.round(bearing / 45) % 8];
}

/** Every check the plan catalogue asserts on a published plan, run against a
 *  candidate. Returns the first problem in words, or null. */
export function openingProblems(spec: HomeSpec): string | null {
  const thickness = wallThicknessFt(spec.material);
  for (const volume of spec.volumes) {
    const head = volume.wallHeightFt * volume.storeys;
    const byWall = new Map<Wall, Opening[]>();
    for (const opening of volume.openings) {
      const run = wallRunFt(volume, opening.wall, thickness);
      if (opening.widthFt < MIN_OPENING_FT || opening.heightFt < MIN_OPENING_FT) {
        return `${volume.name}: opening ${opening.id} would be smaller than ${MIN_OPENING_FT} ft.`;
      }
      if (opening.offsetFt < -1e-9 || opening.offsetFt + opening.widthFt > run + 1e-9) {
        return `${volume.name}: opening ${opening.id} would leave its ${WALL_NAMES[opening.wall]} wall.`;
      }
      if (opening.sillFt < -1e-9 || opening.sillFt + opening.heightFt > head + 1e-9) {
        return `${volume.name}: opening ${opening.id} would rise past the wall head.`;
      }
      byWall.set(opening.wall, [...(byWall.get(opening.wall) ?? []), opening]);
    }
    let clash: string | null = null;
    byWall.forEach((list: Opening[], wall: Wall) => {
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          const overlapX =
            Math.min(a.offsetFt + a.widthFt, b.offsetFt + b.widthFt) -
            Math.max(a.offsetFt, b.offsetFt);
          const overlapY =
            Math.min(a.sillFt + a.heightFt, b.sillFt + b.heightFt) -
            Math.max(a.sillFt, b.sillFt);
          if (overlapX > 1e-9 && overlapY > 1e-9 && clash === null) {
            clash = `${volume.name}: openings ${a.id} and ${b.id} would overlap on the ${WALL_NAMES[wall]} wall.`;
          }
        }
      }
    });
    if (clash !== null) return clash;
  }
  return null;
}

/* --------------------------------------------------------------- the axes */

/**
 * Scale a wall's horizontal geometry with its own run.
 *
 * Offsets AND widths scale by the same factor, which is what makes this safe:
 * gaps scale too, so a shrinking wall cannot push two openings into each other
 * and a growing one cannot leave a hole at the end. Ordering is preserved
 * exactly.
 */
function rescaleWalls(volume: Volume, thicknessFt: number, next: Volume): Opening[] {
  return volume.openings.map((opening) => {
    const before = wallRunFt(volume, opening.wall, thicknessFt);
    const after = wallRunFt(next, opening.wall, thicknessFt);
    if (before <= 0 || after <= 0 || before === after) return opening;
    const factor = after / before;
    return {
      ...opening,
      widthFt: q(opening.widthFt * factor),
      offsetFt: q(opening.offsetFt * factor),
    };
  });
}

/** The free horizontal interval an opening may grow into on its own wall:
 *  bounded by the wall ends and by neighbours whose VERTICAL span overlaps it.
 *  Two windows stacked on a two-storey wall do not constrain each other, which
 *  is the distinction `plan-catalog.spec.ts` had to learn the hard way. */
function freeInterval(
  volume: Volume,
  opening: Opening,
  runFt: number,
): { from: number; to: number } {
  let from = 0;
  let to = runFt;
  for (const other of volume.openings) {
    if (other.id === opening.id || other.wall !== opening.wall) continue;
    const overlapY =
      Math.min(other.sillFt + other.heightFt, opening.sillFt + opening.heightFt) -
      Math.max(other.sillFt, opening.sillFt);
    if (overlapY <= 1e-9) continue;
    const otherRight = other.offsetFt + other.widthFt;
    if (otherRight <= opening.offsetFt + 1e-9) from = Math.max(from, otherRight);
    else if (other.offsetFt >= opening.offsetFt + opening.widthFt - 1e-9) to = Math.min(to, other.offsetFt);
  }
  return { from, to };
}

/** Grow or shrink every non-door opening about its own centre. Growth is
 *  capped by the free interval and by the wall head; shrinking is capped by
 *  `MIN_OPENING_FT`. Doors are never touched — a door is circulation, not
 *  glass, and `glazedAreaSqFt` already excludes it. */
function scaleGlazing(spec: HomeSpec, factor: number): HomeSpec {
  const thickness = wallThicknessFt(spec.material);
  return {
    ...spec,
    volumes: spec.volumes.map((volume) => {
      const head = volume.wallHeightFt * volume.storeys;
      return {
        ...volume,
        openings: volume.openings.map((opening) => {
          if (opening.kind === "door") return opening;
          const run = wallRunFt(volume, opening.wall, thickness);
          const room = freeInterval(volume, opening, run);
          const centre = opening.offsetFt + opening.widthFt / 2;
          const widthCap = 2 * Math.min(centre - room.from, room.to - centre);
          const width = Math.max(
            MIN_OPENING_FT,
            Math.min(opening.widthFt * factor, Math.max(MIN_OPENING_FT, widthCap)),
          );
          const heightCap = Math.max(MIN_OPENING_FT, head - opening.sillFt - HEAD_CLEARANCE_FT);
          const height = Math.max(
            MIN_OPENING_FT,
            Math.min(opening.heightFt * factor, heightCap),
          );
          return {
            ...opening,
            widthFt: q(width),
            heightFt: q(height),
            offsetFt: q(Math.max(0, Math.min(centre - width / 2, run - width))),
          };
        }),
      };
    }),
  };
}

/** Turn the whole home on the site. Wall letters are volume-local, so nothing
 *  about any wall changes — only what the sun sees. Positions rotate with the
 *  masses so an L-plan stays an L-plan. */
function rotateHome(spec: HomeSpec, deg: number): HomeSpec {
  const radians = (deg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    ...spec,
    volumes: spec.volumes.map((volume) => ({
      ...volume,
      x: q(volume.x * cos - volume.z * sin),
      z: q(volume.x * sin + volume.z * cos),
      rotationDeg: q(((volume.rotationDeg + deg) % 360 + 360) % 360),
    })),
    siting: {
      ...spec.siting,
      frontFacesDeg: q(((spec.siting.frontFacesDeg + deg) % 360 + 360) % 360),
    },
  };
}

/** Roof forms in a fixed order, so "the next two forms" never depends on when
 *  the function was called. */
const ROOF_ORDER: readonly RoofForm[] = ["gable", "shed", "saltbox", "a-frame", "flat"];

const ROOF_NOTES: Readonly<Record<RoofForm, string>> = {
  gable: "two slopes off a central ridge — the default small-home roof",
  shed: "one plane, one direction: cheapest to frame and the best solar deck",
  saltbox: "a gable carried further down one side, which buys a sheltered elevation",
  "a-frame": "the slope is the wall, meeting near the ground",
  flat: "near-flat with a drainage fall and a parapet detail",
};

/** Re-proportion the primary volume at constant footprint area: width × k,
 *  depth ÷ k. Openings rescale with their own walls. */
function reproportion(spec: HomeSpec, volumeId: string, k: number): HomeSpec {
  const thickness = wallThicknessFt(spec.material);
  return {
    ...spec,
    volumes: spec.volumes.map((volume) => {
      if (volume.id !== volumeId) return volume;
      const next: Volume = {
        ...volume,
        widthFt: q(volume.widthFt * k),
        depthFt: q(volume.depthFt / k),
      };
      return { ...next, openings: rescaleWalls(volume, thickness, next) };
    }),
  };
}

/* ------------------------------------------------------------- the pipeline */

interface Candidate {
  id: string;
  title: string;
  axis: VariationAxis;
  spec: HomeSpec;
  /** what changed, computed against the source spec */
  describe: (source: HomeSpec, next: HomeSpec) => string[];
}

/* ------------------------------------------------------- the model's limits

   Three sentences, and each one is EMITTED BY A MEASUREMENT rather than typed
   beside a card. `buildBom` (lib/design/materials.ts) reads exactly eight
   things: width, depth, gross floor area, window COUNT, glazed area, material,
   systems and storeys. Everything below follows from that list and from two
   lines in that file:

     wall_area = perimeter × WALL_HEIGHT_FT × storeys − glazing_sq_ft
     roof_area = footprint × 1.18

   The second is why a roof-form change cannot move the band. The first,
   together with windows being priced PER UNIT, is why enlarging a window that
   already exists takes shell area away and adds no window line — so the band
   goes DOWN. That is the model's resolution, not a discovery about glass, and
   a strip that printed the number without the sentence would be teaching
   somebody something false. */

export const COST_MODEL_UNMOVED =
  "The band did not move. The cost model reads footprint, floor area, storeys, window count, glazed area and material — and nothing this variant changed is on that list. Unchanged here means unmeasured, not equal.";

export const ROOF_FORM_UNPRICED =
  "Roof area is footprint × 1.18 for every roof form in the cost model (buildBom, lib/design/materials.ts). It cannot price a saltbox differently from a flat roof, and this codebase does not model snow load, framing complexity or the parapet a flat roof needs.";

export const WINDOW_UNIT_PRICING =
  "Read this band with one limit in view: windows are priced per UNIT ($900–1,800 each) while glazed area is SUBTRACTED from the wall priced per square foot. Resizing an opening therefore takes shell away and adds no window cost, so the band moves in the direction you see. The price of a larger window is not modelled anywhere in this codebase.";

export const NOT_MODELLED_ENERGY =
  "Solar gain, daylight autonomy, heating load and energy use intensity are not modelled by this codebase. What changed here is which compass direction each glazed wall looks at; what that is worth in a zone 7A winter is a question for an energy advisor, and the strip will not answer it.";

/** The window count `buildBom` is handed — doors excluded, exactly as
 *  `designMeasures` in projectBudget.ts counts them. */
const windowCount = (spec: HomeSpec): number =>
  spec.volumes.reduce(
    (sum, volume) => sum + volume.openings.filter((opening) => opening.kind !== "door").length,
    0,
  );

function blindSpotsFor(
  axis: VariationAxis,
  source: HomeSpec,
  next: HomeSpec,
  basisTotal: BudgetRange,
  total: BudgetRange,
): string[] {
  const notes: string[] = [];
  const unmoved =
    total.low === basisTotal.low && total.mid === basisTotal.mid && total.high === basisTotal.high;
  if (unmoved) notes.push(COST_MODEL_UNMOVED);
  if (axis === "roof") notes.push(ROOF_FORM_UNPRICED);
  if (axis === "orientation") notes.push(NOT_MODELLED_ENERGY);
  if (
    Math.abs(glazedAreaSqFt(next) - glazedAreaSqFt(source)) > 1e-6 &&
    windowCount(next) === windowCount(source)
  ) {
    notes.push(WINDOW_UNIT_PRICING);
  }
  return notes;
}

const areaText = (value: number): string =>
  `${Math.round(value).toLocaleString("en-CA")} sq ft`;

function glazingDelta(source: HomeSpec, next: HomeSpec): string {
  const before = glazedAreaSqFt(source);
  const after = glazedAreaSqFt(next);
  const direction = after > before ? "up" : after < before ? "down" : "unchanged at";
  return `Glazed area ${direction} ${areaText(before)} → ${areaText(after)}.`;
}

function orientationDelta(source: HomeSpec, next: HomeSpec): string[] {
  const lines: string[] = [];
  for (const volume of source.volumes) {
    const after = next.volumes.find((candidate) => candidate.id === volume.id);
    if (!after) continue;
    const glazed = volume.openings.filter((opening) => opening.kind !== "door");
    const walls = Array.from(new Set(glazed.map((opening) => opening.wall)));
    for (const wall of walls) {
      lines.push(
        `${volume.name}: the ${WALL_NAMES[wall]} glazing now faces ` +
          `${facingOf(wall, after.rotationDeg)} instead of ${facingOf(wall, volume.rotationDeg)}.`,
      );
    }
  }
  return lines;
}

function candidatesFor(spec: HomeSpec): Candidate[] {
  const primary = primaryVolume(spec);
  if (!primary) return [];
  const list: Candidate[] = [];

  /* --- glazing ---------------------------------------------------------- */
  list.push({
    id: "glazing-more",
    title: "More glass",
    axis: "glazing",
    spec: scaleGlazing(spec, 1.35),
    describe: (source, next) => [
      glazingDelta(source, next),
      "Every window and glazing wall grows about its own centre, stopping at its neighbours and at the wall head.",
    ],
  });
  list.push({
    id: "glazing-less",
    title: "Less glass",
    axis: "glazing",
    spec: scaleGlazing(spec, 0.7),
    describe: (source, next) => [
      glazingDelta(source, next),
      "Smaller openings cost less to buy and lose less heat in January; they also collect less of the sun that pays for them.",
    ],
  });

  /* --- orientation ------------------------------------------------------ */
  list.push({
    id: "orientation-quarter-turn",
    title: "Quarter turn",
    axis: "orientation",
    spec: rotateHome(spec, 90),
    describe: (source, next) => orientationDelta(source, next),
  });
  list.push({
    id: "orientation-half-turn",
    title: "Half turn",
    axis: "orientation",
    spec: rotateHome(spec, 180),
    describe: (source, next) => orientationDelta(source, next),
  });

  /* --- roof form -------------------------------------------------------- */
  const otherForms = ROOF_ORDER.filter((form) => form !== primary.roof.form).slice(0, 2);
  for (const form of otherForms) {
    list.push({
      id: `roof-${form}`,
      title: `${form === "a-frame" ? "A-frame" : form.charAt(0).toUpperCase() + form.slice(1)} roof`,
      axis: "roof",
      spec: {
        ...spec,
        volumes: spec.volumes.map((volume) =>
          volume.id === primary.id ? { ...volume, roof: { ...volume.roof, form } } : volume,
        ),
      },
      describe: () => [
        `${primary.name}: ${primary.roof.form} → ${form} — ${ROOF_NOTES[form]}.`,
      ],
    });
  }

  /* --- footprint proportion --------------------------------------------- */
  list.push({
    id: "proportion-long",
    title: "Longer, shallower",
    axis: "proportion",
    spec: reproportion(spec, primary.id, 1.25),
    describe: (source, next) => {
      const before = source.volumes.find((volume) => volume.id === primary.id)!;
      const after = next.volumes.find((volume) => volume.id === primary.id)!;
      return [
        `${primary.name}: ${before.widthFt.toFixed(1)} × ${before.depthFt.toFixed(1)} ft → ` +
          `${after.widthFt.toFixed(1)} × ${after.depthFt.toFixed(1)} ft, at the same footprint area.`,
        "More perimeter for the same floor: more envelope to build and to heat, and more south wall to glaze.",
        glazingDelta(source, next),
      ];
    },
  });
  list.push({
    id: "proportion-compact",
    title: "Squarer, deeper",
    axis: "proportion",
    spec: reproportion(spec, primary.id, 0.8),
    describe: (source, next) => {
      const before = source.volumes.find((volume) => volume.id === primary.id)!;
      const after = next.volumes.find((volume) => volume.id === primary.id)!;
      return [
        `${primary.name}: ${before.widthFt.toFixed(1)} × ${before.depthFt.toFixed(1)} ft → ` +
          `${after.widthFt.toFixed(1)} × ${after.depthFt.toFixed(1)} ft, at the same footprint area.`,
        "Less perimeter for the same floor — the cheapest shape to heat in zone 7A, and the hardest to daylight deeply.",
        glazingDelta(source, next),
      ];
    },
  });

  /* --- storeys ---------------------------------------------------------- */
  if (primary.storeys === 1) {
    list.push({
      id: "storeys-two",
      title: "Second storey",
      axis: "storeys",
      spec: {
        ...spec,
        volumes: spec.volumes.map((volume) =>
          volume.id === primary.id ? { ...volume, storeys: 2 as const } : volume,
        ),
      },
      describe: (source, next) => [
        `${primary.name}: one storey → two, on the same ground.`,
        `Floor area ${areaText(totalFloorAreaSqFt(source))} → ${areaText(totalFloorAreaSqFt(next))} with no more footprint.`,
      ],
    });
  } else {
    list.push({
      id: "storeys-one",
      title: "Single storey",
      axis: "storeys",
      spec: {
        ...spec,
        volumes: spec.volumes.map((volume) =>
          volume.id === primary.id ? { ...volume, storeys: 1 as const } : volume,
        ),
      },
      describe: (source, next) => [
        `${primary.name}: two storeys → one, on the same ground.`,
        `Floor area ${areaText(totalFloorAreaSqFt(source))} → ${areaText(totalFloorAreaSqFt(next))}.`,
      ],
    });
  }

  return list;
}

const withGraph = (document: BuilderDocument, graph: BuildingGraph): BuilderDocument => {
  if (document.geometry.kind !== "building-graph") return document;
  return { ...document, geometry: { ...document.geometry, graph } };
};

const graphWindowCount = (graph: BuildingGraph): number =>
  graph.storeys.reduce(
    (sum, storey) =>
      sum +
      storey.walls.reduce(
        (wallSum, wall) =>
          wallSum + wall.openings.filter((opening) => opening.kind !== "door").length,
        0,
      ),
    0,
  );

const GRAPH_AXIS_REFUSALS: readonly VariationRefusal[] = [
  {
    axis: "orientation",
    reason:
      "Orientation rotates volume.rotationDeg on the legacy spec. This project is planar graph " +
      "geometry — turn the house by moving vertices on the plan.",
  },
  {
    axis: "roof",
    reason:
      "Roof form writes spec.volumes[].roof. Graph roofs are explicit roof zones, and this strip " +
      "does not yet swap those.",
  },
  {
    axis: "proportion",
    reason:
      "Proportion resizes a rectangular volume at constant area. A graph footprint is a polygon — " +
      "stretching it through that rule would invent a rectangle the walls do not have.",
  },
  {
    axis: "storeys",
    reason:
      "Storeys flip spec.volumes[].storeys. Adding a graph storey is duplicateGraphStorey, which " +
      "this strip does not call yet.",
  },
];

function variationSetFromGraph(
  document: BuilderDocument,
  price: (candidate: BuilderDocument) => ReturnType<typeof createProjectBudget>,
): VariationSet {
  if (document.geometry.kind !== "building-graph") {
    return {
      engine: VARIATION_ENGINE,
      basis: null,
      variations: [],
      refusals: [],
      unavailable: "variationSetFromGraph was asked to read a document that is not planar graph geometry.",
    };
  }

  let basisBudget;
  try {
    basisBudget = price(document);
  } catch (error) {
    return {
      engine: VARIATION_ENGINE,
      basis: null,
      variations: [],
      refusals: [],
      unavailable: `This design cannot be priced, so no variant can carry a cost: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const graph = document.geometry.graph;
  const summary = summarizeBuildingGraph(graph);
  const basisRatio = modelledGraphGlazingRatio(graph);
  const basisGlazing = glazingDisclosure(basisRatio);
  const basis: VariationBasis = {
    designHash: hashBuilderDocument(document),
    areaSqFt: summary.totalFloorAreaSqFt,
    glazedAreaSqFt: summary.glazedAreaSqFt,
    glazingRatio: basisRatio,
    overCeiling: basisGlazing.over,
    glazingSentence: basisGlazing.sentence,
    total: basisBudget.total,
  };

  const variations: DesignVariation[] = [];
  const refusals: VariationRefusal[] = [...GRAPH_AXIS_REFUSALS];

  const glassSteps: Array<{ id: string; title: string; factor: number; note: string }> = [
    {
      id: "glazing-more",
      title: "More glass",
      factor: 1.35,
      note: "Every glazed opening grows on its host wall, stopping at its neighbours and at the storey head. Doors stay put.",
    },
    {
      id: "glazing-less",
      title: "Less glass",
      factor: 0.7,
      note: "Smaller openings cost less to buy and lose less heat in January; they also collect less of the sun that pays for them.",
    },
  ];

  for (const step of glassSteps) {
    const scaled = scaleGraphOpenings(graph, step.factor);
    if (!scaled.ok) {
      refusals.push({
        axis: "glazing",
        reason: `${step.title} was not offered — ${scaled.problem}`,
      });
      continue;
    }
    const candidate = validateBuilderDocument(withGraph(document, scaled.graph));
    if (!candidate.ok) {
      refusals.push({
        axis: "glazing",
        reason: `${step.title} was not offered — it does not validate as a builder document: ${candidate.problem}`,
      });
      continue;
    }
    const variantHash = hashBuilderDocument(candidate.document);
    if (variantHash === basis.designHash) {
      refusals.push({
        axis: "glazing",
        reason: `${step.title} was not offered — it produced the design you already have.`,
      });
      continue;
    }
    let budget;
    try {
      budget = price(candidate.document);
    } catch (error) {
      refusals.push({
        axis: "glazing",
        reason: `${step.title} was not offered — it could not be costed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      continue;
    }
    const nextGraph =
      candidate.document.geometry.kind === "building-graph"
        ? candidate.document.geometry.graph
        : null;
    if (!nextGraph) {
      refusals.push({
        axis: "glazing",
        reason: `${step.title} was not offered — the candidate left planar graph geometry.`,
      });
      continue;
    }
    const nextSummary = summarizeBuildingGraph(nextGraph);
    const ratio = modelledGraphGlazingRatio(nextGraph);
    const glazing = glazingDisclosure(ratio);
    const notes: string[] = [];
    const unmoved =
      budget.total.low === basisBudget.total.low &&
      budget.total.mid === basisBudget.total.mid &&
      budget.total.high === basisBudget.total.high;
    if (unmoved) notes.push(COST_MODEL_UNMOVED);
    if (
      Math.abs(nextSummary.glazedAreaSqFt - summary.glazedAreaSqFt) > 1e-6 &&
      graphWindowCount(nextGraph) === graphWindowCount(graph)
    ) {
      notes.push(WINDOW_UNIT_PRICING);
    }
    variations.push({
      id: step.id,
      title: step.title,
      axis: "glazing",
      document: candidate.document,
      designHash: variantHash,
      areaSqFt: nextSummary.totalFloorAreaSqFt,
      glazedAreaSqFt: nextSummary.glazedAreaSqFt,
      glazingRatio: ratio,
      overCeiling: glazing.over,
      glazingSentence: glazing.sentence,
      deltas: [
        {
          sentence: `Glazed area ${
            nextSummary.glazedAreaSqFt > summary.glazedAreaSqFt
              ? "up"
              : nextSummary.glazedAreaSqFt < summary.glazedAreaSqFt
                ? "down"
                : "unchanged at"
          } ${areaText(summary.glazedAreaSqFt)} → ${areaText(nextSummary.glazedAreaSqFt)}.`,
        },
        { sentence: step.note },
      ],
      cost: {
        currency: "CAD",
        total: budget.total,
        midDeltaCad: budget.total.mid - basisBudget.total.mid,
        budgetHash: budget.budgetHash,
        blindSpots: notes,
      },
    });
  }

  return { engine: VARIATION_ENGINE, basis, variations, refusals, unavailable: null };
}

/**
 * The variation set for a document. Pure, deterministic, and complete: every
 * axis that produced nothing is in `refusals` with its reason.
 */
export function variationSet(input: VariationInput): VariationSet {
  const scenario = input.scenario ?? defaultProjectBudgetScenario();
  const region = input.region ?? "Alberta";
  const municipality = input.municipality ?? "";
  const budgetCapCad = input.budgetCapCad ?? null;

  const checked = validateBuilderDocument(input.document);
  if (!checked.ok) {
    return {
      engine: VARIATION_ENGINE,
      basis: null,
      variations: [],
      refusals: [],
      unavailable: `This design cannot be varied: ${checked.problem}`,
    };
  }
  const document = checked.document;

  const price = (candidate: BuilderDocument) =>
    createProjectBudget({ document: candidate, scenario, region, municipality, budgetCapCad });

  if (document.geometry.kind === "building-graph") {
    return variationSetFromGraph(document, price);
  }

  let basisBudget;
  try {
    basisBudget = price(document);
  } catch (error) {
    return {
      engine: VARIATION_ENGINE,
      basis: null,
      variations: [],
      refusals: [],
      unavailable: `This design cannot be priced, so no variant can carry a cost: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const basisRatio = modelledGlazingRatio(document.spec);
  const basisGlazing = glazingDisclosure(basisRatio);
  const basis: VariationBasis = {
    designHash: hashBuilderDocument(document),
    areaSqFt: totalFloorAreaSqFt(document.spec),
    glazedAreaSqFt: glazedAreaSqFt(document.spec),
    glazingRatio: basisRatio,
    overCeiling: basisGlazing.over,
    glazingSentence: basisGlazing.sentence,
    total: basisBudget.total,
  };

  const variations: DesignVariation[] = [];
  const refusals: VariationRefusal[] = [];

  for (const candidate of candidatesFor(document.spec)) {
    const problem = openingProblems(candidate.spec);
    if (problem) {
      refusals.push({ axis: candidate.axis, reason: `${candidate.title} was not offered — ${problem}` });
      continue;
    }
    const validated = validateBuilderDocument({ ...document, spec: candidate.spec });
    if (!validated.ok) {
      refusals.push({
        axis: candidate.axis,
        reason: `${candidate.title} was not offered — it does not validate as a builder document: ${validated.problem}`,
      });
      continue;
    }
    const variantDocument = validated.document;
    const variantHash = hashBuilderDocument(variantDocument);
    if (variantHash === basis.designHash) {
      refusals.push({
        axis: candidate.axis,
        reason: `${candidate.title} was not offered — it produced the design you already have.`,
      });
      continue;
    }
    let budget;
    try {
      budget = price(variantDocument);
    } catch (error) {
      refusals.push({
        axis: candidate.axis,
        reason: `${candidate.title} was not offered — it could not be costed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      continue;
    }
    const ratio = modelledGlazingRatio(variantDocument.spec);
    const glazing = glazingDisclosure(ratio);
    variations.push({
      id: candidate.id,
      title: candidate.title,
      axis: candidate.axis,
      document: variantDocument,
      designHash: variantHash,
      areaSqFt: totalFloorAreaSqFt(variantDocument.spec),
      glazedAreaSqFt: glazedAreaSqFt(variantDocument.spec),
      glazingRatio: ratio,
      overCeiling: glazing.over,
      glazingSentence: glazing.sentence,
      deltas: candidate
        .describe(document.spec, variantDocument.spec)
        .map((sentence) => ({ sentence })),
      cost: {
        currency: "CAD",
        total: budget.total,
        midDeltaCad: budget.total.mid - basisBudget.total.mid,
        budgetHash: budget.budgetHash,
        blindSpots: blindSpotsFor(
          candidate.axis,
          document.spec,
          variantDocument.spec,
          basisBudget.total,
          budget.total,
        ),
      },
    });
  }

  return { engine: VARIATION_ENGINE, basis, variations, refusals, unavailable: null };
}

/* ------------------------------------------------------------------ apply */

/**
 * The history label for applying a variation.
 *
 * The editor's `commit` coalesces consecutive edits that share a label — that
 * rule lives in BuilderApp and is deliberately NOT restated here. What this
 * function guarantees is the input that rule needs: a label that never repeats,
 * so applying two variations in a row is two undo steps rather than one, and
 * applying the same one twice is still two. `sequence` is a UI-only counter,
 * never persisted, and nothing about the geometry or the export reads it.
 */
export function variationApplyLabel(id: string, sequence: number): string {
  return `variation:apply:${id}:${sequence}`;
}

/** The sentence the strip announces when a variation is applied. Applying is
 *  never silent, and the announcement names what happened and how to leave. */
export function variationAnnouncement(variation: DesignVariation): string {
  return (
    `Applied ${variation.title} — ${AXIS_LABELS[variation.axis].toLowerCase()}. ` +
    `Design ${variation.designHash.slice(0, 10)}, ${areaText(variation.areaSqFt)}. ` +
    `One undo step returns the design you had.`
  );
}

export type ApplyVariationResult =
  | {
      ok: true;
      spec: HomeSpec;
      /** Present when the variant is planar graph geometry. The recovery spec
       *  is left unchanged; the editor must take this through `editGraph`. */
      graph?: BuildingGraph;
      label: string;
      announcement: string;
    }
  | { ok: false; problem: string };

/**
 * Everything the editor needs to apply one variation, from the same set the
 * person is looking at. The spec — not the document — is what crosses back,
 * because the editor's `edit` path already reconciles partitions, finishes,
 * fixtures and comfort targets against a changed spec inside ONE commit.
 * Handing over a whole document would bypass that reconciliation and is how a
 * fixture ends up floating outside a shrunken volume.
 */
export function applyVariation(
  set: VariationSet,
  id: string,
  sequence: number,
): ApplyVariationResult {
  const variation = set.variations.find((candidate) => candidate.id === id);
  if (!variation) return { ok: false, problem: `No variation ${JSON.stringify(id)} is on offer.` };
  const graph =
    variation.document.geometry.kind === "building-graph"
      ? variation.document.geometry.graph
      : undefined;
  return {
    ok: true,
    spec: variation.document.spec,
    ...(graph ? { graph } : {}),
    label: variationApplyLabel(variation.id, sequence),
    announcement: variationAnnouncement(variation),
  };
}
