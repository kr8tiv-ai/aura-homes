"""2D architectural blueprint renderer — SVG, PDF and DXF.

Draws what a drafter would draw, in the order a drafter would draw it:
poché (filled) structural walls, thinner partitions, window cuts with sill
lines, doors as a leaf plus a swing arc, room labels with computed areas,
dimension lines with ticks and extension lines, a title block, and a scale
bar. No AI is involved at this layer at all — every coordinate comes from
`layout.solve()`.

Units: model space is FEET, paper space is POINTS (72/in). At 1/4" = 1'-0"
one foot is 18pt, which puts a 40' house on Letter with room for dimensions.
"""

from __future__ import annotations

import math
from pathlib import Path

import svgwrite

from ..models import DesignRequest, FloorPlan, Opening, PlacedRoom

MM_PER_FT = 304.8
PT_PER_IN = 72.0

#: 1/4" = 1'-0" — the standard residential plan scale.
SCALE_DENOM = 48.0
PT_PER_FT = PT_PER_IN / SCALE_DENOM * 12.0  # = 18pt per foot

MARGIN = 54.0  # 0.75" paper margin
DIM_OFFSET = 26.0
TITLE_H = 96.0

INK = "#171a18"
HAIR = "#9aa19d"
POCHE = "#171a18"
PARTITION_FILL = "#5f6663"
GLASS = "#0f766e"
LABEL = "#5f6663"
ACCENT = "#047857"


def _ft(v: float) -> float:
    return v * PT_PER_FT


def _fmt_ft(v: float) -> str:
    """Feet-and-inches, the way a drawing labels it: 12'-6"."""
    whole = int(v)
    inches = round((v - whole) * 12)
    if inches == 12:
        whole, inches = whole + 1, 0
    return f"{whole}'-{inches}\""


# --------------------------------------------------------------------------
# openings
# --------------------------------------------------------------------------


def _wall_run(room: PlacedRoom, wall: str) -> tuple[float, float, float, float]:
    """Endpoints of a room wall in model feet, ordered along the run."""
    x, y, w, h = room.x, room.y, room.w, room.h
    return {
        "n": (x, y, x + w, y),
        "s": (x, y + h, x + w, y + h),
        "w": (x, y, x, y + h),
        "e": (x + w, y, x + w, y + h),
    }[wall]


def _opening_span(room: PlacedRoom, o: Opening) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = _wall_run(room, o.wall)
    L = math.hypot(x2 - x1, y2 - y1)
    if L <= 0:
        return x1, y1, x1, y1
    ux, uy = (x2 - x1) / L, (y2 - y1) / L
    c = L * o.t
    a = max(0.0, c - o.width / 2)
    b = min(L, c + o.width / 2)
    return x1 + ux * a, y1 + uy * a, x1 + ux * b, y1 + uy * b


def _draw_window(dwg, g, room: PlacedRoom, o: Opening, wall_ft: float) -> None:
    ax, ay, bx, by = _opening_span(room, o)
    # the glass line, plus a sill line offset into the wall thickness
    g.add(dwg.line((_ft(ax), _ft(ay)), (_ft(bx), _ft(by)),
                   stroke=GLASS, stroke_width=1.6))
    nx, ny = (0.0, 1.0) if o.wall in ("n", "s") else (1.0, 0.0)
    off = wall_ft * 0.34
    g.add(dwg.line((_ft(ax + nx * off), _ft(ay + ny * off)),
                   (_ft(bx + nx * off), _ft(by + ny * off)),
                   stroke=GLASS, stroke_width=0.7, opacity=0.75))


def _draw_door(dwg, g, room: PlacedRoom, o: Opening) -> None:
    """Leaf + swing arc — the thing that makes a plan read as architectural."""
    ax, ay, bx, by = _opening_span(room, o)
    L = math.hypot(bx - ax, by - ay)
    if L <= 0:
        return
    ux, uy = (bx - ax) / L, (by - ay) / L
    # hinge at the a-end; swing INTO the room
    inward = {
        "n": (0.0, 1.0), "s": (0.0, -1.0), "w": (1.0, 0.0), "e": (-1.0, 0.0)
    }[o.wall]
    lx, ly = ax + inward[0] * L, ay + inward[1] * L  # leaf, fully open
    g.add(dwg.line((_ft(ax), _ft(ay)), (_ft(lx), _ft(ly)),
                   stroke=INK, stroke_width=1.1))
    # arc from the open leaf round to the closed position at b
    g.add(dwg.path(
        d=(f"M {_ft(lx):.2f},{_ft(ly):.2f} "
           f"A {_ft(L):.2f},{_ft(L):.2f} 0 0 "
           f"{1 if (ux * inward[1] - uy * inward[0]) < 0 else 0} "
           f"{_ft(bx):.2f},{_ft(by):.2f}"),
        fill="none", stroke=HAIR, stroke_width=0.6, stroke_dasharray="3,2"))


# --------------------------------------------------------------------------
# dimensions
# --------------------------------------------------------------------------


def _dim(dwg, g, x1, y1, x2, y2, text: str, side: int = -1) -> None:
    """A dimension line with 45-degree ticks and extension lines."""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    if L <= 0:
        return
    nx, ny = -dy / L * side, dx / L * side  # outward normal
    ox, oy = nx * DIM_OFFSET, ny * DIM_OFFSET
    # extension lines
    for px, py in ((x1, y1), (x2, y2)):
        g.add(dwg.line((px, py), (px + ox * 1.16, py + oy * 1.16),
                       stroke=HAIR, stroke_width=0.5))
    g.add(dwg.line((x1 + ox, y1 + oy), (x2 + ox, y2 + oy),
                   stroke=INK, stroke_width=0.7))
    # ticks
    tx, ty = dx / L * 4, dy / L * 4
    for px, py in ((x1 + ox, y1 + oy), (x2 + ox, y2 + oy)):
        g.add(dwg.line((px - tx - nx * 4, py - ty - ny * 4),
                       (px + tx + nx * 4, py + ty + ny * 4),
                       stroke=INK, stroke_width=0.7))
    mx, my = (x1 + x2) / 2 + ox, (y1 + y2) / 2 + oy
    rot = math.degrees(math.atan2(dy, dx))
    if rot > 90 or rot < -90:
        rot += 180
    g.add(dwg.text(text, insert=(mx, my - 4), fill=INK,
                   font_size="8px", font_family="Helvetica, Arial, sans-serif",
                   text_anchor="middle",
                   transform=f"rotate({rot:.1f},{mx:.2f},{my:.2f})"))


# --------------------------------------------------------------------------
# the sheet
# --------------------------------------------------------------------------


def render_svg(plan: FloorPlan, req: DesignRequest, out: Path, title: str = "AURA HOMES") -> Path:
    wall_ft = plan.wall_mm / MM_PER_FT
    part_ft = plan.partition_mm / MM_PER_FT

    pw = _ft(plan.width) + MARGIN * 2 + DIM_OFFSET * 2
    ph = _ft(plan.height) + MARGIN * 2 + DIM_OFFSET * 2 + TITLE_H

    dwg = svgwrite.Drawing(str(out), size=(f"{pw:.0f}pt", f"{ph:.0f}pt"),
                           viewBox=f"0 0 {pw:.0f} {ph:.0f}")
    dwg.add(dwg.rect((0, 0), (pw, ph), fill="#ffffff"))

    ox = MARGIN + DIM_OFFSET
    oy = MARGIN + DIM_OFFSET
    g = dwg.g(transform=f"translate({ox},{oy})")

    W, H = _ft(plan.width), _ft(plan.height)
    tw = _ft(wall_ft)

    # --- structural envelope, drawn as poché: outer rect minus inner rect
    g.add(dwg.path(
        d=(f"M 0,0 H {W:.2f} V {H:.2f} H 0 Z "
           f"M {tw:.2f},{tw:.2f} H {W - tw:.2f} V {H - tw:.2f} H {tw:.2f} Z"),
        fill=POCHE, fill_rule="evenodd", stroke="none"))

    # --- interior partitions
    for r in plan.rooms:
        g.add(dwg.rect((_ft(r.x), _ft(r.y)), (_ft(r.w), _ft(r.h)),
                       fill="none", stroke=PARTITION_FILL,
                       stroke_width=max(1.2, _ft(part_ft))))

    # --- knock the openings back out of the walls, then draw them
    for r in plan.rooms:
        for o in r.openings:
            ax, ay, bx, by = _opening_span(r, o)
            g.add(dwg.line((_ft(ax), _ft(ay)), (_ft(bx), _ft(by)),
                           stroke="#ffffff",
                           stroke_width=max(2.0, _ft(wall_ft) * 1.05)))
        for o in r.openings:
            if o.kind == "window":
                _draw_window(dwg, g, r, o, wall_ft)
            else:
                _draw_door(dwg, g, r, o)

    # --- labels
    for r in plan.rooms:
        cx, cy = _ft(r.x + r.w / 2), _ft(r.y + r.h / 2)
        g.add(dwg.text(r.name.upper(), insert=(cx, cy - 3), fill=INK,
                       font_size="9px", font_family="Helvetica, Arial, sans-serif",
                       text_anchor="middle", letter_spacing="0.8"))
        g.add(dwg.text(f"{r.area:.0f} SQ FT  ·  {_fmt_ft(r.w)} x {_fmt_ft(r.h)}",
                       insert=(cx, cy + 9), fill=LABEL, font_size="6.5px",
                       font_family="Helvetica, Arial, sans-serif", text_anchor="middle"))

    # --- overall dimensions
    _dim(dwg, g, 0, 0, W, 0, _fmt_ft(plan.width), side=-1)
    _dim(dwg, g, W, 0, W, H, _fmt_ft(plan.height), side=-1)
    # --- per-room running dimensions along the top edge
    xs = sorted({round(r.x, 2) for r in plan.rooms if r.y < plan.height / 2} | {plan.width})
    for a, b in zip(xs, xs[1:]):
        if b - a > 2:
            _dim(dwg, g, _ft(a), H, _ft(b), H, _fmt_ft(b - a), side=1)

    dwg.add(g)

    # --- title block
    ty = ph - TITLE_H - MARGIN * 0.35
    dwg.add(dwg.line((MARGIN, ty), (pw - MARGIN, ty), stroke=INK, stroke_width=0.9))
    dwg.add(dwg.text(title, insert=(MARGIN, ty + 22), fill=INK, font_size="14px",
                     font_family="Helvetica, Arial, sans-serif", letter_spacing="2"))
    meta = [
        f"{req.bedrooms} BED · {req.bathrooms:g} BATH · {plan.gross_sq_ft:.0f} SQ FT GROSS",
        f"{req.material.value.replace('_', ' ').upper()} · {plan.wall_mm}mm WALL · ZONE {req.climate_zone.value}",
        f"FDWR {plan.fdwr:.1%} (NBC 9.36 prescriptive max 22%)",
        f"SCALE 1/4\" = 1'-0\"  ·  DIMENSIONS TO STRUCTURE",
    ]
    for i, m in enumerate(meta):
        dwg.add(dwg.text(m, insert=(MARGIN, ty + 40 + i * 12), fill=LABEL, font_size="8px",
                         font_family="Helvetica, Arial, sans-serif"))

    dwg.add(dwg.text(
        "REVIEW-READY DESIGN PACKAGE — NOT FOR CONSTRUCTION. "
        "A licensed Alberta residential designer completes the permit set.",
        insert=(pw - MARGIN, ty + 40), fill=ACCENT, font_size="7.5px",
        font_family="Helvetica, Arial, sans-serif", text_anchor="end"))

    # --- scale bar: five feet, ticked
    sb_x, sb_y = pw - MARGIN - _ft(5), ty + 66
    dwg.add(dwg.line((sb_x, sb_y), (sb_x + _ft(5), sb_y), stroke=INK, stroke_width=1))
    for i in range(6):
        px = sb_x + _ft(i)
        dwg.add(dwg.line((px, sb_y - 3), (px, sb_y + 3), stroke=INK, stroke_width=0.7))
    dwg.add(dwg.text("0", insert=(sb_x, sb_y + 12), fill=LABEL, font_size="6.5px",
                     font_family="Helvetica, Arial, sans-serif", text_anchor="middle"))
    dwg.add(dwg.text("5'", insert=(sb_x + _ft(5), sb_y + 12), fill=LABEL, font_size="6.5px",
                     font_family="Helvetica, Arial, sans-serif", text_anchor="middle"))

    out.parent.mkdir(parents=True, exist_ok=True)
    dwg.save()
    return out


# --------------------------------------------------------------------------
# derived formats — both degrade gracefully if the optional dep is missing
# --------------------------------------------------------------------------


def svg_to_pdf(svg_path: Path, pdf_path: Path) -> Path | None:
    """SVG -> PDF via cairosvg. Returns None if unavailable, never raises."""
    try:
        import cairosvg  # type: ignore
    except Exception:
        return None
    try:
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        cairosvg.svg2pdf(url=str(svg_path), write_to=str(pdf_path))
        return pdf_path
    except Exception:
        return None


def render_dxf(plan: FloorPlan, out: Path) -> Path | None:
    """A real DXF on proper layers, so a drafter can open it in any CAD.

    ezdxf is BSD-licensed. If it is not installed the endpoint still returns
    SVG and PDF — DXF is an enhancement, not a dependency of the product.
    """
    try:
        import ezdxf  # type: ignore
    except Exception:
        return None
    try:
        doc = ezdxf.new("R2010", setup=True)
        doc.header["$INSUNITS"] = 2  # feet
        msp = doc.modelspace()
        for name, color in (("A-WALL", 7), ("A-WALL-PRTN", 8),
                            ("A-GLAZ", 4), ("A-DOOR", 3), ("A-ANNO", 2)):
            if name not in doc.layers:
                doc.layers.add(name, color=color)

        w, h = plan.width, plan.height
        msp.add_lwpolyline([(0, 0), (w, 0), (w, h), (0, h)], close=True,
                           dxfattribs={"layer": "A-WALL"})
        for r in plan.rooms:
            msp.add_lwpolyline(
                [(r.x, r.y), (r.x + r.w, r.y), (r.x + r.w, r.y + r.h), (r.x, r.y + r.h)],
                close=True, dxfattribs={"layer": "A-WALL-PRTN"})
            msp.add_text(
                r.name, height=0.6,
                dxfattribs={"layer": "A-ANNO"},
            ).set_placement((r.x + r.w / 2, r.y + r.h / 2))
            for o in r.openings:
                ax, ay, bx, by = _opening_span(r, o)
                msp.add_line((ax, ay), (bx, by), dxfattribs={
                    "layer": "A-GLAZ" if o.kind == "window" else "A-DOOR"})
        out.parent.mkdir(parents=True, exist_ok=True)
        doc.saveas(str(out))
        return out
    except Exception:
        return None
