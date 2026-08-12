import { keccak256, stringToHex } from "viem";
import type { ProjectBudget, ProjectBudgetLine } from "../builder/projectBudget";
import { validateAuraProject, type AuraProject } from "./document";

export type RfqScope =
  | "whole-home"
  | "site-foundation"
  | "shell-envelope"
  | "mechanical-electrical-plumbing"
  | "energy-water-waste"
  | "interiors";

export interface ProjectRfq {
  format: "aura-project-rfq";
  version: 1;
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
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
function hashRfq(value: Omit<ProjectRfq, "canonicalHash">): `0x${string}` {
  return keccak256(stringToHex(JSON.stringify(canonical(value))));
}

export function createProjectRfq(input: CreateRfqInput): ProjectRfq {
  const project = validateAuraProject(input.project);
  if (!project.ok) throw new Error(`Cannot create RFQ: ${project.problem}`);
  if (input.budget.designHash !== project.project.design.documentHash)
    throw new Error("The budget design does not match the project design. Refresh the budget before creating an RFQ.");
  if (!SCOPES.has(input.scope)) throw new Error("RFQ scope is not supported.");
  if (!validISO(input.createdAtISO) || (input.responseDueISO !== null && !validISO(input.responseDueISO)))
    throw new Error("RFQ dates are invalid.");
  const allowed = input.scope === "whole-home" ? null : new Set(SCOPE_LINE_IDS[input.scope]);
  const budgetLines = input.budget.lines
    .filter((line) => allowed === null || allowed.has(line.id))
    .map(({ id, label, low, mid, high, basis }) => ({ id, label, low, mid, high, basis }));
  if (budgetLines.length === 0) throw new Error("The selected RFQ scope has no matching budget lines.");
  const draft: Omit<ProjectRfq, "canonicalHash"> = {
    format: "aura-project-rfq",
    version: 1,
    id: input.id,
    projectId: project.project.id,
    projectName: project.project.name,
    createdAtISO: input.createdAtISO,
    responseDueISO: input.responseDueISO,
    scope: input.scope,
    contractorId: input.contractorId,
    landSubjectIds: [...project.project.discovery.land.shortlist].sort(),
    designHash: project.project.design.documentHash,
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
  return { ...draft, canonicalHash: hashRfq(draft) };
}

export function validateProjectRfq(value: unknown):
  | { ok: true; rfq: ProjectRfq }
  | { ok: false; problem: string } {
  if (!isObject(value) || value.format !== "aura-project-rfq" || value.version !== 1)
    return { ok: false, problem: "RFQ format is not supported." };
  if (!SCOPES.has(value.scope as RfqScope)) return { ok: false, problem: "RFQ scope is invalid." };
  if (typeof value.id !== "string" || typeof value.projectId !== "string" || typeof value.projectName !== "string")
    return { ok: false, problem: "RFQ identity is invalid." };
  if (!validISO(value.createdAtISO) || (value.responseDueISO !== null && !validISO(value.responseDueISO)))
    return { ok: false, problem: "RFQ dates are invalid." };
  if (typeof value.designHash !== "string" || !/^0x[a-f0-9]{64}$/i.test(value.designHash))
    return { ok: false, problem: "RFQ design hash is invalid." };
  if (!Array.isArray(value.budgetLines) || value.budgetLines.length === 0 || !Array.isArray(value.responseTemplate))
    return { ok: false, problem: "RFQ scope or response template is empty." };
  if (typeof value.canonicalHash !== "string" || !/^0x[a-f0-9]{64}$/i.test(value.canonicalHash))
    return { ok: false, problem: "RFQ canonical hash is invalid." };
  const { canonicalHash, ...draft } = value as unknown as ProjectRfq;
  if (hashRfq(draft) !== canonicalHash) return { ok: false, problem: "RFQ canonical hash does not match its contents." };
  return { ok: true, rfq: structuredClone(value) as unknown as ProjectRfq };
}
