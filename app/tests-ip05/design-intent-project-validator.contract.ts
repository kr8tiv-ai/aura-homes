import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "playwright/test";
import { keccak256, stringToHex } from "viem";

import { DESIGN_INTENT_FIELDS, DESIGN_INTENT_VERSION } from "@/lib/ai/designIntent";
import {
  COMPILED_DESIGN_INTENT_PROJECT_VERSION,
  DESIGN_INTENT_COMPILER_VERSION,
  compileDesignIntentToProject,
  type CompiledDesignIntentProject,
} from "@/lib/ai/designIntentCompiler";
import {
  DESIGN_INTENT_PROJECT_VALIDATOR_VERSION,
  validateDesignIntentProject,
} from "@/lib/ai/designIntentProjectValidator";
import { hashBuilderDocument } from "@/lib/builder/document";

const sourceFingerprint = `sha256:${"a".repeat(64)}`;

const completeIntent = (): Record<string, unknown> => ({
  version: DESIGN_INTENT_VERSION,
  requestedUse: { category: "cabin", occupancy: "year-round", details: null },
  approximateFootprint: { unit: "m2", targetM2: 72, minimumM2: 60, maximumM2: 84 },
  storeys: { count: 1, splitLevel: false },
  rooms: [
    { id: "living", use: "living", label: null, count: 1, minimumAreaM2: 22 },
    { id: "bedroom", use: "bedroom", label: null, count: 2, minimumAreaM2: 9 },
  ],
  roof: { forms: ["gable"], preferredPitchDegrees: 35 },
  openings: {
    glazingLevel: "generous",
    windowCount: 9,
    exteriorDoorCount: 2,
    orientationPriorities: ["south", "west"],
  },
  materials: {
    preferences: ["timber", "glass", "metal-roof"],
    notes: "Warm timber interior with a durable exterior.",
  },
  climate: { country: "CA", region: "Alberta", profile: "cold-continental" },
  siting: {
    orientationPreference: "south",
    slope: "gentle",
    access: "road",
    viewPriorities: ["west"],
  },
  assumptions: [{
    id: "assumption-view",
    field: "siting",
    statement: "The photographed view is assumed to face west until the owner confirms it.",
    sourceIds: ["image-1"],
  }],
  unresolved: [
    { id: "unresolved-site", field: "siting", question: "What is the surveyed site orientation?" },
  ],
  confidence: DESIGN_INTENT_FIELDS.map((field) => ({
    field,
    level: field === "siting" ? "weak-inference" : "explicit",
    sourceIds: ["image-1"],
  })),
  sources: [{
    id: "image-1",
    kind: "uploaded-image",
    fingerprint: sourceFingerprint,
    label: "Owner-provided cabin reference",
  }],
});

const approval = (fingerprint = sourceFingerprint) => ({
  sourceFingerprint: fingerprint,
  consentToAnalyze: true,
  rights: "i-own-this-image",
  retention: "delete-after-analysis",
  rawImageDisposition: "delete when the analysis task finishes or fails",
});

const compile = (intent: unknown): CompiledDesignIntentProject => {
  const result = compileDesignIntentToProject(intent);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.problem}`);
  return result.project;
};

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = canonicalValue((value as Record<string, unknown>)[key]);
  }
  return output;
};

const canonicalHash = (value: unknown) =>
  keccak256(stringToHex(JSON.stringify(canonicalValue(value))));

const rehash = (
  intent: Record<string, unknown>,
  project: CompiledDesignIntentProject,
): CompiledDesignIntentProject => {
  const mutable = project as CompiledDesignIntentProject & Record<string, unknown>;
  mutable.intentHash = canonicalHash(intent);
  mutable.documentHash = hashBuilderDocument(mutable.document);
  const basis = {
    format: "aura-compiled-design-intent-project" as const,
    version: COMPILED_DESIGN_INTENT_PROJECT_VERSION,
    compilerVersion: DESIGN_INTENT_COMPILER_VERSION,
    intentVersion: DESIGN_INTENT_VERSION,
    intentHash: mutable.intentHash,
    documentHash: mutable.documentHash,
    sourceFingerprints: mutable.sourceFingerprints,
    decisions: mutable.decisions,
    unresolved: mutable.unresolved,
  };
  mutable.projectHash = canonicalHash(basis);
  return mutable;
};

const fixture = () => {
  const intent = completeIntent();
  const project = structuredClone(compile(intent));
  return {
    intent,
    project,
    sourceApprovals: [approval()],
  };
};

const validation = () => {
  const result = validateDesignIntentProject(fixture());
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`${result.error.gate}/${result.error.code}: ${result.error.problem}`);
  return result.validation;
};

const graphOf = (project: CompiledDesignIntentProject) => {
  const geometry = project.document.geometry;
  expect(geometry.kind).toBe("building-graph");
  if (geometry.kind !== "building-graph") throw new Error("Expected building-graph geometry.");
  return geometry.graph;
};

test("a valid proposal produces one detached immutable concept-preview receipt with a review-required span gate", () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = validateDesignIntentProject(input);
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(DESIGN_INTENT_PROJECT_VALIDATOR_VERSION).toBe("aura-design-intent-project-validator/v1");
  expect(result.validation.status).toBe("concept-preview-valid");
  expect(result.validation.project.projectHash).toBe(input.project.projectHash);
  expect(result.validation.sourceFingerprints).toEqual([sourceFingerprint]);
  expect(result.validation.checks.map((check) => [check.gate, check.outcome])).toEqual([
    ["boundary", "pass"],
    ["intent", "pass"],
    ["integrity", "pass"],
    ["document", "pass"],
    ["graph", "pass"],
    ["program", "pass"],
    ["openings", "pass"],
    ["climate", "pass"],
    ["rights", "pass"],
    ["span", "review-required"],
  ]);
  expect(result.validation.largestClearSpanFt).toBeGreaterThan(0);
  expect(result.validation.conceptOnlyNotice).toContain("professional structural review");
  expect(input).toEqual(before);
  expect(Object.isFrozen(result.validation)).toBe(true);
  expect(Object.isFrozen(result.validation.project)).toBe(true);
  expect(Object.isFrozen(result.validation.project.document)).toBe(true);
  expect(Object.isFrozen(result.validation.checks)).toBe(true);
  input.intent.requestedUse = { category: "other" };
  expect(result.validation.intent.requestedUse.category).toBe("cabin");
});

test("hostile reflection and oversized boundaries fail closed without invoking accessors or leaking details", () => {
  const unknown = { ...fixture(), hidden: true };
  expect(validateDesignIntentProject(unknown)).toMatchObject({
    ok: false,
    error: { gate: "boundary", code: "invalid-boundary" },
  });

  let invoked = 0;
  const accessor = fixture();
  Object.defineProperty(accessor, "hidden", {
    enumerable: true,
    get: () => { invoked += 1; throw new Error("private accessor detail"); },
  });
  expect(validateDesignIntentProject(accessor)).toMatchObject({
    ok: false,
    error: { gate: "boundary", code: "invalid-boundary" },
  });
  expect(invoked).toBe(0);

  const custom = Object.assign(Object.create({ hidden: true }), fixture());
  expect(validateDesignIntentProject(custom)).toMatchObject({ ok: false, error: { code: "invalid-boundary" } });

  const cyclic = fixture() as ReturnType<typeof fixture> & { self?: unknown };
  cyclic.self = cyclic;
  expect(validateDesignIntentProject(cyclic)).toMatchObject({ ok: false, error: { code: "invalid-boundary" } });

  const sparse = fixture();
  sparse.sourceApprovals = new Array(2);
  expect(validateDesignIntentProject(sparse)).toMatchObject({ ok: false, error: { code: "invalid-boundary" } });

  const symbolic = fixture() as ReturnType<typeof fixture> & Record<symbol, unknown>;
  symbolic[Symbol("hidden")] = true;
  expect(validateDesignIntentProject(symbolic)).toMatchObject({ ok: false, error: { code: "invalid-boundary" } });

  const revoked = Proxy.revocable(fixture(), {});
  revoked.revoke();
  const result = validateDesignIntentProject(revoked.proxy);
  expect(result).toMatchObject({ ok: false, error: { code: "invalid-boundary" } });
  expect(JSON.stringify(result)).not.toContain("private accessor detail");
});

test("strict DesignIntent promotion rejects unknown geometry without a raw parser error", () => {
  const input = fixture();
  input.intent.geometry = { polygon: [[0, 0]] };
  expect(validateDesignIntentProject(input)).toEqual({
    ok: false,
    error: {
      gate: "intent",
      code: "invalid-intent",
      problem: "The design intent does not pass the strict IP02 contract.",
    },
  });
});

test("every compiled-project version and hash must match canonical recomputation", () => {
  const cases: Array<(input: ReturnType<typeof fixture>) => void> = [
    (input) => { (input.project as { version: number }).version = 99; },
    (input) => { (input.project as { compilerVersion: string }).compilerVersion = "other"; },
    (input) => { input.project.intentHash = `0x${"1".repeat(64)}`; },
    (input) => { input.project.documentHash = `0x${"2".repeat(64)}`; },
    (input) => { input.project.projectHash = `0x${"3".repeat(64)}`; },
    (input) => { input.project.sourceFingerprints = [`sha256:${"b".repeat(64)}`]; },
  ];
  for (const change of cases) {
    const input = fixture();
    change(input);
    expect(validateDesignIntentProject(input)).toMatchObject({
      ok: false,
      error: { gate: "integrity", code: "integrity-failed" },
    });
  }
});

test("documents must be exact canonical v2 graph documents without migration, quarantine, or repair", () => {
  const unknown = fixture();
  (unknown.project.document as unknown as Record<string, unknown>).hidden = true;
  rehash(unknown.intent, unknown.project);
  expect(validateDesignIntentProject(unknown)).toMatchObject({
    ok: false,
    error: { gate: "document", code: "document-not-canonical" },
  });

  const legacy = fixture();
  legacy.project.document.geometry = { kind: "legacy-volumes", source: "spec.volumes" };
  rehash(legacy.intent, legacy.project);
  expect(validateDesignIntentProject(legacy)).toMatchObject({
    ok: false,
    error: { gate: "document", code: "graph-required" },
  });

  const warning = fixture();
  if (warning.project.document.geometry.kind !== "building-graph") throw new Error("Expected graph.");
  warning.project.document.geometry.migrationWarnings = ["normalized elsewhere"];
  rehash(warning.intent, warning.project);
  expect(validateDesignIntentProject(warning)).toMatchObject({
    ok: false,
    error: { gate: "document", code: "document-not-canonical" },
  });
});

test("building graph and document validator failures become bounded graph refusals", () => {
  const input = fixture();
  const graph = graphOf(input.project);
  graph.storeys[0].rooms[0].areaSqft += 1;
  const result = validateDesignIntentProject(input);
  expect(result).toMatchObject({ ok: false, error: { gate: "graph", code: "graph-invalid" } });
  expect(JSON.stringify(result)).not.toContain("exact face");
});

test("storeys, requested room names, counts, and minimum areas reconcile exactly", () => {
  const renamed = fixture();
  graphOf(renamed.project).storeys[0].rooms[0].name = "Hidden repair";
  rehash(renamed.intent, renamed.project);
  expect(validateDesignIntentProject(renamed)).toMatchObject({
    ok: false,
    error: { gate: "program", code: "program-mismatch" },
  });

  const undersized = fixture();
  const rooms = undersized.intent.rooms as Array<Record<string, unknown>>;
  rooms[0].minimumAreaM2 = 60;
  rehash(undersized.intent, undersized.project);
  expect(validateDesignIntentProject(undersized)).toMatchObject({
    ok: false,
    error: { gate: "program", code: "program-mismatch" },
  });

  const storeys = fixture();
  (storeys.intent.storeys as Record<string, unknown>).count = 2;
  rehash(storeys.intent, storeys.project);
  expect(validateDesignIntentProject(storeys)).toMatchObject({
    ok: false,
    error: { gate: "program", code: "program-mismatch" },
  });

  const swappedIntent = completeIntent();
  (swappedIntent.storeys as Record<string, unknown>).count = 2;
  const swappedProject = structuredClone(compile(swappedIntent));
  const swappedGraph = graphOf(swappedProject);
  const lowerName = swappedGraph.storeys[0].rooms[0].name;
  swappedGraph.storeys[0].rooms[0].name = swappedGraph.storeys[1].rooms[0].name;
  swappedGraph.storeys[1].rooms[0].name = lowerName;
  rehash(swappedIntent, swappedProject);
  expect(validateDesignIntentProject({
    intent: swappedIntent,
    project: swappedProject,
    sourceApprovals: [approval()],
  })).toMatchObject({
    ok: false,
    error: { gate: "program", code: "program-mismatch" },
  });

  const shortfall = fixture();
  const shortfallRoom = graphOf(shortfall.project).storeys[0].rooms[0];
  const shortfallIntentRooms = shortfall.intent.rooms as Array<Record<string, unknown>>;
  shortfallIntentRooms[0].minimumAreaM2 = (shortfallRoom.areaSqft + 0.05) / 10.763910416709722;
  rehash(shortfall.intent, shortfall.project);
  expect(validateDesignIntentProject(shortfall)).toMatchObject({
    ok: false,
    error: { gate: "program", code: "program-mismatch" },
  });
});

test("explicit opening counts and vertical head fit reconcile without silent trimming", () => {
  const count = fixture();
  (count.intent.openings as Record<string, unknown>).windowCount = 8;
  rehash(count.intent, count.project);
  expect(validateDesignIntentProject(count)).toMatchObject({
    ok: false,
    error: { gate: "openings", code: "opening-mismatch" },
  });

  const head = fixture();
  const opening = graphOf(head.project).storeys[0].walls.flatMap((wall) => wall.openings)[0];
  opening.sillFt = 8;
  rehash(head.intent, head.project);
  expect(validateDesignIntentProject(head)).toMatchObject({
    ok: false,
    error: { gate: "openings", code: "opening-mismatch" },
  });
});

test("omitted opening counts require the compiler's disclosed defaults", () => {
  const intent = completeIntent();
  Object.assign(intent.openings as Record<string, unknown>, {
    windowCount: null,
    exteriorDoorCount: null,
  });
  const project = structuredClone(compile(intent));
  project.decisions = project.decisions.filter((decision) => decision.code !== "default-window-count");
  rehash(intent, project);
  expect(validateDesignIntentProject({ intent, project, sourceApprovals: [approval()] })).toMatchObject({
    ok: false,
    error: { gate: "openings", code: "opening-mismatch" },
  });

  const forgedProject = structuredClone(compile(intent));
  const disclosure = forgedProject.decisions.find((decision) => decision.code === "default-window-count");
  expect(disclosure).toBeDefined();
  if (!disclosure) throw new Error("Expected default-window-count disclosure.");
  disclosure.field = "roof";
  disclosure.statement = "This is not the compiler disclosure.";
  rehash(intent, forgedProject);
  expect(validateDesignIntentProject({ intent, project: forgedProject, sourceApprovals: [approval()] })).toMatchObject({
    ok: false,
    error: { gate: "openings", code: "opening-mismatch" },
  });
});

test("climate mapping and disclosed climate defaults cannot drift", () => {
  const drift = fixture();
  drift.project.document.spec.climateZone = "5";
  if (drift.project.document.geometry.kind !== "building-graph") throw new Error("Expected graph.");
  drift.project.document.geometry.legacyRecovery.climateZone = "5";
  rehash(drift.intent, drift.project);
  expect(validateDesignIntentProject(drift)).toMatchObject({
    ok: false,
    error: { gate: "climate", code: "climate-mismatch" },
  });

  const intent = completeIntent();
  Object.assign(intent.climate as Record<string, unknown>, {
    country: "unknown",
    region: null,
    profile: "unknown",
  });
  const project = structuredClone(compile(intent));
  project.decisions = project.decisions.filter((decision) => decision.code !== "default-climate");
  rehash(intent, project);
  expect(validateDesignIntentProject({ intent, project, sourceApprovals: [approval()] })).toMatchObject({
    ok: false,
    error: { gate: "climate", code: "climate-mismatch" },
  });
});

test("uploaded-image provenance requires exactly one matching rights approval", () => {
  const missing = fixture();
  missing.sourceApprovals = [];
  expect(validateDesignIntentProject(missing)).toMatchObject({
    ok: false,
    error: { gate: "rights", code: "rights-missing" },
  });

  const duplicate = fixture();
  duplicate.sourceApprovals.push(approval());
  expect(validateDesignIntentProject(duplicate)).toMatchObject({
    ok: false,
    error: { gate: "rights", code: "rights-invalid" },
  });

  const mismatch = fixture();
  mismatch.sourceApprovals = [approval(`sha256:${"b".repeat(64)}`)];
  expect(validateDesignIntentProject(mismatch)).toMatchObject({
    ok: false,
    error: { gate: "rights", code: "rights-missing" },
  });

  const unsupported = fixture();
  unsupported.sourceApprovals[0].consentToAnalyze = false;
  expect(validateDesignIntentProject(unsupported)).toMatchObject({
    ok: false,
    error: { gate: "rights", code: "rights-invalid" },
  });
});

test("non-image sources cannot acquire an image-rights claim", () => {
  const intent = completeIntent();
  const sources = intent.sources as Array<Record<string, unknown>>;
  sources[0].kind = "user-answer";
  const project = structuredClone(compile(intent));
  expect(validateDesignIntentProject({ intent, project, sourceApprovals: [approval()] })).toMatchObject({
    ok: false,
    error: { gate: "rights", code: "rights-invalid" },
  });
  expect(validateDesignIntentProject({ intent, project, sourceApprovals: [] })).toMatchObject({ ok: true });
});

test("span evidence stays review-required and never claims professional adequacy", () => {
  const result = validation();
  const span = result.checks.find((check) => check.gate === "span");
  expect(span).toMatchObject({ outcome: "review-required" });
  expect(span?.message).toContain("professional structural review");
  expect(span?.message).not.toMatch(/code-compliant|engineered|permit-ready|construction-ready|structurally verified/i);
  expect(result.status).toBe("concept-preview-valid");
});

test("failures return no partial project or receipt and never mutate their input", () => {
  const input = fixture();
  input.project.projectHash = `0x${"f".repeat(64)}`;
  const before = structuredClone(input);
  const result = validateDesignIntentProject(input);
  expect(result).toMatchObject({ ok: false, error: { code: "integrity-failed" } });
  expect("project" in result).toBe(false);
  expect("validation" in result).toBe(false);
  expect(input).toEqual(before);
  expect(Object.isFrozen(result)).toBe(true);
  if (result.ok) throw new Error("Expected a bounded validation refusal.");
  expect(Object.isFrozen(result.error)).toBe(true);
});

test("the validator source stays provider-free, side-effect-free, UI-free, and outside frozen rendering", () => {
  const source = readFileSync(join(process.cwd(), "lib/ai/designIntentProjectValidator.ts"), "utf8");
  const forbidden = [
    /openrouter/i,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /process\.env/,
    /localStorage|indexedDB|sessionStorage/,
    /Date\s*\(|Date\.now|Math\.random|crypto\.randomUUID/,
    /\b(?:wallet|payment|checkout|fee|budget)\b/i,
    /createAuraProject|withProjectDesign|project\/store/,
    /react|\.css|three|renderer|scene|animation|camera|lighting|shader|texture|model asset/i,
  ];
  forbidden.forEach((pattern) => expect(source).not.toMatch(pattern));
  expect(source).toContain("parseDesignIntent");
  expect(source).toContain("validateBuildingGraph");
  expect(source).toContain("validateBuilderDocument");
  expect(source).toContain("hashBuilderDocument");
});
