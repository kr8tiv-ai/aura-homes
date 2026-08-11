"use client";

/* ===========================================================================
   THE COMFORT PANEL — targets, the assumptions behind them, and the arithmetic.

   `lib/builder/comfort.ts` owns every number on this page; this file decides
   only how they are laid out. That split matters more here than on the other
   panels, because "comfort" is a word people read as a promise and every
   figure below is conditional on an assumption somebody typed.

   THE RULE THIS PANEL KEEPS, EVERYWHERE
   -------------------------------------
   No comfort figure appears without the conditions that produced it. Not in
   the KPI strip, not in the table, not in the legend on the 3D view, not in
   the exported IFC. Where a room's result is shown, the assumed temperature
   and humidity are shown with it — and for the selected room, so is every
   term of the equation, so a reader can redo the arithmetic rather than
   trust it.

   WHAT THE OWNER CONTROLS. Four assumptions (winter and summer indoor
   temperature and relative humidity) and seven target fields per room. Nothing
   else on this page is an input, because nothing else is knowable about a home
   that does not exist yet.
   =========================================================================== */

import { useMemo, useState, type ReactNode } from "react";
import {
  COMFORT_DISCLAIMER,
  DEFAULT_CONDITIONS,
  DEFAULT_TARGETS,
  NEUTRAL_BAND,
  SEASON_LABEL,
  SPACE_USE_LABEL,
  SPMV_METHOD_NOTE,
  TARGET_PROVENANCE,
  VAPOUR_UNIT_NOTE,
  comfortSentence,
  fmt0,
  fmt1,
  fmt2,
  fmtSigned,
  seasonResult,
  sensationWord,
  type ComfortReport,
  type ComfortSettings,
  type ComfortTarget,
  type DesignConditions,
  type RoomComfort,
  type Season,
} from "@/lib/builder/comfort";
import { Button, Notice, Panel, Segmented, Slider, Stat } from "./ui";

const SEASONS: ReadonlyArray<{ id: Season; label: string; title: string }> = [
  {
    id: "winter",
    label: "Winter",
    title: "Evaluate every room against the winter assumptions and the winter target band",
  },
  {
    id: "summer",
    label: "Summer",
    title: "Evaluate every room against the summer assumptions and the summer target band",
  },
];

/** Four decimals, for the worked arithmetic only. Everywhere else the panel
 *  uses the one- and two-decimal helpers the module exports, so the page and
 *  an exported file round the same way. */
const fmt4 = (n: number): string => (Math.round(n * 1e4) / 1e4).toFixed(4);

export default function ComfortPanel({
  report,
  settings,
  onSettings,
  season,
  onSeason,
  heatmap,
  onHeatmap,
}: {
  report: ComfortReport;
  settings: ComfortSettings;
  onSettings: (next: ComfortSettings) => void;
  season: Season;
  onSeason: (next: Season) => void;
  heatmap: boolean;
  onHeatmap: (next: boolean) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const kpi = season === "winter" ? report.winter : report.summer;
  const assumedC =
    season === "winter" ? report.conditions.winterIndoorC : report.conditions.summerIndoorC;
  const assumedRh =
    season === "winter" ? report.conditions.winterRhPct : report.conditions.summerRhPct;

  /* Selection is DERIVED rather than stored, for the same reason the volume
     selection in `BuilderApp` is: re-solving the plan can remove a room, and
     an editor pointing at a room that is gone is an editor showing sliders
     that write nowhere. */
  const selected: RoomComfort | null = useMemo(() => {
    if (report.rooms.length === 0) return null;
    return report.rooms.find((r) => r.room.id === selectedId) ?? report.rooms[0];
  }, [report.rooms, selectedId]);

  const conditionsDirty =
    settings.conditions.winterIndoorC !== DEFAULT_CONDITIONS.winterIndoorC ||
    settings.conditions.winterRhPct !== DEFAULT_CONDITIONS.winterRhPct ||
    settings.conditions.summerIndoorC !== DEFAULT_CONDITIONS.summerIndoorC ||
    settings.conditions.summerRhPct !== DEFAULT_CONDITIONS.summerRhPct;

  const editedTargets = Object.keys(settings.targets).length;

  const setConditions = (patch: Partial<DesignConditions>): void => {
    onSettings({ ...settings, conditions: { ...settings.conditions, ...patch } });
  };

  const setTarget = (roomId: string, current: ComfortTarget, patch: Partial<ComfortTarget>): void => {
    onSettings({
      ...settings,
      targets: { ...settings.targets, [roomId]: { ...current, ...patch } },
    });
  };

  const clearTarget = (roomId: string): void => {
    const next: Record<string, ComfortTarget> = { ...settings.targets };
    delete next[roomId];
    onSettings({ ...settings, targets: next });
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------- the honesty block */}
      <section className="rounded-xl border border-aura-emerald p-6">
        <p className="aura-label text-aura-emerald">Design-time comfort targets</p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-aura-text/80">
          {COMFORT_DISCLAIMER}
        </p>
        <p className="mt-4 border-t aura-hairline pt-4 max-w-3xl text-xs leading-relaxed text-aura-text/60">
          What it IS good for: writing down what you are asking each room to do, and seeing
          whether the conditions you are assuming would satisfy that. The targets travel into the
          IFC and the ifcJSON as{" "}
          <span className="font-mono">Pset_SpaceThermalRequirements</span> and{" "}
          <span className="font-mono">Pset_SpaceLightingRequirements</span>, so a designer opening
          your file sees the brief, not just the box.
        </p>
      </section>

      {/* --------------------------------------------------- the assumptions */}
      <Panel
        label="The assumptions — every figure below is conditional on these"
        hint="Nothing here is measured or predicted. These are the indoor conditions you are assuming the home holds; change them and every result on this page moves with them."
        right={
          conditionsDirty ? (
            <Button onClick={() => setConditions(DEFAULT_CONDITIONS)}>Back to the defaults</Button>
          ) : null
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Slider
            label="Winter indoor air temperature"
            value={settings.conditions.winterIndoorC}
            min={10}
            max={30}
            step={0.5}
            onChange={(v) => setConditions({ winterIndoorC: v })}
            display={(v) => `${fmt1(v)} °C`}
            hint="The temperature residential heat-loss work in Canada is normally done at is 21 °C. This is an assumption, not an outcome."
          />
          <Slider
            label="Winter indoor relative humidity"
            value={settings.conditions.winterRhPct}
            min={10}
            max={70}
            step={1}
            onChange={(v) => setConditions({ winterRhPct: v })}
            display={(v) => `${fmt0(v)} %`}
            hint="In a zone 7A winter, indoor humidity much above the low forties condenses on glazing and inside the assembly."
          />
          <Slider
            label="Summer indoor air temperature"
            value={settings.conditions.summerIndoorC}
            min={10}
            max={35}
            step={0.5}
            onChange={(v) => setConditions({ summerIndoorC: v })}
            display={(v) => `${fmt1(v)} °C`}
          />
          <Slider
            label="Summer indoor relative humidity"
            value={settings.conditions.summerRhPct}
            min={10}
            max={80}
            step={1}
            onChange={(v) => setConditions({ summerRhPct: v })}
            display={(v) => `${fmt0(v)} %`}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t aura-hairline pt-5">
          <Segmented<Season>
            label="Which season this page is showing"
            value={season}
            options={SEASONS}
            onChange={onSeason}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              tone={heatmap ? "loud" : "quiet"}
              onClick={() => onHeatmap(!heatmap)}
              title="Tint the solved room floors in the 3D model by comfort deviation"
            >
              {heatmap ? "Heatmap on" : "Heatmap off"}
            </Button>
            <span className="max-w-xs text-xs leading-snug text-aura-text/55">
              Off by default, so the model reads as a house. On, it tints the solved room floors
              over the 3D view above — an analysis layer drawn through the massing, not a surface
              of it — and prints these assumptions on its legend.
            </span>
          </div>
        </div>
      </Panel>

      {/* --------------------------------------------------- nothing to show */}
      {!report.available ? (
        <Notice
          title="No rooms have been solved for this home yet"
          items={[
            report.blockedReason ??
              "The plan engine returned no room program, so there is nothing to set a target on.",
          ]}
          foot="Rooms come from the same deterministic plan engine the Drawings tab uses. This panel never invents a second notion of a room, so when that engine solves nothing, this page has nothing — which is the truthful answer, not a bug."
        />
      ) : null}

      {report.available ? (
        <>
          {/* ------------------------------------------------------ the KPIs */}
          <Panel
            label={`${SEASON_LABEL[season]} — how far off the whole home is`}
            hint={comfortSentence(report, season)}
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                k="Mean deviation"
                v={fmt2(kpi.meanAbsDeviation)}
                sub={`mean |sPMV| across ${kpi.roomsModelled} modelled room${kpi.roomsModelled === 1 ? "" : "s"}`}
              />
              <Stat
                k="Rooms meeting target"
                v={`${kpi.roomsMeeting} / ${kpi.roomsModelled}`}
                sub={`all three checks · ${kpi.roomsUnmodelled} unmodelled`}
              />
              <Stat
                k="Worst room"
                v={
                  report.rooms.find((r) => r.room.id === kpi.worstRoomId)?.room.name ?? "—"
                }
                sub={`|sPMV| ${fmt2(kpi.worstDeviation)}`}
              />
              <Stat
                k="Evaluated at"
                v={`${fmt1(assumedC)} °C · ${fmt0(assumedRh)} %`}
                sub="the assumptions above, not a measurement"
              />
            </div>
          </Panel>

          {/* ----------------------------------------------------- the table */}
          <Panel
            label={`Every solved room, at ${fmt1(assumedC)} °C and ${fmt0(assumedRh)} %RH`}
            hint={`The band shown is each room's stated ${SEASON_LABEL[season].toLowerCase()} target. "Meets" means the assumed temperature is inside that band, the assumed humidity is inside the room's humidity band, and the index is within ±${NEUTRAL_BAND} — all three, or it misses.`}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <thead>
                  <tr className="border-b aura-hairline">
                    <Th>Room</Th>
                    <Th>Use</Th>
                    <Th>Target band</Th>
                    <Th>Humidity band</Th>
                    <Th>Light</Th>
                    <Th>sPMV</Th>
                    <Th>Verdict</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.rooms.map((r) => {
                    const s = seasonResult(r, season);
                    const minC = season === "winter" ? r.target.winterMinC : r.target.summerMinC;
                    const maxC = season === "winter" ? r.target.winterMaxC : r.target.summerMaxC;
                    const on = selected?.room.id === r.room.id;
                    return (
                      <tr
                        key={r.room.id}
                        role="row"
                        tabIndex={0}
                        aria-selected={on}
                        onClick={() => setSelectedId(r.room.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedId(r.room.id);
                          }
                        }}
                        data-cursor="Select"
                        className={`cursor-pointer border-b aura-hairline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-aura-emerald ${
                          on ? "text-aura-text" : "text-aura-text/70 hover:text-aura-text"
                        }`}
                      >
                        <Td>
                          <span className={on ? "text-aura-emerald" : undefined}>{r.room.name}</span>
                          {!r.targetIsDefault ? (
                            <span className="ml-2 font-mono text-[0.55rem] uppercase tracking-label text-aura-teal">
                              edited
                            </span>
                          ) : null}
                        </Td>
                        <Td>
                          {SPACE_USE_LABEL[r.room.use]}
                          {!r.modelled ? (
                            <span className="ml-2 font-mono text-[0.55rem] uppercase tracking-label text-aura-violet">
                              unmodelled
                            </span>
                          ) : null}
                        </Td>
                        <Td tabular>
                          {fmt1(minC)}–{fmt1(maxC)} °C
                        </Td>
                        <Td tabular>
                          {fmt0(r.target.humidityMinPct)}–{fmt0(r.target.humidityMaxPct)} %
                        </Td>
                        <Td tabular>{fmt0(r.target.illuminanceMinLux)} lx</Td>
                        <Td tabular>
                          {fmtSigned(s.terms.value)}{" "}
                          <span className="text-aura-text/50">{sensationWord(s.terms.value)}</span>
                        </Td>
                        <Td>
                          <span
                            className={
                              s.meets === null
                                ? "text-aura-text/55"
                                : s.meets
                                  ? "text-aura-emerald"
                                  : "text-aura-violet"
                            }
                          >
                            {s.meets === null ? "unmodelled" : s.meets ? "meets" : "misses"}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-aura-text/55">
              Click a row to open its target and its arithmetic below. Room geometry comes from the
              plan engine&rsquo;s solved envelope — the same rectangle the Drawings tab prints the
              full account of — so a room here is a room in that solve, not a measured part of your
              volumes.
            </p>
          </Panel>

          {/* -------------------------------------- the selected room, in full */}
          {selected ? (
            <RoomDetail
              room={selected}
              season={season}
              onSet={(patch) => setTarget(selected.room.id, selected.target, patch)}
              onClear={() => clearTarget(selected.room.id)}
            />
          ) : null}
        </>
      ) : null}

      {/* ---------------------------------------------------------- method */}
      <Panel
        label="The method, and what it cannot tell you"
        hint="Read this before quoting a number off this page."
      >
        <div className="space-y-4 text-xs leading-relaxed text-aura-text/65">
          <p>{SPMV_METHOD_NOTE}</p>
          <p>{VAPOUR_UNIT_NOTE}</p>
          <p>{TARGET_PROVENANCE}</p>
          <p>
            <span className="text-aura-text/80">The resting case is not modelled.</span> The
            coefficients above are the living/active set. A sleeping room needs its own set — a
            lower metabolic rate and a duvet rather than clothing — and no verified second set was
            available to this build. Rather than invent one, bedrooms are evaluated with the SAME
            coefficients and flagged &ldquo;unmodelled&rdquo; in the table. Their target band is
            still theirs; only the index is the awake, clothed answer.
          </p>
          <p>
            <span className="text-aura-text/80">What travels into the files.</span> The targets and
            the assumptions are written into the ifcJSON and the IFC4 exports as one{" "}
            <span className="font-mono">IfcSpace</span> per solved room carrying{" "}
            <span className="font-mono">Pset_SpaceThermalRequirements</span>,{" "}
            <span className="font-mono">Pset_SpaceLightingRequirements</span> and Aura&rsquo;s own
            evaluation set. Those spaces carry NO geometry on purpose: the plan engine solves one
            rectangle sized from your floor area, not your volumes, so placing a solved room inside
            a modelled mass would be a coordinate this tool has not earned.
          </p>
          <p>
            <span className="text-aura-text/80">What the export buttons write.</span>{" "}
            {editedTargets > 0
              ? `Your figures. You have edited ${editedTargets} room target${editedTargets === 1 ? "" : "s"}, and those — with the four assumptions above — are what the IFC and the ifcJSON carry. This is the one thing on this page that is NOT like the partitions, finishes and fixtures: those three cannot reach the professional exports because the exports are generated from the HomeSpec and the spec has no field for them, whereas the comfort report is handed to the two writers directly.`
              : "The IFC and the ifcJSON carry whatever is on this page — these defaults now, your figures the moment you change one. The DXF and the drawing set carry none of it: they are 2D documents with nowhere to put a target."}{" "}
            A saved design, a share link and the .json sidecar do NOT carry comfort, because all
            three are a HomeSpec and the spec has no comfort field. Reopening a design puts these
            defaults back.
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ========================================================== the room detail */

function RoomDetail({
  room,
  season,
  onSet,
  onClear,
}: {
  room: RoomComfort;
  season: Season;
  onSet: (patch: Partial<ComfortTarget>) => void;
  onClear: () => void;
}) {
  const s = seasonResult(room, season);
  const t = room.target;
  const fallback = DEFAULT_TARGETS[room.room.use];

  return (
    <Panel
      label={`${room.room.name} — the target, and the arithmetic behind its index`}
      hint={`${SPACE_USE_LABEL[room.room.use]} · ${fmt0(room.room.areaSqFt)} sq ft · ${room.room.windows} window${room.room.windows === 1 ? "" : "s"} in the solve`}
      right={
        !room.targetIsDefault ? (
          <Button onClick={onClear} title="Drop this room's edit and use the default for its use">
            Back to the {SPACE_USE_LABEL[room.room.use].toLowerCase()} default
          </Button>
        ) : null
      }
    >
      {/* ------------------------------------------------ the worked example */}
      <div className="rounded-md border aura-hairline p-4">
        <p className="aura-label">
          sPMV at the assumed {fmt1(s.tempC)} °C and {fmt0(s.rhPct)} %RH
        </p>
        <ul className="mt-3 space-y-1 font-mono text-xs leading-relaxed text-aura-text/70">
          <li>
            es(T) = 0.61078 · exp(17.27 × {fmt1(s.tempC)} / ({fmt1(s.tempC)} + 237.3)) ={" "}
            {fmt4(s.terms.saturationKPa)} kPa
          </li>
          <li>
            Pv = {fmt0(s.rhPct)} / 100 × {fmt4(s.terms.saturationKPa)} = {fmt4(s.terms.vapourKPa)} kPa
          </li>
          <li>
            a·T = 0.2803 × {fmt1(s.tempC)} = {fmt4(s.terms.tempTerm)}
          </li>
          <li>
            b·Pv = 0.1717 × {fmt4(s.terms.vapourKPa)} = {fmt4(s.terms.vapourTerm)}
          </li>
          <li>− c = −{fmt4(s.terms.constantTerm)}</li>
          <li className="text-aura-text">
            sPMV = {fmt4(s.terms.value)} → {fmtSigned(s.terms.value)} ({sensationWord(s.terms.value)}
            )
          </li>
        </ul>
        <p
          className={`mt-3 text-xs leading-relaxed ${
            s.meets === null
              ? "text-aura-text/60"
              : s.meets
                ? "text-aura-emerald"
                : "text-aura-violet"
          }`}
        >
          {s.meets === null
            ? `No sleeping/resting verdict is claimed for this room. The displayed arithmetic uses the living/active coefficient set only.`
            : s.meets
            ? `Under these assumed conditions, this room meets its stated ${SEASON_LABEL[season].toLowerCase()} target.`
            : s.misses.join(" ")}
        </p>
        {room.modelNote ? (
          <p className="mt-2 text-xs leading-relaxed text-aura-text/55">{room.modelNote}</p>
        ) : null}
      </div>

      {/* --------------------------------------------------- the seven fields */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Slider
          label="Winter minimum"
          value={t.winterMinC}
          min={10}
          max={t.winterMaxC}
          step={0.5}
          onChange={(v) => onSet({ winterMinC: v })}
          display={(v) => `${fmt1(v)} °C`}
        />
        <Slider
          label="Winter maximum"
          value={t.winterMaxC}
          min={t.winterMinC}
          max={30}
          step={0.5}
          onChange={(v) => onSet({ winterMaxC: v })}
          display={(v) => `${fmt1(v)} °C`}
        />
        <Slider
          label="Summer minimum"
          value={t.summerMinC}
          min={10}
          max={t.summerMaxC}
          step={0.5}
          onChange={(v) => onSet({ summerMinC: v })}
          display={(v) => `${fmt1(v)} °C`}
        />
        <Slider
          label="Summer maximum"
          value={t.summerMaxC}
          min={t.summerMinC}
          max={35}
          step={0.5}
          onChange={(v) => onSet({ summerMaxC: v })}
          display={(v) => `${fmt1(v)} °C`}
        />
        <Slider
          label="Relative humidity, minimum"
          value={t.humidityMinPct}
          min={10}
          max={t.humidityMaxPct}
          step={1}
          onChange={(v) => onSet({ humidityMinPct: v })}
          display={(v) => `${fmt0(v)} %`}
        />
        <Slider
          label="Relative humidity, maximum"
          value={t.humidityMaxPct}
          min={t.humidityMinPct}
          max={80}
          step={1}
          onChange={(v) => onSet({ humidityMaxPct: v })}
          display={(v) => `${fmt0(v)} %`}
        />
        <Slider
          label="Minimum illuminance"
          value={t.illuminanceMinLux}
          min={50}
          max={750}
          step={25}
          onChange={(v) => onSet({ illuminanceMinLux: v })}
          display={(v) => `${fmt0(v)} lx`}
          hint="Maintained illuminance on the working plane. Carried into the export as Pset_SpaceLightingRequirements.Illuminance and never evaluated here — this tool models no daylight and no luminaires, so it can state the target and nothing more."
        />
      </div>

      <p className="mt-5 border-t aura-hairline pt-4 text-xs leading-relaxed text-aura-text/55">
        {room.targetIsDefault
          ? `These are the indicative ${SPACE_USE_LABEL[room.room.use].toLowerCase()} defaults — ${fmt1(fallback.winterMinC)}–${fmt1(fallback.winterMaxC)} °C in winter, ${fmt1(fallback.summerMinC)}–${fmt1(fallback.summerMaxC)} °C in summer. Move any slider and this room keeps your figures instead.`
          : "This room carries your figures rather than the default for its use."}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------ table atoms */

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="py-2 pr-4 font-mono text-[0.6rem] font-normal uppercase tracking-label text-aura-text/55">
      {children}
    </th>
  );
}

function Td({ children, tabular }: { children: ReactNode; tabular?: boolean }) {
  return (
    <td className={`py-2.5 pr-4 text-xs leading-relaxed ${tabular ? "tabular-nums" : ""}`}>
      {children}
    </td>
  );
}
