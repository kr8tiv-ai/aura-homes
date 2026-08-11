"use client";

/* ===========================================================================
   THE BUILDER — one HomeSpec, held in one place, read by everything.

   The founder's ask, in his words: "we have to create a builder that somebody
   can actually build their own smart homes, kind of like Nordic style type
   deal with beautiful polycarbonate glass ... and then they can go directly
   from a little thing that they're playing with all the way to production."

   That sentence is the whole architecture of this file. There is exactly ONE
   `HomeSpec` in the component. The 3D view reads it, the read-out reads it,
   the plan bridge reads it, the exporters read it. Nothing keeps a second
   copy, nothing derives a quantity `lib/builder/spec.ts` already defines, and
   nothing writes back a concept of its own. The toy and the drawing are the
   same object, or the promise is a lie.

   THREE DECISIONS WORTH THE COMMENT
   ---------------------------------
   1. HISTORY IS FREE BECAUSE THE SPEC IS IMMUTABLE. Every control returns a
      NEW spec (`edits.ts`), so undo is a stack of the old ones. Consecutive
      edits carrying the same `label` collapse into one step — otherwise
      dragging a width slider would cost forty presses of undo to get back.
      No timestamps are involved: the label is the only grouping signal, which
      keeps the whole thing deterministic.
   2. GEOMETRY DISPOSAL DISPOSES THE PREVIOUS BUILD, NEVER THE CURRENT ONE.
      The obvious `useEffect(() => () => disposeHome(home), [home])` is a trap
      under React StrictMode, which runs setup → cleanup → setup on mount:
      that cleanup frees the buffers the scene is about to draw with, and the
      house vanishes in development only. So the previous value is tracked in
      a ref and freed when it is superseded. The cost is one house's worth of
      buffers left to the garbage collector when the page unmounts, which
      happens as the WebGL context is being torn down anyway.
   3. THE DRAWING KNOWS WHICH SPEC MADE IT. `drawn` holds the spec alongside
      the handoff, so the page can say "this drawing is of an earlier version
      of your home" instead of showing a stale sheet as if it were current.
   =========================================================================== */

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type * as THREE from "three";
import { drawingSet, type DrawingRooms, type DrawingSetResult } from "@/lib/builder/drawings";
import { buildHome, disposeHome, type HomeGeometry } from "@/lib/builder/geometry";
import { defaultSpec, type HomeSpec } from "@/lib/builder/spec";
import { specFromLocation } from "@/lib/builder/share";
import { planFromSpec, type PlanHandoff } from "@/lib/builder/toPlan";
import DrawingSheets from "./DrawingSheets";
import ExportRow from "./ExportRow";
import PlanSheet from "./PlanSheet";
import Readout from "./Readout";
import SpecPanel, { type SunState } from "./SpecPanel";
import Viewport from "./Viewport";
import { sunPosition } from "./sun";
import { Button } from "./ui";

/* ------------------------------------------------------------- history */

interface EditorState {
  spec: HomeSpec;
  past: HomeSpec[];
  future: HomeSpec[];
  /** the label of the last edit, for coalescing — never persisted */
  label: string | null;
}

type Action =
  | { type: "edit"; spec: HomeSpec; label: string }
  | { type: "undo" }
  | { type: "redo" };

/** Deep enough to cover a session's worth of real decisions, shallow enough
 *  that a hundred specs never sit in memory. Each entry is plain data. */
const HISTORY_MAX = 80;

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "edit": {
      if (action.spec === state.spec) return state;
      const coalesce = action.label === state.label && state.past.length > 0;
      return {
        spec: action.spec,
        past: coalesce ? state.past : [...state.past, state.spec].slice(-HISTORY_MAX),
        future: [],
        label: action.label,
      };
    }
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (previous === undefined) return state;
      return {
        spec: previous,
        past: state.past.slice(0, -1),
        future: [state.spec, ...state.future].slice(0, HISTORY_MAX),
        // cleared, so the next edit always opens a fresh step
        label: null,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (next === undefined) return state;
      return {
        spec: next,
        past: [...state.past, state.spec].slice(-HISTORY_MAX),
        future: state.future.slice(1),
        label: null,
      };
    }
    default:
      return state;
  }
}

/* ------------------------------------------------------------ the output

   Both drawings are kept beside the SPEC that produced them, so the page can
   say "this is a drawing of an earlier version of your home" rather than
   showing a stale sheet as though it were current. */
interface Drawn {
  spec: HomeSpec;
  /** the plan engine's sheet, plus the account of what the translation cost */
  handoff: PlanHandoff;
  /** the eight-sheet set drawn from the model itself */
  set: DrawingSetResult;
  /** the issue date stamped into every title block */
  dateISO: string;
}

const initialState = (): EditorState => ({
  // Nobody meets an empty canvas: this is the Aura reference build, and it is
  // already a real, buildable thing.
  spec: defaultSpec(),
  past: [],
  future: [],
  label: null,
});

/* =========================================================================== */

export default function BuilderApp() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const { spec } = state;

  const [selectedVolumeId, setSelectedVolumeId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [sun, setSun] = useState<SunState>({ hour: 12, season: "winter" });
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [loadedFromLink, setLoadedFromLink] = useState(false);

  const houseRef: MutableRefObject<THREE.Group | null> = useRef<THREE.Group | null>(null);

  const edit = useCallback((next: HomeSpec, label: string) => {
    dispatch({ type: "edit", spec: next, label });
  }, []);

  /* ---- a shared design arrives as a URL fragment. Read once, on mount. */
  useEffect(() => {
    let alive = true;
    void specFromLocation().then((loaded) => {
      if (!alive || !loaded) return;
      // As an edit rather than as the initial state, so undo takes the visitor
      // back to the reference home instead of to a blank one.
      dispatch({ type: "edit", spec: loaded, label: "share-link" });
      setLoadedFromLink(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  /* ---- the model. Pure, deterministic, rebuilt on every change. */
  const home: HomeGeometry = useMemo(() => buildHome(spec), [spec]);
  const previous = useRef<HomeGeometry | null>(null);
  useEffect(() => {
    const old = previous.current;
    if (old && old !== home) disposeHome(old);
    previous.current = home;
  }, [home]);

  const sunPos = useMemo(() => sunPosition(sun.hour, sun.season), [sun]);

  /* ---- selection. Derived rather than stored, so a volume that has just
         been removed can never leave the panel pointing at nothing. */
  const activeVolume = spec.volumes.find((v) => v.id === selectedVolumeId) ?? spec.volumes[0] ?? null;
  const activeVolumeId = activeVolume?.id ?? null;

  const selectVolume = useCallback((id: string) => {
    setSelectedVolumeId(id);
    setSelectedOpeningId(null);
  }, []);

  /* ---- undo / redo, also on the keyboard, because this is an editor. */
  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      // Inside a text field the browser's own undo is the right one.
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      e.preventDefault();
      dispatch({ type: e.shiftKey ? "redo" : "undo" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---- the drawing */
  const stale = drawn !== null && drawn.spec !== spec;
  const generate = useCallback(() => {
    const handoff = planFromSpec(spec);

    /* The plan engine's solved rooms are handed STRAIGHT to the drawing set,
       so sheet A3 carries the same room program the floor plan below it does.
       Two drawings of one house that disagree about the rooms would be worse
       than one drawing; `DrawingRooms` is structurally typed for exactly this
       handoff, and the plan engine's frame (feet, origin top-left, +y down) is
       already the frame the sheet wants. */
    const plan = handoff.response?.plan ?? null;
    const rooms: DrawingRooms | null = plan
      ? {
          envelopeWidthFt: plan.width,
          envelopeDepthFt: plan.height,
          rooms: plan.rooms.map((r) => ({ name: r.name, x: r.x, y: r.y, w: r.w, h: r.h })),
        }
      : null;

    /* THE ONE CLOCK READ IN THE BUILDER, and it is not geometry: it is the
       issue date in a title block, which is a fact about when a drawing was
       produced. The drawing module refuses to read a clock itself precisely so
       that this is a parameter — hand it the same date and the same spec and
       the SVG is byte-identical. */
    const dateISO = new Date().toISOString().slice(0, 10);

    setDrawn({
      spec,
      handoff,
      set: drawingSet({ spec, dateISO, projectName: spec.name, rooms }),
      dateISO,
    });
  }, [spec]);

  return (
    <div className="space-y-6">
      {loadedFromLink ? (
        <p className="rounded-md border border-aura-teal px-4 py-3 text-xs leading-relaxed text-aura-text/75">
          This home was opened from a share link. Everything is editable, and undo puts the Aura
          reference build back.
        </p>
      ) : null}

      <Viewport
        home={home}
        sun={sunPos}
        hour={sun.hour}
        selectedId={activeVolumeId}
        onSelect={selectVolume}
        houseRef={houseRef}
      />

      <Readout spec={spec} summary={home.summary} warnings={home.warnings} />

      {/* ------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border aura-hairline px-5 py-4">
        <p className="text-xs leading-relaxed text-aura-text/55">
          {state.past.length === 0
            ? "Nothing changed yet. Every edit here is undoable, and nothing in this tool is a dead end."
            : `${state.past.length} step${state.past.length === 1 ? "" : "s"} back available · Ctrl+Z, Ctrl+Shift+Z`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={!canUndo}>
            Undo
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={!canRedo}>
            Redo
          </Button>
          <Button onClick={() => edit(defaultSpec(), "reset")} title="Back to the Aura reference build">
            Start over
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------ generate */}
      <section className="rounded-xl border border-aura-emerald p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="aura-label">Generate the drawing</p>
          {stale ? (
            <span className="rounded border border-aura-violet px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">
              Model changed since this sheet
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/75">
          The same object you have been dragging goes two ways at once. To the deterministic plan
          engine — the one the design page uses — which solves a room program and returns a
          dimensioned sheet at 1/4&quot; = 1&apos;-0&quot;, with every cost of that translation
          itemised, because it solves ONE rectangle and you may well have built something else. And
          to the drawing engine, which draws your model directly: site, foundation, roof plan, all
          four elevations, a building section and the schedules. Both run in this browser — no
          server, no key, no wait.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            data-cursor="Generate"
            /* Deliberately never disabled. Fed a model with no floor area the
               bridge returns a `blocked` note explaining why nothing was
               drawn — which is a better answer than a dead button. */
            className="rounded-full border border-aura-emerald bg-aura-emerald/10 px-6 py-2.5 font-mono text-xs uppercase tracking-label text-aura-emerald transition-colors hover:bg-aura-emerald/20"
          >
            {drawn ? (stale ? "Redraw from the current model" : "Draw it again") : "Generate the drawing"}
          </button>
          <span className="font-mono text-[0.65rem] uppercase tracking-label text-aura-text/45">
            Deterministic · the same home always draws the same sheet
          </span>
        </div>
        {/* THE HONESTY POLICY, next to the action rather than buried. */}
        <p className="mt-5 border-t aura-hairline pt-4 max-w-3xl text-xs leading-relaxed text-aura-text/60">
          This is a massing and layout tool. It is not a structural design, not an energy model, and
          not a permit set. Nothing here has been checked against a building code, sized by an
          engineer, or approved by anyone. A licensed designer and the trades&rsquo; engineers
          produce the drawings you build from — this is the study you take to them.
        </p>
      </section>

      {drawn ? (
        <>
          {/* The account of the translation leads, then the plan engine's own
              sheet, then the eight sheets drawn from the model itself. */}
          <PlanSheet handoff={drawn.handoff} />
          <DrawingSheets set={drawn.set} name={drawn.spec.name} dateISO={drawn.dateISO} />
        </>
      ) : null}

      {/* ------------------------------------------------------ controls */}
      <SpecPanel
        spec={spec}
        selectedVolumeId={activeVolumeId}
        selectedOpeningId={selectedOpeningId}
        onSelectVolume={selectVolume}
        onSelectOpening={setSelectedOpeningId}
        onEdit={edit}
        sun={sun}
        onSun={setSun}
      />

      <ExportRow spec={spec} houseRef={houseRef} onLoad={edit} />
    </div>
  );
}
