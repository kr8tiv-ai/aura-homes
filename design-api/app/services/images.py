"""TASK A part 2 — image generation adapters.

Modular by design: every backend is a small function behind one interface,
selected by config, and **any of them failing returns None rather than
raising.** A design response with a blueprint and no render is still useful;
a 500 is not.

LICENCE TRIPWIRE, from docs/AI-TOOLS-RESEARCH.md — worth reading before
picking a checkpoint:

    ControlNet code is Apache-2.0, but SD 3.5 / Flux CHECKPOINTS ship under
    the Stability AI Community License, which is free commercially ONLY under
    US$1M annual revenue. Fine today; it becomes a licensing event the moment
    Aura crosses that line. Prefer permissively licensed checkpoints where
    quality allows, and log the choice.

That is why `IMAGE_BACKENDS` records a licence note per model — so the
decision is visible in code, not buried in a doc nobody re-reads.
"""

from __future__ import annotations

import logging

import httpx

from ..config import settings
from ..models import RenderPrompt

log = logging.getLogger(__name__)

#: model id -> (provider, licence note)
IMAGE_BACKENDS: dict[str, tuple[str, str]] = {
    "black-forest-labs/flux-schnell": (
        "replicate",
        "Apache-2.0 weights (FLUX.1 [schnell]) — commercially permissive. Preferred default.",
    ),
    "black-forest-labs/flux-dev": (
        "replicate",
        "FLUX.1 [dev] non-commercial licence — DO NOT ship commercially.",
    ),
    "stability-ai/sdxl": (
        "replicate",
        "SDXL 1.0 under CreativeML Open RAIL++-M — commercial use permitted with use restrictions.",
    ),
    "fal-ai/flux/schnell": (
        "fal",
        "Apache-2.0 weights via Fal. Preferred default on Fal.",
    ),
}


def _timeout() -> httpx.Timeout:
    return httpx.Timeout(settings.image_timeout_s, connect=10.0)


def _replicate(rp: RenderPrompt) -> str | None:
    if not settings.replicate_api_token:
        return None
    try:
        r = httpx.post(
            "https://api.replicate.com/v1/models/"
            f"{settings.image_model}/predictions",
            headers={
                "Authorization": f"Bearer {settings.replicate_api_token}",
                "Prefer": "wait",
            },
            json={"input": {
                "prompt": rp.prompt,
                "aspect_ratio": rp.aspect_ratio,
                "output_format": "webp",
                "output_quality": 90,
                "disable_safety_checker": False,
            }},
            timeout=_timeout(),
        )
        r.raise_for_status()
        out = r.json().get("output")
        if isinstance(out, list) and out:
            return str(out[0])
        if isinstance(out, str):
            return out
    except Exception as e:  # noqa: BLE001
        log.warning("replicate render failed: %s", e)
    return None


def _fal(rp: RenderPrompt) -> str | None:
    if not settings.fal_api_key:
        return None
    try:
        r = httpx.post(
            f"https://fal.run/{settings.image_model}",
            headers={"Authorization": f"Key {settings.fal_api_key}"},
            json={
                "prompt": rp.prompt,
                "negative_prompt": rp.negative_prompt,
                "image_size": "landscape_4_3",
                "num_images": 1,
            },
            timeout=_timeout(),
        )
        r.raise_for_status()
        imgs = r.json().get("images") or []
        if imgs:
            return str(imgs[0].get("url"))
    except Exception as e:  # noqa: BLE001
        log.warning("fal render failed: %s", e)
    return None


def generate(prompts: list[RenderPrompt]) -> list[str]:
    """Render each prompt. Returns whatever succeeded — possibly nothing."""
    provider = IMAGE_BACKENDS.get(settings.image_model, (settings.image_provider, ""))[0]
    fn = {"replicate": _replicate, "fal": _fal}.get(provider)
    if fn is None:
        log.info("no image provider configured; blueprint-only response")
        return []
    urls: list[str] = []
    for rp in prompts[: settings.max_renders]:
        u = fn(rp)
        if u:
            urls.append(u)
    return urls


def licence_note() -> str:
    return IMAGE_BACKENDS.get(settings.image_model, ("", "unknown model — verify licence"))[1]
