/* /buy AS AN HONEST HOME CATALOG — the contract, as tests.

   Logic-level spec (no browser): it exercises the model layer the page
   renders from, and reads the catalog UI sources off disk to prove the
   forbidden vocabulary — numeric maker ranking, "purchase evidence",
   ChangeNOW/bridge routing detail — cannot render, because it is not in
   the files. The UI-level flow assertions live in marketplace-ui.spec.ts. */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "playwright/test";

import { PROVIDERS } from "@/components/buy/data";
import {
  COMPARE_LIMIT,
  DEFAULT_FILTERS,
  FINISHED_HOME_MODELS,
  HOME_CARD_SLOTS,
  ILLUSTRATIVE_VISUAL_LABEL,
  MISSING_PRICE_SENTENCE,
  PAYMENT_WAIT_SENTENCE,
  deliveryStateFor,
  filterHomes,
  formatNumericPrice,
  hiddenForMissingData,
  paymentMethodOptions,
  permissionIsCurrent,
  priceLine,
  resolveHomeVisual,
  toggleCompare,
  validateFinishedHomeModel,
  validateHomeGeography,
  validateHomeVisual,
  validateNumericPrice,
  type FinishedHomeModel,
  type LicensedPhotoVisual,
} from "@/lib/marketplace/homeModels";

/* ------------------------------------------------------------ fixtures */

function fixtureHome(overrides: Partial<FinishedHomeModel>): FinishedHomeModel {
  return {
    ...FINISHED_HOME_MODELS[0],
    id: "fixture-home",
    model: "Fixture home",
    ...overrides,
  };
}

/* A maker-permissioned photo, in test only. No real photo, maker, licence or
   permission file exists yet — the catalog ships zero of these, which is what
   the byte-stability test below proves. */
function photoVisual(overrides: Partial<LicensedPhotoVisual>): LicensedPhotoVisual {
  return {
    kind: "licensed-photo",
    variant: "folding-modular",
    label: ILLUSTRATIVE_VISUAL_LABEL,
    url: "/photos/fixture-home.jpg",
    credit: "Photo: Fixture Maker Ltd.",
    license: "Aura maker photo licence v1",
    permissionRef: "data/listings/permissions/fixture-home.md",
    collectedAtISO: "2026-01-05T00:00:00.000Z",
    expiresAtISO: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const FIXTURE_PRICE = {
  amount: 129000,
  currency: "CAD",
  asOfISO: "2026-08-10T00:00:00.000Z",
  basis: "maker-published",
} as const;

/* ------------------------------------------------------- card hierarchy */

test("the card component renders the approved hierarchy, in order", () => {
  const source = readFileSync(
    join(__dirname, "..", "components", "buy", "HomeCard.tsx"),
    "utf8",
  );
  const positions = HOME_CARD_SLOTS.map((slot) => source.indexOf(`data-slot="${slot}"`));
  /* an index loop, not positions.entries(): this tsconfig has no `target`,
     so iterating an ArrayIterator trips TS2802 under the ES5 default */
  for (let index = 0; index < positions.length; index += 1) {
    expect(positions[index], `slot ${HOME_CARD_SLOTS[index]} must render`).toBeGreaterThan(-1);
    if (index > 0) {
      expect(
        positions[index],
        `${HOME_CARD_SLOTS[index]} must render below ${HOME_CARD_SLOTS[index - 1]}`,
      ).toBeGreaterThan(positions[index - 1]);
    }
  }
  expect(HOME_CARD_SLOTS).toEqual([
    "home-visual",
    "home-identity",
    "home-price",
    "home-delivery",
    "home-size",
    "home-actions",
  ]);
});

/* ------------------------------------------------- no readiness score */

test("no readiness score, purchase-evidence framing or routing detail exists anywhere in the catalog UI", () => {
  const uiDir = join(__dirname, "..", "components", "buy");
  const files = [
    join(__dirname, "..", "app", "buy", "page.tsx"),
    ...readdirSync(uiDir)
      .filter((name) => name !== "data.ts") // the typed legacy research layer, renders nothing
      .map((name) => join(uiDir, name)),
  ];
  expect(files.length).toBeGreaterThanOrEqual(6);
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const forbidden of [
      /readiness/i,
      /\bscore/i,
      /\/100\b/,
      /purchase evidence/i,
      /ChangeNOW/i,
      /\bbridge\b/i,
      /0x[a-fA-F0-9]{40}/,
    ]) {
      expect(source, `${file} must not match ${forbidden}`).not.toMatch(forbidden);
    }
  }
  // and the models themselves carry no score-shaped field
  for (const home of FINISHED_HOME_MODELS) {
    const keys = JSON.stringify(Object.keys(home));
    expect(keys).not.toMatch(/score|readiness/i);
    expect(JSON.stringify(home)).not.toMatch(/"score"|"readiness/i);
  }
});

/* --------------------------------------------------- honest research map */

test("every home model maps from a real research record, and non-homes never become listings", () => {
  const names = new Set(PROVIDERS.map((provider) => provider.name));
  expect(FINISHED_HOME_MODELS.length).toBeGreaterThanOrEqual(2);
  for (const home of FINISHED_HOME_MODELS) {
    expect(names.has(home.legacyProviderName)).toBe(true);
    expect(home.visual.kind).toBe("aura-illustrative");
    expect(home.sources.length).toBeGreaterThan(0);
    for (const source of home.sources) {
      expect(Number.isFinite(Date.parse(source.collectedAtISO))).toBe(true);
      expect(Date.parse(source.expiresAtISO)).toBeGreaterThan(Date.parse(source.collectedAtISO));
    }
  }
  // existing-property, local site-built and non-home records stay research-only
  const modelled = new Set(FINISHED_HOME_MODELS.map((home) => home.legacyProviderName));
  expect(modelled.has("Armstrong Steel")).toBe(false);
  for (const provider of PROVIDERS) {
    if (["existing-property", "site-built-home", "unique-stay"].includes(provider.productFit)) {
      expect(modelled.has(provider.name), `${provider.name} must not be a catalog listing`).toBe(false);
    }
  }
});

/* ------------------------------------------------------------- compare */

test("compare is capped at exactly three homes and toggling off always works", () => {
  expect(COMPARE_LIMIT).toBe(3);
  let selection: string[] = [];
  selection = toggleCompare(selection, "a");
  selection = toggleCompare(selection, "b");
  selection = toggleCompare(selection, "c");
  expect(selection).toEqual(["a", "b", "c"]);
  // a fourth selection is refused, not silently evicting anything
  expect(toggleCompare(selection, "d")).toEqual(["a", "b", "c"]);
  // toggling an existing selection off still works at the cap
  expect(toggleCompare(selection, "b")).toEqual(["a", "c"]);
});

/* ------------------------------------------------------- missing price */

test("the missing-price sentence is exact and every quote-required home renders it", () => {
  expect(MISSING_PRICE_SENTENCE).toBe("Reliable pricing not found — request a quote.");
  for (const home of FINISHED_HOME_MODELS) {
    if (home.price.state === "quote-required") {
      expect(priceLine(home)).toBe(MISSING_PRICE_SENTENCE);
    }
  }
  const published = fixtureHome({
    price: {
      state: "published",
      amountText: "CAD $100,000 as of 2026-08-10",
      includes: [],
      excludes: [],
      note: "",
    },
  });
  expect(priceLine(published)).toBe("CAD $100,000 as of 2026-08-10");
});

/* ------------------------------------------------------ payment gating */

test("payment methods exist only after a real quote, side by side, neither preselected", () => {
  const home = FINISHED_HOME_MODELS[0];
  // before a quote: nothing, only the waiting sentence exists for the UI
  expect(paymentMethodOptions(home, false)).toEqual([]);
  expect(PAYMENT_WAIT_SENTENCE).toContain("written quote");
  // after a quote: both options, neither hidden, neither preselected
  const options = paymentMethodOptions(home, true);
  expect(options.map((option) => option.id)).toEqual(["cash-card", "xlayer-usdc"]);
  for (const option of options) {
    expect(option.preselected).toBe(false);
    expect(option.detail.length).toBeGreaterThan(0);
  }
  // the unavailable path is visibly unavailable, not hidden
  const usdc = options.find((option) => option.id === "xlayer-usdc");
  expect(usdc?.availability).toBe("unavailable");
  expect(usdc?.horizon).toBe("Future");
});

/* -------------------------------------------------------------- filters */

test("filters narrow by destination, size, bedrooms, construction and price availability", () => {
  const all = FINISHED_HOME_MODELS;
  // destination: Japan keeps only the Japanese maker; unavailable is excluded
  const japan = filterHomes(all, { ...DEFAULT_FILTERS, destination: "japan" });
  expect(japan.map((home) => home.maker)).toEqual(["Lib Work Co., Ltd."]);
  // ask-maker destinations remain visible (labelled, not hidden)
  const canada = filterHomes(all, { ...DEFAULT_FILTERS, destination: "canada" });
  expect(canada.length).toBeGreaterThan(0);
  for (const home of canada) {
    expect(deliveryStateFor(home, "canada")).toBe("ask-maker");
  }
  // construction type
  const modular = filterHomes(all, { ...DEFAULT_FILTERS, construction: "modular" });
  expect(modular.map((home) => home.maker)).toEqual(["BOXABL"]);
  // price availability: nothing in the record has a published price
  expect(filterHomes(all, { ...DEFAULT_FILTERS, price: "published" })).toEqual([]);
  expect(filterHomes(all, { ...DEFAULT_FILTERS, price: "quote-required" }).length).toBe(all.length);
  // size and bedrooms: unknown values are excluded, and the exclusion is counted
  const sized = fixtureHome({ sizeSqFt: { value: 900, note: "" }, bedrooms: { value: 2, note: "" } });
  const mixed = [...all, sized];
  const bySize = filterHomes(mixed, { ...DEFAULT_FILTERS, size: "500-1500" });
  expect(bySize.map((home) => home.id)).toEqual(["fixture-home"]);
  const byBedrooms = filterHomes(mixed, { ...DEFAULT_FILTERS, bedrooms: "2" });
  expect(byBedrooms.map((home) => home.id)).toEqual(["fixture-home"]);
  expect(hiddenForMissingData(mixed, { ...DEFAULT_FILTERS, size: "500-1500" })).toBe(all.length);
  expect(hiddenForMissingData(mixed, DEFAULT_FILTERS)).toBe(0);
});

/* ------------------------------------------------- rights-safe photo slot

   C-1 pins, written before any photo or price exists. A licensed photo, a
   numeric price and a geography ride the model as OPTIONAL slots by the
   builder document's site-slot precedent: absent from every record written
   before them, so those records serialize to the same bytes; refused
   outright when they arrive without provenance; and dropped automatically
   the moment a written permission lapses. The rights policy these enforce
   is stated in data/listings/README.md. */

test("the photo, price and geography slots are optional — shipped records serialize exactly as before", () => {
  for (const home of FINISHED_HOME_MODELS) {
    const json = JSON.stringify(home);
    /* absent, not null — a record authored before the slot existed is
       unchanged on disk, so goldens and saved projects keep working */
    expect("geography" in home).toBe(false);
    expect("numeric" in home.price).toBe(false);
    expect(json).not.toContain('"geography"');
    expect(json).not.toContain('"numeric"');
    expect(json).not.toContain("licensed-photo");
    expect(Object.keys(home.visual)).toEqual(["kind", "variant", "label"]);
    expect(Object.keys(home.price)).toEqual(["state", "amountText", "includes", "excludes", "note"]);

    const revalidated = validateFinishedHomeModel(JSON.parse(json));
    if (!revalidated.ok) throw new Error(revalidated.problem);
    expect(JSON.stringify(revalidated.home)).toBe(json);
  }

  /* the absence assertions above are live, not vacuous: a record that DOES
     use the new slots serializes all three, so a stray default would fail */
  const evolved = fixtureHome({
    visual: photoVisual({}),
    geography: { country: "CA", provinceState: "Alberta", lat: null, lng: null },
    price: {
      state: "published",
      amountText: null,
      includes: [],
      excludes: [],
      note: "",
      numeric: FIXTURE_PRICE,
    },
  });
  const evolvedJson = JSON.stringify(evolved);
  expect(evolvedJson).toContain("licensed-photo");
  expect(evolvedJson).toContain('"geography"');
  expect(evolvedJson).toContain('"numeric"');
});

test("a lapsed photo permission falls back to the drawing, without being asked", () => {
  const expiresAtISO = "2026-07-01T00:00:00.000Z";
  const home = fixtureHome({ visual: photoVisual({ expiresAtISO }) });
  const photo = home.visual as LicensedPhotoVisual;

  // while the permission holds, the photo is what the card draws
  expect(resolveHomeVisual(home, new Date("2026-06-30T23:59:59.000Z")).kind).toBe("licensed-photo");
  // the boundary belongs to the lapse — at the expiry instant the photo is gone
  expect(permissionIsCurrent(photo, new Date(expiresAtISO))).toBe(false);

  const lapsed = resolveHomeVisual(home, new Date("2026-08-14T00:00:00.000Z"));
  expect(lapsed.kind).toBe("aura-illustrative");
  expect(lapsed.variant).toBe(photo.variant);
  expect(lapsed.label).toBe(ILLUSTRATIVE_VISUAL_LABEL);

  // an illustrative record is returned untouched, whatever the date
  const drawn = FINISHED_HOME_MODELS[0];
  expect(resolveHomeVisual(drawn, new Date("2030-01-01T00:00:00.000Z"))).toBe(drawn.visual);
});

test("a photo without a credit, a named licence or a permission reference is refused", () => {
  const sound = validateHomeVisual(photoVisual({}));
  expect(sound.ok).toBe(true);

  const refusals: Array<{ field: string; visual: LicensedPhotoVisual }> = [
    { field: "credit", visual: photoVisual({ credit: "" }) },
    { field: "credit", visual: photoVisual({ credit: "   " }) },
    { field: "permissionRef", visual: photoVisual({ permissionRef: "" }) },
    { field: "license", visual: photoVisual({ license: "" }) },
    { field: "url", visual: photoVisual({ url: "" }) },
    { field: "expiresAtISO", visual: photoVisual({ expiresAtISO: "" }) },
    { field: "collectedAtISO", visual: photoVisual({ collectedAtISO: "whenever" }) },
    {
      field: "expiresAtISO",
      visual: photoVisual({ collectedAtISO: "2026-07-01T00:00:00.000Z", expiresAtISO: "2026-01-05T00:00:00.000Z" }),
    },
  ];
  for (const { field, visual } of refusals) {
    const checked = validateHomeVisual(visual);
    expect(checked.ok, `a photo missing ${field} must not validate`).toBe(false);
    if (!checked.ok) expect(checked.problem).toContain(field);
  }

  // the whole record is refused too, and the renderer refuses it a second
  // time: a provenance-less photo has no path to a reader
  const home = fixtureHome({ visual: photoVisual({ credit: "" }) });
  const model = validateFinishedHomeModel(home);
  expect(model.ok).toBe(false);
  expect(resolveHomeVisual(home, new Date("2026-06-01T00:00:00.000Z")).kind).toBe("aura-illustrative");
});

test("a numeric price without a date, a currency or a stated basis is refused", () => {
  expect(validateNumericPrice(FIXTURE_PRICE).ok).toBe(true);

  const { asOfISO, ...undated } = FIXTURE_PRICE;
  const undatedCheck = validateNumericPrice(undated);
  expect(undatedCheck.ok).toBe(false);
  if (!undatedCheck.ok) expect(undatedCheck.problem).toContain("asOfISO");
  expect(validateNumericPrice({ ...FIXTURE_PRICE, asOfISO: "" }).ok).toBe(false);
  expect(validateNumericPrice({ ...FIXTURE_PRICE, asOfISO: "sometime in 2026" }).ok).toBe(false);

  const { basis, ...unsourced } = FIXTURE_PRICE;
  expect(validateNumericPrice(unsourced).ok).toBe(false);
  expect(validateNumericPrice({ ...FIXTURE_PRICE, currency: "$" }).ok).toBe(false);
  expect(validateNumericPrice({ ...FIXTURE_PRICE, amount: 0 }).ok).toBe(false);
  expect(validateNumericPrice({ ...FIXTURE_PRICE, amount: Number.NaN }).ok).toBe(false);

  // one anchored source: the line is derived from the number, never retyped
  const line = formatNumericPrice(FIXTURE_PRICE);
  expect(line).toBe("CAD 129,000 as of 2026-08-10");
  const priced = fixtureHome({
    price: { state: "published", amountText: line, includes: [], excludes: [], note: "", numeric: FIXTURE_PRICE },
  });
  expect(validateFinishedHomeModel(priced).ok).toBe(true);
  expect(priceLine(priced)).toBe(line);

  const retyped = fixtureHome({
    price: { ...priced.price, amountText: "CAD 129,500 as of 2026-08-10" },
  });
  const retypedCheck = validateFinishedHomeModel(retyped);
  expect(retypedCheck.ok).toBe(false);
  if (!retypedCheck.ok) expect(retypedCheck.problem).toContain("amountText");

  // a home with no numeric price still renders its authored line, unchanged
  const authored = fixtureHome({
    price: { state: "published", amountText: "CAD $100,000 as of 2026-08-10", includes: [], excludes: [], note: "" },
  });
  expect(priceLine(authored)).toBe("CAD $100,000 as of 2026-08-10");
});

test("geography records only what is known and refuses half a coordinate", () => {
  expect(validateHomeGeography({ country: "CA", provinceState: "Alberta", lat: null, lng: null }).ok).toBe(true);
  expect(validateHomeGeography({ country: "CA", provinceState: null, lat: 53.55, lng: -113.49 }).ok).toBe(true);
  // half a coordinate is a guess, and a missing pair is not the same as null
  expect(validateHomeGeography({ country: "CA", provinceState: null, lat: 53.55, lng: null }).ok).toBe(false);
  expect(validateHomeGeography({ country: "CA", provinceState: null }).ok).toBe(false);
  // a country name is not a country code, and out-of-range is not a place
  expect(validateHomeGeography({ country: "Canada", provinceState: null, lat: null, lng: null }).ok).toBe(false);
  expect(validateHomeGeography({ country: "CA", provinceState: null, lat: 91, lng: 0 }).ok).toBe(false);
  expect(validateHomeGeography({ country: "CA", provinceState: null, lat: 0, lng: 181 }).ok).toBe(false);
});
