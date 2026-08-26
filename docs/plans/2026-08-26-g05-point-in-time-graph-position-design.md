# G05 Point-in-Time Graph Position Check — Design

**Date:** 2026-08-26

**Authority:** Aura Full-System Graph v2.0, G05 and §18.1

**Status:** Founder-approved design direction

## Outcome

G05 provides an explicitly invoked, read-only check of where a node actually sits in the approved graph at preflight, integration, or release. It produces deterministic repository facts for an independent verifier. It never schedules itself, edits a candidate, approves an exception, changes a node status, deploys, spends, or crosses an external gate.

## Chosen approach

Build a local full-history checker and a strict receipt contract. The checker reopens authority and repository history instead of trusting a self-reported status. It reports a failed affected node without stopping unrelated healthy work and identifies only graph-valid lateral or backward moves.

Two alternatives were rejected:

- a thin wrapper around existing graph tests would not detect buried decision-ledger rewrites or reconcile a specific candidate; and
- a recurring auditor or service would violate the founder's standing cancellation of scheduled graph auditors.

## Architecture

The implementation has four bounded parts:

1. **Position policy.** A machine-readable registry defines the three invocation phases, allowed verdicts and move classes, required receipt sections, and the standing prohibition on recurring execution.
2. **Repository checker.** A local Node.js module accepts an explicit node, phase, base commit, candidate commit, optional closure commit, and evidence inputs. It reads Git objects and committed manifests directly.
3. **Full decision-history proof.** The checker traverses every commit that changed `docs/plans/registry/decisions.json` from the pinned V1 anchor to the candidate. V1-to-V2 migration must match the pinned historical hashes and begin with zero appended changes. Every V2-to-V2 transition must preserve the prior canonical change list as an exact prefix.
4. **Receipt.** The checker returns `AuraGraphPositionReceiptV1`. It separates observed facts from the independent verifier's eventual verdict and correction. The primary operator cannot use the receipt to self-approve a node.

## Receipt contract

The receipt contains exact keys for:

- approved graph identity and authority result;
- invocation phase and inspected node;
- manifest commit, status, owner, verifier, dependencies, and external gates;
- base, candidate, and closure lineage;
- declared and changed paths, equality delta, freeze/public-visual findings, and worktree state;
- declared verification commands and supplied evidence states;
- decision-history traversal result;
- allowed movement: remain, backward repair, lateral ready node, or blocked pending named authority;
- bounded errors and a machine-readable correction template.

Unknown fields, malformed objects, missing evidence, abbreviated commits, uncommitted manifests, status/dependency contradictions, overlapping live write ownership, protected-path changes, and scheduled invocation all fail closed.

## Data flow

1. The operator explicitly invokes the checker for one node and phase.
2. The checker verifies Graph v2 authority and loads the target committed `ExecutionNode` manifest.
3. It validates dependencies and competing write ownership against committed manifests.
4. It compares the exact base-to-candidate paths with the manifest write set and applies the freeze/public-visual policy.
5. It verifies lineage and, when supplied, that a closure changes only the target manifest.
6. It traverses the complete founder-decision registry history.
7. It reconciles declared evidence without running provider, deployment, payment, or other external actions.
8. It emits a deterministic receipt. A separately invoked independent verifier reviews that receipt and the candidate.

## Movement semantics

- **Forward:** allowed only when the inspected node and every required dependency, rejection gate, evidence item, and external approval pass.
- **Backward:** allowed only to the node's declared repair boundary and within its remaining repair budget.
- **Lateral:** allowed only to a committed ready node whose dependencies pass, write set is unclaimed, and external gates are empty.
- **Blocked:** names the exact missing authority or failed invariant. It blocks the affected node, not healthy unrelated work.

The checker never invents a ready node from a strategic table row.

## Error handling

All public validation boundaries use own-data-property inspection and exact-key schemas. Revoked proxies, getters, cycles, malformed Git data, missing commits, invalid JSON, unknown states, and command failures return bounded errors without exposing private exception causes. Git commands are read-only and use argument arrays rather than shell interpolation.

## Test strategy

Test-first adversarial fixtures will prove:

- exact authority and a valid preflight receipt pass;
- an uncommitted or unknown manifest fails;
- missing/blocked dependencies prevent forward movement;
- base/candidate/closure lineage and exact write-set equality fail closed;
- protected and public-visual changes are rejected;
- overlapping active ownership is detected;
- a rewrite buried between later valid appends is detected by full-history traversal;
- a blocked node yields only valid lateral/backward choices;
- scheduled or recurring invocation is rejected;
- malformed, accessor-backed, and revoked inputs return bounded errors; and
- the CLI performs no network, write, deploy, payment, or provider action.

Fresh G05 closure gates will include the focused suite, Graph v2 authority/freeze tests, decision-ledger tests, typecheck, exact write-set reconciliation, and an independent one-time verifier.

