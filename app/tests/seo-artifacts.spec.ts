import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "playwright/test";

/* Why this file exists.

   docs/SEO.md §5.5 and §5.6 specify robots.txt and sitemap.xml exactly, down to
   the comment lines and the decision not to ship <priority>. Neither file
   existed. Both returned 404 on the live site for as long as anyone had
   checked, while the document described their contents in confident detail —
   a spec with no gate behind it, which is the same shape as every other defect
   this suite has caught.

   The sitemap the document specifies lists SEVEN urls. The export now emits
   twenty-two. So the interesting assertion is not "does the file match the
   document" — it is "does the file match the SITE", in both directions. A page
   that ships and is not listed is invisible; a page listed and not shipped is a
   404 handed to a crawler. */

const appRoot = path.resolve(__dirname, "..");
const publicRoot = path.join(appRoot, "public");
const exportRoot = path.join(appRoot, "out");

const HOST = "https://aurahomes.fun";

/* A page's own robots meta, as a crawler reads it. The first version of this
   feature excluded a hand-kept set of one route, and Audit #11 found three
   noindex pages in the shipped sitemap the next morning — the build was handing
   crawlers pages the same build told them to ignore. The rule is derived from
   the export now, and this pattern is the whole rule. */
const DECLARES_NOINDEX = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i;

const robotsPath = path.join(publicRoot, "robots.txt");
const sitemapPath = path.join(publicRoot, "sitemap.xml");

/** Every capture of a /g pattern. `matchAll` needs --downlevelIteration at this
 *  tsconfig target, and a gate is not worth a compiler flag — the same reason
 *  gate-coverage.spec.ts and buildingGraph.ts both walk with a loop. */
function captures(source: string, pattern: RegExp): string[] {
  const found: string[] = [];
  pattern.lastIndex = 0;
  for (let hit = pattern.exec(source); hit !== null; hit = pattern.exec(source)) {
    found.push(hit[1]);
  }
  pattern.lastIndex = 0;
  return found;
}

test("robots.txt ships, and blocks nobody", () => {
  expect(existsSync(robotsPath), "app/public/robots.txt does not exist").toBe(true);
  const robots = readFileSync(robotsPath, "utf8");

  expect(robots).toContain("User-agent: *");
  expect(robots).toContain("Allow: /");
  expect(robots).toContain(`Sitemap: ${HOST}/sitemap.xml`);

  /* The open-crawler decision is deliberate and recorded in SEO.md: being read
     by AI systems is a distribution channel for an MIT-licensed product. This
     asserts nobody has quietly added a Disallow — which is the edit somebody
     makes in good faith, believing they are protecting something. */
  expect(
    robots.split("\n").filter((line) => /^\s*Disallow:\s*\S/i.test(line)),
    "robots.txt disallows something. Aura is open by design; if this changed on purpose, change SEO.md §5.5 first.",
  ).toEqual([]);
});

test("the sitemap lists every page that ships, and nothing that does not", () => {
  expect(existsSync(sitemapPath), "app/public/sitemap.xml does not exist").toBe(true);
  const sitemap = readFileSync(sitemapPath, "utf8");

  const locs = captures(sitemap, /<loc>([^<]+)<\/loc>/g);
  const listed = locs.map((loc) => loc.replace(HOST, "")).sort();
  expect(listed.length, "the sitemap lists no urls").toBeGreaterThan(5);

  /* Every url is absolute, on the canonical host, with a trailing slash — the
     export is directory-style, so a url without one redirects. */
  for (const loc of locs) {
    expect(loc.startsWith(`${HOST}/`), `${loc} is not on the canonical host`).toBe(true);
    expect(loc.endsWith("/"), `${loc} has no trailing slash`).toBe(true);
  }

  /* Google ignores both, and shipping ignored fields is the small version of
     dishonesty this repo avoids. SEO.md says so; this holds it to it. */
  expect(sitemap).not.toContain("<priority>");
  expect(sitemap).not.toContain("<changefreq>");

  /* THE PART THAT KEEPS IT TRUE. Compared against the real export when one is
     present. Skipped with a loud reason rather than silently when it is not —
     an assertion that quietly evaporates is how walkthrough.spec.ts ran eight
     assertions and executed none of them. */
  if (!existsSync(exportRoot)) {
    console.log(
      "NOTE: out/ is absent, so the sitemap was checked for SHAPE only, not for coverage. Run `GH_PAGES=1 npm run build` to make this assertion meaningful.",
    );
    return;
  }

  const shipped: { route: string; noindex: boolean }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") {
        const rel = path.relative(exportRoot, dir).split(path.sep).filter(Boolean).join("/");
        shipped.push({
          route: rel ? `/${rel}/` : "/",
          noindex: DECLARES_NOINDEX.test(readFileSync(full, "utf8")),
        });
      }
    }
  };
  walk(exportRoot);

  const indexable = shipped.filter((page) => !page.noindex).map((page) => page.route).sort();
  const noindexed = shipped.filter((page) => page.noindex).map((page) => page.route).sort();

  expect(
    indexable.filter((route) => !listed.includes(route)),
    "these pages ship but are not in the sitemap, so a crawler will not find them",
  ).toEqual([]);
  expect(
    listed.filter((route) => !indexable.includes(route)),
    "the sitemap lists urls that do not ship — that is a 404 handed to a crawler",
  ).toEqual([]);

  /* THE THIRD DIRECTION, and the one this feature shipped without. A page can
     exist, be listed, and still not belong: /concierge/, /labs/xlayer-proof/
     and /operator/registry/ all declare noindex in their own HTML and all three
     were in the first sitemap we published. Listing a page the same build tells
     a crawler to ignore is not a small inconsistency — it is the build
     disagreeing with itself, in public, in a file whose only reader is a
     machine that will believe one of the two. */
  expect(
    noindexed.filter((route) => listed.includes(route)),
    "the sitemap lists pages whose own HTML says noindex — the build is telling a crawler two different things",
  ).toEqual([]);

  /* And the detector has to be discriminating, or the assertion above passes by
     finding nothing. This build genuinely has noindex routes; if it ever has
     none, that is a change worth noticing rather than passing silently. */
  expect(
    noindexed.length,
    "no exported page declares noindex, so the check above proved nothing. If that is a real change, update this expectation deliberately.",
  ).toBeGreaterThan(0);
});

test("the sitemap's lastmod is a real date, not a placeholder", () => {
  const sitemap = readFileSync(sitemapPath, "utf8");
  const dates = captures(sitemap, /<lastmod>([^<]+)<\/lastmod>/g);
  expect(dates.length, "no lastmod at all").toBeGreaterThan(0);

  for (const date of dates) {
    expect(date, `${date} is not an ISO date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const when = Date.parse(date);
    expect(Number.isNaN(when), `${date} does not parse`).toBe(false);
    /* Not in the future, and not before the project existed. Both bounds catch
       the same failure: a date typed rather than taken from a clock. */
    expect(when, `${date} is in the future`).toBeLessThanOrEqual(Date.now() + 86_400_000);
    expect(when, `${date} predates the repository`).toBeGreaterThan(Date.parse("2026-01-01"));
  }
});
