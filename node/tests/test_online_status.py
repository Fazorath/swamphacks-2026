import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from datetime import UTC, datetime

import httpx
from fastapi.testclient import TestClient

from storm_shield.main import create_app
from storm_shield.mesh import InMemoryNetwork
from storm_shield.node_registry import NodeRegistryMessage, RegisteredNode
from storm_shield.settings import Settings


class Outside:
    """The internet, as a fake the tests switch on and off."""

    def __init__(self) -> None:
        self.internet_up = True
        self.failing_checks = 0

    def internet_source(self) -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(self._answer_check))

    def _answer_check(self, request: httpx.Request) -> httpx.Response:
        if self.failing_checks > 0:
            self.failing_checks -= 1
            raise httpx.ConnectError("one dropped packet")
        if not self.internet_up:
            raise httpx.ConnectError("no internet")
        return httpx.Response(204)


@contextmanager
def _running_node(
    outside: Outside,
    name: str = "porch",
    clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    registered: bool = False,
) -> Iterator[TestClient]:
    settings = Settings(name=name, internet_check_seconds=0.01, hub_identity="hub")
    network = InMemoryNetwork()
    app = create_app(
        settings,
        network.join(name, "hub"),
        clock=clock,
        internet_source=outside.internet_source(),
    )
    if registered:
        network.join("hub").publish(
            NodeRegistryMessage(ver=1, t=0, nodes=[RegisteredNode(id=name, name=name)])
        )
    with TestClient(app) as client:
        yield client


def _wait_until(condition: Callable[[], bool], what: str) -> None:
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        if condition():
            return
        time.sleep(0.005)
    raise AssertionError(f"never saw: {what}")


def _status(client: TestClient) -> str:
    return str(client.get("/api/state").json()["status"])


def _own_values(client: TestClient) -> dict[str, float]:
    [own] = client.get("/api/state").json()["nodes"]
    return {kind: measurement["value"] for kind, measurement in own["measurements"].items()}


def test_a_node_that_can_reach_the_internet_is_online() -> None:
    with _running_node(Outside()) as client:
        _wait_until(lambda: _status(client) == "online", "the Node to report online")


def test_a_node_is_mesh_only_when_the_internet_drops_and_online_when_it_returns() -> None:
    outside = Outside()
    with _running_node(outside) as client:
        _wait_until(lambda: _status(client) == "online", "the Node to report online")
        outside.internet_up = False
        _wait_until(lambda: _status(client) == "mesh_only", "the Node to report mesh_only")
        outside.internet_up = True
        _wait_until(lambda: _status(client) == "online", "the Node to report online again")


def test_one_dropped_check_does_not_make_a_node_mesh_only() -> None:
    outside = Outside()
    with _running_node(outside) as client:
        _wait_until(lambda: _status(client) == "online", "the Node to report online")
        outside.failing_checks = 1
        deadline = time.monotonic() + 0.3
        while time.monotonic() < deadline:
            assert _status(client) == "online"
            time.sleep(0.001)
        assert outside.failing_checks == 0


def test_a_node_does_not_take_its_status_from_another_node() -> None:
    cut_off, connected = Outside(), Outside()
    with _running_node(cut_off, "garage") as garage, _running_node(connected, "porch") as porch:
        _wait_until(lambda: _status(garage) == "online", "garage online")
        _wait_until(lambda: _status(porch) == "online", "porch online")
        cut_off.internet_up = False
        _wait_until(lambda: _status(garage) == "mesh_only", "garage mesh_only")
        assert _status(porch) == "online"


def test_readings_and_flood_risk_keep_updating_while_the_node_is_mesh_only() -> None:
    outside = Outside()
    with _running_node(outside, registered=True) as client:
        _wait_until(lambda: _status(client) == "online", "the Node to report online")
        outside.internet_up = False
        _wait_until(lambda: _status(client) == "mesh_only", "the Node to report mesh_only")
        before = _own_values(client)
        assert client.get("/api/state").json()["flood_risk"]["level"] is None
        for _ in range(3):
            client.post("/api/scenario/step")
        after = _own_values(client)
        assert after["air_pressure"] < before["air_pressure"] - 5
        assert client.get("/api/state").json()["flood_risk"]["level"] is not None
