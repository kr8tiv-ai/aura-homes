"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuraProject } from "@/components/project/ProjectContext";
import QuoteWorkbench from "@/components/project/QuoteWorkbench";
import { defaultBuilderDocument } from "@/lib/builder/document";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
  type DeliveryMode,
  type FinishLevel,
  type ProjectBudgetLine,
  type ProjectBudgetScenario,
  type SiteCondition,
  type UtilityStrategy,
} from "@/lib/builder/projectBudget";

const cad = (value: number) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

const titleCase = (value: string) =>
  value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

type Filter = "all" | "owner" | "trade" | "quote";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All costs" },
  { id: "owner", label: "Owner-buildable" },
  { id: "trade", label: "Trade / supplier" },
  { id: "quote", label: "Needs a quote" },
];

function LineStatus({ line }: { line: ProjectBudgetLine }) {
  return (
    <span className={`budget-status budget-status-${line.status}`}>
      {line.status === "modelled" ? "Modelled" : line.status === "allowance" ? "Allowance" : "Quote needed"}
    </span>
  );
}

export default function BudgetPage() {
  const { project, ready } = useAuraProject();
  const [scenario, setScenario] = useState<ProjectBudgetScenario>(defaultProjectBudgetScenario);
  const [filter, setFilter] = useState<Filter>("all");
  const document = project?.design.document ?? defaultBuilderDocument();
  const region = project?.requirements.location.region ?? "Alberta";
  const municipality = project?.requirements.location.municipality ?? "";
  const capCad = project?.requirements.budgetCad.max ?? null;
  const budget = useMemo(
    () => createProjectBudget({ document, scenario, region, municipality, budgetCapCad: capCad }),
    [capCad, document, municipality, region, scenario],
  );
  const shown = budget.lines.filter((line) => {
    if (filter === "owner") return line.ownerBuildable;
    if (filter === "trade") return !line.ownerBuildable;
    if (filter === "quote") return line.status === "quote-needed";
    return true;
  });

  function select<K extends keyof ProjectBudgetScenario>(key: K, value: ProjectBudgetScenario[K]) {
    setScenario((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="budget-page py-12 sm:py-16">
      <header className="budget-hero">
        <div>
          <p className="aura-label mb-4">Project cost readiness</p>
          <h1 className="font-display text-[clamp(2.35rem,6vw,5.7rem)] font-medium leading-[0.98] tracking-[-0.045em]">
            A range that moves<br className="hidden sm:block" /> with the design.
          </h1>
          <p className="mt-6 max-w-2xl text-[1rem] leading-[1.7] text-aura-text/70 sm:text-[1.06rem]">
            Change the home, site, utility strategy or delivery path and the range changes with it.
            Assumptions and missing quotes stay visible.
          </p>
        </div>
        <aside className="budget-project-card" aria-label="Budget design basis">
          <span>{project ? "Active project" : ready ? "Reference design" : "Opening project"}</span>
          <strong>{project?.name ?? "My Aura home"}</strong>
          <dl>
            <div><dt>Design</dt><dd>{budget.designHash.slice(0, 10)}</dd></div>
            <div><dt>Floor area</dt><dd>{Math.round(budget.areaSqFt).toLocaleString("en-CA")} sq ft</dd></div>
            <div><dt>Location</dt><dd>{municipality || region}</dd></div>
          </dl>
          <Link href={project ? "/build" : "/start"}>{project ? "Edit this home" : "Start a project"} →</Link>
        </aside>
      </header>

      <section className="budget-range" aria-label="Current project range">
        {(["low", "mid", "high"] as const).map((key) => (
          <div key={key} className={key === "mid" ? "is-mid" : ""}>
            <span>{key === "low" ? "Lean path" : key === "mid" ? "Working midpoint" : "Risk envelope"}</span>
            <strong>{cad(budget.total[key])}</strong>
            <small>including {scenario.contingencyPct}% contingency</small>
          </div>
        ))}
      </section>

      <section className="budget-workbench">
        <div className="budget-controls aura-panel">
          <div className="budget-section-head">
            <div><span>01</span><h2>Shape the scenario</h2></div>
            <p>Planning range — not a quote</p>
          </div>
          <div className="budget-control-grid">
            <label>Site condition
              <select aria-label="Site condition" value={scenario.site} onChange={(event) => select("site", event.target.value as SiteCondition)}>
                <option value="unknown">Not assessed yet</option>
                <option value="serviced-flat">Flat + serviced</option>
                <option value="rural-flat">Flat + rural</option>
                <option value="sloped">Sloped</option>
                <option value="remote">Remote access</option>
              </select>
            </label>
            <label>Utility strategy
              <select aria-label="Utility strategy" value={scenario.utilities} onChange={(event) => select("utilities", event.target.value as UtilityStrategy)}>
                <option value="serviced">Municipal services</option>
                <option value="hybrid">Hybrid resilience</option>
                <option value="off-grid">Off-grid</option>
              </select>
            </label>
            <label>Finish level
              <select aria-label="Finish level" value={scenario.finish} onChange={(event) => select("finish", event.target.value as FinishLevel)}>
                <option value="essential">Essential</option>
                <option value="standard">Standard</option>
                <option value="elevated">Elevated</option>
              </select>
            </label>
            <label>Delivery path
              <select aria-label="Delivery path" value={scenario.delivery} onChange={(event) => select("delivery", event.target.value as DeliveryMode)}>
                <option value="owner-builder">Owner-builder</option>
                <option value="hybrid">Owner + trades</option>
                <option value="full-service">Full service</option>
              </select>
            </label>
            <label>Delivery distance (km)
              <input aria-label="Delivery distance (km)" type="number" min="0" max="20000" step="10" value={scenario.shippingDistanceKm} onChange={(event) => select("shippingDistanceKm", Number(event.target.value))} />
            </label>
            <label>Contingency
              <div className="budget-range-input">
                <input aria-label="Contingency percentage" type="range" min="5" max="35" step="1" value={scenario.contingencyPct} onChange={(event) => select("contingencyPct", Number(event.target.value))} />
                <output>{scenario.contingencyPct}%</output>
              </div>
            </label>
          </div>
        </div>

        <aside className="budget-readiness aura-panel">
          <div className="budget-section-head">
            <div><span>02</span><h2>Readiness</h2></div>
            <p>{budget.confidence.label} · {budget.confidence.score}/100</p>
          </div>
          <div className="budget-meter"><i style={{ width: `${budget.confidence.score}%` }} /></div>
          {budget.cap ? (
            <div className={`budget-cap is-${budget.cap.state}`}>
              <span>Working cap · {cad(budget.cap.capCad)}</span>
              <strong>{budget.cap.midpointDeltaCad >= 0 ? `${cad(budget.cap.midpointDeltaCad)} breathing room` : `${cad(Math.abs(budget.cap.midpointDeltaCad))} above cap`}</strong>
              <p>{budget.cap.state === "within" ? "The full range sits within the cap." : budget.cap.state === "over" ? "Even the lean range is above the cap." : "The midpoint fits, but unresolved risks can exceed the cap."}</p>
            </div>
          ) : (
            <div className="budget-cap"><span>No working cap</span><strong>Add one in project intake</strong></div>
          )}
          <h3>What is still missing</h3>
          {budget.gaps.length ? (
            <ul>{budget.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
          ) : <p className="budget-clear">The current planning inputs are complete. Supplier quotes still supersede this model.</p>}
        </aside>
      </section>

      <section className="mt-12 sm:mt-16">
        <div className="budget-lines-head">
          <div><p className="aura-label">03 · Cost basis</p><h2>See what makes the number.</h2></div>
          <div role="group" aria-label="Filter budget lines">
            {FILTERS.map((option) => (
              <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}</button>
            ))}
          </div>
        </div>

        <div className="budget-lines-desktop aura-panel">
          <table>
            <thead><tr><th>Scope</th><th>Basis</th><th>Status</th><th>Low</th><th>Mid</th><th>High</th></tr></thead>
            <tbody>
              {shown.map((line) => (
                <tr key={line.id}>
                  <td><span>{titleCase(line.category)}</span><strong>{line.label}</strong><small>{line.ownerBuildable ? "Owner-buildable" : "Trade or supplier"}</small></td>
                  <td>{line.basis}</td>
                  <td><LineStatus line={line} /></td>
                  <td>{cad(line.low)}</td><td>{cad(line.mid)}</td><td>{cad(line.high)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="budget-lines-mobile">
          {shown.map((line) => (
            <article key={line.id} className="aura-panel">
              <div><span>{titleCase(line.category)}</span><LineStatus line={line} /></div>
              <h3>{line.label}</h3><p>{line.basis}</p>
              <dl><div><dt>Low</dt><dd>{cad(line.low)}</dd></div><div><dt>Mid</dt><dd>{cad(line.mid)}</dd></div><div><dt>High</dt><dd>{cad(line.high)}</dd></div></dl>
            </article>
          ))}
        </div>
      </section>

      <section className="budget-ledger aura-panel">
        <div><p className="aura-label">Assumptions</p><ul>{budget.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><p className="aura-label">Not included</p><ul>{budget.exclusions.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </section>

      <QuoteWorkbench budget={budget} />

      <footer className="budget-footer">
        <p>Use this range to frame decisions. RFQs and reconciled quotes are the next source of truth.</p>
        <div><Link href="/build">Refine the design</Link><Link href="/contractors">Find the team</Link></div>
      </footer>
    </div>
  );
}
