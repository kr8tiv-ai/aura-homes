"use client";

import type { StudioCommandMeasurementBarState } from "@/lib/builder/guidedStudio";

export type GuidedStudioEditorMode = "guided" | "pro";

export interface GuidedStudioShellStep {
  id: string;
  label: string;
  hint: string;
}

interface GuidedStudioShellProps {
  projectName: string;
  editorMode: GuidedStudioEditorMode;
  steps: readonly GuidedStudioShellStep[];
  activeStepId: string;
  activeStepIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
  commandMeasurement: StudioCommandMeasurementBarState;
  planRouteOpen: boolean;
  onEditorMode: (mode: GuidedStudioEditorMode) => void;
  onStep: (stepId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onMeasurementFocus: () => void;
  onCommands: () => void;
  onContinuePro: () => void;
  onOpenDrawings: () => void;
  onCloseDrawings: () => void;
}

/**
 * Compact functional chrome around the existing builder state.
 *
 * The shell is deliberately controlled: it owns no project, selection,
 * history, geometry, persistence, or view state. Every action returns to the
 * existing BuilderApp handlers so the canvas and inspector remain projections
 * of the one durable document.
 */
export default function GuidedStudioShell({
  projectName,
  editorMode,
  steps,
  activeStepId,
  activeStepIndex,
  canUndo,
  canRedo,
  undoDescription,
  redoDescription,
  commandMeasurement,
  planRouteOpen,
  onEditorMode,
  onStep,
  onUndo,
  onRedo,
  onMeasurementFocus,
  onCommands,
  onContinuePro,
  onOpenDrawings,
  onCloseDrawings,
}: GuidedStudioShellProps) {
  const activeStep = steps[activeStepIndex] ?? steps[0];
  const previousStep = steps[activeStepIndex - 1];
  const nextStep = steps[activeStepIndex + 1];

  return (
    <section className="builder-mode-shell" aria-label="Project controls">
      <div className="builder-project-bar">
        <div className="builder-project-bar__identity">
          <span className="aura-label text-aura-emerald">Current project</span>
          <strong>{projectName}</strong>
          <small>Local autosave · design intent</small>
        </div>

        {!planRouteOpen ? (
          <div
            role="group"
            aria-label="Command and measurement"
            className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-md border aura-hairline px-3 py-2 text-xs"
          >
            <span className="min-w-0 truncate text-aura-text/65">{commandMeasurement.context}</span>
            {commandMeasurement.measurement ? (
              commandMeasurement.measurement.editable ? (
                <button
                  type="button"
                  aria-label={`Edit exact ${commandMeasurement.measurement.label}`}
                  onClick={onMeasurementFocus}
                  className="font-mono tabular-nums text-aura-text underline decoration-aura-emerald/60 underline-offset-4"
                >
                  <span className="mr-2 text-aura-text/55">{commandMeasurement.measurement.label}</span>
                  {commandMeasurement.measurement.value}{commandMeasurement.measurement.unit ? ` ${commandMeasurement.measurement.unit}` : ""}
                </button>
              ) : (
                <span className="font-mono tabular-nums text-aura-text">
                  <span className="mr-2 text-aura-text/55">{commandMeasurement.measurement.label}</span>
                  {commandMeasurement.measurement.value}{commandMeasurement.measurement.unit ? ` ${commandMeasurement.measurement.unit}` : ""}
                </span>
              )
            ) : null}
            {commandMeasurement.issue ? (
              <span className="basis-full text-aura-danger" role="status">
                {commandMeasurement.issue.constraint}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="builder-project-bar__actions" aria-label="Project history and commands">
          {planRouteOpen ? (
            <span className="builder-readonly-badge" role="status">Read-only drawings</span>
          ) : (
            <>
              <button aria-label={undoDescription ? `Undo ${undoDescription}` : "Undo last project change"} className="builder-shell-button" type="button" onClick={onUndo} disabled={!canUndo}>
                Undo
              </button>
              <button aria-label={redoDescription ? `Redo ${redoDescription}` : "Redo last project change"} className="builder-shell-button" type="button" onClick={onRedo} disabled={!canRedo}>
                Redo
              </button>
              <button aria-label="Open palette" className="builder-shell-button" type="button" onClick={onCommands}>
                Commands
              </button>
            </>
          )}
          <div role="group" aria-label="Editor mode" className="builder-mode-toggle">
            {(["guided", "pro"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={editorMode === mode}
                onClick={() => onEditorMode(mode)}
                className="builder-mode-toggle__button"
              >
                {mode === "guided" ? "Guided" : "Pro"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {editorMode === "guided" ? (
        <>
          <nav aria-label="Guided design steps" className="guided-step-nav builder-task-rail">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                aria-current={activeStepId === step.id ? "step" : undefined}
                aria-pressed={activeStepId === step.id}
                data-done={index < activeStepIndex || undefined}
                onClick={() => onStep(step.id)}
                className="guided-step"
              >
                <span aria-hidden>{index < activeStepIndex ? "✓" : String(index + 1).padStart(2, "0")}</span>
                {step.label}
              </button>
            ))}
          </nav>

          <div className="builder-task-summary guided-step-flow" data-plan-route={planRouteOpen ? "open" : "closed"}>
            <div className="builder-task-summary__copy" role="status">
              <span>{activeStep.label}</span>
              <p>{activeStep.hint}</p>
            </div>
            <div className="builder-task-summary__actions">
              <button
                className="builder-shell-button"
                type="button"
                disabled={!previousStep}
                onClick={() => previousStep && onStep(previousStep.id)}
              >
                Back
              </button>
              <span className="guided-step-flow__count">
                Step {activeStepIndex + 1} of {steps.length}
              </span>
              {nextStep ? (
                <button className="builder-shell-button builder-shell-button--loud" type="button" onClick={() => onStep(nextStep.id)}>
                  Next · {nextStep.label}
                </button>
              ) : (
                <button className="builder-shell-button builder-shell-button--loud" type="button" onClick={onContinuePro}>
                  Continue in Pro
                </button>
              )}
              <button
                className="builder-shell-button"
                type="button"
                onClick={planRouteOpen ? onCloseDrawings : onOpenDrawings}
              >
                {planRouteOpen ? `Back to ${activeStep.label}` : "Open the drawings"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
