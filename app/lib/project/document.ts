import { keccak256, stringToHex } from "viem";
import {
  canonicalBuilderDocumentJson,
  defaultBuilderDocument,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "../builder/document";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  hashProjectBudget,
  projectBudgetBasisReference,
  type BudgetRange,
  type ProjectBudget,
  type ProjectBudgetBasisReference,
  type ProjectBudgetScenario,
} from "../builder/projectBudget";

export const AURA_PROJECT_FORMAT = "aura-project" as const;
export const AURA_PROJECT_VERSION = 2 as const;

export type ProjectJourney = "find-land-build" | "build-on-owned-land" | "buy-finished-home";
export type ProjectPurpose = "primary-home" | "eco-stay";
export type JourneyStepId =
  | "requirements"
  | "design"
  | "land"
  | "team"
  | "quotes"
  | "funding"
  | "build"
  | "operate";
export type JourneyStepStatus = "not-started" | "in-progress" | "blocked" | "complete";

export interface ProjectStepState {
  status: JourneyStepStatus;
  confirmedAtISO: string | null;
  basisHash: `0x${string}` | null;
}

export interface ProjectBlocker {
  id: string;
  stepId: JourneyStepId;
  summary: string;
  detail: string;
  source: "user" | "system";
  createdAtISO: string;
  resolvedAtISO: string | null;
}

export interface ProjectNextAction {
  stepId: JourneyStepId;
  label: string;
  reason: string;
}

export interface PersistedProjectBudgetBasis extends ProjectBudgetBasisReference {
  currency: "CAD";
  calculatedAtISO: string;
  assumptions: string[];
  total: BudgetRange;
}

export interface AuraProject {
  format: typeof AURA_PROJECT_FORMAT;
  version: typeof AURA_PROJECT_VERSION;
  id: string;
  name: string;
  journey: ProjectJourney;
  purpose: ProjectPurpose;
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
    land: { shortlist: string[]; records?: unknown[] };
    contractors: { shortlist: string[]; records?: unknown[] };
    manufacturers: { shortlist: string[]; records?: unknown[] };
  };
  delivery: {
    rfqs: unknown[];
    quotes: unknown[];
    orderSnapshotIds: string[];
  };
  milestones: unknown[];
  artifactManifests: unknown[];
  stepStates: Record<JourneyStepId, ProjectStepState>;
  budgetBasis: PersistedProjectBudgetBasis | null;
  blockers: ProjectBlocker[];
  recommendedNextAction: ProjectNextAction | null;
}

type AuraProjectV1 = Omit<
  AuraProject,
  "version" | "purpose" | "stepStates" | "budgetBasis" | "blockers" | "recommendedNextAction"
> & { version: 1 };

export type AuraProjectValidation =
  | { ok: true; project: AuraProject; migratedFromVersion?: 1 }
  | { ok: false; problem: string; futureVersion?: number };

const JOURNEY_STEP_IDS: JourneyStepId[] = [
  "requirements",
  "design",
  "land",
  "team",
  "quotes",
  "funding",
  "build",
  "operate",
];

const NEXT_ACTIONS: Record<JourneyStepId, Omit<ProjectNextAction, "stepId">> = {
  requirements: { label: "Complete your project brief", reason: "Location, budget, household and timing shape every later decision." },
  design: { label: "Choose or shape your home", reason: "Confirm the design before matching land and preparing costs." },
  land: { label: "Confirm land or delivery", reason: "Site and delivery facts materially change feasibility and cost." },
  team: { label: "Build a checked project team", reason: "Record the evidence behind each project participant." },
  quotes: { label: "Compare real quotes", reason: "Replace planning allowances with comparable vendor evidence." },
  funding: { label: "Confirm the funding path", reason: "Choose a payment path only after a real scope and quote exist." },
  build: { label: "Plan build milestones", reason: "Turn the accepted scope into explicit delivery checkpoints." },
  operate: { label: "Prepare the home book", reason: "Keep commissioning, warranties and maintenance with the completed home." },
};

export function createAuraProject(input: {
  id: string;
  name: string;
  journey: ProjectJourney;
  purpose: ProjectPurpose;
  document: BuilderDocument;
  now: Date;
}): AuraProject {
  if (!PROJECT_PURPOSES.has(input.purpose)) {
    throw new Error("Choose a project purpose before creating this project.");
  }
  const checked = validateBuilderDocument(input.document);
  if (!checked.ok) throw new Error(`Cannot start a project from this design: ${checked.problem}`);
  const id = cleanId(input.id);
  const name = cleanText(input.name, "Untitled Aura project", 96);
  const atISO = input.now.toISOString();
  const document = JSON.parse(canonicalBuilderDocumentJson(checked.document)) as BuilderDocument;
  const landStatus = input.journey === "find-land-build"
    ? "searching"
    : input.journey === "build-on-owned-land"
      ? "owned"
      : "included-with-home";
  const deliveryPreference = input.journey === "buy-finished-home" ? "manufactured" : "site-built";
  const stepStates = emptyStepStates();
  return {
    format: AURA_PROJECT_FORMAT,
    version: AURA_PROJECT_VERSION,
    id,
    name,
    journey: input.journey,
    purpose: input.purpose,
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
      land: { shortlist: [], records: [] },
      contractors: { shortlist: [], records: [] },
      manufacturers: { shortlist: [], records: [] },
    },
    delivery: { rfqs: [], quotes: [], orderSnapshotIds: [] },
    milestones: [],
    artifactManifests: [],
    stepStates,
    budgetBasis: null,
    blockers: [],
    recommendedNextAction: nextActionFor(stepStates),
  };
}

export function validateAuraProject(value: unknown): AuraProjectValidation {
  if (!isObject(value)) return { ok: false, problem: "Project is not an object." };
  if (value.format !== AURA_PROJECT_FORMAT) return { ok: false, problem: "That file is not an Aura project." };
  if (typeof value.version === "number" && value.version > AURA_PROJECT_VERSION) {
    return {
      ok: false,
      problem: `This project was saved by a newer version (v${value.version}; this build reads v${AURA_PROJECT_VERSION}). Nothing was loaded or overwritten.`,
      futureVersion: value.version,
    };
  }
  if (value.version === 1) {
    const legacy = validateProjectCore(value);
    if (!legacy.ok) return legacy;
    return { ok: true, project: migrateProjectV1(value as unknown as AuraProjectV1, legacy.document), migratedFromVersion: 1 };
  }
  if (value.version !== AURA_PROJECT_VERSION) {
    return { ok: false, problem: `Unsupported Aura project version ${String(value.version)}.` };
  }
  const core = validateProjectCore(value);
  if (!core.ok) return core;
  if (!PROJECT_PURPOSES.has(value.purpose as ProjectPurpose)) return { ok: false, problem: "Project purpose is unsupported." };
  if (!validateStepStates(value.stepStates)) return { ok: false, problem: "Project journey states are malformed." };
  if (!validateBudgetBasis(value.budgetBasis)) return { ok: false, problem: "Project budget basis is malformed." };
  if (!validateBlockers(value.blockers)) return { ok: false, problem: "Project blockers are malformed." };
  if (!validateNextAction(value.recommendedNextAction)) return { ok: false, problem: "Project next action is malformed." };

  const project = structuredClone(value) as unknown as AuraProject;
  project.archivedAtISO = value.archivedAtISO === undefined ? null : value.archivedAtISO as string | null;
  project.design.document = core.document;
  return { ok: true, project };
}

export function canonicalAuraProjectJson(project: AuraProject): string {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`Cannot serialize Aura project: ${checked.problem}`);
  return JSON.stringify(canonicalValue(checked.project));
}

export function hashAuraProject(project: AuraProject): `0x${string}` {
  return keccak256(stringToHex(canonicalAuraProjectJson(project)));
}

export function withProjectDesign(project: AuraProject, document: BuilderDocument, now: Date): AuraProject {
  const checkedProject = validateAuraProject(project);
  if (!checkedProject.ok) throw new Error(`Cannot update this project: ${checkedProject.problem}`);
  const checkedDocument = validateBuilderDocument(document);
  if (!checkedDocument.ok) throw new Error(`Cannot save this design: ${checkedDocument.problem}`);
  const durable = JSON.parse(canonicalBuilderDocumentJson(checkedDocument.document)) as BuilderDocument;
  const documentHash = hashBuilderDocument(durable);
  const changed = documentHash !== checkedProject.project.design.documentHash;
  const stepStates = changed
    ? { ...checkedProject.project.stepStates, design: unconfirmedState("in-progress") }
    : checkedProject.project.stepStates;
  return {
    ...checkedProject.project,
    updatedAtISO: now.toISOString(),
    design: { document: durable, documentHash },
    stepStates,
    recommendedNextAction: changed ? nextActionFor(stepStates) : checkedProject.project.recommendedNextAction,
  };
}

export function withProjectStepState(
  project: AuraProject,
  stepId: JourneyStepId,
  status: JourneyStepStatus,
  now: Date,
  basisHash?: `0x${string}`,
): AuraProject {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`Cannot update this project: ${checked.problem}`);
  if (!JOURNEY_STEP_IDS.includes(stepId)) throw new Error("Project journey step is unsupported.");
  if (!STEP_STATUSES.has(status)) throw new Error("Project journey status is unsupported.");
  const state: ProjectStepState = status === "complete"
    ? {
        status,
        confirmedAtISO: now.toISOString(),
        basisHash: basisHash ?? stepBasisHash(checked.project, stepId),
      }
    : unconfirmedState(status);
  const stepStates = { ...checked.project.stepStates, [stepId]: state };
  return {
    ...checked.project,
    updatedAtISO: now.toISOString(),
    stepStates,
    recommendedNextAction: nextActionFor(stepStates),
  };
}

export function withProjectBudgetBasis(
  project: AuraProject,
  budget: ProjectBudget,
  now: Date,
): AuraProject {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`Cannot update this project: ${checked.problem}`);
  if (budget.designHash !== checked.project.design.documentHash) {
    throw new Error("The budget design does not match the current project design.");
  }
  if (hashProjectBudget(budget) !== budget.budgetHash) {
    throw new Error("The canonical budget hash does not match its planning basis.");
  }
  const reference = projectBudgetBasisReference(budget);
  const budgetBasis: PersistedProjectBudgetBasis = {
    ...reference,
    currency: "CAD",
    calculatedAtISO: now.toISOString(),
    assumptions: structuredClone(budget.assumptions),
    total: structuredClone(budget.total),
  };
  return {
    ...checked.project,
    updatedAtISO: now.toISOString(),
    budgetBasis,
  };
}

/** Build the budget that every project surface should use. An explicit
 * scenario supports an in-progress budget edit; otherwise the last saved
 * project basis wins, with defaults reserved for projects that have never
 * established a cost scenario. */
export function projectBudgetForProject(
  project: AuraProject,
  scenario?: ProjectBudgetScenario,
): ProjectBudget {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`Cannot budget this project: ${checked.problem}`);
  const current = checked.project;
  return createProjectBudget({
    document: current.design.document,
    scenario: scenario ?? current.budgetBasis?.scenario ?? defaultProjectBudgetScenario(),
    region: current.requirements.location.region,
    municipality: current.requirements.location.municipality,
    budgetCapCad: current.requirements.budgetCad.max,
  });
}

/** Persist one selected scenario as the project's canonical, dated cost
 * basis. Browser components call this inside `ProjectContext.update`, so the
 * same validated record survives reload and feeds dashboard, RFQ and quote
 * work. */
export function withProjectBudgetScenario(
  project: AuraProject,
  scenario: ProjectBudgetScenario,
  now: Date,
): AuraProject {
  return withProjectBudgetBasis(project, projectBudgetForProject(project, scenario), now);
}

export function projectJourney(project: AuraProject): {
  steps: Array<{ id: JourneyStepId; status: JourneyStepStatus; complete: boolean }>;
  next: { id: JourneyStepId; status: JourneyStepStatus; complete: boolean };
} {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`Cannot read this project journey: ${checked.problem}`);
  const steps = JOURNEY_STEP_IDS.map((id) => ({
    id,
    status: checked.project.stepStates[id].status,
    complete: checked.project.stepStates[id].status === "complete",
  }));
  const recommendedId = checked.project.recommendedNextAction?.stepId;
  const next = (recommendedId ? steps.find((step) => step.id === recommendedId) : null)
    ?? steps.find((step) => !step.complete)
    ?? steps[steps.length - 1];
  return { steps, next };
}

const PROJECT_JOURNEYS = new Set<ProjectJourney>([
  "find-land-build",
  "build-on-owned-land",
  "buy-finished-home",
]);
const PROJECT_PURPOSES = new Set<ProjectPurpose>(["primary-home", "eco-stay"]);
const STEP_STATUSES = new Set<JourneyStepStatus>(["not-started", "in-progress", "blocked", "complete"]);
const HEX_32 = /^0x[a-f0-9]{64}$/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validISO = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

function validateProjectCore(value: Record<string, unknown>):
  | { ok: true; document: BuilderDocument }
  | { ok: false; problem: string } {
  if (typeof value.id !== "string" || cleanId(value.id) !== value.id) return { ok: false, problem: "Project id is missing or invalid." };
  if (typeof value.name !== "string" || value.name.trim().length === 0) return { ok: false, problem: "Project name is missing." };
  if (!PROJECT_JOURNEYS.has(value.journey as ProjectJourney)) return { ok: false, problem: "Project journey is unsupported." };
  if (!validISO(value.createdAtISO) || !validISO(value.updatedAtISO)) return { ok: false, problem: "Project timestamps are invalid." };
  if (value.archivedAtISO !== undefined && value.archivedAtISO !== null && !validISO(value.archivedAtISO)) return { ok: false, problem: "Project archive timestamp is invalid." };
  const design = isObject(value.design) ? value.design : null;
  if (!design) return { ok: false, problem: "Project design is missing." };
  const checkedDocument = validateBuilderDocument(design.document);
  if (!checkedDocument.ok) return { ok: false, problem: `Project design is unreadable: ${checkedDocument.problem}` };
  const actualHash = hashBuilderDocument(checkedDocument.document);
  if (design.documentHash !== actualHash) return { ok: false, problem: `Project design hash mismatch: the embedded design resolves to ${actualHash}. Nothing was loaded.` };
  if (!validateRequirements(value.requirements)) return { ok: false, problem: "Project requirements are incomplete or malformed." };
  if (!validateDiscovery(value.discovery)) return { ok: false, problem: "Project discovery records are malformed." };
  if (!validateDelivery(value.delivery)) return { ok: false, problem: "Project delivery records are malformed." };
  if (!Array.isArray(value.milestones) || !Array.isArray(value.artifactManifests)) return { ok: false, problem: "Project milestones or artifact manifests are malformed." };
  return { ok: true, document: checkedDocument.document };
}

function migrateProjectV1(value: AuraProjectV1, document: BuilderDocument): AuraProject {
  const legacy = structuredClone(value);
  const stepStates = emptyStepStates();
  const setInProgress = (id: JourneyStepId, condition: boolean) => {
    if (condition) stepStates[id] = unconfirmedState("in-progress");
  };
  setInProgress("requirements", hasMeaningfulRequirements(legacy.requirements));
  setInProgress("design", legacy.design.documentHash !== hashBuilderDocument(defaultBuilderDocument()));
  setInProgress("land", hasNonDemonstrationSelection(legacy.discovery.land));
  const teamGroup = legacy.journey === "buy-finished-home" ? legacy.discovery.manufacturers : legacy.discovery.contractors;
  setInProgress("team", hasNonDemonstrationSelection(teamGroup));
  setInProgress("quotes", legacy.delivery.rfqs.length > 0 || legacy.delivery.quotes.length > 0);
  setInProgress("funding", legacy.delivery.orderSnapshotIds.length > 0);
  setInProgress("build", legacy.milestones.length > 0);
  setInProgress("operate", legacy.artifactManifests.length > 0);
  return {
    ...legacy,
    version: AURA_PROJECT_VERSION,
    archivedAtISO: legacy.archivedAtISO ?? null,
    purpose: "primary-home",
    design: { ...legacy.design, document },
    stepStates,
    budgetBasis: null,
    blockers: [],
    recommendedNextAction: nextActionFor(stepStates),
  };
}

function emptyStepStates(): Record<JourneyStepId, ProjectStepState> {
  return Object.fromEntries(JOURNEY_STEP_IDS.map((id) => [id, unconfirmedState("not-started")])) as Record<JourneyStepId, ProjectStepState>;
}

function unconfirmedState(status: Exclude<JourneyStepStatus, "complete">): ProjectStepState {
  return { status, confirmedAtISO: null, basisHash: null };
}

function nextActionFor(states: Record<JourneyStepId, ProjectStepState>): ProjectNextAction | null {
  const stepId = JOURNEY_STEP_IDS.find((id) => states[id].status !== "complete");
  return stepId ? { stepId, ...NEXT_ACTIONS[stepId] } : null;
}

function stepBasisHash(project: AuraProject, stepId: JourneyStepId): `0x${string}` {
  if (stepId === "design") return project.design.documentHash;
  const value = stepId === "requirements"
    ? project.requirements
    : stepId === "land"
      ? project.discovery.land
      : stepId === "team"
        ? project.journey === "buy-finished-home" ? project.discovery.manufacturers : project.discovery.contractors
        : stepId === "quotes"
          ? { budgetBasis: project.budgetBasis, rfqs: project.delivery.rfqs, quotes: project.delivery.quotes }
          : stepId === "funding"
            ? project.delivery.orderSnapshotIds
            : stepId === "build"
              ? project.milestones
              : project.artifactManifests;
  return keccak256(stringToHex(JSON.stringify(canonicalValue(value))));
}

function hasMeaningfulRequirements(value: AuraProject["requirements"]): boolean {
  return value.completedAtISO !== null
    || value.location.municipality.trim().length > 0
    || value.budgetCad.min !== null
    || value.budgetCad.max !== null
    || value.householdSize !== null
    || value.timeline.trim().length > 0
    || value.accessibility.length > 0
    || value.utilityGoals.length > 0
    || value.cryptoComfort !== "avoid";
}

function hasNonDemonstrationSelection(group: { shortlist: string[]; records?: unknown[] }): boolean {
  return group.shortlist.some((subjectId) => {
    const record = (group.records ?? []).find((candidate) => isObject(candidate) && candidate.subjectId === subjectId);
    if (!isObject(record)) return true;
    if (record.access === "demonstration") return false;
    return !(isObject(record.data) && record.data.demonstration === true);
  });
}

function validateStepStates(value: unknown): value is AuraProject["stepStates"] {
  if (!isObject(value)) return false;
  return JOURNEY_STEP_IDS.every((id) => {
    const state = value[id];
    if (!isObject(state) || !STEP_STATUSES.has(state.status as JourneyStepStatus)) return false;
    if (state.status === "complete") return validISO(state.confirmedAtISO) && typeof state.basisHash === "string" && HEX_32.test(state.basisHash);
    return state.confirmedAtISO === null && state.basisHash === null;
  });
}

function validateBudgetBasis(value: unknown): value is PersistedProjectBudgetBasis | null {
  if (value === null) return true;
  if (!isObject(value) || value.currency !== "CAD" || !validISO(value.calculatedAtISO)) return false;
  if (typeof value.designHash !== "string" || !HEX_32.test(value.designHash) || typeof value.budgetHash !== "string" || !HEX_32.test(value.budgetHash)) return false;
  if (typeof value.region !== "string" || typeof value.municipality !== "string" || !validateBudgetScenario(value.scenario)) return false;
  if (value.budgetCapCad !== null && !(typeof value.budgetCapCad === "number" && Number.isFinite(value.budgetCapCad) && value.budgetCapCad >= 0)) return false;
  if (!Array.isArray(value.assumptions) || !value.assumptions.every((item) => typeof item === "string")) return false;
  return isBudgetRange(value.total);
}

function validateBudgetScenario(value: unknown): value is ProjectBudgetScenario {
  return isObject(value)
    && ["unknown", "serviced-flat", "rural-flat", "sloped", "remote"].includes(String(value.site))
    && ["serviced", "hybrid", "off-grid"].includes(String(value.utilities))
    && ["essential", "standard", "elevated"].includes(String(value.finish))
    && ["owner-builder", "hybrid", "full-service"].includes(String(value.delivery))
    && typeof value.shippingDistanceKm === "number" && Number.isFinite(value.shippingDistanceKm) && value.shippingDistanceKm >= 0
    && typeof value.contingencyPct === "number" && Number.isFinite(value.contingencyPct) && value.contingencyPct >= 0
    /* Absent on scenarios saved before Aug 14, 2026 — createProjectBudget
       defaults it to included (the recommended state), never a silent descope. */
    && (value.awgIncluded === undefined || typeof value.awgIncluded === "boolean");
}

function isBudgetRange(value: unknown): value is BudgetRange {
  return isObject(value) && [value.low, value.mid, value.high].every((amount) => typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
}

function validateBlockers(value: unknown): value is ProjectBlocker[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((blocker) => {
    if (!isObject(blocker) || typeof blocker.id !== "string" || !blocker.id || ids.has(blocker.id)) return false;
    ids.add(blocker.id);
    return JOURNEY_STEP_IDS.includes(blocker.stepId as JourneyStepId)
      && typeof blocker.summary === "string" && blocker.summary.trim().length > 0
      && typeof blocker.detail === "string"
      && ["user", "system"].includes(String(blocker.source))
      && validISO(blocker.createdAtISO)
      && (blocker.resolvedAtISO === null || validISO(blocker.resolvedAtISO));
  });
}

function validateNextAction(value: unknown): value is ProjectNextAction | null {
  return value === null || (isObject(value)
    && JOURNEY_STEP_IDS.includes(value.stepId as JourneyStepId)
    && typeof value.label === "string" && value.label.trim().length > 0
    && typeof value.reason === "string" && value.reason.trim().length > 0);
}

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
  if (value.location.country !== "Canada" || typeof value.location.region !== "string" || typeof value.location.municipality !== "string") return false;
  const optionalMoney = (amount: unknown) => amount === null || (typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
  if (!optionalMoney(value.budgetCad.min) || !optionalMoney(value.budgetCad.max)) return false;
  if (value.householdSize !== null && !(typeof value.householdSize === "number" && Number.isInteger(value.householdSize) && value.householdSize > 0)) return false;
  if (!["searching", "owned", "included-with-home"].includes(String(value.landStatus))) return false;
  if (!["site-built", "manufactured", "compare"].includes(String(value.deliveryPreference))) return false;
  if (!["avoid", "guided", "experienced"].includes(String(value.cryptoComfort))) return false;
  return typeof value.timeline === "string"
    && Array.isArray(value.accessibility) && value.accessibility.every((item) => typeof item === "string")
    && Array.isArray(value.utilityGoals) && value.utilityGoals.every((item) => typeof item === "string")
    && (value.completedAtISO === null || validISO(value.completedAtISO));
}

function validateDiscovery(value: unknown): value is AuraProject["discovery"] {
  if (!isObject(value)) return false;
  return [value.land, value.contractors, value.manufacturers].every((group) => isObject(group)
    && Array.isArray(group.shortlist)
    && group.shortlist.every((id) => typeof id === "string")
    && (group.records === undefined || Array.isArray(group.records)));
}

function validateDelivery(value: unknown): value is AuraProject["delivery"] {
  return isObject(value)
    && Array.isArray(value.rfqs)
    && Array.isArray(value.quotes)
    && Array.isArray(value.orderSnapshotIds)
    && value.orderSnapshotIds.every((id) => typeof id === "string");
}
