import { expect, test } from "playwright/test";

import { PROVIDERS } from "@/components/buy/data";
import {
  changeNowReadiness,
  providerPurchaseReadiness,
  type PurchaseIntent,
} from "@/lib/marketplace/buyReadiness";

const intent: PurchaseIntent = {
  targetRegion: "canada",
  product: "modular-home",
};

test("the global provider score refuses unavailable regions instead of calling them vetted", () => {
  const scored = PROVIDERS.map((provider) =>
    providerPurchaseReadiness(provider, { ...intent, product: "any" }),
  );
  expect(scored.every((result) => result.verdict !== "ready-to-contact")).toBe(true);
  expect(scored.some((result) => result.verdict === "region-unavailable")).toBe(true);
  expect(
    scored.every((result) => /evidence|unavailable|product/i.test(result.label)),
  ).toBe(true);
});

test("product, shipping, payment mechanics and evidence each contribute visibly", () => {
  const boxabl = PROVIDERS.find((provider) => provider.name === "BOXABL");
  expect(boxabl).toBeTruthy();
  if (!boxabl) return;
  const scored = providerPurchaseReadiness(boxabl, intent);
  expect(scored.verdict).toBe("verify-first");
  expect(scored.contributions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: "product", points: 25 }),
      expect.objectContaining({ id: "region", state: "unknown" }),
      expect.objectContaining({ id: "crypto", state: "partial" }),
      expect.objectContaining({ id: "payment", points: 2 }),
    ]),
  );
  expect(scored.score).toBe(scored.contributions.reduce((sum, item) => sum + item.points, 0));
});

test("a current processor path can be ready to contact only in its actual region", () => {
  const rak = PROVIDERS.find((provider) => provider.name === "RAK Properties PJSC");
  expect(rak).toBeTruthy();
  if (!rak) return;
  const local = providerPurchaseReadiness(rak, { targetRegion: "uae", product: "existing-property" });
  expect(local.verdict).toBe("ready-to-contact");
  expect(local.score).toBeGreaterThanOrEqual(90);

  const canadian = providerPurchaseReadiness(rak, { targetRegion: "canada", product: "existing-property" });
  expect(canadian.verdict).toBe("region-unavailable");
});

test("ChangeNOW remains blocked until partner, pair, quote, recipient and compliance gates are real", () => {
  const disconnected = changeNowReadiness({
    partnerApiConfigured: false,
    exactPairVerified: false,
    quoteExpiresAtISO: null,
    recipientVerified: false,
    termsAccepted: false,
  }, new Date("2026-08-11T12:00:00.000Z"));
  expect(disconnected.status).toBe("not-connected");
  expect(disconnected.blockers).toContain("A ChangeNOW partner agreement and server-kept API credential are not configured.");

  const stale = changeNowReadiness({
    partnerApiConfigured: true,
    exactPairVerified: true,
    quoteExpiresAtISO: "2026-08-11T11:59:59.000Z",
    recipientVerified: true,
    termsAccepted: true,
  }, new Date("2026-08-11T12:00:00.000Z"));
  expect(stale.status).toBe("quote-required");
  expect(stale.blockers).toContain("The conversion quote is missing or expired.");

  const ready = changeNowReadiness({
    partnerApiConfigured: true,
    exactPairVerified: true,
    quoteExpiresAtISO: "2026-08-11T12:05:00.000Z",
    recipientVerified: true,
    termsAccepted: true,
  }, new Date("2026-08-11T12:00:00.000Z"));
  expect(ready.status).toBe("ready-for-user-confirmation");
  expect(ready.canExecuteAutomatically).toBe(false);
});
