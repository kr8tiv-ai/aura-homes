import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { expect, test, type Page } from "playwright/test";

import WalkthroughPanel, {
  APPROACH_MARGIN_FT,
  EYE_HEIGHT_FT,
  EYE_HEIGHT_NOTE,
  FINISHED_FLOOR_Y_FT,
  GAZE_BELOW_LEVEL_RAD,
  LOOK_AHEAD_MIN_FT,
  ORBIT_MAX_POLAR_RAD,
  ORBIT_MIN_DISTANCE_FT,
  VIEWPORT_FOV_DEG,
  VIEWPORT_MIN_ASPECT,
  WALK_GLIDE_FRAMES,
  WALK_KEYS,
  WALK_KEY_NOTE,
  WALK_TRAVEL_MS,
  applyWalkPose,
  approachStandOffFt,
  asOrbitControls,
  currentWalkPose,
  walkAutoplayAllowed,
  walkAutoplayNext,
  walkChannel,
  walkFrames,
  walkIndex,
  walkPoseAt,
  walkViewpoints,
  type WalkPose,
} from "@/components/builder/Walkthrough";
import {
  duplicateGraphStorey,
  singleStoreyGraphFromPolygon,
  type BuildingGraph,
} from "@/lib/builder/buildingGraph";
import { defaultBuilderDocument, hashBuilderDocument } from "@/lib/builder/document";
import {
  FLOOR_SLAB_FT,
  GRADE_Y_FT,
  PILE_EXPOSURE_FT,
  summarizeHome,
  type Pt2,
  type SiteSummary,
} from "@/lib/builder/geometry";
import { summarizeBuildingGraph } from "@/lib/builder/graphGeometry";
import { PLAN_TEMPLATES } from "@/lib/builder/planCatalog";
import { formatFeetInchesWords } from "@/lib/units";

/* ═══════════════════════════════════════════════════════════════════════
   WALK01 — WALKING THE HOME IS A WAY OF LOOKING, AND EVERY CLAIM IT MAKES
   IS MEASURED AGAINST AN ENGINE.

   This node's whole risk is that a camera mode looks fine in one screenshot
   of one home and is wrong everywhere else. So nothing here is checked by
   reading:

   · THE CLAMPS ARE THE REAL ONES. `Viewport.tsx` is not in this node's
     write-set, and it mounts OrbitControls with `minDistance={12}` and
     `maxPolarAngle={Math.PI / 2 - 0.035}` — limits the control ENFORCES on
     the next update(). A viewpoint that violated one would be silently
     dragged somewhere else and its label would become a lie. The module
     MIRRORS those numbers; this file parses the originals out of
     `Viewport.tsx` and fails if the mirror ever stops matching, then checks
     every viewpoint of every plan in the catalogue against them.
   · "THE WHOLE HOME IS IN FRAME" IS CHECKED WITH A FRUSTUM, not with a
     factor that looked right. A real THREE.PerspectiveCamera at Viewport's
     own field of view is built, pointed at the pose, and asked about all
     eight corners of the home — for every catalogue plan. The control below
     it proves a too-near stand-off really does fail that test.
   · "IT STANDS INSIDE THE ROOM" is a point-in-polygon test against the plan
     corners `geometry.ts` emitted, written independently here rather than
     read off a flag the module set.
   · "THE PRINTED EYE HEIGHT IS THE HEIGHT IT STANDS AT" is checked by
     PARSING THE RENDERED SENTENCE and comparing the number in it to the
     camera's actual Y. Copy and geometry cannot drift.
   · REDUCED MOTION is measured in a real browser under a real
     `prefers-reduced-motion` emulation: which controls have a box, and what
     the tab order is, under each preference. The guarantee being kept is
     that the stepped path loses NOTHING — the difference is exactly one
     control, and it is the one whose purpose is motion.

   WHAT THIS FILE CANNOT SEE, SAID PLAINLY. The DOM-level half of "the canvas
   does not remount and `data-load-epoch` does not move" needs a served build
   AND the mount inside `BuilderApp.tsx`, which is off limits to every agent
   in this wave. Those cases are at the bottom of the file and SKIP without a
   `baseURL`; until the orchestrator wires the mount and adds this file to
   `playwright.ui.config.ts` they are UNEXECUTED, and they are reported as
   unexecuted rather than counted as green. What stands in for them until
   then is not a comment: it is the frozen-document hash test and the source
   contract, which observe the MECHANISM the browser test would observe the
   consequence of.
   ═══════════════════════════════════════════════════════════════════════ */

const appRoot = path.resolve(__dirname, "..");
const read = (...segments: string[]) => readFileSync(path.join(appRoot, ...segments), "utf8");

const css = read("app/globals.css");
const walkSource = read("components/builder/Walkthrough.tsx");
const viewportSource = read("components/builder/Viewport.tsx");
const packageJson = JSON.parse(read("package.json")) as { dependencies: Record<string, string> };

/** Source with its comments stripped. A rule about CODE must not be tripped by
 *  PROSE — this file's own header names `hashBuilderDocument`, and the module's
 *  header explains at length what it does NOT do. */
const codeOf = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const walkCode = codeOf(walkSource);

/** A JSX opening tag, and NOT a TypeScript type argument. The first draft of
 *  this was `/<[A-Za-z]/`, which flagged `useRef<number>` and would have made
 *  the "the rig renders nothing" gate impossible to satisfy honestly — a gate
 *  that cannot pass gets loosened until it cannot fail, which is worse. The
 *  distinguishing feature is what precedes the angle bracket: a type argument
 *  follows an identifier, an element follows an operator or whitespace. */
const JSX_TAG = /(?:^|[\s(={,])<[A-Za-z][A-Za-z0-9]*[\s/>]/m;

/* ------------------------------------------------------------- the fixtures */

const DOCUMENT = defaultBuilderDocument();
const SUMMARY = summarizeHome(DOCUMENT.spec);

function twoStoreyGraph(): BuildingGraph {
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
    elevationFt: 10.5,
  });
  if (!duplicated.ok) throw new Error(duplicated.problem);
  return duplicated.graph;
}

/** Every real home in the product, as summaries. Breadth is the point: a
 *  camera rule that holds for the reference cabin and fails for the long
 *  glass pavilion is a rule that has not been tested. */
const CATALOGUE: ReadonlyArray<{ id: string; summary: SiteSummary }> = PLAN_TEMPLATES.map(
  (template) => ({ id: template.id, summary: summarizeHome(template.spec) }),
);

/* --------------------------------------------------------------- the markup

   Playwright's babel transform rewrites JSX in project files into its own
   envelope rather than into React elements, so the tree is converted back —
   the helper `margin-stack.spec.ts` and `builder-craft.spec.ts` both use,
   including the fragment case. */

interface PwJsx {
  __pw_type: "jsx";
  type: unknown;
  props?: Record<string, unknown>;
  key?: unknown;
}

const isPwJsx = (value: unknown): value is PwJsx =>
  typeof value === "object" && value !== null && (value as PwJsx).__pw_type === "jsx";

const isPwFragment = (value: unknown): boolean =>
  typeof value === "object" && value !== null && "__pw_jsx_fragment" in (value as object);

const wrappedComponents = new Map<unknown, unknown>();

function asReact(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(asReact);
  if (!isPwJsx(node)) return node;
  const { children, ...rest } = node.props ?? {};
  const props: Record<string, unknown> = { ...rest };
  if (node.key !== undefined && node.key !== null) props.key = node.key;
  const resolved = isPwFragment(node.type) ? Fragment : node.type;
  const type = typeof resolved === "function" ? wrapComponent(resolved) : resolved;
  if (children === undefined) return createElement(type as never, props);
  const kids = (Array.isArray(children) ? children : [children]).map(asReact);
  return createElement(type as never, props, ...(kids as never[]));
}

function wrapComponent(component: unknown): unknown {
  const cached = wrappedComponents.get(component);
  if (cached !== undefined) return cached;
  const wrapper = (props: Record<string, unknown>) =>
    asReact((component as (p: Record<string, unknown>) => unknown)(props));
  Object.defineProperty(wrapper, "name", {
    value: (component as { name?: string }).name ?? "Anonymous",
  });
  wrappedComponents.set(component, wrapper);
  return wrapper;
}

const jsx = (type: unknown, props: Record<string, unknown>): PwJsx => ({
  __pw_type: "jsx",
  type,
  props,
});

const MARKUP = renderToStaticMarkup(asReact(jsx(WalkthroughPanel, { summary: SUMMARY })) as never);

/** Captured the instant after the panel rendered and before any test has run:
 *  a panel that grabbed the camera on mount would have left a request here. */
const REQUEST_AFTER_RENDER = walkChannel.request();

const PAGE = `<main id="stage">${MARKUP}</main>`;

/* -------------------------------------------------------------- the geometry */

/** Polar angle of a pose, the way three's Spherical computes it: the angle
 *  from +Y of the vector from the TARGET to the CAMERA. OrbitControls clamps
 *  exactly this value. */
const polarAngleOf = (pose: WalkPose): number => {
  const dx = pose.eye[0] - pose.look[0];
  const dy = pose.eye[1] - pose.look[1];
  const dz = pose.eye[2] - pose.look[2];
  return Math.atan2(Math.hypot(dx, dz), dy);
};

const distanceOf = (pose: WalkPose): number =>
  Math.hypot(
    pose.eye[0] - pose.look[0],
    pose.eye[1] - pose.look[1],
    pose.eye[2] - pose.look[2],
  );

/** Ray-casting point-in-polygon on the plan (x, z). Written here rather than
 *  imported so "the eye is inside the room" is an INDEPENDENT answer and not
 *  the module agreeing with itself. */
function planContains(plan: readonly Pt2[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i, i += 1) {
    const [xi, zi] = plan[i];
    const [xj, zj] = plan[j];
    const straddles = zi > z !== zj > z;
    if (straddles && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** A real camera at Viewport's own lens, pointed at a pose. */
function frustumFor(pose: WalkPose, aspect: number): THREE.Frustum {
  const camera = new THREE.PerspectiveCamera(VIEWPORT_FOV_DEG, aspect, 1, 3000);
  camera.position.set(pose.eye[0], pose.eye[1], pose.eye[2]);
  camera.lookAt(pose.look[0], pose.look[1], pose.look[2]);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
  );
}

/** The eight corners of the home, roof and grade included. */
function homeCorners(summary: SiteSummary): THREE.Vector3[] {
  const b = summary.boundsWithRoof;
  const corners: THREE.Vector3[] = [];
  for (const x of [b.minX, b.maxX]) {
    for (const z of [b.minZ, b.maxZ]) {
      for (const y of [GRADE_Y_FT, summary.maxRidgeHeightFt]) {
        corners.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return corners;
}

/* ═══════════════════════════════════════════ 1. the detectors can fail ═══ */

test("every detector in this file still discriminates", () => {
  /* Comment-stripping. The module's header talks at length about what it does
     NOT do, and a scanner that could not tell prose from code would have to
     be switched off — which is worse than not having it. */
  expect(codeOf("/* dispatch */ const a = 1;")).not.toContain("dispatch");
  expect(codeOf("const a = dispatch;")).toContain("dispatch");

  /* Point-in-polygon, both ways, on a real plan. */
  const square: Pt2[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  expect(planContains(square, 5, 5)).toBe(true);
  expect(planContains(square, 15, 5)).toBe(false);

  /* The polar-angle probe. A LEVEL gaze is exactly 90°, which is what the
     clamp forbids — so the pass below cannot come from a probe that returns
     something harmless for every input. */
  const level: WalkPose = { eye: [0, 5, 0], look: [0, 5, -20] };
  expect(polarAngleOf(level)).toBeCloseTo(Math.PI / 2, 9);
  expect(polarAngleOf(level)).toBeGreaterThan(ORBIT_MAX_POLAR_RAD);
  const lookingUp: WalkPose = { eye: [0, 5, 0], look: [0, 15, -20] };
  expect(polarAngleOf(lookingUp)).toBeGreaterThan(Math.PI / 2);

  /* The frustum probe really can report "outside". */
  const near = frustumFor({ eye: [0, 5, 10], look: [0, 4, 0] }, VIEWPORT_MIN_ASPECT);
  expect(near.containsPoint(new THREE.Vector3(0, 4, 0))).toBe(true);
  expect(near.containsPoint(new THREE.Vector3(0, 400, 0))).toBe(false);

  /* The JSX scanner, which has to tell an element from a type argument — the
     whole reason the rig can be checked for "renders nothing" at all. */
  expect(JSX_TAG.test("  return <div />;")).toBe(true);
  expect(JSX_TAG.test("return (\n  <Panel label=\"x\">")).toBe(true);
  expect(JSX_TAG.test("const at = useRef<number>(0);")).toBe(false);
  expect(JSX_TAG.test("const s = new Set<WalkKeyAction>();")).toBe(false);
  expect(JSX_TAG.test("if (a < b) return;")).toBe(false);

  /* And the fixtures are real and populated. */
  expect(CATALOGUE.length).toBeGreaterThan(30);
  expect(SUMMARY.volumes.length).toBeGreaterThan(0);
});

/* ═══════════════════════════════ 2. the clamps this node cannot edit ═══ */

test("the module mirrors the camera limits Viewport actually mounts", () => {
  /* THE POINT OF THIS TEST. `Viewport.tsx` is outside this node's write-set,
     so the walkthrough carries copies of its three camera numbers. A copy is
     a divergence waiting to happen, so the copy is checked against the
     original on every run, and the original is parsed rather than trusted. */
  const minDistance = /minDistance=\{(\d+(?:\.\d+)?)\}/.exec(viewportSource);
  const maxPolar = /maxPolarAngle=\{Math\.PI \/ 2 - (\d+(?:\.\d+)?)\}/.exec(viewportSource);
  const fov = /fov:\s*(\d+(?:\.\d+)?),/.exec(viewportSource);

  expect(minDistance, "Viewport no longer mounts OrbitControls with a minDistance").not.toBeNull();
  expect(maxPolar, "Viewport's maxPolarAngle is no longer `Math.PI / 2 - <n>`").not.toBeNull();
  expect(fov, "Viewport's camera no longer declares a fov").not.toBeNull();
  if (!minDistance || !maxPolar || !fov) return;

  expect(ORBIT_MIN_DISTANCE_FT).toBe(Number(minDistance[1]));
  expect(ORBIT_MAX_POLAR_RAD).toBeCloseTo(Math.PI / 2 - Number(maxPolar[1]), 12);
  expect(VIEWPORT_FOV_DEG).toBe(Number(fov[1]));

  /* The aspect mirror names the NARROW stage, which is the one that is hard
     to fit a home into. If the stage stops carrying it, the exterior
     stand-off is being sized against a frame that no longer exists. */
  expect(viewportSource).toContain("aspect-[16/10]");
  expect(VIEWPORT_MIN_ASPECT).toBeCloseTo(16 / 10, 12);

  /* And the gaze really does clear the clamp with room to spare rather than
     sitting on it, which is where a rounding error becomes a moved camera. */
  expect(GAZE_BELOW_LEVEL_RAD).toBeGreaterThan(Math.PI / 2 - ORBIT_MAX_POLAR_RAD);
  expect(LOOK_AHEAD_MIN_FT).toBeGreaterThan(ORBIT_MIN_DISTANCE_FT);
});

test("the floor the eye stands on is the geometry engine's own datum", () => {
  /* The module says the finished floor is zero and grade is below it. That is
     geometry.ts's rule, so it is checked against geometry.ts's constants
     rather than restated. */
  expect(FINISHED_FLOOR_Y_FT).toBe(0);
  expect(FINISHED_FLOOR_Y_FT - GRADE_Y_FT).toBeCloseTo(FLOOR_SLAB_FT + PILE_EXPOSURE_FT, 12);
  expect(GRADE_Y_FT).toBeLessThan(FINISHED_FLOOR_Y_FT);
});

/* ══════════════════════ 3. every viewpoint of every plan is legal ═══ */

test("no viewpoint in the whole catalogue is one OrbitControls would move", () => {
  let checked = 0;
  for (const { id, summary } of CATALOGUE) {
    const { stops } = walkViewpoints(summary);
    expect(stops.length, `${id} produced no viewpoints`).toBeGreaterThanOrEqual(3);
    for (const stop of stops) {
      const polar = polarAngleOf(stop.pose);
      const distance = distanceOf(stop.pose);
      expect(
        polar,
        `${id} / ${stop.id}: the gaze is ${(polar * 180) / Math.PI}° from vertical, past the ` +
          `maxPolarAngle Viewport enforces — OrbitControls would tilt this camera on its first update`,
      ).toBeLessThan(ORBIT_MAX_POLAR_RAD);
      expect(polar, `${id} / ${stop.id}: the camera is under its own target`).toBeGreaterThan(0);
      expect(
        distance,
        `${id} / ${stop.id}: the look point is ${distance} ft away, inside OrbitControls' ` +
          `minDistance — the camera would be pushed backwards out of the place this label names`,
      ).toBeGreaterThanOrEqual(ORBIT_MIN_DISTANCE_FT);
      expect(Number.isFinite(stop.pose.eye[0] + stop.pose.eye[1] + stop.pose.eye[2])).toBe(true);
      checked += 1;
    }
  }
  expect(checked).toBeGreaterThan(90);
});

test("an interior viewpoint stands inside the room it names, on that room's floor", () => {
  let interiors = 0;
  for (const { id, summary } of CATALOGUE) {
    const { stops } = walkViewpoints(summary);
    for (const stop of stops) {
      if (stop.where !== "inside") continue;
      const volume = summary.volumes.find((v) => stop.id === `inside:${v.id}`);
      expect(volume, `${id} / ${stop.id} names no volume in the summary`).toBeDefined();
      if (!volume) continue;
      expect(
        planContains(volume.plan, stop.pose.eye[0], stop.pose.eye[2]),
        `${id} / ${stop.id}: the eye is outside the plan polygon of the volume it is named after`,
      ).toBe(true);
      expect(stop.pose.eye[1]).toBeCloseTo(FINISHED_FLOOR_Y_FT + EYE_HEIGHT_FT, 12);
      /* And the room really does have head-room over it: a viewpoint inside a
         volume whose eave is below the eye would be a camera in the roof. */
      expect(volume.eaveHeightFt).toBeGreaterThan(EYE_HEIGHT_FT);
      interiors += 1;
    }
  }
  expect(interiors).toBeGreaterThan(30);
});

test("the exterior viewpoints really do hold the whole home in a real frustum", () => {
  for (const { id, summary } of CATALOGUE) {
    const { stops } = walkViewpoints(summary);
    const corners = homeCorners(summary);
    for (const stop of stops) {
      if (stop.where !== "outside") continue;
      const frustum = frustumFor(stop.pose, VIEWPORT_MIN_ASPECT);
      for (const corner of corners) {
        expect(
          frustum.containsPoint(corner),
          `${id} / ${stop.id}: the corner (${corner.x}, ${corner.y}, ${corner.z}) is outside the ` +
            `${VIEWPORT_FOV_DEG}° frame at ${VIEWPORT_MIN_ASPECT} — the stand-off is too short`,
        ).toBe(true);
      }
    }
  }
});

test("that containment is a real constraint, not a frustum that swallows everything", () => {
  /* THE CONTROL for the test above. Stand a third of the derived distance away
     from the reference home and the roof leaves the frame — which is what the
     derivation is for, and what a magic factor would have got wrong silently. */
  const { stops } = walkViewpoints(SUMMARY);
  const approach = stops.find((stop) => stop.id === "approach");
  expect(approach).toBeDefined();
  if (!approach) return;

  const standOff = approachStandOffFt(SUMMARY);
  expect(standOff).toBeGreaterThan(LOOK_AHEAD_MIN_FT);

  const b = SUMMARY.boundsWithRoof;
  const cx = (b.minX + b.maxX) / 2;
  const tooNear: WalkPose = {
    eye: [cx, GRADE_Y_FT + EYE_HEIGHT_FT, b.maxZ + standOff / 3],
    look: [cx, GRADE_Y_FT + EYE_HEIGHT_FT - 2, b.minZ],
  };
  const missed = homeCorners(SUMMARY).filter(
    (corner) => !frustumFor(tooNear, VIEWPORT_MIN_ASPECT).containsPoint(corner),
  );
  expect(missed.length, "a third of the stand-off still framed the whole home").toBeGreaterThan(0);

  /* And the derivation moves with the home rather than being one number: a
     taller ridge needs more lawn. */
  const taller: SiteSummary = { ...SUMMARY, maxRidgeHeightFt: SUMMARY.maxRidgeHeightFt + 20 };
  expect(approachStandOffFt(taller)).toBeGreaterThan(standOff);
});

test("two volumes on one footprint get one viewpoint, and the panel says why", () => {
  const stacked = summarizeBuildingGraph(twoStoreyGraph());
  expect(stacked.volumes).toHaveLength(2);

  const { stops, sharedFootprints } = walkViewpoints(stacked);
  const insides = stops.filter((stop) => stop.where === "inside");
  expect(
    insides,
    "a stacked storey produced a second interior viewpoint at the same place with a different name",
  ).toHaveLength(1);
  expect(sharedFootprints).toBe(true);

  /* The control: a home whose volumes are genuinely apart keeps both. */
  const apart = summarizeHome({
    ...DOCUMENT.spec,
    volumes: [
      DOCUMENT.spec.volumes[0],
      { ...DOCUMENT.spec.volumes[0], id: "wing", name: "Wing", x: 60, z: 0 },
    ],
  });
  const spread = walkViewpoints(apart);
  expect(spread.stops.filter((stop) => stop.where === "inside")).toHaveLength(2);
  expect(spread.sharedFootprints).toBe(false);
});

/* ══════════════════════════════════ 4. the camera, on a real camera ═══ */

test("applying a pose puts a real three camera exactly where the viewpoint says", () => {
  const camera = new THREE.PerspectiveCamera(VIEWPORT_FOV_DEG, VIEWPORT_MIN_ASPECT, 1, 3000);
  let updates = 0;
  const controls = { target: new THREE.Vector3(0, 0, 0), update: () => (updates += 1) };
  expect(asOrbitControls(controls)).toBe(controls);

  const { stops } = walkViewpoints(SUMMARY);
  for (const stop of stops) {
    applyWalkPose(camera, asOrbitControls(controls), stop.pose);
    expect([camera.position.x, camera.position.y, camera.position.z]).toEqual([
      stop.pose.eye[0],
      stop.pose.eye[1],
      stop.pose.eye[2],
    ]);
    expect([controls.target.x, controls.target.y, controls.target.z]).toEqual([
      stop.pose.look[0],
      stop.pose.look[1],
      stop.pose.look[2],
    ]);
  }
  /* The target is only honoured if OrbitControls is told to re-read it. */
  expect(updates).toBe(stops.length);

  /* Reading the camera back gives a pose to glide FROM — the round trip is
     what makes the first frame of a move start where the eye already is. */
  const back = currentWalkPose(camera, asOrbitControls(controls));
  expect(back.eye).toEqual(stops[stops.length - 1].pose.eye);
  expect(back.look).toEqual(stops[stops.length - 1].pose.look);

  /* Without controls the camera still ends up POINTED at the look point. */
  const bare = new THREE.PerspectiveCamera(VIEWPORT_FOV_DEG, VIEWPORT_MIN_ASPECT, 1, 3000);
  const pose: WalkPose = { eye: [0, 6, 40], look: [0, 3, 0] };
  applyWalkPose(bare, null, pose);
  const forward = new THREE.Vector3();
  bare.getWorldDirection(forward);
  const wanted = new THREE.Vector3(
    pose.look[0] - pose.eye[0],
    pose.look[1] - pose.eye[1],
    pose.look[2] - pose.eye[2],
  ).normalize();
  expect(forward.distanceTo(wanted)).toBeLessThan(1e-6);

  /* And the guard really rejects things that are not controls, which is what
     stops a silent no-op the day drei changes its default registration. */
  expect(asOrbitControls(null)).toBeNull();
  expect(asOrbitControls({ update: () => undefined })).toBeNull();
  expect(asOrbitControls({ target: new THREE.Vector3() })).toBeNull();
});

test("a stepped move and a glided move land in exactly the same place", () => {
  const { stops } = walkViewpoints(SUMMARY);
  const from = stops[0].pose;
  const to = stops[stops.length - 1].pose;

  /* ONE write for reduced motion, and it is the destination — not a shorter
     tween, not a jump to somewhere approximate. */
  expect(walkFrames(true)).toBe(1);
  expect(walkPoseAt(from, to, walkFrames(true), 1)).toEqual(to);

  /* The glide passes through places that are neither end... */
  const frames = walkFrames(false);
  expect(frames).toBe(WALK_GLIDE_FRAMES);
  expect(frames).toBeGreaterThan(1);
  const middle = walkPoseAt(from, to, frames, Math.floor(frames / 2));
  expect(middle.eye).not.toEqual(from.eye);
  expect(middle.eye).not.toEqual(to.eye);

  /* ...and it is monotonic: every frame is closer to the destination than the
     one before it, so a glide cannot overshoot into the ground. */
  let previous = Infinity;
  for (let step = 1; step <= frames; step += 1) {
    const at = walkPoseAt(from, to, frames, step);
    const gap = Math.hypot(at.eye[0] - to.eye[0], at.eye[1] - to.eye[1], at.eye[2] - to.eye[2]);
    expect(gap).toBeLessThan(previous);
    previous = gap;
  }

  /* THE GUARANTEE THE REDUCED-MOTION RULE RESTS ON: both paths arrive at the
     identical pose, to the last bit rather than to six decimals. */
  expect(walkPoseAt(from, to, frames, frames)).toEqual(to);
  expect(walkPoseAt(from, to, frames, frames)).toEqual(walkPoseAt(from, to, 1, 1));
});

test("the camera's travel time is the interface's own, not a second opinion", () => {
  /* `--motion-travel` is the token every moving thing on the app surface uses
     (interface-motion.spec.ts pins it at 250 ms and inside the brand band).
     The camera is WebGL and cannot read a CSS token, so the number is carried
     in the module — and checked against the stylesheet here rather than
     assumed to have stayed in step. */
  const token = /--motion-travel:\s*(\d+)ms;/.exec(css);
  expect(token, "globals.css no longer declares --motion-travel").not.toBeNull();
  if (!token) return;
  expect(WALK_TRAVEL_MS).toBe(Number(token[1]));

  /* And the frame count really is that duration at 60 fps, rather than a
     round number that drifted away from the sentence the panel prints. */
  expect(WALK_GLIDE_FRAMES).toBe(Math.round((WALK_TRAVEL_MS * 60) / 1000));
});

/* ════════════════════════════ 5. stepping, keys and autoplay ═══ */

test("stepping reaches every viewpoint and can tell you where the ends are", () => {
  const { stops } = walkViewpoints(SUMMARY);
  const count = stops.length;

  const visited: number[] = [0];
  let at = 0;
  for (let i = 0; i < count * 2; i += 1) {
    at = walkIndex(at, "next", count);
    if (visited[visited.length - 1] !== at) visited.push(at);
  }
  expect(
    visited,
    "stepping forward did not reach every viewpoint — the stepped path is the whole reduced-motion guarantee",
  ).toEqual(stops.map((_, index) => index));

  /* Clamped, not wrapped: pressing Next at the end leaves you at the end, so
     "am I at the last one" is answerable without counting. */
  expect(walkIndex(count - 1, "next", count)).toBe(count - 1);
  expect(walkIndex(0, "previous", count)).toBe(0);
  expect(walkIndex(2, "first", count)).toBe(0);
  expect(walkIndex(0, "last", count)).toBe(count - 1);

  /* Autoplay is the one thing that wraps, and it says so by doing it. */
  expect(walkAutoplayNext(count - 1, count)).toBe(0);
  expect(walkAutoplayNext(0, count)).toBe(1);

  /* And autoplay is refused under reduced motion in the MODULE as well as in
     the stylesheet — the CSS hides the control, this refuses the behaviour. */
  expect(walkAutoplayAllowed(true)).toBe(false);
  expect(walkAutoplayAllowed(false)).toBe(true);
});

test("every key that works is a key the panel names, and the reverse", () => {
  const keys = Object.keys(WALK_KEYS);
  expect(keys.length).toBeGreaterThanOrEqual(6);
  for (const key of keys) {
    expect(WALK_KEY_NOTE, `${key} moves the camera and no sentence tells anybody`).toContain(key);
    expect(MARKUP, `${key} is not named anywhere in the rendered panel`).toContain(key);
  }
  /* Both directions and both ends are actually covered — a map of six aliases
     for "next" would satisfy the loop above. */
  const actions = Object.values(WALK_KEYS).filter(
    (action, at, all) => all.indexOf(action) === at,
  );
  expect(actions.slice().sort()).toEqual(["first", "last", "next", "previous"]);
});

/* ══════════════════════════ 6. a way of looking, not an edit ═══ */

test("walking the whole home leaves the document byte-identical", () => {
  const before = hashBuilderDocument(DOCUMENT);

  /* The summary is frozen, so a derivation that cached a field on it — the
     quiet way a "view" starts writing to a document — throws here instead of
     passing unnoticed. ES modules are strict mode; a silent no-op is not on
     the table. */
  const frozen = deepFreeze(summarizeHome(DOCUMENT.spec));
  const { stops } = walkViewpoints(frozen);

  const camera = new THREE.PerspectiveCamera(VIEWPORT_FOV_DEG, VIEWPORT_MIN_ASPECT, 1, 3000);
  const controls = { target: new THREE.Vector3(), update: () => undefined };
  let index = 0;
  for (let i = 0; i < stops.length * 2; i += 1) {
    index = walkIndex(index, i % 3 === 2 ? "previous" : "next", stops.length);
    const to = stops[index].pose;
    const from = currentWalkPose(camera, controls);
    for (let step = 1; step <= WALK_GLIDE_FRAMES; step += 1) {
      applyWalkPose(camera, controls, walkPoseAt(from, to, WALK_GLIDE_FRAMES, step));
    }
    expect([camera.position.x, camera.position.y, camera.position.z]).toEqual([
      to.eye[0],
      to.eye[1],
      to.eye[2],
    ]);
  }

  expect(hashBuilderDocument(DOCUMENT)).toBe(before);
  expect(hashBuilderDocument(DOCUMENT)).toMatch(/^0x[0-9a-f]{64}$/);
});

test("the module cannot edit a document, and the detector proves it by finding one that can", () => {
  const EDIT_VOCABULARY = /\b(dispatch|onEdit|applyEdit|editSpec|setSpec|useReducer|validateBuilderDocument)\b/;

  /* The control FIRST: a file that really does edit the document trips this,
     so the clean result below is a fact about Walkthrough.tsx rather than
     about a regex that matches nothing. */
  expect(EDIT_VOCABULARY.test(codeOf(read("components/builder/Plan2D.tsx")))).toBe(true);
  expect(
    EDIT_VOCABULARY.test(walkCode),
    "the walkthrough has learned to write to the document — a camera mode is a way of looking",
  ).toBe(false);

  /* It also never reaches for the export root or the canvas. The canvas is
     mounted once, by Viewport, and a second one would break every model
     download on the page. */
  expect(walkCode).not.toContain("<Canvas");
  expect(walkCode).not.toContain('from "./Viewport"');
  expect(walkCode).not.toContain("houseRef");

  /* And the panel does not move the camera on mount. Somebody arrives at the
     builder with the framing their document chose; this panel takes the camera
     only when it is asked to. */
  expect(REQUEST_AFTER_RENDER).toBeNull();
  expect(MARKUP).toContain('data-walk-started="no"');
});

test("the camera rig renders nothing, because houseChildren is inside the export root", () => {
  /* `houseChildren` mounts INSIDE `houseRef` — the group the .glb and .obj
     writers are handed. A rig that drew so much as a helper would ship inside
     somebody's model. It returns null, and that is checked rather than said. */
  const start = walkCode.indexOf("export function WalkthroughCameraRig(");
  const end = walkCode.indexOf("export const WALK_STEPPED_NOTE");
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const rig = walkCode.slice(start, end);

  expect(rig).toContain("return null;");
  expect(JSX_TAG.test(rig), "the camera rig now renders an element into the export root").toBe(
    false,
  );
  /* The control: the PANEL does render elements, so the scanner above is
     looking for something it can actually find. */
  expect(JSX_TAG.test(walkCode.slice(walkCode.indexOf("export default function")))).toBe(true);
});

test("no new dependency — every import resolves to something already installed", () => {
  const specifiers = Array.from(walkSource.matchAll(/from\s+"([^"]+)"/g)).map((match) => match[1]);
  expect(specifiers.length).toBeGreaterThan(3);

  const dependencies = Object.keys(packageJson.dependencies);
  const bare = specifiers.filter((name) => !name.startsWith(".") && !name.startsWith("@/"));
  const packageOf = (name: string) =>
    name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name.split("/")[0];

  const foreign = bare.filter((name) => !dependencies.includes(packageOf(name)));
  expect(
    foreign,
    `the walkthrough imports packages that are not in package.json's dependencies. A tour library ` +
      `is exactly what this node was told not to reach for:\n${foreign.join("\n")}`,
  ).toEqual([]);

  /* The detector discriminates: it really did find the R3F import, and it
     really would reject something that is not installed. */
  expect(bare).toContain("@react-three/fiber");
  expect(dependencies).not.toContain("react-tour");
  expect(["react-tour", "three"].filter((name) => !dependencies.includes(name))).toEqual([
    "react-tour",
  ]);
});

/* ═══════════════════ 7. the panel, measured in a real browser ═══ */

async function mount(page: Page, motion: "reduce" | "no-preference"): Promise<void> {
  await page.emulateMedia({ reducedMotion: motion });
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.setContent(PAGE);
  await page.addStyleTag({ content: css });
}

interface ControlProbe {
  selector: string;
  display: string;
  width: number;
  height: number;
}

const probe = (page: Page) =>
  page.evaluate(() => {
    const measure = (element: Element, selector: string) => {
      const rect = element.getBoundingClientRect();
      return {
        selector,
        display: getComputedStyle(element).display,
        width: rect.width,
        height: rect.height,
      };
    };
    const all = (selector: string) =>
      Array.from(document.querySelectorAll(selector)).map((element) => measure(element, selector));
    const one = (selector: string) => all(selector)[0] ?? null;
    return {
      stops: all(".walk-stop"),
      steps: all(".walk-step"),
      play: one(".walk-play"),
      glide: one(".walk-note-glide"),
      stepped: one(".walk-note-stepped"),
      eye: (document.querySelector(".walk-eye") as HTMLElement | null)?.textContent ?? "",
      panelBackground: getComputedStyle(document.querySelector(".walk") as Element).backgroundColor,
      eyeFontPx: Number.parseFloat(
        getComputedStyle(document.querySelector(".walk-eye") as Element).fontSize,
      ),
      basisFontPx: Number.parseFloat(
        getComputedStyle(document.querySelector(".walk-basis") as Element).fontSize,
      ),
    };
  });

const hasBox = (control: ControlProbe | null): boolean =>
  control !== null && control.display !== "none" && control.width > 0 && control.height > 0;

test("reduced motion keeps every step of the path and removes exactly one control", async ({
  page,
}) => {
  await mount(page, "no-preference");
  const moving = await probe(page);

  /* THE CONTROL: the stylesheet really attached, so "display: none" below is
     a rule doing its job rather than a page with no CSS on it. */
  expect(moving.panelBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(moving.stops.length).toBe(walkViewpoints(SUMMARY).stops.length);
  expect(moving.stops.length).toBeGreaterThanOrEqual(3);
  expect(moving.steps).toHaveLength(2);

  /* Ordinary preference: the whole panel, including Present. */
  for (const stop of moving.stops) expect(hasBox(stop)).toBe(true);
  for (const step of moving.steps) expect(hasBox(step)).toBe(true);
  expect(hasBox(moving.play)).toBe(true);
  expect(hasBox(moving.glide)).toBe(true);
  expect(hasBox(moving.stepped), "the stepped sentence is showing to somebody being glided").toBe(
    false,
  );

  await mount(page, "reduce");
  const still = await probe(page);

  /* THE GUARANTEE. Every viewpoint still has a control with a real box, and
     both step controls survive — the path is not shortened, only the travel
     between its stops is. */
  expect(still.stops.length).toBe(moving.stops.length);
  for (const stop of still.stops) expect(hasBox(stop)).toBe(true);
  for (const step of still.steps) expect(hasBox(step)).toBe(true);

  /* And exactly one control goes away: the one whose whole purpose is a
     camera that moves without being asked. */
  expect(hasBox(still.play)).toBe(false);
  expect(still.play?.display).toBe("none");

  /* The sentences swap with it, so the panel never describes behaviour the
     reader is not getting. */
  expect(hasBox(still.stepped)).toBe(true);
  expect(hasBox(still.glide)).toBe(false);
});

test("the tab order under reduced motion loses one control, and it is Present", async ({ page }) => {
  const order = async (motion: "reduce" | "no-preference") => {
    await mount(page, motion);
    const seen: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      await page.keyboard.press("Tab");
      const at = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        return (
          element.getAttribute("data-walk-action") ??
          element.getAttribute("data-walk-viewpoint") ??
          element.tagName.toLowerCase()
        );
      });
      if (at === null) break;
      if (seen.includes(at)) break;
      seen.push(at);
    }
    return seen;
  };

  const moving = await order("no-preference");
  const still = await order("reduce");

  /* Every control is a real, focusable button — nothing here needs a mouse. */
  expect(moving.length).toBeGreaterThanOrEqual(5);
  expect(moving.slice(0, 3)).toEqual(["previous", "next", "play"]);
  expect(moving).toContain("approach");
  expect(moving).toContain("north");

  /* And the reduced-motion tab order is the same list minus Present. Nothing
     else is quietly unreachable. */
  expect(still).toEqual(moving.filter((item) => item !== "play"));
});

test("the eye height the panel prints is the height the camera actually stands at", async ({
  page,
}) => {
  await mount(page, "no-preference");
  const read = await probe(page);

  /* Parse the SENTENCE, not the constant: the point is that copy and geometry
     cannot drift apart, so the number is taken from the rendered page and
     compared to where a real interior viewpoint puts the camera. */
  const printed = /(\d+)\s*ft(?:\s*(\d+)\s*in)?/.exec(read.eye);
  expect(printed, `no feet-and-inches figure in the eye-height line: "${read.eye}"`).not.toBeNull();
  if (!printed) return;
  const printedFt = Number(printed[1]) + (printed[2] ? Number(printed[2]) / 12 : 0);

  const inside = walkViewpoints(SUMMARY).stops.find((stop) => stop.where === "inside");
  expect(inside).toBeDefined();
  if (!inside) return;

  expect(printedFt).toBeCloseTo(inside.pose.eye[1] - FINISHED_FLOOR_Y_FT, 6);
  expect(printedFt).toBeCloseTo(EYE_HEIGHT_FT, 6);
  expect(read.eye).toContain(formatFeetInchesWords(EYE_HEIGHT_FT));

  /* The exterior viewpoints stand the same height above GRADE, which is the
     other half of what that sentence claims. */
  const outside = walkViewpoints(SUMMARY).stops.find((stop) => stop.where === "outside");
  expect(outside?.pose.eye[1]).toBeCloseTo(GRADE_Y_FT + printedFt, 6);

  /* A stated assumption is not a footnote: it is set no smaller than the
     viewpoint's own basis line, measured rather than intended. */
  expect(read.eyeFontPx).toBeGreaterThanOrEqual(read.basisFontPx);
  expect(read.eyeFontPx).toBeGreaterThan(0);
});

test("every figure the panel prints is one the camera is placed from", () => {
  /* The wave's standing lesson: a panel that printed figures nothing checked
     shipped twice, and both were false. So each number in the rendered markup
     is tied back to the value that produced it. */
  const { stops } = walkViewpoints(SUMMARY);
  const standOff = approachStandOffFt(SUMMARY);
  const approach = stops.find((stop) => stop.id === "approach");
  const inside = stops.find((stop) => stop.where === "inside");
  expect(approach && inside).toBeTruthy();
  if (!approach || !inside) return;

  /* The approach basis prints its stand-off, its ridge and its margin, and
     every one of them is the number that placed the camera. */
  expect(approach.basis).toContain(formatFeetInchesWords(standOff));
  expect(approach.basis).toContain(formatFeetInchesWords(SUMMARY.maxRidgeHeightFt));
  expect(approach.basis).toContain(formatFeetInchesWords(APPROACH_MARGIN_FT));
  expect(approach.basis).toContain(`${VIEWPORT_FOV_DEG}°`);
  expect(approach.pose.eye[2] - SUMMARY.boundsWithRoof.maxZ).toBeCloseTo(standOff, 9);

  /* The interior basis prints the axis it is looking down, and that is the
     longer of the volume's two plan edges rather than a rounded guess. */
  const volume = SUMMARY.volumes.find((v) => inside.id === `inside:${v.id}`);
  expect(volume).toBeDefined();
  if (!volume) return;
  const a = Math.hypot(volume.plan[1][0] - volume.plan[0][0], volume.plan[1][1] - volume.plan[0][1]);
  const b = Math.hypot(volume.plan[2][0] - volume.plan[1][0], volume.plan[2][1] - volume.plan[1][1]);
  expect(inside.basis).toContain(formatFeetInchesWords(Math.max(a, b)));
  expect(Math.max(a, b)).toBeGreaterThan(0);

  /* And the panel really did render those sentences rather than a summary of
     them. */
  expect(MARKUP).toContain(EYE_HEIGHT_NOTE);
});

/* ═══════════════════════════════════════════════════ 8. in a served build ═══ */

test.describe("in a served build", () => {
  /* SKIPPED without a baseURL — which is every run until TWO things happen
     that are outside this node's write-set: the orchestrator mounts
     <WalkthroughPanel> and <WalkthroughCameraRig> in BuilderApp.tsx, and adds
     this file to playwright.ui.config.ts's testMatch. Reported as unexecuted
     rather than quietly counted as green. Everything above this line runs. */
  test.skip(
    ({ baseURL }) => !baseURL,
    "needs a served build (playwright.ui.config.ts) and the mount in BuilderApp.tsx",
  );

  test("walking the home moves the camera and moves nothing else", async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/build?mode=guided");

    const root = page.locator("[data-active-design-hash]");
    const viewport = page.locator(".builder-viewport");
    const canvas = viewport.locator("canvas");
    const walk = page.locator("[data-walkthrough]");
    await expect(canvas).toBeAttached({ timeout: 90_000 });
    await expect(walk).toBeVisible();

    const MARK = "walk01-same-canvas";
    await canvas.evaluate((element, mark) => {
      (element as HTMLCanvasElement & { __walk01?: string }).__walk01 = mark;
    }, MARK);
    const hash = await root.getAttribute("data-active-design-hash");
    const geometry = await viewport.getAttribute("data-scene-geometry");

    /* Nothing has been asked for yet, so nothing has moved. */
    await expect(walk).toHaveAttribute("data-walk-started", "no");
    await expect(walk).toHaveAttribute("data-walk-camera", "not moved");
    await expect(walk).toHaveAttribute("data-walk-motion", "stepped");

    /* One press. Under reduced motion that is ONE write of the camera — the
       stepped path, measured by the rig that did the writing. */
    await walk.locator("[data-walk-viewpoint='north']").click();
    await expect(walk).toHaveAttribute("data-walk-started", "yes");
    await expect(walk).not.toHaveAttribute("data-walk-camera", "not moved");
    await expect(walk).toHaveAttribute("data-walk-writes", "1");

    /* And it landed where the viewpoint said, read back off the real camera
       rather than off the request. */
    const north = walkViewpoints(SUMMARY).stops.find((stop) => stop.id === "north");
    expect(north).toBeDefined();
    if (north) {
      const landed = (await walk.getAttribute("data-walk-camera")) ?? "";
      const [x, y, z] = landed.split(" ").map(Number);
      expect(Math.hypot(x - north.pose.eye[0], y - north.pose.eye[1], z - north.pose.eye[2])).toBeLessThan(0.02);
    }

    /* The whole point: a camera mode is a way of looking. The canvas is the
       same element, the load epoch has not moved, the design hash is the same
       string, and the built geometry is untouched. */
    await expect(canvas).toHaveJSProperty("__walk01", MARK);
    await expect(viewport).toHaveAttribute("data-load-epoch", "0");
    await expect(root).toHaveAttribute("data-active-design-hash", hash!);
    await expect(viewport).toHaveAttribute("data-scene-geometry", geometry!);
  });

  test("the keyboard walks the home, and Present is not offered to reduced motion", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/build?mode=guided");
    const canvas = page.locator(".builder-viewport canvas");
    const walk = page.locator("[data-walkthrough]");
    await expect(canvas).toBeAttached({ timeout: 90_000 });
    await expect(walk).toBeVisible();

    await expect(walk.locator(".walk-play")).toBeHidden();

    await walk.locator("[data-walk-action='next']").focus();

    /* The camera each keypress actually reached, not just the index the panel
       moved to. `data-walk-camera` is written by the rig INSIDE the canvas
       when a move lands, so asserting it proves the whole path — panel to
       channel to rig to camera — rather than proving React set a number.
       Waiting for it between presses is also what makes the counts below
       meaningful; see the note on coalescing. */
    const landed = async () => {
      await expect(walk).not.toHaveAttribute("data-walk-camera", "not moved");
      return walk.getAttribute("data-walk-camera");
    };

    await page.keyboard.press("ArrowRight");
    await expect(walk).toHaveAttribute("data-walk-index", "1");
    const atOne = await landed();

    await page.keyboard.press("End");
    const count = Number((await walk.getAttribute("data-walk-count")) ?? "0");
    await expect(walk).toHaveAttribute("data-walk-index", String(count - 1));
    await expect(walk).not.toHaveAttribute("data-walk-camera", String(atOne));
    const atEnd = await landed();

    await page.keyboard.press("Home");
    await expect(walk).toHaveAttribute("data-walk-index", "0");
    await expect(walk).not.toHaveAttribute("data-walk-camera", String(atEnd));

    /* THREE keypresses, three places to stand, and the canvas never remounted
       under any of them — `data-walk-writes` is cumulative for the life of the
       rig, so a remount would reset it.

       IT IS NOT PINNED TO AN EXACT NUMBER, and that is deliberate rather than
       lazy. The viewport runs `frameloop="demand"`: the rig stores one pending
       move and each new request replaces it, so two keypresses with no frame
       between them land ONE write and go straight to the second viewpoint.
       That is correct behaviour — nobody wants a queue of stale camera moves —
       but it means an exact count measures the browser's frame scheduling
       rather than the walk. The original assertion here pinned "4" for three
       keypresses and had never once executed, because the file sat in the unit
       gate where `baseURL` is undefined and the whole block skipped itself. */
    const writes = Number((await walk.getAttribute("data-walk-writes")) ?? "0");
    expect(writes, "the rig never wrote the camera, so nothing walked").toBeGreaterThan(0);
    expect(
      writes,
      "more camera writes than moves requested — the rig is replaying or the canvas remounted",
    ).toBeLessThanOrEqual(3);
  });
});

/* --------------------------------------------------------------------------- */

/** Freeze an object and everything it holds. */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return Object.freeze(value);
}
