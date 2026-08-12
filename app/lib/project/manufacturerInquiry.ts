import { keccak256, stringToHex } from "viem";
import type { Provider } from "@/components/buy/data";
import type {
  ProviderPurchaseReadiness,
  PurchaseProduct,
  TargetRegion,
} from "../marketplace/buyReadiness";
import { validateAuraProject, type AuraProject } from "./document";

export interface ManufacturerInquiry {
  format: "aura-manufacturer-inquiry";
  version: 1;
  id: string;
  projectId: string;
  createdAtISO: string;
  providerSubjectId: string;
  providerName: string;
  providerUrl: string;
  product: PurchaseProduct;
  destination: TargetRegion;
  designHash: `0x${string}`;
  designSummary: { homeName: string; material: string };
  evidence: {
    tier: string;
    sourceUrl: string;
    checkedAtISO: string;
    quotedClaim: string;
  };
  readinessScore: number;
  readinessVerdict: ProviderPurchaseReadiness["verdict"];
  requestedAnswers: string[];
  assumptions: string[];
  warnings: string[];
  canonicalHash: `0x${string}`;
}

interface InquiryInput {
  id: string;
  project: AuraProject;
  provider: Provider;
  readiness: ProviderPurchaseReadiness;
  targetRegion: TargetRegion;
  product: PurchaseProduct;
  createdAtISO: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validISO = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));
const validDestination = (value: unknown): value is TargetRegion =>
  ["any", "canada", "united-states", "europe", "uae", "japan", "other"].includes(String(value));
const stable = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}
function digest(value: Omit<ManufacturerInquiry, "canonicalHash">): `0x${string}` {
  return keccak256(stringToHex(JSON.stringify(canonical(value))));
}

export function manufacturerSubjectId(provider: Pick<Provider, "name" | "country">): string {
  return `manufacturer-${stable(`${provider.name}-${provider.country}`)}`;
}

export function createManufacturerInquiry(input: InquiryInput): ManufacturerInquiry {
  const project = validateAuraProject(input.project);
  if (!project.ok) throw new Error(`Cannot prepare manufacturer inquiry: ${project.problem}`);
  if (!validISO(input.createdAtISO)) throw new Error("Manufacturer inquiry date is invalid.");
  if (!validDestination(input.targetRegion)) throw new Error("Manufacturer inquiry destination is invalid.");
  if (input.readiness.providerName !== input.provider.name)
    throw new Error("Manufacturer readiness does not belong to the selected provider.");
  const draft: Omit<ManufacturerInquiry, "canonicalHash"> = {
    format: "aura-manufacturer-inquiry",
    version: 1,
    id: input.id,
    projectId: project.project.id,
    createdAtISO: input.createdAtISO,
    providerSubjectId: manufacturerSubjectId(input.provider),
    providerName: input.provider.name,
    providerUrl: input.provider.url,
    product: input.product,
    destination: input.targetRegion,
    designHash: project.project.design.documentHash,
    designSummary: {
      homeName: project.project.design.document.spec.name,
      material: project.project.design.document.spec.material,
    },
    evidence: {
      tier: input.provider.evidenceTier,
      sourceUrl: input.provider.evidenceUrl,
      checkedAtISO: input.provider.evidenceCheckedAtISO,
      quotedClaim: input.provider.quote,
    },
    readinessScore: input.readiness.score,
    readinessVerdict: input.readiness.verdict,
    requestedAnswers: [
      "Current model availability, written CAD quote and quote expiry",
      "Destination eligibility, shipping origin, freight basis, route constraints and import responsibilities",
      "Foundation, assembly, commissioning and site-work scope with explicit exclusions",
      "Certifications claimed, documents supplied and the local authority acceptance path",
      "Warranty, service coverage, spare parts, lead time and cancellation terms",
      "Cash/card payment instructions and any supported crypto asset, network, recipient and processor",
    ],
    assumptions: [
      `The project destination filter is ${input.targetRegion}; no availability is inferred beyond provider evidence.`,
      `The requested product filter is ${input.product}; the provider must identify the exact model being quoted.`,
      "Aura prepares this inquiry but does not send it, broker a sale, verify a manufacturer or hold funds.",
    ],
    warnings: input.readiness.contributions.filter((item) => item.state !== "confirmed").map((item) => item.detail),
  };
  return { ...draft, canonicalHash: digest(draft) };
}

export function validateManufacturerInquiry(value: unknown):
  | { ok: true; inquiry: ManufacturerInquiry }
  | { ok: false; problem: string } {
  if (!isObject(value) || value.format !== "aura-manufacturer-inquiry" || value.version !== 1)
    return { ok: false, problem: "Manufacturer inquiry format is not supported." };
  if (typeof value.id !== "string" || typeof value.projectId !== "string" || typeof value.providerSubjectId !== "string")
    return { ok: false, problem: "Manufacturer inquiry identity is invalid." };
  if (!validISO(value.createdAtISO)) return { ok: false, problem: "Manufacturer inquiry date is invalid." };
  if (typeof value.designHash !== "string" || !/^0x[a-f0-9]{64}$/i.test(value.designHash))
    return { ok: false, problem: "Manufacturer inquiry design hash is invalid." };
  if (!Array.isArray(value.requestedAnswers) || value.requestedAnswers.length === 0 || !Array.isArray(value.assumptions) || !Array.isArray(value.warnings))
    return { ok: false, problem: "Manufacturer inquiry questions or disclosures are incomplete." };
  if (typeof value.canonicalHash !== "string" || !/^0x[a-f0-9]{64}$/i.test(value.canonicalHash))
    return { ok: false, problem: "Manufacturer inquiry hash is invalid." };
  const { canonicalHash, ...draft } = value as unknown as ManufacturerInquiry;
  if (digest(draft) !== canonicalHash) return { ok: false, problem: "Manufacturer inquiry hash does not match its contents." };
  return { ok: true, inquiry: structuredClone(value) as unknown as ManufacturerInquiry };
}
