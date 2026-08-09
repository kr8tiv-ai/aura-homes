# Audit Log — Vision Auditor

*This log is append-only. Each audit adds a new `## Audit #N — date` section below; never rewrite prior audits. Canon: [VISION.md](VISION.md). Method: every claim graded against the repo as it actually runs — tool success is not verification; every grade below is backed by file:line evidence or an executed command.*

---

## Audit #1 — 2026-08-09

**Repo state audited:** full tree at `C:\Users\lucid\Desktop\aura-homes` (docs, contracts, agent, app, data, assets). Verification runs performed: `npx hardhat test` (10 passing), `agent: npm run demo` (FAILS — missing script), `agent: npm run build && node dist/index.js` (works; totals LOW $195,250 / MID $297,000 / HIGH $434,700), `git log` (zero commits).

### Scorecard

The 14 founder requirements (VISION.md:11–24):

| # | Requirement | Grade | Evidence |
|---|---|---|---|
| 1 | Eco-home AI, ground to finish | **PARTIAL** | Design→budget→milestones pipeline real and runs (agent/src/pipeline.ts); land discovery and build orchestration exist only as prose (FEASIBILITY §3); app is a landing page with dead nav links (app/app/layout.tsx:11–15 → no /design, /budget, /escrow pages exist) |
| 2 | SIP construction | **FULFILLED** | SIP shell spec in agent (pipeline.ts:61–69), suppliers (suppliers.json:6–11), cost lines (cost-model.json:12), constraints documented (ALBERTA-PLAYBOOK.md:26) |
| 3 | Crypto-native funding, USDC on X Layer | **PARTIAL** | AuraBuildEscrow.sol real, 10 tests passing (verified); chains + native USDC addresses correct (app/lib/chains.ts:28–31); but no bridge code, no x402 code, crypto-loan teaching (Aave/Ledn) is docs-only — nothing in the app teaches it |
| 4 | LAND as a first-class step | **CONTRADICTED** | The app dropped it: landing pipeline shows 4 stages "Design/Budget/Escrow/Build" (app/app/page.tsx:3–8) vs the 5-stage spine (VISION.md:28, README.md:31); no land-filter code exists anywhere in agent/ or app/ — Parcel is only a passive design input |
| 5 | AI is the architect (+ 3rd-party tools paid in USDC) | **PARTIAL** | Claude narrative + deterministic pipeline real (agent/src/claude.ts); but only 1 of the 5 promised constraint checks is implemented (see Contradictions #7); no 3D massing anywhere despite three docs promising it; zero x402 code |
| 6 | Off-grid everything, grid-optional | **PARTIAL** | Solar/battery/generator/stove/cistern/septic all modeled (types.ts, cost-model.json); AWG honestly demoted (cost-model.json:18) — exemplary; but greywater (named in VISION.md:16) appears nowhere in the product or data, only as a legality note (FEASIBILITY §4.5) |
| 7 | Lifestyle layer: hot tub + deck | **FULFILLED** | In the questionnaire (types.ts:53–58), budget inclusion logic (pipeline.ts:130, 268–273), cost model (:20), suppliers (:45–49), sample, and fixtures |
| 8 | One-click feel, normie-usable | **PARTIAL** | CAD-readable pricing in fixtures; but the app is a skeleton: injected-wallet connector only (app/lib/wagmi.ts:7), no AA, no guided on-ramp, and the primary CTA "Start a design" 404s |
| 9 | Alberta pilot, local-first, no middlemen | **FULFILLED** | ALBERTA-PLAYBOOK.md + suppliers.json with per-entry `albertaLocal` flags and basis notes + cost-model.json with per-line `basis` — this is the moat and it is real |
| 10 | Radically open, MIT, no black boxes | **PARTIAL** | LICENSE (MIT) present; honesty culture genuinely exceptional in docs; BUT `git log` shows **zero commits** and the repo is not on GitHub — "open source from the first commit" (README.md:84 area, VISION.md:20) is not yet true; the "300+ source" research corpus is cited but not published |
| 11 | Ridiculously affordable usage fee | **PARTIAL** | Policy stated everywhere (README, ARCHITECTURE §Payments, OPEN-QUESTIONS #4); zero implementation — acceptable for Day 1, but it is currently prose |
| 12 | KR8TIV AI branding, Tesla/Apple grade | **PARTIAL** | Assets exist (assets/: hero, logos, avatar); design tokens match the spec (tailwind.config.ts:9–17 = ARCHITECTURE.md:46 palette); but the app never uses the logo or hero and is far from "stunning" yet |
| 13 | Hackathon vehicle (deploy testnet, X account, winnable submission) | **PARTIAL** | Submission package (SUBMISSION.md) is genuinely strong and paste-ready; but: no testnet deployment, no deploy script (contracts/scripts/ does not exist), no X account, no hosted app, no video — all still open with 12 days left; today IS Roadmap D1 |
| 14 | Built to be continued (AI-HANDOFF) | **FULFILLED** | AI-HANDOFF.md is excellent — the "never un-learn" list is exactly right; one flaw: it instructs `npm run demo`, which fails (see Contradictions #2) |

**Requirements: 4 FULFILLED / 9 PARTIAL / 0 MISSING / 1 CONTRADICTED**

Pipeline stages (VISION.md:26–34):

| Stage | Grade | Evidence |
|---|---|---|
| LAND | **MISSING** | No discovery, no suitability-filter code, dropped from the app's own pipeline graphic (page.tsx:3–8) |
| DESIGN | **PARTIAL** | Agent runs end-to-end (verified); no app page, no 3D massing, 1/5 constraint checks |
| BUDGET | **PARTIAL** | Agent produces live LOW/MID/HIGH from real data (verified); totals contradict the published headline (Contradictions #1); app shows fixtures only, on a page that doesn't exist |
| ESCROW | **PARTIAL** | Contracts written and tested (10 passing, verified today); holdback mechanics genuinely modeled; NOT deployed; UI hooks stubbed (app/lib/hooks.ts:63–66 returns fixtures) |
| BUILD | **PARTIAL** | AuraBuildRegistry.sol real and tested; orchestration (permits, trades, scheduling) exists only as prose |

**Stages: 0 FULFILLED / 4 PARTIAL / 1 MISSING / 0 CONTRADICTED**

### Contradictions found

1. **The flagship numbers don't reconcile — anywhere.** README.md:36, FEASIBILITY.md §6, cost-model.json:24 all headline **$185K/$290K/$465K ex-land**. The sum of cost-model.json's own line items + contingency is **$195,250 / $295,680 / $434,700** (LOW off by +$10K, HIGH by −$30K). The agent, run today against that file, prints **LOW $195,250 / MID $297,000 / HIGH $434,700**. FEASIBILITY's own table rows sum to ~$195.5K/~$296K/~$438K against its own stated totals row. With-land totals are worse: stated $260K/$435K/$760K, but 290+150=**$440K** mid and 465+350=**$815K** high. For a project whose brand is "numbers that tell the truth," the flagship table failing arithmetic is the single most dangerous flaw — a judge with a calculator finds it in 60 seconds.
2. **`npm run demo` does not exist.** README.md:71, ARCHITECTURE.md:40, and AI-HANDOFF.md:39 all instruct it; agent/package.json:9–12 defines only `build` and `start`. Verified failing: `npm error Missing script: "demo"`. The first thing a judge or contributor tries, broken.
3. **Deploy instructions reference a script that doesn't exist.** contracts/README.md:50 documents `npx hardhat run scripts/deploy.js`; there is no `contracts/scripts/` directory. Roadmap D1–2 ("contracts deployed to testnet") is due now and has no vehicle.
4. **The app dropped LAND from its own pipeline.** page.tsx:3–8 renders a 4-step pipeline ("01 Design … 04 Build") against the canonical LAND→DESIGN→BUDGET→ESCROW→BUILD spine. This is not an omission of a feature — it's the product graphic contradicting the vision's product spine.
5. **ARCHITECTURE.md:46 claims "Pages map 1:1 to the pipeline stages."** app/app/ contains exactly one page (page.tsx). The nav (layout.tsx:11–15) and both hero CTAs link to /design, /budget, /escrow — all 404. fixtures.ts:92 also references a `POST /api/design` that doesn't exist.
6. **ARCHITECTURE.md:37 documents a `Parcel` field that doesn't exist.** It describes "Parcel (county/district/minDwellingSqft/**aquifer**/gridDistance)"; types.ts:20–27 has no aquifer field at all (and gridDistance is actually `gridPowerAtLine: boolean`). The aquifer filter is one of the vision's four named land filters (VISION.md:14).
7. **ARCHITECTURE.md:42 claims five constraint checks as "the product's teeth"** (district minimum, FDWR ≤ 22%, SIP chase freeze, aquifer→cistern, winter solar floor). pipeline.ts implements exactly **one** (meetsMinDwellingSize, pipeline.ts:59). The other four exist nowhere in code.
8. **The sample questionnaire contradicts the project's own research.** questionnaire.sample.json:7 sets Lac Ste. Anne Agriculture District minimum at **700 sqft**; ALBERTA-PLAYBOOK.md:15 and cost-model.json:32 both say **592 sqft**. The district-minimum check is the advertised demo wow-moment (FEASIBILITY §8) — the demo input has the wrong number in it.
9. **types.ts:23 comment says "county-mandated minimum dwelling size"** — the exact misconception AI-HANDOFF.md rule 2 orders never to reintroduce ("District (not county) bylaws set minimum dwelling size").
10. **hardhat.config.js:11–12 says "X Layer is a Polygon CDK (zkEVM) chain"**; TOKEN-RESEARCH.md:38 (researched from primary sources the same day) says X Layer **migrated to OP Stack**. The paris evmVersion choice may still be prudent, but its stated justification is stale.
11. **"Open source from the first commit" — there is no first commit.** `git log`: branch main, no commits. README.md:69 tells people to `git clone https://github.com/kr8tiv-ai/aura-homes.git`, which cannot yet be true.

### Vanished vision elements

- **LAND in the product** — the vision's first pipeline stage has zero code and was dropped from the app's pipeline graphic (see Contradictions #4). Most severe vanishing.
- **Greywater** — VISION.md:16 says "off-grid sewage **and greywater** handled eco-first." Greywater appears once as a legal footnote (FEASIBILITY §4.5) and never in types.ts, cost-model.json, the playbook menu, or any UI. The eco-first *handling* (e.g., the legal subsurface-drip reuse path FEASIBILITY itself identifies) never became a product option.
- **Architectural glass** — VISION.md:11 ("architectural glass where the design earns it"). Docs handle FDWR honestly; the agent accepts `glazingRatio` but never checks or celebrates it. No FDWR enforcement, no "feature glazing" concept, no quint-pane option surfaced from suppliers.json:39.
- **"Teaches the user how to source crypto-backed lending"** (VISION.md:13) — fully researched (Aave/Ledn, FEASIBILITY §5) but no app surface teaches anything; there is no page for it to live on.
- **Third-party services paid in USDC / x402** (VISION.md:15, 38) — narrative in three docs, zero code, and the OKX Agent Payments Protocol integration is the single strongest judge-alignment card (FEASIBILITY §2: OKX is "not looking for another chatbot").
- **Contractor sourcing surfaced to the user** — suppliers.json is excellent data, and no interface shows it. "The directory IS the product" (FEASIBILITY §7) — currently the directory is a JSON file.
- **3D massing** — promised in FEASIBILITY §3, ROADMAP D3–5, and the SUBMISSION demo script (25–45s segment). Nothing renders anything, anywhere.
- **Bridges/CCTP guided flow** (VISION.md:13) — documented as the 2-hop truth, no guided step exists.
- **The research corpus itself** — "300+ sources" cited in README:44 and FEASIBILITY's footer, but no source list is published in the repo. For a "no black boxes" project, the evidence base is currently a black box.

### Overpromises vs honesty policy

- **"a first" / "the first construction escrow anywhere"** (README.md:37; SUBMISSION.md:31) — unverifiable absolute. The honesty policy ("If you can't verify a number, label it" — AI-HANDOFF rule 3) applies to superlatives too. Say "to our knowledge, the first."
- **Present-tense claims about unbuilt behavior:** SUBMISSION.md:33 "it filters land parcels against the bylaw **and groundwater traps**" (no groundwater logic exists; no aquifer field exists); README.md:38 "the app knows which county lets homeowners pull their own trade permits" (the docs know; the app knows nothing). These are exactly the inflated-claim pattern FEASIBILITY §4.1 warns judges punish.
- **ARCHITECTURE.md describes intended state as current state** (pages 1:1, five constraint checks, aquifer field) with no "planned" markers — a continuing AI (the audience of requirement 14) will trust it and be misled.
- **Run-it block** (README.md:68–76) contains a command that fails on first use.
- **Credit where due:** "Hardhat, tested" is true (10 passing, verified); the AWG demotion, Wealthsimple correction, owner-builder 10-year resale freeze disclosure, and LOW/MID/HIGH discipline are honesty-policy exemplars. The failure mode here is not dishonesty — it's *docs written ahead of code without tense markers*.

### Top 10 concrete fixes (ranked by impact)

1. **Make the money reconcile.** Pick one: (a) adjust cost-model.json line items so sums hit 185/290/465, (b) change the headline everywhere to the real computed totals (~195/297/435 ex-land), or (c) add an explicit reconciliation note to cost-model.json and FEASIBILITY §6 ("totals are rounded scenario anchors, not column sums; HIGH assumes correlated worst cases only for X"). Then make `totalsIncLand` arithmetic true or delete it. Files: data/alberta/cost-model.json:24–25, docs/FEASIBILITY.md §6, README.md:36, agent/src/pipeline.ts:24 (DEFAULT_COST_MODEL anchor). A single source of truth the agent's output actually matches.
2. **Put LAND back in the product today.** app/app/page.tsx: restore the 5-step pipeline with LAND as step 01. Add `agent/src/land.ts` with a pure `filterParcels(parcels, requirements)` implementing the four vision filters (district minimum, aquifer flag, grid distance, septic suitability) + a small `data/alberta/parcels.sample.json`. The district-minimum rejection is the scripted demo wow-moment — it currently cannot happen.
3. **Fix the broken commands (10 minutes).** agent/package.json: add `"demo": "npm run build && node dist/index.js"`. Create `contracts/scripts/deploy.js` (deploy MockUSDC-or-native-USDC-address + escrow + registry, print addresses) — Roadmap D1–2 is blocked on it right now.
4. **Create the three pages the nav promises** (/design, /budget, /escrow) rendering the existing fixtures — even thin, they turn 404s into a walkable product and make ARCHITECTURE.md:46 true. Remove or implement the `POST /api/design` reference (fixtures.ts:92).
5. **Implement the other four constraint checks** in pipeline.ts and add `aquiferReliable?: boolean` to Parcel (types.ts) so ARCHITECTURE.md:37/42 stop overstating: FDWR > 0.22 → flag "paid energy-model path"; aquifer unreliable → default cistern + warning; solar sizing vs December floor (1.3 kWh/kW/day); SIP chase-freeze note in the brief. Each is ~10 lines and each is a marketed differentiator.
6. **`git init` was done — now commit and push.** First commit with proper attribution (Matt-Aurora-Ventures, Co-Authored-By Claude), push to github.com/kr8tiv-ai/aura-homes, public. Until this happens, requirement 10's core sentence is false and the hackathon's open-source story has no URL.
7. **Correct the demo data:** questionnaire.sample.json minDwellingSizeSqft 700 → **592**; app/lib/fixtures.ts and the sample stay consistent with ALBERTA-PLAYBOOK.md:15. Fix types.ts:23 comment to "district-mandated (never county — see AI-HANDOFF)".
8. **De-absolutize the "first" claims:** README.md:37 and SUBMISSION.md:31 → "to our knowledge, the first"; rewrite SUBMISSION.md:33 land-filter sentence and README.md:38 "the app knows" in either implemented-truth or roadmap tense. Honesty is the brand; keep it unimpeachable.
9. **Mark intended-vs-current in ARCHITECTURE.md** (one-line status tags: "shipped / stubbed / planned" per subsystem), and fix the hardhat.config.js OP-Stack comment. The continuing-AI audience takes these files literally.
10. **Publish the evidence base:** add `docs/SOURCES.md` (even a categorized link dump of the ~300-source sweep) and link it from README's "300-source" claim and FEASIBILITY's footer. "No black boxes" must include the research.

**Overall verdict:** the documentation layer is world-class and the honesty culture is real — no other hackathon team will show up with FEASIBILITY.md, the Alberta playbook, or a holdback-aware escrow with passing tests. The drift is one-directional: *the docs describe a product roughly 10 days ahead of the code*, and in three places (LAND, the constraint checks, the totals) the gap has hardened into contradiction. Close fixes 1–4 within 48 hours and the repo tells the truth again; leave them and the project's single differentiator — "the repo tells the whole truth" — is the thing a judge can falsify first.

---

*Next audit: append `## Audit #2 — <date>` below this line. Do not edit Audit #1.*
