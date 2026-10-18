import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

from storm_shield.weather_grid import (
    GRID_STEP_DEGREES,
    NEPAL_BBOX,
    VARIABLES,
    grid_points,
    weather_grid_from_answers,
)

logger = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
FORECAST_DAYS = 7
FORECAST_TIMEOUT_SECONDS = 60
FILE_NAME = "weather_forecast.json"
SOURCE = "Open-Meteo forecast (model output), roughly 10 to 25 km per cell"


def _check_shape(weather: Any) -> None:
    """Raise ValueError unless this is the national Weather Grid with a value for every hour and point.

    A file from before the grid went national (the valley box, or wind variables) fails here, so it
    counts as absent and is fetched again.
    """
    try:
        grid = weather["grid"]
        rows, cols, points_in_box = grid_points(NEPAL_BBOX)
        if (grid["south"], grid["west"], grid["rows"], grid["cols"], grid["step_deg"]) != (
            *NEPAL_BBOX[:2],
            rows,
            cols,
            GRID_STEP_DEGREES,
        ):
            raise ValueError("not the national grid")
        if set(weather["variables"]) != set(VARIABLES):
            raise ValueError("not the current variables")
        points = len(points_in_box)
        hours = len(weather["times"])
        fetched_at = weather["fetched_at"]
        for name in VARIABLES:
            per_hour = weather["variables"][name]
            if len(per_hour) != hours or any(len(values) != points for values in per_hour):
                raise ValueError(f"{name} does not cover every hour and grid point")
            if any(not isinstance(value, int | float) for values in per_hour for value in values):
                raise ValueError(f"{name} has a value that is not a number")
        datetime.fromisoformat(fetched_at)
    except (KeyError, TypeError) as error:
        raise ValueError(f"not a Weather Grid: {error!r}") from error
    if hours == 0:
        raise ValueError("no hours")


class WeatherForecast:
    """The last good Weather Grid forecast, kept on this Node's disk and served from there."""

    def __init__(self, directory: Path) -> None:
        self._path = directory / FILE_NAME

    def read(self) -> bytes | None:
        """The kept file, or None when there is none or it is damaged (which is logged)."""
        try:
            content = self._path.read_bytes()
        except FileNotFoundError:
            return None
        except OSError:
            logger.exception("could not read %s", self._path)
            return None
        try:
            _check_shape(json.loads(content))
        except ValueError as error:
            logger.warning("ignoring the forecast on disk, it is damaged: %s", error)
            return None
        return content

    def fetch(self, client: httpx.Client, fetched_at: datetime) -> None:
        """Ask Open-Meteo for Nepal and keep the answer. Raises and keeps the old copy on any failure."""
        _, _, points = grid_points(NEPAL_BBOX)
        response = client.get(
            FORECAST_URL,
            params={
                "latitude": ",".join(str(lat) for lat, _ in points),
                "longitude": ",".join(str(lon) for _, lon in points),
                "forecast_days": FORECAST_DAYS,
                "hourly": ",".join(VARIABLES),
                "timezone": "UTC",
            },
        )
        response.raise_for_status()
        weather = weather_grid_from_answers(response.json(), NEPAL_BBOX, SOURCE)
        self._keep({**weather, "fetched_at": fetched_at.isoformat()})

    def download(self, url: str, client: httpx.Client) -> None:
        """Copy the Hub's forecast, fetch time included. Raises and keeps the old copy on any failure."""
        response = client.get(url)
        response.raise_for_status()
        self._keep(response.json())

    def _keep(self, weather: dict[str, Any]) -> None:
        _check_shape(weather)
        # Written beside the file and renamed over it, so a crash never leaves half a forecast.
        self._path.parent.mkdir(parents=True, exist_ok=True)
        staging = self._path.with_name(f"{FILE_NAME}.staging")
        staging.write_text(json.dumps(weather, separators=(",", ":")), encoding="utf-8")
        os.replace(staging, self._path)
