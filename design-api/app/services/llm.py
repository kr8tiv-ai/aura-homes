"""TASK A part 1 — the rendering prompt engine.

Sends the questionnaire to an LLM and demands STRUCTURED JSON back: a strict
architectural rendering prompt built from exact material vocabulary, plus a
room program. Two hard rules:

1. **Structured output or nothing.** The model is given a JSON schema and its
   reply is parsed into `LayoutPlan` / `RenderPrompt`. If it will not parse,
   we do not retry-and-hope — we fall back to the deterministic planner and
   flag `offline: true` on the response.
2. **No key, no crash.** Missing credentials is a normal operating state, not
   an error. `docs/AI-HANDOFF.md` records that the offline deterministic
   fallback ships either way; this service honours that.

Provider order: Anthropic, then OpenAI, then offline. Both are optional
imports so the service installs and runs with neither SDK present.
"""

from __future__ import annotations

import json
import logging

from ..config import settings
from ..models import DesignRequest, LayoutPlan, RenderPrompt
from .layout import default_program
from .prompts import (
    MATERIAL_VOCAB,
    STYLE_VOCAB,
    build_offline_render_prompts,
    system_prompt,
    user_prompt,
)

log = logging.getLogger(__name__)

#: The schema the model must fill. Kept in one place so the Anthropic tool
#: definition and the OpenAI response_format stay in lockstep.
DESIGN_SCHEMA: dict = {
    "type": "object",
    "required": ["house_style", "total_sq_ft", "rooms", "renders"],
    "properties": {
        "house_style": {"type": "string"},
        "total_sq_ft": {"type": "integer"},
        "rooms": {
            "type": "array",
            "minItems": 2,
            "items": {
                "type": "object",
                "required": ["name", "width", "length", "windows"],
                "properties": {
                    "name": {"type": "string"},
                    "width": {"type": "number"},
                    "length": {"type": "number"},
                    "windows": {"type": "integer"},
                    "wet": {"type": "boolean"},
                },
            },
        },
        "renders": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {
                "type": "object",
                "required": ["view", "prompt", "negative_prompt", "material_keywords"],
                "properties": {
                    "view": {"type": "string", "enum": ["exterior", "interior", "isometric"]},
                    "prompt": {"type": "string"},
                    "negative_prompt": {"type": "string"},
                    "material_keywords": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
}


def _parse(raw: dict, req: DesignRequest) -> tuple[LayoutPlan, list[RenderPrompt]]:
    layout = LayoutPlan(
        house_style=str(raw.get("house_style") or req.style.value),
        total_sq_ft=int(raw.get("total_sq_ft") or req.total_sq_ft),
        rooms=raw["rooms"],
    )
    renders = [RenderPrompt(**r) for r in raw["renders"]]
    return layout, renders


def _try_anthropic(req: DesignRequest) -> tuple[LayoutPlan, list[RenderPrompt]] | None:
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic  # type: ignore
    except Exception:
        log.info("anthropic sdk not installed; skipping")
        return None
    try:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2000,
            system=system_prompt(),
            tools=[{
                "name": "emit_design",
                "description": "Return the room program and the rendering prompts.",
                "input_schema": DESIGN_SCHEMA,
            }],
            tool_choice={"type": "tool", "name": "emit_design"},
            messages=[{"role": "user", "content": user_prompt(req)}],
        )
        for block in msg.content:
            if getattr(block, "type", None) == "tool_use":
                return _parse(dict(block.input), req)
    except Exception as e:  # noqa: BLE001 — any provider failure is non-fatal
        log.warning("anthropic call failed, falling back: %s", e)
    return None


def _try_openai(req: DesignRequest) -> tuple[LayoutPlan, list[RenderPrompt]] | None:
    if not settings.openai_api_key:
        return None
    try:
        from openai import OpenAI  # type: ignore
    except Exception:
        log.info("openai sdk not installed; skipping")
        return None
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        r = client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system",
                 "content": system_prompt() + "\n\nReturn JSON matching: "
                 + json.dumps(DESIGN_SCHEMA)},
                {"role": "user", "content": user_prompt(req)},
            ],
        )
        return _parse(json.loads(r.choices[0].message.content or "{}"), req)
    except Exception as e:  # noqa: BLE001
        log.warning("openai call failed, falling back: %s", e)
    return None


def design_program(req: DesignRequest) -> tuple[LayoutPlan, list[RenderPrompt], bool]:
    """Returns (layout, render_prompts, offline)."""
    for provider in (_try_anthropic, _try_openai):
        got = provider(req)
        if got:
            layout, renders = got
            return layout, renders, False

    # deterministic path — arithmetic program + vocabulary-driven prompts
    layout = default_program(req)
    renders = build_offline_render_prompts(req)
    log.info("no LLM available; using deterministic program (%d rooms)", len(layout.rooms))
    return layout, renders, True


__all__ = ["design_program", "MATERIAL_VOCAB", "STYLE_VOCAB", "DESIGN_SCHEMA"]
