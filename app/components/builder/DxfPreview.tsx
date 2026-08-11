"use client";

/* ===========================================================================
   THE PROOF — the DXF, read back and drawn on the screen.

   WHAT THIS COMPONENT IS FOR, stated as the difference between two sentences.

     "We export DXF."                                          — an assertion
     "We export DXF, parse it back with a reader that shares
      no code with the writer, and here is the drawing that
      file produces."                                          — a proof

   The second is the only one worth putting in front of somebody about to email
   a file to the designer they are paying. Everything on this panel is drawn
   from the PARSED FILE — not from the model, not from the SVG sheets, not from
   anything the exporter kept in memory. If the writer dropped a layer, this
   panel is missing a layer. If it truncated, this panel is short. That is the
   entire design: the picture is only right when the file is.

   WHY A FIRST-PARTY RENDERER AND NOT A LIBRARY. The evaluation in this task's
   report is the long answer; the short one is that every DXF viewer on npm is
   a three.js renderer, and a three.js renderer is exactly the wrong tool here.
   `dxf-viewer` and `three-dxf-loader` both pull `three` in and would either
   duplicate it in the bundle or drag a version constraint across the R3F 8
   camera stack this app already ships — the same class of trap
   `docs/research/AEC-BLUEPRINT-REVIEW.md` documented for `@thatopen/components`
   and for a second `three-mesh-bvh`. What we need is a hundred lines of SVG
   over entities that are already parsed, which is what this is. Zero new
   dependencies.

   WHAT IT DRAWS: LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT, POINT.
   WHAT IT DOES NOT: everything else — MTEXT, INSERT/BLOCK, DIMENSION, LEADER,
   HATCH, SPLINE, ELLIPSE, SOLID, 3DFACE. Those are not silently skipped. They
   are counted and named on the panel under "not drawn here", because a preview
   that quietly omits a third of a file is worse than no preview: it is a proof
   that proves the wrong thing. Our own writer emits none of them (it explodes
   dimensions into lines and text on purpose), so for an Aura export the list
   is empty and the preview is complete.

   COLOUR. Not one literal colour in this file. Every stroke is `currentColor`
   and the colour comes from a Tailwind `text-aura-*` class on the group, so
   the whole preview flips with the site's night mode. Which class a layer gets
   is decided by the AutoCAD Colour Index in the FILE'S OWN LAYER TABLE rather
   than by a hardcoded list of our layer names — so a DXF from somebody else's
   CAD renders in sensible colours too.

   DETERMINISM. No clock, no randomness. Arcs are tessellated at a fixed
   angular step, so the same file always produces the same path data.
   =========================================================================== */

import { useMemo, useState } from "react";

import {
  checkDxf,
  type DxfEntityRead,
  type DxfReport,
  type SourceDrawing,
} from "@/lib/builder/dxfCheck";

/* --------------------------------------------------------------- the pens

   AutoCAD Colour Index -> a token on this site's tonal ladder. Colour 7 is
   the one that prints black on white and draws white on black, which is the
   CAD convention for "the foreground" and maps exactly onto `aura-text`. */
const ACI_CLASS: Record<number, string> = {
  1: "text-aura-violet",
  2: "text-aura-lime",
  3: "text-aura-emerald",
  4: "text-aura-teal",
  5: "text-aura-teal-mark",
  6: "text-aura-violet",
  7: "text-aura-text",
  8: "text-aura-text/45",
  9: "text-aura-text/35",
  30: "text-aura-lime",
};
const FALLBACK_CLASS = "text-aura-text/70";

/**
 * How many entities this panel will draw.
 *
 * A cap rather than a spinner: past a few tens of thousands of SVG nodes the
 * browser stops being able to lay the page out, and a preview that hangs the
 * tab is not a preview. When the cap bites the panel SAYS it bit, with the
 * number, so nobody mistakes a partial render for a partial file.
 */
const MAX_DRAWN = 24000;

/** Degrees per tessellated arc segment. Fixed, so the output is byte-stable. */
const ARC_STEP_DEG = 6;

export default function DxfPreview({
  dxf,
  source = null,
  filename,
  title = "The DXF, read back",
}: {
  /** The file, as text — exactly the bytes the download will contain. */
  dxf: string;
  /** What the source drawing says should be in it. Build it with
   *  `sourceFromModel(model)`; omit it and only the structural checks run. */
  source?: SourceDrawing | null;
  /** Shown beside the verdict, so the panel names the file it checked. */
  filename?: string;
  title?: string;
}) {
  const report: DxfReport = useMemo(() => checkDxf(dxf, source), [dxf, source]);

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set<string>());
  const toggle = (layer: string): void =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });

  const errors = report.problems.filter((p) => p.severity === "error");
  const warnings = report.problems.filter((p) => p.severity === "warning");
  const notes = report.problems.filter((p) => p.severity === "note");

  const undrawn = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of report.entities) if (!e.understood) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [report.entities]);

  return (
    <section className="aura-panel mt-6 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="aura-label">{title}</p>
        <p className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">
          {filename ? `${filename} · ` : ""}
          {report.acadVer ?? "no version"} · {report.unitsLabel}
        </p>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/70">
        This is not a picture of your model. It is the file itself &mdash; parsed back by a reader
        that shares no code with the writer, and drawn from the entities it found. If the export
        dropped something, this drawing is missing it.
      </p>

      {/* ------------------------------------------------------- the verdict */}
      <div
        className={`mt-5 rounded-xl border p-5 ${
          report.ok ? "border-aura-emerald" : "border-aura-violet"
        }`}
      >
        <p className={`aura-label ${report.ok ? "" : "text-aura-violet"}`}>
          {report.ok
            ? "Round trip passes — the file parses, and it matches the drawing"
            : `Round trip FAILS — ${errors.length} problem${errors.length === 1 ? "" : "s"}`}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
          <Fact k="Entities" v={String(report.entities.length)} />
          <Fact k="Layers used" v={`${report.layersUsed.length} of ${report.layersDeclared.length}`} />
          <Fact
            k="Extents"
            v={
              report.measuredExtents
                ? `${round(report.measuredExtents.maxX - report.measuredExtents.minX)} × ${round(
                    report.measuredExtents.maxY - report.measuredExtents.minY,
                  )}`
                : "none"
            }
          />
          <Fact k="Lines in file" v={String(report.lineCount)} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">
          {Object.entries(report.countsByType)
            .sort()
            .map(([t, n]) => (
              <span key={t}>
                {t} {n}
              </span>
            ))}
        </div>
      </div>

      {/* --------------------------------------------------- the layer switches */}
      {report.layersUsed.length > 0 ? (
        <div className="mt-5">
          <p className="aura-label">
            Layers in the file &mdash; switch one off to check what is on it
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {report.layersUsed.map((name) => {
              const on = !hidden.has(name);
              const row = report.layersDeclared.find((l) => l.name === name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggle(name)}
                  aria-pressed={on}
                  data-cursor="Select"
                  className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                    on
                      ? "border-aura-emerald text-aura-text"
                      : "aura-hairline text-aura-text/40 hover:text-aura-text/70"
                  }`}
                >
                  <span className={`mr-2 ${classForLayer(report, name)}`} aria-hidden>
                    &#9632;
                  </span>
                  <span className="font-mono text-[0.65rem] tracking-label">{name}</span>
                  <span className="ml-2 text-aura-text/50">{report.countsByLayer[name] ?? 0}</span>
                  {row ? null : (
                    <span className="ml-2 text-aura-violet" title="No row in the LAYER table">
                      undeclared
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ------------------------------------------------------- the drawing */}
      <Canvas report={report} hidden={hidden} />

      {/* --------------------------------------------- what was not drawn */}
      {undrawn.length > 0 ? (
        <div className="mt-4 rounded-md border aura-hairline p-4">
          <p className="aura-label text-aura-violet">Present in the file and NOT drawn above</p>
          <p className="mt-2 text-xs leading-relaxed text-aura-text/65">
            This preview reads LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT and POINT. Everything
            else is counted and named rather than silently skipped &mdash; a preview that quietly
            omits part of a file proves the wrong thing.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/55">
            {undrawn.map(([t, n]) => (
              <li key={t}>
                {t} {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* --------------------------------------------- against the source */}
      {report.sourceChecks.length > 0 ? (
        <div className="mt-4 rounded-md border aura-hairline p-4">
          <p className="aura-label">Checked against the drawing it came from</p>
          <ul className="mt-3 space-y-2">
            {report.sourceChecks.map((c) => (
              <li key={c.label} className="flex gap-3 text-xs leading-relaxed">
                <span
                  aria-hidden
                  className={
                    c.pass ? "text-aura-emerald" : c.required ? "text-aura-violet" : "text-aura-text/40"
                  }
                >
                  {c.pass ? "✓" : c.required ? "✗" : "·"}
                </span>
                <span className="text-aura-text/75">
                  <span className="text-aura-text">{c.label}</span>
                  {" — "}
                  {c.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* -------------------------------------------------------- problems */}
      <Problems title="Errors" tone="loud" items={errors} />
      <Problems title="Warnings" tone="quiet" items={warnings} />
      <Problems title="Worth knowing" tone="faint" items={notes} />

      {/* ---------------------------------------------------- the honesty */}
      <div className="mt-6 border-t aura-hairline pt-5">
        <p className="aura-label">What a pass here does and does not mean</p>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-aura-text/65">
          <li>
            It means the file is structurally sound, every entity sits on a declared layer, nothing
            falls outside the extents the header claims, and the footprints, labels and pile count in
            your model are all present in the file at true size.
          </li>
          <li>
            It does not mean the drawing is correct architecture. Nothing here is sealed, nothing is
            checked against a building code, and this panel cannot tell a well-formed wrong wall from
            a well-formed right one. It checks the HANDOFF, not the design.
          </li>
          <li>
            It does not test how AutoCAD, BricsCAD or QCAD choose to render the file. It tests that
            the file says what our model says. Those are different claims and only the second one is
            ours to make.
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ===================================================================== */

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.6rem] uppercase tracking-label text-aura-text/50">{k}</dt>
      <dd className="mt-0.5 tabular-nums text-aura-text">{v}</dd>
    </div>
  );
}

function Problems({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "loud" | "quiet" | "faint";
  items: readonly { code: string; message: string; line?: number }[];
}) {
  if (items.length === 0) return null;
  const head =
    tone === "loud" ? "text-aura-violet" : tone === "quiet" ? "text-aura-lime" : "text-aura-text/55";
  return (
    <div className="mt-4 rounded-md border aura-hairline p-4">
      <p className={`aura-label ${head}`}>
        {title} ({items.length})
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((p, i) => (
          <li key={`${p.code}-${i}`} className="flex gap-3 text-xs leading-relaxed text-aura-text/70">
            <span aria-hidden className={head}>
              &middot;
            </span>
            <span>
              <span className="font-mono text-[0.65rem] tracking-label text-aura-text/50">
                {p.code}
                {p.line ? ` L${p.line}` : ""}
              </span>{" "}
              {p.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------- the canvas */

/**
 * The parsed entities, as SVG.
 *
 * THE ONE COORDINATE DECISION. DXF model space has +Y up; SVG has +Y down. The
 * flip is `y -> -y` and it lives in the `Y` function below and nowhere else. It
 * is applied per entity rather than as a `scale(1,-1)` on a wrapping group,
 * because a group flip would mirror every letter of every TEXT entity as well
 * — which is exactly the bug that makes a hand-rolled DXF viewer look like a
 * hand-rolled DXF viewer.
 */
function Canvas({ report, hidden }: { report: DxfReport; hidden: ReadonlySet<string> }) {
  const box = report.measuredExtents;
  if (!box) {
    return (
      <div className="mt-5 rounded-lg border aura-hairline p-8">
        <p className="text-center text-sm text-aura-text/60">
          There is no geometry in this file to draw.
        </p>
      </div>
    );
  }

  const w = Math.max(box.maxX - box.minX, 1e-6);
  const h = Math.max(box.maxY - box.minY, 1e-6);
  const pad = Math.max(w, h) * 0.03;

  const drawable = report.entities.filter((e) => e.understood && !hidden.has(e.layer));
  const drawn = drawable.slice(0, MAX_DRAWN);

  /* Group by layer so each layer becomes one <g> carrying one colour class —
     one class per layer rather than per entity, which is both fewer DOM
     attributes and the thing that makes a layer switch obviously correct. */
  const byLayer = new Map<string, DxfEntityRead[]>();
  for (const e of drawn) {
    const list = byLayer.get(e.layer);
    if (list) list.push(e);
    else byLayer.set(e.layer, [e]);
  }

  return (
    <>
      <div className="mt-5 overflow-hidden rounded-lg border aura-hairline bg-aura-sunken">
        <svg
          viewBox={`${box.minX - pad} ${-box.maxY - pad} ${w + pad * 2} ${h + pad * 2}`}
          role="img"
          aria-label={
            `The exported DXF, parsed and redrawn: ${drawn.length} entities on ` +
            `${byLayer.size} layers, spanning ${round(w)} by ${round(h)} drawing units. ` +
            `This is the file, not the model.`
          }
          className="block h-auto w-full"
          style={{ maxHeight: "36rem" }}
        >
          {Array.from(byLayer.entries())
            .sort((a, b) => (a[0] < b[0] ? -1 : 1))
            .map(([layer, list]) => (
              <g
                key={layer}
                className={classForLayer(report, layer)}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              >
                {list.map((e, i) => (
                  <Entity key={`${layer}-${i}`} e={e} report={report} />
                ))}
              </g>
            ))}
        </svg>
      </div>
      {drawable.length > drawn.length ? (
        <p className="mt-2 text-xs leading-relaxed text-aura-violet">
          {drawable.length - drawn.length} of {drawable.length} drawable entities are not on the
          canvas: this preview draws at most {MAX_DRAWN} so it cannot hang the page. The file is
          complete &mdash; this picture is not. Every count and check above ran on all of it.
        </p>
      ) : null}
    </>
  );
}

/** The Y flip, in one place. */
const Y = (y: number): number => -y;

function Entity({ e, report }: { e: DxfEntityRead; report: DxfReport }) {
  const dash = dashFor(e, report);
  switch (e.type) {
    case "LINE": {
      if (e.points.length < 2) return null;
      const [a, b] = e.points;
      return <line x1={a[0]} y1={Y(a[1])} x2={b[0]} y2={Y(b[1])} strokeDasharray={dash} />;
    }
    case "POINT": {
      if (e.points.length < 1) return null;
      const [p] = e.points;
      /* A POINT has no size of its own. Drawn as a degenerate segment rather
         than as a circle with an invented radius, so it stays a hairline dot at
         every zoom and never implies a diameter the file did not state. */
      return <line x1={p[0]} y1={Y(p[1])} x2={p[0]} y2={Y(p[1])} strokeLinecap="round" strokeWidth={2} />;
    }
    case "POLYLINE":
    case "LWPOLYLINE": {
      if (e.points.length < 2) return null;
      const d =
        e.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${Y(p[1])}`).join(" ") +
        (e.closed ? " Z" : "");
      return <path d={d} strokeDasharray={dash} />;
    }
    case "CIRCLE": {
      if (e.points.length < 1 || e.radius === null) return null;
      const [c] = e.points;
      return <circle cx={c[0]} cy={Y(c[1])} r={e.radius} strokeDasharray={dash} />;
    }
    case "ARC": {
      if (e.points.length < 1 || e.radius === null) return null;
      const [c] = e.points;
      const a0 = e.startAngleDeg ?? 0;
      const a1 = e.endAngleDeg ?? 0;
      /* A DXF arc runs counter-clockwise from start to end, so a sweep that
         reads backwards has wrapped past 360 rather than run the other way. */
      let sweep = a1 - a0;
      while (sweep <= 0) sweep += 360;
      while (sweep > 360) sweep -= 360;
      const steps = Math.max(2, Math.ceil(sweep / ARC_STEP_DEG));
      const pts: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = ((a0 + (sweep * i) / steps) * Math.PI) / 180;
        pts.push(
          `${i === 0 ? "M" : "L"} ${c[0] + e.radius * Math.cos(t)} ${Y(c[1] + e.radius * Math.sin(t))}`,
        );
      }
      return <path d={pts.join(" ")} strokeDasharray={dash} />;
    }
    case "TEXT": {
      if (e.points.length < 1 || e.text === null || !e.height) return null;
      const [p] = e.points;
      const anchor = e.hAlign === 1 ? "middle" : e.hAlign === 2 ? "end" : "start";
      /* vAlign 0 baseline, 1 bottom, 2 middle, 3 top. `alignment-baseline` is
         the property browsers actually honour on SVG <text>. */
      const baseline =
        e.vAlign === 3 ? "hanging" : e.vAlign === 2 ? "middle" : e.vAlign === 1 ? "baseline" : "baseline";
      /* The rotation is NEGATED. The file's angle is counter-clockwise in a
         +Y-up frame and SVG's is clockwise in a +Y-down one; forgetting this is
         why every dimension on a hand-rolled viewer reads mirrored. */
      const rot = -e.rotationDeg;
      return (
        <text
          x={p[0]}
          y={Y(p[1])}
          fontSize={e.height}
          textAnchor={anchor}
          alignmentBaseline={baseline}
          fill="currentColor"
          stroke="none"
          transform={rot === 0 ? undefined : `rotate(${rot} ${p[0]} ${Y(p[1])})`}
          style={{ fontFamily: "var(--font-mono, monospace)" }}
        >
          {/* React escapes this — the string never becomes markup, which is why
              this panel can render inline SVG where `DrawingSheets` has to use
              an <img> to sandbox a project name that arrived from a URL. */}
          {e.text}
        </text>
      );
    }
    default:
      return null;
  }
}

/**
 * The dash pattern for an entity, read from the FILE'S LTYPE table.
 *
 * DXF linetype resolution is BYLAYER when an entity carries no group 6, so the
 * entity's own name is tried first and the layer's second. Nothing is invented:
 * a linetype the file declares with no pattern draws solid, which is what
 * CONTINUOUS is.
 */
function dashFor(e: DxfEntityRead, report: DxfReport): string | undefined {
  const name = e.linetype ?? report.layersDeclared.find((l) => l.name === e.layer)?.linetype ?? null;
  if (!name || name.toUpperCase() === "CONTINUOUS" || name.toUpperCase() === "BYLAYER") return undefined;
  const lt = report.linetypesDeclared.find((l) => l.name.toUpperCase() === name.toUpperCase());
  if (!lt || lt.pattern.length === 0) return undefined;
  /* A zero in a DXF pattern is a DOT, which has no length. Given as 0 to SVG it
     would collapse the whole array, so it becomes a very short dash instead —
     the same substitution every CAD renderer makes. */
  const unit = lt.pattern.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return lt.pattern.map((v) => (Math.abs(v) < 1e-9 ? unit * 0.02 : Math.abs(v))).join(" ");
}

/** The theme class for a layer, decided by the file's own colour index. */
function classForLayer(report: DxfReport, layer: string): string {
  const row = report.layersDeclared.find((l) => l.name === layer);
  if (!row || row.colour === null) return FALLBACK_CLASS;
  return ACI_CLASS[row.colour] ?? FALLBACK_CLASS;
}

const round = (v: number): string => String(Math.round(v * 100) / 100);
