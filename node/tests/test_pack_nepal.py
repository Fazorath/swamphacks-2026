import json
import struct
import zlib
from typing import Any

import httpx
import pack_nepal
import pytest
from pack_nepal import (
    Country,
    build_nepal_bundle,
    check_key_place_elevations,
    elevation_at,
    elevation_tiles,
    places_from_nodes,
    rivers_from_ways,
    simplify_line,
    with_key_places,
)

from storm_shield.weather_grid import VALLEY_BBOX

# A box from (0, 0) to (10, 10) standing in for Nepal.
SQUARE = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
BORDER: dict[str, Any] = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "Nepal"},
            "geometry": {"type": "Polygon", "coordinates": [SQUARE]},
        }
    ],
}
COUNTRY = Country(BORDER)


def _way(
    english_name: str | None, points: list[tuple[float, float]], **tags: str
) -> dict[str, Any]:
    named = {"name:en": english_name} if english_name else {}
    return {
        "tags": {"waterway": "river", **named, **tags},
        "geometry": [{"lon": lon, "lat": lat} for lon, lat in points],
    }


def _long_line(start_lon: float = 1.0) -> list[tuple[float, float]]:
    return [(start_lon, 1.0), (start_lon + 2.0, 1.2), (start_lon + 4.0, 1.0)]


KEY_PLACE = {
    "name": "Hilltop",
    "kind": "valley town",
    "lat": 1.5,
    "lon": 1.5,
    "published_elevation_m": 1400,
    "tolerance_m": 100,
}


def _png(rows: list[list[tuple[int, int, int]]], filter_type: int = 0) -> bytes:
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


def _terrarium_png(metres: int) -> bytes:
    encoded = metres + 32768
    return _png([[(encoded // 256, encoded % 256, 0)] * 4] * 4)


def test_simplify_keeps_the_ends_and_the_bends_and_drops_straight_points() -> None:
    line = [(0.0, 0.0), (1.0, 0.0001), (2.0, 0.0), (3.0, 3.0)]
    assert simplify_line(line, 0.01) == [(0.0, 0.0), (2.0, 0.0), (3.0, 3.0)]


def test_country_contains_points_inside_and_not_outside() -> None:
    assert COUNTRY.contains(5, 5)
    assert not COUNTRY.contains(11, 5)
    assert not COUNTRY.contains(5, -1)


def test_a_main_river_carries_its_group_name_whatever_osm_calls_it() -> None:
    rivers = rivers_from_ways(
        [
            _way("Kali Gandaki River", _long_line()),
            _way("Sun Kosi", _long_line()),
            _way("Trishuli Ganga River", _long_line()),
            _way("Small Khola", _long_line()),
        ],
        COUNTRY,
    )
    assert [f["properties"] for f in rivers["features"]] == [
        {"name": "Kali Gandaki River", "main": "Gandaki"},
        {"name": "Sun Kosi", "main": "Koshi"},
        {"name": "Trishuli Ganga River", "main": "Bhote Koshi–Trishuli"},
        {"name": "Small Khola", "main": None},
    ]


def test_rivers_outside_nepal_and_short_unnamed_creeks_are_left_out() -> None:
    abroad = _way("Ganges", [(20.0, 20.0), (22.0, 20.0)])
    creek = _way(None, [(1.0, 1.0), (1.01, 1.0)])
    long_unnamed = _way(None, [(1.0, 1.0), (6.0, 1.0)])
    rivers = rivers_from_ways([abroad, creek, long_unnamed], COUNTRY)
    assert [f["properties"]["name"] for f in rivers["features"]] == [None]
    assert len(rivers["features"][0]["geometry"]["coordinates"]) == 2


def test_tributaries_are_not_labelled_as_the_main_rivers() -> None:
    ways = [_way("Tamakoshi", _long_line()), _way("Budhi Gandaki", _long_line())]
    mains = [f["properties"]["main"] for f in rivers_from_ways(ways, COUNTRY)["features"]]
    assert mains == [None, None]


def test_a_river_that_only_crosses_a_corner_of_nepal_is_kept() -> None:
    crossing = _way("Corner River", [(float(lon), 5.0) for lon in range(-5, 16)])
    assert len(rivers_from_ways([crossing], COUNTRY)["features"]) == 1


def test_a_river_with_only_a_nepali_name_is_unnamed_on_the_map() -> None:
    way = _way(None, _long_line(), name="भोटे कोशी")
    [feature] = rivers_from_ways([way], COUNTRY)["features"]
    assert feature["properties"] == {"name": None, "main": None}


def test_places_keep_latin_names_inside_nepal() -> None:
    nodes = [
        {"lat": 5.0, "lon": 5.0, "tags": {"place": "town", "name:en": "Betrawati"}},
        {"lat": 5.0, "lon": 5.0, "tags": {"place": "town", "name": "त्रिशूली"}},
        {"lat": 50.0, "lon": 5.0, "tags": {"place": "city", "name": "Elsewhere"}},
    ]
    [feature] = places_from_nodes(nodes, COUNTRY)["features"]
    assert feature["properties"] == {"name": "Betrawati", "kind": "town"}
    assert feature["geometry"]["coordinates"] == [5.0, 5.0]


def test_elevation_tiles_cover_the_box_at_each_zoom() -> None:
    paths = elevation_tiles(VALLEY_BBOX, range(9, 11))
    assert {zoom for zoom, _, _ in paths} == {9, 10}
    assert (10, 754, 428) in paths


def test_key_places_are_marked_and_replace_the_openstreetmap_copy() -> None:
    places = {
        "features": [
            {"properties": {"name": "Hilltop", "kind": "village"}, "geometry": {}},
            {"properties": {"name": "Elsewhere", "kind": "town"}, "geometry": {}},
        ]
    }
    features = with_key_places(places, [KEY_PLACE])["features"]
    assert [f["properties"] for f in features] == [
        {"name": "Elsewhere", "kind": "town"},
        {"name": "Hilltop", "kind": "valley town", "key": True},
    ]
    assert features[1]["geometry"]["coordinates"] == [1.5, 1.5]


def test_the_png_reader_undoes_the_sub_and_up_filters() -> None:
    rows = [[(10, 20, 30), (11, 22, 33), (200, 100, 50)], [(12, 21, 31), (15, 25, 35), (1, 2, 3)]]
    for filter_type in (0, 1, 2):
        decoded = pack_nepal._decode_rgb(_png(rows, filter_type))
        assert decoded == (3, 2, 3, bytes(v for row in rows for pixel in row for v in pixel))


def test_elevation_is_read_from_the_finest_tile_holding_the_point() -> None:
    x, y = pack_nepal._tile_position(1.5, 1.5, 5)
    fine_x, fine_y = pack_nepal._tile_position(1.5, 1.5, 9)
    tiles = {
        f"elevation/5/{int(x)}/{int(y)}.png": _terrarium_png(100),
        f"elevation/9/{int(fine_x)}/{int(fine_y)}.png": _terrarium_png(1400),
    }
    assert elevation_at(tiles, 1.5, 1.5) == 1400
    with pytest.raises(ValueError, match="no elevation tile"):
        elevation_at({}, 1.5, 1.5)


def test_a_key_place_far_from_its_published_height_is_reported(
    capsys: pytest.CaptureFixture[str],
) -> None:
    x, y = pack_nepal._tile_position(1.5, 1.5, 9)
    tiles = {f"elevation/9/{int(x)}/{int(y)}.png": _terrarium_png(1550)}
    assert check_key_place_elevations(tiles, [KEY_PLACE]) == ["Hilltop"]
    assert "Hilltop: 1550 m in the pack, 1400 m published" in capsys.readouterr().out
    assert check_key_place_elevations(tiles, [{**KEY_PLACE, "tolerance_m": 200}]) == []


def _transport(requests: list[str]) -> httpx.MockTransport:
    def answer(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        requests.append(url)
        if "geoboundaries.org/api" in url:
            level = url.rstrip("/").rsplit("/", 1)[1]
            return httpx.Response(
                200,
                json={
                    "boundarySource": f"source of {level}",
                    "boundaryLicense": f"licence of {level}",
                    "boundarySourceURL": "example.org/boundaries",
                    "buildDate": "Dec 12, 2023",
                    "simplifiedGeometryGeoJSON": f"https://data.example/{level}.geojson",
                },
            )
        if url.startswith("https://data.example/"):
            district = {
                "properties": {"shapeName": "Dolpa"},
                "geometry": BORDER["features"][0]["geometry"],
            }
            return httpx.Response(200, json={"features": [district]})
        if "overpass" in url:
            query = request.content.decode()
            if "waterway" in query:
                return httpx.Response(200, json={"elements": [_way("Karnali", _long_line())]})
            return httpx.Response(
                200,
                json={
                    "elements": [
                        {"lat": 5.0, "lon": 5.0, "tags": {"place": "city", "name:en": "Pokhara"}}
                    ]
                },
            )
        return httpx.Response(200, content=_terrarium_png(1400))

    return httpx.MockTransport(answer)


@pytest.fixture
def small_pack(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pack_nepal, "NATIONAL_ZOOMS", range(5, 6))
    monkeypatch.setattr(pack_nepal, "DETAIL_ZOOMS", range(9, 10))
    monkeypatch.setattr(pack_nepal, "NEPAL_BBOX", (1.0, 1.0, 2.0, 2.0))
    monkeypatch.setattr(pack_nepal, "KATHMANDU_BBOX", (1.2, 1.2, 1.4, 1.4))
    monkeypatch.setattr(pack_nepal, "ELEVATION_DELAY_SECONDS", 0)


def test_the_bundle_has_every_layer_the_elevation_and_each_source_with_its_licence(
    small_pack: None,
) -> None:
    requests: list[str] = []
    with httpx.Client(transport=_transport(requests)) as client:
        files, entry = build_nepal_bundle(client, VALLEY_BBOX, [KEY_PLACE])

    assert {path for path in files if not path.startswith("elevation/")} == {
        "nepal/border.geojson",
        "nepal/districts.geojson",
        "nepal/rivers.geojson",
        "nepal/places.geojson",
    }
    assert any(path.startswith("elevation/5/") for path in files)
    fine_x, fine_y = pack_nepal._tile_position(1.3, 1.3, 9)
    assert f"elevation/9/{int(fine_x)}/{int(fine_y)}.png" in files
    places = json.loads(files["nepal/places.geojson"])["features"]
    assert places[-1]["properties"] == {"name": "Hilltop", "kind": "valley town", "key": True}
    assert json.loads(files["nepal/districts.geojson"])["features"][0]["properties"] == {
        "name": "Dolpa"
    }
    assert (
        json.loads(files["nepal/rivers.geojson"])["features"][0]["properties"]["main"] == "Karnali"
    )
    assert entry["elevation"]["encoding"] == "terrarium"
    assert entry["elevation"]["approximate"] is True
    assert entry["elevation"]["detail_zooms"] == [9, 9]
    assert entry["boundaries_note"] == "Boundaries are indicative"
    licences = {source["layer"]: source["licence"] for source in entry["sources"]}
    assert licences["border"] == "licence of ADM0"
    assert licences["districts"] == "licence of ADM2"
    assert "ODbL" in licences["rivers and places"]
    assert all(source["checked"] for source in entry["sources"])


def test_the_build_fails_when_the_elevation_tiles_go_over_budget(
    small_pack: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(pack_nepal, "ELEVATION_BUDGET_BYTES", 10)
    with (
        httpx.Client(transport=_transport([])) as client,
        pytest.raises(ValueError, match="budget"),
    ):
        build_nepal_bundle(client, VALLEY_BBOX, [KEY_PLACE])


def test_the_build_fails_when_a_key_place_is_nowhere_near_its_published_height(
    small_pack: None,
) -> None:
    too_high = {**KEY_PLACE, "published_elevation_m": 3000}
    with (
        httpx.Client(transport=_transport([])) as client,
        pytest.raises(ValueError, match="Hilltop is not near its published height"),
    ):
        build_nepal_bundle(client, VALLEY_BBOX, [too_high])
