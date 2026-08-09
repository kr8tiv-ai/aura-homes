/** @type {import('next').NextConfig} */
// GH_PAGES=1 builds the static export. The site lives at the custom domain
// https://aurahomes.fun, which GitHub Pages serves at the ROOT — so no
// basePath by default. Self-hosting under a subpath instead? Opt in with
// BASE_PATH=/your-subpath (no trailing slash) at build time.
const ghPages = process.env.GH_PAGES === "1";
const basePath = process.env.BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
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
