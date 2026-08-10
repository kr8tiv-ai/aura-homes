"use client";

/* The DIY-or-hire view (issue #7, the toggle half). The cost model already
   knows which lines an Alberta owner may legally do themselves; this page
   now shows it and lets you slice the budget by it. Honesty rule: the
   LOW/MID/HIGH figures ARE the owner-builder path — hiring everything out
   is the $450K-$650K builder-delivered comparison, and no invented per-line
   "hire" price appears here. The months-versus-money economics per line is
   the contractor-scout work tracked in issue #7's research half. */

import { useMemo, useState } from "react";
import { budgetFixture, type OwnerBuildable } from "@/lib/fixtures";
import RevealWords from "@/components/RevealWords";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

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
      <p className="aura-label mb-4">Alberta cost model</p>
      <RevealWords
        text="Build budget"
        className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
      />
      <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">
        Researched LOW / MID / HIGH ranges in CAD, excluding land. Every line has an
        in-province supply path — and a DIY-or-hire answer: {diyCount} lines are legally
        yours in Alberta, {licensedCount} are licensed or contracted work.
      </p>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter budget lines">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={
              filter === f.id
                ? "rounded-full bg-aura-ink px-4 py-2 font-mono text-xs uppercase tracking-label text-aura-paper"
                : "rounded-full border aura-hairline px-4 py-2 font-mono text-xs uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-teal"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="aura-panel mt-8 overflow-x-auto">
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
          <tbody>
            {shown.map((line) => (
              <tr key={line.id} className="border-b aura-hairline last:border-b-0">
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
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t aura-hairline">
              <td className="px-6 py-5" colSpan={3}>
                <span className="aura-label">
                  {isAll ? "Total (excl. land)" : "Subtotal — shown lines"}
                </span>
              </td>
              <td className="px-6 py-5 text-right font-semibold tabular-nums">
                {cad(isAll ? total.lowCad : subtotal.lowCad)}
              </td>
              <td className="px-6 py-5 text-right font-semibold tabular-nums text-aura-lime">
                {cad(isAll ? total.midCad : subtotal.midCad)}
              </td>
              <td className="px-6 py-5 text-right font-semibold tabular-nums">
                {cad(isAll ? total.highCad : subtotal.highCad)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-aura-text/70">
        These figures are the owner-builder path with licensed trades where the law requires
        them. Hiring everything out is the builder-delivered comparison — $450,000 to
        $650,000 ex-land for the same home. The per-line months-versus-money answer, and the
        ranked contractor shortlist per trade, are the contractor-scout roadmap (issue #7).
      </p>
    </div>
  );
}
