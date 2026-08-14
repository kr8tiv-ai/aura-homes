"""The eco spine of an Aura home.

Nothing generic is allowed through. Every design this service emits is an
off-grid Aura eco-home, and the constraints below are the repo's own standing
doctrine — pulled from docs/VISION.md, docs/AI-HANDOFF.md and
docs/research/FOUNDATIONS-NO-CONCRETE.md, not invented here:

  · NO CONCRETE, ever. Protected galvanized screw piles are the foundation
    standard. Grouted pile variants are excluded because they reintroduce
    cementitious material into the ground. Hempcrete is NON-STRUCTURAL infill
    only — it is never a foundation and never a structural wall.
  · AWG on every home, honestly labelled. Condenser cutoff is ~15 degC /
    30% RH, so outdoor winter output in zone 7A/7B/8 is ZERO litres. A cistern
    or well carries winter, always. The module ships anyway as the summer
    producer (10-20 L/day, June-September).
  · Glass-forward, but code-legal. FDWR <= 22% on the NBC 9.36 prescriptive
    path, oriented for winter solar gain.
  · Solar + LiFePO4 + an auto-start generator that is NOT optional in an
    Alberta January, plus a WETT-inspected wood stove.
  · Greywater to a subsurface-drip field; rainwater to the cistern.
  · SIP because the envelope is the enemy in zone 7A. Honest lead time is
    12-20 weeks and no software shortens a panel plant's queue.

These are not decoration on the prompt — they drive wall thickness, glazing
budget, the systems that appear on the plan, and the materials list that the
procurement step prices in USDC.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class EcoMaterial(str, Enum):
    SIP = "sip"
    CLT = "clt"
    TIMBER_FRAME = "timber_frame"
    RAMMED_EARTH = "rammed_earth"
    BAMBOO = "bamboo"
    RECLAIMED_TIMBER = "reclaimed_timber"
    HEMPCRETE_INFILL = "hempcrete_infill"  # non-structural, paired with a frame


#: Structural wall thickness in mm. Real numbers — they change the plan, the
#: net internal area, and the price per square foot.
WALL_THICKNESS_MM: dict[EcoMaterial, int] = {
    EcoMaterial.SIP: 165,
    EcoMaterial.CLT: 128,
    EcoMaterial.TIMBER_FRAME: 190,
    EcoMaterial.RAMMED_EARTH: 450,
    EcoMaterial.BAMBOO: 175,
    EcoMaterial.RECLAIMED_TIMBER: 200,
    EcoMaterial.HEMPCRETE_INFILL: 300,  # timber frame + hempcrete infill
}

#: Effective R-value of the assembly, for the honest energy note on the sheet.
WALL_R_VALUE: dict[EcoMaterial, int] = {
    EcoMaterial.SIP: 40,
    EcoMaterial.CLT: 28,
    EcoMaterial.TIMBER_FRAME: 32,
    EcoMaterial.RAMMED_EARTH: 26,  # mass, not resistance — needs an insulated core
    EcoMaterial.BAMBOO: 24,
    EcoMaterial.RECLAIMED_TIMBER: 30,
    EcoMaterial.HEMPCRETE_INFILL: 27,
}

#: Materials that are NOT structural on their own and must carry a frame.
NON_STRUCTURAL = {EcoMaterial.HEMPCRETE_INFILL}


class Orientation(str, Enum):
    """Which way the long glazed face points. Passive-solar wants south."""

    SOUTH = "south"
    SOUTH_EAST = "south_east"
    SOUTH_WEST = "south_west"
    EAST = "east"
    WEST = "west"
    NORTH = "north"


class EcoSystems(BaseModel):
    """The off-grid kit. Defaults are the Aura standard, not a blank slate."""

    awg: bool = Field(default=True, description="Atmospheric water generation — recommended on every home")
    solar_kw: float = Field(default=8.0, ge=0, le=30)
    battery_kwh: float = Field(default=24.0, ge=0, le=100)
    generator: bool = Field(default=True, description="Auto-start; not optional in an Alberta January")
    wood_stove: bool = Field(default=True, description="WETT-inspected")
    greywater: bool = Field(default=True, description="Biofilter + subsurface drip")
    rainwater: bool = Field(default=True, description="Roof catchment to the cistern")
    cistern_litres: int = Field(default=9000, ge=0, le=40000)
    composting_toilet: bool = False
    hot_tub: bool = Field(default=True, description="Wood-fired — a costed first-class line item")
    deck: bool = True
    hrv: bool = Field(default=True, description="Heat-recovery ventilation; airtight envelopes need it")
    grid_optional: bool = Field(default=True, description="Off-grid by default, grid-connectable forever")

    #: Interior fit-out that should read as Aura rather than generic.
    cork_flooring: bool = True
    reclaimed_interior: bool = True
    furniture_package: bool = False


class SiteContext(BaseModel):
    orientation: Orientation = Orientation.SOUTH
    #: Foundation is not a choice. It is screw piles, because no concrete.
    foundation: str = Field(default="protected_galvanized_screw_piles", frozen=True)
    tree_cover: bool = True
    snow_load: bool = True


# --------------------------------------------------------------------------
# render vocabulary — exact construction nouns, never adjectives
# --------------------------------------------------------------------------

MATERIAL_KEYWORDS: dict[EcoMaterial, list[str]] = {
    EcoMaterial.SIP: [
        "structural insulated panel construction",
        "flush vertical shiplap cladding",
        "standing seam metal roof",
    ],
    EcoMaterial.CLT: [
        "CLT panels",
        "exposed cross-laminated timber soffits",
        "visible finger-jointed lamellae",
        "blackened steel connections",
    ],
    EcoMaterial.TIMBER_FRAME: [
        "exposed douglas fir post and beam frame",
        "mortise and tenon joinery",
        "charred shou sugi ban cedar cladding",
    ],
    EcoMaterial.RAMMED_EARTH: [
        "rammed earth walls",
        "visible horizontal lift lines",
        "ochre and sand stratification",
        "deep window reveals",
    ],
    EcoMaterial.BAMBOO: [
        "laminated bamboo panels",
        "visible bamboo node grain",
        "natural oiled finish",
    ],
    EcoMaterial.RECLAIMED_TIMBER: [
        "reclaimed barnwood cladding",
        "weathered grey patina",
        "visible original nail holes",
        "salvaged douglas fir beams",
    ],
    EcoMaterial.HEMPCRETE_INFILL: [
        "hempcrete infill between exposed timber studs",
        "lime plaster finish",
        "breathable wall assembly",
    ],
}

SYSTEM_KEYWORDS: dict[str, list[str]] = {
    "solar": ["roof-mounted monocrystalline solar array", "no overhead power lines"],
    "awg": ["compact atmospheric water generator on a exterior equipment pad"],
    "wood_stove": ["black steel wood stove flue through the roof"],
    "hot_tub": ["wood-fired cedar hot tub", "cedar deck"],
    "greywater": ["subsurface drip irrigation field", "no visible septic mound"],
    "rainwater": ["roof catchment gutters to a buried cistern"],
    "cork_flooring": ["cork flooring"],
    "reclaimed_interior": ["reclaimed timber interior joinery"],
    "screw_piles": ["elevated on galvanized screw piles", "no concrete foundation", "visible crawl space shadow"],
    "glass": ["triple-glazed windows", "black anodised aluminium frames", "fluted glass entry screen"],
}

#: Never allowed to appear. The first three are the eco tells that would make
#: a render wrong for this brand; the rest are the AI-render failure modes.
NEGATIVE = (
    "poured concrete foundation, concrete slab, cinder block, "
    "asphalt shingles, vinyl siding, PVC windows, satellite dish, "
    "overhead power lines, air conditioner unit, manicured lawn, "
    "warped perspective, curved walls, impossible cantilever, melted mullions, "
    "duplicated windows, misaligned roofline, illegible text, watermark, "
    "signature, people, cars, oversaturated sky, lens flare, heavy vignette, "
    "HDR halo, fisheye, cluttered decor, plastic sheen, cartoon, concept art"
)


def keywords_for(material: EcoMaterial, systems: EcoSystems, site: SiteContext, zone: str) -> list[str]:
    """The exact-noun vocabulary for one design."""
    kw = list(MATERIAL_KEYWORDS[material])
    if material in NON_STRUCTURAL:
        kw.insert(0, "exposed timber structural frame")
    kw += SYSTEM_KEYWORDS["screw_piles"]  # always — no concrete, ever
    kw += SYSTEM_KEYWORDS["glass"]
    if systems.solar_kw > 0:
        kw += SYSTEM_KEYWORDS["solar"]
    if systems.awg:
        kw += SYSTEM_KEYWORDS["awg"]
    if systems.wood_stove:
        kw += SYSTEM_KEYWORDS["wood_stove"]
    if systems.hot_tub:
        kw += SYSTEM_KEYWORDS["hot_tub"]
    if systems.greywater:
        kw += SYSTEM_KEYWORDS["greywater"]
    if systems.rainwater:
        kw += SYSTEM_KEYWORDS["rainwater"]
    if systems.cork_flooring:
        kw += SYSTEM_KEYWORDS["cork_flooring"]
    if systems.reclaimed_interior:
        kw += SYSTEM_KEYWORDS["reclaimed_interior"]
    if site.orientation.value.startswith("south"):
        kw += ["south-facing glazing band", "deep summer shading overhang"]
    if zone.startswith("7") or zone == "8":
        kw += ["snow on the ground", "bare birch and spruce", "cold climate detailing"]
    return kw


def honesty_notes(systems: EcoSystems, zone: str) -> list[str]:
    """Corrections the repo refuses to un-learn. Returned with every design."""
    out: list[str] = []
    if systems.awg and (zone.startswith("7") or zone == "8"):
        out.append(
            "The atmospheric water generator produces roughly 10–20 L/day from June to "
            "September and ZERO litres outdoors in winter — condenser cutoff is near "
            "15 °C / 30% RH. The cistern or well carries the winter, always."
        )
    if systems.solar_kw > 0 and (zone.startswith("7") or zone == "8"):
        out.append(
            "December solar yield in this zone is about 1.3 kWh/kW/day — a 70–77% collapse. "
            "The generator is not optional and the wood stove is the heat of last resort."
        )
    if not systems.generator and systems.grid_optional:
        out.append("No generator selected. Off-grid in an Alberta January without one is a real risk.")
    out.append(
        "Foundation is protected galvanized screw piles — cement-free, minimal-disturbance "
        "and reversible. Not 'zero carbon': the steel carries embodied carbon and we say so."
    )
    return out
