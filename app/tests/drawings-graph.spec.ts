import { expect, test } from "playwright/test";

import { convertBuilderDocumentToGraph, defaultBuilderDocument } from "@/lib/builder/document";
import { drawingSet } from "@/lib/builder/drawings";
import { homeToDxf, homeToIfc } from "@/lib/builder/exportPro";
import { buildHomeModelFromGraph, nearestCompassWall, outwardNormal } from "@/lib/builder/drawings/graphModel";
import { resolveLegacyGeometryExportSource } from "@/lib/builder/exportSource";

function graphDocument() {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  if (!converted.ok) throw new Error(converted.problem);
  return converted.document;
}

test("a graph drawing set is eight sheets inked from the graph, not the recovery spec", () => {
  const document = graphDocument();
  expect(document.geometry.kind).toBe("building-graph");
  if (document.geometry.kind !== "building-graph") return;

  const set = drawingSet({ document, dateISO: "2026-08-16", projectName: "Graph study" });
  expect(set.sheets.map((sheet) => sheet.number)).toEqual(["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"]);
  expect(set.warnings.some((note) => note.includes("planar building graph"))).toBe(true);
  expect(set.warnings.some((note) => note.includes("frozen recovery"))).toBe(true);

  const model = buildHomeModelFromGraph(document.geometry.graph, document.spec);
  expect(model.volumes.length).toBeGreaterThan(0);
  expect(model.totalFloorAreaSqFt).toBeGreaterThan(0);
  expect(model.deck).toBeNull();

  const a3 = set.sheets.find((sheet) => sheet.number === "A3");
  expect(a3, "the floor plan is missing").toBeDefined();
  /* The slab polygon is in the SVG. A set drawn from the frozen spec would
     still be a rectangle; the graph model has to have put its own outer ring
     on the sheet. */
  expect(a3!.svg).toContain("FLOOR PLAN");
  expect(a3!.svg.length).toBeGreaterThan(500);
});

test("a graph drawing set does not call the legacy writer that substitutes the recovery rectangle", () => {
  const document = graphDocument();
  expect(() => resolveLegacyGeometryExportSource(document)).toThrow(
    /does not support planar BuildingGraph geometry/,
  );
  expect(() => drawingSet({ document, dateISO: "2026-08-16" })).not.toThrow();
});

test("the same graph and the same date produce byte-identical sheets", () => {
  const document = graphDocument();
  const a = drawingSet({ document, dateISO: "2026-08-16", projectName: "Same" });
  const b = drawingSet({ document, dateISO: "2026-08-16", projectName: "Same" });
  expect(a.sheets.map((sheet) => sheet.svg)).toEqual(b.sheets.map((sheet) => sheet.svg));
});

test("DXF and IFC consume the graph model instead of refusing it", () => {
  const document = graphDocument();
  const dxf = homeToDxf(document, { dateISO: "2026-08-16" });
  expect(dxf).toContain("SECTION");
  expect(dxf).toContain("ENTITIES");
  expect(dxf).toMatch(/FLOOR|WALL|TEXT/);
  const ifc = homeToIfc(document, { dateISO: "2026-08-16T00:00:00Z" });
  expect(ifc).toContain("ISO-10303-21");
  expect(ifc).toContain("IFCWALL");
});

test("outward normals point off the slab, and a south-facing wall is south", () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 8],
    [0, 8],
  ];
  /* South edge, run west-to-east along +Z = 8. Outward is +Z (south). */
  const south = outwardNormal([0, 8], [10, 8], square);
  expect(south[1]).toBeGreaterThan(0);
  expect(nearestCompassWall(south)).toBe("s");

  const north = outwardNormal([10, 0], [0, 0], square);
  expect(north[1]).toBeLessThan(0);
  expect(nearestCompassWall(north)).toBe("n");
});
