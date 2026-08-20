"use client";

/* ===========================================================================
   THE CO-PILOT SIDEBAR — advice you have to agree to.

   Every card below is a suggestion from `lib/builder/copilot.ts`, which is
   pure, deterministic, and has no model, no key and no network in it. This
   file adds no sentence of its own about anybody's home: the proposal, the
   evidence, the trade-offs, the not-modelled entries and the measured outcome
   all arrive as data, because a claim written inline in JSX cannot be tested
   and a claim in a module can.

   THE ONE RULE THIS COMPONENT EXISTS TO KEEP
   ------------------------------------------
   NOTHING IS APPLIED WITHOUT A CONFIRMATION. Not the small ones, not the
   "obviously safe" ones, not on mount, not on a document change. The
   mechanics, so a reviewer can check them by reading rather than by trusting
   this paragraph:

     1. A card opens UNARMED. The only control on it is “Review this change”,
        which sets `armedId` and applies nothing.
     2. The control that applies lives INSIDE the armed branch. Until a card is
        armed, the confirm button is not disabled, not hidden — it is not in
        the tree at all. `tests/copilot.spec.ts` renders the whole sidebar and
        asserts the markup contains no confirm control, which is an assertion
        CSS cannot fake.
     3. The apply path is one function, `confirmArmed`, fenced by sentinel
        comments, and it opens with a guard that refuses any suggestion that is
        not the armed one.
     4. `applyPreparedAction` refuses on its own account as well: it takes a
        `Confirmation` that must name the suggestion and quote the exact words
        that were on the control. A loop over the list, a stale closure or a
        "just the safe ones" shortcut would each have to write out the confirm
        text of a card nobody was shown.
     5. THERE ARE NO EFFECTS IN THIS FILE. No `useEffect`, no timer, no
        animation frame. Nothing here can fire on its own, and the spec pins
        that by absence — which is the half a static render cannot see.

   DISMISSAL IS ONE CLICK AND IS NOT A WRITE. A dismissed card stays dismissed
   while this builder session is open. It is component state: it never reaches
   the document, never reaches storage, never moves `hashBuilderDocument`, and
   a reload brings the card back. That is the honest scope of the promise, so
   it is the promise the panel makes.

   COST. `readCoPilot` prices the design, and walks a short ladder of smaller
   homes when there is a budget cap and the design is over it. It is memoised
   on the document and the five values it reads, the same bargain
   `ScenarioCompare` makes for its two readings.
   =========================================================================== */

import { useCallback, useMemo, useState } from "react";

import {
  COPILOT_ENGINE,
  applyPreparedAction,
  copilotQuietDemo,
  defaultCoPilotBasis,
  readCoPilot,
  type CoPilotSuggestion,
  type CoPilotSuggestionKind,
} from "@/lib/builder/copilot";
import type { BuildingGraph } from "@/lib/builder/buildingGraph";
import type { BuilderDocument } from "@/lib/builder/document";
import { PLAN_TEMPLATES } from "@/lib/builder/planCatalog";
import type { ProjectBudgetScenario } from "@/lib/builder/projectBudget";
import type { HomeSpec } from "@/lib/builder/spec";
import type { SpecParcelCheck } from "@/lib/builder/toPlan";
import { Button } from "./ui";

/** Derived once from the live catalog. The sentence lives in `copilot.ts`. */
const QUIET_DEMO = copilotQuietDemo(PLAN_TEMPLATES);

/** The heading over a card. A label, not a fact — the sentences underneath it
 *  all come from the module. */
const KIND_LABEL: Readonly<Record<CoPilotSuggestionKind, string>> = {
  "glazing-over-prescriptive": "Glazing",
  "footprint-over-buildable-envelope": "Fitting the land",
  "budget-over-stated-cap": "Your budget cap",
  "opening-off-its-wall": "An opening off its wall",
};

export default function CoPilot({
  document,
  parcelCheck,
  onApply,
  onApplyGraph,
  region = "Alberta",
  municipality = "",
  scenario,
  budgetCapCad = null,
}: {
  /** The document on screen. Every card is derived from it. */
  document: BuilderDocument;
  /** The builder's own `checkSpecAgainstParcel` result; `null` with no parcel.
   *  Handed in rather than recomputed so the sidebar and the live read-out can
   *  never disagree about whether this home fits its land. */
  parcelCheck: SpecParcelCheck | null;
  /**
   * The editor's own spec-edit path. The SPEC crosses back rather than the
   * whole document, because that path already reconciles partitions, finishes,
   * fixtures and comfort targets inside ONE commit — which is what makes
   * confirming a suggestion one undo step. Same contract as `VariationStrip`.
   */
  onApply: (spec: HomeSpec, label: string) => void;
  /** The editor's graph-edit path. A graph write must not go through `onApply`
   *  — that would leave the live geometry untouched and rewrite the frozen
   *  recovery spec. */
  onApplyGraph?: (graph: BuildingGraph, label: string) => void;
  /** The same four values the live read-out prices with. */
  region?: string;
  municipality?: string;
  scenario?: ProjectBudgetScenario;
  budgetCapCad?: number | null;
}) {
  /** Which card has been opened for confirmation. Exactly one at a time: two
   *  armed cards is two loaded controls beside each other. */
  const [armedId, setArmedId] = useState<string | null>(null);
  /** Session-only, never persisted. See the header. */
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  /** A refusal from the apply path, printed rather than swallowed. */
  const [notice, setNotice] = useState("");

  const report = useMemo(
    () =>
      readCoPilot({
        document,
        parcelCheck,
        basis: {
          ...defaultCoPilotBasis(),
          ...(scenario ? { scenario } : {}),
          region,
          municipality,
          budgetCapCad,
        },
      }),
    [budgetCapCad, document, municipality, parcelCheck, region, scenario],
  );

  /* == CO-PILOT APPLY PATH · BEGIN ==

     The only route from a suggestion to an edit in this component, and the
     only call to `applyPreparedAction` and to `onApply` anywhere in this file.
     Both halves of the gate are here: the armed guard, which refuses a
     suggestion that is not the one on screen, and the `Confirmation`, which
     quotes back the exact words the control carried. */
  const confirmArmed = useCallback(
    (suggestion: CoPilotSuggestion) => {
      if (armedId !== suggestion.id) return;
      const result = applyPreparedAction(document, suggestion.action, {
        confirmedId: suggestion.id,
        confirmedText: suggestion.action.confirmText,
      });
      if (!result.ok) {
        setNotice(result.problem);
        setArmedId(null);
        return;
      }
      if (result.graph) {
        if (!onApplyGraph) {
          setNotice(
            "This suggestion writes planar graph geometry and this screen has no graph editor path.",
          );
          setArmedId(null);
          return;
        }
        onApplyGraph(result.graph, result.label);
      } else {
        onApply(result.spec, result.label);
      }
      setNotice(result.announcement);
      setArmedId(null);
    },
    [armedId, document, onApply, onApplyGraph],
  );
  /* == CO-PILOT APPLY PATH · END == */

  const dismiss = useCallback((id: string) => {
    setDismissed((current) => (current.includes(id) ? current : [...current, id]));
    setArmedId((current) => (current === id ? null : current));
  }, []);

  const open = report.suggestions.filter((suggestion) => !dismissed.includes(suggestion.id));

  return (
    <section
      className="aura-panel p-6"
      aria-label="Design co-pilot"
      data-copilot-engine={COPILOT_ENGINE}
      data-copilot-open={open.length}
      data-copilot-dismissed={dismissed.length}
      data-copilot-armed={armedId ?? "none"}
    >
      <p className="aura-label text-aura-emerald">Co-pilot · {COPILOT_ENGINE}</p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-aura-text/60">
        Arithmetic over the design on screen, done by the engines named on each card. No model, no
        network, no key. Nothing here changes your home until you confirm it, and every confirmed
        change is one undo step.
      </p>

      {/* Never unmounted: a live region has to be in the accessibility tree
          before its text arrives or the announcement is not made. Empty on
          first render, which the spec asserts — an always-on decorative line
          would pass for an announcement. */}
      <p className="mt-3 text-xs leading-relaxed text-aura-teal" role="status" aria-live="polite">
        {notice}
      </p>

      {report.unavailable !== null ? (
        <p className="mt-4 rounded-md border border-aura-violet px-4 py-3 text-xs leading-relaxed text-aura-text/70">
          {report.unavailable}
        </p>
      ) : null}

      {report.unavailable === null && open.length === 0 ? (
        <p
          className="mt-4 rounded-md border aura-hairline px-4 py-3 text-xs leading-relaxed text-aura-text/65"
          data-copilot-quiet-demo={QUIET_DEMO?.planId ?? "none"}
        >
          {QUIET_DEMO?.sentence ??
            "Nothing this build can check has anything to say about this design right now. That is a statement about what Aura measures, not a verdict on the home: the list underneath says what was looked at and what could not be."}
        </p>
      ) : null}

      {open.length > 0 ? (
        <ul className="mt-5 grid gap-4">
          {open.map((suggestion) => (
            <li
              key={suggestion.id}
              className="rounded-xl border aura-hairline p-5"
              data-copilot-suggestion={suggestion.id}
              data-copilot-kind={suggestion.kind}
              data-copilot-card-armed={armedId === suggestion.id ? "yes" : "no"}
            >
              <p className="aura-label text-aura-emerald">{KIND_LABEL[suggestion.kind]}</p>
              <p className="mt-2 text-sm leading-relaxed text-aura-text/85">{suggestion.proposal}</p>
              <p className="mt-3 text-xs leading-relaxed text-aura-text/65">{suggestion.because}</p>

              <dl className="mt-4 grid gap-2">
                {suggestion.evidence.map((item) => (
                  <div key={`${suggestion.id}:${item.label}`} className="rounded-md border aura-hairline px-4 py-2.5">
                    <dt className="aura-label">{item.label}</dt>
                    <dd className="mt-1 text-sm tabular-nums text-aura-text">{item.formatted}</dd>
                    <dd className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/40">
                      {item.source}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 aura-label">What this costs you</p>
              <ul className="mt-2 space-y-2">
                {suggestion.tradeOffs.map((cost) => (
                  <li key={cost} className="flex gap-3 text-xs leading-relaxed text-aura-text/70">
                    <span aria-hidden className="text-aura-violet">
                      ·
                    </span>
                    <span>{cost}</span>
                  </li>
                ))}
              </ul>

              {/* Quoted from `scenarios.ts`, in rows rather than as a footnote,
                  for the same reason that module keeps them that way: the
                  quantity a person came looking for is named, with why this
                  build cannot answer it and what an honest answer would need. */}
              {suggestion.notModelled.length > 0 ? (
                <div className="mt-4 rounded-md border border-aura-violet px-4 py-3">
                  <p className="aura-label text-aura-violet">
                    Not modelled anywhere in this build
                  </p>
                  <ul className="mt-2 space-y-3">
                    {suggestion.notModelled.map((entry) => (
                      <li key={entry.id} className="text-xs leading-relaxed text-aura-text/70">
                        <span className="text-aura-text/90">{entry.label}.</span> {entry.why}{" "}
                        <span className="text-aura-text/50">An honest answer needs: {entry.needs}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="mt-4 rounded-md border aura-hairline px-4 py-2.5 text-xs leading-relaxed text-aura-text/70">
                {suggestion.outcome}
              </p>

              <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/40">
                Would be applied by {suggestion.action.routedThrough}
              </p>

              {armedId === suggestion.id ? (
                <div className="mt-4 rounded-md border border-aura-emerald px-4 py-3">
                  {/* == CO-PILOT CONFIRM BRANCH · BEGIN ==
                      The control that applies exists ONLY here, inside the
                      armed branch. Unarmed, it is absent from the tree rather
                      than disabled — an assertion no stylesheet can defeat. */}
                  <p className="text-xs leading-relaxed text-aura-text/75">
                    Confirming replaces the design on screen in one step, and Ctrl+Z takes it back.
                    Nothing is sent anywhere.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button tone="loud" onClick={() => confirmArmed(suggestion)}>
                      {suggestion.action.confirmText}
                    </Button>
                    <Button onClick={() => setArmedId(null)}>Keep it as it is</Button>
                  </div>
                  {/* == CO-PILOT CONFIRM BRANCH · END == */}
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => setArmedId(suggestion.id)}>Review this change</Button>
                  <Button onClick={() => dismiss(suggestion.id)} title="Hidden until this tab is reloaded">
                    Dismiss
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {report.refusals.length > 0 ? (
        <div className="mt-5 border-t aura-hairline pt-4">
          <p className="aura-label">Looked at, and not offered</p>
          <ul className="mt-2 space-y-2">
            {report.refusals.map((refusal) => (
              <li key={refusal.id} className="text-xs leading-relaxed text-aura-text/55">
                <span className="text-aura-text/75">{refusal.topic}.</span> {refusal.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dismissed.length > 0 ? (
        <p className="mt-4 text-xs leading-relaxed text-aura-text/50">
          {dismissed.length} suggestion{dismissed.length === 1 ? " is" : "s are"} dismissed for this
          session. Dismissing writes nothing — reload the tab and they come back.
        </p>
      ) : null}

      <p className="mt-4 border-t aura-hairline pt-4 text-xs leading-relaxed text-aura-text/55">
        {report.disclaimer}
      </p>
    </section>
  );
}
