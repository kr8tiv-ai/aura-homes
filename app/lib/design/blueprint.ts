/* ---------------------------------------------------------------------
   THE BLUEPRINT SHEET — drawn in the browser, from solved geometry.

   A port of `design-api/app/services/blueprint.py::render_svg`. It draws
   what a drafter would draw, in the order a drafter would draw it: poché
   (solid-filled) structural walls, thinner partitions, window cuts with
   sill lines, doors as a leaf plus a swing arc, room labels with computed
   areas, dimension lines with extension lines and 45° ticks, a title
   block, and a scale bar.

   No AI is involved at this layer at all. Every coordinate arrives from
   the layout solver; this module only inks it. That is the same division
   of labour the service publishes — the LLM owns the room PROGRAM, the
   deterministic packer owns the GEOMETRY — and it is why the drawing can
   run client-side with no key, no server, and no latency.

   WHY IT IS HERE AND NOT ON THE SERVICE. aurahomes.fun is a static export;
   a FastAPI process is not part of it. The deterministic path never needed
   one, so it moves into the page and the live site always draws. The
   Python service stays exactly as it is and becomes the optional upgrade
   that adds AI renders. PDF (cairosvg) and DXF (ezdxf) are NOT ported —
   both are native-code writers and both remain service-only.

   UNITS. Model space is FEET (origin top-left, +x right, +y down, matching
   SVG). Paper space is POINTS (72/in). At 1/4" = 1'-0" one foot is 18pt,
   which puts a 40' house on Letter with room left for dimensions.

   DETERMINISM. Pure string building — no clock, no randomness, no network,
   no DOM. The same plan always produces byte-identical markup.
--------------------------------------------------------------------- */

import { formatFdwr, type DesignRequest, type FloorPlan, type PlacedRoom } from "@/lib/designApi";

/* ------------------------------------------------------- what we are given */

/** A door or window cut in a wall segment — `Opening` in the service's
 *  `models.py`. It is geometry the DRAWING consumes rather than something the
 *  result page renders, which is why the frozen client contract in
 *  `lib/designApi.ts` does not carry it; declared here structurally so either
 *  producer (the ported solver, or the service's JSON) satisfies it. */
export interface Opening {
  kind: "door" | "window";
  /** Wall the opening sits in. */
  wall: "n" | "s" | "e" | "w";
  /** Position along that wall, 0..1 from the wall's start. */
  t: number;
  /** Clear width, feet. */
  width: number;
  swing?: "in" | "out" | null;
}

/** A placed room that may carry its openings. Optional on purpose: a plain
 *  `PlacedRoom` off the wire is still drawable — it just draws no leaves or
 *  glass, rather than the renderer inventing openings the FDWR in the title
 *  block never accounted for. */
export interface BlueprintRoom extends PlacedRoom {
  openings?: Opening[];
}

/** The solved plan as the sheet consumes it. A bare `FloorPlan` is assignable
 *  to this, so callers can pass the service response unchanged. */
export interface BlueprintPlan extends FloorPlan {
  rooms: BlueprintRoom[];
}

export interface BlueprintOptions {
  /** Sheet title, top-left of the title block. */
  title?: string;
}

/* ------------------------------------------------------------- paper scale */

const MM_PER_FT = 304.8;
const PT_PER_IN = 72;

/** 1/4" = 1'-0" — the standard residential plan scale. */
const SCALE_DENOM = 48;
const PT_PER_FT = (PT_PER_IN / SCALE_DENOM) * 12; // = 18pt per foot

const MARGIN = 54; // 0.75" paper margin
const DIM_OFFSET = 26;
const TITLE_H = 96;

/** Model feet → paper points. */
const ft = (v: number): number => v * PT_PER_FT;

/* -------------------------------------------------------- number formatting

   Python rounds halves to EVEN (`round()`, and every `format()` spec), where
   JavaScript's `Math.round`/`toFixed` push ties away from the even value. The
   difference only shows on an exact tie — a room solving to a whole half-inch,
   an area landing on x.5 — but this is a port, so it rounds the way the source
   rounds rather than nearly the way it rounds.                               */

function pyRound(v: number, digits = 0): number {
  const p = 10 ** digits;
  const scaled = v * p;
  let r = Math.round(scaled); // JS breaks ties toward +∞ …
  if (Math.abs(scaled % 1) === 0.5 && r % 2 !== 0) r -= 1; // … Python, toward even
  return r / p;
}

/** Python's `f"{v:.Nf}"`. */
const fx = (v: number, digits: number): string => pyRound(v, digits).toFixed(digits);

/** A stroke width or similar: short, with trailing zeros dropped. */
const num = (v: number): string => String(pyRound(v, 3));

/** Python's `:g` — 6 significant digits, trailing zeros stripped, so 1.0
 *  prints "1" and 1.5 stays "1.5". Bathrooms come in half steps. */
const fmtG = (v: number): string => String(Number(v.toPrecision(6)));

/** Feet-and-inches, the way a drawing labels it: 12'-6".
 *  Matches `feetInches()` in `components/design/ecoSpec.ts` except on an exact
 *  half-inch tie, where this one follows the Python. */
function fmtFt(v: number): string {
  let whole = Math.trunc(v);
  let inches = pyRound((v - whole) * 12);
  if (inches === 12) {
    whole += 1;
    inches = 0;
  }
  return `${whole}'-${inches}"`;
}

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* --------------------------------------------------------------- the pens

   The sheet is injected into a page with a real dark mode, so nothing here is
   a literal colour. Every pen resolves through three steps:

     1. `--blueprint-*`  — a per-instance override the host can set
     2. `--st-*`         — the site's document tokens (globals.css), which
                           already flip under `:root[data-theme="dark"]`
     3. a terminal value — so a downloaded .svg opened on its own still reads

   `currentColor` is the terminal fallback for the inks, which makes the
   drawing inherit whatever text colour it is dropped into. PAPER is the one
   exception: it must be OPAQUE, because the opening knock-outs are painted in
   it, and a transparent knock-out would leave the poché wall unbroken with the
   glass drawn on top of solid black.

   The site's tokens happen to be the exact colours the Python names — INK
   #171a18 is `--tone-ink`, HAIR #9aa19d is `--tone-faint`, LABEL #5f6663 is
   `--tone-dim`, GLASS #0f766e is `--tone-teal`, ACCENT #047857 is
   `--tone-emerald` — so in light mode this is the same drawing, and in dark
   mode it inverts as a document should instead of burning a white rectangle
   into the page.                                                            */

const PENS = [
  "--abp-paper: var(--blueprint-paper, var(--st-paper, #ffffff))",
  "--abp-ink: var(--blueprint-ink, var(--st-ink, currentColor))",
  "--abp-dim: var(--blueprint-dim, var(--st-ink-dim, currentColor))",
  "--abp-hair: var(--blueprint-hair, var(--st-faint, currentColor))",
  "--abp-glass: var(--blueprint-glass, var(--st-teal, #0f766e))",
  "--abp-accent: var(--blueprint-accent, var(--st-emerald-deep, #047857))",
  // single quotes on purpose: this whole string lives inside a double-quoted
  // style="" attribute, and a stray double quote ends the attribute early
  "font-family: var(--blueprint-font, 'Helvetica Neue', Helvetica, Arial, sans-serif)",
  // Intrinsic size stays in points, because a sheet has a real size; these let
  // the host box narrow it without the drawing distorting or leaving a
  // baseline gap. min-width from the host still wins, so it can also scroll.
  "display: block",
  "max-width: 100%",
  "height: auto",
].join(";");

/* `var()` is not honoured inside SVG presentation attributes, so the pens are
   applied through classes. They are prefixed because an inline <style> is not
   scoped — these rules land in the host document. */
const SHEET_CSS = [
  ".abp-poche{fill:var(--abp-ink)}",
  ".abp-paper{fill:var(--abp-paper)}",
  ".abp-ink{stroke:var(--abp-ink);fill:none}",
  ".abp-hair{stroke:var(--abp-hair);fill:none}",
  ".abp-part{stroke:var(--abp-dim);fill:none}",
  ".abp-glass{stroke:var(--abp-glass);fill:none}",
  ".abp-knock{stroke:var(--abp-paper);fill:none}",
  ".abp-t-ink{fill:var(--abp-ink)}",
  ".abp-t-dim{fill:var(--abp-dim)}",
  ".abp-t-accent{fill:var(--abp-accent)}",
].join("");

/** The stamp. Mandatory on every drawing this project produces: permit-ready
 *  AI drawings do not exist, and the repo's honesty policy forbids implying
 *  otherwise. Kept as two lines so it cannot collide with the title-block
 *  metadata on a small sheet. */
const STAMP = [
  "REVIEW-READY DESIGN PACKAGE — NOT FOR CONSTRUCTION.",
  "A licensed Alberta residential designer completes the permit set.",
];

/* ---------------------------------------------------------------- elements */

const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cls: string,
  width: number,
  extra = ""
): string =>
  `<line x1="${fx(x1, 2)}" y1="${fx(y1, 2)}" x2="${fx(x2, 2)}" y2="${fx(y2, 2)}" ` +
  `class="${cls}" stroke-width="${num(width)}"${extra}/>`;

const text = (
  x: number,
  y: number,
  cls: string,
  size: string,
  body: string,
  extra = ""
): string =>
  `<text x="${fx(x, 2)}" y="${fx(y, 2)}" class="${cls}" font-size="${size}"${extra}>` +
  `${esc(body)}</text>`;

/* ---------------------------------------------------------------- openings */

/** Endpoints of a room wall in model feet, ordered along the run. */
function wallRun(r: PlacedRoom, wall: Opening["wall"]): [number, number, number, number] {
  switch (wall) {
    case "n":
      return [r.x, r.y, r.x + r.w, r.y];
    case "s":
      return [r.x, r.y + r.h, r.x + r.w, r.y + r.h];
    case "w":
      return [r.x, r.y, r.x, r.y + r.h];
    case "e":
      return [r.x + r.w, r.y, r.x + r.w, r.y + r.h];
  }
}

/** The clear span of one opening, clamped inside its wall. */
function openingSpan(r: PlacedRoom, o: Opening): [number, number, number, number] {
  const [x1, y1, x2, y2] = wallRun(r, o.wall);
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L <= 0) return [x1, y1, x1, y1];
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const c = L * o.t;
  const a = Math.max(0, c - o.width / 2);
  const b = Math.min(L, c + o.width / 2);
  return [x1 + ux * a, y1 + uy * a, x1 + ux * b, y1 + uy * b];
}

function drawWindow(out: string[], r: PlacedRoom, o: Opening, wallFt: number): void {
  const [ax, ay, bx, by] = openingSpan(r, o);
  // the glass line, plus a sill line offset into the wall thickness
  out.push(line(ft(ax), ft(ay), ft(bx), ft(by), "abp-glass", 1.6));
  const nx = o.wall === "n" || o.wall === "s" ? 0 : 1;
  const ny = o.wall === "n" || o.wall === "s" ? 1 : 0;
  const off = wallFt * 0.34;
  out.push(
    line(
      ft(ax + nx * off),
      ft(ay + ny * off),
      ft(bx + nx * off),
      ft(by + ny * off),
      "abp-glass",
      0.7,
      ' opacity="0.75"'
    )
  );
}

/** Leaf + swing arc — the thing that makes a plan read as architectural. */
function drawDoor(out: string[], r: PlacedRoom, o: Opening): void {
  const [ax, ay, bx, by] = openingSpan(r, o);
  const L = Math.hypot(bx - ax, by - ay);
  if (L <= 0) return;
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  // hinge at the a-end; swing INTO the room
  const inward: Record<Opening["wall"], [number, number]> = {
    n: [0, 1],
    s: [0, -1],
    w: [1, 0],
    e: [-1, 0],
  };
  const [ix, iy] = inward[o.wall];
  const lx = ax + ix * L;
  const ly = ay + iy * L; // leaf, fully open
  out.push(line(ft(ax), ft(ay), ft(lx), ft(ly), "abp-ink", 1.1));
  // arc from the open leaf round to the closed position at b
  const sweep = ux * iy - uy * ix < 0 ? 1 : 0;
  out.push(
    `<path class="abp-hair" stroke-width="0.6" stroke-dasharray="3,2" ` +
      `d="M ${fx(ft(lx), 2)},${fx(ft(ly), 2)} A ${fx(ft(L), 2)},${fx(ft(L), 2)} 0 0 ` +
      `${sweep} ${fx(ft(bx), 2)},${fx(ft(by), 2)}"/>`
  );
}

/* -------------------------------------------------------------- dimensions */

/** A dimension line with 45-degree ticks and extension lines. Coordinates are
 *  already paper points; `side` picks which way the line is offset. */
function dim(
  out: string[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  body: string,
  side: 1 | -1 = -1
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (L <= 0) return;
  const nx = (-dy / L) * side; // outward normal
  const ny = (dx / L) * side;
  const ox = nx * DIM_OFFSET;
  const oy = ny * DIM_OFFSET;

  // extension lines, run slightly past the dimension line
  for (const [px, py] of [
    [x1, y1],
    [x2, y2],
  ] as const) {
    out.push(line(px, py, px + ox * 1.16, py + oy * 1.16, "abp-hair", 0.5));
  }
  out.push(line(x1 + ox, y1 + oy, x2 + ox, y2 + oy, "abp-ink", 0.7));

  // 45° ticks: the run direction plus the normal, which is what makes the
  // slash rather than a perpendicular architectural arrow
  const tx = (dx / L) * 4;
  const ty = (dy / L) * 4;
  for (const [px, py] of [
    [x1 + ox, y1 + oy],
    [x2 + ox, y2 + oy],
  ] as const) {
    out.push(
      line(px - tx - nx * 4, py - ty - ny * 4, px + tx + nx * 4, py + ty + ny * 4, "abp-ink", 0.7)
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
      "abp-t-ink",
      "8px",
      body,
      ` text-anchor="middle" transform="rotate(${fx(rot, 1)},${fx(mx, 2)},${fx(my, 2)})"`
    )
  );
}

/* ----------------------------------------------------------------- the sheet */

/**
 * Draw the sheet. Returns SVG markup at 1/4" = 1'-0", ready to inject.
 *
 * @param plan solved geometry — rooms carry their openings when the solver
 *             produced them; without openings the walls simply draw unbroken.
 * @param req  the questionnaire, for the title block only. Nothing in it moves
 *             a line: the geometry is already solved.
 */
export function renderBlueprintSvg(
  plan: BlueprintPlan,
  req: DesignRequest,
  opts: BlueprintOptions = {}
): string {
  const title = opts.title ?? "AURA HOMES";
  const wallFt = plan.wall_mm / MM_PER_FT;
  const partFt = plan.partition_mm / MM_PER_FT;

  const pw = ft(plan.width) + MARGIN * 2 + DIM_OFFSET * 2;
  const ph = ft(plan.height) + MARGIN * 2 + DIM_OFFSET * 2 + TITLE_H;

  const W = ft(plan.width);
  const H = ft(plan.height);
  const tw = ft(wallFt);
  const partW = Math.max(1.2, ft(partFt));
  // the knock-out is drawn slightly proud of the wall so no black hairline
  // survives at the edge of a cut opening
  const knockW = Math.max(2.0, ft(wallFt) * 1.05);

  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fx(pw, 0)}pt" height="${fx(ph, 0)}pt" ` +
      `viewBox="0 0 ${fx(pw, 0)} ${fx(ph, 0)}" role="img" style="${PENS}">`
  );
  out.push(
    `<title>${esc(
      `Dimensioned floor plan, ${fmtFt(plan.width)} by ${fmtFt(plan.height)}, ` +
        `${plan.rooms.length} rooms. ${STAMP[0]}`
    )}</title>`
  );
  out.push(`<style>${SHEET_CSS}</style>`);
  out.push(`<rect x="0" y="0" width="${fx(pw, 2)}" height="${fx(ph, 2)}" class="abp-paper"/>`);

  // ---- the drawing itself, inset by the margin and the dimension gutter
  out.push(`<g transform="translate(${MARGIN + DIM_OFFSET},${MARGIN + DIM_OFFSET})">`);

  // --- structural envelope, drawn as poché: outer rect minus inner rect.
  //     evenodd on a two-subpath ring is what fills the wall solid — the
  //     convention that separates a structural wall from a drawn line.
  out.push(
    `<path class="abp-poche" fill-rule="evenodd" d="M 0,0 H ${fx(W, 2)} V ${fx(H, 2)} H 0 Z ` +
      `M ${fx(tw, 2)},${fx(tw, 2)} H ${fx(W - tw, 2)} V ${fx(H - tw, 2)} H ${fx(tw, 2)} Z"/>`
  );

  // --- interior partitions: the same 90 mm everywhere, and thinner than the
  //     envelope, because they are not structural
  for (const r of plan.rooms) {
    out.push(
      `<rect x="${fx(ft(r.x), 2)}" y="${fx(ft(r.y), 2)}" width="${fx(ft(r.w), 2)}" ` +
        `height="${fx(ft(r.h), 2)}" class="abp-part" stroke-width="${num(partW)}"/>`
    );
  }

  // --- knock the openings back out of the walls, then draw them
  for (const r of plan.rooms) {
    const openings = r.openings ?? [];
    for (const o of openings) {
      const [ax, ay, bx, by] = openingSpan(r, o);
      out.push(line(ft(ax), ft(ay), ft(bx), ft(by), "abp-knock", knockW));
    }
    for (const o of openings) {
      if (o.kind === "window") drawWindow(out, r, o, wallFt);
      else drawDoor(out, r, o);
    }
  }

  // --- labels: name over area and dimensions, centred in the room
  for (const r of plan.rooms) {
    const cx = ft(r.x + r.w / 2);
    const cy = ft(r.y + r.h / 2);
    const label = ` text-anchor="middle" letter-spacing="0.8"`;
    out.push(text(cx, cy - 3, "abp-t-ink", "9px", r.name.toUpperCase(), label));
    out.push(
      text(
        cx,
        cy + 9,
        "abp-t-dim",
        "6.5px",
        `${fx(r.w * r.h, 0)} SQ FT  ·  ${fmtFt(r.w)} x ${fmtFt(r.h)}`,
        ` text-anchor="middle"`
      )
    );
  }

  // --- overall dimensions
  dim(out, 0, 0, W, 0, fmtFt(plan.width), -1);
  dim(out, W, 0, W, H, fmtFt(plan.height), -1);
  // --- per-room running dimensions along the top band, read out at the bottom
  const xs = Array.from(
    new Set(plan.rooms.filter((r) => r.y < plan.height / 2).map((r) => pyRound(r.x, 2))).add(plan.width)
  ).sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    // anything under 2' is a jog, not a bay — dimensioning it just crowds the string
    if (b - a > 2) dim(out, ft(a), H, ft(b), H, fmtFt(b - a), 1);
  }

  out.push(`</g>`);

  // ---- title block
  const ty = ph - TITLE_H - MARGIN * 0.35;
  out.push(line(MARGIN, ty, pw - MARGIN, ty, "abp-ink", 0.9));
  out.push(text(MARGIN, ty + 22, "abp-t-ink", "14px", title, ` letter-spacing="2"`));

  const material = req.material ?? "sip";
  const zone = req.climate_zone ?? "7A";
  const meta = [
    `${req.bedrooms} BED · ${fmtG(req.bathrooms)} BATH · ${fx(plan.gross_sq_ft, 0)} SQ FT GROSS`,
    // the wall is the material's REAL thickness — SIP 165, CLT 128, timber
    // frame 190, rammed earth 450 — so it is stated, not implied
    `${material.replace(/_/g, " ").toUpperCase()} · ${plan.wall_mm}mm WALL · ZONE ${zone}`,
    // fenestration-and-door-to-wall ratio against the NBC 9.36 prescriptive
    // ceiling; the solver already trimmed glass to stay under it
    `FDWR ${formatFdwr(plan.fdwr)}`,
    `SCALE 1/4" = 1'-0"  ·  DIMENSIONS TO STRUCTURE`,
  ];
  meta.forEach((m, i) => {
    out.push(text(MARGIN, ty + 40 + i * 12, "abp-t-dim", "8px", m));
  });

  STAMP.forEach((s, i) => {
    out.push(text(pw - MARGIN, ty + 40 + i * 11, "abp-t-accent", "7.5px", s, ` text-anchor="end"`));
  });

  // ---- scale bar: five feet, ticked at every foot, so a printed sheet can be
  //      checked against a rule even if it was scaled on the way to the printer
  const sbX = pw - MARGIN - ft(5);
  const sbY = ty + 66;
  out.push(line(sbX, sbY, sbX + ft(5), sbY, "abp-ink", 1));
  for (let i = 0; i < 6; i++) {
    const px = sbX + ft(i);
    out.push(line(px, sbY - 3, px, sbY + 3, "abp-ink", 0.7));
  }
  out.push(text(sbX, sbY + 12, "abp-t-dim", "6.5px", "0", ` text-anchor="middle"`));
  out.push(text(sbX + ft(5), sbY + 12, "abp-t-dim", "6.5px", "5'", ` text-anchor="middle"`));

  out.push(`</svg>`);
  return out.join("");
}

/** The sheet as a data URL, for a download link or an `<img src>`.
 *  Rendered standalone the page's tokens are gone, so the drawing falls back
 *  to white paper and `currentColor` ink — which is what a downloaded drawing
 *  should be. */
export const blueprintDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
