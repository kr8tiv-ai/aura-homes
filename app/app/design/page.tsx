"use client";

// Questionnaire wizard shell. All answers live in one state object shaped like
// the aura-architect Questionnaire; "Generate design" composes a reference
// brief client-side from those answers — honestly labeled as such on the page.
// The full pipeline (bylaw checks, climate-zone constraints, the costed model)
// runs in agent/ (aura-architect), not in this hosted demo.

import { useState } from "react";

const REPO_AGENT = "https://github.com/kr8tiv-ai/aura-homes/tree/main/agent";

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

// ------------------------------------------------- client-side reference brief
// Composed from the actual answers so the hosted demo never returns a canned
// narrative that ignores the questionnaire. It states inputs plus the standard
// Aura envelope; it makes NO verdict claims — those need the real pipeline.

const STYLE_LABELS: Record<string, string> = {
  modernCabin: "modern cabin",
  aFrame: "A-frame",
  bungalow: "bungalow",
  storeyAndAHalf: "storey-and-a-half",
};

const WATER_LABELS: Record<WizardState["water"]["source"], string> = {
  cistern: "a buried cistern",
  well: "a drilled well",
  awgSupplement: "a buried cistern with the AWG summer module",
};

const SEPTIC_LABELS: Record<string, string> = {
  tankAndField: "a tank-and-field septic system",
  mound: "a mound septic system",
  holdingTank: "a holding-tank septic system",
  packagedTreatment: "a packaged treatment septic system",
};

function composeBrief(s: WizardState): string {
  const size = Number(s.home.sizeSqft);
  const sizeTxt =
    Number.isFinite(size) && size > 0 ? size.toLocaleString("en-CA") : s.home.sizeSqft;
  const storeys = s.home.storeys === "2" ? "two-storey" : "single-storey";
  const style = STYLE_LABELS[s.home.style] ?? s.home.style;
  const beds = s.home.bedrooms.trim();
  const power =
    `a ${s.energy.solarKw} kW solar array with ${s.energy.batteryKwh} kWh of storage` +
    (s.energy.backupGenerator ? " and generator backup" : ", with no backup generator");
  const heat = s.energy.woodStove
    ? "A WETT-inspected wood stove provides resilient heat"
    : "Heating runs on the electrical system, with no wood stove";
  const hrv = s.extras.hrv ? ", with an HRV keeping the tight envelope fresh" : "";
  const extras = [s.extras.deck && "a deck", s.extras.hotTub && "a wood-fired hot tub"]
    .filter(Boolean)
    .join(" and ");
  return (
    `A ${storeys} ${style} of ${sizeTxt} sqft with ${beds} bedroom${beds === "1" ? "" : "s"} ` +
    `on ${s.parcel.acreage} acres in ${s.parcel.county} (${s.parcel.district}), ` +
    `sited on screw piles with a structural insulated panel envelope (walls R-24, roof R-40). ` +
    `Power comes from ${power}; water from ${WATER_LABELS[s.water.source]}, ` +
    `draining to ${SEPTIC_LABELS[s.water.septic] ?? s.water.septic}. ` +
    `${heat}${hrv}.` +
    (extras ? ` Outside: ${extras}.` : "")
  );
}

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
    // Static-export build: the brief is composed client-side from the answers
    // so the hosted demo needs no server. The real pipeline lives in agent/.
    await new Promise((r) => setTimeout(r, 400));
    setResult(composeBrief(state));
    setBusy(false);
  }

  return (
    <div className="py-16">
      <p className="aura-label mb-4">Design questionnaire</p>
      <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">Tell Aura about your build</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-aura-text/70">
        Hosted demo: the brief is composed in your browser from your answers, as a reference. The
        full pipeline — bylaw checks, climate-zone constraints, and the costed model — runs in the
        open repo,{" "}
        <a
          href={REPO_AGENT}
          target="_blank"
          rel="noreferrer"
          className="text-aura-emerald underline underline-offset-4"
        >
          agent/
        </a>
        .
      </p>

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
          <p className="aura-label mb-4">Design brief — reference</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-aura-text/80">{result}</p>
          <p className="mt-4 text-xs leading-relaxed text-aura-text/60">
            Composed client-side from your answers. Verdicts — district minimums, Part 9, zone 7A —
            come from the real pipeline in agent/, not this demo.
          </p>
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
      className="w-full rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text"
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
      className="w-full rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 text-sm text-aura-text"
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
