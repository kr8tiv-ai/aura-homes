/* ===========================================================================
   THE DRAWING MODEL — a HomeSpec turned into things a sheet can ink.

   This file owns every coordinate the set is drawn from. It computes, once:

     · the world plan outline of every volume, inner and outer face
     · every wall as a world segment carrying its openings at their real
       positions, so the plan, the elevations and the schedule are reading the
       SAME opening rather than three near-agreeing copies of it
     · the roof section of every volume — the scalar function that decides the
       ridge, the eaves and every wall's top edge
     · the four ELEVATIONS, as orthographic projections of the above
     · one BUILDING SECTION through the primary volume's long axis
     · the screw-pile grid
     · the window/door schedule, grouped by identical type and size

   WHY IT IS NOT `lib/builder/geometry.ts`. That file is the THREE.JS model:
   it allocates BufferGeometry, it is imported by the live 3D scene, and
   pulling it in here would drag three.js into every page that wants a PDF of
   a drawing. This file is plain numbers and imports nothing but the spec and
   the material tables.

   THE COST OF THAT, STATED RATHER THAN HIDDEN. The roof-form constants and
   the roof section arithmetic below are a deliberate re-statement of
   `lib/builder/geometry.ts` — `buildRoofModel`, `roofThicknessFor`,
   `wallFrame`, `wallTopPoints` and the constants block. They must be kept in
   step by hand. Two things make that safe rather than merely hopeful:

     · the RIDGE is never re-derived here. It comes from `ridgeHeightFt()` in
       `lib/builder/spec.ts`, which is the contract both files answer to, so
       the one number a reviewer will check cannot drift between the drawing
       and the model.
     · every form's section is pinned to that ridge, exactly as geometry.ts
       pins it: `builtRidgeY === ridgeHeightFt(v)` is the invariant, and the
       eave, the overhang drop and the wall tops all fall out of it.

   AXES. World: +X east, +Z south (so north is −Z), +Y up. y = 0 is FINISHED
   FLOOR. Grade is below it at `GRADE_Y_FT`, because these homes stand on
   screw piles and never on concrete.

   PURITY. No clock, no randomness, no DOM, no network.
   =========================================================================== */

import {
  glazedAreaSqFt,
  groundFootprintSqFt,
  ridgeHeightFt,
  totalFloorAreaSqFt,
  volumeFootprintSqFt,
  type Deck,
  type HomeSpec,
  type OpeningKind,
  type RoofForm,
  type Volume,
  type Wall,
} from "@/lib/builder/spec";
import { PARTITION_MM, WALL_R_VALUE, WALL_THICKNESS_MM } from "@/lib/design/materials";

/* =====================================================================
   CONSTANTS — restated from lib/builder/geometry.ts. See the header.
   ===================================================================== */

export const MM_PER_FT = 304.8;

/** Structural floor deck below finished floor. */
export const FLOOR_SLAB_FT = 0.75;
/** How far the piles stand proud of grade. */
export const PILE_EXPOSURE_FT = 2.0;
/** Ground plane, in the same frame as everything else. */
export const GRADE_Y_FT = -(FLOOR_SLAB_FT + PILE_EXPOSURE_FT);

/** Nominal screw-pile grid. */
export const PILE_GRID_FT = 8;

export const ROOF_THICKNESS_FT = 0.9;
export const ROOF_SEAT_FT = 0.15;
export const FLAT_ROOF_FALL_DEG = 2;
export const PARAPET_FT = 0.5;

export const SALTBOX_MIN_EAVE_FT = 1.5;
export const SALTBOX_SHORT_SHARE = 0.38;

export const DECK_STEP_FT = 0.5;
export const DECK_SLAB_FT = 0.25;
export const DECK_BEAM_FT = 0.8;
export const HOT_TUB_RADIUS_FT = 3.0;

/** A glazing wall reads as a glazed SCREEN, not one impossible pane. */
export const MULLION_SPACING_FT = 4.0;

/** Rough-opening allowance over the unit size. Nominal, and the schedule says
 *  so: the real allowance comes from the supplied unit's installation sheet. */
export const RO_WIDTH_ALLOWANCE_FT = 0.75 / 12; // 3/4"
export const RO_HEIGHT_ALLOWANCE_FT = 0.5 / 12; // 1/2"

/** Indicative PV array area per kW — modern modules run near 400 W over about
 *  21 sq ft. Used only to draw an array FOOTPRINT, never to size a system. */
export const ARRAY_SQ_FT_PER_KW = 53;

const EPS = 1e-9;

/* =====================================================================
   SMALL VECTOR + POLYGON TOOLKIT
   ===================================================================== */

export type Pt = readonly [number, number];

export const polygonArea = (poly: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};

/**
 * Convex hull, monotone chain. Deterministic: the sort is total (x then y) so
 * the same points always produce the same ring, starting at the same vertex.
 *
 * This is what makes the elevations exact rather than approximate. Every solid
 * this set projects — the wall mass under a concave roof line, a sloped roof
 * slab, a parapet upstand — is CONVEX, and the orthographic silhouette of a
 * convex solid is exactly the convex hull of its projected vertices. So the
 * outline is computed, not sketched.
 */
export function hull(pts: readonly Pt[]): Pt[] {
  if (pts.length < 3) return [...pts];
  const p = [...pts].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  const cross = (o: Pt, a: Pt, b: Pt): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (src: readonly Pt[]): Pt[] => {
    const out: Pt[] = [];
    for (const q of src) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 1e-9) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  const lower = build(p);
  const upper = build([...p].reverse());
  const ring = [...lower, ...upper];
  return ring.length >= 3 ? ring : [...pts];
}

export interface Extent {
  min: number;
  max: number;
}

export const extentOf = (values: readonly number[]): Extent =>
  values.length === 0
    ? { min: 0, max: 0 }
    : { min: Math.min(...values), max: Math.max(...values) };

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function boxOf(polys: readonly (readonly Pt[])[]): Box {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const poly of polys) {
    for (const p of poly) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minZ) minZ = p[1];
      if (p[1] > maxZ) maxZ = p[1];
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  return { minX, maxX, minZ, maxZ };
}

/** Do two axis-aligned boxes overlap? Used only to WARN about roof
 *  intersections, never to invent a valley line. */
export const boxesOverlap = (a: Box, b: Box, tol = 1e-6): boolean =>
  a.minX < b.maxX - tol && b.minX < a.maxX - tol && a.minZ < b.maxZ - tol && b.minZ < a.maxZ - tol;

/* =====================================================================
   THE SITE FRAME
   ===================================================================== */

/** A compass bearing (clockwise from north) as a rotation about +Y. The sign
 *  is `lib/builder/geometry.ts::yawFromBearingDeg` and must not differ. */
export const yawFromBearingDeg = (bearingDeg: number): number => (-bearingDeg * Math.PI) / 180;

/** A point in a volume's local frame, in world feet. */
export function toWorld(v: Volume, lx: number, lz: number): Pt {
  const yaw = yawFromBearingDeg(v.rotationDeg);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [v.x + lx * c + lz * s, v.z - lx * s + lz * c];
}

/** A direction in a volume's local frame, rotated but not translated. */
export function rotDir(v: Volume, lx: number, lz: number): Pt {
  const yaw = yawFromBearingDeg(v.rotationDeg);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [lx * c + lz * s, -lx * s + lz * c];
}

/** The four plan corners of a centred, yawed rectangle, in world feet. */
export function rectCorners(
  v: Volume,
  widthFt: number,
  depthFt: number,
  offsetX = 0,
  offsetZ = 0,
): Pt[] {
  const hw = widthFt / 2;
  const hd = depthFt / 2;
  return (
    [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ] as const
  ).map(([x, z]) => toWorld(v, x + offsetX, z + offsetZ));
}

/** Which plan axis a wall RUNS along, in the volume's own frame. */
export const WALL_RUN_AXIS: Readonly<Record<Wall, "x" | "z">> = {
  n: "x",
  s: "x",
  e: "z",
  w: "z",
};

/** Outward normal of each wall in the volume's own frame, as (x, z). */
const WALL_OUT: Readonly<Record<Wall, Pt>> = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
};

/** Run direction of each wall — left-to-right seen from OUTSIDE, which is the
 *  direction `Opening.offsetFt` is measured in. */
const WALL_RUN: Readonly<Record<Wall, Pt>> = {
  n: [-1, 0],
  s: [1, 0],
  e: [0, -1],
  w: [0, 1],
};

export const WALL_NAME: Readonly<Record<Wall, string>> = {
  n: "NORTH",
  s: "SOUTH",
  e: "EAST",
  w: "WEST",
};

/** Structural wall thickness in FEET. */
export const wallThicknessFt = (spec: HomeSpec): number =>
  WALL_THICKNESS_MM[spec.material] / MM_PER_FT;

export const partitionThicknessFt = (): number => PARTITION_MM / MM_PER_FT;

/**
 * The BUILT length of a wall, feet.
 *
 * The n and s walls run the full width; e and w butt INTO them and are two
 * wall thicknesses shorter. Same rule as `lib/builder/geometry.ts::wallRunFt`,
 * and the reason an opening's `offsetFt` is clamped against this rather than
 * against `depthFt`.
 */
export const wallRunFt = (v: Volume, wall: Wall, t: number): number =>
  WALL_RUN_AXIS[wall] === "x" ? v.widthFt : Math.max(0.5, v.depthFt - 2 * t);

/* =====================================================================
   THE ROOF SECTION — one scalar function, five forms
   ===================================================================== */

export interface RoofPlane {
  /** fall-axis position and height of the high end */
  a0: number;
  y0: number;
  /** and of the low end */
  a1: number;
  y1: number;
  /** extent on the perpendicular plan axis */
  s0: number;
  s1: number;
}

export interface RoofSection {
  form: RoofForm;
  /** the local plan axis the slopes fall down */
  fallAxis: "x" | "z";
  facing: Wall;
  /** half the footprint on the fall axis, and on the other one */
  halfFall: number;
  halfPerp: number;
  overhangFt: number;
  /** high line: position on the fall axis, and its height */
  apexA: number;
  apexY: number;
  slope: number;
  angleRad: number;
  /** floor to eave — `wallHeightFt × storeys` */
  eaveY: number;
  /** `ridgeHeightFt(v)`, never re-derived */
  ridgeY: number;
  thicknessFt: number;
  /** height of the roof's TOP surface at `a` on the fall axis */
  topAt: (a: number) => number;
  planes: RoofPlane[];
  parapet: { topY: number; halfA: number; halfS: number; lowY: number } | null;
  /** true for the forms with a ridge line worth drawing on a roof plan */
  hasRidge: boolean;
  /** the roof's extent on the fall axis, including overhang */
  fallExtent: Extent;
  perpExtent: Extent;
  /** false for the walls an a-frame does not have: the slope IS the wall */
  buildsWall: (wall: Wall) => boolean;
  /** anything the drawing had to clamp, in words */
  warnings: string[];
}

/** `ridgeHeightFt(v)`, guarded for the pitches that send tan() to infinity.
 *  Mirrors `lib/builder/geometry.ts::drawnRidgeFt`. */
function drawnRidge(v: Volume, warnings: string[]): number {
  const r = ridgeHeightFt(v);
  const eave = v.wallHeightFt * v.storeys;
  if (!Number.isFinite(r) || r <= 0) {
    warnings.push(
      `${v.name}: a ${v.roof.pitchDeg}° pitch has no finite ridge, so a minimal roof is drawn. ` +
        `This is a data-entry error in the model, not a design.`,
    );
    return eave + 0.5;
  }
  return r;
}

/** The roof section of one volume. Internal — callers use `roofSectionFor`,
 *  which is the version that takes the material's wall thickness. */
function roofSection(v: Volume): RoofSection {
  const warnings: string[] = [];
  const W = Math.max(1, v.widthFt);
  const D = Math.max(1, v.depthFt);
  const oh = Math.max(0, v.roof.overhangFt);
  const eaveY = Math.max(0.5, v.wallHeightFt * v.storeys);
  const R = drawnRidge(v, warnings);
  const form = v.roof.form;

  // spec.ts's own defaults: a shed faces south so the array is in the sun; a
  // saltbox carries its long slope down the WEATHER side.
  const facing: Wall = v.roof.facing ?? (form === "saltbox" ? "n" : "s");
  // Gable and a-frame always span the width, because that is the span
  // `ridgeHeightFt` uses. Only shed, saltbox and flat can be turned.
  const fallAxis: "x" | "z" =
    form === "gable" || form === "a-frame" ? "x" : WALL_RUN_AXIS[facing] === "x" ? "z" : "x";
  const halfFall = fallAxis === "x" ? W / 2 : D / 2;
  const halfPerp = fallAxis === "x" ? D / 2 : W / 2;
  const dir: 1 | -1 = facing === "s" || facing === "e" ? 1 : -1;
  const span = { s0: -(halfPerp + oh), s1: halfPerp + oh };

  /* Roof thickness needs the material, which a `Volume` does not carry.
     `roofSectionFor` sets it around this call and restores it afterwards, so
     the function stays pure from every caller's point of view. */
  const wallT = roofSectionWallT;

  const finish = (
    apexA: number,
    apexY: number,
    slope: number,
    planes: RoofPlane[],
    parapet: RoofSection["parapet"] = null,
    hasRidge = false,
  ): RoofSection => {
    const angleRad = Math.atan(slope);
    const thicknessFt = Math.max(
      ROOF_THICKNESS_FT,
      wallT * Math.abs(Math.sin(angleRad)) + ROOF_SEAT_FT + 0.05,
    );
    const fallValues = planes.flatMap((p) => [p.a0, p.a1]);
    return {
      form,
      fallAxis,
      facing,
      halfFall,
      halfPerp,
      overhangFt: oh,
      apexA,
      apexY,
      slope,
      angleRad,
      eaveY,
      ridgeY: R,
      thicknessFt,
      topAt: (a: number) => apexY - Math.abs(a - apexA) * slope,
      planes,
      parapet,
      hasRidge,
      fallExtent: extentOf(fallValues),
      perpExtent: { min: span.s0, max: span.s1 },
      buildsWall: (wall: Wall) => form !== "a-frame" || WALL_RUN_AXIS[wall] === fallAxis,
      warnings,
    };
  };

  switch (form) {
    case "flat": {
      const slope = Math.tan((FLAT_ROOF_FALL_DEG * Math.PI) / 180);
      const highA = -dir * (halfFall + oh);
      const lowA = dir * (halfFall + oh);
      const lowY = eaveY - Math.abs(lowA - highA) * slope;
      return finish(
        highA,
        eaveY,
        slope,
        [{ a0: highA, y0: eaveY, a1: lowA, y1: lowY, ...span }],
        { topY: R, halfA: halfFall + oh, halfS: halfPerp + oh, lowY },
      );
    }
    case "shed": {
      // The HIGH edge is flush with the wall — no overhang there — so the built
      // maximum is exactly `ridgeHeightFt`.
      const run = 2 * halfFall;
      const rise = Math.max(0.05, R - eaveY);
      const slope = rise / run;
      const highA = -dir * halfFall;
      const lowA = dir * (halfFall + oh);
      return finish(highA, R, slope, [
        { a0: highA, y0: R, a1: lowA, y1: R - (run + oh) * slope, ...span },
      ]);
    }
    case "saltbox": {
      const run = 2 * halfFall;
      const rise = Math.max(0.05, R - eaveY);
      const needed = rise / (rise + Math.max(0.1, R - SALTBOX_MIN_EAVE_FT));
      const f = Math.min(0.5, Math.max(SALTBOX_SHORT_SHARE, needed));
      const slope = rise / (f * run);
      const apexA = dir * (f * run - halfFall);
      return finish(
        apexA,
        R,
        slope,
        [
          { a0: apexA, y0: R, a1: -dir * (halfFall + oh), y1: R - (f * run + oh) * slope, ...span },
          {
            a0: apexA,
            y0: R,
            a1: dir * (halfFall + oh),
            y1: R - ((1 - f) * run + oh) * slope,
            ...span,
          },
        ],
        null,
        true,
      );
    }
    case "a-frame": {
      // spec.ts DOUBLES the rise for this form, so the plane angle is taken
      // FROM the spec's ridge and never re-derived from pitchDeg.
      const slope = R / halfFall;
      return finish(
        0,
        R,
        slope,
        [
          { a0: 0, y0: R, a1: halfFall + oh, y1: R - (halfFall + oh) * slope, ...span },
          { a0: 0, y0: R, a1: -(halfFall + oh), y1: R - (halfFall + oh) * slope, ...span },
        ],
        null,
        true,
      );
    }
    case "gable":
    default: {
      const rise = Math.max(0.05, R - eaveY);
      const slope = rise / halfFall;
      return finish(
        0,
        R,
        slope,
        [
          { a0: 0, y0: R, a1: halfFall + oh, y1: R - (halfFall + oh) * slope, ...span },
          { a0: 0, y0: R, a1: -(halfFall + oh), y1: R - (halfFall + oh) * slope, ...span },
        ],
        null,
        true,
      );
    }
  }
}

/* The wall thickness the roof-thickness rule needs. A module-level value
   rather than a parameter so `roofSection` keeps the exact shape of
   geometry.ts's `buildRoofModel`; `buildHomeModel` sets it from the spec's
   material before building any volume, and it is restored afterwards, so the
   function stays pure from the caller's point of view. */
let roofSectionWallT = WALL_THICKNESS_MM.sip / MM_PER_FT;

/** Roof section for a volume built of a known material. The one entry point
 *  callers should use. */
export function roofSectionFor(v: Volume, wallT: number): RoofSection {
  const prev = roofSectionWallT;
  roofSectionWallT = wallT;
  try {
    return roofSection(v);
  } finally {
    roofSectionWallT = prev;
  }
}

/** A wall's top edge in (run, height), mirroring geometry.ts's
 *  `wallTopPoints`: a gable end follows the roof section, a wall crossing the
 *  fall axis carries a level top seated at the LOWER of its two roof heights. */
export function wallTopProfile(
  v: Volume,
  wall: Wall,
  roof: RoofSection,
  t: number,
): Pt[] {
  const runFt = wallRunFt(v, wall, t);
  const runsAlong = WALL_RUN_AXIS[wall];
  const { u0, u1, faceInner, faceOuter } = wallPlanFrame(v, wall, t);

  if (runsAlong === roof.fallAxis) {
    const dir = u1 >= u0 ? 1 : -1;
    const pts: Pt[] = [[0, Math.max(0, roof.topAt(u0) - ROOF_SEAT_FT)]];
    const uApex = (roof.apexA - u0) * dir;
    if (uApex > 1e-6 && uApex < runFt - 1e-6) pts.push([uApex, Math.max(0, roof.apexY - ROOF_SEAT_FT)]);
    pts.push([runFt, Math.max(0, roof.topAt(u1) - ROOF_SEAT_FT)]);
    return pts;
  }
  const y = Math.max(0, Math.min(roof.topAt(faceInner), roof.topAt(faceOuter)) - ROOF_SEAT_FT);
  return [
    [0, y],
    [runFt, y],
  ];
}

/* =====================================================================
   WALL FRAMES — where a wall starts, which way it runs, where its faces are
   ===================================================================== */

interface WallPlanFrame {
  /** plan coordinate of run = 0 and run = runFt, on the axis the wall runs */
  u0: number;
  u1: number;
  /** plan coordinates of the inner and outer faces, on the other axis */
  faceInner: number;
  faceOuter: number;
  /** local (x, z) of the run = 0 point, on the OUTER face */
  originOuter: Pt;
}

/** Restated from `lib/builder/geometry.ts::wallFrame`, in plan only. */
function wallPlanFrame(v: Volume, wall: Wall, t: number): WallPlanFrame {
  const W = v.widthFt;
  const D = v.depthFt;
  switch (wall) {
    case "n":
      return { u0: W / 2, u1: -W / 2, faceOuter: -D / 2, faceInner: -D / 2 + t, originOuter: [W / 2, -D / 2] };
    case "s":
      return { u0: -W / 2, u1: W / 2, faceOuter: D / 2, faceInner: D / 2 - t, originOuter: [-W / 2, D / 2] };
    case "e":
      return { u0: D / 2 - t, u1: -D / 2 + t, faceOuter: W / 2, faceInner: W / 2 - t, originOuter: [W / 2, D / 2 - t] };
    default:
      return { u0: -D / 2 + t, u1: D / 2 - t, faceOuter: -W / 2, faceInner: -W / 2 + t, originOuter: [-W / 2, -D / 2 + t] };
  }
}

/* =====================================================================
   OPENINGS IN THE WORLD
   ===================================================================== */

export interface WorldOpening {
  id: string;
  volumeId: string;
  volumeName: string;
  wall: Wall;
  kind: OpeningKind;
  /** as specified */
  widthFt: number;
  heightFt: number;
  offsetFt: number;
  sillFt: number;
  /** as DRAWN, after clamping into the built wall run */
  drawnOffsetFt: number;
  drawnWidthFt: number;
  /** true when the spec put it partly outside its wall and it had to be cut */
  clipped: boolean;
  /** true when the head runs above the wall's top edge at that point */
  headAboveWall: boolean;
  /** world plan endpoints on the OUTER wall face */
  a: Pt;
  b: Pt;
  /** world outward normal of its wall */
  normal: Pt;
  headFt: number;
}

export interface WorldWall {
  volumeId: string;
  volumeName: string;
  wall: Wall;
  runFt: number;
  thicknessFt: number;
  /** world plan endpoints on the OUTER face, run = 0 to run = runFt */
  a: Pt;
  b: Pt;
  /** world plan endpoints on the INNER face */
  innerA: Pt;
  innerB: Pt;
  normal: Pt;
  /** floor to the wall's top, at each end plus the ridge vertex if it crosses */
  topProfile: Pt[];
  /** false when the form does not build this wall (an a-frame's long sides) */
  built: boolean;
  openings: WorldOpening[];
}

function worldWall(
  v: Volume,
  wall: Wall,
  t: number,
  roof: RoofSection,
  warnings: string[],
): WorldWall {
  const runFt = wallRunFt(v, wall, t);
  const frame = wallPlanFrame(v, wall, t);
  const run = WALL_RUN[wall];
  const out = WALL_OUT[wall];
  const [ox, oz] = frame.originOuter;

  const at = (u: number, inward: number): Pt =>
    toWorld(v, ox + run[0] * u - out[0] * inward, oz + run[1] * u - out[1] * inward);

  const built = roof.buildsWall(wall);

  const openings: WorldOpening[] = [];
  for (const o of v.openings) {
    if (o.wall !== wall) continue;
    const start = Math.min(Math.max(0, o.offsetFt), runFt);
    const end = Math.min(Math.max(start, o.offsetFt + Math.max(0, o.widthFt)), runFt);
    const drawnWidthFt = end - start;
    const clipped = Math.abs(drawnWidthFt - Math.max(0, o.widthFt)) > 1e-6;
    if (clipped) {
      warnings.push(
        `${v.name} · ${WALL_NAME[wall]} wall: opening "${o.id}" is specified ${fmtNum(o.widthFt)} ft ` +
          `wide at ${fmtNum(o.offsetFt)} ft from the left end, which runs past the ${fmtNum(runFt)} ft ` +
          `built length of that wall. It is drawn cut to ${fmtNum(drawnWidthFt)} ft and must be ` +
          `corrected in the model, not on the drawing.`,
      );
    }
    if (!built) {
      warnings.push(
        `${v.name}: opening "${o.id}" is placed on the ${WALL_NAME[wall]} wall, and an A-frame has ` +
          `no wall there — the roof slope is the wall. It is listed in the schedule and NOT drawn ` +
          `in elevation, because drawing it would put a window in mid-air.`,
      );
    }
    const headFt = o.sillFt + Math.max(0, o.heightFt);
    // the wall's top at the opening's centre, for the head check
    const profile = wallTopProfile(v, wall, roof, t);
    const centre = (start + end) / 2;
    const topAtCentre = profileHeightAt(profile, centre);
    openings.push({
      id: o.id,
      volumeId: v.id,
      volumeName: v.name,
      wall,
      kind: o.kind,
      widthFt: o.widthFt,
      heightFt: o.heightFt,
      offsetFt: o.offsetFt,
      sillFt: o.sillFt,
      drawnOffsetFt: start,
      drawnWidthFt,
      clipped,
      headAboveWall: headFt > topAtCentre + 1e-6,
      a: at(start, 0),
      b: at(end, 0),
      normal: rotDir(v, out[0], out[1]),
      headFt,
    });
  }
  openings.sort((p, q) => p.drawnOffsetFt - q.drawnOffsetFt || p.id.localeCompare(q.id));

  return {
    volumeId: v.id,
    volumeName: v.name,
    wall,
    runFt,
    thicknessFt: t,
    a: at(0, 0),
    b: at(runFt, 0),
    innerA: at(0, t),
    innerB: at(runFt, t),
    normal: rotDir(v, out[0], out[1]),
    topProfile: wallTopProfile(v, wall, roof, t),
    built,
    openings,
  };
}

/** Height of a (run, height) polyline at a run position. */
function profileHeightAt(profile: readonly Pt[], u: number): number {
  if (profile.length === 0) return 0;
  if (u <= profile[0][0]) return profile[0][1];
  for (let i = 0; i + 1 < profile.length; i++) {
    const [x0, y0] = profile[i];
    const [x1, y1] = profile[i + 1];
    if (u <= x1) {
      const t = x1 - x0 < 1e-9 ? 0 : (u - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return profile[profile.length - 1][1];
}

const fmtNum = (v: number): string => String(Number(v.toPrecision(6)));

/* =====================================================================
   THE PILE GRID
   ===================================================================== */

export interface PileGrid {
  volumeId: string;
  /** world plan positions */
  points: Pt[];
  /** local grid line positions, for the dashed gridlines on the plan */
  xs: number[];
  zs: number[];
  spacingXFt: number;
  spacingZFt: number;
  count: number;
}

/**
 * A pile grid derived from the footprint at not more than `PILE_GRID_FT`
 * centres, with piles under every grid intersection including the perimeter.
 *
 * INDICATIVE, and the sheet says so in those words. Pile capacity comes from
 * the soil, embedment comes from the frost line and the torque readings on
 * the day, and the pile SCHEDULE is a P.Eng's document. What this grid is
 * good for is the thing a designer actually needs from it: a layout to
 * react to, and a count to sanity-check a quote against.
 */
export function pileGrid(v: Volume): PileGrid {
  const baysX = Math.max(1, Math.ceil(Math.max(1, v.widthFt) / PILE_GRID_FT));
  const baysZ = Math.max(1, Math.ceil(Math.max(1, v.depthFt) / PILE_GRID_FT));
  const spacingXFt = v.widthFt / baysX;
  const spacingZFt = v.depthFt / baysZ;
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i <= baysX; i++) xs.push(-v.widthFt / 2 + i * spacingXFt);
  for (let j = 0; j <= baysZ; j++) zs.push(-v.depthFt / 2 + j * spacingZFt);
  const points: Pt[] = [];
  for (const z of zs) for (const x of xs) points.push(toWorld(v, x, z));
  return { volumeId: v.id, points, xs, zs, spacingXFt, spacingZFt, count: points.length };
}

/* =====================================================================
   THE HOME MODEL
   ===================================================================== */

export interface VolumeModel {
  volume: Volume;
  /** world plan corners of the outer face, and of the inner face */
  outer: Pt[];
  inner: Pt[];
  roof: RoofSection;
  /** world plan corners of the roof, overhangs included */
  roofPlan: Pt[];
  /** world ridge line, or null for the forms without one */
  ridge: [Pt, Pt] | null;
  walls: WorldWall[];
  piles: PileGrid;
  footprintSqFt: number;
  eaveY: number;
  ridgeY: number;
}

export interface DeckModel {
  deck: Deck;
  corners: Pt[];
  /** world centre of the hot tub, when there is one */
  tub: Pt | null;
}

export interface HomeModel {
  spec: HomeSpec;
  wallThicknessFt: number;
  partitionThicknessFt: number;
  volumes: VolumeModel[];
  deck: DeckModel | null;
  /** walls and deck only */
  bounds: Box;
  /** including eave overhangs */
  boundsWithRoof: Box;
  totalFloorAreaSqFt: number;
  groundFootprintSqFt: number;
  glazedAreaSqFt: number;
  /** gross exterior wall area — DERIVED HERE, and rough: perimeter × wall
   *  height × storeys, with no deduction where two volumes meet. It exists to
   *  put the glass over a denominator, and the schedule sheet says so. */
  grossWallAreaSqFt: number;
  maxRidgeHeightFt: number;
  wallRValue: number;
  /** every limitation the model had to name */
  warnings: string[];
}

/** The world plan corners of the deck. Mirrors `geometry.ts::deckCornersPlan`. */
function deckModel(spec: HomeSpec): DeckModel | null {
  const deck = spec.deck;
  const host = spec.volumes[0];
  if (!deck || !host) return null;
  const runsAlongX = WALL_RUN_AXIS[deck.wall] === "x";
  const face = runsAlongX ? host.depthFt / 2 : host.widthFt / 2;
  const out = WALL_OUT[deck.wall];
  const cx = out[0] * (face + deck.depthFt / 2);
  const cz = out[1] * (face + deck.depthFt / 2);
  const w = runsAlongX ? deck.widthFt : deck.depthFt;
  const d = runsAlongX ? deck.depthFt : deck.widthFt;
  return {
    deck,
    corners: rectCorners(host, w, d, cx, cz),
    tub: deck.hotTub
      ? toWorld(
          host,
          cx + out[0] * (deck.depthFt / 2 - HOT_TUB_RADIUS_FT - 1),
          cz + out[1] * (deck.depthFt / 2 - HOT_TUB_RADIUS_FT - 1),
        )
      : null,
  };
}

/** The roof's plan rectangle, which is NOT simply the footprint plus overhang
 *  on four sides: a shed roof's high edge is flush with the wall. */
function roofPlanCorners(v: Volume, roof: RoofSection): Pt[] {
  const fa = roof.fallExtent;
  const pe = roof.perpExtent;
  const corners: Pt[] =
    roof.fallAxis === "x"
      ? [
          [fa.min, pe.min],
          [fa.max, pe.min],
          [fa.max, pe.max],
          [fa.min, pe.max],
        ]
      : [
          [pe.min, fa.min],
          [pe.max, fa.min],
          [pe.max, fa.max],
          [pe.min, fa.max],
        ];
  return corners.map(([x, z]) => toWorld(v, x, z));
}

function ridgeLine(v: Volume, roof: RoofSection): [Pt, Pt] | null {
  if (!roof.hasRidge) return null;
  const pe = roof.perpExtent;
  return roof.fallAxis === "x"
    ? [toWorld(v, roof.apexA, pe.min), toWorld(v, roof.apexA, pe.max)]
    : [toWorld(v, pe.min, roof.apexA), toWorld(v, pe.max, roof.apexA)];
}

/** Build the whole drawing model. Deterministic and total: a spec with no
 *  volumes returns an empty model plus a warning, never a throw. */
export function buildHomeModel(spec: HomeSpec): HomeModel {
  const warnings: string[] = [];
  const t = wallThicknessFt(spec);

  const volumes: VolumeModel[] = spec.volumes.map((v) => {
    const roof = roofSectionFor(v, t);
    warnings.push(...roof.warnings);
    const walls = (["n", "s", "e", "w"] as const).map((w) => worldWall(v, w, t, roof, warnings));
    if (Math.min(v.widthFt, v.depthFt) <= 2 * t + 0.5) {
      warnings.push(
        `${v.name} is ${fmtNum(Math.min(v.widthFt, v.depthFt))} ft on its short side, which a ` +
          `${WALL_THICKNESS_MM[spec.material]} mm wall on both faces leaves almost nothing inside. ` +
          `The plan is drawn as specified; it is not habitable at that size.`,
      );
    }
    return {
      volume: v,
      outer: rectCorners(v, v.widthFt, v.depthFt),
      inner: rectCorners(v, Math.max(0.1, v.widthFt - 2 * t), Math.max(0.1, v.depthFt - 2 * t)),
      roof,
      roofPlan: roofPlanCorners(v, roof),
      ridge: ridgeLine(v, roof),
      walls,
      piles: pileGrid(v),
      footprintSqFt: volumeFootprintSqFt(v),
      eaveY: roof.eaveY,
      ridgeY: roof.ridgeY,
    };
  });

  if (volumes.length === 0) {
    warnings.push(
      "This model has no volumes, so there is nothing to draw. Every sheet in the set is issued " +
        "with that stated rather than issued blank.",
    );
  }

  // roofs that intersect in plan: a real condition, and one this generator
  // does NOT resolve. Named rather than drawn wrong.
  for (let i = 0; i < volumes.length; i++) {
    for (let j = i + 1; j < volumes.length; j++) {
      const a = volumes[i];
      const b = volumes[j];
      if (boxesOverlap(boxOf([a.roofPlan]), boxOf([b.roofPlan]))) {
        warnings.push(
          `The roofs of "${a.volume.name}" and "${b.volume.name}" overlap in plan. Where two roofs ` +
            `meet there is a valley or a saddle, with flashing, a cricket and a drainage path — ` +
            `this generator does not design that junction and has not drawn a valley line. The ` +
            `intersection is marked on the roof plan for the designer to resolve.`,
        );
      }
    }
  }

  const deck = deckModel(spec);
  const wallPolys: Pt[][] = volumes.map((v) => v.outer);
  if (deck) wallPolys.push(deck.corners);
  const roofPolys: Pt[][] = volumes.map((v) => v.roofPlan);
  if (deck) roofPolys.push(deck.corners);

  const grossWallAreaSqFt = spec.volumes.reduce(
    (s, v) => s + 2 * (v.widthFt + v.depthFt) * v.wallHeightFt * v.storeys,
    0,
  );

  return {
    spec,
    wallThicknessFt: t,
    partitionThicknessFt: partitionThicknessFt(),
    volumes,
    deck,
    bounds: boxOf(wallPolys),
    boundsWithRoof: boxOf(roofPolys),
    totalFloorAreaSqFt: totalFloorAreaSqFt(spec),
    groundFootprintSqFt: groundFootprintSqFt(spec),
    glazedAreaSqFt: glazedAreaSqFt(spec),
    grossWallAreaSqFt,
    maxRidgeHeightFt: volumes.reduce((m, v) => Math.max(m, v.ridgeY), 0),
    wallRValue: WALL_R_VALUE[spec.material],
    warnings,
  };
}

/* =====================================================================
   ELEVATIONS

   An elevation is an orthographic projection onto a vertical plane. For a
   viewer looking in direction `f` with `up = +Y`, screen-right is `f × up`:

     NORTH elevation — you stand north and look SOUTH, so screen-right is WEST
     SOUTH elevation — stand south, look north, screen-right is EAST
     EAST  elevation — stand east,  look west,  screen-right is NORTH
     WEST  elevation — stand west,  look east,  screen-right is SOUTH

   Those four lines are the whole of the sign work, and every projection in
   this section goes through the single table below rather than deriving it
   again. Depth is measured TOWARD the viewer, so a larger depth draws later
   and occludes what is behind it — which is how a multi-volume home gets a
   correct hidden-line result without a hidden-line algorithm.
   ===================================================================== */

export type ElevationView = Wall;

interface ViewAxes {
  /** u = ux·x + uz·z */
  ux: number;
  uz: number;
  /** depth = dx·x + dz·z, larger is nearer the viewer */
  dx: number;
  dz: number;
  /** the direction the viewer looks, as (x, z) */
  fx: number;
  fz: number;
}

const VIEW_AXES: Readonly<Record<ElevationView, ViewAxes>> = {
  n: { ux: -1, uz: 0, dx: 0, dz: -1, fx: 0, fz: 1 },
  s: { ux: 1, uz: 0, dx: 0, dz: 1, fx: 0, fz: -1 },
  e: { ux: 0, uz: -1, dx: 1, dz: 0, fx: -1, fz: 0 },
  w: { ux: 0, uz: 1, dx: -1, dz: 0, fx: 1, fz: 0 },
};

export const ELEVATION_LABEL: Readonly<Record<ElevationView, string>> = {
  n: "NORTH ELEVATION",
  s: "SOUTH ELEVATION",
  e: "EAST ELEVATION",
  w: "WEST ELEVATION",
};

/** Bearing the named elevation faces, degrees clockwise from north. */
export const ELEVATION_BEARING: Readonly<Record<ElevationView, number>> = {
  n: 0,
  e: 90,
  s: 180,
  w: 270,
};

export type ElevationLayer = "mass" | "roof" | "parapet" | "floor" | "deck";

export interface ElevationShape {
  layer: ElevationLayer;
  /** closed outline in (u, y) FEET */
  pts: Pt[];
  depth: number;
}

export interface ElevationOpeningShape {
  id: string;
  kind: OpeningKind;
  /** the four projected corners, (u, y) feet, in order */
  pts: Pt[];
  /** mullion lines for a glazing wall, (u, y) feet */
  mullions: [Pt, Pt][];
  depth: number;
  sillFt: number;
  headFt: number;
}

export interface ElevationVolume {
  volumeId: string;
  name: string;
  shapes: ElevationShape[];
  openings: ElevationOpeningShape[];
  depth: number;
  eaveY: number;
  ridgeY: number;
  /** the pitch is in TRUE LENGTH in this view — a pitch triangle may be drawn */
  pitchTrue: boolean;
  pitchDeg: number;
  slope: number;
  /** u of the high line, when it reads as a point in this view */
  apexU: number | null;
}

export interface Elevation {
  view: ElevationView;
  label: string;
  /** far to near — draw in this order and nearer masses occlude farther ones */
  volumes: ElevationVolume[];
  /** unique u positions of the exposed piles, for the crawl-space columns */
  pileUs: number[];
  /** everything in the view, deck included */
  uMin: number;
  uMax: number;
  /** the BUILDING only, roof overhangs included and the deck excluded — the
   *  extent an overall building width should be dimensioned across, because a
   *  deck is an attachment and lettering it into the building width is how a
   *  dimension string becomes a lie */
  buildingUMin: number;
  buildingUMax: number;
  yMin: number;
  yMax: number;
  gradeY: number;
  notes: string[];
}

const project = (ax: ViewAxes, p: Pt): number => ax.ux * p[0] + ax.uz * p[1];
const depthOf = (ax: ViewAxes, p: Pt): number => ax.dx * p[0] + ax.dz * p[1];

/** Local (fall-axis, perpendicular) to local (x, z). */
const fromFall = (roof: RoofSection, a: number, s: number): Pt =>
  roof.fallAxis === "x" ? [a, s] : [s, a];

/** The mass under the roof: a prism over the footprint whose top surface is
 *  the roof section. Convex — see `hull`. */
function massShape(v: Volume, roof: RoofSection, ax: ViewAxes): ElevationShape {
  const as: number[] = [-roof.halfFall, roof.halfFall];
  if (roof.apexA > -roof.halfFall + 1e-6 && roof.apexA < roof.halfFall - 1e-6) as.push(roof.apexA);
  const ss = [-roof.halfPerp, roof.halfPerp];
  const pts: Pt[] = [];
  for (const a of as) {
    const top = Math.max(0, roof.topAt(a) - ROOF_SEAT_FT);
    for (const s of ss) {
      const [lx, lz] = fromFall(roof, a, s);
      const w = toWorld(v, lx, lz);
      const u = project(ax, w);
      pts.push([u, 0], [u, top]);
    }
  }
  return { layer: "mass", pts: hull(pts), depth: depthOf(ax, [v.x, v.z]) };
}

/**
 * One roof plane as a solid slab, projected. Convex.
 *
 * THE SIGN THAT MATTERS. A slab's underside is its top surface pushed one
 * thickness along the plane's DOWNWARD normal. Rotating the plane direction
 * by ninety degrees gives a normal whose sense flips with the direction the
 * plane is traversed — and a gable's two planes are traversed in opposite
 * directions (`a1 = +half+oh` and `a1 = -half-oh`). Taking that normal at
 * face value pushes one slab down and the other UP, which puts a roof surface
 * above the ridge and widens the elevation by a slab thickness. So the normal
 * is chosen by its sign, not by its formula: the one that points down.
 */
function planeShape(v: Volume, roof: RoofSection, plane: RoofPlane, ax: ViewAxes): ElevationShape {
  const da = plane.a1 - plane.a0;
  const dy = plane.y1 - plane.y0;
  const L = Math.max(1e-9, Math.hypot(da, dy));
  let nA = dy / L;
  let nY = -da / L;
  if (nY > 0) {
    nA = -nA;
    nY = -nY;
  }
  nA *= roof.thicknessFt;
  nY *= roof.thicknessFt;
  const pts: Pt[] = [];
  for (const [a, y] of [
    [plane.a0, plane.y0],
    [plane.a1, plane.y1],
  ] as const) {
    for (const s of [plane.s0, plane.s1]) {
      const [lx, lz] = fromFall(roof, a, s);
      const u = project(ax, toWorld(v, lx, lz));
      const [lx2, lz2] = fromFall(roof, a + nA, s);
      const u2 = project(ax, toWorld(v, lx2, lz2));
      pts.push([u, y], [u2, y + nY]);
    }
  }
  return { layer: "roof", pts: hull(pts), depth: depthOf(ax, [v.x, v.z]) };
}

function parapetShape(v: Volume, roof: RoofSection, ax: ViewAxes): ElevationShape | null {
  const p = roof.parapet;
  if (!p) return null;
  const pts: Pt[] = [];
  for (const a of [-p.halfA, p.halfA]) {
    for (const s of [-p.halfS, p.halfS]) {
      const [lx, lz] = fromFall(roof, a, s);
      const u = project(ax, toWorld(v, lx, lz));
      pts.push([u, p.lowY - 0.4], [u, p.topY]);
    }
  }
  return { layer: "parapet", pts: hull(pts), depth: depthOf(ax, [v.x, v.z]) };
}

/** The structural floor deck, between the underside of the floor and finished
 *  floor level. What makes an elevation of a pile-founded home read correctly. */
function floorShape(v: Volume, ax: ViewAxes): ElevationShape {
  const us = rectCorners(v, v.widthFt, v.depthFt).map((p) => project(ax, p));
  const e = extentOf(us);
  return {
    layer: "floor",
    pts: [
      [e.min, -FLOOR_SLAB_FT],
      [e.max, -FLOOR_SLAB_FT],
      [e.max, 0],
      [e.min, 0],
    ],
    depth: depthOf(ax, [v.x, v.z]),
  };
}

function openingShapes(
  wall: WorldWall,
  ax: ViewAxes,
  notes: string[],
): ElevationOpeningShape[] {
  // Only a wall that FACES the viewer shows its openings. A wall seen edge-on
  // shows none, and a wall turned away shows none — drawing either would put
  // glass where a reviewer would look for it and not find it.
  const facing = wall.normal[0] * ax.fx + wall.normal[1] * ax.fz;
  if (!(facing < -0.02)) return [];
  if (!wall.built) return [];

  const out: ElevationOpeningShape[] = [];
  for (const o of wall.openings) {
    if (o.drawnWidthFt <= 1e-6 || o.heightFt <= 1e-6) continue;
    const uA = project(ax, o.a);
    const uB = project(ax, o.b);
    const head = o.sillFt + o.heightFt;
    const mullions: [Pt, Pt][] = [];
    if (o.kind === "glazing-wall") {
      const bays = Math.max(1, Math.round(o.drawnWidthFt / MULLION_SPACING_FT));
      for (let i = 1; i < bays; i++) {
        const f = i / bays;
        const u = uA + (uB - uA) * f;
        mullions.push([
          [u, o.sillFt],
          [u, head],
        ]);
      }
    }
    if (o.headAboveWall) {
      notes.push(
        `Opening "${o.id}" on the ${WALL_NAME[o.wall]} wall of ${o.volumeName} has its head at ` +
          `${fmtNum(head)} ft, above the wall's top edge at that point. It is drawn as specified ` +
          `and it is a clash: either the wall or the opening has to change.`,
      );
    }
    out.push({
      id: o.id,
      kind: o.kind,
      pts: [
        [uA, o.sillFt],
        [uB, o.sillFt],
        [uB, head],
        [uA, head],
      ],
      mullions,
      depth: depthOf(ax, o.a),
      sillFt: o.sillFt,
      headFt: head,
    });
  }
  return out;
}

/** One elevation. */
export function elevationOf(model: HomeModel, view: ElevationView): Elevation {
  const ax = VIEW_AXES[view];
  const notes: string[] = [];

  const volumes: ElevationVolume[] = model.volumes.map((vm) => {
    const v = vm.volume;
    const roof = vm.roof;
    const shapes: ElevationShape[] = [floorShape(v, ax), massShape(v, roof, ax)];
    for (const plane of roof.planes) shapes.push(planeShape(v, roof, plane, ax));
    const para = parapetShape(v, roof, ax);
    if (para) shapes.push(para);

    const openings: ElevationOpeningShape[] = [];
    for (const wall of vm.walls) openings.push(...openingShapes(wall, ax, notes));

    /* Is the pitch in TRUE LENGTH here? Only when the fall axis is
       perpendicular to the direction the viewer looks. Otherwise the slope is
       foreshortened, and a pitch triangle drawn on it would be a measurement
       that is simply not true — so the sheet prints the pitch as a note
       instead of drawing a triangle that lies. */
    const fallDir =
      roof.fallAxis === "x" ? rotDir(v, 1, 0) : rotDir(v, 0, 1);
    const alongView = Math.abs(fallDir[0] * ax.fx + fallDir[1] * ax.fz);
    const pitchTrue = alongView < 0.05;

    const apexLocal = fromFall(roof, roof.apexA, 0);
    const apexU = roof.hasRidge ? project(ax, toWorld(v, apexLocal[0], apexLocal[1])) : null;

    return {
      volumeId: v.id,
      name: v.name,
      shapes,
      openings,
      depth: depthOf(ax, [v.x, v.z]),
      eaveY: roof.eaveY,
      ridgeY: roof.ridgeY,
      pitchTrue,
      pitchDeg: v.roof.pitchDeg,
      slope: roof.slope,
      apexU,
    };
  });

  // Painter's algorithm: draw far first. Correct for masses that do not
  // interpenetrate, which is the case the builder's overlap check enforces.
  volumes.sort((a, b) => a.depth - b.depth || a.volumeId.localeCompare(b.volumeId));
  if (model.volumes.length > 1) {
    notes.push(
      "Where volumes overlap in this view the nearer one is drawn over the farther one. That is " +
        "correct for separate masses and it is NOT a hidden-line solution for masses that " +
        "interpenetrate — a model with overlapping volumes needs the overlap fixed before this " +
        "elevation can be trusted.",
    );
  }

  // deck, drawn once — it belongs to the first volume
  if (model.deck) {
    const us = model.deck.corners.map((p) => project(ax, p));
    const e = extentOf(us);
    const top = -DECK_STEP_FT;
    const target = volumes[volumes.length - 1];
    if (target) {
      target.shapes.push({
        layer: "deck",
        pts: [
          [e.min, top - DECK_SLAB_FT - DECK_BEAM_FT],
          [e.max, top - DECK_SLAB_FT - DECK_BEAM_FT],
          [e.max, top],
          [e.min, top],
        ],
        depth: depthOf(ax, model.deck.corners[0]),
      });
    }
  }

  // the exposed piles, deduped by u so the field reads as the columns you
  // would actually see rather than as a thicket
  const seen = new Set<string>();
  const pileUs: number[] = [];
  for (const vm of model.volumes) {
    for (const p of vm.piles.points) {
      const u = project(ax, p);
      const key = u.toFixed(2);
      if (seen.has(key)) continue;
      seen.add(key);
      pileUs.push(u);
    }
  }
  pileUs.sort((a, b) => a - b);

  const us: number[] = [];
  const buildingUs: number[] = [];
  const ys: number[] = [GRADE_Y_FT];
  for (const v of volumes) {
    for (const s of v.shapes) {
      for (const p of s.pts) {
        us.push(p[0]);
        ys.push(p[1]);
        if (s.layer !== "deck") buildingUs.push(p[0]);
      }
    }
  }

  const uE = extentOf(us);
  const bE = extentOf(buildingUs.length > 0 ? buildingUs : us);
  const yE = extentOf(ys);
  return {
    view,
    label: ELEVATION_LABEL[view],
    volumes,
    pileUs,
    uMin: uE.min,
    uMax: uE.max,
    buildingUMin: bE.min,
    buildingUMax: bE.max,
    yMin: Math.min(yE.min, GRADE_Y_FT),
    yMax: yE.max,
    gradeY: GRADE_Y_FT,
    notes,
  };
}

export const allElevations = (model: HomeModel): Elevation[] =>
  (["n", "e", "s", "w"] as const).map((view) => elevationOf(model, view));

/* =====================================================================
   THE BUILDING SECTION
   ===================================================================== */

export interface SectionWall {
  /** poché rectangle in (u, y) feet */
  pts: Pt[];
  label: string;
}

export interface SectionOpening {
  /** the four corners of an opening on the FAR wall, seen beyond the cut */
  pts: Pt[];
  kind: OpeningKind;
  id: string;
}

export interface BuildingSection {
  volumeId: string;
  volumeName: string;
  /** "A" — the tag on the plan */
  tag: string;
  /** the cut runs along this local axis of the volume */
  cutAxis: "x" | "z";
  /** world endpoints of the cut line, for the marker on the floor plan */
  cutLine: [Pt, Pt];
  /** the direction the section is viewed, as a world (x, z) vector */
  viewDir: Pt;
  /** cut walls, in poché */
  walls: SectionWall[];
  /** the roof slabs in section: top line and bottom line, (u, y) feet */
  roof: { top: Pt[]; bottom: Pt[] };
  /** the floor deck in poché */
  floor: Pt[];
  /** the finished-floor line and the underside line */
  uMin: number;
  uMax: number;
  gradeY: number;
  floorY: number;
  eaveY: number;
  ridgeY: number;
  /** clear height floor to the underside of the roof at the high point */
  clearHeightFt: number;
  /** openings on the far wall, seen beyond the cut */
  beyond: SectionOpening[];
  pileUs: number[];
  notes: string[];
}

/**
 * A section through the primary volume's LONG axis, at the volume's centre.
 *
 * `right = f × up` again decides the sign: the viewer is placed on the side
 * that makes the page read left-to-right in the volume's own +axis, so the
 * section and the plan agree about which end is which.
 */
export function sectionOf(model: HomeModel, tag = "A"): BuildingSection | null {
  let primary: VolumeModel | null = null;
  for (const vm of model.volumes) {
    if (primary === null || vm.footprintSqFt > primary.footprintSqFt) primary = vm;
  }
  if (!primary) return null;

  const v = primary.volume;
  const roof = primary.roof;
  const t = model.wallThicknessFt;
  const notes: string[] = [];

  // the cut contains the LONG plan axis
  const cutAxis: "x" | "z" = v.widthFt >= v.depthFt ? "x" : "z";
  const halfCut = (cutAxis === "x" ? v.widthFt : v.depthFt) / 2;

  /* WHICH WAY TO LOOK. The two walls parallel to the cut are the candidates
     for what is seen BEYOND it, and a section is worth more looking at the one
     with the glass in it — that is the wall a reviewer wants to see against
     the ceiling height. Ties keep the first candidate, so the answer is stable
     for a given home rather than pleasant. */
  const candidates: Wall[] = cutAxis === "x" ? ["n", "s"] : ["w", "e"];
  const glassArea = (w: Wall): number => {
    const wm = primary!.walls.find((x) => x.wall === w);
    return wm && wm.built ? wm.openings.reduce((s, o) => s + o.drawnWidthFt * o.heightFt, 0) : 0;
  };
  const farWall: Wall = glassArea(candidates[1]) > glassArea(candidates[0]) ? candidates[1] : candidates[0];

  // the viewer looks TOWARD the far wall
  const viewLocal = WALL_OUT[farWall];
  const viewDir = rotDir(v, viewLocal[0], viewLocal[1]);

  /* `right = f × up` again, and this is the whole of the sign work: looking
     toward local −Z page-right is local +X; toward +Z it is −X; toward +X it
     is +Z; toward −X it is −Z. Every u in this section goes through `U`, so
     the section and the arrows on the plan cannot disagree about handedness.
     It also means the far wall is correctly seen FROM INSIDE — left and right
     mirrored against how the same wall reads in elevation. */
  const uSign: 1 | -1 = cutAxis === "x" ? (farWall === "n" ? 1 : -1) : farWall === "e" ? 1 : -1;
  const U = (a: number): number => uSign * a;
  const mapPts = (pts: readonly Pt[]): Pt[] => pts.map(([a, y]) => [U(a), y] as Pt);

  const cutLine: [Pt, Pt] =
    cutAxis === "x"
      ? [toWorld(v, -halfCut - 3, 0), toWorld(v, halfCut + 3, 0)]
      : [toWorld(v, 0, -halfCut - 3), toWorld(v, 0, halfCut + 3)];

  /* The roof height over the cut. If the roof falls along the CUT axis the
     section shows the pitch; if it falls across it, the cut runs along the
     ridge and the section correctly shows a level line at the ridge. Both are
     true sections, and evaluating `topAt` at the right argument is the whole
     difference. */
  const alongFall = roof.fallAxis === cutAxis;
  const topOver = (u: number): number => roof.topAt(alongFall ? u : 0);
  if (!alongFall) {
    notes.push(
      `This cut runs along the ridge, so the roof reads as a level line rather than as a slope. ` +
        `The pitch is ${fmtNum(v.roof.pitchDeg)}° and it is seen in true length on the ` +
        `${roof.fallAxis === "x" ? "north and south" : "east and west"} elevations, not here.`,
    );
  }

  // --- the two cut walls, at the ends of the cut axis
  const wallTopAt = (outerU: number, innerU: number): number =>
    Math.max(0, Math.min(topOver(outerU), topOver(innerU)) - ROOF_SEAT_FT);

  const walls: SectionWall[] = [];
  const built = roof.buildsWall(cutAxis === "x" ? "e" : "n");
  if (built) {
    for (const sign of [-1, 1] as const) {
      const outerU = sign * halfCut;
      const innerU = sign * (halfCut - t);
      const top = wallTopAt(outerU, innerU);
      const u0 = Math.min(outerU, innerU);
      const u1 = Math.max(outerU, innerU);
      walls.push({
        pts: mapPts([
          [u0, 0],
          [u1, 0],
          [u1, top],
          [u0, top],
        ]),
        label: `${cutAxis === "x" ? (sign < 0 ? WALL_NAME.w : WALL_NAME.e) : sign < 0 ? WALL_NAME.n : WALL_NAME.s} WALL`,
      });
    }
  } else {
    notes.push(
      "This volume is an A-frame: the roof slope IS the wall on this cut, so no vertical wall is " +
        "shown in section at the ends. That is the form, not an omission.",
    );
  }

  // --- roof in section: the top line follows `topOver`, the bottom is one
  //     roof thickness below it measured perpendicular to the plane
  const uEnd = roof.fallAxis === cutAxis ? roof.fallExtent : { min: -halfCut, max: halfCut };
  const stops: number[] = [uEnd.min, uEnd.max];
  if (alongFall && roof.apexA > uEnd.min + 1e-6 && roof.apexA < uEnd.max - 1e-6) stops.push(roof.apexA);
  stops.sort((a, b) => a - b);
  const localTop: Pt[] = stops.map((u) => [u, topOver(u)]);
  /* A slab of perpendicular thickness t on a slope θ is t/cos θ deep measured
     VERTICALLY, and that is true at the ridge as well as on the slope — so it
     does not depend on which way this particular cut runs. */
  const drop = roof.thicknessFt / Math.max(0.1, Math.cos(roof.angleRad));
  const localBottom: Pt[] = localTop.map(([u, y]) => [u, y - drop]);
  // keep both polylines running left-to-right on the PAGE after the mirror,
  // so `top[i]` and `bottom[i]` stay the same station
  const top = uSign < 0 ? mapPts(localTop).reverse() : mapPts(localTop);
  const bottom = uSign < 0 ? mapPts(localBottom).reverse() : mapPts(localBottom);

  // --- floor deck
  const floor: Pt[] = mapPts([
    [-halfCut, -FLOOR_SLAB_FT],
    [halfCut, -FLOOR_SLAB_FT],
    [halfCut, 0],
    [-halfCut, 0],
  ]);

  // --- what is seen beyond the cut: the openings on the far wall
  const beyond: SectionOpening[] = [];
  const farWallModel = primary.walls.find((w) => w.wall === farWall);
  if (farWallModel && farWallModel.built) {
    const frame = wallPlanFrame(v, farWall, t);
    const runDir = WALL_RUN[farWall];
    const runsOnCut = WALL_RUN_AXIS[farWall] === cutAxis;
    for (const o of farWallModel.openings) {
      if (!runsOnCut || o.drawnWidthFt <= 1e-6) continue;
      // local coordinate on the cut axis at each end of the opening
      const base = cutAxis === "x" ? frame.originOuter[0] : frame.originOuter[1];
      const step = cutAxis === "x" ? runDir[0] : runDir[1];
      const uA = base + step * o.drawnOffsetFt;
      const uB = base + step * (o.drawnOffsetFt + o.drawnWidthFt);
      beyond.push({
        id: o.id,
        kind: o.kind,
        pts: mapPts([
          [Math.min(uA, uB), o.sillFt],
          [Math.max(uA, uB), o.sillFt],
          [Math.max(uA, uB), o.headFt],
          [Math.min(uA, uB), o.headFt],
        ]),
      });
    }
  }

  const piles = primary.piles;
  const pileUs = Array.from(new Set((cutAxis === "x" ? piles.xs : piles.zs).map((n) => n.toFixed(2))))
    .map(Number)
    .map(U)
    .sort((a, b) => a - b);

  return {
    volumeId: v.id,
    volumeName: v.name,
    tag,
    cutAxis,
    cutLine,
    viewDir,
    walls,
    roof: { top, bottom },
    floor,
    uMin: Math.min(U(uEnd.min), U(uEnd.max), -halfCut, halfCut),
    uMax: Math.max(U(uEnd.min), U(uEnd.max), -halfCut, halfCut),
    gradeY: GRADE_Y_FT,
    floorY: 0,
    eaveY: roof.eaveY,
    ridgeY: roof.ridgeY,
    clearHeightFt: Math.max(0, topOver(alongFall ? roof.apexA : 0) - drop),
    beyond,
    pileUs,
    notes: [...notes, `Section ${tag} is cut at the centre of ${v.name}, looking ${sectionLookLabel(viewDir)}.`],
  };
}

function sectionLookLabel(dir: Pt): string {
  const bearing = ((Math.atan2(dir[0], -dir[1]) * 180) / Math.PI + 360) % 360;
  const points = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return points[Math.round(bearing / 45) % 8];
}

/* =====================================================================
   SCHEDULES
   ===================================================================== */

export interface ScheduleRow {
  mark: string;
  kind: OpeningKind;
  type: string;
  widthFt: number;
  heightFt: number;
  qty: number;
  roWidthFt: number;
  roHeightFt: number;
  sillFt: number;
  headFt: number;
  /** every wall this mark appears on */
  locations: string[];
  areaSqFt: number;
}

const TYPE_LABEL: Readonly<Record<OpeningKind, string>> = {
  window: "Fixed / operable window, triple glazed",
  door: "Insulated exterior door",
  "glazing-wall": "Glazed screen, triple glazed, mullions at 4'-0\" max",
};

const MARK_PREFIX: Readonly<Record<OpeningKind, string>> = {
  window: "W",
  door: "D",
  "glazing-wall": "G",
};

/**
 * The window and door schedule.
 *
 * Openings are grouped by KIND and SIZE, which is how a supplier quotes them
 * and how a mark is meant to work — six identical windows are one line with a
 * quantity of six, not six lines. Grouping is on the size as SPECIFIED, so a
 * unit that had to be cut to fit its wall is still counted with its family and
 * the clash is reported separately rather than silently splitting the mark.
 */
export function openingSchedule(model: HomeModel): ScheduleRow[] {
  const groups = new Map<string, ScheduleRow>();
  const order: string[] = [];

  for (const vm of model.volumes) {
    for (const wall of vm.walls) {
      for (const o of wall.openings) {
        const key = `${o.kind}|${o.widthFt.toFixed(4)}|${o.heightFt.toFixed(4)}|${o.sillFt.toFixed(4)}`;
        let row = groups.get(key);
        if (!row) {
          row = {
            mark: "",
            kind: o.kind,
            type: TYPE_LABEL[o.kind],
            widthFt: o.widthFt,
            heightFt: o.heightFt,
            qty: 0,
            roWidthFt: o.widthFt + RO_WIDTH_ALLOWANCE_FT,
            roHeightFt: o.heightFt + RO_HEIGHT_ALLOWANCE_FT,
            sillFt: o.sillFt,
            headFt: o.headFt,
            locations: [],
            areaSqFt: 0,
          };
          groups.set(key, row);
          order.push(key);
        }
        row.qty += 1;
        row.areaSqFt += o.widthFt * o.heightFt;
        const where = `${vm.volume.name} · ${WALL_NAME[o.wall]}`;
        if (!row.locations.includes(where)) row.locations.push(where);
      }
    }
  }

  /* Marks are assigned in a STABLE order — doors, then windows, then glazed
     screens, each largest first — so the same home always produces the same
     mark for the same unit and a revised set can be diffed against the last. */
  const rank: Record<OpeningKind, number> = { door: 0, window: 1, "glazing-wall": 2 };
  const rows = order.map((k) => groups.get(k)!);
  rows.sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      b.widthFt * b.heightFt - a.widthFt * a.heightFt ||
      b.widthFt - a.widthFt ||
      a.sillFt - b.sillFt,
  );
  const counters: Record<string, number> = {};
  for (const row of rows) {
    const p = MARK_PREFIX[row.kind];
    counters[p] = (counters[p] ?? 0) + 1;
    row.mark = `${p}${counters[p]}`;
  }
  return rows;
}

/** Fenestration-and-door-to-wall ratio, measured against THIS model's own
 *  gross wall area. Not the plan engine's FDWR, which measures the packer's
 *  windows against the envelope the packer solved — two honest numbers about
 *  different glass, and the schedule sheet prints which is which. */
export const modelFdwr = (model: HomeModel): number => {
  let glazedAndDoors = 0;
  for (const vm of model.volumes) {
    for (const wall of vm.walls) {
      for (const o of wall.openings) glazedAndDoors += o.widthFt * o.heightFt;
    }
  }
  return model.grossWallAreaSqFt > 0 ? glazedAndDoors / model.grossWallAreaSqFt : 0;
};

/** Total pile count across every volume. */
export const totalPiles = (model: HomeModel): number =>
  model.volumes.reduce((s, v) => s + v.piles.count, 0);

/** The opening a caller most wants named on the cover: the biggest glazed
 *  unit, since that is the one that decides the elevation and the lead time. */
export function largestGlazing(model: HomeModel): WorldOpening | null {
  let best: WorldOpening | null = null;
  for (const vm of model.volumes) {
    for (const wall of vm.walls) {
      for (const o of wall.openings) {
        if (o.kind === "door") continue;
        if (best === null || o.widthFt * o.heightFt > best.widthFt * best.heightFt) best = o;
      }
    }
  }
  return best;
}
