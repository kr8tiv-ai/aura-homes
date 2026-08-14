/* ---------------------------------------------------------------------
   FINISHED HOME MODELS — the honest catalog layer behind /buy.

   The research record in data/providers/crypto-home-providers.json holds
   seven maker records. Only some of them describe an actual finished home
   a person could order: those become FinishedHomeModel entries here,
   mapped field by field from the researcher's own words. The rest
   (existing-property marketplaces, a local site-built service, a
   truck-bed camper) stay readable as legacy research on the page but are
   never dressed up as home listings.

   Rules this module enforces:
   · No readiness score. Nothing here computes or exposes a number that
     ranks a maker. Evidence is dated and linked; the reader judges.
   · Nothing invented. A field the research does not contain is null with
     an explicit "ask the maker" note, never a plausible guess.
   · Payment options exist only AFTER a real captured quote. Before that
     the catalog shows a single explanatory sentence, and the exact
     missing-price sentence is a constant so the UI cannot drift.
--------------------------------------------------------------------- */

import { PROVIDERS, type Provider } from "@/components/buy/data";
import type { PurchaseProduct, TargetRegion } from "./buyReadiness";
import { providerPurchaseReadiness } from "./buyReadiness";
import type { AuraProject } from "../project/document";
import {
  createManufacturerInquiry,
  manufacturerSubjectId,
  validateManufacturerInquiry,
  type ManufacturerInquiry,
} from "../project/manufacturerInquiry";
import {
  createDiscoveryRecord,
  setProjectShortlist,
  upsertProjectDiscoveryRecord,
} from "../project/discoveryRecord";
import {
  projectQuotesFromUnknown,
  type ProjectQuote,
} from "../project/quoteReconciliation";

/* ------------------------------------------------------------- vocabulary */

/** Re-exported so catalog UI files import their region vocabulary from the
 *  model layer alone. */
export type { TargetRegion } from "./buyReadiness";

export type CatalogRegion = Exclude<TargetRegion, "any">;
export type DeliveryState = "confirmed" | "ask-maker" | "unavailable";
export type HomeConstructionType = "kit" | "modular" | "3d-printed";

export const REGION_LABELS: Record<CatalogRegion, string> = {
  canada: "Canada",
  "united-states": "United States",
  europe: "Europe",
  uae: "United Arab Emirates",
  japan: "Japan",
  other: "Other markets",
};

export const CONSTRUCTION_LABELS: Record<HomeConstructionType, string> = {
  kit: "Steel kit",
  modular: "Folding modular",
  "3d-printed": "3D-printed earth",
};

/** The exact sentence for a home without reliable pricing. Verbatim from
 *  the release plan — do not reword. */
export const MISSING_PRICE_SENTENCE =
  "Reliable pricing not found — request a quote.";

export const NOT_IN_RECORD = "Not in the research record — ask the maker.";

/* --------------------------------------------- visual, price, geography */

export type HomeVisualVariant = "steel-kit" | "folding-modular" | "printed-earth";

/** The caption every Aura drawing carries. Held once so the words a card
 *  prints and the words a licence-lapse fallback produces cannot drift. */
export const ILLUSTRATIVE_VISUAL_LABEL = "Aura illustrative visual — not a product photo";

export interface AuraIllustrativeVisual {
  kind: "aura-illustrative";
  variant: HomeVisualVariant;
  label: string;
}

/** A photograph a maker granted us in writing, under a licence we can name.
 *
 *  It carries its own provenance AND the drawing it sits in front of:
 *  `variant` and `label` mean exactly what they mean on the illustrative
 *  member, so a card reads them off either without narrowing, and a photo
 *  whose permission lapses always has somewhere honest to land. There is no
 *  member for a photo without provenance — an unattributed photo is
 *  unspellable in the type, and validateHomeVisual refuses one that arrives
 *  from JSON anyway. */
export interface LicensedPhotoVisual {
  kind: "licensed-photo";
  variant: HomeVisualVariant;
  label: string;
  /** Where the file lives once it is ours to serve. Hotlinking a maker's
   *  server is not a licence. */
  url: string;
  /** The credit line the licence obliges us to print, verbatim. */
  credit: string;
  /** The licence itself, named: "CC BY 4.0", "Aura maker photo licence v1". */
  license: string;
  /** Where the signed one-pager lives, so a reader can be shown the
   *  permission rather than told about it. */
  permissionRef: string;
  collectedAtISO: string;
  /** When the permission lapses. Past this instant the photo stops
   *  rendering — see resolveHomeVisual. */
  expiresAtISO: string;
}

export type HomeVisual = AuraIllustrativeVisual | LicensedPhotoVisual;

export type PriceBasis = "maker-published" | "written-quote" | "public-record";

/** A price as a number rather than a sentence, so a filter or a total can
 *  use it. `asOfISO` and `basis` are mandatory: an undated number with no
 *  stated origin is a rumour, and a rumour must not be filterable. */
export interface NumericPrice {
  amount: number;
  /** ISO 4217 alphabetic code, uppercase. No symbols — "$" names several
   *  different currencies. */
  currency: string;
  asOfISO: string;
  basis: PriceBasis;
}

/** Where a home sits. Optional throughout: a record that knows only the
 *  country states only the country, and half a coordinate is refused
 *  outright rather than completed by guesswork. */
export interface HomeGeography {
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string;
  provinceState: string | null;
  lat: number | null;
  lng: number | null;
}

/* ------------------------------------------------------------- the model */

export interface HomeFact {
  value: number | null;
  note: string;
}

export interface HomeSource {
  label: string;
  url: string;
  collectedAtISO: string;
  expiresAtISO: string;
}

export interface HomeCertification {
  claim: string;
  sourceUrl: string;
  datedISO: string;
}

export interface FinishedHomeModel {
  /** Stable id — identical to the legacy manufacturer subject id so
   *  shortlists saved before this catalog existed keep pointing at the
   *  same maker. */
  id: string;
  model: string;
  maker: string;
  makerCountry: string;
  makerUrl: string;
  marketStatus: "current-maker-model" | "announced-concept";
  visual: HomeVisual;
  sizeSqFt: HomeFact;
  bedrooms: HomeFact;
  constructionType: HomeConstructionType;
  customization: string;
  price: {
    state: "published" | "quote-required";
    amountText: string | null;
    includes: string[];
    excludes: string[];
    note: string;
    /** OPTIONAL, by the builder document's site-slot precedent: absent from
     *  every record written before it existed, so those records serialize
     *  to the same bytes as before. When present it is the ONE source for
     *  the amount — amountText must read exactly formatNumericPrice(numeric)
     *  or stay null, so the figure is never retyped into prose. */
    numeric?: NumericPrice;
  };
  delivery: {
    confirmed: CatalogRegion[];
    askMaker: CatalogRegion[];
  };
  certifications: HomeCertification[];
  sources: HomeSource[];
  paymentResearch: {
    cashCard: string;
    crypto: string;
  };
  unresolved: string[];
  caveat: string;
  quotedClaim: string;
  /** OPTIONAL, same precedent as price.numeric: a record that carries no
   *  located evidence carries no geography rather than a placeholder. */
  geography?: HomeGeography;
  /** Name key back into the legacy research record in data.ts. */
  legacyProviderName: string;
}

/* -------------------------------------------------- provenance validation

   The rights policy in data/listings/README.md, enforced. A photo without
   a credit, a named licence and a recorded permission cannot be built here
   and cannot be loaded from JSON either — the refusal is the mechanism, not
   a guideline someone is asked to remember. */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const filled = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/* Date.parse alone is not a date check: V8's fallback parser reads
   "sometime in 2026" as a real instant, which would let an undated price or
   an open-ended permission through. The shape is checked first, then the
   value, so only an ISO-8601 date or timestamp counts. */
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const validISO = (value: unknown): value is string =>
  filled(value) && ISO_INSTANT.test(value.trim()) && Number.isFinite(Date.parse(value));

const VISUAL_VARIANTS: readonly HomeVisualVariant[] = [
  "steel-kit",
  "folding-modular",
  "printed-earth",
];

const PRICE_BASES: readonly PriceBasis[] = [
  "maker-published",
  "written-quote",
  "public-record",
];

/** The drawing that stands in for each construction type. Used only when a
 *  JSON-sourced visual names a variant this build does not draw, so a lapsed
 *  or malformed photo still resolves to something the card can render. */
const VARIANT_FOR_CONSTRUCTION: Record<HomeConstructionType, HomeVisualVariant> = {
  kit: "steel-kit",
  modular: "folding-modular",
  "3d-printed": "printed-earth",
};

export type Refusal = { ok: false; problem: string };

export function validateHomeVisual(value: unknown): { ok: true; visual: HomeVisual } | Refusal {
  if (!isObject(value)) return { ok: false, problem: "visual is not a record." };
  if (!VISUAL_VARIANTS.includes(value.variant as HomeVisualVariant))
    return { ok: false, problem: "visual.variant does not name an Aura drawing." };
  if (!filled(value.label)) return { ok: false, problem: "visual.label is missing." };
  if (value.kind === "aura-illustrative")
    return { ok: true, visual: value as unknown as AuraIllustrativeVisual };
  if (value.kind !== "licensed-photo")
    return { ok: false, problem: "visual.kind is not a supported visual." };
  if (!filled(value.url))
    return { ok: false, problem: "visual.url is missing — a licensed photo needs a file we serve." };
  if (!filled(value.credit))
    return { ok: false, problem: "visual.credit is missing — a photo with no credit cannot ship." };
  if (!filled(value.license))
    return { ok: false, problem: "visual.license is missing — name the licence or do not publish the photo." };
  if (!filled(value.permissionRef))
    return {
      ok: false,
      problem: "visual.permissionRef is missing — a photo with no recorded permission cannot ship.",
    };
  const collectedAt = value.collectedAtISO;
  const expiresAt = value.expiresAtISO;
  if (!validISO(collectedAt))
    return { ok: false, problem: "visual.collectedAtISO is missing or unparseable." };
  if (!validISO(expiresAt))
    return {
      ok: false,
      problem: "visual.expiresAtISO is missing or unparseable — a permission with no end is not a permission.",
    };
  if (Date.parse(expiresAt) <= Date.parse(collectedAt))
    return { ok: false, problem: "visual.expiresAtISO is not after visual.collectedAtISO." };
  return { ok: true, visual: value as unknown as LicensedPhotoVisual };
}

export function validateNumericPrice(value: unknown): { ok: true; price: NumericPrice } | Refusal {
  if (!isObject(value)) return { ok: false, problem: "price.numeric is not a record." };
  const amount = value.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)
    return { ok: false, problem: "price.numeric.amount is not a positive finite number." };
  if (typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency))
    return { ok: false, problem: "price.numeric.currency is not an ISO 4217 code." };
  if (!validISO(value.asOfISO))
    return { ok: false, problem: "price.numeric.asOfISO is missing — an undated price is a rumour." };
  if (!PRICE_BASES.includes(value.basis as PriceBasis))
    return { ok: false, problem: "price.numeric.basis does not say where the number came from." };
  return { ok: true, price: value as unknown as NumericPrice };
}

export function validateHomeGeography(
  value: unknown,
): { ok: true; geography: HomeGeography } | Refusal {
  if (!isObject(value)) return { ok: false, problem: "geography is not a record." };
  if (typeof value.country !== "string" || !/^[A-Z]{2}$/.test(value.country))
    return { ok: false, problem: "geography.country is not an ISO 3166-1 alpha-2 code." };
  if (value.provinceState !== null && !filled(value.provinceState))
    return { ok: false, problem: "geography.provinceState must be a name or an explicit null." };
  if (!("lat" in value) || !("lng" in value))
    return { ok: false, problem: "geography must state lat and lng, using null where unknown." };
  const lat = value.lat;
  const lng = value.lng;
  if ((lat === null) !== (lng === null))
    return { ok: false, problem: "geography needs both lat and lng or neither — half a coordinate is a guess." };
  if (lat !== null) {
    if (typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90)
      return { ok: false, problem: "geography.lat is outside -90..90." };
    if (typeof lng !== "number" || !Number.isFinite(lng) || Math.abs(lng) > 180)
      return { ok: false, problem: "geography.lng is outside -180..180." };
  }
  return { ok: true, geography: value as unknown as HomeGeography };
}

/** The whole record, checked at its evidence-bearing seams. It does not
 *  re-parse the legacy prose fields — those are authored in this module and
 *  covered by the catalog spec — it refuses the ways a rights or pricing
 *  claim can arrive unsupported. */
export function validateFinishedHomeModel(
  value: unknown,
): { ok: true; home: FinishedHomeModel } | Refusal {
  if (!isObject(value)) return { ok: false, problem: "home model is not a record." };
  if (!filled(value.id) || !filled(value.model) || !filled(value.maker))
    return { ok: false, problem: "home model identity is incomplete." };
  const visual = validateHomeVisual(value.visual);
  if (!visual.ok) return visual;
  const price = value.price;
  if (!isObject(price)) return { ok: false, problem: "home model price is missing." };
  if ("numeric" in price) {
    const numeric = validateNumericPrice(price.numeric);
    if (!numeric.ok) return numeric;
    const derived = formatNumericPrice(numeric.price);
    if (price.amountText !== null && price.amountText !== derived)
      return {
        ok: false,
        problem: `price.amountText retypes the amount; it must read "${derived}" or be null.`,
      };
  }
  if ("geography" in value) {
    const geography = validateHomeGeography(value.geography);
    if (!geography.ok) return geography;
  }
  return { ok: true, home: value as unknown as FinishedHomeModel };
}

/** The one place a numeric price becomes words. */
export function formatNumericPrice(price: NumericPrice): string {
  return `${price.currency} ${price.amount.toLocaleString("en-CA", {
    maximumFractionDigits: 2,
  })} as of ${price.asOfISO.slice(0, 10)}`;
}

export function permissionIsCurrent(visual: LicensedPhotoVisual, now: Date): boolean {
  const expiresAt = Date.parse(visual.expiresAtISO);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

/** What the card must draw. A licensed photo renders only while its written
 *  permission both validates and is unexpired; on a lapse — or on a record
 *  that never carried provenance — this falls back to the drawing the photo
 *  stood in front of. A photo cannot outlive the permission that allowed it,
 *  and no caller has to remember to check. */
export function resolveHomeVisual(home: FinishedHomeModel, now: Date): HomeVisual {
  const visual = home.visual;
  if (visual.kind === "aura-illustrative") return visual;
  const checked = validateHomeVisual(visual);
  if (checked.ok && permissionIsCurrent(visual, now)) return visual;
  return {
    kind: "aura-illustrative",
    variant: VISUAL_VARIANTS.includes(visual.variant)
      ? visual.variant
      : VARIANT_FOR_CONSTRUCTION[home.constructionType],
    label: ILLUSTRATIVE_VISUAL_LABEL,
  };
}

/* -------------------------------------------------- mapping from research */

const EVIDENCE_SHELF_LIFE_MS = 90 * 24 * 60 * 60 * 1000;

function legacyByName(name: string): Provider {
  const found = PROVIDERS.find((provider) => provider.name === name);
  if (!found) throw new Error(`The research record has no provider named ${name}.`);
  return found;
}

function sourcesFor(provider: Provider): HomeSource[] {
  const expiresAtISO = new Date(
    Date.parse(provider.evidenceCheckedAtISO) + EVIDENCE_SHELF_LIFE_MS,
  ).toISOString();
  return [
    {
      label: "Acceptance evidence",
      url: provider.evidenceUrl,
      collectedAtISO: provider.evidenceCheckedAtISO,
      expiresAtISO,
    },
    {
      label: "Maker site",
      url: provider.url,
      collectedAtISO: provider.evidenceCheckedAtISO,
      expiresAtISO,
    },
  ];
}

function quoteRequiredPrice(note: string): FinishedHomeModel["price"] {
  return {
    state: "quote-required",
    amountText: null,
    includes: [],
    excludes: [],
    note,
  };
}

/** Built from the legacy research at module load so the words on a card can
 *  never drift from the record they cite. Only records that genuinely
 *  describe a finished home a person could order become models. */
export function buildFinishedHomeModels(): FinishedHomeModel[] {
  const boxabl = legacyByName("BOXABL");
  const libwork = legacyByName("Lib Work Co., Ltd. (TSE: 1431)");

  return [
    {
      id: manufacturerSubjectId(boxabl),
      model: "Casita foldable factory-built unit",
      maker: "BOXABL",
      makerCountry: boxabl.country,
      makerUrl: boxabl.url,
      marketStatus: "current-maker-model",
      visual: {
        kind: "aura-illustrative",
        variant: "folding-modular",
        label: ILLUSTRATIVE_VISUAL_LABEL,
      },
      sizeSqFt: { value: null, note: NOT_IN_RECORD },
      bedrooms: { value: null, note: NOT_IN_RECORD },
      constructionType: "modular",
      customization:
        "Factory-built folding units shipped by road; configuration options are not in the research record — ask the maker.",
      price: quoteRequiredPrice(
        "The research record contains no published price. What a quote includes and excludes is defined by the written quote itself.",
      ),
      delivery: { confirmed: ["united-states"], askMaker: ["canada", "other"] },
      certifications: [],
      sources: sourcesFor(boxabl),
      paymentResearch: {
        cashCard:
          "No checkout or payment mechanics are disclosed anywhere in the research record.",
        crypto:
          "A May 2025 treasury press release says 'cryptocurrencies' in a single passing clause and names no coin; the maker's own FAQ is silent. USDC is not named.",
      },
      unresolved: [
        "Canadian delivery, duty and code compliance are open questions — no Canadian delivery statement was found.",
        "No coin is named and no payment mechanics exist beyond the announcement.",
      ],
      caveat: boxabl.caveat,
      quotedClaim: boxabl.quote,
      legacyProviderName: boxabl.name,
    },
    {
      id: manufacturerSubjectId(libwork),
      model: "Lib Earth House model B",
      maker: "Lib Work Co., Ltd.",
      makerCountry: libwork.country,
      makerUrl: libwork.url,
      marketStatus: "announced-concept",
      visual: {
        kind: "aura-illustrative",
        variant: "printed-earth",
        label: ILLUSTRATIVE_VISUAL_LABEL,
      },
      sizeSqFt: { value: null, note: NOT_IN_RECORD },
      bedrooms: { value: null, note: NOT_IN_RECORD },
      constructionType: "3d-printed",
      customization:
        "A 3D-printed earth home built from natural materials; the maker announced plans to issue the design data as an NFT, but options and variants are not in the research record.",
      price: quoteRequiredPrice(
        "No price is published. What a quote includes and excludes is defined by the written quote itself.",
      ),
      delivery: { confirmed: ["japan"], askMaker: [] },
      certifications: [],
      sources: sourcesFor(libwork),
      paymentResearch: {
        cashCard:
          "A Japanese domestic housing product; payment mechanics are not in the research record.",
        crypto:
          "BTC settlement was announced as a future sales concept, not a live rail; the maker's own homepage mentions none of it today. USDC is not named.",
      },
      unresolved: [
        "Whether the announced January 2026 order launch actually shipped is unverified.",
        "The maker's crypto holding policy 'remains undecided at this time' in its own release.",
      ],
      caveat: libwork.caveat,
      quotedClaim: libwork.quote,
      legacyProviderName: libwork.name,
    },
  ];
}

export const FINISHED_HOME_MODELS: FinishedHomeModel[] = buildFinishedHomeModels();

export const homeById = (id: string): FinishedHomeModel | undefined =>
  FINISHED_HOME_MODELS.find((home) => home.id === id);

/* --------------------------------------------------------- card hierarchy */

/** The card renders exactly these slots, top to bottom. The Playwright spec
 *  asserts the order against the component source and the DOM. */
export const HOME_CARD_SLOTS = [
  "home-visual",
  "home-identity",
  "home-price",
  "home-delivery",
  "home-size",
  "home-actions",
] as const;

export function priceLine(home: FinishedHomeModel): string {
  if (home.price.state !== "published") return MISSING_PRICE_SENTENCE;
  /* The numeric price is the anchored source when one exists, so the line a
     reader sees is derived rather than retyped. Records without one keep
     rendering their authored amountText exactly as before. */
  if (home.price.numeric) return formatNumericPrice(home.price.numeric);
  return home.price.amountText ? home.price.amountText : MISSING_PRICE_SENTENCE;
}

export function deliveryStateFor(home: FinishedHomeModel, region: TargetRegion): DeliveryState {
  if (region === "any") return "confirmed";
  if (home.delivery.confirmed.includes(region)) return "confirmed";
  if (home.delivery.askMaker.includes(region)) return "ask-maker";
  return "unavailable";
}

export function deliverySummary(home: FinishedHomeModel): string {
  const parts: string[] = [];
  if (home.delivery.confirmed.length > 0)
    parts.push(`Confirmed: ${home.delivery.confirmed.map((region) => REGION_LABELS[region]).join(", ")}`);
  if (home.delivery.askMaker.length > 0)
    parts.push(`Ask the maker: ${home.delivery.askMaker.map((region) => REGION_LABELS[region]).join(", ")}`);
  parts.push("Elsewhere: not available");
  return parts.join(" · ");
}

export function sizeLine(home: FinishedHomeModel): string {
  return home.sizeSqFt.value === null
    ? home.sizeSqFt.note
    : `${home.sizeSqFt.value.toLocaleString("en-CA")} sq ft`;
}

export function bedroomsLine(home: FinishedHomeModel): string {
  return home.bedrooms.value === null
    ? home.bedrooms.note
    : `${home.bedrooms.value} bedroom${home.bedrooms.value === 1 ? "" : "s"}`;
}

/* ----------------------------------------------------------------- filters */

export type SizeBand = "any" | "under-500" | "500-1500" | "over-1500";
export type BedroomsFilter = "any" | "1" | "2" | "3-plus";
export type PriceFilter = "any" | "published" | "quote-required";

export interface CatalogFilters {
  destination: TargetRegion;
  size: SizeBand;
  bedrooms: BedroomsFilter;
  construction: "any" | HomeConstructionType;
  price: PriceFilter;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  destination: "any",
  size: "any",
  bedrooms: "any",
  construction: "any",
  price: "any",
};

function sizeMatches(home: FinishedHomeModel, band: SizeBand): boolean {
  if (band === "any") return true;
  const value = home.sizeSqFt.value;
  /* A home with no recorded size is EXCLUDED from a specific size filter —
     matching it would silently promote "unknown" to "fits". The UI states
     how many homes were hidden for missing data. */
  if (value === null) return false;
  if (band === "under-500") return value < 500;
  if (band === "500-1500") return value >= 500 && value <= 1500;
  return value > 1500;
}

function bedroomsMatch(home: FinishedHomeModel, filter: BedroomsFilter): boolean {
  if (filter === "any") return true;
  const value = home.bedrooms.value;
  if (value === null) return false;
  if (filter === "3-plus") return value >= 3;
  return value === Number(filter);
}

export function filterHomes(
  homes: readonly FinishedHomeModel[],
  filters: CatalogFilters,
): FinishedHomeModel[] {
  return homes.filter(
    (home) =>
      deliveryStateFor(home, filters.destination) !== "unavailable" &&
      sizeMatches(home, filters.size) &&
      bedroomsMatch(home, filters.bedrooms) &&
      (filters.construction === "any" || home.constructionType === filters.construction) &&
      (filters.price === "any" || home.price.state === filters.price),
  );
}

/** How many homes a size/bedrooms filter hid only because the record holds
 *  no value — surfaced so a narrowed list never quietly loses homes. */
export function hiddenForMissingData(
  homes: readonly FinishedHomeModel[],
  filters: CatalogFilters,
): number {
  if (filters.size === "any" && filters.bedrooms === "any") return 0;
  return homes.filter(
    (home) =>
      deliveryStateFor(home, filters.destination) !== "unavailable" &&
      (filters.construction === "any" || home.constructionType === filters.construction) &&
      (filters.price === "any" || home.price.state === filters.price) &&
      ((filters.size !== "any" && home.sizeSqFt.value === null) ||
        (filters.bedrooms !== "any" && home.bedrooms.value === null)),
  ).length;
}

/* ----------------------------------------------------------------- compare */

export const COMPARE_LIMIT = 3;

/** Toggle a home in the compare set. Adding beyond the cap is a no-op —
 *  the UI shows the cap instead of silently evicting a selection. */
export function toggleCompare(current: readonly string[], id: string): string[] {
  if (current.includes(id)) return current.filter((item) => item !== id);
  if (current.length >= COMPARE_LIMIT) return [...current];
  return [...current, id];
}

/* ------------------------------------------------------- payment methods */

export interface PaymentMethodOption {
  id: "cash-card" | "xlayer-usdc";
  label: string;
  /** Honesty horizon: nothing on this page implies a live crypto rail. */
  horizon: "Today" | "Next" | "Future";
  availability: "confirm-on-quote" | "unavailable";
  detail: string;
  preselected: false;
}

export const PAYMENT_WAIT_SENTENCE =
  "Payment options appear beside a written quote — none exists for this home yet.";

/** Both options, side by side, only once a real quote exists. Neither is
 *  hidden, neither is preselected, and an unavailable path says so. */
export function paymentMethodOptions(
  home: FinishedHomeModel,
  quoteExists: boolean,
): PaymentMethodOption[] {
  if (!quoteExists) return [];
  return [
    {
      id: "cash-card",
      label: "Cash or card",
      horizon: "Today",
      availability: "confirm-on-quote",
      detail: `Settled on the maker's own paperwork. ${home.paymentResearch.cashCard}`,
      preselected: false,
    },
    {
      id: "xlayer-usdc",
      label: "X Layer USDC",
      horizon: "Future",
      availability: "unavailable",
      detail: `Not offered by this maker today. ${home.paymentResearch.crypto}`,
      preselected: false,
    },
  ];
}

/* ------------------------------------------- project wiring (AuraProject) */

export interface HomeProjectState {
  hasProject: boolean;
  saved: boolean;
  inquiries: ManufacturerInquiry[];
  latestInquiry: ManufacturerInquiry | null;
  quotes: ProjectQuote[];
  hasRealQuote: boolean;
}

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");

/** A captured quote belongs to this home's maker when either normalized
 *  name contains the other ("Lib Work" typed by hand still matches
 *  "Lib Work Co., Ltd."). Both sides must be substantial enough that a
 *  two-letter vendor never matches everything. */
export function vendorMatchesMaker(vendorName: string, home: FinishedHomeModel): boolean {
  const vendor = normalize(vendorName);
  const maker = normalize(home.maker);
  if (vendor.length < 4 || maker.length < 4) return vendor === maker;
  return vendor.includes(maker) || maker.includes(vendor);
}

export function homeProjectState(
  project: AuraProject | null,
  home: FinishedHomeModel,
): HomeProjectState {
  if (!project) {
    return { hasProject: false, saved: false, inquiries: [], latestInquiry: null, quotes: [], hasRealQuote: false };
  }
  const inquiries = project.delivery.rfqs
    .flatMap((value) => {
      const checked = validateManufacturerInquiry(value);
      return checked.ok ? [checked.inquiry] : [];
    })
    .filter((inquiry) => inquiry.providerSubjectId === home.id);
  const quotes = projectQuotesFromUnknown(project.delivery.quotes).filter((quote) =>
    vendorMatchesMaker(quote.vendorName, home),
  );
  return {
    hasProject: true,
    saved: project.discovery.manufacturers.shortlist.includes(home.id),
    inquiries,
    latestInquiry: inquiries.at(-1) ?? null,
    quotes,
    hasRealQuote: quotes.length > 0,
  };
}

/** Save/unsave a home on the project shortlist, recording the dated,
 *  linked evidence alongside it (access "external", never "verified"). */
export function withHomeSaved(
  project: AuraProject,
  home: FinishedHomeModel,
  selected: boolean,
  at: Date,
): AuraProject {
  const evidence = home.sources[0];
  const withRecord = selected
    ? upsertProjectDiscoveryRecord(
        project,
        "manufacturers",
        createDiscoveryRecord({
          id: `record-${home.id}`,
          subjectId: home.id,
          access: "external",
          sourceLabel: "Research record — finished home model",
          sourceUrl: evidence.url,
          collectedAtISO: evidence.collectedAtISO,
          expiresAtISO: evidence.expiresAtISO,
          confidence: "source-checked",
          data: { finishedHomeModel: home },
        }),
        at,
      )
    : project;
  return setProjectShortlist(withRecord, "manufacturers", home.id, selected, at);
}

function purchaseProductFor(home: FinishedHomeModel): PurchaseProduct {
  return home.constructionType === "kit"
    ? "kit-home"
    : home.constructionType === "modular"
      ? "modular-home"
      : "eco-home";
}

/** Request a quote: shortlist the home if it is not already saved, then
 *  append a hash-bound inquiry to the project's RFQs via the existing
 *  lib/project API. The inquiry binds the current design hash; nothing
 *  here fabricates a quote or advances journey progress. */
export function withHomeQuoteRequested(
  project: AuraProject,
  home: FinishedHomeModel,
  destination: TargetRegion,
  at: Date,
  id?: string,
): AuraProject {
  const saved = project.discovery.manufacturers.shortlist.includes(home.id)
    ? project
    : withHomeSaved(project, home, true, at);
  const legacy = legacyByName(home.legacyProviderName);
  const product = purchaseProductFor(home);
  const inquiry = createManufacturerInquiry({
    id: id ?? `inquiry-${home.id}-${at.getTime().toString(36)}`,
    project: saved,
    provider: legacy,
    readiness: providerPurchaseReadiness(legacy, { targetRegion: destination, product }),
    targetRegion: destination,
    product,
    createdAtISO: at.toISOString(),
  });
  return {
    ...saved,
    updatedAtISO: at.toISOString(),
    delivery: { ...saved.delivery, rfqs: [...saved.delivery.rfqs, inquiry] },
  };
}
