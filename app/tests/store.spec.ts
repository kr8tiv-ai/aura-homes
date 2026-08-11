import { expect, test } from "playwright/test";

import {
  BUILDER_DOCUMENT_VERSION,
  defaultBuilderDocument,
} from "@/lib/builder/document";
import {
  documentSignature,
  libraryToJson,
  parseLibraryFile,
} from "@/lib/builder/store";

const stamp = "2026-08-11T12:00:00.000Z";

function savedDocument() {
  const document = defaultBuilderDocument();
  return {
    id: "saved-1",
    name: document.spec.name,
    documentVersion: BUILDER_DOCUMENT_VERSION,
    specVersion: document.spec.version,
    thumbnail: null,
    createdAt: 1,
    updatedAt: 2,
    headline: {
      floorAreaSqFt: 799,
      footprintSqFt: 799,
      ridgeHeightFt: 21,
      volumeCount: 1,
    },
    signature: documentSignature(document),
    document,
  };
}

test("library files round-trip the complete builder document", () => {
  const saved = savedDocument();
  const text = libraryToJson([saved], stamp);
  const parsed = parseLibraryFile(text);

  expect(parsed.problem).toBeNull();
  expect(parsed.skipped).toEqual([]);
  expect(parsed.designs).toHaveLength(1);
  expect(parsed.designs[0].document).toEqual(saved.document);
  expect(parsed.designs[0].signature).toBe(documentSignature(saved.document));
});

test("legacy HomeSpec library records migrate without losing the original file", () => {
  const saved = savedDocument();
  const legacy = {
    format: "aura-design-library",
    fileVersion: 1,
    specVersion: saved.specVersion,
    generator: "Aura Homes builder",
    exportedAt: stamp,
    disclaimer: "legacy test",
    designs: [
      {
        id: saved.id,
        name: saved.name,
        specVersion: saved.specVersion,
        thumbnail: null,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        headline: saved.headline,
        signature: "legacy-signature",
        spec: saved.document.spec,
      },
    ],
  };

  const parsed = parseLibraryFile(JSON.stringify(legacy));
  expect(parsed.problem).toBeNull();
  expect(parsed.designs).toHaveLength(1);
  expect(parsed.designs[0].document.spec).toEqual(saved.document.spec);
  expect(parsed.designs[0].document.partitions).toEqual([]);
});

test("future builder documents in a library are skipped visibly", () => {
  const saved = savedDocument();
  const future = {
    ...saved,
    document: {
      ...saved.document,
      version: BUILDER_DOCUMENT_VERSION + 1,
    },
    documentVersion: BUILDER_DOCUMENT_VERSION + 1,
  };
  const file = JSON.parse(libraryToJson([saved], stamp));
  file.designs = [future];

  const parsed = parseLibraryFile(JSON.stringify(file));
  expect(parsed.designs).toEqual([]);
  expect(parsed.skipped.join(" ")).toContain("newer version");
});
