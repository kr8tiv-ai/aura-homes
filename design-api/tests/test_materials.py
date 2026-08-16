"""BQ02 parity contracts for design-derived glazing and door quantities."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.eco import EcoMaterial, EcoSystems
from app.materials import build
from app.routers_design import bom_for


def _bom(*, glazing_sq_ft: float, window_count: int, door_count: int):
    return build(
        width_ft=34,
        depth_ft=23.5,
        gross_sq_ft=799,
        window_count=window_count,
        glazing_sq_ft=glazing_sq_ft,
        door_count=door_count,
        material=EcoMaterial.SIP,
        systems=EcoSystems(),
        storeys=1,
    )


def _line(bom, key: str):
    matches = [item for item in bom.items if item.key == key]
    if len(matches) != 1:
        raise AssertionError(f'expected one "{key}" line, found {len(matches)}')
    return matches[0]


class MaterialsBudgetParityTests(unittest.TestCase):
    def test_glazing_uses_measured_area_not_opening_count(self) -> None:
        casement = _line(_bom(glazing_sq_ft=16, window_count=1, door_count=1), "windows")
        wall = _line(_bom(glazing_sq_ft=306, window_count=1, door_count=1), "windows")
        split = _line(_bom(glazing_sq_ft=306, window_count=4, door_count=1), "windows")

        self.assertEqual(wall.unit, "sq ft glazing")
        self.assertAlmostEqual(wall.cad_mid / casement.cad_mid, 306 / 16)
        self.assertEqual(split.cad_mid, wall.cad_mid)
        self.assertEqual((wall.cad_low, wall.cad_mid, wall.cad_high),
                         (17212.5, 25818.75, 34425.0))
        self.assertIn("reference-size planning proxy", wall.basis)
        self.assertIn("not a supplier quote", wall.basis)
        self.assertIn("2026-08", wall.basis)

    def test_doors_use_the_design_count_and_preserve_the_old_two_door_band(self) -> None:
        single = _line(_bom(glazing_sq_ft=16, window_count=1, door_count=1), "doors")
        pair = _line(_bom(glazing_sq_ft=16, window_count=1, door_count=2), "doors")
        triple = _line(_bom(glazing_sq_ft=16, window_count=1, door_count=3), "doors")
        none = _line(_bom(glazing_sq_ft=16, window_count=1, door_count=0), "doors")

        self.assertEqual(single.qty, 1)
        self.assertEqual(triple.qty, 3)
        self.assertEqual((pair.cad_low, pair.cad_mid, pair.cad_high), (1400, 2200, 3200))
        self.assertEqual(none.qty, 1)
        self.assertIn("draws none", none.basis)

        legacy = build(
            width_ft=34,
            depth_ft=23.5,
            gross_sq_ft=799,
            window_count=1,
            glazing_sq_ft=16,
            material=EcoMaterial.SIP,
            systems=EcoSystems(),
        )
        legacy_doors = _line(legacy, "doors")
        self.assertEqual(legacy_doors.qty, 2)
        self.assertIn("unavailable to this legacy caller", legacy_doors.basis)

    def test_router_passes_the_solved_plan_door_count_to_the_budget(self) -> None:
        openings = [
            SimpleNamespace(kind="window", width=4.0),
            SimpleNamespace(kind="door", width=3.0),
            SimpleNamespace(kind="door", width=3.0),
        ]
        plan = SimpleNamespace(
            width=34.0,
            height=23.5,
            gross_sq_ft=799.0,
            rooms=[SimpleNamespace(openings=openings)],
        )
        request = SimpleNamespace(material=EcoMaterial.SIP, systems=EcoSystems(), storeys=1)
        expected = object()

        with patch("app.routers_design.build_bom", return_value=expected) as build_bom:
            self.assertIs(bom_for(request, plan), expected)

        self.assertEqual(build_bom.call_args.kwargs["window_count"], 1)
        self.assertEqual(build_bom.call_args.kwargs["glazing_sq_ft"], 16.0)
        self.assertEqual(build_bom.call_args.kwargs["door_count"], 2)


if __name__ == "__main__":
    unittest.main()
