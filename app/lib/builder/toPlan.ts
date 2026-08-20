/* ===========================================================================
   THE HANDOFF — the file that has to make "all the way to production" true.

   A `HomeSpec` is a thing you play with: volumes you drag, roofs you pick,
   glass you place. `lib/design/` is a thing that draws: it solves ONE
   rectangular envelope from a room program and emits a dimensioned sheet at
   1/4" = 1'-0". This module is the seam between them, and the seam is where
   the lying would happen if nobody wrote it down.

   THE PROBLEM, stated plainly. The builder can express an L of two volumes
   with five roof forms between them, a glazing wall on the south elevation,
   a rotated annexe and a hot tub. The plan engine can express a rectangle
   with rooms in it. Handing somebody a drawing of a rectangle after they
   built an L — with no word about it — is worse than handing them nothing,
   because a drawing is believed.

   So this module returns two things, always, and the second is not optional:

     1. the `DesignResponse` the real engine really produced, and
     2. an itemised account of what was LOST, ASSUMED, CARRIED or BLOCKED on
        the way there, in plain words, with the numbers on both sides.

   WHAT IT REFUSES TO DO:
   · It does not re-derive a quantity `spec.ts` already defines. Floor area
     comes from `totalFloorAreaSqFt`, ground footprint from
     `groundFootprintSqFt`, glass from `glazedAreaSqFt`, ridge from
     `ridgeHeightFt`. Two modules that compute the same number differently
     are two modules that will eventually disagree in front of a customer.
   · It does not reimplement the plan engine or the parcel module. It calls
     `generateDesignLocally` and `analyseParcel`, unmodified, and reports.
   · It does not silently resize, clamp or "fix" the spec to make the engine
     happier. When the brief is outside what the engine can honour, that is a
     note, not an edit.
   · It does not draw anything when the spec cannot be translated at all. A
     zero-area model returns `response: null` and says why — the engine fed a
     zero area returns a rectangle with inside-out walls and a page of
     warnings, which reads as a drawing and is not one.

   PURITY, inherited from everything it calls: no network, no Node APIs, no
   `Math.random`, no `Date.now`. The same spec always produces the same
   request, the same drawing and the same notes.

   NOT A PERMIT SET. Nothing here is a code check, a structural check or an
   engineered design, and the notes say so where it matters. This is a
   massing and layout tool; a licensed Alberta residential designer completes
   the permit set, which is what the drawing's own stamp already says.
   =========================================================================== */

import {
  glazedAreaSqFt,
  groundFootprintSqFt,
  ridgeHeightFt,
  totalFloorAreaSqFt,
  volumeFootprintSqFt,
  type HomeSpec,
  type Volume,
} from "./spec";
import {
  envelopeFor,
  generateDesignLocally,
  FDWR_MAX,
  HALL_W,
  WALL_THICKNESS_MM,
  type SolvedRoom,
} from "@/lib/design";
/* `MM_PER_FT` is the unit constant the packer converts wall thickness with.
   `lib/design/index.ts` curates its public surface and does not re-export it,
   so it is imported from the module that owns it rather than restated here —
   a second copy of 304.8 is a second thing that can drift. */
import { MM_PER_FT } from "@/lib/design/layout";
import { formatFeetInches } from "@/lib/units";
import {
  analyseParcel,
  FACING_DEG,
  type Facing,
  type ParcelFacts,
  type ParcelReport,
} from "@/lib/design/parcel";
import {
  formatFdwr,
  type DesignRequest,
  type DesignResponse,
  type FloorPlan,
  type HomeStyle,
  type PlacedRoom,
} from "@/lib/designApi";

// ---------------------------------------------------------------------------
// what a note is
// ---------------------------------------------------------------------------

/**
 * How a fact about the translation should be read.
 *
 * · `blocked` — the handoff did not happen. There is no drawing, and the note
 *   says what to change. Reserved for translations that cannot be attempted,
 *   never for ones that merely came out imperfect.
 * · `lost`    — something you built is NOT in the drawing. The loudest kind,
 *   and the reason this file exists.
 * · `assumed` — the drawing contains something you never said, because the
 *   engine required it. The rule that invented it is stated with it.
 * · `carried` — crossed unchanged. Worth printing: knowing which parts are
 *   faithful is what makes the `lost` list believable.
 */
export type HandoffKind = "blocked" | "lost" | "assumed" | "carried";

export type HandoffTopic =
  | "massing"
  | "storeys"
  | "roof"
  | "openings"
  | "glazing"
  | "program"
  | "deck"
  | "siting"
  | "area"
  | "materials";

/** A labelled number inside a note. `sub` says where it came from. Same shape
 *  as `ParcelFigure` in `lib/design/parcel.ts`, deliberately: the builder shows
 *  both lists in the same panel and they should read as one voice. */
export interface HandoffFigure {
  k: string;
  v: string;
  sub?: string;
}

export interface HandoffNote {
  /** Stable across runs — safe as a React key and as a dismissal record. */
  id: string;
  topic: HandoffTopic;
  kind: HandoffKind;
  title: string;
  detail: string;
  figures?: HandoffFigure[];
}

/** Loudest first, then the order the notes were written in (sort is stable). */
const KIND_ORDER: Record<HandoffKind, number> = {
  blocked: 0,
  lost: 1,
  assumed: 2,
  carried: 3,
};

// ---------------------------------------------------------------------------
// the program the engine needs and the spec does not carry
// ---------------------------------------------------------------------------

/**
 * The bedroom/bathroom/style/storey brief inferred from the massing.
 *
 * `DesignRequest` is a QUESTIONNAIRE — it asks how many bedrooms you want.
 * `HomeSpec` is a MODEL — it knows how big the boxes are and nothing about
 * who sleeps in them. Something has to bridge that, and the bridge is a
 * guess. A guess is fine; an unstated guess is not, so `rule` carries the
 * whole policy in words and every figure carries the step that produced it.
 */
export interface DerivedProgram {
  bedrooms: number;
  bathrooms: number;
  storeys: 1 | 2;
  style: HomeStyle;
  /** Off-grid is the Aura standard, not a toggle — see `lib/design/materials.ts`. */
  offGrid: boolean;
  /** The rule, in plain words. Shown to the user, not just kept in a comment. */
  rule: string;
  /** Why this style name and not another. */
  styleReason: string;
}

/** Everything `planFromSpec` knows, including what it could not do. */
export interface PlanHandoff {
  /** The brief that was handed over. Identical to `response.request` when a
   *  response exists: every optional field is resolved here, so there is one
   *  object to read rather than two that can differ. */
  request: DesignRequest;
  /** `null` only when a `blocked` note explains why nothing was drawn. */
  response: DesignResponse | null;
  /** The engine threw. Should not happen; surfaced verbatim, never papered over. */
  error: string | null;
  /** Lost / assumed / carried, loudest first. Never empty. */
  notes: HandoffNote[];
  /** The packer's OWN warnings about the plan it solved — min-dimension
   *  failures, FDWR trims, rounding drift. Already inside `response.notes`;
   *  lifted out so a UI can show them once, in their own place, and not
   *  confuse them with the translation notes above, which are ours. */
  engineWarnings: string[];
  /** What was inferred, and the rule that inferred it. */
  program: DerivedProgram;
  /** `totalFloorAreaSqFt(spec)` — the number handed to the engine. */
  totalFloorAreaSqFt: number;
  /** The rectangle the engine solved, long side first. `[0, 0]` when blocked. */
  solvedEnvelopeFt: [number, number];
}

// ---------------------------------------------------------------------------
// the rule's numbers, in one place so the prose and the arithmetic agree
// ---------------------------------------------------------------------------

/** Total floor area -> bedrooms, before the volume bonus and the density cap.
 *  First bracket whose ceiling the area falls under wins. Below 450 sq ft the
 *  answer is zero on purpose: `defaultProgram` reads `bedrooms === 0` as a
 *  studio and gives the great room a 0.55 share instead of 0.34, which is the
 *  right plan for a cabin and the wrong plan for a house. */
const BEDROOM_BRACKETS: readonly (readonly [number, number])[] = [
  [450, 0],
  [850, 1],
  [1350, 2],
  [2000, 3],
  [Number.POSITIVE_INFINITY, 4],
];

/** A second mass in a Nordic cluster reads as a sleeping wing — but only if it
 *  is big enough to be a room rather than a porch or a wood store. */
const ANNEXE_MIN_SQ_FT = 120;

/** Density ceiling: a home needs about this much total floor area per bedroom
 *  before the packer starts solving rooms under its own 6'-0" minimum. */
const SQ_FT_PER_BEDROOM = 350;

/** Past this the room program stops fitting any envelope the engine will draw. */
const MAX_BEDROOMS = 5;

/** One full bath per this much floor area, whatever the bedroom count says. */
const SQ_FT_PER_FULL_BATH = 700;

/** `layout.ts` calls this `SMALL_PLAN_SQ_FT` and keeps it private: below it,
 *  `defaultProgram` deliberately DROPS the powder room and the mechanical room
 *  rather than solving them to closets. Matched here so this module never asks
 *  for a half-bath the engine is going to throw away. */
const POWDER_ROOM_MIN_SQ_FT = 900;

const MAX_BATHROOMS = 3.5;

/** `design-api/app/models.py` — `DesignRequest.total_sq_ft` bounds. The browser
 *  engine enforces neither; the hosted service returns 422 outside them, which
 *  matters the moment "production" means the service rather than this tab. */
const SERVICE_MIN_TOTAL_SQ_FT = 200;
const SERVICE_MAX_TOTAL_SQ_FT = 4000;

/**
 * How far off due south the front may point and still earn the
 * `passive_solar` style NAME.
 *
 * Deliberately NOT the parcel module's solar window (which is tighter, and is
 * the real check on real lot geometry). This chooses a label on a drawing;
 * `checkSpecAgainstParcel` is where orientation becomes a finding.
 */
const STYLE_SOUTH_WINDOW_DEG = 45;

/** Feet out of the engine are multiples of 0.5; this only kills float noise. */
const EPS = 1e-9;

/** The engine rounds its envelope to buildable 6" dimensions, so anything
 *  inside half a foot is "the same rectangle", not a difference. */
const ROUNDING_TOLERANCE_FT = 0.5;

// ---------------------------------------------------------------------------
// formatting
// ---------------------------------------------------------------------------
//
// This copy existed because `lib` must not depend on `components`, where the
// original formatter lived. `lib/units` satisfies that rule for everyone, so
// the body now lives there and only the short local name remains.

/** Feet and inches the way the drawing's dimension strings read: 34'-6". */
const ft = (v: number): string => formatFeetInches(v);

/** Thousands separator by regex, not `toLocaleString`: a figure in a quoted
 *  document must not drift with the viewer's ICU data. */
const thousands = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const sq = (n: number): string => `${thousands(Math.round(n))} sq ft`;

const one = (n: number): string => String(Math.round(n * 10) / 10);

const pct = (ratio: number): string => `${one(ratio * 100)}%`;

const deg = (n: number): string => `${one(n)}°`;

const plural = (n: number, s: string, p = `${s}s`): string =>
  `${n} ${n === 1 ? s : p}`;

const listVolumes = (volumes: readonly Volume[]): string =>
  volumes
    .map(
      (v) =>
        `${v.name} ${ft(v.widthFt)} × ${ft(v.depthFt)}` +
        (v.storeys === 2 ? " over two storeys" : ""),
    )
    .join("  ·  ");

const ROOF_NAMES: Record<Volume["roof"]["form"], string> = {
  gable: "gable",
  "a-frame": "A-frame",
  shed: "shed",
  flat: "flat",
  saltbox: "saltbox",
};

// ---------------------------------------------------------------------------
// small pure derivations this module owns (spec.ts defines none of these)
// ---------------------------------------------------------------------------

const norm = (d: number): number => ((d % 360) + 360) % 360;

/** Shortest angular distance between two bearings, degrees. */
function angularGap(a: number, b: number): number {
  const d = norm(a - b);
  return d > 180 ? 360 - d : d;
}

/**
 * Gross exterior wall area of the modelled volumes, sq ft.
 *
 * DERIVED HERE, and honestly rough: perimeter × wall height × storeys, with no
 * deduction for the walls where two volumes meet and no understanding that an
 * A-frame's "walls" are roof planes. It exists for exactly one purpose — to put
 * the glass you placed over a plausible denominator so the FDWR conversation
 * can happen at all — and every note that uses it says so.
 *
 * `spec.ts` does not define this quantity, which is why it is computed rather
 * than imported. Nothing else in the system consumes it.
 */
export function modelledWallAreaSqFt(spec: HomeSpec): number {
  return spec.volumes.reduce(
    (sum, v) => sum + 2 * (v.widthFt + v.depthFt) * v.wallHeightFt * v.storeys,
    0,
  );
}

/**
 * Glazed area over modelled wall area, 0..1 — the builder's own ratio.
 *
 * NOT the drawing's FDWR. The drawing measures the packer's windows against
 * the envelope the packer solved; this measures your glass against your walls.
 * Both are honest and they are about different glass, which is the whole point
 * of the note that prints them side by side.
 */
export function modelledGlazingRatio(spec: HomeSpec): number {
  const wall = modelledWallAreaSqFt(spec);
  return wall > 0 ? glazedAreaSqFt(spec) / wall : 0;
}

/** One storey unless any volume is two — a home with a two-storey mass is a
 *  two-storey home, and `DesignRequest` has room for exactly one answer. */
export const storeysOf = (spec: HomeSpec): 1 | 2 =>
  spec.volumes.some((v) => v.storeys === 2) ? 2 : 1;

/** The biggest volume by footprint; ties keep the first, so the answer is
 *  stable for a given spec. `null` only for an empty model. */
function primaryVolume(spec: HomeSpec): Volume | null {
  let best: Volume | null = null;
  for (const v of spec.volumes) {
    if (best === null || volumeFootprintSqFt(v) > volumeFootprintSqFt(best)) best = v;
  }
  return best;
}

/** The eight compass points `lib/design/parcel.ts` declares, in its order. */
const FACINGS = Object.keys(FACING_DEG) as (keyof typeof FACING_DEG)[];

/** Nearest of the parcel module's eight facings to a bearing in degrees.
 *  Ties (a bearing exactly between two points) resolve to the earlier one,
 *  which keeps the answer stable rather than pleasant. */
function nearestFacing(bearingDeg: number): keyof typeof FACING_DEG {
  let best = FACINGS[0];
  let bestGap = Number.POSITIVE_INFINITY;
  for (const f of FACINGS) {
    const gap = angularGap(bearingDeg, FACING_DEG[f]);
    if (gap < bestGap - EPS) {
      best = f;
      bestGap = gap;
    }
  }
  return best;
}

const FACING_WORDS: Record<keyof typeof FACING_DEG, string> = {
  n: "north",
  ne: "north-east",
  e: "east",
  se: "south-east",
  s: "south",
  sw: "south-west",
  w: "west",
  nw: "north-west",
};

// ---------------------------------------------------------------------------
// the program rule
// ---------------------------------------------------------------------------

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

const bedroomBracket = (totalSqFt: number): number => {
  for (const [ceiling, beds] of BEDROOM_BRACKETS) {
    if (totalSqFt < ceiling) return beds;
  }
  return BEDROOM_BRACKETS[BEDROOM_BRACKETS.length - 1][1];
};

/** The rule, written once, printed to the user and used as the doc comment for
 *  the arithmetic below. Changing the numbers means changing this string. */
const PROGRAM_RULE =
  `Bedrooms come from total floor area first — under ${BEDROOM_BRACKETS[0][0]} sq ft it is a ` +
  `studio and the answer is none, then one bedroom to ${BEDROOM_BRACKETS[1][0]}, two to ` +
  `${BEDROOM_BRACKETS[2][0]}, three to ${BEDROOM_BRACKETS[3][0]}, four above that. Each ` +
  `additional VOLUME of at least ${ANNEXE_MIN_SQ_FT} sq ft adds one more, because a second ` +
  `mass in a Nordic cluster is usually where people sleep. The total is then capped at one ` +
  `bedroom per ${SQ_FT_PER_BEDROOM} sq ft of floor area (and at ${MAX_BEDROOMS} outright), ` +
  `because past that density the packer solves rooms under its own 6'-0" minimum and the ` +
  `drawing fills with warnings instead of rooms. Bathrooms: one, plus one more for every two ` +
  `bedrooms past the first, capped at one per ${SQ_FT_PER_FULL_BATH} sq ft — plus a half bath ` +
  `once the home is ${POWDER_ROOM_MIN_SQ_FT} sq ft with two or more bedrooms, which is exactly ` +
  `where the engine's own program starts drawing a powder room rather than dropping it. ` +
  `Storeys is the highest storey count among your volumes. None of this is in the model you ` +
  `built — it is inferred, it is editable in the request, and it is the first thing to change ` +
  `if the drawing's room list is not the home you meant.`;

/**
 * Infer the questionnaire the plan engine wants from the model the builder has.
 *
 * @see PROGRAM_RULE — the policy in words. Read it before changing a number here.
 */
export function deriveProgram(spec: HomeSpec): DerivedProgram {
  const total = totalFloorAreaSqFt(spec);
  const storeys = storeysOf(spec);

  const annexes = spec.volumes.filter(
    (v) => volumeFootprintSqFt(v) >= ANNEXE_MIN_SQ_FT,
  ).length;
  const bonus = Math.max(0, annexes - 1);

  const densityCap = Math.floor(total / SQ_FT_PER_BEDROOM);
  const bedrooms = clamp(
    bedroomBracket(total) + bonus,
    0,
    Math.min(MAX_BEDROOMS, Math.max(0, densityCap)),
  );

  const fullBaths = Math.min(
    1 + Math.floor(Math.max(0, bedrooms - 1) / 2),
    Math.max(1, Math.floor(total / SQ_FT_PER_FULL_BATH)),
  );
  const half = total >= POWDER_ROOM_MIN_SQ_FT && bedrooms >= 2 ? 0.5 : 0;
  const bathrooms = Math.min(MAX_BATHROOMS, fullBaths + half);

  // --- style. It is a NAME on the response's layout object, not geometry, but
  // a name that contradicts the model is still a small lie, so it is derived
  // from the model rather than defaulted.
  const primary = primaryVolume(spec);
  const offSouth = angularGap(spec.siting.frontFacesDeg, 180);
  const hasGlazingWall = spec.volumes.some((v) =>
    v.openings.some((o) => o.kind === "glazing-wall"),
  );

  let style: HomeStyle = "off_grid_cabin";
  let styleReason =
    "the engine's own default, and the honest description of a small off-grid " +
    "home with a pitched roof";

  if (primary?.roof.form === "a-frame") {
    style = "modern_aframe";
    styleReason = `the largest volume (${primary.name}) carries an A-frame roof`;
  } else if (hasGlazingWall && offSouth <= STYLE_SOUTH_WINDOW_DEG + EPS) {
    style = "passive_solar";
    styleReason =
      `there is a glazing wall on the model and the front faces ` +
      `${deg(offSouth)} off due south — within ${STYLE_SOUTH_WINDOW_DEG}°, so the glass ` +
      `is pointed at the winter sun rather than away from it`;
  } else if (primary && (primary.roof.form === "flat" || primary.roof.form === "shed")) {
    style = "scandinavian_minimalist";
    styleReason = `the largest volume (${primary.name}) carries a ${ROOF_NAMES[primary.roof.form]} roof`;
  }

  return {
    bedrooms,
    bathrooms,
    storeys,
    style,
    // Off-grid is doctrine in this repo, not a preference: see the eco spine in
    // `lib/design/materials.ts`. The engine defaults it to true; it is set
    // explicitly so the request object is fully resolved rather than half-stated.
    offGrid: true,
    rule: PROGRAM_RULE,
    styleReason,
  };
}

/**
 * The `DesignRequest` this spec becomes.
 *
 * Every optional field is filled, so this object and `response.request` (which
 * the engine resolves with the same defaults) are the same object. Material and
 * climate zone cross untouched — they are the two fields the two contracts
 * genuinely share, and nothing in this file is allowed to reinterpret them.
 */
export function specToDesignRequest(spec: HomeSpec): DesignRequest {
  const program = deriveProgram(spec);
  const notes = spec.notes.trim();
  return {
    bedrooms: program.bedrooms,
    bathrooms: program.bathrooms,
    total_sq_ft: totalFloorAreaSqFt(spec),
    climate_zone: spec.climateZone,
    material: spec.material,
    style: program.style,
    storeys: program.storeys,
    off_grid: program.offGrid,
    // Carried verbatim. Nothing about the massing is appended: `notes` is the
    // owner's own words, it reaches a language model if the optional design
    // service is ever connected, and quietly writing a brief on their behalf is
    // not this module's job.
    ...(notes ? { notes } : {}),
  };
}

// ---------------------------------------------------------------------------
// counting what the drawing actually contains
// ---------------------------------------------------------------------------

/** `FloorPlan.rooms` is `PlacedRoom[]` in the frozen contract, but the local
 *  engine returns `SolvedRoom`s that carry their openings. Read defensively —
 *  the extra field is a fact about this path, not a promise of the type. */
type RoomWithOpenings = PlacedRoom & Partial<Pick<SolvedRoom, "openings">>;

function countDrawnOpenings(plan: FloorPlan): { windows: number; doors: number } {
  let windows = 0;
  let doors = 0;
  for (const room of plan.rooms as readonly RoomWithOpenings[]) {
    for (const o of room.openings ?? []) {
      if (o.kind === "window") windows += 1;
      else doors += 1;
    }
  }
  return { windows, doors };
}

function countSpecOpenings(spec: HomeSpec): {
  windows: number;
  doors: number;
  glazingWalls: number;
  total: number;
} {
  let windows = 0;
  let doors = 0;
  let glazingWalls = 0;
  for (const v of spec.volumes) {
    for (const o of v.openings) {
      if (o.kind === "window") windows += 1;
      else if (o.kind === "door") doors += 1;
      else glazingWalls += 1;
    }
  }
  return { windows, doors, glazingWalls, total: windows + doors + glazingWalls };
}

// ---------------------------------------------------------------------------
// the notes
// ---------------------------------------------------------------------------

function massingNote(
  spec: HomeSpec,
  envelope: [number, number],
  total: number,
): HandoffNote {
  const [envW, envH] = envelope;
  const volumes = spec.volumes;
  const figures: HandoffFigure[] = [
    {
      k: "Volumes you modelled",
      v: String(volumes.length),
      sub: listVolumes(volumes),
    },
    {
      k: "Envelope the engine solved",
      v: `${ft(envW)} × ${ft(envH)}`,
      sub:
        "Derived by the plan engine from the floor area alone, at its fixed " +
        "1.45 : 1 proportion, rounded to buildable 6-inch dimensions",
    },
    {
      k: "Floor area",
      v: sq(total),
      sub: "totalFloorAreaSqFt — footprint × storeys, summed over your volumes. This is the one number that crosses intact",
    },
  ];

  if (volumes.length > 1) {
    return {
      id: "massing",
      topic: "massing",
      kind: "lost",
      title: `${plural(volumes.length, "volume")} are drawn as one rectangle`,
      detail:
        `The plan engine solves a SINGLE rectangular envelope. It takes the total floor ` +
        `area, picks a rectangle at a fixed 1.45 : 1 proportion and packs rooms into it — ` +
        `so the L, the cluster or the main-house-plus-annexe you built is not the shape on ` +
        `the sheet. What survives the trip: total floor area, storey count, material, ` +
        `climate zone, and a room program sized to fit. What does not: the shape, the joint ` +
        `between the volumes, where each mass sits on the site, and any room that only makes ` +
        `sense because there is an annexe to put it in. This is the largest single gap ` +
        `between the model and the drawing, which is why it is named here instead of being ` +
        `left for you to notice. The 3D model is the truth about the massing; the drawing is ` +
        `a layout study of the same floor area.`,
      figures,
    };
  }

  const v = volumes[0];
  const modelled: [number, number] = [
    Math.max(v.widthFt, v.depthFt),
    Math.min(v.widthFt, v.depthFt),
  ];
  const matches =
    Math.abs(modelled[0] - envW) <= ROUNDING_TOLERANCE_FT + EPS &&
    Math.abs(modelled[1] - envH) <= ROUNDING_TOLERANCE_FT + EPS;

  if (matches) {
    return {
      id: "massing",
      topic: "massing",
      kind: "carried",
      title: "Your volume survives the translation",
      detail:
        `The plan engine does not read your width and depth — it re-derives a rectangle from ` +
        `the floor area at a fixed 1.45 : 1 proportion. Yours already sits at that ` +
        `proportion, so the envelope it solved (${ft(envW)} × ${ft(envH)}) is your volume ` +
        `(${ft(v.widthFt)} × ${ft(v.depthFt)}) to within the 6-inch rounding. The drawing is ` +
        `describing the building you built. Change the proportion in the builder and this ` +
        `note will change with it, because the engine will still solve 1.45 : 1.`,
      figures,
    };
  }

  return {
    id: "massing",
    topic: "massing",
    kind: "lost",
    title: "The drawing re-proportions your volume",
    detail:
      `The plan engine does not take your width and depth. It takes the FLOOR AREA and ` +
      `re-derives a rectangle at a fixed 1.45 : 1 proportion, rounded to 6 inches — narrow ` +
      `enough that every room can reach an exterior wall, wide enough that the building does ` +
      `not read as a container. Your ${v.name} is ${ft(v.widthFt)} × ${ft(v.depthFt)}; the ` +
      `drawing is ${ft(envW)} × ${ft(envH)}. Same floor area, different building. If the ` +
      `proportion is the point of your design, the 3D model is the truth and the sheet is a ` +
      `layout study of the same area — or change the volume toward 1.45 : 1 and the two will ` +
      `agree.`,
    figures,
  };
}

function storeysNote(spec: HomeSpec, envelope: [number, number]): HandoffNote | null {
  if (storeysOf(spec) !== 2) return null;
  const twoStorey = spec.volumes.filter((v) => v.storeys === 2);
  const mixed = twoStorey.length !== spec.volumes.length;
  const [envW, envH] = envelope;

  return {
    id: "storeys",
    topic: "storeys",
    kind: "lost",
    title: "Two storeys are drawn as one floor plate",
    detail:
      `${twoStorey.map((v) => v.name).join(", ")} ${twoStorey.length === 1 ? "is" : "are"} ` +
      `two storeys, so the request carries storeys: 2 and the engine divides the total floor ` +
      `area by two to size the envelope — ${ft(envW)} × ${ft(envH)}, which is the FOOTPRINT ` +
      `of a two-storey home and the right footprint to check against your land. What it then ` +
      `does is the loss: it packs the ENTIRE room program onto that one plate. Bedrooms ` +
      `appear beside the great room rather than above it, and there is no second-floor sheet, ` +
      `no stair, no floor-to-floor dimension and no landing. Read it as one floor's worth of ` +
      `area with the whole program laid out for study. A real two-storey set is two sheets ` +
      `and a stair, and this engine does not draw them yet — that is a gap in the tool, not a ` +
      `judgement about your design. Two consequences to expect rather than discover: the ` +
      `engine will warn that its envelope differs from the requested floor area by more than ` +
      `8%, which IS this halving and not a fault; and because the whole program lands on a ` +
      `half-size plate, its 6'-0" minimum-dimension warnings fire far more readily here than ` +
      `they would on a single-storey home of the same floor area.` +
      (mixed
        ? ` Your volumes disagree about height: ${spec.volumes
            .map((v) => `${v.name} ${v.storeys}`)
            .join(", ")}. The request has room for one answer and takes the highest, because ` +
          `a home with any two-storey mass is a two-storey home. The single-storey volume's ` +
          `area is folded into the same total, so the envelope is smaller than that volume's ` +
          `real ground footprint.`
        : ``),
    figures: [
      {
        k: "Storeys sent",
        v: "2",
        sub: mixed
          ? "The highest among your volumes — the request holds only one number"
          : "Every volume is two storeys",
      },
      {
        k: "Plate the engine drew",
        v: `${ft(envW)} × ${ft(envH)}`,
        sub: "Total floor area ÷ 2, solved at 1.45 : 1 — the ground footprint, with every room on it",
      },
    ],
  };
}

function roofNote(spec: HomeSpec): HandoffNote {
  const forms = spec.volumes.map((v) => v.roof.form);
  const distinct = Array.from(new Set(forms));
  const hasAFrame = forms.includes("a-frame");
  const hasFlat = forms.includes("flat");

  return {
    id: "roof",
    topic: "roof",
    kind: "lost",
    title:
      distinct.length > 1
        ? `${distinct.length} roof forms, none of which reach the drawing`
        : "The roof does not reach the drawing",
    detail:
      `A FloorPlan has no roof in it. Form, pitch, overhang and which way a shed slope faces ` +
      `are builder-only for now: the sheet is a plan at 1/4" = 1'-0" with no elevation and no ` +
      `section, so nothing about the roof is drawn, dimensioned or checked — not the snow ` +
      `load, not the ridge height against a district height limit, not the overhang that does ` +
      `the summer shading. The ridge heights below come from your model (spec.ts's own ` +
      `ridgeHeightFt), not from the drawing, and they are the numbers to take to your ` +
      `district when you ask about height.` +
      (hasAFrame
        ? ` One case that matters more than the rest: an A-frame's slopes ARE its walls, so ` +
          `the floor plate loses usable head height at its edges. The plan's rectangle counts ` +
          `that floor as fully usable, because a plan view cannot see a slope. Treat the ` +
          `A-frame's drawn area as optimistic at the perimeter.`
        : ``) +
      (hasFlat
        ? ` A flat roof also needs a parapet and a drainage detail that no plan view shows; ` +
          `the 2° fall the spec assumes is real and invisible here.`
        : ``),
    figures: spec.volumes.map((v) => ({
      k: v.name,
      v: `${ROOF_NAMES[v.roof.form]}${v.roof.form === "flat" ? "" : ` at ${one(v.roof.pitchDeg)}°`}`,
      sub:
        `${ft(v.roof.overhangFt)} overhang` +
        (v.roof.facing ? `, facing ${v.roof.facing.toUpperCase()}` : "") +
        ` · ridge ${ft(ridgeHeightFt(v))} above finished floor (from your model)`,
    })),
  };
}

function openingsNote(spec: HomeSpec, plan: FloorPlan | null): HandoffNote | null {
  const mine = countSpecOpenings(spec);
  if (mine.total === 0) return null;
  const drawn = plan ? countDrawnOpenings(plan) : null;

  const figures: HandoffFigure[] = [
    {
      k: "Openings you placed",
      v: String(mine.total),
      sub:
        `${plural(mine.windows, "window")}, ${plural(mine.glazingWalls, "glazing wall")}, ` +
        `${plural(mine.doors, "door")} — each on a named wall, at your offset and sill height`,
    },
  ];
  if (drawn) {
    figures.push({
      k: "Openings the drawing shows",
      v: String(drawn.windows + drawn.doors),
      sub: `${plural(drawn.windows, "window")} and ${plural(drawn.doors, "door")}, placed by the packer against the rooms it solved`,
    });
  }

  return {
    id: "openings",
    topic: "openings",
    kind: "lost",
    title: `Your ${plural(mine.total, "opening")} are replaced by the packer's own`,
    detail:
      `None of your opening numbers cross. Not the wall, not the offset along it, not the ` +
      `sill height, not the width or the height. The packer places its own set from the rooms ` +
      `it solved: one door per room onto the circulation spine, windows on exterior walls ` +
      `only, never more than one per five feet of wall, each no wider than 4 feet or a third ` +
      `of its wall, all at a nominal 4-foot height. The two sets describe the same intent — ` +
      `daylight on the outside walls, a door into every room — but they are not the same ` +
      `holes, and a builder pricing windows off the sheet is pricing the packer's windows. ` +
      `The elevation you are turning around in 3D is yours; the plan's openings are the ` +
      `engine's.`,
    figures,
  };
}

function glazingNote(spec: HomeSpec, plan: FloorPlan | null): HandoffNote | null {
  const glass = glazedAreaSqFt(spec);
  if (glass <= 0) return null;

  const wall = modelledWallAreaSqFt(spec);
  const ratio = modelledGlazingRatio(spec);
  const over = ratio > FDWR_MAX + EPS;
  const hasAFrame = spec.volumes.some((v) => v.roof.form === "a-frame");

  const figures: HandoffFigure[] = [
    {
      k: "Glass you placed",
      v: sq(glass),
      sub: "glazedAreaSqFt — windows and glazing walls, doors excluded, the same way the engine counts",
    },
    {
      k: "Your wall area",
      v: sq(wall),
      sub:
        "Derived here, roughly: perimeter × wall height × storeys, with no deduction where " +
        "volumes meet. Not an engine number",
    },
    {
      k: "Your glazing ratio",
      v: pct(ratio),
      sub: `Derived here. The NBC 9.36 prescriptive ceiling is ${pct(FDWR_MAX)} — this is a comparison, not a code check`,
    },
  ];
  if (plan) {
    figures.push({
      k: "FDWR on the sheet",
      v: formatFdwr(plan.fdwr),
      sub: "The engine's own windows against the envelope it solved — a different measurement of different glass",
    });
  }

  return {
    id: "glazing",
    topic: "glazing",
    kind: "lost",
    title: over
      ? `Your glazing is ${pct(ratio)} of your wall — above the ${pct(FDWR_MAX)} prescriptive ceiling`
      : "The FDWR printed on the sheet is not measuring your glazing",
    detail:
      `You placed ${sq(glass)} of glass. The title block's FDWR figure is not about it: that ` +
      `is computed from the windows the PACKER placed against the envelope the packer solved, ` +
      `and if it had to trim its own windows to stay under the ceiling it says so in its ` +
      `warnings. Your glass is measured against your walls, here, and comes to ${pct(ratio)}.` +
      (over
        ? ` That is over the ${pct(FDWR_MAX)} NBC 9.36 prescriptive ceiling, and it is the ` +
          `number to take seriously — not because anything here is a code check (it is not), ` +
          `but because on the prescriptive path that ceiling is the limit, and buying the ` +
          `glass back means a performance-path energy model. Nothing in your model has been ` +
          `trimmed: the builder draws what you asked for and tells you where it stands.`
        : ` That is inside the ${pct(FDWR_MAX)} NBC 9.36 prescriptive ceiling, on this rough ` +
          `denominator. It is a comparison rather than a code check — the real ratio counts ` +
          `doors and is measured on real elevations.`) +
      (hasAFrame
        ? ` Read the ratio carefully on an A-frame: its slopes are its walls, so "wall area" ` +
          `above is a rectangle that does not exist on that volume.`
        : ``),
    figures,
  };
}

function programNote(spec: HomeSpec, program: DerivedProgram): HandoffNote {
  const total = totalFloorAreaSqFt(spec);
  const annexes = spec.volumes.filter(
    (v) => volumeFootprintSqFt(v) >= ANNEXE_MIN_SQ_FT,
  ).length;

  return {
    id: "program",
    topic: "program",
    kind: "assumed",
    title: "Bedrooms, bathrooms and style were inferred — you never said",
    detail:
      `The plan engine is answering a questionnaire, and your model does not contain one: a ` +
      `box that is 34 feet wide does not say who sleeps in it. So this is the rule, in full, ` +
      `because an unstated guess in the middle of a drawing is the thing this tool refuses to ` +
      `do. ${program.rule}`,
    figures: [
      {
        k: "Bedrooms",
        v: String(program.bedrooms),
        sub:
          `${sq(total)} puts the bracket at ${bedroomBracket(total)}` +
          (annexes > 1 ? `, +${annexes - 1} for the extra ${plural(annexes - 1, "volume")}` : "") +
          `, capped at one per ${SQ_FT_PER_BEDROOM} sq ft`,
      },
      {
        k: "Bathrooms",
        v: String(program.bathrooms),
        sub:
          program.bathrooms % 1 === 0.5
            ? `Includes a half bath — the home is over ${POWDER_ROOM_MIN_SQ_FT} sq ft, which is where the engine will actually draw one`
            : `No half bath: below ${POWDER_ROOM_MIN_SQ_FT} sq ft the engine drops the powder room rather than solving it to a closet`,
      },
      {
        k: "Storeys",
        v: String(program.storeys),
        sub: "The highest storey count among your volumes",
      },
      {
        k: "Style",
        v: program.style.replace(/_/g, " "),
        sub: `Chosen because ${program.styleReason}. It names the layout, it does not move a wall`,
      },
      {
        k: "Off-grid",
        v: program.offGrid ? "yes" : "no",
        sub: "Doctrine, not a preference — the eco spine assumes it on every Aura home",
      },
    ],
  };
}

function deckNote(spec: HomeSpec): HandoffNote | null {
  const deck = spec.deck;
  if (!deck) return null;
  const host = spec.volumes[0];
  const area = deck.widthFt * deck.depthFt;

  return {
    id: "deck",
    topic: "deck",
    kind: "lost",
    title: deck.hotTub
      ? "The deck and the hot tub are not on the sheet"
      : "The deck is not on the sheet",
    detail:
      `You attached a ${ft(deck.widthFt)} × ${ft(deck.depthFt)} deck to the ` +
      `${deck.wall.toUpperCase()} wall${host ? ` of ${host.name}` : ""}` +
      `${deck.hotTub ? ", with the wood-fired hot tub on it" : ""}. The plan engine draws the ` +
      `conditioned envelope only: no deck, no tub, no stairs, no rail. Two things follow that ` +
      `are easy to get wrong. First, the deck's ${sq(area)} is correctly NOT in the floor area ` +
      `handed to the engine — it is unconditioned — which is part of why the drawing's square ` +
      `footage is smaller than the thing you are picturing. Second, most land use bylaws DO ` +
      `count decks and covered areas in site coverage, so your real coverage figure on a ` +
      `district's table is higher than the one the parcel check prints from the footprint ` +
      `alone. The parcel check says this in its own words too.`,
    figures: [
      {
        k: "Deck",
        v: `${ft(deck.widthFt)} × ${ft(deck.depthFt)}`,
        sub: `${sq(area)}, unconditioned — not in the floor area, not on the plan`,
      },
      ...(deck.hotTub
        ? [
            {
              k: "Hot tub",
              v: "wood-fired",
              sub: "A costed line item in the Aura kit, not a drawn element",
            },
          ]
        : []),
    ],
  };
}

function sitingNote(spec: HomeSpec): HandoffNote {
  const bearing = norm(spec.siting.frontFacesDeg);
  const facing = nearestFacing(bearing);
  const rotated = spec.volumes.filter((v) => Math.abs(norm(v.rotationDeg)) > EPS);

  return {
    id: "siting",
    topic: "siting",
    kind: "lost",
    title: "Where the home sits is not an input to the drawing",
    detail:
      `A floor plan is drawn square to the page and carries no compass, so the direction your ` +
      `front faces, the slope of the ground, and the position and rotation of each volume on ` +
      `the site reach the plan engine not at all. They are not wasted: they are precisely what ` +
      `checkSpecAgainstParcel feeds to the parcel module, which is where orientation becomes a ` +
      `real finding — whether the glazing wall can face south on your lot, and what your slope ` +
      `does to a screw-pile foundation. If you have not entered a lot yet, that is where your ` +
      `siting goes and it is worth doing before the drawing means much.` +
      (rotated.length > 0
        ? ` Note also that ${rotated.map((v) => v.name).join(", ")} ` +
          `${rotated.length === 1 ? "is" : "are"} rotated off the grid. The parcel check ` +
          `assumes a home square to the lot lines — a rotated home is legal and often better ` +
          `for solar, but it eats more of the buildable envelope, and neither module models ` +
          `that.`
        : ``),
    figures: [
      {
        k: "Front faces",
        v: `${deg(bearing)} — ${FACING_WORDS[facing]}`,
        sub: "Used by the parcel check, ignored by the drawing",
      },
      {
        k: "Ground",
        v: spec.siting.slope,
        sub: "Crosses to the parcel check unchanged; decides what the pile foundation costs",
      },
      ...(rotated.length > 0
        ? [
            {
              k: "Rotated volumes",
              v: rotated.map((v) => `${v.name} ${deg(norm(v.rotationDeg))}`).join(", "),
              sub: "Modelled in 3D, absent from both the plan and the fit check",
            },
          ]
        : []),
    ],
  };
}

function materialsNote(spec: HomeSpec): HandoffNote {
  const mm = WALL_THICKNESS_MM[spec.material];
  const hasNotes = spec.notes.trim().length > 0;

  return {
    id: "materials",
    topic: "materials",
    kind: "carried",
    title: "Material, climate zone and your notes cross unchanged",
    detail:
      `These are the fields the two contracts genuinely share, and nothing in this handoff ` +
      `reinterprets them. Material is not cosmetic: it sets the structural wall thickness the ` +
      `packer insets the interior envelope by — ${mm} mm here — which moves the net internal ` +
      `area, the dimensions on the sheet and the price per square foot. Climate zone crosses ` +
      `and prints in the title block. ` +
      (hasNotes
        ? `Your notes are carried on the request, where a language model would read them if ` +
          `the optional design service is ever connected; on this browser path nothing draws ` +
          `them.`
        : `You have written no notes, so none are sent.`) +
      ` The home's name is not carried — DesignRequest has no field for it.`,
    figures: [
      {
        k: "Material",
        v: spec.material.replace(/_/g, " "),
        sub: `${mm} mm structural wall — the packer insets the interior envelope by this on all four sides`,
      },
      {
        k: "Climate zone",
        v: spec.climateZone,
        sub: "Crosses untouched; drives the honesty notes and prints on the sheet",
      },
    ],
  };
}

function serviceBoundsNote(total: number): HandoffNote | null {
  const under = total < SERVICE_MIN_TOTAL_SQ_FT;
  const over = total > SERVICE_MAX_TOTAL_SQ_FT;
  if (!under && !over) return null;

  return {
    id: "service-bounds",
    topic: "area",
    kind: "lost",
    title: `${sq(total)} is outside the range the hosted design service accepts`,
    detail:
      `The engine in this tab drew it — it has no such bound, and it would rather answer than ` +
      `refuse. The optional hosted service validates total floor area between ` +
      `${sq(SERVICE_MIN_TOTAL_SQ_FT)} and ${sq(SERVICE_MAX_TOTAL_SQ_FT)} and returns an error ` +
      `outside that, so this brief is ${under ? "smaller" : "larger"} than the path that adds ` +
      `an AI-reasoned room program and renders. Nothing below is invalid; one door along the ` +
      `way is closed until the area is in range.`,
    figures: [
      {
        k: "Your floor area",
        v: sq(total),
        sub: `Service range ${sq(SERVICE_MIN_TOTAL_SQ_FT)} – ${sq(SERVICE_MAX_TOTAL_SQ_FT)}`,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// the handoff
// ---------------------------------------------------------------------------

const sortNotes = (notes: HandoffNote[]): HandoffNote[] =>
  // Stable sort: within a kind, the order the notes were written above.
  [...notes].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

function blockedHandoff(
  spec: HomeSpec,
  program: DerivedProgram,
  request: DesignRequest,
  note: HandoffNote,
): PlanHandoff {
  return {
    request,
    response: null,
    error: null,
    notes: [note],
    engineWarnings: [],
    program,
    totalFloorAreaSqFt: totalFloorAreaSqFt(spec),
    solvedEnvelopeFt: [0, 0],
  };
}

/**
 * Turn a `HomeSpec` into a drawing, and say what it cost.
 *
 * Runs the real `generateDesignLocally` — the same deterministic engine the
 * design page uses — and returns its `DesignResponse` untouched, alongside the
 * itemised account of the translation. Total: it never throws for a bad spec,
 * it returns a `blocked` note and a null response instead.
 *
 * The response's own `notes` and `plan.warnings` are the ENGINE talking about
 * the plan it solved. The `notes` on this object are THIS MODULE talking about
 * the difference between that plan and the home you built. A UI that shows one
 * and not the other is showing half the truth.
 */
export function planFromSpec(spec: HomeSpec): PlanHandoff {
  const program = deriveProgram(spec);
  const request = specToDesignRequest(spec);
  const total = totalFloorAreaSqFt(spec);

  // --- can this be handed over at all?
  if (!Number.isFinite(total) || total <= 0) {
    return blockedHandoff(spec, program, request, {
      id: "blocked-empty",
      topic: "area",
      kind: "blocked",
      title: "There is nothing to draw yet",
      detail:
        `The plan engine sizes everything from total floor area, and this model has ` +
        `${sq(Math.max(0, total))} of it across ${plural(spec.volumes.length, "volume")}. No ` +
        `request was run and no drawing was produced, on purpose: fed a zero area the engine ` +
        `returns a rectangle with inside-out walls and a page of warnings, which looks like a ` +
        `drawing and is not one. Add a volume, or give the ones you have a real width and ` +
        `depth.`,
      figures: [
        { k: "Volumes", v: String(spec.volumes.length) },
        { k: "Floor area", v: sq(Math.max(0, total)), sub: "totalFloorAreaSqFt" },
      ],
    });
  }

  // The same call `solve()` makes internally, with the same arguments — so this
  // is the rectangle the engine WILL solve, not an estimate of it.
  const envelope: [number, number] = envelopeFor(total, program.storeys);
  const wallFt = WALL_THICKNESS_MM[spec.material] / MM_PER_FT;
  const interior: [number, number] = [
    envelope[0] - 2 * wallFt,
    envelope[1] - 2 * wallFt,
  ];

  /* THE INSIDE-OUT LINE, and it is drawn exactly where the packer's own
     geometry goes negative rather than anywhere more opinionated.

     `solve()` insets the interior by the wall on all four sides and then
     reserves a HALL_W circulation spine across the middle of what is left,
     which leaves two room bands of (interiorDepth - HALL_W) / 2 each. Once
     that is zero or less the bands are NEGATIVE: rooms come out with negative
     widths, `net_sq_ft` comes out below zero, and the sheet renders room
     labels reading "-3 SQ FT". That is not a bad drawing, it is not a drawing.

     Above this line the engine draws something real and warns about it in its
     own words (the 6'-0" minimum-dimension check). That is the design page's
     line too, and this module does not get to be stricter than the product it
     is handing to — a small cabin with warnings is a legitimate answer. */
  const roomBandFt = (interior[1] - HALL_W) / 2;
  if (interior[0] <= 0 || roomBandFt <= 0) {
    const material = spec.material.replace(/_/g, " ");
    /* Invert the envelope arithmetic: the depth is sqrt(area / 1.45), so the
       smallest area whose depth clears two walls and the spine is that
       relation run backwards. Approximate on purpose — `envelopeFor` rounds to
       buildable 6" dimensions afterwards — and stated as "about". */
    const minAreaSqFt = 1.45 * (HALL_W + 2 * wallFt) ** 2;
    return blockedHandoff(spec, program, request, {
      id: "blocked-inside-out",
      topic: "area",
      kind: "blocked",
      title: `${sq(total)} is too little floor area to draw a plan in`,
      detail:
        `The envelope solves to ${ft(envelope[0])} × ${ft(envelope[1])}. A ${material} wall ` +
        `is ${WALL_THICKNESS_MM[spec.material]} mm (${ft(wallFt)}) thick on all four sides, ` +
        `leaving an interior of ${ft(interior[0])} × ${ft(interior[1])}, and the packer then ` +
        `reserves a ${ft(HALL_W)} circulation spine across the middle of that — a plan whose ` +
        `rooms open into each other is not a plan. There is nothing left: the room bands ` +
        `either side of the spine come out at ${ft(roomBandFt)}. Pushed through anyway, the ` +
        `engine returns rooms with negative dimensions and a sheet with negative areas ` +
        `printed on it, so nothing was drawn and nothing has been quietly resized. Add floor ` +
        `area, or choose a thinner wall — rammed earth at 450 mm is by a long way the ` +
        `thickest of the four.`,
      figures: [
        {
          k: "Envelope",
          v: `${ft(envelope[0])} × ${ft(envelope[1])}`,
          sub: "Solved from your floor area at the engine's 1.45 : 1 proportion",
        },
        {
          k: "Wall",
          v: `${WALL_THICKNESS_MM[spec.material]} mm`,
          sub: `${ft(wallFt)} on each of the four sides, from the ${material} assembly`,
        },
        {
          k: "Smallest that draws",
          v: `about ${sq(minAreaSqFt)}`,
          sub:
            `Derived: the area whose solved depth clears two ${material} walls and the ` +
            `${ft(HALL_W)} spine. The engine's own 6'-0" minimum room dimension wants ` +
            `considerably more than that before it stops warning`,
        },
      ],
    });
  }

  // --- run the real engine
  let response: DesignResponse | null = null;
  let error: string | null = null;
  try {
    response = generateDesignLocally(request);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const plan = response?.plan ?? null;

  const notes: (HandoffNote | null)[] = [
    massingNote(spec, envelope, total),
    storeysNote(spec, envelope),
    roofNote(spec),
    openingsNote(spec, plan),
    glazingNote(spec, plan),
    deckNote(spec),
    serviceBoundsNote(total),
    programNote(spec, program),
    sitingNote(spec),
    materialsNote(spec),
  ];

  if (error !== null) {
    notes.unshift({
      id: "blocked-engine",
      topic: "area",
      kind: "blocked",
      title: "The plan engine refused this brief",
      detail:
        `It threw rather than drawing, and the message is printed verbatim below rather than ` +
        `being smoothed over: "${error}". Everything else on this page still describes your ` +
        `model; there is simply no drawing to compare it against.`,
    });
  }

  return {
    request,
    response,
    error,
    notes: sortNotes(notes.filter((n): n is HandoffNote => n !== null)),
    engineWarnings: plan?.warnings ?? [],
    program,
    totalFloorAreaSqFt: total,
    solvedEnvelopeFt: envelope,
  };
}

// ---------------------------------------------------------------------------
// does it fit my land
// ---------------------------------------------------------------------------

/** The lot facts the SPEC cannot supply. Front facing and slope come from
 *  `spec.siting`; everything here is a fact about the land, not the home. */
export type ParcelLot = Omit<ParcelFacts, "frontFaces" | "slope">;

export interface SpecParcelCheck {
  /** Exactly what was handed to `analyseParcel`, so the report can be audited. */
  facts: ParcelFacts;
  /** The parcel module's own report. `null` only when there is no home to place. */
  report: ParcelReport | null;
  /** The footprint that was measured, long side first. */
  footprintFt: [number, number];
  /** What the siting translation cost. Same vocabulary as the plan notes. */
  notes: HandoffNote[];
  /** Which geometry the width/depth came from. A spec-derived check does not
   *  describe a planar-graph design: `document.spec` is the frozen recovery
   *  copy. EX03. */
  measuredFrom: "spec" | "building-graph";
}

/**
 * `spec.siting` + a lot, as the `ParcelFacts` the parcel module expects.
 *
 * The one real conversion: `frontFacesDeg` is a continuous bearing and
 * `ParcelFacts.frontFaces` is one of eight compass points, so it rounds to the
 * nearest — using the parcel module's OWN `FACING_DEG` table rather than a
 * second copy of the bearings. `slope` is the same three-value union in both
 * contracts and crosses untouched.
 */
export function parcelFactsFromSpec(spec: HomeSpec, lot: ParcelLot): ParcelFacts {
  /* Widens into `Facing`, which also carries "unknown". This module never
     produces it: a `HomeSpec` always has a bearing, so the parcel module's
     "not answered" branch is unreachable from the builder and its solar check
     always runs. */
  const frontFaces: Facing = nearestFacing(norm(spec.siting.frontFacesDeg));
  return { ...lot, frontFaces, slope: spec.siting.slope };
}

/**
 * Does this home fit this land?
 *
 * Answered by `lib/design/parcel.ts` — the same module the design page uses,
 * called the same way, with none of its logic reimplemented here. What this
 * function adds is the translation: the spec's siting becomes `ParcelFacts`,
 * and the footprint measured is stated rather than assumed.
 *
 * BY DEFAULT IT MEASURES THE ENGINE'S RECTANGLE, not your massing — because
 * that rectangle is what the drawing is, and a fit check should measure the
 * thing you would hand to a builder. For a multi-volume model those two are
 * different numbers, and the difference is returned as a note rather than
 * quietly resolved. Pass `footprint` to measure something else (a bounding box
 * from the 3D massing, say): `analyseParcel` deliberately takes only a width
 * and a height, so anything rectangular can be checked with it.
 */
export function checkSpecAgainstParcel(
  spec: HomeSpec,
  lot: ParcelLot,
  footprint?: Pick<FloorPlan, "width" | "height">,
): SpecParcelCheck {
  const facts = parcelFactsFromSpec(spec, lot);
  const total = totalFloorAreaSqFt(spec);
  const storeys = storeysOf(spec);
  const notes: HandoffNote[] = [];

  const bearing = norm(spec.siting.frontFacesDeg);
  const facing = nearestFacing(bearing);
  const gap = angularGap(bearing, FACING_DEG[facing]);

  notes.push({
    id: "parcel-facing",
    topic: "siting",
    kind: gap > EPS ? "assumed" : "carried",
    title:
      gap > EPS
        ? `Your ${deg(bearing)} front bearing was rounded to ${FACING_WORDS[facing]}`
        : `Your front bearing is exactly ${FACING_WORDS[facing]}`,
    detail:
      `The parcel module reasons in eight compass points, so a continuous bearing has to land ` +
      `on one of them; yours went to ${FACING_WORDS[facing]} (${deg(FACING_DEG[facing])})` +
      (gap > EPS
        ? `, ${deg(gap)} away. The solar finding it produces is therefore up to ${deg(gap)} ` +
          `out — worth knowing if it lands near the edge of the passive-solar window it ` +
          `judges against.`
        : `, exactly.`) +
      ` One assumption underneath all of it: the front of your home is taken to face the ` +
      `front lot line — the street or access side. If you are siting the home facing away ` +
      `from the road, that bearing is the one to change.`,
    figures: [
      {
        k: "Front bearing",
        v: `${deg(bearing)} → ${FACING_WORDS[facing]}`,
        sub: gap > EPS ? `Rounded by ${deg(gap)}` : "No rounding",
      },
      {
        k: "Ground",
        v: spec.siting.slope,
        sub: "Crosses to the parcel module unchanged",
      },
    ],
  });

  if (!Number.isFinite(total) || total <= 0) {
    notes.push({
      id: "parcel-empty",
      topic: "area",
      kind: "blocked",
      title: "There is no home to place on this land yet",
      detail:
        `Your model has no floor area, so there is no footprint to test against the setbacks. ` +
        `The check was not run — an empty footprint "fits" every lot, and reporting that ` +
        `would be the most convincing wrong answer this tool could give.`,
    });
    return { facts, report: null, footprintFt: [0, 0], notes: sortNotes(notes), measuredFrom: "spec" };
  }

  const solved: [number, number] = envelopeFor(total, storeys);
  const plan: Pick<FloorPlan, "width" | "height"> =
    footprint ?? { width: solved[0], height: solved[1] };

  const measuredSqFt = plan.width * plan.height;
  const modelledSqFt = groundFootprintSqFt(spec);
  const drift =
    modelledSqFt > 0 ? Math.abs(measuredSqFt - modelledSqFt) / modelledSqFt : 0;

  if (footprint === undefined && drift > 0.02) {
    const optimistic = measuredSqFt < modelledSqFt;
    notes.push({
      id: "parcel-footprint",
      topic: "massing",
      kind: "lost",
      title: optimistic
        ? "The fit check measures a smaller rectangle than the home you built"
        : "The fit check measures a larger rectangle than the home you built",
      detail:
        `This check measures the engine's solved envelope — ${ft(plan.width)} × ` +
        `${ft(plan.height)}, ${sq(measuredSqFt)} — because that rectangle is what the drawing ` +
        `is. Your volumes cover ${sq(modelledSqFt)} of ground (groundFootprintSqFt: the sum of ` +
        `the volumes, so two overlapping volumes are counted twice and that would be a ` +
        `modelling mistake worth fixing). ` +
        (optimistic
          ? `The check is therefore OPTIMISTIC about your massing: the real footprint needs ` +
            `more room inside the setbacks than the number it passed. On an L-plan the ` +
            `bounding rectangle needs more still.`
          : `The check is therefore CONSERVATIVE about your massing: the rectangle it tested ` +
            `is larger than the ground your volumes actually cover.`) +
        ` The setback arithmetic below is exact for the rectangle it was given; it is the ` +
        `rectangle that is a translation.`,
      figures: [
        {
          k: "Measured",
          v: `${ft(plan.width)} × ${ft(plan.height)}`,
          sub: `${sq(measuredSqFt)} — the engine's solved envelope`,
        },
        {
          k: "Your ground footprint",
          v: sq(modelledSqFt),
          sub: "groundFootprintSqFt — the sum of your volumes' footprints",
        },
      ],
    });
  }

  return {
    facts,
    report: analyseParcel(facts, plan, storeys),
    footprintFt: [plan.width, plan.height],
    notes: sortNotes(notes),
    measuredFrom: "spec",
  };
}

/** EX03. Same parcel module as `checkSpecAgainstParcel`, but the rectangle
 *  and the storey count are handed in rather than derived from `document.spec`.
 *  That is the only honest fit check after a graph conversion: the spec is a
 *  frozen recovery copy and graph edits never touch it. */
export function checkMeasuredFootprintAgainstParcel(
  spec: HomeSpec,
  lot: ParcelLot,
  measured: {
    widthFt: number;
    depthFt: number;
    floorAreaSqFt: number;
    storeys: 1 | 2;
  },
  measuredFrom: "building-graph",
): SpecParcelCheck {
  const facts = parcelFactsFromSpec(spec, lot);
  if (!Number.isFinite(measured.floorAreaSqFt) || measured.floorAreaSqFt <= 0) {
    return { facts, report: null, footprintFt: [0, 0], notes: [], measuredFrom };
  }
  const width = Math.max(measured.widthFt, measured.depthFt);
  const height = Math.min(measured.widthFt, measured.depthFt);
  const plan = { width, height };
  return {
    facts,
    report: analyseParcel(facts, plan, measured.storeys),
    footprintFt: [plan.width, plan.height],
    notes: [],
    measuredFrom,
  };
}
