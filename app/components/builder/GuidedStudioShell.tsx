"use client";

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
  planRouteOpen: boolean;
  onEditorMode: (mode: GuidedStudioEditorMode) => void;
  onStep: (stepId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onCommands: () => void;
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
  planRouteOpen,
  onEditorMode,
  onStep,
  onUndo,
  onRedo,
  onCommands,
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

        <div className="builder-project-bar__actions" aria-label="Project history and commands">
          <button className="builder-shell-button" type="button" onClick={onUndo} disabled={!canUndo}>
            Undo
          </button>
          <button className="builder-shell-button" type="button" onClick={onRedo} disabled={!canRedo}>
            Redo
          </button>
          <button className="builder-shell-button" type="button" onClick={onCommands}>
            Commands
          </button>
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

          <div className="builder-task-summary">
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
              {nextStep ? (
                <button className="builder-shell-button builder-shell-button--loud" type="button" onClick={() => onStep(nextStep.id)}>
                  Next · {nextStep.label}
                </button>
              ) : null}
              <button
                className="builder-shell-button"
                type="button"
                onClick={planRouteOpen ? onCloseDrawings : onOpenDrawings}
              >
                {planRouteOpen ? `Back to ${activeStep.label}` : "Drawings · A3"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
