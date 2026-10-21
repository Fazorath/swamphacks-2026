"""Tiny PNGs for the terrain tests: an 8-bit RGB image, and a Terrarium tile of one height."""

import struct
import zlib


def png(rows: list[list[tuple[int, int, int]]], filter_type: int = 0) -> bytes:
    """An 8-bit RGB PNG whose rows are stored with the given PNG filter (0 none, 1 sub, 2 up)."""
    raw, previous = b"", [0] * (3 * len(rows[0]))
    for row in rows:
        line = [value for pixel in row for value in pixel]
        if filter_type == 1:
            stored = [(v - (line[i - 3] if i >= 3 else 0)) & 255 for i, v in enumerate(line)]
        elif filter_type == 2:
            stored = [(v - previous[i]) & 255 for i, v in enumerate(line)]
        else:
            stored = line
        raw += bytes([filter_type]) + bytes(stored)
        previous = line

    def chunk(kind: bytes, body: bytes) -> bytes:
        return (
            struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body))
        )

    header = struct.pack(">IIBBBBB", len(rows[0]), len(rows), 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


def terrarium_png(metres: int) -> bytes:
    encoded = metres + 32768
    return png([[(encoded // 256, encoded % 256, 0)] * 4] * 4)
