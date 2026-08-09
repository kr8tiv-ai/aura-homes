import { budgetFixture } from "@/lib/fixtures";

const cad = (n: number) => `$${n.toLocaleString("en-CA")}`;

export default function BudgetPage() {
  const { lines, total } = budgetFixture;
  return (
    <div className="py-16">
      <p className="aura-label mb-4">Alberta cost model</p>
      <h1 className="font-display text-[2.35rem] font-medium leading-[1.08] tracking-[-0.025em]">Build budget</h1>
      <p className="mt-4 max-w-xl text-[0.95rem] leading-[1.65] text-aura-text/75">
        Researched LOW / MID / HIGH ranges in CAD, excluding land. Every line has an
        in-province supply path.
      </p>

      <div className="aura-panel mt-10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b aura-hairline text-left">
              <th className="aura-label px-6 py-4 font-normal">Category</th>
              <th className="aura-label px-6 py-4 font-normal">Line item</th>
              <th className="aura-label px-6 py-4 text-right font-normal">Low</th>
              <th className="aura-label px-6 py-4 text-right font-normal">Mid</th>
              <th className="aura-label px-6 py-4 text-right font-normal">High</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b aura-hairline last:border-b-0">
                <td className="px-6 py-4 text-aura-teal">{line.category}</td>
                <td className="px-6 py-4 text-aura-text/80">{line.item}</td>
                <td className="px-6 py-4 text-right tabular-nums">{cad(line.lowCad)}</td>
                <td className="px-6 py-4 text-right tabular-nums text-aura-text">
                  {cad(line.midCad)}
                </td>
                <td className="px-6 py-4 text-right tabular-nums">{cad(line.highCad)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t aura-hairline">
              <td className="px-6 py-5" colSpan={2}>
                <span className="aura-label">Total (excl. land)</span>
              </td>
              <td className="px-6 py-5 text-right font-semibold tabular-nums">
                {cad(total.lowCad)}
              </td>
              <td className="px-6 py-5 text-right font-semibold tabular-nums text-aura-lime">
                {cad(total.midCad)}
              </td>
              <td className="px-6 py-5 text-right font-semibold tabular-nums">
                {cad(total.highCad)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
