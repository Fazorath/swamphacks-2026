from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from storm_shield.community_reading import CommunityReading
from storm_shield.main import create_app
from storm_shield.mesh import InMemoryMesh, InMemoryNetwork
from storm_shield.settings import Settings


class MeshedNodes:
    """Several Nodes in one process, joined by the in-memory Mesh and driven through their APIs."""

    def __init__(self) -> None:
        self._network = InMemoryNetwork()
        self._clients: dict[str, TestClient] = {}
        self._now = datetime.now(UTC)
        self._hand_fed: dict[str, tuple[InMemoryMesh, int]] = {}

    def start(self, *names: str) -> None:
        for name in names:
            mesh = self._network.join(name)
            self._clients[name] = TestClient(
                create_app(Settings(name=name), mesh, clock=lambda: self._now)
            )

    def advance(self, seconds: float) -> None:
        """Move every Node's clock forward without waiting."""
        self._now += timedelta(seconds=seconds)

    def hear_from(
        self,
        sender: str,
        *,
        pressure_hpa: float = 1015,
        rain_mmh: float = 0,
        water_cm: float = 20,
        soil_pct: float = 30,
    ) -> None:
        """Have a Node that is not running an app publish one reading with exactly these values.

        The Scenario cannot make soil moisture rise while the water stays low, so this reaches
        the rules it cannot.
        """
        mesh, seq = self._hand_fed.get(sender) or (self._network.join(sender), 0)
        self._hand_fed[sender] = (mesh, seq + 1)
        mesh.publish(
            CommunityReading(
                node=sender,
                seq=seq + 1,
                t=int(self._now.timestamp()),
                sim=True,
                pos=(29.652, -82.324),
                pressure_hpa=pressure_hpa,
                water_m=water_cm / 100,
                rain_mmh=rain_mmh,
                soil_pct=soil_pct,
            )
        )

    def remove(self, name: str) -> None:
        self._network.leave(name)
        del self._clients[name]

    def __getitem__(self, name: str) -> TestClient:
        return self._clients[name]
