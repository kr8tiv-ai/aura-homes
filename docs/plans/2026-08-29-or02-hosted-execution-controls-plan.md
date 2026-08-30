# OR02 Hosted Execution Controls — Implementation Plan

**Date:** 2026-08-29  
**Graph:** `aura-graph/v2.0@680FD8D8F2142E92DE5A629B60D9C1DE160CCC57A0F7DDDDC872CDC4ACDAB9A8`  
**Node:** OR02  
**Movement:** lateral from IP05 while IP05 awaits independent verification  
**Side effects in this node:** none

## Outcome

Create one provider-neutral control plane that must authorize every future hosted OpenRouter design-intent task before execution. It enforces opaque user, session, and project rate ceilings; a global UTC-day provider-cost ceiling; concurrency and input/output byte ceilings; a default-off kill switch; no-content retention; redacted audit receipts; and deterministic-fake fallback.

The control plane accepts an injected atomic state store and injected verified IP03 adapters. Tests use an in-memory atomic store, a hosted-shaped fake, and the existing deterministic fake. No route, key, provider request, spend, persistence adapter, account setting, public UI, fee, wallet, project mutation, or frozen 3D/rendering work enters OR02. A future live integration must provide a durable atomic store and remain blocked until its separate secrets, budget, privacy, terms, and founder activation gates pass.

## Dependency interpretation

- OR01 is independently verified and supplies the hosted-shaped OpenRouter boundary.
- IP03 is already verified beneath OR01 and remains the only task/request/response/error/cost promotion boundary.
- IP05 is not an OR02 dependency. OR02 is disjoint lateral work while IP05 remains `verification-pending`.
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
5. Count hosted attempts even when the provider later fails, release every reservation exactly once, and never allow actual hosted cost to exceed its reservation or daily cap.
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
- temporary hosted unavailability/rate/payment failures release once and use one deterministic fallback, while invalid output/receipt and accounting drift fail closed;
- actual provider cost cannot exceed the reservation or global cap;
- UTC bucket changes reset only their declared windows and stale counters cannot smuggle spend or concurrency;
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

Stop and refuse rather than expanding OR02 if implementation requires a live provider call, route, secret, account login, account/guardrail mutation, workspace-budget mutation, spend, fee, payment, persistent production store, project mutation, UI, GitHub synchronization outside the separately authorized branch push, or any frozen/public design path.
