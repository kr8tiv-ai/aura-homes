import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "playwright/test";

import {
  DEMO_LAND_LISTINGS,
  LAND_LISTING_PROVIDERS,
  evaluateLandFacts,
  evaluateLandListing,
  type LandDesignRequirements,
} from "@/lib/marketplace/discovery";
import {
  CITY_ZONING_MAP_URL,
  EDMONTON_CONSTRAINT_SET,
  EDMONTON_DISTRICTS,
  EDMONTON_OVERLAYS,
  LAND_CONSTRAINT_BOUNDARY,
  districtConstraintFacts,
  districtMaxHeightFt,
  districtsByBaseCode,
  evaluateEdmontonDistrict,
  findEdmontonDistrict,
  landConstraintAttribution,
} from "@/lib/marketplace/landData";

/* Why this file exists.

   The land-fit pilot scored designs against four fictionalized records. The
   engine was right and the evidence was invented, which is the worst of both:
   a screen that looks rigorous and cannot be wrong about anything real. This
   spec guards the replacement — City of Edmonton open-government zoning data —
   against the three ways it could quietly become as useless as the fixture:

     1. shipping a figure with no source, no licence, or no retrieval date;
     2. reading as inventory when it is nothing of the kind;
     3. inventing evidence it does not have, so the score looks better. */

const REQUIREMENTS: LandDesignRequirements = {
  floorAreaSqft: 800,
  footprintSqft: 800,
  storeys: 1,
  maxHeightFt: 18,
  preferredWater: "cistern",
};

const artifactPath = path.resolve(__dirname, "..", "..", "data", "land", "edmonton-zoning-districts.json");
const artifactText = readFileSync(artifactPath, "utf8");

/* ------------------------------------------------------- provenance */

test("nothing ships without its source, its licence and its retrieval date", () => {
  expect(Number.isFinite(Date.parse(EDMONTON_CONSTRAINT_SET.retrievedAtISO))).toBe(true);

  // The grant clause travels inside the artifact, verbatim, so a reader can
  // check the redistribution right without trusting the bake script.
  /* The grant has to name the licensor and the operative rights. An earlier
     version of this test checked only for "royalty" and "distribute", and a
     mutation that deleted the licensor's name from the clause left it green —
     a grant with no grantor is not a grant. */
  const { licence } = EDMONTON_CONSTRAINT_SET;
  expect(licence.grant).toContain("City of Edmonton");
  expect(licence.grant).toContain("royalty");
  expect(licence.grant).toContain("distribute");
  expect(licence.grant).toContain("commercial purposes");
  expect(licence.redistributionCondition).toContain("Terms of Use");
  expect(licence.url).toMatch(/^https:\/\//);
  expect(licence.documentUrl).toMatch(/^https:\/\//);

  expect(EDMONTON_CONSTRAINT_SET.sources.length).toBeGreaterThan(0);
  for (const source of EDMONTON_CONSTRAINT_SET.sources) {
    expect(source.publisher, `${source.id} publisher`).toBe("City of Edmonton");
    expect(source.catalogueUrl, `${source.id} catalogue`).toMatch(/^https:\/\/data\.edmonton\.ca\//);
    expect(Number.isFinite(Date.parse(source.retrievedAtISO)), `${source.id} retrieval date`).toBe(true);
    expect(Number.isFinite(Date.parse(source.portalRowsUpdatedAtISO)), `${source.id} portal date`).toBe(true);
  }

  // The counts in the file must describe the arrays in the file. A hand-edited
  // artifact is the one thing the bake's own guards cannot catch.
  expect(EDMONTON_CONSTRAINT_SET.counts.districts).toBe(EDMONTON_DISTRICTS.length);
  expect(EDMONTON_CONSTRAINT_SET.counts.overlays).toBe(EDMONTON_OVERLAYS.length);
  expect(EDMONTON_CONSTRAINT_SET.counts.districtsWithEvidencedHeight).toBe(
    EDMONTON_DISTRICTS.filter((district) => district.maxHeightM !== null).length,
  );
  expect(EDMONTON_CONSTRAINT_SET.counts.mappedZoneAreas).toBe(
    EDMONTON_DISTRICTS.reduce((sum, district) => sum + district.mappedAreas, 0),
  );

  const attribution = landConstraintAttribution();
  expect(attribution.text).toContain("City of Edmonton");
  // The licence's condition is that the terms travel with the data, so the
  // attribution helper must hand back the URL, not just a sentence.
  expect(attribution.termsUrl).toBe(licence.url);
  expect(attribution.retrievedAtISO).toBe(EDMONTON_CONSTRAINT_SET.retrievedAtISO);
});

test("every district is identifiable and says why it has no bylaw link when it has none", () => {
  expect(EDMONTON_DISTRICTS.length).toBeGreaterThan(100);
  for (const district of EDMONTON_DISTRICTS) {
    expect(district.code.length, `${district.code} code`).toBeGreaterThan(0);
    expect(district.name.length, `${district.code} name`).toBeGreaterThan(0);
    expect(district.mappedAreas, `${district.code} mapped areas`).toBeGreaterThan(0);
    if (district.bylawUrl === null) {
      // A missing link has to carry its reason. "site-specific" and
      // "not-published" are different situations for a reader and collapsing
      // them to a bare null throws that away.
      expect(["site-specific", "not-published"], `${district.code} state`).toContain(district.bylawUrlState);
    } else {
      expect(district.bylawUrlState).toBe("single");
      expect(district.bylawUrl).toMatch(/^https:\/\/zoningbylaw\.edmonton\.ca\//);
    }
  }
});

test("the refused source is recorded with the numbers that refused it", () => {
  const refused = EDMONTON_CONSTRAINT_SET.refusedSources.find((source) => source.id === "svsw-2ub7");
  expect(refused, "the Vacant Land Inventory refusal must survive in the artifact").toBeTruthy();
  if (!refused) return;
  // Not "we decided not to" — the repealed bylaw and the join rate, so a
  // stranger can re-derive the decision.
  expect(refused.reason).toContain("12800");
  expect(refused.reason).toMatch(/\d+ of its \d+ zone codes/);
  expect(Number.isFinite(Date.parse(refused.checkedAtISO))).toBe(true);
});

/* -------------------------------------------------- never a listing */

const MARKET_VOCABULARY = ["for sale", "listing", "listed", "available", "asking price", "realtor", "mls"];

function marketWordIn(text: string): string | null {
  const haystack = text.toLowerCase();
  return MARKET_VOCABULARY.find((word) => haystack.includes(word)) ?? null;
}

test("constraint data never reads as inventory", () => {
  expect(marketWordIn(artifactText), "the baked artifact").toBe(null);
  expect(marketWordIn(LAND_CONSTRAINT_BOUNDARY), "the boundary sentence").toBe(null);
  expect(marketWordIn(landConstraintAttribution().text), "the attribution").toBe(null);

  // Everything a reader could actually be shown, for every district: the
  // evidence labels the module writes and the findings the engine returns.
  for (const district of EDMONTON_DISTRICTS) {
    const check = evaluateEdmontonDistrict(district, REQUIREMENTS);
    for (const fact of Object.values(districtConstraintFacts(district))) {
      expect(marketWordIn(fact.sourceLabel), `${district.code} evidence label`).toBe(null);
    }
    for (const finding of check.findings) {
      expect(marketWordIn(`${finding.label} ${finding.detail}`), `${district.code} ${finding.id}`).toBe(null);
    }
  }

  // The provider descriptors model the distinction rather than blurring it: an
  // open constraint source is never browsable inventory.
  const constraintProviders = LAND_LISTING_PROVIDERS.filter(
    (provider) => provider.access === "open-constraint-data",
  );
  expect(constraintProviders.length).toBeGreaterThan(0);
  for (const provider of constraintProviders) {
    expect(provider.status, `${provider.id} status`).toBe("reference-only");
    expect(provider.inAppBrowse, `${provider.id} browsable`).toBe(false);
  }
});

/* ------------------------------------------- evidence, not invention */

test("a district evidences its height ceiling and refuses to guess anything else", () => {
  // RL h50: Bylaw 20001's Table 4.1 maps the h50.0 modifier to a 50.0 m ceiling,
  // and the City writes that modifier onto the zoning map itself.
  const rl = findEdmontonDistrict("RL h50");
  expect(rl, "RL h50 must be in the current zoning map").toBeTruthy();
  if (!rl) return;
  expect(rl.maxHeightM).toBe(50);
  expect(districtMaxHeightFt(rl)).toBeCloseTo(50 * 3.280839895, 6);

  const facts = districtConstraintFacts(rl);
  expect(facts.maximumHeightFt.status).toBe("verified");
  expect(facts.maximumHeightFt.checkedAtISO).toBe(EDMONTON_CONSTRAINT_SET.retrievedAtISO);
  expect(facts.maximumHeightFt.sourceUrl).toBe(rl.bylawUrl);

  // Seven unknowns to one verified fact is the honest state of this data. If a
  // later change starts filling these in, it must arrive with its own source.
  const unknowns = Object.values(facts).filter((fact) => fact.status === "unknown");
  expect(unknowns).toHaveLength(7);
  for (const fact of unknowns) {
    expect(fact.value).toBe(null);
    expect(fact.checkedAtISO).toBe(null);
    expect(fact.sourceLabel.length).toBeGreaterThan(20); // the reason, not a blank
  }

  // The vocabulary is EvidenceStatus, unchanged. Nothing here is "declared":
  // an authority published it or it is unknown.
  for (const fact of Object.values(facts)) {
    expect(["verified", "unknown"]).toContain(fact.status);
  }
});

test("a district with no height modifier records the ceiling unknown rather than unlimited", () => {
  const plain = EDMONTON_DISTRICTS.find((district) => district.maxHeightM === null);
  expect(plain).toBeTruthy();
  if (!plain) return;
  const facts = districtConstraintFacts(plain);
  expect(facts.maximumHeightFt.status).toBe("unknown");
  expect(facts.maximumHeightFt.value).toBe(null);

  const check = evaluateEdmontonDistrict(plain, { ...REQUIREMENTS, maxHeightFt: 400 });
  const height = check.findings.find((finding) => finding.id === "height");
  expect(height?.severity, "an unknown ceiling can never pass a 400 ft design").toBe("check");
  expect(height?.points).toBe(0);
});

test("a published ceiling can refuse a design, and a design under it is still not a match", () => {
  const rl = findEdmontonDistrict("RL h50");
  if (!rl) throw new Error("RL h50 missing from the baked set");

  const tooTall = evaluateEdmontonDistrict(rl, { ...REQUIREMENTS, maxHeightFt: 200 });
  expect(tooTall.verdict).toBe("district-rule-blocks");
  expect(tooTall.findings.filter((finding) => finding.severity === "block")).toHaveLength(1);

  const fits = evaluateEdmontonDistrict(rl, REQUIREMENTS);
  expect(fits.verdict).toBe("parcel-evidence-required");
  expect(fits.findings.find((finding) => finding.id === "height")?.severity).toBe("pass");
});

test("no district check can ever come back as a match", () => {
  /* A district governs every parcel inside it and knows nothing about the one
     you are standing on. So no matter how permissive the design, almost every
     question must stay open.

     The floor was written as 7 and this test failed on `MU h12 f2.2 cf` with 6.
     The test was wrong, not the module, and the miscount is worth recording:
     the engine returns SEVEN findings, not eight, because buildableWidthFt and
     buildableDepthFt collapse into one "buildable envelope" finding. Of those
     seven, exactly one — the height ceiling the zone code publishes — can ever
     be answered by a district. So the real invariant, and the stronger one, is
     that a district can evidence at most one of seven. */
  const permissive: LandDesignRequirements = {
    floorAreaSqft: 1,
    footprintSqft: 1,
    storeys: 1,
    maxHeightFt: 1,
    preferredWater: "either",
  };
  for (const district of EDMONTON_DISTRICTS) {
    const check = evaluateEdmontonDistrict(district, permissive);
    expect(["district-rule-blocks", "parcel-evidence-required"], district.code).toContain(check.verdict);
    expect(check.findings, `${district.code} findings`).toHaveLength(7);
    expect(check.evidenced, `${district.code} evidenced`).toBeLessThanOrEqual(1);
    expect(check.outstanding, `${district.code} outstanding`).toBeGreaterThanOrEqual(6);
    expect(check.evidenced + check.outstanding).toBe(check.findings.length);
    expect(check.checkedAtISO).toBe(EDMONTON_CONSTRAINT_SET.retrievedAtISO);
  }
});

test("a base code and a modified code are different districts with different ceilings", () => {
  // `RM` and `RM h16` are separate rows on the City's map. Collapsing them would
  // answer for the wrong ceiling, silently, on the safe-looking side.
  const bare = findEdmontonDistrict("RM");
  const modified = findEdmontonDistrict("RM h16");
  expect(bare).toBeTruthy();
  expect(modified).toBeTruthy();
  expect(bare?.maxHeightM).toBe(null);
  expect(modified?.maxHeightM).toBe(16);

  const family = districtsByBaseCode("RM");
  expect(family.length).toBeGreaterThan(1);
  expect(family.every((district) => district.baseCode === "RM")).toBe(true);

  // Whitespace and case are forgiven; a different district is not.
  expect(findEdmontonDistrict("  rm   h16 ")?.code).toBe("RM h16");
  expect(findEdmontonDistrict("RM h17")).toBe(null);
});

test("every modifier the register interprets matches the code it was read from", () => {
  for (const district of EDMONTON_DISTRICTS) {
    const height = district.modifiers.find((token) => /^h\d/.test(token));
    const far = district.modifiers.find((token) => /^f\d/.test(token));
    expect(district.maxHeightM, `${district.code} height`).toBe(height ? Number(height.slice(1)) : null);
    expect(district.floorAreaRatio, `${district.code} FAR`).toBe(far ? Number(far.slice(1)) : null);
    expect(district.code, `${district.code} recomposes`).toBe(
      [district.baseCode, ...district.modifiers].join(" "),
    );
    // `cf` is stored raw and deliberately uninterpreted: its meaning is not
    // evidenced, so it does not get one.
    expect(EDMONTON_CONSTRAINT_SET.modifierConvention.uninterpreted).toContain("cf");
  }
});

/* --------------------------------------------- one rule, two callers */

test("constraint data and demonstration records are judged by the same rule", () => {
  // The scorer was extracted so open data would not have to masquerade as a
  // listing to reach it. If a second opinion ever appears in evaluateLandListing,
  // the two callers diverge and this goes red.
  const listing = DEMO_LAND_LISTINGS[0];
  expect(evaluateLandListing(listing, REQUIREMENTS).findings).toEqual(
    evaluateLandFacts(listing.facts, REQUIREMENTS),
  );
});

test("the parcel-specific answer points at the authority instead of being guessed", () => {
  expect(CITY_ZONING_MAP_URL).toMatch(/^https:\/\/zoningbylaw\.edmonton\.ca\//);
  expect(
    EDMONTON_CONSTRAINT_SET.whatThisCannotAnswer.some((line) => /district a specific parcel/i.test(line)),
    "the artifact must say out loud that it cannot place a parcel",
  ).toBe(true);
});
