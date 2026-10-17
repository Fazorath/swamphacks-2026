import threading
from datetime import datetime

from storm_shield.community_reading import CommunityReading
from storm_shield.scenario import Reading, ReadingKind


class NodeReading(Reading):
    node: str
    position: tuple[float, float]


class ReadingStore:
    """The latest Community Reading from each Node, this Node's own included."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._latest: dict[str, tuple[CommunityReading, datetime]] = {}

    def record(self, sender: str, reading: CommunityReading, received_at: datetime) -> None:
        with self._lock:
            known = self._latest.get(sender)
            # A repeated or relayed-late copy must not overwrite a newer reading.
            if known and reading.seq <= known[0].seq:
                return
            self._latest[sender] = (reading, received_at)

    def latest(self) -> list[NodeReading]:
        with self._lock:
            latest = sorted(self._latest.items())
        return [
            NodeReading(node=sender, position=reading.pos, **measurement.model_dump())
            for sender, (reading, received_at) in latest
            for measurement in _measurements(reading, received_at)
        ]


def _measurements(reading: CommunityReading, received_at: datetime) -> list[Reading]:
    # Age is measured on this Node's clock, so the timestamp is when we received it, not `t`.
    values: list[tuple[ReadingKind, float, str]] = [
        ("pressure", reading.pressure_hpa, "hPa"),
        ("rain_rate", reading.rain_mmh, "mm/h"),
        ("soil_moisture", reading.soil_pct, "%"),
        ("water_level", round(reading.water_m * 100, 1), "cm"),
    ]
    return [
        Reading(kind=kind, value=value, unit=unit, timestamp=received_at, simulated=reading.sim)
        for kind, value, unit in values
    ]
