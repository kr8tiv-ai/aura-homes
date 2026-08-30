# OR02 Hosted Execution Controls — Implementation Plan

**Date:** 2026-08-29
**Graph:** `aura-graph/v2.0@680FD8D8F2142E92DE5A629B60D9C1DE160CCC57A0F7DDDDC872CDC4ACDAB9A8`
**Node:** OR02
**Movement:** bounded OR02 repair after IP05 reached independent verification
**Side effects in this node:** none

## Outcome

Create one provider-neutral control plane that must authorize every future hosted OpenRouter design-intent task before execution. It enforces opaque user, session, and project rate ceilings; a global UTC-day provider-cost ceiling; concurrency and input/output byte ceilings; a default-off kill switch; no-content retention; redacted audit receipts; and deterministic-fake fallback.

The control plane accepts an injected atomic state store and injected verified IP03 adapters. Tests use an in-memory atomic store, a hosted-shaped fake, and the existing deterministic fake. No route, key, provider request, spend, persistence adapter, account setting, public UI, fee, wallet, project mutation, or frozen 3D/rendering work enters OR02. A future live integration must provide a durable atomic store and remain blocked until its separate secrets, budget, privacy, terms, and founder activation gates pass.

## Dependency interpretation

- OR01 is independently verified and supplies the hosted-shaped OpenRouter boundary.
- IP03 is already verified beneath OR01 and remains the only task/request/response/error/cost promotion boundary.
- IP05 is not an OR02 dependency. IP05 is independently verified and owns no OR02 path.
- OR03 may consume the OR02 controller later. OR02 itself cannot import the OR01 server-only fetch wrapper or make a provider reachable.

## Current official OpenRouter facts used by this plan

- Prompt and completion logging is opt-in; request metadata such as tokens and latency is retained: <https://openrouter.ai/docs/guides/privacy/data-collection>
- Per-request `provider.zdr: true` restricts inference to ZDR endpoints and cannot weaken stricter account or guardrail settings: <https://openrouter.ai/docs/guides/features/zdr>
- Non-streaming responses include token and provider-cost usage without a second provider call: <https://openrouter.ai/docs/cookbook/administration/usage-accounting>
- OpenRouter workspace budgets can block new requests after an interval ceiling, but in-flight requests can overshoot and the feature is plan/account dependent: <https://openrouter.ai/docs/guides/features/workspaces/workspace-budgets>

Provider controls are defense in depth, not Aura authority. Aura must reserve cost before dispatch, bound concurrency and body sizes itself, retain no prompt/image/response content in its audit state, and fail or use the deterministic fake when a local ceiling closes.

## Contract

`app/lib/ai/openRouterExecutionControls.ts` will:

1. Accept strict plain-data policy, scope, UTC day/minute bucket, task request, and estimated provider cost plus injected atomic state, hosted adapter, and deterministic fake adapter.
2. Refuse unknown keys, symbols, accessors, custom prototypes, cycles, aliases, sparse arrays, unsafe integers, mutable adapter/store boundaries, and malformed opaque identifiers without invoking hidden values.
3. Keep all accounting in integer USD micros and bytes.
4. Atomically reserve before hosted execution only when all gates pass:
   - live execution enabled;
   - per-user, per-session, and per-project minute limits;
   - global daily committed-plus-reserved provider-cost cap;
   - concurrency cap;
   - input and declared output byte caps.
5. Count every hosted dispatch. Reserve the policy's full per-request cost ceiling rather than an optimistic estimate so concurrent verified overages cannot cross the daily cap. Settle exact cost only from a verified bounded receipt; if output, receipt, timeout, cancellation, or provider completion is uncertain after dispatch, retain the reservation as a reconciliation hold so concurrency and spend capacity cannot be silently reused. Never allow a successful result whose actual hosted cost exceeds its authorized ceiling.
6. Route kill-switch, rate, spend, concurrency, and bounded temporary hosted failures to the injected deterministic fake. Unsafe input, accounting drift, oversized output, invalid receipts, or store failures fail closed instead of falling back.
7. Return a detached deeply frozen execution result and redacted audit receipt containing only versioned policy/rule identity, opaque-scope hashes, byte/counter/cost facts, route, reason, and bucket—never image bytes, source name, prompt, model output, raw provider body, secret, or raw user/session/project identifier.
8. Require `contentRetention: "none"` and a bounded audit-retention-days declaration; it does not persist or delete anything itself.
9. Never read a clock, environment variable, credential, network, browser storage, project store, wallet, payment, React/UI, or frozen design surface.

## Exact write set

1. `docs/plans/2026-08-29-or02-hosted-execution-controls-plan.md`
2. `docs/plans/execution/v2/OR02-hosted-execution-controls.json`
3. `app/lib/ai/openRouterExecutionControls.ts`
4. `app/tests-or02/openrouter-execution-controls.contract.ts`
5. `app/playwright.or02.config.ts`

No OR01 verified source, server wrapper, package, shared test-count, route, UI, CSS, public-site, project-store, payment, wallet, or protected path is in scope.

## Test-first proof

The dedicated OR02 contract will first fail because the control-plane module does not exist, then prove:

- one hosted execution reserves atomically, settles exact IP03 provider cost, and returns no content in its audit receipt;
- user, session, project, global daily spend, concurrency, and kill-switch gates independently select the deterministic fake without touching the hosted adapter;
- encoded image bytes and declared output bytes are bounded before either adapter runs;
- temporary hosted unavailability/rate/payment failures retain one reconciliation hold and use one deterministic fallback, while invalid output/receipt and accounting drift retain the hold and fail closed;
- actual provider cost cannot exceed the reservation or global cap;
- UTC bucket changes reset only their declared windows, current-day request history establishes a monotonic minute watermark, and backward replay cannot evade minute limits;
- hostile boundaries do not invoke accessors, mutate inputs, leak private details, or return partial reservations;
- store transaction failures and malformed store results fail closed;
- output and receipts are detached and deeply frozen;
- source scans prove no provider name/SDK, network, secret, environment, storage, clock, randomness, wallet, payment, fee, UI, or frozen 3D dependency enters the module.

## Required gates

1. `npm run typecheck`
2. `npx playwright test --config=playwright.or02.config.ts`
3. `npm test`
4. `npm run test:graph-v2`
5. `npm run test:graph-position`
6. `git diff --check`
7. Exact base-to-candidate five-path comparison
8. Explicit G05 preflight with complete evidence
9. Independent fresh-context verification before `verified`

## Stop conditions

### Authorized repair loop 1 — independent verification findings

The fresh-context verifier found that the injected atomic-store boundary could return a fabricated hosted decision without returning the state it committed, a typed-array species lookup could invoke a hostile own `constructor` accessor, and the committed plan contained trailing spaces. The single Graph-authorized repair requires a bounded `{ state, value }` transaction receipt, proves the exact reservation/request/counters before hosted execution, copies bytes only through inspected indexed data descriptors, adds adversarial regressions, and removes the whitespace. No provider, route, persistence implementation, account mutation, UI, or external side effect enters the node.

The final fresh-context pass on this still-open repair attempt showed that the receipt alone was not durable-commit evidence: a store could execute the operation and echo its result without saving it. The store contract now explicitly requires `read()` as a trusted, strongly consistent durable-state primitive after a resolved transaction. Every transaction receipt is compared with that independently read committed snapshot before the controller can proceed, including before any hosted adapter call. A noncommitting store regression proves the hosted call count remains zero. OR02 does not claim that an arbitrarily malicious implementation can prove its own durability; a future production adapter must earn separate verification against this atomicity contract.

The final deep review also proved that releasing a reservation after dispatch erases real or possible provider spend on timeout, invalid output, oversized output, or cost overage. The bounded correction now distinguishes pre-dispatch denial from post-dispatch uncertainty: uncertain attempts retain their exact reservation for reconciliation, verified oversized responses settle their exact valid receipt cost before refusing the output, and a second request cannot reuse the held daily capacity. No production reconciler, persistence implementation, provider call, or money movement enters OR02.

The next adversarial pass on that same unclosed repair proved that a verified cost overage is not uncertain: retaining only the smaller estimate still understates known spend and can reopen the daily cap when concurrency exceeds one. The controller now atomically records the exact verified cost before returning the bounded accounting refusal, even when the provider overshoots the reservation or local daily ceiling. If integer aggregation itself cannot remain exact, it retains a hold equal to the exact receipt cost. A 1,000-micro estimate/9,000-micro receipt followed by a second 9,000-micro request proves that the second hosted dispatch is blocked under a 10,000-micro cap. This remains repair-loop use `1` and adds no provider call, store implementation, or external authority.

The final adversarial pass on the same still-open repair found two remaining control gaps. Optimistic estimate-only reservations allowed two concurrent 1,000-micro estimates to dispatch under a 10,000-micro cap and later settle 18,000 micros of known cost. Filtering request history to the caller's minute also allowed a 12:34 request after a 12:35 request to replay the older rate bucket. The bounded correction reserves the policy's full per-request ceiling, rejects policies whose per-request ceiling exceeds the daily ceiling, retains bounded current-day request history, and refuses backward same-day minutes. Regressions prove only one of two concurrent requests dispatches and that backward-minute replay fails closed. This remains repair-loop use `1`; no external service, provider call, UI, persistence implementation, or frozen design path enters the repair.

The independent pass on that candidate then proved the retained history was bounded only by an unreachable array count: 6,666 request records crossed the 40,000-node snapshot boundary after the transaction had already committed, poisoning durable state and stranding a reservation. It also proved day rollover cleared request history while retaining live reservations, allowing the same request identifier to dispatch twice across midnight and leaving the older execution unable to settle. The same bounded repair now constrains valid control state to 4,000 request records and 1,000 reservations, rejects a policy concurrency ceiling above that reservation bound, refuses before mutation when history is full, refuses any UTC-day transition while a reservation remains live, and checks duplicate request identifiers across reservations as well as request history. Regressions prove the state remains byte-identical at capacity and that neither a duplicate nor a different request can advance the day until the prior reservation settles. This is still repair-loop use `1` on the same unclosed verification attempt.

Stop and refuse rather than expanding OR02 if implementation requires a live provider call, route, secret, account login, account/guardrail mutation, workspace-budget mutation, spend, fee, payment, persistent production store, project mutation, UI, GitHub synchronization outside the separately authorized branch push, or any frozen/public design path.
