/* ===========================================================================
   THE PROFESSIONAL EXPORTS — the two files a designer actually opens.

   `exportSpec.ts` gets the SHAPE out: glTF for anyone with a 3D viewer, OBJ
   for the machine in the corner running something from 2009, JSON for the
   round trip back into the builder. Those are the right formats for a person
   looking at a house.

   They are the wrong formats for a person WORKING on one. A residential
   designer in Alberta opens a drawing in CAD and a building in BIM, and
   neither of those doors is a mesh. So this file adds the two that matter:

   1. DXF — the 2D drawings, in model space, at full size, on real layers.
      Every CAD program on earth reads DXF: AutoCAD, BricsCAD, DraftSight,
      LibreCAD, QCAD, FreeCAD, Rhino, Inkscape, and every plan-check portal
      that accepts a drawing file at all. It is the format that lets somebody
      take our floor plan, correct the wall we got wrong, dimension the thing
      we could not know, and seal it.

   2. IFC4 — the building, as a building. IfcWall with a real material layer
      and a real thickness; IfcWindow sitting in an IfcOpeningElement that
      genuinely voids the wall it is in; IfcSlab; IfcRoof. This is the file a
      BIM-using designer imports and starts editing, and the one a quantity
      surveyor or an energy modeller can read.

   NEITHER OF THESE IS A DEPENDENCY.
   ------------------------------------------------------------------------
   Both writers below are first-party, and that is a considered decision
   rather than a not-invented-here reflex. See the two blocks headed WHY NO
   LIBRARY (DXF) and WHY NOT web-ifc, further down. The short version:

   · DXF R12 ASCII is a published, stable, tag-and-value text format. A writer
     for it is a few hundred lines and no new licence.
   · A `.ifc` file IS a STEP physical file (ISO 10303-21) — ASCII text. The
     expensive part of IFC export is AUTHORING THE ENTITY GRAPH, and no
     library does that for you; `exportSpec.ts` already says so in its own
     research block. A library would only have serialised the graph we build
     here — in exchange for ~1 MB of WASM and an MPL-2.0 notice obligation on
     an MIT repo. That trade is not worth making for a `sprintf`.

   WHAT THESE FILES ARE, AND ARE NOT. Same honesty as everything else in this
   builder. They carry a massing-and-layout study drawn to real dimensions.
   They are not a permit set, not a structural design and not a compliance
   check, and the disclaimer is written INTO both files — into the DXF as a
   note block on the TEXT layer, into the IFC as a property on the building —
   because a recipient who is emailed a file never saw our web page.

   DETERMINISTIC. No `Math.random`, no `Date.now`. The IFC file format
   requires a timestamp in its header, so the date is a PARAMETER exactly as
   it is for the drawing set — the same spec and the same date produce
   byte-identical output, and an export you can diff is how somebody notices
   that the house changed.

   THEME. Nothing here renders UI. The DXF carries AutoCAD Colour Index
   numbers, which are a property of the CAD file and its layers, not of our
   page — no hex, no rgba, nothing that could collide with night mode.
   =========================================================================== */

import { WALL_R_VALUE, WALL_THICKNESS_MM } from "@/lib/design/materials";

import {
  DECK_BEAM_FT,
  DECK_SLAB_FT,
  DECK_STEP_FT,
  FLOOR_SLAB_FT,
  GRADE_Y_FT,
  HOT_TUB_RADIUS_FT,
  MULLION_SPACING_FT,
  WALL_NAME,
  allElevations,
  buildHomeModel,
  modelFdwr,
  openingSchedule,
  sectionOf,
  totalPiles,
  type BuildingSection,
  type DeckModel,
  type Elevation,
  type ElevationLayer,
  type HomeModel,
  type Pt,
  type RoofPlane,
  type RoofSection,
  type ScheduleRow,
  type VolumeModel,
  type WorldOpening,
  type WorldWall,
} from "./drawings/model";
import {
  COMFORT_DISCLAIMER,
  DEFAULT_SETTINGS,
  NEUTRAL_BAND,
  SPACE_USE_LABEL,
  SPMV_METHOD_NOTE,
  TARGET_PROVENANCE,
  VAPOUR_UNIT_NOTE,
  comfortReport,
  type ComfortReport,
} from "./comfort";
import { fmtFt, fmtFtFrac, fmtG, pyRound, riseOver12, sqFt, wrap } from "./drawings/kit";
import { EXPORT_DISCLAIMER, FEET_TO_METRES, exportFilename, type ExportArtifact } from "./exportSpec";
import type { HomeSpec, RoofForm } from "./spec";

/* ===========================================================================
   SHARED — the sentences and constants both writers put in their files
   =========================================================================== */

/**
 * What the professional exports do NOT contain, in the words we would use to
 * a designer's face.
 *
 * This list is not defensive boilerplate; it is the list of things a reviewer
 * would otherwise spend an hour looking for before concluding they are absent.
 * Naming a gap costs one line. Leaving a reviewer to find it costs their
 * afternoon and our credibility.
 */
export const PRO_EXPORT_GAPS: readonly string[] = [
  "No structure. No rafters, joists, beams, headers, lintels, shear walls or connections.",
  "No pile design. The pile grid is an indicative layout at a nominal spacing; embedment, capacity and helix sizing are a P.Eng's design and are not in this file.",
  "No interior partitions, stairs, plumbing, ductwork, electrical or fixtures.",
  "No wall layers. The material layer set carries ONE structural layer at the real thickness; cladding, sheathing, service cavities and finishes are not modelled.",
  "No valley or saddle where two roofs meet. Where volumes overlap in plan the junction is left for the designer, and the drawing model says so.",
  "No site. The spec carries no parcel, so there are no setbacks, no property lines, no grades and no survey datum.",
  "No code check. Nothing in either file has been tested against the NBC, the Alberta edition, or any municipal bylaw.",
];

/** Roof forms as IFC4 names them, plus the two the enumeration has no word
 *  for. `IfcRoofTypeEnum` has no saltbox and no A-frame, so those are exported
 *  as USERDEFINED with the form spelled out in `ObjectType` — which is the
 *  schema's own mechanism for exactly this, and better than filing a saltbox
 *  under SHED_ROOF and hoping nobody notices. */
const IFC_ROOF_TYPE: Readonly<Record<RoofForm, { enumValue: string; objectType: string | null }>> = {
  gable: { enumValue: "GABLE_ROOF", objectType: null },
  shed: { enumValue: "SHED_ROOF", objectType: null },
  flat: { enumValue: "FLAT_ROOF", objectType: null },
  saltbox: { enumValue: "USERDEFINED", objectType: "Saltbox — asymmetric gable, ridge off centre" },
  "a-frame": { enumValue: "USERDEFINED", objectType: "A-frame — the roof slope is the wall" },
};

/** A material as a person reads it. Matches `MATERIAL_LABEL` in
 *  `drawings/sheets.ts` in intent; title case here because an IFC material
 *  name lands in a properties palette rather than in a drafted heading. */
const MATERIAL_NAME: Readonly<Record<HomeSpec["material"], string>> = {
  sip: "Structural insulated panel (SIP)",
  clt: "Cross-laminated timber (CLT)",
  timber_frame: "Timber frame",
  rammed_earth: "Rammed earth",
};

/* Constants RESTATED from `lib/builder/geometry.ts`, which cannot be imported
   here: it allocates three.js BufferGeometry, and pulling three into an export
   path would put a 600 kB renderer in the bundle of anyone who presses
   Download. `drawings/model.ts` already carries the same deliberate
   restatement and the same warning. These four are the ones this file needs
   and model.ts does not re-export. */

/** Screw-pile shaft radius, feet. geometry.ts `PILE_RADIUS_FT`. */
const PILE_RADIUS_FT = 0.17;
/** Where glazing sits in the reveal, as a fraction of wall thickness measured
 *  from the OUTER face. geometry.ts `GLASS_SET_FRACTION`. */
const GLASS_SET_FRACTION = 0.3;
/** Parapet upstand thickness on a flat roof, feet. geometry.ts
 *  `PARAPET_THICKNESS_FT`. */
const PARAPET_THICKNESS_FT = 0.5;
/** Nominal thickness of a glazing unit or door leaf as a solid, feet. Thicker
 *  than geometry.ts's 0.08 ft pane because an IFC window is the whole unit —
 *  frame, sealed unit and all — not a sheet of glass. */
const PANEL_THICKNESS_FT = 0.2;

/* ===========================================================================
   ============================  PART ONE: DXF  ==============================
   ===========================================================================

   WHY NO LIBRARY
   --------------
   Three candidates were considered and all three lose to ~350 lines here.

   · `maker.js` (Apache-2.0, in maintenance mode) is a 2D geometry and
     path-modelling library that happens to have a DXF exporter. It is the one
     `docs/research/BUILDER-ENGINE.md` already put on HOLD, with the note that
     "a ~30 KB first-party DXF writer is the lower-risk path". We do not need
     its geometry model — `drawings/model.ts` already IS our geometry model —
     so adopting it means importing a whole modelling paradigm to reach one
     serialiser.
   · `dxf-writer` (MIT, ~30 kB) is closest to what we want and genuinely small.
     It also has no ARC-with-layer-linetype control, no per-entity linetype,
     and hard-codes its table section. We would be patching it inside a week.
   · `@tarikjabiri/dxf` (MIT) writes AC1021 with full handle management, which
     is more format than a drawing handoff needs and more surface to be wrong
     about in a file we cannot test in AutoCAD.

   None of them is a bad package. The point is that DXF R12 ASCII is a
   tag/value text format with about eight entity types worth having, and the
   thing we would be buying is a `String()` call.

   THE VERSION QUESTION, ANSWERED HONESTLY
   ---------------------------------------
   The brief says "R12/2000". Those are two different file formats and you have
   to pick one:

   · R12 (`$ACADVER = AC1009`) needs no entity handles, no BLOCK_RECORD table
     and no OBJECTS section. Its polyline is POLYLINE/VERTEX/SEQEND.
   · R2000 (`AC1015`) requires a handle on every entity and table record, a
     BLOCK_RECORD table, and a root DICTIONARY in an OBJECTS section. Its
     polyline is LWPOLYLINE.

   LWPOLYLINE DOES NOT EXIST IN R12. Writing one into an AC1009 file produces
   a file that lenient readers accept and strict ones reject, which is the
   worst of both. So this writer targets **R12**, and its polylines are
   POLYLINE/VERTEX/SEQEND — which costs nothing, because every reader that
   understands LWPOLYLINE also understands POLYLINE, and many R12-era readers
   understand only POLYLINE. R12 is strictly the more openable of the two, and
   "most openable" is the entire reason this format is here.
   =========================================================================== */

/** AutoCAD Colour Index. Deliberately the classic seven-plus: these are what a
 *  drafter's eye expects, they survive every colour-to-pen mapping, and colour
 *  7 is the one that prints black on white and draws white on black — which is
 *  the CAD equivalent of being theme-aware. */
const ACI = {
  red: 1,
  yellow: 2,
  green: 3,
  cyan: 4,
  blue: 5,
  magenta: 6,
  foreground: 7,
  grey: 8,
  orange: 30,
} as const;

/** The layers, and what belongs on each.
 *
 *  The first five names are the ones the brief asked for, spelled exactly as
 *  it spelled them, because somebody's plotter pen table may already have
 *  them. The last four exist because cramming a roof, a deck, a foundation and
 *  a hidden line onto WALLS would be worse CAD hygiene than four more rows in
 *  a table nobody has to look at. */
const LAYERS = [
  { name: "WALLS", colour: ACI.foreground, linetype: "CONTINUOUS", purpose: "Wall faces, cut and elevation outlines, floor deck" },
  { name: "OPENINGS", colour: ACI.blue, linetype: "CONTINUOUS", purpose: "Windows, doors, glazed screens, mullions, door swings" },
  { name: "DIMENSIONS", colour: ACI.green, linetype: "CONTINUOUS", purpose: "Dimension lines, ticks and dimension text" },
  { name: "TEXT", colour: ACI.magenta, linetype: "CONTINUOUS", purpose: "View titles, labels, schedule text, general notes" },
  { name: "GRID", colour: ACI.grey, linetype: "CENTER", purpose: "Structural grid, section cut line, grade datum" },
  { name: "ROOF", colour: ACI.cyan, linetype: "CONTINUOUS", purpose: "Roof planes, ridge, eave outline, slope arrows" },
  { name: "DECK", colour: ACI.orange, linetype: "CONTINUOUS", purpose: "Deck and hot tub" },
  { name: "PILES", colour: ACI.red, linetype: "CONTINUOUS", purpose: "Screw piles" },
  { name: "HIDDEN", colour: ACI.grey, linetype: "HIDDEN", purpose: "Anything beyond the cut, or under something else" },
] as const;

type LayerName = (typeof LAYERS)[number]["name"];

/** Linetype definitions, patterned in FEET because model space is feet. A
 *  0.5 ft dash reads correctly on a 34 ft house; the same table in millimetres
 *  would look continuous. */
interface LinetypeDef {
  name: string;
  description: string;
  /** positive = dash, negative = gap, 0 = dot */
  pattern: number[];
}

const LINETYPES: readonly LinetypeDef[] = [
  { name: "CONTINUOUS", description: "Solid line", pattern: [] },
  { name: "HIDDEN", description: "Hidden __ __ __ __ __", pattern: [0.5, -0.25] },
  { name: "CENTER", description: "Center ____ _ ____ _ ____", pattern: [1.25, -0.25, 0.25, -0.25] },
];

/* ------------------------------------------------------------ entity model */

/**
 * A drawn thing, as DATA rather than as text.
 *
 * Views are built in their own local coordinates and then laid out on the
 * sheet, so an entity has to survive being translated after it is drawn and
 * has to report its own extent. Emitting strings up front would make both
 * impossible and would put a `+ dx` in three hundred places.
 */
type DxfEntity =
  | { k: "line"; layer: LayerName; a: Pt; b: Pt; lt?: string }
  | { k: "poly"; layer: LayerName; pts: readonly Pt[]; closed: boolean; lt?: string }
  | { k: "circle"; layer: LayerName; c: Pt; r: number; lt?: string }
  | { k: "arc"; layer: LayerName; c: Pt; r: number; startDeg: number; endDeg: number; lt?: string }
  | {
      k: "text";
      layer: LayerName;
      at: Pt;
      height: number;
      value: string;
      rotationDeg: number;
      /** 0 left, 1 centre, 2 right */
      hAlign: 0 | 1 | 2;
      /** 0 baseline, 1 bottom, 2 middle, 3 top */
      vAlign: 0 | 1 | 2 | 3;
    };

/** A view under construction: entities in local coordinates, plus its title. */
class Draft {
  readonly entities: DxfEntity[] = [];

  constructor(readonly title: string) {}

  line(layer: LayerName, a: Pt, b: Pt, lt?: string): void {
    if (!finitePt(a) || !finitePt(b)) return;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) return;
    this.entities.push({ k: "line", layer, a, b, lt });
  }

  poly(layer: LayerName, pts: readonly Pt[], closed: boolean, lt?: string): void {
    const clean = pts.filter(finitePt);
    if (clean.length < 2) return;
    this.entities.push({ k: "poly", layer, pts: clean, closed, lt });
  }

  circle(layer: LayerName, c: Pt, r: number, lt?: string): void {
    if (!finitePt(c) || !(r > 1e-9)) return;
    this.entities.push({ k: "circle", layer, c, r, lt });
  }

  arc(layer: LayerName, c: Pt, r: number, startDeg: number, endDeg: number, lt?: string): void {
    if (!finitePt(c) || !(r > 1e-9)) return;
    this.entities.push({ k: "arc", layer, c, r, startDeg, endDeg, lt });
  }

  text(
    layer: LayerName,
    at: Pt,
    height: number,
    value: string,
    opts: { rotationDeg?: number; hAlign?: 0 | 1 | 2; vAlign?: 0 | 1 | 2 | 3 } = {},
  ): void {
    const v = dxfText(value);
    if (!v || !finitePt(at) || !(height > 1e-9)) return;
    this.entities.push({
      k: "text",
      layer,
      at,
      height,
      value: v,
      rotationDeg: opts.rotationDeg ?? 0,
      hAlign: opts.hAlign ?? 0,
      vAlign: opts.vAlign ?? 0,
    });
  }

  /** A closed rectangle from two opposite corners. */
  rect(layer: LayerName, x0: number, y0: number, x1: number, y1: number, lt?: string): void {
    this.poly(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true, lt);
  }

  /**
   * A dimension, drawn as geometry rather than as a DIMENSION entity.
   *
   * A real DXF DIMENSION needs a DIMSTYLE table entry AND an anonymous block
   * holding the same lines and text we would draw anyway, and it re-renders
   * differently in every program that reads it. Exploded dimensions look
   * identical everywhere and can be edited by anyone. Every CAD handoff
   * pipeline that cares about the receiving end does this.
   *
   * Aligned, not axis-locked: `a` and `b` can be any two points, the dimension
   * line is parallel to them and offset perpendicular. That is what makes a
   * rotated volume dimension correctly instead of reporting its bounding box.
   */
  dim(a: Pt, b: Pt, offset: number, label: string, textHeight: number): void {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (!(len > 1e-6)) return;
    const ux = dx / len;
    const uy = dy / len;
    // perpendicular, rotated +90 degrees; a negative offset puts it the other side
    const px = -uy * offset;
    const py = ux * offset;
    const a2: Pt = [a[0] + px, a[1] + py];
    const b2: Pt = [b[0] + px, b[1] + py];
    const ext = offset >= 0 ? 0.18 : -0.18;
    // extension lines, held off the object by a small gap, running just past
    // the dimension line — the way a hand-drafted witness line does
    this.line("DIMENSIONS", [a[0] + px * 0.08, a[1] + py * 0.08], [a2[0] + -uy * ext, a2[1] + ux * ext]);
    this.line("DIMENSIONS", [b[0] + px * 0.08, b[1] + py * 0.08], [b2[0] + -uy * ext, b2[1] + ux * ext]);
    this.line("DIMENSIONS", a2, b2);
    // 45-degree ticks, matching the drafting language of drawings/kit.ts
    const t = textHeight * 0.7;
    const tx = (ux + -uy) * t * 0.5;
    const ty = (uy + ux) * t * 0.5;
    this.line("DIMENSIONS", [a2[0] - tx, a2[1] - ty], [a2[0] + tx, a2[1] + ty]);
    this.line("DIMENSIONS", [b2[0] - tx, b2[1] - ty], [b2[0] + tx, b2[1] + ty]);
    // text reads along the dimension line, never upside down
    let rot = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (rot > 90 || rot <= -90) rot += 180;
    const mid: Pt = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
    const lift = textHeight * 0.45;
    const rr = (rot * Math.PI) / 180;
    this.text(
      "DIMENSIONS",
      [mid[0] - Math.sin(rr) * lift, mid[1] + Math.cos(rr) * lift],
      textHeight,
      label,
      { rotationDeg: rot, hAlign: 1, vAlign: 0 },
    );
  }

  /** A level tag: a short leader and a height called out against a datum. */
  level(at: Pt, toX: number, label: string, textHeight: number): void {
    this.line("DIMENSIONS", at, [toX, at[1]]);
    const right = toX >= at[0];
    this.text("DIMENSIONS", [toX + (right ? 0.4 : -0.4), at[1] + textHeight * 0.35], textHeight, label, {
      hAlign: right ? 0 : 2,
    });
  }
}

const finitePt = (p: Pt): boolean => Number.isFinite(p[0]) && Number.isFinite(p[1]);

/**
 * A string, made safe for a DXF group-1 value.
 *
 * DXF is an ASCII format with no escape mechanism inside a value and a 255
 * character limit per group in R12. It has exactly three special sequences
 * (`%%d`, `%%p`, `%%c`) and those are the ones our drawing language actually
 * needs — the degree sign appears on every pitch call-out.
 */
function dxfText(raw: string): string {
  const mapped = raw
    .replace(/\r?\n/g, " ")
    .replace(/°/g, "%%d")
    .replace(/±/g, "%%p")
    .replace(/[∅Ø]/g, "%%c")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/·/g, "-")
    .replace(/…/g, "...")
    // anything left outside printable ASCII would be written raw into a file
    // that has no encoding declaration, so it goes rather than corrupts
    .replace(/[^\x20-\x7e]/g, "");
  return mapped.trim().slice(0, 240);
}

/** A DXF real. Fixed notation always — a reader that meets `1e-7` in a
 *  coordinate is entitled to do anything at all with it. */
function dnum(v: number): string {
  if (!Number.isFinite(v)) return "0.0";
  const n = Math.abs(v) < 1e-9 ? 0 : v;
  const s = n.toFixed(6).replace(/0+$/, "");
  return s.endsWith(".") ? `${s}0` : s;
}

/* ------------------------------------------------------ entity → DXF text */

/** DXF is a stream of (group code, value) pairs, one per line. */
const tag = (out: string[], code: number, value: string | number): void => {
  out.push(String(code), String(value));
};

function writeEntity(out: string[], e: DxfEntity): void {
  const common = (type: string): void => {
    tag(out, 0, type);
    tag(out, 8, e.layer);
    if ("lt" in e && e.lt) tag(out, 6, e.lt);
  };
  switch (e.k) {
    case "line":
      common("LINE");
      tag(out, 10, dnum(e.a[0]));
      tag(out, 20, dnum(e.a[1]));
      tag(out, 30, "0.0");
      tag(out, 11, dnum(e.b[0]));
      tag(out, 21, dnum(e.b[1]));
      tag(out, 31, "0.0");
      break;
    case "poly": {
      common("POLYLINE");
      tag(out, 66, 1); // "vertices follow" — mandatory in R12
      tag(out, 10, "0.0");
      tag(out, 20, "0.0");
      tag(out, 30, "0.0");
      tag(out, 70, e.closed ? 1 : 0);
      for (const p of e.pts) {
        tag(out, 0, "VERTEX");
        tag(out, 8, e.layer);
        tag(out, 10, dnum(p[0]));
        tag(out, 20, dnum(p[1]));
        tag(out, 30, "0.0");
      }
      tag(out, 0, "SEQEND");
      tag(out, 8, e.layer);
      break;
    }
    case "circle":
      common("CIRCLE");
      tag(out, 10, dnum(e.c[0]));
      tag(out, 20, dnum(e.c[1]));
      tag(out, 30, "0.0");
      tag(out, 40, dnum(e.r));
      break;
    case "arc":
      common("ARC");
      tag(out, 10, dnum(e.c[0]));
      tag(out, 20, dnum(e.c[1]));
      tag(out, 30, "0.0");
      tag(out, 40, dnum(e.r));
      tag(out, 50, dnum(e.startDeg));
      tag(out, 51, dnum(e.endDeg));
      break;
    case "text":
      common("TEXT");
      tag(out, 10, dnum(e.at[0]));
      tag(out, 20, dnum(e.at[1]));
      tag(out, 30, "0.0");
      tag(out, 40, dnum(e.height));
      tag(out, 1, e.value);
      tag(out, 50, dnum(e.rotationDeg));
      tag(out, 7, "STANDARD");
      tag(out, 71, 0);
      tag(out, 72, e.hAlign);
      // R12 uses the SECOND alignment point whenever either justification
      // group is non-zero, so it is always written and always equal to the
      // insertion point.
      tag(out, 11, dnum(e.at[0]));
      tag(out, 21, dnum(e.at[1]));
      tag(out, 31, "0.0");
      tag(out, 73, e.vAlign);
      break;
  }
}

interface Bbox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const EMPTY_BBOX: Bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

function bboxOf(entities: readonly DxfEntity[]): Bbox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const eat = (x: number, y: number): void => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    switch (e.k) {
      case "line":
        eat(e.a[0], e.a[1]);
        eat(e.b[0], e.b[1]);
        break;
      case "poly":
        for (const p of e.pts) eat(p[0], p[1]);
        break;
      case "circle":
      case "arc":
        eat(e.c[0] - e.r, e.c[1] - e.r);
        eat(e.c[0] + e.r, e.c[1] + e.r);
        break;
      case "text":
        eat(e.at[0], e.at[1]);
        // a rough box for the run of text, so a long note does not fall
        // outside $EXTMAX and confuse a ZOOM EXTENTS
        eat(e.at[0] + e.value.length * e.height * 0.62, e.at[1] + e.height);
        break;
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : EMPTY_BBOX;
}

function translated(entities: readonly DxfEntity[], dx: number, dy: number): DxfEntity[] {
  const p = (q: Pt): Pt => [q[0] + dx, q[1] + dy];
  return entities.map((e): DxfEntity => {
    switch (e.k) {
      case "line":
        return { ...e, a: p(e.a), b: p(e.b) };
      case "poly":
        return { ...e, pts: e.pts.map(p) };
      case "circle":
        return { ...e, c: p(e.c) };
      case "arc":
        return { ...e, c: p(e.c) };
      case "text":
        return { ...e, at: p(e.at) };
    }
  });
}

function scaled(entities: readonly DxfEntity[], k: number): DxfEntity[] {
  const p = (q: Pt): Pt => [q[0] * k, q[1] * k];
  return entities.map((e): DxfEntity => {
    switch (e.k) {
      case "line":
        return { ...e, a: p(e.a), b: p(e.b) };
      case "poly":
        return { ...e, pts: e.pts.map(p) };
      case "circle":
        return { ...e, c: p(e.c), r: e.r * k };
      case "arc":
        return { ...e, c: p(e.c), r: e.r * k };
      case "text":
        return { ...e, at: p(e.at), height: e.height * k };
    }
  });
}

/* ---------------------------------------------------------- the file shell */

function dxfDocument(entities: readonly DxfEntity[], insUnits: number): string {
  const box = bboxOf(entities);
  const out: string[] = [];

  // --- HEADER
  tag(out, 0, "SECTION");
  tag(out, 2, "HEADER");
  tag(out, 9, "$ACADVER");
  tag(out, 1, "AC1009");
  tag(out, 9, "$INSBASE");
  tag(out, 10, "0.0");
  tag(out, 20, "0.0");
  tag(out, 30, "0.0");
  tag(out, 9, "$EXTMIN");
  tag(out, 10, dnum(box.minX));
  tag(out, 20, dnum(box.minY));
  tag(out, 30, "0.0");
  tag(out, 9, "$EXTMAX");
  tag(out, 10, dnum(box.maxX));
  tag(out, 20, dnum(box.maxY));
  tag(out, 30, "0.0");
  tag(out, 9, "$LIMMIN");
  tag(out, 10, dnum(box.minX));
  tag(out, 20, dnum(box.minY));
  tag(out, 9, "$LIMMAX");
  tag(out, 10, dnum(box.maxX));
  tag(out, 20, dnum(box.maxY));
  /* $INSUNITS arrived in R13 and an R12 reader skips a header variable it does
     not recognise. It is written anyway because the readers that DO honour it
     — AutoCAD, BricsCAD, FreeCAD — are exactly the ones where inserting this
     file into a metric drawing at the wrong scale would be a silent 3.28x
     error, and that is the single most common complaint about hobby CAD
     exports. */
  tag(out, 9, "$INSUNITS");
  tag(out, 70, insUnits);
  tag(out, 0, "ENDSEC");

  // --- TABLES
  tag(out, 0, "SECTION");
  tag(out, 2, "TABLES");

  tag(out, 0, "TABLE");
  tag(out, 2, "LTYPE");
  tag(out, 70, LINETYPES.length);
  for (const lt of LINETYPES) {
    tag(out, 0, "LTYPE");
    tag(out, 2, lt.name);
    tag(out, 70, 64);
    tag(out, 3, lt.description);
    tag(out, 72, 65); // 'A', the only alignment code DXF defines
    tag(out, 73, lt.pattern.length);
    tag(out, 40, dnum(lt.pattern.reduce((s, v) => s + Math.abs(v), 0)));
    for (const d of lt.pattern) tag(out, 49, dnum(d));
  }
  tag(out, 0, "ENDTAB");

  tag(out, 0, "TABLE");
  tag(out, 2, "LAYER");
  tag(out, 70, LAYERS.length);
  for (const l of LAYERS) {
    tag(out, 0, "LAYER");
    tag(out, 2, l.name);
    tag(out, 70, 0);
    tag(out, 62, l.colour);
    tag(out, 6, l.linetype);
  }
  tag(out, 0, "ENDTAB");

  /* A STYLE table with STANDARD in it. Every TEXT entity below names
     STANDARD in group 7, and a reader that cannot resolve a text style either
     drops the text or substitutes silently. Four lines to not find out which. */
  tag(out, 0, "TABLE");
  tag(out, 2, "STYLE");
  tag(out, 70, 1);
  tag(out, 0, "STYLE");
  tag(out, 2, "STANDARD");
  tag(out, 70, 0);
  tag(out, 40, "0.0"); // fixed height 0 = height comes from the entity
  tag(out, 41, "1.0"); // width factor
  tag(out, 50, "0.0"); // oblique angle
  tag(out, 71, 0);
  tag(out, 42, "0.2");
  tag(out, 3, "txt");
  tag(out, 4, "");
  tag(out, 0, "ENDTAB");

  tag(out, 0, "ENDSEC");

  // --- ENTITIES
  tag(out, 0, "SECTION");
  tag(out, 2, "ENTITIES");
  for (const e of entities) writeEntity(out, e);
  tag(out, 0, "ENDSEC");

  tag(out, 0, "EOF");
  return `${out.join("\r\n")}\r\n`;
}

/* ===========================================================================
   DXF VIEWS — the drawing model, drafted

   Everything below reads `drawings/model.ts` and NOTHING re-derives a
   dimension. That is the same rule the SVG sheets obey, and it is why the DXF
   and the PDF of the same home cannot disagree: they are two renderings of one
   set of numbers, not two calculations that happen to agree.

   PLAN ORIENTATION. The model's world is (+X east, +Z south). A drawing wants
   north up, so plan views map (x, z) -> (x, -z). That flip lives in `planPt`
   and nowhere else.
   =========================================================================== */

const planPt = (p: Pt): Pt => [p[0], -p[1]];

/** Text sizes, in feet, so they read correctly at 1:1 in model space. */
const TX = {
  title: 1.6,
  label: 0.7,
  small: 0.5,
  dim: 0.55,
  note: 0.6,
} as const;

const DIM_OFF = 4.5;

/* ------------------------------------------------------------- floor plan */

/** Parameter of `q` projected onto the segment `p0 -> p1`. */
function paramOn(p0: Pt, p1: Pt, q: Pt): number {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) return 0;
  return ((q[0] - p0[0]) * dx + (q[1] - p0[1]) * dy) / d2;
}

const lerpPt = (p0: Pt, p1: Pt, t: number): Pt => [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];

/**
 * An edge with its openings taken out of it.
 *
 * The wall faces are drawn as the four sides of the volume's outer and inner
 * rectangles rather than as four per-wall segments, because the e and w walls
 * butt INTO the n and s walls and are two thicknesses short — so four per-wall
 * segments would leave a wall-thickness gap at each corner. The rectangle is
 * the closed figure; the openings are what break it.
 */
function edgeGaps(p0: Pt, p1: Pt, cuts: readonly (readonly [number, number])[]): [Pt, Pt][] {
  const sorted = cuts
    .map(([a, b]) => (a <= b ? ([a, b] as [number, number]) : ([b, a] as [number, number])))
    .filter(([a, b]) => b > 0 && a < 1 && b - a > 1e-6)
    .map(([a, b]) => [Math.max(0, a), Math.min(1, b)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const out: [Pt, Pt][] = [];
  let at = 0;
  for (const [a, b] of sorted) {
    if (a > at + 1e-6) out.push([lerpPt(p0, p1, at), lerpPt(p0, p1, a)]);
    at = Math.max(at, b);
  }
  if (at < 1 - 1e-6) out.push([lerpPt(p0, p1, at), lerpPt(p0, p1, 1)]);
  return out;
}

function drawFloorPlan(model: HomeModel, section: BuildingSection | null): Draft {
  const d = new Draft("FLOOR PLAN");

  for (const vm of model.volumes) {
    const outer = vm.outer.map(planPt);
    const inner = vm.inner.map(planPt);

    for (let i = 0; i < 4; i++) {
      const o0 = outer[i];
      const o1 = outer[(i + 1) % 4];
      const i0 = inner[i];
      const i1 = inner[(i + 1) % 4];
      /* Which wall lies on this edge: the one whose outer-face endpoints BOTH
         sit on it. A tolerance of 1e-4 ft is a ten-thousandth of an inch —
         far below any real dimension and far above the rotation arithmetic's
         error, so it can neither miss a wall nor catch a second one. */
      const wall = vm.walls.find(
        (w) =>
          w.built &&
          distToSegment(planPt(w.a), o0, o1) < 1e-4 &&
          distToSegment(planPt(w.b), o0, o1) < 1e-4,
      );

      /* THE INNER EDGE IS NOT THE OUTER EDGE RESCALED. It is two wall
         thicknesses shorter, so the SAME parameter is a different point on
         each. Projecting the opening's world endpoints separately onto each
         edge gives the perpendicular foot on both, which is what makes a jamb
         line perpendicular instead of splayed by three percent. */
      const outerCuts: [number, number][] = [];
      const innerCuts: [number, number][] = [];
      if (wall) {
        for (const o of wall.openings) {
          if (o.drawnWidthFt <= 1e-6) continue;
          const a = planPt(o.a);
          const b = planPt(o.b);
          outerCuts.push([paramOn(o0, o1, a), paramOn(o0, o1, b)]);
          innerCuts.push([paramOn(i0, i1, a), paramOn(i0, i1, b)]);
        }
      }

      for (const [a, b] of edgeGaps(o0, o1, outerCuts)) d.line("WALLS", a, b);
      for (const [a, b] of edgeGaps(i0, i1, innerCuts)) d.line("WALLS", a, b);

      if (wall) drawPlanOpenings(d, wall, o0, o1, i0, i1);
    }

    /* Volume identity, above the centre — the section cut line runs THROUGH
       the centre, and a floor area lettered on top of a cut line is a floor
       area nobody can read. */
    const c = planPt([vm.volume.x, vm.volume.z]);
    d.text("TEXT", [c[0], c[1] + TX.label * 3.2], TX.label, vm.volume.name.toUpperCase(), { hAlign: 1 });
    d.text("TEXT", [c[0], c[1] + TX.label * 2.0], TX.small, sqFt(vm.footprintSqFt), { hAlign: 1 });

    /* Overall dimensions, aligned to the volume's OWN axes so a rotated volume
       is dimensioned across itself rather than across its bounding box.
       The offset SIGN is worked out from the centroid rather than assumed from
       the ring's winding: `rectCorners` winds one way, a future edit could wind
       it the other, and a dimension string drawn through the middle of the
       house is the loudest possible way to get that wrong. */
    const outward = (a: Pt, b: Pt): number => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const px = -(b[1] - a[1]) / len;
      const py = (b[0] - a[0]) / len;
      const mx = (a[0] + b[0]) / 2 - c[0];
      const my = (a[1] + b[1]) / 2 - c[1];
      return mx * px + my * py >= 0 ? DIM_OFF : -DIM_OFF;
    };
    d.dim(outer[0], outer[1], outward(outer[0], outer[1]), fmtFt(vm.volume.widthFt), TX.dim);
    d.dim(outer[1], outer[2], outward(outer[1], outer[2]), fmtFt(vm.volume.depthFt), TX.dim);
  }

  if (model.deck) drawDeckPlan(d, model.deck);

  if (section) {
    const a = planPt(section.cutLine[0]);
    const b = planPt(section.cutLine[1]);
    d.line("GRID", a, b, "CENTER");
    d.text("GRID", [a[0], a[1] - TX.small], TX.small, `SECTION ${section.tag}`, { hAlign: 1 });
    d.text("GRID", [b[0], b[1] - TX.small], TX.small, `SECTION ${section.tag}`, { hAlign: 1 });
  }

  northArrow(d, bboxOf(d.entities));
  return d;
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const t = Math.max(0, Math.min(1, paramOn(a, b, p)));
  const q = lerpPt(a, b, t);
  return Math.hypot(p[0] - q[0], p[1] - q[1]);
}

/** Window glass, glazed-screen mullions, door leaf and swing, in plan. */
function drawPlanOpenings(d: Draft, wall: WorldWall, o0: Pt, o1: Pt, i0: Pt, i1: Pt): void {
  for (const o of wall.openings) {
    if (o.drawnWidthFt <= 1e-6) continue;
    const wa = planPt(o.a);
    const wb = planPt(o.b);
    const outA = lerpPt(o0, o1, paramOn(o0, o1, wa));
    const outB = lerpPt(o0, o1, paramOn(o0, o1, wb));
    const inA = lerpPt(i0, i1, paramOn(i0, i1, wa));
    const inB = lerpPt(i0, i1, paramOn(i0, i1, wb));
    if (!finitePt(outA) || !finitePt(outB) || !finitePt(inA) || !finitePt(inB)) continue;

    // the jambs: the reveal, drawn as the wall stopping
    d.line("WALLS", outA, inA);
    d.line("WALLS", outB, inB);

    if (o.kind === "door") {
      drawDoorSwing(d, outA, outB, inA);
      continue;
    }

    // glazing, set into the reveal at the same fraction the 3D model uses
    const gA = lerpPt(outA, inA, GLASS_SET_FRACTION);
    const gB = lerpPt(outB, inB, GLASS_SET_FRACTION);
    d.line("OPENINGS", gA, gB);

    if (o.kind === "glazing-wall") {
      // a glazed screen reads as bays, not as one impossible pane
      const bays = Math.max(1, Math.round(o.drawnWidthFt / MULLION_SPACING_FT));
      for (let i = 1; i < bays; i++) {
        const f = i / bays;
        d.line("OPENINGS", lerpPt(outA, outB, f), lerpPt(inA, inB, f));
      }
    }
  }
}

/**
 * A door leaf and its swing.
 *
 * The leaf hangs on the jamb at `outA`, lies open perpendicular to the wall,
 * and the arc runs from the closed position back to it. DXF arcs are always
 * traversed COUNTER-CLOCKWISE from the start angle, so the two ends are
 * ordered by which of them makes the counter-clockwise sweep the short way
 * round — otherwise half the doors in a house draw a 270-degree swing.
 */
function drawDoorSwing(d: Draft, outA: Pt, outB: Pt, inA: Pt): void {
  const width = Math.hypot(outB[0] - outA[0], outB[1] - outA[1]);
  if (!(width > 1e-6)) return;
  const thick = Math.hypot(inA[0] - outA[0], inA[1] - outA[1]);
  if (!(thick > 1e-9)) return;
  const hinge: Pt = [(outA[0] + inA[0]) / 2, (outA[1] + inA[1]) / 2];
  const nx = (inA[0] - outA[0]) / thick;
  const ny = (inA[1] - outA[1]) / thick;
  const open: Pt = [hinge[0] + nx * width, hinge[1] + ny * width];
  d.line("OPENINGS", hinge, open);

  const openDeg = (Math.atan2(ny, nx) * 180) / Math.PI;
  const shutDeg = (Math.atan2(outB[1] - outA[1], outB[0] - outA[0]) * 180) / Math.PI;
  const ccw = (((openDeg - shutDeg) % 360) + 360) % 360;
  if (ccw <= 180) d.arc("OPENINGS", hinge, width, shutDeg, openDeg);
  else d.arc("OPENINGS", hinge, width, openDeg, shutDeg);
}

function drawDeckPlan(d: Draft, deck: DeckModel): void {
  d.poly("DECK", deck.corners.map(planPt), true);
  if (deck.tub) {
    const c = planPt(deck.tub);
    d.circle("DECK", c, HOT_TUB_RADIUS_FT);
    d.text("DECK", [c[0], c[1] - HOT_TUB_RADIUS_FT - TX.small], TX.small, "WOOD-FIRED HOT TUB", { hAlign: 1 });
  }
}

function northArrow(d: Draft, box: Bbox): void {
  const r = Math.max(2.5, (box.maxX - box.minX) * 0.06);
  const cx = box.maxX + r * 2.2;
  const cy = box.maxY - r;
  d.line("TEXT", [cx, cy - r], [cx, cy + r]);
  d.line("TEXT", [cx, cy + r], [cx - r * 0.35, cy + r * 0.35]);
  d.line("TEXT", [cx, cy + r], [cx + r * 0.35, cy + r * 0.35]);
  d.text("TEXT", [cx, cy + r * 1.35], TX.label, "N", { hAlign: 1 });
}

/* -------------------------------------------------------------- roof plan */

function drawRoofPlan(model: HomeModel): Draft {
  const d = new Draft("ROOF PLAN");
  for (const vm of model.volumes) {
    d.poly("ROOF", vm.roofPlan.map(planPt), true);
    d.poly("HIDDEN", vm.outer.map(planPt), true);
    if (vm.ridge) {
      d.line("ROOF", planPt(vm.ridge[0]), planPt(vm.ridge[1]), "CENTER");
    }
    slopeArrow(d, vm);
    const c = planPt([vm.volume.x, vm.volume.z]);
    d.text("TEXT", [c[0], c[1] + TX.label], TX.label, `${vm.volume.roof.form.toUpperCase()} ROOF`, { hAlign: 1 });
    d.text("TEXT", [c[0], c[1] - TX.small * 0.6], TX.small, `${riseOver12(vm.roof.slope)}  ${fmtG(pyRound(vm.volume.roof.pitchDeg, 1))}°`, {
      hAlign: 1,
    });
    d.text("TEXT", [c[0], c[1] - TX.small * 2], TX.small, `EAVE OVERHANG ${fmtFt(vm.roof.overhangFt)}`, { hAlign: 1 });
  }
  if (model.deck) d.poly("HIDDEN", model.deck.corners.map(planPt), true);
  northArrow(d, bboxOf(d.entities));
  return d;
}

/** An arrow along the fall direction, which is what a roof plan is FOR. */
function slopeArrow(d: Draft, vm: VolumeModel): void {
  const roof = vm.roof;
  const v = vm.volume;
  const yaw = (-v.rotationDeg * Math.PI) / 180;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const localDir: Pt = roof.fallAxis === "x" ? [1, 0] : [0, 1];
  // the fall runs downhill: away from the apex
  const sign = roof.apexA <= 0 ? 1 : -1;
  const wx = (localDir[0] * sign) * c + (localDir[1] * sign) * s;
  const wz = -(localDir[0] * sign) * s + (localDir[1] * sign) * c;
  const dir = planPt([wx, wz]);
  const len = Math.max(3, roof.halfFall * 0.7);
  const start = planPt([v.x, v.z]);
  const end: Pt = [start[0] + dir[0] * len, start[1] + dir[1] * len];
  d.line("ROOF", start, end);
  const ang = Math.atan2(dir[1], dir[0]);
  const head = len * 0.16;
  for (const off of [2.6, -2.6]) {
    d.line("ROOF", end, [end[0] - Math.cos(ang + off) * head, end[1] - Math.sin(ang + off) * head]);
  }
}

/* -------------------------------------------------------- foundation plan */

function drawFoundationPlan(model: HomeModel): Draft {
  const d = new Draft("FOUNDATION PLAN — SCREW PILES, INDICATIVE");
  for (const vm of model.volumes) {
    d.poly("HIDDEN", vm.outer.map(planPt), true);
    // grid lines through the pile rows and columns
    const v = vm.volume;
    const yaw = (-v.rotationDeg * Math.PI) / 180;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const toWorld = (lx: number, lz: number): Pt => [v.x + lx * c + lz * s, v.z - lx * s + lz * c];
    const halfW = v.widthFt / 2 + 2;
    const halfD = v.depthFt / 2 + 2;
    for (const x of vm.piles.xs) d.line("GRID", planPt(toWorld(x, -halfD)), planPt(toWorld(x, halfD)), "CENTER");
    for (const z of vm.piles.zs) d.line("GRID", planPt(toWorld(-halfW, z)), planPt(toWorld(halfW, z)), "CENTER");
    for (const p of vm.piles.points) d.circle("PILES", planPt(p), PILE_RADIUS_FT * 2.2);
    const cc = planPt([v.x, v.z]);
    d.text("TEXT", [cc[0], cc[1] + TX.label], TX.label, `${vm.piles.count} PILES`, { hAlign: 1 });
    d.text(
      "TEXT",
      [cc[0], cc[1] - TX.small * 0.6],
      TX.small,
      `${fmtFt(vm.piles.spacingXFt)} x ${fmtFt(vm.piles.spacingZFt)} NOMINAL GRID`,
      { hAlign: 1 },
    );
  }
  northArrow(d, bboxOf(d.entities));
  return d;
}

/* ------------------------------------------------------------- elevations */

const ELEVATION_LAYER: Readonly<Record<ElevationLayer, LayerName>> = {
  mass: "WALLS",
  roof: "ROOF",
  parapet: "ROOF",
  floor: "WALLS",
  deck: "DECK",
};

function drawElevation(model: HomeModel, elev: Elevation): Draft {
  const d = new Draft(elev.label);

  // grade, drawn wider than the building because that is what a grade line is
  const pad = Math.max(4, (elev.uMax - elev.uMin) * 0.08);
  d.line("GRID", [elev.uMin - pad, elev.gradeY], [elev.uMax + pad, elev.gradeY]);
  d.text("GRID", [elev.uMin - pad, elev.gradeY - TX.small * 1.4], TX.small, "GRADE (ASSUMED LEVEL — NO SURVEY)");

  // exposed piles, as the columns you would actually see
  for (const u of elev.pileUs) {
    d.line("PILES", [u - PILE_RADIUS_FT, GRADE_Y_FT], [u - PILE_RADIUS_FT, -FLOOR_SLAB_FT]);
    d.line("PILES", [u + PILE_RADIUS_FT, GRADE_Y_FT], [u + PILE_RADIUS_FT, -FLOOR_SLAB_FT]);
  }

  // far to near, the order `elevationOf` already sorted them into
  for (const v of elev.volumes) {
    for (const s of v.shapes) d.poly(ELEVATION_LAYER[s.layer], s.pts, true);
    for (const o of v.openings) {
      d.poly("OPENINGS", o.pts, true);
      for (const [a, b] of o.mullions) d.line("OPENINGS", a, b);
      if (o.kind === "door") {
        // a door reads as a door in elevation: a leaf line inside the frame
        const box = o.pts;
        const inset = 0.18;
        d.poly(
          "OPENINGS",
          [
            [box[0][0] + inset, box[0][1] + inset],
            [box[1][0] - inset, box[1][1] + inset],
            [box[2][0] - inset, box[2][1] - inset],
            [box[3][0] + inset, box[3][1] - inset],
          ],
          true,
        );
      }
    }
  }

  // heights, called out against grade because that is the datum a bylaw uses
  const tagX = elev.uMax + pad * 0.5;
  d.level([elev.buildingUMax, 0], tagX, `FINISHED FLOOR  ${fmtFt(0)}`, TX.dim);
  d.level([elev.buildingUMax, elev.gradeY], tagX, `GRADE  ${fmtFt(elev.gradeY)}`, TX.dim);
  for (const v of elev.volumes) {
    if (v.volumeId === "__deck") continue;
    d.level([elev.buildingUMax, v.eaveY], tagX, `EAVE  ${fmtFt(v.eaveY)}`, TX.dim);
    d.level([elev.buildingUMax, v.ridgeY], tagX, `RIDGE  ${fmtFt(v.ridgeY)}`, TX.dim);
    if (v.pitchTrue) {
      d.text(
        "TEXT",
        [elev.buildingUMin, v.ridgeY + TX.small],
        TX.small,
        `${v.name.toUpperCase()}  ${riseOver12(v.slope)}  (${fmtG(pyRound(v.pitchDeg, 1))}°)`,
      );
    } else {
      d.text(
        "TEXT",
        [elev.buildingUMin, v.ridgeY + TX.small],
        TX.small,
        `${v.name.toUpperCase()}  PITCH ${fmtG(pyRound(v.pitchDeg, 1))}° — FORESHORTENED IN THIS VIEW`,
      );
    }
  }

  // overall building width, deck deliberately excluded
  d.dim(
    [elev.buildingUMin, elev.gradeY],
    [elev.buildingUMax, elev.gradeY],
    -DIM_OFF,
    fmtFt(elev.buildingUMax - elev.buildingUMin),
    TX.dim,
  );
  // and the height that a height limit is measured over
  d.dim(
    [elev.buildingUMin, elev.gradeY],
    [elev.buildingUMin, elev.yMax],
    DIM_OFF,
    fmtFt(elev.yMax - elev.gradeY),
    TX.dim,
  );
  return d;
}

/* ---------------------------------------------------------------- section */

function drawSection(section: BuildingSection): Draft {
  const d = new Draft(`SECTION ${section.tag} — ${section.volumeName.toUpperCase()}`);

  const pad = Math.max(4, (section.uMax - section.uMin) * 0.08);
  d.line("GRID", [section.uMin - pad, section.gradeY], [section.uMax + pad, section.gradeY]);

  d.poly("WALLS", section.floor, true);
  for (const w of section.walls) d.poly("WALLS", w.pts, true);

  // the roof slab: top line, bottom line, and the two ends that close it
  const top = section.roof.top;
  const bottom = section.roof.bottom;
  if (top.length >= 2 && bottom.length === top.length) {
    d.poly("ROOF", [...top, ...[...bottom].reverse()], true);
  }

  for (const o of section.beyond) d.poly("HIDDEN", o.pts, true);

  for (const u of section.pileUs) {
    d.line("PILES", [u - PILE_RADIUS_FT, section.gradeY], [u - PILE_RADIUS_FT, -FLOOR_SLAB_FT]);
    d.line("PILES", [u + PILE_RADIUS_FT, section.gradeY], [u + PILE_RADIUS_FT, -FLOOR_SLAB_FT]);
  }

  const tagX = section.uMax + pad * 0.5;
  d.level([section.uMax, section.gradeY], tagX, `GRADE  ${fmtFt(section.gradeY)}`, TX.dim);
  d.level([section.uMax, section.floorY], tagX, `FINISHED FLOOR  ${fmtFt(section.floorY)}`, TX.dim);
  d.level([section.uMax, section.eaveY], tagX, `EAVE  ${fmtFt(section.eaveY)}`, TX.dim);
  d.level([section.uMax, section.ridgeY], tagX, `RIDGE  ${fmtFt(section.ridgeY)}`, TX.dim);

  d.dim(
    [section.uMin, section.floorY],
    [section.uMin, section.floorY + section.clearHeightFt],
    DIM_OFF,
    `CLEAR ${fmtFt(section.clearHeightFt)}`,
    TX.dim,
  );
  d.dim([section.uMin, section.gradeY], [section.uMax, section.gradeY], -DIM_OFF, fmtFt(section.uMax - section.uMin), TX.dim);
  return d;
}

/* --------------------------------------------------------------- schedule */

interface Column {
  head: string;
  width: number;
  value: (r: ScheduleRow) => string;
  centre?: boolean;
}

const SCHEDULE_COLUMNS: readonly Column[] = [
  { head: "MARK", width: 4, value: (r) => r.mark, centre: true },
  { head: "TYPE", width: 24, value: (r) => r.type },
  { head: "WIDTH", width: 6, value: (r) => fmtFt(r.widthFt), centre: true },
  { head: "HEIGHT", width: 6, value: (r) => fmtFt(r.heightFt), centre: true },
  { head: "QTY", width: 3.5, value: (r) => String(r.qty), centre: true },
  { head: "R.O. W", width: 7, value: (r) => fmtFtFrac(r.roWidthFt), centre: true },
  { head: "R.O. H", width: 7, value: (r) => fmtFtFrac(r.roHeightFt), centre: true },
  { head: "SILL", width: 6, value: (r) => fmtFt(r.sillFt), centre: true },
  { head: "HEAD", width: 6, value: (r) => fmtFt(r.headFt), centre: true },
  { head: "LOCATION", width: 24, value: (r) => r.locations.join("; ") },
];

function drawSchedule(model: HomeModel, rows: readonly ScheduleRow[]): Draft {
  const d = new Draft("WINDOW AND DOOR SCHEDULE");
  const total = SCHEDULE_COLUMNS.reduce((s, c) => s + c.width, 0);
  const rowH = 1.15;
  const th = 0.45;
  const n = rows.length;
  const topY = 0;
  const headY = topY - rowH;

  const cell = (col: number): number =>
    SCHEDULE_COLUMNS.slice(0, col).reduce((s, c) => s + c.width, 0);

  // header
  for (let i = 0; i < SCHEDULE_COLUMNS.length; i++) {
    const x = cell(i);
    d.text("TEXT", [x + 0.3, headY + rowH * 0.35], th, SCHEDULE_COLUMNS[i].head);
    d.line("GRID", [x, topY], [x, headY - n * rowH]);
  }
  d.line("GRID", [total, topY], [total, headY - n * rowH]);
  d.line("WALLS", [0, topY], [total, topY]);
  d.line("WALLS", [0, headY], [total, headY]);

  rows.forEach((r, ri) => {
    const y = headY - ri * rowH;
    for (let i = 0; i < SCHEDULE_COLUMNS.length; i++) {
      const c = SCHEDULE_COLUMNS[i];
      const x = cell(i);
      const value = c.value(r);
      if (c.centre) {
        d.text("TEXT", [x + c.width / 2, y - rowH * 0.65], th, value, { hAlign: 1 });
      } else {
        d.text("TEXT", [x + 0.3, y - rowH * 0.65], th, value);
      }
    }
    d.line("GRID", [0, y - rowH], [total, y - rowH]);
  });

  const footY = headY - n * rowH - rowH;
  d.text("TEXT", [0, footY], th, `TOTAL GLAZED AND DOOR AREA ${sqFt(rows.reduce((s, r) => s + r.areaSqFt, 0))}`);
  d.text(
    "TEXT",
    [0, footY - rowH * 0.9],
    th,
    `FENESTRATION AND DOOR TO GROSS WALL AREA ${fmtG(pyRound(modelFdwr(model) * 100, 1))}%  —  GROSS WALL AREA IS PERIMETER x HEIGHT, NO DEDUCTIONS`,
  );
  d.text(
    "TEXT",
    [0, footY - rowH * 1.8],
    th,
    "ROUGH OPENINGS INCLUDE 3/4\" ON WIDTH AND 1/2\" ON HEIGHT. CONFIRM WITH THE SUPPLIER BEFORE FRAMING.",
  );
  return d;
}

/* ------------------------------------------------------------ notes block */

function drawNotes(model: HomeModel, spec: HomeSpec, dateISO: string | undefined, unitLabel: string): Draft {
  const d = new Draft(`${spec.name.toUpperCase()} — GENERAL NOTES`);
  const lh = 0.95;
  let y = 0;
  const put = (s: string, h: number = TX.note): void => {
    d.text("TEXT", [0, y], h, s);
    y -= lh;
  };

  put(`PROJECT: ${spec.name}`, TX.label);
  put(`DRAWING UNITS: ${unitLabel.toUpperCase()}. MODEL SPACE IS 1:1 — SET YOUR PLOT SCALE, NOT A DRAWING SCALE.`);
  put(
    `${MATERIAL_NAME[spec.material].toUpperCase()} · ${WALL_THICKNESS_MM[spec.material]} MM WALL (${fmtFt(
      model.wallThicknessFt,
    )}) · R-${fmtG(WALL_R_VALUE[spec.material])} · CLIMATE ZONE ${spec.climateZone}`,
  );
  put(
    `${sqFt(model.totalFloorAreaSqFt)} TOTAL FLOOR · ${sqFt(model.groundFootprintSqFt)} FOOTPRINT · ${sqFt(
      model.glazedAreaSqFt,
    )} GLAZED · TALLEST RIDGE ${fmtFt(model.maxRidgeHeightFt)} · ${totalPiles(model)} PILES`,
  );
  if (dateISO) put(`ISSUED: ${dateISO}`);
  y -= lh * 0.5;

  put("NOT FOR CONSTRUCTION.", TX.label);
  for (const line of wrap(EXPORT_DISCLAIMER, 110)) put(line, TX.small);
  y -= lh * 0.5;

  put("NOT IN THIS FILE:", TX.label);
  for (const gap of PRO_EXPORT_GAPS) {
    for (const line of wrap(gap, 110)) put(`  ${line}`, TX.small);
  }
  y -= lh * 0.5;

  put("LAYERS:", TX.label);
  for (const l of LAYERS) put(`  ${l.name.padEnd(12)} ${l.purpose}`, TX.small);

  if (model.warnings.length > 0) {
    y -= lh * 0.5;
    put(`THE DRAWING MODEL RAISED ${model.warnings.length} ITEM(S):`, TX.label);
    for (const w of model.warnings) {
      for (const line of wrap(w, 110)) put(`  ${line}`, TX.small);
    }
  }
  return d;
}

/* --------------------------------------------------------------- assembly */

/** The views a DXF can carry, in the order a set carries them. */
export type DxfView =
  | "notes"
  | "floor-plan"
  | "roof-plan"
  | "foundation-plan"
  | "elevation-n"
  | "elevation-e"
  | "elevation-s"
  | "elevation-w"
  | "section"
  | "schedule";

export const DXF_VIEWS: readonly DxfView[] = [
  "notes",
  "floor-plan",
  "roof-plan",
  "foundation-plan",
  "elevation-n",
  "elevation-e",
  "elevation-s",
  "elevation-w",
  "section",
  "schedule",
];

export interface DxfOptions {
  /** `"feet"` (default) matches the HomeSpec, the drawings and every
   *  dimension string on them. `"metres"` scales the geometry by exactly
   *  0.3048 and re-stamps `$INSUNITS`; the lettering still reads in feet and
   *  inches, because that is what the dimension is. */
  units?: "feet" | "metres";
  /** Which views to write. Default: all of them. */
  views?: readonly DxfView[];
  /** ISO date for the notes block. Optional, and a PARAMETER — this module
   *  never reads a clock. */
  dateISO?: string;
  /** Gap between views in model space, feet. Default 18. */
  gapFt?: number;
}

/** How many views sit on a row before the layout wraps. */
const LAYOUT_COLUMNS = 3;

/**
 * Every requested view, laid out side by side in model space.
 *
 * WHY MODEL SPACE AND NOT PAPER SPACE. A DXF layout (paper space) needs the
 * R13+ BLOCK_RECORD and LAYOUT object machinery this R12 writer deliberately
 * does not have, and a receiving drafter re-sets the sheet anyway. What they
 * actually want is the geometry at full size, on named layers, in one file
 * they can XREF or copy out of. That is what this produces.
 */
export function homeToDxf(spec: HomeSpec, options: DxfOptions = {}): string {
  const model = buildHomeModel(spec);
  const section = sectionOf(model);
  const elevations = allElevations(model);
  const rows = openingSchedule(model);
  const units = options.units ?? "feet";
  const wanted = options.views ?? DXF_VIEWS;
  const gap = options.gapFt ?? 18;

  const build = (view: DxfView): Draft | null => {
    switch (view) {
      case "notes":
        return drawNotes(model, spec, options.dateISO, units);
      case "floor-plan":
        return drawFloorPlan(model, section);
      case "roof-plan":
        return drawRoofPlan(model);
      case "foundation-plan":
        return drawFoundationPlan(model);
      case "elevation-n":
      case "elevation-e":
      case "elevation-s":
      case "elevation-w": {
        const which = view.slice(-1) as "n" | "e" | "s" | "w";
        const e = elevations.find((x) => x.view === which);
        return e ? drawElevation(model, e) : null;
      }
      case "section":
        return section ? drawSection(section) : null;
      case "schedule":
        return rows.length > 0 ? drawSchedule(model, rows) : null;
    }
  };

  const drafts: Draft[] = [];
  for (const view of wanted) {
    const d = build(view);
    if (d && d.entities.length > 0) drafts.push(d);
  }

  /* Lay the views out on a grid. Each cell is sized to the widest and tallest
     view in its column and row, so nothing overlaps regardless of how big a
     particular home makes a particular view. Rows run DOWNWARD from y = 0,
     which is what a reader gets when they ZOOM EXTENTS. */
  const boxes = drafts.map((d) => bboxOf(d.entities));
  const colWidths: number[] = [];
  const rowHeights: number[] = [];
  drafts.forEach((_, i) => {
    const col = i % LAYOUT_COLUMNS;
    const row = Math.floor(i / LAYOUT_COLUMNS);
    const b = boxes[i];
    colWidths[col] = Math.max(colWidths[col] ?? 0, b.maxX - b.minX);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, b.maxY - b.minY);
  });

  const titleGap = TX.title * 2.4;
  const entities: DxfEntity[] = [];
  drafts.forEach((d, i) => {
    const col = i % LAYOUT_COLUMNS;
    const row = Math.floor(i / LAYOUT_COLUMNS);
    let x = 0;
    for (let c = 0; c < col; c++) x += (colWidths[c] ?? 0) + gap;
    let y = 0;
    for (let r = 0; r < row; r++) y -= (rowHeights[r] ?? 0) + gap + titleGap;
    const b = boxes[i];
    const dx = x - b.minX;
    const dy = y - b.maxY;
    entities.push(...translated(d.entities, dx, dy));
    entities.push({
      k: "text",
      layer: "TEXT",
      at: [x, y + titleGap * 0.35],
      height: TX.title,
      value: dxfText(d.title),
      rotationDeg: 0,
      hAlign: 0,
      vAlign: 0,
    });
  });

  const final = units === "metres" ? scaled(entities, FEET_TO_METRES) : entities;
  // $INSUNITS: 2 = feet, 6 = metres
  return dxfDocument(final, units === "metres" ? 6 : 2);
}

/** The DXF as a downloadable artifact. */
export function exportDxf(spec: HomeSpec, options: DxfOptions = {}): ExportArtifact {
  const text = homeToDxf(spec, options);
  const model = buildHomeModel(spec);
  const units = options.units ?? "feet";
  const views = (options.views ?? DXF_VIEWS).length;
  const blob = new Blob([text], { type: "application/dxf" });
  return {
    blob,
    filename: exportFilename(spec, "dxf"),
    mimeType: "application/dxf",
    byteLength: blob.size,
    note:
      `AutoCAD R12 ASCII · ${views} views in model space at 1:1 in ${units} · ` +
      `${LAYERS.length} layers · ${model.volumes.length} volume${model.volumes.length === 1 ? "" : "s"} · ` +
      `R12 is the DXF version with the widest reader support`,
  };
}

/* ===========================================================================
   ============================  PART TWO: IFC4  =============================
   ===========================================================================

   WHY NOT web-ifc, STATED PLAINLY SO NOBODY HAS TO RE-DERIVE IT
   -------------------------------------------------------------
   `exportSpec.ts` already researched web-ifc and reached the right answer for
   the wrong reason. Its numbers are correct and stand: web-ifc@0.0.77 is
   MPL-2.0 (NOT MIT — file-level copyleft, unmodified use is fine but a NOTICE
   entry is mandatory), 391 kB gzipped of JS plus a 1.3 MB WASM, roughly
   0.9-1.0 MB over the wire. Its own conclusion is the one that matters here:

       "npm i does not produce an IFC file. Authoring one means building the
        entity graph by hand."

   That is exactly right, and it is the whole argument. If the entity graph has
   to be authored by hand either way, then the ONLY thing web-ifc contributes
   to the write path is turning that graph into text — and the text format is
   ISO 10303-21, a documented ASCII grammar of `#42=IFCWALL(...);` lines. We
   would be paying ~1 MB of WASM and taking on an MPL-2.0 obligation for a
   string concatenation.

   So: no dependency. The graph below is authored directly and serialised
   directly, the file is plain IFC4 SPF, and the repo's licence surface does
   not change. `docs/CREDITS.md` needs no new entry, which is the cleanest
   possible outcome for an MIT repo.

   WHEN WOULD web-ifc EARN ITS PLACE. Reading. The moment we want to IMPORT a
   designer's corrected IFC back into the builder, hand-parsing STEP stops
   being sensible and web-ifc is the right tool — and at that point the
   MPL-2.0 NOTICE entry gets added and the WASM gets served from our own
   origin, never a CDN. Writing does not need it. Reading will.

   WHAT THIS FILE AUTHORS
   ----------------------
     IfcProject
       IfcSite
         IfcBuilding
           IfcBuildingStorey                       (one, at finished floor)
             IfcWallStandardCase  + IfcMaterialLayerSetUsage   (level-topped)
             IfcWall              + IfcMaterialLayerSet        (gable ends)
               IfcOpeningElement  via IfcRelVoidsElement
                 IfcWindow / IfcDoor via IfcRelFillsElement
             IfcWall (.PARAPET.)                   (flat roofs only)
             IfcSlab (.FLOOR.)                     (the floor deck, and the deck)
             IfcRoof -> IfcSlab (.ROOF.)           (one slab per roof plane)
             IfcPile                               (the exposed screw piles)
             IfcBuildingElementProxy               (the hot tub)

   THE ONE MODELLING DECISION WORTH ARGUING WITH. `IfcWallStandardCase` is only
   used where the wall genuinely IS a standard case — a constant-thickness plan
   profile swept vertically. A gable end is not that, and IFC4 says so: a wall
   whose body is not a vertical sweep of its plan profile must be `IfcWall`.
   Filing a gable end as a standard case to make the export look tidier would
   put a wall in the model whose material layer set usage does not describe its
   geometry, and every downstream quantity take-off would inherit the lie.

   COORDINATES. The model is (+X east, +Y up, +Z south) in feet. IFC is
   (+X east, +Y north, +Z up) in metres. The map is
   `(x, y, z) -> (x, -z, y) x 0.3048`, a proper rotation with determinant +1,
   so it preserves handedness and every cross product in the geometry below
   still means what it meant. It lives in `ifcXY` and `ifcM` and nowhere else.
   =========================================================================== */

/** Feet to metres, for a length. The one conversion, from `exportSpec.ts`. */
const ifcM = (ft: number): number => ft * FEET_TO_METRES;

/** A world plan point (model x, z) as IFC world (X, Y) in metres. */
const ifcXY = (p: Pt): Pt => [ifcM(p[0]), ifcM(-p[1])];

/* ------------------------------------------------- the STEP physical file */

/**
 * A STEP writer. Instances are numbered `#1`, `#2`, ... in creation order, so
 * the same spec always produces the same file byte for byte.
 */
class Step {
  private readonly lines: string[] = [];
  private next = 1;

  add(type: string, args: readonly string[]): string {
    const id = this.next++;
    this.lines.push(`#${id}=${type}(${args.join(",")});`);
    return `#${id}`;
  }

  get body(): string {
    return this.lines.join("\n");
  }

  get count(): number {
    return this.next - 1;
  }
}

/** A STEP string literal, ISO 10303-21 encoded.
 *
 *  Single quotes double; backslashes double; anything outside printable ASCII
 *  goes through `\X2\....\X0\`, which is the standard's own UTF-16BE escape and
 *  is what lets somebody name their home in a language with accents without
 *  writing bytes into a file that declares no encoding. */
function S(raw: string): string {
  let out = "'";
  let pending: string[] = [];
  const flush = (): void => {
    if (pending.length === 0) return;
    out += `\\X2\\${pending.join("")}\\X0\\`;
    pending = [];
  };
  for (const ch of raw.replace(/[\r\n\t]/g, " ")) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x20 && code <= 0x7e) {
      flush();
      out += ch === "'" ? "''" : ch === "\\" ? "\\\\" : ch;
    } else {
      // surrogate pairs are already two UTF-16 units in the JS string
      for (let i = 0; i < ch.length; i++) {
        pending.push(ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0"));
      }
    }
  }
  flush();
  return `${out}'`;
}

/** A STEP real. Must always carry a decimal point, and must never come out in
 *  a notation a strict parser has not been asked to accept. */
function R(v: number): string {
  if (!Number.isFinite(v)) return "0.";
  const n = Math.abs(v) < 1e-9 ? 0 : v;
  // "2.000000000" -> "2." and "0.500000000" -> "0.5". Both are valid STEP
  // reals; what is NOT valid is an integer without a decimal point, and the
  // strip can never remove the point because the point stops the run.
  return n.toFixed(9).replace(/0+$/, "");
}

const I = (v: number): string => String(Math.trunc(Number.isFinite(v) ? v : 0));
const E = (name: string): string => `.${name}.`;
const L = (refs: readonly string[]): string => `(${refs.join(",")})`;
const NUL = "$";
const DERIVED = "*";

/* ------------------------------------------------------------ IFC GlobalId */

const GUID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";

/**
 * A 22-character IFC GlobalId, derived from a STABLE semantic key.
 *
 * Two properties matter and both come from being a hash rather than a random
 * draw. It is deterministic, so a re-export is byte-identical. And the key is
 * semantic ("wall:main:n"), so the SAME wall keeps the SAME GlobalId across
 * edits and exports — which is the only thing that makes a BIM diff between
 * two versions of a home mean anything. A random GUID would make every export
 * look like an entirely new building.
 *
 * 128 bits are produced by four independently-seeded FNV-1a passes with a
 * final avalanche, then packed as the IFC compressed GUID: two bits in the
 * first character, then twenty-one characters of six bits.
 */
function ifcGuidFromKey(key: string): string {
  const bytes = new Uint8Array(16);
  for (let lane = 0; lane < 4; lane++) {
    let h = (0x811c9dc5 ^ Math.imul(lane + 1, 0x9e3779b1)) >>> 0;
    for (let i = 0; i < key.length; i++) {
      const c = key.charCodeAt(i);
      h = Math.imul(h ^ (c & 0xff), 0x01000193) >>> 0;
      h = Math.imul(h ^ (c >>> 8), 0x01000193) >>> 0;
    }
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    bytes[lane * 4] = (h >>> 24) & 0xff;
    bytes[lane * 4 + 1] = (h >>> 16) & 0xff;
    bytes[lane * 4 + 2] = (h >>> 8) & 0xff;
    bytes[lane * 4 + 3] = h & 0xff;
  }
  let out = GUID_CHARS[bytes[0] >>> 6];
  let bit = 2;
  for (let i = 0; i < 21; i++) {
    let v = 0;
    for (let b = 0; b < 6; b++) {
      v = (v << 1) | ((bytes[bit >> 3] >>> (7 - (bit & 7))) & 1);
      bit++;
    }
    out += GUID_CHARS[v];
  }
  return out;
}

/** Guarantees no two entities in one file share a GlobalId, even if a caller
 *  manages to hand the same key twice. */
class GuidPool {
  private readonly used = new Set<string>();

  take(key: string): string {
    let k = key;
    let guid = ifcGuidFromKey(k);
    let salt = 0;
    while (this.used.has(guid)) {
      salt += 1;
      k = `${key}#${salt}`;
      guid = ifcGuidFromKey(k);
    }
    this.used.add(guid);
    return `'${guid}'`;
  }
}

/* --------------------------------------------------------------- options */

export interface IfcOptions {
  /**
   * ISO-8601 date or date-time for the file header and the owner history.
   *
   * REQUIRED, and a parameter rather than a clock, for the same reason the
   * drawing set takes one: the format has a mandatory timestamp field and this
   * module must still be deterministic. Pass the same date and get the same
   * bytes.
   */
  dateISO: string;
  /** Name written into `FILE_NAME` and `IfcPerson`. Default "Aura Homes owner". */
  authorName?: string;
  /** Organisation written into `FILE_NAME` and `IfcOrganization`. */
  organisationName?: string;
  /** Write the screw piles as `IfcPile`. Default true. */
  includePiles?: boolean;
  /** Write the deck and hot tub. Default true. */
  includeDeck?: boolean;
  /**
   * The owner's comfort targets and the design conditions behind them —
   * `lib/builder/comfort.ts`'s report.
   *
   * OMITTED derives the defaults from the spec, so a caller that has never
   * heard of comfort still writes the intent baseline into the file. `null`
   * writes no comfort at all, which is the only way back to the pre-comfort
   * file byte for byte.
   */
  comfort?: ComfortReport | null;
}

/* --------------------------------------------------- geometry scratchpad */

/** Everything a wall needs so an opening can be placed in its own frame.
 *
 *  Two frames, because there are two kinds of wall — see the modelling note in
 *  this part's header. `u` runs along the wall from its run-0 end; `v` is
 *  height above finished floor; `w` is through the wall measured from the
 *  OUTER face. Every box drawn in a wall is expressed in those three, and
 *  `wallBoxSolid` is the only place that knows how they map into each frame. */
interface WallFrameRec {
  kind: "level" | "gable";
  runFt: number;
  thicknessFt: number;
  /** `#n` of the wall's IfcLocalPlacement */
  placement: string;
}

/* ------------------------------------------------------------ the author */

/**
 * The whole IFC4 file, as text.
 *
 * Total: a spec with no volumes produces a valid, openable file containing a
 * project, a site, a building and an empty storey — which is a truthful
 * answer, and better than a parse error.
 */
export function homeToIfc(spec: HomeSpec, options: IfcOptions): string {
  const model = buildHomeModel(spec);
  const s = new Step();
  const guids = new GuidPool();
  const includePiles = options.includePiles ?? true;
  const includeDeck = options.includeDeck ?? true;
  const comfort =
    options.comfort === undefined ? comfortReport(spec, DEFAULT_SETTINGS) : options.comfort;

  /* ---- the timestamp, derived from the parameter and never from a clock */
  const parsed = Date.parse(options.dateISO);
  const epochSeconds = Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
  const stamp = new Date(epochSeconds * 1000).toISOString().slice(0, 19);

  const authorName = options.authorName ?? "Aura Homes owner";
  const orgName = options.organisationName ?? "Aura Homes";

  /* ---- ownership ---------------------------------------------------- */
  const person = s.add("IFCPERSON", [NUL, S(authorName), NUL, NUL, NUL, NUL, NUL, NUL]);
  const org = s.add("IFCORGANIZATION", [NUL, S(orgName), NUL, NUL, NUL]);
  const personAndOrg = s.add("IFCPERSONANDORGANIZATION", [person, org, NUL]);
  const appDeveloper = s.add("IFCORGANIZATION", [NUL, S("Aura Homes"), NUL, NUL, NUL]);
  const application = s.add("IFCAPPLICATION", [
    appDeveloper,
    S("1.0"),
    S("Aura Homes builder"),
    S("AuraHomesBuilder"),
  ]);
  const owner = s.add("IFCOWNERHISTORY", [
    personAndOrg,
    application,
    NUL,
    E("ADDED"),
    NUL,
    NUL,
    NUL,
    I(epochSeconds),
  ]);

  /* ---- units --------------------------------------------------------- */
  const unitM = s.add("IFCSIUNIT", [DERIVED, E("LENGTHUNIT"), NUL, E("METRE")]);
  const unitM2 = s.add("IFCSIUNIT", [DERIVED, E("AREAUNIT"), NUL, E("SQUARE_METRE")]);
  const unitM3 = s.add("IFCSIUNIT", [DERIVED, E("VOLUMEUNIT"), NUL, E("CUBIC_METRE")]);
  const unitRad = s.add("IFCSIUNIT", [DERIVED, E("PLANEANGLEUNIT"), NUL, E("RADIAN")]);
  /* Declared rather than left to the default, and the reason is not tidiness:
     IFC's default thermodynamic temperature unit is the KELVIN, so a
     Pset_SpaceThermalRequirements value of 21 in a file that never says
     otherwise means 21 K. DEGREE_CELSIUS is an IfcSIUnitName, so the owner's
     own numbers travel unconverted. Same story for LUX. */
  const unitC = s.add("IFCSIUNIT", [DERIVED, E("THERMODYNAMICTEMPERATUREUNIT"), NUL, E("DEGREE_CELSIUS")]);
  const unitLux = s.add("IFCSIUNIT", [DERIVED, E("ILLUMINANCEUNIT"), NUL, E("LUX")]);
  const units = s.add("IFCUNITASSIGNMENT", [
    L([unitM, unitM2, unitM3, unitRad, unitC, unitLux]),
  ]);

  /* ---- representation contexts --------------------------------------- */
  const originPt = s.add("IFCCARTESIANPOINT", [L([R(0), R(0), R(0)])]);
  const dirZ = s.add("IFCDIRECTION", [L([R(0), R(0), R(1)])]);
  const dirX = s.add("IFCDIRECTION", [L([R(1), R(0), R(0)])]);
  const worldAxes = s.add("IFCAXIS2PLACEMENT3D", [originPt, dirZ, dirX]);
  /* TRUE NORTH IS NOT A GUESS HERE. The map from the model frame puts +Y on
     north exactly, so the direction is (0, 1) and it is worth writing rather
     than leaving null — an energy model or a shading study reads it. */
  const trueNorth = s.add("IFCDIRECTION", [L([R(0), R(1)])]);
  const ctx = s.add("IFCGEOMETRICREPRESENTATIONCONTEXT", [
    NUL,
    S("Model"),
    I(3),
    R(1e-5),
    worldAxes,
    trueNorth,
  ]);
  const bodyCtx = s.add("IFCGEOMETRICREPRESENTATIONSUBCONTEXT", [
    S("Body"),
    S("Model"),
    DERIVED,
    DERIVED,
    DERIVED,
    DERIVED,
    ctx,
    NUL,
    E("MODEL_VIEW"),
    NUL,
  ]);
  const axisCtx = s.add("IFCGEOMETRICREPRESENTATIONSUBCONTEXT", [
    S("Axis"),
    S("Model"),
    DERIVED,
    DERIVED,
    DERIVED,
    DERIVED,
    ctx,
    NUL,
    E("GRAPH_VIEW"),
    NUL,
  ]);

  /* ---- small geometry helpers, all closing over `s` -------------------- */
  const point3 = (x: number, y: number, z: number): string =>
    s.add("IFCCARTESIANPOINT", [L([R(x), R(y), R(z)])]);
  const point2 = (x: number, y: number): string => s.add("IFCCARTESIANPOINT", [L([R(x), R(y)])]);
  const dir3 = (x: number, y: number, z: number): string =>
    s.add("IFCDIRECTION", [L([R(x), R(y), R(z)])]);

  /** An IfcAxis2Placement3D. `axis` is the local Z, `ref` the local X. */
  const axes3 = (
    at: readonly [number, number, number],
    axis: readonly [number, number, number] | null,
    ref: readonly [number, number, number] | null,
  ): string =>
    s.add("IFCAXIS2PLACEMENT3D", [
      point3(at[0], at[1], at[2]),
      axis ? dir3(axis[0], axis[1], axis[2]) : NUL,
      ref ? dir3(ref[0], ref[1], ref[2]) : NUL,
    ]);

  const axes2 = (at: readonly [number, number]): string =>
    s.add("IFCAXIS2PLACEMENT2D", [point2(at[0], at[1]), NUL]);

  const placement = (relTo: string | null, rel: string): string =>
    s.add("IFCLOCALPLACEMENT", [relTo ?? NUL, rel]);

  /** A rectangle swept along the placement's local +Z. */
  const extrudeRect = (
    profileCentre: readonly [number, number],
    xDim: number,
    yDim: number,
    at: readonly [number, number, number],
    depth: number,
    name: string,
  ): string | null => {
    if (!(xDim > 1e-6) || !(yDim > 1e-6) || !(depth > 1e-6)) return null;
    const profile = s.add("IFCRECTANGLEPROFILEDEF", [
      E("AREA"),
      S(name),
      axes2(profileCentre),
      R(xDim),
      R(yDim),
    ]);
    return s.add("IFCEXTRUDEDAREASOLID", [profile, axes3(at, null, null), dirZ, R(depth)]);
  };

  /** An arbitrary closed profile swept along the placement's local +Z. */
  const extrudePolygon = (
    ring: readonly Pt[],
    at: readonly [number, number, number],
    depth: number,
    name: string,
  ): string | null => {
    const cleaned = ccwRing(ring);
    if (cleaned.length < 3 || !(depth > 1e-6)) return null;
    // IfcPolyline used as a closed curve repeats its first point at the end
    const pts = [...cleaned, cleaned[0]].map((p) => point2(p[0], p[1]));
    const line = s.add("IFCPOLYLINE", [L(pts)]);
    const profile = s.add("IFCARBITRARYCLOSEDPROFILEDEF", [E("AREA"), S(name), line]);
    return s.add("IFCEXTRUDEDAREASOLID", [profile, axes3(at, null, null), dirZ, R(depth)]);
  };

  const bodyShape = (solids: readonly string[]): string => {
    const rep = s.add("IFCSHAPEREPRESENTATION", [bodyCtx, S("Body"), S("SweptSolid"), L(solids)]);
    return s.add("IFCPRODUCTDEFINITIONSHAPE", [NUL, NUL, L([rep])]);
  };

  const bodyAndAxisShape = (solids: readonly string[], axisLine: string): string => {
    const axisRep = s.add("IFCSHAPEREPRESENTATION", [axisCtx, S("Axis"), S("Curve2D"), L([axisLine])]);
    const bodyRep = s.add("IFCSHAPEREPRESENTATION", [bodyCtx, S("Body"), S("SweptSolid"), L(solids)]);
    return s.add("IFCPRODUCTDEFINITIONSHAPE", [NUL, NUL, L([axisRep, bodyRep])]);
  };

  /* ---- spatial structure ---------------------------------------------- */
  const sitePlacement = placement(null, worldAxes);
  const project = s.add("IFCPROJECT", [
    guids.take("project"),
    owner,
    S(spec.name),
    S(EXPORT_DISCLAIMER),
    NUL,
    NUL,
    NUL,
    L([ctx]),
    units,
  ]);

  const site = s.add("IFCSITE", [
    guids.take("site"),
    owner,
    S("Site"),
    S("No parcel was supplied with this model: there are no property lines, no setbacks, no survey datum and no grades in this file."),
    NUL,
    sitePlacement,
    NUL,
    NUL,
    E("ELEMENT"),
    NUL,
    NUL,
    NUL,
    NUL,
    NUL,
  ]);

  const buildingPlacement = placement(sitePlacement, worldAxes);
  const building = s.add("IFCBUILDING", [
    guids.take("building"),
    owner,
    S(spec.name),
    NUL,
    NUL,
    buildingPlacement,
    NUL,
    NUL,
    E("ELEMENT"),
    NUL,
    NUL,
    NUL,
  ]);

  const storeyPlacement = placement(buildingPlacement, worldAxes);
  const storey = s.add("IFCBUILDINGSTOREY", [
    guids.take("storey"),
    owner,
    S("Finished floor"),
    S(
      "One storey. The HomeSpec carries a storey COUNT and a per-storey wall height but no intermediate floor plate, so a two-storey volume is exported as a full-height wall — exactly as the drawing model builds it.",
    ),
    NUL,
    storeyPlacement,
    NUL,
    NUL,
    E("ELEMENT"),
    R(0),
  ]);

  s.add("IFCRELAGGREGATES", [guids.take("agg:project"), owner, NUL, NUL, project, L([site])]);
  s.add("IFCRELAGGREGATES", [guids.take("agg:site"), owner, NUL, NUL, site, L([building])]);
  s.add("IFCRELAGGREGATES", [guids.take("agg:building"), owner, NUL, NUL, building, L([storey])]);

  /* ---- materials, created ON DEMAND -----------------------------------
     Lazily, and that is a correctness requirement rather than tidiness.
     `IfcMaterialLayerSetUsage` inherits `AssociatedTo : SET [1:?] OF
     IfcRelAssociatesMaterial` — an inverse with a MINIMUM of one. A home whose
     every wall is a gable end (any A-frame) has no standard-case wall to
     associate a usage with, so eagerly creating one produces a file that fails
     schema validation on an entity nothing points at. Same for an empty spec.
     Building each definition the first time something asks for it means the
     file contains exactly the materials it uses, and no orphans. */
  let wallMaterialRef: string | null = null;
  const wallMaterial = (): string =>
    (wallMaterialRef ??= s.add("IFCMATERIAL", [
      S(MATERIAL_NAME[spec.material]),
      S(
        `Structural layer only. ${WALL_THICKNESS_MM[spec.material]} mm. Effective assembly R-${fmtG(WALL_R_VALUE[spec.material])} (imperial). Cladding, sheathing, service cavity and finishes are not modelled.`,
      ),
      S("Structural"),
    ]));

  let wallLayerSetRef: string | null = null;
  const wallLayerSet = (): string => {
    if (wallLayerSetRef) return wallLayerSetRef;
    const layer = s.add("IFCMATERIALLAYER", [
      wallMaterial(),
      R(ifcM(model.wallThicknessFt)),
      E("F"),
      S(MATERIAL_NAME[spec.material]),
      NUL,
      S("Structural"),
      NUL,
    ]);
    wallLayerSetRef = s.add("IFCMATERIALLAYERSET", [
      L([layer]),
      S(`${MATERIAL_NAME[spec.material]} — ${WALL_THICKNESS_MM[spec.material]} mm`),
      NUL,
    ]);
    return wallLayerSetRef;
  };

  const wallLayerUsage = (): string =>
    s.add("IFCMATERIALLAYERSETUSAGE", [wallLayerSet(), E("AXIS2"), E("POSITIVE"), R(0), NUL]);

  let timberRef: string | null = null;
  const timberMaterial = (): string =>
    (timberRef ??= s.add("IFCMATERIAL", [S("Timber"), NUL, S("Structural")]));

  let steelRef: string | null = null;
  const steelMaterial = (): string =>
    (steelRef ??= s.add("IFCMATERIAL", [S("Galvanized steel"), NUL, S("Structural")]));

  /* ---- collectors ------------------------------------------------------ */
  const standardWalls: string[] = [];
  const gableWalls: string[] = [];
  const parapets: string[] = [];
  const windows: string[] = [];
  const doors: string[] = [];
  const slabs: string[] = [];
  const roofs: string[] = [];
  const piles: string[] = [];
  const proxies: string[] = [];

  /**
   * A box inside a wall, in the wall's own (u, v, w) frame.
   *
   * The two wall frames differ and this is the ONLY function that knows how.
   * Level wall: local X is the run measured from the wall's CENTRE, local Y
   * runs inward from the outer face, local Z is up. Gable wall: local X is the
   * run measured from its run-0 end, local Y is up, local Z runs OUTWARD from
   * the inner face.
   */
  const wallBoxSolid = (
    f: WallFrameRec,
    uCentreFt: number,
    uSizeFt: number,
    vStartFt: number,
    vSizeFt: number,
    wStartFt: number,
    wSizeFt: number,
    name: string,
  ): string | null => {
    if (f.kind === "level") {
      return extrudeRect(
        [ifcM(uCentreFt - f.runFt / 2), ifcM(wStartFt + wSizeFt / 2)],
        ifcM(uSizeFt),
        ifcM(wSizeFt),
        [0, 0, ifcM(vStartFt)],
        ifcM(vSizeFt),
        name,
      );
    }
    return extrudeRect(
      [ifcM(uCentreFt), ifcM(vStartFt + vSizeFt / 2)],
      ifcM(uSizeFt),
      ifcM(vSizeFt),
      [0, 0, ifcM(f.thicknessFt - wStartFt - wSizeFt)],
      ifcM(wSizeFt),
      name,
    );
  };

  /** The window or door that fills an opening. Pushes onto `windows`/`doors`
   *  so the property-set and containment passes below pick it up. */
  const makeFill = (
    o: WorldOpening,
    w: WorldWall,
    frame: WallFrameRec,
    uCentre: number,
  ): string | null => {
    const isDoor = o.kind === "door";
    /* Glazing sits GLASS_SET_FRACTION of the wall thickness in from the
       outside — the same reveal the 3D model gives it. A door leaf sits nearer
       the outer face, the way an outward-opening exterior door does. */
    const wStart = isDoor
      ? 0.1
      : Math.max(0, w.thicknessFt * GLASS_SET_FRACTION - PANEL_THICKNESS_FT / 2);
    const wSize = Math.min(PANEL_THICKNESS_FT, Math.max(0.02, w.thicknessFt - wStart));
    const solid = wallBoxSolid(
      frame,
      uCentre,
      o.drawnWidthFt,
      o.sillFt,
      o.heightFt,
      wStart,
      wSize,
      isDoor ? "DoorLeaf" : "GlazedUnit",
    );
    if (!solid) return null;
    const shape = bodyShape([solid]);
    const key = `${isDoor ? "door" : "window"}:${o.volumeId}:${o.wall}:${o.id}`;
    const name = `${o.volumeName} — ${WALL_NAME[o.wall]} — ${o.id}`;
    if (isDoor) {
      const product = s.add("IFCDOOR", [
        guids.take(key),
        owner,
        S(name),
        NUL,
        NUL,
        frame.placement,
        shape,
        S(o.id),
        R(ifcM(o.heightFt)),
        R(ifcM(o.drawnWidthFt)),
        E("DOOR"),
        /* The hand of the door is not in the HomeSpec, so OperationType is
           NOTDEFINED rather than a plausible SINGLE_SWING_LEFT. A door that
           swings the wrong way in a BIM model is worse than one that admits
           it does not know. */
        E("NOTDEFINED"),
        NUL,
      ]);
      doors.push(product);
      return product;
    }
    const glazingWall = o.kind === "glazing-wall";
    const product = s.add("IFCWINDOW", [
      guids.take(key),
      owner,
      S(name),
      NUL,
      NUL,
      frame.placement,
      shape,
      S(o.id),
      R(ifcM(o.heightFt)),
      R(ifcM(o.drawnWidthFt)),
      E("WINDOW"),
      glazingWall ? E("USERDEFINED") : E("SINGLE_PANEL"),
      glazingWall ? S(`Glazed screen, mullions at ${fmtFt(MULLION_SPACING_FT)} maximum`) : NUL,
    ]);
    windows.push(product);
    return product;
  };

  /**
   * One IfcSlab per roof plane, to be aggregated under the volume's IfcRoof.
   *
   * A roof plane is a sloped slab, and the exact way to express one is a
   * profile drawn in the VERTICAL plane that contains the fall direction,
   * swept horizontally across the roof. No rotated extrusion vector, no
   * transformation matrix, and the slab's underside is genuinely parallel to
   * its top rather than a vertical offset that thins on the slope.
   *
   * The frame per fall axis, worked out once so no sign is guessed twice:
   *   fall along local X — local X = +X, local Y = up, local Z = −Y, and the
   *     placement sits at the s0 end of the perpendicular run.
   *   fall along local Z (model) — local X = −Y, local Y = up, local Z = −X,
   *     and the placement sits at the s1 end, because the local Z of that
   *     basis runs the other way down the perpendicular.
   * Both give a right-handed basis and a POSITIVE extrusion depth, which is
   * the only pair of facts that has to be true.
   */
  const buildRoofSlabs = (
    roof: RoofSection,
    volumeId: string,
    volumeName: string,
    volPlacement: string,
  ): string[] => {
    const out: string[] = [];
    roof.planes.forEach((plane: RoofPlane, i: number) => {
      const ring = roofPlaneSection(plane, roof.thicknessFt);
      if (!ring) return;
      const depth = Math.abs(plane.s1 - plane.s0);
      if (!(depth > 1e-6)) return;
      const at: [number, number, number] =
        roof.fallAxis === "x" ? [0, ifcM(-plane.s0), 0] : [ifcM(plane.s1), 0, 0];
      const axis: [number, number, number] = roof.fallAxis === "x" ? [0, -1, 0] : [-1, 0, 0];
      const ref: [number, number, number] = roof.fallAxis === "x" ? [1, 0, 0] : [0, -1, 0];
      const solid = extrudePolygon(ring, [0, 0, 0], ifcM(depth), "RoofPlane");
      if (!solid) return;
      out.push(
        s.add("IFCSLAB", [
          guids.take(`slab:roof:${volumeId}:${i}`),
          owner,
          S(`${volumeName} — roof plane ${i + 1}`),
          NUL,
          NUL,
          placement(volPlacement, axes3(at, axis, ref)),
          bodyShape([solid]),
          NUL,
          E("ROOF"),
        ]),
      );
    });
    return out;
  };

  /* ---- one volume at a time ------------------------------------------- */
  for (const vm of model.volumes) {
    const v = vm.volume;
    const yaw = (-v.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const [vx, vy] = ifcXY([v.x, v.z]);
    const volPlacement = placement(storeyPlacement, axes3([vx, vy, 0], [0, 0, 1], [cos, sin, 0]));

    /** A world plan point in this volume's local IFC frame, metres. */
    const toLocal = (p: Pt): Pt => {
      const [wx, wyy] = ifcXY(p);
      const dx = wx - vx;
      const dy = wyy - vy;
      return [cos * dx + sin * dy, -sin * dx + cos * dy];
    };
    /** A world plan DIRECTION in this volume's local IFC frame. */
    const dirToLocal = (p: Pt): Pt => {
      const dx = p[0];
      const dy = -p[1];
      return [cos * dx + sin * dy, -sin * dx + cos * dy];
    };

    /* ---- walls ---- */
    for (const w of vm.walls) {
      if (!w.built) continue;
      const top = w.topProfile;
      if (top.length < 2) continue;
      const level = top.every((p) => Math.abs(p[1] - top[0][1]) < 1e-6);
      const height = level ? top[0][1] : Math.max(...top.map((p) => p[1]));
      if (!(height > 1e-3) || !(w.runFt > 1e-3)) continue;

      const key = `wall:${v.id}:${w.wall}`;
      const name = `${v.name} — ${WALL_NAME[w.wall]} wall`;
      const localA = toLocal(w.a);
      const localB = toLocal(w.b);
      const runLen = Math.hypot(localB[0] - localA[0], localB[1] - localA[1]);
      if (!(runLen > 1e-6)) continue;
      const runDir: Pt = [(localB[0] - localA[0]) / runLen, (localB[1] - localA[1]) / runLen];
      const outDir = dirToLocal(w.normal);

      let frame: WallFrameRec;
      let product: string;

      if (level) {
        const wallPlacement = placement(
          volPlacement,
          axes3(
            [(localA[0] + localB[0]) / 2, (localA[1] + localB[1]) / 2, 0],
            [0, 0, 1],
            [runDir[0], runDir[1], 0],
          ),
        );
        frame = { kind: "level", runFt: w.runFt, thicknessFt: w.thicknessFt, placement: wallPlacement };
        const solid = extrudeRect(
          [0, ifcM(w.thicknessFt) / 2],
          ifcM(w.runFt),
          ifcM(w.thicknessFt),
          [0, 0, 0],
          ifcM(height),
          "Wall",
        );
        const axisLine = s.add("IFCPOLYLINE", [
          L([point2(-ifcM(w.runFt) / 2, 0), point2(ifcM(w.runFt) / 2, 0)]),
        ]);
        product = s.add("IFCWALLSTANDARDCASE", [
          guids.take(key),
          owner,
          S(name),
          NUL,
          NUL,
          wallPlacement,
          solid ? bodyAndAxisShape([solid], axisLine) : NUL,
          S(w.wall.toUpperCase()),
          E("STANDARD"),
        ]);
        standardWalls.push(product);
      } else {
        /* A gable end. The body is the wall's ELEVATION swept through its own
           thickness, which is exact — including the peak — and is why this one
           is not filed as a standard case. */
        const innerLocal = toLocal(w.innerA);
        const wallPlacement = placement(
          volPlacement,
          axes3([innerLocal[0], innerLocal[1], 0], [outDir[0], outDir[1], 0], [runDir[0], runDir[1], 0]),
        );
        frame = { kind: "gable", runFt: w.runFt, thicknessFt: w.thicknessFt, placement: wallPlacement };
        const ring: Pt[] = [
          [0, 0],
          [ifcM(w.runFt), 0],
          ...[...top].reverse().map((p): Pt => [ifcM(p[0]), ifcM(p[1])]),
        ];
        const solid = extrudePolygon(ring, [0, 0, 0], ifcM(w.thicknessFt), "WallElevation");
        product = s.add("IFCWALL", [
          guids.take(key),
          owner,
          S(name),
          S("Gable end — the body is the wall elevation swept through its thickness, so it is not an IfcWallStandardCase."),
          NUL,
          wallPlacement,
          solid ? bodyShape([solid]) : NUL,
          S(w.wall.toUpperCase()),
          E("SOLIDWALL"),
        ]);
        gableWalls.push(product);
      }

      /* ---- openings in this wall ---- */
      for (const o of w.openings) {
        if (!(o.drawnWidthFt > 1e-3) || !(o.heightFt > 1e-3)) continue;
        const eps = 0.05;
        const uCentre = o.drawnOffsetFt + o.drawnWidthFt / 2;
        const voidSolid = wallBoxSolid(
          frame,
          uCentre,
          o.drawnWidthFt,
          o.sillFt,
          o.heightFt,
          -eps,
          w.thicknessFt + 2 * eps,
          "Opening",
        );
        if (!voidSolid) continue;
        const opening = s.add("IFCOPENINGELEMENT", [
          guids.take(`opening:${v.id}:${w.wall}:${o.id}`),
          owner,
          S(`Opening for ${o.id}`),
          NUL,
          NUL,
          frame.placement,
          bodyShape([voidSolid]),
          S(o.id),
          E("OPENING"),
        ]);
        s.add("IFCRELVOIDSELEMENT", [
          guids.take(`voids:${v.id}:${w.wall}:${o.id}`),
          owner,
          NUL,
          NUL,
          product,
          opening,
        ]);

        const fill = makeFill(o, w, frame, uCentre);
        if (fill) {
          s.add("IFCRELFILLSELEMENT", [
            guids.take(`fills:${v.id}:${w.wall}:${o.id}`),
            owner,
            NUL,
            NUL,
            opening,
            fill,
          ]);
        }
      }
    }

    /* ---- the floor deck ---- */
    const floorSolid = extrudeRect(
      [0, 0],
      ifcM(v.widthFt),
      ifcM(v.depthFt),
      [0, 0, ifcM(-FLOOR_SLAB_FT)],
      ifcM(FLOOR_SLAB_FT),
      "FloorDeck",
    );
    if (floorSolid) {
      slabs.push(
        s.add("IFCSLAB", [
          guids.take(`slab:floor:${v.id}`),
          owner,
          S(`${v.name} — floor deck`),
          S("Structural floor deck over an open, pile-supported crawl space. Joists, insulation and finishes are not modelled."),
          NUL,
          placement(volPlacement, axes3([0, 0, 0], null, null)),
          bodyShape([floorSolid]),
          NUL,
          E("FLOOR"),
        ]),
      );
    }

    /* ---- the roof ---- */
    const roofType = IFC_ROOF_TYPE[v.roof.form];
    const roofSlabs = buildRoofSlabs(vm.roof, v.id, v.name, volPlacement);
    const roof = s.add("IFCROOF", [
      guids.take(`roof:${v.id}`),
      owner,
      S(`${v.name} — roof`),
      S(`Pitch ${fmtG(pyRound(v.roof.pitchDeg, 1))} degrees as specified. Roof planes are solid slabs at the assembly thickness; rafters, trusses, sheathing, membrane and flashing are not modelled.`),
      roofType.objectType ? S(roofType.objectType) : NUL,
      placement(volPlacement, axes3([0, 0, 0], null, null)),
      NUL,
      NUL,
      E(roofType.enumValue),
    ]);
    roofs.push(roof);
    if (roofSlabs.length > 0) {
      s.add("IFCRELAGGREGATES", [guids.take(`agg:roof:${v.id}`), owner, NUL, NUL, roof, L(roofSlabs)]);
    }

    /* ---- the parapet, on a flat roof only ----
       Without it the exported building would top out half a foot below the
       `ridgeHeightFt` the whole system reports for a flat roof, and a height
       check against the IFC would quietly disagree with the drawing. */
    const para = vm.roof.parapet;
    if (para) {
      const upstand = para.topY - para.lowY + 0.4;
      const halfX = vm.roof.fallAxis === "x" ? para.halfA : para.halfS;
      const halfZ = vm.roof.fallAxis === "x" ? para.halfS : para.halfA;
      const pt = PARAPET_THICKNESS_FT;
      const sides: { name: string; centre: [number, number]; xDim: number; yDim: number }[] = [
        { name: "north", centre: [0, halfZ - pt / 2], xDim: 2 * halfX, yDim: pt },
        { name: "south", centre: [0, -(halfZ - pt / 2)], xDim: 2 * halfX, yDim: pt },
        { name: "east", centre: [halfX - pt / 2, 0], xDim: pt, yDim: 2 * halfZ - 2 * pt },
        { name: "west", centre: [-(halfX - pt / 2), 0], xDim: pt, yDim: 2 * halfZ - 2 * pt },
      ];
      for (const side of sides) {
        const solid = extrudeRect(
          [ifcM(side.centre[0]), ifcM(side.centre[1])],
          ifcM(side.xDim),
          ifcM(side.yDim),
          [0, 0, ifcM(para.lowY - 0.4)],
          ifcM(upstand),
          "Parapet",
        );
        if (!solid) continue;
        parapets.push(
          s.add("IFCWALL", [
            guids.take(`parapet:${v.id}:${side.name}`),
            owner,
            S(`${v.name} — ${side.name} parapet`),
            NUL,
            NUL,
            placement(volPlacement, axes3([0, 0, 0], null, null)),
            bodyShape([solid]),
            NUL,
            E("PARAPET"),
          ]),
        );
      }
    }

    /* ---- the piles ---- */
    if (includePiles) {
      const length = -FLOOR_SLAB_FT - GRADE_Y_FT;
      vm.piles.points.forEach((p, i) => {
        const local = toLocal(p);
        const profile = s.add("IFCCIRCLEPROFILEDEF", [E("AREA"), S("Pile"), axes2([0, 0]), R(ifcM(PILE_RADIUS_FT))]);
        const solid = s.add("IFCEXTRUDEDAREASOLID", [
          profile,
          axes3([0, 0, ifcM(GRADE_Y_FT)], null, null),
          dirZ,
          R(ifcM(length)),
        ]);
        piles.push(
          s.add("IFCPILE", [
            guids.take(`pile:${v.id}:${i}`),
            owner,
            S(`${v.name} — pile ${i + 1}`),
            S("Exposed length only, from grade to the underside of the floor deck. Embedment depth, helix sizing and capacity are a P.Eng's design and are not modelled."),
            S("Galvanized helical screw pile"),
            placement(volPlacement, axes3([local[0], local[1], 0], null, null)),
            bodyShape([solid]),
            NUL,
            E("USERDEFINED"),
            NUL,
          ]),
        );
      });
    }
  }

  /* ---- the deck and its hot tub ---- */
  if (includeDeck && model.deck) {
    const ring = model.deck.corners.map((p) => ifcXY(p));
    const deckSolid = extrudePolygon(ring, [0, 0, ifcM(-DECK_STEP_FT - DECK_SLAB_FT)], ifcM(DECK_SLAB_FT), "Deck");
    if (deckSolid) {
      slabs.push(
        s.add("IFCSLAB", [
          guids.take("slab:deck"),
          owner,
          S("Deck"),
          S(`Deck surface one step (${fmtFt(DECK_STEP_FT)}) below finished floor. Beams (${fmtFt(DECK_BEAM_FT)}), joists, railings and stairs are not modelled.`),
          NUL,
          placement(storeyPlacement, axes3([0, 0, 0], null, null)),
          bodyShape([deckSolid]),
          NUL,
          E("FLOOR"),
        ]),
      );
    }
    if (model.deck.tub) {
      const [tx, ty] = ifcXY(model.deck.tub);
      const profile = s.add("IFCCIRCLEPROFILEDEF", [E("AREA"), S("HotTub"), axes2([0, 0]), R(ifcM(HOT_TUB_RADIUS_FT))]);
      const solid = s.add("IFCEXTRUDEDAREASOLID", [
        profile,
        axes3([0, 0, ifcM(-DECK_STEP_FT)], null, null),
        dirZ,
        R(ifcM(3.2)),
      ]);
      proxies.push(
        s.add("IFCBUILDINGELEMENTPROXY", [
          guids.take("proxy:hottub"),
          owner,
          S("Wood-fired hot tub"),
          NUL,
          S("Wood-fired cedar hot tub"),
          placement(storeyPlacement, axes3([tx, ty, 0], null, null)),
          bodyShape([solid]),
          NUL,
          E("USERDEFINED"),
        ]),
      );
    }
  }

  /* ---- material associations ------------------------------------------
     IfcWallStandardCase carries a WHERE rule requiring EXACTLY ONE material
     association whose relating material is an IfcMaterialLayerSetUsage. One
     relationship listing every standard wall satisfies it for each of them. */
  const associate = (key: string, objects: readonly string[], material: () => string): void => {
    if (objects.length === 0) return;
    s.add("IFCRELASSOCIATESMATERIAL", [guids.take(key), owner, NUL, NUL, L(objects), material()]);
  };
  associate("mat:standardwalls", standardWalls, wallLayerUsage);
  associate("mat:otherwalls", [...gableWalls, ...parapets], wallLayerSet);
  associate("mat:slabs", [...slabs, ...roofs], timberMaterial);
  associate("mat:piles", piles, steelMaterial);

  /* ---- property sets --------------------------------------------------- */
  const boolProp = (name: string, value: boolean): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [S(name), NUL, `IFCBOOLEAN(${value ? ".T." : ".F."})`, NUL]);
  const textProp = (name: string, value: string): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [S(name), NUL, `IFCTEXT(${S(value)})`, NUL]);
  const labelProp = (name: string, value: string): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [S(name), NUL, `IFCLABEL(${S(value)})`, NUL]);
  const areaProp = (name: string, sqft: number): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [
      S(name),
      NUL,
      `IFCAREAMEASURE(${R(sqft * FEET_TO_METRES * FEET_TO_METRES)})`,
      NUL,
    ]);
  const lengthProp = (name: string, ft: number): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [S(name), NUL, `IFCLENGTHMEASURE(${R(ifcM(ft))})`, NUL]);

  /* The property set is a FACTORY for the same reason the materials are: a
     property set nothing points at is noise in a reviewer's palette, and a
     home with no doors should not ship a Pset_DoorCommon. */
  const attach = (key: string, objects: readonly string[], pset: () => string): void => {
    if (objects.length === 0) return;
    s.add("IFCRELDEFINESBYPROPERTIES", [guids.take(key), owner, NUL, NUL, L(objects), pset()]);
  };

  /* U-value from the assembly's effective imperial R-value. 5.678263 is the
     exact conversion between hr.ft2.degF/Btu and m2.K/W, so this is a unit
     change and not a new claim about the wall. */
  const uValue = 5.678263 / Math.max(1e-6, WALL_R_VALUE[spec.material]);
  const wallPset = (): string =>
    s.add("IFCPROPERTYSET", [
      guids.take("pset:wallcommon"),
      owner,
      S("Pset_WallCommon"),
      NUL,
      L([
        boolProp("IsExternal", true),
        boolProp("LoadBearing", true),
        s.add("IFCPROPERTYSINGLEVALUE", [
          S("ThermalTransmittance"),
          NUL,
          `IFCTHERMALTRANSMITTANCEMEASURE(${R(uValue)})`,
          NUL,
        ]),
        textProp(
          "Reference",
          `${MATERIAL_NAME[spec.material]}, ${WALL_THICKNESS_MM[spec.material]} mm, effective R-${fmtG(WALL_R_VALUE[spec.material])} imperial`,
        ),
      ]),
    ]);
  attach("rel:pset:walls", [...standardWalls, ...gableWalls], wallPset);

  const windowPset = (): string =>
    s.add("IFCPROPERTYSET", [
      guids.take("pset:windowcommon"),
      owner,
      S("Pset_WindowCommon"),
      NUL,
      L([boolProp("IsExternal", true)]),
    ]);
  attach("rel:pset:windows", windows, windowPset);

  const doorPset = (): string =>
    s.add("IFCPROPERTYSET", [
      guids.take("pset:doorcommon"),
      owner,
      S("Pset_DoorCommon"),
      NUL,
      L([boolProp("IsExternal", true)]),
    ]);
  attach("rel:pset:doors", doors, doorPset);

  /* The one property set worth inventing. Everything in it is a number the
     model already owns, so a reviewer can check the export against its source
     instead of measuring the geometry to find out what it claims. */
  const auraPset = (): string =>
    s.add("IFCPROPERTYSET", [
      guids.take("pset:aura"),
      owner,
      S("Aura_HomeSpec"),
      S(
        "The numbers this model was generated from, so a reviewer can check the export against the source rather than measure it.",
      ),
      L([
        labelProp("Generator", "Aura Homes builder"),
        labelProp("Material", MATERIAL_NAME[spec.material]),
        labelProp("ClimateZone", spec.climateZone),
        lengthProp("WallThickness", model.wallThicknessFt),
        labelProp("WallRValueImperial", fmtG(WALL_R_VALUE[spec.material])),
        areaProp("TotalFloorArea", model.totalFloorAreaSqFt),
        areaProp("GroundFootprint", model.groundFootprintSqFt),
        areaProp("GlazedArea", model.glazedAreaSqFt),
        lengthProp("TallestRidgeAboveFinishedFloor", model.maxRidgeHeightFt),
        lengthProp("GradeBelowFinishedFloor", -GRADE_Y_FT),
        labelProp("PileCount", String(totalPiles(model))),
        textProp("Disclaimer", EXPORT_DISCLAIMER),
        textProp("NotModelled", PRO_EXPORT_GAPS.join(" ")),
        textProp(
          "ModelWarnings",
          model.warnings.length > 0
            ? model.warnings.join(" ")
            : "The drawing model raised no warnings for this home.",
        ),
      ]),
    ]);
  attach("rel:pset:aura", [building], auraPset);

  /* ---- comfort: the owner's stated intent, on IfcSpaces -----------------

     THE ONLY SPACES IN THIS FILE, AND THEY CARRY NO GEOMETRY. That is the
     honest shape of the thing rather than a shortcut. A comfort target
     belongs to a ROOM; the rooms come from the deterministic plan engine,
     which solves ONE rectangle sized from total floor area and knows nothing
     about where the modelled volumes are. Giving a solved room a placement
     inside a modelled mass would be a coordinate this tool has not earned,
     and a recipient could quite reasonably build to it.

     `ObjectPlacement` and `Representation` are both OPTIONAL on IfcProduct,
     so leaving them null is the schema's own way of saying "semantic, not
     located" — and the Description on every space says it in words as well,
     because nobody reads a null.

     PROPERTY NAMES follow IFC4's `Pset_SpaceThermalRequirements` and
     `Pset_SpaceLightingRequirements` templates. This build has NOT validated
     those names against a published buildingSMART template or IDS file: a
     name a template does not define is still a legal IfcPropertySingleValue,
     it simply will not land in a receiving tool's built-in field. Everything
     Aura-specific stays in the `Aura_*` sets where it cannot be mistaken for
     a standard property. */
  const tempProp = (name: string, degC: number): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [
      S(name),
      NUL,
      `IFCTHERMODYNAMICTEMPERATUREMEASURE(${R(degC)})`,
      NUL,
    ]);
  const ratioProp = (name: string, ratio: number): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [S(name), NUL, `IFCRATIOMEASURE(${R(ratio)})`, NUL]);
  const illuminanceProp = (name: string, lux: number): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [S(name), NUL, `IFCILLUMINANCEMEASURE(${R(lux)})`, NUL]);
  const realProp = (name: string, value: number): string =>
    s.add("IFCPROPERTYSINGLEVALUE", [S(name), NUL, `IFCREAL(${R(value)})`, NUL]);

  if (comfort && comfort.rooms.length > 0) {
    const comfortSpaces: string[] = [];
    const c = comfort.conditions;

    for (const rc of comfort.rooms) {
      const t = rc.target;
      const space = s.add("IFCSPACE", [
        guids.take(`space:comfort:${rc.room.id}`),
        owner,
        /* Name is the room CODE, LongName the human name — IFC's own intent
           for the two attributes. */
        S(rc.room.id),
        S(
          "A room solved by the Aura plan engine, carried so the owner's comfort targets have a space to hang on. It has NO placement and NO geometry on purpose: the plan engine solves one rectangle sized from total floor area rather than the modelled volumes, so this room's position in the building is unknown and has not been invented.",
        ),
        NUL,
        NUL,
        NUL,
        S(rc.room.name),
        E("ELEMENT"),
        E("SPACE"),
        NUL,
      ]);
      comfortSpaces.push(space);

      attach(`rel:pset:thermal:${rc.room.id}`, [space], () =>
        s.add("IFCPROPERTYSET", [
          guids.take(`pset:thermal:${rc.room.id}`),
          owner,
          S("Pset_SpaceThermalRequirements"),
          S(
            `The owner's stated comfort target for this room. Temperatures are degrees Celsius, declared on the project's unit assignment. Humidity is an IfcRatioMeasure written as a FRACTION — 0.35 is 35 %RH — and repeated as a percentage in Aura_ComfortTarget. ${TARGET_PROVENANCE}`,
          ),
          L([
            tempProp("SpaceTemperatureMin", Math.min(t.winterMinC, t.summerMinC)),
            tempProp("SpaceTemperatureMax", Math.max(t.winterMaxC, t.summerMaxC)),
            tempProp("SpaceTemperatureWinterMin", t.winterMinC),
            tempProp("SpaceTemperatureWinterMax", t.winterMaxC),
            tempProp("SpaceTemperatureSummerMin", t.summerMinC),
            tempProp("SpaceTemperatureSummerMax", t.summerMaxC),
            ratioProp("SpaceHumidityMin", t.humidityMinPct / 100),
            ratioProp("SpaceHumidityMax", t.humidityMaxPct / 100),
          ]),
        ]),
      );

      attach(`rel:pset:lighting:${rc.room.id}`, [space], () =>
        s.add("IFCPROPERTYSET", [
          guids.take(`pset:lighting:${rc.room.id}`),
          owner,
          S("Pset_SpaceLightingRequirements"),
          S(
            "Minimum maintained illuminance the owner is asking of this room, in lux. It is a TARGET only: nothing in this file models daylight, glazing transmittance or a luminaire, so no illuminance has been calculated and none is claimed.",
          ),
          L([illuminanceProp("Illuminance", t.illuminanceMinLux)]),
        ]),
      );

      attach(`rel:pset:comforttarget:${rc.room.id}`, [space], () =>
        s.add("IFCPROPERTYSET", [
          guids.take(`pset:comforttarget:${rc.room.id}`),
          owner,
          S("Aura_ComfortTarget"),
          S("The same target in the units the owner typed, plus where it came from."),
          L([
            labelProp("RoomId", rc.room.id),
            labelProp("RoomName", rc.room.name),
            labelProp("SpaceUse", SPACE_USE_LABEL[rc.room.use]),
            areaProp("SolvedArea", rc.room.areaSqFt),
            realProp("WinterMinC", t.winterMinC),
            realProp("WinterMaxC", t.winterMaxC),
            realProp("SummerMinC", t.summerMinC),
            realProp("SummerMaxC", t.summerMaxC),
            realProp("RelativeHumidityMinPct", t.humidityMinPct),
            realProp("RelativeHumidityMaxPct", t.humidityMaxPct),
            realProp("IlluminanceMinLux", t.illuminanceMinLux),
            boolProp("SetByOwner", !rc.targetIsDefault),
            textProp(
              "Provenance",
              rc.targetIsDefault
                ? TARGET_PROVENANCE
                : "Set by the owner in the Aura builder's Comfort tab.",
            ),
          ]),
        ]),
      );

      attach(`rel:pset:comforteval:${rc.room.id}`, [space], () =>
        s.add("IFCPROPERTYSET", [
          guids.take(`pset:comforteval:${rc.room.id}`),
          owner,
          S("Aura_ComfortEvaluation"),
          S(`${COMFORT_DISCLAIMER} ${SPMV_METHOD_NOTE} ${VAPOUR_UNIT_NOTE}`),
          L([
            realProp("AssumedWinterTemperatureC", c.winterIndoorC),
            realProp("AssumedWinterHumidityPct", c.winterRhPct),
            realProp("AssumedSummerTemperatureC", c.summerIndoorC),
            realProp("AssumedSummerHumidityPct", c.summerRhPct),
            realProp("WinterVapourPressureKPa", rc.winter.terms.vapourKPa),
            realProp("SummerVapourPressureKPa", rc.summer.terms.vapourKPa),
            realProp("WinterSPmv", rc.winter.terms.value),
            realProp("SummerSPmv", rc.summer.terms.value),
            labelProp(
              "WinterVerdict",
              rc.winter.meets === null ? "UNMODELLED" : rc.winter.meets ? "MEETS" : "MISSES",
            ),
            labelProp(
              "SummerVerdict",
              rc.summer.meets === null ? "UNMODELLED" : rc.summer.meets ? "MEETS" : "MISSES",
            ),
            ...(rc.winter.meets === null
              ? []
              : [boolProp("WinterMeetsTarget", rc.winter.meets)]),
            ...(rc.summer.meets === null
              ? []
              : [boolProp("SummerMeetsTarget", rc.summer.meets)]),
            realProp("NeutralBand", NEUTRAL_BAND),
            boolProp("ClothingCaseModelled", rc.modelled),
            textProp(
              "ModelNote",
              rc.modelNote ??
                "Evaluated with the living/active coefficient set, which is the set these coefficients were supplied as.",
            ),
          ]),
        ]),
      );
    }

    /* The spaces decompose the storey, which is IFC's own way of saying a
       space is part of a level. They are deliberately NOT in the
       IfcRelContainedInSpatialStructure below: that relationship is for
       ELEMENTS, and a space is not one. */
    s.add("IFCRELAGGREGATES", [
      guids.take("agg:comfortspaces"),
      owner,
      S("StoreyContainer"),
      NUL,
      storey,
      L(comfortSpaces),
    ]);

    /* One project-level statement, so a reviewer who opens the properties
       palette on the PROJECT rather than on a room still meets the
       disclaimer before the numbers. */
    attach("rel:pset:comfortassumptions", [project], () =>
      s.add("IFCPROPERTYSET", [
        guids.take("pset:comfortassumptions"),
        owner,
        S("Aura_ComfortAssumptions"),
        S(COMFORT_DISCLAIMER),
        L([
          realProp("AssumedWinterTemperatureC", c.winterIndoorC),
          realProp("AssumedWinterHumidityPct", c.winterRhPct),
          realProp("AssumedSummerTemperatureC", c.summerIndoorC),
          realProp("AssumedSummerHumidityPct", c.summerRhPct),
          realProp("SolvedRoomCount", comfort.rooms.length),
          realProp("RoomsModelled", comfort.winter.roomsModelled),
          realProp("RoomsUnmodelled", comfort.winter.roomsUnmodelled),
          realProp("RoomsMeetingWinterTarget", comfort.winter.roomsMeeting),
          realProp("RoomsMeetingSummerTarget", comfort.summer.roomsMeeting),
          realProp("MeanWinterDeviation", comfort.winter.meanAbsDeviation),
          realProp("MeanSummerDeviation", comfort.summer.meanAbsDeviation),
          textProp("Method", SPMV_METHOD_NOTE),
          textProp("VapourPressureUnit", VAPOUR_UNIT_NOTE),
          textProp("TargetProvenance", TARGET_PROVENANCE),
          textProp(
            "SpacesAreUnlocated",
            "The IfcSpaces carrying these targets have no placement and no geometry. They are the plan engine's solved rooms, and that engine solves one rectangle from total floor area rather than the modelled volumes — so their position in the building is unknown and has deliberately not been invented.",
          ),
        ]),
      ]),
    );
  }

  /* ---- containment ----------------------------------------------------- */
  const contained = [
    ...standardWalls,
    ...gableWalls,
    ...parapets,
    ...windows,
    ...doors,
    ...slabs,
    ...roofs,
    ...piles,
    ...proxies,
  ];
  if (contained.length > 0) {
    s.add("IFCRELCONTAINEDINSPATIALSTRUCTURE", [
      guids.take("contained:storey"),
      owner,
      S("Building"),
      NUL,
      L(contained),
      storey,
    ]);
  }

  /* ---- header and assembly --------------------------------------------- */
  const header = [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION((${S("ViewDefinition [CoordinationView]")}),${S("2;1")});`,
    `FILE_NAME(${S(exportFilename(spec, "ifc"))},${S(stamp)},(${S(authorName)}),(${S(orgName)}),` +
      `${S("Aura Homes builder — first-party IFC4 writer, no third-party library")},` +
      `${S("Aura Homes builder")},${S("")});`,
    `FILE_SCHEMA((${S("IFC4")}));`,
    "ENDSEC;",
    "DATA;",
  ].join("\n");

  return `${header}\n${s.body}\nENDSEC;\nEND-ISO-10303-21;\n`;
}

/** The parallelogram a roof plane makes in the (fall, height) plane, in
 *  metres, wound counter-clockwise. The underside is the top surface pushed
 *  one thickness along the plane's DOWNWARD normal — the same sign trap
 *  `drawings/model.ts::planeShape` documents, solved the same way: pick the
 *  normal by its sign, not by its formula. */
function roofPlaneSection(plane: RoofPlane, thicknessFt: number): Pt[] | null {
  const da = plane.a1 - plane.a0;
  const dy = plane.y1 - plane.y0;
  const len = Math.hypot(da, dy);
  if (!(len > 1e-9) || !(thicknessFt > 1e-9)) return null;
  let nA = dy / len;
  let nY = -da / len;
  if (nY > 0) {
    nA = -nA;
    nY = -nY;
  }
  nA *= thicknessFt;
  nY *= thicknessFt;
  const ring: Pt[] = [
    [plane.a0, plane.y0],
    [plane.a1, plane.y1],
    [plane.a1 + nA, plane.y1 + nY],
    [plane.a0 + nA, plane.y0 + nY],
  ];
  return ccwRing(ring.map((p): Pt => [p[0] * FEET_TO_METRES, p[1] * FEET_TO_METRES]));
}

/** A ring, guaranteed counter-clockwise and free of duplicate vertices. IFC
 *  profile outer curves are counter-clockwise by convention, and a duplicated
 *  vertex is what turns a valid profile into a zero-length edge some kernels
 *  refuse to tessellate. */
function ccwRing(ring: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of ring) {
    if (!finitePt(p)) continue;
    const q = out[out.length - 1];
    if (q && Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9) continue;
    out.push([p[0], p[1]]);
  }
  while (
    out.length > 1 &&
    Math.abs(out[0][0] - out[out.length - 1][0]) < 1e-9 &&
    Math.abs(out[0][1] - out[out.length - 1][1]) < 1e-9
  ) {
    out.pop();
  }
  let area = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    const b = out[(i + 1) % out.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area < 0 ? out.reverse() : out;
}

/** The IFC as a downloadable artifact. */
export function exportIfc(spec: HomeSpec, options: IfcOptions): ExportArtifact {
  const text = homeToIfc(spec, options);
  const model = buildHomeModel(spec);
  const blob = new Blob([text], { type: "application/x-step" });
  const openings = model.volumes.reduce(
    (n, vm) => n + vm.walls.reduce((m, w) => m + w.openings.length, 0),
    0,
  );
  return {
    blob,
    filename: exportFilename(spec, "ifc"),
    mimeType: "application/x-step",
    byteLength: blob.size,
    note:
      `IFC4 (ISO 10303-21) · ${model.volumes.length} volume${model.volumes.length === 1 ? "" : "s"} · ` +
      `${openings} opening${openings === 1 ? "" : "s"} as IfcOpeningElement · ` +
      `${WALL_THICKNESS_MM[spec.material]} mm material layer set · ` +
      `IFC4 is the interchange format the BIM authoring tools import`,
  };
}

/* ===========================================================================
   WHAT OPENS WHAT — the honest table, and the answer about ifcJSON
   =========================================================================== */

export interface ProExportFormat {
  id: "dxf" | "ifc";
  label: string;
  extension: string;
  /** What the file is FOR, in one sentence. */
  purpose: string;
  /**
   * Programs that read this FORMAT.
   *
   * READ THIS BEFORE QUOTING IT. This is a fact about the format, not a claim
   * that a file from this module has been opened in any of them. Nobody here
   * has a Revit licence. `verifiedWith` is the list of things that were
   * actually run, and those two lists must never be conflated in UI copy —
   * "opens in AutoCAD" and "we opened it in AutoCAD" are different sentences
   * and only one of them is ours to say.
   */
  opens: readonly string[];
  /** What output from this module has ACTUALLY been checked against, and what
   *  the check was. Everything here was run; nothing here is inferred. */
  verifiedWith: readonly string[];
}

export const PRO_EXPORT_FORMATS: ReadonlyArray<ProExportFormat> = [
  {
    id: "dxf",
    label: "AutoCAD DXF (R12 ASCII)",
    extension: "dxf",
    purpose:
      "The 2D drawings — plan, roof plan, foundation, four elevations, section and the schedule — at full size in model space, on named layers a drafter can turn off.",
    opens: [
      "AutoCAD and AutoCAD LT",
      "BricsCAD",
      "DraftSight",
      "LibreCAD",
      "QCAD",
      "FreeCAD (Draft workbench)",
      "Rhino",
      "SketchUp Pro (import)",
      "Adobe Illustrator and Inkscape",
    ],
    verifiedWith: [
      "ezdxf 1.4.4 — strict `readfile` (no recovery pass) plus `doc.audit()`: 0 errors and 0 repairs on 24 files across 12 home variants, in feet and in metres.",
      "Every entity's layer resolves to a declared LAYER record, and every layer's linetype to a declared LTYPE record.",
      "Dimensional check: the feet-and-inches strings on the sheet match the HomeSpec's own dimensions, and the metres file is exactly 0.3048x the feet file on every coordinate.",
      "A 33-degree volume produces plan wall lines at 33 degrees, not an axis-aligned bounding box.",
    ],
  },
  {
    id: "ifc",
    label: "IFC4 (ISO 16739 / ISO 10303-21)",
    extension: "ifc",
    purpose:
      "The building as a building: walls with a real material layer and thickness, windows and doors sitting in openings that genuinely void their walls, slabs and roofs.",
    opens: [
      "Autodesk Revit",
      "Graphisoft ArchiCAD",
      "Vectorworks",
      "Allplan",
      "Tekla Structures",
      "Blender with the Bonsai (BlenderBIM) add-on",
      "FreeCAD (BIM workbench)",
      "Solibri Office and Solibri Anywhere",
      "BIMcollab ZOOM",
      "usBIM.viewer",
      "Navisworks",
    ],
    verifiedWith: [
      "IfcOpenShell 0.8.5 — `ifcopenshell.validate` reports 0 issues on all 12 home variants, including an empty spec and a name in a non-Latin script.",
      "Its geometry kernel built a shape for EVERY IfcProduct carrying a representation — 41 of 41 on the reference home, 56 of 56 on a two-volume L-plan, 0 failures anywhere.",
      "The openings genuinely void: the same wall meshed with and without opening subtraction differs by exactly the opening volume clipped to the wall thickness, to four decimal places.",
      "The ridge invariant survives the export: the tallest point of the built IFC equals `ridgeHeightFt(v)` to within 2 mm on all five roof forms, one and two storeys, rotated and not.",
      "The material layer thickness in the file equals `WALL_THICKNESS_MM[material]` exactly.",
      "NOT RE-VALIDATED: the comfort IfcSpaces and their property sets were added AFTER that IfcOpenShell run and have not been through it. They are geometry-free IfcSpace entities decomposing the storey, carrying Pset_SpaceThermalRequirements, Pset_SpaceLightingRequirements and two Aura_* sets. Nothing above this line depends on them — every claim about walls, openings, ridges and layer thickness was made against a file whose geometry is unchanged by them.",
    ],
  },
];

/**
 * ifcJSON, since the blueprint prescribes it.
 *
 * The honest answer is that it is not a handoff format today. ifcJSON is a
 * buildingSMART work item with a published schema and a reference converter,
 * and essentially no authoring tool imports it: Revit, ArchiCAD, Vectorworks,
 * Tekla, Solibri and Navisworks all read `.ifc` (STEP) and none of them opens
 * an `.ifcJSON` file. A designer handed one would have to convert it back to
 * STEP first — which means shipping ifcJSON instead of IFC-SPF would be
 * shipping a file that has to be un-shipped before it is useful.
 *
 * It is genuinely better for one thing: reading a model from JavaScript
 * without a STEP parser. That is a case for a FUTURE web viewer of ours, and
 * it is an argument for emitting ifcJSON IN ADDITION when we have one, never
 * INSTEAD. Our JSON export already covers the "machine-readable, our own
 * tools" job, at a fraction of the size, in the schema this builder actually
 * speaks.
 */
export const IFCJSON_POSITION =
  "ifcJSON is a buildingSMART work item, not an interchange format any BIM authoring tool imports today. Revit, ArchiCAD, Vectorworks, Tekla, Solibri and Navisworks all read IFC-SPF (.ifc) and none opens .ifcJSON. Aura exports IFC-SPF for the handoff and its own HomeSpec JSON for machine reading; ifcJSON would be a third file that helps nobody who is not already writing JavaScript.";
