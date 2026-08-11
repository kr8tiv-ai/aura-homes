import { expect, test } from "playwright/test";

import { DEFAULT_SETTINGS } from "@/lib/builder/comfort";
import {
  BUILDER_DOCUMENT_FORMAT,
  BUILDER_DOCUMENT_VERSION,
  builderDocumentFromLegacySpec,
  canonicalBuilderDocumentJson,
  defaultBuilderDocument,
  hashBuilderDocument,
  validateBuilderDocument,
} from "@/lib/builder/document";
import { addFixture, emptyFixtureSet } from "@/lib/builder/fixtures";
import { defaultSpec } from "@/lib/builder/spec";

test("a legacy HomeSpec migrates into a complete builder document", () => {
  const spec = defaultSpec();
  const migrated = builderDocumentFromLegacySpec(spec);

  expect(migrated.format).toBe(BUILDER_DOCUMENT_FORMAT);
  expect(migrated.version).toBe(BUILDER_DOCUMENT_VERSION);
  expect(migrated.geometry).toEqual({ kind: "legacy-volumes", source: "spec.volumes" });
  expect(migrated.spec).toEqual(spec);
  expect(migrated.partitions).toEqual([]);
  expect(migrated.finishes).toEqual({});
  expect(migrated.fixtures).toEqual(emptyFixtureSet());
  expect(migrated.comfort).toEqual(DEFAULT_SETTINGS);
  expect(migrated.quarantine.entries).toEqual([]);
});

test("Claude-era editor documents preserve sidecars and exclude transient UI state", () => {
  const spec = defaultSpec();
  const legacy = {
    spec,
    partitions: [
      {
        id: "p1",
        volumeId: spec.volumes[0].id,
        axis: "x" as const,
        atFt: 0,
        fromFt: -4,
        toFt: 4,
        thicknessFt: 0.4,
        door: { atFt: 0, widthFt: 2.75 },
      },
    ],
    overrides: { [`vol:${spec.volumes[0].id}/wall:n`]: "timber-cladding" },
    fixtures: emptyFixtureSet(),
    comfort: DEFAULT_SETTINGS,
    selectedTab: "comfort",
    camera: { x: 99, y: 99, z: 99 },
    heatmapVisible: true,
  };

  const result = validateBuilderDocument(legacy);
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.migratedFrom).toBe("editor-doc");
  expect(result.document.partitions).toHaveLength(1);
  expect(result.document.finishes).toEqual(legacy.overrides);
  expect(result.document.comfort).toEqual(DEFAULT_SETTINGS);
  expect(canonicalBuilderDocumentJson(result.document)).not.toMatch(
    /selectedTab|camera|heatmapVisible/,
  );
});

test("future document versions fail visibly without being interpreted", () => {
  const future = {
    ...defaultBuilderDocument(),
    version: BUILDER_DOCUMENT_VERSION + 1,
    futureGeometry: { kind: "teleporter" },
  };

  const result = validateBuilderDocument(future);
  expect(result.ok).toBe(false);
  if (result.ok) return;

  expect(result.futureVersion).toBe(BUILDER_DOCUMENT_VERSION + 1);
  expect(result.problem).toContain("newer version");
});

test("canonical JSON and keccak256 identity ignore object key insertion order", () => {
  const original = defaultBuilderDocument();
  const reordered = {
    quarantine: original.quarantine,
    comfort: {
      targets: original.comfort.targets,
      conditions: {
        summerRhPct: original.comfort.conditions.summerRhPct,
        winterIndoorC: original.comfort.conditions.winterIndoorC,
        summerIndoorC: original.comfort.conditions.summerIndoorC,
        winterRhPct: original.comfort.conditions.winterRhPct,
      },
    },
    fixtures: original.fixtures,
    finishes: original.finishes,
    partitions: original.partitions,
    geometry: original.geometry,
    spec: {
      notes: original.spec.notes,
      siting: original.spec.siting,
      deck: original.spec.deck,
      volumes: original.spec.volumes,
      climateZone: original.spec.climateZone,
      material: original.spec.material,
      name: original.spec.name,
      version: original.spec.version,
    },
    version: original.version,
    format: original.format,
  };

  const parsed = validateBuilderDocument(reordered);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;

  expect(canonicalBuilderDocumentJson(original)).toBe(
    canonicalBuilderDocumentJson(parsed.document),
  );
  expect(hashBuilderDocument(original)).toBe(hashBuilderDocument(parsed.document));
  expect(hashBuilderDocument(original)).toMatch(/^0x[0-9a-f]{64}$/);
});

test("invalid nested values are refused instead of silently entering the document", () => {
  const invalid = {
    ...defaultBuilderDocument(),
    comfort: {
      ...DEFAULT_SETTINGS,
      conditions: { ...DEFAULT_SETTINGS.conditions, winterRhPct: Number.NaN },
    },
  };

  const result = validateBuilderDocument(invalid);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.problem).toContain("comfort.conditions.winterRhPct");
});

test("non-finite fixture dimensions cannot enter canonical project JSON", () => {
  const document = defaultBuilderDocument();
  const added = addFixture(document.spec, document.fixtures, "wood-stove");
  expect(added.id).not.toBeNull();
  const fixture = added.set.items[0];
  const dimension = Object.keys(fixture.dims)[0];
  const invalid = {
    ...document,
    fixtures: {
      ...added.set,
      items: [
        {
          ...fixture,
          dims: { ...fixture.dims, [dimension]: Number.NaN },
        },
      ],
    },
  };

  const result = validateBuilderDocument(invalid);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.problem).toContain("fixtures");
});

test("the default document has a stable known keccak256 identity", () => {
  const document = defaultBuilderDocument();
  const changed = { ...document, spec: { ...document.spec, notes: "Changed" } };

  expect(hashBuilderDocument(document)).toBe(
    "0x46fadeafd22a70cadb756721e1c1e6cddb5d7184b735644132ff957314ce2f3c",
  );
  expect(hashBuilderDocument(changed)).not.toBe(hashBuilderDocument(document));
});
