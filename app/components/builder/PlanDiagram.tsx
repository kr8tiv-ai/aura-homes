"use client";

/* ===========================================================================
   PLAN DIAGRAMS — thumbnails that tell the twenty plans apart.

   The old diagram normalized its viewBox to each plan's own bounding box, so
   a 12×24 cabin and a 26×38 farmhouse rendered pixel-identically; roof form,
   pitch and storeys never appeared at all, and the glazing was a fixed
   proportional path rather than the plan's real openings. Twenty near-equal
   rectangles is exactly the founder's "clicking doesn't change anything".

   Three rules fix that here:
   · ONE SHARED SCALE. Every thumbnail draws at the catalog's common span, so
     footprints compare truly — a micro cabin IS small next to a family home.
     A floor keeps the smallest plans legible, and the real numbers are
     printed underneath so nothing depends on squinting.
   · THE ROOF IS DRAWN. Ridge for a gable/saltbox, apex diamond for an
     A-frame, fall arrow for a shed, parapet double-line for a flat roof —
     with the pitch printed. Storeys get a badge.
   · OPENINGS ARE REAL. Each volume's own `openings` array is walked: glazing
     walls as thick strokes at true position and width, doors as a gap with a
     swing arc, windows as short ticks. The deck is hatched. Two plans now
     look different because they ARE different.

   The selected-plan preview goes further: a real hidden-line axonometric of
   the instantiated home via the existing drawing engine — massing, roof and
   storeys visible the moment a card is clicked, with no second WebGL canvas
   and byte-stable output.
   =========================================================================== */

import { useMemo } from "react";

import { axonometricDataUrl, axonometricFromHome } from "@/lib/builder/axon";
import { buildHome, disposeHome } from "@/lib/builder/geometry";
import { PLAN_TEMPLATES, type PlanTemplate } from "@/lib/builder/planCatalog";
import type { Opening, Volume, Wall } from "@/lib/builder/spec";

/* ------------------------------------------------------------ shared scale */

interface Point {
  x: number;
  y: number;
}

function corners(plan: PlanTemplate): Point[] {
  const out: Point[] = [];
  for (const volume of plan.spec.volumes) {
    const radians = (volume.rotationDeg * Math.PI) / 180;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    for (const [localX, localY] of [
      [-volume.widthFt / 2, -volume.depthFt / 2],
      [volume.widthFt / 2, -volume.depthFt / 2],
      [volume.widthFt / 2, volume.depthFt / 2],
      [-volume.widthFt / 2, volume.depthFt / 2],
    ] as const) {
      out.push({
        x: volume.x + localX * c - localY * s,
        y: volume.z + localX * s + localY * c,
      });
    }
  }
  return out;
}

function boundsOf(plan: PlanTemplate) {
  const points = corners(plan);
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  return { minX, maxX, minY, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** The catalog's common drawing span: every thumbnail shares it, so size
 *  reads truthfully across cards. The floor keeps a micro cabin legible. */
export const CATALOG_SPAN_FT = Math.max(
  24,
  ...PLAN_TEMPLATES.map((plan) => {
    const b = boundsOf(plan);
    return Math.max(b.width, b.height);
  }),
);

/* -------------------------------------------------------- opening geometry */

/** Where an opening sits on its wall, in the volume's LOCAL frame.
 *
 *  `offsetFt` is measured from the wall's left end AS SEEN FROM OUTSIDE
 *  (spec.ts). Facing the building: from the south your left hand points
 *  west; from the north it points east; from the east, south; from the
 *  west, north. Exported so the chirality is pinned by a unit test rather
 *  than trusted. */
export function openingSegmentLocal(
  volume: Volume,
  opening: Opening,
): { x1: number; y1: number; x2: number; y2: number; wall: Wall } {
  const hw = volume.widthFt / 2;
  const hd = volume.depthFt / 2;
  const o = opening.offsetFt;
  const w = opening.widthFt;
  switch (opening.wall) {
    case "s": // z = +hd, left end (from outside) = west (-x), runs east
      return { x1: -hw + o, y1: hd, x2: -hw + o + w, y2: hd, wall: "s" };
    case "n": // z = -hd, left end = east (+x), runs west
      return { x1: hw - o, y1: -hd, x2: hw - o - w, y2: -hd, wall: "n" };
    case "e": // x = +hw, left end = south (+z), runs north
      return { x1: hw, y1: hd - o, x2: hw, y2: hd - o - w, wall: "e" };
    case "w": // x = -hw, left end = north (-z), runs south
      return { x1: -hw, y1: -hd + o, x2: -hw, y2: -hd + o + w, wall: "w" };
  }
}

/* -------------------------------------------------------------- the marks */

function roofMarks(volume: Volume): string {
  const hw = volume.widthFt / 2;
  const hd = volume.depthFt / 2;
  const alongX = volume.widthFt >= volume.depthFt;
  switch (volume.roof.form) {
    case "gable":
    case "saltbox":
      // ridge along the long axis
      return alongX
        ? `M ${-hw * 0.92} 0 H ${hw * 0.92}`
        : `M 0 ${-hd * 0.92} V ${hd * 0.92}`;
    case "a-frame":
      // the slope IS the wall: ridge plus apex diamond at centre
      return (
        (alongX ? `M ${-hw * 0.92} 0 H ${hw * 0.92}` : `M 0 ${-hd * 0.92} V ${hd * 0.92}`) +
        ` M 0 ${-1.4} L 1.4 0 L 0 1.4 L -1.4 0 Z`
      );
    case "shed": {
      // fall arrow towards the facing edge (defaults south)
      const len = Math.min(hd, hw) * 0.7;
      return `M 0 ${-len} V ${len} M -1.6 ${len - 2.2} L 0 ${len} L 1.6 ${len - 2.2}`;
    }
    case "flat":
      // parapet: inner outline
      return `M ${-hw + 1.2} ${-hd + 1.2} H ${hw - 1.2} V ${hd - 1.2} H ${-hw + 1.2} Z`;
  }
}

const ROOF_WORD: Record<Volume["roof"]["form"], string> = {
  gable: "gable",
  "a-frame": "a-frame",
  shed: "shed",
  flat: "flat",
  saltbox: "saltbox",
};

/* ------------------------------------------------------------ the diagram */

export function PlanDiagram({ plan }: { plan: PlanTemplate }) {
  const b = boundsOf(plan);
  const span = CATALOG_SPAN_FT * 1.18;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const pattern = `plan-grid-${plan.id}`;
  const primary = plan.spec.volumes[0];
  const deck = plan.spec.deck;

  return (
    <svg
      viewBox={`${cx - span / 2} ${cy - span / 2} ${span} ${span * 0.82}`}
      role="img"
      aria-label={`${plan.title}: ${Math.round(b.width)} by ${Math.round(b.height)} feet, ${plan.storeys} storey${plan.storeys === 1 ? "" : "s"}, ${ROOF_WORD[primary.roof.form]} roof`}
      className="plan-diagram"
    >
      <defs>
        <pattern id={pattern} width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M 4 0 L 0 0 0 4" fill="none" stroke="currentColor" strokeOpacity="0.07" strokeWidth="0.18" />
        </pattern>
        <pattern id={`${pattern}-hatch`} width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M 0 0 V 1.6" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.22" />
        </pattern>
      </defs>
      <rect x={cx - span / 2} y={cy - span / 2} width={span} height={span * 0.82} fill={`url(#${pattern})`} />

      {/* deck first, under the shells */}
      {deck && primary ? (
        <g transform={`translate(${primary.x} ${primary.z}) rotate(${primary.rotationDeg})`}>
          <rect
            x={-deck.widthFt / 2}
            y={primary.depthFt / 2}
            width={deck.widthFt}
            height={deck.depthFt}
            fill={`url(#${pattern}-hatch)`}
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="0.22"
          />
        </g>
      ) : null}

      {plan.spec.volumes.map((volume) => (
        <g key={volume.id} transform={`translate(${volume.x} ${volume.z}) rotate(${volume.rotationDeg})`}>
          <rect
            x={-volume.widthFt / 2}
            y={-volume.depthFt / 2}
            width={volume.widthFt}
            height={volume.depthFt}
            rx="0.3"
            className="plan-diagram__mass"
          />
          <path d={roofMarks(volume)} className="plan-diagram__roof" fill="none" />
          {volume.openings.map((opening) => {
            const seg = openingSegmentLocal(volume, opening);
            if (opening.kind === "glazing-wall") {
              return (
                <line key={opening.id} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} className="plan-diagram__glass" />
              );
            }
            if (opening.kind === "door") {
              // gap + quarter swing arc into the room
              const inward = seg.wall === "s" ? -1 : seg.wall === "n" ? 1 : 0;
              const inwardX = seg.wall === "e" ? -1 : seg.wall === "w" ? 1 : 0;
              const r = Math.min(opening.widthFt, 3.4);
              return (
                <g key={opening.id}>
                  <line x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} className="plan-diagram__door-gap" />
                  <path
                    d={`M ${seg.x1} ${seg.y1} A ${r} ${r} 0 0 ${seg.wall === "n" || seg.wall === "w" ? 0 : 1} ${
                      seg.x1 + inwardX * r
                    } ${seg.y1 + inward * r}`}
                    className="plan-diagram__door-swing"
                    fill="none"
                  />
                </g>
              );
            }
            return (
              <line key={opening.id} x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2} className="plan-diagram__window" />
            );
          })}
        </g>
      ))}

      {/* printed facts — the numbers the shared scale is honest about.
          y stays inside the 0.82-tall viewBox (half-height = 0.41 · span). */}
      <text x={cx} y={cy + span * 0.3} textAnchor="middle" className="plan-diagram__dims">
        {Math.round(b.width)}×{Math.round(b.height)} ft · {plan.storeys} sty · {ROOF_WORD[primary.roof.form]}
        {primary.roof.form === "flat" ? "" : ` ${Math.round(primary.roof.pitchDeg)}°`}
      </text>

      <g transform={`translate(${cx - span / 2 + 2.4} ${cy - span / 2 + 2.2})`} className="plan-diagram__north">
        <path d="M 0 2.4 L 1.1 0 L 2.2 2.4 Z" />
        <text x="1.1" y="4.4" textAnchor="middle">N</text>
      </g>
    </svg>
  );
}

/* ----------------------------------------------------------- axon preview */

/** The selected plan as a real hidden-line axonometric — the same drawing
 *  engine the builder's Drawings tab uses, so what a click shows IS what the
 *  product draws. Built, read, and disposed in one memoized pass (~30ms per
 *  selection); byte-stable per plan. */
export function PlanAxonPreview({ plan }: { plan: PlanTemplate }) {
  const src = useMemo(() => {
    const home = buildHome(plan.spec);
    try {
      const result = axonometricFromHome(home, { caption: false });
      return axonometricDataUrl(result.svg);
    } finally {
      disposeHome(home);
    }
  }, [plan]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${plan.title} — axonometric line drawing generated from the plan's own model`}
      className="plan-preview__axon"
      draggable={false}
    />
  );
}
