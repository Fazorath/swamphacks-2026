"""The Weather Grid file: the shape the recorded weather and the forecast share (wire-formats.md)."""

import math
from typing import Any

VARIABLES = (
    "temperature_2m",
    "cloud_cover",
    "precipitation",
)
UNITS = {
    "temperature_2m": "°C",
    "cloud_cover": "%",
    "precipitation": "mm/h",
}
CREDIT = "Weather data by Open-Meteo.com (CC BY 4.0)"
GRID_STEP_DEGREES = 0.5
COORDINATE_DECIMALS = 2

BBox = tuple[float, float, float, float]  # (south, west, north, east)
# All of Nepal: the Cache Pack's map, and the box the Weather Grid fills.
NEPAL_BBOX: BBox = (26.3, 80.0, 30.5, 88.3)


def grid_points(bbox: BBox) -> tuple[int, int, list[tuple[float, float]]]:
    """Rows, columns and (lat, lon) of a grid that starts at the box's south-west corner and covers the box.

    The last row and column may lie past the north and east edges, so those edges have a point.

    Points run south to north, then west to east: the order the file stores its values in.
    """
    south, west, north, east = bbox
    rows = math.ceil(round((north - south) / GRID_STEP_DEGREES, 6)) + 1
    cols = math.ceil(round((east - west) / GRID_STEP_DEGREES, 6)) + 1
    points = [
        (
            round(south + row * GRID_STEP_DEGREES, COORDINATE_DECIMALS),
            round(west + col * GRID_STEP_DEGREES, COORDINATE_DECIMALS),
        )
        for row in range(rows)
        for col in range(cols)
    ]
    return rows, cols, points


def weather_grid_from_answers(
    answers: list[dict[str, Any]], bbox: BBox, source: str
) -> dict[str, Any]:
    """The Weather Grid file from Open-Meteo's answer, one entry per grid point in order."""
    rows, cols, points = grid_points(bbox)
    if len(answers) != len(points):
        raise ValueError(f"asked for {len(points)} points, Open-Meteo answered {len(answers)}")
    times = answers[0]["hourly"]["time"]
    variables: dict[str, list[list[float]]] = {}
    for name in VARIABLES:
        series = [answer["hourly"][name] for answer in answers]
        if any(len(values) != len(times) or None in values for values in series):
            raise ValueError(f"{name} has gaps or the wrong number of hours")
        variables[name] = [[values[hour] for values in series] for hour in range(len(times))]
    return {
        "source": source,
        "credit": CREDIT,
        "grid": {
            "south": bbox[0],
            "west": bbox[1],
            "rows": rows,
            "cols": cols,
            "step_deg": GRID_STEP_DEGREES,
        },
        "times": [f"{time}Z" for time in times],
        "units": UNITS,
        "variables": variables,
    }
