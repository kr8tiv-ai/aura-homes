import {
  canonicalAuraProjectJson,
  validateAuraProject,
  type AuraProject,
} from "./document";

const ENCRYPTED_PROJECT_FORMAT = "aura-project-encrypted" as const;
const ENCRYPTED_PROJECT_VERSION = 1 as const;
const PBKDF2_ITERATIONS = 210_000;

export function projectFileJson(_project: AuraProject): string {
  return `${canonicalAuraProjectJson(_project)}\n`;
}

export function parseAuraProjectFile(_text: string):
  | { ok: true; project: AuraProject }
  | { ok: false; problem: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(_text);
  } catch (error) {
    return { ok: false, problem: `That project file is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const checked = validateAuraProject(parsed);
  return checked.ok ? checked : { ok: false, problem: checked.problem };
}

export async function encryptAuraProjectFile(
  _project: AuraProject,
  _passphrase: string,
): Promise<string> {
  const passphrase = _passphrase.trim();
  if (passphrase.length < 8) throw new Error("Use a passphrase with at least 8 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ["encrypt"]);
  const payload = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    new TextEncoder().encode(projectFileJson(_project)),
  );
  return `${JSON.stringify({
    format: ENCRYPTED_PROJECT_FORMAT,
    version: ENCRYPTED_PROJECT_VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt) },
    cipher: { name: "AES-GCM", iv: bytesToBase64(iv) },
    payload: bytesToBase64(new Uint8Array(payload)),
  })}\n`;
}

export async function decryptAuraProjectFile(
  _text: string,
  _passphrase: string,
): Promise<AuraProject> {
  try {
    const raw = JSON.parse(_text) as Record<string, unknown>;
    if (
      raw.format !== ENCRYPTED_PROJECT_FORMAT ||
      raw.version !== ENCRYPTED_PROJECT_VERSION ||
      typeof raw.payload !== "string" ||
      typeof raw.kdf !== "object" || raw.kdf === null ||
      typeof raw.cipher !== "object" || raw.cipher === null
    ) throw new Error("unsupported encrypted project format");
    const kdf = raw.kdf as Record<string, unknown>;
    const cipher = raw.cipher as Record<string, unknown>;
    if (
      kdf.name !== "PBKDF2" || kdf.hash !== "SHA-256" ||
      kdf.iterations !== PBKDF2_ITERATIONS || typeof kdf.salt !== "string" ||
      cipher.name !== "AES-GCM" || typeof cipher.iv !== "string"
    ) throw new Error("unsupported encryption settings");
    const key = await deriveKey(_passphrase.trim(), base64ToBytes(kdf.salt), ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asArrayBuffer(base64ToBytes(cipher.iv)) },
      key,
      asArrayBuffer(base64ToBytes(raw.payload)),
    );
    const parsed = parseAuraProjectFile(new TextDecoder().decode(plain));
    if (!parsed.ok) throw new Error(parsed.problem);
    return parsed.project;
  } catch (error) {
    throw new Error(`This project could not be decrypted or validated. Check the passphrase and file. (${error instanceof Error ? error.message : String(error)})`);
  }
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: asArrayBuffer(salt), iterations: PBKDF2_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  Array.from(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}
