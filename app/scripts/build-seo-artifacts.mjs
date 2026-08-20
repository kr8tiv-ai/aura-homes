/* ===========================================================================
   robots.txt and sitemap.xml, generated from the routes that actually ship.

   WHY GENERATED. docs/SEO.md §5.5 and §5.6 specify both files exactly, and
   neither existed — both returned 404 on the live site while the document
   described their contents in detail. The sitemap it specifies lists SEVEN
   urls, written when the site had seven pages; the export now emits twenty-two.
   Pasting the documented list would have satisfied the letter of the spec and
   published a sitemap that omits two thirds of the site.

   So the route list is read from `out/`, which is the thing that actually gets
   deployed. A page cannot be in the sitemap unless it shipped, and cannot ship
   without appearing in the sitemap, because `seo-artifacts.spec.ts` compares
   the two and fails on either direction.

   ON lastmod. SEO.md is right that "a truthful lastmod is a freshness signal;
   a fake one is noise", so this stamps the date the artifacts were generated —
   which is a real event tied to a real deploy — rather than a per-page date
   this repo does not track. One honest date beats twenty-two invented ones.

   ON /404/. Excluded. A sitemap is a list of pages worth indexing.
   =========================================================================== */

import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const exportRoot = join(appRoot, "out");
const publicRoot = join(appRoot, "public");

const HOST = "https://aurahomes.fun";
const NOT_INDEXED = new Set(["/404/"]);

if (!existsSync(exportRoot)) {
  console.error(
    "out/ does not exist. Run `GH_PAGES=1 npm run build` first — this reads the routes that actually ship rather than guessing them from source.",
  );
  process.exit(1);
}

/** Every directory under out/ holding an index.html, as a trailing-slash route. */
async function routesFrom(dir, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await routesFrom(full, acc);
    else if (entry.name === "index.html") {
      const rel = relative(exportRoot, dir).split(sep).filter(Boolean).join("/");
      acc.push(rel ? `/${rel}/` : "/");
    }
  }
  return acc;
}

const all = (await routesFrom(exportRoot)).sort();
const routes = all.filter((route) => !NOT_INDEXED.has(route));
const lastmod = new Date().toISOString().slice(0, 10);

/* robots.txt — verbatim from docs/SEO.md §5.5. Nothing is blocked, including
   GPTBot, ClaudeBot, PerplexityBot and Google-Extended: being read by AI
   systems is a distribution channel for an MIT-licensed product, not a leak.
   That is a recorded decision, so it is repeated here where somebody editing
   this file will see it before "fixing" it. */
const robots = `# aurahomes.fun — open by design.
# The whole product is open source; AI crawlers are welcome to all of it.
# Repo: https://github.com/kr8tiv-ai/aura-homes

User-agent: *
Allow: /

Sitemap: ${HOST}/sitemap.xml
`;

/* No <priority> or <changefreq>: Google ignores both, and shipping ignored
   fields is the small version of dishonesty this repo avoids (SEO.md §5.6). */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url><loc>${HOST}${route}</loc><lastmod>${lastmod}</lastmod></url>`).join("\n")}
</urlset>
`;

await mkdir(publicRoot, { recursive: true });
await writeFile(join(publicRoot, "robots.txt"), robots);
await writeFile(join(publicRoot, "sitemap.xml"), sitemap);

console.log(
  JSON.stringify(
    { routesInExport: all.length, inSitemap: routes.length, excluded: [...NOT_INDEXED], lastmod },
    null,
    2,
  ),
);
