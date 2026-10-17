"""Build cache-pack.zip for the Bhote Koshi valley. See scripts/cache-pack/README.md."""

import argparse
import hashlib
import json
import math
import os
import sys
import time
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import httpx
from pack_routes import Roads, build_road_graph
from pack_weather import fetch_weather_replay

SOURCE_DIR = Path(__file__).resolve().parent / "cache-pack"
# [south, west, north, east]: the Lhende Khola down to below Trishuli, about 66 x 40 km.
BBOX = (27.86, 85.08, 28.46, 85.47)
# Few zoom levels on purpose: the box is large and the pack must stay small.
ZOOMS = range(10, 15)
OSM_EXTRACT_URL = "https://download.geofabrik.de/asia/nepal-latest.osm.pbf"
TILE_URL = "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"
TILE_DELAY_SECONDS = 0.15
# The recorded weather around the flood (UTC days), for the Weather layers.
WEATHER_FIRST_DAY = "2026-08-25"
WEATHER_LAST_DAY = "2026-08-27"
USER_AGENT = "storm-shield-cache-pack-builder/1.0 (SwampHacks 2026 student project)"


def tile_of(lat: float, lon: float, zoom: int) -> tuple[int, int]:
    n = 2**zoom
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


def tiles_covering(
    bbox: tuple[float, float, float, float],
) -> list[tuple[int, int, int]]:
    south, west, north, east = bbox
    tiles = []
    for zoom in ZOOMS:
        x_min, y_max = tile_of(south, west, zoom)
        x_max, y_min = tile_of(north, east, zoom)
        tiles += [
            (zoom, x, y)
            for x in range(x_min, x_max + 1)
            for y in range(y_min, y_max + 1)
        ]
    return tiles


def load_shelters() -> list[dict[str, object]]:
    shelters = json.loads((SOURCE_DIR / "shelters.source.json").read_text())
    south, west, north, east = BBOX
    outside = [
        shelter["id"]
        for shelter in shelters
        if not (
            south <= shelter["pos"][0] <= north and west <= shelter["pos"][1] <= east
        )
    ]
    if outside:
        sys.exit(f"Shelters outside the demo box: {', '.join(outside)}")
    # The `source` note is for reviewers of the repo; Nodes only need the fields they show.
    return [
        {key: value for key, value in shelter.items() if key != "source"}
        for shelter in shelters
    ]


def carto_key() -> str:
    key = os.environ.get("CARTO_API_KEY", "")
    if not key:
        sys.exit("CARTO_API_KEY is not set: export it from .env (see .env.example)")
    return key


def fetch_tile(client: httpx.Client, zoom: int, x: int, y: int) -> bytes:
    response = client.get(TILE_URL.format(z=zoom, x=x, y=y), params={"key": carto_key()})
    if response.status_code != 200:
        # Not raise_for_status: its message would print the URL, and the URL carries the key.
        sys.exit(f"CARTO answered {response.status_code} for tile {zoom}/{x}/{y}")
    time.sleep(TILE_DELAY_SECONDS)
    return response.content


def load_roads(osm_extract: Path) -> Roads:
    if not osm_extract.is_file():
        sys.exit(f"{osm_extract} not found: download {OSM_EXTRACT_URL} to that path")
    from pyrosm import OSM  # build-only dependency: `uv run --with pyrosm`

    south, west, north, east = BBOX
    nodes, edges = OSM(str(osm_extract), bounding_box=[west, south, east, north]).get_network(
        network_type="driving", nodes=True
    )
    coords = {
        int(node_id): (lat, lon)
        for node_id, lat, lon in zip(nodes["id"], nodes["lat"], nodes["lon"], strict=True)
    }
    # pyrosm cuts every way into one edge per pair of consecutive OSM nodes. The Road graph
    # ignores one-way rules, and a driveway or parking aisle is no way to a Shelter.
    segments = [
        (int(start), int(end), False)
        for start, end, kind in zip(edges["u"], edges["v"], edges["highway"], strict=True)
        if start in coords and end in coords and kind != "service"
    ]
    return Roads(coords, segments)


def build(output: Path, osm_extract: Path | None) -> None:
    files: dict[str, bytes] = {
        "shelters.json": json.dumps(load_shelters(), indent=1).encode(),
        "flood_prone.geojson": (SOURCE_DIR / "flood_corridor.source.geojson").read_bytes(),
        "river.geojson": (SOURCE_DIR / "river.source.geojson").read_bytes(),
    }
    if osm_extract is not None:
        shelter_points = [tuple(shelter["pos"]) for shelter in load_shelters()]
        graph = build_road_graph(load_roads(osm_extract), shelter_points)
        files["roads.json"] = json.dumps(graph, separators=(",", ":")).encode()
        print(f"road graph: {len(graph['nodes'])} junctions, {len(graph['edges'])} segments")
    tile_list = tiles_covering(BBOX)
    print(f"fetching the recorded weather and {len(tile_list)} tiles", flush=True)
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60) as client:
        weather = fetch_weather_replay(client, BBOX, WEATHER_FIRST_DAY, WEATHER_LAST_DAY)
        files["weather_replay.json"] = json.dumps(weather, separators=(",", ":")).encode()
        for zoom, x, y in tile_list:
            files[f"tiles/{zoom}/{x}/{y}.png"] = fetch_tile(client, zoom, x, y)

    manifest = {
        "v": 1,
        "built": datetime.now(UTC).isoformat(timespec="seconds"),
        "bbox": list(BBOX),
        "files": {
            path: hashlib.sha256(content).hexdigest() for path, content in files.items()
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=1))
        for path, content in files.items():
            archive.writestr(path, content)
    print(f"wrote {output} ({output.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("build/cache-pack.zip"))
    parser.add_argument(
        "--roads-pbf",
        type=Path,
        help=f"OSM extract of Nepal ({OSM_EXTRACT_URL}); adds roads.json for rerouting on the phone",
    )
    arguments = parser.parse_args()
    build(arguments.output, arguments.roads_pbf)
