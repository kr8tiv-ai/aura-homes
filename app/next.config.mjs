/** @type {import('next').NextConfig} */
// GH_PAGES=1 builds the static export. The site lives at the custom domain
// https://aurahomes.fun, which GitHub Pages serves at the ROOT — so no
// basePath by default. Self-hosting under a subpath instead? Opt in with
// BASE_PATH=/your-subpath (no trailing slash) at build time.
const ghPages = process.env.GH_PAGES === "1";
const basePath = process.env.BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  // The concierge pages import the agent's reducer/catalog/pipeline directly
  // from ../agent/src (ONE source of truth — never a hand-mirrored copy), plus
  // ../data and ../agent/samples. externalDir lets SWC compile those files.
  experimental: { externalDir: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(ghPages
    ? {
        output: "export",
        ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
