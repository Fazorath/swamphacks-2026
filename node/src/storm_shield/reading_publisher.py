import itertools
import threading
from collections.abc import Callable

from storm_shield.community_reading import CommunityReading, Position, Reading
from storm_shield.mesh import Mesh


class ReadingPublisher:
    """Turns this Node's measurements into numbered Community Readings and shares them."""

    def __init__(
        self,
        mesh: Mesh,
        position: Position,
        river_km: float | None,
        measurements: Callable[[], list[Reading] | None],
        keep: Callable[[str, CommunityReading], None],
    ) -> None:
        self._mesh = mesh
        self._position = position
        self._river_km = river_km
        self._measurements = measurements
        self._keep = keep
        self._sequence = itertools.count()
        # Two shares on different threads must not swap their seqs, or the later reading would
        # carry the lower seq and the others would hide it.
        self._lock = threading.Lock()

    def share(self) -> None:
        """Keep and publish one Community Reading; nothing once the measurements have ended."""
        with self._lock:
            measurements = self._measurements()
            if measurements is None:
                return
            reading = CommunityReading.from_measurements(
                node=self._mesh.identity,
                seq=next(self._sequence),
                position=self._position,
                readings=measurements,
                river_km=self._river_km,
            )
            self._keep(self._mesh.identity, reading)
            self._mesh.publish(reading)
