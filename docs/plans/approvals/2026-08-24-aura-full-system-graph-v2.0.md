# Aura Full-System Operating Graph v2.0 — Founder Approval Record

| Field | Value |
|---|---|
| Graph version | `2.0` |
| Approval state | `APPROVED` |
| Founder | Matt |
| Founder instruction | `go with 1 and then add the ux nodes and begin work and approve everything` |
| Approval date | `2026-08-24` |
| Approved UX direction | `Option 1 — Canvas-first Guided Studio` |
| Proposed graph commit | `f7616886f9f8a171c847ef5eb49e932246ff989b` |
| Proposed graph canonical Git-blob SHA-256 | `680FD8D8F2142E92DE5A629B60D9C1DE160CCC57A0F7DDDDC872CDC4ACDAB9A8` |
| Proposed graph Git-object SHA-256 | `48A7E075406A0E9C8EE24C11C9C411EC10C0F219D0CCF84D9129FA83D79D49C7` |
| Approval scope | Graph v2.0 and UX01–UX10 may proceed dependency-first through committed manifests. |

This approval makes `docs/plans/2026-08-22-aura-full-system-graph-v2.0.md`
the canonical Aura operating graph. It supersedes Graph v1.1, proposed Graph
v1.2, the remaining-tree plan, and conflicting earlier planning documents.

The founder-approved Canvas-first Guided Studio is a bounded authorization to
reorganize and improve Aura's functional 2D builder workspace using the existing
visual language. It does not authorize changes to the public-site visual system
outside that workspace.

The website's 3D, rendering, animation, engine, camera, shader, lighting, model,
texture, geometry-adapter, quality, and scene-performance behavior remains
frozen. The approval does not authorize deployment, push, spending, secrets,
live provider calls, payments, contracts, property activity, professional
sign-off, public investment claims, outreach, DNS/infrastructure changes, or
mainnet activity. Those remain subject to the graph's named gates and fresh
explicit authority.

The prior recurring graph auditors remain cancelled. Verification occurs only
at the point-in-time boundaries defined by Graph v2.0.

## Provenance correction

The first local approval-record commit, `24218b7`, incorrectly labeled a hash
computed with the two printable characters `\\0` in its object framing as the
canonical Git-blob SHA-256. This correction uses the established Graph v1.1
convention: SHA-256 of the exact bytes stored in Git for the graph blob. The
separately recorded Git-object hash uses the actual NUL-framed Git object. The
proposal commit and graph bytes did not change.
