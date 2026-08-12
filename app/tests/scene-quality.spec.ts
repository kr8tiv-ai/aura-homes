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
