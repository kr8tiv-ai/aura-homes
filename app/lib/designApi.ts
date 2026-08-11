/**
 * Typed client for the design step — local engine first, service optional.
 *
 * THE INVERSION. This started as a client for the FastAPI service in
 * `design-api/`, and an unreachable service was a dead end. It is not one any
 * more. The service's deterministic path — the part that needs no keys and no
 * network — is ported to TypeScript in `lib/design/`, so a design can always be
 * produced. `requestDesign()` tries the service and falls back to the local
 * engine, and the caller is told, in three distinguishable outcomes, which one
 * answered. aurahomes.fun is a static export: there is no server in production,
 * and the centrepiece of the product still has to work.
 *
 * WHAT THE SERVICE STILL ADDS, when one is connected: an LLM reasons the room
 * PROGRAM (naming, proportion, which rooms want windows), and an image backend
 * produces renders. It never adds accuracy to the drawing — the packer and the
 * drafting code are identical on both paths.
 *
 * The service was already designed to degrade rather than fail: it answers with
 * a full blueprint even when no LLM or image key is configured, and reports
 * which path it took. This client surfaces that instead of hiding it.
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

/** The address this client calls, so a message about it names what was called. */
export const DESIGN_API_BASE = BASE;

/**
 * Whether an endpoint was actually configured, or `BASE` is the dev default.
 *
 * Worth distinguishing: "nothing is deployed at localhost:8000 because nothing
 * was ever pointed at" is a different sentence from "the service you configured
 * is down", and the page says whichever is true.
 */
export const DESIGN_API_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_DESIGN_API);

/* Artifacts arrive as service-relative paths (`/design/<id>.svg`) — but the
   local engine returns its sheet inline as a `data:` URL, and image backends
   return absolute provider URLs. Anything already absolute is passed through
   untouched; prefixing BASE onto a data URL would break the drawing. */
const ABSOLUTE_URL = /^(?:https?:|data:|blob:)/i;

/** Absolute URL for an artifact path returned by either engine. */
export const artifactUrl = (p: string | null): string | null =>
  p ? (ABSOLUTE_URL.test(p) ? p : `${BASE}${p}`) : null;

export interface DesignHealth {
  ok: boolean;
  llm: boolean;
  llm_provider: string | null;
  images: boolean;
  image_model: string | null;
}

/**
 * A signal that trips when the caller's does, or when `ms` elapses.
 *
 * Without a deadline a request to an address nothing is listening on can hang
 * until the browser's own timeout — minutes, on some networks. The local engine
 * is sitting right there, so waiting that long for a service that is not coming
 * is the one thing this page must not do.
 */
function deadline(ms: number, signal?: AbortSignal) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  const relay = () => ac.abort();
  if (signal) {
    if (signal.aborted) ac.abort();
    else signal.addEventListener("abort", relay, { once: true });
  }
  return {
    signal: ac.signal,
    release() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", relay);
    },
  };
}

/** Health probes are a status pill, not a result — they wait a short beat. */
const HEALTH_TIMEOUT_MS = 3_500;

/** A brief a service is going to answer, it answers well inside this. */
const SERVICE_TIMEOUT_MS = 8_000;

export async function designHealth(signal?: AbortSignal): Promise<DesignHealth | null> {
  const d = deadline(HEALTH_TIMEOUT_MS, signal);
  try {
    const r = await fetch(`${BASE}/health`, { signal: d.signal, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as DesignHealth;
  } catch {
    return null; // no service is a normal state — the local engine covers it
  } finally {
    d.release();
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

/* =====================================================================
   LOCAL-FIRST: the service is the upgrade, not the requirement
   ===================================================================== */

/**
 * Why the service did not produce this result.
 *
 * Two very different facts, kept apart because they need different words:
 * `unreachable` means nothing answered at all (normal — the static site has no
 * service), `rejected` means a service answered and refused the brief (a real
 * signal about the request, and the one worth reading).
 */
export interface ServiceError {
  kind: "unreachable" | "rejected";
  message: string;
}

/**
 * `generateDesign` throws `design service <status>: …` when a service answered
 * and refused, and a network `TypeError` when nothing answered at all.
 */
export function classifyServiceError(err: unknown): ServiceError {
  const message = err instanceof Error ? err.message : String(err);
  return /^design service \d+/.test(message)
    ? { kind: "rejected", message }
    : { kind: "unreachable", message };
}

/**
 * The three outcomes, as one discriminated union so the UI cannot render a
 * result without saying which engine produced it.
 *
 * · `service` — a service answered. AI-reasoned room program, possibly renders.
 * · `local`   — no service answered (or it refused); the ported deterministic
 *               engine ran in the browser. Real geometry, no AI. `serviceError`
 *               carries what the service said, when it said anything.
 * · `none`    — the local engine itself failed. Should not happen; it is
 *               surfaced verbatim rather than papered over, and `response` is
 *               null because nothing is invented to fill it.
 */
export type DesignOutcome =
  | { engine: "service"; response: DesignResponse; serviceError: null; localError: null }
  | {
      engine: "local";
      response: DesignResponse;
      serviceError: ServiceError | null;
      localError: null;
    }
  | {
      engine: "none";
      response: null;
      serviceError: ServiceError | null;
      localError: string;
    };

/**
 * Produce a design. Tries the configured service, falls back to the engine in
 * `lib/design/`, and reports which one answered.
 *
 * The service is attempted even when `DESIGN_API_CONFIGURED` is false, because
 * `BASE` then points at the dev default and a developer running `uvicorn`
 * locally should get the AI path without setting an env var. It is bounded by
 * `SERVICE_TIMEOUT_MS`, so an address nothing is listening on costs a moment,
 * not the result.
 *
 * REJECTS ONLY ON CALLER ABORT. Every other failure is an outcome, never an
 * exception — that is the whole point of the union above.
 */
export async function requestDesign(
  req: DesignRequest,
  signal?: AbortSignal
): Promise<DesignOutcome> {
  let serviceError: ServiceError | null = null;

  const d = deadline(SERVICE_TIMEOUT_MS, signal);
  try {
    const response = await generateDesign(req, d.signal);
    return { engine: "service", response, serviceError: null, localError: null };
  } catch (err) {
    // The caller superseded this request (a second Generate, or unmount). Its
    // result is unwanted, so nothing is computed and nothing is reported.
    if (signal?.aborted) throw err;
    serviceError = classifyServiceError(err);
  } finally {
    d.release();
  }

  try {
    /* Imported lazily so the ~30 kB of geometry and drafting code is fetched
       when a design is actually asked for, rather than on every page that
       merely imports a type from this module. The static export code-splits it
       into its own chunk; it is still bundled, never network-dependent. */
    const { generateDesignLocally } = await import("./design");
    const response = generateDesignLocally(req);
    return { engine: "local", response, serviceError, localError: null };
  } catch (err) {
    return {
      engine: "none",
      response: null,
      serviceError,
      localError: err instanceof Error ? err.message : String(err),
    };
  }
}
