// LAND stage: filter parcel listings against the design questionnaire.
// The district-minimum rejection is the demo moment — bylaws live at the
// DISTRICT level (never county), so the same county can pass and reject
// the identical design on two different parcels.

import { ParcelFilterResult, ParcelListing, Questionnaire } from "./types";

/** Grid further than this is treated as uneconomic to connect (off-grid wins). */
const GRID_UNECONOMIC_KM = 1;

export function filterParcels(
  parcels: ParcelListing[],
  questionnaire: Questionnaire
): ParcelFilterResult[] {
  return parcels.map((parcel) => {
    const reasons: string[] = [];
    let verdict: ParcelFilterResult["verdict"] = "PASS";
    const sizeSqft = questionnaire.home.sizeSqft;

    // 1. District minimum dwelling size (the hard gate).
    if (parcel.minDwellingSizeSqft === null) {
      reasons.push(
        `District minimum dwelling size not verified for ${parcel.district} — confirm against the land-use bylaw before purchase.`
      );
    } else if (sizeSqft < parcel.minDwellingSizeSqft) {
      verdict = "REJECT";
      reasons.push(
        `REJECTED: ${parcel.district} district requires a minimum dwelling of ` +
          `${parcel.minDwellingSizeSqft.toLocaleString("en-CA")} sqft; this design is ${sizeSqft.toLocaleString("en-CA")} sqft. ` +
          `Minimums are set by the district bylaw, not the county — the same county can allow this build one road over.`
      );
    }

    // 2. Aquifer reliability.
    if (parcel.aquifer === "unreliable") {
      reasons.push(
        questionnaire.water.source === "well"
          ? "Aquifer unreliable — a well is not dependable on this parcel; water source forced to cistern."
          : "Aquifer unreliable — cistern is the right call here (a well would not be dependable)."
      );
    } else if (parcel.aquifer === "unknown") {
      reasons.push("Aquifer reliability unknown — get well records for neighbouring parcels before counting on a well.");
    }

    // 3. Grid distance (grid-optional feasibility).
    if (parcel.gridDistanceKm > GRID_UNECONOMIC_KM) {
      reasons.push(
        `Grid ~${parcel.gridDistanceKm} km away — connection uneconomic; this off-grid design carries no penalty here.`
      );
    } else {
      reasons.push(
        `Grid within ~${parcel.gridDistanceKm} km — off-grid now, with an economical tie-in option later (grid-optional).`
      );
    }

    // 4. Septic soils.
    if (!parcel.septicSoils) {
      reasons.push(
        "Soils flagged unsuitable for a conventional septic field — budget for a mound or packaged treatment system."
      );
    }

    return { parcel, verdict, reasons };
  });
}
