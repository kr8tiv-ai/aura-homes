# -*- coding: utf-8 -*-
"""Generator for assets/site-card.png — the aurahomes.fun preview card, 1200x630 (OG standard).

Per docs/BRAND.md v3 (light-first): paper ground #fafaf9, ink type, emerald THE
accent, the light-native mark leads, the KR8TIV lockup closes, tracked-caps mono
labels, no glow, no exclamation points. Drawn at 2x, LANCZOS-downsampled.

Fonts: the real brand faces ship in assets/fonts/ (variable TTFs, SIL OFL 1.1,
licenses alongside); Segoe UI is the sanctioned render-time fallback (BRAND.md
section 4) if they are missing. JetBrains Mono is the label face either way.
Run: `python assets/make-site-card.py`. The rest of the light set is generated
by make-brand-assets.py.
"""
import os

from PIL import Image, ImageDraw, ImageFont

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
UFONTS = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\Windows\Fonts")
MONO_R = os.path.join(UFONTS, "JetBrainsMono-Regular.ttf")
MONO_B = os.path.join(UFONTS, "JetBrainsMono-Bold.ttf")
SG_VAR = os.path.join(HERE, "fonts", "SpaceGrotesk[wght].ttf")
MN_VAR = os.path.join(HERE, "fonts", "Manrope[wght].ttf")
SEGO_B = r"C:\Windows\Fonts\segoeuib.ttf"
SEGO_R = r"C:\Windows\Fonts\segoeui.ttf"

S = 2
W, H = 1200, 630
PAPER = (250, 250, 249)   # #fafaf9
INK = (23, 26, 24)        # #171a18
DIM = (95, 102, 99)       # #5f6663
EMERALD = (16, 185, 129)  # #10b981
EM600 = (5, 150, 105)     # #059669
EM700 = (4, 120, 87)      # #047857


def display(size, weight=620):
    if os.path.exists(SG_VAR):
        f = ImageFont.truetype(SG_VAR, size * S)
        f.set_variation_by_axes([weight])
        return f
    return ImageFont.truetype(SEGO_B, size * S)


def body(size, weight=450):
    if os.path.exists(MN_VAR):
        f = ImageFont.truetype(MN_VAR, size * S)
        f.set_variation_by_axes([weight])
        return f
    return ImageFont.truetype(SEGO_R, size * S)


def mono(size, bold=False):
    return ImageFont.truetype(MONO_B if bold else MONO_R, size * S)


def tracked(draw, xy, text, f, fill, tr):
    x, y = xy[0] * S, xy[1] * S
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch) + tr * S
    return (x - tr * S) / S


img = Image.new("RGB", (W * S, H * S), PAPER).convert("RGBA")
mark = Image.open(os.path.join(REPO, "assets", "aura-homes-logo-light.png")).convert("RGBA")
img.alpha_composite(mark.resize((400 * S, 400 * S), Image.LANCZOS), (58 * S, 112 * S))
badge = Image.open(os.path.join(REPO, "app", "public", "kr8tiv-badge.png")).convert("RGBA")
img.alpha_composite(badge.resize((52 * S, 52 * S), Image.LANCZOS), (498 * S, 500 * S))
img = img.convert("RGB")
d = ImageDraw.Draw(img)

X0 = 498

# wordmark — tight display tracking (-0.02em), AURA ink / HOMES emerald-600
f_word = display(74)
tr = -74 * 0.02
xe = tracked(d, (X0, 128), "AURA", f_word, INK, tr)
tracked(d, (xe + f_word.getlength(" ") / S + tr, 128), "HOMES", f_word, EM600, tr)

f_tag = body(31)
d.text(((X0 + 2) * S, 246 * S), "From USDC on X Layer", font=f_tag, fill=DIM)
d.text(((X0 + 2) * S, 290 * S), "to the keys of an off-grid eco home.", font=f_tag, fill=DIM)

# domain — the site card's signature element
tracked(d, (X0 + 2, 372), "AURAHOMES.FUN", mono(28, bold=True), EM700, 8)

# the five stages
tracked(d, (X0 + 2, 430), "LAND · DESIGN · BUDGET · ESCROW · BUILD", mono(15), DIM, 3)

# divider hairline
d.rectangle([(X0 + 2) * S, 472 * S, (X0 + 568) * S, 474 * S], fill=EMERALD)

# KR8TIV lockup closes (badge never exceeds two lines of its text)
tracked(d, (X0 + 70, 503), "A KR8TIV AI PRODUCT", display(20, 600), INK, 4)
tracked(d, (X0 + 70, 534), "OPEN SOURCE · MIT · ALBERTA PILOT", mono(14), DIM, 2)

out = os.path.join(REPO, "assets", "site-card.png")
img.resize((W, H), Image.LANCZOS).save(out, "PNG")
print("saved", out, (W, H))
