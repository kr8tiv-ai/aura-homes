"""Aura Homes — Design service (the "02 Design" backend).

    POST /design            questionnaire -> renders + blueprint
    GET  /design/{id}.svg   the drawing
    GET  /design/{id}.pdf   printable
    GET  /design/{id}.dxf   CAD
    GET  /health            what is actually wired up

Graceful failure is a design goal, not a nicety: no LLM key falls back to the
deterministic planner, no image key returns blueprint-only, no cairosvg
returns SVG without PDF, no ezdxf returns no DXF. The response always tells
the caller which path it took.
"""

from __future__ import annotations

import hashlib
import json
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import settings
from .models import ArtifactSet, DesignRequest, DesignResponse
from .services import blueprint, images, layout, llm

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("aura.design")

app = FastAPI(
    title="Aura Homes — Design service",
    version="0.1.0",
    description=(
        "Questionnaire in, architectural renders and a dimensioned blueprint out. "
        "Python owns the geometry; the LLM owns the reasoning."
    ),
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _design_id(req: DesignRequest) -> str:
    """Deterministic id — the same questionnaire yields the same drawing."""
    blob = json.dumps(req.model_dump(mode="json"), sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:12]


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "llm": settings.has_llm,
        "llm_provider": "anthropic" if settings.anthropic_api_key
        else ("openai" if settings.openai_api_key else None),
        "images": settings.has_images,
        "image_model": settings.image_model if settings.has_images else None,
        "image_licence": images.licence_note() if settings.has_images else None,
        "pdf": blueprint.svg_to_pdf.__doc__ is not None,
        "out_dir": str(settings.out_dir),
    }


@app.post("/design", response_model=DesignResponse)
def design(req: DesignRequest) -> DesignResponse:
    notes: list[str] = []

    # --- TASK A.1 — reasoning (or the deterministic program)
    plan_program, render_prompts, offline = llm.design_program(req)
    if offline:
        notes.append(
            "No LLM credential configured — room program derived arithmetically. "
            "The drawing is fully valid; only the naming and proportioning judgement "
            "came from rules rather than a model."
        )

    # --- geometry — always deterministic
    try:
        solved = layout.solve(req, plan_program)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"layout could not be solved: {e}") from e
    notes.extend(solved.warnings)

    did = _design_id(req)
    out = settings.out_dir / did
    art = ArtifactSet()

    # --- TASK B — the blueprint
    try:
        svg = blueprint.render_svg(solved, req, out / "plan.svg")
        art.svg_url = f"/design/{did}.svg"
        if blueprint.svg_to_pdf(svg, out / "plan.pdf"):
            art.pdf_url = f"/design/{did}.pdf"
        else:
            notes.append("PDF unavailable (cairosvg not installed) — SVG provided.")
        if blueprint.render_dxf(solved, out / "plan.dxf"):
            art.dxf_url = f"/design/{did}.dxf"
        else:
            notes.append("DXF unavailable (ezdxf not installed) — SVG/PDF provided.")
    except Exception as e:  # noqa: BLE001
        log.exception("blueprint failed")
        notes.append(f"Blueprint generation failed: {e}")

    # --- TASK A.2 — renders
    if settings.has_images:
        art.render_urls = images.generate(render_prompts)
        if not art.render_urls:
            notes.append("Image backend returned nothing — blueprint-only response.")
    else:
        notes.append(
            "No image credential configured — rendering prompts returned so they can "
            "be run elsewhere, but no images generated."
        )

    return DesignResponse(
        request=req,
        layout=plan_program,
        plan=solved,
        render_prompts=render_prompts,
        artifacts=art,
        offline=offline,
        notes=notes,
    )


def _serve(did: str, name: str, media: str) -> FileResponse:
    p = settings.out_dir / did / name
    if not p.exists():
        raise HTTPException(status_code=404, detail="not generated — POST /design first")
    return FileResponse(p, media_type=media, filename=f"aura-{did}-{name}")


@app.get("/design/{did}.svg")
def get_svg(did: str) -> FileResponse:
    return _serve(did, "plan.svg", "image/svg+xml")


@app.get("/design/{did}.pdf")
def get_pdf(did: str) -> FileResponse:
    return _serve(did, "plan.pdf", "application/pdf")


@app.get("/design/{did}.dxf")
def get_dxf(did: str) -> FileResponse:
    return _serve(did, "plan.dxf", "image/vnd.dxf")
