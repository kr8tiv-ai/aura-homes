#!/usr/bin/env node
/**
 * Bakes Statistics Canada construction price indexes into
 * `data/cost-indexes/statcan-1810028901.json`.
 *
 * WHY a bake and not a runtime fetch: the site is fully static (no server, no
 * paid API). Data that changes over time refreshes by committing JSON — plan
 * C5 step 1, node DB01. Re-runnable: run it again after a StatCan release and
 * commit the diff.
 *
 * WHY table 18-10-0289-01 when the graph names 18-10-0276-01: the named table
 * is ARCHIVED (last reference period 2024-04-01). Its own successor says so —
 * 18-10-0289-01 footnote 1, verbatim: "This table replaces table 18-10-0276
 * which was archived with the release of second quarter 2024 data." Baking the
 * archived table would have shipped a two-year-stale index under a
 * current-sounding label. The archived id is recorded in `supersedes` so the
 * lineage stays legible.
 *
 * WHAT this data can and cannot say — carried into the file itself, because a
 * consumer that forgets it will overclaim: the BCPI is a TIME series per
 * region (a common index base, then divergent drift). It is not a survey of
 * absolute price levels between cities. A ratio of two regions' index values
 * therefore measures relative construction-cost DRIFT since the base period,
 * and only equals a cost-level ratio if the two regions started at parity.
 * Aura has no free public source for that parity, so the ratio is used as an
 * estimate and the consuming band widens by the size of the drift.
 *
 * Free tier only (founder decision D-2026-08-12): StatCan's Web Data Service
 * is public, keyless and unmetered. No scraping, no paid data, no outreach.
 *
 * Usage:
 *   node app/scripts/bake-cost-indexes.mjs            # fetch + write
 *   node app/scripts/bake-cost-indexes.mjs --dry-run  # fetch + report only
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const OUT_PATH = resolve(REPO_ROOT, "data", "cost-indexes", "statcan-1810028901.json");

const PRODUCT_ID = 18100289;
const TABLE_ID = "18-10-0289-01";
const SUPERSEDED_TABLE_ID = "18-10-0276-01";
const TABLE_URL = `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=${PRODUCT_ID}`;
const WDS_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";

/** Dimension 2 member: the building type closest to an 800 sq ft Part 9 home. */
const TYPE_OF_BUILDING_MEMBER_ID = 5; // "Single-detached house"

/**
 * Dimension 3 members we bake. `composite` is the whole-building index; the
 * rest are the MasterFormat divisions a cost-model line can honestly point at.
 * Divisions we do not bake (demolition, conveying equipment, fire suppression,
 * masonry, integrated automation, communications, electrical safety, equipment,
 * specialities) have no line in data/alberta/cost-model.json to serve.
 */
const DIVISIONS = [
  { key: "composite", memberId: 1 },
  { key: "generalRequirements", memberId: 2 },
  { key: "concrete", memberId: 4 },
  { key: "structuralSteelFraming", memberId: 6 },
  { key: "woodPlasticsComposites", memberId: 8 },
  { key: "thermalMoistureProtection", memberId: 9 },
  { key: "openings", memberId: 10 },
  { key: "finishes", memberId: 11 },
  { key: "plumbing", memberId: 16 },
  { key: "hvac", memberId: 17 },
  { key: "electrical", memberId: 19 },
  { key: "earthwork", memberId: 22 },
  { key: "exteriorImprovements", memberId: 23 },
  { key: "utilities", memberId: 24 },
];

/**
 * The region data/alberta/cost-model.json was researched in ("Rural Alberta
 * within ~1hr of Edmonton"). Every multiplier is a ratio against this region,
 * so it is 1.0 by construction and the published triplet cannot move.
 */
const ANCHOR_GEO_MEMBER_ID = 22; // "Edmonton, Alberta"

/** How many quarters to pull so a single shared reference period can be found. */
const LATEST_N = 6;

const DRY_RUN = process.argv.includes("--dry-run");

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * The WDS resets connections under sustained load, so the bake retries with
 * backoff. A transient socket error must not be able to leave a half-baked
 * file behind — nothing is written until every series is in hand.
 */
async function wds(path, body, attempt = 1) {
  const MAX_ATTEMPTS = 6;
  try {
    const response = await fetch(`${WDS_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`HTTP ${response.status}`);
    }
    if (!response.ok) throw new Error(`StatCan ${path} returned HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new Error(`StatCan ${path} failed after ${MAX_ATTEMPTS} attempts: ${error.message}`);
    }
    await sleep(500 * 2 ** (attempt - 1));
    return wds(path, body, attempt + 1);
  }
}

/** Region id used across the repo: lowercase, hyphenated, no accents. */
function slug(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** geoLevel 2 = province/territory; 503/505 = census metropolitan area. */
function regionKind(geoLevel) {
  if (geoLevel === 2) return "province";
  if (geoLevel === 503 || geoLevel === 505) return "cma";
  return "composite";
}

/**
 * "Quebec" is both a province and a CMA in this cube, so the bare place slug
 * collides. Resolution is order-independent: the CMA keeps the plain id (it is
 * what a person means by a place name) and the colliding province takes the
 * `-province` suffix. Ids are asserted unique before anything is written \u2014 a
 * silent collision would let one region's multiplier answer for another's.
 */
function assignRegionIds(members) {
  const base = new Map();
  for (const member of members) {
    const kind = regionKind(member.geoLevel);
    base.set(
      member.memberId,
      kind === "composite" ? "canada-fifteen-cma-composite" : slug(member.memberNameEn.split(",")[0]),
    );
  }
  const counts = new Map();
  for (const value of base.values()) counts.set(value, (counts.get(value) ?? 0) + 1);

  const ids = new Map();
  for (const member of members) {
    const kind = regionKind(member.geoLevel);
    const stem = base.get(member.memberId);
    ids.set(member.memberId, counts.get(stem) > 1 && kind === "province" ? `${stem}-province` : stem);
  }
  const seen = new Set();
  for (const [memberId, id] of ids) {
    if (seen.has(id)) throw new Error(`Region id collision on "${id}" (member ${memberId}); refusing to bake.`);
    seen.add(id);
  }
  return ids;
}

async function main() {
  const [metaEnvelope] = await wds("getCubeMetadata", [{ productId: PRODUCT_ID }]);
  if (metaEnvelope.status !== "SUCCESS") throw new Error("StatCan getCubeMetadata failed");
  const cube = metaEnvelope.object;

  if (!/^CURRENT/.test(cube.archiveStatusEn ?? "")) {
    // Refuse rather than bake a stale index under a fresh retrieval date.
    throw new Error(
      `Table ${TABLE_ID} is no longer current (${cube.archiveStatusEn}). ` +
        "Find its successor before re-baking — do not ship an archived index.",
    );
  }

  const [geoDim, typeDim, divisionDim] = cube.dimension;
  const geoMembers = geoDim.member;
  const typeMember = typeDim.member.find((m) => m.memberId === TYPE_OF_BUILDING_MEMBER_ID);
  const divisionNames = new Map(divisionDim.member.map((m) => [m.memberId, m.memberNameEn]));
  const anchorMember = geoMembers.find((m) => m.memberId === ANCHOR_GEO_MEMBER_ID);
  if (!typeMember || !anchorMember) throw new Error("StatCan dimensions moved; re-map before baking.");

  // One request per (geography x division) series, chunked.
  const requests = [];
  for (const geo of geoMembers) {
    for (const division of DIVISIONS) {
      requests.push({
        geoMemberId: geo.memberId,
        divisionKey: division.key,
        coordinate: `${geo.memberId}.${TYPE_OF_BUILDING_MEMBER_ID}.${division.memberId}.0.0.0.0.0.0.0`,
      });
    }
  }

  const series = new Map(); // `${geoMemberId}:${divisionKey}` -> { vectorId, coordinate, points }
  const CHUNK = 25;
  for (let i = 0; i < requests.length; i += CHUNK) {
    if (i > 0) await sleep(250); // stay well inside the WDS rate limit
    const chunk = requests.slice(i, i + CHUNK);
    const envelopes = await wds(
      "getDataFromCubePidCoordAndLatestNPeriods",
      chunk.map((r) => ({ productId: PRODUCT_ID, coordinate: r.coordinate, latestN: LATEST_N })),
    );
    for (const envelope of envelopes) {
      if (envelope.status !== "SUCCESS") continue;
      const object = envelope.object;
      const match = chunk.find((r) => r.coordinate === object.coordinate);
      if (!match) continue;
      const points = new Map();
      for (const point of object.vectorDataPoint ?? []) {
        // statusCode 0 = normal. Anything else (suppressed, unavailable) is an
        // honest blank, never a carried-forward guess.
        if (point.statusCode !== 0 || typeof point.value !== "number") continue;
        points.set(point.refPer, point.value);
      }
      series.set(`${match.geoMemberId}:${match.divisionKey}`, {
        vectorId: object.vectorId,
        coordinate: object.coordinate,
        points,
      });
    }
    process.stderr.write(`  fetched ${Math.min(i + CHUNK, requests.length)}/${requests.length} series\n`);
  }

  // One reference period for every baked figure. Comparing two regions across
  // different quarters would silently fold time drift into a space multiplier.
  const anchorPeriods = DIVISIONS.map((d) => series.get(`${ANCHOR_GEO_MEMBER_ID}:${d.key}`))
    .filter(Boolean)
    .map((s) => new Set(s.points.keys()));
  if (anchorPeriods.length !== DIVISIONS.length) {
    throw new Error("The anchor region is missing a division series; cannot bake a base.");
  }
  const shared = [...anchorPeriods[0]].filter((period) => anchorPeriods.every((set) => set.has(period)));
  shared.sort();
  const referencePeriod = shared[shared.length - 1];
  if (!referencePeriod) throw new Error("No reference period is common to every anchor division series.");

  const regionIds = assignRegionIds(geoMembers);
  const regions = [];
  for (const geo of geoMembers) {
    const divisions = {};
    for (const division of DIVISIONS) {
      const entry = series.get(`${geo.memberId}:${division.key}`);
      const value = entry?.points.get(referencePeriod);
      if (entry === undefined || value === undefined) continue; // honest blank
      divisions[division.key] = {
        label: divisionNames.get(DIVISIONS.find((d) => d.key === division.key).memberId),
        value,
        vectorId: entry.vectorId,
        coordinate: entry.coordinate,
      };
    }
    if (divisions.composite === undefined) continue; // no composite, no region
    regions.push({
      id: regionIds.get(geo.memberId),
      label: geo.memberNameEn,
      kind: regionKind(geo.geoLevel),
      statcanMemberId: geo.memberId,
      divisions,
    });
  }

  const anchorRegion = regions.find((r) => r.statcanMemberId === ANCHOR_GEO_MEMBER_ID);
  if (!anchorRegion) throw new Error("The anchor region did not survive the bake; refusing to write.");

  const baked = {
    $schema: "aura-homes cost index set v1",
    retrievedAtISO: new Date().toISOString(),
    referencePeriod,
    source: {
      publisher: "Statistics Canada",
      tableId: TABLE_ID,
      productId: PRODUCT_ID,
      title: cube.cubeTitleEn,
      url: TABLE_URL,
      apiEndpoint: `${WDS_BASE}/getDataFromCubePidCoordAndLatestNPeriods`,
      licence: "Statistics Canada Open Licence",
      licenceUrl: "https://www.statcan.gc.ca/en/reference/licence",
      archiveStatus: cube.archiveStatusEn,
      releaseTime: cube.releaseTime,
      supersedes: SUPERSEDED_TABLE_ID,
      supersedesNote:
        cube.footnote?.find((f) => /replaces table/i.test(f.footnotesEn ?? ""))?.footnotesEn ??
        `Replaces the archived table ${SUPERSEDED_TABLE_ID}.`,
      corrections: (cube.correction ?? []).map((c) => ({ date: c.correctionDate, note: c.correctionNoteEn })),
      footnotes: (cube.footnote ?? []).map((f) => f.footnotesEn),
    },
    selection: {
      typeOfBuilding: typeMember.memberNameEn,
      typeOfBuildingMemberId: typeMember.memberId,
      divisionStandard: "MasterFormat divisions as grouped by Statistics Canada",
    },
    anchorRegionId: anchorRegion.id,
    anchorBasis:
      "data/alberta/cost-model.json was researched for rural Alberta within ~1hr of Edmonton. " +
      "Every multiplier is a ratio against this region, so the anchored region's multiplier is 1.0 " +
      "by construction and the published ex-land triplet cannot move.",
    interpretation:
      "These are time indexes with a common base, not a survey of absolute price levels between cities. " +
      "A ratio between two regions measures relative construction-cost drift since the base period and " +
      "equals a cost-level ratio only if the regions started at parity. Aura has no free public source " +
      "for that parity, so a regionalized budget is an estimate, not a quote, and its band widens by the " +
      "size of the drift.",
    regions,
  };

  const json = `${JSON.stringify(baked, null, 2)}\n`;
  if (DRY_RUN) {
    process.stdout.write(
      `dry run — ${regions.length} regions, reference period ${referencePeriod}, ` +
        `${json.length} bytes, anchor ${anchorRegion.id} composite ${anchorRegion.divisions.composite.value}\n`,
    );
    return;
  }
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, json, "utf8");
  process.stdout.write(
    `baked ${regions.length} regions at ${referencePeriod} from ${TABLE_ID} -> ${OUT_PATH}\n` +
      `anchor ${anchorRegion.id} composite ${anchorRegion.divisions.composite.value} ` +
      `(vector ${anchorRegion.divisions.composite.vectorId})\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`bake-cost-indexes failed: ${error.message}\n`);
  process.exitCode = 1;
});
