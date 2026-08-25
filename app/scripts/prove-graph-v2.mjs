import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export const APPROVED_GRAPH = Object.freeze({
  version: "2.0",
  path: "docs/plans/2026-08-22-aura-full-system-graph-v2.0.md",
  proposalCommit: "f7616886f9f8a171c847ef5eb49e932246ff989b",
  gitBlobSha256: "680FD8D8F2142E92DE5A629B60D9C1DE160CCC57A0F7DDDDC872CDC4ACDAB9A8",
  gitObjectSha256: "48A7E075406A0E9C8EE24C11C9C411EC10C0F219D0CCF84D9129FA83D79D49C7",
  approvalPath: "docs/plans/approvals/2026-08-22-aura-full-system-graph-v2.0.md",
  approvalCommit: "e031a83b8d9dcd428ffaab46d83b39370f2962a0",
  founderInstruction: "go with 1 and then add the ux nodes and begin work and approve everything",
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

export const loadProtectedPaths = async (repoRoot) =>
  JSON.parse(
    await readFile(path.join(repoRoot, "docs", "plans", "registry", "protected-paths.json"), "utf8"),
  );

const GLOB_PATTERN = /[*?\[\]{}!]/;

export const normalizeRepoPath = (value) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("repository path must be a non-empty string");
  }
  const slashed = value.trim().replaceAll("\\", "/");
  if (/^[A-Za-z]:\//.test(slashed) || slashed.startsWith("/")) {
    throw new Error(`repository path cannot be absolute: ${value}`);
  }
  if (GLOB_PATTERN.test(slashed)) {
    throw new Error(`repository path cannot use glob syntax: ${value}`);
  }
  const segments = slashed.split("/").filter((segment) => segment !== "" && segment !== ".");
  if (segments.includes("..")) {
    throw new Error(`repository path cannot traverse parents: ${value}`);
  }
  if (segments.length === 0) throw new Error("repository path cannot resolve to the repository root");
  return segments.join("/");
};

export const validateWriteSet = (values) => {
  const errors = [];
  if (!Array.isArray(values) || values.length === 0) return ["writeSet must be a non-empty array"];
  const normalized = [];
  for (const value of values) {
    try {
      normalized.push({ original: value, path: normalizeRepoPath(value) });
    } catch (error) {
      errors.push(error.message);
    }
  }

  for (let left = 0; left < normalized.length; left += 1) {
    for (let right = left + 1; right < normalized.length; right += 1) {
      const a = normalized[left];
      const b = normalized[right];
      const lowerA = a.path.toLowerCase();
      const lowerB = b.path.toLowerCase();
      if (lowerA === lowerB) {
        const label = a.path === b.path ? "duplicate" : "case alias";
        errors.push(`${label} writeSet entries: ${a.original}, ${b.original}`);
      } else if (lowerA.startsWith(`${lowerB}/`) || lowerB.startsWith(`${lowerA}/`)) {
        errors.push(`overlapping writeSet entries: ${a.original}, ${b.original}`);
      }
    }
  }
  return errors;
};

const pathMatches = (candidate, policy) => {
  const lower = candidate.toLowerCase();
  return (
    (policy.exact ?? []).some((entry) => lower === normalizeRepoPath(entry).toLowerCase()) ||
    (policy.prefixes ?? []).some((entry) => lower.startsWith(normalizeRepoPath(entry).toLowerCase()))
  );
};

const pathMatchesHardFreeze = (candidate, registry) => {
  if (!pathMatches(candidate, registry.hardProtected ?? {})) return false;
  const lower = candidate.toLowerCase();
  return !(registry.hardProtected?.exemptExact ?? []).some(
    (entry) => normalizeRepoPath(entry).toLowerCase() === lower,
  );
};

export const validateProtectedPathRegistry = (registry) => {
  const errors = [];
  if (registry?.schema !== "AuraProtectedPathsV1") errors.push("protected-path schema must be AuraProtectedPathsV1");
  if (typeof registry?.freezeId !== "string" || registry.freezeId.length === 0) {
    errors.push("protected-path registry must name a freezeId");
  }
  if (!/^[0-9a-f]{40}$/i.test(registry?.baselineCommit ?? "")) {
    errors.push("protected-path baselineCommit must be a full Git commit");
  }
  for (const groupName of ["hardProtected", "publicVisualProtected"]) {
    const group = registry?.[groupName];
    if (!group || !Array.isArray(group.exact) || !Array.isArray(group.prefixes)) {
      errors.push(`${groupName} must declare exact and prefixes arrays`);
      continue;
    }
    for (const entry of [...group.exact, ...group.prefixes]) {
      try {
        normalizeRepoPath(entry);
      } catch (error) {
        errors.push(`${groupName}: ${error.message}`);
      }
    }
    for (const entry of group.exemptExact ?? []) {
      try {
        normalizeRepoPath(entry);
      } catch (error) {
        errors.push(`${groupName} exemption: ${error.message}`);
      }
    }
  }
  const ids = new Set();
  for (const exception of registry?.exceptions ?? []) {
    if (ids.has(exception.id)) errors.push(`duplicate protected-path exception ${exception.id}`);
    ids.add(exception.id);
    let candidate;
    try {
      candidate = normalizeRepoPath(exception.path);
    } catch (error) {
      errors.push(`exception ${exception.id}: ${error.message}`);
      continue;
    }
    if (pathMatchesHardFreeze(candidate, registry)) {
      errors.push(`exception ${exception.id} cannot weaken a hard-protected path`);
    }
    if (!pathMatches(candidate, registry.publicVisualProtected ?? {})) {
      errors.push(`exception ${exception.id} must target a public-visual protected path`);
    }
    if (typeof exception.contentGate !== "string" || exception.contentGate.length === 0) {
      errors.push(`exception ${exception.id} must require a contentGate`);
    }
  }
  return errors;
};

const approvedException = (candidate, manifest, registry) =>
  (registry.exceptions ?? []).find((exception) => {
    if (normalizeRepoPath(exception.path).toLowerCase() !== candidate.toLowerCase()) return false;
    if (exception.freezeClass && exception.freezeClass === manifest.freezeClass) return true;
    return (exception.nodes ?? []).includes(manifest.node);
  });

export const validateManifestPathPolicy = (manifest, registry) => {
  const errors = [...validateWriteSet(manifest.writeSet)];
  for (const rawPath of manifest.writeSet ?? []) {
    let candidate;
    try {
      candidate = normalizeRepoPath(rawPath);
    } catch {
      continue;
    }
    if (pathMatchesHardFreeze(candidate, registry)) {
      errors.push(`${candidate} is hard-protected by ${registry.freezeId}`);
      continue;
    }
    if (
      pathMatches(candidate, registry.publicVisualProtected ?? {}) &&
      !approvedException(candidate, manifest, registry)
    ) {
      errors.push(`${candidate} is public-visual protected and has no approved exception for ${manifest.node}`);
    }
  }
  return errors;
};

export const validateCandidatePaths = (candidatePaths, manifest, registry, options = {}) => {
  const errors = [...validateWriteSet(candidatePaths), ...validateManifestPathPolicy(manifest, registry)];
  const owned = new Set(
    (manifest.writeSet ?? []).flatMap((entry) => {
      try {
        return [normalizeRepoPath(entry).toLowerCase()];
      } catch {
        return [];
      }
    }),
  );
  const contentGates = new Map(
    Object.entries(options.contentGates ?? {}).flatMap(([entry, gate]) => {
      try {
        return [[normalizeRepoPath(entry).toLowerCase(), gate]];
      } catch {
        return [];
      }
    }),
  );

  for (const rawPath of candidatePaths ?? []) {
    let candidate;
    try {
      candidate = normalizeRepoPath(rawPath);
    } catch {
      continue;
    }
    const lower = candidate.toLowerCase();
    if (!owned.has(lower)) errors.push(`${candidate} is outside manifest writeSet for ${manifest.node}`);
    if (pathMatchesHardFreeze(candidate, registry)) {
      errors.push(`${candidate} is hard-protected by ${registry.freezeId}`);
      continue;
    }
    if (pathMatches(candidate, registry.publicVisualProtected ?? {})) {
      const exception = approvedException(candidate, manifest, registry);
      if (!exception) {
        errors.push(`${candidate} has no approved exception for ${manifest.node}`);
      } else if (exception.contentGate === "builder-css-only") {
        const sources = options.contentSources?.[candidate] ?? options.contentSources?.[lower];
        if (!sources || typeof sources.baseline !== "string" || typeof sources.candidate !== "string") {
          errors.push(`${candidate} requires baseline and candidate CSS for content gate builder-css-only`);
        } else {
          errors.push(
            ...validateBuilderCssChanges(sources.baseline, sources.candidate).map(
              (error) => `${candidate}: ${error}`,
            ),
          );
        }
      } else if (exception.contentGate === "copy-only") {
        const sources = options.contentSources?.[candidate] ?? options.contentSources?.[lower];
        if (!sources || typeof sources.baseline !== "string" || typeof sources.candidate !== "string") {
          errors.push(`${candidate} requires baseline and candidate source for content gate copy-only`);
        } else {
          errors.push(
            ...validateCopyOnlyChanges(sources.baseline, sources.candidate, candidate).map(
              (error) => `${candidate}: ${error}`,
            ),
          );
        }
      } else if (exception.contentGate === "builder-page-functional-only") {
        const sources = options.contentSources?.[candidate] ?? options.contentSources?.[lower];
        if (!sources || typeof sources.baseline !== "string" || typeof sources.candidate !== "string") {
          errors.push(`${candidate} requires baseline and candidate source for content gate builder-page-functional-only`);
        } else {
          errors.push(
            ...validateBuilderPageChanges(sources.baseline, sources.candidate).map(
              (error) => `${candidate}: ${error}`,
            ),
          );
        }
      } else if (contentGates.get(lower) !== exception.contentGate) {
        errors.push(`${candidate} requires content gate ${exception.contentGate}`);
      }
    }
  }
  return [...new Set(errors)];
};

const cssRules = (source) => {
  const rules = [];
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const walk = (body, context = []) => {
    let cursor = 0;
    while (cursor < body.length) {
      while (cursor < body.length && /\s/.test(body[cursor])) cursor += 1;
      if (cursor >= body.length) break;
      const open = body.indexOf("{", cursor);
      const semicolon = body.indexOf(";", cursor);
      if (open === -1 || (semicolon !== -1 && semicolon < open)) {
        cursor = semicolon === -1 ? body.length : semicolon + 1;
        continue;
      }
      const prelude = body.slice(cursor, open).trim().replace(/\s+/g, " ");
      let depth = 1;
      let quote = null;
      let close = open + 1;
      for (; close < body.length && depth > 0; close += 1) {
        const character = body[close];
        if (quote) {
          if (character === "\\") close += 1;
          else if (character === quote) quote = null;
          continue;
        }
        if (character === '"' || character === "'") quote = character;
        else if (character === "{") depth += 1;
        else if (character === "}") depth -= 1;
      }
      const block = body.slice(open + 1, Math.max(open + 1, close - 1));
      if (/^@(media|supports|layer|container)\b/i.test(prelude)) {
        walk(block, [...context, prelude]);
      } else {
        rules.push({
          selector: prelude,
          context: context.join(" > "),
          body: block.trim().replace(/\s+/g, " "),
        });
      }
      cursor = close;
    }
  };
  walk(clean);
  const counts = new Map();
  return new Map(
    rules.map((rule) => {
      const base = `${rule.context}|${rule.selector}`;
      const occurrence = counts.get(base) ?? 0;
      counts.set(base, occurrence + 1);
      return [`${base}#${occurrence}`, rule];
    }),
  );
};

const builderScopedSelector = (selector) =>
  selector
    .split(",")
    .map((part) => part.trim())
    .every((part) => /^(?:\.builder-|\.guided-|\.is-builder\b|\[data-builder)/.test(part));

export const validateBuilderCssChanges = (baselineSource, candidateSource) => {
  const baseline = cssRules(baselineSource);
  const candidate = cssRules(candidateSource);
  const errors = [];
  for (const key of new Set([...baseline.keys(), ...candidate.keys()])) {
    const before = baseline.get(key);
    const after = candidate.get(key);
    if (before?.body === after?.body) continue;
    const selector = after?.selector ?? before?.selector ?? "unknown";
    if (!builderScopedSelector(selector)) {
      errors.push(`CSS selector ${selector} is outside the bounded builder workspace`);
    }
  }
  return errors;
};

const COPY_VALUE_FIELDS = new Set([
  "n",
  "k",
  "v",
  "label",
  "heading",
  "body",
  "sub",
  "cue",
  "tagline",
  "season",
  "text",
  "title",
  "desc",
]);

const propertyName = (node) => {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return null;
};

const copyScrub = (source, filePath) => {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const parseErrors = sourceFile.parseDiagnostics ?? [];
  if (parseErrors.length > 0) {
    return { scrubbed: null, errors: parseErrors.map((diagnostic) => `copy source parse error ${diagnostic.code}`) };
  }
  const ranges = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      const directField = ts.isPropertyAssignment(parent) ? propertyName(parent.name) : null;
      const arrayField =
        ts.isArrayLiteralExpression(parent) && ts.isPropertyAssignment(parent.parent)
          ? propertyName(parent.parent.name)
          : null;
      if (COPY_VALUE_FIELDS.has(directField) || arrayField === "titleLines") {
        ranges.push([node.getStart(sourceFile), node.getEnd()]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  let scrubbed = source;
  for (const [start, end] of ranges.sort((a, b) => b[0] - a[0])) {
    scrubbed = `${scrubbed.slice(0, start)}"<COPY>"${scrubbed.slice(end)}`;
  }
  return { scrubbed, errors: [] };
};

export const validateCopyOnlyChanges = (baselineSource, candidateSource, filePath) => {
  if (filePath.toLowerCase() !== "app/components/story/copy.ts") {
    return [`${filePath} is not an approved copy-only module`];
  }
  const baseline = copyScrub(baselineSource, filePath);
  const candidate = copyScrub(candidateSource, filePath);
  const errors = [...baseline.errors, ...candidate.errors];
  if (errors.length === 0 && baseline.scrubbed !== candidate.scrubbed) {
    errors.push("copy-only change altered imports, executable tokens, object structure, routing, or non-copy fields");
  }
  return errors;
};

const sourceFacts = (source, fileName) => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = [];
  const classes = [];
  const jsxTags = [];
  let builderApps = 0;
  let inlineStyles = 0;
  let handlers = 0;
  let dynamicLoaders = 0;
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const commonJsRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (dynamicImport || commonJsRequire) {
        dynamicLoaders += 1;
        const argument = node.arguments[0];
        if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
          imports.push(argument.text);
        }
      }
    }
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = node.tagName.getText(sourceFile);
      jsxTags.push(tag);
      if (tag === "BuilderApp") builderApps += 1;
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue;
        const name = attribute.name.getText(sourceFile);
        if (name === "style") inlineStyles += 1;
        if (/^on[A-Z]/.test(name)) handlers += 1;
        if (name === "className" && attribute.initializer && ts.isStringLiteral(attribute.initializer)) {
          classes.push(...attribute.initializer.text.split(/\s+/).filter(Boolean));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { imports, classes, jsxTags, builderApps, inlineStyles, handlers, dynamicLoaders };
};

export const validateBuilderPageChanges = (baselineSource, candidateSource) => {
  const before = sourceFacts(baselineSource, "build-page-baseline.tsx");
  const after = sourceFacts(candidateSource, "build-page-candidate.tsx");
  const errors = [];
  const forbiddenImport = /(react-three|(?:^|\/)three(?:\/|$)|(?:^|\/)story(?:\/|$)|motion|Viewport|PlanModelPreview|Walkthrough|OpeningHandles|SurfacePicker)/i;
  if (after.imports.some((entry) => forbiddenImport.test(entry))) {
    errors.push("builder page cannot import motion, story, renderer, or protected 3D modules");
  }
  if (after.dynamicLoaders > before.dynamicLoaders) {
    errors.push("builder page cannot add dynamic import or require loaders");
  }
  if (
    after.jsxTags.some((tag) =>
      /\.|^(?:Viewport$|PlanModelPreview$|Walkthrough$|OpeningHandles$|SurfacePicker$)/.test(tag),
    )
  ) {
    errors.push("builder page cannot render motion or protected 3D component tags");
  }
  if (before.builderApps !== 1 || after.builderApps !== 1) {
    errors.push("builder page must retain exactly one BuilderApp mount");
  }
  if (after.inlineStyles > before.inlineStyles) errors.push("builder page cannot add inline visual styles");
  if (after.handlers > before.handlers) errors.push("builder page cannot add route-level event handlers");
  const beforeClasses = new Set(before.classes);
  const unsafeNewClasses = after.classes.filter(
    (entry) => !beforeClasses.has(entry) && !/^builder-page(?:-|__|$)/.test(entry),
  );
  if (unsafeNewClasses.length > 0) {
    errors.push(`builder page added non-builder visual classes: ${[...new Set(unsafeNewClasses)].join(", ")}`);
  }
  return errors;
};

const graphNodeIds = async (repoRoot) => {
  const source = gitBlob(repoRoot, APPROVED_GRAPH.proposalCommit, APPROVED_GRAPH.path).toString("utf8");
  const ids = new Set();
  const nodePattern = /\b(?:G|IP|UX|ED|OR|AI|LO|CM|HM|DV|Q)\d{2}\b/g;
  for (const match of source.matchAll(nodePattern)) ids.add(match[0]);
  return ids;
};

const tableValue = (source, field) => {
  const row = source
    .split(/\r?\n/)
    .find((line) => line.startsWith(`| ${field} |`));
  if (!row) return null;
  return row.split("|")[2]?.trim().replace(/^`|`$/g, "") ?? null;
};

export const validateApprovalRecordSource = (source) => {
  const errors = [];
  const required = {
    "Graph version": APPROVED_GRAPH.version,
    "Approval state": "APPROVED",
    "Founder instruction": APPROVED_GRAPH.founderInstruction,
    "Proposed graph path": APPROVED_GRAPH.path,
    "Proposed graph commit": APPROVED_GRAPH.proposalCommit,
    "Proposed graph canonical Git-blob SHA-256": APPROVED_GRAPH.gitBlobSha256,
    "Proposed graph Git-object SHA-256": APPROVED_GRAPH.gitObjectSha256,
  };

  for (const [field, expected] of Object.entries(required)) {
    const actual = tableValue(source, field);
    if (actual !== expected) {
      errors.push(`approval ${field} must equal ${expected}; received ${actual ?? "missing"}`);
    }
  }
  return errors;
};

export const pinnedApprovalSource = async (repoRoot) =>
  gitBlob(repoRoot, APPROVED_GRAPH.approvalCommit, APPROVED_GRAPH.approvalPath).toString("utf8");

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
    const approvalSource = await pinnedApprovalSource(repoRoot);
    errors.push(...validateApprovalRecordSource(approvalSource));
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
  errors.push(...validateWriteSet(manifest.writeSet));
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
  const protectedPaths = await loadProtectedPaths(repoRoot);
  const manifestDir = path.join(repoRoot, "docs", "plans", "execution", "v2");
  const files = (await readdir(manifestDir)).filter((name) => name.endsWith(".json")).sort();
  const manifests = [];
  const errors = [...authority.errors, ...validateProtectedPathRegistry(protectedPaths)];

  for (const file of files) {
    const manifest = JSON.parse(await readFile(path.join(manifestDir, file), "utf8"));
    const result = await validateExecutionNode(manifest, repoRoot);
    const policyErrors = validateManifestPathPolicy(manifest, protectedPaths);
    const manifestErrors = [...new Set([...result.errors, ...policyErrors])];
    manifests.push({ file, node: manifest.node, status: manifest.status, errors: manifestErrors });
    errors.push(...manifestErrors.map((error) => `${file}: ${error}`));
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
