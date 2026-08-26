import mintVerification from "@data/homes/mint-verification.json";
import {
  HOMES_CREATOR_WALLET,
  HOMES_LAUNCHED_ISO,
  HOMES_LOCKER_ADDRESS,
  HOMES_POOL_ADDRESS,
  HOMES_QUOTE_ASSET,
  HOMES_TOKEN_ADDRESS,
  HOMES_TOKEN_CHAIN_ID,
  XLAUNCH_CREATOR_FEE_SHARE_PERCENT,
  XLAUNCH_SWAP_FEE_PERCENT,
  XLAUNCH_TOKEN_URL,
} from "./token";

export const HOMES_TRUTH_REGISTRY_VERSION = "homes-truth-registry/v1" as const;
const HOMES_TRUTH_REGISTRY_AS_OF = "2026-08-25" as const;
const HOMES_MAINNET_RPC = "https://rpc.xlayer.tech" as const;
const EXPECTED_MINT_BLOCK = 68_444_752;
const EXPECTED_MINT_VERIFIED_AT = "2026-08-20T08:16:30.242Z" as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inspectJsonValue(
  value: unknown,
  pathLabel: string,
  errors: string[],
  seen = new Set<object>(),
): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${pathLabel} contains a non-finite number`);
    return value;
  }
  if (typeof value !== "object") {
    errors.push(`${pathLabel} contains a non-JSON value`);
    return undefined;
  }

  let isArray: boolean;
  let prototype: object | null;
  let descriptors: Record<PropertyKey, PropertyDescriptor>;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<PropertyKey, PropertyDescriptor>;
  } catch {
    errors.push(`${pathLabel} cannot be inspected safely`);
    return undefined;
  }
  if (seen.has(value)) {
    errors.push(`${pathLabel} contains a cycle`);
    return undefined;
  }
  seen.add(value);

  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some((key) => typeof key === "symbol")) {
    errors.push(`${pathLabel} contains symbol keys`);
  }
  if (prototype !== (isArray ? Array.prototype : Object.prototype) && prototype !== null) {
    errors.push(`${pathLabel} must use a plain JSON prototype`);
  }

  const output: UnknownRecord | unknown[] = isArray ? [] : Object.create(null) as UnknownRecord;
  const lengthDescriptor = isArray ? descriptors.length : null;
  const length = isArray && lengthDescriptor && "value" in lengthDescriptor &&
      Number.isSafeInteger(lengthDescriptor.value) && lengthDescriptor.value >= 0
    ? Number(lengthDescriptor.value)
    : 0;
  if (isArray && (!lengthDescriptor || !("value" in lengthDescriptor) ||
      !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0)) {
    errors.push(`${pathLabel}.length must be a safe data property`);
  }

  for (const key of ownKeys) {
    if (typeof key !== "string" || (isArray && key === "length")) continue;
    const descriptor = descriptors[key];
    const childPath = `${pathLabel}.${key}`;
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      errors.push(`${childPath} must be an enumerable data property`);
      continue;
    }
    if (isArray && (!/^(?:0|[1-9]\d*)$/.test(key) || Number(key) >= length)) {
      errors.push(`${childPath} is not a valid array element`);
      continue;
    }
    const child = inspectJsonValue(descriptor.value, childPath, errors, seen);
    if (isArray) (output as unknown[])[Number(key)] = child;
    else (output as UnknownRecord)[key] = child;
  }
  if (isArray) {
    for (let index = 0; index < length; index += 1) {
      if (!Object.hasOwn(output, index)) errors.push(`${pathLabel} contains an array hole at ${index}`);
    }
  }
  seen.delete(value);
  return output;
}

function enforceExactKeys(
  value: UnknownRecord,
  allowedKeys: readonly string[],
  pathLabel: string,
  errors: string[],
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${pathLabel} has unknown key ${key}`);
  }
  for (const key of allowedKeys) {
    if (!Object.hasOwn(value, key)) errors.push(`${pathLabel} is missing key ${key}`);
  }
}

function strictIsoMillis(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?Z)?$/.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);
  const millisecond = Number(match[7] ?? 0);
  const milliseconds = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const parsed = new Date(milliseconds);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second ||
    parsed.getUTCMilliseconds() !== millisecond
  ) {
    return null;
  }
  return milliseconds;
}

export function validateHomesMintArtifactParity(artifactCandidate: unknown): string[] {
  const errors: string[] = [];
  const safeArtifact = inspectJsonValue(artifactCandidate, "mint artifact", errors);
  if (!isRecord(safeArtifact)) {
    return Array.from(new Set([...errors, "mint artifact must be an object"]));
  }
  const artifact = safeArtifact;
  enforceExactKeys(
    artifact,
    ["schema", "verifiedAt", "rpc", "chainId", "block", "token", "totalSupply", "knownHolders", "coverage", "notes"],
    "mint artifact",
    errors,
  );

  if (artifact.schema !== "HomesMintVerificationV1") {
    errors.push("mint artifact schema must equal HomesMintVerificationV1");
  }
  if (artifact.chainId !== HOMES_TOKEN_CHAIN_ID) {
    errors.push(`mint artifact chainId must equal ${HOMES_TOKEN_CHAIN_ID}`);
  }
  if (artifact.rpc !== HOMES_MAINNET_RPC) {
    errors.push(`mint artifact rpc must equal ${HOMES_MAINNET_RPC}`);
  }
  if (artifact.block !== EXPECTED_MINT_BLOCK) {
    errors.push(`mint artifact block must equal ${EXPECTED_MINT_BLOCK}`);
  }
  if (artifact.verifiedAt !== EXPECTED_MINT_VERIFIED_AT) {
    errors.push(`mint artifact verifiedAt must equal ${EXPECTED_MINT_VERIFIED_AT}`);
  }
  if (strictIsoMillis(artifact.verifiedAt) === null) {
    errors.push("mint artifact verifiedAt must be a real UTC timestamp");
  }

  const token = isRecord(artifact.token) ? artifact.token : null;
  if (token === null) {
    errors.push("mint artifact token must be an object");
  } else {
    enforceExactKeys(token, ["address", "name", "symbol", "decimals"], "mint artifact.token", errors);
    if (token.address !== HOMES_TOKEN_ADDRESS) {
      errors.push(`mint artifact token.address must equal ${HOMES_TOKEN_ADDRESS}`);
    }
    if (token.name !== "Aura Homes") errors.push("mint artifact token.name must equal Aura Homes");
    if (token.symbol !== "HOMES") errors.push("mint artifact token.symbol must equal HOMES");
    if (token.decimals !== 18) errors.push("mint artifact token.decimals must equal 18");
  }

  const totalSupply = isRecord(artifact.totalSupply) ? artifact.totalSupply : null;
  if (totalSupply === null) {
    errors.push("mint artifact totalSupply must be an object");
  } else {
    enforceExactKeys(totalSupply, ["raw", "tokens"], "mint artifact.totalSupply", errors);
    if (totalSupply.raw !== "1000000000000000000000000000") {
      errors.push("mint artifact totalSupply.raw must equal the reviewed receipt");
    }
    if (totalSupply.tokens !== 1_000_000_000) {
      errors.push("mint artifact totalSupply.tokens must equal 1000000000");
    }
  }
  const knownHolders = isRecord(artifact.knownHolders) ? artifact.knownHolders : null;
  if (knownHolders === null) {
    errors.push("mint artifact knownHolders must be an object");
  } else {
    enforceExactKeys(
      knownHolders,
      ["creatorWallet", "xlaunchLocker", "wspcxxPool"],
      "mint artifact.knownHolders",
      errors,
    );
    for (const holderId of ["creatorWallet", "xlaunchLocker", "wspcxxPool"] as const) {
      const holder = isRecord(knownHolders[holderId]) ? knownHolders[holderId] : null;
      if (holder === null) errors.push(`mint artifact.knownHolders.${holderId} must be an object`);
      else enforceExactKeys(
        holder,
        ["address", "raw", "tokens", "percentOfSupply"],
        `mint artifact.knownHolders.${holderId}`,
        errors,
      );
    }
  }
  const coverage = isRecord(artifact.coverage) ? artifact.coverage : null;
  if (coverage === null) {
    errors.push("mint artifact coverage must be an object");
  } else {
    enforceExactKeys(
      coverage,
      ["publishedAddressTokens", "percentOfSupply", "unaccountedTokens", "sentence"],
      "mint artifact.coverage",
      errors,
    );
  }
  if (!Array.isArray(artifact.notes)) errors.push("mint artifact notes must be an array");
  return Array.from(new Set(errors));
}

const mintArtifactErrors = validateHomesMintArtifactParity(mintVerification);
if (mintArtifactErrors.length > 0) {
  throw new Error(`Invalid checked-in HOMES mint artifact: ${mintArtifactErrors.join("; ")}`);
}

const SOURCE_REPORTED_CLAIMS = new Set([
  "network.name",
  "network.chainId",
  "network.nativeAsset",
  "network.rpc",
  "token.launchedAt",
  "venue.name",
  "venue.poolAddress",
  "venue.lockerAddress",
  "venue.creatorWallet",
  "venue.quoteAsset",
  "venue.swapFeePercent",
  "venue.creatorQuoteSharePercent",
  "venue.liquidityRule",
  "venue.quoteAssetIssuerCanPauseTransfers",
]);

const VERIFIED_ONCHAIN_CLAIMS = new Set([
  "token.address",
  "token.name",
  "token.symbol",
  "token.decimals",
  "token.totalSupply",
  "token.lastVerifiedBlock",
  "token.lastVerifiedAt",
]);

const UNKNOWN_CLAIMS = new Set([
  "treasury.address",
  "fees.claimReceipts",
]);

const NOT_ESTABLISHED_CLAIMS = new Set([
  "staking.address",
  "fund.legalVehicle",
  "fund.houseFunding",
  "property.claims",
  "holder.ownershipRights",
  "holder.equityRights",
  "holder.returnRights",
  "distributions.receipts",
]);

const REQUIRED_CLAIMS = new Set([
  ...Array.from(SOURCE_REPORTED_CLAIMS),
  ...Array.from(VERIFIED_ONCHAIN_CLAIMS),
  ...Array.from(UNKNOWN_CLAIMS),
  ...Array.from(NOT_ESTABLISHED_CLAIMS),
]);

const PINNED_VALUES = new Map<string, string | number | boolean>([
  ["network.name", "X Layer"],
  ["network.chainId", HOMES_TOKEN_CHAIN_ID],
  ["network.nativeAsset", "OKB"],
  ["network.rpc", mintVerification.rpc],
  ["token.address", HOMES_TOKEN_ADDRESS],
  ["token.name", mintVerification.token.name],
  ["token.symbol", mintVerification.token.symbol],
  ["token.decimals", mintVerification.token.decimals],
  ["token.totalSupply", mintVerification.totalSupply.tokens],
  ["token.launchedAt", HOMES_LAUNCHED_ISO],
  ["token.lastVerifiedBlock", mintVerification.block],
  ["token.lastVerifiedAt", mintVerification.verifiedAt],
  ["venue.name", "XLaunch"],
  ["venue.poolAddress", HOMES_POOL_ADDRESS.toLowerCase()],
  ["venue.lockerAddress", HOMES_LOCKER_ADDRESS.toLowerCase()],
  ["venue.creatorWallet", HOMES_CREATOR_WALLET],
  ["venue.quoteAsset", HOMES_QUOTE_ASSET],
  ["venue.swapFeePercent", XLAUNCH_SWAP_FEE_PERCENT],
  ["venue.creatorQuoteSharePercent", XLAUNCH_CREATOR_FEE_SHARE_PERCENT],
  ["venue.liquidityRule", "locked-no-withdraw-path"],
  ["venue.quoteAssetIssuerCanPauseTransfers", true],
]);

export type HomesTruthStatus =
  | "verified-onchain"
  | "source-reported"
  | "unknown"
  | "not-established";

export interface HomesTruthSource {
  id: string;
  kind: "onchain-rpc" | "official-network-docs" | "venue-docs" | "venue-record" | "founder-record";
  title: string;
  uri: string;
  checkedAtISO: string;
  blockNumber: number | null;
}

export interface HomesTruthClaim {
  id: string;
  status: HomesTruthStatus;
  value: string | number | boolean | null;
  sourceIds: readonly string[];
  limitation: string;
  missingEvidence: string | null;
}

export interface HomesTruthRegistry {
  schema: typeof HOMES_TRUTH_REGISTRY_VERSION;
  asOfISO: string;
  sources: readonly HomesTruthSource[];
  claims: readonly HomesTruthClaim[];
}

const sources: HomesTruthSource[] = [
  {
    id: "xlayer-network-docs",
    kind: "official-network-docs",
    title: "X Layer network information",
    uri: "https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/network-information",
    checkedAtISO: "2026-08-25",
    blockNumber: null,
  },
  {
    id: "homes-mint-rpc",
    kind: "onchain-rpc",
    title: "Checked-in HOMES mint verification",
    uri: mintVerification.rpc,
    checkedAtISO: mintVerification.verifiedAt,
    blockNumber: mintVerification.block,
  },
  {
    id: "xlaunch-token-page",
    kind: "venue-record",
    title: "HOMES venue record",
    uri: XLAUNCH_TOKEN_URL,
    checkedAtISO: "2026-08-25",
    blockNumber: null,
  },
  {
    id: "xlaunch-docs",
    kind: "venue-docs",
    title: "XLaunch venue mechanics and risks",
    uri: "https://www.xlaunch.fun/docs",
    checkedAtISO: "2026-08-25",
    blockNumber: null,
  },
  {
    id: "founder-mainnet-record",
    kind: "founder-record",
    title: "Founder mainnet decision addendum",
    uri: "repo:docs/MAINNET-DECISION-BRIEF.md",
    checkedAtISO: "2026-08-14",
    blockNumber: null,
  },
];

const PINNED_SOURCE_CATALOG = new Map(
  sources.map((source) => [source.id, { ...source }] as const),
);

const claims: HomesTruthClaim[] = [
  {
    id: "network.name",
    status: "source-reported",
    value: "X Layer",
    sourceIds: ["xlayer-network-docs"],
    limitation: "Network identity does not make every Aura feature a mainnet feature.",
    missingEvidence: null,
  },
  {
    id: "network.chainId",
    status: "source-reported",
    value: HOMES_TOKEN_CHAIN_ID,
    sourceIds: ["xlayer-network-docs"],
    limitation: "This is X Layer mainnet; Aura's settlement lab remains on testnet chain 1952.",
    missingEvidence: null,
  },
  {
    id: "network.nativeAsset",
    status: "source-reported",
    value: "OKB",
    sourceIds: ["xlayer-network-docs"],
    limitation: "The network gas asset is not a HOMES reserve or payment promise.",
    missingEvidence: null,
  },
  {
    id: "network.rpc",
    status: "source-reported",
    value: mintVerification.rpc,
    sourceIds: ["xlayer-network-docs"],
    limitation: "The public RPC is a read source and can be rate limited.",
    missingEvidence: null,
  },
  {
    id: "token.address",
    status: "verified-onchain",
    value: HOMES_TOKEN_ADDRESS,
    sourceIds: ["homes-mint-rpc"],
    limitation: "Contract existence does not establish ownership, return, or property rights.",
    missingEvidence: null,
  },
  {
    id: "token.name",
    status: "verified-onchain",
    value: mintVerification.token.name,
    sourceIds: ["homes-mint-rpc"],
    limitation: "A token name is metadata, not a legal identity.",
    missingEvidence: null,
  },
  {
    id: "token.symbol",
    status: "verified-onchain",
    value: mintVerification.token.symbol,
    sourceIds: ["homes-mint-rpc"],
    limitation: "A ticker is not an ownership or return right.",
    missingEvidence: null,
  },
  {
    id: "token.decimals",
    status: "verified-onchain",
    value: mintVerification.token.decimals,
    sourceIds: ["homes-mint-rpc"],
    limitation: "Decimals describe accounting precision only.",
    missingEvidence: null,
  },
  {
    id: "token.totalSupply",
    status: "verified-onchain",
    value: mintVerification.totalSupply.tokens,
    sourceIds: ["homes-mint-rpc"],
    limitation: "totalSupply does not describe circulating supply or holder rights.",
    missingEvidence: null,
  },
  {
    id: "token.launchedAt",
    status: "source-reported",
    value: HOMES_LAUNCHED_ISO,
    sourceIds: ["founder-mainnet-record"],
    limitation: "The founder-reported launch date is distinct from the later mint verification timestamp.",
    missingEvidence: null,
  },
  {
    id: "token.lastVerifiedBlock",
    status: "verified-onchain",
    value: mintVerification.block,
    sourceIds: ["homes-mint-rpc"],
    limitation: "This is a point-in-time receipt, not a live market feed.",
    missingEvidence: null,
  },
  {
    id: "token.lastVerifiedAt",
    status: "verified-onchain",
    value: mintVerification.verifiedAt,
    sourceIds: ["homes-mint-rpc"],
    limitation: "Facts that can move require a newer checked-in receipt before public promotion.",
    missingEvidence: null,
  },
  {
    id: "venue.name",
    status: "source-reported",
    value: "XLaunch",
    sourceIds: ["xlaunch-token-page", "xlaunch-docs"],
    limitation: "XLaunch is a third-party permissionless venue, not an Aura service.",
    missingEvidence: null,
  },
  {
    id: "venue.poolAddress",
    status: "source-reported",
    value: HOMES_POOL_ADDRESS.toLowerCase(),
    sourceIds: ["xlaunch-token-page"],
    limitation: "A pool address proves neither liquidity depth nor a price floor.",
    missingEvidence: null,
  },
  {
    id: "venue.lockerAddress",
    status: "source-reported",
    value: HOMES_LOCKER_ADDRESS.toLowerCase(),
    sourceIds: ["xlaunch-token-page", "xlaunch-docs"],
    limitation: "The venue locker is not an Aura treasury.",
    missingEvidence: null,
  },
  {
    id: "venue.creatorWallet",
    status: "source-reported",
    value: HOMES_CREATOR_WALLET,
    sourceIds: ["xlaunch-token-page", "founder-mainnet-record"],
    limitation: "The wallet is a fee recipient; balances are not recognized revenue without claim receipts.",
    missingEvidence: null,
  },
  {
    id: "venue.quoteAsset",
    status: "source-reported",
    value: HOMES_QUOTE_ASSET,
    sourceIds: ["xlaunch-token-page", "xlaunch-docs"],
    limitation: "The quote asset adds third-party wrapper, issuer, and market-price risk.",
    missingEvidence: null,
  },
  {
    id: "venue.swapFeePercent",
    status: "source-reported",
    value: XLAUNCH_SWAP_FEE_PERCENT,
    sourceIds: ["xlaunch-docs"],
    limitation: "This is the venue's published rule, not an Aura-controlled contract promise.",
    missingEvidence: null,
  },
  {
    id: "venue.creatorQuoteSharePercent",
    status: "source-reported",
    value: XLAUNCH_CREATOR_FEE_SHARE_PERCENT,
    sourceIds: ["xlaunch-docs"],
    limitation: "Accrual under a venue rule is not recognized revenue until a claim receipt is published.",
    missingEvidence: null,
  },
  {
    id: "venue.liquidityRule",
    status: "source-reported",
    value: "locked-no-withdraw-path",
    sourceIds: ["xlaunch-docs"],
    limitation: "Locked liquidity prevents principal withdrawal; it does not create a price floor.",
    missingEvidence: null,
  },
  {
    id: "venue.quoteAssetIssuerCanPauseTransfers",
    status: "source-reported",
    value: true,
    sourceIds: ["xlaunch-docs"],
    limitation: "The stock-wrapper issuer can pause the underlying transfer path.",
    missingEvidence: null,
  },
  {
    id: "treasury.address",
    status: "unknown",
    value: null,
    sourceIds: [],
    limitation: "A creator wallet or venue pool is not a treasury.",
    missingEvidence: "A founder-approved treasury policy and independently verified treasury address are missing.",
  },
  {
    id: "staking.address",
    status: "not-established",
    value: null,
    sourceIds: [],
    limitation: "Holding or trading HOMES is not staking.",
    missingEvidence: "No approved staking design, audited contract, deployment receipt, or legal review exists.",
  },
  {
    id: "fees.claimReceipts",
    status: "unknown",
    value: null,
    sourceIds: [],
    limitation: "Venue fee accrual is not recognized revenue.",
    missingEvidence: "No published claim transaction and reconciled destination receipt exists.",
  },
  {
    id: "fund.legalVehicle",
    status: "not-established",
    value: null,
    sourceIds: [],
    limitation: "The token is not a fund interest.",
    missingEvidence: "No legally formed, reviewed, and founder-approved house-funding vehicle exists.",
  },
  {
    id: "fund.houseFunding",
    status: "not-established",
    value: null,
    sourceIds: [],
    limitation: "Token market activity is not construction capital.",
    missingEvidence: "No authorized use-of-funds rule, custody path, funded balance, or property-specific approval exists.",
  },
  {
    id: "property.claims",
    status: "not-established",
    value: null,
    sourceIds: [],
    limitation: "HOMES does not represent a claim on any property.",
    missingEvidence: "No property has a legally reviewed ownership structure or token-linked participation record.",
  },
  {
    id: "holder.ownershipRights",
    status: "not-established",
    value: null,
    sourceIds: [],
    limitation: "Token possession creates no ownership right in Aura or a cabin.",
    missingEvidence: "No governing instrument grants HOMES holders ownership rights.",
  },
  {
    id: "holder.equityRights",
    status: "not-established",
    value: null,
    sourceIds: [],
    limitation: "HOMES is not equity in Aura or a future fund.",
    missingEvidence: "No securities, corporate, or fund document grants HOMES holders equity rights.",
  },
  {
    id: "holder.returnRights",
    status: "not-established",
    value: null,
    sourceIds: [],
    limitation: "No yield, profit, appreciation, or payout is promised.",
    missingEvidence: "No legally reviewed distribution policy or enforceable return right exists.",
  },
  {
    id: "distributions.receipts",
    status: "not-established",
    value: null,
    sourceIds: [],
    limitation: "No holder distribution has been authorized or made.",
    missingEvidence: "No approved distribution rule, eligibility snapshot, transaction, or receipt exists.",
  },
];

const PINNED_CLAIM_CATALOG = new Map(
  claims.map((fact) => [fact.id, { ...fact, sourceIds: [...fact.sourceIds] }] as const),
);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const canonicalRegistry: HomesTruthRegistry = {
  schema: HOMES_TRUTH_REGISTRY_VERSION,
  asOfISO: HOMES_TRUTH_REGISTRY_AS_OF,
  sources: sources.map((source) => ({ ...source })),
  claims: claims.map((fact) => ({ ...fact, sourceIds: [...fact.sourceIds] })),
};

export function validateHomesTruthRegistry(registryCandidate: unknown): string[] {
  const errors: string[] = [];
  const safeRegistry = inspectJsonValue(registryCandidate, "registry", errors);
  if (!isRecord(safeRegistry)) {
    return Array.from(new Set([
      ...errors,
      "registry must be an object",
      "registry.sources must be an array",
      "registry.claims must be an array",
    ]));
  }
  const registry = safeRegistry;
  enforceExactKeys(registry, ["schema", "asOfISO", "sources", "claims"], "registry", errors);

  const sourceIds = new Set<string>();
  const sourcesById = new Map<string, HomesTruthSource>();

  if (registry.schema !== HOMES_TRUTH_REGISTRY_VERSION) {
    errors.push(`invalid registry schema: ${String(registry.schema)}`);
  }
  const asOfMillis = strictIsoMillis(registry.asOfISO);
  if (typeof registry.asOfISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(registry.asOfISO) || asOfMillis === null) {
    errors.push("registry has an invalid asOfISO");
  }
  if (registry.asOfISO !== HOMES_TRUTH_REGISTRY_AS_OF) {
    errors.push(`registry asOfISO must equal ${HOMES_TRUTH_REGISTRY_AS_OF}`);
  }

  const registrySources = Array.isArray(registry.sources) ? registry.sources : [];
  const registryClaims = Array.isArray(registry.claims) ? registry.claims : [];
  if (!Array.isArray(registry.sources)) errors.push("registry.sources must be an array");
  if (!Array.isArray(registry.claims)) errors.push("registry.claims must be an array");

  for (let index = 0; index < registrySources.length; index += 1) {
    const source = registrySources[index];
    if (!isRecord(source)) {
      errors.push(`source at index ${index} must be an object`);
      continue;
    }
    enforceExactKeys(
      source,
      ["id", "kind", "title", "uri", "checkedAtISO", "blockNumber"],
      `registry.sources.${index}`,
      errors,
    );
    const sourceId = typeof source.id === "string" ? source.id : `source[${index}]`;
    if (typeof source.id !== "string" || !/^[a-z][a-z0-9-]{2,63}$/.test(source.id)) {
      errors.push(`invalid source id: ${sourceId}`);
    } else {
      if (sourceIds.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
      sourceIds.add(source.id);
      sourcesById.set(source.id, source as unknown as HomesTruthSource);
    }

    const validRemoteUri = typeof source.uri === "string" && /^https:\/\/[^\s]+$/.test(source.uri);
    const validRepoUri = typeof source.uri === "string" && /^repo:(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\-/#]+$/.test(source.uri);
    if (!validRemoteUri && !validRepoUri) errors.push(`source ${sourceId} has an invalid uri`);
    const pinnedSource = typeof source.id === "string" ? PINNED_SOURCE_CATALOG.get(source.id) : undefined;
    if (pinnedSource === undefined) {
      errors.push(`unexpected source id: ${sourceId}`);
    } else {
      if (source.kind !== pinnedSource.kind) {
        errors.push(`source ${source.id} kind does not match its pinned source`);
      }
      if (source.uri !== pinnedSource.uri) {
        errors.push(`source ${source.id} uri does not match its pinned source`);
      }
      if (source.title !== pinnedSource.title) {
        errors.push(`source ${source.id} title does not match the pinned registry`);
      }
      if (source.checkedAtISO !== pinnedSource.checkedAtISO) {
        errors.push(`source ${source.id} checkedAtISO does not match the pinned registry`);
      }
      if (source.blockNumber !== pinnedSource.blockNumber) {
        errors.push(`source ${source.id} blockNumber does not match the pinned registry`);
      }
    }

    const checkedAtMillis = strictIsoMillis(source.checkedAtISO);
    if (checkedAtMillis === null) {
      errors.push(`source ${sourceId} has an invalid checkedAtISO`);
    } else if (asOfMillis !== null && checkedAtMillis > asOfMillis + 86_399_999) {
      errors.push(`source ${sourceId} is dated after registry asOfISO`);
    }
    if (source.kind === "onchain-rpc") {
      if (!Number.isSafeInteger(source.blockNumber) || Number(source.blockNumber) <= 0) {
        errors.push(`source ${sourceId} onchain-rpc must carry a positive safe block number`);
      }
    } else if (source.blockNumber !== null) {
      errors.push(`source ${sourceId} must not carry an on-chain block number`);
    }
    if (source.id === "homes-mint-rpc") {
      if (source.blockNumber !== mintVerification.block) {
        errors.push(`source homes-mint-rpc block must equal mint receipt ${mintVerification.block}`);
      }
      if (source.checkedAtISO !== mintVerification.verifiedAt) {
        errors.push(`source homes-mint-rpc timestamp must equal mint receipt ${mintVerification.verifiedAt}`);
      }
    }
  }

  for (const requiredSource of Array.from(PINNED_SOURCE_CATALOG.keys())) {
    if (!sourceIds.has(requiredSource)) errors.push(`missing required source: ${requiredSource}`);
  }

  const claimIds = new Set<string>();
  for (let index = 0; index < registryClaims.length; index += 1) {
    const fact = registryClaims[index];
    if (!isRecord(fact)) {
      errors.push(`claim at index ${index} must be an object`);
      continue;
    }
    enforceExactKeys(
      fact,
      ["id", "status", "value", "sourceIds", "limitation", "missingEvidence"],
      `registry.claims.${index}`,
      errors,
    );
    const factId = typeof fact.id === "string" ? fact.id : `claim[${index}]`;
    const factStatus = typeof fact.status === "string" ? fact.status : "invalid-status";
    if (typeof fact.id !== "string") {
      errors.push(`invalid claim id: ${factId}`);
    } else {
      if (claimIds.has(fact.id)) errors.push(`duplicate claim id: ${fact.id}`);
      claimIds.add(fact.id);
      if (!REQUIRED_CLAIMS.has(fact.id)) errors.push(`unexpected claim id: ${fact.id}`);
    }
    const factSourceIds = Array.isArray(fact.sourceIds)
      ? fact.sourceIds.filter((sourceId): sourceId is string => typeof sourceId === "string")
      : [];
    if (!Array.isArray(fact.sourceIds)) {
      errors.push(`${factId} sourceIds must be an array`);
    } else if (factSourceIds.length !== fact.sourceIds.length) {
      errors.push(`${factId} sourceIds must contain only strings`);
    }
    for (const sourceId of factSourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`${factId} references unknown source: ${sourceId}`);
    }
    const pinnedClaim = typeof fact.id === "string" ? PINNED_CLAIM_CATALOG.get(fact.id) : undefined;
    const pinnedSourceIds = pinnedClaim?.sourceIds;
    if (
      pinnedSourceIds !== undefined &&
      (factSourceIds.length !== pinnedSourceIds.length ||
        factSourceIds.some((sourceId, sourceIndex) => sourceId !== pinnedSourceIds[sourceIndex]))
    ) {
      errors.push(`${factId} source ids do not match the pinned registry`);
    }
    if (pinnedClaim !== undefined) {
      if (fact.status !== pinnedClaim.status) {
        errors.push(`${factId} status does not match the pinned registry`);
      }
      if (!Object.is(fact.value, pinnedClaim.value)) {
        errors.push(`${factId} value does not match the pinned registry`);
      }
      if (fact.limitation !== pinnedClaim.limitation) {
        errors.push(`${factId} limitation does not match the pinned registry`);
      }
      if (fact.missingEvidence !== pinnedClaim.missingEvidence) {
        errors.push(`${factId} missingEvidence does not match the pinned registry`);
      }
    }
    if (typeof fact.limitation !== "string" || fact.limitation.trim().length === 0) {
      errors.push(`${factId} limitation must be a non-empty string`);
    }
    if (SOURCE_REPORTED_CLAIMS.has(factId) && fact.status !== "source-reported") {
      errors.push(`${factId} must remain source-reported`);
    }
    if (VERIFIED_ONCHAIN_CLAIMS.has(factId) && fact.status !== "verified-onchain") {
      errors.push(`${factId} must remain verified-onchain`);
    }
    if (
      (fact.status === "verified-onchain" || fact.status === "source-reported") &&
      factSourceIds.length === 0
    ) {
      errors.push(`${factId} ${factStatus} must carry at least one source`);
    }
    if (
      (fact.status === "verified-onchain" || fact.status === "source-reported") &&
      fact.value === null
    ) {
      errors.push(`${factId} ${factStatus} must carry a value`);
    }
    if (fact.status === "verified-onchain") {
      const onchainSources = factSourceIds
        .map((sourceId) => sourcesById.get(sourceId))
        .filter((source): source is HomesTruthSource => source?.kind === "onchain-rpc");
      if (onchainSources.length === 0) {
        errors.push(`${factId} verified-onchain has no onchain-rpc source`);
      }
      for (const source of onchainSources) {
        if (source.blockNumber === null || !Number.isSafeInteger(source.blockNumber) || source.blockNumber <= 0) {
          errors.push(`${factId} verified-onchain source ${source.id} has no block number`);
        }
      }
    }
    if (fact.status === "source-reported") {
      const publisherSources = factSourceIds
        .map((sourceId) => sourcesById.get(sourceId))
        .filter((source): source is HomesTruthSource => source !== undefined && source.kind !== "onchain-rpc");
      if (publisherSources.length === 0) {
        errors.push(`${factId} source-reported has no publisher source`);
      }
    }
    const boundaryStatus = UNKNOWN_CLAIMS.has(factId)
      ? "unknown"
      : NOT_ESTABLISHED_CLAIMS.has(factId)
        ? "not-established"
        : null;
    if (boundaryStatus !== null && fact.status !== boundaryStatus) {
      errors.push(`${factId} must remain ${boundaryStatus}`);
    }
    if ((fact.status === "unknown" || fact.status === "not-established") && fact.value !== null) {
      errors.push(`${factId} ${factStatus} must not carry a value`);
    }
    if ((fact.status === "unknown" || fact.status === "not-established") && factSourceIds.length > 0) {
      errors.push(`${factId} ${factStatus} must not treat a source as authorization`);
    }
    if (
      (fact.status === "unknown" || fact.status === "not-established") &&
      (typeof fact.missingEvidence !== "string" || fact.missingEvidence.trim().length < 20)
    ) {
      errors.push(`${factId} ${factStatus} must name missing evidence`);
    }
    const pinned = PINNED_VALUES.get(factId);
    if (pinned !== undefined && !Object.is(fact.value, pinned)) {
      errors.push(`${factId} must equal pinned value ${pinned}`);
    }
  }

  for (const required of Array.from(REQUIRED_CLAIMS)) {
    if (!claimIds.has(required)) errors.push(`missing required claim: ${required}`);
  }

  return Array.from(new Set(errors));
}

const canonicalErrors = validateHomesTruthRegistry(canonicalRegistry);
if (canonicalErrors.length > 0) {
  throw new Error(`Invalid canonical HOMES truth registry: ${canonicalErrors.join("; ")}`);
}

export const HOMES_TRUTH_REGISTRY: HomesTruthRegistry = deepFreeze(canonicalRegistry);
