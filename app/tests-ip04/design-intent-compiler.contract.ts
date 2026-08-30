import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "playwright/test";

import {
  DESIGN_INTENT_COMPILER_VERSION,
  compileDesignIntentToProject,
} from "@/lib/ai/designIntentCompiler";
import { DESIGN_INTENT_FIELDS, DESIGN_INTENT_VERSION } from "@/lib/ai/designIntent";
import { hashBuilderDocument, validateBuilderDocument } from "@/lib/builder/document";

const sourceFingerprint = `sha256:${"a".repeat(64)}`;

const completeIntent = (): Record<string, unknown> => ({
  version: DESIGN_INTENT_VERSION,
  requestedUse: { category: "cabin", occupancy: "year-round", details: null },
  approximateFootprint: { unit: "m2", targetM2: 72, minimumM2: 60, maximumM2: 84 },
  storeys: { count: 1, splitLevel: false },
  rooms: [
    { id: "living", use: "living", label: null, count: 1, minimumAreaM2: 22 },
    { id: "bedroom", use: "bedroom", label: null, count: 2, minimumAreaM2: 9 },
  ],
  roof: { forms: ["gable"], preferredPitchDegrees: 35 },
  openings: {
    glazingLevel: "generous",
    windowCount: 9,
    exteriorDoorCount: 2,
    orientationPriorities: ["south", "west"],
  },
  materials: {
    preferences: ["timber", "glass", "metal-roof"],
    notes: "Warm timber interior with a durable exterior.",
  },
  climate: { country: "CA", region: "Alberta", profile: "cold-continental" },
  siting: {
    orientationPreference: "south",
    slope: "gentle",
    access: "road",
    viewPriorities: ["west"],
  },
  assumptions: [
    {
      id: "assumption-view",
      field: "siting",
      statement: "The photographed view is assumed to face west until the owner confirms it.",
      sourceIds: ["image-1"],
    },
  ],
  unresolved: [
    { id: "unresolved-site", field: "siting", question: "What is the surveyed site orientation?" },
  ],
  confidence: DESIGN_INTENT_FIELDS.map((field) => ({
    field,
    level: field === "siting" ? "weak-inference" : "explicit",
    sourceIds: ["image-1"],
  })),
  sources: [
    {
      id: "image-1",
      kind: "uploaded-image",
      fingerprint: sourceFingerprint,
      label: "Owner-provided cabin reference",
    },
  ],
});

const compile = (intent: unknown = completeIntent()) => {
  const result = compileDesignIntentToProject(intent);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.problem}`);
  return result.project;
};

const mutate = (intent: Record<string, unknown>, key: string): Record<string, unknown> => {
  return intent[key] as Record<string, unknown>;
};

const graphOf = (project: ReturnType<typeof compile>) => {
  expect(project.document.geometry.kind).toBe("building-graph");
  if (project.document.geometry.kind !== "building-graph") throw new Error("Expected graph geometry.");
  return project.document.geometry.graph;
};

const graphBounds = (project: ReturnType<typeof compile>) => {
  const vertices = graphOf(project).storeys[0].vertices;
  const xs = vertices.map((vertex) => vertex.xFt);
  const zs = vertices.map((vertex) => vertex.zFt);
  return {
    widthFt: Math.max(...xs) - Math.min(...xs),
    depthFt: Math.max(...zs) - Math.min(...zs),
  };
};

test("strict intent promotion rejects hidden or model-authored geometry without throwing raw boundary detail", () => {
  const unknown = { ...completeIntent(), geometry: { polygon: [[0, 0]] } };
  expect(compileDesignIntentToProject(unknown)).toMatchObject({
    ok: false,
    error: { code: "invalid-intent" },
  });

  const accessor = completeIntent();
  Object.defineProperty(accessor, "geometry", { enumerable: true, get: () => { throw new Error("private"); } });
  expect(compileDesignIntentToProject(accessor)).toMatchObject({ ok: false, error: { code: "invalid-intent" } });

  const custom = Object.assign(Object.create({ geometry: true }), completeIntent());
  expect(compileDesignIntentToProject(custom)).toMatchObject({ ok: false, error: { code: "invalid-intent" } });

  const revoked = Proxy.revocable(completeIntent(), {});
  revoked.revoke();
  expect(compileDesignIntentToProject(revoked.proxy)).toMatchObject({ ok: false, error: { code: "invalid-intent" } });
});

test("the same intent and compiler version produce one detached deeply frozen canonical proposal", () => {
  const source = completeIntent();
  const before = structuredClone(source);
  const first = compile(source);
  const second = compile(structuredClone(source));

  expect(DESIGN_INTENT_COMPILER_VERSION).toBe("aura-design-intent-compiler/v1");
  expect(first).toEqual(second);
  expect(first.intentHash).toBe(second.intentHash);
  expect(first.documentHash).toBe(second.documentHash);
  expect(first.projectHash).toBe(second.projectHash);
  expect(source).toEqual(before);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.document)).toBe(true);
  expect(Object.isFrozen(graphOf(first))).toBe(true);
  expect(Object.isFrozen(first.decisions)).toBe(true);
});

test("target, range midpoint, and disclosed default footprint rules are deterministic half-foot geometry", () => {
  const target = compile();
  const rangeIntent = completeIntent();
  Object.assign(mutate(rangeIntent, "approximateFootprint"), { targetM2: null, minimumM2: 60, maximumM2: 84 });
  const range = compile(rangeIntent);
  expect(graphBounds(range)).toEqual(graphBounds(target));
  expect(range.decisions.some((decision) => decision.code === "range-midpoint-footprint")).toBe(true);

  const defaultIntent = completeIntent();
  Object.assign(mutate(defaultIntent, "approximateFootprint"), { targetM2: null, minimumM2: null, maximumM2: null });
  const fallback = compile(defaultIntent);
  expect(fallback.decisions.some((decision) => decision.code === "default-footprint")).toBe(true);

  for (const project of [target, range, fallback]) {
    const bounds = graphBounds(project);
    expect(bounds.widthFt * 2).toBe(Math.round(bounds.widthFt * 2));
    expect(bounds.depthFt * 2).toBe(Math.round(bounds.depthFt * 2));
  }
  const targetAreaSqFt = graphBounds(target).widthFt * graphBounds(target).depthFt;
  expect(targetAreaSqFt).toBeGreaterThan(72 * 10.7639 * 0.97);
  expect(targetAreaSqFt).toBeLessThan(72 * 10.7639 * 1.03);
});

test("one and two storeys use graph factories while unsupported levels fail visibly", () => {
  expect(graphOf(compile()).storeys).toHaveLength(1);

  const two = completeIntent();
  Object.assign(mutate(two, "storeys"), { count: 2, splitLevel: false });
  const twoProject = compile(two);
  expect(graphOf(twoProject).storeys.map((storey) => storey.id)).toEqual(["storey-1", "storey-2"]);

  const split = completeIntent();
  Object.assign(mutate(split, "storeys"), { count: 1, splitLevel: true });
  expect(compileDesignIntentToProject(split)).toMatchObject({ ok: false, error: { code: "unsupported-split-level" } });

  const tall = completeIntent();
  Object.assign(mutate(tall, "storeys"), { count: 3, splitLevel: false });
  expect(compileDesignIntentToProject(tall)).toMatchObject({ ok: false, error: { code: "unsupported-storeys" } });
});

test("requested room counts become named derived faces and impossible minimums are refused", () => {
  const project = compile();
  const rooms = graphOf(project).storeys.flatMap((storey) => storey.rooms);
  expect(rooms).toHaveLength(3);
  expect(rooms.map((room) => room.name).sort()).toEqual(["Bedroom 1", "Bedroom 2", "Living"]);
  expect(rooms.find((room) => room.name === "Living")?.areaSqft).toBeGreaterThanOrEqual(22 * 10.7639 - 0.1);
  expect(rooms.filter((room) => room.name.startsWith("Bedroom")).every((room) => room.areaSqft >= 9 * 10.7639 - 0.1)).toBe(true);

  const impossible = completeIntent();
  Object.assign(mutate(impossible, "approximateFootprint"), { targetM2: 30, minimumM2: 30, maximumM2: 30 });
  expect(compileDesignIntentToProject(impossible)).toMatchObject({ ok: false, error: { code: "program-does-not-fit" } });
});

test("supported roofs use graph zones and unsupported A-frame or ambiguous roof intent never silently approximates", () => {
  for (const form of ["gable", "hipped", "shed", "flat"] as const) {
    const intent = completeIntent();
    Object.assign(mutate(intent, "roof"), {
      forms: [form],
      preferredPitchDegrees: form === "flat" ? 0 : form === "shed" ? 18 : 35,
    });
    const project = compile(intent);
    const zones = graphOf(project).storeys.flatMap((storey) => storey.roofZones);
    expect(zones).toHaveLength(1);
    expect(zones[0].form).toBe(form);
  }

  const aFrame = completeIntent();
  Object.assign(mutate(aFrame, "roof"), { forms: ["a-frame"], preferredPitchDegrees: 55 });
  expect(compileDesignIntentToProject(aFrame)).toMatchObject({ ok: false, error: { code: "unsupported-roof" } });

  const unknown = completeIntent();
  Object.assign(mutate(unknown, "roof"), { forms: ["unknown"], preferredPitchDegrees: null });
  const fallback = compile(unknown);
  expect(graphOf(fallback).storeys.flatMap((storey) => storey.roofZones)[0].form).toBe("gable");
  expect(fallback.decisions.some((decision) => decision.code === "default-roof")).toBe(true);
});

test("explicit doors and windows compile exactly onto priority faces or fail when the shell cannot hold them", () => {
  const project = compile();
  const graph = graphOf(project);
  const storey = graph.storeys[0];
  const all = storey.walls.flatMap((wall) => wall.openings);
  expect(all.filter((opening) => opening.kind === "door")).toHaveLength(2);
  expect(all.filter((opening) => opening.kind === "window")).toHaveLength(9);

  const vertices = new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));
  const directions = storey.walls.filter((wall) => wall.openings.length > 0).map((wall) => {
    const start = vertices.get(wall.startVertexId)!;
    const end = vertices.get(wall.endVertexId)!;
    if (Math.abs(start.zFt - end.zFt) < 1e-8) return start.zFt < 0 ? "south" : "north";
    return start.xFt > 0 ? "east" : "west";
  });
  expect(new Set(directions)).toEqual(new Set(["south", "west"]));

  const crowded = completeIntent();
  Object.assign(mutate(crowded, "openings"), {
    glazingLevel: "generous",
    windowCount: 128,
    exteriorDoorCount: 32,
    orientationPriorities: ["south"],
  });
  expect(compileDesignIntentToProject(crowded)).toMatchObject({ ok: false, error: { code: "openings-do-not-fit" } });
});

test("material, climate, and siting mappings are deterministic and fallback mappings are named", () => {
  const project = compile();
  expect(project.document.spec).toMatchObject({
    material: "timber_frame",
    climateZone: "7A",
    siting: { frontFacesDeg: 180, slope: "gentle" },
  });

  const fallbackIntent = completeIntent();
  Object.assign(mutate(fallbackIntent, "materials"), { preferences: ["glass", "metal"], notes: null });
  Object.assign(mutate(fallbackIntent, "climate"), { country: "CR", region: "Guanacaste", profile: "tropical-dry" });
  Object.assign(mutate(fallbackIntent, "siting"), {
    orientationPreference: "unknown",
    slope: "unknown",
    access: "road",
    viewPriorities: [],
  });
  const fallback = compile(fallbackIntent);
  expect(fallback.document.spec).toMatchObject({
    material: "sip",
    climateZone: "4",
    siting: { frontFacesDeg: 180, slope: "flat" },
  });
  const codes = new Set(fallback.decisions.map((decision) => decision.code));
  expect(codes.has("default-material")).toBe(true);
  expect(codes.has("default-orientation")).toBe(true);
  expect(codes.has("default-slope")).toBe(true);
});

test("the compiler returns a validated BuilderDocument and its canonical document hash", () => {
  const project = compile();
  const checked = validateBuilderDocument(project.document);
  expect(checked.ok).toBe(true);
  expect(project.documentHash).toBe(hashBuilderDocument(project.document));
  expect(project.sourceFingerprints).toEqual([sourceFingerprint]);
  expect(project.unresolved).toEqual([
    { id: "unresolved-site", field: "siting", question: "What is the surveyed site orientation?" },
  ]);
});

test("the proposal hash binds intent, decisions, unresolved questions, sources, and the compiled document", () => {
  const original = compile();

  const changedSource = completeIntent();
  const sources = changedSource.sources as Array<Record<string, unknown>>;
  sources[0].fingerprint = `sha256:${"b".repeat(64)}`;
  const confidence = changedSource.confidence as Array<Record<string, unknown>>;
  confidence.forEach((entry) => { entry.sourceIds = ["image-1"]; });
  const assumptions = changedSource.assumptions as Array<Record<string, unknown>>;
  assumptions.forEach((entry) => { entry.sourceIds = ["image-1"]; });
  const sourceProject = compile(changedSource);
  expect(sourceProject.documentHash).toBe(original.documentHash);
  expect(sourceProject.intentHash).not.toBe(original.intentHash);
  expect(sourceProject.projectHash).not.toBe(original.projectHash);

  const changedProgram = completeIntent();
  Object.assign(mutate(changedProgram, "approximateFootprint"), { targetM2: 80, minimumM2: 70, maximumM2: 90 });
  const programProject = compile(changedProgram);
  expect(programProject.documentHash).not.toBe(original.documentHash);
  expect(programProject.projectHash).not.toBe(original.projectHash);
});

test("returned data is detached from caller mutation and no partial result survives a refusal", () => {
  const source = completeIntent();
  const project = compile(source);
  (source.rooms as Array<Record<string, unknown>>)[0].label = "Changed later";
  (source.sources as Array<Record<string, unknown>>)[0].fingerprint = `sha256:${"c".repeat(64)}`;
  expect(project.documentHash).toBe(hashBuilderDocument(project.document));
  expect(project.sourceFingerprints).toEqual([sourceFingerprint]);

  const impossible = completeIntent();
  Object.assign(mutate(impossible, "storeys"), { count: 6, splitLevel: false });
  const refused = compileDesignIntentToProject(impossible);
  expect(refused).toMatchObject({ ok: false, error: { code: "unsupported-storeys" } });
  expect("project" in refused).toBe(false);
});

test("the compiler source stays provider-free, side-effect-free, UI-free, and outside frozen rendering", () => {
  const source = readFileSync(join(process.cwd(), "lib/ai/designIntentCompiler.ts"), "utf8");
  const forbidden = [
    /openrouter/i,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /WebSocket/,
    /localStorage|indexedDB|sessionStorage/,
    /Date\s*\(|Date\.now|Math\.random|crypto\.randomUUID/,
    /\b(?:wallet|payment|checkout|fee|budget)\b/i,
    /createAuraProject|withProjectDesign|project\/store/,
    /react|three|renderer|scene|animation|camera|lighting|shader|texture|model/i,
  ];
  forbidden.forEach((pattern) => expect(source).not.toMatch(pattern));
  expect(source).toContain("parseDesignIntent");
  expect(source).toContain("singleStoreyGraphFromPolygon");
  expect(source).toContain("validateBuilderDocument");
  expect(source).toContain("hashBuilderDocument");
});
