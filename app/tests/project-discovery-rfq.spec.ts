import { expect, test } from "playwright/test";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { createProjectBudget, defaultProjectBudgetScenario } from "@/lib/builder/projectBudget";
import { createAuraProject, projectJourney } from "@/lib/project/document";
import {
  createDiscoveryRecord,
  setProjectShortlist,
  upsertProjectDiscoveryRecord,
} from "@/lib/project/discoveryRecord";
import { createProjectRfq, validateProjectRfq } from "@/lib/project/rfq";
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
  return createAuraProject({ id: "project-rfq", name: "Foothills home", journey: "find-land-build", document, now });
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
  expect(projectJourney(twice).steps.find((step) => step.id === "team")?.complete).toBe(true);
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
  expect(rfq.landSubjectIds).toEqual(["parcel-17"]);
  expect(rfq.contractorId).toBe(contractor.id);
  expect(rfq.budgetLines.some((line) => line.id === "shell")).toBe(true);
  expect(rfq.budgetLines.some((line) => line.id === "interior")).toBe(false);
  expect(rfq.responseTemplate.join(" ")).toMatch(/price|schedule|exclusions/i);
  expect(rfq.canonicalHash).toMatch(/^0x[a-f0-9]{64}$/);
  expect(validateProjectRfq(rfq).ok).toBe(true);
});

test("RFQs cannot silently use a different design or unknown scope", () => {
  const budget = createProjectBudget({ document, scenario: defaultProjectBudgetScenario(), region: "Alberta", municipality: "", budgetCapCad: null });
  expect(() => createProjectRfq({ id: "rfq-bad", project: project(), budget: { ...budget, designHash: `0x${"0".repeat(64)}` }, scope: "whole-home", contractorId: null, responseDueISO: null, createdAtISO: now.toISOString() })).toThrow(/design/i);
  expect(validateProjectRfq({ format: "aura-project-rfq", version: 1, scope: "invented" }).ok).toBe(false);
});
