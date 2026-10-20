import json
import threading
from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from storm_shield.community_reading import Reading
from storm_shield.official_alert import AlertSource, AppliesTo, OfficialAlert

TIMELINE_FILE = Path(__file__).with_name("replay_timeline.json")


class ReplayClockMessage(BaseModel):
    """The Hub's Event clock, in the mesh format of docs/specs/wire-formats.md."""

    v: Literal[1] = 1
    kind: Literal["replay"] = "replay"
    state: Literal["playing", "paused", "stopped"]
    # Event time (Unix seconds) at the moment of sending; receivers anchor it on their own clock.
    event_t: int
    rate: int


class EventClock:
    """What this Node believes the Event clock reads, anchored on its own clock at receipt."""

    def __init__(self) -> None:
        # The Reticulum receive thread writes while request threads read.
        self._lock = threading.Lock()
        self._heard = ReplayClockMessage(state="stopped", event_t=0, rate=1)
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


class Keyframe(BaseModel):
    at: str
    water_m: float
    rain_mmh: float
    soil_pct: float
    pressure_hpa: float


class Track(BaseModel):
    """One Sensor's Simulated Readings across the replay, as keyframes joined by straight lines."""

    silent_at: str
    keyframes: list[Keyframe]


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
    issuer: AlertSource
    headline: str
    applies_to: list[AppliesTo]
    source: str


class ReplayTimeline(BaseModel):
    """The one replay file, `replay_timeline.json`; each fact in it names its source."""

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
    tracks: dict[str, Track]

    def event_t_at(self, clock_time: str) -> int:
        """The Event clock's Unix seconds when the replay reads `clock_time`."""
        return self.start_unix + self._seconds_after_start(clock_time)

    @property
    def end_unix(self) -> int:
        """The Event clock's Unix seconds at the end of the replay, where the Hub stops it."""
        return self.event_t_at(self.end)

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
        self, track_name: str, event_t: int, timestamp: datetime
    ) -> list[Reading] | None:
        """The track's readings at this event time, or None once its Sensor has gone silent."""
        track = self.tracks[track_name]
        elapsed = event_t - self.start_unix
        if elapsed >= self._seconds_after_start(track.silent_at):
            return None
        before, after = self._keyframes_around(track, elapsed)
        span = self._seconds_after_start(after.at) - self._seconds_after_start(before.at)
        progress = 0.0 if span <= 0 else (elapsed - self._seconds_after_start(before.at)) / span
        progress = min(max(progress, 0.0), 1.0)

        def between(first: float, second: float) -> float:
            return first + (second - first) * progress

        measurements: list[tuple[str, float, str, int]] = [
            ("air_pressure", between(before.pressure_hpa, after.pressure_hpa), "hPa", 1),
            ("rain_rate", between(before.rain_mmh, after.rain_mmh), "mm/h", 1),
            ("water_level", between(before.water_m, after.water_m), "m", 3),
            ("soil_moisture", between(before.soil_pct, after.soil_pct), "%", 1),
        ]
        return [
            Reading(kind=kind, value=round(value, decimals), unit=unit, timestamp=timestamp)
            for kind, value, unit, decimals in measurements
        ]

    def _keyframes_around(self, track: Track, elapsed: int) -> tuple[Keyframe, Keyframe]:
        """The keyframes either side of `elapsed`; before the first or after the last, that one twice."""
        before = track.keyframes[0]
        for keyframe in track.keyframes:
            if self._seconds_after_start(keyframe.at) > elapsed:
                return before, keyframe
            before = keyframe
        return before, before

    def _seconds_after_start(self, clock_time: str) -> int:
        return _seconds_in_day(clock_time) - _seconds_in_day(self.start)


def _seconds_in_day(clock_time: str) -> int:
    hours, minutes, seconds = (int(part) for part in clock_time.split(":"))
    return hours * 3600 + minutes * 60 + seconds


def load_timeline() -> ReplayTimeline:
    return ReplayTimeline.model_validate(json.loads(TIMELINE_FILE.read_text()))
