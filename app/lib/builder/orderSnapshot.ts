import {
  ORDER_SNAPSHOT_FORMAT,
  ORDER_SNAPSHOT_VERSION,
  type BuilderOrderHomeChoice,
  type OrderSnapshot,
} from "@agent/concierge/order";
import type { OrderQuote } from "@agent/concierge/order";
import { keccak256, stringToHex } from "viem";

import {
  canonicalBuilderDocumentJson,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "./document";
import { groundFootprintSqFt, totalFloorAreaSqFt } from "./spec";
import { summarizeBuildingGraph } from "./graphGeometry";

export type BuilderOrderSnapshot = OrderSnapshot<BuilderDocument>;

export type BuilderOrderSnapshotValidation =
  | { ok: true; snapshot: BuilderOrderSnapshot }
  | { ok: false; problem: string; futureVersion?: number };

const DB_NAME = "aura-order-handoffs";
const DB_VERSION = 1;
const STORE_SNAPSHOTS = "snapshots";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value !== "object" || value === null || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalValue(value[key]);
  return out;
}

function hashCanonicalValue(value: unknown): string {
  return keccak256(stringToHex(JSON.stringify(canonicalValue(value))));
}

function safeProjectId(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 96);
  if (!cleaned) throw new Error("An order handoff needs a project identifier.");
  return cleaned;
}

export function newOrderProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `project-${crypto.randomUUID()}`;
  }
  return `project-${Date.now().toString(36)}`;
}

interface DocumentMeasures {
  area: number;
  footprint: number;
  storeys: 1 | 2;
  volumeCount: number;
}

function documentMeasures(document: BuilderDocument): DocumentMeasures {
  if (document.geometry.kind === "building-graph") {
    const summary = summarizeBuildingGraph(document.geometry.graph);
    return {
      area: summary.totalFloorAreaSqFt,
      footprint: summary.groundFootprintSqFt,
      storeys: document.geometry.graph.storeys.length === 1 ? (1 as const) : (2 as const),
      volumeCount: document.geometry.graph.storeys.reduce(
        (sum, storey) => sum + storey.slabs.length,
        0,
      ),
    };
  }
  return {
    area: totalFloorAreaSqFt(document.spec),
    footprint: groundFootprintSqFt(document.spec),
    storeys: document.spec.volumes.some((volume) => volume.storeys > 1) ? 2 : 1,
    volumeCount: document.spec.volumes.length,
  };
}

export function createBuilderOrderSnapshot(
  source: BuilderDocument,
  now: Date,
  projectId = newOrderProjectId(),
): BuilderOrderSnapshot {
  const checked = validateBuilderDocument(source);
  if (!checked.ok) throw new Error(`Cannot continue with this design: ${checked.problem}`);
  const id = safeProjectId(projectId);
  const design = JSON.parse(canonicalBuilderDocumentJson(checked.document)) as BuilderDocument;
  const documentHash = hashBuilderDocument(design);
  const measures = documentMeasures(design);
  const atISO = now.toISOString();
  const home: BuilderOrderHomeChoice = {
    kind: "builder",
    projectId: id,
    name: design.spec.name,
    sizeSqft: measures.area,
    fulfillment: "sip-site-built",
    fulfillmentPath: "aura-concierge",
    documentVersion: design.version,
    documentHash,
    designSummary: {
      material: design.spec.material,
      climateZone: design.spec.climateZone,
      volumeCount: measures.volumeCount,
      storeys: measures.storeys,
      footprintSqft: measures.footprint,
    },
    artifactHashes: { designDocument: documentHash },
    quoteBasis: {
      kind: "estimate",
      jurisdiction: "Alberta, Canada",
      source: "data/alberta/cost-model.json",
      currency: "CAD",
      exclusions: [
        "Land purchase price",
        "GST and financing costs",
        "Unknown site conditions, utility extensions and authority-specific requirements",
        "Final supplier, contractor, engineering and permit quotes",
      ],
      assumptions: [
        "Design geometry is fixed to the BuilderDocument hash shown in the order.",
        "The current cost model scales the reference Alberta build by graph-derived floor area; it is not a material takeoff.",
        "Room programme and system sizing use the concierge baseline until confirmed with the owner.",
      ],
    },
    atISO,
  };
  return deepFreeze({
    format: ORDER_SNAPSHOT_FORMAT,
    version: ORDER_SNAPSHOT_VERSION,
    id,
    projectId: id,
    createdAtISO: atISO,
    home,
    design,
    quote: null,
    artifactHashes: { designDocument: documentHash },
  });
}

export function createQuotedBuilderOrderSnapshot(
  initial: BuilderOrderSnapshot,
  quote: OrderQuote,
): BuilderOrderSnapshot {
  const checked = validateBuilderOrderSnapshot(initial);
  if (!checked.ok) throw new Error(`Cannot attach a quote: ${checked.problem}`);
  if (checked.snapshot.quote !== null)
    throw new Error("A quote snapshot cannot be overwritten; start from the design snapshot.");
  if (quote.designHash !== checked.snapshot.home.documentHash)
    throw new Error("The quote design hash does not match this immutable builder design.");
  if (!quote.budget)
    throw new Error("A builder quote must carry the cost-model budget it was calculated from.");

  const quoteClone = JSON.parse(JSON.stringify(quote)) as OrderQuote;
  const quoteHash = hashCanonicalValue(quoteClone);
  const budgetHash = hashCanonicalValue(quoteClone.budget);
  return deepFreeze({
    ...checked.snapshot,
    id: `${checked.snapshot.projectId}-quote-${quoteHash.slice(2, 14)}`,
    quote: quoteClone,
    artifactHashes: {
      ...checked.snapshot.artifactHashes,
      budget: budgetHash,
      quote: quoteHash,
    },
  });
}

export function validateBuilderOrderSnapshot(value: unknown): BuilderOrderSnapshotValidation {
  if (!isObject(value)) return { ok: false, problem: "Order snapshot is not an object." };
  if (value.format !== ORDER_SNAPSHOT_FORMAT)
    return { ok: false, problem: "That record is not an Aura order snapshot." };
  if (typeof value.version === "number" && value.version > ORDER_SNAPSHOT_VERSION) {
    return {
      ok: false,
      problem: `This order handoff was written by a newer build (v${value.version}; this build reads v${ORDER_SNAPSHOT_VERSION}). Nothing was loaded or overwritten.`,
      futureVersion: value.version,
    };
  }
  if (value.version !== ORDER_SNAPSHOT_VERSION)
    return { ok: false, problem: `Unsupported order snapshot version ${String(value.version)}.` };
  if (typeof value.projectId !== "string" || typeof value.id !== "string")
    return { ok: false, problem: "Order snapshot project identifiers are missing." };
  if (typeof value.createdAtISO !== "string" || !Number.isFinite(Date.parse(value.createdAtISO)))
    return { ok: false, problem: "Order snapshot has no valid creation time." };

  const document = validateBuilderDocument(value.design);
  if (!document.ok) return { ok: false, problem: `Order design is unreadable: ${document.problem}` };
  if (!isObject(value.home) || value.home.kind !== "builder")
    return { ok: false, problem: "Order snapshot has no builder home choice." };
  if (!isObject(value.artifactHashes) || typeof value.artifactHashes.designDocument !== "string")
    return { ok: false, problem: "Order snapshot has no design artifact hash." };

  const actualHash = hashBuilderDocument(document.document);
  if (
    value.home.documentHash !== actualHash ||
    value.artifactHashes.designDocument !== actualHash ||
    !isObject(value.home.artifactHashes) ||
    value.home.artifactHashes.designDocument !== actualHash
  ) {
    return {
      ok: false,
      problem: `Order design hash mismatch: the stored design resolves to ${actualHash}. Nothing was loaded.`,
    };
  }
  if (value.home.projectId !== value.projectId || value.home.documentVersion !== document.document.version)
    return { ok: false, problem: "Order home identity does not match its project or document version." };
  const measures = documentMeasures(document.document);
  if (
    typeof value.home.name !== "string" ||
    value.home.name !== document.document.spec.name ||
    value.home.sizeSqft !== measures.area ||
    value.home.fulfillment !== "sip-site-built" ||
    value.home.fulfillmentPath !== "aura-concierge" ||
    typeof value.home.atISO !== "string" ||
    !Number.isFinite(Date.parse(value.home.atISO))
  ) {
    return { ok: false, problem: "Order home summary does not match its builder document." };
  }
  if (
    !isObject(value.home.designSummary) ||
    value.home.designSummary.material !== document.document.spec.material ||
    value.home.designSummary.climateZone !== document.document.spec.climateZone ||
    value.home.designSummary.volumeCount !== measures.volumeCount ||
    value.home.designSummary.storeys !== measures.storeys ||
    value.home.designSummary.footprintSqft !== measures.footprint
  ) {
    return { ok: false, problem: "Order design summary does not match its geometry." };
  }
  const basis = value.home.quoteBasis;
  if (
    !isObject(basis) ||
    basis.kind !== "estimate" ||
    basis.currency !== "CAD" ||
    typeof basis.jurisdiction !== "string" ||
    typeof basis.source !== "string" ||
    !Array.isArray(basis.assumptions) ||
    !basis.assumptions.every((item) => typeof item === "string") ||
    !Array.isArray(basis.exclusions) ||
    !basis.exclusions.every((item) => typeof item === "string")
  ) {
    return { ok: false, problem: "Order quote basis is incomplete or invalid." };
  }

  if (value.quote === null) {
    if (value.id !== value.projectId)
      return { ok: false, problem: "An unquoted design snapshot must use its project identifier." };
    if (value.artifactHashes.budget !== undefined || value.artifactHashes.quote !== undefined)
      return { ok: false, problem: "An unquoted design snapshot cannot carry quote artifact hashes." };
  } else {
    if (!isObject(value.quote) || value.quote.designHash !== actualHash || !isObject(value.quote.budget))
      return { ok: false, problem: "Quoted snapshot is missing its hash-bound builder budget." };
    if (
      typeof value.quote.generatedAtISO !== "string" ||
      typeof value.quote.validUntilISO !== "string" ||
      !Number.isFinite(Date.parse(value.quote.generatedAtISO)) ||
      !Number.isFinite(Date.parse(value.quote.validUntilISO))
    ) {
      return { ok: false, problem: "Quoted snapshot has invalid quote validity times." };
    }
    const quoteHash = hashCanonicalValue(value.quote);
    const budgetHash = hashCanonicalValue(value.quote.budget);
    if (value.artifactHashes.quote !== quoteHash || value.artifactHashes.budget !== budgetHash)
      return { ok: false, problem: "Quoted snapshot artifact hash mismatch. Nothing was loaded." };
    if (!value.id.startsWith(`${value.projectId}-quote-`))
      return { ok: false, problem: "Quoted snapshot id is not bound to its project." };
  }

  const normalized = JSON.parse(JSON.stringify(value)) as BuilderOrderSnapshot;
  return {
    ok: true,
    snapshot: deepFreeze({ ...normalized, design: document.document }),
  };
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser has no IndexedDB. Download the .aura.json project instead."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        request.result.createObjectStore(STORE_SNAPSHOTS, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("The order handoff database did not open."));
    request.onblocked = () => reject(new Error("Another tab is blocking the order handoff database."));
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        dbPromise = null;
      };
      resolve(request.result);
    };
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

export async function saveBuilderOrderSnapshot(snapshot: BuilderOrderSnapshot): Promise<void> {
  const checked = validateBuilderOrderSnapshot(snapshot);
  if (!checked.ok) throw new Error(checked.problem);
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_SNAPSHOTS, "readwrite");
    transaction.objectStore(STORE_SNAPSHOTS).add(checked.snapshot);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The order handoff was not saved."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The order handoff write was aborted."));
  });
}

export async function loadBuilderOrderSnapshot(projectId: string): Promise<BuilderOrderSnapshot> {
  const db = await openDb();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = db
      .transaction(STORE_SNAPSHOTS, "readonly")
      .objectStore(STORE_SNAPSHOTS)
      .get(safeProjectId(projectId));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The order handoff could not be read."));
  });
  if (value === undefined) {
    throw new Error(
      "This design handoff is not in this browser. Return to the builder on the original device, or import its .aura.json project and continue again.",
    );
  }
  const checked = validateBuilderOrderSnapshot(value);
  if (!checked.ok) throw new Error(checked.problem);
  return checked.snapshot;
}

export function selectLatestBuilderOrderSnapshot(
  values: readonly unknown[],
  projectId: string,
  options: { requireQuote?: boolean } = {},
): BuilderOrderSnapshot {
  const id = safeProjectId(projectId);
  const matching = values.filter(
    (value) => isObject(value) && value.projectId === id,
  );
  if (matching.length === 0) {
    throw new Error(
      "This project has no local order snapshot. Use the browser that created the quote or recreate the handoff from its .aura.json project.",
    );
  }

  const valid = matching.map((value) => {
    const checked = validateBuilderOrderSnapshot(value);
    if (!checked.ok) {
      throw new Error(`A local order snapshot for this project is unreadable: ${checked.problem}`);
    }
    return checked.snapshot;
  });
  const eligible = options.requireQuote
    ? valid.filter((snapshot) => snapshot.quote !== null)
    : valid;
  if (eligible.length === 0) {
    throw new Error(
      "This project has no quoted snapshot. Return to the concierge, issue a current quote, and do not register or pay from the design-only handoff.",
    );
  }

  return eligible.sort((left, right) => {
    const leftAt = Date.parse(left.quote?.generatedAtISO ?? left.createdAtISO);
    const rightAt = Date.parse(right.quote?.generatedAtISO ?? right.createdAtISO);
    return rightAt - leftAt || right.id.localeCompare(left.id);
  })[0];
}

export async function loadLatestBuilderOrderSnapshot(
  projectId: string,
  options: { requireQuote?: boolean } = {},
): Promise<BuilderOrderSnapshot> {
  const db = await openDb();
  const values = await new Promise<unknown[]>((resolve, reject) => {
    const request = db
      .transaction(STORE_SNAPSHOTS, "readonly")
      .objectStore(STORE_SNAPSHOTS)
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The order snapshots could not be read."));
  });
  return selectLatestBuilderOrderSnapshot(values, projectId, options);
}
