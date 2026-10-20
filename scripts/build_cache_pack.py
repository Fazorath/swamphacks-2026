"""Build cache-pack.zip for the Bhote Koshi valley. See scripts/cache-pack/README.md."""

import argparse
import hashlib
import json
import math
import os
import sys
import time
import zipfile
import zlib
from datetime import UTC, datetime
from pathlib import Path

import httpx
from pack_high_ground import build_high_ground, load_high_ground
from pack_nepal import build_nepal_bundle, elevation_at, load_key_places
from pack_routes import FloodProneArea, Roads, RouteGrid, build_road_graph, build_routes
from pack_weather import fetch_weather_replay

from storm_shield.weather_grid import NEPAL_BBOX

SOURCE_DIR = Path(__file__).resolve().parent / "cache-pack"
# The valley around the flood: the Lhende Khola down to below Trishuli.
VALLEY_BBOX = (27.86, 85.08, 28.46, 85.47)
# Few zoom levels on purpose: the box is large and the pack must stay small.
ZOOMS = range(10, 15)
# Pis pull the whole pack over the mesh, so routes stay small; the grid coarsens until they fit.
ROUTE_SPACINGS_M = (100, 250, 500)
ROUTES_BUDGET_BYTES = 5_000_000
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
    south, west, north, east = VALLEY_BBOX
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

    south, west, north, east = VALLEY_BBOX
    nodes, edges = OSM(str(osm_extract), bounding_box=[west, south, east, north]).get_network(
        network_type="driving", nodes=True
    )
    coords = {
        int(node_id): (lat, lon)
        for node_id, lat, lon in zip(nodes["id"], nodes["lat"], nodes["lon"], strict=True)
    }
    # pyrosm cuts every way into one edge per pair of consecutive OSM nodes. The Road graph
    # ignores one-way rules, but Routes honour them. A driveway or parking aisle is no way to a
    # Shelter.
    segments = []
    for start, end, kind, oneway in zip(
        edges["u"], edges["v"], edges["highway"], edges["oneway"], strict=True
    ):
        if start in coords and end in coords and kind != "service":
            if str(oneway) == "-1":
                segments.append((int(end), int(start), True))
            else:
                segments.append((int(start), int(end), str(oneway) == "yes"))
    return Roads(coords, segments)


def build_route_files(
    roads: Roads, shelters: list[dict[str, object]], avoid: FloodProneArea
) -> tuple[RouteGrid, dict[str, bytes]]:
    shelter_points = {str(shelter["id"]): tuple(shelter["pos"]) for shelter in shelters}
    for spacing_m in ROUTE_SPACINGS_M:
        grid = RouteGrid.spaced(VALLEY_BBOX, spacing_m)
        routes = build_routes(roads, shelter_points, grid, VALLEY_BBOX, avoid)
        files = {
            path: json.dumps(by_shelter, separators=(",", ":")).encode()
            for path, by_shelter in routes.items()
        }
        compressed = sum(len(zlib.compress(content)) for content in files.values())
        print(f"{len(files)} route files at {spacing_m} m: {compressed / 1e6:.1f} MB", flush=True)
        if compressed <= ROUTES_BUDGET_BYTES:
            return grid, files
    sys.exit(
        f"routes stay over {ROUTES_BUDGET_BYTES / 1e6:.0f} MB even at {ROUTE_SPACINGS_M[-1]} m"
    )


def build(output: Path, osm_extract: Path | None, raster_tiles: bool) -> None:
    files: dict[str, bytes] = {
        "shelters.json": json.dumps(load_shelters(), indent=1).encode(),
        "flood_prone.geojson": (SOURCE_DIR / "flood_corridor.source.geojson").read_bytes(),
        "river.geojson": (SOURCE_DIR / "river.source.geojson").read_bytes(),
    }
    manifest_extras: dict[str, object] = {}
    if osm_extract is not None:
        shelters = load_shelters()
        roads = load_roads(osm_extract)
        graph = build_road_graph(roads, [tuple(shelter["pos"]) for shelter in shelters])
        files["roads.json"] = json.dumps(graph, separators=(",", ":")).encode()
        print(f"road graph: {len(graph['nodes'])} junctions, {len(graph['edges'])} segments")
        flood_prone = FloodProneArea.from_geojson(json.loads(files["flood_prone.geojson"]))
        route_grid, route_files = build_route_files(roads, shelters, flood_prone)
        files.update(route_files)
        manifest_extras["route_grid"] = route_grid.as_manifest_entry()
    tile_list = tiles_covering(VALLEY_BBOX) if raster_tiles else []
    tiles_note = f" and {len(tile_list)} tiles" if tile_list else ""
    print(f"fetching Nepal, the weather{tiles_note}", flush=True)
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60) as client:
        weather = fetch_weather_replay(client, NEPAL_BBOX, WEATHER_FIRST_DAY, WEATHER_LAST_DAY)
        files["weather_replay.json"] = json.dumps(weather, separators=(",", ":")).encode()
        key_places = load_key_places(SOURCE_DIR / "key_places.source.json")
        nepal_files, manifest_extras["nepal"] = build_nepal_bundle(client, VALLEY_BBOX, key_places)
        files.update(nepal_files)
        elevation = {
            path: tile for path, tile in nepal_files.items() if path.startswith("elevation/")
        }
        river_lines = json.loads(files["river.geojson"])["features"]
        high_ground = build_high_ground(
            load_high_ground(SOURCE_DIR / "high_ground.source.json"),
            key_places,
            [(lat, lon) for line in river_lines for lon, lat in line["geometry"]["coordinates"]],
            FloodProneArea.from_geojson(json.loads(files["flood_prone.geojson"])),
            lambda lat, lon: elevation_at(elevation, lat, lon),
        )
        files["high_ground.json"] = json.dumps(high_ground, indent=1).encode()
        print(f"high ground: {len(high_ground)} points")
        for zoom, x, y in tile_list:
            files[f"tiles/{zoom}/{x}/{y}.png"] = fetch_tile(client, zoom, x, y)

    manifest = {
        "v": 1,
        "built": datetime.now(UTC).isoformat(timespec="seconds"),
        "bbox": list(VALLEY_BBOX),
        **manifest_extras,
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
        help=(
            f"OSM extract of Nepal ({OSM_EXTRACT_URL}); adds roads.json for rerouting on the phone"
            " and the Routes to the Shelters"
        ),
    )
    parser.add_argument(
        "--raster-tiles",
        action="store_true",
        help="also fetch the CARTO raster tiles of the valley (needs CARTO_API_KEY); v4 leaves them out",
    )
    arguments = parser.parse_args()
    build(arguments.output, arguments.roads_pbf, arguments.raster_tiles)
