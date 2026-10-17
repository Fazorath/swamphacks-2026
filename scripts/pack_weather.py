"""The recorded weather for the Cache Pack: a Weather Grid of one Open-Meteo archive request."""

import math
from typing import Any

import httpx

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
VARIABLES = ("temperature_2m", "cloud_cover", "precipitation", "wind_speed_10m", "wind_direction_10m")
UNITS = {
    "temperature_2m": "°C",
    "cloud_cover": "%",
    "precipitation": "mm/h",
    "wind_speed_10m": "m/s",
    "wind_direction_10m": "°",
}
SOURCE = "Open-Meteo archive (reanalysis), roughly 10 to 25 km per cell"
CREDIT = "Weather data by Open-Meteo.com (CC BY 4.0)"
GRID_STEP_DEGREES = 0.1
COORDINATE_DECIMALS = 2

BBox = tuple[float, float, float, float]  # (south, west, north, east)


def grid_points(
    bbox: BBox, step: float = GRID_STEP_DEGREES
) -> tuple[int, int, list[tuple[float, float]]]:
    """Rows, columns and (lat, lon) of a grid that starts at the box's south-west corner and covers it.

    Points run south to north, then west to east: the order the file stores its values in.
    """
    south, west, north, east = bbox
    rows = math.ceil(round((north - south) / step, 6)) + 1
    cols = math.ceil(round((east - west) / step, 6)) + 1
    points = [
        (
            round(south + row * step, COORDINATE_DECIMALS),
            round(west + col * step, COORDINATE_DECIMALS),
        )
        for row in range(rows)
        for col in range(cols)
    ]
    return rows, cols, points


def weather_replay_from_archive(
    answers: list[dict[str, Any]], bbox: BBox, step: float = GRID_STEP_DEGREES
) -> dict[str, Any]:
    """The `weather_replay.json` content from the archive's answer, one entry per grid point in order."""
    rows, cols, points = grid_points(bbox, step)
    if len(answers) != len(points):
        raise ValueError(f"asked for {len(points)} points, the archive answered {len(answers)}")
    times = answers[0]["hourly"]["time"]
    variables: dict[str, list[list[float]]] = {}
    for name in VARIABLES:
        series = [answer["hourly"][name] for answer in answers]
        if any(len(values) != len(times) or None in values for values in series):
            raise ValueError(f"{name} has gaps or the wrong number of hours")
        variables[name] = [[values[hour] for values in series] for hour in range(len(times))]
    return {
        "source": SOURCE,
        "credit": CREDIT,
        "grid": {"south": bbox[0], "west": bbox[1], "rows": rows, "cols": cols, "step_deg": step},
        "times": [f"{time}Z" for time in times],
        "units": UNITS,
        "variables": variables,
    }


def fetch_weather_replay(
    client: httpx.Client, bbox: BBox, first_day: str, last_day: str
) -> dict[str, Any]:
    """Ask the archive once for every grid point (UTC hours, m/s) and shape the answer."""
    _, _, points = grid_points(bbox)
    response = client.get(
        ARCHIVE_URL,
        params={
            "latitude": ",".join(str(lat) for lat, _ in points),
            "longitude": ",".join(str(lon) for _, lon in points),
            "start_date": first_day,
            "end_date": last_day,
            "hourly": ",".join(VARIABLES),
            "wind_speed_unit": "ms",
            "timezone": "UTC",
        },
    )
    response.raise_for_status()
    return weather_replay_from_archive(response.json(), bbox)
