import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_HISTORICAL_REGISTRY,
  hashFounderDecisionChange,
  hashFounderDecisionSourcePayload,
  validateFounderDecisionSourceRecord,
  validateFounderDecisionSources,
  validateFounderDecisionLedger,
  validateFounderDecisionRepositoryTransition,
  validateFounderDecisionTransition,
} from "./founder-decision-ledger.mjs";

const registryUrl = new URL("../../docs/plans/registry/decisions.json", import.meta.url);
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const ledger = () => JSON.parse(readFileSync(registryUrl, "utf8"));

const validChange = (base, overrides = {}) => {
  const change = {
    id: "FD-2026-08-25-example",
    recordedAtISO: "2026-08-25T12:00:00.000Z",
    effectiveDate: "2026-08-25",
    state: "recorded-pending-graph",
    decision: "Example founder direction recorded without granting execution authority.",
    scope: {
      clauses: ["§18.2"],
      nodes: ["G04"],
    },
    authority: {
      actor: "founder",
      sourceType: "repo-founder-record",
      sourcePath: "docs/plans/approvals/2026-08-25-example.md",
      sourceCommit: "a".repeat(40),
    },
    supersedes: [],
    previousEntrySha256: base.genesisSha256,
    entrySha256: "",
    ...overrides,
  };
  change.entrySha256 = hashFounderDecisionChange(change);
  return change;
};

test("the checked-in ledger pins the approved Graph v2 seed and inherited registry", () => {
  const current = ledger();
  assert.deepEqual(validateFounderDecisionLedger(current), []);
  assert.deepEqual(
    validateFounderDecisionSources(current, new URL("../..", import.meta.url)),
    [],
  );
  assert.equal(current.authoritySeed.proposalCommit, "f7616886f9f8a171c847ef5eb49e932246ff989b");
  assert.equal(current.authoritySeed.approvalCommit, "e031a83b8d9dcd428ffaab46d83b39370f2962a0");
  assert.equal(current.authoritySeed.decisionIds.length, 20);
  assert.equal(current.changes.length, 0);
});

test("unknown root and nested fields cannot smuggle authority or promotional claims", () => {
  const root = ledger();
  root.chatSummary = "approved by the agent";
  assert.match(validateFounderDecisionLedger(root).join("\n"), /unknown key chatSummary/);

  const seed = ledger();
  seed.authoritySeed.guaranteedReturn = "15%";
  assert.match(validateFounderDecisionLedger(seed).join("\n"), /authoritySeed.*unknown key guaranteedReturn/);

  const changed = ledger();
  const entry = validChange(changed);
  entry.scope.unreviewed = true;
  changed.changes.push(entry);
  assert.match(validateFounderDecisionLedger(changed).join("\n"), /scope.*unknown key unreviewed/);
});

test("changes require real dates, explicit scope, founder authority, and a repository source", () => {
  const current = ledger();
  current.changes.push(validChange(current, {
    recordedAtISO: "2026-02-31T12:00:00.000Z",
    effectiveDate: "9999-12-31",
    scope: { clauses: [], nodes: [] },
    authority: {
      actor: "agent",
      sourceType: "chat-summary",
      sourcePath: "https://example.com/chat",
      sourceCommit: "not-a-commit",
    },
  }));
  const errors = validateFounderDecisionLedger(current).join("\n");
  assert.match(errors, /recordedAtISO must be a real UTC timestamp/);
  assert.match(errors, /effectiveDate must be a real date/);
  assert.match(errors, /scope must name at least one clause or node/);
  assert.match(errors, /authority.actor must equal founder/);
  assert.match(errors, /authority.sourceType must equal repo-founder-record/);
  assert.match(errors, /authority.sourcePath must be a repository approval record/);
  assert.match(errors, /authority.sourceCommit must be a full Git commit/);
});

test("scope arrays are sets, and public hashing never invokes accessors", () => {
  const current = ledger();
  current.changes.push(validChange(current, {
    scope: { clauses: ["§18.2", "§18.2"], nodes: ["G04", "G04"] },
  }));
  const errors = validateFounderDecisionLedger(current).join("\n");
  assert.match(errors, /scope.clauses must not contain duplicates/);
  assert.match(errors, /scope.nodes must not contain duplicates/);

  const hostile = {};
  Object.defineProperty(hostile, "decision", {
    enumerable: true,
    get() {
      throw new Error("PRIVATE_HASH_VALUE");
    },
  });
  assert.throws(() => hashFounderDecisionChange(hostile), /cannot hash an unsafe decision change/);
  assert.doesNotMatch(
    (() => {
      try { hashFounderDecisionChange(hostile); } catch (error) { return String(error); }
      return "";
    })(),
    /PRIVATE_HASH_VALUE/,
  );
});

test("a valid appended change is hash-chained without silently becoming executable authority", () => {
  const current = ledger();
  const first = validChange(current);
  current.changes.push(first);
  assert.deepEqual(validateFounderDecisionLedger(current), []);
  assert.equal(first.state, "recorded-pending-graph");

  const second = validChange(current, {
    id: "FD-2026-08-26-approved-example",
    recordedAtISO: "2026-08-26T12:00:00.000Z",
    effectiveDate: "2026-08-26",
    previousEntrySha256: first.entrySha256,
    supersedes: [first.id],
  });
  second.entrySha256 = hashFounderDecisionChange(second);
  current.changes.push(second);
  assert.deepEqual(validateFounderDecisionLedger(current), []);
});

test("rewrites, broken chains, duplicate ids, and forward supersession fail closed", () => {
  const current = ledger();
  const first = validChange(current);
  current.changes.push(first);
  first.decision = "Rewritten after hashing.";
  assert.match(validateFounderDecisionLedger(current).join("\n"), /entrySha256 does not match/);

  const duplicate = ledger();
  const one = validChange(duplicate);
  const two = validChange(duplicate, {
    previousEntrySha256: one.entrySha256,
    supersedes: ["FD-2099-01-01-future"],
  });
  two.entrySha256 = hashFounderDecisionChange(two);
  duplicate.changes.push(one, two);
  const errors = validateFounderDecisionLedger(duplicate).join("\n");
  assert.match(errors, /duplicate decision id/);
  assert.match(errors, /supersedes unknown or forward decision/);

  const broken = ledger();
  broken.changes.push(validChange(broken, { previousEntrySha256: "0".repeat(64) }));
  assert.match(validateFounderDecisionLedger(broken).join("\n"), /previousEntrySha256 does not continue the ledger/);
});

test("hostile reflection returns bounded errors and never invokes hidden values", () => {
  const target = {};
  const revoked = Proxy.revocable(target, {});
  revoked.revoke();
  assert.doesNotThrow(() => validateFounderDecisionLedger(revoked.proxy));
  assert.match(validateFounderDecisionLedger(revoked.proxy).join("\n"), /cannot be inspected safely/);

  const throwingRoot = {};
  Object.defineProperty(throwingRoot, "changes", {
    enumerable: true,
    get() {
      throw new Error("PRIVATE_ROOT_VALUE");
    },
  });
  assert.doesNotThrow(() => validateFounderDecisionLedger(throwingRoot));
  assert.doesNotMatch(validateFounderDecisionLedger(throwingRoot).join("\n"), /PRIVATE_ROOT_VALUE/);
  assert.match(validateFounderDecisionLedger(throwingRoot).join("\n"), /accessor properties are not allowed/);
});

test("a ledger transition is append-only even when an attacker recomputes the entire chain", () => {
  const previous = ledger();
  const first = validChange(previous);
  previous.changes.push(first);

  const appended = structuredClone(previous);
  const second = validChange(appended, {
    id: "FD-2026-08-26-second",
    recordedAtISO: "2026-08-26T12:00:00.000Z",
    effectiveDate: "2026-08-26",
    previousEntrySha256: appended.changes[0].entrySha256,
  });
  appended.changes.push(second);
  assert.deepEqual(validateFounderDecisionTransition(previous, appended), []);

  const rewritten = structuredClone(appended);
  rewritten.changes[0].scope = { clauses: ["§18.3"], nodes: ["G04"] };
  rewritten.changes[0].entrySha256 = hashFounderDecisionChange(rewritten.changes[0]);
  rewritten.changes[1].previousEntrySha256 = rewritten.changes[0].entrySha256;
  rewritten.changes[1].entrySha256 = hashFounderDecisionChange(rewritten.changes[1]);
  assert.deepEqual(validateFounderDecisionLedger(rewritten), []);
  assert.match(
    validateFounderDecisionTransition(previous, rewritten).join("\n"),
    /previous decision history is not an exact prefix/,
  );

  const removed = structuredClone(previous);
  removed.changes = [];
  assert.match(validateFounderDecisionTransition(previous, removed).join("\n"), /cannot remove prior decisions/);
});

test("repository traversal rejects a rewrite buried before a later valid append", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "aura-g04-history-"));
  const temporaryRepo = join(temporaryRoot, "repo");
  const registryPath = EXPECTED_HISTORICAL_REGISTRY.path;
  const registryFile = join(temporaryRepo, ...registryPath.split("/"));
  const commitRegistry = (candidate, message) => {
    writeFileSync(registryFile, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    execFileSync("git", ["add", "--", registryPath], { cwd: temporaryRepo, stdio: "ignore" });
    execFileSync("git", ["commit", "-q", "--no-verify", "-m", message], {
      cwd: temporaryRepo,
      stdio: "pipe",
    });
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: temporaryRepo, encoding: "utf8" }).trim();
  };

  try {
    const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    execFileSync("git", ["clone", "-q", "--no-hardlinks", repoRoot, temporaryRepo], {
      cwd: temporaryRoot,
      stdio: "ignore",
    });
    execFileSync("git", ["checkout", "-q", sourceHead], { cwd: temporaryRepo, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Aura Test"], { cwd: temporaryRepo, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@aura.invalid"], { cwd: temporaryRepo, stdio: "ignore" });
    execFileSync("git", ["config", "commit.gpgSign", "false"], { cwd: temporaryRepo, stdio: "ignore" });
    const emptyHooks = join(temporaryRepo, ".git", "hooks-empty");
    mkdirSync(emptyHooks);
    execFileSync("git", ["config", "core.hooksPath", emptyHooks], {
      cwd: temporaryRepo,
      stdio: "ignore",
    });

    const baseline = ledger();
    const firstAppend = structuredClone(baseline);
    firstAppend.changes.push(validChange(firstAppend));
    commitRegistry(firstAppend, "first append");

    const rewritten = structuredClone(firstAppend);
    rewritten.changes[0].decision = "Earlier founder history rewritten and rehashed.";
    rewritten.changes[0].entrySha256 = hashFounderDecisionChange(rewritten.changes[0]);
    commitRegistry(rewritten, "buried rewrite");

    const finalLedger = structuredClone(rewritten);
    const second = validChange(finalLedger, {
      id: "FD-2026-08-26-after-rewrite",
      recordedAtISO: "2026-08-26T12:00:00.000Z",
      effectiveDate: "2026-08-26",
      previousEntrySha256: finalLedger.changes[0].entrySha256,
    });
    finalLedger.changes.push(second);
    commitRegistry(finalLedger, "later append");

    assert.match(
      validateFounderDecisionRepositoryTransition(finalLedger, temporaryRepo).join("\n"),
      /previous decision history is not an exact prefix/,
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("founder source records bind the full substantive payload, exact identity, and chronology", () => {
  const current = ledger();
  const change = validChange(current);
  const digest = hashFounderDecisionSourcePayload(change);
  const source = [
    `Decision-ID: ${change.id}`,
    "Founder: Matt",
    "State: RECORDED-PENDING-GRAPH",
    `Decision: ${change.decision}`,
    `Change-SHA256: ${digest}`,
  ].join("\n");

  assert.deepEqual(validateFounderDecisionSourceRecord(
    change,
    source,
    "Matt-Aurora-Ventures <lucidbloks@gmail.com>",
    "2026-08-25T12:05:00-06:00",
  ), []);
  assert.match(validateFounderDecisionSourceRecord(
    change,
    source.replace(digest, "0".repeat(64)),
    "Matt-Aurora-Ventures <lucidbloks@gmail.com>",
    "2026-08-25T12:05:00-06:00",
  ).join("\n"), /missing exact marker Change-SHA256/);
  assert.match(validateFounderDecisionSourceRecord(
    change,
    source,
    "NotMatt <lucidbloks@gmail.com>",
    "2026-08-25T12:05:00-06:00",
  ).join("\n"), /not founder-authored/);

  const future = validChange(current, { recordedAtISO: "2099-08-25T12:00:00.000Z" });
  const futureSource = source
    .replace(change.id, future.id)
    .replace(change.decision, future.decision)
    .replace(digest, hashFounderDecisionSourcePayload(future));
  assert.match(validateFounderDecisionSourceRecord(
    future,
    futureSource,
    "Matt-Aurora-Ventures <lucidbloks@gmail.com>",
    "2026-08-25T12:05:00-06:00",
  ).join("\n"), /recordedAtISO follows its source commit/);
});

test("scope nodes must exist and supersession targets are globally single-use", () => {
  const invalidScope = ledger();
  invalidScope.changes.push(validChange(invalidScope, {
    scope: { clauses: [], nodes: ["ZZZ99"] },
  }));
  assert.match(validateFounderDecisionLedger(invalidScope).join("\n"), /unknown approved graph node ZZZ99/);

  const current = ledger();
  const first = validChange(current, { supersedes: ["FD20-01"] });
  const second = validChange(current, {
    id: "FD-2026-08-26-second",
    recordedAtISO: "2026-08-26T12:00:00.000Z",
    effectiveDate: "2026-08-26",
    previousEntrySha256: first.entrySha256,
    supersedes: ["FD20-01"],
  });
  second.entrySha256 = hashFounderDecisionChange(second);
  current.changes.push(first, second);
  assert.match(validateFounderDecisionLedger(current).join("\n"), /supersession target FD20-01 was already claimed/);
});
