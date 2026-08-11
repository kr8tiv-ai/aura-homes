"use client";

/* ===========================================================================
   TAKE IT WITH YOU — four doors out, and what each one is actually for.

   A home you cannot get out of our software is a toy. Every writer here lives
   in `lib/builder/exportSpec.ts` and `lib/builder/share.ts`; this component
   only presses the buttons and prints, verbatim, the one-line `note` each
   artifact carries about itself — so what the page claims about a file is
   what the module that wrote it says about it.

   The glTF and OBJ exporters are pulled in with a dynamic `import()` inside
   those modules, so a visitor who never presses Download never pays for them.

   THE DISCLAIMER TRAVELS. It is written into the JSON, into the glTF `extras`
   beside the whole HomeSpec, and into the OBJ header — because a recipient who
   is emailed a .glb never saw this page.
   =========================================================================== */

import { useRef, useState, type MutableRefObject, type ReactNode } from "react";
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
import { specToShareUrl } from "@/lib/builder/share";
import type { HomeSpec } from "@/lib/builder/spec";
import { Button, Panel } from "./ui";

type Job = "glb" | "obj" | "json" | "link" | null;

export default function ExportRow({
  spec,
  houseRef,
  onLoad,
}: {
  spec: HomeSpec;
  /** the group holding the volumes and the deck — and nothing else */
  houseRef: MutableRefObject<THREE.Group | null>;
  onLoad: (spec: HomeSpec, label: string) => void;
}) {
  const [busy, setBusy] = useState<Job>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const finish = (a: ExportArtifact) => {
    downloadArtifact(a);
    setNote(`${a.filename} — ${a.note}`);
    setError(null);
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
      finish(job === "glb" ? await exportGlb(root, spec) : await exportObj(root, spec));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy("link");
    setError(null);
    setCopied(false);
    try {
      const url = await specToShareUrl(spec);
      setLink(url);
      setNote(
        `Share link — ${url.length} characters, the whole house in the URL fragment. A fragment is never sent to the server, so a shared design does not land in an access log.`,
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const open = async (file: File) => {
    setError(null);
    const text = await file.text();
    const loaded = parseSpecJson(text);
    if (!loaded) {
      setError(
        `${file.name} is not a house this build understands. The console names the exact field — nothing was loaded, because a half-read house is worse than no house.`,
      );
      return;
    }
    onLoad(loaded, `load:${file.name}`);
    setNote(`Opened ${file.name} — ${loaded.volumes.length} volume(s). Undo puts your previous home back.`);
  };

  return (
    <Panel
      label="Take it with you"
      hint="Four doors, in order of how much they preserve. Only the JSON round-trips back into this builder; the glTF is the one to hand to somebody who uses none of our software."
    >
      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <Door
            title="glTF 2.0 binary (.glb)"
            body="The model. One self-contained file — geometry, materials, and the whole HomeSpec riding along in the file's own metadata. A Khronos open standard: Blender, SketchUp, Rhino, Unreal, Unity, macOS Quick Look and every free web viewer read it. In metres, converted from the spec's feet at exactly 0.3048."
            action={
              <Button tone="loud" onClick={() => void model("glb")} disabled={busy !== null}>
                {busy === "glb" ? "Writing…" : "Download .glb"}
              </Button>
            }
          />
          <Door
            title="Wavefront OBJ (.obj)"
            body="The lowest common denominator — geometry only, no materials, no metadata. It exists because older CAD, student software and the one machine in every shop running something from 2009 read OBJ and nothing else. It always opens."
            action={
              <Button onClick={() => void model("obj")} disabled={busy !== null}>
                {busy === "obj" ? "Writing…" : "Download .obj"}
              </Button>
            }
          />
          <Door
            title="HomeSpec (.json)"
            body="The source of truth: every dimension and every opening in feet, with the schema version stamped on it. The only export that re-opens in this builder, and the only one a human can read and correct in a text editor."
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setBusy("json");
                    finish(exportSpecJson(spec));
                    setBusy(null);
                  }}
                  disabled={busy !== null}
                >
                  Download .json
                </Button>
                <Button onClick={() => fileInput.current?.click()} disabled={busy !== null}>
                  Open a .json
                </Button>
              </div>
            }
          />
          <Door
            title="Share link"
            body="The whole house compressed into a URL fragment — no account, no server, nothing stored. Send it to a partner, a lender or a designer and they open the same home in their own browser. A link made by a newer version of the builder is refused out loud rather than half-read."
            action={
              <Button tone="loud" onClick={() => void share()} disabled={busy !== null}>
                {busy === "link" ? "Encoding…" : copied ? "Copied — copy again" : "Copy share link"}
              </Button>
            }
          />
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

        <p className="border-t aura-hairline pt-4 text-xs leading-relaxed text-aura-text/55">
          Every file carries this line inside it: &ldquo;{EXPORT_DISCLAIMER}&rdquo;
        </p>
      </div>
    </Panel>
  );
}

function Door({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 rounded-md border aura-hairline p-4">
      <div>
        <p className="text-sm text-aura-text">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-aura-text/60">{body}</p>
      </div>
      <div>{action}</div>
    </div>
  );
}
