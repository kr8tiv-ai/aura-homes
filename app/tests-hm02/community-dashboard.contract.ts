import { expect, test } from "playwright/test";
import {
  HOMES_COMMUNITY_DASHBOARD_VERSION,
  HOMES_USE_OF_FUNDS_CATEGORIES,
  HomesDashboardError,
  buildHomesCommunityDashboard,
  currentHomesCommunityDashboard,
} from "@/lib/homes/communityDashboard";
import {
  HOMES_TRUTH_REGISTRY,
  HOMES_TRUTH_REGISTRY_VERSION,
} from "@/lib/homes/truthRegistry";

const creator = `0x${"1".repeat(40)}`;
const treasury = `0x${"2".repeat(40)}`;
const tx = (character: string) => `0x${character.repeat(64)}`;

function receipt(id: string, character: string) {
  return {
    id,
    uri: `https://evidence.example/${id}`,
    transactionHash: tx(character) as string | null,
  };
}

function validEvidence() {
  return {
    schema: "homes-dashboard-evidence/v1",
    asOfISO: "2026-08-29",
    fees: [
      {
        id: "fee-openrouter-001",
        occurredAtISO: "2026-08-26",
        sourceId: "openrouter-usage",
        ruleVersion: "provider-cost-plus-15pct-v1",
        grossUsdMicros: "1150000",
        providerUsdMicros: "1000000",
        auraUsdMicros: "150000",
        receipt: receipt("receipt-fee-001", "a"),
      },
      {
        id: "fee-venue-001",
        occurredAtISO: "2026-08-27",
        sourceId: "xlaunch-claimable",
        ruleVersion: "venue-creator-share-v1",
        grossUsdMicros: "500000",
        providerUsdMicros: "200000",
        auraUsdMicros: "300000",
        receipt: receipt("receipt-fee-002", "b"),
      },
    ],
    claims: [
      {
        id: "claim-001",
        occurredAtISO: "2026-08-27",
        sourceFeeIds: ["fee-openrouter-001", "fee-venue-001"],
        destinationAddress: creator,
        amountUsdMicros: "400000",
        receipt: receipt("receipt-claim-001", "c"),
      },
    ],
    transfers: [
      {
        id: "transfer-001",
        occurredAtISO: "2026-08-28",
        fromAddress: creator,
        toAddress: treasury,
        amountUsdMicros: "250000",
        receipt: receipt("receipt-transfer-001", "d"),
      },
    ],
    useOfFunds: [
      {
        id: "spend-001",
        occurredAtISO: "2026-08-28",
        category: "design-and-diligence",
        recipientId: "vendor-architecture-001",
        amountUsdMicros: "50000",
        receipt: receipt("receipt-spend-001", "e"),
      },
      {
        id: "spend-002",
        occurredAtISO: "2026-08-29",
        category: "community-reporting",
        recipientId: "vendor-reporting-001",
        amountUsdMicros: "25000",
        receipt: receipt("receipt-spend-002", "f"),
      },
    ],
    balances: [
      {
        id: "balance-aura-001",
        occurredAtISO: "2026-08-29",
        account: "aura-claim",
        address: creator,
        amountUsdMicros: "150000",
        receipt: receipt("receipt-balance-aura-001", "1"),
      },
      {
        id: "balance-treasury-001",
        occurredAtISO: "2026-08-29",
        account: "treasury",
        address: treasury,
        amountUsdMicros: "175000",
        receipt: receipt("receipt-balance-treasury-001", "2"),
      },
    ],
  };
}

function expectInvalid(candidate: unknown) {
  try {
    buildHomesCommunityDashboard(candidate);
    throw new Error("expected invalid evidence");
  } catch (error) {
    expect(error).toBeInstanceOf(HomesDashboardError);
    expect(error).toMatchObject({ code: "invalid-evidence" });
    expect((error as Error).message).toBe("The HOMES dashboard evidence is invalid.");
  }
}

test("current dashboard binds the verified HM01 truth and keeps unknowns missing", () => {
  const dashboard = currentHomesCommunityDashboard();

  expect(dashboard.schema).toBe(HOMES_COMMUNITY_DASHBOARD_VERSION);
  expect(dashboard.truthRegistry).toEqual({
    schema: HOMES_TRUTH_REGISTRY_VERSION,
    asOfISO: HOMES_TRUTH_REGISTRY.asOfISO,
  });
  expect(dashboard.status).toBe("missing-evidence");
  expect(dashboard.evidenceClassification).toBe("receipt-attached-structural-only");
  expect(dashboard.truthGaps.map((gap) => gap.id)).toEqual(
    expect.arrayContaining(["fees.claimReceipts", "treasury.address"]),
  );
  expect(dashboard.missingData.map((gap) => gap.id)).toEqual(
    expect.arrayContaining(["fee-activity", "fee-claims", "aura-balance", "treasury-balance"]),
  );
  expect(dashboard.totals.grossFeesUsdMicros).toBe("0");
  expect(dashboard.totals.treasurySpendUsdMicros).toBe("0");
  expect(dashboard.totalsState).toBe("unverified-empty");
});

test("valid evidence separates and reconciles every money layer", () => {
  const dashboard = buildHomesCommunityDashboard(validEvidence());

  expect(dashboard.status).toBe("structurally-reconciled");
  expect(dashboard.totals).toEqual({
    grossFeesUsdMicros: "1650000",
    providerCostUsdMicros: "1200000",
    auraShareUsdMicros: "450000",
    claimedToAuraUsdMicros: "400000",
    unclaimedAuraShareUsdMicros: "50000",
    transferredToTreasuryUsdMicros: "250000",
    treasurySpendUsdMicros: "75000",
    expectedAuraBalanceUsdMicros: "150000",
    expectedTreasuryBalanceUsdMicros: "175000",
  });
  expect(dashboard.totalsState).toBe("receipt-attached");
  expect(dashboard.balances.aura).toMatchObject({
    status: "reconciled",
    expectedUsdMicros: "150000",
    reportedUsdMicros: "150000",
    deltaUsdMicros: "0",
  });
  expect(dashboard.balances.treasury).toMatchObject({
    status: "reconciled",
    expectedUsdMicros: "175000",
    reportedUsdMicros: "175000",
    deltaUsdMicros: "0",
  });
});

test("use-of-funds categories are stable, separate, and honestly classified", () => {
  const dashboard = buildHomesCommunityDashboard(validEvidence());

  expect(dashboard.useOfFunds.map((row) => row.category)).toEqual([...HOMES_USE_OF_FUNDS_CATEGORIES]);
  expect(dashboard.useOfFunds.find((row) => row.category === "design-and-diligence")).toEqual({
    category: "design-and-diligence",
    amountUsdMicros: "50000",
    evidenceState: "receipt-attached",
  });
  expect(dashboard.useOfFunds.find((row) => row.category === "reserve")).toEqual({
    category: "reserve",
    amountUsdMicros: "0",
    evidenceState: "unverified-empty",
  });
});

test("absent reported balances stay missing instead of becoming verified zero", () => {
  const candidate = validEvidence();
  candidate.balances = [];
  const dashboard = buildHomesCommunityDashboard(candidate);

  expect(dashboard.status).toBe("missing-evidence");
  expect(dashboard.balances.aura).toMatchObject({ status: "missing", reportedUsdMicros: null });
  expect(dashboard.balances.treasury).toMatchObject({ status: "missing", reportedUsdMicros: null });
  expect(dashboard.missingData.map((gap) => gap.id)).toEqual(
    expect.arrayContaining(["aura-balance", "treasury-balance"]),
  );
});

test("broken fee splits, overclaims, overtransfers, overspend, and balance drift fail closed", () => {
  const brokenSplit = validEvidence();
  brokenSplit.fees[0].auraUsdMicros = "149999";
  expectInvalid(brokenSplit);

  const overclaim = validEvidence();
  overclaim.claims[0].amountUsdMicros = "450001";
  expectInvalid(overclaim);

  const overtransfer = validEvidence();
  overtransfer.transfers[0].amountUsdMicros = "400001";
  expectInvalid(overtransfer);

  const overspend = validEvidence();
  overspend.useOfFunds[0].amountUsdMicros = "250001";
  expectInvalid(overspend);

  const balanceDrift = validEvidence();
  balanceDrift.balances[1].amountUsdMicros = "174999";
  expectInvalid(balanceDrift);
});

test("claims reference known fees and cannot count one fee twice", () => {
  const unknown = validEvidence();
  unknown.claims[0].sourceFeeIds = ["fee-missing-001"];
  expectInvalid(unknown);

  const duplicatedAcrossClaims = validEvidence();
  duplicatedAcrossClaims.claims.push({
    ...duplicatedAcrossClaims.claims[0],
    id: "claim-002",
    amountUsdMicros: "1",
    receipt: receipt("receipt-claim-002", "3"),
  });
  expectInvalid(duplicatedAcrossClaims);
});

test("non-zero events require unique receipt identities and provenance", () => {
  const missing = validEvidence();
  missing.fees[0].receipt.uri = "";
  missing.fees[0].receipt.transactionHash = null;
  expectInvalid(missing);

  const duplicate = validEvidence();
  duplicate.transfers[0].receipt.id = duplicate.claims[0].receipt.id;
  expectInvalid(duplicate);

  const duplicateTx = validEvidence();
  duplicateTx.useOfFunds[0].receipt.transactionHash = duplicateTx.claims[0].receipt.transactionHash;
  expectInvalid(duplicateTx);
});

test("money accepts only canonical bounded non-negative integer USD micros", () => {
  for (const invalid of ["-1", "+1", "01", "1.0", "1e3", " 1", "", "9007199254740992"]) {
    const candidate = validEvidence();
    candidate.fees[0].grossUsdMicros = invalid;
    expectInvalid(candidate);
  }
});

test("unknown keys, unsafe identifiers, chronology drift, and categories fail closed", () => {
  const unknownKey = validEvidence() as ReturnType<typeof validEvidence> & { promotionalClaim?: string };
  unknownKey.promotionalClaim = "guaranteed returns";
  expectInvalid(unknownKey);

  const badCategory = validEvidence();
  badCategory.useOfFunds[0].category = "founder-discretion";
  expectInvalid(badCategory);

  const futureEvent = validEvidence();
  futureEvent.transfers[0].occurredAtISO = "2026-08-30";
  expectInvalid(futureEvent);

  const earlyClaim = validEvidence();
  earlyClaim.claims[0].occurredAtISO = "2026-08-25";
  expectInvalid(earlyClaim);

  const earlyTransfer = validEvidence();
  earlyTransfer.transfers[0].occurredAtISO = "2026-08-26";
  expectInvalid(earlyTransfer);

  const earlySpend = validEvidence();
  earlySpend.useOfFunds[0].occurredAtISO = "2026-08-27";
  expectInvalid(earlySpend);

  const staleBalance = validEvidence();
  staleBalance.balances[0].occurredAtISO = "2026-08-28";
  expectInvalid(staleBalance);

  const unsafeId = validEvidence();
  unsafeId.fees[0].sourceId = "../private";
  expectInvalid(unsafeId);
});

test("accessors and hostile proxies fail safely without invoking private values", () => {
  let invoked = false;
  const accessor = validEvidence() as Record<string, unknown>;
  Object.defineProperty(accessor, "fees", {
    enumerable: true,
    get() {
      invoked = true;
      throw new Error("PRIVATE_LEDGER_SECRET");
    },
  });
  expectInvalid(accessor);
  expect(invoked).toBe(false);

  const { proxy, revoke } = Proxy.revocable(validEvidence(), {});
  revoke();
  expectInvalid(proxy);
});

test("custom prototypes, cycles, symbols, and sparse arrays fail closed", () => {
  const custom = validEvidence();
  Object.setPrototypeOf(custom, { hidden: "authority" });
  expectInvalid(custom);

  const cyclic = validEvidence() as ReturnType<typeof validEvidence> & { cycle?: unknown };
  cyclic.cycle = cyclic;
  expectInvalid(cyclic);

  const symbolic = validEvidence() as ReturnType<typeof validEvidence> & { [key: symbol]: string };
  symbolic[Symbol("hidden")] = "authority";
  expectInvalid(symbolic);

  const sparse = validEvidence();
  sparse.fees.length = 4;
  expectInvalid(sparse);
});

test("output is detached, deeply frozen, stably ordered, and deterministic", () => {
  const input = validEvidence();
  const first = buildHomesCommunityDashboard(input);
  const second = buildHomesCommunityDashboard(validEvidence());
  const before = JSON.stringify(first);

  input.fees[0].grossUsdMicros = "0";
  input.useOfFunds[0].recipientId = "mutated";
  expect(JSON.stringify(first)).toBe(before);
  expect(first).toEqual(second);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.activity)).toBe(true);
  expect(Object.isFrozen(first.activity.fees[0].receipt)).toBe(true);
  expect(Object.isFrozen(first.useOfFunds)).toBe(true);
  expect(first.activity.fees.map((row) => row.id)).toEqual(["fee-openrouter-001", "fee-venue-001"]);
});

test("module remains a pure model with no runtime or visual-system dependencies", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile("lib/homes/communityDashboard.ts", "utf8"),
  );

  expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/);
  expect(source).not.toMatch(/wagmi|viem|openrouter|wallet|sendTransaction|writeContract/i);
  expect(source).not.toMatch(/react|\.css|three|renderer|geometry|animation|shader|camera/i);
  expect(source).not.toMatch(/app\/app\/|components\//);
});
