import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta

from pydantic import BaseModel

from storm_shield.community_reading import CommunityReading
from storm_shield.scenario import Reading, ReadingKind
from storm_shield.timing import STALE_AFTER_SECONDS


class Measurement(BaseModel):
    value: float
    unit: str


class NodeSnapshot(BaseModel):
    """What this Node last heard from one Node, grouped so the flags cannot disagree."""

    id: str
    position: tuple[float, float]
    simulated: bool
    age_s: float
    stale: bool
    measurements: dict[ReadingKind, Measurement]


@dataclass
class StoreSnapshot:
    """Every Node's latest readings and the histories Flood Risk needs, from one instant."""

    nodes: list[NodeSnapshot]
    recent: dict[str, list[CommunityReading]]


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

    def snapshot(self, now: datetime) -> StoreSnapshot:
        with self._lock:
            nodes = [
                _node_snapshot(sender, history[-1], now)
                for sender, history in sorted(self._history.items())
            ]
            return StoreSnapshot(nodes=nodes, recent=self._recent_locked(now))

    def _recent_locked(self, now: datetime) -> dict[str, list[CommunityReading]]:
        """Each Node's readings from the history window, oldest first.

        A Node that has said nothing within the window still keeps its last reading, because
        nothing yet drops silent Nodes (ticket 0021).
        """
        since = now - self._history_window
        recent: dict[str, list[CommunityReading]] = {}
        for sender, history in self._history.items():
            in_window = [reading for reading, received_at in history if received_at >= since]
            recent[sender] = in_window or [history[-1][0]]
        return recent


def _node_snapshot(
    sender: str, last_heard: tuple[CommunityReading, datetime], now: datetime
) -> NodeSnapshot:
    reading, received_at = last_heard
    age_s = (now - received_at).total_seconds()
    return NodeSnapshot(
        id=sender,
        position=reading.pos,
        simulated=reading.sim,
        age_s=age_s,
        stale=age_s > STALE_AFTER_SECONDS,
        measurements={
            m.kind: Measurement(value=m.value, unit=m.unit)
            for m in _measurements(reading, received_at)
        },
    )


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
