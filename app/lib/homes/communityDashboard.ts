import {
  HOMES_TRUTH_REGISTRY,
  HOMES_TRUTH_REGISTRY_VERSION,
  type HomesTruthStatus,
} from "./truthRegistry";

export const HOMES_COMMUNITY_DASHBOARD_VERSION = "homes-community-dashboard/v1" as const;
export const HOMES_DASHBOARD_EVIDENCE_VERSION = "homes-dashboard-evidence/v1" as const;

export const HOMES_USE_OF_FUNDS_CATEGORIES = [
  "property-acquisition",
  "design-and-diligence",
  "construction",
  "operations",
  "maintenance",
  "tax-and-legal",
  "community-reporting",
  "reserve",
] as const;

export type HomesUseOfFundsCategory = (typeof HOMES_USE_OF_FUNDS_CATEGORIES)[number];
type BalanceAccount = "aura-claim" | "treasury";
type EvidenceState = "receipt-attached" | "unverified-empty";

export interface HomesEvidenceReceipt {
  id: string;
  uri: string;
  transactionHash: string | null;
}

export interface HomesFeeEvidence {
  id: string;
  occurredAtISO: string;
  sourceId: string;
  ruleVersion: string;
  grossUsdMicros: string;
  providerUsdMicros: string;
  auraUsdMicros: string;
  receipt: HomesEvidenceReceipt;
}

export interface HomesClaimEvidence {
  id: string;
  occurredAtISO: string;
  sourceFeeIds: string[];
  destinationAddress: string;
  amountUsdMicros: string;
  receipt: HomesEvidenceReceipt;
}

export interface HomesTransferEvidence {
  id: string;
  occurredAtISO: string;
  fromAddress: string;
  toAddress: string;
  amountUsdMicros: string;
  receipt: HomesEvidenceReceipt;
}

export interface HomesUseEvidence {
  id: string;
  occurredAtISO: string;
  category: HomesUseOfFundsCategory;
  recipientId: string;
  amountUsdMicros: string;
  receipt: HomesEvidenceReceipt;
}

export interface HomesBalanceEvidence {
  id: string;
  occurredAtISO: string;
  account: BalanceAccount;
  address: string;
  amountUsdMicros: string;
  receipt: HomesEvidenceReceipt;
}

export interface HomesDashboardEvidenceBundle {
  schema: typeof HOMES_DASHBOARD_EVIDENCE_VERSION;
  asOfISO: string;
  fees: HomesFeeEvidence[];
  claims: HomesClaimEvidence[];
  transfers: HomesTransferEvidence[];
  useOfFunds: HomesUseEvidence[];
  balances: HomesBalanceEvidence[];
}

export interface HomesCommunityDashboard {
  schema: typeof HOMES_COMMUNITY_DASHBOARD_VERSION;
  evidenceAsOfISO: string;
  evidenceClassification: "receipt-attached-structural-only";
  status: "missing-evidence" | "structurally-reconciled";
  truthRegistry: {
    schema: typeof HOMES_TRUTH_REGISTRY_VERSION;
    asOfISO: string;
  };
  truthGaps: Array<{
    id: string;
    status: Extract<HomesTruthStatus, "unknown" | "not-established">;
    missingEvidence: string;
  }>;
  totals: {
    grossFeesUsdMicros: string;
    providerCostUsdMicros: string;
    auraShareUsdMicros: string;
    claimedToAuraUsdMicros: string;
    unclaimedAuraShareUsdMicros: string;
    transferredToTreasuryUsdMicros: string;
    treasurySpendUsdMicros: string;
    expectedAuraBalanceUsdMicros: string;
    expectedTreasuryBalanceUsdMicros: string;
  };
  totalsState: EvidenceState;
  balances: {
    aura: HomesDashboardBalance;
    treasury: HomesDashboardBalance;
  };
  useOfFunds: Array<{
    category: HomesUseOfFundsCategory;
    amountUsdMicros: string;
    evidenceState: EvidenceState;
  }>;
  activity: {
    fees: HomesFeeEvidence[];
    claims: HomesClaimEvidence[];
    transfers: HomesTransferEvidence[];
    useOfFunds: HomesUseEvidence[];
    balances: HomesBalanceEvidence[];
  };
  missingData: Array<{
    id: string;
    message: string;
  }>;
}

interface HomesDashboardBalance {
  status: "missing" | "reconciled";
  expectedUsdMicros: string;
  reportedUsdMicros: string | null;
  deltaUsdMicros: string | null;
  address: string | null;
  receipt: HomesEvidenceReceipt | null;
}

export class HomesDashboardError extends Error {
  readonly code = "invalid-evidence" as const;

  constructor() {
    super("The HOMES dashboard evidence is invalid.");
    this.name = "HomesDashboardError";
  }
}

type PlainRecord = Record<string, unknown>;

const ROOT_KEYS = ["schema", "asOfISO", "fees", "claims", "transfers", "useOfFunds", "balances"] as const;
const RECEIPT_KEYS = ["id", "uri", "transactionHash"] as const;
const FEE_KEYS = [
  "id",
  "occurredAtISO",
  "sourceId",
  "ruleVersion",
  "grossUsdMicros",
  "providerUsdMicros",
  "auraUsdMicros",
  "receipt",
] as const;
const CLAIM_KEYS = [
  "id",
  "occurredAtISO",
  "sourceFeeIds",
  "destinationAddress",
  "amountUsdMicros",
  "receipt",
] as const;
const TRANSFER_KEYS = [
  "id",
  "occurredAtISO",
  "fromAddress",
  "toAddress",
  "amountUsdMicros",
  "receipt",
] as const;
const USE_KEYS = [
  "id",
  "occurredAtISO",
  "category",
  "recipientId",
  "amountUsdMicros",
  "receipt",
] as const;
const BALANCE_KEYS = [
  "id",
  "occurredAtISO",
  "account",
  "address",
  "amountUsdMicros",
  "receipt",
] as const;

const MAX_ROWS_PER_SECTION = 500;
const MAX_SAFE_MICROS = BigInt(Number.MAX_SAFE_INTEGER);
const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
const TRANSACTION_PATTERN = /^0x[0-9a-f]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MICROS_PATTERN = /^(?:0|[1-9]\d{0,15})$/;

function fail(): never {
  throw new Error("invalid");
}

function isPlainRecord(value: unknown): value is PlainRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeDataCopy(value: unknown, seen = new Set<object>()): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail();
    return value;
  }
  if (typeof value !== "object") fail();

  const objectValue = value as object;
  if (seen.has(objectValue)) fail();
  seen.add(objectValue);
  try {
    let prototype: object | null;
    let keys: PropertyKey[];
    try {
      prototype = Reflect.getPrototypeOf(objectValue);
      keys = Reflect.ownKeys(objectValue);
    } catch {
      fail();
    }

    if (Array.isArray(objectValue)) {
      if (prototype !== Array.prototype) fail();
      const arrayValue = objectValue as unknown[];
      if (arrayValue.length > MAX_ROWS_PER_SECTION) fail();
      const allowed = new Set<PropertyKey>(["length", ...Array.from({ length: arrayValue.length }, (_, index) => String(index))]);
      if (keys.some((key) => typeof key === "symbol" || !allowed.has(key))) fail();
      const copy: unknown[] = [];
      for (let index = 0; index < arrayValue.length; index += 1) {
        const descriptor = Reflect.getOwnPropertyDescriptor(objectValue, String(index));
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) fail();
        copy.push(safeDataCopy(descriptor.value, seen));
      }
      return copy;
    }

    if (prototype !== Object.prototype && prototype !== null) fail();
    if (keys.some((key) => typeof key === "symbol")) fail();
    const copy: PlainRecord = {};
    for (const key of keys as string[]) {
      const descriptor = Reflect.getOwnPropertyDescriptor(objectValue, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) fail();
      copy[key] = safeDataCopy(descriptor.value, seen);
    }
    return copy;
  } finally {
    seen.delete(objectValue);
  }
}

function exactRecord(value: unknown, keys: readonly string[]): PlainRecord {
  if (!isPlainRecord(value)) fail();
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail();
  return value;
}

function exactArray(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_ROWS_PER_SECTION) fail();
  return value;
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) fail();
  return value;
}

function address(value: unknown): string {
  if (typeof value !== "string" || !ADDRESS_PATTERN.test(value)) fail();
  return value;
}

function isoDate(value: unknown, latest?: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) fail();
  const millis = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== value) fail();
  if (latest !== undefined && value > latest) fail();
  return value;
}

function micros(value: unknown): bigint {
  if (typeof value !== "string" || !MICROS_PATTERN.test(value)) fail();
  const parsed = BigInt(value);
  if (parsed > MAX_SAFE_MICROS) fail();
  return parsed;
}

function receipt(value: unknown, identities: Set<string>, transactions: Set<string>): HomesEvidenceReceipt {
  const row = exactRecord(value, RECEIPT_KEYS);
  const id = identifier(row.id);
  if (identities.has(id)) fail();
  identities.add(id);
  if (typeof row.uri !== "string" || row.uri.length > 500 || !/^https:\/\/[^\s]+$/.test(row.uri)) fail();
  let transactionHash: string | null = null;
  if (row.transactionHash !== null) {
    if (typeof row.transactionHash !== "string" || !TRANSACTION_PATTERN.test(row.transactionHash)) fail();
    transactionHash = row.transactionHash;
    if (transactions.has(transactionHash)) fail();
    transactions.add(transactionHash);
  }
  if (row.uri.length === 0 && transactionHash === null) fail();
  return { id, uri: row.uri, transactionHash };
}

function uniqueEventId(value: unknown, ids: Set<string>): string {
  const id = identifier(value);
  if (ids.has(id)) fail();
  ids.add(id);
  return id;
}

function stableRows<T extends { id: string; occurredAtISO: string }>(rows: T[]): T[] {
  return rows.sort((left, right) =>
    left.occurredAtISO.localeCompare(right.occurredAtISO) || left.id.localeCompare(right.id),
  );
}

function parseEvidence(candidate: unknown): HomesDashboardEvidenceBundle {
  const copied = safeDataCopy(candidate);
  const root = exactRecord(copied, ROOT_KEYS);
  if (root.schema !== HOMES_DASHBOARD_EVIDENCE_VERSION) fail();
  const asOfISO = isoDate(root.asOfISO);
  if (asOfISO < HOMES_TRUTH_REGISTRY.asOfISO) fail();

  const eventIds = new Set<string>();
  const receiptIds = new Set<string>();
  const transactions = new Set<string>();

  const fees = exactArray(root.fees).map((value): HomesFeeEvidence => {
    const row = exactRecord(value, FEE_KEYS);
    const gross = micros(row.grossUsdMicros);
    const provider = micros(row.providerUsdMicros);
    const aura = micros(row.auraUsdMicros);
    if (gross !== provider + aura) fail();
    return {
      id: uniqueEventId(row.id, eventIds),
      occurredAtISO: isoDate(row.occurredAtISO, asOfISO),
      sourceId: identifier(row.sourceId),
      ruleVersion: identifier(row.ruleVersion),
      grossUsdMicros: gross.toString(),
      providerUsdMicros: provider.toString(),
      auraUsdMicros: aura.toString(),
      receipt: receipt(row.receipt, receiptIds, transactions),
    };
  });

  const claims = exactArray(root.claims).map((value): HomesClaimEvidence => {
    const row = exactRecord(value, CLAIM_KEYS);
    const sourceFeeIds = exactArray(row.sourceFeeIds).map(identifier);
    if (sourceFeeIds.length === 0 || new Set(sourceFeeIds).size !== sourceFeeIds.length) fail();
    return {
      id: uniqueEventId(row.id, eventIds),
      occurredAtISO: isoDate(row.occurredAtISO, asOfISO),
      sourceFeeIds: [...sourceFeeIds].sort(),
      destinationAddress: address(row.destinationAddress),
      amountUsdMicros: micros(row.amountUsdMicros).toString(),
      receipt: receipt(row.receipt, receiptIds, transactions),
    };
  });

  const transfers = exactArray(root.transfers).map((value): HomesTransferEvidence => {
    const row = exactRecord(value, TRANSFER_KEYS);
    return {
      id: uniqueEventId(row.id, eventIds),
      occurredAtISO: isoDate(row.occurredAtISO, asOfISO),
      fromAddress: address(row.fromAddress),
      toAddress: address(row.toAddress),
      amountUsdMicros: micros(row.amountUsdMicros).toString(),
      receipt: receipt(row.receipt, receiptIds, transactions),
    };
  });

  const useOfFunds = exactArray(root.useOfFunds).map((value): HomesUseEvidence => {
    const row = exactRecord(value, USE_KEYS);
    if (!HOMES_USE_OF_FUNDS_CATEGORIES.includes(row.category as HomesUseOfFundsCategory)) fail();
    return {
      id: uniqueEventId(row.id, eventIds),
      occurredAtISO: isoDate(row.occurredAtISO, asOfISO),
      category: row.category as HomesUseOfFundsCategory,
      recipientId: identifier(row.recipientId),
      amountUsdMicros: micros(row.amountUsdMicros).toString(),
      receipt: receipt(row.receipt, receiptIds, transactions),
    };
  });

  const balances = exactArray(root.balances).map((value): HomesBalanceEvidence => {
    const row = exactRecord(value, BALANCE_KEYS);
    if (row.account !== "aura-claim" && row.account !== "treasury") fail();
    return {
      id: uniqueEventId(row.id, eventIds),
      occurredAtISO: isoDate(row.occurredAtISO, asOfISO),
      account: row.account,
      address: address(row.address),
      amountUsdMicros: micros(row.amountUsdMicros).toString(),
      receipt: receipt(row.receipt, receiptIds, transactions),
    };
  });

  return {
    schema: HOMES_DASHBOARD_EVIDENCE_VERSION,
    asOfISO,
    fees: stableRows(fees),
    claims: stableRows(claims),
    transfers: stableRows(transfers),
    useOfFunds: stableRows(useOfFunds),
    balances: stableRows(balances),
  };
}

function total<T>(rows: readonly T[], select: (row: T) => string): bigint {
  return rows.reduce((sum, row) => sum + BigInt(select(row)), BigInt(0));
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function dashboardFromEvidence(evidence: HomesDashboardEvidenceBundle): HomesCommunityDashboard {
  const feeById = new Map(evidence.fees.map((row) => [row.id, row] as const));
  const claimedFeeIds = new Set<string>();
  let auraAddress: string | null = null;
  for (const claim of evidence.claims) {
    const available = claim.sourceFeeIds.reduce((sum, feeId) => {
      const fee = feeById.get(feeId);
      if (fee === undefined || claimedFeeIds.has(feeId)) fail();
      if (fee.occurredAtISO > claim.occurredAtISO) fail();
      claimedFeeIds.add(feeId);
      return sum + BigInt(fee.auraUsdMicros);
    }, BigInt(0));
    if (BigInt(claim.amountUsdMicros) > available) fail();
    if (auraAddress !== null && claim.destinationAddress !== auraAddress) fail();
    auraAddress = claim.destinationAddress;
  }

  let treasuryAddress: string | null = null;
  let transferredThroughDate = BigInt(0);
  for (const transfer of evidence.transfers) {
    if (auraAddress === null || transfer.fromAddress !== auraAddress) fail();
    if (treasuryAddress !== null && transfer.toAddress !== treasuryAddress) fail();
    transferredThroughDate += BigInt(transfer.amountUsdMicros);
    const claimedThroughDate = evidence.claims
      .filter((claim) => claim.occurredAtISO <= transfer.occurredAtISO)
      .reduce((sum, claim) => sum + BigInt(claim.amountUsdMicros), BigInt(0));
    if (transferredThroughDate > claimedThroughDate) fail();
    treasuryAddress = transfer.toAddress;
  }

  let spentThroughDate = BigInt(0);
  for (const use of evidence.useOfFunds) {
    spentThroughDate += BigInt(use.amountUsdMicros);
    const transferredByDate = evidence.transfers
      .filter((transfer) => transfer.occurredAtISO <= use.occurredAtISO)
      .reduce((sum, transfer) => sum + BigInt(transfer.amountUsdMicros), BigInt(0));
    if (spentThroughDate > transferredByDate) fail();
  }

  const grossFees = total(evidence.fees, (row) => row.grossUsdMicros);
  const providerCost = total(evidence.fees, (row) => row.providerUsdMicros);
  const auraShare = total(evidence.fees, (row) => row.auraUsdMicros);
  const claimed = total(evidence.claims, (row) => row.amountUsdMicros);
  const transferred = total(evidence.transfers, (row) => row.amountUsdMicros);
  const spent = total(evidence.useOfFunds, (row) => row.amountUsdMicros);
  if (grossFees !== providerCost + auraShare || claimed > auraShare || transferred > claimed || spent > transferred) fail();

  const expectedAura = claimed - transferred;
  const expectedTreasury = transferred - spent;
  const auraReports = evidence.balances.filter((row) => row.account === "aura-claim");
  const treasuryReports = evidence.balances.filter((row) => row.account === "treasury");
  if (auraReports.length > 1 || treasuryReports.length > 1) fail();
  const auraReport = auraReports[0] ?? null;
  const treasuryReport = treasuryReports[0] ?? null;
  if (evidence.balances.some((report) => report.occurredAtISO !== evidence.asOfISO)) fail();
  if (auraReport !== null && (auraAddress === null || auraReport.address !== auraAddress || BigInt(auraReport.amountUsdMicros) !== expectedAura)) fail();
  if (treasuryReport !== null && (treasuryAddress === null || treasuryReport.address !== treasuryAddress || BigInt(treasuryReport.amountUsdMicros) !== expectedTreasury)) fail();

  const missingData: HomesCommunityDashboard["missingData"] = [];
  if (evidence.fees.length === 0) missingData.push({ id: "fee-activity", message: "No sourced fee activity is attached." });
  if (evidence.claims.length === 0) missingData.push({ id: "fee-claims", message: "No fee-claim receipt is attached." });
  if (evidence.transfers.length === 0) missingData.push({ id: "treasury-transfers", message: "No transfer into a treasury is attached." });
  if (evidence.useOfFunds.length === 0) missingData.push({ id: "use-of-funds", message: "No use-of-funds receipt is attached." });
  if (auraReport === null) missingData.push({ id: "aura-balance", message: "No independent Aura claim-account balance is attached." });
  if (treasuryReport === null) missingData.push({ id: "treasury-balance", message: "No independent treasury balance is attached." });

  const categoryTotals = new Map<HomesUseOfFundsCategory, bigint>(
    HOMES_USE_OF_FUNDS_CATEGORIES.map((category) => [category, BigInt(0)]),
  );
  for (const row of evidence.useOfFunds) {
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? BigInt(0)) + BigInt(row.amountUsdMicros));
  }

  const truthGaps = HOMES_TRUTH_REGISTRY.claims
    .filter((claim): claim is typeof claim & { status: "unknown" | "not-established"; missingEvidence: string } =>
      (claim.status === "unknown" || claim.status === "not-established") && claim.missingEvidence !== null,
    )
    .map((claim) => ({ id: claim.id, status: claim.status, missingEvidence: claim.missingEvidence }))
    .sort((left, right) => left.id.localeCompare(right.id));

  const totalsState: EvidenceState = grossFees > BigInt(0) || claimed > BigInt(0) || transferred > BigInt(0) || spent > BigInt(0)
    ? "receipt-attached"
    : "unverified-empty";

  const balance = (
    report: HomesBalanceEvidence | null,
    expected: bigint,
    expectedAddress: string | null,
  ): HomesDashboardBalance => report === null
    ? {
        status: "missing",
        expectedUsdMicros: expected.toString(),
        reportedUsdMicros: null,
        deltaUsdMicros: null,
        address: expectedAddress,
        receipt: null,
      }
    : {
        status: "reconciled",
        expectedUsdMicros: expected.toString(),
        reportedUsdMicros: report.amountUsdMicros,
        deltaUsdMicros: "0",
        address: report.address,
        receipt: { ...report.receipt },
      };

  return deepFreeze({
    schema: HOMES_COMMUNITY_DASHBOARD_VERSION,
    evidenceAsOfISO: evidence.asOfISO,
    evidenceClassification: "receipt-attached-structural-only",
    status: missingData.length === 0 ? "structurally-reconciled" : "missing-evidence",
    truthRegistry: {
      schema: HOMES_TRUTH_REGISTRY_VERSION,
      asOfISO: HOMES_TRUTH_REGISTRY.asOfISO,
    },
    truthGaps,
    totals: {
      grossFeesUsdMicros: grossFees.toString(),
      providerCostUsdMicros: providerCost.toString(),
      auraShareUsdMicros: auraShare.toString(),
      claimedToAuraUsdMicros: claimed.toString(),
      unclaimedAuraShareUsdMicros: (auraShare - claimed).toString(),
      transferredToTreasuryUsdMicros: transferred.toString(),
      treasurySpendUsdMicros: spent.toString(),
      expectedAuraBalanceUsdMicros: expectedAura.toString(),
      expectedTreasuryBalanceUsdMicros: expectedTreasury.toString(),
    },
    totalsState,
    balances: {
      aura: balance(auraReport, expectedAura, auraAddress),
      treasury: balance(treasuryReport, expectedTreasury, treasuryAddress),
    },
    useOfFunds: HOMES_USE_OF_FUNDS_CATEGORIES.map((category) => {
      const amount = categoryTotals.get(category) ?? BigInt(0);
      return {
        category,
        amountUsdMicros: amount.toString(),
        evidenceState: amount > BigInt(0) ? "receipt-attached" : "unverified-empty",
      };
    }),
    activity: {
      fees: evidence.fees.map((row) => ({ ...row, receipt: { ...row.receipt } })),
      claims: evidence.claims.map((row) => ({ ...row, sourceFeeIds: [...row.sourceFeeIds], receipt: { ...row.receipt } })),
      transfers: evidence.transfers.map((row) => ({ ...row, receipt: { ...row.receipt } })),
      useOfFunds: evidence.useOfFunds.map((row) => ({ ...row, receipt: { ...row.receipt } })),
      balances: evidence.balances.map((row) => ({ ...row, receipt: { ...row.receipt } })),
    },
    missingData,
  });
}

export function buildHomesCommunityDashboard(evidenceCandidate: unknown): HomesCommunityDashboard {
  try {
    return dashboardFromEvidence(parseEvidence(evidenceCandidate));
  } catch {
    throw new HomesDashboardError();
  }
}

export function currentHomesCommunityDashboard(): HomesCommunityDashboard {
  return buildHomesCommunityDashboard({
    schema: HOMES_DASHBOARD_EVIDENCE_VERSION,
    asOfISO: HOMES_TRUTH_REGISTRY.asOfISO,
    fees: [],
    claims: [],
    transfers: [],
    useOfFunds: [],
    balances: [],
  });
}
