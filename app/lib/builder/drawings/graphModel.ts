/* ===========================================================================
   EX03 / B16 — a BuildingGraph becomes a HomeModel the sheets already ink.

   THE LIE THIS FILE EXISTS NOT TO TELL. After conversion, `document.spec` is
   a frozen recovery copy. Feeding it to `buildHomeModel` would draw a house
   that is no longer on screen. The sheets already consume world polygons and
   world wall segments (`vm.outer`, `wall.a` / `wall.b`); this file fills those
   from the graph's own slabs and edges.

   WHAT IS STILL A TRANSLATION, NAMED ON THE SET. Elevations and the building
   section still silhouette each storey as its axis-aligned bounding box,
   because `massShape` is a rectangular projector. Openings are placed from
   world coordinates, so they sit on the elevation they actually face. Wall
   heads are the storey eave; a gable rake is not yet cut from the roof zone.
   There is no graph deck, so no deck is drawn.

   NO THREE.JS. Same rule as `model.ts`: this module is plain numbers.
   =========================================================================== */

import {
  legacyRoofFormFor,
  roofFormIsApproximated,
  type BuildingGraph,
  type GraphOpening,
  type GraphStorey,
  type GraphWallEdge,
} from "@/lib/builder/buildingGraph";
import type { HomeSpec, OpeningKind, RoofForm, Volume, Wall } from "@/lib/builder/spec";
import { WALL_R_VALUE } from "@/lib/design/materials";

import {
  boxOf,
  pileGrid,
  roofSectionFor,
  wallThicknessFt,
  partitionThicknessFt,
  type HomeModel,
  type Pt,
  type VolumeModel,
  type WorldOpening,
  type WorldWall,
} from "./model";

const EPS = 1e-9;

const verticesOf = (storey: GraphStorey): Map<string, { xFt: number; zFt: number }> =>
  new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));

const areaOf = (points: readonly Pt[]): number => {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    twice += points[i][0] * points[next][1] - points[next][0] * points[i][1];
  }
  return Math.abs(twice) / 2;
};

const ringOf = (
  storey: GraphStorey,
  ids: readonly string[],
): Pt[] => {
  const vertices = verticesOf(storey);
  return ids
    .map((id) => vertices.get(id))
    .filter((item): item is { xFt: number; zFt: number } => !!item)
    .map((item) => [item.xFt, item.zFt] as Pt);
};

function pointInPoly(point: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const zi = poly[i][1];
    const xj = poly[j][0];
    const zj = poly[j][1];
    if (zi === zj) continue;
    if (zi > point[1] !== zj > point[1] && point[0] < ((xj - xi) * (point[1] - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Outward unit normal of a wall, using the slab as the inside. */
export function outwardNormal(a: Pt, b: Pt, outer: readonly Pt[]): Pt {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const run = Math.hypot(dx, dz);
  if (run <= EPS) return [0, 1];
  const left: Pt = [-dz / run, dx / run];
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const probe: Pt = [mid[0] + left[0] * 0.05, mid[1] + left[1] * 0.05];
  return pointInPoly(probe, outer) ? [dz / run, -dx / run] : left;
}

/** Nearest of the four elevation views. +X is east, +Z is south. */
export function nearestCompassWall(normal: Pt): Wall {
  const [nx, nz] = normal;
  if (Math.abs(nz) >= Math.abs(nx)) return nz < 0 ? "n" : "s";
  return nx >= 0 ? "e" : "w";
}

const asOpeningKind = (kind: GraphOpening["kind"]): OpeningKind => kind;

/* A hip has no `RoofForm`, so the drawing shows its nearest neighbour and the
   sheet set says so. See `legacyRoofFormFor` for why a gable is that neighbour
   and what it costs. Casting here is what turned a disclosable approximation
   into a type error. */
const asRoofForm = (form: GraphStorey["roofZones"][number]["form"]): RoofForm =>
  legacyRoofFormFor(form);

function storeyVolume(storey: GraphStorey, outer: readonly Pt[]): Volume {
  const xs = outer.map((p) => p[0]);
  const zs = outer.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const zone = storey.roofZones[0];
  return {
    id: storey.id,
    name: storey.name,
    widthFt: Math.max(1, maxX - minX),
    depthFt: Math.max(1, maxZ - minZ),
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    rotationDeg: 0,
    storeys: 1,
    wallHeightFt: storey.heightFt,
    roof: {
      form: zone ? asRoofForm(zone.form) : "flat",
      pitchDeg: zone?.pitchDeg ?? 0,
      overhangFt: 0,
    },
    openings: [],
  };
}

function worldOpening(
  opening: GraphOpening,
  start: Pt,
  ux: number,
  uz: number,
  runFt: number,
  wall: Wall,
  volumeId: string,
  volumeName: string,
  normal: Pt,
  eaveY: number,
): WorldOpening {
  const drawnOffsetFt = Math.min(Math.max(0, opening.offsetFt), runFt);
  const drawnWidthFt = Math.min(Math.max(0, opening.widthFt), Math.max(0, runFt - drawnOffsetFt));
  const headFt = opening.sillFt + Math.max(0, opening.heightFt);
  const a: Pt = [start[0] + ux * drawnOffsetFt, start[1] + uz * drawnOffsetFt];
  const b: Pt = [start[0] + ux * (drawnOffsetFt + drawnWidthFt), start[1] + uz * (drawnOffsetFt + drawnWidthFt)];
  return {
    id: opening.id,
    volumeId,
    volumeName,
    wall,
    kind: asOpeningKind(opening.kind),
    widthFt: opening.widthFt,
    heightFt: opening.heightFt,
    offsetFt: opening.offsetFt,
    sillFt: opening.sillFt,
    drawnOffsetFt,
    drawnWidthFt,
    clipped: Math.abs(drawnWidthFt - Math.max(0, opening.widthFt)) > 1e-6,
    headAboveWall: headFt > eaveY + 1e-6,
    a,
    b,
    normal,
    headFt,
  };
}

function worldWallFromGraph(
  wall: GraphWallEdge,
  storey: GraphStorey,
  outer: readonly Pt[],
  eaveY: number,
): WorldWall | null {
  const vertices = verticesOf(storey);
  const start = vertices.get(wall.startVertexId);
  const end = vertices.get(wall.endVertexId);
  if (!start || !end) return null;
  const a: Pt = [start.xFt, start.zFt];
  const b: Pt = [end.xFt, end.zFt];
  const runFt = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (runFt <= EPS) return null;
  const ux = (b[0] - a[0]) / runFt;
  const uz = (b[1] - a[1]) / runFt;
  const normal = outwardNormal(a, b, outer);
  const compass = nearestCompassWall(normal);
  const t = wall.thicknessFt;
  const openings = wall.openings
    .map((opening) =>
      worldOpening(opening, a, ux, uz, runFt, compass, storey.id, storey.name, normal, eaveY),
    )
    .sort((p, q) => p.drawnOffsetFt - q.drawnOffsetFt || p.id.localeCompare(q.id));
  return {
    volumeId: storey.id,
    volumeName: storey.name,
    wall: compass,
    runFt,
    thicknessFt: t,
    a,
    b,
    innerA: [a[0] - normal[0] * t, a[1] - normal[1] * t],
    innerB: [b[0] - normal[0] * t, b[1] - normal[1] * t],
    normal,
    topProfile: [
      [0, eaveY],
      [runFt, eaveY],
    ],
    built: wall.kind === "external",
    openings,
  };
}

function volumeModelFromStorey(storey: GraphStorey, wallT: number): VolumeModel | null {
  const slab = storey.slabs[0];
  if (!slab) return null;
  const outer = ringOf(storey, slab.boundaryVertexIds);
  if (outer.length < 3) return null;
  const volume = storeyVolume(storey, outer);
  const roof = roofSectionFor(volume, wallT);
  const walls = storey.walls
    .map((wall) => worldWallFromGraph(wall, storey, outer, roof.eaveY))
    .filter((item): item is WorldWall => item !== null);
  const inner = walls.length
    ? walls.map((wall) => wall.innerA)
    : outer;
  const zone = storey.roofZones[0];
  const roofPlan = zone ? ringOf(storey, zone.boundaryVertexIds) : outer;
  const ridge: [Pt, Pt] | null = zone?.ridge
    ? [zone.ridge.start, zone.ridge.end]
    : null;
  return {
    volume,
    outer,
    inner: inner.length >= 3 ? inner : outer,
    roof,
    roofPlan: roofPlan.length >= 3 ? roofPlan : outer,
    ridge,
    walls,
    piles: pileGrid(volume),
    footprintSqFt: areaOf(outer),
    eaveY: roof.eaveY,
    ridgeY: roof.ridgeY,
  };
}

/** Drawing model whose ink comes from the graph, not the recovery spec. */
export function buildHomeModelFromGraph(graph: BuildingGraph, spec: HomeSpec): HomeModel {
  const warnings: string[] = [
    "This set is drawn from the planar building graph, not from the frozen recovery HomeSpec.",
    "Elevations and the building section silhouette each storey as its axis-aligned bounding box. Openings are placed from world coordinates on the compass face they actually look toward.",
    "Wall heads are the storey eave. A gable rake is not yet cut from the roof zone.",
    "The graph has no deck record, so no deck is drawn.",
    "Clear interior dimensions on A3 are the storey bounding box minus wall thickness; they are not a room schedule.",
  ];

  /* A hip is drawn as a gable, because `RoofForm` has no hip and this set is
     inked through it. The end walls are therefore drawn full height where the
     graph cuts them away, which is the one place this translation reads
     GENEROUS rather than conservative — so it is named on the set rather than
     left for somebody to notice on site. Pushed only when a hip is actually
     present: a standing sentence about a roof nobody drew is noise, and noise
     is how a real caveat stops being read. */
  if (graph.storeys.some((storey) => storey.roofZones.some((zone) => roofFormIsApproximated(zone.form)))) {
    warnings.push(
      "A hipped roof zone is drawn as a gable: the drawing set has no hip, so the end walls " +
        "are shown at full height where the model cuts them back to the hip.",
    );
  }
  const wallT = wallThicknessFt(spec);
  const volumes = graph.storeys
    .map((storey) => volumeModelFromStorey(storey, wallT))
    .filter((item): item is VolumeModel => item !== null);

  if (volumes.length === 0) {
    warnings.push("This graph has no slab, so there is nothing to draw.");
  }

  const wallPolys = volumes.map((item) => item.outer);
  const roofPolys = volumes.map((item) => item.roofPlan);
  const glazedAreaSqFt = graph.storeys.reduce(
    (sum, storey) =>
      sum +
      storey.walls.reduce(
        (wallSum, wall) =>
          wallSum +
          wall.openings
            .filter((opening) => opening.kind !== "door")
            .reduce((openingSum, opening) => openingSum + opening.widthFt * opening.heightFt, 0),
        0,
      ),
    0,
  );
  const grossWallAreaSqFt = volumes.reduce(
    (sum, item) =>
      sum + item.walls.filter((wall) => wall.built).reduce((wallSum, wall) => wallSum + wall.runFt * item.volume.wallHeightFt, 0),
    0,
  );
  const groundElevation = Math.min(...graph.storeys.map((storey) => storey.elevationFt), 0);
  const groundFootprintSqFt = graph.storeys
    .filter((storey) => Math.abs(storey.elevationFt - groundElevation) <= EPS)
    .reduce((sum, storey) => {
      const slab = storey.slabs[0];
      return slab ? sum + areaOf(ringOf(storey, slab.boundaryVertexIds)) : sum;
    }, 0);

  return {
    spec,
    wallThicknessFt: wallT,
    partitionThicknessFt: partitionThicknessFt(),
    volumes,
    deck: null,
    bounds: boxOf(wallPolys),
    boundsWithRoof: boxOf(roofPolys.length ? roofPolys : wallPolys),
    totalFloorAreaSqFt: volumes.reduce((sum, item) => sum + item.footprintSqFt, 0),
    groundFootprintSqFt,
    glazedAreaSqFt,
    grossWallAreaSqFt,
    maxRidgeHeightFt: volumes.reduce((max, item) => Math.max(max, item.ridgeY), 0),
    wallRValue: WALL_R_VALUE[spec.material],
    warnings,
  };
}
