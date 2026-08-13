import { expect, test } from "playwright/test";
import { defaultBuilderDocument } from "@/lib/builder/document";
import { PROVIDERS } from "@/components/buy/data";
import { providerPurchaseReadiness } from "@/lib/marketplace/buyReadiness";
import { createAuraProject } from "@/lib/project/document";
import { createManufacturerInquiry, validateManufacturerInquiry } from "@/lib/project/manufacturerInquiry";

test("a manufacturer inquiry binds the evidence, destination and current project design", () => {
  const provider = PROVIDERS.find((item) => item.name === "BOXABL")!;
  const project = createAuraProject({ id: "buy-project", name: "Finished home search", journey: "buy-finished-home", purpose: "primary-home", document: defaultBuilderDocument(), now: new Date("2026-08-12T00:00:00Z") });
  const readiness = providerPurchaseReadiness(provider, { targetRegion: "canada", product: "modular-home" });
  const inquiry = createManufacturerInquiry({ id: "inquiry-1", project, provider, readiness, targetRegion: "canada", product: "modular-home", createdAtISO: "2026-08-12T12:00:00Z" });
  expect(inquiry.designHash).toBe(project.design.documentHash);
  expect(inquiry.providerName).toBe("BOXABL");
  expect(inquiry.destination).toBe("canada");
  expect(inquiry.readinessVerdict).toBe("verify-first");
  expect(inquiry.requestedAnswers.join(" ")).toMatch(/shipping|certification|payment|quote/i);
  expect(inquiry.canonicalHash).toMatch(/^0x[a-f0-9]{64}$/);
  expect(validateManufacturerInquiry(inquiry).ok).toBe(true);
});

test("a changed inquiry cannot retain its canonical hash", () => {
  const provider = PROVIDERS[0];
  const project = createAuraProject({ id: "buy-project", name: "Finished home search", journey: "buy-finished-home", purpose: "primary-home", document: defaultBuilderDocument(), now: new Date("2026-08-12T00:00:00Z") });
  const readiness = providerPurchaseReadiness(provider, { targetRegion: "any", product: "any" });
  const inquiry = createManufacturerInquiry({ id: "inquiry-2", project, provider, readiness, targetRegion: "any", product: "any", createdAtISO: "2026-08-12T12:00:00Z" });
  expect(validateManufacturerInquiry({ ...inquiry, providerName: "Changed" }).ok).toBe(false);
});

test("an unsupported destination cannot enter a manufacturer inquiry at runtime", () => {
  const provider = PROVIDERS[0];
  const project = createAuraProject({ id: "buy-project", name: "Finished home search", journey: "buy-finished-home", purpose: "primary-home", document: defaultBuilderDocument(), now: new Date("2026-08-12T00:00:00Z") });
  const readiness = providerPurchaseReadiness(provider, { targetRegion: "any", product: "any" });
  expect(() => createManufacturerInquiry({
    id: "inquiry-invalid-destination",
    project,
    provider,
    readiness,
    targetRegion: "moon" as never,
    product: "any",
    createdAtISO: "2026-08-12T12:00:00Z",
  })).toThrow(/destination/i);
});
