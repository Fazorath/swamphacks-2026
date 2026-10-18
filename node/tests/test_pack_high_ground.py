from typing import Any

import pytest
from pack_high_ground import build_high_ground, walk_minutes
from pack_routes import FloodProneArea, Point

TOWN = {"name": "Syabrubesi", "lat": 28.0, "lon": 85.0}
RIVER: list[Point] = [(28.0, 84.999), (28.0, 85.001)]
# The corridor runs along the river, about 200 m north to south at this latitude.
CORRIDOR = FloodProneArea.from_geojson(
    {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [[84.99, 27.999], [85.01, 27.999], [85.01, 28.001], [84.99, 28.001]]
                        + [[84.99, 27.999]]
                    ],
                },
            }
        ],
    }
)
RIVER_HEIGHT_M = 1460.0


def elevation_at(lat: float, lon: float) -> float:
    """The river at 1,460 m and the ground rising 100 m for every 0.01 degrees north of it."""
    return RIVER_HEIGHT_M + max(0.0, (lat - 28.0) * 10_000)


def point(**changes: Any) -> dict[str, Any]:
    return {
        "id": "ridge",
        "name": "Ridge above the town",
        "pos": [28.01, 85.0],
        "town": "Syabrubesi",
        "source": "placeholder",
        "checked": "2026-10-18",
        **changes,
    }


def build(*points: dict[str, Any]) -> list[dict[str, Any]]:
    return build_high_ground(list(points), [TOWN], RIVER, CORRIDOR, elevation_at)


def test_the_climb_is_read_from_the_elevation_data_and_the_walk_from_the_town() -> None:
    [built] = build(point())

    assert built["climb_m"] == 100
    # 0.01 degrees of latitude is 1,113 m; with the 1.4 detour at 4 km/h that is 23.4 min.
    assert built["walk_minutes"] == 24
    assert built["pos"] == [28.01, 85.0]
    assert built["source"] == "placeholder"


def test_the_walk_rounds_up_like_the_plan_does() -> None:
    assert walk_minutes((28.0, 85.0), (28.01, 85.0)) == 24
    assert walk_minutes((28.0, 85.0), (28.0, 85.0)) == 0


def test_a_point_inside_the_flood_prone_area_is_refused() -> None:
    with pytest.raises(ValueError, match="in or within 100 m of the Flood-Prone Area"):
        build(point(pos=[28.0005, 85.0]))


def test_a_point_just_outside_the_corridor_edge_is_refused() -> None:
    # 50 m north of the corridor's edge (28.001): outside it, but inside the 100 m margin.
    with pytest.raises(ValueError, match="within 100 m"):
        build(point(pos=[28.00145, 85.0]))


def test_a_point_that_climbs_too_little_is_refused() -> None:
    with pytest.raises(ValueError, match="only 30 m above the river"):
        build(point(pos=[28.003, 85.0]))


def test_a_point_with_no_town_near_it_is_refused() -> None:
    with pytest.raises(ValueError, match="over 2 km from Syabrubesi"):
        build(point(pos=[28.03, 85.0]))
    with pytest.raises(ValueError, match="no key place called Nowhere"):
        build(point(town="Nowhere"))
