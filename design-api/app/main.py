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
from .routers_design import router as design_router
from .services import blueprint, images

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


#: /design, /design/materials, /design/procure and /design/full all live in
#: routers_design.py so the design → materials → procurement chain reads as one
#: pipeline instead of being spread across this file.
app.include_router(design_router)


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
