# The Aura Brain — the AI that runs the journey

*The app doesn't just have AI features; the management layer IS an AI. One persistent brain per build journey: it knows what stage you're at, what's blocked, what's next, who owes what, and it walks you — proactively — from "I want an eco home" to move-in day. This doc is the design + the model strategy, including the honest answer on costs at scale.*

## What the brain does

1. **Journey state machine, AI-narrated.** Every user's build is a typed state object (stage, sub-steps, blockers, waiting-on, documents, escrow state, dates). The brain reads it every turn — nothing is "remembered" only in chat history, so the guidance never hallucinates progress. The state machine is deterministic code; the AI's job is judgment and communication on top of it.
2. **Walks you through, start to finish.** Each stage exposes "what's next + why + who does it + what it costs" — the brain turns that into conversation, answers the scared-first-timer questions, and knows when to say "this one needs a licensed human, here are three near you."
3. **Catches the slips.** Ball-drop detection as a first-class feature (the pattern proven in our founder's field-operations OS): permit application sitting unsubmitted 7+ days, SIP drawings approved but kit unordered (12–20 week lead time burning), escrow milestone complete but holdback timer unnoticed, quote received but unanswered. Slips raise flags; flags become nudges.
4. **Email updates, always.** Every material state change and a weekly digest per build: what moved, what's blocked, what's next, money position (escrow funded/released/held back). Transactional email via a commodity provider (Resend/SES class); templates live in the repo; users control frequency. The email IS the product for the 95% of days a user doesn't open the app.
5. **It learns.** Every completed stage logs predicted-vs-actual (budget line vs invoice, estimated vs real permit turnaround, lead-time vs delivery). The deltas feed back into `data/alberta/cost-model.json` ranges and the guidance copy. Learning is from *outcomes* (anchors that can't argue back — see [GRAPH-ENGINEERING.md](GRAPH-ENGINEERING.md)), never from the model grading its own advice.

## Memory — the journey remembers

*Adopted discipline: ["Memory Engineering: The Discipline That Decides Whether Your AI Agent Has a Past"](https://x.com/0xWast3/status/2084625810112032849) by [@0xWast3](https://x.com/0xWast3) (Aug 2026), applied per journey in `agent/src/brain/memory.ts`. The premise: re-reading a transcript is not memory — memory is its own architecture that decides deliberately what a system carries forward and what it lets go. Run the narrated pipeline with `npm run memory`; agents reach it through the `journey_memory` MCP tool.*

**The five stages**, mapped to our code (the article's names in parentheses):

1. **Capture** — a rejection-first filter. The test: would this still be true and useful in three months? Transient moods, session mechanics, questions, and hedged maybes never reach the store; preference and constraint language becomes a **durable** fact; date-bound facts become **expiring** facts with an `expiresISO`. Most of what gets said is rejected by default — a system that captures indiscriminately rebuilds the replay-everything problem it was meant to solve.
2. **Consolidate** — every captured fact resolves against the live store as `insert`, `merge`, `supersede`, or `skip`. A rephrased preference merges and reinforces the existing entry (raising confidence, slowing decay) instead of piling up as a duplicate row; ten mentions collapse into one confident fact, not ten competing ones.
3. **Retrieve** — contextual and stage-aware, never exhaustive. LAND surfaces parcel constraints, ESCROW surfaces money preferences, and a free-text query ranks by relevance, confidence, and recency. Twenty marginal memories bury the two that matter, so irrelevant facts never surface regardless of confidence.
4. **Update (the article's Reconcile)** — contradictions never coexist silently. A same-subject contradiction (a changed number, a reversed preference, explicit change-of-mind language) supersedes the old fact: the newest statement wins, and the old fact is kept — marked `supersededBy` and invisible to retrieval — until the forget pass. When a lower-confidence statement overturns a higher-confidence fact, the result carries a conflict note to surface to the owner rather than trusting silently (the article's `flag_conflict` branch).
5. **Forget (the article's Decay)** — aggressive, but with a grace window. Expired and superseded facts stop retrieving immediately and are dropped for good 14 days later. A store that never forgets becomes indistinguishable from one that remembers nothing well.

**Our two classes.** `durable` — preferences, constraints, and stable facts ("prefers DIY where legal", "hard budget ceiling", "never plumbing in exterior walls"). `expiring` — true only until a date ("the county office is closed until Sep 2"), carrying `expiresISO`.

**What gets captured, and the privacy rule.** Only outcome facts and stated preferences, as single sentences — never raw transcripts, never conversation logs. This is the same boundary as the learning loop above: the store holds what the owner asserted and what verifiably happened, not how the conversation went. Rejected statements are not stored anywhere.

**Where it plugs in.** `getGuidance` accepts a memory store and re-ranks the next actions (a remembered DIY preference pulls owner-doable paths up); `renderDigest` weaves remembered facts into the weekly email and checks the remembered budget ceiling against the milestone total, flagging a breach; `advanceJourney` events can carry `userStatements` that flow through capture and consolidation via `advanceJourneyWithMemory`. All pure functions with injectable clocks; persistence is one JSON file per `buildId` under `agent/out/memory/`.

## Model strategy — the cost-honest answer

The instinct "train our own model so API costs don't eat us" is half right. The 2026 engineering answer is a **three-tier brain**, cheapest tier first:

| Tier | What runs there | Cost at 1,000s of users |
|---|---|---|
| **T0 — Code, no model** | The state machine, constraint checks, budget math, milestone logic, slip detection, email triggers. Most of the "decision matrix" is deterministic — a model deciding what a rule can decide is waste. | ~$0 |
| **T1 — Small open-weight model** | Routine guidance turns, FAQ-style answers, email drafting, intent routing. A 7–8B-class open model (Qwen/Llama/Mistral tier) grounded with RAG over this repo's own corpus (playbook, cost model, supplier directory, feasibility study). Served via cheap token hosts or self-hosted GPU; swappable — the interface is "OpenAI-compatible endpoint." | cents/user/month |
| **T2 — Frontier API (Claude)** | The judgment nodes: design-brief generation, tradeoff reasoning ("cistern vs well on THIS parcel"), anything novel or high-stakes. Prompt-cached, schema-forced, invoked only when T0/T1 escalate. | the metered x402 usage fee is sized to cover exactly this — the fee IS the cost recovery |

**On fine-tuning (the Colab question):** yes — LoRA/QLoRA on a 7–8B open model is a weekend and tens of dollars on rented GPU (Colab/RunPod class), *but the thing that makes fine-tuning work is training data we don't have yet.* The data is generated by operating: real walkthrough transcripts, real Q&A, real corrections. So the sequence is deliberate:

1. **Now:** RAG + system-prompt engineering over the repo corpus (this is why every doc here is written to be machine-consumable). Zero training cost, updates instantly when the data updates.
2. **After ~1,000s of real interactions:** distill — fine-tune the small model on our own curated transcripts so T1 answers like T2. Colab-class GPUs are exactly right for this.
3. **Never:** pretrain from scratch. Nobody needs to; open weights + our proprietary *data* is the moat, not proprietary weights.

## Interface: MCP-first

The brain ships as an **MCP server** (`aura-brain`) exposing typed tools: `journey_status`, `next_actions`, `explain_stage`, `check_parcel`, `generate_design_brief`, `budget_line_detail`, `escrow_status`, `nudge_preview`, `log_outcome`. The web app is one client; Claude/any agent is another; the OKX agent ecosystem (x402-metered per call) is the third — which turns the brain itself into an Agent Service and feeds the hackathon's ecosystem-contribution story. This mirrors the architecture proven by our founder's previous OKX entry (an MCP business brain with 85 tools) — same pattern, new domain.

## Privacy & safety rails

Journey state contains money and location — it stays server-side, never in model training without explicit opt-in, and the learning loop trains on *outcome numbers*, not personal narratives. The brain never gives financial or legal advice; it teaches paths and hands off to licensed humans at the boundaries (the same honesty rule as everywhere else in this repo).

## Build order

- **Hackathon window:** the brain's skeleton = journey state machine + stage guidance from the repo corpus + one email template (the "what's next" digest) + Claude on the design node (already in `agent/`). Demo: the brain notices a slipped step and nudges — that 10-second moment sells the whole vision.
- **Phase 1:** MCP server extraction, Resend/SES integration, slip-rule library, outcome logging.
- **Phase 2:** T1 small-model routing + RAG index; per-user cost telemetry; fee sizing against real inference bills.
- **Phase 3:** the distillation fine-tune, once the transcript corpus earns it.
