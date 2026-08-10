"use client";

/* WHAT AN AURA HOME INCLUDES — the eco spec, on screen and in the payload.

   These are not garnish and they are not preferences: the founder mandate is
   that every generated home reads as a true Aura eco-home. The standard rows
   are checked, locked, and labelled STANDARD; the four below them are real
   choices. Everything visible here is compiled into DesignRequest.notes and
   shown verbatim at the bottom of the panel, so the reader can see the exact
   string the service receives instead of taking the claim on faith. */

import { CheckRow, Field, TextArea } from "@/components/design/Controls";
import {
  ECO_OPTIONS,
  ECO_STANDARD,
  MATERIALS,
  NOTES_MAX,
  materialLabel,
  materialWallMm,
  type ComposedNotes,
} from "@/components/design/ecoSpec";
import type { EcoMaterial } from "@/lib/designApi";
import { Stagger, StaggerItem } from "@/components/Reveal";

export default function EcoChecklist({
  material,
  chosen,
  onToggle,
  ownerText,
  onOwnerText,
  composed,
}: {
  material: EcoMaterial;
  chosen: readonly string[];
  onToggle: (id: string, on: boolean) => void;
  ownerText: string;
  onOwnerText: (v: string) => void;
  composed: ComposedNotes;
}) {
  const structural = MATERIALS.find((m) => m.id === material);

  return (
    <div className="aura-panel p-8">
      <p className="aura-label">What every Aura home includes</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-aura-text/75">
        The rows marked <span className="text-aura-emerald">standard</span> are on every home and
        cannot be switched off — they are what makes the result an Aura eco-home rather than a
        generic house. They travel to the service in the design brief below.
      </p>

      <Stagger className="mt-6 grid gap-3 md:grid-cols-2" gap={0.04}>
        <StaggerItem key="structure" y={8}>
          <CheckRow
            locked
            checked
            label={`${structural?.label ?? materialLabel(material)} envelope`}
            detail={`Structure follows the material you chose above — ${materialWallMm(
              material
            )} mm walls, drawn at that thickness. SIP, CLT, timber frame or rammed earth; all four are cement-free.`}
          />
        </StaggerItem>
        {ECO_STANDARD.map((item) => (
          <StaggerItem key={item.id} y={8}>
            <CheckRow locked checked label={item.label} detail={item.detail} />
          </StaggerItem>
        ))}
      </Stagger>

      <p className="aura-label mt-8">Options — real choices</p>
      <Stagger className="mt-3 grid gap-3 md:grid-cols-2" gap={0.04}>
        {ECO_OPTIONS.map((item) => (
          <StaggerItem key={item.id} y={8}>
            <CheckRow
              label={item.label}
              detail={item.detail}
              checked={chosen.includes(item.id)}
              onChange={(v) => onToggle(item.id, v)}
            />
          </StaggerItem>
        ))}
      </Stagger>

      <div className="mt-8">
        <Field
          label="Anything else (notes)"
          hint="Free text, appended after the standard spec. The service caps the whole brief at 500 characters and the eco spec is reserved first."
        >
          <TextArea
            value={ownerText}
            onChange={onOwnerText}
            placeholder="South-facing great room, mudroom off the north entry, workshop bay…"
          />
        </Field>
      </div>

      {/* The receipt: the exact `notes` string the POST carries. */}
      <div className="mt-6 rounded-md border aura-hairline p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="aura-label">Design brief sent as notes</p>
          <p className="font-mono text-xs tabular-nums text-aura-text/60">
            {composed.notes.length} / {NOTES_MAX} characters
          </p>
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-aura-text/80">
          {composed.notes}
        </p>
        {composed.dropped > 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-aura-violet">
            {composed.dropped} character{composed.dropped === 1 ? "" : "s"} of your own notes will
            not fit the service&rsquo;s 500-character brief and are not being sent. The eco spec is
            reserved first — trimming &ldquo;no concrete&rdquo; to make room for a sentence would be
            the wrong trade.
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-relaxed text-aura-text/60">
          This string is the only channel from the questionnaire into the reasoning prompt: the
          service reads it as the brief and writes the render prompts from it. When no LLM
          credential is configured the render prompts come from the material and style vocabulary
          instead, and the response says so.
        </p>
      </div>
    </div>
  );
}
