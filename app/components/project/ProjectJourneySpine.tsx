"use client";

import Link from "next/link";
import { projectJourney, type JourneyStepId } from "@/lib/project/document";
import { useAuraProject } from "./ProjectContext";

const STEP_META: Record<JourneyStepId, { label: string; next: string; href: string }> = {
  requirements: { label: "Requirements", next: "Finish your brief", href: "/start" },
  design: { label: "Design", next: "Shape your home", href: "/build" },
  land: { label: "Land", next: "Find suitable land", href: "/land" },
  team: { label: "Team", next: "Build your team", href: "/contractors" },
  quotes: { label: "Quotes", next: "Compare real quotes", href: "/budget" },
  /* Funding lives with the numbers in /budget — never the legacy concierge. */
  funding: { label: "Funding", next: "Plan your funding", href: "/budget" },
  build: { label: "Build", next: "Plan delivery milestones", href: "/dashboard" },
  operate: { label: "Operate", next: "Prepare your home book", href: "/dashboard" },
};

export default function ProjectJourneySpine() {
  const { project, ready } = useAuraProject();
  /* The spine appears ONLY inside an active project workspace. What the old
     component did without one — a loading placeholder, and an empty rail
     that prompted "No active project · Start with your goals" (also the
     surface where a storage `problem` was reported) — is deliberately gone
     from global chrome; /projects remains the place that reports storage
     state and offers the start path. */
  if (!ready || !project) return null;
  const journey = projectJourney(project);
  const next = STEP_META[journey.next.id];
  return (
    <section className="project-spine" aria-label="Active project">
      <div className="project-spine-title">
        <span className="project-spine-kicker">Your project</span>
        <strong>{project.name}</strong>
      </div>
      <nav aria-label="Project journey" className="project-spine-steps">
        {journey.steps.map((step, index) => {
          const meta = STEP_META[step.id];
          const current = step.id === journey.next.id;
          return (
            <Link
              key={step.id}
              href={meta.href}
              className={`${step.complete ? "is-complete" : ""}${current ? " is-next" : ""}`}
              aria-current={current ? "step" : undefined}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {meta.label}
            </Link>
          );
        })}
      </nav>
      {/* The "Next · …" pill lived here until Aug 14, 2026, when the status
          spine below started rendering the document's own
          recommendedNextAction — the same destination, plus the reason it is
          recommended. Two pills pointing one place is the product saying the
          same thing twice, which is the opposite of calm. One affordance,
          the one that explains itself. */}
    </section>
  );
}
