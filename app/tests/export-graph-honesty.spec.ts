import { expect, test } from "playwright/test";
import {
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import { exportGltf, exportObj, specSummary } from "@/lib/builder/exportSpec";

/* Why this file exists.

   A .glb and an .obj exported from a graph-edited home used to carry geometry
   for one house and metadata describing another.

   The mechanism: converting a project to planar-graph geometry freezes
   `document.spec` as a pre-conversion recovery copy, and graph edits never
   touch it. `readiness.ts` knows this and refuses to compute a parcel check
   from it, in its own words, because "a fit verdict computed from it is a
   verdict about a home that no longer exists". The model exporters did not
   know it: they embedded that frozen spec as `aura.spec`, embedded
   `specSummary(spec)` as `aura.derived`, and printed three floor-area totals
   from it into the OBJ header — unconditionally, with a comment promising a
   designer who received only the .glb "still has every dimension".

   Nothing threw. The geometry was correct. The numbers beside it described a
   different building. An external audit found it by reading, 2026-08-14.

   The rule these tests pin: an exported file may omit a quantity, but it may
   never state one that does not describe the geometry in the same file. */

const graphDocument = (): BuilderDocument => {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  if (!converted.ok) throw new Error(`fixture failed to convert: ${converted.problem}`);
  return converted.document;
};

/** A scene root standing in for the builder's.
 *
 *  Deliberately EMPTY, matching document.spec.ts's glTF test. The metadata
 *  under test is read from the document rather than from the geometry, and an
 *  empty group keeps three's GLTFExporter off its buffer-serialisation path —
 *  which reaches for `FileReader` and throws under the Node runner. A single
 *  Mesh here is enough to break the whole spec for a reason that has nothing
 *  to do with what it is testing. */
const sceneRoot = async () => {
  const THREE = await import("three");
  return new THREE.Group();
};

const auraMetadata = async (document: BuilderDocument) => {
  const root = await sceneRoot();
  const artifact = await exportGltf(root, document);
  const gltf = JSON.parse(await artifact.blob.text()) as {
    nodes?: { extras?: { aura?: Record<string, unknown> } }[];
  };
  const withAura = (gltf.nodes ?? []).find((node) => node.extras?.aura);
  return withAura?.extras?.aura;
};

test("the fixture really is graph-backed and really does carry a stale spec", () => {
  /* Both halves of the defect have to be present for the assertions below to
     mean anything. If conversion ever stopped freezing the spec, these tests
     would pass while guarding nothing. */
  const document = graphDocument();
  expect(document.geometry.kind).toBe("building-graph");
  expect(document.spec.volumes.length).toBeGreaterThan(0);

  /* And the stale spec is genuinely capable of producing a confident number —
     which is what made it dangerous. */
  const stale = specSummary(document.spec);
  expect(stale.totalFloorAreaSqFt).toBeGreaterThan(0);
});

test("a graph-backed glb does not present the frozen spec as this model's spec", async () => {
  const aura = await auraMetadata(graphDocument());
  expect(aura, "the glTF carried no aura metadata block at all").toBeTruthy();

  expect(aura!.geometrySource).toBe("building-graph");
  expect(aura!.specDescribesThisModel).toBe(false);

  /* The two keys a downstream reader would trust without checking. */
  expect(aura, "`spec` in graph mode reads as 'the spec of this model'").not.toHaveProperty("spec");
  expect(
    aura,
    "`derived` is a summary of the frozen spec — a stale NUMBER, which is read and believed in a way a stale blob is not",
  ).not.toHaveProperty("derived");

  /* The recovery data still travels, under a name that cannot be misread, and
     it says so in words rather than only in a boolean. */
  expect(aura).toHaveProperty("recoverySpec");
  expect(String(aura!.recoverySpecNote)).toContain("do NOT describe the geometry in this file");
});

test("a legacy-geometry glb still carries its spec, so the guard is not blanket suppression", async () => {
  /* The fix must not be "stop emitting metadata". On the spec-backed path the
     spec DOES describe the model, and removing it there would break the
     handoff this export exists for. This is the assertion that stops the one
     above from being satisfied by deleting the feature. */
  const aura = await auraMetadata(defaultBuilderDocument());
  expect(aura!.geometrySource).toBe("spec.volumes");
  expect(aura!.specDescribesThisModel).toBe(true);
  expect(aura).toHaveProperty("spec");
  expect(aura).toHaveProperty("derived");
});

test("a graph-backed obj header states no quantity it cannot stand behind", async () => {
  const document = graphDocument();
  const stale = specSummary(document.spec);
  const header = (await (await exportObj(await sceneRoot(), document)).blob.text()).slice(0, 1400);

  /* The specific numbers that used to be printed. Rounded to two places the
     way the header prints them, so a match here is the real defect and not a
     coincidence of digits. */
  const round2 = (n: number) => String(Math.round(n * 100) / 100);
  expect(header).not.toContain(round2(stale.totalFloorAreaSqFt));
  expect(header).not.toContain(round2(stale.groundFootprintSqFt));
  expect(header).not.toContain(round2(stale.tallestRidgeHeightFt));

  /* Omission has to be visible. A header that simply drops the line leaves the
     reader assuming nobody bothered, rather than knowing the number cannot be
     taken from this file. */
  expect(header).toContain("total floor area: not stated");
  expect(header).toContain("planar graph geometry");

  /* And the header still identifies the design, so the omission is narrow. */
  expect(header).toContain("design hash:");
});

test("a legacy obj header still prints its quantities", async () => {
  const document = defaultBuilderDocument();
  const summary = specSummary(document.spec);
  const header = (await (await exportObj(await sceneRoot(), document)).blob.text()).slice(0, 1400);
  const round2 = (n: number) => String(Math.round(n * 100) / 100);

  expect(header).toContain(round2(summary.totalFloorAreaSqFt));
  expect(header).toContain(round2(summary.groundFootprintSqFt));
  expect(header).not.toContain("not stated");
});
