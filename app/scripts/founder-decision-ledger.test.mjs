import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  hashFounderDecisionChange,
  validateFounderDecisionSources,
  validateFounderDecisionLedger,
} from "./founder-decision-ledger.mjs";

const registryUrl = new URL("../../docs/plans/registry/decisions.json", import.meta.url);
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
