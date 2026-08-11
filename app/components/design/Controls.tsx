"use client";

/* Form primitives for the 02 · DESIGN questionnaire.
   Lifted from the shape the wizard already used on this page so the controls
   look the same as before; every colour resolves through the tonal ladder
   (aura-*) so they flip with night mode. No literal hex anywhere. */

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="aura-label mb-2 block">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-snug text-aura-text/55">{hint}</span> : null}
    </label>
  );
}

const CONTROL =
  "w-full rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text transition-colors focus:border-aura-emerald focus:outline-none";

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  invalid?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      min={min}
      max={max}
      step={step}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      className={`${CONTROL} tabular-nums ${invalid ? "border-aura-violet" : ""}`}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ id: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={CONTROL}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${CONTROL} resize-y leading-relaxed`}
    />
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      data-cursor="Toggle"
      className={`flex h-full w-full flex-col justify-center rounded-md border px-4 py-3 text-left transition-colors ${
        checked ? "border-aura-emerald text-aura-text" : "aura-hairline text-aura-text/70"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-label">{label}</span>
        <span className={`text-xs ${checked ? "text-aura-lime" : "text-aura-text/65"}`}>
          {checked ? "On" : "Off"}
        </span>
      </span>
      {hint ? <span className="mt-1 text-xs leading-snug text-aura-text/55">{hint}</span> : null}
    </button>
  );
}

/** One branch of a choice, drawn in the same language as `CheckRow`.
 *
 *  A real `<input type="radio">` rather than a styled button: grouping,
 *  arrow-key movement and the announced "2 of 2" come free from the
 *  platform, and a branch this consequential should not reinvent them. */
export function ChoiceRow({
  name,
  label,
  detail,
  checked,
  onSelect,
}: {
  /** Shared across the branches so the browser groups them. */
  name: string;
  label: string;
  detail: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex h-full cursor-pointer gap-3 rounded-md border px-4 py-3 transition-colors ${
        checked ? "border-aura-emerald" : "aura-hairline"
      }`}
      data-cursor="Select"
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 accent-aura-emerald"
      />
      <span className="min-w-0">
        <span className={`block text-sm ${checked ? "text-aura-text" : "text-aura-text/80"}`}>
          {label}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-aura-text/60">{detail}</span>
      </span>
    </label>
  );
}

/** A checklist row. `locked` rows are the standard spec: checked, not
 *  removable, and labelled as such rather than quietly disabled. */
export function CheckRow({
  label,
  detail,
  checked,
  locked = false,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  locked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex gap-3 rounded-md border px-4 py-3 transition-colors ${
        locked
          ? "border-aura-emerald/40"
          : checked
            ? "border-aura-teal cursor-pointer"
            : "aura-hairline cursor-pointer"
      }`}
      data-cursor={locked ? undefined : "Toggle"}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        readOnly={locked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-aura-emerald"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-aura-text">{label}</span>
          {locked ? (
            <span className="rounded border border-aura-emerald px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-emerald">
              Standard
            </span>
          ) : null}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-aura-text/60">{detail}</span>
      </span>
    </label>
  );
}
