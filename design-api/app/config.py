"""Configuration. Every key is optional — absence is a supported state."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env(*names: str, default: str = "") -> str:
    for n in names:
        v = os.environ.get(n)
        if v:
            return v.strip()
    return default


@dataclass(frozen=True)
class Settings:
    # --- reasoning
    anthropic_api_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    anthropic_model: str = field(default_factory=lambda: _env("ANTHROPIC_MODEL", default="claude-sonnet-5"))
    openai_api_key: str = field(default_factory=lambda: _env("OPENAI_API_KEY"))
    openai_model: str = field(default_factory=lambda: _env("OPENAI_MODEL", default="gpt-4o"))

    # --- imagery
    image_provider: str = field(default_factory=lambda: _env("IMAGE_PROVIDER", default="replicate"))
    image_model: str = field(
        default_factory=lambda: _env("IMAGE_MODEL", default="black-forest-labs/flux-schnell")
    )
    replicate_api_token: str = field(default_factory=lambda: _env("REPLICATE_API_TOKEN"))
    fal_api_key: str = field(default_factory=lambda: _env("FAL_KEY", "FAL_API_KEY"))
    max_renders: int = field(default_factory=lambda: int(_env("MAX_RENDERS", default="2")))
    image_timeout_s: float = field(default_factory=lambda: float(_env("IMAGE_TIMEOUT_S", default="90")))

    # --- service
    out_dir: Path = field(default_factory=lambda: Path(_env("OUT_DIR", default="out")).resolve())
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in _env(
                "CORS_ORIGINS",
                default="http://localhost:3000,https://aurahomes.fun,https://www.aurahomes.fun",
            ).split(",") if o.strip()
        )
    )

    @property
    def has_llm(self) -> bool:
        return bool(self.anthropic_api_key or self.openai_api_key)

    @property
    def has_images(self) -> bool:
        return bool(self.replicate_api_token or self.fal_api_key)


settings = Settings()
