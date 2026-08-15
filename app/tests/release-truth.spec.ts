import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, test } from "playwright/test";
import {
  HOMES_CREATOR_WALLET,
  HOMES_LAUNCHED_ISO,
  HOMES_POOL_ADDRESS,
  HOMES_TOKEN_ADDRESS,
  HOMES_TOKEN_CHAIN_ID,
} from "@/lib/homes/token";
import { currentHomesSnapshot, type HomesSnapshot } from "@/lib/homes/fund";

const repoRoot = resolve(process.cwd(), "..");
const readRepo = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

test("public lifecycle and FAQ describe design intent, pilot data, and project-specific advice", () => {
  const lifecycle = readRepo("app/app/how-it-works/page.tsx");
  const faq = readRepo("app/app/faq/page.tsx");

  expect(lifecycle).toContain("deterministic geometry checks");
  expect(lifecycle).toContain("demonstration or user-supplied parcel facts");
  expect(lifecycle).toContain("Record the checks you perform");
  expect(lifecycle).not.toContain("real code checks");
  expect(lifecycle).not.toContain("against real parcel facts");

  expect(faq).toContain("800 sq ft Alberta reference scenario");
  expect(faq).toContain("Requirements vary by project and jurisdiction");
  expect(faq).toContain("Aura does not sell or ship an AWG");
  expect(faq).not.toContain("every Aura home ships");
  expect(faq).not.toContain("No. Alberta's Architects Act");
});

test("the public licence claim separates MIT software from plan-study licences", () => {
  const shell = readRepo("app/components/SiteShell.tsx");
  const faq = readRepo("app/app/faq/page.tsx");
  const submission = readRepo("docs/SUBMISSION.md");
  const notice = readRepo("NOTICE.md");

  expect(shell).toContain("MIT software · Plan studies keep their listed licences");
  expect(shell).not.toContain("Open source (MIT)");
  expect(faq).toContain("Aura's software is MIT-licensed");
  expect(faq).not.toContain("MIT, end to end");
  expect(submission).toContain("software is MIT-licensed; individual plan studies retain their listed licences");
  expect(notice).toContain("CC BY-SA");
  expect(notice).toContain("This notice does not relicense third-party material");
});

test("X Layer copy names the valueless test token and the currently empty public state", () => {
  const chains = readRepo("app/lib/chains.ts");
  const contracts = readRepo("app/lib/contracts.ts");
  const education = readRepo("app/app/how-crypto-works/page.tsx");
  const lab = readRepo("app/app/labs/xlayer-proof/XLayerProofLab.tsx");
  const deployments = readRepo("docs/DEPLOYMENTS.md");

  for (const source of [chains, contracts, lab]) {
    expect(source).toContain("faucet-compatible");
  }
  expect(contracts).not.toContain("Native Circle USDC on X Layer testnet");
  expect(lab).not.toContain("Native testnet USDC");
  expect(lab).not.toContain("Native USDC —");
  expect(education).toContain("zero milestones and zero home records");
  expect(education).not.toContain("project milestones and document fingerprints written");
  expect(education).not.toContain("inheriting security from Ethereum-style tooling");
  expect(deployments).toContain("Creation receipts prove deployment, not a funded lifecycle or physical work");

  const testnetRuntimeFiles = [
    "app/components/concierge/ConciergeApp.tsx",
    "app/lib/hooks.ts",
    "app/lib/payments/xLayerLifecycle.ts",
    "app/lib/escrowAbi.ts",
    "app/scripts/emit-abi.mjs",
    "contracts/contracts/AuraBuildEscrow.sol",
    "contracts/contracts/test/MockUSDC.sol",
    "contracts/scripts/deploy.js",
    "contracts/scripts/demo-lifecycle.js",
  ];
  for (const path of testnetRuntimeFiles) {
    expect(readRepo(path), path).not.toMatch(/native USDC/i);
  }
});

test("roadmap and submission use the canonical explorer and experimental-testnet wording", () => {
  const roadmap = readRepo("app/app/roadmap/page.tsx");
  const submission = readRepo("docs/SUBMISSION.md");

  expect(roadmap).toContain('const OKLINK = "https://www.oklink.com/x-layer-testnet/address"');
  expect(roadmap).toContain("Experimental transaction-mechanics contracts are deployed");
  expect(roadmap).toContain("proves transaction execution, not lifecycle facts");
  expect(submission).toContain("Experimental contracts deployed to **X Layer testnet 1952**");
  expect(submission).toContain("zero milestones and zero home records");
  expect(submission).not.toContain("proof lab with public receipts");
});

/* ===========================================================================
 * TR02 — deployment and token STATUS prose, derived from code.
 *
 * The tests above pin WORDING: a human decided a sentence was honest and
 * froze it. That catches a banned phrase coming back. It cannot catch prose
 * going stale against reality, because nothing in it reads reality.
 *
 * The defect that motivated this node: docs/DEPLOYMENTS.md asserted "Aura
 * remains testnet-only … no HOMES token" for a full day after the token went
 * live and eleven other surfaces had been corrected. An external audit found
 * it by reading. Every expected value below is therefore read out of
 * lib/homes/token.ts and lib/homes/fund.ts — never typed a second time here,
 * which would only prove that two people typed the same thing.
 *
 * Why documents and not pages: the /homes pages render FROM token.ts, so they
 * cannot drift. Prose is hand-typed, so it is the only surface that can.
 * ======================================================================== */

/** A document QUOTING a sentence is reporting it, not asserting it.
 * DEPLOYMENTS.md's own provenance footnote quotes the historical error
 * verbatim, and a journal entry retells it; both are honest writing about a
 * past mistake. A document RE-ASSERTING the sentence would not put it in
 * quotes. Stripping quoted spans is what separates the two, and it is the
 * difference between a gate that reads and one that pattern-matches. */
/* No `s` flag: the repo's tsconfig sets no `target`, and a negated character
   class already spans newlines, so `[^"]*` crosses the line breaks that real
   quoted passages contain. Verified against the two multi-line quotations in
   the tree (DEPLOYMENTS.md's footnote and the 2026-08-14 journal entry). */
const withoutQuotedSpans = (markdown: string) =>
  markdown.replace(/"[^"]*"/g, '""').replace(/“[^”]*”/g, '""');

/** Prose that asserts the HOMES token does not exist. Deliberately scoped to
 * the TOKEN: "testnet-only" alone is a true and necessary statement about the
 * escrow/registry contracts (contracts/README.md says it correctly), so a
 * blanket ban on the phrase would punish honest writing. */
const TOKEN_DENIAL_PATTERNS = [
  /\bno\s+\$?HOMES\s+token\b/i,
  /\bAura\s+remains\s+testnet[-\s‐-―]?only\b/i,
  /\$?HOMES\s+token\s+(?:does\s+not|doesn't)\s+exist/i,
  /\bthere\s+is\s+no\s+\$?HOMES\b/i,
  /\bno\s+token\s+contract\b/i,
];

const tokenDenialsIn = (markdown: string) => {
  const asserted = withoutQuotedSpans(markdown);
  return TOKEN_DENIAL_PATTERNS.filter((pattern) => pattern.test(asserted));
};

/** Both spellings the repo uses for a launch date, derived from the single
 * ISO constant so neither is a second hand-typed fact. */
const launchDateForms = (iso: string): string[] => [
  iso,
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }),
];

/** What the documents owe the reader, decided by the CODE's status rather
 * than by this spec. When the snapshot says the token is live, deployment
 * prose must carry its receipt; when it does not, deployment prose must not
 * publish one. Both directions matter — a document that announces a live
 * token before the code agrees is the same defect pointed the other way. */
function requiredTokenReceipt(snapshot: HomesSnapshot) {
  if (snapshot.status !== "live" || snapshot.chain.tokenAddress === null) {
    return { live: false as const };
  }
  return {
    live: true as const,
    address: snapshot.chain.tokenAddress.toLowerCase(),
    chainId: snapshot.chain.chainId,
  };
}

const markdownFilesInRepo = (): string[] => {
  const skip = new Set([
    "node_modules", ".git", ".next", "out", "dist", "coverage",
    "test-results", "playwright-report", "artifacts",
  ]);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) found.push(relative(repoRoot, full).replace(/\\/g, "/"));
    }
  };
  walk(repoRoot);
  return found;
};

/** One known-bad sentence per denial pattern, positionally paired with
 * TOKEN_DENIAL_PATTERNS. These are hand-typed on purpose: a fixture is test
 * INPUT (a document that must be rejected), not an expected value standing in
 * for a code fact.
 *
 * Each fixture is deliberately MINIMAL — worded so that only its own pattern
 * matches it. That is what makes the pairing falsifiable. An earlier version
 * of this test used one rich sentence and asserted "some pattern matched"; a
 * mutation run proved that gate hollow, because deleting a pattern still left
 * two others matching and the test stayed green. */
const DENIAL_FIXTURES = [
  "The ledger records no HOMES token at this time.",
  "Aura remains testnet only.",
  "The HOMES token does not exist.",
  "As of today there is no $HOMES on any mainnet.",
  "The dashboard shows no token contract.",
];

test("every denial pattern is load-bearing and none is dead", () => {
  /* Pins the pairing: deleting a pattern (the exact way this detector would
     rot) breaks this line rather than passing quietly. */
  expect(
    TOKEN_DENIAL_PATTERNS.length,
    "each denial pattern needs its own known-bad fixture",
  ).toBe(DENIAL_FIXTURES.length);

  TOKEN_DENIAL_PATTERNS.forEach((pattern, index) => {
    const fixture = DENIAL_FIXTURES[index];
    expect(pattern.test(fixture), `${pattern} no longer detects its own fixture`).toBe(true);

    /* ...and it is the SOLE detector of that fixture, so weakening this one
       pattern cannot be masked by the redundancy of its neighbours. */
    const others = TOKEN_DENIAL_PATTERNS.filter((_, other) => other !== index);
    expect(
      others.some((candidate) => candidate.test(fixture)),
      `fixture "${fixture}" is matched by more than one pattern, so losing ${pattern} would go unnoticed`,
    ).toBe(false);
  });
});

test("the denial detector recognizes the historical DEPLOYMENTS.md defect", () => {
  /* The sentence the external audit actually found, kept verbatim so this
     gate stays anchored to the defect that motivated it. */
  const historicalDefect =
    "Aura remains testnet-only, and there is no HOMES token deployed anywhere.";
  expect(tokenDenialsIn(historicalDefect).length).toBeGreaterThan(0);

  /* ...and the same sentence, quoted as history, must NOT trip it — otherwise
     the correction note that records the mistake becomes unwritable, and
     DEPLOYMENTS.md's own provenance footnote could never have been written. */
  const quotedAsProvenance =
    'The ledger wrongly read "Aura remains testnet-only … no HOMES token" for a day.';
  expect(tokenDenialsIn(quotedAsProvenance)).toEqual([]);
});

test("requiredTokenReceipt follows the code's status in both directions", () => {
  const live = currentHomesSnapshot();
  const liveReceipt = requiredTokenReceipt(live);
  expect(liveReceipt.live).toBe(live.status === "live" && live.chain.tokenAddress !== null);

  /* A synthesized pre-launch snapshot proves the other branch without editing
     lib/homes/fund.ts, which is outside this node's write set. */
  const planned: HomesSnapshot = {
    ...live,
    status: "planned",
    chain: { ...live.chain, tokenAddress: null, chainId: null },
  };
  expect(requiredTokenReceipt(planned)).toEqual({ live: false });

  /* The snapshot must also agree with the token module it claims to describe;
     two live sources of the same address is exactly the drift being gated. */
  if (live.status === "live") {
    expect(live.chain.tokenAddress).toBe(HOMES_TOKEN_ADDRESS);
    expect(live.chain.chainId).toBe(HOMES_TOKEN_CHAIN_ID);
  }
});

test("the deployment ledger's mainnet section matches the token module", () => {
  const deployments = readRepo("docs/DEPLOYMENTS.md");
  const receipt = requiredTokenReceipt(currentHomesSnapshot());

  const headingIndex = deployments.search(/^##\s+Mainnet\b/m);
  expect(headingIndex, "docs/DEPLOYMENTS.md must carry a '## Mainnet' section").toBeGreaterThan(-1);
  const mainnet = deployments.slice(headingIndex);

  if (!receipt.live) {
    /* Code says the token is not live: the ledger must not publish a receipt
       for one. */
    expect(mainnet.toLowerCase()).not.toContain(HOMES_TOKEN_ADDRESS.toLowerCase());
    return;
  }

  /* Code says the token is live. The ledger owes the reader every fact the
     code holds — this is the assertion the historical defect would have
     failed, because that version of the document named none of them. */
  expect(mainnet.toLowerCase(), "mainnet section must publish the live token address")
    .toContain(receipt.address);
  expect(mainnet, "mainnet section must name the token's chain id")
    .toMatch(new RegExp(`\\b${receipt.chainId}\\b`));
  expect(mainnet.toLowerCase(), "mainnet section must publish the creator fee-claim wallet")
    .toContain(HOMES_CREATOR_WALLET.toLowerCase());
  expect(
    launchDateForms(HOMES_LAUNCHED_ISO).some((form) => mainnet.includes(form)),
    `mainnet section must date the launch as one of ${launchDateForms(HOMES_LAUNCHED_ISO).join(" or ")}`,
  ).toBe(true);

  /* And it must not, in its own voice, deny what it just published. */
  expect(
    tokenDenialsIn(deployments).map(String),
    "docs/DEPLOYMENTS.md asserts the HOMES token does not exist while the code says it is live",
  ).toEqual([]);
});

test("no document denies the live token without also carrying its address", () => {
  const receipt = requiredTokenReceipt(currentHomesSnapshot());
  const files = markdownFilesInRepo();

  /* Anti-vacuity: a broken walk that returned nothing would make every
     assertion below pass. Name the files the sweep must have reached. */
  expect(files).toContain("docs/DEPLOYMENTS.md");
  expect(files).toContain("README.md");
  expect(files).toContain("docs/MAINNET-DECISION-BRIEF.md");

  if (!receipt.live) return;

  const offenders = files.filter((path) => {
    const markdown = readRepo(path);
    if (tokenDenialsIn(markdown).length === 0) return false;
    return !markdown.toLowerCase().includes(receipt.address);
  });

  /* The generalized form of the historical defect: a document may discuss the
     pre-launch state, but it may not leave a reader believing the token does
     not exist while never naming the token that does. */
  expect(
    offenders,
    "these documents deny the HOMES token and never publish its live address",
  ).toEqual([]);
});

test("every published venue and explorer link resolves to a token-module address", () => {
  const linkedAddress =
    /(?:xlaunch\.fun\/token\/|web3\.okx\.com\/explorer\/x-layer\/address\/|geckoterminal\.com\/x-layer\/pools\/)(0x[0-9a-fA-F]{40})/g;
  const known = new Set(
    [HOMES_TOKEN_ADDRESS, HOMES_CREATOR_WALLET, HOMES_POOL_ADDRESS].map((address) =>
      address.toLowerCase(),
    ),
  );

  const drifted: string[] = [];
  let scanned = 0;
  for (const path of markdownFilesInRepo()) {
    const markdown = readRepo(path);
    /* exec loop rather than matchAll: no `target` in tsconfig, so iterating a
       RegExpStringIterator does not compile. lastIndex is reset per file. */
    linkedAddress.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = linkedAddress.exec(markdown)) !== null) {
      scanned += 1;
      const address = match[1].toLowerCase();
      if (!known.has(address)) drifted.push(`${path}: ${address}`);
    }
  }

  /* A published link is the one place a mistyped address costs a reader money,
     and it is invisible to a wording pin because the sentence around it stays
     correct. Guard the sweep against reaching zero links, too. */
  expect(scanned, "no venue or explorer links found to check").toBeGreaterThan(0);
  expect(drifted, "published links point at addresses no token module defines").toEqual([]);
});
