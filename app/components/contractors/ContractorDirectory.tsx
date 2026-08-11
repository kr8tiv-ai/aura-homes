"use client";

import { useMemo, useState } from "react";

import { GrowBar, Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import {
  DEMO_CONTRACTORS,
  contractorEvidenceScore,
  type ContractorProfile,
} from "@/lib/marketplace/discovery";

type Trade = ContractorProfile["trades"][number];

const TRADE_LABELS: Record<Trade, string> = {
  "whole-home-builder": "Whole home",
  "timber-and-envelope": "Timber + envelope",
  "site-and-foundation": "Site + foundation",
  "off-grid-systems": "Off-grid systems",
  interiors: "Interiors",
};

const READINESS_LABEL = {
  "shortlist-ready": "Shortlist-ready",
  "manual-review": "Manual review",
  "not-ready": "Not ready",
} as const;

export default function ContractorDirectory() {
  const [trade, setTrade] = useState<"all" | Trade>("all");
  const [region, setRegion] = useState("all");
  const [legalName, setLegalName] = useState("");
  const now = useMemo(() => new Date(), []);
  const profiles = useMemo(
    () =>
      DEMO_CONTRACTORS.map((profile) => contractorEvidenceScore(profile, now))
        .filter((result) => trade === "all" || result.profile.trades.includes(trade))
        .filter((result) => region === "all" || result.profile.region === region)
        .sort((a, b) => b.score - a.score),
    [now, region, trade],
  );
  const regions = useMemo(
    () => Array.from(new Set(DEMO_CONTRACTORS.map((profile) => profile.region))),
    [],
  );

  return (
    <>
      <Reveal y={12} className="mt-9">
        <div className="aura-panel p-6 sm:p-7">
          <p className="aura-label">What this score means</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/75">
            It is an evidence-completeness score, not Aura&rsquo;s endorsement and not a prediction
            of workmanship. An active Alberta residential builder licence, current WCB clearance,
            liability insurance, applicable consumer licence, comparable projects, and independent
            review evidence each contribute visibly. Missing or expired mandatory evidence keeps a
            firm out of the ready state even when the total looks strong.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <a href="https://residentialprotection.alberta.ca/public-registry/Builder" target="_blank" rel="noreferrer" className="rounded-md border aura-hairline p-4 text-xs leading-relaxed transition-colors hover:border-aura-emerald">
              <span className="aura-label block">Official source</span>
              <span className="mt-2 block">Alberta builder registry ↗</span>
            </a>
            <a href="https://www.wcb.ab.ca/insurance-and-premiums/clearance-letters/" target="_blank" rel="noreferrer" className="rounded-md border aura-hairline p-4 text-xs leading-relaxed transition-colors hover:border-aura-emerald">
              <span className="aura-label block">Official source</span>
              <span className="mt-2 block">WCB clearance letters ↗</span>
            </a>
            <a href="https://www.servicealberta.gov.ab.ca/consumer/business_search/index.cfm" target="_blank" rel="noreferrer" className="rounded-md border aura-hairline p-4 text-xs leading-relaxed transition-colors hover:border-aura-emerald">
              <span className="aura-label block">Official source</span>
              <span className="mt-2 block">Service Alberta licence search ↗</span>
            </a>
          </div>
        </div>
      </Reveal>

      <Reveal y={12} className="mt-7">
        <section className="aura-panel p-6 sm:p-7" aria-labelledby="contractor-search-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="aura-label">Search and verify</p>
              <h2 id="contractor-search-heading" className="mt-2 font-display text-xl font-medium">
                Build-team evidence desk
              </h2>
            </div>
            <span className="rounded-full border border-aura-violet px-3 py-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">
              Demonstration profiles
            </span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label>
              <span className="aura-label mb-2 block">Trade</span>
              <select value={trade} onChange={(event) => setTrade(event.target.value as "all" | Trade)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm">
                <option value="all">All trades</option>
                {(Object.keys(TRADE_LABELS) as Trade[]).map((id) => <option key={id} value={id}>{TRADE_LABELS[id]}</option>)}
              </select>
            </label>
            <label>
              <span className="aura-label mb-2 block">Region</span>
              <select value={region} onChange={(event) => setRegion(event.target.value)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm">
                <option value="all">All pilot regions</option>
                {regions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="aura-label mb-2 block">Exact legal name to verify</span>
              <input value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Enter the quote&rsquo;s legal entity" className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm" />
            </label>
          </div>
          {legalName.trim() ? (
            <div className="mt-5 rounded-md border aura-hairline p-4">
              <p className="text-sm font-medium">Verify “{legalName.trim()}” as an exact legal name</p>
              <p className="mt-2 text-xs leading-relaxed text-aura-text/65">
                Open each official source above and search the same legal entity shown on the quote.
                Aura does not auto-match near names: a similarly named corporation is not the same contractor.
              </p>
            </div>
          ) : null}
        </section>
      </Reveal>

      <Stagger className="mt-7 grid gap-6 lg:grid-cols-2">
        {profiles.map((result) => (
          <StaggerItem key={result.profile.id} className="h-full">
            <article className="aura-panel aura-panel-lift h-full p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold">{result.profile.displayName}</p>
                  <p className="mt-1 text-xs text-aura-text/60">{result.profile.region}</p>
                  <p className="mt-2 text-[0.62rem] uppercase tracking-label text-aura-violet">
                    Fictional demonstration · not a referral
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl tabular-nums">{result.score}<span className="text-sm text-aura-text/45">/100</span></p>
                  <p className={`mt-1 text-[0.62rem] uppercase tracking-label ${result.readiness === "shortlist-ready" ? "text-aura-emerald" : "text-aura-violet"}`}>
                    {READINESS_LABEL[result.readiness]}
                  </p>
                </div>
              </div>
              <div className="mt-5 h-1 overflow-hidden rounded-full bg-aura-ink/10">
                <GrowBar pct={result.score} className={`h-full ${result.readiness === "shortlist-ready" ? "bg-aura-emerald" : "bg-aura-violet"}`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.profile.trades.map((item) => <span key={item} className="rounded-full border aura-hairline px-3 py-1 text-[0.62rem] uppercase tracking-label text-aura-text/60">{TRADE_LABELS[item]}</span>)}
              </div>
              <div className="mt-5 space-y-2">
                {result.contributions.map((item) => (
                  <div key={item.kind} className="flex items-start justify-between gap-4 border-b aura-hairline py-2.5 last:border-b-0">
                    <div>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className={`mt-1 font-mono text-[0.58rem] uppercase tracking-label ${item.state === "confirmed" ? "text-aura-emerald" : item.state === "negative" || item.state === "expired" ? "text-aura-violet" : "text-aura-text/45"}`}>{item.state}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-[0.6rem] uppercase tracking-label text-aura-emerald underline underline-offset-4">Check</a> : null}
                      <span className="font-mono text-[0.65rem] text-aura-text/55">+{item.points}/{item.possiblePoints}</span>
                    </div>
                  </div>
                ))}
              </div>
              {result.blockers.length > 0 ? (
                <div className="mt-5 rounded-md border border-aura-violet p-4">
                  <p className="aura-label text-aura-violet">Before shortlisting</p>
                  <ul className="mt-2 space-y-1 text-xs leading-relaxed text-aura-text/70">
                    {result.blockers.map((item) => <li key={item}>· {item}</li>)}
                  </ul>
                </div>
              ) : null}
            </article>
          </StaggerItem>
        ))}
      </Stagger>

      {profiles.length === 0 ? (
        <Reveal y={10} className="mt-7">
          <div className="aura-panel p-7 text-sm text-aura-text/70">
            No demonstration profile covers that trade and region. The empty result is preserved;
            Aura does not broaden the search silently.
          </div>
        </Reveal>
      ) : null}
    </>
  );
}
