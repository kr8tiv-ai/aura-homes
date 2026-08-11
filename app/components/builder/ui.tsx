"use client";

/* Editor primitives for the builder.

   Deliberately small and boring. Everything resolves through the tonal ladder
   (aura-*) so it flips with night mode; there is not a literal colour in this
   file, which is the rule the rest of the site keeps and the reason the whole
   thing repaints correctly at 2 a.m.

   Where a control already exists in `components/design/Controls.tsx` — the
   text field, the select, the textarea — that one is used rather than a second
   one written here. Sliders and the segmented control are the two the
   questionnaire never needed. */

import type { ReactNode } from "react";

/* ---------------------------------------------------------------- surface */

export function Panel({
  label,
  hint,
  right,
  children,
  className = "",
}: {
  label: string;
  hint?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`aura-panel p-6 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="aura-label">{label}</p>
        {right}
      </div>
      {hint ? (
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-aura-text/60">{hint}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Stat({ k, v, sub }: { k: string; v: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-md border aura-hairline px-4 py-3">
      <p className="aura-label">{k}</p>
      <p className="mt-1.5 text-sm tabular-nums text-aura-text">{v}</p>
      {sub ? <p className="mt-1 text-xs leading-snug text-aura-text/55">{sub}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- buttons */

const BUTTON_BASE =
  "rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-label transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

export function Button({
  children,
  onClick,
  tone = "quiet",
  disabled,
  title,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  /** `loud` is the one action on a panel worth pulling the eye */
  tone?: "loud" | "quiet" | "danger";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  const tones = {
    loud: "border border-aura-emerald text-aura-emerald hover:bg-aura-emerald/10",
    quiet: "border aura-hairline text-aura-text/70 hover:border-aura-teal hover:text-aura-text",
    danger: "border border-aura-violet text-aura-violet hover:bg-aura-violet/10",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-cursor="Select"
      className={`${BUTTON_BASE} ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- sliders */

/**
 * A labelled range with its value always on screen.
 *
 * A number that only appears while you drag is a number you cannot read back,
 * and every dimension here ends up on a drawing — so the value is printed
 * beside the label, permanently, in the same feet-and-inches the sheet uses.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** how the value reads to a person — feet and inches, degrees, a bearing */
  display?: (v: number) => string;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="aura-label">{label}</span>
        <span className="font-mono text-xs tabular-nums text-aura-text/80">
          {display ? display(value) : value}
        </span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-aura-sunken accent-aura-emerald"
      />
      {hint ? <span className="mt-1.5 block text-xs leading-snug text-aura-text/55">{hint}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------- segmented */

/** A row of exclusive choices. A real `<button>` group rather than a select,
 *  because these are the choices worth SEEING all of — five roof forms read as
 *  five houses, and a closed dropdown reads as one. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  columns,
}: {
  label?: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string; title?: string }>;
  onChange: (v: T) => void;
  hint?: ReactNode;
  /** force a column count; otherwise the row wraps */
  columns?: number;
}) {
  return (
    <div>
      {label ? <p className="aura-label mb-2">{label}</p> : null}
      <div
        className={columns ? "grid gap-1.5" : "flex flex-wrap gap-1.5"}
        style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
        role="group"
        aria-label={label}
      >
        {options.map((o) => {
          const on = o.id === value;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(o.id)}
              aria-pressed={on}
              title={o.title}
              data-cursor="Select"
              className={`rounded-md border px-3 py-2 text-xs transition-colors ${
                on
                  ? "border-aura-emerald text-aura-text"
                  : "aura-hairline text-aura-text/60 hover:text-aura-text"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-aura-text/55">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------ text field */

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="block">
      <span className="aura-label mb-2 block">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text transition-colors focus:border-aura-emerald focus:outline-none"
      />
    </label>
  );
}

/* ------------------------------------------------------------- notices */

/** A warning the tool is telling the truth with. Violet is this site's
 *  "read this" colour — it is used for the plan engine's own warnings on the
 *  design page, and the builder uses it for the same reason. */
export function Notice({
  title,
  items,
  foot,
}: {
  title: string;
  items: readonly string[];
  foot?: ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-aura-violet p-5">
      <p className="aura-label text-aura-violet">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((w) => (
          <li key={w} className="flex gap-3 text-sm leading-relaxed text-aura-text/80">
            <span aria-hidden className="text-aura-violet">
              ·
            </span>
            <span>{w}</span>
          </li>
        ))}
      </ul>
      {foot ? <p className="mt-3 text-xs leading-relaxed text-aura-text/60">{foot}</p> : null}
    </div>
  );
}
