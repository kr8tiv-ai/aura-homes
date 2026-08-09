"use client";

// Questionnaire wizard shell. All answers live in one state object shaped like
// the aura-architect Questionnaire; "Generate design" runs the client-side stub.

import { useState } from "react";
import { designFixture } from "@/lib/fixtures";

const steps = ["Land", "Home size & style", "Energy", "Water", "Extras"] as const;

interface WizardState {
  parcel: { county: string; district: string; acreage: string };
  home: { sizeSqft: string; style: string; storeys: string; bedrooms: string };
  energy: { solarKw: string; batteryKwh: string; backupGenerator: boolean; woodStove: boolean };
  water: { source: "cistern" | "well" | "awgSupplement"; septic: string };
  extras: { hotTub: boolean; deck: boolean; hrv: boolean };
}

const initialState: WizardState = {
  parcel: { county: "Lac Ste. Anne County", district: "Agriculture (AG)", acreage: "3" },
  home: { sizeSqft: "800", style: "modernCabin", storeys: "1", bedrooms: "2" },
  energy: { solarKw: "10", batteryKwh: "30", backupGenerator: true, woodStove: true },
  water: { source: "cistern", septic: "tankAndField" },
  extras: { hotTub: false, deck: true, hrv: true },
};

export default function DesignPage() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = <K extends keyof WizardState>(section: K, value: Partial<WizardState[K]>) =>
    setState((s) => ({ ...s, [section]: { ...s[section], ...value } }));

  async function generate() {
    setBusy(true);
    setResult(null);
    // Static-export build: the design stub runs client-side so the hosted demo
    // needs no server. The real pipeline lives in agent/ (aura-architect).
    await new Promise((r) => setTimeout(r, 400));
    const data = { ...designFixture, questionnaire: state };
    setResult(data.narrative ?? JSON.stringify(data, null, 2));
    setBusy(false);
  }

  return (
    <div className="py-16">
      <p className="aura-label mb-4">Design questionnaire</p>
      <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">Tell Aura about your build</h1>

      <div className="mt-10 flex flex-wrap gap-2">
        {steps.map((name, i) => (
          <button
            key={name}
            onClick={() => setStep(i)}
            className={`rounded-md border px-4 py-2 text-xs uppercase tracking-label transition-colors ${
              i === step
                ? "border-aura-emerald text-aura-emerald"
                : "aura-hairline text-aura-text/70 hover:text-aura-text"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="aura-panel mt-8 p-8">
        {step === 0 && (
          <StepGrid>
            <Field label="County">
              <TextInput
                value={state.parcel.county}
                onChange={(v) => patch("parcel", { county: v })}
              />
            </Field>
            <Field label="Planning district">
              <TextInput
                value={state.parcel.district}
                onChange={(v) => patch("parcel", { district: v })}
              />
            </Field>
            <Field label="Acreage">
              <TextInput
                value={state.parcel.acreage}
                onChange={(v) => patch("parcel", { acreage: v })}
              />
            </Field>
          </StepGrid>
        )}

        {step === 1 && (
          <StepGrid>
            <Field label="Size (sqft)">
              <TextInput
                value={state.home.sizeSqft}
                onChange={(v) => patch("home", { sizeSqft: v })}
              />
            </Field>
            <Field label="Style">
              <Select
                value={state.home.style}
                onChange={(v) => patch("home", { style: v })}
                options={[
                  ["modernCabin", "Modern cabin"],
                  ["aFrame", "A-frame"],
                  ["bungalow", "Bungalow"],
                  ["storeyAndAHalf", "Storey and a half"],
                ]}
              />
            </Field>
            <Field label="Storeys">
              <Select
                value={state.home.storeys}
                onChange={(v) => patch("home", { storeys: v })}
                options={[
                  ["1", "One"],
                  ["2", "Two"],
                ]}
              />
            </Field>
            <Field label="Bedrooms">
              <TextInput
                value={state.home.bedrooms}
                onChange={(v) => patch("home", { bedrooms: v })}
              />
            </Field>
          </StepGrid>
        )}

        {step === 2 && (
          <StepGrid>
            <Field label="Solar array (kW)">
              <TextInput
                value={state.energy.solarKw}
                onChange={(v) => patch("energy", { solarKw: v })}
              />
            </Field>
            <Field label="Battery (kWh)">
              <TextInput
                value={state.energy.batteryKwh}
                onChange={(v) => patch("energy", { batteryKwh: v })}
              />
            </Field>
            <Toggle
              label="Backup generator"
              checked={state.energy.backupGenerator}
              onChange={(v) => patch("energy", { backupGenerator: v })}
            />
            <Toggle
              label="Wood stove (WETT)"
              checked={state.energy.woodStove}
              onChange={(v) => patch("energy", { woodStove: v })}
            />
          </StepGrid>
        )}

        {step === 3 && (
          <StepGrid>
            <Field label="Water source">
              <Select
                value={state.water.source}
                onChange={(v) => patch("water", { source: v as WizardState["water"]["source"] })}
                options={[
                  ["cistern", "Buried cistern"],
                  ["well", "Drilled well"],
                  ["awgSupplement", "Cistern + AWG supplement"],
                ]}
              />
            </Field>
            <Field label="Septic">
              <Select
                value={state.water.septic}
                onChange={(v) => patch("water", { septic: v })}
                options={[
                  ["tankAndField", "Tank and field"],
                  ["mound", "Mound"],
                  ["holdingTank", "Holding tank"],
                  ["packagedTreatment", "Packaged treatment"],
                ]}
              />
            </Field>
          </StepGrid>
        )}

        {step === 4 && (
          <StepGrid>
            <Toggle
              label="Wood-fired hot tub"
              checked={state.extras.hotTub}
              onChange={(v) => patch("extras", { hotTub: v })}
            />
            <Toggle
              label="Deck"
              checked={state.extras.deck}
              onChange={(v) => patch("extras", { deck: v })}
            />
            <Toggle
              label="HRV"
              checked={state.extras.hrv}
              onChange={(v) => patch("extras", { hrv: v })}
            />
          </StepGrid>
        )}
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-md border aura-hairline px-5 py-2.5 text-xs uppercase tracking-label disabled:opacity-30"
        >
          Back
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            className="rounded-md border border-aura-teal px-5 py-2.5 text-xs uppercase tracking-label text-aura-teal"
          >
            Next
          </button>
        ) : (
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-full bg-aura-ink px-6 py-2.5 font-mono text-xs font-medium uppercase tracking-label text-aura-paper disabled:opacity-50"
          >
            {busy ? "Generating" : "Generate design"}
          </button>
        )}
      </div>

      {result && (
        <div className="aura-panel mt-10 p-8">
          <p className="aura-label mb-4">Design brief</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-aura-text/80">{result}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- primitives

function StepGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 md:grid-cols-2">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="aura-label mb-2 block">{label}</span>
      {children}
    </label>
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text outline-none focus:border-aura-emerald"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text outline-none focus:border-aura-emerald"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center justify-between rounded-md border px-4 py-3 text-left text-sm transition-colors ${
        checked ? "border-aura-emerald text-aura-text" : "aura-hairline text-aura-text/70"
      }`}
    >
      <span className="uppercase tracking-label text-xs">{label}</span>
      <span className={`text-xs ${checked ? "text-aura-lime" : "text-aura-text/65"}`}>
        {checked ? "On" : "Off"}
      </span>
    </button>
  );
}
