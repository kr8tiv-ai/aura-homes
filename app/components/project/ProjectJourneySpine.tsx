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
  funding: { label: "Funding", next: "Prepare protected funding", href: "/concierge" },
  build: { label: "Build", next: "Plan delivery milestones", href: "/dashboard" },
  operate: { label: "Operate", next: "Prepare your home book", href: "/dashboard" },
};

export default function ProjectJourneySpine() {
  const { project, ready, problem } = useAuraProject();
  if (!ready) return <div className="project-spine project-spine-loading" aria-hidden />;
  if (!project) {
    return (
      <aside className="project-empty-rail" aria-label="Project status">
        <span>{problem ?? "No active project"}</span>
        <Link href="/start">Start with your goals <span aria-hidden>→</span></Link>
      </aside>
    );
  }
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
      <Link href={next.href} className="project-spine-next">Next · {next.next}</Link>
    </section>
  );
}
