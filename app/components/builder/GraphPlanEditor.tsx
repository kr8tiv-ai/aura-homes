"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  addPartitionEdge,
  moveGraphVertex,
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
  const storey = graph.storeys[0];
  const [tool, setTool] = useState<Tool>("shape");
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [partitionEnds, setPartitionEnds] = useState<string[]>([]);
  const [preview, setPreview] = useState<BuildingGraph | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const drag = useRef<{ vertexId: string; graph: BuildingGraph } | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const shown = preview ?? graph;
  const shownStorey = shown.storeys[0];
  // Keep the pointer transform fixed for the whole gesture. Reframing around
  // every preview vertex would move the coordinate system under the cursor.
  const bounds = useMemo(() => graphBounds(storey), [storey]);

  const toGraphPoint = (event: ReactPointerEvent<SVGSVGElement>): GraphPoint => {
    const rect = svg.current!.getBoundingClientRect();
    return [
      bounds.x + ((event.clientX - rect.left) / rect.width) * bounds.width,
      bounds.y + ((event.clientY - rect.top) / rect.height) * bounds.height,
    ];
  };

  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const moved = moveGraphVertex(
      drag.current.graph,
      storey.id,
      drag.current.vertexId,
      toGraphPoint(event),
      0.5,
    );
    if (!moved.ok) {
      setProblem(moved.problem);
      return;
    }
    setProblem(null);
    setPreview(moved.graph);
  };

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    if (preview && preview !== graph) onEdit(preview, `graph:vertex:${drag.current.vertexId}`);
    drag.current = null;
    setPreview(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
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

      <div className="mt-5 overflow-hidden rounded-lg border aura-hairline bg-aura-sunken">
        <svg
          ref={svg}
          viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
          className="aspect-[16/10] min-h-[20rem] w-full touch-none"
          role="img"
          aria-label="Editable building graph plan, north is up"
          onPointerMove={pointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
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
                onPointerDown={(event) => {
                  if (tool !== "shape") return;
                  event.stopPropagation();
                  drag.current = { vertexId: vertex.id, graph };
                  setPreview(graph);
                  svg.current?.setPointerCapture(event.pointerId);
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
