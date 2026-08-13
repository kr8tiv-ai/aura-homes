#!/usr/bin/env node

import { access, copyFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length;) {
    const flag = rest[index];
    if (!flag?.startsWith("--")) {
      throw new Error(`Invalid argument near ${flag ?? "end of command"}`);
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) {
      options[flag.slice(2)] = true;
      index += 1;
    } else {
      options[flag.slice(2)] = value;
      index += 2;
    }
  }
  return { command, options };
}

async function copyAssetsOnly(source, destination, relative = "") {
  const entries = await readdir(path.join(source, relative), { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      await copyAssetsOnly(source, destination, child);
      continue;
    }
    if (path.extname(entry.name).toLowerCase() === ".html") continue;
    if (relative === "" && (entry.name === "CNAME" || entry.name === ".nojekyll")) continue;
    const target = path.join(destination, child);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(source, child), target);
  }
}

async function copyHtmlOnly(source, destination) {
  for (const relative of await listHtmlFiles(source)) {
    const target = path.join(destination, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(source, relative), target);
  }
}

const ASSET_EXTENSION = /\.(?:avif|bin|css|gif|glb|gltf|ico|jpe?g|js|json|mjs|mp3|mp4|otf|pdf|png|svg|ttf|wav|webm|webp|woff2?)$/i;

async function listHtmlFiles(root, relative = "", files = []) {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) await listHtmlFiles(root, child, files);
    else if (entry.name.toLowerCase().endsWith(".html")) files.push(child);
  }
  return files;
}

async function listAssetFiles(root, relative = "", files = []) {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (relative === "" && entry.name === ".aura-release-manifests") continue;
      await listAssetFiles(root, child, files);
    } else if (!entry.name.toLowerCase().endsWith(".html") && child !== "CNAME" && child !== ".nojekyll") {
      files.push(child.replaceAll("\\", "/"));
    }
  }
  return files;
}

function localAssetPath(reference, htmlPath) {
  const trimmed = reference.trim();
  if (!trimmed || /^(?:data:|blob:|mailto:|tel:|javascript:|#|https?:|\/\/)/i.test(trimmed)) {
    return null;
  }
  const base = `https://aura.invalid/${htmlPath.replaceAll("\\", "/").replace(/index\.html$/i, "")}`;
  const pathname = decodeURIComponent(new URL(trimmed, base).pathname).replace(/^\/+/, "");
  if (!pathname.startsWith("_next/") && !ASSET_EXTENSION.test(pathname)) return null;
  return pathname;
}

function extractHtmlAssetPaths(html, htmlPath) {
  const references = [];
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    references.push(match[1]);
  }
  for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(",")) references.push(candidate.trim().split(/\s+/)[0]);
  }
  for (const match of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    references.push(match[1]);
  }
  return [...new Set(references.map((item) => localAssetPath(item, htmlPath)).filter(Boolean))];
}

async function collectHtmlAssetPaths(htmlRoot) {
  const assets = new Set();
  for (const htmlPath of await listHtmlFiles(htmlRoot)) {
    const html = await readFile(path.join(htmlRoot, htmlPath), "utf8");
    for (const assetPath of extractHtmlAssetPaths(html, htmlPath)) assets.add(assetPath);
  }
  return [...assets].sort();
}

function requireReleaseId(value) {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(value ?? "")) {
    throw new Error("--release-id must contain only letters, digits, dots, underscores, or hyphens");
  }
  return value;
}

async function writeReleaseManifest(siteRoot, manifest) {
  const root = path.join(siteRoot, ".aura-release-manifests");
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, `${manifest.releaseId}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function archiveReleaseReferences(exportRoot, siteRoot, releaseId, now) {
  const manifestRoot = path.join(siteRoot, ".aura-release-manifests");
  await mkdir(manifestRoot, { recursive: true });
  const existing = (await readdir(manifestRoot)).filter((name) => name.endsWith(".json"));
  if (existing.length === 0 && (await listHtmlFiles(siteRoot)).length > 0) {
    await writeReleaseManifest(siteRoot, {
      releaseId: `legacy-before-${releaseId}`,
      createdAt: now,
      phase: "published",
      assets: await listAssetFiles(siteRoot),
      htmlAssets: await collectHtmlAssetPaths(siteRoot),
    });
  }
  await writeReleaseManifest(siteRoot, {
    releaseId,
    createdAt: now,
    phase: "assets-staged",
    assets: await listAssetFiles(exportRoot),
    htmlAssets: await collectHtmlAssetPaths(exportRoot),
  });
}

async function preserveDomainFiles(exportRoot, siteRoot) {
  const siteCname = path.join(siteRoot, "CNAME");
  try {
    await access(siteCname);
  } catch {
    try {
      await copyFile(path.join(exportRoot, "CNAME"), siteCname);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  await writeFile(path.join(siteRoot, ".nojekyll"), "", { flag: "a" });
}

async function markReleasePublished(siteRoot, releaseId, now) {
  const manifestPath = path.join(siteRoot, ".aura-release-manifests", `${releaseId}.json`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.releaseId !== releaseId) throw new Error(`Release manifest mismatch for ${releaseId}`);
  await writeReleaseManifest(siteRoot, {
    ...manifest,
    phase: "published",
    publishedAt: now,
  });
}

async function readReleaseManifests(siteRoot) {
  const root = path.join(siteRoot, ".aura-release-manifests");
  const names = (await readdir(root)).filter((name) => name.endsWith(".json"));
  return Promise.all(
    names.map(async (name) => {
      const manifest = JSON.parse(await readFile(path.join(root, name), "utf8"));
      if (
        typeof manifest.releaseId !== "string" ||
        !Array.isArray(manifest.assets) ||
        !Array.isArray(manifest.htmlAssets)
      ) {
        throw new Error(`Invalid release manifest: ${name}`);
      }
      return manifest;
    }),
  );
}

function safeSiteAssetPath(siteRoot, relative) {
  if (typeof relative !== "string" || relative.includes("\\") || relative.startsWith("/") || relative.split("/").includes("..")) {
    throw new Error(`Unsafe release asset path: ${String(relative)}`);
  }
  const target = path.resolve(siteRoot, ...relative.split("/"));
  const rootPrefix = `${path.resolve(siteRoot)}${path.sep}`;
  if (!target.startsWith(rootPrefix)) throw new Error(`Release asset escaped site root: ${relative}`);
  return target;
}

async function requireAssets(siteRoot, assetPaths, label) {
  const missing = [];
  for (const assetPath of assetPaths) {
    try {
      await access(safeSiteAssetPath(siteRoot, assetPath));
    } catch {
      missing.push(assetPath);
    }
  }
  if (missing.length) throw new Error(`${label} references missing retained assets:\n${missing.join("\n")}`);
}

function selectRetainedManifests(manifests, now) {
  const ordered = [...manifests].sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt ?? left.createdAt);
    const rightTime = Date.parse(right.publishedAt ?? right.createdAt);
    return leftTime - rightTime;
  });
  const newestFive = new Set(ordered.slice(-5).map((manifest) => manifest.releaseId));
  const cutoff = now.valueOf() - 30 * 24 * 60 * 60 * 1000;
  return ordered.filter((manifest) => {
    const timestamp = Date.parse(manifest.publishedAt ?? manifest.createdAt);
    return manifest.phase === "assets-staged" || newestFive.has(manifest.releaseId) || !Number.isFinite(timestamp) || timestamp >= cutoff;
  });
}

async function verifyRetainedReleaseAssets(siteRoot, now) {
  const manifests = (await readReleaseManifests(siteRoot)).filter((manifest) => !manifest.prunedAt);
  const retained = selectRetainedManifests(manifests, now);
  const htmlAssets = new Set(retained.flatMap((manifest) => manifest.htmlAssets));
  await requireAssets(siteRoot, htmlAssets, "Retained release HTML");
}

async function pruneAssets(options) {
  if (!options.site) throw new Error("prune-assets requires --site");
  const siteRoot = path.resolve(options.site);
  const now = new Date(options.now ?? Date.now());
  if (Number.isNaN(now.valueOf())) throw new Error("--now must be a valid date");
  const manifests = (await readReleaseManifests(siteRoot)).filter((manifest) => !manifest.prunedAt);
  const ordered = [...manifests].sort((left, right) => Date.parse(left.publishedAt ?? left.createdAt) - Date.parse(right.publishedAt ?? right.createdAt));
  const retained = selectRetainedManifests(ordered, now);
  const retainedIds = new Set(retained.map((manifest) => manifest.releaseId));
  const expired = ordered.filter((manifest) => !retainedIds.has(manifest.releaseId));
  const currentHtmlAssets = await collectHtmlAssetPaths(siteRoot);
  const protectedAssets = new Set(currentHtmlAssets);
  for (const manifest of retained) {
    for (const asset of [...manifest.assets, ...manifest.htmlAssets]) protectedAssets.add(asset);
  }
  await requireAssets(siteRoot, protectedAssets, "Current and retained HTML");

  const candidates = new Set();
  for (const manifest of expired) {
    for (const asset of manifest.assets) {
      if (asset.startsWith("_next/static/") && !protectedAssets.has(asset)) candidates.add(asset);
    }
  }
  const deleted = [];
  if (options.apply === true) {
    for (const asset of [...candidates].sort()) {
      try {
        await unlink(safeSiteAssetPath(siteRoot, asset));
        deleted.push(asset);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    for (const manifest of expired) {
      await writeReleaseManifest(siteRoot, { ...manifest, prunedAt: now.toISOString() });
    }
  }
  process.stdout.write(`${JSON.stringify({ retained: retained.map((item) => item.releaseId), expired: expired.map((item) => item.releaseId), candidates: [...candidates].sort(), deleted })}\n`);
}

async function verifyHtmlAssets(htmlRoot, assetRoot) {
  const missing = [];
  for (const htmlPath of await listHtmlFiles(htmlRoot)) {
    const html = await readFile(path.join(htmlRoot, htmlPath), "utf8");
    for (const assetPath of extractHtmlAssetPaths(html, htmlPath)) {
      try {
        await access(path.join(assetRoot, ...assetPath.split("/")));
      } catch {
        missing.push(`${htmlPath.replaceAll("\\", "/")} -> /${assetPath}`);
      }
    }
  }
  if (missing.length) {
    throw new Error(`Missing emitted HTML assets:\n${missing.join("\n")}`);
  }
}

async function stageAssets(options) {
  if (!options.export || !options.site || !options["release-id"]) {
    throw new Error("stage-assets requires --export, --site, and --release-id");
  }
  const releaseId = requireReleaseId(options["release-id"]);
  const now = new Date(options.now ?? Date.now()).toISOString();
  await mkdir(options.site, { recursive: true });
  await copyAssetsOnly(path.resolve(options.export), path.resolve(options.site));
  await preserveDomainFiles(path.resolve(options.export), path.resolve(options.site));
  await verifyHtmlAssets(path.resolve(options.site), path.resolve(options.site));
  await verifyHtmlAssets(path.resolve(options.export), path.resolve(options.site));
  await archiveReleaseReferences(
    path.resolve(options.export),
    path.resolve(options.site),
    releaseId,
    now,
  );
  await verifyRetainedReleaseAssets(path.resolve(options.site), new Date(now));
}

async function publishHtml(options) {
  if (!options.export || !options.site || !options["release-id"]) {
    throw new Error("publish-html requires --export, --site, and --release-id");
  }
  const releaseId = requireReleaseId(options["release-id"]);
  const now = new Date(options.now ?? Date.now()).toISOString();
  const exportRoot = path.resolve(options.export);
  const siteRoot = path.resolve(options.site);
  await verifyHtmlAssets(siteRoot, siteRoot);
  await verifyHtmlAssets(exportRoot, siteRoot);
  await verifyRetainedReleaseAssets(siteRoot, new Date(now));
  await copyHtmlOnly(exportRoot, siteRoot);
  await preserveDomainFiles(exportRoot, siteRoot);
  await verifyHtmlAssets(siteRoot, siteRoot);
  await verifyRetainedReleaseAssets(siteRoot, new Date(now));
  await markReleasePublished(siteRoot, releaseId, now);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "stage-assets") {
    await stageAssets(options);
    return;
  }
  if (command === "publish-html") {
    await publishHtml(options);
    return;
  }
  if (command === "prune-assets") {
    await pruneAssets(options);
    return;
  }
  throw new Error(`Unknown command: ${command ?? "(missing)"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
