/* Footprints come from ONE module so the mask and the meshes cannot drift.
   Pads and feathers stay here, because they are this consumer's own. */
import {
  BENCH_CENTER,
  DECK_RECT,
  FIREPIT_CENTER,
  HOUSE_RECT,
  PATH,
  STEPS_RECT_TIGHT,
  STEPS_RECT_WIDE,
  TUB_CENTER,
  WALKWAY_SEGMENT,
  type GroundRect,
  type GroundSegment,
} from "./geometry";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smooth01 = (a: number, b: number, value: number) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function meadowRandom(index: number, salt = 0): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43_758.5453;
  return value - Math.floor(value);
}

export function sampleTerrainHeight(x: number, z: number): number {
  const radius = Math.hypot(x, z);
  const ridge =
    4.6 *
    Math.exp(-Math.pow(z - 25, 2) / (2 * 5.5 * 5.5)) *
    (1 - clamp01((Math.abs(x) - 16) / 24) * 0.75);
  const t = clamp01((radius - 13) / 30);
  let roll =
    t *
    t *
    (Math.sin(x * 0.16 + 1.7) * Math.cos(z * 0.13 - 0.6) +
      0.5 * Math.sin(x * 0.31 - 2.2) * Math.sin(z * 0.27 + 1.1)) *
    1.5;
  roll *= 1 - clamp01(ridge / 1.2) * 0.85;
  return ridge + roll;
}

function rectangleDistance(x: number, z: number, x0: number, z0: number, x1: number, z1: number) {
  return Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
}

function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax;
  const vz = bz - az;
  const lengthSquared = vx * vx + vz * vz;
  const t = lengthSquared > 0 ? clamp01(((x - ax) * vx + (z - az) * vz) / lengthSquared) : 0;
  return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}

const rectDistanceTo = (x: number, z: number, rect: GroundRect) =>
  rectangleDistance(x, z, rect.x0, rect.z0, rect.x1, rect.z1);

const segmentDistanceTo = (x: number, z: number, run: GroundSegment) =>
  segmentDistance(x, z, run.ax, run.az, run.bx, run.bz);

export function sampleMeadowClearance(x: number, z: number, tight = false): number {
  const fade = (distance: number, pad: number, feather: number) => clamp01((distance - pad) / feather);
  let value = 1;
  const home = tight ? [0.12, 0.4] : [0.3, 1.2];
  value = Math.min(value, fade(rectDistanceTo(x, z, HOUSE_RECT), home[0], home[1]));
  if (!tight) {
    value = Math.min(value, fade(rectDistanceTo(x, z, DECK_RECT), 0.28, 0.95));
    value = Math.min(value, fade(segmentDistanceTo(x, z, WALKWAY_SEGMENT), WALKWAY_SEGMENT.halfWidth, 0.8));
  }
  /* Entrance steps. The tread run is STEPS_TREAD_FOOTPRINT (derived from
     STEPS_TREADS, so it cannot fall out of step with the mesh); the tight
     rect stops well short of its far edge and, when it briefly served every
     consumer here, left the three lower treads unprotected — exactly where
     1.4 m atlas cards stood through the stairs. Tall consumers (hero blades,
     atlas cards) take the wide rect; the 8–18 cm filler may hug the boxes. */
  value = Math.min(value, tight
    ? fade(rectDistanceTo(x, z, STEPS_RECT_TIGHT), 0.12, 0.4)
    : fade(rectDistanceTo(x, z, STEPS_RECT_WIDE), 0.24, 0.7));
  value = Math.min(value, fade(Math.hypot(x - TUB_CENTER.x, z - TUB_CENTER.z), tight ? 0.92 : 1.4, tight ? 0.5 : 0.9));
  value = Math.min(value, fade(Math.hypot(x - FIREPIT_CENTER.x, z - FIREPIT_CENTER.z), tight ? 0.5 : 1.3, tight ? 0.45 : 0.8));
  value = Math.min(value, fade(Math.hypot(x - BENCH_CENTER.x, z - BENCH_CENTER.z), tight ? 0.6 : 0.95, tight ? 0.5 : 0.8));
  let pathDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < PATH.length - 1; index += 1) {
    pathDistance = Math.min(
      pathDistance,
      segmentDistance(x, z, PATH[index][0], PATH[index][1], PATH[index + 1][0], PATH[index + 1][1]),
    );
  }
  return Math.min(value, fade(pathDistance, tight ? 0.22 : 0.3, tight ? 0.5 : 0.75));
}

export function sampleMeadowDensity(x: number, z: number): number {
  const radius = Math.hypot(x, z);
  const ring = 1 - smooth01(16, 35, radius);
  const corridor =
    (1 - smooth01(9, 18, Math.abs(x))) * smooth01(5.5, 11, z) * (1 - smooth01(33, 41, z));
  const scatter = 0.34 * (1 - smooth01(28, 48, radius));
  return clamp01(Math.max(ring, corridor, scatter) * (1 - smooth01(6, 15, -z)));
}
