import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  APPROVED_GRAPH,
  gitBlobSha256,
  loadProtectedPaths,
  loadRegistry,
  normalizeRepoPath,
  pinnedApprovalSource,
  validateApprovalRecordSource,
  validateBuilderCssChanges,
  validateBuilderPageChanges,
  validateCandidatePaths,
  validateCopyOnlyChanges,
  validateExecutionNode,
  validateProtectedPathRegistry,
  validateWriteSet,
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

test("repository paths fail closed on traversal, absolute paths, globs, and case aliases", () => {
  assert.equal(normalizeRepoPath("app\\components\\builder\\BuilderApp.tsx"), "app/components/builder/BuilderApp.tsx");
  assert.throws(() => normalizeRepoPath("../app/components/builder/BuilderApp.tsx"), /traverse/);
  assert.throws(() => normalizeRepoPath("C:\\repo\\file.ts"), /absolute/);
  assert.match(validateWriteSet(["app/**"]).join("\n"), /glob syntax/);
  assert.match(
    validateWriteSet(["app/components/builder", "app/components/builder/BuilderApp.tsx"]).join("\n"),
    /overlap/i,
  );
  assert.match(
    validateWriteSet(["app/Foo.ts", "app/foo.ts"]).join("\n"),
    /case alias/i,
  );
});

test("the protected-path registry is complete enough to be a deterministic contract", async () => {
  const registry = await loadProtectedPaths(repoRoot);
  assert.deepEqual(validateProtectedPathRegistry(registry), []);
  assert.match(
    validateProtectedPathRegistry({ ...registry, baselineCommit: "short" }).join("\n"),
    /full Git commit/,
  );
  assert.match(
    validateProtectedPathRegistry({
      ...registry,
      exceptions: [
        ...registry.exceptions,
        {
          id: "ILLEGAL_HARD_FREEZE_EXCEPTION",
          path: "app/components/builder/Viewport.tsx",
          nodes: ["UX02"],
          contentGate: "pretend-safe",
        },
      ],
    }).join("\n"),
    /cannot weaken a hard-protected path/,
  );
});

test("every hard 3D and rendering surface is rejected, including case and slash variants", async () => {
  const registry = await loadProtectedPaths(repoRoot);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const hardProtected = [
    ...registry.hardProtected.exact,
    ...registry.hardProtected.prefixes.map((prefix) => `${prefix}__freeze_probe__`),
    "APP\\LIB\\THREE\\sceneQuality.ts",
  ];

  for (const candidate of hardProtected) {
    const errors = validateCandidatePaths(
      [candidate],
      { ...manifest, writeSet: [candidate] },
      registry,
    );
    assert.match(errors.join("\n"), /hard-protected/, candidate);
  }
});

test("candidate edits must equal an owned manifest path and CSS needs a verified builder-only diff", async () => {
  const registry = await loadProtectedPaths(repoRoot);
  const manifest = JSON.parse(
    await readFile(path.join(repoRoot, "docs/plans/execution/v2/UX02-canvas-first-editor-shell.json"), "utf8"),
  );
  const baselineCss = ".builder-stage { display: grid; } body { margin: 0; }";
  const safeCss = ".builder-stage { display: flex; } body { margin: 0; }";
  const unsafeCss = ".builder-stage { display: flex; } body { margin: 1rem; }";

  assert.match(
    validateCandidatePaths(["app/components/builder/NotOwned.tsx"], manifest, registry).join("\n"),
    /outside manifest writeSet/,
  );
  assert.match(
    validateCandidatePaths(["app/app/globals.css"], manifest, registry, {
      contentGates: { "app/app/globals.css": "builder-css-only" },
    }).join("\n"),
    /requires baseline and candidate CSS/,
  );
  assert.deepEqual(
    validateCandidatePaths(["app/app/globals.css"], manifest, registry, {
      contentSources: {
        "app/app/globals.css": { baseline: baselineCss, candidate: safeCss },
      },
    }),
    [],
  );
  assert.match(
    validateCandidatePaths(["app/app/globals.css"], manifest, registry, {
      contentSources: {
        "app/app/globals.css": { baseline: baselineCss, candidate: unsafeCss },
      },
    }).join("\n"),
    /body/,
  );
  assert.match(
    validateCandidatePaths(
      ["app/app/globals.css"],
      { ...manifest, node: "UX01" },
      registry,
      {
        contentSources: {
          "app/app/globals.css": { baseline: baselineCss, candidate: safeCss },
        },
      },
    ).join("\n"),
    /no approved exception/,
  );
});

test("new story files, landing media, and unapproved public-site surfaces fail closed", async () => {
  const registry = await loadProtectedPaths(repoRoot);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const probes = [
    "app/components/story/NewScene.tsx",
    "app/public/video/enter.mp4",
    "app/public/story/aura-landing-still-v2.jpg",
    "app/public/audio/forest-ambience-loop.mp3",
    "app/app/about/page.tsx",
    "app/components/SiteShell.tsx",
    "app/components/motion-features.ts",
    "app/components/story/StoryChrome.tsx",
  ];

  for (const candidate of probes) {
    const errors = validateCandidatePaths(
      [candidate],
      { ...manifest, writeSet: [candidate] },
      registry,
    );
    assert.match(errors.join("\n"), /hard-protected|public-visual protected|no approved exception/, candidate);
  }
});

test("copy-only proof allows copy fields and rejects routing, structure, and executable changes", async () => {
  const registry = await loadProtectedPaths(repoRoot);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const baseline = `export const CARD = { title: "Old words", href: "/start", side: "left" } as const;`;
  const copyChange = `export const CARD = { title: "Better words", href: "/start", side: "left" } as const;`;
  const routeChange = `export const CARD = { title: "Old words", href: "/buy", side: "left" } as const;`;
  const behaviorChange = `export const CARD = { title: "Old words", href: "/start", side: "right" } as const;`;
  const copyManifest = {
    ...manifest,
    node: "G01",
    freezeClass: "copy-only",
    writeSet: ["app/components/story/copy.ts"],
  };

  assert.deepEqual(validateCopyOnlyChanges(baseline, copyChange, "app/components/story/copy.ts"), []);
  assert.match(validateCopyOnlyChanges(baseline, routeChange, "app/components/story/copy.ts").join("\n"), /routing|non-copy/);
  assert.match(validateCopyOnlyChanges(baseline, behaviorChange, "app/components/story/copy.ts").join("\n"), /executable|non-copy/);
  assert.match(
    validateCandidatePaths(
      ["app/components/story/copy.ts"],
      copyManifest,
      registry,
      { contentGates: { "app/components/story/copy.ts": "copy-only" } },
    ).join("\n"),
    /requires baseline and candidate source/,
  );
  assert.deepEqual(
    validateCandidatePaths(["app/components/story/copy.ts"], copyManifest, registry, {
      contentSources: {
        "app/components/story/copy.ts": { baseline, candidate: copyChange },
      },
    }),
    [],
  );
});

test("the build-route exception requires inspected source and cannot import motion or 3D", async () => {
  const registry = await loadProtectedPaths(repoRoot);
  const manifest = JSON.parse(
    await readFile(path.join(repoRoot, "docs/plans/execution/v2/UX02-canvas-first-editor-shell.json"), "utf8"),
  );
  assert.ok(manifest.writeSet.includes("app/app/build/page.tsx"), "UX02 must own its guarded build-page change");
  const pageManifest = manifest;
  const baseline = `import BuilderApp from "@/components/builder/BuilderApp"; export default function Page(){ return <main className="shell"><BuilderApp /></main>; }`;
  const safe = `import BuilderApp from "@/components/builder/BuilderApp"; export default function Page(){ return <main className="shell builder-page--compact"><BuilderApp /></main>; }`;
  const unsafe = `import BuilderApp from "@/components/builder/BuilderApp"; import { motion } from "motion/react"; export default function Page(){ return <main className="shell builder-page--compact"><BuilderApp /></main>; }`;
  const dynamicUnsafe = `import BuilderApp from "@/components/builder/BuilderApp"; export default async function Page(){ const { motion } = await import("motion/react"); return <motion.main className="shell"><BuilderApp /></motion.main>; }`;
  const requireUnsafe = `import BuilderApp from "@/components/builder/BuilderApp"; const THREE = require("three"); export default function Page(){ return <main className="shell"><BuilderApp /></main>; }`;
  const templateAliasUnsafe = `import BuilderApp from "@/components/builder/BuilderApp"; export default async function Page(){ const { motion: m } = await import(\`motion/react\`); return <m.main className="shell"><BuilderApp /></m.main>; }`;
  const templateRequireUnsafe = `import BuilderApp from "@/components/builder/BuilderApp"; const THREE = require(\`three\`); export default function Page(){ return <main className="shell"><BuilderApp /></main>; }`;

  assert.deepEqual(validateBuilderPageChanges(baseline, safe), []);
  assert.match(validateBuilderPageChanges(baseline, unsafe).join("\n"), /cannot import motion/);
  assert.match(validateBuilderPageChanges(baseline, dynamicUnsafe).join("\n"), /cannot import motion|cannot render motion/);
  assert.match(validateBuilderPageChanges(baseline, requireUnsafe).join("\n"), /cannot import motion/);
  assert.match(validateBuilderPageChanges(baseline, templateAliasUnsafe).join("\n"), /cannot import motion|dynamic import|component tags/);
  assert.match(validateBuilderPageChanges(baseline, templateRequireUnsafe).join("\n"), /cannot import motion|dynamic import/);
  assert.match(
    validateCandidatePaths(["app/app/build/page.tsx"], pageManifest, registry, {
      contentGates: { "app/app/build/page.tsx": "builder-page-functional-only" },
    }).join("\n"),
    /requires baseline and candidate source/,
  );
  assert.deepEqual(
    validateCandidatePaths(["app/app/build/page.tsx"], pageManifest, registry, {
      contentSources: { "app/app/build/page.tsx": { baseline, candidate: safe } },
    }),
    [],
  );
});

test("the Canvas-first CSS exception changes only builder-scoped selectors", () => {
  const baseline = `
    :root { --ink: #151512; }
    body { margin: 0; }
    .builder-stage { display: grid; }
    @media (max-width: 48rem) { .builder-stage { display: block; } }
  `;
  const allowed = `
    :root { --ink: #151512; }
    body { margin: 0; }
    .builder-stage { display: flex; }
    .guided-step-nav { overflow-x: auto; }
    @media (max-width: 48rem) { .builder-stage { display: grid; } }
  `;
  const globalRestyle = allowed.replace("body { margin: 0; }", "body { margin: 1rem; }");
  const mixedSelector = allowed.replace(
    ".guided-step-nav { overflow-x: auto; }",
    ".guided-step-nav, body { overflow-x: auto; }",
  );

  assert.deepEqual(validateBuilderCssChanges(baseline, allowed), []);
  assert.match(validateBuilderCssChanges(baseline, globalRestyle).join("\n"), /body/);
  assert.match(validateBuilderCssChanges(baseline, mixedSelector).join("\n"), /body/);
});
