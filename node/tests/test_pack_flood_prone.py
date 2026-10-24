"""Tracing a coast Region's Flood-Prone Area from terrain heights."""

from typing import Any

from pack_flood_prone import CELL_DEGREES, trace_flood_prone_area
from pack_routes import FloodProneArea, Point

CELLS = 100
BBOX = (0.0, 0.0, CELLS * CELL_DEGREES, CELLS * CELL_DEGREES)
BELOW_M = 2.0
LOW_M = 1.0
HIGH_M = 20.0
SEA_M = 0.0


def _at(row: int, column: int) -> Point:
    """The centre of a cell, counting rows down from the north edge."""
    return (BBOX[2] - (row + 0.5) * CELL_DEGREES, (column + 0.5) * CELL_DEGREES)


def _trace(
    cell_heights: dict[tuple[int, int], float], default: float = LOW_M
) -> tuple[dict[str, Any], FloodProneArea]:
    """The traced GeoJSON and area of a coast whose cells are `default` metres high except where
    `cell_heights` says otherwise."""

    def elevation_at(lat: float, lon: float) -> float:
        row = int((BBOX[2] - lat) / CELL_DEGREES)
        column = int(lon / CELL_DEGREES)
        return cell_heights.get((row, column), default)

    collection = trace_flood_prone_area(elevation_at, BBOX, BELOW_M)
    return collection, FloodProneArea.from_geojson(collection)


def _block(
    first_row: int, first_column: int, size: int, metres: float
) -> dict[tuple[int, int], float]:
    return {
        (row, column): metres
        for row in range(first_row, first_row + size)
        for column in range(first_column, first_column + size)
    }


def test_land_below_the_height_is_traced_and_higher_land_and_the_sea_are_not() -> None:
    heights = {
        **{(row, column): HIGH_M for row in range(CELLS) for column in range(60, CELLS)},
        **{(row, column): SEA_M for row in range(CELLS) for column in range(20)},
    }
    collection, area = _trace(heights)

    assert collection["features"][0]["properties"]["approximate"] is True
    assert area.contains(_at(50, 40))
    assert not area.contains(_at(50, 80))
    assert not area.contains(_at(50, 5))


def test_a_hill_inside_the_low_land_is_cut_out() -> None:
    collection, area = _trace(_block(40, 40, 10, HIGH_M))

    [polygon] = collection["features"][0]["geometry"]["coordinates"]
    assert len(polygon) == 2  # the outline and one hole
    assert area.contains(_at(20, 20))
    assert not area.contains(_at(45, 45))


def test_a_patch_too_small_to_show_is_left_out_and_a_small_hole_is_filled() -> None:
    _, high_land = _trace(_block(10, 10, 2, LOW_M), default=HIGH_M)
    collection, low_land = _trace(_block(40, 40, 2, HIGH_M))

    assert not high_land.contains(_at(10, 10))
    assert low_land.contains(_at(40, 40))
    assert len(collection["features"][0]["geometry"]["coordinates"][0]) == 1


def test_land_touching_only_at_a_corner_stays_two_pieces() -> None:
    heights = {**_block(20, 20, 5, LOW_M), **_block(25, 25, 5, LOW_M)}
    collection, area = _trace(heights, default=HIGH_M)

    assert len(collection["features"][0]["geometry"]["coordinates"]) == 2
    assert area.contains(_at(22, 22))
    assert area.contains(_at(27, 27))
    assert not area.contains(_at(22, 27))
    assert not area.contains(_at(27, 22))
