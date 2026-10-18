import pytest
from pack_routes import (
    BBox,
    FloodProneArea,
    Point,
    Roads,
    RouteGrid,
    build_road_graph,
    build_routes,
    reenters_after_leaving,
    simplify,
)

# An L-shaped street with a Shelter at the end of it, and an island nobody can drive to it from.
#
#   4 --- 5 --- 6 (the Shelter's road end)
#   |
#   3
#   |
#   1 --- 2
SOUTH_WEST: Point = (29.650, -82.320)
COORDS: dict[int, Point] = {
    1: SOUTH_WEST,
    2: (29.650, -82.319),
    3: (29.651, -82.320),
    4: (29.652, -82.320),
    5: (29.652, -82.319),
    6: (29.652, -82.318),
    7: (29.700, -82.200),
    8: (29.700, -82.199),
}
SEGMENTS = [
    (1, 2, False),
    (1, 3, False),
    (3, 4, False),
    (4, 5, False),
    (5, 6, False),
    (7, 8, False),
]
SHELTER: Point = (29.6521, -82.318)
BBOX: BBox = (29.649, -82.321, 29.653, -82.317)
GRID = RouteGrid.spaced(BBOX, spacing_m=100)


def routes_over(
    segments: list[tuple[int, int, bool]], bbox: BBox = BBOX
) -> dict[str, dict[str, list[list[float]]]]:
    return build_routes(Roads(COORDS, segments), {"gym": SHELTER}, GRID, bbox)


# A band across the street's long leg (node 3 lies in it), like the river corridor across a road.
BAND = FloodProneArea.from_geojson(
    {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-82.3205, 29.6505],
                            [-82.3175, 29.6505],
                            [-82.3175, 29.6515],
                            [-82.3205, 29.6515],
                            [-82.3205, 29.6505],
                        ]
                    ],
                },
            }
        ],
    }
)


def file_of(point: Point) -> str:
    gx, gy = GRID.cell_of(point)
    return f"routes/{gx}_{gy}.json"


def test_a_route_starts_at_its_grid_point_and_ends_at_the_shelter() -> None:
    found = routes_over(SEGMENTS)
    assert found
    for path, by_shelter in found.items():
        gx, gy = (int(n) for n in path.removeprefix("routes/").removesuffix(".json").split("_"))
        start = GRID.point_of(gx, gy)
        assert by_shelter["gym"][0] == [round(start[0], 5), round(start[1], 5)]
        assert by_shelter["gym"][-1] == list(SHELTER)


def test_a_route_follows_the_roads_not_a_straight_line() -> None:
    polyline = routes_over(SEGMENTS)[file_of(SOUTH_WEST)]["gym"]
    assert [29.652, -82.32] in polyline  # round the corner at node 4


def test_a_one_way_road_is_not_driven_the_wrong_way() -> None:
    against_the_shelter = [
        (5, 4, True) if segment[:2] == (4, 5) else segment for segment in SEGMENTS
    ]
    assert file_of(SOUTH_WEST) not in routes_over(against_the_shelter)
    assert file_of(SOUTH_WEST) in routes_over(SEGMENTS)


def test_a_grid_point_with_no_road_within_reach_has_no_file() -> None:
    assert file_of((29.653, -82.317)) not in routes_over(SEGMENTS)


def test_a_grid_point_that_cannot_reach_the_shelter_has_no_file() -> None:
    assert routes_over(SEGMENTS, bbox=(29.699, -82.201, 29.701, -82.198)) == {}


def test_a_shelter_with_no_road_nearby_is_refused() -> None:
    with pytest.raises(ValueError, match="gym"):
        build_routes(Roads(COORDS, SEGMENTS), {"gym": (29.9, -82.0)}, GRID, BBOX)


def test_a_point_belongs_to_the_nearest_grid_point() -> None:
    for gx, gy in ((0, 0), (3, 5), (-2, 7)):
        gy_lat, gx_lon = GRID.point_of(gx, gy)
        nudged = (gy_lat + GRID.lat_step * 0.4, gx_lon - GRID.lon_step * 0.4)
        assert GRID.cell_of(nudged) == (gx, gy)


def test_simplify_drops_points_on_a_straight_line_and_keeps_corners() -> None:
    line: list[Point] = [
        (29.650, -82.320),
        (29.650, -82.3195),
        (29.650, -82.319),
        (29.651, -82.319),
    ]
    assert simplify(line) == [line[0], line[2], line[3]]


def test_the_road_graph_folds_bends_into_segments_between_junctions() -> None:
    graph = build_road_graph(Roads(COORDS, SEGMENTS), keep_near=[])
    # Only the dead ends (2, 6, 7, 8) are junctions; 1, 3, 4, 5 are bends on the way from 2 to 6.
    assert {tuple(node) for node in graph["nodes"]} == {COORDS[2], COORDS[6], COORDS[7], COORDS[8]}
    assert len(graph["edges"]) == 2
    long_edge = next(edge for edge in graph["edges"] if len(edge) == 4)
    assert long_edge[2] > 300  # round the L, about 111 + 111 + 111 + 97 + 97 m
    assert [29.652, -82.32] in long_edge[3]  # the corner at node 4 is kept for drawing


def test_the_road_graph_keeps_the_road_node_nearest_a_shelter() -> None:
    graph = build_road_graph(Roads(COORDS, SEGMENTS), keep_near=[(29.652, -82.3189)])
    assert [29.652, -82.319] in graph["nodes"]
    assert len(graph["edges"]) == 3


def test_the_road_graph_ignores_one_way_rules() -> None:
    one_way = [(5, 4, True) if segment[:2] == (4, 5) else segment for segment in SEGMENTS]
    assert build_road_graph(Roads(COORDS, one_way), []) == build_road_graph(
        Roads(COORDS, SEGMENTS), []
    )


def test_a_route_that_crosses_the_flood_prone_area_is_left_out() -> None:
    assert file_of(SOUTH_WEST) in routes_over(SEGMENTS)
    crossing = build_routes(Roads(COORDS, SEGMENTS), {"gym": SHELTER}, GRID, BBOX, avoid=BAND)
    assert file_of(SOUTH_WEST) not in crossing


def test_a_route_that_starts_inside_the_flood_prone_area_and_walks_out_is_kept() -> None:
    inside = build_routes(Roads(COORDS, SEGMENTS), {"gym": SHELTER}, GRID, BBOX, avoid=BAND)
    assert file_of(COORDS[3]) in inside
    assert file_of(COORDS[5]) in inside  # never in the area at all


def test_a_bridge_between_two_nodes_outside_the_area_still_crosses_it() -> None:
    bridge_coords: dict[int, Point] = {1: (29.6490, -82.320), 2: (29.6530, -82.320)}
    bridged = build_routes(
        Roads(bridge_coords, [(1, 2, False)]), {"gym": (29.6530, -82.320)}, GRID, BBOX, avoid=BAND
    )
    assert file_of((29.6490, -82.320)) not in bridged


def test_a_journey_reenters_when_it_goes_back_in_after_being_out() -> None:
    assert not reenters_after_leaving([True, True, False, False])
    assert not reenters_after_leaving([False, False])
    assert reenters_after_leaving([False, True, False])
    assert reenters_after_leaving([True, False, True])


def test_the_last_leg_from_the_road_to_the_shelter_is_checked_too() -> None:
    # The only road node lies south of the band and the Shelter north of it.
    south_of_the_band: dict[int, Point] = {1: (29.6490, -82.320)}
    found = build_routes(
        Roads(south_of_the_band, []), {"gym": (29.6530, -82.320)}, GRID, BBOX, avoid=BAND
    )
    assert file_of((29.6490, -82.320)) not in found
    assert file_of((29.6490, -82.320)) in build_routes(
        Roads(south_of_the_band, []), {"gym": (29.6530, -82.320)}, GRID, BBOX
    )
