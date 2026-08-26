"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  compareSavedSchemes,
  type ComparedScheme,
  type SchemeComparison as Comparison,
  type SchemeComparisonContext,
} from "@/lib/builder/schemeComparison";
import {
  explainStoreError,
  listDesigns,
  onLibraryChange,
  readDesign,
  type DesignSummary,
  type SavedDesign,
} from "@/lib/builder/store";
import { Button, Panel } from "./ui";

const cad = (value: number): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

const number = (value: number): string =>
  new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(value);

function savedWhen(value: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function signed(value: number, suffix = ""): string {
  if (value === 0) return `No change${suffix}`;
  return `${value > 0 ? "+" : "−"}${number(Math.abs(value))}${suffix}`;
}

function schemeCost(scheme: ComparedScheme): string {
  if (scheme.cost.status === "unavailable") return scheme.cost.problem;
  return `${cad(scheme.cost.lowCad)} – ${cad(scheme.cost.highCad)}`;
}

function constraintText(scheme: ComparedScheme): string {
  const count = scheme.constraints.blockers.length;
  return `${scheme.constraints.state === "review-ready" ? "Review-ready" : "Design intent"} · ${count} blocking item${count === 1 ? "" : "s"}`;
}

function deltaText(scheme: ComparedScheme): string {
  const cost = scheme.delta.costMidCad === null ? "cost unavailable" : `${signed(scheme.delta.costMidCad)} at midpoint`;
  return `${signed(scheme.delta.areaSqFt, " sq ft")} area · ${signed(scheme.delta.roomCount)} rooms · ${signed(scheme.delta.storeyCount)} storeys · ${cost}`;
}

interface FactRow {
  label: string;
  render: (scheme: ComparedScheme) => React.ReactNode;
}

const ROWS: FactRow[] = [
  {
    label: "Exact version",
    render: (scheme) => `Document v${scheme.documentVersion} · saved ${savedWhen(scheme.savedAt)}`,
  },
  {
    label: "Canonical hash",
    render: (scheme) => <span className="break-all font-mono text-[0.65rem]">{scheme.designHash}</span>,
  },
  {
    label: "Geometry",
    render: (scheme) => (scheme.geometry === "planar-graph" ? "Planar graph" : "Legacy volumes"),
  },
  {
    label: "Program",
    render: (scheme) => (
      <span>
        {scheme.program.roomCount} rooms · {scheme.program.storeyCount} storey
        {scheme.program.storeyCount === 1 ? "" : "s"}
        {scheme.program.roomNames.length > 0 ? ` · ${scheme.program.roomNames.join(", ")}` : ""}
      </span>
    ),
  },
  {
    label: "Modelled floor area",
    render: (scheme) => `${number(scheme.areaSqFt)} sq ft`,
  },
  {
    label: "Planning range",
    render: schemeCost,
  },
  {
    label: "Blocking items",
    render: (scheme) => (
      <span>
        {constraintText(scheme)}
        {scheme.constraints.blockers.length > 0 ? ` · ${scheme.constraints.blockers.join("; ")}` : ""}
      </span>
    ),
  },
  {
    label: "Complete project",
    render: (scheme) => (
      <span>
        Available · additional formats {scheme.exports.additionalFormats.replaceAll("-", " ")}
        {scheme.exports.limitation ? ` · ${scheme.exports.limitation}` : ""}
      </span>
    ),
  },
  {
    label: "Change from reference",
    render: deltaText,
  },
];

export default function SchemeComparison({
  region,
  municipality,
  scenario,
  budgetCapCad,
}: SchemeComparisonContext) {
  const context = useMemo(
    () => ({ region, municipality, scenario, budgetCapCad }),
    [budgetCapCad, municipality, region, scenario],
  );
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<SavedDesign[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const refreshSequence = useRef(0);

  const refresh = useCallback(async (invalidateComparison = false) => {
    const sequence = ++refreshSequence.current;
    try {
      const next = await listDesigns();
      if (sequence !== refreshSequence.current) return;
      setDesigns(next);
      const available = new Set(next.filter((design) => design.readable).map((design) => design.id));
      setSelectedIds((current) => current.filter((id) => available.has(id)));
      if (invalidateComparison) {
        setLoaded([]);
        setComparison(null);
        setAnnouncement("The saved library changed. Compare again to reopen the exact current records.");
      }
      setError(null);
    } catch (err) {
      if (sequence !== refreshSequence.current) return;
      setError(explainStoreError(err).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return onLibraryChange(() => void refresh(true));
  }, [refresh]);

  const readable = designs.filter((design) => design.readable);

  const toggle = (id: string): void => {
    setComparison(null);
    setLoaded([]);
    setError(null);
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  };

  const compare = useCallback(async () => {
    if (selectedIds.length < 2 || selectedIds.length > 3) return;
    setBusy(true);
    setError(null);
    try {
      const records = await Promise.all(selectedIds.map((id) => readDesign(id)));
      const result = compareSavedSchemes(records, context, records[0].id);
      if (!result.ok) {
        setLoaded([]);
        setComparison(null);
        setError(result.problem);
        return;
      }
      setLoaded(records);
      setComparison(result.comparison);
      setAnnouncement(`${records.length} saved schemes compared. ${records[0].name} is the reference.`);
    } catch (err) {
      setLoaded([]);
      setComparison(null);
      setError(explainStoreError(err).message);
    } finally {
      setBusy(false);
    }
  }, [context, selectedIds]);

  const setReference = (referenceId: string): void => {
    const result = compareSavedSchemes(loaded, context, referenceId);
    if (!result.ok) {
      setError(result.problem);
      return;
    }
    setComparison(result.comparison);
    const reference = loaded.find((record) => record.id === referenceId);
    setAnnouncement(`${reference?.name ?? "Saved scheme"} is now the reference.`);
  };

  const clear = (): void => {
    setSelectedIds([]);
    setLoaded([]);
    setComparison(null);
    setError(null);
    setAnnouncement("Comparison cleared. The open design was not changed.");
  };

  return (
    <section aria-label="Compare saved schemes">
      <Panel
        label="Compare saved schemes"
        hint="Choose two or three complete saved projects. Every figure is reopened from its exact version and derived by the same program, area, budget, readiness and export engines used elsewhere in the editor. Choose the reference yourself; Aura does not rank the designs."
      >
        <div className="space-y-4">
          {readable.length < 2 ? (
            <p className="rounded-md border aura-hairline px-4 py-3 text-xs leading-relaxed text-aura-text/60">
              Save at least two distinct schemes in this browser to compare exact versions.
            </p>
          ) : (
            <fieldset>
              <legend className="aura-label">Saved versions</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {readable.map((design) => {
                  const checked = selectedIds.includes(design.id);
                  const locked = !checked && selectedIds.length >= 3;
                  return (
                    <label
                      key={design.id}
                      className={`flex min-w-0 items-start gap-3 rounded-md border p-3 ${checked ? "border-aura-emerald" : "aura-hairline"} ${locked ? "opacity-45" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked || busy}
                        onChange={() => toggle(design.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border aura-hairline bg-aura-bg accent-aura-emerald"
                      />
                      <span className="min-w-0">
                        <span className="block break-words text-sm text-aura-text">{design.name}</span>
                        <span className="mt-1 block break-all font-mono text-[0.6rem] text-aura-text/50">
                          v{design.documentVersion} · {design.signature}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {designs.some((design) => !design.readable) ? (
            <p className="text-xs leading-relaxed text-aura-text/55">
              Unreadable or future-version records stay visible in Your designs below, but cannot enter a comparison.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              tone="loud"
              onClick={() => void compare()}
              disabled={busy || selectedIds.length < 2 || selectedIds.length > 3}
            >
              {busy ? "Reopening exact versions…" : `Compare ${selectedIds.length} schemes`}
            </Button>
            {comparison || selectedIds.length > 0 ? <Button onClick={clear}>Clear comparison</Button> : null}
            <span className="text-xs text-aura-text/55">Choose 2 or 3 · {selectedIds.length} selected</span>
          </div>

          {error ? (
            <p role="alert" className="rounded-md border border-aura-violet px-4 py-3 text-xs leading-relaxed text-aura-violet">
              {error}
            </p>
          ) : null}

          {comparison ? (
            <div className="overflow-x-auto rounded-md border aura-hairline">
              <table aria-label="Scheme facts" className="w-full min-w-[52rem] border-collapse text-left text-xs leading-relaxed">
                <thead>
                  <tr className="border-b aura-hairline bg-aura-sunken/60">
                    <th scope="col" className="w-44 px-4 py-3 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">
                      Measured fact
                    </th>
                    {comparison.schemes.map((scheme) => (
                      <th key={scheme.id} scope="col" className="min-w-56 px-4 py-3 font-normal">
                        <span className="block text-sm text-aura-text">{scheme.name}</span>
                        <label className="mt-2 flex items-center gap-2 text-[0.7rem] text-aura-text/60">
                          <input
                            type="radio"
                            name="scheme-comparison-reference"
                            checked={comparison.referenceId === scheme.id}
                            onChange={() => setReference(scheme.id)}
                            className="h-3.5 w-3.5 accent-aura-emerald"
                          />
                          Use {scheme.name} as reference
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label} className="border-b aura-hairline last:border-b-0">
                      <th scope="row" className="px-4 py-3 align-top font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">
                        {row.label}
                      </th>
                      {comparison.schemes.map((scheme) => (
                        <td key={scheme.id} className="px-4 py-3 align-top text-aura-text/75">
                          {row.render(scheme)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p aria-live="polite" role="status" className="min-h-4 text-xs leading-relaxed text-aura-text/55">
            {announcement}
          </p>
        </div>
      </Panel>
    </section>
  );
}
