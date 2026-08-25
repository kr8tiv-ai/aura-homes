import { expect, test } from "playwright/test";

import {
  DEFAULT_IMAGE_LIMITS,
  IMAGE_INTAKE_VERSION,
  ImageIntakeError,
  prepareImageIntake,
  sniffImageMimeType,
  type ImageDecodeFacts,
  type ImageDecoder,
  type ImageIntakeDecision,
  type ImageOrientation,
  type ImageOrientationTransform,
  type RawImageInput,
} from "@/lib/ai/imageIntake";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

const DECISION: ImageIntakeDecision = {
  consentToAnalyze: true,
  rights: "i-own-this-image",
  retention: "delete-after-analysis",
};

const input = (overrides: Partial<RawImageInput> = {}): RawImageInput => ({
  name: "cabin-reference.jpg",
  declaredMimeType: "image/jpeg",
  bytes: JPEG,
  ...overrides,
});

const decoder = (
  facts: ImageDecodeFacts = { width: 2400, height: 1600, orientation: 1 },
): ImageDecoder => ({
  decode: async () => facts,
});

const rejectCode = async (promise: Promise<unknown>, code: ImageIntakeError["code"]): Promise<void> => {
  await expect(promise).rejects.toMatchObject({ name: "ImageIntakeError", code });
};

test("encoded signatures, not filenames or declarations, identify JPEG, PNG, and WebP", () => {
  expect(sniffImageMimeType(JPEG)).toBe("image/jpeg");
  expect(sniffImageMimeType(PNG)).toBe("image/png");
  expect(sniffImageMimeType(WEBP)).toBe("image/webp");
  expect(sniffImageMimeType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
});

test("consent, rights, retention, empty, oversized, and unsupported failures never invoke the decoder", async () => {
  let calls = 0;
  const countingDecoder: ImageDecoder = {
    decode: async () => {
      calls += 1;
      return { width: 10, height: 10, orientation: 1 };
    },
  };
  const cases: ReadonlyArray<{
    candidate: RawImageInput;
    decision: Partial<ImageIntakeDecision>;
    code: ImageIntakeError["code"];
    limits?: Partial<typeof DEFAULT_IMAGE_LIMITS>;
  }> = [
    { candidate: input(), decision: { ...DECISION, consentToAnalyze: false }, code: "consent-required" },
    { candidate: input(), decision: { ...DECISION, rights: null }, code: "rights-required" },
    { candidate: input(), decision: { ...DECISION, retention: null }, code: "retention-required" },
    { candidate: input({ bytes: new Uint8Array() }), decision: DECISION, code: "empty-file" },
    {
      candidate: input(),
      decision: DECISION,
      code: "file-too-large",
      limits: { maxBytes: JPEG.byteLength - 1 },
    },
    {
      candidate: input({ bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38]) }),
      decision: DECISION,
      code: "unsupported-signature",
    },
  ];

  for (const candidate of cases) {
    await rejectCode(
      prepareImageIntake(candidate.candidate, candidate.decision, countingDecoder, candidate.limits),
      candidate.code,
    );
  }
  expect(calls).toBe(0);
});

test("a declared MIME type that conflicts with the bytes is refused before decode", async () => {
  let calls = 0;
  await rejectCode(
    prepareImageIntake(
      input({ declaredMimeType: "image/png" }),
      DECISION,
      { decode: async () => { calls += 1; return { width: 1, height: 1, orientation: 1 }; } },
    ),
    "mime-mismatch",
  );
  expect(calls).toBe(0);
});

test("a blank browser MIME declaration may be replaced only by the detected signature", async () => {
  const prepared = await prepareImageIntake(input({ declaredMimeType: "" }), DECISION, decoder());
  expect(prepared.mimeType).toBe("image/jpeg");
  expect(prepared.declaredMimeType).toBeNull();
});

test("accepted input returns a versioned, explicit, provider-free receipt without rewriting caller bytes", async () => {
  const bytes = JPEG.slice();
  const before = Array.from(bytes);
  const prepared = await prepareImageIntake(input({ bytes }), DECISION, {
    decode: async ({ bytes: decoderBytes, mimeType, signal }) => {
      expect(decoderBytes).not.toBe(bytes);
      expect(mimeType).toBe("image/jpeg");
      expect(signal.aborted).toBe(false);
      decoderBytes[0] = 0;
      return { width: 2400, height: 1600, orientation: 1 };
    },
  });

  expect(Array.from(bytes)).toEqual(before);
  expect(prepared).toMatchObject({
    version: IMAGE_INTAKE_VERSION,
    name: "cabin-reference.jpg",
    mimeType: "image/jpeg",
    encodedBytes: JPEG.byteLength,
    width: 2400,
    height: 1600,
    displayWidth: 2400,
    displayHeight: 1600,
    pixels: 3_840_000,
    orientation: 1,
    orientationTransform: "none",
    consentToAnalyze: true,
    rights: "i-own-this-image",
    retention: "delete-after-analysis",
    rawImageDisposition: "delete when the analysis task finishes or fails",
  });
  expect("provider" in prepared).toBe(false);
  expect("model" in prepared).toBe(false);
});

test("intake snapshots bytes before preflight so caller replacement cannot change what is decoded", async () => {
  const candidate = input();
  let decodedBytes: number[] = [];
  let decodedMime: string | null = null;
  const pending = prepareImageIntake(candidate, DECISION, {
    decode: async ({ bytes, mimeType }) => {
      decodedBytes = Array.from(bytes);
      decodedMime = mimeType;
      return { width: 2400, height: 1600, orientation: 1 };
    },
  });

  candidate.bytes = PNG;
  const prepared = await pending;

  expect(decodedBytes).toEqual(Array.from(JPEG));
  expect(decodedMime).toBe("image/jpeg");
  expect(prepared.encodedBytes).toBe(JPEG.byteLength);
});

test("intake snapshot is isolated from in-place caller mutation after validation", async () => {
  const bytes = JPEG.slice();
  let decodedBytes: number[] = [];
  const pending = prepareImageIntake(input({ bytes }), DECISION, {
    decode: async ({ bytes: decoderBytes }) => {
      decodedBytes = Array.from(decoderBytes);
      return { width: 2400, height: 1600, orientation: 1 };
    },
  });

  bytes.fill(0);
  await pending;

  expect(decodedBytes).toEqual(Array.from(JPEG));
});

test("retaining a raw image is an explicit project-scoped choice with a deletion path", async () => {
  const prepared = await prepareImageIntake(
    input(),
    { ...DECISION, retention: "retain-with-project" },
    decoder(),
  );
  expect(prepared).toMatchObject({
    retention: "retain-with-project",
    rawImageDisposition: "retain only with this project until the person deletes it",
  });
});

test("EXIF orientations 5 through 8 swap the display axes without changing decoded facts", async () => {
  const expected: ReadonlyArray<readonly [ImageOrientation, ImageOrientationTransform]> = [
    [5, "transpose"],
    [6, "rotate-90-cw"],
    [7, "transverse"],
    [8, "rotate-90-ccw"],
  ];

  for (const [orientation, transform] of expected) {
    const prepared = await prepareImageIntake(
      input(),
      DECISION,
      decoder({ width: 2400, height: 1600, orientation }),
    );
    expect(prepared).toMatchObject({
      width: 2400,
      height: 1600,
      displayWidth: 1600,
      displayHeight: 2400,
      orientation,
      orientationTransform: transform,
    });
  }
});

test("invalid decoded dimensions and orientation are named rather than guessed", async () => {
  await rejectCode(
    prepareImageIntake(input(), DECISION, decoder({ width: 0, height: 100, orientation: 1 })),
    "invalid-dimensions",
  );
  await rejectCode(
    prepareImageIntake(
      input(),
      DECISION,
      decoder({ width: 100, height: 100, orientation: 9 } as unknown as ImageDecodeFacts),
    ),
    "invalid-orientation",
  );
});

test("dimension and total-pixel ceilings reject decoded bombs", async () => {
  await rejectCode(
    prepareImageIntake(input(), DECISION, decoder({ width: 12_001, height: 100, orientation: 1 })),
    "dimension-limit",
  );
  await rejectCode(
    prepareImageIntake(input(), DECISION, decoder({ width: 8_000, height: 6_000, orientation: 1 })),
    "pixel-limit",
  );
});

test("a stalled decoder is aborted and normalized to one timeout error", async () => {
  const observed: { signal: AbortSignal | null } = { signal: null };
  const stalled: ImageDecoder = {
    decode: ({ signal }) => {
      observed.signal = signal;
      return new Promise(() => undefined);
    },
  };

  await rejectCode(
    prepareImageIntake(input(), DECISION, stalled, { decodeTimeoutMs: 10 }),
    "decode-timeout",
  );
  expect(observed.signal?.aborted).toBe(true);
});

test("decoder exceptions are normalized without exposing provider or browser internals", async () => {
  const thrown = await prepareImageIntake(input(), DECISION, {
    decode: async () => { throw new Error("secret decoder/provider detail"); },
  }).catch((error: unknown) => error);

  expect(thrown).toMatchObject({ name: "ImageIntakeError", code: "decode-failed" });
  expect("cause" in (thrown as object)).toBe(false);
  expect(String(thrown)).not.toContain("secret decoder/provider detail");
});

test("caller cancellation aborts decode and is distinct from timeout", async () => {
  const controller = new AbortController();
  const observed: { signal: AbortSignal | null } = { signal: null };
  const pending = prepareImageIntake(
    input(),
    DECISION,
    {
      decode: ({ signal }) => {
        observed.signal = signal;
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
    },
    { signal: controller.signal },
  );
  controller.abort("user cancelled");

  await rejectCode(pending, "cancelled");
  expect(observed.signal?.aborted).toBe(true);
});
