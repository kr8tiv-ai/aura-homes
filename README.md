<div align="center">

<img src="assets/hero.png" alt="Aura Homes — AI-designed off-grid eco homes, funded in USDC on X Layer" width="100%">

### From USDC on X Layer to the keys of an off-grid eco home.

**Aura Homes is an AI agent that orchestrates the entire journey — find the land, design the home, price it from real local suppliers, fund it in escrow, build it with local trades — with no middlemen, no black boxes, and nothing hidden.** Alberta pilot. Open source from the first commit.

[![Hackathon](https://img.shields.io/badge/OKX_BuildX-AI_Season_2026-34d399?style=flat-square&labelColor=050807)](https://web3.okx.com/xlayer/build-x-hackathon)
[![Track](https://img.shields.io/badge/track-AI--RWA-8b5cf6?style=flat-square&labelColor=050807)](docs/FEASIBILITY.md#2-the-hackathon-verified-facts)
[![X Layer](https://img.shields.io/badge/X_Layer-testnet_1952_·_mainnet_196-2dd4bf?style=flat-square&labelColor=050807)](https://web3.okx.com/xlayer)
[![USDC](https://img.shields.io/badge/settles_in-native_USDC-2775CA?style=flat-square&labelColor=050807)](docs/FEASIBILITY.md#5-crypto-rails--feasible-with-the-2-hop-truth-told)
[![License](https://img.shields.io/badge/license-MIT-e7ece9?style=flat-square&labelColor=050807)](LICENSE)
[![Made in](https://img.shields.io/badge/pilot-Alberta,_Canada-a3e635?style=flat-square&labelColor=050807)](docs/ALBERTA-PLAYBOOK.md)

[The vision](docs/VISION.md) · [Feasibility study](docs/FEASIBILITY.md) · [Architecture](docs/ARCHITECTURE.md) · [Roadmap](docs/ROADMAP.md) · [Hackathon submission](docs/SUBMISSION.md) · [Continue this with any AI](docs/AI-HANDOFF.md)

<sub>A **KR8TIV AI** product · sibling of Aura-H2O, Aura-Farms, and AuraBNB</sub>

</div>

---

## The idea, said plainly

Building an eco home today means being your own general contractor across twenty industries that don't talk to each other: land agents, county planners, designers, engineers, panel plants, solar installers, septic designers, water haulers, WETT inspectors, lawyers. Every gap between them costs money and kills dreams. Meanwhile "AI + real estate" produces chatbots, and "crypto + real estate" produces tokens of houses nobody builds.

**Aura Homes is the orchestration layer that was missing.** One agent process:

```
LAND ──▶ DESIGN ──▶ BUDGET ──▶ ESCROW ──▶ BUILD
```

1. **LAND** — the agent finds and filters parcels against the things that actually kill small-home builds: district minimum-dwelling-size bylaws, aquifer reliability, power-line distance, septic soils. Then it walks the acquisition with crypto-fluent, licensed Alberta professionals. USDC in, title out.
2. **DESIGN** — an AI architect turns a questionnaire into a **review-ready design package** for a SIP-built small home: floor plan, 3D massing, energy pre-check, and a code-constraint report (NBC Part 9, climate zone 7A, glazing ratios). In Alberta no architect stamp is needed for a house — a local designer finishes the permit set, truss engineering ships stamped from the truss plant. Honest labels only: we say *review-ready*, because "AI permit-ready drawings" don't exist anywhere and we won't pretend.
3. **BUDGET** — a live line-item budget built from researched Alberta data ([data/alberta](data/alberta/)) — every line has an in-province supplier and a LOW/MID/HIGH range. Reference build: 800 sqft off-grid SIP home, **~$296K CAD mid-range ex-land** (computed line-by-line, LOW ~$195K / HIGH ~$435K) — 30–40% under a conventional builder, because the owner-builder path is a first-class citizen here.
4. **ESCROW** — the buyer funds milestones in **native USDC on X Layer** into [`AuraBuildEscrow`](contracts/): 2-of-3 release (homeowner / builder / arbiter), and — to our knowledge a first — **Alberta's statutory 10% construction holdback modeled directly in the contract**. Every build mints a record in [`AuraBuildRegistry`](contracts/) — the real-world asset is the build itself, on-chain from day one.
5. **BUILD** — orchestrated permits (the app knows which county lets homeowners pull their own trade permits — Leduc County does), contractor sourcing from the open supplier directory, SIP shell up in days with a small crew, solar + battery + wood stove, certified-installer septic, cistern or well — and yes, **every home ships with a wood-fired hot tub and a beautiful deck**, because these homes are meant to be wanted, not endured.

Off-grid everything, grid-optional forever. Solar with honest winter math. Wood heat with WETT inspection. Eco septic (Ecoflo biofilter) where soils allow. Atmospheric water generation exactly where physics permits it — as a summer drinking-water module, while the cistern does the real work. The feasibility study tells the truth about every one of these tradeoffs: **[docs/FEASIBILITY.md](docs/FEASIBILITY.md)**.

## Why this doesn't exist yet

After a 300-source research sweep: **nobody combines AI home design + crypto rails + off-grid eco fulfillment.** Propy closes sales of existing homes. RealT and Lofty fractionalize rentals. Higharc sells to production builders. Welcome Homes is US-only and fiat-only. Atmos raised $20M for "design online, we build it" and died in 2025. The unclaimed ground is the *agent that orchestrates the physical world* — and agent-payments infrastructure (native USDC on X Layer, launched **August 6, 2026**; OKX's Agent Payments Protocol, April 2026) just made it buildable. Full competitive teardown in the [feasibility study](docs/FEASIBILITY.md#7-what-we-do-not-build-integrate-instead).

## The hackathon

This repo is Aura Homes' entry in the **[OKX BuildX AI Season Hackathon](https://web3.okx.com/xlayer/build-x-hackathon)** (Aug 7–21, 2026) — AI-powered onchain applications on X Layer, up to 300K USDT, AI-RWA track. Contracts deploy to X Layer testnet (chain 1952) during the event and mainnet (chain 196) after. Submission package, demo script, and the judge-facing pitch live in **[docs/SUBMISSION.md](docs/SUBMISSION.md)**.

## Repo map

| Path | What it is |
|---|---|
| [docs/VISION.md](docs/VISION.md) | The canonical brief — what we're building and why, audited against continuously |
| [docs/FEASIBILITY.md](docs/FEASIBILITY.md) | The full feasibility study: tech, law, money, honest red flags, hackathon odds |
| [docs/ALBERTA-PLAYBOOK.md](docs/ALBERTA-PLAYBOOK.md) | The regulatory + supplier playbook for the pilot province |
| [docs/TOKEN-RESEARCH.md](docs/TOKEN-RESEARCH.md) | Token launch research (verdict: not yet, and here's exactly when and how) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design: app, agent, contracts, chain config |
| [docs/ROADMAP.md](docs/ROADMAP.md) | The 12-day sprint and the five-year software |
| [docs/AI-HANDOFF.md](docs/AI-HANDOFF.md) | How any AI (or human) continues this work without losing the plot |
| [docs/AI-BRAIN.md](docs/AI-BRAIN.md) | The journey brain: AI-run management, slip-catching, email updates, cost-honest model tiers |
| [docs/GRAPH-ENGINEERING.md](docs/GRAPH-ENGINEERING.md) | The graph doctrine this project is built with — node contracts, verifiers, anchors |
| [docs/AUDIT-LOG.md](docs/AUDIT-LOG.md) | The standing vision-audit loop — every pass appended, nothing buried |
| [contracts/](contracts/) | `AuraBuildEscrow` (USDC milestones + 10% Alberta holdback) + `AuraBuildRegistry` (build-record NFT), Hardhat, tested |
| [app/](app/) | Next.js app — the five-stage pipeline UI, X Layer wallet flow |
| [agent/](agent/) | `aura-architect` — the AI design/budget/milestone pipeline (Claude-powered, offline-capable) |
| [data/alberta/](data/alberta/) | The researched cost model and no-middlemen supplier directory |

## Run it

```bash
git clone https://github.com/kr8tiv-ai/aura-homes.git && cd aura-homes
# the AI architect pipeline (no keys needed — offline fallback included)
cd agent && npm install && npm run build && npm run demo
# the contracts
cd ../contracts && npm install && npx hardhat test
# the app
cd ../app && npm install && npm run dev
```

## Contribute

This is deliberately the software that would otherwise take five years to exist. It gets built in the open, in slices, and it needs people: Solidity reviewers, Alberta designers and safety-codes brains, IFC/BIM engineers, off-grid installers who'll sanity-check numbers, and anyone who wants normal people to be able to build eco homes. Open an issue, pick a roadmap slice, or just correct our data — every claim in [data/alberta](data/alberta/) cites its basis and improvements are welcome.

## Honesty policy

No black boxes. Research that contradicted the founding assumptions is published, not buried — see the AWG physics, the Wealthsimple correction, and the "one-click house is marketing fiction" section of the [feasibility study](docs/FEASIBILITY.md). The product is stronger for it.

---

<div align="center">
<sub>Authored by <a href="https://github.com/Matt-Aurora-Ventures">Matt Aurora Ventures</a> · co-authored with Claude (Fable 5) · MIT · <b>A KR8TIV AI product</b></sub>
</div>
