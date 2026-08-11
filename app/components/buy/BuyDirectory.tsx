"use client";

/* The directory, its filters, and the route it hands you.

   Filtering is the whole reason this is a client component. Two axes,
   because those are the two questions a buyer actually has: does this
   provider take the coin I hold, and does its documented availability
   reach the place and product I selected. Empty states stay visible. */

import { useMemo, useState } from "react";
import { Counter, Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import ProviderCard from "./ProviderCard";
import RoutePlan from "./RoutePlan";
import {
  COUNTS,
  PROVIDERS,
  REFUTED,
  acceptsTicker,
  allTickers,
  namesNoAsset,
} from "./data";
import {
  providerPurchaseReadiness,
  type PurchaseProduct,
  type TargetRegion,
} from "@/lib/marketplace/buyReadiness";

const REGION_FILTERS: Array<{ id: TargetRegion; label: string }> = [
  { id: "any", label: "Anywhere" },
  { id: "canada", label: "Canada" },
  { id: "united-states", label: "United States" },
  { id: "europe", label: "Europe" },
  { id: "uae", label: "UAE" },
  { id: "japan", label: "Japan" },
  { id: "other", label: "Other markets" },
];

const PRODUCT_FILTERS: Array<{ id: PurchaseProduct; label: string }> = [
  { id: "any", label: "Any home path" },
  { id: "eco-home", label: "Eco home" },
  { id: "modular-home", label: "Modular" },
  { id: "kit-home", label: "Kit home" },
  { id: "site-built-home", label: "Site-built" },
  { id: "existing-property", label: "Existing property" },
  { id: "unique-stay", label: "Unique stay" },
];

export default function BuyDirectory() {
  const [asset, setAsset] = useState<string>("any");
  const [targetRegion, setTargetRegion] = useState<TargetRegion>("any");
  const [product, setProduct] = useState<PurchaseProduct>("any");
  const [selected, setSelected] = useState<string>(PROVIDERS[0]?.name ?? "");

  const tickers = useMemo(() => allTickers(), []);

  const shown = useMemo(
    () =>
      PROVIDERS.map((provider) => ({
        provider,
        readiness: providerPurchaseReadiness(provider, { targetRegion, product }),
      }))
        .filter(({ provider, readiness }) => {
          const assetOk =
            asset === "any" ||
            (asset === "unnamed" ? namesNoAsset(provider) : acceptsTicker(provider, asset));
          const productOk = product === "any" || readiness.verdict !== "product-mismatch";
          const regionOk = targetRegion === "any" || readiness.verdict !== "region-unavailable";
          return assetOk && productOk && regionOk;
        })
        .sort((a, b) => b.readiness.score - a.readiness.score),
    [asset, product, targetRegion],
  );

  const provider = useMemo(
    () => shown.find((item) => item.provider.name === selected)?.provider ?? shown[0]?.provider,
    [selected, shown],
  );

  return (
    <>
      {/* ------------------------------------------------- what the sweep found */}
      <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            k: "verified",
            n: COUNTS.providers,
            label: "Provider records",
            note: `${COUNTS.tierA} use company-site evidence, ${COUNTS.tierB} rely on announcement or press evidence.`,
          },
          {
            k: "refuted",
            n: COUNTS.refuted,
            label: "Leads refuted",
            note: "Checked and found not to accept crypto, or not to be a home provider. Recorded so nobody re-checks them.",
          },
          {
            k: "usdc",
            n: COUNTS.acceptsUsdc,
            label: "Accept USDC",
            note: "Zero. This is why a conversion leg exists between X Layer and every provider on this page.",
          },
          {
            k: "canada",
            n: COUNTS.reachesCanada,
            label: "Reach Canada",
            note: "Zero verified. Four are explicitly not Canada, three are unverified. An Alberta buyer is buying abroad.",
          },
        ].map((s) => (
          <StaggerItem key={s.k} className="h-full">
            <div className="aura-panel aura-panel-lift h-full p-6">
              <p className="font-display text-[2rem] font-medium leading-none tabular-nums">
                <Counter value={s.n} />
              </p>
              <p className="aura-label mt-3">{s.label}</p>
              <p className="mt-2 text-xs leading-relaxed text-aura-text/70">{s.note}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* ---------------------------------------------------------- the filters */}
      <div className="mt-14">
        <Reveal y={10}>
          <div className="aura-panel p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="aura-label">Aura purchase guide</p>
                <h2 className="mt-2 font-display text-xl font-medium">Start with where it must land</h2>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-aura-text/65">
                  The guide scores evidence; it does not call a seller vetted. Your starting asset
                  is fixed to native USDC on X Layer. Destination and product type decide which
                  providers remain plausible before a payment route is drawn.
                </p>
              </div>
              <span className="rounded-full border aura-hairline px-3 py-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-emerald">
                USDC · X Layer
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="aura-label mb-2 block">Destination</span>
                <select value={targetRegion} onChange={(event) => setTargetRegion(event.target.value as TargetRegion)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm">
                  {REGION_FILTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span className="aura-label mb-2 block">What you want to buy</span>
                <select value={product} onChange={(event) => setProduct(event.target.value as PurchaseProduct)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm">
                  {PRODUCT_FILTERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </Reveal>

        <Reveal y={10} className="mt-8">
          <p className="aura-label mb-3">Filter by asset accepted</p>
        </Reveal>
        <Stagger className="flex flex-wrap gap-2">
          {[{ ticker: "any", count: PROVIDERS.length }, ...tickers, { ticker: "unnamed", count: PROVIDERS.filter(namesNoAsset).length }].map(
            (t) => (
              <StaggerItem key={t.ticker}>
                <button
                  type="button"
                  onClick={() => setAsset(t.ticker)}
                  aria-pressed={asset === t.ticker}
                  data-cursor="Filter"
                  className={
                    asset === t.ticker
                      ? "rounded-full bg-aura-ink px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-paper"
                      : "rounded-full border aura-hairline px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-emerald"
                  }
                >
                  {t.ticker === "any"
                    ? "Any asset"
                    : t.ticker === "unnamed"
                      ? "Names no coin"
                      : t.ticker}{" "}
                  <span className="opacity-55">{t.count}</span>
                </button>
              </StaggerItem>
            ),
          )}
        </Stagger>

      </div>

      {/* ----------------------------------------------------------- the cards */}
      {shown.length > 0 ? (
        <Stagger className="mt-10 grid gap-6 lg:grid-cols-2">
          {shown.map(({ provider: item, readiness }) => (
            <StaggerItem key={item.name} className="h-full">
              <ProviderCard
                provider={item}
                readiness={readiness}
                selected={provider?.name === item.name}
                onSelect={() => setSelected(item.name)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <Reveal y={12} className="mt-10">
          <div className="aura-panel p-8">
            <p className="aura-label mb-2">No matches, and that is the finding</p>
            <p className="max-w-2xl text-sm leading-relaxed text-aura-text/75">
              Nothing in the evidence record matches that product, destination and asset. Loosen
              one filter, or read the refuted list below to see what was already checked. Aura will
              not turn unknown delivery into a confirmed result.
            </p>
          </div>
        </Reveal>
      )}

      {/* ------------------------------------------------------------ the route */}
      <div id="route" className="mt-24 scroll-mt-24">
        {provider ? (
          <RoutePlan provider={provider} />
        ) : null}
      </div>

      {/* --------------------------------------------------------- the refuted */}
      <div className="mt-24">
        <Reveal y={12}>
          <p className="aura-label">Negative findings</p>
          <h2 className="mt-2 font-display text-[1.6rem] font-medium tracking-[-0.02em]">
            What was checked and did not survive
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/75">
            A directory is only as trustworthy as the entries it threw away. These{" "}
            <Counter value={COUNTS.refuted} /> leads were fetched and refuted — including the two
            that hurt most: Miradex, a genuine Romanian passive-house prefab maker whose only
            &ldquo;crypto&rdquo; matches were the word <em>descriptor</em> in Wix JavaScript, and
            Trademark Renovations in Calgary, whose 2018 headline is not a rail in 2026.
          </p>
        </Reveal>
        <Stagger className="mt-8 space-y-3">
          {REFUTED.map((r, i) => (
            <StaggerItem key={r.slice(0, 40)}>
              <div className="aura-panel flex gap-4 p-5">
                <span className="font-mono text-[0.65rem] text-aura-text/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-xs leading-relaxed text-aura-text/75">{r}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </>
  );
}
