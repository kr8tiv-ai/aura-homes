/* ===========================================================================
   THE ROUND TRIP — read our own DXF back, and say what is actually in it.

   WHY THIS FILE EXISTS.

   "We export DXF" is an assertion. Nothing in the codebase can fail if it is
   false: the writer runs, a Blob appears, a browser downloads it, and the first
   person to find out that the tail was truncated or that half the geometry
   landed on an undeclared layer is the designer the owner paid. Every other
   claim this repo makes is falsifiable — the drawings name the facts they were
   not given, the scale label says "SCALED TO FIT" when nothing on the ladder
   fitted. This one was not, and that is the gap this module closes.

   The claim we are entitled to make once this passes is a different sentence:
   "we export DXF, parse it back with a reader that shares no code with the
   writer, and show you the drawing it produces." That is provable, and
   `components/builder/DxfPreview.tsx` is where a person sees the proof.

   WHAT IT WILL AND WILL NOT DO.

   · It is a READER, not a second writer. It never repairs, never re-emits, and
     never reaches into the exporter. It shares no constant, no type and no
     import with `lib/builder/exportPro.ts` — which is the entire point. Two
     implementations that share a helper agree about that helper's bugs.
   · It parses the DXF FORMAT, not our dialect of it. Everything here is read
     off the R12 group-code spec, so a file from AutoCAD, QCAD or LibreCAD
     parses the same way ours does. That matters: a validator that only
     understands its own output cannot tell "correct" from "self-consistent".
   · It reports. It does not throw. A file so broken that nothing parses comes
     back as a report with `ok: false` and a reason, because a validator that
     dies on bad input is a validator you stop running.

   WHAT COUNTS AS A PROBLEM, AND WHY EACH ONE IS REAL

     unbalanced-section    a SECTION with no ENDSEC, or an ENDSEC with no
                           SECTION. Readers do wildly different things with
                           this — AutoCAD refuses the file, some readers load
                           the fragment silently.
     missing-eof           the last two lines of a DXF are `0` / `EOF`. Their
                           absence is the single most reliable signature of a
                           truncated write, and truncation is the failure mode
                           this whole module was built to catch.
     malformed-group       a group-code line that is not an integer, or a value
                           line missing entirely (an odd number of lines).
     undeclared-layer      an entity whose group 8 names a layer with no row in
                           the LAYER table. Every reader invents a layer for
                           it, each with different defaults, so the drawing
                           looks different in every program that opens it.
     outside-extents       a coordinate outside $EXTMIN/$EXTMAX. ZOOM EXTENTS
                           is the first thing a drafter does on receiving a
                           file, and it would clip whatever falls outside.
     extents-shortfall     the reverse, and the interesting one: the header
                           claims a drawing bigger than the geometry present.
                           A file truncated after the header says exactly this.
     polyline-unterminated a POLYLINE whose VERTEX run never reached SEQEND.

   DETERMINISM. Pure string and arithmetic work. No clock, no randomness, no
   DOM, no Node APIs, no network. The same bytes always produce the same report.
   =========================================================================== */

import type { HomeModel } from "@/lib/builder/drawings";

/* =====================================================================
   TOLERANCE — stated once, and argued for, because a tolerance nobody
   can defend turns a check into a formality
   ===================================================================== */

/**
 * Geometric tolerance, in the drawing's own length unit (feet).
 *
 * THE FLOOR. Our writer emits reals through `toFixed(6)`, so every coordinate
 * carries at most 5e-7 ft of quantisation error and a length built from two of
 * them at most ~1.5e-6 ft. Exported in metres the same six decimals are 5e-7 m
 * = 1.6e-6 ft. So 1e-3 ft sits roughly 600x above the largest error the format
 * itself can introduce: quantisation can never trip this check.
 *
 * THE CEILING. The finest thing this drawing language ever letters is an
 * eighth of an inch — `fmtFtFrac` in `drawings/kit.ts` — which is 0.0104 ft.
 * 1e-3 ft is an order of magnitude below that, so an error large enough to
 * change a printed dimension by even one eighth is caught with room to spare.
 *
 * A tolerance with a floor it cannot reach and a ceiling it comfortably clears
 * is a tolerance that means something. 1e-3 ft is about 1/80 of an inch.
 */
export const TOL_FT = 1e-3;

/**
 * How far a run of TEXT may push the declared extents past the geometry.
 *
 * A DXF TEXT entity stores an insertion point and a height; the WIDTH of the
 * drawn string depends on the font the reader happens to substitute, so every
 * writer that stamps $EXTMAX estimates it. Ours estimates 0.62 em per
 * character. This reader must not assume that number — assuming it would make
 * the check a test of whether two files use the same constant rather than of
 * whether the drawing is intact — so it allows a deliberately generous 1.0 em
 * per character and treats anything beyond that as a shortfall worth naming.
 *
 * The consequence is stated plainly: on the +X and +Y sides the extents check
 * is LOOSE, because it cannot be tight without pretending to know a font. On
 * the -X and -Y sides it is TIGHT, because text advance is strictly positive
 * and nothing legitimately pushes those two outward. Truncation loses the tail
 * of the file, and this writer lays views out rightward and downward, so a
 * truncated file shows up as a shortfall on +X and on -Y — one loose side and
 * one tight one. The tight side is the one that catches it.
 */
const TEXT_ADVANCE_EM = 1.0;

/* =====================================================================
   WHAT COMES BACK
   ===================================================================== */

export type Pt2 = readonly [number, number];

export type ProblemSeverity = "error" | "warning" | "note";

export type ProblemCode =
  | "malformed-group"
  | "unbalanced-section"
  | "unbalanced-table"
  | "missing-eof"
  | "missing-section"
  | "no-entities"
  | "undeclared-layer"
  | "missing-layer-table"
  | "outside-extents"
  | "extents-shortfall"
  | "extents-missing"
  | "polyline-unterminated"
  | "orphan-vertex"
  | "bad-number"
  | "unsupported-entity"
  | "source-ring-missing"
  | "source-count-short"
  | "source-text-missing"
  | "source-extent-short"
  | "units-unknown";

export interface DxfProblem {
  severity: ProblemSeverity;
  code: ProblemCode;
  message: string;
  /** 1-based line in the file, when the problem has a location. */
  line?: number;
}

export interface DxfLayerRow {
  name: string;
  /** AutoCAD Colour Index, or null when the table row omitted group 62. */
  colour: number | null;
  linetype: string | null;
}

export interface DxfLinetypeRow {
  name: string;
  /** Group 49 dash lengths, in DRAWING UNITS: positive is a dash, negative a
   *  gap, zero a dot. Read rather than assumed, so a preview draws the dashes
   *  the file asks for instead of ones it made up. */
  pattern: number[];
}

export interface DxfBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * One entity, as this reader understands it.
 *
 * `points` is the entity's CONTROL points in file order — the two ends of a
 * LINE, the vertices of a polyline, the insertion point of a TEXT, the centre
 * of a circle or arc. It is deliberately not a tessellation: an arc stays an
 * arc, and the renderer decides how finely to draw it.
 */
export interface DxfEntityRead {
  type: string;
  layer: string;
  linetype: string | null;
  points: Pt2[];
  closed: boolean;
  radius: number | null;
  startAngleDeg: number | null;
  endAngleDeg: number | null;
  text: string | null;
  height: number | null;
  rotationDeg: number;
  /** group 72: 0 left, 1 centre, 2 right. */
  hAlign: number;
  /** group 73: 0 baseline, 1 bottom, 2 middle, 3 top. */
  vAlign: number;
  /** 1-based line where this entity's `0` record began. */
  line: number;
  /** False when this reader knows the type by name but does not read its
   *  geometry — so the preview can say what it is not drawing. */
  understood: boolean;
}

export interface DxfReport {
  /** True when nothing of severity "error" was found. */
  ok: boolean;
  problems: DxfProblem[];

  /** $ACADVER, e.g. "AC1009" for R12. */
  acadVer: string | null;
  /** $INSUNITS, when present. 1 inch, 2 feet, 4 mm, 5 cm, 6 m. */
  insUnits: number | null;
  /** How that reads to a person, or "not declared". */
  unitsLabel: string;
  /** Length of one drawing unit in FEET, so every measurement in this report
   *  can be quoted in the unit the model is in. 1 when units are feet. */
  unitFt: number;

  sections: string[];
  layersDeclared: DxfLayerRow[];
  linetypesDeclared: DxfLinetypeRow[];

  entities: DxfEntityRead[];
  countsByType: Record<string, number>;
  countsByLayer: Record<string, number>;
  /** Layers with at least one entity on them. */
  layersUsed: string[];
  /** Declared but never drawn on. Not a fault — named because a plotter pen
   *  table set up for nine layers and handed five is worth knowing about. */
  layersUnused: string[];

  /** $EXTMIN/$EXTMAX as declared in the header. */
  headerExtents: DxfBox | null;
  /** The box this reader measured from the entities it parsed. */
  measuredExtents: DxfBox | null;

  /** Line count and group-pair count, for a truncation eyeball. */
  lineCount: number;
  groupCount: number;

  /** Filled by `compareToSource`; empty until then. */
  sourceChecks: SourceCheck[];
}

/* =====================================================================
   THE PARSER

   DXF is a stream of (group code, value) pairs, one per line, forever. There
   is no nesting punctuation and no escape mechanism: structure is carried
   entirely by group 0 records naming what starts here, which is why a reader
   has to be state-aware rather than a regex.
   ===================================================================== */

/** Entity types this reader reads the geometry of. */
const UNDERSTOOD = new Set(["LINE", "LWPOLYLINE", "POLYLINE", "CIRCLE", "ARC", "TEXT", "POINT"]);

/** Types it knows by name and deliberately does not read. Named rather than
 *  silently ignored, so the preview can tell a user what it is not showing. */
const KNOWN_UNREAD = new Set([
  "MTEXT",
  "INSERT",
  "DIMENSION",
  "LEADER",
  "MULTILEADER",
  "HATCH",
  "SPLINE",
  "ELLIPSE",
  "SOLID",
  "TRACE",
  "3DFACE",
  "3DSOLID",
  "MESH",
  "REGION",
  "XLINE",
  "RAY",
  "ATTDEF",
  "ATTRIB",
  "VIEWPORT",
  "IMAGE",
  "TOLERANCE",
  "BODY",
]);

interface Group {
  code: number;
  value: string;
  /** 1-based line of the CODE line. */
  line: number;
}

/** Split the file into (code, value) pairs, recording where each came from. */
function toGroups(dxf: string, problems: DxfProblem[]): { groups: Group[]; lineCount: number } {
  /* Split on either line ending and drop a single trailing empty line — a DXF
     ends with a terminator, so the final "\r\n" leaves one empty string that is
     not a missing value. */
  const raw = dxf.split(/\r\n|\n|\r/);
  while (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();

  const groups: Group[] = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const codeText = raw[i].trim();
    const line = i + 1;
    if (codeText.length === 0 || !/^-?\d+$/.test(codeText)) {
      problems.push({
        severity: "error",
        code: "malformed-group",
        line,
        message:
          `Line ${line} should be a group code and reads "${clip(raw[i])}". ` +
          `A DXF is strictly alternating code and value lines, so one bad code ` +
          `desynchronises every pair after it.`,
      });
      /* Do NOT try to resynchronise by shifting one line: guessing the phase is
         how a reader turns one error into a thousand. Stop and report. */
      return { groups, lineCount: raw.length };
    }
    groups.push({ code: Number(codeText), value: raw[i + 1], line });
  }
  if (raw.length % 2 === 1) {
    problems.push({
      severity: "error",
      code: "malformed-group",
      line: raw.length,
      message:
        `The file has an odd number of lines (${raw.length}), so the last group code ` +
        `"${clip(raw[raw.length - 1])}" on line ${raw.length} has no value. This is what a write ` +
        `that stopped mid-pair looks like.`,
    });
  }
  return { groups, lineCount: raw.length };
}

const clip = (s: string): string => (s.length <= 40 ? s : `${s.slice(0, 40)}…`);

/** A DXF real. Returns null rather than NaN so a caller must decide. */
function real(v: string): number | null {
  const t = v.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a DXF string. Never throws.
 *
 * @param dxf the file, as text. CRLF or LF, either is fine.
 */
export function parseDxf(dxf: string): DxfReport {
  const problems: DxfProblem[] = [];
  const { groups, lineCount } = toGroups(dxf, problems);

  const sections: string[] = [];
  const layersDeclared: DxfLayerRow[] = [];
  const linetypesDeclared: DxfLinetypeRow[] = [];
  const entities: DxfEntityRead[] = [];

  let acadVer: string | null = null;
  let insUnits: number | null = null;
  /* $EXTMIN and $EXTMAX arrive one axis per group, so each corner is
     accumulated as two independent numbers and assembled only once both have
     been seen. A partially-written extent is not a corner. */
  let extMinX: number | null = null;
  let extMinY: number | null = null;
  let extMaxX: number | null = null;
  let extMaxY: number | null = null;

  let section: string | null = null;
  let sectionDepth = 0;
  let tableDepth = 0;
  let tableName: string | null = null;
  let sawEof = false;
  let sawLayerTable = false;

  /* --- header variable being read, e.g. "$EXTMIN" */
  let headerVar: string | null = null;

  /* --- table row being read */
  let rowType: string | null = null;
  let rowName: string | null = null;
  let rowColour: number | null = null;
  let rowLinetype: string | null = null;
  let rowPattern: number[] = [];

  /* --- entity being read */
  let ent: DxfEntityRead | null = null;
  /** The POLYLINE currently collecting VERTEX records, if any.
   *
   *  Held in a box rather than in a bare `let`. It is written from inside
   *  `closeEntity`, which is a closure, and TypeScript's control-flow analysis
   *  cannot see through a closure assignment: it would narrow the variable to
   *  `null` at the first `= null` and then treat every later read as `never`.
   *  A property read is re-widened by any intervening call, which is exactly
   *  the lifetime this value actually has. */
  const open: { poly: DxfEntityRead | null } = { poly: null };
  /** The VERTEX currently being read into `open.poly`. */
  let vertex: { x: number | null; y: number | null } | null = null;

  const blankEntity = (type: string, line: number): DxfEntityRead => ({
    type,
    layer: "0",
    linetype: null,
    points: [],
    closed: false,
    radius: null,
    startAngleDeg: null,
    endAngleDeg: null,
    text: null,
    height: null,
    rotationDeg: 0,
    hAlign: 0,
    vAlign: 0,
    line,
    understood: UNDERSTOOD.has(type),
  });

  /* Coordinate accumulator. LINE carries two points in interleaved groups
     (10/20 then 11/21), LWPOLYLINE repeats 10/20, TEXT has 10/20 and an
     alignment 11/21 that is not a second geometric point. Rather than a
     per-type state machine, primary (10/20) and secondary (11/21) are collected
     separately and assembled when the entity closes. */
  let p10: { x: number | null; y: number | null } = { x: null, y: null };
  let p11: { x: number | null; y: number | null } = { x: null, y: null };
  let lwPts: Pt2[] = [];
  let lwPendingX: number | null = null;

  const flushVertex = (): void => {
    if (!open.poly || !vertex) return;
    if (vertex.x !== null && vertex.y !== null) open.poly.points.push([vertex.x, vertex.y]);
    vertex = null;
  };

  const closeEntity = (): void => {
    if (!ent) return;
    switch (ent.type) {
      case "LINE":
        if (p10.x !== null && p10.y !== null) ent.points.push([p10.x, p10.y]);
        if (p11.x !== null && p11.y !== null) ent.points.push([p11.x, p11.y]);
        break;
      case "LWPOLYLINE":
        if (lwPendingX !== null) lwPts = lwPts.slice(); // an x with no y is dropped
        ent.points = lwPts;
        break;
      case "POLYLINE":
        /* THE R12 DUMMY POINT, and it is a trap worth naming.
           A POLYLINE header carries a group 10/20/30 of its own, and it is NOT
           a vertex — it is the "elevation" point, and every R12 writer sets it
           to 0,0,0 (ours does). All the real geometry arrives in the VERTEX
           records that follow. Absorbing it costs you two wrong answers at
           once: every ring gains a phantom vertex at the origin, so no closed
           shape ever matches its source; and the measured extents get dragged
           to include an origin the drawing may be nowhere near. Both were
           observed on a known-good export before this case existed. */
        break;
      case "TEXT":
      case "POINT":
      case "CIRCLE":
      case "ARC":
        if (p10.x !== null && p10.y !== null) ent.points.push([p10.x, p10.y]);
        break;
      default:
        if (p10.x !== null && p10.y !== null) ent.points.push([p10.x, p10.y]);
        break;
    }
    /* A POLYLINE keeps collecting until SEQEND, so it is not pushed here. */
    if (ent.type === "POLYLINE") {
      open.poly = ent;
    } else {
      entities.push(ent);
    }
    ent = null;
    p10 = { x: null, y: null };
    p11 = { x: null, y: null };
    lwPts = [];
    lwPendingX = null;
  };

  const closeRow = (): void => {
    if (rowType && rowName !== null) {
      if (rowType === "LAYER") {
        layersDeclared.push({ name: rowName, colour: rowColour, linetype: rowLinetype });
      } else if (rowType === "LTYPE") {
        linetypesDeclared.push({ name: rowName, pattern: rowPattern });
      }
    }
    rowType = null;
    rowName = null;
    rowColour = null;
    rowLinetype = null;
    rowPattern = [];
  };

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];

    if (g.code === 999) continue; // comment

    if (g.code === 0) {
      const v = g.value.trim().toUpperCase();

      /* Finish whatever was open before starting the next thing. Order matters:
         a VERTEX must land in its POLYLINE before a SEQEND closes it. */
      if (v === "VERTEX") {
        closeEntity();
        flushVertex();
        if (!open.poly) {
          problems.push({
            severity: "error",
            code: "orphan-vertex",
            line: g.line,
            message:
              `A VERTEX at line ${g.line} is not inside a POLYLINE. In R12 a VERTEX is only ` +
              `meaningful in the run between a POLYLINE and its SEQEND.`,
          });
        }
        vertex = { x: null, y: null };
        continue;
      }

      if (v === "SEQEND") {
        closeEntity();
        flushVertex();
        if (open.poly) {
          entities.push(open.poly);
          open.poly = null;
        }
        continue;
      }

      // anything else terminates a vertex run and the current entity
      flushVertex();
      closeEntity();
      if (open.poly && v !== "ENDSEC") {
        problems.push({
          severity: "error",
          code: "polyline-unterminated",
          line: g.line,
          message:
            `The POLYLINE that began at line ${open.poly.line} met a "${v}" at line ${g.line} ` +
            `without a SEQEND. Its ${open.poly.points.length} vertices are read, but a reader ` +
            `that is stricter than this one will reject the file.`,
        });
        entities.push(open.poly);
        open.poly = null;
      }
      closeRow();

      switch (v) {
        case "SECTION": {
          const next = groups[gi + 1];
          if (next && next.code === 2) {
            section = next.value.trim().toUpperCase();
            sections.push(section);
            gi += 1;
          } else {
            section = null;
            problems.push({
              severity: "error",
              code: "missing-section",
              line: g.line,
              message: `The SECTION at line ${g.line} is not followed by a group 2 naming it.`,
            });
          }
          sectionDepth += 1;
          headerVar = null;
          continue;
        }
        case "ENDSEC":
          sectionDepth -= 1;
          if (sectionDepth < 0) {
            problems.push({
              severity: "error",
              code: "unbalanced-section",
              line: g.line,
              message: `An ENDSEC at line ${g.line} closes a SECTION that was never opened.`,
            });
            sectionDepth = 0;
          }
          if (open.poly) {
            problems.push({
              severity: "error",
              code: "polyline-unterminated",
              line: g.line,
              message:
                `The POLYLINE that began at line ${open.poly.line} reached ENDSEC without a SEQEND.`,
            });
            entities.push(open.poly);
            open.poly = null;
          }
          section = null;
          headerVar = null;
          continue;
        case "EOF":
          sawEof = true;
          continue;
        case "TABLE": {
          tableDepth += 1;
          const next = groups[gi + 1];
          tableName = next && next.code === 2 ? next.value.trim().toUpperCase() : null;
          if (tableName === "LAYER") sawLayerTable = true;
          continue;
        }
        case "ENDTAB":
          tableDepth -= 1;
          if (tableDepth < 0) {
            problems.push({
              severity: "error",
              code: "unbalanced-table",
              line: g.line,
              message: `An ENDTAB at line ${g.line} closes a TABLE that was never opened.`,
            });
            tableDepth = 0;
          }
          tableName = null;
          continue;
        default:
          break;
      }

      if (section === "TABLES") {
        rowType = v;
        rowName = null;
        rowColour = null;
        rowLinetype = null;
        rowPattern = [];
        continue;
      }

      if (section === "ENTITIES" || section === "BLOCKS") {
        if (!UNDERSTOOD.has(v) && !KNOWN_UNREAD.has(v)) {
          problems.push({
            severity: "note",
            code: "unsupported-entity",
            line: g.line,
            message:
              `A "${v}" entity at line ${g.line} is not a type this reader knows. It is counted ` +
              `but neither measured nor drawn, so the preview is showing you less than the file ` +
              `contains.`,
          });
        }
        ent = blankEntity(v, g.line);
      }
      continue;
    }

    /* ---------------------------------------------------- header variables */
    if (section === "HEADER") {
      if (g.code === 9) {
        headerVar = g.value.trim().toUpperCase();
        continue;
      }
      if (headerVar === "$ACADVER" && g.code === 1) acadVer = g.value.trim();
      if (headerVar === "$INSUNITS" && g.code === 70) insUnits = real(g.value);
      if (headerVar === "$EXTMIN") {
        if (g.code === 10) extMinX = real(g.value);
        if (g.code === 20) extMinY = real(g.value);
      }
      if (headerVar === "$EXTMAX") {
        if (g.code === 10) extMaxX = real(g.value);
        if (g.code === 20) extMaxY = real(g.value);
      }
      continue;
    }

    /* --------------------------------------------------------- table rows */
    if (section === "TABLES" && rowType) {
      if (g.code === 2) rowName = g.value.trim();
      else if (g.code === 62) rowColour = real(g.value);
      else if (g.code === 6) rowLinetype = g.value.trim();
      else if (g.code === 49) {
        const d = real(g.value);
        if (d !== null) rowPattern.push(d);
      }
      continue;
    }

    /* ------------------------------------------------------------ vertices */
    if (vertex) {
      if (g.code === 10) vertex.x = real(g.value);
      else if (g.code === 20) vertex.y = real(g.value);
      continue;
    }

    /* ------------------------------------------------------------ entities */
    if (!ent) continue;

    switch (g.code) {
      case 8:
        ent.layer = g.value.trim();
        break;
      case 6:
        ent.linetype = g.value.trim();
        break;
      case 1:
        ent.text = g.value;
        break;
      case 10:
        if (ent.type === "LWPOLYLINE") {
          const x = real(g.value);
          if (x === null) badNumber(problems, g, ent.type);
          lwPendingX = x;
        } else {
          const x = real(g.value);
          if (x === null) badNumber(problems, g, ent.type);
          p10.x = x;
        }
        break;
      case 20:
        if (ent.type === "LWPOLYLINE") {
          const y = real(g.value);
          if (y === null) badNumber(problems, g, ent.type);
          if (lwPendingX !== null && y !== null) lwPts.push([lwPendingX, y]);
          lwPendingX = null;
        } else {
          const y = real(g.value);
          if (y === null) badNumber(problems, g, ent.type);
          p10.y = y;
        }
        break;
      case 11:
        p11.x = real(g.value);
        break;
      case 21:
        p11.y = real(g.value);
        break;
      case 40:
        // radius on CIRCLE/ARC, text height on TEXT
        if (ent.type === "TEXT") ent.height = real(g.value);
        else ent.radius = real(g.value);
        break;
      case 50:
        if (ent.type === "TEXT") ent.rotationDeg = real(g.value) ?? 0;
        else ent.startAngleDeg = real(g.value);
        break;
      case 51:
        ent.endAngleDeg = real(g.value);
        break;
      case 70:
        // closed flag: bit 1 on both POLYLINE and LWPOLYLINE
        if (ent.type === "POLYLINE" || ent.type === "LWPOLYLINE") {
          ent.closed = ((real(g.value) ?? 0) & 1) === 1;
        }
        break;
      case 72:
        ent.hAlign = real(g.value) ?? 0;
        break;
      case 73:
        ent.vAlign = real(g.value) ?? 0;
        break;
      default:
        break;
    }
  }

  flushVertex();
  closeEntity();
  closeRow();
  if (open.poly) {
    problems.push({
      severity: "error",
      code: "polyline-unterminated",
      line: open.poly.line,
      message:
        `The POLYLINE that began at line ${open.poly.line} reached the end of the file without ` +
        `a SEQEND. This is the signature of a write that stopped part-way.`,
    });
    entities.push(open.poly);
  }

  /* ------------------------------------------------------- structure checks */
  if (sectionDepth > 0) {
    problems.push({
      severity: "error",
      code: "unbalanced-section",
      message:
        `${sectionDepth} SECTION${sectionDepth === 1 ? " was" : "s were"} opened and never closed ` +
        `with an ENDSEC.`,
    });
  }
  if (tableDepth > 0) {
    problems.push({
      severity: "error",
      code: "unbalanced-table",
      message: `${tableDepth} TABLE${tableDepth === 1 ? "" : "s"} opened and never closed with ENDTAB.`,
    });
  }
  if (!sawEof) {
    problems.push({
      severity: "error",
      code: "missing-eof",
      message:
        `The file does not end with the "0 / EOF" terminator every DXF is required to carry. ` +
        `Either the write was truncated or it never finished.`,
    });
  }
  if (!sections.includes("ENTITIES")) {
    problems.push({
      severity: "error",
      code: "missing-section",
      message: `There is no ENTITIES section, so there is no drawing in this file.`,
    });
  }
  if (!sawLayerTable) {
    problems.push({
      severity: "warning",
      code: "missing-layer-table",
      message:
        `There is no LAYER table. Every entity's layer will be invented by whatever reader opens ` +
        `the file, with that reader's own colour and linetype defaults.`,
    });
  }
  if (entities.length === 0) {
    problems.push({
      severity: "error",
      code: "no-entities",
      message: `Not one entity was parsed. Whatever this file is, it is not a drawing.`,
    });
  }

  /* ------------------------------------------------------ layer discipline */
  const declared = new Set(layersDeclared.map((l) => l.name));
  const countsByType: Record<string, number> = {};
  const countsByLayer: Record<string, number> = {};
  const undeclared = new Map<string, number>();
  for (const e of entities) {
    countsByType[e.type] = (countsByType[e.type] ?? 0) + 1;
    countsByLayer[e.layer] = (countsByLayer[e.layer] ?? 0) + 1;
    /* Layer "0" always exists implicitly — it is the one layer a DXF is not
       required to declare, and rejecting it would be pedantry. */
    if (sawLayerTable && e.layer !== "0" && !declared.has(e.layer)) {
      undeclared.set(e.layer, (undeclared.get(e.layer) ?? 0) + 1);
    }
  }
  for (const [name, n] of Array.from(undeclared.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    problems.push({
      severity: "error",
      code: "undeclared-layer",
      message:
        `${n} entit${n === 1 ? "y is" : "ies are"} on layer "${name}", which has no row in the ` +
        `LAYER table. Each reader will invent that layer with its own defaults, so the drawing ` +
        `will not look the same in two programs.`,
    });
  }

  const layersUsed = Object.keys(countsByLayer).sort();
  const layersUnused = layersDeclared
    .map((l) => l.name)
    .filter((n) => !(n in countsByLayer))
    .sort();

  /* ------------------------------------------------------------- extents */
  const measured = measureEntities(entities);
  const headerExtents: DxfBox | null =
    extMinX !== null && extMinY !== null && extMaxX !== null && extMaxY !== null
      ? { minX: extMinX, minY: extMinY, maxX: extMaxX, maxY: extMaxY }
      : null;

  const unitFt = unitToFeet(insUnits);
  const tol = TOL_FT / unitFt; // the tolerance expressed in the file's own unit

  if (!headerExtents) {
    problems.push({
      severity: "warning",
      code: "extents-missing",
      message:
        `The header declares no $EXTMIN/$EXTMAX. The file will still open, but ZOOM EXTENTS has ` +
        `nothing to work from and there is no declared box to check the geometry against.`,
    });
  } else if (measured) {
    /* --- entities outside the declared box. Directional and unforgiving:
       anything outside would be clipped by the first ZOOM EXTENTS a drafter
       does, which is the first thing a drafter does. */
    const outLeft = measured.minX < headerExtents.minX - tol;
    const outDown = measured.minY < headerExtents.minY - tol;
    const outRight = measured.maxX > headerExtents.maxX + tol;
    const outUp = measured.maxY > headerExtents.maxY + tol;
    if (outLeft || outDown || outRight || outUp) {
      const sides = [
        outLeft ? `left by ${fmt(headerExtents.minX - measured.minX)}` : "",
        outDown ? `below by ${fmt(headerExtents.minY - measured.minY)}` : "",
        outRight ? `right by ${fmt(measured.maxX - headerExtents.maxX)}` : "",
        outUp ? `above by ${fmt(measured.maxY - headerExtents.maxY)}` : "",
      ].filter(Boolean);
      problems.push({
        severity: "error",
        code: "outside-extents",
        message:
          `Geometry falls outside the declared $EXTMIN/$EXTMAX — ${sides.join(", ")}. A reader ` +
          `that trusts the header will clip it.`,
      });
    }

    /* --- the reverse: a header claiming more drawing than is present.
       Text advance is strictly positive in both axes for every writer, so
       -X and -Y get the tight tolerance and +X and +Y get the loose one. */
    const shortMinX = measured.minX - headerExtents.minX;
    const shortMinY = measured.minY - headerExtents.minY;
    if (shortMinX > tol || shortMinY > tol) {
      problems.push({
        severity: "error",
        code: "extents-shortfall",
        message:
          `The header declares the drawing starts at (${fmt(headerExtents.minX)}, ` +
          `${fmt(headerExtents.minY)}) and the left-most, bottom-most geometry in the file is at ` +
          `(${fmt(measured.minX)}, ${fmt(measured.minY)}). Nothing legitimately pushes those two ` +
          `sides outward — text advance is positive in both axes — so the entities the header was ` +
          `written from are not all in the file. This is what truncation looks like.`,
      });
    }
    const allowance = textAllowance(entities);
    const overX = headerExtents.maxX - measured.maxX - allowance.x;
    const overY = headerExtents.maxY - measured.maxY - allowance.y;
    if (overX > tol || overY > tol) {
      problems.push({
        severity: "warning",
        code: "extents-shortfall",
        message:
          `The header reaches ${fmt(Math.max(overX, 0))} further right and ${fmt(Math.max(overY, 0))} ` +
          `further up than any geometry does, after allowing a generous ${TEXT_ADVANCE_EM} em per ` +
          `character for text this reader cannot measure. Either a run of text is wider than that ` +
          `allowance or entities are missing from the end of the file.`,
      });
    }
  }

  if (insUnits === null) {
    problems.push({
      severity: "note",
      code: "units-unknown",
      message:
        `The header declares no $INSUNITS. R12 predates the variable, so this is legal — but a ` +
        `reader inserting this file into a metric drawing has nothing to scale by, and a foot ` +
        `taken for a metre is a silent 3.28x error.`,
    });
  }

  const ok = !problems.some((p) => p.severity === "error");

  return {
    ok,
    problems,
    acadVer,
    insUnits,
    unitsLabel: unitsLabelOf(insUnits),
    unitFt,
    sections,
    layersDeclared,
    linetypesDeclared,
    entities,
    countsByType,
    countsByLayer,
    layersUsed,
    layersUnused,
    headerExtents,
    measuredExtents: measured,
    lineCount,
    groupCount: groups.length,
    sourceChecks: [],
  };
}

function badNumber(problems: DxfProblem[], g: Group, type: string): void {
  problems.push({
    severity: "error",
    code: "bad-number",
    line: g.line,
    message:
      `Group ${g.code} on a ${type} at line ${g.line} should be a real number and reads ` +
      `"${clip(g.value)}".`,
  });
}

/** A number for a message. Six decimals is the writer's own precision, and
 *  trailing zeros read as noise in a sentence. */
const fmt = (v: number): string => String(Math.round(v * 1e4) / 1e4);

/** Length of one drawing unit in feet. */
function unitToFeet(insUnits: number | null): number {
  switch (insUnits) {
    case 1:
      return 1 / 12; // inches
    case 2:
      return 1; // feet
    case 4:
      return 0.003280839895013123; // mm
    case 5:
      return 0.03280839895013123; // cm
    case 6:
      return 3.280839895013123; // metres
    default:
      return 1; // undeclared: assume the drawing's own unit, and say so
  }
}

function unitsLabelOf(insUnits: number | null): string {
  switch (insUnits) {
    case 1:
      return "inches";
    case 2:
      return "feet";
    case 4:
      return "millimetres";
    case 5:
      return "centimetres";
    case 6:
      return "metres";
    case null:
      return "not declared";
    default:
      return `$INSUNITS ${insUnits}`;
  }
}

/**
 * The box the parsed entities actually occupy.
 *
 * TEXT contributes its INSERTION POINT only. Its drawn width depends on a font
 * this reader does not have, and inventing one here would make the extents
 * comparison a comparison of two guesses. The allowance for it is applied once,
 * explicitly, in `textAllowance`.
 */
export function measureEntities(entities: readonly DxfEntityRead[]): DxfBox | null {
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
    if (!e.understood) continue;
    if ((e.type === "CIRCLE" || e.type === "ARC") && e.radius !== null && e.points.length > 0) {
      const [cx, cy] = e.points[0];
      /* A full circle's box is centre ± r. An arc's true box is smaller, and
         computing it exactly means solving for the quadrant crossings — which
         would make this reader's box tighter than the writer's and produce a
         shortfall the drawing does not have. Centre ± r for both, deliberately,
         and it errs toward reporting MORE geometry rather than less. */
      eat(cx - e.radius, cy - e.radius);
      eat(cx + e.radius, cy + e.radius);
      continue;
    }
    for (const [x, y] of e.points) eat(x, y);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

/** The most any run of TEXT could push the +X/+Y extents past its insertion
 *  point, at a deliberately generous advance. See `TEXT_ADVANCE_EM`. */
function textAllowance(entities: readonly DxfEntityRead[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const e of entities) {
    if (e.type !== "TEXT" || e.height === null || e.text === null) continue;
    x = Math.max(x, e.text.length * e.height * TEXT_ADVANCE_EM);
    y = Math.max(y, e.height);
  }
  return { x, y };
}

/* =====================================================================
   PART TWO — THE COMPARISON AGAINST THE SOURCE

   Everything above proves the file is well-formed and self-consistent. A
   well-formed file can still be the wrong drawing, or half of the right one,
   and self-consistency cannot tell the difference: a writer that emitted only
   the first view would stamp $EXTMIN/$EXTMAX from that view and pass every
   check above with a clean sheet.

   So the source has to be brought in. `drawingSet()` and any DXF writer in
   this repo both start from `buildHomeModel(spec)` — the model IS what the
   sheets contain, and it is the only thing both renderings share. Comparing
   the DXF against the MODEL therefore compares it against the drawing, without
   this file having to know anything about how either was drawn.

   THE INVARIANT THIS USES. A ring drawn into a DXF has been translated (views
   are laid out on a grid), reflected (plan views map world +Z south to page
   -Y) and possibly scaled by exactly 0.3048 (metres). Edge lengths, perimeter,
   vertex count and absolute area survive all three. So a ring is looked for by
   its SHAPE SIGNATURE rather than by its coordinates, and finding one proves
   the footprint reached the file AT TRUE SIZE — which is the claim a scale bar
   makes and the claim a truncated or mis-scaled export breaks.
   ===================================================================== */

export interface ExpectedRing {
  /** How this ring reads in a report: "Main house — outer wall face". */
  label: string;
  /** The ring, in FEET, any frame. Not closed — the last point joins the
   *  first. */
  pts: readonly Pt2[];
  /** False for a ring only some view selections draw, so a partial export is
   *  reported rather than failed. */
  required: boolean;
}

export interface ExpectedText {
  label: string;
  /** Matched after ASCII folding and case flattening — a DXF writer is
   *  entitled to upper-case a label and to drop a character it cannot encode. */
  value: string;
  required: boolean;
}

export interface ExpectedCount {
  label: string;
  /** Entity type, or null for "any type". */
  type: string | null;
  /** Layer, or null for "any layer". */
  layer: string | null;
  /** The MINIMUM. A drawing may legitimately carry more marks than the model
   *  has things — ticks, arrowheads, a north arrow — but never fewer. */
  atLeast: number;
  why: string;
  /** False for a count only some view selections can satisfy. A floor-plan-only
   *  export has no piles in it and that is not a fault. */
  required: boolean;
}

export interface SourceDrawing {
  label: string;
  rings: ExpectedRing[];
  texts: ExpectedText[];
  counts: ExpectedCount[];
  /** The building's own extent in feet, so a plan at 1:1 can be checked to be
   *  at least that big. Null when the source has no geometry. */
  minSpanFt: { w: number; d: number } | null;
}

export interface SourceCheck {
  label: string;
  pass: boolean;
  detail: string;
  /** False when a miss is reported rather than failed. */
  required: boolean;
}

/* ------------------------------------------------------------ signatures */

interface RingSignature {
  n: number;
  perimeter: number;
  area: number;
  /** Edge lengths, sorted, so the signature does not depend on where the ring
   *  starts or which way round it runs. */
  edges: number[];
}

function ringSignature(pts: readonly Pt2[]): RingSignature | null {
  /* A ring written closed carries its first point again at the end. Dropping
     the repeat makes an explicitly-closed ring and a flag-closed one compare
     equal, which is the whole reason this is a signature and not a diff. */
  const p = pts.slice();
  while (
    p.length > 1 &&
    Math.abs(p[0][0] - p[p.length - 1][0]) < 1e-9 &&
    Math.abs(p[0][1] - p[p.length - 1][1]) < 1e-9
  ) {
    p.pop();
  }
  if (p.length < 3) return null;
  const edges: number[] = [];
  let area2 = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    edges.push(Math.hypot(b[0] - a[0], b[1] - a[1]));
    area2 += a[0] * b[1] - b[0] * a[1];
  }
  return {
    n: p.length,
    perimeter: edges.reduce((s, v) => s + v, 0),
    area: Math.abs(area2) / 2,
    edges: edges.slice().sort((x, y) => x - y),
  };
}

function signaturesMatch(a: RingSignature, b: RingSignature, tolFt: number): boolean {
  if (a.n !== b.n) return false;
  if (Math.abs(a.perimeter - b.perimeter) > tolFt * a.n) return false;
  /* Area tolerance scales with the ring's size: a 1e-3 ft error on every vertex
     of a 34 x 23.5 ft rectangle moves the area by about 0.06 sq ft, not by
     1e-3. Half the perimeter times the tolerance is that bound, exactly. */
  if (Math.abs(a.area - b.area) > (a.perimeter / 2) * tolFt + tolFt) return false;
  for (let i = 0; i < a.edges.length; i++) {
    if (Math.abs(a.edges[i] - b.edges[i]) > tolFt) return false;
  }
  return true;
}

/** Fold a string the way a DXF writer is entitled to: printable ASCII only,
 *  case flattened, runs of space collapsed. Both sides go through this, so the
 *  comparison tests whether the LABEL survived rather than whether two files
 *  agree about a typographic dash. */
export const foldText = (s: string): string =>
  s
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

/* ---------------------------------------------------- the expectation ---- */

/**
 * What a DXF of this model must contain, derived from the model itself.
 *
 * NOTHING HERE IS RE-DERIVED. Every ring is read straight off the `HomeModel`
 * that the SVG sheets were drawn from, so this is not a second opinion about
 * the geometry — it is the same numbers, asked of a different file.
 *
 * @param partial pass true when the export was asked for a subset of views.
 *                Rings drop from required to reported, because a foundation
 *                plan that was not requested is not a missing footprint.
 */
export function sourceFromModel(model: HomeModel, opts: { partial?: boolean } = {}): SourceDrawing {
  const required = !opts.partial;
  const rings: ExpectedRing[] = [];
  const texts: ExpectedText[] = [];

  for (const vm of model.volumes) {
    const name = vm.volume.name;
    rings.push({
      label: `${name} — outer wall face`,
      pts: vm.outer.map((p) => [p[0], p[1]] as Pt2),
      required,
    });
    rings.push({
      label: `${name} — roof outline including overhangs`,
      pts: vm.roofPlan.map((p) => [p[0], p[1]] as Pt2),
      required,
    });
    texts.push({ label: `${name} is labelled`, value: name, required });
  }
  if (model.deck) {
    rings.push({
      label: "Deck",
      pts: model.deck.corners.map((p) => [p[0], p[1]] as Pt2),
      required,
    });
  }

  const piles = model.volumes.reduce((s, vm) => s + vm.piles.count, 0);
  const counts: ExpectedCount[] = [];
  if (piles > 0) {
    counts.push({
      label: `${piles} screw piles`,
      type: "CIRCLE",
      layer: null,
      atLeast: piles,
      required,
      why:
        `The model lays out ${piles} piles. A foundation plan may carry more circles than that — ` +
        `a north arrow is one — but never fewer, so this is a floor and not an equality.`,
    });
  }

  const b = model.bounds;
  const minSpanFt =
    model.volumes.length > 0
      ? { w: b.maxX - b.minX, d: b.maxZ - b.minZ }
      : null;

  return {
    label: `HomeModel — ${model.volumes.length} volume${model.volumes.length === 1 ? "" : "s"}`,
    rings,
    texts,
    counts,
    minSpanFt,
  };
}

/**
 * Compare a parsed DXF against what the source says it should contain.
 *
 * Mutates `report.sourceChecks` and appends any failures to `report.problems`,
 * then returns the same report so this reads as one expression at a call site.
 */
export function compareToSource(report: DxfReport, source: SourceDrawing): DxfReport {
  const checks: SourceCheck[] = [];
  /* Every measurement in the file is in the file's own unit; the source is in
     feet. Normalising HERE rather than at each comparison means a metres export
     and a feet export are checked by identical code, which is the only way to
     be sure both are actually checked. */
  const k = report.unitFt;

  /* ---- rings, by shape signature */
  const fileRings: RingSignature[] = [];
  for (const e of report.entities) {
    if (e.type !== "POLYLINE" && e.type !== "LWPOLYLINE") continue;
    if (!e.closed) continue;
    const sig = ringSignature(e.points.map(([x, y]) => [x * k, y * k] as Pt2));
    if (sig) fileRings.push(sig);
  }
  for (const want of source.rings) {
    const sig = ringSignature(want.pts);
    if (!sig) continue;
    const found = fileRings.some((f) => signaturesMatch(sig, f, TOL_FT));
    checks.push({
      label: want.label,
      pass: found,
      required: want.required,
      detail: found
        ? `present as a closed polyline at true size — ${sig.n} vertices, ` +
          `${sig.perimeter.toFixed(3)} ft perimeter, ${sig.area.toFixed(2)} sq ft`
        : `NOT FOUND. No closed polyline in the file has this ring's shape ` +
          `(${sig.n} vertices, ${sig.perimeter.toFixed(3)} ft perimeter, ` +
          `${sig.area.toFixed(2)} sq ft) within ${TOL_FT} ft.`,
    });
    if (!found && want.required) {
      report.problems.push({
        severity: "error",
        code: "source-ring-missing",
        message:
          `"${want.label}" is in the model and no closed polyline in the DXF matches its shape. ` +
          `Either it was not written, or it was written at the wrong size.`,
      });
    }
  }

  /* ---- labels */
  const allText = report.entities
    .filter((e) => e.type === "TEXT" && e.text !== null)
    .map((e) => foldText(e.text as string));
  for (const want of source.texts) {
    const needle = foldText(want.value);
    const found = needle.length === 0 || allText.some((t) => t.includes(needle));
    checks.push({
      label: want.label,
      pass: found,
      required: want.required,
      detail: found ? `"${needle}" appears in the file's text` : `"${needle}" appears nowhere in the file's text`,
    });
    if (!found && want.required) {
      report.problems.push({
        severity: "error",
        code: "source-text-missing",
        message: `The model names "${want.value}" and no TEXT entity in the DXF carries it.`,
      });
    }
  }

  /* ---- minimum counts */
  for (const want of source.counts) {
    const n = report.entities.filter(
      (e) => (want.type === null || e.type === want.type) && (want.layer === null || e.layer === want.layer),
    ).length;
    const pass = n >= want.atLeast;
    checks.push({
      label: want.label,
      pass,
      required: want.required,
      detail: `${n} found, at least ${want.atLeast} expected — ${want.why}`,
    });
    if (!pass && want.required) {
      report.problems.push({
        severity: "error",
        code: "source-count-short",
        message:
          `The model has ${want.atLeast} ${want.label.toLowerCase()} and the DXF carries only ${n} ` +
          `matching entit${n === 1 ? "y" : "ies"}. Something was dropped between the model and the file.`,
      });
    }
  }

  /* ---- the drawing is at least as big as the building */
  if (source.minSpanFt && report.measuredExtents) {
    const w = (report.measuredExtents.maxX - report.measuredExtents.minX) * k;
    const h = (report.measuredExtents.maxY - report.measuredExtents.minY) * k;
    const pass = w >= source.minSpanFt.w - TOL_FT && h >= source.minSpanFt.d - TOL_FT;
    checks.push({
      label: "The drawing is at least as big as the building",
      pass,
      required: true,
      detail:
        `the file spans ${w.toFixed(2)} x ${h.toFixed(2)} ft and the building is ` +
        `${source.minSpanFt.w.toFixed(2)} x ${source.minSpanFt.d.toFixed(2)} ft. At 1:1 in model ` +
        `space a plan of the home cannot be smaller than the home.`,
    });
    if (!pass) {
      report.problems.push({
        severity: "error",
        code: "source-extent-short",
        message:
          `The DXF spans ${w.toFixed(2)} x ${h.toFixed(2)} ft and the building alone is ` +
          `${source.minSpanFt.w.toFixed(2)} x ${source.minSpanFt.d.toFixed(2)} ft. A drawing at 1:1 ` +
          `cannot be smaller than the thing it draws, so this file is scaled wrong or incomplete.`,
      });
    }
  }

  report.sourceChecks = checks;
  report.ok = !report.problems.some((p) => p.severity === "error");
  return report;
}

/** Parse and compare in one call — the shape a caller almost always wants. */
export function checkDxf(dxf: string, source?: SourceDrawing | null): DxfReport {
  const report = parseDxf(dxf);
  return source ? compareToSource(report, source) : report;
}

/* =====================================================================
   A REPORT AS TEXT — for a console, a CI log, or a bug report someone
   pastes into an issue. The UI has its own rendering; this one has to
   survive being copied into an email.
   ===================================================================== */

export function formatReport(r: DxfReport): string {
  const L: string[] = [];
  const box = (b: DxfBox | null): string =>
    b ? `(${fmt(b.minX)}, ${fmt(b.minY)}) → (${fmt(b.maxX)}, ${fmt(b.maxY)})` : "none";

  L.push(`DXF ROUND TRIP — ${r.ok ? "PASS" : "FAIL"}`);
  L.push(`  version        ${r.acadVer ?? "not declared"}`);
  L.push(`  units          ${r.unitsLabel}`);
  L.push(`  sections       ${r.sections.join(", ") || "none"}`);
  L.push(`  lines/groups   ${r.lineCount} / ${r.groupCount}`);
  L.push(`  entities       ${r.entities.length}`);
  for (const [t, n] of Object.entries(r.countsByType).sort()) L.push(`      ${t.padEnd(12)} ${n}`);
  L.push(`  linetypes      ${r.linetypesDeclared.map((l) => l.name).join(", ") || "none"}`);
  L.push(`  layers declared ${r.layersDeclared.map((l) => l.name).join(", ") || "none"}`);
  L.push(`  layers used     ${r.layersUsed.join(", ") || "none"}`);
  if (r.layersUnused.length > 0) L.push(`  layers unused   ${r.layersUnused.join(", ")}`);
  for (const [l, n] of Object.entries(r.countsByLayer).sort()) L.push(`      ${l.padEnd(12)} ${n}`);
  L.push(`  header extents ${box(r.headerExtents)}`);
  L.push(`  measured       ${box(r.measuredExtents)}`);

  if (r.sourceChecks.length > 0) {
    L.push(`  against the source drawing:`);
    for (const c of r.sourceChecks) {
      L.push(`      ${c.pass ? "PASS" : c.required ? "FAIL" : "MISS"}  ${c.label} — ${c.detail}`);
    }
  }

  const bySeverity = (s: ProblemSeverity) => r.problems.filter((p) => p.severity === s);
  for (const s of ["error", "warning", "note"] as const) {
    const list = bySeverity(s);
    if (list.length === 0) continue;
    L.push(`  ${s}s (${list.length}):`);
    for (const p of list) L.push(`      [${p.code}] ${p.message}`);
  }
  return L.join("\n");
}
