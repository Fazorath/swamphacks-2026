"""High-ground points for the Cache Pack: hand-placed spots on the hillside above the valley towns."""

import json
import math
from collections.abc import Callable
from pathlib import Path
from typing import Any

from pack_routes import FloodProneArea, Point, distance_m

# A point this close to a town is what the Evacuation Plan can offer; further is not "near".
MAX_TOWN_DISTANCE_M = 2_000
MIN_CLIMB_M = 50
# The corridor is drawn by hand and approximate, so a point must sit clear of its edge too.
CORRIDOR_MARGIN_M = 100
# Mirrors `DETOUR_FACTOR` and `WALKING_SPEED_KMH` in `dashboard/src/evacuationPlan.ts`.
DETOUR_FACTOR = 1.4
WALKING_SPEED_KMH = 4
# Sixteen directions are finer than the narrowest stretch of the corridor (300 m across).
MARGIN_DIRECTIONS = 16
METERS_PER_DEGREE_LAT = 111_320


def walk_minutes(start: Point, end: Point) -> int:
    """Whole minutes to walk the straight line plus the detour, rounded up like the plan does."""
    hours = distance_m(start, end) * DETOUR_FACTOR / 1000 / WALKING_SPEED_KMH
    return math.ceil(hours * 60)


def _near_corridor(point: Point, corridor: FloodProneArea) -> bool:
    if corridor.contains(point):
        return True
    lat, lon = point
    lon_scale = METERS_PER_DEGREE_LAT * math.cos(math.radians(lat))
    for step in range(MARGIN_DIRECTIONS):
        angle = 2 * math.pi * step / MARGIN_DIRECTIONS
        ring_point = (
            lat + math.sin(angle) * CORRIDOR_MARGIN_M / METERS_PER_DEGREE_LAT,
            lon + math.cos(angle) * CORRIDOR_MARGIN_M / lon_scale,
        )
        if corridor.contains(ring_point):
            return True
    return False


def load_high_ground(path: Path) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = json.loads(path.read_text())
    return points


def build_high_ground(
    points: list[dict[str, Any]],
    towns: list[dict[str, Any]],
    river: list[Point],
    corridor: FloodProneArea,
    elevation_at: Callable[[float, float], float],
) -> list[dict[str, Any]]:
    """The pack's `high_ground.json`: each point with its climb read from the elevation data.

    Refuses a point that sits in or beside the Flood-Prone Area, climbs too little, or has no
    town near it, so a placeholder that was typed wrongly never reaches a resident's map.
    """
    anchors = {town["name"]: (town["lat"], town["lon"]) for town in towns}
    built = []
    for each in points:
        name = each["id"]
        position: Point = (each["pos"][0], each["pos"][1])
        if each["town"] not in anchors:
            raise ValueError(f"high-ground point {name}: no key place called {each['town']}")
        town = anchors[each["town"]]
        if distance_m(town, position) > MAX_TOWN_DISTANCE_M:
            raise ValueError(
                f"high-ground point {name} is over {MAX_TOWN_DISTANCE_M} m from {each['town']}"
            )
        if _near_corridor(position, corridor):
            raise ValueError(
                f"high-ground point {name} is in or within {CORRIDOR_MARGIN_M} m of the "
                "Flood-Prone Area"
            )
        nearest_river = min(river, key=lambda vertex: distance_m(vertex, position))
        climb = round(elevation_at(*position) - elevation_at(*nearest_river))
        if climb < MIN_CLIMB_M:
            raise ValueError(
                f"high-ground point {name} is only {climb} m above the river "
                f"(least allowed: {MIN_CLIMB_M} m)"
            )
        built.append(
            {
                "id": name,
                "name": each["name"],
                "pos": each["pos"],
                "town": each["town"],
                "climb_m": climb,
                "walk_minutes": walk_minutes(town, position),
                "source": each["source"],
                "checked": each["checked"],
            }
        )
    return built
