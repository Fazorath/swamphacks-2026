import os
import subprocess
import sys
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import httpx
import pytest

FIRST_HTTP_PORT = 8101


class RunningNode:
    """A real Node process on the loopback Reticulum interface, as on a laptop without the Pis."""

    def __init__(self, slot: int, data_dir: Path) -> None:
        self._slot = slot
        self._data_dir = data_dir
        self.url = f"http://127.0.0.1:{FIRST_HTTP_PORT + slot}"
        self._process: subprocess.Popen[bytes] | None = None

    def start(self) -> None:
        env = {
            **os.environ,
            "NODE_NAME": f"node-{self._slot}",
            "NODE_PORT": str(FIRST_HTTP_PORT + self._slot),
            "NODE_MESH_INTERFACE": "loopback",
            "NODE_LOOPBACK_SLOT": str(self._slot),
            "NODE_DATA_DIR": str(self._data_dir),
        }
        self._process = subprocess.Popen(
            [sys.executable, "-c", "from storm_shield.main import run; run()"], env=env
        )

    def stop(self) -> None:
        if self._process:
            self._process.terminate()
            self._process.wait(timeout=10)
            self._process = None

    def id(self) -> str:
        return str(self._get("/api/node")["id"])

    def heard_from(self) -> set[str]:
        return {reading["node"] for reading in self._get("/api/readings")}

    def pressure_from(self, node: str) -> float:
        readings = [reading for reading in self._get("/api/readings") if reading["node"] == node]
        return float(
            next(reading["value"] for reading in readings if reading["kind"] == "pressure")
        )

    def step_scenario(self) -> None:
        httpx.post(f"{self.url}/api/scenario/step").raise_for_status()

    def _get(self, path: str) -> Any:
        return httpx.get(f"{self.url}{path}").json()


def _eventually(check: Callable[[], bool], seconds: float = 40) -> None:
    deadline = time.monotonic() + seconds
    while True:
        try:
            if check():
                return
        except (httpx.HTTPError, StopIteration):
            pass
        if time.monotonic() > deadline:
            raise AssertionError("the Nodes did not reach the expected state in time")
        time.sleep(0.5)


@pytest.fixture
def nodes(tmp_path: Path) -> Iterator[list[RunningNode]]:
    running = [RunningNode(slot, tmp_path / f"node-{slot}") for slot in range(3)]
    for node in running:
        node.start()
    yield running
    for node in running:
        node.stop()


def test_nodes_find_each_other_and_a_step_crosses_the_mesh(nodes: list[RunningNode]) -> None:
    _eventually(lambda: all(len(node.id()) == 12 for node in nodes))
    ids = {node.id() for node in nodes}
    assert len(ids) == 3
    _eventually(lambda: all(node.heard_from() == ids for node in nodes))

    porch_id = nodes[0].id()
    before = nodes[2].pressure_from(porch_id)
    nodes[0].step_scenario()
    _eventually(lambda: nodes[2].pressure_from(porch_id) < before - 5)


def test_a_restarted_node_keeps_its_id_and_the_others_survive_its_absence(
    nodes: list[RunningNode],
) -> None:
    _eventually(lambda: all(len(node.id()) == 12 for node in nodes))
    first_id = nodes[0].id()
    nodes[0].stop()
    nodes[1].step_scenario()
    second_id = nodes[1].id()
    _eventually(lambda: nodes[2].pressure_from(second_id) < 1010)

    nodes[0].start()
    _eventually(lambda: nodes[0].id() == first_id)
