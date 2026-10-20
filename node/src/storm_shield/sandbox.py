import argparse
import logging
import threading
import time
import webbrowser
from contextlib import ExitStack
from pathlib import Path
from tempfile import TemporaryDirectory
from types import TracebackType
from typing import Any, NamedTuple, Self

import uvicorn
from fastapi import FastAPI
from fastapi.testclient import TestClient

from storm_shield.cache_pack import CachePack, InvalidCachePack
from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.settings import Settings

logger = logging.getLogger(__name__)

HUB = "hub"
PACK_RELEASE = "cache-pack-v6"
# Where scripts/run-demo.sh keeps the pack it downloads, so one download serves both.
DEFAULT_PACK = Path(__file__).resolve().parents[3] / ".demo" / "pack" / "cache-pack.zip"


class NodeSite(NamedTuple):
    name: str
    latitude: float
    longitude: float
    river_km: float
    replay_track: str


# Until Regions exist these are the Replay Nodes of scripts/run-demo.sh; the Hub sits at Betrawati.
HUB_SITE = NodeSite(HUB, 27.9731, 85.1860, 45.6, "")
SENSOR_SITES = [
    NodeSite("s0", 28.3517, 85.4477, -12.2, "S0"),
    NodeSite("s1", 28.2528, 85.3667, 3.4, "S1"),
    NodeSite("s2", 28.1632, 85.3391, 14.6, "S2"),
    NodeSite("s3", 27.9215, 85.1460, 54.0, "S3"),
]


class SandboxError(Exception):
    """The Sandbox cannot start; the message says what to do about it."""


class Sandbox:
    """A Hub and simulated Sensors in this process on one in-memory Mesh, already registered.

    Everything the Nodes write lives in a temporary folder that is removed on exit. The Sensors
    run their loops here; the caller serves `hub` (or drives it with a TestClient).
    """

    def __init__(self, pack: Path) -> None:
        if not pack.is_file():
            raise SandboxError(
                f"no Cache Pack at {pack}. Download it with: gh release download {PACK_RELEASE}"
                f" --pattern cache-pack.zip --dir {pack.parent}"
                " (or pass --pack with a pack you built)"
            )
        self._pack = pack
        self._stack = ExitStack()
        self.hub: FastAPI

    def __enter__(self) -> Self:
        with ExitStack() as setup:
            directory = Path(
                setup.enter_context(TemporaryDirectory(prefix="storm-shield-sandbox-"))
            )
            # The Replay Nodes are tens of km apart, far past the default range; setting one is a
            # later step.
            network = InMemoryNetwork(radio_range_m=None)
            self.hub = self._create_hub(directory, network)
            hub_client = TestClient(self.hub)
            for site in SENSOR_SITES:
                sensor = TestClient(
                    create_app(
                        _settings(site, directory, dashboard_dir=directory / site.name / "none"),
                        network.join(site.name, HUB),
                    )
                )
                # Entering the client starts the Sensor's loops, so it keeps publishing.
                setup.enter_context(sensor)
                # An in-memory Node's id is its name.
                _register(sensor, hub_client, site.name)
            self._stack = setup.pop_all()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self._stack.close()

    def _create_hub(self, directory: Path, network: InMemoryNetwork) -> FastAPI:
        settings = _settings(HUB_SITE, directory, role="hub")
        try:
            CachePack(settings.cache_pack_dir).install(self._pack.read_bytes())
        except InvalidCachePack as error:
            raise SandboxError(f"{self._pack} is not a usable Cache Pack: {error}") from error
        return create_app(settings, network.join(HUB, HUB), sandbox=True)


def _settings(site: NodeSite, directory: Path, **overrides: Any) -> Settings:
    own = directory / site.name
    return Settings(
        name=site.name,
        latitude=site.latitude,
        longitude=site.longitude,
        river_km=site.river_km,
        replay_track=site.replay_track,
        hub_identity=HUB,
        gpio="off",
        data_dir=own / "data",
        cache_pack_dir=own / "cache-pack",
        **overrides,
    )


def _register(sensor: TestClient, hub: TestClient, sensor_id: str) -> None:
    """Sign the Sensor up and accept it, so its readings count at once."""
    sensor.post("/api/registry/signup").raise_for_status()
    hub.post("/api/registry/accept", json={"id": sensor_id}).raise_for_status()


def _open_browser_when_up(server: uvicorn.Server, url: str) -> None:
    while not server.started:
        time.sleep(0.1)
    webbrowser.open(url)


def run() -> None:
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(
        prog="storm-shield-sandbox",
        description="Start a Hub and simulated Sensors in one process and open the dashboard.",
    )
    parser.add_argument("--port", type=int, default=8000, help="where the dashboard is served")
    parser.add_argument("--pack", type=Path, default=DEFAULT_PACK, help="the Cache Pack zip to use")
    arguments = parser.parse_args()
    try:
        with Sandbox(arguments.pack) as sandbox:
            server = uvicorn.Server(uvicorn.Config(sandbox.hub, port=arguments.port))
            url = f"http://localhost:{arguments.port}"
            logger.info("Sandbox dashboard: %s (everything in it is SIMULATED)", url)
            threading.Thread(target=_open_browser_when_up, args=(server, url), daemon=True).start()
            server.run()
    except SandboxError as error:
        raise SystemExit(f"storm-shield-sandbox: {error}") from None
