// LAND stage data + filter, mirroring agent/src/parcels.ts.
// Parcel data duplicates agent/samples/parcels.sample.json — keep in sync.

export type AquiferReliability = "reliable" | "unreliable" | "unknown";

export interface ParcelListing {
  id: string;
  name: string;
  county: string;
  district: string;
  priceCad: number;
  /** null = not yet verified against the district land-use bylaw. */
  minDwellingSizeSqft: number | null;
  aquifer: AquiferReliability;
  gridDistanceKm: number;
  septicSoils: boolean;
  acreage?: number;
  basis?: string;
}

export interface ParcelFilterResult {
  parcel: ParcelListing;
  verdict: "PASS" | "REJECT";
  reasons: string[];
}

export const sampleParcels: ParcelListing[] = [
  {
    id: "lsa-aspen-road",
    name: "37 Aspen Road",
    county: "Lac Ste. Anne County",
    district: "Agricultural",
    priceCad: 75000,
    minDwellingSizeSqft: 592,
    aquifer: "unreliable",
    gridDistanceKm: 0.3,
    septicSoils: true,
    acreage: 3.1,
    basis: "realtor.ca Aug 2026; Agricultural district minimum 592 sqft (land-use bylaw)",
  },
  {
    id: "lsa-lakeside-estates",
    name: "Lakeside Estates",
    county: "Lac Ste. Anne County",
    district: "Country Residential",
    priceCad: 199900,
    minDwellingSizeSqft: 1076,
    aquifer: "reliable",
    gridDistanceKm: 0.1,
    septicSoils: true,
    acreage: 1.2,
    basis: "realtor.ca Aug 2026; Country Residential district minimum 1,076 sqft (land-use bylaw)",
  },
  {
    id: "lsa-twp572-hwy33",
    name: "Twp Rd 572 / Hwy 33",
    county: "Lac Ste. Anne County",
    district: "Agricultural",
    priceCad: 107000,
    minDwellingSizeSqft: 592,
    aquifer: "unknown",
    gridDistanceKm: 2.5,
    septicSoils: true,
    acreage: 4.6,
    basis: "realtor.ca Aug 2026; Agricultural district minimum 592 sqft (land-use bylaw)",
  },
  {
    id: "sturgeon-range-rd",
    name: "Range Rd 264, Sturgeon County",
    county: "Sturgeon County",
    district: "Agriculture",
    priceCad: 150000,
    minDwellingSizeSqft: null,
    aquifer: "reliable",
    gridDistanceKm: 0.8,
    septicSoils: false,
    acreage: 5.0,
    basis: "realtor.ca Aug 2026 (Sturgeon pricier than Lac Ste. Anne); district minimum NOT yet verified against Sturgeon LUB",
  },
];

const GRID_UNECONOMIC_KM = 1;

export function filterParcels(
  parcels: ParcelListing[],
  design: { sizeSqft: number; waterSource: "cistern" | "well" }
): ParcelFilterResult[] {
  return parcels.map((parcel) => {
    const reasons: string[] = [];
    let verdict: ParcelFilterResult["verdict"] = "PASS";

    if (parcel.minDwellingSizeSqft === null) {
      reasons.push(
        `District minimum dwelling size not verified for ${parcel.district} — confirm against the land-use bylaw before purchase.`
      );
    } else if (design.sizeSqft < parcel.minDwellingSizeSqft) {
      verdict = "REJECT";
      reasons.push(
        `Rejected: ${parcel.district} district requires a minimum dwelling of ` +
          `${parcel.minDwellingSizeSqft.toLocaleString("en-CA")} sqft; this design is ` +
          `${design.sizeSqft.toLocaleString("en-CA")} sqft. Minimums are set by the district bylaw, ` +
          `not the county — the same county can allow this build one road over.`
      );
    }

    if (parcel.aquifer === "unreliable") {
      reasons.push(
        design.waterSource === "well"
          ? "Aquifer unreliable — a well is not dependable on this parcel; water source forced to cistern."
          : "Aquifer unreliable — cistern is the right call here (a well would not be dependable)."
      );
    } else if (parcel.aquifer === "unknown") {
      reasons.push(
        "Aquifer reliability unknown — get well records for neighbouring parcels before counting on a well."
      );
    }

    if (parcel.gridDistanceKm > GRID_UNECONOMIC_KM) {
      reasons.push(
        `Grid ~${parcel.gridDistanceKm} km away — connection uneconomic; this off-grid design carries no penalty here.`
      );
    } else {
      reasons.push(
        `Grid within ~${parcel.gridDistanceKm} km — off-grid now, with an economical tie-in option later (grid-optional).`
      );
    }

    if (!parcel.septicSoils) {
      reasons.push(
        "Soils flagged unsuitable for a conventional septic field — budget for a mound or packaged treatment system."
      );
    }

    return { parcel, verdict, reasons };
  });
}
