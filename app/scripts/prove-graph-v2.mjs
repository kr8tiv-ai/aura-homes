import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const APPROVED_GRAPH = Object.freeze({
  version: "2.0",
  path: "docs/plans/2026-08-22-aura-full-system-graph-v2.0.md",
  proposalCommit: "f7616886f9f8a171c847ef5eb49e932246ff989b",
  gitBlobSha256: "680FD8D8F2142E92DE5A629B60D9C1DE160CCC57A0F7DDDDC872CDC4ACDAB9A8",
  gitObjectSha256: "48A7E075406A0E9C8EE24C11C9C411EC10C0F219D0CCF84D9129FA83D79D49C7",
  approvalPath: "docs/plans/approvals/2026-08-24-aura-full-system-graph-v2.0.md",
  approvalCommit: "1fdcbae76a926cdcb2c9ab7abf6e1f55808aa7a4",
});

export const GRAPH_VERSION = `aura-graph/v${APPROVED_GRAPH.version}@${APPROVED_GRAPH.gitBlobSha256}`;

const REQUIRED_MANIFEST_FIELDS = Object.freeze([
  "graphVersion",
  "node",
  "lane",
  "stage",
  "job",
  "inputs",
  "outputs",
  "depends",
  "reject",
  "writeSet",
  "freezeClass",
  "owner",
  "verifier",
  "sideEffects",
  "externalGates",
  "verification",
  "repair",
  "evidence",
  "status",
]);

const STATUSES = new Set([
  "proposed",
  "ready",
  "active",
  "verification-pending",
  "verified",
  "integration-pending",
  "shipped",
  "blocked",
  "quarantined",
  "retired",
  "superseded",
]);

const runGit = (repoRoot, args, options = {}) =>
  execFileSync("git", args, {
    cwd: repoRoot,
    encoding: options.encoding,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });

const gitBlob = (repoRoot, commit, filePath) =>
  runGit(repoRoot, ["cat-file", "blob", `${commit}:${filePath}`]);

export const gitObjectSha256 = async (repoRoot, commit, filePath) => {
  const blob = gitBlob(repoRoot, commit, filePath);
  return createHash("sha256")
    .update(Buffer.from(`blob ${blob.length}\0`))
    .update(blob)
    .digest("hex")
    .toUpperCase();
};

export const gitBlobSha256 = async (repoRoot, commit, filePath) =>
  createHash("sha256")
    .update(gitBlob(repoRoot, commit, filePath))
    .digest("hex")
    .toUpperCase();

export const loadRegistry = async (repoRoot) =>
  JSON.parse(
    await readFile(path.join(repoRoot, "docs", "plans", "registry", "current-graph.json"), "utf8"),
  );

const graphNodeIds = async (repoRoot) => {
  const source = gitBlob(repoRoot, APPROVED_GRAPH.proposalCommit, APPROVED_GRAPH.path).toString("utf8");
  const ids = new Set();
  const nodePattern = /\b(?:G|IP|UX|ED|OR|AI|LO|CM|HM|DV|Q)\d{2}\b/g;
  for (const match of source.matchAll(nodePattern)) ids.add(match[0]);
  return ids;
};

export const verifyApprovedGraph = async (repoRoot) => {
  const errors = [];
  const actualGitBlobSha256 = await gitBlobSha256(
    repoRoot,
    APPROVED_GRAPH.proposalCommit,
    APPROVED_GRAPH.path,
  );
  const actualGitObjectSha256 = await gitObjectSha256(
    repoRoot,
    APPROVED_GRAPH.proposalCommit,
    APPROVED_GRAPH.path,
  );
  if (actualGitBlobSha256 !== APPROVED_GRAPH.gitBlobSha256) {
    errors.push(`approved graph Git-blob SHA-256 mismatch: ${actualGitBlobSha256}`);
  }
  if (actualGitObjectSha256 !== APPROVED_GRAPH.gitObjectSha256) {
    errors.push(`approved graph Git-object SHA-256 mismatch: ${actualGitObjectSha256}`);
  }

  try {
    runGit(repoRoot, ["cat-file", "-e", `${APPROVED_GRAPH.approvalCommit}:${APPROVED_GRAPH.approvalPath}`]);
  } catch {
    errors.push("founder approval record is absent from its pinned commit");
  }

  const registry = await loadRegistry(repoRoot);
  if (registry.status !== "approved") errors.push("current graph registry is not approved");
  if (registry.graph?.proposalCommit !== APPROVED_GRAPH.proposalCommit) {
    errors.push("registry proposalCommit does not match approved authority");
  }
  if (registry.graph?.gitBlobSha256 !== APPROVED_GRAPH.gitBlobSha256) {
    errors.push("registry gitBlobSha256 does not match approved authority");
  }
  if (registry.approval?.commit !== APPROVED_GRAPH.approvalCommit) {
    errors.push("registry approval commit does not match approved authority");
  }
  if (registry.auditAutomation !== "cancelled") {
    errors.push("recurring graph-audit automation must remain cancelled");
  }

  return {
    ok: errors.length === 0,
    errors,
    actualGitBlobSha256,
    actualGitObjectSha256,
  };
};

const duplicates = (values) =>
  values.filter((value, index) => values.indexOf(value) !== index);

export const validateExecutionNode = async (manifest, repoRoot) => {
  const errors = [];
  const nodeIds = await graphNodeIds(repoRoot);

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!Object.hasOwn(manifest, field)) errors.push(`missing required field ${field}`);
  }

  if (manifest.graphVersion !== GRAPH_VERSION) {
    errors.push(`graphVersion must equal ${GRAPH_VERSION}`);
  }
  if (!nodeIds.has(manifest.node)) errors.push(`unknown graph node ${manifest.node}`);
  if (!Array.isArray(manifest.inputs)) errors.push("inputs must be an array");
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length === 0) {
    errors.push("outputs must be a non-empty array");
  }
  if (!Array.isArray(manifest.depends)) errors.push("depends must be an array");
  if (!Array.isArray(manifest.reject) || manifest.reject.length === 0) {
    errors.push("reject must be a non-empty array");
  }
  if (!Array.isArray(manifest.writeSet) || manifest.writeSet.length === 0) {
    errors.push("writeSet must be a non-empty array");
  } else {
    const repeated = [...new Set(duplicates(manifest.writeSet))];
    if (repeated.length > 0) errors.push(`duplicate writeSet entries: ${repeated.join(", ")}`);
    if (manifest.writeSet.some((entry) => path.isAbsolute(entry) || entry.includes(".."))) {
      errors.push("writeSet entries must be repository-relative and cannot traverse parents");
    }
  }
  if (!["none", "copy-only"].includes(manifest.freezeClass)) {
    errors.push("freezeClass must be none or copy-only");
  }
  if (typeof manifest.owner !== "string" || manifest.owner.length === 0) {
    errors.push("owner must be a non-empty string");
  }
  if (typeof manifest.verifier !== "string" || manifest.verifier.length === 0) {
    errors.push("verifier must be a non-empty string");
  }
  if (!STATUSES.has(manifest.status)) errors.push(`unknown status ${manifest.status}`);
  if (
    !manifest.repair ||
    !Number.isInteger(manifest.repair.maxLoops) ||
    manifest.repair.maxLoops < 0 ||
    manifest.repair.maxLoops > 1 ||
    typeof manifest.repair.boundary !== "string"
  ) {
    errors.push("repair must declare maxLoops 0..1 and a boundary");
  }

  return { errors, nodeIds };
};

const main = async () => {
  const appRoot = path.resolve(import.meta.dirname, "..");
  const repoRoot = path.resolve(appRoot, "..");
  const authority = await verifyApprovedGraph(repoRoot);
  const manifestDir = path.join(repoRoot, "docs", "plans", "execution", "v2");
  const files = (await readdir(manifestDir)).filter((name) => name.endsWith(".json")).sort();
  const manifests = [];
  const errors = [...authority.errors];

  for (const file of files) {
    const manifest = JSON.parse(await readFile(path.join(manifestDir, file), "utf8"));
    const result = await validateExecutionNode(manifest, repoRoot);
    manifests.push({ file, node: manifest.node, status: manifest.status, errors: result.errors });
    errors.push(...result.errors.map((error) => `${file}: ${error}`));
  }

  const report = {
    schema: "AuraGraphV2GateReceiptV1",
    graphVersion: GRAPH_VERSION,
    authority: authority.ok ? "pass" : "fail",
    manifests,
    errors,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (errors.length > 0) process.exitCode = 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
