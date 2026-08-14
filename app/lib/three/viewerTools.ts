/* ===========================================================================
   VIEWER TOOLS — the arithmetic behind a section cut and a floor isolation.

   Everything here is PURE: a `BuildingGraph` (or null), the legacy `HomeSpec`
   and a plain tool state go in, and a description of what the renderer should
   do comes out. No React, no canvas, no renderer — which is what lets
   `tests/builder-viewer-tools.spec.ts` prove the hard parts in node, in
   milliseconds, without a browser.

   THREE THINGS THIS FILE IS CAREFUL ABOUT
   ---------------------------------------
   1. FLOOR ISOLATION REFUSES WHERE IT CANNOT ANSWER. `canIsolate` and
      `whyNot` are the whole point of the module. In graph mode a storey IS a
      VolumeGeometry (`buildGraphHome` emits one per `GraphStorey` with
      `id: storey.id`), so isolating one is real. In legacy-spec mode there is
      no per-floor geometry at all — one VolumeGeometry per `spec.volumes`
      entry, and a two-storey volume is a single mesh set. Worse,
      `legacySpecToBuildingGraph` REFUSES any spec with `volume.storeys !== 1`,
      so a two-storey legacy home cannot reach graph mode either. A control
      that appeared to work and isolated nothing would be the same class of
      defect that once put grass through a deck, so this module hands back a
      sentence instead of a lie.
   2. ELEVATION COMES FROM THE GRAPH, NEVER FROM THE GEOMETRY. `VolumeGeometry`
      carries no `elevationFt` — only `eaveHeightFt` (which is
      `storey.elevationFt + storey.heightFt`) and `ridgeHeightFt`. Reading a
      floor's elevation off the built geometry would be right for the ground
      floor by coincidence and wrong for every floor above it.
   3. `visibleVolumeIds` IS AN INSTRUCTION TO EMPHASISE, NOT TO DELETE. The
      viewport GHOSTS the volumes that are not in the list rather than setting
      `visible = false` on them, because three's GLTFExporter defaults to
      `onlyVisible: true` (`lib/builder/exportSpec.ts` passes
      `opts.onlyVisible ?? true`, and `ExportRow` passes no option), so an
      invisible floor would silently leave the .glb. A view must not edit the
      export.

   WHAT A SECTION CUT IS HERE: one plane, moveable along one axis, applied to
   the HOUSE MATERIALS only — never to the ground, the grid or the overlays.
   The cut face is NOT capped. An uncapped solid reads as a hollow shell and a
   person will believe the wall is empty, so the UI that drives this says so in
   words rather than leaving the viewer to guess.
   =========================================================================== */

import * as THREE from "three";

import type { BuildingGraph } from "@/lib/builder/buildingGraph";
import { GRADE_Y_FT, summarizeHome, type SiteSummary } from "@/lib/builder/geometry";
import { summarizeBuildingGraph } from "@/lib/builder/graphGeometry";
import type { HomeSpec } from "@/lib/builder/spec";

/* ----------------------------------------------------------------- state */

export type SectionAxis = "x" | "y" | "z";

export interface SectionState {
  enabled: boolean;
  /** x cuts east–west, z cuts north–south, y is a horizontal plan cut */
  axis: SectionAxis;
  /** where along that axis, 0 at the low bound and 1 at the high bound */
  t: number;
  /** false keeps the LOW side of the cut, true keeps the high side */
  flipped: boolean;
}

export interface ViewerToolState {
  section: SectionState;
  /** a `GraphStorey.id`, which is also the `VolumeGeometry.id` for that
   *  storey. `null` is the everything-visible state and the default. */
  isolatedFloorId: string | null;
}

export const DEFAULT_VIEWER_TOOLS: ViewerToolState = {
  section: { enabled: false, axis: "x", t: 0.5, flipped: false },
  isolatedFloorId: null,
};

/* ---------------------------------------------------------------- result */

export interface ViewerToolsResult {
  /** empty when no cut is active. At most one plane today. */
  clipPlanes: THREE.Plane[];
  /** the volume ids the isolation asks to show; `null` means every volume.
   *  See note 3 in the header for why the renderer ghosts the rest. */
  visibleVolumeIds: string[] | null;
  /** is floor isolation an honest control on THIS document? */
  canIsolate: boolean;
  /** why not, in a sentence a person can act on. `null` when `canIsolate`. */
  whyNot: string | null;
  /** the cut position in feet along its axis, for the read-out */
  cutAtFt: number;
  /** the axis span the cut travels, so the UI can print both ends */
  span: SectionSpan;
}

export interface SectionSpan {
  axis: SectionAxis;
  minFt: number;
  maxFt: number;
}

/** One storey, as the isolation control needs it. `id` is both the
 *  `GraphStorey.id` and the `VolumeGeometry.id` `buildGraphHome` emits. */
export interface ViewerFloor {
  id: string;
  name: string;
  /** from the graph, never from `eaveHeightFt` — see note 2 in the header */
  elevationFt: number;
  heightFt: number;
}

/* --------------------------------------------------------- the refusals */

export const WHY_SINGLE_STOREY_GRAPH =
  "This home has one storey, so isolating a floor would hide nothing. Add a storey in the plan editor and this control appears.";

export const WHY_LEGACY_TWO_STOREY =
  "This design is two storeys, but its geometry is one legacy mesh set per volume with no per-floor split — and converting it to planar geometry is refused for multi-storey designs, so there is no floor to isolate yet. Aura would rather say that than show a control that hides nothing.";

export const WHY_LEGACY_SINGLE_STOREY =
  "This design is single-storey legacy geometry: there is one floor, and isolating it would hide nothing. Convert to planar editing and add a storey to use this.";

/* ------------------------------------------------------------- the maths */

const EPS = 1e-9;

const clamp01 = (value: number): number =>
  !Number.isFinite(value) ? 0 : value < 0 ? 0 : value > 1 ? 1 : value;

/** The summary the tools measure against: the graph's when there is a graph,
 *  the spec's when there is not. Never both, and never a mix. */
function summaryFor(graph: BuildingGraph | null, spec: HomeSpec): SiteSummary {
  return graph ? summarizeBuildingGraph(graph) : summarizeHome(spec);
}

/**
 * How far the cut can travel on each axis.
 *
 * X and Z come from `boundsWithRoof`, so the plane can be pushed clear of an
 * eave rather than stopping at the wall line. Y runs from GRADE to the tallest
 * ridge, because a plan cut that could not reach the piles or the roof would
 * be a slider with dead ends.
 */
export function sectionSpan(
  graph: BuildingGraph | null,
  spec: HomeSpec,
  axis: SectionAxis,
): SectionSpan {
  const summary = summaryFor(graph, spec);
  const bounds = summary.boundsWithRoof;
  if (axis === "y") {
    return { axis, minFt: GRADE_Y_FT, maxFt: Math.max(GRADE_Y_FT, summary.maxRidgeHeightFt) };
  }
  if (axis === "z") return { axis, minFt: bounds.minZ, maxFt: bounds.maxZ };
  return { axis, minFt: bounds.minX, maxFt: bounds.maxX };
}

/** Where the plane sits, in feet on its own axis. */
export function cutPositionFt(span: SectionSpan, t: number): number {
  return span.minFt + (span.maxFt - span.minFt) * clamp01(t);
}

const AXIS_UNIT: Readonly<Record<SectionAxis, readonly [number, number, number]>> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/**
 * The plane, in three's own convention.
 *
 * A material clips a fragment when `plane.normal · p + plane.constant < 0`, so
 * "keep the low side of a cut at `c` on X" is normal (−1, 0, 0) with constant
 * `c`: the surviving points are exactly those with `x ≤ c`. Flipping negates
 * both, which swaps the kept half without moving the cut.
 */
export function sectionPlane(span: SectionSpan, t: number, flipped: boolean): THREE.Plane {
  const cut = cutPositionFt(span, t);
  const sign = flipped ? 1 : -1;
  const unit = AXIS_UNIT[span.axis];
  return new THREE.Plane(
    new THREE.Vector3(unit[0] * sign, unit[1] * sign, unit[2] * sign),
    -sign * cut,
  );
}

/* ------------------------------------------------------------- the floors */

/**
 * The storeys, low to high.
 *
 * Legacy documents get an EMPTY list rather than a guessed one. `Volume.storeys`
 * is a count, not a decomposition: there is no geometry for the upper floor to
 * point at, so there is nothing honest to return.
 */
export function viewerFloors(graph: BuildingGraph | null): ViewerFloor[] {
  if (!graph) return [];
  return graph.storeys
    .map((storey) => ({
      id: storey.id,
      name: storey.name,
      elevationFt: storey.elevationFt,
      heightFt: storey.heightFt,
    }))
    .sort((a, b) => a.elevationFt - b.elevationFt);
}

interface Isolation {
  visibleVolumeIds: string[] | null;
  canIsolate: boolean;
  whyNot: string | null;
}

function isolationFor(
  graph: BuildingGraph | null,
  spec: HomeSpec,
  isolatedFloorId: string | null,
): Isolation {
  if (!graph) {
    const multiStorey = spec.volumes.some((volume) => volume.storeys !== 1);
    return {
      visibleVolumeIds: null,
      canIsolate: false,
      whyNot: multiStorey ? WHY_LEGACY_TWO_STOREY : WHY_LEGACY_SINGLE_STOREY,
    };
  }
  const floors = viewerFloors(graph);
  if (floors.length < 2) {
    return { visibleVolumeIds: null, canIsolate: false, whyNot: WHY_SINGLE_STOREY_GRAPH };
  }
  // A stale id — a storey deleted while it was isolated — shows the whole home
  // again rather than an empty scene. Nothing is a worse answer than everything.
  const chosen = floors.find((floor) => floor.id === isolatedFloorId) ?? null;
  return {
    visibleVolumeIds: chosen ? [chosen.id] : null,
    canIsolate: true,
    whyNot: null,
  };
}

/* ------------------------------------------------------------ the answer */

/**
 * Everything the viewport needs to honour the tool row, derived from the
 * document and the tool state and nothing else.
 *
 * It reads its inputs and never writes to them: hand it a frozen graph and a
 * frozen spec and it still answers, which is how the spec proves that toggling
 * a tool cannot move the document or its hash.
 */
export function deriveViewerTools(
  graph: BuildingGraph | null,
  spec: HomeSpec,
  tools: ViewerToolState,
): ViewerToolsResult {
  const span = sectionSpan(graph, spec, tools.section.axis);
  const isolation = isolationFor(graph, spec, tools.isolatedFloorId);
  return {
    clipPlanes: tools.section.enabled
      ? [sectionPlane(span, tools.section.t, tools.section.flipped)]
      : [],
    visibleVolumeIds: isolation.visibleVolumeIds,
    canIsolate: isolation.canIsolate,
    whyNot: isolation.whyNot,
    cutAtFt: cutPositionFt(span, tools.section.t),
    span,
  };
}

/* ------------------------------------------------------------- picking */

/**
 * Keep a pick ray on the visible side of the cut.
 *
 * Clipping happens in the fragment shader; the raycaster knows nothing about
 * it, so a click over a sectioned home would otherwise select the wall the cut
 * just removed — a control that appears to work and points at nothing. A half
 * space is convex, so the fix is one number: the ray either starts outside the
 * kept half and enters it at `t` (move `near` there), or starts inside it and
 * leaves at `t` (move `far` there).
 *
 * Returns false when the ray never reaches the kept half at all, which is the
 * caller's cue to treat the click as a click on nothing.
 */
export function restrictRayToSection(
  raycaster: THREE.Raycaster,
  planes: readonly THREE.Plane[],
): boolean {
  raycaster.near = 0;
  raycaster.far = Infinity;
  const plane = planes[0];
  if (!plane) return true;
  const inside = plane.distanceToPoint(raycaster.ray.origin) >= 0;
  const crossing = raycaster.ray.distanceToPlane(plane);
  if (crossing === null) {
    // Parallel to the plane, or pointing away from it: whichever side the
    // origin is on is the side the whole ray stays on.
    return inside;
  }
  if (inside) raycaster.far = crossing;
  else raycaster.near = crossing + EPS;
  return true;
}
