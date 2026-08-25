/**
 * Canvas-first Guided Studio interaction contract.
 *
 * This module deliberately owns no project, geometry, selection history, or
 * persistence state. It describes how the shell addresses the canonical
 * BuilderDocument mutations that already exist. UI components may project
 * these values; they may not turn them into a second editor model.
 */

export const GUIDED_STUDIO_TASKS = [
  { id: "plans", label: "Plans", nextAction: "Choose or import a starting plan" },
  { id: "shell", label: "Shell", nextAction: "Set the footprint and roof" },
  { id: "rooms", label: "Rooms", nextAction: "Arrange the room program" },
  { id: "openings", label: "Openings", nextAction: "Place doors and windows" },
  { id: "site", label: "Site", nextAction: "Check the plan against the site" },
  { id: "performance", label: "Performance", nextAction: "Review comfort and constraints" },
  { id: "materials", label: "Materials", nextAction: "Choose assemblies and finishes" },
  { id: "review", label: "Review", nextAction: "Resolve blockers and export" },
] as const;

export type GuidedStudioTaskId = (typeof GUIDED_STUDIO_TASKS)[number]["id"];
export type StudioDevice = "desktop" | "tablet" | "phone";
export type StudioDeviceAction =
  | "review"
  | "measure"
  | "comment"
  | "light-correction"
  | "structural-edit"
  | "bulk-layout";

export interface StudioDeviceCapabilities {
  artifact: "canonical-plan";
  fullCadParity: boolean;
  actions: readonly StudioDeviceAction[];
}

const REVIEW_ACTIONS = ["review", "measure", "comment", "light-correction"] as const;

export function deviceCapabilities(device: StudioDevice): StudioDeviceCapabilities {
  if (device === "phone") {
    return {
      artifact: "canonical-plan",
      fullCadParity: false,
      actions: REVIEW_ACTIONS,
    };
  }
  return {
    artifact: "canonical-plan",
    fullCadParity: true,
    actions: [...REVIEW_ACTIONS, "structural-edit", "bulk-layout"],
  };
}

export type StudioSelectionKind = "volume" | "wall" | "room" | "opening" | "fixture" | "site";
export type StudioEditInput = "pointer" | "keyboard" | "exact" | "ai-accepted";
export type StudioEditValue = string | number | boolean | null | readonly number[];

export interface StudioEditIntent {
  target: { kind: StudioSelectionKind; id: string };
  operation: "set" | "move" | "add" | "remove";
  field?: string;
  value?: StudioEditValue;
  input: StudioEditInput;
}

export interface CanonicalStudioEdit {
  target: { kind: StudioSelectionKind; id: string };
  operation: StudioEditIntent["operation"];
  field?: string;
  value?: StudioEditValue;
}

/** Input method is provenance, not mutation semantics. */
export function canonicalEdit(intent: StudioEditIntent): CanonicalStudioEdit {
  const canonical: CanonicalStudioEdit = {
    target: { ...intent.target },
    operation: intent.operation,
  };
  if (intent.field !== undefined) canonical.field = intent.field;
  if (intent.value !== undefined) {
    canonical.value = Array.isArray(intent.value) ? [...intent.value] : intent.value;
  }
  return canonical;
}

const titleCase = (value: string): string =>
  value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;

export function studioHistoryLabel(intent: StudioEditIntent): string {
  const field = intent.field ? ` ${intent.field}` : "";
  return `${titleCase(intent.operation)} ${intent.target.kind}${field}`;
}

export type StudioEvidenceSeverity = "info" | "warning" | "blocking";
export type StudioClaimState = "design-intent" | "review-ready";

export interface StudioEvidenceItem {
  id: string;
  severity: StudioEvidenceSeverity;
  label: string;
}

export interface StudioEvidenceSummary {
  expanded: boolean;
  claimState: StudioClaimState;
  blockingCount: number;
  warningCount: number;
  visibleBlockingIds: string[];
  canAdvanceClaim: boolean;
  compactText: string;
}

export function evidenceSummary(
  items: readonly StudioEvidenceItem[],
  claimState: StudioClaimState,
  expanded: boolean,
): StudioEvidenceSummary {
  const blocking = items.filter((item) => item.severity === "blocking");
  const warningCount = items.filter((item) => item.severity === "warning").length;
  const blockerLabel = `${blocking.length} blocker${blocking.length === 1 ? "" : "s"}`;
  const warningLabel = `${warningCount} warning${warningCount === 1 ? "" : "s"}`;
  return {
    expanded,
    claimState,
    blockingCount: blocking.length,
    warningCount,
    visibleBlockingIds: blocking.map((item) => item.id),
    canAdvanceClaim: blocking.length === 0,
    compactText: `${blockerLabel} · ${warningLabel}`,
  };
}

export interface InvalidExactInput {
  accepted: false;
  raw: string;
  constraint: string;
  recoverable: true;
}

export function invalidExactInput(raw: string, constraint: string): InvalidExactInput {
  return { accepted: false, raw, constraint, recoverable: true };
}

export interface FailedProposalRecovery {
  accepted: false;
  preservedProjectHash: string;
  message: string;
  actions: readonly ["retry", "manual-start"];
}

export function failedProposalRecovery(
  currentProjectHash: string,
  message: string,
): FailedProposalRecovery {
  return {
    accepted: false,
    preservedProjectHash: currentProjectHash,
    message,
    actions: ["retry", "manual-start"],
  };
}
