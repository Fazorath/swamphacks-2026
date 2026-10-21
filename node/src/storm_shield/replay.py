import itertools
import json
import threading
from collections.abc import Sequence
from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, field_validator

from storm_shield.community_reading import Reading
from storm_shield.official_alert import AppliesTo, OfficialAlert
from storm_shield.region import Region, RegionError

EVENTS_DIR = Path(__file__).with_name("events")


class ReplayClockMessage(BaseModel):
    """The Hub's Event clock, in the mesh format of docs/specs/wire-formats.md."""

    v: Literal[2] = 2
    kind: Literal["replay"] = "replay"
    # The Event every Node plays; a Node that does not hold this Event ignores the clock.
    event: str
    state: Literal["playing", "paused", "stopped"]
    # Event time (Unix seconds) at the moment of sending; receivers anchor it on their own clock.
    event_t: int
    rate: int


class EventClock:
    """What this Node believes the Event clock reads, anchored on its own clock at receipt."""

    def __init__(self, event_id: str) -> None:
        # The Reticulum receive thread writes while request threads read.
        self._lock = threading.Lock()
        self._heard = ReplayClockMessage(event=event_id, state="stopped", event_t=0, rate=1)
        self._heard_at: datetime | None = None

    def hear(self, message: ReplayClockMessage, received_at: datetime) -> None:
        with self._lock:
            self._heard = message
            self._heard_at = received_at

    def current(self, now: datetime) -> ReplayClockMessage:
        """The clock as of `now`; only a playing clock moves."""
        with self._lock:
            heard, heard_at = self._heard, self._heard_at
        if heard.state != "playing" or heard_at is None:
            return heard
        elapsed = (now - heard_at).total_seconds()
        return heard.model_copy(update={"event_t": heard.event_t + int(elapsed * heard.rate)})


class Station(BaseModel):
    """A gauge on the river: its level over the Event, as points joined by straight lines."""

    id: str
    label: str
    river_km: float
    # (seconds after the Event starts, level in the surface's unit)
    series: list[tuple[int, float]]

    @field_validator("series")
    @classmethod
    def _in_time_order(cls, series: list[tuple[int, float]]) -> list[tuple[int, float]]:
        _require_increasing([at for at, _ in series], "a station's series")
        return series


class WaterSurface(BaseModel):
    unit: Literal["m"]
    stations: list[Station]

    @field_validator("stations")
    @classmethod
    def _in_river_order(cls, stations: list[Station]) -> list[Station]:
        _require_increasing([station.river_km for station in stations], "the stations")
        return stations


class WeatherKeyframe(BaseModel):
    t: int
    rain_mmh: float
    soil_pct: float
    pressure_hpa: float


def _require_increasing(positions: list[float], what: str) -> None:
    if not positions or any(b <= a for a, b in itertools.pairwise(positions)):
        raise ValueError(f"{what} must be a non-empty list in strictly increasing order")


class Phase(BaseModel):
    id: str
    at: str
    label: str


class InternetCue(BaseModel):
    at: str


class ReplayedAlert(BaseModel):
    """One Official Alert as the replay file records it; `source` names the citation."""

    id: str
    at: str
    # A tag from the Region's `official_alert_sources`.
    issuer: str
    headline: str
    applies_to: list[AppliesTo]
    source: str


class Event(BaseModel):
    """One Event file, `events/<id>.json`: its window, phases, Official Alerts, surface and weather.

    Each fact in it names its source, or says it is reconstructed.
    """

    id: str
    label: str
    hazard: Literal["flash_flood"]
    date: str
    utc_offset: str
    start: str
    end: str
    start_unix: int
    rate: int
    sources: dict[str, str]
    phases: list[Phase]
    internet_cue: InternetCue
    official_alerts: list[ReplayedAlert]
    surface: WaterSurface
    weather: list[WeatherKeyframe]

    @field_validator("weather")
    @classmethod
    def _weather_in_time_order(cls, weather: list[WeatherKeyframe]) -> list[WeatherKeyframe]:
        _require_increasing([keyframe.t for keyframe in weather], "the weather")
        return weather

    def event_t_at(self, clock_time: str) -> int:
        """The Event clock's Unix seconds when the replay reads `clock_time`."""
        return self.start_unix + self._seconds_after_start(clock_time)

    @property
    def end_unix(self) -> int:
        """The Event clock's Unix seconds at the end of the replay, where the Hub stops it."""
        return self.event_t_at(self.end)

    def require_alert_sources_of(self, region: Region) -> None:
        """Raise RegionError if an alert is credited to a source the Region does not list."""
        for alert in self.official_alerts:
            if not region.has_alert_source(alert.issuer):
                raise RegionError(
                    f"Event {self.id}: alert {alert.id} is from {alert.issuer!r}, which is not "
                    f"one of the {region.name} Region's official_alert_sources"
                )

    def official_alerts_due(self, event_t: int) -> list[OfficialAlert]:
        """The Official Alerts the Event clock has reached, in the mesh format."""
        return [
            OfficialAlert(
                id=alert.id,
                source=alert.issuer,
                mode="replay",
                issued=f"{self.date}T{alert.at}{self.utc_offset}",
                headline=alert.headline,
                applies_to=alert.applies_to,
                url=self.sources[alert.source],
            )
            for alert in self.official_alerts
            if self.event_t_at(alert.at) <= event_t
        ]

    def readings_at(
        self, river_km: float | None, event_t: int, timestamp: datetime
    ) -> list[Reading]:
        """What a Sensor at `river_km` reads at this Event time.

        Inside the corridor, between the first and last station, the water level is interpolated
        along River km. Outside it, or off the river, the spot is dry and sends no `water_level`.
        """
        elapsed = event_t - self.start_unix
        weather = _interpolate(
            elapsed,
            [(w.t, (w.rain_mmh, w.soil_pct, w.pressure_hpa)) for w in self.weather],
        )
        measurements: list[tuple[str, float, str, int]] = [
            ("air_pressure", weather[2], "hPa", 1),
            ("rain_rate", weather[0], "mm/h", 1),
            ("soil_moisture", weather[1], "%", 1),
        ]
        water_m = self._water_level_at(river_km, elapsed)
        if water_m is not None:
            measurements.append(("water_level", water_m, "m", 3))
        return [
            Reading(kind=kind, value=round(value, decimals), unit=unit, timestamp=timestamp)
            for kind, value, unit, decimals in measurements
        ]

    def _water_level_at(self, river_km: float | None, elapsed: int) -> float | None:
        stations = self.surface.stations
        if river_km is None or not stations[0].river_km <= river_km <= stations[-1].river_km:
            return None
        return _interpolate(
            river_km,
            [
                (station.river_km, (_interpolate(elapsed, _as_points(station.series))[0],))
                for station in stations
            ],
        )[0]

    def _seconds_after_start(self, clock_time: str) -> int:
        return _seconds_in_day(clock_time) - _seconds_in_day(self.start)


def _as_points(series: list[tuple[int, float]]) -> list[tuple[float, tuple[float, ...]]]:
    return [(at, (level,)) for at, level in series]


def _interpolate(at: float, points: Sequence[tuple[float, tuple[float, ...]]]) -> tuple[float, ...]:
    """The values at `at`, on straight lines between points sorted by position; held beyond the ends."""
    if at <= points[0][0]:
        return points[0][1]
    for (before_at, before), (after_at, after) in itertools.pairwise(points):
        if at <= after_at:
            progress = (at - before_at) / (after_at - before_at)
            return tuple(a + (b - a) * progress for a, b in zip(before, after, strict=True))
    return points[-1][1]


def _seconds_in_day(clock_time: str) -> int:
    hours, minutes, seconds = (int(part) for part in clock_time.split(":"))
    return hours * 3600 + minutes * 60 + seconds


def load_events() -> dict[str, Event]:
    """Every Event file, by id, in file-name order; the first is the one a stopped Node reads."""
    events = [
        Event.model_validate(json.loads(path.read_text()))
        for path in sorted(EVENTS_DIR.glob("*.json"))
    ]
    return {event.id: event for event in events}


def load_event() -> Event:
    return next(iter(load_events().values()))
