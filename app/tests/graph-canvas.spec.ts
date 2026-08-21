import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import {
  addGraphOpening,
  addPartitionEdge,
  extrudeGraphWall,
  moveGraphVertex,
  renameGraphRoom,
  setGraphOpening,
  setGraphWallThickness,
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
  applyGraphOpeningEdit,
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

/** The 2D editor's path: mutate the graph, then validate the document. */
function documentFromMutatedGraph(
  start: BuilderDocument,
  graph: ReturnType<typeof graphOf>,
): BuilderDocument {
  if (start.geometry.kind !== "building-graph") {
    throw new Error("expected a building-graph document");
  }
  const candidate: BuilderDocument = {
    ...start,
    geometry: {
      ...start.geometry,
      graph,
    },
  };
  const checked = validateBuilderDocument(candidate);
  if (!checked.ok) throw new Error(checked.problem);
  return checked.document;
}

/* WHAT THIS TEST DOES AND DOES NOT PROVE, said plainly because it read as more
   than it is for three audits running.

   PR01's contract is "a drag and an equivalent typed edit produce the same
   graph and the same hash". This compares `applyGraphVertexEdit` against
   `moveGraphVertex` — and `applyGraphVertexEdit` is a document wrapper AROUND
   `moveGraphVertex`, so the two sides are one function and itself through a
   single indirection. It genuinely proves the wrapper does not corrupt the
   document on its way past validation, which is worth having and is not what
   the title suggests.

   It does NOT prove the product's drag equals the product's typed edit, because
   the product's drag path is `GraphCanvasEditor.tsx`, which this file never
   loads. That component calls `moveGraphVertex` directly at the same snap, so
   the property very likely holds — and "very likely" is precisely the phrase a
   gate exists to replace.

   The last test in this file is the part that stops it drifting further. */
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

  expect(hashBuilderDocument(typed.document)).toBe(
    hashBuilderDocument(documentFromMutatedGraph(start, dragged.graph)),
  );
  expect(typed.document.geometry).toEqual(documentFromMutatedGraph(start, dragged.graph).geometry);
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

  /* Audit #10 finding 2: GraphPlanEditor calls extrudeGraphWall, not
     applyGraphWallExtrude. The typed wrapper must hash the same as that path. */
  const ui = extrudeGraphWall(graphOf(start), "storey-1", "wall-1", 2, GRAPH_VERTEX_SNAP_FT);
  expect(ui.ok).toBe(true);
  if (!ui.ok) return;
  expect(hashBuilderDocument(typed.document)).toBe(
    hashBuilderDocument(documentFromMutatedGraph(start, ui.graph)),
  );
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

  const ui = renameGraphRoom(graphOf(start), "storey-1", room.id, "Kitchen");
  expect(ui.ok).toBe(true);
  if (!ui.ok) return;
  expect(hashBuilderDocument(typed.document)).toBe(
    hashBuilderDocument(documentFromMutatedGraph(start, ui.graph)),
  );
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

  const ui = setGraphWallThickness(graphOf(start), "storey-1", "wall-1", 0.75);
  expect(ui.ok).toBe(true);
  if (!ui.ok) return;
  expect(hashBuilderDocument(typed.document)).toBe(
    hashBuilderDocument(documentFromMutatedGraph(start, ui.graph)),
  );

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

test("a 3D drag commits once on release and Escape emits no restore edit", () => {
  /* Audit #10 finding 1: GraphCanvasEditor used to onEdit on every snapped
     pointermove and onEdit(graph0) on Escape. That is a live mutate plus a
     restore-edit, not preview-then-commit. Pin the grammar in source the
     same way the snap pin already works — a second onEdit writer would be
     the defect. */
  const appRoot = path.resolve(__dirname, "..");
  const editor = readFileSync(path.join(appRoot, "components", "builder", "GraphCanvasEditor.tsx"), "utf8");
  expect(editor).not.toMatch(/onEdit\(\s*moved\.graph/);
  expect(editor).not.toMatch(/onEdit\(\s*state\.graph0/);
  expect(editor).toMatch(/intent === "preview"/);
  expect(editor).toMatch(/cancelled/);
  expect(editor).toContain("onEdit(candidate");
});

/* ---------------------------------------------------------------------------
   THE RULE THREE AUDITS KEPT CIRCLING, finally written as a gate.

   `graphEdit.ts` exports five document writers and the product calls NONE of
   them. It edits a graph through the mutators in `buildingGraph.ts`, straight
   from `GraphPlanEditor.tsx` and `GraphCanvasEditor.tsx`.

   The first version of this gate concluded they were dead code and demanded
   deletion. That was wrong, and reading the file properly is what corrected it:
   four of the five are a TYPED REFERENCE IMPLEMENTATION, and the tests above
   compare each against the mutator the product actually calls — a typed extrude
   against `extrudeGraphWall`, a typed rename against `renameGraphRoom`. That
   is PR01's determinism contract expressed the only way this codebase can
   express it, and it is worth keeping.

   So the rule is not "must be called". It is: **a writer must either be reached
   by the product, or be cross-checked against the mutator that is.** A writer
   that is neither is the thing everyone thought all five were — an export that
   looks like coverage, passes green, and proves nothing.

   `applyGraphOpeningEdit` was exactly that until the test below it. It had no
   caller and no test at all; the only mention of its name outside its own
   definition was a comment claiming it was tested.
   --------------------------------------------------------------------------- */
test("every writer graphEdit.ts exports is reached by the product or checked against it", () => {
  const appRoot = path.resolve(__dirname, "..");
  const graphEditPath = path.join(appRoot, "lib", "builder", "graphEdit.ts");
  const source = readFileSync(graphEditPath, "utf8");

  /* Exported FUNCTIONS. Constants like GRAPH_VERTEX_SNAP_FT are values a
     component may legitimately read without calling anything. */
  const writers: string[] = [];
  const declaration = /export function (\w+)/g;
  for (let hit = declaration.exec(source); hit !== null; hit = declaration.exec(source)) {
    writers.push(hit[1]);
  }
  expect(writers.length, "no exported writers found — this gate is asserting nothing").toBeGreaterThan(3);

  const selfText = readFileSync(__filename, "utf8");
  /* Comments do not count as coverage — that is precisely the mistake this gate
     exists to catch, and an earlier draft of this very comment would have made
     an orphan look checked. */
  const executable = selfText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  const orphans = writers.filter((writer) => !new RegExp(`\\b${writer}\\b`).test(executable));

  expect(
    orphans,
    "these writers are exported but neither reached by the product nor checked against the mutator the product uses, so nothing they do is proven. Cross-check them here, wire them into the product, or delete them — do not leave them looking like coverage.",
  ).toEqual([]);
});

/* The cross-check `applyGraphOpeningEdit` never had. Same shape as its four
   siblings: the typed wrapper and the mutator `GraphPlanEditor` calls must
   produce the same document and the same hash. */
test("a typed graph opening edit hashes the same as the mutator the editor calls", () => {
  /* `setGraphOpening` EDITS an opening; it does not create one. The first draft
     of this test skipped that, both paths refused with "Opening … does not
     exist", and an `expect(typed.ok).toBe(ui.ok)` happily passed on
     false === false — then returned before comparing a single hash.

     It was caught by its own mutation proof: drifting the wrapper a foot from
     the mutator changed nothing, because the assertion it was supposed to break
     never ran. A comparison that both sides can decline is not a comparison,
     and the four sibling tests above get this right by ASSERTING ok rather than
     matching one ok against the other. */
  const seeded = documentFromSquare();
  const storey0 = graphOf(seeded).storeys[0];
  const wall = storey0.walls.find((item) => item.kind === "external");
  expect(wall, "the square has no external wall to place an opening on").toBeTruthy();
  if (!wall) return;

  const placed = addGraphOpening(graphOf(seeded), storey0.id, wall.id, {
    id: "opening-crosscheck",
    kind: "window",
    offsetFt: 2,
    widthFt: 3,
    sillFt: 2.5,
    heightFt: 4,
  });
  expect(placed.ok, "could not seed an opening to edit").toBe(true);
  if (!placed.ok) return;
  const start = documentFromMutatedGraph(seeded, placed.graph);

  /* Now MOVE it, which is what both paths are for. */
  const ask = {
    storeyId: storey0.id,
    wallId: wall.id,
    openingId: "opening-crosscheck",
    offsetFt: 4,
    widthFt: 3,
    sillFt: 2.5,
    heightFt: 4,
  };

  const typed = applyGraphOpeningEdit(start, ask);
  expect(typed.ok, "the typed wrapper refused a legal opening edit").toBe(true);
  if (!typed.ok) return;

  const ui = setGraphOpening(graphOf(start), ask.storeyId, ask.wallId, ask.openingId, {
    offsetFt: ask.offsetFt,
    widthFt: ask.widthFt,
    sillFt: ask.sillFt,
    heightFt: ask.heightFt,
  });
  expect(ui.ok, "the editor's own mutator refused an edit the wrapper accepted").toBe(true);
  if (!ui.ok) return;

  expect(hashBuilderDocument(typed.document)).toBe(
    hashBuilderDocument(documentFromMutatedGraph(start, ui.graph)),
  );
});
