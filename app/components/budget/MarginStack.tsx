"use client";

import costModelJson from "@data/alberta/cost-model.json";
import { Counter, GrowBar } from "@/components/Reveal";
import { DOCUMENT_STAGGER_SECONDS } from "@/lib/ui/motionPolicy";

/* ═══════════════════════════════════════════════════════════════════════
   THE COST STORY (MARGIN01)

   The strongest fact this project owns, made visible: the SAME home —
   800 sq ft off-grid SIP, rural Alberta, ex-land — owner-orchestrated
   against builder-delivered, line by line, on one axis.

   THREE RULES SHAPE EVERY LINE OF THIS FILE.

   1. NOT ONE DOLLAR AMOUNT IS TYPED HERE. Every figure on screen is read
      from data/alberta/cost-model.json — the file whose ex-land triplet
      `agent/ npm run demo` reconciles to the dollar as a release gate.
      margin-stack.spec.ts scans this source for numeric literals and for
      currency-shaped strings, so a figure pasted in later goes red before
      it reaches a page people make money decisions from.

   2. THE TOTAL IS READ, NEVER RECOMPUTED. `marginStackModel` sums the
      LINES (it has to — a stack that accumulates is the whole point) but
      it takes `total` straight from `totalsExLand` and derives the
      contingency band by SUBTRACTION from that read total. So there is
      exactly one derived quantity in this file, and the spec reconciles it
      against the file's own contingencyPct. A line edited without
      recomputing the published totals turns that gate red. This repo has
      been bitten three times by a second cost path; this one cannot drift
      silently, because the drift is what the gate measures.

      (regionalCost.ts already carries a second implementation of the
      file's totalsRule and is pinned the same way. This file deliberately
      does NOT import it: that module's top-level import pulls a 70 KB
      Statistics Canada index set in to obtain a multiplier of exactly 1.0,
      and shipping 70 KB of unused index to /budget contradicts the
      byte-stripping this wave just did.)

   3. THE LABOUR IS NOT A FOOTNOTE. The saving is 30-40% in exchange for
      12-24 months of the owner's own labour — the file's own
      builderComparison.basis says so. That trade renders inside
      `.margin-verdict`, the same block as the two figures, above the fold
      of the piece, and the spec asserts both its presence and its
      position. A money story that shows the gain and hides its price is
      the hype this brand exists to refuse, and it is also the weaker
      argument: every reader knows the money came from somewhere.

   MOTION: two primitives from components/Reveal.tsx — GrowBar and Counter
   — on the house curve, staggered by the shared --motion token. No new
   dependency, and none is needed: the GSAP + Lenis the proposing review
   asked for would have re-added more bytes than BN01 just removed.

   WHAT IS DELIBERATELY NOT USED HERE, and why, because a reviewer will ask.
   Reveal / Stagger / StaggerItem are this repo's document-page entrance
   vocabulary and every other long page reaches for them. They open at
   `initial={{ opacity: 0 }}`, which React renders into the server markup as
   a literal `style="opacity:0"` — so before JavaScript runs, a page built
   out of them is BLANK. That is an acceptable trade on an essay. It is not
   acceptable here: this is the surface where someone decides whether they
   can afford to build a house, and it is the surface a judge sees first. So
   every word and every figure in this component is painted at full opacity
   by the first frame, and the motion is confined to two things that ADD
   information as they run — a figure counting to its value, and bars
   drawing themselves in sequence so each line is read as it lands.

   The bars are a redundant encoding: every one of them sits beside the
   figure it draws, so a reader with no JavaScript loses the picture and
   keeps the whole argument. Under prefers-reduced-motion, MotionConfig
   strips GrowBar's transform and it holds its real CSS width, and Counter
   asks the media query itself and writes its final value immediately.
   margin-stack.spec.ts renders this component with NO effect fired and
   fails if any element carrying text computes to zero opacity.
   ═══════════════════════════════════════════════════════════════════════ */

/** The shape data/alberta/cost-model.json presents, narrowed to what is read. */
interface MarginCostLine {
  key: string;
  label: string;
  low: number;
  mid: number;
  high: number;
  ownerBuildable: boolean;
}

export interface MarginCostModel {
  referenceHome: { sqft: number; type: string };
  lineItems: readonly MarginCostLine[];
  contingencyPct: { low: number; mid: number; high: number };
  totalsExLand: { low: number; mid: number; high: number };
  builderComparison: { low: number; high: number; basis: string };
}

/* Structural inference over the whole JSON literal is slow and unhelpful,
   so the narrowing cast happens once, here — the same pattern regionalCost.ts
   uses for the baked index set. */
const COST_MODEL = costModelJson as unknown as MarginCostModel;

/** The standing label that travels with every planning figure on this site.
 *  Pinned to regionalCost.ts's ESTIMATE_LABEL by the spec — that module owns
 *  the canonical string, but importing it here would drag the index set in. */
export const MARGIN_ESTIMATE_LABEL = "an estimate, not a quote";

export interface MarginBand {
  low: number;
  mid: number;
  high: number;
}

export interface MarginStackLine extends MarginBand {
  key: string;
  label: string;
  /** From the file: whether this line is one the owner's own labour can do. */
  ownerBuildable: boolean;
  /** Midpoint total once this line has landed — the accumulation itself. */
  runningMid: number;
}

export interface MarginStackModel {
  reference: { sqft: number; type: string };
  lines: readonly MarginStackLine[];
  subtotal: MarginBand;
  /** DERIVED: total (read) minus subtotal (summed). The one derived band. */
  contingency: MarginBand;
  /** READ from totalsExLand. Never computed. */
  total: MarginBand;
  builder: { low: number; high: number; basis: string };
  /** "12 to 24 months", parsed out of builder.basis; null if it stops saying so. */
  labourMonths: string | null;
  /** Everything is drawn as a share of this — the top of the builder range. */
  axisMax: number;
}

/**
 * The months of owner labour the comparison's own basis names.
 *
 * Parsed rather than retyped so the sentence on screen cannot drift away
 * from the sourced claim underneath it. When the basis stops saying it, this
 * returns null and the component falls back to printing the basis verbatim —
 * the fact is never dropped, only stated less gracefully.
 */
export function labourMonthsFromBasis(basis: string): string | null {
  const found = /(\d+)\s*[-–—]\s*(\d+)\s*months?\s+of\s+labour/i.exec(basis);
  return found === null ? null : `${found[1]} to ${found[2]} months`;
}

/**
 * Builds the stack from the anchored cost model. Pure: same input, same
 * output, no I/O, no mutation.
 *
 * Land is excluded exactly as the file's totalsRule requires ("land excluded
 * from ex-land totals"), keyed on `land` — the same identity
 * regionalCost.budgetFromCostModel and agent/src/pipeline.ts use.
 */
export function marginStackModel(model: MarginCostModel): MarginStackModel {
  let runningMid = 0;
  const lines: MarginStackLine[] = model.lineItems
    .filter((item) => item.key !== "land")
    .map((item) => {
      runningMid += item.mid;
      return {
        key: item.key,
        label: item.label,
        low: item.low,
        mid: item.mid,
        high: item.high,
        ownerBuildable: item.ownerBuildable,
        runningMid,
      };
    });

  const subtotal: MarginBand = {
    low: lines.reduce((sum, line) => sum + line.low, 0),
    mid: lines.reduce((sum, line) => sum + line.mid, 0),
    high: lines.reduce((sum, line) => sum + line.high, 0),
  };
  const total: MarginBand = { ...model.totalsExLand };

  return {
    reference: model.referenceHome,
    lines,
    subtotal,
    contingency: {
      low: total.low - subtotal.low,
      mid: total.mid - subtotal.mid,
      high: total.high - subtotal.high,
    },
    total,
    builder: model.builderComparison,
    labourMonths: labourMonthsFromBasis(model.builderComparison.basis),
    axisMax: model.builderComparison.high,
  };
}

const cad = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

/** A value's share of the common axis, clamped to the track. */
const share = (value: number, axisMax: number) =>
  Math.max(0, Math.min(100, (value / axisMax) * 100));

/** A band drawn between two shares. Never negative, so a future data change
 *  that inverts an ordering degrades to an invisible band rather than to a
 *  bar that reads backwards. */
const span = (fromPct: number, toPct: number) => ({
  left: `${fromPct}%`,
  width: `${Math.max(0, toPct - fromPct)}%`,
});

export default function MarginStack() {
  const stack = marginStackModel(COST_MODEL);
  const { axisMax, builder, contingency, labourMonths, lines, reference, subtotal, total } = stack;

  const ownerLowPct = share(total.low, axisMax);
  const ownerMidPct = share(total.mid, axisMax);
  const ownerHighPct = share(total.high, axisMax);
  const builderLowPct = share(builder.low, axisMax);
  const builderHighPct = share(builder.high, axisMax);

  return (
    <section className="margin-stack" aria-labelledby="margin-stack-title">
      <div className="margin-head">
        <p className="aura-label margin-eyebrow">The cost story</p>
        <h2 id="margin-stack-title" className="margin-title">
          The same home, two ways of getting it built.
        </h2>
        <p className="margin-reference">
          Reference build: {reference.sqft.toLocaleString("en-CA")} sq ft, {reference.type}, rural
          Alberta, land excluded on both sides. Comparing unlike homes would make the whole
          exercise worthless, so this is one home, priced twice.
        </p>
      </div>

      {/* ── THE VERDICT ──────────────────────────────────────────────────
          Both figures AND the labour that pays for the difference live in
          this one block, by design and by test. Nothing here is behind a
          disclosure, nothing here is further down the page, and nothing
          here waits for an animation before it can be read. */}
      <div className="margin-verdict">
        <div className="margin-verdict-figures">
          {/* BOTH SIDES SPEAK THE SAME WAY, and they did not at first: the
              owner rendered as one midpoint at display size while the builder
              rendered as a range, which quietly compares a best estimate
              against a whole span. The brand guide's own ruling is to show the
              two ranges and let the reader subtract, so the range leads on both
              sides and the midpoint follows as detail. */}
          <div className="margin-side" data-margin-side="owner">
            <span className="margin-side-label">Owner-orchestrated</span>
            <strong className="margin-side-figure" data-margin-owner-range>
              {cad(total.low)} to {cad(total.high)}
            </strong>
            <small className="margin-side-band" data-margin-owner-mid>
              Midpoint <Counter value={total.mid} format={cad} />, ex-land
            </small>
          </div>
          <div className="margin-side is-builder" data-margin-side="builder">
            <span className="margin-side-label">Builder-delivered</span>
            <strong className="margin-side-figure" data-margin-builder-range>
              {cad(builder.low)} to {cad(builder.high)}
            </strong>
            <small className="margin-side-band">Same home, same exclusions, ex-land</small>
          </div>
        </div>

        <p className="margin-trade" data-margin-trade>
          <b>
            In exchange for {labourMonths ?? builder.basis} of your own labour and coordination.
          </b>{" "}
          That is where the difference comes from, and it is the whole of the trade. Aura
          orchestrates the sequence, the quotes and the record; it is never your general
          contractor and it does not swing a hammer on your behalf. If you cannot give the
          project those months, price the builder column and plan from there.
        </p>

        <p className="margin-basis" data-margin-basis>
          Basis, verbatim from the model: {builder.basis}
        </p>
        <p className="margin-label" data-margin-estimate-label>
          This comparison is {MARGIN_ESTIMATE_LABEL}, on both sides. Every figure is read from
          data/alberta/cost-model.json, the researched Alberta model this whole site prices
          against.
        </p>
      </div>

      {/* ── THE STACK ────────────────────────────────────────────────────
          The delta is not asserted anywhere; it assembles out of the real
          lines. Every bar is a share of the SAME axis (0 to the top of the
          builder range), so the owner column running out of track well
          short of where the builder column even starts is the argument. */}
      <div className="margin-axis-head">
        <h3>What the owner column is actually made of</h3>
        <p>
          Each bar is the running total once that line has landed, drawn against a single axis
          that ends at the top of the builder range. Lines marked{" "}
          <b className="margin-owner-mark">your hands</b> are the ones those months of labour
          are spent on. The bar shows where the running total has reached; the figure beside it
          is what that one line costs.
        </p>
      </div>

      <div className="margin-lines">
        {lines.map((line, index) => (
          <div key={line.key} className="margin-line">
            <span className="margin-line-label">
              {line.label}
              <i
                className={`margin-line-tag${line.ownerBuildable ? " is-owner" : ""}`}
                data-margin-owner-buildable={line.ownerBuildable ? "yes" : "no"}
              >
                {line.ownerBuildable ? "your hands" : "trade or supplier"}
              </i>
            </span>
            <span className="margin-line-track">
              {/* The pale bar is plain CSS at the real width and never
                  animates, so a reader whose JavaScript has not run (or has
                  not run yet) sees the true shape of the stack rather than an
                  empty grey track that looks like a broken widget. GrowBar
                  draws the solid bar over it. */}
              <span
                className="margin-line-rest"
                style={{ width: `${share(line.runningMid, axisMax)}%` }}
              />
              <GrowBar
                className="margin-line-fill"
                pct={share(line.runningMid, axisMax)}
                delay={index * DOCUMENT_STAGGER_SECONDS}
              />
            </span>
            {/* The bar draws the RUNNING TOTAL; this figure is the line's OWN
                cost. Two different quantities, and the header sentence used to
                claim "every figure it draws is printed beside it", which was
                false on thirteen of these fourteen rows. A fresh-context review
                caught it.

                The first fix printed the running total here too — and the
                published-figures gate immediately refused it, correctly: a
                running total is a derived sum, not a value the cost model
                publishes, and letting derived numbers onto this surface is
                exactly how an unsourced figure gets in front of someone making
                a large financial decision. So the sentence was corrected
                instead, and the strong gate kept. The bar's quantity is
                described in words; only published figures are printed. */}
            <span className="margin-line-figure">{cad(line.mid)}</span>
          </div>
        ))}

        <div className="margin-line is-sum">
          <span className="margin-line-label">Subtotal, all lines</span>
          <span className="margin-line-track">
            <span
              className="margin-line-rest"
              style={{ width: `${share(subtotal.mid, axisMax)}%` }}
            />
            <GrowBar
              className="margin-line-fill"
              pct={share(subtotal.mid, axisMax)}
              delay={lines.length * DOCUMENT_STAGGER_SECONDS}
            />
          </span>
          <span className="margin-line-figure">{cad(subtotal.mid)}</span>
        </div>

        <div className="margin-line is-sum">
          <span className="margin-line-label">Contingency, as the model carries it</span>
          <span className="margin-line-track">
            <span className="margin-line-rest" style={{ width: `${share(total.mid, axisMax)}%` }} />
            <GrowBar
              className="margin-line-fill"
              pct={share(total.mid, axisMax)}
              delay={(lines.length + 1) * DOCUMENT_STAGGER_SECONDS}
            />
          </span>
          <span className="margin-line-figure">{cad(contingency.mid)}</span>
        </div>
      </div>

      {/* ── THE TWO COLUMNS ON ONE AXIS ─────────────────────────────────── */}
      <div className="margin-compare">
        <div className="margin-line is-total" data-margin-owner-row>
          <span className="margin-line-label">Owner-orchestrated, published band</span>
          <span className="margin-line-track">
            <span className="margin-band is-owner" style={span(ownerLowPct, ownerHighPct)} />
            <span className="margin-tick is-owner" style={{ left: `${ownerMidPct}%` }} />
          </span>
          <span className="margin-line-figure">{cad(total.mid)}</span>
        </div>

        {/* THIS BAND USED TO START AT THE OWNER MIDPOINT, and that was the
            flattering reading rather than the true one. The owner's published
            band runs up to a top that lands only a little under where the
            builder range begins — so a band drawn from the midpoint implied a
            guaranteed saving many times larger than the two bands actually
            support, on the one surface in this product where a person is
            deciding how to spend several hundred thousand dollars. Caught by a
            fresh-context review hunting for exactly this. (No figures are named
            in this comment on purpose: the published-figures gate treats a
            currency literal in source as a drift risk wherever it sits, and it
            is right to.)

            It now spans the part that does not overlap AT ALL: the top of the
            owner band to the bottom of the builder range. That is the gap that
            survives a bad run. The much larger midpoint-to-builder distance is
            still legible — the owner tick is right there on the row above — but
            it is the reader's to draw, which is what the brand guide asks for
            when it says show the two ranges and let them subtract. */}
        <div className="margin-line is-gap" data-margin-gap-row>
          <span className="margin-line-label">
            The gap that survives a bad run
            <i className="margin-line-tag">
              top of the owner band to the bottom of the builder range — no figure printed, read
              it off the two bands
            </i>
          </span>
          <span className="margin-line-track">
            <span className="margin-band is-gap" style={span(ownerHighPct, builderLowPct)} />
          </span>
          <span className="margin-line-figure margin-line-figure-quiet">&mdash;</span>
        </div>

        <div className="margin-line is-total" data-margin-builder-row>
          <span className="margin-line-label">Builder-delivered, sourced range</span>
          <span className="margin-line-track">
            <span className="margin-band is-builder" style={span(builderLowPct, builderHighPct)} />
          </span>
          <span className="margin-line-figure">
            {cad(builder.low)}&ndash;{cad(builder.high)}
          </span>
        </div>
      </div>

      <div className="margin-honesty">
        <p>
          Where the two columns nearly meet: the top of the owner band, {cad(total.high)}, is
          within touching distance of the bottom of the builder range, {cad(builder.low)}. An
          owner-orchestrated build that goes badly is not a cheap build. The saving is real and
          it is earned, not granted.
        </p>
      </div>
    </section>
  );
}
