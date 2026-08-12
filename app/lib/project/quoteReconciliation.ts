import type { ProjectBudget } from "../builder/projectBudget";

export const PROJECT_QUOTE_FORMAT = "aura-project-quote" as const;
export const PROJECT_QUOTE_VERSION = 1 as const;

export interface QuoteEvidence {
  name: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  dataUrl: string;
}

export interface ProjectQuoteLine {
  id: string;
  budgetLineId: string | null;
  description: string;
  amountCad: number;
  allowance: boolean;
}

export interface ProjectQuote {
  format: typeof PROJECT_QUOTE_FORMAT;
  version: typeof PROJECT_QUOTE_VERSION;
  id: string;
  vendorName: string;
  capturedAtISO: string;
  validUntilISO: string | null;
  currency: "CAD";
  designHash: `0x${string}`;
  modelTotalMidCad: number;
  evidence: QuoteEvidence | null;
  notes: string;
  lines: ProjectQuoteLine[];
}

export type ProjectQuoteValidation =
  | { ok: true; quote: ProjectQuote }
  | { ok: false; problem: string };

export interface QuoteReconciliation {
  quote: ProjectQuote;
  quotedTotalCad: number;
  coveredBudgetLineIds: string[];
  modelCoveredMidCad: number;
  varianceCad: number;
  variancePct: number | null;
  omittedBudgetLineIds: string[];
  unmappedLines: ProjectQuoteLine[];
  allowances: ProjectQuoteLine[];
  stale: boolean;
  designChanged: boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isISO = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function validateProjectQuote(value: unknown): ProjectQuoteValidation {
  if (!isObject(value)) return { ok: false, problem: "Quote is not an object." };
  if (value.format !== PROJECT_QUOTE_FORMAT || value.version !== PROJECT_QUOTE_VERSION)
    return { ok: false, problem: "Quote format or version is not supported." };
  if (typeof value.id !== "string" || !value.id.trim()) return { ok: false, problem: "Quote id is missing." };
  if (typeof value.vendorName !== "string" || !value.vendorName.trim()) return { ok: false, problem: "Vendor name is missing." };
  if (!isISO(value.capturedAtISO)) return { ok: false, problem: "Quote capture date is invalid." };
  if (value.validUntilISO !== null && !isISO(value.validUntilISO)) return { ok: false, problem: "Quote validity date is invalid." };
  if (value.currency !== "CAD") return { ok: false, problem: "Only CAD quotes are supported in the Alberta pilot." };
  if (typeof value.designHash !== "string" || !/^0x[a-f0-9]{64}$/i.test(value.designHash))
    return { ok: false, problem: "Quote design hash is invalid." };
  if (typeof value.modelTotalMidCad !== "number" || !Number.isFinite(value.modelTotalMidCad) || value.modelTotalMidCad < 0)
    return { ok: false, problem: "Quote budget basis is invalid." };
  if (typeof value.notes !== "string") return { ok: false, problem: "Quote notes are invalid." };
  if (value.evidence !== null) {
    if (!isObject(value.evidence)) return { ok: false, problem: "Quote evidence is invalid." };
    if (
      typeof value.evidence.name !== "string" ||
      typeof value.evidence.mediaType !== "string" ||
      typeof value.evidence.sizeBytes !== "number" ||
      !Number.isFinite(value.evidence.sizeBytes) ||
      value.evidence.sizeBytes < 0 ||
      typeof value.evidence.sha256 !== "string" ||
      !SHA256_HEX.test(value.evidence.sha256) ||
      typeof value.evidence.dataUrl !== "string" ||
      !value.evidence.dataUrl.startsWith("data:")
    ) return { ok: false, problem: "Quote evidence metadata or SHA-256 checksum is invalid." };
  }
  if (!Array.isArray(value.lines) || value.lines.length === 0) return { ok: false, problem: "Add at least one quote line." };
  const lineIds = new Set<string>();
  const lines: ProjectQuoteLine[] = [];
  for (const raw of value.lines) {
    if (!isObject(raw) || typeof raw.id !== "string" || !raw.id.trim() || lineIds.has(raw.id))
      return { ok: false, problem: "Quote line ids must be unique and non-empty." };
    if (raw.budgetLineId !== null && typeof raw.budgetLineId !== "string")
      return { ok: false, problem: "A quote line has an invalid Aura scope mapping." };
    if (typeof raw.description !== "string" || !raw.description.trim())
      return { ok: false, problem: "A quote line description is missing." };
    if (typeof raw.amountCad !== "number" || !Number.isFinite(raw.amountCad) || raw.amountCad < 0)
      return { ok: false, problem: "Quote line amounts must be positive CAD numbers." };
    if (typeof raw.allowance !== "boolean") return { ok: false, problem: "A quote allowance flag is invalid." };
    lineIds.add(raw.id);
    lines.push({
      id: raw.id,
      budgetLineId: raw.budgetLineId,
      description: raw.description.trim().slice(0, 240),
      amountCad: Math.round(raw.amountCad * 100) / 100,
      allowance: raw.allowance,
    });
  }
  return {
    ok: true,
    quote: {
      format: PROJECT_QUOTE_FORMAT,
      version: PROJECT_QUOTE_VERSION,
      id: value.id.trim().slice(0, 96),
      vendorName: value.vendorName.trim().slice(0, 160),
      capturedAtISO: value.capturedAtISO,
      validUntilISO: value.validUntilISO,
      currency: "CAD",
      designHash: value.designHash as `0x${string}`,
      modelTotalMidCad: Math.round(value.modelTotalMidCad * 100) / 100,
      evidence: value.evidence as QuoteEvidence | null,
      notes: value.notes.trim().slice(0, 4_000),
      lines,
    },
  };
}

export function projectQuotesFromUnknown(values: readonly unknown[]): ProjectQuote[] {
  return values.flatMap((value) => {
    const checked = validateProjectQuote(value);
    return checked.ok ? [checked.quote] : [];
  });
}

export function reconcileProjectQuote(
  budget: ProjectBudget,
  value: ProjectQuote,
  nowISO: string,
): QuoteReconciliation {
  const checked = validateProjectQuote(value);
  if (!checked.ok) throw new Error(`Cannot reconcile this quote: ${checked.problem}`);
  const quote = checked.quote;
  const knownBudgetIds = new Set(budget.lines.map((line) => line.id));
  const coveredBudgetLineIds = Array.from(new Set(
    quote.lines
      .map((line) => line.budgetLineId)
      .filter((id): id is string => id !== null && knownBudgetIds.has(id)),
  )).sort();
  const covered = new Set(coveredBudgetLineIds);
  const quotedTotalCad = Math.round(quote.lines.reduce((sum, line) => sum + line.amountCad, 0) * 100) / 100;
  const modelCoveredMidCad = budget.lines
    .filter((line) => covered.has(line.id))
    .reduce((sum, line) => sum + line.mid, 0);
  const varianceCad = Math.round((quotedTotalCad - modelCoveredMidCad) * 100) / 100;
  return {
    quote,
    quotedTotalCad,
    coveredBudgetLineIds,
    modelCoveredMidCad,
    varianceCad,
    variancePct: modelCoveredMidCad > 0 ? Math.round((varianceCad / modelCoveredMidCad) * 10_000) / 100 : null,
    omittedBudgetLineIds: budget.lines.map((line) => line.id).filter((id) => !covered.has(id)),
    unmappedLines: quote.lines.filter((line) => line.budgetLineId === null || !knownBudgetIds.has(line.budgetLineId)),
    allowances: quote.lines.filter((line) => line.allowance),
    stale: quote.validUntilISO !== null && Date.parse(nowISO) > Date.parse(quote.validUntilISO),
    designChanged: quote.designHash !== budget.designHash,
  };
}

export async function evidenceFromFile(file: File): Promise<QuoteEvidence> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Quote evidence must be 5 MB or smaller for local project storage.");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Quote file could not be read."));
    reader.onerror = () => reject(reader.error ?? new Error("Quote file could not be read."));
    reader.readAsDataURL(file);
  });
  return { name: file.name, mediaType: file.type || "application/octet-stream", sizeBytes: file.size, sha256, dataUrl };
}
