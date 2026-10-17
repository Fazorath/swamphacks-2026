import hashlib
import io
import json
import zipfile

SHELTERS = [
    {
        "id": "test-gym",
        "name": "Test Gym",
        "pos": [29.65, -82.32],
        "special_needs": True,
        "pet_friendly": False,
    }
]
FLOOD_PRONE = {"type": "FeatureCollection", "features": []}
TILE = b"\x89PNG fixture tile"
TILE_PATH = "tiles/11/563/859.png"


def build_fixture_pack(*, corrupt_tile: bool = False, leave_out_tile: bool = False) -> bytes:
    """A tiny Cache Pack in the real layout; the flags break it in the ways a download can break."""
    files = {
        "shelters.json": json.dumps(SHELTERS).encode(),
        "flood_prone.geojson": json.dumps(FLOOD_PRONE).encode(),
        TILE_PATH: TILE,
    }
    manifest = {
        "v": 1,
        "built": "2026-10-16T00:00:00Z",
        "bbox": [29.6, -82.37, 29.7, -82.27],
        "files": {path: hashlib.sha256(content).hexdigest() for path, content in files.items()},
    }
    if corrupt_tile:
        files[TILE_PATH] = b"tampered"
    if leave_out_tile:
        del files[TILE_PATH]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        for path, content in files.items():
            archive.writestr(path, content)
    return buffer.getvalue()
