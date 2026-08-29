/**
 * Provider-neutral orchestration for image-to-DesignIntent tasks.
 *
 * This boundary owns validation, isolation, cancellation, timeout, safe error
 * normalization, and provider-cost evidence. It deliberately does not select
 * or call a hosted model. A future hosted implementation and today's fixed
 * fixture both implement the same injected adapter contract.
 */

import { parseDesignIntent, type DesignIntent } from "./designIntent";
import {
  IMAGE_INTAKE_VERSION,
  sniffImageMimeType,
  type ImageOrientation,
  type ImageOrientationTransform,
  type ImageRetention,
  type ImageRights,
  type PreparedImageIntake,
  type SupportedImageMimeType,
} from "./imageIntake";

export const DESIGN_INTENT_ADAPTER_VERSION = "aura-design-intent-adapter/v1" as const;

export type DesignIntentAdapterKind = "deterministic-fake" | "hosted";
export type DesignIntentTaskErrorCode =
  | "invalid-request"
  | "invalid-adapter"
  | "cancelled"
  | "timeout"
  | "unavailable"
  | "rate-limited"
  | "payment-required"
  | "provider-failed"
  | "invalid-output"
  | "invalid-receipt";
export type DesignIntentAdapterFailureCode =
  | "cancelled"
  | "unavailable"
  | "rate-limited"
  | "payment-required";

const BOUNDED_ADAPTER_FAILURES = new WeakSet<object>();

const SAFE_MESSAGES: Readonly<Record<DesignIntentTaskErrorCode, string>> = Object.freeze({
  "invalid-request": "The design-intent task request is invalid.",
  "invalid-adapter": "The selected design-intent adapter is invalid.",
  cancelled: "The design-intent task was cancelled.",
  timeout: "The design-intent task exceeded its local time limit.",
  unavailable: "The design-intent service is temporarily unavailable.",
  "rate-limited": "The design-intent service is temporarily rate limited.",
  "payment-required": "The design-intent service cannot run without an approved payment boundary.",
  "provider-failed": "The design-intent service did not complete the task.",
  "invalid-output": "The design-intent service returned output that Aura cannot safely use.",
  "invalid-receipt": "The design-intent service returned invalid usage or cost evidence.",
});

export class DesignIntentTaskError extends Error {
  readonly code: DesignIntentTaskErrorCode;
  readonly retryable: boolean;

  constructor(code: DesignIntentTaskErrorCode, retryable = false) {
    super(SAFE_MESSAGES[code]);
    this.name = "DesignIntentTaskError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class DesignIntentAdapterFailure extends Error {
  readonly code: DesignIntentAdapterFailureCode;

  constructor(code: DesignIntentAdapterFailureCode) {
    super("The adapter reported a bounded task failure.");
    this.name = "DesignIntentAdapterFailure";
    this.code = code;
    BOUNDED_ADAPTER_FAILURES.add(this);
    Object.freeze(this);
  }
}

export interface DesignIntentImageInput {
  intake: PreparedImageIntake;
  bytes: Uint8Array;
  sourceFingerprint: string;
}

export interface DesignIntentTaskRequest {
  version: typeof DESIGN_INTENT_ADAPTER_VERSION;
  task: "image-to-design-intent";
  requestId: string;
  timeoutMs: number;
  image: DesignIntentImageInput;
}

export interface RawDesignIntentExecutionReceipt {
  currency: "USD";
  providerCostMicros: number;
  inputTokens: number | null;
  outputTokens: number | null;
  modelId: string;
  providerRequestId: string | null;
}

export interface RawDesignIntentAdapterResponse {
  intent: unknown;
  receipt: unknown;
}

export interface DesignIntentAdapterContext {
  signal: AbortSignal;
}

export interface DesignIntentAdapter {
  id: string;
  version: string;
  kind: DesignIntentAdapterKind;
  run(
    request: DesignIntentTaskRequest,
    context: DesignIntentAdapterContext,
  ): Promise<RawDesignIntentAdapterResponse>;
}

export interface DesignIntentExecutionReceipt extends RawDesignIntentExecutionReceipt {}

export interface DesignIntentTaskResponse {
  version: typeof DESIGN_INTENT_ADAPTER_VERSION;
  requestId: string;
  adapter: {
    id: string;
    version: string;
    kind: DesignIntentAdapterKind;
  };
  intent: DesignIntent;
  receipt: DesignIntentExecutionReceipt;
}

export interface RunDesignIntentTaskOptions {
  signal?: AbortSignal;
}

export interface DeterministicDesignIntentFakeFixture {
  id: string;
  version: string;
  intent: unknown;
  receipt: unknown;
}

const REQUEST_KEYS = ["version", "task", "requestId", "timeoutMs", "image"] as const;
const IMAGE_KEYS = ["intake", "bytes", "sourceFingerprint"] as const;
const INTAKE_KEYS = [
  "version",
  "name",
  "mimeType",
  "declaredMimeType",
  "encodedBytes",
  "width",
  "height",
  "displayWidth",
  "displayHeight",
  "pixels",
  "orientation",
  "orientationTransform",
  "consentToAnalyze",
  "rights",
  "retention",
  "rawImageDisposition",
] as const;
const RESPONSE_KEYS = ["intent", "receipt"] as const;
const ADAPTER_KEYS = ["id", "version", "kind", "run"] as const;
const FAKE_FIXTURE_KEYS = ["id", "version", "intent", "receipt"] as const;
const RECEIPT_KEYS = [
  "currency",
  "providerCostMicros",
  "inputTokens",
  "outputTokens",
  "modelId",
  "providerRequestId",
] as const;

const ORIENTATION_TRANSFORMS: Readonly<Record<ImageOrientation, ImageOrientationTransform>> = Object.freeze({
  1: "none",
  2: "flip-horizontal",
  3: "rotate-180",
  4: "flip-vertical",
  5: "transpose",
  6: "rotate-90-cw",
  7: "transverse",
  8: "rotate-90-ccw",
});
const IMAGE_RIGHTS = new Set<ImageRights>([
  "i-own-this-image",
  "i-have-permission",
  "reference-only-inspiration",
]);
const IMAGE_RETENTION = new Set<ImageRetention>([
  "delete-after-analysis",
  "retain-with-project",
]);
const ADAPTER_KINDS = new Set<DesignIntentAdapterKind>(["deterministic-fake", "hosted"]);

const taskError = (code: DesignIntentTaskErrorCode, retryable = false): never => {
  throw new DesignIntentTaskError(code, retryable);
};

const strictDataObject = <K extends string>(
  value: unknown,
  keys: readonly K[],
  code: DesignIntentTaskErrorCode,
): Record<K, unknown> => {
  if (typeof value !== "object" || value === null) return taskError(code);

  let isArray: boolean;
  let prototype: object | null;
  let ownKeys: Array<string | symbol>;
  let descriptors: Array<PropertyDescriptor | undefined>;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    ownKeys = Reflect.ownKeys(value);
    descriptors = ownKeys.map((key) => Object.getOwnPropertyDescriptor(value, key));
  } catch {
    return taskError(code);
  }
  if (isArray || (prototype !== Object.prototype && prototype !== null)) return taskError(code);

  const allowed = new Set<string>(keys);
  const result: Partial<Record<K, unknown>> = {};
  ownKeys.forEach((key, index) => {
    if (typeof key !== "string" || !allowed.has(key)) taskError(code);
    const descriptor = descriptors[index];
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) taskError(code);
    result[key as K] = (descriptor as PropertyDescriptor & { value: unknown }).value;
  });
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(result, key)) taskError(code);
  }
  return result as Record<K, unknown>;
};

const boundedDataString = (
  value: unknown,
  code: DesignIntentTaskErrorCode,
  maximum: number,
): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) return taskError(code);
  if (value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) return taskError(code);
  return value;
};

const boundedIdentifier = (value: unknown, code: DesignIntentTaskErrorCode): string => {
  const id = boundedDataString(value, code, 128);
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9._:/-]{0,126}[A-Za-z0-9])?$/.test(id)) return taskError(code);
  return id;
};

const safeWholeNumber = (
  value: unknown,
  code: DesignIntentTaskErrorCode,
  maximum = Number.MAX_SAFE_INTEGER,
): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    return taskError(code);
  }
  return value as number;
};

const positiveWholeNumber = (
  value: unknown,
  code: DesignIntentTaskErrorCode,
  maximum = Number.MAX_SAFE_INTEGER,
): number => {
  const parsed = safeWholeNumber(value, code, maximum);
  if (parsed === 0) return taskError(code);
  return parsed;
};

const snapshotBytes = (value: unknown): Uint8Array => {
  let isBytes = false;
  try {
    isBytes = value instanceof Uint8Array;
  } catch {
    return taskError("invalid-request");
  }
  if (!isBytes) return taskError("invalid-request");
  try {
    return Uint8Array.prototype.slice.call(value) as Uint8Array;
  } catch {
    return taskError("invalid-request");
  }
};

const parseIntake = (
  value: unknown,
  bytes: Uint8Array,
): PreparedImageIntake => {
  const intake = strictDataObject(value, INTAKE_KEYS, "invalid-request");
  if (intake.version !== IMAGE_INTAKE_VERSION) return taskError("invalid-request");
  const name = boundedDataString(intake.name, "invalid-request", 240);
  const mimeType = intake.mimeType;
  if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp") {
    return taskError("invalid-request");
  }
  const declaredMimeType = intake.declaredMimeType;
  if (declaredMimeType !== null && declaredMimeType !== mimeType) return taskError("invalid-request");
  if (sniffImageMimeType(bytes) !== mimeType) return taskError("invalid-request");

  const encodedBytes = positiveWholeNumber(intake.encodedBytes, "invalid-request", 12 * 1024 * 1024);
  if (encodedBytes !== bytes.byteLength) return taskError("invalid-request");
  const width = positiveWholeNumber(intake.width, "invalid-request", 12_000);
  const height = positiveWholeNumber(intake.height, "invalid-request", 12_000);
  const displayWidth = positiveWholeNumber(intake.displayWidth, "invalid-request", 12_000);
  const displayHeight = positiveWholeNumber(intake.displayHeight, "invalid-request", 12_000);
  const pixels = positiveWholeNumber(intake.pixels, "invalid-request", 40_000_000);
  if (pixels !== width * height) return taskError("invalid-request");

  const orientation = safeWholeNumber(intake.orientation, "invalid-request", 8) as ImageOrientation;
  if (orientation < 1 || ORIENTATION_TRANSFORMS[orientation] !== intake.orientationTransform) {
    return taskError("invalid-request");
  }
  const swapsAxes = orientation >= 5;
  if (
    displayWidth !== (swapsAxes ? height : width) ||
    displayHeight !== (swapsAxes ? width : height)
  ) {
    return taskError("invalid-request");
  }
  if (intake.consentToAnalyze !== true || !IMAGE_RIGHTS.has(intake.rights as ImageRights)) {
    return taskError("invalid-request");
  }
  if (!IMAGE_RETENTION.has(intake.retention as ImageRetention)) return taskError("invalid-request");
  const disposition = intake.retention === "delete-after-analysis"
    ? "delete when the analysis task finishes or fails"
    : "retain only with this project until the person deletes it";
  if (intake.rawImageDisposition !== disposition) return taskError("invalid-request");

  return Object.freeze({
    version: IMAGE_INTAKE_VERSION,
    name,
    mimeType: mimeType as SupportedImageMimeType,
    declaredMimeType: declaredMimeType as SupportedImageMimeType | null,
    encodedBytes,
    width,
    height,
    displayWidth,
    displayHeight,
    pixels,
    orientation,
    orientationTransform: ORIENTATION_TRANSFORMS[orientation],
    consentToAnalyze: true,
    rights: intake.rights as ImageRights,
    retention: intake.retention as ImageRetention,
    rawImageDisposition: disposition,
  });
};

const parseRequest = (value: unknown): DesignIntentTaskRequest => {
  const request = strictDataObject(value, REQUEST_KEYS, "invalid-request");
  if (
    request.version !== DESIGN_INTENT_ADAPTER_VERSION ||
    request.task !== "image-to-design-intent"
  ) {
    return taskError("invalid-request");
  }
  const requestId = boundedIdentifier(request.requestId, "invalid-request");
  const timeoutMs = positiveWholeNumber(request.timeoutMs, "invalid-request", 120_000);
  const image = strictDataObject(request.image, IMAGE_KEYS, "invalid-request");
  const bytes = snapshotBytes(image.bytes);
  if (bytes.byteLength === 0) return taskError("invalid-request");
  const sourceFingerprint = boundedDataString(image.sourceFingerprint, "invalid-request", 71).toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(sourceFingerprint)) return taskError("invalid-request");
  const intake = parseIntake(image.intake, bytes);

  return Object.freeze({
    version: DESIGN_INTENT_ADAPTER_VERSION,
    task: "image-to-design-intent",
    requestId,
    timeoutMs,
    image: Object.freeze({ intake, bytes, sourceFingerprint }),
  });
};

const parseAdapterDescriptor = (adapter: DesignIntentAdapter) => {
  const descriptor = strictDataObject(adapter, ADAPTER_KEYS, "invalid-adapter");
  const { id, version, kind, run } = descriptor;
  if (!ADAPTER_KINDS.has(kind as DesignIntentAdapterKind) || typeof run !== "function") {
    return taskError("invalid-adapter");
  }
  return Object.freeze({
    id: boundedIdentifier(id, "invalid-adapter"),
    version: boundedIdentifier(version, "invalid-adapter"),
    kind: kind as DesignIntentAdapterKind,
    run: run as DesignIntentAdapter["run"],
  });
};

const optionalCount = (value: unknown): number | null =>
  value === null ? null : safeWholeNumber(value, "invalid-receipt");

const optionalReceiptId = (value: unknown): string | null =>
  value === null ? null : boundedDataString(value, "invalid-receipt", 256);

const parseReceipt = (value: unknown): DesignIntentExecutionReceipt => {
  const receipt = strictDataObject(value, RECEIPT_KEYS, "invalid-receipt");
  if (receipt.currency !== "USD") return taskError("invalid-receipt");
  return Object.freeze({
    currency: "USD",
    providerCostMicros: safeWholeNumber(receipt.providerCostMicros, "invalid-receipt"),
    inputTokens: optionalCount(receipt.inputTokens),
    outputTokens: optionalCount(receipt.outputTokens),
    modelId: boundedDataString(receipt.modelId, "invalid-receipt", 256),
    providerRequestId: optionalReceiptId(receipt.providerRequestId),
  });
};

const normalizeAdapterFailure = (error: unknown): DesignIntentTaskError => {
  let isBoundedFailure = false;
  try {
    isBoundedFailure =
      typeof error === "object" &&
      error !== null &&
      BOUNDED_ADAPTER_FAILURES.has(error);
  } catch {
    return new DesignIntentTaskError("provider-failed");
  }
  if (isBoundedFailure) {
    const failure = error as DesignIntentAdapterFailure;
    switch (failure.code) {
      case "cancelled":
        return new DesignIntentTaskError("cancelled");
      case "unavailable":
        return new DesignIntentTaskError("unavailable", true);
      case "rate-limited":
        return new DesignIntentTaskError("rate-limited", true);
      case "payment-required":
        return new DesignIntentTaskError("payment-required");
    }
  }
  return new DesignIntentTaskError("provider-failed");
};

export async function runDesignIntentTask(
  requestValue: DesignIntentTaskRequest,
  adapterValue: DesignIntentAdapter,
  options: RunDesignIntentTaskOptions = {},
): Promise<DesignIntentTaskResponse> {
  const request = parseRequest(requestValue);
  const adapter = parseAdapterDescriptor(adapterValue);
  if (options.signal?.aborted) return taskError("cancelled");

  const controller = new AbortController();
  let cancelled = false;
  let timedOut = false;
  const onCallerAbort = () => {
    cancelled = true;
    controller.abort();
  };
  options.signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, request.timeoutMs);
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("task aborted")), { once: true });
  });

  let raw: RawDesignIntentAdapterResponse;
  try {
    const work = Promise.resolve().then(() =>
      adapter.run(request, { signal: controller.signal }),
    );
    raw = await Promise.race([work, aborted]);
  } catch (error) {
    if (cancelled || options.signal?.aborted) return taskError("cancelled");
    if (timedOut) return taskError("timeout");
    throw normalizeAdapterFailure(error);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }

  const response = strictDataObject(raw, RESPONSE_KEYS, "invalid-output");
  let intent: DesignIntent;
  try {
    intent = parseDesignIntent(response.intent);
  } catch {
    return taskError("invalid-output");
  }
  if (!intent.sources.some(
    (source) =>
      source.kind === "uploaded-image" &&
      source.fingerprint === request.image.sourceFingerprint,
  )) {
    return taskError("invalid-output");
  }
  const receipt = parseReceipt(response.receipt);

  return Object.freeze({
    version: DESIGN_INTENT_ADAPTER_VERSION,
    requestId: request.requestId,
    adapter: Object.freeze({ id: adapter.id, version: adapter.version, kind: adapter.kind }),
    intent,
    receipt,
  });
}

export function createDeterministicDesignIntentFake(
  fixture: DeterministicDesignIntentFakeFixture,
): DesignIntentAdapter {
  const fixtureRecord = strictDataObject(fixture, FAKE_FIXTURE_KEYS, "invalid-adapter");
  const id = boundedIdentifier(fixtureRecord.id, "invalid-adapter");
  const version = boundedIdentifier(fixtureRecord.version, "invalid-adapter");
  let intent: DesignIntent;
  try {
    intent = parseDesignIntent(fixtureRecord.intent);
  } catch {
    return taskError("invalid-output");
  }
  const receipt = parseReceipt(fixtureRecord.receipt);

  return Object.freeze({
    id,
    version,
    kind: "deterministic-fake" as const,
    async run(_request: DesignIntentTaskRequest, context: DesignIntentAdapterContext) {
      if (context.signal.aborted) throw new DesignIntentAdapterFailure("cancelled");
      return { intent, receipt: { ...receipt } };
    },
  });
}
