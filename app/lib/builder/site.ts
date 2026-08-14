/* B-P1 — the SITE slot on the builder document.
 *
 * One durable place for the land under the home: the parcel facts the owner
 * (or a listing) supplied, where they came from, and how the ground is
 * treated. Added as an OPTIONAL document slot following the planOrigin
 * precedent — absent on every document saved before it existed, so old
 * documents stay byte-identical and no version bump or share-codec change
 * is needed (share tokens encode the spec, never the document envelope).
 *
 * Honesty rule carried from /land: listing-derived parcels describe a
 * POST-SETBACK envelope, so their setbacks are recorded as zero with the
 * provenance saying why — never invented numbers.
 */
import type { ParcelFacts, Facing, Slope } from "@/lib/design/parcel";

export type BuilderSiteProvenance = "manual" | "listing-derived" | "geojson";

export type BuilderSiteGrade = "flat" | "plane" | "heightfield";

export interface BuilderSite {
  parcel: ParcelFacts | null;
  provenance: BuilderSiteProvenance;
  /** How the viewport and pile schedule treat the ground. "flat" keeps
   * today's behaviour; "plane" tilts by the parcel slope; "heightfield"
   * displaces from the seed. */
  grade: BuilderSiteGrade;
  /** Deterministic seed for the heightfield grade; ignored otherwise. */
  seed?: number;
}

const PROVENANCES: readonly BuilderSiteProvenance[] = ["manual", "listing-derived", "geojson"];
const GRADES: readonly BuilderSiteGrade[] = ["flat", "plane", "heightfield"];
const FACINGS: readonly Facing[] = ["unknown", "n", "ne", "e", "se", "s", "sw", "w", "nw"];
const SLOPES: readonly Slope[] = ["flat", "gentle", "steep"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finitePositive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const finiteNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export type BuilderSiteValidation =
  | { ok: true; site: BuilderSite | null }
  | { ok: false; problem: string };

/** Absent and null both mean "no site attached" — the pre-B-P1 state. */
export function validateBuilderSite(value: unknown): BuilderSiteValidation {
  if (value === undefined || value === null) return { ok: true, site: null };
  if (!isRecord(value)) return { ok: false, problem: "site is not an object" };
  if (!PROVENANCES.includes(value.provenance as BuilderSiteProvenance)) {
    return { ok: false, problem: `site.provenance is ${JSON.stringify(value.provenance)}` };
  }
  if (!GRADES.includes(value.grade as BuilderSiteGrade)) {
    return { ok: false, problem: `site.grade is ${JSON.stringify(value.grade)}` };
  }
  if (value.seed !== undefined && !finiteNonNegative(value.seed)) {
    return { ok: false, problem: "site.seed must be a non-negative finite number" };
  }

  let parcel: ParcelFacts | null = null;
  if (value.parcel !== null && value.parcel !== undefined) {
    const p = value.parcel;
    if (!isRecord(p)) return { ok: false, problem: "site.parcel is not an object" };
    if (!finitePositive(p.lotWidthFt) || !finitePositive(p.lotDepthFt)) {
      return { ok: false, problem: "site.parcel lot dimensions must be positive feet" };
    }
    if (![p.frontSetbackFt, p.sideSetbackFt, p.rearSetbackFt].every(finiteNonNegative)) {
      return { ok: false, problem: "site.parcel setbacks must be non-negative feet" };
    }
    if (!FACINGS.includes(p.frontFaces as Facing)) {
      return { ok: false, problem: `site.parcel.frontFaces is ${JSON.stringify(p.frontFaces)}` };
    }
    if (!SLOPES.includes(p.slope as Slope)) {
      return { ok: false, problem: `site.parcel.slope is ${JSON.stringify(p.slope)}` };
    }
    parcel = {
      lotWidthFt: p.lotWidthFt as number,
      lotDepthFt: p.lotDepthFt as number,
      frontSetbackFt: p.frontSetbackFt as number,
      sideSetbackFt: p.sideSetbackFt as number,
      rearSetbackFt: p.rearSetbackFt as number,
      frontFaces: p.frontFaces as Facing,
      slope: p.slope as Slope,
    };
  }

  return {
    ok: true,
    site: {
      parcel,
      provenance: value.provenance as BuilderSiteProvenance,
      grade: value.grade as BuilderSiteGrade,
      ...(value.seed !== undefined ? { seed: value.seed as number } : {}),
    },
  };
}
