import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  APPROVED_GRAPH_NODE_IDS,
  EXPECTED_HISTORICAL_REGISTRY,
  validateFounderDecisionLedger,
  validateFounderDecisionTransition,
} from "./founder-decision-ledger.mjs";
import { GRAPH_VERSION } from "./prove-graph-v2.mjs";

const PHASES = Object.freeze(["preflight", "integration", "release"]);
const MANIFEST_STATUSES = Object.freeze([
  "proposed", "ready", "active", "verification-pending", "verified",
  "integration-pending", "shipped", "blocked", "quarantined", "retired", "superseded",
]);
const MOVE_CLASSES = Object.freeze(["remain", "backward-repair", "lateral-ready", "blocked-authority"]);
const COMMIT = /^[0-9a-f]{40}$/;
const approvedNodes = new Set(APPROVED_GRAPH_NODE_IDS);

const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();
const gitBlobObjectSha256 = (bytes) => sha256(Buffer.concat([
  Buffer.from(`blob ${bytes.length}\0`, "utf8"),
  bytes,
]));

const inspectJsonValue = (value, pathLabel, errors, seen = new Set()) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) errors.push(`${pathLabel} contains a non-finite number`);
    return value;
  }
  if (typeof value !== "object") {
    errors.push(`${pathLabel} contains a non-JSON value`);
    return undefined;
  }

  let isArray;
  let prototype;
  let descriptors;
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    errors.push(`${pathLabel} cannot be inspected safely`);
    return undefined;
  }
  if (seen.has(value)) {
    errors.push(`${pathLabel} contains a cycle`);
    return undefined;
  }
  seen.add(value);

  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some((key) => typeof key === "symbol")) errors.push(`${pathLabel} contains symbol keys`);
  if (prototype !== (isArray ? Array.prototype : Object.prototype) && prototype !== null) {
    errors.push(`${pathLabel} must use a plain JSON prototype`);
  }
  const output = isArray ? [] : Object.create(null);
  const lengthDescriptor = isArray ? descriptors.length : null;
  const length = isArray && lengthDescriptor && "value" in lengthDescriptor && Number.isSafeInteger(lengthDescriptor.value)
    ? lengthDescriptor.value
    : 0;
  if (isArray && (!lengthDescriptor || !("value" in lengthDescriptor))) {
    errors.push(`${pathLabel}.length must be a data property`);
  }
  for (const key of ownKeys) {
    if (typeof key !== "string" || (isArray && key === "length")) continue;
    const descriptor = descriptors[key];
    if (!("value" in descriptor)) {
      errors.push(`${pathLabel}.${key} accessor properties are not allowed`);
      continue;
    }
    if (!descriptor.enumerable) {
      errors.push(`${pathLabel}.${key} must be enumerable`);
      continue;
    }
    if (isArray && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) {
      errors.push(`${pathLabel}.${key} is not a valid array element`);
      continue;
    }
    const child = inspectJsonValue(descriptor.value, `${pathLabel}.${key}`, errors, seen);
    if (isArray) output[Number(key)] = child;
    else output[key] = child;
  }
  if (isArray) {
    for (let index = 0; index < length; index += 1) {
      if (!(index in output)) errors.push(`${pathLabel} contains an array hole at ${index}`);
    }
  }
  seen.delete(value);
  return output;
};

const exactKeys = (value, allowed, pathLabel, errors) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${pathLabel} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) errors.push(`${pathLabel} has unknown key ${key}`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value, key)) errors.push(`${pathLabel} is missing key ${key}`);
  }
  return true;
};

const stringArray = (value, label, errors) => {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return [];
  }
  if (value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    errors.push(`${label} must contain non-empty strings`);
  }
  if (new Set(value).size !== value.length) errors.push(`${label} must not contain duplicates`);
  return value;
};

export const validateGraphPositionInput = (candidate) => {
  const errors = [];
  const input = inspectJsonValue(candidate, "input", errors);
  if (input === undefined || input === null || typeof input !== "object" || Array.isArray(input)) {
    if (!errors.some((error) => error.includes("cannot be inspected safely"))) errors.push("input must be an object");
    return [...new Set(errors)];
  }
  if (errors.length > 0) return [...new Set(errors)];
  exactKeys(input, [
    "schema", "invocation", "node", "graphVersion", "authority", "manifest", "lineage",
    "dependencies", "writes", "worktree", "evidence", "decisionHistory", "movement",
  ], "input", errors);
  if (input.schema !== "AuraGraphPositionInputV1") errors.push("input.schema must equal AuraGraphPositionInputV1");
  if (input.graphVersion !== GRAPH_VERSION) errors.push("input.graphVersion does not match approved Graph v2");
  if (typeof input.node !== "string" || !approvedNodes.has(input.node)) errors.push("input.node is not an approved graph node");

  if (exactKeys(input.invocation, ["mode", "phase"], "input.invocation", errors)) {
    if (input.invocation.mode !== "explicit") errors.push("input.invocation.mode must equal explicit");
    if (!PHASES.includes(input.invocation.phase)) errors.push("input.invocation.phase is invalid");
  }
  if (exactKeys(input.authority, ["status", "errors"], "input.authority", errors)) {
    if (!['pass', 'fail'].includes(input.authority.status)) errors.push("input.authority.status must be pass or fail");
    const authorityErrors = stringArray(input.authority.errors, "input.authority.errors", errors);
    if (input.authority.status !== "pass" || authorityErrors.length > 0) errors.push("approved graph authority did not pass");
  }

  if (exactKeys(input.manifest, [
    "commit", "status", "owner", "verifier", "depends", "externalGates", "writeSet", "repair",
  ], "input.manifest", errors)) {
    if (typeof input.manifest.commit !== "string" || !COMMIT.test(input.manifest.commit)) {
      errors.push("input.manifest.commit must be a full Git commit");
    }
    if (!MANIFEST_STATUSES.includes(input.manifest.status)) errors.push("input.manifest.status is invalid");
    if (typeof input.manifest.owner !== "string" || input.manifest.owner.length === 0) errors.push("input.manifest.owner is required");
    if (input.manifest.verifier !== "independent-fresh-context") {
      errors.push("input.manifest.verifier must remain independent-fresh-context");
    }
    stringArray(input.manifest.depends, "input.manifest.depends", errors);
    const externalGates = stringArray(input.manifest.externalGates, "input.manifest.externalGates", errors);
    stringArray(input.manifest.writeSet, "input.manifest.writeSet", errors);
    if (externalGates.length > 0) errors.push("unresolved external gates block forward movement");
    if (exactKeys(input.manifest.repair, ["used", "maximum"], "input.manifest.repair", errors)) {
      if (!Number.isInteger(input.manifest.repair.used) || !Number.isInteger(input.manifest.repair.maximum) ||
          input.manifest.repair.used < 0 || input.manifest.repair.maximum < 0 ||
          input.manifest.repair.used > input.manifest.repair.maximum || input.manifest.repair.maximum > 1) {
        errors.push("input.manifest.repair must describe a valid 0..1 repair budget");
      }
    }
  }

  if (exactKeys(input.lineage, ["base", "candidate", "closure"], "input.lineage", errors)) {
    for (const key of ["base", "candidate"]) {
      if (typeof input.lineage[key] !== "string" || !COMMIT.test(input.lineage[key])) {
        errors.push(`input.lineage.${key} must be a full Git commit`);
      }
    }
    if (input.lineage.closure !== null && (typeof input.lineage.closure !== "string" || !COMMIT.test(input.lineage.closure))) {
      errors.push("input.lineage.closure must be null or a full Git commit");
    }
  }

  if (!Array.isArray(input.dependencies)) errors.push("input.dependencies must be an array");
  else for (let index = 0; index < input.dependencies.length; index += 1) {
    const dependency = input.dependencies[index];
    const label = `input.dependencies[${index}]`;
    if (exactKeys(dependency, ["ref", "actualStatus"], label, errors)) {
      if (typeof dependency.ref !== "string" || !dependency.ref.includes(":")) errors.push(`${label}.ref is invalid`);
      const expected = typeof dependency.ref === "string" ? dependency.ref.split(":").at(-1) : "";
      if (dependency.actualStatus !== expected) errors.push(`${label} does not satisfy ${dependency.ref}`);
    }
  }

  if (exactKeys(input.writes, [
    "declared", "changed", "delta", "protectedPathErrors", "overlappingOwners",
  ], "input.writes", errors)) {
    const declared = stringArray(input.writes.declared, "input.writes.declared", errors);
    const changed = stringArray(input.writes.changed, "input.writes.changed", errors);
    const delta = stringArray(input.writes.delta, "input.writes.delta", errors);
    const protectedErrors = stringArray(input.writes.protectedPathErrors, "input.writes.protectedPathErrors", errors);
    const owners = stringArray(input.writes.overlappingOwners, "input.writes.overlappingOwners", errors);
    if (JSON.stringify([...declared].sort()) !== JSON.stringify([...changed].sort()) || delta.length > 0) {
      errors.push("candidate paths do not exactly equal the declared write set");
    }
    if (protectedErrors.length > 0) errors.push("candidate contains protected path violations");
    if (owners.length > 0) errors.push("candidate write set overlaps a live owner");
  }
  if (exactKeys(input.worktree, ["status"], "input.worktree", errors) && input.worktree.status !== "clean") {
    errors.push("worktree must be clean");
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) errors.push("input.evidence must be a non-empty array");
  else for (let index = 0; index < input.evidence.length; index += 1) {
    const item = input.evidence[index];
    const label = `input.evidence[${index}]`;
    if (exactKeys(item, ["command", "status"], label, errors)) {
      if (typeof item.command !== "string" || item.command.length === 0) errors.push(`${label}.command is required`);
      if (item.status !== "pass") errors.push(`${label}.status must be pass`);
    }
  }
  if (exactKeys(input.decisionHistory, ["status", "commits", "errors"], "input.decisionHistory", errors)) {
    if (input.decisionHistory.status !== "pass") errors.push("decision history did not pass");
    const commits = stringArray(input.decisionHistory.commits, "input.decisionHistory.commits", errors);
    if (commits.some((commit) => !COMMIT.test(commit))) errors.push("decision history contains an invalid commit");
    const historyErrors = stringArray(input.decisionHistory.errors, "input.decisionHistory.errors", errors);
    if (historyErrors.length > 0) errors.push("decision history contains errors");
  }
  if (exactKeys(input.movement, ["requested", "lateralCandidates"], "input.movement", errors)) {
    if (!MOVE_CLASSES.includes(input.movement.requested)) errors.push("input.movement.requested is invalid");
    if (!Array.isArray(input.movement.lateralCandidates)) errors.push("input.movement.lateralCandidates must be an array");
  }
  return [...new Set(errors)];
};

export const buildGraphPositionReceipt = (candidate) => {
  const errors = validateGraphPositionInput(candidate);
  const safeErrors = [];
  const input = inspectJsonValue(candidate, "input", safeErrors);
  const usable = safeErrors.length === 0 && input && typeof input === "object" && !Array.isArray(input);
  const allErrors = [...new Set([...errors, ...safeErrors])];
  return {
    schema: "AuraGraphPositionReceiptV1",
    graphVersion: usable ? input.graphVersion : GRAPH_VERSION,
    node: usable && typeof input.node === "string" ? input.node : "unknown",
    phase: usable && typeof input.invocation?.phase === "string" ? input.invocation.phase : "unknown",
    invocation: { mode: usable && input.invocation?.mode === "explicit" ? "explicit" : "invalid" },
    verdict: allErrors.length === 0 ? "pass" : "fail",
    independentVerification: "required",
    inspected: {
      manifestCommit: usable && typeof input.manifest?.commit === "string" ? input.manifest.commit : null,
      status: usable && typeof input.manifest?.status === "string" ? input.manifest.status : null,
      owner: usable && typeof input.manifest?.owner === "string" ? input.manifest.owner : null,
      verifier: usable && typeof input.manifest?.verifier === "string" ? input.manifest.verifier : null,
    },
    checks: {
      authority: allErrors.some((error) => error.includes("authority")) ? "fail" : "pass",
      dependencies: allErrors.some((error) => error.includes("dependencies")) ? "fail" : "pass",
      writes: allErrors.some((error) => /write|candidate|protected/.test(error)) ? "fail" : "pass",
      worktree: allErrors.some((error) => error.includes("worktree")) ? "fail" : "pass",
      evidence: allErrors.some((error) => error.includes("evidence")) ? "fail" : "pass",
      decisionHistory: allErrors.some((error) => error.includes("decision history")) ? "fail" : "pass",
    },
    movement: {
      requested: usable && typeof input.movement?.requested === "string" ? input.movement.requested : "blocked-authority",
      allowed: allErrors.length === 0,
      options: [],
    },
    correction: allErrors.length === 0 ? null : {
      node: usable && typeof input.node === "string" ? input.node : "unknown",
      violatedGate: allErrors[0],
      safeMove: "blocked-authority",
      authorityRequired: "named by the failed gate",
    },
    errors: allErrors,
  };
};

export const validateDecisionHistorySequence = (sequenceCandidate) => {
  const errors = [];
  const sequence = inspectJsonValue(sequenceCandidate, "decision history", errors);
  if (errors.length > 0) return [...new Set(errors)];
  if (!Array.isArray(sequence) || sequence.length < 2) return ["decision history must include pinned V1 and V2 migration"];
  if (sequence[0]?.schema !== EXPECTED_HISTORICAL_REGISTRY.lastSchema) {
    errors.push("decision history does not start with the pinned V1 registry");
  }
  if (sequence[1]?.schema !== "FounderDecisionRegistryV2" || sequence[1]?.changes?.length !== 0) {
    errors.push("decision history V1-to-V2 migration must begin with zero appended changes");
  }
  const migrationErrors = validateFounderDecisionLedger(sequence[1]);
  if (migrationErrors.length > 0) errors.push(...migrationErrors.map((error) => `history migration: ${error}`));
  for (let index = 2; index < sequence.length; index += 1) {
    const currentErrors = validateFounderDecisionLedger(sequence[index]);
    if (currentErrors.length > 0) errors.push(...currentErrors.map((error) => `history commit ${index}: ${error}`));
    const transitionErrors = validateFounderDecisionTransition(sequence[index - 1], sequence[index]);
    if (transitionErrors.length > 0) {
      errors.push(`decision history rewrite at transition ${index}: ${transitionErrors.join("; ")}`);
    }
  }
  return [...new Set(errors)];
};

const git = (repoRoot, args, encoding = "utf8") => execFileSync("git", args, {
  cwd: repoRoot,
  encoding,
  stdio: ["ignore", "pipe", "pipe"],
});

export const validateRepositoryDecisionHistory = (repoRootInput, candidateCommit, options = {}) => {
  const repoRoot = path.resolve(String(repoRootInput));
  const anchorCommit = options.anchorCommit ?? EXPECTED_HISTORICAL_REGISTRY.pinnedAtCommit;
  const expectedStored = options.expectedHistoricalStoredSha256 ?? EXPECTED_HISTORICAL_REGISTRY.storedBlobSha256;
  const expectedObject = options.expectedHistoricalObjectSha256 ?? EXPECTED_HISTORICAL_REGISTRY.objectSha256;
  if (!COMMIT.test(String(anchorCommit)) || !COMMIT.test(String(candidateCommit))) {
    return ["decision history anchor and candidate must be full Git commits"];
  }
  let anchorBytes;
  let commits;
  try {
    git(repoRoot, ["merge-base", "--is-ancestor", anchorCommit, candidateCommit]);
    anchorBytes = git(repoRoot, ["cat-file", "blob", `${anchorCommit}:${EXPECTED_HISTORICAL_REGISTRY.path}`], null);
    const output = git(repoRoot, [
      "log", "--first-parent", "--reverse", "--format=%H", `${anchorCommit}..${candidateCommit}`,
      "--", EXPECTED_HISTORICAL_REGISTRY.path,
    ]);
    commits = output.trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return ["repository decision history cannot be reopened"];
  }
  const errors = [];
  if (sha256(anchorBytes) !== expectedStored || gitBlobObjectSha256(anchorBytes) !== expectedObject) {
    errors.push("pinned V1 decision registry does not match its stored and object hashes");
  }
  const ledgers = [];
  try {
    ledgers.push(JSON.parse(anchorBytes.toString("utf8")));
    for (const commit of commits) {
      const bytes = git(repoRoot, ["cat-file", "blob", `${commit}:${EXPECTED_HISTORICAL_REGISTRY.path}`], null);
      ledgers.push(JSON.parse(bytes.toString("utf8")));
    }
  } catch {
    return [...new Set([...errors, "repository decision history contains invalid or missing JSON"])];
  }
  errors.push(...validateDecisionHistorySequence(ledgers));
  return [...new Set(errors)];
};

