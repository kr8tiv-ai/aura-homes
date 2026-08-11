"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  addGraphShaft,
  addGraphStair,
  addPartitionEdge,
  deriveStackedRoomRelationships,
  duplicateGraphStorey,
  moveGraphVertex,
  setGraphStoreyLevels,
  splitWallAt,
  type BuildingGraph,
  type GraphPoint,
  type GraphStorey,
} from "@/lib/builder/buildingGraph";
import { Button, Segmented } from "./ui";

type Tool = "shape" | "partition";

const TOOL_OPTIONS = [
  { id: "shape" as const, label: "Shape" },
  { id: "partition" as const, label: "Partition" },
];

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
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [partitionEnds, setPartitionEnds] = useState<string[]>([]);
  const [preview, setPreview] = useState<BuildingGraph | null>(null);
  const previewRef = useRef<BuildingGraph | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
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

  const moveDrag = (clientX: number, clientY: number) => {
    if (!drag.current) return;
    const moved = moveGraphVertex(
      drag.current.graph,
      storey.id,
      drag.current.vertexId,
      toGraphPoint(clientX, clientY),
      0.5,
    );
    if (!moved.ok) {
      setProblem(moved.problem);
      return;
    }
    setProblem(null);
    previewRef.current = moved.graph;
    setPreview(moved.graph);
  };

  const finishDrag = (pointerId?: number) => {
    if (!drag.current) return;
    const active = drag.current;
    const candidate = previewRef.current;
    if (candidate && candidate !== graph) onEdit(candidate, `graph:vertex:${active.vertexId}`);
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

  const selectVertex = (vertexId: string) => {
    if (tool !== "partition") return;
    const next = partitionEnds.includes(vertexId)
      ? partitionEnds.filter((id) => id !== vertexId)
      : [...partitionEnds, vertexId].slice(-2);
    setPartitionEnds(next);
    setProblem(null);
  };

  const addCorner = () => {
    const wall = storey.walls.find((item) => item.id === selectedWallId);
    if (!wall) {
      setProblem("Select an exterior wall first, then add a corner at its midpoint.");
      return;
    }
    const vertices = new Map(storey.vertices.map((vertex) => [vertex.id, vertex]));
    const start = vertices.get(wall.startVertexId)!;
    const end = vertices.get(wall.endVertexId)!;
    const length = Math.hypot(end.xFt - start.xFt, end.zFt - start.zFt);
    const ids = new Set(storey.vertices.map((vertex) => vertex.id));
    const split = splitWallAt(graph, storey.id, wall.id, length / 2, nextId(ids, "vertex"));
    if (!split.ok) {
      setProblem(split.problem);
      return;
    }
    setProblem(null);
    setSelectedWallId(null);
    onEdit(split.graph, `graph:split:${wall.id}`);
  };

  const addPartition = () => {
    if (partitionEnds.length !== 2) {
      setProblem("Choose two existing wall vertices. Add corners first when the endpoints do not exist yet.");
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
      setProblem(added.problem);
      return;
    }
    setProblem(null);
    setPartitionEnds([]);
    onEdit(added.graph, `graph:partition:${partitionEnds.join(":")}`);
  };

  const changeLevels = (levels: { elevationFt?: number; heightFt?: number }, label: string) => {
    const changed = setGraphStoreyLevels(graph, storey.id, levels);
    if (!changed.ok) {
      setProblem(changed.problem);
      return;
    }
    setProblem(null);
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
      setProblem(duplicated.problem);
      return;
    }
    setProblem(null);
    setActiveStoreyId(id);
    onEdit(duplicated.graph, `graph:duplicate-storey:${storey.id}`);
  };

  const addStairCore = () => {
    const levels = [...graph.storeys].sort(
      (a, b) => a.elevationFt - b.elevationFt || a.id.localeCompare(b.id),
    );
    if (levels.length < 2) {
      setProblem("Duplicate an aligned upper storey before adding a stair core.");
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
      setProblem("The aligned floor overlap is too small for Aura's 3 × 6 ft minimum stair core.");
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
      setProblem(added.problem);
      return;
    }
    setProblem(null);
    onEdit(added.graph, `graph:add-stair:${lower.id}:${upper.id}`);
  };

  const addServiceShaft = () => {
    const levels = [...graph.storeys].sort(
      (a, b) => a.elevationFt - b.elevationFt || a.id.localeCompare(b.id),
    );
    if (levels.length < 2) {
      setProblem("Duplicate an aligned upper storey before adding a service shaft.");
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
      setProblem("The aligned floor overlap is too small for a 2 × 2 ft service shaft.");
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
      setProblem(added.problem);
      return;
    }
    setProblem(null);
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
            Drag vertices on a half-foot grid. Invalid moves are refused atomically, so walls cannot
            cross and room faces always remain exact.
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
            setSelectedWallId(null);
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
            return (
              <g key={room.id} className="pointer-events-none">
                <polygon
                  points={points.map((vertex) => `${vertex.xFt},${vertex.zFt}`).join(" ")}
                  className="fill-aura-emerald/8"
                />
                <text x={centre[0]} y={centre[1]} textAnchor="middle" className="fill-aura-text/60 font-mono text-[0.65px]">
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
                  onClick={() => tool === "shape" && setSelectedWallId(wall.id)}
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

          {shownStorey.vertices.map((vertex) => {
            const selected = partitionEnds.includes(vertex.id);
            return (
              <circle
                key={vertex.id}
                cx={vertex.xFt}
                cy={vertex.zFt}
                r="0.55"
                className={`${selected ? "fill-aura-violet" : "fill-aura-emerald"} stroke-aura-panel cursor-grab active:cursor-grabbing`}
                strokeWidth="0.16"
                tabIndex={0}
                aria-label={`Vertex ${vertex.id} at ${vertex.xFt}, ${vertex.zFt} feet`}
                onClick={() => selectVertex(vertex.id)}
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

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tool === "shape" ? (
          <>
            <Button onClick={addCorner}>Add corner to selected wall</Button>
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
        <p className="mt-4 rounded-md border border-aura-violet px-3 py-2 text-xs leading-relaxed text-aura-violet" role="alert">
          {problem}
        </p>
      ) : null}
    </section>
  );
}
