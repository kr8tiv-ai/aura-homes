# Canvas-first Guided Studio

**Approved direction:** Option 1 — Canvas-first Guided Studio

**Founder instruction:** “go with 1 and then add the ux nodes and begin work and approve everything”

**Scope:** Aura’s 2D cabin editor and its functional project controls. The public-site visual system and every 3D/rendering/animation/engine surface remain frozen.

## Outcome

A new user should reach an editable cabin plan before they have to understand Aura’s internal stages. The plan is the workspace; guidance, exact controls, evidence, AI proposals, and exports surround it without pushing it below the fold.

At a 1280 × 720 desktop viewport, the editable 2D canvas and the controls needed to make a first edit are visible without page scrolling. On phones, Aura supports review, measurements, comments, and bounded light corrections; dense CAD authoring remains a desktop/tablet task.

## Evidence behind the direction

- Autodesk Forma treats the canvas as the primary workspace, with proposal/layer navigation to the left and contextual properties/analysis to the right.
- SketchUp keeps exact numeric input coupled to the active tool and makes cancel, inference, and measurement feedback immediate.
- TestFit keeps constraints and cost responsive while allowing users to save and compare schemes.
- Rayon separates drawing commands, layers, visibility, and locking without turning every capability into a permanently open panel.
- WCAG 2.2 requires alternatives to dragging, visible and unobscured focus, and sufficiently large targets.

These patterns are inputs, not a request to imitate another product’s visual design. Aura reuses its existing type, color, panel, button, and status language.

## Information architecture

### Compact project bar

The top functional row contains the project name, save/recovery state, undo/redo, Guided/Pro mode, and a command/measurement field. It does not contain project evidence or long explanations.

### Task rail

The task rail exposes the current sequence—Plans, Shell, Rooms, Openings, Site, Performance, Materials, Review—without hiding Pro workspaces. The active task, completion state, and next useful action are evident. Changing tasks never creates a second project model.

### Primary canvas

The 2D plan is visible immediately when the selected task is a 2D editing task. Selection, pointer manipulation, keyboard movement, and exact numeric entry all call the same deterministic project mutation and history path. The existing 3D view may remain available, but this work cannot modify, remount, optimize, or restyle its renderer.

### Contextual inspector

The inspector shows only the active selection or tool: identity, dimensions, placement, validation, and relevant actions. Empty selection produces brief next-step guidance. Exact values and pointer edits have identical validation, hashing, undo, and persistence semantics.

### Evidence drawer

Cost, constraints, provenance, technical status, co-pilot evidence, and export readiness remain available in a collapsible drawer. Collapsing evidence cannot erase warnings, promote a status, or hide a blocking failure; the compact shell retains an honest summary and reopens at the relevant evidence.

## Image-to-plan entry

The Start/Plans task accepts a reference photo, sketch, or floor plan. Aura first displays consent, transmission, retention, and model-cost terms. Model output is a typed proposal. Deterministic code compiles and validates it before Aura displays assumptions, confidence, unresolved fields, and a before/after comparison.

Accepting the proposal creates one hashable, undoable project revision. Rejecting or cancelling writes nothing. The source image is deleted by default after inference unless the user explicitly chooses retention.

## Variants and comparison

A user can preserve candidate schemes and compare them using current project hashes and measurable attributes such as area, room program, cost band, constraint warnings, and export status. Aura never labels an option “best” without a declared objective and evidence.

## Accessibility and device contract

- Every drag operation has a keyboard or explicit-value alternative.
- Focus remains visible and is not obscured by drawers or sticky controls.
- Interactive targets satisfy WCAG 2.2 minimum target sizing.
- Status is not communicated by color alone.
- Mobile avoids sideways page overflow; the drawing can pan within its frame.
- Phone workflows prioritize review, measurement, comments, and bounded corrections. Full precision authoring is supported on desktop/tablet.

## Performance contract

- The canvas and primary tools load before secondary evidence modules.
- Heavy editor modules load when activated and never through a request waterfall.
- Pointer feedback should render within the next frame; deterministic edit acknowledgement targets under 100 ms and visible status under 400 ms on the supported baseline device.
- Derived cost/constraint recomputation is non-blocking and cannot overwrite newer project state.
- No performance work in this lane may touch a frozen 3D surface.

## Error and recovery behavior

Invalid exact input remains editable and names the constraint. A failed model proposal leaves the current project unchanged and offers retry, manual start, or a useful refusal. Save, recovery, and project provenance remain visible. Undo/redo describes the project action rather than implementation details.

## Verification

The release gate combines deterministic tests and task-based evaluation:

1. At 1280 × 720, a 2D editing task exposes the canvas and first-edit controls without page scroll.
2. A new user can start or open a project, make a measured edit, undo it, save it, and find export status.
3. Pointer, keyboard, and numeric edits yield the same canonical result for the same intended operation.
4. Evidence warnings remain discoverable when the drawer is collapsed.
5. Phone review has no page-level horizontal overflow and does not claim full CAD parity.
6. Protected 3D paths remain byte-for-byte outside the change set and the freeze guard stays green.

## Explicit non-goals

- No public-site restyle.
- No renderer, engine, animation, camera, shader, lighting, model, texture, geometry-adapter, or scene-performance change.
- No autonomous model mutation.
- No permit, engineering, construction, price, or investment claim promotion.
- No live provider call, payment, deployment, or external action without its separate gate.
