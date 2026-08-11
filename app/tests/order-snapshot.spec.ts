import { expect, test } from "playwright/test";

import { createOrder } from "@agent/concierge/order";
import { reduce } from "@agent/concierge/reducer";
import { defaultBuilderDocument, hashBuilderDocument } from "@/lib/builder/document";
import {
  createBuilderOrderSnapshot,
  createQuotedBuilderOrderSnapshot,
  validateBuilderOrderSnapshot,
} from "@/lib/builder/orderSnapshot";
import { buildContext } from "@/lib/concierge";

const now = new Date("2026-08-11T12:00:00.000Z");

test("a builder handoff is an immutable, hash-bound local snapshot", () => {
  const document = defaultBuilderDocument();
  const snapshot = createBuilderOrderSnapshot(document, now, "project-1");

  expect(snapshot.projectId).toBe("project-1");
  expect(snapshot.home.kind).toBe("builder");
  expect(snapshot.home.documentHash).toBe(hashBuilderDocument(document));
  expect(snapshot.artifactHashes.designDocument).toBe(hashBuilderDocument(document));
  expect(snapshot.design).toEqual(document);
  expect(snapshot.quote).toBeNull();
  expect(Object.isFrozen(snapshot)).toBe(true);
  expect(Object.isFrozen(snapshot.design.spec)).toBe(true);

  const checked = validateBuilderOrderSnapshot(snapshot);
  expect(checked.ok).toBe(true);
});

test("an edited design cannot pass as the immutable order snapshot", () => {
  const snapshot = createBuilderOrderSnapshot(defaultBuilderDocument(), now, "project-2");
  const edited = JSON.parse(JSON.stringify(snapshot));
  edited.design.spec.name = "Edited after handoff";

  const checked = validateBuilderOrderSnapshot(edited);
  expect(checked.ok).toBe(false);
  if (!checked.ok) expect(checked.problem).toContain("hash mismatch");
});

test("the concierge quotes a builder choice against its bound design hash", () => {
  const document = defaultBuilderDocument();
  const snapshot = createBuilderOrderSnapshot(document, now, "project-3");
  const context = buildContext(now, 72);
  let order = createOrder({ id: "order-builder", now });

  order = reduce(
    order,
    { type: "selectBuilderHome", home: snapshot.home },
    context,
  ).order;
  expect(order.home?.kind).toBe("builder");
  expect(order.desiredSizeSqft).toBe(snapshot.home.sizeSqft);

  order = reduce(order, { type: "selectParcel", parcelId: "lsa-aspen-road" }, context).order;
  expect(order.parcel?.verdict).toBe("PASS");

  order = reduce(order, { type: "requestQuote" }, context).order;
  expect(order.status).toBe("quoted");
  expect(order.quote?.designHash).toBe(hashBuilderDocument(document));
  expect(order.quote?.basis.kind).toBe("estimate");
  expect(order.quote?.validUntilISO).toBe("2026-08-18T12:00:00.000Z");
});

test("catalog selections remain a distinct compatible order variant", () => {
  const context = buildContext(now, 72);
  const order = reduce(
    createOrder({ id: "order-catalog", now }),
    { type: "selectHome", homeId: "aura-sip-800" },
    context,
  ).order;

  expect(order.home?.kind).toBe("catalog");
  if (order.home?.kind === "catalog") {
    expect(order.home.catalogId).toBe("aura-sip-800");
  }
});

test("a generated quote becomes a second immutable snapshot with budget hashes", () => {
  const initial = createBuilderOrderSnapshot(defaultBuilderDocument(), now, "project-4");
  const context = buildContext(now, 72);
  let order = createOrder({ id: "order-quoted-builder", now });
  order = reduce(order, { type: "selectBuilderHome", home: initial.home }, context).order;
  order = reduce(order, { type: "selectParcel", parcelId: "lsa-aspen-road" }, context).order;
  order = reduce(order, { type: "requestQuote" }, context).order;
  expect(order.quote).toBeDefined();

  const quoted = createQuotedBuilderOrderSnapshot(initial, order.quote!);

  expect(quoted.id).not.toBe(initial.id);
  expect(quoted.projectId).toBe(initial.projectId);
  expect(quoted.quote).toEqual(order.quote);
  expect(quoted.artifactHashes.budget).toMatch(/^0x[0-9a-f]{64}$/);
  expect(quoted.artifactHashes.quote).toMatch(/^0x[0-9a-f]{64}$/);
  expect(Object.isFrozen(quoted.quote)).toBe(true);
  expect(validateBuilderOrderSnapshot(quoted).ok).toBe(true);
});

test("expired or design-mismatched builder quotes cannot create payment actions", () => {
  const initial = createBuilderOrderSnapshot(defaultBuilderDocument(), now, "project-5");
  const context = buildContext(now, 72);
  let order = createOrder({ id: "order-stale-builder", now });
  order = reduce(order, { type: "selectBuilderHome", home: initial.home }, context).order;
  order = reduce(order, { type: "selectParcel", parcelId: "lsa-aspen-road" }, context).order;
  order = reduce(order, { type: "requestQuote" }, context).order;

  const expired = reduce(
    order,
    { type: "placeDeposit" },
    buildContext(new Date("2026-08-19T12:00:00.000Z"), 72),
  );
  expect(expired.order.status).toBe("quoted");
  expect(expired.reply).toContain("expired");
  expect(expired.actions).toEqual([
    { type: "disableBuy", reason: "The quote has expired." },
  ]);

  const changed = {
    ...order,
    home: {
      ...initial.home,
      documentHash: `0x${"1".repeat(64)}`,
      artifactHashes: { designDocument: `0x${"1".repeat(64)}` },
    },
  };
  const mismatch = reduce(changed, { type: "placeDeposit" }, context);
  expect(mismatch.order.status).toBe("quoted");
  expect(mismatch.reply).toContain("different version");
  expect(mismatch.actions[0]?.type).toBe("disableBuy");
});
