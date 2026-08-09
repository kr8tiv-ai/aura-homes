# -*- coding: utf-8 -*-
"""Generator for assets/site-card.png — the aurahomes.fun preview card, 1200x630 (OG standard).

Per docs/BRAND.md: dark aurora ground #050807, accents as light sources (never
large fills), the aura mark leads, the KR8TIV lockup closes, tracked-caps mono
labels, no crypto glow, no exclamation points.

Fonts: Segoe UI is the sanctioned render-time fallback for Space Grotesk/Manrope
(BRAND.md section 4); JetBrains Mono is the real label face. Run on Windows with
JetBrains Mono installed, from anywhere: `python assets/make-site-card.py`.
"""
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
GROUND = (5, 8, 7)          # #050807
EMERALD = (16, 185, 129)    # #10b981
EMERALD_B = (52, 211, 153)  # #34d399
OFFWHITE = (231, 236, 233)  # #e7ece9
DIM = (138, 147, 143)       # #8a938f

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UFONTS = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\Windows\Fonts")
SEGO_B = r"C:\Windows\Fonts\segoeuib.ttf"
SEGO_R = r"C:\Windows\Fonts\segoeui.ttf"
MONO_R = os.path.join(UFONTS, "JetBrainsMono-Regular.ttf")
MONO_B = os.path.join(UFONTS, "JetBrainsMono-Bold.ttf")


def draw_tracked(draw, xy, text, font, fill, tracking):
    """Letter-spaced text; returns the x where the run ended."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking
    return x - tracking


# ---------------------------------------------------------------- ground + aurora
aur = Image.new("RGB", (W, H), (0, 0, 0))
ad = ImageDraw.Draw(aur)
ad.ellipse([-260, -190, 640, 260], fill=(6, 32, 23))    # emerald arc over the mark
ad.ellipse([560, -240, 1330, 130], fill=(4, 24, 22))    # teal band upper right
ad.ellipse([260, -170, 1030, -30], fill=(14, 9, 30))    # violet high band, faint
ad.ellipse([-180, 470, 460, 820], fill=(3, 14, 10))     # floor glow under the mark
aur = aur.filter(ImageFilter.GaussianBlur(130))

base = np.asarray(Image.new("RGB", (W, H), GROUND), dtype=np.int16)
glow = np.asarray(aur, dtype=np.int16)
img = Image.fromarray(np.clip(base + glow, 0, 255).astype("uint8"), "RGB")

# slightly darker toward the very bottom
grad = Image.new("L", (1, H))
for y in range(H):
    grad.putpixel((0, y), int(max(0.0, (y - 440) / (H - 440)) * 46) if y > 440 else 0)
grad = grad.resize((W, H))
img = Image.composite(Image.new("RGB", (W, H), (2, 4, 3)), img, grad)

# near-invisible conifer treeline along the bottom edge
tree = Image.new("RGBA", (W, H), (0, 0, 0, 0))
td = ImageDraw.Draw(tree)
random.seed(7)
x = -20
while x < W + 30:
    tw = random.randint(22, 46)
    th = random.randint(18, 44)
    td.polygon([(x, H + 6), (x + tw // 2, H - th), (x + tw, H + 6)], fill=(9, 15, 12, 170))
    x += random.randint(12, 30)
tree = tree.filter(ImageFilter.GaussianBlur(2.2))
img = Image.alpha_composite(img.convert("RGBA"), tree).convert("RGB")

# ---------------------------------------------------------------- the mark leads
mark = Image.open(os.path.join(REPO, "assets", "aura-homes-logo.png")).convert("RGBA")
mark = mark.resize((400, 400), Image.LANCZOS)
canvas = img.convert("RGBA")
canvas.alpha_composite(mark, (58, 112))
img = canvas.convert("RGB")
draw = ImageDraw.Draw(img)

# ---------------------------------------------------------------- text block
X0 = 496
f_word = ImageFont.truetype(SEGO_B, 74)
f_tag = ImageFont.truetype(SEGO_R, 33)
f_dom = ImageFont.truetype(MONO_B, 29)
f_stage = ImageFont.truetype(MONO_R, 17)
f_lock = ImageFont.truetype(SEGO_B, 21)
f_sub = ImageFont.truetype(MONO_R, 15)

# wordmark
xe = draw_tracked(draw, (X0, 118), "AURA", f_word, OFFWHITE, 12)
draw_tracked(draw, (xe + 30, 118), "HOMES", f_word, EMERALD_B, 12)

# tagline
draw.text((X0 + 4, 232), "From USDC on X Layer", font=f_tag, fill=OFFWHITE)
draw.text((X0 + 4, 276), "to the keys of an off-grid eco home.", font=f_tag, fill=OFFWHITE)

# domain — the site card's signature element
draw_tracked(draw, (X0 + 4, 360), "AURAHOMES.FUN", f_dom, EMERALD_B, 9)

# the five stages
draw_tracked(draw, (X0 + 4, 420), "LAND · DESIGN · BUDGET · ESCROW · BUILD", f_stage, DIM, 2)

# divider hairline
draw.rectangle([X0 + 4, 474, X0 + 4 + 566, 476], fill=EMERALD)

# KR8TIV lockup closes (badge never exceeds two lines of its text)
badge = Image.open(os.path.join(REPO, "app", "public", "kr8tiv-badge.png")).convert("RGBA")
badge = badge.resize((56, 56), Image.LANCZOS)
canvas = img.convert("RGBA")
canvas.alpha_composite(badge, (X0 + 4, 500))
img = canvas.convert("RGB")
draw = ImageDraw.Draw(img)
draw_tracked(draw, (X0 + 80, 504), "A KR8TIV AI PRODUCT", f_lock, OFFWHITE, 5)
draw_tracked(draw, (X0 + 80, 535), "OPEN SOURCE · MIT · ALBERTA PILOT", f_sub, DIM, 2)

out = os.path.join(REPO, "assets", "site-card.png")
img.save(out, "PNG")
print("saved", out, img.size)
