/* ===========================================================================
   EX03 / B16 — fixture hosts from a BuildingGraph.

   THE LIE THIS FILE EXISTS NOT TO TELL. After conversion, `document.spec` is
   a frozen recovery copy. Snapping a stove against those volumes would seat
   it on a house that is no longer on screen. Conversion already quarantines
   every legacy fixture for that reason.

   WHAT THIS DOES. Each graph storey becomes one rectangular HomeSpec volume
   whose id IS the storey id, whose plan is the slab's axis-aligned box, and
   whose walls are the four compass faces of that box. Existing snap, add and
   resolve functions then work unchanged. The share codec does not grow a
   third host kind.

   WHAT IS STILL A TRANSLATION, NAMED IN THE PALETTE. The floor clip is the
   storey bounding box, not the slab polygon. Wall fixtures snap to the box
   faces, not to an angled graph edge. There is no graph deck.
   =========================================================================== */

import type { BuildingGraph, GraphStorey } from "./buildingGraph";
import type { BuilderDocument } from "./document";
import type { HomeSpec, Opening, Volume, Wall } from "./spec";

const EPS = 1e-9;

const verticesOf = (storey: GraphStorey) =>
  new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));

function slabBox(storey: GraphStorey): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} | null {
  const slab = storey.slabs[0];
  if (!slab) return null;
  const vertices = verticesOf(storey);
  const xs: number[] = [];
  const zs: number[] = [];
  for (const id of slab.boundaryVertexIds) {
    const vertex = vertices.get(id);
    if (!vertex) continue;
    xs.push(vertex.xFt);
    zs.push(vertex.zFt);
  }
  if (xs.length < 3) return null;
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

function nearestCompass(nx: number, nz: number): Wall {
  if (Math.abs(nz) >= Math.abs(nx)) return nz < 0 ? "n" : "s";
  return nx >= 0 ? "e" : "w";
}

function openingsOnBox(storey: GraphStorey, box: NonNullable<ReturnType<typeof slabBox>>): Opening[] {
  const vertices = verticesOf(storey);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const openings: Opening[] = [];
  for (const wall of storey.walls) {
    if (wall.kind !== "external") continue;
    const start = vertices.get(wall.startVertexId);
    const end = vertices.get(wall.endVertexId);
    if (!start || !end) continue;
    const dx = end.xFt - start.xFt;
    const dz = end.zFt - start.zFt;
    const run = Math.hypot(dx, dz);
    if (run <= EPS) continue;
    const midX = (start.xFt + end.xFt) / 2;
    const midZ = (start.zFt + end.zFt) / 2;
    const awayX = midX - cx;
    const awayZ = midZ - cz;
    const face = nearestCompass(awayX, awayZ);
    for (const opening of wall.openings) {
      openings.push({
        id: `${storey.id}:${wall.id}:${opening.id}`,
        wall: face,
        kind: opening.kind,
        widthFt: opening.widthFt,
        heightFt: opening.heightFt,
        offsetFt: opening.offsetFt,
        sillFt: opening.sillFt,
      });
    }
  }
  return openings;
}

function volumeFromStorey(storey: GraphStorey): Volume | null {
  const box = slabBox(storey);
  if (!box) return null;
  const zone = storey.roofZones[0];
  return {
    id: storey.id,
    name: storey.name,
    widthFt: Math.max(1, box.maxX - box.minX),
    depthFt: Math.max(1, box.maxZ - box.minZ),
    x: (box.minX + box.maxX) / 2,
    z: (box.minZ + box.maxZ) / 2,
    rotationDeg: 0,
    storeys: 1,
    wallHeightFt: storey.heightFt,
    roof: {
      form: zone ? zone.form : "flat",
      pitchDeg: zone?.pitchDeg ?? 0,
      overhangFt: 0,
    },
    openings: openingsOnBox(storey, box),
  };
}

/** A HomeSpec whose volumes are the graph storeys. Material and siting stay
 *  the recovery spec's — those are not geometry. */
export function fixtureSpecFromGraph(graph: BuildingGraph, recovery: HomeSpec): HomeSpec {
  return {
    ...recovery,
    volumes: graph.storeys.map(volumeFromStorey).filter((item): item is Volume => item !== null),
    deck: null,
    notes: `${recovery.notes}\n\nFixture hosts are the graph storeys' bounding boxes, not the frozen recovery volumes.`.trim(),
  };
}

export function fixtureSpecForDocument(document: BuilderDocument): HomeSpec {
  if (document.geometry.kind === "building-graph") {
    return fixtureSpecFromGraph(document.geometry.graph, document.spec);
  }
  return document.spec;
}
