/* ---------------------------------------------------------------------
   THE LOCAL DESIGN ENGINE — the browser's own answer to 02 · DESIGN.

   `materials.ts`, `layout.ts` and `blueprint.ts` are faithful ports of the
   FastAPI service's deterministic path. This module is the seam that makes
   them look, from the outside, exactly like the service: one call in, one
   `DesignResponse` out.

   WHY IT EXISTS. aurahomes.fun is a static export on GitHub Pages. The
   service's deterministic path needs no keys, no network and no state — it
   turns a room PROGRAM into geometry with pure arithmetic — so there is no
   reason for it to be a server the site can fail to reach. Running it here
   means the centrepiece of the product always draws: no process to start
   before a demo, no cold start, no latency, nothing to go down during
   judging. The Python service stays exactly as it is and becomes the
   optional upgrade that adds an LLM-authored room program and AI renders.

   WHAT THIS PATH HONESTLY IS. `offline: true`, and the notes say so in
   words. It is the same code the service runs when no credential is
   configured — `llm.design_program()` falling through to
   `layout.default_program()` — and the drawing it produces is the same
   drawing. What it does NOT have is the model's judgement about room naming
   and proportion, and it does not have renders.

   WHAT IT DELIBERATELY DOES NOT DO:
   · No render prompts. The prompt engine (`services/prompts.py`) is not
     ported, so this path returns none rather than composing prompt text the
     service never wrote. An empty list is the truth; a plausible-looking
     prompt would not be.
   · No PDF, no DXF. Both are written by native libraries (cairosvg, ezdxf)
     that do not exist in a browser. The SVG is the whole drawing, inline.

   PURITY CONTRACT, inherited from the three ports: no network, no Node
   APIs, no `Math.random`, no `Date.now`. The same brief always produces the
   same plan, byte for byte — which is what lets the drawing, the room
   schedule and the envelope stats agree with each other.
--------------------------------------------------------------------- */

import type { DesignRequest, DesignResponse } from "@/lib/designApi";
import { blueprintDataUrl, renderBlueprintSvg } from "./blueprint";
import { defaultProgram, solve } from "./layout";
import { ecoSystems, honestyNotes } from "./materials";

/* The engine's public surface, re-exported explicitly rather than with
   `export *`: the three modules deliberately carry same-named helpers
   (`pyRound`, `WALL_HEIGHT_FT`) whose definitions are scoped to their own
   file, and a star re-export would collide on them. */
export { blueprintDataUrl, renderBlueprintSvg } from "./blueprint";
export type { BlueprintOptions, BlueprintPlan, BlueprintRoom } from "./blueprint";
export { defaultProgram, envelopeFor, solve, HALL_W, MIN_DIM } from "./layout";
export type {
  LayoutPlan,
  Opening,
  RoomSpec,
  SolvedFloorPlan,
  SolvedRoom,
} from "./layout";
export { buildBom, ecoSystems, honestyNotes, FDWR_MAX, WALL_THICKNESS_MM } from "./materials";
export type { BillOfMaterials, EcoSystems, LineItem } from "./materials";

/**
 * The request as the engine actually used it.
 *
 * `DesignRequest` leaves most fields optional and the service fills them from
 * the Pydantic defaults. `solve()` and the title block apply the same `??`
 * defaults internally, so this resolves them once and echoes the resolved
 * object back on the response — the sheet and the page then describe the brief
 * that was drawn rather than the brief that was typed.
 */
export function resolveRequest(req: DesignRequest): DesignRequest {
  return {
    ...req,
    climate_zone: req.climate_zone ?? "7A", // the Alberta pilot
    material: req.material ?? "sip", // SIP: the envelope is the enemy in 7A
    style: req.style ?? "off_grid_cabin",
    storeys: req.storeys ?? 1,
    off_grid: req.off_grid ?? true, // off-grid is the Aura default, not an option
  };
}

/** Which engine drew it — stated in words, first, before any of the numbers. */
const PATH_NOTE =
  "Generated in this browser by the deterministic geometry engine: the room-program " +
  "arithmetic, the squarified packer, the 6-foot minimum-dimension check, the 22% NBC " +
  "9.36 FDWR ceiling and the 1/4\" = 1'-0\" drafting code are the same logic the design " +
  "service runs with no credentials configured. Nothing here came off a network.";

/** cairosvg and ezdxf are native writers; neither has a browser equivalent. */
const ARTIFACT_NOTE =
  "PDF and DXF are service-only — both are written by native libraries that cannot run " +
  "in a browser. The drawing above is the complete SVG sheet.";

/** Said plainly so an empty prompt list is never mistaken for a failure. */
const RENDER_NOTE =
  "No rendering prompts and no AI renders on this path: the prompt engine and the image " +
  "backend are service-side. Connecting the design service adds an LLM-authored room " +
  "program and, with an image credential, renders — the packer and the drafting code " +
  "stay exactly this code.";

/**
 * Run the deterministic pipeline end to end and answer in the service's own
 * shape, so a caller can hold the result as a `DesignResponse` without caring
 * which engine produced it.
 *
 * Throws only if the program cannot be packed at all (`solve()` raises on an
 * empty room list). The caller is expected to surface that rather than
 * substitute anything.
 */
export function generateDesignLocally(req: DesignRequest): DesignResponse {
  const resolved = resolveRequest(req);

  // The LLM's job, done arithmetically: how many rooms, roughly how big,
  // which want windows, which are wet. Never coordinates.
  const layout = defaultProgram(resolved);
  // The packer's job: real coordinates, right angles, and the warnings.
  const plan = solve(resolved, layout);
  const svg = renderBlueprintSvg(plan, resolved);

  /* Note order mirrors `routers_design.solve_design()`: which path ran, then
     the layout engine's warnings, then the standing honesty notes, then what
     this instance could not produce. The result panel re-reads `plan.warnings`
     out of this list so they are not printed twice. */
  const notes: string[] = [PATH_NOTE, ...plan.warnings];

  /* The frozen `DesignRequest` has no `systems` field, so the service always
     applies its Pydantic defaults to a request from this client. `ecoSystems()`
     is those same defaults — which makes these the exact notes the service
     would have returned for this brief: AWG at zero litres outdoors in winter,
     the December solar collapse, and screw piles carrying embodied carbon. */
  notes.push(...honestyNotes(ecoSystems(), resolved.climate_zone ?? "7A"));
  notes.push(ARTIFACT_NOTE, RENDER_NOTE);

  return {
    request: resolved,
    layout,
    plan,
    // Empty on purpose — see the header. Nothing is invented to fill it.
    render_prompts: [],
    artifacts: {
      // Inline: the sheet travels in the response instead of being fetched
      // back off a server that, on this path, does not exist.
      svg_url: blueprintDataUrl(svg),
      pdf_url: null,
      dxf_url: null,
      render_urls: [],
    },
    // The room program was derived, not reasoned. Always true here.
    offline: true,
    notes,
  };
}
