"use client";

/* Direct manipulation of BuildingGraph vertices in the 3D view.

   Enters through Viewport `houseChildren` so Viewport.tsx stays closed.
   Every move goes through `moveGraphVertex` at GRAPH_VERTEX_SNAP_FT — the
   same mutator and snap `applyGraphVertexEdit` uses for typed figures. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { moveGraphVertex, type BuildingGraph } from "@/lib/builder/buildingGraph";
import { EXPORT_IGNORE } from "@/lib/builder/exportSpec";
import { PICK_HIGHLIGHT_COLOR } from "@/lib/builder/surfaces";
import { GRAPH_VERTEX_SNAP_FT } from "@/lib/builder/graphEdit";

const HANDLE_R_FT = 0.28;

interface DragState {
  storeyId: string;
  vertexId: string;
  graph0: BuildingGraph;
  label: string;
  plane: THREE.Plane;
  applied: { xFt: number; zFt: number } | null;
}

export function GraphCanvasEditor({
  graph,
  onEdit,
  onStatus,
  enabled = true,
}: {
  graph: BuildingGraph;
  onEdit: (next: BuildingGraph, label: string) => void;
  onStatus?: (problem: string | null) => void;
  enabled?: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const drag = useRef<DragState | null>(null);
  const live = useRef({ onEdit, onStatus, graph });
  live.current = { onEdit, onStatus, graph };
  const gesture = useRef(0);
  const [grabbing, setGrabbing] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const setCursor = useCallback(
    (value: string) => {
      gl.domElement.style.cursor = value;
    },
    [gl],
  );

  useEffect(
    () => () => {
      if (controls) controls.enabled = true;
      gl.domElement.style.cursor = "";
    },
    [controls, gl],
  );

  const solve = useCallback(
    (clientX: number, clientY: number): void => {
      const state = drag.current;
      if (!state) return;
      const el = gl.domElement;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (Math.abs(raycaster.ray.direction.dot(state.plane.normal)) < 0.08) return;
      if (!raycaster.ray.intersectPlane(state.plane, hit)) return;

      const moved = moveGraphVertex(
        state.graph0,
        state.storeyId,
        state.vertexId,
        [hit.x, hit.z],
        GRAPH_VERTEX_SNAP_FT,
      );
      if (!moved.ok) {
        live.current.onStatus?.(moved.problem);
        return;
      }
      live.current.onStatus?.(null);
      const vertex = moved.graph.storeys
        .find((storey) => storey.id === state.storeyId)
        ?.vertices.find((item) => item.id === state.vertexId);
      if (!vertex) return;
      const same =
        state.applied !== null &&
        state.applied.xFt === vertex.xFt &&
        state.applied.zFt === vertex.zFt;
      if (!same) {
        state.applied = { xFt: vertex.xFt, zFt: vertex.zFt };
        live.current.onEdit(moved.graph, state.label);
      }
      invalidate();
    },
    [camera, gl, hit, invalidate, ndc, raycaster],
  );

  const end = useCallback(
    (cancelled: boolean) => {
      const state = drag.current;
      drag.current = null;
      setGrabbing(false);
      if (controls) controls.enabled = true;
      setCursor("");
      if (!state) return;
      if (cancelled) {
        live.current.onStatus?.(null);
        live.current.onEdit(state.graph0, state.label);
      }
    },
    [controls, setCursor],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => solve(event.clientX, event.clientY);
    const onUp = () => end(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") end(true);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [end, solve]);

  const begin = (storeyId: string, vertexId: string, yFt: number) => (event: ThreeEvent<PointerEvent>) => {
    if (!enabled) return;
    event.stopPropagation();
    gesture.current += 1;
    if (controls) controls.enabled = false;
    setGrabbing(true);
    setCursor("grabbing");
    drag.current = {
      storeyId,
      vertexId,
      graph0: live.current.graph,
      label: `graph:vertex:${vertexId}:${gesture.current}`,
      plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -yFt),
      applied: null,
    };
    solve(event.nativeEvent.clientX, event.nativeEvent.clientY);
  };

  return (
    <group userData={{ [EXPORT_IGNORE]: true }}>
      {graph.storeys.flatMap((storey) => {
        const yFt = storey.elevationFt + storey.heightFt * 0.5;
        return storey.vertices.map((vertex) => {
          const id = `${storey.id}:${vertex.id}`;
          const active = grabbing && drag.current?.vertexId === vertex.id;
          return (
            <mesh
              key={id}
              position={[vertex.xFt, yFt, vertex.zFt]}
              onPointerDown={begin(storey.id, vertex.id, yFt)}
              onPointerOver={(event) => {
                event.stopPropagation();
                if (!grabbing) {
                  setHovered(id);
                  setCursor("grab");
                }
              }}
              onPointerOut={() => {
                if (!grabbing) {
                  setHovered((current) => (current === id ? null : current));
                  setCursor("");
                }
              }}
            >
              <sphereGeometry args={[HANDLE_R_FT, 16, 12]} />
              <meshBasicMaterial
                color={active || hovered === id ? PICK_HIGHLIGHT_COLOR : "#e8efe6"}
                depthTest={false}
                transparent
                opacity={0.95}
              />
            </mesh>
          );
        });
      })}
    </group>
  );
}
