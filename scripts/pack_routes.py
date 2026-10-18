"""Driving Routes for the Cache Pack: the shortest drive from a grid of points to every Shelter."""

import heapq
import math
from collections import defaultdict
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from itertools import pairwise
from typing import Any

Point = tuple[float, float]  # (lat, lon)
BBox = tuple[float, float, float, float]  # (south, west, north, east)
Routes = dict[str, dict[str, list[list[float]]]]  # file path -> Shelter id -> [[lat, lon], ...]

COORDINATE_DECIMALS = 5
METERS_PER_DEGREE_LAT = 111_320
MAX_GRID_POINT_TO_ROAD_M = 100
MAX_SHELTER_TO_ROAD_M = 500
# A route only has to be drawn, so vertices closer than this to the line they sit on are dropped.
SIMPLIFY_TOLERANCE_M = 3
# Finer than half the narrowest stretch of the corridor (300 m across), so no crossing slips between.
SEGMENT_SAMPLE_M = 40

class FloodProneArea:
    """The mapped corridor a Route must not cross, as polygons of (lat, lon) rings."""

    def __init__(self, polygons: list[list[list[Point]]]) -> None:
        self._polygons = [
            (rings, _bounds_of(rings[0])) for rings in polygons if rings and rings[0]
        ]

    @classmethod
    def from_geojson(cls, collection: dict[str, Any]) -> "FloodProneArea":
        polygons = []
        for feature in collection["features"]:
            geometry = feature["geometry"]
            parts = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [
                geometry["coordinates"]
            ]
            polygons += [
                [[(lat, lon) for lon, lat in ring] for ring in rings] for rings in parts
            ]
        return cls(polygons)

    def contains(self, point: Point) -> bool:
        for rings, (south, west, north, east) in self._polygons:
            if south <= point[0] <= north and west <= point[1] <= east:
                # Even-odd over the outline and its holes.
                if sum(_ring_contains(ring, point) for ring in rings) % 2 == 1:
                    return True
        return False

    def touches_segment(self, start: Point, end: Point) -> bool:
        """Whether the straight stretch from `start` to `end` passes through the area.

        Sampled every `SEGMENT_SAMPLE_M`, which is well under the corridor's width, so a bridge
        between two road nodes that both lie outside it is still caught.
        """
        steps = max(1, math.ceil(distance_m(start, end) / SEGMENT_SAMPLE_M))
        return any(
            self.contains(
                (
                    start[0] + (end[0] - start[0]) * step / steps,
                    start[1] + (end[1] - start[1]) * step / steps,
                )
            )
            for step in range(steps + 1)
        )


def _bounds_of(ring: list[Point]) -> BBox:
    lats = [lat for lat, _ in ring]
    lons = [lon for _, lon in ring]
    return min(lats), min(lons), max(lats), max(lons)


def _ring_contains(ring: list[Point], point: Point) -> bool:
    lat, lon = point
    inside = False
    for (lat_a, lon_a), (lat_b, lon_b) in pairwise(ring):
        if (lat_a > lat) != (lat_b > lat):
            crossing_lon = lon_a + (lat - lat_a) / (lat_b - lat_a) * (lon_b - lon_a)
            if lon < crossing_lon:
                inside = not inside
    return inside


def crosses(was_inside: list[bool]) -> bool:
    """Whether a journey, given as inside/outside along its way, goes back in after being out."""
    seen_outside = False
    for inside in was_inside:
        if inside and seen_outside:
            return True
        seen_outside = seen_outside or not inside
    return False


@dataclass(frozen=True)
class RouteGrid:
    """Evenly spaced Grid points. `cell_of` is mirrored by the dashboard (`routeGrid.ts`)."""

    south: float
    west: float
    lat_step: float
    lon_step: float

    @classmethod
    def spaced(cls, bbox: BBox, spacing_m: float) -> "RouteGrid":
        south, west, north, east = bbox
        middle_lat = (south + north) / 2
        return cls(
            south=south,
            west=west,
            lat_step=spacing_m / METERS_PER_DEGREE_LAT,
            lon_step=spacing_m / (METERS_PER_DEGREE_LAT * math.cos(math.radians(middle_lat))),
        )

    def cell_of(self, point: Point) -> tuple[int, int]:
        lat, lon = point
        return (
            math.floor((lon - self.west) / self.lon_step + 0.5),
            math.floor((lat - self.south) / self.lat_step + 0.5),
        )

    def point_of(self, gx: int, gy: int) -> Point:
        return (self.south + gy * self.lat_step, self.west + gx * self.lon_step)

    def cells_in(self, bbox: BBox) -> Iterator[tuple[int, int]]:
        south, west, north, east = bbox
        gx_min, gy_min = self.cell_of((south, west))
        gx_max, gy_max = self.cell_of((north, east))
        for gx in range(gx_min, gx_max + 1):
            for gy in range(gy_min, gy_max + 1):
                yield gx, gy

    def as_manifest_entry(self) -> dict[str, float]:
        return {
            "south": self.south,
            "west": self.west,
            "lat_step": self.lat_step,
            "lon_step": self.lon_step,
        }


def distance_m(a: Point, b: Point) -> float:
    mean_lat = math.radians((a[0] + b[0]) / 2)
    north = (b[0] - a[0]) * METERS_PER_DEGREE_LAT
    east = (b[1] - a[1]) * METERS_PER_DEGREE_LAT * math.cos(mean_lat)
    return math.hypot(north, east)


class Roads:
    """Drivable roads: OSM-style nodes joined by segments, each two-way unless marked one-way."""

    def __init__(
        self, coords: dict[int, Point], segments: Iterable[tuple[int, int, bool]]
    ) -> None:
        self.coords = coords
        self.segments = list(segments)
        # The arcs that end at each node, because routes are searched backwards from a Shelter.
        self._arcs_into: dict[int, list[tuple[int, float]]] = defaultdict(list)
        for start, end, one_way in self.segments:
            length = distance_m(coords[start], coords[end])
            self._arcs_into[end].append((start, length))
            if not one_way:
                self._arcs_into[start].append((end, length))
        self._buckets: dict[tuple[int, int], list[int]] = defaultdict(list)
        for node, point in coords.items():
            self._buckets[self._bucket_of(point)].append(node)

    @staticmethod
    def _bucket_of(point: Point) -> tuple[int, int]:
        # Cells of about 110 m; the lookup widens by whole rings of them.
        return math.floor(point[0] * 1000), math.floor(point[1] * 1000)

    def nearest_node(self, point: Point, within_m: float) -> int | None:
        """The road node closest to `point`, or None if none lies within `within_m`."""
        centre_x, centre_y = self._bucket_of(point)
        reach = math.ceil(within_m / 100) + 1
        best: tuple[float, int] | None = None
        for x in range(centre_x - reach, centre_x + reach + 1):
            for y in range(centre_y - reach, centre_y + reach + 1):
                for node in self._buckets.get((x, y), ()):
                    candidate = (distance_m(point, self.coords[node]), node)
                    if best is None or candidate < best:
                        best = candidate
        return best[1] if best is not None and best[0] <= within_m else None

    def next_hops_toward(self, target: int) -> dict[int, int]:
        """For every node that can reach `target`, the next node on its shortest drive there."""
        distance = {target: 0.0}
        next_hop: dict[int, int] = {}
        queue = [(0.0, target)]
        while queue:
            settled, node = heapq.heappop(queue)
            if settled > distance[node]:
                continue
            for before, length in self._arcs_into[node]:
                total = settled + length
                if total < distance.get(before, math.inf):
                    distance[before] = total
                    next_hop[before] = node
                    heapq.heappush(queue, (total, before))
        return next_hop


def simplify(line: list[Point]) -> list[Point]:
    """Douglas-Peucker, keeping both ends."""
    if len(line) < 3:
        return line
    keep = [False] * len(line)
    keep[0] = keep[-1] = True
    pending = [(0, len(line) - 1)]
    while pending:
        first, last = pending.pop()
        farthest, farthest_m = first, 0.0
        for index in range(first + 1, last):
            off_line = _distance_to_segment_m(line[index], line[first], line[last])
            if off_line > farthest_m:
                farthest, farthest_m = index, off_line
        if farthest_m > SIMPLIFY_TOLERANCE_M:
            keep[farthest] = True
            pending += [(first, farthest), (farthest, last)]
    return [point for point, kept in zip(line, keep, strict=True) if kept]


def _distance_to_segment_m(point: Point, start: Point, end: Point) -> float:
    cos_lat = math.cos(math.radians(point[0]))

    def metres(p: Point) -> Point:
        return (p[0] * METERS_PER_DEGREE_LAT, p[1] * METERS_PER_DEGREE_LAT * cos_lat)

    (px, py), (sx, sy), (ex, ey) = metres(point), metres(start), metres(end)
    dx, dy = ex - sx, ey - sy
    length_squared = dx * dx + dy * dy
    if length_squared == 0:
        return math.hypot(px - sx, py - sy)
    along = max(0.0, min(1.0, ((px - sx) * dx + (py - sy) * dy) / length_squared))
    return math.hypot(px - (sx + along * dx), py - (sy + along * dy))


def build_routes(
    roads: Roads,
    shelters: dict[str, Point],
    grid: RouteGrid,
    bbox: BBox,
    avoid: FloodProneArea | None = None,
) -> Routes:
    """One file per Grid point that has a road within reach and can reach at least one Shelter.

    A Route that crosses `avoid` is left out: it starts inside the area at worst (a riverside home
    has to walk out) but never goes back in once it is out, and the plan falls back to the
    straight line for that Shelter.
    """
    grid_points: dict[tuple[int, int], int] = {}
    for gx, gy in grid.cells_in(bbox):
        node = roads.nearest_node(grid.point_of(gx, gy), MAX_GRID_POINT_TO_ROAD_M)
        if node is not None:
            grid_points[(gx, gy)] = node

    node_inside: dict[int, bool] = {}
    stretch_inside: dict[tuple[int, int], bool] = {}

    def inside(node: int) -> bool:
        if node not in node_inside:
            node_inside[node] = avoid is not None and avoid.contains(roads.coords[node])
        return node_inside[node]

    def stretch_touches(before: int, after: int) -> bool:
        if (before, after) not in stretch_inside:
            stretch_inside[(before, after)] = avoid is not None and avoid.touches_segment(
                roads.coords[before], roads.coords[after]
            )
        return stretch_inside[(before, after)]

    routes: Routes = {}
    for shelter_id, shelter_pos in shelters.items():
        shelter_node = roads.nearest_node(shelter_pos, MAX_SHELTER_TO_ROAD_M)
        if shelter_node is None:
            raise ValueError(f"Shelter {shelter_id} has no road within {MAX_SHELTER_TO_ROAD_M} m")
        next_hop = roads.next_hops_toward(shelter_node)
        for (gx, gy), start in grid_points.items():
            if start != shelter_node and start not in next_hop:
                continue
            origin = grid.point_of(gx, gy)
            line = [origin]
            was_inside = [avoid is not None and avoid.contains(origin)]
            previous = node = start
            while True:
                line.append(roads.coords[node])
                was_inside += [stretch_touches(previous, node), inside(node)]
                if node == shelter_node:
                    break
                previous, node = node, next_hop[node]
            line.append(shelter_pos)
            if avoid is not None and crosses(was_inside):
                continue
            polyline = [
                [round(lat, COORDINATE_DECIMALS), round(lon, COORDINATE_DECIMALS)]
                for lat, lon in simplify(line)
            ]
            routes.setdefault(f"routes/{gx}_{gy}.json", {})[shelter_id] = polyline
    return routes


def build_road_graph(roads: Roads, keep_near: Iterable[Point]) -> dict[str, list[Any]]:
    """The roads as junctions joined by segments, for rerouting on a phone.

    Bends are folded into the segment they sit on, so the file stays small. A road node nearest
    one of `keep_near` (the Shelters) is kept as a junction so the phone can start from it.
    Every segment is two-way: a resident in a hurry ignores one-way rules.
    """
    neighbours: dict[int, set[int]] = defaultdict(set)
    for start, end, _ in roads.segments:
        if start != end:
            neighbours[start].add(end)
            neighbours[end].add(start)
    junctions = {node for node, around in neighbours.items() if len(around) != 2}
    for point in keep_near:
        node = roads.nearest_node(point, MAX_SHELTER_TO_ROAD_M)
        if node is not None and node in neighbours:
            junctions.add(node)

    index_of: dict[int, int] = {}
    nodes: list[list[float]] = []

    def index(node: int) -> int:
        if node not in index_of:
            index_of[node] = len(nodes)
            lat, lon = roads.coords[node]
            nodes.append([round(lat, COORDINATE_DECIMALS), round(lon, COORDINATE_DECIMALS)])
        return index_of[node]

    edges: list[list[Any]] = []
    for junction in sorted(junctions):
        for first in sorted(neighbours[junction]):
            chain = [junction]
            before, here = junction, first
            while here not in junctions:
                chain.append(here)
                (after,) = neighbours[here] - {before}
                before, here = here, after
            # Each segment is found from both ends; keep the one found from the lower end.
            if here <= junction:
                continue
            points = [roads.coords[node] for node in [*chain, here]]
            length = sum(distance_m(a, b) for a, b in pairwise(points))
            bends = [
                [round(lat, COORDINATE_DECIMALS), round(lon, COORDINATE_DECIMALS)]
                for lat, lon in simplify(points)[1:-1]
            ]
            edge: list[Any] = [index(junction), index(here), round(length)]
            if bends:
                edge.append(bends)
            edges.append(edge)
    return {"nodes": nodes, "edges": edges}
