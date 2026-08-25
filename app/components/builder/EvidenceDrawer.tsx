"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { BuilderDocument } from "@/lib/builder/document";
import { evidenceSummary, type StudioEvidenceItem } from "@/lib/builder/guidedStudio";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type ProjectBudgetScenario,
} from "@/lib/builder/projectBudget";
import { readDesignReadiness } from "@/lib/builder/readiness";
import type { SpecParcelCheck } from "@/lib/builder/toPlan";

export type EvidenceDrawingState = "not-generated" | "stale" | "current";

type EvidenceSection = "blockers" | "cost" | "provenance" | "technical" | "copilot" | "export";

const DRAWING_LABEL: Readonly<Record<EvidenceDrawingState, string>> = {
  "not-generated": "Drawing set not generated",
  stale: "Drawing set is stale",
  current: "Drawing set is current",
};

const SECTION_ID: Readonly<Record<EvidenceSection, string>> = {
  blockers: "builder-evidence-blockers",
  cost: "builder-evidence-cost",
  provenance: "builder-evidence-provenance",
  technical: "builder-evidence-technical",
  copilot: "builder-evidence-copilot",
  export: "builder-evidence-export",
};

interface EvidenceDrawerProps {
  document: BuilderDocument;
  parcelCheck: SpecParcelCheck | null;
  region: string;
  municipality: string;
  scenario?: ProjectBudgetScenario;
  budgetCapCad: number | null;
  drawingState: EvidenceDrawingState;
  technicalWarnings: readonly string[];
  activeTaskLabel: string;
  renderCostConstraints: () => ReactNode;
  renderTaskEvidence: () => ReactNode;
  renderCoPilot: () => ReactNode;
}

/**
 * Progressive evidence around the canonical builder document.
 *
 * The collapsed shell is not a second readiness model. It calls the same
 * budget and readiness functions as the live read-out, then projects their
 * state through `evidenceSummary`, whose contract forbids collapse from
 * changing a claim or dropping blocker identities. The three render functions
 * are invoked only while expanded, so cost, guidance and co-pilot work is not
 * merely hidden after being mounted.
 */
export default function EvidenceDrawer({
  document,
  parcelCheck,
  region,
  municipality,
  scenario,
  budgetCapCad,
  drawingState,
  technicalWarnings,
  activeTaskLabel,
  renderCostConstraints,
  renderTaskEvidence,
  renderCoPilot,
}: EvidenceDrawerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<EvidenceSection | null>(null);

  const priced = useMemo(() => {
    try {
      return {
        ok: true as const,
        budget: createProjectBudget({
          document,
          scenario: scenario ?? defaultProjectBudgetScenario(),
          region,
          municipality,
          budgetCapCad,
        }),
      };
    } catch (error) {
      return {
        ok: false as const,
        problem: error instanceof Error ? error.message : String(error),
      };
    }
  }, [budgetCapCad, document, municipality, region, scenario]);

  const readiness = useMemo(
    () => (priced.ok ? readDesignReadiness({ document, budget: priced.budget, parcelCheck }) : null),
    [document, parcelCheck, priced],
  );

  const evidenceItems = useMemo<readonly StudioEvidenceItem[]>(() => {
    const items: StudioEvidenceItem[] = [];
    if (readiness) {
      readiness.gaps.forEach((gap) => {
        items.push({ id: gap.id, severity: "blocking", label: gap.need });
      });
    } else {
      items.push({
        id: "unpriced",
        severity: "blocking",
        label: `The current design could not be priced: ${priced.problem}`,
      });
    }
    technicalWarnings.forEach((warning, index) => {
      items.push({ id: `technical-${index}`, severity: "warning", label: warning });
    });
    if (drawingState !== "current") {
      items.push({
        id: `drawing-${drawingState}`,
        severity: "warning",
        label: DRAWING_LABEL[drawingState],
      });
    }
    items.push({
      id: "provenance",
      severity: "info",
      label: document.planOrigin
        ? `Started from ${document.planOrigin.templateTitle}`
        : "No catalog plan origin is recorded",
    });
    return items;
  }, [document.planOrigin, drawingState, priced, readiness, technicalWarnings]);

  const summary = useMemo(
    () => evidenceSummary(evidenceItems, readiness?.state ?? "design-intent", open),
    [evidenceItems, open, readiness?.state],
  );

  useEffect(() => {
    if (!open || pendingFocus.current === null) return;
    const id = SECTION_ID[pendingFocus.current];
    pendingFocus.current = null;
    rootRef.current?.querySelector<HTMLElement>(`#${id}`)?.focus();
  }, [open]);

  const openAt = useCallback(
    (section: EvidenceSection) => {
      if (open) {
        rootRef.current?.querySelector<HTMLElement>(`#${SECTION_ID[section]}`)?.focus();
        return;
      }
      pendingFocus.current = section;
      setOpen(true);
    },
    [open],
  );

  const claimLabel = summary.claimState === "review-ready" ? "Ready for professional review" : "Design intent";
  const geometryLabel = document.geometry.kind === "building-graph" ? "Planar graph" : "Legacy massing";
  const sourceLabel = document.planOrigin?.templateTitle ?? "Aura editor project";

  return (
    <aside
      ref={rootRef}
      className="builder-evidence-region"
      aria-label="Project evidence"
      data-evidence-open={open}
      data-claim-state={summary.claimState}
      data-blocking-count={summary.blockingCount}
      data-warning-count={summary.warningCount}
      data-drawing-state={drawingState}
    >
      <header className="builder-evidence-region__head">
        <div>
          <p className="aura-label">Project evidence</p>
          <strong>{claimLabel}</strong>
          <small>{summary.compactText} · {sourceLabel} · {DRAWING_LABEL[drawingState]}</small>
        </div>
        <button
          type="button"
          className="builder-shell-button"
          aria-expanded={open}
          aria-controls="builder-evidence-content"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? "Collapse evidence" : "Open evidence"}
        </button>
      </header>

      <div className="builder-evidence-region__summary" role="status" aria-live="polite">
        <span data-alert={summary.blockingCount > 0 ? "true" : undefined}>
          {summary.blockingCount} open blocker{summary.blockingCount === 1 ? "" : "s"}
        </span>
        <span>{priced.ok ? "Cost range current" : "Cost range unavailable"}</span>
        <span>{geometryLabel}</span>
        <span>{DRAWING_LABEL[drawingState]}</span>
      </div>

      <nav className="builder-evidence-region__nav" aria-label="Evidence sections">
        <button type="button" onClick={() => openAt("blockers")}>
          Open {summary.blockingCount} blocker{summary.blockingCount === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={() => openAt("cost")}>Cost and constraints</button>
        <button type="button" onClick={() => openAt("provenance")}>Project provenance</button>
        <button type="button" onClick={() => openAt("technical")}>Technical status</button>
        <button type="button" onClick={() => openAt("copilot")}>Co-pilot evidence</button>
        <button type="button" onClick={() => openAt("export")}>Export readiness</button>
      </nav>

      {open ? (
        <div id="builder-evidence-content" className="builder-evidence-region__content">
          <section
            id={SECTION_ID.blockers}
            className="builder-evidence-section"
            aria-label="Blocking evidence"
            tabIndex={-1}
          >
            <p className="aura-label">Blocking evidence</p>
            {summary.blockingCount > 0 ? (
              <ul>
                {evidenceItems
                  .filter((item) => item.severity === "blocking")
                  .map((item) => <li key={item.id}>{item.label}</li>)}
              </ul>
            ) : (
              <p>No open blocker is recorded. This remains a study for professional review, not an approval.</p>
            )}
          </section>

          <section
            id={SECTION_ID.cost}
            className="builder-evidence-section"
            aria-label="Cost and constraints"
            tabIndex={-1}
          >
            {renderCostConstraints()}
          </section>

          <section
            id={SECTION_ID.provenance}
            className="builder-evidence-section"
            aria-label="Project provenance"
            tabIndex={-1}
          >
            <p className="aura-label">Project provenance</p>
            {document.planOrigin ? (
              <dl>
                <div><dt>Plan source</dt><dd>{document.planOrigin.templateTitle}</dd></div>
                <div><dt>Cost basis</dt><dd>{document.planOrigin.costBasis.label}</dd></div>
                <div><dt>Basis status</dt><dd>{document.planOrigin.costBasis.status}</dd></div>
                <div><dt>Evidence note</dt><dd>{document.planOrigin.costBasis.note}</dd></div>
              </dl>
            ) : (
              <p>No catalog plan origin is recorded. The complete versioned Aura project remains the canonical source for this study.</p>
            )}
          </section>

          <section
            id={SECTION_ID.technical}
            className="builder-evidence-section"
            aria-label="Technical status"
            tabIndex={-1}
          >
            <p className="aura-label">Technical status</p>
            <dl>
              <div><dt>Geometry</dt><dd>{geometryLabel}</dd></div>
              <div><dt>Held for repair</dt><dd>{document.quarantine.entries.length}</dd></div>
              <div><dt>Current warnings</dt><dd>{technicalWarnings.length}</dd></div>
              <div><dt>Claim state</dt><dd>{claimLabel}</dd></div>
            </dl>
            {technicalWarnings.length > 0 ? (
              <ul>{technicalWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            ) : null}
          </section>

          <section
            id={SECTION_ID.copilot}
            className="builder-evidence-section"
            aria-label="Co-pilot evidence"
            tabIndex={-1}
          >
            {renderCoPilot()}
          </section>

          <section
            id={SECTION_ID.export}
            className="builder-evidence-section"
            aria-label="Export readiness"
            tabIndex={-1}
          >
            <p className="aura-label">Export readiness</p>
            <strong>{DRAWING_LABEL[drawingState]}</strong>
            <p>
              {drawingState === "current"
                ? "The generated drawing set describes the current project revision. Professional review is still required."
                : drawingState === "stale"
                  ? "The project changed after the drawing set was generated. Redraw it from Review before handing it off."
                  : "Generate the drawing set from Review when this study is ready to hand to a professional."}
            </p>
          </section>

          <section className="builder-evidence-section" aria-label={`${activeTaskLabel} task evidence`}>
            <p className="aura-label">{activeTaskLabel} task evidence</p>
            {renderTaskEvidence()}
          </section>
        </div>
      ) : null}
    </aside>
  );
}
