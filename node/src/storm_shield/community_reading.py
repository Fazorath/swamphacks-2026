from datetime import datetime
from typing import Literal, NamedTuple, Self

from pydantic import BaseModel

# About 200 m. Fuzzing happens before a position leaves the Node, so the true spot is never sent.
POSITION_GRID_DEGREES = 0.002


class Position(NamedTuple):
    latitude: float
    longitude: float


def fuzz_position(latitude: float, longitude: float) -> Position:
    def snap(degrees: float) -> float:
        return round(round(degrees / POSITION_GRID_DEGREES) * POSITION_GRID_DEGREES, 3)

    return Position(snap(latitude), snap(longitude))


class Reading(BaseModel):
    """One Measurement as a Node produces it, before it goes into a Community Reading."""

    kind: str
    value: float
    unit: str
    timestamp: datetime
    simulated: bool = True


class Measurement(NamedTuple):
    """What a Node measured: a kind, a value and the unit the value is in. Sent as a triple."""

    kind: str
    value: float
    unit: str


class CommunityReading(BaseModel):
    """One Sensor Node's measurements for one tick, in the mesh format of docs/specs/wire-formats.md."""

    v: Literal[2] = 2
    kind: Literal["reading"] = "reading"
    node: str
    seq: int
    t: int
    sim: bool
    pos: Position
    # Where the operator put this Node along the river; the Hub reads it to place a Community Warning.
    river_km: float | None = None
    m: list[Measurement]

    @classmethod
    def from_measurements(
        cls,
        node: str,
        seq: int,
        position: Position,
        readings: list[Reading],
        river_km: float | None = None,
    ) -> Self:
        return cls(
            node=node,
            seq=seq,
            t=int(readings[0].timestamp.timestamp()),
            sim=all(reading.simulated for reading in readings),
            pos=position,
            river_km=river_km,
            m=[Measurement(reading.kind, reading.value, reading.unit) for reading in readings],
        )
