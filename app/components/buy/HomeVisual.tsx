/* The labelled illustrative visual.

   No maker in the research record offers a rights-safe product photo, and
   the static export forbids hotlinking, so every card carries an Aura
   drawing instead — line art in the tonal ladder, clearly labelled as
   illustrative. Three variants, one per construction type, so a reader can
   tell homes apart at a glance without ever mistaking the drawing for the
   product. */

import type { FinishedHomeModel } from "@/lib/marketplace/homeModels";

function SteelKit() {
  return (
    <svg viewBox="0 0 400 224" role="presentation" aria-hidden className="h-full w-full">
      {/* ground line */}
      <line x1="24" y1="188" x2="376" y2="188" className="stroke-aura-ink/25" strokeWidth="1.5" />
      {/* gable shell */}
      <path
        d="M70 188 V104 L200 46 L330 104 V188 Z"
        className="fill-aura-emerald-bright/10 stroke-aura-ink/55"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* roof ridge highlight */}
      <path d="M70 104 L200 46 L330 104" fill="none" className="stroke-aura-emerald" strokeWidth="2.5" strokeLinejoin="round" />
      {/* vertical ribs of the pre-engineered frame */}
      {[104, 138, 172, 228, 262, 296].map((x) => (
        <line key={x} x1={x} y1={x < 200 ? 104 - (x - 70) * 0.2 : 104 - (330 - x) * 0.2} x2={x} y2="188" className="stroke-aura-ink/30" strokeWidth="1.5" />
      ))}
      {/* door bay */}
      <rect x="186" y="128" width="28" height="60" className="fill-aura-sunken stroke-aura-ink/45" strokeWidth="1.5" />
    </svg>
  );
}

function FoldingModular() {
  return (
    <svg viewBox="0 0 400 224" role="presentation" aria-hidden className="h-full w-full">
      <line x1="24" y1="188" x2="376" y2="188" className="stroke-aura-ink/25" strokeWidth="1.5" />
      {/* the unfolded box */}
      <rect x="96" y="84" width="208" height="104" className="fill-aura-emerald-bright/10 stroke-aura-ink/55" strokeWidth="2" />
      {/* flat roof cap */}
      <line x1="88" y1="84" x2="312" y2="84" className="stroke-aura-emerald" strokeWidth="2.5" />
      {/* fold hinge lines */}
      <line x1="148" y1="84" x2="148" y2="188" className="stroke-aura-ink/30" strokeWidth="1.5" strokeDasharray="5 5" />
      <line x1="252" y1="84" x2="252" y2="188" className="stroke-aura-ink/30" strokeWidth="1.5" strokeDasharray="5 5" />
      {/* glazed wall between the folds */}
      <rect x="160" y="100" width="80" height="88" className="fill-aura-sunken stroke-aura-ink/45" strokeWidth="1.5" />
      <line x1="200" y1="100" x2="200" y2="188" className="stroke-aura-ink/30" strokeWidth="1" />
      {/* fold arcs hinting at the folding mechanism */}
      <path d="M148 84 A 44 44 0 0 1 104 128" fill="none" className="stroke-aura-teal-mark/60" strokeWidth="1.5" strokeDasharray="3 5" />
      <path d="M252 84 A 44 44 0 0 0 296 128" fill="none" className="stroke-aura-teal-mark/60" strokeWidth="1.5" strokeDasharray="3 5" />
    </svg>
  );
}

function PrintedEarth() {
  return (
    <svg viewBox="0 0 400 224" role="presentation" aria-hidden className="h-full w-full">
      <line x1="24" y1="188" x2="376" y2="188" className="stroke-aura-ink/25" strokeWidth="1.5" />
      {/* the curved printed shell */}
      <path
        d="M84 188 C84 96 140 60 200 60 C260 60 316 96 316 188 Z"
        className="fill-aura-emerald-bright/10 stroke-aura-ink/55"
        strokeWidth="2"
      />
      {/* print layers — the machine's signature */}
      {[172, 156, 140, 124, 108, 92].map((y, index) => {
        const inset = 8 + index * 9;
        return (
          <path
            key={y}
            d={`M${84 + inset} ${y + 16} C${84 + inset} ${y - 10} ${200 - inset / 2} ${y - 24} 200 ${y - 24}`}
            fill="none"
            className="stroke-aura-ink/25"
            strokeWidth="1.2"
          />
        );
      })}
      <path d="M84 188 C84 96 140 60 200 60" fill="none" className="stroke-aura-emerald" strokeWidth="2.5" />
      {/* rounded doorway */}
      <path d="M182 188 V148 A18 18 0 0 1 218 148 V188 Z" className="fill-aura-sunken stroke-aura-ink/45" strokeWidth="1.5" />
    </svg>
  );
}

const VARIANTS = {
  "steel-kit": SteelKit,
  "folding-modular": FoldingModular,
  "printed-earth": PrintedEarth,
} as const;

export default function HomeVisual({ home }: { home: FinishedHomeModel }) {
  const Variant = VARIANTS[home.visual.variant];
  return (
    <figure
      className="relative overflow-hidden rounded-lg bg-aura-sunken"
      aria-label={`Illustrative drawing of ${home.model} by ${home.maker}. Not a product photo.`}
    >
      <div className="aspect-[16/9]">
        <Variant />
      </div>
      <figcaption className="absolute bottom-2 left-2 rounded-full bg-aura-panel/90 px-2.5 py-1 font-mono text-[0.55rem] uppercase tracking-label text-aura-dim">
        {home.visual.label}
      </figcaption>
    </figure>
  );
}
