"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Counter, GrowBar, Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import LandMap from "@/components/land/LandMap";
import ZoningLookup from "@/components/land/ZoningLookup";
import {
  PLOT_SETBACK_NOTE,
  PLOT_UNKNOWN_NOTE,
  isPlotOnSite,
  siteFromListing,
} from "@/components/land/plotSite";
import { useAuraProject } from "@/components/project/ProjectContext";
import { createDiscoveryRecord, setProjectShortlist, upsertProjectDiscoveryRecord } from "@/lib/project/discoveryRecord";
import { withProjectSite } from "@/lib/project/document";
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

/* THE NON-DEMONSTRATION SOURCE IS EMPTY, and it is a constant rather than a
   fresh `[]` so the memo below does not re-run on every render.

   /contractors can offer `userProfiles` here because a contractor is a real
   subject a person can bring: they found the company, they read the registry,
   they record what they checked. Land has no equivalent. A person typing in a
   parcel they saw for sale would be entering exactly the record this codebase
   refuses to hold — a claim about what is on the market, sourced from nobody.
   So the honest cold state is nothing at all, said out loud. */
const NO_LAND_RECORDS: typeof DEMO_LAND_LISTINGS = [];

/* The four things this page is not allowed to imply, in any wording. They are
   printed above everything else because a reader forms an expectation from the
   first screen, and this page's whole difficulty is that "find land" sounds
   like a search for land somebody is selling. It is not one. */
const NOT_PROMISED: ReadonlyArray<{ claim: string; because: string }> = [
  {
    claim: "It does not give a height ceiling from an address.",
    because:
      "A property register carries base zone codes and drops the h and f modifiers, which are the one thing the district register can evidence. An address can name the district. The district still refuses the ceiling.",
  },
  {
    claim: "It does not give a lot width and depth.",
    because:
      "A property register publishes an area. No free City of Edmonton source publishes frontage, so the frontage has to come from the person who owns the lot, and any depth derived from it is arithmetic on that number.",
  },
  {
    claim: "It does not make a parcel a match.",
    because:
      "The district check has two verdicts and gains no third. A lot you state yourself is checked against the rules; it is never returned as a pass.",
  },
  {
    claim: "It does not need the network.",
    because:
      "The zoning rules are baked into Aura and every check on this page runs in your browser. Where a live call to the City is offered, it can fail without taking anything else on the page down.",
  },
];

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
  /* FICTION IS OFF BY DEFAULT — /contractors:46, the same rule for the same
     reason. A visitor's first experience of this page must not be four
     invented parcels; the demonstration records exist to exercise the fit
     engine's pass, refusal and unknown-evidence states, and that is a thing a
     person asks for, not a thing they are handed. */
  const [demoMode, setDemoMode] = useState(false);
  /* One card at a time answers, because one card at a time was pressed. The
     id keeps the answer under the plot it belongs to. */
  const [plotState, setPlotState] = useState<
    | { kind: "idle" }
    | { kind: "no-project"; id: string }
    | { kind: "saved"; id: string }
    | { kind: "problem"; id: string; message: string }
  >({ kind: "idle" });

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

  /* ONE TERNARY IS THE WHOLE SWITCH — /contractors:71. Everything downstream
     reads `sourceListings` and needs no further branching, which is what keeps
     the two modes from drifting apart. */
  const sourceListings = useMemo(() => (demoMode ? DEMO_LAND_LISTINGS : NO_LAND_RECORDS), [demoMode]);
  const results = useMemo(
    () =>
      sourceListings.map((listing) => evaluateLandListing(listing, requirements)).sort(
        (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || b.score - a.score,
      ),
    [requirements, sourceListings],
  );
  const shown = show === "all" ? results : results.filter((result) => result.verdict === show);
  const potential = results.filter((result) => result.verdict === "potential-match").length;
  const review = results.filter((result) => result.verdict === "manual-review").length;
  const shortlisted = new Set(project?.discovery.land.shortlist ?? []);
  const currentSite = project?.design.document.site ?? null;

  const updateNumber = (key: "floorAreaSqft" | "footprintSqft" | "maxHeightFt", raw: string) =>
    setRequirements((current) => ({ ...current, [key]: numberValue(raw, current[key]) }));

  const selectFromMap = useCallback((id: string) => {
    setShow("all");
    requestAnimationFrame(() => document.getElementById(`land-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, []);

  /* Leaving demonstration mode clears what demonstration mode said. A filter
     or a per-card answer left standing over an empty page would be a sentence
     about records that are no longer on screen. */
  function toggleDemoMode() {
    const next = !demoMode;
    setDemoMode(next);
    if (!next) {
      setShow("all");
      setPlotState({ kind: "idle" });
      setSaveProblem(null);
    }
  }

  async function toggleShortlist(id: string) {
    /* Both writers below start with the same guard. Today it cannot fire —
       `sourceListings` is empty outside demonstration mode, so there is no
       card to press — and it is here anyway because the thing it prevents is
       the thing that must never happen: a fictional parcel reaching a saved
       project through some later path that forgot which mode it was in. */
    if (!demoMode) return;
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

  /* THE PLOT GOES UNDER THE HOME. Not into a shortlist — onto the design
     itself, where the viewport, the A1 site plan and the pile schedule all
     already look. Refusing quietly would be the wrong failure here, so a
     visitor with no project open is told so and sent somewhere. */
  async function useThisPlot(result: LandFitResult) {
    if (!demoMode) return;
    const site = siteFromListing(result.listing);
    if (!site) return;
    if (!project) {
      setPlotState({ kind: "no-project", id: result.listing.id });
      return;
    }
    setPlotState({ kind: "idle" });
    try {
      await update((current) => withProjectSite(current, site, new Date()));
      setPlotState({ kind: "saved", id: result.listing.id });
    } catch (error) {
      setPlotState({
        kind: "problem",
        id: result.listing.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <div className="py-16">
      <Reveal y={12}>
        <p className="aura-label mb-4">Land fit pilot · evidence before enthusiasm</p>
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
        {/* THE SIGNPOST, kept and re-pointed. It used to send a reader PAST four
            fictionalized cards to reach the real half of the page. The real
            half is now the next thing on screen, so the sentence states what
            that surface is instead of where it is hiding.

            The old closing clause — that the lookup "cannot find a district
            from a street address, that needs parcel geometry Aura does not
            hold" — is deliberately not restated here. It was a claim about
            polygon geometry, and a per-property register publishes the zone
            code as an attribute without any geometry at all. Rather than guess
            at what that surface will offer, this page says only what is true
            either way. */}
        <p className="mt-3 text-[0.95rem] leading-[1.65] text-aura-text/75">
          The real surface on this page is the City of Edmonton zoning lookup below. It is
          published authority data, it can refuse a design with the bylaw section behind the
          refusal, and it holds the rules that govern land rather than the land itself.
        </p>
      </Reveal>

      {/* WHAT THIS DOES NOT PROMISE, before it does anything. */}
      <Reveal className="mt-8" delay={0.1} y={14}>
        <section className="aura-panel p-6 sm:p-7" aria-labelledby="land-boundary-heading">
          <p className="aura-label">What this page does not promise</p>
          <h2 id="land-boundary-heading" className="mt-2 max-w-3xl font-display text-xl font-medium leading-snug">
            Aura can tell you what the City of Edmonton&rsquo;s rules and its property register say
            about a lot you already have. It cannot tell you which land somebody is selling, it
            cannot confirm a lot is yours to buy, and nothing here is a survey, a permit, or a
            development approval.
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {NOT_PROMISED.map((item) => (
              <li key={item.claim} className="rounded-md border aura-hairline p-4">
                <p className="text-xs font-semibold">{item.claim}</p>
                <p className="mt-2 text-xs leading-relaxed text-aura-text/65">{item.because}</p>
              </li>
            ))}
          </ul>
        </section>
      </Reveal>

      {/* The design-fit controls sit directly above the zoning lookup because
          they are what it checks against — these five numbers are the single
          `requirements` object handed to the district engine. */}
      <Reveal className="mt-8" delay={0.12} y={16}>
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

      {/* THE REAL DATA IS THE PAGE'S FIRST EVIDENCE, not its last. It used to
          sit below the provider panel and the fixture; a fictionalized card
          reaching a reader before published authority data is a hierarchy that
          says the fixture is the main event. */}
      <Reveal className="mt-8" delay={0.16} y={16}>
        {/* THE ANCHOR IS THIS PAGE'S, not the component's. `tests/land-page-order.spec.ts`
            measures that the real surface precedes the demonstration one, and it
            needs a marker whose lifetime this file controls: `ZoningLookup` carries
            its own `data-slot`, but that file belongs to another module and an
            attribute rename there would redden an ordering gate for a reason that
            has nothing to do with ordering. The wrapper adds no layout — it is an
            unstyled block inside the Reveal — and it leaves the element below
            byte-identical, which `tests/land-ui.spec.ts:323` matches literally. */}
        <div data-slot="land-real-surface">
          <ZoningLookup requirements={requirements} />
        </div>
      </Reveal>

      {/* WHY THERE IS NO INVENTORY, stated by the providers themselves. This
          panel is outside the demonstration toggle on purpose: the reason Aura
          shows no active listings is true in both modes and does not become
          less true when a reader opens the fixture. */}
      <Reveal className="mt-9" delay={0.18} y={14}>
        <section id="listing-access" className="aura-panel p-6 sm:p-7" aria-labelledby="listing-access-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="aura-label">Listing access</p>
              <h2 id="listing-access-heading" className="mt-2 max-w-2xl text-sm leading-relaxed text-aura-text/75">
                Active MLS inventory is not scraped or copied. In-app MLS browsing turns on only
                through an authorized CREA DDF® or board/provider feed with the required
                attribution and permissions. Until then, Aura holds no land inventory of its own.
              </h2>
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
        </section>
      </Reveal>

      {/* THE FIXTURE, BEHIND A PRESS. */}
      <Reveal className="mt-8" delay={0.2} y={14}>
        <section className="aura-panel p-6 sm:p-7" aria-labelledby="demonstration-heading" data-slot="land-demonstration">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="aura-label">{demoMode ? "Explicit demonstration mode" : "Your own land"}</p>
              <h2 id="demonstration-heading" className="mt-2 font-display text-xl font-medium">
                {demoMode ? "Four fictional parcels, exercising the fit engine" : "Aura holds no land inventory"}
              </h2>
            </div>
            <button
              type="button"
              aria-pressed={demoMode}
              data-slot="land-demo-toggle"
              onClick={toggleDemoMode}
              className="rounded-md border aura-hairline px-4 py-2 text-xs uppercase tracking-label transition-colors hover:border-aura-emerald hover:text-aura-emerald"
            >
              {demoMode ? "Return to your own land" : "Open demonstration parcels"}
            </button>
          </div>
          {demoMode ? (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-aura-text/70">
              Every record below is invented. They exist to exercise the fit engine&rsquo;s three
              honest outcomes — a design that fits the evidence, a design the evidence refuses, and
              a parcel with no evidenced envelope at all. None of them can be bought, and none of
              them describes a real place.
            </p>
          ) : (
            <div className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-aura-text/70">
              <p>
                Aura does not hold, buy, or index land. The reason is set out by the providers
                themselves under{" "}
                <a href="#listing-access" className="text-aura-emerald underline underline-offset-4">
                  Listing access
                </a>{" "}
                above: in-app MLS inventory requires an eligible broker relationship and an
                authorized feed, and Aura has neither.
              </p>
              <p>
                What this page can do is the zoning lookup overhead, and the lot you already have.
                A property register records who owns what; it never records what is being sold.
              </p>
              <p>
                Four fictional records exercising the fit engine sit behind the button above. They
                are a demonstration of the arithmetic, not a place to look for land.
              </p>
            </div>
          )}
        </section>
      </Reveal>

      {demoMode ? (
        <>
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

          <Reveal className="mt-8" y={14}>
            <section aria-labelledby="land-map-heading">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div><p className="aura-label">Project map</p><h2 id="land-map-heading" className="mt-2 font-display text-xl font-medium">Compare fit before opening a record</h2></div>
                <p className="max-w-md text-xs leading-relaxed text-aura-text/60">Demonstration markers are approximate scenario locations, not parcels for sale. The authorized feed will replace them when connected.</p>
              </div>
              <LandMap results={results} onSelect={selectFromMap} />
            </section>
          </Reveal>

          <Stagger className="mt-6 space-y-5">
            {shown.map((result) => {
              const plot = siteFromListing(result.listing);
              const onThisProject = isPlotOnSite(result.listing, currentSite);
              const said = plotState.kind !== "idle" && plotState.id === result.listing.id ? plotState : null;
              return (
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
                    {plot ? (
                      /* Never disabled. Pressed without a project it explains
                         itself below, which is a better answer than a dead
                         control that says nothing. */
                      <button
                        type="button"
                        aria-pressed={onThisProject}
                        onClick={() => void useThisPlot(result)}
                        className={`rounded-md border px-4 py-2 text-xs font-medium uppercase tracking-label transition-colors ${
                          onThisProject
                            ? "border-aura-emerald text-aura-emerald"
                            : "aura-hairline hover:border-aura-emerald hover:text-aura-emerald"
                        }`}
                      >
                        {onThisProject ? "This project’s plot" : "Use this plot"}
                      </button>
                    ) : null}
                    <Link href="/budget" className="rounded-md border aura-hairline px-4 py-2 text-xs font-medium uppercase tracking-label transition-colors hover:border-aura-emerald hover:text-aura-emerald">
                      Test the cost scenario
                    </Link>
                    <Link href="/contractors" className="text-xs text-aura-emerald underline underline-offset-4">
                      Find the build team
                    </Link>
                  </div>

                  {/* WHY THE SETBACKS ARE ZERO, next to the button that writes
                      them, because a reader who never opens the builder still
                      deserves to know what the number means. */}
                  {plot ? (
                    <div className="mt-4 max-w-2xl space-y-2">
                      <p className="text-xs leading-relaxed text-aura-text/60">{PLOT_SETBACK_NOTE}</p>
                      {said?.kind === "no-project" ? (
                        <p role="alert" className="text-xs leading-relaxed text-aura-violet">
                          No project is open, so there is nowhere to put this plot.{" "}
                          <Link href="/start" className="underline underline-offset-4">
                            Start a project
                          </Link>{" "}
                          and it will have somewhere to land.
                        </p>
                      ) : null}
                      {said?.kind === "saved" ? (
                        <p role="status" className="text-xs leading-relaxed tabular-nums text-aura-emerald">
                          Saved as this project&rsquo;s site: a {plot.parcel.lotWidthFt} × {plot.parcel.lotDepthFt} ft
                          lot with zero setbacks. Slope and the direction the front lot line faces are not
                          in this record, so the ground stays flat until the builder&rsquo;s Site step is
                          answered.
                        </p>
                      ) : null}
                      {said?.kind === "problem" ? (
                        <p role="alert" className="text-xs leading-relaxed text-aura-violet">
                          {said.message}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 max-w-2xl text-xs leading-relaxed text-aura-text/60">
                      {PLOT_UNKNOWN_NOTE}
                    </p>
                  )}
                </article>
              </StaggerItem>
              );
            })}
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
        </>
      ) : null}
    </div>
  );
}
