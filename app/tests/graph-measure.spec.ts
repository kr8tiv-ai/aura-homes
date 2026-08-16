import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import { moveGraphVertex, singleStoreyGraphFromPolygon } from "@/lib/builder/buildingGraph";
import { GRAPH_VERTEX_SNAP_FT, applyGraphVertexEdit } from "@/lib/builder/graphEdit";
import { graphWallMeasures } from "@/lib/builder/graphMeasure";
import {
  defaultBuilderDocument,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import { formatFeetInches } from "@/lib/units";

function squareDocument(): BuilderDocument {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]);
  if (!made.ok) throw new Error(made.problem);
  const base = defaultBuilderDocument();
  const checked = validateBuilderDocument({
    ...base,
    geometry: {
      kind: "building-graph",
      graph: made.graph,
      legacyRecovery: base.spec,
      migrationWarnings: [],
    },
  });
  if (!checked.ok) throw new Error(checked.problem);
  return checked.document;
}

function graphOf(document: BuilderDocument) {
  if (document.geometry.kind !== "building-graph") throw new Error("expected graph");
  return document.geometry.graph;
}

test("every label is formatFeetInches of the wall's own vertex distance", () => {
  const graph = graphOf(squareDocument());
  const measures = graphWallMeasures(graph);
  expect(measures).toHaveLength(4);
  for (const measure of measures) {
    const recomputed = Math.hypot(
      measure.end[0] - measure.start[0],
      measure.end[1] - measure.start[1],
    );
    expect(measure.lengthFt).toBeCloseTo(recomputed, 10);
    expect(measure.label).toBe(formatFeetInches(measure.lengthFt));
    expect(measure.lengthFt).toBeCloseTo(10, 8);
  }
});

test("moving a vertex updates only the walls that touch it", () => {
  const start = squareDocument();
  const before = new Map(graphWallMeasures(graphOf(start)).map((item) => [item.wallId, item.lengthFt]));
  const moved = applyGraphVertexEdit(start, {
    storeyId: "storey-1",
    vertexId: "vertex-2",
    point: [8, 0],
    snapFt: GRAPH_VERTEX_SNAP_FT,
  });
  expect(moved.ok).toBe(true);
  if (!moved.ok) return;
  const after = graphWallMeasures(moved.graph);
  const changed = after.filter((item) => Math.abs((before.get(item.wallId) ?? 0) - item.lengthFt) > 1e-9);
  expect(changed.length).toBe(2);
  for (const item of changed) {
    const recomputed = Math.hypot(item.end[0] - item.start[0], item.end[1] - item.start[1]);
    expect(item.label).toBe(formatFeetInches(recomputed));
  }
});

test("a refused move leaves every printed length and the document hash unchanged", () => {
  const start = squareDocument();
  const beforeHash = hashBuilderDocument(start);
  const before = graphWallMeasures(graphOf(start)).map((item) => item.label);
  const refused = applyGraphVertexEdit(start, {
    storeyId: "storey-1",
    vertexId: "vertex-2",
    point: [-2.2, 8.1],
    snapFt: GRAPH_VERTEX_SNAP_FT,
  });
  expect(refused.ok).toBe(false);
  expect(hashBuilderDocument(refused.document)).toBe(beforeHash);
  expect(graphWallMeasures(graphOf(refused.document)).map((item) => item.label)).toEqual(before);
  const raw = moveGraphVertex(graphOf(start), "storey-1", "vertex-2", [-2.2, 8.1], GRAPH_VERTEX_SNAP_FT);
  expect(raw.ok).toBe(false);
});

test("the overlay and the Pro split view are mounted from the same measures", () => {
  const appRoot = path.resolve(__dirname, "..");
  const overlay = readFileSync(path.join(appRoot, "components", "builder", "GraphMeasureOverlay.tsx"), "utf8");
  const app = readFileSync(path.join(appRoot, "components", "builder", "BuilderApp.tsx"), "utf8");
  const note = readFileSync(path.join(appRoot, "components", "builder", "GraphImpactNote.tsx"), "utf8");
  expect(overlay).toContain("graphWallMeasures");
  expect(overlay).toContain("EXPORT_IGNORE");
  expect(app).toContain("GraphMeasureOverlay");
  expect(app).toContain("simultaneous");
  expect(app).toContain("data-graph-canvas-status");
  expect(app).toContain("GraphImpactNote");
  expect(note).toContain("NOT_MODELLED");
  expect(note).not.toMatch(/\d+(\.\d+)?\s*(kwh|sda|ase)\b/i);
});
