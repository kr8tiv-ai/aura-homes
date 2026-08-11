import { expect, test } from "playwright/test";

import { defaultBuilderDocument } from "@/lib/builder/document";
import {
  decodeDocumentSync,
  documentFromString,
  encodeDocumentSync,
  encodeSpecSync,
} from "@/lib/builder/share";

test("document share tokens preserve durable builder state", () => {
  const base = defaultBuilderDocument();
  const document = {
    ...base,
    finishes: { "vol:main/wall:n": "timber-cladding" as const },
    comfort: {
      ...base.comfort,
      conditions: { ...base.comfort.conditions, winterIndoorC: 22 },
    },
  };

  const token = encodeDocumentSync(document);
  expect(token).toMatch(/^D2r/);
  expect(decodeDocumentSync(token)).toEqual(document);
});

test("legacy spec links open as migrated builder documents", async () => {
  const document = defaultBuilderDocument();
  const legacyToken = encodeSpecSync(document.spec);
  const decoded = await documentFromString(legacyToken);

  expect(decoded?.spec).toEqual(document.spec);
  expect(decoded?.partitions).toEqual([]);
  expect(decoded?.quarantine.entries).toEqual([]);
});

test("v1 document links remain readable through the explicit document migration", () => {
  const current = defaultBuilderDocument();
  const payload = Buffer.from(JSON.stringify({ ...current, version: 1 }), "utf8").toString(
    "base64url",
  );
  const decoded = decodeDocumentSync(`D1r${payload}`);

  expect(decoded).not.toBeNull();
  expect(decoded?.version).toBe(current.version);
  expect(decoded?.geometry).toEqual({ kind: "legacy-volumes", source: "spec.volumes" });
});

test("future document share versions are refused before payload interpretation", () => {
  const token = encodeDocumentSync(defaultBuilderDocument()).replace(/^D2/, "D99");
  expect(decodeDocumentSync(token)).toBeNull();
});
