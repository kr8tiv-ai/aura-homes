"""Render prompt construction.

The vocabulary itself lives in `app/eco.py` — one source of truth, because the
same material choice drives the wall thickness, the bill of materials and the
render. This module turns that vocabulary into prompts.

The brief's rule — "accurate renders, not floofy AI noise" — is enforced by
three mechanisms rather than hope:

1. **Exact construction nouns.** "CLT panels", "rammed earth", "fluted glass",
   "standing seam metal roof" — never "beautiful", "stunning" or "dream",
   which push a diffusion model straight to render-farm kitsch.
2. **A camera and a light, always.** Unspecified lighting is where AI
   architectural renders go to die.
3. **A hard negative prompt that includes the ECO TELLS.** `eco.NEGATIVE`
   bans poured concrete, cinder block, asphalt shingles, vinyl siding and
   overhead power lines alongside the usual warped-geometry failures — so a
   render that contradicts the brand can't slip through.
"""

from __future__ import annotations

from ..eco import NEGATIVE, keywords_for
from ..models import DesignRequest, RenderPrompt

BASE = (
    "photorealistic architectural render, {view}, {camera}, {light}, "
    "physically-based materials, accurate scale, straight verticals, "
    "one-point perspective correction, neutral white balance, "
    "architectural photography, 24mm tilt-shift lens, f/8"
)

VIEWS: dict[str, tuple[str, str]] = {
    "exterior": ("three-quarter exterior view", "midday overcast daylight, soft shadows"),
    "interior": ("interior view from the living space toward the glazing",
                 "north daylight, no artificial fill"),
    "isometric": ("isometric cutaway view", "flat even studio lighting"),
}


def _subject(req: DesignRequest) -> str:
    storey = "single-storey" if req.storeys == 1 else "two-storey"
    grid = "off-grid" if req.systems.grid_optional else "grid-tied"
    return f"{req.total_sq_ft} square foot {storey} {grid} eco home"


def eco_keywords(req: DesignRequest) -> list[str]:
    return keywords_for(req.material, req.systems, req.site, req.climate_zone.value)


def build_offline_render_prompts(req: DesignRequest) -> list[RenderPrompt]:
    """Vocabulary-driven prompts that need no LLM at all."""
    kw = eco_keywords(req)
    out: list[RenderPrompt] = []
    for view in ("exterior", "interior"):
        camera, light = VIEWS[view]
        out.append(
            RenderPrompt(
                view=view,  # type: ignore[arg-type]
                prompt=(BASE.format(view=view, camera=camera, light=light)
                        + f", {_subject(req)}, " + ", ".join(kw)),
                negative_prompt=NEGATIVE,
                material_keywords=kw,
            )
        )
    return out


def system_prompt() -> str:
    return (
        "You are an architectural designer producing inputs for a DETERMINISTIC "
        "drafting engine. You do not draw. You return a room program and "
        "image-generation prompts.\n\n"
        "This is an AURA eco-home. Non-negotiable house doctrine:\n"
        "- NO CONCRETE, ever. The foundation is protected galvanized screw piles. "
        "  Never mention slabs, footings, cinder block or poured foundations.\n"
        "- Glass-forward, but fenestration stays at or under 22% FDWR "
        "  (NBC 9.36 prescriptive). In cold zones keep north glazing minimal and "
        "  put the glazing band on the south face.\n"
        "- Off-grid systems are part of the architecture, not add-ons: solar array, "
        "  battery, auto-start generator, WETT-inspected wood stove, atmospheric "
        "  water generator, rainwater catchment, greywater to subsurface drip, and a "
        "  wood-fired cedar hot tub with a deck.\n"
        "- Hempcrete is NON-STRUCTURAL infill and always needs a timber frame.\n\n"
        "Room program rules:\n"
        "- Dimensions in FEET, and a PROGRAM not coordinates — a Python packer "
        "  re-solves the geometry, so give sensible proportions, not a layout.\n"
        "- Room areas sum to roughly 78-86% of the requested total; the rest is "
        "  walls and circulation.\n"
        "- Mark bathrooms, kitchens and mechanical as wet:true so the packer can "
        "  share a plumbing wall.\n"
        "- Never propose a room whose short dimension is under 6 feet.\n\n"
        "Prompt rules:\n"
        "- Exact construction nouns only. Never 'beautiful', 'stunning', 'luxury' "
        "  or 'dream'.\n"
        "- Every prompt names a view, a lens and a light condition."
    )


def user_prompt(req: DesignRequest) -> str:
    s = req.systems
    kit = ", ".join(
        [n for n, on in (
            ("AWG", s.awg), (f"{s.solar_kw:g}kW solar", s.solar_kw > 0),
            (f"{s.battery_kwh:g}kWh battery", s.battery_kwh > 0),
            ("generator", s.generator), ("wood stove", s.wood_stove),
            ("greywater biofilter", s.greywater), ("rainwater catchment", s.rainwater),
            ("wood-fired hot tub", s.hot_tub), ("HRV", s.hrv),
            ("cork flooring", s.cork_flooring), ("reclaimed joinery", s.reclaimed_interior),
            ("composting toilet", s.composting_toilet),
        ) if on]
    )
    return (
        f"Design brief:\n"
        f"- Bedrooms: {req.bedrooms}\n"
        f"- Bathrooms: {req.bathrooms:g}\n"
        f"- Total: {req.total_sq_ft} sq ft, {req.storeys} storey(s)\n"
        f"- Climate zone: {req.climate_zone.value}\n"
        f"- Primary material: {req.material.value.replace('_', ' ')}\n"
        f"- Style: {req.style.value.replace('_', ' ')}\n"
        f"- Glazed face orientation: {req.site.orientation.value.replace('_', '-')}\n"
        f"- Foundation: {req.site.foundation.replace('_', ' ')} (fixed — no concrete)\n"
        f"- Eco kit: {kit}\n"
        + (f"- Notes: {req.notes}\n" if req.notes else "")
        + f"\nUse this vocabulary: {', '.join(eco_keywords(req))}"
    )
