"""The Simulated Fleet file (`fleet.json`): about 40 river sites with modelled readings."""

import json
import math
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pack_weather
from storm_shield.replay import ReplayTimeline
from storm_shield.weather_grid import CREDIT, BBox

HOURLY = ("precipitation", "soil_moisture_0_to_7cm", "surface_pressure")
MIN_SEPARATION_KM = 15
FIRST_DAY = "2026-08-25"
LAST_DAY = "2026-08-26"
STEP_SECONDS = 30
# The water model: a calm base, plus a gain on the rain of the previous 24 h for the towns that
# got the most. The rise stays under the Surge size (300 cm) and the High threshold, so the fleet
# can look alive without ever looking like a flood.
CALM_BASE_CM = 80
GAIN_CM_PER_MM = 3
MAX_RISE_CM = 200
RISING_TOWNS = 3
MIN_PEAK_RISE_CM = 30
WATER_MODEL = (
    f"water level modelled from Open-Meteo rainfall: {CALM_BASE_CM} cm + {GAIN_CM_PER_MM} cm "
    f"per mm of rain in the previous 24 h (at most {MAX_RISE_CM} cm), for the {RISING_TOWNS} "
    "towns with the most rain; every other site stays at its calm base"
)
UNITS = {"water_level": "m", "rain_rate": "mm/h", "soil_moisture": "%", "air_pressure": "hPa"}


def distance_km(first: tuple[float, float], second: tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lon) points."""
    lat_a, lon_a, lat_b, lon_b = map(math.radians, (*first, *second))
    haversine = (
        math.sin((lat_b - lat_a) / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin((lon_b - lon_a) / 2) ** 2
    )
    return 2 * 6371 * math.asin(math.sqrt(haversine))


def check_sites(sites: list[dict[str, Any]], valley: BBox) -> None:
    """Fail the build on a site in the flood valley, a repeated id, or two sites too close."""
    south, west, north, east = valley
    ids = [site["id"] for site in sites]
    if len(set(ids)) != len(ids) or not all(site_id.startswith("fleet-") for site_id in ids):
        raise ValueError("fleet ids must be unique and start with 'fleet-'")
    inside = [
        site["id"]
        for site in sites
        if south <= site["lat"] <= north and west <= site["lon"] <= east
    ]
    if inside:
        raise ValueError(f"fleet sites inside the valley box: {', '.join(inside)}")
    for index, first in enumerate(sites):
        for second in sites[index + 1 :]:
            km = distance_km((first["lat"], first["lon"]), (second["lat"], second["lon"]))
            if km < MIN_SEPARATION_KM:
                raise ValueError(f"{first['id']} and {second['id']} are {km:.1f} km apart")


def fetch_fleet_weather(client: httpx.Client, sites: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ask the archive for every site in one request (UTC hours), retried like the weather grid."""
    params = {
        "latitude": ",".join(str(site["lat"]) for site in sites),
        "longitude": ",".join(str(site["lon"]) for site in sites),
        "start_date": FIRST_DAY,
        "end_date": LAST_DAY,
        "hourly": ",".join(HOURLY),
        "timezone": "UTC",
    }
    for attempt in range(1, pack_weather.ATTEMPTS + 1):
        try:
            response = client.get(
                pack_weather.ARCHIVE_URL,
                params=params,
                timeout=pack_weather.REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            break
        except httpx.HTTPError as error:
            if attempt == pack_weather.ATTEMPTS:
                raise
            print(f"fleet weather attempt {attempt} failed ({error}); retrying", flush=True)
            time.sleep(pack_weather.RETRY_PAUSE_SECONDS)
    answers = response.json()
    # One point comes back as an object, several as a list.
    return answers if isinstance(answers, list) else [answers]


def _unix(hour: str) -> int:
    return int(datetime.fromisoformat(hour).replace(tzinfo=UTC).timestamp())


def _between(stamps: list[int], values: list[float], at: int) -> float:
    """`values` (given at `stamps`) joined by straight lines, read at `at`."""
    after = next(index for index, stamp in enumerate(stamps) if stamp >= at)
    if stamps[after] == at or after == 0:
        return values[after]
    progress = (at - stamps[after - 1]) / (stamps[after] - stamps[after - 1])
    return values[after - 1] + (values[after] - values[after - 1]) * progress


def _rain_of_previous_day(rain: list[float]) -> list[float]:
    """For each hour, the rain (mm) of that hour and the 23 before it."""
    return [sum(rain[max(0, hour - 23) : hour + 1]) for hour in range(len(rain))]


def fleet_from_archive(
    sites: list[dict[str, Any]],
    answers: list[dict[str, Any]],
    timeline: ReplayTimeline,
    source_note: str,
) -> dict[str, Any]:
    """The `fleet.json` content from the archive's answer, one answer per site in order."""
    if len(answers) != len(sites):
        raise ValueError(f"asked for {len(sites)} sites, Open-Meteo answered {len(answers)}")
    start, end = timeline.start_unix, timeline.end_unix
    moments = list(range(start, end + 1, STEP_SECONDS))
    weather = {}
    for site, answer in zip(sites, answers, strict=True):
        hourly = answer["hourly"]
        if any(None in hourly[name] for name in HOURLY):
            raise ValueError(f"{site['id']}: Open-Meteo returned gaps")
        stamps = [_unix(hour) for hour in hourly["time"]]
        if stamps[0] > start - 24 * 3600 or stamps[-1] < end:
            raise ValueError(f"{site['id']}: the archive does not cover the replay window")
        weather[site["id"]] = (stamps, hourly, _rain_of_previous_day(hourly["precipitation"]))

    peak_rain = {
        site["id"]: max(
            _between(weather[site["id"]][0], weather[site["id"]][2], moment) for moment in moments
        )
        for site in sites
        if site["site"] == "town"
    }
    wettest = sorted(peak_rain, key=lambda site_id: peak_rain[site_id], reverse=True)
    if GAIN_CM_PER_MM * peak_rain[wettest[0]] < MIN_PEAK_RISE_CM:
        raise ValueError(
            f"no town had rain enough to rise: the most is {peak_rain[wettest[0]]:.1f} mm in 24 h"
        )
    rising = set(wettest[:RISING_TOWNS])

    entries = []
    for site in sites:
        stamps, hourly, previous_day = weather[site["id"]]
        silent_at = timeline.event_t_at(site["silent_at"]) if "silent_at" in site else None
        track_moments = [moment for moment in moments if silent_at is None or moment <= silent_at]
        water = [
            CALM_BASE_CM
            + (
                min(GAIN_CM_PER_MM * _between(stamps, previous_day, moment), MAX_RISE_CM)
                if site["id"] in rising
                else 0
            )
            for moment in track_moments
        ]
        entries.append(
            {
                "id": site["id"],
                "name": site["name"],
                "river": site["river"],
                "site": site["site"],
                "pos": [site["lat"], site["lon"]],
                "silent_at": silent_at,
                "track": {
                    "water_level": [round(value / 100, 3) for value in water],
                    "rain_rate": [
                        round(_between(stamps, hourly["precipitation"], moment), 2)
                        for moment in track_moments
                    ],
                    "soil_moisture": [
                        round(_between(stamps, hourly["soil_moisture_0_to_7cm"], moment) * 100, 1)
                        for moment in track_moments
                    ],
                    "air_pressure": [
                        round(_between(stamps, hourly["surface_pressure"], moment), 1)
                        for moment in track_moments
                    ],
                },
            }
        )
    return {
        "source": source_note,
        "credit": CREDIT,
        "water_model": WATER_MODEL,
        "start_t": start,
        "step_s": STEP_SECONDS,
        "units": UNITS,
        "entries": entries,
    }


def build_fleet(
    client: httpx.Client, source: Path, timeline: ReplayTimeline, valley: BBox
) -> bytes:
    """`fleet.json` for the Cache Pack, built from the hand-written source list."""
    sites = json.loads(source.read_text())
    check_sites(sites, valley)
    answers = fetch_fleet_weather(client, sites)
    note = (
        f"positions: {source.name} (OpenStreetMap / Wikipedia, rounded); "
        "weather: Open-Meteo archive (reanalysis)"
    )
    fleet = fleet_from_archive(sites, answers, timeline, note)
    return json.dumps(fleet, separators=(",", ":")).encode()
