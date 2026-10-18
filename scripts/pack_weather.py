import time
from typing import Any

import httpx

from storm_shield.weather_grid import VARIABLES, BBox, grid_points, weather_grid_from_answers

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
SOURCE = "Open-Meteo archive (reanalysis), roughly 10 to 25 km per cell"
# The answer is three days of three variables at 153 points, so give it longer than the tiles get.
REQUEST_TIMEOUT_SECONDS = 180
ATTEMPTS = 5
RETRY_PAUSE_SECONDS = 10


def weather_replay_from_archive(answers: list[dict[str, Any]], bbox: BBox) -> dict[str, Any]:
    """The `weather_replay.json` content from the archive's answer, one entry per grid point in order."""
    return weather_grid_from_answers(answers, bbox, SOURCE)


def fetch_weather_replay(
    client: httpx.Client, bbox: BBox, first_day: str, last_day: str
) -> dict[str, Any]:
    """Ask the archive for every grid point (UTC hours) and shape the answer.

    One request, retried on a network error or an error status: a single failure must not
    abort a build that has not yet fetched its tiles.
    """
    _, _, points = grid_points(bbox)
    params = {
        "latitude": ",".join(str(lat) for lat, _ in points),
        "longitude": ",".join(str(lon) for _, lon in points),
        "start_date": first_day,
        "end_date": last_day,
        "hourly": ",".join(VARIABLES),
        "timezone": "UTC",
    }
    for attempt in range(1, ATTEMPTS + 1):
        try:
            response = client.get(ARCHIVE_URL, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
            response.raise_for_status()
            break
        except httpx.HTTPError as error:
            if attempt == ATTEMPTS:
                raise
            print(f"weather archive attempt {attempt} failed ({error}); retrying", flush=True)
            time.sleep(RETRY_PAUSE_SECONDS)
    return weather_replay_from_archive(response.json(), bbox)
