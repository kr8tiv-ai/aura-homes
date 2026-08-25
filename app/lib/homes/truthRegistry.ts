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
  sources.map((source) => [source.id, { kind: source.kind, uri: source.uri }] as const),
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

const PINNED_CLAIM_SOURCE_IDS = new Map(
  claims.map((fact) => [fact.id, [...fact.sourceIds]] as const),
);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

const canonicalRegistry: HomesTruthRegistry = {
  schema: HOMES_TRUTH_REGISTRY_VERSION,
  asOfISO: "2026-08-25",
  sources: sources.map((source) => ({ ...source })),
  claims: claims.map((fact) => ({ ...fact, sourceIds: [...fact.sourceIds] })),
};

export function validateHomesTruthRegistry(registry: HomesTruthRegistry): string[] {
  const errors: string[] = [];
  const sourceIds = new Set<string>();
  const sourcesById = new Map<string, HomesTruthSource>();

  if (registry.schema !== HOMES_TRUTH_REGISTRY_VERSION) {
    errors.push(`invalid registry schema: ${registry.schema}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.asOfISO) || Number.isNaN(Date.parse(registry.asOfISO))) {
    errors.push("registry has an invalid asOfISO");
  }

  for (const source of registry.sources) {
    if (sourceIds.has(source.id)) errors.push(`duplicate source id: ${source.id}`);
    sourceIds.add(source.id);
    sourcesById.set(source.id, source);
    if (!/^[a-z][a-z0-9-]{2,63}$/.test(source.id)) {
      errors.push(`invalid source id: ${source.id}`);
    }
    const validRemoteUri = /^https:\/\/[^\s]+$/.test(source.uri);
    const validRepoUri = /^repo:(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._\-/#]+$/.test(source.uri);
    if (!validRemoteUri && !validRepoUri) errors.push(`source ${source.id} has an invalid uri`);
    const pinnedSource = PINNED_SOURCE_CATALOG.get(source.id);
    if (pinnedSource === undefined) {
      errors.push(`unexpected source id: ${source.id}`);
    } else {
      if (source.kind !== pinnedSource.kind) {
        errors.push(`source ${source.id} kind does not match its pinned source`);
      }
      if (source.uri !== pinnedSource.uri) {
        errors.push(`source ${source.id} uri does not match its pinned source`);
      }
    }
    if (
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)?$/.test(source.checkedAtISO) ||
      Number.isNaN(Date.parse(source.checkedAtISO))
    ) {
      errors.push(`source ${source.id} has an invalid checkedAtISO`);
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
  for (const fact of registry.claims) {
    if (claimIds.has(fact.id)) errors.push(`duplicate claim id: ${fact.id}`);
    claimIds.add(fact.id);
    if (!REQUIRED_CLAIMS.has(fact.id)) errors.push(`unexpected claim id: ${fact.id}`);
    for (const sourceId of fact.sourceIds) {
      if (!sourceIds.has(sourceId)) errors.push(`${fact.id} references unknown source: ${sourceId}`);
    }
    const pinnedSourceIds = PINNED_CLAIM_SOURCE_IDS.get(fact.id);
    if (
      pinnedSourceIds !== undefined &&
      (fact.sourceIds.length !== pinnedSourceIds.length ||
        fact.sourceIds.some((sourceId, index) => sourceId !== pinnedSourceIds[index]))
    ) {
      errors.push(`${fact.id} source ids do not match the pinned registry`);
    }
    if (SOURCE_REPORTED_CLAIMS.has(fact.id) && fact.status !== "source-reported") {
      errors.push(`${fact.id} must remain source-reported`);
    }
    if (VERIFIED_ONCHAIN_CLAIMS.has(fact.id) && fact.status !== "verified-onchain") {
      errors.push(`${fact.id} must remain verified-onchain`);
    }
    if (
      (fact.status === "verified-onchain" || fact.status === "source-reported") &&
      fact.sourceIds.length === 0
    ) {
      errors.push(`${fact.id} ${fact.status} must carry at least one source`);
    }
    if (
      (fact.status === "verified-onchain" || fact.status === "source-reported") &&
      fact.value === null
    ) {
      errors.push(`${fact.id} ${fact.status} must carry a value`);
    }
    if (fact.status === "verified-onchain") {
      const onchainSources = fact.sourceIds
        .map((sourceId) => sourcesById.get(sourceId))
        .filter((source): source is HomesTruthSource => source?.kind === "onchain-rpc");
      if (onchainSources.length === 0) {
        errors.push(`${fact.id} verified-onchain has no onchain-rpc source`);
      }
      for (const source of onchainSources) {
        if (source.blockNumber === null || !Number.isSafeInteger(source.blockNumber) || source.blockNumber <= 0) {
          errors.push(`${fact.id} verified-onchain source ${source.id} has no block number`);
        }
      }
    }
    if (fact.status === "source-reported") {
      const publisherSources = fact.sourceIds
        .map((sourceId) => sourcesById.get(sourceId))
        .filter((source): source is HomesTruthSource => source !== undefined && source.kind !== "onchain-rpc");
      if (publisherSources.length === 0) {
        errors.push(`${fact.id} source-reported has no publisher source`);
      }
    }
    const boundaryStatus = UNKNOWN_CLAIMS.has(fact.id)
      ? "unknown"
      : NOT_ESTABLISHED_CLAIMS.has(fact.id)
        ? "not-established"
        : null;
    if (boundaryStatus !== null && fact.status !== boundaryStatus) {
      errors.push(`${fact.id} must remain ${boundaryStatus}`);
    }
    if ((fact.status === "unknown" || fact.status === "not-established") && fact.value !== null) {
      errors.push(`${fact.id} ${fact.status} must not carry a value`);
    }
    if ((fact.status === "unknown" || fact.status === "not-established") && fact.sourceIds.length > 0) {
      errors.push(`${fact.id} ${fact.status} must not treat a source as authorization`);
    }
    if (
      (fact.status === "unknown" || fact.status === "not-established") &&
      (fact.missingEvidence === null || fact.missingEvidence.trim().length < 20)
    ) {
      errors.push(`${fact.id} ${fact.status} must name missing evidence`);
    }
    const pinned = PINNED_VALUES.get(fact.id);
    if (pinned !== undefined && !Object.is(fact.value, pinned)) {
      errors.push(`${fact.id} must equal pinned value ${pinned}`);
    }
  }

  for (const required of Array.from(REQUIRED_CLAIMS)) {
    if (!claimIds.has(required)) errors.push(`missing required claim: ${required}`);
  }

  return errors;
}

const canonicalErrors = validateHomesTruthRegistry(canonicalRegistry);
if (canonicalErrors.length > 0) {
  throw new Error(`Invalid canonical HOMES truth registry: ${canonicalErrors.join("; ")}`);
}

export const HOMES_TRUTH_REGISTRY: HomesTruthRegistry = deepFreeze(canonicalRegistry);
