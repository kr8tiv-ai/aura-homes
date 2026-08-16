#!/usr/bin/env node
/**
 * Bakes a per-district summary of the lot AREAS the City of Edmonton records in
 * its property assessment register into `data/land/edmonton-lot-areas.json`.
 *
 * WHAT THIS IS NOT. A property register says who owns what. It never says what
 * is being sold. This artifact carries no address, no coordinate, no account
 * number, no owner, no price and no market status of any kind, and two guards
 * below — `assertNoMarketVocabulary` and `assertNoParcelIdentity` — refuse to
 * write the file if any of that leaks in. The distinction is the whole point and
 * a note in a README cannot enforce it.
 *
 * WHY THE AGGREGATE AND NOT THE ROWS. `dkk9-cj3x` publishes 439,631 Edmonton
 * properties, 282,666 of which carry a zone code and a lot area. Baking those
 * rows costs about 6.1 MB in their cheapest sharded form — roughly a third again
 * on top of the whole static export, a multi-megabyte re-commit every week the
 * City refreshes, and the republication of a quarter of a million real home
 * addresses in a public repository. They buy no additional evidenced constraint:
 * the register's `zoning` column carries BASE codes only and drops the `h` and
 * `f` modifiers, which are the one thing `edmonton-zoning-districts.json` can
 * evidence, so an address yields a district and the district still refuses the
 * ceiling. The per-code quantile summary costs about 12 KB and says something
 * true that the district register cannot: what a lot in this district tends to
 * be. `assertNoParcelIdentity` is the mechanical form of that decision — it caps
 * the artifact at 25 KB so the scope cannot be reversed by accident.
 *
 * WHY A BAKE AND NOT A RUNTIME FETCH: same discipline as
 * `app/scripts/bake-land-data.mjs`. The site is a static export with no server
 * and must work offline. `app/lib/land/propertyLookup.ts` does make one live,
 * user-initiated call for a single address, and everything on the page works
 * without it.
 *
 * WHY `zoning IS NOT NULL` IS THE FILTER: the 156,965 rows with no zone code are
 * condominium units. Their recorded area is a unit share of the parcel, not a
 * lot — one sampled row carries 3.955 m². Handing somebody a 4 m² lot is the
 * failure this filter prevents, and it is also why the filter is stated here
 * rather than left to look like a convenience.
 *
 * SOURCE BAKED (City of Edmonton Open Data Catalogue):
 *   dkk9-cj3x  Property Information (Current Calendar Year)  (weekly)
 *
 * SOURCE REFUSED, deliberately and permanently:
 *   q7d6-ambg  Property Assessment Data. It carries `assessed_value` and joins
 *              on the same key, and it is linked from this dataset's own
 *              description, which makes it the obvious next step. A dollar
 *              figure on a surface with nothing on offer reads as a price no
 *              matter what the label says. Adding it is a founder decision, not
 *              a builder decision.
 *
 * Usage:
 *   node app/scripts/bake-lot-areas.mjs            # fetch + write
 *   node app/scripts/bake-lot-areas.mjs --dry-run  # fetch + report only
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const OUT_PATH = resolve(REPO_ROOT, "data", "land", "edmonton-lot-areas.json");
const DISTRICTS_PATH = resolve(REPO_ROOT, "data", "land", "edmonton-zoning-districts.json");

const PORTAL = "https://data.edmonton.ca";
const PROPERTY_ID = "dkk9-cj3x";

/**
 * Copied verbatim from `app/scripts/bake-land-data.mjs`, which took it from the
 * City of Edmonton Open Data Terms of Use version 2.1 (January 2016). Both
 * datasets publish under the same portal licence id, re-checked on every bake by
 * `assertLicenceUnchanged`. `app/tests/land-lot-areas.spec.ts` asserts the two
 * baked artifacts still carry a byte-identical licence object, so this copy
 * cannot drift away from the one it was taken from without a test going red.
 *
 * One trap for anyone re-checking against the source PDF: it uses U+2010 HYPHEN
 * in "royalty-free" and "non-exclusive", not ASCII hyphen-minus. This constant
 * is normalised to ASCII.
 */
const LICENCE = {
  name: "City of Edmonton Open Data Terms of Use, version 2.1 (January 2016)",
  url: "https://data.edmonton.ca/stories/s/msh8-if28",
  documentUrl: "https://www.edmonton.ca/public-files/assets/document?path=Web-version2.1-OpenDataAgreement.pdf",
  grant:
    "The City of Edmonton (the City) grants you a worldwide, royalty-free, non-exclusive licence " +
    "to use, modify, and distribute the datasets in all current and future media and formats for " +
    "any lawful purpose, including for commercial purposes.",
  redistributionCondition:
    "If you distribute or provide access to the datasets to any other person, whether in original " +
    "or modified form, you agree to include a copy of, or this Uniform Resource Locator (URL) for, " +
    "these Terms of Use and to ensure any such person agrees to, and is bound by, them without " +
    "introducing any further restrictions of any kind.",
  attribution:
    "Contains information published by the City of Edmonton under the City of Edmonton Open Data " +
    "Terms of Use. The City does not endorse Aura or this use of the data.",
  /** Socrata's licence id on every baked dataset. assertLicenceUnchanged pins it. */
  portalLicenceId: "SEE_TERMS_OF_USE",
};

/**
 * The register refreshes weekly, so 120 days is about 17 missed runs: long
 * enough that a holiday gap cannot trip it, short enough that a dead pipeline is
 * caught before its areas are a season out of date.
 *
 * MEASURED AGAINST `rowsUpdatedAt`, NOT THE COVERAGE WINDOW, and that is not a
 * shortcut. This dataset's four portal dates disagree: the title says "Current
 * Calendar Year", `Period of Coverage` says the 2025 roll year, the portal's own
 * "Date Updated" custom field says March 2026, and `rowsUpdatedAt` is days old.
 * A freshness limit measured against the coverage window would fail on the day
 * it was written and would be telling the truth about nothing. The coverage
 * window is instead carried into the artifact verbatim and disclosed on screen.
 * There is also no `date_ext` column here, so `assertExtractIsFresh` from the
 * zoning bake has nothing to read and is deliberately not reused.
 */
const MAX_ROWS_AGE_DAYS = 120;

/**
 * Zone codes from the REPEALED Zoning Bylaw 12800. The Vacant Land Inventory was
 * refused for carrying these; the same tripwire now points at this source, so if
 * the City ever regresses this feed to the old bylaw the bake stops instead of
 * publishing decade-old zoning under a fresh retrieval date.
 */
const REPEALED_ZONE_CODES = ["RF1", "RF3", "RF4", "RA7", "CB2", "CNC", "AGU", "AGI"];

/** Below this share of zoned rows joining the district register, the join is broken, not imperfect. */
const MIN_JOIN_RATE = 0.95;

/**
 * The scope decision, in bytes. The aggregate is about 12 KB. Anything an order
 * of magnitude larger is somebody having started to bake rows.
 */
const MAX_ARTIFACT_BYTES = 25_000;

/**
 * Words that would turn a property register into a market claim. The refusal is
 * mechanical because the temptation is not: a reader who sees real properties
 * wants them to be purchasable, and one careless sentence is all it takes.
 */
const MARKET_VOCABULARY = ["for sale", "listing", "listed", "available", "asking price", "realtor", "mls"];

/**
 * Anything that would identify an individual property. A civic address, a legal
 * plan or lot reference, the register's account key, or a coordinate. Plus the
 * size cap, because 282,034 addresses cannot be smuggled in under 25 KB.
 */
const PARCEL_IDENTITY_PATTERNS = [
  { name: "a civic address", test: /\d{2,6}\s+(AVENUE|STREET|DRIVE|ROAD|WAY|CRESCENT)/i },
  { name: "a legal plan reference", test: /Plan:/ },
  { name: "a legal lot reference", test: /Lot:/ },
  { name: "the register's account key", test: /account_number/i },
  { name: "a coordinate", test: /latitude|longitude/i },
];

const DRY_RUN = process.argv.includes("--dry-run");

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** SoDA is public and keyless. Retries on transport failure; never on a 4xx. */
async function soda(datasetId, params, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  const url = `${PORTAL}/resource/${datasetId}.json?${new URLSearchParams(params)}`;
  try {
    const response = await fetch(url, { headers: { "User-Agent": "aura-homes bake-lot-areas" } });
    if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
    if (!response.ok) {
      throw Object.assign(new Error(`${datasetId} returned HTTP ${response.status}`), { fatal: true });
    }
    return await response.json();
  } catch (error) {
    if (error.fatal || attempt >= MAX_ATTEMPTS) throw error;
    await sleep(400 * 2 ** (attempt - 1));
    return soda(datasetId, params, attempt + 1);
  }
}

async function viewMetadata(datasetId) {
  const response = await fetch(`${PORTAL}/api/views/${datasetId}.json`, {
    headers: { "User-Agent": "aura-homes bake-lot-areas" },
  });
  if (!response.ok) throw new Error(`metadata for ${datasetId} returned HTTP ${response.status}`);
  return response.json();
}

/** A truncated result is a wrong count, not a short one. Anything at the cap stops the bake. */
function assertNotTruncated(rows, cap, what) {
  if (rows.length >= cap) {
    throw new Error(`${what} returned ${rows.length} rows at the ${cap} cap; raise the cap and re-bake.`);
  }
}

function assertLicenceUnchanged(meta, datasetId) {
  if (meta.licenseId !== LICENCE.portalLicenceId) {
    throw new Error(
      `${datasetId} now publishes under licence "${meta.licenseId}" rather than "${LICENCE.portalLicenceId}". ` +
        "Read the new terms before re-baking; the grant clause in this script may no longer be the one in force.",
    );
  }
}

function assertRowsAreFresh(rowsUpdatedAtISO, now) {
  const updated = Date.parse(rowsUpdatedAtISO);
  if (!Number.isFinite(updated)) {
    throw new Error(`the register has no readable row-update date (${rowsUpdatedAtISO}).`);
  }
  const ageDays = (now.getTime() - updated) / 86_400_000;
  if (ageDays > MAX_ROWS_AGE_DAYS) {
    throw new Error(
      `the register's rows were last updated ${Math.round(ageDays)} days ago (${rowsUpdatedAtISO}), past the ` +
        `${MAX_ROWS_AGE_DAYS}-day limit. The City's weekly refresh has stopped; do not ship stale areas under ` +
        "a fresh retrieval date.",
    );
  }
  return ageDays;
}

async function assertNoRepealedZoneCodes() {
  const rows = await soda(PROPERTY_ID, {
    $select: "zoning,count(1) as n",
    $group: "zoning",
    $where: `zoning in(${REPEALED_ZONE_CODES.map((code) => `'${code}'`).join(",")})`,
    $limit: "100",
  });
  if (rows.length > 0) {
    const found = rows.map((row) => `${row.zoning}=${row.n}`).join(", ");
    throw new Error(
      `the register now returns rows under repealed Zoning Bylaw 12800 codes (${found}). ` +
        "That is the same defect that refused svsw-2ub7. Re-read the feed before baking it.",
    );
  }
}

function assertJoinRate(joinedRows, zonedRows) {
  const rate = zonedRows === 0 ? 0 : joinedRows / zonedRows;
  if (rate < MIN_JOIN_RATE) {
    /* The counts and four decimal places, not two. A near-total join printed as
       "only 100.00%, below the 100% floor" is a refusal that explains nothing,
       and a refusal a reader cannot act on is barely better than no refusal. */
    throw new Error(
      `only ${joinedRows} of ${zonedRows} zoned rows (${(rate * 100).toFixed(4)}%) join a base code in ` +
        `edmonton-zoning-districts.json, below the ${(MIN_JOIN_RATE * 100).toFixed(4)}% floor. The two ` +
        "registers have drifted apart; re-bake the zoning districts before re-baking this.",
    );
  }
  return rate;
}

function assertNoMarketVocabulary(json) {
  const haystack = json.toLowerCase();
  for (const word of MARKET_VOCABULARY) {
    const at = haystack.indexOf(word);
    if (at >= 0) {
      throw new Error(
        `the artifact contains the market word "${word}" at offset ${at}: ` +
          `...${json.slice(Math.max(0, at - 90), at + 90).replace(/\s+/g, " ")}... ` +
          "This file is a summary of a property register. It must not read as inventory.",
      );
    }
  }
}

function assertNoParcelIdentity(json) {
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > MAX_ARTIFACT_BYTES) {
    throw new Error(
      `the artifact is ${bytes} bytes, over the ${MAX_ARTIFACT_BYTES}-byte cap. This file is a per-district ` +
        "summary. Anything this size is individual properties, which is the scope decision this cap exists to hold.",
    );
  }
  for (const pattern of PARCEL_IDENTITY_PATTERNS) {
    const hit = json.match(pattern.test);
    if (hit) {
      throw new Error(
        `the artifact contains ${pattern.name} (${JSON.stringify(hit[0])}). A property register names real ` +
          "homes people live in. This file summarises districts and must identify no individual property.",
      );
    }
  }
  return bytes;
}

/**
 * Linear-interpolated order statistic, the definition R calls type 7 and the one
 * most readers mean by "the 25th percentile". Recorded in the artifact by name
 * so a reader can reproduce the number rather than trust it.
 */
function quantile(sortedAscending, p) {
  const n = sortedAscending.length;
  if (n === 0) return null;
  if (n === 1) return sortedAscending[0];
  const at = (n - 1) * p;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  if (lo === hi) return sortedAscending[lo];
  return sortedAscending[lo] + (at - lo) * (sortedAscending[hi] - sortedAscending[lo]);
}

const round1 = (value) => Math.round(value * 10) / 10;

async function main() {
  const now = new Date();

  const meta = await viewMetadata(PROPERTY_ID);
  assertLicenceUnchanged(meta, PROPERTY_ID);

  const rowsUpdatedAtISO = new Date((meta.rowsUpdatedAt ?? 0) * 1000).toISOString();
  const rowsAgeDays = assertRowsAreFresh(rowsUpdatedAtISO, now);

  await assertNoRepealedZoneCodes();

  const [{ n: totalRows }] = await soda(PROPERTY_ID, { $select: "count(1) as n" });
  const [{ n: zonedRows }] = await soda(PROPERTY_ID, {
    $select: "count(1) as n",
    $where: "zoning IS NOT NULL",
  });

  /* One request, ordered, so the paging cannot silently drop or duplicate a row.
     The values are used here and discarded; only the quantiles are written. */
  const ROW_CAP = 400_000;
  const rows = await soda(PROPERTY_ID, {
    $select: "zoning,lot_size",
    $where: "zoning IS NOT NULL AND lot_size > 0",
    $order: "zoning,lot_size",
    $limit: String(ROW_CAP),
  });
  assertNotTruncated(rows, ROW_CAP, "the zoned-property query");

  const byCode = new Map();
  for (const row of rows) {
    const area = Number(row.lot_size);
    if (!Number.isFinite(area) || area <= 0) continue;
    const list = byCode.get(row.zoning) ?? [];
    list.push(area);
    byCode.set(row.zoning, list);
  }

  const districtRegister = JSON.parse(await readFile(DISTRICTS_PATH, "utf8"));
  const registerBaseCodes = new Set(districtRegister.districts.map((district) => district.baseCode));

  const baseCodes = [...byCode.entries()]
    /* Codes the district register does not carry are DROPPED, and the drop shows
       up as the gap between `zoneCodes` and `zoneCodesJoinedToRegister`. A silent
       drop is how a join-rate regression hides. */
    .filter(([code]) => registerBaseCodes.has(code))
    .map(([baseCode, areas]) => {
      areas.sort((a, b) => a - b);
      return {
        baseCode,
        n: areas.length,
        p10SqM: round1(quantile(areas, 0.1)),
        p25SqM: round1(quantile(areas, 0.25)),
        medianSqM: round1(quantile(areas, 0.5)),
        p75SqM: round1(quantile(areas, 0.75)),
        p90SqM: round1(quantile(areas, 0.9)),
      };
    })
    .sort((a, b) => a.baseCode.localeCompare(b.baseCode, "en"));

  const joinedRows = baseCodes.reduce((sum, entry) => sum + entry.n, 0);
  const rowJoinRate = assertJoinRate(joinedRows, rows.length);

  const timeFrame = meta.metadata?.custom_fields?.["Time Frame"] ?? {};

  const baked = {
    $schema: "aura-homes edmonton lot area set v1",
    retrievedAtISO: now.toISOString(),
    jurisdiction: { id: "city-of-edmonton", name: "City of Edmonton", province: "AB", country: "CA" },
    whatThisIs:
      "A per-district summary of the lot AREAS the City of Edmonton records in its property assessment " +
      "register, published under an open licence. Each row says how large a typical lot in one zoning " +
      "district turns out to be, measured across every titled property the City files under that district's " +
      "base code. It holds no individual property: no address, no coordinate, no owner, no account key and " +
      "no legal description. A property register records who owns what. It never records what is being sold, " +
      "and neither does this.",
    whatThisCannotAnswer: [
      "What land somebody is selling. This is a municipal assessment register summary. It carries no offer, " +
        "no price and no market status, and none of those can be inferred from anything in it.",
      "A lot width or a lot depth. The register publishes an AREA and nothing else, and no free source in " +
        "Edmonton Open Data publishes frontage at all. A width has to be stated by the person, and any depth " +
        "computed from area divided by that width is arithmetic on their number, not a measurement.",
      "A height ceiling for an address. The register's zone codes are base codes: they drop the h and f " +
        "modifiers that carry the ceiling in edmonton-zoning-districts.json, so an address yields a district " +
        "and the district still records the ceiling unknown.",
      "The size of any one lot. These are district quantiles across thousands of properties. The median of a " +
        "district is not a fact about the parcel a reader is standing on.",
      "Anything a survey answers. This is an assessment register, not a Real Property Report, not a " +
        "development permit, and not a subdivision approval. It certifies nothing.",
    ],
    licence: LICENCE,
    method: {
      filter:
        "zoning IS NOT NULL AND lot_size > 0. The rows with no zone code are condominium units whose " +
        "recorded area is a unit share of the parcel rather than a lot; one sampled row carries 3.955 m2. " +
        "Including them would hand a reader a 4 m2 lot.",
      units: "Square metres, as the City publishes them. Converted to square feet at read time.",
      quantile:
        "Linear-interpolated order statistic (the definition R calls type 7), computed over every retained " +
        "row for the base code. Rounded to 0.1 m2.",
      join:
        "Rows are grouped by the register's zone code and kept only where that code is a baseCode in " +
        "edmonton-zoning-districts.json. Codes the district register does not carry are dropped, and the " +
        "drop is visible as the gap between zoneCodes and zoneCodesJoinedToRegister.",
    },
    source: {
      id: PROPERTY_ID,
      title: meta.name,
      publisher: "City of Edmonton",
      catalogueUrl: `${PORTAL}/d/${PROPERTY_ID}`,
      apiEndpoint: `${PORTAL}/resource/${PROPERTY_ID}.json`,
      updateFrequency: timeFrame["Update Frequency"] ?? null,
      /* The portal's own coverage string, verbatim. It disagrees with the title,
         with the portal's "Date Updated" field and with rowsUpdatedAt, so it is
         disclosed rather than reconciled. */
      periodOfCoverage: timeFrame["Period of Coverage"] ?? null,
      portalRowsUpdatedAtISO: rowsUpdatedAtISO,
      rowsUpdatedAgeDays: Math.round(rowsAgeDays * 10) / 10,
      retrievedAtISO: now.toISOString(),
    },
    refusedSources: [
      {
        id: "q7d6-ambg",
        title: "Property Assessment Data",
        publisher: "City of Edmonton",
        catalogueUrl: `${PORTAL}/d/q7d6-ambg`,
        reason:
          "It carries an assessed value per property and joins to this register on the same key. A dollar " +
          "figure on a surface with nothing on offer reads as a price, and no wording fixes that. A municipal " +
          "assessment for taxation is also not a market value. Adding it is a founder decision, not a builder " +
          "decision.",
        checkedAtISO: now.toISOString(),
      },
    ],
    counts: {
      propertyRows: Number(totalRows),
      rowsWithZoneCode: Number(zonedRows),
      rowsWithZoneCodeAndArea: rows.length,
      zoneCodes: byCode.size,
      zoneCodesJoinedToRegister: baseCodes.length,
      rowJoinRate: Math.round(rowJoinRate * 100_000) / 100_000,
    },
    baseCodes,
  };

  const json = `${JSON.stringify(baked, null, 2)}\n`;
  assertNoMarketVocabulary(json);
  const bytes = assertNoParcelIdentity(json);

  const summary =
    `${baked.counts.zoneCodesJoinedToRegister} of ${baked.counts.zoneCodes} zone codes, ` +
    `${joinedRows} of ${baked.counts.rowsWithZoneCodeAndArea} rows joined ` +
    `(${(rowJoinRate * 100).toFixed(3)}%), rows updated ${rowsUpdatedAtISO} ` +
    `(${baked.source.rowsUpdatedAgeDays}d old), ${bytes} bytes`;

  if (DRY_RUN) {
    process.stdout.write(`dry run - ${summary}\n`);
    return;
  }
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, json, "utf8");
  process.stdout.write(`baked ${summary} -> ${OUT_PATH}\n`);
  process.stdout.write(`refused q7d6-ambg: ${baked.refusedSources[0].reason}\n`);
}

main().catch((error) => {
  process.stderr.write(`bake-lot-areas failed: ${error.message}\n`);
  process.exitCode = 1;
});
