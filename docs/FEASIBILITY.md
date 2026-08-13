# Aura Homes — Feasibility Study

> [!CAUTION]
> **Archived research snapshot (August 9, 2026).** Preserve this document for
> provenance, but do not use its product, financing, provider, TVL, fee, or
> deployment claims as current guidance. Aura no longer positions escrow as
> its primary product. External finance education now lives on
> `/how-crypto-works` with dated official links; assets, rates, eligibility,
> custody, liquidation, and fees must be rechecked at the time of use.

**AI-designed, off-grid, SIP-built eco homes in Alberta, funded end-to-end in USDC on X Layer.**
Prepared August 9, 2026 · A KR8TIV AI product · Research basis: 11-domain deep sweep (~300 sources), OKX BuildX AI Season hackathon intelligence, live Alberta market data.

---

## 1. Executive verdict

**The product is feasible. The hackathon entry is strong. The literal one-click house is not a thing anyone can build — and that's fine, because the thing we CAN build is better and nobody else has built it.**

After aggressive searching: **no platform anywhere combines AI home design + crypto payment rails + off-grid eco construction fulfillment.** The fragments all exist separately — AI floor-plan generators, builders who take bitcoin through a payment processor, crypto title/escrow companies — but the orchestration layer is unclaimed. That's the product: **one-click design-to-contract.** A buyer answers a questionnaire; the AI architect designs a real, buildable SIP home against Alberta's actual code constraints; the platform prices it from live Alberta supplier data (no middlemen, in-province first); the buyer funds it in USDC into a milestone escrow on X Layer that models Alberta's statutory 10% construction holdback; the build record lives on-chain as an RWA. Land, permits, engineer-stamped trusses, and 6–12 months of construction remain irreducibly physical — the platform doesn't pretend otherwise, it *orchestrates* them.

Three founder assumptions did not survive contact with reality, and the design routes around each one:

| Assumption | Reality | The route around it |
|---|---|---|
| AWG (atmospheric water) as the water plan | Physics kills it in Alberta: every condenser AWG cuts off ~15°C/30% RH; Edmonton is below 15°C outdoors 7–8 months; outdoor winter output is **zero**, and indoors it just re-drinks the house's own shower steam at 1.5–5 kWh/L in the worst solar month | Cistern + licensed hauling (1.5–3¢/L) or well ($10–18K) as primary; AWG ships as an honest **summer drinking-water module** (10–20 L/day Jun–Sep) and a roadmap bet on future cold-climate tech |
| Wealthsimple crypto loans | **False.** Wealthsimple has no crypto-collateral product (margin is stocks/ETFs only) | Aave V3 is live **on X Layer itself** (~$85M TVL) for borrowing against crypto; Ledn (Toronto) for BTC-backed loans disbursed in USDC/CAD; Wealthsimple still matters as the 0%-fee USDC on-ramp |
| "Withdraw from OKX to X Layer" | OKX exchange exited Canada June 2023 and hasn't returned | Wealthsimple/Kraken/Coinbase → withdraw USDC on Base → Circle CCTP bridge to X Layer (native USDC launched on X Layer **August 6, 2026** — three days ago) |

**Hackathon odds, honestly:** the "up to $300K" is 83% performance-gated marketing. The judged pool is 30K/15K/5K USDT, plus a 50K AI-RWA liquidity grant decided holistically by the organizer. Field size at the comparable ETHCC event was 53 approved projects for ~1-in-26 odds at a top-2 prize. Our entry raises those odds materially: perfect AI-RWA track fit (a home build IS a real-world asset), native-USDC timing, OKX Agent Payments Protocol narrative fit, a real jurisdiction playbook no other team will have, and a working escrow on testnet. Realistic assessment: **top-3 is genuinely achievable with a shipped, working demo; the AI-RWA grant is a live shot precisely because the track is undefined and most teams will chase generic DeFi.** A win is not promised — execution in the next 12 days decides it.

---

## 2. The hackathon (verified facts)

- **BuildX AI Season Hackathon** — X Layer (OKX). Aug 7–21, 2026, submissions close **Aug 21, 23:59 UTC** via Google Form. Announcement: [@XLayerOfficial](https://x.com/XLayerOfficial/status/2085742815947157765) · Rules: [web3.okx.com/xlayer/build-x-hackathon](https://web3.okx.com/xlayer/build-x-hackathon)
- Prizes: 1st 30K / 2nd 15K / 3rd 5K USDT judged; 50K USDT Liquidity Grant for the top AI-RWA project (holistic, no published metric); up to 200K Launch Grant at 50K per 10M USDT of OKX-DEX volume by Aug 31 — **not chasable** for an indie build (and wash trading disqualifies).
- Judging criteria (verbatim): *application of AI, innovation, product completeness, user value, integration with X Layer, growth potential, contribution to the X Layer ecosystem.*
- Hard requirements: AI in the product; deploy on X Layer **testnet during** the hackathon, mainnet after; **dedicated active X account**; submission post tagging @XLayerOfficial; KYC for payout.
- Chain facts: mainnet chain ID **196**, testnet **1952** (post-Terigon — verify `eth_chainId` before deploying; legacy docs say 195), gas token OKB, EVM-equivalent (Hardhat/Foundry work unmodified), faucet ~0.2 OKB/day at web3.okx.com/xlayer/faucet — **claim from day one**.
- **Native Circle USDC launched on X Layer Aug 6, 2026**: mainnet `0xB6CEceAB302E2E4948951eE7843FC24E92933061`, testnet `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`. Never touch bridged USDC.e — three USDC variants circulate and pointing at the wrong one strands funds.
- What has won OKX hackathons: deep OKX-stack integration (OKX DEX API, X Layer, agent payments). OKX staff have said they are "not looking for another chatbot." OKX launched its **Agent Payments Protocol (APP)** April 30, 2026 — an x402-family standard with quotes, escrow, metering, dispute resolution, settling on X Layer. An AI agent that *orchestrates real-world construction payments* is squarely the narrative OKX is funding.

## 3. What Aura Homes is

**The pitch in one line:** *An AI architect that takes you from "I want an off-grid eco home in Alberta" to a designed, priced, escrow-funded build — in USDC, on X Layer, with every supplier local and every milestone on-chain.*

The pipeline (each stage thin but real in the MVP):

0. **LAND** — parcel discovery with suitability filters that would each save a buyer from a five-figure mistake: district minimum-dwelling-size check (the 592 vs 1,076 sqft trap), aquifer reliability (Lac Ste. Anne's is famously unreliable — cistern country), FortisAlberta line proximity (grid-optional feasibility), septic soil suitability. Then the acquisition path: USDC → CAD via a registered exchange → crypto-fluent Alberta professionals (Greater Property Group closed an $800K-BTC Calgary purchase; McLeod Law takes crypto) → title. The app orchestrates; licensed humans close.
1. **DESIGN** — questionnaire (size, style, energy, water, extras) → AI architect (Claude + a parametric catalog of SIP-buildable forms) produces a design brief, floor plan, 3D massing, and a code-constraint report (Part 9, zone 7A, district minimum dwelling size, FDWR glazing ratio). Output is honestly labeled a **review-ready design package** — an Alberta residential designer finishes it into the permit set (no architect needed: 1–4 unit dwellings are exempt under the Architects Act).
2. **BUDGET** — live line-item budget from `data/alberta/cost-model.json` (researched LOW/MID/HIGH, Alberta-first suppliers, no-middlemen principle). Reference: 800 sqft off-grid SIP home, **~$199K/$301K/$444K ex-land; ~$274K/$451K/$794K with land** (computed from the line-item model — see §6). Owner-builder path saves 30–40% vs a conventional builder.
3. **ESCROW** — buyer bridges USDC to X Layer (CCTP), funds `AuraBuildEscrow`: milestone-based, 2-of-3 release (homeowner/builder/arbiter), **statutory 10% Alberta holdback modeled in the contract** — to our knowledge, the first construction escrow that speaks Alberta's Prompt Payment and Construction Lien Act.
4. **BUILD** — the platform orchestrates the checklist: county development permit → Owner Builder Authorization ($750) → building + trade permits (homeowner may pull own electrical/plumbing/gas on their own residence — Leduc County confirms in writing) → SIP kit order (12–20 week lead) → screw piles → shell in days with a 2–3 person crew → certified-installer septic → solar → WETT-inspected wood stove → wood-fired hot tub on a sub-24"-height deck (no permit needed). Each completed milestone updates the on-chain `AuraBuildRegistry` record — the RWA is the build itself.

**Who it's for:** normies, not crypto nerds. Wallet complexity is hidden (account abstraction on the roadmap); prices shown in CAD with USDC settlement; "ridiculously affordable" usage fee via x402-style micropayments so the platform earns pennies per design run, not commissions.

## 4. Technical feasibility by subsystem

### 4.1 AI architect — feasible with honest labeling
No tool on earth programmatically emits permit-ready NBC Part 9 construction documents (Canada's own government treats automated Part 9 *checking* as an open research problem). What IS buildable today: parametric generation of buildable small-home designs (geometry, room program, IFC/DXF export, energy pre-check, in-browser 3D) using the **$0 open-source stack** — IfcOpenShell + Bonsai for IFC authoring, Ladybug/Honeybee for daylight/thermal, That Open Company (ex-IFC.js) for the web viewer — with Claude as the reasoning layer that turns questionnaire answers into constraint-checked design briefs. Alberta makes the human loop cheap: no architect required, truss engineering arrives stamped from the truss manufacturer, and a residential designer finishes the permit set for $1.2–2.7K. Hypar (~US$25/mo, real public API) is the commercial upgrade path; Maket.ai (Montreal) has no public API; Higharc is enterprise-only proof that auto-CDs are possible. Energy compliance runs through NRCan's free HOT2000 (the actual Alberta 9.36 tool), not OpenStudio.

### 4.2 SIP construction — feasible, in-province, code-recognized
Alberta has real SIP supply: Insulspan (Calgary, **CCMC 13016-R listed** — the painless permit path), EnerSmart (Cochrane/Claresholm), Premier SIPS (Calgary). A CCMC-listed system is recognized for Part 9 without an alternative-solutions fight; anything off-list needs a P.Eng stamp. The "small crew, few days" shell claim is documented and true **for small-format panels** (4x8 ≈ 100 lb, hand-settable; jumbo 8x24 ≈ 800 lb needs a telehandler). Design constraints that must live in the AI's rules: electrical chases frozen at fabrication, no plumbing in exterior SIP walls, continuous joint sealant + interior seam tape + vented over-roof (the Juneau ridge-rot lesson), drywall still required inside (fire code), HRV effectively mandatory. Real schedule driver: **12–20 weeks from approved drawings to panel delivery.**

### 4.3 Energy — feasible as solar + storage + backup + wood, not solar-alone
Edmonton December yields ~1.3 kWh/kW/day (a 70–77% winter collapse). Honest off-grid design: 8–12 kW ground-mount array at latitude tilt, 20–40 kWh LiFePO4, auto-start generator ($35–70K all-in), wood stove primary heat (Drolet Escape 1200 class, ~$2.5–4K installed + WETT inspection for insurance), propane for water heating. Fully off-grid dwellings are legal in every Alberta county; solar/battery wiring legally requires a licensed electrical contractor (CEC s.64 — no homeowner permit for PV). Grid-optional is real via the Micro-generation Regulation *if* a line passes the property — run the FortisAlberta Service Estimator **before** buying land.

### 4.4 Water — cistern/well primary; AWG demoted to honest supplement
Full physics case in §1. The platform's water module defaults to buried cistern ($8–15K + ~$200–350/mo hauled) or well ($10–18K where the aquifer cooperates — Lac Ste. Anne groundwater is famously hit-and-miss, which is why locals run cisterns), with an AWG unit **standard on every Aura home** (founder mandate) — plumbed into the cistern loop, honestly labeled as the summer producer (10–20 L/day Jun–Sep, dormant in deep winter). No Canadian standard recognizes AWG as a potable source (the IAPMO/SCC effort died in 2022), so lenders and development permits will demand the cistern anyway. Selling AWG as the hero would be dishonest and judges/users would eventually find out; selling it as the "summer glacier tap" garnish is charming and true.

### 4.5 Wastewater — feasible with an eco headline option
Alberta's Private Sewage Standard of Practice 2021 gives a menu: conventional septic ($10–25K), **Ecoflo peat/coco biofilter** (Premier Tech, NSF-certified, zero-energy — the genuinely eco choice, ~$8–10K unit + tanks/dispersal), sand filter, mound, subsurface drip of treated effluent (the one legal "reuse" path). Composting toilets do NOT eliminate septic for any plumbed dwelling (greywater is legally wastewater; a flush toilet is code-required where piped water exists) — they shrink the system, not remove it. Constructed wetlands are variance-only; surface greywater irrigation is prohibited. Certified installer legally required — this line is never DIY.

### 4.6 Lifestyle layer — feasible and photogenic
Wood-fired hot tubs are a Canadian strength: Backcountry Recreation (~$4K+), AlumiTubs (-44°C tested, $10–13.5K), Goodland (the design-tier flagship). No pumps or plumbing = nothing to winterize; the one liability scenario (fast fire in a frozen tub melts the firebox) ships as a winter protocol card. Decks under 24" height need no building permit. Big glass: over 22% window-to-wall kicks the design out of the prescriptive path into paid energy modeling — the AI enforces FDWR in the catalog and compensates with triple-pane (Lux Calgary / All Weather Edmonton / Duxton quint-pane for feature walls).

## 5. Crypto rails — feasible with the 2-hop truth told

**On-ramp — card-first (the way around the exchange gap):** the primary flow assumes the user has **no crypto at all**: pay by Visa/Mastercard, and an in-flow fiat on-ramp partner (MoonPay/Transak/Banxa/Onramper class) converts card CAD to USDC headed for the escrow — direct to X Layer where the partner supports it, else to Base with a Circle CCTP hop under the hood. No exchange account, OKX or otherwise, is ever required. Crypto-natives take the second door: Wealthsimple sells USDC at 0% trading fee (its only free pair) → withdraw on Base → CCTP to X Layer native USDC; Kraken (USDC/CAD spot, free Interac deposits) and Coinbase Canada are alternates. Account abstraction (Particle + Safe) collapses the remaining wallet friction on the roadmap.
**Escrow:** composed from audited primitives (OpenZeppelin SafeERC20/ReentrancyGuard, Safe-style 2-of-3), with Alberta's 10% statutory holdback and a holdback-release timer as first-class contract state. OKX APP integration for agent-metered payments is the ecosystem hook. A production deployment holding six figures needs its own audit (US$15–60K) — budgeted in the roadmap, not hand-waved.
**Off-ramp (paying Alberta suppliers/lawyers/sellers):** the last mile is CAD. Kraken USDC/CAD (~0.4% taker) → wire to lawyer's trust. Alberta lawyers cannot hold crypto in trust; the proven pattern (the $800K-BTC Calgary house) is convert-then-close, with McLeod Law (Calgary) and Greater Property Group as the crypto-fluent professionals. QCAD (TD-custodied CAD stablecoin, rolling out Q3–Q4 2026) is the future one-hop corridor.
**Lending:** Aave V3 on X Layer for crypto-collateral borrowing; Ledn for BTC-backed CAD/USDC disbursement. The app *teaches* these paths; it never gives financial advice.
**Regulatory honesty:** USDC is the **only** CSA-approved stablecoin in Canada (Circle's OSC undertaking) — our stablecoin choice is not just convenient, it's the compliant one. A production app that custodies or routes user funds is an MSB (FINTRAC registration, 8–16 weeks, free) — hackathon demo exempt, production roadmap line. Tokenizing fractional home ownership = securities distribution (CSA SN 46-308) — which is why the MVP's RWA is a **non-financial build record NFT**, not a fractional token. Every escrow milestone paid in crypto is a CRA barter disposition — the app's ledger exports the CAD fair-market-value bookkeeping automatically (turning a tax nuisance into a feature).

## 6. Economics

Reference build (800 sqft off-grid SIP, Edmonton ring):

| Line | LOW | MID | HIGH |
|---|---|---|---|
| Land (1–5 ac, Lac Ste. Anne → Leduc) | $75K | $150K | $350K |
| Site + screw piles | $10.5K | $18K | $27K |
| SIP shell kit + erection | $30K | $45K | $55K |
| Roof, triple-pane windows, doors, siding | $22K | $32K | $45K |
| Interior fit-out | $22K | $35K | $55K |
| Mechanical (HRV, plumb, elec, stove+WETT) | $22K | $30K | $40K |
| Off-grid solar + battery + generator | $35K | $48K | $70K |
| Water (cistern or well) | $8K | $12K | $18K |
| AWG summer water module (standard) | $3.5K | $5K | $8K |
| Septic / Ecoflo | $12K | $18K | $28K |
| Hot tub + deck | $8K | $14K | $22K |
| Permits, design, engineering, insurance | $8K | $12K | $18K |
| Contingency 10/12/15% | ~$18.1K | ~$32.3K | ~$57.9K |
| **Total ex-land** (computed: Σ lines × contingency) | **~$199K** | **~$301K** | **~$444K** |
| **Total with land** | **~$274K** | **~$451K** | **~$794K** |

*Totals are computed from the line items above (every line included — the AWG module is standard on every home, no line is optional) — the machine-readable model in [data/alberta/cost-model.json](../data/alberta/cost-model.json) carries the same rule, so the app, the docs, and a judge's calculator always agree. The original research sweep's rounded envelope ($185–465K ex-land) sits within these bands.*

A conventional builder delivers the same home at $450–650K ex-land — the owner-builder path Aura orchestrates saves $150–250K in exchange for 12–24 months of sweat. Platform revenue: x402-style micro-fees on design runs + flat "ridiculously affordable" package fees in USDC. Deliberately no commission on materials — the no-middlemen principle is the brand.

**Financing reality:** banks generally won't mortgage off-grid owner-built sub-1,000-sqft homes. The honest financing story is cash/progress-draw + crypto-collateral borrowing (Aave/Ledn) — which is exactly why a crypto-native buyer is the right first customer. The Owner Builder no-warranty path freezes resale for 10 years (title caveat) — disclosed in-app.

## 7. What we do NOT build (integrate instead)

Prefab manufacturing (partner: Alberta SIP plants; Honomobo exists in Edmonton as a modular comparable), title/closing (Propy owns it), AI floor-plan generation from scratch (commodity — we orchestrate constraint-checking, not pixel invention), crypto payment processing basics (Circle CCTP), well drilling/septic/solar install (licensed local trades — the directory IS the product). Atmos ($20M raised, Sam Altman cap table, dead March 2025) is the cautionary tale for pretending to be the builder: **we are the orchestration layer, never the general contractor.**

## 8. Risks — and the route through each

| Risk | Severity | Route through |
|---|---|---|
| 12 days to deadline | High | Thin-slice every stage; escrow + registry on testnet is the non-negotiable core; catalog of 3 homes, not infinite design |
| District minimum-dwelling-size rules kill small homes on some parcels | Medium | The AI checks the district table BEFORE design (Lac Ste. Anne Ag = 592 sqft OK; its CR district = 1,076 sqft min) — this check is itself a demo wow-moment |
| SIP lead time 12–20 wks vs "instant" narrative | Low (hackathon) | Sell design-to-contract speed, not build speed; timeline honesty in-app |
| Escrow legal exposure (MSB, securities) | Medium | Testnet demo now; FINTRAC MSB registration + contract audit on production roadmap; build-record NFT stays non-financial |
| Token temptation | Medium | No token for the hackathon (wash-trading DQ risk, securities risk, zero time); researched launch path documented separately in TOKEN-RESEARCH.md for a post-hackathon decision |
| Judges reject "another RWA pitch" | Medium | Differentiator is the working Alberta playbook: real counties, real suppliers, real holdback law in the contract — no other team will have this |

## 9. The 12-day sprint (Aug 9 → Aug 21)

- **D1–2**: contracts final + tested; deploy to testnet 1952; claim faucet OKB daily from day one; create @AuraHomes_fun X account (canonical handle per [SUBMISSION.md](SUBMISSION.md); fallbacks @AuraHomesHQ / @BuildAuraHomes); first build-in-public post tagging progress.
- **D3–5**: app pipeline demo — questionnaire → design brief (Claude) → 3-home catalog with 3D massing → live budget from cost-model.json.
- **D6–8**: escrow UI wired to testnet (fund → milestone approve → release with 10% holdback visibly retained → holdback timer); AuraBuildRegistry NFT minted per build; OKX APP/x402 usage-fee demo on the design endpoint.
- **D9–10**: polish to Tesla-grade; hosted deploy; 90-second demo video (every figure captured live).
- **D11**: mainnet deploy of contracts (small OKB gas spend); submission form + X post; buffer day.
- **D12**: buffer for the unknown-unknowns. Ship early, not at 23:58 UTC.

Matt-only actions: create the X account, KYC when prizes call, submit the Google Form, post the submission tweet. Everything else is AI-executable.

## 10. Post-hackathon roadmap (the real company)

Phase 2 (Sep–Dec 2026): FINTRAC MSB registration, contract audit, one real pilot build on a Lac Ste. Anne parcel documented publicly end-to-end, designer/engineer partner network, fiat on-ramp partner, account abstraction (invisible wallets). Phase 3 (2027): QCAD corridor when TD custody ships, token decision per TOKEN-RESEARCH.md (if yes: usage-burn model, invisible to users, funding-only), BC/Saskatchewan expansion packs, and the thing this was always about: **making eco homes so easy to commission that people actually build them.**

---

*Every claim above traces to the research corpus (300+ sources) gathered Aug 8–9, 2026. Negative findings are stated as plainly as positive ones — that's the house style. Anything is possible; some things just have to be built in the right order.*
