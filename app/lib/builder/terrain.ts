/* THE GROUND, as a function.
 *
 * The builder has always stood its homes on a flat plane at GRADE_Y_FT,
 * which is true of about none of the land people actually own. This module
 * turns the site's slope answer into a height field the viewport can
 * displace and the foundation schedule can measure.
 *
 * PURITY CONTRACT, the same one lib/design/parcel.ts carries: no network,
 * no Node APIs, no Math.random, no Date.now. The same site and the same
 * point always produce the same height — which is what lets a pile schedule
 * be a fact rather than a render.
 *
 * WHAT IT HONESTLY IS. A slope answer is three words, not a survey, so this
 * produces the plainest surface consistent with each word: flat is flat, a
 * gentle or steep fall is a TILTED PLANE falling away from the front lot
 * line, and a heightfield adds one deterministic undulation on top. It is a
 * design assumption to build against, and every screen that shows it says
 * so — a real site needs a surveyed grade at the building corners.
 */
import type { BuilderSite } from "./site";
import type { Slope } from "@/lib/design/parcel";

/** Feet of fall per foot travelled, by the word somebody chose. Chosen to
 *  match the consequence the parcel module already states for each: gentle
 *  is a fall you notice, steep is one you feel climbing. */
export const SLOPE_GRADE: Record<Slope, number> = {
  flat: 0,
  gentle: 0.06,
  steep: 0.15,
};

/** Undulation amplitude in feet for the heightfield grade. Small on purpose:
 *  it exists to stop a tilted plane reading as a ramp, not to invent terrain. */
const UNDULATION_FT = 0.9;

/**
 * Ground height in feet at a point, relative to the flat datum (0 at the
 * origin, always — the home's own floor plate stays where it is).
 *
 * The site frame fixes north at −Z (geometry.ts) and the front lot line at
 * +Z, so a falling site falls toward the viewer: +Z is downhill.
 */
export function gradeHeightFt(x: number, z: number, site: BuilderSite | undefined | null): number {
  if (!site || site.grade === "flat" || !site.parcel) return 0;
  const fall = SLOPE_GRADE[site.parcel.slope] ?? 0;
  if (fall === 0) return 0;

  /* `+ 0` normalises the negative zero that -0 * fall produces at z = 0.
     It is invisible in arithmetic and NOT invisible to Object.is, which is
     what a schedule comparing "did this height change?" would use. */
  const plane = -z * fall + 0;
  if (site.grade !== "heightfield") return plane;

  /* One deterministic ripple. Seeded so a project's ground is the same
     ground every time it opens, and no Math.random is anywhere near it. */
  const seed = site.seed ?? 0;
  const undulation =
    Math.sin(x * 0.045 + seed * 0.37) * Math.cos(z * 0.038 - seed * 0.21) * UNDULATION_FT;
  return plane + undulation;
}

/**
 * Pile lengths for a grid of pile positions, in feet.
 *
 * The screw-pile spec's real cost driver on a sloped site is that piles are
 * NOT all one length: the downhill ones stand taller to reach a level plate.
 * Returned per position so the schedule can print the actual range instead
 * of one number that is right nowhere.
 */
export function pileLengthsFt(
  positions: ReadonlyArray<readonly [number, number]>,
  site: BuilderSite | undefined | null,
  baseLengthFt: number,
): number[] {
  return positions.map(([x, z]) => {
    const ground = gradeHeightFt(x, z, site);
    /* Ground below the datum means a longer pile; above it, a shorter one.
       Never shorter than half the base — a pile still has to reach frost. */
    return Math.max(baseLengthFt * 0.5, baseLengthFt - ground);
  });
}

/** What the foundation schedule prints when the ground is not flat. */
export interface PileScheduleSummary {
  shortestFt: number;
  longestFt: number;
  spreadFt: number;
  varies: boolean;
}

export function summarisePileLengths(lengths: readonly number[]): PileScheduleSummary | null {
  if (lengths.length === 0) return null;
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  const spread = longest - shortest;
  return {
    shortestFt: shortest,
    longestFt: longest,
    spreadFt: spread,
    /* An inch of spread is arithmetic noise, not a different pile order. */
    varies: spread >= 1 / 12,
  };
}
