"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { hashAuraProject, type AuraProject } from "@/lib/project/document";
import {
  decryptAuraProjectFile,
  encryptAuraProjectFile,
  parseAuraProjectFile,
  projectFileJson,
} from "@/lib/project/file";
import { duplicateAuraProject, listAuraProjects } from "@/lib/project/store";
import { useAuraProject } from "./ProjectContext";

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

export default function ProjectCentre() {
  const { project: active, save } = useAuraProject();
  const [projects, setProjects] = useState<AuraProject[]>([]);
  const [passphrase, setPassphrase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => setProjects(await listAuraProjects()), []);
  useEffect(() => { void refresh(); }, [active, refresh]);

  async function duplicate(project: AuraProject) {
    setBusy(true);
    try {
      const copy = await duplicateAuraProject(project, `project-${crypto.randomUUID()}`, new Date());
      await save(copy);
      await refresh();
      setMessage("A separate recovery-safe copy is now active.");
    } finally { setBusy(false); }
  }

  async function toggleArchive(project: AuraProject) {
    await save({
      ...project,
      archivedAtISO: project.archivedAtISO ? null : new Date().toISOString(),
      updatedAtISO: new Date().toISOString(),
    });
    setMessage(project.archivedAtISO ? "Project restored to the active list." : "Project archived. Its data and backups were kept.");
  }

  async function encryptedDownload(project: AuraProject) {
    setMessage(null);
    try {
      const encrypted = await encryptAuraProjectFile(project, passphrase);
      downloadText(`${safeName(project.name)}.encrypted.aura-project.json`, encrypted);
      setMessage("Encrypted backup downloaded. Aura cannot recover a forgotten passphrase.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const marker = JSON.parse(text) as { format?: string };
      const project = marker.format === "aura-project-encrypted"
        ? await decryptAuraProjectFile(text, passphrase)
        : (() => {
            const parsed = parseAuraProjectFile(text);
            if (!parsed.ok) throw new Error(parsed.problem);
            return parsed.project;
          })();
      await save(project);
      await refresh();
      setMessage(`${project.name} was validated, imported, and made active.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="project-centre py-10 sm:py-14">
      <header>
        <p className="aura-label">Local-first project recovery</p>
        <h1>Your Aura projects</h1>
        <p>Projects stay in this browser unless you download a portable backup. Every import is validated before it can replace the active view.</p>
      </header>

      <section className="project-backup-bar" aria-labelledby="backup-heading">
        <div>
          <h2 id="backup-heading">Portable backup</h2>
          <p>Use a passphrase of at least eight characters for optional AES-256-GCM encryption.</p>
        </div>
        <label>Backup passphrase<input type="password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} autoComplete="new-password" /></label>
        <label className="project-import-button">
          Import project
          <input ref={input} aria-label="Import an Aura project file" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); }} />
        </label>
      </section>

      {message ? <p className="project-centre-message" role="status">{message}</p> : null}
      <div className="project-cards">
        {projects.length === 0 ? (
          <div className="project-card-empty"><p>No local projects yet.</p><Link href="/start">Start with your goals →</Link></div>
        ) : projects.map((project) => (
          <article className={`project-card${project.archivedAtISO ? " is-archived" : ""}`} key={project.id}>
            <div className="project-card-heading">
              <div><span>{project.id === active?.id ? "Active project" : "Saved locally"}</span><h2>{project.name}</h2></div>
              <code>{hashAuraProject(project).slice(0, 12)}…</code>
            </div>
            <dl>
              <div><dt>Route</dt><dd>{project.journey.replaceAll("-", " ")}</dd></div>
              <div><dt>Updated</dt><dd>{new Date(project.updatedAtISO).toLocaleDateString()}</dd></div>
              <div><dt>Design hash</dt><dd>{project.design.documentHash.slice(0, 12)}…</dd></div>
            </dl>
            <div className="project-card-actions">
              {project.id !== active?.id ? <button onClick={() => void save(project)}>Open project</button> : <Link href="/build">Continue design</Link>}
              <button aria-label="Download project" onClick={() => downloadText(`${safeName(project.name)}.aura-project.json`, projectFileJson(project))}>Download</button>
              <button disabled={busy} onClick={() => void encryptedDownload(project)}>Encrypt + download</button>
              <button aria-label="Duplicate project" disabled={busy} onClick={() => void duplicate(project)}>Duplicate</button>
              <button onClick={() => void toggleArchive(project)}>{project.archivedAtISO ? "Restore" : "Archive"}</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
