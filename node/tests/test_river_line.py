import pytest

from storm_shield.community_reading import Position
from storm_shield.river_line import river_km_at

RIVER = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"km": [10.0, 12.0, 14.0]},
            "geometry": {
                "type": "LineString",
                "coordinates": [[85.0, 28.0], [85.0, 28.01], [85.0, 28.02]],
            },
        }
    ],
}


def test_a_spot_on_the_river_gets_the_km_between_its_vertices() -> None:
    assert river_km_at(RIVER, Position(28.005, 85.0)) == pytest.approx(11.0)
    assert river_km_at(RIVER, Position(28.015, 85.0)) == pytest.approx(13.0)


def test_a_spot_beside_the_river_gets_the_km_of_its_nearest_point() -> None:
    # About 90 m east of the vertex at 28.01.
    assert river_km_at(RIVER, Position(28.01, 85.001)) == pytest.approx(12.0)


def test_a_spot_past_the_end_of_the_river_gets_the_end_km() -> None:
    assert river_km_at(RIVER, Position(28.0201, 85.0)) == pytest.approx(14.0)


def test_a_spot_farther_than_the_reach_is_on_higher_ground() -> None:
    # About 1 km east.
    assert river_km_at(RIVER, Position(28.01, 85.01)) is None
