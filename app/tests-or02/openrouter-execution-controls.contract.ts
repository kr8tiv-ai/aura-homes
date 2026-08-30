import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "playwright/test";

import { DESIGN_INTENT_FIELDS, DESIGN_INTENT_VERSION } from "@/lib/ai/designIntent";
import {
  DESIGN_INTENT_ADAPTER_VERSION,
  DesignIntentAdapterFailure,
  createDeterministicDesignIntentFake,
  type DesignIntentAdapter,
  type DesignIntentTaskRequest,
  type RawDesignIntentAdapterResponse,
} from "@/lib/ai/designIntentAdapter";
import {
  OPENROUTER_EXECUTION_CONTROLS_VERSION,
  OpenRouterControlError,
  runControlledDesignIntentTask,
  type OpenRouterAtomicControlStore,
  type OpenRouterControlDependencies,
  type OpenRouterControlPolicy,
  type OpenRouterControlState,
  type OpenRouterStoreOperation,
} from "@/lib/ai/openRouterExecutionControls";
import { IMAGE_INTAKE_VERSION } from "@/lib/ai/imageIntake";

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
  materials: { preferences: ["timber", "glass", "metal-roof"], notes: null },
  climate: { country: "CA", region: "Alberta", profile: "cold-continental" },
  siting: {
    orientationPreference: "south",
    slope: "gentle",
    access: "road",
    viewPriorities: ["west"],
  },
  assumptions: [{
    id: "assumption-view",
    field: "siting",
    statement: "The photographed view is assumed to face west until confirmed.",
    sourceIds: ["image-1"],
  }],
  unresolved: [{
    id: "unresolved-site",
    field: "siting",
    question: "What is the surveyed site orientation?",
  }],
  confidence: DESIGN_INTENT_FIELDS.map((field) => ({
    field,
    level: field === "siting" ? "weak-inference" : "explicit",
    sourceIds: ["image-1"],
  })),
  sources: [{
    id: "image-1",
    kind: "uploaded-image",
    fingerprint: sourceFingerprint,
    label: "Owner-provided cabin reference",
  }],
});

const taskRequest = (requestId = "request-1"): DesignIntentTaskRequest => ({
  version: DESIGN_INTENT_ADAPTER_VERSION,
  task: "image-to-design-intent",
  requestId,
  timeoutMs: 1_000,
  image: {
    intake: {
      version: IMAGE_INTAKE_VERSION,
      name: "private-cabin.jpg",
      mimeType: "image/jpeg",
      declaredMimeType: "image/jpeg",
      encodedBytes: 4,
      width: 100,
      height: 80,
      displayWidth: 100,
      displayHeight: 80,
      pixels: 8_000,
      orientation: 1,
      orientationTransform: "none",
      consentToAnalyze: true,
      rights: "i-own-this-image",
      retention: "delete-after-analysis",
      rawImageDisposition: "delete when the analysis task finishes or fails",
    },
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    sourceFingerprint,
  },
});

const rawResponse = (providerCostMicros = 1_250): RawDesignIntentAdapterResponse => ({
  intent: completeIntent(),
  receipt: {
    currency: "USD",
    providerCostMicros,
    inputTokens: 320,
    outputTokens: 180,
    modelId: "vendor/vision-model-1",
    providerRequestId: "generation-1",
  },
});

const hosted = (
  run: DesignIntentAdapter["run"] = async () => rawResponse(),
): DesignIntentAdapter => ({
  id: "hosted-shaped-test-adapter",
  version: "hosted-shaped/v1",
  kind: "hosted",
  run,
});

const fake = () => createDeterministicDesignIntentFake({
  id: "local-safe-fallback",
  version: "fixture/v1",
  intent: completeIntent(),
  receipt: {
    currency: "USD",
    providerCostMicros: 0,
    inputTokens: null,
    outputTokens: null,
    modelId: "deterministic-fixture",
    providerRequestId: null,
  },
});

const policy = (overrides: Partial<OpenRouterControlPolicy> = {}): OpenRouterControlPolicy => ({
  ruleId: "or02-default-v1",
  liveExecutionEnabled: true,
  perUserRequestsPerMinute: 3,
  perSessionRequestsPerMinute: 3,
  perProjectRequestsPerMinute: 3,
  globalDailyProviderCostMicros: 10_000,
  maxProviderCostMicrosPerRequest: 2_000,
  maxConcurrent: 2,
  maxInputBytes: 1_000,
  maxOutputBytes: 100_000,
  contentRetention: "none",
  auditRetentionDays: 30,
  ...overrides,
});

const input = (
  requestId = "request-1",
  policyOverrides: Partial<OpenRouterControlPolicy> = {},
) => ({
  policy: policy(policyOverrides),
  scope: {
    userId: "opaque-user-1",
    sessionId: "opaque-session-1",
    projectId: "opaque-project-1",
  },
  window: { day: "2026-08-29", minute: "2026-08-29T12:34Z" },
  request: taskRequest(requestId),
  estimatedProviderCostMicros: 1_250,
  declaredMaxOutputBytes: 100_000,
});

const emptyState = (): OpenRouterControlState => ({
  version: 1,
  day: "2026-08-29",
  committedProviderCostMicros: 0,
  reservations: [],
  requests: [],
});

const atomicStore = (initial: OpenRouterControlState = emptyState()) => {
  let state = structuredClone(initial);
  let transactions = 0;
  let reads = 0;
  const store: OpenRouterAtomicControlStore = {
    async transact(operation: OpenRouterStoreOperation) {
      transactions += 1;
      const result = operation(structuredClone(state));
      state = structuredClone(result.state);
      return structuredClone(result);
    },
    async read() {
      reads += 1;
      return structuredClone(state);
    },
  };
  return {
    store,
    snapshot: () => structuredClone(state),
    transactions: () => transactions,
    reads: () => reads,
  };
};

const expectControlError = async (promise: Promise<unknown>, code: string) => {
  try {
    await promise;
    throw new Error("Expected OR02 to refuse the task.");
  } catch (error) {
    expect(error).toBeInstanceOf(OpenRouterControlError);
    expect(error).toMatchObject({ code });
    return error as OpenRouterControlError;
  }
};

test("one authorized hosted task reserves atomically, settles exact cost, and emits only redacted audit facts", async () => {
  const state = atomicStore();
  const result = await runControlledDesignIntentTask(input(), {
    store: state.store,
    hostedAdapter: hosted(),
    fallbackAdapter: fake(),
  });

  expect(OPENROUTER_EXECUTION_CONTROLS_VERSION).toBe("aura-openrouter-execution-controls/v1");
  expect(result.route).toBe("hosted");
  expect(result.response.receipt.providerCostMicros).toBe(1_250);
  expect(result.audit).toMatchObject({
    route: "hosted",
    reason: "hosted-authorized",
    estimatedProviderCostMicros: 1_250,
    actualProviderCostMicros: 1_250,
    contentRetention: "none",
    auditRetentionDays: 30,
  });
  expect(result.audit.scope.userHash).toMatch(/^0x[a-f0-9]{64}$/);
  expect(state.snapshot()).toMatchObject({
    committedProviderCostMicros: 1_250,
    reservations: [],
  });
  expect(state.snapshot().requests).toHaveLength(1);
  expect(state.transactions()).toBe(2);
  const auditText = JSON.stringify(result.audit);
  expect(auditText).not.toContain("opaque-user-1");
  expect(auditText).not.toContain("opaque-session-1");
  expect(auditText).not.toContain("opaque-project-1");
  expect(auditText).not.toContain("private-cabin.jpg");
  expect(auditText).not.toContain("Owner-provided cabin reference");
  expect(auditText).not.toContain(sourceFingerprint);
});

test("kill switch, rate, spend, and concurrency gates choose the fake before hosted execution", async () => {
  const cases: Array<{
    name: string;
    policy?: Partial<OpenRouterControlPolicy>;
    prepare?: (state: ReturnType<typeof atomicStore>) => Promise<void>;
    reason: string;
  }> = [
    { name: "kill", policy: { liveExecutionEnabled: false }, reason: "kill-switch" },
    {
      name: "rate",
      policy: { perUserRequestsPerMinute: 1 },
      prepare: async (state) => {
        await runControlledDesignIntentTask(input("rate-first", { perUserRequestsPerMinute: 1 }), {
          store: state.store,
          hostedAdapter: hosted(),
          fallbackAdapter: fake(),
        });
      },
      reason: "user-rate-limit",
    },
    {
      name: "spend",
      policy: { globalDailyProviderCostMicros: 2_000 },
      prepare: async (state) => {
        await runControlledDesignIntentTask(input("spend-first", { globalDailyProviderCostMicros: 2_000 }), {
          store: state.store,
          hostedAdapter: hosted(),
          fallbackAdapter: fake(),
        });
      },
      reason: "daily-spend-limit",
    },
  ];

  for (const item of cases) {
    const state = atomicStore();
    if (item.prepare) await item.prepare(state);
    let hostedCalls = 0;
    const result = await runControlledDesignIntentTask(input(`${item.name}-blocked`, item.policy), {
      store: state.store,
      hostedAdapter: hosted(async () => { hostedCalls += 1; return rawResponse(); }),
      fallbackAdapter: fake(),
    });
    expect(result).toMatchObject({ route: "deterministic-fake", audit: { reason: item.reason } });
    expect(result.response.receipt.providerCostMicros).toBe(0);
    expect(hostedCalls).toBe(0);
  }

  const state = atomicStore();
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const first = runControlledDesignIntentTask(input("concurrent-first", { maxConcurrent: 1 }), {
    store: state.store,
    hostedAdapter: hosted(async () => { await firstGate; return rawResponse(); }),
    fallbackAdapter: fake(),
  });
  await expect.poll(() => state.snapshot().reservations.length).toBe(1);
  let secondHostedCalls = 0;
  const second = await runControlledDesignIntentTask(input("concurrent-second", { maxConcurrent: 1 }), {
    store: state.store,
    hostedAdapter: hosted(async () => { secondHostedCalls += 1; return rawResponse(); }),
    fallbackAdapter: fake(),
  });
  expect(second).toMatchObject({ route: "deterministic-fake", audit: { reason: "concurrency-limit" } });
  expect(secondHostedCalls).toBe(0);
  releaseFirst();
  await first;
});

test("session and project minute limits are independent of the user limit", async () => {
  for (const dimension of ["session", "project"] as const) {
    const state = atomicStore();
    const limits = dimension === "session"
      ? { perSessionRequestsPerMinute: 1 }
      : { perProjectRequestsPerMinute: 1 };
    await runControlledDesignIntentTask(input(`${dimension}-first`, limits), {
      store: state.store,
      hostedAdapter: hosted(),
      fallbackAdapter: fake(),
    });
    const next = input(`${dimension}-second`, limits);
    next.scope.userId = "opaque-user-2";
    if (dimension === "project") next.scope.sessionId = "opaque-session-2";
    const result = await runControlledDesignIntentTask(next, {
      store: state.store,
      hostedAdapter: hosted(),
      fallbackAdapter: fake(),
    });
    expect(result).toMatchObject({
      route: "deterministic-fake",
      audit: { reason: `${dimension}-rate-limit` },
    });
  }
});

test("input and declared output caps refuse before either adapter runs", async () => {
  for (const [change, code] of [
    [(value: ReturnType<typeof input>) => { value.policy.maxInputBytes = 3; }, "input-too-large"],
    [(value: ReturnType<typeof input>) => { value.declaredMaxOutputBytes = 100_001; }, "output-too-large"],
  ] as const) {
    const state = atomicStore();
    let calls = 0;
    const value = input();
    change(value);
    await expectControlError(runControlledDesignIntentTask(value, {
      store: state.store,
      hostedAdapter: hosted(async () => { calls += 1; return rawResponse(); }),
      fallbackAdapter: { ...fake(), run: async () => { calls += 1; return rawResponse(0); } },
    }), code);
    expect(calls).toBe(0);
    expect(state.transactions()).toBe(0);
  }
});

test("temporary hosted failures retain one reconciliation hold and cannot bypass the daily cap", async () => {
  for (const failure of ["unavailable", "rate-limited", "payment-required"] as const) {
    const state = atomicStore();
    let fallbackCalls = 0;
    let hostedCalls = 0;
    const fallback = fake();
    const limits = { globalDailyProviderCostMicros: 2_000 };
    const adapters: OpenRouterControlDependencies = {
      store: state.store,
      hostedAdapter: hosted(async () => {
        hostedCalls += 1;
        throw new DesignIntentAdapterFailure(failure);
      }),
      fallbackAdapter: {
        ...fallback,
        async run(request, context) {
          fallbackCalls += 1;
          return fallback.run(request, context);
        },
      },
    };
    const result = await runControlledDesignIntentTask(input(`failure-${failure}`, limits), adapters);
    expect(result).toMatchObject({
      route: "deterministic-fake",
      audit: {
        reason: `hosted-${failure}`,
        counters: { activeReservations: 1, reservedProviderCostMicros: 2_000 },
      },
    });
    expect(fallbackCalls).toBe(1);
    expect(hostedCalls).toBe(1);
    expect(state.snapshot().reservations).toHaveLength(1);
    expect(state.snapshot().committedProviderCostMicros).toBe(0);
    expect(state.transactions()).toBe(1);

    const blockedRetry = await runControlledDesignIntentTask(input(`failure-${failure}-retry`, limits), adapters);
    expect(blockedRetry).toMatchObject({
      route: "deterministic-fake",
      audit: { reason: "daily-spend-limit" },
    });
    expect(hostedCalls).toBe(1);
    expect(state.snapshot().reservations).toHaveLength(1);
  }
});

test("invalid hosted output and actual cost above reservation fail closed without fake fallback", async () => {
  const state = atomicStore();
  let fallbackCalls = 0;
  const fallback = fake();
  await expectControlError(runControlledDesignIntentTask(input("unsafe-execution-failed"), {
    store: state.store,
    hostedAdapter: hosted(async () => ({
      intent: { geometry: "smuggled" },
      receipt: rawResponse().receipt,
    })),
    fallbackAdapter: {
      ...fallback,
      async run(request, context) {
        fallbackCalls += 1;
        return fallback.run(request, context);
      },
    },
  }), "execution-failed");
  expect(fallbackCalls).toBe(0);
  expect(state.snapshot().reservations).toHaveLength(1);
  expect(state.snapshot().committedProviderCostMicros).toBe(0);
  expect(state.transactions()).toBe(1);
});

test("a verified cost above estimate but within its reserved ceiling settles exactly and blocks another dispatch", async () => {
  const state = atomicStore();
  let hostedCalls = 0;
  const limits = {
    globalDailyProviderCostMicros: 10_000,
    maxProviderCostMicrosPerRequest: 10_000,
    maxConcurrent: 2,
  };
  const dependencies: OpenRouterControlDependencies = {
    store: state.store,
    hostedAdapter: hosted(async () => {
      hostedCalls += 1;
      return rawResponse(9_000);
    }),
    fallbackAdapter: fake(),
  };

  const first = input("known-overage-first", limits);
  first.estimatedProviderCostMicros = 1_000;
  const firstResult = await runControlledDesignIntentTask(first, dependencies);
  expect(firstResult).toMatchObject({
    route: "hosted",
    audit: {
      estimatedProviderCostMicros: 1_000,
      actualProviderCostMicros: 9_000,
    },
  });
  expect(state.snapshot().reservations).toEqual([]);
  expect(state.snapshot().committedProviderCostMicros).toBe(9_000);

  const second = input("known-overage-second", limits);
  second.estimatedProviderCostMicros = 9_000;
  const blocked = await runControlledDesignIntentTask(second, dependencies);
  expect(blocked).toMatchObject({
    route: "deterministic-fake",
    audit: {
      reason: "daily-spend-limit",
      counters: { committedProviderCostMicros: 9_000 },
    },
  });
  expect(hostedCalls).toBe(1);
  expect(state.snapshot().committedProviderCostMicros).toBe(9_000);
});

test("concurrent dispatches reserve the per-request ceiling so verified overages cannot cross the daily cap", async () => {
  const state = atomicStore();
  let hostedCalls = 0;
  const releases: Array<() => void> = [];
  const limits = {
    globalDailyProviderCostMicros: 10_000,
    maxProviderCostMicrosPerRequest: 10_000,
    maxConcurrent: 2,
  };
  const dependencies: OpenRouterControlDependencies = {
    store: state.store,
    hostedAdapter: hosted(async () => {
      hostedCalls += 1;
      return new Promise<RawDesignIntentAdapterResponse>((resolve) => {
        releases.push(() => resolve(rawResponse(9_000)));
      });
    }),
    fallbackAdapter: fake(),
  };

  const firstInput = input("concurrent-overage-first", limits);
  firstInput.estimatedProviderCostMicros = 1_000;
  const first = runControlledDesignIntentTask(firstInput, dependencies);
  await expect.poll(() => hostedCalls).toBe(1);

  const secondInput = input("concurrent-overage-second", limits);
  secondInput.estimatedProviderCostMicros = 1_000;
  const second = runControlledDesignIntentTask(secondInput, dependencies);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const callsBeforeRelease = hostedCalls;
  releases.forEach((release) => release());

  const [firstResult, secondResult] = await Promise.all([first, second]);
  expect(callsBeforeRelease).toBe(1);
  expect(firstResult.route).toBe("hosted");
  expect(secondResult).toMatchObject({
    route: "deterministic-fake",
    audit: { reason: "daily-spend-limit" },
  });
  expect(state.snapshot().committedProviderCostMicros).toBe(9_000);
  expect(state.snapshot().reservations).toEqual([]);
});

test("actual serialized output is bounded after hosted execution and before return", async () => {
  const state = atomicStore();
  const value = input("oversized-output", { maxOutputBytes: 100 });
  value.declaredMaxOutputBytes = 100;
  await expectControlError(runControlledDesignIntentTask(value, {
    store: state.store,
    hostedAdapter: hosted(),
    fallbackAdapter: fake(),
  }), "output-too-large");
  expect(state.snapshot().reservations).toEqual([]);
  expect(state.snapshot().committedProviderCostMicros).toBe(1_250);
});

test("explicit UTC minute and day transitions reset only their declared counters and reject backward replay", async () => {
  const state = atomicStore();
  let hostedCalls = 0;
  const limits = {
    perUserRequestsPerMinute: 1,
    globalDailyProviderCostMicros: 10_000,
    maxProviderCostMicrosPerRequest: 2_000,
  };
  const dependencies: OpenRouterControlDependencies = {
    store: state.store,
    hostedAdapter: hosted(async () => {
      hostedCalls += 1;
      return rawResponse();
    }),
    fallbackAdapter: fake(),
  };
  await runControlledDesignIntentTask(input("bucket-first", limits), {
    ...dependencies,
  });

  const nextMinute = input("bucket-minute", limits);
  nextMinute.window.minute = "2026-08-29T12:35Z";
  const minuteResult = await runControlledDesignIntentTask(nextMinute, dependencies);
  expect(minuteResult.route).toBe("hosted");

  const backwardMinute = input("bucket-backward", limits);
  await expectControlError(
    runControlledDesignIntentTask(backwardMinute, dependencies),
    "accounting-failed",
  );
  expect(hostedCalls).toBe(2);

  const nextDay = input("bucket-day", limits);
  nextDay.window = { day: "2026-08-30", minute: "2026-08-30T00:00Z" };
  const dayResult = await runControlledDesignIntentTask(nextDay, dependencies);
  expect(dayResult.route).toBe("hosted");
  expect(state.snapshot().day).toBe("2026-08-30");
  expect(state.snapshot().committedProviderCostMicros).toBe(1_250);
  expect(state.snapshot().requests.every((item) => item.minute.startsWith("2026-08-30"))).toBe(true);
});

test("bounded current-day history refuses before mutation instead of poisoning durable state", async () => {
  const fullHistory: OpenRouterControlState = {
    ...emptyState(),
    requests: Array.from({ length: 4_000 }, (_, index) => ({
      requestId: `prior-${index}`,
      minute: "2026-08-29T00:00Z",
      userHash: `0x${"1".repeat(64)}`,
      sessionHash: `0x${"2".repeat(64)}`,
      projectHash: `0x${"3".repeat(64)}`,
    })),
  };
  const state = atomicStore(fullHistory);
  let hostedCalls = 0;
  const request = input("history-cap", {
    perUserRequestsPerMinute: 100_000,
    perSessionRequestsPerMinute: 100_000,
    perProjectRequestsPerMinute: 100_000,
    maxConcurrent: 1_000,
  });
  request.window.minute = "2026-08-29T23:59Z";

  await expectControlError(runControlledDesignIntentTask(request, {
    store: state.store,
    hostedAdapter: hosted(async () => { hostedCalls += 1; return rawResponse(); }),
    fallbackAdapter: fake(),
  }), "accounting-failed");

  expect(hostedCalls).toBe(0);
  expect(state.snapshot()).toEqual(fullHistory);
});

test("a UTC-day transition waits for every live reservation and cannot duplicate an in-flight request id", async () => {
  for (const nextRequestId of ["duplicate-id", "different-id"]) {
    const state = atomicStore();
    let hostedCalls = 0;
    let releaseFirst: ((value: RawDesignIntentAdapterResponse) => void) | undefined;
    const adapter = hosted(async () => {
      hostedCalls += 1;
      if (hostedCalls === 1) {
        return new Promise<RawDesignIntentAdapterResponse>((resolve) => { releaseFirst = resolve; });
      }
      return rawResponse(500);
    });
    const firstInput = input("duplicate-id", { maxConcurrent: 2 });
    firstInput.window = { day: "2026-08-29", minute: "2026-08-29T23:59Z" };
    const first = runControlledDesignIntentTask(firstInput, {
      store: state.store,
      hostedAdapter: adapter,
      fallbackAdapter: fake(),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hostedCalls).toBe(1);

    const nextInput = input(nextRequestId, { maxConcurrent: 2 });
    nextInput.window = { day: "2026-08-30", minute: "2026-08-30T00:00Z" };
    const nextOutcome = await runControlledDesignIntentTask(nextInput, {
      store: state.store,
      hostedAdapter: adapter,
      fallbackAdapter: fake(),
    }).then(
      (value) => ({ value, error: null }),
      (error: unknown) => ({ value: null, error }),
    );

    releaseFirst?.(rawResponse(500));
    const firstResult = await first;
    expect(firstResult.route).toBe("hosted");
    expect(nextOutcome.value).toBeNull();
    expect(nextOutcome.error).toBeInstanceOf(OpenRouterControlError);
    expect(nextOutcome.error).toMatchObject({ code: "accounting-failed" });
    expect(hostedCalls).toBe(1);
    expect(state.snapshot()).toMatchObject({
      day: "2026-08-29",
      committedProviderCostMicros: 500,
      reservations: [],
    });
  }
});

test("hostile boundaries and store failures are bounded without accessors, mutation, or partial output", async () => {
  let invoked = 0;
  const hostile = input() as ReturnType<typeof input> & Record<string, unknown>;
  Object.defineProperty(hostile, "hidden", {
    enumerable: true,
    get: () => { invoked += 1; throw new Error("private-store-detail"); },
  });
  const state = atomicStore();
  const before = structuredClone(input());
  const error = await expectControlError(runControlledDesignIntentTask(hostile, {
    store: state.store,
    hostedAdapter: hosted(),
    fallbackAdapter: fake(),
  }), "invalid-control-input");
  expect(invoked).toBe(0);
  expect(JSON.stringify(error)).not.toContain("private-store-detail");
  expect(state.transactions()).toBe(0);
  expect(input()).toEqual(before);

  const hostileBytesInput = input();
  let byteAccessorInvoked = 0;
  Object.defineProperty(hostileBytesInput.request.image.bytes, "constructor", {
    get: () => {
      byteAccessorInvoked += 1;
      throw new Error("private-byte-getter");
    },
  });
  const byteError = await expectControlError(runControlledDesignIntentTask(hostileBytesInput, {
    store: state.store,
    hostedAdapter: hosted(),
    fallbackAdapter: fake(),
  }), "invalid-control-input");
  expect(byteAccessorInvoked).toBe(0);
  expect(JSON.stringify(byteError)).not.toContain("private-byte-getter");

  let calls = 0;
  const broken: OpenRouterAtomicControlStore = {
    async transact() { throw new Error("private-database-detail"); },
    async read() { return emptyState(); },
  };
  const storeError = await expectControlError(runControlledDesignIntentTask(input(), {
    store: broken,
    hostedAdapter: hosted(async () => { calls += 1; return rawResponse(); }),
    fallbackAdapter: fake(),
  }), "control-store-failed");
  expect(calls).toBe(0);
  expect(JSON.stringify(storeError)).not.toContain("private-database-detail");

  let uncommittedHostedCalls = 0;
  let uncommittedTransactions = 0;
  let uncommittedReads = 0;
  const uncommitted: OpenRouterAtomicControlStore = {
    async transact(operation) {
      uncommittedTransactions += 1;
      return structuredClone(operation(emptyState()));
    },
    async read() {
      uncommittedReads += 1;
      return emptyState();
    },
  };
  await expectControlError(runControlledDesignIntentTask(input(), {
    store: uncommitted,
    hostedAdapter: hosted(async () => {
      uncommittedHostedCalls += 1;
      return rawResponse();
    }),
    fallbackAdapter: fake(),
  }), "control-store-failed");
  expect(uncommittedHostedCalls).toBe(0);
  expect(uncommittedTransactions).toBe(1);
  expect(uncommittedReads).toBe(1);
});

test("successful results and every nested audit/output surface are detached and deeply frozen", async () => {
  const value = input();
  const before = structuredClone(value);
  const state = atomicStore();
  const result = await runControlledDesignIntentTask(value, {
    store: state.store,
    hostedAdapter: hosted(),
    fallbackAdapter: fake(),
  });
  expect(value).toEqual(before);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.audit)).toBe(true);
  expect(Object.isFrozen(result.audit.scope)).toBe(true);
  expect(Object.isFrozen(result.response)).toBe(true);
  expect(Object.isFrozen(result.response.intent)).toBe(true);
  value.scope.userId = "changed";
  expect(result.audit.scope.userHash).toMatch(/^0x[a-f0-9]{64}$/);
});

test("the OR02 source is local, provider-neutral, side-effect-free, UI-free, and outside frozen rendering", () => {
  const source = readFileSync(join(process.cwd(), "lib/ai/openRouterExecutionControls.ts"), "utf8");
  const forbidden = [
    /fetch\s*\(/,
    /XMLHttpRequest|WebSocket/,
    /process\.env/,
    /localStorage|indexedDB|sessionStorage/,
    /Date\s*\(|Date\.now|Math\.random|crypto\.randomUUID/,
    /OPENROUTER_API_KEY|Authorization|Bearer /,
    /openRouterDesignIntentAdapter|openRouterDesignIntentAdapter\.server/,
    /react|\.css|three|renderer|scene|animation|camera|lighting|shader|texture|model asset/i,
    /(?:from|import\s*\()[^\n]*(?:wallet|checkout|payment)/i,
    /app\/api\/(?:wallet|checkout|payment)/i,
    /service\s*fee/i,
  ];
  forbidden.forEach((pattern) => expect(source).not.toMatch(pattern));
  expect(source).toContain("runDesignIntentTask");
  expect(source).toContain("createHash");
  expect(source).toContain("contentRetention");
  expect(source).toContain("deterministic-fake");
});
