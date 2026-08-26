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

export interface StudioInspectorTool {
  label: string;
  guidance: string;
  actions: readonly string[];
}

export interface StudioInspectorDimension {
  label: string;
  value: string;
}

export interface StudioInspectorSelection {
  kind: StudioSelectionKind | "vertex";
  id: string;
  identity: string;
  dimensions: readonly StudioInspectorDimension[];
  placement: string;
  actions: readonly string[];
}

export interface StudioInspectorInput {
  task: { label: string; nextAction: string };
  tool?: StudioInspectorTool | null;
  selection?: StudioInspectorSelection | null;
  invalid?: InvalidExactInput | null;
}

export type StudioInspectorState =
  | {
      state: "empty" | "tool";
      heading: string;
      description: string;
      actions: readonly string[];
      dimensions: readonly [];
      placement: null;
    }
  | {
      state: "selection";
      heading: string;
      description: string;
      selectionKind: StudioInspectorSelection["kind"];
      selectionId: string;
      actions: readonly string[];
      dimensions: readonly StudioInspectorDimension[];
      placement: string;
    }
  | {
      state: "invalid";
      heading: string;
      description: string;
      selectionKind: StudioInspectorSelection["kind"] | null;
      selectionId: string | null;
      actions: readonly ["Edit the value", "Undo"];
      dimensions: readonly StudioInspectorDimension[];
      placement: string | null;
      raw: string;
      constraint: string;
      recoverable: true;
    };

/**
 * One read-only projection of the current task, tool, selection and refusal.
 *
 * Priority is deliberate: a refusal must stay visible over the selection that
 * produced it; a selection is more specific than the active tool; and an idle
 * task still says what to do next. Arrays are copied so no inspector consumer
 * can mutate the editor's transient state by reference.
 */
export function contextualInspectorState(input: StudioInspectorInput): StudioInspectorState {
  const selection = input.selection ?? null;
  if (input.invalid) {
    return {
      state: "invalid",
      heading: `Check ${selection?.identity ?? input.tool?.label ?? input.task.label}`,
      description: "The project was not changed. Correct the value or undo the previous edit.",
      selectionKind: selection?.kind ?? null,
      selectionId: selection?.id ?? null,
      dimensions: selection ? selection.dimensions.map((dimension) => ({ ...dimension })) : [],
      placement: selection?.placement ?? null,
      actions: ["Edit the value", "Undo"],
      raw: input.invalid.raw,
      constraint: input.invalid.constraint,
      recoverable: true,
    };
  }
  if (selection) {
    return {
      state: "selection",
      heading: selection.identity,
      description: `${selection.kind} selected`,
      selectionKind: selection.kind,
      selectionId: selection.id,
      dimensions: selection.dimensions.map((dimension) => ({ ...dimension })),
      placement: selection.placement,
      actions: [...selection.actions],
    };
  }
  if (input.tool) {
    return {
      state: "tool",
      heading: input.tool.label,
      description: input.tool.guidance,
      actions: [...input.tool.actions],
      dimensions: [],
      placement: null,
    };
  }
  return {
    state: "empty",
    heading: "Nothing selected",
    description: input.task.nextAction,
    actions: [input.task.nextAction],
    dimensions: [],
    placement: null,
  };
}

export interface StudioCommandMeasurement {
  label: string;
  value: string;
  unit: string;
  editable: boolean;
}

export interface StudioCommandMeasurementBarState {
  context: string;
  measurement: StudioCommandMeasurement | null;
  issue: { raw: string; constraint: string } | null;
}

const splitMeasuredValue = (source: string): { value: string; unit: string } | null => {
  const match = /^\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*(.*?)\s*$/.exec(source);
  if (!match) return null;
  return { value: match[1], unit: match[2] };
};

/**
 * Compact, read-only projection for UX04's project bar.
 *
 * It deliberately receives whether the CURRENT surface exposes an existing
 * exact field. That keeps a selected 3D storey measurable but never pretends
 * its recovery projection owns a numeric editor. The value remains a string so
 * a refused draft can stay byte-for-byte repairable rather than being parsed,
 * clamped, or written anywhere by this projection.
 */
export function commandMeasurementBarState({
  inspector,
  exactFieldAvailable,
}: {
  inspector: StudioInspectorState;
  exactFieldAvailable: boolean;
}): StudioCommandMeasurementBarState {
  const dimension = inspector.dimensions[0];
  const measured = dimension ? splitMeasuredValue(dimension.value) : null;
  const issue = inspector.state === "invalid"
    ? { raw: inspector.raw, constraint: inspector.constraint }
    : null;
  return {
    context: inspector.heading,
    measurement: dimension && measured
      ? {
          label: dimension.label,
          value: issue?.raw ?? measured.value,
          unit: measured.unit,
          editable: exactFieldAvailable,
        }
      : null,
    issue,
  };
}

/** Human project language for an internal history label; identifiers never leak into chrome. */
export function describeHistoryAction(label: string | null): string | null {
  if (!label) return null;
  if (label.startsWith("graph:vertex:")) return "Move a plan point";
  if (label.startsWith("phrase ")) return "Apply a command";
  if (label === "geometry:convert-to-graph") return "Convert to an editable plan";
  if (label.startsWith("graph:add-")) return "Add to the plan";
  if (label.startsWith("surface")) return "Change a material";
  if (label.startsWith("fixture")) return "Edit a fixture";
  if (label.startsWith("opening")) return "Edit an opening";
  if (label.startsWith("plan:")) return "Choose a plan";
  if (label.includes("project") || label === "share-link") return "Open a project";
  return "Change the project";
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
