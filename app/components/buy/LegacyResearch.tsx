/* LEGACY RESEARCH — the record behind the catalog, kept readable.

   Seven maker records were researched for crypto-payment acceptance in
   August 2026. Three of them describe a finished home and appear in the
   catalog above; the other four do not, and this section says exactly why
   instead of quietly dropping them. The refuted leads stay too — a
   catalog is only as trustworthy as the entries it threw away.

   Server component: all of this is static text from the research JSON. */

import EvidenceBadge from "./EvidenceBadge";
import { PROVIDERS, REFUTED, tierMeaning } from "./data";
import { FINISHED_HOME_MODELS } from "@/lib/marketplace/homeModels";

/** Why each record is or is not a catalog entry — stated, not implied. */
const DISPOSITION: Record<string, string> = {
  "Armstrong Steel": "In the catalog as a residential steel building system.",
  BOXABL: "In the catalog as the Casita foldable factory-built unit.",
  "Lib Work Co., Ltd. (TSE: 1431)": "In the catalog as Lib Earth House model B.",
  "Crypto Emporium":
    "Not in the catalog: a marketplace of existing location-fixed properties, not a finished home you can order.",
  "RAK Properties PJSC":
    "Not in the catalog: UAE-situated developer units — existing property, and the maker claims nothing eco.",
  "Robinson Home Builders":
    "Not in the catalog: a local Massachusetts site-built service, not an orderable home model.",
  "Hotomobil (CyberGlad)":
    "Not in the catalog: a truck-bed camper cabin, not a home — the researcher's own words.",
};

export default function LegacyResearch() {
  const inCatalog = new Set(FINISHED_HOME_MODELS.map((home) => home.legacyProviderName));
  return (
    <section className="mt-24" aria-label="Legacy research">
      <p className="aura-label">Legacy research</p>
      <h2 className="mt-2 font-display text-[1.6rem] font-medium tracking-[-0.02em]">
        The record behind the catalog
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/75">
        Seven maker records were fetched and checked in August 2026. Three describe a finished
        home and appear above. Four do not — they stay here, with the researcher&rsquo;s caveats
        intact, so nobody mistakes a checked record for a listing or re-checks a dead lead.
      </p>

      <div className="mt-8 space-y-3">
        {PROVIDERS.map((provider) => (
          <details key={provider.name} className="aura-panel p-5">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <span>
                <span className="font-display text-sm font-medium">{provider.name}</span>
                <span className="ml-2 text-xs text-aura-dim">{provider.country}</span>
              </span>
              <span className="font-mono text-[0.6rem] uppercase tracking-label text-aura-dim">
                {inCatalog.has(provider.name) ? "In catalog" : "Research only"}
              </span>
            </summary>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-aura-text/75">
              <p className="font-medium text-aura-text">
                {DISPOSITION[provider.name] ?? "Kept as research only."}
              </p>
              <p>{provider.productType}</p>
              <blockquote className="border-l-2 border-aura-teal/50 pl-3 italic">
                &ldquo;{provider.quote}&rdquo;
              </blockquote>
              <p>{provider.caveat}</p>
              <div className="flex flex-wrap items-center gap-3">
                <EvidenceBadge tier={provider.evidenceTier} href={provider.evidenceUrl} cursor="Check" />
                <span className="font-mono text-[0.6rem] uppercase tracking-label text-aura-dim">
                  checked {provider.evidenceCheckedAtISO.slice(0, 10)}
                </span>
              </div>
              <p className="text-aura-dim">{tierMeaning(provider.evidenceTier)}</p>
            </div>
          </details>
        ))}
      </div>

      <details className="aura-panel mt-8 p-5">
        <summary className="cursor-pointer font-display text-sm font-medium">
          {REFUTED.length} leads checked and refuted
        </summary>
        <div className="mt-4 space-y-3">
          {REFUTED.map((finding, index) => (
            <div key={finding.slice(0, 40)} className="flex gap-4">
              <span className="font-mono text-[0.65rem] text-aura-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-xs leading-relaxed text-aura-text/75">{finding}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
