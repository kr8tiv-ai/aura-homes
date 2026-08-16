"""Design → materials → procurement, as three composable endpoints.

    POST /design              questionnaire -> plan + blueprint + render prompts
    POST /design/materials    -> bill of materials derived from the geometry
    POST /design/procure      -> every line routed from ONE X Layer USDC balance
    POST /design/full         all three in one call (what the 02 Design step uses)

Split so the site can show the plan immediately and price it a beat later,
rather than making the user wait on the whole chain.
"""

from __future__ import annotations

import hashlib
import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .config import settings
from .eco import honesty_notes
from .materials import BillOfMaterials
from .materials import build as build_bom
from .models import ArtifactSet, DesignRequest, DesignResponse, FloorPlan
from .procurement import ProcurementPlan
from .procurement import plan as build_procurement
from .services import blueprint, images, layout, llm

log = logging.getLogger("aura.design")
router = APIRouter()


def design_id(req: DesignRequest) -> str:
    blob = json.dumps(req.model_dump(mode="json"), sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:12]


def _glazing(plan: FloorPlan) -> tuple[int, float]:
    wins = [o for r in plan.rooms for o in r.openings if o.kind == "window"]
    return len(wins), sum(o.width * 4.0 for o in wins)


def _door_count(plan: FloorPlan) -> int:
    return sum(1 for room in plan.rooms for opening in room.openings if opening.kind == "door")


def solve_design(req: DesignRequest) -> tuple[DesignResponse, FloorPlan]:
    notes: list[str] = []
    program, prompts, offline = llm.design_program(req)
    if offline:
        notes.append(
            "No LLM credential configured — room program derived arithmetically. "
            "The drawing is fully valid; only the naming and proportioning judgement "
            "came from rules rather than a model."
        )
    try:
        plan = layout.solve(req, program)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"layout could not be solved: {e}") from e

    notes.extend(plan.warnings)
    notes.extend(honesty_notes(req.systems, req.climate_zone.value))

    did = design_id(req)
    out = settings.out_dir / did
    art = ArtifactSet()
    try:
        svg = blueprint.render_svg(plan, req, out / "plan.svg")
        art.svg_url = f"/design/{did}.svg"
        if blueprint.svg_to_pdf(svg, out / "plan.pdf"):
            art.pdf_url = f"/design/{did}.pdf"
        else:
            notes.append("PDF unavailable (cairosvg not installed) — SVG provided.")
        if blueprint.render_dxf(plan, out / "plan.dxf"):
            art.dxf_url = f"/design/{did}.dxf"
        else:
            notes.append("DXF unavailable (ezdxf not installed) — SVG/PDF provided.")
    except Exception as e:  # noqa: BLE001
        log.exception("blueprint failed")
        notes.append(f"Blueprint generation failed: {e}")

    if settings.has_images:
        art.render_urls = images.generate(prompts)
        if not art.render_urls:
            notes.append("Image backend returned nothing — blueprint-only response.")
    else:
        notes.append(
            "No image credential configured — rendering prompts returned so they can "
            "be run elsewhere, but no images generated."
        )

    return (
        DesignResponse(
            request=req, layout=program, plan=plan, render_prompts=prompts,
            artifacts=art, offline=offline, notes=notes,
        ),
        plan,
    )


def bom_for(req: DesignRequest, plan: FloorPlan) -> BillOfMaterials:
    n, area = _glazing(plan)
    return build_bom(
        width_ft=plan.width, depth_ft=plan.height, gross_sq_ft=plan.gross_sq_ft,
        window_count=n, glazing_sq_ft=area, material=req.material,
        systems=req.systems, storeys=req.storeys, door_count=_door_count(plan),
    )


class MaterialsResponse(BaseModel):
    design_id: str
    bom: BillOfMaterials


class ProcureResponse(BaseModel):
    design_id: str
    bom: BillOfMaterials
    procurement: ProcurementPlan


class FullResponse(BaseModel):
    design: DesignResponse
    bom: BillOfMaterials
    procurement: ProcurementPlan


@router.post("/design", response_model=DesignResponse)
def design(req: DesignRequest) -> DesignResponse:
    resp, _ = solve_design(req)
    return resp


@router.post("/design/materials", response_model=MaterialsResponse)
def materials_endpoint(req: DesignRequest) -> MaterialsResponse:
    _, plan = solve_design(req)
    return MaterialsResponse(design_id=design_id(req), bom=bom_for(req, plan))


@router.post("/design/procure", response_model=ProcureResponse)
def procure(req: DesignRequest) -> ProcureResponse:
    _, plan = solve_design(req)
    bom = bom_for(req, plan)
    proc = build_procurement([(i.key, i.label, i.cad_mid, i.supplier_tags) for i in bom.items])
    return ProcureResponse(design_id=design_id(req), bom=bom, procurement=proc)


@router.post("/design/full", response_model=FullResponse)
def full(req: DesignRequest) -> FullResponse:
    resp, plan = solve_design(req)
    bom = bom_for(req, plan)
    proc = build_procurement([(i.key, i.label, i.cad_mid, i.supplier_tags) for i in bom.items])
    return FullResponse(design=resp, bom=bom, procurement=proc)
