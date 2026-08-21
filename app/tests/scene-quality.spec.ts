import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";
import {
  degradeBuilderSceneQuality,
  degradeSceneQuality,
  nextOpeningSceneStage,
  selectBuilderSceneQuality,
  selectOpeningSceneQuality,
  selectSceneQuality,
} from "@/lib/three/sceneQuality";
import { CARD_TRACER_SPEED_PX_PER_SECOND } from "@/components/CardFX";

test("reduced motion keeps a composed still without expensive continuous effects", () => {
  const quality = selectSceneQuality({
    width: 1440,
    devicePixelRatio: 2,
    deviceMemoryGb: 16,
    hardwareConcurrency: 12,
    reducedMotion: true,
  });

  expect(quality.tier).toBe("still");
  expect(quality.frameloop).toBe("demand");
  expect(quality.postprocessing).toBe(false);
  expect(quality.grassScale).toBeGreaterThan(0);
});

test("a constrained phone receives a stable balanced scene", () => {
  const quality = selectSceneQuality({
    width: 390,
    devicePixelRatio: 3,
    deviceMemoryGb: 4,
    hardwareConcurrency: 4,
    reducedMotion: false,
  });

  expect(quality.tier).toBe("balanced");
  expect(quality.maxDpr).toBe(1.25);
  expect(quality.grassScale).toBeLessThan(0.5);
  expect(quality.postprocessing).toBe(false);
});

test("capable desktop hardware receives the full material and light pass", () => {
  const quality = selectSceneQuality({
    width: 1600,
    devicePixelRatio: 1.5,
    deviceMemoryGb: 16,
    hardwareConcurrency: 12,
    reducedMotion: false,
  });

  expect(quality.tier).toBe("full");
  expect(quality.maxDpr).toBe(1.75);
  expect(quality.grassScale).toBe(1);
  expect(quality.postprocessing).toBe(true);
  expect(quality.softShadows).toBe(true);
});

test("missing browser capability hints choose the safe tier", () => {
  const quality = selectSceneQuality({
    width: 1280,
    devicePixelRatio: 1,
    reducedMotion: false,
  });

  expect(quality.tier).toBe("balanced");
  expect(quality.frameloop).toBe("always");
});

test("a measured slow or software-rendered full scene downgrades once", () => {
  const full = selectSceneQuality({
    width: 1600,
    devicePixelRatio: 1.5,
    deviceMemoryGb: 16,
    hardwareConcurrency: 12,
    reducedMotion: false,
  });
  const balanced = degradeSceneQuality(full);

  expect(balanced.tier).toBe("balanced");
  expect(balanced.postprocessing).toBe(false);
  expect(degradeSceneQuality(balanced)).toEqual(balanced);
});

test("the landing opens on one safe shader budget instead of recompiling after entry", () => {
  const quality = selectOpeningSceneQuality({
    width: 1600,
    devicePixelRatio: 1.5,
    deviceMemoryGb: 16,
    hardwareConcurrency: 12,
    reducedMotion: false,
  });

  expect(quality.tier).toBe("balanced");
  expect(quality.postprocessing).toBe(false);
  expect(quality.softShadows).toBe(false);
  expect(quality.grassScale).toBe(0.14);
  expect(quality.sparkleCount).toBe(30);
});

test("the landing scene advances through painted detail stages", () => {
  expect(nextOpeningSceneStage("core")).toBe("site");
  expect(nextOpeningSceneStage("site")).toBe("forest");
  expect(nextOpeningSceneStage("forest")).toBe("atmosphere");
  expect(nextOpeningSceneStage("atmosphere")).toBe("meadow");
  expect(nextOpeningSceneStage("meadow")).toBeNull();
});

test("a capable builder gains richer light while remaining demand-rendered", () => {
  const quality = selectBuilderSceneQuality({
    width: 1600,
    devicePixelRatio: 2,
    deviceMemoryGb: 16,
    hardwareConcurrency: 12,
    reducedMotion: false,
  });

  expect(quality.tier).toBe("full");
  expect(quality.maxDpr).toBe(1.75);
  expect(quality.environmentResolution).toBe(64);
  expect(quality.shadowMapSize).toBe(2048);
  expect(quality.contactShadowResolution).toBe(512);
  expect(quality.frameloop).toBe("demand");
});

test("a constrained builder keeps legible contact light on the stable budget", () => {
  const quality = selectBuilderSceneQuality({
    width: 390,
    devicePixelRatio: 3,
    deviceMemoryGb: 4,
    hardwareConcurrency: 4,
    reducedMotion: false,
  });

  expect(quality.tier).toBe("balanced");
  expect(quality.maxDpr).toBe(1.25);
  expect(quality.environmentResolution).toBe(32);
  expect(quality.shadowMapSize).toBe(1024);
  expect(quality.contactShadowResolution).toBe(256);
  expect(quality.frameloop).toBe("demand");
});

test("builder reduced-motion and runtime fallback never restart a render loop", () => {
  const still = selectBuilderSceneQuality({
    width: 1440,
    devicePixelRatio: 2,
    deviceMemoryGb: 16,
    hardwareConcurrency: 12,
    reducedMotion: true,
  });
  const full = selectBuilderSceneQuality({
    width: 1440,
    devicePixelRatio: 2,
    deviceMemoryGb: 16,
    hardwareConcurrency: 12,
    reducedMotion: false,
  });
  const fallback = degradeBuilderSceneQuality(full);

  expect(still.tier).toBe("still");
  expect(still.frameloop).toBe("demand");
  expect(fallback.tier).toBe("balanced");
  expect(fallback.contactShadowResolution).toBe(256);
  expect(fallback.frameloop).toBe("demand");
  expect(degradeBuilderSceneQuality(fallback)).toEqual(fallback);
});

test("border light stars travel at one quarter of the approved original speed", () => {
  expect(CARD_TRACER_SPEED_PX_PER_SECOND).toBe(10.5);
});


/* ---------------------------------------------------------------------------
   THE 3D FREEZE, AND WHY ITS PATHSPEC NEEDED NARROWING.

   The freeze anchor every audit runs is a git pathspec over the scene surface,
   and `app/components/story` is one of its entries. Audit #11 found it firing
   RED on `StoryChrome.tsx` — a "Choose a path to enter" hint and a chain-status
   strip. DOM copy. No shader, model, worker or atlas moved.

   That is worse than a nuisance. An anchor that cannot tell a shader edit from
   a copy edit teaches the next auditor to wave it through, and a waved-through
   anchor is a retired one.

   Audit #11 prescribed narrowing to `Scene*.tsx`. That is TOO narrow, and this
   test is the reason to say so out loud: `flora.ts`, `Loader.tsx`,
   `StillScene.tsx`, `Story.tsx` and `StoryCanvas.tsx` all reach for three.js
   too, and a freeze that stopped watching them would miss the very edits it
   exists to catch.

   The correct cut is the other direction — keep the whole directory and EXCLUDE
   the two files that carry no 3D at all:

     git diff --name-only <range> -- \
       app/components/story app/lib/three app/public/models \
       app/public/textures/meadow* app/workers/meadow.worker.ts \
       app/scripts/generate-meadow-atlas.mjs \
       ':(exclude)app/components/story/copy.ts' \
       ':(exclude)app/components/story/StoryChrome.tsx'

   That exclusion is only safe while those two files stay copy-only, and nothing
   stops somebody importing three.js into StoryChrome tomorrow. So this gate
   holds them to it: the moment either file reaches for the scene, the exclusion
   becomes a hole and this goes red instead of the freeze going quiet.
   --------------------------------------------------------------------------- */
test("the files the 3D freeze excludes carry no 3D", () => {
  const storyDir = path.join(path.resolve(__dirname, ".."), "components", "story");

  /* The exact list the freeze pathspec excludes. Kept here rather than imported
     so that changing one without the other is visible in a diff. */
  const EXCLUDED = ["copy.ts", "StoryChrome.tsx"];

  /* What "carries 3D" means, spelled out: a three.js import, an r3f hook, or a
     renderer type. Deliberately broad — a false positive here costs a comment,
     a false negative costs the freeze. */
  const REACHES_FOR_THE_SCENE =
    /(from\s+["']three|@react-three\/|useFrame|useThree|ShaderMaterial|BufferGeometry|WebGLRenderer|PerspectiveCamera)/;

  const breaches: string[] = [];
  for (const name of EXCLUDED) {
    const full = path.join(storyDir, name);
    expect(existsSync(full), `${name} is on the freeze exclusion list but does not exist`).toBe(true);
    const source = readFileSync(full, "utf8");
    if (REACHES_FOR_THE_SCENE.test(source)) breaches.push(name);
  }

  expect(
    breaches,
    "these files are EXCLUDED from the 3D-freeze pathspec because they were copy-only, and they no longer are. Either take them off the exclusion list or take the 3D out of them - as it stands the freeze has a hole in it.",
  ).toEqual([]);

  /* And the detector has to discriminate, or the loop above proves nothing:
     Scene.tsx is the file the freeze exists for. */
  expect(
    REACHES_FOR_THE_SCENE.test(readFileSync(path.join(storyDir, "Scene.tsx"), "utf8")),
    "the 3D detector does not fire on Scene.tsx, so it would not fire on anything",
  ).toBe(true);
});
