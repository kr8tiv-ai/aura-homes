# The hackathon launch card - the social card v2's own bones (same photo,
# same paper panel, same top strip) with launch copy in the panel. 1200x630,
# X's summary_large_image ratio.
#
#   py make-launch-card.py  ->  x-launch-card-1200x630.png

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

KIT = Path(__file__).resolve().parent
FONTS = KIT.parent / "fonts"
BASE = KIT.parent.parent / "app" / "public" / "social" / "aura-homes-social-v2.jpg"

PAPER = (250, 250, 249)
INK = (23, 26, 24)
DIM = (95, 102, 99)
EMERALD_LABEL = (5, 150, 105)
EMERALD = (16, 185, 129)


def grotesk(size, weight=560):
    f = ImageFont.truetype(str(FONTS / "SpaceGrotesk[wght].ttf"), size)
    try:
        f.set_variation_by_axes([weight])
    except OSError:
        pass
    return f


def manrope(size, weight=400):
    f = ImageFont.truetype(str(FONTS / "Manrope[wght].ttf"), size)
    try:
        f.set_variation_by_axes([weight])
    except OSError:
        pass
    return f


def tracked(draw, xy, text, font, fill, t):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + t
    return x - t


img = Image.open(BASE).convert("RGB")
draw = ImageDraw.Draw(img, "RGBA")

# Repaint the panel exactly where v2 puts it, one soft shadow edge kept.
P_L, P_T, P_R, P_B = 40, 88, 586, 588
draw.rectangle([P_L + 4, P_T + 6, P_R + 6, P_B + 6], fill=(23, 26, 24, 28))
draw.rectangle([P_L, P_T, P_R, P_B], fill=PAPER)

x = P_L + 38
y = P_T + 34

# Tracked kicker + short rule, the card's own idiom.
kf = manrope(15, 660)
x_end = tracked(draw, (x, y), "BUILDX AI SEASON · LIVE NOW", kf, EMERALD_LABEL, 3)
draw.rectangle([x_end + 16, y + 9, x_end + 68, y + 10], fill=(23, 26, 24, 40))
y += 44

# Launch heading, Space Grotesk display.
hf = grotesk(52, 580)
for line in ["From USDC on", "X Layer to the keys", "of an eco home."]:
    draw.text((x - 2, y), line, font=hf, fill=INK)
    y += 57
y += 16

# Body, Manrope.
bf = manrope(19, 460)
for line in [
    "Open-source AI planning: 20 editable plans,",
    "dimensioned drawings, honest Alberta budgets,",
    "and its crypto rails built in the open.",
]:
    draw.text((x, y), line, font=bf, fill=DIM)
    y += 28
y += 26

# The ink pill, mirroring the card's START A PROJECT button.
pill_f = manrope(15, 700)
label = "AURAHOMES.FUN  →"
pw = draw.textlength(label, font=pill_f) + 56
draw.rounded_rectangle([x, y, x + pw, y + 46], radius=23, fill=INK)
draw.text((x + 28, y + 13), label, font=pill_f, fill=PAPER)

# Bottom line inside the panel: the required tag, tracked.
tf = manrope(12, 640)
tracked(draw, (x, P_B - 44), "@XLAYEROFFICIAL · MIT OPEN SOURCE · ALBERTA FIRST", tf, DIM, 2)

img.save(KIT / "x-launch-card-1200x630.png", optimize=True)
print("x-launch-card-1200x630.png")
