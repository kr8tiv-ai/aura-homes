"use client";

/* ===========================================================================
   YOUR DESIGNS — the panel that makes closing the tab survivable.

   Everything here is a thin press-the-button layer over
   `lib/builder/store.ts`. This file holds no schema, does no validation, and
   knows nothing about IndexedDB; it renders what the store returns and prints,
   verbatim, the sentence the store gives it when something fails. That split
   is the reason a quota error reads the same here as it would in a test.

   THE ONE PIECE OF REAL BEHAVIOUR IN THIS FILE IS THE AUTOSAVE HANDSHAKE, and
   it is worth stating plainly because getting it wrong is the classic way an
   autosave feature destroys the thing it was written to protect:

     On mount the panel READS the autosave slot before it ever WRITES to it.
     If the slot holds a design that is not the one on screen, autosaving is
     HELD and the visitor is asked. Restore it, or discard it — either way it
     is a press. Only then does the panel start writing.

   Without that hold, the first autosave tick after a crash would overwrite the
   crashed session's work with whatever the page happened to open with, and the
   recovery copy would be gone before anybody was offered it.

   NOTHING HERE REACHES INTO THE VIEWPORT. `ThumbnailProbe` is a zero-render
   component the integrator drops inside the existing `<Canvas>`; it registers
   a capture function with the store and unregisters on unmount. The library
   asks the store for a picture and never touches a renderer.
   =========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { feetInches, sqft } from "@/components/design/ecoSpec";
import type { BuilderDocument } from "@/lib/builder/document";
import {
  MAX_NAME_CHARS,
  canvasThumbnail,
  clearAutosave,
  deleteDesign,
  documentSignature,
  duplicateDesign,
  estimateStorage,
  explainStoreError,
  exportLibrary,
  importDesigns,
  listDesigns,
  onLibraryChange,
  parseLibraryFile,
  readAutosave,
  readDesign,
  registerThumbnailSource,
  renameDesign,
  saveDesign,
  storageAvailable,
  writeAutosave,
  type DesignSummary,
  type ImportMode,
  type SavedDesign,
  type StorageEstimate,
} from "@/lib/builder/store";
import { Button, Notice, Panel, TextInput } from "./ui";

/* ---------------------------------------------------------------- the probe */

/**
 * Mount this INSIDE the builder's `<Canvas>`, anywhere in the tree.
 *
 *     <Canvas …>
 *       <Scene … />
 *       <ThumbnailProbe />
 *     </Canvas>
 *
 * It renders nothing. It registers a capture function that draws one fresh
 * frame and reads the canvas back IN THE SAME SYNCHRONOUS TURN — which is
 * required, because the builder's canvas runs `frameloop="demand"` with the
 * default `preserveDrawingBuffer: false`, so the WebGL back buffer is only
 * valid until the browser composites. Rendering here rather than trusting
 * whatever was last drawn also means the thumbnail is of the design being
 * saved, not of the design as it was when the user last moved the camera.
 */
export function ThumbnailProbe(): null {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(
    () =>
      registerThumbnailSource(() => {
        gl.render(scene, camera);
        return canvasThumbnail(gl.domElement as HTMLCanvasElement);
      }),
    [gl, scene, camera],
  );

  return null;
}

/* ------------------------------------------------------------- formatting */

function formatWhen(ts: number): string {
  if (!ts) return "date unknown";
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 8) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ state */

type Phase =
  /** reading the database */
  | "boot"
  /** an autosave was found that is not what is on screen — autosaving is HELD */
  | "prompt"
  /** autosaving */
  | "live"
  /** storage is unavailable; the panel explains and offers nothing it cannot do */
  | "off";

interface Confirm {
  action: "delete" | "overwrite";
  id: string;
}

/** How long an armed confirmation stays armed. Long enough to move a mouse,
 *  short enough that a stray click five minutes later is not a deletion. */
const CONFIRM_MS = 5_000;

/* =========================================================================== */

export default function ProjectLibrary({
  value,
  onOpen,
  autosaveDelayMs = 4_000,
}: {
  /** the design currently in the builder */
  value: BuilderDocument;
  /** hand a stored design back to the builder. The label goes into the undo
   *  stack, so a restore or an open is always one Ctrl+Z from undone. */
  onOpen: (document: BuilderDocument, label: string) => void;
  /** idle time before the working design is written to the autosave slot */
  autosaveDelayMs?: number;
}) {
  const spec = value.spec;
  const [phase, setPhase] = useState<Phase>("boot");
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [estimate, setEstimate] = useState<StorageEstimate>({ usageBytes: null, quotaBytes: null });

  const [pending, setPending] = useState<SavedDesign | null>(null);
  const [pendingProblem, setPendingProblem] = useState<string | null>(null);

  const [saveName, setSaveName] = useState(spec.name);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);

  const [importMode, setImportMode] = useState<ImportMode>("merge");
  const fileInput = useRef<HTMLInputElement | null>(null);

  /* The content signature of what is on screen. Cheap to compare, and it is
     what lets a card say "this is the design you are looking at" without a
     deep compare of two buildings. */
  const signature = useMemo(() => documentSignature(value), [value]);
  const signatureRef = useRef(signature);
  signatureRef.current = signature;
  const documentRef = useRef(value);
  documentRef.current = value;

  const report = useCallback((err: unknown) => {
    setError(explainStoreError(err).message);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [list, room] = await Promise.all([listDesigns(), estimateStorage()]);
      setDesigns(list);
      setEstimate(room);
    } catch (err) {
      report(err);
    }
  }, [report]);

  /* ---- boot: read before writing. See the header. */
  useEffect(() => {
    let alive = true;
    if (!storageAvailable()) {
      setPhase("off");
      setError(
        "This browser has no IndexedDB, so designs cannot be saved here. The .json download and the share link in Take it with you both still work.",
      );
      return;
    }
    void (async () => {
      try {
        const [list, auto, room] = await Promise.all([listDesigns(), readAutosave(), estimateStorage()]);
        if (!alive) return;
        setDesigns(list);
        setEstimate(room);
        if (auto.present && !auto.readable) {
          setPendingProblem(auto.problem);
          setPhase("prompt");
        } else if (auto.present && auto.readable && auto.record.signature !== signatureRef.current) {
          setPending(auto.record);
          setPhase("prompt");
        } else {
          setPhase("live");
        }
      } catch (err) {
        if (!alive) return;
        setPhase("off");
        report(err);
      }
    })();
    return () => {
      alive = false;
    };
    // once, on mount: this is the read that must happen before any write
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- another tab (or another panel) changed the library */
  useEffect(() => onLibraryChange(() => void refresh()), [refresh]);

  /* ---- autosave, once the handshake is settled */
  useEffect(() => {
    if (phase !== "live" || autosaveError) return;
    const timer = setTimeout(() => {
      void writeAutosave(value).then(
        () => setAutosavedAt(Date.now()),
        (err) => setAutosaveError(explainStoreError(err).message),
      );
    }, autosaveDelayMs);
    return () => clearTimeout(timer);
  }, [value, phase, autosaveDelayMs, autosaveError]);

  /* ---- and on the way out of the tab, where the debounce would never fire.
         `visibilitychange` is the last event a browser reliably delivers;
         `beforeunload` cannot await a database write, so it is not used. */
  useEffect(() => {
    if (phase !== "live" || autosaveError) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        void writeAutosave(documentRef.current).catch(() => {
          /* a failure while the tab is hiding has nowhere to be shown; the
             next foreground tick reports it */
        });
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [phase, autosaveError]);

  /* ---- confirmations disarm themselves */
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirm]);

  /* ---- the name field follows the home until the visitor edits it */
  const lastSpecName = useRef(spec.name);
  useEffect(() => {
    if (spec.name !== lastSpecName.current) {
      lastSpecName.current = spec.name;
      setSaveName(spec.name);
    }
  }, [spec.name]);

  /* --------------------------------------------------------------- actions */

  const act = useCallback(
    async (job: string, fn: () => Promise<string | null>) => {
      setBusy(job);
      setError(null);
      try {
        const message = await fn();
        if (message) setNote(message);
        await refresh();
      } catch (err) {
        report(err);
      } finally {
        setBusy(null);
      }
    },
    [refresh, report],
  );

  const save = () =>
    act("save", async () => {
      const saved = await saveDesign({ name: saveName, document: value });
      return `Saved “${saved.name}” to this browser${
        saved.thumbnail ? "" : " — no thumbnail: the 3D view had nothing readable to capture"
      }.`;
    });

  const overwrite = (d: DesignSummary) =>
    act("overwrite", async () => {
      const saved = await saveDesign({ id: d.id, name: d.name, document: value });
      return `“${saved.name}” now holds the design on screen.`;
    });

  const open = (d: DesignSummary) =>
    act("open", async () => {
      const record = await readDesign(d.id);
      onOpen(record.document, `library:${record.id}`);
      return `Opened “${record.name}”. Ctrl+Z puts your previous home back — nothing was lost.`;
    });

  const remove = (d: DesignSummary) =>
    act("delete", async () => {
      await deleteDesign(d.id);
      return `Deleted “${d.name}”. That is gone from this browser; an exported library file still has it.`;
    });

  const duplicate = (d: DesignSummary) =>
    act("duplicate", async () => {
      const copy = await duplicateDesign(d.id);
      return `Copied to “${copy.name}”.`;
    });

  const commitRename = () =>
    act("rename", async () => {
      if (!renaming) return null;
      const next = await renameDesign(renaming.id, renaming.value);
      setRenaming(null);
      return `Renamed to “${next.name}” — the saved copy's own name changed with it.`;
    });

  const restore = () => {
    if (!pending) return;
    onOpen(pending.document, "autosave-restore");
    setNote(
      `Restored the design autosaved ${formatWhen(pending.updatedAt)}. Ctrl+Z puts back what was on screen a moment ago.`,
    );
    setPending(null);
    setPendingProblem(null);
    setPhase("live");
  };

  const discard = () =>
    act("discard", async () => {
      await clearAutosave();
      setPending(null);
      setPendingProblem(null);
      setPhase("live");
      return "Discarded the autosaved copy. The design on screen is untouched.";
    });

  const doExport = () =>
    act("export", async () => {
      const { artifact, skipped: bad } = await exportLibrary(new Date().toISOString());
      setSkipped(bad);
      return `${artifact.filename} — ${artifact.note} (${formatBytes(artifact.byteLength)}).`;
    });

  const doImport = (file: File) =>
    act("import", async () => {
      const text = await file.text();
      const parse = parseLibraryFile(text);
      if (parse.problem) {
        setSkipped([]);
        throw new Error(parse.problem);
      }
      setSkipped(parse.skipped);
      if (parse.designs.length === 0)
        return `${file.name} contained no design this build could read. Nothing was imported.`;
      const r = await importDesigns(parse.designs, importMode);
      return `Imported ${r.added} design${r.added === 1 ? "" : "s"} from ${file.name}${
        r.renamed ? `, ${r.renamed} of which collided with an existing id and were kept as copies` : ""
      }${r.removed ? `, replacing ${r.removed} that were here` : ""}.`;
    });

  /* ----------------------------------------------------------------- render */

  const used = estimate.usageBytes;
  const working = busy !== null;

  return (
    <Panel
      label="Your designs"
      hint="Saved in this browser, on this machine, with no account and nothing sent anywhere. That also means they are as durable as this browser's site data: clearing it, or opening the page in a different browser, and they are not there. The library file below is the copy you own."
      right={
        <span className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/45">
          {phase === "boot"
            ? "reading…"
            : phase === "off"
              ? "storage unavailable"
              : `${designs.length} saved${used !== null ? ` · ${formatBytes(used)} used` : ""}`}
        </span>
      }
    >
      <div className="space-y-5">
        {/* ------------------------------------------------ crash recovery */}
        {phase === "prompt" ? (
          <div className="rounded-xl border border-aura-violet p-5">
            <p className="aura-label text-aura-violet">There is unsaved work from a previous session</p>
            {pending ? (
              <>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/80">
                  The builder autosaved “{pending.name}” {formatWhen(pending.updatedAt)} and it is not the
                  design currently on screen. Nothing has been changed for you and autosaving is paused
                  until you decide — {sqft(pending.headline.floorAreaSqFt)},{" "}
                  {pending.headline.volumeCount} volume
                  {pending.headline.volumeCount === 1 ? "" : "s"}, ridge{" "}
                  {feetInches(pending.headline.ridgeHeightFt)}.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button tone="loud" onClick={restore} disabled={working}>
                    Restore it
                  </Button>
                  <Button tone="danger" onClick={() => void discard()} disabled={working}>
                    Discard it
                  </Button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-aura-text/60">
                  Restoring is an ordinary edit: undo takes you straight back to what is on screen now.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/80">
                  There is an autosaved design in this browser, and this build cannot read it —{" "}
                  {pendingProblem}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button tone="danger" onClick={() => void discard()} disabled={working}>
                    Discard it
                  </Button>
                  <Button onClick={() => setPhase("live")} disabled={working}>
                    Leave it alone
                  </Button>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-aura-text/60">
                  Leaving it keeps the record where it is and starts autosaving over it on the next
                  change. Discarding removes it now. Neither one guesses at what it contains.
                </p>
              </>
            )}
          </div>
        ) : null}

        {/* --------------------------------------------------------- saving */}
        {phase !== "off" ? (
          <div className="rounded-md border aura-hairline p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <TextInput
                label="Name this design"
                value={saveName}
                onChange={setSaveName}
                placeholder="My Aura home"
                maxLength={MAX_NAME_CHARS}
              />
              <div className="flex flex-wrap gap-2 pb-0.5">
                <Button tone="loud" onClick={() => void save()} disabled={working || phase === "boot"}>
                  {busy === "save" ? "Saving…" : "Save to this browser"}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-aura-text/55">
              Saving always makes a NEW entry — nothing here overwrites by itself. To update one you
              already have, use its own “Overwrite” below. The saved copy takes the name in this field;
              the home on screen keeps its own until you open the saved one.
              {phase === "live" ? (
                <>
                  {" "}
                  Autosave is on:{" "}
                  {autosavedAt ? `working copy written ${formatWhen(autosavedAt)}` : "waiting for a change"}
                  .
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        {autosaveError ? (
          <Notice
            title="Autosave has stopped"
            items={[autosaveError]}
            foot="Nothing you have saved is affected. Delete a design or two — thumbnails are most of the weight — then press Resume."
          />
        ) : null}
        {autosaveError ? (
          <Button onClick={() => setAutosaveError(null)}>Resume autosave</Button>
        ) : null}

        {/* ---------------------------------------------------------- grid */}
        {phase === "boot" ? (
          <p className="text-xs leading-relaxed text-aura-text/55">Reading this browser's library…</p>
        ) : null}

        {phase !== "boot" && phase !== "off" && designs.length === 0 ? (
          <p className="rounded-md border aura-hairline px-4 py-3 text-xs leading-relaxed text-aura-text/60">
            Nothing saved yet. Save the design on screen and it will be here when you come back — and if
            the tab dies before you press it, the autosave above catches the work anyway.
          </p>
        ) : null}

        {designs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {designs.map((d) => {
              const isCurrent = d.signature !== "" && d.signature === signature;
              const armed = confirm && confirm.id === d.id ? confirm.action : null;
              return (
                <div
                  key={d.id}
                  className={`flex h-full flex-col gap-3 rounded-md border p-3 ${
                    isCurrent ? "border-aura-emerald" : "aura-hairline"
                  }`}
                >
                  {/* thumbnail */}
                  <div className="overflow-hidden rounded border aura-hairline bg-aura-sunken">
                    {d.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={d.thumbnail}
                        alt={`3D view of ${d.name}`}
                        width={480}
                        height={300}
                        className="block aspect-[16/10] w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[16/10] w-full items-center justify-center">
                        <span className="font-mono text-[0.6rem] uppercase tracking-label text-aura-text/40">
                          no thumbnail
                        </span>
                      </div>
                    )}
                  </div>

                  {/* name */}
                  {renaming && renaming.id === d.id ? (
                    <div className="space-y-2">
                      <TextInput
                        label="New name"
                        value={renaming.value}
                        onChange={(v) => setRenaming({ id: d.id, value: v })}
                        maxLength={MAX_NAME_CHARS}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button tone="loud" onClick={() => void commitRename()} disabled={working}>
                          Save name
                        </Button>
                        <Button onClick={() => setRenaming(null)} disabled={working}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="break-words text-sm text-aura-text">{d.name}</p>
                      <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-text/45">
                        {formatWhen(d.updatedAt)}
                        {isCurrent ? " · on screen now" : ""}
                      </p>
                    </div>
                  )}

                  {/* headline figures — every one of them from spec.ts */}
                  {d.readable ? (
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.7rem] tabular-nums text-aura-text/70">
                      <dt className="text-aura-text/45">Floor</dt>
                      <dd className="text-right">{sqft(d.headline.floorAreaSqFt)}</dd>
                      <dt className="text-aura-text/45">Footprint</dt>
                      <dd className="text-right">{sqft(d.headline.footprintSqFt)}</dd>
                      <dt className="text-aura-text/45">Ridge</dt>
                      <dd className="text-right">{feetInches(d.headline.ridgeHeightFt)}</dd>
                      <dt className="text-aura-text/45">Volumes</dt>
                      <dd className="text-right">{d.headline.volumeCount}</dd>
                    </dl>
                  ) : (
                    <p className="rounded border border-aura-violet px-3 py-2 text-[0.7rem] leading-relaxed text-aura-violet">
                      {d.problem}
                    </p>
                  )}

                  {/* actions */}
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    <Button tone="loud" onClick={() => void open(d)} disabled={working || !d.readable}>
                      Open
                    </Button>
                    <Button
                      onClick={() => setRenaming({ id: d.id, value: d.name })}
                      disabled={working || !d.readable}
                    >
                      Rename
                    </Button>
                    <Button onClick={() => void duplicate(d)} disabled={working || !d.readable}>
                      Duplicate
                    </Button>
                    <Button
                      onClick={() =>
                        armed === "overwrite"
                          ? (setConfirm(null), void overwrite(d))
                          : setConfirm({ action: "overwrite", id: d.id })
                      }
                      disabled={working || isCurrent}
                      title="Replace this saved design with the one on screen"
                    >
                      {armed === "overwrite" ? "Replace it?" : "Overwrite"}
                    </Button>
                    <Button
                      tone="danger"
                      onClick={() =>
                        armed === "delete"
                          ? (setConfirm(null), void remove(d))
                          : setConfirm({ action: "delete", id: d.id })
                      }
                      disabled={working}
                    >
                      {armed === "delete" ? "Really delete?" : "Delete"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* ------------------------------------------------- move machines */}
        {phase !== "off" ? (
          <div className="rounded-md border aura-hairline p-4">
            <p className="text-sm text-aura-text">Move your library between machines</p>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-aura-text/60">
              One JSON file with every design in it, thumbnails included. It is also the only backup this
              tool has: browser storage is not a backup, and “clear site data” does not ask which parts
              you meant. Importing never overwrites a design silently — an id that collides is kept as a
              separate copy.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => void doExport()} disabled={working || designs.length === 0}>
                {busy === "export" ? "Writing…" : "Export library (.json)"}
              </Button>
              <Button onClick={() => fileInput.current?.click()} disabled={working}>
                {busy === "import" ? "Reading…" : "Import a library…"}
              </Button>
              <label className="flex items-center gap-2 text-xs text-aura-text/60">
                <input
                  type="checkbox"
                  checked={importMode === "replace"}
                  onChange={(e) => setImportMode(e.target.checked ? "replace" : "merge")}
                  className="h-3.5 w-3.5 rounded border aura-hairline bg-aura-bg accent-aura-emerald"
                />
                replace everything instead of merging
              </label>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                // reset first: choosing the same file twice must fire again
                e.target.value = "";
                if (f) void doImport(f);
              }}
            />
          </div>
        ) : null}

        {/* ----------------------------------------------------- messages */}
        {note ? <p className="text-xs leading-relaxed text-aura-text/60">{note}</p> : null}
        {error ? (
          <p className="rounded-md border border-aura-violet px-4 py-3 text-xs leading-relaxed text-aura-violet">
            {error}
          </p>
        ) : null}
        <Notice
          title={`${skipped.length} design${skipped.length === 1 ? "" : "s"} in that file could not be read`}
          items={skipped}
          foot="Each one is named with the exact field that failed. They were skipped rather than half-loaded, and the rest of the file imported normally."
        />
      </div>
    </Panel>
  );
}
