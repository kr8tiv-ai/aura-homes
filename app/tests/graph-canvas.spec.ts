import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import {
  addPartitionEdge,
  moveGraphVertex,
  singleStoreyGraphFromPolygon,
} from "@/lib/builder/buildingGraph";
import {
  defaultBuilderDocument,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import {
  GRAPH_VERTEX_SNAP_FT,
  applyGraphVertexEdit,
  applyGraphWallExtrude,
  applyGraphRoomRename,
  applyGraphWallThickness,
} from "@/lib/builder/graphEdit";

/* PR01 — a drag and the equivalent typed edit must share one writer.

   OpeningHandles already proved this for windows: applyOpeningEdit is the only
   mutator, and hashBuilderDocument is the proof. Vertices did not have that
   writer. This file is that writer, measured. */

function documentFromSquare(): BuilderDocument {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]);
  if (!made.ok) throw new Error(made.problem);
  const base = defaultBuilderDocument();
  const candidate: BuilderDocument = {
    ...base,
    geometry: {
      kind: "building-graph",
      graph: made.graph,
      legacyRecovery: base.spec,
      migrationWarnings: [],
    },
  };
  const checked = validateBuilderDocument(candidate);
  if (!checked.ok) throw new Error(checked.problem);
  return checked.document;
}

function graphOf(document: BuilderDocument) {
  if (document.geometry.kind !== "building-graph") {
    throw new Error("expected a building-graph document");
  }
  return document.geometry.graph;
}

test("a vertex move and the equivalent typed edit hash identically", () => {
  const start = documentFromSquare();
  const point: [number, number] = [8, 0];
  const ask = {
    storeyId: "storey-1",
    vertexId: "vertex-2",
    point,
    snapFt: GRAPH_VERTEX_SNAP_FT,
  };

  const typed = applyGraphVertexEdit(start, ask);
  expect(typed.ok).toBe(true);
  if (!typed.ok) return;

  const dragged = moveGraphVertex(
    graphOf(start),
    ask.storeyId,
    ask.vertexId,
    ask.point,
    ask.snapFt,
  );
  expect(dragged.ok).toBe(true);
  if (!dragged.ok) return;

  const fromDrag = applyGraphVertexEdit(start, {
    ...ask,
    point: [dragged.graph.storeys[0].vertices.find((vertex) => vertex.id === "vertex-2")!.xFt,
      dragged.graph.storeys[0].vertices.find((vertex) => vertex.id === "vertex-2")!.zFt],
  });
  expect(fromDrag.ok).toBe(true);
  if (!fromDrag.ok) return;

  expect(hashBuilderDocument(typed.document)).toBe(hashBuilderDocument(fromDrag.document));
  expect(typed.document.geometry).toEqual(fromDrag.document.geometry);
});

test("an invalid move is refused and leaves the document untouched", () => {
  const start = documentFromSquare();
  const before = hashBuilderDocument(start);
  const refused = applyGraphVertexEdit(start, {
    storeyId: "storey-1",
    vertexId: "vertex-2",
    point: [-2.2, 8.1],
    snapFt: GRAPH_VERTEX_SNAP_FT,
  });
  expect(refused.ok).toBe(false);
  if (refused.ok) return;
  expect(refused.problem.length).toBeGreaterThan(8);
  expect(refused.problem).toMatch(/intersect|cross|wall/i);
  expect(hashBuilderDocument(refused.document)).toBe(before);
});

test("a missing graph is refused in a sentence, not by throwing", () => {
  const legacy = defaultBuilderDocument();
  expect(legacy.geometry.kind).toBe("legacy-volumes");
  const refused = applyGraphVertexEdit(legacy, {
    storeyId: "storey-1",
    vertexId: "vertex-1",
    point: [1, 1],
  });
  expect(refused.ok).toBe(false);
  if (refused.ok) return;
  expect(refused.problem).toContain("building graph");
  expect(hashBuilderDocument(refused.document)).toBe(hashBuilderDocument(legacy));
});

test("the snap the drag will use is the snap the typed path uses", () => {
  const start = documentFromSquare();
  const typed = applyGraphVertexEdit(start, {
    storeyId: "storey-1",
    vertexId: "vertex-2",
    point: [8.24, 0.24],
  });
  expect(typed.ok).toBe(true);
  if (!typed.ok) return;
  const vertex = graphOf(typed.document).storeys[0].vertices.find((item) => item.id === "vertex-2");
  expect(vertex).toMatchObject({ xFt: 8, zFt: 0 });
});

test("extruding a wall grows the footprint and a typed extrude hashes the same", () => {
  const start = documentFromSquare();
  const beforeArea = graphOf(start).storeys[0].rooms[0].areaSqft;
  const typed = applyGraphWallExtrude(start, {
    storeyId: "storey-1",
    wallId: "wall-1",
    distanceFt: 2,
  });
  expect(typed.ok).toBe(true);
  if (!typed.ok) return;
  const after = graphOf(typed.document).storeys[0];
  expect(after.rooms[0].areaSqft).toBe(beforeArea + 20);
  expect(after.vertices).toHaveLength(6);
  expect(after.walls).toHaveLength(6);

  const again = applyGraphWallExtrude(start, {
    storeyId: "storey-1",
    wallId: "wall-1",
    distanceFt: 2,
    snapFt: GRAPH_VERTEX_SNAP_FT,
  });
  expect(again.ok).toBe(true);
  if (!again.ok) return;
  expect(hashBuilderDocument(typed.document)).toBe(hashBuilderDocument(again.document));
});

test("a zero or partition extrusion is refused and leaves the hash untouched", () => {
  const start = documentFromSquare();
  const before = hashBuilderDocument(start);
  const zero = applyGraphWallExtrude(start, {
    storeyId: "storey-1",
    wallId: "wall-1",
    distanceFt: 0,
  });
  expect(zero.ok).toBe(false);
  expect(hashBuilderDocument(zero.document)).toBe(before);

  const partitioned = addPartitionEdge(graphOf(start), "storey-1", "partition-1", "vertex-1", "vertex-3");
  expect(partitioned.ok).toBe(true);
  if (!partitioned.ok) return;
  const withPartition: BuilderDocument = {
    ...start,
    geometry: {
      ...start.geometry,
      kind: "building-graph",
      graph: partitioned.graph,
      legacyRecovery: start.geometry.kind === "building-graph" ? start.geometry.legacyRecovery : start.spec,
      migrationWarnings: start.geometry.kind === "building-graph" ? start.geometry.migrationWarnings : [],
    },
  };
  const checked = validateBuilderDocument(withPartition);
  expect(checked.ok).toBe(true);
  if (!checked.ok) return;
  const partitionBefore = hashBuilderDocument(checked.document);
  const refused = applyGraphWallExtrude(checked.document, {
    storeyId: "storey-1",
    wallId: "partition-1",
    distanceFt: 2,
  });
  expect(refused.ok).toBe(false);
  if (refused.ok) return;
  expect(refused.problem).toMatch(/exterior|partition/i);
  expect(hashBuilderDocument(refused.document)).toBe(partitionBefore);
});

test("an extrusion without a building graph is refused in a sentence, not by throwing", () => {
  const legacy = defaultBuilderDocument();
  const refused = applyGraphWallExtrude(legacy, {
    storeyId: "storey-1",
    wallId: "wall-1",
    distanceFt: 2,
  });
  expect(refused.ok).toBe(false);
  if (refused.ok) return;
  expect(refused.problem).toContain("building graph");
  expect(hashBuilderDocument(refused.document)).toBe(hashBuilderDocument(legacy));
});

test("renaming a room and typing the same name again hash identically", () => {
  const start = documentFromSquare();
  const room = graphOf(start).storeys[0].rooms[0];
  expect(room?.name).toBeTruthy();
  const typed = applyGraphRoomRename(start, {
    storeyId: "storey-1",
    roomId: room.id,
    name: "Kitchen",
  });
  expect(typed.ok).toBe(true);
  if (!typed.ok) return;
  expect(graphOf(typed.document).storeys[0].rooms[0].name).toBe("Kitchen");

  const again = applyGraphRoomRename(start, {
    storeyId: "storey-1",
    roomId: room.id,
    name: "Kitchen",
  });
  expect(again.ok).toBe(true);
  if (!again.ok) return;
  expect(hashBuilderDocument(typed.document)).toBe(hashBuilderDocument(again.document));
});

test("an empty room name is refused and a rename survives a vertex move", () => {
  const start = documentFromSquare();
  const room = graphOf(start).storeys[0].rooms[0];
  const before = hashBuilderDocument(start);
  const empty = applyGraphRoomRename(start, {
    storeyId: "storey-1",
    roomId: room.id,
    name: "   ",
  });
  expect(empty.ok).toBe(false);
  expect(hashBuilderDocument(empty.document)).toBe(before);

  const named = applyGraphRoomRename(start, {
    storeyId: "storey-1",
    roomId: room.id,
    name: "Living",
  });
  expect(named.ok).toBe(true);
  if (!named.ok) return;
  const moved = applyGraphVertexEdit(named.document, {
    storeyId: "storey-1",
    vertexId: "vertex-2",
    point: [9, 0],
  });
  expect(moved.ok).toBe(true);
  if (!moved.ok) return;
  expect(graphOf(moved.document).storeys[0].rooms[0].name).toBe("Living");
});

test("a room rename without a building graph is refused in a sentence, not by throwing", () => {
  const legacy = defaultBuilderDocument();
  const refused = applyGraphRoomRename(legacy, {
    storeyId: "storey-1",
    roomId: "room-1",
    name: "Kitchen",
  });
  expect(refused.ok).toBe(false);
  if (refused.ok) return;
  expect(refused.problem).toContain("building graph");
  expect(hashBuilderDocument(refused.document)).toBe(hashBuilderDocument(legacy));
});

test("setting a wall thickness twice hashes the same and a zero thickness is refused", () => {
  const start = documentFromSquare();
  const before = hashBuilderDocument(start);
  const typed = applyGraphWallThickness(start, {
    storeyId: "storey-1",
    wallId: "wall-1",
    thicknessFt: 0.75,
  });
  expect(typed.ok).toBe(true);
  if (!typed.ok) return;
  expect(graphOf(typed.document).storeys[0].walls[0].thicknessFt).toBe(0.75);

  const again = applyGraphWallThickness(start, {
    storeyId: "storey-1",
    wallId: "wall-1",
    thicknessFt: 0.75,
  });
  expect(again.ok).toBe(true);
  if (!again.ok) return;
  expect(hashBuilderDocument(typed.document)).toBe(hashBuilderDocument(again.document));

  const zero = applyGraphWallThickness(start, {
    storeyId: "storey-1",
    wallId: "wall-1",
    thicknessFt: 0,
  });
  expect(zero.ok).toBe(false);
  expect(hashBuilderDocument(zero.document)).toBe(before);
});

test("the 3D handles drag through the same mutator and snap as the typed path", () => {
  const appRoot = path.resolve(__dirname, "..");
  const editor = readFileSync(path.join(appRoot, "components", "builder", "GraphCanvasEditor.tsx"), "utf8");
  const plan = readFileSync(path.join(appRoot, "components", "builder", "GraphPlanEditor.tsx"), "utf8");
  const app = readFileSync(path.join(appRoot, "components", "builder", "BuilderApp.tsx"), "utf8");
  expect(editor).toContain("moveGraphVertex");
  expect(editor).toContain("GRAPH_VERTEX_SNAP_FT");
  expect(editor).not.toMatch(/snapFt\s*=\s*1\b/);
  expect(plan).toContain("extrudeGraphWall");
  expect(plan).toContain("Extrude selected wall 2 ft");
  expect(plan).toContain("renameGraphRoom");
  expect(plan).toContain("setGraphWallThickness");
  expect(app).toContain("GraphCanvasEditor");
  expect(app).toContain("houseChildren");
});
