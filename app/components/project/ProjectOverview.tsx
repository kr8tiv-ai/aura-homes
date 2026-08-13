"use client";

// The real project overview for /dashboard. Every value on this page is read
// from the ACTIVE AuraProject v2 document — stepStates, budgetBasis, typed
// blockers, and the one recommended next action — never from fixtures and
// never inferred from data presence. Demo data advances nothing here: the
// journey renders exactly what stepStates says, and empty facts render as
// honest zeros rather than invented progress.

import Link from "next/link";
import { useMemo } from "react";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import RevealWords from "@/components/RevealWords";
import { deriveLandRequirements } from "@/lib/marketplace/designLandRequirements";
import { projectDiscoveryRecords } from "@/lib/project/discoveryRecord";
import {
  projectJourney,
  type AuraProject,
  type JourneyStepId,
  type ProjectBlocker,
} from "@/lib/project/document";
import { projectQuotesFromUnknown, type ProjectQuote } from "@/lib/project/quoteReconciliation";
import { validateProjectRfq } from "@/lib/project/rfq";
import { useAuraProject } from "./ProjectContext";

const cad = (n: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

const JOURNEY_LABEL: Record<AuraProject["journey"], string> = {
  "find-land-build": "Find land + build",
  "build-on-owned-land": "Build on your own land",
  "buy-finished-home": "Buy a finished home",
};
const PURPOSE_LABEL: Record<AuraProject["purpose"], string> = {
  "primary-home": "Primary home",
  "eco-stay": "Eco stay",
};
const LAND_STATUS_LABEL: Record<AuraProject["requirements"]["landStatus"], string> = {
  searching: "Searching for land",
  owned: "Building on land you own",
  "included-with-home": "Land comes with the home",
};

const STEP_LABEL: Record<JourneyStepId, string> = {
  requirements: "Requirements",
  design: "Design",
  land: "Land",
  team: "Team",
  quotes: "Quotes",
  funding: "Funding",
  build: "Build",
  operate: "Operate",
};

/* Deterministic concierge guidance: plain-language "what's next" copy keyed
   only off the recommended step id — the same input for the same output,
   every time. No payment mechanics are described here. */
const WHAT_NEXT: Record<JourneyStepId, string> = {
  requirements:
    "Tell us where you want to live, who the home is for, and what you can spend. Everything later builds on this brief.",
  design:
    "Choose a plan or shape your own home. The design is saved with a fingerprint, so every later document can prove exactly what it was based on.",
  land:
    "Record where the home will sit — a parcel you are searching for, land you already own, or the site that comes with a finished home.",
  team:
    "Collect a case file for each contractor or manufacturer you are considering. The evidence stays attached to this project.",
  quotes:
    "Prepare a planning cost basis, send request-for-quote packages, and compare vendor quotes against the same scopes.",
  funding:
    "Once a real scope and quote exist, confirm how each stage of the work will be paid. Nothing is committed from this page.",
  build:
    "Turn the accepted scope into explicit delivery checkpoints you can track one by one.",
  operate:
    "Keep commissioning records, warranties, and maintenance schedules together as the home's book.",
};

function stepRoute(stepId: JourneyStepId, journey: AuraProject["journey"]): string | null {
  switch (stepId) {
    case "requirements": return "/start";
    case "design": return "/build";
    case "land": return "/land";
    case "team": return journey === "buy-finished-home" ? "/buy" : "/contractors";
    case "quotes": return "/budget";
    case "funding": return "/budget";
    default: return null; // build and operate are tracked on this page
  }
}

function stepCta(stepId: JourneyStepId, journey: AuraProject["journey"]): string {
  switch (stepId) {
    case "requirements": return "Open the project brief";
    case "design": return "Open the builder";
    case "land": return "Find land";
    case "team": return journey === "buy-finished-home" ? "Compare manufacturers" : "Build your team";
    case "quotes": return "Open the budget workbench";
    case "funding": return "Review funding guidance";
    default: return "Tracked on this page";
  }
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  "not-started": { label: "Not started", tone: "text-aura-text/65" },
  "in-progress": { label: "In progress", tone: "text-aura-teal" },
  blocked: { label: "Blocked", tone: "text-aura-violet" },
  complete: { label: "Confirmed", tone: "text-aura-emerald" },
};

function quoteTotalCad(quote: ProjectQuote): number {
  return Math.round(quote.lines.reduce((sum, line) => sum + line.amountCad, 0) * 100) / 100;
}

function EmptyState({ problem }: { problem: string | null }) {
  return (
    <div className="py-16">
      <p className="aura-label mb-4">Project record</p>
      <Reveal y={10}>
        <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">
          No active project yet.
        </h1>
      </Reveal>
      <Reveal delay={0.06} y={10}>
        <p className="mt-4 max-w-xl text-[0.98rem] leading-[1.7] text-aura-text/75">
          Your project record lives here once you begin — the design you shape, the land you
          consider, your team&apos;s case files, real quotes, and the single next step that moves it
          all forward. Everything stays in this browser until you choose to share it.
        </p>
      </Reveal>
      {problem ? (
        <p role="status" className="mt-4 max-w-xl text-sm leading-relaxed text-aura-violet">
          {problem}
        </p>
      ) : null}
      <Reveal delay={0.12} y={10}>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/start"
            data-cursor="Begin"
            className="inline-flex min-h-11 items-center rounded-full bg-aura-ink px-6 py-3 font-mono text-xs font-medium uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
          >
            Start with your goals
          </Link>
          <Link
            href="/projects"
            className="inline-flex min-h-11 items-center py-2 text-xs uppercase tracking-label text-aura-teal hover:text-aura-emerald"
          >
            Import a saved project
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

export default function ProjectOverview() {
  const { project, ready, problem } = useAuraProject();

  const journey = useMemo(() => (project ? projectJourney(project) : null), [project]);
  const designFacts = useMemo(
    () => (project ? deriveLandRequirements(project.design.document) : null),
    [project],
  );
  const quotes = useMemo(
    () => (project ? projectQuotesFromUnknown(project.delivery.quotes) : []),
    [project],
  );
  const rfqCount = useMemo(
    () => (project ? project.delivery.rfqs.filter((rfq) => validateProjectRfq(rfq).ok).length : 0),
    [project],
  );
  const landRecordCount = useMemo(
    () => (project ? projectDiscoveryRecords(project, "land").length : 0),
    [project],
  );
  const teamKind = project?.journey === "buy-finished-home" ? "manufacturers" : "contractors";
  const teamRecordCount = useMemo(
    () => (project ? projectDiscoveryRecords(project, teamKind).length : 0),
    [project, teamKind],
  );

  if (!ready) {
    return (
      <div className="py-16" aria-busy="true">
        <p className="aura-label mb-4">Project record</p>
        <p className="text-sm text-aura-text/65">Opening your local project record…</p>
      </div>
    );
  }
  if (!project || !journey) return <EmptyState problem={problem} />;

  const openBlockers = project.blockers.filter((blocker) => blocker.resolvedAtISO === null);
  const resolvedCount = project.blockers.length - openBlockers.length;
  const blockerByStep = new Map<JourneyStepId, ProjectBlocker>();
  for (const blocker of openBlockers) {
    if (!blockerByStep.has(blocker.stepId)) blockerByStep.set(blocker.stepId, blocker);
  }

  const action = project.recommendedNextAction;
  const actionBlocked = action ? project.stepStates[action.stepId].status === "blocked" : false;
  const actionBlocker = action ? blockerByStep.get(action.stepId) : undefined;
  const actionRoute = action ? stepRoute(action.stepId, project.journey) : null;
  const following = action
    ? journey.steps.find((step) => !step.complete && step.id !== action.stepId)
    : undefined;

  const basis = project.budgetBasis;
  const basisCurrent = basis ? basis.designHash === project.design.documentHash : false;

  const records = [
    { label: "RFQ packages", count: rfqCount },
    { label: "Vendor quotes", count: quotes.length },
    { label: "Order snapshots", count: project.delivery.orderSnapshotIds.length },
    { label: "Delivery milestones", count: project.milestones.length },
    { label: "Home book artifacts", count: project.artifactManifests.length },
  ];

  return (
    <div className="py-16">
      {/* ---- head ---- */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="aura-label mb-4">Project record</p>
          <RevealWords
            text={project.name}
            className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
          />
          <p className="mt-3 text-sm leading-[1.6] text-aura-text/75">
            {JOURNEY_LABEL[project.journey]} · {PURPOSE_LABEL[project.purpose]}
            {project.requirements.location.municipality
              ? ` · ${project.requirements.location.municipality}, ${project.requirements.location.region}`
              : ` · ${project.requirements.location.region}`}
          </p>
          <p className="mt-1 text-xs text-aura-text/65">
            Started {fmtDate(project.createdAtISO)} · Updated {fmtDate(project.updatedAtISO)}
            {project.requirements.budgetCad.max !== null
              ? ` · Working budget up to ${cad(project.requirements.budgetCad.max)}`
              : ""}
          </p>
        </div>
        <Reveal delay={0.12} y={10}>
          <p className="text-xs uppercase tracking-label text-aura-teal">
            Saved in this browser · nothing here is shared
          </p>
        </Reveal>
      </div>

      {/* ---- THE recommended next action: the page's most prominent card ---- */}
      {action ? (
        <Reveal y={12}>
          <section
            aria-labelledby="recommended-next"
            className="mt-10 rounded-xl border border-aura-emerald/40 bg-aura-emerald/5 p-6 shadow-aura-2 sm:p-8"
          >
            <p className="aura-label">Recommended next step</p>
            <h2
              id="recommended-next"
              className="mt-3 font-display text-[1.75rem] font-medium leading-[1.12] tracking-[-0.02em] sm:text-[2rem]"
            >
              {action.label}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-aura-text/75">{action.reason}</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/75">
              {WHAT_NEXT[action.stepId]}
            </p>
            {actionBlocked ? (
              <p className="mt-4 max-w-2xl rounded-lg border border-aura-violet/50 bg-aura-violet/5 px-4 py-3 text-sm leading-relaxed text-aura-violet">
                This step is currently blocked
                {actionBlocker ? `: ${actionBlocker.summary}` : " — no reason has been recorded yet"}
                . Resolve the blocker below before pressing on.
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              {actionRoute ? (
                <Link
                  href={actionRoute}
                  data-cursor="Go"
                  className="inline-flex min-h-11 items-center rounded-full bg-aura-ink px-6 py-3 font-mono text-xs font-medium uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85"
                >
                  {stepCta(action.stepId, project.journey)}
                </Link>
              ) : (
                <span className="text-xs uppercase tracking-label text-aura-text/65">
                  Tracked on this page
                </span>
              )}
              {following ? (
                <span className="text-xs uppercase tracking-label text-aura-text/65">
                  After this · {STEP_LABEL[following.id]}
                </span>
              ) : null}
            </div>
          </section>
        </Reveal>
      ) : (
        <Reveal y={12}>
          <section className="mt-10 rounded-xl border border-aura-emerald/40 bg-aura-emerald/5 p-6 shadow-aura-2 sm:p-8">
            <p className="aura-label">Journey confirmed</p>
            <h2 className="mt-3 font-display text-[1.75rem] font-medium leading-[1.12] tracking-[-0.02em]">
              Every step of this journey is confirmed.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-aura-text/75">
              This record now serves as the home&apos;s book of evidence — designs, decisions, and
              documents, each with the fingerprint it was confirmed against.
            </p>
          </section>
        </Reveal>
      )}

      {/* ---- journey, exactly as recorded in stepStates ---- */}
      <section className="mt-12" aria-labelledby="journey-heading">
        <Reveal y={16}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="journey-heading" className="aura-label">Journey</h2>
            <p className="text-xs text-aura-text/65">
              Steps advance only when you confirm them — never from demo data
            </p>
          </div>
        </Reveal>
        <Stagger className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {journey.steps.map((step, index) => {
            const state = project.stepStates[step.id];
            const meta = STATUS_META[state.status];
            const reason = state.status === "blocked" ? blockerByStep.get(step.id) : undefined;
            const recommended = action?.stepId === step.id;
            return (
              <StaggerItem key={step.id} className="grid">
                <div
                  className={`rounded-lg border p-4 ${
                    state.status === "blocked" ? "border-aura-violet/50" : "aura-hairline"
                  } bg-aura-panel`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-mono text-xs tabular-nums text-aura-emerald">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    {recommended ? (
                      <span className="rounded border border-aura-emerald px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-label text-aura-emerald">
                        Next
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold uppercase tracking-label">
                    {STEP_LABEL[step.id]}
                  </p>
                  <p className={`mt-2 text-xs uppercase tracking-label ${meta.tone}`}>
                    {meta.label}
                    {state.status === "complete" && state.confirmedAtISO
                      ? ` · ${fmtDate(state.confirmedAtISO)}`
                      : ""}
                  </p>
                  {state.status === "complete" && state.basisHash ? (
                    <p className="mt-1 font-mono text-[0.62rem] text-aura-text/65">
                      Basis {state.basisHash.slice(0, 12)}…
                    </p>
                  ) : null}
                  {state.status === "blocked" ? (
                    <p className="mt-2 text-xs leading-relaxed text-aura-violet">
                      {reason ? reason.summary : "Marked blocked — no reason recorded yet."}
                    </p>
                  ) : null}
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      {/* ---- design and cost basis ---- */}
      <Stagger className="mt-12 grid gap-8 lg:grid-cols-2">
        <StaggerItem className="grid">
          <section className="aura-panel aura-panel-lift p-6" aria-labelledby="design-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="design-heading" className="aura-label">Design</h2>
              <Link
                href="/build"
                data-cursor="Open"
                className="py-2 text-xs uppercase tracking-label text-aura-teal hover:text-aura-emerald"
              >
                Open in the builder
              </Link>
            </div>
            <p className="mt-5 font-display text-[1.5rem] font-medium tracking-[-0.01em]">
              {project.design.document.spec.name}
            </p>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">Floor area</dt>
                <dd className="tabular-nums">
                  {designFacts ? `${Math.round(designFacts.floorAreaSqft).toLocaleString("en-CA")} sq ft` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">Ground footprint</dt>
                <dd className="tabular-nums">
                  {designFacts ? `${Math.round(designFacts.footprintSqft).toLocaleString("en-CA")} sq ft` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">Storeys</dt>
                <dd className="tabular-nums">{designFacts ? designFacts.storeys : "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">Design fingerprint</dt>
                <dd>
                  <code className="font-mono text-xs text-aura-text/75">
                    {project.design.documentHash.slice(0, 14)}…
                  </code>
                </dd>
              </div>
            </dl>
            <p className="mt-5 text-xs leading-relaxed text-aura-text/65">
              Concept model. Exported drawings remain marked NOT FOR CONSTRUCTION until a
              professional takes responsibility for them.
            </p>
          </section>
        </StaggerItem>

        <StaggerItem className="grid">
          <section className="aura-panel aura-panel-lift p-6" aria-labelledby="cost-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="cost-heading" className="aura-label">Cost basis</h2>
              <Link
                href="/budget"
                data-cursor="Open"
                className="py-2 text-xs uppercase tracking-label text-aura-teal hover:text-aura-emerald"
              >
                Full budget
              </Link>
            </div>
            {basis ? (
              <>
                <p className="mt-5 font-display text-[1.9rem] font-medium tracking-[-0.02em] tabular-nums">
                  {cad(basis.total.mid)}
                </p>
                <p className="mt-1 text-xs text-aura-text/70">
                  Planning midpoint · {cad(basis.total.low)} to {cad(basis.total.high)} · calculated{" "}
                  {fmtDate(basis.calculatedAtISO)}
                  {basis.municipality ? ` for ${basis.municipality}, ${basis.region}` : ` for ${basis.region}`}
                </p>
                <p
                  className={`mt-3 text-xs uppercase tracking-label ${
                    basisCurrent ? "text-aura-emerald" : "text-aura-violet"
                  }`}
                >
                  {basisCurrent
                    ? "Matches the current design"
                    : "Calculated against an earlier design — refresh it on the budget page"}
                </p>
                {basis.assumptions.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-label text-aura-text/65">Assumptions</p>
                    <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-aura-text/70">
                      {basis.assumptions.map((assumption) => (
                        <li key={assumption} className="flex gap-2">
                          <span aria-hidden className="text-aura-emerald">◆</span>
                          <span>{assumption}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-5 text-sm leading-relaxed text-aura-text/75">
                <strong className="font-semibold">No cost basis yet.</strong> Prepare one on the
                budget page — it becomes the honest baseline every quote is compared against, and it
                is dated so you always know how old it is.
              </p>
            )}
          </section>
        </StaggerItem>
      </Stagger>

      {/* ---- land and team ---- */}
      <Stagger className="mt-8 grid gap-8 lg:grid-cols-2">
        <StaggerItem className="grid">
          <section className="aura-panel aura-panel-lift p-6" aria-labelledby="land-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="land-heading" className="aura-label">Land</h2>
              <Link
                href="/land"
                data-cursor="Open"
                className="py-2 text-xs uppercase tracking-label text-aura-teal hover:text-aura-emerald"
              >
                Find land
              </Link>
            </div>
            <p className="mt-5 text-[1.05rem] font-medium">
              {LAND_STATUS_LABEL[project.requirements.landStatus]}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">Shortlisted parcels</dt>
                <dd className="tabular-nums">{project.discovery.land.shortlist.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">Evidence records</dt>
                <dd className="tabular-nums">{landRecordCount}</dd>
              </div>
            </dl>
            {project.discovery.land.shortlist.length === 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-aura-text/65">
                No parcels shortlisted yet. Saved comparisons from the land page appear here with
                their source and confidence.
              </p>
            ) : null}
          </section>
        </StaggerItem>

        <StaggerItem className="grid">
          <section className="aura-panel aura-panel-lift p-6" aria-labelledby="team-heading">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="team-heading" className="aura-label">
                {teamKind === "manufacturers" ? "Manufacturers" : "Team"}
              </h2>
              <Link
                href={stepRoute("team", project.journey) ?? "/contractors"}
                data-cursor="Open"
                className="py-2 text-xs uppercase tracking-label text-aura-teal hover:text-aura-emerald"
              >
                {teamKind === "manufacturers" ? "Compare manufacturers" : "Build your team"}
              </Link>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">Shortlisted</dt>
                <dd className="tabular-nums">{project.discovery[teamKind].shortlist.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">Case files</dt>
                <dd className="tabular-nums">{teamRecordCount}</dd>
              </div>
            </dl>
            {teamRecordCount === 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-aura-text/65">
                No case files yet. Each candidate you research keeps its evidence — registry
                checks, insurance records, references — attached to this project. Verification is
                recorded, never assumed.
              </p>
            ) : null}
          </section>
        </StaggerItem>
      </Stagger>

      {/* ---- quotes and their bound-hash freshness ---- */}
      <section className="mt-12" aria-labelledby="quotes-heading">
        <Reveal y={16}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="quotes-heading" className="aura-label">Quotes</h2>
            <Link
              href="/budget"
              data-cursor="Open"
              className="py-2 text-xs uppercase tracking-label text-aura-teal hover:text-aura-emerald"
            >
              Quote workbench
            </Link>
          </div>
        </Reveal>
        {quotes.length === 0 ? (
          <Reveal delay={0.05} y={10}>
            <div className="aura-panel mt-5 p-6">
              <p className="text-sm leading-relaxed text-aura-text/75">
                <strong className="font-semibold">No vendor quotes captured yet.</strong> When you
                add one it is compared against the planning cost basis for the same scopes —
                allowances, omissions, and stale dates stay visible instead of averaged away.
              </p>
            </div>
          </Reveal>
        ) : (
          <Stagger className="mt-5 space-y-4">
            {quotes.map((quote) => {
              const designChanged = quote.designHash !== project.design.documentHash;
              const expired =
                quote.validUntilISO !== null && Date.parse(quote.validUntilISO) < Date.now();
              const budgetState =
                quote.version === 1
                  ? "Not bound to a cost basis (older capture)"
                  : basis === null
                    ? "No saved cost basis to compare"
                    : quote.budgetHash === basis.budgetHash
                      ? "Priced against the saved cost basis"
                      : "Cost basis changed after this quote";
              return (
                <StaggerItem key={quote.id}>
                  <article className="aura-panel aura-panel-lift flex flex-wrap items-start justify-between gap-5 p-6">
                    <div className="min-w-[220px] flex-1">
                      <p className="text-sm font-semibold">{quote.vendorName}</p>
                      <p className="mt-1 text-xs text-aura-text/70">
                        Captured {fmtDate(quote.capturedAtISO)}
                        {quote.validUntilISO ? ` · valid until ${fmtDate(quote.validUntilISO)}` : ""}
                        {" · "}
                        {quote.lines.length} line{quote.lines.length === 1 ? "" : "s"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[0.62rem] font-mono uppercase tracking-label">
                        <span
                          className={`rounded border px-2 py-1 ${
                            designChanged
                              ? "border-aura-violet/60 text-aura-violet"
                              : "border-aura-emerald/60 text-aura-emerald"
                          }`}
                        >
                          {designChanged ? "Design changed after this quote" : "Matches the current design"}
                        </span>
                        <span className="rounded border aura-hairline px-2 py-1 text-aura-text/70">
                          {budgetState}
                        </span>
                        {expired ? (
                          <span className="rounded border border-aura-violet/60 px-2 py-1 text-aura-violet">
                            Past its valid-until date
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="font-display text-[1.35rem] font-medium tabular-nums">
                      {cad(quoteTotalCad(quote))}
                    </p>
                  </article>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </section>

      {/* ---- records and artifacts: honest counts, zeros included ---- */}
      <section className="mt-12" aria-labelledby="records-heading">
        <Reveal y={16}>
          <h2 id="records-heading" className="aura-label">Records</h2>
        </Reveal>
        <Stagger className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {records.map((record) => (
            <StaggerItem key={record.label} className="grid">
              <div className="rounded-lg border aura-hairline bg-aura-panel p-4">
                <p className="font-display text-[1.6rem] font-medium tabular-nums">{record.count}</p>
                <p className="mt-1 text-xs uppercase tracking-label text-aura-text/65">
                  {record.label}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal delay={0.05} y={10}>
          <p className="mt-3 text-xs text-aura-text/65">
            Counts reflect what this project actually holds. Nothing is projected, and a zero means
            exactly that.
          </p>
        </Reveal>
      </section>

      {/* ---- typed blockers ---- */}
      <section className="mt-12" aria-labelledby="blockers-heading">
        <Reveal y={16}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="blockers-heading" className="aura-label">Blockers</h2>
            {resolvedCount > 0 ? (
              <p className="text-xs text-aura-text/65">
                {resolvedCount} resolved earlier
              </p>
            ) : null}
          </div>
        </Reveal>
        {openBlockers.length === 0 ? (
          <Reveal delay={0.05} y={10}>
            <p className="mt-5 text-sm text-aura-text/75">No open blockers recorded.</p>
          </Reveal>
        ) : (
          <Stagger className="mt-5 space-y-4">
            {openBlockers.map((blocker) => (
              <StaggerItem key={blocker.id}>
                <article className="aura-panel flex flex-wrap items-start gap-5 border-aura-violet/50 p-6">
                  <div className="w-20 pt-0.5">
                    <span className="rounded border border-aura-violet px-2 py-1 text-[10px] font-semibold uppercase tracking-label text-aura-violet">
                      Blocked
                    </span>
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm font-semibold">{blocker.summary}</p>
                    {blocker.detail ? (
                      <p className="mt-1 text-xs leading-relaxed text-aura-text/70">{blocker.detail}</p>
                    ) : null}
                  </div>
                  <div className="text-right text-xs">
                    <p className="uppercase tracking-label text-aura-text/65">
                      {STEP_LABEL[blocker.stepId]}
                    </p>
                    <p className="mt-1 text-aura-text/75">
                      {blocker.source === "user" ? "Noted by you" : "Raised by Aura"} ·{" "}
                      {fmtDate(blocker.createdAtISO)}
                    </p>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}
