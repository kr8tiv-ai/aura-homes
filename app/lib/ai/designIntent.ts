/**
 * Provider-neutral image-to-plan proposal contract.
 *
 * DesignIntent is deliberately not geometry. It carries bounded program and
 * preference facts that deterministic project code may later compile. The
 * strict parser rejects unknown keys at every boundary so model-authored
 * coordinates, walls, polygons, or other accidental sources of truth cannot
 * hide inside an otherwise valid proposal.
 */

export const DESIGN_INTENT_VERSION = "aura-design-intent/v1" as const;

export const DESIGN_INTENT_FIELDS = [
  "requestedUse",
  "approximateFootprint",
  "storeys",
  "rooms",
  "roof",
  "openings",
  "materials",
  "climate",
  "siting",
] as const;

export type DesignIntentField = (typeof DESIGN_INTENT_FIELDS)[number];
export type DesignIntentErrorCode =
  | "unknown-key"
  | "missing-key"
  | "invalid-type"
  | "invalid-value"
  | "invalid-number"
  | "invalid-integer"
  | "out-of-range"
  | "string-too-long"
  | "too-many-items"
  | "duplicate-id"
  | "duplicate-value"
  | "duplicate-field"
  | "unknown-source"
  | "missing-source"
  | "missing-confidence"
  | "missing-unresolved"
  | "required-detail"
  | "inconsistent-range";

export class DesignIntentError extends Error {
  readonly code: DesignIntentErrorCode;
  readonly path: string;

  constructor(code: DesignIntentErrorCode, path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "DesignIntentError";
    this.code = code;
    this.path = path;
  }
}

export type RequestedUseCategory =
  | "cabin"
  | "primary-home"
  | "guest-house"
  | "hospitality-stay"
  | "workspace"
  | "other";
export type OccupancyPattern = "year-round" | "seasonal" | "short-stay" | "flexible" | "unknown";
export type RoomUse =
  | "living"
  | "kitchen"
  | "dining"
  | "bedroom"
  | "bathroom"
  | "utility"
  | "storage"
  | "workspace"
  | "entry"
  | "flex"
  | "other";
export type RoofForm = "gable" | "hipped" | "shed" | "flat" | "a-frame" | "unknown";
export type CardinalDirection = "north" | "east" | "south" | "west";
export type MaterialPreference =
  | "timber"
  | "glass"
  | "metal"
  | "metal-roof"
  | "masonry"
  | "concrete"
  | "earth"
  | "bio-based"
  | "reclaimed"
  | "low-carbon"
  | "unknown";
export type ClimateProfile =
  | "cold-continental"
  | "marine"
  | "tropical-humid"
  | "tropical-dry"
  | "mountain"
  | "unknown";
export type ConfidenceLevel = "explicit" | "strong-inference" | "weak-inference" | "unknown";
export type ProvenanceKind = "uploaded-image" | "user-answer" | "project-context" | "system-rule";

export interface DesignIntent {
  version: typeof DESIGN_INTENT_VERSION;
  requestedUse: {
    category: RequestedUseCategory;
    occupancy: OccupancyPattern;
    details: string | null;
  };
  approximateFootprint: {
    unit: "m2";
    targetM2: number | null;
    minimumM2: number | null;
    maximumM2: number | null;
  };
  storeys: {
    count: number | null;
    splitLevel: boolean | null;
  };
  rooms: Array<{
    id: string;
    use: RoomUse;
    label: string | null;
    count: number;
    minimumAreaM2: number | null;
  }>;
  roof: {
    forms: RoofForm[];
    preferredPitchDegrees: number | null;
  };
  openings: {
    glazingLevel: "minimal" | "balanced" | "generous" | "unknown";
    windowCount: number | null;
    exteriorDoorCount: number | null;
    orientationPriorities: CardinalDirection[];
  };
  materials: {
    preferences: MaterialPreference[];
    notes: string | null;
  };
  climate: {
    country: "CA" | "CR" | "unknown";
    region: string | null;
    profile: ClimateProfile;
  };
  siting: {
    orientationPreference: CardinalDirection | "none" | "unknown";
    slope: "flat" | "gentle" | "steep" | "unknown";
    access: "road" | "trail" | "water" | "unknown";
    viewPriorities: CardinalDirection[];
  };
  assumptions: Array<{
    id: string;
    field: DesignIntentField;
    statement: string;
    sourceIds: string[];
  }>;
  unresolved: Array<{
    id: string;
    field: DesignIntentField;
    question: string;
  }>;
  confidence: Array<{
    field: DesignIntentField;
    level: ConfidenceLevel;
    sourceIds: string[];
  }>;
  sources: Array<{
    id: string;
    kind: ProvenanceKind;
    fingerprint: string;
    label: string;
  }>;
}

const fail = (code: DesignIntentErrorCode, path: string, message: string): never => {
  throw new DesignIntentError(code, path, message);
};

const own = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const strictObject = <K extends string>(value: unknown, path: string, keys: readonly K[]): Record<K, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail("invalid-type", path, "Expected an object.");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set<string>(keys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail("unknown-key", `${path}.${key}`, "Unknown keys are not accepted.");
  }
  for (const key of keys) {
    if (!own(record, key)) fail("missing-key", `${path}.${key}`, "This required field is missing.");
  }
  return record as Record<K, unknown>;
};

const arrayOf = (value: unknown, path: string, maximum: number): unknown[] => {
  if (!Array.isArray(value)) return fail("invalid-type", path, "Expected an array.");
  if (value.length > maximum) fail("too-many-items", path, `Expected at most ${maximum} items.`);
  return value;
};

const text = (value: unknown, path: string, maximum: number): string => {
  if (typeof value !== "string") return fail("invalid-type", path, "Expected text.");
  const normalized = value.trim();
  if (!normalized) return fail("invalid-value", path, "Text cannot be empty.");
  if (normalized.length > maximum) fail("string-too-long", path, `Text cannot exceed ${maximum} characters.`);
  return normalized;
};

const optionalText = (value: unknown, path: string, maximum: number): string | null =>
  value === null ? null : text(value, path, maximum);

const oneOf = <T extends string>(
  value: unknown,
  path: string,
  values: readonly T[],
): T => {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) {
    return fail("invalid-value", path, `Expected one of: ${values.join(", ")}.`);
  }
  return value as T;
};

const boundedNumber = (
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail("invalid-number", path, "Expected a finite number.");
  }
  if (value < minimum || value > maximum) {
    return fail("out-of-range", path, `Expected a value from ${minimum} through ${maximum}.`);
  }
  return value;
};

const optionalNumber = (
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number | null => value === null ? null : boundedNumber(value, path, minimum, maximum);

const boundedInteger = (
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    return fail("invalid-integer", path, "Expected a safe whole number.");
  }
  if (value < minimum || value > maximum) {
    return fail("out-of-range", path, `Expected a whole number from ${minimum} through ${maximum}.`);
  }
  return value;
};

const optionalInteger = (
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): number | null => value === null ? null : boundedInteger(value, path, minimum, maximum);

const optionalBoolean = (value: unknown, path: string): boolean | null => {
  if (value === null) return null;
  if (typeof value !== "boolean") return fail("invalid-type", path, "Expected true, false, or null.");
  return value;
};

const identifier = (value: unknown, path: string): string => {
  const normalized = text(value, path, 64);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(normalized)) {
    return fail("invalid-value", path, "Expected a lowercase letter/number identifier with optional hyphens.");
  }
  return normalized;
};

const uniqueValues = <T extends string>(values: T[], path: string): T[] => {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) fail("duplicate-value", `${path}[${index}]`, "Set-like values must be unique.");
    seen.add(value);
  });
  return values;
};

const uniqueIds = <T extends { id: string }>(values: T[], path: string): T[] => {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value.id)) fail("duplicate-id", `${path}[${index}].id`, "Identifiers must be unique.");
    seen.add(value.id);
  });
  return values;
};

const parseStringSet = <T extends string>(
  value: unknown,
  path: string,
  maximum: number,
  choices: readonly T[],
): T[] => uniqueValues(arrayOf(value, path, maximum).map((item, index) => oneOf(item, `${path}[${index}]`, choices)), path);

const parseIdSet = (value: unknown, path: string, maximum: number): string[] =>
  uniqueValues(arrayOf(value, path, maximum).map((item, index) => identifier(item, `${path}[${index}]`)), path);

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const REQUESTED_USE = ["cabin", "primary-home", "guest-house", "hospitality-stay", "workspace", "other"] as const;
const OCCUPANCY = ["year-round", "seasonal", "short-stay", "flexible", "unknown"] as const;
const ROOM_USE = ["living", "kitchen", "dining", "bedroom", "bathroom", "utility", "storage", "workspace", "entry", "flex", "other"] as const;
const ROOF_FORM = ["gable", "hipped", "shed", "flat", "a-frame", "unknown"] as const;
const DIRECTION = ["north", "east", "south", "west"] as const;
const MATERIAL = ["timber", "glass", "metal", "metal-roof", "masonry", "concrete", "earth", "bio-based", "reclaimed", "low-carbon", "unknown"] as const;
const CLIMATE = ["cold-continental", "marine", "tropical-humid", "tropical-dry", "mountain", "unknown"] as const;
const CONFIDENCE = ["explicit", "strong-inference", "weak-inference", "unknown"] as const;
const SOURCE_KIND = ["uploaded-image", "user-answer", "project-context", "system-rule"] as const;

export function parseDesignIntent(value: unknown): DesignIntent {
  const root = strictObject(value, "$", [
    "version", "requestedUse", "approximateFootprint", "storeys", "rooms", "roof",
    "openings", "materials", "climate", "siting", "assumptions", "unresolved",
    "confidence", "sources",
  ] as const);
  if (root.version !== DESIGN_INTENT_VERSION) {
    fail("invalid-value", "$.version", `Expected ${DESIGN_INTENT_VERSION}.`);
  }

  const requestedUseValue = strictObject(root.requestedUse, "$.requestedUse", ["category", "occupancy", "details"] as const);
  const requestedUse = {
    category: oneOf(requestedUseValue.category, "$.requestedUse.category", REQUESTED_USE),
    occupancy: oneOf(requestedUseValue.occupancy, "$.requestedUse.occupancy", OCCUPANCY),
    details: optionalText(requestedUseValue.details, "$.requestedUse.details", 240),
  };
  if (requestedUse.category === "other" && requestedUse.details === null) {
    fail("required-detail", "$.requestedUse.details", "Other requested uses need a short description.");
  }

  const footprintValue = strictObject(root.approximateFootprint, "$.approximateFootprint", ["unit", "targetM2", "minimumM2", "maximumM2"] as const);
  if (footprintValue.unit !== "m2") fail("invalid-value", "$.approximateFootprint.unit", "Only square metres are canonical.");
  const approximateFootprint = {
    unit: "m2" as const,
    targetM2: optionalNumber(footprintValue.targetM2, "$.approximateFootprint.targetM2", 8, 2_000),
    minimumM2: optionalNumber(footprintValue.minimumM2, "$.approximateFootprint.minimumM2", 8, 2_000),
    maximumM2: optionalNumber(footprintValue.maximumM2, "$.approximateFootprint.maximumM2", 8, 2_000),
  };
  if (
    (approximateFootprint.minimumM2 !== null && approximateFootprint.maximumM2 !== null && approximateFootprint.minimumM2 > approximateFootprint.maximumM2) ||
    (approximateFootprint.targetM2 !== null && approximateFootprint.minimumM2 !== null && approximateFootprint.targetM2 < approximateFootprint.minimumM2) ||
    (approximateFootprint.targetM2 !== null && approximateFootprint.maximumM2 !== null && approximateFootprint.targetM2 > approximateFootprint.maximumM2)
  ) {
    fail("inconsistent-range", "$.approximateFootprint", "Target and minimum/maximum footprint values disagree.");
  }

  const storeysValue = strictObject(root.storeys, "$.storeys", ["count", "splitLevel"] as const);
  const storeys = {
    count: optionalInteger(storeysValue.count, "$.storeys.count", 1, 6),
    splitLevel: optionalBoolean(storeysValue.splitLevel, "$.storeys.splitLevel"),
  };

  const rooms = uniqueIds(arrayOf(root.rooms, "$.rooms", 24).map((item, index) => {
    const path = `$.rooms[${index}]`;
    const room = strictObject(item, path, ["id", "use", "label", "count", "minimumAreaM2"] as const);
    const parsed = {
      id: identifier(room.id, `${path}.id`),
      use: oneOf(room.use, `${path}.use`, ROOM_USE),
      label: optionalText(room.label, `${path}.label`, 120),
      count: boundedInteger(room.count, `${path}.count`, 1, 12),
      minimumAreaM2: optionalNumber(room.minimumAreaM2, `${path}.minimumAreaM2`, 2, 500),
    };
    if (parsed.use === "other" && parsed.label === null) {
      fail("required-detail", `${path}.label`, "Other room uses need a short label.");
    }
    return parsed;
  }), "$.rooms");

  const roofValue = strictObject(root.roof, "$.roof", ["forms", "preferredPitchDegrees"] as const);
  const roof = {
    forms: parseStringSet(roofValue.forms, "$.roof.forms", 3, ROOF_FORM),
    preferredPitchDegrees: optionalNumber(roofValue.preferredPitchDegrees, "$.roof.preferredPitchDegrees", 0, 89),
  };

  const openingsValue = strictObject(root.openings, "$.openings", ["glazingLevel", "windowCount", "exteriorDoorCount", "orientationPriorities"] as const);
  const openings = {
    glazingLevel: oneOf(openingsValue.glazingLevel, "$.openings.glazingLevel", ["minimal", "balanced", "generous", "unknown"] as const),
    windowCount: optionalInteger(openingsValue.windowCount, "$.openings.windowCount", 0, 128),
    exteriorDoorCount: optionalInteger(openingsValue.exteriorDoorCount, "$.openings.exteriorDoorCount", 0, 32),
    orientationPriorities: parseStringSet(openingsValue.orientationPriorities, "$.openings.orientationPriorities", 4, DIRECTION),
  };

  const materialsValue = strictObject(root.materials, "$.materials", ["preferences", "notes"] as const);
  const materials = {
    preferences: parseStringSet(materialsValue.preferences, "$.materials.preferences", 12, MATERIAL),
    notes: optionalText(materialsValue.notes, "$.materials.notes", 500),
  };

  const climateValue = strictObject(root.climate, "$.climate", ["country", "region", "profile"] as const);
  const climate = {
    country: oneOf(climateValue.country, "$.climate.country", ["CA", "CR", "unknown"] as const),
    region: optionalText(climateValue.region, "$.climate.region", 120),
    profile: oneOf(climateValue.profile, "$.climate.profile", CLIMATE),
  };

  const sitingValue = strictObject(root.siting, "$.siting", ["orientationPreference", "slope", "access", "viewPriorities"] as const);
  const siting = {
    orientationPreference: oneOf(sitingValue.orientationPreference, "$.siting.orientationPreference", [...DIRECTION, "none", "unknown"] as const),
    slope: oneOf(sitingValue.slope, "$.siting.slope", ["flat", "gentle", "steep", "unknown"] as const),
    access: oneOf(sitingValue.access, "$.siting.access", ["road", "trail", "water", "unknown"] as const),
    viewPriorities: parseStringSet(sitingValue.viewPriorities, "$.siting.viewPriorities", 4, DIRECTION),
  };

  const assumptions = uniqueIds(arrayOf(root.assumptions, "$.assumptions", 64).map((item, index) => {
    const path = `$.assumptions[${index}]`;
    const assumption = strictObject(item, path, ["id", "field", "statement", "sourceIds"] as const);
    return {
      id: identifier(assumption.id, `${path}.id`),
      field: oneOf(assumption.field, `${path}.field`, DESIGN_INTENT_FIELDS),
      statement: text(assumption.statement, `${path}.statement`, 500),
      sourceIds: parseIdSet(assumption.sourceIds, `${path}.sourceIds`, 16),
    };
  }), "$.assumptions");

  const unresolved = uniqueIds(arrayOf(root.unresolved, "$.unresolved", 64).map((item, index) => {
    const path = `$.unresolved[${index}]`;
    const unknown = strictObject(item, path, ["id", "field", "question"] as const);
    return {
      id: identifier(unknown.id, `${path}.id`),
      field: oneOf(unknown.field, `${path}.field`, DESIGN_INTENT_FIELDS),
      question: text(unknown.question, `${path}.question`, 300),
    };
  }), "$.unresolved");

  const confidence = arrayOf(root.confidence, "$.confidence", DESIGN_INTENT_FIELDS.length).map((item, index) => {
    const path = `$.confidence[${index}]`;
    const entry = strictObject(item, path, ["field", "level", "sourceIds"] as const);
    return {
      field: oneOf(entry.field, `${path}.field`, DESIGN_INTENT_FIELDS),
      level: oneOf(entry.level, `${path}.level`, CONFIDENCE),
      sourceIds: parseIdSet(entry.sourceIds, `${path}.sourceIds`, 16),
    };
  });
  const confidenceFields = new Set<DesignIntentField>();
  confidence.forEach((entry, index) => {
    if (confidenceFields.has(entry.field)) fail("duplicate-field", `$.confidence[${index}].field`, "Each intent field needs one confidence entry.");
    confidenceFields.add(entry.field);
  });
  if (confidenceFields.size !== DESIGN_INTENT_FIELDS.length) {
    fail("missing-confidence", "$.confidence", "Every intent field needs exactly one confidence entry.");
  }

  const sources = uniqueIds(arrayOf(root.sources, "$.sources", 32).map((item, index) => {
    const path = `$.sources[${index}]`;
    const source = strictObject(item, path, ["id", "kind", "fingerprint", "label"] as const);
    const fingerprint = text(source.fingerprint, `${path}.fingerprint`, 96).toLowerCase();
    if (!/^sha256:[a-f0-9]{64}$/.test(fingerprint)) {
      fail("invalid-value", `${path}.fingerprint`, "Expected a SHA-256 source fingerprint.");
    }
    return {
      id: identifier(source.id, `${path}.id`),
      kind: oneOf(source.kind, `${path}.kind`, SOURCE_KIND),
      fingerprint,
      label: text(source.label, `${path}.label`, 240),
    };
  }), "$.sources");
  if (sources.length === 0) {
    fail("missing-source", "$.sources", "Design intent needs at least one source-provenance record.");
  }

  const sourceIds = new Set(sources.map((source) => source.id));
  const validateSourceReferences = (values: string[], path: string) => {
    values.forEach((sourceId, index) => {
      if (!sourceIds.has(sourceId)) fail("unknown-source", `${path}[${index}]`, `Unknown source ${sourceId}.`);
    });
  };
  assumptions.forEach((assumption, index) => {
    if (assumption.sourceIds.length === 0) {
      fail("missing-source", `$.assumptions[${index}].sourceIds`, "Assumptions need source provenance.");
    }
    validateSourceReferences(assumption.sourceIds, `$.assumptions[${index}].sourceIds`);
  });
  confidence.forEach((entry, index) => {
    validateSourceReferences(entry.sourceIds, `$.confidence[${index}].sourceIds`);
    if (entry.level !== "unknown" && entry.sourceIds.length === 0) {
      fail("missing-source", `$.confidence[${index}].sourceIds`, "Known or inferred confidence needs provenance.");
    }
  });
  const unresolvedFields = new Set(unresolved.map((item) => item.field));
  if (confidence.some((entry) => entry.level === "unknown" && !unresolvedFields.has(entry.field))) {
    fail("missing-unresolved", "$.confidence", "Every unknown field needs an unresolved question.");
  }

  return deepFreeze({
    version: DESIGN_INTENT_VERSION,
    requestedUse,
    approximateFootprint,
    storeys,
    rooms,
    roof,
    openings,
    materials,
    climate,
    siting,
    assumptions,
    unresolved,
    confidence,
    sources,
  });
}
