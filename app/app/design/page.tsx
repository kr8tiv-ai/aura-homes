"use client";

/* 02 · DESIGN — wired to the design service (design-api/).

   What this page is now: the questionnaire in design-api/app/models.py
   (DesignRequest), posted through the typed client in lib/designApi.ts, with
   the solved plan, the room schedule, the blueprint and every warning rendered
   from the response.

   What it was, and where that went: a five-step client-side wizard whose
   answers were pasted into a narrative paragraph in the browser. Its parcel
   questions (county, planning district, acreage) belong to /land and the agent
   pipeline — the design service does not take them and this page no longer
   pretends to price them. Its systems questions did not vanish: wood stove,
   wood-fired hot tub, deck, greywater, solar and battery are now the STANDARD
   rows of the Aura eco spec below, and generator, HRV, grid-connect and
   hempcrete are the four real options.

   Honesty rules this page keeps:
   · No service, no result. If the endpoint does not answer, the page says so
     and shows nothing in its place — it never composes a fake plan.
   · `offline: true` from the service is labelled as the deterministic geometry
     path, not passed off as an AI design.
   · Every warning is rendered, and the drawing's REVIEW-READY / NOT FOR
     CONSTRUCTION stamp is carried onto the page. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { Field, NumberInput, Select, Toggle } from "@/components/design/Controls";
import EcoChecklist from "@/components/design/EcoChecklist";
import DesignResult from "@/components/design/DesignResult";
import {
  CLIMATE_ZONES,
  MATERIALS,
  STYLES,
  composeNotes,
  materialWallMm,
} from "@/components/design/ecoSpec";
import {
  artifactUrl,
  designHealth,
  generateDesign,
  type ClimateZone,
  type DesignHealth,
  type DesignRequest,
  type DesignResponse,
  type EcoMaterial,
  type HomeStyle,
} from "@/lib/designApi";

const REPO_AGENT = "https://github.com/kr8tiv-ai/aura-homes/tree/main/agent";

/* The endpoint, taken from the client itself rather than re-read from env, so
   the address printed in an error message is the address that was called. */
const API_BASE = (artifactUrl("/") ?? "").replace(/\/$/, "");

const STOREYS = [
  { id: "1", label: "Single storey" },
  { id: "2", label: "Two storeys" },
] as const;

interface FormState {
  bedrooms: string;
  bathrooms: string;
  totalSqFt: string;
  climate: ClimateZone;
  material: EcoMaterial;
  style: HomeStyle;
  storeys: "1" | "2";
  offGrid: boolean;
  ownerNotes: string;
}

/* The Alberta pilot, which is also the reference build the budget and escrow
   pages cost: 800 sq ft, zone 7A, SIP, off grid. */
const INITIAL: FormState = {
  bedrooms: "2",
  bathrooms: "1",
  totalSqFt: "800",
  climate: "7A",
  material: "sip",
  style: "off_grid_cabin",
  storeys: "1",
  offGrid: true,
  ownerNotes: "",
};

const INITIAL_OPTIONS = ["generator", "hrv"];

type Phase = "idle" | "loading" | "done" | "failed";

interface Failure {
  kind: "unreachable" | "rejected";
  message: string;
}

/** generateDesign throws `design service <status>: …` for an answered-but-
 *  refused request, and a network TypeError when nothing answered at all.
 *  The two need different words: one is a bad brief, the other is a service
 *  that is not running. */
function classify(err: unknown): Failure {
  const message = err instanceof Error ? err.message : String(err);
  return /^design service \d+/.test(message)
    ? { kind: "rejected", message }
    : { kind: "unreachable", message };
}

export default function DesignPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [options, setOptions] = useState<string[]>(INITIAL_OPTIONS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<DesignResponse | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  /* undefined = still probing, null = the service did not answer. */
  const [health, setHealth] = useState<DesignHealth | null | undefined>(undefined);
  const [probe, setProbe] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setHealth(undefined);
    designHealth(ac.signal).then((h) => {
      if (!ac.signal.aborted) setHealth(h);
    });
    return () => ac.abort();
  }, [probe]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    []
  );

  const toggleOption = useCallback(
    (id: string, on: boolean) =>
      setOptions((prev) =>
        on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
      ),
    []
  );

  const composed = useMemo(
    () => composeNotes(form.material, options, form.ownerNotes),
    [form.material, form.ownerNotes, options]
  );

  /* Client-side checks that mirror the service's Field() constraints, so a
     typo comes back as a sentence instead of a 422 from Pydantic. */
  const errors = useMemo(() => {
    const out: string[] = [];
    const beds = Number(form.bedrooms);
    const baths = Number(form.bathrooms);
    const area = Number(form.totalSqFt);
    if (form.bedrooms.trim() === "" || !Number.isInteger(beds) || beds < 0 || beds > 6)
      out.push("Bedrooms must be a whole number from 0 to 6.");
    if (
      form.bathrooms.trim() === "" ||
      !Number.isFinite(baths) ||
      baths < 0.5 ||
      baths > 4 ||
      (baths * 2) % 1 !== 0
    )
      out.push("Bathrooms must be in half steps from 0.5 to 4 — 0.5 is a powder room.");
    if (form.totalSqFt.trim() === "" || !Number.isInteger(area) || area < 200 || area > 4000)
      out.push("Total floor area must be a whole number of square feet from 200 to 4,000.");
    return out;
  }, [form.bedrooms, form.bathrooms, form.totalSqFt]);

  const request: DesignRequest = useMemo(
    () => ({
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      total_sq_ft: Number(form.totalSqFt),
      climate_zone: form.climate,
      material: form.material,
      style: form.style,
      storeys: form.storeys === "2" ? 2 : 1,
      off_grid: form.offGrid,
      notes: composed.notes,
    }),
    [form, composed.notes]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (errors.length > 0 || phase === "loading") return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setPhase("loading");
    setFailure(null);
    setResult(null);
    try {
      const res = await generateDesign(request, ac.signal);
      if (ac.signal.aborted) return;
      setResult(res);
      setPhase("done");
      // The service answered; re-read /health rather than inferring its
      // wiring from the response — a guessed status bar is a lie.
      setProbe((n) => n + 1);
    } catch (err) {
      if (ac.signal.aborted) return;
      const f = classify(err);
      setFailure(f);
      setPhase("failed");
      if (f.kind === "unreachable") setHealth(null);
    }
  }

  const wallMm = materialWallMm(form.material);

  return (
    <div className="py-16">
      <Reveal y={10}>
        <p className="aura-label mb-4">02 · Design</p>
      </Reveal>
      <RevealWords
        text="Tell Aura about your build"
        className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]"
      />
      <Reveal delay={0.12} y={12}>
        <p className="mt-4 max-w-2xl text-[0.95rem] leading-[1.65] text-aura-text/75">
          The questionnaire posts to the design service, which reasons a room program, re-solves the
          geometry deterministically, and draws a dimensioned plan at 1/4&quot; = 1&apos;-0&quot;.
          Python owns the geometry; nothing on the drawing is drawn by a language model. Parcel
          questions — district minimums, aquifer, septic soils — live on{" "}
          <Link href="/land" data-cursor="Open" className="text-aura-emerald underline underline-offset-4">
            /land
          </Link>{" "}
          and in the open pipeline at{" "}
          <a
            href={REPO_AGENT}
            target="_blank"
            rel="noreferrer"
            data-cursor="Open"
            className="text-aura-emerald underline underline-offset-4"
          >
            agent/
          </a>
          .
        </p>
      </Reveal>

      {/* --------------------------------------------------- service status */}
      <Reveal y={12} className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          {health === undefined ? (
            <span className="rounded border aura-hairline px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/60">
              Checking service
            </span>
          ) : health === null ? (
            <span className="rounded border border-aura-violet px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">
              Service unreachable
            </span>
          ) : (
            <span className="rounded border border-aura-emerald px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-emerald">
              Service reachable
            </span>
          )}
          <span className="font-mono text-xs text-aura-text/55">{API_BASE}</span>
          {health ? (
            <span className="text-xs text-aura-text/65">
              {health.llm
                ? `Reasoning: ${health.llm_provider ?? "LLM"}`
                : "No LLM key — deterministic room program"}{" "}
              ·{" "}
              {health.images
                ? `Renders: ${health.image_model ?? "image backend"}`
                : "No image key — blueprint only, no AI renders"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setProbe((n) => n + 1)}
            data-cursor="Recheck"
            className="rounded-full border aura-hairline px-3 py-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-teal"
          >
            Re-check
          </button>
        </div>
      </Reveal>

      <form onSubmit={submit}>
        {/* --------------------------------------------------------- the home */}
        <Reveal y={18} className="mt-6">
          <div className="aura-panel p-8">
            <p className="aura-label">The home</p>
            <Stagger className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3" gap={0.05}>
              <StaggerItem>
                <Field label="Bedrooms" hint="0 to 6.">
                  <NumberInput
                    value={form.bedrooms}
                    onChange={(v) => set("bedrooms", v)}
                    min={0}
                    max={6}
                  />
                </Field>
              </StaggerItem>
              <StaggerItem>
                <Field label="Bathrooms" hint="Half steps — 0.5 is a powder room.">
                  <NumberInput
                    value={form.bathrooms}
                    onChange={(v) => set("bathrooms", v)}
                    min={0.5}
                    max={4}
                    step={0.5}
                  />
                </Field>
              </StaggerItem>
              <StaggerItem>
                <Field label="Total floor area (sq ft)" hint="200 to 4,000.">
                  <NumberInput
                    value={form.totalSqFt}
                    onChange={(v) => set("totalSqFt", v)}
                    min={200}
                    max={4000}
                    step={10}
                  />
                </Field>
              </StaggerItem>
              <StaggerItem>
                <Field label="Storeys">
                  <Select
                    value={form.storeys}
                    onChange={(v) => set("storeys", v)}
                    options={STOREYS}
                  />
                </Field>
              </StaggerItem>
              <StaggerItem>
                <Field
                  label="Climate zone"
                  hint="7A is the Alberta pilot — 5,000–5,999 heating degree-days."
                >
                  <Select
                    value={form.climate}
                    onChange={(v) => set("climate", v)}
                    options={CLIMATE_ZONES}
                  />
                </Field>
              </StaggerItem>
              <StaggerItem>
                <Field
                  label="Structural material"
                  hint={`Drawn at its real thickness — ${wallMm} mm walls, which changes the net internal area.`}
                >
                  <Select
                    value={form.material}
                    onChange={(v) => set("material", v)}
                    options={MATERIALS.map((m) => ({ id: m.id, label: `${m.label} · ${m.wallMm} mm` }))}
                  />
                </Field>
              </StaggerItem>
              <StaggerItem>
                <Field label="Style">
                  <Select value={form.style} onChange={(v) => set("style", v)} options={STYLES} />
                </Field>
              </StaggerItem>
              <StaggerItem className="flex items-end">
                <Toggle
                  label="Off grid"
                  checked={form.offGrid}
                  onChange={(v) => set("offGrid", v)}
                  hint="Off grid by default; the grid-connect option is in the checklist below."
                />
              </StaggerItem>
            </Stagger>
          </div>
        </Reveal>

        {/* --------------------------------------------------- the eco spec */}
        <Reveal y={18} className="mt-6">
          <EcoChecklist
            material={form.material}
            chosen={options}
            onToggle={toggleOption}
            ownerText={form.ownerNotes}
            onOwnerText={(v) => set("ownerNotes", v)}
            composed={composed}
          />
        </Reveal>

        {/* ----------------------------------------------------------- submit */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={phase === "loading" || errors.length > 0}
            data-cursor="Generate"
            className="rounded-full bg-aura-ink px-6 py-2.5 font-mono text-xs font-medium uppercase tracking-label text-aura-paper transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {phase === "loading" ? "Generating" : "Generate design"}
          </button>
          <button
            type="button"
            onClick={() => {
              setForm(INITIAL);
              setOptions(INITIAL_OPTIONS);
            }}
            data-cursor="Reset"
            className="rounded-md border aura-hairline px-5 py-2.5 font-mono text-xs uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-teal"
          >
            Reset to the Alberta pilot
          </button>
          <span className="text-xs text-aura-text/55">
            {request.bedrooms} bed · {request.bathrooms} bath ·{" "}
            {Number.isFinite(request.total_sq_ft) ? request.total_sq_ft.toLocaleString("en-CA") : "—"}{" "}
            sq ft · zone {request.climate_zone}
          </span>
        </div>

        {errors.length > 0 && (
          <ul className="mt-4 space-y-1">
            {errors.map((e) => (
              <li key={e} className="text-xs leading-relaxed text-aura-violet">
                {e}
              </li>
            ))}
          </ul>
        )}
      </form>

      {/* ------------------------------------------------- loading / failure */}
      <div aria-live="polite">
        {phase === "loading" && (
          <div className="aura-panel mt-10 p-8">
            <p className="aura-label animate-pulse">Solving</p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-aura-text/70">
              Packing the room program into an envelope, clustering the wet rooms onto a shared
              plumbing wall, checking glazing against the 22% FDWR ceiling, then drawing the plan
              and writing the PDF and DXF. The geometry is deterministic, so this is the same answer
              every time for the same brief.
            </p>
          </div>
        )}

        {phase === "failed" && failure && (
          <div className="mt-10 rounded-xl border border-aura-violet p-8">
            <p className="aura-label text-aura-violet">
              {failure.kind === "unreachable" ? "The design service did not answer" : "The service refused this brief"}
            </p>
            {failure.kind === "unreachable" ? (
              <>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/80">
                  Nothing answered at <span className="font-mono">{API_BASE}</span>, so there is no
                  design to show — and this page will not compose one in the browser and call it a
                  result. Your answers and the brief above are intact; run the service and press
                  Generate again.
                </p>
                <pre className="mt-4 overflow-x-auto rounded-md border aura-hairline p-4 font-mono text-xs leading-relaxed text-aura-text/70">
{`cd design-api
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000`}
                </pre>
                <p className="mt-3 max-w-2xl text-xs leading-relaxed text-aura-text/60">
                  Every key in the service is optional: with none configured it still returns a full
                  blueprint from the deterministic planner and reports{" "}
                  <span className="font-mono">offline: true</span>. Point this page elsewhere with{" "}
                  <span className="font-mono">NEXT_PUBLIC_DESIGN_API</span>.
                </p>
              </>
            ) : (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/80">
                The service answered and rejected the request, which usually means a value outside
                the contract — bedrooms 0–6, bathrooms in half steps to 4, area 200–4,000 sq ft, or
                a room program that cannot be packed into the envelope.
              </p>
            )}
            <p className="mt-4 break-words font-mono text-xs leading-relaxed text-aura-text/60">
              {failure.message}
            </p>
            <button
              type="button"
              onClick={() => setProbe((n) => n + 1)}
              data-cursor="Recheck"
              className="mt-4 rounded-full border border-aura-teal px-4 py-1.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-teal transition-colors hover:bg-aura-teal/5"
            >
              Re-check the service
            </button>
          </div>
        )}

        {phase === "done" && result && <DesignResult res={result} />}
      </div>
    </div>
  );
}
