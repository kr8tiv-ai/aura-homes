"use client";

/* THE HOME, MEASURED AGAINST YOUR LAND.

   Rules this panel follows, in the order they matter:
   1. A home that does not fit the lot is the loudest thing on the page.
      It leads, in the violet the layout warnings already use, at display
      size, above the envelope stats and above the drawing's own warnings —
      because a plan that cannot be placed on the parcel makes every number
      under it academic.
   2. Nothing is silently fixed. The drawing above stays the home that was
      asked for. When a smaller home would fit, the size is OFFERED, with
      the figure shown, and the owner presses the button or does not.
   3. Every figure is derived from numbers the owner typed, and says so.
      No bylaw number Aura has not read is printed anywhere here, and
      coverage is a figure, not a verdict.
   4. It is not a permit check, and the copy never lets it read as one. */

import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import type { ParcelFinding, ParcelReport, ParcelSeverity } from "@/lib/design/parcel";

const SEVERITY_TAG: Record<ParcelSeverity, string> = {
  blocking: "Blocking",
  caution: "Check this",
  note: "Note",
};

/** Border and accent per severity — the violet is the page's warning ink. */
const SEVERITY_BORDER: Record<ParcelSeverity, string> = {
  blocking: "border-aura-violet",
  caution: "border-aura-violet/40",
  note: "aura-hairline",
};

const SEVERITY_INK: Record<ParcelSeverity, string> = {
  blocking: "text-aura-violet",
  caution: "text-aura-violet",
  note: "text-aura-teal",
};

const sqft = (n: number): string => `${Math.round(n).toLocaleString("en-CA")} sq ft`;

function Figures({ figures }: { figures: NonNullable<ParcelFinding["figures"]> }) {
  return (
    <Stagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" gap={0.045}>
      {figures.map((f) => (
        <StaggerItem key={f.k} className="rounded-md border aura-hairline px-4 py-3" y={8}>
          <p className="aura-label">{f.k}</p>
          <p className="mt-1.5 text-sm tabular-nums text-aura-text">{f.v}</p>
          {f.sub ? <p className="mt-1 text-xs leading-snug text-aura-text/55">{f.sub}</p> : null}
        </StaggerItem>
      ))}
    </Stagger>
  );
}

export default function ParcelFindings({
  report,
  onUseLargest,
}: {
  report: ParcelReport;
  /**
   * Offered only when the home does not fit AND a size that does exists.
   * The caller writes it into the questionnaire; nothing is regenerated
   * behind the owner's back.
   */
  onUseLargest?: (totalSqFt: number) => void;
}) {
  const blocking = report.findings.filter((f) => f.severity === "blocking");
  const rest = report.findings.filter((f) => f.severity !== "blocking");
  const offer = !report.fits && report.usable ? report.suggestedTotalSqFt : null;

  return (
    <div className="mt-6">
      {/* ------------------------------------------ the one that stops you */}
      {blocking.map((f) => (
        <Reveal key={f.id} y={14} className="mb-6">
          <div className="rounded-xl border border-aura-violet p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">
                Checked against your land · {SEVERITY_TAG[f.severity]}
              </p>
              <span className="rounded border border-aura-violet px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">
                Not a permit check
              </span>
            </div>
            <p className="mt-3 font-display text-[1.5rem] font-medium leading-[1.15] tracking-[-0.02em] text-aura-text">
              {f.title}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/80">{f.detail}</p>
            {f.figures ? <Figures figures={f.figures} /> : null}

            {f.id === "envelope" ? (
              offer !== null && onUseLargest ? (
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onUseLargest(offer)}
                    data-cursor="Use"
                    className="rounded-full border border-aura-emerald px-5 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-emerald transition-colors hover:bg-aura-emerald/5"
                  >
                    Use {sqft(offer)} instead
                  </button>
                  <span className="max-w-xl text-xs leading-relaxed text-aura-text/60">
                    This writes {sqft(offer)} into the questionnaire above and leaves everything else
                    alone — you still press Generate. It is the largest area the form accepts whose
                    solved envelope actually fits your setbacks, checked by re-running the same
                    packer rather than estimated backwards from a formula.
                  </span>
                </div>
              ) : (
                <p className="mt-6 max-w-3xl text-xs leading-relaxed text-aura-text/60">
                  Aura is not offering a smaller size here, because nothing the questionnaire
                  accepts solves small enough for this envelope. That is a signal about the parcel
                  or the setbacks, not about the plan.
                </p>
              )
            ) : null}
          </div>
        </Reveal>
      ))}

      {/* -------------------------------------------------- everything else */}
      {rest.length > 0 && (
        <Reveal y={16}>
          <div className="aura-panel p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="aura-label">
                {blocking.length > 0 ? "Also true of your land" : "Checked against your land"}
              </p>
              <span className="rounded border aura-hairline px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/60">
                Every figure derived from your inputs
              </span>
            </div>

            {blocking.length === 0 ? (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/75">
                The solved home was measured against the parcel you described:{" "}
                {sqft(report.footprintSqFt)} of footprint inside a{" "}
                {sqft(report.buildableSqFt)} buildable envelope. What follows is arithmetic on the
                numbers you entered — no bylaw was read, nothing was looked up, and no limit Aura
                has not verified is printed anywhere below.
              </p>
            ) : null}

            <div className="mt-6 space-y-4">
              {rest.map((f) => (
                <div key={f.id} className={`rounded-md border p-5 ${SEVERITY_BORDER[f.severity]}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <p className={`text-sm leading-snug text-aura-text`}>{f.title}</p>
                    <span
                      className={`font-mono text-[0.6rem] uppercase tracking-label ${
                        SEVERITY_INK[f.severity]
                      }`}
                    >
                      {SEVERITY_TAG[f.severity]}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-aura-text/75">
                    {f.detail}
                  </p>
                  {f.figures ? <Figures figures={f.figures} /> : null}
                </div>
              ))}
            </div>

            <details className="mt-6">
              <summary
                data-cursor="Open"
                className="cursor-pointer font-mono text-[0.6rem] uppercase tracking-label text-aura-text/55"
              >
                What this check assumed, and what it did not look at
              </summary>
              <ul className="mt-3 space-y-2">
                {report.assumptions.map((a) => (
                  <li key={a} className="flex gap-3 text-xs leading-relaxed text-aura-text/65">
                    <span aria-hidden className="text-aura-teal">
                      ·
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </details>

            <p className="mt-6 max-w-3xl text-xs leading-relaxed text-aura-text/55">
              This is arithmetic on what you typed — not a permit check, not a zoning opinion, not a
              site plan and not a survey. Aura facilitates and carries no liability for it. Your
              district&rsquo;s land use bylaw sets the setbacks and the coverage maximum, a real
              survey sets the lot lines, and a safety codes officer decides what gets built.
            </p>
          </div>
        </Reveal>
      )}
    </div>
  );
}
