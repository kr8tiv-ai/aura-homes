/* Lot AREAS, summarised by zoning district, from the City of Edmonton's property
 * assessment register.
 *
 * WHY THIS FILE EXISTS. `lib/marketplace/landData.ts` can tell a reader what a
 * district's rules are. It cannot tell them what a lot in that district is
 * actually like, because a zoning district genuinely does not know your lot —
 * which is why `districtConstraintFacts` records the buildable width and depth
 * as unknown and why `plotSite.ts` refuses to derive a plot from a district.
 * The City's property register answers a narrower question honestly: across
 * every titled property it files under a district's base code, how large do the
 * lots turn out to be. That is a district typical, and it is never the reader's
 * own lot.
 *
 * WHAT THIS IS NOT, and the line that must survive every rewrite: a property
 * register records who owns what. It never records what is being sold. The
 * baked artifact carries no address, no coordinate, no owner, no account key and
 * no legal description, and `assertNoParcelIdentity` in the bake refuses to
 * write it if any of those appear.
 *
 * WHAT IT CANNOT DO:
 *   - It cannot give a lot width or a lot depth. The register publishes an AREA.
 *     No free source in Edmonton Open Data publishes frontage at all, so a width
 *     is structurally something a person has to state.
 *   - It cannot give a height ceiling. The register's zone codes are BASE codes
 *     and drop the `h` and `f` modifiers that carry the ceiling, so joining an
 *     address to a district still leaves the ceiling unknown.
 *   - It cannot say anything about one property. Every number here is a quantile
 *     over thousands of them.
 */

import bakedJson from "@data/land/edmonton-lot-areas.json";

import type { LandConstraintLicence } from "@/lib/marketplace/landData";

/* --------------------------------------------------------------- the file */

/** One zoning base code's lot-area distribution, in square metres. */
export interface EdmontonLotAreaSummary {
  /** The zone code with its modifiers stripped, e.g. `RS`. Joins to `EdmontonZoningDistrict.baseCode`. */
  baseCode: string;
  /** How many titled properties the quantiles were computed over. */
  n: number;
  p10SqM: number;
  p25SqM: number;
  medianSqM: number;
  p75SqM: number;
  p90SqM: number;
}

export interface EdmontonLotAreaSource {
  id: string;
  title: string;
  publisher: string;
  catalogueUrl: string;
  apiEndpoint: string;
  updateFrequency: string | null;
  /** The portal's own coverage string, verbatim. It disagrees with the other three dates. */
  periodOfCoverage: string | null;
  portalRowsUpdatedAtISO: string;
  rowsUpdatedAgeDays: number;
  retrievedAtISO: string;
}

export interface EdmontonLotAreaSet {
  $schema: string;
  retrievedAtISO: string;
  jurisdiction: { id: string; name: string; province: string; country: string };
  whatThisIs: string;
  whatThisCannotAnswer: string[];
  licence: LandConstraintLicence;
  method: { filter: string; units: string; quantile: string; join: string };
  source: EdmontonLotAreaSource;
  refusedSources: Array<{
    id: string;
    title: string;
    publisher: string;
    catalogueUrl: string;
    reason: string;
    checkedAtISO: string;
  }>;
  counts: {
    propertyRows: number;
    rowsWithZoneCode: number;
    rowsWithZoneCodeAndArea: number;
    zoneCodes: number;
    zoneCodesJoinedToRegister: number;
    rowJoinRate: number;
  };
  baseCodes: EdmontonLotAreaSummary[];
}

/* The bake asserts the shape; the cast happens once, here. Same pattern as
   `lib/marketplace/landData.ts:139`. */
export const EDMONTON_LOT_AREA_SET = bakedJson as unknown as EdmontonLotAreaSet;

/**
 * The one sentence every surface built on this file must carry. A constant
 * rather than retyped per page, because a boundary that is retyped is a boundary
 * that eventually gets paraphrased away.
 */
export const LOT_AREA_BOUNDARY =
  "Lot areas the City of Edmonton records in its property assessment register, summarised by zoning " +
  "district. A property register records who owns what. It never records what is being sold, and no " +
  "figure here describes any one property.";

/**
 * The coverage-year disclosure, printed wherever a register figure appears.
 *
 * Built from the artifact rather than typed out, so it cannot drift from the
 * dates that were actually baked. The portal's own four dates disagree with each
 * other — a title saying "Current Calendar Year", a coverage window, a "Date
 * Updated" custom field, and the row-update stamp this note quotes — so the
 * window is disclosed rather than reconciled into a claim of freshness.
 */
export const LOT_AREA_COVERAGE_NOTE = (() => {
  const { periodOfCoverage, portalRowsUpdatedAtISO, updateFrequency } = EDMONTON_LOT_AREA_SET.source;
  const window = periodOfCoverage
    ? `The City states the coverage of these records as ${periodOfCoverage}`
    : "The City states no coverage window for these records";
  const refresh = updateFrequency ? ` and refreshes them ${updateFrequency.toLowerCase()}` : "";
  return (
    `${window}${refresh}; the rows were last updated ${portalRowsUpdatedAtISO.slice(0, 10)}. ` +
    "A recent subdivision, rezoning, or new build may not be in them yet."
  );
})();

/* --------------------------------------------------------------- lookups */

/** (3.280839895 ft/m)^2, the same metre the district register converts with. */
const SQ_FEET_PER_SQ_METRE = 3.280839895 * 3.280839895;

const byBaseCode = new Map(
  EDMONTON_LOT_AREA_SET.baseCodes.map((summary) => [summary.baseCode.toUpperCase(), summary]),
);

/**
 * Case- and whitespace-forgiving, exactly like `findEdmontonDistrict`. Null when
 * the City records no titled lots under this code — three of its 79 codes carry
 * a single row each and were dropped by the bake's join, and a district that was
 * never in the register was never in it.
 */
export function lotAreaSummaryForBaseCode(baseCode: string): EdmontonLotAreaSummary | null {
  return byBaseCode.get(baseCode.trim().replace(/\s+/g, " ").toUpperCase()) ?? null;
}

export function sqMetresToSqFeet(sqM: number): number {
  return sqM * SQ_FEET_PER_SQ_METRE;
}

/** Thousands separators without a locale, so the string is the same everywhere it renders. */
function grouped(value: number): string {
  const rounded = Math.round(value);
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function bothUnits(sqM: number): string {
  return `${grouped(sqM)} m2 (${grouped(sqMetresToSqFeet(sqM))} sq ft)`;
}

/**
 * One rendered sentence, so the copy and the arithmetic cannot drift apart.
 *
 * It says "across N properties" and "half of them fall between" on purpose: this
 * is a district typical and the reader's own lot is not in the sentence. It
 * carries no market word and no word that would read as a verdict on a parcel.
 */
export function lotAreaSummarySentence(summary: EdmontonLotAreaSummary): string {
  return (
    `Across ${grouped(summary.n)} ${summary.baseCode} properties the City records a median lot area of ` +
    `${bothUnits(summary.medianSqM)}, with half of them between ${bothUnits(summary.p25SqM)} and ` +
    `${bothUnits(summary.p75SqM)}. That is what lots in this district tend to be, not the size of any one of them.`
  );
}

/**
 * The attribution the licence asks a redistributor to carry, plus the URL of the
 * terms — the City's redistribution condition is satisfied by passing the terms
 * along, so the URL travels with the sentence. Mirrors
 * `landConstraintAttribution()` for the district register.
 */
export function lotAreaAttribution(): { text: string; termsUrl: string; retrievedAtISO: string } {
  return {
    text: EDMONTON_LOT_AREA_SET.licence.attribution,
    termsUrl: EDMONTON_LOT_AREA_SET.licence.url,
    retrievedAtISO: EDMONTON_LOT_AREA_SET.retrievedAtISO,
  };
}
