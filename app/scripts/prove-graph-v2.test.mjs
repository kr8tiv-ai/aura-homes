import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  APPROVED_GRAPH,
  gitBlobSha256,
  loadRegistry,
  pinnedApprovalSource,
  validateApprovalRecordSource,
  validateExecutionNode,
  verifyApprovedGraph,
} from "./prove-graph-v2.mjs";

const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "..");
const manifestPath = path.join(
  repoRoot,
  "docs",
  "plans",
  "execution",
  "v2",
  "G01-canonical-graph-registry.json",
);

test("the registry pins the founder-approved graph revision", async () => {
  const registry = await loadRegistry(repoRoot);

  assert.equal(registry.schema, "AuraCurrentGraphV1");
  assert.equal(registry.graph.version, "2.0");
  assert.equal(registry.graph.proposalCommit, APPROVED_GRAPH.proposalCommit);
  assert.equal(registry.graph.gitBlobSha256, APPROVED_GRAPH.gitBlobSha256);
  assert.equal(registry.approval.commit, APPROVED_GRAPH.approvalCommit);
  assert.equal(registry.auditAutomation, "cancelled");
});

test("the committed Git blob matches the approval record", async () => {
  const result = await verifyApprovedGraph(repoRoot);

  assert.equal(result.ok, true);
  assert.equal(result.actualGitBlobSha256, APPROVED_GRAPH.gitBlobSha256);
  assert.equal(
    await gitBlobSha256(repoRoot, APPROVED_GRAPH.proposalCommit, APPROVED_GRAPH.path),
    APPROVED_GRAPH.gitBlobSha256,
  );
});

test("the pinned approval body names the exact proposal and stored blob hash", async () => {
  const source = await pinnedApprovalSource(repoRoot);
  assert.deepEqual(validateApprovalRecordSource(source), []);

  const wrongCommit = validateApprovalRecordSource(
    source.replace(APPROVED_GRAPH.proposalCommit, "0".repeat(40)),
  );
  const wrongHash = validateApprovalRecordSource(
    source.replace(APPROVED_GRAPH.gitBlobSha256, "F".repeat(64)),
  );

  assert.match(wrongCommit.join("\n"), /Proposed graph commit/);
  assert.match(wrongHash.join("\n"), /canonical Git-blob SHA-256/);
});

test("the active G01 manifest satisfies the v2 execution contract", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = await validateExecutionNode(manifest, repoRoot);

  assert.deepEqual(result.errors, []);
  assert.equal(result.nodeIds.has("G01"), true);
  assert.equal(result.nodeIds.has("UX10"), true);
});

test("stale authority and unknown nodes fail closed", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const stale = await validateExecutionNode(
    { ...manifest, graphVersion: "aura-graph/v1.2@stale" },
    repoRoot,
  );
  const unknown = await validateExecutionNode({ ...manifest, node: "UX99" }, repoRoot);

  assert.match(stale.errors.join("\n"), /graphVersion/);
  assert.match(unknown.errors.join("\n"), /unknown graph node UX99/);
});

test("missing execution fields and overlapping writes are rejected", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const missingOwner = { ...manifest };
  delete missingOwner.owner;

  const missing = await validateExecutionNode(missingOwner, repoRoot);
  const duplicate = await validateExecutionNode(
    { ...manifest, writeSet: [manifest.writeSet[0], manifest.writeSet[0]] },
    repoRoot,
  );

  assert.match(missing.errors.join("\n"), /owner/);
  assert.match(duplicate.errors.join("\n"), /duplicate writeSet/);
});
