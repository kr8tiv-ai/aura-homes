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
  MISSING_PRICE_SENTENCE,
  PAYMENT_WAIT_SENTENCE,
  deliveryStateFor,
  filterHomes,
  hiddenForMissingData,
  paymentMethodOptions,
  priceLine,
  toggleCompare,
  type FinishedHomeModel,
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
  expect(FINISHED_HOME_MODELS.length).toBeGreaterThanOrEqual(3);
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
