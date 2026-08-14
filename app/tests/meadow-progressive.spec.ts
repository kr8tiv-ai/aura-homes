import { expect, test } from "playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  MEADOW_MAX_PAGE_INSTANCES,
  MEADOW_SPARKLE_SPEED,
  chooseMeadowPlan,
  createMeadowSchedule,
  isMeadowReady,
  shouldStartMeadow,
} from "@/lib/three/meadow/contract";
import { buildMeadowPage, meadowTransferList } from "@/lib/three/meadow/generator";
import { MeadowPromotionGovernor } from "@/lib/three/meadow/governor";
import { sampleMeadowClearance, sampleTerrainHeight } from "@/lib/three/meadow/field";
import { buildFlowerField, flowerVisibilityAtDistance } from "@/components/story/flora";
import { pathToFileURL } from "node:url";

/* The generator is real ESM (import.meta); Playwright transpiles specs to
   CJS, so a static import cannot load it. This indirection keeps the dynamic
   import out of the transpiler's reach and Node loads the module natively.
   Its entry guard makes importing side-effect free. */
const importAtlasGenerator = () =>
  (new Function("specifier", "return import(specifier)")(
    pathToFileURL(path.join(__dirname, "..", "scripts", "generate-meadow-atlas.mjs")).href,
  )) as Promise<{
    clearance: (x: number, z: number) => number;
    terrainHeight: (x: number, z: number) => number;
  }>;

const appRoot = path.resolve(__dirname, "..");

test("the promoted meadow is transferred from a worker in bounded pages", async () => {
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");
  const worker = await readFile(path.join(appRoot, "workers/meadow.worker.ts"), "utf8");

  expect(detail).toContain("useProgressiveMeadow");
  expect(detail).not.toMatch(/useMemo\(\(\) => buildGrassTiles/);
  expect(detail).not.toContain("function buildGrassTiles");
  expect(worker).toContain("postMessage");
  expect(worker).toContain("transfer");
  expect(detail).toContain("enabled: includeMeadow");
});

test("the built visual proof measures the installed hardware Chrome renderer", async () => {
  const proof = await readFile(path.join(appRoot, "scripts/meadow-proof.mjs"), "utf8");
  expect(proof).toContain('channel: "chrome"');
  expect(proof).toContain('"--use-angle=d3d11"');
  expect(proof).toContain("UNMASKED_RENDERER_WEBGL");
  expect(proof).toContain("rendererIsSoftware");
});

test("the built proof measures botanical texture and visible flowers at fixed cameras", async () => {
  const proof = await readFile(path.join(appRoot, "scripts/meadow-proof.mjs"), "utf8");

  expect(proof).toContain("vegetationTextureCoverage");
  expect(proof).toContain("flowerVisibility");
  expect(proof).toContain("activeFrameP95Ms");
  expect(proof).toContain("livingWind");
  expect(proof).toContain("fullRunRenderP95Ms <= 16.7");
  /* Interactions carry two budgets: first night toggle may pay one-time
     program compilation (250 ms ceiling); every later toggle must stay
     inside the strict 160 ms steady-state budget. */
  expect(proof).toContain("interactionMs <= 250");
  expect(proof).toContain("steadyInteractionMs <= 160");
  expect(proof).toContain("waitForCameraSettled(page, FIXED_CAMERAS.close.scrollY)");
  expect(proof).toContain("current >= baseline * 0.98");
  expect(proof).not.toContain("function edgeCoverage");
});

test("the hardware proof measures the entered mobile meadow at its own frame and flower budget", async () => {
  const proof = await readFile(path.join(appRoot, "scripts/meadow-proof.mjs"), "utf8");

  expect(proof).toContain("MOBILE_VIEWPORT");
  expect(proof).toContain("width: 390, height: 844");
  expect(proof).toContain("mobile.activeFrameP95Ms <= 33.3");
  expect(proof).toContain("mobile.flowerVisibility?.planted === 380");
  expect(proof).toContain('mobile.flowerVisibility?.source === "instanced-flower-field"');
  expect(proof).toContain('page.locator(".aura-loader").waitFor({ state: "detached"');
  expect(proof).toContain("const mobileCamera = await waitForCameraSettled");
  expect(proof).toContain("mobile.camera?.settled === true");
  expect(proof).toContain("async function waitForMeadowHandoff(page)");
  expect(proof).toContain("await waitForMeadowHandoff(page)");
});

test("the terrain carries a procedural anti-aliased meadow tuft surface", async () => {
  const scene = await readFile(path.join(appRoot, "components/story/Scene.tsx"), "utf8");

  expect(scene).toContain("float terraTuft(");
  expect(scene).toContain("float terraMeadowFacet(");
  expect(scene).toContain("fwidth(");
  expect(scene).toContain("terraBotanical");
  expect(scene).toContain("terraFacetDetail * terraBotanical");
  expect(scene).not.toContain("uMeadowDetailMap");
});

test("the proven real instanced FlowerField owns flower visibility", async () => {
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");
  const flora = await readFile(path.join(appRoot, "components/story/flora.ts"), "utf8");

  expect(detail).toContain("buildFlowerField");
  expect(detail).toContain("makeFlowerMaterial");
  expect(detail).toContain("function FlowerField");
  expect(detail).toContain("countVisibleFlowerHeads");
  expect(detail).toContain('CustomEvent("aura:flower-visibility"');
  expect(detail).toContain('name="aura-flower-field"');
  expect(detail).toContain('name="aura-instanced-flower-field"');
  expect(detail).toContain('source: "instanced-flower-field"');
  expect(detail).toContain("flowerVisibilityAtDistance(distance, instances.getW(index))");
  expect(flora).toContain("float travelling = sin(uTime * 0.62 - dot(aPos.xz, wd) * 0.135)");
  expect(flora).toContain("float crossWave = sin(uTime * 0.41 + aPos.x * 0.082 - aPos.z * 0.057 + ph)");
  expect(flora).toContain("float ripple = sin(uTime * 1.85 + aPos.x * 0.31 + aPos.z * 0.23 + ph * 0.5)");
  expect(flora).toContain("float windYaw = crossWave * 0.30 + ripple * 0.06");
  expect(flora).not.toContain("float yaw = crossWave");
  expect(flora).not.toContain("vnoise(aPos.xz * 0.055 + wd * uTime * 0.30)");
  expect(detail).toContain("const distance = root.distanceTo(camera.position)");
  expect(detail).not.toContain("const distance = head.distanceTo(camera.position)");
  expect(detail).not.toContain("resource.flowerHeads");
});

test("hero grass, the grass atlas, and one real flower draw stay bounded", async () => {
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");
  const atlas = detail.slice(
    detail.indexOf("OFFLINE MEADOW ATLAS"),
    detail.indexOf("THE LAYER", detail.indexOf("OFFLINE MEADOW ATLAS")),
  );
  expect(detail).toContain("uniform vec4 uLod;");
  expect(detail).toContain("uniform float uRichWind;");
  expect(detail).toContain("vertexShader: grassVert()");
  expect(detail).toContain("uLod: { value: new THREE.Vector4(cfg.pmin, cfg.near, cfg.far, cfg.band) }");
  expect(detail).not.toContain("vertexShader: grassVert(cfg)");
  expect(detail).not.toContain("float vnoise(vec2 p)");
  expect(detail).toContain("float travelling = sin(uTime * 0.62 - dot(base.xz, wd) * 0.135)");
  expect(detail).toContain("warmScene.add(mesh)");
  expect(atlas).toContain("function MeadowAtlasField");
  expect(atlas).toContain("alphaTest: MEADOW_ATLAS_ALPHA_TEST");
  expect(atlas).toContain("transparent: false");
  expect(atlas).not.toContain("CanvasTexture");
  expect(detail).toContain("makeFlowerMaterial()");
  expect(detail).toContain("<FlowerField");
});

test("only bounded hero blades remain live geometry", async () => {
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");
  const contract = await readFile(path.join(appRoot, "lib/three/meadow/contract.ts"), "utf8");
  expect(contract).toContain('layer: "hero", x0: -24, x1: 24, z0: -12, z1: 48, tile: 12, density: 20');
  expect(contract).not.toContain('layer: "fill"');
  expect(contract).not.toContain('layer: "mid"');
  expect(contract).not.toContain('layer: "far"');
  expect(detail).not.toContain("fillPages");
  expect(detail).not.toContain("midPages");
  expect(detail).not.toContain("farPages");
});

test("the meadow atlas is an owned reproducible build artifact, never runtime rasterization", async () => {
  const generator = await readFile(path.join(appRoot, "scripts/generate-meadow-atlas.mjs"), "utf8");
  const metadata = JSON.parse(await readFile(path.join(appRoot, "public/textures/meadow-atlas.json"), "utf8"));
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");
  const atlas = detail.slice(
    detail.indexOf("OFFLINE MEADOW ATLAS"),
    detail.indexOf("THE LAYER", detail.indexOf("OFFLINE MEADOW ATLAS")),
  );

  expect(metadata.schema).toBe("ProgressiveMeadowMappedAtlasV6");
  expect(metadata.license).toBe("Aura-authored");
  expect(metadata.alphaMode).toBe("MASK");
  expect(metadata.alphaCutoff).toBe(0.42);
  expect(generator).toContain("const ALPHA_CUTOFF = 0.42");
  expect(detail).toContain("const MEADOW_ATLAS_ALPHA_TEST = 0.42");
  expect(metadata.draws).toBe(1);
  expect(metadata.files.image.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(metadata.files.instances.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(generator).toContain("--verify");
  expect(generator).toContain("sha256");
  expect(generator).toContain("ANGULAR_LEAF_FACETS");
  expect(generator).toContain("ANGULAR_LEAF_WIDTH_SCALE");
  expect(generator).toContain("paintAngularBlade");
  expect(generator).not.toContain("MATTE_FACET_BANDS");
  expect(metadata.schema).toBe("ProgressiveMeadowMappedAtlasV6");
  expect(metadata.generation.angularLeafFacets).toBe(true);
  expect(metadata.generation.angularLeafWidthScale).toBe(1.24);
  expect(metadata.generation.polygonSegments).toEqual([9, 12]);
  expect(metadata.generation.grassProfile).toBe("asymmetric-fan-v1");
  expect(metadata.generation.fanGrassCells).toBe(6);
  expect(metadata.generation.maxSeedHeadsPerGrassCell).toBe(2);
  expect(metadata.generation.longitudinalMidribs).toBe(true);
  expect(metadata.generation.midribsPreserveAlpha).toBe(true);
  expect(metadata.generation.synchronizedBands).toBe(false);
  expect(atlas).toContain('withBase("/textures/meadow-atlas.png")');
  expect(atlas).toContain('withBase("/textures/meadow-atlas.bin")');
  expect(atlas).not.toMatch(/createElement\(["']canvas["']\)/);
});

test("legacy source slots are deterministically remapped to grass at render time", async () => {
  const metadata = JSON.parse(await readFile(path.join(appRoot, "public/textures/meadow-atlas.json"), "utf8"));
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");

  expect(metadata.instances.total).toBe(3_600);
  expect(metadata.instances.grass).toBe(2_800);
  expect(metadata.instances.flowers).toBe(800);
  expect(metadata.renderedInstances).toEqual({ total: 3_600, grass: 3_600, flowers: 0 });
  expect(metadata.files.instances.sha256).toBe("0913e10585871853e184545a79a49426e1ffd9c680dbd297d28b931deff9b849");
  expect(detail).toContain('name="aura-meadow-atlas"');
  expect(detail).not.toContain("flowerHeads: Float32Array");
  expect(detail).toContain("mappedGrassCell");
  expect(detail).toContain("sourceKind === 0");
});

test("the real flower builder exposes deterministic projected heads", () => {
  const built = buildFlowerField(1_000, true, {
    ground: () => 0,
    density: () => 1,
    clearance: () => 1,
  });

  expect(built).not.toBeNull();
  expect(built?.placed).toBe(1_000);
  const withHeads = built as (typeof built & { heads?: Float32Array });
  expect(withHeads?.heads).toBeInstanceOf(Float32Array);
  expect(withHeads?.heads?.length).toBe(3_000);
  const roots = built?.geo.getAttribute("aPos");
  const instances = built?.geo.getAttribute("aInst");
  const stemHeights = Array.from({ length: instances?.count ?? 0 }, (_, index) => instances?.getY(index) ?? 0);
  expect(Math.min(...stemHeights)).toBeGreaterThanOrEqual(0.16);
  expect(Math.max(...stemHeights)).toBeLessThanOrEqual(0.32);
  expect(withHeads?.heads?.[0]).toBeCloseTo(roots?.getX(0) ?? 0, 5);
  expect(withHeads?.heads?.[1]).toBeCloseTo(
    (roots?.getY(0) ?? 0) + (instances?.getY(0) ?? 0),
    5,
  );
  expect(withHeads?.heads?.[2]).toBeCloseTo(roots?.getZ(0) ?? 0, 5);
  built?.geo.dispose();
});

test("CPU flower visibility follows the shader's individual 18-to-30-metre fade", () => {
  expect(flowerVisibilityAtDistance(10, 0.5)).toBe(1);
  expect(flowerVisibilityAtDistance(24, 0.95)).toBe(0);
  expect(flowerVisibilityAtDistance(24, 0.1)).toBeGreaterThan(0);
  expect(flowerVisibilityAtDistance(30, 0)).toBe(0);
  expect(flowerVisibilityAtDistance(70, 0)).toBe(0);
});

test("worker generation timing cannot freeze the main-thread governor and terminal monitoring stops once", async () => {
  const runtime = await readFile(path.join(appRoot, "lib/three/meadow/runtime.ts"), "utf8");
  expect(runtime).not.toContain("governor.observeLongTask(event.data.workerMs)");
  expect(runtime).toContain("let terminal = false");
  expect(runtime).toContain("const stopMonitoring = () =>");
  expect(runtime).toContain("if (terminal) return true");
});

test("the meadow waits for one asynchronous grass-program warmup", async () => {
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");
  expect(detail).toContain("function GrassProgramWarmup");
  expect(detail).toContain("gl.compileAsync(warmScene, camera)");
  expect(detail).toContain("warmFlowerBuilt");
  expect(detail).toContain("warmScene.add(flowerMesh)");
  expect(detail).toContain("enabled: includeMeadow && grassProgramReady");
});

test("a worker load failure keeps a bounded static meadow fallback", async () => {
  const runtime = await readFile(path.join(appRoot, "lib/three/meadow/runtime.ts"), "utf8");

  expect(runtime).toContain("worker.onerror");
  expect(runtime).toContain("startFallback");
  expect(runtime).toContain('maxTier: "mid"');
});

test("landing sparkles drift at the approved dust-mote speed", async () => {
  const scene = await readFile(path.join(appRoot, "components/story/Scene.tsx"), "utf8");

  /* 0.25 is the approved 3D dust-mote drift. The quarter-speed rule belongs
     to the DOM border-star tracer (CARD_TRACER_SPEED_PX_PER_SECOND), which
     scene-quality.spec.ts pins separately — misapplying it here shipped
     near-motionless motes. The literal stays banned so the constant rules. */
  expect(scene).toContain("MEADOW_SPARKLE_SPEED");
  expect(scene).not.toContain("speed={reduced ? 0 : 0.25}");
  expect(MEADOW_SPARKLE_SPEED).toBe(0.25);
});

test("the schedule makes the opening meadow first and keeps every page bounded", () => {
  const plan = chooseMeadowPlan({ width: 1440, reducedMotion: false, lowPower: false });
  const schedule = createMeadowSchedule(plan);

  expect(schedule.length).toBeGreaterThan(30);
  expect(schedule[0].tier).toBe("near");
  expect(MEADOW_MAX_PAGE_INSTANCES).toBe(2_000);
  expect(schedule.slice(0, 12).every((page) => page.tier === "near" && page.capacity === 2_000)).toBe(true);
  expect(Math.max(...schedule.map((page) => page.capacity))).toBeLessThanOrEqual(
    MEADOW_MAX_PAGE_INSTANCES,
  );
  const completeInventory = schedule.map(buildMeadowPage).reduce((sum, page) => sum + page.count, 0);
  expect(completeInventory).toBeGreaterThanOrEqual(Math.floor(22_845 * 0.97));
  expect(completeInventory).toBeLessThanOrEqual(Math.ceil(22_845 * 1.03));
  expect(plan.flowerCount).toBe(1_000);
});

test("meadow construction remains dormant before its progressive scene stage", () => {
  expect(shouldStartMeadow(false)).toBe(false);
  expect(shouldStartMeadow(true)).toBe(true);
});

test("the opening is ready only after a composed near-field floor exists", () => {
  const plan = chooseMeadowPlan({ width: 1440, reducedMotion: false, lowPower: false });
  const tasks = createMeadowSchedule(plan);
  const opening = tasks.slice(0, 10).map(buildMeadowPage);

  expect(isMeadowReady([])).toBe(false);
  expect(isMeadowReady(opening.slice(0, 9))).toBe(false);
  expect(isMeadowReady(opening)).toBe(true);
  expect(opening.reduce((sum, page) => sum + page.count, 0)).toBeGreaterThanOrEqual(15_000);
});

test("worker pages are deterministic and expose only transferable array buffers", () => {
  const plan = chooseMeadowPlan({ width: 1440, reducedMotion: false, lowPower: false });
  const task = createMeadowSchedule(plan)[0];
  const first = buildMeadowPage(task);
  const second = buildMeadowPage(task);

  expect(first.count).toBeGreaterThan(100);
  expect(Array.from(first.positions.slice(0, 36))).toEqual(Array.from(second.positions.slice(0, 36)));
  expect(Array.from(first.random.slice(0, 32))).toEqual(Array.from(second.random.slice(0, 32)));
  const fadeSeeds = Array.from({ length: first.count }, (_, index) => first.random[index * 4 + 3]);
  expect(fadeSeeds).toEqual([...fadeSeeds].sort((a, b) => a - b));
  expect(meadowTransferList(first)).toEqual([
    first.positions.buffer,
    first.random.buffer,
    first.clearance.buffer,
  ]);
});

test("the governor retains the last healthy tier after a long task", () => {
  const governor = new MeadowPromotionGovernor({ frameBudgetMs: 16.7, longTaskLimitMs: 50 });
  governor.markHealthy("near");
  governor.observeLongTask(50.1);

  expect(governor.snapshot()).toEqual(
    expect.objectContaining({ frozen: true, lastHealthyTier: "near", reason: "long-task" }),
  );
  expect(governor.canAccept("mid")).toBe(false);
});

test("the governor freezes promotion when measured p95 frames miss budget", () => {
  const governor = new MeadowPromotionGovernor({ frameBudgetMs: 16.7, longTaskLimitMs: 50 });
  governor.markHealthy("near");
  for (let i = 0; i < 54; i += 1) governor.observeFrame(14);
  for (let i = 0; i < 6; i += 1) governor.observeFrame(29);

  expect(governor.snapshot()).toEqual(
    expect.objectContaining({ frozen: true, lastHealthyTier: "near", reason: "frame-budget" }),
  );
});

test("a short frame-scheduling burst cannot freeze progressive promotion", () => {
  const governor = new MeadowPromotionGovernor({ frameBudgetMs: 16.7, longTaskLimitMs: 50 });
  governor.markHealthy("near");
  for (let i = 0; i < 20; i += 1) governor.observeFrame(i % 4 === 0 ? 27 : 16.7);

  expect(governor.snapshot().p95FrameMs).toBeGreaterThan(20);
  expect(governor.snapshot().frozen).toBe(false);
});

test("the composed opening resets sampling before paced promotion begins", () => {
  const governor = new MeadowPromotionGovernor({ frameBudgetMs: 16.7, longTaskLimitMs: 50 });
  for (let i = 0; i < 45; i += 1) governor.observeFrame(i % 5 === 0 ? 28 : 16.7);
  expect(governor.snapshot().p95FrameMs).toBeGreaterThan(20);

  governor.resetFrameSample();
  expect(governor.snapshot().p95FrameMs).toBe(0);
  expect(governor.snapshot().frozen).toBe(false);
});

test("the worker waits for the current page to commit and paint before sending the next", async () => {
  const runtime = await readFile(path.join(appRoot, "lib/three/meadow/runtime.ts"), "utf8");
  const story = await readFile(path.join(appRoot, "components/story/Story.tsx"), "utf8");
  const canvas = await readFile(path.join(appRoot, "components/story/StoryCanvas.tsx"), "utf8");
  const scene = await readFile(path.join(appRoot, "components/story/Scene.tsx"), "utf8");
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");
  expect(runtime).toContain("governor.resetFrameSample()");
  expect(runtime).toContain("pendingAckRef");
  expect(runtime).toContain("heldAckRef");
  expect(runtime).toContain("pendingAckRef.current = () =>");
  expect(runtime).toContain("requestAnimationFrame(() =>");
  expect(runtime).toContain("}, [pages]);");
  expect(runtime).toContain("options.releaseAfterReady");
  expect(runtime).toContain("isMeadowReady(pagesRef.current) && !releaseAfterReadyRef.current");
  expect(runtime).not.toContain("MEADOW_PAGE_SETTLE_MS");
  expect(story).toContain("releaseMeadowPromotion={loaderDismissed}");
  expect(canvas).toContain("releaseMeadowPromotion");
  expect(scene).toContain("releaseMeadowPromotion");
  expect(detail).toContain("releaseAfterReady: releaseMeadowPromotion");
});

test("runtime frame sampling is scoped to an active meadow integration window", async () => {
  const runtime = await readFile(path.join(appRoot, "lib/three/meadow/runtime.ts"), "utf8");
  const canvas = await readFile(path.join(appRoot, "components/story/StoryCanvas.tsx"), "utf8");
  expect(canvas).toContain('CustomEvent("aura:render-duration"');
  expect(runtime).toContain('addEventListener("aura:render-duration"');
  expect(runtime).toContain("startedAt >= integrationStartedAt && startedAt <= integrationEndsAt");
  expect(runtime).not.toContain("time - priorFrame");
});

test("the module frameloop contract stands: motion tiers render always, only the still tier is demand-driven", async () => {
  const canvas = await readFile(path.join(appRoot, "components/story/StoryCanvas.tsx"), "utf8");
  const scene = await readFile(path.join(appRoot, "components/story/Scene.tsx"), "utf8");
  const proof = await readFile(path.join(appRoot, "scripts/meadow-proof.mjs"), "utf8");
  /* StoryCanvas may never blanket-override the frameloop sceneQuality.ts
     declares: forcing "demand" on balanced/full froze the wind, clouds,
     steam and wildlife whenever the visitor stopped scrolling. Demand
     rendering survives in exactly two scoped places — the reduced-motion
     still tier, and LOW-POWER page integration (a render sharing a frame
     with a page merge was a measured 161–197 ms long task that froze the
     mobile governor) — and integration demand ends the moment the meadow
     reports terminal, which is when the wind starts. */
  expect(canvas).toContain("function SceneRenderDurationSignal");
  expect(canvas).toContain("function StoryDemandInvalidator");
  expect(canvas).toContain('window.addEventListener("scroll", requestFrame');
  expect(canvas).not.toContain('frameloop: "demand",');
  expect(canvas).toContain("const integrationDemand = lowPower && settled && !meadowTerminal;");
  expect(canvas).toContain('frameloop={integrationDemand ? "demand" : quality.frameloop}');
  expect(canvas).toContain('window.addEventListener("aura:meadow-progress", onMeadowProgress)');
  expect(canvas).toContain('enabled={integrationDemand || (settled && quality.frameloop === "demand")}');
  expect(scene).toContain("CAMERA_SETTLE_EPSILON");
  expect(scene).toContain("cameraSettled ? undefined : state.invalidate()");
  expect(scene).toContain('CustomEvent("aura:camera-progress"');
  expect(proof).toContain("waitForCameraSettled");
  expect(proof).toContain("__AURA_CAMERA_PROOF__");
  expect(proof).toContain("livingWind");
  expect(proof).toContain("motionPixelRatio");
});

test("the baked atlas cards share the live meadow's wind clock", async () => {
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");
  const atlas = detail.slice(
    detail.indexOf("OFFLINE MEADOW ATLAS"),
    detail.indexOf("THE LAYER", detail.indexOf("OFFLINE MEADOW ATLAS")),
  );
  /* The dominant visible grass is the 3,600-card atlas. A static
     MeshBasicMaterial with no time uniform can never move under ANY
     frameloop fix — the wind must be injected into its program and driven
     from the same flora.ts clock as the hero blades and flowers. */
  expect(atlas).toContain("windUniforms");
  expect(atlas).toContain("uniform float uTime;");
  expect(atlas).toContain("uniform vec2 uWindDir;");
  expect(atlas).toContain("uniform float uGust;");
  expect(atlas).toContain('"aura-meadow-atlas-v2"');
  expect(atlas).toContain("sin(uTime * 0.62 - dot(aAtlasPos.xz, uWindDir) * 0.135)");
  expect(atlas).toContain("resource.windUniforms.uTime.value = t");
  expect(atlas).toContain("gustEnvelope(t)");
  /* Motion is a reduced-motion preference, never a capability fallback:
     the freeze folds in prefers-reduced-motion ONLY. */
  expect(detail).toContain("const botanicalFrozen = frozen;");
  expect(detail).not.toContain("frozen || !meadow.plan.animated");
});

test("the hardware proof pins its evidence and measures the real scene canvas", async () => {
  const proof = await readFile(path.join(appRoot, "scripts/meadow-proof.mjs"), "utf8");
  expect(proof).toContain("506e6511fe9ffb41896f4db52e200775d5ed80866ad5d5355a4be5ba99e50702");
  expect(proof).toContain("e891e91e5be3f820857c39213d9aed52357fb10d8db6c510b9b15a66501b3243");
  expect(proof).toContain('document.querySelector(".story-scene-root canvas")');
  expect(proof).toContain("__AURA_INTERACTION_PROOF__");
  expect(proof).toContain("fullRunRenderP95Ms");
  expect(proof).toContain("flowerPixelClusters");
  expect(proof).toContain('flowerVisibility.open?.source === "instanced-flower-field"');
});

test("healthy 60 Hz scheduling jitter does not falsely freeze promotion", () => {
  const governor = new MeadowPromotionGovernor({ frameBudgetMs: 16.7, longTaskLimitMs: 50 });
  governor.markHealthy("near");
  const cadence = [16.6, 16.8, 17.1, 16.9, 17.4, 16.7, 17.2, 16.8, 17, 16.9];
  for (let round = 0; round < 3; round += 1) cadence.forEach((frame) => governor.observeFrame(frame));

  expect(governor.snapshot().p95FrameMs).toBeGreaterThan(16.7);
  expect(governor.snapshot().frozen).toBe(false);
});

test("reduced-motion and low-power plans retain flowers and meadow coverage", () => {
  const reduced = chooseMeadowPlan({ width: 1440, reducedMotion: true, lowPower: false });
  const lowPower = chooseMeadowPlan({ width: 390, reducedMotion: false, lowPower: true });

  expect(reduced.animated).toBe(false);
  expect(reduced.flowerCount).toBe(200);
  expect(reduced.maxTier).toBe("mid");
  expect(lowPower.flowerCount).toBe(380);
  expect(lowPower.maxTier).toBe("mid");
  expect(lowPower.animated).toBe(false);
});

test("constrained desktop capability reaches the low-power meadow plan", async () => {
  const canvas = await readFile(path.join(appRoot, "components/story/StoryCanvas.tsx"), "utf8");
  const scene = await readFile(path.join(appRoot, "components/story/Scene.tsx"), "utf8");
  const detail = await readFile(path.join(appRoot, "components/story/SceneDetail.tsx"), "utf8");

  expect(canvas).toContain('setLowPower(full.tier !== "full")');
  expect(canvas).toContain("lowPower={lowPower}");
  expect(scene).toContain("lowPower={lowPower}");
  expect(detail).toContain("lowPower: mobile || lowPower");
});

/* THE MASK IS ONE FUNCTION. Three divergent copies of the clearance field
   (runtime field.ts, SceneDetail, the offline atlas generator) is exactly
   how grass shipped through the deck: the generator's copy silently dropped
   the deck rectangle and glass walkway. The offline generator must sample
   the SAME field the live meadow samples, point for point. */
test("the atlas generator's clearance and terrain match the runtime meadow field exactly", async () => {
  const { clearance: atlasClearance, terrainHeight: atlasTerrainHeight } = await importAtlasGenerator();
  let samples = 0;
  for (let z = -30; z <= 56; z += 1.7) {
    for (let x = -50; x <= 50; x += 1.7) {
      expect(atlasClearance(x, z)).toBeCloseTo(sampleMeadowClearance(x, z, false), 10);
      expect(atlasTerrainHeight(x, z)).toBeCloseTo(sampleTerrainHeight(x, z), 10);
      samples += 1;
    }
  }
  expect(samples).toBeGreaterThan(2_000);
});

test("no baked atlas card stands on the deck, the walkway, the entrance steps, or inside the house", async () => {
  const bytes = await readFile(path.join(appRoot, "public/textures/meadow-atlas.bin"));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(12, true);
  const stride = view.getUint32(16, true);
  const headerBytes = 24;
  expect(count).toBe(3_600);

  const segmentDistance = (x: number, z: number, ax: number, az: number, bx: number, bz: number) => {
    const vx = bx - ax;
    const vz = bz - az;
    const lengthSquared = vx * vx + vz * vz;
    const t = lengthSquared > 0 ? Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / lengthSquared)) : 0;
    return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
  };
  const insideRect = (x: number, z: number, x0: number, z0: number, x1: number, z1: number) =>
    x >= x0 && x <= x1 && z >= z0 && z <= z1;

  let onDeck = 0;
  let onWalkway = 0;
  let onSteps = 0;
  let inHouse = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = headerBytes + index * stride;
    const x = view.getFloat32(offset, true);
    const z = view.getFloat32(offset + 8, true);
    if (insideRect(x, z, -3.9, 2.95, 3.6, 6.3)) onDeck += 1;
    if (segmentDistance(x, z, 3.45, 4.65, 5.9, 5.35) <= 0.85) onWalkway += 1;
    /* The five treads span x -1.10..1.20, z 6.73..8.53 (EntranceSteps group
       at 6.55, five 0.36 m treads); the founder's screenshot showed cards
       standing through the LOWER treads that the tight rect left exposed. */
    if (insideRect(x, z, -1.1, 6.55, 1.2, 8.6)) onSteps += 1;
    if (insideRect(x, z, -4.3, -3.4, 4.3, 3.4)) inHouse += 1;
  }
  expect(onDeck).toBe(0);
  expect(onWalkway).toBe(0);
  expect(onSteps).toBe(0);
  expect(inHouse).toBe(0);
});
