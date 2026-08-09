// CLI entry: reads a questionnaire JSON, writes design-brief/budget/milestones
// JSON to out/. Usage: node dist/index.js [questionnaire.json] [outDir]

import * as fs from "fs";
import * as path from "path";
import { generateNarrative } from "./claude";
import { filterParcels } from "./parcels";
import {
  budgetToMilestones,
  DEFAULT_COST_MODEL,
  designBriefToBudget,
  questionnaireToDesignBrief,
} from "./pipeline";
import {
  CostModelInput,
  DesignBrief,
  isRepoCostModel,
  ParcelListing,
  Questionnaire,
} from "./types";

const PACKAGE_ROOT = path.join(__dirname, "..");
// Repo-level cost data (aura-homes/data/alberta/cost-model.json), used if present.
const COST_MODEL_PATH = path.join(PACKAGE_ROOT, "..", "data", "alberta", "cost-model.json");

function loadCostModel(): { model: CostModelInput; source: string } {
  if (fs.existsSync(COST_MODEL_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(COST_MODEL_PATH, "utf8")) as CostModelInput;
      if (isRepoCostModel(raw)) {
        return { model: raw, source: COST_MODEL_PATH };
      }
      console.warn(
        `[aura-architect] ${COST_MODEL_PATH} does not match the expected schema (no lineItems). Using built-in defaults.`
      );
    } catch (err) {
      console.warn(`[aura-architect] Failed to parse ${COST_MODEL_PATH}: ${err}. Using defaults.`);
    }
  }
  return { model: DEFAULT_COST_MODEL, source: "built-in defaults" };
}

async function main(): Promise<void> {
  const questionnairePath = path.resolve(
    process.argv[2] ?? path.join(PACKAGE_ROOT, "samples", "questionnaire.sample.json")
  );
  const outDir = path.resolve(process.argv[3] ?? path.join(PACKAGE_ROOT, "out"));

  const questionnaire: Questionnaire = JSON.parse(fs.readFileSync(questionnairePath, "utf8"));
  const { model, source } = loadCostModel();

  // LAND stage: evaluate sample parcel listings against this design.
  const parcelsPath = path.join(PACKAGE_ROOT, "samples", "parcels.sample.json");
  const parcels: ParcelListing[] = fs.existsSync(parcelsPath)
    ? JSON.parse(fs.readFileSync(parcelsPath, "utf8"))
    : [];
  const landVerdicts = filterParcels(parcels, questionnaire);

  const briefCore = questionnaireToDesignBrief(questionnaire);
  const { narrative, narrativeSource } = await generateNarrative(briefCore, questionnaire);
  const brief: DesignBrief = { ...briefCore, narrative, narrativeSource };

  const budget = designBriefToBudget(briefCore, model, questionnaire.contingencyRate);
  const plan = budgetToMilestones(budget, questionnaire.projectName);

  fs.mkdirSync(outDir, { recursive: true });
  const write = (name: string, data: unknown) => {
    const file = path.join(outDir, name);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`  wrote ${file}`);
  };

  console.log(`aura-architect — ${questionnaire.projectName}`);
  console.log(`  questionnaire: ${questionnairePath}`);
  console.log(`  cost model:    ${source}`);
  console.log(`  narrative:     ${narrativeSource}`);
  if (landVerdicts.length > 0) {
    write("land-verdicts.json", landVerdicts);
  }
  write("design-brief.json", brief);
  write("budget.json", budget);
  write("milestones.json", plan);

  const fmt = (n: number) => `$${n.toLocaleString("en-CA")}`;
  if (landVerdicts.length > 0) {
    console.log(`  land (${questionnaire.home.sizeSqft} sqft design vs ${landVerdicts.length} parcels):`);
    for (const v of landVerdicts) {
      console.log(`    ${v.verdict.padEnd(6)} ${v.parcel.name} — ${fmt(v.parcel.priceCad)} (${v.parcel.district})`);
      if (v.verdict === "REJECT") console.log(`           ${v.reasons[0]}`);
    }
  }
  console.log(`  constraint notes: ${brief.constraintNotes.length}`);
  for (const note of brief.constraintNotes) console.log(`    - ${note}`);
  console.log(
    `  budget (CAD, excl. land): LOW ${fmt(budget.total.lowCad)} / MID ${fmt(budget.total.midCad)} / HIGH ${fmt(budget.total.highCad)}`
  );
  console.log(
    `  milestones: ${plan.milestones.length}, total ${fmt(plan.totalCad)}, holdback ${fmt(plan.totalHoldbackCad)} (${plan.holdbackRateBps / 100}% for ${plan.holdbackPeriodDays} days)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
