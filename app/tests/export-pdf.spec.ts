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


test("the PDF writer is loaded dynamically, never at module scope", () => {
  const source = drawingSheetsSource();

  // The bargain exportSpec.ts makes with GLTFExporter: a page that merely
  // offers the download does not pay for the converter.
  expect(source).toContain('import("@/lib/builder/exportPdf")');
  const staticImports = source.match(/^import\s[^;]*?from\s+"[^"]+";/gm) ?? [];
  expect(staticImports.length).toBeGreaterThan(0);
  for (const line of staticImports) {
    expect(line).not.toContain("exportPdf");
    expect(line).not.toContain("jspdf");
    expect(line).not.toContain("svg2pdf");
  }
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
