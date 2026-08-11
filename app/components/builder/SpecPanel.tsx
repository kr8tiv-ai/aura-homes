"use client";

/* ===========================================================================
   THE CONTROLS — everything a person with no CAD experience can change.

   Two rules shaped this panel.

   1. NOTHING IS A DEAD END. Every control is reversible, every add has a
      remove, every remove is undoable, and the numeric limits in `edits.ts`
      keep the spec inside what `validateHomeSpec` accepts — so a home built
      here can always be shared, always re-opened, and never reaches a state
      the tool cannot get back out of.
   2. THE CONTROL SAYS WHAT IT DOES TO THE BUILDING. A slider called "pitch"
      with a number next to it is a setting; a slider that also says the ridge
      it produces is a design decision. Where a field has a real consequence —
      snow load, the FDWR ceiling, a roof form that deletes two walls — the
      hint says so at the point of the change rather than in a manual.

   The panel edits a FROZEN contract through the pure helpers in `edits.ts`;
   it never mutates a spec and never invents a quantity of its own.
   =========================================================================== */

import { Field, Select, TextArea } from "@/components/design/Controls";
import { CLIMATE_ZONES, MATERIALS, feetInches } from "@/components/design/ecoSpec";
import type { HomeSpec, OpeningKind, RoofForm, Volume, Wall } from "@/lib/builder/spec";
import { ridgeHeightFt } from "@/lib/builder/spec";
import type { ClimateZone, EcoMaterial } from "@/lib/designApi";
import {
  DEFAULT_DECK,
  KIND_LABELS,
  LIMITS,
  WALL_LABELS,
  addOpening,
  addVolume,
  clamp,
  duplicateVolume,
  patchDeck,
  patchOpening,
  patchRoof,
  patchSiting,
  patchVolume,
  removeOpening,
  removeVolume,
  setDeck,
  snap,
  wallLengthFt,
} from "./edits";
import { SEASONS, bearingWords, hourLabel, type Season } from "./sun";
import { Button, Panel, Segmented, Slider, TextInput } from "./ui";

/* ------------------------------------------------------------------ tables */

const ROOF_FORMS: ReadonlyArray<{ id: RoofForm; label: string; title: string }> = [
  { id: "gable", label: "Gable", title: "Two slopes off a central ridge — the default small-home roof" },
  { id: "a-frame", label: "A-frame", title: "The slope IS the wall, meeting near the ground — the Aura reference home" },
  { id: "shed", label: "Shed", title: "One plane, one direction — cheapest to frame, best for a solar array" },
  { id: "flat", label: "Flat", title: "Near-flat with a hidden 2° fall to drain, inside a parapet" },
  { id: "saltbox", label: "Saltbox", title: "A gable with one long side carried further down — Nordic, and it buys a covered elevation" },
];

const WALLS: ReadonlyArray<{ id: Wall; label: string }> = [
  { id: "n", label: "North" },
  { id: "s", label: "South" },
  { id: "e", label: "East" },
  { id: "w", label: "West" },
];

const KINDS: ReadonlyArray<{ id: OpeningKind; label: string; title: string }> = [
  { id: "window", label: "Window", title: "A punched opening with a sill" },
  { id: "door", label: "Door", title: "Meets the floor; excluded from the glazed area" },
  {
    id: "glazing-wall",
    label: "Glazing wall",
    title: "Floor-to-eave glass — the beautiful polycarbonate glass wall, drawn as a mullioned screen",
  },
];

const SLOPES: ReadonlyArray<{ id: HomeSpec["siting"]["slope"]; label: string }> = [
  { id: "flat", label: "Flat" },
  { id: "gentle", label: "Gentle" },
  { id: "steep", label: "Steep" },
];

const STOREYS: ReadonlyArray<{ id: "1" | "2"; label: string }> = [
  { id: "1", label: "One storey" },
  { id: "2", label: "Two storeys" },
];

/** A roof form whose slope can be turned. Gable and A-frame always fall across
 *  the width, because that is the span `ridgeHeightFt` measures. */
const TURNABLE: ReadonlyArray<RoofForm> = ["shed", "saltbox", "flat"];

const ft = (v: number): string => feetInches(v);
const deg = (v: number): string => `${Math.round(v)}°`;

/* =========================================================================== */

export interface SunState {
  hour: number;
  season: Season;
}

export default function SpecPanel({
  spec,
  selectedVolumeId,
  selectedOpeningId,
  onSelectVolume,
  onSelectOpening,
  onEdit,
  sun,
  onSun,
}: {
  spec: HomeSpec;
  selectedVolumeId: string | null;
  selectedOpeningId: string | null;
  onSelectVolume: (id: string) => void;
  onSelectOpening: (id: string | null) => void;
  /** `label` groups consecutive edits into ONE undo step — dragging a slider
   *  should not cost forty presses of the undo button. */
  onEdit: (next: HomeSpec, label: string) => void;
  sun: SunState;
  onSun: (next: SunState) => void;
}) {
  const volume = spec.volumes.find((v) => v.id === selectedVolumeId) ?? spec.volumes[0] ?? null;

  return (
    <div className="space-y-6">
      <HomePanel spec={spec} onEdit={onEdit} />
      <VolumesPanel
        spec={spec}
        volume={volume}
        onSelectVolume={onSelectVolume}
        onSelectOpening={onSelectOpening}
        onEdit={onEdit}
      />
      {volume ? (
        <>
          <RoofPanel spec={spec} volume={volume} onEdit={onEdit} />
          <OpeningsPanel
            spec={spec}
            volume={volume}
            selectedOpeningId={selectedOpeningId}
            onSelectOpening={onSelectOpening}
            onEdit={onEdit}
          />
        </>
      ) : null}
      <DeckPanel spec={spec} onEdit={onEdit} />
      <SitePanel spec={spec} onEdit={onEdit} sun={sun} onSun={onSun} />
    </div>
  );
}

/* ------------------------------------------------------------- the home */

function HomePanel({
  spec,
  onEdit,
}: {
  spec: HomeSpec;
  onEdit: (next: HomeSpec, label: string) => void;
}) {
  const mm = MATERIALS.find((m) => m.id === spec.material)?.wallMm ?? 165;
  return (
    <Panel
      label="The home"
      hint="Material is not a finish here: it sets the structural wall thickness that gets drawn, which moves the net internal area and the price per square foot."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label="Name"
          value={spec.name}
          maxLength={60}
          onChange={(name) => onEdit({ ...spec, name }, "home:name")}
        />
        <Field label="Climate zone" hint="Crosses to the drawing untouched and prints in the title block.">
          <Select<ClimateZone>
            value={spec.climateZone}
            options={CLIMATE_ZONES}
            onChange={(climateZone) => onEdit({ ...spec, climateZone }, "home:climate")}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Material"
            hint={`${mm} mm structural wall — the plan engine insets the interior envelope by this on all four sides.`}
          >
            <Select<EcoMaterial>
              value={spec.material}
              options={MATERIALS}
              onChange={(material) => onEdit({ ...spec, material }, "home:material")}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field
            label="Notes"
            hint="Carried verbatim onto the design request. Nothing about the massing is appended for you."
          >
            <TextArea
              value={spec.notes}
              rows={3}
              placeholder="Anything a designer should know — how you live in it, what the land is like, what matters."
              onChange={(notes) => onEdit({ ...spec, notes: notes.slice(0, 500) }, "home:notes")}
            />
          </Field>
        </div>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------- volumes */

function VolumesPanel({
  spec,
  volume,
  onSelectVolume,
  onSelectOpening,
  onEdit,
}: {
  spec: HomeSpec;
  volume: Volume | null;
  onSelectVolume: (id: string) => void;
  onSelectOpening: (id: string | null) => void;
  onEdit: (next: HomeSpec, label: string) => void;
}) {
  const add = () => {
    const r = addVolume(spec);
    onEdit(r.spec, `vol:add:${r.id}`);
    onSelectVolume(r.id);
    onSelectOpening(null);
  };

  const duplicate = () => {
    if (!volume) return;
    const r = duplicateVolume(spec, volume.id);
    onEdit(r.spec, `vol:dup:${r.id}`);
    onSelectVolume(r.id);
    onSelectOpening(null);
  };

  const remove = () => {
    if (!volume) return;
    const r = removeVolume(spec, volume.id);
    onEdit(r.spec, `vol:remove:${volume.id}`);
    onSelectVolume(r.spec.volumes[0]?.id ?? "");
    onSelectOpening(null);
  };

  return (
    <Panel
      label="Volumes"
      hint="A home is one or more rectangular masses, each with its own roof. Two at right angles is an L-plan; a small one against a big one is the Nordic main-house-plus-annexe. Keeping each mass rectangular is what keeps the plan engine able to solve it."
      right={
        <div className="flex gap-2">
          <Button onClick={add} tone="loud">
            Add volume
          </Button>
          <Button onClick={duplicate} disabled={!volume}>
            Duplicate
          </Button>
          <Button onClick={remove} tone="danger" disabled={!volume || spec.volumes.length <= 1}>
            Remove
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {spec.volumes.map((v) => {
          const on = v.id === volume?.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                onSelectVolume(v.id);
                onSelectOpening(null);
              }}
              aria-pressed={on}
              data-cursor="Select"
              className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                on ? "border-aura-emerald text-aura-text" : "aura-hairline text-aura-text/60 hover:text-aura-text"
              }`}
            >
              <span className="block">{v.name}</span>
              <span className="mt-0.5 block font-mono text-[0.6rem] tabular-nums text-aura-text/45">
                {ft(v.widthFt)} × {ft(v.depthFt)}
                {v.storeys === 2 ? " · 2 storeys" : ""}
              </span>
            </button>
          );
        })}
      </div>

      {volume ? (
        <div className="mt-6 space-y-5 border-t aura-hairline pt-6">
          <TextInput
            label="This volume"
            value={volume.name}
            maxLength={40}
            onChange={(name) => onEdit(patchVolume(spec, volume.id, { name }), `vol:${volume.id}:name`)}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Slider
              label="Width — east to west"
              value={volume.widthFt}
              min={LIMITS.widthFt.min}
              max={LIMITS.widthFt.max}
              step={LIMITS.widthFt.step}
              display={ft}
              onChange={(widthFt) =>
                onEdit(patchVolume(spec, volume.id, { widthFt }), `vol:${volume.id}:width`)
              }
              hint="The span the gable and A-frame ridge is measured across."
            />
            <Slider
              label="Depth — north to south"
              value={volume.depthFt}
              min={LIMITS.depthFt.min}
              max={LIMITS.depthFt.max}
              step={LIMITS.depthFt.step}
              display={ft}
              onChange={(depthFt) =>
                onEdit(patchVolume(spec, volume.id, { depthFt }), `vol:${volume.id}:depth`)
              }
            />
            <Slider
              label="Move east / west"
              value={volume.x}
              min={LIMITS.positionFt.min}
              max={LIMITS.positionFt.max}
              step={LIMITS.positionFt.step}
              display={(v) => `${v > 0 ? "E " : v < 0 ? "W " : ""}${ft(Math.abs(v))}`}
              onChange={(x) => onEdit(patchVolume(spec, volume.id, { x }), `vol:${volume.id}:x`)}
            />
            <Slider
              label="Move north / south"
              value={volume.z}
              min={LIMITS.positionFt.min}
              max={LIMITS.positionFt.max}
              step={LIMITS.positionFt.step}
              display={(v) => `${v > 0 ? "S " : v < 0 ? "N " : ""}${ft(Math.abs(v))}`}
              onChange={(z) => onEdit(patchVolume(spec, volume.id, { z }), `vol:${volume.id}:z`)}
            />
            <Slider
              label="Rotate"
              value={volume.rotationDeg}
              min={LIMITS.rotationDeg.min}
              max={LIMITS.rotationDeg.max}
              step={LIMITS.rotationDeg.step}
              display={(v) => `${deg(v)} — faces ${bearingWords(v + 180)}`}
              onChange={(rotationDeg) =>
                onEdit(patchVolume(spec, volume.id, { rotationDeg }), `vol:${volume.id}:rot`)
              }
              hint="Clockwise from north. A rotated home is often better for solar and always eats more of a rectangular buildable envelope."
            />
            <Slider
              label="Wall height per storey"
              value={volume.wallHeightFt}
              min={LIMITS.wallHeightFt.min}
              max={LIMITS.wallHeightFt.max}
              step={LIMITS.wallHeightFt.step}
              display={ft}
              onChange={(wallHeightFt) =>
                onEdit(patchVolume(spec, volume.id, { wallHeightFt }), `vol:${volume.id}:wallh`)
              }
              hint="Floor to the underside of the eave."
            />
          </div>

          <Segmented<"1" | "2">
            label="Storeys"
            value={volume.storeys === 2 ? "2" : "1"}
            options={STOREYS}
            columns={2}
            onChange={(s) =>
              onEdit(
                patchVolume(spec, volume.id, { storeys: s === "2" ? 2 : 1 }),
                `vol:${volume.id}:storeys`,
              )
            }
            hint="Two storeys doubles this volume's floor area and lifts the eave. The plan engine draws a two-storey home as ONE plate with the whole room program on it — the drawing step says so plainly."
          />
        </div>
      ) : (
        <p className="mt-6 text-sm leading-relaxed text-aura-text/60">
          There are no volumes. Add one — nothing about the model is lost, and the drawing step
          refuses to draw an empty house rather than inventing a rectangle.
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ roof */

function RoofPanel({
  spec,
  volume,
  onEdit,
}: {
  spec: HomeSpec;
  volume: Volume;
  onEdit: (next: HomeSpec, label: string) => void;
}) {
  const form = volume.roof.form;
  const flat = form === "flat";
  const turnable = TURNABLE.includes(form);
  const ridge = ridgeHeightFt(volume);

  return (
    <Panel
      label={`Roof — ${volume.name}`}
      hint="The roof is the whole silhouette, and none of it reaches the floor plan: a FloorPlan has no roof in it. What it does decide is the ridge height you take to your district, and whether the glass is shaded in July."
    >
      <div className="space-y-5">
        <Segmented<RoofForm>
          label="Form"
          value={form}
          options={ROOF_FORMS}
          onChange={(f) => onEdit(patchRoof(spec, volume.id, { form: f }), `roof:${volume.id}:form`)}
          hint={
            form === "a-frame"
              ? "On an A-frame the slopes ARE the walls: this volume has no east or west wall, and openings placed on them are reported and not built. Put them on the gable ends."
              : ROOF_FORMS.find((r) => r.id === form)?.title
          }
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Slider
            label="Pitch"
            value={volume.roof.pitchDeg}
            min={LIMITS.pitchDeg.min}
            max={LIMITS.pitchDeg.max}
            step={LIMITS.pitchDeg.step}
            display={deg}
            disabled={flat}
            onChange={(pitchDeg) =>
              onEdit(patchRoof(spec, volume.id, { pitchDeg }), `roof:${volume.id}:pitch`)
            }
            hint={
              flat
                ? "A flat roof drains at a fixed 2° behind a parapet — the pitch is not read."
                : "Alberta snow load wants 25° or more for shedding."
            }
          />
          <Slider
            label="Eave overhang"
            value={volume.roof.overhangFt}
            min={LIMITS.overhangFt.min}
            max={LIMITS.overhangFt.max}
            step={LIMITS.overhangFt.step}
            display={ft}
            onChange={(overhangFt) =>
              onEdit(patchRoof(spec, volume.id, { overhangFt }), `roof:${volume.id}:overhang`)
            }
            hint="Shade in summer, weather protection always. Drag the sun below and watch what it does to the south glass in June."
          />
        </div>

        {turnable ? (
          <Segmented<Wall>
            label="Slope faces"
            value={volume.roof.facing ?? (form === "saltbox" ? "n" : "s")}
            options={WALLS}
            columns={4}
            onChange={(facing) =>
              onEdit(patchRoof(spec, volume.id, { facing }), `roof:${volume.id}:facing`)
            }
            hint="South puts a shed's array in the sun; a saltbox carries its long slope down the weather side. Turning the slope across the depth keeps the ridge HEIGHT and changes the pitch that actually gets built — the model reports the built pitch rather than quietly re-deriving a different ridge."
          />
        ) : null}

        <p className="rounded-md border aura-hairline px-4 py-3 text-xs leading-relaxed text-aura-text/70">
          Ridge <span className="font-mono tabular-nums text-aura-text">{ft(ridge)}</span> above
          finished floor, from spec.ts&rsquo;s own <span className="font-mono">ridgeHeightFt</span>.
          The 3D model is built downward from exactly this number, so what you see is what the
          read-out says — no roof in the scene is ever taller than the figure printed against a
          height limit.
        </p>
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------- openings */

function OpeningsPanel({
  spec,
  volume,
  selectedOpeningId,
  onSelectOpening,
  onEdit,
}: {
  spec: HomeSpec;
  volume: Volume;
  selectedOpeningId: string | null;
  onSelectOpening: (id: string | null) => void;
  onEdit: (next: HomeSpec, label: string) => void;
}) {
  const opening = volume.openings.find((o) => o.id === selectedOpeningId) ?? null;

  const add = (kind: OpeningKind) => {
    const wall: Wall = opening?.wall ?? "s";
    const r = addOpening(spec, volume.id, wall, kind);
    if (!r.id) return;
    onEdit(r.spec, `open:add:${volume.id}:${r.id}`);
    onSelectOpening(r.id);
  };

  const runFt = opening ? wallLengthFt(spec, volume, opening.wall) : 0;
  const eave = volume.wallHeightFt * volume.storeys;

  return (
    <Panel
      label={`Openings — ${volume.name}`}
      hint="Placed on a named wall, measured from that wall's left end looking at it from outside. A glazing wall is the founder's beautiful polycarbonate glass and is a first-class choice here, not a very large window."
      right={
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Button key={k.id} onClick={() => add(k.id)} title={k.title}>
              + {k.label}
            </Button>
          ))}
        </div>
      }
    >
      {volume.openings.length === 0 ? (
        <p className="text-sm leading-relaxed text-aura-text/60">
          No openings on this volume. A home with no door is legal in a massing model and nowhere
          else — add one above.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {volume.openings.map((o) => {
            const on = o.id === opening?.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelectOpening(on ? null : o.id)}
                aria-pressed={on}
                data-cursor="Select"
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  on ? "border-aura-emerald text-aura-text" : "aura-hairline text-aura-text/60 hover:text-aura-text"
                }`}
              >
                <span className="block">
                  {WALL_LABELS[o.wall]} · {KIND_LABELS[o.kind]}
                </span>
                <span className="mt-0.5 block font-mono text-[0.6rem] tabular-nums text-aura-text/45">
                  {ft(o.widthFt)} × {ft(o.heightFt)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {opening ? (
        <div className="mt-6 space-y-5 border-t aura-hairline pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="aura-label">
              Editing {KIND_LABELS[opening.kind]} on the {WALL_LABELS[opening.wall]} wall
            </p>
            <Button
              tone="danger"
              onClick={() => {
                onEdit(removeOpening(spec, volume.id, opening.id), `open:remove:${opening.id}`);
                onSelectOpening(null);
              }}
            >
              Remove
            </Button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Segmented<Wall>
              label="Wall"
              value={opening.wall}
              options={WALLS}
              columns={4}
              onChange={(wall) => {
                // Walls are different lengths — e and w butt into n and s and
                // are two wall thicknesses shorter — so an offset that was
                // valid on one wall can hang off the end of another. Clamped
                // on the way across rather than left for the geometry to trim.
                const run = wallLengthFt(spec, volume, wall);
                const offsetFt = snap(clamp(opening.offsetFt, 0, Math.max(0, run - opening.widthFt)), 0.25);
                onEdit(
                  patchOpening(spec, volume.id, opening.id, { wall, offsetFt }),
                  `open:${opening.id}:wall`,
                );
              }}
            />
            <Segmented<OpeningKind>
              label="Kind"
              value={opening.kind}
              options={KINDS}
              columns={3}
              onChange={(kind) =>
                onEdit(patchOpening(spec, volume.id, opening.id, { kind }), `open:${opening.id}:kind`)
              }
              hint="Doors are excluded from the glazed area, the same way the engine counts."
            />
            <Slider
              label="Width"
              value={opening.widthFt}
              min={LIMITS.openingWidthFt.min}
              max={Math.max(LIMITS.openingWidthFt.min, Math.min(LIMITS.openingWidthFt.max, runFt))}
              step={LIMITS.openingWidthFt.step}
              display={ft}
              onChange={(widthFt) =>
                onEdit(
                  patchOpening(spec, volume.id, opening.id, { widthFt }),
                  `open:${opening.id}:width`,
                )
              }
              hint={`This wall is ${ft(runFt)} long.`}
            />
            <Slider
              label="Height"
              value={opening.heightFt}
              min={LIMITS.openingHeightFt.min}
              max={LIMITS.openingHeightFt.max}
              step={LIMITS.openingHeightFt.step}
              display={ft}
              onChange={(heightFt) =>
                onEdit(
                  patchOpening(spec, volume.id, opening.id, { heightFt }),
                  `open:${opening.id}:height`,
                )
              }
              hint={`Eave is at ${ft(eave)}. Taller than the wall is allowed — on a gable end the extra reaches into the roof, and anything past the outline is trimmed and reported.`}
            />
            <Slider
              label="Position along the wall"
              value={opening.offsetFt}
              min={0}
              max={Math.max(0, runFt)}
              step={0.25}
              display={ft}
              onChange={(offsetFt) =>
                onEdit(
                  patchOpening(spec, volume.id, opening.id, { offsetFt }),
                  `open:${opening.id}:offset`,
                )
              }
              hint="From the wall's left end, looking at it from outside."
            />
            <Slider
              label="Sill height"
              value={opening.sillFt}
              min={LIMITS.sillFt.min}
              max={LIMITS.sillFt.max}
              step={LIMITS.sillFt.step}
              display={ft}
              onChange={(sillFt) =>
                onEdit(patchOpening(spec, volume.id, opening.id, { sillFt }), `open:${opening.id}:sill`)
              }
              hint="Above the finished floor. Zero for a door or a glazing wall."
            />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------ deck */

function DeckPanel({
  spec,
  onEdit,
}: {
  spec: HomeSpec;
  onEdit: (next: HomeSpec, label: string) => void;
}) {
  const deck = spec.deck;
  return (
    <Panel
      label="The deck"
      hint="Attached to the first volume. Unconditioned, so its area is correctly NOT in the floor area the drawing is sized from — but most land use bylaws DO count it in site coverage."
      right={
        <Button
          tone={deck ? "danger" : "loud"}
          onClick={() => onEdit(setDeck(spec, deck ? null : DEFAULT_DECK), "deck:toggle")}
        >
          {deck ? "Remove deck" : "Add deck"}
        </Button>
      }
    >
      {deck ? (
        <div className="space-y-5">
          <Segmented<Wall>
            label="Attached to"
            value={deck.wall}
            options={WALLS}
            columns={4}
            onChange={(wall) => onEdit(patchDeck(spec, { wall }), "deck:wall")}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Slider
              label="Width along the wall"
              value={deck.widthFt}
              min={LIMITS.deckFt.min}
              max={LIMITS.deckFt.max}
              step={LIMITS.deckFt.step}
              display={ft}
              onChange={(widthFt) => onEdit(patchDeck(spec, { widthFt }), "deck:width")}
            />
            <Slider
              label="Depth out from the wall"
              value={deck.depthFt}
              min={LIMITS.deckFt.min}
              max={LIMITS.deckFt.max}
              step={LIMITS.deckFt.step}
              display={ft}
              onChange={(depthFt) => onEdit(patchDeck(spec, { depthFt }), "deck:depth")}
            />
          </div>
          <Segmented<"on" | "off">
            label="Wood-fired hot tub"
            value={deck.hotTub ? "on" : "off"}
            options={[
              { id: "on", label: "On the deck" },
              { id: "off", label: "None" },
            ]}
            columns={2}
            onChange={(v) => onEdit(patchDeck(spec, { hotTub: v === "on" }), "deck:tub")}
            hint="A costed line item in the Aura kit. It wants about 7 ft each way of clear deck; the model says so if it does not have it."
          />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-aura-text/60">
          No deck. Every Aura home in the brief has one — adding it back costs one press and changes
          nothing else about the model.
        </p>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------- site and sun */

function SitePanel({
  spec,
  onEdit,
  sun,
  onSun,
}: {
  spec: HomeSpec;
  onEdit: (next: HomeSpec, label: string) => void;
  sun: SunState;
  onSun: (next: SunState) => void;
}) {
  return (
    <Panel
      label="Site and sun"
      hint="The sun is a daylight model, not an energy model: solar time at 53.5°N — the Alberta pilot's latitude — with no longitude correction and no daylight saving. It moves a light so you can see the argument the rest of this site only makes in words."
    >
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Slider
            label="Front of the home faces"
            value={spec.siting.frontFacesDeg}
            min={LIMITS.frontFacesDeg.min}
            max={LIMITS.frontFacesDeg.max}
            step={LIMITS.frontFacesDeg.step}
            display={(v) => `${deg(v)} — ${bearingWords(v)}`}
            onChange={(frontFacesDeg) => onEdit(patchSiting(spec, { frontFacesDeg }), "site:front")}
            hint="180° is due south. Read by the parcel check and by the drawing's style name; a floor plan itself carries no compass."
          />
          <Slider
            label="Time of day"
            value={sun.hour}
            min={3}
            max={21}
            step={0.25}
            display={(v) => `${hourLabel(v)} solar`}
            onChange={(hour) => onSun({ ...sun, hour })}
            hint="Solar noon is 12:00 — the sun exactly due south. Real clock noon in Alberta runs later than this in summer."
          />
        </div>

        <Segmented<Season>
          label="Day of the year"
          value={sun.season}
          options={SEASONS.map((s) => ({ id: s.id, label: s.label, title: s.sub }))}
          columns={3}
          onChange={(season) => onSun({ ...sun, season })}
          hint={SEASONS.find((s) => s.id === sun.season)?.sub}
        />

        <Segmented<HomeSpec["siting"]["slope"]>
          label="Ground"
          value={spec.siting.slope}
          options={SLOPES}
          columns={3}
          onChange={(slope) => onEdit(patchSiting(spec, { slope }), "site:slope")}
          hint="Crosses to the parcel check unchanged; it is what decides the cost of a screw-pile foundation."
        />
      </div>
    </Panel>
  );
}
