"""A coast Region's Flood-Prone Area for the Cache Pack: the land below a set height, traced from
the terrain."""

import math
from collections import defaultdict
from collections.abc import Callable
from typing import Any

from pack_routes import ring_contains

from storm_shield.weather_grid import BBox

# About 30 m, the size of a terrain pixel in the finest tiles, so no finer than the data.
CELL_DEGREES = 0.0003
# A patch or a pond smaller than this many cells (about 1.5 ha) is noise at this resolution and
# would only fatten the pack.
MIN_RING_CELLS = 16
# Outlines are straightened to within this many cells of the traced edge.
SIMPLIFY_CELLS = 1.0
COORDINATE_DECIMALS = 5

Vertex = tuple[int, int]  # (column, row) of a cell corner; rows count down from the north edge


def _land_below(
    elevation_at: Callable[[float, float], float], bbox: BBox, below_m: float
) -> tuple[list[list[bool]], int, int]:
    """The grid of cells whose ground lies above the sea and below `below_m`.

    Sea level is the floor because open water reads as zero or less in the terrain; the land that
    is flooded already (marsh, canals) is traced with the rest.
    """
    south, west, north, east = bbox
    rows = math.ceil((north - south) / CELL_DEGREES)
    columns = math.ceil((east - west) / CELL_DEGREES)
    grid = [
        [
            0.0
            < elevation_at(north - (row + 0.5) * CELL_DEGREES, west + (column + 0.5) * CELL_DEGREES)
            < below_m
            for column in range(columns)
        ]
        for row in range(rows)
    ]
    return grid, rows, columns


def _boundary_rings(grid: list[list[bool]], rows: int, columns: int) -> list[list[Vertex]]:
    """Every outline of the filled cells, each walked with the filled side on its right.

    An outline around land runs clockwise on a north-up map and one around a hole counter-clockwise.
    """

    def filled(row: int, column: int) -> bool:
        return 0 <= row < rows and 0 <= column < columns and grid[row][column]

    outgoing: dict[Vertex, list[Vertex]] = defaultdict(list)
    for row in range(rows):
        for column in range(columns):
            if not grid[row][column]:
                continue
            if not filled(row - 1, column):
                outgoing[(column, row)].append((column + 1, row))
            if not filled(row, column + 1):
                outgoing[(column + 1, row)].append((column + 1, row + 1))
            if not filled(row + 1, column):
                outgoing[(column + 1, row + 1)].append((column, row + 1))
            if not filled(row, column - 1):
                outgoing[(column, row + 1)].append((column, row))

    rings = []
    while outgoing:
        start = next(iter(outgoing))
        ring = [start]
        here = start
        while True:
            options = outgoing[here]
            # Two edges leave a corner where land touches itself diagonally: turn right, which
            # keeps the two pieces apart and so never crosses an outline over itself.
            came_from = ring[-2] if len(ring) > 1 else None
            if len(options) == 1 or came_from is None:
                following = options[0]
            else:
                following = _right_turn(came_from, here, options)
            options.remove(following)
            if not options:
                del outgoing[here]
            here = following
            if here == start:
                break
            ring.append(here)
        rings.append(ring)
    return rings


def _right_turn(came_from: Vertex, here: Vertex, options: list[Vertex]) -> Vertex:
    heading = (here[0] - came_from[0], here[1] - came_from[1])

    def turn(option: Vertex) -> int:
        # On screen (rows down) a positive cross product is a right turn.
        return heading[0] * (option[1] - here[1]) - heading[1] * (option[0] - here[0])

    return max(options, key=turn)


def _simplified(ring: list[Vertex]) -> list[Vertex]:
    """The ring with every vertex dropped that lies within SIMPLIFY_CELLS of the line between its
    kept neighbours (Douglas-Peucker, from the ring's two furthest-apart corners)."""
    first = ring[0]
    far = max(range(len(ring)), key=lambda i: _squared_distance(ring[i], first))
    kept = {0, far}
    pending = [(0, far), (far, len(ring))]
    while pending:
        start, end = pending.pop()
        a, b = ring[start], ring[end % len(ring)]
        worst, worst_distance = None, SIMPLIFY_CELLS
        for i in range(start + 1, end):
            distance = _distance_to_line(ring[i], a, b)
            if distance > worst_distance:
                worst, worst_distance = i, distance
        if worst is not None:
            kept.add(worst)
            pending += [(start, worst), (worst, end)]
    return [ring[i] for i in sorted(kept)]


def _squared_distance(a: Vertex, b: Vertex) -> int:
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2


def _distance_to_line(point: Vertex, a: Vertex, b: Vertex) -> float:
    length = math.dist(a, b)
    if length == 0:
        return math.dist(point, a)
    return abs((b[0] - a[0]) * (a[1] - point[1]) - (a[0] - point[0]) * (b[1] - a[1])) / length


def _area_in_cells(ring: list[Vertex]) -> float:
    """Signed: positive for a ring that runs clockwise on the map (land), negative for a hole."""
    return (
        sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1], strict=True)) / 2
    )


def trace_flood_prone_area(
    elevation_at: Callable[[float, float], float], bbox: BBox, below_m: float
) -> dict[str, Any]:
    """The GeoJSON of the land inside `bbox` that lies below `below_m` metres, from the terrain.

    One MultiPolygon feature. The terrain is approximate and the outline is straightened, so the
    map must call it approximate.
    """
    _, west, north, _ = bbox
    grid, rows, columns = _land_below(elevation_at, bbox, below_m)
    outlines: list[tuple[float, list[Vertex]]] = []
    holes: list[tuple[float, list[Vertex]]] = []
    for ring in _boundary_rings(grid, rows, columns):
        area = _area_in_cells(ring)
        if abs(area) < MIN_RING_CELLS:
            continue
        simple = _simplified(ring)
        (outlines if area > 0 else holes).append((abs(area), simple))

    def geographic(ring: list[Vertex]) -> list[list[float]]:
        points = [
            [
                round(west + column * CELL_DEGREES, COORDINATE_DECIMALS),
                round(north - row * CELL_DEGREES, COORDINATE_DECIMALS),
            ]
            for column, row in ring
        ]
        return [*points, points[0]]

    # A hole belongs to the smallest outline that contains it.
    outlines.sort(key=lambda each: each[0])
    polygons: list[list[list[list[float]]]] = [[geographic(ring)] for _, ring in outlines]
    # Compared in grid space, as closed rings of (row, column).
    outline_points = [
        [(float(row), float(column)) for column, row in [*ring, ring[0]]] for _, ring in outlines
    ]
    for _, hole in holes:
        probe = (hole[0][1], hole[0][0])
        for index, outline in enumerate(outline_points):
            if ring_contains(outline, probe):
                polygons[index].append(geographic(hole))
                break
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "approximate": True,
                    "traced_below_m": below_m,
                    "cell_degrees": CELL_DEGREES,
                },
                "geometry": {"type": "MultiPolygon", "coordinates": polygons},
            }
        ],
    }
