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
   4. THE 3D CANVAS STAYS MOUNTED IN 2D MODE — AND ON EVERY STEP. The toggle
      hides it with CSS rather than unmounting it, because `houseRef` — the
      group the .glb and .obj exporters are handed — only exists while the
      canvas does. Unmounting it would make "Download .glb" fail with "the 3D
      view has not finished mounting yet" for anybody who had switched to the
      plan. `frameloop` is `"demand"`, so a hidden canvas costs nothing per
      frame.

      THE STAGE BELOW EXTENDS THAT RULE TO THE LAYOUT. The guided walk shows
      the home beside the step that is changing it, and it does so by moving
      GRID RULES, never children: the canvas keeps one parent, one position and
      one WebGL context from the first step to the last. Anything that would
      re-parent it — a step-conditional wrapper, a keyed remount, a portal —
      takes the export root with it. `tests/builder-viewer.spec.ts` holds a
      mark on the live canvas element across the whole walk for exactly this.
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
   9. VW03 — THE PLAN ROUTE IS REACHABILITY, NOT A SECOND DRAWING. The
      dimensioned sheet a person wants on a site visit already existed: A3
      FLOOR PLAN, in the drawing set `lib/builder/drawings/` produces. What did
      not exist was a way to reach it from the mode a phone lands in. The
      workspace tab strip renders only in Pro (see the `editorMode === "pro"`
      gate below) and no entry in GUIDED_STEPS maps to the `drawings`
      workspace, so in guided mode the whole set was unreachable.

      WHAT CHANGED, AND WHAT DELIBERATELY DID NOT. GUIDED_STEPS is untouched —
      the walk is still eight steps, `tests/project-ui.spec.ts` still counts
      eight, and a ninth step would have made the drawings a stop on a walk
      rather than a place you can get to from anywhere. Instead the guided
      shell carries ONE route control that sets `workspace` to the existing
      `drawings` pane and back again. Same pane, same `drawingSet()` call, same
      PDF — there is no mobile renderer, because two renderers for one drawing
      is a divergence this repo has paid for before.

      AND THE ROUTE IS READ-ONLY, WHICH COSTS MORE THAN THE ROUTE DID. While
      it is open, every control that can move `hashBuilderDocument` is off the
      screen rather than merely awkward: the surface picker, the site panel,
      the undo/redo/start-over bar, the quick finish switch, and the 2D plan
      editor (the view is pinned to the model — see `viewMode`). What is left
      is a viewer, an eight-sheet index, a per-sheet SVG and the whole set as
      one PDF. "No editing affordance a thumb cannot honestly drive" is only a
      real claim if the affordances are actually gone, so
      `tests/builder-mobile.spec.ts` presses every control that remains and
      asserts the document hash never moves.
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
  convertBuilderDocumentToGraph,
  defaultBuilderDocument,
  discardQuarantinedEntry,
  hashBuilderDocument,
  reconcileBuilderDocumentSpec,
  restoreQuarantinedEntry,
  type BuilderDocument,
  type QuarantineEntry,
} from "@/lib/builder/document";
import type { BuildingGraph } from "@/lib/builder/buildingGraph";
import { drawingSet, type DrawingRooms, type DrawingSetResult } from "@/lib/builder/drawings";
import { buildHome, disposeHome, type HomeGeometry } from "@/lib/builder/geometry";
import { buildGraphHome } from "@/lib/builder/graphGeometry";
import type { HomeSpec } from "@/lib/builder/spec";
import { documentFromLocation } from "@/lib/builder/share";
import type { BuilderSite } from "@/lib/builder/site";
import type { GuidanceTopic } from "@/lib/builder/guidance";
import SitePanel from "./SitePanel";
import { PHRASE_GUIDE, applyPhrase } from "./phrases";
import {
  buildSurfaceIndex,
  countOverrides,
  type SurfaceId,
  type SurfaceIndex,
  type SurfaceOverrides,
} from "@/lib/builder/surfaces";
import {
  DEFAULT_VIEWER_TOOLS,
  deriveViewerTools,
  viewerFloors,
  type SectionAxis,
  type ViewerFloor,
  type ViewerToolState,
  type ViewerToolsResult,
} from "@/lib/three/viewerTools";
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
import { documentSignature, readAutosave, writeAutosave } from "@/lib/builder/store";
import { checkSpecAgainstParcel, planFromSpec, type PlanHandoff } from "@/lib/builder/toPlan";
import AxonSheet from "./AxonSheet";
import BuilderOrderHandoff from "./BuilderOrderHandoff";
import CoPilot from "./CoPilot";
import ComfortPanel from "./ComfortPanel";
import DrawingSheets from "./DrawingSheets";
import ExportRow from "./ExportRow";
import FixturePalette, { FixtureLayer, useFixtureGeometry } from "./FixturePalette";
import { OpeningHandles, OpeningNumbers, type OpeningStatus } from "./OpeningHandles";
import WalkthroughPanel, { WalkthroughCameraRig } from "./Walkthrough";
import VariationStrip from "./VariationStrip";
import ScenarioCompare from "./ScenarioCompare";
import GraphPlanEditor from "./GraphPlanEditor";
import GuidanceNote from "./GuidanceNote";
import HandoffPanel from "./HandoffPanel";
import LiveReadout from "./LiveReadout";
import Plan2D from "./Plan2D";
import PlanCatalog from "./PlanCatalog";
import PlanSheet from "./PlanSheet";
import ProjectLibrary from "./ProjectLibrary";
import Readout from "./Readout";
import SpecPanel, { type SunState } from "./SpecPanel";
import SurfacePicker, { SurfaceQuickSwitch } from "./SurfacePicker";
import Viewport from "./Viewport";
import { sunPosition } from "./sun";
import { Button, Segmented } from "./ui";
import { useAuraProject } from "@/components/project/ProjectContext";

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
  /** Counts WHOLE-DOCUMENT arrivals — plan chosen, project opened, share
   *  link imported — and nothing else. The camera reframes on this and only
   *  this, which is what keeps a slider drag from yanking the view (the
   *  guarantee the old empty-deps camera memo protected) while a newly
   *  loaded home finally gets framed as itself. View state, never persisted. */
  loadEpoch: number;
}

type Action =
  | { type: "edit"; spec: HomeSpec; label: string }
  | { type: "graph"; graph: BuildingGraph; label: string }
  | { type: "partitions"; partitions: Partition[]; label: string }
  | { type: "surfaces"; overrides: SurfaceOverrides; label: string }
  | { type: "fixtures"; fixtures: FixtureSet; label: string }
  | { type: "comfort"; comfort: BuilderDocument["comfort"]; label: string }
  | { type: "site"; site: BuilderSite | null; label: string }
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
    doc.geometry === state.doc.geometry &&
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
    loadEpoch: state.loadEpoch,
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
    case "graph": {
      if (state.doc.geometry.kind !== "building-graph") return state;
      if (action.graph === state.doc.geometry.graph) return state;
      return commit(
        state,
        {
          ...state.doc,
          geometry: { ...state.doc.geometry, graph: action.graph },
        },
        action.label,
      );
    }
    case "comfort": {
      if (action.comfort === state.doc.comfort) return state;
      return commit(state, { ...state.doc, comfort: action.comfort }, action.label);
    }
    /* The land under the home. Clearing it REMOVES the key rather than
       storing a null, so a project that never had a parcel stays
       byte-identical to its pre-site self (document.spec pins this). */
    case "site": {
      if (action.site === null) {
        if (state.doc.site === undefined) return state;
        const { site: _dropped, ...withoutSite } = state.doc;
        return commit(state, withoutSite, action.label);
      }
      if (action.site === state.doc.site) return state;
      /* ONE SLOPE, not two. The spec has always carried siting.slope (it
         drives the pile schedule on sheet A2) and the parcel now carries its
         own answer. Left alone they diverge — the site-proof caught A1
         printing FLAT while the Site step said gentle. The parcel's answer
         is the design's answer, reconciled inside this one commit so it
         stays one undo step. */
      const slope = action.site.parcel?.slope;
      const doc = slope && slope !== state.doc.spec.siting.slope
        ? withSpec(state.doc, { ...state.doc.spec, siting: { ...state.doc.spec.siting, slope } })
        : state.doc;
      return commit(state, { ...doc, site: action.site }, action.label);
    }
    case "load": {
      // A house off a link or off somebody's disk is untrusted in exactly the
      // same way, so what arrived with it is reconciled against it before it
      // is allowed to become the document.
      const committed = commit(
        state,
        action.doc.geometry.kind === "building-graph"
          ? action.doc
          : withSpec(action.doc, action.doc.spec),
        action.label,
      );
      // A load that changed nothing still framed nothing new — the epoch
      // moves only when the document actually became a different one.
      return committed === state ? state : { ...committed, loadEpoch: state.loadEpoch + 1 };
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
        loadEpoch: state.loadEpoch,
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
        loadEpoch: state.loadEpoch,
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
  document: BuilderDocument;
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
  loadEpoch: 0,
});

/** A same-tab resume marker, never the document itself. The durable document
 * remains in IndexedDB; this only distinguishes an explicit plan commit from
 * an unrelated crash copy that must still ask before replacing the canvas. */
const COMMITTED_PLAN_RESUME_KEY = "aura:builder:committed-plan:v1";

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
type Workspace = "plans" | "shape" | "fixtures" | "comfort" | "drawings" | "export" | "library";

type EditorMode = "guided" | "pro";
type GuidedStep = "brief" | "shell" | "rooms" | "openings" | "site" | "performance" | "materials" | "review";

/** The mode the URL asked for. `/design` redirects to `/build?mode=guided` and
 *  promises that parameter works, so it is honoured here — read once at mount,
 *  because this component is client-only (`ssr: false`) and the choice after
 *  that belongs to the toggle, not the address bar. Anything that is not
 *  exactly "pro" is guided: guided is the mode that cannot strand anybody. */
function editorModeFromLocation(): EditorMode {
  if (typeof window === "undefined") return "guided";
  return new URLSearchParams(window.location.search).get("mode") === "pro" ? "pro" : "guided";
}

/* Which sourced explanations belong to which step of the walk. A step with no
   entry gets no note rather than a filler one — the guidance module answers
   only the questions it can actually cite, and the walk should not invent a
   question to have something to say. */
const GUIDED_STEP_TOPICS: Partial<Record<GuidedStep, readonly GuidanceTopic[]>> = {
  shell: ["storey-count", "minimum-dwelling-size"],
  rooms: ["room-layout"],
  openings: ["glazing-ratio"],
  performance: ["wall-r-value", "roof-r-value"],
};

const GUIDED_STEPS: ReadonlyArray<{
  id: GuidedStep;
  label: string;
  workspace: Workspace;
  /* The view this step is honest in — plan where the decision is a plan
     decision, model everywhere else. It is applied ON ARRIVAL and never
     again, so the View toggle beside the model wins for as long as somebody
     stays on the step. A preference, not a lock. Two steps used to arrive
     with no preference at all and inherited whichever view the last step
     left behind, which is how Performance could open in plan. */
  view: ViewMode;
  hint: string;
}> = [
  { id: "brief", label: "Plans", workspace: "plans", view: "3d", hint: "Choose an editable concept or begin from Aura’s reference home." },
  { id: "shell", label: "Shell", workspace: "shape", view: "3d", hint: "Shape the massing, roof and exterior openings." },
  { id: "rooms", label: "Rooms", workspace: "shape", view: "2d", hint: "Arrange the plan and its exact room faces." },
  { id: "openings", label: "Openings", workspace: "shape", view: "2d", hint: "Place doors and windows with measured feedback." },
  { id: "site", label: "Site", workspace: "shape", view: "3d", hint: "Check orientation, sun and terrain assumptions." },
  { id: "performance", label: "Performance", workspace: "comfort", view: "3d", hint: "State comfort targets and review limitations." },
  { id: "materials", label: "Materials", workspace: "shape", view: "3d", hint: "Assign a tactile, buildable finish palette." },
  { id: "review", label: "Review", workspace: "export", view: "3d", hint: "Review, quote and hand the design off." },
];

const WORKSPACES: ReadonlyArray<{ id: Workspace; label: string; hint: string }> = [
  { id: "plans", label: "Plans", hint: "Editable starts, each with source and cost evidence" },
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
  const { project: auraProject, ready: projectReady, syncDesign } = useAuraProject();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const {
    spec,
    partitions,
    finishes: overrides,
    fixtures,
    comfort: comfortSettings,
  } = state.doc;
  const graphGeometry = state.doc.geometry.kind === "building-graph" ? state.doc.geometry : null;
  const graphMode = graphGeometry !== null;

  const [mode, setMode] = useState<ViewMode>("3d");
  const [editorMode, setEditorMode] = useState<EditorMode>(editorModeFromLocation);
  const [guidedStep, setGuidedStep] = useState<GuidedStep>("brief");
  /* Pro never opens on the plans tab (the toggle below enforces the same),
     so a `?mode=pro` arrival starts on Shape rather than a tab Pro hides. */
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    editorModeFromLocation() === "pro" ? "shape" : "plans",
  );
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  /** the last phrase's confirmation sentence — cleared the moment typing resumes */
  const [phraseApplied, setPhraseApplied] = useState<string | null>(null);
  const [selectedVolumeId, setSelectedVolumeId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [openingStatus, setOpeningStatus] = useState<OpeningStatus | null>(null);

  /* OPENING IDS ARE UNIQUE PER VOLUME, NOT PER DESIGN — two volumes may both
     carry a `door-s`. Selection is therefore stored as the opening id alone
     (that is what the plan and the panel click) and the owning volume is
     RESOLVED here, once, rather than being threaded through every caller. If
     the id ever appears on two volumes this picks the first, which is the same
     one the plan drew, so the grips land on the wall the person clicked. */
  const openingVolumeId = useMemo(
    () =>
      selectedOpeningId
        ? spec.volumes.find((v) => v.openings.some((o) => o.id === selectedOpeningId))?.id ?? null
        : null,
    [selectedOpeningId, spec.volumes],
  );
  const [pickedSurface, setPickedSurface] = useState<SurfaceId | null>(null);
  const [selectedFixtureId, setSelectedFixtureId] = useState<string | null>(null);
  const [showClearances, setShowClearances] = useState(true);
  /* VW02 — the viewer tools. VIEW STATE, deliberately: a section cut and an
     isolated floor are ways of looking at the document, not edits to it, so
     they are not in `state.doc`, never reach the reducer, never enter history
     and cannot move `hashBuilderDocument`. The same rule the heatmap toggle
     and the season already follow. */
  const [viewerTools, setViewerTools] = useState<ViewerToolState>(DEFAULT_VIEWER_TOOLS);
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
  const [planStatus, setPlanStatus] = useState<string | null>(null);

  const houseRef: MutableRefObject<THREE.Group | null> = useRef<THREE.Group | null>(null);
  /* A counter for history labels that must not collide. UI-only, never
     persisted, so nothing about the geometry or the export depends on it. */
  const gesture = useRef(0);
  const hydratedProjectId = useRef<string | null>(null);
  const resumableSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!projectReady || !auraProject || hydratedProjectId.current === auraProject.id) return;
    hydratedProjectId.current = auraProject.id;
    dispatch({ type: "load", doc: auraProject.design.document, label: "project:open" });
  }, [auraProject, projectReady]);

  useEffect(() => {
    if (!auraProject || hydratedProjectId.current !== auraProject.id) return;
    const timer = window.setTimeout(() => {
      void syncDesign(state.doc);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [auraProject, state.doc, syncDesign]);

  const edit = useCallback((next: HomeSpec, label: string) => {
    dispatch({ type: "edit", spec: next, label });
  }, []);

  const editPartitions = useCallback((next: Partition[], label: string) => {
    dispatch({ type: "partitions", partitions: next, label });
  }, []);

  const editGraph = useCallback((next: BuildingGraph, label: string) => {
    dispatch({ type: "graph", graph: next, label });
  }, []);

  const editSite = useCallback((next: BuilderSite | null, label: string) => {
    dispatch({ type: "site", site: next, label });
  }, []);

  /* Does this home fit this land? checkSpecAgainstParcel has existed and
     gone uncalled since the plan engine landed; the Site step is the first
     place with both halves of the question. Arithmetic only — it runs here,
     sends nothing anywhere, and says no when the answer is no. */
  const siteCheck = useMemo(() => {
    const parcel = state.doc.site?.parcel;
    if (!parcel) return null;
    return checkSpecAgainstParcel(spec, {
      lotWidthFt: parcel.lotWidthFt,
      lotDepthFt: parcel.lotDepthFt,
      frontSetbackFt: parcel.frontSetbackFt,
      sideSetbackFt: parcel.sideSetbackFt,
      rearSetbackFt: parcel.rearSetbackFt,
    });
  }, [spec, state.doc.site]);

  const convertToPlanarGraph = useCallback(() => {
    const converted = convertBuilderDocumentToGraph(state.doc, 0.5);
    if (!converted.ok) {
      setQuarantineNote(converted.problem);
      return;
    }
    dispatch({ type: "load", doc: converted.document, label: "geometry:convert-to-graph" });
    setMode("2d");
    setWorkspace("shape");
    setQuarantineNote(
      "Planar geometry is active. Legacy-only details were held for repair instead of being guessed onto new graph surfaces.",
    );
  }, [state.doc]);

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
  const home: HomeGeometry = useMemo(
    () => (graphGeometry ? buildGraphHome(graphGeometry.graph) : buildHome(spec)),
    [graphGeometry, spec],
  );
  const previous = useRef<HomeGeometry | null>(null);
  useEffect(() => {
    const old = previous.current;
    if (old && old !== home) disposeHome(old);
    previous.current = home;
  }, [home]);

  /* ---- every nameable surface on that model, and the geometry → surface map
         a click is resolved through. One pass over about thirty parts, so it
         is rebuilt with the geometry rather than cached against it. */
  const surfaceIndex: SurfaceIndex = useMemo(
    () => buildSurfaceIndex(home, graphMode ? undefined : spec),
    [home, graphMode, spec],
  );

  /* ---- VW02: the viewer tools, derived. Pure arithmetic over the graph, the
         spec and the tool state — `lib/three/viewerTools.ts` owns every
         decision in here, including the refusal when a floor cannot honestly
         be isolated. Nothing below touches the document. */
  const toolFloors: ViewerFloor[] = useMemo(
    () => viewerFloors(graphGeometry?.graph ?? null),
    [graphGeometry],
  );
  const toolsResult: ViewerToolsResult = useMemo(
    () => deriveViewerTools(graphGeometry?.graph ?? null, spec, viewerTools),
    [graphGeometry, spec, viewerTools],
  );
  const viewportTools = useMemo(
    () => ({ clipPlanes: toolsResult.clipPlanes, soloVolumeIds: toolsResult.visibleVolumeIds }),
    [toolsResult],
  );

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
    () => (graphMode ? [] : fixtureResolution.issues.filter((i) => i.severity === "blocked")),
    [fixtureResolution, graphMode],
  );
  const worthChecking = useMemo(
    () => (graphMode ? [] : fixtureResolution.issues.filter((i) => i.severity === "check")),
    [fixtureResolution, graphMode],
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
  const comfortWanted = !graphMode && (heatmap || workspace === "comfort" || workspace === "export");
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
    if (!projectReady || auraProject) return;
    let alive = true;
    void readAutosave().then(
      (auto) => {
        if (!alive || !auto.present) return;
        let requested: string | null = null;
        try {
          requested = window.sessionStorage.getItem(COMMITTED_PLAN_RESUME_KEY);
        } catch {
          /* The ordinary recovery prompt remains available without session storage. */
        }
        if (auto.readable && requested !== null && auto.record.signature === requested) {
          resumableSignature.current = requested;
          dispatch({ type: "load", doc: auto.record.document, label: "plan:resume" });
          setMode("3d");
          setGuidedStep("shell");
          setWorkspace("shape");
          setPlanStatus(`${auto.record.name} was restored from this tab’s committed design.`);
          return;
        }
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
  }, [auraProject, projectReady]);

  /* Undo or a later edit invalidates the narrow auto-resume promise. The
     regular autosave/recovery flow still protects that work, but it asks
     before replacing a future canvas. */
  useEffect(() => {
    const expected = resumableSignature.current;
    if (!expected || documentSignature(state.doc) === expected) return;
    resumableSignature.current = null;
    try {
      window.sessionStorage.removeItem(COMMITTED_PLAN_RESUME_KEY);
    } catch {
      /* No session storage means there is no marker to clear. */
    }
  }, [state.doc]);

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

  useEffect(() => {
    const onCommandKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandsOpen((open) => !open);
      } else if (event.key === "Escape") {
        setCommandsOpen(false);
      }
    };
    window.addEventListener("keydown", onCommandKey);
    return () => window.removeEventListener("keydown", onCommandKey);
  }, []);

  /* ---- the drawing */
  const stale = drawn !== null && drawn.document !== state.doc;
  const generate = useCallback(() => {
    if (state.doc.geometry.kind === "building-graph") return;
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

    /* B-P1: the A1 SITE PLAN sheet has always known how to draw a parcel and
       has always been handed nothing, so it printed its honest blank. The
       Site step's answers reach it here — and only when they are real, so
       an absent site still gets the blank rather than an invented lot. */
    const siteParcel = state.doc.site?.parcel ?? null;

    setDrawn({
      document: state.doc,
      handoff,
      set: drawingSet({
        document: state.doc,
        dateISO,
        projectName: spec.name,
        rooms,
        parcel: siteParcel
          ? {
              lotWidthFt: siteParcel.lotWidthFt,
              lotDepthFt: siteParcel.lotDepthFt,
              frontSetbackFt: siteParcel.frontSetbackFt,
              sideSetbackFt: siteParcel.sideSetbackFt,
              rearSetbackFt: siteParcel.rearSetbackFt,
            }
          : null,
      }),
      dateISO,
    });
  }, [spec, state.doc]);

  const partitionCount = partitions.length;
  const finishCount = countOverrides(overrides);
  const fixtureCount = fixtures.items.length;
  const durableDetailCount = partitionCount + finishCount + fixtureCount;
  const guidedIndex = Math.max(
    0,
    GUIDED_STEPS.findIndex((step) => step.id === guidedStep),
  );
  const activeGuidedStep = GUIDED_STEPS[guidedIndex];
  const commandWorkspaces = WORKSPACES.filter((item) =>
    `${item.label} ${item.hint}`.toLowerCase().includes(commandQuery.trim().toLowerCase()),
  );

  /* The salsita-inspired layer (see phrases.ts): the palette query is ALSO
     tried as an edit phrase against the live spec. Deterministic parse, no
     network, and only offered when it would actually change something. Held
     off in graph mode, where HomeSpec is a recovery copy — offering to edit
     the copy would be exactly the lie GraphPending exists to prevent. */
  const phraseMatch = useMemo(
    () => (graphGeometry ? null : applyPhrase(spec, activeVolumeId, commandQuery)),
    [activeVolumeId, commandQuery, graphGeometry, spec],
  );

  const applyPhraseNow = useCallback(() => {
    if (!phraseMatch) return;
    gesture.current += 1;
    edit(phraseMatch.spec, `phrase ${gesture.current}: ${phraseMatch.label}`);
    setPhraseApplied(phraseMatch.say);
    // The palette stays open with an empty query: applied, confirmed, ready
    // for the next phrase — a conversation, not a dialog per sentence.
    setCommandQuery("");
  }, [edit, phraseMatch]);

  const chooseGuidedStep = useCallback((step: (typeof GUIDED_STEPS)[number]) => {
    setGuidedStep(step.id);
    setWorkspace(step.workspace);
    if (step.view) setMode(step.view);
  }, []);

  /* ------------------------------------------------------- VW03: the plan route

     Guided mode standing on the `drawings` workspace. Derived rather than
     stored, so there is no fourth piece of state that can disagree with the
     other three: every existing path that sets a workspace — a guided step, the
     command palette, the clash panel's "Open the fixtures" — leaves the route
     by construction, and none of them had to learn about it. */
  const planRoute = editorMode === "guided" && workspace === "drawings";

  /* The view is PINNED to the model while the route is open. `mode` is left
     alone rather than forced, so leaving the route puts back whichever view the
     step had; this is what everything on the stage actually renders against. */
  const viewMode: ViewMode = planRoute ? "3d" : mode;

  const openPlanRoute = useCallback(() => {
    setWorkspace("drawings");
    /* Arriving at a "Generate the drawing" button is the wrong answer to "let
       me see the plan". The set is generated on arrival when there is none —
       once, and never again on its own, because a REDRAW is a judgement about
       a model that has since moved and the pane already offers that as a
       press. `generate` is a no-op in graph mode, where the sheets honestly
       cannot be drawn at all. */
    if (drawn === null) generate();
  }, [drawn, generate]);

  const leavePlanRoute = useCallback(() => {
    const step = GUIDED_STEPS.find((candidate) => candidate.id === guidedStep);
    setWorkspace(step ? step.workspace : "plans");
    if (step?.view) setMode(step.view);
  }, [guidedStep]);

  const choosePlan = useCallback(async (document: BuilderDocument, plan: { title: string }) => {
    const signature = documentSignature(document);
    await writeAutosave(document);
    try {
      window.sessionStorage.setItem(COMMITTED_PLAN_RESUME_KEY, signature);
    } catch {
      throw new Error("This browser blocked same-tab recovery, so the open design was left unchanged. Allow session storage and retry.");
    }
    resumableSignature.current = signature;
    dispatch({ type: "load", doc: document, label: `plan:${plan.title}` });
    setSelectedVolumeId(null);
    setSelectedOpeningId(null);
    setSelectedFixtureId(null);
    setPickedSurface(null);
    setDrawn(null);
    setMode("3d");
    setGuidedStep("shell");
    setWorkspace("shape");
    setPlanStatus(`${plan.title} is open as an editable concept. Its source limits and planning basis stay attached; local professionals must complete the build documents. Undo restores the design you had before it.`);
  }, []);

  return (
    <div
      className="space-y-6"
      data-active-plan={state.doc.planOrigin?.templateId ?? "custom"}
      data-active-design-hash={documentSignature(state.doc)}
    >
      {loadedFromLink ? (
        <p className="rounded-md border border-aura-teal px-4 py-3 text-xs leading-relaxed text-aura-text/75">
          This home was opened from a share link. Everything is editable, and undo puts the Aura
          reference build back.
        </p>
      ) : null}

      {planStatus ? (
        <p className="rounded-md border border-aura-emerald bg-aura-emerald/5 px-4 py-3 text-xs leading-relaxed text-aura-text/75" role="status">
          {planStatus}
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

      <section className="builder-mode-shell" aria-labelledby="editor-mode-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p id="editor-mode-heading" className="aura-label text-aura-emerald">Editor mode</p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-aura-text/65">
              Guided keeps one decision in view. Pro exposes every precision workspace. Both edit
              the same project document and produce the same canonical design hash.
            </p>
          </div>
          <div role="group" aria-label="Editor mode" className="builder-mode-toggle">
            {(["guided", "pro"] as const).map((editor) => (
              <button
                key={editor}
                type="button"
                aria-pressed={editorMode === editor}
                onClick={() => {
                  setEditorMode(editor);
                  if (editor === "pro" && workspace === "plans") setWorkspace("shape");
                  if (editor === "guided") {
                    const step = GUIDED_STEPS.find((candidate) => candidate.id === guidedStep);
                    if (step) {
                      setWorkspace(step.workspace);
                      if (step.view) setMode(step.view);
                    }
                  }
                }}
                className="builder-mode-toggle__button"
              >
                {editor === "guided" ? "Guided" : "Pro"}
              </button>
            ))}
          </div>
        </div>

        {editorMode === "guided" ? (
          <>
            <nav aria-label="Guided design steps" className="guided-step-nav">
              {GUIDED_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  aria-pressed={guidedStep === step.id}
                  data-done={index < guidedIndex || undefined}
                  onClick={() => chooseGuidedStep(step)}
                  className="guided-step"
                >
                  <span aria-hidden>{index < guidedIndex ? "✓" : String(index + 1).padStart(2, "0")}</span>
                  {step.label}
                </button>
              ))}
            </nav>
            <div className="guided-step-note" role="status">
              <span>{activeGuidedStep.label}</span>
              <p>{activeGuidedStep.hint}</p>
            </div>
            {/* The "why" for whatever this step is actually deciding, sourced
                or absent. `explain` returns null when this document cannot be
                traced to a source, and GuidanceNote then renders nothing —
                saying nothing is the correct output, because a placeholder
                would be a sentence about Aura where somebody wanted a
                sentence about their home. */}
            {GUIDED_STEP_TOPICS[activeGuidedStep.id]?.map((topic) => (
              <GuidanceNote key={topic} topic={topic} document={state.doc} />
            ))}
            {/* One decision in view needs a way to take the NEXT one without
                hunting the strip above — guided is a walk, so it gets legs.
                The last step trades Next for graduation: the same document,
                every precision workspace. */}
            <div className="guided-step-flow">
              <Button
                disabled={guidedIndex <= 0}
                onClick={() => chooseGuidedStep(GUIDED_STEPS[guidedIndex - 1])}
              >
                Back
              </Button>
              <span className="guided-step-flow__count">
                Step {guidedIndex + 1} of {GUIDED_STEPS.length}
              </span>
              {guidedIndex < GUIDED_STEPS.length - 1 ? (
                <Button
                  tone="loud"
                  onClick={() => chooseGuidedStep(GUIDED_STEPS[guidedIndex + 1])}
                >
                  Next · {GUIDED_STEPS[guidedIndex + 1].label}
                </Button>
              ) : (
                <Button
                  tone="loud"
                  title="Same project, every precision workspace"
                  onClick={() => {
                    setEditorMode("pro");
                    setWorkspace("export");
                  }}
                >
                  Continue in Pro
                </Button>
              )}
            </div>

            {/* ------------------------------------------- VW03: the plan route

                Beside the walk rather than inside it. The drawings are not a
                NINTH DECISION — they are the thing the eight decisions were
                for, and somebody standing in a field with a phone wants them
                from wherever the walk happens to be, not after seven Nexts.
                One control, one tap each way, and the label says which sheet
                arrives so the promise is checkable before it is pressed. */}
            <div
              className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-aura-teal px-4 py-3"
              data-plan-route={planRoute ? "open" : "closed"}
            >
              <p className="max-w-md text-xs leading-relaxed text-aura-text/65">
                {planRoute
                  ? "Read-only. Nothing on this screen can change the design — the editors are on the step you came from."
                  : "Sheet A3 FLOOR PLAN — dimensioned inside and out — plus the other seven sheets and the whole set as one PDF. Read-only, and it fits a phone."}
              </p>
              {planRoute ? (
                <Button onClick={leavePlanRoute} title="Back to the step you were on">
                  Back to {activeGuidedStep.label}
                </Button>
              ) : (
                <Button tone="loud" onClick={openPlanRoute} title="The dimensioned floor plan and the rest of the set">
                  Open the drawings
                </Button>
              )}
            </div>
          </>
        ) : null}
      </section>

      {/* ================================================================ THE STAGE

          The home, and the step that is changing it, beside each other. Two
          grid columns at desktop widths and one stacked column below them,
          with the model FIRST in the document either way — a guided walk in
          which the thing you are shaping is below the fold is a walk taken on
          faith.

          THE COLUMNS ARE CSS AND ONLY CSS. The canvas inside is the export
          root; moving it between parents would remount it, lose the GPU state
          and break `houseRef` for the .glb writers. So `data-stage` swaps grid
          rules while the children stay exactly where they are, on every step.

          THE PLANS WORKSPACE OPTS OUT and stays full width. The library
          carries its own preview aside and a four-control filter row whose
          minimum widths total more than a half-width column can give it, so
          squeezing it there would push a scrollbar across the page. */}
      <div className="builder-stage" data-stage={workspace === "plans" ? "browse" : "edit"}>
        <div className="builder-stage__view">
          {/* ------------------------------------------------------- the toggle */}
          <div className="builder-view-switch rounded-2xl px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              {/* The View toggle is an editing affordance in disguise: its
                  second option IS the plan editor, where a drag moves a wall.
                  So the route does not disable it, it does not show it — and
                  `viewMode` above keeps the model as the rendered view whatever
                  `mode` happens to be holding for the step underneath. */}
              {planRoute ? (
                <div>
                  <p className="aura-label text-aura-teal">The model, read-only</p>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-aura-text/60">
                    Orbit it as much as you like. The plan editor, the finishes and the undo bar are
                    on the step you came from — they are not on this screen, so there is nothing here
                    a thumb can change by accident.
                  </p>
                </div>
              ) : (
                <>
                  <Segmented<ViewMode> label="View" value={mode} options={VIEW_MODES} onChange={setMode} />
                  <p className="max-w-md text-xs leading-relaxed text-aura-text/55">
                    {mode === "3d"
                      ? "Orbit the massing, move the sun, click any surface to say what it is made of, and click a fixture to edit it."
                      : "North up and to scale. Drag a corner to resize, a wall to push one face, an opening to slide it, or draw an interior partition inside a mass."}
                  </p>
                </>
              )}
            </div>

            {/* Two views over one durable project document. */}
            <details className="builder-document-note mt-3 border-t aura-hairline pt-3">
              <summary>One document drives every view and handoff</summary>
              <p className="mt-3 max-w-3xl text-xs leading-relaxed text-aura-text/60">
                Push a wall in plan and the model moves. The same versioned project keeps partitions,
                finishes, fixtures, comfort targets, repair-held details, autosave, share links, and
                <span className="font-mono"> .aura.json</span> together. Legacy DXF and IFC consumers
                still state their HomeSpec limits beside their actions.
                {durableDetailCount > 0 ? (
                  <>
                    {" "}Current detail: {partitionCount} partition{partitionCount === 1 ? "" : "s"},{" "}
                    {finishCount} finish{finishCount === 1 ? "" : "es"}, and {fixtureCount} fixture
                    {fixtureCount === 1 ? "" : "s"}.
                  </>
                ) : null}
              </p>
            </details>
          </div>

          {/* The 3D canvas is never unmounted — it is the export root. See
              decision 4 in the header. */}
          <div className={viewMode === "3d" ? "block" : "hidden"}>
            <Viewport
              home={home}
              sun={sunPos}
              hour={sun.hour}
              selectedId={graphGeometry?.graph.storeys[0]?.id ?? activeVolumeId}
              onSelect={selectVolume}
              houseRef={houseRef}
              loadEpoch={state.loadEpoch}
              site={state.doc.site ?? null}
              surfaces={
                graphMode
                  ? null
                  : {
                      index: surfaceIndex,
                      overrides,
                      picked: pickedSurface,
                      onPick: setPickedSurface,
                      enabled: viewMode === "3d",
                    }
              }
              comfort={comfortOverlay}
              tools={viewportTools}
              /* THREE THINGS RIDE IN THE EXPORT ROOT, and the ordering rule
                  is that only real building geometry may stay in a .glb. The
                  fixtures are the home; the opening grips and the camera rig
                  are instruments. Both instruments carry EXPORT_IGNORE, and
                  the rig renders null anyway.

                  The rig is UNCONDITIONAL because a walkthrough works in graph
                  mode too; the fixtures and the grips are not, because neither
                  has graph-mode geometry to attach to yet. */
              houseChildren={
                <>
                  {graphMode ? null : (
                    <>
                      <FixtureLayer
                        geometry={fixtureGeometry}
                        selectedId={activeFixtureId}
                        onSelect={pickFixture}
                      />
                      {/* The grips are 3D-only ON PURPOSE, not by omission: the
                          plan view has its own drag handles inside Plan2D, and
                          two live grip sets over one wall would fight for the
                          same pointer. `enabled` is the gate rather than an
                          unmount, for one narrow reason — the component clears
                          a stale status when the selection changes, and that
                          effect has to keep running in plan view so the numbers
                          panel never shows the last window's dimension beside a
                          different window. It reports drag status only in 3D,
                          because only 3D has a drag. */}
                      <OpeningHandles
                        spec={spec}
                        volumeId={openingVolumeId}
                        openingId={selectedOpeningId}
                        onEdit={edit}
                        onStatus={setOpeningStatus}
                        enabled={viewMode === "3d"}
                      />
                    </>
                  )}
                  <WalkthroughCameraRig />
                </>
              }
            />
          </div>

          {/* ---------------------------------------------- VW02: the tool row

              Under the model rather than over it: these are ways of
              INTERROGATING the home — cut it, look at one floor, say what a
              surface is made of — and they belong beside the thing they act
              on. Rendered only in 3D, because none of them mean anything over
              a 2D plan, and as a sibling SLOT so the canvas above keeps its
              parent and its position on every toggle. */}
          {viewMode === "3d" ? (
            <ViewerToolRow
              tools={viewerTools}
              onTools={setViewerTools}
              result={toolsResult}
              floors={toolFloors}
              index={surfaceIndex}
              overrides={overrides}
              picked={pickedSurface}
              onFinishes={editSurfaces}
              /* THE GRAPH-MODE GATE IS KEPT, and said out loud rather than
                 hidden behind a disabled control. Finishes are keyed on
                 surface ids built from the LEGACY spec; `pruneOverrides` drops
                 every id it cannot find in `spec.volumes`, and in graph mode
                 the spec is a frozen recovery copy whose volume ids do not
                 match the storey ids the graph geometry emits. Opening the
                 picker here would let somebody paint a wall and lose it the
                 next time anything touched the spec. */
              /* Two reasons a finish cannot be assigned here, and the geometry
                 one is named first because it is a limit rather than a choice.
                 The route's reason is a choice, and it says so: this is the
                 one writer left in the view column, and a read-only screen
                 that still repaints a wall is not read-only. */
              finishesUnavailable={
                graphMode
                  ? "Finishes are a legacy-geometry feature today. This project uses planar graph geometry, where a surface belongs to a storey rather than to a spec volume, and Aura will not offer a paint it cannot promise to keep."
                  : planRoute
                    ? "This is the read-only drawing view. Nothing here writes to the design — go back to the step you came from to change a finish, and it will be one undo step like every other edit."
                    : null
              }
            />
          ) : null}

          <div className={viewMode === "2d" ? "block" : "hidden"}>
            {graphGeometry ? (
              <GraphPlanEditor graph={graphGeometry.graph} onEdit={editGraph} />
            ) : (
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
            )}
          </div>

          {/* ---------------------------------------------- the opening, in numbers

              OPEN01. The same window, said three ways, and all three write the
              same edit: drag a grip in 3D, drag a handle in the plan, or type a
              figure here. This panel lives in the VIEW column rather than under
              a tab because it belongs to whichever view is on screen — the 3D
              grips and the plan handles both report through `openingStatus`,
              so the width you are dragging is the width printed here, live,
              and a refusal ("the header would run out of wall") is printed in
              full rather than being a drag that quietly stops moving.

              It is mounted in BOTH views and in every workspace with a viewer.
              Nothing selected means nothing rendered — the component returns
              null on a null opening, so the column does not grow an empty box. */}
          {graphMode ? null : (
            <OpeningNumbers
              spec={spec}
              volumeId={openingVolumeId}
              openingId={selectedOpeningId}
              onEdit={edit}
              status={openingStatus}
              onStatus={setOpeningStatus}
            />
          )}

          {/* --------------------------------------------------------- the walk

              WALK01. Enscape's headline is a walkthrough, and this is ours,
              built from the summary the viewer is already drawing rather than
              from a second scene: every viewpoint is a position derived from
              the home's own bounds and ridge height, and the sentence under
              each one says which number it came from.

              3D only, and that is a limit rather than a preference — the panel
              moves a camera, and the plan view has none. It is READ-ONLY: the
              design hash is the same string when you step out as when you
              stepped in, which is a claim the spec checks rather than a
              promise this comment makes. */}
          {viewMode === "3d" ? <WalkthroughPanel summary={home.summary} /> : null}

          {/* ------------------------------------------------ clearances, unburied

              A wood stove four inches from a combustible wall is the most
              expensive thing this tool can catch, and it catches it for nothing —
              which is worth nothing at all if it is three tabs down. So the
              blocking issues are here, under the model, on every tab and in both
              views — inside the view column rather than the control column, so
              they travel with the thing they are about. The full account of every
              clearance, with the source each one came from, is in the fixtures
              tab; this is the part that must not be possible to miss. */}
          {clashes.length > 0 ? (
            <div className="rounded-xl border border-aura-violet p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="aura-label text-aura-violet">
                  {clashes.length} clearance clash{clashes.length === 1 ? "" : "es"} in this home
                </p>
                <Button tone="danger" onClick={() => { setEditorMode("pro"); setWorkspace("fixtures"); }}>
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
        </div>

        <div className="builder-stage__controls">
          <Pane on={workspace === "plans"}>
            <PlanCatalog onChoose={choosePlan} currentName={spec.name} />
            {/* VAR01 — exploring versions of the home you have is the same job
                as choosing the one you start from, so it lives beside the
                library rather than in a mode of its own. Deterministic and
                parametric: every variant is a real document that opens, hashes
                and costs. Nothing here is generated. */}
            <div className="mt-6">
              <VariationStrip
                document={state.doc}
                onApply={edit}
                region={auraProject?.requirements.location.region ?? "Alberta"}
                municipality={auraProject?.requirements.location.municipality ?? ""}
                scenario={auraProject?.budgetBasis?.scenario}
                budgetCapCad={auraProject?.requirements.budgetCad.max ?? null}
              />
            </div>
          </Pane>

          {/* The Site step's own panel. Mounted only while the walk is standing
              on Site, because it owns form state that should start from the
              document each time somebody arrives. */}
          {editorMode === "guided" && guidedStep === "site" && !planRoute ? (
            <SitePanel site={state.doc.site} onSite={editSite} check={siteCheck} />
          ) : null}

          {graphMode ? (
            <section className="rounded-xl border aura-hairline p-5">
              <p className="aura-label text-aura-emerald">Graph geometry · exact faces</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border aura-hairline px-4 py-3">
                  <p className="aura-label">Floor area</p>
                  <p className="mt-1 text-lg tabular-nums">{Math.round(home.summary.totalFloorAreaSqFt)} sq ft</p>
                </div>
                <div className="rounded-md border aura-hairline px-4 py-3">
                  <p className="aura-label">Room faces</p>
                  <p className="mt-1 text-lg tabular-nums">
                    {graphGeometry?.graph.storeys.reduce((sum, storey) => sum + storey.rooms.length, 0)}
                  </p>
                </div>
                <div className="rounded-md border aura-hairline px-4 py-3">
                  <p className="aura-label">Storeys</p>
                  <p className="mt-1 text-lg tabular-nums">{graphGeometry?.graph.storeys.length}</p>
                </div>
              </div>
              {home.warnings.length > 0 ? (
                <ul className="mt-4 space-y-1 text-xs leading-relaxed text-aura-violet">
                  {home.warnings.map((warning) => <li key={warning}>· {warning}</li>)}
                </ul>
              ) : null}
            </section>
          ) : (
            <Readout spec={spec} summary={home.summary} warnings={home.warnings} />
          )}

          {/* LF01/LF02 — the consequence of the edit, beside the edit. Cost bands
              from `createProjectBudget`, the fit and coverage checks from the
              `siteCheck` computed above, and one readiness reading that names what
              is still missing. It recomputes from the document, so it moves while
              you work rather than on a submit. */}
          <LiveReadout document={state.doc} parcelCheck={siteCheck} />

          {/* AI01 — the co-pilot, beside the read-out that raised most of what
              it talks about. Off in the plan route for the same reason the undo
              bar and the surface picker are: that screen is read-only, and a
              panel offering to change the design on it would not be. It is NOT
              gated on graph mode — `readCoPilot` refuses a planar-graph project
              in its own words, and a panel that explains why it is silent is
              worth more than one that vanishes. */}
          {planRoute ? null : (
            <CoPilot
              document={state.doc}
              parcelCheck={siteCheck}
              onApply={edit}
              region={auraProject?.requirements.location.region ?? "Alberta"}
              municipality={auraProject?.requirements.location.municipality ?? ""}
              scenario={auraProject?.budgetBasis?.scenario}
              budgetCapCad={auraProject?.requirements.budgetCad.max ?? null}
            />
          )}

          {/* Only in 3D: the panel's own copy says "click any surface in the view
              above", and in plan mode there is no such view to click. Every
              assignment already made survives the switch — it is in the document,
              not in this panel. */}
          {viewMode === "3d" && !graphMode && !planRoute ? (
            <SurfacePicker
              index={surfaceIndex}
              overrides={overrides}
              picked={pickedSurface}
              onPick={setPickedSurface}
              onChange={editSurfaces}
            />
          ) : null}

          {/* ------------------------------------------------------- toolbar

              OFF in the plan route, and "Start over" is the reason it is the
              whole bar rather than that one button. `dispatch({type:"load", doc:
              defaultBuilderDocument()})` replaces the document outright: on a
              phone that control sits a thumb-width from the sheet index, and it
              is the single most expensive thing on this page to press by
              mistake. Undo and Redo go with it because a bar that offers to
              take back edits nobody can make here is furniture. */}
          {planRoute ? null : (
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
              <Button onClick={() => setCommandsOpen(true)} title="Search tools and views · Ctrl+K">
                Commands
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
          )}

          {/* ------------------------------------------------------ the workspaces */}
          {editorMode === "pro" ? <nav role="tablist" aria-label="Builder workspaces" className="rounded-xl border aura-hairline p-2">
            <div className="grid gap-1.5 sm:grid-cols-3 lg:grid-cols-7">
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
                    role="tab"
                    onClick={() => setWorkspace(w.id)}
                    aria-pressed={on}
                    aria-selected={on}
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
          </nav> : null}

          {/* ============================================================== SHAPE */}
          <Pane on={workspace === "shape"}>
            {graphGeometry ? (
              <section className="rounded-xl border aura-hairline p-5">
                <p className="aura-label text-aura-emerald">Planar source of truth active</p>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/70">
                  Switch to Plan above to drag corners, add vertices and divide exact room faces. The 3D
                  model is rebuilt from those same graph edges. Undo returns through every conversion
                  and graph edit, including all the way to the untouched recovery HomeSpec.
                </p>
                {graphGeometry.migrationWarnings.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-xs leading-relaxed text-aura-violet">
                    {graphGeometry.migrationWarnings.map((warning) => <li key={warning}>· {warning}</li>)}
                  </ul>
                ) : null}
              </section>
            ) : (
              <>
                <section className="mb-5 rounded-xl border border-aura-emerald p-5">
                  <p className="aura-label text-aura-emerald">Ready for angled walls</p>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/70">
                    Convert this single-storey massing into the planar graph to add non-rectangular
                    corners and exact room faces. The original design stays attached as recovery data;
                    details that cannot be placed with certainty are held for repair, never deleted.
                  </p>
                  <div className="mt-4">
                    <Button tone="loud" onClick={convertToPlanarGraph}>Convert to planar editing</Button>
                  </div>
                </section>
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
              </>
            )}
          </Pane>

          {/* =========================================================== FIXTURES

              The palette works from either view — it is a list, and adding a stove
              does not need a canvas. What needs the 3D view is CLICKING one, which
              is why `FixtureLayer` is mounted with the model and a click there
              opens this tab. */}
          <Pane on={workspace === "fixtures"}>
            {graphMode ? (
              <GraphPending feature="Fixture placement" />
            ) : (
              <>
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
              </>
            )}
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
            {graphMode ? (
              <GraphPending feature="Comfort spaces" />
            ) : workspace === "comfort" && comfort ? (
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

            {/* SCEN01 — the Impact verb. READ-ONLY: it takes the document and
                writes nothing, so it needs no onEdit and cannot touch history.
                Mounted only while Comfort is open, for the same reason
                ComfortPanel is — it runs two plan solves and two bills of
                materials, and a slider drag two tabs away should cost nothing.

                It compares what this build MODELS and names what it does not.
                Daylight autonomy, energy use intensity and heating load are
                absent from this codebase entirely, and the panel says so in
                rows of the same table rather than in a footnote. */}
            {workspace === "comfort" && !graphMode ? (
              <div className="mt-6">
                <ScenarioCompare document={state.doc} />
              </div>
            ) : null}
          </Pane>

          {/* =========================================================== DRAWINGS */}
          <Pane on={workspace === "drawings"}>
          {/* VW03. The way back, at the top of the pane rather than only in the
              shell above it: on a phone the guided step strip is a scroll away
              by the time somebody has read a sheet, and a read-only view with
              no visible exit is a trap. In Pro the workspace tabs are the exit
              and this renders nothing. */}
          {planRoute ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-aura-teal px-4 py-3">
              <p className="text-xs leading-relaxed text-aura-text/65">
                The drawing set, read-only. Same sheets, same PDF and the same generator Pro uses —
                this is a route to them, not a second drawing of your home.
              </p>
              <Button onClick={leavePlanRoute}>Back to {activeGuidedStep.label}</Button>
            </div>
          ) : null}
          {graphMode ? (
            <GraphPending
              feature="Professional drawings"
              /* Gate 3 of the VW03 contract: the block stays, and it names what
                 the person can do instead of leaving them at a dead end. Both
                 sentences are things this build actually offers — the
                 conversion is an ordinary undoable edit (see the Shape pane's
                 own copy), and `.aura.json` carries the graph itself. */
              instead="Undo returns through the conversion to the recovery HomeSpec, and the eight-sheet set draws from that. To keep the graph and still hand somebody a file today, the Export workspace writes .aura.json, which carries the exact planar geometry."
            />
          ) : (
          <>
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
              {/* The hash is taken over the document the SET was generated
                  from — `drawn.document`, not the live one — so a PDF saved
                  after a later edit still identifies the design it actually
                  draws. DrawingSheets deliberately refuses to invent this:
                  it never sees a BuilderDocument, and a second hash on a
                  permit-office document that no other export agrees with is
                  worse than none. Without it every downloaded PDF printed
                  "NOT SUPPLIED TO THIS EXPORT", which was true and useless. */}
              <DrawingSheets
                set={drawn.set}
                name={drawn.document.spec.name}
                dateISO={drawn.dateISO}
                designHash={hashBuilderDocument(drawn.document)}
              />
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
          </>
          )}
          </Pane>

          {/* ============================================================= EXPORT */}
          <Pane on={workspace === "export"}>
            <div className="mb-6">
              <BuilderOrderHandoff document={state.doc} />
            </div>
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
            {/* One package for the professional who has to finish this: the
                project, its drawings, its cost snapshot and the evidence
                notes, carrying the hash that says which design they describe.
                It sits beside the individual exporters rather than replacing
                them — a drafter who wants only the DXF should not have to
                take the rest. */}
            <HandoffPanel document={state.doc} comfort={comfort} />
            {/* Mounted only while this tab is open: `roundTripReport` really does
                serialise the whole building and parse it back — 4.5 ms for the
                reference home, 28.8 ms for a deliberately absurd one, both measured
                by the module itself — and it re-runs on every spec change. */}
            {workspace === "export" && !graphMode ? (
              <div className="mt-6">
                <SemanticExport document={state.doc} comfort={comfort} />
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
      </div>

      {commandsOpen ? (
        <div className="builder-command-backdrop" onMouseDown={() => setCommandsOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="builder-command-heading"
            className="builder-command-dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="builder-command-heading">
              <div>
                <p className="aura-label">Ctrl K</p>
                <h2 id="builder-command-heading">Builder commands</h2>
              </div>
              <button type="button" onClick={() => setCommandsOpen(false)} aria-label="Close commands">Close</button>
            </div>
            <input
              autoFocus
              type="search"
              value={commandQuery}
              onChange={(event) => {
                setCommandQuery(event.target.value);
                setPhraseApplied(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && phraseMatch) {
                  event.preventDefault();
                  applyPhraseNow();
                }
              }}
              placeholder="Search tools — or type an edit, like “width 24” or “a-frame roof”"
            />
            <div className="builder-command-results">
              {phraseMatch ? (
                <button type="button" className="builder-command-apply" onClick={applyPhraseNow}>
                  <span>Apply · {phraseMatch.say}</span>
                  <small>Enter applies it as one undoable edit</small>
                </button>
              ) : null}
              {phraseApplied ? (
                <p className="builder-command-applied" role="status">✓ {phraseApplied} — Ctrl Z takes it back.</p>
              ) : null}
              {commandWorkspaces.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => { setEditorMode("pro"); setWorkspace(item.id); setCommandsOpen(false); }}
                >
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
              {commandWorkspaces.length === 0 && !phraseMatch ? (
                <p>No matching builder tool — and no edit phrase understood. The phrases this editor knows are listed below.</p>
              ) : null}
            </div>
            <details className="builder-command-guide">
              <summary>Every phrase this editor understands</summary>
              <ul>
                {PHRASE_GUIDE.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p>
                Deterministic on purpose: a phrase is a typed slider, not an AI guess. The same
                phrase against the same home always produces the same result, offline.
              </p>
            </details>
          </section>
        </div>
      ) : null}
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
function GraphPending({ feature, instead = null }: { feature: string; instead?: string | null }) {
  return (
    <section className="rounded-xl border border-aura-violet p-5">
      <p className="aura-label text-aura-violet">{feature} is held at this boundary</p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/70">
        This project now uses exact planar graph geometry. Aura will not run a legacy rectangular
        calculation against its recovery copy and present that as the current design. The graph and
        recovery source remain safely stored while this consumer is upgraded.
      </p>
      {/* WHAT TO DO INSTEAD, when the caller knows. Optional on purpose: a
          refusal with a made-up alternative is worse than a refusal, so a
          consumer that has no honest second door passes nothing and this
          renders nothing. */}
      {instead ? (
        <p className="mt-4 max-w-3xl border-t aura-hairline pt-4 text-sm leading-relaxed text-aura-text/70">
          {instead}
        </p>
      ) : null}
    </section>
  );
}

/* ===========================================================================
   VW02 — THE VIEWER TOOL ROW

   Three ways of interrogating the model instead of orbiting it. All three are
   VIEWS: none of them writes to the document, so none of them can move the
   design hash, open a history step or reframe the camera.

   WHY THE THIRD ONE IS THIN. The material switch is not new work — it is the
   `lib/builder/surfaces.ts` system that already runs the panel below the
   model, reached from beside the model. `SurfaceQuickSwitch` shares the chip,
   the palette and the writer with `SurfacePicker`; there is deliberately no
   second material path, because two ways of assigning a finish is two ways for
   them to disagree.

   WHY THE SECOND ONE SOMETIMES REFUSES. See `viewerTools.ts`: a floor is real
   in graph geometry and not in legacy geometry, and a two-storey legacy home
   cannot even convert. Where the tool cannot answer it prints the reason
   rather than a control that hides nothing. */

const SECTION_AXES: ReadonlyArray<{ id: SectionAxis; label: string; title: string }> = [
  { id: "x", label: "East–west", title: "A vertical cut moving east to west across the home" },
  { id: "z", label: "North–south", title: "A vertical cut moving north to south through the home" },
  { id: "y", label: "Level", title: "A horizontal cut, like a plan taken at any height" },
];

const AXIS_WORD: Readonly<Record<SectionAxis, string>> = {
  x: "east of the origin",
  y: "above grade",
  z: "south of the origin",
};

function ViewerToolRow({
  tools,
  onTools,
  result,
  floors,
  index,
  overrides,
  picked,
  onFinishes,
  finishesUnavailable,
}: {
  tools: ViewerToolState;
  onTools: (next: ViewerToolState) => void;
  result: ViewerToolsResult;
  floors: readonly ViewerFloor[];
  index: SurfaceIndex;
  overrides: SurfaceOverrides;
  picked: SurfaceId | null;
  onFinishes: (next: SurfaceOverrides) => void;
  finishesUnavailable: string | null;
}) {
  const section = tools.section;
  const setSection = (patch: Partial<ViewerToolState["section"]>) =>
    onTools({ ...tools, section: { ...section, ...patch } });
  const isolated = result.visibleVolumeIds?.[0] ?? null;

  return (
    <section
      className="builder-tool-row"
      aria-label="Viewer tools"
      data-section-cut={section.enabled ? "on" : "off"}
      data-isolated-floor={isolated ?? "all"}
      data-can-isolate={result.canIsolate ? "yes" : "no"}
    >
      {/* ------------------------------------------------------ section cut */}
      <div className="builder-tool">
        <div className="builder-tool__head">
          <p className="aura-label">Section cut</p>
          <button
            type="button"
            aria-pressed={section.enabled}
            onClick={() => setSection({ enabled: !section.enabled })}
            data-cursor="Select"
            className="builder-tool__toggle"
          >
            {section.enabled ? "On" : "Off"}
          </button>
        </div>
        {section.enabled ? (
          <>
            <Segmented<SectionAxis>
              label="Cut axis"
              value={section.axis}
              options={SECTION_AXES}
              onChange={(axis) => setSection({ axis })}
            />
            <label className="builder-tool__slider">
              <span className="aura-label">Cut position</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.005}
                value={section.t}
                onChange={(event) => setSection({ t: Number(event.target.value) })}
              />
            </label>
            <div className="builder-tool__row">
              <p className="builder-tool__readout">
                {result.cutAtFt.toFixed(1)} ft {AXIS_WORD[section.axis]} · travels{" "}
                {result.span.minFt.toFixed(1)} to {result.span.maxFt.toFixed(1)} ft
              </p>
              <button
                type="button"
                aria-pressed={section.flipped}
                onClick={() => setSection({ flipped: !section.flipped })}
                data-cursor="Select"
                className="builder-tool__toggle"
              >
                Flip the kept side
              </button>
            </div>
            {/* The two things a person will get wrong if nobody says them.
                The second is a real limit rather than a choice: the fixture
                layer is drawn by another module and this row does not reach
                into it. */}
            <p className="builder-tool__note">
              The cut face is not capped: you are seeing through the shell, not into a solid wall.
              A wall that looks empty at the cut is a hollow model, not a hollow wall. Fixtures and
              their clearance boxes are not cut either — they stay whole where the plane crosses
              them.
            </p>
          </>
        ) : (
          <p className="builder-tool__note">
            Slice the model on any axis to look inside it. The cut is a view only — it changes
            nothing about the design, and every export still writes the whole home.
          </p>
        )}
      </div>

      {/* ---------------------------------------------------- floor isolation */}
      <div className="builder-tool">
        <div className="builder-tool__head">
          <p className="aura-label">Floors</p>
        </div>
        {result.canIsolate ? (
          <>
            <div className="builder-tool__choices" role="group" aria-label="Isolate a floor">
              <button
                type="button"
                aria-pressed={isolated === null}
                onClick={() => onTools({ ...tools, isolatedFloorId: null })}
                data-cursor="Select"
                className="builder-tool__toggle"
              >
                All floors
              </button>
              {floors.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  aria-pressed={isolated === floor.id}
                  onClick={() => onTools({ ...tools, isolatedFloorId: floor.id })}
                  data-cursor="Select"
                  className="builder-tool__toggle"
                  title={`Finished floor at ${floor.elevationFt.toFixed(1)} ft, ${floor.heightFt.toFixed(1)} ft to the underside of the storey above`}
                >
                  {floor.name} · +{floor.elevationFt.toFixed(1)} ft
                </button>
              ))}
            </div>
            <p className="builder-tool__note">
              Elevations come from the building graph&rsquo;s own storeys. The floors you are not
              looking at are ghosted rather than removed, so the .glb, the .obj and every drawing
              still contain the whole home.
            </p>
          </>
        ) : (
          <p className="builder-tool__note" data-tool-refusal="floors">
            {result.whyNot}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------- the finishes */}
      <div className="builder-tool">
        <div className="builder-tool__head">
          <p className="aura-label">Finish</p>
        </div>
        <SurfaceQuickSwitch
          index={index}
          overrides={overrides}
          picked={picked}
          onChange={onFinishes}
          unavailable={finishesUnavailable}
        />
      </div>
    </section>
  );
}

function Pane({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div className={on ? "block" : "hidden"} aria-hidden={!on}>
      {children}
    </div>
  );
}
