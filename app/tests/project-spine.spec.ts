import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "playwright/test";

import { defaultBuilderDocument } from "@/lib/builder/document";
import {
  createAuraProject,
  projectJourney,
  validateAuraProject,
  withProjectDesign,
  withProjectStepState,
  type AuraProject,
  type JourneyStepId,
} from "@/lib/project/document";
import { parseAuraProjectFile, projectFileJson } from "@/lib/project/file";
import {
  SPINE_ROUTES,
  SPINE_STEPS,
  SPINE_TRANSITION_SECONDS,
  openProjectBlockers,
  readDesignSaveState,
  readProjectSpine,
  readSpineNextAction,
  readSpineStage,
  showsProjectSpine,
} from "@/components/project/ProjectSpine";

/* SP01 — the project spine. The point of this node is that three values the
   document has always computed (stepStates, blockers, recommendedNextAction)
   stop being invisible. These are the readings themselves: the browser walk
   lives in tests/navigation.spec.ts, which needs the export server. */

const repoRoot = resolve(process.cwd(), "..");
const readRepo = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

const now = new Date("2026-08-14T12:00:00.000Z");

function freshProject(journey: AuraProject["journey"] = "find-land-build"): AuraProject {
  return createAuraProject({
    id: "project-spine",
    name: "Spine reference home",
    journey,
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
}

function editedProject(project: AuraProject): AuraProject {
  return renamedProject(project, "Edited for the spine");
}

/** A real design edit, through the same call the builder uses. Named so a
 *  second edit in one test can differ from the first — `withProjectDesign` is
 *  a no-op on the step states when the hash does not actually move. */
function renamedProject(project: AuraProject, name: string): AuraProject {
  const document = structuredClone(project.design.document);
  document.spec = { ...document.spec, name };
  return withProjectDesign(project, document, now);
}

test("the spine numbers stages against the canonical journey order", () => {
  const project = freshProject();
  // document.ts keeps its step order private, so the spine holds a copy.
  // A silent divergence would mis-number every stage; this is the pin.
  expect([...SPINE_STEPS]).toEqual(projectJourney(project).steps.map((step) => step.id));
  expect(SPINE_STEPS).toHaveLength(8);
});

test("the spine mounts on the six worked routes, and SiteShell actually mounts it", () => {
  expect([...SPINE_ROUTES]).toEqual(["/start", "/build", "/land", "/contractors", "/budget", "/projects"]);
  for (const route of SPINE_ROUTES) expect(showsProjectSpine(route)).toBe(true);

  // /dashboard IS the project record — a miniature of itself is density, not
  // information. Education, story, marketplace and labs pages never carry
  // workspace chrome at all.
  for (const route of ["/", "/dashboard", "/how-it-works", "/how-crypto-works", "/buy", "/homes", "/roadmap", "/faq", "/about", "/labs/xlayer-proof"]) {
    expect(showsProjectSpine(route)).toBe(false);
  }

  const shell = readRepo("app/components/SiteShell.tsx");
  expect(shell).toContain('import ProjectSpine, { showsProjectSpine } from "./project/ProjectSpine"');
  expect(shell).toContain("{showsProjectSpine(pathname) && <ProjectSpine />}");
});

test("the design fingerprint reads in plain words across every state the document can hold", () => {
  const project = freshProject();
  const untouched = readDesignSaveState(project);
  expect(untouched.state).toBe("never");
  expect(untouched.headline).toBe("Not saved yet");

  // withProjectDesign nulls the recorded basis on every real edit, so an
  // edited design can prove work happened but cannot prove a prior save.
  const edited = editedProject(project);
  expect(edited.stepStates.design.basisHash).toBeNull();
  expect(readDesignSaveState(edited).state).toBe("unsaved");
  expect(readDesignSaveState(edited).headline).toBe("Unsaved changes");

  const saved = withProjectStepState(edited, "design", "complete", now);
  expect(saved.stepStates.design.basisHash).toBe(saved.design.documentHash);
  expect(readDesignSaveState(saved).state).toBe("saved");
  expect(readDesignSaveState(saved).headline).toBe("Saved");

  // A recorded save that no longer matches the design being held: the only
  // state that can honestly say "changed since last save", because it is the
  // only one carrying evidence that a save happened.
  const stale = withProjectStepState(project, "design", "complete", now, edited.design.documentHash);
  expect(readDesignSaveState(stale).state).toBe("changed");
  expect(readDesignSaveState(stale).headline).toBe("Changed since last save");
});

test("'changed since last save' is unreachable in the builder and reachable from a file", () => {
  /* The reading the audit found unreachable through every production write
     path. It is kept, and this is the pin for why: not because the builder
     produces it, but because an imported project genuinely can carry it. */
  const project = freshProject();
  const saved = withProjectStepState(editedProject(project), "design", "complete", now);
  expect(readDesignSaveState(saved).state).toBe("saved");

  // A second real edit, on top of a genuine save. withProjectDesign nulls the
  // basis, so the builder lands on "unsaved" — never on "changed".
  const editedAgain = renamedProject(saved, "Moved on after the save");
  expect(editedAgain.design.documentHash).not.toBe(saved.design.documentHash);
  expect(editedAgain.stepStates.design.basisHash).toBeNull();
  expect(readDesignSaveState(editedAgain).state).toBe("unsaved");

  /* And the reading is not dead code. A project file carries stepStates
     verbatim and the parser never compares the recorded basis against the
     document hash, so this record survives a round trip through disk. */
  const stale = withProjectStepState(
    project,
    "design",
    "complete",
    now,
    editedAgain.design.documentHash,
  );
  const imported = parseAuraProjectFile(projectFileJson(stale));
  expect(imported.ok).toBe(true);
  if (!imported.ok) return;
  expect(imported.project.stepStates.design.basisHash).not.toBeNull();
  expect(imported.project.stepStates.design.basisHash).not.toBe(
    imported.project.design.documentHash,
  );
  expect(readDesignSaveState(imported.project).state).toBe("changed");
  expect(readDesignSaveState(imported.project).headline).toBe("Changed since last save");

  /* The comment above readDesignSaveState is part of the contract here: it
     used to argue the opposite of what the code does. These are the two claims
     it now makes, checked against the source rather than trusted. */
  const source = readRepo("app/components/project/ProjectSpine.tsx");
  expect(source).toContain("unreachable through the builder");
  expect(source).toContain("parseAuraProjectFile");
});

test("the fingerprint headline is words; the hash is short, truthful, and secondary", () => {
  const project = freshProject();
  const edited = editedProject(project);
  const saved = withProjectStepState(edited, "design", "complete", now);
  const stale = withProjectStepState(project, "design", "complete", now, edited.design.documentHash);

  for (const value of [project, edited, saved, stale]) {
    const reading = readDesignSaveState(value);
    // never a raw hex dump as the headline
    expect(reading.headline).not.toMatch(/0x[0-9a-f]{4}/i);
    // short hash: the real prefix of the real hash, truncated and marked
    expect(reading.shortHash).toBe(`${value.design.documentHash.slice(0, 10)}…`);
    expect(reading.shortHash.length).toBeLessThanOrEqual(11);
    // the full fingerprint stays available, in the note rather than the row
    expect(reading.note).toContain(value.design.documentHash);
  }
});

test("the stage names which of the eight, and its status, without inventing progress", () => {
  const project = freshProject();
  expect(readSpineStage(project)).toMatchObject({
    stepId: "requirements",
    position: 1,
    label: "Requirements",
    status: "not-started",
    statusLabel: "Not started",
  });
  expect(readSpineStage(project).text).toBe("01 of 08 · Requirements · Not started");

  const confirmed = withProjectStepState(project, "requirements", "complete", now);
  expect(readSpineStage(confirmed)).toMatchObject({ stepId: "design", position: 2, label: "Design" });

  // A blocked step reads blocked. It never reads as progress.
  const blocked = withProjectStepState(project, "requirements", "blocked", now);
  expect(readSpineStage(blocked).statusLabel).toBe("Blocked");
  expect(readSpineStage(blocked).text).toContain("Blocked");
});

test("a fully confirmed journey states the end plainly instead of inventing a task", () => {
  let project = freshProject();
  for (const step of SPINE_STEPS) project = withProjectStepState(project, step, "complete", now);

  expect(project.recommendedNextAction).toBeNull();
  expect(readSpineNextAction(project)).toBeNull();
  expect(readSpineStage(project)).toMatchObject({
    stepId: "operate",
    position: 8,
    statusLabel: "Confirmed",
  });
});

test("the one recommended action is a link that actually goes somewhere real", () => {
  const routeForStep: Record<JourneyStepId, string> = {
    requirements: "/start",
    design: "/build",
    land: "/land",
    team: "/contractors",
    quotes: "/budget",
    funding: "/budget",
    build: "/dashboard",
    operate: "/dashboard",
  };

  let project = freshProject();
  for (const step of SPINE_STEPS) {
    const action = readSpineNextAction(project);
    expect(action).not.toBeNull();
    if (!action) return;
    // the label and reason are the document's, never a second opinion
    expect(action.label).toBe(project.recommendedNextAction?.label);
    expect(action.reason).toBe(project.recommendedNextAction?.reason);
    expect(action.href).toBe(routeForStep[step]);
    project = withProjectStepState(project, step, "complete", now);
  }

  // A route that does not exist is a dead end dressed as guidance.
  for (const route of Array.from(new Set([...Object.values(routeForStep), "/buy"]))) {
    expect(existsSync(resolve(repoRoot, `app/app${route}/page.tsx`))).toBe(true);
  }
});

test("a finished-home project is sent to the homes it is actually comparing", () => {
  let project = freshProject("buy-finished-home");
  for (const step of ["requirements", "design", "land"] as const) {
    project = withProjectStepState(project, step, "complete", now);
  }
  expect(readSpineStage(project).stepId).toBe("team");
  expect(readSpineNextAction(project)?.href).toBe("/buy");
});

test("blockers are counted as a declared zero, and resolved ones stay out of the count", () => {
  const project = freshProject();
  expect(openProjectBlockers(project)).toEqual([]);

  const withBlockers = structuredClone(project);
  withBlockers.blockers = [
    {
      id: "blocker-open-1",
      stepId: "land",
      summary: "No parcel confirmed for this design's footprint.",
      detail: "",
      source: "system",
      createdAtISO: now.toISOString(),
      resolvedAtISO: null,
    },
    {
      id: "blocker-resolved",
      stepId: "requirements",
      summary: "Municipality was missing.",
      detail: "",
      source: "user",
      createdAtISO: now.toISOString(),
      resolvedAtISO: now.toISOString(),
    },
    {
      id: "blocker-open-2",
      stepId: "quotes",
      summary: "Two quotes price different scopes.",
      detail: "",
      source: "user",
      createdAtISO: now.toISOString(),
      resolvedAtISO: null,
    },
  ];
  expect(validateAuraProject(withBlockers).ok).toBe(true);

  const open = openProjectBlockers(withBlockers);
  expect(open.map((blocker) => blocker.id)).toEqual(["blocker-open-1", "blocker-open-2"]);
  // every summary the row can expand to is real text, never an empty chip
  expect(open.every((blocker) => blocker.summary.trim().length > 0)).toBe(true);
});

test("the spine reads the whole project state and leaves the name to the journey spine", () => {
  const project = freshProject();
  const reading = readProjectSpine(project);
  expect(Object.keys(reading).sort()).toEqual(["blockers", "design", "next", "stage"]);
  expect(reading.stage).toEqual(readSpineStage(project));
  expect(reading.design).toEqual(readDesignSaveState(project));
  expect(reading.next).toEqual(readSpineNextAction(project));
  expect(reading.blockers).toEqual([]);

  /* The project name belongs to ProjectJourneySpine. A second copy is both
     visual repetition and a strict-mode break for the exact-text name query
     in tests/project-ui.spec.ts. */
  const source = readRepo("app/components/project/ProjectSpine.tsx");
  expect(source).not.toContain("project.name");
  expect(source).not.toContain("{project.name}");
});

test("the row's only motion is one damped transition inside the 150–250 ms band", () => {
  expect(SPINE_TRANSITION_SECONDS).toBeGreaterThanOrEqual(0.15);
  expect(SPINE_TRANSITION_SECONDS).toBeLessThanOrEqual(0.25);

  const source = readRepo("app/components/project/ProjectSpine.tsx");
  // no modal, no dialog, no second animation system
  expect(source).not.toContain('role="dialog"');
  // the transition reads the constant; a hand-tuned duration beside it fails
  expect(source).toContain("duration: SPINE_TRANSITION_SECONDS");
  expect(source).not.toMatch(/duration:\s*[\d.]/);
});
