# Aura Homes — Phased Roadmap

**Purpose:** turn the A-to-Z vision into a sequence where each phase is a *complete, working, sellable thing* rather than a slice of an unfinished thing.

**Written** August 9, 2026, to the founder's three-phase framing:

> **Phase 1** — buy an eco home with USDC, through a retailer, guided by a chatbot.
> **Phase 2** — buy the property/land too, via X Layer / OKX bridges; buy *or customize* through the retailer or the AI app.
> **Phase 3** — increasingly automated, toward full one-click A-to-Z.

**Evidence base:** [research/MARKET-AND-USDC-FEASIBILITY.md](research/MARKET-AND-USDC-FEASIBILITY.md) (market structure, buy-flow legality) · [research/RETAIL-PARTNERS-USDC.md](research/RETAIL-PARTNERS-USDC.md) (named home-seller candidates and their actual payment stance) · [research/SUPPLY-CHAIN-CRYPTO-RAILS.md](research/SUPPLY-CHAIN-CRYPTO-RAILS.md) (materials distributors that take crypto, and the gift-card/card bridges for the ones that don't) · [FEASIBILITY.md](FEASIBILITY.md) (Alberta construction, energy, crypto rails).

---

## The organising idea

Every eco-home company on earth has a **shop window and no cash register.** BOSZ, Samara, Dvele, Method, ecokit — beautiful catalogs, published prices, and a funnel that terminates in "book a consultation." The industry's own buying process *starts* with a lender saying no, and its first real payment is **a deposit to reserve a factory production slot**, paid months before anything exists.

So the wedge is not "design a house with AI." It's **the cash register, and the fulfillment engine behind it.**

Three facts make the retailer route the right Phase 1:

1. **BOXABL already accepts crypto for home sales** (its own press release, May 22 2025) and holds a Bitcoin treasury (10 BTC, Aug 2025). Casita, 375 sqft, ~$49,500. A crypto-accepting prefab manufacturer exists *today*.
2. **The reservation deposit already exists — it's just paid by Stripe.** Nestron takes a **$1,000 online booking fee** to secure an order (Stripe with a 3.5% surcharge passed to the buyer, or wire to Singapore). Aura's Phase 1 buy button is that exact fee, settled in USDC, wrapped in escrow with a refund window that neither side gets today.
3. **The seller never has to hold crypto.** Dubai's model — DAMAC since 2017, Emaar on select projects — routes payment through an approved gateway that auto-converts to fiat into the seller's escrow. That answer removes the objection that kills most partner conversations.

And the fulfillment engine is already written. `AuraBuildEscrow` (milestones, 2-of-3 release, 10% Alberta statutory holdback with a maturity timer) and `AuraBuildRegistry` are not discarded by a buy button — **they become what the buy button is wired to.** Phase 1 is a re-cut, not a rebuild.

### The legal split that makes it work

The **home** is *goods* — a purchase order, settleable in USDC essentially today. The **land** is *a deed* in a government registry: lawyers, title insurance, FinCEN reporting on non-financed transfers to entities (effective March 1, 2026), and in Alberta lawyers cannot hold crypto in trust at all.

> **Phase 1 sells the home in USDC. Phase 2 adds the land — deposit escrowed on-chain, closing executed by a lawyer in fiat, on-chain record updated on title confirmation.**

That sentence is the product strategy, the compliance answer, and the best line in the demo video.

### Mapping to the existing ROADMAP.md

| This document | [ROADMAP.md](ROADMAP.md) | Change |
|---|---|---|
| **Phase 1 — Buy the home in USDC** | Phase 0 (12-day sprint) | Front door re-cut: retailer catalog + chatbot + BUY, instead of questionnaire-first. Same contracts. |
| **Phase 2 — Buy the land, or customize the home** | Phase 1 (proof) + parts of Phase 2 | Adds the land rail and the configurator; sequenced after the transaction works. |
| **Phase 3 — Toward one-click A-to-Z** | Phases 2–3 | Unchanged in ambition; staged as 3a → 3b → 3c. |

---

## Phase 1 — Buy an eco home with USDC, through a retailer, guided by a chatbot
### *(hackathon MVP · Aug 9–21, 2026)*

**Goal:** a visitor lands in the immersive 3D site, is walked by an AI concierge through choosing a real eco home from a real manufacturer's catalog, is told honestly whether it can legally sit where they want it — and **pays the reservation deposit in native USDC on X Layer**, with a refund window, escrow behind it, and an on-chain record that flips status in front of the judge.

### What's included

**A. The storefront (3D — already live at aurahomes.fun)**
- **Exactly three** homes. Not four, not infinite. Real specs, 3D walkthrough, **published price**, and the off-grid systems every competitor leaves off the sticker.
- Sourced from the retailer research: Boxabl-class entry (~$49.5K), a mid tier, and an Aura SIP design priced from the open Alberta cost model with live **LOW / MID / HIGH** line items.

**B. The guided chatbot (the AI concierge — founder's Phase 1 requirement)**
- Walks the buyer from "I want an eco home" to a specific configured order: budget, climate, off-grid vs grid-optional, water, septic, timeline.
- Explains *what's actually included* — the question the entire category refuses to answer plainly (BOSZ's site never states whether land, permits, foundations or installation are in the price).
- Answers in CAD with USDC settlement underneath; surfaces lead times honestly (SIP kits are 12–20 weeks from approved drawings).
- **It is the interface to the buy flow, not a sidebar.** The order it produces is the order that gets funded.

**C. The AI gate (this is the AI-RWA story — it must be load-bearing)**
- Home + parcel → constraint check **before the buy button unlocks**: district minimum dwelling size (the 592 vs 1,076 sqft kill), FDWR glazing ratio, setbacks, grid distance, septic/soil suitability.
- **The buy button must be able to say NO.** A checkout that refuses a purchase to protect the buyer is the most memorable eight seconds in the video, and it's the honest difference between AI and garnish.
- The agent also emits the **milestone schedule the escrow then enforces** — closing the loop the AI-RWA track is actually about.

**D. The buy flow (native USDC on X Layer)**
- **Reservation deposit → milestone escrow → retailer paid per milestone.** Goods. Real.
- Native USDC only (`0xB6CE…3061` mainnet / `0xDec9…b9B3` testnet). Never bridged `USDC.e` — three variants circulate and the wrong one strands funds. Assert `eth_chainId` before every deploy.
- **Cooling-off / refund window in the contract.** Trust is the product in a home purchase; it is also the consumer-protection answer.
- One milestone released on camera with the **10% statutory holdback visibly retained** and its timer running.
- **OKLink tx links on screen.** Every figure in the video captured live.
- Gasless USDC transfers on X Layer via x402 are live in OKX Wallet — use them so the buyer never needs OKB.

**E. The record**
- `AuraBuildRegistry` NFT per order: **Designed → Funded → UnderConstruction → Complete** (the contract's canonical `BuildStatus` enum — the vocabulary of record). An ownership/build **record**, never legal title.

**F. The Supply Router — read-only panel** *(cheap, demoable, zero custody)*
- Per budget line, show which rail buys it with crypto today: **DIRECT** (supplier accepts it) → **BRIDGE** (gift card / card, small tickets, no recourse) → **CONVERT** (USDC/CAD → wire, full recourse), each with its fee.
- Name the real one: **[Kuby Renewable Energy](https://kuby.ca/) — Edmonton/Calgary/Lethbridge — accepts Bitcoin for solar systems *and* contracting**, which lands directly on the largest non-land line in an Aura build (~$48K MID).
- Show the honest total: **roughly $50–60K of a $301K MID build has a real crypto rail today**; the rest converts. A stated number beats a vague claim, and it makes the routing product obvious. Detail in [research/SUPPLY-CHAIN-CRYPTO-RAILS.md](research/SUPPLY-CHAIN-CRYPTO-RAILS.md).

**G. If time remains, in this order**
1. x402 / OKX APP-metered AI concierge fee — pennies, visible, on-chain.
2. A second parcel scenario so rejection and acceptance show back to back.

### What it demos

> "This is the only place on the internet where you can talk to an AI about the eco home you want, be told it *can't* legally go on the land you picked — and then, on land where it can, buy it. In dollars, settled in seconds, for a fraction of a cent, with the province's construction holdback law enforced by the contract."

90 seconds: hero one-liner → chatbot → parcel rejection → home + live budget → **BUY in USDC, real tx** → registry flips → milestone release with holdback retained → refund window → repo URL + MIT.

### What's needed

| Need | Status |
|---|---|
| Faucet OKB for deployer `0x831Fb0…f260` | **Matt-only, captcha-gated. Blocking. 30 seconds.** |
| Contracts on testnet 1952, then mainnet 196 | Written and tested; awaiting faucet |
| Reservation-deposit + refund-window semantics | **Shipped** — escrow v2 (`496dcff`, 21 passing tests): homeowner places the USDC deposit, can refund it alone through the 14-day `refundDeadline` (inclusive); after the window it converts into the first milestone under the existing 2-of-3 release with the 10% holdback |
| Three catalog homes with priced line items + source links | Cost model exists; needs catalog framing |
| Chatbot wired to the order object | New, but thin — it drives existing state |
| Parcel fixtures + suitability rules | `lib/parcels.ts` and the land page exist |
| @AuraHomesAI, build-in-public posts, form, submission tweet | **Matt-only** |
| 90-second video against the live site | After the buy flow lands |

### The honesty constraint

**No partner will be signed by August 21, and the demo must not imply one.** Ship "partner-ready": catalog homes labelled *reference designs priced from published sources* (each with its link) or Aura's own SIP designs; a visible partner state (*signed: none yet · in conversation: …*); and the buy flow **genuinely real** on X Layer. Naming Boxabl as a **target** is interesting and true. Naming it as a partner is not. The outreach shortlist doubles as documented go-to-market — and *growth potential* is a stated judging criterion.

### Explicitly NOT in Phase 1

Free-form design. Land purchase. Fiat on-ramp integration. Account abstraction. IFC export. Multi-jurisdiction data. Any token. **Any fractional ownership** — that's a securities distribution, and the sector's leader in that model (RealT) entered voluntary liquidation on July 2, 2026.

---

## Phase 2 — Buy the property too, and customize the home
### *(Sep 2026 – Q4 2027)*

**Goal:** the two things Phase 1 deliberately left out — **the land**, and **choice**. Plus the legal spine that makes one real deposit real money.

### 2a — A signed retailer and a real order *(Sep–Dec 2026)*

- **Convert a Tier-A or Tier-B partner.** Priority order from the research: **Boxabl** (already accepts crypto), **Nestron** (already takes an online booking fee and pays 3.5% to Stripe), **Honomobo** (Edmonton — same province as the pilot, 90+ homes installed), **Dwellito** (aggregator: one integration, many manufacturers, $40K–$360K). The pitch: buyers their lender-first funnel rejects; escrow better than the card charge they use now; fees at a fraction of card; and they never have to hold crypto unless they want to.
- **Legal spine.** FINTRAC MSB analysis and registration (8–16 weeks, free) before any custodial mainnet flow. Independent escrow audit (US$15–60K; X Layer ecosystem and OKX accelerator grants are the funding path). Consumer-protection review of deposit/prepaid-contract terms. KYC and beneficial-ownership capture designed in — the FinCEN rule catches "cash buyer through an entity" at *any* price, which is exactly what a crypto buyer looks like.
- **A payment rail a normal person can use.** Card-first on-ramp (MoonPay / Transak / Banxa / Onramper — evaluate X Layer coverage and Canadian card success rates), CAD display everywhere, account abstraction (Particle + Safe) so nobody sees a seed phrase.
- **One documented pilot order, in public.**

### 2b — The land rail *(X Layer / OKX bridges)*

- **Bridge in:** Circle CCTP to native USDC on X Layer; the crypto-native Canadian path is Wealthsimple (0%-fee USDC) → withdraw on Base → CCTP. OKX bridge and gasless x402 transfers for X Layer-native users.
- **Deposit on-chain, closing off-chain.** Refundable land deposit escrowed in USDC; conveyance executed by a crypto-fluent Alberta lawyer, convert-then-close via Kraken USDC/CAD → trust account (Alberta lawyers cannot hold crypto in trust — this constraint is permanent until the rules change). On-chain record updated on title confirmation. **Never claim the chain holds title.**
- **Land supply:** the parcel filter (Altalis cadastral + title, RITL encumbrances, Socrata zoning, LiDAR DEMs) plus crypto-ready listing feeds from Crypto Emporium and CryptoRealEstate.cc (2,200+ properties, 50+ countries) for buyers outside the pilot.
- **Closing partner where licensing is required:** Propy is a US-licensed title company with USDC escrow and $5B of volume — partner, don't rebuild.
- CRA barter-disposition ledger export shipped as a feature, not a nuisance.

### 2c — The materials rail *(the Supply Router goes transactional)*

- **Sign the direct suppliers.** Kuby (solar + contracting, Alberta, already takes Bitcoin) is the first call; Skycorp Solar already settles in **USDC** for components.
- **Run supplier onboarding as a growth loop.** Hand Insulspan / EnerSmart / a window supplier a Coinbase Commerce or BitPay link so they can accept USDC without ever holding it — the same argument that works on home retailers: the gateway converts, they book fiat. **Every supplier converted moves a budget line from CONVERT to DIRECT, and that migration is a measurable ecosystem metric.**
- **Bridge with discipline.** Gift-card rails (Bitrefill covers Home Depot Canada and Home Hardware with USDC; Coinsbee; CryptoRefills) are buy-and-burn only, capped to small tickets, and carry **no recourse** — Bitrefill was breached March 1 2026 and Pay with Moon is reported offline/refusing refunds in early 2026. Never custody with a bridge; keep a second and third provider configured.
- **Raise the AML question with counsel before this ships.** Routing users into crypto-for-gift-cards is a known laundering typology; tie every purchase to a build record and keep receipts.
- Automatic CRA barter-disposition logging on every path — each crypto spend is a taxable disposition.

### 2d — Buy *or customize*

- Catalog becomes a **constrained configurator**: massing, room program, envelope and glazing generated against Part 9 / zone 7A / district bylaws. Generating a plausible design is now commodity (Higharc trained on 3,500 home files / 75,720 room samples; Maket; Snaptrude) — **the moat is constraint-checking against a real jurisdiction**, so that is what gets built.
- Two doors from the same chatbot: *buy this home from this retailer*, or *customize one and we'll price and source it*.
- Partner bench signed: residential designer, P.Eng, 2 solar installers, 2 septic designers.

### What it demos

A real buyer, a real home, a real factory slot, a real parcel, real money — and a public build log. This is the phase that converts a hackathon entry into a company.

---

## Phase 3 — Increasingly automated, toward one-click A-to-Z
### *(2028+)*

Staged, because "one-click" is earned in increments, not announced.

**3a — Automated compliance.** IFC in → deterministic rule run → four verdicts (COMPLIANT / NON_COMPLIANT / REVIEW_REQUIRED / UNCERTAIN; missing data is always REVIEW_REQUIRED, never an error) → sealed permit package via the Notarius/P.Tech rail. IFC export (IfcOpenShell), HOT2000 handoff for the 9.36 performance path.

**3b — Automated sourcing and scheduling.** Contractor scout: DIY-or-hire toggle per budget line plus a per-build fan-out research sweep that ranks local trades and caches back into the supplier directory, so the network compounds with every build. Supplier quote negotiation. Trades scheduled against SIP lead times and frost windows. Escrow draws released against inspector sign-off rather than manual approval. Expansion packs `data/bc/`, `data/sk/` — a new province becomes a data problem, not a rewrite.

**3c — The full agent.** Watches land listings and flags underpriced suitable parcels; files permit applications the counties accept digitally; streams draws; hands every owner a complete as-built and tax ledger. Where a jurisdiction puts its registry on-chain, the record becomes the title — Dubai's DLD/PRYPCO Mint proves a land registry *can* run this way (7.8M tokens on a live secondary market since Feb 20, 2026) and equally proves it takes a state to do it. Until Alberta does, Aura partners rather than pretends.

Open source (MIT) throughout, so builders adopt it instead of fearing it.

---

## The through-line

| Phase | The sentence | The transaction | The risk retired |
|---|---|---|---|
| **1** | "Talk to an AI, pick an eco home, buy it in USDC." | Reservation deposit to a retailer | Does anyone want this? Does the rail work? |
| **2** | "…and the land, and built your way." | A real order + a real parcel | Is it legal? Will a manufacturer sign? |
| **3** | "…and orchestrated end to end." | A whole project | Can software run a build? |

Each phase ships something a person can use. None of them is a slice of an unfinished thing. That's the whole point.

---

*Reassessed continuously against [VISION.md](VISION.md) — the audit loop has authority to flag drift. Sources for every market, partner, legal and chain claim: [research/MARKET-AND-USDC-FEASIBILITY.md](research/MARKET-AND-USDC-FEASIBILITY.md) §5 and [research/RETAIL-PARTNERS-USDC.md](research/RETAIL-PARTNERS-USDC.md) §Sources.*
