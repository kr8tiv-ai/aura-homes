<div align="center">

<img src="app/public/social/aura-homes-social-v2.jpg" alt="Aura Homes — design the home, find the land, build it for real" width="100%">

<br>

<sub><code>AURA HOMES · ALL-IN-ONE UNIQUE STAYS · ALBERTA PILOT · OKX BUILDX AI 2026</code></sub>

# From an idea to a real small home.

**Aura Homes gives normal people one calm place to define a project, design or choose an eco-home, match it to land, source the right team, understand the budget, and prepare a verifiable build handoff. Cash works. Crypto is optional plumbing.**

[**Start a project**](https://aurahomes.fun/start) · [**Open the builder**](https://aurahomes.fun/build) · [**Explore the live site**](https://aurahomes.fun) · [**Read the proof**](#x-layer-proof)

[![Live](https://img.shields.io/badge/live-aurahomes.fun-047857?style=flat-square&labelColor=f5f5f4)](https://aurahomes.fun)
[![X Layer](https://img.shields.io/badge/X_Layer-testnet_1952-171a18?style=flat-square&labelColor=f5f5f4)](#x-layer-proof)
[![Tests](https://img.shields.io/badge/release_checkpoint-87_%2B_24_%2B_24_passing-171a18?style=flat-square&labelColor=f5f5f4)](#verification)
[![License](https://img.shields.io/badge/license-MIT-171a18?style=flat-square&labelColor=f5f5f4)](LICENSE)

<sub>Open-source product and hackathon submission by <a href="https://github.com/Matt-Aurora-Ventures">Matt Haynes / Aura Ventures</a>. Alberta first; designed to travel.</sub>

</div>

<div align="center"><img src="assets/section-rule.png" alt="" width="88%"></div>

## The 60-second judge path

Aura is built around one provable journey rather than a collection of disconnected crypto demos.

| Time | Try this | What it proves |
| ---: | --- | --- |
| 0:00 | [Start a project](https://aurahomes.fun/start) and choose `Find land + build`, `Build on my land`, or `Buy a finished home` | A non-technical intake creates a durable, account-free project. |
| 0:15 | Open [the builder](https://aurahomes.fun/build), switch between Guided and Pro, then edit the same design | Both editor modes write one canonical document and one deterministic design hash. |
| 0:30 | Visit [land](https://aurahomes.fun/land) and [contractors](https://aurahomes.fun/contractors) | Project-fit and evidence scoring work, while pilot/demo records are labelled honestly. |
| 0:40 | Open [X Layer escrow](https://aurahomes.fun/escrow) | The app knows the configured chain, test token, deployed escrow, receipt events, and registry hash model. |
| 0:50 | Open the [HOMES dashboard](https://aurahomes.fun/homes) | The future trust is presented as a public zero-state ledger: no token, fees, property, staking, or distributions are invented. |
| 1:00 | Inspect [deployment evidence](docs/DEPLOYMENTS.md) and run the suites below | The product claims can be reproduced from code, tests, and public testnet state. |

> The strongest demo is: **brief → design → local save/reload → land fit → team evidence → quote basis → prepared testnet deposit → receipt/hash verification.** Aura prepares and explains; the person confirms.

<div align="center"><img src="assets/section-rule.png" alt="" width="88%"></div>

## Two perspectives, one world

The landing page now asks one useful question before the story begins: **what brought you here?** Both choices use the same house, landscape, film, and product. Only the explanation changes, and a persistent switch lets a visitor cross between them at any time.

| Perspective | What the story makes clear |
| --- | --- |
| **For homeowners and hosts** | Design or choose a unique eco-home, find suitable land, source a team, compare quotes, and carry one private project toward professional review and construction. No wallet is required. The longer-term destination is a user-owned alternative to a centralized Airbnb-style marketplace: real stays with transparent operating records and optional shared ownership rails. |
| **For crypto-native builders** | Follow the live [X Layer](https://web3.okx.com/xlayer) testnet proof, the [OKX Build X · AI Season](https://web3.okx.com/xlayer/build-x-series) submission, the planned HOMES decentralized trust, and the path toward an accountable network of independently operated unique stays. The later owner launchpad lets people prepare a real home project before any token, vault, or public raise exists. |

The crypto story still leads to the useful product: homes can be designed, matched to land, costed, sourced, and eventually paid for with cash or confirmed X Layer USDC where a real provider and payment destination exist. The homeowner story still explains the larger ambition in plain language: people should eventually be able to build, host, and participate in a user-owned network of distinctive stays without first becoming crypto experts.

## Three doors, one project

### Find land + build

Describe the home, budget, location, utilities, accessibility needs, and timeline. Aura turns those requirements into a design, screens land against the project, explains why a parcel may or may not fit, builds a contractor shortlist, and prepares a comparable handoff.

### Build on land I own

Skip the shopping flow. The land becomes a design constraint: site access, services, orientation, slope, foundation assumptions, and regional cost basis stay attached to the project instead of living in forgotten tabs.

### Buy a finished home

Compare manufactured and kit-home options without pretending a research directory is a checkout marketplace. Aura records destination support, shipping basis, claimed certifications, quote status, payment path, evidence freshness, and unresolved questions. A provider becomes purchasable only when a real quote and payment destination exist.

All three journeys share the same spine:

<div align="center">
<img src="assets/pipeline.png" alt="Aura project journey from requirements and design through land, team, quotes, funding, build, and operation" width="94%">
</div>

`Requirements → Design → Land → Team → Quotes → Funding → Build → Operate`

## What exists now

Aura uses explicit status language throughout the interface and this submission:

- **Live** — works in the deployed browser experience now.
- **Pilot** — the engine works over deliberately limited, public, user-supplied, or demonstration inputs.
- **Testnet** — executable X Layer testnet code with no real customer funds.
- **In build** — code exists, but the complete customer outcome is not yet available.
- **Planned** — a published design, not a deployed capability.

| Capability | Status | Current boundary |
| --- | :---: | --- |
| Local-first project intake, library, autosave, archive, duplicate, recovery | **Live** | Projects stay in IndexedDB unless the person exports them. No account or cloud sync. |
| Plain and AES-256-GCM encrypted `.aura-project.json` bundles | **Live** | The passphrase is never recoverable by Aura; future file versions fail visibly without overwriting local work. |
| Guided and Pro editor modes over one `BuilderDocument` | **Live** | Design intent only. It does not certify structure, energy, manufacturing, or permits. |
| Polygon footprints, partitions, openings, rooms, roofs, and multi-storey graph intent | **Live / in build** | The graph editor is usable; some professional export paths still describe the legacy rectangular shell and say so in the UI. |
| Drawings, JSON, DXF, IFC4, ifcJSON, glTF/OBJ and comfort handoff | **Live / in build** | Export scope varies by geometry mode. Outputs are review-ready, never construction-ready. |
| Alberta budget ranges and quote snapshots | **Pilot** | Cost bands are explicit assumptions, not supplier offers or fixed manufacturing promises. |
| Parcel-fit discovery | **Pilot** | Demonstration/public records only today. No unauthorized MLS, REALTOR.ca, AlbertaLand, or listing-site scraping. |
| Contractor evidence scoring | **Pilot** | Explainable score model and gates exist; fictional profiles stay in demo mode. Aura does not call a contractor “vetted.” |
| Finished-home readiness catalog | **Pilot** | Research and quote preparation, not instant global purchasing. |
| Deterministic Aura brain and MCP tools | **Live locally** | Hosted, evidence-grounded concierge and `PreparedAction` confirmations remain in build. |
| Reservation, refund, milestone, holdback and registry contracts | **Testnet** | Deployed on X Layer testnet with dev-only roles and a valueless faucet token. |
| HOMES trust, token, staking and property ledger | **Planned** | Public dashboard intentionally reads zero. No address, venue, pool, property, or payout exists. |
| Owner-led unique-stay launchpad | **Planned** | Architecture published; project vaults, review, contracts and operating partners are future work. |

<div align="center"><img src="assets/section-rule.png" alt="" width="88%"></div>

## The project is the product

Most home-building software optimizes one slice: drawing, listings, estimating, contractor leads, payments, or operations. Aura's core decision is to make those slices consumers of one durable project.

### `AuraProject`

The versioned project envelope contains:

- journey and non-technical requirements;
- one embedded `BuilderDocument` and its canonical `keccak256` hash;
- land, contractor, and manufacturer shortlists;
- RFQs, quote evidence, and immutable order snapshot references;
- milestones and artifact manifests; and
- explicit timestamps and archive state.

Camera position, active editor tab, open panels, heatmap visibility, and other transient interface state are intentionally excluded. A saved project means the home, not the screen.

### `BuilderDocument`

The builder document is the single design source of truth for home specification, graph geometry, partitions, finishes, fixtures, openings, and comfort targets. Canonical serialization, validation, migrations, deterministic hashing, undo/redo, IndexedDB storage, share/import, quotes, and exports all attach to this durable layer.

Legacy work remains readable. Unsupported future versions stop with a visible message and do not overwrite the file. Geometry changes quarantine orphaned semantic records for repair rather than quietly deleting user intent.

### `BuildingGraph`

The graph models stable vertices, wall edges, openings, room faces, slabs, voids, stairs, shafts, roof zones, storeys, and stacked-room relationships. It prevents invalid moves, derives exact room faces, and preserves semantic identifiers across edits.

The important honesty line: the graph engine is ahead of some downstream drawing/export adapters. Until every exporter consumes the graph directly, Aura labels the limitation beside the action.

### Files, hashes, and privacy

`SHA-256` is a hash, not “256-bit encryption.” Aura uses hashes to detect altered portable files and evidence. Canonical EVM-facing design and budget commitments use `keccak256`. Optional private project bundles use Web Crypto `AES-256-GCM` with PBKDF2-SHA-256 key derivation. Full homeowner documents do not belong on-chain.

<div align="center">
<img src="assets/budget-bands.png" alt="Aura Homes budget bands show low, mid, and high assumptions rather than one unsupported price" width="92%">
</div>

## Discovery without fabricated certainty

### Land

The land engine asks whether a parcel fits **this project**, not whether it merely has an attractive listing photo. The Alberta pilot considers district minimum dwelling size, access, services, utility distance, water and wastewater assumptions, setbacks supplied by the record, and project geometry.

The adapter boundary is deliberate. RESO defines interoperability; it does not grant listing access. CREA DDF and MLS data require authorization. Aura supports partner, municipal/public, pilot, and user-supplied `LandProvider` records, each with attribution, collection date, expiry, confidence, and access classification. It does not scrape restricted listing platforms.

The intended production map stack is MapLibre GL JS + PMTiles + Turf. The compliant adapter and project-fit model matter more than adding a map full of invented inventory.

### Contractors

Contractor scoring is an evidence case file, not a paid ranking:

- legal entity and service-area match;
- licence, workers' compensation, and insurance gates;
- comparable project evidence;
- dated source links and expiry;
- known gaps and unresolved questions; and
- project-type fit.

The user sees why a score changed and opens the original source. Demonstration profiles never appear as real default results. Aura does not compile BBB material or reproduce review-site content into a private database.

### RFQs, quotes, and finished homes

The next release turns project data into comparable scopes for design completion, foundation, shell, MEP, solar, water, septic, interiors, and general contracting. Original quote files remain attached, normalized line items reconcile against Aura's cost basis, omissions stay visible, and edited-after-quote projects are flagged.

The same evidence model governs finished homes. Crypto capability alone never makes a manufacturer suitable; destination, shipping, certification claims, quote basis, payment destination, dispute path, and evidence freshness all matter first.

<div align="center"><img src="assets/section-rule.png" alt="" width="88%"></div>

## AI that stays inside the evidence

Aura's deterministic brain is available today as a browser fallback and an MCP server. It can check a parcel, produce a structured design brief, reconcile an Alberta budget, generate milestone schedules, report journey status, surface next actions, detect slips, prepare a digest, query suppliers, and return sourced Alberta facts.

The hosted concierge is intentionally bounded:

1. Ground answers only in the current `AuraProject`, approved reference material, provider evidence, and current chain state.
2. Cite the evidence and expose assumptions.
3. Draft comparisons, RFQs, and transaction payloads as `PreparedAction` records.
4. Simulate and warn before any consequential step.
5. Require an explicit human confirmation before contact, signature, or spend.

The existing x402-shaped MCP gate demonstrates the OKX Agent Payments Protocol request/receipt shape with **simulated settlement**. It does not claim a real token transfer. The planned Hostinger VPS service keeps provider keys out of the static bundle; project files remain local unless a person deliberately submits a bounded request.

## X Layer proof

Aura's on-chain layer records compact commitments and governs money movement; it does not publish private plans or personal data.

<div align="center">
<img src="assets/escrow-flow.png" alt="AuraBuildEscrow reservation, refund, milestone release, holdback, and registry flow on X Layer" width="92%">
</div>

### Current executable configuration

| Component | X Layer testnet proof |
| --- | --- |
| Chain | `1952` |
| Faucet-compatible test USDC | [`0xcB8B…c79D`](https://www.oklink.com/xlayer-test/address/0xcB8BF24c6cE16Ad21D707c9505421a17f2bec79D) |
| `AuraBuildEscrow` | [`0x4A77…63b5`](https://www.oklink.com/xlayer-test/address/0x4A777bf71d8809244c77A3c2b39ef68793A463b5) · [creation tx](https://www.oklink.com/xlayer-test/tx/0x19129a38eeb9a72531ad9c21a5fb93737814b2e17b533eb2ad9cc595f648bbce) |
| `AuraBuildRegistry` | [`0x1195…C32e`](https://www.oklink.com/xlayer-test/address/0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e) · [creation tx](https://www.oklink.com/xlayer-test/tx/0xd3e783c02b803256865593081a7442062949b341884dbce32d5a23632c430800) |
| Escrow terms | 14-day reservation refund window, 10% holdback, 60-day holdback period |
| Registry state | `nextTokenId = 0` — no home record has been minted |

### Lifecycle

1. Validate chain and configured settlement asset.
2. Create an immutable design/budget snapshot.
3. Check balance and allowance; request approval if required.
4. Place a refundable testnet reservation deposit.
5. Decode the receipt and `DepositPlaced` event.
6. Refund within the window, or convert the deposit into the first milestone after it closes.
7. Release milestones with 2-of-3 approval while retaining the holdback.
8. Verify canonical design and budget hashes through the registry.

The contracts and UI cover wrong network, insufficient token balance, allowance, rejection, pending and reverted transactions, receipt decoding, hash mismatch, refund boundaries, role authorization, and independent project state in tests.

The current deployment is a public technical proof, not a live escrow: homeowner, builder, and arbiter are the same development address; the token has no monetary value; source verification and independent review remain release work. See the complete [deployment ledger](docs/DEPLOYMENTS.md).

<div align="center"><img src="assets/section-rule.png" alt="" width="88%"></div>

## HOMES — the planned trust layer

HOMES is a **planned X Layer token and transparent property trust concept** attached to Aura's long-term unique-stay network. It is not deployed, listed, paired, staked, or collecting fees. The dashboard begins at zero on purpose.

The thesis is simple: if Aura eventually earns disclosed platform, service, API, AI-routing, or venue-agreement fees, a published allocation can route part of those fees into a property fund. The fund can acquire and operate distinctive small stays, while public on-chain records show what entered, what was allocated, what property was acquired, and what operating profit was distributed.

### Proposed parameters — not live promises

| Layer | Published concept |
| --- | --- |
| Token supply | 30% team · 10% marketing · 10% exchange/listing reserve · 20% protocol-owned liquidity · 30% public market |
| Platform/service fees | 60% property fund · 10% marketing · 10% operations · 10% development · 10% maintenance |
| Token venue fee share, if contractually available | 60% property fund · 10% marketing · 10% operations · 10% development · 5% burn reserve · 5% protocol-owned liquidity |
| First property target | Up to 200,000 USDC before any release for an acquisition path |
| Property economics | Planned 60% community / 40% team share of net property profit |
| Later distribution eligibility | Planned top 200 qualifying community stakers, prorated by the finalized stake snapshot rules |
| Wind-down concept | If a defined raise fails by its deadline, the distributable purchase-fund balance would be claimable by the top 50 qualifying community holders under published snapshot rules |
| Initial market design | Proposed 2% account cap and 30% team allocation; implementation, exemptions, venue behavior, and anti-bot tradeoffs remain unresolved |
| Proposed market | X Layer; a HOMES/SPACEX pool has been discussed, but no verified counter-token, venue, pool, or launch configuration has been selected |

“Trading fees” only exist if a venue or pool design actually routes them by contract or agreement. Aura will not display assumed exchange revenue as collected money. The public dashboard exposes contract addresses, snapshot block, fee receipts, fund balance, property receipts, eligible-holder cutoff, and USDC distribution transactions only when those values exist.

No private owner documents, guest data, title records, full plans, or personal information belong in the token ledger.

## The later owner launchpad

The broader vision is an owner-led launchpad for eco-homes and unique stays: design a real project in Aura, prepare the land and team, publish evidence, open a named project pool, build under milestone controls, and operate the stay with an exportable record.

It needs three ledgers that must never be blurred:

| Ledger | Purpose | Hard boundary |
| --- | --- | --- |
| **HOMES lock** | Time-bound support signal and later eligibility under published rules | Locked tokens are not construction cash. |
| **Project USDC vault** | Real money for one named stay, with scope, cap, deadline, milestones, refund logic, and evidence | It cannot spend market liquidity and cannot silently change projects. |
| **Market liquidity** | Independent HOMES market depth | It is not counted as money raised for land or construction. |

An owner project would carry its own design hash, budget hash, quote basis, land status, vault address, milestone evidence, operating record, and human confirmations. Aura may prepare the artifacts and on-chain actions; it may not autonomously contact, sign, bridge, or spend.

The long-term result is more than a token page: a decentralized unique-stay network with tools for people who never touch crypto, optional X Layer rails for people who do, and a repeatable route from a responsible design to an operating home.

Read the full, versioned concept in [`docs/HOMES-TOKEN-CONCEPT.md`](docs/HOMES-TOKEN-CONCEPT.md).

<div align="center"><img src="assets/section-rule.png" alt="" width="88%"></div>

## Architecture

```text
aura-homes/
├── app/          Next.js 14 app, local-first project workspace, builder, discovery and testnet UI
├── agent/        deterministic journey brain + MCP server + x402-shaped simulated payment gate
├── contracts/    AuraBuildEscrow + AuraBuildRegistry, Hardhat, OpenZeppelin, X Layer scripts
├── design-api/   optional FastAPI design service; deterministic geometry works without model keys
├── data/         Alberta pilot costs, parcels, suppliers and evidence inputs
├── docs/         architecture, claims, research, roadmap, token concept and deployment proof
└── assets/       authored Aura brand and submission visuals
```

### Frontend

Next.js 14, React 18, TypeScript, React Three Fiber, Three.js, drei, postprocessing, Motion, viem, wagmi, TanStack Query, IndexedDB and Web Crypto. The landing film is progressive; 3D begins only after interaction. Reduced-motion, mobile, low-power, and WebGL-failure states have composed static fallbacks. The builder renders on demand rather than running a decorative infinite loop.

### Design and AI services

The browser owns the durable project. Deterministic geometry and cost logic remain available without a hosted model. The optional FastAPI service separates language-model reasoning from drawing geometry: the model proposes a structured program; deterministic code owns coordinates and exports.

The Hostinger VPS target is `api.aurahomes.fun` with FastAPI, Uvicorn, Caddy, Docker Compose, SQLite/WAL, exact-origin CORS, rate limits, and structured audit events without private project contents. That hosted API is not part of the current static production claim.

### Contracts

Solidity + OpenZeppelin + Hardhat on X Layer. `AuraBuildEscrow` holds one build's reservation and milestones with explicit roles, refund rules, 2-of-3 releases, and holdback. `AuraBuildRegistry` anchors compact design/budget commitments and lifecycle state. Full documents remain off-chain.

## Verification

The current release checkpoint produced:

| Suite | Result |
| --- | ---: |
| TypeScript / production compilation | Passed |
| Deterministic app tests | **87 passed** |
| Playwright UI tests | **24 passed** |
| Hardhat contract tests | **24 passed** |
| Static routes generated | **19** |
| Homepage first-load JavaScript | **106 kB** in the production build |

Run the same checks:

```bash
cd app
npm install
npx tsc --noEmit
npm test
npm run test:ui
GH_PAGES=1 npm run build

cd ../contracts
npm install
npm test
```

The release suite covers document validation and migration, canonical hashes, IndexedDB storage, share/import, order snapshots, comfort calculations, graph invariants, multi-storey relationships, blocked geometry, marketplace discovery, buy readiness, scene quality, X Layer configuration and lifecycle behavior, Guided/Pro interaction, mobile layouts, and key accessibility states.

Performance gates are part of the product contract: homepage LCP ≤ 2.0 s, INP ≤ 160 ms, CLS ≤ 0.08; roughly 60 fps desktop and 30 fps mobile while actively editing; no automatically running mobile 3D.

## Run locally

### Web application

```bash
git clone https://github.com/kr8tiv-ai/aura-homes.git
cd aura-homes/app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The project system, deterministic design tools, pilot marketplace records, and planned HOMES zero state work without API keys.

### Aura brain / MCP

```bash
cd agent
npm install
npm run build
npm run mcp:smoke
npm run demo
```

### Optional design service

```bash
cd design-api
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

`GET /health` reports which optional providers are configured. With no keys, it returns deterministic geometry and clearly marks the offline path.

### Contracts

```bash
cd contracts
npm install
npm test
```

Never commit private keys. Testnet deployment instructions and provenance are in [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md).

## Safeguards

- Aura produces design intent and review-ready handoff, not structural, energy, manufacturing, title, appraisal, or permit certification.
- Licensed professionals remain responsible for regulated decisions and stamped work.
- Listing adapters require authorized, public, partner, or user-supplied data.
- Contractor scores expose evidence and missing evidence; they are not guarantees.
- Quotes show source, date, exclusions, confidence, and edited-after-quote state.
- AI cannot sign, contact, or spend without confirmation.
- No custody, mainnet funds, autonomous conversion, hidden bridge, or automatic ChangeNOW execution.
- On-chain records contain hashes and public proof, not homeowner files or personal data.
- HOMES, its trust, venue, staking, properties, launchpad, and distributions remain planned until addresses and receipts exist.

## Documentation

| Read | Purpose |
| --- | --- |
| [`AURA_HOMES_MASTER_BRIEF.md`](AURA_HOMES_MASTER_BRIEF.md) | Product goal and submission north star |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System boundaries and data flow |
| [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md) | Current and retired X Layer proof |
| [`docs/HOMES-TOKEN-CONCEPT.md`](docs/HOMES-TOKEN-CONCEPT.md) | Planned trust, allocations, zero-state ledger and launchpad boundaries |
| [`docs/GAP-ANALYSIS.md`](docs/GAP-ANALYSIS.md) | What still blocks an end-to-end service |
| [`docs/PHASED-ROADMAP.md`](docs/PHASED-ROADMAP.md) | Integrity-first delivery order |
| [`docs/GRAPH-ENGINEERING.md`](docs/GRAPH-ENGINEERING.md) | Geometry and deterministic output invariants |
| [`docs/ALBERTA-PLAYBOOK.md`](docs/ALBERTA-PLAYBOOK.md) | Alberta pilot facts and handoff rules |
| [`docs/AI-BRAIN.md`](docs/AI-BRAIN.md) | Bounded agent model and MCP tools |
| [`docs/BRAND.md`](docs/BRAND.md) | Paper, ink, emerald and “crypto is plumbing” system |
| [`docs/CREDITS.md`](docs/CREDITS.md) | Third-party assets, licenses and attribution |

## Roadmap from proof to service

1. Finish the unified project workspace and graph-derived professional exports.
2. Connect authorized/public land adapters and real evidence case files.
3. Generate RFQs, reconcile real quotes, and activate providers only after evidence exists.
4. Deploy the bounded Hostinger API and prepared-action confirmations.
5. Replace the dev escrow with a factory and distinct per-project roles; verify source and complete external review.
6. Deliver milestone evidence, commissioning, warranty, maintenance and home-book operations.
7. Only then evaluate HOMES, the trust structure, venue mechanics, property operations and owner project vaults.

The project stays approachable by keeping the chain underneath the journey. A person can design, compare, export, and organize a home without a wallet. When on-chain proof helps—escrow receipts, hash commitments, milestone approvals, or public fund accounting—it appears at the exact point it earns its complexity.

<div align="center">

<img src="assets/section-rule.png" alt="" width="88%">

**Design the home. Find the land. Build it for real.**

<sub>Aura Homes · Alberta pilot · X Layer testnet · HOMES trust and owner launchpad planned</sub>

</div>
