/* ===========================================================================
   PHRASES — say what you want; the document changes; undo takes it back.

   The interaction pattern is borrowed, with credit, from Salsita's public
   conversational-configurator work (salsita.ai, recorded in
   docs/research/PLAN-LIBRARY-SOURCES.md § 9): natural language driving a live
   parametric model. The implementation is deliberately NOT a language model.
   It is a fixed grammar over the same pure edit functions the sliders call,
   for three reasons this project cares about:

   · DETERMINISM. The same phrase against the same spec produces the same
     bytes, offline, forever — the property every export and share link
     already depends on. A phrase is just a slider you can type.
   · HONESTY. The editor can say exactly what it understands (the guide below
     is generated from the grammar, not written beside it), instead of
     accepting anything and quietly doing nothing with most of it.
   · CLAMPS. A phrase lands inside the same LIMITS as every control, and when
     a value is clamped the reply SAYS so — "width → 80 ft (limit)" — rather
     than pretending 200 ft happened.

   Every successful parse returns ONE new spec and a human sentence describing
   what actually changed. The caller wraps it in a single history entry, so a
   phrase costs exactly one undo. Anything the grammar does not recognise
   returns null — never a guess.
   =========================================================================== */

import type { EcoMaterial } from "@/lib/designApi";
import type { HomeSpec, OpeningKind, RoofForm, Volume, Wall } from "@/lib/builder/spec";
import {
  DEFAULT_DECK,
  LIMITS,
  WALL_LABELS,
  addOpening,
  addVolume,
  clamp,
  duplicateVolume,
  patchDeck,
  patchRoof,
  patchSiting,
  patchVolume,
  setDeck,
  snap,
} from "./edits";

export interface PhraseEdit {
  /** the new spec — one whole edit, ready for one history entry */
  spec: HomeSpec;
  /** short label for the history step, e.g. `width` */
  label: string;
  /** what actually happened, clamps included, in a sentence */
  say: string;
}

/** One line per grammar family, shown in the command palette so the honest
 *  answer to "what can I type?" is on screen rather than in a changelog. */
export const PHRASE_GUIDE: readonly string[] = [
  "width 24 · depth 30 · height 10 — set a dimension in feet",
  "wider by 4 · deeper by 2 · taller by 1 — nudge a dimension",
  "a-frame roof · gable roof · shed roof · flat roof · saltbox roof",
  "pitch 45 · steeper by 5 · flatter by 5",
  "build in clt · sip · rammed earth · timber frame",
  "add a deck · remove the deck · deck 16 by 8 · hot tub on/off",
  "add a window on the north · add a door on the east · add a glazing wall on the south",
  "add a volume · duplicate this",
  "two storeys · one storey · face south · call it Ridge House",
] as const;

const ROOF_FORMS: Record<string, RoofForm> = {
  gable: "gable",
  "a-frame": "a-frame",
  aframe: "a-frame",
  shed: "shed",
  flat: "flat",
  saltbox: "saltbox",
};

const MATERIALS: Record<string, { id: EcoMaterial; label: string }> = {
  sip: { id: "sip", label: "SIP" },
  sips: { id: "sip", label: "SIP" },
  clt: { id: "clt", label: "CLT" },
  "cross-laminated timber": { id: "clt", label: "CLT" },
  "rammed earth": { id: "rammed_earth", label: "rammed earth" },
  "timber frame": { id: "timber_frame", label: "timber frame" },
  timber: { id: "timber_frame", label: "timber frame" },
};

const WALLS: Record<string, Wall> = { north: "n", south: "s", east: "e", west: "w" };

const OPENINGS: Record<string, OpeningKind> = {
  window: "window",
  door: "door",
  "glazing wall": "glazing-wall",
  "glazing-wall": "glazing-wall",
};

/** Feet, snapped to the control's own step, clamped to its own limits — and
 *  the sentence admits the clamp, because a silent clamp reads as a bug. */
function bounded(
  asked: number,
  limit: { min: number; max: number; step: number },
): { value: number; note: string } {
  const value = snap(clamp(asked, limit.min, limit.max), limit.step);
  const clamped = asked < limit.min || asked > limit.max;
  return { value, note: clamped ? ` (limit ${limit.min}–${limit.max} ft)` : "" };
}

const DIMENSIONS: Record<
  string,
  { key: "widthFt" | "depthFt" | "wallHeightFt"; limit: { min: number; max: number; step: number }; label: string }
> = {
  width: { key: "widthFt", limit: LIMITS.widthFt, label: "width" },
  depth: { key: "depthFt", limit: LIMITS.depthFt, label: "depth" },
  height: { key: "wallHeightFt", limit: LIMITS.wallHeightFt, label: "wall height" },
  "wall height": { key: "wallHeightFt", limit: LIMITS.wallHeightFt, label: "wall height" },
};

const NUDGES: Record<string, { dim: keyof typeof DIMENSIONS; sign: 1 | -1 }> = {
  wider: { dim: "width", sign: 1 },
  narrower: { dim: "width", sign: -1 },
  deeper: { dim: "depth", sign: 1 },
  shallower: { dim: "depth", sign: -1 },
  taller: { dim: "height", sign: 1 },
  shorter: { dim: "height", sign: -1 },
};

const FACING: Record<string, { deg: number; label: string }> = {
  north: { deg: 0, label: "north" },
  east: { deg: 90, label: "east" },
  south: { deg: 180, label: "south" },
  west: { deg: 270, label: "west" },
};

/**
 * Parse one phrase against one spec.
 *
 * `volumeId` is the volume the phrase acts on — the selected one, or the first
 * when nothing is selected. Phrases that need a volume return null when the
 * spec has none, and whole-home phrases (deck, name, material, facing) ignore
 * it entirely.
 */
export function applyPhrase(spec: HomeSpec, volumeId: string | null, raw: string): PhraseEdit | null {
  const input = raw.trim().replace(/\s+/g, " ").replace(/[.!]+$/, "");
  if (input.length === 0) return null;
  const text = input.toLowerCase();

  const volume: Volume | null =
    spec.volumes.find((v) => v.id === volumeId) ?? spec.volumes[0] ?? null;

  /* ---- whole-home phrases first: they never need a volume ---- */

  const name = /^(?:name|call) (?:it |this |the home )?["“]?(.{1,60}?)["”]?$/i.exec(input);
  if (name) {
    const next = name[1].trim();
    if (next.length === 0) return null;
    return { spec: { ...spec, name: next }, label: "name", say: `Name → “${next}”` };
  }

  const material = /^(?:switch to |material |build in |build it in |use )?(sips?|clt|cross[- ]laminated timber|rammed[ -]earth|timber[ -]frame|timber)$/.exec(text);
  if (material) {
    const entry = MATERIALS[material[1].replace(/-/g, " ")];
    if (!entry || spec.material === entry.id) return null;
    return { spec: { ...spec, material: entry.id }, label: "material", say: `Material → ${entry.label}` };
  }

  const face = /^face (north|south|east|west)$/.exec(text);
  if (face) {
    const facing = FACING[face[1]];
    if (spec.siting.frontFacesDeg === facing.deg) return null;
    return {
      spec: patchSiting(spec, { frontFacesDeg: facing.deg }),
      label: "facing",
      say: `Front → faces ${facing.label}`,
    };
  }

  if (/^add (?:a |the )?deck$/.test(text)) {
    if (spec.deck) return null;
    return { spec: setDeck(spec, { ...DEFAULT_DECK }), label: "deck", say: "Deck added on the south wall" };
  }

  if (/^remove (?:the )?deck$/.test(text)) {
    if (!spec.deck) return null;
    return { spec: setDeck(spec, null), label: "deck", say: "Deck removed" };
  }

  const deckSize = /^deck (\d+(?:\.\d+)?) ?(?:by|x|×) ?(\d+(?:\.\d+)?)$/.exec(text);
  if (deckSize) {
    const w = bounded(Number(deckSize[1]), LIMITS.deckFt);
    const d = bounded(Number(deckSize[2]), LIMITS.deckFt);
    const next = spec.deck
      ? patchDeck(spec, { widthFt: w.value, depthFt: d.value })
      : setDeck(spec, { ...DEFAULT_DECK, widthFt: w.value, depthFt: d.value });
    return { spec: next, label: "deck", say: `Deck → ${w.value} × ${d.value} ft${w.note}${d.note}` };
  }

  const hotTub = /^hot ?tub (on|off)$/.exec(text);
  if (hotTub) {
    const on = hotTub[1] === "on";
    if (!spec.deck) {
      if (!on) return null;
      return { spec: setDeck(spec, { ...DEFAULT_DECK, hotTub: true }), label: "deck", say: "Deck added with the hot tub" };
    }
    if (spec.deck.hotTub === on) return null;
    return { spec: patchDeck(spec, { hotTub: on }), label: "deck", say: on ? "Hot tub on" : "Hot tub off" };
  }

  /* ---- volume phrases: everything below acts on ONE volume ---- */

  if (/^add (?:a |another )?(?:volume|wing|mass)$/.test(text)) {
    const added = addVolume(spec);
    const name2 = added.spec.volumes[added.spec.volumes.length - 1]?.name ?? added.id;
    return { spec: added.spec, label: "volume", say: `Added “${name2}” east of the current bounds` };
  }

  if (volume === null) return null;

  if (/^duplicate(?: this| it| volume)?$/.test(text)) {
    const copied = duplicateVolume(spec, volume.id);
    if (copied.spec === spec) return null;
    return { spec: copied.spec, label: "volume", say: `Duplicated “${volume.name}”` };
  }

  const roofForm = /^(?:roof (?:to )?)?(gable|a-?frame|shed|flat|saltbox)(?: roof)?$/.exec(text);
  if (roofForm && (text.includes("roof") || ROOF_FORMS[roofForm[1]] === "a-frame")) {
    const form = ROOF_FORMS[roofForm[1]];
    if (volume.roof.form === form) return null;
    return {
      spec: patchRoof(spec, volume.id, { form }),
      label: "roof",
      say: `“${volume.name}” roof → ${form}`,
    };
  }

  const pitch = /^(?:roof )?pitch (?:to )?(\d+(?:\.\d+)?)(?:°| ?deg(?:rees)?)?$/.exec(text);
  if (pitch) {
    const asked = Number(pitch[1]);
    const value = snap(clamp(asked, LIMITS.pitchDeg.min, LIMITS.pitchDeg.max), LIMITS.pitchDeg.step);
    if (value === volume.roof.pitchDeg) return null;
    const note = asked > LIMITS.pitchDeg.max ? ` (limit ${LIMITS.pitchDeg.max}°)` : "";
    return { spec: patchRoof(spec, volume.id, { pitchDeg: value }), label: "roof", say: `“${volume.name}” pitch → ${value}°${note}` };
  }

  const pitchNudge = /^(steeper|flatter)(?: by (\d+(?:\.\d+)?))?(?:°| ?deg(?:rees)?)?$/.exec(text);
  if (pitchNudge) {
    const delta = (pitchNudge[2] ? Number(pitchNudge[2]) : 5) * (pitchNudge[1] === "steeper" ? 1 : -1);
    const value = snap(clamp(volume.roof.pitchDeg + delta, LIMITS.pitchDeg.min, LIMITS.pitchDeg.max), LIMITS.pitchDeg.step);
    if (value === volume.roof.pitchDeg) return null;
    return { spec: patchRoof(spec, volume.id, { pitchDeg: value }), label: "roof", say: `“${volume.name}” pitch → ${value}°` };
  }

  const dimension = /^(width|depth|wall height|height) (?:to )?(\d+(?:\.\d+)?)(?: ?ft| ?feet|')?$/.exec(text);
  if (dimension) {
    const entry = DIMENSIONS[dimension[1]];
    const { value, note } = bounded(Number(dimension[2]), entry.limit);
    if (value === volume[entry.key]) return null;
    return {
      spec: patchVolume(spec, volume.id, { [entry.key]: value }),
      label: entry.label,
      say: `“${volume.name}” ${entry.label} → ${value} ft${note}`,
    };
  }

  const nudge = /^(wider|narrower|deeper|shallower|taller|shorter)(?: by (\d+(?:\.\d+)?))?(?: ?ft| ?feet|')?$/.exec(text);
  if (nudge) {
    const move = NUDGES[nudge[1]];
    const entry = DIMENSIONS[move.dim];
    const delta = (nudge[2] ? Number(nudge[2]) : 2) * move.sign;
    const { value, note } = bounded(volume[entry.key] + delta, entry.limit);
    if (value === volume[entry.key]) return null;
    return {
      spec: patchVolume(spec, volume.id, { [entry.key]: value }),
      label: entry.label,
      say: `“${volume.name}” ${entry.label} → ${value} ft${note}`,
    };
  }

  const storeys = /^(?:(one|two|1|2) store(?:y|ys|ies)|storeys (?:to )?(1|2))$/.exec(text);
  if (storeys) {
    const word = storeys[1] ?? storeys[2];
    const count: 1 | 2 = word === "two" || word === "2" ? 2 : 1;
    if (volume.storeys === count) return null;
    return {
      spec: patchVolume(spec, volume.id, { storeys: count }),
      label: "storeys",
      say: `“${volume.name}” → ${count === 2 ? "two storeys" : "one storey"}`,
    };
  }

  const openingAdd = /^add (?:a |an )?(window|door|glazing wall|glazing-wall) (?:on |to |at )?(?:the )?(north|south|east|west)(?: side| wall)?$/.exec(text);
  if (openingAdd) {
    const kind = OPENINGS[openingAdd[1]];
    const wall = WALLS[openingAdd[2]];
    const added = addOpening(spec, volume.id, wall, kind);
    if (added.id === "") return null;
    return {
      spec: added.spec,
      label: "opening",
      say: `${kind === "glazing-wall" ? "Glazing wall" : kind === "door" ? "Door" : "Window"} added on “${volume.name}” ${WALL_LABELS[wall].toLowerCase()}`,
    };
  }

  return null;
}
