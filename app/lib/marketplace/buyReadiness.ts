export type TargetRegion =
  | "any"
  | "canada"
  | "united-states"
  | "europe"
  | "uae"
  | "japan"
  | "other";

export type PurchaseProduct =
  | "any"
  | "eco-home"
  | "modular-home"
  | "kit-home"
  | "site-built-home"
  | "existing-property"
  | "unique-stay";

export interface BuyReadinessProvider {
  name: string;
  productFit: Exclude<PurchaseProduct, "any">;
  availabilityRegions: Array<Exclude<TargetRegion, "any">>;
  availabilityUnknownRegions: Array<Exclude<TargetRegion, "any">>;
  cryptoStatus: "current-live" | "own-site-stale" | "press-announcement" | "planned";
  paymentStatus:
    | "executable-checkout"
    | "regulated-processor"
    | "direct-wallet"
    | "quote-required"
    | "announcement-only"
    | "planned";
  priceStatus: "published" | "observed" | "quote-only";
  evidenceCheckedAtISO: string;
}

export interface PurchaseIntent {
  targetRegion: TargetRegion;
  product: PurchaseProduct;
}

export interface PurchaseContribution {
  id: "product" | "region" | "crypto" | "payment" | "price";
  label: string;
  points: number;
  possiblePoints: number;
  state: "confirmed" | "partial" | "unknown" | "mismatch";
  detail: string;
}

export interface ProviderPurchaseReadiness {
  providerName: string;
  score: number;
  verdict: "ready-to-contact" | "verify-first" | "region-unavailable" | "product-mismatch";
  label: string;
  contributions: PurchaseContribution[];
}

const productLabel: Record<Exclude<PurchaseProduct, "any">, string> = {
  "eco-home": "Eco home",
  "modular-home": "Modular home",
  "kit-home": "Home kit",
  "site-built-home": "Site-built home",
  "existing-property": "Existing property",
  "unique-stay": "Unique-stay unit",
};

const regionLabel: Record<Exclude<TargetRegion, "any">, string> = {
  canada: "Canada",
  "united-states": "United States",
  europe: "Europe",
  uae: "United Arab Emirates",
  japan: "Japan",
  other: "Other markets",
};

export function providerPurchaseReadiness(
  provider: BuyReadinessProvider,
  intent: PurchaseIntent,
): ProviderPurchaseReadiness {
  const productMatches = intent.product === "any" || provider.productFit === intent.product;
  const regionConfirmed =
    intent.targetRegion === "any" || provider.availabilityRegions.includes(intent.targetRegion);
  const regionUnknown =
    intent.targetRegion !== "any" && provider.availabilityUnknownRegions.includes(intent.targetRegion);

  const cryptoPoints =
    provider.cryptoStatus === "current-live"
      ? 30
      : provider.cryptoStatus === "press-announcement"
        ? 10
        : provider.cryptoStatus === "own-site-stale"
          ? 8
          : 4;
  const paymentPoints =
    provider.paymentStatus === "executable-checkout" || provider.paymentStatus === "regulated-processor"
      ? 15
      : provider.paymentStatus === "quote-required"
        ? 8
        : provider.paymentStatus === "direct-wallet"
          ? 7
          : provider.paymentStatus === "announcement-only"
            ? 2
            : 0;
  const pricePoints = provider.priceStatus === "published" ? 5 : provider.priceStatus === "observed" ? 3 : 0;

  const contributions: PurchaseContribution[] = [
    {
      id: "product",
      label: "Product fit",
      points: productMatches ? 25 : 0,
      possiblePoints: 25,
      state: productMatches ? "confirmed" : "mismatch",
      detail:
        intent.product === "any"
          ? `Provides a ${productLabel[provider.productFit].toLowerCase()}.`
          : productMatches
            ? `Matches the requested ${productLabel[intent.product].toLowerCase()} path.`
            : `Provides a ${productLabel[provider.productFit].toLowerCase()}, not the requested ${productLabel[intent.product].toLowerCase()}.`,
    },
    {
      id: "region",
      label: "Destination availability",
      points: regionConfirmed ? 25 : regionUnknown ? 8 : 0,
      possiblePoints: 25,
      state: regionConfirmed ? "confirmed" : regionUnknown ? "unknown" : "mismatch",
      detail:
        intent.targetRegion === "any"
          ? `Documented in ${provider.availabilityRegions.map((region) => regionLabel[region]).join(", ") || "no confirmed market"}.`
          : regionConfirmed
            ? `${regionLabel[intent.targetRegion]} is within the documented availability.`
            : regionUnknown
              ? `${regionLabel[intent.targetRegion]} delivery or service is mentioned but not confirmed.`
              : `${regionLabel[intent.targetRegion]} is outside the documented availability.`,
    },
    {
      id: "crypto",
      label: "Crypto acceptance evidence",
      points: cryptoPoints,
      possiblePoints: 30,
      state: provider.cryptoStatus === "current-live" ? "confirmed" : "partial",
      detail:
        provider.cryptoStatus === "current-live"
          ? "A current source supports crypto acceptance."
          : provider.cryptoStatus === "own-site-stale"
            ? "The company source is stale and the current site does not repeat the claim."
            : provider.cryptoStatus === "press-announcement"
              ? "Acceptance appears in announcement or press evidence, not a live checkout."
              : "Crypto settlement was announced as a plan, not a live rail.",
    },
    {
      id: "payment",
      label: "Payment mechanics",
      points: paymentPoints,
      possiblePoints: 15,
      state:
        paymentPoints === 15 ? "confirmed" : paymentPoints > 0 ? "partial" : "unknown",
      detail:
        provider.paymentStatus === "executable-checkout"
          ? "A checkout path is described."
          : provider.paymentStatus === "regulated-processor"
            ? "A named regulated processor converts and settles the payment."
            : provider.paymentStatus === "direct-wallet"
              ? "A direct-wallet path exists but carries weak recourse and counterparty controls."
              : provider.paymentStatus === "quote-required"
                ? "Payment mechanics must be negotiated against a written quote."
                : provider.paymentStatus === "announcement-only"
                  ? "No executable payment mechanics were found beyond the announcement."
                  : "The payment path is planned rather than operational.",
    },
    {
      id: "price",
      label: "Price evidence",
      points: pricePoints,
      possiblePoints: 5,
      state: provider.priceStatus === "published" ? "confirmed" : provider.priceStatus === "observed" ? "partial" : "unknown",
      detail:
        provider.priceStatus === "published"
          ? "A current starting price is published."
          : provider.priceStatus === "observed"
            ? "A price was observed, but it may not be a current executable quote."
            : "A written quote is required; no current starting price is published.",
    },
  ];
  const score = contributions.reduce((sum, item) => sum + item.points, 0);
  const livePayment =
    provider.cryptoStatus === "current-live" &&
    (provider.paymentStatus === "executable-checkout" || provider.paymentStatus === "regulated-processor");
  const verdict: ProviderPurchaseReadiness["verdict"] = !productMatches
    ? "product-mismatch"
    : !regionConfirmed && !regionUnknown
      ? "region-unavailable"
      : livePayment && regionConfirmed && score >= 80
        ? "ready-to-contact"
        : "verify-first";
  return {
    providerName: provider.name,
    score,
    verdict,
    label:
      verdict === "ready-to-contact"
        ? "Strong evidence · still confirm"
        : verdict === "region-unavailable"
          ? "Unavailable in selected region"
          : verdict === "product-mismatch"
            ? "Product does not match"
            : "Evidence incomplete · verify first",
    contributions,
  };
}

export interface ChangeNowIntegrationState {
  partnerApiConfigured: boolean;
  exactPairVerified: boolean;
  quoteExpiresAtISO: string | null;
  recipientVerified: boolean;
  termsAccepted: boolean;
}

export interface ChangeNowReadiness {
  status:
    | "not-connected"
    | "pair-verification-required"
    | "quote-required"
    | "recipient-verification-required"
    | "terms-required"
    | "ready-for-user-confirmation";
  blockers: string[];
  /** The user must always review and sign; Aura never auto-sends a purchase payment. */
  canExecuteAutomatically: false;
}

export function changeNowReadiness(
  state: ChangeNowIntegrationState,
  now: Date,
): ChangeNowReadiness {
  const blockers: string[] = [];
  if (!state.partnerApiConfigured)
    blockers.push("A ChangeNOW partner agreement and server-kept API credential are not configured.");
  if (!state.exactPairVerified)
    blockers.push("The exact source contract/network and destination asset pair have not been returned by the live currencies endpoint.");
  const quoteExpiry = state.quoteExpiresAtISO ? Date.parse(state.quoteExpiresAtISO) : Number.NaN;
  if (!Number.isFinite(quoteExpiry) || quoteExpiry <= now.getTime())
    blockers.push("The conversion quote is missing or expired.");
  if (!state.recipientVerified)
    blockers.push("The manufacturer recipient address and required memo/tag have not been verified out of band.");
  if (!state.termsAccepted)
    blockers.push("ChangeNOW terms, AML/KYC policy, geography and risk disclosures have not been accepted for this transaction.");

  const status: ChangeNowReadiness["status"] = !state.partnerApiConfigured
    ? "not-connected"
    : !state.exactPairVerified
      ? "pair-verification-required"
      : !Number.isFinite(quoteExpiry) || quoteExpiry <= now.getTime()
        ? "quote-required"
        : !state.recipientVerified
          ? "recipient-verification-required"
          : !state.termsAccepted
            ? "terms-required"
            : "ready-for-user-confirmation";
  return { status, blockers, canExecuteAutomatically: false };
}
