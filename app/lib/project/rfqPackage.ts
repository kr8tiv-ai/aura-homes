import { keccak256, stringToHex } from "viem";
import { drawingSet } from "@/lib/builder/drawings";
import { exportDrawingSetPdf } from "@/lib/builder/exportPdf";
import { hashProjectBudget, type ProjectBudget } from "@/lib/builder/projectBudget";
import type { ExportArtifact } from "@/lib/builder/exportSpec";
import { validateAuraProject, type AuraProject } from "./document";
import { validateProjectRfq, type ProjectRfqV2 } from "./rfq";

export const PROJECT_RFQ_PACKAGE_FORMAT = "aura-project-rfq-package" as const;
export const PROJECT_RFQ_PACKAGE_VERSION = 1 as const;

export type ProjectRfqPackageArtifactId = "rfq-json" | "quantities-json" | "drawing-pdf";
export type ProjectRfqPackageEncoding = "utf-8" | "base64";

export interface ProjectRfqPackageArtifact {
  id: ProjectRfqPackageArtifactId;
  filename: string;
  mediaType: string;
  encoding: ProjectRfqPackageEncoding;
  byteLength: number;
  sha256: string;
  note: string;
  content: string;
}

export type ProjectRfqPackageManifestEntry = Omit<ProjectRfqPackageArtifact, "content">;

export interface ProjectRfqArtifactPackageV1 {
  format: typeof PROJECT_RFQ_PACKAGE_FORMAT;
  version: typeof PROJECT_RFQ_PACKAGE_VERSION;
  generator: "Aura Homes local RFQ packager";
  issuedAtISO: string;
  projectId: string;
  rfqId: string;
  designHash: `0x${string}`;
  budgetHash: `0x${string}`;
  rfqHash: `0x${string}`;
  schedule: {
    createdAtISO: string;
    responseDueISO: string | null;
  };
  rfq: ProjectRfqV2;
  artifacts: ProjectRfqPackageArtifact[];
  manifest: ProjectRfqPackageManifestEntry[];
  drawingWarnings: string[];
  packageHash: `0x${string}`;
}

export interface BuiltProjectRfqPackage {
  package: ProjectRfqArtifactPackageV1;
  artifact: ExportArtifact;
}

export type ProjectRfqPackageValidation =
  | { ok: true; package: ProjectRfqArtifactPackageV1 }
  | { ok: false; problem: string; futureVersion?: number };

interface BuildProjectRfqPackageInput {
  project: AuraProject;
  budget: ProjectBudget;
  rfq: ProjectRfqV2;
}

interface QuantityScheduleV1 {
  format: "aura-rfq-quantity-schedule";
  version: 1;
  projectId: string;
  rfqId: string;
  designHash: `0x${string}`;
  budgetHash: `0x${string}`;
  currency: "CAD";
  measures: ProjectBudget["measures"];
  lines: Array<{
    id: string;
    category: string;
    label: string;
    quantity: number;
    unit: string;
    low: number;
    mid: number;
    high: number;
    basis: string;
    ownerBuildable: boolean;
    status: "modelled" | "allowance" | "quote-needed";
  }>;
}

const ARTIFACT_IDS: readonly ProjectRfqPackageArtifactId[] = ["rfq-json", "quantities-json", "drawing-pdf"];
const HEX_32 = /^0x[a-f0-9]{64}$/i;
const SHA_256 = /^[a-f0-9]{64}$/i;
const textEncoder = new TextEncoder();

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function slug(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "project";
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  const result = new Uint8Array(digest);
  let hex = "";
  for (let index = 0; index < result.length; index += 1) hex += result[index].toString(16).padStart(2, "0");
  return hex;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length))));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function textArtifact(input: {
  id: Exclude<ProjectRfqPackageArtifactId, "drawing-pdf">;
  filename: string;
  note: string;
  value: unknown;
}): Promise<ProjectRfqPackageArtifact> {
  const content = canonicalJson(input.value);
  const bytes = textEncoder.encode(content);
  return {
    id: input.id,
    filename: input.filename,
    mediaType: "application/json",
    encoding: "utf-8",
    byteLength: bytes.byteLength,
    sha256: await sha256(bytes),
    note: input.note,
    content,
  };
}

async function binaryArtifact(input: {
  id: "drawing-pdf";
  filename: string;
  mediaType: "application/pdf";
  note: string;
  bytes: Uint8Array;
}): Promise<ProjectRfqPackageArtifact> {
  return {
    id: input.id,
    filename: input.filename,
    mediaType: input.mediaType,
    encoding: "base64",
    byteLength: input.bytes.byteLength,
    sha256: await sha256(input.bytes),
    note: input.note,
    content: bytesToBase64(input.bytes),
  };
}

function manifestOf(artifacts: readonly ProjectRfqPackageArtifact[]): ProjectRfqPackageManifestEntry[] {
  return artifacts.map(({ content: _content, ...entry }) => entry);
}

function packageHashOf(value: Omit<ProjectRfqArtifactPackageV1, "packageHash"> | ProjectRfqArtifactPackageV1): `0x${string}` {
  const body = structuredClone(value) as unknown as Record<string, unknown>;
  delete body.packageHash;
  return keccak256(stringToHex(JSON.stringify(canonical(body))));
}

function quantitySchedule(input: BuildProjectRfqPackageInput): QuantityScheduleV1 {
  const selected = new Set(input.rfq.budgetLines.map((line) => line.id));
  return {
    format: "aura-rfq-quantity-schedule",
    version: 1,
    projectId: input.rfq.projectId,
    rfqId: input.rfq.id,
    designHash: input.rfq.designHash,
    budgetHash: input.rfq.budgetHash,
    currency: "CAD",
    measures: structuredClone(input.budget.measures),
    lines: input.budget.lines.filter((line) => selected.has(line.id)).map((line) => ({
      id: line.id,
      category: line.category,
      label: line.label,
      quantity: line.quantity,
      unit: line.unit,
      low: line.low,
      mid: line.mid,
      high: line.high,
      basis: line.basis,
      ownerBuildable: line.ownerBuildable,
      status: line.status,
    })),
  };
}

function assertCurrentInputs(input: BuildProjectRfqPackageInput): { project: AuraProject; rfq: ProjectRfqV2 } {
  const project = validateAuraProject(input.project);
  if (!project.ok) throw new Error(`Cannot package this RFQ: ${project.problem}`);
  const rfq = validateProjectRfq(input.rfq);
  if (!rfq.ok) throw new Error(`Cannot package this RFQ: ${rfq.problem}`);
  if (rfq.rfq.version !== 2) throw new Error("Cannot package a legacy version-one RFQ. Prepare a current RFQ first.");
  if (rfq.rfq.projectId !== project.project.id) throw new Error("The RFQ belongs to a different project.");
  if (rfq.rfq.designHash !== project.project.design.documentHash || input.budget.designHash !== project.project.design.documentHash) {
    throw new Error("The RFQ or budget design hash does not match the current project design.");
  }
  if (hashProjectBudget(input.budget) !== input.budget.budgetHash) {
    throw new Error("The budget hash does not match its planning basis.");
  }
  if (rfq.rfq.budgetHash !== input.budget.budgetHash) {
    throw new Error("The project budget changed after this RFQ was prepared. Prepare a new RFQ package.");
  }
  return { project: project.project, rfq: rfq.rfq };
}

export async function buildProjectRfqPackage(input: BuildProjectRfqPackageInput): Promise<BuiltProjectRfqPackage> {
  const checked = assertCurrentInputs(input);
  const parcel = checked.project.design.document.site?.parcel ?? null;
  const set = drawingSet({
    document: checked.project.design.document,
    dateISO: checked.rfq.createdAtISO.slice(0, 10),
    projectName: checked.rfq.projectName,
    parcel: parcel ? {
      lotWidthFt: parcel.lotWidthFt,
      lotDepthFt: parcel.lotDepthFt,
      frontSetbackFt: parcel.frontSetbackFt,
      sideSetbackFt: parcel.sideSetbackFt,
      rearSetbackFt: parcel.rearSetbackFt,
    } : null,
  });
  const pdf = await exportDrawingSetPdf(set, {
    projectName: checked.rfq.projectName,
    dateISO: checked.rfq.createdAtISO.slice(0, 10),
    designHash: checked.rfq.designHash,
  });
  const pdfBytes = new Uint8Array(await pdf.blob.arrayBuffer());
  if (new TextDecoder().decode(pdfBytes.subarray(0, 5)) !== "%PDF-") {
    throw new Error("The drawing writer did not produce a PDF artifact.");
  }
  const prefix = `${slug(checked.rfq.projectId)}-${slug(checked.rfq.scope)}`;
  const artifacts = await Promise.all([
    textArtifact({
      id: "rfq-json",
      filename: `${prefix}.aura-rfq.json`,
      note: "Exact validated RFQ, including scope, assumptions, exclusions, response template and hashes.",
      value: checked.rfq,
    }),
    textArtifact({
      id: "quantities-json",
      filename: `${prefix}.aura-quantities.json`,
      note: "Scope-filtered quantities and planning ranges from the RFQ-bound budget.",
      value: quantitySchedule({ ...input, project: checked.project, rfq: checked.rfq }),
    }),
    binaryArtifact({
      id: "drawing-pdf",
      filename: pdf.filename,
      mediaType: "application/pdf",
      note: pdf.note,
      bytes: pdfBytes,
    }),
  ]);
  const body: Omit<ProjectRfqArtifactPackageV1, "packageHash"> = {
    format: PROJECT_RFQ_PACKAGE_FORMAT,
    version: PROJECT_RFQ_PACKAGE_VERSION,
    generator: "Aura Homes local RFQ packager",
    issuedAtISO: checked.rfq.createdAtISO,
    projectId: checked.rfq.projectId,
    rfqId: checked.rfq.id,
    designHash: checked.rfq.designHash,
    budgetHash: checked.rfq.budgetHash,
    rfqHash: checked.rfq.canonicalHash,
    schedule: {
      createdAtISO: checked.rfq.createdAtISO,
      responseDueISO: checked.rfq.responseDueISO,
    },
    rfq: checked.rfq,
    artifacts,
    manifest: manifestOf(artifacts),
    drawingWarnings: [...pdf.warnings],
  };
  const result: ProjectRfqArtifactPackageV1 = { ...body, packageHash: packageHashOf(body) };
  const content = canonicalJson(result);
  const artifact: ExportArtifact = {
    blob: new Blob([content], { type: "application/json" }),
    filename: `${prefix}.aura-rfq-package.json`,
    mimeType: "application/json",
    byteLength: textEncoder.encode(content).byteLength,
    note: `Complete local RFQ package · ${artifacts.length} artifacts · package hash ${result.packageHash}`,
  };
  return { package: result, artifact };
}

function readArtifact(value: unknown): ProjectRfqPackageArtifact | null {
  if (!isObject(value) || !ARTIFACT_IDS.includes(value.id as ProjectRfqPackageArtifactId)) return null;
  if (typeof value.filename !== "string" || typeof value.mediaType !== "string" || typeof value.note !== "string") return null;
  if (value.encoding !== "utf-8" && value.encoding !== "base64") return null;
  if (typeof value.byteLength !== "number" || !Number.isInteger(value.byteLength) || value.byteLength < 0) return null;
  if (typeof value.sha256 !== "string" || !SHA_256.test(value.sha256) || typeof value.content !== "string") return null;
  return value as unknown as ProjectRfqPackageArtifact;
}

function artifactBytes(artifact: ProjectRfqPackageArtifact): Uint8Array | null {
  return artifact.encoding === "utf-8" ? textEncoder.encode(artifact.content) : base64ToBytes(artifact.content);
}

export async function validateProjectRfqPackage(value: unknown): Promise<ProjectRfqPackageValidation> {
  if (!isObject(value) || value.format !== PROJECT_RFQ_PACKAGE_FORMAT) return { ok: false, problem: "RFQ package format is not supported." };
  if (typeof value.version === "number" && value.version > PROJECT_RFQ_PACKAGE_VERSION) {
    return { ok: false, problem: `This RFQ package was created by a newer version (v${value.version}).`, futureVersion: value.version };
  }
  if (value.version !== PROJECT_RFQ_PACKAGE_VERSION) return { ok: false, problem: "RFQ package version is not supported." };
  const checkedRfq = validateProjectRfq(value.rfq);
  if (!checkedRfq.ok) return { ok: false, problem: `Embedded RFQ is invalid: ${checkedRfq.problem}` };
  if (checkedRfq.rfq.version !== 2) return { ok: false, problem: "Embedded RFQ is a legacy version-one record." };
  const rfq = checkedRfq.rfq;
  if (value.projectId !== rfq.projectId || value.rfqId !== rfq.id || value.designHash !== rfq.designHash || value.budgetHash !== rfq.budgetHash || value.rfqHash !== rfq.canonicalHash) {
    return { ok: false, problem: "RFQ package identity or bound hashes do not match the embedded RFQ." };
  }
  if (!isObject(value.schedule) || value.schedule.createdAtISO !== rfq.createdAtISO || value.schedule.responseDueISO !== rfq.responseDueISO || value.issuedAtISO !== rfq.createdAtISO) {
    return { ok: false, problem: "RFQ package schedule does not match the embedded RFQ." };
  }
  if (!Array.isArray(value.artifacts) || value.artifacts.length !== ARTIFACT_IDS.length) {
    return { ok: false, problem: "RFQ package must contain exactly three artifacts." };
  }
  const artifacts = value.artifacts.map(readArtifact);
  if (artifacts.some((artifact) => artifact === null)) return { ok: false, problem: "RFQ package artifact metadata is invalid." };
  const typedArtifacts = artifacts as ProjectRfqPackageArtifact[];
  if (new Set(typedArtifacts.map((artifact) => artifact.id)).size !== ARTIFACT_IDS.length || ARTIFACT_IDS.some((id) => !typedArtifacts.some((artifact) => artifact.id === id))) {
    return { ok: false, problem: "RFQ package artifact ids are missing or duplicated." };
  }
  for (const artifact of typedArtifacts) {
    const bytes = artifactBytes(artifact);
    if (!bytes) return { ok: false, problem: `${artifact.id} base64 content is invalid.` };
    if (bytes.byteLength !== artifact.byteLength) return { ok: false, problem: `${artifact.id} byte length does not match its content.` };
    if (await sha256(bytes) !== artifact.sha256) return { ok: false, problem: `${artifact.id} SHA-256 does not match its content.` };
  }
  const rfqArtifact = typedArtifacts.find((artifact) => artifact.id === "rfq-json")!;
  if (rfqArtifact.encoding !== "utf-8" || rfqArtifact.mediaType !== "application/json" || rfqArtifact.content !== canonicalJson(rfq)) {
    return { ok: false, problem: "RFQ JSON artifact does not exactly reproduce the embedded RFQ." };
  }
  const quantitiesArtifact = typedArtifacts.find((artifact) => artifact.id === "quantities-json")!;
  if (quantitiesArtifact.encoding !== "utf-8" || quantitiesArtifact.mediaType !== "application/json") return { ok: false, problem: "Quantity artifact encoding is invalid." };
  try {
    const quantities = JSON.parse(quantitiesArtifact.content) as unknown;
    if (!isObject(quantities) || quantities.format !== "aura-rfq-quantity-schedule" || quantities.version !== 1 || quantities.projectId !== rfq.projectId || quantities.rfqId !== rfq.id || quantities.designHash !== rfq.designHash || quantities.budgetHash !== rfq.budgetHash || !Array.isArray(quantities.lines)) {
      return { ok: false, problem: "Quantity artifact is not bound to this RFQ and budget." };
    }
    const lineIds = new Set(rfq.budgetLines.map((line) => line.id));
    if (quantities.lines.length !== lineIds.size || quantities.lines.some((line) => !isObject(line) || !lineIds.has(String(line.id)))) {
      return { ok: false, problem: "Quantity artifact scope does not match the RFQ budget lines." };
    }
  } catch {
    return { ok: false, problem: "Quantity artifact JSON is unreadable." };
  }
  const pdfArtifact = typedArtifacts.find((artifact) => artifact.id === "drawing-pdf")!;
  const pdfBytes = artifactBytes(pdfArtifact)!;
  if (pdfArtifact.encoding !== "base64" || pdfArtifact.mediaType !== "application/pdf" || new TextDecoder().decode(pdfBytes.subarray(0, 5)) !== "%PDF-") {
    return { ok: false, problem: "Drawing artifact is not a valid PDF payload." };
  }
  if (!Array.isArray(value.manifest) || JSON.stringify(canonical(value.manifest)) !== JSON.stringify(canonical(manifestOf(typedArtifacts)))) {
    return { ok: false, problem: "RFQ package manifest does not match its artifacts." };
  }
  if (!Array.isArray(value.drawingWarnings) || value.drawingWarnings.some((warning) => typeof warning !== "string")) {
    return { ok: false, problem: "RFQ package drawing warnings are invalid." };
  }
  if (typeof value.packageHash !== "string" || !HEX_32.test(value.packageHash) || packageHashOf(value as unknown as ProjectRfqArtifactPackageV1) !== value.packageHash) {
    return { ok: false, problem: "RFQ package hash does not match its contents." };
  }
  return { ok: true, package: structuredClone(value) as unknown as ProjectRfqArtifactPackageV1 };
}
