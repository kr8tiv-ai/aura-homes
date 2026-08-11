import { expect, test } from "playwright/test";

import { DEFAULT_SETTINGS } from "@/lib/builder/comfort";
import {
  BUILDER_DOCUMENT_FORMAT,
  BUILDER_DOCUMENT_VERSION,
  builderDocumentFromLegacySpec,
  canonicalBuilderDocumentJson,
  defaultBuilderDocument,
  hashBuilderDocument,
  reconcileBuilderDocumentSpec,
  restoreQuarantinedEntry,
  validateBuilderDocument,
} from "@/lib/builder/document";
import { resolveBuilderExportSource } from "@/lib/builder/exportSource";
import { exportGltf, exportSpecJson } from "@/lib/builder/exportSpec";
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

test("geometry edits quarantine every orphan instead of silently deleting it", () => {
  const document = defaultBuilderDocument();
  const volumeId = document.spec.volumes[0].id;
  const withFixture = addFixture(document.spec, document.fixtures, "wood-stove").set;
  const edited = {
    ...document,
    partitions: [
      {
        id: "p1",
        volumeId,
        axis: "x" as const,
        atFt: 0,
        fromFt: -3,
        toFt: 3,
        thicknessFt: 0.4,
        door: null,
      },
    ],
    finishes: { [`vol:${volumeId}/wall:n`]: "timber-cladding" as const },
    fixtures: withFixture,
    comfort: {
      ...document.comfort,
      targets: {
        bedroom: {
          winterMinC: 17,
          winterMaxC: 21,
          summerMinC: 19,
          summerMaxC: 24,
          humidityMinPct: 30,
          humidityMaxPct: 50,
          illuminanceMinLux: 100,
        },
      },
    },
  };
  const noVolumes = { ...document.spec, volumes: [], deck: null };

  const reconciled = reconcileBuilderDocumentSpec(edited, noVolumes);
  expect(reconciled.partitions).toEqual([]);
  expect(reconciled.finishes).toEqual({});
  expect(reconciled.fixtures.items).toEqual([]);
  expect(reconciled.comfort.targets).toEqual({});
  expect(reconciled.quarantine.entries.map((entry) => entry.kind).sort()).toEqual([
    "comfort-target",
    "finish",
    "fixture",
    "partition",
  ]);

  const repeated = reconcileBuilderDocumentSpec(reconciled, noVolumes);
  expect(repeated.quarantine.entries).toHaveLength(4);
});

test("a quarantined item can be restored after its host returns", () => {
  const document = defaultBuilderDocument();
  const volumeId = document.spec.volumes[0].id;
  const withPartition = {
    ...document,
    partitions: [
      {
        id: "p1",
        volumeId,
        axis: "z" as const,
        atFt: 0,
        fromFt: -3,
        toFt: 3,
        thicknessFt: 0.4,
        door: null,
      },
    ],
  };
  const removed = reconcileBuilderDocumentSpec(withPartition, {
    ...document.spec,
    volumes: [],
    deck: null,
  });
  const hostReturned = { ...removed, spec: document.spec };

  const restored = restoreQuarantinedEntry(hostReturned, 0);
  expect(restored.ok).toBe(true);
  if (!restored.ok) return;
  expect(restored.document.partitions.map((partition) => partition.id)).toContain("p1");
  expect(restored.document.quarantine.entries).toEqual([]);
});

test("quarantine preserves newer work that reuses a held semantic id", () => {
  const document = defaultBuilderDocument();
  const volumeId = document.spec.volumes[0].id;
  const partition = {
    id: "p1",
    volumeId,
    axis: "z" as const,
    atFt: 0,
    fromFt: -3,
    toFt: 3,
    thicknessFt: 0.4,
    door: null,
  };
  const withoutVolumes = { ...document.spec, volumes: [], deck: null };
  const firstRemoval = reconcileBuilderDocumentSpec(
    { ...document, partitions: [partition] },
    withoutVolumes,
  );
  const reusedId = {
    ...firstRemoval,
    spec: document.spec,
    partitions: [{ ...partition, atFt: 2 }],
  };

  const secondRemoval = reconcileBuilderDocumentSpec(reusedId, withoutVolumes);
  expect(secondRemoval.quarantine.entries).toHaveLength(2);
  expect(
    secondRemoval.quarantine.entries.map((entry) =>
      entry.kind === "partition" ? entry.value.atFt : null,
    ),
  ).toEqual([0, 2]);
});

test("an export source resolves the complete durable document and its identity", () => {
  const base = defaultBuilderDocument();
  const withFixture = addFixture(base.spec, base.fixtures, "wood-stove").set;
  const document = {
    ...base,
    partitions: [
      {
        id: "partition-1",
        volumeId: base.spec.volumes[0].id,
        axis: "x" as const,
        atFt: 0,
        fromFt: -4,
        toFt: 4,
        thicknessFt: 0.4,
        door: null,
      },
    ],
    finishes: {
      [`vol:${base.spec.volumes[0].id}/wall:n`]: "timber-cladding" as const,
    },
    fixtures: withFixture,
  };

  const source = resolveBuilderExportSource(document);

  expect(source.document).toEqual(document);
  expect(source.spec).toEqual(document.spec);
  expect(source.hash).toBe(hashBuilderDocument(document));
  expect(source.canonicalJson).toBe(canonicalBuilderDocumentJson(document));
  expect(source.migratedFromLegacySpec).toBe(false);
  expect(source.durableDetailCounts).toEqual({
    partitions: 1,
    finishes: 1,
    fixtures: 1,
    quarantinedItems: 0,
  });
});

test("legacy HomeSpec export callers remain readable through migration", () => {
  const spec = defaultSpec();
  const source = resolveBuilderExportSource(spec);

  expect(source.spec).toEqual(spec);
  expect(source.migratedFromLegacySpec).toBe(true);
  expect(source.document.format).toBe(BUILDER_DOCUMENT_FORMAT);
  expect(source.durableDetailCounts).toEqual({
    partitions: 0,
    finishes: 0,
    fixtures: 0,
    quarantinedItems: 0,
  });
});

test("the Aura JSON handoff writes the canonical complete document", async () => {
  const document = defaultBuilderDocument();
  const artifact = exportSpecJson(document);

  expect(artifact.filename).toMatch(/\.aura\.json$/);
  expect(await artifact.blob.text()).toBe(`${canonicalBuilderDocumentJson(document)}\n`);
  expect(artifact.note).toContain(hashBuilderDocument(document));
});

test("glTF metadata carries the complete document, hash and legacy omissions", async () => {
  const THREE = await import("three");
  const base = defaultBuilderDocument();
  const document = {
    ...base,
    partitions: [
      {
        id: "partition-in-gltf",
        volumeId: base.spec.volumes[0].id,
        axis: "z" as const,
        atFt: 0,
        fromFt: -2,
        toFt: 2,
        thicknessFt: 0.4,
        door: null,
      },
    ],
  };
  const root = new THREE.Group();

  const artifact = await exportGltf(root, document);
  const payload = await artifact.blob.text();
  const gltf = JSON.parse(payload) as {
    nodes: Array<{
      extras?: { aura?: { durableDocumentDetailCounts?: { partitions?: number } } };
    }>;
  };

  expect(payload).toContain(hashBuilderDocument(document));
  expect(payload).toContain("partition-in-gltf");
  expect(gltf.nodes[0]?.extras?.aura?.durableDocumentDetailCounts?.partitions).toBe(1);
  expect(payload).toContain("rendered scene does not represent them");
});
