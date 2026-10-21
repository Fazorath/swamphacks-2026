"""The Region's basemap for the Cache Pack: water, roads and place names from OpenStreetMap."""

import json
import math
from pathlib import Path
from typing import Any

import httpx
from pack_sources import SourceFailed, is_address, read_source
from storm_shield.region import Source
from storm_shield.weather_grid import BBox

OVERPASS_TIMEOUT_SECONDS = 300
COORDINATE_DECIMALS = 4
# About 11 m: roads and shores keep their bends at the map's top zoom.
LINE_TOLERANCE_DEGREES = 0.0001
# Ways that carry through traffic; footpaths, tracks and driveways would drown a regional map.
ROAD_KINDS = "motorway|trunk|primary|secondary|tertiary|unclassified|residential"
PLACE_KINDS = "city|town|village|hamlet|suburb|island"
FILES = (
    "basemap/water.geojson",
    "basemap/waterways.geojson",
    "basemap/coastline.geojson",
    "basemap/roads.geojson",
    "basemap/places.geojson",
)

LonLat = tuple[float, float]


def simplify_line(points: list[LonLat], tolerance: float) -> list[LonLat]:
    """Douglas-Peucker: the fewest of `points` that keep the line within `tolerance` of itself."""
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    pending = [(0, len(points) - 1)]
    while pending:
        first, last = pending.pop()
        (x1, y1), (x2, y2) = points[first], points[last]
        span = math.hypot(x2 - x1, y2 - y1)
        farthest, farthest_distance = first, 0.0
        for index in range(first + 1, last):
            x, y = points[index]
            if span == 0:
                distance = math.hypot(x - x1, y - y1)
            else:
                distance = abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / span
            if distance > farthest_distance:
                farthest, farthest_distance = index, distance
        if farthest_distance > tolerance:
            keep[farthest] = True
            pending += [(first, farthest), (farthest, last)]
    return [point for point, kept in zip(points, keep, strict=True) if kept]


def overpass_query(bbox: BBox) -> str:
    south, west, north, east = bbox
    box = f"({south},{west},{north},{east})"
    return (
        f"[out:json][timeout:{OVERPASS_TIMEOUT_SECONDS}];("
        f'way["highway"~"^({ROAD_KINDS})$"]{box};'
        f'way["waterway"~"^(river|canal)$"]{box};'
        f'way["waterway"="stream"]["name"]{box};'
        f'way["natural"="coastline"]{box};'
        f'way["natural"="water"]{box};'
        f'relation["natural"="water"]{box};'
        f'node["place"~"^({PLACE_KINDS})$"]{box};'
        ");out geom tags;"
    )


def _latin_name(tags: dict[str, str]) -> str | None:
    """The English name, else the local one when it is in Latin letters; the map has no Devanagari."""
    for key in ("name:en", "int_name", "name"):
        if tags.get(key, "").isascii() and tags.get(key):
            return tags[key]
    return None


def _coordinate(lon: float, lat: float) -> list[float]:
    return [round(lon, COORDINATE_DECIMALS), round(lat, COORDINATE_DECIMALS)]


def _line(geometry: list[dict[str, float]]) -> list[list[float]]:
    points = [(vertex["lon"], vertex["lat"]) for vertex in geometry]
    return [_coordinate(lon, lat) for lon, lat in simplify_line(points, LINE_TOLERANCE_DEGREES)]


def _feature(geometry: dict[str, Any], **properties: object) -> dict[str, Any]:
    return {"type": "Feature", "properties": properties, "geometry": geometry}


def _closed_rings(ways: list[list[LonLat]]) -> list[list[LonLat]]:
    """The closed rings that `ways` make when joined end to end; ways that never close are dropped."""
    pieces = [list(way) for way in ways if len(way) >= 2]
    rings = []
    while pieces:
        ring = pieces.pop()
        extended = True
        while extended and ring[0] != ring[-1]:
            extended = False
            for index, piece in enumerate(pieces):
                if piece[0] == ring[-1]:
                    ring += piece[1:]
                elif piece[-1] == ring[-1]:
                    ring += piece[::-1][1:]
                elif piece[-1] == ring[0]:
                    ring = piece[:-1] + ring
                elif piece[0] == ring[0]:
                    ring = piece[::-1][:-1] + ring
                else:
                    continue
                pieces.pop(index)
                extended = True
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def _polygon(ring: list[LonLat]) -> dict[str, Any]:
    simplified = simplify_line(ring, LINE_TOLERANCE_DEGREES)
    return {
        "type": "Polygon",
        "coordinates": [[_coordinate(lon, lat) for lon, lat in simplified]],
    }


def basemap_from_elements(elements: list[dict[str, Any]]) -> dict[str, bytes]:
    """The pack's `basemap/` files from an Overpass answer asked for with `overpass_query`.

    Water is filled polygons; a lake with an island is drawn whole, since inner rings are not
    cut out. Sea has no polygon: the coastline is a line, and land is the map's ground.
    """
    layers: dict[str, list[dict[str, Any]]] = {name: [] for name in FILES}
    for element in elements:
        tags = element.get("tags", {})
        name = _latin_name(tags)
        if element["type"] == "node":
            point = _coordinate(element["lon"], element["lat"])
            if name is not None:
                geometry = {"type": "Point", "coordinates": point}
                layers["basemap/places.geojson"].append(
                    _feature(geometry, name=name, kind=tags["place"])
                )
        elif element["type"] == "way" and tags.get("natural") == "water":
            ring = [(vertex["lon"], vertex["lat"]) for vertex in element["geometry"]]
            for closed in _closed_rings([ring]):
                layers["basemap/water.geojson"].append(_feature(_polygon(closed), name=name))
        elif element["type"] == "way":
            geometry = {"type": "LineString", "coordinates": _line(element["geometry"])}
            if tags.get("natural") == "coastline":
                layers["basemap/coastline.geojson"].append(_feature(geometry))
            elif "waterway" in tags:
                layers["basemap/waterways.geojson"].append(
                    _feature(geometry, name=name, kind=tags["waterway"])
                )
            elif "highway" in tags:
                layers["basemap/roads.geojson"].append(
                    _feature(geometry, name=name, kind=tags["highway"])
                )
        elif element["type"] == "relation":
            outer = [
                [(vertex["lon"], vertex["lat"]) for vertex in member["geometry"]]
                for member in element.get("members", [])
                if member.get("role") == "outer" and member["type"] == "way"
            ]
            for ring in _closed_rings(outer):
                layers["basemap/water.geojson"].append(_feature(_polygon(ring), name=name))
    return {
        path: json.dumps(
            {"type": "FeatureCollection", "features": features},
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode()
        for path, features in layers.items()
    }


def fetch_basemap(
    client: httpx.Client, region_dir: Path, source: Source, bbox: BBox
) -> dict[str, bytes]:
    """The pack's `basemap/` files: asks the Overpass endpoint, or reads a saved answer.

    Raises SourceFailed when the answer cannot be read or holds nothing for the bbox.
    """
    form = {"data": overpass_query(bbox)} if is_address(source.url) else None
    answer = read_source(client, region_dir, source.url, "OpenStreetMap basemap", form)
    try:
        elements = json.loads(answer)["elements"]
    except (ValueError, KeyError, TypeError) as error:
        raise SourceFailed(f"OpenStreetMap basemap: not an Overpass answer ({error!r})") from None
    if not elements:
        raise SourceFailed("OpenStreetMap basemap: the answer holds nothing inside the bbox")
    return basemap_from_elements(elements)
