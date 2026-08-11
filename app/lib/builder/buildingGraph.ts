/**
 * Planar design-intent geometry for Aura Homes.
 *
 * Feet are explicit, ids are semantic and stable, and every mutation is
 * atomic: a candidate graph is validated before it can replace the caller's
 * graph. This module does not guess structure, code compliance, roof joins or
 * room use. It records editable planar intent from which those later views
 * can be derived consistently.
 */

import type { HomeSpec, Volume, Wall } from "./spec";

export const BUILDING_GRAPH_VERSION = 1 as const;
const EPS = 1e-8;

export type GraphPoint = readonly [xFt: number, zFt: number];
export type GraphWallKind = "external" | "partition";
export type GraphOpeningKind = "window" | "door" | "glazing-wall";
export type GraphRoofForm = "gable" | "shed" | "flat";

export interface GraphVertex {
  id: string;
  xFt: number;
  zFt: number;
}

export interface GraphOpening {
  id: string;
  kind: GraphOpeningKind;
  /** Distance from the wall's start vertex along its run. */
  offsetFt: number;
  widthFt: number;
  heightFt: number;
  sillFt: number;
}

export interface GraphWallEdge {
  id: string;
  startVertexId: string;
  endVertexId: string;
  kind: GraphWallKind;
  thicknessFt: number;
  openings: GraphOpening[];
}

export interface GraphDirectedEdge {
  wallId: string;
  forward: boolean;
}

export interface GraphRoomFace {
  id: string;
  name: string;
  boundary: GraphDirectedEdge[];
  areaSqft: number;
}

export interface GraphSlab {
  id: string;
  boundaryVertexIds: string[];
  voidIds: string[];
}

export interface GraphVoid {
  id: string;
  boundaryVertexIds: string[];
}

export interface GraphRoofZone {
  id: string;
  form: GraphRoofForm;
  boundaryVertexIds: string[];
  pitchDeg: number;
  /** Direction of downward fall in plan for a shed. */
  fallVector?: GraphPoint;
  /** Design-intent ridge for a gable, clipped to the footprint. */
  ridge?: { start: GraphPoint; end: GraphPoint };
}

export interface GraphStorey {
  id: string;
  name: string;
  elevationFt: number;
  heightFt: number;
  vertices: GraphVertex[];
  walls: GraphWallEdge[];
  rooms: GraphRoomFace[];
  slabs: GraphSlab[];
  voids: GraphVoid[];
  roofZones: GraphRoofZone[];
}

export interface BuildingGraph {
  kind: "building-graph";
  version: typeof BUILDING_GRAPH_VERSION;
  units: "feet";
  storeys: GraphStorey[];
}

export type BuildingGraphValidation =
  | { ok: true; graph: BuildingGraph }
  | { ok: false; problem: string };

export type GraphMutation =
  | { ok: true; graph: BuildingGraph }
  | { ok: false; problem: string; graph: BuildingGraph };

export type GraphFactoryResult =
  | { ok: true; graph: BuildingGraph }
  | { ok: false; problem: string };

export type RoofZoneResult =
  | { ok: true; zone: GraphRoofZone }
  | { ok: false; problem: string };

export type LegacyGraphConversion =
  | {
      ok: true;
      graph: BuildingGraph;
      /** Untouched source for recovery or a future higher-fidelity migration. */
      legacyRecovery: HomeSpec;
      warnings: string[];
    }
  | { ok: false; problem: string };

const finite = (value: number): boolean => Number.isFinite(value);
const pointOf = (vertex: GraphVertex): GraphPoint => [vertex.xFt, vertex.zFt];
const samePoint = (a: GraphPoint, b: GraphPoint): boolean =>
  Math.abs(a[0] - b[0]) <= EPS && Math.abs(a[1] - b[1]) <= EPS;
const cross = (a: GraphPoint, b: GraphPoint, c: GraphPoint): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const distance = (a: GraphPoint, b: GraphPoint): number =>
  Math.hypot(b[0] - a[0], b[1] - a[1]);

function polygonArea(points: readonly GraphPoint[]): number {
  let twice = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    twice += a[0] * b[1] - b[0] * a[1];
  }
  return twice / 2;
}

function pointOnSegment(point: GraphPoint, a: GraphPoint, b: GraphPoint): boolean {
  return (
    Math.abs(cross(a, b, point)) <= EPS &&
    point[0] >= Math.min(a[0], b[0]) - EPS &&
    point[0] <= Math.max(a[0], b[0]) + EPS &&
    point[1] >= Math.min(a[1], b[1]) - EPS &&
    point[1] <= Math.max(a[1], b[1]) + EPS
  );
}

function segmentsIntersect(a: GraphPoint, b: GraphPoint, c: GraphPoint, d: GraphPoint): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (
    ((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS)) &&
    ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS))
  ) {
    return true;
  }
  return (
    (Math.abs(abC) <= EPS && pointOnSegment(c, a, b)) ||
    (Math.abs(abD) <= EPS && pointOnSegment(d, a, b)) ||
    (Math.abs(cdA) <= EPS && pointOnSegment(a, c, d)) ||
    (Math.abs(cdB) <= EPS && pointOnSegment(b, c, d))
  );
}

function polygonSelfIntersects(points: readonly GraphPoint[]): boolean {
  for (let left = 0; left < points.length; left += 1) {
    const leftNext = (left + 1) % points.length;
    for (let right = left + 1; right < points.length; right += 1) {
      const rightNext = (right + 1) % points.length;
      if (left === right || leftNext === right || rightNext === left) continue;
      if (segmentsIntersect(points[left], points[leftNext], points[right], points[rightNext])) {
        return true;
      }
    }
  }
  return false;
}

function pointInPolygon(point: GraphPoint, polygon: readonly GraphPoint[]): boolean {
  if (polygon.some((a, index) => pointOnSegment(point, a, polygon[(index + 1) % polygon.length]))) {
    return true;
  }
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    const crosses =
      (a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function vertexMap(storey: GraphStorey): Map<string, GraphVertex> {
  return new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));
}

function wallLength(storey: GraphStorey, wall: GraphWallEdge): number {
  const vertices = vertexMap(storey);
  const start = vertices.get(wall.startVertexId);
  const end = vertices.get(wall.endVertexId);
  return start && end ? distance(pointOf(start), pointOf(end)) : Number.NaN;
}

interface HalfEdge extends GraphDirectedEdge {
  from: string;
  to: string;
  angle: number;
}

const halfKey = (edge: GraphDirectedEdge): string => `${edge.wallId}:${edge.forward ? "f" : "r"}`;
const boundaryKey = (boundary: readonly GraphDirectedEdge[]): string =>
  boundary.map((edge) => edge.wallId).sort().join("|");
const directedCycleKey = (boundary: readonly GraphDirectedEdge[]): string => {
  const tokens = boundary.map(halfKey);
  if (tokens.length === 0) return "";
  let best = tokens.join("|");
  for (let offset = 1; offset < tokens.length; offset += 1) {
    const rotated = [...tokens.slice(offset), ...tokens.slice(0, offset)].join("|");
    if (rotated < best) best = rotated;
  }
  return best;
};

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Derive bounded faces from the planar half-edge embedding. */
export function deriveRoomFaces(
  storey: GraphStorey,
  previous: readonly GraphRoomFace[] = storey.rooms,
): GraphRoomFace[] {
  const vertices = vertexMap(storey);
  const outgoing = new Map<string, HalfEdge[]>();
  const add = (edge: HalfEdge) => {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  };
  for (const wall of storey.walls) {
    const start = vertices.get(wall.startVertexId);
    const end = vertices.get(wall.endVertexId);
    if (!start || !end) continue;
    add({
      wallId: wall.id,
      forward: true,
      from: start.id,
      to: end.id,
      angle: Math.atan2(end.zFt - start.zFt, end.xFt - start.xFt),
    });
    add({
      wallId: wall.id,
      forward: false,
      from: end.id,
      to: start.id,
      angle: Math.atan2(start.zFt - end.zFt, start.xFt - end.xFt),
    });
  }
  outgoing.forEach((list) => {
    list.sort((a, b) => a.angle - b.angle || halfKey(a).localeCompare(halfKey(b)));
  });

  const visited = new Set<string>();
  const faces: Array<{ boundary: GraphDirectedEdge[]; area: number; centroid: GraphPoint }> = [];
  for (const wall of storey.walls) {
    for (const seed of [
      { wallId: wall.id, forward: true },
      { wallId: wall.id, forward: false },
    ] as const) {
      if (visited.has(halfKey(seed))) continue;
      const boundary: GraphDirectedEdge[] = [];
      const points: GraphPoint[] = [];
      let current: GraphDirectedEdge = seed;
      const guard = storey.walls.length * 2 + 1;
      for (let step = 0; step < guard; step += 1) {
        const key = halfKey(current);
        if (visited.has(key)) break;
        visited.add(key);
        boundary.push(current);
        const currentWall = storey.walls.find((item) => item.id === current.wallId);
        if (!currentWall) break;
        const fromId = current.forward ? currentWall.startVertexId : currentWall.endVertexId;
        const toId = current.forward ? currentWall.endVertexId : currentWall.startVertexId;
        const from = vertices.get(fromId);
        if (!from) break;
        points.push(pointOf(from));
        const at = outgoing.get(toId) ?? [];
        const reverseIndex = at.findIndex(
          (candidate) => candidate.wallId === current.wallId && candidate.forward !== current.forward,
        );
        if (reverseIndex < 0 || at.length === 0) break;
        const next = at[(reverseIndex - 1 + at.length) % at.length];
        current = { wallId: next.wallId, forward: next.forward };
        if (halfKey(current) === halfKey(seed)) break;
      }
      const area = polygonArea(points);
      if (boundary.length >= 3 && area > EPS) {
        faces.push({
          boundary,
          area,
          centroid: [
            points.reduce((sum, point) => sum + point[0], 0) / points.length,
            points.reduce((sum, point) => sum + point[1], 0) / points.length,
          ],
        });
      }
    }
  }

  faces.sort(
    (a, b) =>
      a.centroid[0] - b.centroid[0] ||
      a.centroid[1] - b.centroid[1] ||
      boundaryKey(a.boundary).localeCompare(boundaryKey(b.boundary)),
  );
  const prior = new Map(previous.map((room) => [boundaryKey(room.boundary), room]));
  return faces.map((face, index) => {
    const key = boundaryKey(face.boundary);
    const existing = prior.get(key);
    return {
      id: existing?.id ?? `room-${stableHash(`${storey.id}|${key}`)}`,
      name: existing?.name ?? `Room ${index + 1}`,
      boundary: face.boundary,
      areaSqft: Math.round(face.area * 1e6) / 1e6,
    };
  });
}

function graphWithStorey(graph: BuildingGraph, storey: GraphStorey): BuildingGraph {
  return {
    ...graph,
    storeys: graph.storeys.map((item) => (item.id === storey.id ? storey : item)),
  };
}

function fail(graph: BuildingGraph, problem: string): GraphMutation {
  return { ok: false, graph, problem };
}

function wallIntersectionProblem(storey: GraphStorey): string | null {
  const vertices = vertexMap(storey);
  for (let left = 0; left < storey.walls.length; left += 1) {
    const aWall = storey.walls[left];
    const a = vertices.get(aWall.startVertexId);
    const b = vertices.get(aWall.endVertexId);
    if (!a || !b) continue;
    for (let right = left + 1; right < storey.walls.length; right += 1) {
      const bWall = storey.walls[right];
      const c = vertices.get(bWall.startVertexId);
      const d = vertices.get(bWall.endVertexId);
      if (!c || !d) continue;
      const shared = [a.id, b.id].filter((id) => id === c.id || id === d.id);
      if (!segmentsIntersect(pointOf(a), pointOf(b), pointOf(c), pointOf(d))) continue;
      if (shared.length === 1) {
        const sharedPoint = pointOf(vertices.get(shared[0])!);
        const otherA = samePoint(pointOf(a), sharedPoint) ? pointOf(b) : pointOf(a);
        const otherB = samePoint(pointOf(c), sharedPoint) ? pointOf(d) : pointOf(c);
        if (Math.abs(cross(sharedPoint, otherA, otherB)) > EPS) continue;
        const dot =
          (otherA[0] - sharedPoint[0]) * (otherB[0] - sharedPoint[0]) +
          (otherA[1] - sharedPoint[1]) * (otherB[1] - sharedPoint[1]);
        if (dot <= EPS) continue;
      }
      return `Walls ${aWall.id} and ${bWall.id} intersect without a shared planar vertex.`;
    }
  }
  return null;
}

export function validateBuildingGraph(value: BuildingGraph): BuildingGraphValidation {
  if (!value || value.kind !== "building-graph" || value.version !== BUILDING_GRAPH_VERSION)
    return { ok: false, problem: "Building graph format or version is unsupported." };
  if (value.units !== "feet") return { ok: false, problem: "Building graph units must be feet." };
  if (!Array.isArray(value.storeys) || value.storeys.length === 0)
    return { ok: false, problem: "Building graph has no storey." };

  const globalIds = new Set<string>();
  for (const storey of value.storeys) {
    if (!storey.id || globalIds.has(storey.id))
      return { ok: false, problem: `Duplicate or empty storey id ${storey.id}.` };
    globalIds.add(storey.id);
    if (!finite(storey.elevationFt) || !finite(storey.heightFt) || storey.heightFt <= 0)
      return { ok: false, problem: `Storey ${storey.id} has invalid elevation or height.` };
    const vertices = vertexMap(storey);
    if (vertices.size !== storey.vertices.length)
      return { ok: false, problem: `Storey ${storey.id} has duplicate vertex ids.` };
    for (const vertex of storey.vertices) {
      if (!vertex.id || !finite(vertex.xFt) || !finite(vertex.zFt))
        return { ok: false, problem: `Storey ${storey.id} has an invalid vertex.` };
      if (globalIds.has(vertex.id)) return { ok: false, problem: `Duplicate graph id ${vertex.id}.` };
      globalIds.add(vertex.id);
    }
    for (let left = 0; left < storey.vertices.length; left += 1) {
      for (let right = left + 1; right < storey.vertices.length; right += 1) {
        if (samePoint(pointOf(storey.vertices[left]), pointOf(storey.vertices[right]))) {
          return { ok: false, problem: `Vertices ${storey.vertices[left].id} and ${storey.vertices[right].id} occupy the same point.` };
        }
      }
    }
    const undirected = new Set<string>();
    const openingIds = new Set<string>();
    for (const wall of storey.walls) {
      if (!wall.id || globalIds.has(wall.id)) return { ok: false, problem: `Duplicate graph id ${wall.id}.` };
      globalIds.add(wall.id);
      const start = vertices.get(wall.startVertexId);
      const end = vertices.get(wall.endVertexId);
      if (!start || !end) return { ok: false, problem: `Wall ${wall.id} references a missing vertex.` };
      const length = distance(pointOf(start), pointOf(end));
      if (length <= EPS) return { ok: false, problem: `Wall ${wall.id} has zero length.` };
      if (wall.kind !== "external" && wall.kind !== "partition")
        return { ok: false, problem: `Wall ${wall.id} has an unsupported kind.` };
      if (!finite(wall.thicknessFt) || wall.thicknessFt <= 0)
        return { ok: false, problem: `Wall ${wall.id} has invalid thickness.` };
      const edgeKey = [start.id, end.id].sort().join("|");
      if (undirected.has(edgeKey)) return { ok: false, problem: `Duplicate wall edge ${edgeKey}.` };
      undirected.add(edgeKey);
      const sortedOpenings = [...wall.openings].sort((a, b) => a.offsetFt - b.offsetFt);
      for (let index = 0; index < sortedOpenings.length; index += 1) {
        const opening = sortedOpenings[index];
        if (!opening.id || openingIds.has(opening.id) || globalIds.has(opening.id))
          return { ok: false, problem: `Duplicate or empty opening id ${opening.id}.` };
        openingIds.add(opening.id);
        globalIds.add(opening.id);
        if (
          !["window", "door", "glazing-wall"].includes(opening.kind) ||
          !finite(opening.offsetFt) ||
          !finite(opening.widthFt) ||
          !finite(opening.heightFt) ||
          !finite(opening.sillFt) ||
          opening.offsetFt < -EPS ||
          opening.widthFt <= 0 ||
          opening.heightFt <= 0 ||
          opening.sillFt < 0 ||
          opening.offsetFt + opening.widthFt > length + EPS
        ) {
          return { ok: false, problem: `Opening ${opening.id} does not fit wall ${wall.id}.` };
        }
        const previous = sortedOpenings[index - 1];
        if (previous && previous.offsetFt + previous.widthFt > opening.offsetFt + EPS)
          return { ok: false, problem: `Openings ${previous.id} and ${opening.id} overlap.` };
      }
    }
    const intersection = wallIntersectionProblem(storey);
    if (intersection) return { ok: false, problem: intersection };

    for (const slab of storey.slabs) {
      if (!slab.id || globalIds.has(slab.id)) return { ok: false, problem: `Duplicate graph id ${slab.id}.` };
      globalIds.add(slab.id);
      if (slab.boundaryVertexIds.length < 3 || slab.boundaryVertexIds.some((id) => !vertices.has(id)))
        return { ok: false, problem: `Slab ${slab.id} has an invalid boundary.` };
      const points = slab.boundaryVertexIds.map((id) => pointOf(vertices.get(id)!));
      if (Math.abs(polygonArea(points)) <= EPS || polygonSelfIntersects(points))
        return { ok: false, problem: `Slab ${slab.id} boundary is self-intersecting or empty.` };
    }
    const voidIds = new Set<string>();
    for (const voidFace of storey.voids) {
      if (!voidFace.id || globalIds.has(voidFace.id) || voidIds.has(voidFace.id))
        return { ok: false, problem: `Duplicate or empty void id ${voidFace.id}.` };
      globalIds.add(voidFace.id);
      voidIds.add(voidFace.id);
      if (
        voidFace.boundaryVertexIds.length < 3 ||
        voidFace.boundaryVertexIds.some((id) => !vertices.has(id))
      ) {
        return { ok: false, problem: `Void ${voidFace.id} has an invalid boundary.` };
      }
      const points = voidFace.boundaryVertexIds.map((id) => pointOf(vertices.get(id)!));
      if (Math.abs(polygonArea(points)) <= EPS || polygonSelfIntersects(points))
        return { ok: false, problem: `Void ${voidFace.id} boundary is self-intersecting or empty.` };
    }
    for (const slab of storey.slabs) {
      if (slab.voidIds.some((id) => !voidIds.has(id)))
        return { ok: false, problem: `Slab ${slab.id} references a missing void.` };
    }

    for (const roof of storey.roofZones) {
      if (!roof.id || globalIds.has(roof.id)) return { ok: false, problem: `Duplicate graph id ${roof.id}.` };
      globalIds.add(roof.id);
      if (
        !["gable", "shed", "flat"].includes(roof.form) ||
        !finite(roof.pitchDeg) ||
        roof.pitchDeg < 0 ||
        roof.boundaryVertexIds.length < 3 ||
        roof.boundaryVertexIds.some((id) => !vertices.has(id))
      ) {
        return { ok: false, problem: `Roof zone ${roof.id} is invalid.` };
      }
      if (
        roof.fallVector &&
        (!finite(roof.fallVector[0]) || !finite(roof.fallVector[1]) || distance([0, 0], roof.fallVector) <= EPS)
      ) {
        return { ok: false, problem: `Roof zone ${roof.id} has an invalid fall vector.` };
      }
      if (
        roof.ridge &&
        (!finite(roof.ridge.start[0]) ||
          !finite(roof.ridge.start[1]) ||
          !finite(roof.ridge.end[0]) ||
          !finite(roof.ridge.end[1]) ||
          samePoint(roof.ridge.start, roof.ridge.end))
      ) {
        return { ok: false, problem: `Roof zone ${roof.id} has an invalid ridge.` };
      }
    }

    const derived = deriveRoomFaces(storey, storey.rooms);
    if (derived.length !== storey.rooms.length)
      return { ok: false, problem: `Storey ${storey.id} room faces are stale or incomplete.` };
    for (const room of storey.rooms) {
      const match = derived.find((candidate) => boundaryKey(candidate.boundary) === boundaryKey(room.boundary));
      if (
        !match ||
        !finite(room.areaSqft) ||
        room.areaSqft <= 0 ||
        directedCycleKey(match.boundary) !== directedCycleKey(room.boundary) ||
        Math.abs(match.areaSqft - room.areaSqft) > 1e-6
      )
        return { ok: false, problem: `Room ${room.id} is not an exact face of the wall graph.` };
      if (globalIds.has(room.id)) return { ok: false, problem: `Duplicate graph id ${room.id}.` };
      globalIds.add(room.id);
    }
  }
  return { ok: true, graph: value };
}

export function singleStoreyGraphFromPolygon(
  input: readonly GraphPoint[],
  options: { storeyId?: string; heightFt?: number; wallThicknessFt?: number } = {},
): GraphFactoryResult {
  const points = input.map((point): GraphPoint => [point[0], point[1]]);
  if (points.length > 1 && samePoint(points[0], points[points.length - 1])) points.pop();
  if (points.length < 3) return { ok: false, problem: "A footprint needs at least three vertices." };
  if (points.some((point) => !finite(point[0]) || !finite(point[1])))
    return { ok: false, problem: "Footprint coordinates must be finite." };
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      if (samePoint(points[left], points[right]))
        return { ok: false, problem: "A footprint cannot repeat a vertex." };
    }
  }
  if (polygonSelfIntersects(points))
    return { ok: false, problem: "The footprint is self-intersecting." };
  const signedArea = polygonArea(points);
  if (Math.abs(signedArea) <= EPS) return { ok: false, problem: "The footprint has no area." };
  if (signedArea < 0) points.reverse();

  const storeyId = options.storeyId ?? "storey-1";
  const vertices = points.map((point, index): GraphVertex => ({
    id: `vertex-${index + 1}`,
    xFt: point[0],
    zFt: point[1],
  }));
  const walls = vertices.map((vertex, index): GraphWallEdge => ({
    id: `wall-${index + 1}`,
    startVertexId: vertex.id,
    endVertexId: vertices[(index + 1) % vertices.length].id,
    kind: "external",
    thicknessFt: options.wallThicknessFt ?? 0.5,
    openings: [],
  }));
  let storey: GraphStorey = {
    id: storeyId,
    name: "Ground floor",
    elevationFt: 0,
    heightFt: options.heightFt ?? 9.5,
    vertices,
    walls,
    rooms: [],
    slabs: [{ id: "slab-1", boundaryVertexIds: vertices.map((vertex) => vertex.id), voidIds: [] }],
    voids: [],
    roofZones: [],
  };
  storey = { ...storey, rooms: deriveRoomFaces(storey, []) };
  const graph: BuildingGraph = {
    kind: "building-graph",
    version: BUILDING_GRAPH_VERSION,
    units: "feet",
    storeys: [storey],
  };
  const checked = validateBuildingGraph(graph);
  return checked.ok ? { ok: true, graph } : checked;
}

export function moveGraphVertex(
  graph: BuildingGraph,
  storeyId: string,
  vertexId: string,
  point: GraphPoint,
  snapFt = 0,
): GraphMutation {
  const storey = graph.storeys.find((item) => item.id === storeyId);
  if (!storey) return fail(graph, `Storey ${storeyId} does not exist.`);
  if (!storey.vertices.some((vertex) => vertex.id === vertexId))
    return fail(graph, `Vertex ${vertexId} does not exist.`);
  if (!finite(point[0]) || !finite(point[1])) return fail(graph, "Vertex coordinates must be finite.");
  const snap = (value: number): number =>
    snapFt > EPS ? Math.round(value / snapFt) * snapFt : value;
  const vertices = storey.vertices.map((vertex) =>
    vertex.id === vertexId ? { ...vertex, xFt: snap(point[0]), zFt: snap(point[1]) } : vertex,
  );
  let candidateStorey = { ...storey, vertices };
  candidateStorey = { ...candidateStorey, rooms: deriveRoomFaces(candidateStorey, storey.rooms) };
  const candidate = graphWithStorey(graph, candidateStorey);
  const checked = validateBuildingGraph(candidate);
  return checked.ok ? { ok: true, graph: candidate } : fail(graph, checked.problem);
}

function insertBoundaryVertex(ids: readonly string[], start: string, end: string, inserted: string): string[] {
  const out: string[] = [];
  for (let index = 0; index < ids.length; index += 1) {
    const current = ids[index];
    const next = ids[(index + 1) % ids.length];
    out.push(current);
    if ((current === start && next === end) || (current === end && next === start)) out.push(inserted);
  }
  return out;
}

export function splitWallAt(
  graph: BuildingGraph,
  storeyId: string,
  wallId: string,
  distanceFromStartFt: number,
  vertexId: string,
): GraphMutation {
  const storey = graph.storeys.find((item) => item.id === storeyId);
  if (!storey) return fail(graph, `Storey ${storeyId} does not exist.`);
  const wallIndex = storey.walls.findIndex((wall) => wall.id === wallId);
  const wall = storey.walls[wallIndex];
  if (!wall) return fail(graph, `Wall ${wallId} does not exist.`);
  if (!vertexId || storey.vertices.some((vertex) => vertex.id === vertexId))
    return fail(graph, `Vertex id ${vertexId} is empty or already exists.`);
  const length = wallLength(storey, wall);
  if (!finite(distanceFromStartFt) || distanceFromStartFt <= EPS || distanceFromStartFt >= length - EPS)
    return fail(graph, `Wall split must be strictly inside ${wallId}.`);

  const firstOpenings: GraphOpening[] = [];
  const secondOpenings: GraphOpening[] = [];
  for (const opening of wall.openings) {
    const end = opening.offsetFt + opening.widthFt;
    if (end <= distanceFromStartFt + EPS) firstOpenings.push(opening);
    else if (opening.offsetFt >= distanceFromStartFt - EPS) {
      secondOpenings.push({ ...opening, offsetFt: opening.offsetFt - distanceFromStartFt });
    } else {
      return fail(
        graph,
        `Opening ${opening.id} crosses the proposed split on ${wallId}; move the split or the opening.`,
      );
    }
  }

  const verticesById = vertexMap(storey);
  const start = verticesById.get(wall.startVertexId)!;
  const end = verticesById.get(wall.endVertexId)!;
  const ratio = distanceFromStartFt / length;
  const inserted: GraphVertex = {
    id: vertexId,
    xFt: start.xFt + (end.xFt - start.xFt) * ratio,
    zFt: start.zFt + (end.zFt - start.zFt) * ratio,
  };
  let secondWallId = `${wall.id}-split-${vertexId}`;
  let suffix = 2;
  while (storey.walls.some((item) => item.id === secondWallId)) {
    secondWallId = `${wall.id}-split-${vertexId}-${suffix}`;
    suffix += 1;
  }
  const firstWall: GraphWallEdge = {
    ...wall,
    endVertexId: vertexId,
    openings: firstOpenings,
  };
  const secondWall: GraphWallEdge = {
    ...wall,
    id: secondWallId,
    startVertexId: vertexId,
    openings: secondOpenings,
  };
  const walls = [...storey.walls];
  walls.splice(wallIndex, 1, firstWall, secondWall);
  let candidateStorey: GraphStorey = {
    ...storey,
    vertices: [...storey.vertices, inserted],
    walls,
    slabs: storey.slabs.map((slab) => ({
      ...slab,
      boundaryVertexIds: insertBoundaryVertex(
        slab.boundaryVertexIds,
        wall.startVertexId,
        wall.endVertexId,
        vertexId,
      ),
    })),
    voids: storey.voids.map((voidFace) => ({
      ...voidFace,
      boundaryVertexIds: insertBoundaryVertex(
        voidFace.boundaryVertexIds,
        wall.startVertexId,
        wall.endVertexId,
        vertexId,
      ),
    })),
    roofZones: storey.roofZones.map((zone) => ({
      ...zone,
      boundaryVertexIds: insertBoundaryVertex(
        zone.boundaryVertexIds,
        wall.startVertexId,
        wall.endVertexId,
        vertexId,
      ),
    })),
  };
  candidateStorey = { ...candidateStorey, rooms: deriveRoomFaces(candidateStorey, storey.rooms) };
  const candidate = graphWithStorey(graph, candidateStorey);
  const checked = validateBuildingGraph(candidate);
  return checked.ok ? { ok: true, graph: candidate } : fail(graph, checked.problem);
}

export function addPartitionEdge(
  graph: BuildingGraph,
  storeyId: string,
  wallId: string,
  startVertexId: string,
  endVertexId: string,
  thicknessFt = 0.4,
): GraphMutation {
  const storey = graph.storeys.find((item) => item.id === storeyId);
  if (!storey) return fail(graph, `Storey ${storeyId} does not exist.`);
  const vertices = vertexMap(storey);
  const start = vertices.get(startVertexId);
  const end = vertices.get(endVertexId);
  if (!wallId || storey.walls.some((wall) => wall.id === wallId))
    return fail(graph, `Partition id ${wallId} is empty or already exists.`);
  if (!start || !end || start.id === end.id) return fail(graph, "Partition endpoints must be distinct graph vertices.");
  if (!finite(thicknessFt) || thicknessFt <= 0) return fail(graph, "Partition thickness must be positive.");
  const footprint = storey.slabs[0]?.boundaryVertexIds.map((id) => pointOf(vertices.get(id)!)) ?? [];
  for (const fraction of [0.25, 0.5, 0.75]) {
    const sample: GraphPoint = [
      start.xFt + (end.xFt - start.xFt) * fraction,
      start.zFt + (end.zFt - start.zFt) * fraction,
    ];
    if (!pointInPolygon(sample, footprint))
      return fail(graph, `Partition ${wallId} leaves the storey footprint.`);
  }
  let candidateStorey: GraphStorey = {
    ...storey,
    walls: [
      ...storey.walls,
      {
        id: wallId,
        startVertexId,
        endVertexId,
        kind: "partition",
        thicknessFt,
        openings: [],
      },
    ],
  };
  const rooms = deriveRoomFaces(candidateStorey, storey.rooms);
  if (rooms.length !== storey.rooms.length + 1)
    return fail(graph, `Partition ${wallId} does not divide exactly one existing room.`);
  candidateStorey = { ...candidateStorey, rooms };
  const candidate = graphWithStorey(graph, candidateStorey);
  const checked = validateBuildingGraph(candidate);
  return checked.ok ? { ok: true, graph: candidate } : fail(graph, checked.problem);
}

export function addGraphOpening(
  graph: BuildingGraph,
  storeyId: string,
  wallId: string,
  opening: GraphOpening,
): GraphMutation {
  const storey = graph.storeys.find((item) => item.id === storeyId);
  if (!storey) return fail(graph, `Storey ${storeyId} does not exist.`);
  const wall = storey.walls.find((item) => item.id === wallId);
  if (!wall) return fail(graph, `Wall ${wallId} does not exist.`);
  if (storey.walls.some((item) => item.openings.some((candidate) => candidate.id === opening.id)))
    return fail(graph, `Opening id ${opening.id} already exists.`);
  const candidateStorey = {
    ...storey,
    walls: storey.walls.map((item) =>
      item.id === wallId ? { ...item, openings: [...item.openings, { ...opening }] } : item,
    ),
  };
  const candidate = graphWithStorey(graph, candidateStorey);
  const checked = validateBuildingGraph(candidate);
  return checked.ok ? { ok: true, graph: candidate } : fail(graph, checked.problem);
}

function polygonCentroid(points: readonly GraphPoint[]): GraphPoint {
  let crossSum = 0;
  let x = 0;
  let z = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const term = a[0] * b[1] - b[0] * a[1];
    crossSum += term;
    x += (a[0] + b[0]) * term;
    z += (a[1] + b[1]) * term;
  }
  return [x / (3 * crossSum), z / (3 * crossSum)];
}

function linePolygonIntersections(
  origin: GraphPoint,
  direction: GraphPoint,
  polygon: readonly GraphPoint[],
): Array<{ point: GraphPoint; t: number }> {
  const found: Array<{ point: GraphPoint; t: number }> = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const edge: GraphPoint = [b[0] - a[0], b[1] - a[1]];
    const denominator = direction[0] * edge[1] - direction[1] * edge[0];
    if (Math.abs(denominator) <= EPS) continue;
    const delta: GraphPoint = [a[0] - origin[0], a[1] - origin[1]];
    const t = (delta[0] * edge[1] - delta[1] * edge[0]) / denominator;
    const u = (delta[0] * direction[1] - delta[1] * direction[0]) / denominator;
    if (u < -EPS || u > 1 + EPS) continue;
    const point: GraphPoint = [origin[0] + direction[0] * t, origin[1] + direction[1] * t];
    if (!found.some((item) => samePoint(item.point, point))) found.push({ point, t });
  }
  return found.sort((a, b) => a.t - b.t);
}

export function deriveRoofZone(
  storey: GraphStorey,
  form: GraphRoofForm,
  pitchDeg: number,
): RoofZoneResult {
  const vertices = vertexMap(storey);
  const boundaryIds = storey.slabs[0]?.boundaryVertexIds ?? [];
  const polygon = boundaryIds.map((id) => vertices.get(id)).filter((value): value is GraphVertex => !!value).map(pointOf);
  if (polygon.length < 3) return { ok: false, problem: "A roof zone needs a valid slab boundary." };
  if (!finite(pitchDeg) || pitchDeg < 0 || (form !== "flat" && pitchDeg <= 0))
    return { ok: false, problem: `${form} roof pitch must be ${form === "flat" ? "zero or positive" : "positive"}.` };
  const base: GraphRoofZone = {
    id: `roof-${storey.id}-${form}`,
    form,
    boundaryVertexIds: [...boundaryIds],
    pitchDeg,
  };
  if (form === "flat") return { ok: true, zone: base };

  const external = storey.walls
    .filter((wall) => wall.kind === "external")
    .map((wall) => ({ wall, length: wallLength(storey, wall) }))
    .sort((a, b) => b.length - a.length || a.wall.id.localeCompare(b.wall.id));
  const longest = external[0]?.wall;
  if (!longest) return { ok: false, problem: "A pitched roof needs an external wall direction." };
  const start = vertices.get(longest.startVertexId)!;
  const end = vertices.get(longest.endVertexId)!;
  const run = distance(pointOf(start), pointOf(end));
  const direction: GraphPoint = [(end.xFt - start.xFt) / run, (end.zFt - start.zFt) / run];
  const cleanZero = (value: number): number => (Math.abs(value) <= EPS ? 0 : value);
  const fallVector: GraphPoint = [cleanZero(-direction[1]), cleanZero(direction[0])];
  if (form === "shed") return { ok: true, zone: { ...base, fallVector } };

  const intersections = linePolygonIntersections(polygonCentroid(polygon), direction, polygon);
  if (intersections.length !== 2) {
    return {
      ok: false,
      problem:
        "A single deterministic gable ridge does not fit this concave footprint. Define explicit roof zones instead of inventing joins.",
    };
  }
  return {
    ok: true,
    zone: {
      ...base,
      ridge: { start: intersections[0].point, end: intersections[1].point },
    },
  };
}

const LEGACY_WALL_ORDER: readonly Wall[] = ["n", "e", "s", "w"];

function legacyVolumeCorners(volume: Volume): GraphPoint[] {
  const radians = (-volume.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const halfWidth = volume.widthFt / 2;
  const halfDepth = volume.depthFt / 2;
  return [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ].map(([x, z]): GraphPoint => [
    volume.x + x * cosine + z * sine,
    volume.z - x * sine + z * cosine,
  ]);
}

/**
 * Loss-aware bridge from Claude-era rotated rectangles into one ground-floor
 * planar graph. It refuses multi-storey volumes because flattening them would
 * erase intermediate plates. The original HomeSpec always rides beside a
 * successful conversion for recovery.
 */
export function legacySpecToBuildingGraph(
  spec: HomeSpec,
  wallThicknessFt: number,
): LegacyGraphConversion {
  if (!finite(wallThicknessFt) || wallThicknessFt <= 0)
    return { ok: false, problem: "Legacy conversion needs a positive wall thickness." };
  if (spec.volumes.length === 0)
    return { ok: false, problem: "The legacy design has no volume to convert." };
  if (spec.volumes.some((volume) => volume.storeys !== 1)) {
    return {
      ok: false,
      problem:
        "This legacy design contains multi-storey intent. Conversion is refused until intermediate floor plates, stairs and openings can be preserved.",
    };
  }

  const warnings: string[] = [];
  if (spec.deck) {
    warnings.push(
      "The legacy deck remains in the recovery HomeSpec; deck topology is not yet part of BuildingGraph v1.",
    );
  }
  const heights = new Set(spec.volumes.map((volume) => volume.wallHeightFt));
  if (heights.size > 1) {
    warnings.push(
      "Legacy volumes had different wall heights. BuildingGraph v1 uses the tallest height for this storey and preserves every original height in the recovery HomeSpec.",
    );
  }

  const vertices: GraphVertex[] = [];
  const walls: GraphWallEdge[] = [];
  const slabs: GraphSlab[] = [];
  const roofZones: GraphRoofZone[] = [];
  for (const volume of spec.volumes) {
    const corners = legacyVolumeCorners(volume);
    const volumeVertices = corners.map((point, index): GraphVertex => ({
      id: `vol:${volume.id}:vertex:${index + 1}`,
      xFt: Math.abs(point[0]) <= EPS ? 0 : point[0],
      zFt: Math.abs(point[1]) <= EPS ? 0 : point[1],
    }));
    vertices.push(...volumeVertices);
    const volumeWalls = LEGACY_WALL_ORDER.map((legacyWall, index): GraphWallEdge => {
      const start = corners[index];
      const end = corners[(index + 1) % corners.length];
      const fullLength = distance(start, end);
      const endInset = legacyWall === "e" || legacyWall === "w" ? wallThicknessFt : 0;
      const openings = volume.openings
        .filter((opening) => opening.wall === legacyWall)
        .map((opening): GraphOpening => ({
          id: `vol:${volume.id}:opening:${opening.id}`,
          kind: opening.kind,
          // HomeSpec offsets run from outside-left; the CCW graph edge runs
          // the other way on all four faces.
          offsetFt: fullLength - endInset - opening.offsetFt - opening.widthFt,
          widthFt: opening.widthFt,
          heightFt: opening.heightFt,
          sillFt: opening.sillFt,
        }));
      return {
        id: `vol:${volume.id}:wall:${legacyWall}`,
        startVertexId: volumeVertices[index].id,
        endVertexId: volumeVertices[(index + 1) % volumeVertices.length].id,
        kind: "external",
        thicknessFt: wallThicknessFt,
        openings,
      };
    });
    walls.push(...volumeWalls);
    const slab: GraphSlab = {
      id: `vol:${volume.id}:slab:1`,
      boundaryVertexIds: volumeVertices.map((vertex) => vertex.id),
      voidIds: [],
    };
    slabs.push(slab);

    if (["gable", "shed", "flat"].includes(volume.roof.form)) {
      const roofStorey: GraphStorey = {
        id: `roof-source:${volume.id}`,
        name: volume.name,
        elevationFt: 0,
        heightFt: volume.wallHeightFt,
        vertices: volumeVertices,
        walls: volumeWalls,
        rooms: [],
        slabs: [slab],
        voids: [],
        roofZones: [],
      };
      const roof = deriveRoofZone(
        roofStorey,
        volume.roof.form as GraphRoofForm,
        volume.roof.pitchDeg,
      );
      if (roof.ok) roofZones.push({ ...roof.zone, id: `vol:${volume.id}:roof:1` });
      else warnings.push(`${volume.name}: ${roof.problem}`);
    } else {
      warnings.push(
        `${volume.name}: ${volume.roof.form} roof intent remains only in the recovery HomeSpec until an explicit planar roof zone can preserve it.`,
      );
    }
  }

  let storey: GraphStorey = {
    id: "storey-1",
    name: "Ground floor",
    elevationFt: 0,
    heightFt: Math.max(...spec.volumes.map((volume) => volume.wallHeightFt)),
    vertices,
    walls,
    rooms: [],
    slabs,
    voids: [],
    roofZones,
  };
  storey = { ...storey, rooms: deriveRoomFaces(storey, []) };
  storey = {
    ...storey,
    rooms: storey.rooms.map((room) => {
      const volume = spec.volumes.find((candidate) =>
        room.boundary.every((edge) => edge.wallId.startsWith(`vol:${candidate.id}:wall:`)),
      );
      return volume ? { ...room, name: volume.name } : room;
    }),
  };
  const graph: BuildingGraph = {
    kind: "building-graph",
    version: BUILDING_GRAPH_VERSION,
    units: "feet",
    storeys: [storey],
  };
  const checked = validateBuildingGraph(graph);
  if (!checked.ok) {
    return {
      ok: false,
      problem:
        `The legacy rectangles cannot be represented as one planar graph without repair: ${checked.problem} ` +
        "The source HomeSpec was not changed.",
    };
  }
  return {
    ok: true,
    graph,
    legacyRecovery: JSON.parse(JSON.stringify(spec)) as HomeSpec,
    warnings,
  };
}
