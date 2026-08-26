import { expect, test } from "playwright/test";

import {
  BUILDER_DOCUMENT_VERSION,
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  hashBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import {
  compareSavedSchemes,
  type SchemeComparisonContext,
} from "@/lib/builder/schemeComparison";
import { documentSignature, type SavedDesign } from "@/lib/builder/store";
import { variationSet } from "@/lib/builder/variations";

const CONTEXT: SchemeComparisonContext = {
  region: "Alberta",
  municipality: "",
  budgetCapCad: null,
};

function saved(id: string, name: string, document: BuilderDocument, updatedAt: number): SavedDesign {
  return {
    id,
    name,
    specVersion: document.spec.version,
    documentVersion: BUILDER_DOCUMENT_VERSION,
    thumbnail: null,
    createdAt: updatedAt - 1_000,
    updatedAt,
    headline: {
      floorAreaSqFt: 0,
      footprintSqFt: 0,
      ridgeHeightFt: 0,
      volumeCount: 0,
    },
    signature: documentSignature(document),
    document,
  };
}

function fixtures(): SavedDesign[] {
  const basis = defaultBuilderDocument();
  const variations = variationSet({ document: basis }).variations;
  expect(variations.length).toBeGreaterThanOrEqual(2);
  return [
    saved("scheme-a", "Original", basis, 1_700_000_000_000),
    saved("scheme-b", "More glass", variations[0].document, 1_700_000_001_000),
    saved("scheme-c", "Turned cabin", variations[1].document, 1_700_000_002_000),
  ];
}

test("two saved schemes compare exact versions through existing fact owners", () => {
  const records = fixtures().slice(0, 2);
  const result = compareSavedSchemes(records, CONTEXT, records[0].id);
  expect(result.ok).toBe(true);
  if (!result.ok) return;

  expect(result.comparison.referenceId).toBe("scheme-a");
  expect(result.comparison.schemes).toHaveLength(2);
  result.comparison.schemes.forEach((scheme, index) => {
    const record = records[index];
    expect(scheme.id).toBe(record.id);
    expect(scheme.name).toBe(record.name);
    expect(scheme.documentVersion).toBe(record.documentVersion);
    expect(scheme.savedAt).toBe(record.updatedAt);
    expect(scheme.designHash).toBe(hashBuilderDocument(record.document));
    expect(scheme.program.roomCount).toBeGreaterThan(0);
    expect(scheme.program.storeyCount).toBeGreaterThan(0);
    expect(scheme.areaSqFt).toBeGreaterThan(0);
    expect(scheme.cost.status).toBe("available");
    if (scheme.cost.status !== "available") throw new Error("Expected an available planning range.");
    expect(scheme.cost.currency).toBe("CAD");
    expect(scheme.cost.highCad).toBeGreaterThanOrEqual(scheme.cost.lowCad);
    expect(scheme.constraints.blockers.length).toBeGreaterThan(0);
    expect(scheme.exports.completeProject).toBe("available");
    expect(scheme.exports.canonicalHash).toBe(scheme.designHash);
  });

  expect(result.comparison.schemes[0].delta).toEqual({
    areaSqFt: 0,
    roomCount: 0,
    storeyCount: 0,
    costMidCad: 0,
  });
  expect(JSON.stringify(result.comparison).toLowerCase()).not.toMatch(/\bbest\b|recommended|optimal/);
});

test("the chosen reference changes deltas, never scheme facts or rank", () => {
  const records = fixtures();
  const first = compareSavedSchemes(records, CONTEXT, "scheme-a");
  const second = compareSavedSchemes(records, CONTEXT, "scheme-c");
  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  if (!first.ok || !second.ok) return;

  expect(first.comparison.schemes.map(({ delta: _delta, ...facts }) => facts)).toEqual(
    second.comparison.schemes.map(({ delta: _delta, ...facts }) => facts),
  );
  expect(second.comparison.schemes.find((scheme) => scheme.id === "scheme-c")?.delta).toEqual({
    areaSqFt: 0,
    roomCount: 0,
    storeyCount: 0,
    costMidCad: 0,
  });
});

test("candidate count, identity, version, freshness, and uniqueness fail closed", () => {
  const records = fixtures();
  expect(compareSavedSchemes(records.slice(0, 1), CONTEXT, records[0].id)).toMatchObject({ ok: false });
  expect(compareSavedSchemes([...records, saved("four", "Four", records[0].document, 4)], CONTEXT, records[0].id)).toMatchObject({ ok: false });
  expect(compareSavedSchemes(records, CONTEXT, "missing")).toMatchObject({ ok: false });

  const stale = { ...records[1], signature: "0xstale" };
  const staleResult = compareSavedSchemes([records[0], stale], CONTEXT, records[0].id);
  expect(staleResult).toMatchObject({ ok: false });
  expect(staleResult.ok ? "" : staleResult.problem.toLowerCase()).toContain("signature");

  const future = { ...records[1], documentVersion: BUILDER_DOCUMENT_VERSION + 1 };
  expect(compareSavedSchemes([records[0], future], CONTEXT, records[0].id)).toMatchObject({ ok: false });

  const duplicateHash = { ...records[0], id: "same-building", name: "Different label" };
  const duplicateResult = compareSavedSchemes([records[0], duplicateHash], CONTEXT, records[0].id);
  expect(duplicateResult).toMatchObject({ ok: false });
  expect(duplicateResult.ok ? "" : duplicateResult.problem.toLowerCase()).toContain("same canonical design");
});

test("planar graph schemes report graph-owned program and area", () => {
  const legacy = defaultBuilderDocument();
  const converted = convertBuilderDocumentToGraph(legacy, 0.5);
  expect(converted.ok).toBe(true);
  if (!converted.ok) return;
  const records = [
    saved("legacy", "Legacy", legacy, 1),
    saved("graph", "Planar", converted.document, 2),
  ];
  const result = compareSavedSchemes(records, CONTEXT, "graph");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const graph = result.comparison.schemes.find((scheme) => scheme.id === "graph")!;
  expect(graph.geometry).toBe("planar-graph");
  expect(graph.program.roomCount).toBe(converted.document.geometry.kind === "building-graph"
    ? converted.document.geometry.graph.storeys.reduce((sum, storey) => sum + storey.rooms.length, 0)
    : -1);
  expect(graph.areaSqFt).toBeGreaterThan(0);
});

test("comparison is deterministic and never mutates saved records", () => {
  const records = fixtures();
  const before = JSON.stringify(records);
  const first = compareSavedSchemes(records, CONTEXT, records[0].id);
  const second = compareSavedSchemes(records, CONTEXT, records[0].id);
  expect(first).toEqual(second);
  expect(JSON.stringify(records)).toBe(before);
  expect(first.ok && Object.isFrozen(first.comparison)).toBe(true);
});
