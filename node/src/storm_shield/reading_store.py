import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta

from pydantic import BaseModel

from storm_shield.community_reading import CommunityReading, Position
from storm_shield.scenario import ReadingKind
from storm_shield.timing import STALE_AFTER_SECONDS


class Measurement(BaseModel):
    value: float
    unit: str


class NodeSnapshot(BaseModel):
    """What this Node last heard from one Node, grouped so the flags cannot disagree."""

    id: str
    position: Position
    river_km: float | None
    simulated: bool
    age_s: float
    stale: bool
    measurements: dict[ReadingKind, Measurement]


@dataclass(frozen=True)
class HeardReading:
    reading: CommunityReading
    # On this Node's clock, which is what age is measured against.
    received_at: datetime


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
        self._history: dict[str, deque[HeardReading]] = {}

    def record(self, sender: str, reading: CommunityReading, received_at: datetime) -> None:
        with self._lock:
            history = self._history.setdefault(sender, deque())
            # A repeated or relayed-late copy must not overwrite a newer reading.
            if history and reading.seq <= history[-1].reading.seq:
                return
            history.append(HeardReading(reading, received_at))
            while history[0].received_at < received_at - self._history_window:
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
            in_window = [heard.reading for heard in history if heard.received_at >= since]
            recent[sender] = in_window or [history[-1].reading]
        return recent


def _node_snapshot(sender: str, last_heard: HeardReading, now: datetime) -> NodeSnapshot:
    reading = last_heard.reading
    age_s = (now - last_heard.received_at).total_seconds()
    return NodeSnapshot(
        id=sender,
        position=reading.pos,
        river_km=reading.river_km,
        simulated=reading.sim,
        age_s=age_s,
        stale=age_s > STALE_AFTER_SECONDS,
        measurements={
            m.kind: Measurement(value=m.value, unit=m.unit)
            for m in reading.as_readings(last_heard.received_at)
        },
    )
