# Hackathon Submission Package — BuildX AI Season 2026

*Everything pre-written so submission takes minutes, not hours. Deadline: **August 21, 2026, 23:59 UTC.** Submission = [the Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfgU_3zcXdxK0GJQxj33QeUWdEcAaYnieVe9p5cFDb2JFQa4Q/viewform) (also linked from the [hackathon page](https://web3.okx.com/xlayer/build-x-hackathon)) + an X post from the project account tagging @XLayerOfficial.*

## Checklist

**Matt-only (nobody else can do these):**
- [ ] **30 seconds: fund the testnet deployer.** Open [the faucet](https://web3.okx.com/xlayer/faucet/xlayerfaucet), paste `0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260`, Get 0.2 OKB, solve the captcha (it's CAPTCHA-gated — agents won't do captchas). Everything after that is one command — see [DEPLOYMENTS.md](DEPLOYMENTS.md).
- [ ] Create the dedicated X account — recommended handle **@AuraHomesAI** (fallbacks: @AuraHomesHQ, @BuildAuraHomes). Avatar: `assets/aura-homes-avatar.png`. Bio below.
- [ ] Post build-in-public updates every 1–2 days through Aug 21 (drafts below) — judges explicitly weigh an *active* account.
- [ ] Submit the Google Form (answers below) once the demo link is live.
- [ ] Post the submission tweet tagging @XLayerOfficial.
- [ ] KYC with OKX if/when prizes call.

**Build gates (AI-executable, from [ROADMAP.md](ROADMAP.md)):**
- [ ] Contracts deployed to **X Layer testnet (1952)** with verifiable tx links — required during the hackathon window; bridge/CCTP touchpoints included where the flow needs them.
- [ ] Web app hosted and public.
- [ ] 90-second demo video, every figure captured live.
- [ ] Mainnet deploy (contracts) before/at submission — "deploy independently on X Layer" box ticked on both networks.

## X account bio

> The AI agent that takes you from USDC on X Layer to the keys of an off-grid eco home. Land · design · budget · escrow · build. Alberta pilot. Open source (MIT). A KR8TIV AI product.

## Google Form answers (paste-ready)

**Project name:** Aura Homes

**One-liner:** An AI agent that orchestrates an entire eco-home build — find the land, design the home, price it from local suppliers, fund it in native-USDC milestone escrow on X Layer, build it with licensed local trades.

**Description (long):**
Aura Homes is the missing orchestration layer between "I want an eco home" and moving in. A buyer answers a questionnaire; the AI architect designs a buildable SIP (structural insulated panel) small home against the actual constraints of our pilot jurisdiction — Canada's NBC Part 9, climate zone 7A, county district bylaws, glazing ratios — and prices it line-by-line from a researched, open, Alberta-first supplier dataset with LOW/MID/HIGH honesty. The buyer funds the build in **native USDC on X Layer** (launched Aug 6, 2026 — we are among its first real-economy integrations) into AuraBuildEscrow: milestone-based, 2-of-3 release, and — to our knowledge the first construction escrow to model **Alberta's statutory 10% construction holdback on-chain**. Every build mints a record NFT in AuraBuildRegistry — the real-world asset is a real home coming into existence, verifiable on X Layer at every stage: Designed → Funded → UnderConstruction → Complete.

The AI is load-bearing, not garnish: it filters land parcels against the bylaw and groundwater traps that kill small builds, generates constraint-checked review-ready design packages an Alberta residential designer can finish into a permit set (no architect is required for houses in Alberta — we researched the entire professional-stamp map), sizes off-grid solar against Edmonton's real December yield, and produces the milestone schedule the escrow enforces. Platform usage is metered with x402-family agent micropayments — the fee is deliberately tiny because the mission is more eco homes, not margin.

Everything is open source (MIT) from the first commit, including the research that contradicted our own founding assumptions — published, not buried. The repo contains a full feasibility study, the Alberta regulatory playbook, the open supplier directory, and an AI-handoff document so the project compounds.

**Track:** AI-RWA.

**Why AI-RWA:** the RWA here is not a wrapper token on someone else's house — it's the on-chain record and funding rail of a physical asset being created, with the escrow speaking the actual construction law of its jurisdiction. AI designs the asset, prices the asset, schedules the asset, and meters its own services in USDC.

**X Layer integration:** native USDC escrow + registry contracts on testnet 1952 and mainnet 196; Circle CCTP on-ramp path documented for Canadian users (Wealthsimple/Kraken/Coinbase → Base → X Layer); x402/OKX Agent Payments Protocol metering on agent endpoints; account abstraction roadmap on X Layer's documented Particle + Safe stack.

**Links:** GitHub: https://github.com/kr8tiv-ai/aura-homes · Demo: **https://kr8tiv-ai.github.io/aura-homes/** (live) · Video: (link) · X: (handle) · Contracts: (OKLink tx links — pending faucet)

**Team:** Matt Aurora Ventures (KR8TIV AI) — solo founder building with AI agents, in the open.

## Submission tweet (draft)

> From USDC on X Layer to the keys of an off-grid eco home.
>
> Aura Homes: an AI agent that finds the land, designs the home, prices it from real local suppliers, and funds the build in native-USDC milestone escrow — with our province's construction holdback law modeled on-chain.
>
> Live demo + fully open source: [link]
>
> Built for the BuildX AI Season @XLayerOfficial #XLayer

## Build-in-public post drafts

1. "Day 1. We deep-researched 300+ sources on what it actually takes to build an off-grid eco home in Alberta — permits, panels, solar physics, septic law, crypto rails. Publishing all of it open source. The gaps we found are the product."
2. "The first construction escrow that speaks Alberta law: our X Layer contract retains the statutory 10% holdback on every milestone, on-chain. Tx: [link]"
3. "Our AI just rejected a parcel: the district bylaw demands 1,076 sqft minimum and the design was 800. That check costs nothing in our app. Finding out after buying the land costs you the land."
4. "Native USDC landed on X Layer 72 hours before we started building on it. Timing is a feature."
5. "Honesty corner: atmospheric water generators produce ZERO litres outdoors in an Alberta winter. Physics. Ours ship as a summer module while the cistern does the real work — and we published the math."

## 90-second demo script

0–10s: the one-liner over the hero. 10–25s: LAND — filter parcels, watch the district-minimum check kill a bad one. 25–45s: DESIGN + BUDGET — questionnaire → AI design brief → 3D massing → live LOW/MID/HIGH Alberta budget. 45–70s: ESCROW — fund milestones in USDC on testnet, release one, watch 10% holdback retained with a timer, registry NFT status flips to UnderConstruction (live OKLink). 70–90s: the roadmap line — "the software that would exist in five years, built in the open, starting in Alberta" — repo URL + MIT.

## Judge-facing "why this wins" (for the form's open field, if present)

Judged criteria are AI application, innovation, completeness, user value, X Layer integration, growth potential, ecosystem contribution. Aura Homes is the only entry category that *creates* RWAs rather than wrapping them; it integrates X Layer's newest primitive (native USDC, 3 days old at kickoff) plus the agent-payment rails OKX itself is championing; and it arrives with something no 13-day hackathon team has ever brought — a complete, published, honest regulatory and supplier playbook for a real jurisdiction, so "growth potential" is a documented expansion path (new province = new data pack), not a slide.
