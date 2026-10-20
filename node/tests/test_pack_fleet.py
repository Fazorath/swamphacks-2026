import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pack_fleet
import pack_weather
import pytest
from pack_fleet import (
    CALM_BASE_CM,
    MAX_RISE_CM,
    RISING_TOWNS,
    build_fleet,
    check_sites,
    fleet_from_archive,
)

from storm_shield.replay import load_timeline

VALLEY_BBOX = (27.86, 85.08, 28.46, 85.47)

TIMELINE = load_timeline()
SOURCE = Path(__file__).parents[2] / "scripts" / "cache-pack" / "fleet.source.json"
FIRST_HOUR = datetime(2026, 8, 25, tzinfo=UTC)


def _site(slug: str, lat: float, lon: float, site: str = "town", **extra: Any) -> dict[str, Any]:
    return {
        "id": f"fleet-{slug}",
        "name": slug.title(),
        "river": "Karnali",
        "site": site,
        "lat": lat,
        "lon": lon,
        "source": "test",
        **extra,
    }


def _answer(rain_mmh: float) -> dict[str, Any]:
    """A 3-day hourly answer with the same rain every hour."""
    hours = [(FIRST_HOUR + timedelta(hours=hour)).strftime("%Y-%m-%dT%H:%M") for hour in range(48)]
    return {
        "hourly": {
            "time": hours,
            "precipitation": [rain_mmh] * 48,
            "soil_moisture_0_to_7cm": [0.35] * 48,
            "surface_pressure": [850.0] * 48,
        }
    }


def _sites() -> list[dict[str, Any]]:
    return [
        _site("wet", 28.0, 81.0),
        _site("damp", 29.0, 82.0),
        _site("drizzle", 28.0, 83.0),
        _site("dry", 27.0, 84.0),
        _site("silent", 27.0, 86.0, silent_at="09:40:00"),
        _site("lake", 29.5, 80.5, "headwater"),
    ]


def _fleet(rain: list[float]) -> dict[str, Any]:
    return fleet_from_archive(_sites(), [_answer(mm) for mm in rain], TIMELINE, "test")


def _entry(fleet: dict[str, Any], slug: str) -> dict[str, Any]:
    return next(entry for entry in fleet["entries"] if entry["id"] == f"fleet-{slug}")


def test_the_real_source_list_passes_its_own_checks() -> None:
    sites = json.loads(SOURCE.read_text())

    check_sites(sites, VALLEY_BBOX)

    assert 38 <= len(sites) <= 42
    assert sum(site["site"] == "headwater" for site in sites) == 10
    assert all({"id", "name", "river", "site", "lat", "lon", "source"} <= set(s) for s in sites)
    assert sum("silent_at" in site for site in sites) == 1


def test_two_sites_within_15_km_fail_the_build() -> None:
    sites = [_site("a", 28.0, 81.0), _site("b", 28.0, 81.1)]
    with pytest.raises(ValueError, match="fleet-a and fleet-b"):
        check_sites(sites, VALLEY_BBOX)


def test_a_site_inside_the_flood_valley_fails_the_build() -> None:
    with pytest.raises(ValueError, match="inside the valley box: fleet-langtang"):
        check_sites([_site("langtang", 28.2, 85.3)], VALLEY_BBOX)


def test_a_repeated_id_fails_the_build() -> None:
    with pytest.raises(ValueError, match="unique"):
        check_sites([_site("a", 28.0, 81.0), _site("a", 29.0, 83.0)], VALLEY_BBOX)


def test_the_towns_with_the_most_rain_rise_and_the_rest_stay_calm() -> None:
    fleet = _fleet([2.0, 1.0, 0.5, 0.0, 0.2, 3.0])

    risen = [
        entry["id"]
        for entry in fleet["entries"]
        if max(entry["track"]["water_level"]) > CALM_BASE_CM / 100
    ]

    assert sorted(risen) == ["fleet-damp", "fleet-drizzle", "fleet-wet"]
    assert len(risen) == RISING_TOWNS
    # The headwater site had the most rain and still stays calm.
    assert set(_entry(fleet, "lake")["track"]["water_level"]) == {CALM_BASE_CM / 100}


def test_a_rise_stays_below_the_surge_size() -> None:
    fleet = _fleet([40.0, 1.0, 0.5, 0.0, 0.2, 3.0])

    assert max(_entry(fleet, "wet")["track"]["water_level"]) == (CALM_BASE_CM + MAX_RISE_CM) / 100
    assert MAX_RISE_CM < 300


def test_the_build_fails_when_no_town_had_rain_enough_to_rise() -> None:
    with pytest.raises(ValueError, match="no town had rain enough"):
        _fleet([0.0, 0.0, 0.0, 0.0, 0.0, 5.0])


def test_a_track_has_a_point_every_30_event_seconds_from_08_30_to_10_30() -> None:
    fleet = _fleet([2.0, 1.0, 0.5, 0.0, 0.2, 3.0])

    assert fleet["start_t"] == TIMELINE.event_t_at("08:30:00")
    assert fleet["step_s"] == 30
    assert {len(v) for v in _entry(fleet, "wet")["track"].values()} == {241}
    assert _entry(fleet, "wet")["silent_at"] is None


def test_the_silent_site_stops_at_about_09_40() -> None:
    fleet = _fleet([2.0, 1.0, 0.5, 0.0, 0.2, 3.0])

    silent = _entry(fleet, "silent")
    assert silent["silent_at"] == TIMELINE.event_t_at("09:40:00")
    # 08:30 to 09:40 is 70 minutes: 141 points including both ends.
    assert {len(v) for v in silent["track"].values()} == {141}


def test_units_and_conversions_follow_the_measurements() -> None:
    fleet = _fleet([2.0, 1.0, 0.5, 0.0, 0.2, 3.0])

    dry = _entry(fleet, "dry")
    assert dry["track"]["soil_moisture"][0] == 35.0
    assert dry["track"]["air_pressure"][0] == 850.0
    assert dry["track"]["rain_rate"][0] == 0.0
    assert fleet["units"] == {
        "water_level": "m",
        "rain_rate": "mm/h",
        "soil_moisture": "%",
        "air_pressure": "hPa",
    }
    assert "modelled" in fleet["water_model"]


def test_an_answer_with_gaps_or_missing_sites_fails_the_build() -> None:
    gappy = _answer(1.0)
    gappy["hourly"]["precipitation"][5] = None
    with pytest.raises(ValueError, match="gaps"):
        fleet_from_archive(_sites()[:1], [gappy], TIMELINE, "test")
    with pytest.raises(ValueError, match="asked for 6 sites"):
        fleet_from_archive(_sites(), [_answer(1.0)], TIMELINE, "test")


def test_every_site_is_fetched_in_one_request(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    sites = _sites()
    requests: list[httpx.Request] = []

    def archive(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=[_answer(1.0 + index) for index in range(len(sites))])

    monkeypatch.setattr(pack_fleet, "check_sites", lambda *_: None)
    source = tmp_path / "fleet.source.json"
    source.write_text(json.dumps(sites))
    with httpx.Client(transport=httpx.MockTransport(archive)) as client:
        fleet = json.loads(build_fleet(client, source, TIMELINE, VALLEY_BBOX))

    assert len(requests) == 1
    assert str(requests[0].url).startswith(pack_weather.ARCHIVE_URL)
    assert requests[0].url.params["latitude"].count(",") == len(sites) - 1
    assert len(fleet["entries"]) == len(sites)
