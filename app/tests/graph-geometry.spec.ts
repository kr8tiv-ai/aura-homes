import { expect, test } from "playwright/test";

import {
  addGraphOpening,
  deriveRoofZone,
  singleStoreyGraphFromPolygon,
} from "@/lib/builder/buildingGraph";
import {
  buildGraphHome,
  disposeGraphHome,
  summarizeBuildingGraph,
} from "@/lib/builder/graphGeometry";

test("a planar graph drives one 3D scene and exact area summary", () => {
  const made = singleStoreyGraphFromPolygon(
    [
      [0, 0],
      [30, 0],
      [30, 12],
      [18, 12],
      [18, 22],
      [0, 22],
    ],
    { heightFt: 10 },
  );
  expect(made.ok).toBe(true);
  if (!made.ok) return;

  const storey = made.graph.storeys[0];
  const graph = {
    ...made.graph,
    storeys: [
      {
        ...storey,
        roofZones: [
          {
            id: "roof-flat",
            form: "flat" as const,
            boundaryVertexIds: [...storey.slabs[0].boundaryVertexIds],
            pitchDeg: 0,
          },
        ],
      },
    ],
  };
  const summary = summarizeBuildingGraph(graph);
  expect(summary.totalFloorAreaSqFt).toBe(540);
  expect(summary.groundFootprintSqFt).toBe(540);
  expect(summary.bounds.widthFt).toBe(30);
  expect(summary.bounds.depthFt).toBe(22);

  const home = buildGraphHome(graph);
  expect(home.volumes).toHaveLength(1);
  expect(home.volumes[0].parts.some((part) => part.surface === "wall")).toBe(true);
  expect(home.volumes[0].parts.some((part) => part.surface === "floor")).toBe(true);
  expect(home.volumes[0].parts.some((part) => part.surface === "roof")).toBe(true);
  expect(home.summary.totalFloorAreaSqFt).toBe(540);
  disposeGraphHome(home);
});

test("openings are holes in graph walls with stable glass and door parts", () => {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [24, 0],
    [24, 16],
    [0, 16],
  ]);
  expect(made.ok).toBe(true);
  if (!made.ok) return;

  const opened = addGraphOpening(made.graph, "storey-1", "wall-1", {
    id: "south-window",
    kind: "window",
    offsetFt: 7,
    widthFt: 8,
    heightFt: 5,
    sillFt: 3,
  });
  expect(opened.ok).toBe(true);
  if (!opened.ok) return;

  const roof = deriveRoofZone(opened.graph.storeys[0], "gable", 35);
  expect(roof.ok).toBe(true);
  if (!roof.ok) return;
  const graph = {
    ...opened.graph,
    storeys: [{ ...opened.graph.storeys[0], roofZones: [roof.zone] }],
  };
  const home = buildGraphHome(graph);
  const parts = home.volumes[0].parts;
  expect(parts.some((part) => part.openingId === "south-window" && part.surface === "glass")).toBe(
    true,
  );
  expect(parts.some((part) => part.id.includes("roof") && part.surface === "roof")).toBe(true);
  expect(home.summary.maxRidgeHeightFt).toBeGreaterThan(9.5);
  disposeGraphHome(home);
});
