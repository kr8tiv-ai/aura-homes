"use client";

import { useMemo, useState } from "react";

import {
  PLAN_TEMPLATES,
  estimatePlanTemplate,
  instantiatePlanTemplate,
  type PlanTemplate,
} from "@/lib/builder/planCatalog";
import type { BuilderDocument } from "@/lib/builder/document";
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

interface Point {
  x: number;
  y: number;
}

function corners(plan: PlanTemplate): Point[] {
  const out: Point[] = [];
  for (const volume of plan.spec.volumes) {
    const radians = (volume.rotationDeg * Math.PI) / 180;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    for (const [localX, localY] of [
      [-volume.widthFt / 2, -volume.depthFt / 2],
      [volume.widthFt / 2, -volume.depthFt / 2],
      [volume.widthFt / 2, volume.depthFt / 2],
      [-volume.widthFt / 2, volume.depthFt / 2],
    ] as const) {
      out.push({
        x: volume.x + localX * c - localY * s,
        y: volume.z + localX * s + localY * c,
      });
    }
  }
  return out;
}

function PlanDiagram({ plan, large = false }: { plan: PlanTemplate; large?: boolean }) {
  const points = corners(plan);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const pad = Math.max(width, height) * 0.16;
  const pattern = `plan-grid-${plan.id}`;

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${width + pad * 2} ${height + pad * 2}`}
      role="img"
      aria-label={`${plan.title} concept footprint`}
      className={large ? "plan-diagram plan-diagram--large" : "plan-diagram"}
    >
      <defs>
        <pattern id={pattern} width="2" height="2" patternUnits="userSpaceOnUse">
          <path d="M 2 0 L 0 0 0 2" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.12" />
        </pattern>
      </defs>
      <rect x={minX - pad} y={minY - pad} width={width + pad * 2} height={height + pad * 2} fill={`url(#${pattern})`} />
      {plan.spec.volumes.map((volume, index) => (
        <g key={volume.id} transform={`translate(${volume.x} ${volume.z}) rotate(${volume.rotationDeg})`}>
          <rect
            x={-volume.widthFt / 2}
            y={-volume.depthFt / 2}
            width={volume.widthFt}
            height={volume.depthFt}
            rx="0.35"
            className="plan-diagram__mass"
          />
          <path
            d={`M ${-volume.widthFt * 0.32} ${volume.depthFt / 2} H ${volume.widthFt * 0.08}`}
            className="plan-diagram__glass"
          />
          <path
            d={`M ${-volume.widthFt / 2} 0 H ${volume.widthFt / 2} M 0 ${-volume.depthFt / 2} V ${volume.depthFt / 2}`}
            className="plan-diagram__guide"
          />
          {large ? (
            <text x="0" y="0" textAnchor="middle" dominantBaseline="central" className="plan-diagram__label">
              {index + 1}
            </text>
          ) : null}
        </g>
      ))}
      <g transform={`translate(${minX - pad * 0.55} ${minY - pad * 0.3})`} className="plan-diagram__north">
        <path d="M 0 3 L 1.4 0 L 2.8 3 Z" />
        <text x="1.4" y="5.2" textAnchor="middle">N</text>
      </g>
    </svg>
  );
}

export default function PlanCatalog({ onChoose, currentName }: Props) {
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<SizeFilter>("all");
  const [bedrooms, setBedrooms] = useState<BedroomFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [selectedId, setSelectedId] = useState(PLAN_TEMPLATES[0].id);

  const entries = useMemo(
    () =>
      PLAN_TEMPLATES.map((plan) => ({ plan, estimate: estimatePlanTemplate(plan.id) })),
    [],
  );
  /* Counted, never typed. The library is growing by provenance sweep, and a
     sentence claiming "twelve" the day the thirteenth lands is exactly the
     kind of small lie this site refuses to tell. */
  const totalCount = entries.length;
  const openCount = entries.filter(({ plan }) => plan.source.kind === "licensed-adaptation").length;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(({ plan, estimate }) => {
      if (size !== "all" && sizeOf(estimate.areaSqFt) !== size) return false;
      if (bedrooms !== "all" && bedroomsOf(plan.bedrooms) !== bedrooms) return false;
      if (source === "aura" && plan.source.kind !== "aura-authored") return false;
      if (source === "open" && plan.source.kind !== "licensed-adaptation") return false;
      if (!needle) return true;
      return `${plan.title} ${plan.summary} ${plan.bestFor} ${plan.tags.join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
  }, [bedrooms, entries, query, size, source]);
  const selected = visible.find(({ plan }) => plan.id === selectedId) ?? visible[0] ?? entries[0];

  return (
    <section className="plan-library" aria-labelledby="plan-library-heading">
      <div className="plan-library__intro">
        <div>
          <p className="aura-label text-aura-emerald">Prebuilt plan library</p>
          <h2 id="plan-library-heading">Start from a plan, then make it yours.</h2>
          <p>
            Compare {totalCount} editable eco-home concepts, including {openCount} carefully attributed
            open-licence studies. Every choice becomes a complete Aura project—3D, plan, autosave,
            exports and cost range included.
          </p>
        </div>
        <div className="plan-library__truth">
          <span>{totalCount} editable concepts</span>
          <span>{openCount} licensed sources</span>
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
            <option value="open">Open source</option>
          </select>
        </label>
      </div>

      <div className="plan-library__body">
        <div className="plan-library__grid" aria-live="polite">
          {visible.map(({ plan, estimate }) => {
            const active = selected.plan.id === plan.id;
            return (
              <button
                type="button"
                key={plan.id}
                aria-pressed={active}
                onClick={() => setSelectedId(plan.id)}
                className="plan-card"
              >
                <div className="plan-card__visual">
                  <PlanDiagram plan={plan} />
                  <span className={plan.source.kind === "licensed-adaptation" ? "plan-source plan-source--open" : "plan-source"}>
                    {plan.source.kind === "licensed-adaptation" ? "Open source" : "Aura original"}
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

        <aside className="plan-preview" aria-label={`${selected.plan.title} plan preview`}>
          <div className="plan-preview__drawing">
            <PlanDiagram plan={selected.plan} large />
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
                {selected.plan.source.kind === "licensed-adaptation" ? "Open source files ↗" : "About Aura’s method ↗"}
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
