import { expect, test } from "playwright/test";

import { validateBuilderDocument } from "@/lib/builder/document";
import {
  PLAN_TEMPLATES,
  estimatePlanTemplate,
  instantiatePlanTemplate,
} from "@/lib/builder/planCatalog";
import { totalFloorAreaSqFt } from "@/lib/builder/spec";

test("the plan library is substantial, deterministic and contains licensed open work", () => {
  expect(PLAN_TEMPLATES.length).toBeGreaterThanOrEqual(25);
  expect(new Set(PLAN_TEMPLATES.map((plan) => plan.id)).size).toBe(PLAN_TEMPLATES.length);
  expect(PLAN_TEMPLATES.filter((plan) => plan.source.kind === "licensed-adaptation").length).toBeGreaterThanOrEqual(3);
  expect(PLAN_TEMPLATES.filter((plan) => plan.source.kind === "public-domain-adaptation").length).toBeGreaterThanOrEqual(8);

  for (const plan of PLAN_TEMPLATES) {
    expect(plan.title.trim().length).toBeGreaterThan(0);
    expect(plan.summary.trim().length).toBeGreaterThan(0);
    expect(plan.source.url).toMatch(/^https:\/\//);
    expect(plan.source.licenseUrl).toMatch(/^https:\/\//);
    expect(plan.source.license).not.toMatch(/\bNC\b|noncommercial/i);
    expect(plan.bedrooms).toBeGreaterThanOrEqual(0);
    expect(plan.bathrooms).toBeGreaterThan(0);

    if (plan.source.kind === "licensed-adaptation") {
      expect(plan.source.attribution.trim().length).toBeGreaterThan(20);
      expect(plan.source.changes.trim().length).toBeGreaterThan(20);
      expect(plan.source.shareAlike).toBe(true);
    }

    if (plan.source.kind === "public-domain-adaptation") {
      // Public domain claimed without a stated provenance chain is exactly how
      // a catalog ships someone's copyrighted drawings — the claim must name
      // its legal basis, and attribution stays even though none is owed.
      expect(plan.source.license).toMatch(/17 USC 105|public domain|not in copyright/i);
      expect(plan.source.attribution.trim().length).toBeGreaterThan(20);
      expect(plan.source.changes.trim().length).toBeGreaterThan(20);
      expect(plan.source.shareAlike).toBe(false);
    }
  }
});

test("every plan becomes an independent, validated BuilderDocument", () => {
  for (const plan of PLAN_TEMPLATES) {
    const first = instantiatePlanTemplate(plan.id);
    const second = instantiatePlanTemplate(plan.id);

    expect(validateBuilderDocument(first).ok).toBe(true);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.spec).not.toBe(second.spec);
    expect(first.spec.name).toBe(plan.title);
    expect(totalFloorAreaSqFt(first.spec)).toBeGreaterThan(100);

    first.spec.name = "A private edit";
    expect(second.spec.name).toBe(plan.title);
  }
});

test("every plan carries a transparent Alberta materials-and-systems range", () => {
  for (const plan of PLAN_TEMPLATES) {
    const estimate = estimatePlanTemplate(plan.id);
    const document = instantiatePlanTemplate(plan.id);

    expect(estimate.currency).toBe("CAD");
    expect(estimate.jurisdiction).toBe("Alberta pilot");
    expect(estimate.areaSqFt).toBeCloseTo(totalFloorAreaSqFt(document.spec), 4);
    expect(estimate.low).toBeGreaterThan(0);
    expect(estimate.low).toBeLessThan(estimate.mid);
    expect(estimate.mid).toBeLessThan(estimate.high);
    expect(estimate.lineItems).toBeGreaterThanOrEqual(8);
    expect(estimate.assumptions.join(" ")).toMatch(/land|permit/i);
  }
});

test("steel and polycarbonate studies disclose when the range is only a proxy", () => {
  for (const id of ["fjell-cube", "lys-lantern", "lightframe-pavilion"]) {
    const estimate = estimatePlanTemplate(id) as ReturnType<typeof estimatePlanTemplate> & {
      costBasis?: { status: string; label: string; note: string };
    };

    expect(estimate.costBasis?.status).toBe("proxy");
    expect(estimate.costBasis?.label).toMatch(/proxy/i);
    expect(estimate.costBasis?.note).toMatch(/SIP|timber|steel|polycarbonate/i);
  }
});

test("a selected plan keeps its origin and cost basis through document validation", () => {
  const document = instantiatePlanTemplate("lightframe-pavilion");

  expect(document.planOrigin).toEqual({
    templateId: "lightframe-pavilion",
    templateTitle: "Lightframe Pavilion",
    costBasis: {
      status: "proxy",
      label: "Timber/SIP proxy",
      note: expect.stringMatching(/steel frame and polycarbonate packages/i),
    },
  });

  const restored = validateBuilderDocument(JSON.parse(JSON.stringify(document)));
  expect(restored.ok).toBe(true);
  if (!restored.ok) return;
  expect(restored.document.planOrigin).toEqual(document.planOrigin);
});

test("unknown plan identifiers fail instead of silently loading the reference home", () => {
  expect(() => instantiatePlanTemplate("not-a-plan")).toThrow(/Unknown Aura plan template/);
  expect(() => estimatePlanTemplate("not-a-plan")).toThrow(/Unknown Aura plan template/);
});

test("openings sit inside their walls, and the Nordic set escapes the default elevation", () => {
  for (const plan of PLAN_TEMPLATES) {
    for (const volume of plan.spec.volumes) {
      const seen = new Set<string>();
      for (const opening of volume.openings) {
        expect(seen.has(opening.id)).toBe(false);
        seen.add(opening.id);
        const run = opening.wall === "n" || opening.wall === "s" ? volume.widthFt : volume.depthFt;
        expect(opening.offsetFt).toBeGreaterThanOrEqual(0);
        expect(opening.offsetFt + opening.widthFt).toBeLessThanOrEqual(run);
        expect(opening.sillFt + opening.heightFt).toBeLessThanOrEqual(volume.wallHeightFt * volume.storeys + 0.01);
      }
    }
  }

  // The default helper mints ids `<id>-glass/-door/-east/-west`. The three
  // Nordic plans exist to be ABOUT their openings — if they ever regress to
  // the default pattern, the catalog loses the variety they were authored
  // for, and this fails.
  const defaultIds = (volumeId: string) =>
    new Set([`${volumeId}-glass`, `${volumeId}-door`, `${volumeId}-east`, `${volumeId}-west`]);
  for (const id of ["fjell-cube", "lys-lantern", "bastu-pavilion"]) {
    const plan = PLAN_TEMPLATES.find((candidate) => candidate.id === id);
    expect(plan).toBeDefined();
    const first = plan!.spec.volumes[0];
    const defaults = defaultIds(first.id);
    expect(first.openings.some((opening) => !defaults.has(opening.id))).toBe(true);
  }
});
