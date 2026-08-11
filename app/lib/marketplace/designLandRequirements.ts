import type { BuilderDocument } from "@/lib/builder/document";
import { summarizeBuildingGraph } from "@/lib/builder/graphGeometry";
import {
  groundFootprintSqFt,
  ridgeHeightFt,
  totalFloorAreaSqFt,
} from "@/lib/builder/spec";

import type { LandDesignRequirements } from "./discovery";

/** Heavy builder geometry adapter. Browser routes load it only for a project handoff. */
export function deriveLandRequirements(document: BuilderDocument): LandDesignRequirements {
  if (document.geometry.kind === "building-graph") {
    const summary = summarizeBuildingGraph(document.geometry.graph);
    const groundElevationFt = Math.min(
      ...document.geometry.graph.storeys.map((storey) => storey.elevationFt),
    );
    return {
      floorAreaSqft: summary.totalFloorAreaSqFt,
      footprintSqft: summary.groundFootprintSqFt,
      storeys: document.geometry.graph.storeys.length === 1 ? 1 : 2,
      maxHeightFt: summary.maxRidgeHeightFt - groundElevationFt,
      preferredWater: "cistern",
    };
  }
  return {
    floorAreaSqft: totalFloorAreaSqFt(document.spec),
    footprintSqft: groundFootprintSqFt(document.spec),
    storeys: document.spec.volumes.some((volume) => volume.storeys > 1) ? 2 : 1,
    maxHeightFt: Math.max(...document.spec.volumes.map(ridgeHeightFt), 0),
    preferredWater: "cistern",
  };
}
