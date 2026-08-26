import { comfortRooms, comfortRoomsFromGraph } from "./comfort";
import {
  BUILDER_DOCUMENT_VERSION,
  hashBuilderDocument,
  validateBuilderDocument,
  type BuilderDocument,
} from "./document";
import { resolveBuilderExportSource, exportSourceLimitation } from "./exportSource";
import { summarizeHome } from "./geometry";
import { summarizeBuildingGraph } from "./graphGeometry";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type ProjectBudgetScenario,
} from "./projectBudget";
import { readDesignReadiness } from "./readiness";
import type { SavedDesign } from "./store";
import {
  checkMeasuredFootprintAgainstParcel,
  checkSpecAgainstParcel,
  type SpecParcelCheck,
} from "./toPlan";

export interface SchemeComparisonContext {
  region: string;
  municipality: string;
  scenario?: ProjectBudgetScenario;
  budgetCapCad: number | null;
}

export interface SchemeDelta {
  areaSqFt: number;
  roomCount: number;
  storeyCount: number;
  costMidCad: number | null;
}

export interface ComparedScheme {
  id: string;
  name: string;
  documentVersion: number;
  savedAt: number;
  designHash: `0x${string}`;
  geometry: "legacy-volumes" | "planar-graph";
  program: {
    roomCount: number;
    roomNames: string[];
    storeyCount: number;
    blockedReason: string | null;
  };
  areaSqFt: number;
  cost:
    | {
        status: "available";
        currency: "CAD";
        lowCad: number;
        midCad: number;
        highCad: number;
        budgetHash: `0x${string}`;
        gaps: string[];
      }
    | { status: "unavailable"; problem: string };
  constraints: {
    state: "design-intent" | "review-ready";
    blockers: string[];
    warnings: string[];
    quarantinedItems: number;
  };
  exports: {
    completeProject: "available";
    canonicalHash: `0x${string}`;
    additionalFormats: "available" | "format-dependent" | "held-for-repair";
    limitation: string | null;
    durableDetailCounts: {
      partitions: number;
      finishes: number;
      fixtures: number;
      quarantinedItems: number;
    };
  };
  delta: SchemeDelta;
}

export interface SchemeComparison {
  version: "AuraSchemeComparisonV1";
  referenceId: string;
  schemes: ComparedScheme[];
}

export type SchemeComparisonResult =
  | { ok: true; comparison: SchemeComparison }
  | { ok: false; problem: string };

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const item of Object.values(value as Record<string, unknown>)) deepFreeze(item);
  }
  return value;
}

function fail(problem: string): SchemeComparisonResult {
  return { ok: false, problem };
}

function attachedParcelCheck(document: BuilderDocument): SpecParcelCheck | null {
  const parcel = document.site?.parcel;
  if (!parcel) return null;
  const lot = {
    lotWidthFt: parcel.lotWidthFt,
    lotDepthFt: parcel.lotDepthFt,
    frontSetbackFt: parcel.frontSetbackFt,
    sideSetbackFt: parcel.sideSetbackFt,
    rearSetbackFt: parcel.rearSetbackFt,
  };
  if (document.geometry.kind === "building-graph") {
    const summary = summarizeBuildingGraph(document.geometry.graph);
    return checkMeasuredFootprintAgainstParcel(
      document.spec,
      lot,
      {
        widthFt: summary.bounds.widthFt,
        depthFt: summary.bounds.depthFt,
        floorAreaSqFt: summary.totalFloorAreaSqFt,
        storeys: document.geometry.graph.storeys.length > 1 ? 2 : 1,
      },
      "building-graph",
    );
  }
  return checkSpecAgainstParcel(document.spec, lot);
}

function projectScheme(
  record: SavedDesign,
  context: SchemeComparisonContext,
): Omit<ComparedScheme, "delta"> | SchemeComparisonResult {
  if (!record.id.trim()) return fail("A saved scheme has no record id.");
  if (!record.name.trim()) return fail(`Saved scheme ${record.id} has no name.`);
  if (!Number.isSafeInteger(record.updatedAt) || record.updatedAt < 0)
    return fail(`Saved scheme ${record.id} has an invalid saved timestamp.`);
  if (record.documentVersion !== BUILDER_DOCUMENT_VERSION)
    return fail(`Saved scheme ${record.id} uses unsupported document version ${record.documentVersion}.`);

  const checked = validateBuilderDocument(record.document);
  if (!checked.ok) return fail(`Saved scheme ${record.id} is not a readable complete project.`);
  const document = checked.document;
  const designHash = hashBuilderDocument(document);
  if (record.signature !== designHash)
    return fail(`Saved scheme ${record.id} signature does not match its reopened document hash.`);

  const graphGeometry = document.geometry.kind === "building-graph" ? document.geometry : null;
  const graph = graphGeometry?.graph ?? null;
  const summary = graph ? summarizeBuildingGraph(graph) : summarizeHome(document.spec);
  const roomSet = graph ? comfortRoomsFromGraph(graph) : comfortRooms(document.spec);
  const storeyCount = graph
    ? graph.storeys.length
    : Math.max(0, ...document.spec.volumes.map((volume) => volume.storeys));

  let cost: ComparedScheme["cost"];
  let constraints: ComparedScheme["constraints"];
  try {
    const budget = createProjectBudget({
      document,
      scenario: context.scenario ?? defaultProjectBudgetScenario(),
      region: context.region,
      municipality: context.municipality,
      budgetCapCad: context.budgetCapCad,
    });
    const readiness = readDesignReadiness({
      document,
      budget,
      parcelCheck: attachedParcelCheck(document),
    });
    cost = {
      status: "available",
      currency: budget.currency,
      lowCad: budget.total.low,
      midCad: budget.total.mid,
      highCad: budget.total.high,
      budgetHash: budget.budgetHash,
      gaps: [...budget.gaps],
    };
    constraints = {
      state: readiness.state,
      blockers: readiness.gaps.map((gap) => gap.need),
      warnings: [
        ...(graphGeometry?.migrationWarnings ?? []),
        ...(roomSet.blockedReason ? [roomSet.blockedReason] : []),
      ],
      quarantinedItems: document.quarantine.entries.length,
    };
  } catch {
    cost = {
      status: "unavailable",
      problem: "This saved scheme could not be priced with the selected project basis.",
    };
    constraints = {
      state: "design-intent",
      blockers: ["The scheme could not be priced, so its readiness could not be compared."],
      warnings: [
        ...(graphGeometry?.migrationWarnings ?? []),
        ...(roomSet.blockedReason ? [roomSet.blockedReason] : []),
      ],
      quarantinedItems: document.quarantine.entries.length,
    };
  }

  const exportSource = resolveBuilderExportSource(document);
  const limitation = exportSourceLimitation(document);
  const additionalFormats =
    document.quarantine.entries.length > 0
      ? "held-for-repair"
      : limitation
        ? "format-dependent"
        : "available";

  return {
    id: record.id,
    name: record.name,
    documentVersion: record.documentVersion,
    savedAt: record.updatedAt,
    designHash,
    geometry: graph ? "planar-graph" : "legacy-volumes",
    program: {
      roomCount: roomSet.rooms.length,
      roomNames: roomSet.rooms.map((room) => room.name),
      storeyCount,
      blockedReason: roomSet.blockedReason,
    },
    areaSqFt: summary.totalFloorAreaSqFt,
    cost,
    constraints,
    exports: {
      completeProject: "available",
      canonicalHash: exportSource.hash,
      additionalFormats,
      limitation,
      durableDetailCounts: { ...exportSource.durableDetailCounts },
    },
  };
}

export function compareSavedSchemes(
  records: readonly SavedDesign[],
  context: SchemeComparisonContext,
  referenceId: string,
): SchemeComparisonResult {
  try {
    if (!Array.isArray(records)) return fail("Saved schemes must be an array.");
    if (records.length < 2 || records.length > 3)
      return fail("Choose exactly two or three saved schemes to compare.");
    if (typeof referenceId !== "string" || !records.some((record) => record.id === referenceId))
      return fail("The reference scheme must be one of the compared saved records.");

    const ids = new Set<string>();
    const hashes = new Set<string>();
    const projected: Array<Omit<ComparedScheme, "delta">> = [];
    for (const record of records) {
      if (ids.has(record.id)) return fail(`Saved scheme id ${record.id} appears more than once.`);
      ids.add(record.id);
      const scheme = projectScheme(record, context);
      if ("ok" in scheme) return scheme;
      if (hashes.has(scheme.designHash))
        return fail(`Saved schemes ${records[0].id} and ${record.id} are the same canonical design.`);
      hashes.add(scheme.designHash);
      projected.push(scheme);
    }

    const reference = projected.find((scheme) => scheme.id === referenceId)!;
    const referenceCost = reference.cost.status === "available" ? reference.cost.midCad : null;
    const schemes: ComparedScheme[] = projected.map((scheme) => ({
      ...scheme,
      delta: {
        areaSqFt: scheme.areaSqFt - reference.areaSqFt,
        roomCount: scheme.program.roomCount - reference.program.roomCount,
        storeyCount: scheme.program.storeyCount - reference.program.storeyCount,
        costMidCad:
          scheme.cost.status === "available" && referenceCost !== null
            ? scheme.cost.midCad - referenceCost
            : null,
      },
    }));
    return {
      ok: true,
      comparison: deepFreeze({
        version: "AuraSchemeComparisonV1",
        referenceId,
        schemes,
      }),
    };
  } catch {
    return fail("Saved scheme records could not be inspected safely.");
  }
}
