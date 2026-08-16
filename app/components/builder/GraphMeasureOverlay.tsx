"use client";

/* PR02 — live wall lengths in the graph-mode scene.

   Each label is `formatFeetInches` of the distance between that wall's two
   vertices, computed by `graphWallMeasures`. Nothing here invents a number.
   The group carries EXPORT_IGNORE so a .glb does not contain the tape. */

import { useMemo } from "react";
import { Html } from "@react-three/drei";

import type { BuildingGraph } from "@/lib/builder/buildingGraph";
import { EXPORT_IGNORE } from "@/lib/builder/exportSpec";
import { graphWallMeasures } from "@/lib/builder/graphMeasure";

export function GraphMeasureOverlay({ graph }: { graph: BuildingGraph }) {
  const measures = useMemo(() => graphWallMeasures(graph), [graph]);
  return (
    <group userData={{ [EXPORT_IGNORE]: true }}>
      {measures.map((measure) => (
        <Html
          key={`${measure.storeyId}:${measure.wallId}`}
          position={[measure.mid[0], measure.yFt, measure.mid[1]]}
          center
          sprite
          style={{ pointerEvents: "none" }}
        >
          <span className="rounded-sm bg-aura-void/80 px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-aura-text">
            {measure.label}
          </span>
        </Html>
      ))}
    </group>
  );
}
