import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from storm_shield.community_reading import Position
from storm_shield.reading_store import Measurement
from storm_shield.replay import ReplayClockMessage
from storm_shield.scenario import ReadingKind
from storm_shield.timing import STALE_AFTER_SECONDS

FLEET_FILE = "fleet.json"


class FleetEntry(BaseModel):
    """One Simulated Fleet site as the state snapshot lists it (docs/specs/wire-formats.md)."""

    id: str
    name: str
    river: str
    site: Literal["town", "headwater"]
    position: Position
    age_s: float
    stale: bool
    measurements: dict[ReadingKind, Measurement]


class _FleetSite(BaseModel):
    id: str
    name: str
    river: str
    site: Literal["town", "headwater"]
    pos: Position
    # Already cut at the site's `silent_at`, so its last point is the last thing it ever said.
    track: dict[ReadingKind, list[float]]


class _FleetFile(BaseModel):
    start_t: int
    step_s: int
    units: dict[ReadingKind, str]
    entries: list[_FleetSite]


class SimulatedFleet:
    """The Simulated Fleet in this Node's Cache Pack, read at the Event clock.

    Nothing here reaches the Mesh, Flood Risk or the registry: the fleet only fills the map.
    """

    def __init__(self) -> None:
        self._parsed: tuple[Path, int, _FleetFile] | None = None

    def at(self, file: Path | None, event: ReplayClockMessage) -> list[FleetEntry]:
        """Every site's latest point at the Event clock; the calm start when no Replay is heard."""
        if file is None:
            return []
        fleet = self._parse(file)
        entries = []
        for site in sorted(fleet.entries, key=lambda entry: entry.id):
            last_point = len(site.track["water_level"]) - 1
            wanted_point = (event.event_t - fleet.start_t) // fleet.step_s
            point = min(max(wanted_point, 0), last_point)
            # An Event clock below the start (a stopped one reads 0) is the calm start, age 0.
            silent_for_s = max(event.event_t - (fleet.start_t + point * fleet.step_s), 0)
            age_s = silent_for_s / event.rate
            entries.append(
                FleetEntry(
                    id=site.id,
                    name=site.name,
                    river=site.river,
                    site=site.site,
                    position=site.pos,
                    age_s=age_s,
                    stale=age_s > STALE_AFTER_SECONDS,
                    measurements={
                        kind: Measurement(value=values[point], unit=fleet.units[kind])
                        for kind, values in site.track.items()
                    },
                )
            )
        return entries

    def _parse(self, file: Path) -> _FleetFile:
        # The pack file is replaced whole, never edited, so its modified time names its content.
        stamp = file.stat().st_mtime_ns
        if self._parsed is None or self._parsed[:2] != (file, stamp):
            self._parsed = (file, stamp, _FleetFile.model_validate(json.loads(file.read_bytes())))
        return self._parsed[2]
