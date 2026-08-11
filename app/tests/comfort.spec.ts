import { expect, test } from "playwright/test";

import {
  NEUTRAL_BAND,
  comfortReport,
  comfortSentence,
  sensationWord,
} from "@/lib/builder/comfort";
import { defaultSpec } from "@/lib/builder/spec";
import { defaultBuilderDocument, hashBuilderDocument } from "@/lib/builder/document";
import { homeToIfc } from "@/lib/builder/exportPro";
import { specToIfcJson } from "@/lib/builder/exportSemantic";

test("sleeping rooms are reported as unmodelled rather than meeting or missing", () => {
  const report = comfortReport(defaultSpec());
  const sleeping = report.rooms.filter((room) => room.room.use === "sleeping");
  const modelled = report.rooms.filter((room) => room.modelled);

  expect(sleeping.length).toBeGreaterThan(0);
  for (const room of sleeping) {
    expect(room.modelled).toBe(false);
    expect(room.winter.meets).toBeNull();
    expect(room.summer.meets).toBeNull();
    expect(room.winter.indexInBand).toBeNull();
    expect(room.summer.indexInBand).toBeNull();
  }

  expect(report.winter.roomsModelled).toBe(modelled.length);
  expect(report.winter.roomsUnmodelled).toBe(sleeping.length);
  expect(report.winter.roomsMeeting).toBe(
    modelled.filter((room) => room.winter.meets === true).length,
  );

  const sentence = comfortSentence(report, "winter");
  expect(sentence).toContain(`${modelled.length} modelled rooms`);
  expect(sentence).toContain(`${sleeping.length} sleeping room`);
  expect(sentence).toContain("unmodelled");
});

test("the sensation wording includes both edges of the neutral band", () => {
  expect(sensationWord(-2.5)).toBe("cold");
  expect(sensationWord(-1.5)).toBe("cool");
  expect(sensationWord(-NEUTRAL_BAND)).toBe("neutral");
  expect(sensationWord(NEUTRAL_BAND)).toBe("neutral");
  expect(sensationWord(-NEUTRAL_BAND - 0.01)).toBe("slightly cool");
  expect(sensationWord(NEUTRAL_BAND + 0.01)).toBe("slightly warm");
  expect(sensationWord(1.5)).toBe("warm");
  expect(sensationWord(2.5)).toBe("hot");
});

test("professional exports label unmodelled sleeping verdicts without boolean claims", () => {
  const spec = defaultSpec();
  const ifc = homeToIfc(spec, { dateISO: "2026-08-11" });
  const ifcJson = JSON.stringify(specToIfcJson(spec));

  expect(ifc).toContain("IFCLABEL('UNMODELLED')");
  expect(ifcJson).toContain('"value":"UNMODELLED"');

  for (const room of comfortReport(spec).rooms.filter((item) => !item.modelled)) {
    const lines = ifc.split("\n");
    const start = lines.findIndex(
      (line) => line.includes("=IFCSPACE(") && line.includes(`'${room.room.name}'`),
    );
    const end = lines.findIndex(
      (line, index) => index > start && line.includes("=IFCSPACE("),
    );
    const block = lines.slice(start, end < 0 ? undefined : end).join("\n");

    expect(start).toBeGreaterThanOrEqual(0);
    expect(block).toContain("IFCLABEL('UNMODELLED')");
    expect(block).not.toContain("'WinterMeetsTarget'");
    expect(block).not.toContain("'SummerMeetsTarget'");
  }
});

test("professional document exports default to the saved comfort intent", () => {
  const base = defaultBuilderDocument();
  const document = {
    ...base,
    comfort: {
      ...base.comfort,
      conditions: { ...base.comfort.conditions, winterIndoorC: 19.25 },
    },
  };

  const ifc = homeToIfc(document, { dateISO: "2026-08-11" });
  const ifcJson = JSON.stringify(specToIfcJson(document));

  expect(ifc).toContain("'AssumedWinterTemperatureC'");
  expect(ifc).toContain("IFCREAL(19.25)");
  expect(ifc).toContain(hashBuilderDocument(document));
  expect(ifcJson).toContain('"name":"AssumedWinterTemperatureC"');
  expect(ifcJson).toContain('"value":19.25');
  expect(ifcJson).toContain(hashBuilderDocument(document));
});
