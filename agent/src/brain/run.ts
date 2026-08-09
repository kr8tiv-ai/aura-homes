// Brain CLI: loads a journey state, prints guidance + slips + digest plain
// text, writes out/digest.html and out/slips.json.
// Usage: node dist/brain/run.js [journey.json] [outDir]

import * as fs from "fs";
import * as path from "path";
import { detectSlips, escrowPosition, getGuidance, JourneyState, renderDigest } from "./index";

const PACKAGE_ROOT = path.join(__dirname, "..", "..");

function main(): void {
  const journeyPath = path.resolve(
    process.argv[2] ?? path.join(PACKAGE_ROOT, "samples", "journey.sample.json")
  );
  const outDir = path.resolve(process.argv[3] ?? path.join(PACKAGE_ROOT, "out"));

  const state: JourneyState = JSON.parse(fs.readFileSync(journeyPath, "utf8"));
  const now = new Date();
  const slips = detectSlips(state, now);
  const guidance = getGuidance(state);
  const digest = renderDigest(state, slips, now);
  const pos = escrowPosition(state.escrow);
  const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

  console.log(`aura-brain — ${state.projectName} (${state.buildId})`);
  console.log(`  journey: ${journeyPath}`);
  console.log(`  stage:   ${state.stage}`);
  console.log(
    `  escrow:  ${cad(pos.fundedCad)} funded / ${cad(pos.releasedNetCad)} released net / ` +
      `${cad(pos.heldBackCad)} held back / ${cad(pos.awaitingCad)} awaiting`
  );

  console.log(`\n  guidance — next ${guidance.length} actions:`);
  guidance.forEach((g, i) => {
    console.log(`    ${i + 1}. ${g.action}`);
    console.log(`       who: ${g.who}${g.costCad ? ` — cost: ${g.costCad}` : ""}`);
    console.log(`       why: ${g.why}`);
  });

  console.log(`\n  slips — ${slips.length} detected:`);
  for (const s of slips) {
    console.log(`    [${s.severity.toUpperCase()}] ${s.ruleId}`);
    console.log(`       ${s.message}`);
    console.log(`       do: ${s.suggestedAction}`);
  }

  console.log(`\n  digest — ${digest.subject}\n`);
  console.log(digest.plainText.replace(/^/gm, "  "));

  fs.mkdirSync(outDir, { recursive: true });
  const slipsFile = path.join(outDir, "slips.json");
  const digestFile = path.join(outDir, "digest.html");
  fs.writeFileSync(slipsFile, JSON.stringify(slips, null, 2));
  fs.writeFileSync(digestFile, digest.html);
  console.log(`\n  wrote ${slipsFile}`);
  console.log(`  wrote ${digestFile}`);
}

main();
