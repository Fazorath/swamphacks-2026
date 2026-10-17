import threading

from storm_shield.scenario import Reading, ReadingKind


class NodeReading(Reading):
    node: str


class ReadingStore:
    """Latest Community Reading of each kind from each Node, this Node's own included."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._latest: dict[tuple[str, ReadingKind], NodeReading] = {}

    def record(self, node: str, readings: list[Reading]) -> None:
        with self._lock:
            for reading in readings:
                self._latest[(node, reading.kind)] = NodeReading(node=node, **reading.model_dump())

    def latest(self) -> list[NodeReading]:
        with self._lock:
            return [self._latest[key] for key in sorted(self._latest)]
