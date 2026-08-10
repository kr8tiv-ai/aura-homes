"use client";

/* The DIY-or-hire view (issue #7, the toggle half). The cost model already
   knows which lines an Alberta owner may legally do themselves; this page
   now shows it and lets you slice the budget by it. Honesty rule: the
   LOW/MID/HIGH figures ARE the owner-builder path — hiring everything out
   is the $450K-$650K builder-delivered comparison, and no invented per-line
   "hire" price appears here. The months-versus-money economics per line is
   the contractor-scout work tracked in issue #7's research half. */

import { useMemo, useState } from "react";
import * as m from "motion/react-m";
import { budgetFixture, type OwnerBuildable } from "@/lib/fixtures";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem, Counter } from "@/components/Reveal";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

/* Module scope on purpose: <Counter> keeps `format` in its effect deps, so an
   inline arrow would restart the count on every parent render (i.e. every
   filter click would re-animate all three totals, not just the changed ones). */
const cadCount = (n: number) => Math.round(n).toLocaleString("en-CA");

/* The house curve, spelled as a mutable tuple so motion's Easing type takes it. */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

type Filter = "all" | "diy" | "licensed";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All lines" },
  { id: "diy", label: "Owner-buildable" },
  { id: "licensed", label: "Licensed / contracted" },
];

function DiyBadge({ v }: { v: OwnerBuildable }) {
  if (v === "na") return <span className="text-aura-text/40">—</span>;
  return v === "yes" ? (
    <span className="font-mono text-[0.65rem] uppercase tracking-label text-aura-emerald">DIY yes</span>
  ) : (
    <span className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">Hire</span>
  );
}

export default function BudgetPage() {
  const { lines, total } = budgetFixture;
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(
    () =>
      filter === "all"
        ? lines
        : lines.filter((l) =>
            filter === "diy" ? l.ownerBuildable === "yes" : l.ownerBuildable === "no"
          ),
    [filter, lines]
  );

  const subtotal = useMemo(
    () =>
      shown.reduce(
        (acc, l) => ({
          lowCad: acc.lowCad + l.lowCad,
          midCad: acc.midCad + l.midCad,
          highCad: acc.highCad + l.highCad,
        }),
        { lowCad: 0, midCad: 0, highCad: 0 }
      ),
    [shown]
  );

  const isAll = filter === "all";
  const diyCount = lines.filter((l) => l.ownerBuildable === "yes").length;
  const licensedCount = lines.filter((l) => l.ownerBuildable === "no").length;

  return (
    <div className="py-16">
      <Reveal y={10}>
        <p className="aura-label mb-4">Alberta cost model</p>
      </Reveal>
      <RevealWords
        text="Build budget"
        className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
      />
      <Reveal delay={0.08} y={12} className="mt-4">
        <p className="max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">
          Researched LOW / MID / HIGH ranges in CAD, excluding land. Every line has an
          in-province supply path — and a DIY-or-hire answer: {diyCount} lines are legally
          yours in Alberta, {licensedCount} are licensed or contracted work.
        </p>
      </Reveal>

      <div className="mt-8" role="group" aria-label="Filter budget lines">
        <Stagger className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <StaggerItem key={f.id}>
              <button
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                data-cursor="Filter"
                className={
                  filter === f.id
                    ? "rounded-full bg-aura-ink px-4 py-2 font-mono text-xs uppercase tracking-label text-aura-paper"
                    : "rounded-full border aura-hairline px-4 py-2 font-mono text-xs uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-teal"
                }
              >
                {f.label}
              </button>
            </StaggerItem>
          ))}
        </Stagger>
      </div>

      <Reveal y={18} className="mt-8">
        <div className="aura-panel aura-panel-lift overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b aura-hairline text-left">
                <th className="aura-label px-6 py-4 font-normal">Category</th>
                <th className="aura-label px-6 py-4 font-normal">Line item</th>
                <th className="aura-label px-6 py-4 font-normal">DIY or hire</th>
                <th className="aura-label px-6 py-4 text-right font-normal">Low</th>
                <th className="aura-label px-6 py-4 text-right font-normal">Mid</th>
                <th className="aura-label px-6 py-4 text-right font-normal">High</th>
              </tr>
            </thead>
            {/* Keyed by filter so the cascade replays on every slice — the table
                re-deals itself instead of silently swapping its rows. */}
            <m.tbody
              key={filter}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
            >
              {shown.map((line) => (
                <m.tr
                  key={line.id}
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
                  }}
                  className="border-b aura-hairline transition-colors last:border-b-0 hover:bg-aura-ink/[0.04]"
                >
                  <td className="px-6 py-4 text-aura-teal">{line.category}</td>
                  <td className="px-6 py-4 text-aura-text/80">{line.item}</td>
                  <td className="px-6 py-4">
                    <DiyBadge v={line.ownerBuildable} />
                    <p className="mt-1 max-w-[15rem] text-xs leading-snug text-aura-text/55">
                      {line.diyBasis}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">{cad(line.lowCad)}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-aura-text">
                    {cad(line.midCad)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">{cad(line.highCad)}</td>
                </m.tr>
              ))}
            </m.tbody>
            <tfoot>
              <tr className="border-t aura-hairline">
                <td className="px-6 py-5" colSpan={3}>
                  <span className="aura-label">
                    {isAll ? "Total (excl. land)" : "Subtotal — shown lines"}
                  </span>
                </td>
                <td className="px-6 py-5 text-right font-semibold tabular-nums">
                  <Counter
                    value={isAll ? total.lowCad : subtotal.lowCad}
                    format={cadCount}
                    prefix="$"
                  />
                </td>
                <td className="px-6 py-5 text-right font-semibold tabular-nums text-aura-lime">
                  <Counter
                    value={isAll ? total.midCad : subtotal.midCad}
                    format={cadCount}
                    prefix="$"
                  />
                </td>
                <td className="px-6 py-5 text-right font-semibold tabular-nums">
                  <Counter
                    value={isAll ? total.highCad : subtotal.highCad}
                    format={cadCount}
                    prefix="$"
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Reveal>

      <Reveal y={12} className="mt-6">
        <p className="max-w-2xl text-sm leading-relaxed text-aura-text/70">
          These figures are the owner-builder path with licensed trades where the law requires
          them. Hiring everything out is the builder-delivered comparison — $450,000 to
          $650,000 ex-land for the same home. The per-line months-versus-money answer, and the
          ranked contractor shortlist per trade, are the contractor-scout roadmap (issue #7).
        </p>
      </Reveal>
    </div>
  );
}
