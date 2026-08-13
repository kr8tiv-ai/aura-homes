# Roadmap

> [!IMPORTANT]
> **Current release framing — August 12, 2026.** The older escrow-led roadmap
> below is retained as product history, not as the active plan. Aura's ordinary
> journey is Requirements → Design → Land or Delivery → Team → Costs →
> Handoff. Escrow and refunds are isolated in `/labs/xlayer-proof`; they are not
> the product or the core hackathon demo. `docs/SUBMISSION.md` is the canonical
> demo script and `docs/MAINNET-DECISION-BRIEF.md` records the mainnet hold.

## Active three-arc plan

### Now — stabilize the project workspace

- One local-first `AuraProject` with explicit, user-confirmed journey states.
- Guided and Pro editing over the same durable `BuilderDocument`.
- A 25-concept, provenance-labelled plan library. Design intent only; ranges
  disclose when steel or polycarbonate is represented by a planning proxy.
- Demonstration land-fit and contractor-evidence tools that cannot satisfy real
  project progress or claim a live listing, permit decision, or vetted provider.
- Alberta-first scenario budgets, hash-bound quotes, and professional handoff.
- An optional X Layer testnet proof lab, clearly separated from purchasing.

### Next — locality data and project guidance

- Rights-safe manufacturer research and permissioned listing adapters.
- Compliant land adapters that distinguish sale offers from parcel context.
- Authority-verifiable contractor case files and dated supplier leads.
- Regional cost factors only where a sourced local basis exists.
- A bounded project concierge that proposes typed actions for user confirmation.
- A hardened Hostinger VPS API only after session, quota, retention, artifact,
  logging, and spend controls are implemented.

### Future — HOMES, only behind real gates

- HOMES remains planned with no connected ledger source: no token, trust, property,
  staking, payout, sale, exchange listing, or launchpad is live.
- The legal vehicle, participant rights, eligibility, accounting, custody,
  liquidity, wind-down policy, and security model must be decided and reviewed
  before any value-bearing deployment.
- The current registry is testnet provenance only and must not be deployed to
  mainnet unchanged.

---

## Archived roadmap — August 10 snapshot

*The rollout is a designed three-arc story, settled by the founder Aug 10, 2026: ship the hackathon MVP, grow it into the Locality Hub, and announce the HOMES token now while deliberately defining it later. Every earlier verified line item survives below, reorganized under the arc it serves — nothing was deleted, only re-homed.*

> **On numbering:** [PHASED-ROADMAP.md](PHASED-ROADMAP.md) remains the founder's commercial roadmap — its Phase 1 is the USDC buy flow, Phase 2 adds land and customization, Phase 3 is increasing automation — and its § Mapping table reconciles those phases against this file's earlier engineering numbering (Phase 0 = the 12-day sprint, Phase 1 = proof, and so on). The three arcs below are now the primary framing of this file: Arc 1 contains the founder's Phase 1 and the old engineering Phase 0; Arc 2 contains the founder's Phases 2–3 and the old engineering Phases 1–3; Arc 3 is the token, previously a Phase 2 line item. When someone says "Phase 1" without qualifying it, they almost always mean the founder's Phase 1 — the USDC buy flow, which lives inside Arc 1.

---

## Arc 1 — the hackathon MVP (now → Aug 21, 2026)

**The sentence:** buy a home with USDC on X Layer, with an agent that directs you to the land.

The escrow and registry contracts, the land-filter agent, and the live 3D site at [aurahomes.fun](https://aurahomes.fun) are this arc. Honest status, because the roadmap is never written in the present tense for unbuilt things:

**Real today (Aug 10, 2026):**

- `AuraBuildEscrow` and `AuraBuildRegistry` are written and pass 10/10 tests (`npx hardhat test`) — but they are **not yet deployed**. The testnet-1952 deploy is human-gated on a faucet captcha, a 30-second Matt-only step.
- The agent pipeline (questionnaire → design brief → budget → milestone schedule) runs offline and reconciles to the dollar against `cost-model.json`.
- The 3D site is live at aurahomes.fun.

**Demo or simulated, and labeled as such:**

- x402 settlement on the design endpoint is simulated — the metering demo runs, but no real settlement occurs.
- The escrow UI runs on fixtures until the contracts reach testnet.

**Sequencing rule, set by the founder Aug 9, 2026:** the live-site fix comes first — deploy, mobile layout, grass/trees/mountains — and the arc gets built once aurahomes.fun is presentable. The immediate build targets after that are the concierge chatbot and the USDC purchase flow.

### The 12-day sprint (Aug 9 → Aug 21, 2026)

| Days | Ship |
|---|---|
| 1–2 | Contracts tested + deployed to testnet 1952 · faucet OKB claimed daily from day one · @AuraHomes_fun X account live, first build-in-public post |
| 3–5 | Pipeline demo: LAND filter (district minimums, aquifer, grid distance) → questionnaire → AI design brief → 3-home SIP catalog with 3D massing → live Alberta budget |
| 6–8 | Escrow UI on testnet: fund → approve → release with visible 10% holdback → holdback timer · AuraBuildRegistry mint per build · x402/OKX-APP metered fee on the design endpoint |
| 9–10 | Polish to premium · hosted deploy · 90-second demo video, every figure captured live |
| 11 | Mainnet contract deploy (small OKB spend) · Google Form submission · X submission post tagging @XLayerOfficial |
| 12 | Buffer. Ship early, not at 23:58 UTC. |

**Matt-only:** create the X account, KYC at prize time, submit the form, post the tweet. Everything else is AI-executable — see [AI-HANDOFF.md](AI-HANDOFF.md).

---

## Arc 2 — the Locality Hub (after the hackathon)

The founder's frame, kept in his own words: **a giant hub with bridges across.** Design your own home — eco-only: SIP sandwich panels, solar setups. Source all materials locally. Source contractors. Choose to buy or to build. A vendor directory purchasable in USDC, with bridge-in guidance where vendors take CAD. Pay contractors. Inventory management. Build tracking. Latest-technology discovery. Rolled out locality by locality — Alberta counties first, per the existing pilot data (Lac Ste. Anne for the district-minimum demo case, Leduc as the permit-friendly contrast, Parkland and Sturgeon next in the land-data licensing queue).

Everything the earlier proof and product phases committed to lands inside this arc, in the same order.

### Proof (Sep–Dec 2026)

- FINTRAC MSB analysis + registration path (8–16 weeks, free) before any custodial mainnet flow.
- Independent escrow audit (US$15–60K — grant applications: X Layer ecosystem, OKX accelerator pipeline).
- One real pilot: a Lac Ste. Anne–ring parcel, documented publicly end-to-end — the land filter, the district check, the designer handoff, the SIP order, the escrow draws. The pilot IS the marketing.
- Partner bench signed: residential designer, P.Eng, Insulspan/EnerSmart quote pipeline, 2 solar installers, 2 septic designers, McLeod Law.
- Account abstraction (Particle + Safe on X Layer) — invisible wallets; **card-first on-ramp integration** (MoonPay/Transak/Banxa evaluation: X Layer support, Canadian card success rates, KYC depth) so a Visa is all anyone needs; CAD display everywhere.
- The Aura Brain, phase 1 (per [AI-BRAIN.md](AI-BRAIN.md)): journey state machine + MCP server extraction + email digests + slip-rule library + outcome logging.
- **Contractor scout**: the DIY-or-hire toggle on every budget line (`ownerBuildable` is already in the data), plus the per-build contractor research sweep — a fan-out agent workflow (per-trade researchers → review/rating verification → ranked shortlist) that runs at the engineering-complete stage gate. Sweep results cache into the supplier directory so the network compounds with every build.
- **Compliance-scorecard hero demo** *(founder's research notebook, Aug 2026)*: IFC model in → deterministic rule run → **4-verdict scorecard** (COMPLIANT / NON_COMPLIANT / REVIEW_REQUIRED / UNCERTAIN; missing data is always REVIEW_REQUIRED, never an error) → sealed permit package out via the Notarius/P.Tech rail. Minimal credible recipe: LLM structured-output parsing of 9.36/bylaws → IfcOpenShell targeted extraction → deterministic Python rule loop → GeoPandas/Shapely setbacks → gated review UI with professional override. Citable stat sheet for the pitch: permit review 73→32.5 days (Honolulu CivCheck pilot), 87%/92% accuracy (Seattle), neuro-symbolic 95.8% translation / 98.3% executability vs 72.3% LLM-only, 90% coding-effort cut, code updates 68h→4.2h.
- **Real land-module data stack** *(founder's research notebook, Aug 2026)*: license **Altalis Cadastral + Title/ETM for Parkland + Sturgeon first**; free **RITL encumbrances via Open Data Areas Alberta** (ingest as interest-based features, never title-by-title, with a manual-title-search fallback flag); Edmonton Socrata zoning; free Base Features + LiDAR DEMs. Screening pipeline: CRS-normalize → hard exclusions (floodplain/wetland/slope/crown/easement) → **negative-buffer setbacks with a zero-buildable-envelope guard** → weighted ranking → sticky compliance states with immutable audit records. Add AVPA overlays and straddle-parcel handling to the filter list.

### Product (2027)

- QCAD corridor when TD custody ships (one-hop CAD settlement).
- Design depth: IFC export (IfcOpenShell), HOT2000 handoff for 9.36 performance path, Hypar integration for parametric variants.
- Expansion packs: `data/bc/`, `data/sk/` — the architecture makes a new province a data problem, not a rewrite.
- Hub build-out, translating the founder's frame into line items: the eco-only design studio (SIP sandwich panels, solar setups) as the front door to buy-vs-build; the vendor directory purchasable in USDC, with bridge-in guidance (CCTP via Base) where vendors take CAD; contractor payments on the escrow rail; inventory management and ordering against real lead times; build tracking on the registry record; and a latest-technology discovery feed so the catalog never fossilizes. Each locality ships as a data pack plus a verified local supplier and contractor bench — the same structure the Alberta pilot proves.

### The horizon — the five-year software (2028+)

The full agent: watches land listings and flags underpriced suitable parcels; negotiates supplier quotes; schedules trades against SIP lead times and frost windows; files permit applications the counties accept digitally; streams escrow draws against inspector sign-offs; hands every owner a complete as-built + tax ledger. Aura Homes as the operating system for small-scale eco construction — open source, so builders adopt it instead of fearing it.

---

## Arc 3 — the HOMES ecosystem (defined by the founder, Aug 12, 2026)

*This section was rewritten Aug 12, 2026 to match the founder's stated design,
which supersedes the earlier "announced now, defined later" posture. The prior
text said "the working direction remains burn-on-usage app credit, invisible
to users" — that direction is retired.*

**HOMES is a planned X Layer token with a defined shape, presented on the
site's crypto journey and always labelled planned — Today / Next / Future —
never live.** The founder's design, as given:

- **The fund:** 60% of trading and platform fees route to a transparent
  property fund that acquires and operates real eco homes; remaining fees
  split marketing / ops / dev / upkeep (10% each). Later revisions added 5%
  burns and 5% compounding liquidity.
- **Supply:** 30% team (12-month cliff, 36-month linear), 10% marketing, 10%
  exchange listings, 20% protocol-owned liquidity, 30% public market.
- **Holder mechanics:** a staking mechanism when the first property goes
  live; the top 200 staked addresses paid pro rata in X Layer USDC from
  rental profits, with receipts published. Wind-down clause: if the project
  cannot raise enough, purchase-allocated fees divide pro rata to the top 50
  holders.
- **The structure:** a decentralized property trust holding the homes; the
  long-term story is a user-owned Airbnb for eco stays, and eventually an
  RWA launchpad where owners fund their own eco-stay projects.
- **Presentation rules (founder):** no securities talk; the eco journey
  mentions HOMES only once, at the end, with a link; the crypto journey
  carries the full story. The live pages honestly render zeros — "Planned ·
  no token contract" — until something is real.
- Pair intention: HOMES paired with the SpaceX token on X Layer, launched at
  a low valuation with founder-owned locked liquidity; mechanics in the
  Codex-thread record and [TOKEN-RESEARCH.md](TOKEN-RESEARCH.md) /
  [TOKEN-DESIGNS.md](TOKEN-DESIGNS.md) remain the technical reference.

---

*Reassessed continuously against [VISION.md](VISION.md) — the audit loop has authority to flag drift.*
