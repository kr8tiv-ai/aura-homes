"""Bill of materials, derived from the solved geometry.

Quantities come from the plan, not from a table of guesses: wall area from
the envelope perimeter and storey height, roof area from the footprint and
pitch, glazing from the actual window openings the layout engine placed,
pile count from the footprint and a 2.4 m grid. That is what makes this a
procurement input rather than a brochure.

Prices are CAD ranges with a stated basis, matching the discipline in
`data/alberta/cost-model.json` — ranges, never point estimates, and every
line carries where the number came from.
"""

from __future__ import annotations

import math
from enum import Enum

from pydantic import BaseModel, Field

from .eco import NON_STRUCTURAL, EcoMaterial, EcoSystems

FT2_PER_M2 = 10.7639
WALL_HEIGHT_FT = 9.0
# Explicit assumption used to normalize the only checked-in glazing band.
# data/alberta/cost-model.json does not state a reference window size, so the
# resulting per-square-foot values are a planning proxy, not supplier pricing.
GLAZING_REFERENCE_WINDOW_SQ_FT = 16.0
GLAZING_CAD_PER_SQ_FT = {
    "low": 900 / GLAZING_REFERENCE_WINDOW_SQ_FT,
    "mid": 1350 / GLAZING_REFERENCE_WINDOW_SQ_FT,
    "high": 1800 / GLAZING_REFERENCE_WINDOW_SQ_FT,
}
DOOR_CAD_EACH = {"low": 700, "mid": 1100, "high": 1600}


class Category(str, Enum):
    FOUNDATION = "foundation"
    SHELL = "shell"
    ROOF = "roof"
    GLAZING = "glazing"
    ENERGY = "energy"
    WATER = "water"
    WASTE = "waste"
    INTERIOR = "interior"
    OUTDOOR = "outdoor"
    MECHANICAL = "mechanical"


class LineItem(BaseModel):
    key: str
    label: str
    category: Category
    qty: float
    unit: str
    cad_low: float
    cad_mid: float
    cad_high: float
    basis: str
    #: Owner-buildable per Alberta rules — solar wiring, septic install and
    #: well drilling are licensed work and are marked False.
    owner_buildable: bool = True
    #: Suppliers that plausibly carry it, by procurement tag (see procurement.py)
    supplier_tags: list[str] = Field(default_factory=list)

    @property
    def mid_total(self) -> float:
        return self.cad_mid


class BillOfMaterials(BaseModel):
    items: list[LineItem]
    cad_low: float
    cad_mid: float
    cad_high: float
    notes: list[str] = Field(default_factory=list)

    @property
    def by_category(self) -> dict[str, list[LineItem]]:
        out: dict[str, list[LineItem]] = {}
        for i in self.items:
            out.setdefault(i.category.value, []).append(i)
        return out


def _round(v: float, step: float = 50.0) -> float:
    return round(v / step) * step


def build(
    *,
    width_ft: float,
    depth_ft: float,
    gross_sq_ft: float,
    window_count: int,
    glazing_sq_ft: float,
    material: EcoMaterial,
    systems: EcoSystems,
    storeys: int = 1,
    door_count: int | None = None,
) -> BillOfMaterials:
    """Derive the BOM from solved geometry."""
    items: list[LineItem] = []
    notes: list[str] = []

    perimeter = 2 * (width_ft + depth_ft)
    wall_area = perimeter * WALL_HEIGHT_FT * storeys - glazing_sq_ft
    footprint = width_ft * depth_ft
    roof_area = footprint * 1.18  # 6:12 pitch + overhangs

    def add(**kw) -> None:
        items.append(LineItem(**kw))

    # ---- FOUNDATION — screw piles, never concrete
    piles = max(9, int(math.ceil(footprint / 64)))  # ~8ft grid
    add(key="screw_piles", label="Protected galvanized screw piles, installed",
        category=Category.FOUNDATION, qty=piles, unit="piles",
        cad_low=piles * 380, cad_mid=piles * 520, cad_high=piles * 700,
        basis="AC228-compliant galvanized helical piles, Alberta installed rate $380–700/pile. "
              "Grouted variants excluded — they reintroduce cementitious material.",
        owner_buildable=False, supplier_tags=["piles", "steel"])

    # ---- SHELL
    if material in NON_STRUCTURAL:
        add(key="timber_frame", label="Structural timber frame (carries the infill)",
            category=Category.SHELL, qty=round(wall_area, 0), unit="sq ft wall",
            cad_low=wall_area * 14, cad_mid=wall_area * 19, cad_high=wall_area * 26,
            basis="Post-and-beam frame required — hempcrete is non-structural infill only.",
            supplier_tags=["timber", "lumber"])
        add(key="hempcrete", label="Hempcrete infill + lime plaster",
            category=Category.SHELL, qty=round(wall_area, 0), unit="sq ft wall",
            cad_low=wall_area * 16, cad_mid=wall_area * 24, cad_high=wall_area * 34,
            basis="Hemp hurd + lime binder, cast in situ between studs.",
            supplier_tags=["hempcrete", "natural_building"])
    else:
        rates = {
            EcoMaterial.SIP: (30, 42, 55, "SIP kit incl. panels, splines, sealant; 12–20 week lead time from approved drawings.", ["sip", "panels"]),
            EcoMaterial.CLT: (46, 62, 84, "CLT panel package, CNC-cut, delivered.", ["clt", "timber"]),
            EcoMaterial.TIMBER_FRAME: (26, 36, 48, "Post-and-beam frame + insulated infill assembly.", ["timber", "lumber"]),
            EcoMaterial.RAMMED_EARTH: (52, 74, 105, "Stabilised rammed earth with insulated core; formwork and labour dominate.", ["rammed_earth", "natural_building"]),
            EcoMaterial.BAMBOO: (34, 47, 63, "Laminated structural bamboo panels, imported.", ["bamboo", "panels"]),
            EcoMaterial.RECLAIMED_TIMBER: (28, 44, 68, "Salvaged structural timber; price swings on availability.", ["reclaimed", "timber"]),
        }
        lo, mid, hi, basis, tags = rates[material]
        add(key="shell", label=f"{material.value.replace('_', ' ').title()} shell kit + erection",
            category=Category.SHELL, qty=round(wall_area, 0), unit="sq ft wall",
            cad_low=wall_area * lo, cad_mid=wall_area * mid, cad_high=wall_area * hi,
            basis=basis, supplier_tags=tags)

    # ---- ROOF
    add(key="roof", label="Standing seam metal roof + underlayment",
        category=Category.ROOF, qty=round(roof_area, 0), unit="sq ft",
        cad_low=roof_area * 9, cad_mid=roof_area * 13, cad_high=roof_area * 18,
        basis="Metal roof $8–15/sq ft installed; required for the rainwater catchment.",
        supplier_tags=["roofing", "steel"])

    # ---- GLAZING — measured area with an explicitly assumed reference size.
    # This fixes the quantity dimension without pretending the quotient is a
    # supplier rate. Doors are excluded from glazing_sq_ft and priced below.
    if glazing_sq_ft > 0:
        opening_label = "opening" if window_count == 1 else "openings"
        add(
            key="windows",
            label=("Triple-glazed windows and glazing walls, black anodised frames "
                   f"({window_count} {opening_label})"),
            category=Category.GLAZING,
            qty=round(glazing_sq_ft, 0),
            unit="sq ft glazing",
            cad_low=glazing_sq_ft * GLAZING_CAD_PER_SQ_FT["low"],
            cad_mid=glazing_sq_ft * GLAZING_CAD_PER_SQ_FT["mid"],
            cad_high=glazing_sq_ft * GLAZING_CAD_PER_SQ_FT["high"],
            basis=(
                "Alberta reference-size planning proxy, source date 2026-08: triple-pane "
                "$900–1,800 per window (Lux Calgary, All Weather Edmonton and Duxton Winnipeg, "
                "via data/alberta/cost-model.json), divided by an explicit 16 sq ft (4 ft × 4 ft) "
                "reference-size assumption to give $56.25, $84.38 and $112.50 per sq ft. The source "
                "does not state a reference window size: this is derived by division, not separately "
                "sourced, and is not a supplier quote or construction take-off. "
                "Quantity is glazed area with doors excluded; doors carry their own line. One rate "
                "covers punched windows and glazing walls: a large fixed lite buys glass more cheaply "
                "per square foot, while large-format framing, safety glazing, and installation cost "
                "more, and this codebase has a sourced figure for neither. NBC 9.36's prescriptive "
                "zone 7A FDWR reference is 22 percent, and nothing here checks a design against it."
            ),
            supplier_tags=["windows", "glazing"],
        )
    doors = max(1, door_count if door_count is not None else 2)
    add(key="doors", label="Insulated exterior doors",
        category=Category.GLAZING, qty=doors, unit="units",
        cad_low=doors * DOOR_CAD_EACH["low"],
        cad_mid=doors * DOOR_CAD_EACH["mid"],
        cad_high=doors * DOOR_CAD_EACH["high"],
        basis=(
            "Entry and secondary egress at $700–1,600 per door, the previous two-door allowance "
            "of $1,400–3,200 divided by the two doors it assumed. Quantity is the exterior doors "
            + (
                "the design's door count is unavailable to this legacy caller, so the "
                "existing two-door allowance is retained."
                if door_count is None
                else "the design draws"
                + (", and this design draws none, so one entry door is priced."
                   if door_count < 1 else ".")
            )
        ),
        supplier_tags=["doors"])

    # ---- ENERGY
    if systems.solar_kw > 0:
        kw = systems.solar_kw
        add(key="solar", label=f"Solar array, {kw:g} kW",
            category=Category.ENERGY, qty=kw, unit="kW",
            cad_low=kw * 2100, cad_mid=kw * 2700, cad_high=kw * 3400,
            basis="Off-grid array incl. racking + MPPT. Wiring is licensed work (CEC s.64).",
            owner_buildable=False, supplier_tags=["solar", "electrical"])
    if systems.battery_kwh > 0:
        k = systems.battery_kwh
        add(key="battery", label=f"LiFePO4 battery bank, {k:g} kWh",
            category=Category.ENERGY, qty=k, unit="kWh",
            cad_low=k * 430, cad_mid=k * 560, cad_high=k * 720,
            basis="Cold-rated LiFePO4 with heated enclosure.",
            owner_buildable=False, supplier_tags=["battery", "solar"])
    if systems.generator:
        add(key="generator", label="Auto-start backup generator",
            category=Category.ENERGY, qty=1, unit="unit",
            cad_low=4500, cad_mid=7200, cad_high=11000,
            basis="Not optional in an Alberta January — December yield collapses 70–77%.",
            owner_buildable=False, supplier_tags=["generator", "electrical"])
    if systems.wood_stove:
        add(key="wood_stove", label="Wood stove + WETT-inspected chimney",
            category=Category.ENERGY, qty=1, unit="unit",
            cad_low=3200, cad_mid=5000, cad_high=7500,
            basis="WETT inspection required for insurance.", supplier_tags=["stove", "hearth"])

    # ---- WATER
    if systems.awg:
        add(key="awg", label="Atmospheric water generator (summer producer)",
            category=Category.WATER, qty=1, unit="unit",
            cad_low=3500, cad_mid=5000, cad_high=8000,
            basis="Recommended on every Aura home, not mandatory. 10–20 L/day Jun–Sep; ZERO outdoors in winter.",
            supplier_tags=["awg", "water"])
    if systems.cistern_litres > 0:
        L = systems.cistern_litres
        add(key="cistern", label=f"Buried cistern, {L:,} L + pump and filtration",
            category=Category.WATER, qty=1, unit="system",
            cad_low=8000, cad_mid=12000, cad_high=18000,
            basis="Poly tank, never concrete. Carries winter water.",
            owner_buildable=False, supplier_tags=["cistern", "water"])
    if systems.rainwater:
        add(key="rainwater", label="Rainwater catchment — gutters, first-flush, filtration",
            category=Category.WATER, qty=1, unit="system",
            cad_low=2200, cad_mid=3600, cad_high=5400,
            basis="Roof catchment to the cistern; metal roof makes it potable-capable.",
            supplier_tags=["water", "roofing"])

    # ---- WASTE
    add(key="septic", label=("Composting toilet + greywater biofilter"
                             if systems.composting_toilet else
                             "Ecoflo-class septic + greywater biofilter, subsurface drip"),
        category=Category.WASTE, qty=1, unit="system",
        cad_low=12000 if not systems.composting_toilet else 6500,
        cad_mid=18000 if not systems.composting_toilet else 10000,
        cad_high=28000 if not systems.composting_toilet else 15000,
        basis="Certified installer by law. Greywater to subsurface drip irrigation, SOP 8.5.",
        owner_buildable=False, supplier_tags=["septic", "water"])

    # ---- MECHANICAL
    if systems.hrv:
        add(key="hrv", label="Heat-recovery ventilator + ducting",
            category=Category.MECHANICAL, qty=1, unit="system",
            cad_low=3200, cad_mid=4800, cad_high=7000,
            basis="An airtight envelope requires mechanical ventilation.",
            supplier_tags=["hvac"])
    add(key="plumbing_electrical", label="Plumbing + electrical rough-in and finish",
        category=Category.MECHANICAL, qty=round(gross_sq_ft, 0), unit="sq ft",
        cad_low=gross_sq_ft * 14, cad_mid=gross_sq_ft * 20, cad_high=gross_sq_ft * 28,
        basis="Homeowner may pull their own permits under an Owner Builder Authorization.",
        supplier_tags=["plumbing", "electrical"])

    # ---- INTERIOR
    add(key="interior", label="Interior fit-out — kitchen, bath, partitions, finishes",
        category=Category.INTERIOR, qty=round(gross_sq_ft, 0), unit="sq ft",
        cad_low=gross_sq_ft * 26, cad_mid=gross_sq_ft * 42, cad_high=gross_sq_ft * 66,
        basis="Owner-buildable. Ranges swing hardest here.", supplier_tags=["interior", "millwork"])
    if systems.cork_flooring:
        add(key="cork", label="Cork flooring",
            category=Category.INTERIOR, qty=round(gross_sq_ft * 0.8, 0), unit="sq ft",
            cad_low=gross_sq_ft * 0.8 * 7, cad_mid=gross_sq_ft * 0.8 * 10, cad_high=gross_sq_ft * 0.8 * 14,
            basis="Renewable, warm underfoot, quiet. Harvested without felling the tree.",
            supplier_tags=["flooring", "cork"])
    if systems.reclaimed_interior:
        add(key="reclaimed_interior", label="Reclaimed timber interior joinery",
            category=Category.INTERIOR, qty=1, unit="package",
            cad_low=3500, cad_mid=6500, cad_high=12000,
            basis="Salvaged stock; availability drives price.", supplier_tags=["reclaimed", "millwork"])
    if systems.furniture_package:
        add(key="furniture", label="Furniture package (eco-sourced)",
            category=Category.INTERIOR, qty=1, unit="package",
            cad_low=8000, cad_mid=16000, cad_high=32000,
            basis="Optional. FSC/reclaimed sourcing.", supplier_tags=["furniture"])

    # ---- OUTDOOR
    if systems.hot_tub or systems.deck:
        add(key="tub_deck", label="Wood-fired cedar hot tub + deck",
            category=Category.OUTDOOR, qty=1, unit="package",
            cad_low=8000, cad_mid=14000, cad_high=22000,
            basis="A first-class costed line item, not an afterthought. Deck $25–45/sq ft; "
                  "no permit under 24in height.",
            supplier_tags=["hot_tub", "lumber"])

    lo = _round(sum(i.cad_low for i in items))
    mid = _round(sum(i.cad_mid for i in items))
    hi = _round(sum(i.cad_high for i in items))

    notes.append(
        "Ranges with a basis, never point estimates. Excludes land, permits, design "
        "fees and contingency — those live in data/alberta/cost-model.json."
    )
    if material == EcoMaterial.SIP:
        notes.append("SIP lead time is 12–20 weeks from approved drawings. Order at week zero.")

    return BillOfMaterials(items=items, cad_low=lo, cad_mid=mid, cad_high=hi, notes=notes)
