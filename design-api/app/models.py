"""Typed contracts for the design service.

Every boundary in this service is a Pydantic model, for the same reason the
TypeScript pipeline is typed end to end: the LLM is allowed to reason, but it
is never allowed to hand back a shape nobody validated. If the model returns
something that will not parse into `LayoutPlan`, we fall back to the
deterministic planner rather than drawing a blueprint from a guess.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator


# --------------------------------------------------------------------------
# INPUT — the questionnaire the landing page's "02 Design" step submits
# --------------------------------------------------------------------------


#: The material set, wall thicknesses, R-values and render vocabulary all live
#: in `eco.py` — one source of truth, because the same choice drives the plan
#: geometry, the bill of materials and the render prompt. Re-exported here so
#: existing imports keep working.
from .eco import (
    NON_STRUCTURAL,
    WALL_R_VALUE,
    WALL_THICKNESS_MM,
    EcoMaterial,
    EcoSystems,
    Orientation,
    SiteContext,
)


class HomeStyle(str, Enum):
    SCANDINAVIAN_MINIMALIST = "scandinavian_minimalist"
    OFF_GRID_CABIN = "off_grid_cabin"
    PASSIVE_SOLAR = "passive_solar"
    MODERN_AFRAME = "modern_aframe"


class ClimateZone(str, Enum):
    """NBC climate zones. 7A is the Alberta pilot (5,000–5,999 heating
    degree-days: Edmonton, Calgary, Leduc, Camrose)."""

    Z4 = "4"
    Z5 = "5"
    Z6 = "6"
    Z7A = "7A"
    Z7B = "7B"
    Z8 = "8"


#: Interior partitions are the same everywhere — they are not structural.
PARTITION_MM = 90

#: Fenestration-and-door-to-wall ratio ceiling on the NBC 9.36 prescriptive
#: path. The design step already enforces this in the TypeScript pipeline;
#: the blueprint must not silently draw more glass than the code allows.
FDWR_MAX = 0.22


class DesignRequest(BaseModel):
    """The questionnaire payload from the 02 Design step."""

    bedrooms: int = Field(ge=0, le=6)
    bathrooms: float = Field(ge=0.5, le=4, description="0.5 = a powder room")
    total_sq_ft: int = Field(ge=200, le=4000)
    climate_zone: ClimateZone = ClimateZone.Z7A
    material: EcoMaterial = EcoMaterial.SIP
    style: HomeStyle = HomeStyle.OFF_GRID_CABIN
    # Optional, all with honest defaults — the questionnaire is short by design
    storeys: Literal[1, 2] = 1
    off_grid: bool = True
    notes: str | None = Field(default=None, max_length=500)

    #: The eco kit. Defaults ARE the Aura standard — AWG, solar, battery,
    #: generator, wood stove, greywater, rainwater, wood-fired tub, HRV, cork
    #: floors, reclaimed joinery — so an empty questionnaire still produces a
    #: proper Aura eco-home rather than a generic box.
    systems: EcoSystems = Field(default_factory=EcoSystems)
    site: SiteContext = Field(default_factory=SiteContext)
    #: Glass-forward is the house style, held to FDWR ≤ 22%.
    glass_forward: bool = True

    @field_validator("bathrooms")
    @classmethod
    def half_steps_only(cls, v: float) -> float:
        if (v * 2) % 1 != 0:
            raise ValueError("bathrooms must be in half steps (1, 1.5, 2 …)")
        return v


# --------------------------------------------------------------------------
# INTERMEDIATE — what the LLM is allowed to return
# --------------------------------------------------------------------------


class RoomSpec(BaseModel):
    """One room, as reasoned by the LLM. Dimensions are FEET.

    The LLM proposes; the layout engine disposes. These numbers are treated
    as a *program* (this many rooms, roughly this big, this many windows),
    not as coordinates — the engine re-solves the packing so walls meet at
    right angles and the areas actually sum to the requested total.
    """

    name: str = Field(max_length=40)
    width: float = Field(gt=2, le=60)
    length: float = Field(gt=2, le=60)
    windows: int = Field(ge=0, le=8)
    # Optional hints the packer uses when it can honour them
    exterior: bool = True
    wet: bool = False  # bathrooms/kitchen — the packer clusters these

    @property
    def area(self) -> float:
        return self.width * self.length


class LayoutPlan(BaseModel):
    """The structured room layout — exactly the shape the spec calls for."""

    house_style: str
    total_sq_ft: int
    rooms: list[RoomSpec]

    @property
    def program_area(self) -> float:
        return sum(r.area for r in self.rooms)


class RenderPrompt(BaseModel):
    """The rendering prompt engine's output.

    Split into positive/negative because every image backend worth using
    takes both, and the negative prompt is what keeps this from producing
    the floofy AI noise the brief explicitly rules out.
    """

    prompt: str
    negative_prompt: str
    view: Literal["exterior", "interior", "isometric"] = "exterior"
    aspect_ratio: str = "3:2"
    material_keywords: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# GEOMETRY — what the deterministic engine produces (feet, origin top-left)
# --------------------------------------------------------------------------


class Opening(BaseModel):
    """A door or window cut in a wall segment."""

    kind: Literal["door", "window"]
    # wall the opening sits in, and position along it (0..1 from wall start)
    wall: Literal["n", "s", "e", "w"]
    t: float = Field(ge=0, le=1)
    width: float = Field(gt=0)
    swing: Literal["in", "out"] | None = None


class PlacedRoom(BaseModel):
    """A room after packing — real coordinates, in feet."""

    name: str
    x: float
    y: float
    w: float
    h: float
    windows: int = 0
    wet: bool = False
    openings: list[Opening] = Field(default_factory=list)

    @property
    def area(self) -> float:
        return self.w * self.h


class FloorPlan(BaseModel):
    """The solved plan the blueprint renderer draws."""

    width: float  # overall exterior width, feet
    height: float  # overall exterior depth, feet
    wall_mm: int
    partition_mm: int
    rooms: list[PlacedRoom]
    gross_sq_ft: float
    net_sq_ft: float
    fdwr: float
    warnings: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------
# OUTPUT
# --------------------------------------------------------------------------


class ArtifactSet(BaseModel):
    """Where the generated files live. Paths are service-relative URLs."""

    svg_url: str | None = None
    pdf_url: str | None = None
    dxf_url: str | None = None
    render_urls: list[str] = Field(default_factory=list)


class DesignResponse(BaseModel):
    request: DesignRequest
    layout: LayoutPlan
    plan: FloorPlan
    render_prompts: list[RenderPrompt]
    artifacts: ArtifactSet
    #: True when the LLM was unavailable and the deterministic planner ran.
    #: Never hidden — an offline result is a valid result, but the caller is
    #: told which one it got.
    offline: bool = False
    notes: list[str] = Field(default_factory=list)
