"use client";

/* ===========================================================================
   THE BUILDER — one BuilderDocument, held in one place, read by everything.

   The founder's ask, in his words: "we have to create a builder that somebody
   can actually build their own smart homes, kind of like Nordic style type
   deal with beautiful polycarbonate glass ... and then they can go directly
   from a little thing that they're playing with all the way to production."

   That sentence is the whole architecture of this file. There is exactly one
   versioned `BuilderDocument` in the component. The 3D view, 2D plan, library,
   share codec and project export all read that same immutable value. HomeSpec
   remains its legacy shell-geometry field while BuildingGraph is introduced.

   DURABLE DETAILS LIVE BESIDE THE LEGACY SPEC, INSIDE THE DOCUMENT
   ----------------------------------------------------------------
   The plan editor, surface picker, fixture palette and comfort panel produce
   values HomeSpec cannot hold. BuilderDocument owns them explicitly:

   · PARTITIONS (`lib/builder/walls.ts`). Interior walls. `spec.ts` has no
     field for them and `validateHomeSpec` rebuilds a spec from known
     primitives, so a `partitions` key hung on a HomeSpec would be dropped
     silently by every share link and every JSON import. They travel as their
     own value with their own codec.
   · FINISHES (`lib/builder/surfaces.ts`). A map of surface id → material.
     Same story, same reason.
   · FIXTURES (`lib/builder/fixtures.ts`). The stove, the tub, the battery
     bank and what has to stay clear around them. Same story again, and it
     carries its own `FIXTURES_VERSION`.

   Every durable value is in the same history entry and survives autosave,
   library storage, share links and `.aura.json`. The professional drawing,
   DXF and IFC writers still derive from HomeSpec and state that limitation at
   their actions until they move to BuildingGraph.

   FIVE DECISIONS WORTH THE COMMENT
   --------------------------------
   1. HISTORY IS FREE BECAUSE THE DOCUMENT IS IMMUTABLE. Every control returns
      a NEW value (`edits.ts`, `walls.ts`, `surfaces.ts`), so undo is a stack
      of the old ones. Consecutive edits carrying the same `label` collapse
      into one step — otherwise dragging a width slider would cost forty
      presses of undo to get back. No timestamps are involved: the label is the
      only grouping signal, which keeps the whole thing deterministic. It is
      also what makes a plan drag ONE step even though it dispatches twice, a
      spec change and a partition change under the same label.
   2. PRUNING HAPPENS IN THE REDUCER, AND UNDO STILL GIVES THE PAINT BACK.
      `edits.ts` mints the LOWEST free id, so deleting `vol2` frees the name
      and the next volume added takes it — and a finish left behind by the
      deleted volume would land on the new one. `pruneOverrides` runs on every
      spec change to stop that. `surfaces.ts` names the cost of doing this
      (delete a volume, undo, and the colour is gone) and the escape from it:
      keep the override map in the same history entry as the spec. That is
      exactly what happens here, so the entry BEFORE the delete still holds the
      un-pruned map and undo restores both together. Partitions get the same
      treatment through `reconcilePartitions`.
   3. GEOMETRY DISPOSAL DISPOSES THE PREVIOUS BUILD, NEVER THE CURRENT ONE.
      The obvious `useEffect(() => () => disposeHome(home), [home])` is a trap
      under React StrictMode, which runs setup → cleanup → setup on mount:
      that cleanup frees the buffers the scene is about to draw with, and the
      house vanishes in development only. So the previous value is tracked in
      a ref and freed when it is superseded. The cost is one house's worth of
      buffers left to the garbage collector when the page unmounts, which
      happens as the WebGL context is being torn down anyway.
   4. THE 3D CANVAS STAYS MOUNTED IN 2D MODE. The toggle hides it with CSS
      rather than unmounting it, because `houseRef` — the group the .glb and
      .obj exporters are handed — only exists while the canvas does. Unmounting
      it would make "Download .glb" fail with "the 3D view has not finished
      mounting yet" for anybody who had switched to the plan. `frameloop`
      is `"demand"`, so a hidden canvas costs nothing per frame.
   5. THE DRAWING KNOWS WHICH SPEC MADE IT. `drawn` holds the spec alongside
      the handoff, so the page can say "this drawing is of an earlier version
      of your home" instead of showing a stale sheet as if it were current.
   6. THE WORKSPACES ARE TABS, AND THE REASON IS DENSITY. Six panels stacked
      under the model is a page nobody reaches the bottom of, and the two
      things at the bottom would be the export row and the library — the two
      that finish the job. So the model, the read-out, the undo bar and,
      deliberately, the CLEARANCE CLASHES are always on screen, and everything
      else is behind one of six tabs.

      Which tabs are HIDDEN and which are UNMOUNTED is a real decision rather
      than a style. A tab whose panel holds state a switch must not destroy is
      hidden with CSS: the export row's round-trip verdict cost a press to
      produce, `DrawingSheets` remembers which sheet you were reading, and the
      project library owns the autosave loop. The three children that recompute
      on every spec change whether or not anybody is looking — `AxonSheet`'s
      hidden-line pass (~27 ms), `SemanticExport`'s live round trip (5–29 ms,
      both figures measured by their own modules) and `ComfortPanel`, whose
      every figure comes from a report that runs the deterministic plan solve —
      are conditionally MOUNTED inside their pane, so a slider drag two tabs
      away costs nothing. `ComfortPanel` can afford to be unmounted precisely
      because it holds no state of its own: the targets, the season and the
      heatmap toggle all live here.

   8. COMFORT ASSUMPTIONS ARE DURABLE. Conditions and room targets participate
      in undo, sharing, storage, export and hashing. Active season and heatmap
      visibility remain transient because they only change the current view.
   7. THE LIBRARY IS LIVE BEFORE ANYBODY OPENS IT, and a recovery prompt
      nobody sees is not a prompt. `ProjectLibrary` performs a read-before-write
      handshake on mount and holds autosaving until the visitor decides, which
      only works if it is mounted from the first render — so it is, hidden.
      This component then asks the store ONCE, for one purpose: if the autosave
      slot holds something other than what is on screen, the library tab is the
      one that opens. It decides nothing and restores nothing. Restoring stays
      a press, and it arrives through the same `load` action a share link does,
      so Ctrl+Z undoes it like anything else.
   =========================================================================== */

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type * as THREE from "three";
import {
  SEASON_LABEL,
  comfortPlates,
  comfortReport,
  fmt0,
  fmt1,
  type Season,
} from "@/lib/builder/comfort";
import {
  defaultBuilderDocument,
  discardQuarantinedEntry,
  reconcileBuilderDocumentSpec,
  restoreQuarantinedEntry,
  type BuilderDocument,
  type QuarantineEntry,
} from "@/lib/builder/document";
import { drawingSet, type DrawingRooms, type DrawingSetResult } from "@/lib/builder/drawings";
import { buildHome, disposeHome, type HomeGeometry } from "@/lib/builder/geometry";
import type { HomeSpec } from "@/lib/builder/spec";
import { documentFromLocation } from "@/lib/builder/share";
import {
  buildSurfaceIndex,
  countOverrides,
  type SurfaceId,
  type SurfaceIndex,
  type SurfaceOverrides,
} from "@/lib/builder/surfaces";
import {
  fitPartition,
  structThicknessOf,
  type Partition,
} from "@/lib/builder/walls";
import {
  disposeFixtureGeometry,
  reSnap,
  type FixtureGeometry,
  type FixturePlacement,
  type FixtureSet,
  type FloorPlacement,
  type PlacedFixture,
  type RoofPlacement,
  type WallPlacement,
} from "@/lib/builder/fixtures";
import { documentSignature, readAutosave } from "@/lib/builder/store";
import { planFromSpec, type PlanHandoff } from "@/lib/builder/toPlan";
import AxonSheet from "./AxonSheet";
import ComfortPanel from "./ComfortPanel";
import DrawingSheets from "./DrawingSheets";
import ExportRow from "./ExportRow";
import FixturePalette, { FixtureLayer, useFixtureGeometry } from "./FixturePalette";
import Plan2D from "./Plan2D";
import PlanSheet from "./PlanSheet";
import ProjectLibrary from "./ProjectLibrary";
import Readout from "./Readout";
import SpecPanel, { type SunState } from "./SpecPanel";
import SurfacePicker from "./SurfacePicker";
import Viewport from "./Viewport";
import { sunPosition } from "./sun";
import { Button, Segmented } from "./ui";

/* `exportSemantic.ts` is the ifcJSON writer, its reader, and a live round-trip
   checker. Nobody who never opens the export tab should download one byte of
   it, so it is a `next/dynamic` boundary — the same bargain `ExportRow` makes
   for the DXF and IFC writers and for the DXF preview. */
const SemanticExport = dynamic(() => import("./SemanticExport"), {
  ssr: false,
  loading: () => (
    <p className="aura-label animate-pulse text-aura-text/45">Loading the semantic writer…</p>
  ),
});

/* ------------------------------------------------------------- the document

   Three immutable values that always move together. Anything that goes in
   here has to be safe to hold eighty copies of: plain data, no three.js
   objects, no closures, nothing that owns a GPU buffer. */

export type EditorDoc = BuilderDocument;

function quarantineEntryLabel(entry: QuarantineEntry): string {
  switch (entry.kind) {
    case "partition":
      return `Partition ${entry.value.id}`;
    case "finish":
      return `Finish on ${entry.value.surfaceId}`;
    case "fixture":
      return `Fixture ${entry.value.id}`;
    case "comfort-target":
      return `Comfort target for ${entry.value.roomId}`;
  }
}

interface EditorState {
  doc: EditorDoc;
  past: EditorDoc[];
  future: EditorDoc[];
  /** the label of the last edit, for coalescing — never persisted */
  label: string | null;
}

type Action =
  | { type: "edit"; spec: HomeSpec; label: string }
  | { type: "partitions"; partitions: Partition[]; label: string }
  | { type: "surfaces"; overrides: SurfaceOverrides; label: string }
  | { type: "fixtures"; fixtures: FixtureSet; label: string }
  | { type: "comfort"; comfort: BuilderDocument["comfort"]; label: string }
  | { type: "load"; doc: EditorDoc; label: string }
  | { type: "undo" }
  | { type: "redo" };

/** Deep enough to cover a session's worth of real decisions, shallow enough
 *  that a hundred documents never sit in memory. Each entry is plain data. */
const HISTORY_MAX = 80;

/**
 * Partitions pulled back inside a spec that just changed under them.
 *
 * A partition is stored in its VOLUME's local frame, so moving the mass takes
 * the rooms with it for free — but shrinking the mass with a slider on the
 * panel below would leave an interior wall hanging outside the shell. `Plan2D`
 * already refits during its own drags; this is the same guarantee for every
 * other way the spec can change.
 *
 * IDENTITY IS PRESERVED WHEN NOTHING MOVED. The same array comes back out if
 * no partition needed correcting, so a spec edit that does not touch the plan
 * does not invalidate every memo downstream of it.
 */
function reconcilePartitions(spec: HomeSpec, list: Partition[]): Partition[] {
  const th = structThicknessOf(spec);
  let changed = false;
  const out = list.map((p) => {
    const v = spec.volumes.find((x) => x.id === p.volumeId);
    if (!v) return p;
    const fitted = fitPartition(v, p, th);
    // null means the volume has no room left at all. `fitPartition` documents
    // that as a decision to hand back, never a silent delete — so the
    // partition is kept where it was and comes right again when the volume
    // grows back.
    if (fitted === null) return p;
    const moved =
      fitted.atFt !== p.atFt ||
      fitted.fromFt !== p.fromFt ||
      fitted.toFt !== p.toFt ||
      (fitted.door?.atFt ?? null) !== (p.door?.atFt ?? null) ||
      (fitted.door?.widthFt ?? null) !== (p.door?.widthFt ?? null);
    if (moved) changed = true;
    return moved ? fitted : p;
  });
  return changed ? out : list;
}

/* ---------------------------------------------------------- fixture re-snap

   `fixtures.ts` states it plainly: "Re-snap every fixture. Call it once
   whenever the HomeSpec changes." The rule that module keeps is that nothing
   is ever outside the envelope, and the reason the integrator has to make the
   call is that a volume can shrink, a roof can change form, and a wall can
   stop being built underneath a fixture that was perfectly legal a moment ago.

   WHY NOT `reSnapAll`, WHICH IS RIGHT THERE. Two reasons, and both matter:

   · IT DESTROYS IDENTITY. `reSnapAll` rebuilds every item unconditionally, so
     typing one character in the project name — which is a spec edit — would
     hand `useFixtureGeometry` a brand-new FixtureSet and rebuild every mesh in
     the scene for nothing. Re-snapping is documented as idempotent, so an item
     that comes back identical keeps its old object here and the memo holds.
   · IT WOULD MAKE EVERY SPEC EDIT A FIXTURE EDIT. `commit` compares by
     identity; a always-new set means no spec change could ever be a no-op.

   WHAT THIS DELIBERATELY DOES NOT DO IS DELETE. A fixture pointing at a volume
   that no longer exists comes back from `reSnap` untouched, and stays in the
   document — see the note on `withSpec`. */

/** Field-for-field, so an idempotent re-snap is recognised as the no-op it is.
 *  Deliberately not a JSON compare: key order is not part of the contract. */
function samePlacement(a: FixturePlacement, b: FixturePlacement): boolean {
  if (a.mount !== b.mount) return false;
  if (a.mount === "floor") {
    const q = b as FloorPlacement;
    if (a.host.kind !== q.host.kind) return false;
    if (a.host.kind === "volume" && q.host.kind === "volume" && a.host.volumeId !== q.host.volumeId) {
      return false;
    }
    return a.x === q.x && a.z === q.z && a.rotationDeg === q.rotationDeg;
  }
  if (a.mount === "wall") {
    const q = b as WallPlacement;
    return (
      a.volumeId === q.volumeId &&
      a.wall === q.wall &&
      a.offsetFt === q.offsetFt &&
      a.heightFt === q.heightFt &&
      a.face === q.face
    );
  }
  const q = b as RoofPlacement;
  return a.volumeId === q.volumeId && a.planeIndex === q.planeIndex && a.a === q.a && a.s === q.s;
}

function reconcileFixtures(spec: HomeSpec, set: FixtureSet): FixtureSet {
  let changed = false;
  const items: PlacedFixture[] = set.items.map((item) => {
    const placement = reSnap(spec, item);
    if (samePlacement(item.placement, placement)) return item;
    changed = true;
    return { ...item, placement };
  });
  return changed ? { ...set, items } : set;
}

/** One history step. Coalescing is by label and by label only. */
function commit(state: EditorState, doc: EditorDoc, label: string): EditorState {
  if (
    doc.spec === state.doc.spec &&
    doc.partitions === state.doc.partitions &&
    doc.finishes === state.doc.finishes &&
    doc.fixtures === state.doc.fixtures &&
    doc.comfort === state.doc.comfort &&
    doc.quarantine === state.doc.quarantine
  ) {
    return state;
  }
  const coalesce = label === state.label && state.past.length > 0;
  return {
    doc,
    past: coalesce ? state.past : [...state.past, state.doc].slice(-HISTORY_MAX),
    future: [],
    label,
  };
}

/**
 * The spec changed, so the things stored beside it are re-checked against it
 * in the SAME step — see decision 2 in the header.
 *
 * FIXTURES ARE DELIBERATELY NOT PRUNED HERE, and that is `fixtures.ts`'s call
 * rather than an omission: `resolveFixtures` already handles a placement that
 * points at part of the home which no longer exists by declining to draw it
 * and saying so in a warning, instead of deleting it. A stove that stops being
 * drawn because a volume was shrunk comes back when the volume does, and the
 * palette reports the issue meanwhile. Deleting it here would throw that away.
 *
 * THEY ARE RE-SNAPPED, THOUGH, because that is a different question and
 * `fixtures.ts` is explicit that the integrator has to ask it. `resolveFixtures`
 * snaps internally, so the SCENE was always right; what drifted without this
 * was the STORED placement the palette's sliders read back — shrink a volume
 * and the "East–west" field would still read 14 ft on a slider that now stops
 * at 9. The number you are shown and the object you are looking at have to be
 * the same fact. `reconcileFixtures` preserves object identity when a re-snap
 * changes nothing, so this costs a spec edit no rebuilt geometry.
 */
function withSpec(doc: EditorDoc, spec: HomeSpec): EditorDoc {
  const reconciled = reconcileBuilderDocumentSpec(doc, spec);
  return {
    ...reconciled,
    partitions: reconcilePartitions(reconciled.spec, reconciled.partitions),
    fixtures: reconcileFixtures(reconciled.spec, reconciled.fixtures),
  };
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "edit": {
      if (action.spec === state.doc.spec) return state;
      return commit(state, withSpec(state.doc, action.spec), action.label);
    }
    case "partitions": {
      if (action.partitions === state.doc.partitions) return state;
      return commit(state, { ...state.doc, partitions: action.partitions }, action.label);
    }
    case "surfaces": {
      if (action.overrides === state.doc.finishes) return state;
      return commit(state, { ...state.doc, finishes: action.overrides }, action.label);
    }
    case "fixtures": {
      if (action.fixtures === state.doc.fixtures) return state;
      return commit(state, { ...state.doc, fixtures: action.fixtures }, action.label);
    }
    case "comfort": {
      if (action.comfort === state.doc.comfort) return state;
      return commit(state, { ...state.doc, comfort: action.comfort }, action.label);
    }
    case "load": {
      // A house off a link or off somebody's disk is untrusted in exactly the
      // same way, so what arrived with it is reconciled against it before it
      // is allowed to become the document.
      return commit(state, withSpec(action.doc, action.doc.spec), action.label);
    }
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (previous === undefined) return state;
      return {
        doc: previous,
        past: state.past.slice(0, -1),
        future: [state.doc, ...state.future].slice(0, HISTORY_MAX),
        // cleared, so the next edit always opens a fresh step
        label: null,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (next === undefined) return state;
      return {
        doc: next,
        past: [...state.past, state.doc].slice(-HISTORY_MAX),
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
  // Nobody meets an empty canvas: this is the Aura reference build, and it
  // is already a real, buildable thing.
  doc: defaultBuilderDocument(),
  past: [],
  future: [],
  label: null,
});

type ViewMode = "3d" | "2d";

const VIEW_MODES: ReadonlyArray<{ id: ViewMode; label: string; title: string }> = [
  {
    id: "3d",
    label: "3D model",
    title: "Orbit the home, move the sun, paint surfaces and click a fixture to edit it",
  },
  { id: "2d", label: "2D plan", title: "Push walls, drag corners, place openings, draw partitions" },
];

/* ------------------------------------------------------------ the workspaces

   Six tabs under one always-visible model. See decision 6 in the header for
   why this is tabs rather than six more panels, and for which of them are
   hidden rather than unmounted. */
type Workspace = "shape" | "fixtures" | "comfort" | "drawings" | "export" | "library";

const WORKSPACES: ReadonlyArray<{ id: Workspace; label: string; hint: string }> = [
  { id: "shape", label: "Shape", hint: "Volumes, roofs, openings, the deck and the sun" },
  {
    id: "fixtures",
    label: "Fixtures",
    hint: "Stove, tub, cistern, battery, array — and what has to stay clear",
  },
  {
    id: "comfort",
    label: "Comfort",
    hint: "Per-room targets, checked against conditions you state — not predicted",
  },
  {
    id: "drawings",
    label: "Drawings",
    hint: "The plan engine's sheet, the eight-sheet set, the axonometric",
  },
  { id: "export", label: "Export", hint: "Seven files — and the DXF proved by reading it back" },
  { id: "library", label: "Library", hint: "Save, reopen, duplicate, and survive a closed tab" },
];

/** Which surface ids differ between two override maps. Used only to LABEL the
 *  history step, so repainting one wall four times is one undo and painting
 *  four different walls is four. */
function changedSurfaces(a: SurfaceOverrides, b: SurfaceOverrides): string[] {
  const out: string[] = [];
  const seen: Record<string, true> = {};
  for (const k of Object.keys(a)) {
    seen[k] = true;
    if (a[k] !== b[k]) out.push(k);
  }
  for (const k of Object.keys(b)) {
    if (seen[k] !== true && a[k] !== b[k]) out.push(k);
  }
  return out;
}

/**
 * The id of the ONE fixture an edit changed, or null when it changed more than
 * one, added one, or removed one.
 *
 * Same job as `changedSurfaces` and for the same reason: `FixturePalette`
 * hands over the whole next set with no notion of a history step, and dragging
 * a stove's clearance slider must cost one undo rather than forty. Compared by
 * value rather than by object identity, because a panel that rebuilds its
 * items on every keystroke would otherwise report every fixture as changed and
 * every drag would open a new step.
 */
function singleFixtureEdit(a: FixtureSet, b: FixtureSet): string | null {
  if (a.items.length !== b.items.length) return null;
  let only: string | null = null;
  for (let i = 0; i < a.items.length; i++) {
    const x = a.items[i];
    const y = b.items[i];
    if (x.id !== y.id) return null;
    if (x === y) continue;
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (only !== null) return null;
    only = x.id;
  }
  return only;
}

/* =========================================================================== */

export default function BuilderApp() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const {
    spec,
    partitions,
    finishes: overrides,
    fixtures,
    comfort: comfortSettings,
  } = state.doc;

  const [mode, setMode] = useState<ViewMode>("3d");
  const [workspace, setWorkspace] = useState<Workspace>("shape");
  const [selectedVolumeId, setSelectedVolumeId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [pickedSurface, setPickedSurface] = useState<SurfaceId | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [showClearances, setShowClearances] = useState(true);
  const [sun, setSun] = useState<SunState>({ hour: 12, season: "winter" });

  /* ---- comfort view state. The assumptions and per-room targets are part of
         the durable document; season and heatmap visibility are only ways of
         viewing those values and remain transient.

         The heatmap starts OFF. A model that opens painted in comfort colours
         is a model that stops reading as a house, and the first thing anybody
         needs from this page is the house. */
  const [comfortSeason, setComfortSeason] = useState<Season>("winter");
  const [heatmap, setHeatmap] = useState(false);
  const [quarantineNote, setQuarantineNote] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const [loadedFromLink, setLoadedFromLink] = useState(false);

  const houseRef: MutableRefObject<THREE.Group | null> = useRef<THREE.Group | null>(null);
  /* A counter for history labels that must not collide. UI-only, never
     persisted, so nothing about the geometry or the export depends on it. */
  const gesture = useRef(0);

  const edit = useCallback((next: HomeSpec, label: string) => {
    dispatch({ type: "edit", spec: next, label });
  }, []);

  const editPartitions = useCallback((next: Partition[], label: string) => {
    dispatch({ type: "partitions", partitions: next, label });
  }, []);

  /* `SurfacePicker` hands over the whole next map with no label — it has no
     idea what a history step is, and should not. The label is derived from
     which ids actually changed, which is what makes repainting the same wall
     coalesce and painting a different one open a new step. */
  const editSurfaces = useCallback(
    (next: SurfaceOverrides) => {
      const changed = changedSurfaces(overrides, next);
      let label: string;
      if (changed.length === 1) {
        label = `surface:${changed[0]}`;
      } else {
        gesture.current += 1;
        label = `surfaces:${gesture.current}`;
      }
      dispatch({ type: "surfaces", overrides: next, label });
    },
    [overrides],
  );

  const editFixtures = useCallback(
    (next: FixtureSet) => {
      const only = singleFixtureEdit(fixtures, next);
      let label: string;
      if (only !== null) {
        label = `fixture:${only}`;
      } else {
        gesture.current += 1;
        label = `fixtures:${gesture.current}`;
      }
      dispatch({ type: "fixtures", fixtures: next, label });
    },
    [fixtures],
  );

  const editComfort = useCallback((next: BuilderDocument["comfort"]) => {
    dispatch({ type: "comfort", comfort: next, label: "comfort:settings" });
  }, []);

  const restoreQuarantined = useCallback(
    (index: number) => {
      const restored = restoreQuarantinedEntry(state.doc, index);
      if (!restored.ok) {
        setQuarantineNote(restored.problem);
        return;
      }
      const entry = state.doc.quarantine.entries[index];
      dispatch({
        type: "load",
        doc: restored.document,
        label: `quarantine:restore:${entry?.kind ?? "item"}:${index}`,
      });
      setQuarantineNote(`${entry ? quarantineEntryLabel(entry) : "Item"} restored.`);
    },
    [state.doc],
  );

  const discardQuarantined = useCallback(
    (index: number) => {
      const entry = state.doc.quarantine.entries[index];
      dispatch({
        type: "load",
        doc: discardQuarantinedEntry(state.doc, index),
        label: `quarantine:discard:${entry?.kind ?? "item"}:${index}`,
      });
      setQuarantineNote(
        `${entry ? quarantineEntryLabel(entry) : "Item"} permanently discarded. Undo can still restore it.`,
      );
    },
    [state.doc],
  );

  /* ---- a complete shared project arrives as a URL fragment. Read once, on
         mount. Legacy HomeSpec-only links are migrated at the codec boundary. */
  useEffect(() => {
    let alive = true;
    void documentFromLocation().then((loaded) => {
      if (!alive || !loaded) return;
      // As an edit rather than as the initial state, so undo takes the visitor
      // back to the reference home instead of to a blank one.
      dispatch({
        type: "load",
        doc: loaded,
        label: "share-link",
      });
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

  /* ---- every nameable surface on that model, and the geometry → surface map
         a click is resolved through. One pass over about thirty parts, so it
         is rebuilt with the geometry rather than cached against it. */
  const surfaceIndex: SurfaceIndex = useMemo(() => buildSurfaceIndex(home, spec), [home, spec]);

  /* ---- the fixtures, resolved against the shell and then built. The
         resolution is passed to the palette as well as used here, so the panel
         and the scene can never disagree about what collides with what —
         `FixturePalette` would otherwise resolve a second time and two answers
         to one question is how a clearance warning ends up contradicting the
         red box next to it. Disposal follows the same previous-value rule
         `home` does, and for the same StrictMode reason. */
  const { resolution: fixtureResolution, geometry: fixtureGeometry } = useFixtureGeometry(
    spec,
    fixtures,
    showClearances,
  );
  const previousFixtures = useRef<FixtureGeometry | null>(null);
  useEffect(() => {
    const old = previousFixtures.current;
    if (old && old !== fixtureGeometry) disposeFixtureGeometry(old);
    previousFixtures.current = fixtureGeometry;
  }, [fixtureGeometry]);

  /* A clearance that is only visible on the tab that made it is a clearance
     nobody reads. These two are hoisted out of the palette and onto the page. */
  const clashes = useMemo(
    () => fixtureResolution.issues.filter((i) => i.severity === "blocked"),
    [fixtureResolution],
  );
  const worthChecking = useMemo(
    () => fixtureResolution.issues.filter((i) => i.severity === "check"),
    [fixtureResolution],
  );

  const sunPos = useMemo(() => sunPosition(sun.hour, sun.season), [sun]);

  /* ---- the comfort report, behind a gate.

         Same discipline decision 6 applies to `AxonSheet` and
         `SemanticExport`, and for the same reason: `comfortReport` runs the
         deterministic plan solve, so it re-runs on every spec change. That is
         worth paying while somebody is reading comfort figures, while the
         heatmap is painting them, or while the export tab is open and about
         to write them into a file — and worth nothing at all while they are
         dragging a width slider two tabs away.

         `null` here is not "no comfort in the export": `exportPro` and
         `exportSemantic` derive the defaults when the option is OMITTED, so
         the export row hands them `undefined` rather than this null. */
  const comfortWanted = heatmap || workspace === "comfort" || workspace === "export";
  const comfort = useMemo(
    () => (comfortWanted ? comfortReport(spec, comfortSettings) : null),
    [comfortWanted, spec, comfortSettings],
  );

  /* The overlay the viewport draws, built here so the frame change and the
     season choice live beside each other and the viewport stays a renderer.
     The conditions travel WITH the plates — a colour scale on screen without
     the assumption that produced it is the one thing `comfort.ts` exists to
     prevent, so the legend cannot be rendered without them. */
  const comfortOverlay = useMemo(() => {
    if (!heatmap || !comfort || !comfort.available) return null;
    const winter = comfortSeason === "winter";
    const t = winter ? comfort.conditions.winterIndoorC : comfort.conditions.summerIndoorC;
    const rh = winter ? comfort.conditions.winterRhPct : comfort.conditions.summerRhPct;
    return {
      plates: comfortPlates(comfort, comfortSeason),
      conditions: `assumed ${fmt1(t)} °C · ${fmt0(rh)} %RH · ${comfort.rooms.length} solved rooms`,
      seasonLabel: SEASON_LABEL[comfortSeason],
    };
  }, [heatmap, comfort, comfortSeason]);

  /* ---- selection. Derived rather than stored, so a volume that has just
         been removed can never leave the panel pointing at nothing. */
  const activeVolume = spec.volumes.find((v) => v.id === selectedVolumeId) ?? spec.volumes[0] ?? null;
  const activeVolumeId = activeVolume?.id ?? null;

  const selectVolume = useCallback((id: string) => {
    setSelectedVolumeId(id);
    setSelectedOpeningId(null);
  }, []);

  /* A fixture removed from the set — or one that stopped resolving because the
     volume it stood in went away — must not leave the editor pointing at
     nothing. Derived for the same reason `activeVolume` is. */
  const activeFixtureId =
    selectedFixtureId !== null && fixtures.items.some((i) => i.id === selectedFixtureId)
      ? selectedFixtureId
      : null;

  /* Clicking a fixture in the 3D view selects it AND opens the tab that can do
     something about it. A click that highlights an object and changes nothing
     you can see reads as broken. */
  const pickFixture = useCallback((id: string) => {
    setSelectedFixtureId(id);
    setWorkspace("fixtures");
  }, []);

  /* ---- is there work from a session that ended badly?

         `ProjectLibrary` does the real handshake — it reads the autosave slot
         before it writes to it and holds autosaving until somebody decides.
         This asks the same question for exactly one purpose: to OPEN THE TAB,
         so the offer to restore is on screen rather than behind a click nobody
         knew to make. It restores nothing, writes nothing and decides nothing.
         A storage failure is swallowed here and reported properly by the panel
         in the store's own words. See decision 7. */
  const documentRef = useRef(state.doc);
  documentRef.current = state.doc;
  useEffect(() => {
    let alive = true;
    void readAutosave().then(
      (auto) => {
        if (!alive || !auto.present) return;
        const differs =
          !auto.readable || auto.record.signature !== documentSignature(documentRef.current);
        if (differs) setWorkspace("library");
      },
      () => {
        /* the panel names the failure; this only chooses which tab opens */
      },
    );
    return () => {
      alive = false;
    };
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

  const partitionCount = partitions.length;
  const finishCount = countOverrides(overrides);
  const fixtureCount = fixtures.items.length;
  const durableDetailCount = partitionCount + finishCount + fixtureCount;

  return (
    <div className="space-y-6">
      {loadedFromLink ? (
        <p className="rounded-md border border-aura-teal px-4 py-3 text-xs leading-relaxed text-aura-text/75">
          This home was opened from a share link. Everything is editable, and undo puts the Aura
          reference build back.
        </p>
      ) : null}

      {state.doc.quarantine.entries.length > 0 ? (
        <section className="rounded-xl border border-aura-violet p-5" aria-labelledby="repair-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p id="repair-heading" className="aura-label text-aura-violet">
                Repair held project details
              </p>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-aura-text/65">
                A geometry edit removed the original host for these details. Aura kept them aside
                instead of deleting or guessing where they belong. Restore an item after its
                original room, surface or volume returns, or discard it deliberately.
              </p>
            </div>
            <span className="rounded-full border border-aura-violet px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-violet">
              {state.doc.quarantine.entries.length} held
            </span>
          </div>
          <ul className="mt-4 space-y-3">
            {state.doc.quarantine.entries.map((entry, index) => (
              <li
                key={`${entry.kind}-${quarantineEntryLabel(entry)}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border aura-hairline px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-aura-text/85">{quarantineEntryLabel(entry)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-aura-text/55">{entry.reason}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => restoreQuarantined(index)}>Restore</Button>
                  <Button tone="danger" onClick={() => discardQuarantined(index)}>
                    Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {quarantineNote ? (
            <p className="mt-4 text-xs leading-relaxed text-aura-text/65" role="status">
              {quarantineNote}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* --------------------------------------------------------- the toggle */}
      <div className="rounded-xl border aura-hairline px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Segmented<ViewMode> label="View" value={mode} options={VIEW_MODES} onChange={setMode} />
          <p className="max-w-md text-xs leading-relaxed text-aura-text/55">
            {mode === "3d"
              ? "Orbit the massing, move the sun, click any surface to say what it is made of, and click a fixture to edit it."
              : "North up and to scale. Drag a corner to resize, a wall to push one face, an opening to slide it, or draw an interior partition inside a mass."}
          </p>
        </div>

        {/* Two views over one durable project document. */}
        <p className="mt-4 border-t aura-hairline pt-4 max-w-3xl text-xs leading-relaxed text-aura-text/60">
          Both views edit one versioned <span className="font-mono">BuilderDocument</span>: push a
          wall in the plan and the model moves; drag a slider in Shape and the plan moves. The same
          document owns <span className="text-aura-text/80">partitions, finishes, fixtures, comfort
          targets and repair-held details</span>. They now survive undo, autosave, library storage,
          share links and <span className="font-mono">.aura.json</span> round trips together. The
          legacy drawing, DXF and IFC writers still derive their shell from HomeSpec, so their
          limitations are named again beside those export actions.
          {durableDetailCount > 0 ? (
            <>
              {" "}
              Right now: {partitionCount} partition{partitionCount === 1 ? "" : "s"},{" "}
              {finishCount} finish{finishCount === 1 ? "" : "es"} and {fixtureCount} fixture
              {fixtureCount === 1 ? "" : "s"}.
            </>
          ) : null}
        </p>
      </div>

      {/* The 3D canvas is never unmounted — it is the export root. See
          decision 4 in the header. */}
      <div className={mode === "3d" ? "block" : "hidden"}>
        <Viewport
          home={home}
          sun={sunPos}
          hour={sun.hour}
          selectedId={activeVolumeId}
          onSelect={selectVolume}
          houseRef={houseRef}
          surfaces={{
            index: surfaceIndex,
            overrides,
            picked: pickedSurface,
            onPick: setPickedSurface,
            enabled: mode === "3d",
          }}
          comfort={comfortOverlay}
          houseChildren={
            <FixtureLayer
              geometry={fixtureGeometry}
              selectedId={activeFixtureId}
              onSelect={pickFixture}
            />
          }
        />
      </div>

      <div className={mode === "2d" ? "block" : "hidden"}>
        <Plan2D
          spec={spec}
          onEdit={edit}
          partitions={partitions}
          onPartitions={editPartitions}
          selectedVolumeId={activeVolumeId}
          onSelectVolume={selectVolume}
          selectedOpeningId={selectedOpeningId}
          onSelectOpening={setSelectedOpeningId}
        />
      </div>

      {/* ------------------------------------------------ clearances, unburied

          A wood stove four inches from a combustible wall is the most
          expensive thing this tool can catch, and it catches it for nothing —
          which is worth nothing at all if it is three tabs down. So the
          blocking issues are here, under the model, on every tab and in both
          views. The full account of every clearance, with the source each one
          came from, is in the fixtures tab; this is the part that must not be
          possible to miss. */}
      {clashes.length > 0 ? (
        <div className="rounded-xl border border-aura-violet p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="aura-label text-aura-violet">
              {clashes.length} clearance clash{clashes.length === 1 ? "" : "es"} in this home
            </p>
            <Button tone="danger" onClick={() => setWorkspace("fixtures")}>
              Open the fixtures
            </Button>
          </div>
          <ul className="mt-3 space-y-2">
            {clashes.map((i, n) => (
              <li
                key={`${i.fixtureId}-${i.ruleKey ?? "fit"}-${n}`}
                className="flex gap-3 text-sm leading-relaxed text-aura-text/80"
              >
                <span aria-hidden className="text-aura-violet">
                  ·
                </span>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t aura-hairline pt-3 text-xs leading-relaxed text-aura-text/60">
            The violet boxes in the 3D view are the clearance volumes that are obstructed — switch
            them off with &ldquo;Clearances on&rdquo; in the fixtures tab if they are in the way.
            Every clearance names the source it came from and whether that source is a code, a
            manufacturer or a convention. None of it has been verified against the authority having
            jurisdiction, and a wood-burning appliance is signed off by a WETT inspector on the day,
            not by this page.
          </p>
        </div>
      ) : null}

      {worthChecking.length > 0 && clashes.length === 0 ? (
        <p className="rounded-md border border-aura-lime px-4 py-3 text-xs leading-relaxed text-aura-text/70">
          Nothing is clashing, but {worthChecking.length} thing
          {worthChecking.length === 1 ? " is" : "s are"} worth checking about your fixtures — the
          fixtures tab names {worthChecking.length === 1 ? "it" : "them"} in full.
        </p>
      ) : null}

      <Readout spec={spec} summary={home.summary} warnings={home.warnings} />

      {/* Only in 3D: the panel's own copy says "click any surface in the view
          above", and in plan mode there is no such view to click. Every
          assignment already made survives the switch — it is in the document,
          not in this panel. */}
      {mode === "3d" ? (
        <SurfacePicker
          index={surfaceIndex}
          overrides={overrides}
          picked={pickedSurface}
          onPick={setPickedSurface}
          onChange={editSurfaces}
        />
      ) : null}

      {/* ------------------------------------------------------- toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border aura-hairline px-5 py-4">
        <p className="text-xs leading-relaxed text-aura-text/55">
          {state.past.length === 0
            ? "Nothing changed yet. Every edit here is undoable, and nothing in this tool is a dead end."
            : `${state.past.length} step${state.past.length === 1 ? "" : "s"} back available · Ctrl+Z, Ctrl+Shift+Z · a wall drag, a partition, a finish, a fixture and opening a saved design are all one kind of step`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => dispatch({ type: "undo" })} disabled={!canUndo}>
            Undo
          </Button>
          <Button onClick={() => dispatch({ type: "redo" })} disabled={!canRedo}>
            Redo
          </Button>
          <Button
            onClick={() =>
              dispatch({
                type: "load",
                doc: defaultBuilderDocument(),
                label: "reset",
              })
            }
            title="Back to the Aura reference build"
          >
            Start over
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------ the workspaces */}
      <nav aria-label="Builder workspaces" className="rounded-xl border aura-hairline p-2">
        <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
          {WORKSPACES.map((w) => {
            const on = w.id === workspace;
            const badge =
              w.id === "fixtures" && clashes.length > 0
                ? `${clashes.length} clash${clashes.length === 1 ? "" : "es"}`
                : null;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setWorkspace(w.id)}
                aria-pressed={on}
                data-cursor="Select"
                className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                  on
                    ? "border-aura-emerald text-aura-text"
                    : "aura-hairline text-aura-text/60 hover:text-aura-text"
                }`}
              >
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-[0.65rem] uppercase tracking-label">
                    {w.label}
                  </span>
                  {badge ? (
                    <span className="rounded-full border border-aura-violet px-1.5 font-mono text-[0.55rem] uppercase tracking-label text-aura-violet">
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[0.7rem] leading-snug text-aura-text/55">
                  {w.hint}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ============================================================== SHAPE */}
      <Pane on={workspace === "shape"}>
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
      </Pane>

      {/* =========================================================== FIXTURES

          The palette works from either view — it is a list, and adding a stove
          does not need a canvas. What needs the 3D view is CLICKING one, which
          is why `FixtureLayer` is mounted with the model and a click there
          opens this tab. */}
      <Pane on={workspace === "fixtures"}>
        <FixturePalette
          spec={spec}
          value={fixtures}
          onChange={editFixtures}
          selectedId={activeFixtureId}
          onSelect={setSelectedFixtureId}
          showClearances={showClearances}
          onShowClearances={setShowClearances}
          resolution={fixtureResolution}
        />
        <p className="mt-5 rounded-md border aura-hairline px-4 py-3 text-xs leading-relaxed text-aura-text/60">
          Click a fixture in the 3D model to select it, and move it with the sliders here rather
          than by dragging it around the view. That is deliberate: a stove that comes within about
          fifteen inches of a wall turns square and seats flat against it, and a solar array is held
          inside a roof-edge setback — snapping is doing something a free drag cannot express, and
          the numbers you set here are the numbers that reach the schedule. Fixtures travel in the
          .glb, project file, share links, library saves and autosave. They are not yet represented
          on the legacy drawing set, in DXF or in IFC; those writers still derive their shell from
          HomeSpec, and each export names that limitation.
        </p>
      </Pane>

      {/* ============================================================ COMFORT

          MOUNTED rather than hidden, like `AxonSheet` and `SemanticExport`
          and for the same reason: the panel's whole content is derived from
          `comfortReport`, which runs the plan solve on every spec change.
          Gating the memo already stops that cost when the tab is shut; not
          mounting the tree is the second half of the same bargain, and this
          panel holds no state a switch must preserve — the settings, the
          season and the heatmap all live in `BuilderApp`, so leaving and
          coming back finds everything exactly as it was. */}
      <Pane on={workspace === "comfort"}>
        {workspace === "comfort" && comfort ? (
          <ComfortPanel
            report={comfort}
            settings={comfortSettings}
            onSettings={editComfort}
            season={comfortSeason}
            onSeason={setComfortSeason}
            heatmap={heatmap}
            onHeatmap={setHeatmap}
          />
        ) : null}
      </Pane>

      {/* =========================================================== DRAWINGS */}
      <Pane on={workspace === "drawings"}>
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
          {partitionCount + fixtureCount > 0 ? (
            <>
              {" "}
              The {partitionCount} partition{partitionCount === 1 ? "" : "s"} and {fixtureCount}{" "}
              fixture{fixtureCount === 1 ? "" : "s"} you placed are not on these sheets: the drawing
              set is generated from the spec, and the spec does not carry them yet.
            </>
          ) : null}
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

      {/* ------------------------------------------------------ the ninth view

          Beside the set rather than in it, because it is a different KIND of
          drawing and saying so is more useful than hiding the difference
          behind a matching sheet number. A0–A7 are DERIVED: the generator
          knows what every line means, which is what lets them carry true
          dimensions. This one is COMPUTED — which lines you can see from
          three-quarters depends on every solid in the model at once, so there
          is no closed form and it carries no dimensions on purpose.

          Mounted only while this tab is open. The hidden-line pass costs about
          27 ms on the reference home and re-runs on every edit; that is worth
          paying while somebody is reading the drawings and worth nothing at
          all while they are dragging a slider two tabs away. */}
      {workspace === "drawings" ? (
        <div className="mt-6 space-y-3">
          <p className="max-w-3xl text-xs leading-relaxed text-aura-text/60">
            One more view, and the only one in this tool that cannot be worked out from arithmetic.
            It also redraws LIVE from the model on screen, so unlike the sheets above it is never
            stale — which does mean it can disagree with a set you generated before your last edit.
          </p>
          <AxonSheet home={home} name={spec.name} />
        </div>
      ) : null}
      </Pane>

      {/* ============================================================= EXPORT */}
      <Pane on={workspace === "export"}>
        <ExportRow
          value={state.doc}
          comfort={comfort}
          houseRef={houseRef}
          onLoad={(loaded, label) =>
            dispatch({
              type: "load",
              doc: loaded,
              label,
            })
          }
        />
        {/* Mounted only while this tab is open: `roundTripReport` really does
            serialise the whole building and parse it back — 4.5 ms for the
            reference home, 28.8 ms for a deliberately absurd one, both measured
            by the module itself — and it re-runs on every spec change. */}
        {workspace === "export" ? (
          <div className="mt-6">
            <SemanticExport spec={spec} comfort={comfort} />
          </div>
        ) : null}
      </Pane>

      {/* ============================================================ LIBRARY

          Always mounted — see decision 7. It owns the autosave loop and the
          crash-recovery handshake, and both have to be running whether or not
          this is the tab on screen. */}
      <Pane on={workspace === "library"}>
        <ProjectLibrary
          value={state.doc}
          onOpen={(loaded, label) =>
            dispatch({
              type: "load",
              doc: loaded,
              label,
            })
          }
        />
        <p className="mt-5 rounded-md border aura-hairline px-4 py-3 text-xs leading-relaxed text-aura-text/60">
          Every saved design and autosave is a complete versioned project: shell geometry,
          partitions, finishes, fixtures, comfort targets and anything held for repair. Opening or
          restoring one is still an ordinary edit, so Ctrl+Z puts the previous project back. Legacy
          HomeSpec-only records remain readable and are migrated without overwriting their source.
        </p>
      </Pane>
    </div>
  );
}

/* A workspace, hidden rather than unmounted.

   CSS, not a conditional, because the panels inside hold state a tab switch
   must not destroy: the export row's round-trip verdict cost a press to
   produce, `DrawingSheets` remembers which sheet you were reading, and — most
   importantly — `ProjectLibrary` owns the autosave timer and performed a
   read-before-write handshake on mount that must not be re-run every time
   somebody looks at the exports. The two genuinely expensive children are
   conditionally mounted INSIDE their pane instead. See decision 6. */
function Pane({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div className={on ? "block" : "hidden"} aria-hidden={!on}>
      {children}
    </div>
  );
}
