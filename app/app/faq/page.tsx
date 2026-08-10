import Link from "next/link";

/* The FAQ, trimmed from README section 16 to the eight questions people
   actually ask first. Same voice as the rest of the house: plain answers,
   honest catches stated up front, no exclamation marks. Each entry is an
   aura-panel so the hover glow and border tracer apply here too. */

const REPO = "https://github.com/kr8tiv-ai/aura-homes";

const faqs = [
  {
    q: "Do I need to own crypto?",
    a: "Eventually, no — the designed onboarding path is card-first: pay by Visa or Mastercard, an on-ramp partner converts to USDC in-flow, and you see prices in CAD throughout. That integration is pending, not live; the current build assumes USDC you already hold. Even after cards land, bringing your own USDC stays faster and cheaper.",
  },
  {
    q: "Do I need an architect?",
    a: "No. Alberta's Architects Act exempts 1–4 unit dwellings of any size; a residential designer ($1,200–$2,700) finishes the AI's review-ready package into the permit set, and truss engineering arrives stamped from the truss plant.",
  },
  {
    q: "Can the AWG supply my water?",
    a: "In summer, yes — every Aura home ships the atmospheric water module as the honestly-labeled summer producer, roughly 10–20 L a day from June to September. Outdoor winter output is zero litres (physics: condenser cutoff near 15°C and 30% humidity), so a buried cistern or a drilled well carries the winter, always.",
  },
  {
    q: "What does it cost, honestly?",
    a: "$199,100 / $301,280 / $443,900 — LOW, MID, and HIGH, ex-land, in CAD, computed line by line from the open Alberta cost model. Land adds $75,000–$350,000. A conventional builder delivers the same home at $450,000–$650,000 ex-land.",
  },
  {
    q: "Can I sell the house afterward?",
    a: "The honest catch: the $750 warranty opt-out places a title caveat blocking sale for 10 years. If resale flexibility matters, take the $95 owner-builder path with a home warranty instead. The app makes you choose eyes-open.",
  },
  {
    q: "Is it open source?",
    a: "Yes — MIT, end to end, from the first commit. The repo publishes the whole truth, including what does not work yet.",
    link: { href: REPO, label: "Star the repo on GitHub" },
  },
  {
    q: "Is there a token?",
    a: "It has a name: HOMES, and it will launch on X Layer as part of the phased rollout. Its utility is deliberately undecided and will be announced as a phase of its own — and nothing launches before Canadian securities counsel. There is no token in the hackathon build.",
  },
  {
    q: "Where does it start?",
    a: "Alberta, county by county — the pilot data covers Lac Ste. Anne and Leduc first, because bare land within an hour of Edmonton is real and the bylaw tables are verified. The Locality Hub rolls out the same way: one locality at a time, sourced locally.",
  },
] as const;

export const metadata = {
  title: "FAQ — Aura Homes",
  description:
    "Plain answers: the card-first onboarding design, no architect needed, honest costs, the AWG winter truth, resale rules, and the HOMES token.",
};

export default function FaqPage() {
  return (
    <div className="py-24">
      <p className="aura-label mb-6">Questions, answered plainly</p>
      <h1 className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">FAQ</h1>
      <p className="mt-6 max-w-xl text-lg text-aura-text/70">
        The eight questions people ask first — with the catches stated up front.
      </p>

      <div className="mt-16 grid gap-6 md:grid-cols-2">
        {faqs.map((f, i) => (
          <article key={f.q} className="aura-panel p-8">
            <p className="flex items-center gap-3">
              <span className="font-mono text-xs text-aura-violet">
                {String(i + 1).padStart(2, "0")}
              </span>
              <i className="h-px flex-1 bg-[rgba(23,26,24,0.12)]" aria-hidden />
            </p>
            <h2 className="mt-4 text-lg font-semibold">{f.q}</h2>
            <p className="mt-3 text-sm leading-relaxed text-aura-text/75">{f.a}</p>
            {"link" in f && f.link ? (
              <p className="mt-3 text-sm">
                <a
                  href={f.link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-aura-emerald underline underline-offset-4"
                >
                  {f.link.label}
                </a>
              </p>
            ) : null}
          </article>
        ))}
      </div>

      <p className="mt-16 text-sm text-aura-text/75">
        Longer answers live in the{" "}
        <a
          href={`${REPO}#16--faq`}
          target="_blank"
          rel="noreferrer"
          className="text-aura-emerald underline underline-offset-4"
        >
          README FAQ
        </a>
        {" "}— or start from{" "}
        <Link href="/overview" className="text-aura-emerald underline underline-offset-4">
          the overview
        </Link>
        .
      </p>
    </div>
  );
}
