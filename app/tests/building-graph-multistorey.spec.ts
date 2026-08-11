import { expect, test } from "playwright/test";

import {
  addGraphShaft,
  addGraphStair,
  deriveRoofZone,
  deriveStackedRoomRelationships,
  duplicateGraphStorey,
  setGraphStoreyLevels,
  singleStoreyGraphFromPolygon,
  validateBuildingGraph,
} from "@/lib/builder/buildingGraph";
import { buildGraphHome, disposeGraphHome, summarizeBuildingGraph } from "@/lib/builder/graphGeometry";
import { convertBuilderDocumentToGraph, defaultBuilderDocument } from "@/lib/builder/document";

function twoStoreys() {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [30, 0],
    [30, 20],
    [0, 20],
  ]);
  if (!made.ok) throw new Error(made.problem);
  const roof = deriveRoofZone(made.graph.storeys[0], "gable", 30);
  if (!roof.ok) throw new Error(roof.problem);
  const roofed = {
    ...made.graph,
    storeys: [{ ...made.graph.storeys[0], roofZones: [roof.zone] }],
  };
  const duplicated = duplicateGraphStorey(roofed, "storey-1", {
    id: "storey-2",
    name: "Upper floor",
    elevationFt: 9.5,
  });
  if (!duplicated.ok) throw new Error(duplicated.problem);
  return duplicated.graph;
}

test("an aligned storey duplication preserves topology and moves the roof to the top", () => {
  const graph = twoStoreys();
  expect(validateBuildingGraph(graph).ok).toBe(true);
  expect(graph.storeys).toHaveLength(2);
  expect(graph.storeys[0].roofZones).toEqual([]);
  expect(graph.storeys[1].roofZones).toHaveLength(1);
  expect(graph.storeys[1].vertices.map((vertex) => [vertex.xFt, vertex.zFt])).toEqual(
    graph.storeys[0].vertices.map((vertex) => [vertex.xFt, vertex.zFt]),
  );
  expect(summarizeBuildingGraph(graph).totalFloorAreaSqFt).toBe(1200);
  expect(deriveStackedRoomRelationships(graph)).toEqual([
    expect.objectContaining({ lowerStoreyId: "storey-1", upperStoreyId: "storey-2", overlapSqft: 600 }),
  ]);
});

test("the migrated Aura reference graph can be duplicated without losing its openings", () => {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  expect(converted.ok).toBe(true);
  if (!converted.ok || converted.document.geometry.kind !== "building-graph") return;
  const duplicated = duplicateGraphStorey(converted.document.geometry.graph, "storey-1", {
    id: "storey-2",
    name: "Storey 2",
    elevationFt: 9.5,
  });
  expect(duplicated.ok).toBe(true);
  if (!duplicated.ok) return;
  expect(duplicated.graph.storeys[1].walls.flatMap((wall) => wall.openings)).toHaveLength(4);
});

test("storey levels refuse vertical collisions atomically", () => {
  const graph = twoStoreys();
  const collided = setGraphStoreyLevels(graph, "storey-2", { elevationFt: 8 });
  expect(collided.ok).toBe(false);
  expect(collided.graph).toBe(graph);
  if (!collided.ok) expect(collided.problem).toContain("overlap vertically");

  const raised = setGraphStoreyLevels(graph, "storey-2", { elevationFt: 10.5, heightFt: 10 });
  expect(raised.ok).toBe(true);
  if (raised.ok) {
    expect(raised.graph.storeys[1].elevationFt).toBe(10.5);
    expect(raised.graph.storeys[1].heightFt).toBe(10);
  }
});

test("a stair creates an explicit upper-floor opening and graph-backed 3D flight", () => {
  const graph = twoStoreys();
  const stair = addGraphStair(graph, {
    id: "stair-1",
    fromStoreyId: "storey-1",
    toStoreyId: "storey-2",
    start: [10, 8],
    end: [20, 8],
    widthFt: 3,
  });
  expect(stair.ok).toBe(true);
  if (!stair.ok) return;

  expect(stair.graph.stairs).toHaveLength(1);
  expect(stair.graph.storeys[1].voids).toHaveLength(1);
  expect(stair.graph.storeys[1].slabs[0].voidIds).toEqual(["stair-1:opening"]);
  expect(summarizeBuildingGraph(stair.graph).totalFloorAreaSqFt).toBe(1170);

  const home = buildGraphHome(stair.graph);
  expect(home.volumes[0].parts.some((part) => part.id.startsWith("stair-1:tread:"))).toBe(true);
  disposeGraphHome(home);
});

test("a stair outside the aligned floor plate is refused without a partial void", () => {
  const graph = twoStoreys();
  const stair = addGraphStair(graph, {
    id: "stair-outside",
    fromStoreyId: "storey-1",
    toStoreyId: "storey-2",
    start: [26, 19],
    end: [36, 19],
    widthFt: 3,
  });
  expect(stair.ok).toBe(false);
  expect(stair.graph).toBe(graph);
  expect(graph.storeys[1].voids).toEqual([]);
});

test("a service shaft is an explicit stacked opening rather than hidden metadata", () => {
  const graph = twoStoreys();
  const shaft = addGraphShaft(graph, {
    id: "shaft-1",
    fromStoreyId: "storey-1",
    toStoreyId: "storey-2",
    centre: [5, 5],
    widthFt: 2,
    depthFt: 2,
  });
  expect(shaft.ok).toBe(true);
  if (!shaft.ok) return;
  expect(shaft.graph.shafts).toEqual([
    expect.objectContaining({ id: "shaft-1", openingVoidId: "shaft-1:opening" }),
  ]);
  expect(shaft.graph.storeys[1].slabs[0].voidIds).toEqual(["shaft-1:opening"]);
  expect(summarizeBuildingGraph(shaft.graph).totalFloorAreaSqFt).toBe(1196);
});
