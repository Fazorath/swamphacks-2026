"""Build cache-pack.zip for the Gainesville demo box. See scripts/cache-pack/README.md."""

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
from typing import Any

import httpx
from pack_routes import Roads, RouteGrid, build_routes

SOURCE_DIR = Path(__file__).resolve().parent / "cache-pack"
# [south, west, north, east]: about 10 x 10 km around central Gainesville.
BBOX = (29.6066, -82.3766, 29.6966, -82.2730)
ZOOMS = range(11, 17)
TILE_URL = "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"
TILE_DELAY_SECONDS = 0.15
FEMA_URL = (
    "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"
)
FEMA_PAGE_SIZE = 500
# The FEMA service resets connections at random, so each page gets several tries.
FEMA_ATTEMPTS = 8
FEMA_RETRY_SECONDS = 10
COORDINATE_DECIMALS = 4
OSM_EXTRACT_URL = "https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf"
DEFAULT_OSM_EXTRACT = Path("build/florida-latest.osm.pbf")
ROUTE_SPACINGS_M = (100, 250)
# Pis pull the whole pack over the mesh, so routes stay small; the grid coarsens until they fit.
ROUTES_BUDGET_BYTES = 5_000_000
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


def _round_coordinates(coordinates: list) -> list:  # type: ignore[type-arg]
    if coordinates and isinstance(coordinates[0], (int, float)):
        return [round(value, COORDINATE_DECIMALS) for value in coordinates]
    return [_round_coordinates(part) for part in coordinates]


def fetch_fema_page(
    client: httpx.Client, params: dict[str, object]
) -> list[dict[str, Any]]:
    for attempt in range(1, FEMA_ATTEMPTS + 1):
        try:
            response = client.get(FEMA_URL, params=params)
            response.raise_for_status()
            return list(response.json()["features"])
        except (httpx.HTTPError, ValueError, KeyError) as error:
            print(
                f"FEMA attempt {attempt}/{FEMA_ATTEMPTS} failed: {error!r}", flush=True
            )
            if attempt == FEMA_ATTEMPTS:
                raise
            time.sleep(FEMA_RETRY_SECONDS)
    raise AssertionError("unreachable")


def fetch_fema_zones(client: httpx.Client) -> list[dict[str, object]]:
    south, west, north, east = BBOX
    features: list[dict[str, object]] = []
    while True:
        page = fetch_fema_page(
            client,
            {
                "where": "FLD_ZONE IN ('A','AE')",
                "geometry": f"{west},{south},{east},{north}",
                "geometryType": "esriGeometryEnvelope",
                "inSR": "4326",
                "spatialRel": "esriSpatialRelIntersects",
                "outFields": "FLD_ZONE",
                "outSR": "4326",
                "f": "geojson",
                "resultOffset": len(features),
                "resultRecordCount": FEMA_PAGE_SIZE,
            },
        )
        features += [
            {
                "type": "Feature",
                "properties": {
                    "source": f"FEMA NFHL zone {feature['properties']['FLD_ZONE']}"
                },
                "geometry": {
                    "type": feature["geometry"]["type"],
                    "coordinates": _round_coordinates(
                        feature["geometry"]["coordinates"]
                    ),
                },
            }
            for feature in page
        ]
        if len(page) < FEMA_PAGE_SIZE:
            return features


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
    from pyrosm import OSM  # build-only dependency: `uv sync --group build`

    south, west, north, east = BBOX
    nodes, edges = OSM(str(osm_extract), bounding_box=[west, south, east, north]).get_network(
        network_type="driving", nodes=True
    )
    coords = {
        int(node_id): (lat, lon)
        for node_id, lat, lon in zip(nodes["id"], nodes["lat"], nodes["lon"], strict=True)
    }
    segments = []
    # pyrosm cuts every way into one edge per pair of consecutive OSM nodes. A missing `oneway`
    # means two-way; "-1" means the way is one-way against the order of its nodes.
    for start, end, oneway in zip(edges["u"], edges["v"], edges["oneway"], strict=True):
        if start in coords and end in coords:
            segments.append(
                (int(end), int(start), True) if oneway == "-1" else (int(start), int(end), oneway == "yes")
            )
    return Roads(coords, segments)


def build_route_files(
    osm_extract: Path, shelters: list[dict[str, Any]]
) -> tuple[RouteGrid, dict[str, bytes]]:
    roads = load_roads(osm_extract)
    shelter_points = {shelter["id"]: tuple(shelter["pos"]) for shelter in shelters}
    for spacing_m in ROUTE_SPACINGS_M:
        grid = RouteGrid.spaced(BBOX, spacing_m)
        routes = build_routes(roads, shelter_points, grid, BBOX)
        files = {
            path: json.dumps(by_shelter, separators=(",", ":")).encode()
            for path, by_shelter in routes.items()
        }
        compressed = sum(len(zlib.compress(content)) for content in files.values())
        print(f"{len(files)} route files at {spacing_m} m: {compressed / 1e6:.1f} MB", flush=True)
        if compressed <= ROUTES_BUDGET_BYTES:
            break
    return grid, files


def build(output: Path, osm_extract: Path) -> None:
    creek_layer = json.loads((SOURCE_DIR / "creek_floodplains.geojson").read_text())
    shelters = load_shelters()
    route_grid, route_files = build_route_files(osm_extract, shelters)
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60) as client:
        fema_zones = fetch_fema_zones(client)
        tile_list = tiles_covering(BBOX)
        print(
            f"{len(fema_zones)} FEMA zones; fetching {len(tile_list)} tiles", flush=True
        )
        files: dict[str, bytes] = {
            "shelters.json": json.dumps(shelters, indent=1).encode(),
            "flood_prone.geojson": json.dumps(
                {
                    "type": "FeatureCollection",
                    "features": fema_zones + creek_layer["features"],
                },
                separators=(",", ":"),
            ).encode(),
        }
        files.update(route_files)
        for zoom, x, y in tile_list:
            files[f"tiles/{zoom}/{x}/{y}.png"] = fetch_tile(client, zoom, x, y)

    manifest = {
        "v": 1,
        "built": datetime.now(UTC).isoformat(timespec="seconds"),
        "bbox": list(BBOX),
        "route_grid": route_grid.as_manifest_entry(),
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
    parser.add_argument("--osm-extract", type=Path, default=DEFAULT_OSM_EXTRACT)
    arguments = parser.parse_args()
    build(arguments.output, arguments.osm_extract)
