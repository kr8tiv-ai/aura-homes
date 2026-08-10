# -*- coding: utf-8 -*-
"""Generator for the Aura Homes BRAND KIT (docs/BRAND-KIT.md).

Distills BRAND.md v3 + the live site (aurahomes.fun, served CSS verified
Aug 2026) into ready-to-use files. The silhouette is NEVER redrawn — every
logo variant derives from the two masters in assets/ (alpha copied verbatim,
fills recolored only). Everything typeset is drawn at 2x and LANCZOS-
downsampled with the real brand faces (variable TTFs, SIL OFL 1.1).

Outputs (this directory):
    logo-light.png / -256          logo-dark-context.png / -256
    logo-mono-ink.png / -256       logo-mono-white.png / -256
    avatar-chip.png / -256
    lockup-horizontal.png / lockup-horizontal-transparent.png
    lockup-stacked.png / lockup-stacked-transparent.png
    palette.png   palette.json   tokens.css
    type-specimen.png   social-card-template.png

Run: `python assets/brand-kit/make-brand-kit.py`
"""
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
REPO = os.path.dirname(ASSETS)
FONTS = os.path.join(ASSETS, "fonts")
UFONTS = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\Windows\Fonts")
SG_VAR = os.path.join(FONTS, "SpaceGrotesk[wght].ttf")
MN_VAR = os.path.join(FONTS, "Manrope[wght].ttf")
MONO_R = os.path.join(UFONTS, "JetBrainsMono-Regular.ttf")
MONO_B = os.path.join(UFONTS, "JetBrainsMono-Bold.ttf")

S = 2  # supersample factor

PAPER = (250, 250, 249)      # #fafaf9
INK = (23, 26, 24)           # #171a18
DIM = (95, 102, 99)          # #5f6663
FAINT = (154, 161, 157)      # #9aa19d
HAIR = (218, 219, 217)       # ink @14% flattened on paper
HAIR_SOFT = (229, 230, 228)  # ink @9% flattened on paper
EMERALD = (16, 185, 129)     # #10b981
EM600 = (5, 150, 105)        # #059669
EM700 = (4, 120, 87)         # #047857
EM_B = (52, 211, 153)        # #34d399  aurora
TEAL_B = (45, 212, 191)      # #2dd4bf  aurora
TEAL = (15, 118, 110)        # #0f766e  (as served — BRAND.md lists #0d9488 for fills)
VIOLET_T = (124, 58, 237)    # #7c3aed text
VIOLET_F = (139, 92, 246)    # #8b5cf6 fill
LIME = (77, 124, 15)         # #4d7c0f
CHIP = (5, 8, 7)             # #050807 dark chip
WHITE = (255, 255, 255)


def sg(size, weight=560):
    f = ImageFont.truetype(SG_VAR, size * S)
    f.set_variation_by_axes([weight])
    return f


def mn(size, weight=430):
    f = ImageFont.truetype(MN_VAR, size * S)
    f.set_variation_by_axes([weight])
    return f


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


def dashed_rect(draw, x0, y0, x1, y1, fill, dash=7, gap=5, w=1.2):
    """Square-corner dashed rectangle for template annotations (1x coords)."""
    def run(a0, b0, a1, b1):
        length = ((a1 - a0) ** 2 + (b1 - b0) ** 2) ** 0.5
        n = max(1, int(length // (dash + gap)))
        ux, uy = (a1 - a0) / length, (b1 - b0) / length
        for i in range(n + 1):
            s0 = i * (dash + gap)
            s1 = min(s0 + dash, length)
            if s0 >= length:
                break
            draw.line([(a0 + ux * s0) * S, (b0 + uy * s0) * S,
                       (a0 + ux * s1) * S, (b0 + uy * s1) * S],
                      fill=fill, width=max(1, int(w * S)))
    run(x0, y0, x1, y0)
    run(x1, y0, x1, y1)
    run(x1, y1, x0, y1)
    run(x0, y1, x0, y0)


def save(img, name, keep_alpha=False):
    out = img.resize((img.width // S, img.height // S), Image.LANCZOS)
    path = os.path.join(HERE, name)
    out.save(path, "PNG")
    print("saved", path, out.size)
    return out


def kicker(d, x, y, num, label, x_end, num_col=EM600):
    """The section-kicker pattern: mono number, tracked caps, hairline out."""
    f_num, f_lab = mono(15, bold=True), mono(13, bold=True)
    tracked(d, (x, y), num, f_num, num_col, 2)
    xe = tracked(d, (x + 34, y + 1), label, f_lab, DIM, 4)
    line(d, xe + 22, y + 9, x_end, y + 9, HAIR, 1.2)


# ---------------------------------------------------------------------- color
def rel_lum(rgb):
    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    lo, hi = min(la, lb), max(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def hexs(rgb):
    return "#%02x%02x%02x" % rgb


# ------------------------------------------------------------------ the marks
def load_master(name):
    return Image.open(os.path.join(ASSETS, name)).convert("RGBA")


def mono_mark(master, color):
    """Silhouette (alpha verbatim) refilled with a single flat color."""
    alpha = np.asarray(master)[..., 3]
    solid = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    solid[..., 0], solid[..., 1], solid[..., 2] = color
    solid[..., 3] = alpha
    return Image.fromarray(solid, "RGBA")


def save_sizes(img, base):
    for px, suffix in [(1024, ""), (256, "-256")]:
        out = img.resize((px, px), Image.LANCZOS)
        path = os.path.join(HERE, f"{base}{suffix}.png")
        out.save(path, "PNG")
        print("saved", path, out.size)


def logo_suite():
    light = load_master("aura-homes-logo-light.png")
    night = load_master("aura-homes-logo.png")
    save_sizes(light, "logo-light")
    save_sizes(night, "logo-dark-context")
    save_sizes(mono_mark(light, INK), "logo-mono-ink")
    save_sizes(mono_mark(light, WHITE), "logo-mono-white")

    # avatar chip: night mark on the #050807 chip, mark at 86% like the master avatar
    chip = Image.new("RGBA", (1024, 1024), CHIP + (255,))
    m = night.resize((880, 880), Image.LANCZOS)
    chip.alpha_composite(m, ((1024 - 880) // 2, (1024 - 880) // 2))
    chip = chip.convert("RGB")
    for px, suffix in [(1024, ""), (256, "-256")]:
        out = chip.resize((px, px), Image.LANCZOS)
        path = os.path.join(HERE, f"avatar-chip{suffix}.png")
        out.save(path, "PNG")
        print("saved", path, out.size)


# -------------------------------------------------------------------- lockups
def mark_trimmed(px_h):
    """Light-native mark cropped to its alpha bbox, scaled to px_h tall (2x)."""
    m = load_master("aura-homes-logo-light.png")
    bbox = m.getbbox()
    m = m.crop(bbox)
    w = int(m.width * px_h * S / m.height)
    return m.resize((w, px_h * S), Image.LANCZOS)


def draw_wordmark(d, x, y, size, weight=620):
    """AURA ink + HOMES emerald-600, display tracking -0.02em. Returns end x."""
    f = sg(size, weight)
    tr = -size * 0.02
    xe = tracked(d, (x, y), "AURA", f, INK, tr)
    return tracked(d, (xe + f.getlength(" ") / S + tr, y), "HOMES", f, EM600, tr)


def wordmark_w(size, weight=620):
    f = sg(size, weight)
    tr = -size * 0.02
    return (tracked_w("AURA", f, tr) + f.getlength(" ") / S + tr
            + tracked_w("HOMES", f, tr))


def lockups():
    # ---- horizontal: mark left, wordmark on its optical centerline
    mh, size, gap, pad = 300, 128, 72, 84
    m = mark_trimmed(mh)
    ww = wordmark_w(size)
    W = int(pad + m.width / S + gap + ww + pad)
    H = mh + 2 * pad
    for transparent in (False, True):
        if transparent:
            img = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
        else:
            img = Image.new("RGBA", (W * S, H * S), PAPER + (255,))
        img.alpha_composite(m, (pad * S, pad * S))
        d = ImageDraw.Draw(img)
        f = sg(size, 620)
        asc, desc = f.getmetrics()
        cap = f.getbbox("A")  # (x0, y0, x1, y1) in 2x px
        cap_h = (cap[3] - cap[1]) / S
        ty = pad + mh / 2 - cap_h / 2 - cap[1] / S  # cap-height centered on the mark
        draw_wordmark(d, pad + m.width / S + gap, ty, size)
        if not transparent:
            img = img.convert("RGB")
        save(img, "lockup-horizontal-transparent.png" if transparent
             else "lockup-horizontal.png")

    # ---- stacked: mark centered above, wordmark centered beneath
    mh2, size2, gap2, pad2 = 340, 96, 64, 96
    m2 = mark_trimmed(mh2)
    ww2 = wordmark_w(size2)
    W2 = int(max(m2.width / S, ww2) + 2 * pad2)
    f2 = sg(size2, 620)
    cap2 = f2.getbbox("A")
    text_h = (cap2[3] - cap2[1]) / S
    H2 = int(pad2 + mh2 + gap2 + text_h + pad2)
    for transparent in (False, True):
        if transparent:
            img = Image.new("RGBA", (W2 * S, H2 * S), (0, 0, 0, 0))
        else:
            img = Image.new("RGBA", (W2 * S, H2 * S), PAPER + (255,))
        img.alpha_composite(m2, (int((W2 * S - m2.width) / 2), pad2 * S))
        d = ImageDraw.Draw(img)
        tx = (W2 - ww2) / 2
        ty = pad2 + mh2 + gap2 - cap2[1] / S
        draw_wordmark(d, tx, ty, size2)
        if not transparent:
            img = img.convert("RGB")
        save(img, "lockup-stacked-transparent.png" if transparent
             else "lockup-stacked.png")


# -------------------------------------------------------------- palette sheet
SWATCHES = [
    ("GROUND & INK", [
        ("PAPER", (250, 250, 249), "Every ground — warm paper white, never pure #fff", None, "swatch-border"),
        ("INK", (23, 26, 24), "Display type and body text", "text"),
        ("DIM", (95, 102, 99), "Secondary text, captions", "text"),
        ("FAINT", (154, 161, 157), "Tertiary text, axis labels — decorative scale only", "text"),
        ("HAIRLINE", (218, 219, 217), "Rules and borders: ink at 9–14% — structure without boxes", None),
        ("PANEL", (255, 255, 255), "Card and framed-media fill (--aura-panel)", None, "swatch-border"),
    ]),
    ("THE ACCENT — EMERALD", [
        ("EMERALD", (16, 185, 129), "THE accent as a mark on paper: fills, bars, rules, buttons", "fill-only"),
        ("EMERALD-DEEP", (4, 120, 87), "Emerald as body-scale text on light", "text"),
        ("EMERALD-LABEL", (5, 150, 105), "Large display and tracked labels — never lighter than #0e9f6e", "text-large"),
    ]),
    ("CONTEXT ACCENTS — RATIONED", [
        ("VIOLET", (124, 58, 237), "On-chain surfaces only (escrow, registry) — as text", "text"),
        ("VIOLET-FILL", (139, 92, 246), "On-chain fills; never on a first-look surface", "fill-only"),
        ("TEAL", (15, 118, 110), "Secondary system notes; bridge to Aura-H2O — sparse", "text"),
        ("LIME", (77, 124, 15), "Land and growth notes; bridge to Aura-Farms — sparse", "text"),
    ]),
]


def palette_sheet():
    W, H = 1520, 1500
    img, d = canvas(W, H)
    MX = 96

    kicker(d, MX, 72, "01", "COLOR — LIGHT-FIRST", W - MX)
    tracked(d, (MX - 2, 108), "The palette.", sg(56, 610), INK, -1.7)
    d.text((MX * S, 196 * S),
           "BRAND.md v3, verified against the CSS served at aurahomes.fun, August 2026. "
           "One accent dominates any surface; accents are marks on paper,",
           font=mn(17, 440), fill=DIM)
    d.text((MX * S, 222 * S),
           "never large fills; dark exists only inside framed media; no glow anywhere.",
           font=mn(17, 440), fill=DIM)

    f_name, f_hex, f_role, f_aa = mono(15, bold=True), mono(14), mn(14.5, 440), mono(11)
    cols, cw, ch, gx, gy = 3, 432, 118, 20, 22
    y = 280

    for section, rows in SWATCHES:
        tracked(d, (MX, y), section, mono(12, bold=True), FAINT, 4)
        line(d, MX + tracked_w(section, mono(12, bold=True), 4) + 18, y + 8, W - MX, y + 8, HAIR_SOFT, 1)
        y += 38
        for i, row in enumerate(rows):
            name, rgb, role, kind = row[0], row[1], row[2], row[3]
            bordered = len(row) > 4
            cx = MX + (i % cols) * (cw + gx)
            cy = y + (i // cols) * (ch + gy)
            # swatch block
            d.rounded_rectangle([cx * S, cy * S, (cx + 96) * S, (cy + ch) * S],
                                radius=12 * S, fill=rgb,
                                outline=HAIR if bordered else None,
                                width=int(1.2 * S) if bordered else 0)
            tx = cx + 120
            tracked(d, (tx, cy + 4), name, f_name, INK, 2)
            d.text(((tx) * S, (cy + 30) * S), hexs(rgb).upper(), font=f_hex, fill=DIM)
            # role, wrapped to the card width
            words, lines_, cur = role.split(), [], ""
            for wd in words:
                t = (cur + " " + wd).strip()
                if d.textlength(t, font=f_role) / S > cw - 130:
                    lines_.append(cur)
                    cur = wd
                else:
                    cur = t
            lines_.append(cur)
            for j, ln in enumerate(lines_[:2]):
                d.text((tx * S, (cy + 56 + j * 21) * S), ln, font=f_role, fill=DIM)
            # AA note
            if kind == "text":
                r = contrast(rgb, PAPER)
                note, col = f"TEXT ON PAPER {r:.1f}:1 · AA", EM700
                if r < 4.5:
                    note, col = f"ON PAPER {r:.1f}:1 · DECORATIVE ONLY", FAINT
            elif kind == "text-large":
                r = contrast(rgb, PAPER)
                note, col = f"ON PAPER {r:.1f}:1 · AA-LARGE ONLY", EM700 if r >= 3 else FAINT
            elif kind == "fill-only":
                r = contrast(rgb, PAPER)
                note, col = f"FILL ONLY — {r:.1f}:1 AS TEXT, FAILS AA", FAINT
            else:
                note, col = "", None
            if note:
                tracked(d, (tx, cy + ch - 16), note, f_aa, col, 1)
        y += ((len(rows) + cols - 1) // cols) * (ch + gy) + 26

    # ---- the aurora band: shown INSIDE a framed media card, as the rule demands
    aur = "AURORA BAND — INSIDE MEDIA AND THE MARK ONLY"
    tracked(d, (MX, y), aur, mono(12, bold=True), FAINT, 4)
    line(d, MX + tracked_w(aur, mono(12, bold=True), 4) + 18, y + 8, W - MX, y + 8, HAIR_SOFT, 1)
    y += 38
    bx0, bx1, bh = MX, W - MX - 470, 128
    d.rounded_rectangle([bx0 * S, y * S, bx1 * S, (y + bh) * S], radius=18 * S,
                        outline=HAIR, width=int(1.2 * S), fill=WHITE)
    # gradient band inside the frame
    g0, g1 = bx0 + 18, bx1 - 18
    stops = [(52, 211, 153), (45, 212, 191), (96, 165, 250), (139, 92, 246)]
    for px in range(int(g0) * S, int(g1) * S):
        t = (px - g0 * S) / ((g1 - g0) * S)
        seg = min(int(t * (len(stops) - 1)), len(stops) - 2)
        tt = t * (len(stops) - 1) - seg
        col = tuple(int(stops[seg][k] * (1 - tt) + stops[seg + 1][k] * tt) for k in range(3))
        d.line([px, (y + 18) * S, px, (y + 74) * S], fill=col)
    labels = ["#34D399", "#2DD4BF", "#60A5FA", "#8B5CF6"]
    for i, lab in enumerate(labels):
        lx = g0 + (g1 - g0) * i / (len(labels) - 1)
        lx = min(max(lx, g0 + 34), g1 - 40)
        center_tracked(d, lx, y + 86, lab, mono(11), DIM, 1)
    d.text(((bx0 + 18) * S, (y + bh + 12) * S),
           "The v2 night sky survives as content — the mark's fill, photos, framed app screens. Never as ground, never as text.",
           font=mn(14.5, 440), fill=FAINT)

    # ---- dark chip
    cx0 = bx1 + 40
    d.rounded_rectangle([cx0 * S, y * S, (cx0 + 96) * S, (y + bh) * S],
                        radius=12 * S, fill=CHIP)
    tracked(d, (cx0 + 120, y + 4), "DARK CHIP", f_name, INK, 2)
    d.text(((cx0 + 120) * S, (y + 30) * S), "#050807", font=f_hex, fill=DIM)
    d.text(((cx0 + 120) * S, (y + 56) * S), "Favicon and avatar only —", font=f_role, fill=DIM)
    d.text(((cx0 + 120) * S, (y + 77) * S), "an avatar is a contained shape", font=f_role, fill=DIM)

    y += bh + 62
    line(d, MX, y, W - MX, y, HAIR, 1.2)
    center_tracked(d, W / 2, y + 20,
                   "ONE DOMINANT ACCENT PER SURFACE  ·  DARK ONLY INSIDE FRAMED MEDIA  ·  NO GLOW ANYWHERE",
                   mono(12), FAINT, 4)
    save(img, "palette.png")


# ------------------------------------------------------------- type specimen
def type_specimen():
    W, H = 1520, 1560
    img, d = canvas(W, H)
    MX = 96

    kicker(d, MX, 72, "02", "TYPOGRAPHY — THREE FACES, ALL SIL OFL 1.1", W - MX)
    tracked(d, (MX - 2, 108), "The type.", sg(56, 610), INK, -1.7)
    d.text((MX * S, 196 * S),
           "Space Grotesk for display, Manrope for prose, JetBrains Mono for the tracked label — "
           "the house signature. Modular scale ≈ 1.33; tracking",
           font=mn(17, 440), fill=DIM)
    d.text((MX * S, 222 * S),
           "tightens as display grows (−0.02em → −0.06em); body sits at 1.5–1.6 leading; mono labels track +0.15–0.25em.",
           font=mn(17, 440), fill=DIM)

    y = 290
    # ---- display
    tracked(d, (MX, y), "DISPLAY — SPACE GROTESK 500–620, NEVER HEAVY", mono(12, bold=True), FAINT, 4)
    y += 44
    tracked(d, (MX - 2, y), "Homes that hold their own.", sg(76, 620), INK, -76 * 0.055)
    y += 102
    tracked(d, (MX - 2, y), "Ranges over point estimates, always.", sg(43, 560), INK, -43 * 0.03)
    y += 74
    # the scale ladder
    f_tag = mono(11)
    steps = [(18, "18 · −0.02EM"), (24, "24 · −0.02EM"), (32, "32 · −0.03EM"),
             (43, "43 · −0.03EM"), (57, "57 · −0.045EM"), (76, "76 · −0.06EM")]
    lx = MX
    for size, tag in steps:
        f = sg(size, 580)
        aw = tracked_w("Aa", f, -size * 0.02)
        tw = tracked_w(tag, f_tag, 1)
        tracked(d, (lx, y + 76 - size), "Aa", f, INK, -size * 0.02)
        tracked(d, (lx, y + 92), tag, f_tag, FAINT, 1)
        lx += max(aw, tw) + 42
    d.text((lx * S + 10, (y + 92) * S), "modular ≈ 1.33", font=mn(13.5, 430), fill=FAINT)
    y += 140

    line(d, MX, y, W - MX, y, HAIR_SOFT, 1)
    y += 34
    # ---- body
    tracked(d, (MX, y), "BODY / UI — MANROPE 400 · BUTTONS 600–650", mono(12, bold=True), FAINT, 4)
    y += 40
    body = [
        "An 800 sqft off-grid SIP home runs $199K–$444K ex-land, CAD, computed line-by-line from",
        "real Alberta suppliers. The December solar collapse is published next to the panel spec,",
        "because the limitation is the proof of honesty. Funds are held in escrow; the hash is one",
        "tap deeper. Never justified, generous leading, ink on paper.",
    ]
    f_body = mn(19, 430)
    for i, ln in enumerate(body):
        d.text((MX * S, (y + i * 30) * S), ln, font=f_body, fill=INK)
    y += len(body) * 30 + 26
    # buttons: one solid ink, one outlined — the two-pill maximum
    f_btn = mn(16, 630)
    b1 = "Start with the land"
    w1 = d.textlength(b1, font=f_btn) / S + 56
    d.rounded_rectangle([MX * S, y * S, (MX + w1) * S, (y + 46) * S], radius=23 * S, fill=INK)
    d.text(((MX + 28) * S, (y + 11) * S), b1, font=f_btn, fill=PAPER)
    b2 = "Read the feasibility study"
    w2 = d.textlength(b2, font=f_btn) / S + 56
    d.rounded_rectangle([(MX + w1 + 16) * S, y * S, (MX + w1 + 16 + w2) * S, (y + 46) * S],
                        radius=23 * S, outline=INK, width=int(1.4 * S))
    d.text(((MX + w1 + 16 + 28) * S, (y + 11) * S), b2, font=f_btn, fill=INK)
    d.text(((MX + w1 + w2 + 58) * S, (y + 13) * S), "two pill buttons maximum",
           font=mn(13.5, 430), fill=FAINT)
    y += 84

    line(d, MX, y, W - MX, y, HAIR_SOFT, 1)
    y += 34
    # ---- mono
    tracked(d, (MX, y), "LABELS / DATA — JETBRAINS MONO 400–500", mono(12, bold=True), FAINT, 4)
    y += 42
    tracked(d, (MX, y), "THE TRACKED CAPS LABEL · 10–12PX · +0.15–0.25EM · ACCENT OR DIM", mono(12, bold=True), EM600, 3)
    y += 34
    tracked(d, (MX, y), "FIG. 1", mono(12, bold=True), EM700, 2)
    d.text(((MX + 76) * S, (y - 1) * S), "Every figure carries a mono tag and one dim caption.",
           font=mn(14.5, 430), fill=DIM)
    y += 34
    # spec-ledger rows
    for lab, val in [("IN", "PARCEL FILTERS · BUDGET BAND · SOIL CLASS"),
                     ("OUT", "REVIEW-READY DESIGN PACKAGE · LINE-ITEM COSTS")]:
        tracked(d, (MX, y), lab, mono(11, bold=True), VIOLET_T if lab == "OUT" else EM700, 2)
        tracked(d, (MX + 52, y), val, mono(11), DIM, 1.5)
        y += 24
    y += 12
    # tabular figures
    tracked(d, (MX, y), "0123456789  ·  $199,100 – $443,900  ·  53.5°N 113.5°W  ·  TABULAR, UNIT + BASIS ALWAYS",
            mono(13), INK, 1)
    y += 48

    line(d, MX, y, W - MX, y, HAIR_SOFT, 1)
    y += 34
    # ---- the load-bearing kicker pattern, demonstrated
    tracked(d, (MX, y), "THE SECTION-KICKER PATTERN — LOAD-BEARING", mono(12, bold=True), FAINT, 4)
    y += 44
    kicker(d, MX, y, "03", "RESULTS", W - MX)
    y += 30
    tracked(d, (MX - 2, y), "What the pilot actually cost.", sg(40, 600), INK, -40 * 0.03)
    y += 64
    d.text((MX * S, y * S), "Mono number in accent, tracked-caps label in dim, hairline to the margin — then the display headline.",
           font=mn(14.5, 430), fill=FAINT)

    y += 56
    line(d, MX, y, W - MX, y, HAIR, 1.2)
    center_tracked(d, W / 2, y + 20,
                   "SPACE GROTESK · MANROPE · JETBRAINS MONO — VARIABLE TTFS VENDORED IN ASSETS/FONTS, LICENSES ALONGSIDE",
                   mono(12), FAINT, 4)
    save(img, "type-specimen.png")


# ---------------------------------------------------- social card template
def social_template():
    W, H = 1280, 800
    img, d = canvas(W, H)

    # the card itself, framed as evidence: exact 1280x640 art area scaled into a frame
    CX0, CY0 = 40, 36
    CW, CH = 1200, 600  # drawn at 1200x600; template documents the 1280x640 grid
    sc = CW / 1280.0

    def gx(x):
        return CX0 + x * sc

    def gy(y):
        return CY0 + y * sc

    d.rounded_rectangle([CX0 * S, CY0 * S, (CX0 + CW) * S, (CY0 + CH) * S],
                        radius=20 * S, outline=HAIR, width=int(1.4 * S), fill=WHITE)

    # real, fixed elements ---------------------------------------------------
    m = load_master("aura-homes-logo-light.png").resize(
        (int(380 * sc) * S, int(380 * sc) * S), Image.LANCZOS)
    img_rgba = img.convert("RGBA")
    img_rgba.alpha_composite(m, (int(gx(84)) * S, int(gy(130)) * S))
    badge = Image.open(os.path.join(REPO, "app", "public", "kr8tiv-badge.png")).convert("RGBA")
    badge = badge.resize((int(54 * sc) * S, int(54 * sc) * S), Image.LANCZOS)
    img_rgba.alpha_composite(badge, (int(gx(524)) * S, int(gy(500)) * S))
    img = img_rgba.convert("RGB")
    d = ImageDraw.Draw(img)

    X0 = 524
    # the emerald rule (real)
    d.rectangle([gx(X0 + 2) * S, gy(468) * S, gx(X0 + 566) * S, gy(470.5) * S], fill=EMERALD)

    # annotated blank zones --------------------------------------------------
    f_zone, f_dim = mono(12, bold=True), mono(10.5)

    def zone(x0, y0, x1, y1, label, sub=None):
        dashed_rect(d, gx(x0), gy(y0), gx(x1), gy(y1), FAINT, dash=6, gap=5, w=1.1)
        tracked(d, (gx(x0) + 10, gy(y0) + 7), label, f_zone, DIM, 2)
        if sub:
            tracked(d, (gx(x0) + 10, gy(y0) + 26), sub, f_dim, FAINT, 1)

    zone(X0, 140, X0 + 586, 236, "WORDMARK — AURA INK + HOMES #059669",
         "SPACE GROTESK 620 · 78PX · −0.02EM")
    zone(X0, 258, X0 + 586, 348, "TAGLINE — TWO LINES MAX",
         "MANROPE 450 · 30PX · DIM #5F6663")
    zone(X0, 380, X0 + 586, 432, "CHIP ROW — OUTLINED HAIRLINE PILLS, MAX 3",
         "MONO 15 · ONE EMERALD, ONE VIOLET, ONE NEUTRAL")
    zone(X0 + 66, 494, X0 + 586, 562, "KR8TIV LOCKUP CLOSES — BADGE AT TEXT HEIGHT",
         "SG 600 20PX TRACKED · MONO 14 URL · NEVER EQUAL-SIZE")

    # measurement ticks
    tracked(d, (gx(90), gy(88)), "MARK 380PX — LIGHT-NATIVE FILL, LEFT", f_dim, EM700, 1.5)
    tracked(d, (gx(X0), gy(452)), "EMERALD RULE — 2PX, FULL TEXT WIDTH", f_dim, EM700, 1.5)

    # spec strip below the frame --------------------------------------------
    sy = CY0 + CH + 26
    kicker(d, 40, sy, "OG", "CARD TEMPLATE — DIMENSIONS", W - 40, num_col=EM600)
    sy += 30
    specs = [
        "CANVAS 1280 × 640 — GITHUB SOCIAL PREVIEW (ASSETS/SOCIAL-CARD.PNG)",
        "OG:IMAGE 1200 × 630 — SAME COMPOSITION, SITE-CARD.PNG, SERVED FROM APP/PUBLIC",
        "PAPER #FAFAF9 GROUND · SAFE AREA 84PX ALL EDGES · SWAP THE CHIP ROW PER CONTEXT",
    ]
    for i, ln in enumerate(specs):
        tracked(d, (40, sy + i * 22), ln, mono(11.5), DIM if i < 2 else FAINT, 1.5)
    save(img, "social-card-template.png")


# ------------------------------------------------------- tokens.css + json
TOKENS_CSS = """/* Aura Homes — brand tokens (BRAND.md v3, light-first)
 * Mirrors the :root served at https://aurahomes.fun (verified 2026-08),
 * plus brand-level tokens from docs/BRAND.md that the site does not need.
 * Fonts: Space Grotesk / Manrope / JetBrains Mono — all SIL OFL 1.1,
 * variable TTFs vendored in assets/fonts/. */

:root {
  /* ---- ground & ink (as served) ---- */
  --aura-bg: #fafaf9;            /* paper — every ground, never pure #fff */
  --aura-panel: #fff;            /* card / framed-media fill */
  --aura-text: #171a18;          /* ink */
  --aura-border: rgba(23, 26, 24, 0.12);

  --st-paper: #fafaf9;
  --st-ink: #171a18;
  --st-ink-dim: #5f6663;         /* secondary text */
  --st-faint: #9aa19d;           /* tertiary text, axis labels */
  --st-hair: rgba(23, 26, 24, 0.14);
  --st-hair-soft: rgba(23, 26, 24, 0.09);

  /* ---- the accent (as served) ---- */
  --st-emerald: #10b981;         /* fills, bars, rules, buttons — fails AA as text */
  --st-emerald-deep: #047857;    /* emerald as body text on light (AA) */
  --st-emerald-label: #059669;   /* large display + tracked labels, never past #0e9f6e */
  --aura-emerald: #047857;       /* the app's text-scale emerald */

  /* ---- context accents, rationed (as served) ---- */
  --st-violet: #7c3aed;          /* on-chain surfaces only — text scale */
  --aura-violet: #7c3aed;
  --st-teal: #0f766e;            /* secondary system notes (BRAND.md fill-scale: #0d9488) */
  --aura-teal: #0f766e;
  --st-lime: #4d7c0f;            /* land / growth notes */
  --aura-lime: #4d7c0f;

  /* ---- type (as served) ---- */
  --st-display-font: "Space Grotesk Variable", "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --st-body-font: "Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif;
  --st-mono-font: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace;

  /* ---- motion (as served) ---- */
  --st-ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  /* ---- brand-level tokens (BRAND.md v3 — not in the served sheet) ---- */
  --brand-violet-fill: #8b5cf6;  /* on-chain fills */
  --brand-chip: #050807;         /* favicon / avatar dark chip only */
  --brand-aurora-1: #34d399;     /* aurora band — inside media and the mark only, */
  --brand-aurora-2: #2dd4bf;     /*   never as ground, never as text            */
  --brand-aurora-3: #8b5cf6;
}
"""


def data_files():
    with open(os.path.join(HERE, "tokens.css"), "w", encoding="utf-8", newline="\n") as f:
        f.write(TOKENS_CSS)
    print("saved", os.path.join(HERE, "tokens.css"))

    def tok(name, value, role, aa=None):
        t = {"name": name, "value": value, "role": role}
        if aa:
            t["aa"] = aa
        return t

    def aa_text(rgb):
        return f"{contrast(rgb, PAPER):.2f}:1 on paper"

    data = {
        "$meta": {
            "brand": "Aura Homes",
            "source": "docs/BRAND.md v3 (light-first), verified against the CSS served at https://aurahomes.fun",
            "verified": "2026-08",
            "license": "Marks are the project's (MIT repo); fonts SIL OFL 1.1, vendored in assets/fonts/",
        },
        "color": {
            "ground": [
                tok("paper", "#fafaf9", "every ground — warm paper white, never pure #fff"),
                tok("panel", "#ffffff", "card / framed-media fill"),
                tok("ink", "#171a18", "display + body text", aa_text(INK)),
                tok("dim", "#5f6663", "secondary text, captions", aa_text(DIM)),
                tok("faint", "#9aa19d", "tertiary text, axis labels — decorative scale only", aa_text(FAINT)),
                tok("hairline", "rgba(23,26,24,0.14)", "rules, borders — structure without boxes"),
                tok("hairline-soft", "rgba(23,26,24,0.09)", "soft rules"),
            ],
            "accent": [
                tok("emerald", "#10b981", "THE accent — fills, bars, rules, buttons; fails AA as text",
                    aa_text(EMERALD) + " — fill only"),
                tok("emerald-deep", "#047857", "emerald as body-scale text on light", aa_text(EM700)),
                tok("emerald-label", "#059669", "large display + tracked labels; never lighter than #0e9f6e",
                    aa_text(EM600) + " — AA-large only"),
            ],
            "context": [
                tok("violet", "#7c3aed", "on-chain surfaces only (escrow, registry) — text", aa_text(VIOLET_T)),
                tok("violet-fill", "#8b5cf6", "on-chain fills — never on a first-look surface"),
                tok("teal", "#0f766e", "secondary system notes; bridge to Aura-H2O (BRAND.md fill-scale #0d9488)",
                    aa_text(TEAL)),
                tok("lime", "#4d7c0f", "land / growth notes; bridge to Aura-Farms", aa_text(LIME)),
            ],
            "aurora-band": {
                "values": ["#34d399", "#2dd4bf", "#8b5cf6"],
                "rule": "inside media and the mark only — never as ground, never as text",
            },
            "chip": tok("dark-chip", "#050807", "favicon / avatar only — an avatar is a contained shape"),
        },
        "type": {
            "display": {"family": "Space Grotesk", "weights": "500-620 (never heavy)",
                        "tracking": "-0.02em at h2 to -0.06em at hero", "leading": "0.9-0.95",
                        "case": "sentence case; may end in a period"},
            "body": {"family": "Manrope", "weights": "400 body, 600-650 buttons",
                     "leading": "1.5-1.6", "rules": "never justified"},
            "mono": {"family": "JetBrains Mono", "weights": "400-500",
                     "tracking": "+0.15em to +0.25em", "size": "10-12px",
                     "role": "tracked caps labels, FIG. tags, tables, code; tabular figures in columns"},
            "scale": "modular ~1.33 between display steps",
        },
        "motion": {
            "ease": "cubic-bezier(0.16, 1, 0.3, 1)",
            "micro-interactions": "150-250ms",
            "scene-transitions": "600-900ms of scroll distance, not time",
            "rules": "damped, never bouncy; scroll owns the timeline; prefers-reduced-motion gets a still of equal beauty",
        },
        "logo": {
            "masters": {"light-native": "assets/aura-homes-logo-light.png",
                        "night": "assets/aura-homes-logo.png"},
            "rule": "never redraw the silhouette, never add glow, never outline it",
            "variants": {
                "logo-light": "light-native fill — leads everywhere on paper",
                "logo-dark-context": "night fill — inside framed dark media only",
                "logo-mono-ink": "single-color ink — print, embossing, single-color contexts on light",
                "logo-mono-white": "single-color white — over photography and dark media",
                "avatar-chip": "#050807 chip + night mark — favicon and avatars only",
            },
        },
        "co-branding": {
            "lockup": "A KR8TIV AI PRODUCT in tracked caps, circular badge at text height beside it",
            "rule": "Aura mark leads, KR8TIV badge closes — never an equal-size partnership lockup",
        },
        "og": {"github-social": "1280x640 (assets/social-card.png)",
               "og-image": "1200x630 (assets/site-card.png)"},
    }
    with open(os.path.join(HERE, "palette.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("saved", os.path.join(HERE, "palette.json"))


if __name__ == "__main__":
    logo_suite()
    lockups()
    palette_sheet()
    type_specimen()
    social_template()
    data_files()
