import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";

const SCRIPT = path.resolve("scripts/static-release.mjs");

async function put(root, relativePath, contents = "fixture") {
  const target = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

function runRelease(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: path.resolve("."),
    encoding: "utf8",
  });
}

test("stage-assets keeps the currently published HTML and its hashed chunks while adding the next release", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-"));
  const site = path.join(root, "site");
  const next = path.join(root, "next");
  const oldHtml = '<script src="/_next/static/chunks/webpack-3f4369b117f6848f.js"></script>';
  const nextHtml = '<script src="/_next/static/chunks/webpack-41ab6faf6d6783f1.js"></script>';

  await put(site, "build/index.html", oldHtml);
  await put(site, "_next/static/chunks/webpack-3f4369b117f6848f.js", "old runtime");
  await put(site, "CNAME", "aurahomes.fun\n");
  await put(site, ".nojekyll", "");
  await put(next, "build/index.html", nextHtml);
  await put(next, "_next/static/chunks/webpack-41ab6faf6d6783f1.js", "next runtime");
  await put(next, "CNAME", "wrong.example\n");

  const result = runRelease([
    "stage-assets",
    "--export",
    next,
    "--site",
    site,
    "--release-id",
    "5bc9a64-test",
    "--now",
    "2026-08-13T12:00:00.000Z",
  ]);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(await readFile(path.join(site, "build/index.html"), "utf8"), oldHtml);
  assert.equal(
    await readFile(path.join(site, "_next/static/chunks/webpack-3f4369b117f6848f.js"), "utf8"),
    "old runtime",
  );
  assert.equal(
    await readFile(path.join(site, "_next/static/chunks/webpack-41ab6faf6d6783f1.js"), "utf8"),
    "next runtime",
  );
  assert.equal(await readFile(path.join(site, "CNAME"), "utf8"), "aurahomes.fun\n");
  assert.equal(await readFile(path.join(site, ".nojekyll"), "utf8"), "");
});

test("stage-assets rejects an emitted HTML file whose hashed asset is absent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-missing-"));
  const site = path.join(root, "site");
  const next = path.join(root, "next");
  const oldHtml = '<script src="/_next/static/chunks/old-ok.js"></script>';

  await put(site, "index.html", oldHtml);
  await put(site, "_next/static/chunks/old-ok.js", "old runtime");
  await put(next, "index.html", '<script src="/_next/static/chunks/missing-next.js"></script>');

  const result = runRelease([
    "stage-assets",
    "--export",
    next,
    "--site",
    site,
    "--release-id",
    "missing-test",
    "--now",
    "2026-08-13T12:00:00.000Z",
  ]);

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /missing-next\.js/);
  assert.equal(await readFile(path.join(site, "index.html"), "utf8"), oldHtml);
});

test("publish-html overlays the next HTML only after old and new assets are compatible", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-publish-"));
  const site = path.join(root, "site");
  const next = path.join(root, "next");
  const oldHtml = '<script src="/_next/static/chunks/old.js"></script>';
  const nextHtml = '<script src="/_next/static/chunks/next.js"></script>';

  await put(site, "build/index.html", oldHtml);
  await put(site, "_next/static/chunks/old.js", "old runtime");
  await put(site, "CNAME", "aurahomes.fun\n");
  await put(next, "build/index.html", nextHtml);
  await put(next, "_next/static/chunks/next.js", "next runtime");
  await put(next, "CNAME", "replacement.example\n");

  const common = [
    "--export",
    next,
    "--site",
    site,
    "--release-id",
    "publish-test",
    "--now",
    "2026-08-13T12:00:00.000Z",
  ];
  const stage = runRelease(["stage-assets", ...common]);
  assert.equal(stage.status, 0, `${stage.stdout}\n${stage.stderr}`);
  const publish = runRelease(["publish-html", ...common]);

  assert.equal(publish.status, 0, `${publish.stdout}\n${publish.stderr}`);
  assert.equal(await readFile(path.join(site, "build/index.html"), "utf8"), nextHtml);
  assert.equal(await readFile(path.join(site, "CNAME"), "utf8"), "aurahomes.fun\n");
  assert.equal(await readFile(path.join(site, ".nojekyll"), "utf8"), "");
  assert.equal(await readFile(path.join(site, "_next/static/chunks/old.js"), "utf8"), "old runtime");
  const manifest = JSON.parse(
    await readFile(path.join(site, ".aura-release-manifests", "publish-test.json"), "utf8"),
  );
  assert.equal(manifest.phase, "published");
  assert.equal(manifest.publishedAt, "2026-08-13T12:00:00.000Z");
});

test("stage-assets archives current and next HTML asset references in release manifests", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-manifest-"));
  const site = path.join(root, "site");
  const next = path.join(root, "next");
  await put(site, "index.html", '<script src="/_next/static/chunks/old.js"></script>');
  await put(site, "_next/static/chunks/old.js", "old");
  await put(next, "index.html", '<script src="/_next/static/chunks/next.js"></script>');
  await put(next, "_next/static/chunks/next.js", "next");

  const result = runRelease([
    "stage-assets",
    "--export",
    next,
    "--site",
    site,
    "--release-id",
    "manifest-test",
    "--now",
    "2026-08-13T12:00:00.000Z",
  ]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const manifestRoot = path.join(site, ".aura-release-manifests");
  const names = await readdir(manifestRoot);
  assert.equal(names.length, 2);
  const nextManifest = JSON.parse(await readFile(path.join(manifestRoot, "manifest-test.json"), "utf8"));
  assert.equal(nextManifest.releaseId, "manifest-test");
  assert.equal(nextManifest.phase, "assets-staged");
  assert.deepEqual(nextManifest.htmlAssets, ["_next/static/chunks/next.js"]);
  const legacyName = names.find((name) => name !== "manifest-test.json");
  const legacyManifest = JSON.parse(await readFile(path.join(manifestRoot, legacyName), "utf8"));
  assert.deepEqual(legacyManifest.htmlAssets, ["_next/static/chunks/old.js"]);
});

test("prune-assets deletes only expired unreferenced hashed assets and always retains the latest five releases", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-prune-"));
  const site = path.join(root, "site");
  const manifestRoot = path.join(site, ".aura-release-manifests");
  for (let index = 1; index <= 7; index += 1) {
    const asset = `_next/static/chunks/release-${index}.hash.js`;
    await put(site, asset, `release ${index}`);
    await put(
      site,
      `.aura-release-manifests/r${index}.json`,
      `${JSON.stringify({
        releaseId: `r${index}`,
        createdAt: `2026-01-0${index}T00:00:00.000Z`,
        publishedAt: `2026-01-0${index}T00:00:00.000Z`,
        phase: "published",
        assets: [asset],
        htmlAssets: [asset],
      })}\n`,
    );
  }
  await put(site, "models/old.glb", "not a hashed Next asset");
  const r1Path = path.join(site, "_next/static/chunks/release-1.hash.js");
  const r2Path = path.join(site, "_next/static/chunks/release-2.hash.js");
  await put(site, "index.html", '<script src="/_next/static/chunks/release-7.hash.js"></script>');

  const result = runRelease([
    "prune-assets",
    "--site",
    site,
    "--now",
    "2026-03-01T00:00:00.000Z",
    "--apply",
  ]);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  await assert.rejects(readFile(r1Path, "utf8"), /ENOENT/);
  await assert.rejects(readFile(r2Path, "utf8"), /ENOENT/);
  for (let index = 3; index <= 7; index += 1) {
    assert.equal(
      await readFile(path.join(site, `_next/static/chunks/release-${index}.hash.js`), "utf8"),
      `release ${index}`,
    );
  }
  assert.equal(await readFile(path.join(site, "models/old.glb"), "utf8"), "not a hashed Next asset");
  const prunedManifest = JSON.parse(await readFile(path.join(manifestRoot, "r1.json"), "utf8"));
  assert.equal(prunedManifest.prunedAt, "2026-03-01T00:00:00.000Z");
});

test("prune-assets retains every release published within the last 30 days even outside the latest five", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-age-"));
  const site = path.join(root, "site");
  for (let index = 1; index <= 7; index += 1) {
    const asset = `_next/static/chunks/recent-${index}.hash.js`;
    await put(site, asset, `recent ${index}`);
    await put(
      site,
      `.aura-release-manifests/recent-${index}.json`,
      `${JSON.stringify({
        releaseId: `recent-${index}`,
        createdAt: `2026-02-0${index}T00:00:00.000Z`,
        publishedAt: `2026-02-0${index}T00:00:00.000Z`,
        phase: "published",
        assets: [asset],
        htmlAssets: [asset],
      })}\n`,
    );
  }
  await put(site, "index.html", '<script src="/_next/static/chunks/recent-7.hash.js"></script>');

  const result = runRelease([
    "prune-assets",
    "--site",
    site,
    "--now",
    "2026-02-10T00:00:00.000Z",
    "--apply",
  ]);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  for (let index = 1; index <= 7; index += 1) {
    assert.equal(
      await readFile(path.join(site, `_next/static/chunks/recent-${index}.hash.js`), "utf8"),
      `recent ${index}`,
    );
  }
});

test("stage-assets refuses a release when a retained HTML manifest has lost a chunk", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-retained-"));
  const site = path.join(root, "site");
  const next = path.join(root, "next");
  await put(site, "index.html", '<script src="/_next/static/chunks/current.js"></script>');
  await put(site, "_next/static/chunks/current.js", "current");
  await put(
    site,
    ".aura-release-manifests/retained.json",
    `${JSON.stringify({
      releaseId: "retained",
      createdAt: "2026-08-12T00:00:00.000Z",
      publishedAt: "2026-08-12T00:00:00.000Z",
      phase: "published",
      assets: ["_next/static/chunks/retained-missing.js"],
      htmlAssets: ["_next/static/chunks/retained-missing.js"],
    })}\n`,
  );
  await put(next, "index.html", '<script src="/_next/static/chunks/next.js"></script>');
  await put(next, "_next/static/chunks/next.js", "next");

  const result = runRelease([
    "stage-assets",
    "--export",
    next,
    "--site",
    site,
    "--release-id",
    "next-release",
    "--now",
    "2026-08-13T00:00:00.000Z",
  ]);

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr, /retained-missing\.js/);
});

test("stage-assets initializes CNAME and .nojekyll for a fresh deployment checkout", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-domain-"));
  const site = path.join(root, "site");
  const next = path.join(root, "next");
  await put(next, "index.html", '<script src="/_next/static/chunks/next.js"></script>');
  await put(next, "_next/static/chunks/next.js", "next");
  await put(next, "CNAME", "aurahomes.fun\n");

  const result = runRelease([
    "stage-assets",
    "--export",
    next,
    "--site",
    site,
    "--release-id",
    "fresh-domain",
    "--now",
    "2026-08-13T00:00:00.000Z",
  ]);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(await readFile(path.join(site, "CNAME"), "utf8"), "aurahomes.fun\n");
  assert.equal(await readFile(path.join(site, ".nojekyll"), "utf8"), "");
});

test("the Pages build uses the supplied commit as both Next build ID and public deployment ID", async () => {
  const previousGhPages = process.env.GH_PAGES;
  const previousRelease = process.env.AURA_RELEASE_ID;
  process.env.GH_PAGES = "1";
  process.env.AURA_RELEASE_ID = "5bc9a64cafe12345";
  try {
    const configUrl = `${pathToFileURL(path.resolve("next.config.mjs")).href}?release-test=${Date.now()}`;
    const config = (await import(configUrl)).default;
    assert.equal(typeof config.generateBuildId, "function");
    assert.equal(await config.generateBuildId(), "5bc9a64cafe12345");
    assert.equal(config.env.NEXT_PUBLIC_DEPLOYMENT_ID, "5bc9a64cafe12345");
  } finally {
    if (previousGhPages === undefined) delete process.env.GH_PAGES;
    else process.env.GH_PAGES = previousGhPages;
    if (previousRelease === undefined) delete process.env.AURA_RELEASE_ID;
    else process.env.AURA_RELEASE_ID = previousRelease;
  }
});

test("the Pages build derives its deployment ID from the checked-out commit when no override is supplied", async () => {
  const previousGhPages = process.env.GH_PAGES;
  const previousRelease = process.env.AURA_RELEASE_ID;
  const expected = spawnSync("git", ["rev-parse", "--verify", "HEAD"], {
    cwd: path.resolve(".."),
    encoding: "utf8",
  }).stdout.trim();
  process.env.GH_PAGES = "1";
  delete process.env.AURA_RELEASE_ID;
  try {
    const configUrl = `${pathToFileURL(path.resolve("next.config.mjs")).href}?git-release-test=${Date.now()}`;
    const config = (await import(configUrl)).default;
    assert.equal(await config.generateBuildId(), expected);
    assert.equal(config.env.NEXT_PUBLIC_DEPLOYMENT_ID, expected);
  } finally {
    if (previousGhPages === undefined) delete process.env.GH_PAGES;
    else process.env.GH_PAGES = previousGhPages;
    if (previousRelease === undefined) delete process.env.AURA_RELEASE_ID;
    else process.env.AURA_RELEASE_ID = previousRelease;
  }
});

test("package scripts expose the tested two-phase release workflow", async () => {
  const packageJson = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["test:release"],
    "node --test scripts/static-release.test.mjs scripts/chunk-recovery.test.mjs",
  );
  assert.equal(packageJson.scripts["release:stage-assets"], "node scripts/static-release.mjs stage-assets");
  assert.equal(packageJson.scripts["release:publish-html"], "node scripts/static-release.mjs publish-html");
  assert.equal(packageJson.scripts["release:prune-assets"], "node scripts/static-release.mjs prune-assets");
});

test("publish-html leaves current HTML untouched if a retained chunk disappears after staging", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "aura-static-release-race-"));
  const site = path.join(root, "site");
  const next = path.join(root, "next");
  const currentHtml = '<script src="/_next/static/chunks/current.js"></script>';
  await put(site, "index.html", currentHtml);
  await put(site, "_next/static/chunks/current.js", "current");
  await put(site, "_next/static/chunks/retained.js", "retained");
  await put(
    site,
    ".aura-release-manifests/retained.json",
    `${JSON.stringify({
      releaseId: "retained",
      createdAt: "2026-08-12T00:00:00.000Z",
      publishedAt: "2026-08-12T00:00:00.000Z",
      phase: "published",
      assets: ["_next/static/chunks/retained.js"],
      htmlAssets: ["_next/static/chunks/retained.js"],
    })}\n`,
  );
  await put(next, "index.html", '<script src="/_next/static/chunks/next.js"></script>');
  await put(next, "_next/static/chunks/next.js", "next");
  const common = [
    "--export", next,
    "--site", site,
    "--release-id", "race-test",
    "--now", "2026-08-13T00:00:00.000Z",
  ];
  const stage = runRelease(["stage-assets", ...common]);
  assert.equal(stage.status, 0, `${stage.stdout}\n${stage.stderr}`);
  await unlink(path.join(site, "_next/static/chunks/retained.js"));

  const publish = runRelease(["publish-html", ...common]);

  assert.equal(publish.status, 1, `${publish.stdout}\n${publish.stderr}`);
  assert.match(publish.stderr, /retained\.js/);
  assert.equal(await readFile(path.join(site, "index.html"), "utf8"), currentHtml);
});
