/**
 * One writer for BuildingGraph vertex edits.
 *
 * `moveGraphVertex` is the mutator. This module is the document wrapper so a
 * drag and a typed figure can share a hash. Nothing here invents a second
 * snap, a second validate, or a second history label grammar.
 */

import {
  extrudeGraphWall,
  moveGraphVertex,
  renameGraphRoom,
  type BuildingGraph,
  type GraphPoint,
} from "./buildingGraph";
import {
  validateBuilderDocument,
  type BuilderDocument,
} from "./document";

/** Same 0.5 ft snap GraphPlanEditor already uses. Do not invent another. */
export const GRAPH_VERTEX_SNAP_FT = 0.5;

export type GraphDocumentEdit =
  | { ok: true; document: BuilderDocument; graph: BuildingGraph }
  | { ok: false; problem: string; document: BuilderDocument };

export function applyGraphVertexEdit(
  document: BuilderDocument,
  ask: {
    storeyId: string;
    vertexId: string;
    point: GraphPoint;
    snapFt?: number;
  },
): GraphDocumentEdit {
  const checked = validateBuilderDocument(document);
  if (!checked.ok) {
    return { ok: false, problem: checked.problem, document };
  }
  const current = checked.document;
  if (current.geometry.kind !== "building-graph") {
    return {
      ok: false,
      problem: "This design is not a building graph.",
      document: current,
    };
  }

  const snapFt = ask.snapFt ?? GRAPH_VERTEX_SNAP_FT;
  const moved = moveGraphVertex(
    current.geometry.graph,
    ask.storeyId,
    ask.vertexId,
    ask.point,
    snapFt,
  );
  if (!moved.ok) {
    return { ok: false, problem: moved.problem, document: current };
  }

  const next: BuilderDocument = {
    ...current,
    geometry: {
      ...current.geometry,
      graph: moved.graph,
    },
  };
  const valid = validateBuilderDocument(next);
  if (!valid.ok) {
    return { ok: false, problem: valid.problem, document: current };
  }
  if (valid.document.geometry.kind !== "building-graph") {
    return {
      ok: false,
      problem: "The edited document is no longer a building graph.",
      document: current,
    };
  }
  return { ok: true, document: valid.document, graph: valid.document.geometry.graph };
}

export function applyGraphWallExtrude(
  document: BuilderDocument,
  ask: {
    storeyId: string;
    wallId: string;
    distanceFt: number;
    snapFt?: number;
  },
): GraphDocumentEdit {
  const checked = validateBuilderDocument(document);
  if (!checked.ok) {
    return { ok: false, problem: checked.problem, document };
  }
  const current = checked.document;
  if (current.geometry.kind !== "building-graph") {
    return {
      ok: false,
      problem: "This design is not a building graph.",
      document: current,
    };
  }
  const extruded = extrudeGraphWall(
    current.geometry.graph,
    ask.storeyId,
    ask.wallId,
    ask.distanceFt,
    ask.snapFt ?? GRAPH_VERTEX_SNAP_FT,
  );
  if (!extruded.ok) {
    return { ok: false, problem: extruded.problem, document: current };
  }
  const next: BuilderDocument = {
    ...current,
    geometry: {
      ...current.geometry,
      graph: extruded.graph,
    },
  };
  const valid = validateBuilderDocument(next);
  if (!valid.ok) {
    return { ok: false, problem: valid.problem, document: current };
  }
  if (valid.document.geometry.kind !== "building-graph") {
    return {
      ok: false,
      problem: "The edited document is no longer a building graph.",
      document: current,
    };
  }
  return { ok: true, document: valid.document, graph: valid.document.geometry.graph };
}

export function applyGraphRoomRename(
  document: BuilderDocument,
  ask: {
    storeyId: string;
    roomId: string;
    name: string;
  },
): GraphDocumentEdit {
  const checked = validateBuilderDocument(document);
  if (!checked.ok) {
    return { ok: false, problem: checked.problem, document };
  }
  const current = checked.document;
  if (current.geometry.kind !== "building-graph") {
    return {
      ok: false,
      problem: "This design is not a building graph.",
      document: current,
    };
  }
  const renamed = renameGraphRoom(current.geometry.graph, ask.storeyId, ask.roomId, ask.name);
  if (!renamed.ok) {
    return { ok: false, problem: renamed.problem, document: current };
  }
  const next: BuilderDocument = {
    ...current,
    geometry: {
      ...current.geometry,
      graph: renamed.graph,
    },
  };
  const valid = validateBuilderDocument(next);
  if (!valid.ok) {
    return { ok: false, problem: valid.problem, document: current };
  }
  if (valid.document.geometry.kind !== "building-graph") {
    return {
      ok: false,
      problem: "The edited document is no longer a building graph.",
      document: current,
    };
  }
  return { ok: true, document: valid.document, graph: valid.document.geometry.graph };
}
