"use client";

/* ---------------------------------------------------------------------
   THE PROJECT SPINE (SP01)

   The promise is "one portable project you own". The data model has kept
   that promise since AuraProject v2 — `stepStates`, `blockers`, and
   `recommendedNextAction` are all computed on every read — but until now
   only /dashboard ever showed them. Everywhere else you had to take the
   product's word for it. This row is that promise made visible, on every
   page where the project is actually worked.

   WHY IT IS A SECOND ROW rather than an edit to ProjectJourneySpine:
   that component is owned elsewhere this wave. It carries the project
   name and the eight step chips; this carries the four readings it never
   showed — stage status, the design fingerprint in plain words, open
   blockers, and the one recommended next action WITH its reason. The two
   both surface a "next" today (its pill says "Shape your home", this says
   "Choose or shape your home" — the same destination, worded twice). That
   duplication is real and is reported rather than silently patched by
   reaching into a file this node does not own.

   WHAT IT MUST NOT DO: appear without an active project (pinned by
   tests/navigation.spec.ts), repeat the project name (the journey spine
   owns it, and a second copy breaks strict-mode text queries elsewhere),
   open a modal, or headline a raw hex dump.
--------------------------------------------------------------------- */

import Link from "next/link";
import { useMemo, useState } from "react";
import * as m from "motion/react-m";
import type {
  AuraProject,
  JourneyStepId,
  JourneyStepStatus,
  ProjectBlocker,
} from "@/lib/project/document";
import { useAuraProject } from "./ProjectContext";

/** The routes that carry the spine. /dashboard is deliberately absent: it
 *  IS the full project record, so a miniature of itself above itself is
 *  density with no new information. */
export const SPINE_ROUTES = [
  "/start",
  "/build",
  "/land",
  "/contractors",
  "/budget",
  "/projects",
] as const;

const SPINE_ROUTE_SET: ReadonlySet<string> = new Set(SPINE_ROUTES);

/** SiteShell asks this — a path already normalized of its trailing slash. */
export function showsProjectSpine(pathname: string): boolean {
  return SPINE_ROUTE_SET.has(pathname);
}

/** One damped transition, inside the 150–250 ms band. Nothing else moves. */
export const SPINE_TRANSITION_SECONDS = 0.2;

/* The canonical journey order. `document.ts` keeps its own copy private,
   so this one is pinned against it in tests/project-spine.spec.ts rather
   than trusted — a silent divergence would mis-number every stage. */
export const SPINE_STEPS: readonly JourneyStepId[] = [
  "requirements",
  "design",
  "land",
  "team",
  "quotes",
  "funding",
  "build",
  "operate",
];

const STEP_LABEL: Record<JourneyStepId, string> = {
  requirements: "Requirements",
  design: "Design",
  land: "Land",
  team: "Team",
  quotes: "Quotes",
  funding: "Funding",
  build: "Build",
  operate: "Operate",
};

/* Same words /dashboard uses for the same states — one vocabulary. */
const STATUS_LABEL: Record<JourneyStepStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
  complete: "Confirmed",
};

const STATUS_TONE: Record<JourneyStepStatus, string> = {
  "not-started": "text-aura-text/65",
  "in-progress": "text-aura-teal",
  blocked: "text-aura-violet",
  complete: "text-aura-emerald",
};

/** Where a step is actually worked. Build and Operate are tracked on the
 *  project record, so that is where their link goes — never nowhere. */
function stepHref(stepId: JourneyStepId, journey: AuraProject["journey"]): string {
  switch (stepId) {
    case "requirements": return "/start";
    case "design": return "/build";
    case "land": return "/land";
    case "team": return journey === "buy-finished-home" ? "/buy" : "/contractors";
    case "quotes": return "/budget";
    case "funding": return "/budget";
    default: return "/dashboard";
  }
}

/* ---------------------------------------------------------------------
   DESIGN FINGERPRINT, IN PLAIN WORDS

   A design is "saved" when the design step is confirmed AND its recorded
   basis hash still equals the current document hash. Everything else is
   graded by the evidence that actually survives in the document:

   · a basis hash that no longer matches  -> there WAS a save, and the
     design has moved since it. "Changed since last save."
   · no basis hash but the step has been worked (`withProjectDesign` nulls
     the basis on every real edit) -> there is unconfirmed design work, and
     no evidence a save ever happened. "Unsaved changes" — not "changed
     since last save", which would imply a save this project cannot prove.
   · no basis hash and the step is untouched -> "Not saved yet."

   The words are the headline; the fingerprint is a short, truncated
   companion. The full hash lives in the title, never as the headline.
--------------------------------------------------------------------- */
export type DesignSaveState = "saved" | "changed" | "unsaved" | "never";

export interface DesignReading {
  state: DesignSaveState;
  headline: string;
  shortHash: string;
  note: string;
}

export function readDesignSaveState(project: AuraProject): DesignReading {
  const hash = project.design.documentHash;
  const step = project.stepStates.design;
  const shortHash = `${hash.slice(0, 10)}…`;

  if (step.basisHash !== null && step.basisHash === hash) {
    return {
      state: "saved",
      headline: "Saved",
      shortHash,
      note: `Design fingerprint ${hash}. The design step is confirmed against this exact fingerprint.`,
    };
  }
  if (step.basisHash !== null) {
    return {
      state: "changed",
      headline: "Changed since last save",
      shortHash,
      note: `Design fingerprint ${hash}. The design step was saved at ${step.basisHash.slice(0, 10)}…, and the design has changed since.`,
    };
  }
  if (step.status === "not-started") {
    return {
      state: "never",
      headline: "Not saved yet",
      shortHash,
      note: `Design fingerprint ${hash}. No design work has been recorded yet. The project itself is already stored in this browser.`,
    };
  }
  return {
    state: "unsaved",
    headline: "Unsaved changes",
    shortHash,
    note: `Design fingerprint ${hash}. This design has not been confirmed as a saved step. The work itself is already stored in this browser.`,
  };
}

export interface SpineStage {
  stepId: JourneyStepId;
  /** 1-based position among the eight steps. */
  position: number;
  label: string;
  status: JourneyStepStatus;
  statusLabel: string;
  text: string;
}

/** The stage the project is standing on: the recommended step when there
 *  is one, otherwise the first unconfirmed step, otherwise the last. This
 *  mirrors `projectJourney()` without paying for a second full document
 *  validation and re-hash on every render — the journey spine already
 *  pays that once on the same page. */
export function readSpineStage(project: AuraProject): SpineStage {
  const stepId = project.recommendedNextAction?.stepId
    ?? SPINE_STEPS.find((id) => project.stepStates[id].status !== "complete")
    ?? SPINE_STEPS[SPINE_STEPS.length - 1];
  const status = project.stepStates[stepId].status;
  const position = SPINE_STEPS.indexOf(stepId) + 1;
  const label = STEP_LABEL[stepId];
  const statusLabel = STATUS_LABEL[status];
  return {
    stepId,
    position,
    label,
    status,
    statusLabel,
    text: `${String(position).padStart(2, "0")} of ${String(SPINE_STEPS.length).padStart(2, "0")} · ${label} · ${statusLabel}`,
  };
}

export interface SpineNextAction {
  label: string;
  reason: string;
  href: string;
}

/** The ONE recommended action, as a destination. Null means every step is
 *  confirmed — which is stated plainly rather than invented into a task. */
export function readSpineNextAction(project: AuraProject): SpineNextAction | null {
  const action = project.recommendedNextAction;
  if (!action) return null;
  return { label: action.label, reason: action.reason, href: stepHref(action.stepId, project.journey) };
}

export function openProjectBlockers(project: AuraProject): ProjectBlocker[] {
  return project.blockers.filter((blocker) => blocker.resolvedAtISO === null);
}

export interface SpineReading {
  stage: SpineStage;
  design: DesignReading;
  blockers: ProjectBlocker[];
  next: SpineNextAction | null;
}

export function readProjectSpine(project: AuraProject): SpineReading {
  return {
    stage: readSpineStage(project),
    design: readDesignSaveState(project),
    blockers: openProjectBlockers(project),
    next: readSpineNextAction(project),
  };
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-label text-aura-faint">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function ProjectSpine() {
  const { project, ready } = useAuraProject();
  const [showBlockers, setShowBlockers] = useState(false);
  const reading = useMemo(() => (project ? readProjectSpine(project) : null), [project]);

  /* The contract pinned by tests/navigation.spec.ts: no project, no spine.
     Not a placeholder, not an empty rail — nothing. */
  if (!ready || !project || !reading) return null;

  const { stage, design, blockers, next } = reading;

  return (
    <section
      aria-label="Project status"
      data-project-spine=""
      data-spine-step={stage.stepId}
      data-spine-design={design.state}
      data-spine-blockers={String(blockers.length)}
      className="project-status-spine mt-2 rounded-xl border border-hairline bg-aura-panel px-3 py-2 text-xs shadow-aura-1"
    >
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <Cell label="Stage">
          <span className="truncate">
            <span className="font-mono tabular-nums text-aura-text/70">
              {String(stage.position).padStart(2, "0")} of {String(SPINE_STEPS.length).padStart(2, "0")}
            </span>{" "}
            <span className="font-semibold">{stage.label}</span>{" "}
            <span className={STATUS_TONE[stage.status]}>· {stage.statusLabel}</span>
          </span>
        </Cell>

        <Cell label="Design">
          <span className="truncate" title={design.note}>
            <span className={design.state === "saved" ? "text-aura-emerald" : "text-aura-text/75"}>
              {design.headline}
            </span>{" "}
            <span className="font-mono text-[0.62rem] text-aura-text/55">{design.shortHash}</span>
          </span>
        </Cell>

        <Cell label="Blockers">
          {blockers.length === 0 ? (
            /* A declared zero, never a blank that could read as "unknown". */
            <span className="text-aura-text/65">0 open</span>
          ) : (
            <button
              type="button"
              aria-expanded={showBlockers}
              aria-controls="project-spine-blockers"
              aria-label={`${blockers.length} open blocker${blockers.length === 1 ? "" : "s"}`}
              onClick={() => setShowBlockers((value) => !value)}
              className="min-h-6 rounded border border-aura-violet/50 px-2 py-0.5 font-semibold text-aura-violet transition-opacity duration-200 hover:opacity-80 motion-reduce:transition-none"
            >
              {blockers.length} open
            </button>
          )}
        </Cell>

        <div className="ml-auto flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-label text-aura-faint">
            Next
          </span>
          {next ? (
            <Link
              href={next.href}
              title={next.reason}
              data-spine-next=""
              className="truncate font-semibold text-aura-teal hover:text-aura-emerald"
            >
              {next.label} &rarr;
            </Link>
          ) : (
            <span className="text-aura-emerald">Every step is confirmed</span>
          )}
        </div>
      </div>

      {showBlockers && blockers.length > 0 ? (
        <m.ul
          id="project-spine-blockers"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: SPINE_TRANSITION_SECONDS, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 space-y-1 border-t border-hairline pt-2"
        >
          {blockers.map((blocker) => (
            <li key={blocker.id} className="flex gap-2 leading-relaxed">
              <span className="shrink-0 font-mono text-[0.5rem] uppercase tracking-label text-aura-faint">
                {STEP_LABEL[blocker.stepId]}
              </span>
              <span className="text-aura-text/75">{blocker.summary}</span>
            </li>
          ))}
        </m.ul>
      ) : null}
    </section>
  );
}
