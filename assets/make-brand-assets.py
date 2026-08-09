# -*- coding: utf-8 -*-
"""Generator for the Aura Homes light brand set (BRAND.md v3).

Regenerates, in the house style — paper ground #fafaf9, ink #171a18, emerald
THE accent, violet rationed to on-chain, aurora only inside the mark:

    aura-homes-logo-light.png   (the light-native mark, value-remapped, 512 RGBA)
    hero.png  pipeline.png  budget-bands.png  escrow-flow.png
    section-rule.png  social-card.png

site-card.png has its own generator (make-site-card.py). Everything is drawn at
2x and LANCZOS-downsampled. Fonts: the real brand faces ship in assets/fonts/
(variable TTFs, SIL OFL 1.1 — licenses alongside); Segoe UI is the sanctioned
fallback if they are missing. Run: `python assets/make-brand-assets.py`.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
FONTS = os.path.join(HERE, "fonts")
UFONTS = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\Windows\Fonts")
SG_VAR = os.path.join(FONTS, "SpaceGrotesk[wght].ttf")
MN_VAR = os.path.join(FONTS, "Manrope[wght].ttf")
MONO_R = os.path.join(UFONTS, "JetBrainsMono-Regular.ttf")
MONO_B = os.path.join(UFONTS, "JetBrainsMono-Bold.ttf")
SEGO_B = r"C:\Windows\Fonts\segoeuib.ttf"
SEGO_R = r"C:\Windows\Fonts\segoeui.ttf"

S = 2  # supersample factor

PAPER = (250, 250, 249)      # #fafaf9
INK = (23, 26, 24)           # #171a18
DIM = (95, 102, 99)          # #5f6663
FAINT = (154, 161, 157)      # #9aa19d
HAIR = (218, 219, 217)       # ink @14% on paper
EMERALD = (16, 185, 129)     # #10b981
EM_B = (52, 211, 153)        # #34d399
EM600 = (5, 150, 105)        # #059669
EM700 = (4, 120, 87)         # #047857
TEAL700 = (13, 148, 136)     # #0d9488
VIOLET_T = (124, 58, 237)    # #7c3aed text
VIOLET_F = (139, 92, 246)    # #8b5cf6 fill
LIME700 = (77, 124, 15)      # #4d7c0f
LIME600 = (101, 163, 13)     # #65a30d


def sg(size, weight=560):
    if os.path.exists(SG_VAR):
        f = ImageFont.truetype(SG_VAR, size * S)
        f.set_variation_by_axes([weight])
        return f
    return ImageFont.truetype(SEGO_B, size * S)


def mn(size, weight=430):
    if os.path.exists(MN_VAR):
        f = ImageFont.truetype(MN_VAR, size * S)
        f.set_variation_by_axes([weight])
        return f
    return ImageFont.truetype(SEGO_R, size * S)


def mono(size, bold=False):
    return ImageFont.truetype(MONO_B if bold else MONO_R, size * S)


def canvas(w, h, color=PAPER):
    img = Image.new("RGB", (w * S, h * S), color)
    return img, ImageDraw.Draw(img)


def tracked(draw, xy, text, f, fill, tr):
    """Letter-spaced text; 1x coords, tracking in 1x px (may be negative)."""
    x, y = xy[0] * S, xy[1] * S
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += f.getlength(ch) + tr * S
    return (x - tr * S) / S


def tracked_w(text, f, tr):
    return (sum(f.getlength(c) for c in text) + tr * S * (len(text) - 1)) / S


def center_tracked(draw, cx, y, text, f, fill, tr):
    tracked(draw, (cx - tracked_w(text, f, tr) / 2, y), text, f, fill, tr)


def line(draw, x0, y0, x1, y1, fill, w=1):
    draw.line([x0 * S, y0 * S, x1 * S, y1 * S], fill=fill, width=max(1, int(w * S)))


def arrow_to(draw, x0, y0, x1, y1, fill, w=1):
    ang = math.atan2(y1 - y0, x1 - x0)
    line(draw, x0, y0, x1 - 4.5 * math.cos(ang), y1 - 4.5 * math.sin(ang), fill, w)
    a, hw = 5.5, 3.2
    p0 = (x1 * S, y1 * S)
    p1 = ((x1 - a * math.cos(ang) - hw * math.sin(ang)) * S,
          (y1 - a * math.sin(ang) + hw * math.cos(ang)) * S)
    p2 = ((x1 - a * math.cos(ang) + hw * math.sin(ang)) * S,
          (y1 - a * math.sin(ang) - hw * math.cos(ang)) * S)
    draw.polygon([p0, p1, p2], fill=fill)


def save(img, name):
    out = img.resize((img.width // S, img.height // S), Image.LANCZOS)
    path = os.path.join(HERE, name)
    out.save(path, "PNG")
    print("saved", path, out.size)


def load_mark(px):
    m = Image.open(os.path.join(HERE, "aura-homes-logo-light.png")).convert("RGBA")
    return m.resize((px * S, px * S), Image.LANCZOS)


def load_badge(px):
    b = Image.open(os.path.join(REPO, "app", "public", "kr8tiv-badge.png")).convert("RGBA")
    return b.resize((px * S, px * S), Image.LANCZOS)


def wordmark(d, x, y, size, weight=620):
    """AURA in ink + HOMES in emerald-600, tight display tracking (-0.02em)."""
    f = sg(size, weight)
    tr = -size * 0.02
    xe = tracked(d, (x, y), "AURA", f, INK, tr)
    tracked(d, (xe + f.getlength(" ") / S + tr, y), "HOMES", f, EM600, tr)


# ------------------------------------------------------- the light-native mark
def light_mark():
    """Value-remap the night mark to daylight. SAME silhouette (alpha copied
    verbatim): sky -> pale pastels, conifer treeline -> emerald-deep so the
    mark keeps enough value contrast to stay legible small on white."""
    src = Image.open(os.path.join(HERE, "aura-homes-logo.png")).convert("RGBA")
    arr = np.asarray(src).astype(np.float32)
    rgb, alpha = arr[..., :3], arr[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    dark = np.clip((115.0 - L) / 34.0, 0.0, 1.0)
    greenish = np.clip((g - b + 14.0) / 26.0, 0.0, 1.0)
    tree = dark * greenish
    pastel = 255.0 - (255.0 - rgb) * 0.42
    t = np.clip(L / 115.0, 0.0, 1.0)[..., None]
    tree_col = np.array([5.0, 88.0, 66.0]) + (np.array([13.0, 128.0, 98.0]) - np.array([5.0, 88.0, 66.0])) * t
    out_rgb = pastel * (1.0 - tree[..., None]) + tree_col * tree[..., None]
    out = Image.fromarray(np.dstack([np.clip(out_rgb, 0, 255), alpha]).astype(np.uint8), "RGBA")
    out.save(os.path.join(HERE, "aura-homes-logo-light.png"))
    print("saved", os.path.join(HERE, "aura-homes-logo-light.png"), out.size)


# ---------------------------------------------------------------- hero 1600x520
def hero():
    img, d = canvas(1600, 520)
    img = img.convert("RGBA")
    img.alpha_composite(load_mark(360), (110 * S, 80 * S))
    img = img.convert("RGB")
    d = ImageDraw.Draw(img)

    X0 = 560
    wordmark(d, X0, 130, 104)
    d.text(((X0 + 4) * S, 300 * S),
           "From USDC on X Layer to the keys of an off-grid eco home.",
           font=mn(30, 450), fill=DIM)

    y = 374
    d.rectangle([(X0 + 4) * S, y * S, (X0 + 68) * S, (y + 1.5) * S], fill=EMERALD)
    d.rectangle([(X0 + 68) * S, (y + 0.25) * S, 1512 * S, (y + 1.25) * S], fill=HAIR)

    tracked(d, (X0 + 4, 402), "LAND · DESIGN · BUDGET · ESCROW · BUILD", mono(16), FAINT, 4)
    save(img, "hero.png")


# ---------------------------------------------------------------- pipeline 1600x380
def pipeline():
    img, d = canvas(1600, 380)
    stages = [
        ("01", "LAND", EM700, ["parcel filters that kill", "five-figure mistakes"]),
        ("02", "DESIGN", TEAL700, ["AI architect, review-ready", "package, Part 9 checked"]),
        ("03", "BUDGET", LIME700, ["line items from real", "Alberta suppliers"]),
        ("04", "ESCROW", VIOLET_T, ["USDC milestones, 10%", "holdback on-chain"]),
        ("05", "BUILD", EM600, ["permits, trades, panels,", "record minted per milestone"]),
    ]
    xs = [150, 475, 800, 1125, 1450]
    cy, r = 122, 34
    f_num, f_name, f_desc = mono(21), mono(19, bold=True), mn(15, 440)

    for (x0, x1) in zip(xs, xs[1:]):
        arrow_to(d, x0 + r + 16, cy, x1 - r - 16, cy, FAINT, 1)

    for x, (num, name, col, desc) in zip(xs, stages):
        d.ellipse([(x - r) * S, (cy - r) * S, (x + r) * S, (cy + r) * S],
                  outline=col, width=int(1.6 * S), fill=(255, 255, 255))
        nw = tracked_w(num, f_num, 2)
        tracked(d, (x - nw / 2, cy - 14), num, f_num, INK, 2)
        center_tracked(d, x, cy + r + 28, name, f_name, col, 6)
        for i, ln in enumerate(desc):
            w = d.textlength(ln, font=f_desc) / S
            d.text(((x - w / 2) * S, (cy + r + 68 + i * 23) * S), ln, font=f_desc, fill=DIM)

    center_tracked(d, 800, 324, "ONE AGENT PROCESS  ·  USDC IN, KEYS OUT  ·  NOTHING HIDDEN",
                   mono(13), FAINT, 4)
    save(img, "pipeline.png")


# ---------------------------------------------------------------- budget bands 1600x560
def budget():
    img, d = canvas(1600, 560)
    f_lab, f_val, f_axis = mono(16, bold=True), mn(19, 520), mono(12)

    tracked(d, (90, 42), "What an 800 sqft off-grid SIP home costs.", sg(34, 600), INK, -0.6)
    d.text((92 * S, 100 * S),
           "Ex-land, CAD, computed line-by-line from data/alberta/cost-model.json — ranges, never single-point fantasy prices.",
           font=mn(17, 440), fill=DIM)

    x0, x1 = 240, 1380
    top_v = 700_000

    def vx(v):
        return x0 + (x1 - x0) * v / top_v

    for k in range(0, 8):
        gx = vx(k * 100_000)
        line(d, gx, 152, gx, 458, HAIR, 1)
        lab = f"${k * 100}K" if k else "$0K"
        w = tracked_w(lab, f_axis, 1)
        tracked(d, (gx - w / 2, 476), lab, f_axis, FAINT, 1)

    rows = [
        ("LOW", 199_100, "$199,100", EMERALD),
        ("MID", 301_280, "$301,280", EM_B),
        ("HIGH", 443_900, "$443,900", VIOLET_F),
    ]
    bh = 18
    for i, (lab, v, txt, col) in enumerate(rows):
        y = 176 + i * 76
        w = tracked_w(lab, f_lab, 5)
        tracked(d, (206 - w, y - 11), lab, f_lab, INK, 5)
        d.rounded_rectangle([x0 * S, (y - bh / 2) * S, x1 * S, (y + bh / 2) * S],
                            radius=bh // 2 * S, fill=(238, 240, 239))
        d.rounded_rectangle([x0 * S, (y - bh / 2) * S, vx(v) * S, (y + bh / 2) * S],
                            radius=bh // 2 * S, fill=col)
        d.text(((vx(v) + 16) * S, (y - 13) * S), txt, font=f_val, fill=INK)

    y = 424
    for i, ln in enumerate(["BUILDER", "DELIVERED"]):
        w = tracked_w(ln, f_lab, 5)
        tracked(d, (206 - w, y - 24 + i * 24), ln, f_lab, DIM, 5)
    bx0, bx1 = vx(450_000), vx(650_000)
    d.rounded_rectangle([bx0 * S, (y - 12) * S, bx1 * S, (y + 12) * S],
                        radius=12 * S, outline=DIM, width=int(1.2 * S))
    ctext = "$450K – $650K"
    w = tracked_w(ctext, f_axis, 1)
    tracked(d, ((bx0 + bx1) / 2 - w / 2, y - 8), ctext, f_axis, DIM, 1)
    d.text(((bx1 + 18) * S, (y - 11) * S), "same home, conventional builder",
           font=mn(16, 440), fill=FAINT)

    center_tracked(d, 800, 520,
                   "OWNER-BUILDER PATH SAVES $150K – $250K  ·  IN EXCHANGE FOR 12 – 24 MONTHS OF SWEAT",
                   mono(13), FAINT, 4)
    save(img, "budget-bands.png")


# ---------------------------------------------------------------- escrow flow 1600x560
def box(d, x0, y0, x1, y1, stroke, title, title_col, body, tr=4):
    d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=13 * S,
                        outline=stroke, width=int(1.4 * S), fill=(255, 255, 255))
    cx = (x0 + x1) / 2
    f_title, f_body = mono(16, bold=True), mn(15, 440)
    center_tracked(d, cx, y0 + 15, title, f_title, title_col, tr)
    for i, ln in enumerate(body):
        w = d.textlength(ln, font=f_body) / S
        d.text(((cx - w / 2) * S, (y0 + 45 + i * 21) * S), ln, font=f_body, fill=DIM)


def escrow():
    img, d = canvas(1600, 560)
    tracked(d, (90, 36), "How the money moves — milestones, 2-of-3, and the 10% holdback.",
            sg(30, 600), INK, -0.55)

    box(d, 90, 150, 320, 268, EMERALD, "BUYER", EM700,
        ["pays by Visa, or brings", "USDC — no exchange", "account ever required"], tr=6)
    box(d, 420, 150, 660, 268, TEAL700, "ON-RAMP / CCTP", TEAL700,
        ["card CAD converted to", "USDC in-flow; natives", "bridge from Base"])
    box(d, 760, 138, 1060, 280, VIOLET_F, "AURABUILDESCROW", VIOLET_T,
        ["native USDC on X Layer", "milestone vault, 2-of-3 release:", "homeowner · builder · arbiter"])
    box(d, 1210, 140, 1510, 208, EMERALD, "BUILDER  ·  90%", EM700,
        ["paid on milestone approval"])
    box(d, 1210, 248, 1510, 334, LIME600, "HOLDBACK  ·  10%", LIME700,
        ["Alberta statutory holdback,", "released after the lien period"])
    box(d, 760, 392, 1060, 492, TEAL700, "AURABUILDREGISTRY", TEAL700,
        ["every milestone updates the on-chain", "build record — non-financial NFT"], tr=3)

    arrow_to(d, 322, 209, 418, 209, FAINT, 1)
    arrow_to(d, 662, 209, 758, 209, FAINT, 1)
    arrow_to(d, 1062, 192, 1208, 174, FAINT, 1)
    arrow_to(d, 1062, 238, 1208, 288, FAINT, 1)
    line(d, 910, 282, 910, 390, FAINT, 1)
    arrow_to(d, 1360, 336, 1360, 380, FAINT, 1)
    cap = "timer expires → released to builder"
    f_cap = mn(15, 440)
    w = d.textlength(cap, font=f_cap) / S
    d.text(((1360 - w / 2) * S, 392 * S), cap, font=f_cap, fill=DIM)

    center_tracked(d, 800, 524,
                   "NO CONTRACT PRETENDS TO BE A LAWYER — LICENSED HUMANS CLOSE, THE CHAIN KEEPS THE RECORD",
                   mono(13), FAINT, 4)
    save(img, "escrow-flow.png")


# ---------------------------------------------------------------- section rule 2400x96
def section_rule():
    img = Image.new("RGBA", (2400 * S, 96 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, base, gap = 1200, 88, 78
    hair = (23, 26, 24, 56)
    line(d, 20, 70, cx - gap, 70, hair, 1.4)
    line(d, cx + gap, 70, 2380, 70, hair, 1.4)
    for r, col in [(56, (23, 26, 24, 120)), (38, (16, 185, 129, 235)), (21, (16, 185, 129, 235))]:
        d.arc([(cx - r) * S, (base - r) * S, (cx + r) * S, (base + r) * S],
              start=180, end=360, fill=col, width=5 * S)
    save(img, "section-rule.png")


# ---------------------------------------------------------------- social card 1280x640
def social():
    img, d = canvas(1280, 640)
    img = img.convert("RGBA")
    img.alpha_composite(load_mark(380), (84 * S, 130 * S))
    img.alpha_composite(load_badge(54), (524 * S, 500 * S))
    img = img.convert("RGB")
    d = ImageDraw.Draw(img)

    X0 = 524
    wordmark(d, X0, 140, 78)
    f_tag = mn(30, 450)
    d.text(((X0 + 2) * S, 262 * S), "From USDC on X Layer", font=f_tag, fill=DIM)
    d.text(((X0 + 2) * S, 304 * S), "to the keys of an off-grid eco home.", font=f_tag, fill=DIM)

    chips = [("BUILDX AI SEASON 2026", EM600), ("AI-RWA", VIOLET_T), ("MIT · OPEN SOURCE", DIM)]
    cx, cy = X0 + 2, 386
    f_chip = mono(15, bold=True)
    for text, col in chips:
        w = tracked_w(text, f_chip, 3) + 38
        d.rounded_rectangle([cx * S, cy * S, (cx + w) * S, (cy + 40) * S],
                            radius=20 * S, outline=col, width=int(1.4 * S))
        tracked(d, (cx + 19, cy + 10), text, f_chip, col, 3)
        cx += w + 14

    d.rectangle([(X0 + 2) * S, 468 * S, (X0 + 566) * S, 470 * S], fill=EMERALD)

    tracked(d, (X0 + 74, 502), "A KR8TIV AI PRODUCT", sg(20, 600), INK, 4)
    tracked(d, (X0 + 74, 533), "GITHUB.COM/KR8TIV-AI/AURA-HOMES", mono(14), DIM, 2)
    save(img, "social-card.png")


if __name__ == "__main__":
    light_mark()
    hero()
    pipeline()
    budget()
    escrow()
    section_rule()
    social()
