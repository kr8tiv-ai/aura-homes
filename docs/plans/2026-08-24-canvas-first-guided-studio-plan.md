# Canvas-first Guided Studio Implementation Plan

**Goal:** Put Aura's editable 2D cabin canvas and first-edit controls first, then connect image-to-plan proposals, exact editing, evidence, comparison, accessibility, and usability gates without changing any frozen 3D behavior.

**Authority:** Aura Full-System Operating Graph v2.0, proposal `f7616886f9f8a171c847ef5eb49e932246ff989b`, Git-blob SHA-256 `9EDBA48895B426A2C68760C8AE564978DE9B290CD2B4050D96F049496DA109AC`, founder approval `24218b7`.

**Architecture:** Keep `BuilderDocument` / `BuildingGraph`, the existing reducer/history, project persistence, and `Plan2D` as canonical. Introduce a functional shell around current 2D controls. Selection, numeric entry, keyboard movement, pointer movement, AI preview, and undo remain adapters over the same deterministic mutations. Secondary evidence becomes progressively disclosed but never changes claim state.

## Stage 0 — Governed start

### G01: Canonical graph registry and execution contract

- Add a machine-readable pointer to the exact approved graph and approval record.
- Add a JSON Schema for v2 `ExecutionNode` manifests.
- Add a deterministic graph/approval/manifest verifier and focused tests.
- Update the execution README to retire v1.2 as authority.
- Gate failure: stale graph version, wrong proposal commit/hash, missing approval, malformed manifest, unknown dependency, or protected write-set ambiguity.

### G02: Freeze, write-set, and claim gates

- Encode protected 3D/public-site paths and the narrow Canvas-first 2D authorization.
- Verify each implementation diff against its manifest write set and freeze class.
- Keep copy-only exceptions explicit and fail closed.
- Add fixtures proving the gate rejects scene, renderer, model, texture, and global-restyle paths.

## Stage 1 — Canvas-first foundation

### UX01: Interaction contract

- Convert the approved design into test-addressable states and device contracts.
- Pin desktop/tablet full editing and phone review/measure/comment/light-correction scope.
- Add a baseline viewport test that demonstrates the existing below-fold failure before production changes.

### UX02: Canvas-first shell

- Add a compact project/status command row.
- Put task navigation and 2D canvas before land, cost, evidence, AI, and export detail.
- Add stable landmarks for task rail, primary canvas, contextual inspector, and evidence region.
- Preserve the existing mounted 3D path byte-for-byte and behavior-for-behavior.
- Verify 1280 × 720 first-canvas visibility and existing guided/pro routes.

### UX03–UX05: Exact controls and progressive evidence

- Make selection/tool state drive one contextual inspector.
- Route typed values and direct manipulation through the same mutators and hashes.
- Add command/measurement affordances with cancel and invalid-input feedback.
- Move cost, constraints, provenance, co-pilot, and export readiness behind a drawer with an always-visible blocking summary.

### UX08–UX09: Accessibility and responsiveness

- Prove non-drag alternatives, focus visibility, target sizing, non-color status, phone overflow, and bounded phone scope.
- Lazy-load secondary modules on activation and measure edit/status response without touching 3D performance code.

## Stage 2 — Picture to editable cabin

- Execute IP01–IP05 as provider-neutral schemas, fixtures, deterministic compiler, and validation.
- Connect IP06/UX06 as an explicit preview/accept/cancel flow in the Guided Studio.
- Persist only accepted revisions with provenance, deletion state, model/rule versions, and cost evidence.
- Keep OpenRouter calls behind OR01/OR02 activation controls; tests use the deterministic fake.

## Stage 3 — Comparison, package, and evaluation

- UX07 compares versioned schemes by hash and measurable attributes.
- ED02–ED05 expose honestly labeled outputs and professional handoff.
- UX10/IP08 run fixed beginner, ambiguous, adversarial, recovery, accessibility, and mobile-review tasks.
- Q01/Q04 require fresh tests, source/diff evidence, and independent verification.

## Verification sequence for every implementation slice

1. Run the cheapest manifest/authority/write-set/freeze checks.
2. Run the focused failing test before production code.
3. Implement the minimum bounded behavior.
4. Run focused tests and TypeScript.
5. Run the complete deterministic gate when shared editor code changes.
6. Run served-build UI tests only when the slice changes a visible browser workflow.
7. Record evidence and move the node to `verification-pending`; a different verifier decides `verified`.

## Non-negotiable stop conditions

- Any protected 3D/rendering/animation/engine path enters the diff.
- A proposed change creates a second project/geometry/history model.
- A model response mutates canonical state without preview and explicit commit.
- A blocking warning becomes invisible or a claim status advances without evidence.
- A live provider, payment, deployment, legal, professional, property, or mainnet gate is reached without its fresh authorization.
