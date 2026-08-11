import { expect, test } from "playwright/test";
import { degradeSceneQuality, selectSceneQuality } from "@/lib/three/sceneQuality";

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
