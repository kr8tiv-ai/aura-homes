import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "playwright/test";

import {
  DESIGN_INTENT_ADAPTER_VERSION,
  DesignIntentAdapterFailure,
  DesignIntentTaskError,
  createDeterministicDesignIntentFake,
  runDesignIntentTask,
  type DesignIntentAdapter,
  type DesignIntentTaskRequest,
  type RawDesignIntentAdapterResponse,
} from "@/lib/ai/designIntentAdapter";
import { DESIGN_INTENT_FIELDS, DESIGN_INTENT_VERSION } from "@/lib/ai/designIntent";
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
      id: "assumption-south",
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

const receipt = () => ({
  currency: "USD" as const,
  providerCostMicros: 1_250,
  inputTokens: 320,
  outputTokens: 180,
  modelId: "vision-model-1",
  providerRequestId: "provider-request-1",
});

const rawResponse = (): RawDesignIntentAdapterResponse => ({
  intent: completeIntent(),
  receipt: receipt(),
});

const request = (): DesignIntentTaskRequest => ({
  version: DESIGN_INTENT_ADAPTER_VERSION,
  task: "image-to-design-intent",
  requestId: "request-1",
  timeoutMs: 100,
  image: {
    intake: {
      version: IMAGE_INTAKE_VERSION,
      name: "cabin.jpg",
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

const adapter = (
  run: DesignIntentAdapter["run"],
  overrides: Partial<Pick<DesignIntentAdapter, "id" | "version" | "kind">> = {},
): DesignIntentAdapter => ({
  id: overrides.id ?? "fixture-hosted",
  version: overrides.version ?? "v1",
  kind: overrides.kind ?? "hosted",
  run,
});

const expectTaskError = async (
  promise: Promise<unknown>,
  code: string,
): Promise<DesignIntentTaskError> => {
  try {
    await promise;
    throw new Error("Expected the design-intent task to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(DesignIntentTaskError);
    expect(error).toMatchObject({ code });
    return error as DesignIntentTaskError;
  }
};

test("hosted-shaped and deterministic adapters use the same task boundary", async () => {
  const hosted = adapter(async () => rawResponse());
  const fake = createDeterministicDesignIntentFake({
    id: "fixture-hosted",
    version: "v1",
    intent: completeIntent(),
    receipt: receipt(),
  });

  const hostedResult = await runDesignIntentTask(request(), hosted);
  const fakeResult = await runDesignIntentTask(request(), fake);

  expect(typeof fake.run).toBe("function");
  expect(hostedResult.intent).toEqual(fakeResult.intent);
  expect(hostedResult.receipt).toEqual(fakeResult.receipt);
  expect(hostedResult).toMatchObject({
    version: DESIGN_INTENT_ADAPTER_VERSION,
    requestId: "request-1",
    adapter: { id: "fixture-hosted", version: "v1", kind: "hosted" },
    receipt: receipt(),
  });
  expect(fakeResult.adapter).toEqual({
    id: "fixture-hosted",
    version: "v1",
    kind: "deterministic-fake",
  });
});

test("the deterministic fake repeats without time, randomness, or shared response aliases", async () => {
  const fake = createDeterministicDesignIntentFake({
    id: "fixture-fake",
    version: "fixture-1",
    intent: completeIntent(),
    receipt: { ...receipt(), providerCostMicros: 0, providerRequestId: null },
  });

  const first = await runDesignIntentTask(request(), fake);
  const second = await runDesignIntentTask(request(), fake);

  expect(first).toEqual(second);
  expect(first).not.toBe(second);
  expect(first.intent).not.toBe(second.intent);
  expect(JSON.stringify(first)).not.toContain("createdAt");
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.intent.rooms)).toBe(true);
  expect(Object.isFrozen(first.receipt)).toBe(true);
});

test("caller bytes and intake metadata are snapshotted before adapter work", async () => {
  const source = request();
  const seen: DesignIntentTaskRequest[] = [];
  const inspecting = adapter(async (candidate) => {
    seen.push(candidate);
    return rawResponse();
  });

  const pending = runDesignIntentTask(source, inspecting);
  source.image.bytes[0] = 0;
  (source.image.intake as { name: string }).name = "changed.jpg";
  await pending;

  expect(seen[0]?.image.bytes).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
  expect(seen[0]?.image.bytes).not.toBe(source.image.bytes);
  expect(seen[0]?.image.intake.name).toBe("cabin.jpg");
  expect(Object.isFrozen(seen[0]?.image.intake)).toBe(true);
});

test("validated output and receipts are detached and deeply frozen", async () => {
  const shared = rawResponse();
  const result = await runDesignIntentTask(request(), adapter(async () => shared));
  (shared.intent as { requestedUse: { category: string } }).requestedUse.category = "workspace";
  (shared.receipt as { providerCostMicros: number }).providerCostMicros = 999_999;

  expect(result.intent.requestedUse.category).toBe("cabin");
  expect(result.receipt.providerCostMicros).toBe(1_250);
  expect(result.intent).not.toBe(shared.intent);
  expect(result.receipt).not.toBe(shared.receipt);
  expect(Object.isFrozen(result.adapter)).toBe(true);
  expect(Object.isFrozen(result.intent.requestedUse)).toBe(true);
});

test("untrusted intent output is promoted only through the strict DesignIntent parser", async () => {
  const geometry = completeIntent();
  geometry.vertices = [{ x: 0, y: 0 }];
  const invalid = adapter(async () => ({ intent: geometry, receipt: receipt() }));
  const error = await expectTaskError(runDesignIntentTask(request(), invalid), "invalid-output");

  expect(error.message).not.toContain("vertices");
  expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
});

test("accepted intent provenance must include the exact requested image fingerprint", async () => {
  const unrelated = completeIntent();
  ((unrelated.sources as Array<{ fingerprint: string }>)[0]).fingerprint = `sha256:${"b".repeat(64)}`;
  const error = await expectTaskError(
    runDesignIntentTask(
      request(),
      adapter(async () => ({ intent: unrelated, receipt: receipt() })),
    ),
    "invalid-output",
  );

  expect(error.message).not.toContain("fingerprint");
});

test("hostile intent reflection fails without leaking private parser detail", async () => {
  const hostile = new Proxy(completeIntent(), {
    ownKeys: () => { throw new Error("private intent reflection detail"); },
  });
  const error = await expectTaskError(
    runDesignIntentTask(request(), adapter(async () => ({ intent: hostile, receipt: receipt() }))),
    "invalid-output",
  );

  expect(String(error)).not.toContain("private intent reflection detail");
});

test("receipt numbers, identifiers, and unknown keys fail closed", async () => {
  const invalidReceipts: unknown[] = [
    { ...receipt(), providerCostMicros: -1 },
    { ...receipt(), providerCostMicros: 1.5 },
    { ...receipt(), inputTokens: Number.MAX_SAFE_INTEGER + 1 },
    { ...receipt(), currency: "CAD" },
    { ...receipt(), modelId: "" },
    { ...receipt(), providerRequestId: "x".repeat(257) },
    { ...receipt(), hiddenFeeMicros: 500 },
  ];

  for (const candidate of invalidReceipts) {
    await expectTaskError(
      runDesignIntentTask(
        request(),
        adapter(async () => ({ intent: completeIntent(), receipt: candidate } as RawDesignIntentAdapterResponse)),
      ),
      "invalid-receipt",
    );
  }
});

test("receipt accessors and revoked proxies fail without invocation or leakage", async () => {
  let getterCalls = 0;
  const accessor = receipt();
  Object.defineProperty(accessor, "modelId", {
    enumerable: true,
    get: () => {
      getterCalls += 1;
      throw new Error("private receipt getter detail");
    },
  });
  await expectTaskError(
    runDesignIntentTask(
      request(),
      adapter(async () => ({ intent: completeIntent(), receipt: accessor } as RawDesignIntentAdapterResponse)),
    ),
    "invalid-receipt",
  );
  expect(getterCalls).toBe(0);

  const revoked = Proxy.revocable(receipt(), {});
  revoked.revoke();
  const error = await expectTaskError(
    runDesignIntentTask(
      request(),
      adapter(async () => ({ intent: completeIntent(), receipt: revoked.proxy } as RawDesignIntentAdapterResponse)),
    ),
    "invalid-receipt",
  );
  expect(String(error)).not.toContain("revoked");
});

test("caller cancellation aborts adapter work and settles a hung adapter", async () => {
  const controller = new AbortController();
  const adapterSignals: AbortSignal[] = [];
  const hung = adapter(async (_candidate, context) => {
    adapterSignals.push(context.signal);
    return new Promise<RawDesignIntentAdapterResponse>(() => undefined);
  });
  const pending = runDesignIntentTask(request(), hung, { signal: controller.signal });
  controller.abort(new Error("private caller reason"));
  const error = await expectTaskError(pending, "cancelled");

  expect(adapterSignals[0]?.aborted).toBe(true);
  expect(String(error)).not.toContain("private caller reason");
});

test("the local deadline aborts adapter work and reports timeout distinctly", async () => {
  const candidate = request();
  candidate.timeoutMs = 10;
  const adapterSignals: AbortSignal[] = [];
  const hung = adapter(async (_request, context) => {
    adapterSignals.push(context.signal);
    return new Promise<RawDesignIntentAdapterResponse>(() => undefined);
  });
  await expectTaskError(runDesignIntentTask(candidate, hung), "timeout");
  expect(adapterSignals[0]?.aborted).toBe(true);
});

test("pre-aborted requests fail before invoking the adapter", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await expectTaskError(
    runDesignIntentTask(
      request(),
      adapter(async () => {
        calls += 1;
        return rawResponse();
      }),
      { signal: controller.signal },
    ),
    "cancelled",
  );
  expect(calls).toBe(0);
});

test("bounded adapter failures normalize while arbitrary thrown values stay private", async () => {
  const limited = adapter(async () => {
    throw new DesignIntentAdapterFailure("rate-limited");
  });
  const limitedError = await expectTaskError(runDesignIntentTask(request(), limited), "rate-limited");
  expect(limitedError.retryable).toBe(true);

  const failures: unknown[] = [
    new Error("secret provider body"),
    { message: "private object message", cause: "credential" },
    Object.defineProperty({}, "code", {
      get: () => { throw new Error("private failure getter"); },
      enumerable: true,
    }),
  ];
  const revoked = Proxy.revocable({ code: "rate-limited" }, {});
  revoked.revoke();
  failures.push(revoked.proxy);
  failures.push(new Proxy(new DesignIntentAdapterFailure("rate-limited"), {
    get: () => { throw new Error("private branded failure trap"); },
  }));

  for (const failure of failures) {
    const error = await expectTaskError(
      runDesignIntentTask(
        request(),
        adapter(async () => { throw failure; }),
      ),
      "provider-failed",
    );
    expect(String(error)).not.toMatch(/secret|private|credential|revoked/i);
    expect((error as Error & { cause?: unknown }).cause).toBeUndefined();
  }
});

test("adapter descriptors reject accessors, unknown fields, and revoked proxies without invocation", async () => {
  let getterCalls = 0;
  const accessorAdapter = {
    get id(): string {
      getterCalls += 1;
      throw new Error("private adapter getter detail");
    },
    version: "v1",
    kind: "hosted" as const,
    run: async () => rawResponse(),
  };
  const accessorError = await expectTaskError(
    runDesignIntentTask(request(), accessorAdapter),
    "invalid-adapter",
  );
  expect(getterCalls).toBe(0);
  expect(String(accessorError)).not.toContain("private adapter getter detail");

  await expectTaskError(
    runDesignIntentTask(request(), { ...adapter(async () => rawResponse()), extra: true } as DesignIntentAdapter),
    "invalid-adapter",
  );

  const revoked = Proxy.revocable(adapter(async () => rawResponse()), {});
  revoked.revoke();
  await expectTaskError(runDesignIntentTask(request(), revoked.proxy), "invalid-adapter");
});

test("deterministic fake fixture metadata rejects accessors without invocation", () => {
  let getterCalls = 0;
  const fixture = {
    get id(): string {
      getterCalls += 1;
      throw new Error("private fake getter detail");
    },
    version: "v1",
    intent: completeIntent(),
    receipt: receipt(),
  };

  try {
    createDeterministicDesignIntentFake(fixture);
    throw new Error("Expected the hostile fake fixture to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(DesignIntentTaskError);
    expect(error).toMatchObject({ code: "invalid-adapter" });
    expect(String(error)).not.toContain("private fake getter detail");
  }
  expect(getterCalls).toBe(0);
});

test("invalid requests fail before adapter invocation", async () => {
  const candidates: DesignIntentTaskRequest[] = [];

  const empty = request();
  empty.image.bytes = new Uint8Array();
  candidates.push(empty);

  const mismatch = request();
  (mismatch.image.intake as { encodedBytes: number }).encodedBytes = 99;
  candidates.push(mismatch);

  const unsupported = request();
  unsupported.image.bytes = new Uint8Array([1, 2, 3, 4]);
  candidates.push(unsupported);

  const fingerprint = request();
  fingerprint.image.sourceFingerprint = "sha256:not-a-digest";
  candidates.push(fingerprint);

  const timeout = request();
  timeout.timeoutMs = 1.5;
  candidates.push(timeout);

  const id = request();
  id.requestId = "";
  candidates.push(id);

  let calls = 0;
  const neverCalled = adapter(async () => {
    calls += 1;
    return rawResponse();
  });
  for (const candidate of candidates) {
    await expectTaskError(runDesignIntentTask(candidate, neverCalled), "invalid-request");
  }
  expect(calls).toBe(0);
});

test("hostile request metadata fails before adapter invocation without invoking accessors", async () => {
  const candidate = request();
  let getterCalls = 0;
  Object.defineProperty(candidate.image.intake, "name", {
    enumerable: true,
    get: () => {
      getterCalls += 1;
      throw new Error("private request getter detail");
    },
  });
  let calls = 0;
  const error = await expectTaskError(
    runDesignIntentTask(
      candidate,
      adapter(async () => {
        calls += 1;
        return rawResponse();
      }),
    ),
    "invalid-request",
  );

  expect(calls).toBe(0);
  expect(getterCalls).toBe(0);
  expect(String(error)).not.toContain("private request getter detail");
});

test("the isolated IP03 module has no provider, network, value, persistence, project, or rendering dependency", () => {
  const source = readFileSync(join(process.cwd(), "lib", "ai", "designIntentAdapter.ts"), "utf8");
  const executable = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, "");

  expect(executable).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage)\b/);
  expect(executable).not.toMatch(/from\s+["'][^"']*(?:openrouter|wallet|payment|project|three|renderer|animation)[^"']*["']/i);
});
