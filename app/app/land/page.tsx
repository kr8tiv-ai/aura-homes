"use client";

// LAND stage: filter real parcel listings against the design. The district
// minimum rejection (Lakeside Estates at 1,076 sqft vs an 800 sqft design)
// is the demo moment — bylaws bite at the district level, never the county.

import { useState } from "react";
import { filterParcels, sampleParcels } from "@/lib/parcels";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

export default function LandPage() {
  const [sizeSqft, setSizeSqft] = useState("800");
  const [waterSource, setWaterSource] = useState<"cistern" | "well">("cistern");

  const size = Number.parseInt(sizeSqft, 10);
  const results = Number.isFinite(size) && size > 0
    ? filterParcels(sampleParcels, { sizeSqft: size, waterSource })
    : [];
  const passCount = results.filter((r) => r.verdict === "PASS").length;

  return (
    <div className="py-16">
      <p className="aura-label mb-4">Land discovery</p>
      <h1 className="text-3xl font-semibold">Find land that passes</h1>
      <p className="mt-3 max-w-xl text-sm text-aura-text/60">
        Every parcel is checked against the district land-use bylaw, aquifer reliability,
        grid distance, and septic soils before you spend a dollar on it.
      </p>

      <div className="aura-panel mt-10 flex flex-wrap items-end gap-6 p-6">
        <label className="block">
          <span className="aura-label mb-2 block">Design size (sqft)</span>
          <input
            value={sizeSqft}
            onChange={(e) => setSizeSqft(e.target.value)}
            inputMode="numeric"
            className="w-40 rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text outline-none focus:border-aura-emerald"
          />
        </label>
        <label className="block">
          <span className="aura-label mb-2 block">Water source</span>
          <select
            value={waterSource}
            onChange={(e) => setWaterSource(e.target.value as "cistern" | "well")}
            className="w-48 rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text outline-none focus:border-aura-emerald"
          >
            <option value="cistern">Buried cistern</option>
            <option value="well">Drilled well</option>
          </select>
        </label>
        <p className="ml-auto text-xs uppercase tracking-label text-aura-text/50">
          {results.length > 0
            ? `${passCount} of ${results.length} parcels pass`
            : "Enter a design size"}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {results.map(({ parcel, verdict, reasons }) => (
          <div key={parcel.id} className="aura-panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{parcel.name}</p>
                <p className="mt-1 text-xs text-aura-text/50">
                  {parcel.county} &middot; {parcel.district} district
                  {parcel.acreage ? ` · ${parcel.acreage} acres` : ""}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <p className="text-sm tabular-nums">{cad(parcel.priceCad)}</p>
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
            <div className="mt-4 grid gap-x-8 gap-y-1 text-xs text-aura-text/50 md:grid-cols-3">
              <p>
                District minimum:{" "}
                {parcel.minDwellingSizeSqft
                  ? `${parcel.minDwellingSizeSqft.toLocaleString("en-CA")} sqft`
                  : "not verified"}
              </p>
              <p>Aquifer: {parcel.aquifer}</p>
              <p>Grid: ~{parcel.gridDistanceKm} km</p>
            </div>
            <ul className="mt-4 space-y-2">
              {reasons.map((reason, i) => (
                <li
                  key={i}
                  className={`text-sm leading-relaxed ${
                    reason.startsWith("Rejected")
                      ? "text-aura-violet"
                      : "text-aura-text/70"
                  }`}
                >
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-aura-text/40">
        Sample listings researched Aug 2026 (realtor.ca). District minimums: Lac Ste. Anne
        Agricultural 592 sqft, Country Residential 1,076 sqft — always verify the parcel
        district before purchase.
      </p>
    </div>
  );
}
