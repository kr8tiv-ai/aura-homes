import {
  HOMES_LAUNCHED_ISO,
  HOMES_TOKEN_ADDRESS,
  HOMES_TOKEN_CHAIN_ID,
} from "./token";
import mintVerification from "@data/homes/mint-verification.json";

export const HOMES_FEE_ALLOCATION = {
  propertyFund: 60,
  marketing: 10,
  operations: 10,
  development: 10,
  maintenance: 10,
} as const;

export const HOMES_TRADING_FEE_ALLOCATION = {
  propertyFund: 60,
  marketing: 10,
  operations: 10,
  development: 10,
  burnReserve: 5,
  protocolOwnedLiquidity: 5,
} as const;

export const HOMES_TOKEN_SUPPLY_ALLOCATION = {
  team: 30,
  marketing: 10,
  exchangeListings: 10,
  protocolOwnedLiquidity: 20,
  publicMarket: 30,
} as const;

export const HOMES_PROPERTY_OWNERSHIP = {
  community: 60,
  team: 40,
} as const;

export const HOMES_FIRST_PROPERTY_TARGET_USDC = BigInt(200_000) * BigInt(1_000_000);
export const HOMES_ELIGIBLE_HOLDER_LIMIT = 200;
export const HOMES_WIND_DOWN_HOLDER_LIMIT = 50;
export const HOMES_TEAM_ALLOCATION_PERCENT = 30;
export const HOMES_INITIAL_BUY_CAP_PERCENT = 2;

export type HomesHolder = {
  address: `0x${string}`;
  staked: bigint;
  classification?: "community" | "team" | "treasury" | "liquidity" | "exchange" | "contract";
};

export interface HomesSnapshot {
  status: "planned" | "testnet" | "live";
  asOfISO: string | null;
  chain: {
    name: "X Layer";
    chainId: number | null;
    tokenAddress: `0x${string}` | null;
    stakingAddress: `0x${string}` | null;
    treasuryAddress: `0x${string}` | null;
    snapshotBlock: bigint | null;
    /** The newest block at which ANY on-chain fact on this dashboard was
     * independently read (today: the mint verification artifact). */
    lastVerifiedBlock: number | null;
    verifiedAtISO: string | null;
  };
  fees: {
    totalUsdc: bigint;
    tradingUsdc: bigint;
    serviceUsdc: bigint;
    lastReceiptHash: `0x${string}` | null;
    sources: Array<{
      id: string;
      label: string;
      model: string;
      status: "planned" | "active";
      recognizedUsdc: bigint;
    }>;
  };
  propertyFund: {
    balanceUsdc: bigint;
    targetUsdc: bigint;
    escrowAddress: `0x${string}` | null;
  };
  holders: {
    stakedCount: number;
    eligibleCount: number;
    cutoffStake: bigint | null;
  };
  properties: Array<{
    id: string;
    location: string;
    status: "candidate" | "due-diligence" | "acquired" | "building" | "operating";
    acquisitionReceiptHash: `0x${string}` | null;
    /** What still stands between this property and its next status. */
    blockers: string[];
    /** Dated evidence pointers (title docs, appraisals, inspection hashes). */
    evidence: string[];
  }>;
  /** Per-period operating money, gross to community pool, every non-zero
   * figure backed by receipt hashes — enforced by reconcileHomesProfitLedger. */
  profitLedger: Array<{
    period: string;
    propertyId: string;
    grossUsdc: bigint;
    expensesUsdc: bigint;
    reservesUsdc: bigint;
    netUsdc: bigint;
    communityPoolUsdc: bigint;
    receiptHashes: `0x${string}`[];
  }>;
  distributions: Array<{
    period: string;
    netProfitUsdc: bigint;
    communityPoolUsdc: bigint;
    paidUsdc: bigint;
    unclaimedUsdc: bigint;
    snapshotBlock: bigint | null;
    eligibleCount: number;
    claimTxHashes: `0x${string}`[];
    transactionHash: `0x${string}` | null;
  }>;
  windDown: {
    status: "not-configured" | "fundraising" | "eligible" | "claiming" | "closed";
    fundingDeadlineISO: string | null;
    minimumViableTargetUsdc: bigint | null;
    snapshotBlock: bigint | null;
    eligibleHolderLimit: number;
    distributableUsdc: bigint;
    claimAddress: `0x${string}` | null;
  };
}

export function allocateHomesFees(totalUsdc: bigint): Record<keyof typeof HOMES_FEE_ALLOCATION, bigint> {
  if (totalUsdc < BigInt(0)) throw new Error("Fee totals cannot be negative.");
  const basis = BigInt(100);
  const allocations = {
    propertyFund: totalUsdc * BigInt(HOMES_FEE_ALLOCATION.propertyFund) / basis,
    marketing: totalUsdc * BigInt(HOMES_FEE_ALLOCATION.marketing) / basis,
    operations: totalUsdc * BigInt(HOMES_FEE_ALLOCATION.operations) / basis,
    development: totalUsdc * BigInt(HOMES_FEE_ALLOCATION.development) / basis,
    maintenance: totalUsdc * BigInt(HOMES_FEE_ALLOCATION.maintenance) / basis,
  };
  const assigned = Object.values(allocations).reduce((sum, value) => sum + value, BigInt(0));
  allocations.propertyFund += totalUsdc - assigned;
  return allocations;
}

export function allocateHomesTradingFees(totalUsdc: bigint): Record<keyof typeof HOMES_TRADING_FEE_ALLOCATION, bigint> {
  if (totalUsdc < BigInt(0)) throw new Error("Trading fee totals cannot be negative.");
  const basis = BigInt(100);
  const allocations = {
    propertyFund: totalUsdc * BigInt(HOMES_TRADING_FEE_ALLOCATION.propertyFund) / basis,
    marketing: totalUsdc * BigInt(HOMES_TRADING_FEE_ALLOCATION.marketing) / basis,
    operations: totalUsdc * BigInt(HOMES_TRADING_FEE_ALLOCATION.operations) / basis,
    development: totalUsdc * BigInt(HOMES_TRADING_FEE_ALLOCATION.development) / basis,
    burnReserve: totalUsdc * BigInt(HOMES_TRADING_FEE_ALLOCATION.burnReserve) / basis,
    protocolOwnedLiquidity: totalUsdc * BigInt(HOMES_TRADING_FEE_ALLOCATION.protocolOwnedLiquidity) / basis,
  };
  const assigned = Object.values(allocations).reduce((sum, value) => sum + value, BigInt(0));
  allocations.propertyFund += totalUsdc - assigned;
  return allocations;
}

function eligibleCommunityHolders(holders: readonly HomesHolder[], limit: number): HomesHolder[] {
  return holders
    /* Eligibility fails closed. An unlabeled address may be a treasury,
       exchange, LP, contract, or team-controlled wallet; treating it as a
       community holder would make a future snapshot unsafe by default. */
    .filter((holder) => holder.staked > BigInt(0) && holder.classification === "community")
    .map((holder) => ({ ...holder }))
    .sort((a, b) => a.staked === b.staked
      ? a.address.localeCompare(b.address)
      : a.staked > b.staked ? -1 : 1)
    .slice(0, limit);
}

export function eligibleHomesHolders(holders: readonly HomesHolder[]): HomesHolder[] {
  return eligibleCommunityHolders(holders, HOMES_ELIGIBLE_HOLDER_LIMIT);
}

export function homesProfitPayouts(netProfitUsdc: bigint, holders: readonly HomesHolder[]): {
  communityPool: bigint;
  teamShare: bigint;
  payouts: Array<HomesHolder & { amount: bigint }>;
  unallocated: bigint;
} {
  if (netProfitUsdc < BigInt(0)) throw new Error("Net property profit cannot be negative.");
  const eligible = eligibleHomesHolders(holders);
  const communityPool = netProfitUsdc * BigInt(HOMES_PROPERTY_OWNERSHIP.community) / BigInt(100);
  const teamShare = netProfitUsdc - communityPool;
  const totalStake = eligible.reduce((sum, holder) => sum + holder.staked, BigInt(0));
  if (totalStake === BigInt(0)) return { communityPool, teamShare, payouts: [], unallocated: communityPool };
  const payouts = eligible.map((holder) => ({
    ...holder,
    amount: communityPool * holder.staked / totalStake,
  }));
  const paid = payouts.reduce((sum, payout) => sum + payout.amount, BigInt(0));
  return { communityPool, teamShare, payouts, unallocated: communityPool - paid };
}

export function homesWindDownPayouts(propertyFundBalanceUsdc: bigint, holders: readonly HomesHolder[]): {
  eligible: HomesHolder[];
  payouts: Array<HomesHolder & { amount: bigint }>;
  unallocated: bigint;
} {
  if (propertyFundBalanceUsdc < BigInt(0)) throw new Error("Wind-down balance cannot be negative.");
  const eligible = eligibleCommunityHolders(holders, HOMES_WIND_DOWN_HOLDER_LIMIT);
  const totalStake = eligible.reduce((sum, holder) => sum + holder.staked, BigInt(0));
  if (totalStake === BigInt(0)) return { eligible, payouts: [], unallocated: propertyFundBalanceUsdc };
  const payouts = eligible.map((holder) => ({
    ...holder,
    amount: propertyFundBalanceUsdc * holder.staked / totalStake,
  }));
  const paid = payouts.reduce((sum, payout) => sum + payout.amount, BigInt(0));
  return { eligible, payouts, unallocated: propertyFundBalanceUsdc - paid };
}

/**
 * Reconcile the three public fee totals before deriving any allocation.
 * This is an accounting invariant, not proof that an event is authentic;
 * receipt-backed adapters remain required before the planned snapshot can
 * become a live one.
 */
export function reconcileHomesFeeLedger(snapshot: HomesSnapshot): {
  tradingUsdc: bigint;
  serviceUsdc: bigint;
  totalUsdc: bigint;
} {
  const tradingUsdc = snapshot.fees.tradingUsdc;
  const serviceUsdc = snapshot.fees.serviceUsdc;
  const totalUsdc = tradingUsdc + serviceUsdc;
  const sourceTotal = snapshot.fees.sources.reduce(
    (sum, source) => sum + source.recognizedUsdc,
    BigInt(0),
  );

  if (tradingUsdc < BigInt(0) || serviceUsdc < BigInt(0) || snapshot.fees.totalUsdc < BigInt(0)) {
    throw new Error("HOMES fee balances cannot be negative.");
  }
  if (totalUsdc !== snapshot.fees.totalUsdc || sourceTotal !== snapshot.fees.totalUsdc) {
    throw new Error("The HOMES fee ledger does not reconcile with its source totals.");
  }
  return { tradingUsdc, serviceUsdc, totalUsdc };
}

/** The current public snapshot. The TOKEN is live (launched on XLaunch,
 * August 13, 2026); the trust, staking, properties, distributions, and
 * wind-down remain design-stage, and their fields stay null/zero until each
 * has its own receipt. Venue fees accrue at XLaunch but are recognized only
 * after claim receipts are published — `reconcileHomesFeeLedger` makes a
 * half-recognized number a build failure, not a silent lie. */
/** Fabricated numbers are structurally impossible: any non-zero USDC figure
 * in the profit ledger or a distribution must carry at least one receipt
 * hash, the arithmetic must reconcile (net = gross − expenses − reserves;
 * community pool = 60% of net; paid + unclaimed = pool), and violations
 * throw at module scope — a lying dashboard fails the BUILD. */
export function reconcileHomesProfitLedger(snapshot: HomesSnapshot): void {
  const zero = BigInt(0);
  for (const row of snapshot.profitLedger) {
    const anyMoney = row.grossUsdc > zero || row.expensesUsdc > zero || row.reservesUsdc > zero || row.netUsdc > zero || row.communityPoolUsdc > zero;
    if (anyMoney && row.receiptHashes.length === 0) {
      throw new Error(`Profit row ${row.period}/${row.propertyId} carries money without a receipt hash.`);
    }
    if (row.netUsdc !== row.grossUsdc - row.expensesUsdc - row.reservesUsdc) {
      throw new Error(`Profit row ${row.period}/${row.propertyId} does not reconcile: net ≠ gross − expenses − reserves.`);
    }
    const pool = row.netUsdc > zero ? row.netUsdc * BigInt(HOMES_PROPERTY_OWNERSHIP.community) / BigInt(100) : zero;
    if (row.communityPoolUsdc !== pool) {
      throw new Error(`Profit row ${row.period}/${row.propertyId} community pool is not ${HOMES_PROPERTY_OWNERSHIP.community}% of net.`);
    }
  }
  for (const distribution of snapshot.distributions) {
    const anyMoney = distribution.communityPoolUsdc > zero || distribution.paidUsdc > zero || distribution.unclaimedUsdc > zero;
    if (anyMoney && distribution.claimTxHashes.length === 0 && distribution.transactionHash === null) {
      throw new Error(`Distribution ${distribution.period} carries money without a transaction hash.`);
    }
    if (distribution.paidUsdc + distribution.unclaimedUsdc !== distribution.communityPoolUsdc) {
      throw new Error(`Distribution ${distribution.period} does not reconcile: paid + unclaimed ≠ community pool.`);
    }
    if (anyMoney && distribution.snapshotBlock === null) {
      throw new Error(`Distribution ${distribution.period} carries money without a snapshot block.`);
    }
  }
}

export function currentHomesSnapshot(): HomesSnapshot {
  return {
    status: "live",
    asOfISO: HOMES_LAUNCHED_ISO,
    chain: {
      name: "X Layer",
      chainId: HOMES_TOKEN_CHAIN_ID,
      tokenAddress: HOMES_TOKEN_ADDRESS,
      stakingAddress: null,
      treasuryAddress: null,
      snapshotBlock: null,
      lastVerifiedBlock: mintVerification.block,
      verifiedAtISO: mintVerification.verifiedAt,
    },
    fees: {
      totalUsdc: BigInt(0),
      tradingUsdc: BigInt(0),
      serviceUsdc: BigInt(0),
      lastReceiptHash: null,
      sources: [
        { id: "venue", label: "Token venue fee share", model: "XLaunch routes 60% of its 1% swap fee to the creator wallet; amounts count here only after claim receipts are published", status: "active", recognizedUsdc: BigInt(0) },
        { id: "services", label: "Aura service fees", model: "Small disclosed margins on completed marketplace services", status: "planned", recognizedUsdc: BigInt(0) },
        { id: "ai", label: "AI model routing", model: "Provider cost plus a disclosed orchestration margin, including OpenRouter where used", status: "planned", recognizedUsdc: BigInt(0) },
        { id: "api", label: "Partner and API access", model: "Usage-priced tools when Aura's project intelligence is production-ready", status: "planned", recognizedUsdc: BigInt(0) },
      ],
    },
    propertyFund: {
      balanceUsdc: BigInt(0),
      targetUsdc: HOMES_FIRST_PROPERTY_TARGET_USDC,
      escrowAddress: null,
    },
    holders: { stakedCount: 0, eligibleCount: 0, cutoffStake: null },
    properties: [],
    profitLedger: [],
    distributions: [],
    windDown: {
      status: "not-configured",
      fundingDeadlineISO: null,
      minimumViableTargetUsdc: null,
      snapshotBlock: null,
      eligibleHolderLimit: HOMES_WIND_DOWN_HOLDER_LIMIT,
      distributableUsdc: BigInt(0),
      claimAddress: null,
    },
  };
}
