import { readFileSync } from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { expect, test } from "playwright/test";

import {
  duplicateGraphStorey,
  legacySpecToBuildingGraph,
  singleStoreyGraphFromPolygon,
  type BuildingGraph,
} from "@/lib/builder/buildingGraph";
import { convertBuilderDocumentToGraph, defaultBuilderDocument, hashBuilderDocument } from "@/lib/builder/document";
import { GRADE_Y_FT, summarizeHome } from "@/lib/builder/geometry";
import { buildGraphHome, disposeGraphHome, summarizeBuildingGraph } from "@/lib/builder/graphGeometry";
import { defaultSpec, type HomeSpec } from "@/lib/builder/spec";
import { MATERIAL_LIST, buildSurfaceIndex, pruneOverrides } from "@/lib/builder/surfaces";
import {
  DEFAULT_VIEWER_TOOLS,
  deriveViewerTools,
  restrictRayToSection,
  sectionSpan,
  viewerFloors,
  WHY_LEGACY_SINGLE_STOREY,
  WHY_LEGACY_TWO_STOREY,
  WHY_SINGLE_STOREY_GRAPH,
  type ViewerToolState,
} from "@/lib/three/viewerTools";

/* ===========================================================================
   VW02 — SECTION CUTS, FLOOR ISOLATION, AND THE REFUSAL IN THE MIDDLE.

   The tools are a VIEW over the document, so the hard questions about them are
   arithmetic and they are answered here, in node, with no browser: where does
   the plane land, which half survives it, which floor does an id point at, and
   — the one that matters most — WHEN IS THE CONTROL A LIE.

   THE REFUSAL IS THE POINT. In graph geometry a storey is a real
   VolumeGeometry and isolating one means something. In legacy geometry there
   is no per-floor split at all, and a two-storey legacy home cannot even
   convert to graph geometry (`legacySpecToBuildingGraph` refuses it). A
   control that appeared to work and isolated nothing would be the same class
   of defect that once put grass through a deck, so the module answers with a
   sentence and this file checks the sentence is TRUE by asking the converter
   the same question.

   WHAT THIS FILE CANNOT PROVE, said plainly rather than implied by silence.
   The DOM-level claims — that the canvas element survives every tool toggle,
   that `data-load-epoch` never moves, that the design hash attribute holds
   still — need a served build. They are written at the bottom of this file and
   they SKIP without a `baseURL`, because adding this spec to
   `playwright.ui.config.ts` means editing a file outside VW02's write-set.
   Until that happens they are unexecuted, and the source-level checks in the
   middle of this file are a proxy for them, not a substitute: they assert the
   canvas is still mounted through a CSS class rather than a conditional, which
   is the mechanism the DOM proof would observe.
   =========================================================================== */

const appRoot = path.resolve(__dirname, "..");
const read = (relative: string): string => readFileSync(path.join(appRoot, relative), "utf8");

/** Source with its comments stripped. A rule about CODE must not be tripped by
 *  PROSE: this file's first draft failed because `Viewport.tsx` explains, in a
 *  comment, that it deliberately does NOT use `visible={false}`. A gate that
 *  cannot tell a sentence from a statement gets switched off, which is worse
 *  than not having it. */
const codeOf = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Freeze an object and everything it holds. Any write into the document from
 *  a "pure" derivation then throws instead of passing unnoticed — ES modules
 *  are strict mode, so a silent no-op is not on the table. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}

function twoStoreyGraph(upperElevationFt = 10.5): BuildingGraph {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [30, 0],
    [30, 20],
    [0, 20],
  ]);
  if (!made.ok) throw new Error(made.problem);
  const duplicated = duplicateGraphStorey(made.graph, "storey-1", {
    id: "storey-2",
    name: "Upper floor",
    elevationFt: upperElevationFt,
  });
  if (!duplicated.ok) throw new Error(duplicated.problem);
  return duplicated.graph;
}

function oneStoreyGraph(): BuildingGraph {
  const made = singleStoreyGraphFromPolygon([
    [0, 0],
    [24, 0],
    [24, 16],
    [0, 16],
  ]);
  if (!made.ok) throw new Error(made.problem);
  return made.graph;
}

function twoStoreyLegacySpec(): HomeSpec {
  const spec = defaultSpec();
  return { ...spec, volumes: [{ ...spec.volumes[0], storeys: 2 }] };
}

const withSection = (
  patch: Partial<ViewerToolState["section"]>,
  isolatedFloorId: string | null = null,
): ViewerToolState => ({
  section: { ...DEFAULT_VIEWER_TOOLS.section, ...patch },
  isolatedFloorId,
});

/* ------------------------------------------------------------ the section */

test("the cut does not exist until it is asked for, and then it is exactly one plane", () => {
  const spec = defaultSpec();
  expect(deriveViewerTools(null, spec, DEFAULT_VIEWER_TOOLS).clipPlanes).toEqual([]);

  const on = deriveViewerTools(null, spec, withSection({ enabled: true }));
  expect(on.clipPlanes).toHaveLength(1);
  expect(on.clipPlanes[0]).toBeInstanceOf(THREE.Plane);
});

test("the cut lands where the read-out says it does, on all three axes", () => {
  const spec = defaultSpec();
  const summary = summarizeHome(spec);
  const b = summary.boundsWithRoof;

  /* Independently computed from the documented spans: X and Z from the roof
     bounds (so the plane can clear an eave), Y from grade to the tallest
     ridge (so a plan cut can reach the piles and the ridge alike). */
  const expected: Record<"x" | "y" | "z", [number, number]> = {
    x: [b.minX, b.maxX],
    y: [GRADE_Y_FT, summary.maxRidgeHeightFt],
    z: [b.minZ, b.maxZ],
  };

  for (const axis of ["x", "y", "z"] as const) {
    const [min, max] = expected[axis];
    const span = sectionSpan(null, spec, axis);
    expect(span).toEqual({ axis, minFt: min, maxFt: max });

    const quarter = deriveViewerTools(null, spec, withSection({ enabled: true, axis, t: 0.25 }));
    expect(quarter.cutAtFt).toBeCloseTo(min + (max - min) * 0.25, 6);

    /* Monotonic and clamped: the ends are the bounds and nothing runs past
       them, so a slider dragged to its stop cannot put the plane in space. */
    expect(deriveViewerTools(null, spec, withSection({ enabled: true, axis, t: 0 })).cutAtFt).toBeCloseTo(min, 6);
    expect(deriveViewerTools(null, spec, withSection({ enabled: true, axis, t: 1 })).cutAtFt).toBeCloseTo(max, 6);
    expect(deriveViewerTools(null, spec, withSection({ enabled: true, axis, t: 4 })).cutAtFt).toBeCloseTo(max, 6);
  }

  /* The Y span is NOT the plan bounds. Asserted rather than assumed, because
     an implementation that reached for minX on every axis would satisfy every
     other line above. */
  expect(sectionSpan(null, spec, "y").minFt).not.toBeCloseTo(b.minX, 6);
});

test("the plane keeps the low side, and flipping keeps the other one", () => {
  const spec = defaultSpec();
  const cut = deriveViewerTools(null, spec, withSection({ enabled: true, axis: "x", t: 0.5 }));
  const plane = cut.clipPlanes[0];
  const at = cut.cutAtFt;

  /* three clips a fragment when normal·p + constant < 0, so "kept" is a
     non-negative distance. This is the whole contract between this module and
     the renderer, and it is the one thing a sign error would invert. */
  expect(plane.distanceToPoint(new THREE.Vector3(at - 5, 4, 0))).toBeGreaterThan(0);
  expect(plane.distanceToPoint(new THREE.Vector3(at + 5, 4, 0))).toBeLessThan(0);

  const flipped = deriveViewerTools(null, spec, withSection({ enabled: true, axis: "x", t: 0.5, flipped: true }));
  expect(flipped.cutAtFt).toBeCloseTo(at, 9);
  expect(flipped.clipPlanes[0].distanceToPoint(new THREE.Vector3(at - 5, 4, 0))).toBeLessThan(0);
  expect(flipped.clipPlanes[0].distanceToPoint(new THREE.Vector3(at + 5, 4, 0))).toBeGreaterThan(0);
});

test("a pick ray is clamped to the half of the model that is still on screen", () => {
  const spec = defaultSpec();
  const cut = deriveViewerTools(null, spec, withSection({ enabled: true, axis: "x", t: 0.5 }));
  const planes = cut.clipPlanes;
  const at = cut.cutAtFt;

  /* Camera on the CLIPPED side, looking back through the cut: everything
     before the plane has been removed from the picture, so the ray must not
     start until it reaches the plane. Without this a click selects the wall
     the cut just took away. */
  const fromOutside = new THREE.Raycaster(new THREE.Vector3(at + 40, 5, 0), new THREE.Vector3(-1, 0, 0));
  expect(restrictRayToSection(fromOutside, planes)).toBe(true);
  expect(fromOutside.near).toBeGreaterThan(39.9);
  expect(fromOutside.far).toBe(Infinity);

  /* Camera on the KEPT side: the ray dies where the model stops being drawn. */
  const fromInside = new THREE.Raycaster(new THREE.Vector3(at - 40, 5, 0), new THREE.Vector3(1, 0, 0));
  expect(restrictRayToSection(fromInside, planes)).toBe(true);
  expect(fromInside.near).toBe(0);
  expect(fromInside.far).toBeCloseTo(40, 6);

  /* Pointing away from the kept half entirely: there is nothing to hit, and
     saying so is how a click on a cut-away wall clears the selection instead
     of painting something invisible. */
  const away = new THREE.Raycaster(new THREE.Vector3(at + 40, 5, 0), new THREE.Vector3(1, 0, 0));
  expect(restrictRayToSection(away, planes)).toBe(false);

  /* And with no cut at all the ray is left alone. */
  const plain = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(1, 0, 0));
  plain.near = 12;
  expect(restrictRayToSection(plain, [])).toBe(true);
  expect(plain.near).toBe(0);
  expect(plain.far).toBe(Infinity);
});

/* ------------------------------------------------------ the floor isolation */

test("a two-storey graph isolates real floors, by the ids the geometry actually emits", () => {
  const graph = twoStoreyGraph();
  const spec = defaultSpec();
  const floors = viewerFloors(graph);
  expect(floors.map((floor) => floor.id)).toEqual(["storey-1", "storey-2"]);

  const all = deriveViewerTools(graph, spec, DEFAULT_VIEWER_TOOLS);
  expect(all.canIsolate).toBe(true);
  expect(all.whyNot).toBeNull();
  expect(all.visibleVolumeIds).toBeNull();

  const upper = deriveViewerTools(graph, spec, withSection({}, "storey-2"));
  expect(upper.visibleVolumeIds).toEqual(["storey-2"]);

  /* The id has to name something the renderer can find. `buildGraphHome` emits
     one VolumeGeometry per storey with `id: storey.id`, and this is the line
     that catches a future prefix or a rename on either side of that contract. */
  const home = buildGraphHome(graph);
  try {
    expect(home.volumes.map((volume) => volume.id).sort()).toEqual(floors.map((f) => f.id).sort());
    expect(home.volumes.some((volume) => volume.id === upper.visibleVolumeIds?.[0])).toBe(true);
  } finally {
    disposeGraphHome(home);
  }

  /* A storey that has gone away shows the whole home rather than an empty
     scene: nothing is a worse answer than everything. */
  const stale = deriveViewerTools(graph, spec, withSection({}, "storey-9"));
  expect(stale.visibleVolumeIds).toBeNull();
  expect(stale.canIsolate).toBe(true);
});

test("floor elevations come from the graph, never from eaveHeightFt", () => {
  const graph = twoStoreyGraph(10.5);
  const floors = viewerFloors(graph);
  expect(floors.map((floor) => floor.elevationFt)).toEqual([0, 10.5]);

  /* VolumeGeometry carries no elevation — only `eaveHeightFt`, which is
     elevation + height. In this fixture the two are 10.5 and 20, so an
     implementation that read the geometry instead of the graph would report a
     floor ten feet above where it is. Both wrong values are pinned here so the
     assertion cannot pass by coincidence. */
  const summary = summarizeBuildingGraph(graph);
  const eaves = summary.volumes.map((volume) => volume.eaveHeightFt);
  expect(eaves).toEqual([9.5, 20]);
  expect(floors[1].elevationFt).not.toBe(eaves[0]);
  expect(floors[1].elevationFt).not.toBe(eaves[1]);
});

test("a single-storey graph says why there is nothing to isolate", () => {
  const answer = deriveViewerTools(oneStoreyGraph(), defaultSpec(), DEFAULT_VIEWER_TOOLS);
  expect(answer.canIsolate).toBe(false);
  expect(answer.whyNot).toBe(WHY_SINGLE_STOREY_GRAPH);
  expect(answer.visibleVolumeIds).toBeNull();
});

test("a two-storey LEGACY design refuses — and the refusal is true, because conversion refuses too", () => {
  const spec = twoStoreyLegacySpec();
  const answer = deriveViewerTools(null, spec, withSection({}, "storey-2"));

  expect(answer.canIsolate).toBe(false);
  expect(answer.whyNot).toBe(WHY_LEGACY_TWO_STOREY);
  /* Refusing must also mean HIDING NOTHING. A refusal that still ghosted half
     the model would be the silent failure this whole node exists to avoid. */
  expect(answer.visibleVolumeIds).toBeNull();
  expect(viewerFloors(null)).toEqual([]);

  /* The sentence claims there is no path to graph geometry for this design.
     That claim is checked against the converter itself rather than trusted:
     if `legacySpecToBuildingGraph` ever learns to split storeys, this test
     goes red and the copy has to change with it. */
  const converted = legacySpecToBuildingGraph(spec, 0.5);
  expect(converted.ok).toBe(false);
  if (!converted.ok) expect(converted.problem).toContain("multi-storey");
});

test("a single-storey legacy design refuses for its own reason", () => {
  const answer = deriveViewerTools(null, defaultSpec(), DEFAULT_VIEWER_TOOLS);
  expect(answer.canIsolate).toBe(false);
  expect(answer.whyNot).toBe(WHY_LEGACY_SINGLE_STOREY);
  expect(answer.whyNot).not.toBe(WHY_LEGACY_TWO_STOREY);

  /* And this one really can convert, which is what makes the two sentences
     different facts rather than two phrasings of one. */
  expect(legacySpecToBuildingGraph(defaultSpec(), 0.5).ok).toBe(true);
});

/* ------------------------------------------------- the document cannot move */

test("a tool is a view: frozen inputs, unchanged document, identical hash", () => {
  const document = defaultBuilderDocument();
  const before = hashBuilderDocument(document);

  /* The derivation is handed the document's OWN spec object, frozen. A write
     of any kind — a sort in place, a cached field, a lazily added property —
     throws here instead of quietly editing somebody's home. */
  const frozenSpec = deepFreeze(document.spec);
  const graph = deepFreeze(twoStoreyGraph());

  const states: ViewerToolState[] = [
    DEFAULT_VIEWER_TOOLS,
    withSection({ enabled: true, axis: "x", t: 0.2 }),
    withSection({ enabled: true, axis: "y", t: 0.8, flipped: true }),
    withSection({ enabled: true, axis: "z", t: 0.5 }, "storey-2"),
    withSection({}, "storey-1"),
  ];
  for (const state of states) {
    expect(() => deriveViewerTools(null, frozenSpec, state)).not.toThrow();
    expect(() => deriveViewerTools(graph, frozenSpec, state)).not.toThrow();
  }

  expect(hashBuilderDocument(document)).toBe(before);
});

/* --------------------------------------------- one material path, not two */

test("graph-mode surface ids do not survive the legacy prune — which is why finishes stay legacy-only", () => {
  /* This is the EVIDENCE for the decision recorded in BuilderApp: the
     graph-mode gate on the materials picker is kept rather than lifted. A
     finish is keyed on a surface id, `pruneOverrides` drops every id whose
     volume is not in `spec.volumes`, and in graph mode the spec is a frozen
     recovery copy whose volume ids ("main") are not the storey ids the graph
     geometry emits ("storey-1"). Painting in graph mode would therefore lose
     the paint the next time anything touched the spec — silently. */
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  expect(converted.ok).toBe(true);
  if (!converted.ok || converted.document.geometry.kind !== "building-graph") return;

  const graph = converted.document.geometry.graph;
  const home = buildGraphHome(graph);
  try {
    const index = buildSurfaceIndex(home);
    const wall = index.surfaces.find((ref) => ref.surface === "wall");
    expect(wall).toBeDefined();
    if (!wall) return;
    expect(wall.id.startsWith("vol:storey-1/")).toBe(true);

    const painted = { [wall.id]: MATERIAL_LIST[0].id };
    expect(pruneOverrides(converted.document.geometry.legacyRecovery, painted)).toEqual({});

    /* The control: the SAME prune keeps a legacy id, so the emptiness above is
       about graph ids and not about a prune that drops everything. */
    const legacyHome = defaultBuilderDocument();
    expect(
      pruneOverrides(legacyHome.spec, { "vol:main/wall:s": MATERIAL_LIST[0].id }),
    ).toEqual({ "vol:main/wall:s": MATERIAL_LIST[0].id });
  } finally {
    disposeGraphHome(home);
  }
});

test("the viewer tools own no material knowledge", () => {
  /* VW02's third tool is WIRING, not building: `lib/builder/surfaces.ts` is
     the only place a material is chosen, named or defaulted. A palette
     appearing in the tools module would be a second answer to one question. */
  const source = read("lib/three/viewerTools.ts");
  /* Identifiers and imports, not the word: the module's own header talks about
     house MATERIALS in prose, and a gate that cannot tell a sentence from a
     palette would have to be switched off the first time somebody wrote a
     comment. */
  expect(/from ["']@\/lib\/builder\/surfaces["']/.test(source)).toBe(false);
  expect(/\bMATERIAL_LIST\b|\bMATERIALS\s*\[|\bmaterialFor[A-Z]/.test(source)).toBe(false);
  expect(read("components/builder/BuilderApp.tsx")).toContain(
    'import SurfacePicker, { SurfaceQuickSwitch } from "./SurfacePicker"',
  );
  /* And the quick switch writes through the same module the panel does. */
  expect(read("components/builder/SurfacePicker.tsx")).toContain("setSurfaceMaterial(overrides, ref.id, m.id)");
});

/* ------------------------------------------------ the wiring, at source level

   A proxy for the DOM proof below, not a replacement for it. It observes the
   MECHANISM the browser test would observe the CONSEQUENCE of: one Viewport
   call site, inside the always-mounted CSS-hidden div, with the tool row as a
   sibling slot rather than a wrapper. */

test("the tool row is a sibling of a canvas that is still hidden by CSS, never unmounted", () => {
  const source = read("components/builder/BuilderApp.tsx");

  expect(source.match(/<Viewport\b/g) ?? []).toHaveLength(1);
  const shell = '<div className={mode === "3d" ? "block" : "hidden"}>';
  expect(source).toContain(shell);
  const afterShell = source.slice(source.indexOf(shell), source.indexOf(shell) + 200);
  expect(afterShell).toContain("<Viewport");

  // The tools reach the viewport, and they reach it derived.
  expect(source).toContain("tools={viewportTools}");
  expect(source).toContain("deriveViewerTools(");

  // And they never reach the reducer: a view is not a document edit.
  expect(/dispatch\(\{[^}]*viewerTools/.test(source)).toBe(false);
  expect(/type:\s*"(section|isolate|viewer)/.test(source)).toBe(false);
});

test("the cut is a material property, and the export root never loses a volume", () => {
  const source = read("components/builder/Viewport.tsx");

  /* THE LEAK VECTOR, guarded by name. `renderer.clippingPlanes` is the GLOBAL
     list — it clips every material that renderer draws. Assigning it here
     would be the one way a builder tool could reach another `<Canvas>` on the
     same page (the plan library mounts its own). The planes go on the house
     materials instead, and the only renderer state touched is
     `localClippingEnabled`, which R3F gives each canvas its own copy of, and
     which is restored rather than assumed on the way out. */
  const code = codeOf(source);
  expect(code).toContain("gl.localClippingEnabled = enabled");
  expect(code).toContain("gl.localClippingEnabled = previous");
  expect(/gl\.clippingPlanes\s*=/.test(code)).toBe(false);
  expect(code).toContain("clippingPlanes={clip}");

  /* AND NOTHING IS EVER SWITCHED OFF. three's GLTFExporter defaults to
     `onlyVisible: true` and `exportGlb` passes `opts.onlyVisible ?? true`
     with no caller overriding it, so an isolated floor drawn with
     `visible={false}` would silently ship half a house in the .glb. The
     isolation ghosts with opacity instead, and this is the line that stops
     somebody "simplifying" it back. */
  expect(/visible=\{/.test(code)).toBe(false);
  expect(code).toContain("GHOST_OPACITY");
});

/* =========================================================================== */

test.describe("in a served build", () => {
  /* SKIPPED without a baseURL, which is every run until this file is added to
     `playwright.ui.config.ts`'s testMatch — a file outside VW02's write-set.
     Reported as unexecuted rather than quietly counted as green. */
  test.skip(({ baseURL }) => !baseURL, "needs a served build (playwright.ui.config.ts)");

  test("every tool toggle leaves the canvas, the epoch and the design hash exactly where they were", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/build?mode=guided");
    const root = page.locator("[data-active-design-hash]");
    const viewport = page.locator(".builder-viewport");
    const canvas = viewport.locator("canvas");
    await expect(canvas).toBeAttached({ timeout: 90_000 });

    const MARK = "vw02-same-canvas";
    await canvas.evaluate((el, mark) => {
      (el as HTMLCanvasElement & { __vw02?: string }).__vw02 = mark;
    }, MARK);
    const hash = await root.getAttribute("data-active-design-hash");
    const geometry = await viewport.getAttribute("data-scene-geometry");

    const row = page.locator(".builder-tool-row");
    await expect(row).toBeVisible();
    await expect(row).toHaveAttribute("data-section-cut", "off");
    await expect(viewport).toHaveAttribute("data-section-planes", "0");

    // The cut: what is RENDERED changes, and nothing else does.
    await row.getByRole("button", { name: "Off", exact: true }).click();
    await expect(row).toHaveAttribute("data-section-cut", "on");
    await expect(viewport).toHaveAttribute("data-section-planes", "1");
    await page.getByRole("group", { name: "Cut axis" }).getByRole("button", { name: "Level", exact: true }).click();
    await expect(viewport).toHaveAttribute("data-section-planes", "1");

    // The refusal: the reference home is legacy single-storey, so the floors
    // tool must decline in words rather than offer a control that does nothing.
    await expect(row).toHaveAttribute("data-can-isolate", "no");
    await expect(row.locator("[data-tool-refusal='floors']")).toBeVisible();

    await expect(canvas).toHaveJSProperty("__vw02", MARK);
    await expect(viewport).toHaveAttribute("data-load-epoch", "0");
    await expect(root).toHaveAttribute("data-active-design-hash", hash!);
    await expect(viewport).toHaveAttribute("data-scene-geometry", geometry!);
  });
});
