# Graph Engineering Doctrine

*Standing operating principles for how Aura Homes is built — by AI agents, in parallel, verified. Adopted Aug 9, 2026 at the founder's direction, from ["Graph Engineering explained"](https://x.com/AnatoliKopadze/status/2080668775796314331) by Anatoli Kopadze. This applies to (a) how we orchestrate AI work on this repo and (b) how the product's own agent pipeline is architected.*

## The vocabulary

- **Node** = one bounded job, one agent, defined input, defined output. **Edge** = a real data dependency — it only exists if something real passes along it.
- **Node contract**: every agent task in this project declares JOB / IN / OUT with an enforced schema. Free-text returns are for humans; schema returns are for the next node. (Our research sweep already ran this way — `summary/key_facts/numbers/options/red_flags/sources` — keep it so.)

## The rules

1. **Fake-edge test before every workflow.** For each step, ask: does it actually need the previous step's output? If not, cut the edge and run wide. Sequence is a claim, not a default.
2. **The diamond is the default shape**: fan out → reduce in plain code (no tokens) → verify → synthesize. Research, audits, code sweeps, budget checks — same skeleton, different prompts.
3. **A worker never checks its own work, and a checker never shares the worker's context.** Verifiers run fresh, receive the finding only, and try to kill it. Split verification across different lenses (correct? current? source real?) rather than N identical skeptics. Our vision-audit loop (AUDIT-LOG.md) is a standing checker node — it stays context-fresh and keeps its authority.
4. **Layer the fan-in.** Never pour raw fan-out output into one synthesis step; batch → summarize → combine summaries.
5. **No false independence.** Two nodes writing the same file/resource have a hidden edge — isolate (worktrees, separate directories) or sequence them. (This repo's convention: doc writers own `docs/`+`data/`, code agents own `contracts/`+`app/`+`agent/`, design agents own `assets/` — enforced in every agent brief.)
6. **Guard the fan-in.** Every merge counts results against expectations and flags gaps loudly. Never synthesize on a partial set and call it complete.
7. **Anchors — the nodes that cannot be argued with.** A graph that only reads its own reports is consistent, not verified. This project's frozen anchors:
   - `contracts`: `npx hardhat test` — tests that *ran and passed*, pasted output, never "should pass."
   - `app`: `npm run build` exit code + a real rendered page looked at with eyes (or a browser agent's screenshot).
   - `agent`: `npm run demo` producing output that **reconciles to the dollar** with `data/alberta/cost-model.json`'s `totalsRule`.
   - Chain: `eth_chainId` read live from the RPC before any deploy; deployed txs verified on OKLink, not assumed.
   - Money: every published figure traces to a sourced line item; the totals rule is frozen — an optimizer that wants prettier numbers changes the *lines and their sources*, never the rule.
   - Honesty policy (VISION.md #10, the corrections ledger in AI-HANDOFF.md): frozen. These are exactly the rules an eager agent would bend to look better — that is why they are off-limits.
8. **Know when not to graph.** Small isolated fixes, genuinely sequential steps, and exploratory steering are single-agent work. If the fake-edge test finds no cuttable edge, it's a loop — and a loop is fine.

## Applied to the product itself

The `aura-architect` pipeline is deliberately node-shaped: pure functions with typed contracts (`Questionnaire → DesignBrief → Budget → MilestoneSchedule`), so stages can become independent agent nodes as they deepen. The five-stage product pipeline (LAND → DESIGN → BUDGET → ESCROW → BUILD) has real edges — each stage consumes the previous stage's artifact — but *within* stages the work fans out (parcel checks in parallel; supplier quotes in parallel; milestone verifications independent). The escrow's 2-of-3 release is itself a checker-separation pattern: the builder never approves their own milestone alone, and the on-chain USDC balance is the anchor that cannot be argued with.

## Applied to future sessions

Any AI continuing this work (see [AI-HANDOFF.md](AI-HANDOFF.md)): default to workflow-orchestrated diamonds for research, audits, and sweeps; keep node contracts schema-enforced; keep the vision auditor's context fresh; run the anchors before claiming anything is done; and append audit passes to AUDIT-LOG.md rather than overwriting them.
