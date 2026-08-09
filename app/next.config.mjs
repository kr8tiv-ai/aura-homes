/** @type {import('next').NextConfig} */
// GH_PAGES=1 builds the static export served at kr8tiv-ai.github.io/aura-homes.
const ghPages = process.env.GH_PAGES === "1";

const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_BASE_PATH: ghPages ? "/aura-homes" : "" },
  ...(ghPages
    ? {
        output: "export",
        basePath: "/aura-homes",
        assetPrefix: "/aura-homes/",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
