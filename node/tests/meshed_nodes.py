from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi.testclient import TestClient

from storm_shield.cache_pack import CachePack
from storm_shield.community_reading import CommunityReading, Position
from storm_shield.community_warning import CommunityWarning
from storm_shield.main import create_app
from storm_shield.mesh import InMemoryMesh, InMemoryNetwork, Message
from storm_shield.node_registry import NodeRegistryMessage, RegisteredNode, SignUp
from storm_shield.official_alert import OfficialAlert
from storm_shield.replay import ReplayClockMessage
from storm_shield.settings import GpioMode, Settings
from storm_shield.shelter_status import ShelterStatus

HUB = "hub"


def _no_internet(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("tests never reach Open-Meteo", request=request)


class MeshedNodes:
    """Several Nodes in one process, joined by the in-memory Mesh and driven through their APIs."""

    def __init__(self, directory: Path) -> None:
        # Every Node's files live under here, never in the checkout: a built dashboard, a downloaded
        # Cache Pack or a Hub's saved Shelter status there would change what the tests see.
        self._directory = directory
        self._network = InMemoryNetwork()
        self._clients: dict[str, TestClient] = {}
        self._now = datetime.now(UTC)
        self._hand_fed: dict[str, tuple[InMemoryMesh, int]] = {}
        self._running: list[TestClient] = []
        self._registry_ver = 0

    def start(self, *names: str, cache_pack: tuple[Path, bytes] | None = None) -> None:
        """Start Nodes that trust `HUB`; with a (directory, zip) pair each already holds that pack."""
        for name in names:
            mesh = self._network.join(name, HUB)
            settings = self._settings(name, hub_identity=HUB)
            if cache_pack:
                directory, pack = cache_pack
                settings = settings.model_copy(update={"cache_pack_dir": directory / name})
                CachePack(directory / name).install(pack)
            self._clients[name] = TestClient(create_app(settings, mesh, clock=lambda: self._now))

    def start_sensor(
        self,
        name: str,
        *,
        replay_track: str = "",
        publish_every_seconds: float = 0.02,
        sign_up_repeat_seconds: float = 10,
        gpio: GpioMode = "off",
    ) -> None:
        """Start a Sensor that trusts `HUB`, with its background loops running so it keeps publishing."""
        settings = self._settings(
            name,
            hub_identity=HUB,
            gpio=gpio,
            replay_track=replay_track,
            publish_every_seconds=publish_every_seconds,
            sign_up_repeat_seconds=sign_up_repeat_seconds,
        )
        client = TestClient(create_app(settings, self._network.join(name, HUB), clock=self._clock))
        client.__enter__()
        self._running.append(client)
        self._clients[name] = client

    def start_hub(
        self,
        cache_pack: tuple[Path, bytes] | None = None,
        *,
        shelter_repeat_seconds: float = 30,
        replay_repeat_seconds: float = 10,
        alert_check_seconds: float = 0.02,
        warning_repeat_seconds: float = 10,
        **overrides: Any,
    ) -> None:
        """Start the Hub, whose identity is `HUB`, with its background loops running."""
        settings = self._settings(
            HUB,
            role="hub",
            shelter_repeat_seconds=shelter_repeat_seconds,
            replay_repeat_seconds=replay_repeat_seconds,
            alert_check_seconds=alert_check_seconds,
            warning_repeat_seconds=warning_repeat_seconds,
            **overrides,
        )
        if cache_pack:
            directory, pack = cache_pack
            settings = settings.model_copy(
                update={"cache_pack_dir": directory / HUB, "data_dir": directory / HUB / "data"}
            )
            CachePack(directory / HUB).install(pack)
        mesh = self._network.join(HUB, HUB)
        weather_source = httpx.Client(transport=httpx.MockTransport(_no_internet))
        client = TestClient(
            create_app(settings, mesh, clock=lambda: self._now, weather_source=weather_source)
        )
        client.__enter__()
        self._running.append(client)
        self._clients[HUB] = client

    def _settings(self, name: str, **overrides: Any) -> Settings:
        own = self._directory / name
        # Off unless a test asks, so a run on a real Pi never reads its pins.
        overrides = {"gpio": "off", **overrides}
        return Settings(
            name=name,
            dashboard_dir=own / "no-dashboard",
            cache_pack_dir=own / "cache-pack",
            data_dir=own / "data",
            **overrides,
        )

    def data_dir(self, name: str) -> Path:
        """Where a Node keeps its saved files."""
        return self._directory / name / "data"

    def stop_hub(self) -> None:
        """Stop the Hub as a power cut would; `start_hub` with the same directory brings it back."""
        client = self._clients.pop(HUB)
        client.__exit__(None, None, None)
        self._running.remove(client)
        self._network.leave(HUB)

    def close(self) -> None:
        for client in self._running:
            client.__exit__(None, None, None)

    def announce_replay(
        self, state: Literal["playing", "paused", "stopped"], event_t: int, *, sender: str = HUB
    ) -> None:
        """Have a Node that is not running an app publish one Event clock message."""
        self._hand_fed_mesh(sender).publish(
            ReplayClockMessage(state=state, event_t=event_t, rate=30)
        )

    def announce_shelters(self, ver: int, open_ids: list[str], *, sender: str = HUB) -> None:
        """Have a Node that is not running an app publish one Shelter status."""
        self._hand_fed_mesh(sender).publish(
            ShelterStatus(ver=ver, t=int(self._now.timestamp()), open=open_ids)
        )

    def announce_registry(
        self, ver: int, names: list[str], *, sender: str = HUB, of: int = 1
    ) -> None:
        """Have a Node that is not running an app publish one Node registry; a name is its own id."""
        self._hand_fed_mesh(sender).publish(
            NodeRegistryMessage(
                ver=ver,
                of=of,
                t=int(self._now.timestamp()),
                nodes=[RegisteredNode(id=name, name=name) for name in names],
            )
        )

    def announce_sign_up(self, node: str, name: str) -> None:
        """Have a Node that is not running an app publish its Sign-up."""
        self._hand_fed_mesh(node).publish(SignUp(node=node, name=name))

    def register(self, *names: str) -> None:
        """Have the Hub's registry list these Nodes (and the Hub), so their readings count."""
        self._registry_ver += 1
        self.announce_registry(self._registry_ver, [HUB, *names])

    def announce_official_alert(self, alert: OfficialAlert, *, sender: str = HUB) -> None:
        """Have a Node that is not running an app publish one Official Alert."""
        self._hand_fed_mesh(sender).publish(alert)

    def announce_community_warning(self, warning: CommunityWarning, *, sender: str = HUB) -> None:
        """Have a Node that is not running an app publish one Community Warning."""
        self._hand_fed_mesh(sender).publish(warning)

    def send_bytes(self, body: bytes, *, sender: str = HUB) -> None:
        """Put exactly these bytes on the Mesh, as a Node running other software could."""
        # Joining first means the sender is not among the receivers, as when it publishes.
        self._hand_fed_mesh(sender)
        self._network.deliver_bytes(sender, body)

    def join_with_failing_listener(self, name: str) -> None:
        """Join a Node whose listener raises on every message."""

        def fail(_sender: str, _message: Message) -> None:
            raise RuntimeError("bug in one listener")

        self._network.join(name, HUB).subscribe(fail)

    def _hand_fed_mesh(self, sender: str) -> InMemoryMesh:
        """The Mesh of a Node that is not running an app, joined on first use."""
        mesh = self._hand_fed.get(sender) or (self._network.join(sender), 0)
        self._hand_fed[sender] = mesh
        return mesh[0]

    def record_shelter_status(self) -> list[ShelterStatus]:
        """Join a Node that only listens; every Shelter status it hears is appended to the list."""
        heard: list[ShelterStatus] = []
        mesh = self._network.join("recorder", HUB)
        mesh.subscribe(
            lambda _, message: heard.append(message) if isinstance(message, ShelterStatus) else None
        )
        return heard

    def _clock(self) -> datetime:
        return self._now

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
        river_km: float | None = None,
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
                pos=Position(29.652, -82.324),
                river_km=river_km,
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
