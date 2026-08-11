"use client";

/* The directory, its filters, and the route it hands you.

   Filtering is the whole reason this is a client component. Two axes,
   because those are the two questions a buyer actually has: does this
   provider take the coin I hold, and can I reach it from Canada. The
   second one returns zero results, and the empty state says so out loud
   rather than quietly showing nothing. */

import { useMemo, useState } from "react";
import { Counter, Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import ProviderCard from "./ProviderCard";
import RoutePlan from "./RoutePlan";
import {
  COUNTS,
  DEFAULT_ENTRY_ROUTE_ID,
  PROVIDERS,
  REFUTED,
  type Reach,
  acceptsTicker,
  allTickers,
  namesNoAsset,
  reachesCanada,
} from "./data";

type ReachFilter = "any" | Reach;

const REACH_FILTERS: { id: ReachFilter; label: string }[] = [
  { id: "any", label: "Anywhere" },
  { id: "yes", label: "Reaches Canada" },
  { id: "unverified", label: "Canada unverified" },
  { id: "no", label: "Not Canada" },
];

export default function BuyDirectory() {
  const [asset, setAsset] = useState<string>("any");
  const [reach, setReach] = useState<ReachFilter>("any");
  const [selected, setSelected] = useState<string>(PROVIDERS[0]?.name ?? "");
  const [entryRoute, setEntryRoute] = useState<string>(DEFAULT_ENTRY_ROUTE_ID);

  const tickers = useMemo(() => allTickers(), []);

  const shown = useMemo(
    () =>
      PROVIDERS.filter((p) => {
        const assetOk =
          asset === "any" ||
          (asset === "unnamed" ? namesNoAsset(p) : acceptsTicker(p, asset));
        const reachOk = reach === "any" || reachesCanada(p) === reach;
        return assetOk && reachOk;
      }),
    [asset, reach],
  );

  const provider = useMemo(
    () => PROVIDERS.find((p) => p.name === selected) ?? PROVIDERS[0],
    [selected],
  );

  return (
    <>
      {/* ------------------------------------------------- what the sweep found */}
      <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            k: "verified",
            n: COUNTS.providers,
            label: "Providers verified",
            note: `${COUNTS.tierA} on their own live site, ${COUNTS.tierB} on press evidence only.`,
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

        <Reveal y={10} className="mt-8">
          <p className="aura-label mb-3">Filter by whether it reaches Canada</p>
        </Reveal>
        <Stagger className="flex flex-wrap gap-2">
          {REACH_FILTERS.map((f) => (
            <StaggerItem key={f.id}>
              <button
                type="button"
                onClick={() => setReach(f.id)}
                aria-pressed={reach === f.id}
                data-cursor="Filter"
                className={
                  reach === f.id
                    ? "rounded-full bg-aura-ink px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-paper"
                    : "rounded-full border aura-hairline px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-emerald"
                }
              >
                {f.label}
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      {/* ----------------------------------------------------------- the cards */}
      {shown.length > 0 ? (
        <Stagger className="mt-10 grid gap-6 lg:grid-cols-2">
          {shown.map((p) => (
            <StaggerItem key={p.name} className="h-full">
              <ProviderCard
                provider={p}
                selected={provider?.name === p.name}
                onSelect={() => setSelected(p.name)}
              />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <Reveal y={12} className="mt-10">
          <div className="aura-panel p-8">
            <p className="aura-label mb-2">No matches, and that is the finding</p>
            <p className="max-w-2xl text-sm leading-relaxed text-aura-text/75">
              {reach === "yes"
                ? "Not one verified provider delivers to, or is situated in, Canada. Four say plainly that they do not; three never answered the question. That is the honest state of crypto home buying from Alberta today — the purchase is a cross-border transaction, with everything that implies for duty, code compliance and recourse."
                : "Nothing in the directory matches that combination. Loosen a filter, or read the refuted list below to see what was already checked."}
            </p>
          </div>
        </Reveal>
      )}

      {/* ------------------------------------------------------------ the route */}
      <div id="route" className="mt-24 scroll-mt-24">
        {provider ? (
          <RoutePlan
            provider={provider}
            entryRouteId={entryRoute}
            onEntryRoute={setEntryRoute}
          />
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
