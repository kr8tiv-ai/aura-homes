"use client";

// LAND stage: filter real parcel listings against the design, using the
// agent's OWN filter and parcel data (agent/src/parcels.ts +
// agent/samples/parcels.sample.json, imported directly — the old hand-mirrored
// copy in app/lib/parcels.ts is gone, so this page can never drift from the
// agent). The district minimum rejection (Lakeside Estates at 1,076 sqft vs an
// 800 sqft design) is the demo moment — bylaws bite at the district level,
// never the county. BUY happens in the concierge, where the land gate binds it.

import Link from "next/link";
import { useState } from "react";
import { filterParcels } from "@agent/parcels";
import { BASE_QUESTIONNAIRE, PARCELS } from "@/lib/concierge";
import { Reveal, Stagger, StaggerItem, GrowBar, Counter } from "@/components/Reveal";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;
// Module-level so <Counter>'s effect deps stay referentially stable: an inline
// arrow would be a new function every keystroke in the filter above, and the
// price would restart its count-up on each one.
const cadCount = (n: number) => cad(Math.round(n));

export default function LandPage() {
  const [sizeSqft, setSizeSqft] = useState("800");
  const [waterSource, setWaterSource] = useState<"cistern" | "well">("cistern");

  const size = Number.parseInt(sizeSqft, 10);
  const results =
    Number.isFinite(size) && size > 0
      ? filterParcels(PARCELS, {
          ...BASE_QUESTIONNAIRE,
          home: { ...BASE_QUESTIONNAIRE.home, sizeSqft: size },
          water: { ...BASE_QUESTIONNAIRE.water, source: waterSource },
        })
      : [];
  const passCount = results.filter((r) => r.verdict === "PASS").length;
  const passPct = results.length > 0 ? (passCount / results.length) * 100 : 0;

  return (
    <div className="py-16">
      <Reveal y={12}>
        <p className="aura-label mb-4">Land discovery</p>
        <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">Find land that passes</h1>
      </Reveal>
      <Reveal className="mt-4 max-w-xl" delay={0.08} y={12}>
        <p className="text-[0.95rem] leading-[1.65] text-aura-text/75">
          Every parcel is checked against the district land-use bylaw, aquifer reliability,
          grid distance, and septic soils before you spend a dollar on it. The same check gates
          the BUY button in the concierge — a failing parcel cannot take a deposit.
        </p>
      </Reveal>

      <Reveal className="mt-10" delay={0.16} y={16}>
        <div className="aura-panel aura-panel-lift flex flex-wrap items-end gap-6 p-6">
          <label className="block">
            <span className="aura-label mb-2 block">Design size (sqft)</span>
            <input
              value={sizeSqft}
              onChange={(e) => setSizeSqft(e.target.value)}
              inputMode="numeric"
              className="w-40 rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text"
            />
          </label>
          <label className="block">
            <span className="aura-label mb-2 block">Water source</span>
            <select
              value={waterSource}
              onChange={(e) => setWaterSource(e.target.value as "cistern" | "well")}
              className="w-48 rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text"
            >
              <option value="cistern">Buried cistern</option>
              <option value="well">Drilled well</option>
            </select>
          </label>
          <p className="ml-auto text-xs uppercase tracking-label text-aura-text/70">
            {results.length > 0
              ? `${passCount} of ${results.length} parcels pass`
              : "Enter a design size"}
          </p>
          {/* the pass ratio already stated above, drawn — GrowBar so it fills
              from zero on entry instead of appearing pre-filled */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-aura-ink/10">
            <GrowBar pct={passPct} className="h-full rounded-full bg-aura-emerald-bright" delay={0.2} />
          </div>
        </div>
      </Reveal>

      <Stagger className="mt-6 space-y-4">
        {results.map(({ parcel, verdict, reasons }) => (
          <StaggerItem key={parcel.id}>
            <div className="aura-panel aura-panel-lift p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{parcel.name}</p>
                  <p className="mt-1 text-xs text-aura-text/70">
                    {parcel.county} &middot; {parcel.district} district
                    {parcel.acreage ? ` · ${parcel.acreage} acres` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <p className="text-sm tabular-nums">
                    <Counter value={parcel.priceCad} format={cadCount} />
                  </p>
                  <span
                    className={`rounded-md border px-3 py-1 text-xs font-medium uppercase tracking-label ${
                      verdict === "PASS"
                        ? "border-aura-emerald text-aura-lime"
                        : "border-aura-violet text-aura-violet"
                    }`}
                  >
                    {verdict}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-x-8 gap-y-1 text-xs text-aura-text/70 md:grid-cols-3">
                <p>
                  District minimum:{" "}
                  {parcel.minDwellingSizeSqft
                    ? `${parcel.minDwellingSizeSqft.toLocaleString("en-CA")} sqft`
                    : "not verified — unconfirmed against the bylaw"}
                </p>
                <p>Aquifer: {parcel.aquifer}</p>
                <p>Grid: ~{parcel.gridDistanceKm} km</p>
              </div>
              <ul className="mt-4 space-y-2">
                {reasons.map((reason, i) => (
                  <li
                    key={i}
                    className={`text-sm leading-relaxed ${
                      /^rejected/i.test(reason) ? "text-aura-violet" : "text-aura-text/70"
                    }`}
                  >
                    {reason}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Link
                  href={`/concierge?parcel=${parcel.id}`}
                  data-cursor="Continue"
                  className="inline-block rounded-md border aura-hairline px-4 py-2 text-xs font-medium uppercase tracking-label transition-colors hover:border-aura-emerald hover:text-aura-emerald"
                >
                  Take this parcel to the concierge
                </Link>
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-8" y={12}>
        <p className="text-xs text-aura-text/65">
          Sample listings researched Aug 2026 (realtor.ca). District minimums: Lac Ste. Anne
          Agricultural 592 sqft, Country Residential 1,076 sqft. The Sturgeon County parcel&rsquo;s
          minimum is not yet verified against its land-use bylaw, and it is labeled that way rather
          than guessed — always verify the parcel district before purchase.
        </p>
      </Reveal>
    </div>
  );
}
