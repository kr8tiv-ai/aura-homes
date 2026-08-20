/* ===========================================================================
   THE SHEETS — eight drawings, in the order a permit set carries them.

   Every sheet in this file follows the same three steps and no others:

     1. ask `model.ts` for the coordinates, in FEET
     2. choose a real scale off the ladder in `kit.ts`, largest that fits
     3. ink it, in the drawing language of `lib/design/blueprint.ts`

   No sheet computes geometry and no sheet invents a fact. Where a fact is
   missing — a lot with no dimensions, a roof junction this generator does not
   resolve, an assembly R-value the material table does not carry — the sheet
   is issued with the gap NAMED, in the general notes and in the returned
   `notes` array, rather than issued with a plausible number in the gap. That
   rule is the difference between a set worth a professional's time and a set
   that wastes it.
   =========================================================================== */

import {
  FDWR_MAX,
  MATERIAL_KEYWORDS,
  WALL_R_VALUE,
  WALL_THICKNESS_MM,
} from "@/lib/design/materials";
import { buildableEnvelope, FACING_DEG, type Facing, type ParcelFacts } from "@/lib/design/parcel";
import type { HomeSpec, Volume } from "@/lib/builder/spec";

import {
  allElevations,
  ARRAY_SQ_FT_PER_KW,
  boxOf,
  boxesOverlap,
  ELEVATION_BEARING,
  FLAT_ROOF_FALL_DEG,
  FLOOR_SLAB_FT,
  GRADE_Y_FT,
  HOT_TUB_RADIUS_FT,
  modelFdwr,
  openingSchedule,
  PILE_GRID_FT,
  sectionOf,
  totalPiles,
  WALL_NAME,
  type BuildingSection,
  type Elevation,
  type ElevationVolume,
  type HomeModel,
  type Pt,
  type ScheduleRow,
  type VolumeModel,
} from "./model";

import {
  archScale,
  charsIn,
  circle,
  CONTENT,
  CONTENT_H,
  CONTENT_W,
  DASH_CENTRE,
  DASH_FINE,
  DASH_HIDDEN,
  deg,
  dim,
  drawingDataUrl,
  FULL,
  fmtFt,
  fmtFtFrac,
  fmtG,
  fx,
  leader,
  levelTag,
  line,
  northArrow,
  path,
  poche,
  poly,
  polyD,
  rect,
  riseOver12,
  scaleBar,
  sheet,
  siteScale,
  sqFt,
  table,
  text,
  wrap,
  type DrawScale,
  type TableColumn,
} from "./kit";

export { drawingDataUrl };

/* =====================================================================
   WHAT A CALLER GIVES US, AND WHAT COMES BACK
   ===================================================================== */

/**
 * The parcel, when the owner has one.
 *
 * `HomeSpec.siting` carries a bearing and a slope and nothing else, on
 * purpose — a spec is a model of a HOME, not of a piece of land. So the lot
 * arrives separately, and when it does not arrive the site plan says so in
 * those words instead of drawing a rectangle nobody surveyed.
 */
export interface DrawingParcel {
  lotWidthFt: number;
  lotDepthFt: number;
  frontSetbackFt: number;
  sideSetbackFt: number;
  rearSetbackFt: number;
  /** Where the home sits inside the lot, from the lot's front-left corner.
   *  Omitted, the home is centred across the frontage and set at the front
   *  setback — stated on the sheet as a placement, not a survey. */
  homeFromFrontFt?: number;
  homeFromLeftFt?: number;
  /** Free text: "Driveway from the north-east corner", etc. */
  accessNote?: string;
  /** True when the parcel is served by a private well and a septic field, so
   *  the separation note is the governing one rather than a general remark. */
  wellAndSeptic?: boolean;
}

/**
 * A solved interior room program, when one exists.
 *
 * Structurally typed rather than imported: `lib/builder/toPlan.ts` owns the
 * bridge to the plan engine and this module must not become a second opinion
 * about it. Feet, origin at the envelope's top-left, +x right and +y down —
 * the plan engine's own frame.
 */
export interface DrawingRooms {
  envelopeWidthFt: number;
  envelopeDepthFt: number;
  rooms: readonly { name: string; x: number; y: number; w: number; h: number }[];
}

export interface DrawingSetInput {
  spec: HomeSpec;
  /** ISO date for the title block. A PARAMETER, so the set is reproducible. */
  dateISO: string;
  projectName?: string;
  address?: string;
  legalDescription?: string;
  drawnBy?: string;
  revision?: string;
  parcel?: DrawingParcel | null;
  rooms?: DrawingRooms | null;
  /** Array size, when the owner has chosen one. The HomeSpec does not carry
   *  systems, so an array is drawn only when this is supplied. */
  solarKw?: number | null;
}

export interface DrawingSheet {
  /** "A0" … "A7" */
  number: string;
  title: string;
  /** Exactly as printed in the title block. */
  scale: string;
  svg: string;
  /** Limitations and assumptions named on this sheet. */
  notes: string[];
}

export interface DrawingSetResult {
  sheets: DrawingSheet[];
  index: { number: string; title: string; scale: string }[];
  /** Everything the model had to clamp, cut or refuse. */
  warnings: string[];
}

interface Ctx {
  input: DrawingSetInput;
  model: HomeModel;
  spec: HomeSpec;
  parcel: DrawingParcel | null;
  projectName: string;
  meta: string[];
}

/* =====================================================================
   THE HONESTY FURNITURE — the same words on every set
   ===================================================================== */

/**
 * Who finishes this set, said precisely.
 *
 * The founder's phrasing was "approved by an architect", and the copy must
 * not repeat it, because it describes something that does not happen. A
 * professional does not approve someone else's drawings; they review, they
 * take responsibility, and they SEAL. And in Alberta the professional in
 * question is usually not an architect at all.
 */
export const PROFESSIONAL_NOTE = [
  "WHO COMPLETES THIS SET. These drawings are generated from a model. They are a coordinated " +
    "starting set — drawn to scale, dimensioned, and scheduled — issued so that a professional " +
    "can review and correct them quickly rather than start from a blank sheet.",
  "A professional does not 'approve' someone else's drawings. They review them, take " +
    "professional responsibility for them, and SEAL them. Nothing in this set is sealed.",
  "In Alberta the Architects Act exempts dwellings of one to four units from the requirement " +
    "for an architect, of any size. For a single home the professional who normally completes " +
    "and seals a permit set is a LICENSED RESIDENTIAL DESIGNER. Roof truss design arrives " +
    "separately, stamped by the truss manufacturer's engineer. The screw-pile foundation needs " +
    "a P.Eng. Confirm the current requirement with the authority having jurisdiction — " +
    "requirements differ between municipalities and they change.",
  "WHAT IS STILL MISSING before this is a permit set: structural design and stamps, a real " +
    "site survey, soil and pile design, energy-code compliance calculations (NBC 9.36), " +
    "mechanical and electrical layouts, and the local land use bylaw checks. Every one of " +
    "those is named on the sheet it belongs to rather than left to be discovered.",
] as const;

const SET_NOTES = [
  "Drawn from a HomeSpec by the Aura drawing engine. The linework is deterministic arithmetic — " +
    "no AI, no randomness — so the same model and the same date always produce the same set.",
  "Dimensions are to STRUCTURE (face of structural wall), not to finishes.",
  "Feet and inches throughout. Wall thickness is the only millimetre dimension in the system, " +
    "because that is how panel and mass-wall products are actually specified.",
  "Verify every dimension on site before ordering material. A drawing generated from a model is " +
    "only as square as the model.",
] as const;

/* =====================================================================
   SHARED HELPERS
   ===================================================================== */

const MATERIAL_LABEL = (m: HomeSpec["material"]): string => m.replace(/_/g, " ").toUpperCase();

/**
 * Paper reserved around a drawing for its dimension strings, in POINTS.
 *
 * Reserved in points rather than as a margin in FEET, deliberately: a foot of
 * padding is 18 pt at 1/4" and 4.5 pt at 1/16", so a feet-based margin gets
 * enormous at the scales where there is least room and vanishes at the scales
 * where dimension text is largest. A dimension string is the same size on the
 * paper whatever the scale, so the reserve is too — and the drawing then wins
 * the largest scale that genuinely fits.
 */
const DIM_RESERVE_W = 150;
const DIM_RESERVE_H = 130;

/**
 * How a roof pitch is lettered.
 *
 * The BUILT angle leads, because that is what the drawing is drawn at and what
 * a framer sets a rafter to. `Roof.pitchDeg` is a parameter and for two of the
 * five forms it is not the built angle — `spec.ts` doubles the rise on an
 * A-frame and slides the ridge off centre on a saltbox. Printing the parameter
 * beside a rise-over-12 taken from the built slope would put two numbers on
 * the sheet that contradict each other, so when they differ both appear and
 * the difference is named.
 */
function pitchLabel(builtDeg: number, specDeg: number, slope: number): string {
  const base = `${deg(builtDeg)} (${riseOver12(slope)})`;
  return Math.abs(builtDeg - specDeg) < 0.5 ? base : `${base} as built; spec pitch ${deg(specDeg)}`;
}

/** The nearest of `lib/design/parcel.ts`'s eight facings to a bearing. */
function nearestFacing(bearingDeg: number): Facing {
  const keys = Object.keys(FACING_DEG) as Exclude<Facing, "unknown">[];
  let best: Exclude<Facing, "unknown"> = keys[0];
  let bestGap = Infinity;
  for (const k of keys) {
    const d = Math.abs(((bearingDeg - FACING_DEG[k]) % 360) + 360) % 360;
    const gap = d > 180 ? 360 - d : d;
    if (gap < bestGap - 1e-9) {
      best = k;
      bestGap = gap;
    }
  }
  return best;
}

/** A world-plan → paper-point mapper, north up: +x east is page-right and
 *  +z south is page-down, which is the same orientation the plan engine's own
 *  sheet uses and the orientation every plan in this set is drawn in. */
interface PlanMap {
  s: DrawScale;
  px: (x: number) => number;
  py: (z: number) => number;
  pt: (p: Pt) => readonly [number, number];
  widthPt: number;
  heightPt: number;
}

function planMap(
  box: { minX: number; maxX: number; minZ: number; maxZ: number },
  s: DrawScale,
  originX: number,
  originY: number,
): PlanMap {
  const px = (x: number) => originX + (x - box.minX) * s.ptPerFt;
  const py = (z: number) => originY + (z - box.minZ) * s.ptPerFt;
  return {
    s,
    px,
    py,
    pt: (p: Pt) => [px(p[0]), py(p[1])] as const,
    widthPt: (box.maxX - box.minX) * s.ptPerFt,
    heightPt: (box.maxZ - box.minZ) * s.ptPerFt,
  };
}

/** Poché one volume's walls, then knock its openings out of them and draw
 *  them — exactly the order `lib/design/blueprint.ts` draws in, because the
 *  knock-out has to be painted before the glass or the wall stays solid. */
function drawVolumePlan(out: string[], vm: VolumeModel, m: PlanMap, wallFt: number): void {
  const outer = vm.outer.map(m.pt);
  const inner = vm.inner.map(m.pt);
  out.push(poche(outer, inner));

  const knockW = Math.max(2, wallFt * m.s.ptPerFt * 1.05);
  for (const wall of vm.walls) {
    if (!wall.built) continue;
    for (const o of wall.openings) {
      if (o.drawnWidthFt <= 1e-6) continue;
      // the cut runs on the wall CENTRELINE so the knock-out covers the poché
      const n = wall.normal;
      const half = wallFt / 2;
      const a: Pt = [o.a[0] - n[0] * half, o.a[1] - n[1] * half];
      const b: Pt = [o.b[0] - n[0] * half, o.b[1] - n[1] * half];
      const pa = m.pt(a);
      const pb = m.pt(b);
      out.push(line(pa[0], pa[1], pb[0], pb[1], "adw-knock", knockW));
    }
  }

  for (const wall of vm.walls) {
    if (!wall.built) continue;
    const n = wall.normal;
    for (const o of wall.openings) {
      if (o.drawnWidthFt <= 1e-6) continue;
      const half = wallFt / 2;
      const a: Pt = [o.a[0] - n[0] * half, o.a[1] - n[1] * half];
      const b: Pt = [o.b[0] - n[0] * half, o.b[1] - n[1] * half];
      const pa = m.pt(a);
      const pb = m.pt(b);
      if (o.kind === "door") {
        // leaf + swing arc, hinged at the a-end, swinging INWARD
        const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        if (L <= 0.5) continue;
        const ux = (pb[0] - pa[0]) / L;
        const uy = (pb[1] - pa[1]) / L;
        const ix = -n[0] * m.s.ptPerFt;
        const iy = -n[1] * m.s.ptPerFt;
        const inLen = Math.hypot(ix, iy) || 1;
        const lx = pa[0] + (ix / inLen) * L;
        const ly = pa[1] + (iy / inLen) * L;
        out.push(line(pa[0], pa[1], lx, ly, "adw-ink", 1.1));
        const sweep = ux * (iy / inLen) - uy * (ix / inLen) < 0 ? 1 : 0;
        out.push(
          path(
            `M ${fx(lx, 2)},${fx(ly, 2)} A ${fx(L, 2)},${fx(L, 2)} 0 0 ${sweep} ${fx(pb[0], 2)},${fx(pb[1], 2)}`,
            "adw-hair",
            0.6,
            DASH_FINE,
          ),
        );
      } else {
        // glass line, plus a sill line offset into the wall thickness
        out.push(line(pa[0], pa[1], pb[0], pb[1], "adw-glass", 1.6));
        const off = wallFt * 0.34 * m.s.ptPerFt;
        const sa: Pt = [o.a[0], o.a[1]];
        const sb: Pt = [o.b[0], o.b[1]];
        const psa = m.pt(sa);
        const psb = m.pt(sb);
        const dx = -n[0] * off;
        const dz = -n[1] * off;
        out.push(
          line(psa[0] + dx, psa[1] + dz, psb[0] + dx, psb[1] + dz, "adw-glass", 0.7, ' opacity="0.75"'),
        );
      }
    }
  }
}

/**
 * The notice a plan or elevation sheet carries when the model is empty.
 *
 * A blank sheet with a title block on it looks like a drawing that failed to
 * print. A blank sheet that says why is a drawing.
 */
function emptyNotice(out: string[], notes: string[], what: string): void {
  const cx = (CONTENT.x0 + CONTENT.x1) / 2;
  const cy = (CONTENT.y0 + CONTENT.y1) / 2;
  out.push(rect(CONTENT.x0 + 60, cy - 44, CONTENT_W - 120, 88, "adw-hair", 0.8, DASH_HIDDEN));
  out.push(
    text(cx, cy - 10, "adw-t-accent", "13px", "NOTHING TO DRAW", ` text-anchor="middle" letter-spacing="2"`),
  );
  out.push(
    text(cx, cy + 12, "adw-t-dim", "8px", `This model has no volumes, so there is no ${what} on it.`, ` text-anchor="middle"`),
  );
  notes.push(
    `This model has no volumes, so this sheet has no ${what} on it. It is issued saying so rather ` +
      `than issued blank — a blank sheet in a set reads as a drawing that failed to print.`,
  );
}

const centroid = (pts: readonly (readonly [number, number])[]): readonly [number, number] => {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return [x / pts.length, y / pts.length];
};

/* =====================================================================
   A0 — COVER
   ===================================================================== */

function coverSheet(ctx: Ctx, index: { number: string; title: string; scale: string }[]): DrawingSheet {
  const { model, spec, input } = ctx;
  const out: string[] = [];
  const notes: string[] = [...PROFESSIONAL_NOTE];

  const x = FULL.x0;
  let y = FULL.y0 + 30;

  out.push(text(x, y, "adw-t-ink", "30px", ctx.projectName.toUpperCase(), ` letter-spacing="3"`));
  y += 20;
  out.push(
    text(
      x,
      y,
      "adw-t-accent",
      "10px",
      "REVIEW SET — DRAWINGS FOR A LICENSED PROFESSIONAL TO COMPLETE, CORRECT AND SEAL",
      ` letter-spacing="1.6"`,
    ),
  );
  y += 8;
  out.push(line(x, y, FULL.x1, y, "adw-ink", 1.2));
  y += 26;

  // ---- left column: the project data block
  const colW = 300;
  const rows: [string, string][] = [
    ["ADDRESS", input.address?.trim() || "Not supplied"],
    ["LEGAL DESCRIPTION", input.legalDescription?.trim() || "Not supplied"],
    ["FLOOR AREA", sqFt(model.totalFloorAreaSqFt)],
    ["GROUND FOOTPRINT", sqFt(model.groundFootprintSqFt)],
    [
      "STOREYS",
      spec.volumes.length === 0
        ? "—"
        : String(Math.max(...spec.volumes.map((v) => v.storeys))) +
          (spec.volumes.some((v) => v.storeys !== spec.volumes[0].storeys) ? " (varies by volume)" : ""),
    ],
    ["VOLUMES", `${spec.volumes.length} — ${spec.volumes.map((v) => v.name).join(", ") || "none"}`],
    [
      "STRUCTURE",
      `${MATERIAL_LABEL(spec.material)} · ${WALL_THICKNESS_MM[spec.material]} mm wall (${fmtFt(
        model.wallThicknessFt,
      )})`,
    ],
    ["WALL R-VALUE", `R-${fmtG(WALL_R_VALUE[spec.material])} effective (lib/design/materials.ts)`],
    ["FOUNDATION", "Protected galvanized screw piles — NO CONCRETE"],
    ["CLIMATE ZONE", `NBC ${spec.climateZone}`],
    ["MAX RIDGE", `${fmtFt(model.maxRidgeHeightFt)} above finished floor · ${fmtFt(model.maxRidgeHeightFt - GRADE_Y_FT)} above grade`],
    ["GLAZED AREA", `${sqFt(model.glazedAreaSqFt)} of glass`],
    [
      "FDWR (THIS MODEL)",
      `${(modelFdwr(model) * 100).toFixed(1)}% — prescriptive max ${(FDWR_MAX * 100).toFixed(0)}%${
        modelFdwr(model) > FDWR_MAX ? "  ·  OVER — see A7" : ""
      }`,
    ],
    ["FRONT FACES", `${deg(spec.siting.frontFacesDeg)} from north (${nearestFacing(spec.siting.frontFacesDeg).toUpperCase()})`],
    ["SITE SLOPE", spec.siting.slope.toUpperCase()],
  ];

  out.push(text(x, y, "adw-t-ink", "10px", "PROJECT DATA", ` letter-spacing="1.6"`));
  y += 6;
  out.push(line(x, y, x + colW + 220, y, "adw-hair", 0.6));
  y += 14;
  for (const [k, v] of rows) {
    out.push(text(x, y, "adw-t-dim", "7.5px", k, ` letter-spacing="0.8"`));
    const lines = wrap(v, charsIn(220, 8));
    lines.slice(0, 2).forEach((s, i) => out.push(text(x + colW - 160, y + i * 9.5, "adw-t-ink", "8px", s)));
    y += Math.max(1, Math.min(2, lines.length)) * 9.5 + 4.5;
  }

  // ---- middle column: the sheet index
  const ix = x + colW + 260;
  let iy = FULL.y0 + 84;
  out.push(text(ix, iy, "adw-t-ink", "10px", "SHEET INDEX", ` letter-spacing="1.6"`));
  iy += 6;
  out.push(line(ix, iy, ix + 300, iy, "adw-hair", 0.6));
  iy += 16;
  for (const s of index) {
    out.push(text(ix, iy, "adw-t-ink", "9px", s.number, ` letter-spacing="1"`));
    out.push(text(ix + 34, iy, "adw-t-ink", "8px", s.title));
    out.push(text(ix + 300, iy, "adw-t-dim", "7px", s.scale, ` text-anchor="end"`));
    out.push(line(ix, iy + 4.5, ix + 300, iy + 4.5, "adw-hair", 0.35));
    iy += 16;
  }

  // ---- the honesty block, given the space it deserves
  iy += 18;
  out.push(text(ix, iy, "adw-t-accent", "10px", "WHAT THIS SET IS", ` letter-spacing="1.6"`));
  iy += 6;
  out.push(line(ix, iy, ix + 300, iy, "adw-accent", 0.6));
  iy += 13;
  for (const note of PROFESSIONAL_NOTE) {
    for (const s of wrap(note, charsIn(300, 7))) {
      if (iy > FULL.y1 - 8) break;
      out.push(text(ix, iy, "adw-t-dim", "7px", s));
      iy += 8.6;
    }
    iy += 5;
  }

  // ---- a plain massing key rather than a fake 3D thumbnail: the footprint,
  //      to a real scale, which is worth more than a picture of a box.
  if (model.volumes.length > 0) {
    const keyX = FULL.x1 - 250;
    const keyY = FULL.y0 + 84;
    const box = model.boundsWithRoof;
    const s = archScale(box.maxX - box.minX, box.maxZ - box.minZ, 230, 210);
    const m = planMap(box, s, keyX + (230 - (box.maxX - box.minX) * s.ptPerFt) / 2, keyY + 20);
    out.push(text(keyX, keyY, "adw-t-ink", "10px", "KEY PLAN", ` letter-spacing="1.6"`));
    // the scale sits under the title, not out at the right edge where the
    // north arrow is
    out.push(text(keyX, keyY + 12, "adw-t-dim", "7px", s.label));
    for (const vm of model.volumes) {
      out.push(poly(vm.roofPlan.map(m.pt), "adw-hair", 0.6, DASH_HIDDEN));
      out.push(poly(vm.outer.map(m.pt), "adw-ink", 1.1));
      const c = centroid(vm.outer.map(m.pt));
      out.push(text(c[0], c[1], "adw-t-dim", "6.5px", vm.volume.name.toUpperCase(), ` text-anchor="middle"`));
    }
    if (model.deck) out.push(poly(model.deck.corners.map(m.pt), "adw-hair", 0.7, DASH_FINE));
    northArrow(out, keyX + 232, keyY + 24, 12);
  }

  notes.push(...SET_NOTES);
  /* Graph-set limitations live on the model.warnings list the caller prints
     beside the set. They are also the first notes on A0 so a reviewer who
     only opens the cover still sees that this is not a recovery-spec drawing. */
  if (model.warnings.some((note) => note.includes("planar building graph"))) {
    notes.unshift(...model.warnings);
  }

  return {
    number: "A0",
    title: "COVER + PROJECT DATA",
    scale: "NOT TO SCALE",
    notes,
    svg: sheet({
      number: "A0",
      title: "COVER",
      scaleLabel: "NOT TO SCALE",
      projectName: ctx.projectName,
      dateISO: input.dateISO,
      drawnBy: input.drawnBy ?? "AURA",
      revision: input.revision ?? "0",
      meta: ctx.meta,
      body: out.join(""),
      notes: [],
      description: `Cover sheet and project data for ${ctx.projectName}, ${sqFt(model.totalFloorAreaSqFt)}.`,
    }),
  };
}

/* =====================================================================
   A1 — SITE PLAN
   ===================================================================== */

function siteSheet(ctx: Ctx): DrawingSheet {
  const { model, spec, parcel } = ctx;
  const out: string[] = [];
  const notes: string[] = [];
  let scaleLabel = "NOT TO SCALE";

  if (!parcel) {
    /* No lot facts. The one thing that must NOT happen here is a drawn
       rectangle with invented setbacks, because a site plan is the sheet a
       reviewer takes most literally. */
    notes.push(
      "SITE INFORMATION NOT PROVIDED. No lot dimensions, no setbacks and no survey were supplied " +
        "with this model, so no parcel is drawn on this sheet. Nothing has been assumed: a site " +
        "plan with invented lot lines is worse than no site plan.",
      "To complete this sheet, supply the lot width and depth, the front, side and rear setbacks " +
        "off your district's land use bylaw, and the driveway access point. A real site plan also " +
        "needs a survey (RPR or a surveyor's site plan), the well and septic locations with their " +
        "separation distances, easements, and the grade at the building corners.",
      "Setbacks are set by the land use bylaw DISTRICT your parcel sits in, and they vary. Aura " +
        "has not read your district's table and prints no number it has not read.",
    );

    const cx = (CONTENT.x0 + CONTENT.x1) / 2;
    const noticeTop = CONTENT.y0 + 8;
    out.push(rect(CONTENT.x0 + 30, noticeTop, CONTENT_W - 60, 74, "adw-hair", 0.8, DASH_HIDDEN));
    out.push(
      text(cx, noticeTop + 26, "adw-t-accent", "13px", "SITE INFORMATION NOT PROVIDED", ` text-anchor="middle" letter-spacing="2"`),
    );
    wrap(
      "This sheet is issued deliberately blank. The home below is drawn to scale so it can be " +
        "traced onto a real survey, but no lot line, no setback and no north-to-the-street " +
        "relationship has been assumed.",
      charsIn(CONTENT_W - 140, 8),
    ).forEach((s, i) => out.push(text(cx, noticeTop + 44 + i * 11, "adw-t-dim", "8px", s, ` text-anchor="middle"`)));

    // the home alone, to scale, north up — traceable onto a real survey
    if (model.volumes.length > 0) {
      const drawTop = noticeTop + 96;
      const box = model.boundsWithRoof;
      const wFt = box.maxX - box.minX;
      const dFt = box.maxZ - box.minZ;
      const availH = CONTENT.y1 - drawTop - 46;
      const s = archScale(wFt, dFt, CONTENT_W - 160, availH);
      scaleLabel = s.label;
      const m = planMap(
        box,
        s,
        cx - (wFt * s.ptPerFt) / 2,
        drawTop + Math.max(0, (availH - dFt * s.ptPerFt) / 2),
      );
      for (const vm of model.volumes) {
        out.push(poly(vm.roofPlan.map(m.pt), "adw-hair", 0.6, DASH_HIDDEN));
        out.push(poly(vm.outer.map(m.pt), "adw-ink", 1.2));
        const c = centroid(vm.outer.map(m.pt));
        out.push(
          text(c[0], c[1], "adw-t-dim", "6.5px", vm.volume.name.toUpperCase(), ` text-anchor="middle"`),
        );
      }
      if (model.deck) out.push(poly(model.deck.corners.map(m.pt), "adw-hair", 0.8, DASH_FINE));
      // the roof extent is the line a setback is measured to when a bylaw
      // limits projections; the deck is called out separately or not at all
      const bBox = boxOf(model.volumes.map((vm) => vm.roofPlan));
      dim(out, m.px(bBox.minX), m.py(bBox.minZ), m.px(bBox.maxX), m.py(bBox.minZ), `${fmtFt(bBox.maxX - bBox.minX)} INCL. OVERHANGS`, -1, 20);
      dim(out, m.px(bBox.maxX), m.py(bBox.minZ), m.px(bBox.maxX), m.py(bBox.maxZ), `${fmtFt(bBox.maxZ - bBox.minZ)} INCL. OVERHANGS`, -1, 20);
      if (model.deck) {
        dim(out, m.px(box.maxX), m.py(box.minZ), m.px(box.maxX), m.py(box.maxZ), `${fmtFt(dFt)} INCL. DECK`, -1, 46);
      }
      northArrow(out, CONTENT.x1 - 40, drawTop + 20, 14);
      scaleBar(out, CONTENT.x0 + 10, CONTENT.y1 - 12, s);
    }
  } else {
    // ---- a real parcel
    const facts: ParcelFacts = {
      lotWidthFt: parcel.lotWidthFt,
      lotDepthFt: parcel.lotDepthFt,
      frontSetbackFt: parcel.frontSetbackFt,
      sideSetbackFt: parcel.sideSetbackFt,
      rearSetbackFt: parcel.rearSetbackFt,
      frontFaces: nearestFacing(spec.siting.frontFacesDeg),
      slope: spec.siting.slope,
    };
    const env = buildableEnvelope(facts);

    const s = siteScale(parcel.lotWidthFt, parcel.lotDepthFt, CONTENT_W - 90, CONTENT_H - 90);
    scaleLabel = s.label;

    /* THE LOT'S OWN FRAME, and the one place this sheet is explicit about a
       simplification: the lot is drawn with its FRONT LINE AT THE BOTTOM of
       the page, which is the way a site plan is normally composed, and the
       north arrow is then rotated to match the bearing the owner gave. The
       home is drawn square to the lot lines. A rotated home is legal and often
       better for solar, and it is NOT modelled here. */
    const originX = CONTENT.x0 + (CONTENT_W - parcel.lotWidthFt * s.ptPerFt) / 2;
    const originY = CONTENT.y0 + 34;
    const lw = parcel.lotWidthFt * s.ptPerFt;
    const ld = parcel.lotDepthFt * s.ptPerFt;
    const lx = (ftAcross: number) => originX + ftAcross * s.ptPerFt;
    const ly = (ftFromRear: number) => originY + ftFromRear * s.ptPerFt;

    // lot lines
    out.push(rect(originX, originY, lw, ld, "adw-ink", 1.4));
    out.push(
      text(originX + lw / 2, originY + ld + 30, "adw-t-ink", "8px", "FRONT (STREET / ACCESS) LOT LINE", ` text-anchor="middle" letter-spacing="1"`),
    );

    // setback lines → the buildable envelope
    if (env.usable) {
      const bx = lx(parcel.sideSetbackFt);
      const by = ly(parcel.rearSetbackFt);
      const bw = env.widthFt * s.ptPerFt;
      const bd = env.depthFt * s.ptPerFt;
      out.push(rect(bx, by, bw, bd, "adw-accent", 0.9, DASH_HIDDEN));
      out.push(
        text(bx + 4, by + 11, "adw-t-accent", "7px", `BUILDABLE ENVELOPE  ${fmtFt(env.widthFt)} × ${fmtFt(env.depthFt)}  (${sqFt(env.areaSqFt)})`),
      );

      // setback dimensions
      dim(out, originX, originY + ld, lx(parcel.sideSetbackFt), originY + ld, fmtFt(parcel.sideSetbackFt), 1, 14);
      dim(out, originX, ly(parcel.rearSetbackFt), originX, originY, fmtFt(parcel.rearSetbackFt), -1, 16);
      dim(out, originX, originY + ld, originX, ly(parcel.lotDepthFt - parcel.frontSetbackFt), fmtFt(parcel.frontSetbackFt), -1, 40);

      /* ---- the home inside the envelope.
         THE ONE ROTATION ON THIS SHEET, and it has to be here. Every other
         plan in this set is drawn NORTH UP; a site plan is drawn with the
         FRONT LOT LINE AT THE BOTTOM, which is how one is read. Those two
         frames are the same thing only when the front faces due south. So the
         home's world geometry is turned by (180° − front bearing) before it is
         placed, and the north arrow is turned by the same angle — which is why
         a lot facing east comes out with north pointing across the page and
         the house sitting square to the lot lines rather than square to the
         compass. Drawing the lot one way and the house the other would put the
         home on the paper at up to ninety degrees to where it really sits. */
      if (model.volumes.length > 0) {
        const theta = ((180 - spec.siting.frontFacesDeg) * Math.PI) / 180;
        const ct = Math.cos(theta);
        const st = Math.sin(theta);
        const rot = (p: Pt): Pt => [p[0] * ct - p[1] * st, p[0] * st + p[1] * ct];

        const rotRoof = model.volumes.map((vm) => vm.roofPlan.map(rot));
        const rotOuter = model.volumes.map((vm) => vm.outer.map(rot));
        const rotDeck = model.deck ? model.deck.corners.map(rot) : null;
        const rbox = boxOf([...rotRoof, ...(rotDeck ? [rotDeck] : [])]);
        const homeW = rbox.maxX - rbox.minX;
        const homeD = rbox.maxZ - rbox.minZ;

        const fromLeft = parcel.homeFromLeftFt ?? (parcel.lotWidthFt - homeW) / 2;
        const fromFront = parcel.homeFromFrontFt ?? parcel.frontSetbackFt;
        const hx = lx(fromLeft);
        const hy = ly(parcel.lotDepthFt - fromFront - homeD);
        const P = (p: Pt): readonly [number, number] => [
          hx + (p[0] - rbox.minX) * s.ptPerFt,
          hy + (p[1] - rbox.minZ) * s.ptPerFt,
        ];

        rotOuter.forEach((outer, i) => {
          out.push(poly(rotRoof[i].map(P), "adw-hair", 0.6, DASH_HIDDEN));
          out.push(poly(outer.map(P), "adw-poche", 0, ' opacity="0.14" stroke="none"'));
          out.push(poly(outer.map(P), "adw-ink", 1.2));
        });
        if (rotDeck) out.push(poly(rotDeck.map(P), "adw-hair", 0.8, DASH_FINE));
        out.push(
          text(hx + (homeW * s.ptPerFt) / 2, hy + (homeD * s.ptPerFt) / 2, "adw-t-ink", "7.5px", "HOME", ` text-anchor="middle" letter-spacing="1"`),
        );
        const fits = homeW <= env.widthFt + 1e-6 && homeD <= env.depthFt + 1e-6;
        notes.push(
          fits
            ? `The ${fmtFt(homeW)} × ${fmtFt(homeD)} roof footprint fits the ${fmtFt(env.widthFt)} × ` +
              `${fmtFt(env.depthFt)} buildable envelope with ${fmtFt(env.widthFt - homeW)} across the ` +
              `frontage and ${fmtFt(env.depthFt - homeD)} front to back left over. That leftover is ` +
              `where the driveway, the deck, the array, the cistern and the septic field have to ` +
              `live — this sheet places the HOME only.`
            : `THE HOME DOES NOT FIT THE BUILDABLE ENVELOPE as drawn: it needs ${fmtFt(homeW)} × ` +
              `${fmtFt(homeD)} and there is ${fmtFt(env.widthFt)} × ${fmtFt(env.depthFt)}. It is drawn ` +
              `where it was placed, over the setback line, so the conflict is visible rather than ` +
              `hidden by a nudge. Resolve it in the model or with a variance.`,
        );
        // overall home dims
        dim(out, hx, hy, hx + homeW * s.ptPerFt, hy, fmtFt(homeW), -1, 18);
      }
    } else {
      notes.push(
        `The setbacks entered use up the whole lot: a ${fmtFt(parcel.lotWidthFt)} × ` +
          `${fmtFt(parcel.lotDepthFt)} parcel with ${fmtFt(parcel.frontSetbackFt)} front, ` +
          `${fmtFt(parcel.sideSetbackFt)} side and ${fmtFt(parcel.rearSetbackFt)} rear setbacks leaves ` +
          `no buildable rectangle. No envelope is drawn because there is none.`,
      );
    }

    // north arrow, rotated to the bearing the owner gave for the front line
    const front = spec.siting.frontFacesDeg;
    const nax = CONTENT.x1 - 46;
    const nay = CONTENT.y0 + 46;
    out.push(
      `<g transform="rotate(${fx(180 - front, 2)},${fx(nax, 2)},${fx(nay, 2)})">` +
        (() => {
          const g: string[] = [];
          northArrow(g, nax, nay, 16);
          return g.join("");
        })() +
        `</g>`,
    );
    out.push(
      text(nax, nay + 34, "adw-t-dim", "6.5px", `FRONT FACES ${deg(front)}`, ` text-anchor="middle"`),
    );

    scaleBar(out, CONTENT.x0 + 10, CONTENT.y1 - 12, s);

    out.push(
      text(CONTENT.x0, CONTENT.y0 + 12, "adw-t-ink", "9px", `SITE PLAN  ·  LOT ${fmtFt(parcel.lotWidthFt)} × ${fmtFt(parcel.lotDepthFt)}  ·  ${sqFt(parcel.lotWidthFt * parcel.lotDepthFt)}`, ` letter-spacing="1"`),
    );

    const coverage =
      parcel.lotWidthFt * parcel.lotDepthFt > 0
        ? (model.groundFootprintSqFt / (parcel.lotWidthFt * parcel.lotDepthFt)) * 100
        : 0;
    notes.push(
      parcel.accessNote?.trim()
        ? `DRIVEWAY AND ACCESS: ${parcel.accessNote.trim()} — as described by the owner, not surveyed.`
        : "DRIVEWAY AND ACCESS: not supplied. A site plan needs the access point, the driveway " +
          "width and its grade, and in most districts the approach has to be approved separately.",
      parcel.wellAndSeptic
        ? "WELL AND SEPTIC SEPARATION: this parcel is on a private well and a septic field. " +
          "Alberta's Private Sewage Disposal Systems Standard of Practice sets minimum separation " +
          "distances between the sewage system, the well, the property lines, any water body and " +
          "the building. Those distances govern where the home can sit and they are NOT drawn " +
          "here — a certified private sewage installer sets them out on the real survey."
        : "WELL AND SEPTIC: not stated. If this parcel is served by a private well and a septic " +
          "system, the separation distances in Alberta's Private Sewage Disposal Systems Standard " +
          "of Practice govern where the home may sit, and they are not drawn here.",
      `Site coverage is ${coverage.toFixed(1)}% of the lot — derived, and judged against nothing. ` +
        `Aura has not read your district's land use bylaw and prints no maximum. Most bylaws count ` +
        `accessory buildings and many count decks and covered areas, so the deck and the hot tub ` +
        `are likely part of your real figure.`,
      `This sheet is composed with the FRONT LOT LINE AT THE BOTTOM, so the north arrow is turned ` +
        `to the ${deg(spec.siting.frontFacesDeg)} bearing you gave rather than pointing up the page. ` +
        `Every other plan in this set (A2, A3, A4) is drawn NORTH UP — check the arrow on each sheet ` +
        `before scaling anything off it against this one.`,
      "The home is drawn SQUARE TO THE LOT LINES. A rotated home is legal and often better for " +
        "solar, and it uses more of the buildable envelope — that case is not modelled here.",
      "Easements, environmental reserve, riparian and daylighting setbacks, right-of-way " +
        "widenings, corner-lot flanking rules and utility rights-of-way are not modelled at all. " +
        "Any one of them can cut the envelope below what is shown.",
      "Grades, drainage and the finished floor elevation relative to the street are not shown. " +
        "The lot slope is recorded as " + spec.siting.slope.toUpperCase() + " and it drives the " +
        "pile schedule on A2, not this sheet.",
    );
  }

  return {
    number: "A1",
    title: "SITE PLAN",
    scale: scaleLabel,
    notes,
    svg: sheet({
      number: "A1",
      title: "SITE PLAN",
      scaleLabel,
      projectName: ctx.projectName,
      dateISO: ctx.input.dateISO,
      drawnBy: ctx.input.drawnBy ?? "AURA",
      revision: ctx.input.revision ?? "0",
      meta: ctx.meta,
      body: out.join(""),
      notes,
      description: parcel
        ? `Site plan showing the parcel, its setbacks and the home placed inside them.`
        : `Site plan issued without parcel information, stated on the sheet.`,
    }),
  };
}

/* =====================================================================
   A2 — FOUNDATION / SCREW-PILE PLAN
   ===================================================================== */

function foundationSheet(ctx: Ctx): DrawingSheet {
  const { model, spec } = ctx;
  const out: string[] = [];
  const notes: string[] = [];

  const box = model.bounds;
  // raw extents into the scale picker, so an empty model gets "NOTHING TO
  // DRAW" rather than a scale printed over a blank sheet
  const s = archScale(box.maxX - box.minX, box.maxZ - box.minZ, CONTENT_W - DIM_RESERVE_W, CONTENT_H - DIM_RESERVE_H);
  const wFt = Math.max(1, box.maxX - box.minX);
  const dFt = Math.max(1, box.maxZ - box.minZ);
  const m = planMap(
    box,
    s,
    CONTENT.x0 + (CONTENT_W - wFt * s.ptPerFt) / 2,
    CONTENT.y0 + 46 + Math.max(0, (CONTENT_H - 100 - dFt * s.ptPerFt) / 2),
  );

  out.push(
    text(CONTENT.x0, CONTENT.y0 + 14, "adw-t-ink", "10px", "SCREW-PILE FOUNDATION PLAN", ` letter-spacing="1.6"`),
  );
  out.push(
    text(CONTENT.x0, CONTENT.y0 + 27, "adw-t-accent", "7.5px", "INDICATIVE LAYOUT — PENDING A P.ENG PILE DESIGN. NO CONCRETE.", ` letter-spacing="0.8"`),
  );

  if (model.volumes.length === 0) emptyNotice(out, notes, "foundation");

  for (const vm of model.volumes) {
    const v = vm.volume;
    // the footprint above, dashed, so the piles read against the building
    out.push(poly(vm.outer.map(m.pt), "adw-hair", 0.8, DASH_HIDDEN));

    // gridlines
    for (const gx of vm.piles.xs) {
      const a = m.pt(toWorldLocal(v, gx, -v.depthFt / 2 - 2));
      const b = m.pt(toWorldLocal(v, gx, v.depthFt / 2 + 2));
      out.push(line(a[0], a[1], b[0], b[1], "adw-hair", 0.4, DASH_CENTRE));
    }
    for (const gz of vm.piles.zs) {
      const a = m.pt(toWorldLocal(v, -v.widthFt / 2 - 2, gz));
      const b = m.pt(toWorldLocal(v, v.widthFt / 2 + 2, gz));
      out.push(line(a[0], a[1], b[0], b[1], "adw-hair", 0.4, DASH_CENTRE));
    }

    // beam lines: along the SHORTER span, which is where a beam would run
    const beamAlongX = v.widthFt <= v.depthFt;
    const along = beamAlongX ? vm.piles.zs : vm.piles.xs;
    for (const g of along) {
      const a = beamAlongX
        ? m.pt(toWorldLocal(v, -v.widthFt / 2, g))
        : m.pt(toWorldLocal(v, g, -v.depthFt / 2));
      const b = beamAlongX
        ? m.pt(toWorldLocal(v, v.widthFt / 2, g))
        : m.pt(toWorldLocal(v, g, v.depthFt / 2));
      out.push(line(a[0], a[1], b[0], b[1], "adw-ink", 2.2, ' opacity="0.55"'));
    }

    // the piles themselves
    const r = Math.max(2.2, 0.6 * s.ptPerFt);
    for (const p of vm.piles.points) {
      const q = m.pt(p);
      out.push(circle(q[0], q[1], r, "adw-poche", 0, ' stroke="none"'));
      out.push(circle(q[0], q[1], r + 1.6, "adw-ink", 0.6));
    }

    // spacing dimensions on the first bay each way
    if (vm.piles.xs.length >= 2) {
      const a = m.pt(toWorldLocal(v, vm.piles.xs[0], -v.depthFt / 2));
      const b = m.pt(toWorldLocal(v, vm.piles.xs[1], -v.depthFt / 2));
      dim(out, a[0], a[1], b[0], b[1], fmtFt(vm.piles.spacingXFt), -1, 20);
    }
    if (vm.piles.zs.length >= 2) {
      const a = m.pt(toWorldLocal(v, v.widthFt / 2, vm.piles.zs[0]));
      const b = m.pt(toWorldLocal(v, v.widthFt / 2, vm.piles.zs[1]));
      dim(out, a[0], a[1], b[0], b[1], fmtFt(vm.piles.spacingZFt), -1, 20);
    }

    const c = centroid(vm.outer.map(m.pt));
    out.push(
      text(c[0], c[1] - 4, "adw-t-ink", "8px", v.name.toUpperCase(), ` text-anchor="middle" letter-spacing="1"`),
    );
    out.push(
      text(
        c[0],
        c[1] + 8,
        "adw-t-dim",
        "6.5px",
        `${vm.piles.count} PILES · ${vm.piles.xs.length - 1} × ${vm.piles.zs.length - 1} BAYS · ${fmtFt(vm.piles.spacingXFt)} × ${fmtFt(vm.piles.spacingZFt)}`,
        ` text-anchor="middle"`,
      ),
    );
  }

  if (model.deck) {
    out.push(poly(model.deck.corners.map(m.pt), "adw-hair", 0.7, DASH_FINE));
    const c = centroid(model.deck.corners.map(m.pt));
    out.push(text(c[0], c[1], "adw-t-dim", "6.5px", "DECK — PILES BY SAME DESIGN", ` text-anchor="middle"`));
  }

  northArrow(out, CONTENT.x1 - 34, CONTENT.y0 + 46, 14);
  scaleBar(out, CONTENT.x0 + 10, CONTENT.y1 - 12, s);

  const piles = totalPiles(model);
  const bomRate = Math.max(9, Math.ceil(model.groundFootprintSqFt / 64));

  notes.push(
    `THIS LAYOUT IS INDICATIVE. ${piles} piles are shown, set out on a grid at not more than ` +
      `${PILE_GRID_FT}'-0" centres derived from the footprint — ` +
      model.volumes
        .map((v) => `${v.volume.name} at ${fmtFt(v.piles.spacingXFt)} × ${fmtFt(v.piles.spacingZFt)}`)
        .join("; ") +
      `. A pile DESIGN is a different document: pile diameter, helix size, embedment depth, ` +
      `capacity and the beam sizes all come from a P.Eng working off a real soil investigation, ` +
      `confirmed by torque readings on the day of installation.`,
    `The bill of materials prices piles at an area rate of one per 64 sq ft and reports ${bomRate} ` +
      `for this footprint; this plan lays out ${piles} on a real grid including the perimeter. The ` +
      `two numbers are counted differently and neither is a design. Reconcile them against the ` +
      `stamped pile schedule before ordering.`,
    "NO CONCRETE. The foundation is protected galvanized helical (screw) piles — AC228-compliant, " +
      "cement-free, minimal-disturbance and reversible. Grouted pile variants are excluded because " +
      "they reintroduce cementitious material into the ground. This is not 'zero carbon': the " +
      "galvanized steel carries embodied carbon and this set says so.",
    `Piles stand ${fmtFt(-GRADE_Y_FT - FLOOR_SLAB_FT)} proud of grade to the underside of the floor ` +
      `structure, and the floor structure is ${fmtFt(FLOOR_SLAB_FT)} deep, putting finished floor ` +
      `at ${fmtFt(-GRADE_Y_FT)} above grade. The crawl space has to be closed, insulated, vented to ` +
      `the design and protected from rodents; that skirt detail is not drawn here.`,
    spec.siting.slope === "flat"
      ? "The site is recorded as FLAT, which is the case the pile schedule assumes: uniform " +
        "embedment, one repeated detail. What flat ground does not tell you is what the soil is " +
        "and where the water goes."
      : spec.siting.slope === "gentle"
        ? "The site is recorded as GENTLE. Pile heights step to hold one level floor, so expect " +
          "longer piles on the low side, a taller skirt, and a longer set. Still a catalog detail, " +
          "and budget the uphill drainage."
        : "The site is recorded as STEEP. On a steep site the pile foundation stops being a " +
          "repeated catalog detail: long exposed piles carry lateral load, embedment differs pile " +
          "to pile, and this needs a stamped foundation design and bracing before anything is " +
          "ordered. The grid below is a starting point, not a schedule.",
    "Frost depth governs minimum embedment and it is set locally. Confirm it with the authority " +
      "having jurisdiction for this site.",
    "Beam lines are shown for coordination only. Beam material, size, span and connection to the " +
      "pile caps are the engineer's, and no size is stated here because none has been calculated.",
  );

  return {
    number: "A2",
    title: "FOUNDATION PLAN",
    scale: s.label,
    notes,
    svg: sheet({
      number: "A2",
      title: "FOUNDATION",
      scaleLabel: s.label,
      projectName: ctx.projectName,
      dateISO: ctx.input.dateISO,
      drawnBy: ctx.input.drawnBy ?? "AURA",
      revision: ctx.input.revision ?? "0",
      meta: ctx.meta,
      body: out.join(""),
      notes,
      description: `Indicative screw-pile layout, ${piles} piles at not more than ${PILE_GRID_FT} foot centres.`,
    }),
  };
}

/** A local (x, z) in a volume's frame, taken to world. Thin wrapper so the
 *  foundation sheet reads as gridlines rather than as trigonometry. */
function toWorldLocal(v: Volume, lx: number, lz: number): Pt {
  const yaw = (-v.rotationDeg * Math.PI) / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [v.x + lx * c + lz * s, v.z - lx * s + lz * c];
}

/* =====================================================================
   A3 — FLOOR PLAN
   ===================================================================== */

function floorSheet(ctx: Ctx, section: BuildingSection | null): DrawingSheet {
  const { model, input } = ctx;
  const out: string[] = [];
  const notes: string[] = [];

  const box = model.bounds;
  // room for dimension strings on all four sides; raw extents into the picker
  const s = archScale(box.maxX - box.minX, box.maxZ - box.minZ, CONTENT_W - DIM_RESERVE_W, CONTENT_H - DIM_RESERVE_H);
  const wFt = Math.max(1, box.maxX - box.minX);
  const dFt = Math.max(1, box.maxZ - box.minZ);
  const m = planMap(
    box,
    s,
    CONTENT.x0 + (CONTENT_W - wFt * s.ptPerFt) / 2,
    CONTENT.y0 + 52 + Math.max(0, (CONTENT_H - 110 - dFt * s.ptPerFt) / 2),
  );

  out.push(text(CONTENT.x0, CONTENT.y0 + 14, "adw-t-ink", "10px", "FLOOR PLAN", ` letter-spacing="1.6"`));

  if (model.volumes.length === 0) emptyNotice(out, notes, "plan");

  // ---- the interior room program, when one was supplied AND it matches
  const roomsDrawn = drawRooms(out, ctx, m, input.rooms ?? null, notes);

  // ---- the walls, poché, with the openings cut and drawn
  for (const vm of model.volumes) {
    drawVolumePlan(out, vm, m, model.wallThicknessFt);
  }

  // ---- the deck, dashed, because it is outside the thermal envelope
  if (model.deck) {
    out.push(poly(model.deck.corners.map(m.pt), "adw-hair", 0.9, DASH_FINE));
    const c = centroid(model.deck.corners.map(m.pt));
    out.push(
      text(c[0], c[1] - 4, "adw-t-dim", "7px", `DECK  ${fmtFt(model.deck.deck.widthFt)} × ${fmtFt(model.deck.deck.depthFt)}`, ` text-anchor="middle"`),
    );
    if (model.deck.tub) {
      const q = m.pt(model.deck.tub);
      out.push(circle(q[0], q[1], HOT_TUB_RADIUS_FT * s.ptPerFt, "adw-hair", 0.8, DASH_FINE));
      out.push(text(q[0], q[1] + 3, "adw-t-dim", "6px", "HOT TUB", ` text-anchor="middle"`));
    }
  }

  /* ---- volume labels. Lifted above the centroid on purpose: the section cut
     line runs through the centre of the primary volume, and a label sitting on
     it is the one collision a floor plan cannot have. */
  if (!roomsDrawn) {
    for (const vm of model.volumes) {
      const c = centroid(vm.outer.map(m.pt));
      out.push(
        text(c[0], c[1] - 26, "adw-t-ink", "9px", vm.volume.name.toUpperCase(), ` text-anchor="middle" letter-spacing="0.8"`),
      );
      out.push(
        text(
          c[0],
          c[1] - 14,
          "adw-t-dim",
          "6.5px",
          `${sqFt(vm.footprintSqFt)}  ·  ${fmtFt(vm.volume.widthFt)} × ${fmtFt(vm.volume.depthFt)}${vm.volume.storeys === 2 ? "  ·  2 STOREYS" : ""}`,
          ` text-anchor="middle"`,
        ),
      );
    }
  }

  /* ---- dimensions. The OVERALL string measures the BUILDING, not the
     building-plus-deck extent the sheet happens to be framed on: a deck is an
     attachment and lettering it into the overall size of the home is how a
     dimension string quietly becomes wrong. */
  const bBox = boxOf(model.volumes.map((v) => v.outer));
  const bw = Math.max(0, bBox.maxX - bBox.minX);
  const bd = Math.max(0, bBox.maxZ - bBox.minZ);
  const px0 = m.px(bBox.minX);
  const px1 = m.px(bBox.maxX);
  const py0 = m.py(bBox.minZ);
  const py1 = m.py(bBox.maxZ);
  if (model.volumes.length > 0) {
    dim(out, px0, py0, px1, py0, fmtFt(bw), -1, 30);
    dim(out, px1, py0, px1, py1, fmtFt(bd), -1, 30);
  }

  for (const vm of model.volumes) {
    const v = vm.volume;
    const t = model.wallThicknessFt;
    // inside dimensions, on the two walls that carry them
    const iw = Math.max(0, v.widthFt - 2 * t);
    const id = Math.max(0, v.depthFt - 2 * t);
    /* Both CLEAR strings run INSIDE the volume — that is where a clear
       dimension belongs — and both are taken off the NORTH and WEST inner
       faces at a deeper offset than the opening strings, so the two never
       stack on the same line. The openings crowd the south and east faces on
       most homes, which is exactly why the clear dimensions leave them. */
    const nw = m.pt(toWorldLocal(v, -v.widthFt / 2 + t, -v.depthFt / 2 + t));
    const ne = m.pt(toWorldLocal(v, v.widthFt / 2 - t, -v.depthFt / 2 + t));
    const sw = m.pt(toWorldLocal(v, -v.widthFt / 2 + t, v.depthFt / 2 - t));
    dim(out, nw[0], nw[1], ne[0], ne[1], `${fmtFt(iw)} CLEAR`, 1, 34);
    dim(out, nw[0], nw[1], sw[0], sw[1], `${fmtFt(id)} CLEAR`, -1, 34);

    // opening positions along each wall — the string a framer sets out from
    for (const wall of vm.walls) {
      if (!wall.built || wall.openings.length === 0) continue;
      const runDirX = (wall.b[0] - wall.a[0]) / Math.max(1e-9, wall.runFt);
      const runDirZ = (wall.b[1] - wall.a[1]) / Math.max(1e-9, wall.runFt);
      const stops = [0];
      for (const o of wall.openings) stops.push(o.drawnOffsetFt, o.drawnOffsetFt + o.drawnWidthFt);
      stops.push(wall.runFt);
      for (let i = 0; i + 1 < stops.length; i++) {
        const run = stops[i + 1] - stops[i];
        if (run < 1.5) continue; // a jog, not a bay — dimensioning it just crowds
        const p = m.pt([wall.a[0] + runDirX * stops[i], wall.a[1] + runDirZ * stops[i]]);
        const q = m.pt([wall.a[0] + runDirX * stops[i + 1], wall.a[1] + runDirZ * stops[i + 1]]);
        dim(out, p[0], p[1], q[0], q[1], fmtFt(run), -1, 15);
      }
    }
  }

  // ---- the section cut line and its tags, so A6 is coordinated with A3
  if (section) {
    const a = m.pt(section.cutLine[0]);
    const b = m.pt(section.cutLine[1]);
    out.push(line(a[0], a[1], b[0], b[1], "adw-accent", 1.3, DASH_CENTRE));
    const dirLen = Math.hypot(section.viewDir[0], section.viewDir[1]) || 1;
    const ax = (section.viewDir[0] / dirLen) * 16 * 1;
    const az = (section.viewDir[1] / dirLen) * 16 * 1;
    for (const p of [a, b]) {
      out.push(circle(p[0], p[1], 8, "adw-accent", 1));
      out.push(text(p[0], p[1] + 3, "adw-t-accent", "8px", section.tag, ` text-anchor="middle"`));
      out.push(line(p[0], p[1], p[0] + ax, p[1] + az, "adw-accent", 1.3));
    }
    out.push(
      text((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 6, "adw-t-accent", "6.5px", `SECTION ${section.tag} — SEE A6`, ` text-anchor="middle"`),
    );
  }

  northArrow(out, CONTENT.x1 - 34, CONTENT.y0 + 46, 14);
  scaleBar(out, CONTENT.x0 + 10, CONTENT.y1 - 12, s);

  notes.push(
    "Walls are drawn POCHÉ (solid) at their real structural thickness — " +
      `${WALL_THICKNESS_MM[ctx.spec.material]} mm (${fmtFt(model.wallThicknessFt)}) for ` +
      `${MATERIAL_LABEL(ctx.spec.material)}. Dimensions are to structure, and CLEAR dimensions are ` +
      `between the inside faces.`,
    "The north and south walls run the full width; the east and west walls butt into them and are " +
      "two wall thicknesses shorter. Opening positions on the east and west walls are measured " +
      "from that shorter built length, not from the overall depth.",
    "Openings are dimensioned from the left end of each wall LOOKING AT IT FROM OUTSIDE, which is " +
      "how the model stores them and how a framer sets them out.",
    "Door swings are drawn opening INWARD as a default. Swing direction, handing, hardware and " +
      "egress compliance are the designer's and are not decided here.",
    "NOT SHOWN on this sheet, and all of it required for a permit: interior partition framing and " +
      "headers, stairs, plumbing fixtures, the kitchen, closets, smoke and CO alarms, egress " +
      "window compliance, guards and handrails, and mechanical or electrical layouts.",
  );

  return {
    number: "A3",
    title: "FLOOR PLAN",
    scale: s.label,
    notes,
    svg: sheet({
      number: "A3",
      title: "FLOOR PLAN",
      scaleLabel: s.label,
      projectName: ctx.projectName,
      dateISO: input.dateISO,
      drawnBy: input.drawnBy ?? "AURA",
      revision: input.revision ?? "0",
      meta: ctx.meta,
      body: out.join(""),
      notes,
      description: `Dimensioned floor plan, ${fmtFt(wFt)} by ${fmtFt(dFt)}, ${sqFt(model.groundFootprintSqFt)} footprint.`,
    }),
  };
}

/**
 * Draw a solved room program, but only into a volume it actually fits.
 *
 * The plan engine solves ONE rectangle from a total floor area. That rectangle
 * is not the same object as a builder footprint, and for a multi-volume home it
 * cannot be. So the rooms are placed only when the engine's envelope matches a
 * volume's footprint within half a foot, either way round; otherwise the sheet
 * carries the volume outlines and says, in the notes, why the rooms are absent.
 * Scaling somebody's kitchen to fit is not a drawing, it is a picture.
 */
function drawRooms(
  out: string[],
  ctx: Ctx,
  m: PlanMap,
  rooms: DrawingRooms | null,
  notes: string[],
): boolean {
  if (!rooms || rooms.rooms.length === 0) {
    notes.push(
      "No interior room layout is drawn. The volumes and their openings are drawn exactly as " +
        "modelled; the partition layout comes from the plan engine or from the designer, and this " +
        "sheet does not invent one.",
    );
    return false;
  }
  const tol = 0.5;
  for (const vm of ctx.model.volumes) {
    const v = vm.volume;
    const straight =
      Math.abs(rooms.envelopeWidthFt - v.widthFt) <= tol &&
      Math.abs(rooms.envelopeDepthFt - v.depthFt) <= tol;
    const swapped =
      Math.abs(rooms.envelopeWidthFt - v.depthFt) <= tol &&
      Math.abs(rooms.envelopeDepthFt - v.widthFt) <= tol;
    if (!straight && !swapped) continue;

    const partPt = Math.max(1.2, ctx.model.partitionThicknessFt * m.s.ptPerFt);
    for (const r of rooms.rooms) {
      // engine frame → volume local frame
      const corners: Pt[] = (
        [
          [r.x, r.y],
          [r.x + r.w, r.y],
          [r.x + r.w, r.y + r.h],
          [r.x, r.y + r.h],
        ] as const
      ).map(([ex, ey]) =>
        straight
          ? toWorldLocal(v, ex - v.widthFt / 2, ey - v.depthFt / 2)
          : toWorldLocal(v, ey - v.widthFt / 2, ex - v.depthFt / 2),
      );
      out.push(poly(corners.map(m.pt), "adw-hair", partPt));
      const c = centroid(corners.map(m.pt));
      out.push(
        text(c[0], c[1] - 3, "adw-t-ink", "8px", r.name.toUpperCase(), ` text-anchor="middle" letter-spacing="0.8"`),
      );
      out.push(
        text(c[0], c[1] + 8, "adw-t-dim", "6px", `${sqFt(r.w * r.h)}  ·  ${fmtFt(r.w)} × ${fmtFt(r.h)}`, ` text-anchor="middle"`),
      );
    }
    notes.push(
      `The interior room layout is the plan engine's solve for a ${fmtFt(rooms.envelopeWidthFt)} × ` +
        `${fmtFt(rooms.envelopeDepthFt)} envelope, placed into "${v.name}" because that volume's ` +
        `footprint matches it. Partitions are drawn at ${ctx.model.partitionThicknessFt.toFixed(2)} ft ` +
        `(90 mm) and they are NOT structural. Room sizes are the engine's, not a designer's.`,
    );
    return true;
  }
  notes.push(
    `A room layout was supplied for a ${fmtFt(rooms.envelopeWidthFt)} × ${fmtFt(rooms.envelopeDepthFt)} ` +
      `envelope, and no volume in this model has that footprint. It is NOT drawn: scaling a solved ` +
      `room layout to fit a different rectangle would produce rooms nobody solved and dimensions ` +
      `nobody can build to. The volumes are drawn as modelled instead.`,
  );
  return false;
}

/* =====================================================================
   A4 — ROOF PLAN
   ===================================================================== */

function roofSheet(ctx: Ctx): DrawingSheet {
  const { model, input } = ctx;
  const out: string[] = [];
  const notes: string[] = [];

  const box = model.boundsWithRoof;
  const s = archScale(box.maxX - box.minX, box.maxZ - box.minZ, CONTENT_W - DIM_RESERVE_W, CONTENT_H - DIM_RESERVE_H);
  const wFt = Math.max(1, box.maxX - box.minX);
  const dFt = Math.max(1, box.maxZ - box.minZ);
  const m = planMap(
    box,
    s,
    CONTENT.x0 + (CONTENT_W - wFt * s.ptPerFt) / 2,
    CONTENT.y0 + 50 + Math.max(0, (CONTENT_H - 108 - dFt * s.ptPerFt) / 2),
  );

  out.push(text(CONTENT.x0, CONTENT.y0 + 14, "adw-t-ink", "10px", "ROOF PLAN", ` letter-spacing="1.6"`));

  if (model.volumes.length === 0) emptyNotice(out, notes, "roof");

  let arrayDrawn = false;

  for (const vm of model.volumes) {
    const v = vm.volume;
    const roof = vm.roof;

    // wall line below, dashed — the eave overhang is the difference
    out.push(poly(vm.outer.map(m.pt), "adw-hair", 0.6, DASH_HIDDEN));
    // roof outline
    out.push(poly(vm.roofPlan.map(m.pt), "adw-ink", 1.4));

    /* ---- ridge. Lettered near ONE END of the ridge rather than at its
       midpoint, because the midpoint is exactly where the slope arrows and
       the array label also want to be. */
    if (vm.ridge) {
      const a = m.pt(vm.ridge[0]);
      const b = m.pt(vm.ridge[1]);
      out.push(line(a[0], a[1], b[0], b[1], "adw-ink", 2));
      out.push(
        text(
          a[0] + (b[0] - a[0]) * 0.16,
          a[1] + (b[1] - a[1]) * 0.16 - 5,
          "adw-t-ink",
          "6.5px",
          `RIDGE  ${fmtFt(roof.ridgeY)} A.F.F.`,
          ` text-anchor="middle"`,
        ),
      );
    }

    // slope arrows, one per plane, pointing DOWNSLOPE. Set off the centre line
    // of each plane so the pitch call-out never lands on the array label.
    roof.planes.forEach((plane, pi) => {
      const midS = plane.s0 + (plane.s1 - plane.s0) * (pi % 2 === 0 ? 0.68 : 0.32);
      const a0 = plane.a0 + (plane.a1 - plane.a0) * 0.22;
      const a1 = plane.a0 + (plane.a1 - plane.a0) * 0.78;
      const p = m.pt(localFall(v, roof.fallAxis, a0, midS));
      const q = m.pt(localFall(v, roof.fallAxis, a1, midS));
      out.push(line(p[0], p[1], q[0], q[1], "adw-ink", 0.9));
      // arrowhead at the low end
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L;
      const uy = dy / L;
      out.push(
        path(
          polyD([
            [q[0], q[1]],
            [q[0] - ux * 7 - uy * 3, q[1] - uy * 7 + ux * 3],
            [q[0] - ux * 7 + uy * 3, q[1] - uy * 7 - ux * 3],
          ]),
          "adw-poche",
          0,
          ' stroke="none"',
        ),
      );
      const mid = m.pt(localFall(v, roof.fallAxis, (a0 + a1) / 2, midS));
      const label =
        roof.form === "flat"
          ? `FALL ${deg(FLAT_ROOF_FALL_DEG)} TO DRAIN`
          : pitchLabel((roof.angleRad * 180) / Math.PI, v.roof.pitchDeg, roof.slope);
      out.push(text(mid[0], mid[1] - 5, "adw-t-ink", "7px", label, ` text-anchor="middle"`));
    });

    // overhang dimension, on one eave
    const ohEdge = roof.overhangFt;
    if (ohEdge > 0.01) {
      const pe = roof.perpExtent;
      const aWall = m.pt(localFall(v, roof.fallAxis, roof.fallExtent.max - ohEdge, pe.max * 0.55));
      const aRoof = m.pt(localFall(v, roof.fallAxis, roof.fallExtent.max, pe.max * 0.55));
      dim(out, aWall[0], aWall[1], aRoof[0], aRoof[1], `${fmtFt(ohEdge)} OVERHANG`, -1, 16);
    }

    // ---- the array, only when a size was supplied
    if (!arrayDrawn && (input.solarKw ?? 0) > 0) {
      const arr = arrayFootprint(vm, input.solarKw as number);
      if (arr) {
        out.push(poly(arr.corners.map(m.pt), "adw-accent", 1, DASH_HIDDEN));
        const c = centroid(arr.corners.map(m.pt));
        // set below the plane's centre so it clears the slope arrow's call-out
        out.push(
          text(c[0], c[1] + 20, "adw-t-accent", "7px", `PV ARRAY ${fmtG(input.solarKw as number)} kW`, ` text-anchor="middle"`),
        );
        out.push(text(c[0], c[1] + 30, "adw-t-accent", "6px", `${sqFt(arr.areaSqFt)} INDICATIVE FOOTPRINT`, ` text-anchor="middle"`));
        arrayDrawn = true;
        notes.push(
          `The PV array is drawn as an INDICATIVE FOOTPRINT of ${sqFt(arr.areaSqFt)} for ` +
            `${fmtG(input.solarKw as number)} kW, at about ${ARRAY_SQ_FT_PER_KW} sq ft per kW, on the ` +
            `${arr.faceLabel} plane. It is a footprint, not a layout: module count, rail spacing, ` +
            `attachment to a standing-seam roof, fire access setbacks, snow shed and the ` +
            `rapid-shutdown requirement all belong to the array design.`,
        );
        if (!arr.facesSouth) {
          notes.push(
            "WORTH RAISING WITH THE OWNER: no plane on this roof faces south. The Aura spec is " +
              "passive solar and an off-grid array in this climate is already fighting a 70–77% " +
              "December collapse in yield; an east or west plane costs more of it. Turning the " +
              "volume, changing the roof form to a shed facing south, or ground-mounting the array " +
              "are the three fixes, and all three are model decisions rather than drawing changes.",
          );
        }
      }
    }
  }

  if ((input.solarKw ?? 0) <= 0) {
    notes.push(
      "NO SOLAR ARRAY IS SHOWN. A HomeSpec does not carry systems, so no array size reached this " +
        "sheet and none has been assumed. The Aura standard kit is an 8 kW array " +
        "(lib/design/materials.ts); supply a size and the footprint is drawn on the plane nearest " +
        "south.",
    );
  }

  // roof intersections, marked but never resolved
  for (let i = 0; i < model.volumes.length; i++) {
    for (let j = i + 1; j < model.volumes.length; j++) {
      const a = model.volumes[i];
      const b = model.volumes[j];
      if (!boxesOverlap(boxOf([a.roofPlan]), boxOf([b.roofPlan]))) continue;
      const ab = boxOf([a.roofPlan]);
      const bb = boxOf([b.roofPlan]);
      const ox0 = Math.max(ab.minX, bb.minX);
      const ox1 = Math.min(ab.maxX, bb.maxX);
      const oz0 = Math.max(ab.minZ, bb.minZ);
      const oz1 = Math.min(ab.maxZ, bb.maxZ);
      out.push(
        rect(m.px(ox0), m.py(oz0), (ox1 - ox0) * s.ptPerFt, (oz1 - oz0) * s.ptPerFt, "adw-accent", 1.2, DASH_HIDDEN),
      );
      out.push(
        text((m.px(ox0) + m.px(ox1)) / 2, (m.py(oz0) + m.py(oz1)) / 2, "adw-t-accent", "6.5px", "ROOFS MEET — NOT RESOLVED", ` text-anchor="middle"`),
      );
      notes.push(
        `The roofs of "${a.volume.name}" and "${b.volume.name}" meet inside the marked area. Where ` +
          `two roofs meet there is a valley or a saddle with flashing, a cricket and a drainage ` +
          `path, and this generator does NOT design that junction — no valley line has been drawn ` +
          `because a drawn valley would be a guess. The designer resolves it.`,
      );
    }
  }

  if (model.deck) out.push(poly(model.deck.corners.map(m.pt), "adw-hair", 0.7, DASH_FINE));

  northArrow(out, CONTENT.x1 - 34, CONTENT.y0 + 46, 14);
  scaleBar(out, CONTENT.x0 + 10, CONTENT.y1 - 12, s);

  const forms = Array.from(new Set(model.volumes.map((v) => v.volume.roof.form)));
  notes.push(
    "The dashed line inside each roof outline is the WALL below; the gap between them is the eave " +
      "overhang. Overhangs project on all four sides except on a shed roof, whose high edge is " +
      "flush with the wall.",
    "NO HIP OR VALLEY LINES ARE DRAWN within a volume, because none of the roof forms this model " +
      `offers produces one — ${forms.join(", ")} are gable-family and shed-family forms with ` +
      "straight ridges and rakes. A hip roof is not in the spec, so a hip line is not in this " +
      "drawing.",
    "NOT SHOWN, and required: gutters, downpipes and where the water goes (the rainwater " +
      "catchment feeds the cistern, so this matters more than usual), snow guards, the wood-stove " +
      "flue penetration and its clearances, roof and soffit venting, ice-and-water membrane at " +
      "eaves and valleys, and every flashing detail.",
    "Snow load governs the roof structure in this climate zone and no structural design has been " +
      "done here. Trusses or rafters arrive designed and stamped by the supplier's engineer.",
  );

  return {
    number: "A4",
    title: "ROOF PLAN",
    scale: s.label,
    notes,
    svg: sheet({
      number: "A4",
      title: "ROOF PLAN",
      scaleLabel: s.label,
      projectName: ctx.projectName,
      dateISO: input.dateISO,
      drawnBy: input.drawnBy ?? "AURA",
      revision: input.revision ?? "0",
      meta: ctx.meta,
      body: out.join(""),
      notes,
      description: `Roof plan with ridge lines, slope arrows and overhangs.`,
    }),
  };
}

/** Local (fall axis, perpendicular) to world. */
function localFall(v: Volume, fallAxis: "x" | "z", a: number, sPos: number): Pt {
  return fallAxis === "x" ? toWorldLocal(v, a, sPos) : toWorldLocal(v, sPos, a);
}

/** An indicative array footprint on the roof plane nearest south. */
function arrayFootprint(
  vm: VolumeModel,
  kw: number,
): { corners: Pt[]; areaSqFt: number; faceLabel: string; facesSouth: boolean } | null {
  const roof = vm.roof;
  const v = vm.volume;
  if (roof.planes.length === 0 || kw <= 0) return null;

  // pick the plane whose downslope direction points nearest south (+Z)
  let best = roof.planes[0];
  let bestScore = -Infinity;
  for (const plane of roof.planes) {
    const dirLocal: Pt =
      roof.fallAxis === "x" ? [Math.sign(plane.a1 - plane.a0), 0] : [0, Math.sign(plane.a1 - plane.a0)];
    const yaw = (-v.rotationDeg * Math.PI) / 180;
    // only the world +Z (south) component matters: a plane that falls south
    // faces south, and that is the one an array goes on
    const wz = -dirLocal[0] * Math.sin(yaw) + dirLocal[1] * Math.cos(yaw);
    if (wz > bestScore) {
      bestScore = wz;
      best = plane;
    }
  }

  const areaSqFt = kw * ARRAY_SQ_FT_PER_KW;
  const planeRun = Math.abs(best.a1 - best.a0);
  const planeSpan = Math.abs(best.s1 - best.s0);
  if (planeRun <= 0 || planeSpan <= 0) return null;
  // keep a 1'-6" margin off every roof edge, then fit the area inside
  const marg = 1.5;
  const maxRun = Math.max(0.5, planeRun - 2 * marg);
  const maxSpan = Math.max(0.5, planeSpan - 2 * marg);
  let span = Math.min(maxSpan, Math.sqrt(areaSqFt * (maxSpan / Math.max(0.5, maxRun))) * 1.4);
  let run = areaSqFt / Math.max(0.5, span);
  if (run > maxRun) {
    run = maxRun;
    span = Math.min(maxSpan, areaSqFt / run);
  }
  const drawnArea = run * span;
  const aMid = (best.a0 + best.a1) / 2;
  const sMid = (best.s0 + best.s1) / 2;
  const corners: Pt[] = (
    [
      [aMid - run / 2, sMid - span / 2],
      [aMid + run / 2, sMid - span / 2],
      [aMid + run / 2, sMid + span / 2],
      [aMid - run / 2, sMid + span / 2],
    ] as const
  ).map(([a, sp]) => localFall(v, roof.fallAxis, a, sp));

  return {
    corners,
    areaSqFt: drawnArea,
    /* `bestScore` is the world +Z (south) component of the chosen plane's
       downslope direction: 1 is due south, 0 is east or west, −1 is north.
       Saying "the one nearest south" about a plane that faces east would be
       weaselling, so each band gets its own words. */
    faceLabel:
      bestScore > 0.3
        ? "south-facing"
        : bestScore < -0.3
          ? "NORTH-FACING — no plane on this roof faces south, and this is the least bad of them"
          : "EAST/WEST-FACING — no plane on this roof faces south",
    facesSouth: bestScore > 0.3,
  };
}

/* =====================================================================
   A5 — ELEVATIONS, ALL FOUR
   ===================================================================== */

function elevationsSheet(ctx: Ctx): DrawingSheet {
  const { model, spec, input } = ctx;
  const out: string[] = [];
  const notes: string[] = [];

  if (model.volumes.length === 0) {
    emptyNotice(out, notes, "building to draw in elevation");
    return {
      number: "A5",
      title: "ELEVATIONS",
      scale: "NOT TO SCALE — NOTHING TO DRAW",
      notes,
      svg: sheet({
        number: "A5",
        title: "ELEVATIONS",
        scaleLabel: "NOT TO SCALE — NOTHING TO DRAW",
        projectName: ctx.projectName,
        dateISO: input.dateISO,
        drawnBy: input.drawnBy ?? "AURA",
        revision: input.revision ?? "0",
        meta: ctx.meta,
        body: out.join(""),
        notes,
        description: "Elevations, issued empty because the model has no volumes.",
      }),
    };
  }

  const elevations = allElevations(model);

  /* One scale for all four, always. Four elevations at three scales is not a
     comparison, and comparison is the entire reason they share a sheet.

     The reserves are in POINTS — see DIM_RESERVE_W — and they are the real
     furniture: ELEV_PAD_L is the height-dimension string down the left,
     ELEV_PAD_R the level tags down the right, ELEV_PAD_T the view title and
     ELEV_PAD_B the overall-width dimension plus the material line. */
  const cellW = (CONTENT_W - ELEV_GAP_X) / 2;
  const cellH = (CONTENT_H - ELEV_GAP_Y) / 2;
  const widest = Math.max(1, ...elevations.map((e) => e.uMax - e.uMin));
  const tallest = Math.max(1, ...elevations.map((e) => e.yMax - e.yMin));
  const s = archScale(
    widest,
    tallest,
    cellW - ELEV_PAD_L - ELEV_PAD_R,
    cellH - ELEV_PAD_T - ELEV_PAD_B,
  );

  const frontFacing = nearestFacing(spec.siting.frontFacesDeg);
  const frontView = closestElevationTo(spec.siting.frontFacesDeg);

  elevations.forEach((elev, i) => {
    const cx = CONTENT.x0 + (i % 2) * (cellW + ELEV_GAP_X);
    const cy = CONTENT.y0 + Math.floor(i / 2) * (cellH + ELEV_GAP_Y);
    notes.push(...elev.notes.filter((n) => !notes.includes(n)));
    drawElevation(out, elev, s, cx, cy, cellW, cellH, elev.view === frontView, model);
  });

  notes.unshift(
    `All four elevations are drawn at ${s.label} so they can be compared. Heights are measured ` +
      `from FINISHED FLOOR (0'-0"); grade is ${fmtFt(-GRADE_Y_FT)} below it because the home stands ` +
      `on screw piles rather than on a slab.`,
    `GRADE IS DRAWN LEVEL. The lot slope is recorded as ${spec.siting.slope.toUpperCase()} and the ` +
      `real grade line at each corner comes off a survey. On a sloping site every height on these ` +
      `elevations moves relative to grade and the pile heights step to hold one level floor.`,
    `The front of the home faces ${deg(spec.siting.frontFacesDeg)} from north (${frontFacing.toUpperCase()}), ` +
      `so the ${WALL_NAME[frontView]} elevation is marked FRONT.`,
    "Openings are drawn on the wall they are placed on, at their true position, size and sill " +
      "height. A wall turned away from the viewer shows none, and a wall seen edge-on shows none.",
    "The pitch triangle is drawn only where the slope is in TRUE LENGTH. On a view that looks " +
      "along the fall of the roof the pitch is foreshortened, so it is printed as a note instead " +
      "of drawn as a triangle that would measure wrong off the sheet.",
    "Roof pitches are lettered AS BUILT. On an A-frame and a saltbox the built angle is not the " +
      "pitch parameter in the model — an A-frame doubles the rise, and a saltbox holds the same " +
      "ridge over a shorter run — so where the two differ both numbers are printed rather than " +
      "one of them quietly winning.",
    "MATERIAL AND FINISH: " +
      MATERIAL_KEYWORDS[spec.material].join(", ") +
      ". Cladding pattern, trim, colour and reveal are design decisions, not model outputs, and no " +
      "cladding texture is drawn.",
    "NOT SHOWN: guards and handrails, exterior lighting, the wood-stove flue and its required " +
      "height above the ridge, meters and service entries, downpipes, and the crawl-space skirt.",
  );

  if (model.deck) {
    notes.push(
      "The deck appears in the views it faces and is drawn at its real level, one step below " +
        "finished floor. It is NOT included in the overall width dimension, which measures the " +
        "building including its roof overhangs — the deck is dimensioned on the floor plan (A3).",
    );
  }

  if ((input.solarKw ?? 0) > 0) {
    notes.push(
      "The PV array is shown on the roof plan (A4) and is not drawn in elevation — module rails " +
        "standing off a standing-seam roof change the silhouette and no mounting height has been " +
        "designed.",
    );
  }

  return {
    number: "A5",
    title: "ELEVATIONS",
    scale: s.label,
    notes,
    svg: sheet({
      number: "A5",
      title: "ELEVATIONS",
      scaleLabel: s.label,
      projectName: ctx.projectName,
      dateISO: input.dateISO,
      drawnBy: input.drawnBy ?? "AURA",
      revision: input.revision ?? "0",
      meta: ctx.meta,
      body: out.join(""),
      notes,
      description:
        `North, south, east and west elevations at ${s.label}. Ridge ${fmtFt(model.maxRidgeHeightFt)} ` +
        `above finished floor, ${fmtFt(model.maxRidgeHeightFt - GRADE_Y_FT)} above grade.`,
    }),
  };
}

/** Which of the four named elevations a bearing is nearest to. */
function closestElevationTo(bearingDeg: number): "n" | "s" | "e" | "w" {
  let best: "n" | "s" | "e" | "w" = "s";
  let bestGap = Infinity;
  for (const v of ["n", "e", "s", "w"] as const) {
    const d = ((bearingDeg - ELEVATION_BEARING[v]) % 360 + 360) % 360;
    const gap = d > 180 ? 360 - d : d;
    if (gap < bestGap - 1e-9) {
      best = v;
      bestGap = gap;
    }
  }
  return best;
}

/** Paper reserved inside one elevation cell, in points. */
const ELEV_PAD_L = 58; // height dimension string
const ELEV_PAD_R = 60; // level tags — see `levelTagWidth`
const ELEV_PAD_T = 24; // view title
const ELEV_PAD_B = 52; // overall-width dimension + material line
const ELEV_GAP_X = 14;
const ELEV_GAP_Y = 14;

function drawElevation(
  out: string[],
  elev: Elevation,
  s: DrawScale,
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  isFront: boolean,
  model: HomeModel,
): void {
  const wFt = Math.max(1, elev.uMax - elev.uMin);
  const hFt = Math.max(1, elev.yMax - elev.yMin);
  const drawW = wFt * s.ptPerFt;
  const drawH = hFt * s.ptPerFt;
  const ox = cellX + ELEV_PAD_L + Math.max(0, (cellW - ELEV_PAD_L - ELEV_PAD_R - drawW) / 2);
  const baseY = cellY + ELEV_PAD_T + Math.max(0, (cellH - ELEV_PAD_T - ELEV_PAD_B - drawH) / 2) + drawH;

  const X = (u: number) => ox + (u - elev.uMin) * s.ptPerFt;
  const Y = (y: number) => baseY - (y - elev.yMin) * s.ptPerFt;
  const P = (p: Pt) => [X(p[0]), Y(p[1])] as const;

  out.push(
    text(cellX, cellY + 12, "adw-t-ink", "9px", elev.label + (isFront ? "   (FRONT)" : ""), ` letter-spacing="1.4"`),
  );

  // ---- ground first, so everything sits on it
  const gY = Y(elev.gradeY);
  out.push(line(X(elev.uMin) - 22, gY, X(elev.uMax) + 22, gY, "adw-ink", 1.6));
  // a short hatch band under grade
  for (let u = -20; u <= drawW + 20; u += 9) {
    out.push(line(X(elev.uMin) + u, gY, X(elev.uMin) + u - 6, gY + 6, "adw-hair", 0.4));
  }

  // ---- the exposed piles, deduped to the columns you would actually see
  for (const u of elev.pileUs) {
    out.push(line(X(u), gY, X(u), Y(-FLOOR_SLAB_FT), "adw-ink", 1.4, ' opacity="0.75"'));
  }

  // ---- far to near, filling each mass with paper first so nearer volumes
  //      occlude farther ones — painter's algorithm, which is a correct
  //      hidden-line result for masses that do not interpenetrate
  for (const vol of elev.volumes) {
    for (const shape of vol.shapes) {
      if (shape.pts.length < 3) continue;
      const pts = shape.pts.map(P);
      out.push(path(polyD(pts), "adw-fill-paper", 0));
      const w = shape.layer === "roof" || shape.layer === "parapet" ? 1.4 : shape.layer === "mass" ? 1.6 : 0.9;
      out.push(poly(pts, shape.layer === "deck" || shape.layer === "floor" ? "adw-hair" : "adw-ink", w));
    }

    // openings, on top of their own volume
    for (const o of vol.openings) {
      const pts = o.pts.map(P);
      if (o.kind === "door") {
        out.push(path(polyD(pts), "adw-fill-paper", 0));
        out.push(poly(pts, "adw-ink", 1.2));
        // a panel line, so a door reads as a door and not as a window
        const inset = 2.5;
        out.push(
          rect(
            Math.min(pts[0][0], pts[1][0]) + inset,
            Math.min(pts[2][1], pts[3][1]) + inset,
            Math.abs(pts[1][0] - pts[0][0]) - inset * 2,
            Math.abs(pts[0][1] - pts[3][1]) - inset * 2,
            "adw-hair",
            0.5,
          ),
        );
      } else {
        out.push(path(polyD(pts), "adw-fill-paper", 0));
        out.push(poly(pts, "adw-glass", 1.3));
        for (const [a, b] of o.mullions) {
          const pa = P(a);
          const pb = P(b);
          out.push(line(pa[0], pa[1], pb[0], pb[1], "adw-glass", 0.8, ' opacity="0.8"'));
        }
        // sill line
        out.push(line(pts[0][0] - 2, pts[0][1], pts[1][0] + 2, pts[1][1], "adw-glass", 0.8, ' opacity="0.7"'));
      }
    }
  }

  // ---- the pitch triangle, only where it is true
  const withRoof = elev.volumes.filter((v) => v.slope > 1e-4);
  const trueOne = withRoof.find((v) => v.pitchTrue);
  if (trueOne) drawPitchTriangle(out, trueOne, X, Y, elev);

  // ---- datums and the height string
  /* Short tag labels here, long ones on the section. Four elevations share one
     sheet and every point of the right-hand reserve is a point the drawing
     does not get — and the reserve is what decides whether the whole sheet
     holds 1/8" or drops to 3/32". A5 gets RIDGE / EAVE / FLOOR / GRADE; A6,
     with one drawing and room to spare, gets the full names. */
  const rx = X(elev.uMax) + 10;
  const tallest = elev.volumes.reduce((a, b) => (b.ridgeY > a.ridgeY ? b : a), elev.volumes[0]);
  if (tallest) {
    levelTag(out, X(elev.uMin) - 18, rx, Y(tallest.ridgeY), "RIDGE", fmtFt(tallest.ridgeY));
    levelTag(out, X(elev.uMin) - 18, rx, Y(tallest.eaveY), "EAVE", fmtFt(tallest.eaveY));
  }
  levelTag(out, X(elev.uMin) - 18, rx, Y(0), "FLOOR", `0'-0"`);
  levelTag(out, X(elev.uMin) - 18, rx, Y(elev.gradeY), "GRADE", fmtFt(elev.gradeY));

  const dx = X(elev.uMin) - 20;
  if (tallest) {
    dim(out, dx, Y(0), dx, Y(tallest.eaveY), fmtFt(tallest.eaveY), -1, 12);
    dim(out, dx, Y(tallest.eaveY), dx, Y(tallest.ridgeY), fmtFt(tallest.ridgeY - tallest.eaveY), -1, 12);
    dim(out, dx, Y(elev.gradeY), dx, Y(tallest.ridgeY), `${fmtFt(tallest.ridgeY - elev.gradeY)} OVERALL`, -1, 30);
  }
  dim(out, dx, Y(elev.gradeY), dx, Y(0), fmtFt(-elev.gradeY), -1, 12);

  /* ---- the overall width. The BUILDING extent — overhangs included, deck
     excluded — is the number that belongs on a building elevation. A deck
     visible in this view is dimensioned on the floor plan, not absorbed into
     the building's width where it would read as part of the house. */
  const bw = elev.buildingUMax - elev.buildingUMin;
  dim(out, X(elev.buildingUMin), gY + 14, X(elev.buildingUMax), gY + 14, `${fmtFt(bw)} INCL. OVERHANGS`, 1, 10);

  // ---- the material and pitch note, keyed off the grade line so it cannot
  //      drift into the dimension string when the drawing is short
  const pitchNote = withRoof
    .map(
      (v) =>
        `${v.name}: ${pitchLabel(v.builtPitchDeg, v.pitchDeg, v.slope)}` +
        (v.pitchTrue ? "" : " — foreshortened in this view"),
    )
    .join("   ·   ");
  out.push(
    text(
      cellX,
      Math.min(gY + 44, cellY + cellH - 4),
      "adw-t-dim",
      "6.4px",
      `${MATERIAL_LABEL(model.spec.material)} · ${WALL_THICKNESS_MM[model.spec.material]} mm WALL${pitchNote ? "   ·   " + pitchNote : ""}`,
    ),
  );
}

/** The little right triangle that tells a framer the pitch off the sheet. */
function drawPitchTriangle(
  out: string[],
  vol: ElevationVolume,
  X: (u: number) => number,
  Y: (y: number) => number,
  elev: Elevation,
): void {
  const run = 3; // feet of run in the triangle
  const rise = run * vol.slope;
  // sit it just below the ridge, on the side with room
  const apexU = vol.apexU ?? (elev.uMin + elev.uMax) / 2;
  const toRight = apexU < (elev.uMin + elev.uMax) / 2;
  const u0 = apexU + (toRight ? 1.2 : -1.2 - run);
  const yTop = vol.ridgeY - Math.abs(u0 - apexU) * vol.slope - 0.6;
  const x0 = X(u0);
  const x1 = X(u0 + run);
  const yA = Y(yTop);
  const yB = Y(yTop - rise);
  out.push(
    poly(
      [
        [x0, yA],
        [x1, yB],
        [x0, yB],
      ],
      "adw-ink",
      0.8,
    ),
  );
  out.push(text((x0 + x1) / 2, yB + 8, "adw-t-dim", "6px", "12", ` text-anchor="middle"`));
  out.push(text(x0 - 3, (yA + yB) / 2, "adw-t-dim", "6px", fmtG(Math.round(vol.slope * 12 * 10) / 10), ` text-anchor="end"`));
}

/* =====================================================================
   A6 — BUILDING SECTION
   ===================================================================== */

function sectionSheet(ctx: Ctx, section: BuildingSection | null): DrawingSheet {
  const { model, spec, input } = ctx;
  const out: string[] = [];
  const notes: string[] = [];

  if (!section) {
    out.push(
      text(
        (CONTENT.x0 + CONTENT.x1) / 2,
        (CONTENT.y0 + CONTENT.y1) / 2,
        "adw-t-accent",
        "13px",
        "NO VOLUME TO SECTION",
        ` text-anchor="middle" letter-spacing="2"`,
      ),
    );
    notes.push("This model has no volumes, so there is nothing to cut. The sheet is issued saying so.");
    return {
      number: "A6",
      title: "BUILDING SECTION",
      scale: "NOT TO SCALE",
      notes,
      svg: sheet({
        number: "A6",
        title: "SECTION",
        scaleLabel: "NOT TO SCALE",
        projectName: ctx.projectName,
        dateISO: input.dateISO,
        drawnBy: input.drawnBy ?? "AURA",
        revision: input.revision ?? "0",
        meta: ctx.meta,
        body: out.join(""),
        notes,
        description: "Building section, issued empty because the model has no volumes.",
      }),
    };
  }

  const wFt = Math.max(1, section.uMax - section.uMin);
  const hFt = Math.max(1, section.ridgeY - section.gradeY);
  const s = archScale(wFt, hFt, CONTENT_W - 190, CONTENT_H - DIM_RESERVE_H);

  const drawW = wFt * s.ptPerFt;
  const ox = CONTENT.x0 + 66 + Math.max(0, (CONTENT_W - 190 - drawW) / 2);
  const baseY = CONTENT.y1 - 74;

  const X = (u: number) => ox + (u - section.uMin) * s.ptPerFt;
  const Y = (y: number) => baseY - (y - section.gradeY) * s.ptPerFt;
  const P = (p: Pt) => [X(p[0]), Y(p[1])] as const;

  out.push(
    text(CONTENT.x0, CONTENT.y0 + 14, "adw-t-ink", "10px", `SECTION ${section.tag} — ${section.volumeName.toUpperCase()}`, ` letter-spacing="1.6"`),
  );
  out.push(
    text(CONTENT.x0, CONTENT.y0 + 27, "adw-t-dim", "7.5px", `Cut on the long axis at the centre of the volume, looking ${sectionLook(section)}. See A3 for the cut line.`),
  );

  // ---- grade + piles
  const gY = Y(section.gradeY);
  out.push(line(X(section.uMin) - 26, gY, X(section.uMax) + 26, gY, "adw-ink", 1.6));
  for (let u = -24; u <= drawW + 24; u += 9) {
    out.push(line(X(section.uMin) + u, gY, X(section.uMin) + u - 6, gY + 6, "adw-hair", 0.4));
  }
  for (const u of section.pileUs) {
    out.push(rect(X(u) - 2, Y(-FLOOR_SLAB_FT), 4, gY - Y(-FLOOR_SLAB_FT), "adw-poche", 0, ' stroke="none"'));
  }

  // ---- openings beyond the cut, in hairline, drawn first so the cut is over
  for (const o of section.beyond) {
    const pts = o.pts.map(P);
    out.push(poly(pts, "adw-glass", 0.7, ` opacity="0.65"` + DASH_FINE));
  }

  // ---- the roof in section
  const roofRing: Pt[] = [...section.roof.top, ...[...section.roof.bottom].reverse()];
  out.push(path(polyD(roofRing.map(P)), "adw-fill-paper", 0));
  out.push(poly(roofRing.map(P), "adw-ink", 1.6));
  out.push(path(polyD(roofRing.map(P)), "adw-poche", 0, ' opacity="0.18" stroke="none"'));

  // ---- the cut walls, poché
  for (const w of section.walls) {
    out.push(path(polyD(w.pts.map(P)), "adw-poche", 0, ' stroke="none"'));
  }

  // ---- the floor deck, poché
  out.push(path(polyD(section.floor.map(P)), "adw-poche", 0, ' stroke="none"'));

  // ---- lines: finished floor, ceiling
  out.push(line(X(section.uMin), Y(0), X(section.uMax), Y(0), "adw-ink", 1.2));

  // ---- levels and dimensions
  const rx = X(section.uMax) + 12;
  levelTag(out, X(section.uMin) - 20, rx, Y(section.ridgeY), "RIDGE", fmtFt(section.ridgeY));
  levelTag(out, X(section.uMin) - 20, rx, Y(section.eaveY), "T/O WALL", fmtFt(section.eaveY));
  levelTag(out, X(section.uMin) - 20, rx, Y(0), "FIN. FLOOR", `0'-0"`);
  levelTag(out, X(section.uMin) - 20, rx, Y(section.gradeY), "GRADE", fmtFt(section.gradeY));

  const dx = X(section.uMin) - 24;
  dim(out, dx, Y(0), dx, Y(section.eaveY), `${fmtFt(section.eaveY)} FLOOR TO T/O WALL`, -1, 16);
  dim(out, dx, Y(section.gradeY), dx, Y(section.ridgeY), `${fmtFt(section.ridgeY - section.gradeY)} OVERALL`, -1, 40);
  dim(out, X(section.uMin), gY + 12, X(section.uMax), gY + 12, fmtFt(wFt), 1, 10);
  // clear height, measured at the high point of the cut
  const midU = (section.uMin + section.uMax) / 2;
  dim(out, X(midU) + 6, Y(0), X(midU) + 6, Y(section.clearHeightFt), `${fmtFt(section.clearHeightFt)} CLEAR`, 1, 10);

  // ---- assembly callouts, with the numbers this model actually has
  const R = WALL_R_VALUE[spec.material];
  const roofDepthFt =
    section.roof.top.length > 0 && section.roof.bottom.length > 0
      ? Math.abs(section.roof.top[0][1] - section.roof.bottom[0][1])
      : 0;
  leader(
    out,
    X(section.uMax - 2),
    Y(section.eaveY + (section.ridgeY - section.eaveY) * 0.45),
    CONTENT.x1 - 6,
    CONTENT.y0 + 60,
    [
      "ROOF ASSEMBLY",
      `${fmtFt(roofDepthFt)} structural depth`,
      "Standing seam metal roof over",
      "underlayment. R-value NOT STATED —",
      "see the notes and A7.",
    ],
    "end",
  );
  leader(
    out,
    X(section.uMin + model.wallThicknessFt / 2),
    Y(section.eaveY * 0.55),
    CONTENT.x0 + 6,
    CONTENT.y0 + 60,
    [
      "WALL ASSEMBLY",
      `${MATERIAL_LABEL(spec.material)}`,
      `${WALL_THICKNESS_MM[spec.material]} mm structural (${fmtFt(model.wallThicknessFt)})`,
      `R-${fmtG(R)} effective`,
    ],
    "start",
  );
  leader(
    out,
    X(section.uMin + (section.uMax - section.uMin) * 0.28),
    Y(-FLOOR_SLAB_FT / 2),
    CONTENT.x0 + 6,
    CONTENT.y1 - 46,
    [
      "FLOOR ASSEMBLY",
      `${fmtFt(FLOOR_SLAB_FT)} structure over screw piles`,
      "Cold floor over a vented crawl space.",
      "R-value NOT STATED — see the notes.",
    ],
    "start",
  );

  // scale bar to the right, clear of the floor callout in the bottom-left
  scaleBar(out, CONTENT.x1 - 210, CONTENT.y1 - 22, s);

  notes.push(
    ...section.notes,
    `Clear height at the high point is ${fmtFt(section.clearHeightFt)} above finished floor, ` +
      `measured to the underside of the roof structure. Floor to the top of wall is ` +
      `${fmtFt(section.eaveY)}. Ceiling finish, service voids and any dropped ceiling come off that ` +
      `and are not drawn.`,
    `WALL R-VALUE IS THE ONE ASSEMBLY NUMBER THIS MODEL CARRIES: R-${fmtG(R)} effective for a ` +
      `${WALL_THICKNESS_MM[spec.material]} mm ${MATERIAL_LABEL(spec.material)} wall, from ` +
      `lib/design/materials.ts.`,
    "ROOF AND FLOOR R-VALUES ARE NOT STATED, because this model does not carry them and inventing " +
      "them on a section would be the worst kind of wrong — a number a reviewer would trust. The " +
      "roof and floor assemblies and their effective R-values are the designer's, and NBC 9.36 " +
      `sets the minimum for climate zone ${spec.climateZone}. Confirm against the current code ` +
      "edition adopted in your municipality.",
    "The floor is a COLD FLOOR over a vented crawl space on piles, not a slab on grade. That " +
      "changes the insulation strategy, the vapour control, the plumbing protection and the " +
      "air-barrier continuity at the rim — all of it detail work that belongs to the designer.",
    "AIR BARRIER AND VAPOUR CONTROL are not drawn. On an airtight envelope in this climate their " +
      "continuity — wall to roof, wall to floor, and around every opening — is the detail that " +
      "decides whether the building works. Heat-recovery ventilation is required with it.",
    "No structural member is sized anywhere in this set. Rafters or trusses, ridge, headers, " +
      "beams and the pile design all come from an engineer or from a truss supplier's stamped " +
      "drawings.",
  );

  return {
    number: "A6",
    title: "BUILDING SECTION",
    scale: s.label,
    notes,
    svg: sheet({
      number: "A6",
      title: "SECTION",
      scaleLabel: s.label,
      projectName: ctx.projectName,
      dateISO: input.dateISO,
      drawnBy: input.drawnBy ?? "AURA",
      revision: input.revision ?? "0",
      meta: ctx.meta,
      body: out.join(""),
      notes,
      description: `Building section ${section.tag} through ${section.volumeName}, ridge ${fmtFt(section.ridgeY)} above finished floor.`,
    }),
  };
}

function sectionLook(section: BuildingSection): string {
  const bearing = ((Math.atan2(section.viewDir[0], -section.viewDir[1]) * 180) / Math.PI + 360) % 360;
  const points = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  return points[Math.round(bearing / 45) % 8];
}

/* =====================================================================
   A7 — SCHEDULES
   ===================================================================== */

function schedulesSheet(ctx: Ctx): DrawingSheet {
  const { model, spec, input } = ctx;
  const out: string[] = [];
  const notes: string[] = [];

  const rows: ScheduleRow[] = openingSchedule(model);

  const cols: TableColumn[] = [
    { header: "MARK", w: 42 },
    { header: "TYPE", w: 210 },
    { header: "WIDTH", w: 62, align: "end" },
    { header: "HEIGHT", w: 62, align: "end" },
    { header: "QTY", w: 34, align: "middle" },
    { header: "ROUGH OPENING (W × H)", w: 132, align: "end" },
    { header: "SILL", w: 52, align: "end" },
    { header: "HEAD", w: 52, align: "end" },
    { header: "LOCATION", w: 250 },
  ];

  const body: string[][] = rows.map((r) => [
    r.mark,
    r.type,
    fmtFt(r.widthFt),
    fmtFt(r.heightFt),
    String(r.qty),
    `${fmtFtFrac(r.roWidthFt)} × ${fmtFtFrac(r.roHeightFt)}`,
    fmtFt(r.sillFt),
    fmtFt(r.headFt),
    r.locations.join("; "),
  ]);

  let y = CONTENT.y0 + 18;
  y = table(out, FULL.x0, y, cols, body.length > 0 ? body : [["—", "No openings are placed on this model.", "", "", "", "", "", "", ""]], {
    title: "WINDOW + DOOR SCHEDULE",
    rowH: 15,
  });

  const glazed = rows.filter((r) => r.kind !== "door").reduce((s, r) => s + r.areaSqFt, 0);
  const doors = rows.filter((r) => r.kind === "door").reduce((s, r) => s + r.areaSqFt, 0);
  const totalUnits = rows.reduce((s, r) => s + r.qty, 0);
  y += 6;
  out.push(
    text(
      FULL.x0,
      y + 7,
      "adw-t-dim",
      "7px",
      `${totalUnits} units in ${rows.length} marks  ·  glazed area ${sqFt(glazed)}  ·  door area ${sqFt(doors)}  ·  ` +
        `gross exterior wall area ${sqFt(model.grossWallAreaSqFt)}  ·  FDWR ${(modelFdwr(model) * 100).toFixed(1)}% ` +
        `against a prescriptive maximum of ${(FDWR_MAX * 100).toFixed(0)}%`,
    ),
  );
  y += 22;

  // ---- assemblies
  const aCols: TableColumn[] = [
    { header: "ASSEMBLY", w: 150 },
    { header: "DESCRIPTION", w: 430 },
    { header: "THICKNESS", w: 110, align: "end" },
    { header: "EFFECTIVE R", w: 108, align: "end" },
    { header: "SOURCE", w: 198 },
  ];
  const aRows: string[][] = [
    [
      "EXTERIOR WALL",
      `${MATERIAL_LABEL(spec.material)} structural wall. ${MATERIAL_KEYWORDS[spec.material][0]}.`,
      `${WALL_THICKNESS_MM[spec.material]} mm · ${fmtFt(model.wallThicknessFt)}`,
      `R-${fmtG(WALL_R_VALUE[spec.material])}`,
      "lib/design/materials.ts",
    ],
    [
      "INTERIOR PARTITION",
      "Non-structural partition, same everywhere.",
      `90 mm · ${fmtFt(model.partitionThicknessFt)}`,
      "n/a",
      "lib/design/materials.ts",
    ],
    [
      "ROOF",
      "Standing seam metal roof over underlayment on the roof structure. Assembly not designed.",
      "TO BE CONFIRMED",
      "NOT STATED",
      "Designer — see note 2",
    ],
    [
      "FLOOR",
      `Cold floor over a vented crawl space on screw piles, ${fmtFt(FLOOR_SLAB_FT)} structural depth. Assembly not designed.`,
      `${fmtFt(FLOOR_SLAB_FT)} structure`,
      "NOT STATED",
      "Designer — see note 2",
    ],
    [
      "FOUNDATION",
      `Protected galvanized screw piles, ${totalPiles(model)} shown at not more than ${PILE_GRID_FT}'-0" centres. No concrete.`,
      `${fmtFt(-GRADE_Y_FT - FLOOR_SLAB_FT)} exposed`,
      "n/a",
      "A2 — indicative, pending a P.Eng design",
    ],
    [
      "GLAZING",
      "Triple glazed, black anodised aluminium frames. U-value and SHGC not specified.",
      "—",
      "NOT STATED",
      "Supplier — see note 3",
    ],
  ];
  y = table(out, FULL.x0, y, aCols, aRows, { title: "ASSEMBLY SCHEDULE", rowH: 16 });

  // ---- the honesty block, in full, on the sheet that most needs it
  y += 20;
  out.push(text(FULL.x0, y, "adw-t-accent", "9px", "WHAT IS NOT IN THIS SET", ` letter-spacing="1.6"`));
  y += 5;
  out.push(line(FULL.x0, y, FULL.x1, y, "adw-accent", 0.6));
  y += 12;
  const colChars = charsIn((FULL.x1 - FULL.x0) / 2 - 20, 7);
  const closing = [
    ...PROFESSIONAL_NOTE,
    "GLAZING PERFORMANCE is not specified. U-value, SHGC, frame material and the spacer are what " +
      "decide whether the glass helps or hurts in this climate, and none of them is a model output.",
    "ROOF AND FLOOR R-VALUES are not stated anywhere in this set. The material table carries wall " +
      "R-values only. A number invented for a section is a number a reviewer would trust, which is " +
      "exactly why there is not one.",
  ];
  let col = 0;
  let cy = y;
  for (const note of closing) {
    const lines = wrap(note, colChars);
    if (cy + lines.length * 8.6 > FULL.y1 - 4 && col === 0) {
      col = 1;
      cy = y;
    }
    const cxx = FULL.x0 + col * ((FULL.x1 - FULL.x0) / 2 + 10);
    for (const s of lines) {
      if (cy > FULL.y1 - 4) break;
      out.push(text(cxx, cy, "adw-t-dim", "7px", s));
      cy += 8.6;
    }
    cy += 5;
  }

  notes.push(
    "Openings are grouped by kind and size: identical units share one mark and a quantity, which " +
      "is how a supplier quotes them. Marks are assigned in a stable order (doors, then windows, " +
      "then glazed screens, each largest first) so a revised set can be diffed against this one.",
    "ROUGH OPENINGS are a nominal allowance of 3/4\" on the width and 1/2\" on the height over the " +
      "unit size. The real allowance comes from the supplied unit's installation instructions and " +
      "it differs by manufacturer. Confirm before framing.",
    "The FDWR printed above measures the glass and doors on THIS model against this model's gross " +
      "exterior wall area (perimeter × wall height × storeys, with no deduction where two volumes " +
      "meet). It is not the plan engine's FDWR, which measures the packer's windows against the " +
      "envelope the packer solved. Both are honest and they are about different glass.",
    "SILL and HEAD heights are above FINISHED FLOOR of the storey the opening sits on.",
    "Egress: at least one bedroom window per sleeping room has to meet the minimum openable area " +
      "and dimensions, and no opening in this schedule has been checked against that requirement.",
  );

  return {
    number: "A7",
    title: "SCHEDULES",
    scale: "NOT TO SCALE",
    notes,
    svg: sheet({
      number: "A7",
      title: "SCHEDULES",
      scaleLabel: "NOT TO SCALE",
      projectName: ctx.projectName,
      dateISO: input.dateISO,
      drawnBy: input.drawnBy ?? "AURA",
      revision: input.revision ?? "0",
      meta: ctx.meta,
      body: out.join(""),
      notes: [],
      description: `Window and door schedule (${totalUnits} units) and assembly schedule with R-values.`,
    }),
  };
}

/* =====================================================================
   THE SET
   ===================================================================== */

const SHEET_TITLES: [string, string][] = [
  ["A0", "COVER + PROJECT DATA"],
  ["A1", "SITE PLAN"],
  ["A2", "FOUNDATION PLAN"],
  ["A3", "FLOOR PLAN"],
  ["A4", "ROOF PLAN"],
  ["A5", "ELEVATIONS"],
  ["A6", "BUILDING SECTION"],
  ["A7", "SCHEDULES"],
];

/** Build the whole set, in the order a permit set carries it. */
export function buildSheets(input: DrawingSetInput, model: HomeModel): DrawingSetResult {
  const spec = input.spec;
  const projectName = (input.projectName ?? spec.name ?? "AURA HOME").trim() || "AURA HOME";

  const meta = [
    `${sqFt(model.totalFloorAreaSqFt)} FLOOR AREA  ·  ${sqFt(model.groundFootprintSqFt)} FOOTPRINT  ·  ${model.volumes.length} VOLUME${model.volumes.length === 1 ? "" : "S"}`,
    `${MATERIAL_LABEL(spec.material)}  ·  ${WALL_THICKNESS_MM[spec.material]} mm WALL  ·  R-${fmtG(WALL_R_VALUE[spec.material])}  ·  CLIMATE ZONE ${spec.climateZone}`,
    `SCREW-PILE FOUNDATION, NO CONCRETE  ·  MAX RIDGE ${fmtFt(model.maxRidgeHeightFt)} A.F.F. / ${fmtFt(model.maxRidgeHeightFt - GRADE_Y_FT)} ABOVE GRADE`,
    input.address?.trim() ? input.address.trim().toUpperCase() : "SITE ADDRESS NOT SUPPLIED",
  ];

  const ctx: Ctx = {
    input,
    model,
    spec,
    parcel: input.parcel ?? null,
    projectName,
    meta,
  };

  const section = sectionOf(model, "A");

  const built: DrawingSheet[] = [
    // A0 is produced last so it can carry the real scales, then moved to front
    siteSheet(ctx),
    foundationSheet(ctx),
    floorSheet(ctx, section),
    roofSheet(ctx),
    elevationsSheet(ctx),
    sectionSheet(ctx, section),
    schedulesSheet(ctx),
  ];

  const index = SHEET_TITLES.map(([number, title]) => {
    const found = built.find((s) => s.number === number);
    return { number, title, scale: found?.scale ?? "NOT TO SCALE" };
  });

  const cover = coverSheet(ctx, index);
  const sheets = [cover, ...built];

  /* `warnings` is the MODEL's list — the things it had to clamp, cut or
     refuse. The per-sheet limitations stay on their sheet, where a reader can
     see what they apply to; merging the two lists would turn a specific note
     about the roof plan into a general alarm about the set. */
  return { sheets, index, warnings: model.warnings };
}
