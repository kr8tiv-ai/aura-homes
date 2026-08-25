import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

export const FOUNDER_DECISION_NOTE =
  "Graph v2 is the approved decision seed. Later founder changes are appended as scoped, source-bound records and remain non-executable until the graph change protocol produces a separately approved successor.";

export const EXPECTED_AUTHORITY_SEED = Object.freeze({
  graphVersion: "2.0",
  graphPath: "docs/plans/2026-08-22-aura-full-system-graph-v2.0.md",
  proposalCommit: "f7616886f9f8a171c847ef5eb49e932246ff989b",
  storedBlobSha256: "680FD8D8F2142E92DE5A629B60D9C1DE160CCC57A0F7DDDDC872CDC4ACDAB9A8",
  objectSha256: "48A7E075406A0E9C8EE24C11C9C411EC10C0F219D0CCF84D9129FA83D79D49C7",
  approvalPath: "docs/plans/approvals/2026-08-22-aura-full-system-graph-v2.0.md",
  approvalCommit: "e031a83b8d9dcd428ffaab46d83b39370f2962a0",
  decisionIds: Object.freeze(Array.from({ length: 20 }, (_, index) => `FD20-${String(index + 1).padStart(2, "0")}`)),
});

export const EXPECTED_HISTORICAL_REGISTRY = Object.freeze({
  path: "docs/plans/registry/decisions.json",
  lastSchema: "FounderDecisionRegistryV1",
  pinnedAtCommit: "b05422675821984ca3625e4e6ff7c8e8ff5a32e2",
  storedBlobSha256: "3CAED0565847BB2F97A68AD028569312E5653E9807AB5546B421853993770745",
  objectSha256: "9137324C4C47D31B22A68369F1BA4531BBE06EA428739D363FA0ADDE8C50EB29",
  disposition: "historical-input-only",
});

export const EXPECTED_FOUNDER_AUTHOR = "Matt-Aurora-Ventures <lucidbloks@gmail.com>";

export const APPROVED_GRAPH_NODE_IDS = Object.freeze([
  "AI01", "AI02", "AI03", "AI04", "AI05",
  "CM01", "CM02", "CM03", "CM04", "CM05",
  "DV01", "DV02", "DV03", "DV04",
  "ED01", "ED02", "ED03", "ED04", "ED05",
  "G00", "G01", "G02", "G03", "G04", "G05",
  "HM01", "HM02", "HM03", "HM04", "HM05",
  "IP01", "IP02", "IP03", "IP04", "IP05", "IP06", "IP07", "IP08", "IP09",
  "LO01", "LO02", "LO03", "LO04",
  "OR01", "OR02", "OR03", "OR04",
  "Q01", "Q02", "Q03", "Q04",
  "UX01", "UX02", "UX03", "UX04", "UX05", "UX06", "UX07", "UX08", "UX09", "UX10",
]);

const approvedGraphNodeIds = new Set(APPROVED_GRAPH_NODE_IDS);

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex").toUpperCase();

export const FOUNDER_DECISION_GENESIS_SHA256 = sha256(JSON.stringify(canonicalize({
  authoritySeed: EXPECTED_AUTHORITY_SEED,
  historicalRegistry: EXPECTED_HISTORICAL_REGISTRY,
})));

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
  if (ownKeys.some((key) => typeof key === "symbol")) {
    errors.push(`${pathLabel} contains symbol keys`);
  }
  if (prototype !== (isArray ? Array.prototype : Object.prototype) && prototype !== null) {
    errors.push(`${pathLabel} must use a plain JSON prototype`);
  }

  const output = isArray ? [] : Object.create(null);
  const stringKeys = ownKeys.filter((key) => typeof key === "string");
  const lengthDescriptor = isArray ? descriptors.length : null;
  const length = isArray && lengthDescriptor && "value" in lengthDescriptor && Number.isSafeInteger(lengthDescriptor.value)
    ? lengthDescriptor.value
    : 0;
  if (isArray && (!lengthDescriptor || !("value" in lengthDescriptor))) {
    errors.push(`${pathLabel}.length must be a data property`);
  }

  for (const key of stringKeys) {
    if (isArray && key === "length") continue;
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

const strictDateMillis = (value, timestamp) => {
  if (typeof value !== "string") return null;
  const expression = timestamp
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/
    : /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = expression.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second, millisecond] = [
    Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 0),
    Number(match[5] ?? 0), Number(match[6] ?? 0), Number(match[7] ?? 0),
  ];
  if (year < 2000 || year > 2100) return null;
  const millis = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const parsed = new Date(millis);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day && parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute && parsed.getUTCSeconds() === second &&
    parsed.getUTCMilliseconds() === millisecond ? millis : null;
};

const equalCanonical = (left, right) => JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

export const hashFounderDecisionChange = (change) => {
  const errors = [];
  const safeChange = inspectJsonValue(change, "decision change", errors);
  if (errors.length > 0 || safeChange === null || typeof safeChange !== "object" || Array.isArray(safeChange)) {
    throw new Error("cannot hash an unsafe decision change");
  }
  const { entrySha256: _entrySha256, ...body } = safeChange;
  return sha256(JSON.stringify(canonicalize(body)));
};

export const hashFounderDecisionSourcePayload = (change) => {
  const errors = [];
  const safeChange = inspectJsonValue(change, "decision change", errors);
  if (errors.length > 0 || safeChange === null || typeof safeChange !== "object" || Array.isArray(safeChange) ||
      safeChange.authority === null || typeof safeChange.authority !== "object" || Array.isArray(safeChange.authority)) {
    throw new Error("cannot hash an unsafe decision source payload");
  }
  const payload = {
    id: safeChange.id,
    recordedAtISO: safeChange.recordedAtISO,
    effectiveDate: safeChange.effectiveDate,
    state: safeChange.state,
    decision: safeChange.decision,
    scope: safeChange.scope,
    authority: {
      actor: safeChange.authority.actor,
      sourceType: safeChange.authority.sourceType,
      sourcePath: safeChange.authority.sourcePath,
    },
    supersedes: safeChange.supersedes,
  };
  return sha256(JSON.stringify(canonicalize(payload)));
};

const duplicateValues = (values) => values.filter((value, index) => values.indexOf(value) !== index);

export const validateFounderDecisionLedger = (candidate) => {
  const errors = [];
  const ledger = inspectJsonValue(candidate, "ledger", errors);
  if (ledger === undefined || ledger === null || typeof ledger !== "object" || Array.isArray(ledger)) {
    if (!errors.some((error) => error.includes("cannot be inspected safely"))) {
      errors.push("ledger must be an object");
    }
    return [...new Set(errors)];
  }
  if (errors.length > 0) return [...new Set(errors)];
  exactKeys(ledger, ["schema", "note", "authoritySeed", "historicalRegistry", "genesisSha256", "changes"], "ledger", errors);
  if (ledger.schema !== "FounderDecisionRegistryV2") errors.push("ledger.schema must equal FounderDecisionRegistryV2");
  if (ledger.note !== FOUNDER_DECISION_NOTE) errors.push("ledger.note does not match the approved change boundary");
  if (!exactKeys(ledger.authoritySeed, Object.keys(EXPECTED_AUTHORITY_SEED), "ledger.authoritySeed", errors) ||
      !equalCanonical(ledger.authoritySeed, EXPECTED_AUTHORITY_SEED)) {
    errors.push("ledger.authoritySeed does not match approved Graph v2");
  }
  if (!exactKeys(ledger.historicalRegistry, Object.keys(EXPECTED_HISTORICAL_REGISTRY), "ledger.historicalRegistry", errors) ||
      !equalCanonical(ledger.historicalRegistry, EXPECTED_HISTORICAL_REGISTRY)) {
    errors.push("ledger.historicalRegistry does not match its pinned V1 artifact");
  }
  if (ledger.genesisSha256 !== FOUNDER_DECISION_GENESIS_SHA256) {
    errors.push("ledger.genesisSha256 does not match the approved authority seed");
  }
  if (!Array.isArray(ledger.changes)) {
    errors.push("ledger.changes must be an array");
    return [...new Set(errors)];
  }

  const knownIds = new Set(EXPECTED_AUTHORITY_SEED.decisionIds);
  const supersededTargets = new Set();
  let previousHash = FOUNDER_DECISION_GENESIS_SHA256;
  for (let index = 0; index < ledger.changes.length; index += 1) {
    const change = ledger.changes[index];
    const label = `ledger.changes[${index}]`;
    if (!exactKeys(change, [
      "id", "recordedAtISO", "effectiveDate", "state", "decision", "scope", "authority",
      "supersedes", "previousEntrySha256", "entrySha256",
    ], label, errors)) continue;
    if (typeof change.id !== "string" || !/^FD-20\d{2}-\d{2}-\d{2}-[a-z0-9-]{3,64}$/.test(change.id)) {
      errors.push(`${label}.id is invalid`);
    } else if (knownIds.has(change.id)) {
      errors.push(`${label} has duplicate decision id ${change.id}`);
    }
    const recordedMillis = strictDateMillis(change.recordedAtISO, true);
    const effectiveMillis = strictDateMillis(change.effectiveDate, false);
    if (recordedMillis === null) errors.push(`${label}.recordedAtISO must be a real UTC timestamp`);
    if (effectiveMillis === null) errors.push(`${label}.effectiveDate must be a real date`);
    if (recordedMillis !== null && effectiveMillis !== null && effectiveMillis > recordedMillis + 86_399_999) {
      errors.push(`${label}.effectiveDate cannot follow recordedAtISO`);
    }
    if (change.state !== "recorded-pending-graph") {
      errors.push(`${label}.state must remain recorded-pending-graph until a successor graph is separately approved`);
    }
    if (typeof change.decision !== "string" || change.decision.trim().length < 20 || change.decision.length > 2_000) {
      errors.push(`${label}.decision must be 20..2000 characters`);
    }

    if (exactKeys(change.scope, ["clauses", "nodes"], `${label}.scope`, errors)) {
      const clauses = Array.isArray(change.scope.clauses) ? change.scope.clauses : [];
      const nodes = Array.isArray(change.scope.nodes) ? change.scope.nodes : [];
      if (!Array.isArray(change.scope.clauses)) errors.push(`${label}.scope.clauses must be an array`);
      if (!Array.isArray(change.scope.nodes)) errors.push(`${label}.scope.nodes must be an array`);
      if (clauses.length + nodes.length === 0) errors.push(`${label}.scope must name at least one clause or node`);
      if (clauses.some((clause) => typeof clause !== "string" || clause.length === 0)) {
        errors.push(`${label}.scope.clauses must contain non-empty strings`);
      }
      if (duplicateValues(clauses).length > 0) {
        errors.push(`${label}.scope.clauses must not contain duplicates`);
      }
      if (nodes.some((node) => typeof node !== "string" || !/^[A-Z]{1,3}\d{2}$/.test(node))) {
        errors.push(`${label}.scope.nodes must contain graph node ids`);
      }
      for (const node of nodes) {
        if (typeof node === "string" && /^[A-Z]{1,3}\d{2}$/.test(node) && !approvedGraphNodeIds.has(node)) {
          errors.push(`${label}.scope.nodes contains unknown approved graph node ${node}`);
        }
      }
      if (duplicateValues(nodes).length > 0) {
        errors.push(`${label}.scope.nodes must not contain duplicates`);
      }
    }

    if (exactKeys(change.authority, ["actor", "sourceType", "sourcePath", "sourceCommit"], `${label}.authority`, errors)) {
      if (change.authority.actor !== "founder") errors.push(`${label}.authority.actor must equal founder`);
      if (change.authority.sourceType !== "repo-founder-record") {
        errors.push(`${label}.authority.sourceType must equal repo-founder-record`);
      }
      if (typeof change.authority.sourcePath !== "string" ||
          !/^docs\/plans\/approvals\/[A-Za-z0-9._-]+\.md$/.test(change.authority.sourcePath)) {
        errors.push(`${label}.authority.sourcePath must be a repository approval record`);
      }
      if (typeof change.authority.sourceCommit !== "string" || !/^[0-9a-f]{40}$/.test(change.authority.sourceCommit)) {
        errors.push(`${label}.authority.sourceCommit must be a full Git commit`);
      }
    }

    if (!Array.isArray(change.supersedes)) {
      errors.push(`${label}.supersedes must be an array`);
    } else {
      const seenTargets = new Set();
      for (const target of change.supersedes) {
        if (typeof target !== "string" || !knownIds.has(target)) {
          const targetLabel = typeof target === "string" ? target : "<non-string>";
          errors.push(`${label} supersedes unknown or forward decision ${targetLabel}`);
        } else if (seenTargets.has(target)) {
          errors.push(`${label} repeats supersession target ${target}`);
        } else if (supersededTargets.has(target)) {
          errors.push(`${label} supersession target ${target} was already claimed`);
        }
        seenTargets.add(target);
        if (typeof target === "string" && knownIds.has(target)) supersededTargets.add(target);
      }
    }
    if (change.previousEntrySha256 !== previousHash) {
      errors.push(`${label}.previousEntrySha256 does not continue the ledger`);
    }
    let actualHash = null;
    try {
      actualHash = hashFounderDecisionChange(change);
    } catch {
      errors.push(`${label}.entrySha256 could not be recomputed safely`);
    }
    if (change.entrySha256 !== actualHash) errors.push(`${label}.entrySha256 does not match its canonical body`);
    if (typeof change.id === "string") knownIds.add(change.id);
    if (typeof change.entrySha256 === "string") previousHash = change.entrySha256;
  }
  return [...new Set(errors)];
};

export const validateFounderDecisionTransition = (previousCandidate, nextCandidate) => {
  const errors = [];
  const previousErrors = validateFounderDecisionLedger(previousCandidate);
  const nextErrors = validateFounderDecisionLedger(nextCandidate);
  if (previousErrors.length > 0) errors.push(...previousErrors.map((error) => `previous ledger: ${error}`));
  if (nextErrors.length > 0) errors.push(...nextErrors.map((error) => `next ledger: ${error}`));
  if (errors.length > 0) return [...new Set(errors)];

  const previous = inspectJsonValue(previousCandidate, "previous ledger", errors);
  const next = inspectJsonValue(nextCandidate, "next ledger", errors);
  if (errors.length > 0 || !Array.isArray(previous?.changes) || !Array.isArray(next?.changes)) {
    return [...new Set(errors.length > 0 ? errors : ["ledger transition cannot be inspected safely"] )];
  }
  if (next.changes.length < previous.changes.length) {
    errors.push("ledger transition cannot remove prior decisions");
  }
  const sharedLength = Math.min(previous.changes.length, next.changes.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const previousBytes = JSON.stringify(canonicalize(previous.changes[index]));
    const nextBytes = JSON.stringify(canonicalize(next.changes[index]));
    if (previousBytes !== nextBytes) {
      errors.push(`ledger transition previous decision history is not an exact prefix at index ${index}`);
    }
  }
  return [...new Set(errors)];
};

export const validateFounderDecisionSourceRecord = (changeCandidate, source, author, sourceCommitISO) => {
  const errors = [];
  const change = inspectJsonValue(changeCandidate, "decision change", errors);
  if (errors.length > 0 || change === null || typeof change !== "object" || Array.isArray(change)) {
    return [...new Set(errors.length > 0 ? errors : ["decision change cannot be inspected safely"])];
  }
  if (author !== EXPECTED_FOUNDER_AUTHOR) {
    errors.push("authority source commit is not founder-authored by the exact approved identity");
  }
  if (typeof source !== "string") errors.push("authority source is not text");

  const sourceCommitMillis = typeof sourceCommitISO === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(sourceCommitISO)
    ? Date.parse(sourceCommitISO)
    : Number.NaN;
  if (!Number.isFinite(sourceCommitMillis)) {
    errors.push("authority source commit has no valid chronology");
  }
  const recordedMillis = strictDateMillis(change.recordedAtISO, true);
  if (recordedMillis !== null && Number.isFinite(sourceCommitMillis) && recordedMillis > sourceCommitMillis) {
    errors.push("decision recordedAtISO follows its source commit chronology");
  }

  let payloadDigest = null;
  try {
    payloadDigest = hashFounderDecisionSourcePayload(change);
  } catch {
    errors.push("authority source payload digest could not be recomputed safely");
  }
  if (typeof source === "string") {
    for (const marker of [
      `Decision-ID: ${change.id}`,
      "Founder: Matt",
      "State: RECORDED-PENDING-GRAPH",
      `Decision: ${change.decision}`,
      `Change-SHA256: ${payloadDigest}`,
    ]) {
      if (!source.includes(marker)) errors.push(`authority source is missing exact marker ${marker}`);
    }
  }
  return [...new Set(errors)];
};

export const validateFounderDecisionSources = (candidate, repoRootInput) => {
  const errors = validateFounderDecisionLedger(candidate);
  if (errors.length > 0) return errors;
  const ledger = inspectJsonValue(candidate, "ledger", errors);
  if (errors.length > 0 || ledger === null || typeof ledger !== "object" || !Array.isArray(ledger.changes)) {
    return [...new Set(errors.length > 0 ? errors : ["ledger.changes must be an array"])];
  }
  const repoRoot = repoRootInput instanceof URL
    ? fileURLToPath(repoRootInput)
    : path.resolve(String(repoRootInput));
  for (let index = 0; index < ledger.changes.length; index += 1) {
    const change = ledger.changes[index];
    const label = `ledger.changes[${index}]`;
    if (change === null || typeof change !== "object" || Array.isArray(change) ||
        change.authority === null || typeof change.authority !== "object" || Array.isArray(change.authority)) {
      errors.push(`${label} has no inspectable authority source`);
      continue;
    }
    const commit = change.authority.sourceCommit;
    const sourcePath = change.authority.sourcePath;
    if (typeof commit !== "string" || !/^[0-9a-f]{40}$/.test(commit) ||
        typeof sourcePath !== "string" || !/^docs\/plans\/approvals\/[A-Za-z0-9._-]+\.md$/.test(sourcePath)) {
      errors.push(`${label} has no reopenable repository source`);
      continue;
    }
    let source;
    let author;
    let sourceCommitISO;
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: repoRoot, stdio: "ignore" });
      source = execFileSync("git", ["cat-file", "blob", `${commit}:${sourcePath}`], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      author = execFileSync("git", ["show", "-s", "--format=%an <%ae>", commit], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
      sourceCommitISO = execFileSync("git", ["show", "-s", "--format=%aI", commit], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      errors.push(`${label} authority source does not reopen at its claimed commit`);
      continue;
    }
    errors.push(...validateFounderDecisionSourceRecord(change, source, author, sourceCommitISO)
      .map((error) => `${label} ${error}`));
  }
  return [...new Set(errors)];
};

const gitBlobObjectSha256 = (bytes) => sha256(Buffer.concat([
  Buffer.from(`blob ${bytes.length}\0`, "utf8"),
  bytes,
]));

export const validateFounderDecisionRepositoryTransition = (candidate, repoRootInput) => {
  const errors = [];
  const repoRoot = repoRootInput instanceof URL
    ? fileURLToPath(repoRootInput)
    : path.resolve(String(repoRootInput));
  const registryPath = EXPECTED_HISTORICAL_REGISTRY.path;
  let latestCommit;
  let latestBytes;
  let previousBytes;
  let historicalBytes;
  try {
    latestCommit = execFileSync("git", ["log", "-1", "--format=%H", "--", registryPath], {
      cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    latestBytes = execFileSync("git", ["cat-file", "blob", `${latestCommit}:${registryPath}`], {
      cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"],
    });
    const previousCommit = execFileSync("git", ["log", "-1", "--format=%H", `${latestCommit}^`, "--", registryPath], {
      cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    previousBytes = execFileSync("git", ["cat-file", "blob", `${previousCommit}:${registryPath}`], {
      cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"],
    });
    historicalBytes = execFileSync("git", ["cat-file", "blob", `${EXPECTED_HISTORICAL_REGISTRY.pinnedAtCommit}:${registryPath}`], {
      cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return ["repository decision history cannot be reopened"];
  }

  if (sha256(historicalBytes) !== EXPECTED_HISTORICAL_REGISTRY.storedBlobSha256 ||
      gitBlobObjectSha256(historicalBytes) !== EXPECTED_HISTORICAL_REGISTRY.objectSha256) {
    errors.push("pinned historical decision registry does not match its stored and object hashes");
  }

  let latest;
  let previous;
  try {
    latest = JSON.parse(latestBytes.toString("utf8"));
    previous = JSON.parse(previousBytes.toString("utf8"));
  } catch {
    return [...new Set([...errors, "repository decision history is not valid JSON"])];
  }

  const candidateErrors = validateFounderDecisionLedger(candidate);
  if (candidateErrors.length > 0) return [...new Set([...errors, ...candidateErrors])];
  const candidateMatchesLatest = equalCanonical(candidate, latest);
  const transitionBase = candidateMatchesLatest ? previous : latest;
  if (transitionBase?.schema === "FounderDecisionRegistryV1") {
    if (!equalCanonical(previous, JSON.parse(historicalBytes.toString("utf8"))) || candidate.changes.length !== 0) {
      errors.push("Graph v2 ledger migration must start from the pinned V1 registry with zero appended changes");
    }
  } else if (transitionBase?.schema === "FounderDecisionRegistryV2") {
    errors.push(...validateFounderDecisionTransition(transitionBase, candidate));
  } else {
    errors.push("repository decision history has no recognized transition base");
  }
  return [...new Set(errors)];
};

const main = async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const registryPath = path.join(repoRoot, "docs", "plans", "registry", "decisions.json");
  const ledger = JSON.parse(await readFile(registryPath, "utf8"));
  const errors = [
    ...validateFounderDecisionLedger(ledger),
    ...validateFounderDecisionSources(ledger, repoRoot),
    ...validateFounderDecisionRepositoryTransition(ledger, repoRoot),
  ];
  process.stdout.write(`${JSON.stringify({
    schema: "FounderDecisionLedgerGateReceiptV1",
    registryPath: path.relative(repoRoot, registryPath).replaceAll("\\", "/"),
    authoritySeed: errors.length === 0 ? "pass" : "fail",
    changes: Array.isArray(ledger.changes) ? ledger.changes.length : null,
    errors,
  }, null, 2)}\n`);
  if (errors.length > 0) process.exitCode = 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
