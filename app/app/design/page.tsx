"use client";

/* 02 · DESIGN — the geometry engine, in this page by default.

   What this page is now: the questionnaire in design-api/app/models.py
   (DesignRequest), answered by the deterministic engine ported into
   lib/design/, or by the FastAPI service when one is connected — with the
   solved plan, the room schedule, the blueprint and every warning rendered
   from the response.

   THE INVERSION, which is the point of this file. It used to post to the
   service and show nothing when the service did not answer, which on a static
   export meant the centrepiece of the product did nothing. The deterministic
   path never needed a server: it turns a room program into geometry with pure
   arithmetic. So it runs here, always, and the service became the optional
   upgrade that adds an LLM-authored room program and AI renders. Running
   locally is the DEFAULT, not the sad path, and the page says so in that tone.

   What this page was before that, and where it went: a five-step client-side
   wizard whose answers were pasted into a narrative paragraph in the browser.
   Its systems questions did not vanish: wood stove, wood-fired hot tub, deck,
   greywater, solar and battery are now the STANDARD rows of the Aura eco spec
   below, and generator, HRV, grid-connect and hempcrete are the four real
   options.

   I ALREADY HAVE LAND. The questionnaire now branches at the top, defaulting
   to still-looking. Saying you have a parcel is not a checkbox: the four facts
   it collects — lot width and depth, the three setbacks, which way the front
   lot line faces, and the slope — run through lib/design/parcel.ts against the
   SOLVED plan and change what the result says, up to and including telling you
   the home does not fit and offering the largest area that would. That module
   sits BESIDE the ported engine rather than inside it: layout/materials/
   blueprint are a verified line-by-line port of the Python service and teaching
   them about lots would silently break that guarantee.

   The parcel questions this page still does NOT ask — county, planning
   district, acreage, aquifer, septic soils — are the ones that are not
   arithmetic. They belong to /land and the agent pipeline, and asking for them
   here so they could be echoed back would be theatre.

   Honesty rules this page keeps:
   · Which engine drew it is stated before any of the numbers. A local plan is
     never dressed up as an AI design, and an AI design is never claimed for a
     drawing the browser produced.
   · If the service was tried and did not produce this, what it said is shown —
     including the case where it answered and refused the brief.
   · `offline: true` is labelled as the deterministic geometry path.
   · Every warning is rendered, and the drawing's REVIEW-READY / NOT FOR
     CONSTRUCTION stamp is carried onto the page. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { Field, NumberInput, Select, Toggle } from "@/components/design/Controls";
import EcoChecklist from "@/components/design/EcoChecklist";
import DesignResult from "@/components/design/DesignResult";
import ParcelPanel, {
  INITIAL_PARCEL,
  parcelErrors,
  parseParcel,
  type LandStatus,
  type ParcelForm,
} from "@/components/design/ParcelPanel";
import {
  CLIMATE_ZONES,
  MATERIALS,
  STYLES,
  composeNotes,
  materialWallMm,
} from "@/components/design/ecoSpec";
import { analyseParcel, type ParcelFacts } from "@/lib/design/parcel";
import {
  DESIGN_API_BASE,
  DESIGN_API_CONFIGURED,
  designHealth,
  requestDesign,
  type ClimateZone,
  type DesignHealth,
  type DesignOutcome,
  type DesignRequest,
  type EcoMaterial,
  type HomeStyle,
} from "@/lib/designApi";

const REPO_AGENT = "https://github.com/kr8tiv-ai/aura-homes/tree/main/agent";

/* The endpoint, taken from the client itself rather than re-read from env, so
   the address named on screen is the address that was called. */
const API_BASE = DESIGN_API_BASE;

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

type Phase = "idle" | "loading" | "done";

export default function DesignPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [options, setOptions] = useState<string[]>(INITIAL_OPTIONS);
  const [phase, setPhase] = useState<Phase>("idle");
  /* One object, so the result and the engine that produced it can never be
     rendered apart from each other. */
  const [outcome, setOutcome] = useState<DesignOutcome | null>(null);

  /* The land branch. Default is still-looking, because most people are. */
  const [land, setLand] = useState<LandStatus>("looking");
  const [parcel, setParcel] = useState<ParcelForm>(INITIAL_PARCEL);

  /* The parcel AS IT WAS when Generate was pressed. Reading the live form
     instead would let the findings drift away from the drawing they are
     describing the moment someone edits a lot dimension — the panel would
     be measuring a plan that is no longer on screen. */
  const [sited, setSited] = useState<{ facts: ParcelFacts; storeys: number } | null>(null);

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

  const setParcelField = useCallback(
    <K extends keyof ParcelForm>(key: K, value: ParcelForm[K]) =>
      setParcel((p) => ({ ...p, [key]: value })),
    []
  );

  /* Client-side checks that mirror the service's Field() constraints, so a
     typo comes back as a sentence instead of a 422 from Pydantic. The parcel
     fields join the same list rather than getting a quiet lane of their own:
     a fit check run against a number nobody finished typing is worse than no
     fit check, because it looks like one. */
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
    if (land === "have") out.push(...parcelErrors(parcel));
    return out;
  }, [form.bedrooms, form.bathrooms, form.totalSqFt, land, parcel]);

  /** True only when the parcel fields themselves are usable. */
  const parcelReady = useMemo(
    () => land === "have" && parcelErrors(parcel).length === 0,
    [land, parcel]
  );

  /**
   * The home, measured against the land — recomputed from the SNAPSHOT taken
   * at submit, never from the live form, so the findings always describe the
   * drawing that is actually on screen.
   */
  const parcelReport = useMemo(() => {
    const plan = outcome?.response?.plan;
    if (!plan || !sited) return null;
    return analyseParcel(sited.facts, plan, sited.storeys);
  }, [outcome, sited]);

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
    setOutcome(null);
    /* Freeze the parcel with the brief. `null` when they are still looking,
       which is what makes an absent findings panel mean "no land was given"
       rather than "the land was fine". */
    setSited(
      parcelReady ? { facts: parseParcel(parcel), storeys: request.storeys ?? 1 } : null
    );
    try {
      const res = await requestDesign(request, ac.signal);
      if (ac.signal.aborted) return;
      setOutcome(res);
      setPhase("done");

      if (res.engine === "service") {
        // The service answered; re-read /health rather than inferring its
        // wiring from the response — a guessed status bar is a lie.
        setProbe((n) => n + 1);
      } else if (res.serviceError?.kind === "unreachable") {
        // Nothing answered on the way to this result, so the pill must not
        // keep claiming a reachable service from an older probe.
        setHealth(null);
      }
    } catch (err) {
      if (ac.signal.aborted) return; // superseded by a newer Generate
      /* Defensive: requestDesign documents that it rejects only on abort. If it
         ever does otherwise, the reason is shown rather than swallowed. */
      setOutcome({
        engine: "none",
        response: null,
        serviceError: null,
        localError: err instanceof Error ? err.message : String(err),
      });
      setPhase("done");
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
          The questionnaire packs a room program into an envelope, checks it against the code, and
          draws a dimensioned plan at 1/4&quot; = 1&apos;-0&quot;. That runs in this page. Nothing on
          the drawing is drawn by a language model — connecting the design service adds an
          AI-authored room program and renders, not a different drawing. If you already have a
          parcel, say so below: the solved home is then measured against the buildable envelope your
          setbacks leave, against where south is, and against your slope. The parcel questions that
          are not arithmetic — district minimums, aquifer, septic soils — live on{" "}
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

      {/* ------------------------------------------- which engine is available
           Not a health readout with a red light: the engine that draws is
           always present. This says whether the optional upgrade is there. */}
      <Reveal y={12} className="mt-8">
        <div className="flex flex-wrap items-center gap-3">
          {health === undefined ? (
            <span className="rounded border aura-hairline px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/60">
              Checking for a service
            </span>
          ) : health === null ? (
            <span className="rounded border border-aura-teal px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-teal">
              In-browser engine
            </span>
          ) : (
            <span className="rounded border border-aura-emerald px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-emerald">
              Design service connected
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
          ) : health === null ? (
            <span className="text-xs text-aura-text/65">
              {DESIGN_API_CONFIGURED
                ? "The configured service is not answering — the deterministic engine in this page draws instead."
                : "No service configured, which is the normal state here — the deterministic engine in this page draws the plan."}
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
        {/* --------------------------------------------------------- the land
             First, because it is the question that changes what everything
             below is measured against. */}
        <Reveal y={18} className="mt-6">
          <ParcelPanel
            status={land}
            onStatus={setLand}
            value={parcel}
            onChange={setParcelField}
            invalid={land === "have" && !parcelReady}
          />
        </Reveal>

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
              setLand("looking");
              setParcel(INITIAL_PARCEL);
            }}
            data-cursor="Reset"
            className="rounded-md border aura-hairline px-5 py-2.5 font-mono text-xs uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-teal"
          >
            Reset to the Alberta pilot
          </button>
          <span className="text-xs text-aura-text/55">
            {request.bedrooms} bed · {request.bathrooms} bath ·{" "}
            {Number.isFinite(request.total_sq_ft) ? request.total_sq_ft.toLocaleString("en-CA") : "—"}{" "}
            sq ft · zone {request.climate_zone} ·{" "}
            {land === "have" ? "checked against your lot" : "no lot given"}
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

      {/* ------------------------------------------------- loading / outcome */}
      <div aria-live="polite">
        {phase === "loading" && (
          <div className="aura-panel mt-10 p-8">
            <p className="aura-label animate-pulse">Solving</p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-aura-text/70">
              Packing the room program into an envelope, clustering the wet rooms onto a shared
              plumbing wall, checking glazing against the 22% FDWR ceiling, then drawing the plan.
              {land === "have"
                ? " Then measuring the solved footprint against the buildable envelope your setbacks leave, and checking which way the glazing wall ends up pointing."
                : ""}{" "}
              The geometry is deterministic, so this is the same answer every time for the same
              brief.
            </p>
          </div>
        )}

        {phase === "done" && outcome && (
          <>
            <EngineNote outcome={outcome} onRecheck={() => setProbe((n) => n + 1)} />
            {outcome.response ? (
              <DesignResult
                res={outcome.response}
                engine={outcome.engine}
                parcel={parcelReport}
                /* Writes the fitting area into the questionnaire and stops.
                   The owner still presses Generate — a result that quietly
                   resized itself would be a different home than the one on
                   screen, which is the one thing this page will not do. */
                onUseLargest={(total) => {
                  setForm((f) => ({ ...f, totalSqFt: String(total) }));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------
   WHICH ENGINE DREW IT — stated above the result, before any of the numbers.

   Three outcomes, three different things to say, and none of them buried:
   · service — the upgrade answered; say what it added.
   · local   — the default. Plain and non-apologetic: real geometry, drawn
               here, with what the service would have added named exactly.
   · none    — the local engine itself failed. No plan is shown, nothing is
               substituted, and both errors are printed verbatim.
   ------------------------------------------------------------------------ */
function EngineNote({
  outcome,
  onRecheck,
}: {
  outcome: DesignOutcome;
  onRecheck: () => void;
}) {
  if (outcome.engine === "none") {
    return (
      <div className="mt-10 rounded-xl border border-aura-violet p-8">
        <p className="aura-label text-aura-violet">The geometry engine could not solve this brief</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/80">
          This should not happen — the engine is deterministic and has no dependencies. There is no
          plan to show, and nothing has been substituted for one. Your answers above are intact.
        </p>
        <p className="mt-4 break-words font-mono text-xs leading-relaxed text-aura-text/60">
          {outcome.localError}
        </p>
        {outcome.serviceError ? (
          <p className="mt-2 break-words font-mono text-xs leading-relaxed text-aura-text/50">
            The service was tried first: {outcome.serviceError.message}
          </p>
        ) : null}
      </div>
    );
  }

  if (outcome.engine === "service") {
    return (
      <div className="mt-10 rounded-xl border border-aura-emerald p-6">
        <p className="aura-label text-aura-emerald">Answered by the design service</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/80">
          The service at <span className="font-mono">{API_BASE}</span> produced this. It contributes
          the room program and, with an image credential, the renders; the packer, the FDWR check
          and the drawing are the same deterministic code that runs in this page.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-xl border border-aura-teal p-6">
      <p className="aura-label text-aura-teal">Drawn in your browser</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/80">
        This plan was generated here, by the same deterministic geometry the design service runs:
        the room-program arithmetic, the squarified packer, the 6-foot minimum-dimension check, the
        22% NBC 9.36 FDWR ceiling and the 1/4&quot; = 1&apos;-0&quot; drafting code, ported to
        TypeScript. No server was involved and nothing below is a placeholder. Connecting the design
        service adds an AI-authored room program and, with an image key, renders — it does not draw
        a more accurate plan.
      </p>
      {outcome.serviceError ? (
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-aura-text/60">
          {outcome.serviceError.kind === "rejected"
            ? "A service answered and refused this brief, so the local engine solved it instead. A refusal usually means a value outside the contract — bedrooms 0–6, bathrooms in half steps to 4, area 200–4,000 sq ft."
            : `Nothing answered at ${API_BASE} first, which is the normal state for the hosted site.`}{" "}
          <span className="break-words font-mono text-aura-text/50">
            {outcome.serviceError.message}
          </span>
        </p>
      ) : null}
      <details className="mt-4">
        <summary
          data-cursor="Open"
          className="cursor-pointer font-mono text-[0.6rem] uppercase tracking-label text-aura-text/55"
        >
          Run the design service for AI room programs and renders
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-md border aura-hairline p-4 font-mono text-xs leading-relaxed text-aura-text/70">
{`cd design-api
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000`}
        </pre>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-aura-text/60">
          Every key in the service is optional: with none configured it returns the same
          deterministic blueprint this page just drew, plus PDF and DXF, and reports{" "}
          <span className="font-mono">offline: true</span>. Point this page at a deployed one with{" "}
          <span className="font-mono">NEXT_PUBLIC_DESIGN_API</span>.
        </p>
        <button
          type="button"
          onClick={onRecheck}
          data-cursor="Recheck"
          className="mt-4 rounded-full border border-aura-teal px-4 py-1.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-teal transition-colors hover:bg-aura-teal/5"
        >
          Re-check for a service
        </button>
      </details>
    </div>
  );
}
