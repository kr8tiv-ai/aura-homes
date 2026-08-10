"""The architectural vocabulary.

The brief's rule — "accurate renders, not floofy AI noise" — is enforced
here, not by hoping the model behaves. Three mechanisms:

1. **Exact material keywords.** "CLT panels", "rammed earth", "fluted glass",
   "brushed concrete" — nouns a builder would use, never adjectives like
   "beautiful" or "stunning" that push a diffusion model toward render-farm
   kitsch.
2. **A camera and a light, always.** Every prompt names a view, a lens, and
   a time of day. Unspecified lighting is where AI renders go to die.
3. **A hard negative prompt.** Explicitly excludes the failure modes of
   architectural image generation: warped verticals, impossible cantilevers,
   melted window mullions, illegible signage, people, and the vignette-heavy
   "AI look".
"""

from __future__ import annotations

from ..models import DesignRequest, EcoMaterial, HomeStyle, RenderPrompt

MATERIAL_VOCAB: dict[EcoMaterial, list[str]] = {
    EcoMaterial.SIP: [
        "structural insulated panel construction",
        "flush vertical shiplap cladding",
        "standing seam metal roof",
        "triple-glazed windows",
        "black anodised aluminium window frames",
    ],
    EcoMaterial.RAMMED_EARTH: [
        "rammed earth walls",
        "visible horizontal lift lines",
        "ochre and sand stratification",
        "deep window reveals",
        "brushed concrete sills",
    ],
    EcoMaterial.CLT: [
        "CLT panels",
        "exposed cross-laminated timber soffits",
        "visible finger-jointed lamellae",
        "blackened steel connections",
        "fluted glass entry screen",
    ],
    EcoMaterial.TIMBER_FRAME: [
        "exposed douglas fir post and beam frame",
        "mortise and tenon joinery",
        "charred cedar cladding",
        "clerestory glazing",
    ],
}

STYLE_VOCAB: dict[HomeStyle, list[str]] = {
    HomeStyle.SCANDINAVIAN_MINIMALIST: [
        "restrained massing", "monopitch roof", "pale birch interior",
        "matte white walls", "no ornament",
    ],
    HomeStyle.OFF_GRID_CABIN: [
        "compact rectangular massing", "deep eaves", "wood stove flue",
        "elevated on screw piles", "cedar deck",
    ],
    HomeStyle.PASSIVE_SOLAR: [
        "south-facing glazing band", "deep summer shading overhang",
        "thermal mass floor", "minimal north glazing",
    ],
    HomeStyle.MODERN_AFRAME: [
        "steep A-frame gable", "full-height gable glazing",
        "dark standing seam roof to grade",
    ],
}

#: The single most important string in this file.
NEGATIVE = (
    "warped perspective, curved walls, impossible cantilever, melted mullions, "
    "duplicated windows, misaligned roofline, floating stairs to nowhere, "
    "illegible text, watermark, signature, people, cars, oversaturated sky, "
    "lens flare, heavy vignette, HDR halo, fisheye, tilt-shift blur, "
    "cluttered decor, plastic sheen, cartoon, illustration, concept art"
)

BASE = (
    "photorealistic architectural render, {view}, {camera}, {light}, "
    "physically-based materials, accurate scale, straight verticals, "
    "1-point perspective correction, neutral white balance, "
    "architectural photography, 24mm tilt-shift lens, f/8"
)

VIEWS = {
    "exterior": ("three-quarter exterior view", "midday overcast daylight, soft shadows"),
    "interior": ("interior view from the living space", "north daylight, no artificial fill"),
    "isometric": ("isometric cutaway view", "flat even studio lighting"),
}


def _keywords(req: DesignRequest) -> list[str]:
    kw = list(MATERIAL_VOCAB[req.material]) + list(STYLE_VOCAB[req.style])
    if req.off_grid:
        kw += ["roof-mounted solar array", "no overhead power lines"]
    if req.climate_zone.value.startswith("7") or req.climate_zone.value == "8":
        kw += ["snow on the ground", "bare birch and spruce", "cold climate detailing"]
    return kw


def build_offline_render_prompts(req: DesignRequest) -> list[RenderPrompt]:
    """Vocabulary-driven prompts that need no LLM at all."""
    kw = _keywords(req)
    out: list[RenderPrompt] = []
    for view in ("exterior", "interior"):
        camera, light = VIEWS[view]
        subject = (
            f"{req.total_sq_ft} square foot single-storey off-grid home"
            if req.storeys == 1
            else f"{req.total_sq_ft} square foot two-storey off-grid home"
        )
        out.append(RenderPrompt(
            view=view,  # type: ignore[arg-type]
            prompt=(BASE.format(view=view, camera=camera, light=light)
                    + f", {subject}, " + ", ".join(kw)),
            negative_prompt=NEGATIVE,
            material_keywords=kw,
        ))
    return out


def system_prompt() -> str:
    return (
        "You are an architectural designer producing inputs for a DETERMINISTIC "
        "drafting engine. You do not draw. You return two things: a room program "
        "and image-generation prompts.\n\n"
        "Rules:\n"
        "- Room dimensions are in FEET and are a PROGRAM, not coordinates. A "
        "  Python packer re-solves the geometry, so give sensible proportions, "
        "  not a layout.\n"
        "- Room areas must sum to roughly 78-86% of the requested total; the "
        "  remainder is walls and circulation.\n"
        "- Mark bathrooms, kitchens and mechanical rooms as wet:true so the "
        "  packer can share a plumbing wall.\n"
        "- Never propose a room whose short dimension is under 6 feet.\n"
        "- Rendering prompts must use exact construction nouns (\"CLT panels\", "
        "  \"rammed earth\", \"standing seam metal roof\"). Never use "
        "  \"beautiful\", \"stunning\", \"luxury\", \"dream\" or any adjective "
        "  that pushes a diffusion model toward kitsch.\n"
        "- Every prompt names a view, a lens and a light condition.\n"
        "- Cold-climate plans (zone 7A/7B/8) must keep north glazing minimal."
    )


def user_prompt(req: DesignRequest) -> str:
    return (
        f"Design brief:\n"
        f"- Bedrooms: {req.bedrooms}\n"
        f"- Bathrooms: {req.bathrooms:g}\n"
        f"- Total: {req.total_sq_ft} sq ft, {req.storeys} storey(s)\n"
        f"- Climate zone: {req.climate_zone.value}\n"
        f"- Primary material: {req.material.value.replace('_', ' ')}\n"
        f"- Style: {req.style.value.replace('_', ' ')}\n"
        f"- Off-grid: {req.off_grid}\n"
        + (f"- Notes: {req.notes}\n" if req.notes else "")
        + f"\nSuggested vocabulary: {', '.join(_keywords(req))}"
    )
