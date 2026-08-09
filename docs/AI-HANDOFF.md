# AI Handoff — how to continue this work

*Written by Claude (Fable 5) for whichever AI — or human — picks this up next. Read this first; it will save you from re-deriving two days of research or, worse, contradicting it.*

## Ground rules

1. **[VISION.md](VISION.md) is the brief.** Audit your own output against it. If your work drifts from the vision, your work is wrong. If the vision collides with verified reality, don't silently comply OR silently ignore — record the collision honestly in FEASIBILITY.md the way the AWG and Wealthsimple corrections are recorded, and route around it.
2. **Never un-learn the corrections.** These were expensively verified; do not "helpfully" reintroduce them:
   - AWG is **standard on every Aura home** (founder mandate) but never the primary water plan — it's the summer producer plumbed into the cistern loop (physics: condenser cutoff ~15°C/30% RH; outdoor winter output is zero).
   - Wealthsimple has NO crypto-backed loans (re-verified Aug 2026: its portfolio line of credit is securities-only). Aave V3 on X Layer and Ledn are the real lending answers; integrate Wealthsimple the day they ship crypto collateral.
   - OKX exchange is unavailable to Canadians — and the product answer is **card-first**: an in-flow fiat on-ramp (MoonPay/Transak class) sells USDC to Visa payers so users never need any exchange. Crypto-natives: Wealthsimple/Kraken/Coinbase → Base → CCTP.
   - Native USDC only: mainnet `0xB6CEceAB302E2E4948951eE7843FC24E92933061`, testnet `0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3`. Never USDC.e.
   - Testnet chain ID is **1952** (legacy docs say 195). Verify `eth_chainId` before deploying.
   - No architect needed for Alberta houses; trusses need P.Eng (via the truss plant); septic and solar wiring are licensed work; drywall goes over interior SIP faces regardless.
   - "Permit-ready AI drawings" don't exist anywhere — we say **review-ready design package**. Judges and building officials both punish the inflated claim.
   - No fractional-ownership token to Canadians without securities counsel (CSA SN 46-308). The registry NFT stays non-financial.
   - District (not county) bylaws set minimum dwelling size — check the parcel's district table first, always.
3. **Honesty is the brand.** Negative findings get published. If you can't verify a number, label it. LOW/MID/HIGH, never single-point fantasy prices.
4. **Alberta-first sourcing, no middlemen.** New suppliers enter [data/alberta/suppliers.json](../data/alberta/suppliers.json) with a basis; in-province first, out-of-province only when Alberta has no supply.
5. **Keep it normie-usable.** Every crypto concept added to the UI must come with the progressive-disclosure question answered: what does the person who has never held a wallet see?
6. **Attribution:** commits are authored by `Matt-Aurora-Ventures <lucidbloks@gmail.com>` with `Co-Authored-By: Claude <noreply@anthropic.com>`. MIT. Open source from the first commit — no black boxes.
7. **The brand ground is LIGHT — canonical since Aug 9, 2026.** The founder's standing direction: clean white/paper marketing and product surfaces ("consumers don't like dark"), per BRAND.md v3 — paper `#fafaf9` ground, ink type, emerald accent (AA-dark variants for text), the aurora surviving only inside the mark and framed media. The earlier dark system is NOT the default anywhere; do not "restore" it. The mark has a light-native variant for light grounds; the dark chip survives only as favicon/avatar. The 3D story site + full dashboard at aurahomes.fun IS the canonical product experience — the app is primary, the process overview secondary.
8. **Work as a graph.** [GRAPH-ENGINEERING.md](GRAPH-ENGINEERING.md) is standing doctrine: node contracts with enforced schemas, the fake-edge test before sequencing anything, fresh-context verifiers that never share the worker's chat, fan-in guards, and the frozen anchors (tests that ran, builds that passed, totals that reconcile, chain state read live). Run the anchors before claiming done.

## State of the work (as of Aug 9, 2026)

- Research corpus: 11-domain sweep + token-launch research, distilled into FEASIBILITY.md, ALBERTA-PLAYBOOK.md, TOKEN-RESEARCH.md, and data/alberta/*.json. Trust these; re-verify only time-sensitive facts (prices, program dates).
- Contracts, app, agent: scaffolded (see each package's README). Contracts carry the Alberta 10% holdback — that feature is a differentiator, keep it.
- Brand: the aura family mark refilled with aurora-over-treeline (Banff energy), assets in [assets/](../assets/). Design bar: Tesla/Apple-grade restraint. No AI slop, no crypto-glow.
- Hackathon: submission package in [SUBMISSION.md](SUBMISSION.md); deadline **Aug 21, 2026, 23:59 UTC**.

## The work queue (in order)

1. Whatever [ROADMAP.md](ROADMAP.md) Phase 0 says is next by date — the sprint table is the plan.
2. Testnet deployment + a daily OKB faucet claim if not yet automated.
3. The demo video script in SUBMISSION.md — capture real figures, 90 seconds max.
4. After the hackathon: Phase 1 top-to-bottom.

## How to work

Small verified slices; run the tests (`contracts`: `npx hardhat test`; `agent`: `npm run build && npm run demo`; `app`: `npm run build`). Before claiming anything is done, run it and look at the output — tool success is not verification. When you finish a session of material work, append a dated bullet to the founder's log per his standing protocol.
