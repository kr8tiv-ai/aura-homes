import { expect, test } from "playwright/test";
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
} from "@/lib/homes/token";
import {
  HOMES_TRUTH_REGISTRY,
  type HomesTruthRegistry,
  validateHomesTruthRegistry,
} from "@/lib/homes/truthRegistry";

const claim = (id: string) => {
  const found = HOMES_TRUTH_REGISTRY.claims.find((entry) => entry.id === id);
  expect(found, `missing required claim ${id}`).toBeDefined();
  return found!;
};

const mutableRegistry = (): HomesTruthRegistry =>
  structuredClone(HOMES_TRUTH_REGISTRY) as HomesTruthRegistry;

test("the canonical registry derives every live identity and fee fact from its pinned sources", () => {
  expect(validateHomesTruthRegistry(HOMES_TRUTH_REGISTRY)).toEqual([]);

  expect(claim("network.chainId").value).toBe(HOMES_TOKEN_CHAIN_ID);
  expect(claim("token.address").value).toBe(HOMES_TOKEN_ADDRESS);
  expect(claim("token.totalSupply").value).toBe(mintVerification.totalSupply.tokens);
  expect(claim("venue.poolAddress").value).toBe(HOMES_POOL_ADDRESS.toLowerCase());
  expect(claim("venue.lockerAddress").value).toBe(HOMES_LOCKER_ADDRESS.toLowerCase());
  expect(claim("venue.creatorWallet").value).toBe(HOMES_CREATOR_WALLET);
  expect(claim("venue.quoteAsset").value).toBe(HOMES_QUOTE_ASSET);
  expect(claim("venue.swapFeePercent").value).toBe(XLAUNCH_SWAP_FEE_PERCENT);
  expect(claim("venue.creatorQuoteSharePercent").value).toBe(XLAUNCH_CREATOR_FEE_SHARE_PERCENT);

  const knownSources = new Set(HOMES_TRUTH_REGISTRY.sources.map((source) => source.id));
  for (const fact of HOMES_TRUTH_REGISTRY.claims.filter((entry) =>
    entry.status === "verified-onchain" || entry.status === "source-reported"
  )) {
    expect(fact.sourceIds.length, `${fact.id} has no source`).toBeGreaterThan(0);
    expect(fact.sourceIds.every((sourceId) => knownSources.has(sourceId))).toBe(true);
  }
});

test("network, token, venue, and verification metadata is explicit rather than inferred", () => {
  expect(claim("network.name").value).toBe("X Layer");
  expect(claim("network.nativeAsset").value).toBe("OKB");
  expect(claim("network.rpc").value).toBe(mintVerification.rpc);
  expect(claim("token.name").value).toBe(mintVerification.token.name);
  expect(claim("token.symbol").value).toBe(mintVerification.token.symbol);
  expect(claim("token.decimals").value).toBe(mintVerification.token.decimals);
  expect(claim("token.launchedAt").value).toBe(HOMES_LAUNCHED_ISO);
  expect(claim("token.lastVerifiedBlock").value).toBe(mintVerification.block);
  expect(claim("token.lastVerifiedAt").value).toBe(mintVerification.verifiedAt);
  expect(claim("venue.name").value).toBe("XLaunch");
  expect(claim("venue.liquidityRule").value).toBe("locked-no-withdraw-path");
  expect(claim("venue.quoteAssetIssuerCanPauseTransfers").value).toBe(true);
});

test("token existence leaves every treasury, fund, property, ownership, return, and distribution claim explicitly unestablished", () => {
  const expectedBoundaries = [
    "treasury.address",
    "staking.address",
    "fees.claimReceipts",
    "fund.legalVehicle",
    "fund.houseFunding",
    "property.claims",
    "holder.ownershipRights",
    "holder.equityRights",
    "holder.returnRights",
    "distributions.receipts",
  ];

  for (const id of expectedBoundaries) {
    const boundary = claim(id);
    expect(["unknown", "not-established"]).toContain(boundary.status);
    expect(boundary.value, `${id} invents a value`).toBeNull();
    expect(boundary.sourceIds, `${id} treats a source as legal authorization`).toEqual([]);
    expect(boundary.missingEvidence?.length, `${id} does not name its missing gate`).toBeGreaterThan(20);
  }
});

test("the validator rejects duplicate and unresolved source identifiers", () => {
  const duplicate = mutableRegistry();
  (duplicate.sources as typeof duplicate.sources[number][]).push({ ...duplicate.sources[0] });
  expect(validateHomesTruthRegistry(duplicate)).toContain("duplicate source id: xlayer-network-docs");

  const unresolved = mutableRegistry();
  const address = unresolved.claims.find((entry) => entry.id === "token.address")!;
  (address.sourceIds as string[]).push("missing-source");
  expect(validateHomesTruthRegistry(unresolved)).toContain("token.address references unknown source: missing-source");
});

test("verified facts require dated block receipts while venue rules remain source-reported", () => {
  const noBlock = mutableRegistry();
  const mintSource = noBlock.sources.find((source) => source.id === "homes-mint-rpc")!;
  mintSource.blockNumber = null;
  expect(validateHomesTruthRegistry(noBlock)).toContain(
    "token.address verified-onchain source homes-mint-rpc has no block number",
  );

  const undated = mutableRegistry();
  undated.sources.find((source) => source.id === "xlaunch-docs")!.checkedAtISO = "whenever";
  expect(validateHomesTruthRegistry(undated)).toContain("source xlaunch-docs has an invalid checkedAtISO");

  const overclaimedVenueRule = mutableRegistry();
  overclaimedVenueRule.claims.find((entry) => entry.id === "venue.swapFeePercent")!.status = "verified-onchain";
  expect(validateHomesTruthRegistry(overclaimedVenueRule)).toContain(
    "venue.swapFeePercent must remain source-reported",
  );
});

test("legal and fund boundaries cannot be promoted, valued, duplicated, or omitted", () => {
  const promoted = mutableRegistry();
  const returns = promoted.claims.find((entry) => entry.id === "holder.returnRights")!;
  returns.status = "source-reported";
  returns.value = "15%";
  (returns.sourceIds as string[]).push("xlaunch-docs");
  returns.missingEvidence = null;
  expect(validateHomesTruthRegistry(promoted)).toContain(
    "holder.returnRights must remain not-established",
  );

  const inventedTreasury = mutableRegistry();
  inventedTreasury.claims.find((entry) => entry.id === "treasury.address")!.value = `0x${"a".repeat(40)}`;
  expect(validateHomesTruthRegistry(inventedTreasury)).toContain(
    "treasury.address unknown must not carry a value",
  );

  const omitted = mutableRegistry();
  const houseFundingIndex = omitted.claims.findIndex((entry) => entry.id === "fund.houseFunding");
  (omitted.claims as typeof omitted.claims[number][]).splice(houseFundingIndex, 1);
  expect(validateHomesTruthRegistry(omitted)).toContain("missing required claim: fund.houseFunding");

  const duplicate = mutableRegistry();
  (duplicate.claims as typeof duplicate.claims[number][]).push({
    ...duplicate.claims.find((entry) => entry.id === "network.chainId")!,
  });
  expect(validateHomesTruthRegistry(duplicate)).toContain("duplicate claim id: network.chainId");
});

test("mainnet token facts cannot drift into the separate testnet settlement lab", () => {
  const testnet = mutableRegistry();
  testnet.claims.find((entry) => entry.id === "network.chainId")!.value = 1952;
  expect(validateHomesTruthRegistry(testnet)).toContain(
    `network.chainId must equal pinned value ${HOMES_TOKEN_CHAIN_ID}`,
  );

  const wrongToken = mutableRegistry();
  wrongToken.claims.find((entry) => entry.id === "token.address")!.value = `0x${"b".repeat(40)}`;
  expect(validateHomesTruthRegistry(wrongToken)).toContain(
    `token.address must equal pinned value ${HOMES_TOKEN_ADDRESS}`,
  );

  const inventedSupply = mutableRegistry();
  inventedSupply.claims.find((entry) => entry.id === "token.totalSupply")!.value = 2_000_000_000;
  expect(validateHomesTruthRegistry(inventedSupply)).toContain(
    `token.totalSupply must equal pinned value ${mintVerification.totalSupply.tokens}`,
  );
});

test("the canonical registry is deeply frozen and deterministic", () => {
  expect(Object.isFrozen(HOMES_TRUTH_REGISTRY)).toBe(true);
  expect(Object.isFrozen(HOMES_TRUTH_REGISTRY.sources)).toBe(true);
  expect(Object.isFrozen(HOMES_TRUTH_REGISTRY.claims)).toBe(true);
  for (const source of HOMES_TRUTH_REGISTRY.sources) expect(Object.isFrozen(source)).toBe(true);
  for (const fact of HOMES_TRUTH_REGISTRY.claims) {
    expect(Object.isFrozen(fact)).toBe(true);
    expect(Object.isFrozen(fact.sourceIds)).toBe(true);
  }

  const before = JSON.stringify(HOMES_TRUTH_REGISTRY);
  expect(() => {
    (HOMES_TRUTH_REGISTRY.claims[0] as { value: unknown }).value = 1952;
  }).toThrow();
  expect(JSON.stringify(HOMES_TRUTH_REGISTRY)).toBe(before);
});

test("asserted facts need values and sources while boundary states need named missing evidence", () => {
  const unsourced = mutableRegistry();
  const pool = unsourced.claims.find((entry) => entry.id === "venue.poolAddress")!;
  (pool.sourceIds as string[]).splice(0);
  expect(validateHomesTruthRegistry(unsourced)).toContain(
    "venue.poolAddress source-reported must carry at least one source",
  );

  const downgraded = mutableRegistry();
  downgraded.claims.find((entry) => entry.id === "token.address")!.status = "source-reported";
  expect(validateHomesTruthRegistry(downgraded)).toContain(
    "token.address must remain verified-onchain",
  );

  const unexplained = mutableRegistry();
  unexplained.claims.find((entry) => entry.id === "fund.legalVehicle")!.missingEvidence = "";
  expect(validateHomesTruthRegistry(unexplained)).toContain(
    "fund.legalVehicle not-established must name missing evidence",
  );
});

test("malformed sources and undeclared claim shapes fail closed", () => {
  const malformedSource = mutableRegistry();
  malformedSource.sources[0].id = "../network";
  malformedSource.sources[0].uri = "javascript:alert(1)";
  expect(validateHomesTruthRegistry(malformedSource)).toEqual(expect.arrayContaining([
    "invalid source id: ../network",
    "source ../network has an invalid uri",
  ]));

  const inventedClaim = mutableRegistry();
  (inventedClaim.claims as typeof inventedClaim.claims[number][]).push({
    id: "holder.guaranteedYield",
    status: "source-reported",
    value: "20%",
    sourceIds: ["xlaunch-docs"],
    limitation: "none",
    missingEvidence: null,
  });
  expect(validateHomesTruthRegistry(inventedClaim)).toContain(
    "unexpected claim id: holder.guaranteedYield",
  );
});

test("the registry schema and source catalog cannot silently drift", () => {
  const wrongSchema = mutableRegistry();
  (wrongSchema as { schema: string }).schema = "homes-truth-registry/v2";
  wrongSchema.asOfISO = "sometime";
  expect(validateHomesTruthRegistry(wrongSchema)).toEqual(expect.arrayContaining([
    "invalid registry schema: homes-truth-registry/v2",
    "registry has an invalid asOfISO",
  ]));

  const redirected = mutableRegistry();
  redirected.sources.find((source) => source.id === "xlaunch-docs")!.uri = "https://example.com/rules";
  expect(validateHomesTruthRegistry(redirected)).toContain(
    "source xlaunch-docs uri does not match its pinned source",
  );

  const missing = mutableRegistry();
  const sourceIndex = missing.sources.findIndex((source) => source.id === "xlaunch-docs");
  (missing.sources as typeof missing.sources[number][]).splice(sourceIndex, 1);
  expect(validateHomesTruthRegistry(missing)).toContain("missing required source: xlaunch-docs");

  const extra = mutableRegistry();
  (extra.sources as typeof extra.sources[number][]).push({
    id: "unreviewed-blog",
    kind: "venue-docs",
    title: "Unreviewed blog",
    uri: "https://example.com/blog",
    checkedAtISO: "2026-08-25",
    blockNumber: null,
  });
  expect(validateHomesTruthRegistry(extra)).toContain("unexpected source id: unreviewed-blog");
});

test("the on-chain receipt stays pinned and publisher claims cannot borrow RPC authority", () => {
  const movedBlock = mutableRegistry();
  movedBlock.sources.find((source) => source.id === "homes-mint-rpc")!.blockNumber =
    mintVerification.block + 1;
  expect(validateHomesTruthRegistry(movedBlock)).toContain(
    `source homes-mint-rpc block must equal mint receipt ${mintVerification.block}`,
  );

  const movedTimestamp = mutableRegistry();
  movedTimestamp.sources.find((source) => source.id === "homes-mint-rpc")!.checkedAtISO =
    "2026-08-25T00:00:00.000Z";
  expect(validateHomesTruthRegistry(movedTimestamp)).toContain(
    `source homes-mint-rpc timestamp must equal mint receipt ${mintVerification.verifiedAt}`,
  );

  const borrowedAuthority = mutableRegistry();
  const venueFee = borrowedAuthority.claims.find((entry) => entry.id === "venue.swapFeePercent")!;
  (venueFee.sourceIds as string[]).splice(0, venueFee.sourceIds.length, "homes-mint-rpc");
  expect(validateHomesTruthRegistry(borrowedAuthority)).toContain(
    "venue.swapFeePercent source-reported has no publisher source",
  );
});

test("each claim keeps its reviewed source assignment", () => {
  const wrongPublisher = mutableRegistry();
  const venueFee = wrongPublisher.claims.find((entry) => entry.id === "venue.swapFeePercent")!;
  (venueFee.sourceIds as string[]).splice(0, venueFee.sourceIds.length, "founder-mainnet-record");
  expect(validateHomesTruthRegistry(wrongPublisher)).toContain(
    "venue.swapFeePercent source ids do not match the pinned registry",
  );

  const borrowedPublisher = mutableRegistry();
  const address = borrowedPublisher.claims.find((entry) => entry.id === "token.address")!;
  (address.sourceIds as string[]).push("xlayer-network-docs");
  expect(validateHomesTruthRegistry(borrowedPublisher)).toContain(
    "token.address source ids do not match the pinned registry",
  );
});
