/**
 * Typed client for the design service (`design-api/`).
 *
 * Kept as its own module so the 02 · DESIGN page can adopt it with a single
 * import once that page is free — it is currently being edited by the
 * concurrent build session, and this file deliberately touches nothing else.
 *
 * The service is designed to degrade rather than fail: it answers with a full
 * blueprint even when no LLM or image key is configured, and reports which
 * path it took. This client surfaces that instead of hiding it.
 */

export type EcoMaterial = "sip" | "rammed_earth" | "clt" | "timber_frame";
export type HomeStyle =
  | "scandinavian_minimalist"
  | "off_grid_cabin"
  | "passive_solar"
  | "modern_aframe";
export type ClimateZone = "4" | "5" | "6" | "7A" | "7B" | "8";

export interface DesignRequest {
  bedrooms: number;
  bathrooms: number;
  total_sq_ft: number;
  climate_zone?: ClimateZone;
  material?: EcoMaterial;
  style?: HomeStyle;
  storeys?: 1 | 2;
  off_grid?: boolean;
  notes?: string;
}

export interface PlacedRoom {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  windows: number;
  wet: boolean;
}

export interface FloorPlan {
  width: number;
  height: number;
  wall_mm: number;
  partition_mm: number;
  rooms: PlacedRoom[];
  gross_sq_ft: number;
  net_sq_ft: number;
  /** 0..1 — measured against the 0.22 NBC 9.36 prescriptive ceiling. */
  fdwr: number;
  warnings: string[];
}

export interface RenderPrompt {
  prompt: string;
  negative_prompt: string;
  view: "exterior" | "interior" | "isometric";
  material_keywords: string[];
}

export interface DesignResponse {
  request: DesignRequest;
  layout: { house_style: string; total_sq_ft: number; rooms: unknown[] };
  plan: FloorPlan;
  render_prompts: RenderPrompt[];
  artifacts: {
    svg_url: string | null;
    pdf_url: string | null;
    dxf_url: string | null;
    render_urls: string[];
  };
  /** true when no LLM was configured and the deterministic planner ran. */
  offline: boolean;
  notes: string[];
}

const BASE =
  process.env.NEXT_PUBLIC_DESIGN_API?.replace(/\/$/, "") || "http://localhost:8000";

/** Absolute URL for an artifact path returned by the service. */
export const artifactUrl = (p: string | null): string | null =>
  p ? `${BASE}${p}` : null;

export interface DesignHealth {
  ok: boolean;
  llm: boolean;
  llm_provider: string | null;
  images: boolean;
  image_model: string | null;
}

export async function designHealth(signal?: AbortSignal): Promise<DesignHealth | null> {
  try {
    const r = await fetch(`${BASE}/health`, { signal, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as DesignHealth;
  } catch {
    return null; // service not running is a normal state in dev
  }
}

export async function generateDesign(
  req: DesignRequest,
  signal?: AbortSignal
): Promise<DesignResponse> {
  const r = await fetch(`${BASE}/design`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      climate_zone: "7A",
      material: "sip",
      style: "off_grid_cabin",
      storeys: 1,
      off_grid: true,
      ...req,
    }),
    signal,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`design service ${r.status}: ${detail.slice(0, 200)}`);
  }
  return (await r.json()) as DesignResponse;
}

/** FDWR formatted the way the drawing's title block states it. */
export const formatFdwr = (fdwr: number): string =>
  `${(fdwr * 100).toFixed(1)}% (NBC 9.36 prescriptive max 22%)`;
