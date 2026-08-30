import { createHash } from "node:crypto";

import {
  DesignIntentTaskError,
  runDesignIntentTask,
  type DesignIntentAdapter,
  type DesignIntentTaskRequest,
  type DesignIntentTaskResponse,
} from "./designIntentAdapter";

export const OPENROUTER_EXECUTION_CONTROLS_VERSION =
  "aura-openrouter-execution-controls/v1" as const;
export const OPENROUTER_CONTROL_STATE_VERSION = 1 as const;

export type OpenRouterControlErrorCode =
  | "invalid-control-input"
  | "input-too-large"
  | "output-too-large"
  | "control-store-failed"
  | "accounting-failed"
  | "execution-failed"
  | "fake-failed";

const SAFE_MESSAGES: Readonly<Record<OpenRouterControlErrorCode, string>> = Object.freeze({
  "invalid-control-input": "The hosted execution control input is invalid.",
  "input-too-large": "The hosted task input exceeds its local byte ceiling.",
  "output-too-large": "The hosted task output exceeds its local byte ceiling.",
  "control-store-failed": "The hosted execution control state is unavailable.",
  "accounting-failed": "The hosted execution could not reconcile its reservation and cost.",
  "execution-failed": "The hosted execution returned an unsafe result.",
  "fake-failed": "The deterministic fallback could not complete safely.",
});

export class OpenRouterControlError extends Error {
  readonly code: OpenRouterControlErrorCode;

  constructor(code: OpenRouterControlErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "OpenRouterControlError";
    this.code = code;
    Object.freeze(this);
  }
}

const refuse = (code: OpenRouterControlErrorCode): never => {
  throw new OpenRouterControlError(code);
};

export interface OpenRouterControlPolicy {
  ruleId: string;
  liveExecutionEnabled: boolean;
  perUserRequestsPerMinute: number;
  perSessionRequestsPerMinute: number;
  perProjectRequestsPerMinute: number;
  globalDailyProviderCostMicros: number;
  maxProviderCostMicrosPerRequest: number;
  maxConcurrent: number;
  maxInputBytes: number;
  maxOutputBytes: number;
  contentRetention: "none";
  auditRetentionDays: number;
}

export interface OpenRouterExecutionScope {
  userId: string;
  sessionId: string;
  projectId: string;
}

export interface OpenRouterExecutionWindow {
  day: string;
  minute: string;
}

export interface OpenRouterControlRequest {
  policy: OpenRouterControlPolicy;
  scope: OpenRouterExecutionScope;
  window: OpenRouterExecutionWindow;
  request: DesignIntentTaskRequest;
  estimatedProviderCostMicros: number;
  declaredMaxOutputBytes: number;
}

export interface OpenRouterControlReservation {
  id: string;
  requestId: string;
  day: string;
  userHash: string;
  sessionHash: string;
  projectHash: string;
  reservedProviderCostMicros: number;
}

export interface OpenRouterControlRequestCount {
  requestId: string;
  minute: string;
  userHash: string;
  sessionHash: string;
  projectHash: string;
}

export interface OpenRouterControlState {
  version: typeof OPENROUTER_CONTROL_STATE_VERSION;
  day: string;
  committedProviderCostMicros: number;
  reservations: OpenRouterControlReservation[];
  requests: OpenRouterControlRequestCount[];
}

export interface OpenRouterStoreOperationResult {
  state: OpenRouterControlState;
  value: unknown;
}

export type OpenRouterStoreOperation = (
  state: OpenRouterControlState,
) => OpenRouterStoreOperationResult;

export interface OpenRouterAtomicControlStore {
  transact(operation: OpenRouterStoreOperation): Promise<unknown>;
  /**
   * Return a strongly consistent snapshot of durable state after every
   * preceding resolved transaction. The controller treats this method as a
   * trusted storage primitive; an adapter that cannot provide that guarantee
   * is not an OR02 control store.
   */
  read(): Promise<unknown>;
}

export interface OpenRouterControlDependencies {
  store: OpenRouterAtomicControlStore;
  hostedAdapter: DesignIntentAdapter;
  fallbackAdapter: DesignIntentAdapter;
}

export type OpenRouterControlRoute = "hosted" | "deterministic-fake";
export type OpenRouterControlReason =
  | "hosted-authorized"
  | "kill-switch"
  | "user-rate-limit"
  | "session-rate-limit"
  | "project-rate-limit"
  | "daily-spend-limit"
  | "concurrency-limit"
  | "hosted-unavailable"
  | "hosted-rate-limited"
  | "hosted-payment-required"
  | "hosted-timeout";

export interface OpenRouterControlCounters {
  userMinuteRequests: number;
  sessionMinuteRequests: number;
  projectMinuteRequests: number;
  activeReservations: number;
  committedProviderCostMicros: number;
  reservedProviderCostMicros: number;
}

export interface OpenRouterExecutionAuditReceipt {
  format: "aura-hosted-execution-audit";
  version: 1;
  controlsVersion: typeof OPENROUTER_EXECUTION_CONTROLS_VERSION;
  ruleId: string;
  requestId: string;
  day: string;
  minute: string;
  route: OpenRouterControlRoute;
  reason: OpenRouterControlReason;
  scope: {
    userHash: string;
    sessionHash: string;
    projectHash: string;
  };
  inputBytes: number;
  outputBytes: number;
  estimatedProviderCostMicros: number;
  actualProviderCostMicros: number;
  contentRetention: "none";
  auditRetentionDays: number;
  counters: OpenRouterControlCounters;
}

export interface OpenRouterControlledExecutionResult {
  route: OpenRouterControlRoute;
  response: DesignIntentTaskResponse;
  audit: OpenRouterExecutionAuditReceipt;
}

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
};

interface SnapshotState {
  seen: WeakSet<object>;
  nodes: number;
}

const MAX_DEPTH = 48;
const MAX_NODES = 40_000;
const MAX_ARRAY_ITEMS = 20_000;
const MAX_KEYS = 1_024;
const MAX_TEXT = 65_536;

function snapshotPlain(
  value: unknown,
  state: SnapshotState,
  depth = 0,
): unknown {
  state.nodes += 1;
  if (state.nodes > MAX_NODES || depth > MAX_DEPTH) return refuse("invalid-control-input");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return refuse("invalid-control-input");
    return value;
  }
  if (typeof value === "string") {
    if (value.length > MAX_TEXT) return refuse("invalid-control-input");
    return value;
  }
  if (typeof value !== "object") return refuse("invalid-control-input");

  try {
    if (state.seen.has(value)) return refuse("invalid-control-input");
    state.seen.add(value);
  } catch {
    return refuse("invalid-control-input");
  }

  let isBytes = false;
  try {
    isBytes = ArrayBuffer.isView(value) && Object.getPrototypeOf(value) === Uint8Array.prototype;
  } catch {
    return refuse("invalid-control-input");
  }
  if (isBytes) {
    try {
      const byteKeys = Reflect.ownKeys(value);
      if (byteKeys.length > MAX_ARRAY_ITEMS) return refuse("invalid-control-input");
      const copy = new Uint8Array(byteKeys.length);
      for (let index = 0; index < byteKeys.length; index += 1) {
        if (byteKeys[index] !== String(index)) return refuse("invalid-control-input");
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true ||
            typeof descriptor.value !== "number" || !Number.isInteger(descriptor.value) ||
            descriptor.value < 0 || descriptor.value > 255) {
          return refuse("invalid-control-input");
        }
        copy[index] = descriptor.value;
      }
      return copy;
    } catch {
      return refuse("invalid-control-input");
    }
  }

  let prototype: object | null;
  let keys: Array<string | symbol>;
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return refuse("invalid-control-input");
  }

  if (Array.isArray(value)) {
    if (prototype !== Array.prototype || value.length > MAX_ARRAY_ITEMS) {
      return refuse("invalid-control-input");
    }
    if (keys.some((key) => typeof key !== "string" ||
      (key !== "length" && !/^(?:0|[1-9][0-9]*)$/.test(key)))) {
      return refuse("invalid-control-input");
    }
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      } catch {
        return refuse("invalid-control-input");
      }
      if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
        return refuse("invalid-control-input");
      }
      output.push(snapshotPlain(descriptor.value, state, depth + 1));
    }
    if (keys.length !== value.length + 1) return refuse("invalid-control-input");
    return output;
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return refuse("invalid-control-input");
  }
  if (keys.length > MAX_KEYS || keys.some((key) => typeof key !== "string")) {
    return refuse("invalid-control-input");
  }
  const output: Record<string, unknown> = {};
  for (const key of keys as string[]) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return refuse("invalid-control-input");
    }
    if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
      return refuse("invalid-control-input");
    }
    output[key] = snapshotPlain(descriptor.value, state, depth + 1);
  }
  return output;
}

const snapshot = (value: unknown): unknown =>
  snapshotPlain(value, { seen: new WeakSet<object>(), nodes: 0 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactRecord = <K extends string>(
  value: unknown,
  keys: readonly K[],
): Record<K, unknown> => {
  if (!isRecord(value)) return refuse("invalid-control-input");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) return refuse("invalid-control-input");
  return value as Record<K, unknown>;
};

const boundedIdentifier = (value: unknown, maximum = 128): string => {
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    return refuse("invalid-control-input");
  }
  if (value.trim() !== value || !/^[A-Za-z0-9](?:[A-Za-z0-9._:/-]{0,254}[A-Za-z0-9])?$/.test(value)) {
    return refuse("invalid-control-input");
  }
  return value;
};

const wholeNumber = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): number => {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    return refuse("invalid-control-input");
  }
  return value as number;
};

const positive = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): number => {
  const result = wholeNumber(value, maximum);
  if (result === 0) return refuse("invalid-control-input");
  return result;
};

const DAY = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const MINUTE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\dZ$/;

const day = (value: unknown): string => {
  if (typeof value !== "string" || !DAY.test(value)) return refuse("invalid-control-input");
  return value;
};

const minute = (value: unknown, expectedDay: string): string => {
  if (typeof value !== "string" || !MINUTE.test(value) || !value.startsWith(`${expectedDay}T`)) {
    return refuse("invalid-control-input");
  }
  return value;
};

const hashScope = (kind: "user" | "session" | "project", value: string): string =>
  `0x${createHash("sha256").update(`aura-or02:${kind}\0${value}`, "utf8").digest("hex")}`;

const parsePolicy = (value: unknown): OpenRouterControlPolicy => {
  const record = exactRecord(value, [
    "ruleId",
    "liveExecutionEnabled",
    "perUserRequestsPerMinute",
    "perSessionRequestsPerMinute",
    "perProjectRequestsPerMinute",
    "globalDailyProviderCostMicros",
    "maxProviderCostMicrosPerRequest",
    "maxConcurrent",
    "maxInputBytes",
    "maxOutputBytes",
    "contentRetention",
    "auditRetentionDays",
  ] as const);
  if (typeof record.liveExecutionEnabled !== "boolean" || record.contentRetention !== "none") {
    return refuse("invalid-control-input");
  }
  return {
    ruleId: boundedIdentifier(record.ruleId),
    liveExecutionEnabled: record.liveExecutionEnabled,
    perUserRequestsPerMinute: positive(record.perUserRequestsPerMinute, 100_000),
    perSessionRequestsPerMinute: positive(record.perSessionRequestsPerMinute, 100_000),
    perProjectRequestsPerMinute: positive(record.perProjectRequestsPerMinute, 100_000),
    globalDailyProviderCostMicros: positive(record.globalDailyProviderCostMicros),
    maxProviderCostMicrosPerRequest: positive(record.maxProviderCostMicrosPerRequest),
    maxConcurrent: positive(record.maxConcurrent, 100_000),
    maxInputBytes: positive(record.maxInputBytes, 64 * 1024 * 1024),
    maxOutputBytes: positive(record.maxOutputBytes, 16 * 1024 * 1024),
    contentRetention: "none",
    auditRetentionDays: positive(record.auditRetentionDays, 365),
  };
};

interface ParsedInput {
  policy: OpenRouterControlPolicy;
  scope: OpenRouterExecutionScope;
  scopeHashes: { userHash: string; sessionHash: string; projectHash: string };
  window: OpenRouterExecutionWindow;
  request: DesignIntentTaskRequest;
  inputBytes: number;
  estimatedProviderCostMicros: number;
  declaredMaxOutputBytes: number;
}

const parseInput = (value: unknown): ParsedInput => {
  const root = exactRecord(snapshot(value), [
    "policy",
    "scope",
    "window",
    "request",
    "estimatedProviderCostMicros",
    "declaredMaxOutputBytes",
  ] as const);
  const policy = parsePolicy(root.policy);
  const scopeValue = exactRecord(root.scope, ["userId", "sessionId", "projectId"] as const);
  const scope = {
    userId: boundedIdentifier(scopeValue.userId),
    sessionId: boundedIdentifier(scopeValue.sessionId),
    projectId: boundedIdentifier(scopeValue.projectId),
  };
  const windowValue = exactRecord(root.window, ["day", "minute"] as const);
  const windowDay = day(windowValue.day);
  const window = { day: windowDay, minute: minute(windowValue.minute, windowDay) };
  const request = exactRecord(root.request, [
    "version", "task", "requestId", "timeoutMs", "image",
  ] as const);
  const requestId = boundedIdentifier(request.requestId);
  const image = exactRecord(request.image, ["intake", "bytes", "sourceFingerprint"] as const);
  let bytes: Uint8Array;
  try {
    if (!(image.bytes instanceof Uint8Array)) return refuse("invalid-control-input");
    bytes = image.bytes;
  } catch {
    return refuse("invalid-control-input");
  }
  const estimatedProviderCostMicros = wholeNumber(
    root.estimatedProviderCostMicros,
    policy.maxProviderCostMicrosPerRequest,
  );
  const declaredMaxOutputBytes = positive(root.declaredMaxOutputBytes, 16 * 1024 * 1024);
  if (bytes.byteLength > policy.maxInputBytes) return refuse("input-too-large");
  if (declaredMaxOutputBytes > policy.maxOutputBytes) return refuse("output-too-large");
  return {
    policy,
    scope,
    scopeHashes: {
      userHash: hashScope("user", scope.userId),
      sessionHash: hashScope("session", scope.sessionId),
      projectHash: hashScope("project", scope.projectId),
    },
    window,
    request: { ...request, requestId } as unknown as DesignIntentTaskRequest,
    inputBytes: bytes.byteLength,
    estimatedProviderCostMicros,
    declaredMaxOutputBytes,
  };
};

const HASH = /^0x[a-f0-9]{64}$/;

const parseReservation = (value: unknown): OpenRouterControlReservation => {
  const record = exactRecord(value, [
    "id", "requestId", "day", "userHash", "sessionHash", "projectHash",
    "reservedProviderCostMicros",
  ] as const);
  for (const key of ["userHash", "sessionHash", "projectHash"] as const) {
    if (typeof record[key] !== "string" || !HASH.test(record[key])) return refuse("control-store-failed");
  }
  return {
    id: boundedIdentifier(record.id, 200),
    requestId: boundedIdentifier(record.requestId),
    day: day(record.day),
    userHash: record.userHash as string,
    sessionHash: record.sessionHash as string,
    projectHash: record.projectHash as string,
    reservedProviderCostMicros: wholeNumber(record.reservedProviderCostMicros),
  };
};

const parseCount = (value: unknown): OpenRouterControlRequestCount => {
  const record = exactRecord(value, [
    "requestId", "minute", "userHash", "sessionHash", "projectHash",
  ] as const);
  for (const key of ["userHash", "sessionHash", "projectHash"] as const) {
    if (typeof record[key] !== "string" || !HASH.test(record[key])) return refuse("control-store-failed");
  }
  if (typeof record.minute !== "string" || !MINUTE.test(record.minute)) {
    return refuse("control-store-failed");
  }
  return {
    requestId: boundedIdentifier(record.requestId),
    minute: record.minute,
    userHash: record.userHash as string,
    sessionHash: record.sessionHash as string,
    projectHash: record.projectHash as string,
  };
};

const parseState = (value: unknown): OpenRouterControlState => {
  let safe: unknown;
  try {
    safe = snapshot(value);
  } catch {
    return refuse("control-store-failed");
  }
  let record: Record<string, unknown>;
  try {
    record = exactRecord(safe, [
      "version", "day", "committedProviderCostMicros", "reservations", "requests",
    ] as const);
  } catch {
    return refuse("control-store-failed");
  }
  if (record.version !== OPENROUTER_CONTROL_STATE_VERSION ||
      !Array.isArray(record.reservations) || !Array.isArray(record.requests) ||
      record.reservations.length > 10_000 || record.requests.length > 20_000) {
    return refuse("control-store-failed");
  }
  try {
    const reservations = record.reservations.map(parseReservation);
    const requests = record.requests.map(parseCount);
    const reservationIds = reservations.map((item) => item.id);
    if (new Set(reservationIds).size !== reservationIds.length) return refuse("control-store-failed");
    return {
      version: OPENROUTER_CONTROL_STATE_VERSION,
      day: day(record.day),
      committedProviderCostMicros: wholeNumber(record.committedProviderCostMicros),
      reservations,
      requests,
    };
  } catch {
    return refuse("control-store-failed");
  }
};

const inspectCallableRecord = <K extends string>(
  value: unknown,
  keys: readonly K[],
): Record<K, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return refuse("invalid-control-input");
  }
  let prototype: object | null;
  let ownKeys: Array<string | symbol>;
  try {
    prototype = Object.getPrototypeOf(value);
    ownKeys = Reflect.ownKeys(value);
  } catch {
    return refuse("invalid-control-input");
  }
  if (prototype !== Object.prototype && prototype !== null) return refuse("invalid-control-input");
  if (ownKeys.some((key) => typeof key !== "string") ||
      JSON.stringify((ownKeys as string[]).sort()) !== JSON.stringify([...keys].sort())) {
    return refuse("invalid-control-input");
  }
  const result = {} as Record<K, unknown>;
  for (const key of keys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return refuse("invalid-control-input");
    }
    if (!descriptor || !Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
      return refuse("invalid-control-input");
    }
    result[key] = descriptor.value;
  }
  return result;
};

interface ParsedDependencies {
  storeObject: object;
  transact: OpenRouterAtomicControlStore["transact"];
  read: OpenRouterAtomicControlStore["read"];
  hostedAdapter: DesignIntentAdapter;
  fallbackAdapter: DesignIntentAdapter;
}

const parseDependencies = (value: unknown): ParsedDependencies => {
  const dependencies = inspectCallableRecord(value, [
    "store", "hostedAdapter", "fallbackAdapter",
  ] as const);
  const store = inspectCallableRecord(dependencies.store, ["transact", "read"] as const);
  if (typeof store.transact !== "function" || typeof store.read !== "function") {
    return refuse("invalid-control-input");
  }
  return {
    storeObject: dependencies.store as object,
    transact: store.transact as OpenRouterAtomicControlStore["transact"],
    read: store.read as OpenRouterAtomicControlStore["read"],
    hostedAdapter: dependencies.hostedAdapter as DesignIntentAdapter,
    fallbackAdapter: dependencies.fallbackAdapter as DesignIntentAdapter,
  };
};

const counters = (
  state: OpenRouterControlState,
  parsed: ParsedInput,
): OpenRouterControlCounters => {
  const current = state.requests.filter((item) => item.minute === parsed.window.minute);
  return {
    userMinuteRequests: current.filter((item) => item.userHash === parsed.scopeHashes.userHash).length,
    sessionMinuteRequests: current.filter((item) => item.sessionHash === parsed.scopeHashes.sessionHash).length,
    projectMinuteRequests: current.filter((item) => item.projectHash === parsed.scopeHashes.projectHash).length,
    activeReservations: state.reservations.length,
    committedProviderCostMicros: state.committedProviderCostMicros,
    reservedProviderCostMicros: state.reservations
      .filter((item) => item.day === parsed.window.day)
      .reduce((total, item) => total + item.reservedProviderCostMicros, 0),
  };
};

const normalizedForWindow = (
  state: OpenRouterControlState,
  parsed: ParsedInput,
): OpenRouterControlState => {
  if (parsed.window.day < state.day) return refuse("accounting-failed");
  const changedDay = parsed.window.day !== state.day;
  return {
    version: OPENROUTER_CONTROL_STATE_VERSION,
    day: parsed.window.day,
    committedProviderCostMicros: changedDay ? 0 : state.committedProviderCostMicros,
    reservations: [...state.reservations],
    requests: state.requests.filter((item) => item.minute === parsed.window.minute),
  };
};

interface ReservationDecision {
  kind: "hosted" | "fallback";
  reason: OpenRouterControlReason;
  reservationId: string | null;
  counters: OpenRouterControlCounters;
}

const fallbackDecision = (
  state: OpenRouterControlState,
  parsed: ParsedInput,
  reason: OpenRouterControlReason,
): ReservationDecision => ({
  kind: "fallback",
  reason,
  reservationId: null,
  counters: counters(state, parsed),
});

const reservationId = (parsed: ParsedInput): string =>
  `reservation-${createHash("sha256")
    .update(`${parsed.window.day}\0${parsed.window.minute}\0${parsed.request.requestId}\0${parsed.scopeHashes.userHash}\0${parsed.scopeHashes.sessionHash}\0${parsed.scopeHashes.projectHash}`, "utf8")
    .digest("hex")}`;

const reserve = (
  stateValue: OpenRouterControlState,
  parsed: ParsedInput,
): OpenRouterStoreOperationResult => {
  const state = normalizedForWindow(parseState(stateValue), parsed);
  const current = counters(state, parsed);
  if (!parsed.policy.liveExecutionEnabled) {
    return { state, value: fallbackDecision(state, parsed, "kill-switch") };
  }
  if (current.userMinuteRequests >= parsed.policy.perUserRequestsPerMinute) {
    return { state, value: fallbackDecision(state, parsed, "user-rate-limit") };
  }
  if (current.sessionMinuteRequests >= parsed.policy.perSessionRequestsPerMinute) {
    return { state, value: fallbackDecision(state, parsed, "session-rate-limit") };
  }
  if (current.projectMinuteRequests >= parsed.policy.perProjectRequestsPerMinute) {
    return { state, value: fallbackDecision(state, parsed, "project-rate-limit") };
  }
  if (state.committedProviderCostMicros + current.reservedProviderCostMicros +
      parsed.estimatedProviderCostMicros > parsed.policy.globalDailyProviderCostMicros) {
    return { state, value: fallbackDecision(state, parsed, "daily-spend-limit") };
  }
  if (state.reservations.length >= parsed.policy.maxConcurrent) {
    return { state, value: fallbackDecision(state, parsed, "concurrency-limit") };
  }
  const id = reservationId(parsed);
  if (state.reservations.some((item) => item.id === id) ||
      state.requests.some((item) => item.requestId === parsed.request.requestId)) {
    return refuse("accounting-failed");
  }
  const next: OpenRouterControlState = {
    ...state,
    reservations: [...state.reservations, {
      id,
      requestId: parsed.request.requestId,
      day: parsed.window.day,
      ...parsed.scopeHashes,
      reservedProviderCostMicros: parsed.estimatedProviderCostMicros,
    }],
    requests: [...state.requests, {
      requestId: parsed.request.requestId,
      minute: parsed.window.minute,
      ...parsed.scopeHashes,
    }],
  };
  return {
    state: next,
    value: {
      kind: "hosted",
      reason: "hosted-authorized",
      reservationId: id,
      counters: counters(next, parsed),
    } satisfies ReservationDecision,
  };
};

const parseCounters = (value: unknown): OpenRouterControlCounters => {
  const record = exactRecord(value, [
    "userMinuteRequests", "sessionMinuteRequests", "projectMinuteRequests",
    "activeReservations", "committedProviderCostMicros", "reservedProviderCostMicros",
  ] as const);
  return {
    userMinuteRequests: wholeNumber(record.userMinuteRequests),
    sessionMinuteRequests: wholeNumber(record.sessionMinuteRequests),
    projectMinuteRequests: wholeNumber(record.projectMinuteRequests),
    activeReservations: wholeNumber(record.activeReservations),
    committedProviderCostMicros: wholeNumber(record.committedProviderCostMicros),
    reservedProviderCostMicros: wholeNumber(record.reservedProviderCostMicros),
  };
};

const parseDecision = (value: unknown): ReservationDecision => {
  let safe: unknown;
  try {
    safe = snapshot(value);
  } catch {
    return refuse("control-store-failed");
  }
  let record: Record<string, unknown>;
  try {
    record = exactRecord(safe, ["kind", "reason", "reservationId", "counters"] as const);
  } catch {
    return refuse("control-store-failed");
  }
  const reasons = new Set<OpenRouterControlReason>([
    "hosted-authorized", "kill-switch", "user-rate-limit", "session-rate-limit",
    "project-rate-limit", "daily-spend-limit", "concurrency-limit",
  ]);
  if ((record.kind !== "hosted" && record.kind !== "fallback") ||
      !reasons.has(record.reason as OpenRouterControlReason)) {
    return refuse("control-store-failed");
  }
  if (record.kind === "hosted") {
    if (record.reason !== "hosted-authorized") return refuse("control-store-failed");
    boundedIdentifier(record.reservationId, 200);
  } else if (record.reservationId !== null || record.reason === "hosted-authorized") {
    return refuse("control-store-failed");
  }
  return {
    kind: record.kind,
    reason: record.reason as OpenRouterControlReason,
    reservationId: record.reservationId as string | null,
    counters: parseCounters(record.counters),
  };
};

const transact = async (
  dependencies: ParsedDependencies,
  operation: OpenRouterStoreOperation,
): Promise<OpenRouterStoreOperationResult> => {
  let raw: unknown;
  try {
    raw = await dependencies.transact.call(dependencies.storeObject, operation);
  } catch (error) {
    if (error instanceof OpenRouterControlError) throw error;
    return refuse("control-store-failed");
  }
  try {
    const receipt = exactRecord(snapshot(raw), ["state", "value"] as const);
    const returnedState = parseState(receipt.state);
    const committedState = await readCommittedState(dependencies);
    if (JSON.stringify(committedState) !== JSON.stringify(returnedState)) {
      return refuse("control-store-failed");
    }
    return { state: committedState, value: receipt.value };
  } catch {
    return refuse("control-store-failed");
  }
};

const readCommittedState = async (
  dependencies: ParsedDependencies,
): Promise<OpenRouterControlState> => {
  let raw: unknown;
  try {
    raw = await dependencies.read.call(dependencies.storeObject);
  } catch {
    return refuse("control-store-failed");
  }
  return parseState(raw);
};

const sameCounters = (
  left: OpenRouterControlCounters,
  right: OpenRouterControlCounters,
): boolean => JSON.stringify(left) === JSON.stringify(right);

const retainedReservationCounters = async (
  parsed: ParsedInput,
  dependencies: ParsedDependencies,
  id: string,
): Promise<OpenRouterControlCounters> => {
  const state = await readCommittedState(dependencies);
  const matches = state.reservations.filter((item) =>
    item.id === id &&
    item.id === reservationId(parsed) &&
    item.requestId === parsed.request.requestId &&
    item.day === parsed.window.day &&
    item.userHash === parsed.scopeHashes.userHash &&
    item.sessionHash === parsed.scopeHashes.sessionHash &&
    item.projectHash === parsed.scopeHashes.projectHash &&
    item.reservedProviderCostMicros === parsed.estimatedProviderCostMicros);
  if (matches.length !== 1) {
    return refuse("control-store-failed");
  }
  return counters(state, parsed);
};

const settle = async (
  parsed: ParsedInput,
  dependencies: ParsedDependencies,
  id: string,
  actualProviderCostMicros: number,
): Promise<OpenRouterControlCounters> => {
  const receipt = await transact(dependencies, (stateValue) => {
    const state = parseState(stateValue);
    const matches = state.reservations.filter((item) => item.id === id);
    if (matches.length !== 1) return refuse("accounting-failed");
    const reservation = matches[0];
    const exactCommittedCostMicros = state.committedProviderCostMicros + actualProviderCostMicros;
    const canCommitExactly = Number.isSafeInteger(exactCommittedCostMicros);
    const next: OpenRouterControlState = {
      ...state,
      committedProviderCostMicros: state.day === reservation.day && canCommitExactly
        ? exactCommittedCostMicros
        : state.committedProviderCostMicros,
      reservations: state.day === reservation.day && canCommitExactly
        ? state.reservations.filter((item) => item.id !== id)
        : state.reservations.map((item) => item.id === id
          ? { ...item, reservedProviderCostMicros: actualProviderCostMicros }
          : item),
    };
    return { state: next, value: counters(next, parsed) };
  });
  try {
    const parsedCounters = parseCounters(snapshot(receipt.value));
    if (receipt.state.reservations.some((item) => item.id === id) ||
        !sameCounters(parsedCounters, counters(receipt.state, parsed))) {
      return refuse("control-store-failed");
    }
    return parsedCounters;
  } catch {
    return refuse("control-store-failed");
  }
};

const responseBytes = (response: DesignIntentTaskResponse): number => {
  let serialized: string;
  try {
    serialized = JSON.stringify(response);
  } catch {
    return refuse("execution-failed");
  }
  return new TextEncoder().encode(serialized).byteLength;
};

const runFake = async (
  parsed: ParsedInput,
  dependencies: ParsedDependencies,
): Promise<{ response: DesignIntentTaskResponse; outputBytes: number }> => {
  let response: DesignIntentTaskResponse;
  try {
    response = await runDesignIntentTask(parsed.request, dependencies.fallbackAdapter);
  } catch {
    return refuse("fake-failed");
  }
  if (response.adapter.kind !== "deterministic-fake" || response.receipt.providerCostMicros !== 0) {
    return refuse("fake-failed");
  }
  const outputBytes = responseBytes(response);
  if (outputBytes > parsed.declaredMaxOutputBytes || outputBytes > parsed.policy.maxOutputBytes) {
    return refuse("output-too-large");
  }
  return { response, outputBytes };
};

const audit = (
  parsed: ParsedInput,
  route: OpenRouterControlRoute,
  reason: OpenRouterControlReason,
  outputBytes: number,
  actualProviderCostMicros: number,
  controlCounters: OpenRouterControlCounters,
): OpenRouterExecutionAuditReceipt => ({
  format: "aura-hosted-execution-audit",
  version: 1,
  controlsVersion: OPENROUTER_EXECUTION_CONTROLS_VERSION,
  ruleId: parsed.policy.ruleId,
  requestId: parsed.request.requestId,
  day: parsed.window.day,
  minute: parsed.window.minute,
  route,
  reason,
  scope: { ...parsed.scopeHashes },
  inputBytes: parsed.inputBytes,
  outputBytes,
  estimatedProviderCostMicros: parsed.estimatedProviderCostMicros,
  actualProviderCostMicros,
  contentRetention: "none",
  auditRetentionDays: parsed.policy.auditRetentionDays,
  counters: controlCounters,
});

const fallbackResult = async (
  parsed: ParsedInput,
  dependencies: ParsedDependencies,
  reason: OpenRouterControlReason,
  controlCounters: OpenRouterControlCounters,
): Promise<OpenRouterControlledExecutionResult> => {
  const fallback = await runFake(parsed, dependencies);
  return deepFreeze({
    route: "deterministic-fake" as const,
    response: fallback.response,
    audit: audit(parsed, "deterministic-fake", reason, fallback.outputBytes, 0, controlCounters),
  });
};

export async function runControlledDesignIntentTask(
  inputValue: OpenRouterControlRequest,
  dependenciesValue: OpenRouterControlDependencies,
): Promise<OpenRouterControlledExecutionResult> {
  let parsed: ParsedInput;
  let dependencies: ParsedDependencies;
  try {
    parsed = parseInput(inputValue);
    dependencies = parseDependencies(dependenciesValue);
  } catch (error) {
    if (error instanceof OpenRouterControlError) throw error;
    return refuse("invalid-control-input");
  }

  const reservationReceipt = await transact(
    dependencies,
    (state) => reserve(state, parsed),
  );
  const decision = parseDecision(reservationReceipt.value);
  if (decision.kind === "fallback") {
    if (!sameCounters(decision.counters, counters(reservationReceipt.state, parsed))) {
      return refuse("control-store-failed");
    }
    return fallbackResult(parsed, dependencies, decision.reason, decision.counters);
  }

  const id = decision.reservationId as string;
  const expectedReservationId = reservationId(parsed);
  const matchingReservations = reservationReceipt.state.reservations.filter((item) =>
    item.id === id &&
    item.id === expectedReservationId &&
    item.requestId === parsed.request.requestId &&
    item.day === parsed.window.day &&
    item.userHash === parsed.scopeHashes.userHash &&
    item.sessionHash === parsed.scopeHashes.sessionHash &&
    item.projectHash === parsed.scopeHashes.projectHash &&
    item.reservedProviderCostMicros === parsed.estimatedProviderCostMicros);
  const matchingRequests = reservationReceipt.state.requests.filter((item) =>
    item.requestId === parsed.request.requestId &&
    item.minute === parsed.window.minute &&
    item.userHash === parsed.scopeHashes.userHash &&
    item.sessionHash === parsed.scopeHashes.sessionHash &&
    item.projectHash === parsed.scopeHashes.projectHash);
  if (matchingReservations.length !== 1 || matchingRequests.length !== 1 ||
      !sameCounters(decision.counters, counters(reservationReceipt.state, parsed))) {
    return refuse("control-store-failed");
  }
  let response: DesignIntentTaskResponse;
  try {
    response = await runDesignIntentTask(parsed.request, dependencies.hostedAdapter);
  } catch (error) {
    const retained = await retainedReservationCounters(parsed, dependencies, id);
    if (error instanceof DesignIntentTaskError) {
      const reasonByCode: Partial<Record<string, OpenRouterControlReason>> = {
        unavailable: "hosted-unavailable",
        "rate-limited": "hosted-rate-limited",
        "payment-required": "hosted-payment-required",
        timeout: "hosted-timeout",
      };
      const reason = reasonByCode[error.code];
      if (reason) return fallbackResult(parsed, dependencies, reason, retained);
    }
    return refuse("execution-failed");
  }

  if (response.adapter.kind !== "hosted") {
    await retainedReservationCounters(parsed, dependencies, id);
    return refuse("execution-failed");
  }
  const actualProviderCostMicros = response.receipt.providerCostMicros;
  if (!Number.isSafeInteger(actualProviderCostMicros) || actualProviderCostMicros < 0) {
    await retainedReservationCounters(parsed, dependencies, id);
    return refuse("accounting-failed");
  }
  if (actualProviderCostMicros > parsed.estimatedProviderCostMicros) {
    await settle(parsed, dependencies, id, actualProviderCostMicros);
    return refuse("accounting-failed");
  }
  const outputBytes = responseBytes(response);
  if (outputBytes > parsed.declaredMaxOutputBytes || outputBytes > parsed.policy.maxOutputBytes) {
    await settle(parsed, dependencies, id, actualProviderCostMicros);
    return refuse("output-too-large");
  }
  const settled = await settle(
    parsed,
    dependencies,
    id,
    actualProviderCostMicros,
  );
  return deepFreeze({
    route: "hosted" as const,
    response,
    audit: audit(
      parsed,
      "hosted",
      "hosted-authorized",
      outputBytes,
      actualProviderCostMicros,
      settled,
    ),
  });
}
