import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  REQUIRED_SOURCE_CHECKS,
  buildDeploymentReceipt,
  buildSourceReceipt,
  validateReceipt,
} from "./source-evidence-receipt.mjs";

const sourceCommit = "a".repeat(40);
const generatedAt = "2026-08-25T12:00:00.000Z";
const runUrl = "https://github.com/kr8tiv-ai/aura-homes/actions/runs/123";
const passingChecks = Object.fromEntries(REQUIRED_SOURCE_CHECKS.map((name) => [name, "pass"]));

test("source receipts require every Graph v2 source gate to pass", () => {
  const receipt = buildSourceReceipt({ sourceCommit, generatedAt, runUrl, checks: passingChecks });

  assert.equal(receipt.schema, "AuraSourceEvidenceReceiptV1");
  assert.equal(receipt.receiptType, "source-ci");
  assert.equal(receipt.sourceCommit, sourceCommit);
  assert.deepEqual(Object.keys(receipt.checks).sort(), [...REQUIRED_SOURCE_CHECKS].sort());
  assert.deepEqual(validateReceipt(receipt), []);
});

test("source receipts fail closed on missing or non-passing checks", () => {
  const missing = { ...passingChecks };
  delete missing.freeze;
  assert.throws(
    () => buildSourceReceipt({ sourceCommit, generatedAt, runUrl, checks: missing }),
    /freeze must be pass/,
  );

  assert.throws(
    () => buildSourceReceipt({
      sourceCommit,
      generatedAt,
      runUrl,
      checks: { ...passingChecks, claim: "fail" },
    }),
    /claim must be pass/,
  );
});

test("deployment receipts bind the deployed revision to the checked source revision", () => {
  const receipt = buildDeploymentReceipt({
    sourceCommit,
    deploymentCommit: sourceCommit,
    generatedAt,
    runUrl,
    deploymentUrl: "https://aurahomes.fun/",
    environment: "github-pages",
    status: "success",
  });

  assert.equal(receipt.receiptType, "deployment");
  assert.equal(receipt.deployment.commit, sourceCommit);
  assert.deepEqual(validateReceipt(receipt), []);
  assert.throws(
    () => buildDeploymentReceipt({
      sourceCommit,
      deploymentCommit: "b".repeat(40),
      generatedAt,
      runUrl,
      deploymentUrl: "https://aurahomes.fun/",
      environment: "github-pages",
      status: "success",
    }),
    /must equal source commit/,
  );
});

test("runtime validation rejects fields from the other receipt variant", () => {
  const sourceReceipt = buildSourceReceipt({ sourceCommit, generatedAt, runUrl, checks: passingChecks });
  const deploymentReceipt = buildDeploymentReceipt({
    sourceCommit,
    deploymentCommit: sourceCommit,
    generatedAt,
    runUrl,
    deploymentUrl: "https://aurahomes.fun/",
    environment: "github-pages",
    status: "success",
  });

  assert.match(
    validateReceipt({
      ...sourceReceipt,
      deployment: { ...deploymentReceipt.deployment, commit: "b".repeat(40) },
    })[0],
    /unexpected receipt fields: deployment/,
  );
  assert.match(
    validateReceipt({ ...deploymentReceipt, checks: passingChecks })[0],
    /unexpected receipt fields: checks/,
  );
  assert.match(
    validateReceipt({
      ...deploymentReceipt,
      deployment: { ...deploymentReceipt.deployment, evidence: "unbound" },
    })[0],
    /unexpected deployment fields: evidence/,
  );
});

test("receipts reject mutable commit labels and non-HTTPS evidence links", () => {
  assert.throws(
    () => buildSourceReceipt({
      sourceCommit: "main",
      generatedAt,
      runUrl,
      checks: passingChecks,
    }),
    /40-character Git commit/,
  );
  assert.throws(
    () => buildSourceReceipt({
      sourceCommit,
      generatedAt,
      runUrl: "http://example.test/run",
      checks: passingChecks,
    }),
    /HTTPS URL/,
  );
});

test("the CLI writes a source receipt whose checked commit is explicit", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aura-source-receipt-"));
  const output = join(directory, "receipt.json");
  try {
    const result = spawnSync(process.execPath, [
      fileURLToPath(new URL("./source-evidence-receipt.mjs", import.meta.url)),
      "source",
      "--source",
      sourceCommit,
      "--run-url",
      runUrl,
      "--generated-at",
      generatedAt,
      "--output",
      output,
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(await readFile(output, "utf8"));
    assert.equal(receipt.sourceCommit, sourceCommit);
    assert.deepEqual(validateReceipt(receipt), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("source CI runs every Graph v2 source gate and never deploys product code", async () => {
  const workflow = await readFile(new URL("../../.github/workflows/source-ci.yml", import.meta.url), "utf8");

  for (const required of [
    "npm run typecheck",
    "npm test",
    "npm run test:ui",
    "npm run test:graph-v2",
    "npm run test:source-evidence",
    "working-directory: contracts",
    "working-directory: agent",
    "needs.source-governance.result == 'success'",
    "github.event.deployment.sha",
  ]) {
    assert.match(workflow, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), required);
  }
  const actionUses = [...workflow.matchAll(/uses: actions\/[a-z-]+@([^\s]+)/g)].map((match) => match[1]);
  assert.ok(actionUses.length >= 3);
  assert.ok(actionUses.every((revision) => /^[0-9a-f]{40}$/.test(revision)), "official actions must be commit-pinned");
  assert.doesNotMatch(workflow, /deploy:testnet|deploy\.js|branch-protection|update-branch-protection/);
});

test("the checked receipt schema keeps source and deployment receipts distinct", async () => {
  const schema = JSON.parse(await readFile(
    new URL("../../docs/plans/execution/schema/aura-source-evidence-receipt.schema.json", import.meta.url),
    "utf8",
  ));

  assert.equal(schema.title, "Aura Source Evidence Receipt v1");
  assert.equal(schema.oneOf.length, 2);
  assert.deepEqual(
    schema.$defs.sourceReceipt.allOf[1].properties.checks.required,
    REQUIRED_SOURCE_CHECKS,
  );
  assert.equal(schema.$defs.deploymentReceipt.allOf[1].properties.deployment.properties.status.const, "success");
});
