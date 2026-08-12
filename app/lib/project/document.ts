import { keccak256, stringToHex } from "viem";
import {
  canonicalBuilderDocumentJson,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "../builder/document";

export const AURA_PROJECT_FORMAT = "aura-project" as const;
export const AURA_PROJECT_VERSION = 1 as const;

export type ProjectJourney = "find-land-build" | "build-on-owned-land" | "buy-finished-home";
export type JourneyStepId =
  | "requirements"
  | "design"
  | "land"
  | "team"
  | "quotes"
  | "funding"
  | "build"
  | "operate";

export interface AuraProject {
  format: typeof AURA_PROJECT_FORMAT;
  version: typeof AURA_PROJECT_VERSION;
  id: string;
  name: string;
  journey: ProjectJourney;
  createdAtISO: string;
  updatedAtISO: string;
  archivedAtISO: string | null;
  requirements: {
    location: { country: "Canada"; region: string; municipality: string };
    budgetCad: { min: number | null; max: number | null };
    householdSize: number | null;
    landStatus: "searching" | "owned" | "included-with-home";
    deliveryPreference: "site-built" | "manufactured" | "compare";
    timeline: string;
    accessibility: string[];
    utilityGoals: string[];
    cryptoComfort: "avoid" | "guided" | "experienced";
    completedAtISO: string | null;
  };
  design: { document: BuilderDocument; documentHash: `0x${string}` };
  discovery: {
    land: { shortlist: string[] };
    contractors: { shortlist: string[] };
    manufacturers: { shortlist: string[] };
  };
  delivery: {
    rfqs: unknown[];
    quotes: unknown[];
    orderSnapshotIds: string[];
  };
  milestones: unknown[];
  artifactManifests: unknown[];
}

export type AuraProjectValidation =
  | { ok: true; project: AuraProject }
  | { ok: false; problem: string; futureVersion?: number };

export function createAuraProject(_input: {
  id: string;
  name: string;
  journey: ProjectJourney;
  document: BuilderDocument;
  now: Date;
}): AuraProject {
  const input = _input;
  const checked = validateBuilderDocument(input.document);
  if (!checked.ok) throw new Error(`Cannot start a project from this design: ${checked.problem}`);
  const id = cleanId(input.id);
  const name = cleanText(input.name, "Untitled Aura project", 96);
  const atISO = input.now.toISOString();
  const document = JSON.parse(canonicalBuilderDocumentJson(checked.document)) as BuilderDocument;
  const landStatus =
    input.journey === "find-land-build"
      ? "searching"
      : input.journey === "build-on-owned-land"
        ? "owned"
        : "included-with-home";
  const deliveryPreference = input.journey === "buy-finished-home" ? "manufactured" : "site-built";
  return {
    format: AURA_PROJECT_FORMAT,
    version: AURA_PROJECT_VERSION,
    id,
    name,
    journey: input.journey,
    createdAtISO: atISO,
    updatedAtISO: atISO,
    archivedAtISO: null,
    requirements: {
      location: { country: "Canada", region: "Alberta", municipality: "" },
      budgetCad: { min: null, max: null },
      householdSize: null,
      landStatus,
      deliveryPreference,
      timeline: "",
      accessibility: [],
      utilityGoals: [],
      cryptoComfort: "avoid",
      completedAtISO: null,
    },
    design: { document, documentHash: hashBuilderDocument(document) },
    discovery: {
      land: { shortlist: [] },
      contractors: { shortlist: [] },
      manufacturers: { shortlist: [] },
    },
    delivery: { rfqs: [], quotes: [], orderSnapshotIds: [] },
    milestones: [],
    artifactManifests: [],
  };
}

export function validateAuraProject(_value: unknown): AuraProjectValidation {
  const value = _value;
  if (!isObject(value)) return { ok: false, problem: "Project is not an object." };
  if (value.format !== AURA_PROJECT_FORMAT)
    return { ok: false, problem: "That file is not an Aura project." };
  if (typeof value.version === "number" && value.version > AURA_PROJECT_VERSION) {
    return {
      ok: false,
      problem: `This project was saved by a newer version (v${value.version}; this build reads v${AURA_PROJECT_VERSION}). Nothing was loaded or overwritten.`,
      futureVersion: value.version,
    };
  }
  if (value.version !== AURA_PROJECT_VERSION)
    return { ok: false, problem: `Unsupported Aura project version ${String(value.version)}.` };
  if (typeof value.id !== "string" || cleanId(value.id) !== value.id)
    return { ok: false, problem: "Project id is missing or invalid." };
  if (typeof value.name !== "string" || value.name.trim().length === 0)
    return { ok: false, problem: "Project name is missing." };
  if (!PROJECT_JOURNEYS.has(value.journey as ProjectJourney))
    return { ok: false, problem: "Project journey is unsupported." };
  if (!validISO(value.createdAtISO) || !validISO(value.updatedAtISO))
    return { ok: false, problem: "Project timestamps are invalid." };
  if (value.archivedAtISO !== undefined && value.archivedAtISO !== null && !validISO(value.archivedAtISO))
    return { ok: false, problem: "Project archive timestamp is invalid." };
  const design = isObject(value.design) ? value.design : null;
  if (!design) return { ok: false, problem: "Project design is missing." };
  const checkedDocument = validateBuilderDocument(design.document);
  if (!checkedDocument.ok)
    return { ok: false, problem: `Project design is unreadable: ${checkedDocument.problem}` };
  const actualHash = hashBuilderDocument(checkedDocument.document);
  if (design.documentHash !== actualHash)
    return {
      ok: false,
      problem: `Project design hash mismatch: the embedded design resolves to ${actualHash}. Nothing was loaded.`,
    };
  if (!validateRequirements(value.requirements))
    return { ok: false, problem: "Project requirements are incomplete or malformed." };
  if (!validateDiscovery(value.discovery))
    return { ok: false, problem: "Project discovery records are malformed." };
  if (!validateDelivery(value.delivery))
    return { ok: false, problem: "Project delivery records are malformed." };
  if (!Array.isArray(value.milestones) || !Array.isArray(value.artifactManifests))
    return { ok: false, problem: "Project milestones or artifact manifests are malformed." };

  const project = JSON.parse(JSON.stringify(value)) as AuraProject;
  project.archivedAtISO = value.archivedAtISO === undefined ? null : value.archivedAtISO as string | null;
  project.design.document = checkedDocument.document;
  return { ok: true, project };
}

export function canonicalAuraProjectJson(_project: AuraProject): string {
  const checked = validateAuraProject(_project);
  if (!checked.ok) throw new Error(`Cannot serialize Aura project: ${checked.problem}`);
  return JSON.stringify(canonicalValue(checked.project));
}

export function hashAuraProject(_project: AuraProject): `0x${string}` {
  return keccak256(stringToHex(canonicalAuraProjectJson(_project)));
}

export function withProjectDesign(
  _project: AuraProject,
  _document: BuilderDocument,
  _now: Date,
): AuraProject {
  const project = validateAuraProject(_project);
  if (!project.ok) throw new Error(`Cannot update this project: ${project.problem}`);
  const document = validateBuilderDocument(_document);
  if (!document.ok) throw new Error(`Cannot save this design: ${document.problem}`);
  const durable = JSON.parse(canonicalBuilderDocumentJson(document.document)) as BuilderDocument;
  return {
    ...project.project,
    updatedAtISO: _now.toISOString(),
    design: {
      document: durable,
      documentHash: hashBuilderDocument(durable),
    },
  };
}

export function projectJourney(_project: AuraProject): {
  steps: Array<{ id: JourneyStepId; complete: boolean }>;
  next: { id: JourneyStepId; complete: boolean };
} {
  const project = _project;
  const requirementsComplete = project.requirements.completedAtISO !== null;
  const designComplete = validateBuilderDocument(project.design.document).ok;
  const landComplete =
    project.journey !== "find-land-build" || project.discovery.land.shortlist.length > 0;
  const teamComplete =
    project.journey === "buy-finished-home"
      ? project.discovery.manufacturers.shortlist.length > 0
      : project.discovery.contractors.shortlist.length > 0;
  const quotesComplete = project.delivery.quotes.length > 0;
  const fundingComplete = project.delivery.orderSnapshotIds.length > 0;
  const buildComplete = project.milestones.length > 0;
  const operateComplete = project.artifactManifests.length > 0;
  const completed: Record<JourneyStepId, boolean> = {
    requirements: requirementsComplete,
    design: designComplete,
    land: landComplete,
    team: teamComplete,
    quotes: quotesComplete,
    funding: fundingComplete,
    build: buildComplete,
    operate: operateComplete,
  };
  const ids: JourneyStepId[] = [
    "requirements",
    "design",
    "land",
    "team",
    "quotes",
    "funding",
    "build",
    "operate",
  ];
  const steps = ids.map((id) => ({ id, complete: completed[id] }));
  return { steps, next: steps.find((step) => !step.complete) ?? steps[steps.length - 1] };
}

const PROJECT_JOURNEYS = new Set<ProjectJourney>([
  "find-land-build",
  "build-on-owned-land",
  "buy-finished-home",
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validISO = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

function cleanId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 96);
  if (!cleaned) throw new Error("A project needs an identifier.");
  return cleaned;
}

function cleanText(value: string, fallback: string, max: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, max);
  return cleaned || fallback;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isObject(value)) return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalValue(value[key]);
  return output;
}

function validateRequirements(value: unknown): value is AuraProject["requirements"] {
  if (!isObject(value) || !isObject(value.location) || !isObject(value.budgetCad)) return false;
  if (
    value.location.country !== "Canada" ||
    typeof value.location.region !== "string" ||
    typeof value.location.municipality !== "string"
  ) return false;
  const optionalMoney = (amount: unknown) => amount === null || (typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
  if (!optionalMoney(value.budgetCad.min) || !optionalMoney(value.budgetCad.max)) return false;
  if (value.householdSize !== null && !(typeof value.householdSize === "number" && Number.isInteger(value.householdSize) && value.householdSize > 0)) return false;
  if (!["searching", "owned", "included-with-home"].includes(String(value.landStatus))) return false;
  if (!["site-built", "manufactured", "compare"].includes(String(value.deliveryPreference))) return false;
  if (!["avoid", "guided", "experienced"].includes(String(value.cryptoComfort))) return false;
  return (
    typeof value.timeline === "string" &&
    Array.isArray(value.accessibility) &&
    value.accessibility.every((item) => typeof item === "string") &&
    Array.isArray(value.utilityGoals) &&
    value.utilityGoals.every((item) => typeof item === "string") &&
    (value.completedAtISO === null || validISO(value.completedAtISO))
  );
}

function validateDiscovery(value: unknown): value is AuraProject["discovery"] {
  if (!isObject(value)) return false;
  return [value.land, value.contractors, value.manufacturers].every(
    (group) => isObject(group) && Array.isArray(group.shortlist) && group.shortlist.every((id) => typeof id === "string"),
  );
}

function validateDelivery(value: unknown): value is AuraProject["delivery"] {
  return (
    isObject(value) &&
    Array.isArray(value.rfqs) &&
    Array.isArray(value.quotes) &&
    Array.isArray(value.orderSnapshotIds) &&
    value.orderSnapshotIds.every((id) => typeof id === "string")
  );
}
