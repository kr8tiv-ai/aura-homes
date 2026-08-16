"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  addGraphShaft,
  addGraphStair,
  addPartitionEdge,
  extrudeGraphWall,
  renameGraphRoom,
  setGraphOpening,
  setGraphWallThickness,
  deriveStackedRoomRelationships,
  duplicateGraphStorey,
  moveGraphVertex,
  setGraphStoreyLevels,
  splitWallAt,
  type BuildingGraph,
  type GraphOpening,
  type GraphPoint,
  type GraphStorey,
  type GraphVertex,
  type GraphWallEdge,
} from "@/lib/builder/buildingGraph";
import { Button, Segmented } from "./ui";

type Tool = "shape" | "partition";

const TOOL_OPTIONS = [
  { id: "shape" as const, label: "Shape" },
  { id: "partition" as const, label: "Partition" },
];

/* ------------------------------------------------------- movement constants

   THE PLAN GRID, once. The drag used to carry a literal 0.5 inside `moveDrag`;
   a second copy of that number in the keyboard path is exactly the two-places-
   one-fact drift that has already cost this repo the meadow mask literals, the
   slope and the deck meshes. Pointer drag, arrow keys and Shift+arrow all read
   this. */
export const GRID_SNAP_FT = 0.5;
/**
 * Shift+arrow: FIVE grid steps — not a number picked here, but the multiplier
 * the legacy plan editor already nudges by (`Plan2D.tsx:997`,
 * `gridFt * (e.shiftKey ? 5 : 1)`). Two plan editors in one product disagreeing
 * about what Shift means is the same two-places-one-fact problem in miniature.
 * A multiple of the grid also keeps a coarse nudge on the lattice.
 */
export const COARSE_STEP_FT = GRID_SNAP_FT * 5;
/**
 * Typed geometry is EXACT. A dimension someone measured is not rounded onto
 * the drag grid on its way in — the grid exists because a pointer cannot hit
 * 12.375, not because the building cannot be that size. `moveGraphVertex`
 * reads a snap of 0 as "do not snap" (buildingGraph.ts:743).
 */
export const EXACT_SNAP_FT = 0;

/** Screen up is north, and the viewBox maps `zFt` straight onto y, so up is −z. */
const ARROW_DELTA: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * The exact point an arrow key asks a vertex to occupy.
 *
 * Exported so the keyboard contract can be proved without a browser. It is
 * deliberately only the ARITHMETIC: the component feeds the result straight
 * into `moveGraphVertex` with the same snap the drag uses, so there is no
 * second movement implementation that could agree today and drift tomorrow.
 */
export function arrowVertexTarget(
  vertex: { xFt: number; zFt: number },
  key: string,
  shiftKey: boolean,
): GraphPoint | null {
  const delta = ARROW_DELTA[key];
  if (!delta) return null;
  const step = shiftKey ? COARSE_STEP_FT : GRID_SNAP_FT;
  return [vertex.xFt + delta[0] * step, vertex.zFt + delta[1] * step];
}

/**
 * The undo label a vertex move commits under.
 *
 * The pointer drag, the arrow keys and the numeric fields all commit under
 * THIS, which is what makes a held arrow key one history entry rather than
 * twenty: BuilderApp's reducer coalesces consecutive edits carrying the same
 * label and only that (`commit`, BuilderApp.tsx:363-383). Reusing the existing
 * mechanism is the whole rule — no second coalescing policy was invented here.
 */
export const vertexEditLabel = (vertexId: string): string => `graph:vertex:${vertexId}`;

/** A dimension as a person says it: 12.5, 8, 0.75 — never 8.0 and never 8.000. */
const feet = (value: number): string => String(Number(value.toFixed(3)));

const wallRunFt = (wall: GraphWallEdge, vertices: Map<string, GraphVertex>): number => {
  const start = vertices.get(wall.startVertexId);
  const end = vertices.get(wall.endVertexId);
  if (!start || !end) return 0;
  return Math.hypot(end.xFt - start.xFt, end.zFt - start.zFt);
};

const openingNoun = (opening: GraphOpening): string =>
  opening.kind === "glazing-wall" ? "Glazing wall" : opening.kind === "door" ? "Door" : "Window";

function nextId(existing: Set<string>, prefix: string): string {
  let index = 1;
  while (existing.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function graphBounds(storey: GraphStorey) {
  const xs = storey.vertices.map((vertex) => vertex.xFt);
  const zs = storey.vertices.map((vertex) => vertex.zFt);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minZ = Math.min(...zs, 0);
  const maxZ = Math.max(...zs, 1);
  const padding = Math.max(4, Math.max(maxX - minX, maxZ - minZ) * 0.12);
  return {
    x: minX - padding,
    y: minZ - padding,
    width: maxX - minX + padding * 2,
    height: maxZ - minZ + padding * 2,
  };
}

type Selection =
  | { kind: "vertex"; id: string }
  | { kind: "wall"; id: string }
  | { kind: "opening"; wallId: string; id: string }
  | { kind: "room"; id: string };

/**
 * A geometry field whose ONLY source of truth is the graph.
 *
 * It holds no draft state. While the input has focus the DOM value is the
 * browser's ordinary editing buffer; the moment the model changes — an arrow
 * key, another field, an undo — or the person commits, the effect below writes
 * the graph's own number back over it. Neither `text` nor `revision` changes
 * while somebody is typing, so this never fights the keyboard, and an entry the
 * mutator refuses snaps back to the number the building actually has instead of
 * leaving a second, wrong truth on screen.
 *
 * Defined at module scope on purpose: a component declared inside the editor
 * would be a new type on every render and would remount — and blur — this input
 * on every keystroke the parent re-rendered for.
 */
function NumberField({
  label,
  value,
  revision,
  step,
  onCommit,
  note,
}: {
  label: string;
  value: number;
  /** Bumped by the editor on every commit attempt, accepted or refused. */
  revision: number;
  step: number;
  /** Absent means the graph exposes no mutator for this value — see `note`. */
  onCommit?: (value: number) => void;
  note?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const text = feet(value);
  const readOnly = !onCommit;

  useEffect(() => {
    if (ref.current) ref.current.value = text;
  }, [text, revision]);

  const commit = () => {
    const input = ref.current;
    if (!input || !onCommit) return;
    const parsed = Number(input.value);
    if (input.value.trim() === "" || !Number.isFinite(parsed)) {
      input.value = text;
      return;
    }
    onCommit(parsed);
  };

  return (
    <label className="block">
      <span className="aura-label mb-1.5 block">{label}</span>
      <input
        ref={ref}
        type="number"
        step={step}
        defaultValue={text}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        onBlur={readOnly ? undefined : commit}
        onKeyDown={(event) => {
          if (readOnly || event.key !== "Enter") return;
          event.preventDefault();
          commit();
        }}
        className={`w-28 rounded-md border aura-hairline bg-aura-bg px-3 py-2 font-mono text-xs tabular-nums text-aura-text transition-colors focus:border-aura-emerald ${
          readOnly ? "opacity-60" : ""
        }`}
      />
      {note ? (
        <span className="mt-1 block max-w-[16rem] text-[0.7rem] leading-snug text-aura-text/55">{note}</span>
      ) : null}
    </label>
  );
}

function NameField({
  label,
  value,
  revision,
  onCommit,
  note,
}: {
  label: string;
  value: string;
  revision: number;
  onCommit: (value: string) => void;
  note?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.value = value;
  }, [value, revision]);

  const commit = () => {
    const input = ref.current;
    if (!input) return;
    onCommit(input.value);
  };

  return (
    <label className="block">
      <span className="aura-label mb-1.5 block">{label}</span>
      <input
        ref={ref}
        type="text"
        defaultValue={value}
        maxLength={40}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          commit();
        }}
        className="w-44 rounded-md border aura-hairline bg-aura-bg px-3 py-2 font-mono text-xs text-aura-text transition-colors focus:border-aura-emerald"
      />
      {note ? (
        <span className="mt-1 block max-w-[16rem] text-[0.7rem] leading-snug text-aura-text/55">{note}</span>
      ) : null}
    </label>
  );
}

export default function GraphPlanEditor({
  graph,
  onEdit,
}: {
  graph: BuildingGraph;
  onEdit: (graph: BuildingGraph, label: string) => void;
}) {
  const [activeStoreyId, setActiveStoreyId] = useState(graph.storeys[0]?.id ?? "");
  const storey = graph.storeys.find((item) => item.id === activeStoreyId) ?? graph.storeys[0];
  const [tool, setTool] = useState<Tool>("shape");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [partitionEnds, setPartitionEnds] = useState<string[]>([]);
  const [preview, setPreview] = useState<BuildingGraph | null>(null);
  const previewRef = useRef<BuildingGraph | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [fieldRevision, setFieldRevision] = useState(0);
  const drag = useRef<{
    vertexId: string;
    graph: BuildingGraph;
    capture?: SVGCircleElement;
  } | null>(null);
  const stopMouseDrag = useRef<(() => void) | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const shown = preview ?? graph;
  const shownStorey = shown.storeys.find((item) => item.id === storey.id) ?? shown.storeys[0];
  // Keep the pointer transform fixed for the whole gesture. Reframing around
  // every preview vertex would move the coordinate system under the cursor.
  const bounds = useMemo(() => graphBounds(storey), [storey]);
  const vertexById = useMemo(
    () => new Map(storey.vertices.map((vertex) => [vertex.id, vertex])),
    [storey],
  );

  /* Selection is one value. `selectedWallId` stays derived from it so the
     existing wall highlight and "add corner to selected wall" keep working
     exactly as before while an opening's parent wall also reads as selected. */
  const selectedWallId =
    selection?.kind === "wall"
      ? selection.id
      : selection?.kind === "opening"
        ? selection.wallId
        : null;
  const selectedVertex =
    selection?.kind === "vertex" ? (vertexById.get(selection.id) ?? null) : null;
  const selectedWall = selectedWallId
    ? (storey.walls.find((wall) => wall.id === selectedWallId) ?? null)
    : null;
  const selectedOpening =
    selection?.kind === "opening" && selectedWall
      ? (selectedWall.openings.find((opening) => opening.id === selection.id) ?? null)
      : null;
  const selectedRoom =
    selection?.kind === "room" ? (storey.rooms.find((room) => room.id === selection.id) ?? null) : null;

  /* Every outcome in this editor leaves through one of these two, so the
     violet notice a sighted person reads and the sentence a screen reader
     hears are the same sentence, and neither can be forgotten at a call site. */
  const refuse = (message: string) => {
    setProblem(message);
    setAnnouncement(message);
  };
  const report = (message: string) => {
    setProblem(null);
    setAnnouncement(message);
  };

  const toGraphPoint = (clientX: number, clientY: number): GraphPoint => {
    const element = svg.current!;
    const matrix = element.getScreenCTM();
    if (!matrix) return [0, 0];
    const client = element.createSVGPoint();
    client.x = clientX;
    client.y = clientY;
    const local = client.matrixTransform(matrix.inverse());
    return [local.x, local.y];
  };

  /** One sentence for "a vertex ended up here", wherever the move came from. */
  const announcePlacement = (next: BuildingGraph, vertexId: string, subject: string) => {
    const placed = next.storeys
      .find((item) => item.id === storey.id)
      ?.vertices.find((vertex) => vertex.id === vertexId);
    report(
      placed
        ? `${subject} moved to X ${feet(placed.xFt)} feet, Z ${feet(placed.zFt)} feet.`
        : `${subject} moved.`,
    );
  };

  /**
   * THE vertex movement path — the only call to `moveGraphVertex` in this file.
   *
   * Dragging, the arrow keys and the X/Z/length fields all arrive here, so
   * "what a vertex move means" has exactly one implementation to be right or
   * wrong about. `preview` is the in-gesture half of a drag: same mutator, same
   * snap, same refusal text; it simply does not reach the undo stack until the
   * pointer is released.
   */
  const applyVertexMove = (
    base: BuildingGraph,
    vertexId: string,
    target: GraphPoint,
    snapFt: number,
    intent: "preview" | "commit",
    subject = `Vertex ${vertexId}`,
  ): BuildingGraph | null => {
    const moved = moveGraphVertex(base, storey.id, vertexId, target, snapFt);
    if (!moved.ok) {
      refuse(`Move rejected: ${moved.problem}`);
      return null;
    }
    if (intent === "preview") {
      setProblem(null);
      return moved.graph;
    }
    announcePlacement(moved.graph, vertexId, subject);
    onEdit(moved.graph, vertexEditLabel(vertexId));
    return moved.graph;
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!drag.current) return;
    const next = applyVertexMove(
      drag.current.graph,
      drag.current.vertexId,
      toGraphPoint(clientX, clientY),
      GRID_SNAP_FT,
      "preview",
    );
    if (!next) return;
    previewRef.current = next;
    setPreview(next);
  };

  const finishDrag = (pointerId?: number) => {
    if (!drag.current) return;
    const active = drag.current;
    const candidate = previewRef.current;
    /* A released drag announces where it landed, exactly as an arrow key or a
       typed dimension does. The in-gesture previews stay silent — a live
       region narrating every mousemove is noise, not information. */
    if (candidate && candidate !== graph) {
      announcePlacement(candidate, active.vertexId, `Vertex ${active.vertexId}`);
      onEdit(candidate, vertexEditLabel(active.vertexId));
    }
    drag.current = null;
    previewRef.current = null;
    setPreview(null);
    if (pointerId !== undefined && active.capture?.hasPointerCapture(pointerId)) {
      active.capture.releasePointerCapture(pointerId);
    }
  };

  useEffect(() => () => stopMouseDrag.current?.(), []);

  const startMouseVertexDrag = (
    event: ReactMouseEvent<SVGCircleElement>,
    vertexId: string,
  ) => {
    if (tool !== "shape") return;
    event.preventDefault();
    event.stopPropagation();
    stopMouseDrag.current?.();
    drag.current = { vertexId, graph };
    previewRef.current = graph;
    setPreview(graph);
    const move = (next: MouseEvent) => moveDrag(next.clientX, next.clientY);
    const up = () => {
      finishDrag();
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      stopMouseDrag.current = null;
    };
    stopMouseDrag.current = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const selectObject = (next: Selection) => {
    setSelection(next);
    if (next.kind === "vertex" && tool === "partition") {
      const ends = partitionEnds.includes(next.id)
        ? partitionEnds.filter((id) => id !== next.id)
        : [...partitionEnds, next.id].slice(-2);
      setPartitionEnds(ends);
      report(`${ends.length} of 2 partition endpoints selected.`);
      return;
    }
    /* Coordinates deliberately stay OUT of this sentence: they live in each
       object's accessible name in the list, which a screen reader reads on
       focus. A live region is for what just happened, not for state — and a
       selection announced immediately after a drag would otherwise quote the
       position from the render that has not happened yet. */
    report(
      next.kind === "vertex"
        ? `Selected vertex ${next.id}.`
        : next.kind === "wall"
          ? `Selected wall ${next.id}.`
          : next.kind === "room"
            ? `Selected ${storey.rooms.find((room) => room.id === next.id)?.name ?? "room"}.`
            : `Selected opening ${next.id} on wall ${next.wallId}.`,
    );
  };

  const nudgeVertex = (event: ReactKeyboardEvent<HTMLButtonElement>, vertexId: string) => {
    if (!ARROW_DELTA[event.key]) return;
    event.preventDefault();
    if (tool !== "shape") {
      refuse("Switch to the Shape tool to move vertices with the arrow keys.");
      return;
    }
    const vertex = vertexById.get(vertexId);
    if (!vertex) return;
    const target = arrowVertexTarget(vertex, event.key, event.shiftKey);
    if (!target) return;
    /* The SAME snap the drag uses. An arrow step is a grid step by
       construction; snapping again costs nothing and guarantees the keyboard
       can never land somewhere the pointer could not. */
    applyVertexMove(graph, vertexId, target, GRID_SNAP_FT, "commit");
  };

  /** Wraps a field commit so a REFUSED entry still re-syncs the input. */
  const fieldCommit = (run: (value: number) => void) => (value: number) => {
    setFieldRevision((revision) => revision + 1);
    run(value);
  };

  const commitVertexX = (value: number) => {
    if (!selectedVertex) return;
    applyVertexMove(graph, selectedVertex.id, [value, selectedVertex.zFt], EXACT_SNAP_FT, "commit");
  };

  const commitVertexZ = (value: number) => {
    if (!selectedVertex) return;
    applyVertexMove(graph, selectedVertex.id, [selectedVertex.xFt, value], EXACT_SNAP_FT, "commit");
  };

  const commitWallLength = (wall: GraphWallEdge, lengthFt: number) => {
    const start = vertexById.get(wall.startVertexId);
    const end = vertexById.get(wall.endVertexId);
    if (!start || !end) return;
    const run = Math.hypot(end.xFt - start.xFt, end.zFt - start.zFt);
    if (!(lengthFt > 0)) {
      refuse(`Move rejected: wall ${wall.id} must be longer than zero feet.`);
      return;
    }
    if (run <= 0) {
      refuse(`Move rejected: wall ${wall.id} has no direction to lengthen along.`);
      return;
    }
    /* Length is expressed as a vertex move on purpose. Sliding the END vertex
       along the wall's own direction is the only length change that leaves
       every other vertex where the person put it, and it goes through the same
       mutator — so a length that would cross another wall is refused with the
       same sentence the equivalent drag would have produced. */
    applyVertexMove(
      graph,
      wall.endVertexId,
      [start.xFt + ((end.xFt - start.xFt) / run) * lengthFt, start.zFt + ((end.zFt - start.zFt) / run) * lengthFt],
      EXACT_SNAP_FT,
      "commit",
      `Wall ${wall.id} end`,
    );
  };

  const addCorner = () => {
    const wall = storey.walls.find((item) => item.id === selectedWallId);
    if (!wall) {
      refuse("Select an exterior wall first, then add a corner at its midpoint.");
      return;
    }
    const vertices = new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));
    const start = vertices.get(wall.startVertexId)!;
    const end = vertices.get(wall.endVertexId)!;
    const length = Math.hypot(end.xFt - start.xFt, end.zFt - start.zFt);
    const ids = new Set(storey.vertices.map((vertex) => vertex.id));
    const vertexId = nextId(ids, "vertex");
    const split = splitWallAt(graph, storey.id, wall.id, length / 2, vertexId);
    if (!split.ok) {
      refuse(split.problem);
      return;
    }
    setSelection({ kind: "vertex", id: vertexId });
    report(`Corner ${vertexId} added at the midpoint of wall ${wall.id} and selected.`);
    onEdit(split.graph, `graph:split:${wall.id}`);
  };

  const extrudeSelectedWall = () => {
    if (!selectedWall || selectedWall.kind !== "external") {
      refuse("Select an exterior wall first, then extrude it outward.");
      return;
    }
    const extruded = extrudeGraphWall(graph, storey.id, selectedWall.id, 2, GRID_SNAP_FT);
    if (!extruded.ok) {
      refuse(extruded.problem);
      return;
    }
    report(`Wall ${selectedWall.id} extruded 2 ft outward.`);
    onEdit(extruded.graph, `graph:extrude:${selectedWall.id}`);
  };

  const commitOpening = (
    opening: GraphOpening,
    wall: GraphWallEdge,
    box: { offsetFt: number; widthFt: number; sillFt: number; heightFt: number },
  ) => {
    const changed = setGraphOpening(graph, storey.id, wall.id, opening.id, box);
    if (!changed.ok) {
      refuse(changed.problem);
      return;
    }
    report(
      `${openingNoun(opening)} ${opening.id} is ${feet(box.widthFt)} by ${feet(box.heightFt)} feet at offset ${feet(box.offsetFt)}.`,
    );
    onEdit(changed.graph, `graph:opening:${opening.id}`);
  };

  const commitWallThickness = (wall: GraphWallEdge, thicknessFt: number) => {
    const changed = setGraphWallThickness(graph, storey.id, wall.id, thicknessFt);
    if (!changed.ok) {
      refuse(changed.problem);
      return;
    }
    report(`Wall ${wall.id} is ${feet(thicknessFt)} feet thick.`);
    onEdit(changed.graph, `graph:thickness:${wall.id}`);
  };

  const commitRoomName = (name: string) => {
    if (!selectedRoom) return;
    setFieldRevision((revision) => revision + 1);
    const renamed = renameGraphRoom(graph, storey.id, selectedRoom.id, name);
    if (!renamed.ok) {
      refuse(renamed.problem);
      return;
    }
    const nextName = name.trim().replace(/\s+/g, " ");
    report(`${selectedRoom.name} is now called ${nextName}.`);
    onEdit(renamed.graph, `graph:room:${selectedRoom.id}`);
  };

  const addPartition = () => {
    if (partitionEnds.length !== 2) {
      refuse("Choose two existing wall vertices. Add corners first when the endpoints do not exist yet.");
      return;
    }
    const ids = new Set(storey.walls.map((wall) => wall.id));
    const added = addPartitionEdge(
      graph,
      storey.id,
      nextId(ids, "partition"),
      partitionEnds[0],
      partitionEnds[1],
    );
    if (!added.ok) {
      refuse(added.problem);
      return;
    }
    setPartitionEnds([]);
    report(`Partition added between ${partitionEnds[0]} and ${partitionEnds[1]}.`);
    onEdit(added.graph, `graph:partition:${partitionEnds.join(":")}`);
  };

  const changeLevels = (levels: { elevationFt?: number; heightFt?: number }, label: string) => {
    const changed = setGraphStoreyLevels(graph, storey.id, levels);
    if (!changed.ok) {
      refuse(changed.problem);
      return;
    }
    report(
      levels.elevationFt === undefined
        ? `${storey.name} floor to floor is ${feet(levels.heightFt ?? storey.heightFt)} feet.`
        : `${storey.name} elevation is ${feet(levels.elevationFt)} feet.`,
    );
    onEdit(changed.graph, label);
  };

  const duplicateStorey = () => {
    const ids = new Set(graph.storeys.map((item) => item.id));
    const id = nextId(ids, "storey");
    const top = Math.max(...graph.storeys.map((item) => item.elevationFt + item.heightFt));
    const duplicated = duplicateGraphStorey(graph, storey.id, {
      id,
      name: `Storey ${graph.storeys.length + 1}`,
      elevationFt: top,
    });
    if (!duplicated.ok) {
      refuse(duplicated.problem);
      return;
    }
    setActiveStoreyId(id);
    setSelection(null);
    report(`Storey ${graph.storeys.length + 1} duplicated at ${feet(top)} feet.`);
    onEdit(duplicated.graph, `graph:duplicate-storey:${storey.id}`);
  };

  const addStairCore = () => {
    const levels = [...graph.storeys].sort(
      (a, b) => a.elevationFt - b.elevationFt || a.id.localeCompare(b.id),
    );
    if (levels.length < 2) {
      refuse("Duplicate an aligned upper storey before adding a stair core.");
      return;
    }
    const lower = levels[levels.length - 2];
    const upper = levels[levels.length - 1];
    const lowerVertices = lower.vertices;
    const upperVertices = upper.vertices;
    const minX = Math.max(
      Math.min(...lowerVertices.map((vertex) => vertex.xFt)),
      Math.min(...upperVertices.map((vertex) => vertex.xFt)),
    );
    const maxX = Math.min(
      Math.max(...lowerVertices.map((vertex) => vertex.xFt)),
      Math.max(...upperVertices.map((vertex) => vertex.xFt)),
    );
    const minZ = Math.max(
      Math.min(...lowerVertices.map((vertex) => vertex.zFt)),
      Math.min(...upperVertices.map((vertex) => vertex.zFt)),
    );
    const maxZ = Math.min(
      Math.max(...lowerVertices.map((vertex) => vertex.zFt)),
      Math.max(...upperVertices.map((vertex) => vertex.zFt)),
    );
    const run = Math.min(10, maxX - minX - 2);
    if (run < 6 || maxZ - minZ < 5) {
      refuse("The aligned floor overlap is too small for Aura's 3 × 6 ft minimum stair core.");
      return;
    }
    const centreX = (minX + maxX) / 2;
    const centreZ = (minZ + maxZ) / 2;
    const ids = new Set((graph.stairs ?? []).map((stair) => stair.id));
    const added = addGraphStair(graph, {
      id: nextId(ids, "stair"),
      fromStoreyId: lower.id,
      toStoreyId: upper.id,
      start: [centreX - run / 2, centreZ],
      end: [centreX + run / 2, centreZ],
      widthFt: 3,
    });
    if (!added.ok) {
      refuse(added.problem);
      return;
    }
    report(`Stair core added between ${lower.name} and ${upper.name}.`);
    onEdit(added.graph, `graph:add-stair:${lower.id}:${upper.id}`);
  };

  const addServiceShaft = () => {
    const levels = [...graph.storeys].sort(
      (a, b) => a.elevationFt - b.elevationFt || a.id.localeCompare(b.id),
    );
    if (levels.length < 2) {
      refuse("Duplicate an aligned upper storey before adding a service shaft.");
      return;
    }
    const lower = levels[levels.length - 2];
    const upper = levels[levels.length - 1];
    const minX = Math.max(
      Math.min(...lower.vertices.map((vertex) => vertex.xFt)),
      Math.min(...upper.vertices.map((vertex) => vertex.xFt)),
    );
    const maxX = Math.min(
      Math.max(...lower.vertices.map((vertex) => vertex.xFt)),
      Math.max(...upper.vertices.map((vertex) => vertex.xFt)),
    );
    const minZ = Math.max(
      Math.min(...lower.vertices.map((vertex) => vertex.zFt)),
      Math.min(...upper.vertices.map((vertex) => vertex.zFt)),
    );
    const maxZ = Math.min(
      Math.max(...lower.vertices.map((vertex) => vertex.zFt)),
      Math.max(...upper.vertices.map((vertex) => vertex.zFt)),
    );
    if (maxX - minX < 4 || maxZ - minZ < 4) {
      refuse("The aligned floor overlap is too small for a 2 × 2 ft service shaft.");
      return;
    }
    const ids = new Set((graph.shafts ?? []).map((shaft) => shaft.id));
    const added = addGraphShaft(graph, {
      id: nextId(ids, "shaft"),
      fromStoreyId: lower.id,
      toStoreyId: upper.id,
      centre: [minX + 2, minZ + 2],
      widthFt: 2,
      depthFt: 2,
    });
    if (!added.ok) {
      refuse(added.problem);
      return;
    }
    report(`Service shaft added between ${lower.name} and ${upper.name}.`);
    onEdit(added.graph, `graph:add-shaft:${lower.id}:${upper.id}`);
  };

  const stacked = deriveStackedRoomRelationships(graph);

  return (
    <section className="rounded-xl border border-aura-emerald p-5" aria-labelledby="graph-plan-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="graph-plan-heading" className="aura-label text-aura-emerald">
            Planar building graph
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-aura-text/70">
            Drag vertices on a half-foot grid, or select an object below and move it with the arrow
            keys — Shift for {feet(COARSE_STEP_FT)} ft. Typed dimensions are exact. Invalid moves are
            refused atomically, so walls cannot cross and room faces always remain exact.
          </p>
        </div>
        <Segmented label="Plan tool" value={tool} options={TOOL_OPTIONS} onChange={(next) => {
          setTool(next);
          setPartitionEnds([]);
          setProblem(null);
        }} />
      </div>

      <div className="mt-5 grid gap-4 rounded-lg border aura-hairline p-4 lg:grid-cols-[1fr_auto]">
        <Segmented
          label="Storey"
          value={storey.id}
          options={graph.storeys.map((item) => ({ id: item.id, label: item.name }))}
          onChange={(id) => {
            setActiveStoreyId(id);
            setSelection(null);
            setPartitionEnds([]);
            setProblem(null);
          }}
        />
        <div className="flex flex-wrap items-end gap-2">
          <div className="mr-2">
            <p className="aura-label mb-2">Elevation</p>
            <div className="flex items-center gap-2">
              <Button onClick={() => changeLevels({ elevationFt: storey.elevationFt - 0.5 }, `graph:elevation:${storey.id}`)}>−</Button>
              <span className="min-w-16 text-center font-mono text-xs tabular-nums">{storey.elevationFt.toFixed(1)} ft</span>
              <Button onClick={() => changeLevels({ elevationFt: storey.elevationFt + 0.5 }, `graph:elevation:${storey.id}`)}>+</Button>
            </div>
          </div>
          <div className="mr-2">
            <p className="aura-label mb-2">Floor to floor</p>
            <div className="flex items-center gap-2">
              <Button onClick={() => changeLevels({ heightFt: Math.max(7, storey.heightFt - 0.5) }, `graph:height:${storey.id}`)}>−</Button>
              <span className="min-w-16 text-center font-mono text-xs tabular-nums">{storey.heightFt.toFixed(1)} ft</span>
              <Button onClick={() => changeLevels({ heightFt: storey.heightFt + 0.5 }, `graph:height:${storey.id}`)}>+</Button>
            </div>
          </div>
          <Button onClick={duplicateStorey} disabled={graph.storeys.length >= 2}>Duplicate aligned</Button>
          <Button onClick={addStairCore} disabled={graph.storeys.length < 2 || (graph.stairs ?? []).length > 0}>Add stair core</Button>
          <Button onClick={addServiceShaft} disabled={graph.storeys.length < 2 || (graph.shafts ?? []).length > 0}>Add service shaft</Button>
        </div>
      </div>

      {graph.storeys.length > 1 ? (
        <p className="mt-3 text-xs leading-relaxed text-aura-text/60">
          {graph.storeys.length} aligned storeys · {stacked.length} exact stacked-room relationship
          {stacked.length === 1 ? "" : "s"} · {(graph.stairs ?? []).length} explicit stair core
          {(graph.stairs ?? []).length === 1 ? "" : "s"}. Roof zones stay on the uppermost duplicated level.
          {" "}{(graph.shafts ?? []).length} service shaft{(graph.shafts ?? []).length === 1 ? "" : "s"}.
        </p>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border aura-hairline bg-aura-sunken">
        <svg
          ref={svg}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          className="aspect-[16/10] min-h-[20rem] w-full touch-none"
          role="img"
          aria-label="Editable building graph plan, north is up"
        >
          <defs>
            <pattern id="graph-grid" width="2" height="2" patternUnits="userSpaceOnUse">
              <path d="M 2 0 L 0 0 0 2" className="fill-none stroke-aura-text/10" strokeWidth="0.04" />
            </pattern>
          </defs>
          <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="url(#graph-grid)" />

          {shownStorey.rooms.map((room) => {
            const ids = room.boundary.map((edge) => {
              const wall = shownStorey.walls.find((item) => item.id === edge.wallId)!;
              return edge.forward ? wall.startVertexId : wall.endVertexId;
            });
            const vertices = new Map(shownStorey.vertices.map((vertex) => [vertex.id, vertex]));
            const points = ids.map((id) => vertices.get(id)).filter(Boolean) as GraphStorey["vertices"];
            const centre = points.reduce(
              (sum, vertex) => [sum[0] + vertex.xFt / points.length, sum[1] + vertex.zFt / points.length],
              [0, 0],
            );
            const picked = selection?.kind === "room" && selection.id === room.id;
            return (
              <g key={room.id}>
                <polygon
                  points={points.map((vertex) => `${vertex.xFt},${vertex.zFt}`).join(" ")}
                  className={`${picked ? "fill-aura-emerald/20" : "fill-aura-emerald/8"} cursor-pointer`}
                  onClick={() => tool === "shape" && selectObject({ kind: "room", id: room.id })}
                />
                <text
                  x={centre[0]}
                  y={centre[1]}
                  textAnchor="middle"
                  className="pointer-events-none fill-aura-text/60 font-mono text-[0.65px]"
                >
                  {room.name} · {Math.round(room.areaSqft)} sq ft
                </text>
              </g>
            );
          })}

          {shownStorey.walls.map((wall) => {
            const start = shownStorey.vertices.find((vertex) => vertex.id === wall.startVertexId)!;
            const end = shownStorey.vertices.find((vertex) => vertex.id === wall.endVertexId)!;
            const selected = selectedWallId === wall.id;
            return (
              <g key={wall.id}>
                <line
                  x1={start.xFt}
                  y1={start.zFt}
                  x2={end.xFt}
                  y2={end.zFt}
                  className={selected ? "stroke-aura-emerald" : wall.kind === "partition" ? "stroke-aura-teal" : "stroke-aura-text"}
                  strokeWidth={Math.max(0.28, wall.thicknessFt)}
                  strokeLinecap="square"
                />
                <line
                  x1={start.xFt}
                  y1={start.zFt}
                  x2={end.xFt}
                  y2={end.zFt}
                  className="stroke-transparent cursor-pointer"
                  strokeWidth="1.6"
                  onClick={() => tool === "shape" && selectObject({ kind: "wall", id: wall.id })}
                />
                {wall.openings.map((opening) => {
                  const length = Math.hypot(end.xFt - start.xFt, end.zFt - start.zFt);
                  const ux = (end.xFt - start.xFt) / length;
                  const uz = (end.zFt - start.zFt) / length;
                  return (
                    <line
                      key={opening.id}
                      x1={start.xFt + ux * opening.offsetFt}
                      y1={start.zFt + uz * opening.offsetFt}
                      x2={start.xFt + ux * (opening.offsetFt + opening.widthFt)}
                      y2={start.zFt + uz * (opening.offsetFt + opening.widthFt)}
                      className={opening.kind === "door" ? "stroke-aura-violet" : "stroke-aura-teal"}
                      strokeWidth={Math.max(0.48, wall.thicknessFt + 0.18)}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* NO tabIndex on these. They carried tabIndex={0} and a per-vertex
              aria-label, which advertised a keyboard affordance that did not
              exist — and could not have worked, because role="img" on the svg
              above makes this whole subtree presentational, so those labels
              were never announced in the first place. The object list below is
              the keyboard surface: labelled, enumerable, and actually able to
              move the thing it names. */}
          {shownStorey.vertices.map((vertex) => {
            const endpoint = partitionEnds.includes(vertex.id);
            const picked = selection?.kind === "vertex" && selection.id === vertex.id;
            return (
              <circle
                key={vertex.id}
                cx={vertex.xFt}
                cy={vertex.zFt}
                r={picked ? "0.8" : "0.55"}
                className={`${endpoint ? "fill-aura-violet" : "fill-aura-emerald"} ${picked ? "stroke-aura-text" : "stroke-aura-panel"} cursor-grab active:cursor-grabbing`}
                strokeWidth={picked ? "0.22" : "0.16"}
                onClick={() => selectObject({ kind: "vertex", id: vertex.id })}
                onMouseDown={(event) => startMouseVertexDrag(event, vertex.id)}
                onPointerMove={(event) => {
                  if (event.pointerType !== "mouse") moveDrag(event.clientX, event.clientY);
                }}
                onPointerUp={(event) => {
                  if (event.pointerType !== "mouse") finishDrag(event.pointerId);
                }}
                onPointerCancel={(event) => {
                  if (event.pointerType !== "mouse") finishDrag(event.pointerId);
                }}
                onPointerDown={(event) => {
                  if (tool !== "shape" || event.pointerType === "mouse") return;
                  event.stopPropagation();
                  drag.current = { vertexId: vertex.id, graph, capture: event.currentTarget };
                  previewRef.current = graph;
                  setPreview(graph);
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
              />
            );
          })}

          <g className="pointer-events-none">
            <path d={`M ${bounds.x + 2} ${bounds.y + 5} L ${bounds.x + 2} ${bounds.y + 2}`} className="stroke-aura-emerald" strokeWidth="0.22" />
            <path d={`M ${bounds.x + 2} ${bounds.y + 2} l -0.45 0.8 M ${bounds.x + 2} ${bounds.y + 2} l 0.45 0.8`} className="stroke-aura-emerald" strokeWidth="0.22" />
            <text x={bounds.x + 2} y={bounds.y + 6.1} textAnchor="middle" className="fill-aura-emerald font-mono text-[0.75px]">N</text>
          </g>
        </svg>
      </div>

      {/* The one live region. Selections, accepted moves and refusals all pass
          through `report`/`refuse`, so nothing this editor does is silent. */}
      <p
        role="status"
        aria-live="polite"
        className="mt-3 min-h-5 font-mono text-xs leading-relaxed text-aura-text/70"
      >
        {announcement}
      </p>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div>
          <p className="aura-label mb-2" id="graph-objects-label">
            Objects on {storey.name}
          </p>
          {/* WHY A LIST RATHER THAN SPATIAL TABBING: the plan is drawn as one
              <circle> per vertex and two <line>s per wall, in graph order. Made
              focusable that is dozens of stops that read as nothing, arrive in
              an order with no relation to the drawing, and — inside role="img"
              — carry no accessible name at all. This list is the same objects
              in the same order, each named in the units the drawing is in, each
              a real button. Tab moves between objects; the arrow keys are then
              free to mean "move the selected vertex" rather than "move focus". */}
          <ul
            aria-labelledby="graph-objects-label"
            className="max-h-64 divide-y divide-aura-text/10 overflow-y-auto rounded-md border aura-hairline"
          >
            {storey.rooms.map((room) => {
              const picked = selection?.kind === "room" && selection.id === room.id;
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    aria-pressed={picked}
                    aria-label={`${room.name}, ${Math.round(room.areaSqft)} square feet`}
                    onClick={() => selectObject({ kind: "room", id: room.id })}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left font-mono text-xs transition-colors ${
                      picked ? "bg-aura-emerald/10 text-aura-text" : "text-aura-text/65 hover:text-aura-text"
                    }`}
                  >
                    <span>{room.name}</span>
                    <span className="tabular-nums text-aura-text/55">{Math.round(room.areaSqft)} sq ft</span>
                  </button>
                </li>
              );
            })}
            {storey.vertices.map((vertex) => {
              const picked = selection?.kind === "vertex" && selection.id === vertex.id;
              return (
                <li key={vertex.id}>
                  <button
                    type="button"
                    aria-pressed={picked}
                    aria-label={`Vertex ${vertex.id}, X ${feet(vertex.xFt)} feet, Z ${feet(vertex.zFt)} feet`}
                    onClick={() => selectObject({ kind: "vertex", id: vertex.id })}
                    onKeyDown={(event) => nudgeVertex(event, vertex.id)}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left font-mono text-xs transition-colors ${
                      picked ? "bg-aura-emerald/10 text-aura-text" : "text-aura-text/65 hover:text-aura-text"
                    }`}
                  >
                    <span>Vertex {vertex.id}</span>
                    <span className="tabular-nums text-aura-text/55">
                      {feet(vertex.xFt)}, {feet(vertex.zFt)} ft
                    </span>
                  </button>
                </li>
              );
            })}
            {storey.walls.map((wall) => {
              const picked = selection?.kind === "wall" && selection.id === wall.id;
              const noun = wall.kind === "partition" ? "Partition" : "Wall";
              const run = wallRunFt(wall, vertexById);
              return [
                <li key={wall.id}>
                  <button
                    type="button"
                    aria-pressed={picked}
                    aria-label={`${noun} ${wall.id}, ${feet(run)} feet long, ${feet(wall.thicknessFt)} feet thick`}
                    onClick={() => selectObject({ kind: "wall", id: wall.id })}
                    className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left font-mono text-xs transition-colors ${
                      picked ? "bg-aura-emerald/10 text-aura-text" : "text-aura-text/65 hover:text-aura-text"
                    }`}
                  >
                    <span>
                      {noun} {wall.id}
                    </span>
                    <span className="tabular-nums text-aura-text/55">{feet(run)} ft</span>
                  </button>
                </li>,
                ...wall.openings.map((opening) => {
                  const chosen = selection?.kind === "opening" && selection.id === opening.id;
                  return (
                    <li key={`${wall.id}:${opening.id}`}>
                      <button
                        type="button"
                        aria-pressed={chosen}
                        aria-label={`${openingNoun(opening)} ${opening.id} on wall ${wall.id}, offset ${feet(opening.offsetFt)} feet, width ${feet(opening.widthFt)} feet`}
                        onClick={() => selectObject({ kind: "opening", wallId: wall.id, id: opening.id })}
                        className={`flex w-full items-baseline justify-between gap-3 py-2 pl-7 pr-3 text-left font-mono text-xs transition-colors ${
                          chosen ? "bg-aura-emerald/10 text-aura-text" : "text-aura-text/65 hover:text-aura-text"
                        }`}
                      >
                        <span>
                          {openingNoun(opening)} {opening.id}
                        </span>
                        <span className="tabular-nums text-aura-text/55">{feet(opening.widthFt)} ft</span>
                      </button>
                    </li>
                  );
                }),
              ];
            })}
          </ul>
        </div>

        <div>
          <p className="aura-label mb-2">Dimensions</p>
          {selectedRoom ? (
            <NameField
              label={`${selectedRoom.name} · name`}
              value={selectedRoom.name}
              revision={fieldRevision}
              onCommit={commitRoomName}
              note="The face is derived from the walls. The name is the only field a person authors."
            />
          ) : selectedVertex ? (
            <div className="flex flex-wrap gap-4">
              <NumberField
                label={`Vertex ${selectedVertex.id} · X (feet)`}
                value={selectedVertex.xFt}
                revision={fieldRevision}
                step={GRID_SNAP_FT}
                onCommit={fieldCommit(commitVertexX)}
              />
              <NumberField
                label={`Vertex ${selectedVertex.id} · Z (feet)`}
                value={selectedVertex.zFt}
                revision={fieldRevision}
                step={GRID_SNAP_FT}
                onCommit={fieldCommit(commitVertexZ)}
                note={`Arrow keys move the selected vertex by ${feet(GRID_SNAP_FT)} ft, Shift+arrow by ${feet(COARSE_STEP_FT)} ft. A typed value is used exactly.`}
              />
            </div>
          ) : selectedOpening && selectedWall ? (
            <div className="flex flex-wrap gap-4">
              <NumberField
                label="Offset (feet)"
                value={selectedOpening.offsetFt}
                revision={fieldRevision}
                step={GRID_SNAP_FT}
                onCommit={fieldCommit((value) =>
                  commitOpening(selectedOpening, selectedWall, {
                    offsetFt: value,
                    widthFt: selectedOpening.widthFt,
                    sillFt: selectedOpening.sillFt,
                    heightFt: selectedOpening.heightFt,
                  }),
                )}
              />
              <NumberField
                label="Width (feet)"
                value={selectedOpening.widthFt}
                revision={fieldRevision}
                step={GRID_SNAP_FT}
                onCommit={fieldCommit((value) =>
                  commitOpening(selectedOpening, selectedWall, {
                    offsetFt: selectedOpening.offsetFt,
                    widthFt: value,
                    sillFt: selectedOpening.sillFt,
                    heightFt: selectedOpening.heightFt,
                  }),
                )}
              />
              <NumberField
                label="Sill (feet)"
                value={selectedOpening.sillFt}
                revision={fieldRevision}
                step={GRID_SNAP_FT}
                onCommit={fieldCommit((value) =>
                  commitOpening(selectedOpening, selectedWall, {
                    offsetFt: selectedOpening.offsetFt,
                    widthFt: selectedOpening.widthFt,
                    sillFt: value,
                    heightFt: selectedOpening.heightFt,
                  }),
                )}
              />
              <NumberField
                label="Head height (feet)"
                value={selectedOpening.heightFt}
                revision={fieldRevision}
                step={GRID_SNAP_FT}
                onCommit={fieldCommit((value) =>
                  commitOpening(selectedOpening, selectedWall, {
                    offsetFt: selectedOpening.offsetFt,
                    widthFt: selectedOpening.widthFt,
                    sillFt: selectedOpening.sillFt,
                    heightFt: value,
                  }),
                )}
                note="A typed value writes this opening through setGraphOpening. A hang-off or overlap is refused and the numbers snap back to the box the wall actually has."
              />
            </div>
          ) : selectedWall ? (
            <div className="flex flex-wrap gap-4">
              <NumberField
                label={`Wall ${selectedWall.id} · length (feet)`}
                value={wallRunFt(selectedWall, vertexById)}
                revision={fieldRevision}
                step={GRID_SNAP_FT}
                onCommit={fieldCommit((value) => commitWallLength(selectedWall, value))}
                note="Length slides this wall's end vertex along its own direction; every other vertex stays put."
              />
              <NumberField
                label="Thickness (feet)"
                value={selectedWall.thicknessFt}
                revision={fieldRevision}
                step={0.05}
                onCommit={fieldCommit((value) => commitWallThickness(selectedWall, value))}
                note="Thickness is a property of this wall only. Neighbouring walls keep the thickness they already have."
              />
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-aura-text/55">
              Select a vertex, wall, opening or room to read and type its exact values.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tool === "shape" ? (
          <>
            <Button onClick={addCorner}>Add corner to selected wall</Button>
            <Button onClick={extrudeSelectedWall}>Extrude selected wall 2 ft</Button>
            <span className="text-xs text-aura-text/55">Select a wall, add its midpoint, then drag that new corner.</span>
          </>
        ) : (
          <>
            <Button onClick={addPartition}>Add partition</Button>
            <span className="text-xs text-aura-text/55">{partitionEnds.length}/2 endpoints selected</span>
          </>
        )}
      </div>
      {problem ? (
        /* RENEGOTIATED (AX01): this paragraph carried role="alert" and was the
           file's ONLY live region. It announced refusals assertively and
           announced nothing else — an accepted move was silent, and a refusal
           reached a screen reader only because the visible notice happened to
           be an alert. The polite status line above now carries every outcome,
           refusals included, and two live regions holding the same sentence
           would speak every refusal twice. The visible violet notice is
           unchanged; only the duplicate announcement is gone. */
        <p className="mt-4 rounded-md border border-aura-violet px-3 py-2 text-xs leading-relaxed text-aura-violet">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
