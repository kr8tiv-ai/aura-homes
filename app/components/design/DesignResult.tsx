"use client";

/* THE RESULT — everything the design service returned, including the parts
   that are not flattering.

   Rules this panel follows, in the order they matter:
   1. The stamp travels. Every drawing the service produces carries
      "REVIEW-READY DESIGN PACKAGE — NOT FOR CONSTRUCTION", so the page says it
      too. Permit-ready AI drawings do not exist.
   2. Warnings are shown, not swallowed. A room that solved below the 6-foot
      minimum, or glazing trimmed against the 22% NBC 9.36 ceiling, is the
      honest signal — it is why you would trust the rest of the numbers.
   3. `offline: true` is labelled as what it is: the deterministic geometry
      path, with the room program derived arithmetically rather than reasoned. */

import { Counter, Reveal, Stagger, StaggerItem } from "@/components/Reveal";
import { feetInches, sqft } from "@/components/design/ecoSpec";
import { artifactUrl, formatFdwr, type DesignResponse } from "@/lib/designApi";

export const STAMP = "REVIEW-READY DESIGN PACKAGE — NOT FOR CONSTRUCTION";

/* Module scope: <Counter> keeps `format` in its effect deps, so an inline
   arrow would restart every count on each parent render. */
const asInt = (n: number) => Math.round(n).toLocaleString("en-CA");
const asPct = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-CA");

/** Renders come back as absolute provider URLs; blueprints as service paths. */
const assetUrl = (u: string): string =>
  /^https?:\/\//i.test(u) ? u : (artifactUrl(u) ?? u);

function Stat({ k, v, sub }: { k: string; v: React.ReactNode; sub?: string }) {
  return (
    <StaggerItem className="rounded-md border aura-hairline px-4 py-3" y={8}>
      <p className="aura-label">{k}</p>
      <p className="mt-1.5 text-sm tabular-nums text-aura-text">{v}</p>
      {sub ? <p className="mt-1 text-xs leading-snug text-aura-text/55">{sub}</p> : null}
    </StaggerItem>
  );
}

export default function DesignResult({
  res,
  engine = "service",
}: {
  res: DesignResponse;
  /** which engine produced this — it changes what an absent PDF/DXF MEANS */
  engine?: "service" | "local";
}) {
  const { plan, artifacts, render_prompts: prompts, notes, offline } = res;
  const windows = plan.rooms.reduce((n, r) => n + r.windows, 0);
  const svg = artifactUrl(artifacts.svg_url);
  const pdf = artifactUrl(artifacts.pdf_url);
  const dxf = artifactUrl(artifacts.dxf_url);

  /* main.py copies plan.warnings into notes[], so the warning block below
     would otherwise print each one twice. Warnings lead; the remainder of the
     service's notes follow as the path report. */
  const otherNotes = notes.filter((n) => !plan.warnings.includes(n));

  return (
    <div className="mt-12">
      {/* ------------------------------------------------- stamp + which path */}
      <Reveal y={16}>
        <div className="aura-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-label text-aura-violet">{STAMP}</p>
            <span
              className={`rounded border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label ${
                offline ? "border-aura-teal text-aura-teal" : "border-aura-emerald text-aura-emerald"
              }`}
            >
              {offline ? "Deterministic geometry path" : "Reasoned room program"}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-aura-text/70">
            {offline
              ? "No LLM credential was configured on the service, so the room program was derived arithmetically rather than reasoned. The geometry, the wall thicknesses, the FDWR check and the drawing are the same code on either path — only the naming and proportioning judgement changed."
              : "The room program was reasoned by the model and then re-solved by the deterministic packer: nothing on the drawing is drawn by a language model."}
            {artifacts.render_urls.length === 0
              ? " No AI renders were produced — this is the blueprint, plus the rendering prompts so they can be run elsewhere."
              : ""}
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-aura-text/55">
            A review-ready package, not a permit set. Stamped drawings for an Alberta permit come
            from the truss plant&rsquo;s P.Eng and the licensed trades, never from this step.
          </p>
        </div>
      </Reveal>

      {/* --------------------------------------------------------- warnings */}
      {plan.warnings.length > 0 && (
        <Reveal y={14} className="mt-6">
          <div className="rounded-xl border border-aura-violet p-6">
            <p className="aura-label text-aura-violet">
              {plan.warnings.length} warning{plan.warnings.length === 1 ? "" : "s"} from the layout
              engine
            </p>
            <ul className="mt-3 space-y-2">
              {plan.warnings.map((w) => (
                <li key={w} className="flex gap-3 text-sm leading-relaxed text-aura-text/80">
                  <span aria-hidden className="text-aura-violet">
                    ·
                  </span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-aura-text/60">
              These are the engine telling you the truth about the program you asked for — a room
              below the 6-foot minimum, or glazing trimmed back to the 22% prescriptive ceiling.
              They are shown, never suppressed.
            </p>
          </div>
        </Reveal>
      )}

      {/* --------------------------------------------------------- envelope */}
      <Reveal y={16} className="mt-6">
        <div className="aura-panel p-8">
          <p className="aura-label">Envelope</p>
          <Stagger className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" gap={0.045}>
            <Stat
              k="Overall"
              v={`${feetInches(plan.width)} × ${feetInches(plan.height)}`}
              sub="Exterior face to exterior face"
            />
            <Stat
              k="Gross area"
              v={<Counter value={plan.gross_sq_ft} format={asInt} suffix=" sq ft" />}
              sub={`Net internal ${sqft(plan.net_sq_ft)}`}
            />
            <Stat
              k="Structural wall"
              v={<Counter value={plan.wall_mm} format={asInt} suffix=" mm" />}
              sub={`Interior partitions ${plan.partition_mm} mm — the material's real thickness, drawn`}
            />
            <Stat
              k="FDWR — glazing"
              v={<Counter value={plan.fdwr * 100} format={asPct} suffix="%" />}
              sub={formatFdwr(plan.fdwr)}
            />
            <Stat k="Rooms" v={<Counter value={plan.rooms.length} format={asInt} />} />
            <Stat
              k="Windows"
              v={<Counter value={windows} format={asInt} />}
              sub="Counted across the whole plan"
            />
          </Stagger>
        </div>
      </Reveal>

      {/* ----------------------------------------------- the drawing itself */}
      <Reveal y={18} className="mt-6">
        <div className="aura-panel p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="aura-label">Floor plan — 1/4&quot; = 1&apos;-0&quot;</p>
            <div className="flex flex-wrap gap-2">
              {pdf && (
                <a
                  href={pdf}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor="Download"
                  className="rounded-full border border-aura-teal px-4 py-1.5 font-mono text-xs uppercase tracking-label text-aura-teal transition-colors hover:bg-aura-teal/5"
                >
                  PDF
                </a>
              )}
              {dxf && (
                <a
                  href={dxf}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor="Download"
                  className="rounded-full border border-aura-teal px-4 py-1.5 font-mono text-xs uppercase tracking-label text-aura-teal transition-colors hover:bg-aura-teal/5"
                >
                  DXF
                </a>
              )}
              {svg && (
                <a
                  href={svg}
                  target="_blank"
                  rel="noreferrer"
                  data-cursor="Open"
                  className="rounded-full border aura-hairline px-4 py-1.5 font-mono text-xs uppercase tracking-label text-aura-text/70 transition-colors hover:border-aura-teal"
                >
                  SVG
                </a>
              )}
            </div>
          </div>

          {svg ? (
            <div className="mt-5 overflow-x-auto rounded-lg border aura-hairline">
              {/* The drawing carries its own paper ground and drafting inks — it
                  is a document, so it is shown as drawn rather than recoloured
                  by the theme. next/image is not used: the file is served by
                  the design service at runtime, not from this app's assets. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={svg}
                alt={`Dimensioned floor plan, ${feetInches(plan.width)} by ${feetInches(
                  plan.height
                )}, ${plan.rooms.length} rooms. ${STAMP}`}
                className="block h-auto w-full min-w-[40rem]"
              />
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-aura-violet">
              The service returned no drawing for this design. The room schedule below is still the
              solved plan — nothing here is substituted for a missing drawing.
            </p>
          )}
          {!pdf || !dxf ? (
            <p className="mt-3 text-xs leading-relaxed text-aura-text/55">
              {/* An absent PDF means two completely different things depending
                  on which engine ran, and blaming a "service instance" when no
                  service was contacted is a plain untruth. cairosvg and ezdxf
                  are native writers with no browser equivalent, so the local
                  path can never produce them — that is a property of the path,
                  not a misconfiguration. */}
              {engine === "local"
                ? "PDF and DXF need the design service — both are written by native libraries (cairosvg, ezdxf) that have no browser equivalent. The SVG above is the same drawing, and it prints."
                : !pdf && !dxf
                  ? "PDF and DXF are unavailable on this service instance (cairosvg / ezdxf not installed)."
                  : !pdf
                    ? "PDF is unavailable on this service instance (cairosvg not installed)."
                    : "DXF is unavailable on this service instance (ezdxf not installed)."}
            </p>
          ) : null}
        </div>
      </Reveal>

      {/* --------------------------------------------------- room schedule */}
      <Reveal y={18} className="mt-6">
        <div className="aura-panel overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="px-6 pt-6 text-left">
              <span className="aura-label">Room schedule</span>
            </caption>
            <thead>
              <tr className="border-b aura-hairline text-left">
                <th className="aura-label px-6 py-4 font-normal">Room</th>
                <th className="aura-label px-6 py-4 font-normal">Dimensions</th>
                <th className="aura-label px-6 py-4 text-right font-normal">Area</th>
                <th className="aura-label px-6 py-4 text-right font-normal">Windows</th>
                <th className="aura-label px-6 py-4 font-normal">Wet</th>
              </tr>
            </thead>
            <tbody>
              {plan.rooms.map((r, i) => (
                <tr
                  key={`${r.name}-${i}`}
                  className="border-b aura-hairline transition-colors last:border-b-0 hover:bg-aura-ink/[0.04]"
                >
                  <td className="px-6 py-4 text-aura-teal">{r.name}</td>
                  <td className="px-6 py-4 tabular-nums text-aura-text/80">
                    {feetInches(r.w)} × {feetInches(r.h)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">{sqft(r.w * r.h)}</td>
                  <td className="px-6 py-4 text-right tabular-nums">{r.windows}</td>
                  <td className="px-6 py-4">
                    {r.wet ? (
                      <span className="font-mono text-[0.65rem] uppercase tracking-label text-aura-emerald">
                        Wet
                      </span>
                    ) : (
                      <span className="text-aura-text/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t aura-hairline">
                <td className="px-6 py-5" colSpan={2}>
                  <span className="aura-label">Net internal</span>
                </td>
                <td className="px-6 py-5 text-right font-semibold tabular-nums">
                  {sqft(plan.net_sq_ft)}
                </td>
                <td className="px-6 py-5 text-right font-semibold tabular-nums">{windows}</td>
                <td className="px-6 py-5" />
              </tr>
            </tfoot>
          </table>
          <p className="px-6 pb-6 text-xs leading-relaxed text-aura-text/55">
            Wet rooms are clustered by the packer so they share a plumbing wall. Net internal is the
            sum of the rooms; the difference from the {sqft(plan.gross_sq_ft)} gross envelope is
            walls and circulation.
          </p>
        </div>
      </Reveal>

      {/* ------------------------------------------------------- the renders */}
      {artifacts.render_urls.length > 0 && (
        <Reveal y={18} className="mt-6">
          <div className="aura-panel p-8">
            <p className="aura-label">Renders</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {artifacts.render_urls.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={u}
                  src={assetUrl(u)}
                  alt={`Generated architectural render ${i + 1} — not a photograph of a built home`}
                  className="w-full rounded-lg border aura-hairline"
                />
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-aura-text/55">
              Generated images, not photographs of a built home, and not a substitute for the
              dimensioned drawing above.
            </p>
          </div>
        </Reveal>
      )}

      {/* ------------------------------------------------ prompts + brief */}
      <Reveal y={18} className="mt-6">
        <div className="aura-panel p-8">
          <p className="aura-label">Rendering prompts the service returned</p>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-aura-text/70">
            Returned whether or not an image backend is wired up, so they can be run elsewhere.
            Check them against your eco checklist: this is where the Aura spec has to land for a
            render to read as an Aura home.
          </p>
          <Stagger className="mt-4 space-y-4" gap={0.05}>
            {prompts.map((p, i) => (
              <StaggerItem key={`${p.view}-${i}`} y={8}>
                <div className="rounded-md border aura-hairline p-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-label text-aura-teal">
                    {p.view}
                  </p>
                  <p className="mt-2 break-words font-mono text-xs leading-relaxed text-aura-text/80">
                    {p.prompt}
                  </p>
                  {p.material_keywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.material_keywords.map((k) => (
                        <span
                          key={k}
                          className="rounded-full border aura-hairline px-2.5 py-0.5 text-[0.65rem] text-aura-text/70"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                  <details className="mt-3">
                    <summary
                      data-cursor="Open"
                      className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55"
                    >
                      Negative prompt
                    </summary>
                    <p className="mt-2 break-words font-mono text-xs leading-relaxed text-aura-text/60">
                      {p.negative_prompt}
                    </p>
                  </details>
                </div>
              </StaggerItem>
            ))}
          </Stagger>

          {res.request.notes ? (
            <details className="mt-6">
              <summary
                data-cursor="Open"
                className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55"
              >
                The brief the service echoed back
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-aura-text/70">
                {res.request.notes}
              </p>
            </details>
          ) : null}
        </div>
      </Reveal>

      {/* ------------------------------------------------- the path report */}
      {otherNotes.length > 0 && (
        <Reveal y={14} className="mt-6">
          <div className="rounded-xl border aura-hairline p-6">
            <p className="aura-label">What the service reported</p>
            <ul className="mt-3 space-y-2">
              {otherNotes.map((n) => (
                <li key={n} className="flex gap-3 text-xs leading-relaxed text-aura-text/70">
                  <span aria-hidden className="text-aura-teal">
                    ·
                  </span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}
    </div>
  );
}
