import json
from typing import Any

import httpx
import pack_nepal
import pytest
from pack_nepal import (
    Country,
    build_nepal_bundle,
    elevation_tile_paths,
    places_from_nodes,
    rivers_from_ways,
    simplify_line,
)

VALLEY_BBOX = (27.86, 85.08, 28.46, 85.47)


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
    paths = elevation_tile_paths(VALLEY_BBOX, range(9, 11))
    assert {zoom for zoom, _, _ in paths} == {9, 10}
    assert (10, 754, 428) in paths


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
        return httpx.Response(200, content=b"tile " + url.rsplit("terrarium/", 1)[1].encode())

    return httpx.MockTransport(answer)


@pytest.fixture
def small_pack(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(pack_nepal, "NATIONAL_ZOOMS", range(5, 6))
    monkeypatch.setattr(pack_nepal, "VALLEY_ZOOMS", range(9, 10))
    monkeypatch.setattr(pack_nepal, "NEPAL_BBOX", (1.0, 1.0, 2.0, 2.0))
    monkeypatch.setattr(pack_nepal, "ELEVATION_DELAY_SECONDS", 0)


def test_the_bundle_has_every_layer_the_elevation_and_each_source_with_its_licence(
    small_pack: None,
) -> None:
    requests: list[str] = []
    with httpx.Client(transport=_transport(requests)) as client:
        files, entry = build_nepal_bundle(client, VALLEY_BBOX)

    assert {path for path in files if not path.startswith("elevation/")} == {
        "nepal/border.geojson",
        "nepal/districts.geojson",
        "nepal/rivers.geojson",
        "nepal/places.geojson",
    }
    assert any(path.startswith("elevation/5/") for path in files)
    assert any(path.startswith("elevation/9/") for path in files)
    assert json.loads(files["nepal/districts.geojson"])["features"][0]["properties"] == {
        "name": "Dolpa"
    }
    assert (
        json.loads(files["nepal/rivers.geojson"])["features"][0]["properties"]["main"] == "Karnali"
    )
    assert entry["elevation"]["encoding"] == "terrarium"
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
        build_nepal_bundle(client, VALLEY_BBOX)
