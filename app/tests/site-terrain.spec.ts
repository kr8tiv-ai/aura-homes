import { expect, test } from "playwright/test";

import { validateBuilderSite, type BuilderSite } from "@/lib/builder/site";
import {
  SLOPE_GRADE,
  gradeHeightFt,
  pileLengthsFt,
  summarisePileLengths,
} from "@/lib/builder/terrain";

const site = (over: Partial<BuilderSite> = {}): BuilderSite => ({
  parcel: {
    lotWidthFt: 150,
    lotDepthFt: 290,
    frontSetbackFt: 25,
    sideSetbackFt: 10,
    rearSetbackFt: 25,
    frontFaces: "s",
    slope: "gentle",
  },
  provenance: "manual",
  grade: "plane",
  ...over,
});

test("flat ground stays flat, and an absent site is flat ground", () => {
  expect(gradeHeightFt(40, -60, null)).toBe(0);
  expect(gradeHeightFt(40, -60, undefined)).toBe(0);
  expect(gradeHeightFt(40, -60, site({ grade: "flat" }))).toBe(0);
  // grade says plane, but the parcel says the land is flat: still flat.
  expect(gradeHeightFt(40, -60, site({ parcel: { ...site().parcel!, slope: "flat" } }))).toBe(0);
  expect(SLOPE_GRADE.flat).toBe(0);
});

test("a sloped site falls toward the front lot line and is exactly reproducible", () => {
  const gentle = site();
  const steep = site({ parcel: { ...site().parcel!, slope: "steep" } });

  // Origin is the datum on every site — the home's own floor plate never moves.
  expect(gradeHeightFt(0, 0, gentle)).toBe(0);
  // +Z is downhill (the site frame fixes north at −Z), so uphill is behind.
  expect(gradeHeightFt(0, 40, gentle)).toBeLessThan(0);
  expect(gradeHeightFt(0, -40, gentle)).toBeGreaterThan(0);
  // Steeper land falls further over the same distance.
  expect(Math.abs(gradeHeightFt(0, 40, steep))).toBeGreaterThan(Math.abs(gradeHeightFt(0, 40, gentle)));
  // Pure: same inputs, same answer, every time.
  expect(gradeHeightFt(13.5, 27.25, gentle)).toBe(gradeHeightFt(13.5, 27.25, gentle));
});

test("a heightfield is seeded, deterministic, and stays near its plane", () => {
  const plane = site();
  const field = site({ grade: "heightfield", seed: 7 });
  const otherSeed = site({ grade: "heightfield", seed: 8 });

  expect(gradeHeightFt(20, 30, field)).toBe(gradeHeightFt(20, 30, field));
  expect(gradeHeightFt(20, 30, field)).not.toBe(gradeHeightFt(20, 30, otherSeed));
  // The undulation is a texture on the plane, never a second landscape.
  expect(Math.abs(gradeHeightFt(20, 30, field) - gradeHeightFt(20, 30, plane))).toBeLessThanOrEqual(1);
});

test("piles on sloping ground carry different lengths, and flat ground orders one", () => {
  const grid = [
    [-12, -12], [12, -12],
    [-12, 12], [12, 12],
  ] as ReadonlyArray<readonly [number, number]>;

  const flat = summarisePileLengths(pileLengthsFt(grid, site({ grade: "flat" }), 8));
  expect(flat?.varies).toBe(false);
  expect(flat?.shortestFt).toBe(8);
  expect(flat?.longestFt).toBe(8);

  const sloped = summarisePileLengths(pileLengthsFt(grid, site(), 8));
  expect(sloped?.varies).toBe(true);
  expect(sloped!.longestFt).toBeGreaterThan(sloped!.shortestFt);
  // A pile still has to reach frost: never shorter than half the base order.
  expect(sloped!.shortestFt).toBeGreaterThanOrEqual(4);

  expect(summarisePileLengths([])).toBeNull();
});

test("the site slot refuses what it cannot honestly store", () => {
  expect(validateBuilderSite(undefined)).toEqual({ ok: true, site: null });
  expect(validateBuilderSite(null)).toEqual({ ok: true, site: null });

  const good = validateBuilderSite(site());
  expect(good.ok).toBe(true);

  for (const broken of [
    { ...site(), provenance: "scraped" },
    { ...site(), grade: "cliff" },
    { ...site(), parcel: { ...site().parcel!, lotWidthFt: 0 } },
    { ...site(), parcel: { ...site().parcel!, frontSetbackFt: -5 } },
    { ...site(), parcel: { ...site().parcel!, frontFaces: "up" } },
  ]) {
    expect(validateBuilderSite(broken).ok).toBe(false);
  }
});
