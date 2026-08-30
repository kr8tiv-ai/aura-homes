# OR01 Hosted OpenRouter Boundary — Implementation Plan

**Date:** 2026-08-29  
**Graph:** `aura-graph/v2.0@680FD8D8F2142E92DE5A629B60D9C1DE160CCC57A0F7DDDDC872CDC4ACDAB9A8`  
**Node:** OR01  
**Movement:** lateral from IP04 while IP04 awaits independent verification  
**Side effects in this node:** none

## Outcome

Create one hosted OpenRouter implementation of the verified IP03 `DesignIntentAdapter` contract. It converts the already-validated image task into a fixed, privacy-constrained, non-streaming OpenRouter request and converts the provider response back into the exact raw intent/receipt surface that IP03 validates.

The node does not add a route, UI, persistence, wallet, payment, fee, live model call, model-selection UI, or frozen 3D/rendering behavior. A server-only wrapper owns the API key and fixed endpoint, remains unreachable from the product, and refuses to initialize unless an explicit default-off live guard and an exact configured model allowlist both pass. OR03 owns any later live image-to-intent integration.

## Dependency interpretation

- `G02` is verified, so the freeze and write-set policy is enforceable.
- `IP03` is independently verified and is the only public task/adapter boundary OR01 may implement.
- IP04 is not an OR01 dependency. OR01 is lateral work while IP04 remains `verification-pending`.
- OR02 privacy, abuse, rate, and spend controls do not yet exist. Therefore OR01 may build and test a server boundary, but it must have no reachable live call path.

## Current official OpenRouter contract used by this plan

- Chat completions use `POST https://openrouter.ai/api/v1/chat/completions` with bearer authentication: <https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request>
- Local/private images can be sent as base64 data URLs inside multimodal messages: <https://openrouter.ai/docs/guides/overview/multimodal/image-understanding>
- Structured output uses `response_format.type = json_schema`, `strict: true`, and a schema with no extra fields; compatible providers can be required: <https://openrouter.ai/docs/guides/features/structured-outputs>
- Per-request routing can deny provider data collection, require ZDR endpoints, require supported parameters, and disable fallback routing: <https://openrouter.ai/docs/guides/routing/provider-selection> and <https://openrouter.ai/docs/guides/features/zdr>
- OpenRouter prompt/response retention is opt-in, while request metadata is retained; Aura still treats every transmitted image as a disclosed external transfer: <https://openrouter.ai/docs/guides/privacy/data-collection>

These sources describe a provider interface, not authority to transmit data or spend. No request is made in this node.

## Contract

### Pure adapter module

`app/lib/ai/openRouterDesignIntentAdapter.ts` will:

1. Implement the exact IP03 `DesignIntentAdapter` interface with `kind: "hosted"`.
2. Accept a bounded model identifier and a transport function injected by the server wrapper; it will never read environment variables, secrets, storage, or browser state.
3. Produce a fixed non-streaming multimodal request:
   - static system and user instructions;
   - text before one base64 image data URL;
   - the exact source fingerprint, so IP03 can verify provenance;
   - strict DesignIntent JSON Schema;
   - `temperature: 0`;
   - `provider.require_parameters: true`;
   - `provider.data_collection: "deny"`;
   - `provider.zdr: true`;
   - `provider.allow_fallbacks: false`.
4. Never accept arbitrary messages, prompts, URLs, endpoints, headers, tools, providers, or request parameters from the caller.
5. Parse one non-streaming response without repairing it. Missing/multiple choices, non-string content, malformed JSON, invalid usage, missing model/request identity, hostile accessors/proxies, or an inconsistent response is a bounded provider failure; IP03 remains the strict DesignIntent and receipt promotion gate.
6. Convert the provider-reported USD cost to nearest integer micros with a safe bounded rule and preserve prompt/completion token counts when present.
7. Map cancellation, HTTP 402, HTTP 408/429, and temporary upstream failures to IP03 bounded adapter failures without leaking bodies, headers, URLs, keys, raw errors, or stacks.

### Server-only wrapper

`app/lib/server/openRouterDesignIntentAdapter.server.ts` will:

1. Import `server-only` and be the only OR01 module allowed to read `process.env`, own the API key, or call `fetch`.
2. Use only the fixed HTTPS OpenRouter chat-completions endpoint.
3. Refuse initialization unless live execution is explicitly enabled, a non-empty server key exists, a bounded model is configured, and that model is an exact member of the configured allowlist.
4. Send only `Authorization` and `Content-Type` headers and forward the task abort signal.
5. Export a factory only. No route or application surface imports or invokes it in OR01.

## Exact write set

1. `docs/plans/2026-08-29-or01-hosted-openrouter-boundary-plan.md`
2. `docs/plans/execution/v2/OR01-hosted-openrouter-boundary.json`
3. `app/lib/ai/openRouterDesignIntentAdapter.ts`
4. `app/lib/server/openRouterDesignIntentAdapter.server.ts`
5. `app/tests-or01/openrouter-boundary.contract.ts`
6. `app/playwright.or01.config.ts`

No package, shared test-count, route, UI, CSS, public-site, project-store, payment, wallet, or protected path is in scope.

## Test-first proof

The dedicated OR01 contract will first fail because the adapter modules do not exist, then prove:

- the adapter is the exact IP03 hosted interface and is deterministic for the same request/transport response;
- the request contains one fixed endpoint-independent payload, text before image, exact fingerprint, strict schema, zero temperature, non-streaming mode, and the four privacy/routing constraints;
- caller data cannot inject messages, endpoints, headers, provider routing, tools, or extra JSON fields;
- the transport receives a detached immutable payload and the original task abort signal;
- valid content and usage become the raw IP03 response and then pass `runDesignIntentTask` strict promotion;
- malformed, hostile, multi-choice, empty, non-JSON, or incomplete responses fail without partial output or private detail;
- abort, 402, 408, 429, and 5xx responses map to the correct bounded IP03 failures;
- cost becomes safe integer USD micros and unsafe cost/token/request/model fields fail;
- the server wrapper is server-only, fixed-endpoint, default-off, allowlist-gated, and is not imported by any route/client/application module;
- neither module changes or imports frozen 3D/rendering/animation surfaces.

## Required gates

1. `npm run typecheck`
2. `npx playwright test --config=playwright.or01.config.ts`
3. `npm test`
4. `npm run test:graph-v2`
5. `npm run test:graph-position`
6. `git diff --check`
7. Exact base-to-candidate six-path comparison
8. Explicit G05 preflight with complete evidence
9. Independent fresh-context verification before `verified`

## Stop conditions

Stop and refuse rather than expanding the node if implementation requires a route, live call, secret provisioning, account login, provider contact, spend, logging/retention opt-in, OR02 controls, fee logic, UI, project persistence, GitHub synchronization, or any frozen/public design path.
