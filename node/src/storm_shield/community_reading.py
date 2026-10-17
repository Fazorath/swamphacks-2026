from typing import Literal, Self

from pydantic import BaseModel

from storm_shield.scenario import Reading, ReadingKind

# About 200 m. Fuzzing happens before a position leaves the Node, so the true spot is never sent.
POSITION_GRID_DEGREES = 0.002


def fuzz_position(latitude: float, longitude: float) -> tuple[float, float]:
    def snap(degrees: float) -> float:
        return round(round(degrees / POSITION_GRID_DEGREES) * POSITION_GRID_DEGREES, 3)

    return (snap(latitude), snap(longitude))


class CommunityReading(BaseModel):
    """One Sensor Node's measurements for one tick, in the mesh format of docs/specs/wire-formats.md."""

    v: Literal[1] = 1
    kind: Literal["reading"] = "reading"
    node: str
    seq: int
    t: int
    sim: bool
    pos: tuple[float, float]
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
        position: tuple[float, float],
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
