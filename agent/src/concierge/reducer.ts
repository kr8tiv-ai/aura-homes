// The concierge reducer: reduce(order, intent, ctx) -> { order, reply, actions }.
//
// OFFLINE-DETERMINISTIC by design: no network, no model call, no ambient
// clock — every reply is composed from the REAL data (parcel verdicts from
// ../parcels, budgets/milestones from ../pipeline, the catalog from
// ./catalog). Free-text questions get a deterministic answer here; the
// OPTIONAL model upgrade lives in ./assist.ts (claude.ts pattern: key present
// -> model, key absent or any failure -> this module's answer verbatim), so
// the demo never breaks without a key.
//
// The refusal is the centrepiece: selecting a parcel whose district minimum
// forbids the chosen design returns a quotable NO with the bylaw citation,
// the specific numbers, and a constructive next step (parcels that PASS, or a
// larger home) — computed, never hard-coded.

import { filterParcels } from "../parcels";
import {
  budgetToMilestones,
  designBriefToBudget,
  questionnaireToDesignBrief,
} from "../pipeline";
import {
  CostModelInput,
  ParcelListing,
  Questionnaire,
} from "../types";
import {
  CATALOG,
  CatalogHome,
  PARTNER_STATE,
  catalogQuestionnaire,
  findHome,
} from "./catalog";
import {
  FACTORY_DEPOSIT_MIN_USD,
  FACTORY_DEPOSIT_RATE,
  QUOTE_VALIDITY_DAYS,
  NATIVE_USDC_TESTNET,
  Order,
  BuilderOrderHomeChoice,
  OrderHomeChoice,
  OrderQuote,
  ParcelChoice,
  REFUND_WINDOW_HOURS_DEFAULT,
  RegistryStatus,
  DEMO_USD_PER_CAD,
  X_LAYER_TESTNET,
  cadToUsd,
  deriveCheckpointStatus,
  fmtCad,
  fmtUsd,
  fmtUsdc6,
  refundHoursLeft,
  refundWindowOpen,
  usdToUsdc6,
  withEvent,
} from "./order";

// ---------------------------------------------------------------- intents

export type ConciergeIntent =
  | { type: "askAbout"; question: string }
  | { type: "listHomes" }
  | { type: "listParcels" }
  | { type: "selectHome"; homeId: string }
  | { type: "selectBuilderHome"; home: BuilderOrderHomeChoice }
  | { type: "selectParcel"; parcelId: string }
  | { type: "requestQuote" }
  | { type: "placeDeposit" }
  | { type: "confirmDeposit"; txRef?: string }
  | { type: "requestRefund" }
  /** Clock check: closes the refund window when the deadline has passed. */
  | { type: "tick" }
  | { type: "startBuild" };

// ---------------------------------------------------------------- actions

/** Typed side effects for the app (chat UI, land gate, buy flow) to execute. */
export type ConciergeAction =
  | { type: "disableBuy"; reason: string }
  | { type: "enableBuy" }
  | { type: "approveUsdc"; amountUsdc6: string; asset: string; network: string }
  | { type: "fundMilestone"; milestoneIndex: 0; amountUsdc6: string }
  | { type: "updateRegistry"; status: RegistryStatus }
  | { type: "startRefundCountdown"; deadlineISO: string }
  | { type: "refundDeposit" };

export interface ReduceResult {
  order: Order;
  reply: string;
  actions: ConciergeAction[];
}

// ---------------------------------------------------------------- context

/**
 * Everything the reducer needs, injected: the clock, the parcel inventory,
 * the base questionnaire (the bundled 800 sqft sample spec), and the cost
 * model. The agent CLI/MCP load these from samples/ and data/alberta/; the
 * app passes its own imports of the SAME files.
 */
export interface ConciergeContext {
  now: Date;
  parcels: ParcelListing[];
  questionnaire: Questionnaire;
  costModel: CostModelInput;
  /** data/alberta/cost-model.json totalsExLand, for the reconciliation check. */
  fileTotalsExLand?: { low: number; mid: number; high: number };
  refundWindowHours?: number;
}

// ---------------------------------------------------------------- reduce

export function reduce(order: Order, intent: ConciergeIntent, ctx: ConciergeContext): ReduceResult {
  if (order.status === "refunded") {
    return unchanged(
      order,
      `This order was refunded in full on ${order.deposit?.refundedAtISO?.slice(0, 10)} and is closed. ` +
        `Start a new order any time — the land gate and the numbers will be waiting.`
    );
  }

  switch (intent.type) {
    case "askAbout":
      return handleAskAbout(order, intent.question, ctx);
    case "listHomes":
      return handleListHomes(order, ctx);
    case "listParcels":
      return handleListParcels(order, ctx);
    case "selectHome":
      return handleSelectHome(order, intent.homeId, ctx);
    case "selectBuilderHome":
      return handleSelectBuilderHome(order, intent.home, ctx);
    case "selectParcel":
      return handleSelectParcel(order, intent.parcelId, ctx);
    case "requestQuote":
      return handleRequestQuote(order, ctx);
    case "placeDeposit":
      return handlePlaceDeposit(order, ctx);
    case "confirmDeposit":
      return handleConfirmDeposit(order, intent.txRef, ctx);
    case "requestRefund":
      return handleRequestRefund(order, ctx);
    case "tick":
      return handleTick(order, ctx);
    case "startBuild":
      return handleStartBuild(order, ctx);
  }
}

/** Invalid-for-this-state intents leave the order untouched. */
function unchanged(order: Order, reply: string, actions: ConciergeAction[] = []): ReduceResult {
  return { order, reply, actions };
}

// ---------------------------------------------------------------- askAbout

const SQFT_RE = /(\d{3,4})\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)/i;

function handleAskAbout(order: Order, question: string, ctx: ConciergeContext): ReduceResult {
  let next = order;
  const sqftMatch = SQFT_RE.exec(question);
  if (sqftMatch && !next.home) {
    next = { ...next, desiredSizeSqft: Number(sqftMatch[1]) };
  }
  next = withEvent(next, ctx.now, "questionAsked", `Buyer asked: ${question}`);
  const answer = offlineAnswer(next, question, ctx);
  return { order: next, reply: answer, actions: [] };
}

/**
 * Deterministic answers from the real data — the offline path ./assist.ts
 * falls back to, and the only path the scripted demo uses.
 */
export function offlineAnswer(order: Order, question: string, ctx: ConciergeContext): string {
  const q = question.toLowerCase();
  const landFirstNudge = order.parcel
    ? ""
    : "\n\nFirst question either way: where will it sit? The district bylaw decides what you may " +
      "build before you pick a floor plan — ask me to list parcels.";

  if (/(included|include|what.*in the price|cover)/.test(q)) {
    return (
      "Plainly, because this category refuses to answer it: an Aura SIP price includes the full " +
      "line-item budget — site work, screw-pile foundation, SIP shell, roof/windows/doors, interior " +
      "fit-out, mechanical, solar + battery + generator, water with the AWG summer module, septic, " +
      "and permits/design/engineering — each line published with its LOW/MID/HIGH range and basis. " +
      "It does NOT include land (shown as an informational line, excluded from totals) or GST. " +
      "Factory units include the unit only: land, foundation, siting, utilities, and permits are " +
      "extra, and I will say so before you pay anything. SIP kits run 12-20 weeks from approved " +
      "drawings — I volunteer that now, not after your deposit." +
      landFirstNudge
    );
  }
  if (/(lead.?time|how long|timeline|when.*(ready|done|built))/.test(q)) {
    return (
      "Honest lead times: SIP panel kits are 12-20 weeks from APPROVED drawings — the clock starts " +
      "at the panel order, and the electrical layout freezes at panel fabrication. Screw-pile " +
      "foundations install year-round, frozen ground included, with no 28-day concrete cure. " +
      "Factory units run on production-slot queues set at deposit." + landFirstNudge
    );
  }
  if (/(refund|cooling|cancel|change my mind|back out)/.test(q)) {
    const hours = order.quote?.refundWindowHours ?? ctx.refundWindowHours ?? REFUND_WINDOW_HOURS_DEFAULT;
    return (
      `The reservation deposit has a ${hours}-hour cooling-off window: inside it, you alone can pull ` +
      "the full deposit back — no counterparty approval, enforced by the escrow contract's " +
      "refundDeposit() path, not by a support ticket. After the window closes the deposit converts " +
      "into the first funded milestone of your build."
    );
  }
  if (/(holdback|lien|10\s*%|construction act)/.test(q)) {
    return (
      "Alberta's Prompt Payment and Construction Lien Act sets a 10% statutory holdback: every " +
      "milestone release pays the builder 90% and retains 10% in escrow, releasable only after the " +
      "60-day lien period runs. In an Aura order that is contract state with a maturity timer, " +
      "not a promise in the fine print."
    );
  }
  if (/(changenow|global.*buy|buy.*manufacturer|manufacturer.*crypto|third.party.*purchase)/.test(q)) {
    return (
      "For a third-party manufacturer purchase, I guide rather than transact: first confirm the " +
      "legal seller, product, destination, code path, written price and delivery terms; then verify " +
      "the exact native X Layer USDC contract and a live conversion pair; finally obtain a fresh " +
      "quote, independently confirm the seller's receiving network/address and send a test amount. " +
      "The ChangeNOW partner API is not connected in this static build, and its credential must " +
      "never be exposed in the browser. Aura's X Layer testnet escrow is a separate build-order " +
      "demo and does not protect a purchase from an outside manufacturer."
    );
  }
  if (/(usdc|crypto|pay|payment|wallet|x layer|stablecoin)/.test(q)) {
    return (
      "Prices are in Canadian dollars; settlement is native Circle USDC on X Layer (testnet 1952 for " +
      `this demo, asset ${NATIVE_USDC_TESTNET}) — never bridged USDC.e. You see the CAD figure and ` +
      "the USDC figure side by side before you approve anything, and every transaction lands on " +
      "OKLink where you can verify it."
    );
  }
  if (/(partner|manufacturer|boxabl|nestron|honomobo)/.test(q)) {
    return (
      PARTNER_STATE.line +
      " Factory units in the catalog are reference designs priced from published sources, each with " +
      "its link. Nothing here implies a signed partner, because none is signed."
    );
  }
  if (/(price|cost|how much|budget)/.test(q)) {
    return (
      "Three homes, three price shapes: the Casita-class folding unit at its published US$49,500 base; " +
      "the Aura SIP 800 and SIP 1200 priced live from the open Alberta cost model — LOW/MID/HIGH per " +
      "line, basis published, land excluded from totals. Pick a home and a parcel and I will quote " +
      "it to the dollar." + landFirstNudge
    );
  }
  return (
    "I can walk you from this question to a funded home: list homes, list parcels, pick both, and " +
    "I will quote the build to the dollar from the open Alberta cost model — and refuse the order, " +
    "with the bylaw citation, if the land cannot legally hold the home." + landFirstNudge
  );
}

// ---------------------------------------------------------------- listings

function handleListHomes(order: Order, ctx: ConciergeContext): ReduceResult {
  const lines = CATALOG.map((h) => {
    const price =
      h.pricing.kind === "published"
        ? `${fmtUsd(h.pricing.baseUsd)} base (published)`
        : priceLineForHome(h, ctx);
    return `  - ${h.id} — ${h.name}, ${h.sizeSqft.toLocaleString("en-CA")} sqft: ${price}`;
  }).join("\n");
  return unchanged(
    order,
    `Exactly three homes — every price either published at the source or computed live from the ` +
      `open Alberta cost model:\n${lines}\n${PARTNER_STATE.line}`
  );
}

function priceLineForHome(h: CatalogHome, ctx: ConciergeContext): string {
  const q = catalogQuestionnaire(h, ctx.questionnaire);
  const budget = designBriefToBudget(questionnaireToDesignBrief(q), ctx.costModel, q.contingencyRate);
  return (
    `LOW ${fmtCad(budget.total.lowCad)} / MID ${fmtCad(budget.total.midCad)} / ` +
    `HIGH ${fmtCad(budget.total.highCad)} ex-land (cost model)`
  );
}

function handleListParcels(order: Order, ctx: ConciergeContext): ReduceResult {
  const sqft = order.home?.sizeSqft ?? order.desiredSizeSqft;
  const verdicts = filterParcels(ctx.parcels, questionnaireAtSize(ctx.questionnaire, sqft));
  const lines = verdicts
    .map(
      (v) =>
        `  - ${v.parcel.id} — ${v.parcel.name} (${v.parcel.district}, ${fmtCad(v.parcel.priceCad)}): ` +
        `${v.verdict} at ${sqft.toLocaleString("en-CA")} sqft`
    )
    .join("\n");
  return unchanged(
    order,
    `Parcels on file, checked against a ${sqft.toLocaleString("en-CA")} sqft design — the district ` +
      `bylaw, not the county, sets the minimum dwelling size:\n${lines}`
  );
}

// ---------------------------------------------------------------- selection

function handleSelectHome(order: Order, homeId: string, ctx: ConciergeContext): ReduceResult {
  if (committed(order)) return alreadyCommitted(order);
  const home = findHome(homeId);
  if (!home) {
    return unchanged(order, `No catalog home with id "${homeId}". Ask me to list homes.`);
  }

  let next: Order = {
    ...order,
    home: {
      kind: "catalog",
      catalogId: home.id,
      name: home.name,
      sizeSqft: home.sizeSqft,
      fulfillment: home.fulfillment,
      atISO: ctx.now.toISOString(),
    },
    desiredSizeSqft: home.sizeSqft,
    quote: undefined, // a new home invalidates any earlier quote
  };
  next = withEvent(next, ctx.now, "homeSelected", `Home selected: ${home.name} (${home.sizeSqft} sqft).`);

  // Re-run the land gate if a parcel is already bound — a smaller home can
  // turn a passing parcel into a rejection, and vice versa.
  if (next.parcel) {
    return evaluateParcel(next, next.parcel.listing, ctx, "re-checked for the new home");
  }

  next = { ...next, status: deriveCheckpointStatus(next) };
  return {
    order: next,
    reply:
      `${home.name} — ${home.tagline}\nIncluded: ${home.included.join("; ")}.\n` +
      `Not included: ${home.notIncluded.join("; ")}.\nLead time: ${home.leadTime}\n` +
      `Now, where will it sit? The district bylaw decides whether this ` +
      `${home.sizeSqft.toLocaleString("en-CA")} sqft design is legal BEFORE you fall for a parcel — ` +
      `ask me to list parcels.`,
    actions: [{ type: "disableBuy", reason: "No parcel selected — the land gate runs first." }],
  };
}

function handleSelectBuilderHome(
  order: Order,
  home: BuilderOrderHomeChoice,
  ctx: ConciergeContext,
): ReduceResult {
  if (committed(order)) return alreadyCommitted(order);
  if (
    home.kind !== "builder" ||
    !home.projectId ||
    !/^0x[0-9a-f]{64}$/.test(home.documentHash) ||
    !home.artifactHashes ||
    home.documentHash !== home.artifactHashes.designDocument ||
    !home.designSummary ||
    !home.quoteBasis ||
    !Array.isArray(home.quoteBasis.assumptions) ||
    !Array.isArray(home.quoteBasis.exclusions) ||
    !Number.isFinite(home.sizeSqft) ||
    home.sizeSqft <= 0
  ) {
    return unchanged(
      order,
      "That builder handoff is incomplete or its design hash does not match. Re-open the design in the builder and continue again; no order was changed.",
    );
  }

  const choice: BuilderOrderHomeChoice = {
    ...home,
    designSummary: { ...home.designSummary },
    artifactHashes: {
      ...home.artifactHashes,
      exports: home.artifactHashes.exports ? { ...home.artifactHashes.exports } : undefined,
    },
    quoteBasis: {
      ...home.quoteBasis,
      assumptions: [...home.quoteBasis.assumptions],
      exclusions: [...home.quoteBasis.exclusions],
    },
  };
  let next: Order = {
    ...order,
    home: choice,
    desiredSizeSqft: choice.sizeSqft,
    quote: undefined,
  };
  next = withEvent(
    next,
    ctx.now,
    "homeSelected",
    `Builder design selected: ${choice.name} (${choice.sizeSqft} sqft; ${choice.documentHash}).`,
  );

  if (next.parcel) {
    return evaluateParcel(next, next.parcel.listing, ctx, "re-checked for the builder design");
  }

  next = { ...next, status: deriveCheckpointStatus(next) };
  return {
    order: next,
    reply:
      `${choice.name} is bound to this order at design hash ${choice.documentHash}. ` +
      `Aura will estimate it from the open Alberta cost model; the result is not a supplier or manufacturing promise. ` +
      `First choose land so the district gate can check the ${choice.sizeSqft.toLocaleString("en-CA")} sqft design.`,
    actions: [{ type: "disableBuy", reason: "No parcel selected — the land gate runs first." }],
  };
}

function handleSelectParcel(order: Order, parcelId: string, ctx: ConciergeContext): ReduceResult {
  if (committed(order)) return alreadyCommitted(order);
  const listing = ctx.parcels.find((p) => p.id === parcelId);
  if (!listing) {
    return unchanged(order, `No parcel with id "${parcelId}" on file. Ask me to list parcels.`);
  }
  return evaluateParcel(order, listing, ctx, "selected");
}

/** Runs the REAL land filter and routes to acceptance or the refusal. */
function evaluateParcel(
  order: Order,
  listing: ParcelListing,
  ctx: ConciergeContext,
  how: string
): ReduceResult {
  const sqft = order.home?.sizeSqft ?? order.desiredSizeSqft;
  const [result] = filterParcels([listing], questionnaireAtSize(ctx.questionnaire, sqft));
  const choice: ParcelChoice = {
    listing,
    verdict: result.verdict,
    reasons: result.reasons,
    evaluatedAgainstSqft: sqft,
    atISO: ctx.now.toISOString(),
  };

  if (result.verdict === "REJECT") {
    let next: Order = {
      ...order,
      parcel: choice,
      rejections: [...order.rejections, choice],
      quote: undefined,
    };
    next = withEvent(
      next,
      ctx.now,
      "parcelRejected",
      `REFUSED: ${listing.name} (${listing.district}) — district minimum ` +
        `${listing.minDwellingSizeSqft?.toLocaleString("en-CA")} sqft vs ${sqft.toLocaleString("en-CA")} sqft design.`
    );
    next = { ...next, status: "parcelRejected" };
    const refusal = buildRefusal(next, choice, ctx);
    return {
      order: next,
      reply: refusal,
      actions: [
        {
          type: "disableBuy",
          reason:
            `${listing.district} district minimum dwelling size is ` +
            `${listing.minDwellingSizeSqft?.toLocaleString("en-CA")} sqft; this design is ` +
            `${sqft.toLocaleString("en-CA")} sqft.`,
        },
      ],
    };
  }

  let next: Order = { ...order, parcel: choice, quote: undefined };
  next = withEvent(
    next,
    ctx.now,
    "parcelSelected",
    `Parcel ${how}: ${listing.name} (${listing.district}) — PASS at ${sqft.toLocaleString("en-CA")} sqft.`
  );
  next = { ...next, status: deriveCheckpointStatus(next) };

  const advisories = choice.reasons.map((r) => `  - ${r}`).join("\n");
  const followUp = next.home
    ? "Home and land both check out — ask me for the quote."
    : "The land is sound. Now choose the home — ask me to list homes.";
  return {
    order: next,
    reply:
      `${listing.name} PASSES for a ${sqft.toLocaleString("en-CA")} sqft design. ` +
      `${listing.district} district minimum is ` +
      `${listing.minDwellingSizeSqft ? `${listing.minDwellingSizeSqft.toLocaleString("en-CA")} sqft` : "not yet verified"}. ` +
      `What the checks found:\n${advisories}\n${followUp}`,
    actions: next.home ? [{ type: "enableBuy" }] : [],
  };
}

/**
 * THE REFUSAL — quotable, specific, and constructive. Every number is
 * computed from the data: the citation from the parcel's bylaw basis, the
 * shortfall from the two sizes, the alternatives from re-running the same
 * filter over the full inventory and the catalog.
 */
export function buildRefusal(order: Order, choice: ParcelChoice, ctx: ConciergeContext): string {
  const p = choice.listing;
  const sqft = choice.evaluatedAgainstSqft;
  const min = p.minDwellingSizeSqft ?? 0;
  const short = min - sqft;
  const designName = order.home ? order.home.name : `your ${sqft.toLocaleString("en-CA")} sqft design`;

  // Constructive arm 1: parcels that DO pass this design, from the real filter.
  const passing = filterParcels(ctx.parcels, questionnaireAtSize(ctx.questionnaire, sqft)).filter(
    (v) => v.verdict === "PASS" && v.parcel.id !== p.id
  );
  const passLines = passing
    .map(
      (v) =>
        `     - ${v.parcel.name} — ${v.parcel.district} district, minimum ` +
        `${v.parcel.minDwellingSizeSqft ? `${v.parcel.minDwellingSizeSqft.toLocaleString("en-CA")} sqft` : "unverified"}, ` +
        `${fmtCad(v.parcel.priceCad)}`
    )
    .join("\n");

  // Constructive arm 2: catalog homes big enough for THIS district.
  const selectedCatalogId = order.home?.kind === "catalog" ? order.home.catalogId : undefined;
  const biggerHomes = CATALOG.filter((h) => h.sizeSqft >= min && h.id !== selectedCatalogId);
  const homeLines = biggerHomes
    .map((h) => `     - ${h.name} — ${h.sizeSqft.toLocaleString("en-CA")} sqft, clears the ${min.toLocaleString("en-CA")} sqft minimum`)
    .join("\n");

  return [
    `I can't sell you this home on this parcel, and here is exactly why.`,
    ``,
    `${p.name} sits in the ${p.district} district of ${p.county}. That district's land-use bylaw ` +
      `sets a minimum dwelling size of ${min.toLocaleString("en-CA")} sqft. ${designName} is ` +
      `${sqft.toLocaleString("en-CA")} sqft — ${short.toLocaleString("en-CA")} sqft short. The DISTRICT ` +
      `bylaw sets the minimum, never the county: the identical design can be legal one road over.`,
    `  Citation: ${p.basis ?? `${p.county} land-use bylaw, ${p.district} district`}`,
    ``,
    `This check is free here. Finding out after you buy the land costs you the land.`,
    ``,
    `Two ways forward:`,
    `  1. Keep the home, change the land — these parcels PASS at ${sqft.toLocaleString("en-CA")} sqft:`,
    passLines || `     - (no passing parcels currently on file)`,
    `  2. Keep the land, change the home:`,
    homeLines || `     - (no catalog home currently clears ${min.toLocaleString("en-CA")} sqft)`,
  ].join("\n");
}

// ---------------------------------------------------------------- quote

function homeForQuote(
  choice: OrderHomeChoice,
  ctx: ConciergeContext,
): CatalogHome | undefined {
  if (choice.kind === "catalog") return findHome(choice.catalogId);
  return {
    id: `builder:${choice.projectId}`,
    name: choice.name,
    tagline: "A builder design handed to the Aura concierge at an immutable document hash.",
    sizeSqft: choice.sizeSqft,
    storeys: choice.designSummary.storeys,
    bedrooms: ctx.questionnaire.home.bedrooms,
    bathrooms: ctx.questionnaire.home.bathrooms,
    fulfillment: "sip-site-built",
    pricing: {
      kind: "costModel",
      basis:
        `${choice.quoteBasis.source}. Room programme and systems remain the base Alberta ` +
        "estimate assumptions until confirmed in concierge; the design hash fixes geometry, not supplier prices.",
    },
    included: [
      "LOW/MID/HIGH estimate from the open Alberta cost model",
      "Immutable builder document identity carried into the quote",
    ],
    notIncluded: [...choice.quoteBasis.exclusions],
    leadTime:
      "No lead time is promised by this estimate. Supplier lead times begin only after reviewed drawings and accepted supplier quotes.",
  };
}

function handleRequestQuote(order: Order, ctx: ConciergeContext): ReduceResult {
  if (committed(order)) return alreadyCommitted(order); // re-quoting while "quoted" is allowed
  if (!order.home) {
    return unchanged(order, "No home selected yet — ask me to list homes, then pick one.");
  }
  if (!order.parcel || order.parcel.verdict !== "PASS") {
    const why =
      order.parcel?.verdict === "REJECT"
        ? "the selected parcel was REFUSED by the land gate — see the citation above"
        : "no parcel is selected";
    return unchanged(
      order,
      `I can't quote yet: ${why}. The quote follows the land, never the other way around.`,
      [{ type: "disableBuy", reason: "Quote requires a home plus a passing parcel." }]
    );
  }

  const home = homeForQuote(order.home, ctx);
  if (!home) {
    const id = order.home.kind === "catalog" ? order.home.catalogId : order.home.projectId;
    return unchanged(order, `Selected home ${id} was not found.`);
  }

  const quote = buildQuote(order, home, ctx);
  let next: Order = { ...order, quote };
  next = withEvent(
    next,
    ctx.now,
    "quoteIssued",
    quote.budget
      ? `Quote issued: MID ${fmtCad(quote.budget.total.midCad)} ex-land; deposit ${fmtCad(quote.depositCad)}.`
      : `Quote issued: published base ${fmtUsd(quote.publishedUsd ?? 0)}; deposit ${fmtUsd(quote.depositUsd)}.`
  );
  next = { ...next, status: "quoted" };

  return {
    order: next,
    reply: renderQuoteReply(next, home, quote),
    actions: [{ type: "enableBuy" }],
  };
}

function buildQuote(order: Order, home: CatalogHome, ctx: ConciergeContext): OrderQuote {
  const refundWindowHours = ctx.refundWindowHours ?? REFUND_WINDOW_HOURS_DEFAULT;
  const validUntil = new Date(ctx.now.getTime() + QUOTE_VALIDITY_DAYS * 86_400_000).toISOString();
  const selected = order.home;
  const basis =
    selected?.kind === "builder"
      ? selected.quoteBasis
      : {
          kind: home.pricing.kind === "published" ? "published-price" as const : "estimate" as const,
          jurisdiction: "Alberta, Canada",
          source:
            home.pricing.kind === "published"
              ? home.pricing.basis
              : "data/alberta/cost-model.json",
          currency: home.pricing.kind === "published" ? "USD" as const : "CAD" as const,
          exclusions: [...home.notIncluded],
          assumptions: [home.pricing.basis],
        };
  const common = {
    refundWindowHours,
    fxUsdPerCad: DEMO_USD_PER_CAD,
    network: X_LAYER_TESTNET,
    usdcAsset: NATIVE_USDC_TESTNET,
    generatedAtISO: ctx.now.toISOString(),
    validUntilISO: validUntil,
    designHash: selected?.kind === "builder" ? selected.documentHash : undefined,
    basis,
  };

  if (home.pricing.kind === "published") {
    const depositUsd = Math.max(
      FACTORY_DEPOSIT_MIN_USD,
      Math.round(home.pricing.baseUsd * FACTORY_DEPOSIT_RATE)
    );
    return {
      ...common,
      publishedUsd: home.pricing.baseUsd,
      depositCad: Math.round((depositUsd / DEMO_USD_PER_CAD) * 100) / 100,
      depositUsd,
      depositUsdc6: usdToUsdc6(depositUsd),
      reconciliation: {
        reconcilesToFile: "not-applicable",
        note:
          "Factory unit priced from the manufacturer's published base price — the Alberta cost " +
          "model prices site-built Aura SIP homes only. " + home.pricing.basis,
      },
    };
  }

  // Site-built: run the REAL pipeline with the chosen parcel overlaid.
  const q = quoteQuestionnaire(order, home, ctx);
  const brief = questionnaireToDesignBrief(q);
  const budget = designBriefToBudget(brief, ctx.costModel, q.contingencyRate);
  const plan = budgetToMilestones(budget, q.projectName);

  // The reservation deposit IS the first milestone (escrow v2 milestone 0:
  // "Design, engineering & permits") — so the deposit reconciles to the cost
  // model by construction and converts into the first funded milestone.
  const depositCad = plan.milestones[0].amountCad;
  const depositUsd = cadToUsd(depositCad);

  const atReference =
    home.sizeSqft === (ctx.fileTotalsExLand ? 800 : home.sizeSqft) && !!ctx.fileTotalsExLand;
  const t = budget.total;
  const f = ctx.fileTotalsExLand;
  const matchesFile =
    !!f && t.lowCad === f.low && t.midCad === f.mid && t.highCad === f.high;

  return {
    ...common,
    budget,
    plan,
    depositCad,
    depositUsd,
    depositUsdc6: usdToUsdc6(depositUsd),
    reconciliation: {
      fileTotalsExLand: f,
      computedTotalsExLand: { low: t.lowCad, mid: t.midCad, high: t.highCad },
      reconcilesToFile: atReference && home.sizeSqft === 800 ? matchesFile : "not-applicable",
      milestonesEqualBudgetMid: plan.totalCad === budget.total.midCad,
      depositEqualsFirstMilestone: depositCad === plan.milestones[0].amountCad,
      note:
        home.sizeSqft === 800
          ? "800 sqft reference spec: computed totals must equal data/alberta/cost-model.json totalsExLand to the dollar."
          : `Design is ${home.sizeSqft} sqft (not the 800 sqft reference), so the file's totalsExLand ` +
            "do not apply verbatim; totals still follow the file's totalsRule.",
    },
  };
}

function renderQuoteReply(order: Order, home: CatalogHome, quote: OrderQuote): string {
  const lines: string[] = [];
  if (quote.budget && quote.plan) {
    const b = quote.budget;
    lines.push(
      `${home.name} on ${order.parcel?.listing.name} — quoted from the open Alberta cost model:`,
      `  Budget (CAD, ex-land): LOW ${fmtCad(b.total.lowCad)} / MID ${fmtCad(b.total.midCad)} / HIGH ${fmtCad(b.total.highCad)}`,
      `  Escrow milestones (MID column, 10% statutory holdback each, releasable after ${quote.plan.holdbackPeriodDays} days):`
    );
    for (const m of quote.plan.milestones) {
      lines.push(
        `    ${m.index + 1}. ${m.name} — ${fmtCad(m.amountCad)} (holdback ${fmtCad(m.holdbackCad)}, ` +
          `net on release ${fmtCad(m.netOnReleaseCad)})`
      );
    }
    lines.push(
      `  Milestone total ${fmtCad(quote.plan.totalCad)} = budget MID to the dollar; total holdback ${fmtCad(quote.plan.totalHoldbackCad)}.`
    );
  } else {
    lines.push(
      `${home.name} on ${order.parcel?.listing.name} — published base price ${fmtUsd(quote.publishedUsd ?? 0)}.`,
      `  ${PARTNER_STATE.line}`
    );
  }
  lines.push(
    `  Reservation deposit (escrow milestone 0): ${fmtCad(quote.depositCad)} ≈ ${fmtUsd(quote.depositUsd)} = ` +
      `${fmtUsdc6(quote.depositUsdc6)} (native USDC, ${quote.network}; demo rate US$${quote.fxUsdPerCad}/CA$1, not an oracle).`,
    `  Cooling-off: a ${quote.refundWindowHours}-hour refund window you alone control, enforced by the contract.`,
    `  Quote basis: ${quote.basis.kind} from ${quote.basis.source}; valid until ${quote.validUntilISO}.`,
    `  Exclusions: ${quote.basis.exclusions.join("; ") || "none stated"}.`,
    `Say "place the deposit" when ready.`
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------- deposit

function handlePlaceDeposit(order: Order, ctx: ConciergeContext): ReduceResult {
  if (committed(order)) return alreadyCommitted(order);
  if (order.status !== "quoted" || !order.quote) {
    return unchanged(
      order,
      "No live quote to fund. The path is: home + passing parcel -> quote -> deposit.",
      [{ type: "disableBuy", reason: "Deposit requires an issued quote." }]
    );
  }
  if (
    order.home?.kind === "builder" &&
    order.quote.designHash !== order.home.documentHash
  ) {
    return unchanged(
      order,
      "This quote belongs to a different version of the builder design. Re-quote the current design before approving USDC; no payment action was created.",
      [{ type: "disableBuy", reason: "The builder design changed after this quote." }],
    );
  }
  const validUntilMs = Date.parse(order.quote.validUntilISO);
  if (!Number.isFinite(validUntilMs) || ctx.now.getTime() > validUntilMs) {
    return unchanged(
      order,
      Number.isFinite(validUntilMs)
        ? `This estimate expired at ${order.quote.validUntilISO}. Request a fresh quote before approving USDC; no payment action was created.`
        : "This legacy quote has no valid expiry. Request a fresh quote before approving USDC; no payment action was created.",
      [{ type: "disableBuy", reason: "The quote has expired." }],
    );
  }
  const q = order.quote;
  let next: Order = {
    ...order,
    deposit: {
      amountCad: q.depositCad,
      amountUsd: q.depositUsd,
      amountUsdc6: q.depositUsdc6,
      network: q.network,
      usdcAsset: q.usdcAsset,
      requestedAtISO: ctx.now.toISOString(),
    },
  };
  next = withEvent(
    next,
    ctx.now,
    "depositRequested",
    `Deposit requested: ${fmtCad(q.depositCad)} = ${fmtUsdc6(q.depositUsdc6)} on ${q.network}.`
  );
  next = { ...next, status: "depositPending" };
  return {
    order: next,
    reply:
      `Two signatures: approve ${fmtUsdc6(q.depositUsdc6)} of native USDC ` +
      `(${q.usdcAsset} on ${q.network} — never USDC.e), then fund escrow milestone 0. ` +
      `The ${q.refundWindowHours}-hour refund window opens the moment the deposit lands.`,
    actions: [
      { type: "approveUsdc", amountUsdc6: q.depositUsdc6, asset: q.usdcAsset, network: q.network },
      { type: "fundMilestone", milestoneIndex: 0, amountUsdc6: q.depositUsdc6 },
    ],
  };
}

function handleConfirmDeposit(order: Order, txRef: string | undefined, ctx: ConciergeContext): ReduceResult {
  if (order.status !== "depositPending" || !order.deposit || !order.quote) {
    return unchanged(order, "No pending deposit to confirm.");
  }
  const fundedAt = ctx.now;
  const deadline = new Date(fundedAt.getTime() + order.quote.refundWindowHours * 3_600_000);
  let next: Order = {
    ...order,
    deposit: {
      ...order.deposit,
      fundedAtISO: fundedAt.toISOString(),
      txRef,
      refundDeadlineISO: deadline.toISOString(),
    },
  };
  next = withEvent(
    next,
    ctx.now,
    "depositFunded",
    `Deposit funded: ${fmtCad(next.deposit!.amountCad)} = ${fmtUsdc6(next.deposit!.amountUsdc6)}` +
      (txRef ? ` (tx ${txRef}).` : ".")
  );
  next = { ...next, status: "depositPaid" };
  next = withEvent(
    next,
    ctx.now,
    "refundWindowOpened",
    `Refund window open until ${deadline.toISOString()} (${order.quote.refundWindowHours}h). Buyer alone controls it.`
  );
  next = { ...next, status: "refundWindowOpen" };
  return {
    order: next,
    reply:
      `Deposit received: ${fmtCad(next.deposit!.amountCad)} (${fmtUsdc6(next.deposit!.amountUsdc6)}) is in escrow ` +
      `and the build record flips to Funded. Your refund window is open until ` +
      `${deadline.toISOString()} — ${order.quote.refundWindowHours} hours in which you alone can pull the full ` +
      `deposit back, no counterparty approval, no support ticket. After it closes, the deposit converts into ` +
      `milestone 1 of the build.`,
    actions: [
      { type: "updateRegistry", status: "Funded" },
      { type: "startRefundCountdown", deadlineISO: deadline.toISOString() },
    ],
  };
}

// ---------------------------------------------------------------- refund / convert

function handleRequestRefund(order: Order, ctx: ConciergeContext): ReduceResult {
  if (order.status !== "refundWindowOpen" && order.status !== "depositPaid") {
    if (order.status === "converted" || order.status === "building") {
      return unchanged(
        order,
        "The refund window has closed and the deposit has converted into the build — the unilateral " +
          "refund path no longer applies. Unwinding now is the escrow's 2-of-3 cancel path."
      );
    }
    return unchanged(order, "There is no funded deposit to refund.");
  }
  if (!refundWindowOpen(order, ctx.now)) {
    // The clock has passed the deadline even though no tick has been applied.
    return handleTick(order, ctx);
  }
  const d = order.deposit!;
  let next: Order = {
    ...order,
    deposit: { ...d, refundedAtISO: ctx.now.toISOString() },
  };
  next = withEvent(
    next,
    ctx.now,
    "depositRefunded",
    `Deposit refunded in full: ${fmtCad(d.amountCad)} = ${fmtUsdc6(d.amountUsdc6)} returned to the buyer.`
  );
  next = { ...next, status: "refunded" };
  return {
    order: next,
    reply:
      `Done — ${fmtCad(d.amountCad)} (${fmtUsdc6(d.amountUsdc6)}) returned in full to your wallet. ` +
      `Inside the window the contract's refundDeposit() answers to you alone: no approvals, no fees, ` +
      `no questions. The order is closed; the land gate and the numbers will be here when you come back.`,
    actions: [{ type: "refundDeposit" }],
  };
}

function handleTick(order: Order, ctx: ConciergeContext): ReduceResult {
  if (order.status !== "refundWindowOpen" && order.status !== "depositPaid") {
    return unchanged(order, statusLine(order, ctx));
  }
  if (refundWindowOpen(order, ctx.now)) {
    return unchanged(
      order,
      `Refund window still open: ${refundHoursLeft(order, ctx.now)}h remaining ` +
        `(until ${order.deposit?.refundDeadlineISO}).`
    );
  }
  let next = withEvent(
    order,
    ctx.now,
    "refundWindowClosed",
    `Refund window closed at ${order.deposit?.refundDeadlineISO} without a refund request.`
  );
  next = {
    ...next,
    deposit: { ...next.deposit!, convertedAtISO: ctx.now.toISOString() },
  };
  next = withEvent(
    next,
    ctx.now,
    "converted",
    `Order converted: the ${fmtCad(next.deposit!.amountCad)} deposit is now milestone 1 of the build.`
  );
  next = { ...next, status: "converted" };
  return {
    order: next,
    reply:
      `The refund window closed with the deposit untouched — the order is converted. Your ` +
      `${fmtCad(next.deposit!.amountCad)} deposit now stands as milestone 1 ` +
      `(${next.quote?.plan?.milestones[0]?.name ?? "Reservation"}) of the funded build. ` +
      `Say "start the build" to break ground.`,
    actions: [],
  };
}

function handleStartBuild(order: Order, ctx: ConciergeContext): ReduceResult {
  if (order.status !== "converted") {
    return unchanged(
      order,
      order.status === "building"
        ? "The build is already underway."
        : "The build starts only after the refund window closes and the order converts."
    );
  }
  let next = withEvent(order, ctx.now, "buildStarted", "Build started — registry flips to UnderConstruction.");
  next = { ...next, status: "building" };

  const m0 = next.quote?.plan?.milestones[0];
  const releaseLine = m0
    ? `First release when milestone 1 (${m0.name}) completes: ${fmtCad(m0.amountCad)} gross — ` +
      `${fmtCad(m0.netOnReleaseCad)} to the builder, ${fmtCad(m0.holdbackCad)} (10%) retained as ` +
      `Alberta's statutory holdback, releasable after ${next.quote?.plan?.holdbackPeriodDays} days.`
    : "Milestone releases retain Alberta's 10% statutory holdback, releasable after 60 days.";
  return {
    order: next,
    reply:
      `Breaking ground. The registry record flips to UnderConstruction and work proceeds only against ` +
      `funded milestones. ${releaseLine}`,
    actions: [{ type: "updateRegistry", status: "UnderConstruction" }],
  };
}

// ---------------------------------------------------------------- helpers

/** Money has moved (or is moving): home and parcel are locked. A mere quote
 *  is NOT committed — the buyer can still change home or land until the
 *  deposit is requested. */
function committed(order: Order): boolean {
  return !["browsing", "parcelSelected", "parcelRejected", "homeSelected", "quoted"].includes(
    order.status
  );
}

function alreadyCommitted(order: Order): ReduceResult {
  return unchanged(
    order,
    `This order is already ${order.status} — home and parcel are locked once the deposit moves. ` +
      `Open a new order to explore something else.`
  );
}

function statusLine(order: Order, ctx: ConciergeContext): string {
  const bits = [
    `Order ${order.id}: ${order.status}.`,
    order.home ? `Home: ${order.home.name} (${order.home.sizeSqft} sqft).` : "No home selected.",
    order.parcel
      ? `Parcel: ${order.parcel.listing.name} — ${order.parcel.verdict}.`
      : "No parcel selected.",
  ];
  if (order.deposit?.refundDeadlineISO && order.status === "refundWindowOpen") {
    bits.push(`Refund window: ${refundHoursLeft(order, ctx.now)}h left.`);
  }
  return bits.join(" ");
}

/** The base questionnaire evaluated at a given design size (parcel untouched). */
function questionnaireAtSize(base: Questionnaire, sizeSqft: number): Questionnaire {
  return { ...base, home: { ...base.home, sizeSqft } };
}

/** Full questionnaire for the quote: catalog home spec + chosen parcel overlay. */
function quoteQuestionnaire(order: Order, home: CatalogHome, ctx: ConciergeContext): Questionnaire {
  const q = catalogQuestionnaire(home, ctx.questionnaire);
  const p = order.parcel!.listing;
  return {
    ...q,
    parcel: {
      ...q.parcel,
      county: p.county,
      district: p.district,
      // Unverified minimums (null) fall back to the design size so the brief
      // does not invent a constraint the bylaw has not been checked for.
      minDwellingSizeSqft: p.minDwellingSizeSqft ?? home.sizeSqft,
      acreage: p.acreage,
      aquifer: p.aquifer,
      gridDistanceKm: p.gridDistanceKm,
      septicSoils: p.septicSoils,
    },
  };
}
