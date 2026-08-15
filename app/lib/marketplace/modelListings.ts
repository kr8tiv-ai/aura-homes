/* =============================================================================
   CONTRIBUTED MODEL LISTINGS — what a contributed model looks like once it is
   readable by somebody other than its author.

   WHAT A LISTING IS HERE. A validated ContributedModel, the contributor's own
   declarations about it, the rights they claim, a computed floor area, and —
   optionally — a price recorded the way lib/marketplace/homeModels.ts records
   one: an amount, an ISO 4217 currency, an as-of date and a stated basis,
   because "an undated number with no stated origin is a rumour".

   WHAT A LISTING IS NOT. It is not an offer, an order, or a payment. Nothing
   in this file sells, buys, settles, escrows or pays anyone. The roadmap puts
   the marketplace in arc 02 and this repository's rule is that nothing unbuilt
   is written in the present tense. A recorded price is a number with a date on
   it; the sentence in CONTRIBUTED_LISTING_NOTICE sits beside it so the two are
   never confused, and tests/contributed-model.spec.ts scans every string this
   module produces for transaction vocabulary.

   EVIDENCE, NOT ENDORSEMENT. This module reuses EvidenceFact/EvidenceStatus
   from ./discovery unchanged — the same vocabulary whose `finding()` already
   halves the score of a merely declared fact with the sentence "This is
   listing/dealer-declared rather than authority-verified." A contributor's
   claims about their own work are `declared`. NOTHING here is ever `verified`,
   and there is no score: Aura ranking or vouching for its own contributors
   would be precisely the "vetted" failure lib/marketplace/suppliers.ts refuses.
   Note that suppliers.ts has a SEPARATE SupplierEvidenceStatus vocabulary —
   this file uses discovery's, deliberately, and does not mix them.
   ============================================================================= */

import {
  collectContributedModelProblems,
  contributedFloorAreaSqFt,
  planTemplateToContributedModel,
  type ContributedModel,
  type ContributedRights,
} from "@/lib/builder/contributedModel";
import type { PlanTemplate } from "@/lib/builder/planCatalog";
import type { EvidenceFact } from "./discovery";
import { formatNumericPrice, validateNumericPrice, type NumericPrice } from "./homeModels";

/* ------------------------------------------------------------- vocabulary */

/** The sentence that sits beside every contributed listing. It denies the
 *  transaction rather than describing one, and it matches the site footer's
 *  own words in components/SiteShell.tsx: "Aura Homes facilitates. It does not
 *  sell homes, hold your funds, act as a party to any purchase or build
 *  contract". */
export const CONTRIBUTED_LISTING_NOTICE =
  "Aura Homes records this model and what its contributor states about it. Aura has not " +
  "checked those statements, does not hold funds, and is not a party to any agreement " +
  "between a contributor and anyone who builds from the model.";

/** The exact sentence for a listing whose contributor recorded no number. Held
 *  once, like MISSING_PRICE_SENTENCE in homeModels.ts, so the UI cannot drift. */
export const NO_RECORDED_PRICE_SENTENCE = "No price recorded — ask the contributor.";

/**
 * The only two states a contributed listing can be in.
 *
 * There is deliberately no "verified", "approved", "featured" or "trusted"
 * member. Aura checks that a record is WELL-FORMED and that its rights claims
 * are PRESENT — it does not check that they are TRUE, and a status implying it
 * did would be the most damaging sentence in this module.
 */
export const CONTRIBUTED_LISTING_STATUSES = ["refused", "listed-as-declared"] as const;
export type ContributedListingStatus = (typeof CONTRIBUTED_LISTING_STATUSES)[number];

/* ------------------------------------------------------------ contributors */

/** Who says so. None of it is verified; `declaredAtISO` dates the claim so a
 *  reader can see how old it is. */
export interface ContributedContributor {
  displayName: string;
  /** An https link a reader can open, or an explicit null. */
  url: string | null;
  declaredAtISO: string;
}

/* Date.parse alone is not a date check: V8's fallback parser reads "sometime
   in 2026" as a real instant. Same shape-then-value discipline, and the same
   regex, as the private ISO_INSTANT in homeModels.ts — which is not exported,
   so it is restated here rather than loosened. */
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const validISO = (value: unknown): value is string =>
  typeof value === "string" &&
  ISO_INSTANT.test(value.trim()) &&
  Number.isFinite(Date.parse(value));

export function contributorProblems(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return ["contributor is missing — an anonymous record has nobody to attribute it to."];
  const record = value as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof record.displayName !== "string" || record.displayName.trim().length === 0)
    problems.push("contributor.displayName is missing.");
  if (record.url !== null && !(typeof record.url === "string" && /^https:\/\//.test(record.url)))
    problems.push("contributor.url must be an https:// link or an explicit null.");
  if (!validISO(record.declaredAtISO))
    problems.push("contributor.declaredAtISO is missing or unparseable — an undated claim cannot be aged.");
  return problems;
}

/* ---------------------------------------------------------------- listings */

export interface ContributedListingFacts {
  /** The credit line the contributor asks to be shown. */
  authorship: EvidenceFact<string>;
  /** The terms they say the work is offered under. */
  licenceTerms: EvidenceFact<string>;
  /** What they say they changed from the source they named. */
  changesFromSource: EvidenceFact<string>;
  /** Arithmetic Aura performed — over an envelope Aura did not verify. */
  floorAreaSqFt: EvidenceFact<number>;
  /** What the contributor states they ask for the model. A number with a date
   *  and a basis. Not an offer, not a checkout, not a payment. */
  recordedPrice: EvidenceFact<NumericPrice>;
}

export interface ContributedModelListing {
  id: string;
  status: ContributedListingStatus;
  /** Every reason the record was refused, in full. Empty when listed. */
  refusals: string[];
  model: ContributedModel | null;
  contributor: ContributedContributor | null;
  rights: ContributedRights | null;
  facts: ContributedListingFacts;
  /** The one place a recorded price becomes words on this surface. */
  priceLine: string;
  notice: string;
  /** True means this record exists to demonstrate the format and is not a real
   *  submission — the same flag LandDiscoveryListing carries for the same
   *  reason. */
  demonstration: boolean;
}

export interface ContributedSubmission {
  model: unknown;
  contributor: unknown;
  /** Optional. A listing without one says so in words rather than showing a
   *  blank or a zero. */
  price?: unknown;
  demonstration?: boolean;
}

const unknownFact = <T>(sourceLabel: string): EvidenceFact<T> => ({
  value: null,
  status: "unknown",
  sourceLabel,
  sourceUrl: null,
  checkedAtISO: null,
});

/** Everything a contributor says about their own work is `declared`. There is
 *  no path in this module that produces `verified`. */
const declaredFact = <T>(
  value: T,
  sourceLabel: string,
  sourceUrl: string | null,
  checkedAtISO: string | null,
): EvidenceFact<T> => ({ value, status: "declared", sourceLabel, sourceUrl, checkedAtISO });

export function recordedPriceLine(price: NumericPrice | null): string {
  return price === null ? NO_RECORDED_PRICE_SENTENCE : formatNumericPrice(price);
}

/**
 * `validateNumericPrice` re-anchored onto the field a contributor actually
 * submitted.
 *
 * WHY THIS EXISTS. The RULES come from homeModels.ts and must not be
 * duplicated — one definition of "a price needs a date and a basis", not two
 * that can disagree. But its MESSAGES were written for `FinishedHomeModel`,
 * where the price lives at `price.numeric`. A contributed submission has no
 * `numeric`; it has `price`. Handing a contributor "price.numeric.asOfISO is
 * missing" points them at a field they never wrote and cannot find, which is
 * the same failure as refusing without naming the field — it just looks like
 * it named one.
 *
 * So the rule is reused and only the path is corrected. The `price.numeric`
 * prefix is rewritten to `price`; a message that does not carry that prefix is
 * passed through untouched rather than guessed at, and the fallthrough is
 * asserted in tests/contributed-model.spec.ts so a reworded message upstream
 * cannot quietly start arriving unanchored.
 */
export function contributedPriceRefusal(problem: string): string {
  return problem.startsWith("price.numeric") ? `price${problem.slice("price.numeric".length)}` : problem;
}

/**
 * The one shape a refused listing has, built once.
 *
 * A refused listing's facts are all `unknown` rather than half-filled from the
 * parts that happened to parse. Half a provenance chain reads as a provenance
 * chain, which is how a catalog ends up shipping somebody else's drawings.
 *
 * It is a named function rather than an inline literal because two callers
 * need it, and the second one used to fake a submission to get at it — see
 * `contributedListingFromPlanTemplate`.
 */
function refusedListing(
  id: string,
  refusals: string[],
  demonstration: boolean,
): ContributedModelListing {
  return {
    id,
    status: "refused",
    refusals,
    model: null,
    contributor: null,
    rights: null,
    facts: {
      authorship: unknownFact<string>("Refused submission"),
      licenceTerms: unknownFact<string>("Refused submission"),
      changesFromSource: unknownFact<string>("Refused submission"),
      floorAreaSqFt: unknownFact<number>("Refused submission"),
      recordedPrice: unknownFact<NumericPrice>("Refused submission"),
    },
    priceLine: NO_RECORDED_PRICE_SENTENCE,
    notice: CONTRIBUTED_LISTING_NOTICE,
    demonstration,
  };
}

/**
 * Turn a submission into a listing. Never throws, never partially accepts: a
 * record that does not validate becomes a `refused` listing carrying every
 * reason THIS FUNCTION FOUND, so a submissions queue can show a contributor
 * everything to fix in one pass rather than one item per round trip.
 *
 * "Every reason" is scoped to what was actually checked, and that scope is
 * stated rather than implied: `collectContributedModelProblems` is the whole
 * record check (shape and catalogue admission), the contributor block is
 * checked in full, and the price — when one was submitted — is checked by
 * homeModels' single definition. A caller that refuses a submission BEFORE it
 * reaches here has one reason, not none, and says so; see
 * `contributedListingFromPlanTemplate`.
 */
export function listContributedModel(submission: ContributedSubmission): ContributedModelListing {
  const modelProblems = collectContributedModelProblems(submission.model);
  const personProblems = contributorProblems(submission.contributor);
  const priceProvided = submission.price !== undefined && submission.price !== null;
  const priceCheck = priceProvided ? validateNumericPrice(submission.price) : null;
  const priceProblems = priceCheck && !priceCheck.ok ? [contributedPriceRefusal(priceCheck.problem)] : [];
  const refusals = [...modelProblems, ...personProblems, ...priceProblems];
  const demonstration = submission.demonstration === true;

  const rawId =
    typeof submission.model === "object" &&
    submission.model !== null &&
    typeof (submission.model as { id?: unknown }).id === "string"
      ? ((submission.model as { id: string }).id)
      : "unidentified-submission";

  if (refusals.length > 0) return refusedListing(rawId, refusals, demonstration);

  const model = submission.model as ContributedModel;
  const contributor = submission.contributor as ContributedContributor;
  const price = priceCheck && priceCheck.ok ? priceCheck.price : null;
  const rights = model.rights;
  const declaredAt = contributor.declaredAtISO;

  return {
    id: model.id,
    status: "listed-as-declared",
    refusals: [],
    model,
    contributor,
    rights,
    facts: {
      authorship: declaredFact(rights.attribution, "Contributor declaration", rights.url, declaredAt),
      licenceTerms: declaredFact(rights.license, "Contributor declaration", rights.licenseUrl, declaredAt),
      changesFromSource: declaredFact(rights.changes, "Contributor declaration", rights.url, declaredAt),
      /* Computed by Aura, and still DECLARED: arithmetic over an envelope
         nobody checked does not become evidence by being arithmetic. */
      floorAreaSqFt: declaredFact(
        contributedFloorAreaSqFt(model),
        "Computed by Aura from the contributed envelope",
        rights.url,
        declaredAt,
      ),
      recordedPrice:
        price === null
          ? unknownFact<NumericPrice>("No price recorded by the contributor")
          : declaredFact(price, `Contributor-recorded price (${price.basis})`, rights.url, price.asOfISO),
    },
    priceLine: recordedPriceLine(price),
    notice: CONTRIBUTED_LISTING_NOTICE,
    demonstration,
  };
}

/**
 * A catalog PlanTemplate, read back out as a contributed listing.
 *
 * This exists because the round trip is the promise: the JSON contract is what
 * outside contributors write against, so it has to be able to express every
 * non-Aura record the curated catalog already ships. Feeding real
 * PLAN_TEMPLATES entries through here is how tests/contributed-model.spec.ts
 * proves that, on real data rather than on a fixture written to pass.
 */
export function contributedListingFromPlanTemplate(
  plan: PlanTemplate,
  contributor: ContributedContributor,
  options: { price?: NumericPrice; demonstration?: boolean } = {},
): ContributedModelListing {
  const reversed = planTemplateToContributedModel(plan);
  if (!reversed.ok) {
    /* THE REVERSAL'S OWN REASON IS THE WHOLE REFUSAL, and that is now said in
       one place instead of being assembled from a discarded one.

       This path used to validate a stub record — `{ contract }` and nothing
       else — purely to obtain the listing SHAPE, then throw away the dozen
       refusals that stub produced and substitute this one. The returned object
       therefore carried a `refusals` array that did not come from the check
       that produced the rest of it, which is precisely what
       `listContributedModel`'s docstring promises never happens. It builds the
       refused listing directly now: one reason, because exactly one thing was
       checked and exactly one thing failed. Running the model validator over a
       plan that could not be reversed would bury the real reason under a pile
       of consequential problems about a record that was never built. */
    return refusedListing(plan.id, [reversed.problem], options.demonstration === true);
  }
  /* The catalog's own ids have no contributed- prefix, so a reversed catalog
     plan is namespaced on the way in rather than being allowed to shadow the
     plan it came from. */
  const model: ContributedModel = { ...reversed.model, id: `contributed-${reversed.model.id}` };
  return listContributedModel({
    model,
    contributor,
    price: options.price,
    demonstration: options.demonstration,
  });
}

/**
 * No model has been contributed yet.
 *
 * The array is empty rather than seeded with a plausible-looking fictional
 * contributor. A demonstration record with an invented person's name and an
 * invented licence grant is exactly the kind of thing that gets screenshotted
 * and read as real — see the demonstration land and contractor records in
 * ./discovery, which carry a `demonstration` flag AND fictional-sounding names
 * for that reason. A contributor is a person, so this file invents none.
 */
export const CONTRIBUTED_MODEL_LISTINGS: ContributedModelListing[] = [];
