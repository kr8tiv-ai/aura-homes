import { sha256, toHex } from "viem";
import {
  diagnoseProjectBudgetBasis,
  type ProjectBudget,
  type ProjectBudgetBasisChange,
  type ProjectBudgetScenario,
} from "../builder/projectBudget";
import type { ProjectRfq } from "./rfq";

export const PROJECT_QUOTE_FORMAT = "aura-project-quote" as const;
export const PROJECT_QUOTE_VERSION = 3 as const;

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

interface ProjectQuoteBase {
  format: typeof PROJECT_QUOTE_FORMAT;
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

export interface LegacyProjectQuote extends ProjectQuoteBase {
  version: 1;
}

export interface ProjectQuoteV2 extends ProjectQuoteBase {
  version: 2;
  budgetHash: `0x${string}`;
  budgetBasis: {
    region: string;
    municipality: string;
    scenario: ProjectBudgetScenario;
    budgetCapCad: number | null;
  };
}

export interface ProjectQuoteV3 extends Omit<ProjectQuoteV2, "version"> {
  version: typeof PROJECT_QUOTE_VERSION;
  rfqId: string | null;
  rfqHash: `0x${string}` | null;
}

export type ProjectQuote = LegacyProjectQuote | ProjectQuoteV2 | ProjectQuoteV3;

export type ProjectQuoteValidation =
  | { ok: true; quote: ProjectQuote }
  | { ok: false; problem: string; futureVersion?: number };

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
  budgetChanged: boolean | null;
  basisState: "current" | "changed" | "legacy-unbound";
  basisChanges: ProjectBudgetBasisChange[];
  rfqLinkState: "matched" | "not-linked" | "missing" | "changed" | "legacy-unbound";
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isISO = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const SHA256_HEX = /^[a-f0-9]{64}$/i;
const HASH_HEX = /^0x[a-f0-9]{64}$/i;

export function validateProjectQuote(value: unknown): ProjectQuoteValidation {
  if (!isObject(value)) return { ok: false, problem: "Quote is not an object." };
  if (value.format !== PROJECT_QUOTE_FORMAT) return { ok: false, problem: "Quote format is not supported." };
  if (typeof value.version === "number" && value.version > PROJECT_QUOTE_VERSION) {
    return { ok: false, problem: `This quote was captured by a newer version (v${value.version}).`, futureVersion: value.version };
  }
  if (value.version !== 1 && value.version !== 2 && value.version !== PROJECT_QUOTE_VERSION) return { ok: false, problem: "Quote version is not supported." };
  if (typeof value.id !== "string" || !value.id.trim()) return { ok: false, problem: "Quote id is missing." };
  if (typeof value.vendorName !== "string" || !value.vendorName.trim()) return { ok: false, problem: "Vendor name is missing." };
  if (!isISO(value.capturedAtISO)) return { ok: false, problem: "Quote capture date is invalid." };
  if (value.validUntilISO !== null && !isISO(value.validUntilISO)) return { ok: false, problem: "Quote validity date is invalid." };
  if (value.currency !== "CAD") return { ok: false, problem: "Only CAD quotes are supported in the Alberta pilot." };
  if (typeof value.designHash !== "string" || !HASH_HEX.test(value.designHash)) return { ok: false, problem: "Quote design hash is invalid." };
  if (typeof value.modelTotalMidCad !== "number" || !Number.isFinite(value.modelTotalMidCad) || value.modelTotalMidCad < 0) return { ok: false, problem: "Quote budget basis is invalid." };
  if (typeof value.notes !== "string") return { ok: false, problem: "Quote notes are invalid." };
  if (value.evidence !== null && !validEvidence(value.evidence)) return { ok: false, problem: "Quote evidence metadata or SHA-256 checksum is invalid." };
  if (!Array.isArray(value.lines) || value.lines.length === 0) return { ok: false, problem: "Add at least one quote line." };

  let budgetHash: `0x${string}` | null = null;
  let budgetBasis: ProjectQuoteV2["budgetBasis"] | null = null;
  if (value.version === 2 || value.version === PROJECT_QUOTE_VERSION) {
    if (typeof value.budgetHash !== "string" || !HASH_HEX.test(value.budgetHash)) return { ok: false, problem: "Quote budget hash is invalid." };
    if (!isObject(value.budgetBasis) || typeof value.budgetBasis.region !== "string" || typeof value.budgetBasis.municipality !== "string" || !validScenario(value.budgetBasis.scenario)) return { ok: false, problem: "Quote planning scenario is invalid." };
    if (value.budgetBasis.budgetCapCad !== null && !(typeof value.budgetBasis.budgetCapCad === "number" && Number.isFinite(value.budgetBasis.budgetCapCad) && value.budgetBasis.budgetCapCad >= 0)) return { ok: false, problem: "Quote budget cap is invalid." };
    budgetHash = value.budgetHash as `0x${string}`;
    budgetBasis = {
      region: value.budgetBasis.region,
      municipality: value.budgetBasis.municipality,
      scenario: structuredClone(value.budgetBasis.scenario) as ProjectBudgetScenario,
      budgetCapCad: value.budgetBasis.budgetCapCad as number | null,
    };
  }

  let rfqId: string | null = null;
  let rfqHash: `0x${string}` | null = null;
  if (value.version === PROJECT_QUOTE_VERSION) {
    const bothNull = value.rfqId === null && value.rfqHash === null;
    const bothBound = typeof value.rfqId === "string" && value.rfqId.trim().length > 0
      && typeof value.rfqHash === "string" && HASH_HEX.test(value.rfqHash);
    if (!bothNull && !bothBound) return { ok: false, problem: "Quote RFQ id and hash must either both be present or both be null." };
    if (bothBound) {
      rfqId = (value.rfqId as string).trim().slice(0, 96);
      rfqHash = value.rfqHash as `0x${string}`;
    }
  }

  const lineIds = new Set<string>();
  const lines: ProjectQuoteLine[] = [];
  for (const raw of value.lines) {
    if (!isObject(raw) || typeof raw.id !== "string" || !raw.id.trim() || lineIds.has(raw.id)) return { ok: false, problem: "Quote line ids must be unique and non-empty." };
    if (raw.budgetLineId !== null && typeof raw.budgetLineId !== "string") return { ok: false, problem: "A quote line has an invalid Aura scope mapping." };
    if (typeof raw.description !== "string" || !raw.description.trim()) return { ok: false, problem: "A quote line description is missing." };
    if (typeof raw.amountCad !== "number" || !Number.isFinite(raw.amountCad) || raw.amountCad < 0) return { ok: false, problem: "Quote line amounts must be positive CAD numbers." };
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

  const base: ProjectQuoteBase = {
    format: PROJECT_QUOTE_FORMAT,
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
  };
  if (value.version === 1) return { ok: true, quote: { ...base, version: 1 } };
  if (value.version === 2) return { ok: true, quote: { ...base, version: 2, budgetHash: budgetHash!, budgetBasis: budgetBasis! } };
  return { ok: true, quote: { ...base, version: PROJECT_QUOTE_VERSION, budgetHash: budgetHash!, budgetBasis: budgetBasis!, rfqId, rfqHash } };
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
  rfqs: readonly ProjectRfq[] = [],
): QuoteReconciliation {
  const checked = validateProjectQuote(value);
  if (!checked.ok) throw new Error(`Cannot reconcile this quote: ${checked.problem}`);
  const quote = checked.quote;
  const diagnostic = quote.version === 1
    ? diagnoseProjectBudgetBasis(null, budget)
    : diagnoseProjectBudgetBasis({
        designHash: quote.designHash,
        budgetHash: quote.budgetHash,
        region: quote.budgetBasis.region,
        municipality: quote.budgetBasis.municipality,
        scenario: quote.budgetBasis.scenario,
        budgetCapCad: quote.budgetBasis.budgetCapCad,
      }, budget);
  const knownBudgetIds = new Set(budget.lines.map((line) => line.id));
  const coveredBudgetLineIds = Array.from(new Set(
    quote.lines
      .map((line) => line.budgetLineId)
      .filter((id): id is string => id !== null && knownBudgetIds.has(id)),
  )).sort();
  const covered = new Set(coveredBudgetLineIds);
  const quotedTotalCad = Math.round(quote.lines.reduce((sum, line) => sum + line.amountCad, 0) * 100) / 100;
  const modelCoveredMidCad = budget.lines.filter((line) => covered.has(line.id)).reduce((sum, line) => sum + line.mid, 0);
  const varianceCad = Math.round((quotedTotalCad - modelCoveredMidCad) * 100) / 100;
  const rfqLinkState = quote.version === 1 || quote.version === 2
    ? "legacy-unbound"
    : quote.rfqId === null
      ? "not-linked"
      : (() => {
          const linked = rfqs.find((rfq) => rfq.id === quote.rfqId);
          if (!linked) return "missing";
          return linked.canonicalHash === quote.rfqHash ? "matched" : "changed";
        })();
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
    budgetChanged: quote.version === 1 ? null : quote.budgetHash !== budget.budgetHash,
    basisState: diagnostic.state,
    basisChanges: diagnostic.changes,
    rfqLinkState,
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

function validEvidence(value: unknown): value is QuoteEvidence {
  if (!isObject(value)
    || typeof value.name !== "string"
    || typeof value.mediaType !== "string"
    || typeof value.sizeBytes !== "number" || !Number.isInteger(value.sizeBytes) || value.sizeBytes < 0
    || typeof value.sha256 !== "string" || !SHA256_HEX.test(value.sha256)
    || typeof value.dataUrl !== "string") return false;
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(value.dataUrl);
  if (!match || match[1] !== value.mediaType || match[2] !== ";base64") return false;
  try {
    const binary = atob(match[3]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return bytes.byteLength === value.sizeBytes && sha256(toHex(bytes)).slice(2) === value.sha256.toLowerCase();
  } catch {
    return false;
  }
}

function validScenario(value: unknown): value is ProjectBudgetScenario {
  return isObject(value)
    && ["unknown", "serviced-flat", "rural-flat", "sloped", "remote"].includes(String(value.site))
    && ["serviced", "hybrid", "off-grid"].includes(String(value.utilities))
    && ["essential", "standard", "elevated"].includes(String(value.finish))
    && ["owner-builder", "hybrid", "full-service"].includes(String(value.delivery))
    && typeof value.shippingDistanceKm === "number" && Number.isFinite(value.shippingDistanceKm) && value.shippingDistanceKm >= 0
    && typeof value.contingencyPct === "number" && Number.isFinite(value.contingencyPct) && value.contingencyPct >= 0
    && (value.salesTaxPct === undefined || (typeof value.salesTaxPct === "number" && Number.isFinite(value.salesTaxPct) && value.salesTaxPct >= 0 && value.salesTaxPct <= 25));
}
