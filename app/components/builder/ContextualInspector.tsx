import type { StudioInspectorState } from "@/lib/builder/guidedStudio";

/**
 * A read-only projection of BuilderApp and GraphPlanEditor state.
 *
 * This component owns no hooks, draft, project, selection, geometry, history,
 * persistence, or mutation callback. It can explain what the editor already
 * knows, but it cannot create a second editor model or change the document.
 */
export default function ContextualInspector({ value }: { value: StudioInspectorState }) {
  return (
    <section
      role="region"
      aria-label="Selection inspector"
      aria-live="polite"
      data-inspector-state={value.state}
      data-selection-kind={"selectionKind" in value && value.selectionKind ? value.selectionKind : undefined}
      className={`rounded-xl border p-5 ${
        value.state === "invalid" ? "border-aura-violet" : "aura-hairline"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`aura-label ${value.state === "invalid" ? "text-aura-violet" : "text-aura-emerald"}`}>
            {value.state === "invalid" ? "Value needs attention" : "Context"}
          </p>
          <h2 className="mt-2 text-lg font-medium text-aura-text">{value.heading}</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-aura-text/65">{value.description}</p>
        </div>
        <span className="rounded-full border aura-hairline px-2 py-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/55">
          {value.state}
        </span>
      </div>

      {value.state === "invalid" ? (
        <div className="mt-4 rounded-md border border-aura-violet/60 bg-aura-violet/5 px-4 py-3">
          <p className="aura-label text-aura-violet">Entered value</p>
          <code className="mt-1 block font-mono text-sm text-aura-text">{value.raw || "(empty)"}</code>
          <p className="mt-2 text-xs leading-relaxed text-aura-violet">{value.constraint}</p>
        </div>
      ) : null}

      {value.dimensions.length > 0 ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {value.dimensions.map((dimension) => (
            <div key={`${dimension.label}:${dimension.value}`} className="rounded-md border aura-hairline px-3 py-2">
              <dt className="aura-label">{dimension.label}</dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-aura-text">{dimension.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {value.placement ? (
        <p className="mt-4 text-xs leading-relaxed text-aura-text/65">
          <span className="aura-label mr-2">Placement</span>
          {value.placement}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="aura-label">Available now</p>
        <ul className="mt-2 flex flex-wrap gap-2" aria-label="Relevant actions">
          {value.actions.map((action) => (
            <li key={action} className="rounded-full border aura-hairline px-3 py-1.5 text-xs text-aura-text/70">
              {action}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
