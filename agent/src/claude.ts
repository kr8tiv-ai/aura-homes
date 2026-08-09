// Claude integration for the narrative design brief.
// Reads ANTHROPIC_API_KEY from the environment. When the key is missing or the
// API call fails for any reason, the OFFLINE FALLBACK below produces a
// deterministic narrative so the demo never breaks.

import Anthropic from "@anthropic-ai/sdk";
import { DesignBrief, Questionnaire } from "./types";

const MODEL = "claude-sonnet-5";

type BriefCore = Omit<DesignBrief, "narrative" | "narrativeSource">;

export async function generateNarrative(
  brief: BriefCore,
  questionnaire: Questionnaire
): Promise<{ narrative: string; narrativeSource: DesignBrief["narrativeSource"] }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { narrative: offlineNarrative(brief), narrativeSource: "offline-fallback" };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000, // Sonnet 5 thinks adaptively by default; cap covers thinking + text
      system:
        "You are Aura, an architect specializing in off-grid SIP homes in rural Alberta. " +
        "Write a concise design brief narrative (3-5 short paragraphs) for the homeowner: " +
        "the design concept, how the envelope and systems suit the climate and parcel, and " +
        "one paragraph on what happens next. Plain prose, no headings, no bullet lists.",
      messages: [
        {
          role: "user",
          content:
            "Structured design brief:\n" +
            JSON.stringify(brief, null, 2) +
            "\n\nOriginal questionnaire:\n" +
            JSON.stringify(questionnaire, null, 2),
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { narrative: offlineNarrative(brief), narrativeSource: "offline-fallback" };
    }
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) {
      return { narrative: offlineNarrative(brief), narrativeSource: "offline-fallback" };
    }
    return { narrative: text, narrativeSource: "claude" };
  } catch (err) {
    // Any API failure (auth, rate limit, network) degrades to the offline brief.
    console.warn(
      `[aura-architect] Claude call failed (${err instanceof Error ? err.message : err}); using offline narrative.`
    );
    return { narrative: offlineNarrative(brief), narrativeSource: "offline-fallback" };
  }
}

// ---------------------------------------------------------------- OFFLINE FALLBACK

function offlineNarrative(brief: BriefCore): string {
  const { home, parcel, shell, energy, water, extras } = brief;
  const waterDesc =
    water.source === "well"
      ? "a drilled well"
      : water.source === "awgSupplement"
        ? "a cistern supplemented by atmospheric water generation"
        : "a buried cistern with scheduled delivery";
  const extrasList = [
    extras.hotTub ? "a wood-fired hot tub" : null,
    extras.deck ? "a deck" : null,
    extras.hrv ? "an HRV for continuous fresh air" : null,
  ].filter(Boolean);

  return [
    `${brief.projectName} is a ${home.sizeSqft} sqft, ${home.storeys}-storey ${home.style} ` +
      `with ${home.bedrooms} bedroom(s) and ${home.bathrooms} bathroom(s), sited in ` +
      `${parcel.county} (${parcel.district}). ` +
      (brief.meetsMinDwellingSize
        ? `At ${home.sizeSqft} sqft it meets the district minimum dwelling size of ${parcel.minDwellingSizeSqft} sqft.`
        : `Note: at ${home.sizeSqft} sqft it is below the district minimum of ${parcel.minDwellingSizeSqft} sqft and will need a variance or resize.`),
    `The envelope is a structural insulated panel shell (walls ~R-${shell.wallRValue}, roof ~R-${shell.roofRValue}) ` +
      `on ${brief.foundation.estimatedPileCount} screw piles, with a glazing ratio of ` +
      `${Math.round(shell.glazingRatio * 100)}% oriented for passive solar gain.`,
    `Power comes from a ${energy.solarKw} kW solar array with ${energy.batteryKwh} kWh of storage` +
      (energy.backupGenerator ? ` and a backup generator` : "") +
      (energy.woodStove ? `, with a WETT-certified wood stove for resilient heat` : "") +
      `. Water is supplied by ${waterDesc}, with a ${water.septic} septic system.` +
      (extrasList.length ? ` Extras include ${extrasList.join(", ")}.` : ""),
    `Next steps: finalize the LOW/MID/HIGH budget, fund the milestone escrow in native USDC on ` +
      `X Layer, and anchor the build record on-chain. Each milestone release retains the statutory ` +
      `holdback until the lien period has run.`,
  ].join("\n\n");
}
