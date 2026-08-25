/**
 * Provider-free image intake for the picture-to-plan pipeline.
 *
 * This module deliberately stops before inference. It proves that a person
 * made the privacy and rights choices, identifies the encoded format from its
 * bytes, bounds the file, and asks an injected decoder for pixel facts under
 * an abortable timeout. Nothing here can call a model, persist an upload, or
 * mutate a project.
 */

export const IMAGE_INTAKE_VERSION = "aura-image-intake/v1" as const;

export const DEFAULT_IMAGE_LIMITS = Object.freeze({
  maxBytes: 12 * 1024 * 1024,
  maxWidth: 12_000,
  maxHeight: 12_000,
  maxPixels: 40_000_000,
  decodeTimeoutMs: 5_000,
});

export type SupportedImageMimeType = "image/jpeg" | "image/png" | "image/webp";
export type ImageOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ImageOrientationTransform =
  | "none"
  | "flip-horizontal"
  | "rotate-180"
  | "flip-vertical"
  | "transpose"
  | "rotate-90-cw"
  | "transverse"
  | "rotate-90-ccw";
export type ImageRights =
  | "i-own-this-image"
  | "i-have-permission"
  | "reference-only-inspiration";
export type ImageRetention = "delete-after-analysis" | "retain-with-project";

export type ImageIntakeErrorCode =
  | "consent-required"
  | "rights-required"
  | "retention-required"
  | "invalid-name"
  | "invalid-limits"
  | "empty-file"
  | "file-too-large"
  | "unsupported-signature"
  | "mime-mismatch"
  | "cancelled"
  | "decode-timeout"
  | "decode-failed"
  | "invalid-dimensions"
  | "dimension-limit"
  | "pixel-limit"
  | "invalid-orientation";

export class ImageIntakeError extends Error {
  readonly code: ImageIntakeErrorCode;

  constructor(code: ImageIntakeErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ImageIntakeError";
    this.code = code;
  }
}

export interface RawImageInput {
  name: string;
  declaredMimeType: string;
  bytes: Uint8Array;
}

export interface ImageIntakeDecision {
  consentToAnalyze: boolean;
  rights: ImageRights | null;
  retention: ImageRetention | null;
}

export interface ImageDecodeFacts {
  width: number;
  height: number;
  orientation: ImageOrientation;
}

export interface ImageDecoder {
  decode(input: {
    bytes: Uint8Array;
    mimeType: SupportedImageMimeType;
    signal: AbortSignal;
  }): Promise<ImageDecodeFacts>;
}

export interface ImageIntakeOptions {
  maxBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  maxPixels?: number;
  decodeTimeoutMs?: number;
  signal?: AbortSignal;
}

export interface PreparedImageIntake {
  version: typeof IMAGE_INTAKE_VERSION;
  name: string;
  mimeType: SupportedImageMimeType;
  declaredMimeType: SupportedImageMimeType | null;
  encodedBytes: number;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  pixels: number;
  orientation: ImageOrientation;
  orientationTransform: ImageOrientationTransform;
  consentToAnalyze: true;
  rights: ImageRights;
  retention: ImageRetention;
  rawImageDisposition:
    | "delete when the analysis task finishes or fails"
    | "retain only with this project until the person deletes it";
}

const RIGHTS = new Set<ImageRights>([
  "i-own-this-image",
  "i-have-permission",
  "reference-only-inspiration",
]);

const RETENTION = new Set<ImageRetention>([
  "delete-after-analysis",
  "retain-with-project",
]);

const ORIENTATION_TRANSFORM: Readonly<Record<ImageOrientation, ImageOrientationTransform>> = {
  1: "none",
  2: "flip-horizontal",
  3: "rotate-180",
  4: "flip-vertical",
  5: "transpose",
  6: "rotate-90-cw",
  7: "transverse",
  8: "rotate-90-ccw",
};

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((value, index) => bytes[index] === value);

export function sniffImageMimeType(bytes: Uint8Array): SupportedImageMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

const positiveLimit = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

const limitsFrom = (options: ImageIntakeOptions) => {
  const limits = {
    maxBytes: options.maxBytes ?? DEFAULT_IMAGE_LIMITS.maxBytes,
    maxWidth: options.maxWidth ?? DEFAULT_IMAGE_LIMITS.maxWidth,
    maxHeight: options.maxHeight ?? DEFAULT_IMAGE_LIMITS.maxHeight,
    maxPixels: options.maxPixels ?? DEFAULT_IMAGE_LIMITS.maxPixels,
    decodeTimeoutMs: options.decodeTimeoutMs ?? DEFAULT_IMAGE_LIMITS.decodeTimeoutMs,
  };
  if (!Object.values(limits).every(positiveLimit)) {
    throw new ImageIntakeError("invalid-limits", "Image intake limits must be positive safe integers.");
  }
  return limits;
};

const requireDecision = (
  decision: Partial<ImageIntakeDecision>,
): { consentToAnalyze: true; rights: ImageRights; retention: ImageRetention } => {
  if (decision.consentToAnalyze !== true) {
    throw new ImageIntakeError(
      "consent-required",
      "Choose whether Aura may analyze this image before continuing.",
    );
  }
  if (!decision.rights || !RIGHTS.has(decision.rights)) {
    throw new ImageIntakeError(
      "rights-required",
      "Confirm that you own this image, have permission, or are using it only as inspiration.",
    );
  }
  if (!decision.retention || !RETENTION.has(decision.retention)) {
    throw new ImageIntakeError(
      "retention-required",
      "Choose whether the raw image is deleted after analysis or retained with this project.",
    );
  }
  return {
    consentToAnalyze: true,
    rights: decision.rights,
    retention: decision.retention,
  };
};

const preflight = (
  input: RawImageInput,
  decision: Partial<ImageIntakeDecision>,
  options: ImageIntakeOptions,
) => {
  const acceptedDecision = requireDecision(decision);
  const limits = limitsFrom(options);
  const name = input.name.trim();
  const sourceBytes = input.bytes;
  if (!name) throw new ImageIntakeError("invalid-name", "The selected image has no readable filename.");
  if (sourceBytes.byteLength === 0) {
    throw new ImageIntakeError("empty-file", "The selected image is empty.");
  }
  if (sourceBytes.byteLength > limits.maxBytes) {
    throw new ImageIntakeError(
      "file-too-large",
      `The selected image is ${sourceBytes.byteLength} bytes; this intake allows at most ${limits.maxBytes}.`,
    );
  }
  const bytes = sourceBytes.slice();
  const mimeType = sniffImageMimeType(bytes);
  if (!mimeType) {
    throw new ImageIntakeError(
      "unsupported-signature",
      "This file is not an encoded JPEG, PNG, or WebP image Aura can inspect.",
    );
  }
  const declared = input.declaredMimeType.trim().toLowerCase();
  if (declared && declared !== mimeType) {
    throw new ImageIntakeError(
      "mime-mismatch",
      `The browser described this file as ${declared}, but its encoded signature is ${mimeType}.`,
    );
  }
  return {
    acceptedDecision,
    limits,
    mimeType,
    declaredMimeType: declared ? mimeType : null,
    name,
    bytes,
    encodedBytes: bytes.byteLength,
  };
};

const validatedFacts = (
  facts: ImageDecodeFacts,
  limits: ReturnType<typeof limitsFrom>,
) => {
  if (
    !Number.isSafeInteger(facts.width) ||
    !Number.isSafeInteger(facts.height) ||
    facts.width <= 0 ||
    facts.height <= 0
  ) {
    throw new ImageIntakeError(
      "invalid-dimensions",
      "The image decoder did not return positive whole-pixel dimensions.",
    );
  }
  if (facts.width > limits.maxWidth || facts.height > limits.maxHeight) {
    throw new ImageIntakeError(
      "dimension-limit",
      `The decoded image is ${facts.width} by ${facts.height}; the intake limit is ${limits.maxWidth} by ${limits.maxHeight}.`,
    );
  }
  const pixels = facts.width * facts.height;
  if (!Number.isSafeInteger(pixels) || pixels > limits.maxPixels) {
    throw new ImageIntakeError(
      "pixel-limit",
      `The decoded image contains ${pixels} pixels; the intake limit is ${limits.maxPixels}.`,
    );
  }
  if (!Number.isInteger(facts.orientation) || !(facts.orientation in ORIENTATION_TRANSFORM)) {
    throw new ImageIntakeError(
      "invalid-orientation",
      "The image decoder did not return an EXIF orientation from 1 through 8.",
    );
  }
  const orientation = facts.orientation as ImageOrientation;
  const swapAxes = orientation >= 5;
  return {
    width: facts.width,
    height: facts.height,
    displayWidth: swapAxes ? facts.height : facts.width,
    displayHeight: swapAxes ? facts.width : facts.height,
    pixels,
    orientation,
    orientationTransform: ORIENTATION_TRANSFORM[orientation],
  };
};

export async function prepareImageIntake(
  input: RawImageInput,
  decision: Partial<ImageIntakeDecision>,
  decoder: ImageDecoder,
  options: ImageIntakeOptions = {},
): Promise<PreparedImageIntake> {
  const prepared = preflight(input, decision, options);
  if (options.signal?.aborted) {
    throw new ImageIntakeError("cancelled", "Image intake was cancelled before decoding began.");
  }

  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;
  const onExternalAbort = () => {
    cancelled = true;
    controller.abort(options.signal?.reason);
  };
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("image decode timeout"));
  }, prepared.limits.decodeTimeoutMs);

  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(controller.signal.reason ?? new Error("image decode aborted")),
      { once: true },
    );
  });

  let facts: ImageDecodeFacts;
  try {
    const decoding = Promise.resolve().then(() =>
      decoder.decode({
        bytes: prepared.bytes.slice(),
        mimeType: prepared.mimeType,
        signal: controller.signal,
      }),
    );
    facts = await Promise.race([decoding, aborted]);
  } catch (error) {
    if (timedOut) {
      throw new ImageIntakeError(
        "decode-timeout",
        `The image did not decode within ${prepared.limits.decodeTimeoutMs} milliseconds.`,
      );
    }
    if (cancelled || options.signal?.aborted) {
      throw new ImageIntakeError("cancelled", "Image intake was cancelled.");
    }
    throw new ImageIntakeError(
      "decode-failed",
      "The image could not be decoded safely as JPEG, PNG, or WebP.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }

  const normalized = validatedFacts(facts, prepared.limits);
  const disposition =
    prepared.acceptedDecision.retention === "delete-after-analysis"
      ? "delete when the analysis task finishes or fails"
      : "retain only with this project until the person deletes it";

  return Object.freeze({
    version: IMAGE_INTAKE_VERSION,
    name: prepared.name,
    mimeType: prepared.mimeType,
    declaredMimeType: prepared.declaredMimeType,
    encodedBytes: prepared.encodedBytes,
    ...normalized,
    consentToAnalyze: true,
    rights: prepared.acceptedDecision.rights,
    retention: prepared.acceptedDecision.retention,
    rawImageDisposition: disposition,
  });
}
