import { expect, test } from "playwright/test";

import {
  buildBom,
  ecoSystems,
  DOOR_CAD_EACH,
  GLAZING_CAD_PER_SQ_FT,
  GLAZING_REFERENCE_WINDOW_SQ_FT,
  type BillOfMaterials,
  type LineItem,
} from "@/lib/design/materials";
import { defaultBuilderDocument } from "@/lib/builder/document";
import {
  createProjectBudget,
  defaultProjectBudgetScenario,
} from "@/lib/builder/projectBudget";

/* ===========================================================================
   BQ02 — GLAZING IS PRICED BY AREA, AND MUST STAY THAT WAY.

   WHAT WENT WRONG. lib/design/materials.ts priced the glazing line as
   `qty: window_count` at $900 / $1,350 / $1,800 EACH. `window_count` is every
   non-door opening, counted once. So a full-height 306 sq ft glazing wall in
   a valid design fixture cost exactly what a 16 sq ft casement cost. That is
   a material planning error in the harmful direction: somebody can plan a
   build against an understated envelope number.

   WHY THIS FILE EXISTS RATHER THAN A COMMENT. Per unit is the natural way to
   write a window line, so this is a regression that would come back by
   accident. The approved Graph v1.1 objectives B16 and Q00 require the one
   design graph to drive quantities and the budget to bind its design basis.

   HOW IT IS BUILT TO FAIL. Every assertion below is written so that restoring
   the per-unit form turns it red, and each one is red for a different reason:

     · equal count, different area   → per unit gives ONE price, area gives two
     · equal area, different count   → per unit gives TWO prices, area gives one
     · the unit string and quantity  → per unit reads "units" and an integer
     · the arithmetic                → per unit is not area × rate

   A test that only read the unit string would pass against a hardcoded
   number, which is why the proportionality checks are here as well.

   WHAT THIS GATE DOES NOT CLAIM. The rate is DERIVED, by division, from the
   one glazing figure this repo has a source for — $900–1,800 per window, from
   data/alberta/cost-model.json. It is a units correction, not a quote, not a
   supplier offer, and not a glazing take-off. It inherits every bit of the
   source band's uncertainty, models nothing about U-value, coating, operable
   versus fixed, safety glazing, structural mullions or the header over a wide
   opening, and enforces no FDWR limit. Those gaps are stated in the line's own
   basis string, and this file checks that they still are.
   ======================================================================== */

const SYSTEMS = ecoSystems({});

/** One BOM for a design that is identical except in its glazing. */
function bom(args: {
  glazingSqFt: number;
  windowCount: number;
  doorCount?: number;
}): BillOfMaterials {
  return buildBom({
    width_ft: 34,
    depth_ft: 23.5,
    gross_sq_ft: 799,
    window_count: args.windowCount,
    glazing_sq_ft: args.glazingSqFt,
    door_count: args.doorCount ?? 1,
    material: "sip",
    systems: SYSTEMS,
    storeys: 1,
  });
}

function line(items: readonly LineItem[], key: string): LineItem {
  const found = items.filter((item) => item.key === key);
  expect(found, `expected exactly one "${key}" line`).toHaveLength(1);
  return found[0];
}

test("glazing is priced by area, so a glazing wall is not billed as one casement", () => {
  /* THE DEFECT, RESTATED AS TWO DESIGNS. Same opening count, wildly different
     glass. Under per-unit pricing these two lines are the same money, which is
     the whole bug: a 34 ft × 9 ft wall billed as a 4 ft × 4 ft casement. */
  const casement = line(bom({ glazingSqFt: 16, windowCount: 1 }).items, "windows");
  const wall = line(bom({ glazingSqFt: 306, windowCount: 1 }).items, "windows");

  expect(
    wall.cad_mid / casement.cad_mid,
    "a 306 sq ft glazing wall and a 16 sq ft casement price the same, so glazing is being counted rather than measured",
  ).toBeCloseTo(306 / 16, 6);
  expect(wall.cad_low / casement.cad_low).toBeCloseTo(306 / 16, 6);
  expect(wall.cad_high / casement.cad_high).toBeCloseTo(306 / 16, 6);

  /* THE MIRROR IMAGE, which a hardcoded per-square-foot number would also have
     to satisfy: the same glass split across more openings is the same glass.
     Under per-unit this is four times the money for the identical envelope. */
  const one = line(bom({ glazingSqFt: 64, windowCount: 1 }).items, "windows");
  const four = line(bom({ glazingSqFt: 64, windowCount: 4 }).items, "windows");
  expect(
    four.cad_mid,
    "splitting the same glazed area across more openings changed its price, so the count is still being priced",
  ).toBe(one.cad_mid);
  expect(four.qty).toBe(one.qty);

  /* The count is still REPORTED — it is a true fact about the design — but it
     appears on the label, where a count cannot be mistaken for a price. */
  expect(one.label).toContain("1 opening");
  expect(four.label).toContain("4 openings");

  // The quantity a reader sees on /budget and in the RFQ packet is an AREA.
  expect(wall.unit).toContain("sq ft");
  expect(wall.unit).not.toBe("units");
  expect(wall.qty).toBe(306);

  /* And the guard is on area, not on count: openings with no glazed area buy
     no glass, so no line is emitted at all. */
  expect(bom({ glazingSqFt: 0, windowCount: 3 }).items.some((item) => item.key === "windows")).toBe(
    false,
  );
});

test("the reference window is published, and the basis states the derivation it uses", () => {
  /* THE DIVISOR IS THE PRICE CLAIM. $900–1,800 per window becomes a per
     square foot planning proxy only once an explicit reference size is
     supplied. The source does not supply one; 16 sq ft (4 ft × 4 ft) is a
     visible, replaceable assumption rather than a disguised supplier fact. */
  expect(GLAZING_REFERENCE_WINDOW_SQ_FT).toBe(16);
  expect(GLAZING_CAD_PER_SQ_FT.low).toBeCloseTo(56.25, 10);
  expect(GLAZING_CAD_PER_SQ_FT.mid).toBeCloseTo(84.375, 10);
  expect(GLAZING_CAD_PER_SQ_FT.high).toBeCloseTo(112.5, 10);

  // The band the rate came from is recoverable by multiplying back.
  expect(GLAZING_CAD_PER_SQ_FT.low * GLAZING_REFERENCE_WINDOW_SQ_FT).toBeCloseTo(900, 10);
  expect(GLAZING_CAD_PER_SQ_FT.mid * GLAZING_REFERENCE_WINDOW_SQ_FT).toBeCloseTo(1350, 10);
  expect(GLAZING_CAD_PER_SQ_FT.high * GLAZING_REFERENCE_WINDOW_SQ_FT).toBeCloseTo(1800, 10);

  const item = line(bom({ glazingSqFt: 176, windowCount: 3 }).items, "windows");
  expect(item.cad_low).toBeCloseTo(176 * 56.25, 6);
  expect(item.cad_mid).toBeCloseTo(176 * 84.375, 6);
  expect(item.cad_high).toBeCloseTo(176 * 112.5, 6);

  /* The basis has to let a reader check the arithmetic without opening the
     source: the sourced band, the reference window, the derived rate, and the
     admission that the rate is derived rather than separately researched. */
  expect(item.basis).toContain("$900–1,800 per window");
  expect(item.basis).toContain("16 sq ft (4 ft × 4 ft)");
  expect(item.basis).toContain("$56.25, $84.38 and $112.50 per sq ft");
  expect(item.basis).toContain("by division, not separately sourced");
  expect(item.basis).toContain("reference-size planning proxy");
  expect(item.basis).toContain("not a supplier quote");
  expect(item.basis).toContain("source date 2026-08");

  /* THE SECOND FALSEHOOD THAT LIVED IN THIS STRING. It used to read
     "Glass-forward but FDWR ≤ 22%", asserting a compliance outcome buildBom
     does not compute — and fifteen of the checked-in plans already exceed 22%.
     The 22% may be cited as the prescriptive reference it is; it may not be
     claimed as a result. */
  expect(item.basis).toContain("nothing here checks a design against it");
  expect(item.basis).not.toContain("but FDWR");

  /* One rate covers punched windows and glazing walls, and the reason is that
     the sign of a split is unknown: big fixed lites buy glass more cheaply per
     square foot, while large-format framing and safety glazing cost more, and
     this repo has a sourced figure for neither. Saying so is the difference
     between one honest rate and an invented multiplier. */
  expect(item.basis).toContain("One rate covers punched windows and glazing walls");
});

test("exterior doors are priced by the doors the design draws", () => {
  /* THE SAME CLASS OF DEFECT, one line down: the quantity was the literal 2,
     so valid one-door and three-door design fixtures paid the same. Doors
     really are bought by the unit, so this is a COUNT correction, not a units
     one. */
  const single = line(bom({ glazingSqFt: 100, windowCount: 2, doorCount: 1 }).items, "doors");
  const triple = line(bom({ glazingSqFt: 100, windowCount: 2, doorCount: 3 }).items, "doors");

  expect(single.qty).toBe(1);
  expect(triple.qty).toBe(3);
  expect(
    triple.cad_mid,
    "three doors cost what one door costs, so the door count is still hardcoded",
  ).toBe(single.cad_mid * 3);

  /* It is a division of the old allowance, not a reprice: two doors still cost
     exactly the $1,400 / $2,200 / $3,200 the line charged before. */
  const pair = line(bom({ glazingSqFt: 100, windowCount: 2, doorCount: 2 }).items, "doors");
  expect([pair.cad_low, pair.cad_mid, pair.cad_high]).toEqual([1400, 2200, 3200]);
  expect([DOOR_CAD_EACH.low, DOOR_CAD_EACH.mid, DOOR_CAD_EACH.high]).toEqual([700, 1100, 1600]);

  /* A dwelling has an entry. A design drawing no door is still priced for one,
     and the floor is stated in the basis instead of acting silently. */
  const none = line(bom({ glazingSqFt: 100, windowCount: 2, doorCount: 0 }).items, "doors");
  expect(none.qty).toBe(1);
  expect(none.basis).toContain("draws none, so one entry door is priced");
  expect(single.basis).not.toContain("draws none");

  const legacy = buildBom({
    width_ft: 34,
    depth_ft: 23.5,
    gross_sq_ft: 799,
    window_count: 1,
    glazing_sq_ft: 16,
    material: "sip",
    systems: SYSTEMS,
  });
  const legacyDoors = line(legacy.items, "doors");
  expect(legacyDoors.qty).toBe(2);
  expect(legacyDoors.basis).toContain("unavailable to this legacy caller");
});

test("the reference project budget prices its own measured glazing area", () => {
  /* The whole plumbing, end to end: the budget the /budget table renders
     carries the area on the line, not a count of openings. The reference home
     draws three non-door openings totalling 176 sq ft — priced as one unit
     each, that was $4,050 at mid; measured, it is $14,850. */
  const document = defaultBuilderDocument();
  const budget = createProjectBudget({
    document,
    scenario: defaultProjectBudgetScenario(),
    region: "Alberta",
    municipality: "Foothills County",
    budgetCapCad: null,
  });
  const glazing = budget.lines.filter((entry) => entry.id === "windows");
  expect(glazing).toHaveLength(1);
  expect(glazing[0].unit).toContain("sq ft");
  expect(glazing[0].quantity).toBe(176);
  expect(glazing[0].mid).toBe(14_850);

  const expectedDoors = document.spec.volumes.reduce(
    (sum, volume) => sum + volume.openings.filter((opening) => opening.kind === "door").length,
    0,
  );
  const doors = budget.lines.filter((entry) => entry.id === "doors");
  expect(doors).toHaveLength(1);
  expect(expectedDoors).toBeGreaterThan(0);
  expect(doors[0].quantity).toBe(expectedDoors);
});
