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
    a: "No. Aura is designed to support ordinary card payments through Stripe as providers are connected, alongside X Layer USDC where a seller or contractor accepts it. Those payment integrations are planned, not live. Every payment screen will show the available methods, price, fees and recipient before you confirm anything.",
  },
  {
    q: "Do I need an architect?",
    a: "Requirements vary by project and jurisdiction. Aura produces design intent, not a permit set. A residential designer, architect, engineer, energy advisor, or other qualified professional may be required to review and complete the work; confirm the team with the local authority before relying on a drawing.",
  },
  {
    q: "Can the AWG supply my water?",
    a: "An atmospheric water generator can be modelled as a summer-only option in Aura's Alberta reference concept, but it is not a dependable year-round source. Aura does not sell or ship an AWG. A qualified local designer must size and approve the actual water system; winter planning should rely on a confirmed well, cistern, or municipal supply.",
  },
  {
    q: "What does it cost, honestly?",
    a: "The current 800 sq ft Alberta reference scenario computes to $199,100 / $301,280 / $443,900 CAD at LOW / MID / HIGH, excluding land. That is a dated planning model, not a supplier or contractor quote. Your design, parcel, utilities, delivery method, permits, tax, professional services, and contingency can change it materially.",
  },
  {
    q: "Can I sell the house afterward?",
    a: "Possibly, but resale, warranty, disclosure, title, financing, and occupancy rules depend on the project and jurisdiction. Aura does not determine resale eligibility or place anything on title. Confirm the intended owner-builder or warranty path with the applicable authority and qualified legal professionals before construction.",
  },
  {
    q: "Is it open source?",
    a: "Aura's software is MIT-licensed. Individual plan studies retain the open-source or public-domain terms listed with each plan, including attribution and ShareAlike where applicable. The repository publishes those boundaries and what does not work yet.",
    link: { href: REPO, label: "Star the repo on GitHub" },
  },
  {
    id: "x-layer",
    q: "What is X Layer?",
    a: "X Layer is the EVM-compatible Layer 2 in the OKX ecosystem. Aura plans to use it for provider-supported USDC payments, public HOMES records and verifiable project artifacts. The normal design and project tools do not require X Layer or a wallet. Aura's own contract work is testnet-only and has no monetary value; the HOMES token, launched through the third-party XLaunch venue, lives on X Layer mainnet, and mainnet settlement for Aura's payment tools is not live.",
    link: { href: "https://web3.okx.com/xlayer", label: "Read the official X Layer overview" },
  },
  {
    id: "okx-buildx",
    q: "What are OKX and the Build X AI Season?",
    a: "OKX is the ecosystem behind X Layer, its wallet and developer program. Aura Homes is an independent entry in the August 7–21, 2026 Build X AI Season, combining the eco-home project workspace with optional X Layer payments, verifiable project artifacts and the planned HOMES property ledger. Participation is not an OKX endorsement, and OKX account availability varies by region.",
    link: { href: "https://web3.okx.com/xlayer/build-x-series", label: "Open the official Build X page" },
  },
  {
    id: "homes-token",
    q: "What is the HOMES token?",
    a: "HOMES is a live X Layer token — launched on the XLaunch venue at contract 0x642855d557ada1eba8a66014aaff902e6394c0de — paired with a public property ledger that is still mostly a declared zero state. The proposed model routes 60 percent of recognized platform and venue fees to a first-property fund, targeting 200,000 USDC before an Alberta or Costa Rica acquisition. No exchange listing, fund balance, property, staking position, or payout exists today; venue trading fees accrue but are counted only after claim receipts are published.",
    link: { href: "/homes", label: "Open the HOMES ledger" },
  },
  {
    q: "How would Aura fees flow into HOMES?",
    a: "Aura keeps token supply and revenue separate. Proposed trading-fee revenue is split 60 percent property fund, 10 percent marketing, 10 percent operations, 10 percent development, 5 percent burn reserve, and 5 percent protocol-owned liquidity. Service, API, marketplace, and disclosed AI-routing margins use the operating split: 60 percent property fund and 10 percent each to marketing, operations, development, and maintenance. A source stays planned until its agreement, cost basis, receipts, and allocation are verifiable.",
  },
  {
    q: "How is the HOMES token supply allocated?",
    a: "The design reserves 30 percent for labeled team vesting wallets, 10 percent for marketing, 10 percent for approved exchange-listing requirements, 20 percent for protocol-owned liquidity, and 30 percent for public market distribution. These percentages describe intended token inventory, not fee revenue — and not yet the live mint: the token was minted by XLaunch's factory, and its actual on-chain distribution is being verified before any design number is presented as the live one. Any unused listing allocation must remain visible rather than silently becoming team supply.",
  },
  {
    q: "How would HOMES payouts work?",
    a: "After a property is operating, Aura would publish gross rent, every operating expense, reserves, and net property profit. The proposed community share is 60 percent of that net profit. A declared X Layer block would select the top 200 staked HOMES addresses, and the community pool would be paid pro rata by stake in X Layer USDC. Snapshot block, cutoff, calculation, payout hashes, and unclaimed amounts all belong in the public ledger. Staking is a later phase, not live.",
  },
  {
    q: "What happens if the first-property program does not proceed?",
    a: "Before fundraising, Aura would publish an immutable funding deadline, minimum viable target, cancellation process, excluded system addresses, and claim rules. If the deadline expires below the target or the program is formally cancelled, the unspent trading-fee balance earmarked for property purchases would be reconciled and divided pro rata among the top 50 eligible community holders at a declared X Layer snapshot. Team, treasury, liquidity, exchange, and contract addresses are excluded. This wind-down mechanism is a design only and is not configured today.",
  },
  {
    q: "What is the decentralized property trust?",
    a: "The intended structure separates registered land title from the public on-chain ledger. A properly formed trust or holding entity would own each property in the jurisdiction where it sits; HOMES contracts would publish the community economics, approved governance actions, fee receipts, reserves, and USDC distributions. The legal vehicle does not exist yet and Aura owns no property today, so the dashboard says not formed until formation and title documents can be evidenced.",
  },
  {
    q: "What does decentralized rental mean here?",
    a: "First, one real home has to work end to end: acquisition, build, booking, cleaning, maintenance, reserves, guest support, and transparent reporting. The next stage is an open rental marketplace where eco-home owners can list stays, guests can book without learning crypto, and payment and operating evidence can settle on-chain. Aura will not call it decentralized while one team still controls every property and decision.",
  },
  {
    q: "What would the real-world asset launchpad do?",
    a: "It is a later rollout, not a live fundraising product. Aura could help an independent owner prepare the land case, design-intent plans, team, budget, operating model, evidence room, milestones, and on-chain proof for an eco home, cabin, or unique stay. Every project would still need a named sponsor, its own holding structure and rules, sourced evidence, a defined funding window, and explicit participant confirmation. Aura would not publish a campaign, hold funds, or execute transactions in the background.",
    link: { href: "/homes#launchpad-heading", label: "See the planned launchpad" },
  },
  {
    q: "Could people lock HOMES for a particular stay?",
    a: "That is a possible later design, but the ledgers must stay separate. A time-bound HOMES lock could signal support, rank interest, or open an eligibility window for one named project. Actual project money would enter a distinct USDC milestone vault after confirmation. HOMES/USDC market liquidity stays in its own treasury-controlled position and cannot be described as construction funds. No lock or project-vault contract exists today.",
  },
  {
    q: "How does Aura make money?",
    a: "Nothing on this site charges anyone. One live exception exists off-site: the XLaunch venue routes 60 percent of its 1 percent swap fee on HOMES trades to the founder's creator wallet; those fees accrue at the venue and will appear on the HOMES ledger with claim receipts. The planned model beyond that uses small, disclosed margins on completed services, partner APIs, marketplaces and AI model routing. OpenRouter-powered services may include a clearly shown 15 percent service margin. The HOMES ledger separates gross customer spend, third-party cost, Aura's net fee, the applicable rule version, and every destination so a margin cannot be hidden inside a home budget.",
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
    "Plain answers about professional review, planning costs, water systems, resale questions, X Layer, and how Aura makes money.",
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
          The questions people ask first — with the catches stated up front.
        </p>
      </Reveal>

      <Stagger className="mt-16 grid gap-6 md:grid-cols-2">
        {faqs.map((f, i) => (
          <StaggerItem key={f.q} className="h-full">
            <article id={"id" in f ? f.id : undefined} className="aura-panel aura-panel-lift h-full p-8 scroll-mt-28">
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
