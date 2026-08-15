#!/usr/bin/env node
/**
 * Bakes City of Edmonton open-government ZONING CONSTRAINT data into
 * `data/land/edmonton-zoning-districts.json`.
 *
 * WHAT THIS IS NOT. It is not inventory, not a feed, not a market surface. It
 * carries no price, no offer, no ownership and no market status of any kind.
 * It is the authority's own answer to "what rules govern a parcel in this
 * district", which is a different and larger product than a feed of parcels
 * somebody is trying to sell. `assertNoMarketVocabulary` below refuses to
 * write the file if market words leak into it, because the distinction is the
 * whole point and a note in a README cannot enforce it.
 *
 * WHY A BAKE AND NOT A RUNTIME FETCH: the site is a static export with no
 * server and must work offline. Same discipline as
 * `app/scripts/bake-cost-indexes.mjs` (node DB01): data that changes over time
 * refreshes by committing JSON. Re-run after a City release and commit the diff.
 *
 * WHY EDMONTON AND NOT REALTOR.ca: in-app MLS inventory lawfully requires an
 * eligible REALTOR(R)/broker relationship and approved CREA DDF(R) permissions,
 * which Aura does not have. See LAND_LISTING_PROVIDERS in
 * `app/lib/marketplace/discovery.ts`. Open government data needs no such
 * relationship: the City of Edmonton Open Data Terms of Use grant redistribution
 * outright, and the grant clause is copied into the artifact so a reader can
 * check it without trusting this comment.
 *
 * WHAT IS DELIBERATELY NOT BAKED:
 *   - Zoning POLYGON GEOMETRY. 11.5k multipolygons is roughly 8 MB of GeoJSON
 *     (measured, 2026-08-14) and the static export will not carry it. Aura
 *     therefore does NOT claim offline point-in-parcel lookup; it links out to
 *     the City's own map for the parcel-specific answer.
 *   - Zoning Bylaw 20001 REGULATION TABLES (minimum Site area, Setbacks,
 *     minimum Site width). Those live in bylaw text, not in an open dataset,
 *     and the City's Open Data Terms cover datasets in the Open Data Catalogue
 *     rather than the bylaw text. So every district record carries the City's
 *     own URL for its zone section, and every regulation Aura cannot evidence
 *     is recorded as unknown rather than guessed.
 *
 * SOURCES BAKED (both City of Edmonton Open Data Catalogue):
 *   fixa-tstc  Zoning Bylaw Geographical Data  (weekly)
 *   6w3s-58pv  Zoning Overlays                 (weekly)
 *
 * SOURCE REFUSED (recorded in the artifact, with the reason):
 *   svsw-2ub7  Vacant Land Inventory. A May 2014 snapshot whose zone codes are
 *              mostly from the REPEALED Zoning Bylaw 12800 (RF1, RA7, CB2 ...).
 *              Baking it would have shipped decade-old zoning under a fresh
 *              retrieval date. Same failure mode the StatCan bake found when its
 *              named table turned out to be archived.
 *
 * Usage:
 *   node app/scripts/bake-land-data.mjs            # fetch + write
 *   node app/scripts/bake-land-data.mjs --dry-run  # fetch + report only
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const OUT_PATH = resolve(REPO_ROOT, "data", "land", "edmonton-zoning-districts.json");

const PORTAL = "https://data.edmonton.ca";
const ZONING_ID = "fixa-tstc";
const OVERLAY_ID = "6w3s-58pv";
const REFUSED_ID = "svsw-2ub7";

/** The bylaw in force. Every overlay row must still cite it; see assertBylawInForce. */
const BYLAW_IN_FORCE = "20001";
const BYLAW_HOST = "https://zoningbylaw.edmonton.ca/";

/**
 * The City's zoning extract runs weekly. 120 days is ~17 missed runs: long
 * enough that a holiday gap cannot trip it, short enough that a pipeline that
 * has silently died is caught before its zoning is a season out of date.
 */
const MAX_EXTRACT_AGE_DAYS = 120;

/**
 * Zone codes are `BASE` optionally followed by space-separated modifiers.
 * Only `h` and `f` are interpreted, and only because Bylaw 20001 states what
 * they mean in its own words (see MODIFIER_CONVENTION). `cf` is recorded raw
 * and left uninterpreted: Aura has not evidenced its meaning, so it does not
 * get one. A code that does not match this shape stops the bake rather than
 * being silently filed with no modifiers.
 */
const ZONE_CODE_GRAMMAR = /^[A-Z][A-Za-z0-9/-]*(?: (?:h\d+(?:\.\d+)?|f\d+(?:\.\d+)?|cf))*$/;

const MODIFIER_CONVENTION = {
  note:
    "Zoning Bylaw 20001 states the convention in its own text. The MU Zone's Table 4.1 " +
    "gives the maximum Height as “The number (in metres) following the Modifier ‘h’ as " +
    "indicated on the Zoning Map”, and the maximum Floor Area Ratio as the number following " +
    "the Modifier ‘f’. Zones that carry an h modifier therefore publish their own height " +
    "ceiling on the map itself. Zones that do not carry one leave it in bylaw text, and Aura " +
    "records it as unknown.",
  sourceUrl: `${BYLAW_HOST}part-2-standard-zones-and-overlays/mixed-use-zones/280-mu-mixed-use-zone`,
  interpreted: {
    h: "Maximum Height, in metres, per the zone's own Site and Building Regulations table.",
    f: "Maximum Floor Area Ratio, per the same table.",
  },
  uninterpreted: ["cf"],
  caution:
    "A district ceiling is not a parcel permission. Overlays, special areas, Direct Control " +
    "provisions and site-specific rules can lower it, and none of that is decided by the zone " +
    "code alone.",
};

/**
 * Copied verbatim from the City of Edmonton Open Data Terms of Use version 2.1
 * (January 2016), retrieved 2026-08-14 from the PDF the portal links. The grant
 * travels inside the artifact so nobody has to take this script's word for it,
 * and the redistribution condition is quoted because carrying the terms URL is
 * the condition this repository is agreeing to.
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
  /** Socrata's licence id on both baked datasets. assertLicenceUnchanged pins it. */
  portalLicenceId: "SEE_TERMS_OF_USE",
};

/**
 * Words that would turn constraint data into a market claim. The refusal is
 * mechanical because the temptation is not: a reader who sees parcels wants
 * them to be purchasable, and one careless sentence is all it takes.
 */
const MARKET_VOCABULARY = ["for sale", "listing", "listed", "available", "asking price", "realtor", "mls"];

const DRY_RUN = process.argv.includes("--dry-run");

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** SoDA is public and keyless. Retries on transport failure; never on a 4xx. */
async function soda(datasetId, params, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  const url = `${PORTAL}/resource/${datasetId}.json?${new URLSearchParams(params)}`;
  try {
    const response = await fetch(url, { headers: { "User-Agent": "aura-homes bake-land-data" } });
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
    headers: { "User-Agent": "aura-homes bake-land-data" },
  });
  if (!response.ok) throw new Error(`metadata for ${datasetId} returned HTTP ${response.status}`);
  return response.json();
}

/**
 * A `$group` query silently truncates at the row cap, and a truncated group is
 * a wrong count, not a short one. Anything at the cap stops the bake.
 */
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

function assertZoneCodeGrammar(codes) {
  const rejected = codes.filter((code) => !ZONE_CODE_GRAMMAR.test(code));
  if (rejected.length > 0) {
    throw new Error(
      `zone codes do not match the documented modifier grammar: ${rejected.join(", ")}. ` +
        "The City has introduced a modifier this bake does not understand; evidence its meaning before re-baking.",
    );
  }
}

/**
 * RENEGOTIATED 2026-08-14, with the reason, rather than dropped. The first
 * version demanded that EVERY zone row carry a zoningbylaw.edmonton.ca URL and
 * it failed the bake on live data: the City files 12 grouped rows under its own
 * sentinel `"legacy"` (A7, DC, DC1, DC2, CPMU, CPT, NSRVES, RCRL, RCRM, RTCR,
 * TC-MU) and leaves BMR with no url column at all. Those are the City saying
 * "this area has no current bylaw page", which is information, not breakage.
 *
 * What the assertion still has to catch is the thing it was written for: the
 * City moving its bylaw so that every recorded source URL silently rots. So it
 * now refuses any url that is neither on the bylaw host nor the sentinel, and
 * separately refuses a collapse in the share that are on the host. A host move
 * takes that share to roughly zero and still stops the bake.
 */
const LEGACY_URL_SENTINEL = "legacy";
const MIN_ON_HOST_SHARE = 0.9;

function assertBylawHost(urls) {
  const unrecognised = urls.filter(
    (url) => typeof url === "string" && url !== LEGACY_URL_SENTINEL && !url.startsWith(BYLAW_HOST),
  );
  if (unrecognised.length > 0) {
    throw new Error(
      `${unrecognised.length} zone rows carry a URL that is neither on ${BYLAW_HOST} nor the City's ` +
        `"${LEGACY_URL_SENTINEL}" sentinel (e.g. ${JSON.stringify(unrecognised[0])}). ` +
        "The City has moved its bylaw, so every recorded source URL would be wrong.",
    );
  }
  const onHost = urls.filter((url) => typeof url === "string" && url.startsWith(BYLAW_HOST));
  const share = urls.length === 0 ? 0 : onHost.length / urls.length;
  if (share < MIN_ON_HOST_SHARE) {
    throw new Error(
      `only ${Math.round(share * 100)}% of zone rows still point at ${BYLAW_HOST}, below the ` +
        `${Math.round(MIN_ON_HOST_SHARE * 100)}% floor. The bylaw has moved or been replaced; ` +
        "re-read it before re-baking.",
    );
  }
  return share;
}

function assertExtractIsFresh(newestExtractISO, now) {
  const extracted = Date.parse(newestExtractISO);
  if (!Number.isFinite(extracted)) throw new Error(`the zoning extract has no readable date (${newestExtractISO}).`);
  const ageDays = (now.getTime() - extracted) / 86_400_000;
  if (ageDays > MAX_EXTRACT_AGE_DAYS) {
    throw new Error(
      `the newest zoning extract is ${Math.round(ageDays)} days old (${newestExtractISO}), past the ` +
        `${MAX_EXTRACT_AGE_DAYS}-day limit. The City's weekly pipeline has stopped; do not ship stale zoning ` +
        "under a fresh retrieval date.",
    );
  }
  return ageDays;
}

function assertBylawInForce(overlayRows) {
  if (!overlayRows.some((row) => row.bylaw_no === BYLAW_IN_FORCE)) {
    throw new Error(
      `no overlay still cites Zoning Bylaw ${BYLAW_IN_FORCE}. The bylaw in force has changed; ` +
        "re-read the zone structure before re-baking.",
    );
  }
}

/**
 * How the overlay rows split between the bylaw in force and its repealed
 * predecessor — re-derived on every bake rather than remembered.
 *
 * This exists because the first bake shipped 16 records citing repealed Bylaw
 * 12800 with no disclosure, in an artifact that refuses a whole dataset a few
 * lines away for citing the same repealed bylaw. The split is not a defect to
 * suppress — the City's own rows say 12800 for the carried-forward special
 * areas — but it has to be COUNTED and STATED, and if it ever inverts (most
 * overlays leaving the bylaw in force) that is a bylaw transition and the bake
 * should stop rather than quietly republish a superseded map.
 */
function summariseOverlayBylaws(overlayRows) {
  const inForce = overlayRows.filter((row) => row.bylaw_no === BYLAW_IN_FORCE).length;
  const other = overlayRows.length - inForce;
  if (other > inForce) {
    throw new Error(
      `${other} of ${overlayRows.length} overlays no longer cite Zoning Bylaw ${BYLAW_IN_FORCE}, ` +
        `against ${inForce} that do. That is a bylaw transition, not a carried-forward special area. ` +
        "Re-read the zone structure before re-baking.",
    );
  }
  return {
    bylawInForce: BYLAW_IN_FORCE,
    overlaysUnderBylawInForce: inForce,
    overlaysUnderARepealedBylaw: other,
    note:
      `${other} of ${overlayRows.length} overlays carry a bylaw number other than ` +
      `${BYLAW_IN_FORCE} — these are special areas the City carried forward under their ` +
      "original number, and the number is reproduced as the City publishes it. Bylaw 12800 " +
      "is REPEALED. Each overlay states its own bylawInForce so this cannot be read as current " +
      "regulation. Aura does not interpret a repealed overlay's rules.",
  };
}

/**
 * The refusal has its own tripwire. Today the Vacant Land Inventory is a 2014
 * snapshot carrying repealed Bylaw 12800 codes, so it is refused. If the City
 * ever refreshes it against Bylaw 20001 the join rate jumps, and this stops the
 * bake so a person reconsiders instead of leaving a stale refusal in place
 * forever. A refusal nobody rechecks decays into a different kind of lie.
 */
function assertRefusedSourceStillStale(refusedCodes, currentBaseCodes) {
  const joining = refusedCodes.filter((code) => currentBaseCodes.has(code));
  const rate = refusedCodes.length === 0 ? 0 : joining.length / refusedCodes.length;
  if (rate > 0.5) {
    throw new Error(
      `${REFUSED_ID} now shares ${Math.round(rate * 100)}% of its zone codes with the current zoning map. ` +
        "It may have been refreshed against Bylaw 20001; re-read it and decide again whether to bake it.",
    );
  }
  return { joining: joining.length, total: refusedCodes.length, rate };
}

function assertNoMarketVocabulary(json) {
  const haystack = json.toLowerCase();
  for (const word of MARKET_VOCABULARY) {
    const at = haystack.indexOf(word);
    if (at >= 0) {
      throw new Error(
        `the artifact contains the market word "${word}" at offset ${at}: ` +
          `…${json.slice(Math.max(0, at - 90), at + 90).replace(/\s+/g, " ")}… ` +
          "This file is constraint data. It must not read as inventory.",
      );
    }
  }
}

/** `RM h16 f2.3 cf` -> { base: "RM", modifiers: ["h16","f2.3","cf"], maxHeightM: 16, floorAreaRatio: 2.3 } */
function parseZoneCode(code) {
  const [base, ...modifiers] = code.split(" ");
  const height = modifiers.find((token) => /^h\d/.test(token));
  const far = modifiers.find((token) => /^f\d/.test(token));
  return {
    base,
    modifiers,
    maxHeightM: height ? Number(height.slice(1)) : null,
    floorAreaRatio: far ? Number(far.slice(1)) : null,
  };
}

async function main() {
  const now = new Date();

  const [zoningMeta, overlayMeta, refusedMeta] = await Promise.all([
    viewMetadata(ZONING_ID),
    viewMetadata(OVERLAY_ID),
    viewMetadata(REFUSED_ID),
  ]);
  assertLicenceUnchanged(zoningMeta, ZONING_ID);
  assertLicenceUnchanged(overlayMeta, OVERLAY_ID);

  const GROUP_CAP = 20_000;
  const zoneRows = await soda(ZONING_ID, {
    $select: "zoning,description,url,count(1) as n",
    $group: "zoning,description,url",
    $limit: String(GROUP_CAP),
  });
  assertNotTruncated(zoneRows, GROUP_CAP, "the zoning group query");

  const [{ newest }] = await soda(ZONING_ID, { $select: "max(date_ext) as newest" });
  const extractAgeDays = assertExtractIsFresh(newest, now);

  assertZoneCodeGrammar([...new Set(zoneRows.map((row) => row.zoning))]);
  const onHostShare = assertBylawHost(zoneRows.map((row) => row.url));

  const overlayRows = await soda(OVERLAY_ID, {
    $select: "overlay_code,overlay_descr,bylaw_no,special_area,count(1) as n",
    $group: "overlay_code,overlay_descr,bylaw_no,special_area",
    $limit: String(GROUP_CAP),
  });
  assertNotTruncated(overlayRows, GROUP_CAP, "the overlay group query");
  assertBylawInForce(overlayRows);
  const overlayBylaws = summariseOverlayBylaws(overlayRows);

  // Fold the grouped rows into one record per zone code.
  const byCode = new Map();
  for (const row of zoneRows) {
    const areas = Number(row.n);
    const entry = byCode.get(row.zoning) ?? { names: new Map(), urls: new Map(), mappedAreas: 0 };
    entry.mappedAreas += areas;
    entry.names.set(row.description, (entry.names.get(row.description) ?? 0) + areas);
    entry.urls.set(row.url, (entry.urls.get(row.url) ?? 0) + areas);
    byCode.set(row.zoning, entry);
  }

  const districts = [...byCode.entries()]
    .map(([code, entry]) => {
      const parsed = parseZoneCode(code);
      const names = [...entry.names.entries()].sort((a, b) => b[1] - a[1]);
      const onHost = [...entry.urls.keys()].filter(
        (url) => typeof url === "string" && url.startsWith(BYLAW_HOST),
      );
      /**
       * `single`        one bylaw section governs the whole district.
       * `site-specific` Direct Control and similar codes carry one page PER SITE,
       *                 so naming one URL would misstate which provision governs.
       * `not-published` the City filed every area under its own "legacy" sentinel
       *                 or left the column empty: there is no current page to cite.
       * Each of the three is a different reason a reader gets no link, and
       * flattening them to a bare null would throw that away.
       */
      const bylawUrlState = onHost.length === 1 ? "single" : onHost.length > 1 ? "site-specific" : "not-published";
      return {
        code,
        baseCode: parsed.base,
        name: names[0][0],
        /** >1 means the City files several names under one code; the extras are kept rather than dropped. */
        nameVariants: names.length > 1 ? names.slice(1).map(([name]) => name) : [],
        modifiers: parsed.modifiers,
        maxHeightM: parsed.maxHeightM,
        floorAreaRatio: parsed.floorAreaRatio,
        bylawUrl: bylawUrlState === "single" ? onHost[0] : null,
        bylawUrlState,
        bylawUrlCount: onHost.length,
        mappedAreas: entry.mappedAreas,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code, "en"));

  /* THE OVERLAY BYLAW SPLIT, DISCLOSED PER RECORD.

     16 of these 35 overlays carry bylaw_no "12800" — the REPEALED bylaw —
     because that is what the City's own rows say: the special areas were
     carried forward under their original number. The number is therefore
     FAITHFUL, and copying it through is right. What was wrong was shipping it
     silently: a reader could not tell that 12800 is repealed, and this same
     artifact refuses an entire dataset a few lines above for exactly that
     reason. Refusing one source for citing a repealed bylaw while quietly
     citing it yourself is the kind of inconsistency an audit finds and is
     right to find. So every record now states which bylaw it is under and
     whether that bylaw is in force. */
  const overlays = [...overlayRows]
    .map((row) => ({
      code: row.overlay_code,
      name: row.overlay_descr,
      bylawNumber: row.bylaw_no ?? null,
      bylawInForce: (row.bylaw_no ?? null) === BYLAW_IN_FORCE,
      specialArea: row.special_area === true || row.special_area === "true",
      mappedAreas: Number(row.n),
    }))
    .sort((a, b) => a.code.localeCompare(b.code, "en") || a.name.localeCompare(b.name, "en"));

  // The refusal, rechecked every bake rather than remembered.
  const refusedCodeRows = await soda(REFUSED_ID, { $select: "zoning", $group: "zoning", $limit: "1000" });
  const currentBaseCodes = new Set(districts.map((district) => district.baseCode));
  const staleness = assertRefusedSourceStillStale(
    refusedCodeRows.map((row) => row.zoning).filter(Boolean),
    currentBaseCodes,
  );

  const baked = {
    $schema: "aura-homes land constraint set v1",
    retrievedAtISO: now.toISOString(),
    jurisdiction: { id: "city-of-edmonton", name: "City of Edmonton", province: "AB", country: "CA" },
    whatThisIs:
      "Zoning constraint and reference data published by the City of Edmonton under an open licence. " +
      "It carries no price, no offer, no ownership and no market status of any kind, and it is not " +
      "inventory. It answers what rules govern a parcel, not what a person may buy.",
    whatThisCannotAnswer: [
      "Which district a specific parcel falls in. Polygon geometry is not baked (about 8 MB of GeoJSON, " +
        "measured 2026-08-14), so Aura links to the City's own zoning map for the parcel-specific answer.",
      "Minimum Site area, Setbacks, minimum Site width and minimum dwelling size. Those are in Zoning " +
        "Bylaw 20001 text rather than in an open dataset, so each district carries the City's URL for its " +
        "own section and Aura records the numbers as unknown.",
      "Servicing, potable water, private sewage and legal access. Those are parcel and utility facts; " +
        "no district record can stand in for them.",
    ],
    licence: LICENCE,
    modifierConvention: MODIFIER_CONVENTION,
    sources: [
      {
        id: ZONING_ID,
        title: zoningMeta.name,
        publisher: "City of Edmonton",
        catalogueUrl: `${PORTAL}/d/${ZONING_ID}`,
        apiEndpoint: `${PORTAL}/resource/${ZONING_ID}.json`,
        updateFrequency: zoningMeta.metadata?.custom_fields?.["Time Frame"]?.["Update Frequency"] ?? null,
        portalRowsUpdatedAtISO: new Date((zoningMeta.rowsUpdatedAt ?? 0) * 1000).toISOString(),
        newestExtractAtISO: newest,
        extractAgeDays: Math.round(extractAgeDays * 10) / 10,
        bylawUrlOnHostShare: Math.round(onHostShare * 1000) / 1000,
        retrievedAtISO: now.toISOString(),
      },
      {
        id: OVERLAY_ID,
        title: overlayMeta.name,
        publisher: "City of Edmonton",
        catalogueUrl: `${PORTAL}/d/${OVERLAY_ID}`,
        apiEndpoint: `${PORTAL}/resource/${OVERLAY_ID}.json`,
        updateFrequency: overlayMeta.metadata?.custom_fields?.["Time Frame"]?.["Update Frequency"] ?? null,
        portalRowsUpdatedAtISO: new Date((overlayMeta.rowsUpdatedAt ?? 0) * 1000).toISOString(),
        retrievedAtISO: now.toISOString(),
      },
    ],
    refusedSources: [
      {
        id: REFUSED_ID,
        title: refusedMeta.name,
        publisher: "City of Edmonton",
        catalogueUrl: `${PORTAL}/d/${REFUSED_ID}`,
        periodOfCoverage: refusedMeta.metadata?.custom_fields?.["Time Frame"]?.["Period of Coverage"] ?? null,
        portalRowsUpdatedAtISO: new Date((refusedMeta.rowsUpdatedAt ?? 0) * 1000).toISOString(),
        reason:
          `A snapshot whose zone codes are mostly from the repealed Zoning Bylaw 12800. Only ` +
          `${staleness.joining} of its ${staleness.total} zone codes still exist on the current zoning map ` +
          `(${Math.round(staleness.rate * 100)}%), so joining it to Bylaw ${BYLAW_IN_FORCE} districts would ` +
          "have published decade-old zoning under today's retrieval date.",
        checkedAtISO: now.toISOString(),
      },
    ],
    overlayBylaws,
    counts: {
      districts: districts.length,
      districtsWithEvidencedHeight: districts.filter((district) => district.maxHeightM !== null).length,
      districtsWithOneBylawSection: districts.filter((district) => district.bylawUrlState === "single").length,
      mappedZoneAreas: districts.reduce((sum, district) => sum + district.mappedAreas, 0),
      overlays: overlays.length,
      overlaysUnderARepealedBylaw: overlayBylaws.overlaysUnderARepealedBylaw,
    },
    districts,
    overlays,
  };

  const json = `${JSON.stringify(baked, null, 2)}\n`;
  assertNoMarketVocabulary(json);

  const summary =
    `${baked.counts.districts} districts (${baked.counts.districtsWithEvidencedHeight} with an evidenced height), ` +
    `${baked.counts.overlays} overlays, ${baked.counts.mappedZoneAreas} mapped areas, ` +
    `extract ${newest} (${baked.sources[0].extractAgeDays}d old), ${json.length} bytes`;

  if (DRY_RUN) {
    process.stdout.write(`dry run — ${summary}\n`);
    return;
  }
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, json, "utf8");
  process.stdout.write(`baked ${summary} -> ${OUT_PATH}\n`);
  process.stdout.write(`refused ${REFUSED_ID}: ${baked.refusedSources[0].reason}\n`);
}

main().catch((error) => {
  process.stderr.write(`bake-land-data failed: ${error.message}\n`);
  process.exitCode = 1;
});
