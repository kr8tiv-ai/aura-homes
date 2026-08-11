export type SceneQualityTier = "still" | "balanced" | "full";

export interface SceneQualityInputs {
  width: number;
  devicePixelRatio: number;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
  reducedMotion: boolean;
}

export interface SceneQuality {
  tier: SceneQualityTier;
  maxDpr: number;
  grassScale: number;
  postprocessing: boolean;
  softShadows: boolean;
  environmentResolution: 32 | 64;
  shadowMapSize: 1024 | 2048;
  sparkleCount: number;
  frameloop: "always" | "demand";
}

const STILL: SceneQuality = {
  tier: "still",
  maxDpr: 1.25,
  grassScale: 0.32,
  postprocessing: false,
  softShadows: false,
  environmentResolution: 32,
  shadowMapSize: 1024,
  sparkleCount: 30,
  frameloop: "demand",
};

const BALANCED: SceneQuality = {
  tier: "balanced",
  maxDpr: 1.25,
  grassScale: 0.38,
  postprocessing: false,
  softShadows: false,
  environmentResolution: 32,
  shadowMapSize: 1024,
  sparkleCount: 45,
  frameloop: "always",
};

const FULL: SceneQuality = {
  tier: "full",
  maxDpr: 1.75,
  grassScale: 1,
  postprocessing: true,
  softShadows: true,
  environmentResolution: 64,
  shadowMapSize: 2048,
  sparkleCount: 80,
  frameloop: "always",
};

/**
 * Choose a scene budget from stable browser capability hints.
 *
 * Unknown memory/core values deliberately do not earn the full tier. Those
 * hints are absent in several privacy-conscious browsers, and a beautiful
 * balanced scene is a better default than betting the interaction on a GPU
 * we know nothing about.
 */
export function selectSceneQuality(input: SceneQualityInputs): SceneQuality {
  if (input.reducedMotion) return { ...STILL };

  const constrained =
    input.width < 820 ||
    (input.deviceMemoryGb !== undefined && input.deviceMemoryGb <= 4) ||
    (input.hardwareConcurrency !== undefined && input.hardwareConcurrency <= 4);
  if (constrained) return { ...BALANCED };

  const capable =
    input.width >= 1100 &&
    input.deviceMemoryGb !== undefined &&
    input.deviceMemoryGb >= 8 &&
    input.hardwareConcurrency !== undefined &&
    input.hardwareConcurrency >= 8;

  return capable ? { ...FULL } : { ...BALANCED };
}

/** One-way runtime fallback after the renderer has supplied real evidence. */
export function degradeSceneQuality(quality: SceneQuality): SceneQuality {
  return quality.tier === "full" ? { ...BALANCED } : quality;
}
