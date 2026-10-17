import threading
from collections import deque
from datetime import datetime, timedelta

from storm_shield.community_reading import CommunityReading
from storm_shield.scenario import Reading, ReadingKind


class NodeReading(Reading):
    node: str
    position: tuple[float, float]
    age_s: float


class ReadingStore:
    """The recent Community Readings from each Node, this Node's own included."""

    def __init__(self, history_seconds: float) -> None:
        self._history_window = timedelta(seconds=history_seconds)
        self._lock = threading.Lock()
        self._history: dict[str, deque[tuple[CommunityReading, datetime]]] = {}

    def record(self, sender: str, reading: CommunityReading, received_at: datetime) -> None:
        with self._lock:
            history = self._history.setdefault(sender, deque())
            # A repeated or relayed-late copy must not overwrite a newer reading.
            if history and reading.seq <= history[-1][0].seq:
                return
            history.append((reading, received_at))
            while history[0][1] < received_at - self._history_window:
                history.popleft()

    def recent(self, now: datetime) -> dict[str, list[CommunityReading]]:
        """Each Node's readings from the history window, oldest first.

        A Node that has said nothing within the window still keeps its last reading, because
        nothing yet drops silent Nodes (ticket 0021).
        """
        since = now - self._history_window
        with self._lock:
            histories = sorted(self._history.items())
        recent: dict[str, list[CommunityReading]] = {}
        for sender, history in histories:
            in_window = [reading for reading, received_at in history if received_at >= since]
            recent[sender] = in_window or [history[-1][0]]
        return recent

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
