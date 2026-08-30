import { keccak256, stringToHex, type Hex } from "viem";

import { parseDesignIntent, type DesignIntent } from "./designIntent";
import {
  validateDesignIntentProject,
  type DesignIntentProjectValidationCheck,
  type DesignIntentProjectValidationInput,
  type ValidatedDesignIntentProject,
} from "./designIntentProjectValidator";
import {
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "../builder/document";

export const DESIGN_INTENT_PREVIEW_COMMIT_VERSION =
  "aura-design-intent-preview-commit/v1" as const;
export const DESIGN_INTENT_PREVIEW_VERSION = 1 as const;
export const DESIGN_INTENT_COMMIT_VERSION = 1 as const;
export const DESIGN_INTENT_CANCEL_VERSION = 1 as const;

export type DesignIntentPreviewCommitErrorCode =
  | "invalid-preview-input"
  | "validation-failed"
  | "current-document-invalid"
  | "no-project-change"
  | "invalid-cost-evidence"
  | "confirmation-mismatch"
  | "invalid-preview";

const PUBLIC_PROBLEMS: Readonly<Record<DesignIntentPreviewCommitErrorCode, string>> = Object.freeze({
  "invalid-preview-input": "The preview request must contain only plain bounded data.",
  "validation-failed": "The image-to-plan proposal did not pass project validation.",
  "current-document-invalid": "The current project document is not an exact canonical document.",
  "no-project-change": "The proposal does not change the current project.",
  "invalid-cost-evidence": "The projected cost evidence is invalid or does not add up exactly.",
  "confirmation-mismatch": "The confirmation does not match the current proposal preview.",
  "invalid-preview": "The preview is malformed or no longer matches its evidence.",
});

export class DesignIntentPreviewCommitError extends Error {
  readonly code: DesignIntentPreviewCommitErrorCode;

  constructor(code: DesignIntentPreviewCommitErrorCode) {
    super(PUBLIC_PROBLEMS[code]);
    this.name = "DesignIntentPreviewCommitError";
    this.code = code;
  }
}

const refuse = (code: DesignIntentPreviewCommitErrorCode): never => {
  throw new DesignIntentPreviewCommitError(code);
};

export type DesignIntentCostEvidenceBasis =
  | "deterministic-fake"
  | "bounded-estimate"
  | "verified-provider-receipt";

export interface DesignIntentCostEvidence {
  currency: "USD";
  providerCostMicros: number;
  auraFeeMicros: number;
  totalCostMicros: number;
  basis: DesignIntentCostEvidenceBasis;
  evidenceId: string;
}

export interface DesignIntentPreviewInput {
  validationInput: DesignIntentProjectValidationInput;
  beforeDocument: BuilderDocument;
  costEvidence: DesignIntentCostEvidence;
}

export type DesignIntentPreviewActionLabel = `image-plan:accept:${Hex}`;

export type BuilderDocumentSection =
  | "comfort"
  | "finishes"
  | "fixtures"
  | "geometry"
  | "partitions"
  | "planOrigin"
  | "quarantine"
  | "site"
  | "spec";

export interface DesignIntentPreview {
  format: "aura-design-intent-preview";
  version: typeof DESIGN_INTENT_PREVIEW_VERSION;
  contractVersion: typeof DESIGN_INTENT_PREVIEW_COMMIT_VERSION;
  previewId: Hex;
  intent: DesignIntent;
  assumptions: DesignIntent["assumptions"];
  confidence: DesignIntent["confidence"];
  unresolved: DesignIntent["unresolved"];
  validation: {
    status: ValidatedDesignIntentProject["status"];
    checks: DesignIntentProjectValidationCheck[];
    conceptOnlyNotice: string;
    largestClearSpanFt: number;
  };
  projectChange: {
    kind: "replace-current-builder-document";
    beforeDocumentHash: Hex;
    afterDocumentHash: Hex;
    projectHash: Hex;
    changedSections: BuilderDocumentSection[];
    actionLabel: DesignIntentPreviewActionLabel;
    undoSteps: 1;
  };
  cost: DesignIntentCostEvidence;
  confirmationText: "Apply this image proposal as one undoable project change.";
}

export interface DesignIntentPreviewConfirmation {
  previewId: Hex;
  beforeDocumentHash: Hex;
  confirmationText: DesignIntentPreview["confirmationText"];
}

export interface DesignIntentCommitReceipt {
  format: "aura-design-intent-commit";
  version: typeof DESIGN_INTENT_COMMIT_VERSION;
  previewId: Hex;
  committed: true;
  action: {
    type: "load";
    doc: BuilderDocument;
    label: DesignIntentPreviewActionLabel;
  };
  undo: {
    steps: 1;
    restoresDocumentHash: Hex;
  };
  resultingDocumentHash: Hex;
  projectHash: Hex;
}

export interface DesignIntentCancelReceipt {
  format: "aura-design-intent-preview-cancel";
  version: typeof DESIGN_INTENT_CANCEL_VERSION;
  previewId: Hex;
  cancelled: true;
  writes: 0;
}

interface SnapshotState {
  seen: WeakSet<object>;
  nodes: number;
}

const MAX_DEPTH = 48;
const MAX_NODES = 40_000;
const MAX_ARRAY_ITEMS = 12_000;
const MAX_KEYS = 1_024;
const MAX_TEXT = 65_536;
const HASH = /^0x[a-f0-9]{64}$/;
const CONFIRMATION_TEXT = "Apply this image proposal as one undoable project change." as const;
const DOCUMENT_SECTIONS: readonly BuilderDocumentSection[] = Object.freeze([
  "comfort",
  "finishes",
  "fixtures",
  "geometry",
  "partitions",
  "planOrigin",
  "quarantine",
  "site",
  "spec",
]);

function snapshotPlain(
  value: unknown,
  state: SnapshotState,
  depth = 0,
): unknown {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || depth > MAX_DEPTH) return refuse("invalid-preview-input");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return refuse("invalid-preview-input");
    return value;
  }
  if (typeof value === "string") {
    if (value.length > MAX_TEXT) return refuse("invalid-preview-input");
    return value;
  }
  if (typeof value !== "object") return refuse("invalid-preview-input");
  try {
    if (state.seen.has(value)) return refuse("invalid-preview-input");
    state.seen.add(value);
  } catch {
    return refuse("invalid-preview-input");
  }

  let prototype: object | null;
  let keys: Array<string | symbol>;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return refuse("invalid-preview-input");
  }
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype || value.length > MAX_ARRAY_ITEMS) {
      return refuse("invalid-preview-input");
    }
    if (keys.some((key) => typeof key !== "string" ||
      (key !== "length" && !/^(?:0|[1-9][0-9]*)$/.test(key)))) {
      return refuse("invalid-preview-input");
    }
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        return refuse("invalid-preview-input");
      }
      if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
        return refuse("invalid-preview-input");
      }
      output.push(snapshotPlain(descriptor.value, state, depth + 1));
    }
    if (keys.length !== value.length + 1) return refuse("invalid-preview-input");
    return output;
  }
  if (prototype !== Object.prototype && prototype !== null || keys.length > MAX_KEYS ||
      keys.some((key) => typeof key !== "string")) {
    return refuse("invalid-preview-input");
  }
  const output: Record<string, unknown> = {};
  for (const key of keys as string[]) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return refuse("invalid-preview-input");
    }
    if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
      return refuse("invalid-preview-input");
    }
    output[key] = snapshotPlain(descriptor.value, state, depth + 1);
  }
  return output;
}

const snapshot = (value: unknown): unknown =>
  snapshotPlain(value, { seen: new WeakSet<object>(), nodes: 0 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactRecord = <K extends string>(
  value: unknown,
  keys: readonly K[],
  code: DesignIntentPreviewCommitErrorCode,
): Record<K, unknown> => {
  if (!isRecord(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    return refuse(code);
  }
  return value as Record<K, unknown>;
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
};

const copyPlain = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => copyPlain(item)) as T;
  if (typeof value !== "object" || value === null) return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = copyPlain(child);
  }
  return output as T;
};

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) output[key] = canonicalValue(value[key]);
  return output;
};

const canonicalJson = (value: unknown): string => {
  const encoded = JSON.stringify(canonicalValue(value));
  return encoded === undefined ? "undefined" : encoded;
};
const canonicalHash = (value: unknown): Hex => keccak256(stringToHex(canonicalJson(value)));

const transitionActionLabel = (
  beforeDocumentHash: Hex,
  afterDocumentHash: Hex,
): DesignIntentPreviewActionLabel =>
  `image-plan:accept:${canonicalHash({ beforeDocumentHash, afterDocumentHash })}`;

const parseHash = (
  value: unknown,
  code: DesignIntentPreviewCommitErrorCode,
): Hex => {
  if (typeof value !== "string" || !HASH.test(value)) return refuse(code);
  return value as Hex;
};

const parseText = (
  value: unknown,
  code: DesignIntentPreviewCommitErrorCode,
  maximum = 2_000,
): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum || value.trim() !== value) {
    return refuse(code);
  }
  return value;
};

const parseMicros = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return refuse("invalid-cost-evidence");
  return value as number;
};

const parseCost = (value: unknown): DesignIntentCostEvidence => {
  const record = exactRecord(value, [
    "currency", "providerCostMicros", "auraFeeMicros", "totalCostMicros", "basis", "evidenceId",
  ] as const, "invalid-cost-evidence");
  if (record.currency !== "USD" || !new Set([
    "deterministic-fake", "bounded-estimate", "verified-provider-receipt",
  ]).has(record.basis as string)) {
    return refuse("invalid-cost-evidence");
  }
  const providerCostMicros = parseMicros(record.providerCostMicros);
  const auraFeeMicros = parseMicros(record.auraFeeMicros);
  const totalCostMicros = parseMicros(record.totalCostMicros);
  const exactTotal = providerCostMicros + auraFeeMicros;
  if (!Number.isSafeInteger(exactTotal) || totalCostMicros !== exactTotal) {
    return refuse("invalid-cost-evidence");
  }
  const evidenceId = parseText(record.evidenceId, "invalid-cost-evidence", 200);
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9._:/-]{0,198}[A-Za-z0-9])?$/.test(evidenceId)) {
    return refuse("invalid-cost-evidence");
  }
  return {
    currency: "USD",
    providerCostMicros,
    auraFeeMicros,
    totalCostMicros,
    basis: record.basis as DesignIntentCostEvidenceBasis,
    evidenceId,
  };
};

const exactCurrentDocument = (value: unknown): BuilderDocument => {
  let result;
  try {
    result = validateBuilderDocument(value);
  } catch {
    return refuse("current-document-invalid");
  }
  if (!result.ok || result.migratedFrom !== null ||
      canonicalJson(value) !== canonicalJson(result.document)) {
    return refuse("current-document-invalid");
  }
  return result.document;
};

const changedSections = (
  before: BuilderDocument,
  after: BuilderDocument,
): BuilderDocumentSection[] => DOCUMENT_SECTIONS.filter((section) => {
  const beforeRecord = before as unknown as Record<string, unknown>;
  const afterRecord = after as unknown as Record<string, unknown>;
  const beforeValue = Object.hasOwn(beforeRecord, section) ? beforeRecord[section] : undefined;
  const afterValue = Object.hasOwn(afterRecord, section) ? afterRecord[section] : undefined;
  return canonicalJson(beforeValue) !== canonicalJson(afterValue);
});

type PreviewBody = Omit<DesignIntentPreview, "previewId">;

const previewBody = (
  validation: ValidatedDesignIntentProject,
  beforeDocument: BuilderDocument,
  cost: DesignIntentCostEvidence,
): PreviewBody => {
  const beforeDocumentHash = hashBuilderDocument(beforeDocument);
  const afterDocumentHash = validation.project.documentHash;
  if (beforeDocumentHash === afterDocumentHash) return refuse("no-project-change");
  const sections = changedSections(beforeDocument, validation.project.document);
  if (sections.length === 0) return refuse("no-project-change");
  return {
    format: "aura-design-intent-preview",
    version: DESIGN_INTENT_PREVIEW_VERSION,
    contractVersion: DESIGN_INTENT_PREVIEW_COMMIT_VERSION,
    intent: copyPlain(validation.intent),
    assumptions: copyPlain(validation.intent.assumptions),
    confidence: copyPlain(validation.intent.confidence),
    unresolved: copyPlain(validation.intent.unresolved),
    validation: {
      status: validation.status,
      checks: copyPlain(validation.checks),
      conceptOnlyNotice: validation.conceptOnlyNotice,
      largestClearSpanFt: validation.largestClearSpanFt,
    },
    projectChange: {
      kind: "replace-current-builder-document",
      beforeDocumentHash,
      afterDocumentHash,
      projectHash: validation.project.projectHash,
      changedSections: [...sections],
      actionLabel: transitionActionLabel(beforeDocumentHash, afterDocumentHash),
      undoSteps: 1,
    },
    cost: copyPlain(cost),
    confirmationText: CONFIRMATION_TEXT,
  };
};

interface PreparedInternal {
  preview: DesignIntentPreview;
  candidateDocument: BuilderDocument;
}

const prepareInternal = (value: unknown): PreparedInternal => {
  let safe: unknown;
  try {
    safe = snapshot(value);
  } catch (error) {
    if (error instanceof DesignIntentPreviewCommitError) throw error;
    return refuse("invalid-preview-input");
  }
  const root = exactRecord(safe, [
    "validationInput", "beforeDocument", "costEvidence",
  ] as const, "invalid-preview-input");
  const validationResult = validateDesignIntentProject(root.validationInput);
  if (!validationResult.ok) return refuse("validation-failed");
  const beforeDocument = exactCurrentDocument(root.beforeDocument);
  const cost = parseCost(root.costEvidence);
  const body = previewBody(validationResult.validation, beforeDocument, cost);
  const preview = deepFreeze({ ...body, previewId: canonicalHash(body) } as DesignIntentPreview);
  return {
    preview,
    candidateDocument: copyPlain(validationResult.validation.project.document),
  };
};

const parseChecks = (value: unknown): DesignIntentProjectValidationCheck[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) return refuse("invalid-preview");
  const gates = new Set([
    "boundary", "intent", "integrity", "document", "graph", "program", "openings", "climate", "rights", "span",
  ]);
  return value.map((item) => {
    const record = exactRecord(item, ["gate", "outcome", "message"] as const, "invalid-preview");
    if (!gates.has(record.gate as string) ||
        (record.outcome !== "pass" && record.outcome !== "review-required")) {
      return refuse("invalid-preview");
    }
    return {
      gate: record.gate as DesignIntentProjectValidationCheck["gate"],
      outcome: record.outcome,
      message: parseText(record.message, "invalid-preview"),
    };
  });
};

const parsePreview = (value: unknown): DesignIntentPreview => {
  let safe: unknown;
  try {
    safe = snapshot(value);
  } catch {
    return refuse("invalid-preview");
  }
  const record = exactRecord(safe, [
    "format", "version", "contractVersion", "previewId", "intent", "assumptions", "confidence",
    "unresolved", "validation", "projectChange", "cost", "confirmationText",
  ] as const, "invalid-preview");
  if (record.format !== "aura-design-intent-preview" ||
      record.version !== DESIGN_INTENT_PREVIEW_VERSION ||
      record.contractVersion !== DESIGN_INTENT_PREVIEW_COMMIT_VERSION ||
      record.confirmationText !== CONFIRMATION_TEXT) {
    return refuse("invalid-preview");
  }
  let intent: DesignIntent;
  try {
    intent = parseDesignIntent(record.intent);
  } catch {
    return refuse("invalid-preview");
  }
  if (canonicalJson(record.assumptions) !== canonicalJson(intent.assumptions) ||
      canonicalJson(record.confidence) !== canonicalJson(intent.confidence) ||
      canonicalJson(record.unresolved) !== canonicalJson(intent.unresolved)) {
    return refuse("invalid-preview");
  }
  const validationRecord = exactRecord(record.validation, [
    "status", "checks", "conceptOnlyNotice", "largestClearSpanFt",
  ] as const, "invalid-preview");
  if (validationRecord.status !== "concept-preview-valid" ||
      typeof validationRecord.largestClearSpanFt !== "number" ||
      !Number.isFinite(validationRecord.largestClearSpanFt) || validationRecord.largestClearSpanFt <= 0) {
    return refuse("invalid-preview");
  }
  const validation = {
    status: "concept-preview-valid" as const,
    checks: parseChecks(validationRecord.checks),
    conceptOnlyNotice: parseText(validationRecord.conceptOnlyNotice, "invalid-preview", 4_000),
    largestClearSpanFt: validationRecord.largestClearSpanFt,
  };
  const changeRecord = exactRecord(record.projectChange, [
    "kind", "beforeDocumentHash", "afterDocumentHash", "projectHash", "changedSections",
    "actionLabel", "undoSteps",
  ] as const, "invalid-preview");
  if (changeRecord.kind !== "replace-current-builder-document" ||
      changeRecord.undoSteps !== 1 ||
      !Array.isArray(changeRecord.changedSections) || changeRecord.changedSections.length === 0) {
    return refuse("invalid-preview");
  }
  const sections = changeRecord.changedSections.map((section) => {
    if (typeof section !== "string" || !DOCUMENT_SECTIONS.includes(section as BuilderDocumentSection)) {
      return refuse("invalid-preview");
    }
    return section as BuilderDocumentSection;
  });
  if (new Set(sections).size !== sections.length ||
      JSON.stringify(sections) !== JSON.stringify([...sections].sort())) {
    return refuse("invalid-preview");
  }
  const beforeDocumentHash = parseHash(changeRecord.beforeDocumentHash, "invalid-preview");
  const afterDocumentHash = parseHash(changeRecord.afterDocumentHash, "invalid-preview");
  const actionLabel = transitionActionLabel(beforeDocumentHash, afterDocumentHash);
  if (changeRecord.actionLabel !== actionLabel) return refuse("invalid-preview");
  const projectChange = {
    kind: "replace-current-builder-document" as const,
    beforeDocumentHash,
    afterDocumentHash,
    projectHash: parseHash(changeRecord.projectHash, "invalid-preview"),
    changedSections: sections,
    actionLabel,
    undoSteps: 1 as const,
  };
  if (projectChange.beforeDocumentHash === projectChange.afterDocumentHash) return refuse("invalid-preview");
  let cost: DesignIntentCostEvidence;
  try {
    cost = parseCost(record.cost);
  } catch {
    return refuse("invalid-preview");
  }
  const body: PreviewBody = {
    format: "aura-design-intent-preview",
    version: DESIGN_INTENT_PREVIEW_VERSION,
    contractVersion: DESIGN_INTENT_PREVIEW_COMMIT_VERSION,
    intent,
    assumptions: copyPlain(intent.assumptions),
    confidence: copyPlain(intent.confidence),
    unresolved: copyPlain(intent.unresolved),
    validation,
    projectChange,
    cost,
    confirmationText: CONFIRMATION_TEXT,
  };
  const previewId = parseHash(record.previewId, "invalid-preview");
  if (canonicalHash(body) !== previewId) return refuse("invalid-preview");
  return deepFreeze({ ...body, previewId });
};

export function prepareDesignIntentPreview(value: DesignIntentPreviewInput): DesignIntentPreview {
  return prepareInternal(value).preview;
}

export function commitDesignIntentPreview(
  value: DesignIntentPreviewInput,
  confirmationValue: DesignIntentPreviewConfirmation,
): DesignIntentCommitReceipt {
  const prepared = prepareInternal(value);
  let confirmation: Record<string, unknown>;
  try {
    confirmation = exactRecord(snapshot(confirmationValue), [
      "previewId", "beforeDocumentHash", "confirmationText",
    ] as const, "confirmation-mismatch");
  } catch {
    return refuse("confirmation-mismatch");
  }
  if (confirmation.previewId !== prepared.preview.previewId ||
      confirmation.beforeDocumentHash !== prepared.preview.projectChange.beforeDocumentHash ||
      confirmation.confirmationText !== prepared.preview.confirmationText) {
    return refuse("confirmation-mismatch");
  }
  return deepFreeze({
    format: "aura-design-intent-commit" as const,
    version: DESIGN_INTENT_COMMIT_VERSION,
    previewId: prepared.preview.previewId,
    committed: true as const,
    action: {
      type: "load" as const,
      doc: copyPlain(prepared.candidateDocument),
      label: prepared.preview.projectChange.actionLabel,
    },
    undo: {
      steps: 1 as const,
      restoresDocumentHash: prepared.preview.projectChange.beforeDocumentHash,
    },
    resultingDocumentHash: prepared.preview.projectChange.afterDocumentHash,
    projectHash: prepared.preview.projectChange.projectHash,
  });
}

export function cancelDesignIntentPreview(value: DesignIntentPreview): DesignIntentCancelReceipt {
  const preview = parsePreview(value);
  return deepFreeze({
    format: "aura-design-intent-preview-cancel" as const,
    version: DESIGN_INTENT_CANCEL_VERSION,
    previewId: preview.previewId,
    cancelled: true as const,
    writes: 0 as const,
  });
}
