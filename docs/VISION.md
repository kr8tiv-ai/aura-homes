# The Vision — canonical brief

*This is the founder's vision, distilled. Every design decision, doc, and line of code gets audited against this file. If work drifts from this brief, the work is wrong, not the brief — unless the brief collides with verified reality, in which case FEASIBILITY.md records the honest collision and the route around it.*

## The one-sentence product

**A perfect agent process for going from USDC on X Layer to a finished off-grid eco home in Alberta — land, design, budget, permits, professionals, materials, and construction, orchestrated end-to-end by AI, with no middlemen and nothing hidden.**

## The founder's requirements (complete list)

1. **Eco-home construction AI, ground to finish** — an app that takes someone from nothing to a completed small eco home. Not tiny homes necessarily; smaller architectural homes. Stunning. Sexy. Architectural glass where the design earns it.
2. **SIP construction** — structural insulated panels as the build system.
3. **Crypto-native funding** — USDC on X Layer pays for everything: planning, architecture, land acquisition, materials, professionals, permits. Bridges wherever needed. If loans are needed, the app teaches the user how to source crypto-backed lending. *(Research correction: Wealthsimple has no crypto loans — Aave V3 on X Layer and Ledn are the real paths; the app teaches those.)*
4. **LAND as a first-class step** — find the land, filter it for what the build needs (district minimum dwelling size, aquifer reliability, power-line proximity, septic suitability), then acquire it — USDC in, title out.
5. **The AI is the architect** — an AI design process produces the home design; existing eco-home designs can be adapted; third-party software integrated where necessary and paid for in USDC (x402/agent-payments style).
6. **Off-grid everything, grid-optional** — solar power, an AWG unit **standard on every home** *(plumbed into the water loop as the summer producer; cistern/well carries winter — physics is physics)*, off-grid sewage and greywater handled eco-first, wood stove heat. Every home connectable to grid later.
6b. **No-concrete foundations** — homes stand on driven/screw piles protected against any leaching into the ground; conventional concrete is avoided everywhere possible, and where a concrete-like material is genuinely needed, hempcrete (hemp-lime) is the preference. Nothing the build touches may affect the water table. (Happy alignment: protected steel screw piles are already the cheaper option in Alberta — see the foundations research.)
7. **The lifestyle layer** — every home includes a wood-fired hot tub and a beautiful deck. These homes must be desirable, not worthy-but-dull.
8. **One-click feel, card-first** — answer questions, get a designed home, fund it, watch it build. Normies must be able to use it: **someone with zero crypto pays by Visa** and the app converts to USDC in-flow (no exchange account ever required — build as if the exchange gap doesn't exist, because for our users it won't); no visible crypto complexity, prices readable in CAD, token (if ever) invisible behind the scenes.
9. **Alberta pilot, Canada first** — start in Alberta, source everything locally in Alberta wherever possible; buy elsewhere only what Alberta cannot supply. Cut out middlemen everywhere.
10. **Radically open** — open source from day one, MIT, no black boxes, no closed boxes. The repo tells the whole truth, including what doesn't work yet.
11. **Ridiculously affordable** — the platform charges a usage fee so small it's an encouragement, not a toll. The mission is more eco homes built, not margin.
12. **A KR8TIV AI product** — part of the family: same aura mark (recolored aurora-over-forest, Banff energy), same dark premium design language, its own distinct identity. Branding "on a level with Tesla, Apple." No AI slop.
13. **Hackathon vehicle** — entered in the OKX BuildX AI Season Hackathon (deadline Aug 21, 2026): deployed on X Layer testnet during the event, AI at the core, dedicated X account, submission that can win.
14. **Built to be continued** — Fable 5 lays ALL the groundwork so lesser AI models can carry it forward without losing the plot (see AI-HANDOFF.md). Anything is possible; excuses are not welcome. Every blocker gets a route around it.
15. **The app runs on AI** — a persistent per-journey brain that manages the whole process: knows the state, walks the user through every stage start to finish, catches slips and picks things back up, sends email updates, and learns from real outcomes. Cost-honest model strategy (tiered: code → small open-weight → frontier API, distill later on rented GPUs) so it survives thousands of users. See [AI-BRAIN.md](AI-BRAIN.md).

## The five-stage pipeline (the product spine)

**LAND → DESIGN → BUDGET → ESCROW → BUILD**

1. **LAND** — parcel discovery + suitability filters (district dwelling minimums, aquifer, grid proximity, septic soils) → USDC-funded acquisition path (convert-then-close via crypto-fluent Alberta professionals).
2. **DESIGN** — questionnaire → AI architect → review-ready design package (SIP catalog, code-constraint checked: Part 9, zone 7A, FDWR).
3. **BUDGET** — live Alberta-first line-item budget, LOW/MID/HIGH, no middlemen, real supplier directory.
4. **ESCROW** — USDC milestone escrow on X Layer with Alberta's statutory 10% holdback modeled on-chain; build record minted as a non-financial RWA NFT.
5. **BUILD** — orchestrated permits, professionals, materials, milestones; each completion updates the on-chain record. Every work package offers the choice: **do it yourself** (the app guides; `ownerBuildable` lines are flagged in the cost model) or **hire it out** — in which case the app runs a wide internet-scale contractor research sweep (ratings, reviews, trade records, the supplier directory), triggered automatically once engineering + architecture + the per-build feasibility check are complete, and returns a ranked shortlist per trade.

## The ambition horizon

This is deliberately the software that would otherwise exist in five years, built now. An agent-in-an-app, start to finish: deploy, design, engineer, get it stamped, acquire the real estate, source the contractors, pull the permits, pay for all of it — **from USDC on X Layer to moving into your eco home.** Third-party services are welcome wherever they're the best tool (paid in USDC, x402-style); pretending they don't exist is not. It sounds nuts described out loud. The plan is not to be less nuts — it's to ship the honest version in slices, iterate relentlessly in the open, and attract contributors who want to build the rest. If it's interesting enough, it never stops being built.

## The audit question

Every audit pass asks: *Does what we've built move a normal person closer to a real eco home with less friction, less cost, and more honesty than anything that existed before — and does it still feel like one product a person would love to use?* If any piece fails that question, flag it with a concrete suggestion.
