import hashlib
import io
import json
import zipfile

SHELTERS = [
    {
        "id": "test-gym",
        "name": "Test Gym",
        "pos": [27.97857, 85.18407],
        "height_above_river_m": 96,
        "special_needs": True,
        "pet_friendly": False,
    }
]
FLOOD_PRONE = {"type": "FeatureCollection", "features": []}
RIVER = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"reach": "border to Betrawati", "speed_kmh": 68, "km": [44.5, 45.0]},
            "geometry": {"type": "LineString", "coordinates": [[85.18, 27.98], [85.186, 27.9731]]},
        }
    ],
}
WEATHER_REPLAY = {"source": "fixture", "credit": "fixture credit", "times": ["2026-08-26T00:00Z"]}
TILE = b"\x89PNG fixture tile"
TILE_PATH = "tiles/10/754/429.png"
WEATHER_PATH = "weather_replay.json"


def build_fixture_pack(
    *,
    corrupt_tile: bool = False,
    leave_out_tile: bool = False,
    with_weather: bool = False,
    corrupt_weather: bool = False,
    shelters: list[dict[str, object]] = SHELTERS,
) -> bytes:
    """A tiny Cache Pack in the real layout; the flags break it in the ways a download can break."""
    files = {
        "shelters.json": json.dumps(shelters).encode(),
        "flood_prone.geojson": json.dumps(FLOOD_PRONE).encode(),
        "river.geojson": json.dumps(RIVER).encode(),
        TILE_PATH: TILE,
    }
    if with_weather:
        files[WEATHER_PATH] = json.dumps(WEATHER_REPLAY).encode()
    manifest = {
        "v": 1,
        "built": "2026-10-16T00:00:00Z",
        "bbox": [27.86, 85.08, 28.46, 85.47],
        "files": {path: hashlib.sha256(content).hexdigest() for path, content in files.items()},
    }
    if corrupt_tile:
        files[TILE_PATH] = b"tampered"
    if corrupt_weather:
        files[WEATHER_PATH] = b"tampered"
    if leave_out_tile:
        del files[TILE_PATH]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        for path, content in files.items():
            archive.writestr(path, content)
    return buffer.getvalue()
