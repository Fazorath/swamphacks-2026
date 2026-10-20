"""The Nepal map for the God's Eye View: vector layers and elevation tiles for the Cache Pack."""

import json
import math
import struct
import time
import zlib
from datetime import date
from functools import partial
from pathlib import Path
from typing import Any

import httpx
from http_retry import get_with_retries
from pack_routes import ring_contains
from storm_shield.weather_grid import NEPAL_BBOX, BBox

# The Kathmandu valley, drawn as finely as the demo valley because the capital is a labelled place.
KATHMANDU_BBOX: BBox = (27.6, 85.2, 27.8, 85.5)
GEOBOUNDARIES_URL = "https://www.geoboundaries.org/api/current/gbOpen/NPL/{level}/"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
ELEVATION_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
OVERPASS_TIMEOUT_SECONDS = 300
# A lower zoom is coarser: the whole country at about 600 m a pixel, the detail areas at about 35 m.
NATIONAL_ZOOMS = range(5, 9)
DETAIL_ZOOMS = range(9, 13)
# Only for the elevation tiles (PNGs do not compress); the vector layers are small.
ELEVATION_BUDGET_BYTES = 10_000_000
ELEVATION_DELAY_SECONDS = 0.05
COORDINATE_DECIMALS = 4
# About 55 m: a river still follows its bends at the valley's top zoom.
RIVER_TOLERANCE_DEGREES = 0.0005
# Only to decide which ways lie in Nepal; the border that is drawn keeps the dataset's shape.
COUNTRY_TEST_TOLERANCE_DEGREES = 0.01
# An unnamed stream shorter than this is a creek, not part of the country's rivers.
MIN_UNNAMED_RIVER_KM = 12
# What OpenStreetMap calls each main stem the story follows (lower case, without "river").
# Tributaries such as the Tamakoshi, Budhi Gandaki and Mugu Karnali are left out on purpose.
MAIN_RIVERS = {
    "Koshi": {"koshi", "sapta koshi", "sun kosi", "sun koshi", "sunkoshi"},
    "Gandaki": {"narayani", "kali gandaki", "kaligandaki", "gandak"},
    "Karnali": {"karnali"},
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


def _polygons(geometry: dict[str, Any]) -> list[list[list[list[float]]]]:
    """The polygons of a Polygon or MultiPolygon geometry."""
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    return list(geometry["coordinates"])


def _point(lon: float, lat: float) -> list[float]:
    return [round(lon, COORDINATE_DECIMALS), round(lat, COORDINATE_DECIMALS)]


class Country:
    """Whether a (lon, lat) point lies in Nepal, judged on a coarse copy of the border."""

    def __init__(self, border: dict[str, Any]) -> None:
        self._rings = [
            [
                (lat, lon)
                for lon, lat in simplify_line(
                    [(lon, lat) for lon, lat in polygon[0]], COUNTRY_TEST_TOLERANCE_DEGREES
                )
            ]
            for polygon in _polygons(border["features"][0]["geometry"])
        ]

    def contains(self, lon: float, lat: float) -> bool:
        return any(ring_contains(ring, (lat, lon)) for ring in self._rings)


def _rounded(geometry: dict[str, Any]) -> dict[str, Any]:
    polygons = [[[_point(lon, lat) for lon, lat in ring] for ring in p] for p in _polygons(geometry)]
    if geometry["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": polygons[0]}
    return {"type": "MultiPolygon", "coordinates": polygons}


def fetch_boundary(client: httpx.Client, level: str) -> tuple[dict[str, Any], dict[str, str]]:
    """One geoBoundaries level (ADM0 the border, ADM2 the districts), as the dataset gives it."""
    meta = get_with_retries(
        partial(client.get, GEOBOUNDARIES_URL.format(level=level)), f"geoBoundaries {level}"
    ).json()
    shapes = get_with_retries(
        partial(client.get, meta["simplifiedGeometryGeoJSON"], follow_redirects=True),
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
    response = get_with_retries(
        partial(
            client.post,
            OVERPASS_URL,
            data={"data": query},
            timeout=OVERPASS_TIMEOUT_SECONDS + 30,
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
        # Tested before simplifying, which can leave only the two ends of a straight crossing.
        # Every tenth vertex is enough to find a river that crosses a corner of Nepal.
        if not any(country.contains(lon, lat) for lon, lat in points[::10] + points[-1:]):
            continue
        line = simplify_line(points, RIVER_TOLERANCE_DEGREES)
        name = _latin_name(way.get("tags", {}))
        if name is None and _length_km(line) < MIN_UNNAMED_RIVER_KM:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {"name": name, "main": _main_river(name)},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [_point(lon, lat) for lon, lat in line],
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
                "geometry": {"type": "Point", "coordinates": _point(node["lon"], node["lat"])},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def load_key_places(path: Path) -> list[dict[str, Any]]:
    """The hand-written places the map always labels, with the published height each is checked on."""
    return list(json.loads(path.read_text()))


def with_key_places(places: dict[str, Any], key_places: list[dict[str, Any]]) -> dict[str, Any]:
    """`places` with each key place marked `key: true`, replacing any OpenStreetMap copy by name."""
    key_names = {place["name"] for place in key_places}
    kept = [f for f in places["features"] if f["properties"]["name"] not in key_names]
    marked = [
        {
            "type": "Feature",
            "properties": {"name": place["name"], "kind": place["kind"], "key": True},
            "geometry": {"type": "Point", "coordinates": _point(place["lon"], place["lat"])},
        }
        for place in key_places
    ]
    return {"type": "FeatureCollection", "features": kept + marked}


def _box(bbox: BBox) -> str:
    return ",".join(str(value) for value in bbox)


def _json_bytes(content: dict[str, Any]) -> bytes:
    return json.dumps(content, separators=(",", ":"), ensure_ascii=False).encode()


def tile_position(lat: float, lon: float, zoom: int) -> tuple[float, float]:
    """The point's place on the zoom's tile grid; the integer part is the tile, the rest is inside it."""
    n = 2**zoom
    return (
        (lon + 180) / 360 * n,
        (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n,
    )


def tiles_covering(bbox: BBox, zooms: range) -> list[tuple[int, int, int]]:
    """Every (z, x, y) web-mercator tile touching `bbox`."""
    south, west, north, east = bbox
    tiles = []
    for zoom in zooms:
        x_min, y_max = (int(value) for value in tile_position(south, west, zoom))
        x_max, y_min = (int(value) for value in tile_position(north, east, zoom))
        tiles += [(zoom, x, y) for x in range(x_min, x_max + 1) for y in range(y_min, y_max + 1)]
    return tiles


def fetch_elevation(client: httpx.Client, detail_areas: list[BBox]) -> dict[str, bytes]:
    """Terrarium elevation tiles: the country coarsely, each detail area finely. Fails over budget."""
    wanted = set(tiles_covering(NEPAL_BBOX, NATIONAL_ZOOMS))
    for area in detail_areas:
        wanted.update(tiles_covering(area, DETAIL_ZOOMS))
    tiles = {}
    for zoom, x, y in sorted(wanted):
        url = ELEVATION_URL.format(z=zoom, x=x, y=y)
        tiles[f"elevation/{zoom}/{x}/{y}.png"] = get_with_retries(
            partial(client.get, url), f"elevation {zoom}/{x}/{y}"
        ).content
        time.sleep(ELEVATION_DELAY_SECONDS)
    total = sum(len(content) for content in tiles.values())
    if total > ELEVATION_BUDGET_BYTES:
        raise ValueError(
            f"elevation tiles are {total / 1e6:.1f} MB, "
            f"over the {ELEVATION_BUDGET_BYTES / 1e6:.1f} MB budget"
        )
    return tiles


def _decode_rgb(png: bytes) -> tuple[int, int, int, bytes]:
    """Width, height, bytes per pixel and the pixels of an 8-bit, non-interlaced RGB(A) PNG."""
    position, header, data = 8, b"", b""
    while position < len(png):
        (length,) = struct.unpack(">I", png[position : position + 4])
        kind, body = png[position + 4 : position + 8], png[position + 8 : position + 8 + length]
        if kind == b"IHDR":
            header = body
        elif kind == b"IDAT":
            data += body
        position += 12 + length
    width, height, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", header)
    if depth != 8 or colour not in (2, 6) or interlace != 0:
        raise ValueError("elevation tiles must be 8-bit RGB(A), not interlaced")
    pixel = 3 if colour == 2 else 4
    stride, raw, rows = width * pixel, zlib.decompress(data), []
    previous = bytearray(stride)
    for row in range(height):
        start = row * (stride + 1)
        filter_type, line = raw[start], bytearray(raw[start + 1 : start + 1 + stride])
        for i in range(stride):
            left = line[i - pixel] if i >= pixel else 0
            up = previous[i]
            up_left = previous[i - pixel] if i >= pixel else 0
            if filter_type == 1:
                line[i] = (line[i] + left) & 255
            elif filter_type == 2:
                line[i] = (line[i] + up) & 255
            elif filter_type == 3:
                line[i] = (line[i] + (left + up) // 2) & 255
            elif filter_type == 4:
                estimate = left + up - up_left
                nearest = min((abs(estimate - c), c) for c in (left, up, up_left))[1]
                line[i] = (line[i] + nearest) & 255
        rows.append(bytes(line))
        previous = line
    return width, height, pixel, b"".join(rows)


def elevation_at(tiles: dict[str, bytes], lat: float, lon: float) -> float:
    """Metres above sea level at a point, read from the finest Terrarium tile that holds it."""
    for zoom in range(DETAIL_ZOOMS.stop - 1, NATIONAL_ZOOMS.start - 1, -1):
        x, y = tile_position(lat, lon, zoom)
        tile = tiles.get(f"elevation/{zoom}/{int(x)}/{int(y)}.png")
        if tile is not None:
            width, height, pixel, pixels = _decode_rgb(tile)
            offset = (int((y % 1) * height) * width + int((x % 1) * width)) * pixel
            red, green, blue = pixels[offset : offset + 3]
            return red * 256 + green + blue / 256 - 32768
    raise ValueError(f"no elevation tile covers {lat}, {lon}")


def check_key_place_elevations(
    tiles: dict[str, bytes], key_places: list[dict[str, Any]]
) -> list[str]:
    """Print the pack's height at each key place; return the places whose height is not believable."""
    wrong = []
    for place in key_places:
        height = elevation_at(tiles, place["lat"], place["lon"])
        published, tolerance = place["published_elevation_m"], place["tolerance_m"]
        print(
            f"{place['name']}: {height:.0f} m in the pack, {published} m published "
            f"(within {tolerance} m)",
            flush=True,
        )
        if abs(height - published) > tolerance:
            wrong.append(place["name"])
    return wrong


def build_nepal_bundle(
    client: httpx.Client, valley: BBox, key_places: list[dict[str, Any]]
) -> tuple[dict[str, bytes], dict[str, Any]]:
    """The Nepal files for the Cache Pack, and the `nepal` entry for its manifest."""
    border, border_source = fetch_boundary(client, "ADM0")
    districts, districts_source = fetch_boundary(client, "ADM2")
    country = Country(border)
    rivers = rivers_from_ways(
        _overpass(
            client,
            f"[out:json][timeout:{OVERPASS_TIMEOUT_SECONDS}];"
            f'way["waterway"="river"]({_box(NEPAL_BBOX)});out geom tags;',
            "OpenStreetMap rivers",
        ),
        country,
    )
    places = places_from_nodes(
        _overpass(
            client,
            f"[out:json][timeout:{OVERPASS_TIMEOUT_SECONDS}];"
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
        "nepal/places.geojson": with_key_places(places, key_places),
    }
    files = {path: _json_bytes(content) for path, content in vectors.items()}
    detail_areas = [valley, KATHMANDU_BBOX]
    elevation = fetch_elevation(client, detail_areas)
    for path, content in {**files, "elevation (all tiles)": b"".join(elevation.values())}.items():
        print(f"{path}: {len(content) / 1e6:.2f} MB", flush=True)
    wrong = check_key_place_elevations(elevation, key_places)
    if wrong:
        raise ValueError(f"elevation at {', '.join(wrong)} is not near its published height")
    # Every source is fetched live by this run, so the build date is the date they were checked.
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
            "approximate": True,
            "national_zooms": [NATIONAL_ZOOMS.start, NATIONAL_ZOOMS.stop - 1],
            "detail_zooms": [DETAIL_ZOOMS.start, DETAIL_ZOOMS.stop - 1],
            "detail_areas": [list(area) for area in detail_areas],
        },
        "boundaries_note": "Boundaries are indicative",
        "sources": sources,
    }
    return {**files, **elevation}, manifest_entry
