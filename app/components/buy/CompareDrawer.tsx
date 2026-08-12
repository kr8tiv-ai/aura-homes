"use client";

/* Compare up to three homes, field against field. In-flow rather than
   fixed so it never fights mobile safe areas; the table scrolls inside
   its own container so the page body never gains a horizontal scrollbar. */

import {
  COMPARE_LIMIT,
  CONSTRUCTION_LABELS,
  bedroomsLine,
  deliverySummary,
  priceLine,
  sizeLine,
  type FinishedHomeModel,
} from "@/lib/marketplace/homeModels";

const ROWS: Array<{ label: string; value: (home: FinishedHomeModel) => string }> = [
  { label: "Maker", value: (home) => `${home.maker} · ${home.makerCountry}` },
  { label: "Price", value: priceLine },
  { label: "Delivery", value: deliverySummary },
  { label: "Size", value: sizeLine },
  { label: "Bedrooms", value: bedroomsLine },
  { label: "Construction", value: (home) => CONSTRUCTION_LABELS[home.constructionType] },
  { label: "Customization", value: (home) => home.customization },
];

export default function CompareDrawer({
  homes,
  onRemove,
  onClear,
}: {
  homes: FinishedHomeModel[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (homes.length === 0) return null;
  return (
    <section aria-label="Home comparison" className="aura-panel mt-10 p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="aura-label">Compare</p>
          <h2 className="mt-1 font-display text-lg font-medium">
            {homes.length} of {COMPARE_LIMIT} homes
          </h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          data-cursor="Clear"
          className="min-h-11 rounded-full border aura-hairline px-4 py-2 font-mono text-[0.65rem] uppercase tracking-label text-aura-text/75 transition-colors hover:border-aura-emerald"
        >
          Clear comparison
        </button>
      </div>

      {homes.length === 1 ? (
        <p className="mt-4 text-xs leading-relaxed text-aura-dim">
          Add a second home to compare side by side. Up to {COMPARE_LIMIT} fit here.
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
          <thead>
            <tr>
              <th scope="col" className="w-32 pb-3 pr-4 align-bottom font-mono text-[0.6rem] uppercase tracking-label text-aura-dim">
                Field
              </th>
              {homes.map((home) => (
                <th key={home.id} scope="col" className="pb-3 pr-4 align-bottom">
                  <p className="font-display text-sm font-medium leading-snug">{home.model}</p>
                  <button
                    type="button"
                    onClick={() => onRemove(home.id)}
                    data-cursor="Remove"
                    className="mt-1 font-mono text-[0.6rem] uppercase tracking-label text-aura-dim underline underline-offset-4 hover:text-aura-emerald"
                  >
                    Remove
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t aura-hairline align-top">
                <th scope="row" className="py-3 pr-4 font-mono text-[0.6rem] uppercase tracking-label text-aura-dim">
                  {row.label}
                </th>
                {homes.map((home) => (
                  <td key={home.id} className="py-3 pr-4 leading-relaxed text-aura-text/80">
                    {row.value(home)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
