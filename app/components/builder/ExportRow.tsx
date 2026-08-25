"use client";

/* ===========================================================================
   TAKE IT WITH YOU — seven doors out, and WHO CAN OPEN EACH ONE.

   A home you cannot get out of our software is a toy. Every writer here lives
   in `lib/builder/exportSpec.ts`, `lib/builder/exportPro.ts`,
   `lib/builder/exportSemantic.ts` and `lib/builder/share.ts`; this component
   only presses the buttons and prints, verbatim, the one-line `note` each
   artifact carries about itself — so what the page claims about a file is what
   the module that wrote it says about it.

   THE DOORS ARE GROUPED BY WHO IS AT THE OTHER END OF THE EMAIL, because that
   is the only question the person pressing the button actually has:

     · SEND THIS TO YOUR DESIGNER   DXF and IFC4 — the two a licensed designer
                                    opens in the software they already own.
     · FOR A WEB OR DATA CONSUMER   ifcJSON and glTF — a browser, a script, a
                                    3D viewer. NOT a BIM handoff, and the
                                    ifcJSON door says so in the module's own
                                    words rather than in ours.
     · FOR A 3D TOOL, OR FOR YOU    OBJ, the Aura project file and a share link.

   "OPENS IN" IS NOT "WE OPENED IT IN". `exportPro.ts` keeps those two lists
   apart on purpose — `opens` is a fact about the format, `verifiedWith` is the
   list of checks that were actually run — and this component never merges
   them. The verification list is shown verbatim, under its own disclosure,
   and it is the only place a claim about testing appears.

   THE DXF IS PROVED, NOT ASSERTED, AND THE PROOF GATES THE DOWNLOAD.
   Pressing "Download .dxf" writes the file, then hands the EXACT BYTES of the
   blob that is about to be saved to `lib/builder/dxfCheck.ts` — a reader that
   shares no code with the writer — together with a `SourceDrawing` derived
   from the same `HomeModel` the SVG sheets are drawn from. Only a passing
   report reaches `downloadArtifact`. A failing one REFUSES the save, says so
   in the loudest colour this site has, and renders the parsed file underneath
   so the failure is inspectable rather than a shrug. A pass badge over a
   broken file is the exact thing this panel exists to make impossible.

   LOADING. The glTF and OBJ exporters are pulled in with a dynamic `import()`
   inside `exportSpec.ts`. Three more chunks are dynamically imported HERE, each
   once, on the first press that needs it: `exportPro.ts` (the DXF and IFC
   writers, ~2,800 lines of drafting and STEP authoring), `dxfCheck.ts` (the
   reader and the round-trip checker) and `exportSemantic.ts` (the ifcJSON
   writer). `DxfPreview` is a `next/dynamic` boundary for the same reason. A
   visitor who never asks for a professional file never downloads one byte of
   any of them.

   THE DISCLAIMER TRAVELS. It is written into the project file, into the glTF `extras`
   beside the whole HomeSpec, into the OBJ header, into the DXF as a note block
   on the TEXT layer and into the IFC as a property on the building — because a
   recipient who is emailed a file never saw this page.
   =========================================================================== */

import dynamic from "next/dynamic";
import { useCallback, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import type * as THREE from "three";
import {
  EXPORT_DISCLAIMER,
  downloadArtifact,
  exportGlb,
  exportObj,
  exportSpecJson,
  parseSpecJson,
  type ExportArtifact,
} from "@/lib/builder/exportSpec";
import { drawingModel } from "@/lib/builder/drawings";
import type { ProExportFormat } from "@/lib/builder/exportPro";
import type { DxfReport, SourceDrawing } from "@/lib/builder/dxfCheck";
import type { ComfortReport } from "@/lib/builder/comfort";
import {
  validateBuilderDocument,
  type BuilderDocument,
} from "@/lib/builder/document";
import { emptyFixtureSet, validateFixtureSet, type FixtureSet } from "@/lib/builder/fixtures";
import { documentToShareUrl } from "@/lib/builder/share";
import type { HomeSpec } from "@/lib/builder/spec";
import {
  NO_OVERRIDES,
  countOverrides,
  validateOverrides,
  type SurfaceOverrides,
} from "@/lib/builder/surfaces";
import { partitionsFromWire, type Partition } from "@/lib/builder/walls";
import { Button, Panel } from "./ui";

/* The proof panel is ~600 lines of SVG rendering over a parsed DXF. Nobody who
   never presses "Download .dxf" should pay for it. */
const DxfPreview = dynamic(() => import("./DxfPreview"), {
  ssr: false,
  loading: () => (
    <p className="mt-6 font-mono text-xs text-aura-text/45">Loading the DXF reader…</p>
  ),
});

type Job = "glb" | "obj" | "json" | "link" | "dxf" | "ifc" | "ifcjson" | null;

/* --------------------------------------------------------------- the proof

   What one press of "Download .dxf" produced. `spec` rides along so the panel
   can say "the model has changed since this was checked" instead of showing a
   verdict about a house that no longer exists — the same rule `BuilderApp`
   keeps for a generated drawing set. */
interface DxfRun {
  spec: HomeSpec;
  /** the file, as text: exactly the bytes in `artifact.blob` */
  text: string;
  artifact: ExportArtifact;
  source: SourceDrawing;
  report: DxfReport;
  /** true once the visitor has been shown a passing report and the file saved */
  saved: boolean;
}

/* ===========================================================================
   LEGACY .json SIDECAR READER

   New files use BuilderDocument directly. Claude-era files placed partitions,
   finishes and fixtures under one `auraEditor` key beside HomeSpec. Keeping
   this read-only path preserves those files without continuing the old split
   contract. All three values go through their OWN gates on the way back in —
   `partitionsFromWire`, `validateOverrides` and `validateFixtureSet` — which
   rebuild every field from checked primitives. A hand-edited file cannot
   smuggle anything into application state through this door either.
   =========================================================================== */

const EDITOR_KEY = "auraEditor";

interface EditorSidecar {
  partitions: Partition[];
  overrides: SurfaceOverrides;
  fixtures: FixtureSet;
}

/** Whatever an opened file had beside its spec, made safe. */
function readEditorState(text: string): EditorSidecar {
  const empty: EditorSidecar = {
    partitions: [],
    overrides: NO_OVERRIDES,
    fixtures: emptyFixtureSet(),
  };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return empty;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return empty;
  const block = (parsed as Record<string, unknown>)[EDITOR_KEY];
  if (typeof block !== "object" || block === null || Array.isArray(block)) return empty;
  const b = block as Record<string, unknown>;
  return {
    partitions: partitionsFromWire(b.partitions) ?? [],
    overrides: validateOverrides(b.finishes),
    fixtures: validateFixtureSet(b.fixtures) ?? emptyFixtureSet(),
  };
}

/* =========================================================================== */

export default function ExportRow({
  value,
  comfort = null,
  houseRef,
  onLoad,
}: {
  value: BuilderDocument;
  /**
   * The owner's comfort targets, for the two writers that carry them.
   *
   * `null` is NOT "write no comfort" here — it is "the builder has not
   * computed a report right now", so the option is OMITTED and both writers
   * derive their own defaults. That distinction lives in one place, in the
   * `comfort ?? undefined` below, and it is why a download from a tab that
   * was open a moment ago is never a file with the targets silently missing.
   */
  comfort?: ComfortReport | null;
  /** the group holding the volumes, the deck and the fixture layer — and
   *  nothing else */
  houseRef: MutableRefObject<THREE.Group | null>;
  onLoad: (document: BuilderDocument, label: string) => void;
}) {
  const spec = value.spec;
  const graphMode = value.geometry.kind === "building-graph";
  const partitions = value.partitions;
  const overrides = value.finishes;
  const fixtures = value.fixtures;
  const [busy, setBusy] = useState<Job>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [formats, setFormats] = useState<readonly ProExportFormat[] | null>(null);
  const [gaps, setGaps] = useState<readonly string[] | null>(null);
  const [dxfRun, setDxfRun] = useState<DxfRun | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  /* One promise per chunk, reused. Two people pressing DXF and IFC in quick
     succession must not fetch the chunk twice, and `import()` caching is
     per-module anyway — this just makes that explicit at the call site. */
  const proChunk = useRef<Promise<typeof import("@/lib/builder/exportPro")> | null>(null);
  const loadPro = useCallback(async () => {
    if (!proChunk.current) proChunk.current = import("@/lib/builder/exportPro");
    const m = await proChunk.current;
    setFormats(m.PRO_EXPORT_FORMATS);
    setGaps(m.PRO_EXPORT_GAPS);
    return m;
  }, []);

  const checkChunk = useRef<Promise<typeof import("@/lib/builder/dxfCheck")> | null>(null);
  const loadCheck = useCallback(async () => {
    if (!checkChunk.current) checkChunk.current = import("@/lib/builder/dxfCheck");
    return checkChunk.current;
  }, []);

  const semanticChunk = useRef<Promise<typeof import("@/lib/builder/exportSemantic")> | null>(null);
  const loadSemantic = useCallback(async () => {
    if (!semanticChunk.current) semanticChunk.current = import("@/lib/builder/exportSemantic");
    return semanticChunk.current;
  }, []);

  const finish = (a: ExportArtifact) => {
    downloadArtifact(a);
    setNote(`${a.filename} — ${a.note}`);
    setError(null);
  };

  const fail = (err: unknown) => {
    setError(err instanceof Error ? err.message : String(err));
  };

  const model = async (job: "glb" | "obj") => {
    const root = houseRef.current;
    if (!root) {
      setError(
        "The 3D view has not finished mounting yet, so there is no model to write. Give it a moment and press again.",
      );
      return;
    }
    setBusy(job);
    setError(null);
    try {
      // sceneUnits stays the default "feet": the builder's scene is built
      // straight from the spec, and the exporter converts to metres itself.
      finish(job === "glb" ? await exportGlb(root, value) : await exportObj(root, value));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  /* The date is a PARAMETER to every professional writer, and deliberately so:
     none of those modules reads a clock, because the same spec and the same
     date have to produce byte-identical output. An issue date is a fact about
     when a file was written, and it is supplied here for the same reason the
     drawing set's title block gets one. */
  const issueDate = () => new Date().toISOString().slice(0, 10);

  const ifc = async () => {
    setBusy("ifc");
    setError(null);
    try {
      const pro = await loadPro();
      finish(pro.exportIfc(value, { dateISO: issueDate(), comfort: comfort ?? undefined }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const ifcJson = async () => {
    setBusy("ifcjson");
    setError(null);
    try {
      const semantic = await loadSemantic();
      finish(semantic.exportIfcJson(value, { comfort: comfort ?? undefined }));
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  /**
   * Write the DXF, read it back, and save it ONLY if it comes back right.
   *
   * The bytes handed to the checker are the bytes of the blob that would be
   * saved — read out of the artifact itself rather than regenerated — so there
   * is no version of this in which the checked file and the downloaded file
   * are different files. The `SourceDrawing` comes off the same `HomeModel` the
   * SVG sheets are drawn from, which is what makes the comparison a check on
   * the WRITER rather than a second opinion about the geometry.
   */
  const dxf = async () => {
    setBusy("dxf");
    setError(null);
    try {
      const [pro, check] = await Promise.all([loadPro(), loadCheck()]);
      const artifact = pro.exportDxf(value, { dateISO: issueDate() });
      const text = await artifact.blob.text();
      const source = check.sourceFromModel(drawingModel(value));
      const report = check.checkDxf(text, source);
      const ok = report.ok;
      setDxfRun({ spec, text, artifact, source, report, saved: ok });
      if (ok) {
        downloadArtifact(artifact);
        setNote(
          `${artifact.filename} — ${artifact.note} · read back and checked before it was saved: ` +
            `${report.entities.length} entities on ${report.layersUsed.length} layers, ` +
            `${report.sourceChecks.filter((c) => c.pass).length} of ${report.sourceChecks.length} ` +
            `checks against the model passed.`,
        );
      } else {
        setNote(null);
        setError(
          `The .dxf this build just wrote does NOT read back as your model, so it was not saved. ` +
            `${report.problems.filter((p) => p.severity === "error").length} error(s) are named in ` +
            `full below, and the file is drawn underneath from the entities the reader actually ` +
            `found — emailing it to a designer would waste their time and yours.`,
        );
      }
    } catch (err) {
      setDxfRun(null);
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("link");
    setError(null);
    setCopied(false);
    try {
      const url = await documentToShareUrl(value);
      setLink(url);
      setNote(
        `Share link — ${url.length} characters, the complete project in the URL fragment. A fragment is never sent to the server, so a shared design does not land in an access log.`,
      );
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        // Clipboard permission is not a failure worth shouting about — the
        // URL is on screen and selectable, which is the fallback that always
        // works.
        setCopied(false);
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const saveJson = () => {
    setBusy("json");
    finish(exportSpecJson(value));
    setBusy(null);
  };

  const open = async (file: File) => {
    setError(null);
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    let checked = validateBuilderDocument(parsed);

    /* Claude-era project JSON used a HomeSpec envelope plus `auraEditor`.
       Read it without rewriting the source file, then immediately rebuild it
       as the current document contract. */
    if ((!checked.ok || checked.migratedFrom === "editor-doc") && parsed) {
      const loadedSpec = parseSpecJson(text);
      if (loadedSpec) {
        const extra = readEditorState(text);
        checked = validateBuilderDocument({
          spec: loadedSpec,
          partitions: extra.partitions,
          overrides: extra.overrides,
          fixtures: extra.fixtures,
        });
      }
    }
    if (!checked.ok) {
      setError(
        `${file.name} is not a project this build understands — ${checked.problem}. Nothing was loaded, because a half-read project is worse than no project.`,
      );
      return;
    }
    onLoad(checked.document, `load:${file.name}`);
    const carried = `${checked.document.partitions.length} partition(s), ${countOverrides(checked.document.finishes)} finish(es), ${checked.document.fixtures.items.length} fixture(s), comfort settings and ${checked.document.quarantine.entries.length} quarantined item(s) came with it.`;
    setNote(
      `Opened ${file.name} — ${checked.document.spec.volumes.length} volume(s). ${carried} Undo puts your previous project back.`,
    );
  };

  const dxfStale = dxfRun !== null && dxfRun.spec !== spec;

  return (
    <>
      <Panel
        label="Take it with you"
        hint="Seven doors, grouped by who is at the other end of the email. Every one names the programs that read that FORMAT — which is a different claim from the programs this build was tested against, and that shorter list has its own disclosure at the bottom."
      >
      <div className="space-y-6">
        {graphMode ? (
          <p className="rounded-md border aura-hairline px-4 py-3 text-xs leading-relaxed text-aura-text/70">
            This project uses planar graph geometry. The project file, share link, glTF and OBJ
            below use the current graph-backed design. DXF, IFC and ifcJSON are written from the
            graph storeys&rsquo; bounding boxes — the same hosts fixtures snap to — not from the
            frozen recovery HomeSpec.
          </p>
        ) : null}
        {/* ================================================== the handoff */}
        <div>
          <p className="aura-label mb-1 text-aura-emerald">Send this to your designer</p>
          <p className="mb-3 max-w-3xl text-xs leading-relaxed text-aura-text/55">
            These two are the professional handoff. A licensed residential designer, a drafter or a
            BIM office opens one of them in software they already own, corrects it, and seals it.
            Attach both — the DXF is the drawing, the IFC is the building.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Door
              title="AutoCAD DXF (.dxf)"
              opens="AutoCAD and AutoCAD LT, BricsCAD, DraftSight, LibreCAD, QCAD, FreeCAD, Rhino, SketchUp Pro, Illustrator and Inkscape."
              body="The 2D drawings — floor plan, roof plan, foundation, all four elevations, the section and the schedule — laid out in model space at full size, on named layers a drafter can turn off one at a time. This is the file somebody opens to correct the wall we got wrong, add the dimension we could not know, and seal it. R12 ASCII, which is the DXF version with the widest reader support."
              action={
                <div className="space-y-2">
                  <Button tone="loud" onClick={() => void dxf()} disabled={busy !== null}>
                    {busy === "dxf" ? "Drafting and checking…" : "Download .dxf"}
                  </Button>
                  <p className="text-[0.7rem] leading-snug text-aura-text/55">
                    Written, then read back by a separate parser and compared against your model
                    before it saves. It only downloads if it passes.
                  </p>
                </div>
              }
            />
            <Door
              title="IFC4 (.ifc)"
              opens="Revit, ArchiCAD, Vectorworks, Allplan, Tekla, Solibri, BIMcollab ZOOM, Navisworks, FreeCAD's BIM workbench, and Blender with the Bonsai add-on."
              body="The building as a building, not as a shape: walls carrying a real material layer at the real thickness, windows and doors sitting in openings that genuinely void the wall they are in, slabs, roofs and the pile layout. This is the one a BIM-using designer imports and starts editing, and the one a quantity surveyor or an energy modeller can read. ISO 10303-21 text — the serialisation the tools above actually import."
              action={
                <Button tone="loud" onClick={() => void ifc()} disabled={busy !== null}>
                  {busy === "ifc" ? "Authoring…" : "Download .ifc"}
                </Button>
              }
            />
          </div>
        </div>

        {/* ============================================ the round-trip proof */}
        <DxfVerdict run={dxfRun} stale={dxfStale} />

        {/* ================================================== web and data */}
        <div>
          <p className="aura-label mb-1 text-aura-teal">For a web or data consumer</p>
          <p className="mb-3 max-w-3xl text-xs leading-relaxed text-aura-text/55">
            A browser, a script, a viewer, a pipeline. Neither of these is a BIM handoff and neither
            belongs in an email to a designer — no mainstream BIM tool imports ifcJSON, and a .glb is
            a shape rather than a building. Use the two above for that.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Door
              title="ifcJSON (.ifcjson)"
              opens="Any JSON reader — a browser, jq, Python, a spreadsheet import — and buildingSMART's json2ifc.py, which converts it to a real .ifc. NOT Revit, ArchiCAD, Vectorworks, Tekla, Solibri or Navisworks: none of them reads it."
              body="IFC4 as JSON. Every wall with its real material layer thickness and R-value, every window and door as an opening cut into a named wall, slabs, spaces, storeys and the site, plus the eco spec as property sets. A CANDIDATE encoding rather than a published standard — which is why it is on this side of the panel and not the other. The panel below writes the same file, checks it round-trips, and offers the linked-data bundle."
              action={
                <Button onClick={() => void ifcJson()} disabled={busy !== null}>
                  {busy === "ifcjson" ? "Writing…" : "Download .ifcjson"}
                </Button>
              }
            />
            <Door
              title="glTF 2.0 binary (.glb)"
              opens="Blender, SketchUp, Rhino, Unreal, Unity, Godot, macOS Quick Look, Windows 3D Viewer and every free web viewer."
              body={
                graphMode
                  ? "The model. One self-contained file — geometry, materials, and the full design document riding along in the file's own metadata. A Khronos open standard. In metres, converted from feet at exactly 0.3048. Because this project uses planar graph geometry, the stored HomeSpec is a frozen pre-conversion copy: it travels as recovery data, labelled as such, and the file does not present its dimensions as describing this model. It is a copy of the scene you are looking at, so a finish you assigned arrives as that material's colour and roughness — the finish MAP itself is not in it, so re-importing a .glb cannot restore your choices. Fixtures are in it; the clearance volumes around them are not."
                  : "The model. One self-contained file — geometry, materials, and the whole HomeSpec riding along in the file's own metadata. A Khronos open standard. In metres, converted from the spec's feet at exactly 0.3048. It is a copy of the scene you are looking at, so a finish you assigned arrives as that material's colour and roughness — the finish MAP itself is not in it, so re-importing a .glb cannot restore your choices. Fixtures are in it; the clearance volumes around them are not."
              }
              action={
                <Button onClick={() => void model("glb")} disabled={busy !== null}>
                  {busy === "glb" ? "Writing…" : "Download .glb"}
                </Button>
              }
            />
          </div>
        </div>

        {/* ================================================== everything else */}
        <div>
          <p className="aura-label mb-1">For a 3D tool, or for you</p>
          <p className="mb-3 max-w-3xl text-xs leading-relaxed text-aura-text/55">
            The lowest common denominator, the source of truth, and the link.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <Door
              title="Wavefront OBJ (.obj)"
              opens="Effectively everything, including software far older than this format's replacements."
              body="The lowest common denominator — geometry only, no materials, no metadata. It exists because older CAD, student software and the one machine in every shop running something from 2009 read OBJ and nothing else. It always opens."
              action={
                <Button onClick={() => void model("obj")} disabled={busy !== null}>
                  {busy === "obj" ? "Writing…" : "Download .obj"}
                </Button>
              }
            />
            <Door
              title="Aura project (.aura.json)"
              opens="This builder, and any text editor."
              body="The complete, versioned source of truth: geometry, partitions, finishes, fixtures, comfort targets and repair-held details. It is deterministic, human-readable JSON and the safest way to move a larger project between devices. A future document version is refused visibly rather than partially loaded."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveJson} disabled={busy !== null}>
                    Download .aura.json
                  </Button>
                  <Button onClick={() => fileInput.current?.click()} disabled={busy !== null}>
                    Open a project
                  </Button>
                </div>
              }
            />
            <Door
              title="Share link"
              opens="Any browser — no account and nothing stored."
              body="The complete project compressed into a URL fragment: geometry, partitions, finishes, fixtures and comfort targets arrive together. Newer versions are refused out loud rather than half-read. Very large projects use the .aura.json file because long URLs are unreliable."
              action={
                <Button onClick={() => void share()} disabled={busy !== null}>
                  {busy === "link" ? "Encoding…" : copied ? "Copied — copy again" : "Copy share link"}
                </Button>
              }
            />
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json,.aura.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            // reset first: choosing the same file twice must fire again
            e.target.value = "";
            if (f) void open(f);
          }}
        />

        {link ? (
          <label className="block">
            <span className="aura-label mb-2 block">
              {copied ? "Copied to your clipboard" : "Select and copy this"}
            </span>
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-md border aura-hairline bg-aura-bg px-4 py-2.5 font-mono text-xs text-aura-text/80 focus:border-aura-emerald focus:outline-none"
            />
          </label>
        ) : null}

        {note ? <p className="text-xs leading-relaxed text-aura-text/60">{note}</p> : null}
        {error ? (
          <p className="rounded-md border border-aura-violet px-4 py-3 text-xs leading-relaxed text-aura-violet">
            {error}
          </p>
        ) : null}

        {/* ------------------------------- what was actually checked, verbatim */}
        <details
          className="rounded-md border aura-hairline px-4 py-3"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) void loadPro();
          }}
        >
          <summary
            data-cursor="Select"
            className="cursor-pointer font-mono text-[0.6rem] uppercase tracking-label text-aura-text/55"
          >
            What the DXF and IFC writers were checked against — and what is not in them
          </summary>
          <div className="mt-4 space-y-5">
            <p className="text-xs leading-relaxed text-aura-text/60">
              The programs listed on each door are a fact about the FORMAT. Below is the separate
              and much shorter list of what output from these writers has actually been run
              through, printed word for word from the module that wrote the files. Nobody here has
              a Revit licence, and &ldquo;opens in Revit&rdquo; is not the same sentence as
              &ldquo;we opened it in Revit&rdquo;.
            </p>
            {formats ? (
              formats.map((f) => (
                <div key={f.id}>
                  <p className="aura-label mb-2">{f.label}</p>
                  <ul className="space-y-1.5">
                    {f.verifiedWith.map((v) => (
                      <li key={v} className="flex gap-2.5 text-xs leading-relaxed text-aura-text/70">
                        <span aria-hidden className="text-aura-emerald">
                          ·
                        </span>
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="font-mono text-xs text-aura-text/45">Loading the writers&rsquo; own record…</p>
            )}
            {gaps ? (
              <div>
                <p className="aura-label mb-2 text-aura-violet">Not in either file</p>
                <ul className="space-y-1.5">
                  {gaps.map((g) => (
                    <li key={g} className="flex gap-2.5 text-xs leading-relaxed text-aura-text/70">
                      <span aria-hidden className="text-aura-violet">
                        ·
                      </span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-aura-text/55">
                  Interior partitions are on that list for a concrete reason: the current DXF and
                  IFC writers still derive their shell from the legacy HomeSpec geometry. The
                  complete BuilderDocument keeps partitions, fixtures and finishes through undo,
                  autosave, library saves, project files and share links, but those details do not
                  enter these professional exports until the shared BuildingGraph release.
                </p>
              </div>
            ) : null}
          </div>
        </details>

        <p className="border-t aura-hairline pt-4 text-xs leading-relaxed text-aura-text/55">
          Every file carries this line inside it: &ldquo;{EXPORT_DISCLAIMER}&rdquo;
        </p>
      </div>
      </Panel>

      {/* ===================================================== the proof itself

          Rendered OUTSIDE the panel, at full width, because it is the evidence
          for the claim the panel makes rather than a footnote to it. Everything
          on it is drawn from the parsed file: if the writer dropped a layer,
          this section is missing a layer. */}
      {dxfRun ? (
        <DxfPreview
          dxf={dxfRun.text}
          source={dxfRun.source}
          filename={dxfRun.artifact.filename}
          title={
            dxfRun.report.ok
              ? "The DXF that was just saved, read back"
              : "The DXF that was REFUSED, read back"
          }
        />
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------- the DXF verdict

   The one-glance answer, directly under the button that produced it. The long
   version — entity counts by type, the layer table, the extents, every source
   check and the file drawn back from its own entities — is `DxfPreview` below.
   This exists so the outcome cannot be missed by somebody who does not scroll. */
function DxfVerdict({ run, stale }: { run: DxfRun | null; stale: boolean }) {
  if (!run) return null;
  const r = run.report;
  const errors = r.problems.filter((p) => p.severity === "error").length;
  const passed = r.sourceChecks.filter((c) => c.pass).length;

  return (
    <div className={`rounded-xl border p-5 ${r.ok ? "border-aura-emerald" : "border-aura-violet"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className={`aura-label ${r.ok ? "text-aura-emerald" : "text-aura-violet"}`}>
          {r.ok
            ? "The .dxf was read back, checked, and saved"
            : `The .dxf FAILED its own check and was NOT saved — ${errors} error${errors === 1 ? "" : "s"}`}
        </p>
        {stale ? (
          <span className="rounded border border-aura-violet px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">
            Model changed since this check
          </span>
        ) : null}
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/80">
        {r.ok
          ? "Written, parsed back by a reader that shares no code with the writer, and compared against the same model the drawing sheets come from. That is why this button is slower than the others — it is the difference between claiming an export works and showing it."
          : "This build wrote a file that does not read back as your home, so the download was refused rather than handed over with a green tick. Nothing about your model is lost and nothing else on this page is affected. The whole file is parsed and drawn below with every problem named, so the fault is inspectable instead of mysterious."}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
        <Figure k="Entities" v={String(r.entities.length)} sub={`${r.lineCount} lines of DXF`} />
        <Figure
          k="Layers used"
          v={`${r.layersUsed.length} of ${r.layersDeclared.length}`}
          sub="used of declared"
        />
        <Figure
          k="Extents"
          v={
            r.measuredExtents
              ? `${Math.round(r.measuredExtents.maxX - r.measuredExtents.minX)} × ${Math.round(
                  r.measuredExtents.maxY - r.measuredExtents.minY,
                )}`
              : "none"
          }
          sub={r.unitsLabel}
        />
        <Figure
          k="Checked against the model"
          v={`${passed} of ${r.sourceChecks.length}`}
          sub="footprints, labels, counts, span"
        />
      </dl>

      {stale ? (
        <p className="mt-4 text-xs leading-relaxed text-aura-text/60">
          You have edited the home since this file was written, so this verdict is about the earlier
          version. Press Download .dxf again for the one on screen.
        </p>
      ) : null}
    </div>
  );
}

function Figure({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.6rem] uppercase tracking-label text-aura-text/50">{k}</dt>
      <dd className="mt-0.5 tabular-nums text-aura-text">{v}</dd>
      <dd className="mt-0.5 text-[0.65rem] leading-snug text-aura-text/50">{sub}</dd>
    </div>
  );
}

function Door({
  title,
  opens,
  body,
  action,
}: {
  title: string;
  /** WHO CAN OPEN IT. A fact about the format, never a claim about testing. */
  opens: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-md border aura-hairline p-4">
      <div>
        <p className="text-sm text-aura-text">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-aura-text/70">
          <span className="font-mono text-[0.6rem] uppercase tracking-label text-aura-teal">
            Opens in
          </span>{" "}
          {opens}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-aura-text/60">{body}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}
