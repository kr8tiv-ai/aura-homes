import { expect, test } from "playwright/test";

import { applyPhrase, PHRASE_GUIDE } from "@/components/builder/phrases";
import { LIMITS } from "@/components/builder/edits";
import { defaultSpec } from "@/lib/builder/spec";

const spec = () => defaultSpec();
const mainId = () => spec().volumes[0].id;

test("dimensions parse, snap, clamp — and the sentence admits the clamp", () => {
  const set = applyPhrase(spec(), mainId(), "width 24");
  expect(set).not.toBeNull();
  expect(set!.spec.volumes[0].widthFt).toBe(24);
  expect(set!.say).toContain("24 ft");
  expect(set!.say).not.toContain("limit");

  const clamped = applyPhrase(spec(), mainId(), "width 200");
  expect(clamped!.spec.volumes[0].widthFt).toBe(LIMITS.widthFt.max);
  expect(clamped!.say).toContain("limit");

  const nudged = applyPhrase(spec(), mainId(), "wider by 4");
  expect(nudged!.spec.volumes[0].widthFt).toBe(spec().volumes[0].widthFt + 4);

  const defaultNudge = applyPhrase(spec(), mainId(), "deeper");
  expect(defaultNudge!.spec.volumes[0].depthFt).toBe(spec().volumes[0].depthFt + 2);
});

test("a phrase that would change nothing is a non-match, not an empty history step", () => {
  const current = spec().volumes[0].widthFt;
  expect(applyPhrase(spec(), mainId(), `width ${current}`)).toBeNull();
  expect(applyPhrase(spec(), mainId(), "gibberish that parses as nothing")).toBeNull();
  expect(applyPhrase(spec(), mainId(), "")).toBeNull();
});

test("roof phrases: form needs the word roof unless it is the unambiguous a-frame", () => {
  expect(applyPhrase(spec(), mainId(), "flat")).toBeNull();
  const flat = applyPhrase(spec(), mainId(), "flat roof");
  expect(flat!.spec.volumes[0].roof.form).toBe("flat");

  // bare "a-frame" is unambiguous, so it works without the word "roof"
  const aframe = applyPhrase(spec(), mainId(), "a-frame");
  expect(aframe!.spec.volumes[0].roof.form).toBe("a-frame");

  const pitch = applyPhrase(spec(), mainId(), "pitch 45");
  expect(pitch!.spec.volumes[0].roof.pitchDeg).toBe(45);

  const over = applyPhrase(spec(), mainId(), "pitch 89");
  expect(over!.spec.volumes[0].roof.pitchDeg).toBe(LIMITS.pitchDeg.max);
  expect(over!.say).toContain("limit");

  const steeper = applyPhrase(spec(), mainId(), "steeper by 5");
  expect(steeper!.spec.volumes[0].roof.pitchDeg).toBe(spec().volumes[0].roof.pitchDeg + 5);
});

test("whole-home phrases: material, name, facing, deck, hot tub", () => {
  const clt = applyPhrase(spec(), null, "build in clt");
  expect(clt!.spec.material).toBe("clt");

  const named = applyPhrase(spec(), null, "call it Ridge House");
  expect(named!.spec.name).toBe("Ridge House");

  const faced = applyPhrase(spec(), null, "face north");
  expect(faced!.spec.siting.frontFacesDeg).toBe(0);

  const noDeck = applyPhrase(spec(), null, "remove the deck");
  expect(noDeck!.spec.deck).toBeNull();
  // removing again is a no-op, so it must be a non-match
  expect(applyPhrase(noDeck!.spec, null, "remove the deck")).toBeNull();

  const sized = applyPhrase(noDeck!.spec, null, "deck 16 by 8");
  expect(sized!.spec.deck).toMatchObject({ widthFt: 16, depthFt: 8 });

  const tub = applyPhrase(sized!.spec, null, "hot tub off");
  expect(tub!.spec.deck!.hotTub).toBe(false);
});

test("volume phrases: add, duplicate, storeys, openings — deterministic ids intact", () => {
  const added = applyPhrase(spec(), null, "add a volume");
  expect(added!.spec.volumes.length).toBe(spec().volumes.length + 1);
  expect(applyPhrase(spec(), null, "add a volume")!.spec).toEqual(added!.spec);

  const doubled = applyPhrase(spec(), mainId(), "duplicate this");
  expect(doubled!.spec.volumes.length).toBe(spec().volumes.length + 1);

  const two = applyPhrase(spec(), mainId(), "two storeys");
  expect(two!.spec.volumes[0].storeys).toBe(2);

  const before = spec().volumes[0].openings.length;
  const window = applyPhrase(spec(), mainId(), "add a window on the north");
  expect(window!.spec.volumes[0].openings.length).toBe(before + 1);
  expect(window!.spec.volumes[0].openings.at(-1)!.wall).toBe("n");

  const door = applyPhrase(spec(), mainId(), "add a door to the east side");
  expect(door!.spec.volumes[0].openings.at(-1)!.kind).toBe("door");

  const glazing = applyPhrase(spec(), mainId(), "add a glazing wall on the south");
  expect(glazing!.spec.volumes[0].openings.at(-1)!.kind).toBe("glazing-wall");
});

test("volume phrases without any volume are non-matches, and the guide is non-empty", () => {
  const empty = { ...spec(), volumes: [] };
  expect(applyPhrase(empty, null, "wider by 4")).toBeNull();
  expect(applyPhrase(empty, null, "duplicate this")).toBeNull();
  expect(PHRASE_GUIDE.length).toBeGreaterThanOrEqual(8);
});
