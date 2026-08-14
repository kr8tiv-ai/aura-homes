/**
 * ONE description of the built world's footprint on the ground plane.
 *
 * The deck, the glass walkway and the entrance steps are drawn as meshes AND
 * cut out of the meadow by a clearance mask. Those two jobs used to carry
 * their own copies of the same numbers — five copies across the runtime mask
 * (lib/three/meadow/field.ts), the scene mask (components/story/SceneDetail.tsx),
 * the offline atlas generator (scripts/generate-meadow-atlas.mjs), the step
 * meshes, and the placement test. Twice the copies drifted and grass shipped
 * standing through solid geometry: once through the deck, once through the
 * lower treads of the entrance steps. A grep tripwire pinned the deck rect
 * against a third drift; this module replaces that tripwire with structure.
 *
 * RULES FOR THIS FILE
 * - Plain numbers only. No three.js, no React, no runtime dependency of any
 *   kind: scripts/generate-meadow-atlas.mjs imports it directly from Node
 *   (type-stripped), so anything unerasable or importable-only-by-a-bundler
 *   breaks the offline build.
 * - Footprints live here. PADS and FEATHERS do not — each consumer feathers
 *   its own way (tall hero blades keep a wide berth, 8-18 cm filler hugs the
 *   boxes), and folding those into the shared rect is what produced the
 *   "tight" variant that dropped the deck and left three treads exposed.
 * - Moving a number here moves the mesh and the mask together. That is the
 *   entire point; if a change is meant to move only one of them, it does not
 *   belong in this file.
 */

/** Axis-aligned ground rectangle, x0 <= x1 and z0 <= z1. */
export type GroundRect = {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
};

/** A ground run from a -> b, thickened by its own half-width. */
export type GroundSegment = {
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly halfWidth: number;
};

/** A ground point features are measured from. */
export type GroundPoint = { readonly x: number; readonly z: number };

/** The home's slab footprint. */
export const HOUSE_RECT: GroundRect = { x0: -4.3, z0: -3.4, x1: 4.3, z1: 3.4 };

/**
 * The deck, including its balustrade line and the glass bay on the east side.
 * `surfaceY` is the walking surface: the plank centres sit at 0.44 and the
 * planks are 0.09 thick, so the top face is 0.485 — the height every rail,
 * newel and step nosing lands on.
 *
 * This is the MASK rect. The deck MESH is described further down by
 * DECK_PLANKS / DECK_RAIL / DECK_GLASS_BAY and its true extent by
 * DECK_MESH_FOOTPRINT, which this rect contains with a little air around it.
 */
export const DECK_RECT: GroundRect & { readonly surfaceY: number } = {
  x0: -3.9,
  z0: 2.95,
  x1: 3.6,
  z1: 6.3,
  surfaceY: 0.485,
};

/** The glass walkway running east off the deck to the tub pad. */
export const WALKWAY_SEGMENT: GroundSegment = {
  ax: 3.45,
  az: 4.65,
  bx: 5.9,
  bz: 5.35,
  halfWidth: 0.85,
};

/**
 * The entrance flight. Two rects, because the two consumers are honestly
 * different: anything TALL (hero blades, the 1.4 m atlas cards) has to clear
 * the whole flight including the glass cheeks and the apron at its foot, while
 * the 8-18 cm filler may grow right up to the boxes.
 *
 * WIDE is the one that matters for the atlas. The tight rect stops at z 7.3
 * and once served every consumer, which left the three lower treads
 * unprotected — precisely where the cards stood through the stairs.
 */
export const STEPS_RECT_WIDE: GroundRect = { x0: -1.45, z0: 6.3, x1: 1.55, z1: 8.7 };
export const STEPS_RECT_TIGHT: GroundRect = { x0: -1.1, z0: 6.15, x1: 1.2, z1: 7.3 };

/**
 * The tread run itself. The mesh group sits at (originX, originZ) and the
 * i-th tread (1-based) is centred at z = originZ + i * treadDepth.
 */
export const STEPS_TREADS = {
  originX: 0.05,
  originZ: 6.55,
  treadDepth: 0.36,
  count: 5,
  width: 2.3,
} as const;

/**
 * Ground rectangle the treads actually occupy — derived, never retyped, so a
 * change to the flight cannot leave the clearance rects behind.
 */
export const STEPS_TREAD_FOOTPRINT: GroundRect = {
  x0: STEPS_TREADS.originX - STEPS_TREADS.width / 2,
  z0: STEPS_TREADS.originZ + STEPS_TREADS.treadDepth / 2,
  x1: STEPS_TREADS.originX + STEPS_TREADS.width / 2,
  z1: STEPS_TREADS.originZ + STEPS_TREADS.count * STEPS_TREADS.treadDepth + STEPS_TREADS.treadDepth / 2,
};

/** Hot tub pad, east of the deck at the end of the walkway. */
export const TUB_CENTER: GroundPoint = { x: 5.9, z: 5.4 };

/** Fire-pit lounge, west of the home. */
export const FIREPIT_CENTER: GroundPoint = { x: -4.7, z: 6.5 };

/** The single bench out in the east meadow. */
export const BENCH_CENTER: GroundPoint = { x: 8.6, z: 18 };

/**
 * The walked stepping-stone route, trailhead (z 33) down to the entrance.
 * Grass thins toward it rather than stopping at it. components/story/Scene.tsx
 * lays its stepping stones on these same points — PATH_STONES is this array,
 * not a second copy of it.
 */
export const PATH: readonly (readonly [number, number])[] = [
  [-2.4, 33], [-2.1, 31.2], [-1.6, 29.2], [-0.6, 27.4], [0.3, 25.6], [0.9, 23.8],
  [0.6, 21.8], [-0.4, 19.6], [-1.4, 17.2], [-2, 14.8], [-1.9, 12.4], [-1.3, 10.4],
  [-0.5, 8.9], [0.1, 7.7],
];

/* ======================================================================
 * THE MESHES
 *
 * Everything above says where the meadow may NOT grow. Everything below
 * says what is actually BUILT there. FD1 moved the mask half of that pair
 * into this file and left the mesh half behind in Scene.tsx — which is the
 * state that reads as fixed and is not, because the two halves can still
 * drift apart exactly the way they did when grass shipped through the deck
 * and, later, through the lower treads.
 *
 * A mask rect is NOT its mesh's outline and was never meant to be: it is an
 * envelope with a little air around the built edge, so a blade whose root is
 * legal cannot lean through a rail. The relationship that has to hold is
 * CONTAINMENT — every mesh footprint sits inside the rect that masks it —
 * and it is derived and asserted below rather than eyeballed.
 *
 * Values here are the SHIPPED values, byte for byte. Where a number could
 * have been written as an expression but the expression lands a few
 * hundred attometres away in binary floating point, the literal is kept and
 * the relationship is asserted in the spec instead. Nothing in this section
 * moved a mesh.
 * ==================================================================== */

/**
 * The A-frame shell. `halfWidth` is the eave drip line, `halfDepth` the gable
 * face; the slab is the piece that actually touches the ground.
 *
 * KNOWN OVERHANG, reported not silently corrected: the roof panes are 6.9 m
 * deep (z +/-3.45) against HOUSE_RECT's z +/-3.4, so 5 cm of eave reaches past
 * the mask. It is airborne at eaveY 0.35 rather than sitting on the ground,
 * and it is the roof — not the slab — so HOUSE_SHELL_FOOTPRINT is taken from
 * the slab, which is what a ground mask is about.
 */
export const HOUSE_SHELL = {
  halfWidth: 3.6,
  halfDepth: 3,
  ridgeY: 4.8,
  eaveY: 0.35,
  roofDepth: 6.9,
  slab: { width: 7.5, depth: 6.4, thickness: 0.32, y: 0.22 },
} as const;

/** Ground the home stands on — the slab, derived so it cannot be retyped. */
export const HOUSE_SHELL_FOOTPRINT: GroundRect = {
  x0: -HOUSE_SHELL.slab.width / 2,
  z0: -HOUSE_SHELL.slab.depth / 2,
  x1: HOUSE_SHELL.slab.width / 2,
  z1: HOUSE_SHELL.slab.depth / 2,
};

/**
 * The deck field. Seven rows: at six the deck stopped at z 5.815 while the
 * front balustrade sat at 6.05, so the rails floated and a band of meadow
 * showed through the entry.
 *
 * `y` is DERIVED from DECK_RECT.surfaceY, not written again: the walking
 * surface is the anchor every rail, newel and step nosing lands on, and
 * 0.485 - 0.09/2 is exactly 0.44 in binary floating point (checked), so the
 * derivation reproduces the shipped plank height bit for bit.
 */
export const DECK_PLANKS = {
  rows: 7,
  /** centre of the first row; every later row is `pitch` further out */
  firstZ: 3.25,
  pitch: 0.47,
  depth: 0.43,
  thickness: 0.09,
  centerX: -1.15,
  width: 4.9,
  y: DECK_RECT.surfaceY - 0.09 / 2,
} as const;

/**
 * The balustrade lines. `eastX` is WALKWAY_SEGMENT.ax, because the line the
 * walkway leaves from and the line the east rail stands on are one line —
 * they were two literals that happened to agree.
 *
 * `gapX0`/`gapX1` are the opening the entrance flight leaves in the front run;
 * `walkGapZ0`/`walkGapZ1` the 1 m opening in the east run where the walkway
 * to the tub leaves. `postHalf` is half a newel section, which is what the
 * rail line has to be grown by to get a real outline.
 */
export const DECK_RAIL = {
  westX: -3.6,
  eastX: WALKWAY_SEGMENT.ax,
  backZ: 3.15,
  frontZ: 6.24,
  gapX0: -1.09,
  gapX1: 1.19,
  walkGapZ0: 4.15,
  walkGapZ1: 5.15,
  height: 0.98,
  postHalf: 0.045,
} as const;

/** The glass-floored bay on the east side, feeding the walkway. */
export const DECK_GLASS_BAY = {
  centerX: 2.4,
  centerZ: 4.73,
  width: 2.1,
  depth: 3.11,
  thickness: 0.08,
  /** the steel tray under the glass, dropped clear of it */
  frameY: 0.345,
  frameWidth: 2.2,
  frameDepth: 3.21,
  frameThickness: 0.05,
} as const;

/**
 * The deck's own three-tread step-down to the meadow, with its raked stringers
 * and the flanking step rails.
 *
 * DIVERGENCE, REPORTED NOT MOVED. This flight and STEPS_TREADS describe the
 * same entrance and disagree: three 0.34 m treads 2.1 m wide from z 6.35
 * (here, drawn by Scene.tsx) against five 0.36 m treads 2.3 m wide from
 * z 6.55 (STEPS_TREADS, drawn by SceneDetail.tsx). Both render, at the same
 * time, in the same place. Reconciling them moves visible geometry and is a
 * scene decision, not a de-duplication; what this file can do is stop either
 * set of numbers existing in more than one place, which is what it now does.
 * The two flights are masked by DECK_RECT and STEPS_RECT_WIDE respectively,
 * and the spec asserts both are covered.
 */
export const DECK_STEPS = {
  originX: STEPS_TREADS.originX,
  count: 3,
  width: 2.1,
  treadDepth: 0.34,
  thickness: 0.1,
  /** centre of the top tread, and the drop to each one below it */
  firstZ: 6.35,
  topY: 0.34,
  rise: 0.13,
  /** where the flanking rails and the flight itself come to ground */
  footZ: 7.22,
  footY: 0.13,
  /** raked boards closing the open flanks of the flight */
  stringerX: [-1.03, 1.13],
  stringerGroupZ: 6.73,
  stringerGroupY: 0.3075,
  stringerDrop: 0.17,
  stringerWidth: 0.06,
  stringerHeight: 0.34,
  stringerLength: 1.13,
  rakeRise: 0.355,
  rakeRun: 0.98,
} as const;

/** The rake the stringers sit at, shared by the module and the mesh. */
export const DECK_STEPS_RAKE = Math.atan2(DECK_STEPS.rakeRise, DECK_STEPS.rakeRun);

/**
 * The mesh footprint of the deck's walking level: planks, balustrade and the
 * glass bay. DECK_RECT contains this.
 *
 * The tray under the glass bay is deliberately NOT in here, because it is the
 * one deck piece that does not fit — see DECK_BAY_FRAME_OVERHANG.
 */
export const DECK_MESH_FOOTPRINT: GroundRect = {
  x0: Math.min(
    DECK_PLANKS.centerX - DECK_PLANKS.width / 2,
    DECK_RAIL.westX - DECK_RAIL.postHalf,
  ),
  z0: Math.min(
    DECK_PLANKS.firstZ - DECK_PLANKS.depth / 2,
    DECK_RAIL.backZ - DECK_RAIL.postHalf,
    DECK_GLASS_BAY.centerZ - DECK_GLASS_BAY.depth / 2,
  ),
  x1: Math.max(
    DECK_PLANKS.centerX + DECK_PLANKS.width / 2,
    DECK_RAIL.eastX + DECK_RAIL.postHalf,
    DECK_GLASS_BAY.centerX + DECK_GLASS_BAY.width / 2,
  ),
  z1: Math.max(
    DECK_PLANKS.firstZ + (DECK_PLANKS.rows - 1) * DECK_PLANKS.pitch + DECK_PLANKS.depth / 2,
    DECK_RAIL.frontZ + DECK_RAIL.postHalf,
    DECK_GLASS_BAY.centerZ + DECK_GLASS_BAY.depth / 2,
  ),
};

/**
 * How far the tray under the glass bay reaches past DECK_RECT, in metres.
 *
 * FOUND BY THIS CHANGE, NOT INTRODUCED BY IT, AND NOT CURRENTLY A BUG. The
 * bay glass ends at 6.285 — the same line as the seventh plank row, which is
 * correct — but the tray beneath it is 3.21 m deep against the glass's 3.11
 * and shares its centre, so it ends at 6.335 while DECK_RECT stops at 6.3.
 *
 * Sampling the real mask at that far edge returns 0: the deck's clearance
 * fades in over 0.28 m OUTSIDE the rect, so 35 mm of overhang is still fully
 * cleared ground. The mesh was not moved. The number is exported so the
 * overhang is measured rather than assumed, and the spec asserts the property
 * that actually matters — that no grass grows under the tray — against the
 * mask itself rather than against this arithmetic.
 */
export const DECK_BAY_FRAME_OVERHANG =
  DECK_GLASS_BAY.centerZ + DECK_GLASS_BAY.frameDepth / 2 - DECK_RECT.z1;

/**
 * The deck flight's ground extent. The far pieces at both ends are the raked
 * stringers, so the z range is solved with the same trig the mesh group uses
 * rather than being read off the treads.
 *
 * This rect straddles the DECK_RECT / STEPS_RECT_WIDE boundary at z 6.3: its
 * upper part is masked by the deck, its lower part by the wide steps rect.
 */
export const DECK_STEPS_FOOTPRINT: GroundRect = (() => {
  const stringerCenterZ =
    DECK_STEPS.stringerGroupZ - DECK_STEPS.stringerDrop * Math.sin(DECK_STEPS_RAKE);
  const stringerHalfZ =
    (DECK_STEPS.stringerHeight / 2) * Math.sin(DECK_STEPS_RAKE) +
    (DECK_STEPS.stringerLength / 2) * Math.cos(DECK_STEPS_RAKE);
  return {
    x0: DECK_RAIL.gapX0 - DECK_RAIL.postHalf,
    z0: Math.min(stringerCenterZ - stringerHalfZ, DECK_STEPS.firstZ - DECK_STEPS.treadDepth / 2),
    x1: DECK_RAIL.gapX1 + DECK_RAIL.postHalf,
    z1: Math.max(stringerCenterZ + stringerHalfZ, DECK_STEPS.footZ + DECK_RAIL.postHalf),
  };
})();

/**
 * The rest of the entrance flight SceneDetail.tsx builds around STEPS_TREADS:
 * the riser boards, the steel stringers and the glass cheeks.
 *
 * The cheeks matter more than they look. They are the WIDEST part of the
 * flight — 1.24 m either side of the centre line against the treads' 1.15 —
 * so a containment check written against STEPS_TREAD_FOOTPRINT alone is
 * checking the wrong rectangle by 9 cm. ENTRANCE_FLIGHT_FOOTPRINT below is
 * the one to assert against.
 */
export const ENTRANCE_FLIGHT = {
  /** the nosing the top tread hangs from, and the drop to each tread below */
  topY: 0.42,
  rise: 0.082,
  riserWidth: 2.2,
  riserThickness: 0.08,
  riserDepth: 0.3,
  riserDrop: 0.09,
  /** both flanking runs are centred here, in the flight's own coordinates */
  flankZ: 0.94,
  flankLength: 2,
  rake: -0.22,
  stringerX: [-1.16, 1.16],
  stringerY: 0.19,
  stringerWidth: 0.08,
  stringerHeight: 0.16,
  cheekX: [-1.22, 1.22],
  cheekY: 0.42,
  cheekThickness: 0.04,
  cheekHeight: 0.5,
} as const;

/**
 * The whole flight on the ground, cheeks included, in world coordinates.
 * The flanking runs are raked, so their z reach is solved with the same trig
 * the mesh rotation applies rather than read off the tread run.
 */
export const ENTRANCE_FLIGHT_FOOTPRINT: GroundRect = (() => {
  const rake = Math.abs(ENTRANCE_FLIGHT.rake);
  const flankHalfZ =
    (ENTRANCE_FLIGHT.flankLength / 2) * Math.cos(rake) +
    (ENTRANCE_FLIGHT.cheekHeight / 2) * Math.sin(rake);
  const halfWidth = ENTRANCE_FLIGHT.cheekX[1] + ENTRANCE_FLIGHT.cheekThickness / 2;
  return {
    x0: STEPS_TREADS.originX - halfWidth,
    z0: Math.min(
      STEPS_TREADS.originZ + ENTRANCE_FLIGHT.flankZ - flankHalfZ,
      STEPS_TREAD_FOOTPRINT.z0,
    ),
    x1: STEPS_TREADS.originX + halfWidth,
    z1: Math.max(
      STEPS_TREADS.originZ + ENTRANCE_FLIGHT.flankZ + flankHalfZ,
      STEPS_TREAD_FOOTPRINT.z1,
    ),
  };
})();

/**
 * The glass walkway MESH. It starts on the deck's east rail line — the same
 * point WALKWAY_SEGMENT starts from — and stops 0.96 m short of the tub
 * centre, because the barrel is 0.78 m across and v1 ran the deck straight
 * through it. The mask segment deliberately runs the whole way to the tub;
 * the mesh deliberately does not, so the two ends differ by design.
 *
 * `halfWidth` 0.5 against the mask's 0.85 is the same story: the mask is the
 * envelope, the mesh is the deck.
 */
export const WALKWAY_MESH = {
  fromX: WALKWAY_SEGMENT.ax,
  fromZ: WALKWAY_SEGMENT.az,
  toX: 4.85,
  toZ: 5.06,
  /** the run is over-length by this much so it dies into the deck and the pad */
  pad: 0.3,
  halfWidth: 0.5,
  glassY: 0.42,
  glassThickness: 0.07,
  frameWidth: 1.08,
  frameDrop: 0.085,
  frameThickness: 0.05,
  railBase: 0.45,
  railHeight: 0.62,
  piers: [
    [4, 4.77],
    [4.72, 4.98],
  ],
} as const;

/**
 * The fire pit MESH, and a divergence worth naming.
 *
 * FIREPIT_CENTER — the point the mask clears a 1.3 m disc around, and one of
 * the numbers the offline atlas is built from — is (-4.7, 6.5). The hearth is
 * built at (-4.6, 6.2): 0.32 m away. The stone ring is 0.85 m in radius, so
 * its far side sits 1.17 m from the mask centre and stays inside the cleared
 * disc — the divergence is real but currently harmless, which is exactly how
 * the deck one looked before it wasn't. Moving the hearth is a visible scene
 * change and moving FIREPIT_CENTER changes the baked atlas, so neither was
 * done; the number now exists once and the clearance is asserted in the spec.
 */
export const FIREPIT_HEARTH = {
  x: -4.6,
  z: 6.2,
  ringRadius: 0.85,
  ringStones: 9,
  lightY: 1,
} as const;

/** True when `inner` lies entirely inside `outer`. */
export const rectContains = (outer: GroundRect, inner: GroundRect): boolean =>
  outer.x0 <= inner.x0 && outer.z0 <= inner.z0 && outer.x1 >= inner.x1 && outer.z1 >= inner.z1;

/**
 * Every mesh footprint paired with the mask rect that has to cover it. The
 * spec walks this list, so adding a built thing without a mask — or growing
 * one past its mask — fails a test instead of shipping grass through it.
 *
 * The deck flight is absent because it straddles two rects; the spec asserts
 * its coverage explicitly.
 */
export const MASKED_FOOTPRINTS: readonly {
  readonly name: string;
  readonly mask: GroundRect;
  readonly mesh: GroundRect;
}[] = [
  { name: "house shell", mask: HOUSE_RECT, mesh: HOUSE_SHELL_FOOTPRINT },
  { name: "deck", mask: DECK_RECT, mesh: DECK_MESH_FOOTPRINT },
  { name: "entrance treads", mask: STEPS_RECT_WIDE, mesh: STEPS_TREAD_FOOTPRINT },
  { name: "entrance flight incl. cheeks", mask: STEPS_RECT_WIDE, mesh: ENTRANCE_FLIGHT_FOOTPRINT },
];
