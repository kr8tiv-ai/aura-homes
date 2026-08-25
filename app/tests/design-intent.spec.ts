import { expect, test } from "playwright/test";

import {
  DESIGN_INTENT_FIELDS,
  DESIGN_INTENT_VERSION,
  DesignIntentError,
  parseDesignIntent,
} from "@/lib/ai/designIntent";

const sourceFingerprint = `sha256:${"a".repeat(64)}`;

const completeIntent = (): Record<string, unknown> => ({
  version: DESIGN_INTENT_VERSION,
  requestedUse: {
    category: "cabin",
    occupancy: "year-round",
    details: null,
  },
  approximateFootprint: {
    unit: "m2",
    targetM2: 72,
    minimumM2: 60,
    maximumM2: 84,
  },
  storeys: {
    count: 1,
    splitLevel: false,
  },
  rooms: [
    { id: "living", use: "living", label: null, count: 1, minimumAreaM2: 22 },
    { id: "bedroom", use: "bedroom", label: null, count: 2, minimumAreaM2: 9 },
  ],
  roof: {
    forms: ["gable"],
    preferredPitchDegrees: 35,
  },
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
  climate: {
    country: "CA",
    region: "Alberta",
    profile: "cold-continental",
  },
  siting: {
    orientationPreference: "south",
    slope: "gentle",
    access: "road",
    viewPriorities: ["west"],
  },
  assumptions: [
    {
      id: "assumption-south",
      field: "siting",
      statement: "The photographed view is assumed to face west until the owner confirms it.",
      sourceIds: ["image-1"],
    },
  ],
  unresolved: [
    {
      id: "unresolved-site",
      field: "siting",
      question: "What is the surveyed site orientation?",
    },
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

const expectIssue = (candidate: unknown, code: string, path: string): void => {
  try {
    parseDesignIntent(candidate);
    throw new Error("Expected DesignIntent validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(DesignIntentError);
    expect(error).toMatchObject({ code, path });
  }
};

test("a complete intent preserves every accepted field in a detached frozen round trip", () => {
  const source = completeIntent();
  const before = structuredClone(source);
  const parsed = parseDesignIntent(source);

  expect(parsed).toEqual(before);
  expect(parseDesignIntent(parsed)).toEqual(parsed);
  expect(source).toEqual(before);
  expect(parsed).not.toBe(source);
  expect(Object.isFrozen(parsed)).toBe(true);
  expect(Object.isFrozen(parsed.rooms)).toBe(true);
  expect(Object.isFrozen(parsed.rooms[0])).toBe(true);
});

test("unknown root keys fail rather than being stripped", () => {
  expectIssue({ ...completeIntent(), surprise: true }, "unknown-key", "$.surprise");
});

test("unknown keys fail inside every nested object family", () => {
  const cases: Array<[string, (candidate: Record<string, unknown>) => void]> = [
    ["$.requestedUse.surprise", (candidate) => { (candidate.requestedUse as Record<string, unknown>).surprise = true; }],
    ["$.approximateFootprint.surprise", (candidate) => { (candidate.approximateFootprint as Record<string, unknown>).surprise = true; }],
    ["$.storeys.surprise", (candidate) => { (candidate.storeys as Record<string, unknown>).surprise = true; }],
    ["$.rooms[0].surprise", (candidate) => { ((candidate.rooms as unknown[])[0] as Record<string, unknown>).surprise = true; }],
    ["$.roof.surprise", (candidate) => { (candidate.roof as Record<string, unknown>).surprise = true; }],
    ["$.openings.surprise", (candidate) => { (candidate.openings as Record<string, unknown>).surprise = true; }],
    ["$.materials.surprise", (candidate) => { (candidate.materials as Record<string, unknown>).surprise = true; }],
    ["$.climate.surprise", (candidate) => { (candidate.climate as Record<string, unknown>).surprise = true; }],
    ["$.siting.surprise", (candidate) => { (candidate.siting as Record<string, unknown>).surprise = true; }],
    ["$.assumptions[0].surprise", (candidate) => { ((candidate.assumptions as unknown[])[0] as Record<string, unknown>).surprise = true; }],
    ["$.unresolved[0].surprise", (candidate) => { ((candidate.unresolved as unknown[])[0] as Record<string, unknown>).surprise = true; }],
    ["$.confidence[0].surprise", (candidate) => { ((candidate.confidence as unknown[])[0] as Record<string, unknown>).surprise = true; }],
    ["$.sources[0].surprise", (candidate) => { ((candidate.sources as unknown[])[0] as Record<string, unknown>).surprise = true; }],
  ];

  for (const [path, mutate] of cases) {
    const candidate = completeIntent();
    mutate(candidate);
    expectIssue(candidate, "unknown-key", path);
  }
});

test("custom prototypes, Symbols, and non-enumerable unknown keys cannot hide geometry", () => {
  const inheritedRoot = Object.assign(Object.create({ vertices: [{ x: 0, y: 0 }] }), completeIntent());
  expectIssue(inheritedRoot, "invalid-type", "$");

  const inheritedNested = completeIntent();
  inheritedNested.requestedUse = Object.assign(
    Object.create({ coordinates: [0, 0] }),
    inheritedNested.requestedUse,
  );
  expectIssue(inheritedNested, "invalid-type", "$.requestedUse");

  const symbol = completeIntent();
  Object.defineProperty(symbol, Symbol("geometry"), { value: [0, 0], enumerable: true });
  expectIssue(symbol, "unknown-key", "$.Symbol(geometry)");

  const hidden = completeIntent();
  Object.defineProperty(hidden, "geometry", { value: [0, 0], enumerable: false });
  expectIssue(hidden, "unknown-key", "$.geometry");
});

test("arrays reject holes, custom properties, Symbols, and accessor elements", () => {
  const sparse = completeIntent();
  sparse.rooms = new Array(1);
  expectIssue(sparse, "invalid-type", "$.rooms[0]");

  const custom = completeIntent();
  Object.assign(custom.rooms as unknown[], { vertices: [{ x: 0, y: 0 }] });
  expectIssue(custom, "unknown-key", "$.rooms.vertices");

  const symbol = completeIntent();
  Object.defineProperty(symbol.rooms, Symbol("geometry"), { value: true, enumerable: true });
  expectIssue(symbol, "unknown-key", "$.rooms.Symbol(geometry)");

  const accessor = completeIntent();
  Object.defineProperty(accessor.rooms, "0", { get: () => ({}), enumerable: true });
  expectIssue(accessor, "invalid-type", "$.rooms[0]");
});

test("accessors and hostile reflection traps are rejected without invocation or private error leakage", () => {
  const candidate = completeIntent();
  let getterCalls = 0;
  Object.defineProperty(candidate.requestedUse, "details", {
    get: () => {
      getterCalls += 1;
      throw new Error("private getter detail");
    },
    enumerable: true,
  });
  expectIssue(candidate, "invalid-type", "$.requestedUse.details");
  expect(getterCalls).toBe(0);

  const hostile = new Proxy(completeIntent(), {
    ownKeys: () => { throw new Error("private reflection detail"); },
  });
  try {
    parseDesignIntent(hostile);
    throw new Error("Expected hostile reflection to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(DesignIntentError);
    expect(error).toMatchObject({ code: "invalid-type", path: "$" });
    expect(String(error)).not.toContain("private reflection detail");
  }
});

test("geometry-shaped payloads are named and refused at root and nested boundaries", () => {
  expectIssue({ ...completeIntent(), vertices: [{ x: 0, y: 0 }] }, "unknown-key", "$.vertices");
  const nested = completeIntent();
  ((nested.rooms as unknown[])[0] as Record<string, unknown>).coordinates = [0, 0];
  expectIssue(nested, "unknown-key", "$.rooms[0].coordinates");
});

test("invalid enums, non-finite numbers, unsafe integers, and out-of-range values fail closed", () => {
  const badUse = completeIntent();
  (badUse.requestedUse as Record<string, unknown>).category = "castle";
  expectIssue(badUse, "invalid-value", "$.requestedUse.category");

  const nonFinite = completeIntent();
  (nonFinite.approximateFootprint as Record<string, unknown>).targetM2 = Number.POSITIVE_INFINITY;
  expectIssue(nonFinite, "invalid-number", "$.approximateFootprint.targetM2");

  const unsafeStoreys = completeIntent();
  (unsafeStoreys.storeys as Record<string, unknown>).count = Number.MAX_SAFE_INTEGER + 1;
  expectIssue(unsafeStoreys, "invalid-integer", "$.storeys.count");

  const tooManyStoreys = completeIntent();
  (tooManyStoreys.storeys as Record<string, unknown>).count = 7;
  expectIssue(tooManyStoreys, "out-of-range", "$.storeys.count");
});

test("footprint ranges and roof pitches must agree with their own bounds", () => {
  const footprint = completeIntent();
  (footprint.approximateFootprint as Record<string, unknown>).minimumM2 = 90;
  expectIssue(footprint, "inconsistent-range", "$.approximateFootprint");

  const pitch = completeIntent();
  (pitch.roof as Record<string, unknown>).preferredPitchDegrees = 91;
  expectIssue(pitch, "out-of-range", "$.roof.preferredPitchDegrees");
});

test("other requested uses and room uses require bounded human-readable details", () => {
  const use = completeIntent();
  (use.requestedUse as Record<string, unknown>).category = "other";
  expectIssue(use, "required-detail", "$.requestedUse.details");

  const room = completeIntent();
  ((room.rooms as unknown[])[0] as Record<string, unknown>).use = "other";
  expectIssue(room, "required-detail", "$.rooms[0].label");
});

test("identifiers and set-like values must be unique", () => {
  const roomIds = completeIntent();
  (roomIds.rooms as unknown[]).push(structuredClone((roomIds.rooms as unknown[])[0]));
  expectIssue(roomIds, "duplicate-id", "$.rooms[2].id");

  const materials = completeIntent();
  (materials.materials as Record<string, unknown>).preferences = ["timber", "timber"];
  expectIssue(materials, "duplicate-value", "$.materials.preferences[1]");

  const sourceIds = completeIntent();
  (sourceIds.sources as unknown[]).push(structuredClone((sourceIds.sources as unknown[])[0]));
  expectIssue(sourceIds, "duplicate-id", "$.sources[1].id");
});

test("confidence is complete, unique by field, and bound to known sources", () => {
  const missing = completeIntent();
  (missing.confidence as unknown[]).pop();
  expectIssue(missing, "missing-confidence", "$.confidence");

  const duplicate = completeIntent();
  (duplicate.confidence as unknown[])[DESIGN_INTENT_FIELDS.length - 1] = structuredClone((duplicate.confidence as unknown[])[0]);
  expectIssue(duplicate, "duplicate-field", `$.confidence[${DESIGN_INTENT_FIELDS.length - 1}].field`);

  const unknownSource = completeIntent();
  (((unknownSource.confidence as unknown[])[0] as Record<string, unknown>).sourceIds as unknown[])[0] = "missing";
  expectIssue(unknownSource, "unknown-source", "$.confidence[0].sourceIds[0]");
});

test("non-unknown confidence needs provenance while unknown confidence needs an unresolved question", () => {
  const noSource = completeIntent();
  ((noSource.confidence as unknown[])[0] as Record<string, unknown>).sourceIds = [];
  expectIssue(noSource, "missing-source", "$.confidence[0].sourceIds");

  const unresolved = completeIntent();
  const confidence = (unresolved.confidence as Array<Record<string, unknown>>).find((item) => item.field === "roof");
  if (!confidence) throw new Error("fixture lost roof confidence");
  confidence.level = "unknown";
  confidence.sourceIds = [];
  unresolved.unresolved = (unresolved.unresolved as Array<Record<string, unknown>>).filter((item) => item.field !== "roof");
  expectIssue(unresolved, "missing-unresolved", "$.confidence");
});

test("assumptions and unresolved questions reference known fields and sources", () => {
  const field = completeIntent();
  ((field.assumptions as unknown[])[0] as Record<string, unknown>).field = "geometry";
  expectIssue(field, "invalid-value", "$.assumptions[0].field");

  const source = completeIntent();
  (((source.assumptions as unknown[])[0] as Record<string, unknown>).sourceIds as unknown[])[0] = "missing";
  expectIssue(source, "unknown-source", "$.assumptions[0].sourceIds[0]");
});

test("the intent and every assumption require explicit provenance", () => {
  const assumption = completeIntent();
  ((assumption.assumptions as unknown[])[0] as Record<string, unknown>).sourceIds = [];
  expectIssue(assumption, "missing-source", "$.assumptions[0].sourceIds");

  const intent = completeIntent();
  intent.sources = [];
  expectIssue(intent, "missing-source", "$.sources");
});

test("array and string budgets reject excessive model output", () => {
  const rooms = completeIntent();
  rooms.rooms = Array.from({ length: 25 }, (_value, index) => ({
    id: `room-${index}`,
    use: "flex",
    label: null,
    count: 1,
    minimumAreaM2: null,
  }));
  expectIssue(rooms, "too-many-items", "$.rooms");

  const label = completeIntent();
  ((label.sources as unknown[])[0] as Record<string, unknown>).label = "x".repeat(241);
  expectIssue(label, "string-too-long", "$.sources[0].label");
});
