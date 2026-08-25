# Hackathon Submission Package — BuildX AI Season 2026

*Everything pre-written so submission takes minutes, not hours. Deadline:
**August 21, 2026, 23:59 UTC.** Submission = [the Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfgU_3zcXdxK0GJQxj33QeUWdEcAaYnieVe9p5cFDb2JFQa4Q/viewform)
(also linked from the [hackathon page](https://web3.okx.com/xlayer/build-x-hackathon))
+ an X post from the project account tagging @XLayerOfficial.*

*This file is the CANONICAL home of the demo script — the copy that lived in
[PHASED-ROADMAP.md](PHASED-ROADMAP.md) is a superseded pointer now. The
load-bearing crypto and money claims below map to rows in
[`docs/plans/registry/claims.json`](plans/registry/claims.json);
every founder call maps to a dated row in
[`decisions.json`](plans/registry/decisions.json). Numbers are quoted from their
anchor, never retyped from another document.*

## What changed since the August 12 rewrite

Two facts moved, and the rest of this file is written from them.

1. **$HOMES went live on X Layer mainnet 196** on August 13, 2026, launched by
   the founder through the third-party XLaunch venue. The earlier "no token
   contract" framing is retired. The token is real, it trades, and its mint has
   been read back off-chain.
2. **Aura's own contracts did not move.** The escrow and registry stay on
   X Layer testnet 1952 under the
   [mainnet hold](MAINNET-DECISION-BRIEF.md) recorded August 12. Everything the
   token design describes — trust, staking, property fund, distributions,
   launchpad — is still unbuilt and renders on `/homes` as a declared zero.

That combination is the submission's actual position: one live mainnet asset
with published receipts, one honest testnet lab, and a ledger that refuses to
print a number it cannot prove.

## What is live

| Thing | Status | Where a judge checks it |
|---|---|---|
| Web app, public and hosted | **Live** | [aurahomes.fun](https://aurahomes.fun) — 21 public routes returned 200 in [Audit #8](AUDIT-LOG.md) |
| Local-first project workspace: intake, library, autosave, archive, export | **Live** | [/start](https://aurahomes.fun/start) → [/projects](https://aurahomes.fun/projects) — no account, IndexedDB only |
| Guided and Pro editors over one `BuilderDocument`, 87-plan library | **Live** | [/build](https://aurahomes.fun/build) — every plan names its source and licence |
| Land-fit engine | **Pilot** | [/land](https://aurahomes.fun/land) — sourced example and user-supplied records; not a listing feed or a permit decision |
| Alberta budget, reconciled to the dollar | **Pilot** | [/budget](https://aurahomes.fun/budget) — ex-land $199,100 / $301,280 / $443,900 from `data/alberta/cost-model.json`, re-derived by `agent/ npm run demo` |
| Contractor and manufacturer evidence workbenches | **Pilot** | [/contractors](https://aurahomes.fun/contractors), [/buy](https://aurahomes.fun/buy) — demonstration and user-supplied records, dated, with gaps shown. Aura does not label a provider vetted |
| **$HOMES token** | **Live · X Layer mainnet 196** | [`0x642855…c0de`](https://web3.okx.com/explorer/x-layer/address/0x642855d557ada1eba8a66014aaff902e6394c0de) on [XLaunch](https://xlaunch.fun/token/0x642855d557ada1eba8a66014aaff902e6394c0de), paired wSPCXx, [pool](https://www.geckoterminal.com/x-layer/pools/0xf59d07dfe38807b398f0b4697f187d2f943b06a4), liquidity in the venue locker, creator fee-claim wallet published — all on [/homes](https://aurahomes.fun/homes) |
| Aura's escrow and registry contracts | **Testnet 1952 only** | [escrow](https://www.oklink.com/x-layer-testnet/address/0x4A777bf71d8809244c77A3c2b39ef68793A463b5) · [registry](https://www.oklink.com/x-layer-testnet/address/0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e) — the public state is zero milestones and zero home records |
| HOMES trust, staking, property fund, distributions, launchpad | **Planned — declared zero** | [/homes](https://aurahomes.fun/homes) property pipeline, profit reconciliation, and distribution proof sections render zeros with the receipt that is missing named beside each one |
| Hosted concierge and the bounded VPS API | **In build** | Deterministic brain runs locally today (`agent/`); the hosted path is not part of the production claim |

### The live token, in full

The mint is verified on-chain, not asserted. Read from the public X Layer RPC
and stored with its block number in
[`data/homes/mint-verification.json`](../data/homes/mint-verification.json),
reproducible in seconds with `node app/scripts/verify-homes-mint.mjs`:

| Fact | Value |
|---|---|
| Total supply | 1,000,000,000 HOMES |
| Venue pool `0xf59d…b06a4` | the large majority — exact share in the artifact |
| Creator wallet `0x5e8a…41de` | under 1% — exact share in the artifact |
| Coverage | The published addresses hold all but a fraction of one HOMES. No indexer needed |

**The balances are deliberately not quoted here as numbers, and that is the
point.** They move whenever anyone trades on the venue: an earlier read put the
pool at 94.63%, and by the next it was over 99%, because launch buyers sold back
into the curve. A percentage frozen into a document is a claim that goes stale
without anyone touching it, so the artifact carries the figures and the block
they were read at, and this table carries only what stays true.

That coverage row is also a stronger statement than the one it replaces. The
earlier read said a full holder census would need an indexer; at the current read
the three published addresses account for all but 0.23 HOMES of the billion
minted, so there is nothing left for an indexer to find.

What that distribution describes is a launchpad bonding curve, not the
30/10/10/20/30 design split. The design split is a target and is labelled as one
everywhere it appears.

The risk, stated once: this is a micro-cap launched through a permissionless
venue factory that Aura did not write or audit. It can go to zero, locked
liquidity is not a price floor, and the wrapped-stock quote asset can be paused
by its issuer. Every address is published so a judge can verify rather than
trust.

XLaunch routes 60% of its 1% swap fee to the creator wallet, so one real fee
source exists. It counts as revenue on the HOMES ledger only after claim
transactions publish their receipts — `reconcileHomesFeeLedger` fails the build
on any unreceipted number.

## Checklist

**Matt-only (nobody else can do these):**
- [x] Dedicated X account — **@AuraHomes_fun** is live: https://x.com/AuraHomes_fun
- [ ] Post build-in-public updates every 1–2 days through Aug 21 (drafts
  below) — judges explicitly weigh an *active* account.
- [x] Mainnet decision: hold. Do not deploy the current registry to X Layer
  mainnet. Its authorization, lifecycle, and metadata rules need a replacement
  design and security review. See
  [the mainnet decision brief](MAINNET-DECISION-BRIEF.md). The August 13 token
  launch went through a third-party venue and does not touch this hold — the
  [addendum](MAINNET-DECISION-BRIEF.md#addendum--august-13-2026-the-founder-launched-homes-on-a-third-party-venue)
  says so explicitly.
- [ ] Approve/voice the 90-second video (the longest remaining pole); upload;
  paste the URL below.
- [x] Submit the Google Form (answers below) — **submitted August 14, 2026**
  (founder-reported).
- [x] Post the submission tweet tagging @XLayerOfficial — **posted August 14,
  2026** (founder-reported).
- [ ] KYC with OKX if/when prizes call.

**Build gates (AI-executable):**
- [x] Experimental contracts deployed to **X Layer testnet 1952** with verifiable links —
  escrow [`0x4A777bf71d8809244c77A3c2b39ef68793A463b5`](https://www.oklink.com/x-layer-testnet/address/0x4A777bf71d8809244c77A3c2b39ef68793A463b5)
  · registry [`0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e`](https://www.oklink.com/x-layer-testnet/address/0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e)
  (details: [DEPLOYMENTS.md](DEPLOYMENTS.md); constructor state re-read live in
  [Audit #8](AUDIT-LOG.md)).
- [x] Web app hosted and public: **https://aurahomes.fun**
- [x] $HOMES live on X Layer mainnet 196, its mint verified on-chain and
  rendered beside the design split on [/homes](https://aurahomes.fun/homes).
- [ ] 90-second demo video, every figure captured live (script below).

## X account bio

**Currently on the account** (written before the August 13 launch, so it names
the testnet lab and not the live token):

> Plan an eco home: shape it in 3D, test example land constraints, and see
> likely project costs. Free, open source, Alberta first, with an optional
> transaction-mechanics lab on @XLayerOfficial. A KR8TIV AI product.

**Suggested revision** — founder's call, since it trades the lab mention for
the one fact the account is now missing:

> Plan an eco home: shape it in 3D, test example land constraints, and see
> likely project costs. Free, open source, Alberta first. $HOMES is live on
> @XLayerOfficial; the trust around it is being built in public. A KR8TIV AI
> product.

## Google Form answers (paste-ready)

**Project name:** Aura Homes

**One-liner:** An open-source workspace for shaping an eco home, testing land
constraints, estimating costs, checking team evidence, and preparing a
professional handoff.

**Description (long):**
Aura Homes turns an eco-home idea into one durable project record. Its guided
and professional editors share an 87-plan catalog of editable design starts.
Each catalog entry names its source and licence. The editor creates schematic
drawings and exchange files for review and handoff, not construction or permit
sets.

The land-fit pilot evaluates sourced example rules and explains why a sample
parcel may not fit. It is not a Multiple Listing Service feed, survey, permit
decision, or substitute for local review. An Alberta-first cost model shows
scenario ranges and their assumptions, and reconciles to its published line
items to the dollar. Contractor and manufacturer workbenches organize
demonstration or user-supplied evidence, including source dates, expiry, and
missing facts. Aura does not label providers as vetted.

On X Layer, two things are true at once. The $HOMES token is live on mainnet
196 — launched August 13, 2026 through the third-party XLaunch venue at
`0x642855d557ada1eba8a66014aaff902e6394c0de`, with its contract, pool, locker,
creator fee-claim wallet, and on-chain-verified mint published on the ledger
page beside a plain buy guide and plain risk labels. Aura's own escrow and
registry contracts remain on testnet 1952 under a recorded mainnet hold; the
app reads their empty state and links to their creation receipts. The current
public instance has zero milestones and zero home records. No trust, staking
position, property, distribution, or launchpad exists, and the dashboard
renders each of those as a declared zero naming the receipt it is waiting for.

The software is MIT-licensed; individual plan studies retain their listed licences.
The repository publishes its assumptions, Alberta research, cost basis, plan
provenance, product limits, claim registry, dated founder decisions, and
fresh-context audits.

**Track:** AI-RWA.

**Why AI-RWA:** Aura organizes the design, site assumptions, budget basis,
team evidence, quotes, and handoff for a physical home project. Canonical
hashes identify the exact versions used by later documents. A hash detects a
change; it does not prove that the source document is true or that physical
work occurred. The token layer is held to the same standard: a number reaches
the public ledger only when a receipt exists for it.

**X Layer integration:** the $HOMES token is live on mainnet 196 through the
XLaunch venue, with its contract, pool, locker, and creator fee-claim wallet
published and its mint verified against the public RPC, at the block recorded in
the artifact.
Aura's own experimental escrow and registry contracts are deployed on testnet
1952 as an isolated lab; the app reads their empty state and links to their
OKLink creation receipts. Project, design, and budget records use deterministic
hashes. No Aura-authored contract is deployed on mainnet 196, and no production
payment, escrow, registry, staking, or distribution flow is live.

**Links:** [GitHub](https://github.com/kr8tiv-ai/aura-homes) ·
[Live app](https://aurahomes.fun) · [X](https://x.com/AuraHomes_fun) ·
Video: not yet recorded — see the checklist above. The form was submitted on
August 14 without one, so the walkthrough will be posted from
[@AuraHomes_fun](https://x.com/AuraHomes_fun) and linked here rather than
resubmitted. ·
[$HOMES on the X Layer explorer](https://web3.okx.com/explorer/x-layer/address/0x642855d557ada1eba8a66014aaff902e6394c0de) ·
[$HOMES ledger page](https://aurahomes.fun/homes) · Testnet lab:
[escrow on OKLink](https://www.oklink.com/x-layer-testnet/address/0x4A777bf71d8809244c77A3c2b39ef68793A463b5) ·
[registry on OKLink](https://www.oklink.com/x-layer-testnet/address/0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e)

**Team:** Matt Aurora Ventures (KR8TIV AI) — solo founder building with AI
agents, in the open.

## The 90-second demo script (canonical)

Every figure captured live against https://aurahomes.fun. No fake purchases, no
simulated settlement on camera, and no zero read as anything but a zero.

| Time | Scene | On screen |
|---|---|---|
| 0–8s | Enter | The gate film → Enter (eco journey). The hero carries the one-liner: "Design your eco home. Find land that fits. Plan every step to build it." |
| 8–18s | The world | Scroll beats 01–03 of the 3D story; one day/night flip. |
| 18–36s | Design | `/build?mode=guided` — the 87-plan library, pick the Fjell Cube, the camera reframes, one Ctrl-K phrase edit ("wider by 4") lands as one undo step. |
| 36–50s | Land fit | `/land`: run the demonstration check and show the rejection with its cited example rule. "A first screen, not a permit decision." |
| 50–62s | Cost | `/budget`: show the scenario range, its assumptions, and the DIY-or-hire choices. Say the anchor out loud: the ex-land totals reconcile to the published cost model to the dollar. |
| 62–72s | Project | `/dashboard`: the saved design, blockers, budget basis, quote state, and recommended next action in one project. |
| 72–84s | Chain | `/homes`: the live token's receipts — contract, venue, pool, locker, creator wallet, and the on-chain mint read — then scroll to the property pipeline, profit reconciliation, and distribution proof sections sitting at zero. "The token is live. The trust around it is not, so the ledger says zero." |
| 84–90s | Close | "One project record from idea to professional handoff." MIT · aurahomes.fun · @AuraHomes_fun |

### Optional testnet cutaway

If judges ask about Aura's own contracts, open `/labs/xlayer-proof` after the
core demo. Show the live empty-state read and one OKLink creation receipt. Say:
"This is an isolated testnet lab. It proves the mechanism executes; it is not a
purchase, an escrow service, or a claim that physical work occurred. Our own
contracts stay off mainnet until a replacement design passes review."

## Submission tweet (draft)

> Shape an eco home in 3D, test example land constraints, understand likely
> project costs, and keep the handoff in one project record.
>
> Open source, built in public by AI agents and one founder. $HOMES is live on
> @XLayerOfficial; everything designed around it renders as an honest zero
> until it has a receipt.
>
> Live: aurahomes.fun — BuildX AI Season 🌲

## Build-in-public post drafts

1. "Our land-fit pilot just rejected an example parcel: the sourced district
   rule requires 1,076 sq ft and the design was 800. It is a first screen, not
   a listing feed or permit decision."
2. "The plan library hit 87 — including three 1960s USDA A-frames reborn
   from public-domain federal drawings, provenance published per plan. The
   best plans ever drawn are free; someone just has to do the licence work."
3. "Honesty corner: atmospheric water generation is recommended on every Aura
   home, not mandatory, and it is a summer-only option in our Alberta reference
   concept. Winter water still needs a confirmed well, cistern, or municipal
   source."
4. "We read our own token's mint off the X Layer RPC instead of quoting our
   design doc. 1B supply, and the venue pool plus the creator wallet hold all
   but a fraction of one token — a launchpad curve, not our 30/10/10/20/30
   design split, and the site shows both side by side. We stopped writing the
   percentages into documents: they move every time anyone trades, so the
   figures live in the artifact with the block they were read at."
5. "The X Layer proof lab reads deployed experimental contracts on testnet
   1952. Their public state has zero milestones and zero home records. It is
   not Aura's checkout, escrow service, or evidence that physical work occurred."
6. (Credit post) "Our landing page's scroll-story motion owes its
   inspiration to the beautiful work of @MengTo (kage). Rebuilt from scratch
   in our own stack and branding — credited in the repo. Craft recognizes
   craft."
7. "Follow the build: every plan in our library names its source and
   licence, every budget line names its dataset, and every crypto claim maps to
   a row in a claim registry that the build fails without. Boring? It's the
   whole product."

## Verification a judge can reproduce

At the current release checkpoint:

| Gate | Result |
|---|---|
| `npx tsc --noEmit` (app) | Passes |
| `npm test` (app) — deterministic app + contract-truth specs | 691 declared (689 passed + 2 served-only skipped) |
| `npm run test:ui` (app) — Playwright against a fresh static export | 136 passed |
| `node scripts/meadow-proof.mjs` — hardware scene proof, real GPU | Passed on desktop and mobile tiers at **`fb6439c`** (2026-08-14), the commit recorded in [`app/shots/r03-meadow/meadow-proof.json`](../app/shots/r03-meadow/meadow-proof.json). It needs a quiet machine and a real GPU, so it is dated rather than re-run per commit — **and the scene has moved 12 files since, so this proves the scene as it was that day, not as it ships today.** |
| `npm run demo` (agent) — the money anchor | Reconciles to the dollar: ex-land $199,100 / $301,280 / $443,900 |
| `npm test` (contracts) | 25 passing |

Some of those gates are deliberately adversarial. The scene proof fails if the
grass stops moving between idle frames, if any baked grass card stands on the
deck or walkway when the shipped binary is decoded, or if the offline atlas
generator's clearance field drifts from the runtime's at any of 3,000 sampled
points. `release-truth.spec.ts` greps this file and the public pages for wording
that would overstate the product. A spec that merely *says* something is true
cannot pass for one that proves it.

The audit trail is public and graded:
[`docs/AUDIT-LOG.md`](AUDIT-LOG.md) carries fresh-context audits that re-read
live chain state and live HTTP rather than trusting the docs, including the
findings still open against this project today.

## Judge-facing "why this wins" (for the form's open field, if present)

Aura Homes connects design, example land constraints, cost assumptions, team
evidence, quotes, and handoff in one local-first project record. Its AI value
is bounded and inspectable: deterministic project guidance, constraint checks,
and prepared actions that expose their inputs and never act without the person
using the project.

Its X Layer story is unusual for a hackathon in that both halves are stated
plainly. One live mainnet token with every address published and its mint read
back off-chain; one isolated testnet lab for Aura's own contracts, held off
mainnet by a written decision naming five specific blockers. Everything
designed but unbuilt — the trust, the staking, the property fund, the
distributions, the launchpad — renders as a declared zero with the missing
receipt named beside it, enforced by a build that fails on an unreceipted
number. A judge can therefore tell working software, pilot data, and future
plans apart in under a minute, which is the harder thing to build.
