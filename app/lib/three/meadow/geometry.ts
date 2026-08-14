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
 * The deck MESH is built in components/story/Scene.tsx, which still carries
 * these numbers as its own literals; it is outside this change's write set.
 * Wiring it here is the remaining half of the fix.
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
 * Grass thins toward it rather than stopping at it. Mirrors PATH_STONES in
 * components/story/Scene.tsx, which still lays the slabs from its own copy.
 */
export const PATH: readonly (readonly [number, number])[] = [
  [-2.4, 33], [-2.1, 31.2], [-1.6, 29.2], [-0.6, 27.4], [0.3, 25.6], [0.9, 23.8],
  [0.6, 21.8], [-0.4, 19.6], [-1.4, 17.2], [-2, 14.8], [-1.9, 12.4], [-1.3, 10.4],
  [-0.5, 8.9], [0.1, 7.7],
];
