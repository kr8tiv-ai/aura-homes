"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Counter, GrowBar, Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import LandMap from "@/components/land/LandMap";
import { useAuraProject } from "@/components/project/ProjectContext";
import { createDiscoveryRecord, setProjectShortlist, upsertProjectDiscoveryRecord } from "@/lib/project/discoveryRecord";
import {
  DEMO_LAND_LISTINGS,
  LAND_LISTING_PROVIDERS,
  evaluateLandListing,
  type LandDesignRequirements,
  type LandFitResult,
} from "@/lib/marketplace/discovery";

const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const DEFAULT_REQUIREMENTS: LandDesignRequirements = {
  floorAreaSqft: 800,
  footprintSqft: 800,
  storeys: 1,
  maxHeightFt: 18,
  preferredWater: "cistern",
};

const VERDICT_LABEL: Record<LandFitResult["verdict"], string> = {
  "potential-match": "Potential match",
  "manual-review": "Needs evidence",
  "does-not-match": "Does not match",
};

const VERDICT_ORDER: Record<LandFitResult["verdict"], number> = {
  "potential-match": 0,
  "manual-review": 1,
  "does-not-match": 2,
};

function numberValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default function LandPage() {
  const { project, ready, update } = useAuraProject();
  const [requirements, setRequirements] = useState(DEFAULT_REQUIREMENTS);
  const [projectState, setProjectState] = useState<
    | { kind: "manual" }
    | { kind: "loading"; id: string }
    | { kind: "loaded"; id: string; name: string; hash: string }
    | { kind: "error"; message: string }
  >({ kind: "manual" });
  const [show, setShow] = useState<"all" | LandFitResult["verdict"]>("all");
  const [saveProblem, setSaveProblem] = useState<string | null>(null);

  useEffect(() => {
    const projectId = new URLSearchParams(window.location.search).get("project");
    if (!projectId) {
      if (!ready || !project) return;
      let alive = true;
      void import("@/lib/marketplace/designLandRequirements").then((adapter) => {
        if (!alive) return;
        setRequirements(adapter.deriveLandRequirements(project.design.document));
        setProjectState({ kind: "loaded", id: project.id, name: project.name, hash: project.design.documentHash });
      });
      return () => { alive = false; };
    }
    let alive = true;
    setProjectState({ kind: "loading", id: projectId });
    void Promise.all([
      import("@/lib/builder/orderSnapshot"),
      import("@/lib/marketplace/designLandRequirements"),
    ])
      .then(([orders, requirementsAdapter]) =>
        orders
          .loadBuilderOrderSnapshot(projectId)
          .then((snapshot) => ({ snapshot, requirementsAdapter })),
      )
      .then(({ snapshot, requirementsAdapter }) => {
        if (!alive) return;
        setRequirements(requirementsAdapter.deriveLandRequirements(snapshot.design));
        setProjectState({
          kind: "loaded",
          id: snapshot.projectId,
          name: snapshot.home.name,
          hash: snapshot.home.documentHash,
        });
      })
      .catch((cause) => {
        if (!alive) return;
        setProjectState({
          kind: "error",
          message: cause instanceof Error ? cause.message : String(cause),
        });
      });
    return () => {
      alive = false;
    };
  }, [project?.design.documentHash, project?.id, project?.name, ready]);

  const results = useMemo(
    () =>
      DEMO_LAND_LISTINGS.map((listing) => evaluateLandListing(listing, requirements)).sort(
        (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || b.score - a.score,
      ),
    [requirements],
  );
  const shown = show === "all" ? results : results.filter((result) => result.verdict === show);
  const potential = results.filter((result) => result.verdict === "potential-match").length;
  const review = results.filter((result) => result.verdict === "manual-review").length;
  const shortlisted = new Set(project?.discovery.land.shortlist ?? []);

  const updateNumber = (key: "floorAreaSqft" | "footprintSqft" | "maxHeightFt", raw: string) =>
    setRequirements((current) => ({ ...current, [key]: numberValue(raw, current[key]) }));

  const selectFromMap = useCallback((id: string) => {
    setShow("all");
    requestAnimationFrame(() => document.getElementById(`land-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, []);

  async function toggleShortlist(id: string) {
    if (!project) return;
    setSaveProblem(null);
    try {
      const result = results.find((item) => item.listing.id === id);
      const selected = !project.discovery.land.shortlist.includes(id);
      await update((current) => {
        const at = new Date();
        const withEvidence = selected && result ? upsertProjectDiscoveryRecord(current, "land", createDiscoveryRecord({
          id: `record-${result.listing.id}`,
          subjectId: result.listing.id,
          access: "demonstration",
          sourceLabel: "Aura demonstration fit scenario",
          sourceUrl: null,
          collectedAtISO: at.toISOString(),
          expiresAtISO: null,
          confidence: "declared",
          data: result,
        }), at) : current;
        return setProjectShortlist(withEvidence, "land", id, selected, at);
      });
    } catch (error) {
      setSaveProblem(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="py-16">
      <Reveal y={12}>
        <p className="aura-label mb-4">Land discovery · evidence before enthusiasm</p>
        <h1 className="max-w-3xl font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">
          Find land for the home you actually designed
        </h1>
      </Reveal>

      <Reveal className="mt-4 max-w-2xl" delay={0.08} y={12}>
        <p className="text-[0.95rem] leading-[1.65] text-aura-text/75">
          Aura compares the design&rsquo;s exact floor area, ground footprint, storeys and height
          with parcel evidence. Unknown zoning, setbacks, access, water or wastewater stays
          unknown. A high fit score is a screening result, never a permit or purchase opinion.
        </p>
      </Reveal>

      <Reveal className="mt-8" y={14}>
        <section aria-labelledby="land-map-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div><p className="aura-label">Project map</p><h2 id="land-map-heading" className="mt-2 font-display text-xl font-medium">Compare fit before opening a listing</h2></div>
            <p className="max-w-md text-xs leading-relaxed text-aura-text/60">Demonstration markers are approximate scenario locations, not parcels for sale. The authorized feed will replace them when connected.</p>
          </div>
          <LandMap results={results} onSelect={selectFromMap} />
        </section>
      </Reveal>

      <Reveal className="mt-9" delay={0.12} y={14}>
        <div className="aura-panel p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="aura-label">Listing access</p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-aura-text/75">
                Active MLS inventory is not scraped or copied. In-app MLS browsing turns on only
                through an authorized CREA DDF® or board/provider feed with the required
                attribution and permissions. Until then, the cards below are product demonstrations.
              </p>
            </div>
            <span className="rounded-full border border-aura-violet px-3 py-1 font-mono text-[0.62rem] uppercase tracking-label text-aura-violet">
              Live MLS not connected
            </span>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {LAND_LISTING_PROVIDERS.map((provider) => (
              <div key={provider.id} className="rounded-md border aura-hairline p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{provider.name}</p>
                  <span className="font-mono text-[0.58rem] uppercase tracking-label text-aura-text/50">
                    {provider.status.replace("-", " ")}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-aura-text/65">{provider.note}</p>
                <div className="mt-3 flex gap-4 text-[0.65rem] uppercase tracking-label">
                  <a className="text-aura-emerald underline underline-offset-4" href={provider.sourceUrl} target="_blank" rel="noreferrer">
                    Source
                  </a>
                  <a className="text-aura-text/55 underline underline-offset-4" href={provider.termsUrl} target="_blank" rel="noreferrer">
                    Terms
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="mt-8" delay={0.16} y={16}>
        <section className="aura-panel p-6 sm:p-7" aria-labelledby="design-fit-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="aura-label">Design fit</p>
              <h2 id="design-fit-heading" className="mt-2 font-display text-xl font-medium">
                {projectState.kind === "loaded" ? projectState.name : "Manual requirements"}
              </h2>
            </div>
            {projectState.kind === "loaded" ? (
              <p className="max-w-sm break-all text-right font-mono text-[0.6rem] leading-relaxed text-aura-text/50">
                Builder snapshot {projectState.hash.slice(0, 18)}…
              </p>
            ) : (
              <Link href="/build" className="text-xs text-aura-emerald underline underline-offset-4">
                Open the builder
              </Link>
            )}
          </div>

          {projectState.kind === "loading" ? (
            <p className="mt-4 text-sm text-aura-text/65">Loading design snapshot {projectState.id}…</p>
          ) : null}
          {projectState.kind === "error" ? (
            <p role="alert" className="mt-4 rounded-md border border-aura-violet px-4 py-3 text-sm leading-relaxed text-aura-violet">
              {projectState.message} The manual controls remain available; no design was replaced.
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="aura-label mb-2 block">Floor area · sqft</span>
              <input type="number" min="100" step="25" value={Math.round(requirements.floorAreaSqft)} onChange={(event) => updateNumber("floorAreaSqft", event.target.value)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="aura-label mb-2 block">Footprint · sqft</span>
              <input type="number" min="100" step="25" value={Math.round(requirements.footprintSqft)} onChange={(event) => updateNumber("footprintSqft", event.target.value)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="aura-label mb-2 block">Storeys</span>
              <select value={requirements.storeys} onChange={(event) => setRequirements((current) => ({ ...current, storeys: Number(event.target.value) as 1 | 2 }))} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm">
                <option value={1}>One</option>
                <option value={2}>Two</option>
              </select>
            </label>
            <label className="block">
              <span className="aura-label mb-2 block">Max height · ft</span>
              <input type="number" min="8" step="0.5" value={Number(requirements.maxHeightFt.toFixed(1))} onChange={(event) => updateNumber("maxHeightFt", event.target.value)} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm" />
            </label>
            <label className="block">
              <span className="aura-label mb-2 block">Water preference</span>
              <select value={requirements.preferredWater} onChange={(event) => setRequirements((current) => ({ ...current, preferredWater: event.target.value as LandDesignRequirements["preferredWater"] }))} className="w-full rounded-md border aura-hairline bg-aura-bg px-3 py-2.5 text-sm">
                <option value="cistern">Cistern</option>
                <option value="well">Well</option>
                <option value="either">Either</option>
              </select>
            </label>
          </div>
        </section>
      </Reveal>

      <Stagger className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          ["all", results.length, "Demonstration records"],
          ["potential-match", potential, "Potential matches"],
          ["manual-review", review, "Need evidence"],
        ].map(([id, count, label]) => (
          <StaggerItem key={id}>
            <button type="button" onClick={() => setShow(id as typeof show)} aria-pressed={show === id} className={`aura-panel aura-panel-lift w-full p-5 text-left ${show === id ? "ring-1 ring-aura-emerald" : ""}`}>
              <p className="font-display text-2xl tabular-nums"><Counter value={Number(count)} /></p>
              <p className="aura-label mt-2">{label}</p>
            </button>
          </StaggerItem>
        ))}
      </Stagger>

      <Stagger className="mt-6 space-y-5">
        {shown.map((result) => (
          <StaggerItem key={result.listing.id}>
            <article id={`land-${result.listing.id}`} className="aura-panel aura-panel-lift scroll-mt-32 p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <p className="text-base font-semibold">{result.listing.title}</p>
                  <p className="mt-1 text-xs text-aura-text/65">
                    {result.listing.region}{result.listing.acreage ? ` · ${result.listing.acreage} acres` : ""}
                  </p>
                  <p className="mt-3 text-[0.65rem] uppercase tracking-label text-aura-violet">
                    Demonstration only · not an active listing
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums">{result.listing.priceCad === null ? "Price unknown" : CAD.format(result.listing.priceCad)}</p>
                  <p className={`mt-2 text-xs font-medium uppercase tracking-label ${result.verdict === "does-not-match" ? "text-aura-violet" : "text-aura-emerald"}`}>
                    {VERDICT_LABEL[result.verdict]} · {result.score}/100
                  </p>
                </div>
              </div>
              <div className="mt-5 h-1 overflow-hidden rounded-full bg-aura-ink/10">
                <GrowBar pct={result.score} className={`h-full ${result.verdict === "does-not-match" ? "bg-aura-violet" : "bg-aura-emerald"}`} />
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {result.findings.map((finding) => (
                  <div key={finding.id} className="rounded-md border aura-hairline p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold">{finding.label}</p>
                      <span className={`font-mono text-[0.58rem] uppercase tracking-label ${finding.severity === "block" ? "text-aura-violet" : finding.severity === "pass" ? "text-aura-emerald" : "text-aura-text/50"}`}>
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-aura-text/65">{finding.detail}</p>
                    {finding.sourceUrl ? (
                      <a href={finding.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[0.62rem] uppercase tracking-label text-aura-emerald underline underline-offset-4">
                        Evidence source
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={!project}
                  aria-pressed={shortlisted.has(result.listing.id)}
                  onClick={() => void toggleShortlist(result.listing.id)}
                  className="rounded-md bg-aura-ink px-4 py-2 text-xs font-medium uppercase tracking-label text-aura-paper disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {!project ? "Start a project to save" : shortlisted.has(result.listing.id) ? "Saved to project" : "Save demo comparison"}
                </button>
                <Link href={`/concierge?parcel=${result.listing.id}`} className="rounded-md border aura-hairline px-4 py-2 text-xs font-medium uppercase tracking-label transition-colors hover:border-aura-emerald hover:text-aura-emerald">
                  Test in concierge
                </Link>
                <Link href="/contractors" className="text-xs text-aura-emerald underline underline-offset-4">
                  Find the build team
                </Link>
              </div>
            </article>
          </StaggerItem>
        ))}
      </Stagger>

      {saveProblem ? <p role="alert" className="mt-4 text-sm text-aura-violet">{saveProblem}</p> : null}

      {shown.length === 0 ? (
        <Reveal className="mt-6" y={10}>
          <div className="aura-panel p-7 text-sm leading-relaxed text-aura-text/70">
            No demonstration record is in that state for this design. Change the filter or adjust
            the requirements; Aura will not turn missing evidence into a match.
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
