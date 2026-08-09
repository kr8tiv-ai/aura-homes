# Blender MCP — installed, connected, and how we use it

*Set up Aug 2026 after the workflow described in [this article](https://x.com/qibazx/status/2084353730280050765): the value of AI in 3D is the technical half — audits, forensics, verification loops — not mesh generation. The Blender MCP connector is official: built by the Blender developers, shipped from blender.org, GPL-3.0.*

## What is installed on this machine

| Piece | State |
|---|---|
| Blender | 5.2.0 LTS (`C:\Program Files\Blender Foundation\Blender 5.2\`) — upgraded from 5.0.1 (extension needs 5.1+) |
| MCP add-on | `mcp` v1.0.0 from the Blender Lab repo, installed + enabled (socket bridge, default `localhost:9876`) |
| MCP server | `blmcp` 1.0.0 (from the official `.mcpb` bundle) at `C:\Users\lucid\.claude\mcp\blender-mcp`, run via `uv` |
| Client registration | `claude mcp add blender --scope user -- uv run --directory C:\Users\lucid\.claude\mcp\blender-mcp blender-mcp` → **✓ Connected** (available in all future Claude Code sessions) |

## Starting it

- **Live session:** open Blender → the MCP add-on serves on `localhost:9876` (add-on auto-start preference).
- **Headless (audits without touching your session):** `& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" --background yourfile.blend --command blender_mcp` — blocks and serves; each request completes before returning.
- The `blender` MCP server in Claude then bridges stdio ↔ that socket.

**Security note (from blender.org, verbatim spirit):** the server executes generated code in Blender with no guards. Use on scenes you can afford to rebuild; save first; review code on anything irreplaceable.

## The jobs it does for Aura Homes

1. **Polygon-budget audits of the landing scene** — the exact "polys vs on-screen size" outlier analysis from the article, applied to our GLB props before every Pages deploy (payload and frame-pacing are brand rules).
2. **GLB asset forensics** — walk unfamiliar CC0 models before adopting them: material count, modifier stacks, hidden subdivision, texture sizes.
3. **Optimization passes** — decimation, texture baking, prop merging via scripted `bpy`, verified with the screenshot loop.
4. **Future design pipeline** — Blender headless as the IFC/GLB conversion stage for the review-ready design packages (Phase 2 roadmap), driven by the same MCP surface.
5. **Custom export operators** — repo-specific tooling (e.g. "export scene as draco-compressed GLB with our naming") written into Blender's UI on demand.

*The generation-vs-technical lesson also validates our scene approach: we assemble credited CC0 models and procedural geometry, and use tooling for the half that eats weeks.*
