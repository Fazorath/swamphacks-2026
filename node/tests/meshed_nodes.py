from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from storm_shield.cache_pack import CachePack
from storm_shield.community_reading import CommunityReading
from storm_shield.main import create_app
from storm_shield.mesh import InMemoryMesh, InMemoryNetwork
from storm_shield.settings import Settings
from storm_shield.shelter_status import ShelterStatus

HUB = "hub"


class MeshedNodes:
    """Several Nodes in one process, joined by the in-memory Mesh and driven through their APIs."""

    def __init__(self) -> None:
        self._network = InMemoryNetwork()
        self._clients: dict[str, TestClient] = {}
        self._now = datetime.now(UTC)
        self._hand_fed: dict[str, tuple[InMemoryMesh, int]] = {}
        self._running: list[TestClient] = []

    def start(self, *names: str, cache_pack: tuple[Path, bytes] | None = None) -> None:
        """Start Nodes that trust `HUB`; with a (directory, zip) pair each already holds that pack."""
        for name in names:
            mesh = self._network.join(name, HUB)
            settings = Settings(name=name, hub_identity=HUB)
            if cache_pack:
                directory, pack = cache_pack
                settings = settings.model_copy(update={"cache_pack_dir": directory / name})
                CachePack(directory / name).install(pack)
            self._clients[name] = TestClient(create_app(settings, mesh, clock=lambda: self._now))

    def start_hub(
        self, cache_pack: tuple[Path, bytes] | None = None, *, shelter_repeat_seconds: float = 30
    ) -> None:
        """Start the Hub, whose identity is `HUB`, with its background loops running."""
        settings = Settings(name=HUB, role="hub", shelter_repeat_seconds=shelter_repeat_seconds)
        if cache_pack:
            directory, pack = cache_pack
            settings = settings.model_copy(
                update={"cache_pack_dir": directory / HUB, "data_dir": directory / HUB / "data"}
            )
            CachePack(directory / HUB).install(pack)
        mesh = self._network.join(HUB, HUB)
        client = TestClient(create_app(settings, mesh, clock=lambda: self._now))
        client.__enter__()
        self._running.append(client)
        self._clients[HUB] = client

    def stop_hub(self) -> None:
        """Stop the Hub as a power cut would; `start_hub` with the same directory brings it back."""
        client = self._clients.pop(HUB)
        client.__exit__(None, None, None)
        self._running.remove(client)
        self._network.leave(HUB)

    def close(self) -> None:
        for client in self._running:
            client.__exit__(None, None, None)

    def announce_shelters(self, ver: int, open_ids: list[str], *, sender: str = HUB) -> None:
        """Have a Node that is not running an app publish one Shelter status."""
        mesh = self._hand_fed.get(sender) or (self._network.join(sender), 0)
        self._hand_fed[sender] = mesh
        mesh[0].publish(ShelterStatus(ver=ver, t=int(self._now.timestamp()), open=open_ids))

    def record_shelter_status(self) -> list[ShelterStatus]:
        """Join a Node that only listens; every Shelter status it hears is appended to the list."""
        heard: list[ShelterStatus] = []
        mesh = self._network.join("recorder", HUB)
        mesh.subscribe(
            lambda _, message: heard.append(message) if isinstance(message, ShelterStatus) else None
        )
        return heard

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
