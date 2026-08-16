import { expect, test } from "playwright/test";

import { convertBuilderDocumentToGraph, defaultBuilderDocument } from "@/lib/builder/document";
import { addFixture, floorRegions, resolveFixtures } from "@/lib/builder/fixtures";
import { fixtureSpecForDocument } from "@/lib/builder/fixturesGraph";

function graphDocument() {
  const converted = convertBuilderDocumentToGraph(defaultBuilderDocument(), 0.5);
  if (!converted.ok) throw new Error(converted.problem);
  return converted.document;
}

test("fixture hosts after conversion are the graph storeys, not the recovery volumes", () => {
  const document = graphDocument();
  expect(document.geometry.kind).toBe("building-graph");
  if (document.geometry.kind !== "building-graph") return;

  const recoveryIds = document.spec.volumes.map((volume) => volume.id);
  const fixtureSpec = fixtureSpecForDocument(document);
  const hostIds = fixtureSpec.volumes.map((volume) => volume.id);

  expect(hostIds).toEqual(document.geometry.graph.storeys.map((storey) => storey.id));
  expect(hostIds.some((id) => recoveryIds.includes(id))).toBe(false);
  expect(fixtureSpec.deck).toBeNull();
  expect(fixtureSpec.notes).toContain("bounding boxes");
});

test("a floor fixture can be added to a graph storey and resolve against that host", () => {
  const document = graphDocument();
  const spec = fixtureSpecForDocument(document);
  expect(floorRegions(spec).length).toBeGreaterThan(0);

  const added = addFixture(spec, document.fixtures, "sofa");
  expect(added.problem).toBeNull();
  expect(added.id).not.toBeNull();
  expect(added.set.items).toHaveLength(1);
  const item = added.set.items[0];
  expect(item.placement.mount).toBe("floor");
  if (item.placement.mount !== "floor") return;
  expect(item.placement.host).toEqual({ kind: "volume", volumeId: spec.volumes[0].id });

  const resolved = resolveFixtures(spec, added.set);
  expect(resolved.items).toHaveLength(1);
  expect(resolved.issues.filter((issue) => issue.severity === "blocked")).toEqual([]);
});

test("a spec-backed document still uses its own volumes as fixture hosts", () => {
  const document = defaultBuilderDocument();
  expect(fixtureSpecForDocument(document)).toBe(document.spec);
});
