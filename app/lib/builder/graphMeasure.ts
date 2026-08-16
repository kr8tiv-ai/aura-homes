/**
 * Live wall lengths for a BuildingGraph.
 *
 * The graph does not store a length field. A length is the distance between
 * the two vertices a wall names, recomputed whenever those vertices move.
 * The overlay and the tests both call this, so a label cannot drift from
 * the geometry it claims to measure.
 */

import { formatFeetInches } from "@/lib/units";
import type { BuildingGraph, GraphStorey, GraphWallEdge } from "./buildingGraph";

export interface GraphWallMeasure {
  storeyId: string;
  wallId: string;
  start: readonly [number, number];
  end: readonly [number, number];
  mid: readonly [number, number];
  yFt: number;
  lengthFt: number;
  label: string;
}

export function wallLengthFt(storey: GraphStorey, wall: GraphWallEdge): number {
  const start = storey.vertices.find((vertex) => vertex.id === wall.startVertexId);
  const end = storey.vertices.find((vertex) => vertex.id === wall.endVertexId);
  if (!start || !end) return Number.NaN;
  return Math.hypot(end.xFt - start.xFt, end.zFt - start.zFt);
}

export function graphWallMeasures(graph: BuildingGraph): readonly GraphWallMeasure[] {
  return graph.storeys.flatMap((storey) =>
    storey.walls.map((wall) => {
      const startV = storey.vertices.find((vertex) => vertex.id === wall.startVertexId);
      const endV = storey.vertices.find((vertex) => vertex.id === wall.endVertexId);
      const start = [startV?.xFt ?? 0, startV?.zFt ?? 0] as const;
      const end = [endV?.xFt ?? 0, endV?.zFt ?? 0] as const;
      const lengthFt = wallLengthFt(storey, wall);
      return {
        storeyId: storey.id,
        wallId: wall.id,
        start,
        end,
        mid: [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] as const,
        yFt: storey.elevationFt + storey.heightFt * 0.5,
        lengthFt,
        label: Number.isFinite(lengthFt) ? formatFeetInches(lengthFt) : "—",
      };
    }),
  );
}
