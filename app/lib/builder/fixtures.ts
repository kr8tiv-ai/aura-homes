/* ===========================================================================
   PLACEABLE FIXTURES — the eco spec, made into objects you can put somewhere.

   `spec.ts` describes the SHELL: volumes, roofs, openings, a deck, a siting.
   It deliberately says nothing about what is inside, and it should not — the
   moment a wood stove becomes a field on HomeSpec, every share link, every
   drawing sheet and every export has to migrate when somebody adds a second
   one. So fixtures live HERE, in their own set, keyed to the shell by volume
   id and wall name, and the shell never learns about them.

   WHAT THIS FILE IS FOR

     · FLOOR items constrained to a floor region and snapping to walls:
       wood stove, wood-fired hot tub, water cistern, battery bank, HRV,
       kitchen island, bed, sofa.
     · WALL items snapped along a wall's run at a height, on the inside or the
       outside face: AWG unit, electrical panel, thermostat, greywater valve,
       wall-mounted heater. WINDOWS AND DOORS ARE NOT HERE. They are
       `HomeSpec.Opening`, they are cut into the wall by geometry.ts, they are
       counted by `glazedAreaSqFt`, and a second definition of them would put
       the FDWR check and the opening schedule into permanent disagreement.
     · ROOF items snapped onto a chosen roof plane at that plane's own pitch:
       the solar array, sized in kW and drawn at the area that many modules
       actually cover.

   CLEARANCES ARE DATA, NOT DECORATION. Every kind carries a set of
   `ClearanceRule`s: named sides, real distances, a `zone` saying what KIND of
   space it is, and a `basis` + `source` saying where the number came from.
   The resolver turns them into boxes and reports what they hit. A wood stove
   whose 48-inch clearance runs into a SIP wall is a BLOCKED issue, not a
   styling choice.

   ...AND EVERY NUMBER IS MARKED. See `SOURCE_HONESTY` below. No primary
   standard was open while this file was written, so `verifiedAgainstSource`
   is `false` on every single rule and the UI is expected to say so. A figure
   attributed to a named code is a figure someone should CHECK against the
   current edition before building; a figure with no code behind it is marked
   `indicative` and is not dressed up as one.

   MORPH, NOT SCALE. A fixture resizes by changing its NAMED dimensions and
   rebuilding. Nothing is uniformly scaled, because uniform scaling is what
   makes a 10-foot island grow 5-inch-thick countertops and a king bed grow a
   4-foot headboard. In every builder below, the detail thicknesses — counter
   slab, stove legs, sofa arms, panel door lip, PV module — are CONSTANTS, and
   only the named dimensions move.

   DETERMINISM. No `Math.random`, no `Date.now`, no network. Ids are supplied
   or derived by counting; the same set always produces the same geometry and
   the same schedule.

   LICENCE / DEPENDENCIES. Nothing new. `three` (MIT) is already a dependency
   and is the only import that is not this repo's own code.
   =========================================================================== */

import * as THREE from "three";

import type { HomeSpec, Volume, Wall } from "@/lib/builder/spec";
import { formatFeetInchesWords } from "@/lib/units";
import {
  ARRAY_SQ_FT_PER_KW,
  DECK_STEP_FT,
  WALL_RUN_AXIS,
  rotDir,
  roofSectionFor,
  wallRunFt,
  wallThicknessFt,
  wallTopProfile,
  yawFromBearingDeg,
  type Pt,
  type RoofPlane,
  type RoofSection,
} from "@/lib/builder/drawings/model";

export { ARRAY_SQ_FT_PER_KW };

/* ===========================================================================
   THE HONESTY HEADER

   This string is not decoration either — mount it above the clearance readout.
   =========================================================================== */

export const SOURCE_HONESTY =
  "No clearance figure in this tool has been checked against a primary document by this software. " +
  "Figures marked CODE name the standard they are believed to come from and must be verified against " +
  "its current edition. Figures marked GUIDELINE come from a published design guideline, not a code. " +
  "Figures marked MANUFACTURER or INDICATIVE are typical values used to draw a sensible box and carry " +
  "no regulatory weight at all. The appliance label, the installation manual, the authority having " +
  "jurisdiction and — for any solid-fuel appliance — the WETT-certified inspector govern in every case.";

/** Schema version for a saved fixture set. Bumped when an old set would stop
 *  loading, exactly as `SPEC_VERSION` is for the shell. */
export const FIXTURES_VERSION = 1 as const;

/** Query/fragment key for a fixture token, if the integrator wants fixtures in
 *  the share URL. Deliberately not `h` — the shell's token owns that. */
export const FIXTURES_PARAM = "fx";

/* ===========================================================================
   UNITS AND SMALL SHARED CONSTANTS
   =========================================================================== */

/** Everything is FEET, matching spec.ts, geometry.ts and the plan engine. */
const IN = 1 / 12;
const MM = 1 / 304.8;

/** How close a floor item has to get to a wall before it snaps flat to it. */
export const WALL_SNAP_FT = 1.25;
/** Free positions land on this grid, so two people dragging the same fixture
 *  to "the middle" get the same number. */
export const FLOOR_GRID_FT = 0.25;
/** Wall items land on this grid along the run, and at this grid in height. */
export const WALL_GRID_FT = 0.25;
/** A hair of air between a fixture and the surface it snaps to, so two faces
 *  are never exactly coplanar (coplanar faces are what z-fighting is). */
export const SNAP_GAP_FT = 0.02;

/** Water, for the hot tub and cistern load facts. Pure arithmetic. */
const WATER_LB_PER_CU_FT = 62.4;
const LITRES_PER_CU_FT = 28.3168;

/**
 * PV module used to draw an array: a common 400 W module at roughly
 * 1134 × 1722 mm. INDICATIVE — it is here so an array has an honest module
 * grain and a real footprint, not because any particular module was specified.
 * Its area (about 21 sq ft) is consistent with `ARRAY_SQ_FT_PER_KW` = 53.
 */
export const PV_MODULE_W_FT = 1134 * MM;
export const PV_MODULE_H_FT = 1722 * MM;
export const PV_MODULE_WATTS = 400;
/** Module-to-module gap, and rail standoff above the roof surface. */
const PV_GAP_FT = 0.06;
const PV_STANDOFF_FT = 0.35;
const PV_THICKNESS_FT = 0.13;
/** Beyond this the scene gets a single slab instead of modules. */
const PV_MAX_DRAWN_MODULES = 160;

/* ===========================================================================
   CLEARANCES
   =========================================================================== */

/** What kind of space a clearance is. The zone decides how loudly a conflict
 *  is reported: a combustible clearance that hits a timber wall is a BLOCK; a
 *  circulation clearance that hits a sofa is a CHECK. */
export type ClearanceZone =
  /** clearance to combustible construction — the fire one */
  | "combustible"
  /** electrical / equipment working space you must be able to stand in */
  | "working-space"
  /** room to pull a filter, a core, a lid */
  | "service"
  /** non-combustible floor protection in front of and around an appliance */
  | "floor-pad"
  /** people moving past furniture */
  | "circulation"
  /** intake and discharge air a unit needs to work at all */
  | "airflow";

export type ClearanceBasis =
  /** attributed to a named installation code or standard */
  | "code"
  /** a published design guideline, which is not a code */
  | "guideline"
  /** typical of the product class; the unit's own manual governs */
  | "manufacturer"
  /** a sensible allowance with no document behind it, and said so */
  | "indicative";

export interface ClearanceRule {
  key: string;
  label: string;
  zone: ClearanceZone;
  /** feet added on each side of the fixture body, in the fixture's own frame.
   *  front is +Z (the face you approach), back is −Z, left is −X, right is +X. */
  front: number;
  back: number;
  left: number;
  right: number;
  /** height of the clearance volume, feet. `null` means "the fixture's own
   *  height". Measured from `from`. */
  heightFt: number | null;
  /**
   * Where the clearance volume STARTS vertically. It matters: an electrical
   * working space is 2.2 m measured from the FLOOR, not 2.2 m measured from
   * wherever the panel happens to be hung, and a wall heater's overhead
   * clearance starts at the TOP of the unit. Defaulting this to "base" and
   * getting the panel wrong is exactly the sort of quiet error this file is
   * supposed to make impossible.
   */
  from: "base" | "floor" | "top";
  basis: ClearanceBasis;
  /** the document this figure is believed to come from, named in full */
  source: string;
  /**
   * ALWAYS false. No primary document was consulted while writing this file,
   * so no figure in it may be presented as verified. Typed as the literal so
   * a future edit cannot flip one to `true` without also changing the type —
   * which is the point at which somebody has to actually go and check.
   */
  verifiedAgainstSource: false;
  note: string;
}

const rule = (
  r: Omit<ClearanceRule, "verifiedAgainstSource" | "from"> & Partial<Pick<ClearanceRule, "from">>,
): ClearanceRule => ({
  from: "base",
  ...r,
  verifiedAgainstSource: false,
});

export const CLEARANCE_BASIS_LABEL: Readonly<Record<ClearanceBasis, string>> = {
  code: "CODE — verify against the current edition",
  guideline: "GUIDELINE — a design guideline, not a code",
  manufacturer: "MANUFACTURER — typical; the unit's manual governs",
  indicative: "INDICATIVE — no document behind this number",
};

/* ===========================================================================
   THE CATALOGUE
   =========================================================================== */

export type FixtureMount = "floor" | "wall" | "roof";

export type FixtureKindId =
  // floor
  | "wood-stove"
  | "hot-tub"
  | "cistern"
  | "battery-bank"
  | "hrv"
  | "kitchen-island"
  | "bed"
  | "sofa"
  // wall
  | "awg"
  | "electrical-panel"
  | "thermostat"
  | "greywater-valve"
  | "wall-heater"
  // roof
  | "solar-array";

/** A named dimension a fixture MORPHS by. Never a scale factor. */
export interface FixtureDimension {
  key: string;
  label: string;
  unit: "ft" | "kW" | "kWh" | "count";
  min: number;
  max: number;
  step: number;
  default: number;
  hint?: string;
}

/** An enumerated choice that changes what the fixture IS, not how big it is —
 *  and, for the stove, changes its clearances by a factor of four. */
export interface FixtureOption {
  key: string;
  label: string;
  choices: ReadonlyArray<{ id: string; label: string; note?: string }>;
  default: string;
  hint?: string;
}

export type Dims = Readonly<Record<string, number>>;
export type Opts = Readonly<Record<string, string>>;

/** A derived number worth putting on a schedule — a water weight, an array
 *  area, a tank volume. Computed, never stored, so it cannot go stale. */
export interface FixtureFact {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** how it reads to a person */
  text: string;
  note?: string;
}

export interface FixtureKind {
  id: FixtureKindId;
  mount: FixtureMount;
  label: string;
  /** two characters for a dense palette; this repo does not use emoji */
  tag: string;
  /** one sentence: what it is, and why an Aura home has one */
  blurb: string;
  dimensions: readonly FixtureDimension[];
  options: readonly FixtureOption[];
  /** plan and height extents of the BODY, feet, from the named dimensions */
  extents: (d: Dims, o: Opts) => { widthFt: number; depthFt: number; heightFt: number };
  /** how far the base sits above the floor (a hung HRV, a wall item's sill) */
  baseHeightFt?: (d: Dims, o: Opts) => number;
  clearances: (d: Dims, o: Opts) => ClearanceRule[];
  facts: (d: Dims, o: Opts) => FixtureFact[];
  /** the low-poly object, built in the fixture's own frame: origin at the
   *  centre of its base, +Z is the face you approach, feet */
  build: (d: Dims, o: Opts, ctx: BuildContext) => FixturePart[];
}

/** What a builder is allowed to know about where it landed. Only the roof
 *  array needs it, and only to lay modules out on the right plan axis. */
export interface BuildContext {
  fallAxis: "x" | "z";
}

const DEFAULT_CTX: BuildContext = { fallAxis: "x" };

/* ---------------------------------------------------------------- geometry */

export type FixtureSurface =
  /** matte black cast iron / firebox */
  | "stove"
  /** galvanized or stainless appliance metal */
  | "steel"
  /** a painted equipment enclosure */
  | "cabinet"
  /** cedar, oak, any timber */
  | "wood"
  /** upholstery and mattress */
  | "fabric"
  /** water in a tub or a cistern */
  | "water"
  /** PV module glass */
  | "pv"
  /** a lens, a screen, a gauge */
  | "glass"
  /** a clearance volume that is satisfied */
  | "clearance"
  /** a clearance volume that is not */
  | "clearance-alert";

export interface FixturePart {
  /** suffix only; the resolver prefixes it with the fixture id */
  id: string;
  surface: FixtureSurface;
  geometry: THREE.BufferGeometry;
}

const box = (
  w: number,
  h: number,
  d: number,
  cx = 0,
  cy = 0,
  cz = 0,
): THREE.BufferGeometry =>
  new THREE.BoxGeometry(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d)).translate(cx, cy, cz);

const cyl = (
  r: number,
  h: number,
  cx = 0,
  cy = 0,
  cz = 0,
  seg = 14,
): THREE.BufferGeometry =>
  new THREE.CylinderGeometry(Math.max(0.01, r), Math.max(0.01, r), Math.max(0.01, h), seg, 1).translate(cx, cy, cz);

const part = (id: string, surface: FixtureSurface, geometry: THREE.BufferGeometry): FixturePart => ({
  id,
  surface,
  geometry,
});

const num = (d: Dims, key: string, fallback: number): number => {
  const v = d[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};

const opt = (o: Opts, key: string, fallback: string): string => {
  const v = o[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
};

/* ---------------------------------------------------------- FLOOR: stove */

/**
 * The wood stove, and the only fixture in this file whose clearances change
 * the plan rather than decorate it.
 *
 * The four numbers below are the ones a WETT-certified inspector is checking
 * against CAN/CSA-B365, and they are the reason the clearance box is drawn at
 * all: 48 inches of empty air around an unlisted radiant stove is a large
 * piece of a small cabin, and finding that out on the drawing is very much
 * cheaper than finding it out on inspection day.
 *
 * READ THE NOTES. A LISTED appliance is governed by its own label and its own
 * installation manual — full stop — and the 18-inch default this tool draws
 * for one is a placeholder for the label figure, not a substitute for it.
 */
const woodStove: FixtureKind = {
  id: "wood-stove",
  mount: "floor",
  label: "Wood stove",
  tag: "WS",
  blurb:
    "The heat source an off-grid home can run with nothing arriving down a wire. It also brings the largest clearance in the house.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 1.4, max: 3.5, step: 0.05, default: 2.0 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 1.2, max: 3.0, step: 0.05, default: 1.7 },
    { key: "heightFt", label: "Body height", unit: "ft", min: 1.6, max: 4.0, step: 0.05, default: 2.2, hint: "to the top plate, legs excluded" },
  ],
  options: [
    {
      key: "listing",
      label: "Listing",
      default: "listed",
      hint: "The single fact that decides the clearance.",
      choices: [
        { id: "listed", label: "Listed appliance", note: "Certified to a recognised standard; the LABEL carries the clearance." },
        { id: "unlisted", label: "Unlisted appliance", note: "A shop-built or uncertified stove; the code's blanket clearance applies." },
      ],
    },
    {
      key: "shield",
      label: "Wall shielding",
      default: "none",
      choices: [
        { id: "none", label: "No shield" },
        { id: "listed-shield", label: "Listed / spaced shield", note: "A reduction the code permits only for a shield built to its own rules." },
      ],
    },
  ],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 2.0),
    depthFt: num(d, "depthFt", 1.7),
    heightFt: num(d, "heightFt", 2.2) + STOVE_LEG_FT,
  }),
  clearances: (_d, o) => {
    const listed = opt(o, "listing", "listed") === "listed";
    const shielded = opt(o, "shield", "none") === "listed-shield";
    const body = listed
      ? 18 * IN
      : shielded
        ? 450 * MM
        : 1200 * MM;
    const bodyNote = listed
      ? "PLACEHOLDER for the figure on this appliance's own label. A listed stove's clearance is whatever its listing says — often far less than this, occasionally more. Replace it with the label figure before anybody builds to it."
      : shielded
        ? "The reduced clearance an unlisted appliance is allowed only behind a shield built exactly to the code's shielding rules — correct material, correct air space, correct edge ventilation. A sheet of steel screwed to the wall is not one."
        : "The blanket clearance for an unlisted radiant solid-fuel appliance. It is large, it is the reason a small cabin plan moves the stove, and it is not negotiable without a listed shield or a listed appliance.";
    return [
      rule({
        key: "combustible",
        label: listed ? "To combustibles (label figure)" : "To combustibles",
        zone: "combustible",
        front: body,
        back: body,
        left: body,
        right: body,
        heightFt: null,
        basis: "code",
        source: "CAN/CSA-B365, Installation Code for Solid-Fuel-Burning Appliances and Equipment (Alberta's WETT inspections are carried out against it)",
        note: bodyNote,
      }),
      rule({
        key: "floor-pad",
        label: "Non-combustible floor protection",
        zone: "floor-pad",
        front: 450 * MM,
        back: 200 * MM,
        left: 200 * MM,
        right: 200 * MM,
        heightFt: 0.12,
        basis: "code",
        source: "CAN/CSA-B365 floor-protection extension (the same figures appear in NFPA 211)",
        note:
          "450 mm in front of the fuel-loading door, 200 mm at the sides and rear. The pad's required R-value or thickness is a separate question this tool does not answer — it draws the EXTENT only.",
      }),
      rule({
        key: "connector",
        label: "Single-wall flue connector to combustibles",
        zone: "combustible",
        front: 0,
        back: 0,
        left: 0,
        right: 0,
        heightFt: null,
        basis: "code",
        source: "CAN/CSA-B365, chimney-connector clearance",
        note:
          "450 mm from single-wall connector pipe to any combustible surface. It is listed here as a fact to check, not drawn as a box: this tool does not model the flue route, and drawing a clearance around a pipe it did not route would be an invention.",
      }),
    ];
  },
  facts: (_d, o) => {
    const listed = opt(o, "listing", "listed") === "listed";
    return [
      {
        key: "wett",
        label: "Inspection",
        value: 1,
        unit: "",
        text: listed ? "Listed appliance — WETT inspection to the label" : "Unlisted appliance — WETT inspection to the code's blanket clearance",
        note: "An insurer in Alberta will normally ask for a WETT inspection report on any solid-fuel appliance.",
      },
    ];
  },
  build: (d) => {
    const w = num(d, "widthFt", 2.0);
    const dp = num(d, "depthFt", 1.7);
    const h = num(d, "heightFt", 2.2);
    const parts: FixturePart[] = [];
    // Legs and the top plate are CONSTANT: a taller firebox does not get
    // taller legs. This is the morph rule, visible.
    const legY = STOVE_LEG_FT;
    parts.push(part("body", "stove", box(w, h - STOVE_TOP_FT, dp, 0, legY + (h - STOVE_TOP_FT) / 2, 0)));
    parts.push(part("top", "stove", box(w + 0.12, STOVE_TOP_FT, dp + 0.12, 0, legY + h - STOVE_TOP_FT / 2, 0)));
    const lx = w / 2 - 0.16;
    const lz = dp / 2 - 0.16;
    parts.push(part("leg-a", "stove", box(0.14, legY, 0.14, lx, legY / 2, lz)));
    parts.push(part("leg-b", "stove", box(0.14, legY, 0.14, -lx, legY / 2, lz)));
    parts.push(part("leg-c", "stove", box(0.14, legY, 0.14, lx, legY / 2, -lz)));
    parts.push(part("leg-d", "stove", box(0.14, legY, 0.14, -lx, legY / 2, -lz)));
    // The door is on the front (+Z), which is what makes the 450 mm pad
    // extension "in front of the fuel-loading door" mean something.
    parts.push(part("door", "glass", box(w * 0.6, (h - STOVE_TOP_FT) * 0.55, 0.06, 0, legY + (h - STOVE_TOP_FT) * 0.5, dp / 2 + 0.02)));
    parts.push(part("flue", "steel", cyl(STOVE_FLUE_R_FT, STOVE_FLUE_FT, 0, legY + h + STOVE_FLUE_FT / 2, -dp * 0.15, 12)));
    return parts;
  },
};

const STOVE_LEG_FT = 0.4;
const STOVE_TOP_FT = 0.14;
const STOVE_FLUE_FT = 3.0;
const STOVE_FLUE_R_FT = 3.5 * IN;

/* --------------------------------------------------------- FLOOR: hot tub */

const hotTub: FixtureKind = {
  id: "hot-tub",
  mount: "floor",
  label: "Wood-fired hot tub",
  tag: "HT",
  blurb:
    "The one on the deck of every Aura render. Placed here it becomes a load and a clearance rather than a picture.",
  dimensions: [
    { key: "diameterFt", label: "Diameter", unit: "ft", min: 4, max: 8, step: 0.1, default: 6.0 },
    { key: "heightFt", label: "Height", unit: "ft", min: 2.4, max: 4.2, step: 0.05, default: 3.2 },
    { key: "waterDepthFt", label: "Water depth", unit: "ft", min: 1.5, max: 3.6, step: 0.05, default: 2.6 },
  ],
  options: [],
  extents: (d) => {
    const dia = num(d, "diameterFt", 6);
    return { widthFt: dia, depthFt: dia + TUB_STOVE_FT, heightFt: num(d, "heightFt", 3.2) };
  },
  clearances: () => [
    rule({
      key: "snorkel",
      label: "Around the submerged / snorkel stove",
      zone: "combustible",
      front: 2.0,
      back: 0.5,
      left: 0.5,
      right: 0.5,
      heightFt: null,
      basis: "manufacturer",
      source: "wood-fired tub manufacturers' installation sheets (Snorkel, Alumitub and similar)",
      note:
        "Wood-fired tubs carry a firebox, a chimney and a stack that gets hot. The real figure is on the tub's own sheet and differs between a submerged snorkel and an external stove; this box is a typical allowance so the tub is not drawn tight against a rail.",
    }),
    rule({
      key: "access",
      label: "Access and entry",
      zone: "circulation",
      front: 1.5,
      back: 1.0,
      left: 1.0,
      right: 1.0,
      heightFt: null,
      basis: "indicative",
      source: "none — a working allowance for getting in, out and around",
      note: "Room to step in, and to get at the tub to drain and clean it.",
    }),
  ],
  facts: (d) => {
    const dia = num(d, "diameterFt", 6);
    const depth = Math.min(num(d, "waterDepthFt", 2.6), num(d, "heightFt", 3.2) - 0.3);
    const volFt3 = Math.PI * (dia / 2) * (dia / 2) * Math.max(0, depth);
    const lb = volFt3 * WATER_LB_PER_CU_FT;
    const footprint = Math.PI * (dia / 2) * (dia / 2);
    const psf = footprint > 0 ? lb / footprint : 0;
    return [
      {
        key: "volume",
        label: "Water volume",
        value: volFt3 * LITRES_PER_CU_FT,
        unit: "L",
        text: `${Math.round(volFt3 * LITRES_PER_CU_FT).toLocaleString("en-CA")} L (${Math.round(volFt3 * 7.48052)} US gal)`,
      },
      {
        key: "load",
        label: "Water weight",
        value: lb,
        unit: "lb",
        text: `${Math.round(lb).toLocaleString("en-CA")} lb — about ${Math.round(psf)} lb/sq ft over the tub footprint, water alone`,
        note:
          "Water only: the tub, its stove and the people in it are on top of this. A residential deck is commonly designed for 40 lb/sq ft, so a filled tub normally needs its own beams or its own piles. That is a question for the P.Eng who seals the pile design, and this number exists to make sure the question gets asked.",
      },
    ];
  },
  build: (d) => {
    const dia = num(d, "diameterFt", 6);
    const h = num(d, "heightFt", 3.2);
    const depth = Math.min(num(d, "waterDepthFt", 2.6), h - 0.3);
    const r = dia / 2;
    // The stove hangs off the front, so the whole assembly is shifted back by
    // half its depth to keep the fixture's origin at the CENTRE of its stated
    // extents. Without this the body box would sit 8 inches off the object.
    const zc = -TUB_STOVE_FT / 2;
    return [
      part("shell", "wood", cyl(r, h, 0, h / 2, zc, 16)),
      // The rim band is CONSTANT thickness — a wider tub gets a wider tub, not
      // a chunkier rim.
      part("rim", "wood", cyl(r + 0.08, TUB_RIM_FT, 0, h - TUB_RIM_FT / 2, zc, 16)),
      part("water", "water", cyl(r - 0.12, 0.06, 0, Math.max(0.1, depth), zc, 16)),
      part("stove", "steel", cyl(TUB_STOVE_FT / 2, h * 0.85, 0, h * 0.425, zc + r + TUB_STOVE_FT / 2, 10)),
      part("stack", "steel", cyl(0.2, 2.4, 0, h * 0.85 + 1.2, zc + r + TUB_STOVE_FT / 2, 8)),
    ];
  },
};

const TUB_RIM_FT = 0.22;
const TUB_STOVE_FT = 1.3;

/* --------------------------------------------------------- FLOOR: cistern */

const cistern: FixtureKind = {
  id: "cistern",
  mount: "floor",
  label: "Water cistern",
  tag: "CI",
  blurb: "Stored water, which off grid is the difference between a home and a campsite.",
  dimensions: [
    { key: "diameterFt", label: "Diameter", unit: "ft", min: 2.5, max: 10, step: 0.1, default: 6.0 },
    { key: "heightFt", label: "Height", unit: "ft", min: 3, max: 8, step: 0.1, default: 6.0 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "diameterFt", 6),
    depthFt: num(d, "diameterFt", 6),
    heightFt: num(d, "heightFt", 6),
  }),
  clearances: () => [
    rule({
      key: "service",
      label: "Service and hatch access",
      zone: "service",
      front: 2.0,
      back: 0.5,
      left: 0.5,
      right: 0.5,
      heightFt: null,
      basis: "indicative",
      source: "none — a working allowance for reaching the hatch, the fittings and the pump",
      note:
        "A cistern needs to be opened, inspected and cleaned. This is not a code figure; a potable-water installation also has siting rules this tool does not model.",
    }),
  ],
  facts: (d) => {
    const dia = num(d, "diameterFt", 6);
    const h = num(d, "heightFt", 6);
    // Usable volume stops short of the very top: an air gap over stored water
    // is normal practice, and quoting the geometric volume would overstate it.
    const usableH = Math.max(0, h - 0.5);
    const volFt3 = Math.PI * (dia / 2) * (dia / 2) * usableH;
    const litres = volFt3 * LITRES_PER_CU_FT;
    return [
      {
        key: "capacity",
        label: "Usable capacity",
        value: litres,
        unit: "L",
        text: `${Math.round(litres).toLocaleString("en-CA")} L (${Math.round(volFt3 * 7.48052).toLocaleString("en-CA")} US gal)`,
        note: "Geometric volume less a 6-inch air gap at the top. Not a certified tank capacity.",
      },
      {
        key: "load",
        label: "Full weight",
        value: volFt3 * WATER_LB_PER_CU_FT,
        unit: "lb",
        text: `${Math.round(volFt3 * WATER_LB_PER_CU_FT).toLocaleString("en-CA")} lb full — water alone`,
        note: "A full cistern is one of the heaviest single objects in the house. Its position is a structural decision.",
      },
    ];
  },
  build: (d) => {
    const dia = num(d, "diameterFt", 6);
    const h = num(d, "heightFt", 6);
    const r = dia / 2;
    return [
      part("tank", "cabinet", cyl(r, h, 0, h / 2, 0, 16)),
      // Hatch and outlet are CONSTANT: a bigger tank does not get a bigger lid.
      part("hatch", "cabinet", cyl(0.75, 0.22, 0, h + 0.11, 0, 12)),
      part("outlet", "steel", box(0.4, 0.4, 0.35, 0, 0.55, r + 0.1)),
    ];
  },
};

/* ---------------------------------------------------- FLOOR: battery bank */

const batteryBank: FixtureKind = {
  id: "battery-bank",
  mount: "floor",
  label: "Battery bank",
  tag: "BB",
  blurb: "Where the array's afternoon goes so it can be somebody's evening.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 1.2, max: 6, step: 0.05, default: 2.2 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 0.7, max: 2.5, step: 0.05, default: 1.1 },
    { key: "heightFt", label: "Height", unit: "ft", min: 1.5, max: 7, step: 0.05, default: 4.0 },
    { key: "kwh", label: "Capacity", unit: "kWh", min: 5, max: 80, step: 0.5, default: 20 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 2.2),
    depthFt: num(d, "depthFt", 1.1),
    heightFt: num(d, "heightFt", 4.0),
  }),
  clearances: (d) => [
    rule({
      key: "working",
      label: "Working space in front",
      zone: "working-space",
      front: 1000 * MM, // 1 m
      back: 0,
      left: 0.25,
      right: 0.25,
      heightFt: 2200 * MM,
      from: "floor",
      basis: "code",
      source:
        "Canadian Electrical Code (CSA C22.1) Rule 2-308, working space about electrical equipment — cited by name, figure not verified",
      note:
        "1 m of working space in front of equipment likely to require examination while energised. An energy-storage installation ALSO falls under CEC Section 64 and, where the AHJ adopts it, NFPA 855 — both of which add siting, separation and fire-detection requirements this tool does not model and does not pretend to.",
    }),
    rule({
      key: "ventilation",
      label: "Ventilation and side clearance",
      zone: "airflow",
      front: 0,
      back: 0,
      left: 0.5,
      right: 0.5,
      heightFt: Math.max(0.5, num(d, "heightFt", 4.0) + 1.0),
      basis: "manufacturer",
      source: "battery cabinet installation manuals",
      note: "Typical. Every chemistry and every cabinet has its own figure, and a lithium unit's manual is the authority.",
    }),
  ],
  facts: (d) => {
    const kwh = num(d, "kwh", 20);
    return [
      {
        key: "kwh",
        label: "Nameplate capacity",
        value: kwh,
        unit: "kWh",
        text: `${kwh} kWh nameplate`,
        note:
          "Nameplate, not usable. Usable energy depends on the depth of discharge the chemistry and the warranty allow, and cold cuts into it — which in Alberta is the whole question.",
      },
    ];
  },
  build: (d) => {
    const w = num(d, "widthFt", 2.2);
    const dp = num(d, "depthFt", 1.1);
    const h = num(d, "heightFt", 4.0);
    return [
      part("plinth", "steel", box(w, BATT_PLINTH_FT, dp, 0, BATT_PLINTH_FT / 2, 0)),
      part("cabinet", "cabinet", box(w, h - BATT_PLINTH_FT, dp, 0, BATT_PLINTH_FT + (h - BATT_PLINTH_FT) / 2, 0)),
      // Door lip and status strip are CONSTANT — this is a taller cabinet, not
      // a bigger photograph of a cabinet.
      part("door", "cabinet", box(w - 0.16, h - BATT_PLINTH_FT - 0.2, 0.05, 0, BATT_PLINTH_FT + (h - BATT_PLINTH_FT) / 2, dp / 2 + 0.03)),
      part("status", "glass", box(0.5, 0.14, 0.04, w / 2 - 0.45, h - 0.4, dp / 2 + 0.05)),
    ];
  },
};

const BATT_PLINTH_FT = 0.12;

/* ------------------------------------------------------------- FLOOR: HRV */

const hrv: FixtureKind = {
  id: "hrv",
  mount: "floor",
  label: "HRV unit",
  tag: "HR",
  blurb:
    "A house this tight has to breathe on purpose. The HRV is how, and it needs to be reachable to change a filter.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 1.4, max: 3.5, step: 0.05, default: 2.2 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 1.0, max: 2.5, step: 0.05, default: 1.6 },
    { key: "heightFt", label: "Height", unit: "ft", min: 1.0, max: 2.5, step: 0.05, default: 1.5 },
    { key: "mountHeightFt", label: "Mount height", unit: "ft", min: 0, max: 8, step: 0.1, default: 6.0, hint: "0 stands it on the floor; higher hangs it" },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 2.2),
    depthFt: num(d, "depthFt", 1.6),
    heightFt: num(d, "heightFt", 1.5),
  }),
  baseHeightFt: (d) => Math.max(0, num(d, "mountHeightFt", 6.0)),
  clearances: () => [
    rule({
      key: "service",
      label: "Service face",
      zone: "service",
      front: 2.0,
      back: 0,
      left: 0.5,
      right: 0.5,
      heightFt: null,
      basis: "manufacturer",
      source: "HRV installation manuals (Venmar, Fantech, Lifebreath and similar)",
      note:
        "Room to open the unit and pull both filters and the core. Manuals commonly ask for around 600 mm at the service face; this box is 2 ft. The unit's own manual governs.",
    }),
    rule({
      key: "reach",
      label: "Standing room under a hung unit",
      zone: "service",
      front: 2.0,
      back: 0,
      left: 0.5,
      right: 0.5,
      heightFt: null,
      from: "floor",
      basis: "indicative",
      source: "none — the floor somebody has to stand on to reach a hung unit",
      note:
        "Measured from the FLOOR up, so a hung HRV over a kitchen island shows the conflict it really has: the unit fits, the person changing its filter does not.",
    }),
  ],
  facts: () => [
    {
      key: "balance",
      label: "Commissioning",
      value: 0,
      unit: "",
      text: "Airflow must be balanced on commissioning",
      note: "An HRV that has never been balanced is a fan. The balance report is a real deliverable, not a formality.",
    },
  ],
  build: (d) => {
    const w = num(d, "widthFt", 2.2);
    const dp = num(d, "depthFt", 1.6);
    const h = num(d, "heightFt", 1.5);
    return [
      part("case", "steel", box(w, h, dp, 0, h / 2, 0)),
      part("door", "steel", box(w - 0.14, h - 0.14, 0.05, 0, h / 2, dp / 2 + 0.03)),
      // Duct stubs are 6-inch nominal whatever the box is. Constant, on purpose.
      part("duct-a", "steel", cyl(HRV_DUCT_R_FT, 0.5, w * 0.28, h + 0.25, 0, 10)),
      part("duct-b", "steel", cyl(HRV_DUCT_R_FT, 0.5, -w * 0.28, h + 0.25, 0, 10)),
    ];
  },
};

const HRV_DUCT_R_FT = 3 * IN;

/* ------------------------------------------------------ FLOOR: island/bed/sofa */

const kitchenIsland: FixtureKind = {
  id: "kitchen-island",
  mount: "floor",
  label: "Kitchen island",
  tag: "KI",
  blurb: "The piece of furniture that decides whether a small plan works.",
  dimensions: [
    { key: "widthFt", label: "Length", unit: "ft", min: 3, max: 12, step: 0.1, default: 6.0 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 2, max: 4.5, step: 0.05, default: 3.0 },
    { key: "heightFt", label: "Counter height", unit: "ft", min: 2.6, max: 3.6, step: 0.02, default: 3.0, hint: "3 ft is the standard 36 in counter" },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 6),
    depthFt: num(d, "depthFt", 3),
    heightFt: num(d, "heightFt", 3),
  }),
  clearances: () => [
    rule({
      key: "work-aisle",
      label: "Work aisle (cook side)",
      zone: "circulation",
      front: 42 * IN,
      back: 0,
      left: 0,
      right: 0,
      heightFt: null,
      basis: "guideline",
      source: "NKBA Kitchen Planning Guidelines — a design guideline, not a building code",
      note: "42 in between the island and the run behind the cook, so a body and an open oven door fit in the same aisle.",
    }),
    rule({
      key: "walkway",
      label: "Walkway (other three sides)",
      zone: "circulation",
      front: 0,
      back: 36 * IN,
      left: 36 * IN,
      right: 36 * IN,
      heightFt: null,
      basis: "guideline",
      source: "NKBA Kitchen Planning Guidelines — a design guideline, not a building code",
      note: "36 in for a walkway with no work happening in it.",
    }),
  ],
  facts: (d) => {
    const w = num(d, "widthFt", 6);
    const dp = num(d, "depthFt", 3);
    return [
      {
        key: "counter",
        label: "Counter area",
        value: w * dp,
        unit: "sq ft",
        text: `${(w * dp).toFixed(1)} sq ft of counter`,
      },
    ];
  },
  build: (d) => {
    const w = num(d, "widthFt", 6);
    const dp = num(d, "depthFt", 3);
    const h = num(d, "heightFt", 3);
    // The counter slab and its overhang are CONSTANT. Uniform scaling is what
    // gives a 12-foot island a 3-inch-thick countertop; this does not.
    return [
      part("base", "cabinet", box(w - 2 * ISLAND_OVERHANG_FT, h - ISLAND_SLAB_FT, dp - 2 * ISLAND_OVERHANG_FT, 0, (h - ISLAND_SLAB_FT) / 2, 0)),
      part("counter", "steel", box(w, ISLAND_SLAB_FT, dp, 0, h - ISLAND_SLAB_FT / 2, 0)),
      part("toe", "cabinet", box(w - 2 * ISLAND_OVERHANG_FT - 0.2, ISLAND_TOE_FT, dp - 2 * ISLAND_OVERHANG_FT - 0.2, 0, ISLAND_TOE_FT / 2, 0)),
    ];
  },
};

const ISLAND_SLAB_FT = 0.13;
const ISLAND_OVERHANG_FT = 0.1;
const ISLAND_TOE_FT = 0.35;

const bed: FixtureKind = {
  id: "bed",
  mount: "floor",
  label: "Bed",
  tag: "BD",
  blurb: "The object that decides whether a bedroom is a bedroom or a corridor with a mattress in it.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 3, max: 7, step: 1 / 12, default: 5.0, hint: "double 4 ft 6, queen 5 ft 0, king 6 ft 4" },
    { key: "lengthFt", label: "Length", unit: "ft", min: 6, max: 7.5, step: 1 / 12, default: 80 * IN },
    { key: "heightFt", label: "Mattress top", unit: "ft", min: 1.2, max: 3, step: 0.05, default: 2.0 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 5),
    depthFt: num(d, "lengthFt", 80 * IN),
    heightFt: num(d, "heightFt", 2.0) + BED_HEADBOARD_FT,
  }),
  clearances: () => [
    rule({
      key: "sides",
      label: "Getting in and out",
      zone: "circulation",
      front: 2.0,
      back: 0,
      left: 2.0,
      right: 2.0,
      heightFt: null,
      basis: "indicative",
      source: "none — a working allowance for making the bed and walking past it",
      note: "Not a code figure. It is the number that stops a plan from putting a queen bed 14 inches from a wall.",
    }),
  ],
  facts: (d) => {
    const w = num(d, "widthFt", 5);
    return [
      {
        key: "size",
        label: "Nominal size",
        value: w,
        unit: "ft",
        text:
          w >= 6 ? "King-ish" : w >= 4.9 ? "Queen-ish" : w >= 4.4 ? "Double-ish" : "Single-ish",
        note: "Named by width only. Mattress naming is not standardised across manufacturers.",
      },
    ];
  },
  build: (d) => {
    const w = num(d, "widthFt", 5);
    const l = num(d, "lengthFt", 80 * IN);
    const h = num(d, "heightFt", 2.0);
    // Headboard and mattress thickness are CONSTANT.
    return [
      part("base", "wood", box(w, Math.max(0.2, h - BED_MATTRESS_FT), l, 0, Math.max(0.1, (h - BED_MATTRESS_FT) / 2), 0)),
      part("mattress", "fabric", box(w - 0.1, BED_MATTRESS_FT, l - 0.1, 0, h - BED_MATTRESS_FT / 2, 0)),
      // The head is at −Z: the fixture's front (+Z) is the foot, which is the
      // side you approach.
      part("headboard", "wood", box(w, BED_HEADBOARD_FT + h * 0.4, 0.2, 0, h * 0.6 + (BED_HEADBOARD_FT + h * 0.4) / 2, -l / 2 - 0.1)),
      part("pillow", "fabric", box(w - 0.6, 0.3, 1.2, 0, h + 0.15, -l / 2 + 0.9)),
    ];
  },
};

const BED_MATTRESS_FT = 0.75;
const BED_HEADBOARD_FT = 1.2;

const sofa: FixtureKind = {
  id: "sofa",
  mount: "floor",
  label: "Sofa",
  tag: "SF",
  blurb: "Where the glazing wall gets looked at from.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 4, max: 12, step: 0.1, default: 7.0 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 2.4, max: 4.5, step: 0.05, default: 3.2 },
    { key: "heightFt", label: "Back height", unit: "ft", min: 2.0, max: 3.4, step: 0.05, default: 2.7 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 7),
    depthFt: num(d, "depthFt", 3.2),
    heightFt: num(d, "heightFt", 2.7),
  }),
  clearances: () => [
    rule({
      key: "front",
      label: "Legroom and passage",
      zone: "circulation",
      front: 2.5,
      back: 0,
      left: 0.5,
      right: 0.5,
      heightFt: null,
      basis: "indicative",
      source: "none — a working allowance for legs, a coffee table and a route past",
      note: "Not a code figure.",
    }),
  ],
  facts: () => [],
  build: (d) => {
    const w = num(d, "widthFt", 7);
    const dp = num(d, "depthFt", 3.2);
    const h = num(d, "heightFt", 2.7);
    // Arms, seat height and seat thickness are CONSTANT: a longer sofa is a
    // longer sofa, not a bigger one.
    const inner = Math.max(1.0, w - 2 * SOFA_ARM_FT);
    return [
      part("plinth", "wood", box(w, SOFA_SEAT_Y_FT - SOFA_SEAT_FT, dp - 0.3, 0, (SOFA_SEAT_Y_FT - SOFA_SEAT_FT) / 2, 0.1)),
      part("seat", "fabric", box(inner, SOFA_SEAT_FT, dp - 0.5, 0, SOFA_SEAT_Y_FT - SOFA_SEAT_FT / 2, 0.15)),
      part("back", "fabric", box(w, h - (SOFA_SEAT_Y_FT - SOFA_SEAT_FT), SOFA_BACK_FT, 0, (h + SOFA_SEAT_Y_FT - SOFA_SEAT_FT) / 2, -dp / 2 + SOFA_BACK_FT / 2)),
      part("arm-l", "fabric", box(SOFA_ARM_FT, SOFA_ARM_Y_FT, dp - 0.2, -(w - SOFA_ARM_FT) / 2, SOFA_ARM_Y_FT / 2, 0.05)),
      part("arm-r", "fabric", box(SOFA_ARM_FT, SOFA_ARM_Y_FT, dp - 0.2, (w - SOFA_ARM_FT) / 2, SOFA_ARM_Y_FT / 2, 0.05)),
    ];
  },
};

const SOFA_ARM_FT = 0.55;
const SOFA_ARM_Y_FT = 2.0;
const SOFA_SEAT_Y_FT = 1.4;
const SOFA_SEAT_FT = 0.45;
const SOFA_BACK_FT = 0.4;

/* ----------------------------------------------------------- WALL: AWG */

const awg: FixtureKind = {
  id: "awg",
  mount: "wall",
  label: "AWG unit",
  tag: "AW",
  blurb: "Atmospheric water generation — condensing drinking water out of the air.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 1.0, max: 4, step: 0.05, default: 2.0 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 0.7, max: 2.0, step: 0.05, default: 1.2 },
    { key: "heightFt", label: "Height", unit: "ft", min: 1.2, max: 5, step: 0.05, default: 3.0 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 2.0),
    depthFt: num(d, "depthFt", 1.2),
    heightFt: num(d, "heightFt", 3.0),
  }),
  clearances: () => [
    rule({
      key: "airflow",
      label: "Intake and discharge air",
      zone: "airflow",
      front: 2.0,
      back: 0,
      left: 0.5,
      right: 0.5,
      heightFt: null,
      basis: "manufacturer",
      source: "AWG unit installation manuals",
      note: "An AWG is a condenser: starve it of air and it produces nothing. The unit's manual carries the real figures.",
    }),
  ],
  facts: () => [
    {
      key: "yield",
      label: "Water yield",
      value: 0,
      unit: "",
      text: "Yield is climate-dependent and is NOT estimated here",
      note:
        "Atmospheric water output falls with temperature and with relative humidity, and in an Alberta winter it falls a very long way. This tool places the unit and reserves its air; it does not predict litres per day, because a number produced without the local psychrometric data would be fiction.",
    },
  ],
  build: (d) => {
    const w = num(d, "widthFt", 2.0);
    const dp = num(d, "depthFt", 1.2);
    const h = num(d, "heightFt", 3.0);
    return [
      part("case", "cabinet", box(w, h, dp, 0, h / 2, 0)),
      // Louvre and spout are CONSTANT.
      part("louvre", "steel", box(w - 0.3, 0.55, 0.05, 0, h * 0.72, dp / 2 + 0.03)),
      part("spout", "steel", box(0.35, 0.12, 0.25, 0, h * 0.3, dp / 2 + 0.12)),
    ];
  },
};

/* -------------------------------------------------- WALL: electrical panel */

const electricalPanel: FixtureKind = {
  id: "electrical-panel",
  mount: "wall",
  label: "Electrical panel",
  tag: "EP",
  blurb: "The distribution panel — and the working space in front of it, which is a real piece of floor.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 0.9, max: 2.5, step: 0.05, default: 1.3 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 0.25, max: 0.9, step: 0.05, default: 0.5 },
    { key: "heightFt", label: "Height", unit: "ft", min: 1.5, max: 4.5, step: 0.05, default: 2.6 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 1.3),
    depthFt: num(d, "depthFt", 0.5),
    heightFt: num(d, "heightFt", 2.6),
  }),
  clearances: (d) => {
    const w = num(d, "widthFt", 1.3);
    // The code's width is the greater of 750 mm and the equipment width, so
    // the side extension is whatever it takes to reach that.
    const side = Math.max(0, (750 * MM - w) / 2);
    return [
      rule({
        key: "working",
        label: "Working space",
        zone: "working-space",
        front: 1000 * MM,
        back: 0,
        left: side,
        right: side,
        heightFt: 2200 * MM,
        from: "floor",
        basis: "code",
        source:
          "Canadian Electrical Code (CSA C22.1) Rule 2-308, working space about electrical equipment — cited by name, figure not verified",
        note:
          "1 m of clear depth, a width of not less than 750 mm or the equipment width, and 2.2 m of headroom. This space must stay clear: it is not somewhere a cistern, a sofa or a set of shelves may end up. Verify the figures against the edition of the Code that the Alberta permit is issued under.",
      }),
    ];
  },
  facts: () => [
    {
      key: "access",
      label: "Access",
      value: 0,
      unit: "",
      text: "The working space must remain permanently clear",
      note: "An inspector will look at what is in front of the panel, not at what was in front of it on the drawing.",
    },
  ],
  build: (d) => {
    const w = num(d, "widthFt", 1.3);
    const dp = num(d, "depthFt", 0.5);
    const h = num(d, "heightFt", 2.6);
    return [
      part("can", "steel", box(w, h, dp, 0, h / 2, 0)),
      // The door lip is CONSTANT — it is a piece of folded steel, not a ratio.
      part("door", "steel", box(w - 0.06, h - 0.06, PANEL_DOOR_FT, 0, h / 2, dp / 2 + PANEL_DOOR_FT / 2)),
      part("handle", "steel", box(0.1, 0.35, 0.06, w / 2 - 0.14, h * 0.5, dp / 2 + PANEL_DOOR_FT + 0.03)),
    ];
  },
};

const PANEL_DOOR_FT = 0.06;

/* ------------------------------------------------------- WALL: thermostat */

const thermostat: FixtureKind = {
  id: "thermostat",
  mount: "wall",
  label: "Thermostat",
  tag: "TH",
  blurb: "Small, and the most position-sensitive object in the house.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 0.25, max: 0.8, step: 0.02, default: 0.42 },
    { key: "heightFt", label: "Height", unit: "ft", min: 0.2, max: 0.7, step: 0.02, default: 0.35 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 0.42),
    depthFt: THERMOSTAT_DEPTH_FT,
    heightFt: num(d, "heightFt", 0.35),
  }),
  clearances: () => [
    rule({
      key: "influence",
      label: "Away from anything that lies to it",
      zone: "service",
      front: 1.0,
      back: 0,
      left: 1.5,
      right: 1.5,
      heightFt: 2.0,
      basis: "indicative",
      source: "none — a working allowance around a sensor",
      note:
        "A thermostat in direct sun, above a heater, beside a door or on a cold exterior wall reports a temperature the room does not have, and the house then heats to the wrong one. This box is a reminder, not a rule; the resolver additionally flags a thermostat placed close to an opening.",
    }),
  ],
  facts: () => [
    {
      key: "height",
      label: "Mounting height",
      value: 1500 * MM,
      unit: "ft",
      text: "About 1.5 m above the floor is the usual mounting height",
      note: "Common practice, and it is also roughly where a wall-mounted control is reachable from a seated position. Not a code figure.",
    },
  ],
  build: (d) => {
    const w = num(d, "widthFt", 0.42);
    const h = num(d, "heightFt", 0.35);
    return [
      part("plate", "cabinet", box(w, h, THERMOSTAT_DEPTH_FT, 0, h / 2, 0)),
      part("screen", "glass", box(w - 0.1, h - 0.1, 0.02, 0, h / 2, THERMOSTAT_DEPTH_FT / 2 + 0.01)),
    ];
  },
};

const THERMOSTAT_DEPTH_FT = 0.13;

/* -------------------------------------------------- WALL: greywater valve */

const greywaterValve: FixtureKind = {
  id: "greywater-valve",
  mount: "wall",
  label: "Greywater diverter",
  tag: "GV",
  blurb: "The valve that sends greywater to reuse in summer and to the tank in winter. It has to be reachable.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 0.5, max: 2, step: 0.05, default: 0.9 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 0.3, max: 1.0, step: 0.05, default: 0.55 },
    { key: "heightFt", label: "Height", unit: "ft", min: 0.6, max: 2.5, step: 0.05, default: 1.2 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 0.9),
    depthFt: num(d, "depthFt", 0.55),
    heightFt: num(d, "heightFt", 1.2),
  }),
  clearances: () => [
    rule({
      key: "operate",
      label: "Room to operate and service",
      zone: "service",
      front: 2.0,
      back: 0,
      left: 0.5,
      right: 0.5,
      heightFt: null,
      basis: "indicative",
      source: "none — a working allowance for turning a valve and getting at a union",
      note:
        "A diverter that is behind a cistern is a diverter nobody switches over in October. The greywater SYSTEM itself is governed in Alberta by the Private Sewage Systems Standard of Practice and its permits — none of which this tool models.",
    }),
  ],
  facts: () => [
    {
      key: "seasonal",
      label: "Seasonal duty",
      value: 0,
      unit: "",
      text: "Summer to reuse, winter to the tank",
      note: "A greywater reuse field that freezes is a greywater backup. The diverter is the whole reason that is a switch and not a rebuild.",
    },
  ],
  build: (d) => {
    const w = num(d, "widthFt", 0.9);
    const dp = num(d, "depthFt", 0.55);
    const h = num(d, "heightFt", 1.2);
    return [
      part("body", "cabinet", box(w, h, dp, 0, h / 2, 0)),
      // Rotate FIRST, then translate: a rotate after a translate would swing
      // the handle around the fixture origin instead of standing it up.
      part("handle", "steel", cyl(0.09, 0.5).rotateX(Math.PI / 2).translate(0, h * 0.6, dp / 2 + 0.25)),
      part("pipe-in", "steel", cyl(0.16, 0.4, 0, h + 0.2, 0, 10)),
      part("pipe-out", "steel", cyl(0.16, 0.4, 0, -0.05, 0, 10)),
    ];
  },
};

/* ------------------------------------------------------ WALL: wall heater */

const wallHeater: FixtureKind = {
  id: "wall-heater",
  mount: "wall",
  label: "Wall heater",
  tag: "WH",
  blurb: "Backup or shoulder-season heat where the stove does not reach.",
  dimensions: [
    { key: "widthFt", label: "Width", unit: "ft", min: 1.0, max: 4.5, step: 0.05, default: 2.4 },
    { key: "depthFt", label: "Depth", unit: "ft", min: 0.25, max: 1.0, step: 0.05, default: 0.5 },
    { key: "heightFt", label: "Height", unit: "ft", min: 0.6, max: 2.5, step: 0.05, default: 1.4 },
  ],
  options: [],
  extents: (d) => ({
    widthFt: num(d, "widthFt", 2.4),
    depthFt: num(d, "depthFt", 0.5),
    heightFt: num(d, "heightFt", 1.4),
  }),
  clearances: () => [
    rule({
      key: "combustible",
      label: "To combustibles and furnishings",
      zone: "combustible",
      front: 3.0,
      back: 0,
      left: 0.5,
      right: 0.5,
      heightFt: null,
      basis: "manufacturer",
      source: "wall-heater installation manuals — a typical figure for the product class",
      note:
        "Commonly 3 ft in front, 6 in at the sides and 12 in above for a residential wall heater, but this varies by unit and by fuel and the manual is the authority. It is flagged in the combustible zone deliberately: a curtain or a sofa back inside this box is the actual failure mode.",
    }),
    rule({
      key: "above",
      label: "Above the unit",
      zone: "combustible",
      front: 0,
      back: 0,
      left: 0,
      right: 0,
      heightFt: 1.0,
      from: "top",
      basis: "manufacturer",
      source: "wall-heater installation manuals",
      note: "Typical. Drawn as a slab above the unit so a shelf placed over it is visible.",
    }),
  ],
  facts: () => [],
  build: (d) => {
    const w = num(d, "widthFt", 2.4);
    const dp = num(d, "depthFt", 0.5);
    const h = num(d, "heightFt", 1.4);
    const parts: FixturePart[] = [part("case", "cabinet", box(w, h, dp, 0, h / 2, 0))];
    // Three grille bars, always three, always the same thickness.
    for (let i = 0; i < 3; i++) {
      parts.push(
        part(`grille${i}`, "steel", box(w - 0.25, 0.09, 0.04, 0, h * (0.32 + i * 0.18), dp / 2 + 0.03)),
      );
    }
    return parts;
  },
};

/* -------------------------------------------------------- ROOF: PV array */

const solarArray: FixtureKind = {
  id: "solar-array",
  mount: "roof",
  label: "Solar array",
  tag: "PV",
  blurb: "Sized in kW, drawn at the area that many modules actually cover, on a plane at the roof's own pitch.",
  dimensions: [
    { key: "kw", label: "Array size", unit: "kW", min: 0.5, max: 30, step: 0.1, default: 6.0 },
    /* 3 rows is the default because it is what fits the Aura reference home:
       a 6 kW array laid 2 rows deep is 30 ft across and the reference gable
       plane is 26.5 ft, so the tool would open by reporting a fixture that
       does not fit. Three rows is also a normal residential portrait layout,
       so this is a better default rather than a number chosen to hide a
       warning — and if it still does not fit, the warning is the point. */
    { key: "rowsDeep", label: "Rows up the slope", unit: "count", min: 1, max: 8, step: 1, default: 3, hint: "modules stacked up the slope; the rest go across" },
  ],
  options: [],
  extents: (d) => {
    const g = pvGrid(d);
    return { widthFt: g.acrossFt, depthFt: g.alongSlopeFt, heightFt: PV_THICKNESS_FT + PV_STANDOFF_FT };
  },
  clearances: () => [
    rule({
      key: "edge",
      label: "Roof-edge setback",
      zone: "service",
      front: 1.0,
      back: 1.0,
      left: 1.0,
      right: 1.0,
      heightFt: 0.2,
      basis: "indicative",
      source:
        "none — a working setback so modules are not hung over an eave or a rake. Fire-service access setbacks are set by the authority having jurisdiction; there is no single national figure that applies in Alberta, and the well-known 3-foot ridge setback belongs to the California Fire Code and is NOT quoted here as if it did.",
      note:
        "Keeps the array off the edge for wind uplift and for anyone working on the roof. Ask the AHJ what access path, if any, it requires before the array is finalised.",
    }),
  ],
  facts: (d) => {
    const g = pvGrid(d);
    return [
      {
        key: "modules",
        label: "Modules",
        value: g.modules,
        unit: "",
        text: `${g.modules} modules at ${PV_MODULE_WATTS} W nominal (${g.cols} across × ${g.rows} up the slope)`,
        note: `Module size is an indicative ${(PV_MODULE_W_FT * 12).toFixed(0)} × ${(PV_MODULE_H_FT * 12).toFixed(0)} in, close to a common 400 W panel. The real module comes from the supplier.`,
      },
      {
        key: "area",
        label: "Array area",
        value: g.areaSqFt,
        unit: "sq ft",
        text: `${g.areaSqFt.toFixed(0)} sq ft measured ON the slope`,
        note: `The drawing engine's ${ARRAY_SQ_FT_PER_KW} sq ft per kW rule of thumb gives ${(num(d, "kw", 6) * ARRAY_SQ_FT_PER_KW).toFixed(0)} sq ft for this size; the module grid is the number drawn.`,
      },
      {
        key: "dc",
        label: "Nominal DC",
        value: (g.modules * PV_MODULE_WATTS) / 1000,
        unit: "kW",
        text: `${((g.modules * PV_MODULE_WATTS) / 1000).toFixed(2)} kW DC as laid out`,
        note:
          "Nameplate DC only. Annual yield depends on latitude, tilt, azimuth, shading, snow cover and inverter losses, and is not estimated here.",
      },
    ];
  },
  build: (d, _o, ctx) => {
    const g = pvGrid(d);
    const parts: FixturePart[] = [];
    // Built in the TILTED frame: the along-slope axis is the roof's fall axis,
    // so after the single tilt rotation the modules lie in the roof plane.
    const alongIsX = ctx.fallAxis === "x";
    const sizeAlong = PV_MODULE_H_FT;
    const sizeAcross = PV_MODULE_W_FT;

    if (g.modules > PV_MAX_DRAWN_MODULES) {
      // An honest slab rather than 400 boxes: the area is right, the grain is
      // not drawn, and the schedule still reports the module count.
      const w = alongIsX ? g.alongSlopeFt : g.acrossFt;
      const dp = alongIsX ? g.acrossFt : g.alongSlopeFt;
      parts.push(part("slab", "pv", box(w, PV_THICKNESS_FT, dp, 0, 0, 0)));
      parts.push(part("rail", "steel", box(w, PV_RAIL_FT, dp, 0, -PV_THICKNESS_FT / 2 - PV_RAIL_FT / 2, 0)));
      return parts;
    }

    const pitchAlong = sizeAlong + PV_GAP_FT;
    const pitchAcross = sizeAcross + PV_GAP_FT;
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        if (r * g.cols + c >= g.modules) break;
        const a = (r - (g.rows - 1) / 2) * pitchAlong;
        const s = (c - (g.cols - 1) / 2) * pitchAcross;
        const x = alongIsX ? a : s;
        const z = alongIsX ? s : a;
        const w = alongIsX ? sizeAlong : sizeAcross;
        const dp = alongIsX ? sizeAcross : sizeAlong;
        parts.push(part(`m${r}-${c}`, "pv", box(w, PV_THICKNESS_FT, dp, x, 0, z)));
      }
    }
    // Two rails, always two, always the same section. Constant, on purpose.
    const railAlong = alongIsX ? g.alongSlopeFt : PV_RAIL_W_FT;
    const railAcross = alongIsX ? PV_RAIL_W_FT : g.alongSlopeFt;
    const off = (alongIsX ? g.acrossFt : g.alongSlopeFt) * 0.3;
    for (const sgn of [-1, 1]) {
      const x = alongIsX ? 0 : sgn * off;
      const z = alongIsX ? sgn * off : 0;
      parts.push(
        part(
          `rail${sgn > 0 ? "b" : "a"}`,
          "steel",
          box(railAlong, PV_RAIL_FT, railAcross, x, -PV_THICKNESS_FT / 2 - PV_RAIL_FT / 2, z),
        ),
      );
    }
    return parts;
  },
};

const PV_RAIL_FT = 0.12;
const PV_RAIL_W_FT = 0.16;

/** The module grid for an array size. Deterministic, and the single place the
 *  array's real extent is decided. */
export function pvGrid(d: Dims): {
  modules: number;
  rows: number;
  cols: number;
  alongSlopeFt: number;
  acrossFt: number;
  areaSqFt: number;
} {
  const kw = Math.max(0.1, num(d, "kw", 6));
  const modules = Math.max(1, Math.ceil((kw * 1000) / PV_MODULE_WATTS));
  const rows = Math.max(1, Math.min(Math.round(num(d, "rowsDeep", 2)), modules));
  const cols = Math.ceil(modules / rows);
  return {
    modules,
    rows,
    cols,
    alongSlopeFt: rows * PV_MODULE_H_FT + (rows - 1) * PV_GAP_FT,
    acrossFt: cols * PV_MODULE_W_FT + (cols - 1) * PV_GAP_FT,
    areaSqFt: modules * PV_MODULE_W_FT * PV_MODULE_H_FT,
  };
}

/* ------------------------------------------------------------ the catalogue */

export const FIXTURE_CATALOG: Readonly<Record<FixtureKindId, FixtureKind>> = {
  "wood-stove": woodStove,
  "hot-tub": hotTub,
  cistern,
  "battery-bank": batteryBank,
  hrv,
  "kitchen-island": kitchenIsland,
  bed,
  sofa,
  awg,
  "electrical-panel": electricalPanel,
  thermostat,
  "greywater-valve": greywaterValve,
  "wall-heater": wallHeater,
  "solar-array": solarArray,
};

/** Palette order: the systems that shape a plan first, the furniture last. */
export const FIXTURE_KIND_IDS: readonly FixtureKindId[] = [
  "wood-stove",
  "battery-bank",
  "cistern",
  "hrv",
  "hot-tub",
  "kitchen-island",
  "bed",
  "sofa",
  "electrical-panel",
  "awg",
  "wall-heater",
  "thermostat",
  "greywater-valve",
  "solar-array",
];

export const kindsByMount = (mount: FixtureMount): FixtureKind[] =>
  FIXTURE_KIND_IDS.map((id) => FIXTURE_CATALOG[id]).filter((k) => k.mount === mount);

/** The dimension defaults for a kind — the starting point for a new fixture. */
export const defaultDims = (kind: FixtureKind): Record<string, number> =>
  Object.fromEntries(kind.dimensions.map((d) => [d.key, d.default]));

export const defaultOpts = (kind: FixtureKind): Record<string, string> =>
  Object.fromEntries(kind.options.map((o) => [o.key, o.default]));

/** Clamp a morph dimension to its declared range and step. Deterministic, and
 *  the reason two people typing "6.03" get the same fixture. */
export function clampDim(kind: FixtureKind, key: string, value: number): number {
  const spec = kind.dimensions.find((d) => d.key === key);
  if (!spec) return value;
  if (!Number.isFinite(value)) return spec.default;
  const stepped = Math.round(value / spec.step) * spec.step;
  const clamped = Math.min(spec.max, Math.max(spec.min, stepped));
  // Kill the float dust `round(x/step)*step` leaves behind.
  return Number(clamped.toFixed(6));
}

/** Set one named dimension. THIS is the morph: it never touches the others,
 *  and the geometry is rebuilt from the named set rather than scaled. */
export function morph(kind: FixtureKind, dims: Dims, key: string, value: number): Record<string, number> {
  return { ...dims, [key]: clampDim(kind, key, value) };
}

/* ===========================================================================
   PLACEMENT
   =========================================================================== */

/** Which floor a floor fixture stands on. The deck is a real host: the
 *  wood-fired tub belongs on it, and `HomeSpec.Deck` already reserves a spot
 *  for the ONE tub the shell knows about — see `resolveFixtures`, which warns
 *  when both exist so nobody counts two. */
export type FixtureHost =
  | { kind: "volume"; volumeId: string }
  | { kind: "deck" };

export interface FloorPlacement {
  mount: "floor";
  host: FixtureHost;
  /** plan position in the host frame, feet */
  x: number;
  z: number;
  /** yaw, degrees clockwise from the host frame's +Z. 0 faces +Z. */
  rotationDeg: number;
}

export interface WallPlacement {
  mount: "wall";
  volumeId: string;
  wall: Wall;
  /** along the wall's BUILT run from run = 0, the same origin and direction
   *  `Opening.offsetFt` uses: left-to-right seen from outside */
  offsetFt: number;
  /** centre of the fixture above the finished floor */
  heightFt: number;
  face: "inside" | "outside";
}

export interface RoofPlacement {
  mount: "roof";
  volumeId: string;
  /** index into the volume's `RoofSection.planes` */
  planeIndex: number;
  /** position on the roof's fall axis and on the perpendicular axis, in the
   *  volume's local plan frame, feet */
  a: number;
  s: number;
}

export type FixturePlacement = FloorPlacement | WallPlacement | RoofPlacement;

export interface PlacedFixture {
  id: string;
  kind: FixtureKindId;
  /** what the owner calls this one; "" falls back to the kind's label */
  label: string;
  dims: Record<string, number>;
  options: Record<string, string>;
  placement: FixturePlacement;
}

export interface FixtureSet {
  version: typeof FIXTURES_VERSION;
  items: PlacedFixture[];
}

export const emptyFixtureSet = (): FixtureSet => ({ version: FIXTURES_VERSION, items: [] });

/** A stable id: the kind plus the lowest free number. No counters, no clock. */
export function newFixtureId(kind: FixtureKindId, set: FixtureSet): string {
  for (let n = 1; ; n++) {
    const id = `${kind}-${n}`;
    if (!set.items.some((i) => i.id === id)) return id;
  }
}

/* ===========================================================================
   THE HOST FRAMES — where a fixture is allowed to be

   All of this is done in a volume's LOCAL frame, which is exact: `spec.ts`
   guarantees a volume is a rectangle, so its floor polygon IS a rectangle, and
   the deck's is another one in the same frame. That is worth saying plainly
   rather than dressing a rectangle up as a general polygon clip.
   =========================================================================== */

/** The single transform the scene applies to everything in a host. Identical
 *  to `VolumeGeometry.origin` / `.rotationY` in geometry.ts, on purpose. */
export interface FixtureFrame {
  /** world position of the frame origin */
  origin: readonly [number, number, number];
  /** radians about +Y */
  rotationY: number;
  /** the volume whose frame this is (the deck borrows volume[0]'s) */
  volumeId: string;
  /** the volume's own bearing, for composing world rotations */
  rotationDeg: number;
}

/** A wall a floor fixture can back onto. */
export interface FloorWallEdge {
  wall: Wall;
  /** the axis the wall runs along in the host frame */
  runAxis: "x" | "z";
  /** the coordinate of the wall's INNER face on the other axis */
  facePos: number;
  /** which way the room is from that face: +1 or −1 on the other axis */
  inward: 1 | -1;
  /** the yaw a fixture takes when it backs onto this wall */
  facingDeg: number;
  /** true when the wall is actually built (an a-frame has only two) */
  built: boolean;
}

export interface FloorRegion {
  host: FixtureHost;
  label: string;
  frame: FixtureFrame;
  /** the rectangle a fixture's body must stay inside, in the host frame */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** the walking surface, relative to finished floor */
  floorY: number;
  edges: FloorWallEdge[];
  /** the ceiling/eave a hung fixture must stay under, or null on the deck */
  headroomFt: number | null;
}

/** A fixture facing directly away from a wall, in the host frame. Derived
 *  once here so a sign error has one place to live: at rotationDeg 0 a
 *  fixture faces the frame's +Z, and `yawFromBearingDeg` is the sign. */
export const WALL_FACING_DEG: Readonly<Record<Wall, number>> = { n: 0, s: 180, e: 90, w: 270 };

const findVolume = (spec: HomeSpec, id: string): Volume | null =>
  spec.volumes.find((v) => v.id === id) ?? null;

const frameOf = (v: Volume): FixtureFrame => ({
  origin: [v.x, 0, v.z] as const,
  rotationY: yawFromBearingDeg(v.rotationDeg),
  volumeId: v.id,
  rotationDeg: v.rotationDeg,
});

/** The floor region of one volume: the inner face rectangle. */
export function volumeFloorRegion(spec: HomeSpec, volumeId: string): FloorRegion | null {
  const v = findVolume(spec, volumeId);
  if (!v) return null;
  const t = wallThicknessFt(spec);
  const roof = roofSectionFor(v, t);
  const hw = Math.max(0.5, v.widthFt / 2 - t);
  const hd = Math.max(0.5, v.depthFt / 2 - t);
  const edges: FloorWallEdge[] = (["n", "s", "e", "w"] as Wall[]).map((wall) => {
    const runAxis = WALL_RUN_AXIS[wall];
    const facePos =
      wall === "n" ? -hd : wall === "s" ? hd : wall === "e" ? hw : -hw;
    const inward: 1 | -1 = wall === "n" || wall === "w" ? 1 : -1;
    return { wall, runAxis, facePos, inward, facingDeg: WALL_FACING_DEG[wall], built: roof.buildsWall(wall) };
  });
  return {
    host: { kind: "volume", volumeId: v.id },
    label: v.name,
    frame: frameOf(v),
    minX: -hw,
    maxX: hw,
    minZ: -hd,
    maxZ: hd,
    floorY: 0,
    edges,
    headroomFt: roof.eaveY,
  };
}

/**
 * The deck's floor region, in the HOST VOLUME's frame.
 *
 * Mirrors `geometry.ts::deckCornersPlan` and `drawings/model.ts::deckModel`:
 * the deck hangs off the first volume and lives in its frame, so a fixture on
 * the deck needs no second transform and can never drift off it.
 */
export function deckFloorRegion(spec: HomeSpec): FloorRegion | null {
  const deck = spec.deck;
  const host = spec.volumes[0];
  if (!deck || !host) return null;
  const runsAlongX = WALL_RUN_AXIS[deck.wall] === "x";
  const face = runsAlongX ? host.depthFt / 2 : host.widthFt / 2;
  const out: Pt = deck.wall === "n" ? [0, -1] : deck.wall === "s" ? [0, 1] : deck.wall === "e" ? [1, 0] : [-1, 0];
  const cx = out[0] * (face + deck.depthFt / 2);
  const cz = out[1] * (face + deck.depthFt / 2);
  const w = runsAlongX ? deck.widthFt : deck.depthFt;
  const d = runsAlongX ? deck.depthFt : deck.widthFt;
  // The house wall the deck runs against is the one edge a deck fixture can
  // back onto; the other three are open air with no wall to snap to.
  //
  // The facing is REVERSED from the volume case, and that reversal is the
  // whole difference between the two: inside the house a fixture backed onto
  // the south wall faces north into the room, and on the deck the same wall
  // is at your back while you look south, away from the building.
  const houseEdge: FloorWallEdge = {
    wall: deck.wall,
    runAxis: WALL_RUN_AXIS[deck.wall],
    facePos: runsAlongX ? cz - out[1] * (d / 2) : cx - out[0] * (w / 2),
    inward: (out[runsAlongX ? 1 : 0] > 0 ? 1 : -1) as 1 | -1,
    facingDeg: (WALL_FACING_DEG[deck.wall] + 180) % 360,
    built: true,
  };
  return {
    host: { kind: "deck" },
    label: "Deck",
    frame: frameOf(host),
    minX: cx - w / 2,
    maxX: cx + w / 2,
    minZ: cz - d / 2,
    maxZ: cz + d / 2,
    // One step down from finished floor, matching geometry.ts's DECK_STEP_FT.
    floorY: -DECK_STEP_FT,
    edges: [houseEdge],
    headroomFt: null,
  };
}

export function floorRegion(spec: HomeSpec, host: FixtureHost): FloorRegion | null {
  return host.kind === "deck" ? deckFloorRegion(spec) : volumeFloorRegion(spec, host.volumeId);
}

/** Every floor region a fixture could be dropped into. */
export function floorRegions(spec: HomeSpec): FloorRegion[] {
  const out: FloorRegion[] = [];
  for (const v of spec.volumes) {
    const r = volumeFloorRegion(spec, v.id);
    if (r) out.push(r);
  }
  const deck = deckFloorRegion(spec);
  if (deck) out.push(deck);
  return out;
}

/* ===========================================================================
   ORIENTED BOXES — the whole collision story, in about sixty lines

   Every body and every clearance is a rectangle in plan with a yaw plus a
   height interval. Two of those overlap exactly when their plan rectangles
   overlap AND their height intervals do, and two convex rectangles overlap
   exactly when no one of their four edge normals separates them. That is the
   separating-axis theorem, it is twenty lines, and it is exact — which is
   worth far more here than a bounding-sphere approximation would be, because
   the answer decides whether the tool says a stove clearance is satisfied.
   =========================================================================== */

export interface Obb {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  /** same convention as `FloorPlacement.rotationDeg` */
  rotationDeg: number;
}

/** Rotate a direction in a frame by a bearing, using the repo's one sign. */
export function rotateLocal(rotationDeg: number, lx: number, lz: number): Pt {
  const yaw = yawFromBearingDeg(rotationDeg);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [lx * c + lz * s, -lx * s + lz * c];
}

export function obbCorners(o: Obb): Pt[] {
  return (
    [
      [-o.halfW, -o.halfD],
      [o.halfW, -o.halfD],
      [o.halfW, o.halfD],
      [-o.halfW, o.halfD],
    ] as const
  ).map(([x, z]) => {
    const r = rotateLocal(o.rotationDeg, x, z);
    return [o.cx + r[0], o.cz + r[1]] as Pt;
  });
}

const project = (pts: readonly Pt[], ax: number, az: number): { min: number; max: number } => {
  let min = Infinity;
  let max = -Infinity;
  for (const p of pts) {
    const d = p[0] * ax + p[1] * az;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
};

/** Do two oriented plan rectangles overlap? SAT, exact, no tolerance games
 *  beyond one epsilon so a fixture snapped flush to another does not read as
 *  a collision. */
export function obbOverlap(a: Obb, b: Obb, tol = 1e-6): boolean {
  const ca = obbCorners(a);
  const cb = obbCorners(b);
  const axes: Pt[] = [];
  for (const o of [a, b]) {
    axes.push(rotateLocal(o.rotationDeg, 1, 0), rotateLocal(o.rotationDeg, 0, 1));
  }
  for (const [ax, az] of axes) {
    const pa = project(ca, ax, az);
    const pb = project(cb, ax, az);
    if (pa.max <= pb.min + tol || pb.max <= pa.min + tol) return false;
  }
  return true;
}

const rangesOverlap = (a: readonly [number, number], b: readonly [number, number], tol = 1e-6): boolean =>
  a[1] > b[0] + tol && b[1] > a[0] + tol;

/** Is every corner of this box inside the axis-aligned region rectangle? */
function obbInsideRect(o: Obb, r: { minX: number; maxX: number; minZ: number; maxZ: number }, tol = 1e-6): boolean {
  return obbCorners(o).every(
    (p) => p[0] >= r.minX - tol && p[0] <= r.maxX + tol && p[1] >= r.minZ - tol && p[1] <= r.maxZ + tol,
  );
}

/* ===========================================================================
   SNAPPING
   =========================================================================== */

export interface SnapResult<P> {
  placement: P;
  /** what the snap actually did, in plain sentences for the UI */
  notes: string[];
  /** true when the request would have put the fixture outside its host */
  clamped: boolean;
  /**
   * false when the fixture cannot fit its host AT ALL — a stove wider than the
   * cabin, an array longer than the roof plane. Separate from `clamped`,
   * because being held inside a room is normal and being unable to be in it is
   * not, and the two deserve different volume in the UI.
   */
  fits: boolean;
  /** the wall it ended up against, when it snapped to one */
  snappedTo: Wall | null;
}

const grid = (v: number, step: number): number => Number((Math.round(v / step) * step).toFixed(6));

/**
 * Snap a floor fixture into its region.
 *
 * The order matters and is deliberate:
 *   1. if the requested position is within `WALL_SNAP_FT` of a built wall,
 *      the fixture turns to face away from it and its BACK goes flat against
 *      the inner face — because that is what somebody dragging a sofa toward
 *      a wall means, and half an inch of gap is not a design decision;
 *   2. otherwise the position lands on the quarter-foot grid;
 *   3. either way the body is clamped inside the region. NOTHING is ever
 *      placed outside the envelope, and if a clamp was needed it is reported
 *      rather than performed silently.
 */
export function snapFloor(
  region: FloorRegion,
  kind: FixtureKind,
  dims: Dims,
  options: Opts,
  want: { x: number; z: number; rotationDeg: number },
): SnapResult<FloorPlacement> {
  const notes: string[] = [];
  const ext = kind.extents(dims, options);
  let rotationDeg = ((Math.round(want.rotationDeg / 15) * 15) % 360 + 360) % 360;
  let x = want.x;
  let z = want.z;
  let snappedTo: Wall | null = null;

  // 1. wall snap
  let best: { edge: FloorWallEdge; dist: number } | null = null;
  for (const e of region.edges) {
    if (!e.built) continue;
    const along = e.runAxis === "x" ? z : x;
    const dist = Math.abs(along - e.facePos);
    if (dist <= WALL_SNAP_FT && (!best || dist < best.dist)) best = { edge: e, dist };
  }
  if (best) {
    const e = best.edge;
    rotationDeg = e.facingDeg;
    // The back face is half the DEPTH away from the centre once the fixture
    // is square to the wall, which it now is.
    const back = ext.depthFt / 2 + SNAP_GAP_FT;
    const seated = e.facePos + e.inward * back;
    if (e.runAxis === "x") z = seated;
    else x = seated;
    snappedTo = e.wall;
    notes.push(`Snapped flat against the ${e.wall.toUpperCase()} wall.`);
  }

  // 2. grid
  if (!best) {
    x = grid(x, FLOOR_GRID_FT);
    z = grid(z, FLOOR_GRID_FT);
  } else if (best.edge.runAxis === "x") {
    x = grid(x, FLOOR_GRID_FT);
  } else {
    z = grid(z, FLOOR_GRID_FT);
  }

  // 3. clamp the BODY inside the region
  const half = halfExtentsInPlan(ext.widthFt, ext.depthFt, rotationDeg);
  const minX = region.minX + half.x;
  const maxX = region.maxX - half.x;
  const minZ = region.minZ + half.z;
  const maxZ = region.maxZ - half.z;
  let clamped = false;
  let fits = true;
  if (minX > maxX || minZ > maxZ) {
    fits = false;
    // The fixture does not fit at all. Centre it and say so — a fixture
    // silently shrunk to fit would be a lie about the product.
    x = (region.minX + region.maxX) / 2;
    z = (region.minZ + region.maxZ) / 2;
    clamped = true;
    notes.push(
      `${kind.label} is larger than ${region.label}. It is drawn centred and overhanging; either the fixture or the volume has to change.`,
    );
  } else {
    const cx = Math.min(maxX, Math.max(minX, x));
    const cz = Math.min(maxZ, Math.max(minZ, z));
    if (Math.abs(cx - x) > 1e-6 || Math.abs(cz - z) > 1e-6) {
      clamped = true;
      notes.push(`Held inside ${region.label} — it cannot be placed outside the envelope.`);
    }
    x = cx;
    z = cz;
  }

  return {
    placement: { mount: "floor", host: region.host, x: Number(x.toFixed(6)), z: Number(z.toFixed(6)), rotationDeg },
    notes,
    clamped,
    fits,
    snappedTo,
  };
}

/** Half-extents of a yawed rectangle on the frame axes. */
function halfExtentsInPlan(widthFt: number, depthFt: number, rotationDeg: number): { x: number; z: number } {
  const a = rotateLocal(rotationDeg, widthFt / 2, 0);
  const b = rotateLocal(rotationDeg, 0, depthFt / 2);
  return { x: Math.abs(a[0]) + Math.abs(b[0]), z: Math.abs(a[1]) + Math.abs(b[1]) };
}

/** What a wall offers a wall fixture. */
export interface WallSlot {
  volumeId: string;
  volumeName: string;
  wall: Wall;
  runFt: number;
  thicknessFt: number;
  /** the wall's top edge in (run, height), from the drawing model */
  topProfile: Pt[];
  built: boolean;
  /** openings already on this wall, in run coordinates, so a panel does not
   *  get mounted over a window */
  openings: { id: string; from: number; to: number; sillFt: number; headFt: number }[];
  frame: FixtureFrame;
}

export function wallSlots(spec: HomeSpec, volumeId: string): WallSlot[] {
  const v = findVolume(spec, volumeId);
  if (!v) return [];
  const t = wallThicknessFt(spec);
  const roof = roofSectionFor(v, t);
  return (["n", "s", "e", "w"] as Wall[]).map((wall) => {
    const runFt = wallRunFt(v, wall, t);
    return {
      volumeId: v.id,
      volumeName: v.name,
      wall,
      runFt,
      thicknessFt: t,
      topProfile: wallTopProfile(v, wall, roof, t),
      built: roof.buildsWall(wall),
      openings: v.openings
        .filter((o) => o.wall === wall)
        .map((o) => {
          const from = Math.min(Math.max(0, o.offsetFt), runFt);
          const to = Math.min(Math.max(from, o.offsetFt + Math.max(0, o.widthFt)), runFt);
          return { id: o.id, from, to, sillFt: o.sillFt, headFt: o.sillFt + Math.max(0, o.heightFt) };
        }),
      frame: frameOf(v),
    };
  });
}

/** Height of a wall's top edge at a run position, interpolated along the
 *  profile. Mirrors the private `profileHeightAt` in drawings/model.ts. */
export function wallTopAt(profile: readonly Pt[], run: number): number {
  if (profile.length === 0) return 0;
  if (run <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1];
    const b = profile[i];
    if (run <= b[0]) {
      const span = b[0] - a[0];
      return span <= 1e-9 ? b[1] : a[1] + ((run - a[0]) / span) * (b[1] - a[1]);
    }
  }
  return profile[profile.length - 1][1];
}

/**
 * Snap a wall fixture along a wall.
 *
 * Along the run and up the wall, both on a quarter-foot grid, both clamped so
 * the fixture's own rectangle stays inside the wall — including under the
 * SLOPING top edge of a gable end, which is the case a naive height clamp
 * gets wrong and then hangs a panel out through the roof.
 */
export function snapWall(
  slot: WallSlot,
  kind: FixtureKind,
  dims: Dims,
  options: Opts,
  want: { offsetFt: number; heightFt: number; face: "inside" | "outside" },
): SnapResult<WallPlacement> {
  const notes: string[] = [];
  const ext = kind.extents(dims, options);
  const halfW = ext.widthFt / 2;
  const halfH = ext.heightFt / 2;
  let clamped = false;
  let fits = true;

  let offsetFt = grid(want.offsetFt, WALL_GRID_FT);
  const minOff = halfW;
  const maxOff = slot.runFt - halfW;
  if (minOff > maxOff) {
    offsetFt = slot.runFt / 2;
    clamped = true;
    fits = false;
    notes.push(`${kind.label} is wider than the ${slot.wall.toUpperCase()} wall of ${slot.volumeName}.`);
  } else {
    const c = Math.min(maxOff, Math.max(minOff, offsetFt));
    if (Math.abs(c - offsetFt) > 1e-6) {
      clamped = true;
      notes.push("Held inside the wall's built run.");
    }
    offsetFt = c;
  }

  // The wall's top over the fixture's own width, taken at both ends and at
  // any vertex between them: on a gable end the low end is what constrains it.
  const lowestTop = Math.min(
    wallTopAt(slot.topProfile, Math.max(0, offsetFt - halfW)),
    wallTopAt(slot.topProfile, Math.min(slot.runFt, offsetFt + halfW)),
  );

  let heightFt = grid(want.heightFt, WALL_GRID_FT);
  const minH = halfH + WALL_ITEM_FLOOR_CLEAR_FT;
  const maxH = lowestTop - halfH - WALL_ITEM_TOP_CLEAR_FT;
  if (minH > maxH) {
    heightFt = Math.max(minH, lowestTop / 2);
    clamped = true;
    fits = false;
    notes.push(`${kind.label} is taller than the wall at that point.`);
  } else {
    const c = Math.min(maxH, Math.max(minH, heightFt));
    if (Math.abs(c - heightFt) > 1e-6) {
      clamped = true;
      notes.push("Held under the wall's top edge.");
    }
    heightFt = c;
  }

  if (!slot.built) {
    notes.push(
      `The ${slot.wall.toUpperCase()} side of ${slot.volumeName} is roof, not wall — an A-frame's slope IS its wall. Nothing can be mounted there.`,
    );
  }

  return {
    placement: {
      mount: "wall",
      volumeId: slot.volumeId,
      wall: slot.wall,
      offsetFt: Number(offsetFt.toFixed(6)),
      heightFt: Number(heightFt.toFixed(6)),
      face: want.face,
    },
    notes,
    clamped,
    fits: fits && slot.built,
    snappedTo: slot.wall,
  };
}

const WALL_ITEM_FLOOR_CLEAR_FT = 0.25;
const WALL_ITEM_TOP_CLEAR_FT = 0.25;

/** A roof plane a roof fixture can sit on, with the facts needed to choose. */
export interface RoofSlot {
  volumeId: string;
  volumeName: string;
  planeIndex: number;
  plane: RoofPlane;
  section: RoofSection;
  /** the plane's own pitch, degrees — the tilt the array is actually at */
  pitchDeg: number;
  /** compass bearing the plane faces downhill, degrees clockwise from north */
  azimuthDeg: number;
  /** area of the plane measured ON the slope, sq ft */
  areaSqFt: number;
  frame: FixtureFrame;
}

export function roofSlots(spec: HomeSpec, volumeId: string): RoofSlot[] {
  const v = findVolume(spec, volumeId);
  if (!v) return [];
  const t = wallThicknessFt(spec);
  const section = roofSectionFor(v, t);
  const cosT = Math.max(1e-6, Math.cos(section.angleRad));
  return section.planes.map((plane, planeIndex) => {
    const dirSign: 1 | -1 = plane.a1 >= plane.a0 ? 1 : -1;
    // Downhill direction in the volume's local frame, then into the world.
    const local: Pt = section.fallAxis === "x" ? [dirSign, 0] : [0, dirSign];
    const world = rotDir(v, local[0], local[1]);
    // World north is −Z and east is +X, so a bearing clockwise from north is
    // atan2(dx, −dz). A south-facing slope reads 180.
    const azimuthDeg = (((Math.atan2(world[0], -world[1]) * 180) / Math.PI) % 360 + 360) % 360;
    const planRun = Math.abs(plane.a1 - plane.a0);
    const slopeRun = planRun / cosT;
    return {
      volumeId: v.id,
      volumeName: v.name,
      planeIndex,
      plane,
      section,
      pitchDeg: (section.angleRad * 180) / Math.PI,
      azimuthDeg,
      areaSqFt: slopeRun * Math.abs(plane.s1 - plane.s0),
      frame: frameOf(v),
    };
  });
}

/**
 * The plane whose downhill face is closest to due south, which in the northern
 * hemisphere is the one an array wants.
 *
 * `|180 − azimuth|` is exactly the angular distance from south for an azimuth
 * in [0, 360), so no wrap-around case is hiding here. TIES ARE REAL and are
 * broken by the lower index: a gable falls across the volume's WIDTH, so an
 * un-rotated gable offers an east plane and a west plane and neither is more
 * southerly than the other. Rotating the volume, or choosing a shed or a
 * saltbox, is what actually gives an array a south face.
 */
export function bestRoofSlot(spec: HomeSpec, volumeId: string): RoofSlot | null {
  const slots = roofSlots(spec, volumeId);
  let best: RoofSlot | null = null;
  let bestErr = Infinity;
  for (const s of slots) {
    const err = Math.abs(180 - s.azimuthDeg);
    if (err < bestErr - 1e-9) {
      bestErr = err;
      best = s;
    }
  }
  return best;
}

/** Snap a roof fixture onto a plane, inside the edge setback. */
export function snapRoof(
  slot: RoofSlot,
  kind: FixtureKind,
  dims: Dims,
  options: Opts,
  want: { a: number; s: number },
): SnapResult<RoofPlacement> {
  const notes: string[] = [];
  const ext = kind.extents(dims, options);
  const setback = kind.clearances(dims, options).find((c) => c.key === "edge");
  const inset = setback ? Math.max(setback.front, setback.back, setback.left, setback.right) : 0;
  const cosT = Math.max(1e-6, Math.cos(slot.section.angleRad));
  // The along-slope extent projects shorter in plan; that projection is what
  // has to fit between the plane's own fall-axis limits.
  const halfA = (ext.depthFt * cosT) / 2 + inset;
  const halfS = ext.widthFt / 2 + inset;

  const a0 = Math.min(slot.plane.a0, slot.plane.a1);
  const a1 = Math.max(slot.plane.a0, slot.plane.a1);
  const s0 = Math.min(slot.plane.s0, slot.plane.s1);
  const s1 = Math.max(slot.plane.s0, slot.plane.s1);

  let clamped = false;
  let fits = true;
  let a = grid(want.a, FLOOR_GRID_FT);
  let s = grid(want.s, FLOOR_GRID_FT);

  if (a0 + halfA > a1 - halfA) {
    a = (a0 + a1) / 2;
    clamped = true;
    fits = false;
    notes.push(
      `The array is ${(ext.depthFt * cosT).toFixed(1)} ft deep in plan and the ${slot.volumeName} roof plane is only ${(a1 - a0).toFixed(1)} ft. Reduce the rows, reduce the kW, or use a bigger roof.`,
    );
  } else {
    const c = Math.min(a1 - halfA, Math.max(a0 + halfA, a));
    if (Math.abs(c - a) > 1e-6) {
      clamped = true;
      notes.push("Held inside the roof plane's edge setback.");
    }
    a = c;
  }
  if (s0 + halfS > s1 - halfS) {
    s = (s0 + s1) / 2;
    clamped = true;
    fits = false;
    notes.push(
      `The array is ${ext.widthFt.toFixed(1)} ft across and the roof plane is only ${(s1 - s0).toFixed(1)} ft wide. Fewer columns (more rows up the slope), a smaller array, or a bigger roof.`,
    );
  } else {
    const c = Math.min(s1 - halfS, Math.max(s0 + halfS, s));
    if (Math.abs(c - s) > 1e-6 && !clamped) {
      clamped = true;
      notes.push("Held inside the roof plane's edge setback.");
    }
    s = c;
  }

  return {
    placement: {
      mount: "roof",
      volumeId: slot.volumeId,
      planeIndex: slot.planeIndex,
      a: Number(a.toFixed(6)),
      s: Number(s.toFixed(6)),
    },
    notes,
    clamped,
    fits,
    snappedTo: null,
  };
}

/* ===========================================================================
   ADDING A FIXTURE — one call, already snapped
   =========================================================================== */

/**
 * Put a new fixture of `kind` into the model at a sensible default place, and
 * return the new set. Never mutates the set it is given.
 *
 * Floor items land in the middle of the region; wall items land in the middle
 * of the first BUILT wall; roof items land in the middle of the most southerly
 * roof plane, which is the one that was going to be chosen anyway.
 */
export function addFixture(
  spec: HomeSpec,
  set: FixtureSet,
  kindId: FixtureKindId,
  where?: { host?: FixtureHost; volumeId?: string; wall?: Wall },
): { set: FixtureSet; id: string | null; problem: string | null } {
  const kind = FIXTURE_CATALOG[kindId];
  const dims = defaultDims(kind);
  const options = defaultOpts(kind);
  const id = newFixtureId(kindId, set);
  const firstVolume = spec.volumes[0];
  if (!firstVolume) return { set, id: null, problem: "This home has no volumes to put a fixture in." };

  let placement: FixturePlacement | null = null;

  if (kind.mount === "floor") {
    const host: FixtureHost =
      where?.host ??
      (kindId === "hot-tub" && spec.deck
        ? { kind: "deck" }
        : { kind: "volume", volumeId: where?.volumeId ?? firstVolume.id });
    const region = floorRegion(spec, host);
    if (!region) return { set, id: null, problem: "That host does not exist in this home." };
    placement = snapFloor(region, kind, dims, options, {
      x: (region.minX + region.maxX) / 2,
      z: (region.minZ + region.maxZ) / 2,
      rotationDeg: 0,
    }).placement;
  } else if (kind.mount === "wall") {
    const slots = wallSlots(spec, where?.volumeId ?? firstVolume.id);
    const slot = (where?.wall ? slots.find((s) => s.wall === where.wall) : null) ?? slots.find((s) => s.built) ?? slots[0];
    if (!slot) return { set, id: null, problem: "That volume has no walls." };
    const base = kind.baseHeightFt?.(dims, options);
    placement = snapWall(slot, kind, dims, options, {
      offsetFt: slot.runFt / 2,
      heightFt: base && base > 0 ? base : WALL_ITEM_DEFAULT_HEIGHT_FT,
      face: "inside",
    }).placement;
  } else {
    const slot = bestRoofSlot(spec, where?.volumeId ?? firstVolume.id);
    if (!slot) return { set, id: null, problem: "That volume has no roof planes." };
    placement = snapRoof(slot, kind, dims, options, {
      a: (Math.min(slot.plane.a0, slot.plane.a1) + Math.max(slot.plane.a0, slot.plane.a1)) / 2,
      s: (slot.plane.s0 + slot.plane.s1) / 2,
    }).placement;
  }

  const item: PlacedFixture = { id, kind: kindId, label: "", dims, options, placement };
  return { set: { version: FIXTURES_VERSION, items: [...set.items, item] }, id, problem: null };
}

const WALL_ITEM_DEFAULT_HEIGHT_FT = 4.5;

/** Replace one fixture, re-snapping it against the current shell. Pure. */
export function updateFixture(
  spec: HomeSpec,
  set: FixtureSet,
  id: string,
  change: Partial<Pick<PlacedFixture, "label" | "dims" | "options" | "placement">>,
): FixtureSet {
  return {
    version: FIXTURES_VERSION,
    items: set.items.map((item) => {
      if (item.id !== id) return item;
      const next: PlacedFixture = { ...item, ...change };
      return { ...next, placement: reSnap(spec, next) };
    }),
  };
}

export const removeFixture = (set: FixtureSet, id: string): FixtureSet => ({
  version: FIXTURES_VERSION,
  items: set.items.filter((i) => i.id !== id),
});

/**
 * Re-run the snap for a fixture against the CURRENT shell.
 *
 * This is the call the integrator must make after the spec changes. A volume
 * that shrinks, a roof that changes form, a wall that stops being built —
 * each one can leave a fixture outside the envelope, and the rule this file
 * keeps is that nothing is ever outside it. Re-snapping is idempotent: a
 * fixture that was already legal comes back unchanged.
 */
export function reSnap(spec: HomeSpec, item: PlacedFixture): FixturePlacement {
  return snapPlacement(spec, item)?.placement ?? item.placement;
}

/**
 * The snap for a fixture's CURRENT placement, notes and all.
 *
 * This is the function `resolveFixtures` runs, and the reason it exists apart
 * from `reSnap` is a bug this file used to have: `reSnap` returned only the
 * placement and threw the notes away, so a solar array too wide for its roof
 * plane was quietly centred and NOTHING said so. The snap decides where a
 * fixture may be AND what it had to do to get there, and both halves have to
 * reach the user.
 *
 * Returns null when the fixture points at part of a home that no longer
 * exists. Idempotent: an already-legal fixture comes back with `clamped:
 * false` and no notes.
 */
export function snapPlacement(
  spec: HomeSpec,
  item: PlacedFixture,
): SnapResult<FixturePlacement> | null {
  const kind = FIXTURE_CATALOG[item.kind];
  if (!kind) return null;
  const p = item.placement;
  if (p.mount === "floor") {
    const region = floorRegion(spec, p.host) ?? floorRegions(spec)[0];
    if (!region) return null;
    return snapFloor(region, kind, item.dims, item.options, p);
  }
  if (p.mount === "wall") {
    const slots = wallSlots(spec, p.volumeId);
    const slot = slots.find((s) => s.wall === p.wall) ?? slots[0];
    if (!slot) return null;
    return snapWall(slot, kind, item.dims, item.options, p);
  }
  const slots = roofSlots(spec, p.volumeId);
  const slot = slots[p.planeIndex] ?? slots[0];
  if (!slot) return null;
  return snapRoof(slot, kind, item.dims, item.options, p);
}

/** Re-snap every fixture. Call it once whenever the HomeSpec changes. */
export const reSnapAll = (spec: HomeSpec, set: FixtureSet): FixtureSet => ({
  version: FIXTURES_VERSION,
  items: set.items.map((i) => ({ ...i, placement: reSnap(spec, i) })),
});

/* ===========================================================================
   RESOLUTION — placement plus clearances plus what they hit
   =========================================================================== */

export interface ResolvedClearance {
  rule: ClearanceRule;
  /** the clearance volume, in the host frame */
  obb: Obb;
  yRange: readonly [number, number];
  /** true when this clearance box is clear of everything it was tested against */
  satisfied: boolean;
  /** what it hit, in plain words */
  conflicts: string[];
}

export type IssueSeverity = "blocked" | "check";

export interface FixtureIssue {
  fixtureId: string;
  severity: IssueSeverity;
  /** the clearance rule at fault, when there is one */
  ruleKey?: string;
  message: string;
}

export interface ResolvedFixture {
  fixture: PlacedFixture;
  kind: FixtureKind;
  label: string;
  frame: FixtureFrame;
  /** transform inside the frame: feet, and radians */
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  /** the body's plan rectangle in the host frame, and its height interval */
  obb: Obb;
  yRange: readonly [number, number];
  /** the same rectangle in WORLD plan feet, for cross-volume collision */
  worldObb: Obb;
  clearances: ResolvedClearance[];
  facts: FixtureFact[];
  /** where it is, in words, for the schedule */
  location: string;
  hostLabel: string;
  /** what the snap had to do to land it here, in plain sentences */
  notes: string[];
  /** the snap had to move it to keep it legal */
  clamped: boolean;
  /** false when it cannot fit its host at all */
  fits: boolean;
  /** the roof plane it landed on, when it is a roof item */
  roof: { pitchDeg: number; azimuthDeg: number; planeIndex: number } | null;
  buildContext: BuildContext;
}

export interface FixtureResolution {
  items: ResolvedFixture[];
  issues: FixtureIssue[];
  /** things about the SET rather than one fixture */
  warnings: string[];
}

/** Is the shell's wall assembly combustible? Decides whether a stove's
 *  clearance-to-combustibles hitting a wall is a block or a note. */
export function wallIsCombustible(spec: HomeSpec): boolean {
  // sip (OSB facings), clt and timber frame are wood. Rammed earth is mass.
  // INDICATIVE: the finish, the furring and the framing behind any of them can
  // change the answer, and the WETT inspector decides on the day.
  return spec.material !== "rammed_earth";
}

/**
 * Resolve a whole set against a spec: every transform, every clearance box,
 * every collision.
 *
 * Total — it never throws. A fixture pointing at a volume that has been
 * deleted is dropped with a warning rather than crashing the viewport.
 */
export function resolveFixtures(spec: HomeSpec, set: FixtureSet): FixtureResolution {
  const items: ResolvedFixture[] = [];
  const issues: FixtureIssue[] = [];
  const warnings: string[] = [];
  const combustible = wallIsCombustible(spec);

  for (const item of set.items) {
    const kind = FIXTURE_CATALOG[item.kind];
    if (!kind) {
      warnings.push(`Fixture "${item.id}" is of an unknown kind and was skipped.`);
      continue;
    }
    const r = resolveOne(spec, item, kind);
    if (!r) {
      warnings.push(
        `${kind.label} "${item.id}" points at part of the home that no longer exists, and is not drawn.`,
      );
      continue;
    }
    items.push(r);
  }

  if (spec.deck?.hotTub && items.some((i) => i.kind.id === "hot-tub")) {
    warnings.push(
      "This home's deck already carries a hot tub from the HomeSpec itself, and a hot-tub fixture has also been placed. They are two different tubs — count once, or turn the deck's tub off.",
    );
  }

  /* ---- what the snap had to do ----------------------------------------
     The snap is the only thing that knows a fixture did not fit where it was
     asked to go, so its notes are turned into issues HERE rather than being
     dropped on the floor. A fixture that cannot fit its host at all is a
     block; one that was merely held inside the envelope is a note. */
  for (const r of items) {
    if (!r.fits) {
      issues.push({
        fixtureId: r.fixture.id,
        severity: "blocked",
        message: `${r.label} does not fit ${r.hostLabel}. ${r.notes.join(" ")}`.trim(),
      });
    } else if (r.clamped && r.notes.length > 0) {
      issues.push({
        fixtureId: r.fixture.id,
        severity: "check",
        message: `${r.label}: ${r.notes.join(" ")}`,
      });
    }
  }

  /* ---- collisions ------------------------------------------------------
     Bodies are compared in WORLD plan coordinates, so two fixtures in
     different volumes are still compared honestly. Clearances are compared
     the same way. */
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      if (!rangesOverlap(a.yRange, b.yRange)) continue;
      if (obbOverlap(a.worldObb, b.worldObb)) {
        issues.push({
          fixtureId: a.fixture.id,
          severity: "blocked",
          message: `${a.label} and ${b.label} occupy the same space.`,
        });
      }
    }
  }

  for (const a of items) {
    // Roof fixtures are excluded from the obstruction pass — see the note in
    // `resolveOne`'s roof branch.
    if (a.fixture.placement.mount === "roof") continue;
    for (const c of a.clearances) {
      const worldBox = toWorldObb(c.obb, a.frame);
      for (const b of items) {
        if (b === a) continue;
        if (!rangesOverlap(c.yRange, b.yRange)) continue;
        if (obbOverlap(worldBox, b.worldObb)) {
          c.satisfied = false;
          c.conflicts.push(b.label);
          issues.push({
            fixtureId: a.fixture.id,
            severity: c.rule.zone === "combustible" || c.rule.zone === "working-space" ? "blocked" : "check",
            ruleKey: c.rule.key,
            message: `${a.label}: ${c.rule.label} (${feetInches(maxSide(c.rule))}) is obstructed by ${b.label}.`,
          });
        }
      }

      // Does the clearance run into the shell itself?
      const region = regionOf(spec, a);
      if (region && !obbInsideRect(c.obb, region)) {
        const isFire = c.rule.zone === "combustible";
        if (!isFire || combustible) {
          c.satisfied = false;
          c.conflicts.push(isFire ? "the wall assembly" : "the envelope");
          issues.push({
            fixtureId: a.fixture.id,
            severity: isFire ? "blocked" : "check",
            ruleKey: c.rule.key,
            message: isFire
              ? `${a.label}: ${c.rule.label} of ${feetInches(maxSide(c.rule))} runs into the wall, and this home is built of ${spec.material.replace("_", " ")}, which is combustible construction. Move the fixture, shield the wall to the code's rules, or use a listed appliance with a smaller listed clearance.`
              : `${a.label}: ${c.rule.label} extends past the edge of ${a.hostLabel}.`,
          });
        } else {
          issues.push({
            fixtureId: a.fixture.id,
            severity: "check",
            ruleKey: c.rule.key,
            message: `${a.label}: ${c.rule.label} reaches the rammed-earth wall. Mass wall, so not combustible construction in itself — but the finish, any furring and anything framed behind it still have to be checked by the inspector.`,
          });
        }
      }
    }

    // A thermostat next to a window reads the glass, not the room.
    if (a.kind.id === "thermostat" && a.fixture.placement.mount === "wall") {
      const p = a.fixture.placement;
      const slot = wallSlots(spec, p.volumeId).find((s) => s.wall === p.wall);
      const near = slot?.openings.find((o) => p.offsetFt > o.from - 2 && p.offsetFt < o.to + 2);
      if (near) {
        issues.push({
          fixtureId: a.fixture.id,
          severity: "check",
          message: `${a.label} is within 2 ft of opening "${near.id}". A thermostat beside glass or a door reports the draught, and the house heats to the wrong number.`,
        });
      }
    }

    // A wall item over an opening is not mounted, it is floating.
    if (a.fixture.placement.mount === "wall" && a.kind.id !== "thermostat") {
      const p = a.fixture.placement;
      const slot = wallSlots(spec, p.volumeId).find((s) => s.wall === p.wall);
      const half = a.kind.extents(a.fixture.dims, a.fixture.options);
      const hit = slot?.openings.find(
        (o) =>
          p.offsetFt + half.widthFt / 2 > o.from &&
          p.offsetFt - half.widthFt / 2 < o.to &&
          p.heightFt + half.heightFt / 2 > o.sillFt &&
          p.heightFt - half.heightFt / 2 < o.headFt,
      );
      if (hit) {
        issues.push({
          fixtureId: a.fixture.id,
          severity: "blocked",
          message: `${a.label} is mounted over opening "${hit.id}". There is no wall there to fix it to.`,
        });
      }
      if (slot && !slot.built) {
        issues.push({
          fixtureId: a.fixture.id,
          severity: "blocked",
          message: `${a.label} is on a side of ${slot.volumeName} that this roof form does not build as a wall.`,
        });
      }
    }
  }

  return { items, issues, warnings };
}

const maxSide = (r: ClearanceRule): number => Math.max(r.front, r.back, r.left, r.right);

function regionOf(spec: HomeSpec, r: ResolvedFixture): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
  if (r.fixture.placement.mount !== "floor") return null;
  const region = floorRegion(spec, r.fixture.placement.host);
  return region ? { minX: region.minX, maxX: region.maxX, minZ: region.minZ, maxZ: region.maxZ } : null;
}

/** A host-frame box, in world plan feet. */
function toWorldObb(o: Obb, frame: FixtureFrame): Obb {
  const yaw = frame.rotationY;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return {
    cx: frame.origin[0] + o.cx * c + o.cz * s,
    cz: frame.origin[2] - o.cx * s + o.cz * c,
    halfW: o.halfW,
    halfD: o.halfD,
    rotationDeg: o.rotationDeg + frame.rotationDeg,
  };
}

/**
 * One fixture, fully resolved.
 *
 * It resolves the SNAPPED placement rather than the stored one, so the
 * viewport can never draw a fixture somewhere it is not allowed to be, and it
 * carries the snap's own notes so the reason is never lost. The integrator
 * should still call `reSnapAll` after a spec change to bring the stored set
 * back into agreement with what is drawn.
 */
function resolveOne(spec: HomeSpec, item: PlacedFixture, kind: FixtureKind): ResolvedFixture | null {
  const label = item.label.trim() || kind.label;
  const ext = kind.extents(item.dims, item.options);
  const snap = snapPlacement(spec, item);
  if (!snap) return null;
  const p = snap.placement;

  if (p.mount === "floor") {
    const region = floorRegion(spec, p.host);
    if (!region) return null;
    const base = region.floorY + (kind.baseHeightFt?.(item.dims, item.options) ?? 0);
    const obb: Obb = { cx: p.x, cz: p.z, halfW: ext.widthFt / 2, halfD: ext.depthFt / 2, rotationDeg: p.rotationDeg };
    const yRange = [base, base + ext.heightFt] as const;
    const notes: string[] = [...snap.notes];
    if (region.headroomFt !== null && base + ext.heightFt > region.headroomFt) {
      notes.push(
        `Its top is ${feetInches(base + ext.heightFt - region.headroomFt)} above the eave line of ${region.label}.`,
      );
    }
    return {
      fixture: item,
      kind,
      label,
      frame: region.frame,
      position: [p.x, base, p.z] as const,
      rotation: [0, yawFromBearingDeg(p.rotationDeg), 0] as const,
      obb,
      yRange,
      worldObb: toWorldObb(obb, region.frame),
      clearances: resolveClearances(kind, item, obb, region.floorY, base, ext.heightFt),
      facts: kind.facts(item.dims, item.options),
      hostLabel: region.label,
      location: `${region.label} · ${feetInches(p.x)} E, ${feetInches(p.z)} S of centre · facing ${bearingWord(p.rotationDeg)}`,
      notes,
      clamped: snap.clamped,
      fits: snap.fits,
      roof: null,
      buildContext: DEFAULT_CTX,
    };
  }

  if (p.mount === "wall") {
    const v = findVolume(spec, p.volumeId);
    if (!v) return null;
    const slot = wallSlots(spec, p.volumeId).find((s) => s.wall === p.wall);
    if (!slot) return null;
    const t = slot.thicknessFt;
    // Local plan geometry of the wall, restated from drawings/model.ts's
    // private `wallPlanFrame` — same four cases, plan only.
    const W = v.widthFt;
    const D = v.depthFt;
    const originOuter: Pt =
      p.wall === "n" ? [W / 2, -D / 2] : p.wall === "s" ? [-W / 2, D / 2] : p.wall === "e" ? [W / 2, D / 2 - t] : [-W / 2, -D / 2 + t];
    const run: Pt = p.wall === "n" ? [-1, 0] : p.wall === "s" ? [1, 0] : p.wall === "e" ? [0, -1] : [0, 1];
    const out: Pt = p.wall === "n" ? [0, -1] : p.wall === "s" ? [0, 1] : p.wall === "e" ? [1, 0] : [-1, 0];
    // Inward distance from the OUTER face to the fixture's centre.
    const inward = p.face === "inside" ? t + ext.depthFt / 2 : -ext.depthFt / 2;
    const cx = originOuter[0] + run[0] * p.offsetFt - out[0] * inward;
    const cz = originOuter[1] + run[1] * p.offsetFt - out[1] * inward;
    const rotationDeg = (WALL_FACING_DEG[p.wall] + (p.face === "outside" ? 180 : 0)) % 360;
    const base = p.heightFt - ext.heightFt / 2;
    const obb: Obb = { cx, cz, halfW: ext.widthFt / 2, halfD: ext.depthFt / 2, rotationDeg };
    return {
      fixture: item,
      kind,
      label,
      frame: slot.frame,
      position: [cx, base, cz] as const,
      rotation: [0, yawFromBearingDeg(rotationDeg), 0] as const,
      obb,
      yRange: [base, base + ext.heightFt] as const,
      worldObb: toWorldObb(obb, slot.frame),
      // A wall fixture always hangs off a volume, whose walking surface is
      // finished floor — y = 0 in its own frame.
      clearances: resolveClearances(kind, item, obb, 0, base, ext.heightFt),
      facts: kind.facts(item.dims, item.options),
      hostLabel: slot.volumeName,
      location: `${slot.volumeName} · ${p.wall.toUpperCase()} wall ${p.face} face · ${feetInches(p.offsetFt)} from the left end · centre ${feetInches(p.heightFt)} above the floor`,
      notes: [...snap.notes],
      clamped: snap.clamped,
      fits: snap.fits,
      roof: null,
      buildContext: DEFAULT_CTX,
    };
  }

  const slots = roofSlots(spec, p.volumeId);
  const slot = slots[p.planeIndex];
  if (!slot) return null;
  const sec = slot.section;
  const dirSign: 1 | -1 = slot.plane.a1 >= slot.plane.a0 ? 1 : -1;
  const theta = sec.angleRad;
  // Offset perpendicular to the roof plane by the standoff: the surface's
  // normal in the (fall, height) section is (dirSign·sinθ, cosθ).
  const stand = PV_STANDOFF_FT + PV_THICKNESS_FT / 2;
  const a = p.a + dirSign * stand * Math.sin(theta);
  const y = sec.topAt(p.a) + stand * Math.cos(theta);
  const x = sec.fallAxis === "x" ? a : p.s;
  const z = sec.fallAxis === "x" ? p.s : a;
  // One tilt about the axis perpendicular to the fall. Derived in the header
  // of `snapRoof`'s neighbours: about Z when the fall runs along X, about X
  // when it runs along Z, and the sign follows the downhill direction.
  const rotation: readonly [number, number, number] =
    sec.fallAxis === "x" ? ([0, 0, -theta * dirSign] as const) : ([theta * dirSign, 0, 0] as const);
  const ctx: BuildContext = { fallAxis: sec.fallAxis };
  const ext3 = kind.extents(item.dims, item.options);
  const planAlong = ext3.depthFt * Math.cos(theta);
  const obb: Obb = {
    cx: x,
    cz: z,
    halfW: (sec.fallAxis === "x" ? planAlong : ext3.widthFt) / 2,
    halfD: (sec.fallAxis === "x" ? ext3.widthFt : planAlong) / 2,
    rotationDeg: 0,
  };
  return {
    fixture: item,
    kind,
    label,
    frame: slot.frame,
    position: [x, y, z] as const,
    rotation,
    obb,
    yRange: [y - 0.5, y + 0.5] as const,
    worldObb: toWorldObb(obb, slot.frame),
    /* Resolved so the SCHEDULE prints the setback and its caveat, but the
       collision pass skips roof-mounted fixtures entirely: a box drawn around
       an array 20 feet up would otherwise be compared against a sofa on the
       floor and report a conflict that does not exist. The setback is enforced
       where it actually belongs — in `snapRoof`, against the plane's edges. */
    clearances: resolveClearances(kind, item, obb, y, y, ext3.heightFt),
    facts: kind.facts(item.dims, item.options),
    hostLabel: slot.volumeName,
    location: `${slot.volumeName} roof · plane ${p.planeIndex + 1} of ${slots.length} · ${slot.pitchDeg.toFixed(1)}° pitch facing ${bearingWord(slot.azimuthDeg)}`,
    notes: [...snap.notes],
    clamped: snap.clamped,
    fits: snap.fits,
    roof: { pitchDeg: slot.pitchDeg, azimuthDeg: slot.azimuthDeg, planeIndex: p.planeIndex },
    buildContext: ctx,
  };
}

/**
 * Turn a kind's clearance RULES into positioned boxes.
 *
 * The vertical anchor is the part worth reading twice:
 *   from "base"  — starts at the fixture's own base. `heightFt: null` means
 *                  "as tall as the fixture".
 *   from "floor" — starts at the host's walking surface, which is what an
 *                  electrical working space and a standing-room allowance
 *                  actually mean. `heightFt: null` runs up to the top of the
 *                  fixture, so a hung unit's floor space is the floor under it.
 *   from "top"   — starts at the top of the fixture, for an overhead clearance.
 */
function resolveClearances(
  kind: FixtureKind,
  item: PlacedFixture,
  body: Obb,
  floorY: number,
  baseY: number,
  bodyHeightFt: number,
): ResolvedClearance[] {
  const topY = baseY + bodyHeightFt;
  return kind.clearances(item.dims, item.options).map((r) => {
    const halfW = body.halfW + (r.left + r.right) / 2;
    const halfD = body.halfD + (r.front + r.back) / 2;
    // The box is not centred on the fixture when the sides differ, so its
    // centre shifts by half the difference — in the FIXTURE's frame, then
    // rotated into the host's.
    const offX = (r.right - r.left) / 2;
    const offZ = (r.front - r.back) / 2;
    const shifted = rotateLocal(body.rotationDeg, offX, offZ);

    let y0: number;
    let y1: number;
    if (r.from === "top") {
      y0 = topY;
      y1 = topY + (r.heightFt ?? bodyHeightFt);
    } else if (r.from === "floor") {
      y0 = floorY;
      y1 = r.heightFt === null ? topY : floorY + r.heightFt;
    } else {
      y0 = baseY;
      y1 = baseY + (r.heightFt ?? bodyHeightFt);
    }

    return {
      rule: r,
      obb: {
        cx: body.cx + shifted[0],
        cz: body.cz + shifted[1],
        halfW: Math.max(0.01, halfW),
        halfD: Math.max(0.01, halfD),
        rotationDeg: body.rotationDeg,
      },
      yRange: [y0, Math.max(y0 + 0.05, y1)] as const,
      satisfied: true,
      conflicts: [],
    };
  });
}

/* ===========================================================================
   GEOMETRY FOR THE SCENE
   =========================================================================== */

/**
 * One fixture's meshes, and the two DIFFERENT frames they belong to.
 *
 * `parts` are in the FIXTURE's own frame and want `position` + `rotation`
 * applied. `clearanceParts` are already positioned and yawed in the HOST
 * frame, because a clearance is a piece of the room, not a piece of the
 * object — so they are siblings of the fixture group, never children of it.
 * Nesting them would apply the fixture transform twice and put a stove's
 * 48-inch clearance somewhere it is not. The mounting recipe is:
 *
 *   <group position={frame.origin} rotation={[0, frame.rotationY, 0]}>
 *     <group position={g.position} rotation={g.rotation}>{g.parts}</group>
 *     {g.clearanceParts}
 *   </group>
 */
export interface FixtureGroup {
  id: string;
  frame: FixtureFrame;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  parts: FixturePart[];
  /** already positioned and yawed in the HOST frame — siblings, not children */
  clearanceParts: FixturePart[];
}

export interface FixtureGeometry {
  groups: FixtureGroup[];
}

/** Build every mesh for a resolution. Deterministic; the caller owns disposal
 *  (`disposeFixtureGeometry`), exactly as BuilderApp owns the shell's. */
export function buildFixtureGeometry(res: FixtureResolution, opts?: { clearances?: boolean }): FixtureGeometry {
  const showClearances = opts?.clearances ?? true;
  return {
    groups: res.items.map((r) => {
      const parts = r.kind.build(r.fixture.dims, r.fixture.options, r.buildContext).map((p) => ({
        ...p,
        id: `${r.fixture.id}:${p.id}`,
      }));
      const clearanceParts: FixturePart[] = [];
      if (showClearances) {
        for (const c of r.clearances) {
          const h = c.yRange[1] - c.yRange[0];
          const g = box(c.obb.halfW * 2, h, c.obb.halfD * 2, c.obb.cx, c.yRange[0] + h / 2, c.obb.cz);
          clearanceParts.push({
            id: `${r.fixture.id}:clear:${c.rule.key}`,
            surface: c.satisfied ? "clearance" : "clearance-alert",
            // Yawed about its OWN centre, in the host frame — the rotation is
            // baked in rather than inherited, because this mesh is a sibling.
            geometry: rotateAbout(g, c.obb.cx, c.obb.cz, yawFromBearingDeg(c.obb.rotationDeg)),
          });
        }
      }
      return {
        id: r.fixture.id,
        frame: r.frame,
        position: r.position,
        rotation: r.rotation,
        parts,
        clearanceParts,
      };
    }),
  };
}

/** Yaw a geometry about a vertical axis through (x, z). */
function rotateAbout(g: THREE.BufferGeometry, x: number, z: number, yaw: number): THREE.BufferGeometry {
  return g.translate(-x, 0, -z).rotateY(yaw).translate(x, 0, z);
}

export function disposeFixtureGeometry(geo: FixtureGeometry | null | undefined): void {
  if (!geo) return;
  for (const g of geo.groups) {
    for (const p of g.parts) p.geometry.dispose();
    for (const p of g.clearanceParts) p.geometry.dispose();
  }
}

/* ===========================================================================
   THE SCHEDULE — fixtures as data, for the plan engine and the sheets
   =========================================================================== */

export interface FixtureScheduleRow {
  /** F-1, W-2, R-1: mount letter plus a number in placement order */
  tag: string;
  id: string;
  kind: FixtureKindId;
  kindLabel: string;
  label: string;
  mount: FixtureMount;
  host: string;
  location: string;
  /** the named dimensions, as stored — the morph state, not a scale */
  dims: Record<string, number>;
  options: Record<string, string>;
  sizeText: string;
  facts: FixtureFact[];
  clearances: {
    key: string;
    label: string;
    zone: ClearanceZone;
    basis: ClearanceBasis;
    source: string;
    verifiedAgainstSource: false;
    maxFt: number;
    text: string;
    satisfied: boolean;
    note: string;
  }[];
  issues: string[];
}

/**
 * The fixture set as flat rows.
 *
 * This is the handoff. Nothing downstream needs three.js, a React tree or a
 * resolver to read it: the plan engine can place symbols from `location`, a
 * schedule sheet can print `sizeText` and the clearance table, and a BOM can
 * count `kind`. `verifiedAgainstSource` rides along on every clearance row so
 * a printed sheet cannot quietly lose the caveat.
 */
export function fixtureSchedule(res: FixtureResolution): FixtureScheduleRow[] {
  const counters: Record<FixtureMount, number> = { floor: 0, wall: 0, roof: 0 };
  const letter: Record<FixtureMount, string> = { floor: "F", wall: "W", roof: "R" };
  return res.items.map((r) => {
    const mount = r.kind.mount;
    counters[mount] += 1;
    const ext = r.kind.extents(r.fixture.dims, r.fixture.options);
    return {
      tag: `${letter[mount]}-${counters[mount]}`,
      id: r.fixture.id,
      kind: r.kind.id,
      kindLabel: r.kind.label,
      label: r.label,
      mount,
      host: r.hostLabel,
      location: r.location,
      dims: { ...r.fixture.dims },
      options: { ...r.fixture.options },
      sizeText: `${feetInches(ext.widthFt)} W × ${feetInches(ext.depthFt)} D × ${feetInches(ext.heightFt)} H`,
      facts: r.facts,
      clearances: r.clearances.map((c) => ({
        key: c.rule.key,
        label: c.rule.label,
        zone: c.rule.zone,
        basis: c.rule.basis,
        source: c.rule.source,
        verifiedAgainstSource: c.rule.verifiedAgainstSource,
        maxFt: maxSide(c.rule),
        text: clearanceText(c.rule),
        satisfied: c.satisfied,
        note: c.rule.note,
      })),
      issues: res.issues.filter((i) => i.fixtureId === r.fixture.id).map((i) => i.message),
    };
  });
}

/** A clearance rule as one readable line. */
export function clearanceText(r: ClearanceRule): string {
  const sides: string[] = [];
  const all = r.front === r.back && r.back === r.left && r.left === r.right && r.front > 0;
  if (all) sides.push(`${feetInches(r.front)} all round`);
  else {
    if (r.front > 0) sides.push(`${feetInches(r.front)} front`);
    if (r.back > 0) sides.push(`${feetInches(r.back)} back`);
    if (r.left > 0 || r.right > 0) {
      sides.push(
        r.left === r.right
          ? `${feetInches(r.left)} each side`
          : `${feetInches(r.left)} left, ${feetInches(r.right)} right`,
      );
    }
  }
  if (r.heightFt !== null) sides.push(`${feetInches(r.heightFt)} high`);
  return sides.length > 0 ? sides.join(", ") : "see note";
}

/** The clearance sources in a set, deduplicated — a "where these numbers came
 *  from" block a sheet or a panel can print under `SOURCE_HONESTY`. */
export function clearanceSources(res: FixtureResolution): { basis: ClearanceBasis; source: string }[] {
  const seen: Record<string, true> = {};
  const out: { basis: ClearanceBasis; source: string }[] = [];
  for (const r of res.items) {
    for (const c of r.clearances) {
      const key = `${c.rule.basis}::${c.rule.source}`;
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ basis: c.rule.basis, source: c.rule.source });
    }
  }
  return out.sort((a, b) =>
    a.basis === b.basis ? a.source.localeCompare(b.source) : a.basis.localeCompare(b.basis),
  );
}

/* ---------------------------------------------------------------- words */

/** Feet as prose — `6 ft 6 in` — because these strings land in sentences a
 *  clearance report speaks. Body shared via lib/units with the five
 *  drawing-style formatters; only the words differ. */
export const feetInches = (ft: number): string => formatFeetInchesWords(ft);

/** A bearing as a compass word. North is 0, and the site frame puts it at −Z. */
export function bearingWord(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  const names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return names[Math.round(d / 45) % 8];
}

/* ===========================================================================
   SERIALIZATION — a fixture set is a string

   Same shape of contract as `share.ts`: a version, a codec letter, base64url.
   The prefix is `F` rather than `A`, so a fixture token can never be mistaken
   for a design token and vice versa. Written here rather than in share.ts
   because fixtures are an optional layer over a spec, and the shell's link
   must keep working with no fixtures in it at all.
   =========================================================================== */

const FIXTURE_TOKEN_RE = /^F(\d+)r([A-Za-z0-9_-]+)$/;
const MAX_FIXTURE_TOKEN_CHARS = 32_000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(text: string): Uint8Array | null {
  try {
    const pad = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/") + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Validate an unknown value as a fixture set. Returns null and says why on
 *  the console, rather than throwing into a render. */
export function validateFixtureSet(value: unknown): FixtureSet | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== FIXTURES_VERSION) {
    console.error(`[aura/fixtures] fixture set is v${String(v.version)}; this build reads v${FIXTURES_VERSION}.`);
    return null;
  }
  if (!Array.isArray(v.items)) return null;
  const items: PlacedFixture[] = [];
  for (const raw of v.items) {
    if (typeof raw !== "object" || raw === null) continue;
    const it = raw as Record<string, unknown>;
    const kindId = it.kind as FixtureKindId;
    const kind = FIXTURE_CATALOG[kindId];
    if (!kind || typeof it.id !== "string") continue;
    const placement = validatePlacement(it.placement, kind.mount);
    if (!placement) continue;
    const dims = { ...defaultDims(kind) };
    if (typeof it.dims === "object" && it.dims !== null) {
      for (const d of kind.dimensions) {
        const raw2 = (it.dims as Record<string, unknown>)[d.key];
        if (typeof raw2 === "number") dims[d.key] = clampDim(kind, d.key, raw2);
      }
    }
    const options = { ...defaultOpts(kind) };
    if (typeof it.options === "object" && it.options !== null) {
      for (const o of kind.options) {
        const raw2 = (it.options as Record<string, unknown>)[o.key];
        if (typeof raw2 === "string" && o.choices.some((c) => c.id === raw2)) options[o.key] = raw2;
      }
    }
    items.push({
      id: it.id,
      kind: kindId,
      label: typeof it.label === "string" ? it.label.slice(0, 60) : "",
      dims,
      options,
      placement,
    });
  }
  return { version: FIXTURES_VERSION, items };
}

function validatePlacement(value: unknown, mount: FixtureMount): FixturePlacement | null {
  if (typeof value !== "object" || value === null) return null;
  const p = value as Record<string, unknown>;
  const n = (k: string, fallback = 0): number => (typeof p[k] === "number" && Number.isFinite(p[k]) ? (p[k] as number) : fallback);
  if (mount === "floor" && p.mount === "floor") {
    const host = p.host as Record<string, unknown> | undefined;
    const parsed: FixtureHost =
      host?.kind === "deck"
        ? { kind: "deck" }
        : { kind: "volume", volumeId: typeof host?.volumeId === "string" ? host.volumeId : "" };
    if (parsed.kind === "volume" && parsed.volumeId === "") return null;
    return { mount: "floor", host: parsed, x: n("x"), z: n("z"), rotationDeg: n("rotationDeg") };
  }
  if (mount === "wall" && p.mount === "wall") {
    if (typeof p.volumeId !== "string" || !["n", "s", "e", "w"].includes(String(p.wall))) return null;
    return {
      mount: "wall",
      volumeId: p.volumeId,
      wall: p.wall as Wall,
      offsetFt: n("offsetFt"),
      heightFt: n("heightFt", 4.5),
      face: p.face === "outside" ? "outside" : "inside",
    };
  }
  if (mount === "roof" && p.mount === "roof") {
    if (typeof p.volumeId !== "string") return null;
    return { mount: "roof", volumeId: p.volumeId, planeIndex: Math.max(0, Math.round(n("planeIndex"))), a: n("a"), s: n("s") };
  }
  return null;
}

/** Encode a set. Byte-stable: the same set always gives the same string. */
export function encodeFixtureSet(set: FixtureSet): string {
  return `F${FIXTURES_VERSION}r${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(set)))}`;
}

/** Decode a token. Returns null — never throws, never guesses. */
export function decodeFixtureSet(token: unknown): FixtureSet | null {
  if (typeof token !== "string" || token.length === 0 || token.length > MAX_FIXTURE_TOKEN_CHARS) return null;
  const m = FIXTURE_TOKEN_RE.exec(token);
  if (!m) return null;
  if (Number(m[1]) !== FIXTURES_VERSION) {
    console.error(`[aura/fixtures] token is v${m[1]}; this build reads v${FIXTURES_VERSION} and will not guess.`);
    return null;
  }
  const bytes = base64UrlToBytes(m[2]);
  if (!bytes) return null;
  try {
    return validateFixtureSet(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
