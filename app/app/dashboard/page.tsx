import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem, GrowBar, Counter } from "@/components/Reveal";
import {
  budgetFixture,
  dashboardFixture,
  milestonesFixture,
  slipsFixture,
  slipToNextAction,
} from "@/lib/fixtures";

// Owner dashboard for one build journey. Fixture-driven until the Aura Brain
// journey-state service is hosted; every number reconciles with the budget and
// milestone fixtures (MID $301,280 ex-land, 10% statutory holdback). Slip cards
// are the Aura Brain's own output (agent/src/brain/slips.ts via slipsFixture).

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

export const metadata = {
  title: "Dashboard — Aura Homes",
};

export default function DashboardPage() {
  const d = dashboardFixture;

  // Project payment position, derived from the milestone fixture.
  const totalCad = milestonesFixture.reduce((s, m) => s + m.amountCad, 0);
  const fundedCad = milestonesFixture
    .filter((m) => m.status === "Funded" || m.status === "Released")
    .reduce((s, m) => s + m.amountCad, 0);
  const releasedNetCad = milestonesFixture
    .filter((m) => m.status === "Released")
    .reduce((s, m) => s + m.amountCad - m.holdbackCad, 0);
  const holdbackRetainedCad = milestonesFixture
    .filter((m) => m.status === "Released")
    .reduce((s, m) => s + m.holdbackCad, 0);
  const awaitingCad = totalCad - fundedCad;

  // Budget vs actual per category (MID column), from the budget fixture.
  const categories = new Map<string, number>();
  for (const line of budgetFixture.lines) {
    categories.set(line.category, (categories.get(line.category) ?? 0) + line.midCad);
  }
  const actualByCategory = new Map(d.actuals.map((a) => [a.category, a]));

  const currentIdx = d.stages.indexOf(d.currentStage);

  // Brain-detected slips lead the list, then the routine next actions.
  const nextActions = [...slipsFixture.map(slipToNextAction), ...d.nextActions];

  const fundedPct = Math.round((fundedCad / totalCad) * 100);

  return (
    <div className="py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="aura-label mb-4">Owner dashboard</p>
          <RevealWords
            text={d.projectName}
            className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
          />
          <p className="mt-3 text-[0.95rem] leading-[1.6] text-aura-text/75">{d.parcel}</p>
        </div>
        {/* above the fold: a short rise, no held delay — the first screen
            must be readable the moment it paints */}
        <Reveal delay={0.12} y={10}>
          <p className="text-xs uppercase tracking-label text-aura-violet">
            Preview data — live journey state lands with the Aura Brain service
          </p>
        </Reveal>
      </div>

      {/* Stage tracker — structure by hairline, not by box: transparent
          cells with border dividers. The old gap-px + filled-gutter trick
          also used rgba(26,29,27,.12), a near-miss of --aura-border that
          globals.css's header forbids. The cells now arrive left-to-right,
          which reads as the journey advancing rather than a printed table. */}
      <Stagger className="mt-10 grid overflow-hidden rounded-lg border aura-hairline md:grid-cols-5">
        {d.stages.map((stage, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "ahead";
          return (
            <StaggerItem
              key={stage}
              className="border-b aura-hairline p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            >
              <p className="font-mono text-xs tabular-nums text-aura-emerald">
                {String(i + 1).padStart(2, "0")}
              </p>
              <p
                className={`mt-2 text-sm font-semibold uppercase tracking-label ${
                  state === "done"
                    ? "text-aura-emerald"
                    : state === "current"
                      ? "text-aura-lime"
                      : "text-aura-text/65"
                }`}
              >
                {stage}
              </p>
              <p className="mt-2 text-xs uppercase tracking-label text-aura-text/65">
                {state === "done" ? "Complete" : state === "current" ? "In progress" : "Ahead"}
              </p>
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* The two head panels arrive in sequence. The StaggerItem wrapper is
          the grid child now, so it carries `grid` to keep the panels the
          equal height the bare grid used to give them. */}
      <Stagger className="mt-12 grid gap-8 lg:grid-cols-2">
        {/* Project payment position */}
        <StaggerItem className="grid">
          <section className="aura-panel aura-panel-lift p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="aura-label">Project payments</h2>
              <span className="text-xs uppercase tracking-label text-aura-teal">Preview</span>
            </div>
            <p className="mt-5 font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.02em] tabular-nums">
              <Counter value={totalCad} prefix="$" />
            </p>
            <p className="mt-1 text-xs text-aura-text/70">
              Total milestone value (MID budget, excl. land) — 10 percent statutory holdback on
              every release
            </p>
            <dl className="mt-6 space-y-3 text-sm">
              {[
                { label: "Paid to date", value: fundedCad, tone: "text-aura-teal" },
                {
                  label: "Released to builder (net)",
                  value: releasedNetCad,
                  tone: "text-aura-lime",
                },
                {
                  label: "Holdback retained",
                  value: holdbackRetainedCad,
                  tone: "text-aura-violet",
                },
                { label: "Awaiting funding", value: awaitingCad, tone: "text-aura-text/70" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4">
                  <dt className="text-aura-text/75">{row.label}</dt>
                  <dd className={`tabular-nums ${row.tone}`}>
                    <Counter value={row.value} prefix="$" />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-aura-ink/10">
              <GrowBar pct={fundedPct} className="h-full rounded-full bg-aura-emerald-bright" />
            </div>
            <p className="mt-2 text-xs text-aura-text/65">
              {fundedPct} percent of scheduled project payments recorded in this preview
            </p>
          </section>
        </StaggerItem>

        {/* Weekly digest preview */}
        <StaggerItem className="grid">
          <section className="aura-panel aura-panel-lift p-6">
            <h2 className="aura-label">Email digest preview</h2>
            <div className="mt-5 rounded-lg border aura-hairline bg-aura-bg p-5">
              <p className="text-xs uppercase tracking-label text-aura-text/65">
                From Aura Brain &middot; {d.digest.period}
              </p>
              <p className="mt-2 font-display text-[1.2rem] font-medium tracking-[-0.01em]">
                {d.digest.subject}
              </p>
              {/* the three lines land one after another, the way the mail
                  itself is read */}
              <Stagger className="mt-4 space-y-3 text-sm leading-relaxed">
                <StaggerItem y={8}>
                  <p>
                    <span className="text-aura-emerald">What moved.</span>{" "}
                    <span className="text-aura-text/70">{d.digest.moved}</span>
                  </p>
                </StaggerItem>
                <StaggerItem y={8}>
                  <p>
                    <span className="text-aura-violet">What is blocked.</span>{" "}
                    <span className="text-aura-text/70">{d.digest.blocked}</span>
                  </p>
                </StaggerItem>
                <StaggerItem y={8}>
                  <p>
                    <span className="text-aura-teal">Money position.</span>{" "}
                    <span className="text-aura-text/70">{d.digest.moneyPosition}</span>
                  </p>
                </StaggerItem>
              </Stagger>
            </div>
            <p className="mt-4 text-xs text-aura-text/65">
              Sent weekly and on every material state change. Email delivery is
              integration-pending; this preview renders the exact template.
            </p>
          </section>
        </StaggerItem>
      </Stagger>

      {/* Next actions */}
      <section className="mt-12">
        <Reveal y={16}>
          <h2 className="aura-label">Next actions</h2>
        </Reveal>
        <Stagger className="mt-5 space-y-4">
          {nextActions.map((action) => (
            <StaggerItem key={action.id}>
              <div
                className={`aura-panel aura-panel-lift flex flex-wrap items-start gap-5 p-6 ${
                  action.slip ? "border-aura-violet/60" : ""
                }`}
              >
                <div className="w-16 pt-0.5">
                  {action.slip ? (
                    <span className="rounded border border-aura-violet px-2 py-1 text-[10px] font-semibold uppercase tracking-label text-aura-violet">
                      Slip
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-label text-aura-text/65">
                      Next
                    </span>
                  )}
                </div>
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-aura-text/70">{action.detail}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="uppercase tracking-label text-aura-text/65">{action.owner}</p>
                  <p
                    className={`mt-1 ${
                      action.due === "Overdue" ? "text-aura-violet" : "text-aura-text/75"
                    }`}
                  >
                    {action.due}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal delay={0.05} y={10}>
          <p className="mt-3 text-xs text-aura-text/65">
            Slip detection runs on the deterministic journey state — the Aura Brain flags stalled
            steps before they cost weeks (see docs/AI-BRAIN.md).
          </p>
        </Reveal>
      </section>

      {/* Budget vs actual */}
      <section className="mt-12">
        <Reveal y={16}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="aura-label">Budget vs actual</h2>
            <Link
              href="/budget"
              data-cursor="Open"
              className="text-xs uppercase tracking-label text-aura-teal hover:text-aura-lime"
            >
              Full budget
            </Link>
          </div>
        </Reveal>
        <div className="aura-panel aura-panel-lift mt-5 p-6">
          {/* each category row arrives, then draws its own bar from zero */}
          <Stagger className="space-y-5">
            {Array.from(categories.entries()).map(([category, midCad]) => {
              const actual = actualByCategory.get(category);
              const actualCad = actual?.actualCad ?? 0;
              const pct = Math.min(100, Math.round((actualCad / midCad) * 100));
              return (
                <StaggerItem key={category} y={10}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <p>
                      <span className="text-aura-text/80">{category}</span>
                      {actual && (
                        <span className="ml-3 text-xs text-aura-text/65">{actual.note}</span>
                      )}
                    </p>
                    <p className="tabular-nums text-xs text-aura-text/75">
                      <span className={actualCad > 0 ? "text-aura-teal" : "text-aura-text/65"}>
                        <Counter value={actualCad} prefix="$" />
                      </span>{" "}
                      / {cad(midCad)}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-aura-ink/10">
                    <GrowBar
                      pct={pct}
                      className={`h-full rounded-full ${
                        actualCad > midCad ? "bg-aura-violet" : "bg-aura-teal"
                      }`}
                    />
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
          <p className="mt-6 text-xs text-aura-text/65">
            Actuals are committed spend to date against the MID budget column. Categories not yet
            started show zero — honest numbers, no smoothing.
          </p>
        </div>
      </section>
    </div>
  );
}
