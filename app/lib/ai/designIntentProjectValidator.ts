import { keccak256, stringToHex, type Hex } from "viem";

import {
  DESIGN_INTENT_FIELDS,
  DESIGN_INTENT_VERSION,
  parseDesignIntent,
  type DesignIntent,
} from "./designIntent";
import {
  COMPILED_DESIGN_INTENT_PROJECT_VERSION,
  DESIGN_INTENT_COMPILER_VERSION,
  compileDesignIntentToProject,
  type CompiledDesignIntentProject,
  type DesignIntentCompilerDecision,
} from "./designIntentCompiler";
import type { ImageRetention, ImageRights } from "./imageIntake";
import {
  validateBuildingGraph,
  type BuildingGraph,
  type GraphRoomFace,
  type GraphStorey,
} from "../builder/buildingGraph";
import {
  BUILDER_DOCUMENT_FORMAT,
  BUILDER_DOCUMENT_VERSION,
  canonicalBuilderDocumentJson,
  hashBuilderDocument,
  validateBuilderDocument,
} from "../builder/document";

export const DESIGN_INTENT_PROJECT_VALIDATOR_VERSION =
  "aura-design-intent-project-validator/v1" as const;
export const DESIGN_INTENT_PROJECT_VALIDATION_VERSION = 1 as const;

export type DesignIntentProjectValidationGate =
  | "boundary"
  | "intent"
  | "integrity"
  | "document"
  | "graph"
  | "program"
  | "openings"
  | "climate"
  | "rights"
  | "span";

export type DesignIntentProjectValidationOutcome = "pass" | "review-required";

export type DesignIntentProjectValidationErrorCode =
  | "invalid-boundary"
  | "invalid-intent"
  | "integrity-failed"
  | "document-invalid"
  | "document-not-canonical"
  | "graph-required"
  | "graph-invalid"
  | "program-mismatch"
  | "opening-mismatch"
  | "climate-mismatch"
  | "rights-missing"
  | "rights-invalid"
  | "span-invalid";

export interface DesignIntentImageSourceApproval {
  sourceFingerprint: string;
  consentToAnalyze: true;
  rights: ImageRights;
  retention: ImageRetention;
  rawImageDisposition:
    | "delete when the analysis task finishes or fails"
    | "retain only with this project until the person deletes it";
}

export interface DesignIntentProjectValidationInput {
  intent: unknown;
  project: unknown;
  sourceApprovals: unknown;
}

export interface DesignIntentProjectValidationCheck {
  gate: DesignIntentProjectValidationGate;
  outcome: DesignIntentProjectValidationOutcome;
  message: string;
}

export interface ValidatedDesignIntentProject {
  format: "aura-design-intent-project-validation";
  version: typeof DESIGN_INTENT_PROJECT_VALIDATION_VERSION;
  validatorVersion: typeof DESIGN_INTENT_PROJECT_VALIDATOR_VERSION;
  status: "concept-preview-valid";
  intent: DesignIntent;
  project: CompiledDesignIntentProject;
  sourceFingerprints: string[];
  largestClearSpanFt: number;
  conceptOnlyNotice: string;
  checks: DesignIntentProjectValidationCheck[];
}

export interface DesignIntentProjectValidationError {
  gate: DesignIntentProjectValidationGate;
  code: DesignIntentProjectValidationErrorCode;
  problem: string;
}

export type DesignIntentProjectValidationResult =
  | { ok: true; validation: ValidatedDesignIntentProject }
  | { ok: false; error: DesignIntentProjectValidationError };

const PUBLIC_PROBLEMS: Readonly<Record<DesignIntentProjectValidationErrorCode, string>> =
  Object.freeze({
    "invalid-boundary": "The validation input must contain only plain bounded data.",
    "invalid-intent": "The design intent does not pass the strict IP02 contract.",
    "integrity-failed": "The compiled project does not match its canonical IP04 evidence.",
    "document-invalid": "The compiled builder document is invalid.",
    "document-not-canonical": "The compiled builder document would change during validation.",
    "graph-required": "The compiled proposal must contain editable building-graph geometry.",
    "graph-invalid": "The editable building graph is invalid.",
    "program-mismatch": "The editable room program does not match the stated design intent.",
    "opening-mismatch": "The editable openings do not match the stated design intent.",
    "climate-mismatch": "The project climate baseline does not match the stated design intent.",
    "rights-missing": "An uploaded image is missing source-bound consent and rights evidence.",
    "rights-invalid": "The image source approval evidence is invalid or does not belong here.",
    "span-invalid": "The editable room spans could not be derived safely.",
  });

class ValidationRefusal extends Error {
  readonly gate: DesignIntentProjectValidationGate;
  readonly code: DesignIntentProjectValidationErrorCode;

  constructor(
    gate: DesignIntentProjectValidationGate,
    code: DesignIntentProjectValidationErrorCode,
  ) {
    super(PUBLIC_PROBLEMS[code]);
    this.gate = gate;
    this.code = code;
  }
}

const refuse = (
  gate: DesignIntentProjectValidationGate,
  code: DesignIntentProjectValidationErrorCode,
): never => {
  throw new ValidationRefusal(gate, code);
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
};

const failed = (
  gate: DesignIntentProjectValidationGate,
  code: DesignIntentProjectValidationErrorCode,
): DesignIntentProjectValidationResult => deepFreeze({
  ok: false as const,
  error: { gate, code, problem: PUBLIC_PROBLEMS[code] },
});

interface SnapshotState {
  seen: WeakSet<object>;
  nodes: number;
}

const MAX_DEPTH = 48;
const MAX_NODES = 25_000;
const MAX_ARRAY_ITEMS = 8_192;
const MAX_RECORD_KEYS = 1_024;
const MAX_STRING_LENGTH = 65_536;

function snapshotData(value: unknown, state: SnapshotState, depth = 0): unknown {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || depth > MAX_DEPTH) return refuse("boundary", "invalid-boundary");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return refuse("boundary", "invalid-boundary");
    return value;
  }
  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) return refuse("boundary", "invalid-boundary");
    return value;
  }
  if (typeof value !== "object") return refuse("boundary", "invalid-boundary");

  let prototype: object | null;
  let ownKeys: Array<string | symbol>;
  try {
    if (state.seen.has(value)) return refuse("boundary", "invalid-boundary");
    state.seen.add(value);
    prototype = Object.getPrototypeOf(value);
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return refuse("boundary", "invalid-boundary");
  }

  if (Array.isArray(value)) {
    if (prototype !== Array.prototype || value.length > MAX_ARRAY_ITEMS) {
      return refuse("boundary", "invalid-boundary");
    }
    if (ownKeys.some((key) => typeof key !== "string" || (key !== "length" && !/^(0|[1-9]\d*)$/.test(key)))) {
      return refuse("boundary", "invalid-boundary");
    }
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        return refuse("boundary", "invalid-boundary");
      }
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        return refuse("boundary", "invalid-boundary");
      }
      output.push(snapshotData(descriptor.value, state, depth + 1));
    }
    if (ownKeys.length !== value.length + 1) return refuse("boundary", "invalid-boundary");
    return output;
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return refuse("boundary", "invalid-boundary");
  }
  if (ownKeys.length > MAX_RECORD_KEYS || ownKeys.some((key) => typeof key !== "string")) {
    return refuse("boundary", "invalid-boundary");
  }
  const output: Record<string, unknown> = {};
  for (const key of ownKeys as string[]) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return refuse("boundary", "invalid-boundary");
    }
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      return refuse("boundary", "invalid-boundary");
    }
    output[key] = snapshotData(descriptor.value, state, depth + 1);
  }
  return output;
}

const snapshotBoundary = (value: unknown): unknown =>
  snapshotData(value, { seen: new WeakSet<object>(), nodes: 0 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactRecord = <K extends string>(
  value: unknown,
  keys: readonly K[],
  gate: DesignIntentProjectValidationGate,
  code: DesignIntentProjectValidationErrorCode,
): Record<K, unknown> => {
  if (!isRecord(value)) return refuse(gate, code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) return refuse(gate, code);
  return value as Record<K, unknown>;
};

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalValue(value[key]);
  return output;
};

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalValue(value));
const canonicalHash = (value: unknown): Hex => keccak256(stringToHex(canonicalJson(value)));

const isHash = (value: unknown): value is Hex =>
  typeof value === "string" && /^0x[a-f0-9]{64}$/.test(value);

const isFingerprint = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);

const PROJECT_KEYS = [
  "format",
  "version",
  "compilerVersion",
  "intentVersion",
  "intentHash",
  "document",
  "documentHash",
  "sourceFingerprints",
  "decisions",
  "unresolved",
  "projectHash",
] as const;

const DECISION_KEYS = ["code", "field", "statement"] as const;
const UNRESOLVED_KEYS = ["id", "field", "question"] as const;
const APPROVAL_KEYS = [
  "sourceFingerprint",
  "consentToAnalyze",
  "rights",
  "retention",
  "rawImageDisposition",
] as const;

const RIGHTS = new Set<ImageRights>([
  "i-own-this-image",
  "i-have-permission",
  "reference-only-inspiration",
]);

function parseProject(value: unknown): CompiledDesignIntentProject {
  const project = exactRecord(value, PROJECT_KEYS, "integrity", "integrity-failed");
  if (
    project.format !== "aura-compiled-design-intent-project" ||
    project.version !== COMPILED_DESIGN_INTENT_PROJECT_VERSION ||
    project.compilerVersion !== DESIGN_INTENT_COMPILER_VERSION ||
    project.intentVersion !== DESIGN_INTENT_VERSION ||
    !isHash(project.intentHash) ||
    !isHash(project.documentHash) ||
    !isHash(project.projectHash)
  ) {
    return refuse("integrity", "integrity-failed");
  }
  if (
    !Array.isArray(project.sourceFingerprints) ||
    project.sourceFingerprints.some((item) => !isFingerprint(item)) ||
    new Set(project.sourceFingerprints).size !== project.sourceFingerprints.length ||
    JSON.stringify([...project.sourceFingerprints].sort()) !== JSON.stringify(project.sourceFingerprints)
  ) {
    return refuse("integrity", "integrity-failed");
  }
  if (!Array.isArray(project.decisions) || !Array.isArray(project.unresolved)) {
    return refuse("integrity", "integrity-failed");
  }
  for (const value of project.decisions) {
    const decision = exactRecord(value, DECISION_KEYS, "integrity", "integrity-failed");
    if (
      typeof decision.code !== "string" ||
      decision.code.length === 0 ||
      !DESIGN_INTENT_FIELDS.includes(decision.field as (typeof DESIGN_INTENT_FIELDS)[number]) ||
      typeof decision.statement !== "string" ||
      decision.statement.length === 0
    ) {
      return refuse("integrity", "integrity-failed");
    }
  }
  for (const value of project.unresolved) {
    const unresolved = exactRecord(value, UNRESOLVED_KEYS, "integrity", "integrity-failed");
    if (
      typeof unresolved.id !== "string" ||
      unresolved.id.length === 0 ||
      !DESIGN_INTENT_FIELDS.includes(unresolved.field as (typeof DESIGN_INTENT_FIELDS)[number]) ||
      typeof unresolved.question !== "string" ||
      unresolved.question.length === 0
    ) {
      return refuse("integrity", "integrity-failed");
    }
  }
  return project as unknown as CompiledDesignIntentProject;
}

function validateIntegrityBeforeDocument(
  intent: DesignIntent,
  project: CompiledDesignIntentProject,
): void {
  if (project.intentHash !== canonicalHash(intent)) return refuse("integrity", "integrity-failed");
  const expectedFingerprints = Array.from(new Set(intent.sources.map((source) => source.fingerprint))).sort();
  if (canonicalJson(project.sourceFingerprints) !== canonicalJson(expectedFingerprints)) {
    return refuse("integrity", "integrity-failed");
  }
  if (canonicalJson(project.unresolved) !== canonicalJson(intent.unresolved)) {
    return refuse("integrity", "integrity-failed");
  }
}

function validateDocumentAndGraph(project: CompiledDesignIntentProject): BuildingGraph {
  if (!isRecord(project.document)) return refuse("document", "document-invalid");
  if (
    project.document.format !== BUILDER_DOCUMENT_FORMAT ||
    project.document.version !== BUILDER_DOCUMENT_VERSION
  ) {
    return refuse("document", "document-invalid");
  }
  if (!isRecord(project.document.geometry) || project.document.geometry.kind !== "building-graph") {
    return refuse("document", "graph-required");
  }
  const rawGraph = project.document.geometry.graph as BuildingGraph;
  let checkedGraph;
  try {
    checkedGraph = validateBuildingGraph(rawGraph);
  } catch {
    return refuse("graph", "graph-invalid");
  }
  if (!checkedGraph.ok) return refuse("graph", "graph-invalid");

  let checkedDocument;
  try {
    checkedDocument = validateBuilderDocument(project.document);
  } catch {
    return refuse("document", "document-invalid");
  }
  if (!checkedDocument.ok || checkedDocument.migratedFrom !== null) {
    return refuse("document", "document-invalid");
  }
  if (
    checkedDocument.document.geometry.kind !== "building-graph" ||
    checkedDocument.document.geometry.migrationWarnings.length !== 0 ||
    checkedDocument.document.quarantine.entries.length !== 0
  ) {
    return refuse("document", "document-not-canonical");
  }
  let canonicalDocument: string;
  try {
    canonicalDocument = canonicalBuilderDocumentJson(checkedDocument.document);
  } catch {
    return refuse("document", "document-invalid");
  }
  if (canonicalJson(project.document) !== canonicalDocument) {
    return refuse("document", "document-not-canonical");
  }
  return checkedGraph.graph;
}

function validateHashes(project: CompiledDesignIntentProject): void {
  let documentHash: Hex;
  try {
    documentHash = hashBuilderDocument(project.document);
  } catch {
    return refuse("document", "document-invalid");
  }
  if (project.documentHash !== documentHash) return refuse("integrity", "integrity-failed");
  const basis = {
    format: project.format,
    version: project.version,
    compilerVersion: project.compilerVersion,
    intentVersion: project.intentVersion,
    intentHash: project.intentHash,
    documentHash: project.documentHash,
    sourceFingerprints: project.sourceFingerprints,
    decisions: project.decisions,
    unresolved: project.unresolved,
  };
  if (project.projectHash !== canonicalHash(basis)) return refuse("integrity", "integrity-failed");
}

const title = (value: string): string =>
  value.split("-").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" ");

interface ExpectedRoom {
  name: string;
  minimumAreaSqFt: number;
}

const M2_TO_SQFT = 10.763910416709722;

function expectedRooms(intent: DesignIntent, storeys: number): ExpectedRoom[][] {
  const requested: ExpectedRoom[] = [];
  for (const room of intent.rooms) {
    const base = room.label ?? title(room.use);
    for (let index = 0; index < room.count; index += 1) {
      requested.push({
        name: room.count === 1 ? base : `${base} ${index + 1}`,
        minimumAreaSqFt: (room.minimumAreaM2 ?? 0) * M2_TO_SQFT,
      });
    }
  }
  if (requested.length === 0) requested.push({ name: "Open plan", minimumAreaSqFt: 0 });

  const byStorey = Array.from({ length: storeys }, (): ExpectedRoom[] => []);
  requested.forEach((room, index) => byStorey[index % storeys].push(room));
  byStorey.forEach((rooms, index) => {
    if (rooms.length === 0) {
      rooms.push({ name: index === 0 ? "Open plan" : "Upper open plan", minimumAreaSqFt: 0 });
    }
  });
  return byStorey;
}

function exactCompilerProject(intent: DesignIntent): CompiledDesignIntentProject | null {
  const compiled = compileDesignIntentToProject(intent);
  if (!compiled.ok) {
    if (compiled.error.code === "program-does-not-fit" ||
        compiled.error.code === "openings-do-not-fit") {
      return null;
    }
    return refuse("integrity", "integrity-failed");
  }
  return compiled.project;
}

function requireExactDecision(
  project: CompiledDesignIntentProject,
  expectedProject: CompiledDesignIntentProject | null,
  code: string,
  gate: DesignIntentProjectValidationGate,
  errorCode: DesignIntentProjectValidationErrorCode,
): void {
  if (expectedProject === null) return;
  const actual = project.decisions.filter((decision) => decision.code === code);
  const expected = expectedProject.decisions.filter((decision) => decision.code === code);
  if (canonicalJson(actual) !== canonicalJson(expected)) return refuse(gate, errorCode);
}

function validateProgram(
  intent: DesignIntent,
  project: CompiledDesignIntentProject,
  graph: BuildingGraph,
  expectedProject: CompiledDesignIntentProject | null,
): void {
  const expectedStoreys = intent.storeys.count ?? 1;
  requireExactDecision(project, expectedProject, "default-storeys", "program", "program-mismatch");
  requireExactDecision(project, expectedProject, "default-room", "program", "program-mismatch");
  if (graph.storeys.length !== expectedStoreys) return refuse("program", "program-mismatch");
  const expectedByStorey = expectedRooms(intent, expectedStoreys);
  for (let storeyIndex = 0; storeyIndex < expectedByStorey.length; storeyIndex += 1) {
    const expected = expectedByStorey[storeyIndex];
    const actual = graph.storeys[storeyIndex]?.rooms ?? [];
    if (actual.length !== expected.length) return refuse("program", "program-mismatch");
    const remaining = [...actual];
    for (const room of expected) {
      const index = remaining.findIndex((candidate) =>
        candidate.name === room.name && candidate.areaSqft >= room.minimumAreaSqFt);
      if (index < 0) return refuse("program", "program-mismatch");
      remaining.splice(index, 1);
    }
    if (remaining.length !== 0) return refuse("program", "program-mismatch");
  }
}

function expectedOpeningCounts(
  intent: DesignIntent,
  project: CompiledDesignIntentProject,
  expectedProject: CompiledDesignIntentProject | null,
) {
  requireExactDecision(project, expectedProject, "default-door-count", "openings", "opening-mismatch");
  requireExactDecision(project, expectedProject, "default-window-count", "openings", "opening-mismatch");
  requireExactDecision(project, expectedProject, "default-opening-orientation", "openings", "opening-mismatch");
  const doors = intent.openings.exteriorDoorCount ?? 1;
  const defaultWindows = intent.openings.glazingLevel === "minimal"
    ? 2
    : intent.openings.glazingLevel === "generous"
      ? 8
      : 4;
  const windows = intent.openings.windowCount ?? defaultWindows;
  return { doors, windows };
}

function validateOpenings(
  intent: DesignIntent,
  project: CompiledDesignIntentProject,
  graph: BuildingGraph,
  expectedProject: CompiledDesignIntentProject | null,
): void {
  const expected = expectedOpeningCounts(intent, project, expectedProject);
  const openings = graph.storeys.flatMap((storey) =>
    storey.walls.flatMap((wall) => wall.openings.map((opening) => ({ opening, storey }))));
  const doors = openings.filter(({ opening }) => opening.kind === "door").length;
  const windows = openings.filter(({ opening }) => opening.kind === "window").length;
  if (doors !== expected.doors || windows !== expected.windows) {
    return refuse("openings", "opening-mismatch");
  }
  for (const { opening, storey } of openings) {
    if (opening.sillFt + opening.heightFt > storey.heightFt + 1e-8) {
      return refuse("openings", "opening-mismatch");
    }
  }
}

function expectedClimate(intent: DesignIntent): "4" | "5" | "7A" {
  if (
    intent.climate.country === "CR" ||
    intent.climate.profile === "tropical-humid" ||
    intent.climate.profile === "tropical-dry"
  ) return "4";
  if (intent.climate.profile === "marine") return "5";
  return "7A";
}

function validateClimate(
  intent: DesignIntent,
  project: CompiledDesignIntentProject,
  expectedProject: CompiledDesignIntentProject | null,
): void {
  const expected = expectedClimate(intent);
  requireExactDecision(project, expectedProject, "selected-climate", "climate", "climate-mismatch");
  requireExactDecision(project, expectedProject, "default-climate", "climate", "climate-mismatch");
  if (project.document.spec.climateZone !== expected) return refuse("climate", "climate-mismatch");
}

function parseApprovals(value: unknown): DesignIntentImageSourceApproval[] {
  if (!Array.isArray(value)) return refuse("rights", "rights-invalid");
  const approvals: DesignIntentImageSourceApproval[] = [];
  for (const item of value) {
    const approval = exactRecord(item, APPROVAL_KEYS, "rights", "rights-invalid");
    const fingerprint = approval.sourceFingerprint;
    const rights = approval.rights;
    const retention = approval.retention;
    if (
      !isFingerprint(fingerprint) ||
      approval.consentToAnalyze !== true ||
      !RIGHTS.has(rights as ImageRights) ||
      (retention !== "delete-after-analysis" && retention !== "retain-with-project")
    ) {
      return refuse("rights", "rights-invalid");
    }
    const disposition = retention === "delete-after-analysis"
      ? "delete when the analysis task finishes or fails"
      : "retain only with this project until the person deletes it";
    if (approval.rawImageDisposition !== disposition) return refuse("rights", "rights-invalid");
    approvals.push({
      sourceFingerprint: fingerprint,
      consentToAnalyze: true,
      rights: rights as ImageRights,
      retention,
      rawImageDisposition: disposition,
    });
  }
  return approvals;
}

function validateRights(intent: DesignIntent, approvalsValue: unknown): void {
  const approvals = parseApprovals(approvalsValue);
  const expected = Array.from(new Set(
    intent.sources
      .filter((source) => source.kind === "uploaded-image")
      .map((source) => source.fingerprint),
  )).sort();
  for (const fingerprint of expected) {
    if (!approvals.some((approval) => approval.sourceFingerprint === fingerprint)) {
      return refuse("rights", "rights-missing");
    }
  }
  const counts = new Map<string, number>();
  approvals.forEach((approval) => {
    counts.set(approval.sourceFingerprint, (counts.get(approval.sourceFingerprint) ?? 0) + 1);
  });
  if (
    approvals.length !== expected.length ||
    approvals.some((approval) => !expected.includes(approval.sourceFingerprint)) ||
    Array.from(counts.values()).some((count) => count !== 1)
  ) {
    return refuse("rights", "rights-invalid");
  }
}

function roomClearSpan(storey: GraphStorey, room: GraphRoomFace): number {
  const vertices = new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));
  const walls = new Map(storey.walls.map((wall) => [wall.id, wall]));
  const points: Array<{ xFt: number; zFt: number }> = [];
  for (const edge of room.boundary) {
    const wall = walls.get(edge.wallId);
    if (!wall) return refuse("span", "span-invalid");
    const start = vertices.get(wall.startVertexId);
    const end = vertices.get(wall.endVertexId);
    if (!start || !end) return refuse("span", "span-invalid");
    points.push(start, end);
  }
  const xs = points.map((point) => point.xFt);
  const zs = points.map((point) => point.zFt);
  const span = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  if (!Number.isFinite(span) || span <= 0) return refuse("span", "span-invalid");
  return span;
}

function largestClearSpan(graph: BuildingGraph): number {
  const spans = graph.storeys.flatMap((storey) =>
    storey.rooms.map((room) => roomClearSpan(storey, room)));
  if (spans.length === 0) return refuse("span", "span-invalid");
  return Math.round(Math.max(...spans) * 1000) / 1000;
}

const check = (
  gate: DesignIntentProjectValidationGate,
  outcome: DesignIntentProjectValidationOutcome,
  message: string,
): DesignIntentProjectValidationCheck => ({ gate, outcome, message });

function validateSnapshot(value: unknown): DesignIntentProjectValidationResult {
  const root = exactRecord(
    value,
    ["intent", "project", "sourceApprovals"] as const,
    "boundary",
    "invalid-boundary",
  );
  let intent: DesignIntent;
  try {
    intent = parseDesignIntent(root.intent);
  } catch {
    return failed("intent", "invalid-intent");
  }
  const project = parseProject(root.project);
  const expectedProject = exactCompilerProject(intent);
  validateIntegrityBeforeDocument(intent, project);
  const graph = validateDocumentAndGraph(project);
  validateHashes(project);
  validateProgram(intent, project, graph, expectedProject);
  validateOpenings(intent, project, graph, expectedProject);
  validateClimate(intent, project, expectedProject);
  if (expectedProject !== null && canonicalJson(project.decisions) !== canonicalJson(expectedProject.decisions)) {
    return refuse("integrity", "integrity-failed");
  }
  validateRights(intent, root.sourceApprovals);
  const largestClearSpanFt = largestClearSpan(graph);
  const conceptOnlyNotice =
    "This proposal is valid for concept preview only. Every derived span still requires professional structural review before code, permit, engineering, procurement, or construction use.";
  const checks: DesignIntentProjectValidationCheck[] = [
    check("boundary", "pass", "The validation request contains only detached bounded data."),
    check("intent", "pass", "The design intent passed the strict IP02 contract."),
    check("integrity", "pass", "The IP04 intent, document, source, and project hashes match."),
    check("document", "pass", "The canonical v2 builder document passes without migration or repair."),
    check("graph", "pass", "The editable building graph passes its topology validator."),
    check("program", "pass", "Storeys, requested rooms, and minimum areas match the intent."),
    check("openings", "pass", "Opening counts and vertical fit match the intent."),
    check("climate", "pass", "The concept climate baseline matches the compiler rule."),
    check("rights", "pass", "Uploaded-image sources have exact source-bound approval evidence."),
    check("span", "review-required", conceptOnlyNotice),
  ];
  return deepFreeze({
    ok: true as const,
    validation: {
      format: "aura-design-intent-project-validation" as const,
      version: DESIGN_INTENT_PROJECT_VALIDATION_VERSION,
      validatorVersion: DESIGN_INTENT_PROJECT_VALIDATOR_VERSION,
      status: "concept-preview-valid" as const,
      intent,
      project,
      sourceFingerprints: [...project.sourceFingerprints],
      largestClearSpanFt,
      conceptOnlyNotice,
      checks,
    },
  });
}

export function validateDesignIntentProject(value: unknown): DesignIntentProjectValidationResult {
  let snapshot: unknown;
  try {
    snapshot = snapshotBoundary(value);
  } catch {
    return failed("boundary", "invalid-boundary");
  }
  try {
    return validateSnapshot(snapshot);
  } catch (error) {
    if (error instanceof ValidationRefusal) return failed(error.gate, error.code);
    return failed("boundary", "invalid-boundary");
  }
}
