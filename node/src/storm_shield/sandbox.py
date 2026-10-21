import argparse
import logging
import subprocess
import threading
import time
import webbrowser
from collections.abc import Callable
from contextlib import ExitStack
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from types import TracebackType
from typing import Any, NamedTuple, Self, cast

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.testclient import TestClient

from storm_shield.cache_pack import CachePack, InvalidCachePack
from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.settings import Settings

logger = logging.getLogger(__name__)

HUB = "hub"
PACK_URL = (
    "https://github.com/StormShields/Stormshield/releases/download/cache-pack-v6/cache-pack.zip"
)
DOWNLOAD_TIMEOUT_SECONDS = 120
REPO = Path(__file__).resolve().parents[3]
# Where scripts/run-demo.sh keeps the pack it downloads, so one download serves both.
DEFAULT_PACK = REPO / ".demo" / "pack" / "cache-pack.zip"
BUILT_DASHBOARD = REPO / "dashboard" / "dist" / "index.html"


class NodeSite(NamedTuple):
    name: str
    latitude: float
    longitude: float
    river_km: float


# Until Regions exist these are the Replay Nodes of scripts/run-demo.sh; the Hub sits at Betrawati.
HUB_SITE = NodeSite(HUB, 27.9731, 85.1860, 45.6)
SENSOR_SITES = [
    NodeSite("s0", 28.3517, 85.4477, -12.2),
    NodeSite("s1", 28.2528, 85.3667, 3.4),
    NodeSite("s2", 28.1632, 85.3391, 14.6),
    NodeSite("s3", 27.9215, 85.1460, 54.0),
]


class SandboxError(Exception):
    """The Sandbox cannot start; the message says what to do about it."""


class SimulatedNodes:
    """Nodes in this process on one in-memory Mesh: the harness under the Sandbox and the tests.

    Each Node keeps its files in its own folder under `directory`, and all of them read `clock`.
    The radio range is unlimited unless the caller sets one.
    """

    def __init__(
        self,
        directory: Path,
        *,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
        radio_range_m: float | None = None,
    ) -> None:
        self.network = InMemoryNetwork(radio_range_m=radio_range_m)
        self._directory = directory
        self._clock = clock
        self._clients: dict[str, TestClient] = {}
        self._running: set[str] = set()

    def settings(self, name: str, **overrides: Any) -> Settings:
        """A Node's settings: its own folders, and no dashboard."""
        own = self._directory / name
        return Settings(
            **{
                "name": name,
                "dashboard_dir": own / "no-dashboard",
                "cache_pack_dir": own / "cache-pack",
                "data_dir": own / "data",
                **overrides,
            }
        )

    def start(self, settings: Settings, *, running: bool = False, **app_options: Any) -> TestClient:
        """Join the Mesh and build the Node, which trusts `HUB`.

        With `running` the Node's background loops start, so it keeps publishing until `stop` or
        `close`; otherwise it only answers requests.
        """
        app = create_app(
            settings, self.network.join(settings.name, HUB), clock=self._clock, **app_options
        )
        client = TestClient(app)
        if running:
            client.__enter__()
            self._running.add(settings.name)
        self._clients[settings.name] = client
        return client

    def stop(self, name: str) -> None:
        """Take a Node off the Mesh as a power cut would; starting it again keeps its folder."""
        client = self._clients.pop(name)
        if name in self._running:
            self._running.remove(name)
            client.__exit__(None, None, None)
        self.network.leave(name)

    def close(self) -> None:
        for name in list(self._running):
            self._clients[name].__exit__(None, None, None)
        self._running.clear()

    def __getitem__(self, name: str) -> TestClient:
        return self._clients[name]


class Sandbox:
    """A Hub and simulated Sensors in this process on one in-memory Mesh, already registered.

    Everything the Nodes write lives in a temporary folder that is removed on exit. The Sensors
    run their loops here; the caller serves `hub` (or drives it with a TestClient).
    """

    def __init__(self, pack: Path) -> None:
        if not pack.is_file():
            raise SandboxError(f"no Cache Pack at {pack}; build one or drop --pack to download it")
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
            nodes = SimulatedNodes(directory)
            setup.callback(nodes.close)
            hub_client = self._start_hub(nodes)
            self.hub = cast(FastAPI, hub_client.app)
            for site in SENSOR_SITES:
                # Running starts the Sensor's loops, so it keeps publishing.
                sensor = nodes.start(_settings(nodes, site), running=True)
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

    def _start_hub(self, nodes: SimulatedNodes) -> TestClient:
        settings = _settings(nodes, HUB_SITE, role="hub", dashboard_dir=BUILT_DASHBOARD.parent)
        try:
            CachePack(settings.cache_pack_dir).install(self._pack.read_bytes())
        except InvalidCachePack as error:
            raise SandboxError(f"{self._pack} is not a usable Cache Pack: {error}") from error
        return nodes.start(settings, sandbox=True)


def _settings(nodes: SimulatedNodes, site: NodeSite, **overrides: Any) -> Settings:
    return nodes.settings(
        site.name,
        latitude=site.latitude,
        longitude=site.longitude,
        river_km=site.river_km,
        hub_identity=HUB,
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


def download_pack_if_missing(pack: Path, client: httpx.Client) -> None:
    """Fetch the published Cache Pack to `pack` unless it is already there."""
    if pack.is_file():
        return
    logger.info("downloading the Cache Pack to %s (once)", pack)
    try:
        response = client.get(PACK_URL)
        response.raise_for_status()
    except httpx.HTTPError as error:
        # The error text carries the URL; the type is enough to tell offline from refused.
        raise SandboxError(
            f"could not download the Cache Pack ({type(error).__name__}); connect to the internet"
            " once, or pass --pack with a pack you have"
        ) from None
    pack.parent.mkdir(parents=True, exist_ok=True)
    # Written beside the final name, so an interrupted download is not mistaken for the pack.
    partial = pack.with_name(pack.name + ".part")
    partial.write_bytes(response.content)
    partial.rename(pack)


def build_dashboard_if_missing() -> None:
    """Build the dashboard the Hub serves, the first time only."""
    if BUILT_DASHBOARD.is_file():
        return
    logger.info("building the dashboard (once)")
    dashboard = REPO / "dashboard"
    try:
        for command in (["pnpm", "install", "--frozen-lockfile"], ["pnpm", "build"]):
            subprocess.run(command, cwd=dashboard, check=True, capture_output=True)
    except FileNotFoundError:
        raise SandboxError("pnpm is not installed, and the dashboard needs building once") from None
    except subprocess.CalledProcessError as error:
        raise SandboxError(
            f"`{' '.join(error.cmd)}` failed in dashboard/:\n{error.stderr.decode()[-2000:]}"
        ) from None


def run() -> None:
    logging.basicConfig(level=logging.INFO)
    # httpx logs request URLs at INFO, and the Release download's URL is signed.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    parser = argparse.ArgumentParser(
        prog="storm-shield-sandbox",
        description="Start a Hub and simulated Sensors in one process and open the dashboard.",
    )
    parser.add_argument("--port", type=int, default=8000, help="where the dashboard is served")
    parser.add_argument(
        "--pack", type=Path, help="a Cache Pack zip to use instead of the published one"
    )
    arguments = parser.parse_args()
    try:
        if arguments.pack is None:
            arguments.pack = DEFAULT_PACK
            with httpx.Client(timeout=DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True) as client:
                download_pack_if_missing(DEFAULT_PACK, client)
        build_dashboard_if_missing()
        with Sandbox(arguments.pack) as sandbox:
            server = uvicorn.Server(uvicorn.Config(sandbox.hub, port=arguments.port))
            url = f"http://localhost:{arguments.port}"
            logger.info("Sandbox dashboard: %s (everything in it is SIMULATED)", url)
            threading.Thread(target=_open_browser_when_up, args=(server, url), daemon=True).start()
            server.run()
    except SandboxError as error:
        raise SystemExit(f"storm-shield-sandbox: {error}") from None
