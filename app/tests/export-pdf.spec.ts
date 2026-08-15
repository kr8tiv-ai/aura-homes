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

   EX06 — AND IN THE ORDER THE SHEET DREW IT.
   -----------------------------------------
   Everything above this paragraph was true and it was not enough. `paintedPaths`
   used to reduce a path to an UNORDERED BAG of points and `markPlacementProblems`
   compared only (first point, bounding box). Order, point count, connectivity
   and the paint operator were all invisible, and that is not a small gap: a
   closed polygon whose vertices are PERMUTED has the identical point set, so it
   keeps the identical first point and the identical bounding box. Permuting
   vertices 2 and 3 of every polyline path — which turns the A3 floor-plan wall
   poché into a bowtie — was injected into `emitPath` and ALL SEVENTEEN TESTS IN
   THIS FILE STAYED GREEN. That was measured here, not argued. A drawing set
   whose walls can render as bowties and pass is not a drawing set.

   So the comparison now walks the two descriptions STEP BY STEP:

   - The sheet's own ordered vertices, matched index for index against the
     page's operands. A permutation fails at the first moved vertex.
   - The geometry OPERATOR sequence — m / l / h / re / c. An `m` where the sheet
     states an `l` is a broken subpath even when every coordinate is right, and
     it is now named as one.
   - The point count, stated as its own sentence wherever the sheet determines
     it, so a dropped interior vertex fails even though it moves neither the
     first point nor the box.
   - The PAINT OPERATOR, derived from the SHEET'S OWN <style> block rather than
     from the converter's pen table. That matters: a second hand-typed copy of
     `PENS` would only prove two people typed the same thing, whereas
     `kit.ts::SHEET_CSS` travels inside every sheet and is the same source a
     browser resolves when it opens the standalone .svg. A wall filled where the
     sheet asks for a stroked outline is now a failure.
   - For the two curve marks the sheet does NOT state vertex by vertex, the
     strongest ordered property available without re-implementing the writer's
     own arc conversion: a circle must walk its twelve control points strictly
     one way around its stated centre and close after exactly 360°, and an arc's
     control polygon must turn in the direction its own sweep flag states.

   The first-point and bounding-box checks are KEPT alongside all of this. They
   are real properties; they were merely insufficient.
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

/** A cross product below this is a straight join rather than a turn. The
 *  crosses this actually meets on the one arc the set draws are ±405.577, so
 *  the threshold separates nothing real — it only keeps floating-point dust
 *  from being read as a reversal. */
const TURN_EPS = 1e-6;

/** How far a full circle's measured sweep may sit from 2π. The worst measured
 *  over the 59 circles in the set is 1.8e-15. */
const SWEEP_EPS = 1e-6;

/** A single SVG `A` command spans at most a full turn, and the converter splits
 *  at quadrants, so four cubics is the ceiling. */
const ARC_MAX_CUBICS = 4;

/** The operator sequence a <circle> must become: one move, four quadrant
 *  cubics, one close. */
const CIRCLE_OPS: readonly string[] = ["m", "c", "c", "c", "c", "h"];

/**
 * One step of the drawing the SHEET states, in the order the sheet states it.
 *
 * `m`/`l`/`h`/`re` pin the geometry completely. `arc` and `circle` do not —
 * the sheet states endpoints, a centre and a radius, and the control points
 * are the converter's own conversion — so those two carry what the sheet DOES
 * state and are checked on direction and closure instead of vertex by vertex.
 */
type SvgStep =
  | { op: "m" | "l"; to: Pt }
  | { op: "h" }
  | { op: "re"; at: Pt; to: Pt }
  | { op: "arc"; to: Pt; sweep: boolean }
  | { op: "circle"; centre: Pt; r: number };

interface SvgMark {
  tag: string;
  /** The class the sheet put on the mark, which is how it names its pen. */
  cls: string;
  /** Where the sheet says the mark begins, when the element pins that down.
   *  A <circle> does not — its start point is the converter's own choice of
   *  which quadrant to open at — so circles are matched on extent alone. */
  first: Pt | null;
  box: Box | null;
  /** How far outside its own stated coordinates a mark may legitimately
   *  reach. Zero for everything straight. */
  slack: number;
  /** EX06. Everything the sheet draws, in the sheet's own order. */
  steps: SvgStep[];
  /** EX06. How many points the page must paint for this mark, when the sheet
   *  determines it. `null` only for a mark carrying an arc, whose cubic count
   *  depends on how far the arc sweeps. */
  points: number | null;
  /** EX06. The paint operator the SHEET'S OWN <style> block calls for, or null
   *  when the mark resolves to neither a fill nor a stroke and so must paint
   *  nothing at all. */
  paint: string | null;
  /** EX06. False when the sheet's own <style> declares no rule for `cls`. The
   *  reader then falls back to SVG's OWN initial values rather than to a guess
   *  at what the kit meant, and says out loud that it had to. */
  penKnown: boolean;
}

const D_TOKENS = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

/**
 * The coordinates a path `d` states, in order, and how far a curve inside it
 * may bulge past them.
 *
 * Deliberately intolerant of any command outside the M/L/Z/A vocabulary
 * `drawings/kit.ts` emits: a reader that shrugged at an unknown command would
 * silently stop measuring the mark it was asked to measure.
 */
function readPathData(d: string): {
  pts: Pt[];
  slack: number;
  steps: SvgStep[];
  points: number | null;
} {
  const tokens = d.match(D_TOKENS) ?? [];
  const pts: Pt[] = [];
  const steps: SvgStep[] = [];
  let points: number | null = 0;
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
      /* A second coordinate pair after M is an implicit lineto in SVG, which is
         what the converter emits for it, so the step list says so too. */
      let firstPair = cmd === "M";
      while (moreNumbers()) {
        const x = num();
        const to: Pt = [x, num()];
        pts.push(to);
        steps.push({ op: firstPair ? "m" : "l", to });
        if (points !== null) points += 1;
        firstPair = false;
      }
    } else if (cmd === "Z") {
      /* closes back onto a point already recorded, and adds no point */
      steps.push({ op: "h" });
    } else if (cmd === "A") {
      while (moreNumbers()) {
        const rx = Math.abs(num());
        const ry = Math.abs(num());
        num(); // x-axis rotation
        num(); // large-arc flag
        const sweep = num() !== 0;
        const x = num();
        const to: Pt = [x, num()];
        pts.push(to);
        steps.push({ op: "arc", to, sweep });
        /* One arc becomes between one and four cubics depending on how far it
           sweeps, so the point count stops being determined by the sheet. The
           operator walk still pins it exactly. */
        points = null;
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
  return { pts, slack, steps, points };
}

/* ---- the sheet's own pens, read out of the sheet's own <style> ---------- */

interface SheetPen {
  fill: boolean;
  stroke: boolean;
}

/**
 * Which classes paint a fill and which paint a stroke — READ OUT OF THE SHEET.
 *
 * `kit.ts::SHEET_CSS` travels inside every sheet, because a standalone .svg has
 * to carry its own pens. So the sheet itself states what each class paints, and
 * that is the source used here. A second hand-typed copy of the converter's own
 * `PENS` table would prove only that two people typed the same thing; this
 * agrees with what a browser resolves when a reviewer opens the .svg.
 *
 * The two initial values that matter are SVG's, not this reader's invention: an
 * element with no `fill` declaration is filled black, and an element with no
 * `stroke` declaration is not stroked at all.
 */
function sheetPens(svg: string): Map<string, SheetPen> {
  const out = new Map<string, SheetPen>();
  const open = svg.indexOf("<style>");
  if (open === -1) return out;
  const close = svg.indexOf("</style>", open);
  const css = svg.slice(open + "<style>".length, close === -1 ? svg.length : close);
  for (const rule of Array.from(css.matchAll(/\.([a-zA-Z][\w-]*)\s*\{([^}]*)\}/g))) {
    const body = rule[2];
    /* `fill\s*:` cannot match `fill-rule:` — the hyphen is in the way — so the
       shorthand property and the rule property stay distinct. */
    const decl = (prop: string): string | null => {
      const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]*)`).exec(body);
      return m === null ? null : m[1].trim();
    };
    const fill = decl("fill");
    const stroke = decl("stroke");
    out.set(rule[1], {
      fill: fill === null ? true : fill !== "none",
      stroke: stroke === null ? false : stroke !== "none",
    });
  }
  return out;
}

/**
 * The paint operator a mark must end with.
 *
 * Presentation attributes can only REMOVE paint here — `fill="none"`,
 * `stroke="none"`, and a stroke-width of zero, which paints nothing in SVG and
 * so cannot be a stroke in the PDF either. `null` means the mark resolves to
 * neither a fill nor a stroke, so the page must paint nothing for it at all.
 *
 * A <line> is the one special case, and it is geometry rather than policy: a
 * line has no interior, so the only operator that can draw one is `S`.
 */
function markPaint(tag: string, attrs: Record<string, string>, pen: SheetPen | undefined): string | null {
  let fill = pen === undefined ? true : pen.fill;
  let stroke = pen === undefined ? false : pen.stroke;
  if (attrs.fill === "none") fill = false;
  if (attrs.stroke === "none") stroke = false;
  if (!(numAttr(attrs, "stroke-width") > 0)) stroke = false;
  if (tag === "line") return stroke ? "S" : null;
  const evenOdd = attrs["fill-rule"] === "evenodd";
  if (fill && stroke) return evenOdd ? "B*" : "B";
  if (fill) return evenOdd ? "f*" : "f";
  if (stroke) return "S";
  return null;
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
  const pens = sheetPens(svg);
  let viewBox: number[] = [];
  /** Everything a mark needs beyond its geometry, gathered in one place so the
   *  four element cases below cannot drift apart on how a pen is resolved. */
  const painted = (
    tag: string,
    attrs: Record<string, string>,
  ): Pick<SvgMark, "cls" | "paint" | "penKnown"> => {
    const cls = attrs.class ?? "";
    return { cls, paint: markPaint(tag, attrs, pens.get(cls)), penKnown: pens.has(cls) };
  };
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
      const at: Pt = [x, y];
      const to: Pt = [x + w, y + h];
      marks.push({
        tag,
        ...painted(tag, attrs),
        first: at,
        box: boxOf([at, to]),
        slack: 0,
        steps: [{ op: "re", at, to }],
        points: 2,
      });
    } else if (tag === "line") {
      const from: Pt = [numAttr(attrs, "x1"), numAttr(attrs, "y1")];
      const to: Pt = [numAttr(attrs, "x2"), numAttr(attrs, "y2")];
      marks.push({
        tag,
        ...painted(tag, attrs),
        first: from,
        box: boxOf([from, to]),
        slack: 0,
        steps: [
          { op: "m", to: from },
          { op: "l", to },
        ],
        points: 2,
      });
    } else if (tag === "circle") {
      const cx = numAttr(attrs, "cx");
      const cy = numAttr(attrs, "cy");
      const r = numAttr(attrs, "r");
      marks.push({
        tag,
        ...painted(tag, attrs),
        first: null,
        box: boxOf([
          [cx - r, cy - r],
          [cx + r, cy + r],
        ]),
        slack: 0,
        steps: [{ op: "circle", centre: [cx, cy], r }],
        /* One move plus four cubics of three points each. The sheet does not
           state WHERE they are, but it does state how many there must be. */
        points: 13,
      });
    } else if (tag === "path") {
      const read = readPathData(attrs.d ?? "");
      marks.push({
        tag,
        ...painted(tag, attrs),
        first: read.pts[0] ?? null,
        box: boxOf(read.pts),
        slack: read.slack,
        steps: read.steps,
        points: read.points,
      });
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

/** One geometry operator and the operands it was given, kept together and in
 *  order. EX06: the operator is half the meaning of a path — an `m` where an
 *  `l` belongs breaks the outline while moving no coordinate at all — and the
 *  shape this replaced threw the operator away and kept only the numbers. */
interface PdfOp {
  op: string;
  v: number[];
}

interface PaintedPath {
  op: string;
  /** EX06. Every geometry operator of this path, in emission order. */
  ops: PdfOp[];
  /** EX06. Every point, in emission order. Was an unordered bag. */
  pts: Pt[];
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
  let ops: PdfOp[] = [];
  for (const line of content.split("\n")) {
    const tokens = line.trim().split(/\s+/);
    const op = tokens[tokens.length - 1];
    if (GEOMETRY_OPS.has(op)) {
      const v = tokens.slice(0, -1).map(Number);
      ops.push({ op, v });
      if (op === "m" || op === "l") pts.push([v[0], v[1]]);
      else if (op === "c") pts.push([v[0], v[1]], [v[2], v[3]], [v[4], v[5]]);
      else if (op === "re") pts.push([v[0], v[1]], [v[0] + v[2], v[1] + v[3]]);
      // "h" closes onto a point already recorded
    } else if (PAINT_OPS.has(op)) {
      out.push({ op, ops, pts, first: pts[0] ?? null, box: boxOf(pts) });
      pts = [];
      ops = [];
    } else if (DISCARD_OPS.has(op)) {
      pts = [];
      ops = [];
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

/* ---- EX06: the ordered walk -------------------------------------------- */

/**
 * What this comparison actually looked at.
 *
 * Not decoration. Every check below is silent when it finds nothing to measure,
 * so a reader that quietly stopped producing steps would turn the whole gate
 * green rather than red. The caller asserts floors on these counts, which is
 * what makes "no problems" mean "measured and agreed" rather than "looked away".
 */
interface PlacementTally {
  /** Vertices matched one for one, at the same index, in the sheet's order. */
  orderedVertices: number;
  /** Marks whose paint operator was compared against the sheet's own <style>. */
  paints: number;
  /** Curve marks whose direction of travel was measured. */
  traversals: number;
}

const freshTally = (): PlacementTally => ({ orderedVertices: 0, paints: 0, traversals: 0 });

/**
 * The total signed angle a closed traversal turns about a centre — or `null`
 * when it doubles back, which is what a permuted pair of points looks like.
 *
 * A circle's control polygon walks strictly one way: the on-path points sit at
 * 0°, 90°, 180°, 270° and each pair of control points between them at roughly
 * 29° and 61° further on. Swap any two of the twelve and at least one step
 * reverses. Nothing here is copied from the writer — it is the definition of
 * going round a circle.
 */
function sweepAbout(pts: readonly Pt[], centre: Pt): number | null {
  let total = 0;
  let sign = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    let d =
      Math.atan2(b[1] - centre[1], b[0] - centre[0]) - Math.atan2(a[1] - centre[1], a[0] - centre[0]);
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    if (d === 0) return null;
    const s = d > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return null;
    total += d;
  }
  return total;
}

/**
 * Whether an arc's Bézier control polygon turns the way the sheet asked.
 *
 * A circular arc's control polygon is convex and turns one way only, and WHICH
 * way is stated in the sheet rather than inferred: SVG's sweep-flag 1 means the
 * arc is drawn in the direction of increasing angle, which in the sheet's
 * y-downward frame is a positive cross product. The one arc this set draws
 * carries sweep 1 and turns +405.577 at both of its joints, which is the
 * measurement this rule was checked against.
 *
 * This is the honest limit of what can be pinned without re-implementing the
 * writer's own endpoint-to-centre arc conversion inside the gate: it catches a
 * reversed sweep and any control point moved across the chord, and it does NOT
 * separate a swap of the two control points WITHIN one cubic that leaves the
 * turn direction intact. Said out loud rather than papered over.
 */
function wrongTurn(hull: readonly Pt[], sweep: boolean): string | null {
  const want = sweep ? 1 : -1;
  for (let i = 1; i + 1 < hull.length; i += 1) {
    const ax = hull[i][0] - hull[i - 1][0];
    const ay = hull[i][1] - hull[i - 1][1];
    const bx = hull[i + 1][0] - hull[i][0];
    const by = hull[i + 1][1] - hull[i][1];
    const cross = ax * by - ay * bx;
    if (Math.abs(cross) <= TURN_EPS) continue;
    if (Math.sign(cross) !== want) {
      return `turns ${r3(cross)} at control point ${i} and the sheet's sweep flag ${sweep ? 1 : 0} asks for the other direction`;
    }
  }
  return null;
}

/**
 * The sheet's steps against the page's operators, one at a time, in order.
 *
 * Returns at most ONE sentence — the first disagreement — because this runs
 * over 852 marks and a gate whose failure output is a wall of text is a gate
 * nobody reads.
 */
function orderedGeometryProblems(
  where: string,
  mark: SvgMark,
  path: PaintedPath,
  tally: PlacementTally,
): string[] {
  const got = path.ops;
  const shown = (k: number): string => (got[k] === undefined ? "nothing" : `"${got[k].op}"`);
  let gi = 0;
  /** The point the pen is on, which an arc's turn test needs. */
  let cur: Pt = [0, 0];

  for (const step of mark.steps) {
    if (step.op === "m" || step.op === "l") {
      const at = got[gi];
      if (at === undefined || at.op !== step.op) {
        return [`${where} paints ${shown(gi)} where the sheet's step ${gi} is "${step.op}" to ${showPt(step.to)}`];
      }
      const off = Math.max(Math.abs(at.v[0] - step.to[0]), Math.abs(at.v[1] - step.to[1]));
      if (off > PLACE_EPS) {
        return [
          `${where} paints vertex ${gi} at ${showPt([at.v[0], at.v[1]])} and the sheet states ${showPt(step.to)} there`,
        ];
      }
      tally.orderedVertices += 1;
      cur = step.to;
      gi += 1;
    } else if (step.op === "h") {
      if (got[gi] === undefined || got[gi].op !== "h") {
        return [`${where} paints ${shown(gi)} where the sheet closes the subpath ("h")`];
      }
      gi += 1;
    } else if (step.op === "re") {
      const at = got[gi];
      if (at === undefined || at.op !== "re") {
        return [`${where} paints ${shown(gi)} where the sheet states a rectangle ("re")`];
      }
      const corner: Pt = [at.v[0], at.v[1]];
      const far: Pt = [at.v[0] + at.v[2], at.v[1] + at.v[3]];
      const off = Math.max(
        Math.abs(corner[0] - step.at[0]),
        Math.abs(corner[1] - step.at[1]),
        Math.abs(far[0] - step.to[0]),
        Math.abs(far[1] - step.to[1]),
      );
      if (off > PLACE_EPS) {
        return [
          `${where} paints the rectangle ${showPt(corner)}…${showPt(far)} and the sheet states ` +
            `${showPt(step.at)}…${showPt(step.to)}`,
        ];
      }
      tally.orderedVertices += 2;
      cur = far;
      gi += 1;
    } else if (step.op === "arc") {
      let run = 0;
      while (got[gi + run] !== undefined && got[gi + run].op === "c") run += 1;
      if (run === 0) {
        return [
          `${where} paints ${shown(gi)} where the sheet states an arc to ${showPt(step.to)}, ` +
            `which has to become at least one cubic`,
        ];
      }
      if (run > ARC_MAX_CUBICS) {
        return [
          `${where} paints ${run} cubics for one arc, and a single arc spans at most a full turn, ` +
            `which is ${ARC_MAX_CUBICS}`,
        ];
      }
      const hull: Pt[] = [cur];
      for (let k = 0; k < run; k += 1) {
        const v = got[gi + k].v;
        hull.push([v[0], v[1]], [v[2], v[3]], [v[4], v[5]]);
      }
      const end = hull[hull.length - 1];
      if (Math.max(Math.abs(end[0] - step.to[0]), Math.abs(end[1] - step.to[1])) > PLACE_EPS) {
        return [`${where} ends its arc at ${showPt(end)} and the sheet states ${showPt(step.to)}`];
      }
      const turn = wrongTurn(hull, step.sweep);
      if (turn !== null) return [`${where} ${turn}`];
      tally.orderedVertices += 1;
      tally.traversals += 1;
      cur = step.to;
      gi += run;
    } else if (step.op === "circle") {
      for (let k = 0; k < CIRCLE_OPS.length; k += 1) {
        if (got[gi + k] === undefined || got[gi + k].op !== CIRCLE_OPS[k]) {
          return [`${where} paints ${shown(gi + k)} where a circle's step ${k} is "${CIRCLE_OPS[k]}"`];
        }
      }
      const pts: Pt[] = [[got[gi].v[0], got[gi].v[1]]];
      for (let k = 1; k <= 4; k += 1) {
        const v = got[gi + k].v;
        pts.push([v[0], v[1]], [v[2], v[3]], [v[4], v[5]]);
      }
      /* Thirteen points, the last of which IS the first: four quadrants close
         the ring. A converter that ended somewhere else has drawn a spiral. */
      const last = pts[pts.length - 1];
      if (Math.max(Math.abs(last[0] - pts[0][0]), Math.abs(last[1] - pts[0][1])) > PLACE_EPS) {
        return [
          `${where} opens its circle at ${showPt(pts[0])} and its fourth curve ends at ${showPt(last)}, ` +
            `so the ring does not close`,
        ];
      }
      for (const k of [0, 3, 6, 9]) {
        const d = Math.hypot(pts[k][0] - step.centre[0], pts[k][1] - step.centre[1]);
        if (Math.abs(d - step.r) > PLACE_EPS) {
          return [`${where} puts on-path point ${k} at radius ${r3(d)} and the sheet states ${r3(step.r)}`];
        }
      }
      const swept = sweepAbout(pts.slice(0, 12), step.centre);
      if (swept === null) {
        return [
          `${where} does not walk its circle one way around ${showPt(step.centre)}, ` +
            `so two of its points are out of order`,
        ];
      }
      if (Math.abs(Math.abs(swept) - 2 * Math.PI) > SWEEP_EPS) {
        return [
          `${where} walks ${r3((swept * 180) / Math.PI)}° around ${showPt(step.centre)} and a circle is 360°`,
        ];
      }
      tally.traversals += 1;
      cur = pts[0];
      gi += CIRCLE_OPS.length;
    }
  }

  if (gi !== got.length) {
    return [
      `${where} paints ${got.length - gi} operator(s) the sheet does not state, beginning with ${shown(gi)}`,
    ];
  }
  return [];
}

/**
 * What the sheet drew, against what the page painted — matched one to one, in
 * order, on POSITION, EXTENT, ORDER, POINT COUNT and PAINT OPERATOR. Returns
 * one sentence per disagreement.
 */
function markPlacementProblems(
  svg: string,
  content: string,
  tally: PlacementTally = freshTally(),
): string[] {
  const { marks } = readSheetSvg(svg);
  const paths = paintedPaths(content);
  const problems: string[] = [];

  /* A mark that resolves to neither a fill nor a stroke is drawn by nobody —
     the converter emits no path for it — so it cannot be paired with one. That
     is itself worth saying out loud, and it is said, so a sheet that starts
     drawing invisible marks turns this gate red rather than shifting every
     pairing after it by one. No sheet in the set does: all 852 marks paint. */
  const drawn: { mark: SvgMark; i: number }[] = [];
  marks.forEach((mark, i) => {
    if (!mark.penKnown) {
      problems.push(
        `mark ${i} (<${mark.tag}>) carries the class ${JSON.stringify(mark.cls)}, which the sheet's own <style> does not declare`,
      );
    }
    if (mark.penKnown && mark.paint === null) {
      problems.push(
        `mark ${i} (<${mark.tag}>) resolves to neither a fill nor a stroke, so the page paints nothing for it`,
      );
      return;
    }
    drawn.push({ mark, i });
  });

  if (drawn.length !== paths.length) {
    problems.push(`the sheet draws ${drawn.length} marks and the page paints ${paths.length} paths`);
  }
  const pairs = Math.min(drawn.length, paths.length);
  for (let k = 0; k < pairs; k += 1) {
    const mark = drawn[k].mark;
    const path = paths[k];
    const where = `mark ${drawn[k].i} (<${mark.tag}>)`;
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
    } else {
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

    /* ---- EX06. Everything above this line is satisfied EXACTLY by a path
       whose vertices have been permuted, because a permutation changes neither
       the first point nor the extent. The three checks below are the ones that
       are not. They run AFTER the two above so the sentences those two have
       always produced keep their wording and their order. */

    /* The paint operator, from the sheet's own stylesheet. A wall filled where
       the sheet asks for a stroked outline reads as a solid black room. */
    if (mark.paint !== null) {
      if (path.op !== mark.paint) {
        problems.push(
          `${where} is painted with "${path.op}" and the sheet's own <style> makes it "${mark.paint}"`,
        );
      }
      tally.paints += 1;
    }

    /* The point count, wherever the sheet determines it. A dropped interior
       vertex moves neither the start nor the box; it changes this. */
    if (mark.points !== null && path.pts.length !== mark.points) {
      problems.push(`${where} paints ${path.pts.length} points and the sheet states ${mark.points}`);
    }

    /* And the order itself. */
    for (const why of orderedGeometryProblems(where, mark, path, tally)) problems.push(why);
  }
  return problems;
}

test("every mark reaches the PDF at the position, the extent and the ORDER the sheet drew it", () => {
  const set = buildSet();
  const pdf = readPdf(buildDrawingSetPdf(set, meta()).bytes);
  const tally = freshTally();
  let measured = 0;
  set.sheets.forEach((sheet, i) => {
    const problems = markPlacementProblems(sheet.svg, pdf.pages[i].content, tally);
    expect(problems, `sheet ${sheet.number} ${sheet.title}:\n  ${problems.join("\n  ")}`).toEqual([]);
    measured += readSheetSvg(sheet.svg).marks.length;
  });
  /* Not a formality. If the readers above ever stop finding marks, every
     comparison becomes trivially true and this gate becomes the vacuum it
     was written to replace. */
  expect(measured).toBeGreaterThan(600);

  /* EX06. The same argument, one level down and much sharper. Every new check
     is SILENT when it has nothing to measure, so a steps reader that quietly
     returned [] would leave the whole gate green. These are the counts this
     run actually reached — 852 marks, 1757 vertices matched at their own index,
     60 curve traversals measured — floored well under the measurement so an
     ordinary change to the drawings does not trip them, and far enough over
     zero that a reader which stopped measuring cannot clear them. */
  expect(tally.paints, "paint operators compared").toBe(measured);
  expect(tally.orderedVertices, "vertices matched in the sheet's own order").toBeGreaterThan(1_500);
  expect(tally.traversals, "curve marks whose direction was measured").toBeGreaterThan(50);
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
  /* EX06 added the <style> block. It is not decoration and it is not invented:
     it is `kit.ts::SHEET_CSS`'s own rule for this class, which every real sheet
     carries because a standalone .svg has to bring its own pens. The reader
     resolves the expected paint operator out of it, so this fixture has to be
     a sheet rather than a sketch of one. */
  const svg =
    '<svg viewBox="0 0 100 100"><style>.adw-ink{stroke:var(--adw-ink);fill:none}</style>' +
    '<rect x="10" y="20" width="30" height="40" class="adw-ink" stroke-width="1"/>' +
    '<line x1="5" y1="6" x2="7" y2="8" class="adw-ink" stroke-width="1"/></svg>';
  const faithful = ["1 0 0 -1 0 100 cm", "0 0 0 RG", "1 w", "10 20 30 40 re", "S", "5 6 m", "7 8 l", "S"].join("\n");
  const displaced = faithful.replace("10 20 30 40 re", "22 20 30 40 re");

  expect(countPaints(faithful)).toBe(2);
  expect(countPaints(displaced)).toBe(countPaints(faithful));
  expect(countSvgMarks(svg)).toBe(2);

  expect(markPlacementProblems(svg, faithful)).toEqual([]);
  const caught = markPlacementProblems(svg, displaced);
  /* Both halves of the reader fire, and they name the rectangle, where the
     sheet put it, and where the page put it instead. The third sentence is
     EX06's ordered walk reaching the same defect through the operands rather
     than through the extent — added, not substituted. */
  expect(caught).toEqual([
    "mark 0 (<rect>) starts at (10, 20) on the sheet and at (22, 20) on the page",
    "mark 0 (<rect>) covers x 10…40, y 20…60 on the sheet and x 22…52, y 20…60 on the page",
    "mark 0 (<rect>) paints the rectangle (22, 20)…(52, 60) and the sheet states (10, 20)…(40, 60)",
  ]);

  /* And extent alone catches a mark whose start point is untouched: the same
     rectangle drawn at twice the width begins in exactly the right place. */
  const stretched = markPlacementProblems(svg, faithful.replace("10 20 30 40 re", "10 20 60 40 re"));
  expect(stretched).toEqual([
    "mark 0 (<rect>) covers x 10…40, y 20…60 on the sheet and x 10…70, y 20…60 on the page",
    "mark 0 (<rect>) paints the rectangle (10, 20)…(70, 60) and the sheet states (10, 20)…(40, 60)",
  ]);

  /* The other half of the finding this gate was written for: a converter that
     PAINTS THE RIGHT NUMBER OF THINGS AND DRAWS NONE OF THEM. `countPaints`
     reads two and two here as well. */
  const hollow = ["1 0 0 -1 0 100 cm", "0 0 0 RG", "1 w", "S", "S"].join("\n");
  expect(countPaints(hollow)).toBe(countPaints(faithful));
  expect(markPlacementProblems(svg, hollow)).toEqual([
    "mark 0 (<rect>) starts at (10, 20) on the sheet and paints no geometry at all",
    "mark 0 (<rect>) covers x 10…40, y 20…60 on the sheet and nothing drawn on the page",
    "mark 0 (<rect>) paints 0 points and the sheet states 2",
    'mark 0 (<rect>) paints nothing where the sheet states a rectangle ("re")',
    "mark 1 (<line>) starts at (5, 6) on the sheet and paints no geometry at all",
    "mark 1 (<line>) covers x 5…7, y 6…8 on the sheet and nothing drawn on the page",
    "mark 1 (<line>) paints 0 points and the sheet states 2",
    'mark 1 (<line>) paints nothing where the sheet\'s step 0 is "m" to (5, 6)',
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

test("a permuted outline is a bowtie, and every property the old reader had says it is fine", () => {
  /* EX06'S FALSIFIABILITY PROOF, on input small enough to read, for the defect
     the whole node exists to catch.

     A five-sided outline. The bowtie below is the SAME FIVE POINTS with two of
     them swapped — which is exactly what was injected into `emitPath` to prove
     the hole was real, and it kept all seventeen tests in this file green. The
     assertions here say WHY it could: the point set is identical, so the first
     point, the bounding box, the point count, the operator sequence and the
     paint operator are all identical too. Order is the only thing that moved,
     and order is the only thing that can catch it. */
  const svg =
    '<svg viewBox="0 0 100 100"><style>.adw-ink{stroke:var(--adw-ink);fill:none}</style>' +
    '<path d="M 10,10 L 25,10 L 40,10 L 40,30 L 10,30 Z" class="adw-ink" stroke-width="1"/></svg>';
  const head = ["1 0 0 -1 0 100 cm", "0 0 0 RG", "1 w"];
  const faithful = [...head, "10 10 m", "25 10 l", "40 10 l", "40 30 l", "10 30 l", "h", "S"].join("\n");
  const bowtie = [...head, "10 10 m", "25 10 l", "40 30 l", "40 10 l", "10 30 l", "h", "S"].join("\n");

  expect(markPlacementProblems(svg, faithful)).toEqual([]);

  /* Everything the reader had BEFORE this node, measured on the bowtie itself
     rather than asserted about it. Each of these is a real property; all four
     are blind here. */
  const good = paintedPaths(faithful)[0];
  const bad = paintedPaths(bowtie)[0];
  expect(bad.first).toEqual(good.first);
  expect(bad.box).toEqual(good.box);
  expect(bad.pts.length).toBe(good.pts.length);
  expect(bad.ops.map((o) => o.op)).toEqual(good.ops.map((o) => o.op));
  expect(bad.op).toBe(good.op);
  expect(countPaints(bowtie)).toBe(countPaints(faithful));
  // …and the bag of points really is the same bag, sorted.
  const bag = (p: PaintedPath): string => p.pts.map((q) => q.join(",")).sort().join(" ");
  expect(bag(bad)).toBe(bag(good));

  // The ordered walk names the vertex, where the page put it, and where the
  // sheet asked for it.
  expect(markPlacementProblems(svg, bowtie)).toEqual([
    "mark 0 (<path>) paints vertex 2 at (40, 30) and the sheet states (40, 10) there",
  ]);

  /* A DROPPED INTERIOR VERTEX. (25,10) sits on the edge between two corners, so
     losing it moves neither the start point nor the extent — it just straightens
     the outline. Point count and order are what see it. */
  const dropped = faithful.replace("25 10 l\n", "");
  expect(paintedPaths(dropped)[0].box).toEqual(good.box);
  expect(paintedPaths(dropped)[0].first).toEqual(good.first);
  expect(markPlacementProblems(svg, dropped)).toEqual([
    "mark 0 (<path>) paints 4 points and the sheet states 5",
    "mark 0 (<path>) paints vertex 1 at (40, 10) and the sheet states (25, 10) there",
  ]);

  /* CONNECTIVITY. Every coordinate is right and every point is in its place;
     one `l` has become an `m`, which lifts the pen and leaves the outline open.
     Nothing numeric moves at all. */
  const broken = faithful.replace("40 30 l", "40 30 m");
  expect(paintedPaths(broken)[0].box).toEqual(good.box);
  expect(paintedPaths(broken)[0].pts).toEqual(good.pts);
  expect(markPlacementProblems(svg, broken)).toEqual([
    'mark 0 (<path>) paints "m" where the sheet\'s step 3 is "l" to (40, 30)',
  ]);

  /* THE PAINT OPERATOR. The outline filled instead of stroked: same geometry,
     same order, a solid black shape where the sheet asked for a line. */
  const filled = faithful.replace(/^S$/m, "f");
  expect(paintedPaths(filled)[0].pts).toEqual(good.pts);
  expect(markPlacementProblems(svg, filled)).toEqual([
    'mark 0 (<path>) is painted with "f" and the sheet\'s own <style> makes it "S"',
  ]);
});

test("the expected paint operator is read out of the sheet, not copied from the converter", () => {
  /* The claim in the header — that the pen comes from the sheet's own <style>
     rather than from a second hand-typed copy of the converter's PENS table —
     is only worth making if it is falsifiable. It is: the SAME markup with the
     SAME class resolves to a different operator when the sheet's own stylesheet
     says something different, and this test changes nothing but the stylesheet.

     `.adw-poche{fill:var(--adw-ink)}` is verbatim from kit.ts, and the poché
     path is the one mark in the set drawn with fill-rule="evenodd" — an outer
     ring minus an inner one, which is what makes a wall read as structure. */
  const d = 'd="M 10,10 L 40,10 L 40,30 L 10,30 Z" fill-rule="evenodd"';
  const poche =
    `<svg viewBox="0 0 100 100"><style>.adw-poche{fill:var(--adw-ink)}</style><path ${d} class="adw-poche"/></svg>`;
  const stroked =
    '<svg viewBox="0 0 100 100"><style>.adw-poche{stroke:var(--adw-ink);fill:none}</style>' +
    `<path ${d} class="adw-poche" stroke-width="1"/></svg>`;
  const geometry = ["1 0 0 -1 0 100 cm", "0 0 0 rg", "10 10 m", "40 10 l", "40 30 l", "10 30 l", "h"];

  // A fill pen and an even-odd rule: the operator has to be `f*`.
  expect(markPlacementProblems(poche, [...geometry, "f*"].join("\n"))).toEqual([]);
  expect(markPlacementProblems(poche, [...geometry, "f"].join("\n"))).toEqual([
    'mark 0 (<path>) is painted with "f" and the sheet\'s own <style> makes it "f*"',
  ]);
  expect(markPlacementProblems(poche, [...geometry, "S"].join("\n"))).toEqual([
    'mark 0 (<path>) is painted with "S" and the sheet\'s own <style> makes it "f*"',
  ]);

  // Same class, same geometry, same rule — a different stylesheet, so a
  // different answer. Nothing here could be a constant typed twice.
  expect(markPlacementProblems(stroked, [...geometry, "S"].join("\n"))).toEqual([]);
  expect(markPlacementProblems(stroked, [...geometry, "f*"].join("\n"))).toEqual([
    'mark 0 (<path>) is painted with "f*" and the sheet\'s own <style> makes it "S"',
  ]);

  /* And a class the sheet's own stylesheet never declares is REPORTED. The
     reader still grades what it can — against SVG's own initial values, which
     is why the `f*` below raises only the one sentence — but it never lets an
     undeclared pen pass as if the sheet had stated one. */
  const undeclared = `<svg viewBox="0 0 100 100"><style>.adw-ink{stroke:var(--adw-ink)}</style><path ${d} class="adw-mystery"/></svg>`;
  expect(markPlacementProblems(undeclared, [...geometry, "f*"].join("\n"))).toEqual([
    'mark 0 (<path>) carries the class "adw-mystery", which the sheet\'s own <style> does not declare',
  ]);
});

test("a circle that walks its own outline out of order is caught, and a faithful one is not", () => {
  /* The circle is the mark whose control points the sheet does NOT state — it
     states a centre and a radius — so it cannot be matched vertex for vertex,
     and the reader would have nothing ordered to say about 59 of the set's 852
     marks if that were the end of it. What the sheet DOES determine is that the
     traversal goes one way round the centre and closes after exactly 360°, and
     that is a property a permutation breaks.

     The stream below is the converter's own four-Bézier circle. `k` is the
     classic constant computed here from (4/3)·tan(π/8) rather than copied from
     the writer's literal, so agreement between the two is evidence. */
  const k = ((4 / 3) * Math.tan(Math.PI / 8)).toFixed(3);
  const svg =
    '<svg viewBox="0 0 100 100"><style>.adw-ink{stroke:var(--adw-ink);fill:none}</style>' +
    '<circle cx="50" cy="50" r="10" class="adw-ink" stroke-width="1"/></svg>';
  const K = Number(k) * 10;
  const c = (a: number, b: number, x: number, y: number, e: number, f: number): string =>
    `${a} ${b} ${x} ${y} ${e} ${f} c`;
  const faithful = [
    "1 0 0 -1 0 100 cm",
    "0 0 0 RG",
    "1 w",
    "60 50 m",
    c(60, 50 + K, 50 + K, 60, 50, 60),
    c(50 - K, 60, 40, 50 + K, 40, 50),
    c(40, 50 - K, 50 - K, 40, 50, 40),
    c(50 + K, 40, 60, 50 - K, 60, 50),
    "h",
    "S",
  ].join("\n");
  expect(markPlacementProblems(svg, faithful)).toEqual([]);

  /* Swap the two control points of the first quadrant. The point set, the box,
     the point count, the operator sequence and the paint operator are all
     untouched; the traversal doubles back. */
  const swapped = faithful.replace(
    c(60, 50 + K, 50 + K, 60, 50, 60),
    c(50 + K, 60, 60, 50 + K, 50, 60),
  );
  const good = paintedPaths(faithful)[0];
  const bad = paintedPaths(swapped)[0];
  expect(bad.box).toEqual(good.box);
  expect(bad.first).toEqual(good.first);
  expect(bad.pts.length).toBe(good.pts.length);
  expect(bad.ops.map((o) => o.op)).toEqual(good.ops.map((o) => o.op));
  expect(markPlacementProblems(svg, swapped)).toEqual([
    "mark 0 (<circle>) does not walk its circle one way around (50, 50), so two of its points are out of order",
  ]);

  /* A circle drawn backwards is still a circle on paper, so this one is NOT a
     failure — the reader measures |sweep| and does not care which way round the
     converter chose to go. Claiming otherwise would be a gate that fires on a
     decision nobody made wrongly. */
  const reversed = [
    "1 0 0 -1 0 100 cm",
    "0 0 0 RG",
    "1 w",
    "60 50 m",
    c(60, 50 - K, 50 + K, 40, 50, 40),
    c(50 - K, 40, 40, 50 - K, 40, 50),
    c(40, 50 + K, 50 - K, 60, 50, 60),
    c(50 + K, 60, 60, 50 + K, 60, 50),
    "h",
    "S",
  ].join("\n");
  expect(markPlacementProblems(svg, reversed)).toEqual([]);

  /* Three quadrants instead of four: a three-quarter arc that closes with a
     straight chord. It never leaves the box and it starts in the right place. */
  const gapped = faithful.replace(`${c(50 + K, 40, 60, 50 - K, 60, 50)}\n`, "");
  expect(markPlacementProblems(svg, gapped)).toEqual([
    "mark 0 (<circle>) paints 10 points and the sheet states 13",
    'mark 0 (<circle>) paints "h" where a circle\'s step 4 is "c"',
  ]);
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
