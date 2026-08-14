/* B-P1 — one land record, turned into the SITE slot on a builder document.
 *
 * THE HONESTY RULE THIS MODULE EXISTS TO ENFORCE. A land listing states the
 * width and depth that are left AFTER the district's setbacks have been
 * taken off it — the post-setback buildable envelope, not the lot. Carrying
 * those two numbers across as a lot and then subtracting setbacks from them
 * again would take the same land off somebody twice. So the envelope becomes
 * the lot and the setbacks are recorded as ZERO, which is the true remaining
 * setback on a rectangle that has already had them removed. Aura has not
 * read this parcel's land use bylaw and will not write setback numbers it
 * has not read.
 *
 * Two facts a listing does not carry get their honest empty states rather
 * than a plausible guess: the compass has "unknown" in the type, and the
 * ground stays the flat datum the viewport leaves undisturbed until somebody
 * answers the builder's Site step.
 *
 * Pure on purpose — no React, no network, no clock. The page renders it and
 * the spec checks it, so the sentence on screen and the arithmetic behind it
 * cannot drift apart.
 */
import type { BuilderSite } from "@/lib/builder/site";
import type { ParcelFacts } from "@/lib/design/parcel";
import type { LandDiscoveryListing } from "@/lib/marketplace/discovery";

/** A site derived from a listing always carries its parcel — the null-parcel
 *  case of BuilderSite is the "still looking" state, which this never is. */
export type ListingPlot = BuilderSite & { parcel: ParcelFacts };

/** The one sentence the action owes its reader, kept in the same file as the
 *  arithmetic it explains. */
export const PLOT_SETBACK_NOTE =
  "A listing states the width and depth left after the setbacks have already been taken off, so Aura carries that envelope across as the lot and records the setbacks as zero rather than inventing numbers it has not read.";

/** What a record with no evidenced envelope gets instead of a button. */
export const PLOT_UNKNOWN_NOTE =
  "This record has no evidenced buildable width and depth, so there is no plot here to carry into a design.";

export function siteFromListing(listing: LandDiscoveryListing): ListingPlot | null {
  const width = listing.facts.buildableWidthFt;
  const depth = listing.facts.buildableDepthFt;
  if (width.value === null || depth.value === null) return null;
  if (width.status === "unknown" || depth.status === "unknown") return null;
  if (!(width.value > 0) || !(depth.value > 0)) return null;

  return {
    parcel: {
      lotWidthFt: width.value,
      lotDepthFt: depth.value,
      frontSetbackFt: 0,
      sideSetbackFt: 0,
      rearSetbackFt: 0,
      frontFaces: "unknown",
      slope: "flat",
    },
    provenance: "listing-derived",
    grade: "flat",
  };
}

/**
 * Whether the site stored on a design is the one this listing produces.
 *
 * Compared on the lot rectangle and the provenance only, so answering slope
 * or facing in the builder — which is exactly what the Site step is for —
 * does not make the card forget which plot the project is carrying.
 */
export function isPlotOnSite(
  listing: LandDiscoveryListing,
  site: BuilderSite | null | undefined,
): boolean {
  const derived = siteFromListing(listing);
  if (!derived || !site?.parcel || site.provenance !== "listing-derived") return false;
  return (
    site.parcel.lotWidthFt === derived.parcel.lotWidthFt &&
    site.parcel.lotDepthFt === derived.parcel.lotDepthFt
  );
}
