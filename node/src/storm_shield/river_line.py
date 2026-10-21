import math
from typing import Any

from storm_shield.community_reading import Position

METRES_PER_DEGREE_OF_LATITUDE = 111_320
# The Sandbox's own sites are all within 300 m of the river. A Sensor farther off than this is on
# higher ground, and no Event's water reaches it.
RIVER_REACH_M = 500


def river_km_at(river: dict[str, Any], position: Position) -> float | None:
    """The River km of the river line's nearest point to `position`, or None past `RIVER_REACH_M`.

    `river` is the pack's river.geojson: LineString reaches whose `km` list gives the River km of
    each vertex. Between vertices the km is interpolated.
    """
    metres_per_degree_of_longitude = METRES_PER_DEGREE_OF_LATITUDE * math.cos(
        math.radians(position.latitude)
    )
    nearest: tuple[float, float] | None = None
    for reach in river["features"]:
        vertices = [
            (
                (lon - position.longitude) * metres_per_degree_of_longitude,
                (lat - position.latitude) * METRES_PER_DEGREE_OF_LATITUDE,
            )
            for lon, lat in reach["geometry"]["coordinates"]
        ]
        kms = reach["properties"]["km"]
        for (x1, y1), (x2, y2), km1, km2 in zip(vertices, vertices[1:], kms, kms[1:], strict=False):
            run_x, run_y = x2 - x1, y2 - y1
            length_squared = run_x * run_x + run_y * run_y
            # How far along the segment the point's nearest spot is: 0 at the first vertex, 1 at
            # the second. The point itself is the origin.
            along = (
                0.0
                if length_squared == 0
                else min(1.0, max(0.0, -(x1 * run_x + y1 * run_y) / length_squared))
            )
            distance = math.hypot(x1 + along * run_x, y1 + along * run_y)
            if nearest is None or distance < nearest[0]:
                nearest = (distance, km1 + along * (km2 - km1))
    if nearest is None or nearest[0] > RIVER_REACH_M:
        return None
    return nearest[1]
