import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import { moveGraphVertex, singleStoreyGraphFromPolygon } from "@/lib/builder/buildingGraph";
import {
  defaultBuilderDocument,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import {
  GRAPH_VERTEX_SNAP_FT,
  applyGraphVertexEdit,
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

test("the 3D handles drag through the same mutator and snap as the typed path", () => {
  const appRoot = path.resolve(__dirname, "..");
  const editor = readFileSync(path.join(appRoot, "components", "builder", "GraphCanvasEditor.tsx"), "utf8");
  const app = readFileSync(path.join(appRoot, "components", "builder", "BuilderApp.tsx"), "utf8");
  expect(editor).toContain("moveGraphVertex");
  expect(editor).toContain("GRAPH_VERTEX_SNAP_FT");
  expect(editor).not.toMatch(/snapFt\s*=\s*1\b/);
  expect(app).toContain("GraphCanvasEditor");
  expect(app).toContain("houseChildren");
});
