/* ===========================================================================
   THE DRAFTING KIT — paper, pens, and the marks a drawing is made of.

   Everything in this file is the DRAWING LANGUAGE, deliberately separated
   from the geometry (`model.ts`) and from the sheets (`sheets.ts`). It is a
   direct continuation of `lib/design/blueprint.ts`: the same poché fill, the
   same 45-degree dimension ticks, the same rounding, the same feet-and-inches
   strings, the same theme-aware pen chain. A reviewer who has seen one of
   those sheets should not be able to tell that a different file drew this one.

   WHAT IS DIFFERENT FROM blueprint.ts, and why:

   · blueprint.ts sizes its paper to its content — it draws ONE plan and the
     sheet grows to hold it. A permit SET cannot do that: eight sheets of
     eight different sizes is not a set, and "to scale" means nothing if the
     scale changes silently. So paper here is a FIXED ANSI B sheet (11" x 17"
     landscape, the size a residential set is actually printed at) and the
     SCALE is what moves — chosen off a ladder of real architectural scales,
     largest first, and printed on every sheet.
   · A set needs a sheet number, a sheet index, a date and a revision, so the
     title block carries them. The date is a PARAMETER, never `Date.now()`:
     the same spec and the same date must produce byte-identical markup.

   UNITS. Model space is FEET. Paper space is POINTS (72/inch). At
   1/4" = 1'-0" one foot is 18 pt, exactly as in blueprint.ts.

   PURITY. No clock, no randomness, no network, no DOM, no Node APIs.
   =========================================================================== */

/* ---------------------------------------------------------------- paper --- */

const PT_PER_IN = 72;

/** ANSI B — 11" x 17" — landscape. The standard residential permit sheet. */
export const SHEET_W = 17 * PT_PER_IN; // 1224
export const SHEET_H = 11 * PT_PER_IN; // 792

/** Paper margin, 0.5". */
export const MARGIN = 36;
/** Title-block band across the foot of the sheet. */
export const TITLE_H = 96;
/** General-notes column down the right-hand side, the way a real sheet keeps
 *  its notes out of the drawing. */
export const NOTES_W = 210;
/** Gutter between the drawing and the notes column. */
export const NOTES_GAP = 14;

/** The box a sheet may draw its content in (notes column excluded). */
export const CONTENT = {
  x0: MARGIN,
  y0: MARGIN,
  x1: SHEET_W - MARGIN - NOTES_W - NOTES_GAP,
  y1: SHEET_H - MARGIN - TITLE_H,
} as const;

export const CONTENT_W = CONTENT.x1 - CONTENT.x0; // 928
export const CONTENT_H = CONTENT.y1 - CONTENT.y0; // 624

/** The full-width box, for the sheets that carry no notes column (A0, A7). */
export const FULL = {
  x0: MARGIN,
  y0: MARGIN,
  x1: SHEET_W - MARGIN,
  y1: SHEET_H - MARGIN - TITLE_H,
} as const;

/** Dimension-line offset, matching blueprint.ts. */
export const DIM_OFFSET = 26;

/* ------------------------------------------------------- number formatting

   Lifted from `lib/design/blueprint.ts` so the two sheets round identically.
   Python rounds halves to EVEN and the plan engine is a port of Python, so a
   room solving to an exact half-inch must letter the same on both sheets or
   the set contradicts itself over a sixteenth of an inch.                    */

export function pyRound(v: number, digits = 0): number {
  const p = 10 ** digits;
  const scaled = v * p;
  let r = Math.round(scaled); // JS breaks ties toward +∞ …
  if (Math.abs(scaled % 1) === 0.5 && r % 2 !== 0) r -= 1; // … Python, toward even
  return r / p;
}

/** Python's `f"{v:.Nf}"`. */
export const fx = (v: number, digits: number): string => pyRound(v, digits).toFixed(digits);

/** A stroke width or similar: short, trailing zeros dropped. */
export const num = (v: number): string => String(pyRound(v, 3));

/** Python's `:g` — 6 significant digits, trailing zeros stripped. */
export const fmtG = (v: number): string => String(Number(v.toPrecision(6)));

/** Feet-and-inches to the nearest inch, the way a drawing letters it: 12'-6".
 *  Byte-identical to `fmtFt` in `lib/design/blueprint.ts`. */
export function fmtFt(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  let whole = Math.trunc(abs);
  let inches = pyRound((abs - whole) * 12);
  if (inches === 12) {
    whole += 1;
    inches = 0;
  }
  return `${sign}${whole}'-${inches}"`;
}

/** Feet-and-inches to the nearest 1/8", for a schedule where a rough opening
 *  is quoted in eighths and rounding it to the inch would lose the allowance
 *  the whole column exists to state. */
export function fmtFtFrac(v: number): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  let eighths = pyRound(abs * 96); // 96 eighths of an inch per foot
  const feet = Math.floor(eighths / 96);
  eighths -= feet * 96;
  const inches = Math.floor(eighths / 8);
  let frac = eighths - inches * 8;
  let denom = 8;
  while (frac > 0 && frac % 2 === 0) {
    frac /= 2;
    denom /= 2;
  }
  const inchPart = frac > 0 ? `${inches} ${frac}/${denom}` : `${inches}`;
  return `${sign}${feet}'-${inchPart}"`;
}

/** Square feet, grouped, with no locale dependency — a sheet is a document
 *  and its numbers must not drift with the reader's ICU data. */
export const sqFt = (v: number): string =>
  `${String(pyRound(v, 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} SQ FT`;

/** Degrees, one decimal, trailing ".0" dropped. */
export const deg = (v: number): string => `${fmtG(pyRound(v, 1))}°`;

/** A roof pitch as framers read it: rise per 12 of run. */
export const riseOver12 = (slope: number): string => `${fmtG(pyRound(slope * 12, 1))}:12`;

export const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Word-wrap for the notes column and the cover blocks.
 *
 *  Deliberately a CHARACTER estimate rather than a measurement: there is no
 *  DOM here and no font metrics, so the honest thing is a conservative
 *  character budget rather than a measurement that pretends to be exact.
 *  A long unbreakable token is emitted on its own line rather than clipped. */
export function wrap(body: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of body.split(/\s+/).filter(Boolean)) {
    if (line.length === 0) {
      line = word;
    } else if (line.length + 1 + word.length <= maxChars) {
      line += ` ${word}`;
    } else {
      out.push(line);
      line = word;
    }
  }
  if (line.length > 0) out.push(line);
  return out;
}

/** Characters that fit in `w` points at `size` points, for this sans stack.
 *  0.52 em is a measured-enough average for Helvetica/Arial mixed case; it is
 *  used to under-fill rather than to typeset. */
export const charsIn = (w: number, size: number): number =>
  Math.max(8, Math.floor(w / (size * 0.52)));

/* --------------------------------------------------------------- the pens

   The same three-step chain `lib/design/blueprint.ts` uses, for the same
   reason: these sheets are injected into a page with a real night mode, so
   nothing here may be a literal colour.

     1. `--drawings-*` — a per-instance override the host can set
     2. `--st-*`       — the site's document tokens, which already flip under
                         `:root[data-theme="dark"]`
     3. a terminal value — so a downloaded .svg opened on its own still reads

   PAPER is the one pen that must be OPAQUE: opening knock-outs are painted in
   it, and a transparent knock-out leaves the poché wall unbroken with the
   glass drawn on top of solid black.                                        */

const PENS = [
  "--adw-paper: var(--drawings-paper, var(--st-paper, #ffffff))",
  "--adw-ink: var(--drawings-ink, var(--st-ink, currentColor))",
  "--adw-dim: var(--drawings-dim, var(--st-ink-dim, currentColor))",
  "--adw-hair: var(--drawings-hair, var(--st-faint, currentColor))",
  "--adw-glass: var(--drawings-glass, var(--st-teal, #0f766e))",
  "--adw-accent: var(--drawings-accent, var(--st-emerald-deep, #047857))",
  // single quotes on purpose: this lives inside a double-quoted style=""
  "font-family: var(--drawings-font, 'Helvetica Neue', Helvetica, Arial, sans-serif)",
  "display: block",
  "max-width: 100%",
  "height: auto",
].join(";");

/* `var()` is not honoured inside SVG presentation attributes, so the pens are
   applied through classes. The prefix matters: an inline <style> is not
   scoped and these rules land in the host document. */
const SHEET_CSS = [
  ".adw-poche{fill:var(--adw-ink)}",
  ".adw-paper{fill:var(--adw-paper)}",
  ".adw-ink{stroke:var(--adw-ink);fill:none}",
  ".adw-hair{stroke:var(--adw-hair);fill:none}",
  ".adw-dimline{stroke:var(--adw-dim);fill:none}",
  ".adw-glass{stroke:var(--adw-glass);fill:none}",
  ".adw-knock{stroke:var(--adw-paper);fill:none}",
  ".adw-accent{stroke:var(--adw-accent);fill:none}",
  ".adw-fill-paper{fill:var(--adw-paper);stroke:none}",
  ".adw-t-ink{fill:var(--adw-ink)}",
  ".adw-t-dim{fill:var(--adw-dim)}",
  ".adw-t-accent{fill:var(--adw-accent)}",
  ".adw-t-glass{fill:var(--adw-glass)}",
].join("");

/**
 * The stamp. Mandatory on every sheet.
 *
 * The first line is the one a reviewer looks for. The second is the honest
 * description of who finishes the work, and it is worded the way the
 * profession works rather than the way a demo would like it to: an architect
 * or designer does not "approve" somebody else's drawings — they review them,
 * take professional responsibility, and SEAL.
 */
export const STAMP = [
  "NOT FOR CONSTRUCTION — REVIEW SET.",
  "A licensed professional completes, corrects and seals this set.",
] as const;

/* ------------------------------------------------------------- the scales */

export interface DrawScale {
  /** Exactly as printed in the title block. */
  label: string;
  ptPerFt: number;
  /** False when nothing on the ladder fitted and the sheet was squeezed. */
  exact: boolean;
}

/** Real architectural scales, largest first. 1/4" = 1'-0" is the residential
 *  plan scale and the one to use whenever it fits. */
const ARCH_LADDER: readonly (readonly [string, number])[] = [
  [`1/4" = 1'-0"`, 18],
  [`3/16" = 1'-0"`, 13.5],
  [`1/8" = 1'-0"`, 9],
  [`3/32" = 1'-0"`, 6.75],
  [`1/16" = 1'-0"`, 4.5],
  [`1/32" = 1'-0"`, 2.25],
];

/** Engineering scales, which is what a site plan is drawn at. */
const SITE_LADDER: readonly (readonly [string, number])[] = [
  [`1" = 10'`, 7.2],
  [`1" = 20'`, 3.6],
  [`1" = 30'`, 2.4],
  [`1" = 40'`, 1.8],
  [`1" = 50'`, 1.44],
  [`1" = 60'`, 1.2],
  [`1" = 100'`, 0.72],
];

function fromLadder(
  ladder: readonly (readonly [string, number])[],
  wFt: number,
  hFt: number,
  availW: number,
  availH: number,
): DrawScale {
  /* Nothing to measure. Printing "1/4\" = 1'-0\"" on a sheet with nothing on
     it is a small lie of exactly the kind this set is not allowed to tell. */
  if (!(wFt > 0) || !(hFt > 0) || !Number.isFinite(wFt) || !Number.isFinite(hFt)) {
    return { label: "NOT TO SCALE — NOTHING TO DRAW", ptPerFt: ladder[0][1], exact: false };
  }
  for (const [label, ptPerFt] of ladder) {
    if (wFt * ptPerFt <= availW && hFt * ptPerFt <= availH) {
      return { label, ptPerFt, exact: true };
    }
  }
  /* Nothing on the ladder fits. Squeezing to a made-up ratio and printing a
     real scale name over it would be the one unforgivable lie on a drawing,
     so the label says what actually happened. */
  const ptPerFt = Math.min(availW / wFt, availH / hFt);
  return {
    label: `SCALED TO FIT — APPROX. 1" = ${Math.ceil(PT_PER_IN / ptPerFt)}'`,
    ptPerFt,
    exact: false,
  };
}

export const archScale = (
  wFt: number,
  hFt: number,
  availW = CONTENT_W,
  availH = CONTENT_H,
): DrawScale => fromLadder(ARCH_LADDER, wFt, hFt, availW, availH);

export const siteScale = (
  wFt: number,
  hFt: number,
  availW = CONTENT_W,
  availH = CONTENT_H,
): DrawScale => fromLadder(SITE_LADDER, wFt, hFt, availW, availH);

/* ---------------------------------------------------------------- marks --- */

export const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cls: string,
  width: number,
  extra = "",
): string =>
  `<line x1="${fx(x1, 2)}" y1="${fx(y1, 2)}" x2="${fx(x2, 2)}" y2="${fx(y2, 2)}" ` +
  `class="${cls}" stroke-width="${num(width)}"${extra}/>`;

export const text = (
  x: number,
  y: number,
  cls: string,
  size: string,
  body: string,
  extra = "",
): string =>
  `<text x="${fx(x, 2)}" y="${fx(y, 2)}" class="${cls}" font-size="${size}"${extra}>` +
  `${esc(body)}</text>`;

export const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  cls: string,
  width: number,
  extra = "",
): string =>
  `<rect x="${fx(x, 2)}" y="${fx(y, 2)}" width="${fx(Math.max(0, w), 2)}" ` +
  `height="${fx(Math.max(0, h), 2)}" class="${cls}" stroke-width="${num(width)}"${extra}/>`;

export const circle = (
  cx: number,
  cy: number,
  r: number,
  cls: string,
  width: number,
  extra = "",
): string =>
  `<circle cx="${fx(cx, 2)}" cy="${fx(cy, 2)}" r="${fx(r, 2)}" class="${cls}" ` +
  `stroke-width="${num(width)}"${extra}/>`;

export const path = (d: string, cls: string, width: number, extra = ""): string =>
  `<path d="${d}" class="${cls}" stroke-width="${num(width)}"${extra}/>`;

/** A closed polygon as a path `d` string. */
export function polyD(pts: readonly (readonly [number, number])[], close = true): string {
  if (pts.length === 0) return "";
  const parts = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${fx(p[0], 2)},${fx(p[1], 2)}`);
  return parts.join(" ") + (close ? " Z" : "");
}

export const poly = (
  pts: readonly (readonly [number, number])[],
  cls: string,
  width: number,
  extra = "",
): string => (pts.length < 2 ? "" : path(polyD(pts), cls, width, extra));

/** Poché — a solid-filled wall, drawn as an outer ring minus an inner ring.
 *  `evenodd` on the two subpaths is what makes it read as structure rather
 *  than as two drawn rectangles. Same convention as blueprint.ts. */
export const poche = (
  outer: readonly (readonly [number, number])[],
  inner: readonly (readonly [number, number])[],
): string =>
  `<path class="adw-poche" fill-rule="evenodd" d="${polyD(outer)} ${polyD(inner)}"/>`;

export const DASH_HIDDEN = ' stroke-dasharray="5,3"';
export const DASH_FINE = ' stroke-dasharray="3,2"';
export const DASH_CENTRE = ' stroke-dasharray="12,3,3,3"';

/* ----------------------------------------------------------- dimensions ---

   Ported from `lib/design/blueprint.ts::dim` so the ticks, the extension-line
   overrun and the never-upside-down rule are identical. Coordinates are paper
   points; `side` picks which way the line is offset.                        */

export function dim(
  out: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  body: string,
  side: 1 | -1 = -1,
  offset: number = DIM_OFFSET,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (L <= 0.5) return;
  const nx = (-dy / L) * side; // outward normal
  const ny = (dx / L) * side;
  const ox = nx * offset;
  const oy = ny * offset;

  for (const [px, py] of [
    [x1, y1],
    [x2, y2],
  ] as const) {
    out.push(line(px, py, px + ox * 1.16, py + oy * 1.16, "adw-hair", 0.5));
  }
  out.push(line(x1 + ox, y1 + oy, x2 + ox, y2 + oy, "adw-dimline", 0.7));

  // 45° ticks — the run direction plus the normal, which is what makes the
  // architectural slash rather than an engineer's arrow.
  const tx = (dx / L) * 4;
  const ty = (dy / L) * 4;
  for (const [px, py] of [
    [x1 + ox, y1 + oy],
    [x2 + ox, y2 + oy],
  ] as const) {
    out.push(
      line(px - tx - nx * 4, py - ty - ny * 4, px + tx + nx * 4, py + ty + ny * 4, "adw-dimline", 0.7),
    );
  }

  const mx = (x1 + x2) / 2 + ox;
  const my = (y1 + y2) / 2 + oy;
  let rot = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (rot > 90 || rot < -90) rot += 180; // never letter a dimension upside-down
  out.push(
    text(
      mx,
      my - 4,
      "adw-t-ink",
      "8px",
      body,
      ` text-anchor="middle" transform="rotate(${fx(rot, 1)},${fx(mx, 2)},${fx(my, 2)})"`,
    ),
  );
}

/**
 * A level line with a tag — the way a section or elevation calls out a datum.
 *
 * Label and value share ONE line rather than stacking. Two lines per tag reads
 * better on a big drawing and collides on a small one: at 1/16" = 1'-0" the
 * 2'-9" between finished floor and grade is twelve points of paper, and a
 * two-line tag needs twenty. A drawing that becomes unreadable at the scale it
 * had to drop to is a drawing that lied about fitting.
 */
export function levelTag(
  out: string[],
  x0: number,
  x1: number,
  y: number,
  label: string,
  value: string,
): void {
  out.push(line(x0, y, x1, y, "adw-hair", 0.5, DASH_CENTRE));
  out.push(text(x1 + 4, y - 2.5, "adw-t-dim", "6.8px", label, ` letter-spacing="0.6"`));
  // 4.9 pt per uppercase character at 6.8px including the letter-spacing,
  // plus a word gap. An estimate, but one that under-fills rather than over-
  // fills, so the value never runs back over the label.
  out.push(text(x1 + 11 + label.length * 4.9, y - 2.5, "adw-t-ink", "7.2px", value));
}

/** How wide `levelTag` will be, so a caller can reserve paper for it. */
export const levelTagWidth = (label: string, value: string): number =>
  15 + label.length * 4.9 + value.length * 4.4;

/** A leader line with a note at its end — the callout an assembly needs. */
export function leader(
  out: string[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  lines: readonly string[],
  anchor: "start" | "end" = "start",
): void {
  const kneeX = toX + (anchor === "start" ? -10 : 10);
  // OPEN polyline — a leader that closes back on itself is a triangle, not a
  // leader, and it reads as a piece of the building.
  out.push(
    path(
      polyD(
        [
          [fromX, fromY],
          [kneeX, toY],
          [toX, toY],
        ],
        false,
      ),
      "adw-hair",
      0.6,
    ),
  );
  out.push(circle(fromX, fromY, 1.6, "adw-poche", 0, ' stroke="none"'));
  lines.forEach((s, i) => {
    out.push(
      text(toX, toY + 3 + i * 9, i === 0 ? "adw-t-ink" : "adw-t-dim", i === 0 ? "7.5px" : "7px", s, ` text-anchor="${anchor}"`),
    );
  });
}

/* --------------------------------------------------------- north + scale --- */

/** North arrow. Every plan sheet in this set is drawn NORTH UP, so the arrow
 *  points to the top of the page and says so by pointing, not by rotating. */
export function northArrow(out: string[], cx: number, cy: number, r = 16): void {
  out.push(circle(cx, cy, r, "adw-ink", 0.7));
  out.push(
    path(
      polyD([
        [cx, cy - r * 0.82],
        [cx + r * 0.36, cy + r * 0.6],
        [cx, cy + r * 0.24],
      ]),
      "adw-poche",
      0,
      ' stroke="none"',
    ),
  );
  out.push(
    poly(
      [
        [cx, cy - r * 0.82],
        [cx - r * 0.36, cy + r * 0.6],
        [cx, cy + r * 0.24],
      ],
      "adw-ink",
      0.7,
    ),
  );
  out.push(text(cx, cy - r - 5, "adw-t-ink", "9px", "N", ` text-anchor="middle" letter-spacing="1"`));
}

/** A graphic scale bar. Printed because a set gets photocopied and re-scaled
 *  on the way to a printer, and the bar is the only thing on the sheet that
 *  survives that honestly. Bar length is chosen so it lands between 60 and
 *  190 points at whatever scale the sheet ended up at. */
export function scaleBar(out: string[], x: number, y: number, s: DrawScale): void {
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500];
  let feet = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (c * s.ptPerFt >= 60) {
      feet = c;
      break;
    }
  }
  const w = feet * s.ptPerFt;
  const half = w / 2;
  // solid/void halves, the way a graphic scale reads
  out.push(rect(x, y - 3, half, 6, "adw-poche", 0, ' stroke="none"'));
  out.push(rect(x, y - 3, w, 6, "adw-ink", 0.6));
  out.push(line(x + half, y - 3, x + half, y + 3, "adw-ink", 0.6));
  out.push(text(x, y + 13, "adw-t-dim", "6.5px", "0", ` text-anchor="middle"`));
  out.push(text(x + half, y + 13, "adw-t-dim", "6.5px", `${feet / 2}'`, ` text-anchor="middle"`));
  out.push(text(x + w, y + 13, "adw-t-dim", "6.5px", `${feet}'`, ` text-anchor="middle"`));
  out.push(text(x + w + 8, y + 3, "adw-t-dim", "6.5px", s.label));
}

/* ------------------------------------------------------------ the sheet --- */

export interface TitleBlock {
  /** "A3" */
  number: string;
  /** "FLOOR PLAN" */
  title: string;
  /** Printed verbatim; "NOT TO SCALE" is a legitimate value. */
  scaleLabel: string;
  projectName: string;
  /** ISO date, a PARAMETER — this module never reads a clock. */
  dateISO: string;
  drawnBy: string;
  revision: string;
  /** Up to four lines of project data under the project name. */
  meta: readonly string[];
}

export interface SheetOptions extends TitleBlock {
  /** Everything inside the drawing area, already in paper points. */
  body: string;
  /** General notes down the right-hand column. Empty means no column drawn. */
  notes: readonly string[];
  /** Accessible description; the stamp is appended automatically. */
  description: string;
}

/** Draw the general-notes column. Returns nothing when there are no notes. */
function notesColumn(out: string[], notes: readonly string[]): void {
  if (notes.length === 0) return;
  const x = SHEET_W - MARGIN - NOTES_W;
  let y = MARGIN + 12;
  out.push(line(x, MARGIN, x, SHEET_H - MARGIN - TITLE_H, "adw-hair", 0.5));
  out.push(
    text(x + 8, y, "adw-t-ink", "8px", "GENERAL NOTES", ` letter-spacing="1.4"`),
  );
  y += 12;
  const cols = charsIn(NOTES_W - 26, 6.6);
  notes.forEach((note, i) => {
    const lines = wrap(note, cols);
    if (y + lines.length * 8.4 > SHEET_H - MARGIN - TITLE_H - 6) return; // never overrun the block
    out.push(text(x + 8, y + 6, "adw-t-dim", "6.6px", `${i + 1}.`));
    lines.forEach((s, j) => {
      out.push(text(x + 20, y + 6 + j * 8.4, "adw-t-dim", "6.6px", s));
    });
    y += lines.length * 8.4 + 6;
  });
}

function titleBlock(out: string[], tb: TitleBlock): void {
  const top = SHEET_H - MARGIN - TITLE_H;
  const right = SHEET_W - MARGIN;
  const boxX = right - 168;

  out.push(line(MARGIN, top, right, top, "adw-ink", 0.9));
  out.push(line(boxX, top, boxX, SHEET_H - MARGIN, "adw-ink", 0.7));

  // --- left: whose drawing this is, and what it is of
  out.push(text(MARGIN, top + 22, "adw-t-ink", "14px", tb.projectName, ` letter-spacing="2"`));
  tb.meta.slice(0, 5).forEach((m, i) => {
    out.push(text(MARGIN, top + 38 + i * 11, "adw-t-dim", "7.5px", m));
  });

  // --- middle-right: the stamp, and who is responsible for the set
  STAMP.forEach((s, i) => {
    out.push(
      text(boxX - 14, top + 24 + i * 12, "adw-t-accent", "8px", s, ` text-anchor="end"`),
    );
  });
  out.push(
    text(
      boxX - 14,
      top + 56,
      "adw-t-dim",
      "7px",
      `DATE ${tb.dateISO}   ·   DRAWN ${tb.drawnBy}   ·   REV ${tb.revision}`,
      ` text-anchor="end"`,
    ),
  );
  out.push(
    text(
      boxX - 14,
      top + 68,
      "adw-t-dim",
      "7px",
      "Generated from a HomeSpec by the Aura drawing engine. Deterministic, no AI in the linework.",
      ` text-anchor="end"`,
    ),
  );
  out.push(
    text(
      boxX - 14,
      top + 84,
      "adw-t-dim",
      "7px",
      "Dimensions to structure. Verify all dimensions on site before ordering.",
      ` text-anchor="end"`,
    ),
  );

  // --- right: the sheet's own identity
  out.push(text(boxX + 12, top + 20, "adw-t-dim", "7.5px", "SHEET", ` letter-spacing="1.4"`));
  out.push(
    text(boxX + 12, top + 52, "adw-t-ink", "28px", tb.number, ` letter-spacing="1"`),
  );
  out.push(text(boxX + 12, top + 68, "adw-t-ink", "8px", tb.title, ` letter-spacing="1"`));
  out.push(text(boxX + 12, top + 82, "adw-t-dim", "7px", `SCALE  ${tb.scaleLabel}`));
}

/** Assemble one finished sheet. */
export function sheet(o: SheetOptions): string {
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_W}pt" height="${SHEET_H}pt" ` +
      `viewBox="0 0 ${SHEET_W} ${SHEET_H}" role="img" style="${PENS}">`,
  );
  out.push(
    `<title>${esc(`${o.number} ${o.title} — ${o.description} ${STAMP[0]}`)}</title>`,
  );
  out.push(`<style>${SHEET_CSS}</style>`);
  out.push(rect(0, 0, SHEET_W, SHEET_H, "adw-paper", 0, ' stroke="none"'));
  // the sheet border, 0.25" in — a drawing has an edge
  out.push(rect(18, 18, SHEET_W - 36, SHEET_H - 36, "adw-ink", 0.9));
  out.push(o.body);
  notesColumn(out, o.notes);
  titleBlock(out, o);
  out.push(`</svg>`);
  return out.join("");
}

/** A sheet as a data URL, for a download link or an `<img src>`. Rendered
 *  standalone the page tokens are gone, so it falls back to white paper and
 *  `currentColor` ink — which is what a downloaded drawing should be. */
export const drawingDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/* ------------------------------------------------------------- tables --- */

export interface TableColumn {
  header: string;
  /** Width in points. */
  w: number;
  align?: "start" | "middle" | "end";
}

/**
 * A ruled schedule table. Schedules are the part of a set a supplier actually
 * quotes from, so they are drawn as a table with real rules rather than as a
 * paragraph pretending to be one.
 *
 * Returns the y of the row below the last one drawn, so a caller can stack a
 * second table under the first.
 */
export function table(
  out: string[],
  x: number,
  y: number,
  cols: readonly TableColumn[],
  rows: readonly (readonly string[])[],
  opts: { rowH?: number; title?: string; size?: number } = {},
): number {
  const rowH = opts.rowH ?? 15;
  const size = opts.size ?? 7;
  const w = cols.reduce((s, c) => s + c.w, 0);
  let top = y;

  if (opts.title) {
    out.push(text(x, top, "adw-t-ink", "9px", opts.title, ` letter-spacing="1.4"`));
    top += 12;
  }

  // header band
  out.push(rect(x, top, w, rowH, "adw-ink", 0.8));
  let cx = x;
  for (const c of cols) {
    const tx = c.align === "middle" ? cx + c.w / 2 : c.align === "end" ? cx + c.w - 5 : cx + 5;
    out.push(
      text(tx, top + rowH - 5, "adw-t-ink", `${size}px`, c.header, ` text-anchor="${c.align ?? "start"}" letter-spacing="0.7"`),
    );
    cx += c.w;
    if (cx < x + w - 0.5) out.push(line(cx, top, cx, top + rowH, "adw-ink", 0.5));
  }
  top += rowH;

  rows.forEach((row) => {
    out.push(rect(x, top, w, rowH, "adw-hair", 0.5));
    let rx = x;
    cols.forEach((c, i) => {
      const tx = c.align === "middle" ? rx + c.w / 2 : c.align === "end" ? rx + c.w - 5 : rx + 5;
      out.push(
        text(tx, top + rowH - 5, "adw-t-dim", `${size}px`, row[i] ?? "", ` text-anchor="${c.align ?? "start"}"`),
      );
      rx += c.w;
      if (rx < x + w - 0.5) out.push(line(rx, top, rx, top + rowH, "adw-hair", 0.4));
    });
    top += rowH;
  });

  return top;
}
