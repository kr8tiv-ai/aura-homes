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

/**
 * WHERE THE PARCEL UNDER A DOCUMENT CAME FROM.
 *
 *   · `manual`         — typed into the builder's own Site step. This is the
 *                        oldest value and it keeps its exact old meaning: it is
 *                        first in the list below and every document saved
 *                        before `owner-stated` existed still validates
 *                        unchanged. Nothing about an old document is migrated,
 *                        rewritten or re-labelled.
 *   · `owner-stated`   — stated on /land by the person whose lot it is, on a
 *                        panel whose stored source label says so. It carries
 *                        the WHOLE-lot convention: the dimensions are the lot
 *                        and the setbacks are real setbacks taken off it.
 *   · `listing-derived`— carried over from a demonstration record. Its
 *                        rectangle is already POST-setback, which is why its
 *                        setbacks are stored as zero.
 *   · `geojson`        — an imported parcel outline. Nothing in this build
 *                        writes it; the value exists for documents that arrive
 *                        from outside Aura.
 *
 * WHY `owner-stated` IS NOT `manual`. Both are numbers a person typed, and that
 * is exactly why one word could not carry both: /land's panel stores a source
 * label asserting the reader stated their own lot, and the builder's Site step
 * stores no such claim. With a single value the record could not tell the two
 * apart afterwards, so a claim about who said what had no evidence behind it.
 */
export type BuilderSiteProvenance = "manual" | "owner-stated" | "listing-derived" | "geojson";

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

/* `manual` stays first and stays legal: an older document carrying it loads and
   validates exactly as it did before `owner-stated` was added. */
const PROVENANCES: readonly BuilderSiteProvenance[] = [
  "manual",
  "owner-stated",
  "listing-derived",
  "geojson",
];
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

/* ------------------------------------------------- keeping an origin honest */

/** The seven facts a parcel is, compared one by one rather than through
 *  `JSON.stringify`, which answers on key order as well as on values. */
export function sameParcel(a: ParcelFacts | null | undefined, b: ParcelFacts | null | undefined) {
  if (!a || !b) return !a && !b;
  return (
    a.lotWidthFt === b.lotWidthFt &&
    a.lotDepthFt === b.lotDepthFt &&
    a.frontSetbackFt === b.frontSetbackFt &&
    a.sideSetbackFt === b.sideSetbackFt &&
    a.rearSetbackFt === b.rearSetbackFt &&
    a.frontFaces === b.frontFaces &&
    a.slope === b.slope
  );
}

/**
 * The provenance a parcel edited in the builder's Site step should be stored
 * under.
 *
 * THE RULE. An origin survives only while the numbers it describes do. A lot
 * stated on /land opens the Site step already filled in; while the reader
 * leaves those numbers alone the document keeps saying where they came from,
 * and the moment they change any of them the parcel is a builder-typed one and
 * the record says `manual` instead. Claiming "stated by the owner on /land"
 * over numbers somebody has since retyped here would be the same class of
 * untruth this function exists to remove.
 *
 * WHAT IT DELIBERATELY DOES NOT CHANGE. `listing-derived` is still sticky
 * through an edit, exactly as the ternary this replaces made it: that value is
 * not only an origin, it is the POST-setback convention the stored zeroes are
 * read under, and dropping it on an edit would make the same setbacks get taken
 * off twice. What the ternary DID do and this no longer does is rewrite a
 * `geojson` document to `manual` the instant its Site step rendered, without
 * anybody touching a field.
 */
export function provenanceForBuilderEdit(
  stored: BuilderSite | undefined,
  parcel: ParcelFacts,
): BuilderSiteProvenance {
  if (stored?.provenance === "listing-derived") return "listing-derived";
  if (!stored?.parcel || stored.provenance === "manual") return "manual";
  return sameParcel(stored.parcel, parcel) ? stored.provenance : "manual";
}

/**
 * What the Site step says about a saved parcel, per origin.
 *
 * A record and its sentence live in one file so a fourth origin cannot be added
 * without deciding what the reader is told about it.
 */
export const SITE_PROVENANCE_NOTES: Record<BuilderSiteProvenance, string> = {
  manual: "Saved with this design. It reaches the A1 site plan and the foundation schedule.",
  "owner-stated":
    "Saved with this design, from the lot you stated on the land page. The dimensions and the setbacks are yours: Aura filled none of them in and confirmed none of them. Change any number here and it becomes a parcel typed in the builder, and the record will say that instead.",
  "listing-derived":
    "Saved with this design, from a listing. Its setbacks arrived as zero because the listed envelope is already inside them.",
  geojson:
    "Saved with this design, from an imported parcel outline. Nothing in this build writes that origin, so this document was made outside Aura and its numbers were never checked here.",
};

export function siteProvenanceNote(provenance: BuilderSiteProvenance): string {
  return SITE_PROVENANCE_NOTES[provenance];
}
