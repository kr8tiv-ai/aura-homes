import type { ReactNode } from "react";
import Link from "next/link";
import RevealWords from "@/components/RevealWords";
import { Reveal, Stagger, StaggerItem, GrowBar, Counter } from "@/components/Reveal";

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
    /* Replaces "Is there a token?" (removed Aug 10, 2026). The old answer
       named HOMES and said it would launch — which is a promise no matter how
       carefully the utility is hedged, and there is no token. The question
       still gets asked, so it still gets answered; it is just answered with
       what is true today rather than with a roadmap item. */
    q: "How does Aura make money?",
    a: "Today it does not — nothing on this site charges anyone anything, and there is no fee in the escrow contract. The likely shape is small transaction fees or membership levels, decided once the product is in real use rather than guessed at now. What is already ruled out is taking a large cut of your build: the budget shown here is the budget, and every line of it goes to land, materials, trades, and permits. There is no token.",
  },
  {
    q: "Where does it start?",
    a: "Alberta, county by county — the pilot data covers Lac Ste. Anne and Leduc first, because bare land within an hour of Edmonton is real and the bylaw tables are verified. The Locality Hub rolls out the same way: one locality at a time, sourced locally.",
  },
] as const;

/* ---------------------------------------------------------------------
   The money in these answers is the reason people read the page, so the
   figures count up when the card arrives instead of sitting there printed.

   This is a RENDERING pass only — the answer strings above are untouched
   and every character still ships to crawlers and no-JS readers, because
   <Counter> server-renders its final value. Two rules keep it honest:
   · Only sums of $1,000 and up animate. Watching "$95" tick is a gimmick.
   · The interim frames are padded with FIGURE SPACES (U+2007, one digit
     wide) to the final string's length, so the paragraph never reflows
     while the number climbs — a sentence rewrapping itself for a second
     reads as a bug, which is exactly what a money page cannot afford.
--------------------------------------------------------------------- */
const MONEY = /\$(\d{1,3}(?:,\d{3})*)/g;
const FIGURE_SPACE = " "; // exactly one digit wide, and HTML does not collapse it

function withCountingFigures(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(MONEY.source, "g");
  let cursor = 0;
  let key = 0;

  for (let hit = re.exec(text); hit !== null; hit = re.exec(text)) {
    const n = Number(hit[1].replace(/,/g, ""));
    if (n < 1000) continue;
    if (hit.index > cursor) out.push(text.slice(cursor, hit.index));
    const settled = n.toLocaleString("en-CA");
    out.push(
      <Counter
        key={`fig-${key++}`}
        value={n}
        prefix="$"
        className="whitespace-nowrap font-medium tabular-nums text-aura-text"
        /* padTo, NOT a format closure. This page is a server component, and a
           function prop cannot cross into a client component — React throws
           while serializing it into the RSC payload. The inline closure that
           used to be here is what broke the static export. */
        padTo={settled.length}
      />,
    );
    cursor = hit.index + hit[0].length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export const metadata = {
  title: "FAQ — Aura Homes",
  description:
    "Plain answers: the card-first onboarding design, no architect needed, honest costs, the AWG winter truth, resale rules, and how Aura makes money.",
};

export default function FaqPage() {
  return (
    <div className="py-24">
      <Reveal y={10}>
        <p className="aura-label mb-6">Questions, answered plainly</p>
      </Reveal>
      <RevealWords text="FAQ" className="max-w-3xl text-5xl font-semibold leading-tight md:text-6xl" />
      <Reveal delay={0.12}>
        <p className="mt-6 max-w-xl text-lg text-aura-text/70">
          The eight questions people ask first — with the catches stated up front.
        </p>
      </Reveal>

      <Stagger className="mt-16 grid gap-6 md:grid-cols-2">
        {faqs.map((f, i) => (
          <StaggerItem key={f.q} className="h-full">
            <article className="aura-panel aura-panel-lift h-full p-8">
              {/* a div, not a p: GrowBar renders a div and a div inside a
                  paragraph is invalid nesting React will complain about */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-aura-violet">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <GrowBar pct={100} delay={0.12} className="h-px flex-1 bg-aura-ink/15" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{f.q}</h2>
              <p className="mt-3 text-sm leading-relaxed text-aura-text/75">
                {withCountingFigures(f.a)}
              </p>
              {"link" in f && f.link ? (
                <p className="mt-3 text-sm">
                  <a
                    href={f.link.href}
                    target="_blank"
                    rel="noreferrer"
                    data-cursor="Star"
                    className="text-aura-emerald underline underline-offset-4"
                  >
                    {f.link.label}
                  </a>
                </p>
              ) : null}
            </article>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal className="mt-16">
        <p className="text-sm text-aura-text/75">
          Longer answers live in the{" "}
          <a
            href={`${REPO}#16--faq`}
            target="_blank"
            rel="noreferrer"
            data-cursor="Read"
            className="text-aura-emerald underline underline-offset-4"
          >
            README FAQ
          </a>
          {" "}— or start from{" "}
          <Link
            href="/overview"
            data-cursor="Open"
            className="text-aura-emerald underline underline-offset-4"
          >
            the overview
          </Link>
          .
        </p>
      </Reveal>
    </div>
  );
}
