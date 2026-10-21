import json
from typing import Any

from pack_basemap import basemap_from_elements, overpass_query, simplify_line


def _way(tags: dict[str, str], *points: tuple[float, float]) -> dict[str, Any]:
    """An Overpass way; points are (lat, lon)."""
    return {
        "type": "way",
        "tags": tags,
        "geometry": [{"lat": lat, "lon": lon} for lat, lon in points],
    }


def _features(files: dict[str, bytes], path: str) -> list[dict[str, Any]]:
    features: list[dict[str, Any]] = json.loads(files[path])["features"]
    return features


def test_simplify_keeps_the_ends_and_the_bends_and_drops_straight_points() -> None:
    line = [(0.0, 0.0), (1.0, 0.0001), (2.0, 0.0), (3.0, 3.0)]
    assert simplify_line(line, 0.01) == [(0.0, 0.0), (2.0, 0.0), (3.0, 3.0)]


def test_the_query_asks_for_the_box_in_south_west_north_east_order() -> None:
    assert '["natural"="coastline"](26.3,-82.0,26.7,-81.7)' in overpass_query(
        (26.3, -82.0, 26.7, -81.7)
    )


def test_each_kind_of_element_lands_in_its_own_file() -> None:
    files = basemap_from_elements(
        [
            _way({"highway": "primary", "name": "Main Street"}, (1.0, 1.0), (1.0, 1.1)),
            _way({"waterway": "river", "name:en": "Mud River"}, (1.1, 1.0), (1.1, 1.1)),
            _way({"natural": "coastline"}, (1.2, 1.0), (1.2, 1.1)),
            _way(
                {"natural": "water", "name": "Pond"},
                (1.3, 1.0),
                (1.3, 1.1),
                (1.4, 1.1),
                (1.3, 1.0),
            ),
            {"type": "node", "lat": 1.5, "lon": 1.5, "tags": {"place": "town", "name": "Fort"}},
        ]
    )

    [road] = _features(files, "basemap/roads.geojson")
    assert road["properties"] == {"name": "Main Street", "kind": "primary"}
    assert road["geometry"]["coordinates"] == [[1.0, 1.0], [1.1, 1.0]]
    [river] = _features(files, "basemap/waterways.geojson")
    assert river["properties"] == {"name": "Mud River", "kind": "river"}
    assert len(_features(files, "basemap/coastline.geojson")) == 1
    [pond] = _features(files, "basemap/water.geojson")
    assert pond["properties"] == {"name": "Pond"}
    assert pond["geometry"]["type"] == "Polygon"
    [town] = _features(files, "basemap/places.geojson")
    assert town["properties"] == {"name": "Fort", "kind": "town"}
    assert town["geometry"]["coordinates"] == [1.5, 1.5]


def test_a_lake_drawn_as_a_relation_is_joined_from_its_outer_ways() -> None:
    files = basemap_from_elements(
        [
            {
                "type": "relation",
                "tags": {"natural": "water", "name": "Big Lake"},
                "members": [
                    {
                        "type": "way",
                        "role": "outer",
                        "geometry": [{"lat": 0.0, "lon": 0.0}, {"lat": 0.0, "lon": 1.0}],
                    },
                    {
                        "type": "way",
                        "role": "outer",
                        "geometry": [{"lat": 1.0, "lon": 1.0}, {"lat": 0.0, "lon": 1.0}],
                    },
                    {
                        "type": "way",
                        "role": "outer",
                        "geometry": [
                            {"lat": 1.0, "lon": 1.0},
                            {"lat": 1.0, "lon": 0.0},
                            {"lat": 0.0, "lon": 0.0},
                        ],
                    },
                ],
            }
        ]
    )
    [lake] = _features(files, "basemap/water.geojson")
    ring = lake["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1]
    assert {tuple(point) for point in ring} == {(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)}


def test_a_water_way_that_never_closes_is_left_out() -> None:
    files = basemap_from_elements([_way({"natural": "water"}, (1.0, 1.0), (1.1, 1.1), (1.2, 1.0))])
    assert _features(files, "basemap/water.geojson") == []


def test_a_name_with_no_latin_letters_is_dropped_from_the_map() -> None:
    files = basemap_from_elements(
        [
            {"type": "node", "lat": 1.5, "lon": 1.5, "tags": {"place": "town", "name": "त्रिशूली"}},
            _way({"highway": "primary", "name": "त्रिशूली"}, (1.0, 1.0), (1.0, 1.1)),
        ]
    )
    assert _features(files, "basemap/places.geojson") == []
    assert _features(files, "basemap/roads.geojson")[0]["properties"]["name"] is None
