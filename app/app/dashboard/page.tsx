import Link from "next/link";
import RevealWords from "@/components/RevealWords";
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

  // Escrow position, derived from the milestone fixture.
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
        <p className="text-xs uppercase tracking-label text-aura-violet">
          Preview data — live journey state lands with the Aura Brain service
        </p>
      </div>

      {/* Stage tracker — structure by hairline, not by box: transparent
          cells with border dividers. The old gap-px + filled-gutter trick
          also used rgba(26,29,27,.12), a near-miss of --aura-border that
          globals.css's header forbids. */}
      <div className="mt-10 grid overflow-hidden rounded-lg border aura-hairline md:grid-cols-5">
        {d.stages.map((stage, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "ahead";
          return (
            <div
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
            </div>
          );
        })}
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {/* Escrow position */}
        <section className="aura-panel p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="aura-label">Escrow position</h2>
            <Link
              href="/escrow"
              className="text-xs uppercase tracking-label text-aura-teal hover:text-aura-lime"
            >
              Open escrow
            </Link>
          </div>
          <p className="mt-5 font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.02em] tabular-nums">{cad(totalCad)}</p>
          <p className="mt-1 text-xs text-aura-text/70">
            Total milestone value (MID budget, excl. land) — 10 percent statutory holdback on
            every release
          </p>
          <dl className="mt-6 space-y-3 text-sm">
            {[
              { label: "Funded to escrow", value: fundedCad, tone: "text-aura-teal" },
              { label: "Released to builder (net)", value: releasedNetCad, tone: "text-aura-lime" },
              { label: "Holdback retained", value: holdbackRetainedCad, tone: "text-aura-violet" },
              { label: "Awaiting funding", value: awaitingCad, tone: "text-aura-text/70" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <dt className="text-aura-text/75">{row.label}</dt>
                <dd className={`tabular-nums ${row.tone}`}>{cad(row.value)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-[rgba(23,26,24,0.08)]">
            <div
              className="h-full rounded-full bg-aura-emerald-bright"
              style={{ width: `${Math.round((fundedCad / totalCad) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-aura-text/65">
            {Math.round((fundedCad / totalCad) * 100)} percent of the build funded in native USDC
            on X Layer
          </p>
        </section>

        {/* Weekly digest preview */}
        <section className="aura-panel p-6">
          <h2 className="aura-label">Email digest preview</h2>
          <div className="mt-5 rounded-lg border aura-hairline bg-aura-bg p-5">
            <p className="text-xs uppercase tracking-label text-aura-text/65">
              From Aura Brain &middot; {d.digest.period}
            </p>
            <p className="mt-2 font-display text-[1.2rem] font-medium tracking-[-0.01em]">{d.digest.subject}</p>
            <div className="mt-4 space-y-3 text-sm leading-relaxed">
              <p>
                <span className="text-aura-emerald">What moved.</span>{" "}
                <span className="text-aura-text/70">{d.digest.moved}</span>
              </p>
              <p>
                <span className="text-aura-violet">What is blocked.</span>{" "}
                <span className="text-aura-text/70">{d.digest.blocked}</span>
              </p>
              <p>
                <span className="text-aura-teal">Money position.</span>{" "}
                <span className="text-aura-text/70">{d.digest.moneyPosition}</span>
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-aura-text/65">
            Sent weekly and on every material state change. Email delivery is integration-pending;
            this preview renders the exact template.
          </p>
        </section>
      </div>

      {/* Next actions */}
      <section className="mt-12">
        <h2 className="aura-label">Next actions</h2>
        <div className="mt-5 space-y-4">
          {nextActions.map((action) => (
            <div
              key={action.id}
              className={`aura-panel flex flex-wrap items-start gap-5 p-6 ${
                action.slip ? "border-aura-violet" : ""
              }`}
              style={action.slip ? { borderColor: "rgba(139, 92, 246, 0.6)" } : undefined}
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
          ))}
        </div>
        <p className="mt-3 text-xs text-aura-text/65">
          Slip detection runs on the deterministic journey state — the Aura Brain flags stalled
          steps before they cost weeks (see docs/AI-BRAIN.md).
        </p>
      </section>

      {/* Budget vs actual */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="aura-label">Budget vs actual</h2>
          <Link
            href="/budget"
            className="text-xs uppercase tracking-label text-aura-teal hover:text-aura-lime"
          >
            Full budget
          </Link>
        </div>
        <div className="aura-panel mt-5 p-6">
          <div className="space-y-5">
            {Array.from(categories.entries()).map(([category, midCad]) => {
              const actual = actualByCategory.get(category);
              const actualCad = actual?.actualCad ?? 0;
              const pct = Math.min(100, Math.round((actualCad / midCad) * 100));
              return (
                <div key={category}>
                  <div className="flex items-baseline justify-between gap-4 text-sm">
                    <p>
                      <span className="text-aura-text/80">{category}</span>
                      {actual && (
                        <span className="ml-3 text-xs text-aura-text/65">{actual.note}</span>
                      )}
                    </p>
                    <p className="tabular-nums text-xs text-aura-text/75">
                      <span className={actualCad > 0 ? "text-aura-teal" : "text-aura-text/65"}>
                        {cad(actualCad)}
                      </span>{" "}
                      / {cad(midCad)}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(23,26,24,0.08)]">
                    <div
                      className={`h-full rounded-full ${
                        actualCad > midCad ? "bg-aura-violet" : "bg-aura-teal"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-xs text-aura-text/65">
            Actuals are committed spend to date against the MID budget column. Categories not yet
            started show zero — honest numbers, no smoothing.
          </p>
        </div>
      </section>
    </div>
  );
}
