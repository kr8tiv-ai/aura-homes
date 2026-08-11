/* ---------------------------------------------------------------------
   THE BUY SURFACE — data layer.

   Two researched datasets, loaded straight out of /data. Nothing here edits
   a finding: the JSON is the record of what was fetched, refuted, and
   left open, and this module only types it and derives the handful of
   facts the UI needs to sort and filter honestly.

   Every derivation below is a text scan over the researcher's OWN words,
   never a new claim. Where a scan could be wrong, the card still prints
   the full sentence it scanned, so a reader can overrule it on sight.
--------------------------------------------------------------------- */

import providersJson from "@data/providers/crypto-home-providers.json";
import routesJson from "@data/providers/xlayer-routes.json";
import type { BuyReadinessProvider } from "@/lib/marketplace/buyReadiness";

export type EvidenceTier = "A-own-site" | "B-reputable-press";

export type Provider = BuyReadinessProvider & {
  name: string;
  url: string;
  country: string;
  productType: string;
  /** exactly as the provider names them, chain qualifiers and all */
  assets: string[];
  howToPay: string;
  evidenceTier: string;
  evidenceUrl: string;
  quote: string;
  shipsTo: string;
  priceFrom: string;
  caveat: string;
};

export type XRoute = {
  id: string;
  name: string;
  from: string;
  to: string;
  hops: string[];
  custody: string;
  kyc: string;
  feeEstimate: string;
  timeEstimate: string;
  verifiedAt: string;
  evidenceUrl: string | null;
  embeddable: string | null;
  /** the verification record arrived incomplete; the page says so */
  recordTruncated?: boolean;
};

export const PROVIDERS = providersJson.providers as Provider[];
export const REFUTED = providersJson.refuted as string[];
export const ROUTES = routesJson.routes as XRoute[];

export const routeById = (id: string): XRoute | undefined =>
  ROUTES.find((r) => r.id === id);

/* ------------------------------------------------------------------ tiers */

export const TIER_A = "A-own-site";
export const TIER_B = "B-reputable-press";

export const tierLabel = (tier: string) =>
  tier === TIER_A ? "A · Own site" : tier === TIER_B ? "B · Press" : tier;

export const tierMeaning = (tier: string) =>
  tier === TIER_A
    ? "The company's own live page says it, and the page was fetched."
    : tier === TIER_B
      ? "A press release or reputable report says it. The company's live site did not confirm it in this sweep."
      : "Unclassified.";

/** The escalated warning. Press-tier evidence, or evidence the researcher
 *  called stale in their own caveat, means the acceptance may simply not
 *  be true any more — Armstrong Steel's page is dated 2014. */
export const needsPhoneCheck = (p: Provider) =>
  p.evidenceTier !== TIER_A || /\bstale\b/i.test(p.caveat);

/* ----------------------------------------------------------------- assets */

/** Ticker tokens for filtering. "BTC (planned)" -> BTC, "ETH-Base" -> ETH,
 *  "MATIC-Polygon" -> MATIC. The chain qualifier is NOT lost: the card
 *  always prints p.assets verbatim, this is only the filter key. Entries
 *  that name no coin at all ("unspecified — ...") are excluded and surface
 *  through the UNNAMED filter instead. */
export function assetTickers(p: Provider): string[] {
  const out: string[] = [];
  for (const raw of p.assets) {
    const a = raw.trim();
    if (/^unspecified/i.test(a)) continue;
    const t = a.split(/[\s(\-]/)[0].toUpperCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export const namesNoAsset = (p: Provider) =>
  p.assets.every((a) => /^unspecified/i.test(a.trim()));

/** Every ticker in the directory, most-accepted first. */
export function allTickers(): { ticker: string; count: number }[] {
  /* A plain record, not a Map: this project's tsconfig sets no `target`,
     so spreading a Map iterator trips TS2802 under the ES5 default. */
  const tally: Record<string, number> = {};
  for (const p of PROVIDERS) {
    for (const t of assetTickers(p)) tally[t] = (tally[t] ?? 0) + 1;
  }
  return Object.keys(tally)
    .map((ticker) => ({ ticker, count: tally[ticker] }))
    .sort((a, b) => b.count - a.count || a.ticker.localeCompare(b.ticker));
}

export const acceptsTicker = (p: Provider, ticker: string) =>
  assetTickers(p).includes(ticker);

/* ------------------------------------------------------------ reach: Canada */

export type Reach = "yes" | "no" | "unverified";

/** Read off the FIRST WORD of the researcher's shipsTo sentence, which is
 *  written as a verdict: "No. …" / "No — …" / "Unverified. …". Anything
 *  that does not open with a verdict is treated as unverified rather than
 *  optimistically as a yes. */
export function reachesCanada(p: Provider): Reach {
  const s = p.shipsTo.trim();
  if (/^no\b/i.test(s)) return "no";
  if (/^unverified\b/i.test(s)) return "unverified";
  if (/^yes\b/i.test(s)) return "yes";
  return "unverified";
}

export const reachLabel: Record<Reach, string> = {
  yes: "Reaches Canada",
  no: "Not Canada — you buy abroad",
  unverified: "Canada delivery unverified",
};

/* ------------------------------------------------------------------ routes */

/* THE ROUTE MODEL, and the one honest fact it is built on:
   NOT ONE of the seven researched provider records names USDC. Six name
   BTC. So a buyer holding USDC on X Layer always has a conversion leg,
   and the X Layer -> native BTC hop is the one that was live-verified
   against Meson's own relayer API. Meson lists 44 other chains; they were
   not checked, so they are not offered here as routes. That is why the
   plan below is three legs and not one. */

export const ENTRY_ROUTE_IDS = [
  "okx-dex-bridge",
  "cctp-v2",
  "okx-withdraw",
  "xlayer-canonical",
  "ca-wealthsimple-base",
  "ca-interac-eth",
] as const;

/** The default first leg: no KYC beyond the wallet, non-custodial, and it
 *  is the rail X Layer's own bridge page sends people to. */
export const DEFAULT_ENTRY_ROUTE_ID = "okx-dex-bridge";

/** The only X Layer -> provider-accepted-asset hop that survived
 *  verification. Its two caveats (legacy bridged USDC, hard per-swap
 *  limits) are printed on the leg, not summarised away. */
export const CONVERT_ROUTE_ID = "meson-btc";

export const BORROW_ROUTE_ID = "aave-borrow";

/** The asset a route can actually settle into for this provider, or null
 *  when no verified route reaches anything the provider names. */
export function settlementAsset(p: Provider): string | null {
  return acceptsTicker(p, "BTC") ? "BTC" : null;
}

export const COUNTS = {
  providers: PROVIDERS.length,
  tierA: PROVIDERS.filter((p) => p.evidenceTier === TIER_A).length,
  tierB: PROVIDERS.filter((p) => p.evidenceTier === TIER_B).length,
  refuted: REFUTED.length,
  acceptsUsdc: PROVIDERS.filter((p) => acceptsTicker(p, "USDC")).length,
  acceptsBtc: PROVIDERS.filter((p) => acceptsTicker(p, "BTC")).length,
  reachesCanada: PROVIDERS.filter((p) => reachesCanada(p) === "yes").length,
};
