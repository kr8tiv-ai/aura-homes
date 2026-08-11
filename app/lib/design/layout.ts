/**
 * The deterministic layout engine — a line-for-line port of
 * `design-api/app/services/layout.py`, moved into the browser.
 *
 * WHY IT LIVES HERE. The Python service's deterministic path needs no keys, no
 * network and no state: it turns a room *program* into geometry with pure
 * arithmetic. Anything with those properties has no business being a server the
 * site can fail to reach. aurahomes.fun is a static export, so the centrepiece
 * of `02 · DESIGN` runs client-side and always works. The FastAPI service stays
 * exactly as it is and becomes the optional upgrade that adds AI renders.
 *
 * THE DIVISION OF LABOUR, which is the whole point of the service:
 * the LLM reasons about the PROGRAM (how many rooms, roughly how big, which
 * ones want windows, which are wet), and this module solves the GEOMETRY.
 * Nothing that ends up on a dimensioned drawing is produced by a language
 * model. `docs/AI-TOOLS-RESEARCH.md` reached the same conclusion after
 * surveying the field: the published floor-plan generators are "a research
 * field wearing a product costume", the most-cited model (HouseDiffusion) is
 * GPL-3.0 *and* trained on a research-only dataset, and none of them can be
 * shipped commercially. So we generate plans procedurally instead.
 *
 * THE ALGORITHM — squarified treemap slicing with a circulation spine.
 *
 * 1. Choose an exterior envelope with a sane aspect ratio for the target area.
 * 2. Reserve a circulation spine (hall) so rooms are reachable — a plan whose
 *    bedrooms open into each other is not a plan.
 * 3. Recursively slice the remaining rectangle proportionally to room areas,
 *    always cutting across the LONGER axis so rooms tend toward square. This
 *    is the squarified-treemap heuristic; it is what stops the packer from
 *    producing 3ft x 40ft "rooms" that are numerically correct and useless.
 * 4. Cluster wet rooms so plumbing shares a wall.
 * 5. Place openings: one door per room onto the spine, windows on exterior
 *    walls only, capped so the plan cannot exceed the FDWR ceiling.
 *
 * Everything is in FEET, origin top-left, +x right, +y down — matching SVG.
 *
 * PURITY CONTRACT. No network, no Node APIs, no `Math.random`, no `Date.now`.
 * Identical input gives byte-identical output, forever — that is what lets the
 * blueprint, the bill of materials and the price agree with each other.
 */

import type {
  DesignRequest,
  EcoMaterial,
  FloorPlan,
  PlacedRoom,
} from "@/lib/designApi";
import { FDWR_MAX, PARTITION_MM, WALL_THICKNESS_MM } from "./materials";

// --------------------------------------------------------------------------
// constants
// --------------------------------------------------------------------------

export const MM_PER_FT = 304.8;

/**
 * Minimum habitable room dimension, feet. NBC 9.5 sets minimum *areas*; this is
 * the dimensional floor that keeps the packer honest — the engine says the plan
 * is too tight rather than drawing a 3-foot bedroom.
 */
export const MIN_DIM = 6.0;

/**
 * Circulation width. 3'-6" is a comfortable hall that still passes as
 * barrier-free-ready without claiming compliance.
 */
export const HALL_W = 3.5;

/** Storey height used for the FDWR wall area. 9'-0" plate. */
export const WALL_HEIGHT_FT = 9.0;

// `PARTITION_MM` (90 mm, non-structural) and `FDWR_MAX` (0.22, the NBC 9.36
// prescriptive fenestration ceiling) are imported from `./materials` rather
// than restated here. Glass-forward is the house style, but the blueprint must
// not silently draw more glass than the code allows: exceeding FDWR_MAX trims
// windows and emits a warning naming the performance path as the way to buy the
// glass back.

// --------------------------------------------------------------------------
// types — the geometry vocabulary `lib/designApi.ts` does not declare
// --------------------------------------------------------------------------
//
// `DesignRequest`, `PlacedRoom` and `FloorPlan` are frozen in `lib/designApi.ts`
// and imported, never redefined. What follows is only the extra vocabulary the
// solver needs: the room *program* it consumes, and the openings it produces.

/**
 * One room, as reasoned by the LLM (or by `defaultProgram` offline).
 * Dimensions are FEET.
 *
 * The LLM proposes; the layout engine disposes. These numbers are treated as a
 * *program* (this many rooms, roughly this big, this many windows), not as
 * coordinates — the engine re-solves the packing so walls meet at right angles
 * and the areas actually sum to the requested total.
 */
export interface RoomSpec {
  name: string;
  width: number;
  length: number;
  windows: number;
  /** Hint the packer honours when it can. */
  exterior?: boolean;
  /** Bathrooms/kitchen/mechanical — the packer clusters these. */
  wet?: boolean;
}

/** The structured room layout, before any geometry is solved. */
export interface LayoutPlan {
  house_style: string;
  total_sq_ft: number;
  rooms: RoomSpec[];
}

/** A door or window cut in a wall segment. `t` is 0..1 along that wall. */
export interface Opening {
  kind: "door" | "window";
  wall: "n" | "s" | "e" | "w";
  t: number;
  width: number;
  swing?: "in" | "out";
}

/**
 * A packed room. Structurally a `PlacedRoom` (the frozen contract) plus the
 * openings the blueprint renderer needs to cut the walls.
 */
export interface SolvedRoom extends PlacedRoom {
  openings: Opening[];
}

/**
 * The solved plan. Assignable to `FloorPlan` — same fields, same names, with
 * the rooms carrying their openings. Callers that only need the contract can
 * hold this as a `FloorPlan` with no cast.
 */
export interface SolvedFloorPlan extends Omit<FloorPlan, "rooms"> {
  rooms: SolvedRoom[];
}

/** Program area of one room spec, feet². */
export const specArea = (r: RoomSpec): number => r.width * r.length;

/**
 * Neumaier compensated summation — what CPython's `sum()` actually does for
 * floats since 3.12 (gh-100425), and therefore what the service does.
 *
 * This is not decoration. Naive left-to-right addition drifts one or two ULP
 * from the compensated result, and in this engine those ULP are not inert: the
 * sums feed the slice fraction `frac`, so a last-bit difference walks straight
 * into a room's solved width, its window width, and any `.1f` warning printed
 * about it. Ported literally so the browser and the service agree bit for bit.
 */
function pySum(values: readonly number[]): number {
  let sum = 0.0;
  let c = 0.0; // running compensation for the bits `sum` could not hold
  for (const x of values) {
    const t = sum + x;
    if (Math.abs(sum) >= Math.abs(x)) c += sum - t + x;
    else c += x - t + sum;
    sum = t;
  }
  return sum + c;
}

const sumSpecArea = (rooms: readonly RoomSpec[]): number =>
  pySum(rooms.map(specArea));

// --------------------------------------------------------------------------
// CPython numeric semantics
// --------------------------------------------------------------------------

/**
 * CPython's `round()`: half-to-**EVEN**, decided on the *exact binary value* of
 * the double rather than on its shortest decimal repr.
 *
 * This is not pedantry — it is an acceptance row. A 450 sq ft studio solves to
 * 25.5 x 17.5 = 446.25 sq ft exactly, and 446.25 is a genuine tie at one
 * decimal. Python answers 446.2 (2 is even); `Number(x.toFixed(1))` answers
 * 446.3. Ship the latter and the port disagrees with the service on its own
 * published table.
 *
 * Method: `toFixed(20)` gives the exact decimal expansion of the double to 20
 * places, so a true tie (always a dyadic rational, always a short expansion) is
 * detected as a tie, while a near-tie like `round(2.675, 2)` correctly rounds
 * DOWN to 2.67 the way Python does — its stored value is 2.674999…, not 2.675.
 */
export function pyRound(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;

  const negative = value < 0;
  // Safe for every magnitude this engine produces (feet and sq ft, < 1e6);
  // toFixed only switches to exponential notation above 1e21.
  const s = Math.abs(value).toFixed(20);
  const dot = s.indexOf(".");
  const intPart = s.slice(0, dot);
  const frac = s.slice(dot + 1);
  if (digits >= frac.length) return value;

  const kept = digits > 0 ? frac.slice(0, digits) : "";
  const rest = frac.slice(digits);

  // The kept decimal, as an integer scaled by 10^digits.
  let scaled = Number(intPart + kept);
  const lead = rest.charCodeAt(0) - 48; // '0' === 48
  if (lead > 5 || (lead === 5 && /[1-9]/.test(rest.slice(1)))) {
    scaled += 1;
  } else if (lead === 5 && scaled % 2 !== 0) {
    scaled += 1; // exact tie -> round half to even
  }

  // Re-parse from a decimal string rather than dividing by 10^digits: JS number
  // parsing is correctly rounded, plain division is not.
  let out = String(scaled);
  if (digits > 0) {
    out = out.padStart(digits + 1, "0");
    out = `${out.slice(0, out.length - digits)}.${out.slice(out.length - digits)}`;
  }
  const rounded = Number(out);
  return negative ? -rounded : rounded;
}

/** Python's `f"{v:.Nf}"` — round half-to-even, then print N places. */
const pyFixed = (value: number, digits: number): string =>
  pyRound(value, digits).toFixed(digits);

/** Python's `f"{v:.N%}"` — scale by 100 first, then fixed-point, then '%'. */
const pyPercent = (value: number, digits: number): string =>
  `${pyFixed(value * 100, digits)}%`;

/** Python's `str(float)` for a whole number: `str(6.0) === "6.0"`. */
const pyFloatStr = (value: number): string =>
  Number.isInteger(value) ? value.toFixed(1) : String(value);

// --------------------------------------------------------------------------
// envelope
// --------------------------------------------------------------------------

/**
 * Pick exterior width x depth for the target footprint.
 *
 * Aspect ratio is deliberately between 1.25 and 1.6 — narrow enough that every
 * room can reach an exterior wall (daylight, cross-ventilation, and in a
 * passive-solar plan a south face worth having), wide enough that the building
 * does not read as a shipping container.
 */
export function envelopeFor(totalSqFt: number, storeys = 1): [number, number] {
  const footprint = totalSqFt / Math.max(1, storeys);
  const ratio = 1.45;
  const depth = Math.sqrt(footprint / ratio);
  const width = footprint / depth;
  // Round to 6" so the drawing dimensions are buildable numbers.
  return [pyRound(width * 2) / 2, pyRound(depth * 2) / 2];
}

// --------------------------------------------------------------------------
// squarified slicing
// --------------------------------------------------------------------------

/** Recursively cut (x,y,w,h) among `rooms`, proportional to area. */
function slice(
  rooms: readonly RoomSpec[],
  x: number,
  y: number,
  w: number,
  h: number
): SolvedRoom[] {
  if (rooms.length === 0) return [];
  if (rooms.length === 1) {
    const r = rooms[0];
    return [
      { name: r.name, x, y, w, h, windows: r.windows, wet: r.wet ?? false, openings: [] },
    ];
  }

  const total = sumSpecArea(rooms) || 1.0;

  // Split the list at the point closest to half the area.
  let running = 0;
  let cut = 1;
  let best = Infinity;
  for (let i = 1; i < rooms.length; i++) {
    running += specArea(rooms[i - 1]);
    const diff = Math.abs(running / total - 0.5);
    if (diff < best) {
      best = diff;
      cut = i;
    }
  }
  const head = rooms.slice(0, cut);
  const tail = rooms.slice(cut);
  const frac = sumSpecArea(head) / total;

  // Cut across the LONGER axis — this is the squarifying step.
  if (w >= h) {
    const wl = w * frac;
    return [...slice(head, x, y, wl, h), ...slice(tail, x + wl, y, w - wl, h)];
  }
  const hl = h * frac;
  return [...slice(head, x, y, w, hl), ...slice(tail, x, y + hl, w, h - hl)];
}

/**
 * Wet rooms adjacent (shared plumbing wall), then largest first.
 *
 * Sorting largest-first is what makes squarified treemaps behave; grouping wet
 * rooms first means the recursive split keeps them in the same branch, which is
 * how they end up sharing a wall.
 */
function orderRooms(rooms: readonly RoomSpec[]): RoomSpec[] {
  // Descending by area. Both Python's `sorted` and JS `Array#sort` are stable,
  // so equal-area rooms keep their program order in both.
  const byAreaDesc = (a: RoomSpec, b: RoomSpec) => specArea(b) - specArea(a);
  const wet = rooms.filter((r) => r.wet).sort(byAreaDesc);
  const dry = rooms.filter((r) => !r.wet).sort(byAreaDesc);
  return [...dry.slice(0, 1), ...wet, ...dry.slice(1)]; // living room anchors, then the wet core
}

// --------------------------------------------------------------------------
// openings
// --------------------------------------------------------------------------

/**
 * One door onto the circulation spine, windows on exterior walls only.
 *
 * The exterior test compares against the INTERIOR envelope (inset by the wall
 * thickness), not against 0 and the overall width. Comparing against 0 is the
 * obvious-looking bug that silently placed zero windows and reported an FDWR of
 * 0.0% — rooms start at `wallFt`, never at the origin.
 *
 * `spineCentreY` is the centre line of the hall, not its top edge.
 */
function placeOpenings(
  room: SolvedRoom,
  ix: number,
  iy: number,
  iw: number,
  ih: number,
  spineCentreY: number
): Opening[] {
  const out: Opening[] = [];
  const eps = 0.05;

  // --- door: onto whichever wall faces the spine
  const doorW = room.wet ? 2.5 : 2.8;
  if (room.y + room.h <= spineCentreY + eps) {
    out.push({ kind: "door", wall: "s", t: 0.5, width: doorW, swing: "in" });
  } else if (room.y >= spineCentreY - eps) {
    out.push({ kind: "door", wall: "n", t: 0.5, width: doorW, swing: "in" });
  } else {
    out.push({ kind: "door", wall: "w", t: 0.5, width: doorW, swing: "in" });
  }

  // --- windows: only on walls that are actually exterior
  if (room.windows <= 0) return out;
  const ext: Opening["wall"][] = [];
  if (Math.abs(room.y - iy) < eps) ext.push("n");
  if (Math.abs(room.y + room.h - (iy + ih)) < eps) ext.push("s");
  if (Math.abs(room.x - ix) < eps) ext.push("w");
  if (Math.abs(room.x + room.w - (ix + iw)) < eps) ext.push("e");
  if (ext.length === 0) return out;

  const perWall = Math.max(1, Math.floor(room.windows / ext.length));
  for (const wall of ext) {
    const span = wall === "n" || wall === "s" ? room.w : room.h;
    // At least one window, but never more than one per 5 feet of wall.
    const n = Math.min(perWall, Math.max(1, Math.floor(span / 5)));
    for (let i = 0; i < n; i++) {
      out.push({
        kind: "window",
        wall,
        t: (i + 1) / (n + 1),
        width: Math.min(4.0, span * 0.32),
      });
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// the public entry point
// --------------------------------------------------------------------------

/** Turn a room program into dimensioned, right-angled geometry. */
export function solve(req: DesignRequest, layout: LayoutPlan): SolvedFloorPlan {
  const warnings: string[] = [];

  // Wall thickness is the material's REAL structural thickness — SIP 165 mm,
  // CLT 128 mm, timber frame 190 mm, rammed earth 450 mm. It moves the interior
  // envelope, the net area and the price per square foot, so it is modelled
  // rather than drawn as a generic line.
  // SIP is the Aura default. The lookup is total over every material key, so
  // there is no fallback branch here for the same reason Python has none.
  const material: EcoMaterial = req.material ?? "sip";
  const wall_mm = WALL_THICKNESS_MM[material];
  const wallFt = wall_mm / MM_PER_FT;

  const [envW, envH] = envelopeFor(req.total_sq_ft, req.storeys ?? 1);

  // Interior envelope, inside the structural walls.
  const ix = wallFt;
  const iy = wallFt;
  const iw = envW - 2 * wallFt;
  const ih = envH - 2 * wallFt;

  const rooms = orderRooms(layout.rooms);
  if (rooms.length === 0) throw new Error("layout contains no rooms");

  // --- reserve the circulation spine across the middle of the plan
  const spineY = iy + ih * 0.5 - HALL_W / 2;
  const topH = spineY - iy;
  const botY = spineY + HALL_W;
  const botH = iy + ih - botY;

  // Split the program between the two bands, proportional to their depth.
  const totalArea = sumSpecArea(rooms) || 1.0;
  const wantTop = totalArea * (topH / (topH + botH));
  const top: RoomSpec[] = [];
  let acc = 0;
  for (const r of rooms) {
    if (acc < wantTop || top.length === 0) {
      top.push(r);
      acc += specArea(r);
    } else {
      break;
    }
  }
  let bottom = rooms.slice(top.length);
  if (bottom.length === 0) {
    // Never leave a band empty.
    const moved = top[top.length - 1];
    top.length -= 1;
    bottom = [moved];
  }

  const placed = [
    ...slice(top, ix, iy, iw, topH),
    ...slice(bottom, ix, botY, iw, botH),
  ];

  // --- quality gates. The warnings ARE the product: a packer that quietly
  // draws a 3-foot bedroom is worse than one that admits the program does not
  // fit the envelope.
  for (const p of placed) {
    if (Math.min(p.w, p.h) < MIN_DIM) {
      warnings.push(
        `${p.name} solves to ${pyFixed(p.w, 1)}' x ${pyFixed(p.h, 1)}' — below the ` +
          `${pyFloatStr(MIN_DIM)}' minimum dimension. Reduce the room count or ` +
          `increase total area.`
      );
    }
  }

  // --- openings + FDWR
  for (const p of placed) {
    p.openings = placeOpenings(p, ix, iy, iw, ih, spineY + HALL_W / 2);
  }

  const wallArea = 2 * (envW + envH) * WALL_HEIGHT_FT;
  const glassOf = (): number => {
    // 4'-0" nominal window height, summed in placement order.
    const areas: number[] = [];
    for (const p of placed) {
      for (const o of p.openings) if (o.kind === "window") areas.push(o.width * 4.0);
    }
    return pySum(areas);
  };
  let fdwr = wallArea ? glassOf() / wallArea : 0.0;

  if (fdwr > FDWR_MAX) {
    // Trim windows until the plan passes the prescriptive path rather than
    // drawing glass the code will not permit.
    warnings.push(
      `Glazing solved to ${pyPercent(fdwr, 1)} FDWR, above the ` +
        `${pyPercent(FDWR_MAX, 0)} NBC 9.36 prescriptive ceiling — windows ` +
        `trimmed. A performance-path model can buy the glass back.`
    );
    for (const p of placed) {
      const wins = p.openings.filter((o) => o.kind === "window");
      // Every room keeps at least one window; the rest are trimmed pro rata.
      const keep = Math.max(1, Math.trunc((wins.length * FDWR_MAX) / fdwr));
      const drop = new Set<Opening>(wins.slice(keep));
      p.openings = p.openings.filter((o) => !drop.has(o));
    }
    fdwr = wallArea ? glassOf() / wallArea : 0.0;
  }

  const gross = envW * envH;
  const net = pySum(placed.map((p) => p.w * p.h));

  if (Math.abs(gross - req.total_sq_ft) / req.total_sq_ft > 0.08) {
    warnings.push(
      `Envelope ${pyFixed(gross, 0)} sq ft differs from the requested ` +
        `${req.total_sq_ft} by more than 8% after rounding to buildable dimensions.`
    );
  }

  return {
    width: envW,
    height: envH,
    wall_mm,
    partition_mm: PARTITION_MM,
    rooms: placed,
    gross_sq_ft: pyRound(gross, 1),
    net_sq_ft: pyRound(net, 1),
    fdwr: pyRound(fdwr, 4),
    warnings,
  };
}

// --------------------------------------------------------------------------
// the offline planner — used when no LLM is available
// --------------------------------------------------------------------------

/**
 * A sane room program derived arithmetically from the questionnaire.
 *
 * This exists so the design step NEVER hard-fails. An offline plan is a real
 * plan — it just did not get the LLM's judgement about proportion and naming.
 * In the browser build this is the *only* path, and the page says so rather
 * than pretending otherwise.
 */
export function defaultProgram(req: DesignRequest): LayoutPlan {
  const a = req.total_sq_ft;
  const rooms: RoomSpec[] = [];

  const add = (name: string, share: number, windows: number, wet = false): void => {
    const area = a * share;
    // 1.3 : 1 rooms — the program is a suggestion, but a suggestion shaped like
    // a room rather than a corridor.
    const side = Math.sqrt(area / 1.3);
    rooms.push({
      name,
      width: pyRound(side * 1.3, 1),
      length: pyRound(side, 1),
      windows,
      exterior: true,
      wet,
    });
  };

  // Shares tuned so a 400 sqft cabin and a 1,600 sqft house both read right.
  add("Great room", req.bedrooms ? 0.34 : 0.55, 3);
  add("Kitchen", 0.14, 2, true);

  const fullBaths = Math.trunc(req.bathrooms);
  const half = req.bathrooms - fullBaths >= 0.5;
  for (let i = 0; i < Math.max(1, fullBaths); i++) {
    add(fullBaths > 1 ? `Bath ${i + 1}` : "Bath", 0.09, 1, true);
  }

  // Below this, a powder room and a separate mechanical room stop being rooms
  // and become closets — the packer would solve them to 3-4 feet and warn.
  // Small off-grid plans put the gear in a utility wall off the bath, which is
  // what actually gets built.
  const SMALL_PLAN_SQ_FT = 900;
  const roomy = req.total_sq_ft >= SMALL_PLAN_SQ_FT;

  if (half && roomy) add("Powder", 0.05, 0, true);
  for (let i = 0; i < req.bedrooms; i++) {
    const share = i === 0 ? 0.17 : 0.13;
    add(req.bedrooms > 1 ? `Bedroom ${i + 1}` : "Bedroom", share, 2);
  }
  // Off-grid is the Aura default, so the mechanical room is the default too.
  if ((req.off_grid ?? true) && roomy) add("Mechanical", 0.07, 0, true);

  return {
    house_style: req.style ?? "off_grid_cabin",
    total_sq_ft: req.total_sq_ft,
    rooms,
  };
}
