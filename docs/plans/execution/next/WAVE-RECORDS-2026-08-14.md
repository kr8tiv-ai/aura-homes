# Un-manifested wave records — August 14, 2026

**Audit #9, finding 3 [MEDIUM]:** *"Waves 1 and 4 have no manifests at all for
their 8 nodes — §2b is unauditable in principle."*

The finding is correct and this file is the honest repair, not a cover for it.

## Why these are records and not manifests

A manifest is written **before** the work, and its value is that its
rejection gates are read before anything is edited and re-read before the node
closes. Writing manifests now, back-dated, would produce documents that look
like they governed work they never saw — a fabricated paper trail, which is
worse than an acknowledged gap in a project whose entire premise is that
claims carry evidence.

So: these are **records**. They state what the eight nodes were briefed to do,
what they produced, and what gate each actually passed. They are auditable as
history. They are not evidence that a contract existed in advance, because it
did not.

## What actually governed these eight nodes

Their briefs lived in the Workflow scripts, which are persisted at
`C:\Users\lucid\.claude\projects\…\workflows\scripts\` and carry the full
prompt each agent received — including its write-set, its rejection gates and
its values. That is a real artifact and it is where an auditor should look for
the instruction each agent was actually given. It is not, however, in this
repository, which is the substance of the finding.

## The eight

### Wave 1 (workflow `aura-u-stream-wave1`, shipped in `d00cda4`)

| Node | Job | Gate it passed |
|---|---|---|
| **SP01** | The project spine: stage, design fingerprint in words, blockers, one next action, on every worked page; absent without a project | `tests/project-spine.spec.ts` 11/11, plus a walk in `navigation.spec.ts` asserting the same reading on six pages and none on `/dashboard`. Falsifiability proven by mutating the save-state branch and watching three tests fail. |
| **SP02/SP03** | `/projects` as a dashboard; storage truth said plainly; quota-exceeded, blocked and cleared each handled with a way out | `tests/project-storage.spec.ts`, driven through an **injected failing store** rather than the happy path, with an anti-vacuity guard the audit re-verified. |
| **MI01** | One motion system: named 150–250 ms tokens and a damped curve replacing ad-hoc durations; soft focus; restrained hover | `tests/interface-motion.spec.ts` extended to pin the token values and to assert `prefers-reduced-motion` still wins. |

**Correction recorded against SP01:** the brief asked for two design-hash
readings, "saved" and "changed since last save". The agent demonstrated the
document cannot honestly produce the second in the common case — an edit
nulls the design step's `basisHash`, so nothing survives to prove a save ever
happened — and shipped four readings keyed to evidence that does survive.
Audit #9 finding 6 then observed that one of those four is unreachable through
production write paths and its justifying comment is inverted; that is being
corrected. The original refusal was right; the comment describing it was not.

### Wave 4 (workflow `aura-wave4-data-and-guidance`, shipped in `e7c81f3`)

| Node | Job | Gate it passed |
|---|---|---|
| **C2 stage 1** | A regional cost basis beyond one county, baked from free public data with every figure carrying its source | `tests/regional-cost.spec.ts` 12/12, including **anchor invariance** — a multiplier of 1.0 reproduces `cost-model.json` exactly — proven falsifiable by three deliberate mutations, each failing the right tests. `agent/ npm run demo` unchanged. |
| **C3 phase 1** | Read `data/alberta/suppliers.json`, which had sat in this repo unimported while the directory rendered demonstration records | `tests/suppliers.spec.ts`: thin evidence reads as thin, an expired check reads as expired, a tick without a date and source URL is an unknown. |
| **GQ01/GQ02** | Guidance as a pure module: one sourced sentence per guided decision, "not modelled" as a first-class answer | `tests/guidance.spec.ts`. Audit #9 finding 8 (LOW) found the `checked` standing pinned in only one direction; being corrected. |

**Deviation recorded against C2, and it is the most valuable thing in this
file:** the brief named StatCan table 18-10-0276-01. That table is **archived**
— its last reference period is 2024-04-01, and StatCan's own footnote says it
was replaced. Baking it would have shipped a two-year-stale index under a
fresh retrieval date. The agent baked the live successor 18-10-0289-01,
recorded the supersession in the bake script, the artifact, the README and a
pinned test, and made the script **refuse to run** if its table ever stops
being CURRENT. A brief written by the orchestrator was wrong; the agent
checked the source instead of trusting it.

## The process failure this documents

Waves 1 and 4 were dispatched straight from workflow briefs because the work
was clear and the surfaces were disjoint. That skipped the step where a
manifest's rejection gates get written down in the repo — and the cost showed
up immediately: **FD1 shipped against a write-set a previous audit had already
named as wrong** (finding 1), because there was no in-repo gate to re-read
before closing it.

**Rule added to §2b as a result:** a node that produces a code change gets a
manifest in `docs/plans/execution/` *before* it is dispatched, even when the
brief lives in a workflow script. The manifest is not paperwork; it is the
only thing a fresh context can read to know what the work was supposed to
refuse to do.
