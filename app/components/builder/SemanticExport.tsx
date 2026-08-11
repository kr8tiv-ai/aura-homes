"use client";

/* ===========================================================================
   THE SEMANTIC EXPORT PANEL — two doors, and an honest sign over each.

   `ExportRow.tsx` offers the four doors that preserve SHAPE. This one offers
   the two that preserve MEANING: ifcJSON, and the JSON-LD bundle that wraps it
   in the Building Topology Ontology.

   THIS COMPONENT DECIDES NOTHING. Every claim on it is read out of
   `lib/builder/exportSemantic.ts` — the button label, the tool-support table,
   and the round-trip verdict all come from the module that wrote the file, so
   the page cannot promise something the module has not checked. That matters
   more here than on the other panel, because "IFC" is a word people trust and
   ifcJSON is a candidate format almost nothing opens.

   THE VERDICT IS COMPUTED, NOT WRITTEN. `roundTripReport(spec)` runs on the
   home currently on screen: it writes the file, reads it back through the same
   validator a share link goes through, and re-derives every dimension from the
   geometry it just emitted. If any of that stopped working, this panel would
   say so in red, for that house, live — rather than a comment somewhere
   claiming it used to work. It also prints how many checks RAN, because a
   check that cannot fail is not a check.
   =========================================================================== */

import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { downloadArtifact, type ExportArtifact } from "@/lib/builder/exportSpec";
import {
  BRICK_EXTENSION_POINT,
  FORMAT_STATUS,
  IFCJSON_TOOL_SUPPORT,
  IFCJSON_UI_LABEL,
  exportIfcJson,
  exportSemanticJsonLd,
  roundTripReport,
  type ToolSupportFact,
} from "@/lib/builder/exportSemantic";
import type { HomeSpec } from "@/lib/builder/spec";
import { Button, Panel } from "./ui";

type Job = "ifcjson" | "jsonld" | null;

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} kB`;

export default function SemanticExport({ spec }: { spec: HomeSpec }) {
  const [busy, setBusy] = useState<Job>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);

  /* NOT free, and measured rather than assumed: 4.5 ms for the default home
     and 28.8 ms for a deliberately absurd six-volume, sixty-opening model
     (Node 24, August 2026) — because the check really does serialise the whole
     file and parse it back, which is the only way it means anything.

     28 ms on a slider drag is a hitch you can feel, so the spec is DEFERRED:
     React keeps the drag at full rate and lets the verdict catch up a frame or
     two later. No debounce timer to tune, no new dependency, and the number on
     screen is still the real answer for the real house — just, briefly, for the
     house as it was half a frame ago. */
  const settled = useDeferredValue(spec);
  const report = useMemo(() => roundTripReport(settled), [settled]);

  const write = (job: Job, make: () => ExportArtifact) => {
    setBusy(job);
    setError(null);
    try {
      const a = make();
      downloadArtifact(a);
      setNote(`${a.filename} — ${a.note}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel
      label="Hand over the building, not the shape"
      hint={IFCJSON_UI_LABEL}
      right={
        <button
          type="button"
          onClick={() => setShowTools((v) => !v)}
          data-cursor="Select"
          className="aura-label text-aura-teal underline-offset-4 hover:underline"
        >
          {showTools ? "Hide what opens it" : "What can open this?"}
        </button>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Door
            title="ifcJSON (.ifcjson)"
            body="IFC4 as JSON. Every wall with its real material layer thickness and R-value, every window and door as an opening cut into a named wall, floor slabs, spaces, storeys, the site — plus the eco spec as property sets. A browser parses it with JSON.parse; buildingSMART's json2ifc.py converts it to a .ifc file."
            action={
              <Button
                tone="loud"
                onClick={() => write("ifcjson", () => exportIfcJson(spec))}
                disabled={busy !== null}
              >
                {busy === "ifcjson" ? "Writing…" : "Download .ifcjson"}
              </Button>
            }
          />
          <Door
            title="Linked data (.jsonld)"
            body="The same building as JSON-LD 1.1: a Building Topology Ontology graph — Site contains Building contains Storey contains Space, spaces bounded by wall and window interfaces — with the whole ifcJSON document riding inside as a JSON literal. One file, two readers, neither one shredding the other."
            action={
              <Button
                onClick={() => write("jsonld", () => exportSemanticJsonLd(spec))}
                disabled={busy !== null}
              >
                {busy === "jsonld" ? "Writing…" : "Download .jsonld"}
              </Button>
            }
          />
        </div>

        <RoundTrip report={report} />

        {showTools ? <ToolTable /> : null}

        {note ? <p className="text-xs leading-relaxed text-aura-text/60">{note}</p> : null}
        {error ? (
          <p className="rounded-md border border-aura-violet px-4 py-3 text-xs leading-relaxed text-aura-violet">
            {error}
          </p>
        ) : null}

        <details className="border-t aura-hairline pt-4">
          <summary
            data-cursor="Select"
            className="aura-label cursor-pointer text-aura-text/60 hover:text-aura-text"
          >
            Why there is no Brick model in here
          </summary>
          <p className="mt-3 text-xs leading-relaxed text-aura-text/60">
            {BRICK_EXTENSION_POINT.blockedBy}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-aura-text/55">
            {BRICK_EXTENSION_POINT.attachesTo}
          </p>
        </details>

        <p className="text-xs leading-relaxed text-aura-text/55">{FORMAT_STATUS}</p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ verdict */

function RoundTrip({ report }: { report: ReturnType<typeof roundTripReport> }) {
  const failed = !report.ok;
  /* A pass with nothing checked is not a pass. Said out loud rather than
     folded into the green line. */
  const vacuous = report.ok && report.solidChecksRun === 0;

  return (
    <div
      className={`rounded-xl border p-5 ${
        failed ? "border-aura-violet" : vacuous ? "aura-hairline" : "border-aura-emerald"
      }`}
    >
      <p
        className={`aura-label ${
          failed ? "text-aura-violet" : vacuous ? "text-aura-text/60" : "text-aura-emerald"
        }`}
      >
        {failed
          ? "The round trip did not hold"
          : vacuous
            ? "Round trip holds — but no solids were checked"
            : "Round trip holds"}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-aura-text/80">
        {failed
          ? "This file does not read back as the home you built. The differences are listed below and nothing has been hidden — the export still downloads, because a broken file you can inspect beats a button that quietly refuses."
          : "This exact home was written to ifcJSON, serialised, parsed back and checked against the same validator a share link goes through. Every field came back identical — and every dimension the property sets claim was re-derived from the geometry the file carries, so the data and the solids are describing the same house."}
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure k="Fields that changed" v={String(report.differences.length)} sub="0 is the pass" />
        <Figure
          k="Cross-checks run"
          v={String(report.crossChecksRun)}
          sub={`${report.solidChecksRun} of them read a solid`}
        />
        <Figure
          k="Largest disagreement"
          v={`${report.maxGeometryErrorFt.toFixed(4)} ft`}
          sub="properties against geometry"
        />
        <Figure
          k="Written"
          v={`${report.entityCount} IFC · ${report.botNodeCount} BOT`}
          sub={`${kb(report.ifcJsonBytes)} · ${kb(report.bundleBytes)} bundled`}
        />
      </dl>

      {report.problem ? (
        <p className="mt-4 text-xs leading-relaxed text-aura-violet">{report.problem}</p>
      ) : null}

      {report.differences.length > 0 || report.crossChecks.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {report.differences.map((d) => (
            <li key={d} className="font-mono text-xs leading-relaxed text-aura-violet">
              {d}
            </li>
          ))}
          {report.crossChecks.map((c) => (
            <li key={c.what} className="font-mono text-xs leading-relaxed text-aura-violet">
              {c.what} — properties say {c.fromPropertiesFt}, the {c.source} says{" "}
              {c.fromGeometryFt}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Figure({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <dt className="aura-label">{k}</dt>
      <dd className="mt-1 text-sm tabular-nums text-aura-text">{v}</dd>
      <dd className="mt-0.5 text-xs leading-snug text-aura-text/55">{sub}</dd>
    </div>
  );
}

/* --------------------------------------------------------------- tool table */

const VERDICT_LABEL: Record<ToolSupportFact["verdict"], string> = {
  reads: "Reads it",
  converts: "Converts it",
  "does-not-read": "Does not read it",
  unverified: "Unverified",
};

/** Emerald for what was verified, violet for what was verified NOT to work,
 *  and the quiet hairline for the two claims this build could not confirm —
 *  because "unverified" dressed in green is how a page starts lying. */
const VERDICT_TONE: Record<ToolSupportFact["verdict"], string> = {
  reads: "text-aura-emerald",
  converts: "text-aura-emerald",
  "does-not-read": "text-aura-violet",
  unverified: "text-aura-text/60",
};

function ToolTable() {
  return (
    <div className="rounded-xl border aura-hairline p-5">
      <p className="aura-label">What can actually open this — checked 11 August 2026</p>
      <p className="mt-2 text-xs leading-relaxed text-aura-text/60">
        Read straight out of the export module, so this list cannot drift from what the code
        checked. &ldquo;Unverified&rdquo; means exactly that: a claim found in a vendor&rsquo;s
        own documentation that this build could not confirm in their source, kept in its own
        colour rather than rounded up.
      </p>
      <ul className="mt-4 space-y-4">
        {IFCJSON_TOOL_SUPPORT.map((f) => (
          <li key={f.tool} className="border-t aura-hairline pt-4 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-aura-text">{f.tool}</p>
              <p className={`font-mono text-xs uppercase tracking-label ${VERDICT_TONE[f.verdict]}`}>
                {VERDICT_LABEL[f.verdict]}
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-aura-text/60">{f.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------- shared */

function Door({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-md border aura-hairline p-4">
      <div>
        <p className="text-sm text-aura-text">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-aura-text/60">{body}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}
