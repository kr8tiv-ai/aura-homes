import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildGraphPositionReceipt,
  validateDecisionHistorySequence,
  validateGraphPositionInput,
  validateRepositoryDecisionHistory,
} from "./graph-position-check.mjs";
import {
  EXPECTED_HISTORICAL_REGISTRY,
  hashFounderDecisionChange,
  validateFounderDecisionLedger,
} from "./founder-decision-ledger.mjs";
import { GRAPH_VERSION } from "./prove-graph-v2.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const REGISTRY_PATH = "docs/plans/registry/decisions.json";
const V2_LEDGER = JSON.parse(readFileSync(path.join(ROOT, REGISTRY_PATH), "utf8"));
const V1_LEDGER = JSON.parse(execFileSync(
  "git",
  ["cat-file", "blob", `${EXPECTED_HISTORICAL_REGISTRY.pinnedAtCommit}:${REGISTRY_PATH}`],
  { cwd: ROOT, encoding: "utf8" },
));

const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const objectSha256 = (bytes) => sha256(Buffer.concat([
  Buffer.from(`blob ${bytes.length}\0`, "utf8"),
  bytes,
]));

const validInput = () => ({
  schema: "AuraGraphPositionInputV1",
  invocation: { mode: "explicit", phase: "preflight" },
  node: "G05",
  graphVersion: GRAPH_VERSION,
  authority: { status: "pass", errors: [] },
  manifest: {
    commit: "a".repeat(40),
    status: "active",
    owner: "primary-agent",
    verifier: "independent-fresh-context",
    depends: ["G01:verified"],
    externalGates: [],
    writeSet: ["app/scripts/graph-position-check.mjs"],
    repair: { used: 0, maximum: 1 },
  },
  lineage: {
    base: "b".repeat(40),
    candidate: "c".repeat(40),
    closure: null,
  },
  dependencies: [{ ref: "G01:verified", actualStatus: "verified" }],
  writes: {
    declared: ["app/scripts/graph-position-check.mjs"],
    changed: ["app/scripts/graph-position-check.mjs"],
    delta: [],
    protectedPathErrors: [],
    overlappingOwners: [],
  },
  worktree: { status: "clean" },
  evidence: [{ command: "npm run test:graph-position", status: "pass" }],
  decisionHistory: { status: "pass", commits: ["d".repeat(40)], errors: [] },
  movement: { requested: "remain", lateralCandidates: [] },
});

const validChange = (ledger, overrides = {}) => {
  const previous = ledger.changes.at(-1)?.entrySha256 ?? ledger.genesisSha256;
  const change = {
    id: "FD-2026-08-26-position-check",
    recordedAtISO: "2026-08-26T12:00:00.000Z",
    effectiveDate: "2026-08-26",
    state: "recorded-pending-graph",
    decision: "Record a test-only founder direction without granting execution authority.",
    scope: { clauses: ["§18.1"], nodes: ["G05"] },
    authority: {
      actor: "founder",
      sourceType: "repo-founder-record",
      sourcePath: "docs/plans/approvals/2026-08-26-position-check.md",
      sourceCommit: "a".repeat(40),
    },
    supersedes: [],
    previousEntrySha256: previous,
    entrySha256: "",
    ...overrides,
  };
  change.entrySha256 = hashFounderDecisionChange(change);
  return change;
};

const historyFixtures = () => {
  const accepted = structuredClone(V2_LEDGER);
  accepted.changes.push(validChange(accepted));

  const rewritten = structuredClone(accepted);
  rewritten.changes[0].scope = { clauses: ["§18.2"], nodes: ["G05"] };
  rewritten.changes[0].entrySha256 = hashFounderDecisionChange(rewritten.changes[0]);

  const appended = structuredClone(rewritten);
  appended.changes.push(validChange(appended, {
    id: "FD-2026-08-26-position-check-followup",
    recordedAtISO: "2026-08-26T13:00:00.000Z",
  }));

  const validAppend = structuredClone(accepted);
  validAppend.changes.push(validChange(validAppend, {
    id: "FD-2026-08-26-position-check-followup",
    recordedAtISO: "2026-08-26T13:00:00.000Z",
  }));
  return { accepted, rewritten, appended, validAppend };
};

test("exact preflight input emits a non-self-approved receipt", () => {
  const receipt = buildGraphPositionReceipt(validInput());
  assert.equal(receipt.schema, "AuraGraphPositionReceiptV1");
  assert.equal(receipt.verdict, "pass");
  assert.equal(receipt.independentVerification, "required");
  assert.equal(receipt.invocation.mode, "explicit");
  assert.deepEqual(receipt.errors, []);
});

test("unknown keys, accessors, and revoked values fail closed", () => {
  const unknown = validInput();
  unknown.scheduled = true;
  assert.match(validateGraphPositionInput(unknown).join("\n"), /unknown key scheduled/);

  const throwing = validInput();
  Object.defineProperty(throwing, "node", {
    enumerable: true,
    get() { throw new Error("PRIVATE_POSITION_VALUE"); },
  });
  assert.doesNotThrow(() => validateGraphPositionInput(throwing));
  assert.doesNotMatch(validateGraphPositionInput(throwing).join("\n"), /PRIVATE_POSITION_VALUE/);
  assert.match(validateGraphPositionInput(throwing).join("\n"), /accessor properties are not allowed/);

  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.doesNotThrow(() => validateGraphPositionInput(revoked.proxy));
  assert.match(validateGraphPositionInput(revoked.proxy).join("\n"), /cannot be inspected safely/);
});

test("complete decision history rejects a rewrite buried beneath a later valid append", () => {
  const { accepted, rewritten, appended, validAppend } = historyFixtures();
  assert.deepEqual(validateFounderDecisionLedger(accepted), []);
  assert.deepEqual(validateFounderDecisionLedger(rewritten), []);
  assert.deepEqual(validateFounderDecisionLedger(appended), []);
  assert.deepEqual(
    validateDecisionHistorySequence([V1_LEDGER, V2_LEDGER, accepted, validAppend]),
    [],
  );
  assert.match(
    validateDecisionHistorySequence([V1_LEDGER, V2_LEDGER, accepted, rewritten, appended]).join("\n"),
    /history rewrite at transition 3/,
  );
});

test("repository decision history traverses every decisions.json-changing commit", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "aura-g05-history-"));
  try {
    execFileSync("git", ["init", "-b", "main"], { cwd: temp });
    execFileSync("git", ["config", "user.name", "Matt-Aurora-Ventures"], { cwd: temp });
    execFileSync("git", ["config", "user.email", "lucidbloks@gmail.com"], { cwd: temp });
    mkdirSync(path.join(temp, ".githooks-disabled"));
    execFileSync("git", ["config", "core.hooksPath", ".githooks-disabled"], { cwd: temp });
    const file = path.join(temp, REGISTRY_PATH);
    mkdirSync(path.dirname(file), { recursive: true });
    const commitLedger = (value, message) => {
      writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      execFileSync("git", ["add", REGISTRY_PATH], { cwd: temp });
      execFileSync("git", ["commit", "-m", message], { cwd: temp });
      return execFileSync("git", ["rev-parse", "HEAD"], { cwd: temp, encoding: "utf8" }).trim();
    };
    const anchor = commitLedger(V1_LEDGER, "v1 anchor");
    commitLedger(V2_LEDGER, "v2 migration");
    const { accepted, rewritten, appended } = historyFixtures();
    commitLedger(accepted, "accepted append");
    commitLedger(rewritten, "buried rewrite");
    const tip = commitLedger(appended, "later append");
    const historicalBytes = Buffer.from(`${JSON.stringify(V1_LEDGER, null, 2)}\n`, "utf8");
    const errors = validateRepositoryDecisionHistory(temp, tip, {
      anchorCommit: anchor,
      expectedHistoricalStoredSha256: sha256(historicalBytes),
      expectedHistoricalObjectSha256: objectSha256(historicalBytes),
    });
    assert.match(errors.join("\n"), /history rewrite at transition 3/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
