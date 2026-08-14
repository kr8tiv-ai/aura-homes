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

## Audit #2 — 2026-08-09 (comment coverage)

**Method:** every founder instruction from the build session (23 items), graded against the repo as it runs — fresh context, adversarial. Verification performed this pass: `npx hardhat test` (**10 passing**, output captured), `agent: npm run demo` (**runs**; land verdicts include the district-minimum rejection; budget prints **LOW $199,100 / MID $301,280 / HIGH $443,900** — reconciles to the dollar with cost-model.json, sums re-checked by hand: 181,000×1.10 / 269,000×1.12 / 386,000×1.15), `git log` + `git ls-remote` (1 commit, authored Matt-Aurora-Ventures + Co-Authored-By Claude, **pushed to github.com/kr8tiv-ai/aura-homes**), live testnet RPC read (`eth_chainId` = **1952** confirmed; deployer `0x831F…f260` **nonce 0, balance 0 OKB — NOT deployed**), logo PNG inspected visually (aurora-over-treeline fill, real), scheduled-task registry listed (**no recurring Aura audit job exists**). Audit #1's top fixes are verifiably applied: demo script exists, deploy.js exists, LAND is in the app (`app/app/land/page.tsx`, `agent/src/parcels.ts`), all five constraint checks are in `pipeline.ts` (district min, FDWR, aquifer→cistern, winter battery floor + mandatory generator, SIP chase freeze), sample questionnaire says **592** sqft, totals reconcile everywhere.

### Scorecard — 23 founder instructions

**DONE 15 · IN-REPO-AS-PLAN 5 · GAP 3**

| # | Instruction | Grade | Evidence |
|---|---|---|---|
| 1 | Eco-home AI ground-to-finish, SIPs, smaller architectural, glass where earned | **DONE** | 5-stage pipeline in code (agent/src/pipeline.ts, parcels.ts; 7 app routes built in .next); SIP specs + FDWR check + quint-pane supplier; README "Why SIPs" |
| 2 | USDC on X Layer pays for everything; bridges; crypto loans taught in-app | **IN-REPO-AS-PLAN** | Escrow real + tested; CCTP/bridge path documented (README mermaid, ARCHITECTURE); **loans teaching: suppliers.json:60–61 (Aave V3, Ledn) but zero app surface renders it** |
| 3 | AWG every house, connected; solar; wood stoves; hot tub + deck every home | **DONE** | cost-model.json:18 "standard on every Aura home… plumbed into the cistern loop"; hotTubDeck line + pipeline inclusion; solar-only collided with December physics — collision honestly recorded (FEASIBILITY §1) with generator route, per the never-impossible rule |
| 4 | Off-grid everything, sewage/greywater eco-first, grid-connect option | **GAP (greywater only)** | Septic/Ecoflo + grid-optional done (cost-model.json:19, README); **greywater still only a legality footnote — no product option, no data line, no roadmap owner** (Audit #1 flagged it; still unaddressed) |
| 5 | LAND first-class: find, filter, acquire with USDC | **DONE** | agent/src/parcels.ts filters (district min, aquifer, grid, septic) verified running; app /land page; acquisition path documented (convert-then-close); listing *discovery* is roadmap, labeled as such |
| 6 | Alberta pilot, Alberta-first, cut all middlemen | **DONE** | suppliers.json per-entry `albertaLocal` + basis; ALBERTA-PLAYBOOK; no-middlemen principle in budget engine |
| 7 | One-click feel, normie-usable, ridiculously affordable USDC fee | **IN-REPO-AS-PLAN** | Normie framing shipped (CAD everywhere, card-first door); fee is policy only (OPEN-QUESTIONS #4: free during hackathon); AA = Phase 1 |
| 8 | kr8tiv-ai/aura-homes, MIT from first commit, authorship, hackathon README | **DONE** | Remote verified live with commit a8a7048 (correct author + co-author); LICENSE MIT; README hackathon section + badges. **Flag: ~15 files of post-commit fixes are uncommitted/unpushed — GitHub currently shows the pre-fix repo, including the broken demo script Audit #1 found** |
| 9 | Recolored aura family logo, KR8TIV family design, Tesla/Apple bar, researched BRAND.md | **DONE** | Logo inspected: family silhouette, aurora-over-conifers fill; BRAND.md is real research (Aesop/BCG/Phantom findings, cited sources, honest secondary-source caveat), not filler; "A KR8TIV AI product" in README |
| 10 | Feasibility study — brutal, never "impossible" | **DONE** | FEASIBILITY.md; every risk row has a "route through" |
| 11 | Honest hackathon win assessment | **DONE** | FEASIBILITY §1: 1-in-26 base odds, "top-3 genuinely achievable… a win is not promised" |
| 12 | Submission package ready ASAP | **DONE** | SUBMISSION.md: form answers, tweet, bio, post drafts, demo script, checklist; demo/video links blocked on deploy (see #16) |
| 13 | Groundwork for lesser AI | **DONE** | AI-HANDOFF.md with never-un-learn ledger; its commands now actually run |
| 14 | Token: both paths open, launchpad research, burns, team %, funding-only, invisible, 5 designs, token/USDC pair | **DONE** | TOKEN-RESEARCH.md (launchpads incl. PotatoSwap/X Mint, burn respect/punish list, costs measured live); TOKEN-DESIGNS.md: 5 scored architectures, invisibility-first, vested team 10–15%, USDC pair assumed + flagged for confirmation (OPEN-QUESTIONS #8) |
| 15 | Recurring vision-audit agent loop with authority | **GAP (recurrence)** | AUDIT-LOG.md exists, append-only, authority written into ROADMAP/GRAPH-ENGINEERING — but only Audit #1 preceded this pass and **no recurring mechanism exists** (scheduled-task registry checked: nothing for Aura). A loop that has to be manually remembered is not a loop |
| 16 | Testnet deploy BEFORE submission | **IN-REPO-AS-PLAN — behind schedule** | Hard evidence: deployer nonce 0, 0 OKB, no contract addresses anywhere in repo, task open. Vehicle is ready (scripts/deploy.js, `npm run deploy:testnet`, chain 1952 verified live this pass). ROADMAP D1–2 says this is due *now*; blocker is only faucet OKB |
| 17 | Graph-engineering doctrine adopted | **DONE** | GRAPH-ENGINEERING.md; anchors genuinely enforced (this audit ran them); applied to product + sessions |
| 18 | AI management brain, slip-catching, email, cost-honest models | **IN-REPO-AS-PLAN** | AI-BRAIN.md (tiered T0/T1/T2, distill-later, MCP-first); dashboard renders slip flags + digest preview honestly labeled fixture; no brain service code — owner: ROADMAP Phase 1 |
| 19 | Card-first, Visa buys crypto in-flow, ignore the OKX-Canada gap | **IN-REPO-AS-PLAN** | Card-first is the doctrine everywhere and the escrow page ships the card door as "Recommended" with an honest "integration pending" disabled state; live on-ramp = Phase 1 with named vendors |
| 20 | Wealthsimple truth, respectful, real alternatives | **DONE** | README honesty table + FAQ, FEASIBILITY §1, AI-HANDOFF correction; "integrate Wealthsimple the day they ship crypto collateral" is exactly the respectful framing |
| 21 | README ~4x, maximum why, beautiful graphics | **DONE** | 330 lines; hero/pipeline/budget-bands/escrow-flow PNGs + mermaid; problem/why-Alberta/why-SIPs/FAQ depth; graphics referenced files all exist |
| 22 | Full app + dashboard; both audiences first-class | **DONE (thin, honest)** | 7 routes incl. /dashboard (escrow position, digest, slips, budget-vs-actual) all present in the production build; escrow page offers card AND wallet doors; fixtures labeled as fixtures |
| 23 | Everything audited continuously; keep building | **GAP (same mechanism as #15)** | Building continued (audit-#1 fixes verifiably landed); "continuously" is currently a manual habit, not a mechanism |

### The GAP list, with fixes

1. **Greywater (instr. 4)** — the one vision word with zero product surface two audits running. Fix: add a `greywater` option to the wastewater model (`agent/src/types.ts` + a cost-model.json line for the legal subsurface-drip reuse path FEASIBILITY §4.5 already identifies, with basis), and a sentence in ALBERTA-PLAYBOOK's sewage menu. ~1 hour.
2. **Recurring audit loop (instr. 15/23)** — create the actual recurrence: a scheduled task (or sprint-workflow cron) that re-runs a fresh-context vision auditor every 48h through Aug 21 and appends Audit #N here. Until then the "standing checker node" exists only when someone remembers it.
3. **Crypto-loan teaching in-app (instr. 2 sub-gap)** — suppliers.json's financing entries (Aave V3 on X Layer, Ledn) are rendered nowhere. Fix: a small "Financing, honestly" panel on /budget or /escrow reading the financing category from the directory. ~1 hour, and it closes the last "taught in-app" verb.

### Flags (not gaps, but act today)

- **Push the fixes.** ~15 modified files (README, pipeline.ts, escrow page, samples…) are local-only; the public GitHub repo still contains the broken `npm run demo` and 4-stage pipeline Audit #1 caught. One commit erases the gap between the repo's truth and GitHub's.
- **Deploy is the critical path** (instr. 16): claim faucet OKB for `0x831Fb0C6f8A96dE7c7253bF76C98a780d6E0f260` and run `npm run deploy:testnet` — everything downstream (hosted demo, video, submission links, X posts 2/4) queues behind it, and D1–2 is already today.
- Minor: `pipeline.ts` DEFAULT_COST_MODEL doc-comment still cites the retired $185K/$290K/$465K baseline (the repo model overrides it at runtime, but the comment is the exact stale-number pattern Audit #1 existed to kill).

**Verdict:** 15 of 23 founder instructions are done with evidence, 5 are honestly planned with owners, 3 have gaps — and the three gaps are all small (greywater data line, an actual audit cron, one financing panel). The dangerous items from Audit #1 (arithmetic, LAND, broken commands, missing checks) are verifiably fixed and verified by execution this pass. The two things standing between this repo and its own claims are operational, not creative: **push the commit, deploy to 1952.**

---

## Audit #3 — 2026-08-09 (leave nothing undone)

**Method:** the full session's 24-item founder ledger, graded adversarially with executed anchors — nothing accepted from docs alone. `app\` untouched (live agent is rebuilding it); app-level visual items graded IN-FLIGHT per the founder's order.

**Anchors executed this pass (all green):**
- agent `npm run demo` — LOW **$199,100** / MID **$301,280** / HIGH **$443,900** ex-land; Lakeside Estates **REJECT** (1,076 sqft Country Residential minimum vs 800 sqft design, district-not-county wording intact); 2 constraint notes (winter battery floor, SIP chase freeze).
- agent `npm run brain` — journey state, 4 slips (1 CRITICAL), guidance, digest; `npm run memory` — **PASSED, 27 PASS checks printed** (session logs said 26 — actual count is one higher, all green); `npm run mcp:smoke` — **11 tools incl. `journey_memory`**, x402 paid tier: 402 challenge on eip155:1952 / native testnet USDC / $0.01, honest simulated-settlement receipt, **SMOKE PASSED**.
- contracts `npx hardhat test` — **10 passing**; `npm run demo:lifecycle` — fund → 2-of-3 → 90/10 release → early holdback grab **REVERTED HoldbackNotMatured()** → +60d release → arbiter tie-break on milestone 2 → **RECONCILED TO THE DOLLAR: YES**.
- cost-model sums re-verified by hand: 181,000×1.10 / 269,000×1.12 / 386,000×1.15 = the published totals, AWG line included; inc-land = ex-land + 75/150/350K exactly.
- git: `main` == `origin/main` @ 721ee3d, all commits authored Matt-Aurora-Ventures <lucidbloks@gmail.com>; only `app\` files dirty/untracked (owned by the live landing agent) — Audit #2's "push the fixes" flag is resolved.
- Live web: **6/6 Pages URLs 200** (/, /land, /design, /budget, /escrow, /dashboard); GitHub og:image serves from `repository-images.githubusercontent.com` (social card set); **7 open issues (#1–#7) + 11 repo topics** live via API.
- Live RPC: deployer `0x831F…f260` balance **0x0**, nonce **0x0** — testnet deploy still pending the faucet captcha.
- `claude mcp list`: **blender ✓ Connected**; scheduled-tasks registry: **aura-vision-audit registered, cron `0 7 */2 * *` (every 2 days, 7 AM), enabled, next run Aug 10** — the recurrence Audit #2 called a GAP now exists as a mechanism.

**Scorecard — 24 ledger items: DONE 22 · IN-FLIGHT 1 · HUMAN-GATED 1 · GAP 0**

| # | Item | Grade | Evidence (anchor) |
|---|---|---|---|
| 1 | Feasibility study + win assessment | DONE | FEASIBILITY.md incl. odds/collisions; Audit #2 verified §1 |
| 2 | Public MIT repo, authorship, hackathon README | DONE | git/API verified; LICENSE MIT; README §14 + footer credit |
| 3 | Logo family, brand, BRAND.md, typography v2 | DONE | assets/ present; BRAND.md type table (Space Grotesk/Manrope/JetBrains Mono, OFL); in-app application rides the landing rebuild |
| 4 | Social preview card set on GitHub | DONE | live og:image = repository-images URL |
| 5 | README WorldClaw rhythm, no-concrete, DIY-or-hire, agent-first | DONE | 427 lines; kickers 01–19; FIG. 1–4; §01 no-concrete para; §01/§05 DIY-or-hire |
| 6 | AWG standard + totals reconcile everywhere | DONE | demo = cost-model = README table/FAQ = FEASIBILITY §6 (~$199K/$301K/$444K); one stale parenthetical fixed (below) |
| 7 | Card-first Visa + Wealthsimple truth + Aave/Ledn | DONE | README §06 + honesty table; FEASIBILITY; suppliers.json financing entries |
| 8 | No-concrete research + playbook + README + VISION 6b | DONE | research/FOUNDATIONS-NO-CONCRETE.md; cost-model foundation basis; VISION.md:17 |
| 9 | Greywater product spec (biofilter + drip, SOP 8.5) | DONE | cost-model septic line (Ecoflo + subsurface drip, SOP 8.5); types.ts; brain guidance; MCP fact — **closes Audit #2 GAP #1** |
| 10 | DIY-or-hire + contractor sweep | DONE | README:47, VISION:36, ROADMAP:24, issue #7 open |
| 11 | LAND first-class + district-minimum REJECT | DONE | demo + MCP `check_parcel` both REJECT; /land live |
| 12 | Escrow + registry 10/10, lifecycle demo reconciles | DONE | executed this pass, output above |
| 13 | Testnet deploy | **HUMAN-GATED** | faucet captcha only; 0 OKB / nonce 0 re-verified; DEPLOYMENTS.md one-command path intact |
| 14 | GitHub Pages demo live | DONE | 6/6 200s; deploy predates the landing rebuild — **redeploy Pages after it lands** |
| 15 | Aura Brain + memory pipeline + AI-BRAIN.md | DONE | brain/memory green; Memory section + @0xWast3 credit at AI-BRAIN.md:15 |
| 16 | MCP server 11 tools + x402 metering | DONE | smoke output above |
| 17 | TOKEN-RESEARCH + TOKEN-DESIGNS (5) + USDC-pair flag | DONE | 5 architectures §§1–5; OPEN-QUESTIONS #8 |
| 18 | Graph doctrine + recurring 48h audit task | DONE | GRAPH-ENGINEERING.md; task registered + enabled — **closes Audit #2 GAP #2** |
| 19 | Blender MCP installed/connected/documented | DONE | research/BLENDER-MCP.md; `claude mcp list` Connected |
| 20 | Submission package current | DONE | SUBMISSION.md complete; demo link live; contracts correctly marked pending faucet |
| 21 | Contributor flywheel: 7 issues + topics | DONE | verified via API |
| 22 | WorldClaw verdict (skip; no license) | DONE | research/WORLDCLAW.md |
| 23 | CREDITS.md exists + complete | **IN-FLIGHT** | file exists, non-empty (MengTo + all GLBs); the live agent added the `lantern.glb` row (CC0, Kay Lousberg) mid-audit — complete as of this writing, but the rebuild is still running and nothing is committed, so the final check belongs to the pre-commit pass |
| 24 | Vault bullet | DONE (noted) | top log bullet 2026-08-09 records the session and names this audit in-flight; parent session owes one closing bullet when the rebuild + audit conclude |

**Small fixes applied this pass (docs only):**
1. FEASIBILITY.md §6 totals note said "(optional AWG module excluded)" — false both ways: the AWG is standard (not optional) and the computed totals *include* it. Rewritten to match cost-model.json's totalsRule. Sums re-verified after the edit.

**Flags (not gaps — routed, not dropped):**
- `lantern.glb` credit landed mid-audit (item 23) — verify the CREDITS table still covers every file in `app/public/models/` at the pre-commit pass, since the rebuild is still adding assets.
- Pages redeploy after the landing rebuild lands (item 14) — owner: landing agent / next session.
- Audit #2 GAP #3 (in-app financing panel rendering the Aave/Ledn entries) is **still open at the app layer** — grep of `app\` finds no Aave/Ledn/financing surface. Not in this ledger's 24 items (item 7 requires documentation, which is done), but it must not vanish: assign to the landing agent's brief or the next session.
- CREDITS.md is cross-linked only from BRAND.md; a README repo-map row would aid discoverability (README is outside this pass's fix zone).

**Verdict:** zero GAPs. 22 of 24 done with executed evidence; the one IN-FLIGHT item is owned by a live agent; the one HUMAN-GATED item is a 30-second captcha. Both of Audit #2's repo-side gaps (greywater, audit recurrence) are verifiably closed; its third rides with the app rebuild. The critical path to submission is unchanged and entirely founder-side: **claim the faucet, deploy to 1952, create @AuraHomesAI, submit.**

---

## Audit #4 — 2026-08-09 (post-white-flip)

**Method:** fresh-context full verification after the light-brand flip and the white 3D site, per the founder's standing order. Delta since Audit #3 plus the standing anchors — everything below executed or fetched live, nothing accepted from docs. Note: the landing agent was actively committing during this audit (`6c74cab` "Entry-scene elevation" landed and pushed mid-pass); one app build attempt collided with it (corrupted `.next`, `clientModules` TypeError) — a clean rebuild then passed twice, so the anchor is green and the failure was contention, not code.

**Anchors — ALL GREEN, executed this pass:**
- contracts `npx hardhat test` — **10 passing** (escrow happy path, holdback maturity revert, 2-of-3, arbiter tie-break, cancel; registry mint/permissions).
- agent `npm run demo` — **LOW $199,100 / MID $301,280 / HIGH $443,900 ex-land** — equals `data/alberta/cost-model.json` to the dollar; sums re-verified by hand this pass (181,000×1.10 / 269,000×1.12 / 386,000×1.15; inc-land = ex-land + 75/150/350K exactly). Lakeside Estates **REJECT** intact (1,076 vs 800 sqft, district-not-county wording); 2 constraint notes (winter battery floor 30→42 kWh, SIP chase freeze).
- agent `npm run brain` — journey state, **4 slips (1 CRITICAL)**, digest renders with reconciling money position; `npm run memory` — **MEMORY DEMO PASSED** (all PASS checks green); `npm run mcp:smoke` — 402 challenge on eip155:1952 / native testnet USDC `0xDec9…b9B3` / $0.01, honest simulated-settlement receipt, **SMOKE PASSED**.
- app `npm run build` — ✓ 10/10 static pages, 8 routes (/, /_not-found, /budget, /dashboard, /design, /escrow, /land, /overview); `GH_PAGES=1 npm run build` — ✓ exit 0, `out/` complete with CNAME.

**Live web — verified over the wire:**
- **7/7 pages 200 over HTTPS** at aurahomes.fun (/, /land, /design, /budget, /escrow, /dashboard, /overview); **http→https 301** confirmed.
- The served homepage IS the white 3D journey site: beats `01 · Land` … `05 · Build`, in-scene **"Step inside the dashboard →"** and end-CTA **"Open the build dashboard →"** — matching `app/components/story/copy.ts` exactly.
- GitHub repo og:image serves from repository-images.githubusercontent.com — **downloaded and inspected: the LIGHT card** (paper ground, light-native mark, ink/emerald wordmark). README on main: **all 11 image refs resolve** (6 shields badges with light labelColor + hero/section-rule/pipeline/budget-bands/escrow-flow); `hero.png` inspected — light, LAND-first 5-stage strip.
- Live RPC: `eth_chainId` **0x7a0 (1952)**; deployer `0x831F…f260` **balance 0x0, nonce 0x0** — testnet deploy still faucet-gated (captcha), unchanged.
- `x.com/AuraHomesAI` → **404** — account still uncreated, expected human gate.
- GitHub issue **#3 CLOSED** (2026-08-09T21:28Z, Parkland/Sturgeon minimums verified); #1, #2, #4–#7 remain open.

**White-flip verification:**
- BRAND.md is **v3 light-first** with the "Benchmarked against the best (Aug 2026)" subsection (Apple/Stripe/Linear/Airbnb five-pattern check) ✓.
- AI-HANDOFF rule 7 records **light-as-canonical** (Aug 9, founder's standing direction) and carries the four newest never-un-learn bullets: **Aura-AI brand collision** (Rkcr7 proctoring-evasion repo), **elevated-floor R-28.5 rule**, **crypto rails hidden in consumer UX**, **"AI is the architect" legally impossible → review-ready package + productized seal** ✓.
- Dark-mandate grep across README + docs: README clean; **three stragglers found and fixed this pass** (see fixes).
- **One white-flip MISS found at the app layer** (contradiction #2 below): the live site's own og:image is still the dark pre-flip card.

**NotebookLM integration — verified:**
- cost-model.json `unbudgetedItemsIdentified`: **3 entries** (elevated-floor assembly over unheated space, P.Eng screw-pile stamp as its own line, deeper piles on wind-washed bare soil), **no amounts (TBD)**, totals **UNCHANGED at 199,100/301,280/443,900** ✓.
- ALBERTA-PLAYBOOK: **green financing** (CEIP with verified municipal rates and the corrected Greener-Homes **$40K** cap, CMHC refund), **grid-tied tier truth** (~35¢/kWh Solar Club exports, AR 27/2008 100–110% sizing, Pre-Solar 180-day enrollment), **Notarius/ConsignO + ASET P.Tech** stamping path, **verified Parkland** (only minimum in the LUB is the 30.0 m² accessory-suite floor; principal dwellings none) and **Sturgeon** (minimums eliminated except R2 Country Estate 1,076 sqft; "strongest pilot jurisdiction") ✓.
- OPEN-QUESTIONS holds the two strategic forks: **#10 A277 factory-modular vs site-built SIP**, **#11 off-grid flagship vs grid-tied default** ✓ (+ #12 code follow-up for the Sturgeon sample parcel, correctly assigned to the agent package owner).

**Deltas since Audit #3 (all verified):** the white flip landed end-to-end (BRAND v3, condensed light README, light GitHub card, white 3D journey site deployed at aurahomes.fun with dashboard docking); NotebookLM insights integrated (b910f8d); custom domain live with HTTPS + 301; Audit #3's CREDITS flag **resolved** (all 6 GLBs in `app/public/models/` have rows incl. `lantern.glb`, and the new `forest-ambience.mp3` is credited founder-owned); Audit #2's stale `pipeline.ts` $185K comment **gone**; Audit #2 GAP #3 **CLOSED** — the escrow page now renders the Financing panel (Aave V3 on X Layer + Ledn, "Educational, not financial advice") and it is **served live** at aurahomes.fun/escrow/.

**New contradictions found, with fixes:**
1. **The story page's budget-band basis says "780 sq ft"** (`app/components/story/Story.tsx:54`, committed on main AND served live) — the reference build is **800 sqft** everywhere else (cost-model `referenceHome`, README §BUDGET/FIG.3/district-trap, the demo design, the REJECT copy). One-line fix, 780 → 800 — **app source, owner: main session/landing agent** (this audit does not touch `app\`).
2. **The live site's og:image is still the DARK pre-flip card.** `app/public/social-card.png` (1280×640, night render) is what aurahomes.fun serves as og:image + twitter:image; the light **`assets/site-card.png` (1200×630) exists but was never copied into `app/public/`**, and `app/app/layout.tsx:23` declares 1200×630 for the 1280×640 file. Every share of aurahomes.fun renders dark — the one surviving dark marketing surface. Fix: copy `assets/site-card.png` → `app/public/site-card.png`, point `layout.tsx` og/twitter images at `/site-card.png` (declared dims become true), redeploy Pages — **owner: main session/landing agent**. BRAND.md:127 annotated meanwhile so the doc no longer states intent as fact.
3. **VISION.md:23 still mandated "same dark premium design language"** — the last dark-only mandate in the repo, contradicting BRAND v3 + AI-HANDOFF rule 7. **Fixed this pass** using the vision doc's own inline-correction pattern: records the founder's Aug 9 dark→light pivot and points to BRAND.md v3.
4. **ARCHITECTURE.md:46 described the app's design language as the dark system** (`#050807` ground, off-white type) as current fact. **Fixed this pass**: rewritten light-first (paper/ink/emerald, violet rationed to on-chain, dark only inside framed media + favicon chip), per BRAND.md v3.
5. **SEO.md §5.2 specified `theme-color #050807`** (pre-flip) for the white site. **Fixed this pass**: → `#fafaf9`. (Minor observation, not a defect: the deployed app emits no theme-color meta at all; adding it rides with fix #2's redeploy.)

**Fixes applied this pass (docs only, per the never-touch-source rule):** VISION.md:23 pivot annotation; ARCHITECTURE.md:46 light-first rewrite; SEO.md theme-color; BRAND.md:127 spec-vs-live annotation. Nothing in `app\`, `agent\`, `contracts\`, or `data\` was modified; cost-model arithmetic re-verified untouched.

**Verdict — pass/fail per category:** anchors **PASS** (contracts 10/10, demo reconciles to the dollar, brain/memory/smoke green, both app builds green); live site **PASS** (7/7 + 301 + journey content + light GitHub card + README assets); white flip **PASS with one app-layer miss** (the dark live og:image, fix #2); NotebookLM integration **PASS** (all five artifacts verified); human gates **UNCHANGED** (faucet 0 OKB / nonce 0; @AuraHomesAI uncreated). **12 days to the Aug 21, 23:59 UTC deadline.** Critical path per SUBMISSION.md, still entirely founder-side: claim the faucet (30-second captcha) → `npm run deploy:testnet` → create @AuraHomesAI → build-in-public posts → demo video → submit. The repo-side items for the next session's hands: Story.tsx 780→800, the site-card swap + Pages redeploy.

---

## Audit #5 — 2026-08-10 (scheduled)

**Method:** fresh-context scheduled pass. Every anchor executed, every live claim fetched over the wire, nothing accepted from docs. Note: a live agent is mid-flight on `app/components/story/SceneDetail.tsx` (grass v8, uncommitted, mtime 07:56 UTC) — both app builds below compiled the working tree *including* that change and passed, so the anchor is green with the in-flight work present. Per convention this audit did not touch `app\`.

**Anchors — ALL GREEN, executed this pass:**
- contracts `npx hardhat test` — **10 passing (21s)**: escrow happy path, holdback-maturity revert, 2-of-3, arbiter tie-break, cancel/refund, custom bps; registry mint + permissions.
- agent `npm run demo` — **LOW $199,100 / MID $301,280 / HIGH $443,900 ex-land**, equal to `cost-model.json` `totalsExLand` to the dollar. Re-derived from the raw lines this pass: the 12 non-land items sum to 181,000 / 269,000 / 386,000; ×(1.10 / 1.12 / 1.15) → exactly the published totals; `totalsIncLand` = ex-land + the land line (75/150/350K) = 274,100 / 451,280 / 793,900, exact. Lakeside Estates **REJECT** intact (1,076 vs 800 sqft, district-not-county wording); 2 constraint notes.
- agent `npm run brain` — 4 slips (1 CRITICAL), reconciling digest; `npm run memory` — **MEMORY DEMO PASSED**; `npm run mcp:smoke` — **SMOKE PASSED**, 402 on eip155:1952 / native testnet USDC `0xDec9…b9B3` / $0.01 / honest simulated-settlement receipt.
- app `npm run build` — ✓ 10/10 static pages, 8 routes. `GH_PAGES=1 npm run build` — exit 0, `out/` 75 files, `CNAME` = aurahomes.fun, `out/social-card.png` = the light card.
- git — `main` == `origin/main` (0/0) @ `15b8c6a`; **all commits authored `Matt-Aurora-Ventures <lucidbloks@gmail.com>`**; repo public, MIT, 11 topics, 6 open issues. Working tree **not clean**: the live agent's `SceneDetail.tsx` plus this audit's three doc edits. Nothing pushed (per standing rule).
- Live: **7/7 pages 200** at aurahomes.fun; Pages is **current** — `enter.mp4` serves at byte-identical 3,605,816, last successful Pages deploy 05:07 UTC today.
- Live chain: `eth_chainId` **0x7a0 (1952)**; deployer `0x831F…f260` **balance 0x0, nonce 0x0**.

**Audit #4's open items — 3 of 5 resolved:**
| # | Item | Status |
|---|---|---|
| 1 | Story.tsx budget basis 780 → 800 sqft | **RESOLVED** — `Story.tsx:104` reads "800 sq ft"; commit `cea6364` |
| 2 | Live og:image still the dark pre-flip card | **RESOLVED end-to-end** — `app/public/social-card.png` is now SHA-identical (`86865D2F…`) to `assets/site-card.png`, 1200×630 matching the declared dims; fetched from aurahomes.fun and **inspected visually: it is the light paper card** |
| 3 | No `theme-color` meta emitted | **STILL OPEN** (minor) — absent from `layout.tsx` and from the served HTML |
| 4 | Testnet deploy | **STILL OPEN** — human-gated on the faucet captcha; nonce 0 / 0 OKB re-verified live |
| 5 | @AuraHomesAI uncreated | **STILL OPEN** — `x.com/AuraHomesAI` → 404 |

**New contradictions found:**
1. **A settled fact regressed.** `docs/research/MARKET-AND-USDC-FEASIBILITY.md:133` (added Aug 9, commit `52c8319`) asserted under the words *"Chain facts, verified"* that X Layer **"runs Polygon CDK as a zkEVM L2"** with **"~2s blocks"**. Audit #1 (contradiction #10) already settled this the other way, and `TOKEN-RESEARCH.md:38` + `hardhat.config.js:12` both record the **migration to OP Stack**. Verified live rather than by citation: the OP Stack predeploys `0x4200…0015` / `0x4200…0016` / `0x4200…000F` all carry code, all with identical EIP-1967 `Proxy` bytecode (the OP Stack uniform-predeploy signature), while control addresses — including the non-standard `0x4200…9999` — return `0x`, so the probe can fail and didn't. Measured block time **1.000 s/block** over both 1,000- and 10,000-block windows. **Fixed this pass** with the evidence recorded inline.
2. **Registry status vocabulary disagrees with the contract.** `PHASED-ROADMAP.md:78` specifies the NFT lifecycle as **Reserved → Contracted → UnderConstruction → Complete**; `AuraBuildRegistry.sol:16–20` is **Designed → Funded → UnderConstruction → Complete**, and `SUBMISSION.md:32` matches the contract. PHASED-ROADMAP is the outlier, and the enum change is not listed in its own "What's needed" table. **OPEN — product decision, deliberately not resolved by this loop.** Fix: either add the enum change to the Phase-1 contract work or restate line 78 in the shipped vocabulary.
3. **Two canonical 90-second demo scripts now exist.** `SUBMISSION.md:69` (questionnaire → design + budget → escrow → roadmap) vs `PHASED-ROADMAP.md:88` (chatbot → parcel rejection → BUY in USDC → registry flip → refund window). The pivot did not update the doc judges actually read. **OPEN.** Fix: pick one and make SUBMISSION.md agree with it.
4. **X handle drift** — `@AuraHomes` in `ROADMAP.md:21` and `FEASIBILITY.md:123` against canonical `@AuraHomesAI` in six other places, on an account that does not exist yet and is about to be created from these instructions. **Fixed this pass** (both → `@AuraHomesAI`, with the fallbacks named).

**New gap — the Aug 9 pivot has no code behind it (the material finding).** Commit `b8d8bba` made `PHASED-ROADMAP.md` "the shared plan", re-cutting the hackathon MVP's front door to **retailer catalog + AI chatbot concierge + BUY button**, explicitly replacing questionnaire-first. With 11 days left, none of that front door exists: a grep of `app\` for `chatbot|concierge|catalog|reservation|Boxabl` returns **zero hits**; there is no three-home catalog; and the escrow has no reservation-deposit or cooling-off refund window (only the 2-of-3 `cancel()`). The live front door is still the questionnaire-first 3D story plus /land /design /budget /escrow /dashboard /overview. To its credit PHASED-ROADMAP's "What's needed" table states all of this honestly, so this is **IN-REPO-AS-PLAN, not an inflated claim** — but the project now carries two plans describing two different products, and the demo script in the newer one cannot currently be filmed. **This is the single largest drift risk on the board.** Fix: the founder picks one front door this week; if the pivot stands, SUBMISSION.md and the demo script move with it and the catalog + concierge + refund window become the only feature work.

**VISION.md scorecard — 16 requirements (1–15 plus 6b): DONE 11 · IN-REPO-AS-PLAN 4 · GAP 1**

| # | Requirement | Grade | Evidence |
|---|---|---|---|
| 1 | Eco-home AI, ground to finish | IN-REPO-AS-PLAN | `pipeline.ts` runs LAND→DESIGN→BUDGET→milestones end to end; BUILD orchestration is docs only |
| 2 | SIP construction | DONE | cost-model SIP lines; chase-freeze constraint fires in the demo |
| 3 | Crypto-native USDC funding | IN-REPO-AS-PLAN | escrow 10/10 tested, correct native-USDC addresses, x402 metering — but settlement is simulated and nothing is deployed |
| 4 | LAND first-class | DONE | `parcels.ts` implements all four filters; /land live; REJECT fires |
| 5 | AI is the architect | DONE (as corrected) | `claude.ts` + pipeline produce a **review-ready package**; the legal correction is honored throughout |
| 6 | Off-grid, AWG standard | DONE | AWG is a non-optional cost line; winter-solar-floor check raises battery 30→42 kWh |
| 6b | No-concrete foundations | DONE | screw piles in cost model; FOUNDATIONS-NO-CONCRETE.md; VISION:17 |
| 7 | Lifestyle layer | DONE | hot tub + deck in the cost model and in the 3D scene |
| 8 | One-click, card-first | IN-REPO-AS-PLAN | `/escrow` renders the card-first choice with an explicit "on-ramp pending, not live yet" — honest, not integrated |
| 9 | Alberta pilot | DONE | playbook, suppliers.json, verified Parkland/Sturgeon minimums |
| 10 | Radically open | DONE | public MIT repo, 6 open issues, this log published |
| 11 | Ridiculously affordable | DONE (as designed) | $0.01 x402 tier |
| 12 | KR8TIV brand, light-first | DONE | BRAND v3; light card verified live by eye |
| 13 | Hackathon vehicle | **GAP** | contracts undeployed (nonce 0), X account 404, video unmade — all human-gated |
| 14 | Built to be continued | DONE | AI-HANDOFF + GRAPH-ENGINEERING + this log + MASTER BRIEF |
| 15 | The app runs on AI | DONE | brain / memory / slips / digest all execute green |

**Hackathon clock: 11 days 9 hours to Aug 21, 2026 23:59 UTC.** Critical path per SUBMISSION.md: testnet deploy **BLOCKED** on a 30-second captcha (unchanged for four consecutive audits — this is now the longest-standing item in the log); hosted demo **DONE** (7/7 live, Pages current); 90s video **BLOCKED** on both the deploy and the unresolved front-door question; X account **NOT STARTED**, and "judges weigh an *active* account" means the cost of the delay compounds daily; Google Form **pre-written, awaiting links**. Verdict: **on track only if the faucet is claimed this week** — every remaining build gate queues behind it.

**Fixes applied this pass (docs only):** MARKET-AND-USDC-FEASIBILITY.md:133 CDK→OP Stack + 2s→1s with live evidence; ROADMAP.md:21 and FEASIBILITY.md:123 @AuraHomes→@AuraHomesAI. Nothing in `app\`, `agent\`, `contracts\`, or `data\` was modified; cost-model arithmetic re-verified untouched after the edits.

**State of the project (3 lines):**
The machine is sound — every anchor green, the money reconciles to the dollar from raw line items, the live site is current, and Audit #4's two app-layer misses are genuinely closed.
The danger has moved from execution to direction: an Aug 9 pivot re-cut the hackathon front door in a doc, nothing was built behind it, and the submission package still describes the old product.
Eleven days out, the two things that decide this are both one decision each — claim the faucet, and pick which front door ships.

---

## Audit #6 — promised vs built (rollout kickoff) — 2026-08-10

*(The founder's brief numbered this pass "Audit #5"; the scheduled 06:30 audit claimed that number hours earlier, so this is #6. Nothing else changes.)*

**Method:** a full promise sweep — README (§01–§17, including the 22-step journey table and its LIVE/PARTIAL/SPEC labels), ROADMAP.md (as of today's three-arc rewrite), VISION.md, PHASED-ROADMAP.md, and all 7 GitHub issues — with every promise graded **BUILT** (runs today, verified), **DEMO-ONLY** (exists but simulated/fixture-backed), or **PROMISED** (specified, not built). This list is the marching order for the next session.

### The ledger

**BUILT — runs today, anchors green (per Audit #5's executed pass + this session):**
- Land verdict engine with bylaw citations (`agent/src/parcels.ts`, /land, the Lakeside REJECT).
- Design brief pipeline + 5 constraint checks, offline-deterministic (`agent` demo reconciles to the dollar).
- Line-item Alberta budget + milestone schedule (totals rule frozen, exact).
- `AuraBuildEscrow` + `AuraBuildRegistry` — written, 10/10 tests (the *contracts* are built; the *chain* is not — see DEMO-ONLY).
- Aura Brain phase 0: slips, memory, digest render, MCP smoke — all execute green.
- The 3D story site + 8 app routes live at aurahomes.fun — including, from this session: the /faq page, the three-arc rollout story on /overview, the DIY-or-hire budget view, and the site-wide hover/tracer interactivity round.
- **Moved from PARTIAL to BUILT today:** the DIY-or-hire *display* half of issue #7 — `ownerBuildable` + basis now rendered per line on /budget with working owner-buildable / licensed filters and honest subtotals.

**DEMO-ONLY — exists, labeled, not yet real:**
- Escrow on-chain: contracts undeployed (testnet nonce 0, faucet-captcha-gated for four consecutive audits); /escrow and /dashboard run on fixtures.
- x402 design-fee metering: demo runs, settlement simulated.
- Design "live AI mode": offline fallback ships; live mode awaits a key (OPEN-QUESTIONS #6).
- /budget renders a fixture mirror of `cost-model.json` — reconciled today (flags re-checked against the model this session), but a mirror is a standing drift risk.

**PROMISED — specified and issue-tracked, zero code:**
- The Aug 9 pivot front door: retailer catalog + concierge chatbot + BUY button + reservation-deposit/refund-window escrow semantics (PHASED-ROADMAP Phase 1 — still the largest drift risk on the board, unchanged since Audit #5).
- Realtor matching; offer/closing/title flow (README steps 7–9); card on-ramp (issue #1); contractor research sweep (issue #7, research half); ordering/inventory (step 18); trade coordination (step 19); finishing/interior/furniture (step 21); IFC export (issue #4); second catalog home (issue #6); escrow pre-audit package (issue #5); digest email delivery (issue #2); the Arc 2 Locality Hub surface (vendor directory in USDC, contractor payments, build tracking, tech discovery).

### Top 5 next builds for the rollout (user value × feasibility), the marching order

| # | Build | Why now | One-line plan |
|---|---|---|---|
| 1 | **Concierge chatbot wired to an order object** | It IS the Arc-1 pitch; the demo script cannot be filmed without it | A /concierge chat flow driving questionnaire → brief → parcel check → order state, offline-deterministic first, model behind an env key — a thin driver over the pipeline that already runs |
| 2 | **Reservation deposit + refund window in the escrow** | The only contract work in Arc 1; unlocks the BUY-in-USDC moment and the registry status flip on camera | New deposit milestone semantics + cancel-within-window + tests; resolve the registry-enum vocabulary contradiction (Audit #5 finding #2) in the same change |
| 3 | **Three-home catalog with priced line items** | PHASED-ROADMAP storefront requirement; absorbs issue #6's A-frame | Catalog data + /design catalog section reusing the budget pipeline, labeled "reference designs priced from published sources" |
| 4 | **Digest email delivery adapter (issue #2)** | The Brain's visible daily value; small and self-contained | Resend/SES-class adapter, env-driven, `emailPrefs` opt-in check, dry-run-to-disk mode |
| 5 | **Escrow pre-audit package (issue #5)** | Required before any mainnet value; writable now with zero dependencies | Threat model + invariant list (fund conservation, holdback monotonicity, role separation) + fuzz targets as a docs/security package |

*(Issue #1 on-ramp and issue #4 IFC rank below the cut: both heavy, neither demo-critical for Aug 21.)*

### This session's own additions, measured

- **Grass v10** ("double it around the house"): filler yard-boost mask (×2 inside ~7 m of the home/deck/fire-pit centroid, feathered to 15 m; second jittered candidate per grid cell) paid for by the far-field trim (radial 26–36 → 20–30 m) and a budget re-balance (870k → 715k planted filler). Worst beat **1,343,928 tris** (2-crest), under the 1.35M ceiling; near-house beats +80–106k tris each; trailhead −61k; mobile worst 597k. Frame pacing improved vs v9 under the same instrument (20.9 ms vs 27.7 ms beat medians). Harness: desktop + mobile, 8 scroll beats, **0 console errors**.
- **Interactivity round:** hover text-glow (CSS, 550 ms, emerald-tinted, hover-capable pointers only) + a WebGL border light tracer (ONE shared canvas/context for all cards — per-card contexts would evict the R3F scene's context; ~11 s/lap, whisper alpha, IntersectionObserver-gated, disabled on coarse pointers and reduced-motion). BRAND.md §2 "no glow anywhere" collision resolved by explicit founder direction Aug 10; the shipped values are the approved ceiling, recorded in `components/CardFX.tsx`.
- **Harness note:** the tracer canvas triggered the flat/dead-canvas check on every app route (a real false positive — the overlay is 99% transparent); `inspect.mjs` now excludes `.fx-tracer-canvas` by class, and the check still fires if the scene canvas dies.
- The founder's design-inspiration post (x.com/abyssallD, Aug 2) was fetched and read: it is an essay on Claude driving Blender through MCP — no layout/typography/color/interaction principles to extract. Its one transferable idea, "success is what the viewport shows, not that the code executed," is already this project's harness doctrine and was applied as such. Recorded honestly rather than invented.

---

## Audit #7 — 2026-08-14 — fresh-context checker

**Method:** fresh-context pass per `docs/plans/execution/next/AL01-audit7.json`, grading the Aug 13–14 wave: the Codex meadow rework and its regressions, the R03I scene restoration, the HOMES token launch and site truth flips, graph v1.2 + registries, the AWG decision, and the scene polish. FAST anchors re-executed this pass; the heavyweight proof (`npm run test:ui`, `scripts/meadow-proof.mjs`) was deliberately NOT re-run (CPU contention poisons its measurements on this machine) — its recorded evidence was audited instead, adversarially. Tree state audited: commit `33e2b3e` plus 8 uncommitted files from an in-flight VT03/voice-calibration wave (README, homes/faq pages, Scene.tsx, homes-ui.spec, VT03-surface.json, NW01, decisions.json); per house convention this audit touched none of them, and file:line anchors below are working-tree.

**Anchors — ALL GREEN, executed this pass:**
- app `npx tsc --noEmit` — exit 0. app `npm test` — **175/175 passed (23.1s)**, including the R03I pins: wind-clock on the atlas (meadow-progressive.spec.ts:430), frameloop contract (:401), mask parity across a 3,000+ point grid (:503), deck/walkway/steps/house bin decode (:516), hardware-proof evidence pins (:454).
- agent `npm run demo` — **LOW $199,100 / MID $301,280 / HIGH $443,900 ex-land**, equal to `data/alberta/cost-model.json` `totalsExLand` to the dollar; Lakeside Estates REJECT intact (1,076 vs 800 sqft, district-not-county wording); 2 constraint notes (winter battery 30→42 kWh, SIP chase freeze).
- contracts `npm test` — **25 passing (9s)**, up from 10: the reservation deposit + refund-window suite is real (exact-deadline refund, one-second-late revert, no double-spend, wei-exact lifecycle accounting), plus registry anchoring and the X Layer network guards (mainnet deployment hard-stop, retired-faucet-token ban).
- Recorded proof audited: `app/shots/r03-meadow/meadow-proof.json` (schema MeadowHardwareProofV3, 01:04 local) — top-level `passes: true` on real hardware (ANGLE AMD Radeon 740M D3D11, `rendererIsSoftware: false`), desktop settled at 44 pages / 23,200 instances, livingWind motionPixelRatio 0.278 against a 0.004 gate, coverage open 1.007× / close 1.83× baseline, both screenshots on disk and hash-pinned in the spec.

### Findings

1. **[MEDIUM] The R03I gates close the shipped deck-piercing class in one direction only — the deck mesh is uncoupled from the clearance field.** The parity gate (tests/meadow-progressive.spec.ts:503–514) pins the atlas generator to `sampleMeadowClearance` point-for-point, and the bin gate (:516–545) decodes `meadow-atlas.bin` against hard-coded rects (deck −3.9,2.95..3.6,6.3; walkway segment 3.45,4.65→5.9,5.35) that duplicate lib/three/meadow/field.ts:54–55. But nothing binds those constants to the rendered deck geometry (SceneDetail.tsx:782–794). Constructed on paper: enlarge or move the deck planks in SceneDetail without touching field.ts — parity passes (generator ≡ runtime field), the bin test passes (bin ≡ the old rect), story-quality and meadow-proof pass (coverage/wind unaffected), and grass pierces the relocated deck on screen. The original regression was exactly a divergent-copies failure ("THE MASK IS ONE FUNCTION", spec:498–502); the mesh remains a third, untested copy of the deck's truth. Fix: derive the mesh footprint and the clearance rect from one exported constant, or add a test that back-projects the deck mesh bounds into the field rect.
2. **[LOW-MEDIUM] The desktop frozen-wind gate is genuinely falsifiable; the mobile one is not a wind gate.** Desktop livingWind requires idle re-render AND ≥0.4% pixel motion in the meadow ROI across 1.2 s (scripts/meadow-proof.mjs:404–409); measured 0.278 — a ~69× margin, and a stilled clock collapses it toward 0, so the shipped class (demand frameloop, stilled uniform, static material) cannot return silently on desktop. The source pin (spec:430–452) layers on top: even a dead-branch evasion that keeps the `windUniforms.uTime.value = t` string alive would still fail the pixel gate. Mobile, however, passes livingWind on `idleRenderEnd > idleRenderStart` alone (meadow-proof.mjs:347) — frames rendered, not pixels moved: a mobile-only wind freeze under `frameloop="always"` passes every gate, and R03I-v1.2.json:47 records mobile `"livingWind": true` as though motion were proven. Fix: give the mobile pass the same motionPixelRatio capture.
3. **[PASS, one stale row] Every live-token claim on /homes maps to a registry row.** Contract `0x642855d557ada1eba8a66014aaff902e6394c0de` + chain 196 render from the single source module (app/lib/homes/token.ts:20–23) ↔ claims.json "HOMES token live on X Layer mainnet 196"; locker-owned liquidity (homes/page.tsx:211, token.ts:36) ↔ the locker row; creator wallet 0x5e8a…41de (:212, token.ts:61) ↔ its row; 60%-of-1% fee mechanics (token.ts:54–55) ↔ the venue-fees row; the declared-zero proof register (:214–218) ↔ the nothing-else-is-live row, enforced at build by `reconcileHomesFeeLedger`; homes-ui.spec.ts:32 pins the XLaunch URL with the address, satisfying the row's stated gate. One row is going stale mid-flight: claims.json's supply-split row still says "verification pending (VT03)" while the uncommitted VT03 surface renders the completed on-chain mint verification (block 67,921,152) — refresh the row in the VT03 commit.
4. **[MEDIUM-HIGH] One real §16 present-tense violation: the launch-policy section on /homes claims the unbuilt trust in the present tense.** homes/page.tsx:279 — "The decentralized property trust treasury supplies and owns the liquidity position… visible before the first public transaction" — and :284 — "A multisig-controlled trust treasury seeds HOMES/USDC and owns the Uniswap V3 position NFT." The same page's proof register says the trust is "Not formed" (:216) and the venue's locker owns the liquidity (:211). This is a bare decentralized-property-trust live claim AND a direct hit on the claim registry's own gate for the liquidity row: "Never phrased as 'trust-owned liquidity' — the locker owns it." The section reads as the pre-launch policy document it once was; after the actual launch went through the XLaunch curve instead, every neighboring section got a future label ("Later rollout · not live", "would") and this one did not. Fix: label the section "Design target · not the live launch" and move its verbs to the conditional. Sweep otherwise clean: "permit-ready" appears only in negative framing (lib/design/blueprint.ts:187–190), "Aura vetted" zero hits, all four Airbnb comparisons are future-framed per the v1.2 copy checklist (copy.ts:177/275, roadmap/page.tsx:71, homes/page.tsx:101–102), and "native USDC" survives only as a true mainnet statement (lib/chains.ts:29) with release-truth.spec.ts:70 banning it across the nine testnet runtime files.
5. **[LOW-MEDIUM] Manifest evidence honesty — 3 sampled, all honest, one traceability gap.** R04-v1.1.json records its own contract violation in the open ("pass-post-hoc": the remote writes ran before the record closed; missing outputs itemized at :61–64) — the failure is a process fact, but the record is exemplary. R05A-v1.1.json's claimed artifact exists on disk (app/shots/r05-film/cwv-proof.json) and its numbers are internally consistent. R03H-v1.1.json honestly records `"zeroIdleFrames": true` as part of its pass — which IS the frozen meadow, blessed by that era's inverted spec; it corroborates R03I's regression ledger rather than contradicting it. The gap: R03I-v1.2.json:29–48 records desktop numbers (23,213 instances, causal 0.7 ms, p95 8.3, wind 0.263, interaction 160/152, coverage 1.85) that match NEITHER the artifact on disk (meadow-proof.json 01:04: 23,200 / 0.4 / 9.6 / 0.278 / 152/104 / 1.83) nor runs 1–2 — the recorded run was superseded when the steps/netting change (90cc4e9) re-ran the proof, and nothing flags the drift because the proof JSON carries no commit hash binding a run to a source state. All values pass in both runs, so nothing is inflated — but a manifest can currently cite a stale run silently. Fix: stamp the git commit into MeadowHardwareProof and require manifest evidence to match the artifact byte it points at.
6. **[PROCESS] The cadence lapse and the repair-limit evasion, confirmed against reality.** Audit #6 closed Aug 10; this is Aug 14 — the 48 h cadence missed the ~Aug 12 window entirely, and the miss coincided exactly with the highest-risk stretch in the log: the Codex meadow rework shipping frozen wind, deck piercing and the un-earned tier cap (R03 regression ledger), and the HOMES token going live. The audit loop exists to catch precisely what happened while it was off. Second: R03 → R03A…R03H is **eight renamed repair nodes against `repairLimit: 1` contracts** — confirmed on disk (docs/plans/execution/r0/: R03A/R03B carry `failedEvidence`, R03C–G sit `blocked`, R03H `verified`), with no founder escalation. Graph v1.2:143–147 already records the evasion and states the new rule (a successor chain spends the SAME repair budget; third consecutive failure escalates to the founder by name) — but the rule is prose only: no manifest schema field or checker counts a chain against its ancestor's budget yet. Until one does, renaming remains cheaper than escalating.
7. **[LOW-MEDIUM] The AWG truth flip is recorded but not propagated.** D-2026-08-14-awg-recommended (registry/decisions.json:12–16) and cost-model.json:24's totalsRule correctly record recommended-not-mandatory with the reference triplet unchanged — and the demo re-verified the money anchor this pass. But the SAME file still labels the line "AWG summer water module (standard on every Aura home)" with basis "standard on every build by founder mandate" (cost-model.json:18), and app/lib/design/materials.ts:21 + :213 still say "on every home" / "standard on every home". The FAQ is compliant (faq/page.tsx:25, pinned by release-truth.spec.ts:20). BQ-AWG (the deselectable budget line) is honestly queued in execution/next/. Fix: one wording pass over cost-model.json:18 and materials.ts in the BQ-AWG change.

**Verdict — per category:** anchors **PASS** (tsc clean, 175/175, demo to the dollar, 25/25 contracts); R03I restoration **PASS with two gate gaps** (findings 1–2: the shipped regression class is closed on desktop, the deck-mesh coupling and the mobile wind gate are the two ways it could return unobserved); token truth flips **PASS with one miss** (finding 4 — one pre-launch section never got its tense flipped; everything else is receipt-first and registry-backed, and the single-source token module is exactly right); registries + graph v1.2 **PASS** (the claim registry works — it caught its own violation in finding 4 by giving this audit the gate to cite); evidence honesty **PASS with a traceability gap** (finding 5); process **FAIL on cadence, recorded-not-enforced on repair limits** (finding 6). State of the project in three lines: the machine is green and the money still reconciles from raw lines; the honesty system now catches most of what it promises to catch, including its own lapses, which is the strongest thing in this wave. The two structural risks are both "one uncoupled copy of the truth" problems — the deck mesh vs the clearance field, and the prose repair rule vs the manifest schema. The audit loop itself was the weakest link this cycle: the worst regressions of the project's life shipped in the exact window the loop was silent.

**Next audit due: 2026-08-16 (48 h cadence resumes, through Aug 21).**

---

*Next audit: append `## Audit #8 — <date>` below this line. Do not edit prior audits.*

---

## Audit #8 — 2026-08-14 (scheduled)

**Method:** fresh-context scheduled pass, run the same day as #7 but after it (#7 closed at commit `8d1c78c`, which this pass audits as HEAD). Every anchor executed; every live claim read over the wire — chain state by JSON-RPC, site by HTTP, contract storage by `eth_call` — nothing accepted from docs. Tree state: `8d1c78c` plus 20 modified + 3 untracked files from the in-flight VT03/AWG/FD1 wave; per house convention this audit touched no in-flight file and no source under `app/`, `agent/`, `contracts/`, `data/`.

**Anchors — ALL GREEN, executed this pass:**
- contracts `npx hardhat test` — **25 passing (1s)**: escrow happy path with 10% holdback + 60-day maturity, 2-of-3, arbiter tie-break, the full reservation-deposit/refund-window suite (exact-deadline refund, one-second-late revert, no double-spend, wei-exact lifecycle), registry mint/permissions/anchoring, and the three X Layer network guards.
- agent `npm run demo` — **LOW $199,100 / MID $301,280 / HIGH $443,900 ex-land**, equal to `cost-model.json` `totalsExLand` to the dollar. Re-derived from the 13 raw lines this pass: 181,000 × 1.10 / 269,000 × 1.12 / 386,000 × 1.15 → exactly the published totals; `totalsIncLand` = ex-land + land line = 274,100 / 451,280 / 793,900, exact. Lakeside REJECT intact; 2 constraint notes.
- app `npm run build` — exit 0, **24/24 static pages, 22 routes**. Also `npx tsc --noEmit` exit 0 and `npm test` **177/177 (6.7s)**, up from 175.
- **Live chain — the deploy is real and independently verified.** `eth_chainId` **0x7a0 (1952)**; escrow `0x4A77…63b5` and registry `0x1195…C32e` both carry bytecode. Every DEPLOYMENTS.md constructor claim re-read by `eth_call` this pass: escrow `usdc` = `0xcB8B…c79D`, `holdbackBps` **1000**, `holdbackPeriod` **5,184,000**, `refundWindow` **1,209,600**, `state` **0**; registry `nextTokenId` **0** (the honest public zero state) and `owner` = the deployer; deployer nonce **4** (was 0 for five consecutive audits). Documented RPC `testrpc.xlayer.tech/terigon` reachable and agreeing. Both OKLink URL spellings in the docs (`x-layer-testnet` and `xlayer-test`) resolve 200 — not a contradiction.
- Live site — **21/21 routes 200** at aurahomes.fun. `/budget` returned one transient 503, then 200 on three consecutive retries (46,181 bytes each); not a defect.
- X — `x.com/AuraHomes_fun` **200** (404 for four consecutive audits).
- git — HEAD `8d1c78c`, **1 commit AHEAD of `origin/main` (`33e2b3e`)**: Audit #7's own commit is unpushed. Authorship **156/157 `Matt-Aurora-Ventures <lucidbloks@gmail.com>`**; the one exception is the initial commit as `Matt Haynes` with the same email. Nothing pushed by this loop, per standing rule.

**The two longest-standing blockers on the board are closed.** Testnet deploy was human-gated on a faucet captcha for five audits (#1, #4, #5, #6, #7) — it is now deployed *and* verified against live storage, not just claimed. The X account was 404 for four audits — it is live. And Audit #5's "single largest drift risk," the two-plans/two-products split that survived #6 and #7 unchanged, is **RESOLVED**: `PHASED-ROADMAP.md` and `GAP-ANALYSIS.md` now open with explicit `[!CAUTION]` archive banners that name the specific facts that changed, `ROADMAP.md` carries an `[!IMPORTANT]` current-framing banner, and `SUBMISSION.md` is declared the one canonical demo script. The retired pivot's front door was not quietly abandoned either — `/concierge`, `/escrow`, `/design`, `/overview` are documented compatibility redirects with the founder's reasoning inline, not stubs.

**Audit #7's open gaps — 3 resolved, 1 fixed this pass, 1 half-open, 2 open:**

| # | Item | Status |
|---|---|---|
| 1 | Deck mesh uncoupled from the clearance field | **OPEN, and the fix aims at the wrong file** — see finding 1 |
| 2 | Mobile wind gate not falsifiable | **RESOLVED** — `meadow-proof.mjs:356` now requires `mobileWindMotion >= 0.004`, identical to desktop (:418) |
| 3 | `claims.json` supply-split row stale | **FIXED THIS PASS** — VT03 is complete (`data/homes/mint-verification.json`, block 67,921,152, 1B HOMES, 94.63% pool / 0.8% creator, read 2026-08-14) and rendered at `homes/page.tsx:131`; the row still said "verification pending" |
| 4 | `/homes` trust claimed in present tense | **RESOLVED** — `homes/page.tsx:279` and `:284` now state DESIGN vs LIVE side by side ("the venue locker holds the liquidity") |
| 5 | Proof carries no commit stamp | **RESOLVED** — `meadow-proof.mjs:511` emits `sourceCommit`, pinned by `meadow-progressive.spec.ts:513` |
| 6 | Repair-limit rule is prose only | **STILL OPEN** — see finding 4 |
| 7 | AWG wording not propagated | **HALF RESOLVED** — see finding 3 |

### Findings

1. **[MEDIUM] The deck-mesh coupling fix targets a file that contains no deck mesh — the misattribution has now propagated into three artifacts.** Audit #7 located the deck mesh at `SceneDetail.tsx:782–794`. That is SceneDetail's *clearance* copy (`:792` — `c = Math.min(c, fade(rectDist(x, z, -3.9, 2.95, 3.6, 6.3), 0.28, 0.95))`), not geometry. The rendered meshes are `Scene.tsx:1657 function Deck` and `Scene.tsx:1789 function Walkway`; SceneDetail contains no `function Deck` and no `planks.push` at all. The new tripwire (`meadow-progressive.spec.ts:507–515`) pins the literal across SceneDetail + `field.ts` + the proof — a genuine win, because SceneDetail's clearance copy was a real third copy — but the test's own comment claims it pins "the deck MESH," and `FD1-shared-scene-geometry.json` repeats the error: its `context` names `SceneDetail.tsx ~L782-794` and its `writeSet` omits `Scene.tsx` entirely. As written, the structural fix would refactor every file except the one holding two of the three meshes. **No shipped bug** — computed this pass, the rendered deck footprint (x −3.600→3.450, z 3.035→6.285, from the 7 plank rows, rim joist, and glass bay) sits inside the clearance rect (−3.9, 2.95, 3.6, 6.3) with margins W 0.300 / E 0.150 / S 0.085 / **N 0.015**. That 1.5 cm north margin is the fragility: an eighth plank row (+0.47) or a deeper nosing pierces the mask with all 177 tests still green. Fix: add `Scene.tsx` to FD1's writeSet, correct the two file:line references, and make FD1's gate back-project the `Deck`/`Walkway` mesh bounds into the clearance rect instead of string-matching a literal.
2. **[LOW] `totalsRule` governs by a schema field that does not exist.** `cost-model.json:24` defines totals as the "sum of **non-optional** line items × (1 + contingencyPct)", but no line item carries an `optional` field — the complete field set across all 13 lines is `key, label, low, mid, high, basis, ownerBuildable, ownerNote`. Today nothing is optional, so the arithmetic is unambiguous and verified exact. But `D-2026-08-14-awg-recommended` promises "a project may descope it, and a descoped budget recomputes from its own lines," and BQ-AWG deliberately implements descoping as UI state only, never as data — so the rule's own vocabulary has no representation in the file it governs. Fix: either add explicit `optional` booleans to the lines, or reword to "sum of all line items in the reference configuration."
3. **[LOW] AWG truth flip still half-propagated.** `cost-model.json:18` and `:24` are corrected ("recommended on every Aura home", founder decision recorded) and the FAQ is pinned compliant by `release-truth.spec.ts:20` — but `app/lib/design/materials.ts:21` ("AWG on every home"), `:213` ("standard on every home") and `:783` ("Standard on every Aura home") still assert the retired mandate. Fix in the BQ-AWG change, and consider extending `release-truth.spec.ts` to ban "standard on every" outside explicitly historical contexts, so this cannot drift back.
4. **[PROCESS] Repair-limit enforcement unchanged since #7 — still prose.** All 14 execution manifests carry `repairLimit: 1`; graph v1.2:144–147 records the successor-chain rule (a renamed chain spends the SAME budget; third consecutive failure escalates by name). No schema field and no checker counts a chain against its ancestor's budget. Renaming a node still costs less than escalating, which is exactly the incentive that produced R03 → R03A…R03H.
5. **[PROCESS] Audit #7 skipped the mandated requirement scorecard.** The standing brief requires grading every VISION.md requirement DONE / IN-REPO-AS-PLAN / GAP with file evidence each pass; #7 delivered findings only. The cost was concrete: requirement 13 sat at Audit #5's **GAP** grade for four days after the Aug 12 deploy that closed most of it, so the log understated the project to anyone reading it. Restored below.
6. **[CREDIT] The anti-drift instinct is load-bearing, and it caught this auditor.** This pass moved to "fix" `DEPLOYMENTS.md:29` ("`24 passing` at the release checkpoint") as a stale number. Checking git first: the suite genuinely was **24** at `ea02d8c` (Aug 11, the deployment checkpoint) and reached 25 only at `5bc9a64` (Aug 13). The line is accurate history; overwriting it would have destroyed a true record to match today. Left untouched. `GAP-ANALYSIS.md` deserves the same credit — its assertions ("nonce 0x0 — no contract has ever been deployed", "escrow v2 does not exist", "10/10 passing") are all false today, and all correctly quarantined behind an archive banner that names each changed fact.

**VISION.md scorecard — 16 requirements (1–15 plus 6b): DONE 11 · IN-REPO-AS-PLAN 5 · GAP 0** *(vs Audit #5's 11 / 4 / 1 — requirement 13 clears GAP)*

| # | Requirement | Grade | Evidence |
|---|---|---|---|
| 1 | Eco-home AI, ground to finish | IN-REPO-AS-PLAN | `pipeline.ts` runs LAND→DESIGN→BUDGET→milestones; 22 routes incl. `/build` `/projects` `/contractors` `/operator/registry`; BUILD orchestration still docs-only |
| 2 | SIP construction | DONE | cost-model SIP lines; chase-freeze constraint fires in the demo |
| 3 | Crypto-native USDC funding | IN-REPO-AS-PLAN | **materially stronger**: escrow + registry deployed on 1952, constructor state verified live this pass; settlement still a valueless test token, no on-ramp, mainnet held by decision brief |
| 4 | LAND first-class | DONE | `parcels.ts` implements all four filters; `/land` live; REJECT fires with the district citation |
| 5 | AI is the architect | DONE (as corrected) | pipeline produces a **review-ready package**; the legal correction is honored throughout |
| 6 | Off-grid, AWG standard | DONE (as amended) | AWG is a costed line, now *recommended* per `D-2026-08-14-awg-recommended`; winter-solar-floor raises battery 30→42 kWh. See finding 3 |
| 6b | No-concrete foundations | DONE | screw piles in cost model; FOUNDATIONS-NO-CONCRETE.md |
| 7 | Lifestyle layer | DONE | hot tub + deck in the cost model and rendered in the scene |
| 8 | One-click, card-first | IN-REPO-AS-PLAN | `/buy` renders the card-first path with the on-ramp labeled pending — honest, not integrated |
| 9 | Alberta pilot | DONE | playbook, suppliers.json, verified district minimums |
| 10 | Radically open | DONE | public MIT repo; this log; archive banners on retired plans |
| 11 | Ridiculously affordable | DONE (as designed) | $0.01 x402 tier |
| 12 | KR8TIV brand, light-first | DONE | BRAND v3; light card verified live in prior passes |
| 13 | Hackathon vehicle | **IN-REPO-AS-PLAN** ⬆ *(was GAP)* | deploy **✓ verified live**, X account **✓ live**, hosted demo **✓ 21/21**; 90s video and Google Form remain |
| 14 | Built to be continued | DONE | AI-HANDOFF + GRAPH-ENGINEERING + registries + this log |
| 15 | The app runs on AI | DONE | brain / memory / slips / digest execute green |

**Hackathon clock: 7 days to Aug 21, 2026 23:59 UTC.** Critical path per SUBMISSION.md: testnet deploy **DONE and verified**; hosted web demo **DONE** (21/21); X account **DONE**, posting cadence not measurable from this loop (six drafts ready); Google Form **pre-written, blocked only on the video URL**; 90-second video **NOT STARTED — now the single longest pole, and founder-gated** (approve/voice/upload). Verdict: **on track.** Every AI-executable build gate is closed for the first time in the project's life; the entire remaining path is founder-only, and the video is the one item that can still miss the deadline.

**Fixes applied this pass (docs only):** `docs/plans/registry/claims.json` — the supply-split row's stale "verification pending (VT03)" replaced with the completed on-chain verification and its reproduction path. JSON re-validated; `npm test` re-run after the edit, **177/177 still green**. `DEPLOYMENTS.md:29` deliberately left unchanged (finding 6). Nothing in `app/`, `agent/`, `contracts/`, or `data/` was modified; cost-model arithmetic re-verified untouched.

**State of the project (3 lines):**
The machine is green on every anchor, the money still reconciles to the dollar from raw line items, and the two blockers that dominated five audits — the testnet deploy and the X account — are closed and verified against live state rather than asserted.
The honesty layer is now the strongest part of the repo: retired plans carry banners naming what changed, the claim registry caught its own violation last pass, and this pass was stopped from destroying a true historical number by checking git before "fixing" it.
What remains is one founder-side artifact — the 90-second video — plus one structural loose end worth doing properly: FD1 must be pointed at `Scene.tsx`, where the deck actually is, before it claims to have coupled the meshes.

**Next audit due: 2026-08-16 (48 h cadence, through Aug 21).**

---

*Next audit: append `## Audit #9 — <date>` below this line. Do not edit prior audits.*
