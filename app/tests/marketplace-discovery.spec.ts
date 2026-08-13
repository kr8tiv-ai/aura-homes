import { expect, test } from "playwright/test";

import { convertBuilderDocumentToGraph, defaultBuilderDocument } from "@/lib/builder/document";
import { duplicateGraphStorey } from "@/lib/builder/buildingGraph";
import {
  contractorEvidenceScore,
  evaluateLandListing,
  type ContractorProfile,
  type LandDiscoveryListing,
} from "@/lib/marketplace/discovery";
import { deriveLandRequirements } from "@/lib/marketplace/designLandRequirements";

const verified = <T>(value: T) => ({
  value,
  status: "verified" as const,
  sourceLabel: "Official source",
  sourceUrl: "https://example.test/source",
  checkedAtISO: "2026-08-11T12:00:00.000Z",
});

function listing(overrides: Partial<LandDiscoveryListing> = {}): LandDiscoveryListing {
  return {
    id: "listing-1",
    providerId: "demo",
    providerListingId: "demo-1",
    title: "Demonstration parcel",
    region: "Lac Ste. Anne County, Alberta",
    priceCad: 125_000,
    acreage: 3.2,
    coordinates: { longitude: -114.35, latitude: 53.73 },
    listingUrl: null,
    demonstration: true,
    facts: {
      districtMinimumSqft: verified(592),
      buildableWidthFt: verified(90),
      buildableDepthFt: verified(140),
      maximumHeightFt: verified(35),
      yearRoundRoadAccess: verified(true),
      potableWater: verified("cistern-compatible" as const),
      septicSuitability: verified("conventional" as const),
      gridDistanceKm: verified(0.4),
    },
    ...overrides,
  };
}

test("land requirements come from the durable builder document", () => {
  const legacy = defaultBuilderDocument();
  const legacyRequirements = deriveLandRequirements(legacy);
  expect(legacyRequirements.floorAreaSqft).toBeGreaterThan(0);
  expect(legacyRequirements.footprintSqft).toBeGreaterThan(0);
  expect(legacyRequirements.storeys).toBe(1);

  const converted = convertBuilderDocumentToGraph(legacy, 0.5);
  expect(converted.ok).toBe(true);
  if (!converted.ok || converted.document.geometry.kind !== "building-graph") return;
  const duplicated = duplicateGraphStorey(converted.document.geometry.graph, "storey-1", {
    id: "storey-2",
    name: "Upper floor",
    elevationFt: converted.document.geometry.graph.storeys[0].heightFt,
  });
  expect(duplicated.ok).toBe(true);
  if (!duplicated.ok) return;
  const upper = {
    ...converted.document,
    geometry: { ...converted.document.geometry, graph: duplicated.graph },
  };
  const requirements = deriveLandRequirements(upper);
  expect(requirements.storeys).toBe(2);
  expect(requirements.floorAreaSqft).toBeGreaterThan(requirements.footprintSqft);
  expect(requirements.maxHeightFt).toBeGreaterThan(legacyRequirements.maxHeightFt);
});

test("a known district minimum can refuse a design but unknown evidence never passes", () => {
  const requirements = {
    floorAreaSqft: 800,
    footprintSqft: 800,
    storeys: 1 as const,
    maxHeightFt: 18,
    preferredWater: "cistern" as const,
  };

  const rejected = evaluateLandListing(
    listing({ facts: { ...listing().facts, districtMinimumSqft: verified(1_076) } }),
    requirements,
  );
  expect(rejected.verdict).toBe("does-not-match");
  expect(rejected.findings.some((finding) => finding.severity === "block")).toBe(true);

  const unknown = evaluateLandListing(
    listing({
      facts: {
        ...listing().facts,
        districtMinimumSqft: {
          value: null,
          status: "unknown",
          sourceLabel: "No connected authority source",
          sourceUrl: null,
          checkedAtISO: null,
        },
      },
    }),
    requirements,
  );
  expect(unknown.verdict).toBe("manual-review");
  expect(unknown.score).toBeLessThan(100);
  expect(unknown.findings.some((finding) => finding.severity === "check")).toBe(true);
});

test("buildable envelope and height are hard fit checks when their evidence is verified", () => {
  const result = evaluateLandListing(listing(), {
    floorAreaSqft: 1_600,
    footprintSqft: 13_000,
    storeys: 1,
    maxHeightFt: 40,
    preferredWater: "well",
  });
  expect(result.verdict).toBe("does-not-match");
  expect(result.findings.filter((finding) => finding.severity === "block")).toHaveLength(2);
});

const contractor: ContractorProfile = {
  id: "contractor-1",
  legalName: "Demonstration Timber Works Ltd.",
  displayName: "Demonstration Timber Works",
  region: "Edmonton region",
  trades: ["whole-home-builder", "timber-and-envelope"],
  websiteUrl: null,
  demonstration: true,
  evidence: [
    {
      kind: "alberta-builder-registry",
      status: "confirmed",
      label: "Active Alberta residential builder licence",
      sourceUrl: "https://residentialprotection.alberta.ca/public-registry/Builder",
      checkedAtISO: "2026-08-11T12:00:00.000Z",
      expiresAtISO: "2027-01-01T00:00:00.000Z",
    },
    {
      kind: "wcb-clearance",
      status: "confirmed",
      label: "Current WCB clearance",
      sourceUrl: "https://www.wcb.ab.ca/insurance-and-premiums/clearance-letters/",
      checkedAtISO: "2026-08-11T12:00:00.000Z",
      expiresAtISO: "2026-09-01T00:00:00.000Z",
    },
    {
      kind: "liability-insurance",
      status: "confirmed",
      label: "Insurance certificate supplied",
      sourceUrl: null,
      checkedAtISO: "2026-08-11T12:00:00.000Z",
      expiresAtISO: "2027-01-01T00:00:00.000Z",
    },
    {
      kind: "comparable-projects",
      status: "confirmed",
      label: "Three comparable projects with owner references",
      sourceUrl: null,
      checkedAtISO: "2026-08-11T12:00:00.000Z",
      expiresAtISO: null,
    },
  ],
};

test("contractor score is an explainable evidence score with mandatory gates", () => {
  const scored = contractorEvidenceScore(contractor, new Date("2026-08-11T12:00:00.000Z"));
  expect(scored.score).toBeGreaterThanOrEqual(75);
  expect(scored.readiness).toBe("shortlist-ready");
  expect(scored.contributions.reduce((sum, item) => sum + item.points, 0)).toBe(scored.score);

  const missingWcb = contractorEvidenceScore(
    { ...contractor, evidence: contractor.evidence.filter((item) => item.kind !== "wcb-clearance") },
    new Date("2026-08-11T12:00:00.000Z"),
  );
  expect(missingWcb.readiness).toBe("manual-review");
  expect(missingWcb.blockers).toContain("Current WCB clearance is not confirmed.");

  const expiredLicence = contractorEvidenceScore(
    {
      ...contractor,
      evidence: contractor.evidence.map((item) =>
        item.kind === "alberta-builder-registry"
          ? { ...item, expiresAtISO: "2026-08-01T00:00:00.000Z" }
          : item,
      ),
    },
    new Date("2026-08-11T12:00:00.000Z"),
  );
  expect(expiredLicence.readiness).toBe("not-ready");
  expect(expiredLicence.score).toBeLessThan(scored.score);

  const unbackedOwnerChecks = contractorEvidenceScore(
    {
      ...contractor,
      demonstration: false,
      evidence: contractor.evidence.map((item) => ({ ...item, sourceUrl: null })),
    },
    new Date("2026-08-11T12:00:00.000Z"),
  );
  expect(unbackedOwnerChecks.readiness).toBe("manual-review");
  expect(unbackedOwnerChecks.blockers).toContain("Active Alberta residential builder licence is not confirmed.");
});
