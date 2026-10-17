import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta

from pydantic import BaseModel

from storm_shield.community_reading import CommunityReading, Position
from storm_shield.scenario import ReadingKind
from storm_shield.timing import (
    DROPS_OFF_AFTER_SECONDS,
    STALE_AFTER_SECONDS,
    STOPS_COUNTING_AFTER_SECONDS,
)


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
    counts: bool
    measurements: dict[ReadingKind, Measurement]


@dataclass(frozen=True)
class HeardReading:
    reading: CommunityReading
    # On this Node's clock, which is what age is measured against.
    received_at: datetime


@dataclass
class StoreSnapshot:
    """Every listed Node's latest readings and the histories Flood Risk needs, from one instant.

    `nodes` omits Nodes past DROPS_OFF_AFTER_SECONDS of silence; `recent` holds only Nodes that
    still count (STOPS_COUNTING_AFTER_SECONDS).
    """

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
                if _age_s(history[-1], now) <= DROPS_OFF_AFTER_SECONDS
            ]
            return StoreSnapshot(nodes=nodes, recent=self._recent_locked(now))

    def _recent_locked(self, now: datetime) -> dict[str, list[CommunityReading]]:
        """Each Node's readings from the history window, oldest first.

        A Node that has said nothing within the window but still counts keeps its last reading;
        one past STOPS_COUNTING_AFTER_SECONDS of silence is left out.
        """
        since = now - self._history_window
        recent: dict[str, list[CommunityReading]] = {}
        for sender, history in self._history.items():
            if not _counts(_age_s(history[-1], now)):
                continue
            in_window = [heard.reading for heard in history if heard.received_at >= since]
            recent[sender] = in_window or [history[-1].reading]
        return recent


def _age_s(last_heard: HeardReading, now: datetime) -> float:
    return (now - last_heard.received_at).total_seconds()


def _counts(age_s: float) -> bool:
    return age_s <= STOPS_COUNTING_AFTER_SECONDS


def _node_snapshot(sender: str, last_heard: HeardReading, now: datetime) -> NodeSnapshot:
    reading = last_heard.reading
    age_s = _age_s(last_heard, now)
    return NodeSnapshot(
        id=sender,
        position=reading.pos,
        river_km=reading.river_km,
        simulated=reading.sim,
        age_s=age_s,
        stale=age_s > STALE_AFTER_SECONDS,
        counts=_counts(age_s),
        measurements={
            m.kind: Measurement(value=m.value, unit=m.unit)
            for m in reading.as_readings(last_heard.received_at)
        },
    )
