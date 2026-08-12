import { keccak256, stringToHex } from "viem";
import {
  diagnoseProjectBudgetBasis,
  projectBudgetBasisReference,
  type ProjectBudget,
  type ProjectBudgetBasisDiagnostic,
  type ProjectBudgetLine,
  type ProjectBudgetScenario,
} from "../builder/projectBudget";
import { validateAuraProject, type AuraProject } from "./document";

export const PROJECT_RFQ_FORMAT = "aura-project-rfq" as const;
export const PROJECT_RFQ_VERSION = 2 as const;

export type RfqScope =
  | "whole-home"
  | "site-foundation"
  | "shell-envelope"
  | "mechanical-electrical-plumbing"
  | "energy-water-waste"
  | "interiors";

interface ProjectRfqBase {
  format: typeof PROJECT_RFQ_FORMAT;
  id: string;
  projectId: string;
  projectName: string;
  createdAtISO: string;
  responseDueISO: string | null;
  scope: RfqScope;
  contractorId: string | null;
  landSubjectIds: string[];
  designHash: `0x${string}`;
  designSummary: {
    homeName: string;
    floorAreaSqFt: number;
    footprintSqFt: number;
    storeys: number;
    material: string;
  };
  budgetBasis: {
    currency: "CAD";
    planningLowCad: number;
    planningMidCad: number;
    planningHighCad: number;
  };
  budgetLines: Array<Pick<ProjectBudgetLine, "id" | "label" | "low" | "mid" | "high" | "basis">>;
  requestedInclusions: string[];
  assumptions: string[];
  exclusions: string[];
  responseTemplate: string[];
  canonicalHash: `0x${string}`;
}

export interface LegacyProjectRfq extends ProjectRfqBase {
  version: 1;
}

export interface ProjectRfqV2 extends Omit<ProjectRfqBase, "budgetBasis"> {
  version: typeof PROJECT_RFQ_VERSION;
  budgetHash: `0x${string}`;
  budgetBasis: ProjectRfqBase["budgetBasis"] & {
    region: string;
    municipality: string;
    scenario: ProjectBudgetScenario;
    budgetCapCad: number | null;
  };
}

export type ProjectRfq = LegacyProjectRfq | ProjectRfqV2;

interface CreateRfqInput {
  id: string;
  project: AuraProject;
  budget: ProjectBudget;
  scope: RfqScope;
  contractorId: string | null;
  responseDueISO: string | null;
  createdAtISO: string;
}

const SCOPES = new Set<RfqScope>([
  "whole-home", "site-foundation", "shell-envelope", "mechanical-electrical-plumbing", "energy-water-waste", "interiors",
]);
const SCOPE_LINE_IDS: Record<Exclude<RfqScope, "whole-home">, string[]> = {
  "site-foundation": ["site-preparation", "screw_piles", "delivery-mobilization", "permits-design-engineering"],
  "shell-envelope": ["shell", "timber_frame", "hempcrete", "roof", "windows", "doors"],
  "mechanical-electrical-plumbing": ["hrv", "plumbing_electrical", "wood_stove"],
  "energy-water-waste": ["solar", "battery", "generator", "awg", "cistern", "rainwater", "septic", "municipal-connections"],
  interiors: ["interior", "cork", "reclaimed_interior", "furniture", "tub_deck"],
};
const REQUESTED: Record<RfqScope, string[]> = {
  "whole-home": ["Complete delivery scope by trade", "Site and foundation coordination", "Commissioning and owner handoff"],
  "site-foundation": ["Survey and site assumptions", "Access, drainage and excavation", "Engineered pile layout and field verification"],
  "shell-envelope": ["Panel or framing package", "Air, water and thermal control layers", "Roofing, windows, doors and erection"],
  "mechanical-electrical-plumbing": ["Mechanical and ventilation design", "Plumbing and electrical rough-in", "Testing, permits and commissioning"],
  "energy-water-waste": ["System sizing and design basis", "Equipment, controls and installation", "Testing, training and maintenance requirements"],
  interiors: ["Room-by-room finish scope", "Millwork, fixtures and allowances", "Installation schedule and deficiencies process"],
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validISO = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const HEX_32 = /^0x[a-f0-9]{64}$/i;

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

export function canonicalProjectRfqHash(value: Record<string, unknown> | ProjectRfq): `0x${string}` {
  const source = structuredClone(value) as unknown as Record<string, unknown>;
  delete source.canonicalHash;
  return keccak256(stringToHex(JSON.stringify(canonical(source))));
}

export function createProjectRfq(input: CreateRfqInput): ProjectRfqV2 {
  const project = validateAuraProject(input.project);
  if (!project.ok) throw new Error(`Cannot create RFQ: ${project.problem}`);
  if (input.budget.designHash !== project.project.design.documentHash) {
    throw new Error("The budget design does not match the project design. Refresh the budget before creating an RFQ.");
  }
  if (!SCOPES.has(input.scope)) throw new Error("RFQ scope is not supported.");
  if (!validISO(input.createdAtISO) || (input.responseDueISO !== null && !validISO(input.responseDueISO))) {
    throw new Error("RFQ dates are invalid.");
  }
  const allowed = input.scope === "whole-home" ? null : new Set(SCOPE_LINE_IDS[input.scope]);
  const budgetLines = input.budget.lines
    .filter((line) => allowed === null || allowed.has(line.id))
    .map(({ id, label, low, mid, high, basis }) => ({ id, label, low, mid, high, basis }));
  if (budgetLines.length === 0) throw new Error("The selected RFQ scope has no matching budget lines.");
  const reference = projectBudgetBasisReference(input.budget);
  const draft: Omit<ProjectRfqV2, "canonicalHash"> = {
    format: PROJECT_RFQ_FORMAT,
    version: PROJECT_RFQ_VERSION,
    id: input.id,
    projectId: project.project.id,
    projectName: project.project.name,
    createdAtISO: input.createdAtISO,
    responseDueISO: input.responseDueISO,
    scope: input.scope,
    contractorId: input.contractorId,
    landSubjectIds: [...project.project.discovery.land.shortlist].sort(),
    designHash: project.project.design.documentHash,
    budgetHash: input.budget.budgetHash,
    designSummary: {
      homeName: project.project.design.document.spec.name,
      floorAreaSqFt: input.budget.measures.areaSqFt,
      footprintSqFt: input.budget.measures.footprintSqFt,
      storeys: input.budget.measures.storeys,
      material: project.project.design.document.spec.material,
    },
    budgetBasis: {
      currency: "CAD",
      planningLowCad: budgetLines.reduce((sum, line) => sum + line.low, 0),
      planningMidCad: budgetLines.reduce((sum, line) => sum + line.mid, 0),
      planningHighCad: budgetLines.reduce((sum, line) => sum + line.high, 0),
      region: reference.region,
      municipality: reference.municipality,
      scenario: reference.scenario,
      budgetCapCad: reference.budgetCapCad,
    },
    budgetLines,
    requestedInclusions: REQUESTED[input.scope],
    assumptions: input.budget.assumptions,
    exclusions: input.budget.exclusions,
    responseTemplate: [
      "Fixed price and separately identified allowances in CAD",
      "Explicit inclusions, exclusions, taxes, freight and permit responsibility",
      "Proposed schedule, lead times, dependencies and expiry date",
      "Payment schedule, change-order process, warranty and insurance evidence",
      "Named subcontractors and comparable project references where applicable",
    ],
  };
  return { ...draft, canonicalHash: canonicalProjectRfqHash(draft as unknown as Record<string, unknown>) };
}

export function diagnoseProjectRfqBasis(rfq: ProjectRfq, budget: ProjectBudget): ProjectBudgetBasisDiagnostic {
  if (rfq.version === 1) return diagnoseProjectBudgetBasis(null, budget);
  return diagnoseProjectBudgetBasis({
    designHash: rfq.designHash,
    budgetHash: rfq.budgetHash,
    region: rfq.budgetBasis.region,
    municipality: rfq.budgetBasis.municipality,
    scenario: rfq.budgetBasis.scenario,
    budgetCapCad: rfq.budgetBasis.budgetCapCad,
  }, budget);
}

export function validateProjectRfq(value: unknown):
  | { ok: true; rfq: ProjectRfq }
  | { ok: false; problem: string; futureVersion?: number } {
  if (!isObject(value) || value.format !== PROJECT_RFQ_FORMAT) return { ok: false, problem: "RFQ format is not supported." };
  if (typeof value.version === "number" && value.version > PROJECT_RFQ_VERSION) {
    return { ok: false, problem: `This RFQ was created by a newer version (v${value.version}).`, futureVersion: value.version };
  }
  if (value.version !== 1 && value.version !== PROJECT_RFQ_VERSION) return { ok: false, problem: "RFQ version is not supported." };
  if (!SCOPES.has(value.scope as RfqScope)) return { ok: false, problem: "RFQ scope is invalid." };
  if (typeof value.id !== "string" || typeof value.projectId !== "string" || typeof value.projectName !== "string") return { ok: false, problem: "RFQ identity is invalid." };
  if (!validISO(value.createdAtISO) || (value.responseDueISO !== null && !validISO(value.responseDueISO))) return { ok: false, problem: "RFQ dates are invalid." };
  if (typeof value.designHash !== "string" || !HEX_32.test(value.designHash)) return { ok: false, problem: "RFQ design hash is invalid." };
  if (!isObject(value.budgetBasis) || !validBudgetTotals(value.budgetBasis)) return { ok: false, problem: "RFQ budget basis is invalid." };
  if (!Array.isArray(value.budgetLines) || value.budgetLines.length === 0 || !Array.isArray(value.responseTemplate)) return { ok: false, problem: "RFQ scope or response template is empty." };
  if (value.version === PROJECT_RFQ_VERSION) {
    if (typeof value.budgetHash !== "string" || !HEX_32.test(value.budgetHash)) return { ok: false, problem: "RFQ budget hash is invalid." };
    if (typeof value.budgetBasis.region !== "string" || typeof value.budgetBasis.municipality !== "string" || !validScenario(value.budgetBasis.scenario)) return { ok: false, problem: "RFQ planning scenario is invalid." };
    if (value.budgetBasis.budgetCapCad !== null && !(typeof value.budgetBasis.budgetCapCad === "number" && Number.isFinite(value.budgetBasis.budgetCapCad) && value.budgetBasis.budgetCapCad >= 0)) return { ok: false, problem: "RFQ budget cap is invalid." };
  }
  if (typeof value.canonicalHash !== "string" || !HEX_32.test(value.canonicalHash)) return { ok: false, problem: "RFQ canonical hash is invalid." };
  if (canonicalProjectRfqHash(value) !== value.canonicalHash) return { ok: false, problem: "RFQ canonical hash does not match its contents." };
  return { ok: true, rfq: structuredClone(value) as unknown as ProjectRfq };
}

function validBudgetTotals(value: Record<string, unknown>): boolean {
  return value.currency === "CAD"
    && [value.planningLowCad, value.planningMidCad, value.planningHighCad].every((amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
}

function validScenario(value: unknown): value is ProjectBudgetScenario {
  return isObject(value)
    && ["unknown", "serviced-flat", "rural-flat", "sloped", "remote"].includes(String(value.site))
    && ["serviced", "hybrid", "off-grid"].includes(String(value.utilities))
    && ["essential", "standard", "elevated"].includes(String(value.finish))
    && ["owner-builder", "hybrid", "full-service"].includes(String(value.delivery))
    && typeof value.shippingDistanceKm === "number" && Number.isFinite(value.shippingDistanceKm) && value.shippingDistanceKm >= 0
    && typeof value.contingencyPct === "number" && Number.isFinite(value.contingencyPct) && value.contingencyPct >= 0;
}
