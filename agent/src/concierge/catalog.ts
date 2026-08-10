// The three-home catalog stub — the single source of truth for both the agent
// concierge and the app's catalog/concierge pages (import from here, never
// hand-mirror). Exactly three homes (PHASED-ROADMAP Phase 1A): a factory-unit
// entry, the Aura SIP flagship, and a larger Aura SIP that clears the 1,076
// sqft Country Residential minimum — the "larger home" arm of the refusal.
//
// HONESTY CONSTRAINT (docs/PHASED-ROADMAP.md "The honesty constraint"):
// no partner is signed and nothing here may imply one. Factory units are
// reference designs priced from PUBLISHED sources, each with its link, and the
// manufacturers are named as TARGETS. Aura designs are priced LIVE from
// data/alberta/cost-model.json through the existing pipeline — never a copied
// number, so catalog prices cannot drift from the model.
//
// This module is PURE (no fs, no env, no network) so the Next.js app can
// import it client-side. Callers supply the cost model (the agent loads
// data/alberta/cost-model.json; the app can `import costModel from
// "@/data/alberta/cost-model.json"`).

import { designBriefToBudget, questionnaireToDesignBrief, budgetToMilestones } from "../pipeline";
import { Budget, BuildPlan, CostModelInput, Questionnaire } from "../types";

/** How a catalog home gets its price. */
export type CatalogPricing =
  | {
      kind: "published";
      /** Published base price in USD, exactly as the source lists it. */
      baseUsd: number;
      url: string;
      basis: string;
    }
  | {
      kind: "costModel";
      /** Priced live via the pipeline; see priceCatalogHome(). */
      basis: string;
    };

export type FulfillmentMode = "factory-unit" | "sip-site-built";

export interface CatalogHome {
  id: string;
  name: string;
  tagline: string;
  sizeSqft: number;
  storeys: 1 | 2;
  bedrooms: number;
  bathrooms: number;
  fulfillment: FulfillmentMode;
  pricing: CatalogPricing;
  /** What the price actually covers — the question the category refuses to answer. */
  included: string[];
  notIncluded: string[];
  /** Honest lead-time statement, volunteered before anyone asks. */
  leadTime: string;
}

/**
 * Visible partner state (docs/research/RETAIL-PARTNERS-USDC.md): naming a
 * manufacturer as a TARGET is true and interesting; naming it as a partner is
 * neither. Render this verbatim wherever a factory unit is shown.
 */
export const PARTNER_STATE = {
  signed: [] as string[],
  targets: ["Boxabl", "Nestron", "Honomobo (Edmonton)"],
  line: "Partners signed: none. Manufacturer targets identified: Boxabl, Nestron, Honomobo (Edmonton).",
};

export const CATALOG: CatalogHome[] = [
  {
    id: "casita-fold-375",
    name: "Casita-class folding unit",
    tagline: "The factory entry point — a folding unit trucked in and set in a day.",
    sizeSqft: 375,
    storeys: 1,
    bedrooms: 1,
    bathrooms: 1,
    fulfillment: "factory-unit",
    pricing: {
      kind: "published",
      baseUsd: 49_500,
      url: "https://www.boxabl.com/order",
      basis:
        "Reference design priced from the manufacturer's published base price " +
        "(Boxabl Casita, 375 sqft, US$49,500 base — boxabl.com/order, Aug 2026). " +
        "Target manufacturer, not a partner.",
    },
    included: [
      "The factory-built unit itself: shell, interior finishes, kitchen, bath",
      "Folding transport form factor (standard truck, no oversize permit)",
    ],
    notIncluded: [
      "Land, foundation, siting and crane day",
      "Utility connections or off-grid systems (solar, battery, water, septic)",
      "Permits, delivery freight, and taxes",
    ],
    leadTime: "Factory production slot set at deposit; delivery scheduling follows the queue.",
  },
  {
    id: "aura-sip-800",
    name: "Aura SIP 800",
    tagline: "The flagship — 800 sqft off-grid SIP cabin, priced line by line from Alberta suppliers.",
    sizeSqft: 800,
    storeys: 1,
    bedrooms: 2,
    bathrooms: 1,
    fulfillment: "sip-site-built",
    pricing: {
      kind: "costModel",
      basis:
        "Priced live from data/alberta/cost-model.json (LOW/MID/HIGH, per-line basis published). " +
        "The 800 sqft reference home: totals reconcile to the file to the dollar.",
    },
    included: [
      "Complete line-item budget: site work, screw piles, SIP shell, roof/windows/doors, interior",
      "Off-grid systems: solar + battery + generator, cistern, AWG summer module, septic",
      "Permits, design, engineering, and contingency — every line with its basis",
    ],
    notIncluded: [
      "Land (shown as an informational line, excluded from totals)",
      "GST and financing costs",
    ],
    leadTime:
      "SIP kits are 12-20 weeks from approved drawings — the clock starts at the panel order, " +
      "and electrical chases freeze at panel fabrication.",
  },
  {
    id: "aura-sip-1200",
    name: "Aura SIP 1200",
    tagline:
      "The family plan — 1,200 sqft storey-and-a-half; clears the 1,076 sqft Country Residential minimum.",
    sizeSqft: 1200,
    storeys: 2,
    bedrooms: 3,
    bathrooms: 2,
    fulfillment: "sip-site-built",
    pricing: {
      kind: "costModel",
      basis:
        "Priced live from data/alberta/cost-model.json with the pipeline's size scaling " +
        "(SIP shell, roof/windows/doors, and interior scale with floor area; site services and " +
        "soft costs do not).",
    },
    included: [
      "Same full line set as the Aura SIP 800, scaled to 1,200 sqft",
      "Off-grid systems sized by the winter-load rules (battery floor, mandatory generator)",
    ],
    notIncluded: ["Land (informational line, excluded from totals)", "GST and financing costs"],
    leadTime:
      "SIP kits are 12-20 weeks from approved drawings — the clock starts at the panel order.",
  },
];

export function findHome(id: string): CatalogHome | undefined {
  return CATALOG.find((h) => h.id === id);
}

/**
 * Builds the pipeline questionnaire for an Aura SIP catalog home: the base
 * questionnaire (the bundled 800 sqft sample spec) with the home's size,
 * storeys, and rooms swapped in. Parcel fields are overlaid separately by the
 * reducer once a parcel is chosen.
 */
export function catalogQuestionnaire(home: CatalogHome, base: Questionnaire): Questionnaire {
  return {
    ...base,
    projectName: `${home.name} — Aura order`,
    home: {
      ...base.home,
      sizeSqft: home.sizeSqft,
      storeys: home.storeys,
      bedrooms: home.bedrooms,
      bathrooms: home.bathrooms,
    },
  };
}

export interface CatalogPrice {
  kind: CatalogPricing["kind"];
  /** Present for cost-model homes: the full LOW/MID/HIGH budget. */
  budget?: Budget;
  /** Present for cost-model homes: the escrow milestone schedule (MID column). */
  plan?: BuildPlan;
  /** Present for published-price homes. */
  baseUsd?: number;
  basis: string;
}

/**
 * Prices a catalog home. Cost-model homes run the REAL pipeline (never a
 * copied total — the number on the card is the number in the model). Published
 * homes return the source price as published.
 */
export function priceCatalogHome(
  home: CatalogHome,
  base: Questionnaire,
  model: CostModelInput
): CatalogPrice {
  if (home.pricing.kind === "published") {
    return { kind: "published", baseUsd: home.pricing.baseUsd, basis: home.pricing.basis };
  }
  const q = catalogQuestionnaire(home, base);
  const brief = questionnaireToDesignBrief(q);
  const budget = designBriefToBudget(brief, model, q.contingencyRate);
  const plan = budgetToMilestones(budget, q.projectName);
  return { kind: "costModel", budget, plan, basis: home.pricing.basis };
}
