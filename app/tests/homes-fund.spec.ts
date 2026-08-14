import { expect, test } from "playwright/test";
import {
  HOMES_FEE_ALLOCATION,
  HOMES_INITIAL_BUY_CAP_PERCENT,
  HOMES_TOKEN_SUPPLY_ALLOCATION,
  HOMES_TEAM_ALLOCATION_PERCENT,
  HOMES_TRADING_FEE_ALLOCATION,
  HOMES_WIND_DOWN_HOLDER_LIMIT,
  allocateHomesFees,
  allocateHomesTradingFees,
  eligibleHomesHolders,
  homesWindDownPayouts,
  homesProfitPayouts,
  reconcileHomesFeeLedger,
  reconcileHomesProfitLedger,
  currentHomesSnapshot,
} from "@/lib/homes/fund";
import { HOMES_TOKEN_ADDRESS, HOMES_TOKEN_CHAIN_ID } from "@/lib/homes/token";

test("HOMES fee allocation is complete and sends 60 percent to the property fund", () => {
  expect(Object.values(HOMES_FEE_ALLOCATION).reduce((sum, share) => sum + share, 0)).toBe(100);
  expect(allocateHomesFees(BigInt(1_000_000))).toEqual({
    propertyFund: BigInt(600_000),
    marketing: BigInt(100_000),
    operations: BigInt(100_000),
    development: BigInt(100_000),
    maintenance: BigInt(100_000),
  });
});

test("HOMES token supply reserves 30 percent for public circulation", () => {
  expect(Object.values(HOMES_TOKEN_SUPPLY_ALLOCATION).reduce((sum, share) => sum + share, 0)).toBe(100);
  expect(HOMES_TOKEN_SUPPLY_ALLOCATION).toEqual({
    team: 30,
    marketing: 10,
    exchangeListings: 10,
    protocolOwnedLiquidity: 20,
    publicMarket: 30,
  });
});

test("trading fees compound liquidity and reserve burns independently from service fees", () => {
  expect(Object.values(HOMES_TRADING_FEE_ALLOCATION).reduce((sum, share) => sum + share, 0)).toBe(100);
  expect(allocateHomesTradingFees(BigInt(1_000_000))).toEqual({
    propertyFund: BigInt(600_000),
    marketing: BigInt(100_000),
    operations: BigInt(100_000),
    development: BigInt(100_000),
    burnReserve: BigInt(50_000),
    protocolOwnedLiquidity: BigInt(50_000),
  });
});

test("launch guardrails disclose team allocation and cap only the initial distribution", () => {
  expect(HOMES_TEAM_ALLOCATION_PERCENT).toBe(30);
  expect(HOMES_INITIAL_BUY_CAP_PERCENT).toBe(2);
});

test("eligibility is a deterministic top-200 stake snapshot", () => {
  const holders = Array.from({ length: 205 }, (_, index) => ({
    address: `0x${String(index).padStart(40, "0")}` as `0x${string}`,
    staked: BigInt((index + 1) * 100),
    classification: "community" as const,
  }));
  const eligible = eligibleHomesHolders(holders);

  expect(eligible).toHaveLength(200);
  expect(eligible[0].staked).toBe(BigInt(20_500));
  expect(eligible[199].staked).toBe(BigInt(600));
});

test("only 60 percent of net property profit is distributed pro rata", () => {
  const result = homesProfitPayouts(BigInt(1_000_000), [
    { address: `0x${"1".repeat(40)}` as `0x${string}`, staked: BigInt(3), classification: "community" },
    { address: `0x${"2".repeat(40)}` as `0x${string}`, staked: BigInt(1), classification: "community" },
  ]);

  expect(result.communityPool).toBe(BigInt(600_000));
  expect(result.teamShare).toBe(BigInt(400_000));
  expect(result.payouts.map((payout) => payout.amount)).toEqual([BigInt(450_000), BigInt(150_000)]);
});

/* Renegotiated Aug 13, 2026 — the token is live on XLaunch. The chain cell
   carries the real address; every MONEY cell stays a declared zero until a
   claim receipt exists, and everything unbuilt stays null. */
test("the public dashboard shows the live token and declared zeros for everything unproven", () => {
  const snapshot = currentHomesSnapshot();
  expect(snapshot.status).toBe("live");
  expect(snapshot.asOfISO).toBe("2026-08-13");
  expect(snapshot.chain.chainId).toBe(HOMES_TOKEN_CHAIN_ID);
  expect(snapshot.chain.tokenAddress).toBe(HOMES_TOKEN_ADDRESS);
  expect(snapshot.fees.totalUsdc).toBe(BigInt(0));
  expect(snapshot.propertyFund.balanceUsdc).toBe(BigInt(0));
  expect(snapshot.fees.tradingUsdc).toBe(BigInt(0));
  expect(snapshot.fees.serviceUsdc).toBe(BigInt(0));
  const venue = snapshot.fees.sources.find((source) => source.id === "venue");
  expect(venue?.status).toBe("active");
  expect(venue?.recognizedUsdc).toBe(BigInt(0));
  expect(snapshot.chain.stakingAddress).toBeNull();
  expect(snapshot.chain.treasuryAddress).toBeNull();
  expect(snapshot.properties).toEqual([]);
  expect(snapshot.windDown.status).toBe("not-configured");
  expect(snapshot.windDown.distributableUsdc).toBe(BigInt(0));
});

test("fee ledgers reconcile source receipts without double allocating trading and service revenue", () => {
  const base = currentHomesSnapshot();
  const snapshot = {
    ...base,
    fees: {
      ...base.fees,
      totalUsdc: BigInt(5_000_000),
      tradingUsdc: BigInt(3_000_000),
      serviceUsdc: BigInt(2_000_000),
      sources: base.fees.sources.map((source, index) => ({
        ...source,
        recognizedUsdc: index === 0 ? BigInt(3_000_000) : index === 1 ? BigInt(2_000_000) : BigInt(0),
      })),
    },
  };

  expect(reconcileHomesFeeLedger(snapshot)).toEqual({
    tradingUsdc: BigInt(3_000_000),
    serviceUsdc: BigInt(2_000_000),
    totalUsdc: BigInt(5_000_000),
  });
  expect(() => reconcileHomesFeeLedger({
    ...snapshot,
    fees: { ...snapshot.fees, totalUsdc: BigInt(6_000_000) },
  })).toThrow(/does not reconcile/i);
});

/* D-1: a fabricated dashboard number is a BUILD failure, not a review
   comment. Money without receipts, broken arithmetic, or a distribution
   without its snapshot block all throw. */
test("the profit ledger and distributions make fabricated numbers structurally impossible", () => {
  const base = currentHomesSnapshot();
  expect(() => reconcileHomesProfitLedger(base)).not.toThrow();

  const row = {
    period: "2027-Q1", propertyId: "pilot-1",
    grossUsdc: BigInt(10_000_000_000), expensesUsdc: BigInt(4_000_000_000),
    reservesUsdc: BigInt(1_000_000_000), netUsdc: BigInt(5_000_000_000),
    communityPoolUsdc: BigInt(3_000_000_000),
    receiptHashes: [`0x${"a".repeat(64)}`] as `0x${string}`[],
  };
  expect(() => reconcileHomesProfitLedger({ ...base, profitLedger: [row] })).not.toThrow();
  expect(() => reconcileHomesProfitLedger({ ...base, profitLedger: [{ ...row, receiptHashes: [] }] }))
    .toThrow(/without a receipt hash/i);
  expect(() => reconcileHomesProfitLedger({ ...base, profitLedger: [{ ...row, netUsdc: BigInt(6_000_000_000), communityPoolUsdc: BigInt(3_600_000_000) }] }))
    .toThrow(/net .+ gross/i);
  expect(() => reconcileHomesProfitLedger({ ...base, profitLedger: [{ ...row, communityPoolUsdc: BigInt(2_000_000_000) }] }))
    .toThrow(/community pool/i);

  const distribution = {
    period: "2027-Q1", netProfitUsdc: BigInt(5_000_000_000),
    communityPoolUsdc: BigInt(3_000_000_000), paidUsdc: BigInt(2_500_000_000),
    unclaimedUsdc: BigInt(500_000_000), snapshotBlock: BigInt(70_000_000),
    eligibleCount: 120, claimTxHashes: [`0x${"b".repeat(64)}`] as `0x${string}`[],
    transactionHash: null,
  };
  expect(() => reconcileHomesProfitLedger({ ...base, distributions: [distribution] })).not.toThrow();
  expect(() => reconcileHomesProfitLedger({ ...base, distributions: [{ ...distribution, unclaimedUsdc: BigInt(600_000_000) }] }))
    .toThrow(/paid \+ unclaimed/i);
  expect(() => reconcileHomesProfitLedger({ ...base, distributions: [{ ...distribution, claimTxHashes: [], transactionHash: null }] }))
    .toThrow(/without a transaction hash/i);
  expect(() => reconcileHomesProfitLedger({ ...base, distributions: [{ ...distribution, snapshotBlock: null }] }))
    .toThrow(/without a snapshot block/i);
});

test("the snapshot carries its last independently verified block", () => {
  const snapshot = currentHomesSnapshot();
  expect(snapshot.chain.lastVerifiedBlock).toBe(67_921_152);
  expect(typeof snapshot.chain.verifiedAtISO).toBe("string");
  expect(snapshot.profitLedger).toEqual([]);
});

test("unclassified addresses fail closed instead of entering holder distributions", () => {
  const eligible = eligibleHomesHolders([
    { address: `0x${"a".repeat(40)}` as `0x${string}`, staked: BigInt(10) },
    { address: `0x${"b".repeat(40)}` as `0x${string}`, staked: BigInt(5), classification: "community" },
  ]);

  expect(eligible.map((holder) => holder.address)).toEqual([`0x${"b".repeat(40)}`]);
});

test("a cancelled property program distributes its unspent purchase fund to the top 50 eligible holders", () => {
  const holders = Array.from({ length: 55 }, (_, index) => ({
    address: `0x${String(index).padStart(40, "0")}` as `0x${string}`,
    staked: BigInt(index + 1),
    classification: index === 54 ? "team" as const : "community" as const,
  }));
  const result = homesWindDownPayouts(BigInt(50_000), holders);

  expect(HOMES_WIND_DOWN_HOLDER_LIMIT).toBe(50);
  expect(result.eligible).toHaveLength(50);
  expect(result.eligible.some((holder) => holder.classification === "team")).toBe(false);
  expect(result.payouts.reduce((sum, payout) => sum + payout.amount, BigInt(0)) + result.unallocated).toBe(BigInt(50_000));
});
