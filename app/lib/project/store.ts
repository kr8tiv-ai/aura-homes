import { validateAuraProject, type AuraProject } from "./document";

const DB_NAME = "aura-projects";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_META = "meta";
const ACTIVE_KEY = "active-project";

let databasePromise: Promise<IDBDatabase> | null = null;

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error("The project database request failed."));
  });
}

function database(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not provide local project storage."));
      return;
    }
    const open = indexedDB.open(DB_NAME, DB_VERSION);
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
    open.onerror = () => reject(open.error ?? new Error("The project database could not be opened."));
    open.onblocked = () => reject(new Error("Another Aura tab is blocking the project database upgrade."));
  }).catch((error) => {
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
    tx.onerror = () => reject(tx.error ?? new Error("The project database transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("The project database transaction was cancelled."));
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
      else reject(new Error("The project database finished before its work completed."));
    };
  });
}

export async function saveAuraProject(project: AuraProject, makeActive = true): Promise<AuraProject> {
  const checked = validateAuraProject(project);
  if (!checked.ok) throw new Error(`This project cannot be saved: ${checked.problem}`);
  const saved = checked.project;
  await transaction([STORE_PROJECTS, STORE_META], "readwrite", async (tx) => {
    await request(tx.objectStore(STORE_PROJECTS).put(saved));
    if (makeActive) await request(tx.objectStore(STORE_META).put({ key: ACTIVE_KEY, projectId: saved.id }));
  });
  return saved;
}

export async function readAuraProject(id: string): Promise<AuraProject | null> {
  const db = await database();
  const raw = await request(db.transaction(STORE_PROJECTS, "readonly").objectStore(STORE_PROJECTS).get(id));
  if (raw === undefined) return null;
  const checked = validateAuraProject(raw);
  if (!checked.ok) throw new Error(`The saved project cannot be opened: ${checked.problem}`);
  return checked.project;
}

export async function readActiveAuraProject(): Promise<AuraProject | null> {
  const db = await database();
  const meta = await request(db.transaction(STORE_META, "readonly").objectStore(STORE_META).get(ACTIVE_KEY)) as
    | { key: string; projectId: string }
    | undefined;
  return meta?.projectId ? readAuraProject(meta.projectId) : null;
}

export async function listAuraProjects(): Promise<AuraProject[]> {
  const db = await database();
  const raw = await request(db.transaction(STORE_PROJECTS, "readonly").objectStore(STORE_PROJECTS).getAll());
  return raw.flatMap((value) => {
    const checked = validateAuraProject(value);
    return checked.ok ? [checked.project] : [];
  }).sort((a, b) => b.updatedAtISO.localeCompare(a.updatedAtISO));
}

export async function setActiveAuraProject(id: string): Promise<AuraProject> {
  const project = await readAuraProject(id);
  if (!project) throw new Error("That project no longer exists in this browser.");
  const db = await database();
  await request(db.transaction(STORE_META, "readwrite").objectStore(STORE_META).put({ key: ACTIVE_KEY, projectId: id }));
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
