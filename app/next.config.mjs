import { execFileSync } from "node:child_process";

/** @type {import('next').NextConfig} */
// GH_PAGES=1 builds the static export. The site lives at the custom domain
// https://aurahomes.fun, which GitHub Pages serves at the ROOT — so no
// basePath by default. Self-hosting under a subpath instead? Opt in with
// BASE_PATH=/your-subpath (no trailing slash) at build time.
const ghPages = process.env.GH_PAGES === "1";
const basePath = process.env.BASE_PATH || "";

function resolveDeploymentId() {
  if (process.env.AURA_RELEASE_ID) return process.env.AURA_RELEASE_ID;
  if (!ghPages) return "development";
  try {
    return execFileSync("git", ["rev-parse", "--verify", "HEAD"], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error("GH_PAGES builds require AURA_RELEASE_ID when the Git commit is unavailable");
  }
}

const deploymentId = resolveDeploymentId();

const nextConfig = {
  reactStrictMode: true,
  // The concierge pages import the agent's reducer/catalog/pipeline directly
  // from ../agent/src (ONE source of truth — never a hand-mirrored copy), plus
  // ../data and ../agent/samples. externalDir lets SWC compile those files.
  experimental: { externalDir: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_DEPLOYMENT_ID: deploymentId,
  },
  ...(ghPages
    ? {
        output: "export",
        generateBuildId: async () => deploymentId,
        ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

// PB03: the treemap analyzer is a build-time diagnostic, not a runtime
// dependency. Resolving it unconditionally would make EVERY ordinary build —
// local, CI, and the GH_PAGES static export — hard-fail whenever
// devDependencies are absent or not yet installed, which is a steep price for
// a tool that runs a few times a year. Gating the import behind the same flag
// that enables it keeps the default path from ever touching the package.
const withBundleAnalyzer =
  process.env.ANALYZE === "1"
    ? (await import("@next/bundle-analyzer")).default({ enabled: true })
    : (config) => config;

export default withBundleAnalyzer(nextConfig);
