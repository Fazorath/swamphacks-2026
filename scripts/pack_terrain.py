"""The Region's terrain for the Cache Pack: Terrarium elevation tiles over its bbox."""

import math
import struct
import time
import zlib
from functools import lru_cache
from pathlib import Path

import httpx
from pack_sources import SourceFailed, read_source
from storm_shield.region import Source
from storm_shield.weather_grid import BBox

# About 300 m a pixel at zoom 9 down to about 40 m at zoom 12: enough to read a home's ground.
ZOOMS = range(9, 13)
# Only for the elevation tiles (PNGs do not compress); the vector layers are small.
BUDGET_BYTES = 10_000_000
DELAY_SECONDS = 0.05


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


def fetch_terrain(
    client: httpx.Client, region_dir: Path, source: Source, bbox: BBox
) -> dict[str, bytes]:
    """Terrarium tiles for every zoom over `bbox`, keyed `elevation/{z}/{x}/{y}.png`.

    Raises SourceFailed when a tile cannot be read or the tiles go over the budget.
    """
    tiles = {}
    for zoom, x, y in tiles_covering(bbox, ZOOMS):
        location = source.url.format(z=zoom, x=x, y=y)
        tiles[f"elevation/{zoom}/{x}/{y}.png"] = read_source(
            client, region_dir, location, f"terrain tile {zoom}/{x}/{y}"
        )
        time.sleep(DELAY_SECONDS)
    total = sum(len(content) for content in tiles.values())
    if total > BUDGET_BYTES:
        raise SourceFailed(
            f"terrain tiles are {total / 1e6:.1f} MB, over the {BUDGET_BYTES / 1e6:.1f} MB budget"
        )
    return tiles


@lru_cache(maxsize=32)
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
    for zoom in range(ZOOMS.stop - 1, ZOOMS.start - 1, -1):
        x, y = tile_position(lat, lon, zoom)
        tile = tiles.get(f"elevation/{zoom}/{int(x)}/{int(y)}.png")
        if tile is not None:
            width, height, pixel, pixels = _decode_rgb(tile)
            offset = (int((y % 1) * height) * width + int((x % 1) * width)) * pixel
            red, green, blue = pixels[offset : offset + 3]
            return red * 256 + green + blue / 256 - 32768
    raise ValueError(f"no elevation tile covers {lat}, {lon}")
