from datetime import datetime
from typing import Literal, NamedTuple, Self

from pydantic import BaseModel

from storm_shield.scenario import Reading, ReadingKind

# About 200 m. Fuzzing happens before a position leaves the Node, so the true spot is never sent.
POSITION_GRID_DEGREES = 0.002


class Position(NamedTuple):
    latitude: float
    longitude: float


def fuzz_position(latitude: float, longitude: float) -> Position:
    def snap(degrees: float) -> float:
        return round(round(degrees / POSITION_GRID_DEGREES) * POSITION_GRID_DEGREES, 3)

    return Position(snap(latitude), snap(longitude))


class CommunityReading(BaseModel):
    """One Sensor Node's measurements for one tick, in the mesh format of docs/specs/wire-formats.md."""

    v: Literal[1] = 1
    kind: Literal["reading"] = "reading"
    node: str
    seq: int
    t: int
    sim: bool
    pos: Position
    # Where the operator put this Node along the river; the Hub reads it to place a Community Warning.
    river_km: float | None = None
    pressure_hpa: float
    water_m: float
    rain_mmh: float
    soil_pct: float

    @classmethod
    def from_measurements(
        cls,
        node: str,
        seq: int,
        position: Position,
        readings: list[Reading],
        river_km: float | None = None,
    ) -> Self:
        value: dict[ReadingKind, float] = {reading.kind: reading.value for reading in readings}
        return cls(
            node=node,
            seq=seq,
            t=int(readings[0].timestamp.timestamp()),
            sim=all(reading.simulated for reading in readings),
            pos=position,
            river_km=river_km,
            pressure_hpa=value["pressure"],
            water_m=round(value["water_level"] / 100, 3),
            rain_mmh=value["rain_rate"],
            soil_pct=value["soil_moisture"],
        )

    def as_readings(self, received_at: datetime) -> list[Reading]:
        """The displayed form: water in centimetres, units named. The inverse of from_measurements."""
        # Age is measured on this Node's clock, so the timestamp is when we received it, not `t`.
        values: list[tuple[ReadingKind, float, str]] = [
            ("pressure", self.pressure_hpa, "hPa"),
            ("rain_rate", self.rain_mmh, "mm/h"),
            ("soil_moisture", self.soil_pct, "%"),
            ("water_level", round(self.water_m * 100, 1), "cm"),
        ]
        return [
            Reading(kind=kind, value=value, unit=unit, timestamp=received_at, simulated=self.sim)
            for kind, value, unit in values
        ]
