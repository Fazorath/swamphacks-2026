import threading
from collections import deque
from datetime import datetime, timedelta

from storm_shield.community_reading import CommunityReading
from storm_shield.scenario import Reading, ReadingKind


class NodeReading(Reading):
    node: str
    position: tuple[float, float]
    age_s: float


# Enough for a minute of readings at the 3 s publish cadence, with room for Scenario steps.
HISTORY_PER_NODE = 30


class ReadingStore:
    """The latest Community Readings from each Node, this Node's own included."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._history: dict[str, deque[tuple[CommunityReading, datetime]]] = {}

    def record(self, sender: str, reading: CommunityReading, received_at: datetime) -> None:
        with self._lock:
            history = self._history.setdefault(sender, deque(maxlen=HISTORY_PER_NODE))
            # A repeated or relayed-late copy must not overwrite a newer reading.
            if history and reading.seq <= history[-1][0].seq:
                return
            history.append((reading, received_at))

    def recent(self, now: datetime, within_s: float) -> dict[str, list[CommunityReading]]:
        """Each Node's readings received in the last `within_s` seconds, oldest first.

        A Node that has been silent for longer is left out.
        """
        since = now - timedelta(seconds=within_s)
        with self._lock:
            kept = {
                sender: [reading for reading, received_at in history if received_at >= since]
                for sender, history in sorted(self._history.items())
            }
        return {sender: readings for sender, readings in kept.items() if readings}

    def latest(self, now: datetime) -> list[NodeReading]:
        with self._lock:
            latest = sorted((sender, history[-1]) for sender, history in self._history.items())
        return [
            NodeReading(
                node=sender,
                position=reading.pos,
                age_s=(now - received_at).total_seconds(),
                **measurement.model_dump(),
            )
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
