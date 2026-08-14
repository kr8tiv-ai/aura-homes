/* ===========================================================================
   SP03 — storage truth, proved on the paths that actually cost people work.

   A happy-path storage spec proves nothing here. The three failures this node
   exists to answer — a full quota, a blocked database, and a store that is
   empty because the data was cleared — cannot be provoked from a real browser
   database on demand, so every test below drives `lib/project/store.ts`
   through an INJECTED backend that fails on purpose.

   Two of these tests are deliberately paired with their negative so the
   assertion can fail:

     · the cleared-data notice fires when a witness records projects that are
       gone, and stays silent when there is no witness — an alarm that always
       fires is not an observation;
     · a quota-failed write leaves the store byte-identical, which is what
       makes "nothing was written" a fact rather than a reassurance.
   =========================================================================== */

import { expect, test } from "playwright/test";

import { defaultBuilderDocument } from "@/lib/builder/document";
import {
  createAuraProject,
  validateAuraProject,
  withProjectStepState,
  type AuraProject,
} from "@/lib/project/document";
import {
  applyAuraProjectRestore,
  deleteAuraProject,
  diagnoseProjectStorageError,
  forgetClearedProjects,
  isProjectStoreError,
  listAuraProjects,
  planAuraProjectRestore,
  projectDashboardRow,
  projectStorageDiagnosis,
  readProjectLibrary,
  saveAuraProject,
  setProjectStorageBackend,
  setProjectWitnessStore,
  type ProjectStorageBackend,
  type ProjectStoreFailure,
} from "@/lib/project/store";

const now = new Date("2026-08-14T12:00:00.000Z");

function newProject(id: string, name: string): AuraProject {
  return createAuraProject({
    id,
    name,
    journey: "find-land-build",
    purpose: "primary-home",
    document: defaultBuilderDocument(),
    now,
  });
}

/* --------------------------------------------------------------------------
   a store in memory, and the switches that make it misbehave
   -------------------------------------------------------------------------- */

interface MemoryStore extends ProjectStorageBackend {
  records: Map<string, unknown>;
  active: string | null;
  /** thrown by every method when set */
  failEverything: unknown;
  /** thrown by `put` only when set */
  failWrites: unknown;
  writes: number;
}

function memoryBackend(): MemoryStore {
  const store: MemoryStore = {
    records: new Map<string, unknown>(),
    active: null,
    failEverything: null,
    failWrites: null,
    writes: 0,
    async list() {
      if (store.failEverything) throw store.failEverything;
      return Array.from(store.records.values());
    },
    async get(id) {
      if (store.failEverything) throw store.failEverything;
      return store.records.get(id);
    },
    async put(project, makeActive) {
      if (store.failEverything) throw store.failEverything;
      if (store.failWrites) throw store.failWrites;
      store.writes += 1;
      store.records.set(project.id, structuredClone(project));
      if (makeActive) store.active = project.id;
    },
    async readActiveId() {
      if (store.failEverything) throw store.failEverything;
      return store.active;
    },
    async writeActiveId(id) {
      if (store.failEverything) throw store.failEverything;
      store.active = id;
    },
    async remove(id) {
      if (store.failEverything) throw store.failEverything;
      store.records.delete(id);
      if (store.active === id) store.active = null;
    },
  };
  return store;
}

function memoryWitness() {
  let value: string | null = null;
  return {
    read: () => value,
    write: (next: string) => {
      value = next;
    },
    /** test-side inspection, never used by the store */
    peek: () => value,
    reset: () => {
      value = null;
    },
  };
}

/** Node has no DOMException with a QuotaExceededError name to hand, and the
 *  store classifies by `name` precisely so it does not need one. */
function quotaError(): Error {
  const error = new Error("The quota has been exceeded.");
  error.name = "QuotaExceededError";
  return error;
}

let backend: MemoryStore;
let witness: ReturnType<typeof memoryWitness>;

test.beforeEach(() => {
  backend = memoryBackend();
  witness = memoryWitness();
  setProjectStorageBackend(backend);
  setProjectWitnessStore(witness);
});

test.afterEach(() => {
  setProjectStorageBackend(null);
  setProjectWitnessStore(null);
});

/* --------------------------------------------------------------------------
   1. the seam itself works — otherwise every test below is vacuous
   -------------------------------------------------------------------------- */

test("the injected backend really is the store the library reads", async () => {
  await saveAuraProject(newProject("project-seam", "Seam check"), true);
  expect(backend.writes).toBe(1);
  expect(backend.records.size).toBe(1);

  const library = await readProjectLibrary();
  expect(library.storage).toBeNull();
  expect(library.cleared).toBeNull();
  expect(library.projects.map((project) => project.name)).toEqual(["Seam check"]);
});

/* --------------------------------------------------------------------------
   2. quota exceeded on write
   -------------------------------------------------------------------------- */

test("a quota-exceeded write is named, and nothing is written", async () => {
  const first = newProject("project-quota-1", "Foothills home");
  await saveAuraProject(first, true);
  const before = JSON.stringify(Array.from(backend.records.values()));

  backend.failWrites = quotaError();
  const second = newProject("project-quota-2", "Second home");
  const error = await saveAuraProject(second, true).catch((thrown: unknown) => thrown);

  expect(isProjectStoreError(error)).toBe(true);
  if (!isProjectStoreError(error)) return;
  expect(error.diagnosis.kind).toBe("quota");
  // what happened / what was saved / what to do — three separate facts
  expect(error.diagnosis.headline).toContain("full");
  expect(error.diagnosis.saved).toContain("Nothing was written");
  expect(error.diagnosis.wayOut).toContain("export");

  // the fact behind the reassurance: the store is byte-identical
  expect(JSON.stringify(Array.from(backend.records.values()))).toBe(before);
  expect(backend.records.has("project-quota-2")).toBe(false);

  // and the library still reads, so a failed save is not a lost page
  backend.failWrites = null;
  const library = await readProjectLibrary();
  expect(library.storage).toBeNull();
  expect(library.projects.map((project) => project.id)).toEqual(["project-quota-1"]);
});

/* --------------------------------------------------------------------------
   3. IndexedDB blocked — private mode, disabled site data
   -------------------------------------------------------------------------- */

test("a blocked database is reported by the dashboard read rather than thrown", async () => {
  backend.failEverything = projectStorageDiagnosisError("blocked");

  const library = await readProjectLibrary();
  expect(library.storage).not.toBeNull();
  expect(library.storage?.kind).toBe("blocked");
  expect(library.projects).toEqual([]);
  // a failure is never also a cleared-data claim: two stories about one event
  expect(library.cleared).toBeNull();
  expect(library.storage?.saved).toContain("nothing was lost");
  expect(library.storage?.wayOut).toContain("Private windows");
});

test("a blocked database still throws a named failure from a write", async () => {
  backend.failEverything = projectStorageDiagnosisError("blocked");
  const error = await saveAuraProject(newProject("project-blocked", "Blocked home"), true)
    .catch((thrown: unknown) => thrown);
  expect(isProjectStoreError(error)).toBe(true);
  expect(isProjectStoreError(error) && error.diagnosis.kind).toBe("blocked");

  // listAuraProjects — the API ProjectContext and older callers use — also
  // reports the named failure instead of an empty list that looks like "no
  // projects yet"
  const listed = await listAuraProjects().catch((thrown: unknown) => thrown);
  expect(isProjectStoreError(listed)).toBe(true);
});

/* --------------------------------------------------------------------------
   4. the store is empty because the data was cleared — and the negative
   -------------------------------------------------------------------------- */

test("an empty store with a witness says what this browser held", async () => {
  await saveAuraProject(newProject("project-cleared-1", "Foothills home"), true);
  await saveAuraProject(newProject("project-cleared-2", "Ridge cabin"), true);
  await readProjectLibrary(); // records the witness
  expect(witness.peek()).not.toBeNull();

  // the database survives; its contents do not — a devtools delete, an
  // eviction, a partial site-data clear
  backend.records.clear();
  backend.active = null;

  const library = await readProjectLibrary();
  expect(library.storage).toBeNull();
  expect(library.cleared).not.toBeNull();
  expect(library.cleared?.count).toBe(2);
  expect(library.cleared?.names).toContain("Ridge cabin");
  expect(library.cleared?.lastEditedISO).toBe(now.toISOString());

  // the witness is NOT overwritten while it is the only record that the
  // missing work existed
  const repeat = await readProjectLibrary();
  expect(repeat.cleared?.count).toBe(2);

  // and the notice can be dismissed without deleting anything
  forgetClearedProjects();
  expect((await readProjectLibrary()).cleared).toBeNull();
});

test("an empty store with no witness stays an honest blank", async () => {
  const library = await readProjectLibrary();
  expect(library.projects).toEqual([]);
  expect(library.storage).toBeNull();
  // a first visit must not be told its work is missing
  expect(library.cleared).toBeNull();
});

test("a store that still holds projects never claims data was cleared", async () => {
  await saveAuraProject(newProject("project-intact-1", "Foothills home"), true);
  await saveAuraProject(newProject("project-intact-2", "Ridge cabin"), true);
  await readProjectLibrary();

  backend.records.delete("project-intact-2");
  const library = await readProjectLibrary();
  expect(library.projects).toHaveLength(1);
  expect(library.cleared).toBeNull();
});

/* --------------------------------------------------------------------------
   5. unreadable records are counted, not silently dropped
   -------------------------------------------------------------------------- */

test("records this build cannot read are counted and left on disk", async () => {
  await saveAuraProject(newProject("project-readable", "Readable home"), true);
  backend.records.set("project-future", { format: "aura-project", version: 99, id: "project-future" });

  const library = await readProjectLibrary();
  expect(library.projects.map((project) => project.id)).toEqual(["project-readable"]);
  expect(library.unreadable).toBe(1);
  // untouched: a record a newer build wrote is not this build's to remove
  expect(backend.records.has("project-future")).toBe(true);
  // an unreadable record is not an empty store, so no cleared claim either
  expect(library.cleared).toBeNull();
});

/* --------------------------------------------------------------------------
   6. restore names what it will overwrite BEFORE it does it
   -------------------------------------------------------------------------- */

test("a restore plan names the record it would replace, and writes nothing", async () => {
  const saved = newProject("project-restore", "Foothills home");
  await saveAuraProject(saved, true);
  const writesBefore = backend.writes;

  const incoming: AuraProject = { ...structuredClone(saved), name: "Foothills home (from backup)" };
  const plan = await planAuraProjectRestore(incoming);

  expect(plan.overwrites).not.toBeNull();
  expect(plan.overwrites?.name).toBe("Foothills home");
  expect(plan.overwrites?.updatedAtISO).toBe(saved.updatedAtISO);
  expect(plan.overwrites?.designHash).toBe(saved.design.documentHash);
  expect(plan.activeId).toBe("project-restore");
  // planning is a read: the store is untouched until a choice is made
  expect(backend.writes).toBe(writesBefore);
  expect((backend.records.get("project-restore") as AuraProject).name).toBe("Foothills home");
});

test("keep-both restores alongside the named record instead of over it", async () => {
  const saved = newProject("project-keep-both", "Foothills home");
  await saveAuraProject(saved, true);
  const incoming: AuraProject = { ...structuredClone(saved), name: "Foothills home (from backup)" };
  const plan = await planAuraProjectRestore(incoming);

  const restored = await applyAuraProjectRestore(plan, "keep-both", "project-keep-both-copy");
  expect(restored.id).toBe("project-keep-both-copy");
  expect(restored.name).toContain("restored");
  expect(validateAuraProject(restored).ok).toBe(true);

  const library = await readProjectLibrary();
  expect(library.projects).toHaveLength(2);
  expect((backend.records.get("project-keep-both") as AuraProject).name).toBe("Foothills home");
});

test("overwrite replaces exactly the record the plan named", async () => {
  const saved = newProject("project-overwrite", "Foothills home");
  await saveAuraProject(saved, true);
  const other = newProject("project-bystander", "Ridge cabin");
  await saveAuraProject(other, true);

  const incoming: AuraProject = { ...structuredClone(saved), name: "Foothills home (from backup)" };
  const plan = await planAuraProjectRestore(incoming);
  await applyAuraProjectRestore(plan, "overwrite", "project-unused-id");

  expect((backend.records.get("project-overwrite") as AuraProject).name).toBe("Foothills home (from backup)");
  expect((backend.records.get("project-bystander") as AuraProject).name).toBe("Ridge cabin");
  expect(backend.records.has("project-unused-id")).toBe(false);
});

test("a restore into an empty slot reports that it replaces nothing", async () => {
  const plan = await planAuraProjectRestore(newProject("project-fresh", "Fresh home"));
  expect(plan.overwrites).toBeNull();
  expect(plan.activeId).toBeNull();
});

/* --------------------------------------------------------------------------
   7. deleting is a real way out of a full quota
   -------------------------------------------------------------------------- */

test("deleting a project frees the slot and clears the active pointer", async () => {
  const project = newProject("project-delete", "Foothills home");
  await saveAuraProject(project, true);
  expect(backend.active).toBe("project-delete");

  await deleteAuraProject("project-delete");
  expect(backend.records.has("project-delete")).toBe(false);
  expect(backend.active).toBeNull();
});

/* --------------------------------------------------------------------------
   8. the messages are distinct, and each one carries all three facts
   -------------------------------------------------------------------------- */

test("every named failure says something different from every other", () => {
  const kinds: ProjectStoreFailure[] = [
    "unavailable",
    "blocked",
    "quota",
    "version",
    "corrupt",
    "notfound",
    "unknown",
  ];
  const headlines = new Set<string>();
  for (const kind of kinds) {
    const diagnosis = projectStorageDiagnosis(kind);
    expect(diagnosis.kind).toBe(kind);
    // three facts, all present, none of them a placeholder
    expect(diagnosis.headline.length).toBeGreaterThan(20);
    expect(diagnosis.saved.length).toBeGreaterThan(20);
    expect(diagnosis.wayOut.length).toBeGreaterThan(20);
    expect(diagnosis.headline).not.toBe(diagnosis.saved);
    headlines.add(diagnosis.headline);
  }
  expect(headlines.size).toBe(kinds.length);
});

test("an unrecognised throwable still produces the three fields", () => {
  const diagnosis = diagnoseProjectStorageError(new Error("something the store has never seen"));
  expect(diagnosis.kind).toBe("unknown");
  expect(diagnosis.headline).toContain("something the store has never seen");
  expect(diagnosis.saved.length).toBeGreaterThan(20);
  expect(diagnosis.wayOut.length).toBeGreaterThan(20);
});

test("a raw QuotaExceededError from any layer classifies as quota", () => {
  expect(diagnoseProjectStorageError(quotaError()).kind).toBe("quota");
});

/* --------------------------------------------------------------------------
   9. the dashboard row reads the project, and invents nothing
   -------------------------------------------------------------------------- */

test("the dashboard row reports the real stage, blockers and design hash", () => {
  const project = newProject("project-row", "Foothills home");
  const row = projectDashboardRow(project);

  expect(row.name).toBe("Foothills home");
  expect(row.journeyLabel).toBe("Find land and build");
  expect(row.stageId).toBe("requirements");
  expect(row.stageLabel).toBe("Requirements");
  expect(row.stageStatusLabel).toBe("Not started");
  expect(row.stepsComplete).toBe(0);
  expect(row.stepsTotal).toBe(8);
  expect(row.openBlockers).toBe(0);
  expect(row.designHashShort).toBe(project.design.documentHash.slice(0, 10));
  expect(row.archived).toBe(false);
  expect(row.nextAction?.label).toBe("Complete your project brief");
});

test("confirming a step moves the stage the dashboard shows", () => {
  const project = withProjectStepState(newProject("project-stage", "Foothills home"), "requirements", "complete", now);
  const row = projectDashboardRow(project);
  expect(row.stepsComplete).toBe(1);
  expect(row.stageId).toBe("design");
  expect(row.stageLabel).toBe("Design");
});

test("open blockers are counted and resolved ones are not", () => {
  const base = newProject("project-blockers", "Foothills home");
  const project: AuraProject = {
    ...base,
    blockers: [
      {
        id: "blocker-open",
        stepId: "land",
        summary: "No parcel confirmed",
        detail: "",
        source: "system",
        createdAtISO: now.toISOString(),
        resolvedAtISO: null,
      },
      {
        id: "blocker-done",
        stepId: "design",
        summary: "Design unconfirmed",
        detail: "",
        source: "user",
        createdAtISO: now.toISOString(),
        resolvedAtISO: now.toISOString(),
      },
    ],
  };
  expect(validateAuraProject(project).ok).toBe(true);
  expect(projectDashboardRow(project).openBlockers).toBe(1);
});

/* --------------------------------------------------------------------------
   helpers
   -------------------------------------------------------------------------- */

/** A backend failure that already carries a diagnosis, the way the real
 *  IndexedDB layer raises one. */
function projectStorageDiagnosisError(kind: ProjectStoreFailure): Error {
  const diagnosis = projectStorageDiagnosis(kind);
  const error = new Error(`${diagnosis.headline} ${diagnosis.saved} ${diagnosis.wayOut}`);
  error.name = "AuraProjectStoreError";
  (error as Error & { diagnosis: unknown }).diagnosis = diagnosis;
  return error;
}
