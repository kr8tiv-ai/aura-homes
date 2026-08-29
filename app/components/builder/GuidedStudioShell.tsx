"use client";

import {
  deviceCapabilityMessage,
  type StudioCommandMeasurementBarState,
} from "@/lib/builder/guidedStudio";

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
  reviewNote: string;
  onEditorMode: (mode: GuidedStudioEditorMode) => void;
  onStep: (stepId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onMeasurementFocus: () => void;
  onCommands: () => void;
  onContinuePro: () => void;
  onOpenDrawings: () => void;
  onCloseDrawings: () => void;
  onReviewNote: (note: string) => void;
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
  reviewNote,
  onEditorMode,
  onStep,
  onUndo,
  onRedo,
  onMeasurementFocus,
  onCommands,
  onContinuePro,
  onOpenDrawings,
  onCloseDrawings,
  onReviewNote,
}: GuidedStudioShellProps) {
  const activeStep = steps[activeStepIndex] ?? steps[0];
  const previousStep = steps[activeStepIndex - 1];
  const nextStep = steps[activeStepIndex + 1];
  const phoneScope = deviceCapabilityMessage("phone");

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
          <aside
            aria-label="Phone workspace scope"
            className="builder-device-contract"
            data-device-contract="phone"
            role="status"
          >
            <strong>{phoneScope.heading}</strong>
            <span>{phoneScope.summary}</span>
            {phoneScope.limitation ? <span>{phoneScope.limitation}</span> : null}
          </aside>

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

          {activeStepId === "review" && !planRouteOpen ? (
            <div className="builder-review-note" data-guided-review-note>
              <div className="builder-review-note__copy">
                <label htmlFor="guided-review-note">Review note</label>
                <p id="guided-review-note-help">
                  Saved in this project&apos;s design brief and carried verbatim to the design request.
                </p>
              </div>
              <textarea
                id="guided-review-note"
                aria-describedby="guided-review-note-help guided-review-note-count"
                maxLength={500}
                rows={3}
                value={reviewNote}
                onChange={(event) => onReviewNote(event.currentTarget.value)}
              />
              <small id="guided-review-note-count">
                {reviewNote.length}/500 · Canonical project history
              </small>
            </div>
          ) : null}
        </>
      ) : null}
      <style jsx>{`
        .builder-device-contract {
          display: none;
          min-width: 0;
          gap: 0.25rem;
          margin-top: 0.55rem;
          border: 1px solid rgb(var(--tone-emerald) / 0.42);
          border-radius: 0.7rem;
          padding: 0.65rem 0.75rem;
          background: rgb(var(--tone-emerald) / 0.055);
        }
        .builder-device-contract strong {
          font-family: var(--st-mono-font);
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--st-emerald-deep);
        }
        .builder-device-contract span {
          min-width: 0;
          color: var(--st-ink-dim);
          font-size: 0.72rem;
          line-height: 1.45;
        }
        .builder-review-note {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(10rem, 0.7fr) minmax(14rem, 1.3fr) auto;
          align-items: end;
          gap: 0.65rem;
          margin-top: 0.55rem;
          padding-top: 0.55rem;
          border-top: 1px solid rgb(var(--tone-ink) / var(--hair-soft-alpha));
        }
        .builder-review-note__copy {
          min-width: 0;
        }
        .builder-review-note__copy label {
          display: block;
          font-family: var(--st-mono-font);
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--st-ink);
        }
        .builder-review-note__copy p,
        .builder-review-note small {
          color: var(--st-faint);
          font-size: 0.64rem;
          line-height: 1.45;
        }
        .builder-review-note textarea {
          min-width: 0;
          min-height: 5rem;
          resize: vertical;
          border: 1px solid rgb(var(--tone-ink) / var(--hair-alpha));
          border-radius: 0.55rem;
          padding: 0.65rem 0.75rem;
          color: var(--st-ink);
          background: rgb(var(--tone-base) / 0.5);
        }
        .builder-review-note textarea:focus-visible {
          outline: var(--focus-ring-width) solid var(--focus-ring-color);
          outline-offset: var(--focus-ring-offset);
        }
        @media (max-width: 720px) {
          .builder-device-contract {
            display: grid;
          }
          .builder-review-note {
            grid-template-columns: minmax(0, 1fr);
            align-items: stretch;
          }
          .builder-review-note textarea {
            width: 100%;
          }
          .builder-review-note small {
            justify-self: start;
          }
        }
      `}</style>
    </section>
  );
}
