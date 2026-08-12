# X (Twitter) profile assets, generated from the brand kit's own masters and
# rules (palette.json). Nothing is redrawn: the avatar is the sanctioned
# avatar-chip downsampled, the header uses the horizontal lockup verbatim on
# a paper ground, and the aurora appears only inside the mark - exactly the
# "never as ground, never as text" rule.
#
#   py make-x-assets.py
#   -> x-avatar-400.png       (400x400, X profile picture)
#   -> x-header-1500x500.png  (1500x500, X profile header)

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

KIT = Path(__file__).resolve().parent
FONTS = KIT.parent / "fonts"

PAPER = (250, 250, 249)      # #fafaf9
INK = (23, 26, 24)           # #171a18
DIM = (95, 102, 99)          # #5f6663
EMERALD_LABEL = (5, 150, 105)  # #059669 - AA-large / tracked labels only
HAIRLINE = (23, 26, 24, 36)  # ink @ 14%


def grotesk(size: int, weight: int = 560) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONTS / "SpaceGrotesk[wght].ttf"), size)
    try:
        font.set_variation_by_axes([weight])
    except OSError:
        pass
    return font


def manrope(size: int, weight: int = 600) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(FONTS / "Manrope[wght].ttf"), size)
    try:
        font.set_variation_by_axes([weight])
    except OSError:
        pass
    return font


def tracked(draw: ImageDraw.ImageDraw, xy, text, font, fill, tracking_px: int):
    """Tracked caps the mono-label way; PIL has no letter-spacing."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking_px
    return x - tracking_px


def tracked_width(draw, text, font, tracking_px: int) -> float:
    return sum(draw.textlength(c, font=font) + tracking_px for c in text) - tracking_px


def make_avatar():
    chip = Image.open(KIT / "avatar-chip.png").convert("RGB")
    chip.resize((400, 400), Image.LANCZOS).save(KIT / "x-avatar-400.png", optimize=True)
    print("x-avatar-400.png")


def make_header():
    W, H = 1500, 500
    img = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(img, "RGBA")

    # The lockup leads, centered, upper band. X crops edges on phones and
    # floats the round avatar over the lower-left on desktop, so everything
    # lives in the safe middle and nothing important sits low-left.
    lockup = Image.open(KIT / "lockup-horizontal-transparent.png").convert("RGBA")
    lh = 180
    lw = round(lockup.width * lh / lockup.height)
    lockup = lockup.resize((lw, lh), Image.LANCZOS)
    img.paste(lockup, ((W - lw) // 2, 78), lockup)

    # One hairline rule - structure without a box.
    rule_w = 620
    draw.rectangle([(W - rule_w) // 2, 288, (W + rule_w) // 2, 289], fill=HAIRLINE)

    # The approved hero sentence, Space Grotesk, sentence case, may end in a
    # period. One line at display scale.
    heading = "Design your eco home. Find land that fits. Plan every step to build it."
    hf = grotesk(37, 560)
    hw = draw.textlength(heading, font=hf)
    draw.text(((W - hw) / 2, 318), heading, font=hf, fill=INK)

    # Tracked caps closer: the journey kicker, emerald label scale, with the
    # domain in ink-dim. Manrope 600 stands in for the mono at this size.
    label = "ECO HOMES · TINY HOMES · UNIQUE STAYS"
    site = "AURAHOMES.FUN"
    lf = manrope(17, 640)
    gap = 44
    tw = tracked_width(draw, label, lf, 4) + gap + tracked_width(draw, site, lf, 4)
    x0 = (W - tw) / 2
    x_end = tracked(draw, (x0, 398), label, lf, EMERALD_LABEL, 4)
    tracked(draw, (x_end + gap, 398), site, lf, DIM, 4)

    img.save(KIT / "x-header-1500x500.png", optimize=True)
    print("x-header-1500x500.png")


if __name__ == "__main__":
    make_avatar()
    make_header()
