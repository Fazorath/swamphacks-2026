import json
from functools import partial
from pathlib import Path
from typing import Any

import httpx
from http_retry import RequestFailed, get_with_retries
from pack_sources import SourceFailed, is_address, read_source
from storm_shield.region import Source
from storm_shield.weather_grid import VARIABLES, BBox, grid_points, weather_grid_from_answers

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
SOURCE = "Open-Meteo archive (reanalysis), roughly 10 to 25 km per cell"
# The answer is days of hourly values at every grid point, so give it longer than the tiles get.
REQUEST_TIMEOUT_SECONDS = 180


def weather_replay_from_archive(answers: list[dict[str, Any]], bbox: BBox) -> dict[str, Any]:
    """The `weather_replay.json` content from the archive's answer, one entry per grid point in order."""
    return weather_grid_from_answers(answers, bbox, SOURCE)


def fetch_weather_replay(
    client: httpx.Client, bbox: BBox, first_day: str, last_day: str, url: str = ARCHIVE_URL
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
    response = get_with_retries(
        partial(client.get, url, params=params, timeout=REQUEST_TIMEOUT_SECONDS),
        "weather archive",
    )
    return weather_replay_from_archive(response.json(), bbox)


def build_weather_replay(
    client: httpx.Client,
    region_dir: Path,
    source: Source,
    bbox: BBox,
    first_day: str,
    last_day: str,
) -> dict[str, Any]:
    """The Weather Grid over `bbox` for the days: asked of the archive, or shaped from a saved
    answer. Raises SourceFailed when the source fails or answers wrongly."""
    try:
        if is_address(source.url):
            return fetch_weather_replay(client, bbox, first_day, last_day, source.url)
        return weather_replay_from_archive(
            json.loads(read_source(client, region_dir, source.url, "weather archive")), bbox
        )
    except RequestFailed as error:
        raise SourceFailed(str(error)) from None
    except (ValueError, KeyError, TypeError) as error:
        raise SourceFailed(f"weather archive: not the archive's answer ({error!r})") from None
