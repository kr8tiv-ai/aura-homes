import { expect, test } from "playwright/test";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { createProjectBudget, defaultProjectBudgetScenario, type ProjectBudget } from "@/lib/builder/projectBudget";
import { createAuraProject, projectJourney, type AuraProject } from "@/lib/project/document";
import * as projectDocument from "@/lib/project/document";
import {
  createDiscoveryRecord,
  setProjectShortlist,
  upsertProjectDiscoveryRecord,
} from "@/lib/project/discoveryRecord";
import { createProjectRfq, validateProjectRfq, type ProjectRfq } from "@/lib/project/rfq";
import * as projectRfq from "@/lib/project/rfq";
import type { ContractorProfile } from "@/lib/marketplace/discovery";

const now = new Date("2026-08-12T12:00:00.000Z");
const document = defaultBuilderDocument();
const contractor: ContractorProfile = {
  id: "user-prairie-build",
  legalName: "Prairie Build Ltd.",
  displayName: "Prairie Build",
  region: "Foothills County",
  trades: ["whole-home-builder"],
  websiteUrl: "https://example.test",
  demonstration: false,
  evidence: [],
};

function project() {
  return createAuraProject({ id: "project-rfq", name: "Foothills home", journey: "find-land-build", purpose: "primary-home", document, now });
}

test("discovery records preserve provenance and project shortlists are deterministic", () => {
  const record = createDiscoveryRecord({
    id: "record-contractor-1",
    subjectId: contractor.id,
    access: "user-supplied",
    sourceLabel: "Entered by project owner",
    sourceUrl: contractor.websiteUrl,
    collectedAtISO: now.toISOString(),
    expiresAtISO: null,
    confidence: "unverified",
    data: contractor,
  });
  const withRecord = upsertProjectDiscoveryRecord(project(), "contractors", record, now);
  const shortlisted = setProjectShortlist(withRecord, "contractors", contractor.id, true, now);
  const twice = setProjectShortlist(shortlisted, "contractors", contractor.id, true, now);
  expect(shortlisted.discovery.contractors.records).toEqual([record]);
  expect(twice.discovery.contractors.shortlist).toEqual([contractor.id]);
  expect(projectJourney(twice).steps.find((step) => step.id === "team")?.complete).toBe(false);
});

test("an RFQ binds scope, design, budget and shortlisted discovery subjects", () => {
  let value = project();
  value = setProjectShortlist(value, "land", "parcel-17", true, now);
  value = setProjectShortlist(value, "contractors", contractor.id, true, now);
  const budget = createProjectBudget({
    document,
    scenario: defaultProjectBudgetScenario(),
    region: "Alberta",
    municipality: "Foothills County",
    budgetCapCad: 500_000,
  });
  const rfq = createProjectRfq({
    id: "rfq-shell-1",
    project: value,
    budget,
    scope: "shell-envelope",
    contractorId: contractor.id,
    responseDueISO: "2026-09-01T23:59:59.000Z",
    createdAtISO: now.toISOString(),
  });
  expect(rfq.designHash).toBe(value.design.documentHash);
  expect(rfq.version).toBe(2);
  expect((rfq as unknown as { budgetHash: string }).budgetHash).toBe((budget as unknown as { budgetHash: string }).budgetHash);
  expect(rfq.landSubjectIds).toEqual(["parcel-17"]);
  expect(rfq.contractorId).toBe(contractor.id);
  expect(rfq.budgetLines.some((line) => line.id === "shell")).toBe(true);
  expect(rfq.budgetLines.some((line) => line.id === "interior")).toBe(false);
  expect(rfq.responseTemplate.join(" ")).toMatch(/price|schedule|exclusions/i);
  expect(rfq.canonicalHash).toMatch(/^0x[a-f0-9]{64}$/);
  expect(validateProjectRfq(rfq).ok).toBe(true);
});

test("an RFQ uses the project's persisted current budget scenario", () => {
  const scenario = {
    ...defaultProjectBudgetScenario(),
    site: "remote" as const,
    utilities: "off-grid" as const,
    finish: "elevated" as const,
    delivery: "full-service" as const,
    shippingDistanceKm: 680,
    contingencyPct: 24,
    salesTaxPct: 5,
  };
  const source = createAuraProject({
    id: "project-rfq-persisted",
    name: "Persisted RFQ basis",
    journey: "find-land-build",
    purpose: "primary-home",
    document,
    now,
  });
  const selectedBudget = createProjectBudget({
    document: source.design.document,
    scenario,
    region: source.requirements.location.region,
    municipality: source.requirements.location.municipality,
    budgetCapCad: source.requirements.budgetCad.max,
  });
  const persist = (projectDocument as unknown as {
    withProjectBudgetBasis: (value: AuraProject, budget: ProjectBudget, at: Date) => AuraProject;
  }).withProjectBudgetBasis;
  const currentBudget = (projectDocument as unknown as {
    projectBudgetForProject?: (value: AuraProject) => ProjectBudget;
  }).projectBudgetForProject;
  expect(typeof currentBudget).toBe("function");
  if (!currentBudget) return;

  const saved = persist(source, selectedBudget, now);
  const budget = currentBudget(saved);
  const rfq = createProjectRfq({
    id: "rfq-persisted-basis",
    project: saved,
    budget,
    scope: "whole-home",
    contractorId: null,
    responseDueISO: null,
    createdAtISO: now.toISOString(),
  });

  expect(budget.budgetHash).toBe(saved.budgetBasis?.budgetHash);
  expect(rfq.budgetBasis.scenario).toEqual(scenario);
  expect(rfq.budgetHash).toBe(saved.budgetBasis?.budgetHash);
});

test("RFQ basis diagnostics identify the planning inputs changed after preparation", () => {
  const value = project();
  const original = createProjectBudget({ document, scenario: defaultProjectBudgetScenario(), region: "Alberta", municipality: "Foothills County", budgetCapCad: 500_000 });
  const rfq = createProjectRfq({ id: "rfq-basis", project: value, budget: original, scope: "whole-home", contractorId: null, responseDueISO: null, createdAtISO: now.toISOString() });
  const current = createProjectBudget({
    document,
    scenario: { ...defaultProjectBudgetScenario(), site: "sloped", shippingDistanceKm: 425, salesTaxPct: 5 },
    region: "British Columbia",
    municipality: "Nelson",
    budgetCapCad: 600_000,
  });
  const diagnose = (projectRfq as unknown as {
    diagnoseProjectRfqBasis: (value: ProjectRfq, budget: ProjectBudget) => { state: string; changes: Array<{ field: string }> };
  }).diagnoseProjectRfqBasis;
  expect(typeof diagnose).toBe("function");
  const result = diagnose(rfq, current);
  expect(result.state).toBe("changed");
  expect(result.changes.map((change) => change.field)).toEqual(expect.arrayContaining([
    "site", "shipping", "tax", "region", "municipality", "budget-cap",
  ]));
});

test("version one RFQ packages remain readable as legacy unbound evidence", () => {
  const value = project();
  const budget = createProjectBudget({ document, scenario: defaultProjectBudgetScenario(), region: "Alberta", municipality: "", budgetCapCad: null });
  const latest = createProjectRfq({ id: "rfq-legacy-source", project: value, budget, scope: "whole-home", contractorId: null, responseDueISO: null, createdAtISO: now.toISOString() });
  const legacy = structuredClone(latest) as unknown as Record<string, unknown>;
  legacy.version = 1;
  delete legacy.budgetHash;
  if (typeof legacy.budgetBasis === "object" && legacy.budgetBasis !== null) {
    const basis = legacy.budgetBasis as Record<string, unknown>;
    delete basis.region;
    delete basis.municipality;
    delete basis.scenario;
    delete basis.budgetCapCad;
  }
  delete legacy.canonicalHash;
  const hashLegacy = (projectRfq as unknown as { canonicalProjectRfqHash: (value: Record<string, unknown>) => string }).canonicalProjectRfqHash;
  expect(typeof hashLegacy).toBe("function");
  legacy.canonicalHash = hashLegacy(legacy);
  const checked = validateProjectRfq(legacy);
  expect(checked.ok).toBe(true);
  if (checked.ok) expect(checked.rfq.version).toBe(1);
});

test("RFQs cannot silently use a different design or unknown scope", () => {
  const budget = createProjectBudget({ document, scenario: defaultProjectBudgetScenario(), region: "Alberta", municipality: "", budgetCapCad: null });
  expect(() => createProjectRfq({ id: "rfq-bad", project: project(), budget: { ...budget, designHash: `0x${"0".repeat(64)}` }, scope: "whole-home", contractorId: null, responseDueISO: null, createdAtISO: now.toISOString() })).toThrow(/design/i);
  expect(validateProjectRfq({ format: "aura-project-rfq", version: 1, scope: "invented" }).ok).toBe(false);
  const invalidTax = createProjectRfq({ id: "rfq-invalid-tax", project: project(), budget, scope: "whole-home", contractorId: null, responseDueISO: null, createdAtISO: now.toISOString() });
  invalidTax.budgetBasis.scenario.salesTaxPct = 26;
  expect(validateProjectRfq(invalidTax).ok).toBe(false);
});
