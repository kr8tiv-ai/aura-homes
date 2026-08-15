import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "playwright/test";

import { defaultBuilderDocument, hashBuilderDocument } from "@/lib/builder/document";
import { drawingSet, type DrawingSetResult } from "@/lib/builder/drawings";
import {
  PDF_DESIGN_HASH_ABSENT,
  buildDrawingSetPdf,
  exportDrawingSetPdf,
  type DrawingSetPdfMeta,
} from "@/lib/builder/exportPdf";
import { EXPORT_DISCLAIMER } from "@/lib/builder/exportSpec";

/* ===========================================================================
   EX04 — the drawing set as one PDF.

   THE CLAIM THIS FILE EXISTS TO MAKE FALSIFIABLE. A drawing set downloaded as
   a PDF is (1) byte-identical every time the same design is exported, (2)
   vector with real, extractable text rather than a screenshot of a drawing,
   (3) one page per sheet at the sheet's own paper size, and (4) carrying the
   same disclaimer and the same design hash as every other export.

   THE READER BELOW SHARES NO CODE WITH THE WRITER. `lib/builder/exportPdf.ts`
   is not imported by it; it walks the produced bytes the way any PDF consumer
   would — startxref, the cross-reference table, each object at its stated
   offset, each content stream at its stated /Length — and fails on a file
   whose own bookkeeping is wrong. A test that asked the writer to describe
   its own output would pass on a file no reader could open, which is exactly
   the class of failure this project takes most seriously.
   =========================================================================== */

const DATE = "2026-08-14";
const PROJECT = "Aura Reference Home";

const document = defaultBuilderDocument();
const DESIGN_HASH = hashBuilderDocument(document);

/** A set with a PARCEL on it, so A1 exercises the one `<g transform="rotate">`
 *  the drawing kit emits and the converter's transform path is under test
 *  rather than merely present. */
const buildSet = (): DrawingSetResult =>
  drawingSet({
    document,
    dateISO: DATE,
    projectName: PROJECT,
    address: "Range Road 33, Foothills County, Alberta",
    parcel: {
      lotWidthFt: 120,
      lotDepthFt: 160,
      frontSetbackFt: 25,
      sideSetbackFt: 10,
      rearSetbackFt: 25,
      accessNote: "Driveway from the north-east corner",
      wellAndSeptic: true,
    },
  });

const meta = (over: Partial<DrawingSetPdfMeta> = {}): DrawingSetPdfMeta => ({
  projectName: PROJECT,
  dateISO: DATE,
  designHash: DESIGN_HASH,
  ...over,
});

/* =========================================================================
   AN INDEPENDENT PDF READER
   ========================================================================= */

/** The bytes as one code unit per byte, which is how a PDF's syntax layer is
 *  defined: ASCII structure around binary-safe strings. */
const latin1 = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
};

interface PdfPage {
  mediaBox: number[];
  /** The decoded content stream. */
  content: string;
}

interface ReadPdf {
  version: string;
  objects: Map<number, string>;
  trailer: string;
  pages: PdfPage[];
  raw: string;
}

/**
 * Parse enough of a PDF to prove the file is one.
 *
 * Deliberately intolerant. Every `throw` here is a structural defect a reader
 * would hit: a wrong xref offset, an object that is not where the table says,
 * a /Length that does not match the stream it measures. A lenient reader would
 * let a broken file pass every assertion below it.
 */
function readPdf(bytes: Uint8Array): ReadPdf {
  const raw = latin1(bytes);
  const header = /^%PDF-(\d\.\d)/.exec(raw);
  if (header === null) throw new Error("no %PDF header");

  const startxrefAt = raw.lastIndexOf("startxref");
  if (startxrefAt === -1) throw new Error("no startxref");
  const startxref = /startxref\s+(\d+)\s/.exec(raw.slice(startxrefAt));
  if (startxref === null) throw new Error("startxref carries no offset");
  if (!raw.trimEnd().endsWith("%%EOF")) throw new Error("no %%EOF");

  const xrefAt = Number(startxref[1]);
  if (!raw.startsWith("xref\n", xrefAt)) {
    throw new Error(`startxref points at ${xrefAt}, which is not an xref table`);
  }
  const head = /^xref\n(\d+) (\d+)\n/.exec(raw.slice(xrefAt));
  if (head === null) throw new Error("malformed xref subsection header");
  const first = Number(head[1]);
  const count = Number(head[2]);
  const entriesAt = xrefAt + head[0].length;

  const objects = new Map<number, string>();
  for (let i = 0; i < count; i += 1) {
    const entry = raw.slice(entriesAt + i * 20, entriesAt + i * 20 + 20);
    if (entry.length !== 20) throw new Error(`xref entry ${i} is not 20 bytes`);
    const parsed = /^(\d{10}) (\d{5}) ([nf]) $/.exec(entry.slice(0, 19));
    if (parsed === null) throw new Error(`xref entry ${i} is malformed: ${JSON.stringify(entry)}`);
    if (parsed[3] === "f") continue;
    const num = first + i;
    const at = Number(parsed[1]);
    const opener = `${num} 0 obj\n`;
    if (!raw.startsWith(opener, at)) {
      throw new Error(
        `xref says object ${num} is at ${at}, and the bytes there are ${JSON.stringify(raw.slice(at, at + 24))}`,
      );
    }
    const bodyAt = at + opener.length;
    const endAt = raw.indexOf("\nendobj\n", bodyAt);
    if (endAt === -1) throw new Error(`object ${num} never ends`);
    objects.set(num, raw.slice(bodyAt, endAt));
  }

  const trailerAt = raw.lastIndexOf("trailer");
  if (trailerAt === -1) throw new Error("no trailer");
  const trailer = raw.slice(trailerAt, startxrefAt);

  /* ---- the page tree, in Kids order */
  const rootRef = /\/Root (\d+) 0 R/.exec(trailer);
  if (rootRef === null) throw new Error("the trailer names no /Root");
  const catalog = objects.get(Number(rootRef[1]));
  if (catalog === undefined) throw new Error("the /Root object is missing");
  const pagesRef = /\/Pages (\d+) 0 R/.exec(catalog);
  if (pagesRef === null) throw new Error("the catalog names no /Pages");
  const pagesObj = objects.get(Number(pagesRef[1]));
  if (pagesObj === undefined) throw new Error("the /Pages object is missing");
  const kids = /\/Kids \[([^\]]*)\]/.exec(pagesObj);
  if (kids === null) throw new Error("the page tree carries no /Kids");
  const kidNums = Array.from(kids[1].matchAll(/(\d+) 0 R/g), (m) => Number(m[1]));

  const pages: PdfPage[] = kidNums.map((num) => {
    const page = objects.get(num);
    if (page === undefined) throw new Error(`page object ${num} is missing`);
    const box = /\/MediaBox \[([^\]]*)\]/.exec(page);
    if (box === null) throw new Error(`page ${num} carries no /MediaBox`);
    const contentsRef = /\/Contents (\d+) 0 R/.exec(page);
    if (contentsRef === null) throw new Error(`page ${num} carries no /Contents`);
    const streamObj = objects.get(Number(contentsRef[1]));
    if (streamObj === undefined) throw new Error(`content object for page ${num} is missing`);
    const lengthRef = /\/Length (\d+)/.exec(streamObj);
    if (lengthRef === null) throw new Error(`content stream for page ${num} declares no /Length`);
    const dataAt = streamObj.indexOf("stream\n");
    if (dataAt === -1) throw new Error(`content object for page ${num} holds no stream`);
    const from = dataAt + "stream\n".length;
    const declared = Number(lengthRef[1]);
    const tail = streamObj.slice(from + declared);
    if (!tail.startsWith("\nendstream")) {
      throw new Error(
        `page ${num} declares /Length ${declared} and the bytes there are ${JSON.stringify(tail.slice(0, 24))}`,
      );
    }
    return {
      mediaBox: box[1].trim().split(/\s+/).map(Number),
      content: streamObj.slice(from, from + declared),
    };
  });

  return { version: header[1], objects, trailer, pages, raw };
}

/** WinAnsiEncoding, written out here independently of the writer's table. */
const WINANSI_LOW: Readonly<Record<number, string>> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…",
  0x86: "†", 0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8a: "Š",
  0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘", 0x92: "’",
  0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ",
  0x9e: "ž", 0x9f: "Ÿ",
};

/** Every `(…) Tj` operand on a page, decoded — which is what a text extractor,
 *  a copy-paste, and a Ctrl-F in a PDF reader all see. Pixels have no Tj. */
function extractText(content: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < content.length) {
    const open = content.indexOf("(", i);
    if (open === -1) break;
    let j = open + 1;
    const bytes: number[] = [];
    while (j < content.length && content[j] !== ")") {
      if (content[j] === "\\") {
        const next = content[j + 1];
        if (next !== undefined && next >= "0" && next <= "7") {
          const oct = /^[0-7]{1,3}/.exec(content.slice(j + 1, j + 4))?.[0] ?? "0";
          bytes.push(Number.parseInt(oct, 8));
          j += 1 + oct.length;
          continue;
        }
        const simple: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 };
        bytes.push(simple[next ?? ""] ?? (next ?? "").charCodeAt(0));
        j += 2;
        continue;
      }
      bytes.push(content.charCodeAt(j));
      j += 1;
    }
    const after = content.slice(j + 1, j + 6);
    i = j + 1;
    if (!/^\s*Tj/.test(after)) continue;
    out.push(
      bytes
        .map((b) => (WINANSI_LOW[b] !== undefined ? WINANSI_LOW[b] : String.fromCharCode(b)))
        .join(""),
    );
  }
  return out.join("\n");
}

/** Paint operators on their own line, which is how the writer emits them. */
const countPaints = (content: string): number =>
  content.split("\n").filter((line) => ["f", "f*", "S", "B", "B*"].includes(line.trim())).length;

/** Drawn marks in a sheet's SVG, counted in the SVG. */
function countSvgMarks(svg: string): number {
  let total = 0;
  for (const tag of ["<rect", "<line", "<circle", "<path"]) {
    let at = svg.indexOf(tag);
    while (at !== -1) {
      total += 1;
      at = svg.indexOf(tag, at + tag.length);
    }
  }
  return total;
}

function firstDifference(a: Uint8Array, b: Uint8Array): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i += 1) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : shared;
}

/** Assert byte identity WITHOUT printing a megabyte of hex into a failure. */
function expectSameBytes(a: Uint8Array, b: Uint8Array): void {
  const at = firstDifference(a, b);
  if (at === -1) return;
  const window = (v: Uint8Array): string => JSON.stringify(latin1(v.slice(Math.max(0, at - 40), at + 40)));
  throw new Error(
    `the two generations differ at byte ${at} of ${a.length}/${b.length}\n  A: ${window(a)}\n  B: ${window(b)}`,
  );
}

/* =========================================================================
   1. DETERMINISM — the gate the whole node turns on
   ========================================================================= */

test("two generations of the same set are byte-identical", () => {
  const set = buildSet();
  const first = buildDrawingSetPdf(set, meta()).bytes;
  const second = buildDrawingSetPdf(set, meta()).bytes;
  expect(first.length).toBeGreaterThan(10_000);
  expectSameBytes(first, second);

  /* And from a set built a second time from the same document, so the claim
     covers the whole chain rather than one cached object. */
  const rebuilt = buildDrawingSetPdf(buildSet(), meta()).bytes;
  expectSameBytes(first, rebuilt);
});

test("nothing in the writer reads a clock or a random number generator", () => {
  const set = buildSet();
  const realDate = globalThis.Date;
  const realRandom = Math.random;

  const at = (millis: number): Uint8Array => {
    class Frozen extends realDate {
      constructor(...args: unknown[]) {
        super(...((args.length === 0 ? [millis] : args) as [number]));
      }
      static now(): number {
        return millis;
      }
    }
    globalThis.Date = Frozen as unknown as DateConstructor;
    return buildDrawingSetPdf(set, meta()).bytes;
  };

  try {
    Math.random = () => 0.125;
    const early = at(Date.parse("2001-02-03T04:05:06Z"));
    Math.random = () => 0.875;
    const late = at(Date.parse("2031-12-25T18:19:20Z"));
    /* Thirty years and two different random streams apart. A single
       `Date.now()` or `Math.random()` anywhere under `buildDrawingSetPdf`
       makes these two files differ, and this test names the byte. */
    expectSameBytes(early, late);
  } finally {
    globalThis.Date = realDate;
    Math.random = realRandom;
  }
});

test("the issue date is really carried, so byte-identity is not the identity of a constant", () => {
  const set = buildSet();
  const august = buildDrawingSetPdf(set, meta()).bytes;
  const september = buildDrawingSetPdf(set, meta({ dateISO: "2026-09-01" })).bytes;
  expect(firstDifference(august, september)).not.toBe(-1);

  /* And the dates in the document information dictionary are the ISSUE date,
     not a clock: same design, different issue, different /CreationDate. */
  const info = (bytes: Uint8Array): string => {
    const read = readPdf(bytes);
    const ref = /\/Info (\d+) 0 R/.exec(read.trailer);
    if (ref === null) throw new Error("the trailer names no /Info");
    return read.objects.get(Number(ref[1])) ?? "";
  };
  expect(info(august)).toContain("/CreationDate (D:20260814000000Z)");
  expect(info(august)).toContain("/ModDate (D:20260814000000Z)");
  expect(info(september)).toContain("/CreationDate (D:20260901000000Z)");
  expect(info(september)).not.toContain("D:20260814000000Z");
});

/* =========================================================================
   2. THE FILE IS A PDF, AND IT HAS ONE PAGE PER SHEET
   ========================================================================= */

test("the file parses as a PDF and carries one page per sheet, at the sheet's own paper size", () => {
  const set = buildSet();
  const pdf = readPdf(buildDrawingSetPdf(set, meta()).bytes);

  expect(pdf.version).toBe("1.7");
  expect(pdf.pages).toHaveLength(set.sheets.length);
  expect(set.sheets.length).toBe(8);

  for (const page of pdf.pages) {
    // ANSI B, 11x17 landscape, in points — the paper drawings/kit.ts sizes to.
    expect(page.mediaBox).toEqual([0, 0, 17 * 72, 11 * 72]);
  }
});

test("the pages are in A0…A7 order", () => {
  const set = buildSet();
  const pdf = readPdf(buildDrawingSetPdf(set, meta()).bytes);
  pdf.pages.forEach((page, i) => {
    const text = extractText(page.content);
    const sheet = set.sheets[i];
    expect(sheet.number).toBe(`A${i}`);
    expect(text).toContain(`SHEET ${i + 1} OF 8  ·  ${sheet.number} ${sheet.title}`);
  });
});

/* =========================================================================
   3. VECTOR, NOT RASTER
   ========================================================================= */

test("the drawings are vector: real text and real paths, and no image anywhere", () => {
  const set = buildSet();
  const built = buildDrawingSetPdf(set, meta());
  const pdf = readPdf(built.bytes);

  // Real text in a real font, not glyph-shaped pixels.
  const fonts = Array.from(pdf.objects.values()).filter((body) => body.includes("/Type /Font"));
  expect(fonts).toHaveLength(1);
  expect(fonts[0]).toContain("/BaseFont /Helvetica");
  expect(fonts[0]).toContain("/Encoding /WinAnsiEncoding");

  // A raster conversion would put the whole sheet in an image XObject. There
  // is no image, no image filter, and no XObject of any kind in this file.
  expect(pdf.raw).not.toContain("/Subtype /Image");
  expect(pdf.raw).not.toContain("/XObject");
  expect(pdf.raw).not.toContain("/DCTDecode");
  expect(pdf.raw).not.toContain("/JPXDecode");
  expect(pdf.raw).not.toContain("/CCITTFaxDecode");

  // Dimension strings and sheet titles come back out as text.
  const floor = pdf.pages[3];
  expect(set.sheets[3].title).toBe("FLOOR PLAN");
  const text = extractText(floor.content);
  expect(text).toContain("FLOOR PLAN");
  expect(text).toContain("SCALE");
  expect(text.length).toBeGreaterThan(1_000);

  expect(built.warnings).toEqual([]);
});

test("every mark the sheet draws reaches the PDF as a painted path", () => {
  const set = buildSet();
  const pdf = readPdf(buildDrawingSetPdf(set, meta()).bytes);
  set.sheets.forEach((sheet, i) => {
    const marks = countSvgMarks(sheet.svg);
    expect(marks).toBeGreaterThan(20);
    /* Exactly equal, not "at least": a converter that quietly dropped the
       one element type it did not recognise would still satisfy a floor. */
    expect(countPaints(pdf.pages[i].content)).toBe(marks);
  });
});

/* =========================================================================
   3b. …AND IN THE PLACE THE SHEET DREW IT

   EX05. The assertion above counts. A count is necessary and it is not
   sufficient: a converter that emitted every mark at the origin, or shifted
   twelve points right, or with x and y swapped, satisfies it EXACTLY. The
   whole of the drawing's meaning is where the marks are, so position and
   extent have to enter the assertion, and the two readers below put them
   there. `markPlacementProblems` is a pure function of (sheet SVG, page
   content stream), which is what lets the last test in this section prove on
   synthetic input that it really can go red — see "counting cannot tell them
   apart" below.

   WHAT FRAME THE COMPARISON HAPPENS IN. The converter's own note is that the
   SVG coordinate system IS the PDF coordinate system at 1:1, reached by one
   flipping `cm` per page and one more `cm` per rotation. So a mark's operands
   in the content stream should be the sheet's own attribute numbers, byte for
   byte, and they are compared here in that LOCAL frame. The transforms
   themselves — the page flip and every rotation — are then checked separately
   and exactly, so "ignored the flip" and "rotated the wrong way" are caught
   by the test after this one rather than falling through the gap.
   ========================================================================= */

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Pt = readonly [number, number];

const boxOf = (pts: readonly Pt[]): Box | null => {
  if (pts.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
};

const r3 = (v: number): string => String(Math.round(v * 1000) / 1000);
const showBox = (b: Box | null): string =>
  b === null ? "nothing drawn" : `x ${r3(b.x0)}…${r3(b.x1)}, y ${r3(b.y0)}…${r3(b.y1)}`;
const showPt = (p: Pt | null): string => (p === null ? "nowhere" : `(${r3(p[0])}, ${r3(p[1])})`);

/** Three decimals is all `n()` in the writer keeps, so half a thousandth is
 *  the largest honest disagreement between a rounded operand and the exact
 *  attribute it came from. Doubled, and no more: the point of this gate is
 *  that a mark twelve points out of place fails, and a tolerance wide enough
 *  to be comfortable is a tolerance wide enough to hide one. */
const PLACE_EPS = 0.002;

interface SvgMark {
  tag: string;
  /** Where the sheet says the mark begins, when the element pins that down.
   *  A <circle> does not — its start point is the converter's own choice of
   *  which quadrant to open at — so circles are matched on extent alone. */
  first: Pt | null;
  box: Box | null;
  /** How far outside its own stated coordinates a mark may legitimately
   *  reach. Zero for everything straight. */
  slack: number;
}

const D_TOKENS = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/**
 * The coordinates a path `d` states, and how far a curve inside it may bulge
 * past them.
 *
 * Deliberately intolerant of any command outside the M/L/Z/A vocabulary
 * `drawings/kit.ts` emits: a reader that shrugged at an unknown command would
 * silently stop measuring the mark it was asked to measure.
 */
function readPathData(d: string): { pts: Pt[]; slack: number } {
  const tokens = d.match(D_TOKENS) ?? [];
  const pts: Pt[] = [];
  let slack = 0;
  let i = 0;
  const num = (): number => {
    const v = Number(tokens[i]);
    i += 1;
    if (!Number.isFinite(v)) throw new Error(`path data ${JSON.stringify(d)} is missing a number`);
    return v;
  };
  const moreNumbers = (): boolean => i < tokens.length && !/^[A-Za-z]$/.test(tokens[i]);
  while (i < tokens.length) {
    const cmd = tokens[i];
    i += 1;
    if (cmd === "M" || cmd === "L") {
      while (moreNumbers()) {
        const x = num();
        pts.push([x, num()]);
      }
    } else if (cmd === "Z") {
      /* closes back onto a point already recorded */
    } else if (cmd === "A") {
      while (moreNumbers()) {
        const rx = Math.abs(num());
        const ry = Math.abs(num());
        num(); // x-axis rotation
        num(); // large-arc flag
        num(); // sweep flag
        const x = num();
        pts.push([x, num()]);
        /* An arc has to become cubics in a PDF, and a quadrant's control
           points sit at most (4/3)·tan(π/8) = 0.5523 of a radius outside the
           arc itself. That is the entire legitimate bulge, so it is the entire
           allowance — not a round number chosen to make the test pass. */
        slack = Math.max(slack, 0.5523 * Math.max(rx, ry));
      }
    } else {
      throw new Error(
        `the sheet drew path command "${cmd}", which this reader does not measure; ` +
          `teach it that command rather than letting the gate guess`,
      );
    }
  }
  return { pts, slack };
}

/** Six-number affine matrix in SVG/PDF order. */
type Matrix6 = readonly [number, number, number, number, number, number];

/**
 * `rotate(angle,cx,cy)` as a matrix, composed here from translate · rotate ·
 * translate rather than copied from the writer's closed form, so agreement
 * between the two is evidence rather than tautology.
 */
function rotateMatrix(spec: string): Matrix6 {
  const m = /^rotate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/.exec(spec.trim());
  if (m === null) throw new Error(`the sheet carries the transform ${JSON.stringify(spec)}`);
  const a = (Number(m[1]) * Math.PI) / 180;
  const cx = Number(m[2]);
  const cy = Number(m[3]);
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return [cos, sin, -sin, cos, cx - (cos * cx - sin * cy), cy - (sin * cx + cos * cy)];
}

const ATTRS = /([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g;

const attrsOf = (source: string): Record<string, string> => {
  const out: Record<string, string> = {};
  ATTRS.lastIndex = 0;
  let m = ATTRS.exec(source);
  while (m !== null) {
    out[m[1]] = m[2];
    m = ATTRS.exec(source);
  }
  return out;
};

const numAttr = (a: Record<string, string>, key: string): number => {
  const v = Number.parseFloat(a[key] ?? "0");
  return Number.isFinite(v) ? v : 0;
};

interface ReadSheet {
  marks: SvgMark[];
  /** Every rotation the sheet asks for, in the order the sheet asks for it. */
  transforms: Matrix6[];
  /** The page the sheet says it is, from its own viewBox. */
  viewBox: number[];
}

/**
 * The sheet's own markup, read as geometry.
 *
 * `kit.ts` escapes "<" and ">" inside every body and every attribute value, so
 * an element scan of this shape is exact for these sheets rather than
 * approximate — the same bargain the converter itself makes, reached
 * independently.
 */
function readSheetSvg(svg: string): ReadSheet {
  const EL = /<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  const marks: SvgMark[] = [];
  const transforms: Matrix6[] = [];
  let viewBox: number[] = [];
  let m = EL.exec(svg);
  while (m !== null) {
    const tag = m[1];
    const attrs = attrsOf(m[2]);
    if (tag === "svg") {
      viewBox = (attrs.viewBox ?? "").trim().split(/[\s,]+/).map(Number);
    } else if (tag === "title" || tag === "style") {
      const close = svg.indexOf(`</${tag}>`, EL.lastIndex);
      EL.lastIndex = close === -1 ? svg.length : close + tag.length + 3;
    } else if (tag === "g") {
      if (attrs.transform !== undefined) transforms.push(rotateMatrix(attrs.transform));
    } else if (tag === "text") {
      const close = svg.indexOf("</text>", EL.lastIndex);
      const body = close === -1 ? "" : svg.slice(EL.lastIndex, close);
      EL.lastIndex = close === -1 ? svg.length : close + 7;
      /* An empty label is not lettered and so asks for no transform — the
         converter returns before it saves the state. Mirrored here so the
         two sequences stay comparable element for element. */
      if (attrs.transform !== undefined && body.length > 0) {
        transforms.push(rotateMatrix(attrs.transform));
      }
    } else if (tag === "rect") {
      const x = numAttr(attrs, "x");
      const y = numAttr(attrs, "y");
      const w = numAttr(attrs, "width");
      const h = numAttr(attrs, "height");
      marks.push({
        tag,
        first: [x, y],
        box: boxOf([
          [x, y],
          [x + w, y + h],
        ]),
        slack: 0,
      });
    } else if (tag === "line") {
      const x1 = numAttr(attrs, "x1");
      const y1 = numAttr(attrs, "y1");
      marks.push({
        tag,
        first: [x1, y1],
        box: boxOf([
          [x1, y1],
          [numAttr(attrs, "x2"), numAttr(attrs, "y2")],
        ]),
        slack: 0,
      });
    } else if (tag === "circle") {
      const cx = numAttr(attrs, "cx");
      const cy = numAttr(attrs, "cy");
      const r = numAttr(attrs, "r");
      marks.push({
        tag,
        first: null,
        box: boxOf([
          [cx - r, cy - r],
          [cx + r, cy + r],
        ]),
        slack: 0,
      });
    } else if (tag === "path") {
      const read = readPathData(attrs.d ?? "");
      marks.push({ tag, first: read.pts[0] ?? null, box: boxOf(read.pts), slack: read.slack });
    }
    m = EL.exec(svg);
  }
  return { marks, transforms, viewBox };
}

const GEOMETRY_OPS = new Set(["m", "l", "c", "re", "h"]);
const PAINT_OPS = new Set(["f", "f*", "S", "B", "B*"]);
/** `n` ends a path and paints NOTHING. It is a terminator, not a mark, so the
 *  geometry under it is discarded rather than counted — which is what makes
 *  "emitted the geometry and never painted it" show up below as a missing
 *  path rather than as a present one. */
const DISCARD_OPS = new Set(["n"]);

interface PaintedPath {
  op: string;
  first: Pt | null;
  box: Box | null;
}

/**
 * Every painted path on a page, with the geometry that was painted.
 *
 * Control points are collected alongside on-path points on purpose: for the
 * four-Bézier circle the converter draws, the control hull's extent IS the
 * circle's extent, and for an arc it is the bulge the slack above budgets for.
 * Nothing here reads a `cm`; the transforms are checked on their own.
 */
function paintedPaths(content: string): PaintedPath[] {
  const out: PaintedPath[] = [];
  let pts: Pt[] = [];
  for (const line of content.split("\n")) {
    const tokens = line.trim().split(/\s+/);
    const op = tokens[tokens.length - 1];
    if (GEOMETRY_OPS.has(op)) {
      const v = tokens.slice(0, -1).map(Number);
      if (op === "m" || op === "l") pts.push([v[0], v[1]]);
      else if (op === "c") pts.push([v[0], v[1]], [v[2], v[3]], [v[4], v[5]]);
      else if (op === "re") pts.push([v[0], v[1]], [v[0] + v[2], v[1] + v[3]]);
      // "h" closes onto a point already recorded
    } else if (PAINT_OPS.has(op)) {
      out.push({ op, first: pts[0] ?? null, box: boxOf(pts) });
      pts = [];
    } else if (DISCARD_OPS.has(op)) {
      pts = [];
    }
  }
  return out;
}

/** Every `cm` on a page, in order. */
const pdfTransforms = (content: string): Matrix6[] =>
  content
    .split("\n")
    .filter((line) => line.trim().endsWith(" cm"))
    .map((line) => line.trim().split(/\s+/).slice(0, 6).map(Number) as unknown as Matrix6);

/**
 * What the sheet drew, against what the page painted — matched one to one, in
 * order, on POSITION and EXTENT. Returns one sentence per disagreement.
 */
function markPlacementProblems(svg: string, content: string): string[] {
  const { marks } = readSheetSvg(svg);
  const paths = paintedPaths(content);
  const problems: string[] = [];
  if (marks.length !== paths.length) {
    problems.push(`the sheet draws ${marks.length} marks and the page paints ${paths.length} paths`);
  }
  const pairs = Math.min(marks.length, paths.length);
  for (let i = 0; i < pairs; i += 1) {
    const mark = marks[i];
    const path = paths[i];
    const where = `mark ${i} (<${mark.tag}>)`;
    /* A <circle> carries no stated start point — which quadrant a converter
       opens the four Béziers at is its own business — so a circle is matched
       on extent alone and skips this half. Everything else states where it
       begins, and a mark that begins somewhere else is a mark in the wrong
       place even when its extent happens to match. */
    if (mark.first !== null) {
      if (path.first === null) {
        problems.push(`${where} starts at ${showPt(mark.first)} on the sheet and paints no geometry at all`);
      } else {
        const off = Math.max(
          Math.abs(mark.first[0] - path.first[0]),
          Math.abs(mark.first[1] - path.first[1]),
        );
        if (off > PLACE_EPS) {
          problems.push(
            `${where} starts at ${showPt(mark.first)} on the sheet and at ${showPt(path.first)} on the page`,
          );
        }
      }
    }
    if (mark.box === null || path.box === null) {
      if (mark.box !== path.box) {
        problems.push(`${where} covers ${showBox(mark.box)} on the sheet and ${showBox(path.box)} on the page`);
      }
      continue;
    }
    const grew = mark.slack + PLACE_EPS;
    const inside =
      path.box.x0 >= mark.box.x0 - grew &&
      path.box.y0 >= mark.box.y0 - grew &&
      path.box.x1 <= mark.box.x1 + grew &&
      path.box.y1 <= mark.box.y1 + grew;
    const covers =
      path.box.x0 <= mark.box.x0 + PLACE_EPS &&
      path.box.y0 <= mark.box.y0 + PLACE_EPS &&
      path.box.x1 >= mark.box.x1 - PLACE_EPS &&
      path.box.y1 >= mark.box.y1 - PLACE_EPS;
    if (!inside || !covers) {
      problems.push(
        `${where} covers ${showBox(mark.box)} on the sheet and ${showBox(path.box)} on the page` +
          (mark.slack > 0 ? ` (curve allowance ${r3(mark.slack)} pt)` : ""),
      );
    }
  }
  return problems;
}

test("every mark reaches the PDF at the position and the extent the sheet drew it", () => {
  const set = buildSet();
  const pdf = readPdf(buildDrawingSetPdf(set, meta()).bytes);
  let measured = 0;
  set.sheets.forEach((sheet, i) => {
    const problems = markPlacementProblems(sheet.svg, pdf.pages[i].content);
    expect(problems, `sheet ${sheet.number} ${sheet.title}:\n  ${problems.join("\n  ")}`).toEqual([]);
    measured += readSheetSvg(sheet.svg).marks.length;
  });
  /* Not a formality. If the readers above ever stop finding marks, every
     comparison becomes trivially true and this gate becomes the vacuum it
     was written to replace. */
  expect(measured).toBeGreaterThan(600);
});

test("the page flip and every rotation reach the PDF as the transform the sheet asked for", () => {
  const set = buildSet();
  const pdf = readPdf(buildDrawingSetPdf(set, meta()).bytes);
  let rotations = 0;
  set.sheets.forEach((sheet, i) => {
    const { transforms, viewBox } = readSheetSvg(sheet.svg);
    const applied = pdfTransforms(pdf.pages[i].content);
    const where = `sheet ${sheet.number}`;

    /* The page opens with the one matrix that turns SVG's downward y into
       PDF's upward y. Get this wrong and every mark on the sheet is in the
       wrong place while every count stays right — which is precisely the
       failure the count above cannot see. */
    const flip: Matrix6 = [1, 0, 0, -1, -viewBox[0], viewBox[1] + viewBox[3]];
    expect(applied.length, `${where}: no transform at all`).toBeGreaterThan(0);
    applied[0].forEach((v, k) => {
      expect(Math.abs(v - flip[k]), `${where}: page flip is ${applied[0].join(" ")}, expected ${flip.join(" ")}`)
        .toBeLessThan(0.0011);
    });

    expect(applied.length - 1, `${where}: rotations`).toBe(transforms.length);
    transforms.forEach((want, t) => {
      const got = applied[t + 1];
      got.forEach((v, k) => {
        expect(
          Math.abs(v - want[k]),
          `${where}: rotation ${t} is ${got.join(" ")}, the sheet asked for ${want.map(r3).join(" ")}`,
        ).toBeLessThan(0.0011);
      });
    });
    rotations += transforms.length;
  });
  // A0 carries none; the site plan's north arrow and every rotated dimension
  // string across the set carry the rest.
  expect(rotations).toBeGreaterThan(20);
});

test("counting cannot tell a right drawing from a displaced one, and the placement reader can", () => {
  /* The falsifiability proof for the two tests above, on input small enough to
     read. Both streams below paint exactly the same number of paths with
     exactly the same operators; the second one draws the rectangle twelve
     points to the right. `countPaints` — the whole of the old assertion —
     reports the two as identical. */
  const svg =
    '<svg viewBox="0 0 100 100"><rect x="10" y="20" width="30" height="40" class="adw-ink" stroke-width="1"/>' +
    '<line x1="5" y1="6" x2="7" y2="8" class="adw-ink" stroke-width="1"/></svg>';
  const faithful = ["1 0 0 -1 0 100 cm", "0 0 0 RG", "1 w", "10 20 30 40 re", "S", "5 6 m", "7 8 l", "S"].join("\n");
  const displaced = faithful.replace("10 20 30 40 re", "22 20 30 40 re");

  expect(countPaints(faithful)).toBe(2);
  expect(countPaints(displaced)).toBe(countPaints(faithful));
  expect(countSvgMarks(svg)).toBe(2);

  expect(markPlacementProblems(svg, faithful)).toEqual([]);
  const caught = markPlacementProblems(svg, displaced);
  /* Both halves of the reader fire, and they name the rectangle, where the
     sheet put it, and where the page put it instead. */
  expect(caught).toEqual([
    "mark 0 (<rect>) starts at (10, 20) on the sheet and at (22, 20) on the page",
    "mark 0 (<rect>) covers x 10…40, y 20…60 on the sheet and x 22…52, y 20…60 on the page",
  ]);

  /* And extent alone catches a mark whose start point is untouched: the same
     rectangle drawn at twice the width begins in exactly the right place. */
  const stretched = markPlacementProblems(svg, faithful.replace("10 20 30 40 re", "10 20 60 40 re"));
  expect(stretched).toEqual([
    "mark 0 (<rect>) covers x 10…40, y 20…60 on the sheet and x 10…70, y 20…60 on the page",
  ]);

  /* The other half of the finding this gate was written for: a converter that
     PAINTS THE RIGHT NUMBER OF THINGS AND DRAWS NONE OF THEM. `countPaints`
     reads two and two here as well. */
  const hollow = ["1 0 0 -1 0 100 cm", "0 0 0 RG", "1 w", "S", "S"].join("\n");
  expect(countPaints(hollow)).toBe(countPaints(faithful));
  expect(markPlacementProblems(svg, hollow)).toEqual([
    "mark 0 (<rect>) starts at (10, 20) on the sheet and paints no geometry at all",
    "mark 0 (<rect>) covers x 10…40, y 20…60 on the sheet and nothing drawn on the page",
    "mark 1 (<line>) starts at (5, 6) on the sheet and paints no geometry at all",
    "mark 1 (<line>) covers x 5…7, y 6…8 on the sheet and nothing drawn on the page",
  ]);

  /* And the mirror image: geometry emitted, then ended with `n`, which paints
     nothing. The page looks busy in a hex dump and blank on paper. */
  const unpainted = faithful.replace(/^S$/gm, "n");
  expect(markPlacementProblems(svg, unpainted)).toEqual([
    "the sheet draws 2 marks and the page paints 0 paths",
  ]);

  // …and half a thousandth of a point, which is all the writer's rounding can
  // account for, is NOT a failure. A gate that fires on rounding gets muted.
  expect(markPlacementProblems(svg, faithful.replace("10 20 30 40 re", "10.0005 20 30 40 re"))).toEqual([]);
});

/* =========================================================================
   4. THE DISCLAIMER AND THE DESIGN HASH TRAVEL IN THE FILE
   ========================================================================= */

test("every page carries the export disclaimer and the design hash as extractable text", () => {
  const set = buildSet();
  const built = buildDrawingSetPdf(set, meta());
  const pdf = readPdf(built.bytes);

  for (const page of pdf.pages) {
    const text = extractText(page.content);
    expect(text).toContain(EXPORT_DISCLAIMER);
    expect(text).toContain(`DESIGN HASH ${DESIGN_HASH}`);
    expect(text).toContain(`DRAWING SET HASH ${built.setHash}`);
    expect(text).toContain(`ISSUED ${DATE}`);
  }
});

test("a missing design hash is printed as missing rather than quietly omitted", () => {
  const set = buildSet();
  const pdf = readPdf(buildDrawingSetPdf(set, meta({ designHash: null })).bytes);
  const text = extractText(pdf.pages[0].content);
  expect(text).toContain(`DESIGN HASH ${PDF_DESIGN_HASH_ABSENT}`);
  expect(text).toContain(EXPORT_DISCLAIMER);
  expect(text).not.toContain(DESIGN_HASH);
});

/* =========================================================================
   5. THE ARTIFACT DROPS INTO THE EXISTING DOWNLOAD PLUMBING
   ========================================================================= */

test("the artifact is the same shape every other export returns, over the same bytes", async () => {
  const set = buildSet();
  const artifact = await exportDrawingSetPdf(set, meta());

  expect(artifact.mimeType).toBe("application/pdf");
  expect(artifact.filename).toBe("aura-aura-reference-home-drawing-set.pdf");
  expect(artifact.blob.type).toBe("application/pdf");
  expect(artifact.byteLength).toBe(artifact.blob.size);
  expect(artifact.warnings).toEqual([]);
  expect(artifact.note).toContain("8 sheets");
  expect(artifact.note).toContain(artifact.setHash);

  // The blob really holds the bytes the builder produced — one generation,
  // one set of bytes, no second code path between the two.
  const saved = new Uint8Array(await artifact.blob.arrayBuffer());
  expectSameBytes(saved, buildDrawingSetPdf(set, meta()).bytes);
});

/* =========================================================================
   6. WHAT THE PANEL MAY AND MAY NOT DO

   Source assertions, because these two claims are about how the module is
   REACHED rather than about what it returns, and the pure runner has no DOM
   to mount the component in.
   ========================================================================= */

const drawingSheetsSource = (): string =>
  readFileSync(join(__dirname, "..", "components", "builder", "DrawingSheets.tsx"), "utf8");

const exportPdfSource = (): string =>
  readFileSync(join(__dirname, "..", "lib", "builder", "exportPdf.ts"), "utf8");

/**
 * Every module a source pulls in STATICALLY — by specifier, not by line.
 *
 * EX05 REPLACED the shape this used to be tested with. The old matcher was
 * `/^import\s[^;]*?from\s+"[^"]+";/gm`, and the `from` in it was load-bearing
 * in the wrong direction: `import "@/lib/builder/exportPdf";` — a bare
 * side-effect import, which puts the converter and its 256-entry Helvetica
 * table in the entry graph exactly as firmly as a named one — matched nothing,
 * so the loop below it ran over a list the offending line was not in and the
 * guard reported clean. `export … from` had the same hole. Both are matched
 * here; the dynamic `import(...)` form deliberately is not, because that is
 * the shape the whole arrangement exists to require.
 */
function staticModuleSpecifiers(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  return Array.from(
    code.matchAll(/^[ \t]*(?:import|export)\s+(?:[^;'"]*?\bfrom\s+)?["']([^"']+)["']\s*;?/gm),
    (m) => m[1],
  );
}

test("the import-shape guard sees a bare side-effect import, which the shape it replaced could not", () => {
  const bare = 'import "@/lib/builder/exportPdf";\nexport const A = 1;\n';
  const named = 'import { buildDrawingSetPdf } from "@/lib/builder/exportPdf";\n';
  const reexported = 'export * from "@/lib/builder/exportPdf";\n';
  const spread = 'import {\n  a,\n  b,\n} from "@/lib/builder/exportPdf";\n';
  const dynamic = 'const m = await import("@/lib/builder/exportPdf");\n';

  for (const shape of [bare, named, reexported, spread]) {
    expect(staticModuleSpecifiers(shape)).toEqual(["@/lib/builder/exportPdf"]);
  }
  // The one shape that is allowed, and the reason the module is off the first
  // load at all: a dynamic import is not a static edge.
  expect(staticModuleSpecifiers(dynamic)).toEqual([]);
  // Ordinary exports are not imports and must not be mistaken for them.
  expect(staticModuleSpecifiers('export const PDF = "exportPdf";\n')).toEqual([]);

  /* The defect itself, pinned so it cannot come back by accident: the matcher
     this replaced is blind to the first shape. */
  expect(bare.match(/^import\s[^;]*?from\s+"[^"]+";/gm)).toBeNull();
});

test("the PDF writer is loaded dynamically, never at module scope", () => {
  const source = drawingSheetsSource();

  // The bargain exportSpec.ts makes with GLTFExporter: a page that merely
  // offers the download does not pay for the converter.
  expect(source).toContain('import("@/lib/builder/exportPdf")');
  const specifiers = staticModuleSpecifiers(source);
  /* Named, not counted. A loop over a list the extractor failed to build is
     the same silent pass the `from`-anchored matcher used to give, so the real
     three edges are pinned here — and `export default function DrawingSheets`
     is pinned OUT, since a matcher that swallowed it would be reporting on
     something that is not an import. */
  expect(specifiers).toEqual(["react", "@/lib/builder/drawings", "./ui"]);
  for (const specifier of specifiers) {
    expect(specifier, `${specifier} is a STATIC edge into the first load`).not.toContain("exportPdf");
    expect(specifier).not.toContain("jspdf");
    expect(specifier).not.toContain("svg2pdf");
  }

  /* AGAINST THE PB01 BASELINE, AND HONEST ABOUT HOW. The figure this guard
     protects is `buildSharedFirstLoadKb` in perf/PB01-baseline-2026-08-14.json,
     pinned below so a silent edit to the baseline is as visible as a silent
     edit to the import. No production build was run in this wave — running one
     is a heavyweight gate — so the guarantee here is STRUCTURAL, not measured:
     the converter can only enter the shared bundle through a static edge, and
     there is no static edge of any of the three shapes above. The measured
     half of the claim is whatever the next real `next build` reports against
     this same number. */
  const baseline = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "perf", "PB01-baseline-2026-08-14.json"), "utf8"),
  ) as { buildSharedFirstLoadKb: number };
  expect(baseline.buildSharedFirstLoadKb).toBe(88.2);
});

/**
 * Every API in the writer whose bytes are known to differ between a Node build
 * and a browser build. `\b` matters: `Uint8Array<ArrayBuffer>` is a type, not a
 * `Buffer`.
 */
const CROSS_ENGINE_HAZARDS: readonly RegExp[] = [
  /\bCompressionStream\b/,
  /\bDecompressionStream\b/,
  /\bzlib\b/,
  /\bBuffer\b/,
  /\bTextEncoder\b/,
  /\bTextDecoder\b/,
  /\btoLocale[A-Za-z]*\(/,
  /\bIntl\./,
  /\bDate\.now\b/,
  /\bMath\.random\b/,
  /\bprocess\./,
  /\brequire\(/,
  /["']node:/,
];

test("the cross-engine claim is only as wide as what was actually checked", () => {
  /* EX05. The header used to assert that output is byte-identical ACROSS
     ENVIRONMENTS. Nothing ever ran this writer in a second engine, so that was
     a stated proof that was not one. The header now says what is true, and
     this test holds it to it: what is executed is same-engine byte identity
     (three tests up at the top of this file) plus the absence, here, of every
     API that would make two engines disagree on purpose. */
  const code = exportPdfSource()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/[ \t]+\/\/.*$/gm, "");
  for (const hazard of CROSS_ENGINE_HAZARDS) {
    expect(hazard.test(code), `${hazard} would let two engines produce different bytes`).toBe(false);
  }

  /* And the residual risk stays NAMED in the module rather than quietly
     dropped once the hazard list above passes: Math's transcendental functions
     are implementation-defined, so the door-swing arcs and the rotated labels
     are the two marks a second engine could in principle round differently. */
  const header = exportPdfSource();
  expect(header).toContain("WHAT IS AND IS NOT PROVEN ABOUT CROSS-ENGINE IDENTITY");
  expect(header).toContain("implementation-defined");
  expect(/\bMath\.(cos|sin|tan|acos|hypot)\(/.test(header)).toBe(true);
});

test("the per-sheet SVG download is still there", () => {
  const source = drawingSheetsSource();

  /* A drafter who wants one sheet should not have to take the whole set.
     Removing a working affordance to add a new one is not an upgrade, so the
     single-sheet link is pinned here rather than left to be noticed missing. */
  expect(source).toContain("drawingDataUrl(sheet.svg)");
  expect(source).toContain("download={`aura-${slug(name)}-${sheet.number}.svg`}");
  expect(source).toContain("Download {sheet.number}");
  expect(source).toContain("Download the set (.pdf)");
});
