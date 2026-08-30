import { Buffer } from "node:buffer";

import {
  DesignIntentAdapterFailure,
  type DesignIntentAdapter,
  type DesignIntentAdapterContext,
  type DesignIntentTaskRequest,
  type RawDesignIntentAdapterResponse,
} from "./designIntentAdapter";
import { DESIGN_INTENT_FIELDS, DESIGN_INTENT_VERSION } from "./designIntent";

export const OPENROUTER_DESIGN_INTENT_ADAPTER_VERSION =
  "aura-openrouter-design-intent-adapter/v1" as const;

type JsonSchema = Readonly<Record<string, unknown>>;

const enumSchema = (values: readonly string[]): JsonSchema => ({
  type: "string",
  enum: [...values],
});

const nullable = (schema: JsonSchema): JsonSchema => ({
  anyOf: [schema, { type: "null" }],
});

const objectSchema = (
  properties: Readonly<Record<string, JsonSchema>>,
): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

const arraySchema = (items: JsonSchema, maximum: number, minimum = 0): JsonSchema => ({
  type: "array",
  items,
  ...(minimum > 0 ? { minItems: minimum } : {}),
  maxItems: maximum,
});

const textSchema = (maximum: number): JsonSchema => ({
  type: "string",
  minLength: 1,
  maxLength: maximum,
});

const identifierSchema: JsonSchema = {
  type: "string",
  minLength: 1,
  maxLength: 64,
  pattern: "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$",
};

const directionSchema = enumSchema(["north", "east", "south", "west"]);
const fieldSchema = enumSchema(DESIGN_INTENT_FIELDS);
const sourceIdsSchema = arraySchema(identifierSchema, 16);

export const OPENROUTER_DESIGN_INTENT_SCHEMA: JsonSchema = objectSchema({
  version: { const: DESIGN_INTENT_VERSION },
  requestedUse: objectSchema({
    category: enumSchema([
      "cabin", "primary-home", "guest-house", "hospitality-stay", "workspace", "other",
    ]),
    occupancy: enumSchema(["year-round", "seasonal", "short-stay", "flexible", "unknown"]),
    details: nullable(textSchema(240)),
  }),
  approximateFootprint: objectSchema({
    unit: { const: "m2" },
    targetM2: nullable({ type: "number", minimum: 8, maximum: 2_000 }),
    minimumM2: nullable({ type: "number", minimum: 8, maximum: 2_000 }),
    maximumM2: nullable({ type: "number", minimum: 8, maximum: 2_000 }),
  }),
  storeys: objectSchema({
    count: nullable({ type: "integer", minimum: 1, maximum: 6 }),
    splitLevel: nullable({ type: "boolean" }),
  }),
  rooms: arraySchema(objectSchema({
    id: identifierSchema,
    use: enumSchema([
      "living", "kitchen", "dining", "bedroom", "bathroom", "utility", "storage",
      "workspace", "entry", "flex", "other",
    ]),
    label: nullable(textSchema(120)),
    count: { type: "integer", minimum: 1, maximum: 12 },
    minimumAreaM2: nullable({ type: "number", minimum: 2, maximum: 500 }),
  }), 24),
  roof: objectSchema({
    forms: arraySchema(enumSchema(["gable", "hipped", "shed", "flat", "a-frame", "unknown"]), 3),
    preferredPitchDegrees: nullable({ type: "number", minimum: 0, maximum: 89 }),
  }),
  openings: objectSchema({
    glazingLevel: enumSchema(["minimal", "balanced", "generous", "unknown"]),
    windowCount: nullable({ type: "integer", minimum: 0, maximum: 128 }),
    exteriorDoorCount: nullable({ type: "integer", minimum: 0, maximum: 32 }),
    orientationPriorities: arraySchema(directionSchema, 4),
  }),
  materials: objectSchema({
    preferences: arraySchema(enumSchema([
      "timber", "glass", "metal", "metal-roof", "masonry", "concrete", "earth",
      "bio-based", "reclaimed", "low-carbon", "unknown",
    ]), 11),
    notes: nullable(textSchema(500)),
  }),
  climate: objectSchema({
    country: enumSchema(["CA", "CR", "unknown"]),
    region: nullable(textSchema(120)),
    profile: enumSchema([
      "cold-continental", "marine", "tropical-humid", "tropical-dry", "mountain", "unknown",
    ]),
  }),
  siting: objectSchema({
    orientationPreference: enumSchema(["north", "east", "south", "west", "none", "unknown"]),
    slope: enumSchema(["flat", "gentle", "steep", "unknown"]),
    access: enumSchema(["road", "trail", "water", "unknown"]),
    viewPriorities: arraySchema(directionSchema, 4),
  }),
  assumptions: arraySchema(objectSchema({
    id: identifierSchema,
    field: fieldSchema,
    statement: textSchema(500),
    sourceIds: sourceIdsSchema,
  }), 64),
  unresolved: arraySchema(objectSchema({
    id: identifierSchema,
    field: fieldSchema,
    question: textSchema(300),
  }), 64),
  confidence: arraySchema(objectSchema({
    field: fieldSchema,
    level: enumSchema(["explicit", "strong-inference", "weak-inference", "unknown"]),
    sourceIds: sourceIdsSchema,
  }), DESIGN_INTENT_FIELDS.length, DESIGN_INTENT_FIELDS.length),
  sources: arraySchema(objectSchema({
    id: identifierSchema,
    kind: enumSchema(["uploaded-image", "user-answer", "project-context", "system-rule"]),
    fingerprint: {
      type: "string",
      minLength: 71,
      maxLength: 96,
      pattern: "^sha256:[a-fA-F0-9]{64}$",
    },
    label: textSchema(240),
  }), 32, 1),
});

export interface OpenRouterSystemMessage {
  readonly role: "system";
  readonly content: string;
}

export interface OpenRouterTextContent {
  readonly type: "text";
  readonly text: string;
}

export interface OpenRouterImageContent {
  readonly type: "image_url";
  readonly image_url: Readonly<{ url: string }>;
}

export interface OpenRouterUserMessage {
  readonly role: "user";
  readonly content: readonly [OpenRouterTextContent, OpenRouterImageContent];
}

export interface OpenRouterTransportRequest {
  readonly model: string;
  readonly messages: readonly [OpenRouterSystemMessage, OpenRouterUserMessage];
  readonly response_format: Readonly<{
    type: "json_schema";
    json_schema: Readonly<{
      name: "aura_design_intent";
      strict: true;
      schema: JsonSchema;
    }>;
  }>;
  readonly temperature: 0;
  readonly stream: false;
  readonly provider: Readonly<{
    require_parameters: true;
    data_collection: "deny";
    zdr: true;
    allow_fallbacks: false;
  }>;
}

export interface OpenRouterTransportResult {
  readonly status: number;
  readonly body: unknown;
}

export interface OpenRouterTransportContext {
  readonly signal: AbortSignal;
}

export interface OpenRouterTransport {
  send(
    request: OpenRouterTransportRequest,
    context: OpenRouterTransportContext,
  ): Promise<OpenRouterTransportResult>;
}

export interface OpenRouterDesignIntentAdapterConfig {
  readonly modelId: string;
  readonly transport: OpenRouterTransport;
}

class OpenRouterBoundaryRefusal extends Error {
  constructor() {
    super("The hosted boundary refused unsafe provider data.");
    this.name = "OpenRouterBoundaryRefusal";
  }
}

const refuse = (): never => {
  throw new OpenRouterBoundaryRefusal();
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

deepFreeze(OPENROUTER_DESIGN_INTENT_SCHEMA);

const inspectRecord = (
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return refuse();
  let array: boolean;
  let prototype: object | null;
  let keys: Array<string | symbol>;
  let descriptors: Array<PropertyDescriptor | undefined>;
  try {
    array = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(value, key));
  } catch {
    return refuse();
  }
  if (array || (prototype !== Object.prototype && prototype !== null)) return refuse();
  const allowed = new Set([...required, ...optional]);
  const output: Record<string, unknown> = {};
  keys.forEach((key, index) => {
    if (typeof key !== "string" || !allowed.has(key)) refuse();
    const descriptor = descriptors[index];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) refuse();
    output[key as string] = (descriptor as PropertyDescriptor & { value: unknown }).value;
  });
  for (const key of required) {
    if (!Object.hasOwn(output, key)) refuse();
  }
  return output;
};

const inspectArray = (value: unknown, maximum: number): unknown[] => {
  if (!Array.isArray(value)) return refuse();
  let prototype: object | null;
  let keys: Array<string | symbol>;
  let descriptors: Array<PropertyDescriptor | undefined>;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    descriptors = keys.map((key) => Object.getOwnPropertyDescriptor(value, key));
  } catch {
    return refuse();
  }
  if (prototype !== Array.prototype) return refuse();
  const lengthDescriptor = descriptors[keys.findIndex((key) => key === "length")];
  const length = lengthDescriptor && "value" in lengthDescriptor ? lengthDescriptor.value : null;
  if (!Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > maximum) return refuse();
  const indexed = new Map<number, unknown>();
  keys.forEach((key, descriptorIndex) => {
    if (key === "length") return;
    if (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(key)) refuse();
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= (length as number)) refuse();
    const descriptor = descriptors[descriptorIndex];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) refuse();
    indexed.set(index, (descriptor as PropertyDescriptor & { value: unknown }).value);
  });
  const output: unknown[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    if (!indexed.has(index)) refuse();
    output.push(indexed.get(index));
  }
  return output;
};

const boundedText = (value: unknown, maximum: number): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) return refuse();
  if (value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) return refuse();
  return value;
};

const modelIdentifier = (value: unknown): string => {
  const model = boundedText(value, 256);
  if (!/^[a-z0-9][a-z0-9._-]{0,63}\/[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/.test(model)) return refuse();
  return model;
};

const providerIdentifier = (value: unknown): string => {
  const identifier = boundedText(value, 256);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(identifier)) return refuse();
  return identifier;
};

const wholeNumber = (value: unknown): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return refuse();
  return value as number;
};

const usdMicros = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return refuse();
  const micros = Math.round(value * 1_000_000);
  if (!Number.isSafeInteger(micros) || micros < 0) return refuse();
  return micros;
};

const buildRequest = (
  request: DesignIntentTaskRequest,
  modelId: string,
): OpenRouterTransportRequest => {
  const mimeType = request.image.intake.mimeType;
  const encoded = Buffer.from(request.image.bytes).toString("base64");
  const fingerprint = request.image.sourceFingerprint;
  return deepFreeze({
    model: modelId,
    messages: [
      {
        role: "system" as const,
        content: "Extract only the bounded Aura DesignIntent contract. Never invent geometry, coordinates, walls, polygons, legal approval, professional review, price, or certainty. Preserve unknowns and weak inferences explicitly.",
      },
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Analyze this user-authorized cabin reference. The uploaded-image source fingerprint must be exactly ${fingerprint}. Return only the strict JSON object.`,
          },
          {
            type: "image_url" as const,
            image_url: { url: `data:${mimeType};base64,${encoded}` },
          },
        ] as const,
      },
    ] as const,
    response_format: {
      type: "json_schema" as const,
      json_schema: {
        name: "aura_design_intent" as const,
        strict: true as const,
        schema: OPENROUTER_DESIGN_INTENT_SCHEMA,
      },
    },
    temperature: 0 as const,
    stream: false as const,
    provider: {
      require_parameters: true as const,
      data_collection: "deny" as const,
      zdr: true as const,
      allow_fallbacks: false as const,
    },
  });
};

const parseProviderBody = (value: unknown): RawDesignIntentAdapterResponse => {
  const body = inspectRecord(value, ["id", "model", "choices", "usage"], [
    "created", "object", "system_fingerprint", "service_tier", "openrouter_metadata",
  ]);
  const requestId = providerIdentifier(body.id);
  const modelId = modelIdentifier(body.model);
  const choices = inspectArray(body.choices, 1);
  if (choices.length !== 1) return refuse();
  const choice = inspectRecord(choices[0], ["index", "finish_reason", "message"], [
    "native_finish_reason", "logprobs",
  ]);
  if (choice.index !== 0 || choice.finish_reason !== "stop") return refuse();
  const message = inspectRecord(choice.message, ["role", "content"], [
    "refusal", "reasoning", "reasoning_details", "annotations", "images", "tool_calls",
  ]);
  if (message.role !== "assistant") return refuse();
  const content = boundedText(message.content, 2_000_000);
  let intent: unknown;
  try {
    intent = JSON.parse(content);
  } catch {
    return refuse();
  }

  const usage = inspectRecord(body.usage, [
    "prompt_tokens", "completion_tokens", "total_tokens", "cost",
  ], [
    "prompt_tokens_details", "completion_tokens_details", "cost_details", "is_byok",
  ]);
  const inputTokens = wholeNumber(usage.prompt_tokens);
  const outputTokens = wholeNumber(usage.completion_tokens);
  wholeNumber(usage.total_tokens);

  return {
    intent,
    receipt: {
      currency: "USD",
      providerCostMicros: usdMicros(usage.cost),
      inputTokens,
      outputTokens,
      modelId,
      providerRequestId: requestId,
    },
  };
};

const parseTransportResult = (value: unknown): OpenRouterTransportResult => {
  const result = inspectRecord(value, ["status", "body"]);
  if (!Number.isSafeInteger(result.status) || (result.status as number) < 100 || (result.status as number) > 599) {
    return refuse();
  }
  return { status: result.status as number, body: result.body };
};

const mapStatus = (status: number): never => {
  if (status === 402) throw new DesignIntentAdapterFailure("payment-required");
  if (status === 429) throw new DesignIntentAdapterFailure("rate-limited");
  if (status === 408 || status >= 500) throw new DesignIntentAdapterFailure("unavailable");
  return refuse();
};

export function createOpenRouterDesignIntentAdapter(
  configValue: OpenRouterDesignIntentAdapterConfig,
): DesignIntentAdapter {
  const config = inspectRecord(configValue, ["modelId", "transport"]);
  const modelId = modelIdentifier(config.modelId);
  const transport = inspectRecord(config.transport, ["send"]);
  if (typeof transport.send !== "function") return refuse();
  const send = transport.send as OpenRouterTransport["send"];

  return Object.freeze({
    id: "openrouter-design-intent",
    version: OPENROUTER_DESIGN_INTENT_ADAPTER_VERSION,
    kind: "hosted" as const,
    async run(
      request: DesignIntentTaskRequest,
      context: DesignIntentAdapterContext,
    ): Promise<RawDesignIntentAdapterResponse> {
      if (context.signal.aborted) throw new DesignIntentAdapterFailure("cancelled");
      const payload = buildRequest(request, modelId);
      let rawResult: unknown;
      try {
        rawResult = await send(payload, { signal: context.signal });
      } catch {
        if (context.signal.aborted) throw new DesignIntentAdapterFailure("cancelled");
        throw new DesignIntentAdapterFailure("unavailable");
      }
      if (context.signal.aborted) throw new DesignIntentAdapterFailure("cancelled");
      const result = parseTransportResult(rawResult);
      if (result.status !== 200) return mapStatus(result.status);
      return parseProviderBody(result.body);
    },
  });
}
