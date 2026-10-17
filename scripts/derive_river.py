"""Derive scripts/cache-pack/river.source.geojson and flood_corridor.source.geojson from OpenStreetMap.

Run once when the river inputs change; the Cache Pack build reads the two files it writes.
See scripts/cache-pack/README.md.
"""

import json
import math
import sys
import time
from pathlib import Path

import httpx

SOURCE_DIR = Path(__file__).resolve().parent / "cache-pack"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "storm-shield-cache-pack-builder/1.0 (SwampHacks 2026 student project)"
OVERPASS_ATTEMPTS = 6
OVERPASS_RETRY_SECONDS = 15
# OSM ways of the river, upstream to downstream: Lende Khola (3 ways to the confluence),
# Bhote Koshi (2), then Trishuli River / Trishuli Ganga River down to below Trishuli bazaar.
WAY_IDS = (
    1509505362, 996517784, 937405875,
    201928141, 809865767,
    24624604, 928822514, 119684552, 84953861, 321548891, 343007937, 343007938,
    27033466, 915399520,
)  # fmt: skip
# River km 0 is the Lhende-Kyirong confluence at the border, positive downstream.
CONFLUENCE = (28.2781, 85.3770)
BETRAWATI = (27.9731, 85.1860)
# Reconstructed wave speeds (km/h) for the three reaches; the replay spec cites the sources.
SPEED_ABOVE_BORDER_KMH = 190
SPEED_BORDER_TO_BETRAWATI_KMH = 68
SPEED_BELOW_BETRAWATI_KMH = 18
SPEED_SOURCE = (
    "Reconstructed from reported arrival times, not measured: Kathmandu Post 2026-08-27 "
    "'How the Bhotekoshi flood unfolded over 10 hours'; ICIMOD Kyirong-Rasuwa flood 2026. "
    "See docs/specs/flash-flood-replay.md."
)
SIMPLIFY_TOLERANCE_M = 25
CORRIDOR_HALF_WIDTH_M = 150
COORDINATE_DECIMALS = 5
EARTH_RADIUS_M = 6_371_000

Point = tuple[float, float]  # (lat, lon)


def distance_m(a: Point, b: Point) -> float:
    lat_a, lat_b = math.radians(a[0]), math.radians(b[0])
    half_dlat = (lat_b - lat_a) / 2
    half_dlon = math.radians(b[1] - a[1]) / 2
    h = math.sin(half_dlat) ** 2 + math.cos(lat_a) * math.cos(lat_b) * math.sin(half_dlon) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(h))


def fetch_ways() -> dict[int, list[Point]]:
    query = f"[out:json][timeout:90];way(id:{','.join(map(str, WAY_IDS))});out geom;"
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=120) as client:
        for attempt in range(1, OVERPASS_ATTEMPTS + 1):
            response = client.post(OVERPASS_URL, data={"data": query})
            if response.status_code == 200:
                break
            print(f"Overpass attempt {attempt} answered {response.status_code}", flush=True)
            if attempt == OVERPASS_ATTEMPTS:
                sys.exit("Overpass stays unavailable: try again later")
            time.sleep(OVERPASS_RETRY_SECONDS)
    return {
        element["id"]: [(p["lat"], p["lon"]) for p in element["geometry"]]
        for element in response.json()["elements"]
    }


def stitch(ways: dict[int, list[Point]]) -> list[Point]:
    line: list[Point] = []
    for way_id in WAY_IDS:
        points = ways[way_id]
        if line and distance_m(line[-1], points[0]) > 1:
            sys.exit(f"way {way_id} does not start where the river line ends")
        line += points[1:] if line else points
    return line


def _distance_to_segment_m(p: Point, a: Point, b: Point) -> float:
    # Flat-earth projection around `a` is exact enough over a few hundred metres.
    metres_per_deg_lat = math.pi * EARTH_RADIUS_M / 180
    metres_per_deg_lon = metres_per_deg_lat * math.cos(math.radians(a[0]))
    ax, ay = 0.0, 0.0
    bx, by = (b[1] - a[1]) * metres_per_deg_lon, (b[0] - a[0]) * metres_per_deg_lat
    px, py = (p[1] - a[1]) * metres_per_deg_lon, (p[0] - a[0]) * metres_per_deg_lat
    length_sq = (bx - ax) ** 2 + (by - ay) ** 2
    t = 0.0 if length_sq == 0 else max(0.0, min(1.0, (px * bx + py * by) / length_sq))
    return math.hypot(px - t * bx, py - t * by)


def simplify(line: list[Point]) -> list[Point]:
    """Douglas-Peucker: drops vertices closer than the tolerance to the line between the kept ones."""
    farthest, index = 0.0, 0
    for i in range(1, len(line) - 1):
        d = _distance_to_segment_m(line[i], line[0], line[-1])
        if d > farthest:
            farthest, index = d, i
    if farthest <= SIMPLIFY_TOLERANCE_M:
        return [line[0], line[-1]]
    return simplify(line[: index + 1])[:-1] + simplify(line[index:])


def kilometres_along(line: list[Point]) -> list[float]:
    """River km at each vertex, zero at the vertex nearest the confluence."""
    running = [0.0]
    for a, b in zip(line, line[1:], strict=False):
        running.append(running[-1] + distance_m(a, b) / 1000)
    zero = min(range(len(line)), key=lambda i: distance_m(line[i], CONFLUENCE))
    return [value - running[zero] for value in running]


def km_of(line: list[Point], km: list[float], place: Point) -> float:
    nearest = min(range(len(line)), key=lambda i: distance_m(line[i], place))
    return km[nearest]


def cut_at(line: list[Point], km: list[float], cut_km: float) -> int:
    """Index of the vertex nearest `cut_km`; reaches are cut on vertices so speeds never straddle one."""
    return min(range(len(line)), key=lambda i: abs(km[i] - cut_km))


def corridor(line: list[Point]) -> list[list[list[float]]]:
    """A closed ring along both banks, CORRIDOR_HALF_WIDTH_M from the river line."""
    metres_per_deg_lat = math.pi * EARTH_RADIUS_M / 180
    left: list[Point] = []
    right: list[Point] = []
    for i, (lat, lon) in enumerate(line):
        before = line[max(i - 1, 0)]
        after = line[min(i + 1, len(line) - 1)]
        metres_per_deg_lon = metres_per_deg_lat * math.cos(math.radians(lat))
        dx = (after[1] - before[1]) * metres_per_deg_lon
        dy = (after[0] - before[0]) * metres_per_deg_lat
        length = math.hypot(dx, dy)
        nx, ny = -dy / length, dx / length
        offset_lat = ny * CORRIDOR_HALF_WIDTH_M / metres_per_deg_lat
        offset_lon = nx * CORRIDOR_HALF_WIDTH_M / metres_per_deg_lon
        left.append((lat + offset_lat, lon + offset_lon))
        right.append((lat - offset_lat, lon - offset_lon))
    ring = left + right[::-1] + [left[0]]
    return [[round(lon, COORDINATE_DECIMALS), round(lat, COORDINATE_DECIMALS)] for lat, lon in ring]


def lon_lat(points: list[Point]) -> list[list[float]]:
    return [[round(lon, COORDINATE_DECIMALS), round(lat, COORDINATE_DECIMALS)] for lat, lon in points]


def main() -> None:
    line = simplify(stitch(fetch_ways()))
    km = kilometres_along(line)
    betrawati_km = km_of(line, km, BETRAWATI)
    border = cut_at(line, km, 0)
    betrawati = cut_at(line, km, betrawati_km)
    reaches = [
        ("above the border", 0, border, SPEED_ABOVE_BORDER_KMH),
        ("border to Betrawati", border, betrawati, SPEED_BORDER_TO_BETRAWATI_KMH),
        ("below Betrawati", betrawati, len(line) - 1, SPEED_BELOW_BETRAWATI_KMH),
    ]
    river = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "reach": name,
                    "speed_kmh": speed,
                    "km": [round(value, 3) for value in km[start : end + 1]],
                    "source": SPEED_SOURCE,
                },
                "geometry": {"type": "LineString", "coordinates": lon_lat(line[start : end + 1])},
            }
            for name, start, end, speed in reaches
        ],
    }
    flood_prone = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "source": "APPROXIMATE river corridor, "
                    f"{CORRIDOR_HALF_WIDTH_M} m each side of the OpenStreetMap river line "
                    "(Lende Khola, Bhote Koshi, Trishuli); not a surveyed inundation map"
                },
                "geometry": {"type": "Polygon", "coordinates": [corridor(line)]},
            }
        ],
    }
    (SOURCE_DIR / "river.source.geojson").write_text(json.dumps(river, separators=(",", ":")))
    (SOURCE_DIR / "flood_corridor.source.geojson").write_text(
        json.dumps(flood_prone, separators=(",", ":"))
    )
    print(f"{len(line)} vertices, km {km[0]:.1f} to {km[-1]:.1f}, Betrawati at km {betrawati_km:.1f}")


if __name__ == "__main__":
    main()
