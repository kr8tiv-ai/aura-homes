"use client";

import { useState } from "react";

import type { BuilderDocument } from "@/lib/builder/document";
import {
  createBuilderOrderSnapshot,
  saveBuilderOrderSnapshot,
} from "@/lib/builder/orderSnapshot";
import { Button, Panel } from "./ui";

type Destination = "quote" | "concierge" | "land";

export default function BuilderOrderHandoff({ document }: { document: BuilderDocument }) {
  const [busy, setBusy] = useState<Destination | null>(null);
  const [error, setError] = useState<string | null>(null);

  const continueWith = async (destination: Destination) => {
    setBusy(destination);
    setError(null);
    try {
      const snapshot = createBuilderOrderSnapshot(document, new Date());
      await saveBuilderOrderSnapshot(snapshot);
      const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      window.location.assign(
        destination === "land"
          ? `${base}/land?project=${encodeURIComponent(snapshot.projectId)}`
          : `${base}/concierge?project=${encodeURIComponent(snapshot.projectId)}&intent=${destination}`,
      );
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : String(cause)} Nothing was sent or overwritten. Download the .aura.json project below for a portable recovery copy.`,
      );
      setBusy(null);
    }
  };

  return (
    <Panel
      label="Continue with this design"
      hint="Aura creates an immutable, local order snapshot at the current design hash. The full project stays in this browser; only its hash belongs in the payment and registry flow."
    >
      <div className="flex flex-wrap gap-3">
        <Button
          tone="loud"
          disabled={busy !== null}
          onClick={() => void continueWith("quote")}
        >
          {busy === "quote" ? "Saving handoff…" : "Continue to quote"}
        </Button>
        <Button disabled={busy !== null} onClick={() => void continueWith("concierge")}>
          {busy === "concierge" ? "Saving handoff…" : "Take this design to concierge"}
        </Button>
        <Button disabled={busy !== null} onClick={() => void continueWith("land")}>
          {busy === "land" ? "Saving handoff…" : "Find land for this design"}
        </Button>
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-aura-text/60">
        Quotes are time-limited Alberta estimates from the open cost model. Land, site conditions,
        supplier pricing, engineering, permits and GST remain explicit assumptions or exclusions;
        the district land gate still runs before any deposit action.
      </p>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-aura-violet px-4 py-3 text-xs leading-relaxed text-aura-violet"
        >
          {error}
        </p>
      ) : null}
    </Panel>
  );
}
