import { expect, test } from "playwright/test";

import { defaultBuilderDocument, hashBuilderDocument } from "@/lib/builder/document";
import {
  AURA_PROJECT_VERSION,
  canonicalAuraProjectJson,
  createAuraProject,
  hashAuraProject,
  projectJourney,
  withProjectDesign,
  validateAuraProject,
  type AuraProject,
} from "@/lib/project/document";
import * as projectDocument from "@/lib/project/document";
import { createProjectBudget, defaultProjectBudgetScenario, type ProjectBudget } from "@/lib/builder/projectBudget";
import {
  decryptAuraProjectFile,
  encryptAuraProjectFile,
  parseAuraProjectFile,
  projectFileJson,
} from "@/lib/project/file";

const now = new Date("2026-08-11T12:00:00.000Z");

test("a new project refuses to invent an undecided purpose", () => {
  expect(() => createAuraProject({
    id: "project-purpose-required",
    name: "Purpose still undecided",
    journey: "find-land-build",
    document: defaultBuilderDocument(),
    now,
  } as Parameters<typeof createAuraProject>[0])).toThrow("purpose");
});

test("a builder document becomes one durable find-land-and-build project", () => {
  const document = defaultBuilderDocument();
  const project = createAuraProject({
    id: "project-alberta-1",
    name: "Foothills home",
    journey: "find-land-build",
    purpose: "primary-home",
    document,
    now,
  });

  expect(project.version).toBe(AURA_PROJECT_VERSION);
  expect(project.version).toBe(2);
  expect((project as unknown as { purpose: string }).purpose).toBe("primary-home");
  expect((project as unknown as { stepStates: Record<string, { status: string }> }).stepStates.design.status).toBe("not-started");
  expect((project as unknown as { blockers: unknown[] }).blockers).toEqual([]);
  expect((project as unknown as { budgetBasis: unknown }).budgetBasis).toBeNull();
  expect((project as unknown as { recommendedNextAction: { stepId: string } }).recommendedNextAction.stepId).toBe("requirements");
  expect(project.design.document).toEqual(document);
  expect(project.design.documentHash).toBe(hashBuilderDocument(document));
  expect(project.requirements.location.region).toBe("Alberta");
  expect(project.discovery.land.shortlist).toEqual([]);
  expect(project.delivery.rfqs).toEqual([]);
  expect(validateAuraProject(project)).toEqual({ ok: true, project });
});

test("project identity is canonical and refuses a changed embedded design", () => {
  const project = createAuraProject({
    id: "project-hash",
    name: "Hash home",
    journey: "build-on-owned-land",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
  const reordered = JSON.parse(canonicalAuraProjectJson(project));

  expect(hashAuraProject(reordered)).toBe(hashAuraProject(project));

  const changed = structuredClone(project);
  changed.design.document.spec.name = "Changed without updating the hash";
  const checked = validateAuraProject(changed);
  expect(checked.ok).toBe(false);
  if (!checked.ok) expect(checked.problem).toContain("design hash mismatch");
});

test("future project versions fail visibly without being interpreted", () => {
  const project = createAuraProject({
    id: "project-future",
    name: "Future home",
    journey: "buy-finished-home",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
  const future = { ...project, version: AURA_PROJECT_VERSION + 1 };
  const checked = validateAuraProject(future);

  expect(checked.ok).toBe(false);
  if (!checked.ok) {
    expect(checked.futureVersion).toBe(AURA_PROJECT_VERSION + 1);
    expect(checked.problem).toContain("newer version");
  }
});

test("journey progress recommends the first incomplete real-world decision", () => {
  const project = createAuraProject({
    id: "project-progress",
    name: "Journey home",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });

  const initial = projectJourney(project);
  expect(initial.steps.map((step) => step.id)).toEqual([
    "requirements",
    "design",
    "land",
    "team",
    "quotes",
    "funding",
    "build",
    "operate",
  ]);
  expect(initial.next.id).toBe("requirements");
  expect(initial.steps.find((step) => step.id === "design")?.complete).toBe(false);

  const ready = structuredClone(project);
  ready.requirements.completedAtISO = now.toISOString();
  expect(projectJourney(ready).next.id).toBe("requirements");

  const setStepState = (projectDocument as unknown as {
    withProjectStepState: (
      project: typeof ready,
      step: string,
      status: string,
      now: Date,
    ) => typeof ready;
  }).withProjectStepState;
  expect(typeof setStepState).toBe("function");
  const requirementsConfirmed = setStepState(ready, "requirements", "complete", now);
  expect(projectJourney(requirementsConfirmed).next.id).toBe("design");
  const designConfirmed = setStepState(requirementsConfirmed, "design", "complete", now);
  expect(projectJourney(designConfirmed).next.id).toBe("land");
  expect((designConfirmed as unknown as { stepStates: Record<string, { confirmedAtISO: string; basisHash: string }> }).stepStates.design).toMatchObject({
    confirmedAtISO: now.toISOString(),
    basisHash: project.design.documentHash,
  });
});

test("blank intake and demonstration discovery never complete explicit journey steps", () => {
  const project = createAuraProject({
    id: "project-no-inference",
    name: "No inferred progress",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
  const value = structuredClone(project) as unknown as Record<string, any>;
  value.requirements.completedAtISO = now.toISOString();
  value.discovery.land.shortlist = ["demo-parcel"];
  value.discovery.land.records = [{
    format: "aura-discovery-record",
    version: 1,
    id: "record-demo-parcel",
    subjectId: "demo-parcel",
    access: "demonstration",
    sourceLabel: "Demonstration only",
    sourceUrl: null,
    collectedAtISO: now.toISOString(),
    expiresAtISO: null,
    confidence: "unverified",
    data: { demonstration: true },
  }];
  value.delivery.quotes = [{ id: "demo-quote" }];

  const journey = projectJourney(value as never);
  expect(journey.steps.find((step) => step.id === "requirements")?.complete).toBe(false);
  expect(journey.steps.find((step) => step.id === "design")?.complete).toBe(false);
  expect(journey.steps.find((step) => step.id === "land")?.complete).toBe(false);
  expect(journey.steps.find((step) => step.id === "quotes")?.complete).toBe(false);
});

test("version one projects migrate without losing durable data or inventing completion", () => {
  const current = createAuraProject({
    id: "project-v1",
    name: "Legacy foothills project",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
  const legacy = structuredClone(current) as unknown as Record<string, any>;
  legacy.version = 1;
  delete legacy.purpose;
  delete legacy.stepStates;
  delete legacy.budgetBasis;
  delete legacy.blockers;
  delete legacy.recommendedNextAction;
  legacy.requirements.completedAtISO = now.toISOString();
  legacy.delivery.orderSnapshotIds = ["snapshot-kept"];
  legacy.milestones = [{ id: "milestone-kept" }];

  const checked = validateAuraProject(legacy);
  expect(checked.ok).toBe(true);
  if (!checked.ok) return;
  expect(checked.project.version).toBe(2);
  expect(checked.project.id).toBe(legacy.id);
  expect(checked.project.delivery.orderSnapshotIds).toEqual(["snapshot-kept"]);
  expect(checked.project.milestones).toEqual([{ id: "milestone-kept" }]);
  expect((checked.project as unknown as { purpose: string }).purpose).toBe("primary-home");
  expect(projectJourney(checked.project).steps.every((step) => !step.complete)).toBe(true);
});

test("a canonical budget basis is persisted against the current design", () => {
  const project = createAuraProject({
    id: "project-budget-basis",
    name: "Budget basis",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
  const budget = createProjectBudget({
    document: project.design.document,
    scenario: defaultProjectBudgetScenario(),
    region: "Alberta",
    municipality: "Foothills County",
    budgetCapCad: 500_000,
  });
  const persist = (projectDocument as unknown as {
    withProjectBudgetBasis: (value: AuraProject, basis: ProjectBudget, at: Date) => AuraProject;
  }).withProjectBudgetBasis;
  expect(typeof persist).toBe("function");
  const saved = persist(project, budget, now) as unknown as {
    budgetBasis: {
      designHash: string;
      budgetHash: string;
      calculatedAtISO: string;
      assumptions: string[];
      scenario: unknown;
    };
  };
  expect(saved.budgetBasis.designHash).toBe(project.design.documentHash);
  expect(saved.budgetBasis.budgetHash).toMatch(/^0x[a-f0-9]{64}$/);
  expect(saved.budgetBasis.calculatedAtISO).toBe(now.toISOString());
  expect(saved.budgetBasis.assumptions).toEqual(budget.assumptions);
  expect(saved.budgetBasis.scenario).toEqual(budget.scenario);
  expect(validateAuraProject(saved).ok).toBe(true);
});

test("a selected budget scenario survives canonical project reload", () => {
  const project = createAuraProject({
    id: "project-scenario-reload",
    name: "Persistent cost scenario",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
  const persistScenario = (projectDocument as unknown as {
    withProjectBudgetScenario?: (
      value: AuraProject,
      scenario: ReturnType<typeof defaultProjectBudgetScenario>,
      at: Date,
    ) => AuraProject;
  }).withProjectBudgetScenario;
  expect(typeof persistScenario).toBe("function");
  if (!persistScenario) return;

  const scenario = {
    ...defaultProjectBudgetScenario(),
    site: "sloped" as const,
    utilities: "off-grid" as const,
    finish: "elevated" as const,
    delivery: "full-service" as const,
    shippingDistanceKm: 425,
    contingencyPct: 20,
    salesTaxPct: 5,
  };
  const saved = persistScenario(project, scenario, new Date("2026-08-12T14:00:00.000Z"));
  const reloaded = validateAuraProject(JSON.parse(canonicalAuraProjectJson(saved)));

  expect(reloaded.ok).toBe(true);
  if (!reloaded.ok) return;
  expect(reloaded.project.budgetBasis?.scenario).toEqual(scenario);
  expect(reloaded.project.budgetBasis?.budgetHash).toMatch(/^0x[a-f0-9]{64}$/);
  expect(reloaded.project.budgetBasis?.calculatedAtISO).toBe("2026-08-12T14:00:00.000Z");
});

test("plain and encrypted Aura project files round-trip without information loss", async () => {
  const project = createAuraProject({
    id: "project-file",
    name: "Portable home",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });

  const plain = parseAuraProjectFile(projectFileJson(project));
  expect(plain.ok).toBe(true);
  if (plain.ok) expect(plain.project).toEqual(project);

  const encrypted = await encryptAuraProjectFile(project, "paper-forest-river");
  expect(encrypted).not.toContain(project.name);
  const decrypted = await decryptAuraProjectFile(encrypted, "paper-forest-river");
  expect(decrypted).toEqual(project);
  await expect(decryptAuraProjectFile(encrypted, "wrong-passphrase")).rejects.toThrow(
    "could not be decrypted",
  );
});

test("a builder edit replaces only the durable project design", () => {
  const project = createAuraProject({
    id: "project-design-sync",
    name: "Foothills build",
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
  const document = defaultBuilderDocument();
  document.spec = { ...document.spec, name: "Edited in Guided mode" };
  const next = withProjectDesign(project, document, new Date("2026-08-11T12:03:00.000Z"));

  expect(next.design.document.spec.name).toBe("Edited in Guided mode");
  expect(next.design.documentHash).toBe(hashBuilderDocument(document));
  expect(next.requirements).toEqual(project.requirements);
  expect(next.createdAtISO).toBe(project.createdAtISO);
  expect(next.updatedAtISO).toBe("2026-08-11T12:03:00.000Z");
  expect(validateAuraProject(next).ok).toBe(true);
});
