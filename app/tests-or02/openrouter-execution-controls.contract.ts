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
  const store: OpenRouterAtomicControlStore = {
    async transact(operation: OpenRouterStoreOperation) {
      transactions += 1;
      const result = operation(structuredClone(state));
      state = structuredClone(result.state);
      return structuredClone(result);
    },
  };
  return {
    store,
    snapshot: () => structuredClone(state),
    transactions: () => transactions,
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

test("temporary hosted failures release once and use exactly one fake fallback", async () => {
  for (const failure of ["unavailable", "rate-limited", "payment-required"] as const) {
    const state = atomicStore();
    let fallbackCalls = 0;
    const fallback = fake();
    const result = await runControlledDesignIntentTask(input(`failure-${failure}`), {
      store: state.store,
      hostedAdapter: hosted(async () => { throw new DesignIntentAdapterFailure(failure); }),
      fallbackAdapter: {
        ...fallback,
        async run(request, context) {
          fallbackCalls += 1;
          return fallback.run(request, context);
        },
      },
    });
    expect(result).toMatchObject({
      route: "deterministic-fake",
      audit: { reason: `hosted-${failure}` },
    });
    expect(fallbackCalls).toBe(1);
    expect(state.snapshot().reservations).toEqual([]);
    expect(state.snapshot().committedProviderCostMicros).toBe(0);
    expect(state.transactions()).toBe(2);
  }
});

test("invalid hosted output and actual cost above reservation fail closed without fake fallback", async () => {
  const cases: Array<[RawDesignIntentAdapterResponse, string]> = [
    [{ intent: { geometry: "smuggled" }, receipt: rawResponse().receipt }, "execution-failed"],
    [rawResponse(1_251), "accounting-failed"],
  ];
  for (const [response, code] of cases) {
    const state = atomicStore();
    let fallbackCalls = 0;
    const fallback = fake();
    const value = input(`unsafe-${code}`);
    if (code === "accounting-failed") value.estimatedProviderCostMicros = 1_250;
    await expectControlError(runControlledDesignIntentTask(value, {
      store: state.store,
      hostedAdapter: hosted(async () => response),
      fallbackAdapter: {
        ...fallback,
        async run(request, context) {
          fallbackCalls += 1;
          return fallback.run(request, context);
        },
      },
    }), code);
    expect(fallbackCalls).toBe(0);
    expect(state.snapshot().reservations).toEqual([]);
    expect(state.snapshot().committedProviderCostMicros).toBe(0);
  }
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
  expect(state.snapshot().committedProviderCostMicros).toBe(0);
});

test("explicit UTC minute and day transitions reset only their declared counters", async () => {
  const state = atomicStore();
  const limits = { perUserRequestsPerMinute: 1, globalDailyProviderCostMicros: 1_500 };
  await runControlledDesignIntentTask(input("bucket-first", limits), {
    store: state.store,
    hostedAdapter: hosted(),
    fallbackAdapter: fake(),
  });

  const nextMinute = input("bucket-minute", limits);
  nextMinute.window.minute = "2026-08-29T12:35Z";
  const minuteResult = await runControlledDesignIntentTask(nextMinute, {
    store: state.store,
    hostedAdapter: hosted(),
    fallbackAdapter: fake(),
  });
  expect(minuteResult).toMatchObject({ route: "deterministic-fake", audit: { reason: "daily-spend-limit" } });

  const nextDay = input("bucket-day", limits);
  nextDay.window = { day: "2026-08-30", minute: "2026-08-30T00:00Z" };
  const dayResult = await runControlledDesignIntentTask(nextDay, {
    store: state.store,
    hostedAdapter: hosted(),
    fallbackAdapter: fake(),
  });
  expect(dayResult.route).toBe("hosted");
  expect(state.snapshot().day).toBe("2026-08-30");
  expect(state.snapshot().committedProviderCostMicros).toBe(1_250);
  expect(state.snapshot().requests.every((item) => item.minute.startsWith("2026-08-30"))).toBe(true);
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
  };
  const storeError = await expectControlError(runControlledDesignIntentTask(input(), {
    store: broken,
    hostedAdapter: hosted(async () => { calls += 1; return rawResponse(); }),
    fallbackAdapter: fake(),
  }), "control-store-failed");
  expect(calls).toBe(0);
  expect(JSON.stringify(storeError)).not.toContain("private-database-detail");

  let phantomHostedCalls = 0;
  let phantomTransactions = 0;
  const phantom: OpenRouterAtomicControlStore = {
    async transact() {
      phantomTransactions += 1;
      if (phantomTransactions !== 1) throw new Error("no-reservation-exists");
      return {
        kind: "hosted",
        reason: "hosted-authorized",
        reservationId: "phantom-reservation",
        counters: {
          userMinuteRequests: 1,
          sessionMinuteRequests: 1,
          projectMinuteRequests: 1,
          activeReservations: 1,
          committedProviderCostMicros: 0,
          reservedProviderCostMicros: 1_250,
        },
      };
    },
  };
  await expectControlError(runControlledDesignIntentTask(input(), {
    store: phantom,
    hostedAdapter: hosted(async () => {
      phantomHostedCalls += 1;
      return rawResponse();
    }),
    fallbackAdapter: fake(),
  }), "control-store-failed");
  expect(phantomHostedCalls).toBe(0);
  expect(phantomTransactions).toBe(1);
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
