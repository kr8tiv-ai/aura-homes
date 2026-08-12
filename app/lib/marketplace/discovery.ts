import type { ParcelListing } from "@agent/types";
import parcelsJson from "@samples/parcels.sample.json";

export type EvidenceStatus = "verified" | "declared" | "unknown";

export interface EvidenceFact<T> {
  value: T | null;
  status: EvidenceStatus;
  sourceLabel: string;
  sourceUrl: string | null;
  checkedAtISO: string | null;
}

export interface LandDesignRequirements {
  floorAreaSqft: number;
  footprintSqft: number;
  storeys: 1 | 2;
  maxHeightFt: number;
  preferredWater: "cistern" | "well" | "either";
}

export interface LandDiscoveryListing {
  id: string;
  providerId: string;
  providerListingId: string;
  title: string;
  region: string;
  priceCad: number | null;
  acreage: number | null;
  coordinates: { longitude: number; latitude: number } | null;
  listingUrl: string | null;
  /** True means this record demonstrates the product and is not offered for sale. */
  demonstration: boolean;
  facts: {
    districtMinimumSqft: EvidenceFact<number>;
    buildableWidthFt: EvidenceFact<number>;
    buildableDepthFt: EvidenceFact<number>;
    maximumHeightFt: EvidenceFact<number>;
    yearRoundRoadAccess: EvidenceFact<boolean>;
    potableWater: EvidenceFact<"well-supported" | "cistern-compatible" | "unknown">;
    septicSuitability: EvidenceFact<"conventional" | "alternative-system" | "unsuitable" | "unknown">;
    gridDistanceKm: EvidenceFact<number>;
  };
}

export type LandFitSeverity = "pass" | "check" | "block";

export interface LandFitFinding {
  id: string;
  label: string;
  severity: LandFitSeverity;
  detail: string;
  points: number;
  possiblePoints: number;
  sourceUrl: string | null;
}

export interface LandFitResult {
  listing: LandDiscoveryListing;
  score: number;
  verdict: "potential-match" | "manual-review" | "does-not-match";
  findings: LandFitFinding[];
}

export interface LandListingProviderDescriptor {
  id: string;
  name: string;
  access: "licensed-feed" | "external-search" | "demonstration";
  status: "not-connected" | "link-out" | "available";
  inAppBrowse: boolean;
  note: string;
  sourceUrl: string;
  termsUrl: string;
}

export const LAND_LISTING_PROVIDERS: LandListingProviderDescriptor[] = [
  {
    id: "crea-ddf",
    name: "REALTOR.ca DDF®",
    access: "licensed-feed",
    status: "not-connected",
    inAppBrowse: false,
    note:
      "The lawful in-app MLS path. It requires an eligible REALTOR®/broker relationship, DDF permissions, attribution, and an approved feed before Aura may display inventory.",
    sourceUrl: "https://www.crea.ca/technology/realtor-ca-for-realtors/realtor-ca-tools/realtor-ca-ddf/",
    termsUrl: "https://www.realtor.ca/terms-of-use",
  },
  {
    id: "alberta-site-selector",
    name: "Alberta Site Selector",
    access: "external-search",
    status: "link-out",
    inAppBrowse: false,
    note:
      "An official Alberta discovery surface for commercial and investment properties. Aura links out until a provider grants reusable feed rights.",
    sourceUrl: "https://regionaldashboard.alberta.ca/",
    termsUrl: "https://www.alberta.ca/disclaimer",
  },
  {
    id: "aura-demo-land",
    name: "Aura demonstration inventory",
    access: "demonstration",
    status: "available",
    inAppBrowse: true,
    note:
      "Four fictionalized records exercise fit, refusal, and unknown-evidence states. They are not active listings and cannot be purchased.",
    sourceUrl: "https://github.com/kr8tiv-ai/aura-homes",
    termsUrl: "https://github.com/kr8tiv-ai/aura-homes/blob/main/LICENSE",
  },
];

function finding<T>(
  id: string,
  label: string,
  fact: EvidenceFact<T>,
  possiblePoints: number,
  decide: (value: T) => { severity: LandFitSeverity; detail: string },
): LandFitFinding {
  if (fact.value === null || fact.status === "unknown") {
    return {
      id,
      label,
      severity: "check",
      detail: `${label} is not supported by connected evidence. Confirm it with the municipality, authority, survey, or qualified site professional.`,
      points: 0,
      possiblePoints,
      sourceUrl: fact.sourceUrl,
    };
  }
  const decision = decide(fact.value);
  const authoritative = fact.status === "verified";
  return {
    id,
    label,
    severity: decision.severity === "pass" && !authoritative ? "check" : decision.severity,
    detail:
      decision.severity === "pass" && !authoritative
        ? `${decision.detail} This is listing/dealer-declared rather than authority-verified.`
        : decision.detail,
    points: decision.severity === "pass" ? (authoritative ? possiblePoints : Math.floor(possiblePoints / 2)) : 0,
    possiblePoints,
    sourceUrl: fact.sourceUrl,
  };
}

export function evaluateLandListing(
  listing: LandDiscoveryListing,
  requirements: LandDesignRequirements,
): LandFitResult {
  const { facts } = listing;
  const findings: LandFitFinding[] = [
    finding("district-minimum", "District dwelling minimum", facts.districtMinimumSqft, 22, (minimum) =>
      requirements.floorAreaSqft + 0.01 >= minimum
        ? {
            severity: "pass",
            detail: `${Math.round(requirements.floorAreaSqft).toLocaleString("en-CA")} sqft meets the evidenced ${minimum.toLocaleString("en-CA")} sqft minimum.`,
          }
        : {
            severity: "block",
            detail: `The design is ${Math.round(requirements.floorAreaSqft).toLocaleString("en-CA")} sqft; the evidenced district minimum is ${minimum.toLocaleString("en-CA")} sqft.`,
          },
    ),
    (() => {
      const width = facts.buildableWidthFt;
      const depth = facts.buildableDepthFt;
      if (
        width.value === null ||
        depth.value === null ||
        width.status === "unknown" ||
        depth.status === "unknown"
      ) {
        return {
          id: "buildable-envelope",
          label: "Buildable envelope",
          severity: "check" as const,
          detail:
            "The post-setback buildable width and depth are not both evidenced. A parcel area alone cannot prove the home fits.",
          points: 0,
          possiblePoints: 20,
          sourceUrl: width.sourceUrl ?? depth.sourceUrl,
        };
      }
      const area = width.value * depth.value;
      const verified = width.status === "verified" && depth.status === "verified";
      const fits = area + 0.01 >= requirements.footprintSqft;
      return {
        id: "buildable-envelope",
        label: "Buildable envelope",
        severity: fits ? (verified ? ("pass" as const) : ("check" as const)) : ("block" as const),
        detail: fits
          ? `${width.value} × ${depth.value} ft yields ${Math.round(area).toLocaleString("en-CA")} sqft before shape, access, easement, and placement review.`
          : `${width.value} × ${depth.value} ft yields ${Math.round(area).toLocaleString("en-CA")} sqft, below the ${Math.round(requirements.footprintSqft).toLocaleString("en-CA")} sqft footprint.`,
        points: fits ? (verified ? 20 : 10) : 0,
        possiblePoints: 20,
        sourceUrl: width.sourceUrl ?? depth.sourceUrl,
      };
    })(),
    finding("height", "Height limit", facts.maximumHeightFt, 14, (maximum) =>
      requirements.maxHeightFt <= maximum + 0.01
        ? {
            severity: "pass",
            detail: `${requirements.maxHeightFt.toFixed(1)} ft is below the evidenced ${maximum.toFixed(1)} ft limit.`,
          }
        : {
            severity: "block",
            detail: `${requirements.maxHeightFt.toFixed(1)} ft exceeds the evidenced ${maximum.toFixed(1)} ft limit.`,
          },
    ),
    finding("road", "Year-round road access", facts.yearRoundRoadAccess, 14, (access) =>
      access
        ? { severity: "pass", detail: "Year-round legal road access is evidenced." }
        : { severity: "block", detail: "Year-round legal road access is not evidenced as available." },
    ),
    finding("water", "Potable water path", facts.potableWater, 10, (water) => {
      if (water === "unknown")
        return { severity: "check", detail: "The potable-water path still needs site evidence." };
      if (requirements.preferredWater === "well" && water !== "well-supported")
        return {
          severity: "check",
          detail: "The design preference is a well, but current evidence supports a cistern path only.",
        };
      return { severity: "pass", detail: `Evidence supports a ${water.replace("-", " ")} water path.` };
    }),
    finding("septic", "Wastewater path", facts.septicSuitability, 12, (septic) =>
      septic === "conventional"
        ? { severity: "pass", detail: "Current evidence supports a conventional private sewage path." }
        : septic === "alternative-system"
          ? {
              severity: "check",
              detail: "An alternative private sewage system may be required; price and approve it before purchase.",
            }
          : septic === "unsuitable"
            ? {
                severity: "check",
                detail: "Current evidence does not support a conventional field; qualified site design is required.",
              }
            : { severity: "check", detail: "Wastewater suitability is unknown." },
    ),
    finding("grid", "Grid proximity", facts.gridDistanceKm, 8, (distance) => ({
      severity: "pass",
      detail:
        distance <= 1
          ? `The grid is reported about ${distance} km away; connection cost still needs a utility quote.`
          : `The grid is reported about ${distance} km away; the off-grid design avoids assuming an economical tie-in.`,
    })),
  ];
  const score = Math.min(100, findings.reduce((sum, item) => sum + item.points, 0));
  const hasBlock = findings.some((item) => item.severity === "block");
  const hasCheck = findings.some((item) => item.severity === "check");
  return {
    listing,
    score,
    verdict: hasBlock ? "does-not-match" : hasCheck ? "manual-review" : "potential-match",
    findings,
  };
}

const fact = <T>(
  value: T | null,
  status: EvidenceStatus,
  sourceLabel: string,
  sourceUrl: string | null,
): EvidenceFact<T> => ({
  value,
  status,
  sourceLabel,
  sourceUrl,
  checkedAtISO: status === "unknown" ? null : "2026-08-11T12:00:00.000Z",
});

const bylawUrl = "https://www.lsac.ca/p/planning-development";
const sampleParcels = parcelsJson as ParcelListing[];

/** Product-only records. No REALTOR.ca content, photography, remarks, or active status is republished. */
export const DEMO_LAND_LISTINGS: LandDiscoveryListing[] = sampleParcels.map((parcel, index) => {
  const envelopes: Array<[number | null, number | null]> = [
    [92, 148],
    [74, 118],
    [null, null],
    [105, 180],
  ];
  const [width, depth] = envelopes[index] ?? [null, null];
  const coordinates = [
    { longitude: -114.35, latitude: 53.73 },
    { longitude: -113.93, latitude: 53.82 },
    { longitude: -113.66, latitude: 52.27 },
    { longitude: -114.08, latitude: 51.29 },
  ][index] ?? null;
  return {
    id: parcel.id,
    providerId: "aura-demo-land",
    providerListingId: parcel.id,
    title: `${parcel.name} · demonstration`,
    region: `${parcel.county} · ${parcel.district}`,
    priceCad: parcel.priceCad,
    acreage: parcel.acreage ?? null,
    coordinates,
    listingUrl: null,
    demonstration: true,
    facts: {
      districtMinimumSqft: fact(
        parcel.minDwellingSizeSqft,
        parcel.minDwellingSizeSqft === null ? "unknown" : "verified",
        parcel.minDwellingSizeSqft === null ? "No connected district source" : "Municipal bylaw scenario",
        parcel.county === "Lac Ste. Anne County" ? bylawUrl : null,
      ),
      buildableWidthFt: fact(width, width === null ? "unknown" : "declared", "Demonstration scenario", null),
      buildableDepthFt: fact(depth, depth === null ? "unknown" : "declared", "Demonstration scenario", null),
      maximumHeightFt: fact(
        parcel.minDwellingSizeSqft === null ? null : 35,
        parcel.minDwellingSizeSqft === null ? "unknown" : "declared",
        "Demonstration scenario",
        null,
      ),
      yearRoundRoadAccess: fact(true, "declared", "Demonstration scenario", null),
      potableWater: fact(
        parcel.aquifer === "reliable" ? "well-supported" : "cistern-compatible",
        parcel.aquifer === "unknown" ? "unknown" : "declared",
        "Demonstration scenario",
        null,
      ),
      septicSuitability: fact(
        parcel.septicSoils ? "conventional" : "alternative-system",
        "declared",
        "Demonstration scenario",
        null,
      ),
      gridDistanceKm: fact(parcel.gridDistanceKm, "declared", "Demonstration scenario", null),
    },
  };
});

export type ContractorEvidenceKind =
  | "alberta-builder-registry"
  | "wcb-clearance"
  | "service-alberta-licence"
  | "liability-insurance"
  | "comparable-projects"
  | "independent-reviews";

export interface ContractorEvidence {
  kind: ContractorEvidenceKind;
  status: "confirmed" | "not-found" | "expired" | "self-declared" | "unknown";
  label: string;
  sourceUrl: string | null;
  checkedAtISO: string | null;
  expiresAtISO: string | null;
}

export interface ContractorProfile {
  id: string;
  legalName: string;
  displayName: string;
  region: string;
  trades: Array<
    | "whole-home-builder"
    | "timber-and-envelope"
    | "site-and-foundation"
    | "off-grid-systems"
    | "interiors"
  >;
  websiteUrl: string | null;
  demonstration: boolean;
  evidence: ContractorEvidence[];
}

export interface ContractorScoreContribution {
  kind: ContractorEvidenceKind;
  label: string;
  points: number;
  possiblePoints: number;
  state: "confirmed" | "partial" | "missing" | "expired" | "negative";
  sourceUrl: string | null;
}

export interface ContractorScore {
  profile: ContractorProfile;
  score: number;
  readiness: "shortlist-ready" | "manual-review" | "not-ready";
  contributions: ContractorScoreContribution[];
  blockers: string[];
}

const CONTRACTOR_WEIGHTS: Record<ContractorEvidenceKind, number> = {
  "alberta-builder-registry": 30,
  "wcb-clearance": 20,
  "service-alberta-licence": 10,
  "liability-insurance": 15,
  "comparable-projects": 15,
  "independent-reviews": 10,
};

const CONTRACTOR_LABELS: Record<ContractorEvidenceKind, string> = {
  "alberta-builder-registry": "Alberta builder registry",
  "wcb-clearance": "WCB clearance",
  "service-alberta-licence": "Applicable provincial business licence",
  "liability-insurance": "Liability insurance",
  "comparable-projects": "Comparable project history",
  "independent-reviews": "Independent review evidence",
};

export function contractorEvidenceScore(profile: ContractorProfile, now: Date): ContractorScore {
  const nowMs = now.getTime();
  const contributions = (Object.keys(CONTRACTOR_WEIGHTS) as ContractorEvidenceKind[]).map((kind) => {
    const evidence = profile.evidence.find((item) => item.kind === kind);
    const expiredByDate =
      !!evidence?.expiresAtISO &&
      Number.isFinite(Date.parse(evidence.expiresAtISO)) &&
      Date.parse(evidence.expiresAtISO) < nowMs;
    const state: ContractorScoreContribution["state"] = !evidence
      ? "missing"
      : evidence.status === "not-found"
        ? "negative"
        : evidence.status === "expired" || expiredByDate
          ? "expired"
          : evidence.status === "confirmed"
            ? "confirmed"
            : evidence.status === "self-declared"
              ? "partial"
              : "missing";
    const possiblePoints = CONTRACTOR_WEIGHTS[kind];
    const points = state === "confirmed" ? possiblePoints : state === "partial" ? Math.floor(possiblePoints / 3) : 0;
    return {
      kind,
      label: evidence?.label ?? CONTRACTOR_LABELS[kind],
      points,
      possiblePoints,
      state,
      sourceUrl: evidence?.sourceUrl ?? null,
    };
  });
  const score = contributions.reduce((sum, item) => sum + item.points, 0);
  const licence = contributions.find((item) => item.kind === "alberta-builder-registry")!;
  const wcb = contributions.find((item) => item.kind === "wcb-clearance")!;
  const insurance = contributions.find((item) => item.kind === "liability-insurance")!;
  const blockers: string[] = [];
  if (licence.state !== "confirmed") blockers.push("Active Alberta residential builder licence is not confirmed.");
  if (wcb.state !== "confirmed") blockers.push("Current WCB clearance is not confirmed.");
  if (insurance.state !== "confirmed") blockers.push("Current liability insurance is not confirmed.");
  const explicitFailure = [licence, wcb].some((item) => item.state === "negative" || item.state === "expired");
  return {
    profile,
    score,
    readiness:
      explicitFailure
        ? "not-ready"
        : blockers.length === 0 && score >= 75
          ? "shortlist-ready"
          : "manual-review",
    contributions,
    blockers,
  };
}

const registry = "https://residentialprotection.alberta.ca/public-registry/Builder";
const wcb = "https://www.wcb.ab.ca/insurance-and-premiums/clearance-letters/";
const licence = "https://www.servicealberta.gov.ab.ca/consumer/business_search/index.cfm";

/** Fictional profiles used to demonstrate scoring until authorized directory records are connected. */
export const DEMO_CONTRACTORS: ContractorProfile[] = [
  {
    id: "demo-northern-field-house",
    legalName: "Northern Field House Ltd. (demonstration)",
    displayName: "Northern Field House",
    region: "Edmonton region",
    trades: ["whole-home-builder", "timber-and-envelope"],
    websiteUrl: null,
    demonstration: true,
    evidence: [
      { kind: "alberta-builder-registry", status: "confirmed", label: "Demonstrated active builder licence", sourceUrl: registry, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: "2027-01-31T00:00:00.000Z" },
      { kind: "wcb-clearance", status: "confirmed", label: "Demonstrated current WCB clearance", sourceUrl: wcb, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: "2026-09-30T00:00:00.000Z" },
      { kind: "service-alberta-licence", status: "confirmed", label: "Demonstrated applicable licence check", sourceUrl: licence, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: "2027-01-31T00:00:00.000Z" },
      { kind: "liability-insurance", status: "confirmed", label: "Demonstrated insurance certificate", sourceUrl: null, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: "2027-01-31T00:00:00.000Z" },
      { kind: "comparable-projects", status: "confirmed", label: "Demonstrated comparable projects and owner references", sourceUrl: null, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: null },
      { kind: "independent-reviews", status: "self-declared", label: "Demonstrated review-source summary", sourceUrl: null, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: null },
    ],
  },
  {
    id: "demo-prairie-offgrid",
    legalName: "Prairie Off-grid Works Ltd. (demonstration)",
    displayName: "Prairie Off-grid Works",
    region: "Central Alberta",
    trades: ["off-grid-systems", "site-and-foundation"],
    websiteUrl: null,
    demonstration: true,
    evidence: [
      { kind: "alberta-builder-registry", status: "unknown", label: "Builder licence not yet matched", sourceUrl: registry, checkedAtISO: null, expiresAtISO: null },
      { kind: "wcb-clearance", status: "confirmed", label: "Demonstrated current WCB clearance", sourceUrl: wcb, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: "2026-09-30T00:00:00.000Z" },
      { kind: "liability-insurance", status: "self-declared", label: "Insurance stated; certificate not reviewed", sourceUrl: null, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: null },
      { kind: "comparable-projects", status: "confirmed", label: "Demonstrated off-grid project references", sourceUrl: null, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: null },
      { kind: "independent-reviews", status: "confirmed", label: "Demonstrated multi-source review evidence", sourceUrl: null, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: null },
    ],
  },
  {
    id: "demo-riverbend-interiors",
    legalName: "Riverbend Natural Interiors Ltd. (demonstration)",
    displayName: "Riverbend Natural Interiors",
    region: "Calgary region",
    trades: ["interiors"],
    websiteUrl: null,
    demonstration: true,
    evidence: [
      { kind: "wcb-clearance", status: "expired", label: "Demonstrated expired WCB clearance", sourceUrl: wcb, checkedAtISO: "2026-07-01T12:00:00.000Z", expiresAtISO: "2026-07-31T00:00:00.000Z" },
      { kind: "liability-insurance", status: "confirmed", label: "Demonstrated insurance certificate", sourceUrl: null, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: "2027-01-31T00:00:00.000Z" },
      { kind: "comparable-projects", status: "confirmed", label: "Demonstrated interior project references", sourceUrl: null, checkedAtISO: "2026-08-11T12:00:00.000Z", expiresAtISO: null },
    ],
  },
];
