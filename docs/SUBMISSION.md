# Hackathon Submission Package — BuildX AI Season 2026

*Everything pre-written so submission takes minutes, not hours. Deadline:
**August 21, 2026, 23:59 UTC.** Submission = [the Google Form](https://docs.google.com/forms/d/e/1FAIpQLSfgU_3zcXdxK0GJQxj33QeUWdEcAaYnieVe9p5cFDb2JFQa4Q/viewform)
(also linked from the [hackathon page](https://web3.okx.com/xlayer/build-x-hackathon))
+ an X post from the project account tagging @XLayerOfficial.*

*Rewritten Aug 12, 2026: the escrow-led pitch described a product the founder
retired ("it isn't a problem we're solving"); this version sells the product
that is actually live. This file is the CANONICAL home of the demo script —
the copies that lived in PHASED-ROADMAP.md and ROADMAP-LONG-FORM.md are
superseded pointers now.*

## Checklist

**Matt-only (nobody else can do these):**
- [x] Dedicated X account — **@AuraHomes_fun** is live: https://x.com/AuraHomes_fun
- [ ] Post build-in-public updates every 1–2 days through Aug 21 (drafts
  below) — judges explicitly weigh an *active* account.
- [x] Mainnet decision: hold. Do not deploy the current registry to X Layer
  mainnet. Its authorization, lifecycle, and metadata rules need a replacement
  design and security review. See
  [the mainnet decision brief](MAINNET-DECISION-BRIEF.md).
- [ ] Approve/voice the 90-second video (Day 8); upload; paste the URL below.
- [ ] Submit the Google Form (answers below).
- [ ] Post the submission tweet tagging @XLayerOfficial.
- [ ] KYC with OKX if/when prizes call.

**Build gates (AI-executable):**
- [x] Experimental contracts deployed to **X Layer testnet 1952** with verifiable links —
  escrow [`0x4A777bf71d8809244c77A3c2b39ef68793A463b5`](https://www.oklink.com/x-layer-testnet/address/0x4A777bf71d8809244c77A3c2b39ef68793A463b5)
  · registry [`0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e`](https://www.oklink.com/x-layer-testnet/address/0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e)
  (details: [DEPLOYMENTS.md](DEPLOYMENTS.md)).
- [x] Web app hosted and public: **https://aurahomes.fun**
- [ ] 90-second demo video, every figure captured live (script below).

## X account bio

> Plan an eco home: shape it in 3D, test example land constraints, and see
> likely project costs. Free, open source, Alberta first, with an optional
> transaction-mechanics lab on @XLayerOfficial. A KR8TIV AI product.

## Google Form answers (paste-ready)

**Project name:** Aura Homes

**One-liner:** An open-source workspace for shaping an eco home, testing land
constraints, estimating costs, checking team evidence, and preparing a
professional handoff.

**Description (long):**
Aura Homes turns an eco-home idea into one durable project record. Its guided
and professional editors share a 25-item catalog of editable design starts.
Each catalog entry names its source and licence. The editor creates schematic
drawings and exchange files for review and handoff, not construction or permit
sets.

The land-fit pilot evaluates sourced example rules and explains why a sample
parcel may not fit. It is not a Multiple Listing Service feed, survey, permit
decision, or substitute for local review. An Alberta-first cost model shows
scenario ranges and their assumptions. Contractor and manufacturer
workbenches organize demonstration or user-supplied evidence, including
source dates, expiry, and missing facts. Aura does not label providers as
vetted.

An optional X Layer testnet lab reads deployed lifecycle contracts and links
to their creation receipts. The current public instance has zero milestones and zero home records.
It does not sell, finance, escrow, certify, or prove physical work on a home. The planned HOMES concept remains separate: no token,
property vehicle, property, staking position, distribution, or launchpad is
live. Its legal structure and participant rights remain undecided.

The software is MIT-licensed; individual plan studies retain their listed licences.
The repository publishes its assumptions, Alberta research, cost basis, plan
provenance, product limits, and migration tests.

**Track:** AI-RWA.

**Why AI-RWA:** Aura organizes the design, site assumptions, budget basis,
team evidence, quotes, and handoff for a physical home project. Canonical
hashes identify the exact versions used by later documents. A hash detects a
change; it does not prove that the source document is true or that physical
work occurred.

**X Layer integration:** experimental escrow and registry contracts are deployed on
testnet 1952 as an isolated proof lab. The app reads their empty state and links to
their OKLink creation receipts. Project, design, and budget records use deterministic hashes. No Aura
contract is deployed on mainnet 196, and no production payment, escrow,
registry, token, staking, or distribution flow is live.

**Links:** [GitHub](https://github.com/kr8tiv-ai/aura-homes) ·
[Live app](https://aurahomes.fun) · [X](https://x.com/AuraHomes_fun) · Video:
(paste after Day 8) · Testnet lab:
[escrow on OKLink](https://www.oklink.com/x-layer-testnet/address/0x4A777bf71d8809244c77A3c2b39ef68793A463b5) ·
[registry on OKLink](https://www.oklink.com/x-layer-testnet/address/0x1195ED713EEF2Adc32DcF5Bb1c4627F43f1EC32e)

**Team:** Matt Aurora Ventures (KR8TIV AI) — solo founder building with AI
agents, in the open.

## The 90-second demo script (canonical)

Every figure captured live against https://aurahomes.fun. No fake purchases,
no simulated settlement on camera.

| Time | Scene | On screen |
|---|---|---|
| 0–8s | Enter | The gate film → Enter (eco journey). The hero carries the one-liner: "Design your eco home. Find land that fits. Plan every step to build it." |
| 8–20s | The world | Scroll beats 01–03 of the 3D story; one day/night flip. |
| 20–40s | Design | `/build?mode=guided` — the 25-plan library, pick the Fjell Cube, the camera reframes, one Ctrl-K phrase edit ("wider by 4") lands as one undo step. |
| 40–55s | Land fit | `/land`: run the demonstration check and show the rejection with its cited example rule. "A first screen, not a permit decision." |
| 55–70s | Cost | `/budget`: show the scenario range, assumptions, cost basis, and DIY-or-hire choices. |
| 70–84s | Project | `/dashboard`: show the saved design, blockers, budget basis, quote state, and recommended next action in one project. |
| 84–90s | Close | "One project record from idea to professional handoff." MIT · aurahomes.fun · @AuraHomes_fun |

### Optional X Layer proof cutaway

If judges ask about the chain integration, open `/labs/xlayer-proof` after the
core demo. Show the live empty-state read and one OKLink creation receipt. Say: "This is an
isolated testnet proof of mechanism. It is not a purchase, escrow service, or
claim that physical work occurred."

## Submission tweet (draft)

> Shape an eco home in 3D, test example land constraints, understand likely
> project costs, and keep the handoff in one project record.
>
> Open source, built in public by AI agents and one founder. Optional
> experimental transaction-mechanics lab on @XLayerOfficial testnet.
>
> Live: aurahomes.fun — BuildX AI Season 🌲

## Build-in-public post drafts

1. "Our land-fit pilot just rejected an example parcel: the sourced district
   rule requires 1,076 sq ft and the design was 800. It is a first screen, not
   a listing feed or permit decision."
2. "The plan library hit 25 — including three 1960s USDA A-frames reborn
   from public-domain federal drawings, provenance published per plan. The
   best plans ever drawn are free; someone just has to do the licence work."
3. "Honesty corner: atmospheric water generators are a summer-only option in
   our Alberta reference concept, not a product Aura sells or ships. Winter
   water still needs a confirmed well, cistern, or municipal source."
4. "The X Layer proof lab reads deployed experimental contracts on testnet
   1952. Their public state has zero milestones and zero home records. It is
   not Aura's checkout, escrow service, or evidence that physical work occurred."
5. (Credit post) "Our landing page's scroll-story motion owes its
   inspiration to the beautiful work of @MengTo (kage). Rebuilt from scratch
   in our own stack and branding — credited in the repo. Craft recognizes
   craft."
6. "Follow the build: every plan in our library names its source and
   licence, every budget line names its dataset, every claim on the crypto
   side wears Today / Next / Future. Boring? It's the whole product."

## Judge-facing "why this wins" (for the form's open field, if present)

Aura Homes connects design, example land constraints, cost assumptions, team
evidence, quotes, and handoff in one local-first project record. Its AI value
is bounded and inspectable: deterministic project guidance, constraint checks,
and prepared actions that expose their inputs and never act without the person
using the project.

X Layer appears as an optional testnet proof lab with an empty-state read and deployment receipts. The
submission does not present that lab as a purchase, escrow service, inspection,
or mainnet product. The repository publishes its evidence and limitations so a
judge can distinguish working software, pilot data, and future plans. New
regions can later be added as dated data packs rather than hidden assumptions.
