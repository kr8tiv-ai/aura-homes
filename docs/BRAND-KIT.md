# Aura Homes — Brand Kit

*The ready-to-use files distilled from [BRAND.md](BRAND.md) v3 (the source of truth — on any conflict, BRAND.md wins) and verified against the CSS served at [aurahomes.fun](https://aurahomes.fun), August 2026. Everything lives in [assets/brand-kit/](../assets/brand-kit/) and regenerates with `python assets/brand-kit/make-brand-kit.py`.*

## What's in the kit

| File | What it is |
|---|---|
| `logo-light.png` / `-256` | The light-native mark, transparent, 1024 + 256 — **leads everywhere on paper** |
| `logo-dark-context.png` / `-256` | The night fill — inside framed dark media only, never as a page ground |
| `logo-mono-ink.png` / `-256` | Single-color ink `#171a18` — print, embossing, one-color contexts on light |
| `logo-mono-white.png` / `-256` | Single-color white — over photography and dark media |
| `avatar-chip.png` / `-256` | Night mark on the `#050807` chip — favicon and avatars only |
| `lockup-horizontal(-transparent).png` | Mark + AURA HOMES wordmark, one line, paper and transparent |
| `lockup-stacked(-transparent).png` | Mark above the wordmark, centered, paper and transparent |
| `palette.png` · `palette.json` · `tokens.css` | The color system — sheet, machine tokens, and CSS custom properties matching the served site |
| `type-specimen.png` | Space Grotesk / Manrope / JetBrains Mono with the scale, tracking bands, and the kicker pattern |
| `social-card-template.png` | The card composition with every text zone annotated |

The 1024 logo renders are resampled from the 512 masters in [assets/](../assets/); the masters remain canonical. The silhouette is never redrawn — mono and light variants recolor the fill with the alpha copied verbatim.

## Which logo, when

Paper ground → `logo-light`. Inside framed dark media or the avatar chip → `logo-dark-context`. One-color reproduction (print, embossing, laser) → `logo-mono-ink` on light, `logo-mono-white` on dark or photography. Favicon and social avatars → `avatar-chip`, nothing else. The wordmark sets AURA in ink and HOMES in emerald `#059669`, Space Grotesk 620, −0.02em.

## Clear space and minimum size

- **Clear space:** keep a margin of at least 25% of the mark's width on all sides — roughly the width of the mark's small leading ellipse. Nothing enters it, including the wordmark's descenders.
- **Minimum size:** mark alone 24px; the light-native mark on white holds at 64px (verified) — below that, switch to the avatar chip, which stays recognizable at 16px. Lockups: horizontal ≥ 240px wide, stacked ≥ 140px wide.
- Never redraw the silhouette, add glow, outline it, rotate it, or put it in a containing shape (the avatar chip is the one sanctioned container).

## The KR8TIV lockup

"A KR8TIV AI PRODUCT" in tracked caps with the circular badge at text height beside it. **Aura mark leads, KR8TIV badge closes small — never a side-by-side equal-size partnership lockup.** The badge never exceeds two lines of its text; its blue-wave palette stays inside the circle.

## Do / don't, distilled

1. Paper `#fafaf9` ground, ink type, accents as marks — never dark marketing surfaces.
2. One dominant accent per surface; emerald is THE accent.
3. Emerald `#10b981` is fill-only — as text use `#047857` (body) or `#059669` (display and labels).
4. Violet stays on on-chain surfaces; the aurora band stays inside media and the mark.
5. Tracked-caps mono labels; display weight 500–620, never heavy.
6. Structure is whitespace and hairlines, never boxes or filled panels.
7. No glow, no hexagons, no crypto-glyphs, no exclamation marks.
8. Ranges with a basis, limitations published next to the feature.

## Card dimensions

GitHub social preview 1280 × 640 (`assets/social-card.png`); `og:image` 1200 × 630 (`assets/site-card.png`, served from `app/public/`). Same composition; swap the chip row per context — outlined hairline pills, maximum three.

## License

The Aura Homes mark and these generated assets belong to the project (MIT repo — see [LICENSE](../LICENSE) and [CREDITS.md](CREDITS.md)). Space Grotesk, Manrope, and JetBrains Mono are SIL OFL 1.1 — free for commercial use and embedding; the variable TTFs ship in [assets/fonts/](../assets/fonts/) with their licenses alongside.
