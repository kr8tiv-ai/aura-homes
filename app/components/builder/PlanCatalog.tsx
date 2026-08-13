"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  PLAN_TEMPLATES,
  estimatePlanTemplate,
  instantiatePlanTemplate,
  type PlanTemplate,
} from "@/lib/builder/planCatalog";
import type { BuilderDocument } from "@/lib/builder/document";
import { PlanAxonPreview, PlanDiagram } from "./PlanDiagram";
import { Button } from "./ui";

type SizeFilter = "all" | "micro" | "compact" | "home";
type BedroomFilter = "all" | "studio" | "one" | "two-plus";
type SourceFilter = "all" | "aura" | "open";

interface Props {
  onChoose: (document: BuilderDocument, plan: PlanTemplate) => void;
  currentName: string;
}

const money = (value: number): string =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);

function sizeOf(area: number): Exclude<SizeFilter, "all"> {
  if (area < 400) return "micro";
  if (area <= 800) return "compact";
  return "home";
}

function bedroomsOf(count: number): Exclude<BedroomFilter, "all"> {
  if (count === 0) return "studio";
  if (count === 1) return "one";
  return "two-plus";
}

/* The diagram lives in its own module now — shared scale, drawn roofs, real
   openings — because the old one here rendered all twenty plans nearly
   identically. See PlanDiagram.tsx's header for the three rules. */

export default function PlanCatalog({ onChoose, currentName }: Props) {
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<SizeFilter>("all");
  const [bedrooms, setBedrooms] = useState<BedroomFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [selectedId, setSelectedId] = useState(PLAN_TEMPLATES[0].id);
  const previewRef = useRef<HTMLElement | null>(null);

  /* Below 1020px the preview stacks under all the cards, so a click near the
     top of the grid used to change something two screens away — the literal
     "clicking doesn't seem to change anything" report. Selecting now walks
     the preview into view at those widths; at desktop widths the sticky
     aside is already beside the click and scrolling would be noise. */
  const choose = useCallback((id: string) => {
    setSelectedId(id);
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1020px)").matches) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    previewRef.current?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  }, []);

  const entries = useMemo(
    () =>
      PLAN_TEMPLATES.map((plan) => ({ plan, estimate: estimatePlanTemplate(plan.id) })),
    [],
  );
  /* Counted, never typed. The library is growing by provenance sweep, and a
     sentence claiming "twelve" the day the thirteenth lands is exactly the
     kind of small lie this site refuses to tell. */
  const totalCount = entries.length;
  const openCount = entries.filter(({ plan }) => plan.source.kind !== "aura-authored").length;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(({ plan, estimate }) => {
      if (size !== "all" && sizeOf(estimate.areaSqFt) !== size) return false;
      if (bedrooms !== "all" && bedroomsOf(plan.bedrooms) !== bedrooms) return false;
      if (source === "aura" && plan.source.kind !== "aura-authored") return false;
      if (source === "open" && plan.source.kind === "aura-authored") return false;
      if (!needle) return true;
      return `${plan.title} ${plan.summary} ${plan.bestFor} ${plan.tags.join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
  }, [bedrooms, entries, query, size, source]);
  const selected = visible.find(({ plan }) => plan.id === selectedId) ?? visible[0] ?? entries[0];

  return (
    <section className="plan-library" aria-labelledby="plan-library-heading" data-selected-plan={selected.plan.id}>
      <div className="plan-library__intro">
        <div>
          <p className="aura-label text-aura-emerald">Prebuilt plan library</p>
          <h2 id="plan-library-heading">Start from a plan, then make it yours.</h2>
          <p>
            Compare {totalCount} editable eco-home concepts, including {openCount} adapted from
            open-licence or public-domain sources with their provenance stated in full. Every choice
            becomes a complete Aura project—3D, plan, autosave, exports and cost range included.
          </p>
        </div>
        <div className="plan-library__truth">
          <span>{totalCount} editable concepts</span>
          <span>{openCount} sourced adaptations</span>
          <span>Alberta cost ranges</span>
        </div>
      </div>

      <div className="plan-library__filters" aria-label="Filter plan library">
        <label className="plan-search">
          <span>Search plans</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cabin, accessible, two bedroom…"
          />
        </label>
        <label>
          <span>Size</span>
          <select value={size} onChange={(event) => setSize(event.target.value as SizeFilter)}>
            <option value="all">Any size</option>
            <option value="micro">Under 400 sq ft</option>
            <option value="compact">400–800 sq ft</option>
            <option value="home">800+ sq ft</option>
          </select>
        </label>
        <label>
          <span>Sleeping</span>
          <select value={bedrooms} onChange={(event) => setBedrooms(event.target.value as BedroomFilter)}>
            <option value="all">Any layout</option>
            <option value="studio">Studio</option>
            <option value="one">One bedroom</option>
            <option value="two-plus">Two+ bedrooms</option>
          </select>
        </label>
        <label>
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value as SourceFilter)}>
            <option value="all">All sources</option>
            <option value="aura">Aura originals</option>
            <option value="open">Open + public domain</option>
          </select>
        </label>
      </div>

      <div className="plan-library__body">
        <div className="plan-library__grid">
          {visible.map(({ plan, estimate }) => {
            const active = selected.plan.id === plan.id;
            return (
              <button
                type="button"
                key={plan.id}
                aria-pressed={active}
                onClick={() => choose(plan.id)}
                className="plan-card"
              >
                <div className="plan-card__visual">
                  <PlanDiagram plan={plan} />
                  <span className={plan.source.kind === "aura-authored" ? "plan-source" : "plan-source plan-source--open"}>
                    {plan.source.kind === "aura-authored"
                      ? "Aura original"
                      : plan.source.kind === "licensed-adaptation"
                        ? "Open source"
                        : "Public domain"}
                  </span>
                </div>
                <div className="plan-card__copy">
                  <span>{plan.kicker}</span>
                  <strong>{plan.title}</strong>
                  <p>{plan.summary}</p>
                  <dl>
                    <div><dt>Sleep</dt><dd>{plan.bedrooms === 0 ? "Studio" : `${plan.bedrooms} bed`}</dd></div>
                    <div><dt>Bath</dt><dd>{plan.bathrooms}</dd></div>
                    <div><dt>Range</dt><dd>{money(estimate.low)}–{money(estimate.high)}</dd></div>
                  </dl>
                </div>
              </button>
            );
          })}
          {visible.length === 0 ? (
            <div className="plan-library__empty">
              <p>No plans match all four filters.</p>
              <button type="button" onClick={() => { setQuery(""); setSize("all"); setBedrooms("all"); setSource("all"); }}>
                Clear filters
              </button>
            </div>
          ) : null}
        </div>

        <aside
          ref={previewRef}
          className="plan-preview"
          aria-label={`${selected.plan.title} plan preview`}
          /* aria-live sits HERE, not on the grid: the announcement worth
             making is "the preview now shows X", spoken from the place that
             changed. */
          aria-live="polite"
        >
          <div className="plan-preview__drawing">
            {/* a real hidden-line axonometric from the plan's own model — the
                click finally shows massing, roof and storeys, not a rectangle */}
            <PlanAxonPreview plan={selected.plan} />
            <span>{selected.plan.spec.volumes.length} shell{selected.plan.spec.volumes.length === 1 ? "" : "s"}</span>
          </div>
          <div className="plan-preview__content">
            <p className="aura-label text-aura-emerald">Selected concept</p>
            <h3>{selected.plan.title}</h3>
            <p className="plan-preview__best">{selected.plan.bestFor}</p>
            <ul>
              {selected.plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <div className="plan-preview__numbers">
              <div><span>Floor area</span><strong>{Math.round(selected.estimate.areaSqFt).toLocaleString("en-CA")} sq ft</strong></div>
              <div><span>Materials + systems</span><strong>{money(selected.estimate.low)}–{money(selected.estimate.high)}</strong></div>
              <div><span>Planning midpoint</span><strong>{money(selected.estimate.mid)}</strong></div>
            </div>
            <p className="plan-preview__basis">
              {selected.estimate.lineItems} line items · Alberta pilot range · excludes land, permits,
              professional design, unknown site work, tax and contingency.
            </p>
            <div className="plan-preview__actions">
              <Button tone="loud" onClick={() => onChoose(instantiatePlanTemplate(selected.plan.id), selected.plan)}>
                Use {selected.plan.title}
              </Button>
              <a href={selected.plan.source.url} target="_blank" rel="noreferrer">
                {selected.plan.source.kind === "aura-authored"
                  ? "About Aura’s method ↗"
                  : selected.plan.source.kind === "licensed-adaptation"
                    ? "Open source files ↗"
                    : "Original plan set ↗"}
              </a>
            </div>
            <details className="plan-preview__source">
              <summary>Source, licence and limitations</summary>
              <p>{selected.plan.source.attribution}</p>
              <p>{selected.plan.source.changes}</p>
              <p>
                <a href={selected.plan.source.licenseUrl} target="_blank" rel="noreferrer">{selected.plan.source.license} ↗</a>
                {selected.plan.source.shareAlike ? " · attribution and ShareAlike stay with this study" : ""}
              </p>
              <p>
                Design intent only—not structural, energy, permit or construction documents. Local professionals must
                adapt and approve the project before it is built.
              </p>
            </details>
            {currentName !== selected.plan.title ? (
              <p className="plan-preview__undo">Your current “{currentName}” stays one Undo away after choosing.</p>
            ) : (
              <p className="plan-preview__undo">This concept is currently open in the editor.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
