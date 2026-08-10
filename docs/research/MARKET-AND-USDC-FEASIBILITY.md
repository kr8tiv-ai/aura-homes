# Aura Homes — Market & USDC-Purchase Feasibility Research

**Question asked:** can Phase 1 of Aura Homes be *"browse a pre-designed eco home, buy it (and/or the property) in USDC on X Layer"* — and is that a defensible product, not just a hackathon trick?

**Prepared:** August 9, 2026 · KR8TIV AI · Companion to [FEASIBILITY.md](../FEASIBILITY.md) (which covers Alberta construction, energy, water, septic and the crypto rails in depth — this document deliberately does **not** repeat it). Reference site studied at the founder's request: [bosz-houses.nl](https://www.bosz-houses.nl/en).

---

## 0. Executive verdict

**Yes — and it is the *stronger* Phase 1, on three independent grounds.**

1. **The market gap is real and precisely shaped.** Dozens of companies sell factory-built eco homes with beautiful websites and configurators. Almost none of them let you *transact*. The industry stops at "request a quote." Aura can own the last three inches: **a price, a button, and a settled payment.**
2. **The legal difficulty is asymmetric, and almost everyone gets this backwards.** Buying the **house** and buying the **land** are two completely different legal animals. A prefab home is *goods* — a purchase order, a deposit, a delivery. Land is a *deed* in a government registry, with lawyers, title insurance and money-laundering statutes attached. The house side is buildable-for-real in months; the land side is a multi-year regulated slog. **Phase 1 should sell the house in USDC and only *escrow the deposit* on the land.** That is both the honest split and the fast one.
3. **It doesn't cost you the AI-RWA story — it sharpens it.** The escrow contract you already wrote (milestones, 2-of-3, 10% Alberta statutory holdback) doesn't get thrown away by a "buy" flow. It becomes the *fulfillment engine sitting behind the buy button*. What changes is the front door: a catalog and a price instead of a questionnaire and a maybe.

**The one thing that can go wrong with this pivot:** if "buy" becomes a Stripe-shaped checkout, the AI turns decorative and you lose the track. The mitigation is in §4.3 — the AI must **gate** the purchase (site suitability, code minimums, budget honesty), not decorate it.

---

## 1. The market

### 1.1 Teardown: BOSZ Houses (the reference)

BOSZ (Netherlands) sells premium prefab tiny houses and wellness units — "the perfect balance between sustainability, luxury and freedom," mirror-glass facades, panoramic glazing, plug-and-play placement, 10-year warranty with annual inspections. Four models, prices **published on the public site**, all excluding VAT:

| Model | Price (ex VAT) | Notes |
|---|---|---|
| Sense | ~€78,500 | pitched roof, roof glazing, glass bedroom; sleeps 2–4 |
| Signature | ~€78,500 | attached veranda, indoor-outdoor |
| Luxury Retreat | ~€63,000 | 6.5–12.7 m range |
| Mini Sense Nomad | ~€51,500 | compact, wheeled, ex-chassis |

Testimonials are segmented three ways — private residents, hospitality operators, investors — which tells you the real buyer mix for this category isn't only "someone who wants a house."

**What BOSZ does well (steal this):** published prices on the models themselves; a small, opinionated catalog instead of infinite choice; the eco claim carried by *materials and footprint*, not by a spec sheet; the warranty as a trust device.

**What BOSZ does not do (this is the opening):** there is **no configurator and no transaction path** on the site. The funnel terminates in phone, WhatsApp, or a booked consultation. Nothing states what's included regarding land, permits, foundations or installation. There is no online step from "I want the Signature" to "the Signature is mine." *([bosz-houses.nl/en](https://www.bosz-houses.nl/en))*

That pattern — gorgeous shop window, human sales funnel — repeats across nearly the entire category.

### 1.2 The landscape: who does something like this

The category splits into five bands. Prices are as published/reported in 2026.

| Band | Players | Product | Price point | Can you transact online? |
|---|---|---|---|---|
| **Micro / ADU commodity** | [Boxabl](https://www.boxabl.com/order) (Casita, 375 sqft), [Nestron](https://store.nestron.house/configurator/) (Cube C1/C2/C2X) | Folding or container-form factory units | Casita **$49,500** base; Nestron **from $49,800** | Closest to yes — Boxabl has an *Order* page; Nestron has a real **configurator**. Both still end in a deposit + sales process, not a settled purchase. |
| **Premium ADU / backyard** | [Samara](https://www.samara.com/backyard/models) (Airbnb co-founder Joe Gebbia), Abodu, Villa | Turnkey installed ADUs, ~7-month lead | Samara studio (430 sqft) **$289K**, 1-bed (550 sqft) **$329K** *incl. install* — ≈ **$600–670/sqft** | Configurable, quote-gated. Samara raised $34M (Sep 2025); 60 free homes for LA wildfire survivors via Steadfast LA / $15M Gebbia commitment. |
| **High-performance / net-zero prefab** | [Dvele](https://www.dvele.com/), [Method Homes](https://www.methodhomes.net/), Plant Prefab, [ecokit](https://ecokit.us/) | Passive-House-class, all-electric, net-positive; ecokit sells **fixed-price contracts** | Dvele **$468–647/sqft** turn-key | No. Quote → contract → construction loan. |
| **European eco/tiny** | **BOSZ**, [Woonpioniers](https://plainmagazine.com/woonpioniers-sprout-house-netherlands/) (bio-based, hemp insulation, prefab laminated timber), Avrame, a long tail of NL/DE/Baltic manufacturers | Design-forward small homes | €50–150K typical band | No. Consultation funnels. |
| **Kit / DIY** | [EcoHome.net](https://www.ecohome.net/en/prefab-kit-homes/) architect-designed kits (kit → turnkey tiers), Allwood-class kits on Amazon | Panelized kit, buyer completes | Wide | **This is the one band where you can literally add a house to a cart** — because a kit is unambiguously *goods*. That's a legal tell, and §2.2 explains why it matters. |

**Market size, for the pitch deck:** global prefabricated housing **$152.74B in 2026 → $210.33B by 2031 (6.62% CAGR)**; Europe **$37.10B → $52.15B (7.05%)**; the wider modular & prefabricated construction market **$180.3B in 2026 → $307.2B by 2035 (6.1%)**; Mordor projects a **$413B** prefabricated-construction opportunity by 2031. Modular homes were **48% of 2025 volume**; panelized/componentized systems — **the SIP band Aura builds in** — are the fastest-growing segment at **9.90% CAGR**. *(Mordor Intelligence, Grand View, GMI, The Business Research Company — see Sources.)*

### 1.3 How people actually buy these homes today

This is the part that makes the crypto argument. The current path, verbatim from the industry's own guides:

1. **Pre-approval** — before you're allowed to design anything, a lender decides your budget.
2. **Land** — you buy and prepare a plot separately, usually first, usually with a different loan.
3. **Quote → contract** — sales conversation, site visit, a proposed contract for a specific model.
4. **Deposit to hold a factory slot** — "modular factories operate on scheduled production slots, and deposits are required to reserve your build." Some lenders release the deposit inside the draw schedule; some reimburse you only after closing.
5. **Construction-to-permanent loan** — interest-only during the build, converting to a mortgage on final appraisal.
6. **Inspected draws** — with the exception of the initial deposit and the module delivery, *an inspection must precede every disbursement*.
7. **Conversion** to permanent mortgage at completion.

Three observations that define the product:

- **The deposit-to-reserve-a-slot step is already a real, universal, discrete payment** — often five figures, paid months before anything is built. It is the single most natural thing in this industry to settle in USDC. **That is the Phase 1 transaction.**
- **The draw schedule is already milestone escrow, done badly** — by a bank, on paper, with an inspector. Aura's contract is the same shape, on-chain, with the holdback modeled. You are not inventing a payment pattern; you are digitizing the one that already exists.
- **Financing is the true gatekeeper, and it excludes exactly Aura's customer.** Banks generally won't mortgage off-grid, owner-built, sub-1,000 sqft homes (documented in FEASIBILITY.md §6). The industry's own funnel begins with a lender saying no to your buyer. A crypto-collateral or cash buyer walks past step 1 entirely. **The financing gap isn't a footnote — it's the reason a crypto-native buyer is genuinely the right first customer, not a hackathon excuse.**

### 1.4 The "design and buy a house online" frontier

Two separate frontiers, and neither one meets the other:

**AI design is solved-enough and going commercial.** [Higharc](https://www.higharc.com/newsroom/higharc-announces-new-ai-capabilities-for-industry-leading-homebuilding-platform) generates layouts from a BIM-native corpus of **3,500 home files / 75,720 room samples** and produces build-ready homes with construction documents, live estimates and shoppable 3D models — enterprise homebuilder tooling. [Maket.ai](https://www.maket.ai/) does residential layout generation from constraints and zoning rules for homeowners and pros. [Snaptrude](https://www.snaptrude.com/) emits full BIM with quantity reports and Revit/IFC export. **Conclusion: generating a plausible home design is now a commodity input, not a moat.** (This matches FEASIBILITY.md §4.1 — what's *not* commodity is constraint-checking against a real jurisdiction.)

**Online purchase is unsolved in this category.** The best-in-class experience is a configurator that ends in a lead form. Boxabl's *Order* page and Nestron's configurator are as far as the industry goes, and both hand off to a human sales process for the money.

**Nobody joins the two ends.** After aggressive searching (this sweep and the 300-source sweep behind FEASIBILITY.md): **no platform anywhere combines AI-assisted eco-home design + an actual settled crypto payment + fulfillment orchestration.** The fragments all exist separately. The join is unclaimed.

### 1.5 The gap Aura can own

| Layer | Who's already there | Aura's claim |
|---|---|---|
| Beautiful eco-home catalog | BOSZ, Samara, Dvele, ecokit | Immersive 3D that shows the home *on your actual site*, not on a studio backdrop |
| AI design generation | Higharc, Maket, Snaptrude | Not the moat — **constraint-checking against a real jurisdiction's bylaws is** (the 592 vs 1,076 sqft district-minimum kill is the demo moment) |
| Price transparency | BOSZ, Boxabl (base prices only) | Full line-item LOW/MID/HIGH from a published Alberta supplier dataset, including the off-grid systems everyone else omits |
| Buy button | **Nobody** | **This is the wedge** |
| Payment rail | Propy (title/escrow), RealOpen (convert-at-close), Milo (crypto-collateral lending) | Native USDC settlement on X Layer, direct, no OTC desk on the house side |
| Fulfillment / build orchestration | **Nobody at small scale** (Atmos raised $20M, Altman on the cap table, dead March 2025 — the cautionary tale) | Milestone escrow with statutory holdback + a local trades directory. **Orchestrator, never general contractor.** |

**One-line positioning:** *Every eco-home company on earth has a shop window and no cash register. Aura is the cash register — and the fulfillment engine behind it.*

---

## 2. USDC / crypto payments for homes

### 2.1 What is genuinely real in 2026

| Player | What they actually do | Status |
|---|---|---|
| **[Propy](https://propy.com/home/)** | US-**licensed title company**; on-chain title + escrow; accepts BTC, ETH, **USDC**; Coinbase Prime crypto escrow; Morpho-powered Propy USDC Vault so escrowed funds earn yield pre-closing; mints an NFT of the *deed* for whole-property purchases | The real one. **$5B** transaction volume (up from $2.5B); **$100M raised May 2026** to buy title firms and run an AI escrow agent; Propy Escrow live in **California Jan 2026**; acquisitions in AL and FL. Their first US NFT house: **$653K, Gulfport FL, 2022 — and the NFT holder owned the property *via an LLC***. |
| **[RealOpen](https://realopen.com/)** | Buy real estate with BTC/ETH/**USDC** by converting to fiat at closing through a prime OTC desk — you present as a **cash buyer** | The pragmatic pattern. This is what "buying a house with crypto" mostly *is* in 2026: convert-then-close. |
| **[Milo](https://www.milo.io/)** | Crypto-collateral mortgages, up to 100% financed. **BTC collateral 250%** of loan value; **USDC collateral 125%** | Real lending product; USDC is materially cheaper collateral than BTC. |
| **[Dubai DLD / PRYPCO Mint](https://dubailand.gov.ae/en/news-media/dld-launches-the-mena-s-first-tokenized-real-estate-project-through-the-prypco-mint-platform)** | Government land registry itself tokenizing title deeds, with VARA + UAE Central Bank + Dubai Future Foundation. **Phase 2 secondary market live Feb 20, 2026 — 7.8M tokens trading.** From **AED 2,000** | The only place on earth where the *registry* is on-chain. **But: denominated in dirhams, not crypto, and UAE residents with an Emirates ID only** (as of June 2026). Proof the state-level path exists; also proof it takes a state to do it. |
| **RealT / Lofty / Roofstock onChain** | Fractional tokenized rentals through per-property WY/DE LLCs (RealT on Gnosis, Lofty on Algorand), rent streamed to holders | **Cautionary.** Total US tokenized residential ≈ **$300M** against ~$18B of all live US RWA. **RealT announced voluntary liquidation of its US structures on July 2, 2026** — rent distributions suspended. Roofstock One discontinued for new investors. **Do not build Phase 1 on fractional ownership.** |
| **Regulatory tailwind** | **GENIUS Act (US, 2025)** gave dollar-pegged stablecoins a federal framework — brokers and marketplaces can receive USDC with a far cleaner compliance posture than two years ago. In Canada, **USDC is the only CSA-approved stablecoin** (Circle's OSC undertaking) | The rails got legal before the products arrived. |

### 2.2 The asymmetry nobody states plainly: goods vs. deeds

This is the most important finding in this document.

| | **The HOUSE (prefab unit / kit / SIP package)** | **The LAND (real property)** |
|---|---|---|
| Legal nature | **Goods / chattel.** A purchase order and a delivery. | **A deed** in a government Land Titles registry. |
| Who must be involved | Manufacturer, buyer, a carrier | Lawyer/notary, land titles office, title insurer, sometimes a lender |
| Can it settle in USDC? | **Yes, essentially today** — it's a business accepting payment for a product. The stablecoin question is a treasury/tax/AML question, not a property-law question. | **Not directly, almost anywhere.** Convert-then-close is the working pattern (RealOpen). In Alberta specifically, **lawyers cannot hold crypto in trust** — the documented $800K-BTC Calgary close was convert-then-close. |
| Blocking statutes | Consumer-protection / prepaid-contract rules, sales tax, deposit protection | AML: **FinCEN Residential Real Estate Report, effective March 1, 2026** (delayed from Dec 1, 2025) — *every* non-financed residential transfer to an **entity or trust**, **no minimum price**, reportable by the closing professional. Canada: FINTRAC MSB registration for anyone routing funds. |
| Time to a real, compliant product | **Months** | **Years, or a partner (Propy-class) who already holds the licences** |

Two consequences fall straight out of this:

- **The FinCEN rule is aimed squarely at the naive crypto-real-estate design.** "Buyer pays cash (no mortgage) through an LLC" is *exactly* the reportable pattern — and it's exactly how the Propy NFT house was structured. Any Aura land flow must assume a licensed closing professional files a Real Estate Report and collects beneficial-ownership data. **Design KYC in from the start rather than bolting it on.**
- **Therefore Phase 1's buy button should sell the home, and hold a *deposit* on the land.** A refundable, escrowed land deposit is a legitimate, common, and legally boring instrument. The closing itself stays where it belongs: with a lawyer, in fiat, off-chain, with the on-chain record updated on confirmation.

Also settled by this sweep, and worth keeping: **the MVP's RWA stays a non-financial build/ownership record.** Slicing a home into tradeable fractions is a securities distribution (CSA SN 46-308 in Canada; Reg D/S wrappers in the US), and the sector's own leader in that model went into voluntary liquidation five weeks ago.

### 2.3 A USDC flow on X Layer, concretely

Chain facts, verified: X Layer runs **Polygon CDK as a zkEVM L2**, **OKB** as gas token, **~2s blocks**, **sub-cent fees (often <$0.001)**, mainnet **196** / testnet **1952**. EVM-equivalent — Hardhat/Foundry unmodified.

**The decisive recent fact: Circle launched native USDC + CCTP on X Layer on August 6–7, 2026** — replacing the bridged `USDC.e`. Native USDC is issued by Circle directly, not wrapped. Mainnet `0xB6CEceAB302E2E4948951eE7843FC24E92933061`, testnet `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`. **Three USDC variants circulate on X Layer; pointing at the wrong one strands funds.** Aura started building 72 hours after that launch — that timing is a legitimate, checkable "first real-economy integration" claim.

Also live and directly useful: **OKX Wallet supports gas-free USDT/USDC transfers on X Layer via x402**, so a buyer never needs to acquire OKB to pay. And **OKX's Agent Payments Protocol (APP) v1.0, released April 2026**, natively specifies quotes, negotiation, **escrow, usage metering, partial refunds, splits and dispute resolution**, settling on X Layer — structurally aligned with Coinbase's x402 at the HTTP-402 layer and built on Stripe's MPP wire format. *An escrowed home deposit with a refund window is, almost line for line, an APP-shaped transaction.*

**The flow, end to end:**

```
BUYER (no crypto)          card → MoonPay/Transak/Banxa class on-ramp → USDC
BUYER (crypto-native, CA)  Wealthsimple 0%-fee USDC → withdraw on Base → Circle CCTP → X Layer native USDC
                                     │
                                     ▼
                        AuraHomeOrder / AuraBuildEscrow  (X Layer, native USDC)
                        • reservation deposit, refundable inside a cooling-off window
                        • milestones, 2-of-3 release (buyer / builder / arbiter)
                        • 10% Alberta statutory holdback retained per release + maturity timer
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
        HOME (goods)                        LAND (real property)
        → manufacturer paid per milestone   → deposit held only; closing off-chain
                                              with a lawyer, convert-then-close;
                                              on-chain record updated on title confirmation
                                     │
                                     ▼
                        AuraBuildRegistry NFT: Reserved → Contracted → UnderConstruction → Complete
```

Off-ramp reality (unchanged from FEASIBILITY.md §5): the last mile to Alberta suppliers and lawyers is CAD — Kraken USDC/CAD ≈0.4% taker → wire to trust account. QCAD (TD-custodied) is the future one-hop corridor when it ships.

### 2.4 Demo vs. real world — the honest ladder

| Capability | Hackathon demo (Aug 2026) | Real world, and what it costs |
|---|---|---|
| Pay a **reservation deposit** for a home in USDC | ✅ Fully real on testnet 1952 and mainnet 196 | ✅ Achievable in Phase 2 with a manufacturer partner + MSB registration + contract audit ($15–60K) |
| **Milestone escrow with statutory holdback** | ✅ Contract exists, tested, demoable | ✅ Real, but needs the audit and a named arbiter before it holds six figures |
| Pay for the **home in full** in USDC | ✅ Demoable | ✅ Legitimate — it's a goods purchase; the constraint is the manufacturer's treasury policy, not property law |
| **Buy the land** in USDC, end to end | ⚠️ Demo the *deposit*; label the closing as lawyer-executed | ❌ Not in Canada today. Convert-then-close with a crypto-fluent lawyer/brokerage; FinCEN reporting in the US; lawyers can't hold crypto in trust in AB |
| **Title / deed on-chain** | ⚠️ Represent as a build/ownership **record**, never as legal title | ❌ Requires the registry (Dubai DLD) or a licensed title company (Propy). Partner, don't build |
| **Fractional ownership** of a home | ❌ Don't | ❌ Securities distribution. RealT liquidating. Off the roadmap |

**Rule for every demo surface:** if it isn't true, the UI says so. On-chain record ≠ title. Deposit ≠ closing. That honesty is itself a judging asset — and it's the established house style in this repo.

---

## 3. Hackathon fit

### 3.1 Rules (verified)

**BuildX AI Season**, X Layer / OKX, **Aug 7–21, 2026, 23:59 UTC**, submitted via [Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfgU_3zcXdxK0GJQxj33QeUWdEcAaYnieVe9p5cFDb2JFQa4Q/viewform) + an X post tagging @XLayerOfficial from a dedicated, **active** project account.

- **Hard requirements:** AI in the product · **testnet deploy during the hackathon**, mainnet after · dedicated active X account · public @XLayerOfficial mention on submission · KYC for payout · 18+.
- **Judging (verbatim):** application of AI, innovation, product completeness, user value, integration with X Layer, growth potential, contribution to the X Layer ecosystem.
- **Prizes:** 30K / 15K / 5K USDT judged; **50K USDT Liquidity Grant for the best AI-RWA project**; Launch Grants up to 200K gated on OKX-DEX volume (**not chasable** — and wash trading is an explicit DQ).
- **Disqualifiers:** wash trading, volume manipulation, fraud, plagiarism, unauthorized code use.

### 3.2 Does the "buy" pivot still fit AI-RWA? Yes — better.

The AI-RWA track rewards AI attached to a real-world asset. A **catalog + purchase + fulfillment** flow is a *stronger* RWA story than a design questionnaire, because the on-chain object now corresponds to a specific commissioned home with a price, a buyer, a manufacturer and a state machine — and OKX has said publicly they are "not looking for another chatbot."

The judged risk is **AI-as-garnish**. Three places the AI must be load-bearing and visibly so:

1. **The AI gates the sale.** Select a home, select a parcel, and the agent runs the constraint check *before* the buy button unlocks — district minimum dwelling size (the 592 vs 1,076 sqft kill), FDWR glazing ratio, setbacks, grid distance, septic suitability. **A buy button that can say NO is a far better demo than one that can only say yes.**
2. **The AI prices it.** Live LOW/MID/HIGH line-item budget from the published Alberta supplier dataset — including the off-grid systems every competitor leaves off the sticker.
3. **The AI writes the milestone schedule that the escrow then enforces**, and meters its own service fees through x402 / OKX APP. That closes the loop the track is actually about: an agent that transacts.

### 3.3 The smallest impressive slice

Ranked by (judge impact ÷ build hours). Everything above the line is Phase 1; everything below is a distraction until Aug 22.

1. **Immersive 3D catalog → 3 pre-designed eco homes** with real specs and real prices. *(The site already exists and is live at aurahomes.fun — this is a re-cut, not a rebuild.)*
2. **Pick a parcel → AI suitability gate** that visibly rejects a bad pairing.
3. **BUY in native USDC on X Layer** — reservation deposit into escrow, one signature, real tx, **OKLink link on screen**.
4. **Registry NFT flips Reserved → Contracted** live, in front of the judge.
5. **Release one milestone** and watch the 10% statutory holdback retain with its timer — the single most differentiated thing in the entire build.
6. **A refund/cooling-off window** demonstrated. Trust is the product in a home purchase; a refundable deposit is the most persuasive 8 seconds in the video.
7. *(if time)* x402/APP-metered AI design fee — pennies, visible, on-chain.

Below the line for now: fiat on-ramp integration, account abstraction, IFC export, multi-jurisdiction data packs, any token, any fractional anything.

---

## 4. Risks, stated plainly

| Risk | Severity | Route through |
|---|---|---|
| "Buy button" reads as e-commerce, AI looks decorative | **High** | The AI **gates** the purchase (§3.2). Lead the video with a rejection, not a sale. |
| Judges read "buy a house with crypto" as legally naive | **High** | The goods-vs-deeds split (§2.2) *is* the sophistication. Say it out loud in the video: *we sell the home in USDC and escrow the land deposit — because one is goods and one is a deed.* |
| Scope creep re-imports the A-to-Z vision into 12 days | **High** | Catalog of 3. No free-form design in Phase 1. The cut list above is binding. |
| Wrong USDC contract on X Layer | **Medium** | Three variants circulate. Pin the native addresses from §2.3 in config; assert `eth_chainId` before every deploy. |
| Custody / MSB exposure if real funds ever flow | **Medium** | Testnet + mainnet-demo only through Aug 21. FINTRAC MSB analysis (8–16 weeks, free) before any real user money. |
| Manufacturer partner not signed, so "buy" is notional | **Medium** | Phase 1 labels the catalog homes as *reference designs priced from the published dataset*. Don't imply a signed factory you don't have. |
| Deposit consumer-protection rules (prepaid contracts, cooling-off) | **Medium** | Build the refund window into the contract from day one — it's a feature *and* the compliance answer. |
| Fractional-ownership temptation | Low now, high later | RealT is in voluntary liquidation. Non-financial record NFT only. |

---

## 5. Sources

**Reference site & prefab market**
- BOSZ Houses — https://www.bosz-houses.nl/en
- Boxabl order page — https://www.boxabl.com/order · Casita pricing — https://www.boxabl-homes.com/boxabl-casita-tiny-house/
- Nestron models & configurator — https://nestron.house/models/ · https://store.nestron.house/configurator/
- Samara Backyard models — https://www.samara.com/backyard/models · Fast Company on Samara — https://www.fastcompany.com/90809611/inside-an-airbnb-cofounders-latest-venture-building-tiny-backyard-homes
- Dvele — https://www.dvele.com/ · pricing — https://www.prefabreview.com/blog/dvele-cost-and-pricing
- Method Homes — https://www.methodhomes.net/ · ecokit — https://ecokit.us/ · EcoHome kit homes — https://www.ecohome.net/en/prefab-kit-homes/
- Woonpioniers — https://plainmagazine.com/woonpioniers-sprout-house-netherlands/ · https://www.dezeen.com/2021/03/29/woonpioneers-prefabricated-indigo-cabin-forest/
- Eco modular roundup — https://pebblemag.com/sustainable-modular-homes/

**Market size**
- Mordor — global prefabricated housing — https://www.mordorintelligence.com/industry-reports/global-prefabricated-housing-market
- Mordor — Europe prefabricated housing — https://www.mordorintelligence.com/industry-reports/europe-prefabricated-housing-market
- Mordor via GlobeNewswire — $413B prefabricated construction by 2031 — https://www.globenewswire.com/news-release/2026/03/17/3257397/0/en/Prefabricated-Construction-Market-Outlook-USD-413-Billion-Opportunity-by-2031-Led-by-Volumetric-Modular-Buildings-with-47-4-Share-in-2025-Reports-Mordor-Intelligence.html
- GMI modular & prefabricated construction — https://www.gminsights.com/industry-analysis/modular-and-prefabricated-construction-market
- Grand View modular construction — https://www.grandviewresearch.com/industry-analysis/modular-construction-market

**How homes are bought / financed**
- Impresa Modular — seven steps of modular construction financing — https://impresamodular.com/seven-steps-modular-home-construction-financing/
- ModularHomeowners — financing in 8 steps — https://modularhomeowners.com/the-definitive-guide-to-building-modular/financing-your-modular-home-in-8-steps/
- Rocket Mortgage — modular homes — https://www.rocketmortgage.com/learn/what-is-a-modular-home

**AI design tooling**
- Higharc AI announcement — https://www.higharc.com/newsroom/higharc-announces-new-ai-capabilities-for-industry-leading-homebuilding-platform · generative building model — https://www.higharc.com/blog/ai-layout-at-higharc-tokenizing-buildings · HousingWire — https://www.housingwire.com/articles/higharc-floor-plans-into-intelligent-data/
- Maket — https://www.maket.ai/blog/what-does-ai-home-design-software-actually-do
- Snaptrude — https://www.snaptrude.com/blog/ai-house-plan-generators-2025

**Crypto real estate**
- Propy — https://propy.com/home/ · Coinbase Prime crypto escrow — https://propy.com/browse/propy-launches-crypto-escrow-service-with-coinbase-prime-integration/ · Morpho USDC vault — https://propy.com/browse/morpho-and-propy-join-forces-to-bring-real-estate-onchain/ · $100M / AI title strategy — https://www.inman.com/2026/05/14/propy-ai-title-companies/ · first US NFT home $653K — https://www.coindesk.com/business/2022/02/11/nft-linked-house-sells-for-650k-in-propys-first-us-sale
- RealOpen — https://realopen.com/
- Milo crypto mortgages (BTC 250% / USDC 125% collateral) — https://binaryx.com/blog/four-best-ways-to-buy-real-estate-with-crypto · https://cryptoslate.com/homebuyers-can-now-borrow-against-bitcoin-to-get-a-mortgage-without-selling-or-liquidation-risk/
- Dubai DLD × PRYPCO Mint — https://dubailand.gov.ae/en/news-media/dld-launches-the-mena-s-first-tokenized-real-estate-project-through-the-prypco-mint-platform · Phase 2 secondary market — https://metropolitan.realestate/media/news/dld-property-tokenization-phase-2-secondary-market-dubai/ · platform review — https://lenderkit.com/blog/prypco-mint-review-dubais-first-tokenized-real-estate-platform/
- Tokenized residential comparison & RealT liquidation (July 2, 2026) — https://eco.com/support/en/articles/15254024-tokenized-real-estate-2026-realt-lofty-propy-compared · https://www.lofty.ai/compare/realt-vs-roofstock
- US RWA tokenization $18B live — https://techbullion.com/real-world-asset-tokenization-in-america-in-2026-18b-live-and-the-issuers-categories-and-rules-driving-it/
- Country guide to buying property with crypto — https://www.astons.com/blog/buying-real-estate-with-cryptocurrency-how-and-where-to-do/ · broker acceptance — https://aurpay.net/aurspace/real-estate-brokers-accept-crypto-payments-2026/

**Regulation**
- FinCEN Residential Real Estate Report, effective March 1, 2026 — https://www.fennemorelaw.com/new-fincen-rule-requires-reporting-of-certain-residential-real-estate-transactions-as-of-march-1-2026/ · delay from Dec 1, 2025 — https://www.hklaw.com/en/insights/publications/2025/10/fincen-delays-residential-real-estate-transfer-reporting-rule · implementation guidance — https://www.nelsonmullins.com/insights/alerts/nelson-mullins-affordable-housing-news/all/fincen-issues-implementation-guidance-for-the-residential-real-estate-reporting-rule-requiring-reporting-for-certain-all-cash-residential-real-estate-transactions
- GENIUS Act stablecoin framework (2025) — https://aurpay.net/aurspace/real-estate-brokers-accept-crypto-payments-2026/
- Canadian specifics (CSA-approved USDC, FINTRAC MSB, CSA SN 46-308, AB lawyer trust rules) — see [FEASIBILITY.md §5](../FEASIBILITY.md)

**X Layer / OKX**
- BuildX AI Season rules — https://web3.okx.com/xlayer/build-x-hackathon
- Circle native USDC + CCTP live on X Layer (Aug 2026) — https://coinlaw.io/circle-usdc-cctp-x-layer/ · https://www.hokanews.com/2026/08/circle-launches-native-usdc-on-okxs-x.html
- X Layer chain settings / RPC / bridge — https://thirdweb.com/x-layer · OKB & X Layer — https://www.okx.com/en-us/learn/which-chain-is-okb-on · bridging guide — https://www.datawallet.com/crypto/bridge-to-x-layer
- Gasless USDT/USDC on X Layer via x402 — https://onekey.so/blog/ecosystem/okx-wallet-now-supports-0-gas-usdt-and-usdc-transfers-on-x-layer/
- OKX Agent Payments Protocol v1.0 whitepaper (April 2026) — https://web3.okx.com/whitepaper/okx-app-whitepaper.pdf · coverage — https://www.theblock.co/post/399490/okx-agent-payments-protocol-ai-business-cycles-quotes-disputes-transactions

---

*Negative findings are stated as plainly as positive ones — house style. Where this document and [FEASIBILITY.md](../FEASIBILITY.md) overlap, FEASIBILITY.md is the deeper source on Alberta construction and the crypto rails; this document is the source on market structure and the buy flow.*
