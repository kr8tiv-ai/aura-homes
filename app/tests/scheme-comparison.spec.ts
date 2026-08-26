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
  for (const [index, scheme] of result.comparison.schemes.entries()) {
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
    expect(scheme.cost.currency).toBe("CAD");
    expect(scheme.cost.highCad).toBeGreaterThanOrEqual(scheme.cost.lowCad);
    expect(scheme.constraints.blockers.length).toBeGreaterThan(0);
    expect(scheme.exports.completeProject).toBe("available");
    expect(scheme.exports.canonicalHash).toBe(scheme.designHash);
  }

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

test("saved schemes are keyboard-comparable without changing the open design", async ({ page }, testInfo) => {
  test.skip(
    !process.env.PLAYWRIGHT_TEST_BASE_URL && !testInfo.project.use.baseURL,
    "served UX07 comparison proof runs with the manifest's local base URL",
  );
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/build?mode=pro");
  await expect(page.locator(".builder-viewport canvas").first()).toBeAttached({ timeout: 90_000 });

  const root = page.locator("[data-active-design-hash]");
  const originalHash = await root.getAttribute("data-active-design-hash");
  const originalUndo = await page.getByRole("button", { name: /^Undo/ }).first().isDisabled();

  await page.getByRole("button", { name: "Library", exact: true }).click();
  const comparison = page.getByRole("region", { name: "Compare saved schemes" });
  await expect(comparison).toContainText("Save at least two distinct schemes");

  // Seed complete, canonical saved records through the same IndexedDB stores
  // the existing ProjectLibrary uses. The pure contract above proves the
  // records and hashes; this case proves the served interaction around them.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("aura-builder", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(["designs", "documents"], "readwrite");
    const designs = tx.objectStore("designs");
    const documents = tx.objectStore("documents");
    const base = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = documents.get("autosave");
      request.onsuccess = () => resolve((request.result as Record<string, unknown>) ?? {});
      request.onerror = () => reject(request.error);
    });
    void designs;
    void base;
    tx.abort();
    db.close();
  });

  // The production component exposes a test-addressable local-only seeding
  // path by ordinary Save/Open UI; absence here is the intentional RED state.
  await expect(comparison.getByRole("checkbox")).toHaveCount(3);
  const boxes = comparison.getByRole("checkbox");
  await boxes.nth(0).focus();
  await page.keyboard.press("Space");
  await boxes.nth(1).focus();
  await page.keyboard.press("Space");
  await comparison.getByRole("button", { name: "Compare 2 schemes" }).click();

  const table = comparison.getByRole("table", { name: "Scheme facts" });
  await expect(table).toBeVisible();
  await expect(table).toContainText(/0x[a-f0-9]{64}/);
  await expect(table).toContainText("Modelled floor area");
  await expect(table).toContainText("Planning range");
  await expect(table).toContainText("Blocking items");
  await expect(table).toContainText("Complete project");
  await expect(comparison).not.toContainText(/\bbest\b|recommended|optimal/i);

  await comparison.getByRole("radio").nth(1).check();
  await comparison.getByRole("button", { name: "Clear comparison" }).click();
  await expect(table).toHaveCount(0);
  await expect(root).toHaveAttribute("data-active-design-hash", originalHash ?? "");
  expect(await page.getByRole("button", { name: /^Undo/ }).first().isDisabled()).toBe(originalUndo);
});
