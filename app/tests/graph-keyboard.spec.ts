import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

import {
  COARSE_STEP_FT,
  EXACT_SNAP_FT,
  GRID_SNAP_FT,
  arrowVertexTarget,
  vertexEditLabel,
} from "@/components/builder/GraphPlanEditor";
import { moveGraphVertex, type BuildingGraph } from "@/lib/builder/buildingGraph";
import {
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  hashBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";

/* AX01 — the plan editor from the keyboard, and every geometry value as an
   exact number.

   WHAT THIS FILE CAN AND CANNOT SEE. The only harness in this repo that mounts
   the real React tree is `test:ui`, which builds and serves a static export
   (playwright.ui.config.ts) and whose file list is not this node's to edit. So
   the live DOM half of the story — press ArrowRight on a focused list button,
   watch `cx` change — is not asserted here. What IS asserted is the thing that
   can actually rot: that the keyboard and the pointer are ONE implementation
   (a source contract, checked against the file), and that the one they share
   produces byte-identical geometry from either direction (real arithmetic
   through the real mutator). A live-DOM test that agreed with a second, drifted
   movement path would be the worse of the two tests. */

/* `pngjs` is already a devDependency (the meadow and hover proofs decode with
   it) but ships no types, and `@types/pngjs` is not installed — adding a
   dependency is out of scope for this node. A required handle with the two
   fields this file uses keeps `tsc --noEmit` clean without pretending to type
   the library. */
type PngImage = { width: number; height: number; data: Buffer };
const { PNG } = require("pngjs") as { PNG: { sync: { read(source: Buffer): PngImage } } };

const appRoot = path.resolve(__dirname, "..");
const editorSource = readFileSync(
  path.join(appRoot, "components/builder/GraphPlanEditor.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");
const builderSource = readFileSync(path.join(appRoot, "components/builder/BuilderApp.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);

/* Prose that quotes an attribute is documentation, not a declaration — the
   first run of the two "this attribute is gone" gates below flagged the
   comments that explain why it is gone. Assert on the code. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
const editorCode = stripComments(editorSource);

const graphDocument = (): BuilderDocument => {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), GRID_SNAP_FT);
  if (!converted.ok) throw new Error(converted.problem);
  return converted.document;
};

const graphOf = (document: BuilderDocument): BuildingGraph => {
  if (document.geometry.kind !== "building-graph") throw new Error("expected graph geometry");
  return document.geometry.graph;
};

const withGraph = (document: BuilderDocument, graph: BuildingGraph): BuilderDocument => {
  if (document.geometry.kind !== "building-graph") throw new Error("expected graph geometry");
  return { ...document, geometry: { ...document.geometry, graph } };
};

/** The body of the number field, sliced out so it can be checked on its own. */
const numberFieldSource = editorCode.slice(
  editorCode.indexOf("function NumberField("),
  editorCode.indexOf("export default function GraphPlanEditor("),
);

test("the arrow keys and the pointer drag are one implementation, not two that agree", () => {
  /* THE gate for this node. `moveGraphVertex` is called in exactly one place;
     the drag, the arrow keys and the numeric fields all reach it through
     `applyVertexMove`. A second call site is a second movement implementation,
     which is the class of defect that has already cost this repo the meadow
     mask literals, the slope and the deck meshes. */
  const calls = editorCode.match(/moveGraphVertex\(/g) ?? [];
  expect(calls).toHaveLength(1);
  expect(editorCode).toContain("const moved = moveGraphVertex(base, storey.id, vertexId, target, snapFt);");

  /* And every mover really does go through it. */
  expect(editorCode).toMatch(
    /const moveDrag = [\s\S]{0,400}?applyVertexMove\(\s*drag\.current\.graph,[\s\S]{0,200}?GRID_SNAP_FT,\s*"preview",/,
  ); // pointer drag
  expect(editorCode).toContain('applyVertexMove(graph, vertexId, target, GRID_SNAP_FT, "commit");'); // arrow keys
  expect(editorCode).toContain("applyVertexMove(graph, selectedVertex.id, [value, selectedVertex.zFt], EXACT_SNAP_FT"); // X field
  expect(editorCode).toContain("applyVertexMove(graph, selectedVertex.id, [selectedVertex.xFt, value], EXACT_SNAP_FT"); // Z field
  expect(editorCode).toMatch(/const commitWallLength = [\s\S]{0,900}?applyVertexMove\(/); // wall length

  /* The grid is one number. The drag used to carry a literal 0.5 inside
     moveDrag; a retyped copy in the keyboard path is the same drift by hand. */
  expect(GRID_SNAP_FT).toBe(0.5);
  expect(editorCode).not.toMatch(/const moveDrag = [\s\S]{0,400}?0\.5,/);
  expect(editorCode.match(/GRID_SNAP_FT/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
});

test("a keyboard move produces the identical graph and document hash as the equivalent drag", () => {
  const document = graphDocument();
  const graph = graphOf(document);
  const storey = graph.storeys[0];
  const vertex = storey.vertices[0];
  expect(vertex).toEqual({ id: "vol:main:vertex:1", xFt: -17, zFt: -11.75 });

  /* The keyboard asks for exactly one grid step east. */
  const keyboardTarget = arrowVertexTarget(vertex, "ArrowRight", false);
  expect(keyboardTarget).toEqual([-16.5, -11.75]);
  if (!keyboardTarget) return;
  const byKeyboard = moveGraphVertex(graph, storey.id, vertex.id, keyboardTarget, GRID_SNAP_FT);

  /* The pointer asks for a raw client point that lands in the same half-foot
     cell — which is the ONLY thing a drag can ever mean once it is snapped. */
  const byDrag = moveGraphVertex(graph, storey.id, vertex.id, [-16.44, -11.7], GRID_SNAP_FT);

  expect(byKeyboard.ok).toBe(true);
  expect(byDrag.ok).toBe(true);
  if (!byKeyboard.ok || !byDrag.ok) return;

  expect(byKeyboard.graph).toEqual(byDrag.graph);
  expect(hashBuilderDocument(withGraph(document, byKeyboard.graph))).toBe(
    hashBuilderDocument(withGraph(document, byDrag.graph)),
  );
  /* …and it is a real move, not a no-op that would make any two results equal. */
  expect(hashBuilderDocument(withGraph(document, byKeyboard.graph))).not.toBe(
    hashBuilderDocument(document),
  );

  /* THE CONTROL. A drag that lands in a different cell must NOT match, or the
     equality above is decoration that would pass on a broken editor. */
  const elsewhere = moveGraphVertex(graph, storey.id, vertex.id, [-16.44, -12.3], GRID_SNAP_FT);
  expect(elsewhere.ok).toBe(true);
  if (!elsewhere.ok) return;
  expect(elsewhere.graph).not.toEqual(byKeyboard.graph);
  expect(hashBuilderDocument(withGraph(document, elsewhere.graph))).not.toBe(
    hashBuilderDocument(withGraph(document, byKeyboard.graph)),
  );
});

test("arrow steps are grid steps, Shift is a coarse one, and nothing else moves anything", () => {
  const vertex = { xFt: 4, zFt: 9 };
  expect(arrowVertexTarget(vertex, "ArrowRight", false)).toEqual([4.5, 9]);
  expect(arrowVertexTarget(vertex, "ArrowLeft", false)).toEqual([3.5, 9]);
  /* North is up and the viewBox maps zFt straight onto y, so up is −z. */
  expect(arrowVertexTarget(vertex, "ArrowUp", false)).toEqual([4, 8.5]);
  expect(arrowVertexTarget(vertex, "ArrowDown", false)).toEqual([4, 9.5]);

  expect(arrowVertexTarget(vertex, "ArrowRight", true)).toEqual([4 + COARSE_STEP_FT, 9]);
  expect(COARSE_STEP_FT).toBeGreaterThan(GRID_SNAP_FT);
  /* The coarse step stays ON the lattice, so Shift cannot reach anywhere the
     unshifted key could not. */
  expect(COARSE_STEP_FT % GRID_SNAP_FT).toBe(0);

  /* And Shift means the same thing it already means in the OTHER plan editor.
     Plan2D is out of this node's scope and is not touched — but it nudges by
     `gridFt * (e.shiftKey ? 5 : 1)`, and two plan editors disagreeing about
     what Shift does is the same one-fact-two-places problem in miniature. If
     Plan2D's multiplier ever changes, this is where the two get reconciled. */
  const planSource = readFileSync(path.join(appRoot, "components/builder/Plan2D.tsx"), "utf8");
  expect(planSource).toContain("(e.shiftKey ? 5 : 1)");
  expect(COARSE_STEP_FT).toBe(GRID_SNAP_FT * 5);

  for (const key of ["Enter", " ", "Tab", "a", "PageUp", "Home"]) {
    expect(arrowVertexTarget(vertex, key, false)).toBeNull();
  }
});

test("a held arrow key is one history entry, on the reducer's own coalescing rule", () => {
  /* The rule is not reinvented here. BuilderApp collapses consecutive edits
     that carry the same label and nothing else; twenty presses therefore cost
     one undo, exactly as a drag does. If that mechanism is ever changed, this
     line fails and points at the file that changed it. */
  expect(builderSource).toContain("const coalesce = label === state.label && state.past.length > 0;");
  expect(builderSource).toContain(
    "past: coalesce ? state.past : [...state.past, state.doc].slice(-HISTORY_MAX),",
  );

  const labels = Array.from({ length: 20 }, () => vertexEditLabel("vol:main:vertex:1"));
  expect(new Set(labels).size).toBe(1);
  expect(labels[0]).toBe("graph:vertex:vol:main:vertex:1");

  /* Two different vertices are two steps — the label carries the identity, so
     the coalescing cannot swallow an edit to something else. */
  expect(vertexEditLabel("a")).not.toBe(vertexEditLabel("b"));

  /* The drag and the keyboard commit under the SAME label helper. A retyped
     `graph:vertex:${id}` on either side would make them two labels that happen
     to read alike today. */
  expect(editorCode.match(/graph:vertex:/g)).toHaveLength(1);
  expect(editorCode).toContain("onEdit(candidate, vertexEditLabel(active.vertexId));");
  expect(editorCode).toContain("onEdit(moved.graph, vertexEditLabel(vertexId));");
});

test("a refused move is announced, not swallowed", () => {
  const document = graphDocument();
  const graph = graphOf(document);
  const storey = graph.storeys[0];

  /* Drag the north-west corner clean across the plan: the footprint folds over
     itself and the mutator refuses the whole edit. */
  const refused = moveGraphVertex(graph, storey.id, "vol:main:vertex:1", [17, 11.75], GRID_SNAP_FT);
  expect(refused.ok).toBe(false);
  if (refused.ok) return;
  expect(refused.problem.length).toBeGreaterThan(0);
  /* The failure branch of GraphMutation carries the untouched graph — unlike
     its neighbours in that file, which is worth pinning because reading it as
     `{ok:false; problem}` compiles and then loses the graph at runtime. */
  expect(refused.graph).toBe(graph);

  /* An accepted move is not silent either, which is what makes the refusal
     path meaningful rather than the only thing that ever speaks. */
  expect(editorCode).toContain("refuse(`Move rejected: ${moved.problem}`);");
  expect(editorCode).toContain("moved to X ${feet(placed.xFt)} feet, Z ${feet(placed.zFt)} feet.");
  expect(editorCode).toContain('role="status"');
  expect(editorCode).toContain('aria-live="polite"');

  /* Both halves of an outcome leave through one pair of functions, so a new
     call site cannot set the visible notice and forget the spoken one. */
  expect(editorCode).toContain("const refuse = (message: string) => {\n    setProblem(message);\n    setAnnouncement(message);\n  };");
  expect(editorCode).toContain("const report = (message: string) => {\n    setProblem(null);\n    setAnnouncement(message);\n  };");
  /* Every refusal in the editor speaks, not only the vertex ones. */
  expect((editorCode.match(/\brefuse\(/g) ?? []).length).toBeGreaterThanOrEqual(10);

  /* RENEGOTIATED (AX01): the violet notice used to carry role="alert" and was
     the file's only live region — refusals were announced, everything else was
     silent. One polite region now carries every outcome; keeping the alert as
     well would speak each refusal twice. */
  expect(editorCode).not.toContain('role="alert"');
});

test("the numeric fields display from the graph and hold no draft of their own", () => {
  /* A field that keeps its own copy of a dimension is a second source of truth
     with a keyboard on it: type 40, have the move refused, and the screen now
     shows a building that does not exist. The field keeps no state at all. */
  expect(numberFieldSource).toContain("function NumberField(");
  expect(numberFieldSource).not.toContain("useState");
  expect(numberFieldSource).toContain("if (ref.current) ref.current.value = text;");
  expect(numberFieldSource).toContain("}, [text, revision]);");
  /* Refused entries re-sync too, which is why every commit bumps the revision
     whether or not the graph moved. */
  expect(editorCode).toContain("setFieldRevision((revision) => revision + 1);");

  /* Typed geometry is EXACT — the half-foot grid exists because a pointer
     cannot hit 12.375, not because a building cannot be that size. */
  expect(EXACT_SNAP_FT).toBe(0);
  const document = graphDocument();
  const graph = graphOf(document);
  const storey = graph.storeys[0];
  const typed = moveGraphVertex(graph, storey.id, "vol:main:vertex:1", [-16.375, -11.75], EXACT_SNAP_FT);
  expect(typed.ok).toBe(true);
  if (!typed.ok) return;
  expect(typed.graph.storeys[0].vertices[0].xFt).toBe(-16.375);
  /* The control: the same number through the drag's snap would NOT be exact. */
  const snapped = moveGraphVertex(graph, storey.id, "vol:main:vertex:1", [-16.375, -11.75], GRID_SNAP_FT);
  expect(snapped.ok).toBe(true);
  if (!snapped.ok) return;
  expect(snapped.graph.storeys[0].vertices[0].xFt).not.toBe(-16.375);
});

test("the keyboard surface is a named object list, not dozens of unnamed SVG stops", () => {
  /* The audit's finding, verified: the vertex <circle> carried tabIndex={0}
     and an aria-label, so the editor advertised focusability it could not
     honour. Worse, the <svg> is role="img", which makes its whole subtree
     presentational — those stops had no accessible name to announce either.
     Both attributes are gone from the drawing; the list carries the names. */
  expect(editorCode).not.toContain("tabIndex");
  expect(editorCode).toContain('aria-labelledby="graph-objects-label"');
  expect(editorCode).toContain("aria-label={`Vertex ${vertex.id}, X ${feet(vertex.xFt)} feet, Z ${feet(vertex.zFt)} feet`}");
  expect(editorCode).toContain("onKeyDown={(event) => nudgeVertex(event, vertex.id)}");
  /* Walls and openings are reachable and named too, not only vertices. */
  expect(editorCode).toContain("${noun} ${wall.id}, ${feet(run)} feet long, ${feet(wall.thicknessFt)} feet thick");
  expect(editorCode).toContain("on wall ${wall.id}, offset ${feet(opening.offsetFt)} feet");
  /* The role="img" label the rest of the suite locates the plan by survives. */
  expect(editorCode).toContain('aria-label="Editable building graph plan, north is up"');
});

test("the read-only dimensions say why they are read-only", () => {
  /* HONESTY. Openings on an existing wall still have no mutator here — those
     edits go through applyOpeningEdit. Thickness now does, so the field is
     writable and the old read-only sentence must be gone. */
  expect(editorCode).not.toContain(
    "Read-only: buildingGraph.ts sets a thickness when a wall is created and validates it, but exposes no mutator that changes one afterwards.",
  );
  expect(editorCode).toContain("setGraphWallThickness");
  expect(editorCode).toContain(
    "Read-only: buildingGraph.ts can add an opening and split a wall around one, but exposes no mutator that edits an existing opening.",
  );

  const graphModule = readFileSync(path.join(appRoot, "lib/builder/buildingGraph.ts"), "utf8");
  const exported = (graphModule.match(/^export function (\w+)/gm) ?? []).map((line) =>
    line.replace("export function ", ""),
  );
  expect(exported).toContain("moveGraphVertex");
  expect(exported).toContain("addGraphOpening");
  expect(exported).toContain("setGraphWallThickness");
  expect(exported.filter((name) => /Opening.*(Move|Set|Update)|setGraphOpening/.test(name))).toEqual([]);
});

test("the new controls carry the one focus ring the tokens describe", async ({ page }) => {
  const css = readFileSync(path.join(appRoot, "app/globals.css"), "utf8");
  /* Motion is stilled first. globals.css crossfades the theme over 500 ms, so
     two shots taken either side of a keypress differ across the WHOLE frame
     while that transition runs — measured at 3 135 pixels with no ring drawn
     at all. Reduced motion zeroes it (interface-motion.spec pins that), and
     idle drift then measures 0. */
  await page.emulateMedia({ reducedMotion: "reduce" });
  /* The list entry and the number field as the editor emits them. Both are
     ordinary elements, which is the point: they inherit the site's single
     :focus-visible rule instead of inventing a second focus treatment. */
  await page.setContent(
    `<div id="frame" style="display:inline-block;padding:14px;background:#0b0f0d">
       <button id="entry" type="button" aria-pressed="false">Vertex vol:main:vertex:1</button>
       <input id="field" type="number" step="0.5" value="-17" />
     </div>`,
  );
  await page.addStyleTag({ content: css });

  const frameBox = (await page.locator("#frame").boundingBox())!;
  const buttonBox = (await page.locator("#entry").boundingBox())!;
  /* The button's own rectangle inside the frame shot. Everything OUTSIDE it is
     where a ring at `outline-offset: 3px` has to land. */
  const button = {
    x: buttonBox.x - frameBox.x,
    y: buttonBox.y - frameBox.y,
    width: buttonBox.width,
    height: buttonBox.height,
  };

  /* Both shots are taken with the BUTTON as the only thing whose focus can
     change: nothing focused for the first, the button for the second. The
     number field is deliberately outside the comparison — a focused input
     paints a caret, and a caret makes two shots differ whether or not a ring
     was drawn. */
  const plain = await page.locator("#frame").screenshot();

  await page.keyboard.press("Tab");
  const entry = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = getComputedStyle(element);
    return {
      id: element.id,
      width: style.outlineWidth,
      style: style.outlineStyle,
      offset: style.outlineOffset,
      shadow: style.boxShadow,
    };
  });
  expect(entry.id).toBe("entry");
  expect(entry.width).toBe("2px");
  expect(entry.style).toBe("solid");
  expect(entry.offset).toBe("3px");
  /* The house rule: a ring, never a glow. */
  expect(entry.shadow).toBe("none");

  /* getComputedStyle reports the ring even when it paints nothing, so the
     assertion that matters is the pixels. And the pixels are counted in the
     RING BAND — strictly outside the button's own rectangle — not across the
     frame: Chromium repaints the button's interior on focus anyway, and a
     whole-frame count therefore stays green on a ring nobody can see.
     Measured against `2px solid transparent`: band 0, interior 3 135. With
     the real ring: band 749.

     They are also compared as DECODED PIXELS rather than PNG buffers. Two
     screenshots of an unchanged page encode to different bytes (1493 vs 1494),
     so Buffer.compare would report a difference that is not there. */
  const ringed = await page.locator("#frame").screenshot();
  const before = PNG.sync.read(plain);
  const after = PNG.sync.read(ringed);
  expect([after.width, after.height]).toEqual([before.width, before.height]);

  let band = 0;
  for (let y = 0; y < before.height; y += 1) {
    for (let x = 0; x < before.width; x += 1) {
      const index = (y * before.width + x) * 4;
      if (
        before.data[index] === after.data[index] &&
        before.data[index + 1] === after.data[index + 1] &&
        before.data[index + 2] === after.data[index + 2]
      ) {
        continue;
      }
      /* One pixel of slack around the box so the button's own edge
         anti-aliasing is never counted as a ring. */
      const outside =
        x < button.x - 1 ||
        x > button.x + button.width + 1 ||
        y < button.y - 1 ||
        y > button.y + button.height + 1;
      if (outside) band += 1;
    }
  }
  expect(band).toBeGreaterThan(200);

  await page.keyboard.press("Tab");
  const field = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = getComputedStyle(element);
    return { id: element.id, width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(field.id).toBe("field");
  expect(field.width).toBe("2px");
  expect(field.style).toBe("solid");
});
