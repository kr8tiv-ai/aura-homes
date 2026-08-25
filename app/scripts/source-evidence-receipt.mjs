import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_SOURCE_CHECKS = Object.freeze([
  "app",
  "type",
  "contract",
  "agent",
  "manifest",
  "claim",
  "freeze",
]);

const COMMIT = /^[0-9a-f]{40}$/;
const SOURCE_RECEIPT_KEYS = Object.freeze([
  "schema",
  "receiptType",
  "sourceCommit",
  "generatedAt",
  "runUrl",
  "checks",
]);
const DEPLOYMENT_RECEIPT_KEYS = Object.freeze([
  "schema",
  "receiptType",
  "sourceCommit",
  "generatedAt",
  "runUrl",
  "deployment",
]);
const DEPLOYMENT_KEYS = Object.freeze(["commit", "url", "environment", "status"]);

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const unexpected = Object.keys(value).filter((key) => !expected.includes(key));
  if (unexpected.length) throw new Error(`unexpected ${label} fields: ${unexpected.join(", ")}`);
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  if (missing.length) throw new Error(`missing ${label} fields: ${missing.join(", ")}`);
}

function requireCommit(value, label) {
  const normalized = String(value ?? "").toLowerCase();
  if (!COMMIT.test(normalized)) throw new Error(`${label} must be a full 40-character Git commit`);
  return normalized;
}

function requireHttpsUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(String(value ?? ""));
  } catch {
    throw new Error(`${label} must be an HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error(`${label} must be an HTTPS URL without credentials`);
  }
  return parsed.href;
}

function requireIsoTimestamp(value) {
  const timestamp = String(value ?? "");
  const parsed = new Date(timestamp);
  if (!timestamp || Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== timestamp) {
    throw new Error("generatedAt must be an exact ISO-8601 UTC timestamp");
  }
  return timestamp;
}

function requirePassingChecks(checks) {
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    throw new Error("checks must be an object");
  }
  const normalized = {};
  for (const name of REQUIRED_SOURCE_CHECKS) {
    if (checks[name] !== "pass") throw new Error(`${name} must be pass before a source receipt is emitted`);
    normalized[name] = "pass";
  }
  const unknown = Object.keys(checks).filter((name) => !REQUIRED_SOURCE_CHECKS.includes(name));
  if (unknown.length) throw new Error(`unknown source checks: ${unknown.join(", ")}`);
  return normalized;
}

export function buildSourceReceipt({ sourceCommit, generatedAt, runUrl, checks }) {
  return {
    schema: "AuraSourceEvidenceReceiptV1",
    receiptType: "source-ci",
    sourceCommit: requireCommit(sourceCommit, "source commit"),
    generatedAt: requireIsoTimestamp(generatedAt),
    runUrl: requireHttpsUrl(runUrl, "run URL"),
    checks: requirePassingChecks(checks),
  };
}

export function buildDeploymentReceipt({
  sourceCommit,
  deploymentCommit,
  generatedAt,
  runUrl,
  deploymentUrl,
  environment,
  status,
}) {
  const source = requireCommit(sourceCommit, "source commit");
  const deployed = requireCommit(deploymentCommit, "deployment commit");
  if (source !== deployed) throw new Error("deployment commit must equal source commit");
  if (status !== "success") throw new Error("deployment status must be success");
  const environmentName = String(environment ?? "").trim();
  if (!environmentName) throw new Error("deployment environment is required");
  return {
    schema: "AuraSourceEvidenceReceiptV1",
    receiptType: "deployment",
    sourceCommit: source,
    generatedAt: requireIsoTimestamp(generatedAt),
    runUrl: requireHttpsUrl(runUrl, "run URL"),
    deployment: {
      commit: deployed,
      url: requireHttpsUrl(deploymentUrl, "deployment URL"),
      environment: environmentName,
      status: "success",
    },
  };
}

export function validateReceipt(receipt) {
  try {
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
      throw new Error("receipt must be an object");
    }
    if (receipt.schema !== "AuraSourceEvidenceReceiptV1") throw new Error("unsupported receipt schema");
    if (receipt.receiptType === "source-ci") {
      requireExactKeys(receipt, SOURCE_RECEIPT_KEYS, "receipt");
      buildSourceReceipt(receipt);
    }
    else if (receipt.receiptType === "deployment") {
      requireExactKeys(receipt, DEPLOYMENT_RECEIPT_KEYS, "receipt");
      requireExactKeys(receipt.deployment, DEPLOYMENT_KEYS, "deployment");
      buildDeploymentReceipt({
        sourceCommit: receipt.sourceCommit,
        deploymentCommit: receipt.deployment?.commit,
        generatedAt: receipt.generatedAt,
        runUrl: receipt.runUrl,
        deploymentUrl: receipt.deployment?.url,
        environment: receipt.deployment?.environment,
        status: receipt.deployment?.status,
      });
    } else throw new Error("receiptType must be source-ci or deployment");
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

function parseArgs(argv) {
  const [command, ...tokens] = argv;
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const flag = tokens[index];
    const value = tokens[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`invalid argument near ${flag ?? "end"}`);
    values[flag.slice(2)] = value;
  }
  return { command, values };
}

async function runCli(argv) {
  const { command, values } = parseArgs(argv);
  const generatedAt = values["generated-at"] ?? new Date().toISOString();
  const runUrl = values["run-url"];
  let receipt;
  if (command === "source") {
    receipt = buildSourceReceipt({
      sourceCommit: values.source,
      generatedAt,
      runUrl,
      checks: Object.fromEntries(REQUIRED_SOURCE_CHECKS.map((name) => [name, "pass"])),
    });
  } else if (command === "deploy") {
    receipt = buildDeploymentReceipt({
      sourceCommit: values.source,
      deploymentCommit: values.deployment,
      generatedAt,
      runUrl,
      deploymentUrl: values.url,
      environment: values.environment,
      status: values.status,
    });
  } else {
    throw new Error("command must be source or deploy");
  }

  const output = values.output;
  if (!output) throw new Error("--output is required");
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
