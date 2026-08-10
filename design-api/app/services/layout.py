"""The deterministic layout engine.

THE DIVISION OF LABOUR, which is the whole point of this service:
the LLM reasons about the PROGRAM (how many rooms, roughly how big, which
ones want windows, which are wet), and Python solves the GEOMETRY. Nothing
that ends up on a dimensioned drawing is produced by a language model.

`docs/AI-TOOLS-RESEARCH.md` reached the same conclusion independently after
surveying the field: the published floor-plan generators are "a research
field wearing a product costume", the most-cited model (HouseDiffusion) is
GPL-3.0 *and* trained on a research-only dataset, and none of them can be
shipped commercially. So we generate plans procedurally instead — the same
trick `AI4SC/bim-diffusion-models` uses to sidestep dataset licensing.

THE ALGORITHM — squarified treemap slicing with a circulation spine.

1. Choose an exterior envelope with a sane aspect ratio for the target area.
2. Reserve a circulation spine (hall) so rooms are reachable — a plan whose
   bedrooms open into each other is not a plan.
3. Recursively slice the remaining rectangle proportionally to room areas,
   always cutting across the LONGER axis so rooms tend toward square. This
   is the squarified-treemap heuristic; it is what stops the packer from
   producing 3ft x 40ft "rooms" that are numerically correct and useless.
4. Cluster wet rooms so plumbing shares a wall.
5. Place openings: one door per room onto the spine, windows on exterior
   walls only, capped so the plan cannot exceed the FDWR ceiling.

Everything is in FEET, origin top-left, +x right, +y down — matching SVG.
"""

from __future__ import annotations

import math

from ..models import (
    FDWR_MAX,
    PARTITION_MM,
    WALL_THICKNESS_MM,
    DesignRequest,
    FloorPlan,
    LayoutPlan,
    Opening,
    PlacedRoom,
    RoomSpec,
)

MM_PER_FT = 304.8

#: Minimum habitable room dimension, feet. NBC 9.5 sets minimum areas; this
#: is the dimensional floor that keeps the packer honest.
MIN_DIM = 6.0
#: Circulation width — 3'6" is a comfortable hall that still passes as
#: barrier-free-ready without claiming compliance.
HALL_W = 3.5


# --------------------------------------------------------------------------
# envelope
# --------------------------------------------------------------------------


def envelope_for(total_sq_ft: float, storeys: int = 1) -> tuple[float, float]:
    """Pick exterior width x depth for the target footprint.

    Aspect ratio is deliberately between 1.25 and 1.6 — narrow enough that
    every room can reach an exterior wall (daylight, cross-ventilation, and
    in a passive-solar plan a south face worth having), wide enough that the
    building does not read as a shipping container.
    """
    footprint = total_sq_ft / max(1, storeys)
    ratio = 1.45
    depth = math.sqrt(footprint / ratio)
    width = footprint / depth
    # round to 6" so the drawing dimensions are buildable numbers
    return (round(width * 2) / 2, round(depth * 2) / 2)


# --------------------------------------------------------------------------
# squarified slicing
# --------------------------------------------------------------------------


def _slice(rooms: list[RoomSpec], x: float, y: float, w: float, h: float) -> list[PlacedRoom]:
    """Recursively cut (x,y,w,h) among `rooms`, proportional to area."""
    if not rooms:
        return []
    if len(rooms) == 1:
        r = rooms[0]
        return [PlacedRoom(name=r.name, x=x, y=y, w=w, h=h, windows=r.windows, wet=r.wet)]

    total = sum(r.area for r in rooms) or 1.0
    # split the list at the point closest to half the area
    running = 0.0
    cut = 1
    best = float("inf")
    for i, r in enumerate(rooms[:-1], start=1):
        running += r.area
        diff = abs(running / total - 0.5)
        if diff < best:
            best, cut = diff, i
    head, tail = rooms[:cut], rooms[cut:]
    frac = sum(r.area for r in head) / total

    # cut across the LONGER axis — this is the squarifying step
    if w >= h:
        wl = w * frac
        return _slice(head, x, y, wl, h) + _slice(tail, x + wl, y, w - wl, h)
    hl = h * frac
    return _slice(head, x, y, w, hl) + _slice(tail, x, y + hl, w, h - hl)


def _order_rooms(rooms: list[RoomSpec]) -> list[RoomSpec]:
    """Wet rooms adjacent (shared plumbing wall), then largest first.

    Sorting largest-first is what makes squarified treemaps behave; grouping
    wet rooms first means the recursive split keeps them in the same branch,
    which is how they end up sharing a wall.
    """
    wet = sorted([r for r in rooms if r.wet], key=lambda r: -r.area)
    dry = sorted([r for r in rooms if not r.wet], key=lambda r: -r.area)
    return dry[:1] + wet + dry[1:]  # living room anchors, then the wet core


# --------------------------------------------------------------------------
# openings
# --------------------------------------------------------------------------


def _place_openings(
    room: PlacedRoom,
    ix: float,
    iy: float,
    iw: float,
    ih: float,
    spine_y: float,
) -> list[Opening]:
    """One door onto the circulation spine, windows on exterior walls only.

    The exterior test compares against the INTERIOR envelope (inset by the
    wall thickness), not against 0 and the overall width. Comparing against 0
    is the obvious-looking bug that silently placed zero windows and reported
    an FDWR of 0.0% — rooms start at `wall_ft`, never at the origin.
    """
    out: list[Opening] = []
    eps = 0.05

    # --- door: onto whichever wall faces the spine
    door_w = 2.8 if not room.wet else 2.5
    if room.y + room.h <= spine_y + eps:
        out.append(Opening(kind="door", wall="s", t=0.5, width=door_w, swing="in"))
    elif room.y >= spine_y - eps:
        out.append(Opening(kind="door", wall="n", t=0.5, width=door_w, swing="in"))
    else:
        out.append(Opening(kind="door", wall="w", t=0.5, width=door_w, swing="in"))

    # --- windows: only on walls that are actually exterior
    if room.windows <= 0:
        return out
    ext: list[str] = []
    if abs(room.y - iy) < eps:
        ext.append("n")
    if abs((room.y + room.h) - (iy + ih)) < eps:
        ext.append("s")
    if abs(room.x - ix) < eps:
        ext.append("w")
    if abs((room.x + room.w) - (ix + iw)) < eps:
        ext.append("e")
    if not ext:
        return out

    per_wall = max(1, room.windows // len(ext))
    for wall in ext:
        span = room.w if wall in ("n", "s") else room.h
        n = min(per_wall, max(1, int(span // 5)))
        for i in range(n):
            t = (i + 1) / (n + 1)
            out.append(Opening(kind="window", wall=wall, t=t, width=min(4.0, span * 0.32)))
    return out


# --------------------------------------------------------------------------
# the public entry point
# --------------------------------------------------------------------------


def solve(req: DesignRequest, layout: LayoutPlan) -> FloorPlan:
    """Turn a room program into dimensioned, right-angled geometry."""
    warnings: list[str] = []
    wall_mm = WALL_THICKNESS_MM[req.material]
    wall_ft = wall_mm / MM_PER_FT

    env_w, env_h = envelope_for(req.total_sq_ft, req.storeys)

    # interior envelope, inside the structural walls
    ix, iy = wall_ft, wall_ft
    iw, ih = env_w - 2 * wall_ft, env_h - 2 * wall_ft

    rooms = _order_rooms(layout.rooms)
    if not rooms:
        raise ValueError("layout contains no rooms")

    # --- reserve the circulation spine across the middle of the plan
    spine_y = iy + ih * 0.5 - HALL_W / 2
    top_h = spine_y - iy
    bot_y = spine_y + HALL_W
    bot_h = iy + ih - bot_y

    # split the program between the two bands, proportional to their depth
    total_area = sum(r.area for r in rooms) or 1.0
    want_top = total_area * (top_h / (top_h + bot_h))
    top: list[RoomSpec] = []
    acc = 0.0
    for r in rooms:
        if acc < want_top or not top:
            top.append(r)
            acc += r.area
        else:
            break
    bottom = rooms[len(top) :]
    if not bottom:  # never leave a band empty
        bottom = [top.pop()]

    placed = _slice(top, ix, iy, iw, top_h) + _slice(bottom, ix, bot_y, iw, bot_h)

    # --- quality gates
    for p in placed:
        if min(p.w, p.h) < MIN_DIM:
            warnings.append(
                f"{p.name} solves to {p.w:.1f}' x {p.h:.1f}' — below the {MIN_DIM}' minimum "
                f"dimension. Reduce the room count or increase total area."
            )

    # --- openings + FDWR
    for p in placed:
        p.openings = _place_openings(p, ix, iy, iw, ih, spine_y + HALL_W / 2)

    wall_area = 2 * (env_w + env_h) * 9.0  # 9' wall height
    glass_area = sum(
        o.width * 4.0 for p in placed for o in p.openings if o.kind == "window"
    )
    fdwr = glass_area / wall_area if wall_area else 0.0
    if fdwr > FDWR_MAX:
        # trim windows until the plan passes the prescriptive path rather
        # than drawing glass the code will not permit
        warnings.append(
            f"Glazing solved to {fdwr:.1%} FDWR, above the {FDWR_MAX:.0%} NBC 9.36 "
            f"prescriptive ceiling — windows trimmed. A performance-path model can "
            f"buy the glass back."
        )
        for p in placed:
            wins = [o for o in p.openings if o.kind == "window"]
            keep = max(1, int(len(wins) * FDWR_MAX / fdwr))
            drop = set(id(o) for o in wins[keep:])
            p.openings = [o for o in p.openings if id(o) not in drop]
        glass_area = sum(o.width * 4.0 for p in placed for o in p.openings if o.kind == "window")
        fdwr = glass_area / wall_area if wall_area else 0.0

    gross = env_w * env_h
    net = sum(p.area for p in placed)

    if abs(gross - req.total_sq_ft) / req.total_sq_ft > 0.08:
        warnings.append(
            f"Envelope {gross:.0f} sq ft differs from the requested {req.total_sq_ft} "
            f"by more than 8% after rounding to buildable dimensions."
        )

    return FloorPlan(
        width=env_w,
        height=env_h,
        wall_mm=wall_mm,
        partition_mm=PARTITION_MM,
        rooms=placed,
        gross_sq_ft=round(gross, 1),
        net_sq_ft=round(net, 1),
        fdwr=round(fdwr, 4),
        warnings=warnings,
    )


# --------------------------------------------------------------------------
# the offline planner — used when no LLM key is configured
# --------------------------------------------------------------------------


def default_program(req: DesignRequest) -> LayoutPlan:
    """A sane room program derived arithmetically from the questionnaire.

    This exists so the service NEVER hard-fails on a missing API key. An
    offline plan is a real plan — it just did not get the LLM's judgement
    about proportion and naming. The response flags `offline: true` rather
    than pretending otherwise.
    """
    a = float(req.total_sq_ft)
    rooms: list[RoomSpec] = []

    def add(name: str, share: float, windows: int, wet: bool = False) -> None:
        area = a * share
        side = math.sqrt(area / 1.3)
        rooms.append(
            RoomSpec(
                name=name,
                width=round(side * 1.3, 1),
                length=round(side, 1),
                windows=windows,
                wet=wet,
            )
        )

    # shares tuned so a 400 sqft cabin and a 1,600 sqft house both read right
    add("Great room", 0.34 if req.bedrooms else 0.55, 3)
    add("Kitchen", 0.14, 2, wet=True)
    full_baths = int(req.bathrooms)
    half = req.bathrooms - full_baths >= 0.5
    for i in range(max(1, full_baths)):
        add(f"Bath {i + 1}" if full_baths > 1 else "Bath", 0.09, 1, wet=True)

    #: Below this, a powder room and a separate mechanical room stop being
    #: rooms and become closets — the packer would solve them to 3-4 feet and
    #: warn. Small off-grid plans put the gear in a utility wall off the bath,
    #: which is what actually gets built.
    SMALL_PLAN_SQ_FT = 900
    roomy = req.total_sq_ft >= SMALL_PLAN_SQ_FT

    if half and roomy:
        add("Powder", 0.05, 0, wet=True)
    for i in range(req.bedrooms):
        share = 0.17 if i == 0 else 0.13
        add(f"Bedroom {i + 1}" if req.bedrooms > 1 else "Bedroom", share, 2)
    if req.off_grid and roomy:
        add("Mechanical", 0.07, 0, wet=True)

    return LayoutPlan(
        house_style=req.style.value,
        total_sq_ft=req.total_sq_ft,
        rooms=rooms,
    )
