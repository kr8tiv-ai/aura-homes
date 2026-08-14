/* ===========================================================================
   THE PROJECT STORE — one portable project you own, and the truth about
   where it actually lives.

   The promise on the tin is "one portable project you own". IndexedDB keeps
   the first half of that promise honestly: nothing leaves the machine, no
   account is required, the data model is the user's. What this file adds is
   the half the interface used to ask people to take on faith — what happens
   the day the browser says no.

   Three of those days are real, they are not rare, and each one used to
   surface as either a spinner or a silent no-op:

     · the origin's quota is full and a write is refused;
     · IndexedDB is blocked outright (a private window, disabled site data);
     · the store opens fine and is EMPTY because the data was cleared.

   The first two arrive as a thrown DOMException with a name a person cannot
   act on. The third arrives as nothing at all — an empty list is exactly what
   a brand new visitor sees, so "your work is gone" and "welcome" were, until
   now, the same screen. Each of those three is answered here by a NAMED
   failure carrying three separate facts: what happened, what was and was not
   saved, and the way out. Never one blended sentence, because the middle fact
   is the one people need first and it is the one a blended sentence loses.

   HOW THE EMPTY STORE LEARNS TO TELL THE TWO CASES APART
   -----------------------------------------------------
   A witness record (see `ProjectWitnessStore`) is written to localStorage
   after every successful read: how many projects this browser held and the
   date of the newest edit. localStorage and IndexedDB are separate buckets —
   a devtools "delete database", an origin eviction under storage pressure,
   or a partial site-data clear can take one and leave the other. When the
   database opens cleanly, returns zero projects, and the witness says there
   were three, that is an OBSERVATION and it is stated as one. When there is
   no witness, an empty store stays an honest blank: no alarm is invented.

   The witness carries no clock of its own. Its date is the newest project's
   own `updatedAtISO`, a fact already in the data, so the same library always
   produces the same witness — the discipline the builder store keeps with
   `exportedAt`.

   WHY THERE IS A BACKEND SEAM
   ---------------------------
   `setProjectStorageBackend` exists so the failure paths can be PROVED. A
   quota-exceeded write and a blocked database cannot be provoked on demand
   from a real browser database, and a spec that only walks the happy path
   proves nothing about the three days above. The seam is small, it is typed,
   and production never touches it: `backend()` falls through to IndexedDB
   whenever nothing was injected.
   =========================================================================== */

import {
  projectJourney,
  validateAuraProject,
  type AuraProject,
  type JourneyStepId,
  type JourneyStepStatus,
} from "./document";

const DB_NAME = "aura-projects";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_META = "meta";
const ACTIVE_KEY = "active-project";

/* ---------------------------------------------------------------------------
   failures, named — and each one says three separate things
   --------------------------------------------------------------------------- */

export type ProjectStoreFailure =
  /** no IndexedDB at all: a server render, a worker, a browser without it */
  | "unavailable"
  /** private browsing, blocked site data, or another tab holding the schema */
  | "blocked"
  /** this origin's disk allowance is full */
  | "quota"
  /** a record written by a newer build of Aura */
  | "version"
  /** a record that is not a project this build understands */
  | "corrupt"
  | "notfound"
  | "unknown";

/**
 * One failure, told in the order a person needs it.
 *
 * `saved` is not decoration. "The write failed" and "the write failed and
 * your open project is untouched" are the same event and completely different
 * news, and the second one is what stops somebody closing the tab in a panic.
 */
export interface ProjectStorageDiagnosis {
  kind: ProjectStoreFailure;
  /** what happened, in one line */
  headline: string;
  /** what was written and what was not */
  saved: string;
  /** the way out, as something to do */
  wayOut: string;
}

const PROJECT_STORE_ERROR = "AuraProjectStoreError";

export interface ProjectStoreError extends Error {
  name: typeof PROJECT_STORE_ERROR;
  diagnosis: ProjectStorageDiagnosis;
}

const DIAGNOSES: Record<ProjectStoreFailure, Omit<ProjectStorageDiagnosis, "kind">> = {
  quota: {
    headline: "This browser's storage for Aura is full, so the save was refused.",
    saved: "Nothing was written. The project on screen is exactly as you left it, and every project already saved here is still here.",
    wayOut: "Download an encrypted export now — that copy is portable and unaffected — then delete a project you no longer need and save again.",
  },
  blocked: {
    headline: "This browser will not open its local database.",
    saved: "Nothing was saved and nothing was lost. Aura never got as far as writing.",
    wayOut: "Private windows and blocked site data both do this. Open Aura in a normal window, or allow site data for this address, then reload.",
  },
  unavailable: {
    headline: "This browser has no local database, so a project cannot be kept here.",
    saved: "Nothing was saved. What is on screen exists only until this tab closes.",
    wayOut: "Export the project to a file before you leave, and open it from that file next time.",
  },
  version: {
    headline: "That project was written by a newer version of Aura than this page is running.",
    saved: "Nothing was loaded and nothing was overwritten.",
    wayOut: "Reload the page to pick up the newer build, or open the project in the browser that wrote it.",
  },
  corrupt: {
    headline: "That saved record is not a project this build can read.",
    saved: "Nothing was loaded and nothing was overwritten. The record is still on disk.",
    wayOut: "Open a file export if you have one. The unreadable record is left untouched in case a later build can read it.",
  },
  notfound: {
    headline: "That project is no longer in this browser.",
    saved: "Nothing changed. Every other project is still here.",
    wayOut: "Reload the list, or import the project from an export file.",
  },
  unknown: {
    headline: "The local database failed in a way Aura does not recognise.",
    saved: "Treat the last change as unsaved until the list below shows it.",
    wayOut: "Reload the page. If it happens again, export what you can and note the message below.",
  },
};

/** A fresh copy every time — callers may localise or extend one without
 *  editing the table every other caller reads. */
export function projectStorageDiagnosis(
  kind: ProjectStoreFailure,
  detail?: string,
): ProjectStorageDiagnosis {
  const base = DIAGNOSES[kind];
  return {
    kind,
    headline: detail ? `${base.headline} (${detail})` : base.headline,
    saved: base.saved,
    wayOut: base.wayOut,
  };
}

/** The three facts, in order, as one throwable. `.message` reads as a
 *  paragraph for a console; `.diagnosis` keeps them separate for the UI. */
function errorFromDiagnosis(diagnosis: ProjectStorageDiagnosis): ProjectStoreError {
  const error = new Error(`${diagnosis.headline} ${diagnosis.saved} ${diagnosis.wayOut}`) as ProjectStoreError;
  error.name = PROJECT_STORE_ERROR;
  error.diagnosis = diagnosis;
  return error;
}

function storeError(kind: ProjectStoreFailure, detail?: string): ProjectStoreError {
  return errorFromDiagnosis(projectStorageDiagnosis(kind, detail));
}

export function isProjectStoreError(value: unknown): value is ProjectStoreError {
  return value instanceof Error
    && value.name === PROJECT_STORE_ERROR
    && typeof (value as ProjectStoreError).diagnosis === "object";
}

/** True for the several spellings browsers use for "the disk is full". */
function isQuota(value: unknown): boolean {
  if (typeof DOMException !== "undefined" && value instanceof DOMException) {
    // 22 is the legacy QUOTA_EXCEEDED_ERR; 1014 is Firefox's older NS code
    return value.name === "QuotaExceededError" || value.code === 22 || value.code === 1014;
  }
  return value instanceof Error && value.name === "QuotaExceededError";
}

/**
 * Anything thrown anywhere below this line → a diagnosis a person can act on.
 *
 * Callers catch once and render three fields; nothing in the interface has to
 * guess at a DOMException name.
 */
export function diagnoseProjectStorageError(value: unknown): ProjectStorageDiagnosis {
  if (isProjectStoreError(value)) return value.diagnosis;
  if (isQuota(value)) return projectStorageDiagnosis("quota");
  if (typeof DOMException !== "undefined" && value instanceof DOMException) {
    if (value.name === "SecurityError" || value.name === "InvalidStateError" || value.name === "NotAllowedError") {
      return projectStorageDiagnosis("blocked", value.name);
    }
    if (value.name === "VersionError") return projectStorageDiagnosis("version");
    return projectStorageDiagnosis("unknown", value.name);
  }
  return projectStorageDiagnosis("unknown", value instanceof Error ? value.message : String(value));
}

/* ---------------------------------------------------------------------------
   the backend — IndexedDB by default, injectable so failures can be proved
   --------------------------------------------------------------------------- */

export interface ProjectStorageBackend {
  list(): Promise<unknown[]>;
  get(id: string): Promise<unknown>;
  put(project: AuraProject, makeActive: boolean): Promise<void>;
  readActiveId(): Promise<string | null>;
  writeActiveId(id: string | null): Promise<void>;
  remove(id: string): Promise<void>;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? storeError("unknown", "the database request failed"));
  });
}

function database(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(storeError("unavailable"));
      return;
    }
    let open: IDBOpenDBRequest;
    try {
      open = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      // Firefox in a private window throws here rather than erroring later
      reject(storeError("blocked", error instanceof Error ? error.name : undefined));
      return;
    }
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const projects = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
        projects.createIndex("updatedAtISO", "updatedAtISO");
      }
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: "key" });
    };
    open.onsuccess = () => {
      open.result.onversionchange = () => {
        open.result.close();
        databasePromise = null;
      };
      resolve(open.result);
    };
    open.onerror = () => reject(storeError("blocked", open.error?.name));
    open.onblocked = () => reject(storeError("blocked", "another Aura tab is holding the database"));
  }).catch((error) => {
    /* A failed open must not poison every later attempt: a private window can
       be left, site data can be allowed, the other tab can be closed. */
    databasePromise = null;
    throw error;
  });
  databasePromise = opening;
  return opening;
}

async function transaction<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    let bodyDone = false;
    /* Resolve on COMMIT, never on the last request: resolving early would
       report success for a write the browser then aborted on quota — the
       difference between "saved" and "said saved". */
    tx.onerror = () => reject(tx.error ?? storeError("unknown", "the transaction failed"));
    tx.onabort = () => reject(tx.error ?? storeError("unknown", "the transaction was cancelled"));
    work(tx).then(
      (value) => {
        result = value;
        bodyDone = true;
      },
      (error) => {
        reject(error);
        try { tx.abort(); } catch { /* already complete */ }
      },
    );
    tx.oncomplete = () => {
      if (bodyDone) resolve(result);
      else reject(storeError("unknown", "the database finished before its work completed"));
    };
  });
}

const indexedDbBackend: ProjectStorageBackend = {
  async list() {
    const db = await database();
    return request(db.transaction(STORE_PROJECTS, "readonly").objectStore(STORE_PROJECTS).getAll());
  },
  async get(id) {
    const db = await database();
    return request(db.transaction(STORE_PROJECTS, "readonly").objectStore(STORE_PROJECTS).get(id));
  },
  async put(project, makeActive) {
    await transaction([STORE_PROJECTS, STORE_META], "readwrite", async (tx) => {
      await request(tx.objectStore(STORE_PROJECTS).put(project));
      if (makeActive) await request(tx.objectStore(STORE_META).put({ key: ACTIVE_KEY, projectId: project.id }));
    });
  },
  async readActiveId() {
    const db = await database();
    const meta = await request(db.transaction(STORE_META, "readonly").objectStore(STORE_META).get(ACTIVE_KEY)) as
      | { key: string; projectId: string }
      | undefined;
    return meta?.projectId ?? null;
  },
  async writeActiveId(id) {
    const db = await database();
    const meta = db.transaction(STORE_META, "readwrite").objectStore(STORE_META);
    if (id === null) await request(meta.delete(ACTIVE_KEY));
    else await request(meta.put({ key: ACTIVE_KEY, projectId: id }));
  },
  async remove(id) {
    await transaction([STORE_PROJECTS, STORE_META], "readwrite", async (tx) => {
      await request(tx.objectStore(STORE_PROJECTS).delete(id));
      const meta = tx.objectStore(STORE_META);
      const active = await request(meta.get(ACTIVE_KEY)) as { projectId?: string } | undefined;
      // deleting the open project must also clear the pointer to it, or the
      // next load resolves an id that is no longer there
      if (active?.projectId === id) await request(meta.delete(ACTIVE_KEY));
    });
  },
};

let injectedBackend: ProjectStorageBackend | null = null;

/**
 * Replace the storage backend. Pass null to restore IndexedDB.
 *
 * Exists for the failure specs: quota-exceeded and blocked-database are the
 * paths that decide whether somebody loses an afternoon, and they cannot be
 * provoked on demand from a real browser database.
 */
export function setProjectStorageBackend(backend: ProjectStorageBackend | null): void {
  injectedBackend = backend;
  databasePromise = null;
}

function backend(): ProjectStorageBackend {
  return injectedBackend ?? indexedDbBackend;
}

/* ---------------------------------------------------------------------------
   the witness — how an empty store says which kind of empty it is
   --------------------------------------------------------------------------- */

export interface ProjectWitnessStore {
  read(): string | null;
  write(value: string): void;
}

/** What this browser is known to have held. `lastEditedISO` is the newest
 *  project's own timestamp, never a clock read, so the same library always
 *  produces the same witness. */
export interface ProjectLibraryWitness {
  count: number;
  lastEditedISO: string;
  /** a few names, so the message can say WHICH work is missing */
  names: string[];
}

const WITNESS_KEY = "aura.projects.witness.v1";
const WITNESS_NAMES = 6;

const localStorageWitness: ProjectWitnessStore = {
  read() {
    try {
      return typeof localStorage === "undefined" ? null : localStorage.getItem(WITNESS_KEY);
    } catch {
      // a browser that refuses localStorage simply has no witness; that is a
      // missing observation, never a reason to fail a read
      return null;
    }
  },
  write(value) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(WITNESS_KEY, value);
    } catch {
      /* no witness is better than a failed library read */
    }
  },
};

let injectedWitness: ProjectWitnessStore | null = null;

export function setProjectWitnessStore(store: ProjectWitnessStore | null): void {
  injectedWitness = store;
}

function witnessStore(): ProjectWitnessStore {
  return injectedWitness ?? localStorageWitness;
}

export function readProjectLibraryWitness(): ProjectLibraryWitness | null {
  const raw = witnessStore().read();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectLibraryWitness>;
    if (typeof parsed.count !== "number" || !Number.isFinite(parsed.count) || parsed.count <= 0) return null;
    if (typeof parsed.lastEditedISO !== "string" || !Number.isFinite(Date.parse(parsed.lastEditedISO))) return null;
    const names = Array.isArray(parsed.names) ? parsed.names.filter((n): n is string => typeof n === "string") : [];
    return { count: parsed.count, lastEditedISO: parsed.lastEditedISO, names };
  } catch {
    return null;
  }
}

function writeProjectLibraryWitness(projects: AuraProject[]): void {
  const witness: ProjectLibraryWitness = {
    count: projects.length,
    lastEditedISO: projects[0]?.updatedAtISO ?? "",
    names: projects.slice(0, WITNESS_NAMES).map((project) => project.name),
  };
  witnessStore().write(JSON.stringify(witness));
}

/** Accept that the projects the witness remembers are gone, so the notice
 *  stops repeating. Nothing is deleted — there is nothing left to delete. */
export function forgetClearedProjects(): void {
  witnessStore().write(JSON.stringify({ count: 0, lastEditedISO: "", names: [] }));
}

/* ---------------------------------------------------------------------------
   reading and writing projects
   --------------------------------------------------------------------------- */

export async function saveAuraProject(project: AuraProject, makeActive = true): Promise<AuraProject> {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`This project cannot be saved: ${checked.problem}`);
  const saved = checked.project;
  try {
    await backend().put(saved, makeActive);
  } catch (error) {
    throw storeErrorFrom(error);
  }
  return saved;
}

/** Re-throw as a named failure, keeping an already-named one intact. */
function storeErrorFrom(error: unknown): ProjectStoreError {
  return isProjectStoreError(error) ? error : errorFromDiagnosis(diagnoseProjectStorageError(error));
}

export async function readAuraProject(id: string): Promise<AuraProject | null> {
  let raw: unknown;
  try {
    raw = await backend().get(id);
  } catch (error) {
    throw storeErrorFrom(error);
  }
  if (raw === undefined || raw === null) return null;
  const checked = validateAuraProject(raw);
  if (!checked.ok) throw storeError(checked.futureVersion ? "version" : "corrupt", checked.problem);
  return checked.project;
}

export async function readActiveAuraProject(): Promise<AuraProject | null> {
  let id: string | null;
  try {
    id = await backend().readActiveId();
  } catch (error) {
    throw storeErrorFrom(error);
  }
  return id ? readAuraProject(id) : null;
}

export async function listAuraProjects(): Promise<AuraProject[]> {
  let rows: unknown[];
  try {
    rows = await backend().list();
  } catch (error) {
    throw storeErrorFrom(error);
  }
  return rows
    .flatMap((value) => {
      const checked = validateAuraProject(value);
      return checked.ok ? [checked.project] : [];
    })
    .sort((a, b) => b.updatedAtISO.localeCompare(a.updatedAtISO));
}

export async function setActiveAuraProject(id: string): Promise<AuraProject> {
  const project = await readAuraProject(id);
  if (!project) throw storeError("notfound");
  try {
    await backend().writeActiveId(id);
  } catch (error) {
    throw storeErrorFrom(error);
  }
  return project;
}

export async function duplicateAuraProject(project: AuraProject, id: string, now: Date): Promise<AuraProject> {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`This project cannot be duplicated: ${checked.problem}`);
  const copy: AuraProject = {
    ...structuredClone(checked.project),
    id,
    name: `${checked.project.name} — copy`.slice(0, 96),
    createdAtISO: now.toISOString(),
    updatedAtISO: now.toISOString(),
    archivedAtISO: null,
  };
  return saveAuraProject(copy, true);
}

/** Remove a project for good. The caller is expected to have named it on
 *  screen first — this function cannot un-delete. */
export async function deleteAuraProject(id: string): Promise<void> {
  try {
    await backend().remove(id);
  } catch (error) {
    throw storeErrorFrom(error);
  }
}

/* ---------------------------------------------------------------------------
   the library read the dashboard uses — never throws, always says which
   --------------------------------------------------------------------------- */

export interface ProjectLibraryState {
  projects: AuraProject[];
  /** records on disk this build refused to read; they are left untouched */
  unreadable: number;
  /** set when the store itself could not be read at all */
  storage: ProjectStorageDiagnosis | null;
  /** set ONLY when the store opened cleanly, held nothing, and this browser
   *  is on record as having held projects */
  cleared: ProjectLibraryWitness | null;
}

/**
 * Everything /projects needs to render, including the reasons it cannot.
 *
 * Deliberately total: a dashboard that throws is a blank page, and a blank
 * page is exactly the ambiguity this node exists to remove.
 */
export async function readProjectLibrary(): Promise<ProjectLibraryState> {
  let rows: unknown[];
  try {
    rows = await backend().list();
  } catch (error) {
    /* No cleared-data claim here. "The database would not open" and "the
       database is empty" are different facts, and reporting both at once
       would be telling two stories about one event. */
    return { projects: [], unreadable: 0, storage: diagnoseProjectStorageError(error), cleared: null };
  }

  const projects: AuraProject[] = [];
  let unreadable = 0;
  for (const row of rows) {
    const checked = validateAuraProject(row);
    if (checked.ok) projects.push(checked.project);
    else unreadable += 1;
  }
  projects.sort((a, b) => b.updatedAtISO.localeCompare(a.updatedAtISO));

  const witness = readProjectLibraryWitness();
  const cleared = projects.length === 0 && unreadable === 0 && witness && witness.count > 0 ? witness : null;
  // keep the witness in step with reality — but never while it is the only
  // record that the missing work existed
  if (!cleared) writeProjectLibraryWitness(projects);

  return { projects, unreadable, storage: null, cleared };
}

export interface ProjectStorageEstimate {
  usageBytes: number | null;
  quotaBytes: number | null;
}

/** The browser's own estimate where it has one. Chrome and Firefox report it;
 *  Safari historically does not, and nulls say so rather than guessing. */
export async function estimateProjectStorage(): Promise<ProjectStorageEstimate> {
  if (typeof navigator === "undefined" || !navigator.storage || !navigator.storage.estimate) {
    return { usageBytes: null, quotaBytes: null };
  }
  try {
    const estimate = await navigator.storage.estimate();
    return {
      usageBytes: typeof estimate.usage === "number" ? estimate.usage : null,
      quotaBytes: typeof estimate.quota === "number" ? estimate.quota : null,
    };
  } catch {
    return { usageBytes: null, quotaBytes: null };
  }
}

/* ---------------------------------------------------------------------------
   restore — name what will be overwritten BEFORE anything is written
   --------------------------------------------------------------------------- */

export interface ProjectRestoreTarget {
  id: string;
  name: string;
  updatedAtISO: string;
  designHash: string;
}

export interface ProjectRestorePlan {
  incoming: AuraProject;
  /** the record an overwrite would replace, named in full, or null when this
   *  restore adds a project and replaces nothing */
  overwrites: ProjectRestoreTarget | null;
  /** the id of the project currently open, so the plan can say whether the
   *  record about to be replaced is the one on screen */
  activeId: string | null;
}

/**
 * Work out what a restore would do — without doing any of it.
 *
 * Reading the collision first is the whole point: "import" that silently
 * replaces four months of decisions because two files share an id is the
 * failure this separation exists to prevent.
 */
export async function planAuraProjectRestore(project: AuraProject): Promise<ProjectRestorePlan> {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw storeError(checked.futureVersion ? "version" : "corrupt", checked.problem);
  const incoming = checked.project;

  let existingRaw: unknown;
  let activeId: string | null;
  try {
    existingRaw = await backend().get(incoming.id);
    activeId = await backend().readActiveId();
  } catch (error) {
    throw storeErrorFrom(error);
  }

  let overwrites: ProjectRestoreTarget | null = null;
  if (existingRaw !== undefined && existingRaw !== null) {
    const existing = validateAuraProject(existingRaw);
    overwrites = existing.ok
      ? {
          id: existing.project.id,
          name: existing.project.name,
          updatedAtISO: existing.project.updatedAtISO,
          designHash: existing.project.design.documentHash,
        }
      : {
          /* An unreadable record still occupies the id, so a restore would
             still replace it. Saying "a saved record this build cannot read"
             is more useful than pretending the slot is empty. */
          id: incoming.id,
          name: "a saved record this build cannot read",
          updatedAtISO: "",
          designHash: "",
        };
  }

  return { incoming, overwrites, activeId };
}

export type ProjectRestoreChoice = "overwrite" | "keep-both";

/**
 * Carry out a plan.
 *
 * `keep-both` is the way out of every collision: the incoming project is
 * saved under a fresh id and a distinguishable name, and the record the plan
 * named is not touched. `newId` is supplied by the caller for the same reason
 * `duplicateAuraProject` takes one — this file does not read a clock or a
 * random source that a caller cannot reproduce.
 */
export async function applyAuraProjectRestore(
  plan: ProjectRestorePlan,
  choice: ProjectRestoreChoice,
  newId: string,
): Promise<AuraProject> {
  if (choice === "overwrite") return saveAuraProject(plan.incoming, true);
  const copy: AuraProject = {
    ...structuredClone(plan.incoming),
    id: newId,
    name: `${plan.incoming.name} — restored`.slice(0, 96),
  };
  return saveAuraProject(copy, true);
}

/* ---------------------------------------------------------------------------
   the dashboard row — every field read from the project, none invented
   --------------------------------------------------------------------------- */

export const JOURNEY_LABEL: Record<AuraProject["journey"], string> = {
  "find-land-build": "Find land and build",
  "build-on-owned-land": "Build on your own land",
  "buy-finished-home": "Buy a finished home",
};

export const STEP_LABEL: Record<JourneyStepId, string> = {
  requirements: "Requirements",
  design: "Design",
  land: "Land",
  team: "Team",
  quotes: "Quotes",
  funding: "Funding",
  build: "Build",
  operate: "Operate",
};

export const STEP_STATUS_LABEL: Record<JourneyStepStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  blocked: "Blocked",
  complete: "Confirmed",
};

export interface ProjectDashboardRow {
  id: string;
  name: string;
  journeyLabel: string;
  /** the stage the project is actually on — `recommendedNextAction`'s step,
   *  or the first unconfirmed one */
  stageId: JourneyStepId;
  stageLabel: string;
  stageStatus: JourneyStepStatus;
  stageStatusLabel: string;
  stepsComplete: number;
  stepsTotal: number;
  lastEditedISO: string;
  /** blockers still open; resolved ones are history, not a count */
  openBlockers: number;
  /** the first ten characters of the design hash — enough to compare two
   *  documents by eye, short enough not to read as a wall of hex */
  designHashShort: string;
  archived: boolean;
  nextAction: { label: string; reason: string } | null;
}

export function projectDashboardRow(project: AuraProject): ProjectDashboardRow {
  const journey = projectJourney(project);
  const stageId = journey.next.id;
  return {
    id: project.id,
    name: project.name,
    journeyLabel: JOURNEY_LABEL[project.journey],
    stageId,
    stageLabel: STEP_LABEL[stageId],
    stageStatus: journey.next.status,
    stageStatusLabel: STEP_STATUS_LABEL[journey.next.status],
    stepsComplete: journey.steps.filter((step) => step.complete).length,
    stepsTotal: journey.steps.length,
    lastEditedISO: project.updatedAtISO,
    openBlockers: project.blockers.filter((blocker) => blocker.resolvedAtISO === null).length,
    designHashShort: project.design.documentHash.slice(0, 10),
    archived: project.archivedAtISO !== null,
    nextAction: project.recommendedNextAction
      ? { label: project.recommendedNextAction.label, reason: project.recommendedNextAction.reason }
      : null,
  };
}
