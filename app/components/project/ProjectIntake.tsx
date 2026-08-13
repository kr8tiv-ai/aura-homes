"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { createAuraProject, withProjectStepState, type ProjectJourney, type ProjectPurpose } from "@/lib/project/document";
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
  const [purpose, setPurpose] = useState<ProjectPurpose | "">("");
  const [name, setName] = useState("My Aura home");
  const [municipality, setMunicipality] = useState("");
  const [budget, setBudget] = useState("");
  const [household, setHousehold] = useState("2");
  const [timeline, setTimeline] = useState("");
  const [accessibility, setAccessibility] = useState("");
  const [utilityGoals, setUtilityGoals] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const numericBudget = budget.trim() ? Number(budget) : null;
  const numericHousehold = household.trim() ? Number(household) : null;
  const canConfirmBrief = purpose !== ""
    && municipality.trim().length > 0
    && numericBudget !== null
    && Number.isFinite(numericBudget)
    && numericBudget > 0
    && numericHousehold !== null
    && Number.isInteger(numericHousehold)
    && numericHousehold > 0
    && timeline.trim().length > 0;

  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (!canConfirmBrief && confirmComplete) setConfirmComplete(false);
  }, [canConfirmBrief, confirmComplete]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setProblem(null);
    try {
      if (!purpose) {
        throw new Error("Choose whether this project is a primary home or an eco stay before saving it.");
      }
      const now = new Date();
      const explicitlyComplete = confirmComplete && canConfirmBrief;
      const initial = createAuraProject({
        id: newProjectId(),
        name,
        journey,
        purpose,
        document: defaultBuilderDocument(),
        now,
      });
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
          accessibility: accessibility.split(",").map((entry) => entry.trim()).filter(Boolean),
          utilityGoals: utilityGoals.split(",").map((entry) => entry.trim()).filter(Boolean),
          completedAtISO: explicitlyComplete ? now.toISOString() : null,
        },
      };
      /* Creating a project records that the brief has started. Completion is
         never inferred from whichever optional fields happen to be filled;
         it advances only when the owner explicitly confirms the brief. */
      const project = withProjectStepState(
        filled,
        "requirements",
        explicitlyComplete ? "complete" : "in-progress",
        now,
      );
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
        <label>Project name<input name="project-name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} maxLength={96} required /></label>
        <label>Project purpose
          <select name="project-purpose" value={purpose} onChange={(event) => setPurpose(event.target.value as ProjectPurpose | "")}>
            <option value="">Choose a purpose</option>
            <option value="primary-home">Primary home</option>
            <option value="eco-stay">Eco stay</option>
          </select>
        </label>
        <label>Municipality or region<input name="municipality" autoComplete="address-level2" value={municipality} onChange={(event) => setMunicipality(event.target.value)} placeholder="Foothills County" /></label>
        <label>Maximum working budget (CAD)<input name="budget-cad" type="number" value={budget} onChange={(event) => setBudget(event.target.value)} min="0" step="1000" inputMode="numeric" /></label>
        <label>People in the home<input name="household-size" type="number" value={household} onChange={(event) => setHousehold(event.target.value)} min="1" max="20" inputMode="numeric" /></label>
        <label>Target timeline<input name="target-timeline" autoComplete="off" value={timeline} onChange={(event) => setTimeline(event.target.value)} placeholder="Move in within 18 months" /></label>
        <label>Accessibility goals <span>(optional)</span><input name="accessibility-goals" value={accessibility} onChange={(event) => setAccessibility(event.target.value)} placeholder="Step-free entry, wider doors" /></label>
        <label>Utility goals <span>(optional)</span><input name="utility-goals" value={utilityGoals} onChange={(event) => setUtilityGoals(event.target.value)} placeholder="Grid-tied solar, rainwater reuse" /></label>
      </div>
      <div className="project-intake-confirm">
        <input
          id="project-intake-confirm"
          type="checkbox"
          checked={confirmComplete}
          disabled={!canConfirmBrief}
          aria-describedby="project-intake-confirm-help"
          onChange={(event) => setConfirmComplete(event.target.checked)}
        />
        <span className="project-intake-confirm__copy">
          <label htmlFor="project-intake-confirm"><strong>Confirm this starting brief</strong></label>
          <small id="project-intake-confirm-help" aria-live="polite">
            {canConfirmBrief
              ? "The starting decisions are present. Optional accessibility and utility goals can still be refined later."
              : "To confirm this brief, choose a purpose and add a municipality, a positive working budget, household size, and target timeline. You can still save it in progress."}
          </small>
        </span>
      </div>
      <div className="project-intake-submit">
        <div><span>Private by default</span><p>Saved in this browser. No wallet or account required.</p></div>
        <button type="submit" disabled={!hydrated || saving || !purpose} aria-describedby={!purpose ? "project-intake-save-help" : undefined}>
          {!hydrated ? "Preparing project…" : saving ? "Creating project…" : "Create my project"}
        </button>
      </div>
      {!purpose ? <p id="project-intake-save-help" className="project-intake-error">Choose a project purpose to save this brief. Every other field can stay in progress.</p> : null}
      {problem ? <p role="alert" className="project-intake-error">{problem}</p> : null}
    </form>
  );
}
