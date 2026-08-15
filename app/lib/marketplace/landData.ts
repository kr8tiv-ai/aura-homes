/* Open-government land CONSTRAINT data.
 *
 * WHY THIS FILE EXISTS. The founder asked why he cannot search for land. The
 * fit engine worked; it had nothing real to point at. Of the three sources in
 * LAND_LISTING_PROVIDERS, REALTOR.ca DDF® lawfully needs an eligible
 * REALTOR®/broker relationship Aura does not have, Alberta Site Selector grants
 * no reusable feed rights, and the only connected one was four fictionalized
 * records that say so themselves.
 *
 * WHAT CHANGED. The City of Edmonton publishes the RULES that govern land under
 * an open licence that permits redistribution outright. That is not inventory
 * and this module must never let it read as inventory. It is authority data,
 * and it answers a better question than a feed does: not "what is on the
 * market", but "what would this district let me build". A person who has found
 * a parcel can have it checked against the design they actually drew.
 *
 * WHAT IT CANNOT DO, stated here so no caller has to guess:
 *   - It cannot say which district a given parcel is in. Polygon geometry is not
 *     baked (~8 MB of GeoJSON) and the static export will not carry it, so the
 *     honest move is a link to the City's own map. See CITY_ZONING_MAP_URL.
 *   - It cannot supply minimum Site area, Setbacks or minimum dwelling size.
 *     Those live in Zoning Bylaw 20001 text rather than in an open dataset, so
 *     every one of them is recorded `unknown` and carries the City's own URL.
 *   - It cannot say anything about water, private sewage, access or the grid.
 *     Those are parcel facts. A district record standing in for them would be
 *     the exact failure this module was built to stop.
 *
 * EVIDENCE VOCABULARY. `EvidenceStatus` from `./discovery`, unchanged and not
 * extended. Authority-published zoning is `verified`; nothing here is
 * `declared`; everything absent is `unknown` and scores zero. `suppliers.ts`
 * has its own separate confidence vocabulary and the two must not be mixed.
 */

import bakedJson from "@data/land/edmonton-zoning-districts.json";

import {
  evaluateLandFacts,
  type EvidenceFact,
  type LandDesignRequirements,
  type LandDiscoveryListing,
  type LandFitFinding,
} from "./discovery";

/* --------------------------------------------------------------- the file */

/** One zoning district as the City's own weekly extract publishes it. */
export interface EdmontonZoningDistrict {
  /** The code exactly as it appears on the City's zoning map, e.g. `RM h16`. */
  code: string;
  /** The code with its modifiers stripped, e.g. `RM`. */
  baseCode: string;
  name: string;
  /** Extra names the City files under the same code. Empty for almost every district. */
  nameVariants: string[];
  /** Raw modifier tokens, e.g. `["h16", "f3.5", "cf"]`. `cf` is deliberately uninterpreted. */
  modifiers: string[];
  /** Maximum Height in metres where the code carries an `h` modifier; null otherwise. */
  maxHeightM: number | null;
  /** Maximum Floor Area Ratio where the code carries an `f` modifier; null otherwise. */
  floorAreaRatio: number | null;
  bylawUrl: string | null;
  /** Why `bylawUrl` is null when it is: one section, one per site, or none published. */
  bylawUrlState: "single" | "site-specific" | "not-published";
  bylawUrlCount: number;
  mappedAreas: number;
}

export interface EdmontonZoningOverlay {
  code: string;
  name: string;
  bylawNumber: string | null;
  specialArea: boolean;
  mappedAreas: number;
}

export interface LandConstraintSource {
  id: string;
  title: string;
  publisher: string;
  catalogueUrl: string;
  apiEndpoint: string;
  updateFrequency: string | null;
  portalRowsUpdatedAtISO: string;
  retrievedAtISO: string;
  newestExtractAtISO?: string;
  extractAgeDays?: number;
  bylawUrlOnHostShare?: number;
}

export interface LandConstraintLicence {
  name: string;
  url: string;
  documentUrl: string;
  grant: string;
  redistributionCondition: string;
  attribution: string;
  portalLicenceId: string;
}

export interface LandConstraintSet {
  $schema: string;
  retrievedAtISO: string;
  jurisdiction: { id: string; name: string; province: string; country: string };
  whatThisIs: string;
  whatThisCannotAnswer: string[];
  licence: LandConstraintLicence;
  modifierConvention: {
    note: string;
    sourceUrl: string;
    interpreted: Record<string, string>;
    uninterpreted: string[];
    caution: string;
  };
  sources: LandConstraintSource[];
  refusedSources: Array<{
    id: string;
    title: string;
    publisher: string;
    catalogueUrl: string;
    periodOfCoverage: string | null;
    portalRowsUpdatedAtISO: string;
    reason: string;
    checkedAtISO: string;
  }>;
  counts: {
    districts: number;
    districtsWithEvidencedHeight: number;
    districtsWithOneBylawSection: number;
    mappedZoneAreas: number;
    overlays: number;
  };
  districts: EdmontonZoningDistrict[];
  overlays: EdmontonZoningOverlay[];
}

/* The bake asserts the shape; structural inference over a 78 KB JSON literal is
   slow and unhelpful, so the cast happens once, here. Same pattern as
   `lib/builder/regionalCost.ts`. */
export const EDMONTON_CONSTRAINT_SET = bakedJson as unknown as LandConstraintSet;

export const EDMONTON_DISTRICTS: EdmontonZoningDistrict[] = EDMONTON_CONSTRAINT_SET.districts;
export const EDMONTON_OVERLAYS: EdmontonZoningOverlay[] = EDMONTON_CONSTRAINT_SET.overlays;

/**
 * The one sentence that has to survive every rewrite of every surface built on
 * this module. Exported as a constant rather than retyped per page, because a
 * boundary that is retyped is a boundary that eventually gets paraphrased away.
 */
export const LAND_CONSTRAINT_BOUNDARY =
  "Zoning rules published by the City of Edmonton, not inventory. Nothing here is on offer, priced, or owned by Aura.";

/** Where a reader goes for the parcel-specific answer this module refuses to guess. */
export const CITY_ZONING_MAP_URL = "https://zoningbylaw.edmonton.ca/";

/* --------------------------------------------------------------- lookups */

const FEET_PER_METRE = 3.280839895;

const byCode = new Map(EDMONTON_DISTRICTS.map((district) => [district.code.toUpperCase(), district]));

/**
 * Exact code first, because `RM` and `RM h16` are different districts with
 * different ceilings and collapsing them would silently answer for the wrong
 * one. A caller holding only a base code gets `districtsByBaseCode` instead,
 * which returns all of them and makes the ambiguity the caller's to resolve.
 */
export function findEdmontonDistrict(code: string): EdmontonZoningDistrict | null {
  const normalised = code.trim().replace(/\s+/g, " ").toUpperCase();
  return byCode.get(normalised) ?? null;
}

export function districtsByBaseCode(baseCode: string): EdmontonZoningDistrict[] {
  const normalised = baseCode.trim().toUpperCase();
  return EDMONTON_DISTRICTS.filter((district) => district.baseCode.toUpperCase() === normalised);
}

/** Feet, from the metres the City published. Null stays null; a missing rule is not a zero. */
export function districtMaxHeightFt(district: EdmontonZoningDistrict): number | null {
  return district.maxHeightM === null ? null : district.maxHeightM * FEET_PER_METRE;
}

/* ------------------------------------------------------------ the facts */

type LandFactSet = LandDiscoveryListing["facts"];

const ZONING_SOURCE_LABEL = "City of Edmonton zoning map · Zoning Bylaw 20001";

/**
 * Why a district cannot answer a given question, in the district's own words.
 * The reader gets the reason and the authority's link, which is worth more than
 * a blank.
 */
const UNKNOWN_REASON = {
  bylawText:
    "Zoning Bylaw 20001 sets this in its own text rather than in an open dataset, so Aura does not restate it.",
  parcelFact: "This is a parcel fact. No zoning district can answer it, and Aura will not infer one.",
} as const;

function unknownFact<T>(reason: string, sourceUrl: string | null): EvidenceFact<T> {
  return { value: null, status: "unknown", sourceLabel: reason, sourceUrl, checkedAtISO: null };
}

/**
 * The district's constraints in the evidence shape the fit engine already
 * speaks. Exactly one of them can be answered from open data today — the height
 * ceiling the zone code publishes — and the other seven say `unknown` and point
 * at the authority. That ratio is the honest state of this data, not a gap to
 * be papered over.
 */
export function districtConstraintFacts(district: EdmontonZoningDistrict): LandFactSet {
  const bylawUrl = district.bylawUrl;
  const heightFt = districtMaxHeightFt(district);
  return {
    districtMinimumSqft: unknownFact<number>(UNKNOWN_REASON.bylawText, bylawUrl),
    buildableWidthFt: unknownFact<number>(UNKNOWN_REASON.parcelFact, bylawUrl),
    buildableDepthFt: unknownFact<number>(UNKNOWN_REASON.parcelFact, bylawUrl),
    maximumHeightFt:
      heightFt === null
        ? unknownFact<number>(UNKNOWN_REASON.bylawText, bylawUrl)
        : {
            value: heightFt,
            status: "verified",
            sourceLabel: `${ZONING_SOURCE_LABEL} · the ${district.modifiers.find((token) => /^h\d/.test(token)) ?? "h"} modifier on the zoning map is the zone ceiling in metres, before overlays and site-specific provisions`,
            sourceUrl: bylawUrl,
            checkedAtISO: EDMONTON_CONSTRAINT_SET.retrievedAtISO,
          },
    yearRoundRoadAccess: unknownFact<boolean>(UNKNOWN_REASON.parcelFact, bylawUrl),
    potableWater: unknownFact<"well-supported" | "cistern-compatible" | "unknown">(
      UNKNOWN_REASON.parcelFact,
      bylawUrl,
    ),
    septicSuitability: unknownFact<"conventional" | "alternative-system" | "unsuitable" | "unknown">(
      UNKNOWN_REASON.parcelFact,
      bylawUrl,
    ),
    gridDistanceKm: unknownFact<number>(UNKNOWN_REASON.parcelFact, bylawUrl),
  };
}

/* ------------------------------------------------------------- the check */

/**
 * A district check has two outcomes and neither of them is a match.
 *
 * `district-rule-blocks` — the design fails a rule the City published. That is a
 *   real, citable refusal and the most valuable thing this data does.
 * `parcel-evidence-required` — nothing published refuses the design, which is
 *   emphatically not the same as the parcel working.
 *
 * There is deliberately no third value. A district governs every parcel inside
 * it; it cannot know about the one you are standing on. Anything that scored a
 * district as a "potential match" would be inventing the parcel.
 */
export type EdmontonDistrictVerdict = "district-rule-blocks" | "parcel-evidence-required";

export interface EdmontonDistrictCheck {
  district: EdmontonZoningDistrict;
  verdict: EdmontonDistrictVerdict;
  findings: LandFitFinding[];
  /** Findings backed by authority evidence, and findings still open. They sum to `findings.length`. */
  evidenced: number;
  outstanding: number;
  /** The retrieval date of the data this check was made from. An undated check is a rumour. */
  checkedAtISO: string;
  sourceUrl: string | null;
  licence: LandConstraintLicence;
}

/**
 * No score. `evaluateLandListing` returns 0–100 because a record either fits or
 * does not; a district answers one question out of eight, and a number out of
 * 100 built from that would read as a verdict on the land. The counts say the
 * same thing without pretending to be a grade.
 */
export function evaluateEdmontonDistrict(
  district: EdmontonZoningDistrict,
  requirements: LandDesignRequirements,
): EdmontonDistrictCheck {
  const findings = evaluateLandFacts(districtConstraintFacts(district), requirements);
  const evidenced = findings.filter((finding) => finding.severity !== "check").length;
  return {
    district,
    verdict: findings.some((finding) => finding.severity === "block")
      ? "district-rule-blocks"
      : "parcel-evidence-required",
    findings,
    evidenced,
    outstanding: findings.length - evidenced,
    checkedAtISO: EDMONTON_CONSTRAINT_SET.retrievedAtISO,
    sourceUrl: district.bylawUrl,
    licence: EDMONTON_CONSTRAINT_SET.licence,
  };
}

/**
 * The attribution the licence asks a redistributor to carry, plus the URL of
 * the terms themselves — the City's redistribution condition is satisfied by
 * passing the terms along, so the URL travels with the sentence rather than
 * being left to a footer somebody might drop.
 */
export function landConstraintAttribution(): { text: string; termsUrl: string; retrievedAtISO: string } {
  return {
    text: EDMONTON_CONSTRAINT_SET.licence.attribution,
    termsUrl: EDMONTON_CONSTRAINT_SET.licence.url,
    retrievedAtISO: EDMONTON_CONSTRAINT_SET.retrievedAtISO,
  };
}
