// I/O glue for the MCP server: repo data files, bundled samples, and the
// partial-questionnaire merge. All pipeline/brain LOGIC stays in the existing
// modules (../pipeline, ../parcels, ../brain) - this file only loads and merges.

import * as fs from "fs";
import * as path from "path";
import { JourneyState, Stage, STAGE_ORDER, Substep } from "../brain/types";
import { DEFAULT_COST_MODEL } from "../pipeline";
import {
  CostModelInput,
  isRepoCostModel,
  ParcelListing,
  Questionnaire,
} from "../types";

// dist/mcp -> agent package root -> repo root.
export const PACKAGE_ROOT = path.join(__dirname, "..", "..");
export const REPO_ROOT = path.join(PACKAGE_ROOT, "..");
export const COST_MODEL_PATH = path.join(REPO_ROOT, "data", "alberta", "cost-model.json");
export const SUPPLIERS_PATH = path.join(REPO_ROOT, "data", "alberta", "suppliers.json");
const SAMPLES_DIR = path.join(PACKAGE_ROOT, "samples");

// ---------------------------------------------------------------- cost model

/** Raw fields of data/alberta/cost-model.json beyond the typed RepoCostModel. */
export interface CostModelExtras {
  totalsRule?: string;
  totalsExLand?: { low: number; mid: number; high: number };
  asOf?: string;
}

export interface LoadedCostModel {
  model: CostModelInput;
  source: string;
  extras: CostModelExtras;
}

/** Same load-or-fallback behaviour as the demo CLI (src/index.ts). */
export function loadCostModel(): LoadedCostModel {
  if (fs.existsSync(COST_MODEL_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(COST_MODEL_PATH, "utf8")) as CostModelInput &
        CostModelExtras;
      if (isRepoCostModel(raw)) {
        return {
          model: raw,
          source: COST_MODEL_PATH,
          extras: { totalsRule: raw.totalsRule, totalsExLand: raw.totalsExLand, asOf: raw.asOf },
        };
      }
    } catch {
      // fall through to defaults
    }
  }
  return { model: DEFAULT_COST_MODEL, source: "built-in defaults", extras: {} };
}

// ---------------------------------------------------------------- suppliers

export interface SupplierEntry {
  name: string;
  location?: string;
  note?: string;
  url?: string;
  albertaLocal?: boolean;
}

export interface SupplierDirectory {
  $schema?: string;
  principle?: string;
  asOf?: string;
  categories: Record<string, SupplierEntry[]>;
}

export function loadSuppliers(): SupplierDirectory {
  return JSON.parse(fs.readFileSync(SUPPLIERS_PATH, "utf8")) as SupplierDirectory;
}

// ---------------------------------------------------------------- samples

export function loadSampleQuestionnaire(): Questionnaire {
  return JSON.parse(
    fs.readFileSync(path.join(SAMPLES_DIR, "questionnaire.sample.json"), "utf8")
  ) as Questionnaire;
}

export function loadSampleParcels(): ParcelListing[] {
  return JSON.parse(
    fs.readFileSync(path.join(SAMPLES_DIR, "parcels.sample.json"), "utf8")
  ) as ParcelListing[];
}

export function loadSampleJourney(): JourneyState {
  return JSON.parse(
    fs.readFileSync(path.join(SAMPLES_DIR, "journey.sample.json"), "utf8")
  ) as JourneyState;
}

// ---------------------------------------------------------------- merging

/** Section-wise partial questionnaire, as accepted by the MCP tools. */
export interface QuestionnairePatch {
  projectName?: string;
  parcel?: Partial<Questionnaire["parcel"]>;
  home?: Partial<Questionnaire["home"]>;
  energy?: Partial<Questionnaire["energy"]>;
  water?: Partial<Questionnaire["water"]>;
  extras?: Partial<Questionnaire["extras"]>;
  contingencyRate?: number;
}

/** Merges a partial questionnaire over the sample (section-wise, shallow per section). */
export function mergeQuestionnaire(
  base: Questionnaire,
  patch?: QuestionnairePatch
): Questionnaire {
  if (!patch) return base;
  return {
    projectName: patch.projectName ?? base.projectName,
    parcel: { ...base.parcel, ...patch.parcel },
    home: { ...base.home, ...patch.home },
    energy: { ...base.energy, ...patch.energy },
    water: { ...base.water, ...patch.water },
    extras: { ...base.extras, ...patch.extras },
    contingencyRate: patch.contingencyRate ?? base.contingencyRate,
  };
}

/** Loose journey input: any missing stage lists / optional blocks get defaults. */
export interface JourneyInput {
  buildId: string;
  projectName: string;
  parcel?: string;
  stage: Stage;
  substeps?: Partial<Record<Stage, Substep[]>>;
  blockers?: JourneyState["blockers"];
  escrow: JourneyState["escrow"];
  keyDates?: JourneyState["keyDates"];
  emailPrefs?: JourneyState["emailPrefs"];
}

/** Normalizes caller-provided journey state (or falls back to the sample). */
export function normalizeJourney(input?: JourneyInput): JourneyState {
  if (!input) return loadSampleJourney();
  const substeps = {} as Record<Stage, Substep[]>;
  for (const stage of STAGE_ORDER) substeps[stage] = input.substeps?.[stage] ?? [];
  return {
    buildId: input.buildId,
    projectName: input.projectName,
    parcel: input.parcel,
    stage: input.stage,
    substeps,
    blockers: input.blockers ?? [],
    escrow: input.escrow,
    keyDates: input.keyDates ?? {},
    emailPrefs: input.emailPrefs ?? { weeklyDigest: true, materialChanges: true },
  };
}
