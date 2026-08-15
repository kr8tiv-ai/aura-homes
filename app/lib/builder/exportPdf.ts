/* ===========================================================================
   THE DRAWING SET AS ONE PDF — the file the other side of the table wants.

   Everybody downstream of this product — a drafter, a residential designer,
   a structural engineer, a lender, a building department — asks for a PDF.
   Eight separate .svg files and a .json is the currency of a web app, not of
   a permit office. This module turns the eight sheets `drawings/` already
   draws into one multi-page, vector, print-ready document.

   THE GEOMETRY IS ALREADY IN PDF UNITS. `drawings/kit.ts` sizes its paper in
   POINTS — SHEET_W = 17 * 72 and SHEET_H = 11 * 72, ANSI B landscape — and
   the point is PDF's native unit. So the SVG coordinate system IS the PDF
   coordinate system at 1:1 and there is no scaling arithmetic to get wrong.
   The page size is read out of each sheet's own `viewBox` rather than from a
   constant duplicated here, so a change in the kit cannot silently leave this
   module drawing 11x17 content onto a page of some other size.

   WHY THIS IS HAND-WRITTEN AND NOT jspdf + svg2pdf.js
   ---------------------------------------------------
   Both are MIT and svg2pdf.js is built for exactly this job, so it was the
   obvious pairing and it was the plan. Three facts moved the decision:

   1. THE PURE TEST GATE RUNS IN NODE WITH NO DOM. `svg` on a DrawingSheet is
      a STRING; svg2pdf.js takes an SVGElement and resolves every paint through
      `getComputedStyle`. That needs a browser, or jsdom plus a CSS cascade
      that actually resolves `var(--adw-ink, currentColor)` out of an inline
      <style> — which jsdom does not do. A converter that can only be exercised
      in a served browser could not be gated by the spec this node is required
      to write, and an ungated exporter is how a set ships all-black.
   2. THE VOCABULARY IS OURS AND IT IS TINY. Every mark on these sheets comes
      out of `drawings/kit.ts`: <rect>, <line>, <circle>, <path>, <text>, one
      <g transform="rotate(...)">, and a <style>/<title> pair that carries no
      ink. That is a closed set we own, not the open-ended SVG spec, and the
      converter below refuses loudly (see `warnings`) the moment it meets
      something outside it. A general-purpose library is insurance against
      inputs that cannot occur here.
   3. WEIGHT — and this reason is DIRECTIONAL, not measured. The packages were
      not installed and weighed, so no number for them is stated here; the
      claim is only the trivially checkable one, that this file adds NO
      dependency at all. `npm ls` finds no new package and the first-load
      figures in perf/PB01-baseline-2026-08-14.json cannot move, because
      nothing new is there to load and this module is reached by dynamic
      import. If a future pass does adopt jspdf, weigh it first the way
      exportSpec.ts's IFC block weighs web-ifc — against the packages
      themselves, not from memory.

   WHAT THAT COSTS, SAID PLAINLY. This converter understands the marks THIS
   repo draws and nothing else. Path data is limited to the M / L / Z / A
   commands `kit.ts` emits; an unrecognised element, class, command or glyph is
   recorded in `warnings` and named, never silently dropped in a way a reader
   could mistake for a design with fewer lines in it.

   DETERMINISTIC. The rule `exportSpec.ts` states for every artifact this
   product writes: no timestamps, no random ids, no `Date.now()` anywhere, so
   the same set and the same date produce byte-identical files. PDF writers
   default to stamping /CreationDate, /ModDate and a random /ID, which is the
   single reason a diff of two exports of the same house would otherwise be
   noise. Here /CreationDate and /ModDate are derived from `meta.dateISO` — a
   PARAMETER, the same discipline the title block keeps — and /ID is a keccak
   over the sheets' own bytes. Nothing in this file reads a clock or a random
   number generator. `tests/export-pdf.spec.ts` proves it by generating twice
   under a stubbed Date and comparing every byte.

   VECTOR, NOT RASTER. Every mark is a real PDF path operator and every label
   is real text in Helvetica with WinAnsiEncoding, so a reader can zoom into a
   dimension string forever and can select and search it. There is no image
   XObject anywhere in the output; a screenshot of a drawing is not a drawing.

   UNCOMPRESSED CONTENT STREAMS, ON PURPOSE. Flate would cut the file by
   roughly 4x, and it would do it through zlib in Node and CompressionStream in
   the browser — two implementations that agree on the decoded bytes and not on
   the encoded ones. Skipping compression REMOVES that divergence rather than
   managing it, and the per-sheet SVG downloads remain for anyone who wants one
   light sheet.

   WHAT IS AND IS NOT PROVEN ABOUT CROSS-ENGINE IDENTITY. This block used to
   claim byte-identical output ACROSS ENVIRONMENTS. Nobody has ever run this
   writer in a second engine and diffed the result, so that claim is withdrawn
   and replaced with the two things `tests/export-pdf.spec.ts` actually
   executes. One: byte identity of repeated generations IN ONE ENGINE, under a
   stubbed Date thirty years apart and two different Math.random streams. Two:
   a source check that nothing here reaches an API whose bytes are known to
   differ between engines — no zlib, no CompressionStream, no Buffer, no
   TextEncoder, no Intl or locale formatting, no clock, no randomness, no Node
   built-in. That is a structural argument, not a measurement, and it stops
   where this file stops: `viem`'s keccak is taken on the same terms.

   THE RESIDUAL RISK, NAMED RATHER THAN IMPLIED. `arcToBeziers` and
   `parseTransform` call Math.cos/sin/tan/acos/hypot, and ECMA-262 leaves the
   precision of those implementation-defined. Two engines may differ in the
   last ULP, and a value sitting exactly on a 0.0005 boundary would then round
   differently in `n()`. Only door-swing arcs and rotated labels are exposed;
   every straight mark on every sheet is exact decimal arithmetic and cannot
   move. Proving the rest needs a second engine, not a stronger sentence here.
   =========================================================================== */

import { keccak256, stringToHex, type Hex } from "viem";

import type { DrawingSetResult } from "./drawings";
import { EXPORT_DISCLAIMER, type ExportArtifact } from "./exportSpec";

/* ---------------------------------------------------------------- the API */

export interface DrawingSetPdfMeta {
  /** Printed in the footer and used for the filename. */
  projectName: string;
  /** ISO date. A PARAMETER — this module never reads a clock. */
  dateISO: string;
  /**
   * The canonical design hash the rest of the export surface carries.
   *
   * `null` is a legitimate value and is printed as such. A PDF that quietly
   * omits the hash reads like a PDF that has one; a PDF that says the hash was
   * not supplied tells the recipient exactly what they are holding.
   */
  designHash?: string | null;
}

export interface DrawingSetPdfResult {
  bytes: Uint8Array<ArrayBuffer>;
  /** One page per sheet, in A0…A7 order. */
  pageCount: number;
  /** keccak256 over the sheets' own SVG bytes — the identity of this drawing
   *  set, printed on every page and used for the PDF's /ID. */
  setHash: Hex;
  /** Everything the converter met and could not draw, named. Empty is the
   *  expected state; a non-empty list is a defect report, not decoration. */
  warnings: string[];
}

/**
 * What the download returns.
 *
 * An `ExportArtifact` by extension rather than by copy, so it drops into
 * `downloadArtifact` and every other ExportArtifact slot with no special case
 * — and carries the converter's own findings, so a UI can print the sentences
 * rather than a count. ONE generation produces the blob and the warnings: there
 * is no second code path that could report on bytes other than the saved ones.
 */
export interface DrawingSetPdfArtifact extends ExportArtifact {
  /** Everything the converter met and could not draw, named. Empty is the
   *  expected state; a non-empty list is a defect report, not decoration. */
  warnings: string[];
  /** keccak256 over the sheets' own SVG bytes. Printed on every page. */
  setHash: Hex;
}

/** What the footer prints when no design hash reached this export. */
export const PDF_DESIGN_HASH_ABSENT = "NOT SUPPLIED TO THIS EXPORT";

/* =========================================================================
   1. NUMBERS AND BYTES
   ========================================================================= */

/**
 * A number as PDF sees it: at most three decimals, no exponent, no "-0".
 *
 * Three decimals is a thousandth of a point on a 17-inch sheet. The rounding
 * is what makes the output stable: the same input always prints the same
 * digits, which is a precondition for byte-identical files.
 */
function n(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const r = Math.round(v * 1000) / 1000;
  if (r === 0) return "0";
  return r.toFixed(3).replace(/\.?0+$/, "");
}

/**
 * A byte sink.
 *
 * Every string handed to it holds only code units below 256, so its character
 * length IS its byte length — which is what lets `offset()` produce correct
 * xref offsets and correct /Length values without a second encoding pass.
 */
class Bytes {
  private readonly parts: string[] = [];
  private length = 0;

  push(chunk: string): void {
    this.parts.push(chunk);
    this.length += chunk.length;
  }

  offset(): number {
    return this.length;
  }

  finish(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const part of this.parts) {
      for (let i = 0; i < part.length; i += 1) {
        out[at] = part.charCodeAt(i) & 0xff;
        at += 1;
      }
    }
    return out;
  }
}

/* =========================================================================
   2. THE PENS

   `kit.ts` paints through CSS classes so the sheets can live inside a page
   with a real night mode. A PDF has no cascade and no host document, so the
   right target is the STANDALONE rendering of the same SVG — the one the
   existing per-sheet download already produces. There the `--drawings-*` and
   `--st-*` variables are all absent and each pen falls through to its terminal
   value: paper #ffffff, glass #0f766e, accent #047857, and ink / dim / hair to
   `currentColor`, which on a document with no inherited colour is black.

   So these are not a re-styling. They are the colours a reviewer already sees
   when they open the .svg this set hands them.
   ========================================================================= */

type Rgb = readonly [number, number, number];

const INK: Rgb = [0, 0, 0];
const PAPER: Rgb = [1, 1, 1];
const GLASS: Rgb = [15 / 255, 118 / 255, 110 / 255];
const ACCENT: Rgb = [4 / 255, 120 / 255, 87 / 255];

interface Pen {
  fill?: Rgb;
  stroke?: Rgb;
}

const PENS: Readonly<Record<string, Pen>> = {
  "adw-poche": { fill: INK },
  "adw-paper": { fill: PAPER },
  "adw-fill-paper": { fill: PAPER },
  "adw-ink": { stroke: INK },
  "adw-hair": { stroke: INK },
  "adw-dimline": { stroke: INK },
  "adw-glass": { stroke: GLASS },
  "adw-knock": { stroke: PAPER },
  "adw-accent": { stroke: ACCENT },
  "adw-t-ink": { fill: INK },
  "adw-t-dim": { fill: INK },
  "adw-t-accent": { fill: ACCENT },
  "adw-t-glass": { fill: GLASS },
};

/* =========================================================================
   3. HELVETICA

   The base-14 Helvetica, which every PDF reader carries, matches the SVG's own
   `'Helvetica Neue', Helvetica, Arial, sans-serif`. Using it means no embedded
   font programme: no subsetting (a common source of non-determinism), no
   licence question, a much smaller file, and text a reader can select, search
   and copy out.

   The widths are Adobe's own Helvetica AFM metrics in 1/1000 em, indexed by
   WinAnsi byte. They exist so `text-anchor="middle"` and `"end"` land where
   the drawing intends: they measure the font the PDF actually uses, so the
   centring is exact for this document rather than an estimate of a browser's.
   ========================================================================= */

// prettier-ignore
const HELVETICA_WIDTHS: readonly number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
  556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,0,
  556,0,222,556,333,1000,556,556,333,1000,667,333,1000,0,611,0,
  0,222,222,333,333,350,556,1000,333,1000,500,333,944,0,500,667,
  278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,
  400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,
  667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,
  722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,
  556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,
  556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500,
];

/** The Unicode code points WinAnsiEncoding keeps in the 0x80–0x9F band, which
 *  is the whole reason a PDF string is not just Latin-1. Everything the sheets
 *  actually letter — the em dash, the middle dot, the curly quotes — lives
 *  here or in Latin-1 proper. */
const WINANSI_HIGH: Readonly<Record<number, number>> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

const SUBSTITUTE = 0x3f; // "?"

/** Text to WinAnsi bytes. A character with no WinAnsi slot becomes "?" and is
 *  NAMED in the warnings — a project name in a script Helvetica cannot set is
 *  a real limitation of a base-14 PDF and the recipient should hear it from
 *  the export rather than discover it on the paper. */
function toWinAnsi(text: string, warn: (why: string) => void): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 32 && cp <= 126) {
      out.push(cp);
    } else if (cp >= 160 && cp <= 255) {
      out.push(cp);
    } else if (WINANSI_HIGH[cp] !== undefined) {
      out.push(WINANSI_HIGH[cp]);
    } else if (cp === 9 || cp === 10 || cp === 13) {
      out.push(32);
    } else {
      out.push(SUBSTITUTE);
      warn(
        `The character ${JSON.stringify(ch)} (U+${cp.toString(16).toUpperCase().padStart(4, "0")}) ` +
          `has no slot in WinAnsiEncoding and is printed as "?" in the PDF. The .svg sheets carry ` +
          `it correctly; a PDF that set it would need an embedded font.`,
      );
    }
  }
  return out;
}

/** Advance width in points, including the trailing letter-space, matching how
 *  a browser measures an anchored <text> run. */
function runWidth(bytes: readonly number[], sizePt: number, letterSpacing: number): number {
  let em = 0;
  for (const b of bytes) em += HELVETICA_WIDTHS[b] ?? 500;
  return (em / 1000) * sizePt + letterSpacing * bytes.length;
}

/** A PDF literal string. Everything outside printable ASCII is octal-escaped,
 *  which keeps the whole file 7-bit and keeps character length equal to byte
 *  length for the /Length and xref arithmetic above. */
function pdfString(bytes: readonly number[]): string {
  let out = "(";
  for (const b of bytes) {
    if (b === 0x28) out += "\\(";
    else if (b === 0x29) out += "\\)";
    else if (b === 0x5c) out += "\\\\";
    else if (b >= 32 && b <= 126) out += String.fromCharCode(b);
    else out += `\\${b.toString(8).padStart(3, "0")}`;
  }
  return `${out})`;
}

/**
 * A PDF *text* string — the kind that goes in /Title and /Subject rather than
 * in a content stream.
 *
 * UTF-16BE behind a byte-order mark, which is the one encoding a PDF text
 * string can carry that covers all of Unicode. Deliberately NOT the WinAnsi
 * path above: a bare high byte in a text string is read as PDFDocEncoding,
 * whose 0x80–0x9F band does not agree with WinAnsi's, and a project name is
 * the field most likely to contain a character from outside ASCII.
 */
function pdfTextString(text: string): string {
  const bytes: number[] = [0xfe, 0xff];
  for (let i = 0; i < text.length; i += 1) {
    const unit = text.charCodeAt(i);
    bytes.push((unit >> 8) & 0xff, unit & 0xff);
  }
  return pdfString(bytes);
}

/* =========================================================================
   4. THE CONTENT STREAM

   PDF's y axis points UP from the bottom-left; SVG's points DOWN from the
   top-left. Rather than negate every coordinate — which would silently invert
   every rotation and every arc sweep — each page opens with one flipping
   matrix, `1 0 0 -1 0 <height> cm`, and every coordinate below is then the
   sheet's own SVG number, unchanged. Text is un-flipped once more by its own
   text matrix so glyphs stand up. One transform, applied once, in one place.
   ========================================================================= */

interface GfxState {
  fill: string | null;
  stroke: string | null;
  width: number | null;
  dash: string | null;
  alpha: string | null;
  font: number | null;
  charSpace: number | null;
}

const freshState = (): GfxState => ({
  fill: null,
  stroke: null,
  width: null,
  dash: null,
  alpha: null,
  font: null,
  charSpace: null,
});

/** Six-number affine matrix, SVG order: x' = a x + c y + e, y' = b x + d y + f.
 *  PDF's `cm` operator takes exactly this, in exactly this order. */
type Matrix = readonly [number, number, number, number, number, number];

/**
 * The constant alphas the document uses, named once and shared by every page.
 *
 * PDF has no `opacity` attribute: a constant alpha is a named /ExtGState in the
 * page's resources. Names are handed out in FIRST-ENCOUNTER order over the
 * sheets in A0…A7 order, which is deterministic, so two runs allocate the same
 * names to the same values and the files match byte for byte.
 *
 * `values` is kept as an array rather than read back off the Map because
 * iterating a Map needs downlevelIteration under this tsconfig, and an
 * insertion-ordered array says the ordering guarantee out loud.
 */
class AlphaTable {
  readonly values: string[] = [];
  private readonly names = new Map<string, string>();

  name(key: string): string {
    const known = this.names.get(key);
    if (known !== undefined) return known;
    const fresh = `GS${this.values.length}`;
    this.names.set(key, fresh);
    this.values.push(key);
    return fresh;
  }
}

class Content {
  private readonly ops: string[] = [];
  private state: GfxState = freshState();
  private readonly stack: GfxState[] = [];
  constructor(private readonly alphas: AlphaTable) {}

  op(text: string): void {
    this.ops.push(text);
  }

  save(): void {
    this.ops.push("q");
    this.stack.push({ ...this.state });
  }

  restore(): void {
    this.ops.push("Q");
    this.state = this.stack.pop() ?? freshState();
  }

  depth(): number {
    return this.stack.length;
  }

  transform(m: Matrix): void {
    this.ops.push(`${m.map(n).join(" ")} cm`);
  }

  setFill(rgb: Rgb): void {
    const key = `${n(rgb[0])} ${n(rgb[1])} ${n(rgb[2])}`;
    if (this.state.fill === key) return;
    this.state.fill = key;
    this.ops.push(`${key} rg`);
  }

  setStroke(rgb: Rgb): void {
    const key = `${n(rgb[0])} ${n(rgb[1])} ${n(rgb[2])}`;
    if (this.state.stroke === key) return;
    this.state.stroke = key;
    this.ops.push(`${key} RG`);
  }

  setWidth(w: number): void {
    if (this.state.width === w) return;
    this.state.width = w;
    this.ops.push(`${n(w)} w`);
  }

  setDash(pattern: readonly number[] | null): void {
    const key = pattern && pattern.length > 0 ? `[${pattern.map(n).join(" ")}] 0 d` : "[] 0 d";
    if (this.state.dash === key) return;
    this.state.dash = key;
    this.ops.push(key);
  }

  setAlpha(alpha: number): void {
    const key = n(alpha);
    if (this.state.alpha === key) return;
    this.state.alpha = key;
    this.ops.push(`/${this.alphas.name(key)} gs`);
  }

  setFont(sizePt: number): void {
    if (this.state.font === sizePt) return;
    this.state.font = sizePt;
    this.ops.push(`/F1 ${n(sizePt)} Tf`);
  }

  setCharSpace(spacing: number): void {
    if (this.state.charSpace === spacing) return;
    this.state.charSpace = spacing;
    this.ops.push(`${n(spacing)} Tc`);
  }

  moveTo(x: number, y: number): void {
    this.ops.push(`${n(x)} ${n(y)} m`);
  }

  lineTo(x: number, y: number): void {
    this.ops.push(`${n(x)} ${n(y)} l`);
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): void {
    this.ops.push(`${n(x1)} ${n(y1)} ${n(x2)} ${n(y2)} ${n(x)} ${n(y)} c`);
  }

  closePath(): void {
    this.ops.push("h");
  }

  rectPath(x: number, y: number, w: number, h: number): void {
    this.ops.push(`${n(x)} ${n(y)} ${n(w)} ${n(h)} re`);
  }

  circlePath(cx: number, cy: number, r: number): void {
    // 0.5522847498307936 is the classic four-arc circle constant: the control
    // offset that makes a cubic Bézier quadrant match a circle to ~0.02%.
    const k = 0.5522847498307936 * r;
    this.moveTo(cx + r, cy);
    this.curveTo(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
    this.curveTo(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
    this.curveTo(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
    this.curveTo(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
    this.closePath();
  }

  paint(fill: Rgb | null, stroke: Rgb | null, evenOdd: boolean): void {
    if (fill && stroke) this.ops.push(evenOdd ? "B*" : "B");
    else if (fill) this.ops.push(evenOdd ? "f*" : "f");
    else if (stroke) this.ops.push("S");
    else this.ops.push("n");
  }

  text(bytes: readonly number[], x: number, y: number): void {
    this.ops.push("BT");
    // 1 0 0 -1 undoes the page flip for the glyphs only, so text stands up on
    // a page whose geometry is drawn in SVG's downward y.
    this.ops.push(`1 0 0 -1 ${n(x)} ${n(y)} Tm`);
    this.ops.push(`${pdfString(bytes)} Tj`);
    this.ops.push("ET");
  }

  build(): string {
    return this.ops.join("\n");
  }
}

/* =========================================================================
   5. PATH DATA

   Only the commands `drawings/kit.ts` emits: M and L from `polyD`, Z from its
   closing flag, and the one A in `sheets.ts` that draws a door swing. Anything
   else is named in the warnings rather than approximated.
   ========================================================================= */

const PATH_TOKENS = /[A-DF-Za-df-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

function emitPath(c: Content, d: string, warn: (why: string) => void): void {
  const tokens = d.match(PATH_TOKENS) ?? [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let started = false;
  const num = (): number => {
    const t = tokens[i];
    i += 1;
    const v = Number(t);
    return Number.isFinite(v) ? v : 0;
  };
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (!/^[A-Za-z]$/.test(cmd)) {
      warn(`Path data began with ${JSON.stringify(cmd)} rather than a command; the rest was skipped.`);
      return;
    }
    i += 1;
    switch (cmd) {
      case "M":
      case "m": {
        let firstPair = true;
        while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i])) {
          const x = num();
          const y = num();
          cx = cmd === "m" && started ? cx + x : x;
          cy = cmd === "m" && started ? cy + y : y;
          if (firstPair) {
            c.moveTo(cx, cy);
            startX = cx;
            startY = cy;
            firstPair = false;
            started = true;
          } else {
            // A second coordinate pair after M is an implicit lineto in SVG.
            c.lineTo(cx, cy);
          }
        }
        break;
      }
      case "L":
      case "l": {
        while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i])) {
          const x = num();
          const y = num();
          cx = cmd === "l" ? cx + x : x;
          cy = cmd === "l" ? cy + y : y;
          c.lineTo(cx, cy);
        }
        break;
      }
      case "Z":
      case "z": {
        c.closePath();
        cx = startX;
        cy = startY;
        break;
      }
      case "A":
      case "a": {
        while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i])) {
          const rx = num();
          const ry = num();
          const rot = num();
          const large = num() !== 0;
          const sweep = num() !== 0;
          const ex = num();
          const ey = num();
          const x2 = cmd === "a" ? cx + ex : ex;
          const y2 = cmd === "a" ? cy + ey : ey;
          arcToBeziers(c, cx, cy, rx, ry, rot, large, sweep, x2, y2);
          cx = x2;
          cy = y2;
        }
        break;
      }
      default: {
        warn(
          `Path command "${cmd}" is outside the M/L/Z/A vocabulary drawings/kit.ts emits, so this ` +
            `path was cut short in the PDF. The .svg sheet carries it correctly.`,
        );
        return;
      }
    }
  }
}

/**
 * SVG's endpoint-parameterised arc, as cubic Béziers.
 *
 * PDF has no arc operator, so a door swing has to become curves. This is the
 * SVG 1.1 F.6.5 endpoint-to-centre conversion followed by the standard
 * quadrant split — written out in full rather than approximated, because the
 * swing arc is the mark that tells a reviewer which way a door opens.
 */
function arcToBeziers(
  c: Content,
  x0: number,
  y0: number,
  rxIn: number,
  ryIn: number,
  rotDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x1: number,
  y1: number,
): void {
  if (x0 === x1 && y0 === y1) return;
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) {
    c.lineTo(x1, y1);
    return;
  }
  const phi = (rotDeg * Math.PI) / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx2 = (x0 - x1) / 2;
  const dy2 = (y0 - y1) / 2;
  const xp = cosP * dx2 + sinP * dy2;
  const yp = -sinP * dx2 + cosP * dy2;
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  const numr = rx * rx * ry * ry - den;
  const co = den === 0 ? 0 : (largeArc !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, numr / den));
  const cxp = (co * rx * yp) / ry;
  const cyp = (-co * ry * xp) / rx;
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const dot = len === 0 ? 1 : (ux * vx + uy * vy) / len;
    let a = Math.acos(Math.min(1, Math.max(-1, dot)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const u = [(xp - cxp) / rx, (yp - cyp) / ry] as const;
  const v = [(-xp - cxp) / rx, (-yp - cyp) / ry] as const;
  const theta = angle(1, 0, u[0], u[1]);
  let delta = angle(u[0], u[1], v[0], v[1]);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;

  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
  const step = delta / segments;
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (a: number): readonly [number, number] => [
    cx + rx * Math.cos(a) * cosP - ry * Math.sin(a) * sinP,
    cy + rx * Math.cos(a) * sinP + ry * Math.sin(a) * cosP,
  ];
  const slope = (a: number): readonly [number, number] => [
    -rx * Math.sin(a) * cosP - ry * Math.cos(a) * sinP,
    -rx * Math.sin(a) * sinP + ry * Math.cos(a) * cosP,
  ];
  let a0 = theta;
  for (let s = 0; s < segments; s += 1) {
    const a1 = a0 + step;
    const p0 = at(a0);
    const d0 = slope(a0);
    const p1 = at(a1);
    const d1 = slope(a1);
    c.curveTo(p0[0] + k * d0[0], p0[1] + k * d0[1], p1[0] - k * d1[0], p1[1] - k * d1[1], p1[0], p1[1]);
    a0 = a1;
  }
}

/* =========================================================================
   6. THE SVG READER

   Not a general parser. `drawings/kit.ts` builds its markup by string
   concatenation from a handful of functions, so the shape is known exactly:
   double-quoted attributes with no raw ">" inside them, self-closing marks,
   and one element type (<text>) with a body. Anything outside that shape is a
   change in the kit, and this reader says so instead of guessing.
   ========================================================================= */

const ATTR = /([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g;

/** Deliberately `string | undefined`: every read below has to decide what an
 *  ABSENT attribute means, and a type that pretends every attribute is present
 *  is how `opacity` silently becomes the string "undefined". */
type Attrs = Record<string, string | undefined>;

function parseAttrs(source: string): Attrs {
  const out: Attrs = {};
  ATTR.lastIndex = 0;
  let m = ATTR.exec(source);
  while (m !== null) {
    out[m[1]] = m[2];
    m = ATTR.exec(source);
  }
  return out;
}

const att = (a: Attrs, key: string): string => a[key] ?? "";
const attNum = (a: Attrs, key: string, fallback = 0): number => {
  const raw = a[key];
  if (raw === undefined) return fallback;
  const v = Number.parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
};

/** `&amp;`, `&lt;`, `&gt;`, `&quot;` — the four `kit.ts::esc` writes — plus
 *  numeric references, so a future escape cannot arrive on the paper as
 *  literal "&#8212;". */
function unescapeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** `rotate(a,cx,cy)` as an affine matrix. The only transform `kit.ts` emits,
 *  on the site plan's north arrow and on every rotated dimension string. */
function parseTransform(value: string, warn: (why: string) => void): Matrix | null {
  const m = /^\s*rotate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)\s*$/.exec(value);
  if (m === null) {
    warn(
      `The transform ${JSON.stringify(value)} is outside the rotate(angle,cx,cy) form ` +
        `drawings/kit.ts emits, so it was ignored and the marks under it are drawn unrotated.`,
    );
    return null;
  }
  const rad = (Number(m[1]) * Math.PI) / 180;
  const cx = Number(m[2]);
  const cy = Number(m[3]);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
}

function parseDash(value: string): number[] | null {
  if (value === "") return null;
  const parts = value
    .split(/[\s,]+/)
    .map((s) => Number.parseFloat(s))
    .filter((v) => Number.isFinite(v));
  return parts.length > 0 ? parts : null;
}

interface Paints {
  fill: Rgb | null;
  stroke: Rgb | null;
  evenOdd: boolean;
}

function resolvePaints(attrs: Attrs, strokeWidth: number, warn: (why: string) => void): Paints {
  const cls = att(attrs, "class");
  const pen: Pen | undefined = PENS[cls];
  if (pen === undefined) {
    warn(
      `The drawing class "${cls}" is not one of the pens drawings/kit.ts declares, so this mark was ` +
        `drawn in ink rather than dropped. Add it to PENS in lib/builder/exportPdf.ts.`,
    );
  }
  const resolved: Pen = pen ?? (strokeWidth > 0 ? { stroke: INK } : { fill: INK });
  let fill = resolved.fill ?? null;
  let stroke = resolved.stroke ?? null;
  if (att(attrs, "stroke") === "none") stroke = null;
  if (att(attrs, "fill") === "none") fill = null;
  if (stroke !== null && !(strokeWidth > 0)) stroke = null;
  return { fill, stroke, evenOdd: att(attrs, "fill-rule") === "evenodd" };
}

/** SVG `opacity` on a single primitive is exactly PDF's constant alpha, and
 *  setting /CA and /ca together is the whole of it for a mark that is either
 *  filled or stroked. Absent means opaque. */
const alphaOf = (attrs: Attrs): number => {
  const raw = attrs.opacity;
  if (raw === undefined) return 1;
  const v = Number.parseFloat(raw);
  return Number.isFinite(v) ? v : 1;
};

function applyPaints(c: Content, attrs: Attrs, p: Paints, strokeWidth: number): void {
  if (p.fill) c.setFill(p.fill);
  if (p.stroke) {
    c.setStroke(p.stroke);
    c.setWidth(strokeWidth);
    c.setDash(parseDash(att(attrs, "stroke-dasharray")));
  }
  c.setAlpha(alphaOf(attrs));
}

/* ------------------------------------------------------------- one sheet */

interface RenderedPage {
  ops: string;
  widthPt: number;
  heightPt: number;
}

interface FooterLines {
  /** `EXPORT_DISCLAIMER`, verbatim from `exportSpec.ts`. Upper line. */
  disclaimer: string;
  /** Sheet identity, project, date, design hash, drawing-set hash. Lower. */
  identity: string;
}

function renderSheet(
  svg: string,
  footer: FooterLines,
  alphas: AlphaTable,
  warn: (why: string) => void,
): RenderedPage {
  const c = new Content(alphas);
  let widthPt = 0;
  let heightPt = 0;
  let opened = false;
  let i = 0;

  const drawText = (attrs: Attrs, body: string): void => {
    const raw = unescapeXml(body);
    if (raw.length === 0) return;
    const sizePt = Number.parseFloat(att(attrs, "font-size"));
    if (!Number.isFinite(sizePt) || sizePt <= 0) {
      warn(
        `A label carried the font-size ${JSON.stringify(att(attrs, "font-size"))}, which is not a ` +
          `size in points, so it is not in the PDF.`,
      );
      return;
    }
    const spacing = attNum(attrs, "letter-spacing", 0);
    const bytes = toWinAnsi(raw, warn);
    const anchor = att(attrs, "text-anchor");
    const width = runWidth(bytes, sizePt, spacing);
    const dx = anchor === "middle" ? -width / 2 : anchor === "end" ? -width : 0;
    const paints = resolvePaints(attrs, 0, warn);
    const transform = attrs.transform === undefined ? null : parseTransform(attrs.transform, warn);
    if (transform) {
      c.save();
      c.transform(transform);
    }
    c.setFill(paints.fill ?? INK);
    c.setAlpha(alphaOf(attrs));
    c.setFont(sizePt);
    c.setCharSpace(spacing);
    c.text(bytes, attNum(attrs, "x") + dx, attNum(attrs, "y"));
    if (transform) c.restore();
  };

  while (i < svg.length) {
    const lt = svg.indexOf("<", i);
    if (lt === -1) break;
    const gt = svg.indexOf(">", lt + 1);
    if (gt === -1) {
      warn("A sheet ended inside an unterminated tag; the rest of it is not in the PDF.");
      break;
    }
    const raw = svg.slice(lt + 1, gt);
    i = gt + 1;

    if (raw.startsWith("/")) {
      if (raw.slice(1).trim() === "g" && c.depth() > 0) c.restore();
      continue;
    }
    const inner = raw.endsWith("/") ? raw.slice(0, -1) : raw;
    const space = inner.search(/[\s/]/);
    const tag = space === -1 ? inner : inner.slice(0, space);
    const attrs = parseAttrs(inner);

    switch (tag) {
      case "svg": {
        const box = att(attrs, "viewBox").trim().split(/[\s,]+/).map(Number);
        if (box.length !== 4 || box.some((v) => !Number.isFinite(v))) {
          throw new Error(
            "[aura/pdf] a drawing sheet carries no readable viewBox, so its page size is unknown. " +
              "The sheet's own paper size is the only honest source for the PDF page.",
          );
        }
        widthPt = box[2];
        heightPt = box[3];
        // One flip for the whole page; every coordinate below is the sheet's.
        c.transform([1, 0, 0, -1, -box[0], box[1] + heightPt]);
        // SVG's stroke-miterlimit defaults to 4 and PDF's to 10, which is the
        // one default the two formats do not share. Left alone, the sharp
        // corners of a poché ring grow spikes the sheet does not have.
        c.op("4 M");
        opened = true;
        break;
      }
      case "title":
      case "style": {
        const end = svg.indexOf(`</${tag}>`, i);
        i = end === -1 ? svg.length : end + tag.length + 3;
        break;
      }
      case "g": {
        c.save();
        const t = attrs.transform === undefined ? null : parseTransform(attrs.transform, warn);
        if (t) c.transform(t);
        break;
      }
      case "rect": {
        const w = attNum(attrs, "stroke-width");
        const p = resolvePaints(attrs, w, warn);
        if (!p.fill && !p.stroke) break;
        applyPaints(c, attrs, p, w);
        c.rectPath(attNum(attrs, "x"), attNum(attrs, "y"), attNum(attrs, "width"), attNum(attrs, "height"));
        c.paint(p.fill, p.stroke, p.evenOdd);
        break;
      }
      case "line": {
        const w = attNum(attrs, "stroke-width");
        const p = resolvePaints(attrs, w, warn);
        if (!p.stroke) break;
        applyPaints(c, attrs, p, w);
        c.moveTo(attNum(attrs, "x1"), attNum(attrs, "y1"));
        c.lineTo(attNum(attrs, "x2"), attNum(attrs, "y2"));
        c.paint(null, p.stroke, false);
        break;
      }
      case "circle": {
        const w = attNum(attrs, "stroke-width");
        const p = resolvePaints(attrs, w, warn);
        if (!p.fill && !p.stroke) break;
        applyPaints(c, attrs, p, w);
        c.circlePath(attNum(attrs, "cx"), attNum(attrs, "cy"), attNum(attrs, "r"));
        c.paint(p.fill, p.stroke, p.evenOdd);
        break;
      }
      case "path": {
        const w = attNum(attrs, "stroke-width");
        const p = resolvePaints(attrs, w, warn);
        if (!p.fill && !p.stroke) break;
        applyPaints(c, attrs, p, w);
        emitPath(c, att(attrs, "d"), warn);
        c.paint(p.fill, p.stroke, p.evenOdd);
        break;
      }
      case "text": {
        const end = svg.indexOf("</text>", i);
        const body = end === -1 ? "" : svg.slice(i, end);
        i = end === -1 ? svg.length : end + 7;
        drawText(attrs, body);
        break;
      }
      default: {
        warn(
          `The element <${tag}> is outside the vocabulary drawings/kit.ts emits, so it is not in the ` +
            `PDF. The .svg sheet carries it. Teach lib/builder/exportPdf.ts to draw it.`,
        );
        break;
      }
    }
  }

  if (!opened) {
    throw new Error("[aura/pdf] a drawing sheet did not begin with an <svg> element.");
  }

  /* ---- the honesty strip.

     Every other export carries EXPORT_DISCLAIMER in its own body — the JSON,
     the glTF `extras`, the OBJ header — so the disclaimer travels with the
     file rather than living on a web page the recipient never saw. A PDF is
     the ONE file a building department reads, so it carries it on every page,
     with the design hash and the drawing-set hash beside it.

     It sits in the 18-point band between the title block's foot and the sheet
     border, which every sheet leaves empty. Inside the border rather than
     outside it, because a printer's non-printable margin eats the outside. */
  const stripLeft = 22;
  const available = widthPt - 44;
  const line = (text: string, y: number, preferred: number): void => {
    const bytes = toWinAnsi(text, warn);
    const at = runWidth(bytes, preferred, 0);
    // Shrink to fit rather than clip or wrap: a disclaimer cut off at the
    // right margin is worse than a disclaimer set half a point smaller.
    const size = at <= available ? preferred : Math.max(3.6, (preferred * available) / at);
    c.setFill(INK);
    c.setAlpha(1);
    c.setFont(size);
    c.setCharSpace(0);
    c.text(bytes, stripLeft, y);
  };
  line(footer.disclaimer, heightPt - 28.5, 5.6);
  line(footer.identity, heightPt - 21, 5.6);

  while (c.depth() > 0) {
    warn("A sheet left a <g> unclosed; the PDF closes it.");
    c.restore();
  }
  return { ops: c.build(), widthPt, heightPt };
}

/* =========================================================================
   7. THE FILE
   ========================================================================= */

/** Filesystem-safe, ASCII, never empty — the same shape `DrawingSheets.tsx`
 *  uses for the per-sheet .svg names, so a set and its sheets sort together in
 *  a folder. */
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "home";

/** `2026-08-14` as PDF's date syntax. Derived from the caller's parameter, so
 *  it is a fact about the ISSUE rather than about when a button was pressed —
 *  which is exactly what makes two exports of the same set identical. */
function pdfDate(dateISO: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO.trim());
  if (m === null) return "D:00000101000000Z";
  return `D:${m[1]}${m[2]}${m[3]}000000Z`;
}

export function buildDrawingSetPdf(
  set: DrawingSetResult,
  meta: DrawingSetPdfMeta,
): DrawingSetPdfResult {
  const warnings: string[] = [];
  const seen = new Set<string>();
  /* De-duplicated: eight sheets meeting the same unknown class would otherwise
     report the same defect eight times and bury the other seven. */
  const warn = (why: string): void => {
    if (seen.has(why)) return;
    seen.add(why);
    warnings.push(why);
  };

  if (set.sheets.length === 0) {
    /* A PDF with no pages is not a small PDF, it is a malformed one, and a
       reader's error message would be about this file rather than about the
       set that was empty. `drawingSet` returns eight sheets for every input,
       including a model with no volumes, so reaching here means something
       upstream returned a set nobody drew. */
    throw new Error(
      "[aura/pdf] this drawing set carries no sheets, so there is nothing to write a PDF from.",
    );
  }

  const setHash = keccak256(stringToHex(set.sheets.map((s) => s.svg).join("\n")));
  const designHash = meta.designHash ?? null;
  const alphas = new AlphaTable();

  const pages = set.sheets.map((sheet, index) =>
    renderSheet(
      sheet.svg,
      {
        disclaimer: EXPORT_DISCLAIMER,
        identity:
          `SHEET ${index + 1} OF ${set.sheets.length}  ·  ${sheet.number} ${sheet.title}  ·  ` +
          `${meta.projectName}  ·  ISSUED ${meta.dateISO}  ·  ` +
          `DESIGN HASH ${designHash ?? PDF_DESIGN_HASH_ABSENT}  ·  DRAWING SET HASH ${setHash}`,
      },
      alphas,
      warn,
    ),
  );

  /* ---- object numbering, fixed by construction so it is reproducible */
  const alphaKeys = alphas.values;
  const CATALOG = 1;
  const PAGES = 2;
  const FONT = 3;
  const RESOURCES = 4;
  const GS_FIRST = 5;
  const PAGE_FIRST = GS_FIRST + alphaKeys.length;
  const pageNum = (i: number): number => PAGE_FIRST + i * 2;
  const contentNum = (i: number): number => PAGE_FIRST + i * 2 + 1;
  const INFO = PAGE_FIRST + pages.length * 2;

  const bodies: string[] = [];
  const put = (num: number, body: string): void => {
    bodies[num] = body;
  };

  put(
    CATALOG,
    `<< /Type /Catalog /Pages ${PAGES} 0 R /PageLayout /SinglePage >>`,
  );
  put(
    PAGES,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages
      .map((_, i) => `${pageNum(i)} 0 R`)
      .join(" ")}] >>`,
  );
  put(
    FONT,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  put(
    RESOURCES,
    `<< /ProcSet [/PDF /Text] /Font << /F1 ${FONT} 0 R >>` +
      (alphaKeys.length > 0
        ? ` /ExtGState << ${alphaKeys
            .map((key, i) => `/${alphas.name(key)} ${GS_FIRST + i} 0 R`)
            .join(" ")} >>`
        : "") +
      " >>",
  );
  alphaKeys.forEach((key, i) => {
    put(GS_FIRST + i, `<< /Type /ExtGState /CA ${key} /ca ${key} >>`);
  });
  pages.forEach((page, i) => {
    put(
      pageNum(i),
      `<< /Type /Page /Parent ${PAGES} 0 R /MediaBox [0 0 ${n(page.widthPt)} ${n(page.heightPt)}] ` +
        `/Resources ${RESOURCES} 0 R /Contents ${contentNum(i)} 0 R >>`,
    );
    put(contentNum(i), `<< /Length ${page.ops.length} >>\nstream\n${page.ops}\nendstream`);
  });

  const sheetRange =
    set.sheets.length > 0
      ? `${set.sheets[0].number}-${set.sheets[set.sheets.length - 1].number}`
      : "empty";
  put(
    INFO,
    `<< /Title ${pdfTextString(`${meta.projectName} — drawing set ${sheetRange}`)} ` +
      `/Author ${pdfTextString("Aura Homes builder")} ` +
      `/Producer ${pdfTextString("Aura Homes builder — lib/builder/exportPdf.ts")} ` +
      `/Creator ${pdfTextString("Aura Homes drawing engine — lib/builder/drawings")} ` +
      `/Subject ${pdfTextString(EXPORT_DISCLAIMER)} ` +
      `/Keywords ${pdfTextString(
        `design hash ${designHash ?? PDF_DESIGN_HASH_ABSENT}; drawing set hash ${setHash}; issued ${meta.dateISO}`,
      )} ` +
      // Both dates come from the caller's issue date. Never a clock: two
      // exports of the same set have to be byte-identical to be diffable.
      `/CreationDate (${pdfDate(meta.dateISO)}) /ModDate (${pdfDate(meta.dateISO)}) >>`,
  );

  /* ---- serialise */
  const out = new Bytes();
  out.push("%PDF-1.7\n");
  // The conventional four high bytes, so anything sniffing the file treats it
  // as binary rather than as text and mangles no newlines in transit.
  out.push("%âãÏÓ\n");

  const offsets: number[] = [];
  const last = INFO;
  for (let num = 1; num <= last; num += 1) {
    offsets[num] = out.offset();
    out.push(`${num} 0 obj\n${bodies[num]}\nendobj\n`);
  }

  /* /ID is derived from the sheets themselves plus the metadata printed on
     them, so it identifies THIS document and is reproduced exactly by a second
     export of the same set. A PDF writer's default here is a random number,
     which is the difference between a diffable artifact and noise. */
  const id = keccak256(
    stringToHex([setHash, designHash ?? "none", meta.dateISO, meta.projectName].join("\n")),
  )
    .slice(2, 34)
    .toUpperCase();

  const xrefAt = out.offset();
  out.push(`xref\n0 ${last + 1}\n`);
  out.push("0000000000 65535 f \n");
  for (let num = 1; num <= last; num += 1) {
    out.push(`${String(offsets[num]).padStart(10, "0")} 00000 n \n`);
  }
  out.push(
    `trailer\n<< /Size ${last + 1} /Root ${CATALOG} 0 R /Info ${INFO} 0 R /ID [<${id}> <${id}>] >>\n`,
  );
  out.push(`startxref\n${xrefAt}\n%%EOF\n`);

  return { bytes: out.finish(), pageCount: pages.length, setHash, warnings };
}

/**
 * The whole set as one PDF, in the `ExportArtifact` shape every other export
 * returns, so it drops into the existing download plumbing with no special
 * case.
 *
 * ASYNC to match the rest of the export surface — the callers already await
 * their artifacts, and a signature that differs for one format is the kind of
 * detail a UI ends up branching on.
 */
export async function exportDrawingSetPdf(
  set: DrawingSetResult,
  meta: DrawingSetPdfMeta,
): Promise<DrawingSetPdfArtifact> {
  const built = buildDrawingSetPdf(set, meta);
  const blob = new Blob([built.bytes], { type: "application/pdf" });
  const sheets = `${built.pageCount} sheet${built.pageCount === 1 ? "" : "s"}`;
  return {
    blob,
    filename: `aura-${slug(meta.projectName)}-drawing-set.pdf`,
    mimeType: "application/pdf",
    byteLength: blob.size,
    note:
      `${sheets} · ANSI B 11×17 landscape · vector, text selectable · ` +
      `drawing set hash ${built.setHash}` +
      (built.warnings.length > 0
        ? ` · ${built.warnings.length} thing${built.warnings.length === 1 ? "" : "s"} the converter could not draw`
        : ""),
    warnings: built.warnings,
    setHash: built.setHash,
  };
}
