"use client";

/* ===========================================================================
   /projects — the dashboard, and the truth about where the work lives.

   Two jobs, and they are the same job.

   The first is a real dashboard: for every project, the stage it is actually
   on, when it was last edited, how many blockers are open, a short design
   hash, and one click to open, duplicate, export, archive or delete. Every
   value comes from `projectDashboardRow`, which reads the saved
   `stepStates` / `blockers` / `recommendedNextAction` — all three already
   computed and, until now, largely unseen. Nothing on this page is inferred
   from the presence of data, and a project with nothing in it reads as a
   declared zero rather than a plausible number.

   The second is storage truth. "One portable project you own" is only true
   while the browser cooperates, so this page says out loud where the project
   lives, what deletes it, and where the copy that leaves with you comes from
   — and when the browser refuses, it says which refusal in three separate
   sentences: what happened, what was and was not saved, and what to do. The
   three-field shape comes from `ProjectStorageDiagnosis`; this file never
   writes its own failure prose, so a message cannot drift from the code that
   raised it.

   RESTORE NAMES WHAT IT REPLACES FIRST. An import is parsed, then planned,
   then shown — "this replaces <name>, last edited <date>, design <hash>" —
   and only then applied, with "Keep both" available at every collision. The
   confirmation is a separate step from the file picker on purpose: a file
   drop that silently overwrote four months of decisions because two exports
   share an id is precisely the failure this separation exists to prevent.
   =========================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { AuraProject } from "@/lib/project/document";
import {
  decryptAuraProjectFile,
  encryptAuraProjectFile,
  parseAuraProjectFile,
  projectFileJson,
} from "@/lib/project/file";
import {
  applyAuraProjectRestore,
  deleteAuraProject,
  diagnoseProjectStorageError,
  duplicateAuraProject,
  estimateProjectStorage,
  forgetClearedProjects,
  planAuraProjectRestore,
  projectDashboardRow,
  readProjectLibrary,
  saveAuraProject,
  type ProjectLibraryState,
  type ProjectRestoreChoice,
  type ProjectRestorePlan,
  type ProjectStorageDiagnosis,
  type ProjectStorageEstimate,
} from "@/lib/project/store";
import { useAuraProject } from "./ProjectContext";

const EMPTY_LIBRARY: ProjectLibraryState = {
  projects: [],
  unreadable: 0,
  storage: null,
  cleared: null,
};

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function safeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "aura-project";
}

const fmtDate = (iso: string) =>
  iso && Number.isFinite(Date.parse(iso))
    ? new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })
    : "an unrecorded date";

/** Megabytes, one decimal. Only ever shown beside a figure the browser gave
 *  us — a null estimate prints nothing rather than a guess. */
const fmtMb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

/* ---------------------------------------------------------------------------
   the three-field failure card — one component, every failure
   --------------------------------------------------------------------------- */

function Diagnosis({
  diagnosis,
  action,
}: {
  diagnosis: ProjectStorageDiagnosis;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      data-storage-failure={diagnosis.kind}
      className="rounded-xl border border-aura-violet/35 bg-aura-panel p-5 sm:p-6"
    >
      <p className="aura-label text-aura-violet">Storage · {diagnosis.kind}</p>
      <p className="mt-3 font-display text-lg leading-snug tracking-[-0.01em]">{diagnosis.headline}</p>
      <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-aura-text/80">{diagnosis.saved}</p>
      <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-aura-text/70">{diagnosis.wayOut}</p>
      {action ? <div className="mt-4 flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}

const buttonBase =
  "inline-flex min-h-9 items-center rounded-full px-4 py-2 font-mono text-[0.68rem] uppercase tracking-label transition-opacity disabled:opacity-45";
const primaryButton = `${buttonBase} bg-aura-ink text-aura-paper hover:opacity-85`;
const quietButton = `${buttonBase} border border-hairline text-aura-text/80 hover:text-aura-text`;
const dangerButton = `${buttonBase} border border-aura-violet/45 text-aura-violet hover:opacity-85`;

export default function ProjectLibrary() {
  const { project: active, save } = useAuraProject();
  const [library, setLibrary] = useState<ProjectLibraryState>(EMPTY_LIBRARY);
  const [estimate, setEstimate] = useState<ProjectStorageEstimate>({ usageBytes: null, quotaBytes: null });
  const [loaded, setLoaded] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<ProjectStorageDiagnosis | null>(null);
  const [plan, setPlan] = useState<ProjectRestorePlan | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    const state = await readProjectLibrary();
    setLibrary(state);
    setEstimate(await estimateProjectStorage());
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [active, refresh]);

  /** Every mutation goes through here, so a quota-exceeded or blocked write
   *  surfaces as the named three-field card instead of an unhandled reject. */
  const run = useCallback(
    async (work: () => Promise<string | null>) => {
      setBusy(true);
      setMessage(null);
      setFailure(null);
      try {
        const note = await work();
        if (note) setMessage(note);
        await refresh();
      } catch (error) {
        setFailure(diagnoseProjectStorageError(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const rows = useMemo(() => library.projects.map(projectDashboardRow), [library.projects]);
  const activeCount = rows.filter((row) => !row.archived).length;

  async function openProject(project: AuraProject) {
    await run(async () => {
      await save(project);
      return `${project.name} is now the open project.`;
    });
  }

  async function duplicate(project: AuraProject) {
    await run(async () => {
      const copy = await duplicateAuraProject(project, `project-${crypto.randomUUID()}`, new Date());
      await save(copy);
      return `${copy.name} was created and opened. The original is untouched.`;
    });
  }

  async function toggleArchive(project: AuraProject) {
    await run(async () => {
      const next: AuraProject = {
        ...project,
        archivedAtISO: project.archivedAtISO ? null : new Date().toISOString(),
        updatedAtISO: new Date().toISOString(),
      };
      /* Archiving a project you do not have open must not open it. The
         context's `save` always makes a project active, so only the project
         already on screen goes through it. */
      if (active?.id === project.id) await save(next);
      else await saveAuraProject(next, false);
      return project.archivedAtISO
        ? `${project.name} is back in the active list.`
        : `${project.name} was archived. Its data and exports are unchanged.`;
    });
  }

  async function confirmDelete(project: AuraProject) {
    await run(async () => {
      await deleteAuraProject(project.id);
      setDeleting(null);
      return `${project.name} was deleted from this browser. Any export file you downloaded still holds it.`;
    });
  }

  function plainDownload(project: AuraProject) {
    downloadText(`${safeName(project.name)}.aura-project.json`, projectFileJson(project));
    setMessage(`${project.name} was downloaded unencrypted. Anyone with the file can read it.`);
  }

  async function encryptedDownload(project: AuraProject) {
    setMessage(null);
    setFailure(null);
    try {
      const encrypted = await encryptAuraProjectFile(project, passphrase);
      downloadText(`${safeName(project.name)}.encrypted.aura-project.json`, encrypted);
      setMessage(
        `${project.name} was exported with AES-256-GCM. Aura cannot recover a forgotten passphrase, so keep it where you keep the file.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  /** Parse and PLAN. Nothing is written until the plan is confirmed. */
  async function stageImport(file: File) {
    setBusy(true);
    setMessage(null);
    setFailure(null);
    setPlan(null);
    try {
      const text = await file.text();
      const marker = JSON.parse(text) as { format?: string };
      const incoming = marker.format === "aura-project-encrypted"
        ? await decryptAuraProjectFile(text, passphrase)
        : (() => {
            const parsed = parseAuraProjectFile(text);
            if (!parsed.ok) throw new Error(parsed.problem);
            return parsed.project;
          })();
      setPlan(await planAuraProjectRestore(incoming));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function applyPlan(choice: ProjectRestoreChoice) {
    const current = plan;
    if (!current) return;
    await run(async () => {
      const restored = await applyAuraProjectRestore(current, choice, `project-${crypto.randomUUID()}`);
      await save(restored);
      setPlan(null);
      return choice === "overwrite"
        ? `${restored.name} replaced the saved record with the same identifier and is now open.`
        : `${restored.name} was added as a separate project. ${current.overwrites?.name ?? "The existing record"} is unchanged.`;
    });
  }

  return (
    <div className="mx-auto max-w-5xl py-10 sm:py-14">
      <header className="max-w-2xl">
        <p className="aura-label">Local-first project library</p>
        <h1 className="mt-3 font-display text-[clamp(2.25rem,5vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.04em]">
          Your Aura projects
        </h1>
        <p className="mt-4 text-[0.98rem] leading-[1.7] text-aura-text/75">
          Everything you have started, with the stage it is on and the work that is blocking it. No
          account, and nothing is uploaded.
        </p>
      </header>

      {/* --- storage truth, stated before anything asks to be trusted --- */}
      <section
        aria-labelledby="storage-truth"
        className="mt-8 rounded-xl border border-hairline bg-aura-panel p-5 sm:p-6"
      >
        <h2 id="storage-truth" className="font-display text-lg tracking-[-0.01em]">
          Where these projects live
        </h2>
        <ul className="mt-3 grid gap-2 text-[0.9rem] leading-relaxed text-aura-text/80 sm:grid-cols-3">
          <li>
            <span className="text-aura-text">In this browser only.</span> Aura has no copy, and there is
            no account to sign in to.
          </li>
          <li>
            <span className="text-aura-text">Clearing this site&apos;s data deletes them.</span> So does a
            browser that evicts storage, and a private window keeps nothing at all.
          </li>
          <li>
            <span className="text-aura-text">An encrypted export is the copy that leaves with you.</span>{" "}
            One file per project, openable in any browser running Aura.
          </li>
        </ul>
        <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-label text-aura-text/55">
          {activeCount} active
          {rows.length - activeCount > 0 ? ` · ${rows.length - activeCount} archived` : ""}
          {estimate.usageBytes !== null && estimate.quotaBytes !== null
            ? ` · ${fmtMb(estimate.usageBytes)} used of about ${fmtMb(estimate.quotaBytes)} this browser allows`
            : " · this browser does not report how much room is left"}
        </p>
      </section>

      {/* --- the store could not be read at all --- */}
      {library.storage ? (
        <div className="mt-6">
          <Diagnosis
            diagnosis={library.storage}
            action={
              <button type="button" className={quietButton} onClick={() => void refresh()}>
                Try again
              </button>
            }
          />
        </div>
      ) : null}

      {/* --- a write failed: quota, blocked, or something unrecognised --- */}
      {failure ? (
        <div className="mt-6">
          <Diagnosis
            diagnosis={failure}
            action={
              <button type="button" className={quietButton} onClick={() => setFailure(null)}>
                Dismiss
              </button>
            }
          />
        </div>
      ) : null}

      {/* --- the store opened, and what this browser held is gone --- */}
      {library.cleared ? (
        <div
          role="alert"
          data-storage-cleared="true"
          className="mt-6 rounded-xl border border-aura-violet/35 bg-aura-panel p-5 sm:p-6"
        >
          <p className="aura-label text-aura-violet">Storage · cleared</p>
          <p className="mt-3 font-display text-lg leading-snug tracking-[-0.01em]">
            This browser held {library.cleared.count} project
            {library.cleared.count === 1 ? "" : "s"} and now holds none.
          </p>
          <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-aura-text/80">
            The database opened normally and is empty. The last recorded edit was{" "}
            {fmtDate(library.cleared.lastEditedISO)}
            {library.cleared.names.length > 0 ? `, and the names were ${library.cleared.names.join(", ")}` : ""}.
            Nothing was deleted by Aura — clearing site data, a private window, or the browser reclaiming
            space all do this.
          </p>
          <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-aura-text/70">
            If you exported a project, import the file below and it comes back whole. If you did not,
            this work cannot be recovered, and an export after the next edit is what prevents a repeat.
          </p>
          <div className="mt-4">
            <button
              type="button"
              className={quietButton}
              onClick={() => {
                forgetClearedProjects();
                void refresh();
              }}
            >
              I understand, stop showing this
            </button>
          </div>
        </div>
      ) : null}

      {library.unreadable > 0 ? (
        <p role="status" className="mt-6 border-l-2 border-aura-violet/50 pl-4 text-sm text-aura-text/75">
          {library.unreadable} saved record{library.unreadable === 1 ? "" : "s"} could not be read by this
          build and {library.unreadable === 1 ? "is" : "are"} not listed below. Nothing was deleted —
          reload the page to pick up a newer build, which may read {library.unreadable === 1 ? "it" : "them"}.
        </p>
      ) : null}

      {/* --- export + restore --- */}
      <section
        aria-labelledby="portable-heading"
        className="mt-6 rounded-xl border border-hairline bg-aura-panel p-5 sm:p-6"
      >
        <h2 id="portable-heading" className="font-display text-lg tracking-[-0.01em]">
          Portable copies
        </h2>
        <p className="mt-2 max-w-2xl text-[0.9rem] leading-relaxed text-aura-text/75">
          A passphrase of eight characters or more encrypts an export with AES-256-GCM, and unlocks one
          on the way back in. Leave it empty to work with unencrypted files.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-[0.8rem] text-aura-text/75">
            Backup passphrase
            <input
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              autoComplete="new-password"
              className="mt-2 block w-full rounded-lg border border-hairline bg-aura-bg px-3 py-2 text-sm text-aura-text"
            />
          </label>
          <label className="text-[0.8rem] text-aura-text/75">
            Import a project file
            <input
              ref={fileInput}
              aria-label="Import an Aura project file"
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void stageImport(file);
              }}
              className="mt-2 block w-full text-sm text-aura-text/80"
            />
          </label>
        </div>

        {/* Named before written: the plan is shown, the write waits. */}
        {plan ? (
          <div
            role="alert"
            data-restore-plan={plan.overwrites ? "overwrites" : "adds"}
            className="mt-5 rounded-lg border border-hairline bg-aura-bg p-4 sm:p-5"
          >
            <p className="aura-label">Confirm restore</p>
            {plan.overwrites ? (
              <>
                <p className="mt-3 text-[0.95rem] leading-relaxed">
                  Restoring <span className="text-aura-text">{plan.incoming.name}</span> would replace the
                  saved project <span className="text-aura-text">{plan.overwrites.name}</span>, last edited{" "}
                  {fmtDate(plan.overwrites.updatedAtISO)}
                  {plan.overwrites.designHash ? (
                    <>
                      , design <span className="font-mono text-xs">{plan.overwrites.designHash.slice(0, 10)}…</span>
                    </>
                  ) : null}
                  .
                </p>
                <p className="mt-2 text-[0.9rem] leading-relaxed text-aura-text/75">
                  {plan.activeId === plan.overwrites.id
                    ? "That is the project you currently have open. Replacing it cannot be undone from here."
                    : "Replacing it cannot be undone from here."}{" "}
                  Keeping both writes the incoming project under its own identifier and leaves the saved one
                  exactly as it is.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className={quietButton} disabled={busy} onClick={() => void applyPlan("keep-both")}>
                    Keep both
                  </button>
                  <button type="button" className={dangerButton} disabled={busy} onClick={() => void applyPlan("overwrite")}>
                    Replace {plan.overwrites.name}
                  </button>
                  <button type="button" className={quietButton} onClick={() => setPlan(null)}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-3 text-[0.95rem] leading-relaxed">
                  <span className="text-aura-text">{plan.incoming.name}</span> is new to this browser. Nothing
                  saved here will be replaced, and it becomes the open project.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className={primaryButton} disabled={busy} onClick={() => void applyPlan("overwrite")}>
                    Add this project
                  </button>
                  <button type="button" className={quietButton} onClick={() => setPlan(null)}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </section>

      {message ? (
        <p role="status" className="mt-6 border-l-2 border-aura-emerald pl-4 text-sm leading-relaxed text-aura-text/80">
          {message}
        </p>
      ) : null}

      {/* --- the dashboard --- */}
      <div className="mt-8 grid gap-4">
        {!loaded ? (
          <p className="text-sm text-aura-text/65" aria-busy="true">
            Opening the local project database…
          </p>
        ) : library.storage || library.cleared ? (
          /* The card above already says why the list is empty. "No projects
             yet" underneath it would contradict "this browser held two". */
          null
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-hairline bg-aura-panel p-6">
            <p className="font-display text-lg tracking-[-0.01em]">No projects in this browser yet.</p>
            <p className="mt-2 max-w-xl text-[0.9rem] leading-relaxed text-aura-text/75">
              The first one starts with your goals and takes a few minutes. It saves itself here as you
              work, and stays here until you export it or clear this site&apos;s data.
            </p>
            <Link
              href="/start"
              className={`${primaryButton} mt-5`}
              data-cursor="Begin"
            >
              Start with your goals
            </Link>
          </div>
        ) : (
          rows.map((row) => {
            const project = library.projects.find((candidate) => candidate.id === row.id);
            if (!project) return null;
            const isActive = project.id === active?.id;
            return (
              <article
                key={row.id}
                data-project-stage={row.stageId}
                className={`rounded-xl border bg-aura-panel p-5 sm:p-6 ${
                  isActive ? "border-aura-emerald/45" : "border-hairline"
                }${row.archived ? " opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="aura-label">
                      {isActive ? "Open now" : row.archived ? "Archived" : "Saved in this browser"} ·{" "}
                      {row.journeyLabel}
                    </p>
                    <h2 className="mt-2 font-display text-[1.5rem] font-medium leading-tight tracking-[-0.02em]">
                      {row.name}
                    </h2>
                  </div>
                  <code className="font-mono text-[0.7rem] text-aura-text/55" title="Design fingerprint">
                    {row.designHashShort}…
                  </code>
                </div>

                <dl className="mt-5 grid gap-4 border-t border-hairline pt-4 sm:grid-cols-4">
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-label text-aura-text/55">Stage</dt>
                    <dd className="mt-1 text-[0.92rem]">
                      {row.stageLabel}
                      <span className="text-aura-text/60"> · {row.stageStatusLabel}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-label text-aura-text/55">Confirmed</dt>
                    <dd className="mt-1 text-[0.92rem]">
                      {row.stepsComplete} of {row.stepsTotal} steps
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-label text-aura-text/55">Blockers</dt>
                    <dd className={`mt-1 text-[0.92rem] ${row.openBlockers > 0 ? "text-aura-violet" : ""}`}>
                      {row.openBlockers === 0 ? "None open" : `${row.openBlockers} open`}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[0.62rem] uppercase tracking-label text-aura-text/55">Last edited</dt>
                    <dd className="mt-1 text-[0.92rem]">{fmtDate(row.lastEditedISO)}</dd>
                  </div>
                </dl>

                {row.nextAction ? (
                  <p className="mt-4 text-[0.88rem] leading-relaxed text-aura-text/75">
                    <span className="text-aura-text">Next · {row.nextAction.label}.</span>{" "}
                    {row.nextAction.reason}
                  </p>
                ) : (
                  <p className="mt-4 text-[0.88rem] leading-relaxed text-aura-text/75">
                    Every step is confirmed. Nothing is waiting on you.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {isActive ? (
                    <Link href="/build" className={primaryButton}>
                      Continue design
                    </Link>
                  ) : (
                    <button type="button" className={primaryButton} disabled={busy} onClick={() => void openProject(project)}>
                      Open project
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Download project"
                    className={quietButton}
                    onClick={() => plainDownload(project)}
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    aria-label="Export project encrypted"
                    className={quietButton}
                    disabled={busy}
                    onClick={() => void encryptedDownload(project)}
                  >
                    Encrypted export
                  </button>
                  <button
                    type="button"
                    aria-label="Duplicate project"
                    className={quietButton}
                    disabled={busy}
                    onClick={() => void duplicate(project)}
                  >
                    Duplicate
                  </button>
                  <button type="button" className={quietButton} disabled={busy} onClick={() => void toggleArchive(project)}>
                    {row.archived ? "Restore to active" : "Archive"}
                  </button>
                  <button
                    type="button"
                    aria-label="Delete project"
                    className={quietButton}
                    disabled={busy}
                    onClick={() => setDeleting(deleting === row.id ? null : row.id)}
                  >
                    Delete
                  </button>
                </div>

                {deleting === row.id ? (
                  <div role="alert" className="mt-4 rounded-lg border border-aura-violet/35 bg-aura-bg p-4">
                    <p className="text-[0.92rem] leading-relaxed">
                      Delete <span className="text-aura-text">{row.name}</span> from this browser for good?
                    </p>
                    <p className="mt-2 text-[0.88rem] leading-relaxed text-aura-text/75">
                      Its design, requirements, discovery records and quotes go with it. An export file you
                      already downloaded is unaffected and remains the only way back.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button type="button" className={dangerButton} disabled={busy} onClick={() => void confirmDelete(project)}>
                        Delete for good
                      </button>
                      <button type="button" className={quietButton} onClick={() => setDeleting(null)}>
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
