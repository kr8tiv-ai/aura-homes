"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { createAuraProject, withProjectStepState, type ProjectJourney } from "@/lib/project/document";
import { useAuraProject } from "./ProjectContext";

const JOURNEYS: Array<{ id: ProjectJourney; title: string; copy: string; detail: string }> = [
  {
    id: "find-land-build",
    title: "Find land + build",
    copy: "Design first, then find parcels and builders that fit it.",
    detail: "Best for the Alberta pilot",
  },
  {
    id: "build-on-owned-land",
    title: "Build on my land",
    copy: "Start with your site and turn a design into comparable scopes.",
    detail: "Parcel facts become constraints",
  },
  {
    id: "buy-finished-home",
    title: "Buy a finished home",
    copy: "Compare manufacturers, delivery readiness, and honest payment paths.",
    detail: "No marketplace theatre",
  },
];

function newProjectId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `project-${crypto.randomUUID()}`
    : `project-${Date.now().toString(36)}`;
}

export default function ProjectIntake() {
  const router = useRouter();
  const { save } = useAuraProject();
  const [hydrated, setHydrated] = useState(false);
  const [journey, setJourney] = useState<ProjectJourney>("find-land-build");
  const [name, setName] = useState("My Aura home");
  const [municipality, setMunicipality] = useState("");
  const [budget, setBudget] = useState("");
  const [household, setHousehold] = useState("2");
  const [timeline, setTimeline] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => setHydrated(true), []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setProblem(null);
    try {
      const now = new Date();
      const initial = createAuraProject({ id: newProjectId(), name, journey, document: defaultBuilderDocument(), now });
      const max = budget.trim() ? Number(budget) : null;
      const people = household.trim() ? Number(household) : null;
      const filled = {
        ...initial,
        requirements: {
          ...initial.requirements,
          location: { ...initial.requirements.location, municipality: municipality.trim() },
          budgetCad: { min: null, max: max !== null && Number.isFinite(max) ? max : null },
          householdSize: people !== null && Number.isInteger(people) && people > 0 ? people : null,
          timeline: timeline.trim(),
          completedAtISO: now.toISOString(),
        },
      };
      /* The brief this form just collected IS the requirements step, so the
         step is confirmed through the same API everything else uses — which
         hashes the final requirements as the step's basis and moves the
         recommended next action forward. Without this, the first thing a new
         project tells its owner is "Next · Finish your brief". */
      const project = withProjectStepState(filled, "requirements", "complete", now);
      await save(project);
      router.push(journey === "buy-finished-home" ? "/buy" : "/build");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={create} className="project-intake">
      <fieldset>
        <legend>Choose your route</legend>
        <div className="project-intake-routes">
          {JOURNEYS.map((option) => (
            <button
              type="button"
              key={option.id}
              aria-pressed={journey === option.id}
              disabled={!hydrated}
              onClick={() => setJourney(option.id)}
            >
              <span>{option.detail}</span>
              <strong>{option.title}</strong>
              <p>{option.copy}</p>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="project-intake-fields">
        <label>Project name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={96} required /></label>
        <label>Municipality or region<input value={municipality} onChange={(event) => setMunicipality(event.target.value)} placeholder="Foothills County" /></label>
        <label>Maximum working budget<input type="number" value={budget} onChange={(event) => setBudget(event.target.value)} min="0" step="1000" inputMode="numeric" /></label>
        <label>People in the home<input type="number" value={household} onChange={(event) => setHousehold(event.target.value)} min="1" max="20" inputMode="numeric" /></label>
        <label>Target timeline<input value={timeline} onChange={(event) => setTimeline(event.target.value)} placeholder="Move in within 18 months" /></label>
      </div>
      <div className="project-intake-submit">
        <div><span>Private by default</span><p>Saved in this browser. No wallet or account required.</p></div>
        <button type="submit" disabled={!hydrated || saving}>
          {!hydrated ? "Preparing project…" : saving ? "Creating project…" : "Create my project"}
        </button>
      </div>
      {problem ? <p role="alert" className="project-intake-error">{problem}</p> : null}
    </form>
  );
}
