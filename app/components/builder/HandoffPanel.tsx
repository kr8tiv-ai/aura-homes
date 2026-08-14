"use client";

/* ===========================================================================
   ONE PACKAGE — seen before it is downloaded.

   The export panel beside this one offers seven doors and is right to. This
   one answers a different question: "what do I actually send my designer?"
   The answer is one file, assembled once, shown in full, and only then saved.

   THE PREVIEW IS THE ARTIFACT. `buildHandoffPackage` returns
   `{ package, json, artifact }` from a single generation. Everything below is
   read off `package`; the download hands `artifact` straight to the browser.
   This component does not serialise anything, does not build a Blob, and does
   not describe a file it has not been given — so there is no version of this
   screen in which what you looked at and what you saved are different bytes.
   The drawing sheets are rendered from the SVG strings IN the package, not
   from a fresh drawing run, for exactly the same reason.

   WHY IT IS A BUTTON AND NOT A LIVE PANEL. Assembling the package draws eight
   sheets, writes a DXF and reads it back through a separate parser, authors an
   IFC4 file and writes an ifcJSON document. That is worth a press; it is not
   worth running on every keystroke while somebody drags a slider. When the
   design moves on, the package says so rather than quietly ageing — the same
   staleness rule the drawing set and the DXF verdict already keep.

   NOTHING HERE INVENTS A CLAIM. Every file's one-line description is the
   writing module's own `note`, printed verbatim, and every absence is the
   refusing writer's own sentence. This component's only original copy is the
   one sentence about what a professional still does, and that lives in
   `lib/builder/handoffPackage.ts` so the README and the screen cannot drift.

   AN <img> AND NOT INLINE SVG, for the reason `DrawingSheets` gives: a sheet
   carries a project name that can arrive from a share link, and a data-URL
   image is a script-disabled document.
   =========================================================================== */

import { useCallback, useMemo, useState } from "react";

import type { ComfortReport } from "@/lib/builder/comfort";
import type { BuilderDocument } from "@/lib/builder/document";
import { drawingDataUrl } from "@/lib/builder/drawings";
import { downloadArtifact } from "@/lib/builder/exportSpec";
import {
  WHAT_A_PROFESSIONAL_STILL_DOES,
  buildHandoffPackage,
  type HandoffFile,
  type HandoffPackageResult,
} from "@/lib/builder/handoffPackage";
import type { ProjectBudget } from "@/lib/builder/projectBudget";
import { Button, Notice, Panel } from "./ui";

/** What one press produced. `document` rides along so the panel can say "the
 *  design has changed since this was assembled" instead of showing a package
 *  for a house that no longer exists. */
interface Prepared {
  document: BuilderDocument;
  result: HandoffPackageResult;
}

const kb = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;

const KIND_LABEL: Record<HandoffFile["kind"], string> = {
  readme: "Read me first",
  project: "The project",
  drawing: "Drawing",
  dxf: "For a drafter",
  ifc: "For a BIM office",
  ifcjson: "For a script",
};

export default function HandoffPanel({
  document,
  comfort = null,
  budget = null,
}: {
  document: BuilderDocument;
  /** `null` means no report was computed, which the package turns into "let
   *  the writers derive their defaults" — the same bargain `ExportRow` makes. */
  comfort?: ComfortReport | null;
  /** The project's cost snapshot when one exists. A budget computed for a
   *  different design is refused by the package and named as an omission. */
  budget?: ProjectBudget | null;
}) {
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      /* THE ONE CLOCK READ, and it is not geometry: it is the issue date in a
         title block and an IFC header. Read here at the press rather than in
         the module, so the module stays deterministic — same document, same
         date, same bytes. */
      const issuedISO = new Date().toISOString().slice(0, 10);
      const result = await buildHandoffPackage({ document, issuedISO, comfort, budget });
      setPrepared({ document, result });
    } catch (err) {
      setPrepared(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [document, comfort, budget]);

  const stale = prepared !== null && prepared.document !== document;
  const pkg = prepared?.result.package ?? null;

  /* The reference package is around half a megabyte, most of it SVG, and this
     panel lives inside a pane that re-renders on every edit two tabs away.
     Encoding eight sheets into data URLs on each of those renders would be a
     hitch nobody could explain, so it happens once per assembled package. */
  const sheets = useMemo(
    () =>
      (pkg?.files ?? [])
        .filter((file) => file.kind === "drawing")
        .map((file) => ({ file, href: drawingDataUrl(file.content) })),
    [pkg],
  );

  return (
    <Panel
      label="Hand over one package"
      hint="Everything a designer, an engineer or a builder needs, assembled once into a single file: the project, the drawing set, the professional formats, and the hash that proves they all describe the same house. You see the whole thing before anything is saved."
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button tone="loud" onClick={() => void prepare()} disabled={busy}>
            {busy ? "Assembling…" : prepared ? "Assemble it again" : "Prepare the handoff package"}
          </Button>
          {prepared ? (
            <Button
              onClick={() => downloadArtifact(prepared.result.artifact)}
              title={prepared.result.artifact.note}
            >
              Download {prepared.result.artifact.filename}
            </Button>
          ) : null}
          {stale ? (
            <span className="rounded border border-aura-violet px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">
              Design changed since this was assembled
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-md border border-aura-violet px-4 py-3 text-xs leading-relaxed text-aura-violet">
            {error}
          </p>
        ) : null}

        {pkg && prepared ? (
          <>
            {/* ------------------------------------------------ the verdict */}
            <div className="rounded-xl border border-aura-emerald p-5">
              <p className="aura-label text-aura-emerald">
                Assembled and read back before it was offered
              </p>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/80">
                Every hash in this package is computed from the content beside it, and the package
                was parsed back through its own reader before this screen drew — a package whose
                stated hashes disagree with what it carries cannot be produced. What you are
                looking at is the file the button saves, byte for byte.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
                <Figure
                  k="Files inside"
                  v={String(pkg.files.length)}
                  sub={`${sheets.length} drawing sheets`}
                />
                <Figure
                  k="Package size"
                  v={kb(prepared.result.artifact.byteLength)}
                  sub="one file, no zip"
                />
                <Figure k="Design hash" v={short(pkg.designHash)} sub="over the project itself" />
                <Figure
                  k="Cost snapshot"
                  v={pkg.budgetHash ? short(pkg.budgetHash) : "none"}
                  sub={pkg.budgetHash ? "budget hash" : "no cost basis was supplied"}
                />
              </dl>
              <p className="mt-4 font-mono text-[0.65rem] leading-relaxed text-aura-text/50">
                Issued {pkg.issuedISO} · package hash {pkg.packageHash}
              </p>
            </div>

            {/* -------------------------------------------------- the sheets */}
            {sheets.length > 0 ? (
              <div>
                <p className="aura-label mb-3 text-aura-teal">
                  The drawing sheets in this package
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {sheets.map(({ file, href }) => (
                    <figure key={file.name} className="rounded-md border aura-hairline p-2">
                      {/* Drawn from the SVG this package carries. The sheet is a
                          DOCUMENT — white paper, black ink — so it is shown as
                          drawn rather than recoloured by the theme. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={href} alt={file.note} className="block h-auto w-full bg-white" />
                      <figcaption className="mt-2 text-[0.65rem] leading-snug text-aura-text/60">
                        {file.note}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ------------------------------------------------ the manifest */}
            <div>
              <p className="aura-label mb-3">Everything in the package</p>
              <ul className="space-y-2">
                {pkg.files.map((file) => (
                  <li key={file.name} className="rounded-md border aura-hairline p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="font-mono text-xs text-aura-text">{file.name}</p>
                      <p className="font-mono text-[0.6rem] uppercase tracking-label text-aura-teal">
                        {KIND_LABEL[file.kind]} · {kb(file.bytes)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-aura-text/65">{file.note}</p>
                    {file.summary.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {file.summary.map((line, i) => (
                          <li
                            // A sheet's own notes can repeat between sheets, so
                            // the position inside this file is the stable key.
                            key={`${file.name}-${i}`}
                            className="flex gap-2 text-[0.7rem] leading-relaxed text-aura-text/50"
                          >
                            <span aria-hidden className="text-aura-emerald">
                              ·
                            </span>
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-2 font-mono text-[0.6rem] text-aura-text/40">{file.hash}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-aura-text/55">
                Each line under a file was read back out of that file after it was written — entity
                counts, declared schema, elements on a sheet. They are facts about the file, not a
                second opinion about your home.
              </p>
            </div>

            {/* ------------------------------------------------ the omissions */}
            {pkg.omissions.length > 0 ? (
              <Notice
                title={`${pkg.omissions.length} thing${pkg.omissions.length === 1 ? "" : "s"} this package does not contain`}
                items={pkg.omissions.map((o) => `${o.what} — ${o.why}`)}
                foot="Every one of these is the refusing writer's own reason, carried into the package so the recipient reads it too."
              />
            ) : null}

            {stale ? (
              <p className="text-xs leading-relaxed text-aura-text/60">
                You have edited the design since this was assembled, so everything above describes
                the earlier version. Press Assemble it again for the home on screen.
              </p>
            ) : null}
          </>
        ) : null}

        <p className="border-t aura-hairline pt-4 max-w-3xl text-xs leading-relaxed text-aura-text/55">
          {WHAT_A_PROFESSIONAL_STILL_DOES}
        </p>
      </div>
    </Panel>
  );
}

const short = (hash: string): string => `${hash.slice(0, 10)}…`;

function Figure({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.6rem] uppercase tracking-label text-aura-text/50">{k}</dt>
      <dd className="mt-0.5 font-mono text-xs text-aura-text">{v}</dd>
      <dd className="mt-0.5 text-[0.65rem] leading-snug text-aura-text/50">{sub}</dd>
    </div>
  );
}
