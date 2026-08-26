import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildGraphPositionReceipt,
  buildRepositoryGraphPositionInput,
  deriveMovementOptions,
  parseGraphPositionCliArgs,
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
    path: "docs/plans/execution/v2/G05-point-in-time-graph-position.json",
    commit: "a".repeat(40),
    status: "active",
    owner: "primary-agent",
    verifier: "independent-fresh-context",
    depends: ["G01:verified"],
    externalGates: [],
    writeSet: ["app/scripts/graph-position-check.mjs"],
    verification: ["npm run test:graph-position"],
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
    closureChanged: [],
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
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: temp });
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

test("position reconciliation rejects dependency, write-set, closure, evidence, and phase drift", () => {
  const dependency = validInput();
  dependency.dependencies[0].actualStatus = "blocked";
  assert.match(validateGraphPositionInput(dependency).join("\n"), /does not satisfy G01:verified/);

  const writes = validInput();
  writes.writes.changed = ["app/scripts/not-owned.mjs"];
  writes.writes.delta = ["app/scripts/not-owned.mjs"];
  assert.match(validateGraphPositionInput(writes).join("\n"), /candidate paths do not exactly equal/);

  const protectedPath = validInput();
  protectedPath.writes.protectedPathErrors = ["app/components/story/Scene.tsx is hard-protected"];
  assert.match(validateGraphPositionInput(protectedPath).join("\n"), /protected path violations/);

  const overlap = validInput();
  overlap.writes.overlappingOwners = ["UX99"];
  assert.match(validateGraphPositionInput(overlap).join("\n"), /overlaps a live owner/);

  const closure = validInput();
  closure.invocation.phase = "integration";
  closure.manifest.status = "verification-pending";
  closure.lineage.closure = "e".repeat(40);
  closure.writes.closureChanged = ["app/scripts/graph-position-check.mjs"];
  assert.match(validateGraphPositionInput(closure).join("\n"), /closure must change only the target manifest/);

  const evidence = validInput();
  evidence.evidence[0].status = "fail";
  assert.match(validateGraphPositionInput(evidence).join("\n"), /evidence\[0\].status must be pass/);

  const missingEvidence = validInput();
  missingEvidence.manifest.verification.push("npm run typecheck");
  assert.match(validateGraphPositionInput(missingEvidence).join("\n"), /evidence commands must exactly equal/);

  const inventedEvidence = validInput();
  inventedEvidence.evidence.push({ command: "npm run invented", status: "pass" });
  assert.match(validateGraphPositionInput(inventedEvidence).join("\n"), /evidence commands must exactly equal/);

  const release = validInput();
  release.invocation.phase = "release";
  release.manifest.status = "active";
  assert.match(validateGraphPositionInput(release).join("\n"), /active is invalid for release/);
});

test("dependency projection must exactly match the committed manifest", () => {
  const input = validInput();
  input.dependencies = [];
  assert.match(
    validateGraphPositionInput(input).join("\n"),
    /dependencies must exactly equal the manifest dependencies/,
  );
});

test("write projection must exactly match the committed manifest write set", () => {
  const input = validInput();
  input.writes.declared = ["app/scripts/not-the-manifest-write.mjs"];
  input.writes.changed = ["app/scripts/not-the-manifest-write.mjs"];
  assert.match(
    validateGraphPositionInput(input).join("\n"),
    /declared writes must exactly equal the manifest write set/,
  );
});

test("failure receipts keep correction movement inside the receipt schema", () => {
  const input = validInput();
  input.evidence[0].status = "fail";
  const receipt = buildGraphPositionReceipt(input);
  assert.equal(receipt.verdict, "fail");
  assert.ok(
    ["blocked-authority", "backward-repair", "lateral-ready"].includes(receipt.correction.safeMove),
    `unexpected correction movement ${receipt.correction.safeMove}`,
  );
});

test("blocked nodes expose only graph-valid repair and committed-ready lateral movement", () => {
  const input = validInput();
  input.manifest.status = "blocked";
  input.manifest.repair = { used: 0, maximum: 1 };
  input.movement.requested = "lateral-ready";
  input.movement.lateralCandidates = [
    {
      node: "UX04",
      status: "ready",
      dependenciesSatisfied: true,
      externalGates: [],
      writeSetClaimed: false,
    },
    {
      node: "IP03",
      status: "proposed",
      dependenciesSatisfied: true,
      externalGates: [],
      writeSetClaimed: false,
    },
    {
      node: "HM02",
      status: "ready",
      dependenciesSatisfied: false,
      externalGates: [],
      writeSetClaimed: false,
    },
  ];
  const receipt = buildGraphPositionReceipt(input);
  assert.equal(receipt.verdict, "pass");
  assert.equal(receipt.movement.allowed, true);
  assert.deepEqual(receipt.movement.options, ["backward-repair:G05", "lateral-ready:UX04"]);
  assert.doesNotMatch(JSON.stringify(receipt), /IP03|HM02/);
});

test("strategic rows and exhausted repair cannot invent a safe move", () => {
  const input = validInput();
  input.manifest.status = "blocked";
  input.manifest.repair = { used: 1, maximum: 1 };
  input.movement.requested = "lateral-ready";
  input.movement.lateralCandidates = [{
    node: "IP03",
    status: "proposed",
    dependenciesSatisfied: true,
    externalGates: [],
    writeSetClaimed: false,
  }];
  const receipt = buildGraphPositionReceipt(input);
  assert.equal(receipt.verdict, "fail");
  assert.equal(receipt.movement.allowed, false);
  assert.deepEqual(receipt.movement.options, ["blocked-authority:G05"]);
  assert.match(receipt.errors.join("\n"), /requested movement is not graph-valid/);
});

test("CLI arguments are explicit, full-commit, evidence-bound, and reject external actions", () => {
  const args = parseGraphPositionCliArgs([
    "--phase", "preflight",
    "--node", "G05",
    "--base", "a".repeat(40),
    "--candidate", "b".repeat(40),
    "--evidence-json", JSON.stringify([{ command: "npm run test:graph-position", status: "pass" }]),
  ]);
  assert.equal(args.phase, "preflight");
  assert.equal(args.node, "G05");
  assert.equal(args.closure, null);
  assert.equal(args.evidence.length, 1);
  assert.throws(() => parseGraphPositionCliArgs([
    "--phase", "preflight", "--node", "G05", "--base", "abc", "--candidate", "b".repeat(40),
    "--evidence-json", "[]",
  ]), /base must be a full Git commit/);
  for (const forbidden of ["--schedule", "--run-url", "--deploy", "--provider", "--payment"]) {
    assert.throws(() => parseGraphPositionCliArgs([
      "--phase", "preflight", "--node", "G05", "--base", "a".repeat(40),
      "--candidate", "b".repeat(40), "--evidence-json", "[]", forbidden, "true",
    ]), /unknown or forbidden option/);
  }
});

test("CLI failures are bounded and do not mutate the repository", () => {
  const before = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  const result = spawnSync(process.execPath, [
    path.join(ROOT, "app", "scripts", "graph-position-check.mjs"),
    "--schedule", "true",
  ], { cwd: ROOT, encoding: "utf8" });
  const after = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown or forbidden option|missing required option/);
  assert.equal(after, before);
  assert.equal(result.stdout, "");
});

test("all exported movement, repository-option, and CLI boundaries contain hostile reflection", async () => {
  const movement = { node: "G05" };
  Object.defineProperty(movement, "manifest", {
    enumerable: true,
    get() { throw new Error("PRIVATE_MOVEMENT_VALUE"); },
  });
  let movementResult;
  assert.doesNotThrow(() => { movementResult = deriveMovementOptions(movement); });
  assert.deepEqual(movementResult, []);

  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  const revokedOptions = Proxy.revocable({}, {});
  revokedOptions.revoke();
  let repositoryErrors;
  assert.doesNotThrow(() => {
    repositoryErrors = validateRepositoryDecisionHistory(ROOT, head, revokedOptions.proxy);
  });
  assert.match(repositoryErrors.join("\n"), /options cannot be inspected safely/);
  assert.doesNotMatch(repositoryErrors.join("\n"), /PRIVATE/);

  const revokedCandidate = Proxy.revocable({}, {});
  revokedCandidate.revoke();
  let candidateErrors;
  assert.doesNotThrow(() => {
    candidateErrors = validateRepositoryDecisionHistory(ROOT, revokedCandidate.proxy);
  });
  assert.match(candidateErrors.join("\n"), /candidate cannot be inspected safely/);

  const revokedRepositoryInput = Proxy.revocable({}, {});
  revokedRepositoryInput.revoke();
  await assert.rejects(
    buildRepositoryGraphPositionInput(revokedRepositoryInput.proxy),
    /repository input cannot be inspected safely/,
  );

  const revokedArgs = Proxy.revocable([], {});
  revokedArgs.revoke();
  assert.throws(() => parseGraphPositionCliArgs(revokedArgs.proxy), /CLI arguments cannot be inspected safely/);
});

test("integration-pending manifests retain live write ownership", async () => {
  const temp = mkdtempSync(path.join(tmpdir(), "aura-g05-owner-"));
  try {
    execFileSync("git", ["init", "-b", "main"], { cwd: temp });
    execFileSync("git", ["config", "user.name", "Aura test"], { cwd: temp });
    execFileSync("git", ["config", "user.email", "test@aura.invalid"], { cwd: temp });
    mkdirSync(path.join(temp, ".githooks-disabled"));
    execFileSync("git", ["config", "core.hooksPath", ".githooks-disabled"], { cwd: temp });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: temp });
    const executionDir = path.join(temp, "docs", "plans", "execution", "v2");
    mkdirSync(executionDir, { recursive: true });
    const target = JSON.parse(readFileSync(
      path.join(ROOT, "docs", "plans", "execution", "v2", "G05-point-in-time-graph-position.json"),
      "utf8",
    ));
    target.status = "active";
    target.writeSet = ["app/shared-owned-path.ts"];
    const owner = structuredClone(target);
    owner.node = "UX04";
    owner.status = "integration-pending";
    writeFileSync(
      path.join(executionDir, "G05-point-in-time-graph-position.json"),
      `${JSON.stringify(target, null, 2)}\n`,
      "utf8",
    );
    writeFileSync(
      path.join(executionDir, "UX04-command-measurement-bar.json"),
      `${JSON.stringify(owner, null, 2)}\n`,
      "utf8",
    );
    execFileSync("git", ["add", "."], { cwd: temp });
    execFileSync("git", ["commit", "-m", "ownership fixture"], { cwd: temp });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: temp, encoding: "utf8" }).trim();
    const input = await buildRepositoryGraphPositionInput({
      repoRoot: temp,
      phase: "preflight",
      node: "G05",
      base: head,
      candidate: head,
      evidence: [],
    });
    assert.deepEqual(input.writes.overlappingOwners, ["UX04"]);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
