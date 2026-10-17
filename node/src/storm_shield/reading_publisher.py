import itertools
import threading
import time
from collections.abc import Callable

from storm_shield.community_reading import CommunityReading, Position
from storm_shield.mesh import Mesh
from storm_shield.scenario import Reading


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
        # Starting from the clock keeps a restarted Node ahead of the seq others last saw from it.
        self._sequence = itertools.count(int(time.time()))
        # A tick and a Scenario step run on different threads; without this a tick that read the
        # old Scenario could take its seq after the step and hide the step's reading from others.
        # Whoever changes what the measurements say takes it too, then calls `share`.
        self.lock = threading.RLock()

    def share(self) -> None:
        """Keep and publish one Community Reading; nothing once the measurements have ended."""
        with self.lock:
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
