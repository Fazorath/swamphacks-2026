"""The Nepal map for the God's Eye View: vector layers and elevation tiles for the Cache Pack."""

import json
import math
import time
from collections.abc import Callable
from datetime import date
from typing import Any

import httpx
import pack_weather
from storm_shield.weather_grid import BBox

NEPAL_BBOX: BBox = (26.3, 80.0, 30.5, 88.3)
GEOBOUNDARIES_URL = "https://www.geoboundaries.org/api/current/gbOpen/NPL/{level}/"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
ELEVATION_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
OVERPASS_TIMEOUT_SECONDS = 300
# A lower zoom is coarser: the whole country at about 600 m a pixel, the valley at about 35 m.
NATIONAL_ZOOMS = range(5, 9)
VALLEY_ZOOMS = range(9, 13)
# Only for the elevation tiles; the vector layers are small.
ELEVATION_BUDGET_BYTES = 8_500_000
ELEVATION_DELAY_SECONDS = 0.05
COORDINATE_DECIMALS = 4
# About 160 m: rivers read as rivers at the national view and stay a few hundred kilometres of line.
RIVER_TOLERANCE_DEGREES = 0.0015
# Only to decide which ways lie in Nepal; the border that is drawn keeps the dataset's shape.
COUNTRY_TEST_TOLERANCE_DEGREES = 0.01
# An unnamed stream shorter than this is a creek, not part of the country's rivers.
MIN_UNNAMED_RIVER_KM = 12
# What OpenStreetMap calls the five rivers the story follows (lower case, without "river").
MAIN_RIVERS = {
    "Koshi": {"koshi", "sapta koshi", "sun kosi", "sun koshi", "sunkoshi", "tamakoshi"},
    "Gandaki": {"narayani", "kali gandaki", "kaligandaki", "gandak", "budhi gandaki"},
    "Karnali": {"karnali", "mugu karnali", "loti karnali"},
    "Mahakali": {"mahakali", "sharda"},
    "Bhote Koshi–Trishuli": {"bhote koshi", "trishuli ganga", "trishuli"},
}
MAIN_RIVER_OF = {name: main for main, names in MAIN_RIVERS.items() for name in names}


def simplify_line(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
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


def _inside(point: tuple[float, float], ring: list[tuple[float, float]]) -> bool:
    x, y = point
    crossings = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1], strict=True):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) / (y2 - y1) * (x2 - x1):
            crossings = not crossings
    return crossings


class Country:
    """Whether a (lon, lat) point lies in Nepal, judged on a coarse copy of the border."""

    def __init__(self, border: dict[str, Any]) -> None:
        geometry = border["features"][0]["geometry"]
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        self._rings = [
            simplify_line(
                [(lon, lat) for lon, lat in polygon[0]], COUNTRY_TEST_TOLERANCE_DEGREES
            )
            for polygon in polygons
        ]

    def contains(self, lon: float, lat: float) -> bool:
        return any(_inside((lon, lat), ring) for ring in self._rings)


def _round_ring(ring: list[list[float]]) -> list[list[float]]:
    return [[round(lon, COORDINATE_DECIMALS), round(lat, COORDINATE_DECIMALS)] for lon, lat in ring]


def _rounded(geometry: dict[str, Any]) -> dict[str, Any]:
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    rounded = [[_round_ring(ring) for ring in polygon] for polygon in polygons]
    if geometry["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": rounded[0]}
    return {"type": "MultiPolygon", "coordinates": rounded}


def _get_with_retries(request: Callable[[], httpx.Response], what: str) -> httpx.Response:
    for attempt in range(1, pack_weather.ATTEMPTS + 1):
        try:
            response = request()
            response.raise_for_status()
            return response
        except httpx.HTTPError as error:
            if attempt == pack_weather.ATTEMPTS:
                raise
            print(f"{what} attempt {attempt} failed ({error}); retrying", flush=True)
            time.sleep(pack_weather.RETRY_PAUSE_SECONDS)
    raise AssertionError("unreachable")


def fetch_boundary(client: httpx.Client, level: str) -> tuple[dict[str, Any], dict[str, str]]:
    """One geoBoundaries level (ADM0 the border, ADM2 the districts), as the dataset gives it."""
    meta = _get_with_retries(
        lambda: client.get(GEOBOUNDARIES_URL.format(level=level)), f"geoBoundaries {level}"
    ).json()
    shapes = _get_with_retries(
        lambda: client.get(meta["simplifiedGeometryGeoJSON"], follow_redirects=True),
        f"geoBoundaries {level} shapes",
    ).json()
    features = [
        {
            "type": "Feature",
            "properties": {"name": feature["properties"]["shapeName"]},
            "geometry": _rounded(feature["geometry"]),
        }
        for feature in shapes["features"]
    ]
    source = {
        "layer": "border" if level == "ADM0" else "districts",
        "name": f"geoBoundaries {level}: {meta['boundarySource']}",
        "licence": meta["boundaryLicense"],
        "url": meta["boundarySourceURL"],
        "dataset_built": meta["buildDate"],
    }
    return {"type": "FeatureCollection", "features": features}, source


def _overpass(client: httpx.Client, query: str, what: str) -> list[dict[str, Any]]:
    response = _get_with_retries(
        lambda: client.post(
            OVERPASS_URL, data={"data": query}, timeout=OVERPASS_TIMEOUT_SECONDS + 30
        ),
        what,
    )
    return list(response.json()["elements"])


def _latin_name(tags: dict[str, str]) -> str | None:
    """The English name, else the local one when it is in Latin letters; the map has no Devanagari."""
    for key in ("name:en", "int_name", "name"):
        if tags.get(key, "").isascii() and tags.get(key):
            return tags[key]
    return None


def _length_km(points: list[tuple[float, float]]) -> float:
    return sum(
        math.hypot((b[0] - a[0]) * math.cos(math.radians(a[1])), b[1] - a[1]) * 111
        for a, b in zip(points, points[1:], strict=False)
    )


def _main_river(name: str | None) -> str | None:
    if name is None:
        return None
    plain = name.lower().removesuffix(" river").removesuffix(" nadi").strip()
    return MAIN_RIVER_OF.get(plain)


def rivers_from_ways(ways: list[dict[str, Any]], country: Country) -> dict[str, Any]:
    """OpenStreetMap river ways as GeoJSON lines: those in Nepal, simplified, the main ones tagged."""
    features = []
    for way in ways:
        points = [(vertex["lon"], vertex["lat"]) for vertex in way["geometry"]]
        # First, middle and last vertex: a way that touches Nepal at one end still counts.
        if not any(country.contains(*points[index]) for index in (0, len(points) // 2, -1)):
            continue
        line = simplify_line(points, RIVER_TOLERANCE_DEGREES)
        name = _latin_name(way.get("tags", {}))
        main = _main_river(name)
        if name is None and _length_km(line) < MIN_UNNAMED_RIVER_KM:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"name": name, "main": main},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [round(lon, COORDINATE_DECIMALS), round(lat, COORDINATE_DECIMALS)]
                        for lon, lat in line
                    ],
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def places_from_nodes(nodes: list[dict[str, Any]], country: Country) -> dict[str, Any]:
    """Named OpenStreetMap places in Nepal as GeoJSON points."""
    features = []
    for node in nodes:
        tags = node.get("tags", {})
        name = _latin_name(tags)
        if name is None or not country.contains(node["lon"], node["lat"]):
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"name": name, "kind": tags["place"]},
                "geometry": {
                    "type": "Point",
                    "coordinates": [
                        round(node["lon"], COORDINATE_DECIMALS),
                        round(node["lat"], COORDINATE_DECIMALS),
                    ],
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def _box(bbox: BBox) -> str:
    return ",".join(str(value) for value in bbox)


def _json_bytes(content: dict[str, Any]) -> bytes:
    return json.dumps(content, separators=(",", ":"), ensure_ascii=False).encode()


def elevation_tile_paths(bbox: BBox, zooms: range) -> list[tuple[int, int, int]]:
    """Every (z, x, y) web-mercator tile touching `bbox`."""
    south, west, north, east = bbox
    paths = []
    for zoom in zooms:
        n = 2**zoom
        x_min, x_max = (int((lon + 180) / 360 * n) for lon in (west, east))
        y_min, y_max = (
            int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
            for lat in (north, south)
        )
        paths += [(zoom, x, y) for x in range(x_min, x_max + 1) for y in range(y_min, y_max + 1)]
    return paths


def fetch_elevation(client: httpx.Client, valley: BBox) -> dict[str, bytes]:
    """Terrarium elevation tiles: the country coarsely, the valley finely. Fails over budget."""
    wanted = elevation_tile_paths(NEPAL_BBOX, NATIONAL_ZOOMS) + elevation_tile_paths(
        valley, VALLEY_ZOOMS
    )
    tiles = {}
    for zoom, x, y in wanted:
        tiles[f"elevation/{zoom}/{x}/{y}.png"] = _get_with_retries(
            lambda: client.get(ELEVATION_URL.format(z=zoom, x=x, y=y)), f"elevation {zoom}/{x}/{y}"
        ).content
        time.sleep(ELEVATION_DELAY_SECONDS)
    total = sum(len(content) for content in tiles.values())
    if total > ELEVATION_BUDGET_BYTES:
        raise ValueError(
            f"elevation tiles are {total / 1e6:.1f} MB, over the {ELEVATION_BUDGET_BYTES / 1e6:.1f} MB budget"
        )
    return tiles


def build_nepal_bundle(
    client: httpx.Client, valley: BBox
) -> tuple[dict[str, bytes], dict[str, Any]]:
    """The Nepal files for the Cache Pack, and the `nepal` entry for its manifest."""
    border, border_source = fetch_boundary(client, "ADM0")
    districts, districts_source = fetch_boundary(client, "ADM2")
    country = Country(border)
    rivers = rivers_from_ways(
        _overpass(
            client,
            f'[out:json][timeout:{OVERPASS_TIMEOUT_SECONDS}];'
            f'way["waterway"="river"]({_box(NEPAL_BBOX)});out geom tags;',
            "OpenStreetMap rivers",
        ),
        country,
    )
    places = places_from_nodes(
        _overpass(
            client,
            f'[out:json][timeout:{OVERPASS_TIMEOUT_SECONDS}];'
            f'(node["place"~"^(city|town)$"]({_box(NEPAL_BBOX)});'
            f'node["place"~"^(village|hamlet)$"]({_box(valley)}););out tags center;',
            "OpenStreetMap places",
        ),
        country,
    )
    vectors = {
        "nepal/border.geojson": border,
        "nepal/districts.geojson": districts,
        "nepal/rivers.geojson": rivers,
        "nepal/places.geojson": places,
    }
    files = {path: _json_bytes(content) for path, content in vectors.items()}
    elevation = fetch_elevation(client, valley)
    for path, content in {**files, "elevation (all tiles)": b"".join(elevation.values())}.items():
        print(f"{path}: {len(content) / 1e6:.2f} MB", flush=True)
    checked = date.today().isoformat()
    sources = [
        {**border_source, "checked": checked},
        {**districts_source, "checked": checked},
        {
            "layer": "rivers and places",
            "name": "OpenStreetMap contributors, via the Overpass API",
            "licence": "ODbL 1.0",
            "url": "https://www.openstreetmap.org/copyright",
            "checked": checked,
        },
        {
            "layer": "elevation",
            "name": "Terrain Tiles (Terrarium) on AWS Open Data; over Nepal built from SRTM",
            "licence": "public domain (SRTM); see the Terrain Tiles attribution page",
            "url": "https://github.com/tilezen/joerd/blob/master/docs/attribution.md",
            "checked": checked,
        },
    ]
    manifest_entry = {
        "bbox": list(NEPAL_BBOX),
        "elevation": {
            "encoding": "terrarium",
            "national_zooms": [NATIONAL_ZOOMS.start, NATIONAL_ZOOMS.stop - 1],
            "valley_zooms": [VALLEY_ZOOMS.start, VALLEY_ZOOMS.stop - 1],
            "valley_bbox": list(valley),
        },
        "boundaries_note": "Boundaries are indicative",
        "sources": sources,
    }
    return {**files, **elevation}, manifest_entry
