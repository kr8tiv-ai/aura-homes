import { expect, test } from "playwright/test";

import {
  addGraphOpening,
  setGraphOpening,
  addPartitionEdge,
  deriveRoofZone,
  legacySpecToBuildingGraph,
  moveGraphVertex,
  rotateGraphPlan,
  setGraphRoofForm,
  scaleGraphOpenings,
  scaleGraphPlan,
  singleStoreyGraphFromPolygon,
  splitWallAt,
  validateBuildingGraph,
} from "@/lib/builder/buildingGraph";
import { defaultSpec } from "@/lib/builder/spec";

test("a non-rectangular footprint becomes one valid planar source of truth", () => {
  const result = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 8],
    [12, 8],
    [12, 16],
    [0, 16],
  ]);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const storey = result.graph.storeys[0];
  expect(storey.vertices).toHaveLength(6);
  expect(storey.walls).toHaveLength(6);
  expect(storey.rooms).toHaveLength(1);
  expect(storey.rooms[0].areaSqft).toBe(256);
  expect(validateBuildingGraph(result.graph).ok).toBe(true);
});

test("self-intersecting footprints are refused before a graph is created", () => {
  const crossed = singleStoreyGraphFromPolygon([
    [0, 0],
    [10, 10],
    [0, 10],
    [10, 0],
  ]);

  expect(crossed.ok).toBe(false);
  if (!crossed.ok) expect(crossed.problem).toContain("self-intersect");
});

test("a snapped vertex move is atomic when it would cross another wall", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;

  const moved = moveGraphVertex(made.graph, "storey-1", "vertex-2", [-2.2, 8.1], 0.5);
  expect(moved.ok).toBe(false);
  if (!moved.ok) {
    expect(moved.problem).toContain("intersect");
    expect(moved.graph).toBe(made.graph);
  }
  expect(made.graph.storeys[0].vertices.find((vertex) => vertex.id === "vertex-2")).toMatchObject({
    xFt: 10,
    zFt: 0,
  });
});

test("splitting host walls then adding a partition derives two exact room faces", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;

  const south = splitWallAt(made.graph, "storey-1", "wall-1", 10, "vertex-split-s");
  expect(south.ok).toBe(true);
  if (!south.ok) return;
  const north = splitWallAt(south.graph, "storey-1", "wall-3", 10, "vertex-split-n");
  expect(north.ok).toBe(true);
  if (!north.ok) return;
  const divided = addPartitionEdge(
    north.graph,
    "storey-1",
    "partition-1",
    "vertex-split-s",
    "vertex-split-n",
  );

  expect(divided.ok).toBe(true);
  if (!divided.ok) return;
  const rooms = divided.graph.storeys[0].rooms;
  expect(rooms).toHaveLength(2);
  expect(rooms.map((room) => room.areaSqft).sort((a, b) => a - b)).toEqual([100, 100]);
  expect(new Set(rooms.map((room) => room.id)).size).toBe(2);
});

test("wall openings keep their semantic id and offset when their host is split", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const opened = addGraphOpening(made.graph, "storey-1", "wall-1", {
    id: "opening-1",
    kind: "window",
    offsetFt: 14,
    widthFt: 3,
    heightFt: 4,
    sillFt: 3,
  });
  expect(opened.ok).toBe(true);
  if (!opened.ok) return;

  const split = splitWallAt(opened.graph, "storey-1", "wall-1", 10, "vertex-mid");
  expect(split.ok).toBe(true);
  if (!split.ok) return;
  const host = split.graph.storeys[0].walls.find((wall) =>
    wall.openings.some((opening) => opening.id === "opening-1"),
  );
  expect(host?.openings[0]).toMatchObject({ id: "opening-1", offsetFt: 4 });
});

test("an opening crossing a proposed split is quarantined by refusal, not cut", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const opened = addGraphOpening(made.graph, "storey-1", "wall-1", {
    id: "opening-wide",
    kind: "door",
    offsetFt: 8,
    widthFt: 4,
    heightFt: 7,
    sillFt: 0,
  });
  expect(opened.ok).toBe(true);
  if (!opened.ok) return;

  const split = splitWallAt(opened.graph, "storey-1", "wall-1", 10, "vertex-mid");
  expect(split.ok).toBe(false);
  if (!split.ok) expect(split.problem).toContain("opening-wide");
});

test("setGraphOpening writes a new box and refuses a hang-off", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const opened = addGraphOpening(made.graph, "storey-1", "wall-1", {
    id: "window-1",
    kind: "window",
    offsetFt: 4,
    widthFt: 5,
    heightFt: 4,
    sillFt: 3,
  });
  expect(opened.ok).toBe(true);
  if (!opened.ok) return;

  const moved = setGraphOpening(opened.graph, "storey-1", "wall-1", "window-1", {
    offsetFt: 6,
    widthFt: 4,
    heightFt: 3.5,
    sillFt: 2.5,
  });
  expect(moved.ok).toBe(true);
  if (!moved.ok) return;
  expect(moved.graph.storeys[0].walls[0].openings[0]).toMatchObject({
    id: "window-1",
    offsetFt: 6,
    widthFt: 4,
    heightFt: 3.5,
    sillFt: 2.5,
  });

  const hanging = setGraphOpening(opened.graph, "storey-1", "wall-1", "window-1", {
    offsetFt: 18,
    widthFt: 5,
    heightFt: 4,
    sillFt: 3,
  });
  expect(hanging.ok).toBe(false);
  if (!hanging.ok) {
    expect(hanging.problem).toContain("window-1");
    expect(hanging.graph).toBe(opened.graph);
  }
});

test("scaleGraphOpenings shrinks glazed openings and leaves doors alone", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const windowed = addGraphOpening(made.graph, "storey-1", "wall-1", {
    id: "window-1",
    kind: "window",
    offsetFt: 4,
    widthFt: 5,
    heightFt: 4,
    sillFt: 3,
  });
  expect(windowed.ok).toBe(true);
  if (!windowed.ok) return;
  const withDoor = addGraphOpening(windowed.graph, "storey-1", "wall-1", {
    id: "door-1",
    kind: "door",
    offsetFt: 12,
    widthFt: 3,
    heightFt: 7,
    sillFt: 0,
  });
  expect(withDoor.ok).toBe(true);
  if (!withDoor.ok) return;

  const shrunk = scaleGraphOpenings(withDoor.graph, 0.6);
  expect(shrunk.ok).toBe(true);
  if (!shrunk.ok) return;
  const wall = shrunk.graph.storeys[0].walls.find((item) => item.id === "wall-1");
  const window = wall?.openings.find((opening) => opening.id === "window-1");
  const door = wall?.openings.find((opening) => opening.id === "door-1");
  expect(window).toMatchObject({ widthFt: 3, heightFt: 2.25, offsetFt: 4, sillFt: 3 });
  expect(door).toMatchObject({ widthFt: 3, heightFt: 7, offsetFt: 12 });
  expect(validateBuildingGraph(shrunk.graph).ok).toBe(true);
});

test("scaleGraphPlan grows the walls and leaves opening sizes put", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const opened = addGraphOpening(made.graph, "storey-1", "wall-1", {
    id: "window-1",
    kind: "window",
    offsetFt: 4,
    widthFt: 5,
    heightFt: 4,
    sillFt: 3,
  });
  expect(opened.ok).toBe(true);
  if (!opened.ok) return;

  const grown = scaleGraphPlan(opened.graph, 1.2);
  expect(grown.ok).toBe(true);
  if (!grown.ok) return;
  const storey = grown.graph.storeys[0];
  const xs = storey.vertices.map((vertex) => vertex.xFt);
  const zs = storey.vertices.map((vertex) => vertex.zFt);
  expect(Math.max(...xs)).toBeCloseTo(24, 9);
  expect(Math.max(...zs)).toBeCloseTo(12, 9);
  expect(storey.walls[0].openings[0]).toMatchObject({ widthFt: 5, heightFt: 4, offsetFt: 4 });
  expect(storey.rooms[0].areaSqft).toBeCloseTo(288, 6);
  expect(validateBuildingGraph(grown.graph).ok).toBe(true);
});

test("rotateGraphPlan turns the footprint about the origin and keeps opening sizes", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const opened = addGraphOpening(made.graph, "storey-1", "wall-1", {
    id: "window-1",
    kind: "window",
    offsetFt: 4,
    widthFt: 5,
    heightFt: 4,
    sillFt: 3,
  });
  expect(opened.ok).toBe(true);
  if (!opened.ok) return;

  const turned = rotateGraphPlan(opened.graph, 90);
  expect(turned.ok).toBe(true);
  if (!turned.ok) return;
  const xs = turned.graph.storeys[0].vertices.map((vertex) => vertex.xFt);
  const zs = turned.graph.storeys[0].vertices.map((vertex) => vertex.zFt);
  expect(Math.min(...xs)).toBeCloseTo(-10, 6);
  expect(Math.max(...xs)).toBeCloseTo(0, 6);
  expect(Math.min(...zs)).toBeCloseTo(0, 6);
  expect(Math.max(...zs)).toBeCloseTo(20, 6);
  expect(turned.graph.storeys[0].walls[0].openings[0]).toMatchObject({
    widthFt: 5,
    heightFt: 4,
    offsetFt: 4,
  });
  expect(turned.graph.storeys[0].rooms[0].areaSqft).toBeCloseTo(200, 6);
  expect(validateBuildingGraph(turned.graph).ok).toBe(true);
});

test("setGraphRoofForm replaces the storey roof with a derived zone", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const shed = setGraphRoofForm(made.graph, "storey-1", "shed", 12);
  expect(shed.ok).toBe(true);
  if (!shed.ok) return;
  expect(shed.graph.storeys[0].roofZones).toHaveLength(1);
  expect(shed.graph.storeys[0].roofZones[0].form).toBe("shed");
  expect(shed.graph.storeys[0].roofZones[0].fallVector).toBeDefined();
  const flat = setGraphRoofForm(shed.graph, "storey-1", "flat");
  expect(flat.ok).toBe(true);
  if (!flat.ok) return;
  expect(flat.graph.storeys[0].roofZones[0]).toMatchObject({ form: "flat", pitchDeg: 0 });
});

test("gable, hipped, shed and flat roof intent derive deterministically from one polygon", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [24, 0],
    [24, 12],
    [0, 12],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;

  const flat = deriveRoofZone(made.graph.storeys[0], "flat", 0);
  const shed = deriveRoofZone(made.graph.storeys[0], "shed", 12);
  const gable = deriveRoofZone(made.graph.storeys[0], "gable", 35);
  const hipped = deriveRoofZone(made.graph.storeys[0], "hipped", 30);

  expect(flat.ok && flat.zone.form).toBe("flat");
  expect(shed.ok && shed.zone.fallVector).toEqual([0, 1]);
  expect(gable.ok && gable.zone.ridge).toEqual({
    start: [0, 6],
    end: [24, 6],
  });
  expect(hipped.ok && hipped.zone.form).toBe("hipped");
});

test("a complex concave hipped roof is refused until explicit roof zones exist", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [20, 0],
    [20, 8],
    [10, 8],
    [10, 18],
    [0, 18],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;
  const roof = deriveRoofZone(made.graph.storeys[0], "hipped", 30);
  expect(roof.ok).toBe(false);
  if (!roof.ok) expect(roof.problem).toContain("explicit roof zones");
});

test("a rotated legacy volume migrates with opening ids and a recovery copy", () => {
  const spec = defaultSpec();
  const rotated = {
    ...spec,
    volumes: [
      {
        ...spec.volumes[0],
        rotationDeg: 90,
      },
    ],
  };

  const converted = legacySpecToBuildingGraph(rotated, 0.5);

  expect(converted.ok).toBe(true);
  if (!converted.ok) return;
  expect(converted.legacyRecovery).toEqual(rotated);
  expect(converted.legacyRecovery).not.toBe(rotated);
  expect(converted.graph.storeys[0].rooms).toHaveLength(1);
  expect(converted.graph.storeys[0].walls.flatMap((wall) => wall.openings)).toHaveLength(4);
  expect(
    converted.graph.storeys[0].walls.flatMap((wall) => wall.openings.map((opening) => opening.id)),
  ).toContain("vol:main:opening:o1");
  expect(validateBuildingGraph(converted.graph).ok).toBe(true);
});

test("legacy multi-storey intent is refused until its storey plates can be preserved", () => {
  const spec = defaultSpec();
  const multi = {
    ...spec,
    volumes: [{ ...spec.volumes[0], storeys: 2 as const }],
  };

  const converted = legacySpecToBuildingGraph(multi, 0.5);
  expect(converted.ok).toBe(false);
  if (!converted.ok) expect(converted.problem).toContain("multi-storey");
});
