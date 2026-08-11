/**
 * The durable Aura builder document.
 *
 * UI state never belongs here. A selected tab, camera, active season, hover,
 * or heatmap toggle may change how this document is viewed, but none changes
 * the building a person has asked Aura to remember, export, quote, or hash.
 */

import { keccak256, stringToHex, type Hex } from "viem";

import {
  DEFAULT_SETTINGS,
  type ComfortSettings,
  type ComfortTarget,
} from "./comfort";
import {
  FIXTURES_VERSION,
  emptyFixtureSet,
  validateFixtureSet,
  type FixtureSet,
  type PlacedFixture,
} from "./fixtures";
import { defaultSpec, type HomeSpec } from "./spec";
import {
  NO_OVERRIDES,
  validateOverrides,
  type MaterialId,
  type SurfaceOverrides,
} from "./surfaces";
import { validateHomeSpec } from "./share";
import type { Partition, PartitionDoor } from "./walls";

export const BUILDER_DOCUMENT_FORMAT = "aura-builder-document" as const;
export const BUILDER_DOCUMENT_VERSION = 1 as const;

/**
 * Version 1 still derives its shell geometry from `spec.volumes`. Naming that
 * source explicitly prevents a future graph document from being guessed at
 * or half-read as legacy massing.
 */
export interface LegacyVolumeGeometry {
  kind: "legacy-volumes";
  source: "spec.volumes";
}

export type BuilderGeometry = LegacyVolumeGeometry;

export type QuarantineEntry =
  | { kind: "partition"; reason: string; value: Partition }
  | {
      kind: "finish";
      reason: string;
      value: { surfaceId: string; materialId: MaterialId };
    }
  | { kind: "fixture"; reason: string; value: PlacedFixture }
  | {
      kind: "comfort-target";
      reason: string;
      value: { roomId: string; target: ComfortTarget };
    };

export interface BuilderQuarantine {
  entries: QuarantineEntry[];
}

export interface BuilderDocument {
  format: typeof BUILDER_DOCUMENT_FORMAT;
  version: typeof BUILDER_DOCUMENT_VERSION;
  spec: HomeSpec;
  geometry: BuilderGeometry;
  partitions: Partition[];
  finishes: SurfaceOverrides;
  fixtures: FixtureSet;
  comfort: ComfortSettings;
  quarantine: BuilderQuarantine;
}

export type BuilderDocumentMigration = "home-spec" | "editor-doc" | null;

export type BuilderDocumentValidation =
  | {
      ok: true;
      document: BuilderDocument;
      migratedFrom: BuilderDocumentMigration;
    }
  | {
      ok: false;
      problem: string;
      futureVersion?: number;
    };

const geometryFromLegacySpec = (): LegacyVolumeGeometry => ({
  kind: "legacy-volumes",
  source: "spec.volumes",
});

const emptyQuarantine = (): BuilderQuarantine => ({ entries: [] });

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function cloneComfortTarget(raw: unknown, path: string): { ok: true; target: ComfortTarget } | { ok: false; problem: string } {
  if (!isObject(raw)) return { ok: false, problem: `${path} is not an object` };
  const keys = [
    "winterMinC",
    "winterMaxC",
    "summerMinC",
    "summerMaxC",
    "humidityMinPct",
    "humidityMaxPct",
    "illuminanceMinLux",
  ] as const;
  for (const key of keys) {
    if (!isFiniteNumber(raw[key])) return { ok: false, problem: `${path}.${key} must be a finite number` };
  }
  const target: ComfortTarget = {
    winterMinC: raw.winterMinC as number,
    winterMaxC: raw.winterMaxC as number,
    summerMinC: raw.summerMinC as number,
    summerMaxC: raw.summerMaxC as number,
    humidityMinPct: raw.humidityMinPct as number,
    humidityMaxPct: raw.humidityMaxPct as number,
    illuminanceMinLux: raw.illuminanceMinLux as number,
  };
  if (target.winterMinC > target.winterMaxC)
    return { ok: false, problem: `${path}.winterMinC must not exceed winterMaxC` };
  if (target.summerMinC > target.summerMaxC)
    return { ok: false, problem: `${path}.summerMinC must not exceed summerMaxC` };
  if (
    target.humidityMinPct < 0 ||
    target.humidityMaxPct > 100 ||
    target.humidityMinPct > target.humidityMaxPct
  ) {
    return { ok: false, problem: `${path} has an invalid humidity band` };
  }
  if (target.illuminanceMinLux < 0)
    return { ok: false, problem: `${path}.illuminanceMinLux must not be negative` };
  return { ok: true, target };
}

function validateComfort(raw: unknown): { ok: true; settings: ComfortSettings } | { ok: false; problem: string } {
  if (!isObject(raw)) return { ok: false, problem: "comfort is not an object" };
  if (!isObject(raw.conditions)) return { ok: false, problem: "comfort.conditions is not an object" };
  const conditionKeys = [
    "winterIndoorC",
    "winterRhPct",
    "summerIndoorC",
    "summerRhPct",
  ] as const;
  for (const key of conditionKeys) {
    if (!isFiniteNumber(raw.conditions[key])) {
      return { ok: false, problem: `comfort.conditions.${key} must be a finite number` };
    }
  }
  const winterRhPct = raw.conditions.winterRhPct as number;
  const summerRhPct = raw.conditions.summerRhPct as number;
  if (winterRhPct < 0 || winterRhPct > 100)
    return { ok: false, problem: "comfort.conditions.winterRhPct must be between 0 and 100" };
  if (summerRhPct < 0 || summerRhPct > 100)
    return { ok: false, problem: "comfort.conditions.summerRhPct must be between 0 and 100" };
  if (!isObject(raw.targets)) return { ok: false, problem: "comfort.targets is not an object" };

  const targets: Record<string, ComfortTarget> = {};
  for (const roomId of Object.keys(raw.targets).sort()) {
    if (roomId.length === 0) return { ok: false, problem: "comfort.targets has an empty room id" };
    const result = cloneComfortTarget(raw.targets[roomId], `comfort.targets.${roomId}`);
    if (!result.ok) return result;
    targets[roomId] = result.target;
  }

  return {
    ok: true,
    settings: {
      conditions: {
        winterIndoorC: raw.conditions.winterIndoorC as number,
        winterRhPct,
        summerIndoorC: raw.conditions.summerIndoorC as number,
        summerRhPct,
      },
      targets,
    },
  };
}

function cloneDoor(raw: unknown, path: string): { ok: true; door: PartitionDoor | null } | { ok: false; problem: string } {
  if (raw === null) return { ok: true, door: null };
  if (!isObject(raw)) return { ok: false, problem: `${path} is not an object or null` };
  if (!isFiniteNumber(raw.atFt)) return { ok: false, problem: `${path}.atFt must be a finite number` };
  if (!isFiniteNumber(raw.widthFt) || raw.widthFt <= 0)
    return { ok: false, problem: `${path}.widthFt must be a positive finite number` };
  return { ok: true, door: { atFt: raw.atFt, widthFt: raw.widthFt } };
}

function clonePartition(raw: unknown, path: string): { ok: true; partition: Partition } | { ok: false; problem: string } {
  if (!isObject(raw)) return { ok: false, problem: `${path} is not an object` };
  if (typeof raw.id !== "string" || raw.id.length === 0)
    return { ok: false, problem: `${path}.id must be a non-empty string` };
  if (typeof raw.volumeId !== "string" || raw.volumeId.length === 0)
    return { ok: false, problem: `${path}.volumeId must be a non-empty string` };
  if (raw.axis !== "x" && raw.axis !== "z")
    return { ok: false, problem: `${path}.axis must be x or z` };
  for (const key of ["atFt", "fromFt", "toFt", "thicknessFt"] as const) {
    if (!isFiniteNumber(raw[key])) return { ok: false, problem: `${path}.${key} must be a finite number` };
  }
  if ((raw.thicknessFt as number) <= 0)
    return { ok: false, problem: `${path}.thicknessFt must be positive` };
  const door = cloneDoor(raw.door, `${path}.door`);
  if (!door.ok) return door;
  return {
    ok: true,
    partition: {
      id: raw.id,
      volumeId: raw.volumeId,
      axis: raw.axis,
      atFt: raw.atFt as number,
      fromFt: Math.min(raw.fromFt as number, raw.toFt as number),
      toFt: Math.max(raw.fromFt as number, raw.toFt as number),
      thicknessFt: raw.thicknessFt as number,
      door: door.door,
    },
  };
}

function validatePartitions(raw: unknown): { ok: true; partitions: Partition[] } | { ok: false; problem: string } {
  if (!Array.isArray(raw)) return { ok: false, problem: "partitions is not an array" };
  const partitions: Partition[] = [];
  const ids = new Set<string>();
  for (let index = 0; index < raw.length; index += 1) {
    const result = clonePartition(raw[index], `partitions[${index}]`);
    if (!result.ok) return result;
    if (ids.has(result.partition.id))
      return { ok: false, problem: `partitions contains duplicate id ${result.partition.id}` };
    ids.add(result.partition.id);
    partitions.push(result.partition);
  }
  return { ok: true, partitions };
}

function validateFinishes(raw: unknown): { ok: true; finishes: SurfaceOverrides } | { ok: false; problem: string } {
  if (!isObject(raw)) return { ok: false, problem: "finishes is not an object" };
  const finishes = validateOverrides(raw);
  const keys = Object.keys(raw);
  if (Object.keys(finishes).length !== keys.length || keys.some((key) => finishes[key] !== raw[key])) {
    return { ok: false, problem: "finishes contains an unknown surface id or material" };
  }
  return { ok: true, finishes };
}

function containsNonFiniteOrCycle(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === "number") return !Number.isFinite(value);
  if (typeof value !== "object" || value === null) return false;
  if (seen.has(value)) return true;
  seen.add(value);
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.some((child) => containsNonFiniteOrCycle(child, seen));
}

function validateFixtures(raw: unknown): { ok: true; fixtures: FixtureSet } | { ok: false; problem: string } {
  if (!isObject(raw) || !Array.isArray(raw.items))
    return { ok: false, problem: "fixtures is not a fixture set" };
  if (containsNonFiniteOrCycle(raw))
    return { ok: false, problem: "fixtures contains a non-finite number or circular value" };
  const fixtures = validateFixtureSet(raw);
  if (!fixtures || fixtures.items.length !== raw.items.length)
    return { ok: false, problem: "fixtures contains an invalid or unsupported fixture" };
  const ids = new Set(fixtures.items.map((item) => item.id));
  if (ids.size !== fixtures.items.length)
    return { ok: false, problem: "fixtures contains duplicate ids" };
  return { ok: true, fixtures };
}

function validateQuarantine(raw: unknown): { ok: true; quarantine: BuilderQuarantine } | { ok: false; problem: string } {
  if (!isObject(raw) || !Array.isArray(raw.entries))
    return { ok: false, problem: "quarantine.entries is not an array" };
  const entries: QuarantineEntry[] = [];
  for (let index = 0; index < raw.entries.length; index += 1) {
    const entry = raw.entries[index];
    const path = `quarantine.entries[${index}]`;
    if (!isObject(entry) || typeof entry.reason !== "string")
      return { ok: false, problem: `${path} is invalid` };
    if (entry.kind === "partition") {
      const result = clonePartition(entry.value, `${path}.value`);
      if (!result.ok) return result;
      entries.push({ kind: "partition", reason: entry.reason, value: result.partition });
      continue;
    }
    if (entry.kind === "finish") {
      if (!isObject(entry.value) || typeof entry.value.surfaceId !== "string" || typeof entry.value.materialId !== "string")
        return { ok: false, problem: `${path}.value is not a finish` };
      const one = validateFinishes({ [entry.value.surfaceId]: entry.value.materialId });
      if (!one.ok) return { ok: false, problem: `${path}.value is not a known finish` };
      entries.push({
        kind: "finish",
        reason: entry.reason,
        value: {
          surfaceId: entry.value.surfaceId,
          materialId: entry.value.materialId as MaterialId,
        },
      });
      continue;
    }
    if (entry.kind === "fixture") {
      const one = validateFixtures({ version: FIXTURES_VERSION, items: [entry.value] });
      if (!one.ok) return { ok: false, problem: `${path}.value is not a fixture` };
      entries.push({ kind: "fixture", reason: entry.reason, value: one.fixtures.items[0] });
      continue;
    }
    if (entry.kind === "comfort-target") {
      if (!isObject(entry.value) || typeof entry.value.roomId !== "string" || entry.value.roomId.length === 0)
        return { ok: false, problem: `${path}.value is not a comfort target` };
      const target = cloneComfortTarget(entry.value.target, `${path}.value.target`);
      if (!target.ok) return target;
      entries.push({
        kind: "comfort-target",
        reason: entry.reason,
        value: { roomId: entry.value.roomId, target: target.target },
      });
      continue;
    }
    return { ok: false, problem: `${path}.kind is not supported` };
  }
  return { ok: true, quarantine: { entries } };
}

function assembleDocument(
  source: Record<string, unknown>,
  migratedFrom: BuilderDocumentMigration,
): BuilderDocumentValidation {
  const spec = validateHomeSpec(source.spec);
  if (!spec.ok) return { ok: false, problem: `spec: ${spec.problem}` };

  if (
    !isObject(source.geometry) ||
    source.geometry.kind !== "legacy-volumes" ||
    source.geometry.source !== "spec.volumes"
  ) {
    return { ok: false, problem: "geometry is not a supported builder geometry" };
  }
  const partitions = validatePartitions(source.partitions);
  if (!partitions.ok) return partitions;
  const finishes = validateFinishes(source.finishes);
  if (!finishes.ok) return finishes;
  const fixtures = validateFixtures(source.fixtures);
  if (!fixtures.ok) return fixtures;
  const comfort = validateComfort(source.comfort);
  if (!comfort.ok) return comfort;
  const quarantine = validateQuarantine(source.quarantine);
  if (!quarantine.ok) return quarantine;

  return {
    ok: true,
    migratedFrom,
    document: {
      format: BUILDER_DOCUMENT_FORMAT,
      version: BUILDER_DOCUMENT_VERSION,
      spec: spec.spec,
      geometry: geometryFromLegacySpec(),
      partitions: partitions.partitions,
      finishes: finishes.finishes,
      fixtures: fixtures.fixtures,
      comfort: comfort.settings,
      quarantine: quarantine.quarantine,
    },
  };
}

export function builderDocumentFromLegacySpec(spec: HomeSpec): BuilderDocument {
  const result = validateHomeSpec(spec);
  if (!result.ok) throw new Error(`Cannot create a builder document from this spec: ${result.problem}`);
  return {
    format: BUILDER_DOCUMENT_FORMAT,
    version: BUILDER_DOCUMENT_VERSION,
    spec: result.spec,
    geometry: geometryFromLegacySpec(),
    partitions: [],
    finishes: NO_OVERRIDES,
    fixtures: emptyFixtureSet(),
    comfort: {
      conditions: { ...DEFAULT_SETTINGS.conditions },
      targets: {},
    },
    quarantine: emptyQuarantine(),
  };
}

export function defaultBuilderDocument(): BuilderDocument {
  return builderDocumentFromLegacySpec(defaultSpec());
}

export function validateBuilderDocument(value: unknown): BuilderDocumentValidation {
  if (!isObject(value)) return { ok: false, problem: "builder document is not an object" };

  if (value.format === BUILDER_DOCUMENT_FORMAT) {
    if (typeof value.version === "number" && value.version > BUILDER_DOCUMENT_VERSION) {
      return {
        ok: false,
        problem: `This project was written by a newer version of the builder (document v${value.version}; this build reads v${BUILDER_DOCUMENT_VERSION}). Nothing was imported or overwritten.`,
        futureVersion: value.version,
      };
    }
    if (value.version !== BUILDER_DOCUMENT_VERSION) {
      return {
        ok: false,
        problem: `document.version is ${JSON.stringify(value.version)}, this build reads ${BUILDER_DOCUMENT_VERSION}`,
      };
    }
    return assembleDocument(value, null);
  }

  const legacySpec = validateHomeSpec(value);
  if (legacySpec.ok) {
    return {
      ok: true,
      migratedFrom: "home-spec",
      document: builderDocumentFromLegacySpec(legacySpec.spec),
    };
  }

  if ("spec" in value) {
    const legacy: Record<string, unknown> = {
      spec: value.spec,
      geometry: geometryFromLegacySpec(),
      partitions: value.partitions ?? [],
      finishes: value.finishes ?? value.overrides ?? {},
      fixtures: value.fixtures ?? emptyFixtureSet(),
      comfort: value.comfort ?? DEFAULT_SETTINGS,
      quarantine: value.quarantine ?? emptyQuarantine(),
    };
    return assembleDocument(legacy, "editor-doc");
  }

  if (typeof value.format === "string") {
    return { ok: false, problem: `Unsupported project format ${JSON.stringify(value.format)}` };
  }
  return { ok: false, problem: "That value is neither an Aura builder document nor a legacy HomeSpec" };
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) out[key] = canonicalValue(value[key]);
  return out;
}

export function canonicalBuilderDocumentJson(document: BuilderDocument): string {
  const checked = validateBuilderDocument(document);
  if (!checked.ok) throw new Error(`Cannot serialize an invalid builder document: ${checked.problem}`);
  return JSON.stringify(canonicalValue(checked.document));
}

export function hashBuilderDocument(document: BuilderDocument): Hex {
  return keccak256(stringToHex(canonicalBuilderDocumentJson(document)));
}
