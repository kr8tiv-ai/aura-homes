/* ===========================================================================
   THE AXONOMETRIC — hidden-line removal, and the one drawing in the set that
   cannot be derived analytically.

   WHY THIS FILE EXISTS AT ALL.

   Everything else in `lib/builder/drawings/` is drawn from arithmetic. The
   floor plan knows a wall is 34 feet long because `spec.ts` says so; the
   elevation knows a window sill is 3 feet up for the same reason. Those sheets
   carry TRUE DIMENSIONS and they must keep being generated that way — an
   analytic drawing cannot be wrong by a pixel, and it can be annotated,
   because the generator knows what every line MEANS.

   A three-quarter view is the exception. There is no closed form for "which
   lines of this house can you see from over there". The answer depends on
   every solid in the model at once: the deck rail crosses in front of the
   south wall, the roof overhang eats the top of the east window, the far pile
   disappears behind the near one. That is an OCCLUSION question, and occlusion
   is computed, not derived.

   So this module does the one thing the analytic pipeline structurally cannot,
   and deliberately does not pretend to do the things it already does well:
   there are NO dimensions on this sheet, and it says so on its face. It is the
   drawing that makes a set look considered, and it is honest about being a
   picture of the massing rather than a measured drawing.

   ---------------------------------------------------------------------------
   THE PIPELINE, and why each stage is there

     1. WELD          Every part in `geometry.ts` arrives as an independent
                      BufferGeometry with per-face duplicated vertices (that
                      duplication is what gives a box its hard normals). Edge
                      topology is meaningless until coincident vertices are
                      welded, so the first thing that happens is a quantized
                      weld into one shared vertex pool, with each volume's
                      yaw + origin applied on the way in. One pass, one frame.

     2. PROJECT       A parallel projection along a view axis given as a
                      compass bearing and an elevation above the horizon.
                      Parallel, not perspective — that is what makes it an
                      axonometric rather than a render, and it is the property
                      the whole hidden-line pass leans on (see stage 4).

     3. EXTRACT       Candidate edges, by the three tests that between them
                      cover every line a draughtsman would draw:
                        · BOUNDARY   — an edge used by exactly one triangle:
                                       the rim of an open shell.
                        · CREASE     — adjacent faces further apart than the
                                       crease threshold: every arris of a box,
                                       every roof hip, every window reveal.
                                       This is also what deletes the triangle
                                       soup: the diagonal of a triangulated
                                       quad has coplanar neighbours, angle 0,
                                       and is dropped before it is ever drawn.
                        · SILHOUETTE — adjacent faces that disagree about
                                       whether they face the eye. This is the
                                       test that gives a 16-sided screw pile
                                       two clean outlines instead of sixteen
                                       facet lines, and it is view-dependent,
                                       which is why it is recomputed per view.

     4. BIN           A uniform 2D grid over the PROJECTED triangles. See the
                      dependency note below: under a parallel projection every
                      sight line is the same direction, so "what is in front of
                      this point" collapses from a 3D ray query to a 2D point
                      location plus a depth compare. The right index for that
                      is a flat grid, not a tree.

     5. SPLIT + HIDE  Visibility along a projected edge can only change where
                      that edge crosses the projected OUTLINE of some triangle.
                      So each edge is cut at exactly those crossings, and each
                      resulting interval is classified once, at its midpoint,
                      by a point-in-triangle plus depth test. No sampling, no
                      marching, no stippling: the cut points are the exact
                      places the answer can flip.

     6. MERGE         HLR leaves the drawing in pieces — an edge cut at eleven
                      crossings that turn out to be visible for all eleven, two
                      different solids whose arrises land on the same line on
                      paper. Segments are grouped by the infinite line they lie
                      on and unioned in 1D, so touching and overlapping runs
                      collapse into single strokes. This is the difference
                      between line art and triangle soup, and it is also what
                      keeps the SVG small.

     7. RENDER        Theme-aware SVG. Silhouette heavy, arris medium, crease
                      fine, removed lines optionally dashed underneath.

   ---------------------------------------------------------------------------
   DEPENDENCIES: THREE WERE EVALUATED, NONE WERE ADDED

   `three-mesh-bvh` — MIT (Garrett Johnson). Already in `node_modules` at
   0.7.8 as a transitive dependency of `@react-three/drei` (drei's own
   package.json asks for `^0.7.8`); latest on npm is 0.9.14, MIT, peer
   `three >= 0.159.0`, unpacked 2,329,887 B. Its ESM build here measures
   192,180 B raw, 40,129 B gzipped as shipped; `surfaces.ts` measured the same
   build at 71,780 B minified / 22.6 KB gzip, which is the honest bundle number
   because Next minifies. Being in node_modules is not being in the bundle —
   nothing imports it today, so adopting it is real new weight on /build.

   NOT ADOPTED, and the reason is structural rather than "our models are
   small". A BVH accelerates arbitrary 3D ray queries by amortising tree
   traversal over a large triangle count. This pass issues NO 3D ray queries.
   The projection is PARALLEL, so every sight line has the identical direction;
   once the vertices are projected once, occlusion is "is this 2D point inside
   this 2D triangle, and is that triangle nearer" — 2D point location. A
   uniform bin grid answers that in O(1) with one array index, in about forty
   lines we own, and it is built once per view rather than once per mesh. The
   scale argument agrees with the structural one: `surfaces.ts` measured this
   exact model at 27 meshes / 1,820 triangles for the reference home and 232
   meshes / 11,176 triangles for a six-volume, 72-opening stress spec, and
   found three-mesh-bvh 1.8x and 13x SLOWER than three's plain raycaster on
   them, plus 10-13 ms of tree building. A tree per part, of a few hundred
   triangles each, pays traversal setup and still does the triangle test.

   `three-edge-projection` — MIT in gkjohnson's repository, latest tag v0.0.10
   dated 2026-06-11. NOT ADOPTED, and the first reason is that it cannot be
   installed: the npm name `three-edge-projection` holds exactly one version,
   0.0.3, published 2025-10-28T11:25:09Z and UNPUBLISHED 59 seconds later at
   2025-10-28T11:26:08Z. The packument carries no `dist-tags` and no
   `versions`, and `registry.npmjs.org/three-edge-projection/latest` returns
   404. Adopting it means a git dependency on an untagged-on-npm 0.0.x, and its
   own `peerDependencies` are `clipper2-js ^0.9.0` (npm's latest is 1.2.4, two
   majors ahead), `three ^0.155.0`, and `three-mesh-bvh ^0.6.0` — a range
   DISJOINT from the `^0.7.8` drei already resolves, so npm would install two
   copies of three-mesh-bvh. It also ships `files: ["src/*"]`, raw untranspiled
   ESM with no build.
   The second reason is that it solves a different problem. It projects along
   the Y axis onto a single plane to produce a flattened outline; it does not
   take an arbitrary three-quarter view and it does not classify edges by
   crease angle, which is the test that separates a drawing from a mesh.

   `clipper2-js` — Boost-1.0, npm 1.2.4, unpacked 1,865,294 B, depends on
   `tslib`. `docs/research/BUILDER-ENGINE.md` already flags that the JS port
   ships no LICENSE file, only the package.json field, and would have to be
   pinned and vendored with the Boost text copied in by hand. NOT NEEDED HERE,
   and this is worth stating precisely because the blueprint suggested it: a
   polygon boolean would be for unioning projected triangles into one seamless
   contour. This module never needs that union, because it gets the same
   contour a different and better way. Each solid's own silhouette comes from
   mesh topology in stage 3, and where two solids overlap, the piece of one
   silhouette that falls inside the other is REMOVED BY THE OCCLUSION PASS —
   which is the same boundary a union would have produced. Better, because the
   union would also have erased the junction lines where the roof meets the
   wall, and those are lines a draughtsman draws. Merging is then a 1D union
   along shared infinite lines (stage 6), which is exact, needs no robust
   predicates, and costs nothing.

   NET: zero new dependencies. The only import is a TYPE-ONLY import of three,
   which is erased at compile time, so this module has no runtime dependency at
   all and can be exercised outside a browser.

   ---------------------------------------------------------------------------
   MEASURED, on this repo's own models — the same scenes `surfaces.ts`
   benchmarks against — on node 24, MINIMUM of 25 runs after a warm-up:

     reference home (defaultSpec)      27 meshes / 1,820 tris   ~22 ms
       ... with the hidden lines drawn too                      ~25 ms
     six volumes, 72 openings         212 meshes / 9,000 tris  ~208 ms

   The MINIMUM and not the mean, and the reason is stated rather than hidden:
   these were taken on a machine sitting at 100% CPU with other work on it, and
   the mean swung between 27 and 70 ms run to run while the minimum held. The
   minimum is the run that got a clean slice; treat these as the right order of
   magnitude, not as a benchmark. What is NOT load-dependent, and is the number
   to re-check, is `stats.oversizedTriangles` — see the bin-grid section.

   Either way this is a drawing generated on demand, not a frame.
   `AxonSheet.tsx` runs it through `useDeferredValue` so a slider drag never
   waits on it.

   ---------------------------------------------------------------------------
   NAMED LIMITATIONS, because a silent one is a bug waiting to be discovered.

   1. COINCIDENT AND TANGENT SURFACES ARE DRAWN AS THE MODEL BUILT THEM. Where
      two surfaces touch exactly, "in front" is undefined, and no depth bias
      can decide it. Two cases exist in this repo's own models and both are
      faithful rather than wrong:
        · the a-frame. `geometry.ts` puts the roof's top surface at exactly
          y = 0 where it passes the footprint edge, which is exactly where the
          floor slab's edge is, and the roof then continues below and outside
          as an overhang. The slab edge is therefore genuinely on the visible
          side, and it is drawn — as a line lying in the roof plane, which
          reads oddly and is correct.
        · interpenetrating volumes. Two volumes that overlap in plan produce
          short surviving fragments where one pokes through the other.
          `buildHome` already reports that overlap as a modelling mistake; this
          drawing shows it rather than hiding it.
      The reference home, an L-plan (main house plus annexe) and six spaced
      volumes all come out clean.

   2. A SEAM BETWEEN TWO ABUTTING SOLIDS IS DRAWN. This model is an assembly of
      separate solids — a sill IS a different object from the wall it sits on —
      and the line where two of them meet is a line a draughtsman draws. The
      consequence to know about: a surface that has been arbitrarily subdivided
      into coplanar pieces will show its subdivision. Unioning the solids first
      would remove those lines, and would need the polygon/CSG dependency this
      module exists partly to avoid. Note that `mergeParts` from `geometry.ts`
      is NOT a workaround — concatenating buffers does not weld topology.

   3. NOT A MEASURED DRAWING, and the sheet says so. A true isometric is
      measurable along its three axes at a known ratio; a trimetric is not, and
      neither carries an annotation. The plan and the elevations are where
      dimensions come from.

   ---------------------------------------------------------------------------
   DETERMINISM. No `Math.random`, no `Date.now`, no clock, no network, no DOM.
   Every map is keyed by a QUANTIZED value and every ordering is either the
   input order or an explicit total-order comparator with an index tie-break,
   so the same model and the same view always produce byte-identical SVG on a
   given engine. The one honest caveat, shared with `geometry.ts`, is that
   `Math.sin`/`Math.cos`/`Math.atan` are not specified to the last ulp across
   JS engines; quantizing every hash key is what keeps a last-ulp difference
   from changing the drawing's TOPOLOGY rather than just its final decimal.

   THEME. Not one literal colour in a class name or a style. The pens resolve
   through the same three-step chain `lib/design/blueprint.ts` and
   `lib/builder/drawings/kit.ts` use, so this sheet inverts with the site's
   night mode and still reads as a drawing when downloaded on its own.

   CREDIT. Nothing here derives from any third-party source. The classification
   tests (boundary / crease / silhouette) are the textbook ones; the pipeline,
   the bin grid, the interval split and the 1D merge are written for this repo.
   =========================================================================== */

import type * as THREE from "three";
import type { HomeGeometry, Surface } from "@/lib/builder/geometry";

/* ===========================================================================
   1. THE VIEW
   ===========================================================================

   The site frame, unchanged from `geometry.ts`: +X east, +Z south (so north is
   -Z), +Y up, y = 0 at finished floor.

   A view is two numbers a person can picture:

     azimuthDeg   the compass bearing the VIEWER STANDS AT, clockwise from
                  north. 135 puts the eye to the south-east, which for the
                  default spec (front faces south) shows the glazing wall and
                  the east elevation together.
     elevationDeg how far above the horizon the eye sits. 0 is an elevation
                  drawing; 90 is a plan.

   Both are parameters, per the brief. The presets are the three angles worth
   naming.                                                                    */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface AxonView {
  /** compass bearing the viewer stands at, degrees clockwise from north */
  azimuthDeg: number;
  /** height of the eye above the horizon, degrees */
  elevationDeg: number;
}

/**
 * True isometric elevation: atan(1/root 2) = 35.264 degrees.
 *
 * At this angle and a 45-degree diagonal azimuth the three model axes
 * foreshorten by exactly the same factor (root(2/3) = 0.8165), which is the
 * whole definition of "isometric" and the reason it is the axonometric people
 * mean when they say axonometric.
 */
export const ISO_ELEVATION_DEG = Math.atan(Math.SQRT1_2) * DEG;

export const AXON_VIEWS = {
  /** equal foreshortening on all three axes — the classic 3/4 */
  iso: { azimuthDeg: 135, elevationDeg: ISO_ELEVATION_DEG },
  /** a flatter eye: less roof, more elevation, and the glazing reads better */
  dimetric: { azimuthDeg: 135, elevationDeg: 20 },
  /** off the diagonal, so the two visible elevations foreshorten differently
   *  and the drawing stops looking like a technical illustration */
  trimetric: { azimuthDeg: 115, elevationDeg: 25 },
} as const;

export type AxonPreset = keyof typeof AXON_VIEWS;

export const AXON_PRESET_IDS: readonly AxonPreset[] = ["iso", "dimetric", "trimetric"];

/** How a preset reads in a UI, and what it is actually for. */
export const AXON_PRESET_LABELS: Record<AxonPreset, { label: string; hint: string }> = {
  iso: { label: "Isometric", hint: "35.3° up, off the corner. All three axes foreshorten equally." },
  dimetric: { label: "Dimetric", hint: "20° up. Flatter — shows the walls and the glazing, less roof." },
  trimetric: { label: "Trimetric", hint: "25° up, off the diagonal. The least diagrammatic of the three." },
};

const resolveView = (v: AxonPreset | AxonView | undefined): AxonView => {
  if (v === undefined) return AXON_VIEWS.iso;
  if (typeof v === "string") return AXON_VIEWS[v] ?? AXON_VIEWS.iso;
  return v;
};

/** The orthonormal screen frame for a view. Deliberately a plain record: it is
 *  read in the hottest loop in the file and a class would buy nothing. */
interface Basis {
  /** unit vector from the model TOWARD the eye; also the depth axis */
  dx: number;
  dy: number;
  dz: number;
  /** screen right, always horizontal in the world */
  rx: number;
  ry: number;
  rz: number;
  /** screen up */
  ux: number;
  uy: number;
  uz: number;
}

function basisOf(view: AxonView): Basis {
  const e = view.elevationDeg * RAD;
  const b = view.azimuthDeg * RAD;
  const ce = Math.cos(e);
  const se = Math.sin(e);
  const cb = Math.cos(b);
  const sb = Math.sin(b);

  // Toward the eye. Bearing 0 is north, which is -Z; bearing 90 is east, +X.
  const dx = ce * sb;
  const dy = se;
  const dz = -ce * cb;

  // Screen right is the horizontal perpendicular: normalize(worldUp x d).
  // It stays unit for every elevation including straight down, because the
  // vertical component of d falls out of the cross product entirely.
  const rx = -cb;
  const ry = 0;
  const rz = -sb;

  // Screen up completes the right-handed frame: u = d x r, already unit.
  const ux = dy * rz - dz * ry;
  const uy = dz * rx - dx * rz;
  const uz = dx * ry - dy * rx;

  return { dx, dy, dz, rx, ry, rz, ux, uy, uz };
}

/** The 16-point name of a bearing, for the legend. A drawing that says which
 *  way you are looking is worth more than one that makes you work it out. */
function compassName(bearingDeg: number): string {
  const names = [
    "NORTH", "NORTH-NORTH-EAST", "NORTH-EAST", "EAST-NORTH-EAST",
    "EAST", "EAST-SOUTH-EAST", "SOUTH-EAST", "SOUTH-SOUTH-EAST",
    "SOUTH", "SOUTH-SOUTH-WEST", "SOUTH-WEST", "WEST-SOUTH-WEST",
    "WEST", "WEST-NORTH-WEST", "NORTH-WEST", "NORTH-NORTH-WEST",
  ];
  const i = ((Math.round(bearingDeg / 22.5) % 16) + 16) % 16;
  return names[i];
}

/* ===========================================================================
   2. INPUT, OPTIONS, RESULT
   =========================================================================== */

/**
 * One mesh to draw.
 *
 * Deliberately plain arrays rather than a three.js type, so the pipeline can
 * be tested, benchmarked and run outside a browser. `meshesFromHome` below is
 * the adapter from the builder's own `HomeGeometry`.
 *
 * The placement is the SAME rigid transform `geometry.ts` guarantees — one yaw
 * about +Y then a translation, never a general matrix — because that is the
 * only transform the builder's scene applies. Accepting an arbitrary matrix
 * here would invite a second place for a sign error to live.
 */
export interface AxonMesh {
  /** stable, and used only in warnings */
  id: string;
  /** flat xyz triples, in the mesh's local frame, in FEET */
  positions: ArrayLike<number>;
  /** triangle list; when absent the positions are read as sequential triples */
  index?: ArrayLike<number> | null;
  /** yaw about +Y, radians, applied first */
  rotationY?: number;
  /** world translation of the local origin, feet, applied second */
  origin?: readonly [number, number, number];
  /** free label. `meshesFromHome` sets the geometry `Surface`, and `exclude`
   *  and `transparent` match against it. */
  tag?: string;
}

export interface AxonOptions {
  /** a named preset or an explicit pair of angles */
  view?: AxonPreset | AxonView;

  /** target drawing width in points, the model scaled to fit. Ignored when
   *  `ptPerFt` is given. */
  widthPt?: number;
  /** force the scale instead of fitting. An axonometric is not a measured
   *  drawing, so this exists for pinning two views to the same scale, not for
   *  claiming a ratio. */
  ptPerFt?: number;
  /** white space around the art, in points */
  marginPt?: number;

  /** an edge is drawn when its adjacent faces differ by at least this many
   *  degrees. 25 keeps every arris of a box and every roof hip while dropping
   *  the 22.5-degree facets of a 16-sided pile, which the silhouette test then
   *  outlines properly. */
  creaseAngleDeg?: number;

  /** draw the removed lines dashed underneath, the way a study drawing shows
   *  what is behind. Off by default: it is a different drawing, not a better
   *  one, and on a busy model it doubles the ink. */
  showHidden?: boolean;

  /** surfaces left out of the drawing entirely, by `tag` */
  exclude?: readonly string[];
  /** surfaces that are DRAWN but hide nothing behind them, by `tag`. Passing
   *  `["glass"]` is how you get the architectural convention of seeing into
   *  the room through the glazing wall. Off by default, because opaque glass
   *  is the cleaner massing drawing. */
  transparent?: readonly string[];

  /** how far in front an occluder must be before it counts, in feet. Guards
   *  the flush and coincident faces `geometry.ts` deliberately produces — a
   *  window frame's outer face is exactly level with the wall's. */
  depthBiasFt?: number;

  /** refuse rather than hang. Above this the result comes back empty with a
   *  warning that says the number. */
  maxTriangles?: number;

  /** sheet lettering. Both are escaped: a project name can arrive from a share
   *  link, which is untrusted text. */
  title?: string;
  subtitle?: string;
  /** set false for bare line art with no caption, border or stamp — for
   *  dropping the drawing into another sheet's layout */
  caption?: boolean;
}

export type AxonEdgeKind = "silhouette" | "boundary" | "crease";

/** One finished stroke, in PAPER POINTS, y already flipped for SVG. */
export interface AxonSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: AxonEdgeKind;
  /** true when this run was removed by the occlusion pass */
  hidden: boolean;
}

export interface AxonStats {
  meshes: number;
  /** triangles after degenerate ones are dropped */
  triangles: number;
  degenerateTriangles: number;
  /** vertices after the quantized weld — the number topology is built on */
  weldedVertices: number;
  rawVertices: number;
  /** unique undirected edges found */
  edges: number;
  /** how many of those survived classification, by test */
  silhouette: number;
  boundary: number;
  crease: number;
  /** interval boundaries the split pass produced */
  splitPoints: number;
  /** runs out of the occlusion pass, before the 1D merge */
  runsBeforeMerge: number;
  /** strokes after the merge — the number that lands in the SVG */
  visibleSegments: number;
  hiddenSegments: number;
  /** triangles that can actually hide something: not transparent by option,
   *  and not edge-on to the eye (an edge-on face covers no paper) */
  occludingTriangles: number;
  /** the grid that took them */
  gridCells: number;
  oversizedTriangles: number;
}

export interface AxonResult {
  /** the finished drawing */
  svg: string;
  /** the strokes, for a caller that wants to draw them itself */
  segments: AxonSegment[];
  /** paper size in points */
  widthPt: number;
  heightPt: number;
  /** the scale actually used, points per foot */
  ptPerFt: number;
  view: AxonView;
  /** how the view reads in words, for a legend or an alt text */
  viewLabel: string;
  stats: AxonStats;
  /** everything the pass could not do faithfully, in plain sentences */
  warnings: string[];
}

/* --------------------------------------------------------------- defaults */

const DEF_WIDTH_PT = 900;
const DEF_MARGIN_PT = 28;
const DEF_CREASE_DEG = 25;
const DEF_BIAS_FT = 1e-3;
const DEF_MAX_TRIS = 400_000;

/** Weld resolution, in feet. 0.001 ft is 0.012 inch: finer than any feature
 *  `geometry.ts` can build (the thinnest is 0.08 ft of glass) and coarser than
 *  any float noise a single yaw can introduce. Vertices are keyed by the grid
 *  cell but keep the coordinates of whichever one arrived first, so nothing is
 *  moved by more than half a cell. */
const WELD_FT = 1e-3;
const WELD_INV = 1 / WELD_FT;

/** Two paper points closer than this are the same point. Everything downstream
 *  of the projection is in points, so tolerances are in the units the reader
 *  actually sees rather than in model feet. */
const PT_EPS = 1e-4;

/**
 * Barycentric slack for the inside test. NEGATIVE — the triangle is very
 * slightly GROWN, so a point exactly on its boundary counts as inside.
 *
 * This sign was arrived at the hard way and the reason is worth writing down,
 * because the other sign is the intuitive one and it is wrong.
 *
 * Shrinking looks safer: a segment running exactly along a triangle's edge is
 * then treated as outside it, so a shared arris is kept rather than
 * coin-flipped away. But a projected edge lands on a triangle BOUNDARY far
 * more often at a boundary that is not a real edge at all — the internal
 * diagonal where a quad was triangulated. In an isometric view of a box, the
 * three edges at the FAR corner project exactly onto the diagonals of the near
 * faces, so with a shrink the back of every box in the drawing was declared
 * visible. That is not a corner case; it is the commonest case there is.
 *
 * Growing is safe because the DEPTH BIAS already handles what the shrink was
 * protecting: when a triangle genuinely contains the edge (the front face an
 * arris belongs to), the interpolated depth EQUALS the edge's depth, the
 * difference is zero, and the bias rejects it. The shrink was doing a second
 * time, badly, a job the bias was already doing exactly.
 */
const INSIDE_TOL = -1e-9;

/** Hard cap on interval boundaries for one edge, so a pathological model
 *  degrades with a warning rather than locking the tab. */
const MAX_SPLITS_PER_EDGE = 4096;

/** Floor on how many cells one triangle may occupy before it is moved to the
 *  always-checked list. The real threshold is half the grid (see `buildGrid`);
 *  this stops a very coarse grid from declaring ordinary triangles oversized. */
const MAX_CELLS_PER_TRI = 96;

/* ===========================================================================
   3. THE ADAPTER — HomeGeometry in
   =========================================================================== */

/**
 * Every part of a built home as an `AxonMesh`, in the site frame.
 *
 * The volume's yaw and origin ride along on each mesh rather than being baked
 * here, so the weld pass applies exactly one transform per vertex.
 *
 * Parts whose position attribute is interleaved, or whose item size is not 3,
 * are SKIPPED AND NAMED rather than read with the wrong stride. `geometry.ts`
 * builds plain three-component attributes today; a future part that does not
 * should show up as a missing piece with a sentence, not as a smear of
 * garbage triangles across the drawing.
 */
export function meshesFromHome(home: HomeGeometry, warnings: string[] = []): AxonMesh[] {
  const out: AxonMesh[] = [];

  const take = (
    id: string,
    surface: Surface,
    geometry: THREE.BufferGeometry,
    origin: readonly [number, number, number],
    rotationY: number,
  ): void => {
    /* Read through a minimal structural shape rather than three's own types.
       `BufferAttribute.array` is three's `TypedArray` union, which includes
       BigInt64Array and therefore is not assignable to ArrayLike<number>; the
       two-step cast is the honest way to say "this is a plain float attribute
       and the next four lines prove it" rather than widening the import. */
    const pos = geometry.getAttribute("position") as unknown as
      | { array: ArrayLike<number>; itemSize: number; count: number; isInterleavedBufferAttribute?: boolean }
      | undefined;
    if (!pos) {
      warnings.push(`Part ${id} has no position attribute and was left out of the axonometric.`);
      return;
    }
    if (pos.isInterleavedBufferAttribute || pos.itemSize !== 3 || pos.array.length < pos.count * 3) {
      warnings.push(
        `Part ${id} stores its positions in a layout this drawing cannot read (itemSize ${pos.itemSize}${pos.isInterleavedBufferAttribute ? ", interleaved" : ""}); it was left out rather than read with the wrong stride.`,
      );
      return;
    }
    const idx = geometry.index as unknown as { array: ArrayLike<number> } | null | undefined;
    out.push({
      id,
      tag: surface,
      positions: pos.array,
      index: idx ? idx.array : null,
      origin,
      rotationY,
    });
  };

  for (const v of home.volumes) {
    for (const p of v.parts) take(p.id, p.surface, p.geometry, v.origin, v.rotationY);
  }
  if (home.deck) {
    for (const p of home.deck.parts) take(p.id, p.surface, p.geometry, home.deck.origin, home.deck.rotationY);
  }
  return out;
}

/* ===========================================================================
   4. THE DRAWING LANGUAGE — rounding and pens

   Rounding is lifted verbatim from `lib/builder/drawings/kit.ts`, which lifted
   it from `lib/design/blueprint.ts`, which is a port of this project's Python
   design service. Python rounds halves to EVEN. Copying eight lines keeps this
   module self-contained AND keeps a coordinate that lands on an exact half
   point lettering identically on this sheet and on A5 — a set that disagrees
   with itself over a rounding rule is a set somebody has to check twice.
   =========================================================================== */

function pyRound(v: number, digits = 0): number {
  const p = 10 ** digits;
  const scaled = v * p;
  let r = Math.round(scaled);
  if (Math.abs(scaled % 1) === 0.5 && r % 2 !== 0) r -= 1;
  return r / p;
}

const fx = (v: number, digits: number): string => pyRound(v, digits).toFixed(digits);
const num = (v: number): string => String(pyRound(v, 3));

const esc = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Thousands separators without `toLocaleString`. `kit.ts` refuses a locale
 *  for numbers on a sheet — "a sheet is a document and its numbers must not
 *  drift with the reader's ICU data" — and a warning a user reads and quotes
 *  back is a document too. */
const group = (v: number): string => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/* The same three-step pen chain as `blueprint.ts` and `drawings/kit.ts`:

     1. `--axon-*` — a per-instance override the host can set
     2. `--st-*`   — the site's document tokens, which already flip under
                     `:root[data-theme="dark"]`
     3. a terminal value — so a downloaded .svg opened on its own still reads

   PAPER is the only pen that must be opaque, because the border and the
   caption band sit on it. Everything else falls back to `currentColor`, which
   makes the drawing inherit whatever text colour it is dropped into.        */

const PENS = [
  "--aux-paper: var(--axon-paper, var(--st-paper, #ffffff))",
  "--aux-ink: var(--axon-ink, var(--st-ink, currentColor))",
  "--aux-dim: var(--axon-dim, var(--st-ink-dim, currentColor))",
  "--aux-hair: var(--axon-hair, var(--st-faint, currentColor))",
  "--aux-accent: var(--axon-accent, var(--st-emerald-deep, #047857))",
  // single quotes on purpose: this whole string lives inside a double-quoted
  // style="" attribute, and a stray double quote would end it early
  "font-family: var(--axon-font, 'Helvetica Neue', Helvetica, Arial, sans-serif)",
  "display: block",
  "max-width: 100%",
  "height: auto",
].join(";");

/* `var()` is not honoured inside SVG presentation attributes, so the pens are
   applied through classes. The prefix matters: an inline <style> is not scoped
   and these rules land in the host document. */
const SHEET_CSS = [
  ".aux-paper{fill:var(--aux-paper);stroke:none}",
  ".aux-cut{stroke:var(--aux-ink);fill:none;stroke-linecap:round;stroke-linejoin:round}",
  ".aux-ink{stroke:var(--aux-ink);fill:none;stroke-linecap:round}",
  ".aux-fine{stroke:var(--aux-dim);fill:none;stroke-linecap:round}",
  ".aux-hide{stroke:var(--aux-hair);fill:none;stroke-dasharray:4,3}",
  ".aux-hair{stroke:var(--aux-hair);fill:none}",
  ".aux-t-ink{fill:var(--aux-ink)}",
  ".aux-t-dim{fill:var(--aux-dim)}",
  ".aux-t-accent{fill:var(--aux-accent)}",
].join("");

/** Stroke weight per edge class. A drawing reads because the outline is
 *  heavier than the arris and the arris is heavier than the crease; three
 *  weights is what makes line art look drawn rather than traced. */
const WEIGHT: Record<AxonEdgeKind, number> = {
  silhouette: 1.35,
  boundary: 0.95,
  crease: 0.65,
};

const CLASS_OF: Record<AxonEdgeKind, string> = {
  silhouette: "aux-cut",
  boundary: "aux-ink",
  crease: "aux-fine",
};

/**
 * The stamp, mandatory on every drawing this project produces.
 *
 * The second line is the one that matters on THIS sheet specifically. An
 * axonometric looks like the most finished drawing in a set and carries the
 * least information in it: no dimensions, no annotation, no assemblies. Saying
 * so on the face of it is the difference between a drawing and a sales image.
 */
export const AXON_STAMP = [
  "NOT FOR CONSTRUCTION — REVIEW SET.",
  "Axonometric. Not a measured drawing: take every dimension from the plan and elevations.",
] as const;

/* ===========================================================================
   5. STAGE 1 + 2 — WELD, TRANSFORM, PROJECT

   One pass. Each mesh's vertices are rotated by its yaw, translated by its
   origin, welded into a shared pool by a quantized key, and projected into the
   screen frame. Nothing is stored twice and nothing is transformed twice.
   =========================================================================== */

interface Scene {
  /** welded world positions, kept for nothing but face normals */
  wx: Float64Array;
  wy: Float64Array;
  wz: Float64Array;
  /** projected screen position in FEET (converted to points later) and depth */
  px: Float64Array;
  py: Float64Array;
  pd: Float64Array;
  vertCount: number;

  ta: Int32Array;
  tb: Int32Array;
  tc: Int32Array;
  /** unit face normal */
  fnx: Float64Array;
  fny: Float64Array;
  fnz: Float64Array;
  /** +1 facing the eye, -1 facing away, 0 edge-on */
  facing: Int8Array;
  /** 1 when this triangle takes part in occlusion */
  occludes: Uint8Array;
  triCount: number;

  rawVertices: number;
  degenerate: number;
}

function buildScene(
  meshes: readonly AxonMesh[],
  basis: Basis,
  exclude: readonly string[],
  transparent: readonly string[],
  maxTriangles: number,
  warnings: string[],
): Scene | null {
  /* Deliberately grown as plain arrays and frozen into typed arrays at the
     end. The triangle count is not known up front (degenerates are dropped as
     they are found) and a wrong pre-allocation is worse than one copy. */
  const wx: number[] = [];
  const wy: number[] = [];
  const wz: number[] = [];
  const px: number[] = [];
  const py: number[] = [];
  const pd: number[] = [];

  const ta: number[] = [];
  const tb: number[] = [];
  const tc: number[] = [];
  const occl: number[] = [];

  /* A Map keyed by a QUANTIZED string. The tsconfig targets ES5, where
     iterating a Map needs downlevelIteration, so this map is only ever read
     and written by key — the parallel arrays above are the ordered truth, and
     that is also what makes the output order deterministic. */
  const weld = new Map<string, number>();

  let rawVertices = 0;
  let degenerate = 0;

  const vertexOf = (x: number, y: number, z: number): number => {
    // String(-0) is "0" in JS, so a coordinate that lands on zero from below
    // cannot produce a second key for the same point.
    const key = `${Math.round(x * WELD_INV)}|${Math.round(y * WELD_INV)}|${Math.round(z * WELD_INV)}`;
    const hit = weld.get(key);
    if (hit !== undefined) return hit;
    const id = wx.length;
    weld.set(key, id);
    wx.push(x);
    wy.push(y);
    wz.push(z);
    px.push(x * basis.rx + y * basis.ry + z * basis.rz);
    py.push(x * basis.ux + y * basis.uy + z * basis.uz);
    pd.push(x * basis.dx + y * basis.dy + z * basis.dz);
    return id;
  };

  for (const mesh of meshes) {
    const tag = mesh.tag ?? "";
    if (exclude.indexOf(tag) >= 0) continue;

    const pos = mesh.positions;
    const vcount = Math.floor(pos.length / 3);
    if (vcount < 3) continue;
    rawVertices += vcount;

    const yaw = mesh.rotationY ?? 0;
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const ox = mesh.origin ? mesh.origin[0] : 0;
    const oy = mesh.origin ? mesh.origin[1] : 0;
    const oz = mesh.origin ? mesh.origin[2] : 0;

    /* Local -> world for this mesh. Matches three's makeRotationY exactly:
       x' = c*x + s*z, z' = -s*x + c*z. One yaw, then the translation. */
    const local: number[] = new Array(vcount);
    for (let i = 0; i < vcount; i++) {
      const lx = pos[i * 3];
      const ly = pos[i * 3 + 1];
      const lz = pos[i * 3 + 2];
      local[i] = vertexOf(c * lx + s * lz + ox, ly + oy, -s * lx + c * lz + oz);
    }

    const occludes = transparent.indexOf(tag) >= 0 ? 0 : 1;
    const idx = mesh.index;
    const triples = idx ? Math.floor(idx.length / 3) : Math.floor(vcount / 3);

    for (let t = 0; t < triples; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      if (i0 >= vcount || i1 >= vcount || i2 >= vcount) {
        degenerate++;
        continue;
      }
      const a = local[i0];
      const b = local[i1];
      const cc = local[i2];
      // Welding is what collapses a zero-area triangle into two equal corners,
      // so this single test catches both "degenerate in the source" and
      // "degenerate after the weld".
      if (a === b || b === cc || a === cc) {
        degenerate++;
        continue;
      }
      ta.push(a);
      tb.push(b);
      tc.push(cc);
      occl.push(occludes);

      if (ta.length > maxTriangles) {
        warnings.push(
          `The model passes ${group(maxTriangles)} triangles, which is past this drawing's budget. No axonometric was generated. Raise maxTriangles if you mean it — the pass is roughly linear in triangles and in how much of the drawing each edge crosses.`,
        );
        return null;
      }
    }
  }

  const vertCount = wx.length;
  const triCount = ta.length;
  if (triCount === 0) return null;

  /* Face normals and front/back facing. Both are computed once here rather
     than in the edge loop, because every edge asks for its neighbours' normals
     and a face has three edges. */
  const fnx = new Float64Array(triCount);
  const fny = new Float64Array(triCount);
  const fnz = new Float64Array(triCount);
  const facing = new Int8Array(triCount);

  const taA = Int32Array.from(ta);
  const tbA = Int32Array.from(tb);
  const tcA = Int32Array.from(tc);

  let dropped = 0;
  const occludes = new Uint8Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const a = taA[t];
    const b = tbA[t];
    const cc = tcA[t];
    const e1x = wx[b] - wx[a];
    const e1y = wy[b] - wy[a];
    const e1z = wz[b] - wz[a];
    const e2x = wx[cc] - wx[a];
    const e2y = wy[cc] - wy[a];
    const e2z = wz[cc] - wz[a];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(len > 1e-12)) {
      // Collinear corners: no normal, so it can be neither a crease nor a
      // silhouette. Left in the list with a zero normal and no occlusion so
      // the triangle indices stay aligned; counted honestly.
      dropped++;
      occludes[t] = 0;
      facing[t] = 0;
      continue;
    }
    nx /= len;
    ny /= len;
    nz /= len;
    fnx[t] = nx;
    fny[t] = ny;
    fnz[t] = nz;
    const toward = nx * basis.dx + ny * basis.dy + nz * basis.dz;
    facing[t] = toward > 1e-9 ? 1 : toward < -1e-9 ? -1 : 0;
    occludes[t] = occl[t] ? 1 : 0;
  }

  return {
    wx: Float64Array.from(wx),
    wy: Float64Array.from(wy),
    wz: Float64Array.from(wz),
    px: Float64Array.from(px),
    py: Float64Array.from(py),
    pd: Float64Array.from(pd),
    vertCount,
    ta: taA,
    tb: tbA,
    tc: tcA,
    fnx,
    fny,
    fnz,
    facing,
    occludes,
    triCount,
    rawVertices,
    degenerate: degenerate + dropped,
  };
}

/* ===========================================================================
   6. STAGE 3 — CANDIDATE EDGES

   Every undirected edge of every triangle, keyed on the WELDED vertex pair, so
   an arris shared by two separate parts (a sill sitting on a wall) is found as
   one edge rather than two coincident ones. Up to four adjacent faces are kept
   per edge; beyond that the edge is kept unconditionally, which is the safe
   direction — a drawn line that could have been dropped costs a hairline, a
   dropped line that should have been drawn is a hole in the drawing.
   =========================================================================== */

interface EdgeSet {
  a: Int32Array;
  b: Int32Array;
  kind: Uint8Array; // 0 crease, 1 boundary, 2 silhouette
  count: number;
  /** every unique edge examined, drawn or not */
  examined: number;
  silhouette: number;
  boundary: number;
  crease: number;
}

const KIND_NAME: readonly AxonEdgeKind[] = ["crease", "boundary", "silhouette"];

function extractEdges(scene: Scene, creaseAngleDeg: number, warnings: string[]): EdgeSet {
  const { ta, tb, tc, triCount, vertCount, fnx, fny, fnz, facing } = scene;

  /* Numeric edge keys, which are ~3x faster than string keys and exact: a pair
     of indices below 2^20 packs into 2^40, far inside the 2^53 a double holds
     without loss. Past that the packing would alias, so it is checked rather
     than assumed. */
  const KEY_SHIFT = 1_048_576; // 2^20
  if (vertCount >= KEY_SHIFT) {
    warnings.push(
      `The model welds to ${group(vertCount)} vertices, past the ${group(KEY_SHIFT)} this drawing's edge index can address exactly. No axonometric was generated rather than one with silently merged edges.`,
    );
    return { a: new Int32Array(0), b: new Int32Array(0), kind: new Uint8Array(0), count: 0, examined: 0, silhouette: 0, boundary: 0, crease: 0 };
  }

  const map = new Map<number, number>();
  const ea: number[] = [];
  const eb: number[] = [];
  const nfaces: number[] = [];
  const overflow: boolean[] = [];
  // up to four adjacent face ids per edge, flat
  const adj: number[] = [];

  const add = (v0: number, v1: number, tri: number): void => {
    const lo = v0 < v1 ? v0 : v1;
    const hi = v0 < v1 ? v1 : v0;
    const key = lo * KEY_SHIFT + hi;
    let e = map.get(key);
    if (e === undefined) {
      e = ea.length;
      map.set(key, e);
      ea.push(lo);
      eb.push(hi);
      nfaces.push(0);
      overflow.push(false);
      adj.push(-1, -1, -1, -1);
    }
    const n = nfaces[e];
    if (n < 4) adj[e * 4 + n] = tri;
    else overflow[e] = true;
    nfaces[e] = n + 1;
  };

  for (let t = 0; t < triCount; t++) {
    const a = ta[t];
    const b = tb[t];
    const c = tc[t];
    add(a, b, t);
    add(b, c, t);
    add(c, a, t);
  }

  const examined = ea.length;
  const cosCrease = Math.cos(creaseAngleDeg * RAD);

  const outA: number[] = [];
  const outB: number[] = [];
  const outK: number[] = [];
  let nSil = 0;
  let nBnd = 0;
  let nCre = 0;

  for (let e = 0; e < examined; e++) {
    const n = nfaces[e];

    /* BOUNDARY. One face means the rim of an open shell. Kept unconditionally:
       there is nothing on the other side to compare an angle against. */
    if (n === 1) {
      outA.push(ea[e]);
      outB.push(eb[e]);
      outK.push(1);
      nBnd++;
      continue;
    }

    /* More neighbours than the four slots hold. Vanishingly rare — it needs
       three or more solids sharing one arris — and kept rather than guessed
       at, for the reason in this section's header. */
    if (overflow[e]) {
      outA.push(ea[e]);
      outB.push(eb[e]);
      outK.push(1);
      nBnd++;
      continue;
    }

    const k = n < 4 ? n : 4;
    let sawFront = false;
    let sawBack = false;
    let minDot = 1;
    for (let i = 0; i < k; i++) {
      const ti = adj[e * 4 + i];
      if (ti < 0) continue;
      if (facing[ti] > 0) sawFront = true;
      else if (facing[ti] < 0) sawBack = true;
      for (let j = i + 1; j < k; j++) {
        const tj = adj[e * 4 + j];
        if (tj < 0) continue;
        const d = fnx[ti] * fnx[tj] + fny[ti] * fny[tj] + fnz[ti] * fnz[tj];
        if (d < minDot) minDot = d;
      }
    }

    /* SILHOUETTE, but only on a MANIFOLD edge — exactly two faces.
       "The surface turns away from the eye here" is a statement about a
       surface, and an edge where four faces meet is not one surface; it is a
       junction between solids. `geometry.ts` produces those by the hundred,
       because a sill sitting on a wall welds four faces onto one arris, and
       at every such edge one solid's back face meets another's front face and
       the naive test calls it a silhouette. That put the heaviest pen in the
       box on every internal seam: a wall built as ten panels came out with
       sixty outline strokes across its face.
       So: two faces that disagree is an outline and gets the heavy pen. More
       than two that disagree is a junction — still drawn, never dropped, but
       at the medium weight, which is what it looks like on paper. */
    if (sawFront && sawBack) {
      outA.push(ea[e]);
      outB.push(eb[e]);
      if (n === 2) {
        outK.push(2);
        nSil++;
      } else {
        outK.push(1);
        nBnd++;
      }
      continue;
    }

    /* CREASE. `minDot` is the cosine of the LARGEST angle between any pair of
       adjacent faces, so a genuine arris survives even when a third coplanar
       face shares the edge. Two coplanar triangles give minDot 1, angle 0, and
       the diagonal of a triangulated quad is dropped here — which is the line
       that would otherwise make the whole drawing look like a mesh. */
    if (minDot < cosCrease) {
      outA.push(ea[e]);
      outB.push(eb[e]);
      outK.push(0);
      nCre++;
    }
  }

  return {
    a: Int32Array.from(outA),
    b: Int32Array.from(outB),
    kind: Uint8Array.from(outK),
    count: outA.length,
    examined,
    silhouette: nSil,
    boundary: nBnd,
    crease: nCre,
  };
}

/* ===========================================================================
   7. STAGE 4 — THE BIN GRID

   The whole argument against a BVH, in one data structure.

   Under a PARALLEL projection every sight line points the same way, so once
   the vertices are projected the question "what is in front of this point"
   has no 3D component left in it: it is "which projected triangles contain
   this 2D point, and is one of them nearer". That is point location in the
   plane. A uniform grid answers it with one array index and a short walk, is
   built in one counting sort, and costs nothing to ship.

   Triangles are bucketed by the cells they ACTUALLY overlap, tested with a
   separating-axis check against each candidate cell, not by their bounding
   box. That distinction is the whole performance story on this model: `earcut`
   triangulates a wall around its openings into long thin diagonals whose
   bounding boxes are most of the drawing and whose area is a sliver. Binning
   those by bbox put a hundred triangles in the "too big, always check it"
   list, and everything in that list is tested by every single query. Measured,
   and this is the load-independent number: exact binning took the reference
   home from 99 always-checked triangles to 0, and the six-volume stress model
   from 500 to 0. `stats.oversizedTriangles` reports it, so the claim can be
   re-checked rather than believed.

   A triangle that genuinely covers more than half the sheet still goes in the
   always-checked list: it really is everywhere, and testing it once per query
   is cheaper than storing it in a thousand cells.
   =========================================================================== */

interface Grid {
  x0: number;
  y0: number;
  inv: number;
  cell: number;
  nx: number;
  ny: number;
  /** CSR-style: start[c]..start[c+1] indexes into items */
  start: Int32Array;
  items: Int32Array;
  big: Int32Array;
  /** query stamp, so a triangle in several cells is tested once per query */
  stamp: Int32Array;
  tick: number;
}

function buildGrid(
  tri2d: Tri2D,
  triCount: number,
  bounds: { x0: number; y0: number; x1: number; y1: number },
): Grid {
  const w = Math.max(bounds.x1 - bounds.x0, 1e-6);
  const h = Math.max(bounds.y1 - bounds.y0, 1e-6);

  /* Aim for roughly one triangle per cell, which is where a grid's constant
     factor is best, and clamp so a tiny model does not build a 1x1 grid and a
     huge one does not build a million empty cells. */
  const target = Math.max(1, Math.min(200, Math.ceil(Math.sqrt(Math.max(1, triCount)))));
  const cell = Math.max(w, h) / target;
  const inv = 1 / cell;
  const nx = Math.max(1, Math.min(512, Math.ceil(w * inv)));
  const ny = Math.max(1, Math.min(512, Math.ceil(h * inv)));
  const nCells = nx * ny;
  const half = cell / 2;

  /* Above this a triangle is declared "everywhere" and moved to the always-
     checked list. Half the sheet is the threshold: a roof plane really does
     cover that much, and one extra test per query beats storing it in
     thousands of cells. */
  const maxPerTri = Math.max(MAX_CELLS_PER_TRI, nCells >> 1);

  const clampX = (v: number): number => (v < 0 ? 0 : v > nx - 1 ? nx - 1 : v);
  const clampY = (v: number): number => (v < 0 ? 0 : v > ny - 1 ? ny - 1 : v);

  const counts = new Int32Array(nCells + 1);
  const bigList: number[] = [];
  const pairCell: number[] = [];
  const pairTri: number[] = [];
  const touched: number[] = [];

  for (let t = 0; t < triCount; t++) {
    if (!tri2d.live[t]) continue;
    const gx0 = clampX(Math.floor((tri2d.minX[t] - bounds.x0) * inv));
    const gy0 = clampY(Math.floor((tri2d.minY[t] - bounds.y0) * inv));
    const gx1 = clampX(Math.floor((tri2d.maxX[t] - bounds.x0) * inv));
    const gy1 = clampY(Math.floor((tri2d.maxY[t] - bounds.y0) * inv));

    if (gx0 === gx1 && gy0 === gy1) {
      pairCell.push(gy0 * nx + gx0);
      pairTri.push(t);
      counts[gy0 * nx + gx0 + 1]++;
      continue;
    }
    if ((gx1 - gx0 + 1) * (gy1 - gy0 + 1) > maxPerTri * 4) {
      bigList.push(t);
      continue;
    }

    /* Separating-axis setup. Only the three TRIANGLE EDGE normals are tested:
       the two box axes are already separating-or-not by construction, since
       the cell range came from the triangle's own bounding box. */
    const ax = tri2d.ax[t], ay = tri2d.ay[t];
    const bx = tri2d.bx[t], by = tri2d.by[t];
    const cx = tri2d.cx[t], cy = tri2d.cy[t];
    const n0x = -(by - ay), n0y = bx - ax;
    const n1x = -(cy - by), n1y = cx - bx;
    const n2x = -(ay - cy), n2y = ax - cx;
    // an edge normal projects both of its own endpoints to the same scalar,
    // so the triangle's interval on it is bounded by that and the third corner
    const e0 = ax * n0x + ay * n0y, f0 = cx * n0x + cy * n0y;
    const e1 = bx * n1x + by * n1y, f1 = ax * n1x + ay * n1y;
    const e2 = cx * n2x + cy * n2y, f2 = bx * n2x + by * n2y;
    const lo0 = Math.min(e0, f0), hi0 = Math.max(e0, f0);
    const lo1 = Math.min(e1, f1), hi1 = Math.max(e1, f1);
    const lo2 = Math.min(e2, f2), hi2 = Math.max(e2, f2);
    const r0 = (Math.abs(n0x) + Math.abs(n0y)) * half;
    const r1 = (Math.abs(n1x) + Math.abs(n1y)) * half;
    const r2 = (Math.abs(n2x) + Math.abs(n2y)) * half;

    touched.length = 0;
    for (let gy = gy0; gy <= gy1; gy++) {
      const bcy = bounds.y0 + (gy + 0.5) * cell;
      for (let gx = gx0; gx <= gx1; gx++) {
        const bcx = bounds.x0 + (gx + 0.5) * cell;
        const p0 = bcx * n0x + bcy * n0y;
        if (p0 + r0 < lo0 || p0 - r0 > hi0) continue;
        const p1 = bcx * n1x + bcy * n1y;
        if (p1 + r1 < lo1 || p1 - r1 > hi1) continue;
        const p2 = bcx * n2x + bcy * n2y;
        if (p2 + r2 < lo2 || p2 - r2 > hi2) continue;
        touched.push(gy * nx + gx);
      }
    }

    if (touched.length > maxPerTri) {
      bigList.push(t);
      continue;
    }
    for (const c of touched) {
      pairCell.push(c);
      pairTri.push(t);
      counts[c + 1]++;
    }
  }

  const start = new Int32Array(nCells + 1);
  for (let i = 0; i < nCells; i++) start[i + 1] = start[i] + counts[i + 1];

  /* Counting sort of the (cell, triangle) pairs. Pairs were emitted in
     triangle order, so each cell's list ends up in triangle order too, which
     is what makes the whole pass order-independent of the grid geometry. */
  const cursor = start.slice(0, nCells);
  const items = new Int32Array(pairCell.length);
  for (let k = 0; k < pairCell.length; k++) items[cursor[pairCell[k]]++] = pairTri[k];

  return {
    x0: bounds.x0,
    y0: bounds.y0,
    inv,
    cell,
    nx,
    ny,
    start,
    items,
    big: Int32Array.from(bigList),
    stamp: new Int32Array(triCount),
    tick: 0,
  };
}

/* ===========================================================================
   8. STAGE 5 — SPLIT AND HIDE
   =========================================================================== */

/** Projected triangle geometry, in paper points, plus the depth of each corner
 *  in feet. Kept as flat arrays because the inner loop reads every one of them
 *  for every candidate. */
interface Tri2D {
  ax: Float64Array;
  ay: Float64Array;
  bx: Float64Array;
  by: Float64Array;
  cx: Float64Array;
  cy: Float64Array;
  ad: Float64Array;
  bd: Float64Array;
  cd: Float64Array;
  /** twice the signed 2D area; the barycentric denominator, precomputed */
  area2: Float64Array;
  minX: Float64Array;
  minY: Float64Array;
  maxX: Float64Array;
  maxY: Float64Array;
  /** 1 when this triangle can occlude: it occludes by option AND it has real
   *  2D area. An edge-on face covers nothing, and dividing by its zero area
   *  would poison every barycentric it touched. */
  live: Uint8Array;
}

function projectTriangles(scene: Scene, sx: Float64Array, sy: Float64Array): Tri2D {
  const n = scene.triCount;
  const t: Tri2D = {
    ax: new Float64Array(n), ay: new Float64Array(n),
    bx: new Float64Array(n), by: new Float64Array(n),
    cx: new Float64Array(n), cy: new Float64Array(n),
    ad: new Float64Array(n), bd: new Float64Array(n), cd: new Float64Array(n),
    area2: new Float64Array(n),
    minX: new Float64Array(n), minY: new Float64Array(n),
    maxX: new Float64Array(n), maxY: new Float64Array(n),
    live: new Uint8Array(n),
  };
  for (let i = 0; i < n; i++) {
    const a = scene.ta[i];
    const b = scene.tb[i];
    const c = scene.tc[i];
    const axv = sx[a], ayv = sy[a];
    const bxv = sx[b], byv = sy[b];
    const cxv = sx[c], cyv = sy[c];
    t.ax[i] = axv; t.ay[i] = ayv;
    t.bx[i] = bxv; t.by[i] = byv;
    t.cx[i] = cxv; t.cy[i] = cyv;
    t.ad[i] = scene.pd[a];
    t.bd[i] = scene.pd[b];
    t.cd[i] = scene.pd[c];
    const area2 = (bxv - axv) * (cyv - ayv) - (cxv - axv) * (byv - ayv);
    t.area2[i] = area2;
    t.minX[i] = Math.min(axv, bxv, cxv);
    t.minY[i] = Math.min(ayv, byv, cyv);
    t.maxX[i] = Math.max(axv, bxv, cxv);
    t.maxY[i] = Math.max(ayv, byv, cyv);
    // PT_EPS squared is the smallest area worth trusting: below it the
    // triangle is a line on paper and its barycentrics are noise.
    t.live[i] = scene.occludes[i] && Math.abs(area2) > PT_EPS * PT_EPS ? 1 : 0;
  }
  return t;
}

/** A run of one edge, in parameter space along that edge. */
interface Run {
  t0: number;
  t1: number;
  hidden: boolean;
}

/**
 * Is the point (x, y) at `depth` covered by something nearer?
 *
 * Barycentrics come from the PROJECTED triangle, which is legitimate because a
 * parallel projection is affine: barycentric coordinates are preserved by it,
 * so interpolating the corner depths with the 2D weights gives the exact depth
 * of the surface above that pixel. Under a perspective projection this step
 * would need the perspective divide, which is one more reason an axonometric
 * is the right drawing to compute this way.
 */
function occludedAt(
  grid: Grid,
  tri: Tri2D,
  x: number,
  y: number,
  depth: number,
  bias: number,
): boolean {
  const test = (i: number): boolean => {
    if (!tri.live[i]) return false;
    if (x < tri.minX[i] || x > tri.maxX[i] || y < tri.minY[i] || y > tri.maxY[i]) return false;
    /* Dividing by the SIGNED doubled area is what makes this work for either
       winding: a clockwise triangle flips the sign of both the numerator and
       the denominator and the barycentric comes out the same. `geometry.ts`
       does not promise a consistent winding across parts, so this matters. */
    const inv = 1 / tri.area2[i];
    const w1 = ((x - tri.ax[i]) * (tri.cy[i] - tri.ay[i]) - (tri.cx[i] - tri.ax[i]) * (y - tri.ay[i])) * inv;
    if (w1 < INSIDE_TOL) return false;
    const w2 = ((tri.bx[i] - tri.ax[i]) * (y - tri.ay[i]) - (x - tri.ax[i]) * (tri.by[i] - tri.ay[i])) * inv;
    if (w2 < INSIDE_TOL) return false;
    const w0 = 1 - w1 - w2;
    if (w0 < INSIDE_TOL) return false;
    const d = w0 * tri.ad[i] + w1 * tri.bd[i] + w2 * tri.cd[i];
    return d > depth + bias;
  };

  const cx = Math.floor((x - grid.x0) * grid.inv);
  const cy = Math.floor((y - grid.y0) * grid.inv);
  if (cx >= 0 && cy >= 0 && cx < grid.nx && cy < grid.ny) {
    const c = cy * grid.nx + cx;
    const e = grid.start[c + 1];
    for (let k = grid.start[c]; k < e; k++) {
      if (test(grid.items[k])) return true;
    }
  }
  for (let k = 0; k < grid.big.length; k++) {
    if (test(grid.big[k])) return true;
  }
  return false;
}

/**
 * Every cell the segment passes through, once each.
 *
 * A 2D digital differential analyser rather than a bounding-box walk, because
 * the edges that matter most here are long diagonals — a ridge line across a
 * 34-foot house — whose bounding box is most of the drawing and whose actual
 * cell footprint is a thin stripe. Both ends are clamped into the grid, so a
 * segment that leaves the model's bounds walks the border cells instead of
 * running away; that costs a few extra candidates and never misses one.
 */
function cellsOnSegment(grid: Grid, x1: number, y1: number, x2: number, y2: number, visit: (c: number) => void): void {
  const clampX = (v: number): number => (v < 0 ? 0 : v > grid.nx - 1 ? grid.nx - 1 : v);
  const clampY = (v: number): number => (v < 0 ? 0 : v > grid.ny - 1 ? grid.ny - 1 : v);

  let cx = clampX(Math.floor((x1 - grid.x0) * grid.inv));
  let cy = clampY(Math.floor((y1 - grid.y0) * grid.inv));
  const ex = clampX(Math.floor((x2 - grid.x0) * grid.inv));
  const ey = clampY(Math.floor((y2 - grid.y0) * grid.inv));

  visit(cy * grid.nx + cx);
  if (cx === ex && cy === ey) return;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  const tDeltaX = stepX === 0 ? Infinity : Math.abs(grid.cell / dx);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(grid.cell / dy);

  // distance in t to the first vertical / horizontal cell boundary
  const bx = grid.x0 + (cx + (stepX > 0 ? 1 : 0)) * grid.cell;
  const by = grid.y0 + (cy + (stepY > 0 ? 1 : 0)) * grid.cell;
  let tMaxX = stepX === 0 ? Infinity : (bx - x1) / dx;
  let tMaxY = stepY === 0 ? Infinity : (by - y1) / dy;
  if (tMaxX < 0) tMaxX = 0;
  if (tMaxY < 0) tMaxY = 0;

  // The clamp above means the walk can only ever be as long as the grid is
  // wide plus as tall as it is high; the guard makes that a fact rather than
  // an argument, so a NaN coordinate cannot spin here.
  const guard = grid.nx + grid.ny + 4;
  for (let i = 0; i < guard; i++) {
    if (tMaxX < tMaxY) {
      cx += stepX;
      tMaxX += tDeltaX;
    } else {
      cy += stepY;
      tMaxY += tDeltaY;
    }
    if (cx < 0 || cy < 0 || cx >= grid.nx || cy >= grid.ny) return;
    visit(cy * grid.nx + cx);
    if (cx === ex && cy === ey) return;
  }
}

/**
 * Cut one projected edge where its visibility can change, and classify each
 * piece.
 *
 * THE KEY CLAIM, because everything downstream rests on it: along a straight
 * projected segment, the set of triangles covering it changes ONLY where the
 * segment crosses the projected boundary of some triangle. Between two
 * consecutive crossings the covering set is constant, so the depth ordering is
 * constant, so visibility is constant — and one test at the midpoint decides
 * the whole interval exactly. There is no sampling error to trade off here;
 * the only approximation is the tolerance used to call two crossings the same.
 */
function runsForEdge(
  grid: Grid,
  tri: Tri2D,
  x1: number,
  y1: number,
  d1: number,
  x2: number,
  y2: number,
  d2: number,
  bias: number,
  scratchT: number[],
  hitCount: { splits: number; overflowed: boolean },
): Run[] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!(len > PT_EPS)) return [];

  scratchT.length = 0;
  scratchT.push(0, 1);

  grid.tick++;
  const tick = grid.tick;

  const loX = x1 < x2 ? x1 : x2;
  const hiX = x1 < x2 ? x2 : x1;
  const loY = y1 < y2 ? y1 : y2;
  const hiY = y1 < y2 ? y2 : y1;
  const invLen2 = 1 / (len * len);

  /* One triangle edge against the segment. Written out longhand and taking
     scalars rather than an array of corners: this is the innermost loop in the
     module — three calls per candidate triangle, per edge — and allocating a
     pair of three-element arrays here would dominate it. */
  const cutOne = (pxk: number, pyk: number, qx: number, qy: number): void => {
    const sx = qx - pxk;
    const sy = qy - pyk;
    const den = dx * sy - dy * sx;
    const ox = pxk - x1;
    const oy = pyk - y1;
    const sLen = Math.hypot(sx, sy);

    // The parallel test is RELATIVE — |den| is |d||s|sin(theta), so comparing
    // it to an absolute epsilon would call a long near-parallel pair crossing
    // and a short genuinely-crossing pair parallel.
    if (Math.abs(den) < 1e-9 * len * sLen) {
      /* Parallel. If it is also COLLINEAR the two overlap, and the places
         visibility can change are the far segment's own endpoints projected
         onto ours. Handling it explicitly is what stops a wall arris running
         exactly along a roof edge from being left as one undivided run. */
      const cross = ox * dy - oy * dx; // perpendicular distance x len
      if (Math.abs(cross) > PT_EPS * len) return;
      const tp = (ox * dx + oy * dy) * invLen2;
      const tq = ((qx - x1) * dx + (qy - y1) * dy) * invLen2;
      if (tp > 0 && tp < 1) scratchT.push(tp);
      if (tq > 0 && tq < 1) scratchT.push(tq);
      return;
    }

    const t = (ox * sy - oy * sx) / den;
    if (t <= 0 || t >= 1) return;
    const u = (ox * dy - oy * dx) / den;
    if (u < 0 || u > 1) return;
    scratchT.push(t);
  };

  const cutAgainst = (i: number): void => {
    if (grid.stamp[i] === tick) return;
    grid.stamp[i] = tick;
    if (!tri.live[i]) return;
    if (tri.maxX[i] < loX || tri.minX[i] > hiX) return;
    if (tri.maxY[i] < loY || tri.minY[i] > hiY) return;
    const ax = tri.ax[i], ay = tri.ay[i];
    const bx = tri.bx[i], by = tri.by[i];
    const cx = tri.cx[i], cy = tri.cy[i];
    cutOne(ax, ay, bx, by);
    cutOne(bx, by, cx, cy);
    cutOne(cx, cy, ax, ay);
  };

  cellsOnSegment(grid, x1, y1, x2, y2, (c) => {
    const e = grid.start[c + 1];
    for (let k = grid.start[c]; k < e; k++) cutAgainst(grid.items[k]);
  });
  for (let k = 0; k < grid.big.length; k++) cutAgainst(grid.big[k]);

  if (scratchT.length > MAX_SPLITS_PER_EDGE) {
    scratchT.length = MAX_SPLITS_PER_EDGE;
    hitCount.overflowed = true;
  }

  scratchT.sort((a, b) => a - b);

  // Two crossings within a tenth of a point of each other are the same
  // crossing; keeping both would create a zero-length interval whose midpoint
  // test is meaningless.
  const tEps = Math.min(0.5, 0.1 / len);
  const runs: Run[] = [];
  let prev = scratchT[0];
  let openT = prev;
  let openHidden = false;
  let started = false;

  for (let i = 1; i < scratchT.length; i++) {
    const t = scratchT[i];
    if (t - prev < tEps) continue;
    const mid = (prev + t) / 2;
    const mx = x1 + dx * mid;
    const my = y1 + dy * mid;
    const md = d1 + (d2 - d1) * mid; // depth is affine in t under a parallel projection
    const hidden = occludedAt(grid, tri, mx, my, md, bias);
    if (!started) {
      openT = prev;
      openHidden = hidden;
      started = true;
    } else if (hidden !== openHidden) {
      runs.push({ t0: openT, t1: prev, hidden: openHidden });
      openT = prev;
      openHidden = hidden;
    }
    prev = t;
  }
  if (started) runs.push({ t0: openT, t1: prev, hidden: openHidden });
  hitCount.splits += scratchT.length;
  return runs;
}

/* ===========================================================================
   9. STAGE 6 — MERGE COLLINEAR AND TOUCHING

   Hidden-line removal always leaves the drawing in pieces. An edge cut at
   eleven crossings that turn out to be visible for all eleven arrives as
   eleven strokes; two different solids whose arrises land on the same line on
   paper arrive as two. Line art is one stroke in both cases.

   The merge is a 1D union, which is why no polygon boolean is needed anywhere
   in this file. Segments are grouped by the INFINITE LINE they lie on — a
   canonical direction plus the signed perpendicular offset of that line from
   the origin — then each group is projected to a scalar, sorted, and unioned.

   Grouping is by TOLERANCE ON A SORTED LIST rather than by rounding into
   buckets, because a bucket boundary falling between two identical lines is
   exactly the failure a rounding scheme cannot see. Each candidate is compared
   against the group's FIRST member rather than its previous one, so a long fan
   of slightly-rotating lines cannot chain itself into one group.
   =========================================================================== */

interface Raw {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: number;
  hidden: boolean;
  /** canonical direction, x >= 0 (and y >= 0 when x is 0) */
  dirx: number;
  diry: number;
  /** the same direction as an angle. Precomputed because the comparator below
   *  runs O(n log n) times and `Math.atan2` is not free. */
  ang: number;
  /** signed distance from the origin to the line */
  off: number;
  /** scalar interval along the canonical direction */
  s0: number;
  s1: number;
  /** input order, purely so the sort is a total order */
  seq: number;
}

/** Half a point: two strokes on the same line closer than this are one stroke.
 *  Small enough that a genuine gap in the drawing survives it — a real gap in
 *  this model is a whole opening or a whole overhang wide. */
const JOIN_PT = 0.5;
const ANGLE_TOL = 0.06 * RAD;
const OFFSET_TOL = 0.06;

function canonical(x1: number, y1: number, x2: number, y2: number, kind: number, hidden: boolean, seq: number): Raw | null {
  let dx = x2 - x1;
  let dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!(len > PT_EPS)) return null;
  dx /= len;
  dy /= len;
  // one direction per line, so a stroke drawn "backwards" lands in the same
  // group as its neighbour
  if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) {
    dx = -dx;
    dy = -dy;
  }
  const off = dx * y1 - dy * x1;
  const s0 = dx * x1 + dy * y1;
  const s1 = dx * x2 + dy * y2;
  return {
    x1, y1, x2, y2, kind, hidden,
    dirx: dx, diry: dy, ang: Math.atan2(dy, dx), off,
    s0: Math.min(s0, s1), s1: Math.max(s0, s1),
    seq,
  };
}

function mergeSegments(raws: Raw[]): AxonSegment[] {
  /* A TOTAL order — the `seq` tie-break means no two entries ever compare
     equal, so the result does not depend on whether the engine's sort is
     stable. That is the whole determinism story for this stage. */
  raws.sort((a, b) => {
    if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
    if (a.kind !== b.kind) return b.kind - a.kind; // silhouette first
    if (a.ang !== b.ang) return a.ang - b.ang;
    if (a.off !== b.off) return a.off - b.off;
    if (a.s0 !== b.s0) return a.s0 - b.s0;
    return a.seq - b.seq;
  });

  const out: AxonSegment[] = [];
  let i = 0;
  while (i < raws.length) {
    const head = raws[i];
    let j = i + 1;
    while (j < raws.length) {
      const c = raws[j];
      if (c.hidden !== head.hidden || c.kind !== head.kind) break;
      // compared against the GROUP HEAD, never against the previous member, so
      // a slowly-rotating fan of lines cannot chain itself into one group
      if (Math.abs(c.ang - head.ang) > ANGLE_TOL) break;
      if (Math.abs(c.off - head.off) > OFFSET_TOL) break;
      j++;
    }

    // The group is already sorted by s0 (the comparator's last real key), so
    // the union is a single forward sweep.
    let a0 = raws[i].s0;
    let a1 = raws[i].s1;
    const flush = (): void => {
      const ox = -head.diry * head.off;
      const oy = head.dirx * head.off;
      out.push({
        x1: ox + head.dirx * a0,
        y1: oy + head.diry * a0,
        x2: ox + head.dirx * a1,
        y2: oy + head.diry * a1,
        kind: KIND_NAME[head.kind],
        hidden: head.hidden,
      });
    };
    for (let k = i + 1; k < j; k++) {
      const s = raws[k];
      if (s.s0 <= a1 + JOIN_PT) {
        if (s.s1 > a1) a1 = s.s1;
      } else {
        flush();
        a0 = s.s0;
        a1 = s.s1;
      }
    }
    flush();
    i = j;
  }
  return out;
}

/* ===========================================================================
   10. STAGE 7 — RENDER
   =========================================================================== */

function renderSvg(
  segments: readonly AxonSegment[],
  widthPt: number,
  heightPt: number,
  opts: { title: string; subtitle: string; viewLabel: string; caption: boolean },
): string {
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fx(widthPt, 2)}pt" height="${fx(heightPt, 2)}pt" ` +
      `viewBox="0 0 ${fx(widthPt, 2)} ${fx(heightPt, 2)}" role="img" style="${PENS}">`,
  );
  out.push(
    `<title>${esc(`${opts.title} — axonometric, ${opts.viewLabel}. ${AXON_STAMP[1]}`)}</title>`,
  );
  out.push(`<style>${SHEET_CSS}</style>`);
  out.push(`<rect x="0" y="0" width="${fx(widthPt, 2)}" height="${fx(heightPt, 2)}" class="aux-paper"/>`);

  /* One <path> per pen rather than one <line> per stroke. A house at this
     scale is a few thousand strokes, and four path elements instead of a few
     thousand line elements is the difference between an SVG the browser lays
     out instantly and one it thinks about. */
  const buckets: { cls: string; w: number; d: string[] }[] = [
    { cls: "aux-hide", w: 0.45, d: [] },
    { cls: CLASS_OF.crease, w: WEIGHT.crease, d: [] },
    { cls: CLASS_OF.boundary, w: WEIGHT.boundary, d: [] },
    { cls: CLASS_OF.silhouette, w: WEIGHT.silhouette, d: [] },
  ];
  const bucketOf = (s: AxonSegment): number =>
    s.hidden ? 0 : s.kind === "crease" ? 1 : s.kind === "boundary" ? 2 : 3;

  for (const s of segments) {
    buckets[bucketOf(s)].d.push(
      `M${fx(s.x1, 2)},${fx(s.y1, 2)}L${fx(s.x2, 2)},${fx(s.y2, 2)}`,
    );
  }
  // Hidden lines first so the visible drawing sits on top of them.
  for (const b of buckets) {
    if (b.d.length === 0) continue;
    out.push(`<path d="${b.d.join("")}" class="${b.cls}" stroke-width="${num(b.w)}"/>`);
  }

  if (opts.caption) {
    const bandY = heightPt - 44;
    out.push(
      `<line x1="0" y1="${fx(bandY, 2)}" x2="${fx(widthPt, 2)}" y2="${fx(bandY, 2)}" class="aux-hair" stroke-width="0.5"/>`,
    );
    const t = (x: number, y: number, cls: string, size: string, body: string, extra = ""): string =>
      `<text x="${fx(x, 2)}" y="${fx(y, 2)}" class="${cls}" font-size="${size}"${extra}>${esc(body)}</text>`;

    out.push(t(0, bandY + 15, "aux-t-ink", "9px", opts.title, ` letter-spacing="1.1"`));
    if (opts.subtitle) out.push(t(0, bandY + 28, "aux-t-dim", "7px", opts.subtitle));
    out.push(t(0, bandY + 40, "aux-t-accent", "6.6px", opts.viewLabel, ` letter-spacing="0.7"`));

    out.push(t(widthPt, bandY + 15, "aux-t-ink", "7px", AXON_STAMP[0], ` text-anchor="end" letter-spacing="0.6"`));
    out.push(t(widthPt, bandY + 27, "aux-t-dim", "6.6px", AXON_STAMP[1], ` text-anchor="end"`));
  }

  out.push(`</svg>`);
  return out.join("");
}

/* ===========================================================================
   11. THE PUBLIC ENTRY POINT
   =========================================================================== */

const emptyStats = (): AxonStats => ({
  meshes: 0, triangles: 0, degenerateTriangles: 0, weldedVertices: 0, rawVertices: 0,
  edges: 0, silhouette: 0, boundary: 0, crease: 0, splitPoints: 0, runsBeforeMerge: 0,
  visibleSegments: 0, hiddenSegments: 0, occludingTriangles: 0, gridCells: 0,
  oversizedTriangles: 0,
});

/**
 * A vector axonometric of a set of meshes, with hidden lines removed.
 *
 * Never throws for a bad model. An empty mesh list, a model of nothing but
 * degenerate triangles, or a model past the triangle budget all come back as a
 * valid (empty) result with the reason in `warnings` — this drawing sits in a
 * builder where somebody is dragging sliders, and a thrown exception there is
 * a blank screen rather than a message.
 */
export function axonometric(meshes: readonly AxonMesh[], options: AxonOptions = {}): AxonResult {
  const warnings: string[] = [];
  const view = resolveView(options.view);
  const basis = basisOf(view);

  const marginPt = options.marginPt ?? DEF_MARGIN_PT;
  const creaseAngleDeg = options.creaseAngleDeg ?? DEF_CREASE_DEG;
  const bias = options.depthBiasFt ?? DEF_BIAS_FT;
  const showHidden = options.showHidden ?? false;
  const caption = options.caption ?? true;
  const title = options.title ?? "Axonometric";
  const viewLabel =
    `VIEWED FROM THE ${compassName(view.azimuthDeg)} · ` +
    `${fx(view.elevationDeg, 1)}° ABOVE THE HORIZON · PARALLEL PROJECTION`;

  const bare = (): AxonResult => ({
    svg: renderSvg([], 320, 120, { title, subtitle: options.subtitle ?? "", viewLabel, caption }),
    segments: [],
    widthPt: 320,
    heightPt: 120,
    ptPerFt: 1,
    view,
    viewLabel,
    stats: emptyStats(),
    warnings,
  });

  if (meshes.length === 0) {
    warnings.push("There is nothing to draw: no meshes were supplied.");
    return bare();
  }

  const scene = buildScene(
    meshes,
    basis,
    options.exclude ?? [],
    options.transparent ?? [],
    options.maxTriangles ?? DEF_MAX_TRIS,
    warnings,
  );
  if (!scene) {
    if (warnings.length === 0) {
      warnings.push("There is nothing to draw: every triangle in the model was degenerate or excluded.");
    }
    return bare();
  }

  /* ------------------------------------------------- scale and paper frame

     The projection came out in FEET. Everything after this point is in PAPER
     POINTS with y already flipped, so every tolerance in the file is in the
     unit a reader actually sees rather than in model feet. */
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < scene.vertCount; i++) {
    const x = scene.px[i];
    const y = scene.py[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);

  const targetW = Math.max(120, options.widthPt ?? DEF_WIDTH_PT);
  const ptPerFt = options.ptPerFt && options.ptPerFt > 0 ? options.ptPerFt : (targetW - marginPt * 2) / spanX;

  const artW = spanX * ptPerFt;
  const artH = spanY * ptPerFt;
  const widthPt = artW + marginPt * 2;
  const heightPt = artH + marginPt * 2 + (caption ? 44 : 0);

  const sx = new Float64Array(scene.vertCount);
  const sy = new Float64Array(scene.vertCount);
  for (let i = 0; i < scene.vertCount; i++) {
    sx[i] = marginPt + (scene.px[i] - minX) * ptPerFt;
    // Model up is screen up, and SVG y grows downward: this is the one flip.
    sy[i] = marginPt + (maxY - scene.py[i]) * ptPerFt;
  }

  /* ----------------------------------------------------------- the passes */

  const edges = extractEdges(scene, creaseAngleDeg, warnings);
  const tri = projectTriangles(scene, sx, sy);

  let occluding = 0;
  for (let i = 0; i < scene.triCount; i++) if (tri.live[i]) occluding++;

  const grid = buildGrid(tri, scene.triCount, {
    x0: marginPt,
    y0: marginPt,
    x1: marginPt + artW,
    y1: marginPt + artH,
  });

  const raws: Raw[] = [];
  const scratch: number[] = [];
  const counter = { splits: 0, overflowed: false };
  let runsBeforeMerge = 0;
  let seq = 0;

  for (let e = 0; e < edges.count; e++) {
    const a = edges.a[e];
    const b = edges.b[e];
    const x1 = sx[a], y1 = sy[a], d1 = scene.pd[a];
    const x2 = sx[b], y2 = sy[b], d2 = scene.pd[b];
    const runs = runsForEdge(grid, tri, x1, y1, d1, x2, y2, d2, bias, scratch, counter);
    runsBeforeMerge += runs.length;
    for (const r of runs) {
      if (r.hidden && !showHidden) continue;
      const ax = x1 + (x2 - x1) * r.t0;
      const ay = y1 + (y2 - y1) * r.t0;
      const bx = x1 + (x2 - x1) * r.t1;
      const by = y1 + (y2 - y1) * r.t1;
      const raw = canonical(ax, ay, bx, by, edges.kind[e], r.hidden, seq++);
      if (raw) raws.push(raw);
    }
  }

  if (counter.overflowed) {
    warnings.push(
      `At least one edge crosses more than ${group(MAX_SPLITS_PER_EDGE)} triangle outlines in this view. It was cut at the first ${group(MAX_SPLITS_PER_EDGE)} crossings, so part of that line may be drawn where it should have been removed. Rotating the view usually clears it.`,
    );
  }

  const segments = mergeSegments(raws);

  let vis = 0;
  let hid = 0;
  for (const s of segments) {
    if (s.hidden) hid++;
    else vis++;
  }

  if (segments.length === 0) {
    warnings.push(
      `Nothing survived the hidden-line pass. The model has ${scene.triCount} triangles and ${edges.count} candidate edges, so this is a view problem rather than an empty model — the eye may be inside the building.`,
    );
  }

  const stats: AxonStats = {
    meshes: meshes.length,
    triangles: scene.triCount,
    degenerateTriangles: scene.degenerate,
    weldedVertices: scene.vertCount,
    rawVertices: scene.rawVertices,
    edges: edges.examined,
    silhouette: edges.silhouette,
    boundary: edges.boundary,
    crease: edges.crease,
    splitPoints: counter.splits,
    runsBeforeMerge,
    visibleSegments: vis,
    hiddenSegments: hid,
    occludingTriangles: occluding,
    gridCells: grid.nx * grid.ny,
    oversizedTriangles: grid.big.length,
  };

  return {
    svg: renderSvg(segments, widthPt, heightPt, {
      title,
      subtitle: options.subtitle ?? "",
      viewLabel,
      caption,
    }),
    segments,
    widthPt,
    heightPt,
    ptPerFt,
    view,
    viewLabel,
    stats,
    warnings,
  };
}

/**
 * The headline call: a built home, straight to a finished axonometric.
 *
 * Warnings from the adapter and from the pass are merged, so a caller shows
 * one list. `home.warnings` is deliberately NOT folded in — those belong to
 * the model, are already on screen elsewhere, and repeating them here would
 * make the drawing look like it had caused them.
 */
export function axonometricFromHome(home: HomeGeometry, options: AxonOptions = {}): AxonResult {
  const adapterWarnings: string[] = [];
  const meshes = meshesFromHome(home, adapterWarnings);
  const result = axonometric(meshes, options);
  if (adapterWarnings.length > 0) result.warnings = adapterWarnings.concat(result.warnings);
  return result;
}

/** The drawing as a data URL, for a download link or an `<img src>`.
 *  Rendered standalone the page tokens are gone, so it falls back to white
 *  paper and `currentColor` ink — which is what a downloaded drawing should
 *  be, and matches `drawings/kit.ts`'s `drawingDataUrl`. */
export const axonometricDataUrl = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
