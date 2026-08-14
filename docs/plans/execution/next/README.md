# Ready-to-run node scaffolds

Each JSON file in this directory is one bounded job, written so that a
capable-but-smaller model (or a human) can execute it **without reading the
whole conversation history**. The graph authority is
[`../../2026-08-14-aura-full-system-graph-v1.2.md`](../../2026-08-14-aura-full-system-graph-v1.2.md);
founder decisions live in [`../../registry/decisions.json`](../../registry/decisions.json).

## How to execute a node (the whole protocol)

1. **Read the node's JSON.** `instructions` is the ordered work list;
   `writeSet` is the ONLY set of paths you may modify; `rejectionGates` are
   cheap checks to run FIRST — if one fails, stop and report, do not improvise.
2. **Respect the standing rules** (they outrank you):
   - Nothing unbuilt is written in the present tense. Every number comes from
     its anchored source, never retyped.
   - When a change breaks a pinned spec, renegotiate the spec IN THE SAME
     COMMIT with a comment saying why. Never delete an assertion to go green.
   - Commit as `Matt-Aurora-Ventures <lucidbloks@gmail.com>` only. No
     Co-Authored-By lines.
   - Never touch `app/lib/contracts.ts` chain constants (testnet-pinned) or
     the eco journey's HOMES mention (exactly one, at the end).
3. **Run the gates** listed in `verify.commands` from `app/` (or the dir
   given). ALL must pass. The heavyweight chain when UI code changed:
   `npx tsc --noEmit` → `npm test` → `npm run test:ui`.
4. **Write the evidence** into the node file (`evidence` object: date, gate
   outputs, key numbers) and set `status: "verified"`. A node whose remote
   effects ran must close its record in the same session.
5. **One bounded repair loop.** If gates still fail after one focused fix
   round, set `status: "blocked"`, record exactly what failed, and stop.

## Node order (dependencies noted inside each file)

| Node | Job | Effort |
| --- | --- | --- |
| `VT03` | Verify the live HOMES mint on-chain; publish the artifact | small (script exists — run + surface) |
| `PB02-PB04` | Perf: GLB optimize, font/bundle audit, re-measure vs the PB01 baseline | medium |
| `AL01` | Audit #7 by a FRESH context; append to docs/AUDIT-LOG.md | medium (must be a context that did not build the thing it audits) |
| `NW01` | compileAsync warmup for full-tier + night programs | medium (perf, measured 5.7s/6.7s one-time stalls) |
| `BQ-AWG` | Budget UI: AWG as a deselectable line | small-medium |
| `DB01` | GitHub Actions scheduled data-bake | small (scaffold provided; founder enables) |
| `D-1` | /homes property-pipeline, profit, distribution sections (zero-state) | medium |
| `B-P1` | Builder site slot + A1 site plan + terrain | large |
| `X12` | 90-second video against the LIVE site | founder-gated |

PB01 (the baseline capture) is DONE — artifact at
[`../../..//perf/PB01-baseline-2026-08-14.json`](../../../perf/PB01-baseline-2026-08-14.json).
