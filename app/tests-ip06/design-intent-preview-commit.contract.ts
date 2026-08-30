import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "playwright/test";

import { DESIGN_INTENT_FIELDS, DESIGN_INTENT_VERSION } from "@/lib/ai/designIntent";
import {
  compileDesignIntentToProject,
  type CompiledDesignIntentProject,
} from "@/lib/ai/designIntentCompiler";
import type { DesignIntentImageSourceApproval } from "@/lib/ai/designIntentProjectValidator";
import {
  DESIGN_INTENT_PREVIEW_COMMIT_VERSION,
  DesignIntentPreviewCommitError,
  cancelDesignIntentPreview,
  commitDesignIntentPreview,
  prepareDesignIntentPreview,
  type DesignIntentPreviewInput,
} from "@/lib/ai/designIntentPreviewCommit";
import {
  defaultBuilderDocument,
  hashBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";

const sourceFingerprint = `sha256:${"a".repeat(64)}`;

type FixtureInput = Omit<DesignIntentPreviewInput, "validationInput"> & {
  validationInput: {
    intent: Record<string, unknown>;
    project: CompiledDesignIntentProject;
    sourceApprovals: DesignIntentImageSourceApproval[];
  };
};

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
  unresolved: [{
    id: "unresolved-site",
    field: "siting",
    question: "What is the surveyed site orientation?",
  }],
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

const compiledProject = (intent: unknown) => {
  const result = compileDesignIntentToProject(intent);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.problem}`);
  return result.project;
};

const input = (): FixtureInput => {
  const intent = completeIntent();
  return {
    validationInput: {
      intent,
      project: structuredClone(compiledProject(intent)),
      sourceApprovals: [{
        sourceFingerprint,
        consentToAnalyze: true,
        rights: "i-own-this-image",
        retention: "delete-after-analysis",
        rawImageDisposition: "delete when the analysis task finishes or fails",
      }],
    },
    beforeDocument: structuredClone(defaultBuilderDocument()),
    costEvidence: {
      currency: "USD",
      providerCostMicros: 1_000,
      auraFeeMicros: 150,
      totalCostMicros: 1_150,
      basis: "verified-provider-receipt",
      evidenceId: "cost-receipt-1",
    },
  };
};

const expectPreviewError = (
  operation: () => unknown,
  code: string,
) => {
  try {
    operation();
    throw new Error("Expected IP06 to refuse the operation.");
  } catch (error) {
    expect(error).toBeInstanceOf(DesignIntentPreviewCommitError);
    expect(error).toMatchObject({ code });
    return error as DesignIntentPreviewCommitError;
  }
};

test("a valid IP05 proposal becomes one complete explainable preview without an applyable document", () => {
  const value = input();
  const before = structuredClone(value);
  const preview = prepareDesignIntentPreview(value);

  expect(DESIGN_INTENT_PREVIEW_COMMIT_VERSION).toBe("aura-design-intent-preview-commit/v1");
  expect(preview).toMatchObject({
    format: "aura-design-intent-preview",
    version: 1,
    intent: {
      requestedUse: { category: "cabin" },
      approximateFootprint: { targetM2: 72 },
    },
    assumptions: [{ id: "assumption-view", field: "siting" }],
    unresolved: [{ id: "unresolved-site", field: "siting" }],
    validation: {
      status: "concept-preview-valid",
      checks: expect.arrayContaining([
        { gate: "integrity", outcome: "pass", message: expect.any(String) },
        { gate: "span", outcome: "review-required", message: expect.any(String) },
      ]),
    },
    projectChange: {
      kind: "replace-current-builder-document",
      beforeDocumentHash: hashBuilderDocument(value.beforeDocument),
      afterDocumentHash: value.validationInput.project.documentHash,
      projectHash: value.validationInput.project.projectHash,
      actionLabel: "image-plan:accept",
      undoSteps: 1,
    },
    cost: value.costEvidence,
  });
  expect(preview.confidence).toHaveLength(DESIGN_INTENT_FIELDS.length);
  expect(preview.projectChange.changedSections.length).toBeGreaterThan(0);
  expect(preview.projectChange.changedSections).toEqual([...preview.projectChange.changedSections].sort());
  expect(preview.confirmationText).toBe("Apply this image proposal as one undoable project change.");
  expect(preview.previewId).toMatch(/^0x[a-f0-9]{64}$/);
  const serialized = JSON.stringify(preview);
  expect(serialized).not.toContain('"action":');
  expect(serialized).not.toContain('"document":');
  expect(serialized).not.toContain("rawImageDisposition");
  expect(value).toEqual(before);
});

test("exact deliberate confirmation recomputes and returns one inert load action with one-step undo metadata", () => {
  const value = input();
  const preview = prepareDesignIntentPreview(value);
  const receipt = commitDesignIntentPreview(value, {
    previewId: preview.previewId,
    beforeDocumentHash: preview.projectChange.beforeDocumentHash,
    confirmationText: preview.confirmationText,
  });

  expect(receipt).toMatchObject({
    format: "aura-design-intent-commit",
    version: 1,
    previewId: preview.previewId,
    committed: true,
    action: { type: "load", label: "image-plan:accept" },
    undo: {
      steps: 1,
      restoresDocumentHash: preview.projectChange.beforeDocumentHash,
    },
    resultingDocumentHash: preview.projectChange.afterDocumentHash,
    projectHash: preview.projectChange.projectHash,
  });
  expect(Object.keys(receipt.action).sort()).toEqual(["doc", "label", "type"]);
  expect(hashBuilderDocument(receipt.action.doc)).toBe(preview.projectChange.afterDocumentHash);
  expect(receipt.action.doc).toEqual(value.validationInput.project.document);
  expect(receipt.action.doc).not.toBe(value.validationInput.project.document);
});

test("cancel exposes zero writes and no action, document, project, or mutation surface", () => {
  const preview = prepareDesignIntentPreview(input());
  const receipt = cancelDesignIntentPreview(preview);
  expect(receipt).toEqual({
    format: "aura-design-intent-preview-cancel",
    version: 1,
    previewId: preview.previewId,
    cancelled: true,
    writes: 0,
  });
  const serialized = JSON.stringify(receipt);
  expect(serialized).not.toContain("action");
  expect(serialized).not.toContain("document");
  expect(serialized).not.toContain("project");

  const tampered = structuredClone(preview);
  tampered.cost.totalCostMicros += 1;
  expectPreviewError(() => cancelDesignIntentPreview(tampered), "invalid-preview");
});

test("stale, forged, partial, extra, or mismatched confirmation data fails closed", () => {
  const value = input();
  const preview = prepareDesignIntentPreview(value);
  const confirmation = {
    previewId: preview.previewId,
    beforeDocumentHash: preview.projectChange.beforeDocumentHash,
    confirmationText: preview.confirmationText,
  };
  const cases: unknown[] = [
    { ...confirmation, previewId: `0x${"1".repeat(64)}` },
    { ...confirmation, beforeDocumentHash: `0x${"2".repeat(64)}` },
    { ...confirmation, confirmationText: "Apply it." },
    { previewId: confirmation.previewId },
    { ...confirmation, hidden: true },
  ];
  for (const candidate of cases) {
    expectPreviewError(
      () => commitDesignIntentPreview(value, candidate as never),
      "confirmation-mismatch",
    );
  }

  const changed = structuredClone(value);
  changed.beforeDocument.spec.name = "A changed current project";
  expectPreviewError(
    () => commitDesignIntentPreview(changed, confirmation),
    "confirmation-mismatch",
  );
});

test("IP05 refusals and no-op proposals never produce a partial preview or action", () => {
  const invalid = input();
  invalid.validationInput.project.projectHash = `0x${"3".repeat(64)}`;
  const invalidError = expectPreviewError(
    () => prepareDesignIntentPreview(invalid),
    "validation-failed",
  );
  expect(JSON.stringify(invalidError)).not.toContain("document");
  expect(JSON.stringify(invalidError)).not.toContain("projectHash");

  const noOp = input();
  noOp.beforeDocument = structuredClone(noOp.validationInput.project.document);
  expectPreviewError(() => prepareDesignIntentPreview(noOp), "no-project-change");
});

test("cost evidence is exact safe-integer USD-micro arithmetic and never calculates or executes a fee", () => {
  const cases: Array<(value: ReturnType<typeof input>) => void> = [
    (value) => { value.costEvidence.totalCostMicros = 1_149; },
    (value) => { value.costEvidence.providerCostMicros = Number.MAX_SAFE_INTEGER; },
    (value) => {
      (value.costEvidence as unknown as { currency: string }).currency = "CAD";
    },
    (value) => {
      (value.costEvidence as unknown as { basis: string }).basis = "provider-guess";
    },
    (value) => { value.costEvidence.evidenceId = ""; },
  ];
  for (const change of cases) {
    const value = input();
    change(value);
    expectPreviewError(() => prepareDesignIntentPreview(value), "invalid-cost-evidence");
  }

  const free = input();
  free.costEvidence = {
    currency: "USD",
    providerCostMicros: 0,
    auraFeeMicros: 0,
    totalCostMicros: 0,
    basis: "deterministic-fake",
    evidenceId: "fake-cost-zero",
  };
  expect(prepareDesignIntentPreview(free).cost.totalCostMicros).toBe(0);
});

test("hostile boundaries invoke no hidden values and reveal no private error detail", () => {
  let invoked = 0;
  const hostile = input() as ReturnType<typeof input> & Record<string, unknown>;
  Object.defineProperty(hostile, "hidden", {
    enumerable: true,
    get: () => { invoked += 1; throw new Error("private-preview-detail"); },
  });
  const error = expectPreviewError(() => prepareDesignIntentPreview(hostile), "invalid-preview-input");
  expect(invoked).toBe(0);
  expect(JSON.stringify(error)).not.toContain("private-preview-detail");

  const custom = Object.assign(Object.create({ hidden: true }), input());
  expectPreviewError(() => prepareDesignIntentPreview(custom), "invalid-preview-input");

  const cyclic = input() as ReturnType<typeof input> & { self?: unknown };
  cyclic.self = cyclic;
  expectPreviewError(() => prepareDesignIntentPreview(cyclic), "invalid-preview-input");

  const aliased = input();
  (aliased.validationInput as unknown as { sourceApprovals: unknown[] }).sourceApprovals = [
    aliased.validationInput.intent,
  ];
  expectPreviewError(() => prepareDesignIntentPreview(aliased), "invalid-preview-input");

  const revoked = Proxy.revocable(input(), {});
  revoked.revoke();
  expectPreviewError(() => prepareDesignIntentPreview(revoked.proxy), "invalid-preview-input");
});

test("preview, commit, cancel, and every returned nested surface are detached and deeply frozen", () => {
  const value = input();
  const preview = prepareDesignIntentPreview(value);
  const committed = commitDesignIntentPreview(value, {
    previewId: preview.previewId,
    beforeDocumentHash: preview.projectChange.beforeDocumentHash,
    confirmationText: preview.confirmationText,
  });
  const cancelled = cancelDesignIntentPreview(preview);

  const surfaces: unknown[] = [
    preview,
    preview.intent,
    preview.assumptions,
    preview.validation,
    preview.validation.checks,
    preview.projectChange,
    preview.projectChange.changedSections,
    preview.cost,
    committed,
    committed.action,
    committed.action.doc,
    committed.action.doc.spec,
    committed.undo,
    cancelled,
  ];
  for (const surface of surfaces) expect(Object.isFrozen(surface)).toBe(true);

  value.validationInput.intent.requestedUse = { category: "other" };
  value.validationInput.project.document.spec.name = "mutated input";
  expect(preview.intent.requestedUse.category).toBe("cabin");
  expect(committed.action.doc.spec.name).not.toBe("mutated input");
});

test("the IP06 source is provider-neutral, side-effect-free, UI-free, and outside frozen rendering", () => {
  const source = readFileSync(join(process.cwd(), "lib/ai/designIntentPreviewCommit.ts"), "utf8");
  const forbidden = [
    /\bfetch\s*\(/,
    /process\.env/,
    /localStorage|sessionStorage|indexedDB/,
    /Date\.now|new Date|Math\.random|randomUUID/,
    /from\s+["']react["']|\.tsx["']/,
    /@react-three|from\s+["']three["']|\/components\//,
    /wallet|checkout|paymentIntent|transfer|charge\s*\(/i,
    /openrouter|anthropic|openai|gemini/i,
  ];
  for (const pattern of forbidden) expect(source).not.toMatch(pattern);

  const status = readFileSync(join(process.cwd(), "../docs/plans/execution/v2/IP06-explainable-preview-commit.json"), "utf8");
  expect(status).toContain('"freezeClass": "none"');
  expect(status).toContain('"sideEffects": "none"');
  expect(status).not.toContain('"externalGates": [\n    "');
});

test("the fixture's current and candidate documents are independently canonical and distinct", () => {
  const value = input();
  const current: BuilderDocument = value.beforeDocument;
  const candidate: BuilderDocument = value.validationInput.project.document;
  expect(hashBuilderDocument(current)).not.toBe(hashBuilderDocument(candidate));
});
